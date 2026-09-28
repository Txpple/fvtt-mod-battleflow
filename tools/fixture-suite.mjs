// Build (or rebuild) the shared suite fixtures: idempotent, and the first thing to run after a
// prod refresh (a mirror of prod deletes them). Everything a suite needs lives in a fixture step.
// ⚠ Everything lands in the "Test Suite" folder (Actors and Scenes); strays are adopted into it.
//
// Run:  node tools/fixture-suite.mjs   (⚠ disconnect the MCP bridge first)
// Pairs with `fixture-d20-folds.mjs` (compendium stamps and markers): run this one first.
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

    // --- the folders (Foundry scopes folders by document type)
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

    // --- the scene: viewed locally, never activated (that would drag the players off their scene)
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
    // ⚠ OBSERVER for players: `smoke-nogm` drives from a player client, and a scene at default
    // permission is not in its `game.scenes`. Not OWNER: `canApplyTo` tests `isOwner`.
    if ((scene.ownership?.default ?? 0) < 2) {
      await scene.update({ "ownership.default": 2 });
      log.push("granted players OBSERVER on the test scene (read-only — smoke-nogm needs to see it)");
    }

    // --- the two goblins: imported by SHAPE (pack ids shift); unlinked tokens, the monster norm
    const goblinSource = async () => {
      for (const pack of game.packs.filter(p => p.documentName === "Actor")) {
        let index;
        try { index = await pack.getIndex(); } catch { continue; }
        const hit = index.find(e => /goblin/i.test(e.name));
        if (hit) return pack.getDocument(hit._id);
      }
      throw new Error("no goblin found in any Actor compendium");
    };
    const ensureGoblin = async name => {
      const source = await goblinSource();
      let actor = game.actors.getName(name);
      if (!actor) {
        const data = source.toObject();
        delete data._id;
        data.name = name;
        data.folder = actorFolder.id;
        actor = await Actor.create(data);
        made.push(name);
        log.push(`created ${name} from ${source.name}`);
      }
      // ⚠ The BASE goblin goes back to the statblock every run: a killed suite leaves HP, save
      // bonuses or AC overrides on it, and every new unlinked token inherits the residue.
      const src = source.system;
      const cur = actor.system._source;
      const reset = {};
      if ((cur.attributes?.hp?.max !== src.attributes.hp.max) || (cur.attributes?.hp?.value !== src.attributes.hp.max)) {
        reset["system.attributes.hp.max"] = src.attributes.hp.max;
        reset["system.attributes.hp.value"] = src.attributes.hp.max;
        reset["system.attributes.hp.temp"] = 0;
      }
      if (cur.attributes?.ac?.override != null) reset["system.attributes.ac.override"] = null;
      for (const [key, ab] of Object.entries(cur.abilities ?? {})) {
        if (ab?.bonuses?.save) reset[`system.abilities.${key}.bonuses.-=save`] = null;
        if (ab?.save?.roll?.bonus) reset[`system.abilities.${key}.save.roll.bonus`] = "";
      }
      const legres = src.resources?.legres ?? { max: 0, spent: 0 };
      if ((cur.resources?.legres?.max ?? 0) !== (legres.max ?? 0)) reset["system.resources.legres.max"] = legres.max ?? 0;
      if ((cur.resources?.legres?.spent ?? 0) !== (legres.spent ?? 0)) reset["system.resources.legres.spent"] = legres.spent ?? 0;
      if (Object.keys(reset).length) {
        const what = Object.keys(reset).map(k => k.replace("system.", ""));   // read BEFORE update adds `_id` in place
        await actor.update(reset);
        log.push(`${name}: reset to ${source.name}'s statblock — ${what.join(", ")}`);
      }
      return actor;
    };
    const attacker = await ensureGoblin("BF Test Attacker");
    const victim = await ensureGoblin("BF Test Victim");
    // OBSERVER lets `smoke-nogm` READ the victim's effects (an unseeable chip assertion passes vacuously).
    if ((victim.ownership?.default ?? 0) < 2) {
      await victim.update({ "ownership.default": 2 });
      log.push("granted players OBSERVER on BF Test Victim (read-only)");
    }

    // The attacker must carry something with an attack activity.
    const weapon = attacker.items.find(i => i.system.activities?.some?.(a => a.type === "attack"));
    if (!weapon) throw new Error("BF Test Attacker has no item with an attack activity");

    // --- the shielder: a GM-owned clone of Gren (a real spell, caster and slots)
    // ⚠ Not Gren: the module refuses a GM answering for a player-owned character. Not a Shield on
    // the goblin: an item added to a base actor reaches an unlinked token stripped of activities,
    // and an NPC's slots are derived (0).
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
      // ⚠ Clone the sheet, not the evening: actor-level applied effects are play state (items keep theirs).
      data.effects = [];
      shielder = await Actor.create(data);
      made.push("BF Test Shielder");
      log.push("created BF Test Shielder from Gren Greenmantle");
    } else if (shielder.effects.size) {
      // ⚠ The same strip for an existing Shielder a suite left dressed.
      const stale = shielder.effects.map(e => e.name);
      await shielder.deleteEmbeddedDocuments("ActiveEffect", shielder.effects.map(e => e.id));
      log.push(`cleared BF Test Shielder's play-state effects (${stale.join(", ")})`);
    }

    // --- the monster: a bare GM-owned NPC for the GM's side (smoke-drop's Undead Fortitude and Death
    // Throes, smoke-saves' Avoidance, smoke-spells' Regeneration). Linked, so a lent Monster Manual trait
    // keeps its activities; `legres` so the platform's Legendary Resistance button shows. The suites lend
    // the traits per section from `dnd-monster-manual.features` and take them back.
    let monster = game.actors.getName("BF Test Monster");
    if (!monster) {
      monster = await Actor.create({
        name: "BF Test Monster", type: "npc", folder: actorFolder.id, ownership: { default: 0 },
        prototypeToken: { name: "BF Test Monster", actorLink: true, disposition: -1 },
        system: {
          abilities: { str: 14, dex: 12, con: 14, int: 8, wis: 10, cha: 6 },
          attributes: { hp: { value: 50, max: 50 }, movement: { walk: 30 } },
          details: { cr: 3 },
          resources: { legres: { max: 3, spent: 0 } }
        }
      });
      made.push("BF Test Monster");
      log.push("created BF Test Monster (a bare NPC, 50 HP, Con 14, 3 Legendary Resistances)");
    }
    {
      // Every run: the statblock back (a killed suite leaves HP, a save bonus or a lent trait behind).
      const cur = monster.system._source;
      const reset = {};
      if ((cur.attributes?.hp?.max !== 50) || (cur.attributes?.hp?.value !== 50) || (cur.attributes?.hp?.temp ?? 0)) Object.assign(reset, { "system.attributes.hp.max": 50, "system.attributes.hp.value": 50, "system.attributes.hp.temp": 0 });
      for (const ab of ["con", "dex", "wis"]) if (cur.abilities?.[ab]?.save?.roll?.bonus) reset[`system.abilities.${ab}.save.roll.bonus`] = "";
      if (((cur.resources?.legres?.max ?? 0) !== 3) || (cur.resources?.legres?.spent ?? 0)) Object.assign(reset, { "system.resources.legres.max": 3, "system.resources.legres.spent": 0 });
      if (Object.keys(reset).length) { await monster.update(reset); log.push("BF Test Monster: reset to its statblock"); }
      const lentTraits = monster.items.filter(i => i.type === "feat");
      if (lentTraits.length) { await monster.deleteEmbeddedDocuments("Item", lentTraits.map(i => i.id)); log.push(`took back BF Test Monster's lent traits (${lentTraits.map(i => i.name).join(", ")})`); }
      const stale = monster.effects.map(e => e.id);
      if (stale.length) { await monster.deleteEmbeddedDocuments("ActiveEffect", stale); log.push("cleared BF Test Monster's play-state effects"); }
    }

    // --- the player-owned PC attacker: the NPC's own attack item, so the sides differ ONLY in
    // actor.type (masteries are PC-only in data)
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

    // ⚠ Ownership and HP re-seeded every run: a prod mirror drops them, and a bare `character`
    // create has hp.max 0.
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
    // ⚠ The cloned blade stays BARE: mastery suites find their blade by shape, first match, and a
    // mastery on this d8 puts it ahead of the Dagger of Venom (a d8 drops the 11-HP Victim mid-section).
    // Re-cloned when missing, stripped when it wears one.
    {
      const npc = game.actors.getName("BF Test Attacker");
      const npcWeapon = npc?.items.find(i => (i.type === "weapon") && i.system.activities?.some?.(a => a.type === "attack"));
      if (npcWeapon) {
        let clone = pc.items.find(i => (i.type === "weapon") && (i.name === npcWeapon.name));
        if (!clone) {
          const data = npcWeapon.toObject(); delete data._id; data.system.mastery = "";
          [clone] = await pc.createEmbeddedDocuments("Item", [data]);
          log.push(`re-cloned the NPC's ${npcWeapon.name} onto BF Test PC Attacker (no mastery)`);
        } else if (clone.system._source.mastery) {
          await clone.update({ "system.mastery": "" });
          log.push(`stripped the mastery a walk left on BF Test PC Attacker's ${clone.name}`);
        }
      }
    }

    // --- the d20-fold PCs: clones of two party members
    // ⚠ Clones, not builds: `level-up-pc` does not persist advancement (subclass, granted features,
    // HP), and the party sheets already are it. Morgash (Fighter 5 Battle Master): Second Wind,
    // Tactical Mind, Combat Superiority, Precision Attack. Salyth (Bard 8): `@scale.bard.inspiration`
    // at 1d8, so the level is load-bearing. GM-owned, as the shielder.
    const CLONES = [
      ["BF Test Fighter", "Morgash the Gravemaker"],
      ["BF Test Bard", "Salyth"]
    ];
    // ⚠ The Fighter swings at +5: smoke-d20-folds asserts literal composed totals against that band.
    // Proficiency +3 at level 5, so Strength 14 (+2). Re-seeded every run.
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

    // --- the BUILT PCs from the PHB pack. A class item created with `system.levels` resolves its
    // scale values without the advancement manager (tools/probe-rogue-fixture.mjs). The rogue carries
    // every sneak option on the sheet; Death Strike and Envenom Weapons are added per section (they
    // would colour every other one). GM-owned; HP and abilities re-seeded every run.
    const findPackItem = async (packIds, name) => {
      for (const id of packIds) {
        const pack = game.packs.get(id);
        if (!pack) continue;
        let index;
        try { index = await pack.getIndex(); } catch { continue; }
        const hit = index.find(e => e.name === name);
        if (hit) {
          const doc = await pack.getDocument(hit._id); const data = doc.toObject(); delete data._id;
          // ⚠ `toObject()` drops `_stats.compendiumSource`, and the pack's consumption targets are
          // compendium UUIDs remapped to the owned copy BY that stamp: every built item carries it.
          foundry.utils.setProperty(data, "_stats.compendiumSource", doc.uuid);
          return data;
        }
      }
      return null;
    };
    const PHB_CLASSES = ["dnd-players-handbook.classes"];
    // Species traits live in `origins`, origin feats in `feats`: a FEATURE is looked up in all
    // three, the class pack first; a class or subclass stays on PHB_CLASSES.
    const PHB_FEATS = [...PHB_CLASSES, "dnd-players-handbook.origins", "dnd-players-handbook.feats"];
    const PHB_GEAR = ["dnd-players-handbook.equipment", "dnd5e.equipment24"];
    const PHB_SPELLS = ["dnd-players-handbook.spells", "dnd5e.spells24"];
    const BUILT = [
      // The emanations suite: a Paladin with three auras and a Cleric who can cast Spirit Guardians.
      // ⚠ Both home on the BOTTOM ROW: the Paladin's aura is always on.
      { name: "BF Test Paladin", classes: [["Paladin", 10], ["Oath of the Ancients", null]],
        feats: ["Aura of Protection", "Aura of Courage", "Aura of Warding"], gear: ["Longsword"],
        abilities: { cha: 16, str: 16, con: 14, wis: 12 }, hp: 84, x: 300, y: 1800 },
      { name: "BF Test Cleric", classes: [["Cleric", 5], ["Life Domain", null]],
        feats: [], spells: ["Spirit Guardians"], gear: ["Mace"],
        // ⚠ Far from the Paladin, outside its aura.
        abilities: { wis: 16, con: 14, str: 12 }, hp: 38, x: 1700, y: 1800 },
      { name: "BF Test Rogue", classes: [["Rogue", 14], ["Thief", null]],
        feats: ["Sneak Attack", "Cunning Strike", "Devious Strikes", "Improved Cunning Strike", "Supreme Sneak", "Assassinate", "Steady Aim", "Evasion"],
        gear: ["Rapier", "Longsword", "Shortbow"], abilities: { dex: 18, str: 12, con: 14 }, hp: 90, x: 700 },
      { name: "BF Test Ranger", classes: [["Ranger", 5], ["Gloom Stalker", null]],
        feats: ["Dread Ambusher"], gear: ["Longsword", "Longbow"], abilities: { dex: 16, str: 14, wis: 16, con: 14 }, hp: 44, x: 500 },
      // The metamagic suite: a Sorcerer with every option on the sheet (class feats nothing grants,
      // added beside Font of Magic). Charisma 16 is load-bearing (Careful's cap, Empowered's reroll
      // count). Fireball, Hold Person and Chromatic Orb are the spell shapes the options need.
      // ⚠ Bottom row, clear of the Paladin's aura, with clear ground for a Fireball.
      { name: "BF Test Sorcerer", classes: [["Sorcerer", 5], ["Draconic Sorcery", null]],
        feats: ["Font of Magic", "Metamagic", "Careful Spell", "Distant Spell", "Empowered Spell", "Extended Spell", "Heightened Spell",
          "Quickened Spell", "Seeking Spell", "Subtle Spell", "Transmuted Spell", "Twinned Spell"],
        spells: ["Fireball", "Hold Person", "Chromatic Orb", "Fire Bolt"], gear: ["Dagger"], spellcasting: "cha",   // Fire Bolt: the CANTRIP shape (no slot, template or scaling)
        abilities: { cha: 16, con: 14, dex: 14, str: 8 }, hp: 32, x: 1000, y: 1800 },
      // Species traits and origin feats: the Goliath (Stone's Endurance, Fire's Burn; suites add
      // other boons one at a time) and the Halfling (Brave, Lucky, Savage Attacker).
      // ⚠ Both home in the empty top-left corner: suites play between x 800-1700, y 900-1700, and a
      // friendly fixture there counts as an ally (Pack Tactics).
      { name: "BF Test Goliath", classes: [["Fighter", 5]], feats: ["Stone's Endurance", "Fire's Burn"], gear: ["Greataxe"],
        abilities: { str: 16, con: 16 }, hp: 52, x: 300, y: 200 },
      { name: "BF Test Halfling", classes: [["Rogue", 3]], feats: ["Brave", "Lucky", "Savage Attacker"], gear: ["Shortsword"],
        abilities: { dex: 16, con: 12 }, hp: 24, x: 500, y: 200 }
    ];
    const built = [];
    for (const spec of BUILT) {
      let actor = game.actors.getName(spec.name);
      if (!actor) {
        const items = [];
        for (const [className, levels] of spec.classes) {
          const data = await findPackItem(PHB_CLASSES, className);
          if (!data) { log.push(`⚠ ${className} not found in the PHB pack — ${spec.name} not built`); items.length = 0; break; }
          if (levels) data.system.levels = levels;
          items.push(data);
        }
        if (!items.length) continue;
        for (const n of [...spec.feats]) {
          const data = await findPackItem(PHB_FEATS, n);
          if (data) items.push(data); else log.push(`⚠ ${n} not found — ${spec.name} lacks it`);
        }
        for (const n of spec.gear) {
          const data = await findPackItem(PHB_GEAR, n);
          if (data) { data.system.equipped = true; items.push(data); } else log.push(`⚠ ${n} not found — ${spec.name} lacks it`);
        }
        for (const n of spec.spells ?? []) {
          const data = await findPackItem(PHB_SPELLS, n);
          if (data) { data.system.preparation = { mode: "prepared", prepared: true }; items.push(data); } else log.push(`⚠ ${n} not found — ${spec.name} lacks it`);
        }
        actor = await Actor.create({
          name: spec.name, type: "character", folder: actorFolder.id, items,
          ownership: { default: 0 },
          prototypeToken: { name: spec.name, actorLink: true, disposition: 1 },
          system: { abilities: Object.fromEntries(Object.entries(spec.abilities).map(([k, v]) => [k, { value: v }])) }
        });
        made.push(spec.name);
        log.push(`created ${spec.name} from the PHB pack (${spec.classes.map(([c, l]) => l ? `${c} ${l}` : c).join(" / ")})`);
      }
      // A feature added to the spec later joins on the next run.
      const lacking = spec.feats.filter(n => !actor.items.some(i => (i.type === "feat") && (i.name === n)));
      const lackingSpells = (spec.spells ?? []).filter(n => !actor.items.some(i => (i.type === "spell") && (i.name === n)));
      if (lacking.length || lackingSpells.length) {
        const add = [];
        for (const n of lacking) { const data = await findPackItem(PHB_FEATS, n); if (data) add.push(data); else log.push(`⚠ ${n} not found — ${spec.name} lacks it`); }
        for (const n of lackingSpells) { const data = await findPackItem(PHB_SPELLS, n); if (data) { data.system.preparation = { mode: "prepared", prepared: true }; add.push(data); } else log.push(`⚠ ${n} not found — ${spec.name} lacks it`); }
        if (add.length) { await actor.createEmbeddedDocuments("Item", add); log.push(`gave ${spec.name} ${add.map(i => i.name).join(", ")}`); }
      }
      // An unstamped item is healed in place, so a rebuilt world and a healed one agree.
      const unstamped = actor.items.filter(i => !i._stats?.compendiumSource);
      if (unstamped.length) {
        const updates = [];
        for (const i of unstamped) {
          const packs = i.type === "spell" ? PHB_SPELLS : (i.type === "feat") ? PHB_FEATS : (i.type === "class" || i.type === "subclass") ? PHB_CLASSES : PHB_GEAR;
          for (const id of packs) {
            const index = await game.packs.get(id)?.getIndex().catch(() => null);
            const hit = index?.find(e => e.name === i.name);
            if (hit) { updates.push({ _id: i.id, "_stats.compendiumSource": `Compendium.${id}.Item.${hit._id}` }); break; }
          }
        }
        if (updates.length) { await actor.updateEmbeddedDocuments("Item", updates); log.push(`stamped ${updates.length} of ${spec.name}'s items with their compendium source`); }
      }
      // A built caster's spells read the ACTOR's spellcasting ability (the pack's spells carry no
      // class link); unset, the DC computes at 8 + proficiency.
      if (spec.spellcasting && (actor.system._source.attributes?.spellcasting !== spec.spellcasting)) {
        await actor.update({ "system.attributes.spellcasting": spec.spellcasting });
        log.push(`set ${spec.name}'s spellcasting ability to ${spec.spellcasting}`);
      }
      // A bare character walks at 0; give it a speed so a feature that zeroes it can be seen to.
      if (!(actor.system._source.attributes?.movement?.walk > 0)) { await actor.update({ 'system.attributes.movement.walk': 30 }); log.push(`gave ${spec.name} a walking speed of 30`); }
      // Full HP every run: a dead fixture is silently filtered from every demand and list.
      if ((actor.system.attributes?.hp?.value ?? 0) < (actor.system.attributes?.hp?.max ?? 0)) {
        await actor.update({ 'system.attributes.hp.value': actor.system.attributes.hp.max });
        log.push(`healed ${spec.name} to full`);
      }
      if ((actor.system.attributes?.hp?.max ?? 0) !== spec.hp) {
        await actor.update({ "system.attributes.hp.max": spec.hp, "system.attributes.hp.value": spec.hp });
        log.push(`seeded ${spec.name}'s HP pool (${spec.hp}/${spec.hp})`);
      }
      built.push({ actor, x: spec.x, y: spec.y ?? 1000 });
    }

    // --- adopt strays: every BF Test actor into the folder
    const strays = game.actors.filter(a => a.name?.startsWith("BF Test") && (a.folder?.id !== actorFolder.id));
    for (const a of strays) await a.update({ folder: actorFolder.id });
    if (strays.length) log.push(`adopted ${strays.length} stray BF Test actor(s) into the folder`);

    // --- tokens on the scene
    // ⚠ Every token placed here carries `flags.fvtt-mod-battleflow.fixtureHome`, the stamp
    // reset-fixture-state keeps when it sweeps a killed suite's linked leftovers.
    const ensureToken = async (actor, x, linked, y = 1000) => {
      let doc = scene.tokens.find(t => t.actorId === actor.id);
      if (!doc) {
        [doc] = await scene.createEmbeddedDocuments("Token", [foundry.utils.mergeObject(
          actor.prototypeToken.toObject(),
          { x, y, actorId: actor.id, actorLink: linked, flags: { "fvtt-mod-battleflow": { fixtureHome: true } } },
          { inplace: false })]);
        log.push(`placed a token for ${actor.name}`);
      } else if (!doc.getFlag("fvtt-mod-battleflow", "fixtureHome")) {
        await doc.setFlag("fvtt-mod-battleflow", "fixtureHome", true);
        log.push(`stamped ${actor.name}'s token as the fixture home`);
      }
      if (doc && (y !== 1000) && ((doc.x !== x) || (doc.y !== y))) {
        // A fixture with a home off the fixture line returns to it every run.
        await doc.update({ x, y }, { teleport: true, animate: false });
        log.push(`sent ${actor.name} home to (${x}, ${y})`);
      }
      return doc.id;
    };
    const attackerToken = await ensureToken(attacker, 900, false);
    const victimToken = await ensureToken(victim, 1100, false);
    await ensureToken(shielder, 1500, true);
    await ensureToken(monster, 1300, true);
    for (const { actor, x, y } of built) await ensureToken(actor, x, true, y);

    // Full HP on the token actors: at 0, "applied 0" and "already empty" look the same.
    for (const id of [attackerToken, victimToken]) {
      const ta = scene.tokens.get(id)?.actor;
      if (ta?.system.attributes?.hp?.max) {
        await ta.update({
          "system.attributes.hp.value": ta.system.attributes.hp.max,
          "system.attributes.hp.temp": 0
        });
      }
    }

    // Suites that click real DOM need token objects.
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
}, { playerName: env.FOUNDRY_PLAYER_USER ?? env.MOLTEN_TEST_USER ?? null });

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
