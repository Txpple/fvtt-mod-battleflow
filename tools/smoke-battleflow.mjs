// Attack-chain smoke suite: hit → auto damage roll → auto apply → receipt → revert (real DOM
// click) → immunity receipt → miss → silence. Fixtures live on the "Battle Flow Test Range"
// scene, viewed locally, never activated. Settings are restored at the end.
// ⚠ The settings pin (§1), fixtures (§2) and restore (§6) always run; sections gate in Node.
import { announcePlan, connectSuite, loadEnv, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'receipts.js',            // §4 / §4b / §4c — the revert row, clicked
  'polish.js',              // §5b — the card always posts, the no-target gate
  'stats.js'                // §3b / §3c — the data-plane stamps, the death save's rollCtx
];

const SECTIONS = {
  3: 'the hit chain',
  '3b': 'the data-plane stamp — combat + source on the receipt, in and out of combat',
  '3c': 'the data-plane stamp on a DEATH SAVE — a PC at 0 HP rolls one; rollCtx rides its message',
  4: 'revert via a real DOM click',
  '4b': 'the immunity receipt (rolled N, took 0, WHY)',
  '4c': 'revert a KILL — the flake, made deterministic',
  5: 'the miss test',
  '5b': 'polish gates: the card always posts + no-target',
  '5c': 'the attacker-side mode gate (NPC / PC / all)',
  '5d': 'the player-rolled damage offer + the crit-flag decoy pin (was probe-player-damage)',
  '5e': 'the automatic Critical Hit: a hit within 5 feet of a Paralyzed target doubles the dice; from 10 feet it does not'
};
// Each section drives its own attack from the shared fixtures; none names another.
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const want = id => !plan || plan.includes(String(id));
const f = await connectSuite({ tag: 'smoke', watchdogMs: 300_000 });
announcePlan('smoke', plan, pulled);

let failures = 0;
const report = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// ---- 1. preflight + settings on
let priorSettings = null;
{
  const r = await f.evaluate(async () => {
    const MOD = 'fvtt-mod-battleflow';
    const mod = game.modules.get(MOD);
    if (!mod?.active) return { ok: false, why: `module active=${mod?.active}` };
    // The table's current settings, restored at the end (not hardcoded defaults).
    const prior = {
      autoDamage: game.settings.get(MOD, 'autoDamage'),
      autoApply: game.settings.get(MOD, 'autoApply'),
      dramaticBeat: game.settings.get(MOD, 'dramaticBeat'),
      requireTarget: game.settings.get(MOD, 'requireTarget'),
      reactionHold: game.settings.get(MOD, 'reactionHold'),
      effectRiders: game.settings.get(MOD, 'effectRiders'),
      masteryRiders: game.settings.get(MOD, 'masteryRiders'),
    };
    await game.settings.set(MOD, 'autoDamage', 'all');
    await game.settings.set(MOD, 'autoApply', true);
    await game.settings.set(MOD, 'dramaticBeat', 0);
    await game.settings.set(MOD, 'requireTarget', false);
    // A reaction hold would legitimately stop the chain.
    await game.settings.set(MOD, 'reactionHold', false);
    // Effect riders are smoke-effects'.
    await game.settings.set(MOD, 'effectRiders', false);
    await game.settings.set(MOD, 'masteryRiders', false);
    // Scrub any reaction the hold suite left: a stray Shield holds every attack.
    for (const name of ['BF Test Victim', 'BF Test Attacker']) {
      const a = game.actors.getName(name);
      for (const it of a?.items.filter(i => i.type === 'spell' && i.name === 'Shield') ?? []) await it.delete();
      const tok = game.scenes.getName('Battle Flow Test Range')?.tokens.find(t => t.actorId === a?.id);
      const ta = tok?.actor;
      if (ta && ta !== a) {
        for (const it of ta.items.filter(i => i.type === 'spell' && i.name === 'Shield')) await it.delete();
      }
    }
    return {
      ok: true, prior,
      user: game.user.name,
      isActiveGM: game.users.activeGM?.isSelf ?? false,
      elect: game.users.activeGM?.name ?? null,
      autoDamage: game.settings.get(MOD, 'autoDamage'),
      autoApply: game.settings.get(MOD, 'autoApply'),
      trays: game.settings.get('dnd5e', 'autoCollapseChatTrays'),
    };
  }, null);
  report('module active + settings on', r.ok && r.autoDamage === 'all' && r.autoApply === true,
    JSON.stringify(r));
  if (!r.ok) {
    console.error('[smoke] preflight failed (module inactive) — aborting');
    await f.disconnect?.();
    process.exit(1);
  }
  // The auto-apply elect is the highest-ranked active GM; either topology is valid.
  // ⚠ The elect runs the code it LOADED: after a deploy run `node tools/reload-clients.mjs`.
  if (!r.isActiveGM) console.log(`  note: "${r.elect}" is the activeGM elect — ITS loaded code applies damage (stale until refreshed after a deploy)`);
  priorSettings = r.prior;
}

// ---- 2. fixtures: scene, actors, tokens
const fx = await f.evaluate(async () => {
  const out = { log: [] };
  try {
    // Scene (idempotent by name; local view only — activation would move the players).
    let scene = game.scenes.getName('Battle Flow Test Range');
    if (!scene) {
      scene = await Scene.create({
        name: 'Battle Flow Test Range', width: 2000, height: 2000,
        grid: { size: 100 }, padding: 0, backgroundColor: '#333333',
        tokenVision: false, fog: { exploration: false },
      });
      out.log.push('created scene');
    }

    // Actors (idempotent by name; imported from the first monster pack carrying a goblin).
    const wanted = { attacker: 'BF Test Attacker', victim: 'BF Test Victim' };
    const actors = {};
    for (const [role, name] of Object.entries(wanted)) {
      actors[role] = game.actors.getName(name) ?? null;
    }
    if (!actors.attacker || !actors.victim) {
      let source = null;
      for (const pack of game.packs.filter(p => p.documentName === 'Actor')) {
        const index = await pack.getIndex();
        const hit = index.find(e => /goblin/i.test(e.name));
        if (hit) { source = await pack.getDocument(hit._id); break; }
      }
      if (!source) return { ok: false, why: 'no goblin found in any Actor compendium' };
      for (const [role, name] of Object.entries(wanted)) {
        if (actors[role]) continue;
        actors[role] = await Actor.create(
          foundry.utils.mergeObject(source.toObject(), { name }, { inplace: false }));
        out.log.push(`created ${name} from ${source.name}`);
      }
    }

    const item = actors.attacker.items.find(i =>
      i.system.activities?.some?.(a => a.type === 'attack'));
    if (!item) return { ok: false, why: 'attacker has no item with an attack activity' };

    // Tokens (idempotent). ⚠ The fixture token is the UNLINKED one and must be its actor's only
    // token: the auto-crit measures from `actor.getActiveTokens()[0]`, so linked strays are swept.
    const ensureToken = async actor => {
      const linked = scene.tokens.filter(t => t.actorLink && (t.actorId === actor.id)).map(t => t.id);
      if (linked.length) await scene.deleteEmbeddedDocuments('Token', linked);
      let doc = scene.tokens.find(t => (t.actorId === actor.id) && !t.actorLink);
      if (!doc) {
        const proto = actor.prototypeToken.toObject();
        [doc] = await scene.createEmbeddedDocuments('Token', [
          foundry.utils.mergeObject(proto, {
            x: actor.name.endsWith('Victim') ? 1100 : 900, y: 1000,
            actorId: actor.id, actorLink: false,
          }, { inplace: false }),
        ]);
      }
      return doc.id;
    };
    const attackerToken = await ensureToken(actors.attacker);
    const victimToken = await ensureToken(actors.victim);

    // Full HP first: at 0, "applied 0 damage" looks like a resolver failure.
    for (const id of [victimToken, attackerToken]) {
      const ta = scene.tokens.get(id)?.actor;
      if (ta?.system.attributes?.hp?.max) {
        await ta.update({
          'system.attributes.hp.value': ta.system.attributes.hp.max,
          'system.attributes.hp.temp': 0,
        });
      }
    }

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(victimToken)); i++) {
      await new Promise(r => setTimeout(r, 250));
    }
    if (!canvas.tokens.get(victimToken)) return { ok: false, why: 'canvas never readied' };

    return {
      ok: true, sceneId: scene.id,
      attackerId: actors.attacker.id, victimId: actors.victim.id,
      attackerToken, victimToken, itemName: item.name, log: out.log,
    };
  } catch (err) {
    return { ok: false, why: `${err.message}\n${err.stack}` };
  }
}, null);
report('fixtures (scene, actors, tokens, canvas)', fx.ok, fx.ok ? `${fx.itemName}; ${fx.log.join('; ') || 'reused'}` : fx.why);
if (!fx.ok) { process.exit(1); }
// The player TEST account's name rides into §5c so BF Test PC Attacker can be granted to it.
{ const e = loadEnv(); fx.playerName = e.FOUNDRY_PLAYER_USER ?? null; }

// ---- 3. the hit chain
if (want('3')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    try {
      // The token is UNLINKED: assert against its synthetic actor, not the world actor.
      const base = game.actors.get(victimId);
      const victim = canvas.tokens.get(victimToken).actor;
      const attacker = game.actors.get(attackerId);
      // Force a hit: AC 1 on the BASE (propagates to the delta). Only a double fumble misses.
      await base.update({ 'system.attributes.ac.override': 1 });
      const hp0 = foundry.utils.deepClone(victim.system._source.attributes.hp);

      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const activity = attacker.items.getName(itemName).system.activities
        .find(a => a.type === 'attack');

      const msgCount = game.messages.size;
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      if (!usageId) return { ok: false, why: 'no usage message id' };

      const rolls = await activity.rollAttack(
        { advantage: true },
        { configure: false },
        { data: { 'system.origin': usageId } });
      if (!rolls?.length) return { ok: false, why: 'attack roll produced no rolls' };
      const attackTotal = rolls[0].total;
      // A 1-in-400 double fumble still misses; it rides in the failure detail to read as a flake.
      const fumble = rolls[0].isFumble ?? false;

      let damageMsg = null;
      for (let i = 0; i < 40 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.slice(-10).find(m =>
          (m.type === 'damage')
          && (m._source.system?.origin === usageId)
          && m.getFlag('fvtt-mod-battleflow', 'receipt'));
      }
      if (!damageMsg) {
        const tail = game.messages.contents.slice(msgCount).map(m => ({
          id: m.id, type: m.type,
          origin: m._source.system?.origin ?? null,
          bf: !!m.getFlag('fvtt-mod-battleflow', 'receipt'),
        }));
        return { ok: false, fumble, why: fumble
          ? `THE FORCED HIT MISSED: natural 1 on both advantage dice vs flat AC 1 (a 1-in-400 `
            + `run, not a defect - re-run before diagnosing). attackTotal=${attackTotal}; `
            + `tail=${JSON.stringify(tail)}`
          : `no receipted damage message; attackTotal=${attackTotal} fumble=false; `
            + `tail=${JSON.stringify(tail)}` };
      }

      const receipt = damageMsg.getFlag('fvtt-mod-battleflow', 'receipt');
      const entry = receipt.targets.find(t => t.uuid === victim.uuid);
      const hp1 = victim.system._source.attributes.hp;
      const damageTotal = damageMsg.rolls.reduce((n, r) => n + r.total, 0);
      return {
        ok: true, usageId, damageMsgId: damageMsg.id, attackTotal, damageTotal,
        entry, hp0: { value: hp0.value, temp: hp0.temp }, hp1: { value: hp1.value, temp: hp1.temp },
      };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    }
  }, fx);

  if (!r.ok) {
    report('hit → auto damage → auto apply → receipt', false, r.why);
    process.exit(1);
  }
  const applied = (r.hp0.value ?? 0) - (r.hp1.value ?? 0) + ((r.hp0.temp ?? 0) - (r.hp1.temp ?? 0));
  report('hit → auto damage roll (chained to usage card)', true,
    `attack ${r.attackTotal} vs AC 1; damage ${r.damageTotal}`);
  report('auto apply took HP', applied > 0 && applied <= r.damageTotal,
    `hp ${r.hp0.value}→${r.hp1.value} (applied ${applied} of ${r.damageTotal} rolled)`);
  report('receipt recorded prior + delta', !!r.entry
    && r.entry.prior.value === r.hp0.value
    && r.entry.delta.value === (r.hp1.value ?? 0) - (r.hp0.value ?? 0),
    JSON.stringify(r.entry));
  fx.damageMsgId = r.damageMsgId;
  fx.expectedHp = r.hp0;
}

// ---- 3b. the data-plane stamp: a damage application carries `combat` + `sourceUuid` resolved
// at write time — `combat: null` out of combat, `"id:round:turn"` inside a started one
if (want('3b')) {
  const driveOnce = async label => {
    const r = await f.evaluate(async ({ victimId, victimToken, attackerId, attackerToken, itemName }) => {
      try {
        const base = game.actors.get(victimId);
        await base.update({ 'system.attributes.ac.override': 1 });
        canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
        const attacker = game.actors.get(attackerId);
        const activity = attacker.items.getName(itemName).system.activities
          .find(a => a.type === 'attack');
        const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
        const usageId = results?.message?.id ?? null;
        if (!usageId) return { ok: false, why: 'no usage message id' };
        const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
          { data: { 'system.origin': usageId } });
        if (!rolls?.length) return { ok: false, why: 'attack roll produced no rolls' };
        let damageMsg = null;
        for (let i = 0; i < 40 && !damageMsg; i++) {
          await new Promise(r => setTimeout(r, 250));
          damageMsg = game.messages.contents.slice(-10).find(m =>
            (m.type === 'damage')
            && (m._source.system?.origin === usageId)
            && m.getFlag('fvtt-mod-battleflow', 'receipt'));
        }
        if (!damageMsg) {
          return { ok: false, why: `no receipted damage message (fumble=${rolls[0].isFumble ?? false}`
            + ` — a 1-in-400 double fumble is a re-run, not a defect)` };
        }
        const entry = damageMsg.getFlag('fvtt-mod-battleflow', 'receipt')
          .targets.find(t => t.uuid === canvas.tokens.get(victimToken).actor.uuid);
        const c = game.combat;
        return {
          ok: true,
          entry: { combat: entry?.combat, sourceUuid: entry?.sourceUuid },
          hasFields: !!entry && ('combat' in entry) && ('sourceUuid' in entry),
          // Per-part post-trait amounts: a plain hit, so parts sum to taken.
          parts: entry?.parts ?? null,
          taken: entry?.taken ?? null,
          // rollCtx rides the ATTACK message (async setFlag, landed by the damage poll above).
          rollCtx: rolls[0]?.parent?.getFlag('fvtt-mod-battleflow', 'rollCtx') ?? null,
          // An unlinked-token attack's speaker is the token's synthetic actor, never a name.
          expectedSource: canvas.tokens.get(attackerToken)?.actor?.uuid ?? null,
          expectedStamp: c?.started ? `${c.id}:${c.round}:${c.turn}` : null,
        };
      } catch (err) {
        return { ok: false, why: `${err.message}\n${err.stack}` };
      }
    }, fx);
    if (!r.ok) report(`3b ${label}`, false, r.why);
    return r;
  };

  // OUT of combat: explicit null, and the source resolved to the attacker at write time.
  const out = await driveOnce('out-of-combat chain');
  if (out.ok) {
    report('3b out of combat: combat is EXPLICIT null (stamped, empty — not absent)',
      out.hasFields && out.entry.combat === null, JSON.stringify(out.entry));
    report('3b out of combat: sourceUuid is the attacker (token actor)',
      !!out.expectedSource && out.entry.sourceUuid === out.expectedSource,
      `source=${out.entry.sourceUuid} expected=${out.expectedSource}`);
    report('3b out of combat: rollCtx rides the attack message, combat null, source = attacker',
      !!out.rollCtx && out.rollCtx.combat === null && out.rollCtx.sourceUuid === out.expectedSource,
      JSON.stringify(out.rollCtx));
    const partSum = (out.parts ?? []).reduce((n, p) => n + (p.amount ?? 0), 0);
    report('3b receipt entry carries per-part amounts summing to taken (plain hit)',
      Array.isArray(out.parts) && out.parts.length >= 1 && partSum === out.taken,
      `parts=${JSON.stringify(out.parts)} taken=${out.taken}`);
  }

  // IN combat: the stamp is the running combat's id:round:turn.
  const started = await f.evaluate(async ({ sceneId, attackerToken, victimToken }) => {
    try {
      // ⚠ No scene binding (encounters are scene-agnostic): the roster must resolve the scene
      // from the COMBATANTS.
      const combat = await Combat.create({});
      await combat.createEmbeddedDocuments('Combatant', [
        { tokenId: attackerToken, sceneId }, { tokenId: victimToken, sceneId }]);
      await combat.rollAll({ messageOptions: { rollMode: 'selfroll' } }).catch(() => {});
      // `combatStamp` reads game.combat = the ACTIVE combat — activation is part of "running".
      await combat.activate();
      await combat.startCombat();
      return { ok: combat.started && (game.combat?.id === combat.id), combatId: combat.id };
    } catch (err) { return { ok: false, why: `${err.message}\n${err.stack}` }; }
  }, fx);
  report('3b combat fixture started', started.ok, started.ok ? started.combatId : started.why);
  if (started.ok) {
    // combatStart on the elect stamps a GM-whispered roster card.
    const roster = await f.evaluate(async ({ combatId }) => {
      try {
        let flag = null;
        let content = '';
        for (let i = 0; i < 24 && !flag; i++) {
          await new Promise(r => setTimeout(r, 250));
          const m = game.messages.contents.findLast(x =>
            x.getFlag('fvtt-mod-battleflow', 'combatRoster')?.combatId === combatId);
          flag = m?.getFlag('fvtt-mod-battleflow', 'combatRoster') ?? null;
          content = m?.content ?? '';
        }
        return { ok: !!flag, flag, content };
      } catch (err) { return { ok: false, why: err.message }; }
    }, { combatId: started.combatId });
    report('3b roster marker stamped at combatStart (2 combatants, initiative order, no end yet)',
      roster.ok && roster.flag.combatants?.length === 2
        && roster.flag.combatants.every(c => 'actorUuid' in c && 'initiative' in c && 'isPC' in c)
        && (roster.flag.endedRound == null),
      JSON.stringify(roster.flag ?? roster.why ?? null));
    report('3b the card NAMES the scene on its begin line, and no end line yet (user ask)',
      roster.ok && roster.content.includes('Begins on Battle Flow Test Range')
        && !roster.content.includes('Ends on'),
      roster.ok ? 'begin line present, end absent' : (roster.why ?? 'no roster'));

    const inC = await driveOnce('in-combat chain');
    if (inC.ok) {
      report('3b in combat: the entry carries the running combat\'s id:round:turn',
        !!inC.expectedStamp && inC.entry.combat === inC.expectedStamp,
        `entry=${inC.entry.combat} expected=${inC.expectedStamp}`);
      report('3b in combat: sourceUuid still the attacker (token actor)',
        !!inC.expectedSource && inC.entry.sourceUuid === inC.expectedSource,
        `source=${inC.entry.sourceUuid} expected=${inC.expectedSource}`);
      report('3b in combat: rollCtx carries the same stamp as the receipt',
        !!inC.rollCtx && inC.rollCtx.combat === inC.expectedStamp,
        JSON.stringify(inC.rollCtx));
    }
    // Delete the combat (never leave it running); deletion also closes the roster (endedRound).
    const gone = await f.evaluate(async ({ combatId }) => {
      try {
        await game.combats.get(combatId)?.delete();
        let closed = null;
        let markerId = null;
        let content = '';
        for (let i = 0; i < 24 && (closed == null); i++) {
          await new Promise(r => setTimeout(r, 250));
          const m = game.messages.contents.findLast(x =>
            x.getFlag('fvtt-mod-battleflow', 'combatRoster')?.combatId === combatId);
          markerId = m?.id ?? null;
          closed = m?.getFlag('fvtt-mod-battleflow', 'combatRoster')?.endedRound ?? null;
          content = m?.content ?? '';
        }
        if (markerId) await game.messages.get(markerId)?.delete();
        return { ok: !game.combats.get(combatId), closed, content };
      } catch (err) { return { ok: false, why: err.message }; }
    }, { combatId: started.combatId });
    report('3b combat fixture deleted + roster closed with the final round',
      gone.ok && (gone.closed != null), `endedRound=${gone.closed ?? 'never set'}`);
    report('3b the closed card NAMES the scene on its end line too (user ask)',
      gone.ok && gone.content.includes('Ends on Battle Flow Test Range')
        && gone.content.includes(`round ${gone.closed}`),
      gone.ok ? 'end line present with round count' : (gone.why ?? ''));
  }
}

// ---- 3c. the `rollCtx` stamp on a DEATH SAVE (`dnd5e.rollDeathSave`): a character-type
// fixture at 0 HP rolls dnd5e's own `rollDeathSave`; out of combat is enough for the shape
if (want('3c')) {
  const r = await f.evaluate(async () => {
    const MOD = 'fvtt-mod-battleflow';
    try {
      const pc = game.actors.getName('BF Test PC Attacker');
      if (!pc) return { ok: false, why: 'BF Test PC Attacker is not in the world — run tools/fixture-suite.mjs' };
      if (!pc.system.attributes?.death) return { ok: false, why: `${pc.name} (${pc.type}) has no death block` };
      const prior = {
        hp: pc.system.attributes.hp.value, temp: pc.system.attributes.hp.temp ?? 0,
        success: pc.system.attributes.death.success, failure: pc.system.attributes.death.failure,
      };
      let messageId = null;
      try {
        await pc.update({
          'system.attributes.hp.value': 0, 'system.attributes.hp.temp': 0,
          'system.attributes.death.success': 0, 'system.attributes.death.failure': 0,
        });
        // The sheet button's call, dialog skipped, roll kept to this client.
        const rolls = await pc.rollDeathSave({ legacy: false }, { configure: false }, { rollMode: 'selfroll' });
        if (!rolls?.length) return { ok: false, why: 'rollDeathSave produced no rolls (was HP really 0?)' };
        const message = rolls[0].parent;
        messageId = message?.id ?? null;
        if (!(message instanceof ChatMessage)) return { ok: false, why: 'the death save has no message to stamp' };
        // The stamp is an async setFlag: wait for it.
        let ctx = null;
        for (let i = 0; i < 20 && !ctx; i++) {
          await new Promise(r => setTimeout(r, 250));
          ctx = game.messages.get(messageId)?.getFlag(MOD, 'rollCtx') ?? null;
        }
        return {
          ok: true, rollCtx: ctx, total: rolls[0].total,
          rollType: (message.type === 'save') ? message.system.type : message.type,   // 6.0: a death save is type save, sub-kind death
          expectedSource: pc.uuid,
          inCombat: !!game.combat?.started,
          after: { hp: pc.system.attributes.hp.value, success: pc.system.attributes.death.success,
            failure: pc.system.attributes.death.failure },
        };
      } finally {
        // Shared fixture: HP and the death counters back (a 20 or a 1 moves them).
        await pc.update({
          'system.attributes.hp.value': prior.hp, 'system.attributes.hp.temp': prior.temp,
          'system.attributes.death.success': prior.success, 'system.attributes.death.failure': prior.failure,
        });
        if (messageId) await game.messages.get(messageId)?.delete();
      }
    } catch (err) {
      return { ok: false, why: `${err.message}
${err.stack}` };
    }
  }, null);
  if (!r.ok) report('3c death save', false, r.why);
  else {
    report('3c a PC at 0 HP rolled a death save through dnd5e’s own path (roll.type death)',
      r.rollType === 'death', `d20 total ${r.total}; after: ${JSON.stringify(r.after)}`);
    report('3c rollCtx rides the death-save message — combat null out of combat, source = the PC',
      !!r.rollCtx && r.rollCtx.combat === null && r.rollCtx.sourceUuid === r.expectedSource,
      `${JSON.stringify(r.rollCtx)} expected source ${r.expectedSource}${r.inCombat ? ' ⚠ a combat was running' : ''}`);
  }
}

// ---- 4. revert via a real DOM click
if (want('4')) {
  const r = await f.evaluate(async ({ damageMsgId, victimToken, expectedHp }) => {
    try {
      const button = document.querySelector(
        `[data-message-id="${damageMsgId}"] .battleflow-receipt button`);
      if (!button) return { ok: false, why: 'receipt revert button not found in chat DOM' };
      // The applied card's tray must sit collapsed; report every rendered instance (each has its own).
      const trays = Array.from(document.querySelectorAll(
        `[data-message-id="${damageMsgId}"] damage-application`)).map(t => ({
          open: t.open,
          container: t.closest('#chat-notifications') ? 'notifications'
            : t.closest('#chat') ? 'chat-log' : (t.closest('[id]')?.id ?? 'unknown'),
        }));
      // Native Apply collapses only the clicked tray; the chat-log instance is the parity target.
      const trayOpen = trays.some(t => t.container === 'chat-log' && t.open);
      button.click();

      const victim = canvas.tokens.get(victimToken).actor; // the damaged (synthetic) actor
      let reverted = null;
      for (let i = 0; i < 40 && !reverted; i++) {
        await new Promise(r => setTimeout(r, 250));
        const flag = game.messages.get(damageMsgId)?.getFlag('fvtt-mod-battleflow', 'receipt');
        if (flag?.targets?.every(t => t.reverted)) reverted = flag;
      }
      if (!reverted) return { ok: false, why: 'reverted marker never set' };
      const hp = victim.system._source.attributes.hp;
      const buttonAfter = document.querySelector(
        `[data-message-id="${damageMsgId}"] .battleflow-receipt button`);
      return {
        ok: true, hp: { value: hp.value, temp: hp.temp }, expectedHp,
        buttonGone: !buttonAfter, trayOpen, trays,
      };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    }
  }, fx);
  report('applied card tray auto-collapsed (as if Apply pressed)', r.ok && r.trayOpen === false,
    r.ok ? `instances=${JSON.stringify(r.trays)}` : r.why);
  report('revert restores the HP snapshot (real click)',
    r.ok && r.hp.value === r.expectedHp.value && (r.hp.temp ?? null) === (r.expectedHp.temp ?? null),
    r.ok ? `hp back to ${r.hp.value}; button removed on re-render: ${r.buttonGone}` : r.why);
}

// ---- 4b. the immunity receipt (rolled N, took 0, and the row says WHY): immunity to the
// weapon's own damage type, read from the item
if (want('4b')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    const base = game.actors.get(victimId);
    const priorDi = foundry.utils.deepClone(base.system._source.traits.di);
    try {
      const victim = canvas.tokens.get(victimToken).actor;
      const attacker = game.actors.get(attackerId);
      const weapon = attacker.items.getName(itemName);
      const activity = weapon.system.activities.find(a => a.type === 'attack');
      const types = new Set([
        ...(weapon.system.damage?.base?.types ?? []),
        ...((activity?.damage?.parts ?? []).flatMap(p => [...(p.types ?? [])])),
      ]);
      if (!types.size) return { ok: false, why: `${itemName} deals no typed damage — nothing to be immune to` };

      await base.update({
        'system.attributes.ac.override': 1,
        'system.traits.di.value': [...types],
      });
      // Full pool first: "did not move" only counts if it could have moved.
      await victim.update({
        'system.attributes.hp.value': victim.system.attributes.hp.max,
        'system.attributes.hp.temp': 0,
      });
      const hp0 = victim.system._source.attributes.hp.value;
      const max = victim.system.attributes.hp.max;

      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      if (!usageId) return { ok: false, why: 'no usage message id' };
      const rolls = await activity.rollAttack(
        { advantage: true },
        { configure: false },
        { data: { 'system.origin': usageId } });
      const fumble = rolls?.[0]?.isFumble ?? false;

      // Whole-log search by originating id: a tail window flakes.
      let damageMsg = null;
      for (let i = 0; i < 40 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.find(m =>
          (m.type === 'damage')
          && (m._source.system?.origin === usageId)
          && m.getFlag('fvtt-mod-battleflow', 'receipt'));
      }
      if (!damageMsg) return { ok: true, fumble, noDamage: true };

      const entry = damageMsg.getFlag('fvtt-mod-battleflow', 'receipt')
        .targets.find(t => t.uuid === victim.uuid);
      const rolled = damageMsg.rolls.reduce((n, r) => n + r.total, 0);
      const hp1 = victim.system._source.attributes.hp.value;

      // What the table is TOLD: the receipt row in this client's chat DOM.
      let rowText = '';
      for (let i = 0; i < 20 && !rowText.includes('immune'); i++) {
        await new Promise(r => setTimeout(r, 250));
        rowText = document.querySelector(
          `[data-message-id="${damageMsg.id}"] .battleflow-receipt`)?.textContent ?? '';
      }
      return { ok: true, fumble, rolled, entry, max, hp0, hp1, rowText: rowText.trim(), types: [...types] };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    } finally {
      await base.update({ 'system.traits.di': priorDi });
    }
  }, fx);

  if (!r.ok) {
    report('immunity receipt (rolled N, took 0, why)', false, r.why);
  } else if (r.noDamage) {
    if (r.fumble) console.log('  SKIP immunity receipt — nat-1 fumble missed outright (flake, 1/400)');
    else report('immunity receipt (rolled N, took 0, why)', false, 'no receipted damage message appeared');
  } else {
    report('immune target starts with a pool that could move', r.hp0 === r.max, `hp ${r.hp0}/${r.max}`);
    report('immune target takes nothing while the roll lands',
      r.rolled > 0 && r.hp1 === r.hp0 && r.entry?.delta?.value === 0,
      `rolled ${r.rolled}, hp ${r.hp0} → ${r.hp1}`);
    report('receipt records taken 0 + the immunity verdict',
      r.entry?.taken === 0 && (r.entry?.traits ?? []).some(t => t.outcome === 'immune' && r.types.includes(t.type)),
      JSON.stringify({ taken: r.entry?.taken, traits: r.entry?.traits }));
    // textContent joins the flex spans without whitespace (CSS gap), so match the phrase itself.
    report('the row SAYS it — "immune to <type>"',
      r.types.some(t => r.rowText.includes(`immune to ${t}`)),
      `row: "${r.rowText}"`);
  }
}


// ---- 4c. revert a KILL, deterministically (the pool is set to 1, so any damage is lethal).
// ⚠ The race under test: revertTarget restores HP above zero and clears the dead mark while
// dnd5e's own "HP positive again" handler deletes the same effect; the loser throws "does not
// exist". `clearStatus` (shared.js) and a catch on the revert buttons keep the card's record.
if (want('4c')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    const rejections = [];
    const onRejection = ev => rejections.push(String(ev?.reason?.message ?? ev?.reason ?? ev));
    window.addEventListener('unhandledrejection', onRejection);
    let priorHp = null;
    let victim = null;
    try {
      const base = game.actors.get(victimId);
      victim = canvas.tokens.get(victimToken).actor;
      const attacker = game.actors.get(attackerId);
      await base.update({ 'system.attributes.ac.override': 1 });
      priorHp = foundry.utils.deepClone(victim.system._source.attributes.hp);
      // ⚠ The forcing: a pool of 1 walks the dead-target branch every run.
      await victim.update({ 'system.attributes.hp.value': 1 });

      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const activity = attacker.items.getName(itemName).system.activities
        .find(a => a.type === 'attack');
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      if (!usageId) return { ok: false, why: 'no usage message id' };
      const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
        { data: { 'system.origin': usageId } });
      if (rolls?.[0]?.isFumble) {
        return { ok: false, fumble: true,
          why: 'THE FORCED HIT MISSED: natural 1 on both advantage dice vs flat AC 1 '
            + '(a 1-in-400 run, not a defect - re-run before diagnosing)' };
      }

      let damageMsg = null;
      for (let i = 0; i < 40 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.slice(-10).find(m =>
          (m.type === 'damage')
          && (m._source.system?.origin === usageId)
          && m.getFlag('fvtt-mod-battleflow', 'receipt'));
      }
      if (!damageMsg) return { ok: false, why: 'no receipted damage message' };

      // Wait for the dead mark, not a flat sleep.
      let died = false;
      for (let i = 0; i < 40 && !died; i++) {
        await new Promise(r => setTimeout(r, 250));
        died = (victim.system.attributes.hp.value === 0) && victim.statuses.has('dead');
      }

      const button = document.querySelector(
        `[data-message-id="${damageMsg.id}"] .battleflow-receipt button`);
      if (!button) return { ok: false, died, why: 'receipt revert button not found in chat DOM' };
      button.click();

      let reverted = null;
      for (let i = 0; i < 40 && !reverted; i++) {
        await new Promise(r => setTimeout(r, 250));
        const flag = game.messages.get(damageMsg.id)?.getFlag('fvtt-mod-battleflow', 'receipt');
        if (flag?.targets?.every(t => t.reverted)) reverted = flag;
      }
      const buttonAfter = document.querySelector(
        `[data-message-id="${damageMsg.id}"] .battleflow-receipt button`);
      return {
        ok: true, died, reverted: !!reverted,
        hp: victim.system._source.attributes.hp.value,
        statuses: [...victim.statuses],
        buttonGone: !buttonAfter,
        rejections,
        cleanup: [damageMsg.id, usageId]
      };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}`, rejections };
    } finally {
      window.removeEventListener('unhandledrejection', onRejection);
      // ⚠ Put the pool back whatever happened: every later section attacks this token.
      try {
        if (victim && priorHp) await victim.update({
          'system.attributes.hp.value': priorHp.value,
          'system.attributes.hp.temp': priorHp.temp,
          'system.attributes.hp.tempmax': priorHp.tempmax
        });
        if (victim) for (const e of victim.effects.filter(x => x.statuses?.has?.('dead'))) await e.delete();
      } catch { /* the assertions below read the real state either way */ }
    }
  }, fx);
  report('a lethal hit really kills the target (the branch §4 walks 1 run in 8)',
    r.ok && r.died === true, r.ok ? `died=${r.died}` : r.why);
  report('reverting a KILL sets the reverted marker', r.ok && r.reverted === true,
    r.ok ? `reverted=${r.reverted} hp=${r.hp} statuses=[${(r.statuses ?? []).join(', ')}]`
      : r.why);
  report('…and the card drops its Revert button on the re-render',
    r.ok && r.buttonGone === true, r.ok ? `buttonGone=${r.buttonGone}` : r.why);
  // ⚠ The rejection channel IS the assertion: the failure shows nowhere else.
  report('the revert rejects nothing into the void',
    r.ok && (r.rejections ?? []).filter(m => /does not exist|ActiveEffect/.test(m)).length === 0,
    JSON.stringify(r.rejections ?? []));
}

// ---- 5. the miss test
if (want('5')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    try {
      const victim = game.actors.get(victimId);
      const attacker = game.actors.get(attackerId);
      await victim.update({ 'system.attributes.ac.override': 40 });

      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const activity = attacker.items.getName(itemName).system.activities
        .find(a => a.type === 'attack');
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const rolls = await activity.rollAttack(
        { disadvantage: true },
        { configure: false },
        { data: { 'system.origin': usageId } });
      const isCritical = rolls?.[0]?.isCritical ?? false;

      // A miss means the dice never exist (a nat-20 crit is reported as a flake).
      let damageMsg = null;
      for (let i = 0; i < 16 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.slice(-6).find(m =>
          (m.type === 'damage')
          && (m._source.system?.origin === usageId));
      }
      return { ok: true, attackTotal: rolls?.[0]?.total, isCritical, damageAppeared: !!damageMsg };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    }
  }, fx);
  const expectSilence = r.ok && !r.isCritical;
  report('miss → damage dice never exist', r.ok && (expectSilence ? !r.damageAppeared : true),
    r.ok ? `attack ${r.attackTotal} vs AC 40${r.isCritical ? ' (CRIT — flake, hit is correct)' : ''}; damage appeared: ${r.damageAppeared}` : r.why);
}

// ---- 5b. every use posts exactly one card, no suppress* setting is registered, and the
// no-target gate refuses an untargeted attack
if (want('5b')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    const MOD = 'fvtt-mod-battleflow';
    try {
      const out = {};
      const base = game.actors.get(victimId);
      const attacker = game.actors.get(attackerId);
      await base.update({ 'system.attributes.ac.override': 40 });
      const activity = () => attacker.items.getName(itemName).system.activities
        .find(a => a.type === 'attack');
      const usageCards = () => game.messages.contents.filter(m =>
        (m.type === 'usage')
        && m.speaker?.alias?.startsWith('BF Test'));

      // (a) No suppress* setting is registered.
      out.suppressGone = ['suppressAttackCards', 'suppressWeaponCards', 'suppressSpellCards',
        'suppressFeatureCards', 'suppressOtherCards']
        .every(k => !game.settings.settings.has(`${MOD}.${k}`));

      // (b) Every use shows its first card: one attack, exactly one usage card.
      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const before = usageCards().length;
      await activity().use({ subsequentActions: false }, { configure: false }, {});
      await new Promise(r => setTimeout(r, 1500));
      out.cardDelta = usageCards().length - before;

      // (c) No-target gate: with nothing targeted the use is refused outright.
      await game.settings.set(MOD, 'requireTarget', true);
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: false }); });
      const before3 = game.messages.size;
      const result = await activity().use({ subsequentActions: false }, { configure: false }, {});
      await new Promise(r => setTimeout(r, 1000));
      out.gateRefused = !result;
      out.gateMessagesCreated = game.messages.size - before3;
      await game.settings.set(MOD, 'requireTarget', false);
      return { ok: true, ...out };
    } catch (err) {
      await game.settings.set(MOD, 'requireTarget', false);
      return { ok: false, why: `${err.message}\n${err.stack}` };
    }
  }, fx);
  report('the suppression machinery stays ripped (no suppress* settings registered)',
    r.ok && r.suppressGone === true, r.ok ? '' : r.why);
  report('every use shows its first card (one attack → one usage card)', r.ok && r.cardDelta === 1,
    r.ok ? `cards created: ${r.cardDelta}` : r.why);
  report('no-target gate refuses the attack', r.ok && r.gateRefused && r.gateMessagesCreated === 0,
    r.ok ? `refused=${r.gateRefused}, messages created: ${r.gateMessagesCreated}` : r.why);
}

// ---- 5c. the resolver is always on: an NPC attack and a PC attack both resolve. Both roll on the
// GM client, so this tests that no ACTOR-TYPE gate remains, not a player client.
if (want('5c')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName, playerName }) => {
    const base = game.actors.get(victimId);
    const priorHp = base.system.attributes.hp.value;
    try {
      await base.update({ 'system.attributes.ac.override': 1 });

      // A character-type attacker with the NPC's own attack item: the sides differ only in actor.type.
      const npcAttacker = game.actors.get(attackerId);
      let pcAttacker = game.actors.getName('BF Test PC Attacker');
      if (!pcAttacker) {
        const weapon = npcAttacker.items.getName(itemName);
        pcAttacker = await Actor.create({
          name: 'BF Test PC Attacker', type: 'character',
          items: [weapon.toObject()],
        });
      }
      if (pcAttacker.type !== 'character') return { ok: false, why: `PC fixture is type ${pcAttacker.type}` };
      // ⚠ Owned by the player test user, granted on EVERY run: a prod mirror can delete the actor,
      // and smoke-saves and check-popup-routing need a player-owned PC.
      const playerUser = playerName ? game.users.getName(playerName) : null;
      if (playerUser) {
        await pcAttacker.update({ ownership: { default: 0, [playerUser.id]: 3 } },
          { diff: false, recursive: false });
      }
      // ⚠ And a real HP pool, every run: a bare character create has hp.max 0.
      if (!(pcAttacker.system.attributes?.hp?.max > 0)) {
        await pcAttacker.update({
          'system.attributes.hp.max': 20, 'system.attributes.hp.value': 20
        });
      }

      const attackOnce = async actor => {
        canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
        const activity = actor.items.getName(itemName).system.activities
          .find(a => a.type === 'attack');
        if (!activity) return { rolled: null, why: `${actor.name} has no attack activity` };
        const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
        const usageId = results?.message?.id ?? null;
        if (!usageId) return { rolled: null, why: `${actor.name}: no usage message` };
        const rolls = await activity.rollAttack(
          { advantage: true },
          { configure: false },
          { data: { 'system.origin': usageId } });
        let dmg = null;
        for (let i = 0; i < 16 && !dmg; i++) {
          await new Promise(r => setTimeout(r, 250));
          dmg = game.messages.contents.slice(-8).find(m =>
            (m.type === 'damage')
            && (m._source.system?.origin === usageId));
        }
        // Only a double fumble misses AC 1; reported as a flake.
        return { rolled: !!dmg, total: rolls?.[0]?.total, fumble: rolls?.[0]?.isFumble ?? false };
      };

      return { ok: true, npc: await attackOnce(npcAttacker), pc: await attackOnce(pcAttacker) };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    } finally {
      // The two hits applied: the victim's HP comes back for the sections below.
      await new Promise(r => setTimeout(r, 1500));
      await base.update({ 'system.attributes.hp.value': priorHp }).catch(() => {});
    }
  }, fx);

  if (!r.ok) {
    report('the resolver on both sides', false, r.why);
  } else {
    const cell = c => `${c.rolled}${c.fumble ? ' (FUMBLE — flake)' : ''}${c.why ? ` [${c.why}]` : ''}`;
    // A fumble legitimately produces no damage, so it can only mask a should-roll case.
    const rolledOrFlake = c => (c.rolled === true) || (c.fumble === true);
    report('an NPC attack resolves', rolledOrFlake(r.npc), cell(r.npc));
    report('a PC attack resolves', rolledOrFlake(r.pc), cell(r.pc));
  }
}

// ---- 5d. the player-rolled damage offer: the attacker is OFFERED their damage roll, the offer
// names a CRITICAL, and every way out of the popup ends in the same roll. Assertions:
//   1  setting OFF        -> damage auto-rolls, NO popup
//   2  setting ON         -> popup opens and damage does NOT roll yet
//   3  two targets hit    -> exactly ONE popup (per ATTACK, never per target)
//   4  non-crit           -> no crit badge, button reads "Roll Damage"
//   5  crit               -> badge + "Roll Critical Damage" + critical window title
//   6  button pressed     -> damage rolls, stamped originatingMessage, crit honoured
//   7  dismissed (X/Esc)  -> damage rolls IMMEDIATELY, not at the buzzer
//   8  left alone         -> the buzzer rolls it (the damageTimer window, waited out for real)
//  10  pending offer      -> damageOffer flag stamped AND the card runs the bar
//  11  after the roll     -> the offer flag folds to done (the card's bar drops)
// ⚠ The crit lever is the D20 TERM's `options.criticalSuccess` (what `isCritical` reads); the
// ROLL's numeric `options.criticalSuccess` is a decoy that changes nothing. §5 asserts both.
// Keeps its own settings snapshot: it pins playerRollDamage and damageTimer.
if (want('5d')) {
  const pd = await f.evaluate(async () => {
    const MOD = 'fvtt-mod-battleflow';
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const log = [];

    const attacker = game.actors.getName('BF Test Attacker');
    const victim = game.actors.getName('BF Test Victim');
    if (!attacker || !victim) return { fatal: 'BF Test fixtures missing — run smoke-battleflow first' };

    const scene = game.scenes.getName('Battle Flow Test Range') ?? canvas.scene;
    if (scene && (canvas.scene?.id !== scene.id)) { await scene.view(); await sleep(1200); }

    const vTokens = canvas.tokens.placeables.filter(t => t.actor?.id === victim.id);
    if (!vTokens.length) return { fatal: 'BF Test Victim has no token — re-run smoke-battleflow' };

    const activity = attacker.items.contents
      .flatMap(i => i.system.activities?.contents ?? [])
      .find(a => a.type === 'attack');
    if (!activity) return { fatal: 'BF Test Attacker has no attack activity' };

    const prior = {
      autoDamage: game.settings.get(MOD, 'autoDamage'),
      autoApply: game.settings.get(MOD, 'autoApply'),
      dramaticBeat: game.settings.get(MOD, 'dramaticBeat'),
      reactionHold: game.settings.get(MOD, 'reactionHold'),
      riders: game.settings.get(MOD, 'riders'),
      masteryRiders: game.settings.get(MOD, 'masteryRiders'),
      playerRollDamage: game.settings.get(MOD, 'playerRollDamage'),
      damageTimer: game.settings.get(MOD, 'damageTimer'),
      victimAC: foundry.utils.deepClone(victim.system._source.attributes.ac)
    };
    await game.settings.set(MOD, 'autoDamage', 'all');
    await game.settings.set(MOD, 'damageTimer', 15);   // section 8 waits this window out for real
    await game.settings.set(MOD, 'autoApply', false);   // the roll is what is under test, not the application
    await game.settings.set(MOD, 'dramaticBeat', 0);
    await game.settings.set(MOD, 'reactionHold', false);
    await game.settings.set(MOD, 'riders', false);
    await game.settings.set(MOD, 'masteryRiders', false);
    await victim.update({ 'system.attributes.ac.override': 1 });

    const created = [];   // every message this probe makes, deleted at the end

    /** Our popup, found by its eyebrow (no other dialog carries it). */
    const popupEls = () => [...document.querySelectorAll('.application')]
      .filter(el => (el.innerHTML ?? '').includes('Damage &mdash; your roll')
                 || (el.innerHTML ?? '').includes('Damage — your roll'));

    const closeAllPopups = async () => {
      for (const el of popupEls()) {
        const btn = el.querySelector('[data-action="close"]') ?? el.querySelector('.header-control');
        try { btn?.click(); } catch {}
      }
      await sleep(400);
    };

    /** Roll one attack at `targets` and return its usage + attack message. */
    const attack = async (targets) => {
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: false }); });
      await sleep(150);
      targets.forEach((t, i) => { t.setTarget(true, { releaseOthers: i === 0 }); });
      await sleep(250);
      const before = game.messages.size;
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
        { data: { 'system.origin': usageId } });
      await sleep(150);
      const fresh = game.messages.contents.slice(before);
      created.push(...fresh.map(m => m.id));
      const attackMsg = fresh.find(m => (m.type === 'attack'))
        ?? rolls?.[0]?.parent ?? null;
      return { usageId, attackMsg, total: rolls?.[0]?.total ?? null };
    };

    /** Did a damage message land for this usage? */
    const damageFor = usageId => game.messages.contents.slice(-25).find(m =>
      ((m.type === 'damage'))
      && ((m._source.system?.origin === usageId)));

    const waitDamage = async (usageId, ms) => {
      for (let i = 0; i < Math.ceil(ms / 250); i++) {
        const d = damageFor(usageId);
        if (d) { created.push(d.id); return d; }
        await sleep(250);
      }
      return null;
    };

    const results = [];
    const one = [vTokens[0]];

    // ⚠ A second target needs a DISTINCT ACTOR: descriptors key on the actor uuid, so two tokens
    // of one linked actor collapse to one row. Hidden, AC 1, deleted in teardown.
    const [extra] = await Actor.createDocuments([{
      name: 'BF Probe Second Target', type: 'npc',
      system: { attributes: { hp: { value: 30, max: 30 }, ac: { flat: 1, calc: 'flat' } } }
    }]);
    const [extraTokDoc] = await canvas.scene.createEmbeddedDocuments('Token', [{
      name: 'BF Probe Second Target', actorId: extra.id, actorLink: true,
      x: canvas.grid.size * 3, y: canvas.grid.size * 3, hidden: true, disposition: -1
    }]);
    await sleep(400);
    const two = extraTokDoc?.object ? [vTokens[0], extraTokDoc.object] : one;

    /* 1 — setting OFF: nothing changes. */
    await game.settings.set(MOD, 'playerRollDamage', false);
    {
      const { usageId } = await attack(one);
      const dmg = await waitDamage(usageId, 6000);
      results.push({ n: 1, name: 'OFF — auto-rolls, no popup',
        pass: !!dmg && (popupEls().length === 0),
        detail: `damage=${!!dmg} popups=${popupEls().length}` });
      await closeAllPopups();
    }

    /* 2 — setting ON: the popup opens and the dice WAIT. */
    await game.settings.set(MOD, 'playerRollDamage', true);
    let critLever = null;
    {
      const { usageId, attackMsg } = await attack(one);
      await sleep(1200);
      const popups = popupEls();
      const early = damageFor(usageId);
      results.push({ n: 2, name: 'ON — popup opens, damage waits',
        pass: (popups.length === 1) && !early,
        detail: `popups=${popups.length} damageAlready=${!!early}` });

      /* 10 — the wait is a table moment: flag stamped, bar on the card too. */
      const offer = attackMsg?.getFlag(MOD, 'damageOffer');
      const cardBar = attackMsg ? document.querySelector(
        `[data-message-id="${attackMsg.id}"] .battleflow-damage-offer [data-bf-deadline]`) : null;
      results.push({ n: 10, name: '(w) pending offer — flag stamped, draining bar on the card',
        pass: (offer?.status === 'pending') && (offer?.window === 15)
              && ((offer?.deadline ?? 0) > Date.now()) && !!cardBar,
        detail: `flag=${JSON.stringify(offer ?? null)} cardBarDOM=${!!cardBar}` });

      /* 4 — a normal hit: NO crit badge, and the celebration title. */
      const html = popups[0]?.innerHTML ?? '';
      const label = popups[0]?.querySelector('button[data-action="roll"]')?.textContent?.trim() ?? '';
      const title4 = popups[0]?.querySelector('.window-title')?.textContent ?? '';
      const wasCrit = attackMsg?.rolls?.[0]?.isCritical ?? null;
      results.push({ n: 4, name: 'non-crit — no badge, plain label, "You hit!" celebrates',
        // Only meaningful on a non-crit (advantage crits ~10% of the time).
        pass: wasCrit === false ? (!html.includes('Critical Hit') && /Roll Damage/i.test(label)
                && /You hit/i.test(title4)) : true,
        detail: `isCritical=${wasCrit} label="${label}" title="${title4}" badge=${html.includes('Critical Hit')}`
              + (wasCrit ? ' (rolled a crit — assertion skipped, rerun)' : '') });

      /* 4b — the "Against …" line names each target with its token icon (tooltip = the name),
       * directly before its <strong>name</strong>, which tells it apart from the bfCard portrait. */
      const aimIcon = [...(popups[0]?.querySelectorAll('img[data-tooltip]') ?? [])].find(img =>
        (img.nextElementSibling?.tagName === 'STRONG')
        && (img.dataset.tooltip === img.nextElementSibling.textContent));
      results.push({ n: '4b', name: '(hh) the Against line carries the target token icon, tooltip = name',
        pass: !!aimIcon,
        detail: aimIcon ? `icon for "${aimIcon.dataset.tooltip}"` : 'no icon+name pair in the popup' });

      /* 6 — pressing the button rolls it, stamped and crit-honest. */
      popups[0]?.querySelector('button[data-action="roll"]')?.click();
      const dmg = await waitDamage(usageId, 8000);
      results.push({ n: 6, name: 'button pressed — rolls, stamped',
        pass: !!dmg && ((dmg._source.system?.origin === usageId))
              && ((dmg.rolls?.[0]?.isCritical ?? false) === (wasCrit ?? false)),
        detail: `damage=${!!dmg} origin=${dmg?._source.system?.origin === usageId}`
              + ` attackCrit=${wasCrit} damageCrit=${dmg?.rolls?.[0]?.isCritical ?? null}` });

      /* 11 — the roll folds the offer; the card's bar drops. */
      await sleep(400);   // the done-write is fire-and-forget behind the roll
      const offerAfter = attackMsg?.getFlag(MOD, 'damageOffer');
      results.push({ n: 11, name: '(w) rolled — the offer flag folds to done',
        pass: offerAfter?.status === 'done',
        detail: `status=${offerAfter?.status ?? null}` });
      await closeAllPopups();
    }

    /* 5 — CRIT: the decoy proven dead, then the real lever, then the badge. */
    {
      // Bounded retry for a NON-crit start: the decoy pin only means something from isCritical=false.
      let attackMsg = null;
      for (let try9 = 0; try9 < 4; try9++) {
        ({ attackMsg } = await attack(one));
        await sleep(900);
        await closeAllPopups();   // the popup this attack raised is not the one under test
        if ((attackMsg?.rolls?.[0]?.isCritical ?? null) === false) break;
      }

      const roll = attackMsg?.rolls?.[0];
      const critBefore = roll?.isCritical ?? null;

      // (a) THE DECOY: the roll's own criticalSuccess.
      const rollOpts = Object.keys(roll?.options ?? {}).join(',');
      if (roll?.options) roll.options.criticalSuccess = 1;
      const afterDecoy = roll?.isCritical ?? null;

      // (b) THE REAL LEVER: the D20 term's options.
      const dieOpts = Object.keys(roll?.d20?.options ?? {}).join(',');
      if (roll?.d20?.options) roll.d20.options.criticalSuccess = 1;
      const afterReal = roll?.isCritical ?? null;

      critLever = { critBefore, afterDecoy, afterReal, rollOpts, dieOpts,
        decoyIsDead: afterDecoy === false, realWorks: afterReal === true };
      log.push(`crit lever: isCritical ${critBefore} -> decoy(roll.options) ${afterDecoy}`
             + ` -> real(roll.d20.options) ${afterReal}`);
      log.push(`  roll.options=[${rollOpts}]`);
      log.push(`  roll.d20.options=[${dieOpts}]`);

      results.push({ n: 9, name: 'the roll-level criticalSuccess is a DECOY (pins the trap)',
        // Only meaningful from a non-crit start.
        pass: (critBefore === false) ? critLever.decoyIsDead : true,
        detail: `roll.options.criticalSuccess=1 left isCritical=${afterDecoy} (must be false)`
              + ((critBefore !== false) ? ' (started critical — assertion skipped, rerun)' : '') });

      if (critLever.realWorks) {
        const mod = await import('/modules/fvtt-mod-battleflow/scripts/auto-damage.js');
        await mod.offerDamageRoll(activity, attackMsg);
        await sleep(900);
        const popups = popupEls();
        const html = popups[0]?.innerHTML ?? '';
        const label = popups[0]?.querySelector('button[data-action="roll"]')?.textContent?.trim() ?? '';
        const title = popups[0]?.querySelector('.window-title')?.textContent ?? '';
        results.push({ n: 5, name: 'crit — badge, label and title all say so',
          pass: (popups.length === 1) && html.includes('Critical Hit')
                && /Roll Critical Damage/i.test(label) && /Critical/i.test(title),
          detail: `popups=${popups.length} badge=${html.includes('Critical Hit')} label="${label}" title="${title}"` });
        await closeAllPopups();
      } else {
        results.push({ n: 5, name: 'crit — badge, label and title all say so',
          pass: false, detail: `the die-level lever did not flip isCritical: ${JSON.stringify(critLever)}` });
      }
      await sleep(1500);
    }

    /* 3 — two targets, ONE popup. */
    {
      const { usageId, attackMsg } = await attack(two);
      await sleep(1200);
      const popups = popupEls();
      const hits = attackMsg ? (attackMsg.system.targets ?? []).length : 0;
      results.push({ n: 3, name: 'two targets hit — exactly ONE popup',
        pass: (popups.length === 1) && (hits >= 2),
        detail: `targeted=${two.length} snapshot=${hits} popups=${popups.length}` });

      /* 7 — dismissing rolls IMMEDIATELY, not at the buzzer. */
      await closeAllPopups();
      const dmg = await waitDamage(usageId, 5000);   // well inside the 15s window
      results.push({ n: 7, name: 'dismissed — rolls immediately, not at the buzzer',
        pass: !!dmg, detail: `damage within 5s of dismissal = ${!!dmg}` });
    }

    /* 8 — the buzzer, waited out for real. */
    {
      const { usageId } = await attack(one);
      await sleep(1200);
      const opened = popupEls().length;
      const at5 = !!damageFor(usageId);
      const dmg = await waitDamage(usageId, 20000);   // the window is 15s
      results.push({ n: 8, name: 'left alone — the buzzer rolls it',
        pass: (opened === 1) && !at5 && !!dmg,
        detail: `popup=${opened} rolledEarly=${at5} rolledByBuzzer=${!!dmg}` });
      await closeAllPopups();
    }

    /* teardown */
    await closeAllPopups();
    game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: false }); });
    await ChatMessage.deleteDocuments([...new Set(created)].filter(id => game.messages.has(id)))
      .catch(() => {});
    if (extraTokDoc) await canvas.scene.deleteEmbeddedDocuments('Token', [extraTokDoc.id]).catch(() => {});
    if (extra) await extra.delete().catch(() => {});
    await victim.update({
      'system.attributes.ac.override': prior.victimAC?.override ?? null,
      'system.attributes.ac.flat': prior.victimAC?.flat ?? null
    }).catch(() => {});
    for (const [k, v] of Object.entries(prior)) {
      if (k === 'victimAC') continue;
      await game.settings.set(MOD, k, v);
    }
    const restored = {
      autoDamage: game.settings.get(MOD, 'autoDamage'),
      autoApply: game.settings.get(MOD, 'autoApply'),
      playerRollDamage: game.settings.get(MOD, 'playerRollDamage')
    };
    return { scene: canvas.scene?.name, victimTokens: vTokens.length, critLever, log, results, restored, prior };
  }, null);
  if (pd.fatal) {
    report('5d. the player-damage offer ran', false, `FATAL: ${pd.fatal}`);
  } else {
    console.log(`  · 5d scene "${pd.scene}", ${pd.victimTokens} victim token(s), `
      + `crit lever ${JSON.stringify(pd.critLever)}`);
    for (const l of pd.log) console.log(`  · ${l}`);
    for (const a of pd.results.sort((x, y) => x.n - y.n)) {
      report(`5d/${a.n}. ${a.name}`, a.pass, a.detail);
    }
    console.log(`  · 5d settings restored: ${JSON.stringify(pd.restored)}`);
  }
}

// ---- 5e. the automatic Critical Hit (Paralyzed/Unconscious within 5 feet): adjacent, the
// damage is critical whatever the d20 said; from 10 feet it is not (a nat 20 there is a flake)
if (want('5e')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerToken, attackerId, itemName }) => {
    const MOD = 'fvtt-mod-battleflow';
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const out = { log: [] };
    // ⚠ Wait for the walk, never sleep: a moving token's document x/y are INTERIM while it
    // animates (`_source` holds the destination).
    const arrived = async tok => {
      for (let i = 0; i < 100 && ((tok.document.x !== tok.document._source.x) || (tok.document.y !== tok.document._source.y)); i++) await sleep(100);
    };
    const base = game.actors.get(victimId);
    const vTok = canvas.tokens.get(victimToken), aTok = canvas.tokens.get(attackerToken);
    const victim = vTok?.actor;
    const attacker = game.actors.get(attackerId);
    if (!vTok || !aTok || !victim) return { ok: false, why: 'fixture tokens missing from the canvas' };
    const priorPos = { x: aTok.document.x, y: aTok.document.y };
    // ⚠ The victim on its FIXTURE square first: near the scene edge the "10 feet" square lies off
    // the scene, the platform clamps the walk, and the far swing reads as adjacent.
    const vPrior = { x: vTok.document.x, y: vTok.document.y };
    const priorHp = foundry.utils.deepClone(victim.system._source.attributes.hp);
    let paralyzed = null;
    const swing = async () => {
      vTok.setTarget(true, { releaseOthers: true });
      const activity = attacker.items.getName(itemName).system.activities.find(a => a.type === 'attack');
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
        { data: { 'system.origin': usageId } });
      let damageMsg = null;
      for (let i = 0; i < 40 && !damageMsg; i++) {
        await sleep(250);
        damageMsg = game.messages.contents.slice(-10).find(m =>
          (m.type === 'damage') && (m._source.system?.origin === usageId));
      }
      // The topology the distance read assumes, on the detail line (a stray token measures wrong).
      const aTokens = canvas.scene.tokens.filter(t => t.actorId === attacker.id).length;
      const squares = Math.max(Math.abs(aTok.document.x - vTok.document.x), Math.abs(aTok.document.y - vTok.document.y)) / canvas.scene.grid.size;
      return { d20Crit: rolls?.[0]?.isCritical ?? false, fumble: rolls?.[0]?.isFumble ?? false,
        damageCrit: damageMsg?.rolls?.[0]?.isCritical ?? null, autoCrit: damageMsg?.getFlag(MOD, 'autoCrit') ?? null,
        formula: damageMsg?.rolls?.[0]?.formula ?? null, damageId: damageMsg?.id ?? null, aTokens, squares };
    };
    try {
      await vTok.document.update({ x: 1100, y: 1000 });
      await arrived(vTok);
      await base.update({ 'system.attributes.ac.override': 1 });
      await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
      // Paralyzed on the TOKEN's actor (unlinked: that is who is attacked), adjacent.
      const eff = await ActiveEffect.implementation.fromStatusEffect('paralyzed');
      paralyzed = await ActiveEffect.implementation.create(eff.toObject(), { parent: victim, keepId: true });
      const grid = canvas.scene.grid.size;
      await aTok.document.update({ x: vTok.document.x - grid, y: vTok.document.y });
      await arrived(aTok);
      out.near = await swing();
      // Heal so the far swing is not a kill, and step back two squares — 10 feet.
      await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
      await aTok.document.update({ x: vTok.document.x - 2 * grid, y: vTok.document.y });
      await arrived(aTok);
      out.far = await swing();
      // The card says why (R5).
      const li = document.querySelector(`[data-message-id="${out.near.damageId}"]`);
      out.cardSays = /Critical Hit/.test(li?.textContent ?? '') && /Paralyzed/.test(li?.textContent ?? '');
      out.ok = true;
    } catch (err) {
      out.ok = false; out.why = `${err.message}\n${err.stack}`;
    } finally {
      try {
        if (paralyzed) await paralyzed.delete();
        await aTok.document.update(priorPos);
        await vTok.document.update(vPrior);
        await victim.update({ 'system.attributes.hp.value': priorHp.value, 'system.attributes.hp.temp': priorHp.temp });
        for (const e of victim.effects.filter(x => x.statuses?.has?.('dead'))) await e.delete();
      } catch { /* best effort */ }
    }
    return out;
  }, fx);
  if (!r.ok) report('5e setup', false, r.why);
  else {
    report('a hit within 5 feet of a Paralyzed target rolls CRITICAL damage — whatever the d20 said',
      r.near.damageCrit === true && !!r.near.autoCrit,
      `d20 crit=${r.near.d20Crit} damage crit=${r.near.damageCrit} formula=${r.near.formula} flag=${JSON.stringify(r.near.autoCrit?.sources?.map(s => s.status) ?? null)} attackerTokens=${r.near.aTokens} squares=${r.near.squares}`);
    report('…and the damage card says why', r.cardSays === true, `cardSays=${r.cardSays}`);
    report('the same hit from 10 feet is NOT made critical (a nat 20 is the dice, and a flake)',
      r.far.d20Crit ? true : (r.far.damageCrit === false && !r.far.autoCrit),
      `d20 crit=${r.far.d20Crit}${r.far.d20Crit ? ' (CRIT — flake, the dice are right)' : ''} damage crit=${r.far.damageCrit} formula=${r.far.formula} fumble=${r.far.fumble}`);
  }
}

// ---- 6. restore the table's prior settings + test chat-log cleanup
{
  const r = await f.evaluate(async prior => {
    const MOD = 'fvtt-mod-battleflow';
    await game.settings.set(MOD, 'autoDamage', prior?.autoDamage ?? 'off');
    await game.settings.set(MOD, 'autoApply', prior?.autoApply ?? false);
    await game.settings.set(MOD, 'dramaticBeat', prior?.dramaticBeat ?? 0);
    await game.settings.set(MOD, 'requireTarget', prior?.requireTarget ?? false);
    await game.settings.set(MOD, 'reactionHold', prior?.reactionHold ?? false);
    await game.settings.set(MOD, 'effectRiders', prior?.effectRiders ?? false);
    await game.settings.set(MOD, 'masteryRiders', prior?.masteryRiders ?? false);
    const testMessages = game.messages.filter(m => m.speaker?.alias?.startsWith('BF Test'));
    await ChatMessage.deleteDocuments(testMessages.map(m => m.id));
    return {
      autoDamage: game.settings.get(MOD, 'autoDamage'),
      autoApply: game.settings.get(MOD, 'autoApply'),
      deletedMessages: testMessages.length,
    };
  }, priorSettings);
  report('settings restored to pre-test values + chat cleaned',
    r.autoDamage === (priorSettings?.autoDamage ?? 'off') && r.autoApply === (priorSettings?.autoApply ?? false),
    JSON.stringify(r));
}

// ⚠ Its own summary line: "ALL PASS" and "N FAILURE(S)" stay verbatim; a partial run is stamped.
const partial = plan ? `  ⚠ PARTIAL RUN — sections ${plan.join(', ')} only` : '';
for (const id of Object.keys(SECTIONS)) {
  if (plan && !plan.includes(String(id))) console.log(`  SKIP §${id} ${SECTIONS[id]}`);
}
console.log(failures ? `\n[smoke] ${failures} FAILURE(S)${partial}` : `\n[smoke] ALL PASS${partial}`);
await f.disconnect?.();
process.exit(failures ? 1 : 0);
