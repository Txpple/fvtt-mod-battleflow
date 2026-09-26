// Battle Flow Lucky smoke test — LUCKY'S ADVANTAGE HALF (2026-09-25, the Halfling walk: "we need to
// unpark the advantage on our own d20"; ruled off the prototype lucky-advantage.html, "looks good";
// initiative with no dialog ruled "After the roll"): the gate's BUY box in the system's own roll
// dialog, and the `advantage` D20 fold on an initiative rolled with no dialog.
//
// Fixtures: BF Test Halfling (Rogue 3 with the Lucky FEAT at its proficiency's Luck Points, a
// Shortsword; built by tools/fixture-suite.mjs) and BF Test Attacker (the target). Linked tokens are
// placed on the Battle Flow Test Range for the run and removed after.
//
// Harness discipline: every setting touched is restored; the Luck Points are refilled; the Poisoned
// status, the combat, the tokens and every message this run creates are deleted.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'advantage-buys.js',      // §1–§5 — the box, the tick in the net, the spend, the record, initiative's dialog
  'd20-folds.js'            // §6, §7 — the `advantage` fold on an initiative rolled with no dialog
];

const SECTIONS = {
  1: 'an attack: the dialog shows "Lucky — 1 Luck Point · N left" (the full pool) with an Advantage tick, the default Normal; the tick moves the net and the default to Advantage; pressed, the roll goes out at Advantage, a Luck Point is spent, the record names Lucky',
  2: 'a save left unticked: the box shows one point short of full; pressed Normal, nothing is spent and no record names Lucky',
  3: 'the tick beside a Disadvantage (Poisoned, a Stealth check): the net reads Normal, the default Normal; pressed, the use still goes (the rule allows it)',
  4: 'no Luck Points left: the box stays, greyed, "no Luck Points left", no tick',
  5: 'initiative\'s own dialog: the box shows; ticked and pressed, the initiative rolls at Advantage, a point spent, and the no-dialog fold stands aside (no second offer)',
  6: 'initiative with no dialog (the combat\'s own roll — the carousel\'s road): the roll offers Lucky; accepted, a second d20 is rolled and the HIGHER stands — the initiative moves, a point spent',
  7: 'the same, the second d20 lower: the first stands, the point is spent either way'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'lucky', watchdogMs: 300_000 });
announcePlan('lucky', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const suiteStart = Date.now();

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  const { ADVANTAGE_BUYS } = await import(`/modules/${MOD}/scripts/decide/registry.js`);
  if (!ADVANTAGE_BUYS?.Lucky) return { fatal: 'ADVANTAGE_BUYS is not in the loaded code — OLD code (reload the box)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'holdTimer', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'saves', 'castApply', 'concMode',
    'reminderList', 'conditionList', 'damageEitherList', 'clockRiderList', 'hitMenuList', 'd20Folds', 'd20FoldAsk'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const halfling = game.actors.getName('BF Test Halfling');
  if (!scene || !attacker || !halfling) return { fatal: 'missing fixture: scene, BF Test Attacker or BF Test Halfling — run tools/fixture-suite.mjs' };
  const lucky = () => halfling.items.find(i => (i.name === 'Lucky') && (Number(i.system?.uses?.max) > 0));
  if (!lucky()) return { fatal: 'BF Test Halfling lacks the Lucky FEAT (with Luck Points) — re-run fixture-suite' };
  const luckLeft = () => Number(lucky()?.system?.uses?.value ?? -1);
  // The pool is the fixture's proficiency (Rogue 3: 2 points) — every count reads off it, never a
  // literal (the first battery, 2026-09-26, pinned the level-5 roster Halfling's 3).
  const FULL = Number(lucky()?.system?.uses?.max ?? 0);
  const ONE_SPENT = FULL - 1;

  const created = { tokens: [] };
  let combat = null;
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const refillLuck = async () => { const l = lucky(); if (l) await l.update({ 'system.uses.spent': 0 }); };
  const dropPoisoned = async () => { if (halfling.statuses.has('poisoned')) await halfling.toggleStatusEffect('poisoned', { active: false }); };
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      const ours = /RollConfigurationDialog/.test(app.constructor?.name ?? '') || app.element?.querySelector?.('[data-bf-ticks], [data-bf-rescue-row]');
      if (ours) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    CONFIG.Dice.randomUniform = realPRNG;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      await dropPoisoned();
      await refillLuck();
      if (combat && game.combats.get(combat.id)) await combat.delete();
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
          || Object.keys(m.flags?.[MOD] ?? {}).length || m.getFlag('core', 'initiativeRoll')));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('autoDamage', 'all');
    await set('autoApply', false);
    await set('playerRollDamage', true);      // no damage chain — the d20 is the whole test
    await set('damageTimer', 0);
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('holdTimer', 0);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('masteryAsk', false);
    await set('saves', false);
    await set('castApply', false);
    await set('concMode', 'off');
    await set('reminderList', 'buy');         // the box alone (§3 adds condition)
    await set('conditionList', def('conditionList'));
    await set('damageEitherList', '');
    await set('clockRiderList', '');
    await set('hitMenuList', '');
    await set('d20Folds', 'Lucky:advantage');
    await set('d20FoldAsk', true);
    await dropPoisoned();
    await refillLuck();
    if (game.combat) await game.combat.delete();

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => t.actorLink && [attacker.id, halfling.id].includes(t.actorId)).map(t => t.id);
    if (strays.length) await scene.deleteEmbeddedDocuments('Token', strays);
    const placeToken = async (actor, x, y) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const { token: attackerToken } = await placeToken(attacker, 1400, 1700);
    const { doc: halflingDoc, token: halflingToken } = await placeToken(halfling, 1500, 1700);

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const rollDialog = () => [...foundry.applications.instances.values()]
      .find(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element) ?? null;
    const openDialog = async () => {
      const dlg = await waitFor(rollDialog, 6000);
      await waitFor(() => dlg?.element?.querySelector('[data-bf-buy]'), 3000);
      await sleep(150);
      return dlg;
    };
    const boxOf = dlg => dlg?.element?.querySelector('[data-bf-buy]') ?? null;
    const tickOf = dlg => dlg?.element?.querySelector('input[name="bf-buy"]') ?? null;
    const defaultOf = dlg => dlg?.element?.querySelector('button[data-bf-default]')?.dataset?.action ?? null;
    const netOf = dlg => dlg?.element?.querySelector('[data-bf-reminder-head] [data-bf-mode]')?.dataset?.bfMode ?? null;
    const tick = async dlg => { const t = tickOf(dlg); if (t) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); } await sleep(150); };
    const press = (dlg, mode) => { const b = dlg?.element?.querySelector(`button[data-action="${mode}"]`); b?.click(); return !!b; };
    const lastOf = type => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.type === type)).pop() ?? null;
    const weapon = halfling.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => a.type === 'attack'));
    if (!weapon) return { fatal: 'BF Test Halfling has no weapon attack' };
    const attackAct = () => halfling.items.get(weapon.id).system.activities.find(a => a.type === 'attack');
    const rescueWindow = text => [...document.querySelectorAll('.application')]
      .find(el => el.querySelector('[data-bf-rescue-row]') && (el.textContent ?? '').includes(text)) ?? null;
    const newCombat = async () => {
      if (game.combat) await game.combat.delete();
      combat = await Combat.create({ scene: scene.id, active: true });
      await combat.createEmbeddedDocuments('Combatant', [{ actorId: halfling.id, tokenId: halflingDoc.id, sceneId: scene.id }]);
      await sleep(300);
      return combat.combatants.find(c => c.actorId === halfling.id);
    };

    // ================================================== 1. an attack, ticked
    if (want(1)) {
      await refillLuck(); await closeDialogs();
      halflingToken.control({ releaseOthers: true });
      attackerToken.setTarget(true, { releaseOthers: true });
      const before = lastOf('attack')?.id ?? null;
      faces([[12, 20], [15, 20]]);
      void attackAct().rollAttack({}, {}, {});
      const dlg = await openDialog();
      const box = boxOf(dlg);
      ok('1a. the box: "Lucky — 1 Luck Point · N left" (the full pool), an Advantage tick, the default Normal',
        new RegExp(`Lucky — 1 Luck Point · ${FULL} left`).test(textOf(box)) && !!tickOf(dlg) && (defaultOf(dlg) === 'normal'),
        `box="${textOf(box).slice(0, 80)}" tick=${!!tickOf(dlg)} default=${defaultOf(dlg)}`);
      await tick(dlg);
      ok('1b. ticked: the net and the default move to Advantage', (netOf(dlg) === 'advantage') && (defaultOf(dlg) === 'advantage'),
        `net=${netOf(dlg)} default=${defaultOf(dlg)}`);
      press(dlg, 'advantage');
      const msg = await waitFor(() => { const m = lastOf('attack'); return (m && (m.id !== before)) ? m : null; }, 8000);
      await sleep(600);
      const rec = msg?.getFlag(MOD, 'reminder');
      ok('1c. pressed: the roll went out at Advantage, a Luck Point spent, the record names Lucky and the spend',
        (Number(msg?.rolls?.[0]?.options?.advantageMode) === 1) && (luckLeft() === ONE_SPENT)
          && (rec?.sources ?? []).some(s => (s.kind === 'buy') && /Lucky/.test(s.label)) && (msg?.getFlag(MOD, 'poolSpend')?.left === ONE_SPENT),
        `mode=${msg?.rolls?.[0]?.options?.advantageMode} left=${luckLeft()} rec=${JSON.stringify(rec?.sources)} spend=${JSON.stringify(msg?.getFlag(MOD, 'poolSpend'))}`);
      await closeDialogs();
    }

    // ================================================== 2. a save, left unticked
    if (want(2)) {
      await refillLuck(); await lucky()?.update({ 'system.uses.spent': 1 }); await closeDialogs();
      void halfling.rollSavingThrow({ ability: 'dex' });
      const dlg = await openDialog();
      ok('2a. the save dialog carries the box, one point short of full', new RegExp(`Lucky — 1 Luck Point · ${ONE_SPENT} left`).test(textOf(boxOf(dlg))), `box="${textOf(boxOf(dlg)).slice(0, 80)}"`);
      const before = game.messages.size;
      press(dlg, 'normal');
      await waitFor(() => game.messages.size > before, 6000);
      await sleep(500);
      const msg = game.messages.contents.at(-1);
      ok('2b. pressed Normal unticked: nothing spent, no record names Lucky', (luckLeft() === ONE_SPENT)
        && !(msg?.getFlag(MOD, 'reminder')?.sources ?? []).some(s => s.kind === 'buy') && !msg?.getFlag(MOD, 'poolSpend'),
        `left=${luckLeft()} rec=${JSON.stringify(msg?.getFlag(MOD, 'reminder'))}`);
      await closeDialogs();
    }

    // ================================================== 3. beside a Disadvantage
    if (want(3)) {
      await refillLuck(); await closeDialogs();
      await set('reminderList', 'buy, condition');
      await halfling.toggleStatusEffect('poisoned', { active: true });
      await sleep(300);
      void halfling.rollSkill({ skill: 'ste' });
      const dlg = await openDialog();
      ok('3a. Poisoned alone: the net Disadvantage', netOf(dlg) === 'disadvantage', `net=${netOf(dlg)}`);
      await tick(dlg);
      ok('3b. ticked beside it: the net and the default Normal', (netOf(dlg) === 'normal') && (defaultOf(dlg) === 'normal'),
        `net=${netOf(dlg)} default=${defaultOf(dlg)}`);
      const before = game.messages.size;
      press(dlg, 'normal');
      await waitFor(() => game.messages.size > before, 6000);
      await sleep(600);
      ok('3c. pressed Normal: the Luck Point is spent all the same', luckLeft() === ONE_SPENT, `left=${luckLeft()}`);
      await dropPoisoned();
      await set('reminderList', 'buy');
      await closeDialogs();
    }

    // ================================================== 4. none left
    if (want(4)) {
      await closeDialogs();
      await lucky()?.update({ 'system.uses.spent': Number(lucky().system.uses.max) });
      void halfling.rollAbilityCheck({ ability: 'wis' });
      const dlg = await openDialog();
      const box = boxOf(dlg);
      ok('4a. no Luck Points left: the box greyed, "no Luck Points left", no tick', !!box && /no Luck Points left/.test(textOf(box)) && !tickOf(dlg),
        `box="${textOf(box).slice(0, 90)}" tick=${!!tickOf(dlg)}`);
      await closeDialogs();
      await refillLuck();
    }

    // ================================================== 5. initiative's dialog
    if (want(5)) {
      await refillLuck(); await closeDialogs();
      const combatant = await newCombat();
      faces([[6, 20], [14, 20]]);
      void halfling.rollInitiativeDialog();
      const dlg = await openDialog();
      ok('5a. initiative\'s dialog carries the box', new RegExp(`Lucky — 1 Luck Point · ${FULL} left`).test(textOf(boxOf(dlg))), `box="${textOf(boxOf(dlg)).slice(0, 80)}"`);
      await tick(dlg);
      press(dlg, 'advantage');
      const initMsg = await waitFor(() => game.messages.contents.slice(-6).reverse().find(m => m.getFlag('core', 'initiativeRoll') && (m.timestamp >= suiteStart)) ?? null, 8000);
      await sleep(1200);
      const init = combat.combatants.get(combatant?.id)?.initiative;
      const roll = initMsg?.rolls?.[0];
      ok('5b. the initiative rolled at Advantage (14 kept), a point spent, the roll marked bought',
        (Number(roll?.options?.advantageMode) === 1) && (Number(roll?.d20?.total) === 14) && (init === roll?.total)
          && (luckLeft() === ONE_SPENT) && (roll?.options?.bfBought === 'Lucky'),
        `mode=${roll?.options?.advantageMode} d20=${roll?.d20?.total} init=${init} total=${roll?.total} left=${luckLeft()} bought=${roll?.options?.bfBought}`);
      ok('5c. the no-dialog fold stands aside — no Lucky offer on that roll', !(initMsg?.getFlag(MOD, 'd20fold')?.offers ?? []).some(o => o.kind === 'advantage'),
        `fold=${JSON.stringify(initMsg?.getFlag(MOD, 'd20fold')?.offers)}`);
      await closeDialogs();
    }

    // ================================================== 6. no dialog: the higher stands
    const noDialog = async (first, second) => {
      await refillLuck(); await closeDialogs();
      const combatant = await newCombat();
      // THIS roll's message: the fold's flag is stamped just after the message posts, so "the newest
      // with the flag" found §6's message in §7 (the first battery, 2026-09-26) — exclude the old ones.
      const seen = new Set(game.messages.contents.map(m => m.id));
      faces([[first, 20]]);
      await combat.rollInitiative([combatant.id], { updateTurn: false });
      const initMsg = await waitFor(() => game.messages.contents.slice(-6).reverse()
        .find(m => !seen.has(m.id) && m.getFlag('core', 'initiativeRoll') && m.getFlag(MOD, 'd20fold')) ?? null, 8000);
      const flag = initMsg?.getFlag(MOD, 'd20fold');
      const offered = (flag?.testKind === 'initiative') && (flag?.offers ?? []).some(o => (o.kind === 'advantage') && (o.label === 'Lucky'));
      const win = await waitFor(() => rescueWindow('Lucky'), 6000);
      faces([[second, 20]]);
      win?.querySelector('[data-bf-rescue-action="advantage"]')?.click();
      const done = await waitFor(() => { const fl = initMsg?.getFlag(MOD, 'd20fold'); return (fl?.status === 'resolved') ? fl : null; }, 10000);
      await sleep(500);
      return { offered, flag, done, base: Number(flag?.baseTotal), init: combat.combatants.get(combatant?.id)?.initiative, win: !!win };
    };
    if (want(6)) {
      const r = await noDialog(5, 15);
      ok('6a. the combat\'s own roll offers Lucky (the popup open)', r.offered && r.win,
        `offers=${JSON.stringify(r.flag?.offers?.map(o => [o.kind, o.label]))} win=${r.win}`);
      ok('6b. accepted: the second d20 (15) stands over the first (5) — the initiative moves, a point spent',
        (r.done?.outcome === 'used') && (Math.abs(r.init - (r.base + 10)) < 1e-9) && (luckLeft() === ONE_SPENT),
        `init=${r.init} want=${r.base + 10} left=${luckLeft()} folded=${r.done?.foldedTotal}`);
      await closeDialogs();
    }

    // ================================================== 7. no dialog: the first stands
    if (want(7)) {
      const r = await noDialog(15, 4);
      ok('7a. the second d20 lower (4): the first (15) stands, the point spent either way',
        r.offered && (r.done?.outcome === 'used') && (r.init === r.base) && (luckLeft() === ONE_SPENT),
        `init=${r.init} want=${r.base} left=${luckLeft()}`);
      await closeDialogs();
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'lucky', out, plan, f });
