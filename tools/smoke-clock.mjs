// Clock-rider smoke suite: damage riders on the combat clock, offered by a notice and doubled on a
// crit. Dreadful Strike (once per turn, limited uses) on the ranger fixture, Assassinate on the
// rogue fixture (Advantage against a creature that has not acted), the Goliath's boons, the
// on-hit feat riders; the card's line and the list as the switch. Everything written is restored.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'clock-riders.js',        // Dreadful Strike and Assassinate on the combat clock; §8-9 the Goliath's boons
  'sneak.js',               // §5 — the sneak hit Assassinate rides
  'reminders.js'            // §5 — Advantage against a creature that has not acted (the effect table)
];

const SECTIONS = {
  1: 'out of combat: Dreadful Strike rides every hit — 2d6 psychic as its own part, a use spent, the card says why',
  2: 'the offer: a ticked checkbox per due rider, optional — unticked, nothing rides and nothing is spent',
  3: 'in combat: once per turn — the chit, the second hit bare, the next turn rides again',
  4: 'the uses are the switch the rules give: none left, nothing rides',
  5: 'Assassinate: round one — Advantage against a creature that has not acted, and the Rogue level on the sneak hit; round two, neither',
  6: 'the Clock Riders list is the switch: an empty list rides nothing',
  7: 'the registration FIRED (§11): preRollDamage moved with a rider on it',
  8: 'Fire\'s Burn (Slice A, 2026-09-24 — `when: "any"`, uses on the ITEM): the Goliath\'s hit offers it ticked, 1d10 FIRE rides, the item\'s own use is spent and recorded; no uses left, not offered',
  9: 'Frost\'s Chill (`effects` + `clock` on a rider): 1d6 cold rides, and "Chilled" lands on the hit clocked to the start of the attacker\'s next turn, receipted on the damage card',
  10: 'the PHB feats, group 3 (2026-09-26): Slasher — a Longsword hit lands "Hamstrung" (speed −10, no Disadvantage), a crit lands "Slashed" too; Crusher — a Mace crit lands "Crushed", a plain hit nothing; Piercer — a Rapier crit rolls ONE more die than the crit\'s double'
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
  // Every moment published during the run (the gate publishes from the record landing).
  const moments = [];
  const momentHookId = Hooks.on('battleflow.moment', p => moments.push(p));
  const momentsOf = (event, since = 0) => moments.filter(p => (p.event === event) && (p.at >= since));
  const plain = p => { try { return JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))); } catch { return false; } };
  const suiteStart = Date.now();
  const ledger = globalThis.__bfHookLedger ?? null;
  const count = name => ledger?.[name] ?? 0;

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.decisionTimer`)) return { fatal: 'decisionTimer not registered — OLD code (F5)' };

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
      const chips = a.effects.filter(e => e.getFlag(MOD, 'mastery') || /^(Vexed|Sapped|Sneak Attack|Dreadful Strike|Chilled|Hamstrung|Slashed|Crushed)/.test(e.name)
        || ['prone', 'poisoned', 'unconscious'].some(s => e.statuses?.has?.(s)));
      // Re-filtered: a deleted combat's sweep may have taken them, and deleting a gone id throws.
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
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
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
    // The effect table as SHIPPED: a world's stored list is a copy and may lack the Assassinate row.
    await set('effectList', game.settings.settings.get(`${MOD}.effectList`)?.default ?? prior.effectList);
    await set('clockRiderList', prior.clockRiderList || 'Dread Ambusher, Assassinate, Dreadful Strikes, Blessed Strikes: Divine Strike, Elemental Fury: Primal Strike, Divine Fury');
    if (!dread || !dreadAct()) return { fatal: 'the ranger fixture lacks Dread Ambusher / Dreadful Strike — re-run fixture-suite' };
    await refill();

    // ---- fixtures
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
      'system.attributes.ac.override': victim.system._source.attributes.ac.override ?? null,
      'system.attributes.hp.value': victim.system._source.attributes.hp.value,
      'system.attributes.hp.max': victim.system._source.attributes.hp.max
    };
    await victim.update({ 'system.attributes.ac.override': 1,
      'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });
    const healFull = async () => victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });

    // ---- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const face = (n, faces = 20) => { CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces); };
    const target = token => token.setTarget(true, { releaseOthers: true });
    const weaponOf = (actor, name) => actor.items.find(i => (i.type === 'weapon') && (i.name === name));
    const attackOf = item => item.system.activities.find(a => a.type === 'attack');
    const damageFor = originId => game.messages.contents.find(m => (m.type === 'damage')
      && (m._source.system?.origin === originId));
    const offerEl = () => [...foundry.applications.instances.values()].map(a => a.element)
      .find(el => (el?.innerHTML ?? '').includes('Damage — your roll')) ?? null;
    const rollDialog = () => [...foundry.applications.instances.values()]
      .find(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element) ?? null;
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const lastAttack = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.type === 'attack')).pop() ?? null;
    const waitAttackAfter = async id => waitFor(() => { const m = lastAttack(); return (m && (m.id !== id)) ? m : null; }, 8000);
    /** A programmatic hit (no dialog): use + rollAttack configure:false, forced 19; returns the damage message with its receipt. */
    const swing = async (_actor, token, item) => {
      await healFull();
      token.control({ releaseOthers: true });
      target(victimToken);
      await sleep(80);
      face(19);
      const act = attackOf(item);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'system.origin': results.message.id } } : {});
      const attackMsg = rolls?.[0]?.parent ?? null;
      const originId = attackMsg?._source.system?.origin ?? attackMsg?.id;
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

    // ---- 1. out of combat
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
      // The poolSpend record rides the damage message from birth; the flash and card line read it
      // (they draw for player-owned actors only).
      const ps = [].concat(dmg?.getFlag(MOD, 'poolSpend') ?? []);
      ok('1x. the spend is recorded as every other pool spend is - Dreadful Strike, 1 spent, the uses left and the max, born on the damage message', ps.length === 1 && /Dreadful Strike/.test(ps[0].pool) && ps[0].spent === 1 && ps[0].max > 0 && ps[0].left === (dreadAct().uses.value ?? 0) && ps[0].actorUuid === ranger.uuid, JSON.stringify(ps));
      // The clockRiders record publishes `rider` through the gate (decide/moments.js), the poolSpend
      // record `spend`. The item is the FEATURE (Dread Ambusher).
      const rev = momentsOf('rider').filter(p => p.messageId === dmg?.id);
      const sev = momentsOf('spend').filter(p => p.messageId === dmg?.id);
      ok('1y. the resolve was PUBLISHED through the gate: battleflow.moment "rider" (kind clockRiders, marker dread-ambusher) — the ranger, Dreadful Strike on Dread Ambusher, the attack, the victim as a hit target, the formula, a momentId — and "spend" (kind poolSpend) beside it; once each, plain and frozen',
        (rev.length === 1) && (sev.length === 1) && (rev[0].kind === 'clockRiders') && (rev[0].marker === 'dread-ambusher') && (rev[0].actorUuid === ranger.uuid)
          && (rev[0].ability === 'Dreadful Strike') && (rev[0].itemName === 'Dread Ambusher') && (rev[0].attackId === cr?.attackId) && (rev[0].targets?.[0]?.actorUuid === victim.uuid) && (rev[0].targets?.[0]?.hit === true)
          && (rev[0].details?.formula === '2d6') && (rev[0].momentId === `${dmg?.id}|clockRiders|dread-ambusher`) && (sev[0].kind === 'poolSpend') && /Dreadful Strike/.test(sev[0].spend?.pool ?? '')
          && Object.isFrozen(rev[0]) && plain(rev[0]) && plain(sev[0]),
        `rider=${JSON.stringify(rev[0])} spend=${JSON.stringify(sev[0])}`);
      const receipt = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid);
      const total = (dmg?.rolls ?? []).reduce((n, r) => n + (r.total ?? 0), 0);
      ok('1e. one roll, one receipt — the victim took the weapon and the rider together', !!receipt && (receipt.taken === total), `taken=${receipt?.taken} total=${total}`);
    }

    // ---- 2. the offer's notice
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
      const rolls = await act.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'system.origin': results.message.id } } : {});
      const attackMsg = rolls?.[0]?.parent ?? null;
      const originId = attackMsg?._source.system?.origin ?? attackMsg?.id;
      const offer = await waitFor(offerEl, 6000);
      const text = textOf(offer);
      const box = offer?.querySelector('input[name="bf-rider"][value="dread-ambusher"]');
      ok('2a. the damage offer carries Dreadful Strike as a TICKED checkbox — the dice, the type, the uses left after, the rule folded (user: "make like sneak attack")',
        !!box && box.checked && /Dreadful Strike — 2d6 psychic/.test(text) && /use[s]? left after/.test(text)
          && !!offer.querySelector('[data-bf-rider-row="dread-ambusher"] details[data-bf-rule-fold]') && !offer.querySelector('input[name="bf-cunning"]'),
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
      const rolls2 = await act.rollAttack({}, { configure: false }, results2?.message?.id ? { data: { 'system.origin': results2.message.id } } : {});
      const attackMsg2 = rolls2?.[0]?.parent ?? null;
      const originId2 = attackMsg2?._source.system?.origin ?? attackMsg2?.id;
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

    // ---- 3. once per turn, in combat
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

    // ---- 4. the uses
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

    // ---- 5. Assassinate
    if (want(5)) {
      await clearChips();
      await startCombat([rogue, rogueDoc, 30], [victim, victimDoc, 20]);
      // The effect table's clock row: Advantage against a creature that has not acted, so the
      // Sneak Attack box ticks itself.
      await healFull();
      rogueToken.control({ releaseOthers: true });
      target(victimToken);
      await sleep(80);
      const act = attackOf(rapier);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const before5 = lastAttack()?.id ?? null;
      face(19);
      void act.rollAttack({}, {}, usageId ? { data: { 'system.origin': usageId } } : {});
      const dialog = await waitFor(rollDialog, 6000);
      await waitFor(() => dialog?.element?.querySelector('[data-bf-reminder]'), 2500);
      const section = textOf(dialog?.element?.querySelector('[data-bf-reminder]'));
      const ticked = !!dialog?.element?.querySelector('input[name="bf-sneak"]')?.checked;
      ok('5a. round one, the victim has not acted: the gate lists Assassinate as Advantage (the clock as the judge) and the Sneak Attack box ticks itself',
        /Assassinate/.test(section) && /Net Advantage/.test(section) && ticked,
        `ticked=${ticked} section="${section.slice(0, 200)}"`);
      dialog?.element?.querySelector('button[data-action="advantage"]')?.click();
      const attackMsg = await waitAttackAfter(before5);
      const originId = attackMsg?._source.system?.origin ?? attackMsg?.id;
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
      void act.rollAttack({}, {}, results2?.message?.id ? { data: { 'system.origin': results2.message.id } } : {});
      const dialog2 = await waitFor(rollDialog, 6000);
      await waitFor(() => dialog2?.element?.querySelector('[data-bf-reminder]'), 2500);
      const section2 = textOf(dialog2?.element?.querySelector('[data-bf-reminder]'));
      const tick2 = dialog2?.element?.querySelector('input[name="bf-sneak"]');
      if (tick2 && !tick2.checked) tick2.click();
      dialog2?.element?.querySelector('button[data-action="advantage"]')?.click();
      const attackMsg2 = await waitAttackAfter(before5b);
      const originId2 = attackMsg2?._source.system?.origin ?? attackMsg2?.id;
      (await waitFor(offerEl, 6000))?.querySelector('button[data-action="roll"]')?.click();
      const dmg2 = await waitFor(() => { const d = damageFor(originId2); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      ok('5c. round two: no Assassinate source on the gate, and no level rides the sneak hit',
        !/Assassinate/.test(section2) && !!dmg2 && !riderPart(dmg2, new RegExp(`^${level}$`)) && !(dmg2.getFlag(MOD, 'clockRiders')?.riders?.some(r => r.key === 'assassinate')),
        `round=${combat.round} section="${section2.slice(0, 120)}" formulas=[${(dmg2?.rolls ?? []).map(r => r.formula).join(' | ')}]`);
      await combat.delete(); combat = null;
      await clearChips();
    }

    // ---- 6. RETIRED: the Clock Riders list is gone (the table is the only list; every row rides).

    // ---- 7. FIRED
    // ---- 8-9. the Goliath's boons: clock riders (one boon, use it or not), uses on the ITEM, due on any hit
    if (want(8) || want(9)) {
      const goliath = game.actors.getName('BF Test Goliath');
      const axe = goliath?.items.find(i => (i.type === 'weapon') && (i.name === 'Greataxe'));
      const origins = game.packs.get('dnd-players-handbook.origins');
      if (!goliath || !axe || !origins) {
        ok('8. the BF Test Goliath fixture with a Greataxe and the PHB origins pack (run tools/fixture-suite.mjs)', false, `goliath=${!!goliath} axe=${!!axe} origins=${!!origins}`);
      } else {
        const added = [];
        const boon = n => goliath.items.find(i => (i.type === 'feat') && (i.name === n));
        const priorBoon = {};
        try {
          for (const n of ["Fire's Burn", "Frost's Chill"]) {
            if (boon(n)) continue;
            const idx = await origins.getIndex();
            const hit = idx.find(e => e.name === n);
            if (!hit) { log.push(`⚠ ${n} not in the origins pack`); continue; }
            const doc = await origins.getDocument(hit._id);
            const data = doc.toObject(); delete data._id;
            foundry.utils.setProperty(data, '_stats.compendiumSource', doc.uuid);
            added.push(...(await goliath.createEmbeddedDocuments('Item', [data])).map(d => d.id));
          }
          for (const n of ["Fire's Burn", "Frost's Chill"]) priorBoon[n] = boon(n)?.system._source.uses?.spent ?? 0;
          const usesOf = n => Number(boon(n)?.system.uses?.value ?? -1);
          const { token: goliathToken } = await placeToken(goliath, 1500, 1600);

          if (want(8)) {
            await clearChips();
            await set('clockRiderList', "Fire's Burn");
            await boon("Fire's Burn")?.update({ 'system.uses.spent': 0 });
            // Every row rides now (no list to narrow): Frost's Chill spent out, so Fire's Burn rides alone.
            await boon("Frost's Chill")?.update({ 'system.uses.spent': Number(boon("Frost's Chill")?.system.uses?.max ?? 3) });
            const before = usesOf("Fire's Burn");
            const { dmg } = await swing(goliath, goliathToken, axe);
            const part = riderPart(dmg, /^1d10$/);
            const cr = dmg?.getFlag(MOD, 'clockRiders');
            ok('8a. Fire\'s Burn rides the greataxe\'s damage as its own part — 1d10 FIRE, due on any hit',
              !!part && (part.options?.type === 'fire') && (cr?.riders?.[0]?.key === 'fires-burn') && /any hit/.test(cr?.riders?.[0]?.why ?? ''),
              `formulas=[${(dmg?.rolls ?? []).map(r => r.formula + ':' + r.options?.type).join(' | ')}] flag=${JSON.stringify(cr?.riders)}`);
            const after = await waitFor(() => (usesOf("Fire's Burn") < before) ? usesOf("Fire's Burn") : null, 5000);
            const ps = [].concat(dmg?.getFlag(MOD, 'poolSpend') ?? []);
            ok('8b. the ITEM\'s own use is spent (the activity carries none), and the uniform spend names it',
              (after === before - 1) && (cr?.riders?.[0]?.usesLeft === before - 1) && (ps.length === 1) && (ps[0].pool === "Fire's Burn") && (ps[0].left === before - 1),
              `uses ${before}→${usesOf("Fire's Burn")} record=${cr?.riders?.[0]?.usesLeft} spend=${JSON.stringify(ps)}`);
            const text = await waitFor(() => { const t = cardText(dmg?.id); return /rode this roll/.test(t) ? t : null; }, 4000);
            ok('8c. the card says it: "Fire\'s Burn — 1d10 fire rode this roll"', /Fire's Burn — 1d10 fire rode this roll/.test(text ?? ''), (text ?? '').slice(0, 200));
            // No uses left: not offered, nothing rides.
            await boon("Fire's Burn")?.update({ 'system.uses.spent': Number(boon("Fire's Burn")?.system.uses?.max ?? 3) });
            const { dmg: bare } = await swing(goliath, goliathToken, axe);
            ok('8d. no uses left: nothing rides', !!bare && !riderPart(bare, /^1d10$/) && !bare.getFlag(MOD, 'clockRiders'),
              `formulas=[${(bare?.rolls ?? []).map(r => r.formula).join(' | ')}]`);
          }

          if (want(9)) {
            await clearChips();
            await set('clockRiderList', "Frost's Chill");
            await boon("Frost's Chill")?.update({ 'system.uses.spent': 0 });
            // Every row rides now: Fire's Burn spent out, so Frost's Chill rides alone.
            await boon("Fire's Burn")?.update({ 'system.uses.spent': Number(boon("Fire's Burn")?.system.uses?.max ?? 3) });
            const { dmg } = await swing(goliath, goliathToken, axe);
            const part = riderPart(dmg, /^1d6$/);
            ok('9a. Frost\'s Chill rides — 1d6 COLD', !!part && (part.options?.type === 'cold'),
              `formulas=[${(dmg?.rolls ?? []).map(r => r.formula + ':' + r.options?.type).join(' | ')}]`);
            const er = await waitFor(() => game.messages.get(dmg?.id)?.getFlag(MOD, 'effectReceipt')?.targets?.find(t => (t.uuid === victim.uuid) && t.effects?.length), 12000);
            const chilled = victim.effects.find(e => e.name === 'Chilled');
            const dur = chilled?._source?.duration ?? null;
            ok('9b. "Chilled" lands on the victim, receipted on the damage card, clocked to one round ending at a turn START (the pack ships none)',
              !!chilled && !!er?.effects?.some(e => /Chilled/.test(e.name)) && /turnStart/.test(JSON.stringify(dur)) && /"value":1\b/.test(JSON.stringify(dur))
                && !!game.messages.get(dmg?.id)?.getFlag(MOD, 'clockRiders')?.effectsApplied,
              `chilled=${!!chilled} duration=${JSON.stringify(dur)} receipt=${JSON.stringify(er?.effects?.map(e => e.name))}`);
          }
        } finally {
          await clearChips();
          for (const [n, s] of Object.entries(priorBoon)) await boon(n)?.update({ 'system.uses.spent': s }).catch(() => {});
          const live = added.filter(id => goliath.items.get(id));
          if (live.length) await goliath.deleteEmbeddedDocuments('Item', live).catch(() => {});
          await set('clockRiderList', prior.clockRiderList);
        }
      }
    }

    // ---- 10. the on-hit riders
    if (want(10)) {
      const phb = async (name, type) => {
        for (const pack of game.packs.filter(pk => (pk.metadata.packageName === 'dnd-players-handbook') && (pk.documentName === 'Item'))) {
          const hit = (await pack.getIndex({ fields: ['type'] })).find(e => (e.name === name) && (e.type === type));
          if (hit) return pack.getDocument(hit._id);
        }
        return null;
      };
      const lent = [];
      const lend = async (actor, name, type) => {
        const src = await phb(name, type);
        if (!src) throw new Error(`the PHB ships no ${type} "${name}"`);
        const [made] = await actor.createEmbeddedDocuments('Item', [src.toObject()]);
        lent.push([actor, made.id]);
        return made;
      };
      const priorEither = game.settings.get(MOD, 'damageEitherList');
      /** A hit with the d20 forced: 19 plain, 20 a Critical Hit. */
      const swingAt = async (_actor, token, item, d20) => {
        await healFull();
        token.control({ releaseOthers: true });
        target(victimToken);
        await sleep(80);
        face(d20);
        const act = attackOf(item);
        const results = await act.use({ subsequentActions: false }, { configure: false }, {});
        const rolls = await act.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'system.origin': results.message.id } } : {});
        CONFIG.Dice.randomUniform = realPRNG;
        const attackMsg = rolls?.[0]?.parent ?? null;
        const originId = attackMsg?._source.system?.origin ?? attackMsg?.id;
        const offer = await waitFor(offerEl, 1500);
        offer?.querySelector('button[data-action="roll"]')?.click();
        // Piercer's Puncture (a dice changer, always on — no Damage Rolled Twice list to empty) holds the
        // damage on its popup under a 0 s Decision Timer: keep the roll, it is smoke-savage's to test.
        const dicePopup = await waitFor(() => (damageFor(originId)?.getFlag(MOD, 'receipt') ? 'landed' : null)
          ?? [...foundry.applications.instances.values()].find(app => app.rendered && app.element?.querySelector?.('[data-bf-ticks="bf-dice"]')), 6000);
        if (dicePopup && (dicePopup !== 'landed')) {
          for (const box of dicePopup.element.querySelectorAll('input[name="bf-dice"]')) if (box.checked) box.click();
          dicePopup.element.querySelector('button[data-action="keep"]')?.click();
        }
        const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
        await waitFor(() => game.messages.get(dmg?.id)?.getFlag(MOD, 'clockRiders')?.effectsApplied, 6000);
        await sleep(300);
        return { attackMsg, dmg };
      };
      const on = name => victim.effects.find(e => e.name === name) ?? null;
      const changesOf = e => JSON.stringify(e?.changes ?? e?.system?.changes ?? []);
      try {
        await set('damageEitherList', '');   // Piercer's Puncture is smoke-savage's
        // --- Slasher, on the ranger's Longsword
        await lend(ranger, 'Slasher', 'feat');
        await set('clockRiderList', 'Slasher');
        await clearChips();
        {
          const { dmg } = await swingAt(ranger, rangerToken, longsword, 19);
          const h = on('Hamstrung');
          const cr = dmg?.getFlag(MOD, 'clockRiders');
          ok('10a. Slasher, a plain Longsword hit: "Hamstrung" lands (the pack\'s speed −10), clocked to a turn start; no "Slashed"; the card says it',
            !!h && /movement/.test(changesOf(h)) && /turnStart/.test(JSON.stringify(h?._source?.duration ?? {})) && !on('Slashed')
              && (cr?.riders ?? []).some(r => (r.key === 'slasher-hamstring') && /Speed −10/.test(r.says ?? ''))
              && /Hamstring — Speed −10 feet/.test(cardText(dmg?.id)),
            `hamstrung=${!!h} changes=${changesOf(h)} slashed=${!!on('Slashed')} riders=${JSON.stringify((cr?.riders ?? []).map(r => r.key))}`);
        }
        await clearChips();
        {
          await swingAt(ranger, rangerToken, longsword, 20);
          const sl = on('Slashed');
          ok('10b. a Critical Hit lands "Slashed" too — no speed change of its own (the gate reads its Disadvantage by name)',
            !!sl && (changesOf(sl) === '[]') && !!on('Hamstrung'), `slashed=${!!sl} changes=${changesOf(sl)} hamstrung=${!!on('Hamstrung')}`);
        }
        await clearChips();
        // --- Crusher, on a Mace
        const mace = await lend(ranger, 'Mace', 'weapon');
        await lend(ranger, 'Crusher', 'feat');
        await set('clockRiderList', 'Crusher');
        {
          await swingAt(ranger, rangerToken, mace, 19);
          ok('10c. Crusher, a plain Mace hit: nothing lands (the push is the shove offer\'s)', !on('Crushed'), `crushed=${!!on('Crushed')}`);
          await swingAt(ranger, rangerToken, mace, 20);
          const cu = on('Crushed');
          ok('10d. a Mace Critical Hit lands "Crushed", clocked to a turn start', !!cu && /turnStart/.test(JSON.stringify(cu?._source?.duration ?? {})),
            `crushed=${!!cu} duration=${JSON.stringify(cu?._source?.duration ?? null)}`);
        }
        await clearChips();
        // --- Piercer, on the rogue's Rapier
        await lend(rogue, 'Piercer', 'feat');
        await set('clockRiderList', 'Piercer');
        {
          const { dmg } = await swingAt(rogue, rogueToken, rapier, 20);
          const die = (dmg?.rolls?.[0]?.dice ?? [])[0];
          const base = Number(rapier.system.damage?.base?.number) || 1;
          ok(`10e. Piercer, a Rapier Critical Hit: the first die rolls ${(base * 2) + 1} (the crit's ${base * 2} and ONE more), the card says it`,
            (die?.number === (base * 2) + 1) && /Piercer — Enhanced Critical — one additional damage die/.test(cardText(dmg?.id)),
            `formula="${dmg?.rolls?.[0]?.formula}" number=${die?.number}`);
          const { dmg: plain } = await swingAt(rogue, rogueToken, rapier, 19);
          ok('10f. a plain Rapier hit: no extra die, no rider', ((plain?.rolls?.[0]?.dice ?? [])[0]?.number === base) && !plain?.getFlag(MOD, 'clockRiders'),
            `formula="${plain?.rolls?.[0]?.formula}"`);
        }
      } finally {
        CONFIG.Dice.randomUniform = realPRNG;
        await clearChips();
        for (const [actor, id] of lent) if (actor.items.get(id)) await actor.deleteEmbeddedDocuments('Item', [id]).catch(() => {});
        await set('damageEitherList', priorEither);
        await set('clockRiderList', prior.clockRiderList);
      }
    }

    if (want(7)) {
      ok('7a. dnd5e.preRollDamage fired (the rider\'s hook)', count('dnd5e.preRollDamage') > 0, `count=${count('dnd5e.preRollDamage')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    Hooks.off('battleflow.moment', momentHookId);
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'clock', out, plan, f });
