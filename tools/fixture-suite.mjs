// Build (or rebuild) the SHARED suite fixtures — idempotent, safe to re-run, and the first
// thing to run after a prod refresh.
//
// ⚠ WHY THIS FILE EXISTS. The fixtures are sandbox-only by the user's choice: they clutter the
// campaign's actor list, so they are deleted from prod. `pull-prod-to-local.mjs` MIRRORS prod,
// and a mirror faithfully reproduces a deletion — so every refresh wipes them and every suite
// then dies at its preflight with "missing fixture". Before this file, each suite built its own
// share inline (smoke-battleflow the scene/attacker/victim, smoke-hold the shielder), so a
// rebuild meant running a whole suite for its side effects, and nothing rebuilt them at all
// unless that suite happened to run first. The same trap already cost a session once, recorded
// at smoke-battleflow.mjs:842 — a prod mirror deleted BF Test PC Attacker's player OWNERSHIP
// along with the actor, and two suites failed for a reason that looked nothing like the cause.
// The rule that came out of it is the rule here: **the world is disposable, so everything a
// suite needs must live in a fixture step.**
//
// ⚠ EVERYTHING LANDS IN A FOLDER CALLED "Test Suite" (user call 2026-09-01) — Actors and
// Scenes both. Loose BF Test actors are what made them annoying enough to delete from prod in
// the first place, so the folder is not tidiness, it is what lets the fixtures survive: filed
// away, they are cheap to keep. Strays created by an older suite are ADOPTED into it on every
// run rather than left behind.
//
// Run:  node tools/fixture-suite.mjs
// ⚠ Disconnect the MCP bridge first (HANDOFF.md operational rules).
//
// PAIRS WITH `fixture-d20-folds.mjs`: this file makes the ACTORS exist; that one stamps the
// compendium sources and seeds the markers (Inspired, Heroic Inspiration, a refilled Second
// Wind) that smoke-d20-folds reads. Run this one first.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "fixture-suite";
const env = loadEnv();
const f = await connectSuite({ tag: TAG, watchdogMs: 300_000, requireElect: false, env });

const out = await f.evaluate(async ({ playerName }) => {
  const log = [];
  const made = [];
  try {
    const FOLDER = "Test Suite";
    const SCENE = "Battle Flow Test Range";

    // --- the folders (one per document type — Foundry scopes folders by type) --------------
    const ensureFolder = async type => {
      let folder = game.folders.find(x => (x.name === FOLDER) && (x.type === type));
      if (!folder) {
        folder = await Folder.create({ name: FOLDER, type, color: "#4b5563" });
        log.push(`created ${type} folder "${FOLDER}"`);
      }
      return folder;
    };
    const actorFolder = await ensureFolder("Actor");
    const sceneFolder = await ensureFolder("Scene");

    // --- the scene ------------------------------------------------------------------------
    // Local view only, never activated: activating it would drag the players off their scene.
    let scene = game.scenes.getName(SCENE);
    if (!scene) {
      scene = await Scene.create({
        name: SCENE, folder: sceneFolder.id, width: 2000, height: 2000,
        grid: { size: 100 }, padding: 0, backgroundColor: "#333333",
        tokenVision: false, fog: { exploration: false }
      });
      made.push(SCENE);
      log.push("created the test scene");
    } else if (scene.folder?.id !== sceneFolder.id) {
      await scene.update({ folder: sceneFolder.id });
      log.push("adopted the test scene into the folder");
    }
    // ⚠ OBSERVER FOR PLAYERS, on every run. `smoke-nogm` drives from a PLAYER client with no GM
    // connected, and a scene at the default permission is not even in that client's
    // `game.scenes` — the suite died on `scene.id` of undefined before this line existed.
    // OBSERVER (2) is deliberately not OWNER (3): `canApplyTo` tests `isOwner`, so the player
    // can now SEE the range and still cannot write to anything on it, which is exactly the
    // condition the no-GM suite exists to prove.
    if ((scene.ownership?.default ?? 0) < 2) {
      await scene.update({ "ownership.default": 2 });
      log.push("granted players OBSERVER on the test scene (read-only — smoke-nogm needs to see it)");
    }

    // --- the two goblins: attacker and victim ----------------------------------------------
    // Imported by SHAPE from whichever monster pack carries a goblin — pack ids shift, the
    // creature does not. Unlinked tokens (the monster norm) are what the suites assert against.
    const ensureGoblin = async name => {
      let actor = game.actors.getName(name);
      if (!actor) {
        let source = null;
        for (const pack of game.packs.filter(p => p.documentName === "Actor")) {
          let index;
          try { index = await pack.getIndex(); } catch { continue; }
          const hit = index.find(e => /goblin/i.test(e.name));
          if (hit) { source = await pack.getDocument(hit._id); break; }
        }
        if (!source) throw new Error("no goblin found in any Actor compendium");
        const data = source.toObject();
        delete data._id;
        data.name = name;
        data.folder = actorFolder.id;
        actor = await Actor.create(data);
        made.push(name);
        log.push(`created ${name} from ${source.name}`);
      }
      return actor;
    };
    const attacker = await ensureGoblin("BF Test Attacker");
    const victim = await ensureGoblin("BF Test Victim");
    // Same reasoning as the scene: OBSERVER lets `smoke-nogm` READ the victim's effects to
    // prove no chip landed, while leaving it unwritable — a chip assertion the player cannot
    // even see would pass vacuously, which is worse than no assertion.
    if ((victim.ownership?.default ?? 0) < 2) {
      await victim.update({ "ownership.default": 2 });
      log.push("granted players OBSERVER on BF Test Victim (read-only)");
    }

    // The attacker must carry something with an attack activity — every suite presses it.
    const weapon = attacker.items.find(i => i.system.activities?.some?.(a => a.type === "attack"));
    if (!weapon) throw new Error("BF Test Attacker has no item with an attack activity");

    // --- the shielder: a GM-owned clone of Gren ---------------------------------------------
    // A full clone, so the Shield being cast is a real spell on a real caster with real slots.
    // ⚠ Not Gren himself: the module correctly refuses to let a GM answer a hold for a
    // character a logged-in player owns, and the harness is a GM. Not a Shield bolted onto the
    // goblin either: an item added to a base actor reaches an UNLINKED token's delta stripped
    // of its activities, and an NPC's spell slots are DERIVED, so they recompute to 0.
    let shielder = game.actors.getName("BF Test Shielder");
    if (!shielder) {
      const gren = game.actors.getName("Gren Greenmantle");
      if (!gren) throw new Error("Gren Greenmantle not found — the shielder is a clone of him");
      const data = gren.toObject();
      delete data._id;
      data.name = "BF Test Shielder";
      data.folder = actorFolder.id;
      data.ownership = { default: 0 };        // GM-only: no player may answer for it
      data.prototypeToken.actorLink = true;   // linked: no delta to lose items through
      data.prototypeToken.name = "BF Test Shielder";
      shielder = await Actor.create(data);
      made.push("BF Test Shielder");
      log.push("created BF Test Shielder from Gren Greenmantle");
    }

    // --- the player-owned PC attacker --------------------------------------------------------
    // Cloned from the NPC's own attack item so the two sides differ ONLY in actor.type —
    // masteries are PC-only in data, which is the whole reason this fixture exists.
    let pc = game.actors.getName("BF Test PC Attacker");
    if (!pc) {
      pc = await Actor.create({
        name: "BF Test PC Attacker", type: "character",
        folder: actorFolder.id, items: [weapon.toObject()]
      });
      made.push("BF Test PC Attacker");
      log.push("created BF Test PC Attacker");
    }
    if (pc.type !== "character") throw new Error(`BF Test PC Attacker is type ${pc.type}, not character`);

    // ⚠ OWNERSHIP AND HP ARE RE-SEEDED ON EVERY RUN, not only at creation. Both were lost with
    // the actor to a prod mirror on 2026-08-27 and the suites failed far from the cause: an
    // ownerless PC stopped smoke-saves' player-owned sections and check-popup-routing's cast,
    // and a bare `character` create has hp.max 0 — a degenerate sheet that was then asked for
    // saving throws no assertion was written for.
    const playerUser = playerName ? game.users.getName(playerName) : null;
    if (playerUser) {
      await pc.update({ ownership: { default: 0, [playerUser.id]: 3 } },
        { diff: false, recursive: false });
      log.push(`granted BF Test PC Attacker to ${playerUser.name}`);
    } else {
      log.push(`⚠ no player test user (MOLTEN_TEST_USER=${playerName ?? "unset"}) — PC left ownerless`);
    }
    if (!(pc.system.attributes?.hp?.max > 0)) {
      await pc.update({ "system.attributes.hp.max": 20, "system.attributes.hp.value": 20 });
      log.push("seeded BF Test PC Attacker's HP pool (20/20)");
    }

    // --- the d20-fold PCs: clones of two real party members ----------------------------------
    // ⚠ CLONES, NOT BUILDS (user call 2026-09-01). A hand-built PC has to reproduce class
    // advancement — and `level-up-pc` does NOT persist it (measured twice, 2026-08-24: the
    // subclass, its granted features and the HP bump live only in the calling client's memory,
    // and only the class `system.levels` write reaches the database). The party sheets already
    // ARE the advancement, correctly, so copying one is both cheaper and more authentic than
    // any reconstruction. Chosen for what the suite actually reads:
    //   Morgash the Gravemaker — Fighter 5 Battle Master, and every link smoke-d20-folds walks
    //     is already on him: Second Wind, Tactical Mind (whose consumption target must remap to
    //     that Second Wind), Combat Superiority and Precision Attack.
    //   Salyth — Bard 8, which is what puts `@scale.bard.inspiration` at the 1d8 the suite pins
    //     (the 2024 scale steps d6→d8 at level 5 and d8→d10 at 10, so the level is load-bearing:
    //     a Bard 4 or a Bard 10 clone fails the assertion while the code is perfectly fine).
    // ⚠ GM-OWNED, like the shielder and for the same reason: the module correctly refuses to let
    // a GM answer for a character a logged-in player owns, and the harness is a GM.
    const CLONES = [
      ["BF Test Fighter", "Morgash the Gravemaker"],
      ["BF Test Bard", "Salyth"]
    ];
    // ⚠ THE FIGHTER SWINGS AT +5, AND THE SUITE SAYS SO OUT LOUD. smoke-d20-folds states its
    // band in its own comment — "a forced 5 (+5 to hit) totals 10 and misses; a forced 19
    // totals 24 and hits" — and then asserts LITERAL composed totals (13, "10 + n") against it.
    // Morgash is a level-5 Fighter with Strength 18, so an uncalibrated clone swings at +7 and
    // every literal total lands 2 high: nine assertions go red on a module that is working
    // perfectly, in the shape of a real bug. Proficiency is +3 at level 5, so Strength 14 (+2)
    // is exactly the +5 the suite means. Re-seeded on EVERY run, not only at creation — the
    // ownership lesson at smoke-battleflow.mjs:842, applied here.
    //
    // The alternative is to teach those ~9 assertions to read the live bonus, which is the
    // better engineering and the bigger change. This keeps the calibration in the fixture step,
    // where this repo already puts everything a suite needs.
    const calibrate = async (actor, name) => {
      if (name !== "BF Test Fighter") return;
      if (actor.system.abilities?.str?.value === 14) return;
      await actor.update({ "system.abilities.str.value": 14 });
      log.push("calibrated BF Test Fighter to Strength 14 (+5 to hit — the suite's stated band)");
    };
    for (const [name, sourceName] of CLONES) {
      let clone = game.actors.getName(name);
      if (clone) { await calibrate(clone, name); continue; }
      const source = game.actors.getName(sourceName);
      if (!source) { log.push(`⚠ ${sourceName} not found — ${name} not built`); continue; }
      const data = source.toObject();
      delete data._id;
      data.name = name;
      data.folder = actorFolder.id;
      data.ownership = { default: 0 };
      data.prototypeToken.actorLink = true;
      data.prototypeToken.name = name;
      clone = await Actor.create(data);
      made.push(name);
      log.push(`created ${name} from ${sourceName}`);
      await calibrate(clone, name);
    }

    // --- adopt strays ------------------------------------------------------------------------
    // An older suite that built its own fixture put it at the root. Sweep every BF Test actor
    // into the folder so nothing is left loose to annoy anyone back into deleting it.
    const strays = game.actors.filter(a => a.name?.startsWith("BF Test") && (a.folder?.id !== actorFolder.id));
    for (const a of strays) await a.update({ folder: actorFolder.id });
    if (strays.length) log.push(`adopted ${strays.length} stray BF Test actor(s) into the folder`);

    // --- tokens on the scene -----------------------------------------------------------------
    const ensureToken = async (actor, x, linked) => {
      let doc = scene.tokens.find(t => t.actorId === actor.id);
      if (!doc) {
        [doc] = await scene.createEmbeddedDocuments("Token", [foundry.utils.mergeObject(
          actor.prototypeToken.toObject(),
          { x, y: 1000, actorId: actor.id, actorLink: linked }, { inplace: false })]);
        log.push(`placed a token for ${actor.name}`);
      }
      return doc.id;
    };
    const attackerToken = await ensureToken(attacker, 900, false);
    const victimToken = await ensureToken(victim, 1100, false);
    await ensureToken(shielder, 1500, true);

    // Full HP on the token actors: a run that died mid-flight leaves the victim at 0, where
    // "applied 0 damage" and "the pool was already empty" are the same observation.
    for (const id of [attackerToken, victimToken]) {
      const ta = scene.tokens.get(id)?.actor;
      if (ta?.system.attributes?.hp?.max) {
        await ta.update({
          "system.attributes.hp.value": ta.system.attributes.hp.max,
          "system.attributes.hp.temp": 0
        });
      }
    }

    // View locally and wait for the canvas — suites that click real DOM need token objects.
    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(victimToken)); i++) {
      await new Promise(r => setTimeout(r, 250));
    }
    if (!canvas.tokens.get(victimToken)) throw new Error("canvas never readied");

    const missing = CLONES.map(([n]) => n).filter(n => !game.actors.getName(n));
    return { ok: true, log, made, missing, folderId: actorFolder.id };
  } catch (err) {
    return { ok: false, why: `${err.message}\n${err.stack}`, log };
  }
}, { playerName: env.MOLTEN_TEST_USER ?? null });

for (const line of out.log ?? []) console.log(`  ${line}`);
if (!out.ok) {
  console.error(`\n[${TAG}] FAILED: ${out.why}`);
  await disposeSafely(f, TAG);
  process.exit(1);
}
console.log(`\n[${TAG}] fixtures ready${out.made.length ? ` — created ${out.made.join(", ")}` : " — everything reused"}.`);
if (out.missing.length) {
  console.log(`[${TAG}] ⚠ not built (source party member missing): ${out.missing.join(", ")}`);
  console.log(`[${TAG}]   smoke-d20-folds and fixture-d20-folds need them.`);
} else {
  console.log(`[${TAG}] next: node tools/fixture-d20-folds.mjs — it stamps the compendium sources`);
  console.log(`[${TAG}]       and seeds the markers the d20-fold suite reads.`);
}
await disposeSafely(f, TAG);
process.exit(0);
