// Battle Flow clock-rider smoke test — DAMAGE RIDERS ON THE COMBAT CLOCK (user ruling
// 2026-09-02: "should just notify the player that they are available and will be added to the
// damage. i believe crit should double those"). The Gloom Stalker's Dreadful Strike (once per
// turn, limited uses) on the BUILT ranger fixture, the Assassin's first-round strike on the BUILT
// rogue fixture (with its Advantage against a creature that has not acted, an effect-table row
// with the clock as its judge), the offer's notice, the card's line, the list as the switch.
//
// Harness discipline: every setting touched is restored; every message this run creates is
// deleted; the chits it writes are cleared; the uses it spends are refilled; the tokens it
// places are removed; its combat is deleted.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'out of combat: Dreadful Strike rides every hit — 2d6 psychic as its own part, a use spent, the card says why',
  2: 'the offer: a ticked checkbox per due rider, optional — unticked, nothing rides and nothing is spent',
  3: 'in combat: once per turn — the chit, the second hit bare, the next turn rides again',
  4: 'the uses are the switch the rules give: none left, nothing rides',
  5: 'Assassinate: round one — Advantage against a creature that has not acted, and the Rogue level on the sneak hit; round two, neither',
  6: 'the Clock Riders list is the switch: an empty list rides nothing',
  7: 'the registration FIRED (§11): preRollDamageV2 moved with a rider on it'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'clock', watchdogMs: 600_000 });
announcePlan('clock', plan, pulled);

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
  const ledger = globalThis.__bfHookLedger ?? null;
  const count = name => ledger?.[name] ?? 0;

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.clockRiderList`)) return { fatal: 'clockRiderList not registered — OLD code (F5)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'saves', 'saveTimer', 'castApply',
    'concMode', 'reminderList', 'conditionList', 'effectList', 'clockRiderList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const ranger = game.actors.getName('BF Test Ranger');
  const rogue = game.actors.getName('BF Test Rogue');
  if (!scene || !victim || !ranger || !rogue) return { fatal: 'missing fixture: scene, BF Test Victim, BF Test Ranger or BF Test Rogue — run tools/fixture-suite.mjs' };

  const created = { tokens: [] };
  const priorActor = {};
  let combat = null;
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const dread = ranger.items.find(i => i.name === 'Dread Ambusher');
  const dreadAct = () => [...(dread?.system?.activities ?? [])].find(a => a.name === 'Dreadful Strike');
  const priorSpent = dreadAct()?.uses?.spent ?? 0;
  const refill = () => dread?.update({ [`system.activities.${dreadAct().id}.uses.spent`]: 0 });
  const clearChips = async () => {
    for (const a of [victim, ranger, rogue]) {
      const chips = a.effects.filter(e => e.getFlag(MOD, 'mastery') || /^(Vexed|Sapped|Sneak Attack|Dreadful Strike)/.test(e.name)
        || ['prone', 'poisoned', 'unconscious'].some(s => e.statuses?.has?.(s)));
      // Re-filtered and tolerant: a deleted combat tidies the chits it clocked at the same moment
      // (mastery.js's sweep), and a delete naming a gone id throws.
      const live = chips.map(e => e.id).filter(id => a.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
    }
  };
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      const ours = app.element?.querySelector?.('[data-bf-reminder], [data-bf-save-demand], [data-bf-cunning]')
        || /RollConfigurationDialog/.test(app.constructor?.name ?? '') || (app.element?.innerHTML ?? '').includes('Damage — your roll');
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
      await clearChips();
      if (dread && dreadAct()) await dread.update({ [`system.activities.${dreadAct().id}.uses.spent`]: priorSpent });
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
          || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('autoDamage', 'all');
    await set('autoApply', true);
    await set('playerRollDamage', false);
    await set('damageTimer', 0);
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('masteryAsk', false);
    await set('saves', true);
    await set('saveTimer', 0);
    await set('castApply', false);
    await set('concMode', 'off');
    await set('reminderList', 'vex, sap, prone, condition, range, effect, sneak');
    // The effect table as SHIPPED — the world's stored list predates the Assassinate row (a
    // list saved at one release is a copy; the registered default is the table).
    await set('effectList', game.settings.settings.get(`${MOD}.effectList`)?.default ?? prior.effectList);
    await set('clockRiderList', prior.clockRiderList || 'Dread Ambusher, Assassinate, Dreadful Strikes, Blessed Strikes: Divine Strike, Elemental Fury: Primal Strike, Divine Fury');
    if (!dread || !dreadAct()) return { fatal: 'the ranger fixture lacks Dread Ambusher / Dreadful Strike — re-run fixture-suite' };
    await refill();

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => [victim.id, ranger.id, rogue.id].includes(t.actorId)).map(t => t.id);
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
    const { doc: victimDoc, token: victimToken } = await placeToken(victim, 1400, 1700);
    const { doc: rangerDoc, token: rangerToken } = await placeToken(ranger, 1500, 1700);
    const { doc: rogueDoc, token: rogueToken } = await placeToken(rogue, 1300, 1700);

    priorActor[victim.id] = {
      'system.attributes.ac.calc': victim.system._source.attributes.ac.calc,
      'system.attributes.ac.flat': victim.system._source.attributes.ac.flat,
      'system.attributes.hp.value': victim.system._source.attributes.hp.value,
      'system.attributes.hp.max': victim.system._source.attributes.hp.max
    };
    await victim.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1,
      'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });
    const healFull = async () => victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const face = (n, faces = 20) => { CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces); };
    const target = token => token.setTarget(true, { releaseOthers: true });
    const weaponOf = (actor, name) => actor.items.find(i => (i.type === 'weapon') && (i.name === name));
    const attackOf = item => item.system.activities.find(a => a.type === 'attack');
    const damageFor = originId => game.messages.contents.find(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
      && (m.getFlag('dnd5e', 'originatingMessage') === originId));
    const offerEl = () => [...foundry.applications.instances.values()].map(a => a.element)
      .find(el => (el?.innerHTML ?? '').includes('Damage — your roll')) ?? null;
    const rollDialog = () => [...foundry.applications.instances.values()]
      .find(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element) ?? null;
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const lastAttack = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag('dnd5e', 'roll.type') === 'attack')).pop() ?? null;
    const waitAttackAfter = async id => waitFor(() => { const m = lastAttack(); return (m && (m.id !== id)) ? m : null; }, 8000);
    /** A programmatic hit (no dialog): use + rollAttack configure:false, forced 19; returns the damage message with its receipt. */
    const swing = async (actor, token, item) => {
      await healFull();
      token.control({ releaseOthers: true });
      target(victimToken);
      await sleep(80);
      face(19);
      const act = attackOf(item);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': results.message.id } } : {});
      const attackMsg = rolls?.[0]?.parent ?? null;
      const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
      const offer = await waitFor(offerEl, 1500);
      offer?.querySelector('button[data-action="roll"]')?.click();
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      return { attackMsg, dmg, originId };
    };
    const riderPart = (dmg, re) => (dmg?.rolls ?? []).find(r => re.test(r.formula));
    const cardText = id => textOf(document.querySelector(`.message[data-message-id="${id}"]`));
    const startCombat = async (...entries) => {
      if (game.combat) await game.combat.delete();
      combat = await Combat.create({ scene: scene.id });
      await combat.createEmbeddedDocuments('Combatant', entries.map(([actor, doc, initiative]) =>
        ({ actorId: actor.id, tokenId: doc.id, sceneId: scene.id, initiative })));
      await combat.startCombat();
      await sleep(500);
    };
    const longsword = weaponOf(ranger, 'Longsword');
    const rapier = weaponOf(rogue, 'Rapier');
    if (!longsword || !rapier) return { fatal: 'fixture weapons missing (Longsword on the ranger, Rapier on the rogue)' };

    // ================================================== 1. out of combat
    if (want(1)) {
      await clearChips();
      await refill();
      const spentBefore = dreadAct().uses.spent ?? 0;
      const { dmg } = await swing(ranger, rangerToken, longsword);
      const part = riderPart(dmg, /^2d6$/);
      const cr = dmg?.getFlag(MOD, 'clockRiders');
      ok('1a. Dreadful Strike rides the longsword\'s damage as its own part — 2d6 psychic, read off the feature\'s own activity (the Gloom Stalker\'s scale)',
        !!part && (part.options?.type === 'psychic') && (cr?.riders?.[0]?.key === 'dread-ambusher') && (cr?.riders?.[0]?.formula === '2d6'),
        `formulas=[${(dmg?.rolls ?? []).map(r => r.formula + ':' + r.options?.type).join(' | ')}] flag=${JSON.stringify(cr?.riders)}`);
      ok('1b. out of combat every hit rides (no turn to be once-per), and no chit is written — the offer opened under auto damage because a rider was due',
        /out of combat/.test(cr?.riders?.[0]?.why ?? '') && !ranger.effects.some(e => e.getFlag(MOD, 'mastery') === 'rider'),
        `why="${cr?.riders?.[0]?.why}" chit=${ranger.effects.some(e => e.getFlag(MOD, 'mastery') === 'rider')}`);
      const spentAfter = await waitFor(() => { const s = dreadAct().uses.spent ?? 0; return (s > spentBefore) ? s : null; }, 5000);
      ok('1c. a use is spent on the activity, and the record says how many are left',
        (spentAfter === spentBefore + 1) && (cr?.riders?.[0]?.usesLeft === (dreadAct().uses.value ?? 0)),
        `spent ${spentBefore}→${dreadAct().uses.spent} left=${cr?.riders?.[0]?.usesLeft} value=${dreadAct().uses.value}`);
      const text = await waitFor(() => { const t = cardText(dmg?.id); return /rode this roll/.test(t) ? t : null; }, 4000);
      ok('1d. the damage card says what rode and why (R5)', /Dreadful Strike — 2d6 psychic rode this roll/.test(text ?? '') && /out of combat/.test(text ?? ''), (text ?? '').slice(0, 200));
      const receipt = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid);
      const total = (dmg?.rolls ?? []).reduce((n, r) => n + (r.total ?? 0), 0);
      ok('1e. one roll, one receipt — the victim took the weapon and the rider together', !!receipt && (receipt.taken === total), `taken=${receipt?.taken} total=${total}`);
    }

    // ================================================== 2. the offer's notice
    if (want(2)) {
      await clearChips();
      await refill();
      await set('playerRollDamage', true);
      await healFull();
      rangerToken.control({ releaseOthers: true });
      target(victimToken);
      await sleep(80);
      face(19);
      const act = attackOf(longsword);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': results.message.id } } : {});
      const attackMsg = rolls?.[0]?.parent ?? null;
      const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
      const offer = await waitFor(offerEl, 6000);
      const text = textOf(offer);
      const box = offer?.querySelector('input[name="bf-rider"][value="dread-ambusher"]');
      ok('2a. the damage offer carries Dreadful Strike as a TICKED checkbox — the dice, the type, the uses left after, the rule folded (user: "make like sneak attack")',
        !!box && box.checked && /Dreadful Strike — 2d6 psychic/.test(text) && /use[s]? left after/.test(text)
          && !!offer.querySelector('[data-bf-rider-row="dread-ambusher"] details[data-bf-rule]') && !offer.querySelector('input[name="bf-cunning"]'),
        `box=${!!box} checked=${box?.checked} text="${text.slice(0, 200)}"`);
      offer?.querySelector('button[data-action="roll"]')?.click();
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      ok('2b. …ticked, it rides', !!riderPart(dmg, /^2d6$/) && (attackMsg?.getFlag(MOD, 'clockPick')?.join() === 'dread-ambusher'),
        `formulas=[${(dmg?.rolls ?? []).map(r => r.formula).join(' | ')}] pick=${JSON.stringify(attackMsg?.getFlag(MOD, 'clockPick'))}`);
      // 2c — UNTICKED: nothing rides, and nothing is spent (the use stays, no chit).
      await refill();
      await healFull();
      const spent2 = dreadAct().uses.spent ?? 0;
      const results2 = await act.use({ subsequentActions: false }, { configure: false }, {});
      face(19);
      const rolls2 = await act.rollAttack({}, { configure: false }, results2?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': results2.message.id } } : {});
      const attackMsg2 = rolls2?.[0]?.parent ?? null;
      const originId2 = attackMsg2?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg2?.id;
      const offer2 = await waitFor(offerEl, 6000);
      const box2 = offer2?.querySelector('input[name="bf-rider"][value="dread-ambusher"]');
      box2?.click();
      await sleep(50);
      offer2?.querySelector('button[data-action="roll"]')?.click();
      const dmg2 = await waitFor(() => { const d = damageFor(originId2); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      await sleep(400);
      ok('2c. unticked: the rider is declined — nothing rides, no use spent, no line on the card',
        !!dmg2 && !riderPart(dmg2, /^2d6$/) && !dmg2.getFlag(MOD, 'clockRiders') && ((dreadAct().uses.spent ?? 0) === spent2)
          && (attackMsg2?.getFlag(MOD, 'clockPick')?.length === 0),
        `formulas=[${(dmg2?.rolls ?? []).map(r => r.formula).join(' | ')}] spent=${spent2}→${dreadAct().uses.spent} pick=${JSON.stringify(attackMsg2?.getFlag(MOD, 'clockPick'))}`);
      await set('playerRollDamage', false);
    }

    // ================================================== 3. once per turn, in combat
    if (want(3)) {
      await clearChips();
      await refill();
      await startCombat([ranger, rangerDoc, 30], [victim, victimDoc, 20]);
      const { dmg: d1 } = await swing(ranger, rangerToken, longsword);
      const chit = await waitFor(() => ranger.effects.find(e => (e.getFlag(MOD, 'mastery') === 'rider') && (e.getFlag(MOD, 'riderKey') === 'dread-ambusher')), 6000);
      ok('3a. the first hit of the turn rides and writes the once-per-turn chit, stamped with the turn in progress',
        !!riderPart(d1, /^2d6$/) && !!chit && (chit.start?.round === combat.round) && (chit.start?.turn === combat.turn),
        `rode=${!!riderPart(d1, /^2d6$/)} chit=${chit?.name} start=${JSON.stringify(chit?.start ? { round: chit.start.round, turn: chit.start.turn } : null)}`);
      await refill();
      const { dmg: d2 } = await swing(ranger, rangerToken, longsword);
      ok('3b. the second hit this turn rides nothing — the chit stands',
        !!d2 && !riderPart(d2, /^2d6$/) && !d2.getFlag(MOD, 'clockRiders'),
        `formulas=[${(d2?.rolls ?? []).map(r => r.formula).join(' | ')}] flag=${!!d2?.getFlag(MOD, 'clockRiders')}`);
      await combat.nextTurn(); await sleep(600);
      await combat.nextTurn(); await sleep(600);
      await refill();
      const { dmg: d3 } = await swing(ranger, rangerToken, longsword);
      ok('3c. the next turn rides again — the chit died with the turn it was written in',
        !!riderPart(d3, /^2d6$/) && (combat.round === 2) && /once this turn/.test(d3?.getFlag(MOD, 'clockRiders')?.riders?.[0]?.why ?? ''),
        `rode=${!!riderPart(d3, /^2d6$/)} round=${combat.round} why="${d3?.getFlag(MOD, 'clockRiders')?.riders?.[0]?.why}"`);
      await combat.delete(); combat = null;
      await clearChips();
    }

    // ================================================== 4. the uses
    if (want(4)) {
      await clearChips();
      const max = Number(dreadAct().uses.max) || 1;
      await dread.update({ [`system.activities.${dreadAct().id}.uses.spent`]: max });
      const { dmg } = await swing(ranger, rangerToken, longsword);
      ok('4a. with no uses left nothing rides, and nothing is spent below zero',
        !!dmg && !riderPart(dmg, /^2d6$/) && !dmg.getFlag(MOD, 'clockRiders') && ((dreadAct().uses.spent ?? 0) === max),
        `formulas=[${(dmg?.rolls ?? []).map(r => r.formula).join(' | ')}] spent=${dreadAct().uses.spent}/${max}`);
      await refill();
    }

    // ================================================== 5. Assassinate
    if (want(5)) {
      await clearChips();
      await startCombat([rogue, rogueDoc, 30], [victim, victimDoc, 20]);
      // The GATE: Advantage against a creature that has not taken a turn — the effect table's
      // clock row — so the roll nets Advantage and the Sneak Attack box ticks itself.
      await healFull();
      rogueToken.control({ releaseOthers: true });
      target(victimToken);
      await sleep(80);
      const act = attackOf(rapier);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const before5 = lastAttack()?.id ?? null;
      face(19);
      void act.rollAttack({}, {}, usageId ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
      const dialog = await waitFor(rollDialog, 6000);
      await waitFor(() => dialog?.element?.querySelector('[data-bf-reminder]'), 2500);
      const section = textOf(dialog?.element?.querySelector('[data-bf-reminder]'));
      const ticked = !!dialog?.element?.querySelector('input[name="bf-sneak"]')?.checked;
      ok('5a. round one, the victim has not acted: the gate lists Assassinate as Advantage (the clock as the judge) and the Sneak Attack box ticks itself',
        /Assassinate/.test(section) && /Net Advantage/.test(section) && ticked,
        `ticked=${ticked} section="${section.slice(0, 200)}"`);
      dialog?.element?.querySelector('button[data-action="advantage"]')?.click();
      const attackMsg = await waitAttackAfter(before5);
      const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
      const offer = await waitFor(offerEl, 6000);
      const offerText = textOf(offer);
      offer?.querySelector('button[data-action="roll"]')?.click();
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      const level = rogue.classes?.rogue?.system?.levels ?? 14;
      const part = riderPart(dmg, new RegExp(`^${level}$`));
      const cr = dmg?.getFlag(MOD, 'clockRiders');
      ok('5b. the sneak hit on round one carries the Rogue level as extra damage of the weapon\'s type — said on the offer, folded in the roll, the sneak dice beside it',
        !!part && (part.options?.type === 'piercing') && (cr?.riders?.some(r => r.key === 'assassinate')) && /Assassinate/.test(offerText)
          && !!riderPart(dmg, /^7d6$/),
        `formulas=[${(dmg?.rolls ?? []).map(r => r.formula + ':' + r.options?.type).join(' | ')}] riders=${JSON.stringify(cr?.riders?.map(r => r.key))} offer="${offerText.slice(0, 160)}"`);
      await combat.nextTurn(); await sleep(600);   // the victim acts
      await combat.nextTurn(); await sleep(600);   // round 2, the rogue
      await clearChips();
      await healFull();
      target(victimToken);
      await sleep(80);
      const results2 = await act.use({ subsequentActions: false }, { configure: false }, {});
      const before5b = lastAttack()?.id ?? null;
      face(19);
      void act.rollAttack({}, {}, results2?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': results2.message.id } } : {});
      const dialog2 = await waitFor(rollDialog, 6000);
      await waitFor(() => dialog2?.element?.querySelector('[data-bf-reminder]'), 2500);
      const section2 = textOf(dialog2?.element?.querySelector('[data-bf-reminder]'));
      const tick2 = dialog2?.element?.querySelector('input[name="bf-sneak"]');
      if (tick2 && !tick2.checked) tick2.click();
      dialog2?.element?.querySelector('button[data-action="advantage"]')?.click();
      const attackMsg2 = await waitAttackAfter(before5b);
      const originId2 = attackMsg2?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg2?.id;
      (await waitFor(offerEl, 6000))?.querySelector('button[data-action="roll"]')?.click();
      const dmg2 = await waitFor(() => { const d = damageFor(originId2); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      ok('5c. round two: no Assassinate source on the gate, and no level rides the sneak hit',
        !/Assassinate/.test(section2) && !!dmg2 && !riderPart(dmg2, new RegExp(`^${level}$`)) && !(dmg2.getFlag(MOD, 'clockRiders')?.riders?.some(r => r.key === 'assassinate')),
        `round=${combat.round} section="${section2.slice(0, 120)}" formulas=[${(dmg2?.rolls ?? []).map(r => r.formula).join(' | ')}]`);
      await combat.delete(); combat = null;
      await clearChips();
    }

    // ================================================== 6. the list is the switch
    if (want(6)) {
      await clearChips();
      await refill();
      await set('clockRiderList', '');
      const { dmg } = await swing(ranger, rangerToken, longsword);
      ok('6a. an empty Clock Riders list rides nothing — the feature stays the table\'s by hand',
        !!dmg && !riderPart(dmg, /^2d6$/) && !dmg.getFlag(MOD, 'clockRiders'),
        `formulas=[${(dmg?.rolls ?? []).map(r => r.formula).join(' | ')}]`);
      await set('clockRiderList', prior.clockRiderList);
    }

    // ================================================== 7. FIRED
    if (want(7)) {
      ok('7a. dnd5e.preRollDamageV2 fired (the rider\'s hook)', count('dnd5e.preRollDamageV2') > 0, `count=${count('dnd5e.preRollDamageV2')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'clock', out, plan, f });
