// Battle Flow Phase 1 smoke test — drives a real attack chain in the live world through the
// bridge (same Foundry class the house scripts use) and asserts every link:
//   hit → auto damage roll → auto apply → receipt → revert (real DOM click) →
//   immunity receipt (rolled N, took 0, and the row says WHY) → miss → silence.
// Fixtures live on a dedicated "Battle Flow Test Range" scene (viewed LOCALLY, never
// activated — players' scene is untouched). Settings are switched on for the test and back
// OFF at the end: defaults-off is the design's dogfood contract.
//
// Sections (PLAN 1.1): `--section 4b`, `--section 3,5`, `--list`. ⚠ THE SETTINGS PIN (§1),
// THE FIXTURES (§2) AND THE RESTORE (§6) ALWAYS RUN — they are not sections, they are the
// harness, and a filtered run that skipped them would leave the world dirty for the next one.
// This suite gates in NODE rather than in the page: its sections are top-level blocks, each
// with its own `f.evaluate`, so the plan never has to cross the serialization boundary.
import { announcePlan, connectSuite, loadEnv, sectionPlan } from './harness.mjs';

const SECTIONS = {
  3: 'the hit chain',
  '3b': 'the data-plane stamp — combat + source on the receipt, in and out of combat',
  4: 'revert via a real DOM click',
  '4b': 'the immunity receipt (rolled N, took 0, WHY)',
  '4c': 'revert a KILL — the flake, made deterministic',
  5: 'the miss test',
  '5b': 'polish gates: the card always posts + no-target',
  '5c': 'the attacker-side mode gate (NPC / PC / all)',
  '5d': 'the player-rolled damage offer + the crit-flag decoy pin (was probe-player-damage)'
};
// Each section drives its own attack from the shared fixtures and asserts on its own message
// ids, so none of them names another. §4 reverts what §3 applied — but through the CARD it
// finds for itself, not through a binding §3 left behind.
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

// ---------------------------------------------------------------- 1. preflight + settings on
let priorSettings = null;
{
  const r = await f.evaluate(async () => {
    const MOD = 'fvtt-mod-battleflow';
    const mod = game.modules.get(MOD);
    if (!mod?.active) return { ok: false, why: `module active=${mod?.active}` };
    // Remember the table's current settings — the test restores THEM at the end, not
    // hardcoded defaults, so running this mid-session never yanks settings out from under
    // a GM who has already walked the dogfood ladder.
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
    // The test exercises the primary (usage-card) chain and always targets first, so the
    // no-target gate stays out of the way; restored with the rest at the end.
    await game.settings.set(MOD, 'requireTarget', false);
    // This suite is about the Phase 1 chain; a reaction hold would legitimately stop it dead.
    await game.settings.set(MOD, 'reactionHold', false);
    // The 1.9 features get their own suite (smoke-effects).
    await game.settings.set(MOD, 'effectRiders', false);
    await game.settings.set(MOD, 'masteryRiders', false);
    // Scrub any reaction the hold suite may have left on the test NPC — a stray Shield there
    // holds every attack and makes this suite fail for the wrong reason.
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
  // The auto-apply elect is whichever active GM outranks the rest — the bridge when alone,
  // a logged-in human GM otherwise. Either topology is a valid test; the receipt poll and
  // DOM asserts run on the bridge's own view regardless of which client applied.
  // The applying client runs whatever code it LOADED — after a deploy, an open window is
  // stale until refreshed. `node tools/reload-clients.mjs` refreshes every other client.
  if (!r.isActiveGM) console.log(`  note: "${r.elect}" is the activeGM elect — ITS loaded code applies damage (stale until refreshed after a deploy)`);
  priorSettings = r.prior;
}

// ------------------------------------------------------- 2. fixtures: scene, actors, tokens
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

    // The attacker needs an attack activity to press.
    const item = actors.attacker.items.find(i =>
      i.system.activities?.some?.(a => a.type === 'attack'));
    if (!item) return { ok: false, why: 'attacker has no item with an attack activity' };

    // Tokens (idempotent: reuse if already placed).
    const ensureToken = async actor => {
      let doc = scene.tokens.find(t => t.actorId === actor.id);
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

    // Full HP before every run: a previous run that died mid-flight can leave the victim at
    // 0, and "applied 0 damage" then looks like a resolver failure instead of an empty pool.
    for (const id of [victimToken, attackerToken]) {
      const ta = scene.tokens.get(id)?.actor;
      if (ta?.system.attributes?.hp?.max) {
        await ta.update({
          'system.attributes.hp.value': ta.system.attributes.hp.max,
          'system.attributes.hp.temp': 0,
        });
      }
    }

    // View the scene locally and wait for token objects to exist on canvas.
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
fx.playerName = loadEnv().MOLTEN_TEST_USER ?? null;

// ------------------------------------------------------------------------- 3. the hit chain
if (want('3')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    try {
      // The token is UNLINKED (the monster norm): the thing attacked — and damaged — is the
      // token's synthetic actor (base + delta), not the world actor. Assert against IT.
      const base = game.actors.get(victimId);
      const victim = canvas.tokens.get(victimToken).actor;
      const attacker = game.actors.get(attackerId);
      // Force a hit: flat AC 1 on the BASE (unlinked tokens derive live from base + delta,
      // so this propagates). Nat-1 fumble still misses — advantage makes that 1/400.
      await base.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });
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
        { data: { 'flags.dnd5e.originatingMessage': usageId } });
      if (!rolls?.length) return { ok: false, why: 'attack roll produced no rolls' };
      const attackTotal = rolls[0].total;
      // ⚠ THE ONE FORCING HOLE LEFT UNGUARDED UNTIL 2026-08-23. Flat AC 1 + advantage makes a
      // miss a 1-in-400 double fumble, not an impossibility, and this section is the only one
      // of the four that did not say so: sections 2 and 4 return `fumble`, section 3 tolerates
      // a nat-20 crit through AC 40 explicitly. Here a fumble produced "no receipted damage
      // message" and a hard exit - a correct module reported as a broken gate, with nothing in
      // the output naming the dice. It rides in the failure detail now.
      const fumble = rolls[0].isFumble ?? false;

      // Wait for the chain: damage message with a Battle Flow receipt flag.
      let damageMsg = null;
      for (let i = 0; i < 40 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.slice(-10).find(m =>
          m.getFlag('dnd5e', 'roll.type') === 'damage'
          && m.getFlag('dnd5e', 'originatingMessage') === usageId
          && m.getFlag('fvtt-mod-battleflow', 'receipt'));
      }
      if (!damageMsg) {
        const tail = game.messages.contents.slice(msgCount).map(m => ({
          id: m.id, type: m.getFlag('dnd5e', 'roll.type') ?? m.getFlag('dnd5e', 'messageType'),
          origin: m.getFlag('dnd5e', 'originatingMessage'),
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

// ------------------------- 3b. the data-plane stamp — combat + source, in and out of combat
// The party-stats commission's Stage 1 live assertion (HANDOFF.md): a damage application
// carries `combat` + `sourceUuid` resolved at write time — `combat: null` out of combat (the
// combatStamp contract; reports group that bucket, never drop it), and `"id:round:turn"`
// inside a started combat. Self-contained like §3: drives its own two attacks, cleans up its
// own combat document.
if (want('3b')) {
  const driveOnce = async label => {
    const r = await f.evaluate(async ({ victimId, victimToken, attackerId, attackerToken, itemName }) => {
      try {
        const base = game.actors.get(victimId);
        await base.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });
        canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
        const attacker = game.actors.get(attackerId);
        const activity = attacker.items.getName(itemName).system.activities
          .find(a => a.type === 'attack');
        const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
        const usageId = results?.message?.id ?? null;
        if (!usageId) return { ok: false, why: 'no usage message id' };
        const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
          { data: { 'flags.dnd5e.originatingMessage': usageId } });
        if (!rolls?.length) return { ok: false, why: 'attack roll produced no rolls' };
        let damageMsg = null;
        for (let i = 0; i < 40 && !damageMsg; i++) {
          await new Promise(r => setTimeout(r, 250));
          damageMsg = game.messages.contents.slice(-10).find(m =>
            m.getFlag('dnd5e', 'roll.type') === 'damage'
            && m.getFlag('dnd5e', 'originatingMessage') === usageId
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
          // The speaker of an unlinked-token attack is the TOKEN's synthetic actor — the more
          // precise identity (THAT goblin, not the archetype) — so the expectation is the
          // attacker token's actor uuid, never a name (both fixture tokens share one).
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
  }

  // IN combat: the stamp is the running combat's id:round:turn.
  const started = await f.evaluate(async ({ sceneId, attackerToken, victimToken }) => {
    try {
      const combat = await Combat.create({ scene: sceneId });
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
    const inC = await driveOnce('in-combat chain');
    if (inC.ok) {
      report('3b in combat: the entry carries the running combat\'s id:round:turn',
        !!inC.expectedStamp && inC.entry.combat === inC.expectedStamp,
        `entry=${inC.entry.combat} expected=${inC.expectedStamp}`);
      report('3b in combat: sourceUuid still the attacker (token actor)',
        !!inC.expectedSource && inC.entry.sourceUuid === inC.expectedSource,
        `source=${inC.entry.sourceUuid} expected=${inC.expectedSource}`);
    }
    // Cleanup: the combat is this section's own fixture — never leave it running for §4+.
    const gone = await f.evaluate(async ({ combatId }) => {
      try { await game.combats.get(combatId)?.delete(); return { ok: !game.combats.get(combatId) }; }
      catch (err) { return { ok: false, why: err.message }; }
    }, { combatId: started.combatId });
    report('3b combat fixture deleted', gone.ok, gone.why ?? '');
  }
}

// ------------------------------------------------------------- 4. revert via a real DOM click
if (want('4')) {
  const r = await f.evaluate(async ({ damageMsgId, victimToken, expectedHp }) => {
    try {
      const button = document.querySelector(
        `[data-message-id="${damageMsgId}"] .battleflow-receipt button`);
      if (!button) return { ok: false, why: 'receipt revert button not found in chat DOM' };
      // The applied card's damage tray must sit collapsed, as if Apply had been pressed
      // (world setting is not "manual" here, so the guard doesn't apply). Report EVERY
      // rendered instance of the card — chat log, notifications pane, popouts — because a
      // message can render into several DOM trees and each has its own tray.
      const trays = Array.from(document.querySelectorAll(
        `[data-message-id="${damageMsgId}"] damage-application`)).map(t => ({
          open: t.open,
          container: t.closest('#chat-notifications') ? 'notifications'
            : t.closest('#chat') ? 'chat-log' : (t.closest('[id]')?.id ?? 'unknown'),
        }));
      // Native Apply collapses only the tray that was clicked; other DOM instances keep
      // their state. Parity target: the persistent chat-log instance must be collapsed.
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

// ------------------------------------------- 4b. the immunity receipt (rolled N, took 0, WHY)
// A cold-immune Ice Mephit "took" a rolled 9 with nothing on the card saying why (reported
// live 2026-08-15) — the receipt now carries the system's own trait verdicts. Immunity to the
// weapon's OWN damage type (read from the item, never hardcoded) makes the victim take
// nothing while the roll still lands.
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
        'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1,
        'system.traits.di.value': [...types],
      });
      // Full pool first: an assertion that a number did not move is only worth anything if
      // the number could have moved (smoke-hold's §6 lesson, generalised in the handoff).
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
        { data: { 'flags.dnd5e.originatingMessage': usageId } });
      const fumble = rolls?.[0]?.isFumble ?? false;

      // Whole-log search by originating id — a tail window flakes (handoff ground truth).
      let damageMsg = null;
      for (let i = 0; i < 40 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.find(m =>
          m.getFlag('dnd5e', 'roll.type') === 'damage'
          && m.getFlag('dnd5e', 'originatingMessage') === usageId
          && m.getFlag('fvtt-mod-battleflow', 'receipt'));
      }
      if (!damageMsg) return { ok: true, fumble, noDamage: true };

      const entry = damageMsg.getFlag('fvtt-mod-battleflow', 'receipt')
        .targets.find(t => t.uuid === victim.uuid);
      const rolled = damageMsg.rolls.reduce((n, r) => n + r.total, 0);
      const hp1 = victim.system._source.attributes.hp.value;

      // What the table is TOLD: the receipt row in this client's own chat DOM.
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
    // textContent concatenates the flex spans without whitespace (the spacing is CSS gap),
    // so match the phrase itself, pinned to the actual damage type.
    report('the row SAYS it — "immune to <type>"',
      r.types.some(t => r.rowText.includes(`immune to ${t}`)),
      `row: "${r.rowText}"`);
  }
}


// -------------------------------------------------- 4c. revert a KILL — the flake, deterministic
// ⚠ THIS SECTION IS THE FLAKE, AND IT EXISTS BECAUSE §4 COULD NOT SEE IT. §4 reverts whatever
// the dice did, and the Longsword is 1d8+3 into an 11 HP hobgoblin: only a MAX face kills, so
// the lethal branch was walked about one run in eight. It showed up as "[smoke] 2 FAILURE(S)"
// three times over two days, never on demand, and the first two sightings had their assertions
// destroyed by a `| tail` before anyone could read them.
//
// The captured third sighting (battery 2026-08-24T13-05-19) named it in one line: the green runs
// rolled 5, 6 and 7 and the red one rolled 11 — hp 11 -> 0. **A dead target was the whole
// difference**, so this section takes the dice out of it: the pool is set to 1, any damage is
// lethal, and the branch runs every time.
//
// What it was: revertTarget restores the pool ABOVE zero and then clears the dead mark — and
// dnd5e's own "HP is positive again" handler is removing that same effect at that same moment.
// toggleStatusEffect(id, {active:false}) resolves the canonical id and deletes without
// re-checking, so the loser of that race throws `ActiveEffect "dnd5edead0000000" does not
// exist!` out of the server backend. The click listener had no catch, so the rejection was
// invisible AND it skipped the two lines after it: **the revert happened to the actor and was
// never recorded on the card.** The GM sees HP come back, the Revert button stay put, and the
// row never say "reverted" — one more press and it sticks, which is exactly what "flaky" looks
// like from a table. Fixed by `clearStatus` (shared.js) + a catch on both revert buttons.
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
      await base.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });
      priorHp = foundry.utils.deepClone(victim.system._source.attributes.hp);
      // ⚠ THE FORCING, and it is the whole point of the section: a pool of 1 makes ANY damage
      // lethal, so the dead-target branch is walked on every run instead of one in eight.
      await victim.update({ 'system.attributes.hp.value': 1 });

      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const activity = attacker.items.getName(itemName).system.activities
        .find(a => a.type === 'attack');
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      if (!usageId) return { ok: false, why: 'no usage message id' };
      const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
        { data: { 'flags.dnd5e.originatingMessage': usageId } });
      if (rolls?.[0]?.isFumble) {
        return { ok: false, fumble: true,
          why: 'THE FORCED HIT MISSED: natural 1 on both advantage dice vs flat AC 1 '
            + '(a 1-in-400 run, not a defect - re-run before diagnosing)' };
      }

      let damageMsg = null;
      for (let i = 0; i < 40 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.slice(-10).find(m =>
          m.getFlag('dnd5e', 'roll.type') === 'damage'
          && m.getFlag('dnd5e', 'originatingMessage') === usageId
          && m.getFlag('fvtt-mod-battleflow', 'receipt'));
      }
      if (!damageMsg) return { ok: false, why: 'no receipted damage message' };

      // Wait for the DEATH, not a flat sleep — the dead mark is what this section is about,
      // and asserting on it before it lands would test nothing.
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
      // ⚠ Put the pool back whatever happened — every later section attacks this same token,
      // and one left on 1 HP would turn each of them into this section by accident.
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
  // ⚠ The rejection channel IS the assertion. The bug was never visible any other way: no
  // failed await, no error toast, no log line — just two writes that quietly did not happen.
  report('the revert rejects nothing into the void',
    r.ok && (r.rejections ?? []).filter(m => /does not exist|ActiveEffect/.test(m)).length === 0,
    JSON.stringify(r.rejections ?? []));
}

// -------------------------------------------------------------------------- 5. the miss test
if (want('5')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    try {
      const victim = game.actors.get(victimId);
      const attacker = game.actors.get(attackerId);
      await victim.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 40 });

      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const activity = attacker.items.getName(itemName).system.activities
        .find(a => a.type === 'attack');
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const rolls = await activity.rollAttack(
        { disadvantage: true },
        { configure: false },
        { data: { 'flags.dnd5e.originatingMessage': usageId } });
      const isCritical = rolls?.[0]?.isCritical ?? false;

      // Damage must NOT appear: a miss means the dice never exist. (A 1/400 nat-20 crit
      // hits regardless of AC — reported so a flake reads as a flake, not a bug.)
      let damageMsg = null;
      for (let i = 0; i < 16 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.slice(-6).find(m =>
          m.getFlag('dnd5e', 'roll.type') === 'damage'
          && m.getFlag('dnd5e', 'originatingMessage') === usageId);
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

// ------------------------------------------- 5b. polish gates: the card always posts + no-target
// v1.10.0 ripped the suppression machinery out (user call: cards always post, buttons hide).
// What this section now owns: every use posts exactly one card, the suppress* settings stay
// unregistered, and the no-target gate still refuses an untargeted attack.
if (want('5b')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    const MOD = 'fvtt-mod-battleflow';
    try {
      const out = {};
      const base = game.actors.get(victimId);
      const attacker = game.actors.get(attackerId);
      await base.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 40 });
      const activity = () => attacker.items.getName(itemName).system.activities
        .find(a => a.type === 'attack');
      const usageCards = () => game.messages.contents.filter(m =>
        ((m.type === 'usage') || (m.getFlag('dnd5e', 'messageType') === 'usage'))
        && m.speaker?.alias?.startsWith('BF Test'));

      // (a) The rip stayed ripped: no suppress* setting is registered.
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
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
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

// -------------------------------------------- 5c. the attacker-side mode gate (NPC / PC / all)
// Section 3 covers "all". This one proves the two one-sided modes actually exclude the other
// side — the gate is what lets the table dogfood the monster side and the player side
// separately. NOTE: the bridge is a GM, so both attacks here are rolled by a GM client; what
// is under test is the ACTOR-TYPE gate, not the player-client path (which needs a real player
// login and is dogfooded at the table).
if (want('5c')) {
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName, playerName }) => {
    const MOD = 'fvtt-mod-battleflow';
    const priorMode = game.settings.get(MOD, 'autoDamage');
    const priorApply = game.settings.get(MOD, 'autoApply');
    try {
      // Damage must be free to ROLL but never applied — four forced hits would otherwise kill
      // the victim mid-matrix and the later attacks would resolve against a corpse.
      await game.settings.set(MOD, 'autoApply', false);
      const base = game.actors.get(victimId);
      await base.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });

      // A character-type attacker, cloned from the NPC's own attack item so the two sides
      // differ ONLY in actor.type. Idempotent by name; cleaned up with the rest by alias.
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
      // ⚠ OWNED BY THE PLAYER TEST USER, default NONE — granted on EVERY run, not only at
      // creation (the smoke-twoclient idiom). The 2026-08-23 grant lived only in the WORLD,
      // and a prod mirror deleted it with the actor: this fixture then recreated the PC
      // ownerless, smoke-saves' (h) sections stopped seeing a player-OWNED pc, and
      // check-popup-routing's player could no longer cast from it (both found 2026-08-27).
      // The world is disposable; anything a suite needs must live in a fixture step.
      const playerUser = playerName ? game.users.getName(playerName) : null;
      if (playerUser) {
        await pcAttacker.update({ ownership: { default: 0, [playerUser.id]: 3 } },
          { diff: false, recursive: false });
      }
      // ⚠ AND A REAL HP POOL. A bare character create has hp.max 0, and the old world's copy
      // owed its pool to history the mirror deleted — smoke-saves §11/§16 then demanded saves
      // of a 0/0 sheet, a degenerate fixture no assertion was written for (found 2026-08-27,
      // probe: hp "0/0"). Seeded on every run, like the ownership above: the world is
      // disposable, so everything a suite needs must live in a fixture step.
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
          { data: { 'flags.dnd5e.originatingMessage': usageId } });
        let dmg = null;
        for (let i = 0; i < 16 && !dmg; i++) {
          await new Promise(r => setTimeout(r, 250));
          dmg = game.messages.contents.slice(-8).find(m =>
            m.getFlag('dnd5e', 'roll.type') === 'damage'
            && m.getFlag('dnd5e', 'originatingMessage') === usageId);
        }
        // vs AC 1 with advantage only a fumble misses (1/400) — reported so a flake reads
        // as a flake rather than a broken gate.
        return { rolled: !!dmg, total: rolls?.[0]?.total, fumble: rolls?.[0]?.isFumble ?? false };
      };

      const out = {};
      await game.settings.set(MOD, 'autoDamage', 'npc');
      out.npcMode = { npc: await attackOnce(npcAttacker), pc: await attackOnce(pcAttacker) };
      await game.settings.set(MOD, 'autoDamage', 'pc');
      out.pcMode = { npc: await attackOnce(npcAttacker), pc: await attackOnce(pcAttacker) };
      return { ok: true, ...out };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    } finally {
      await game.settings.set(MOD, 'autoDamage', priorMode);
      await game.settings.set(MOD, 'autoApply', priorApply);
    }
  }, fx);

  if (!r.ok) {
    report('attacker-side mode gate', false, r.why);
  } else {
    const cell = c => `${c.rolled}${c.fumble ? ' (FUMBLE — flake)' : ''}${c.why ? ` [${c.why}]` : ''}`;
    // A fumble legitimately produces no damage, so it can only mask a should-roll case.
    const rolledOrFlake = c => (c.rolled === true) || (c.fumble === true);
    report('mode "npc": an NPC attack still resolves', rolledOrFlake(r.npcMode.npc), cell(r.npcMode.npc));
    report('mode "npc": a PC attack rolls nothing', r.npcMode.pc.rolled === false, cell(r.npcMode.pc));
    report('mode "pc": a PC attack resolves', rolledOrFlake(r.pcMode.pc), cell(r.pcMode.pc));
    report('mode "pc": an NPC attack rolls nothing', r.pcMode.npc.rolled === false, cell(r.pcMode.npc));
  }
}

// ------------------------------ 5d. the player-rolled damage offer (was probe-player-damage)
// The player-rolled damage popup (FLOW item 3, Pass B): the attacker is OFFERED their own
// damage roll instead of having it taken, the offer says when the hit was a CRITICAL, and
// every way out of the popup ends in the same roll. It rides §2's BF Test Attacker / BF Test
// Victim fixtures, which is why it lives here.
//
// Eleven assertions:
//   1  setting OFF        -> damage auto-rolls as before, NO popup          (no regression)
//   2  setting ON         -> popup opens and damage does NOT roll yet
//   3  two targets hit    -> exactly ONE popup (per ATTACK, never per target)
//   4  non-crit           -> no crit badge, button reads "Roll Damage"
//   5  crit               -> badge + "Roll Critical Damage" + critical window title
//   6  button pressed     -> damage rolls, stamped originatingMessage, crit honoured
//   7  dismissed (X/Esc)  -> damage rolls IMMEDIATELY, not at the buzzer
//   8  left alone         -> the buzzer rolls it (the damageTimer window, waited out for real)
//  10  pending offer      -> walk-4 (w): damageOffer flag stamped AND the card runs the bar
//  11  after the roll     -> walk-4 (w): the offer flag folds to done (the card's bar drops)
//
// ⚠ THE CRIT LEVER IS A DECOY TRAP, measured 2026-08-19 and the reason assertion 5 exists in
// this shape. `D20Roll#isCritical` is `this.d20.isCriticalSuccess`, and D20Die reads
// `this.options.criticalSuccess` — the DIE TERM's options. The ROLL also carries an
// `options.criticalSuccess`, it is numeric, it looks exactly like the lever, and setting it
// changes NOTHING. This section asserts both halves so the decoy can never be mistaken for
// the real one again, and prints the getter's own reading if 5.3.x ever moves it.
//
// ⚠ FOLDED IN 2026-08-23 (PLAN 2.3). It was a separate script that could only run AFTER
// smoke-battleflow, on smoke-battleflow's own fixtures, and was therefore forgotten twice.
// As a section it cannot be: the fixtures are already standing and the restore below runs
// whatever happens. Its own settings snapshot/restore is kept — it pins playerRollDamage
// and damageTimer, which §1's pin does not name.
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

    // Prior state, restored in full at the end.
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
    // Force the hit the way smoke-battleflow does: flat AC 1 on the base actor.
    await victim.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });

    const created = [];   // every message this probe makes, deleted at the end

    /** Our popup, found by its eyebrow — the one string no other dialog in this module carries. */
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
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      await sleep(150);
      targets.forEach((t, i) => t.setTarget(true, { releaseOthers: i === 0 }));
      await sleep(250);
      const before = game.messages.size;
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
        { data: { 'flags.dnd5e.originatingMessage': usageId } });
      await sleep(150);
      const fresh = game.messages.contents.slice(before);
      created.push(...fresh.map(m => m.id));
      const attackMsg = fresh.find(m => m.getFlag('dnd5e', 'roll.type') === 'attack')
        ?? rolls?.[0]?.parent ?? null;
      return { usageId, attackMsg, total: rolls?.[0]?.total ?? null };
    };

    /** Did a damage message land for this usage? */
    const damageFor = usageId => game.messages.contents.slice(-25).find(m =>
      (m.getFlag('dnd5e', 'roll.type') === 'damage')
      && (m.getFlag('dnd5e', 'originatingMessage') === usageId));

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

    // ⚠ A second target needs a DISTINCT ACTOR, not a second token of the same one: descriptors
    // key on the actor uuid, so two tokens of one linked actor collapse to a single snapshot row
    // and "one popup for two targets" becomes unanswerable (the Practice Dummy trap, HANDOFF
    // 2026-08-19). Created hidden, at AC 1 so it is always hit, and deleted in teardown.
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

    /* 1 — setting OFF: nothing changes. -------------------------------------------------- */
    await game.settings.set(MOD, 'playerRollDamage', false);
    {
      const { usageId } = await attack(one);
      const dmg = await waitDamage(usageId, 6000);
      results.push({ n: 1, name: 'OFF — auto-rolls, no popup',
        pass: !!dmg && (popupEls().length === 0),
        detail: `damage=${!!dmg} popups=${popupEls().length}` });
      await closeAllPopups();
    }

    /* 2 — setting ON: the popup opens and the dice WAIT. --------------------------------- */
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

      /* 10 — (w): the wait is a TABLE moment — flag stamped, bar on the card too. --------- */
      const offer = attackMsg?.getFlag(MOD, 'damageOffer');
      const cardBar = attackMsg ? document.querySelector(
        `[data-message-id="${attackMsg.id}"] .battleflow-damage-offer [data-bf-deadline]`) : null;
      results.push({ n: 10, name: '(w) pending offer — flag stamped, draining bar on the card',
        pass: (offer?.status === 'pending') && (offer?.window === 15)
              && ((offer?.deadline ?? 0) > Date.now()) && !!cardBar,
        detail: `flag=${JSON.stringify(offer ?? null)} cardBarDOM=${!!cardBar}` });

      /* 4 — a normal hit: NO crit badge, and the CELEBRATION title ((l), round 3). -------- */
      const html = popups[0]?.innerHTML ?? '';
      const label = popups[0]?.querySelector('button[data-action="roll"]')?.textContent?.trim() ?? '';
      const title4 = popups[0]?.querySelector('.window-title')?.textContent ?? '';
      const wasCrit = attackMsg?.rolls?.[0]?.isCritical ?? null;
      results.push({ n: 4, name: 'non-crit — no badge, plain label, "You hit!" celebrates',
        // Only meaningful when the roll genuinely was not a crit; advantage crits ~10% of the time.
        pass: wasCrit === false ? (!html.includes('Critical Hit') && /Roll Damage/i.test(label)
                && /You hit/i.test(title4)) : true,
        detail: `isCritical=${wasCrit} label="${label}" title="${title4}" badge=${html.includes('Critical Hit')}`
              + (wasCrit ? ' (rolled a crit — assertion skipped, rerun)' : '') });

      /* 4b — (hh), v1.20.0 walk 1: the "Against …" line names each target WITH its token
       * icon (law-8 tooltip = the name), so the roll popup stopped being the one volley-family
       * surface that named targets in text alone. The icon sits directly before its own
       * <strong>name</strong>, which is how it is told apart from the bfCard portrait. */
      const aimIcon = [...(popups[0]?.querySelectorAll('img[data-tooltip]') ?? [])].find(img =>
        (img.nextElementSibling?.tagName === 'STRONG')
        && (img.dataset.tooltip === img.nextElementSibling.textContent));
      results.push({ n: '4b', name: '(hh) the Against line carries the target token icon, tooltip = name',
        pass: !!aimIcon,
        detail: aimIcon ? `icon for "${aimIcon.dataset.tooltip}"` : 'no icon+name pair in the popup' });

      /* 6 — pressing the button rolls it, stamped and crit-honest. ----------------------- */
      popups[0]?.querySelector('button[data-action="roll"]')?.click();
      const dmg = await waitDamage(usageId, 8000);
      results.push({ n: 6, name: 'button pressed — rolls, stamped',
        pass: !!dmg && (dmg.getFlag('dnd5e', 'originatingMessage') === usageId)
              && ((dmg.rolls?.[0]?.isCritical ?? false) === (wasCrit ?? false)),
        detail: `damage=${!!dmg} origin=${dmg?.getFlag('dnd5e', 'originatingMessage') === usageId}`
              + ` attackCrit=${wasCrit} damageCrit=${dmg?.rolls?.[0]?.isCritical ?? null}` });

      /* 11 — (w): the roll folds the offer — the card's bar has nothing left to draw. ----- */
      await sleep(400);   // the done-write is fire-and-forget behind the roll
      const offerAfter = attackMsg?.getFlag(MOD, 'damageOffer');
      results.push({ n: 11, name: '(w) rolled — the offer flag folds to done',
        pass: offerAfter?.status === 'done',
        detail: `status=${offerAfter?.status ?? null}` });
      await closeAllPopups();
    }

    /* 5 — CRIT: the decoy proven dead, then the real lever, then the badge. ------------- */
    {
      // Bounded retry for a NON-crit start: the decoy pin is only meaningful when the roll
      // begins isCritical=false, and advantage crits ~10% of the time (flaked 2026-08-20).
      let attackMsg = null;
      for (let try9 = 0; try9 < 4; try9++) {
        ({ attackMsg } = await attack(one));
        await sleep(900);
        await closeAllPopups();   // the popup this attack raised is not the one under test
        if ((attackMsg?.rolls?.[0]?.isCritical ?? null) === false) break;
      }

      const roll = attackMsg?.rolls?.[0];
      const critBefore = roll?.isCritical ?? null;

      // (a) THE DECOY. The roll's own criticalSuccess is numeric and looks authoritative.
      const rollOpts = Object.keys(roll?.options ?? {}).join(',');
      if (roll?.options) roll.options.criticalSuccess = 1;
      const afterDecoy = roll?.isCritical ?? null;

      // (b) THE REAL LEVER: the D20 TERM's options, which is what the getter actually reads.
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
        // Only meaningful from a non-crit start; four natural crits in a row skips it (rerun).
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

    /* 3 — two targets, ONE popup. --------------------------------------------------------- */
    {
      const { usageId, attackMsg } = await attack(two);
      await sleep(1200);
      const popups = popupEls();
      const hits = attackMsg ? (attackMsg.getFlag('dnd5e', 'targets') ?? []).length : 0;
      results.push({ n: 3, name: 'two targets hit — exactly ONE popup',
        pass: (popups.length === 1) && (hits >= 2),
        detail: `targeted=${two.length} snapshot=${hits} popups=${popups.length}` });

      /* 7 — dismissing rolls IMMEDIATELY, not at the buzzer. ----------------------------- */
      await closeAllPopups();
      const dmg = await waitDamage(usageId, 5000);   // well inside the 15s window
      results.push({ n: 7, name: 'dismissed — rolls immediately, not at the buzzer',
        pass: !!dmg, detail: `damage within 5s of dismissal = ${!!dmg}` });
    }

    /* 8 — the buzzer. Waited out for real. ------------------------------------------------ */
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

    /* teardown ---------------------------------------------------------------------------- */
    await closeAllPopups();
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
    await ChatMessage.deleteDocuments([...new Set(created)].filter(id => game.messages.has(id)))
      .catch(() => {});
    if (extraTokDoc) await canvas.scene.deleteEmbeddedDocuments('Token', [extraTokDoc.id]).catch(() => {});
    if (extra) await extra.delete().catch(() => {});
    await victim.update({
      'system.attributes.ac.calc': prior.victimAC?.calc ?? 'default',
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

// ---------------------- 6. restore the table's prior settings + test chat-log cleanup
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

// ⚠ This suite keeps its OWN summary line rather than the harness reporter: "ALL PASS" and
// "N FAILURE(S)" are the strings the handoff, the notes and two undiagnosed flake reports all
// quote verbatim. A partial run is stamped so it can never be read as a battery.
const partial = plan ? `  ⚠ PARTIAL RUN — sections ${plan.join(', ')} only` : '';
for (const id of Object.keys(SECTIONS)) {
  if (plan && !plan.includes(String(id))) console.log(`  SKIP §${id} ${SECTIONS[id]}`);
}
console.log(failures ? `\n[smoke] ${failures} FAILURE(S)${partial}` : `\n[smoke] ALL PASS${partial}`);
await f.disconnect?.();
process.exit(failures ? 1 : 0);
