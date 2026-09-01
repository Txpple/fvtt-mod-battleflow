// Live forensic for FOUNDRY v14's OWN effect clock — the measurement HANDOFF Stage 0 rests
// on before Stage 1 writes a single chip in the new shape. Prints, asserts nothing.
//
// The reading of the client bundle (foundry.mjs, v14.365) says: an ActiveEffect carries
// `start: {combat, combatant, round, turn, time}` and `duration: {value, units, expiry}`;
// the registry refreshes on every combat boundary and judges `expiry` against the ORIGINATING
// combatant; `CONFIG.ActiveEffect.expiryAction` ("update") then stamps `duration.expired`.
// That reading predicts, for a chip applied on the attacker's turn:
//
//   Sap / Slow  {value: 1, units: "rounds", expiry: "turnStart"}  → expired at the attacker's
//                                                                    next turn START
//   Vex         {value: 1, units: "rounds", expiry: "turnEnd"}    → expired at the attacker's
//                                                                    next turn END
//   Cleave chit {value: 0, units: "turns",  expiry: "turnEnd"}    → expired at the end of the
//                                                                    attacker's OWN turn
//
// ⚠ and one non-obvious wrinkle the code shows: the `turnEnd` refresh deliberately does NOT
// recompute remaining time, so a `{1 turns, turnEnd}` chit would live a whole round longer
// than it reads. Predictions are cheap; this prints what the platform actually does, step by
// step, so Stage 1's constructor is built on a measurement rather than a reading.
//
// ✅ MEASURED 2026-09-01 (Foundry 14.365, dnd5e 5.3.3), three combatants, chips applied on the
// attacker's turn (r1t0): sap-shape expired at r2t0 (the attacker's next turn START), vex-shape
// at r2t1 (its END), the 0-turn chit at r1t1 (the end of the attacker's OWN turn), and the
// 1-turn chit at r2t1 — the round longer the code promised. Every expiry write arrived as an
// `updateActiveEffect` carrying `duration.expired: true`, made by the active GM's client. Two
// traps confirmed on the way: an effect created WITHOUT an explicit `start` is stamped with
// whoever's turn it is (an off-turn apply got the victim's combatant), and world time advances
// six seconds at every round boundary (`updateWorldTime` fires at r2t0, r3t0).
//
// ⚠ AND ONE TRAP THE FIRST RUN OF THIS PROBE MEASURED BY ACCIDENT: `game.combat` is the combat
// of the scene THIS CLIENT views. A client looking at another map sees NO combat — the implicit
// `start` lands with no combat at all (time-based, 6 seconds), `Actor#inCombat` reads false, and
// the round's world-time tick then expires every chip whose clock has run out, on the tick
// rather than on its event. The suites view the range first; a GM viewing another scene
// mid-fight would see the same drift, and nothing in the module can prevent it.
//
// Also measured here, for Stage 2's benefit: whether `dnd5e.preRollAttackV2` (templated —
// invisible to the dispatch gate) and `renderAttackRollConfigurationDialog` fire on this page.
//
// Run:  node tools/probe-expiry.mjs
// ⚠ One suite at a time; disconnect the bridge first. Creates and deletes a Combat on the
// test range, creates and deletes effects on the BF fixtures, advances world time by six
// seconds and reverses it. Leaves nothing behind.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";
const TAG = "probe-expiry";
const f = await connectSuite({ tag: TAG, watchdogMs: 300_000, requireElect: true, env: loadEnv() });
const out = await f.evaluate(async () => {
  const report = { steps: [] };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const MOD = "fvtt-mod-battleflow";
  const ledger = globalThis.__bfHookLedger ?? null;
  const snap = () => (ledger ? { ...ledger } : {});
  const delta = (before, after) => Object.fromEntries(
    Object.keys(after)
      .filter(k => (after[k] ?? 0) > (before[k] ?? 0))
      .map(k => [k, (after[k] ?? 0) - (before[k] ?? 0)])
  );
  report.platform = {
    foundry: game.version, system: `${game.system.id} ${game.system.version}`,
    module: game.modules.get(MOD)?.version ?? null,
    expiryAction: CONFIG.ActiveEffect.expiryAction,
    expiryEvents: CONST.ACTIVE_EFFECT_EXPIRY_EVENTS ?? null,
    activeGMisSelf: game.users.activeGM?.isSelf ?? null,
    userRole: game.user.role
  };

  const scene = game.scenes.getName("Battle Flow Test Range");
  const victim = game.actors.getName("BF Test Victim");
  const pc = game.actors.getName("BF Test PC Attacker");
  const npc = game.actors.getName("BF Test Attacker");
  if ( !scene || !victim || !pc || !npc ) return { fatal: "missing fixture: scene or BF Test actors" };
  // Tokens where the range has them; a combatant needs only an actor to have a turn.
  const tokenFor = actor => scene.tokens.find(t => t.actorId === actor.id) ?? null;
  const pcToken = tokenFor(pc), victimToken = tokenFor(victim), npcToken = tokenFor(npc);
  const combatantFor = (actor, token, initiative) =>
    ({ actorId: actor.id, sceneId: scene.id, initiative, ...(token ? { tokenId: token.id } : {}) });
  report.tokens = { pc: !!pcToken, victim: !!victimToken, npc: !!npcToken };

  /** One effect's clock, as the platform currently sees it. */
  const read = (actor, id) => {
    const e = actor.effects.get(id);
    if ( !e ) return { gone: true };
    const d = e.duration;
    return {
      value: d.value, units: d.units, expiry: d.expiry, expired: d.expired,
      remaining: d.remaining, seconds: d.seconds, label: d.label,
      suppressed: e.isSuppressed, temporary: e.isTemporary,
      start: e.start ? { combat: e.start.combat?.id ?? null, combatant: e.start.combatant ?? null,
        round: e.start.round, turn: e.start.turn } : null
    };
  };
  const mk = async (actor, name, duration, start = undefined) => {
    const data = { name, img: "icons/svg/aura.svg", origin: pc.uuid, transfer: false, duration,
      flags: { [MOD]: { probe: true } } };
    if ( start !== undefined ) data.start = start;
    const [e] = await actor.createEmbeddedDocuments("ActiveEffect", [data]);
    return e.id;
  };
  const sweep = async () => {
    for ( const a of [victim, pc, npc] ) {
      const ids = a.effects.filter(e => e.getFlag(MOD, "probe")).map(e => e.id);
      if ( ids.length ) await a.deleteEmbeddedDocuments("ActiveEffect", ids);
    }
  };
  const where = combat => ({ round: combat.round, turn: combat.turn,
    current: combat.combatant?.name ?? null });

  let combat = null;
  const t0 = game.time.worldTime;
  // Every `duration.expired` write the platform makes while this runs, with what it wrote —
  // the shape the module's tidy hook keys on.
  const expiryWrites = [];
  const writeWatcher = Hooks.on("updateActiveEffect", (effect, changes, options, userId) => {
    if ( changes?.duration?.expired === undefined ) return;
    expiryWrites.push({ name: effect.name, expired: changes.duration.expired, byMe: userId === game.user.id,
      where: combat ? `r${combat.round}t${combat.turn}` : "ooc" });
  });
  try {
    await sweep();
    if ( game.combat ) await game.combat.delete();
    await sleep(300);
    // ⚠ VIEW THE RANGE FIRST. `game.combat` is the combat of the scene THIS CLIENT views, and
    // both the platform's implicit `start` stamp and `Actor#inCombat` read it — a client
    // looking at another map sees no combat at all, and the first run of this probe measured
    // exactly that (every chip time-based, expiring on the round's world-time tick).
    if ( canvas.scene?.id !== scene.id ) await scene.view();
    for ( let i = 0; (i < 40) && !(canvas.ready && (canvas.scene?.id === scene.id)); i++ ) await sleep(250);
    report.view = { viewed: canvas.scene?.id === scene.id, gameCombatBefore: game.combat?.id ?? null };

    /* --- 0: OUT OF COMBAT — the shape Stage 1 wants to write, and the 6-second one ------- */
    const oocRounds = await mk(victim, "probe ooc rounds", { value: 1, units: "rounds", expiry: "turnStart" });
    const oocSeconds = await mk(victim, "probe ooc seconds", { value: 6, units: "seconds" });
    await sleep(200);
    report.outOfCombat = { rounds: read(victim, oocRounds), seconds: read(victim, oocSeconds),
      worldTime: game.time.worldTime };

    // world time moves by six seconds — the ONLY out-of-combat tick — then back.
    {
      const before = snap();
      await game.time.advance(6);
      await sleep(600);
      report.afterSixSeconds = { rounds: read(victim, oocRounds), seconds: read(victim, oocSeconds),
        hooks: delta(before, snap()), worldTime: game.time.worldTime };
      await game.time.advance(-6);
      await sleep(400);
      report.afterReverse = { rounds: read(victim, oocRounds), seconds: read(victim, oocSeconds),
        worldTime: game.time.worldTime };
    }
    await victim.deleteEmbeddedDocuments("ActiveEffect", [oocSeconds]);

    /* --- 1: THE COMBAT — attacker first, victim second, a third body so turns exist ------ */
    combat = await Combat.create({ scene: scene.id });
    await combat.createEmbeddedDocuments("Combatant", [
      combatantFor(pc, pcToken, 30),
      combatantFor(victim, victimToken, 20),
      combatantFor(npc, npcToken, 10)
    ]);
    {
      const before = snap();
      await combat.startCombat();
      await sleep(500);
      report.combatStart = { where: where(combat), hooks: delta(before, snap()),
        oocRoundsNow: read(victim, oocRounds), gameCombat: game.combat?.id ?? null,
        victimInCombat: victim.inCombat, worldTime: game.time.worldTime };
    }
    const attackerCombatant = combat.combatants.find(c => c.actorId === pc.id);
    const victimCombatant = combat.combatants.find(c => c.actorId === victim.id);
    report.combatants = { attacker: attackerCombatant?.id, victim: victimCombatant?.id,
      order: combat.turns.map(c => c.name) };
    const startOf = combatant => ({ combat: combat.id, combatant: combatant.id,
      initiative: combatant.initiative, round: combat.round, turn: combat.turn,
      time: game.time.worldTime });

    // Applied ON THE ATTACKER'S TURN (round 1, turn 0), each with the attacker's combatant.
    const sapId = await mk(victim, "probe sap-shape", { value: 1, units: "rounds", expiry: "turnStart" }, startOf(attackerCombatant));
    const vexId = await mk(victim, "probe vex-shape", { value: 1, units: "rounds", expiry: "turnEnd" }, startOf(attackerCombatant));
    const chit0 = await mk(pc, "probe chit 0 turns", { value: 0, units: "turns", expiry: "turnEnd" }, startOf(attackerCombatant));
    const chit1 = await mk(pc, "probe chit 1 turns", { value: 1, units: "turns", expiry: "turnEnd" }, startOf(attackerCombatant));
    // No explicit start at all — what does the platform stamp?
    const implicit = await mk(victim, "probe implicit start", { value: 1, units: "rounds", expiry: "turnStart" });
    await sleep(300);
    const all = () => ({
      sap: read(victim, sapId), vex: read(victim, vexId), chit0: read(pc, chit0), chit1: read(pc, chit1),
      implicit: read(victim, implicit), oocRounds: read(victim, oocRounds)
    });
    report.steps.push({ step: "applied on the attacker's turn", where: where(combat), ...all() });

    // Step through two full rounds, reading after every advance — and the world clock, because
    // a round boundary may move it, and world time is its own expiry path.
    for ( let i = 0; i < 7; i++ ) {
      const before = snap();
      const t = game.time.worldTime;
      await combat.nextTurn();
      await sleep(500);
      report.steps.push({ step: `nextTurn ${i + 1}`, where: where(combat), worldTimeDelta: game.time.worldTime - t,
        hooks: delta(before, snap()), ...all() });
    }

    /* --- 2: an OFF-TURN apply — someone else's turn, no explicit start --------------------- */
    // The combat sits on whoever it sits on after seven steps; apply without a start and read
    // whose combatant the platform stamped.
    const offTurn = await mk(victim, "probe off-turn implicit", { value: 1, units: "rounds", expiry: "turnStart" });
    await sleep(200);
    report.offTurnImplicitStart = { where: where(combat), effect: read(victim, offTurn),
      attackerCombatant: attackerCombatant.id, currentCombatant: combat.combatant?.id ?? null };

    /* --- 3: does `updateActiveEffect` carry the expiry write? --------------------------------- */
    // Watch one more advance with a listener for the stamp the tidy hook would key on.
    {
      const seen = [];
      const id = Hooks.on("updateActiveEffect", (effect, changes) => {
        if ( changes?.duration?.expired !== undefined ) {
          seen.push({ name: effect.name, expired: changes.duration.expired, byGM: game.users.activeGM?.isSelf });
        }
      });
      try {
        // Fresh chit on the attacker's turn if we are on it; otherwise on whoever — we only
        // need to see the write's shape.
        const w = await mk(pc, "probe write-shape", { value: 0, units: "turns", expiry: "turnEnd" });
        await sleep(200);
        await combat.nextTurn();
        await sleep(600);
        report.expiryWrite = { where: where(combat), seen, effect: read(pc, w) };
      } finally {
        Hooks.off("updateActiveEffect", id);
      }
    }

    /* --- 4: the two hook surfaces Stage 2 would stand on ------------------------------------ */
    {
      const activity = pc.items.find(i => (i.type === "weapon") && i.system.activities?.some?.(a => a.type === "attack"))
        ?.system.activities.find(a => a.type === "attack");
      report.hookSurfaces = { activity: activity?.name ?? null };
      if ( activity ) {
        const rendered = [];
        const closer = Hooks.on("renderAttackRollConfigurationDialog", app => {
          rendered.push(app.constructor.name);
          setTimeout(() => app.close(), 300);
        });
        const generic = Hooks.on("renderApplicationV2", app => {
          if ( /RollConfigurationDialog/.test(app.constructor.name) ) rendered.push(`(generic) ${app.constructor.name}`);
        });
        const before = snap();
        try {
          const rolled = await Promise.race([
            activity.rollAttack({}, { configure: true }, { create: false }).then(r => ({ rolled: !!r?.length })),
            sleep(6000).then(() => ({ timedOut: true }))
          ]);
          // Whatever is still open under that name goes.
          for ( const app of foundry.applications.instances.values() ) {
            if ( /RollConfigurationDialog/.test(app.constructor.name) ) await app.close();
          }
          report.hookSurfaces.result = rolled;
        } finally {
          Hooks.off("renderAttackRollConfigurationDialog", closer);
          Hooks.off("renderApplicationV2", generic);
        }
        const d = delta(before, snap());
        report.hookSurfaces.rendered = rendered;
        report.hookSurfaces.hooks = Object.fromEntries(Object.entries(d)
          .filter(([k]) => /preRoll|postRoll|rollAttack|RollConfiguration|Dialog|buildRollConfig/i.test(k)));
      }
    }

    /* --- 5: combat end — what the platform does to the chips still standing --------------- */
    {
      const before = snap();
      const standing = all();
      await combat.delete();
      combat = null;
      await sleep(600);
      report.combatEnd = { before: standing, after: all(), hooks: delta(before, snap()) };
    }
  } catch(err) {
    report.error = `${err?.message}\n${err?.stack}`;
  } finally {
    Hooks.off("updateActiveEffect", writeWatcher);
    report.expiryWrites = expiryWrites;
    try { if ( combat ) await combat.delete(); } catch { /* gone */ }
    try { if ( game.combat ) await game.combat.delete(); } catch { /* gone */ }
    await sweep();
    if ( game.time.worldTime !== t0 ) {
      try { await game.time.advance(t0 - game.time.worldTime); } catch { /* best effort */ }
    }
    report.cleanup = { worldTime: game.time.worldTime, t0, combat: !!game.combat };
  }
  return report;
}, null);

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(out?.fatal || out?.error ? 1 : 0);
