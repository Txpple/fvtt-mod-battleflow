// Battle Flow damage-cast smoke test — MAKE HEAT METAL WORK (user, 2026-09-04). Measured: the
// 2024 PHB's Heat Metal is a bare damage activity ("Cast and Heat"; "Reheat" as a Bonus Action)
// plus a save activity ("On Damage Save") that nothing chains — and a bare damage activity's dice
// were rolled by NOBODY (dnd5e's DamageActivity does nothing after the card; the module hides
// the card's Damage button). Now the dice roll at the use and land on the target, the save is
// put to the same target right after through the saves machine, Heated Metal lands on a failure,
// and both gates (attack, check) read it.
//
// Fixtures: BF Test Cleric (given Heat Metal for the run), BF Test Attacker (the holder). Built by
// tools/fixture-suite.mjs.
//
// Harness discipline: every setting touched is restored; every message this run creates is
// deleted; the item it adds is removed; the effects it presses are cleared; the tokens it
// places are removed; concentration is ended.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'Cast and Heat, the goblin targeted: the 2d8 fire rolls at the use (no button pressed), chained to the card, and LANDS on the goblin with a receipt',
  2: 'the save follows: a demand card for the goblin (Con, the Cleric\'s DC); the forced failure lands Heated Metal on the goblin, receipted, and the card says what the table plays',
  3: 'the attack gate reads Heated Metal on the goblin\'s attack — Disadvantage; the CHECK gate reads it on an ability check — Disadvantage',
  4: 'Reheat: a second use rolls and lands again, and demands the save again',
  5: 'the caster wants their dice: the offer opens for the cast and the press rolls it',
  6: 'the Damage Saves list is the switch for the save half: an empty list still rolls the dice, and demands nothing',
  7: 'the registration FIRED (§11): postUseActivity moved'
};
const DEPENDS = { 2: [1], 3: [2] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'heatmetal', watchdogMs: 600_000 });
announcePlan('heatmetal', plan, pulled);

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
  const errors = [];
  const origError = console.error;
  console.error = (...args) => { errors.push('E ' + args.map(a => (a instanceof Error) ? a.message : String(a)).join(' ').slice(0, 300)); origError(...args); };

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.damageSaveList`)) return { fatal: 'damageSaveList not registered — OLD code (deploy --local, reload)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'saves', 'saveTimer', 'castApply', 'concMode',
    'reminderList', 'conditionList', 'effectList', 'maneuverFolds', 'clockRiderList', 'hitMenuList', 'emanations', 'damageShieldList', 'damageSaveList', 'hideCardButtons'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const cleric = game.actors.getName('BF Test Cleric');
  const goblin = game.actors.getName('BF Test Attacker');
  if (!scene || !cleric || !goblin) return { fatal: 'missing fixture: scene, BF Test Cleric or BF Test Attacker — run tools/fixture-suite.mjs' };
  const melee = goblin.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => (a.type === 'attack') && (a.attack?.type?.value === 'melee')));
  if (!melee) return { fatal: 'BF Test Attacker has no melee weapon' };

  const created = { items: [], tokens: [] };
  const priorActor = {};
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const clearFx = async () => {
    for (const a of [cleric, goblin]) {
      const fx = a.effects.filter(e => /^Heated Metal/.test(e.name) || e.getFlag(MOD, 'applied'));
      const live = fx.map(e => e.id).filter(id => a.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
    }
  };
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      if (/RollConfigurationDialog/.test(app.constructor?.name ?? '') || app.element?.querySelector?.('[data-bf-save-demand], [data-bf-reminder]') || (app.element?.innerHTML ?? '').includes('Damage — your roll')) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    console.error = origError;
    for (const e of errors) log.push('console: ' + e);
    CONFIG.Dice.randomUniform = realPRNG;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      try { if (cleric.concentration?.effects?.size) await cleric.endConcentration(); } catch { /* none */ }
      await clearFx();
      const live = created.items.filter(id => cleric.items.get(id));
      if (live.length) await cleric.deleteEmbeddedDocuments('Item', live);
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow' || Object.keys(m.flags?.[MOD] ?? {}).length));
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
    await set('hideCardButtons', true);
    await set('reminderList', 'vex, sap, prone, condition, range, effect, sneak');
    await set('conditionList', prior.conditionList);
    await set('effectList', game.settings.settings.get(`${MOD}.effectList`)?.default ?? prior.effectList);
    await set('maneuverFolds', '');
    await set('clockRiderList', '');
    await set('hitMenuList', '');
    await set('emanations', false);
    await set('damageShieldList', '');
    await set('damageSaveList', 'Heat Metal');

    // -------------------------------------------------- fixtures
    const findPackItem = async (packIds, name) => {
      for (const id of packIds) {
        const pack = game.packs.get(id);
        if (!pack) continue;
        const index = await pack.getIndex();
        const hit = index.find(e => e.name === name);
        if (hit) { const doc = await pack.getDocument(hit._id); const data = doc.toObject(); delete data._id; return data; }
      }
      return null;
    };
    if (!cleric.items.some(i => (i.type === 'spell') && (i.name === 'Heat Metal'))) {
      const data = await findPackItem(['dnd-players-handbook.spells', 'dnd5e.spells24'], 'Heat Metal');
      if (!data) return { fatal: 'Heat Metal not in the packs' };
      data.system.preparation = { mode: 'always', prepared: true };
      const [doc] = await cleric.createEmbeddedDocuments('Item', [data]);
      created.items.push(doc.id);
      log.push('gave the Cleric Heat Metal for the run');
    }
    const heat = cleric.items.find(i => (i.type === 'spell') && (i.name === 'Heat Metal'));
    const actNamed = name => heat.system.activities.find(a => a.name === name);
    const castAct = actNamed('Cast and Heat'), reheatAct = actNamed('Reheat'), saveAct = actNamed('On Damage Save');
    if (!castAct || !reheatAct || !saveAct) return { fatal: `Heat Metal's activities differ from the measurement: ${heat.system.activities.map(a => a.name).join(', ')}` };

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => [cleric.id, goblin.id].includes(t.actorId)).map(t => t.id);
    if (strays.length) await scene.deleteEmbeddedDocuments('Token', strays);
    const placeToken = async (actor, x, y) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true, hidden: false }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const { token: clericToken } = await placeToken(cleric, 1500, 1200);
    const { token: goblinToken } = await placeToken(goblin, 1400, 1200);

    for (const a of [cleric, goblin]) {
      priorActor[a.id] = {
        'system.attributes.ac.calc': a.system._source.attributes.ac.calc,
        'system.attributes.ac.flat': a.system._source.attributes.ac.flat,
        'system.attributes.hp.value': a.system._source.attributes.hp.value,
        'system.attributes.hp.max': a.system._source.attributes.hp.max,
        'system.abilities.con.bonuses.save': a.system._source.abilities?.con?.bonuses?.save ?? ''
      };
      await a.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1,
        'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400, 'system.abilities.con.bonuses.save': '-30' });
    }
    const goblinHP = () => goblin.system.attributes.hp.value;
    const healFull = async () => goblin.update({ 'system.attributes.hp.value': 400 });

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const face = (n, faces = 20) => { CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces); };
    const target = token => token.setTarget(true, { releaseOthers: true });
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const cardText = id => textOf(document.querySelector(`.message[data-message-id="${id}"]`));
    const damageFor = originId => game.messages.contents.find(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
      && (m.getFlag('dnd5e', 'originatingMessage') === originId));
    const saveDialogEl = () => [...foundry.applications.instances.values()]
      .filter(app => app.rendered && app.element?.querySelector?.('[data-bf-save-demand]')).map(app => app.element)[0] ?? null;
    const rollDialog = () => [...foundry.applications.instances.values()]
      .find(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element && !app.element.querySelector('[data-bf-save-demand]')) ?? null;
    const offerEl = () => [...foundry.applications.instances.values()].map(a => a.element)
      .find(el => (el?.innerHTML ?? '').includes('Damage — your roll')) ?? null;
    const demandsSince = t => game.messages.contents.filter(m => (m.timestamp >= t) && m.getFlag(MOD, 'damageSaveCard'));
    /** The Cleric uses one of Heat Metal's damage activities at the goblin — no slot spent, no dialog.
     * ⚠ `subsequentActions` is left to the SYSTEM on purpose: dnd5e's own follow-up would open the
     * damage dialog and roll a second time; the module switches it off at the use, and §1 asserts
     * exactly ONE damage roll chains to the card. */
    const heatUse = async activity => {
      const since = Date.now();
      clericToken.control({ releaseOthers: true });
      target(goblinToken);
      await sleep(80);
      const results = await activity.use({ consume: { spellSlot: false, resources: false, action: false } }, { configure: false }, {});
      const card = results?.message ?? null;
      return { since, card };
    };
    const damageRollsFor = originId => game.messages.contents.filter(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
      && (m.getFlag('dnd5e', 'originatingMessage') === originId));
    let cardOne = null;
    let demandOne = null;

    // ================================================== 1. the dice roll at the use and land
    if (want(1)) {
      await clearFx();
      await healFull();
      const hpBefore = goblinHP();
      const { card } = await heatUse(castAct);
      cardOne = card;
      const dmg = await waitFor(() => { const d = card ? damageFor(card.id) : null; return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      const receipt = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === goblin.uuid);
      const part = dmg?.rolls?.[0];
      ok('1a. Cast and Heat used with the goblin targeted: the 2d8 fire rolled by the module (no button), chained to the usage card, the card stamped damageCast',
        !!dmg && /2d8/.test(part?.formula ?? '') && (part?.options?.type === 'fire') && !!card?.getFlag(MOD, 'damageCast'),
        `dmg=${!!dmg} formula=${part?.formula}:${part?.options?.type} stamp=${JSON.stringify(card?.getFlag(MOD, 'damageCast'))}`);
      ok('1b. …and it LANDS on the goblin through the no-attack applier: a receipt, the HP down by the roll',
        !!receipt && (receipt.taken === part?.total) && (goblinHP() === hpBefore - (part?.total ?? 0)),
        `receipt=${JSON.stringify(receipt)} hp ${hpBefore}→${goblinHP()}`);
      await sleep(2500);   // the window in which the system's own follow-up roll would have landed — the assertion is that it does not
      ok('1c. ONE roll, never two: the system\'s own follow-up (a damage dialog) was switched off at the use, so exactly one damage message chains to the card',
        card && (damageRollsFor(card.id).length === 1) && !rollDialog(),
        `rolls=${card ? damageRollsFor(card.id).length : 'no card'} damageDialogs=${rollDialog() ? 1 : 0}`);
    }

    // ================================================== 2. the save follows
    if (want(2)) {
      demandOne = await waitFor(() => demandsSince(suiteStart).find(m => m.getFlag(MOD, 'saves')) ?? null, 8000);
      const saves = demandOne?.getFlag(MOD, 'saves');
      const dc = saveAct.save?.dc?.value;
      ok('2a. a save demand card follows the damage: the goblin its one target, Constitution, the Cleric\'s own DC, the card tied to the damage card',
        !!saves && (saves.abilities?.[0] === 'con') && (saves.dc === dc) && (saves.targets?.length === 1) && (saves.targets[0].uuid === goblin.uuid)
          && (demandOne.getFlag(MOD, 'damageSaveCard')?.damageCardId === cardOne?.id),
        `saves=${JSON.stringify(saves ? { abilities: saves.abilities, dc: saves.dc, targets: saves.targets?.map(t => t.name) } : null)} dc=${dc} tie=${demandOne?.getFlag(MOD, 'damageSaveCard')?.damageCardId === cardOne?.id}`);
      // The GM's dialog for the NPC: press Normal (the -30 forces the failure).
      const el = await waitFor(saveDialogEl, 8000);
      el?.querySelector('button[data-action="normal"]')?.click();
      const done = await waitFor(() => { const t = demandOne?.getFlag(MOD, 'saves')?.targets?.[0]; return (t?.done && t.applied) ? t : null; }, 12000);
      const heated = await waitFor(() => goblin.effects.find(e => e.name === 'Heated Metal'), 6000);
      const er = demandOne?.getFlag(MOD, 'effectReceipt')?.targets?.find(t => t.uuid === goblin.uuid);
      ok('2b. the forced failure lands Heated Metal on the goblin through the saves machine, receipted on the demand card',
        (done?.outcome === 'failed') && !!heated && !!er?.effects?.some(e => e.name === 'Heated Metal'),
        `outcome=${done?.outcome} total=${done?.total} heated=${!!heated} receipt=${JSON.stringify(er?.effects?.map(e => e.name))}`);
      const text = await waitFor(() => { const t = cardText(demandOne?.id); return /the save after the damage/i.test(t) ? t : null; }, 4000);
      ok('2c. the card says what the table plays: drop it, or keep it and take the Disadvantage (R5)',
        /Drop it, or keep it/.test(text ?? '') && /remove Heated Metal if it did/.test(text ?? ''), (text ?? '').slice(0, 220));
    }

    // ================================================== 3. both gates read it
    if (want(3)) {
      if (!goblin.effects.some(e => e.name === 'Heated Metal')) {
        const src = heat.effects.find(e => e.name === 'Heated Metal');
        if (src) { const d = src.toObject(); delete d._id; await goblin.createEmbeddedDocuments('ActiveEffect', [{ ...d, origin: src.uuid, transfer: false }]); }
      }
      // The ATTACK gate: the goblin swings with the dialog.
      goblinToken.control({ releaseOthers: true });
      target(clericToken);
      await sleep(80);
      const attack = melee.system.activities.find(a => a.type === 'attack');
      const results = await attack.use({ subsequentActions: false }, { configure: false }, {});
      face(19);
      void attack.rollAttack({}, {}, results?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': results.message.id } } : {});
      const dialog = await waitFor(rollDialog, 6000);
      await waitFor(() => dialog?.element?.querySelector('[data-bf-reminder]'), 2500);
      const section = textOf(dialog?.element?.querySelector('[data-bf-reminder]'));
      ok('3a. the attack gate lists Heated Metal on the goblin\'s swing — Net Disadvantage', /Heated Metal/.test(section) && /Net Disadvantage/.test(section), `section="${section.slice(0, 200)}"`);
      dialog?.element?.querySelector('button[data-action="disadvantage"]')?.click();
      await sleep(1500);
      await closeDialogs();
      // The CHECK gate: a Strength check with the dialog.
      void goblin.rollAbilityCheck({ ability: 'str' }, {}, {});
      const check = await waitFor(rollDialog, 6000);
      await waitFor(() => check?.element?.querySelector('[data-bf-reminder]'), 2500);
      const cs = textOf(check?.element?.querySelector('[data-bf-reminder]'));
      ok('3b. the CHECK gate lists Heated Metal on the goblin\'s ability check — Net Disadvantage (the row\'s checks facet)', /Heated Metal/.test(cs) && /Net Disadvantage/.test(cs), `section="${cs.slice(0, 200)}"`);
      check?.element?.querySelector('button[data-action="disadvantage"]')?.click();
      await sleep(800);
      await closeDialogs();
      await clearFx();
    }

    // ================================================== 4. Reheat
    if (want(4)) {
      await clearFx();
      await healFull();
      const hpBefore = goblinHP();
      const { since, card } = await heatUse(reheatAct);
      const dmg = await waitFor(() => { const d = card ? damageFor(card.id) : null; return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      const demand = await waitFor(() => demandsSince(since).find(m => m.getFlag(MOD, 'saves')) ?? null, 8000);
      ok('4a. Reheat (the Bonus Action): the dice roll and land again, and the save is demanded again',
        !!dmg && (goblinHP() < hpBefore) && !!demand && (demand.getFlag(MOD, 'damageSaveCard')?.damageCardId === card?.id),
        `dmg=${!!dmg} hp ${hpBefore}→${goblinHP()} demand=${!!demand}`);
      const el = await waitFor(saveDialogEl, 8000);
      el?.querySelector('button[data-action="normal"]')?.click();
      await waitFor(() => demand?.getFlag(MOD, 'saves')?.targets?.[0]?.applied, 12000);
      await clearFx();
    }

    // ================================================== 5. the caster's own dice
    if (want(5)) {
      await clearFx();
      await healFull();
      await set('playerRollDamage', true);
      const { card } = await heatUse(castAct);
      const offer = await waitFor(offerEl, 6000);
      const text = textOf(offer);
      ok('5a. with Roll Your Own Damage on, the offer opens for the cast — the caster\'s dice, the goblin named (by its token)', !!offer && /Heat Metal/.test(text) && text.includes(goblinToken.document.name), text.slice(0, 160));
      offer?.querySelector('button[data-action="roll"]')?.click();
      const dmg = await waitFor(() => { const d = card ? damageFor(card.id) : null; return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      ok('5b. …the press rolls it, chained and landed as before', !!dmg && !!dmg.getFlag(MOD, 'receipt'), `dmg=${!!dmg}`);
      const el = await waitFor(saveDialogEl, 8000);
      el?.querySelector('button[data-action="normal"]')?.click();
      await sleep(1500);
      await set('playerRollDamage', false);
      await clearFx();
    }

    // ================================================== 6. the list is the switch for the save half
    if (want(6)) {
      await clearFx();
      await healFull();
      await set('damageSaveList', '');
      const { since, card } = await heatUse(castAct);
      const dmg = await waitFor(() => { const d = card ? damageFor(card.id) : null; return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      await sleep(2500);   // the window in which a demand would have appeared — the assertion is that none does
      ok('6a. an empty Damage Saves list: the dice still roll and land (every bare damage cast does), and no save is demanded',
        !!dmg && !demandsSince(since).length && !card?.getFlag(MOD, 'damageCast')?.save,
        `dmg=${!!dmg} demands=${demandsSince(since).length} stamp=${JSON.stringify(card?.getFlag(MOD, 'damageCast'))}`);
      await set('damageSaveList', 'Heat Metal');
    }

    // ================================================== 7. FIRED
    if (want(7)) {
      ok('7a. dnd5e.postUseActivity fired (the machine\'s hook)', count('dnd5e.postUseActivity') > 0, `count=${count('dnd5e.postUseActivity')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'heatmetal', out, plan, f });
