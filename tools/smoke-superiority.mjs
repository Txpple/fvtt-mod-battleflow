// Battle Flow superiority smoke test — THE REST OF THE BATTLE MASTER'S MANEUVERS (user, 2026-09-04:
// "do the rest of maneuvers"). Parry as a damage interrupt that REDUCES by a roll, the four Bonus
// Action uses (Evasive Footwork's rolled AC, Bait and Switch's choice, Lunging Attack's ticked die,
// Feinting Attack's marker + Advantage + die), Ambush and Tactical Assessment as scoped d20 folds
// (Stealth / the three skills; Ambush on Initiative), Commander's Strike as a driven ally attack,
// and Rally as the platform's own heal (nothing built — measured).
//
// Fixtures: BF Test Fighter (Morgash, Fighter 5 Battle Master — Combat Superiority, four d8s),
// BF Test Ranger (the willing ally), BF Test Attacker (the goblin). The nine maneuvers are added
// to the fighter from the 2024 PHB pack for the run and removed after.
//
// Harness discipline: every setting touched is restored; every message this run creates is
// deleted; the items it adds are removed; the pool it spends is refilled; the chips and markers
// it writes are cleared; the tokens it places are removed; its combat is deleted.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'Parry: the goblin hits the fighter — a DAMAGE hold (not the Monster Manual\'s AC Parry), the answer rolls die + modifier in the open, the damage lands REDUCED with the receipt saying so, the pool and the Reaction spent',
  2: 'Feinting Attack: the pack\'s marker on the goblin with the fighter as source; the fighter\'s attack gate reads it as Advantage; the die rides the hit and the marker is spent; the Ranger\'s gate never reads it',
  3: 'Lunging Attack: a chip until the end of the turn; the next melee hit\'s offer carries the die as a TICKED checkbox; ticked it rides and the chip goes; unticked nothing rides',
  4: 'Evasive Footwork: the die rolled in the open, the number on the fighter\'s AC until the start of the next turn (a chip)',
  5: 'Bait and Switch: the die rolled; a popup asks who gains the AC; the Ranger picked wears the pack\'s own "Baited AC +N"',
  6: 'Rally: NOTHING built — the pack\'s heal activity rolls through the system\'s own dialog and the cast slice lands the temp HP on the ally',
  7: 'Ambush / Tactical Assessment: a Stealth check offers Ambush (and not Tactical Assessment); a History check the reverse; Athletics neither; accepting spends the die and patches the total',
  8: 'Ambush on Initiative: the initiative roll offers Ambush; accepting moves the combatant\'s initiative by the die',
  9: 'Commander\'s Strike: the fighter directs the Ranger; the Ranger\'s owner answers, its attack is driven at the goblin with the fighter\'s die on the damage, its Reaction spent',
  10: 'the registration FIRED (§11): dnd5e.rollInitiative and dnd5e.rollSkill moved'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'superiority', watchdogMs: 900_000 });
announcePlan('superiority', plan, pulled);

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
  if (!game.settings.settings.has(`${MOD}.superiorityUseList`)) return { fatal: 'superiorityUseList not registered — OLD code (deploy --local, reload)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'holdTimer', 'holdReveal', 'holdSkipFutile', 'interruptList', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk',
    'saves', 'castApply', 'concMode', 'reminderList', 'conditionList', 'effectList', 'maneuverFolds', 'd20Folds', 'd20FoldAsk',
    'clockRiderList', 'hitMenuList', 'superiorityUseList', 'damageShieldList', 'damageSaveList', 'emanations'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const fighter = game.actors.getName('BF Test Fighter');
  const ranger = game.actors.getName('BF Test Ranger');
  const goblin = game.actors.getName('BF Test Attacker');
  if (!scene || !fighter || !ranger || !goblin) return { fatal: 'missing fixture: scene, BF Test Fighter, BF Test Ranger or BF Test Attacker — run tools/fixture-suite.mjs' };
  const pool = fighter.items.find(i => i.name === 'Combat Superiority');
  const sword = fighter.items.find(i => (i.type === 'weapon') && (i.name === 'Greataxe'))
    ?? fighter.items.find(i => (i.type === 'weapon') && (i.name === 'Longsword'))
    ?? fighter.items.find(i => (i.type === 'weapon') && i.system.equipped && (i.system.attack?.type?.value !== 'ranged'));
  const goblinMelee = goblin.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => (a.type === 'attack') && (a.attack?.type?.value === 'melee')));
  const rangerSword = ranger.items.find(i => (i.type === 'weapon') && (i.name === 'Longsword'));
  if (!pool || !sword || !goblinMelee || !rangerSword) return { fatal: 'the fixtures lack Combat Superiority, a fighter weapon, a goblin melee weapon or the Ranger\'s Longsword' };

  const created = { items: [], tokens: [] };
  const priorActor = {};
  let combat = null;
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const priorPoolSpent = pool.system._source.uses?.spent ?? 0;
  const refill = () => pool.update({ 'system.uses.spent': 0 });
  const poolLeft = () => fighter.items.get(pool.id)?.system.uses?.value ?? -1;
  const clearChips = async () => {
    for (const a of [fighter, ranger, goblin]) {
      const fx = a.effects.filter(e => e.getFlag(MOD, 'mastery') || e.getFlag(MOD, 'applied') || /^(Feinting Attack|Lunging Attack|Evasive Footwork|Baited AC|Reaction — used)/.test(e.name));
      const live = fx.map(e => e.id).filter(id => a.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
    }
  };
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      const ours = app.element?.querySelector?.('[data-bf-reminder], [data-bf-save-demand], [data-bf-hit], [data-bf-riders]')
        || /RollConfigurationDialog|DialogV2/.test(app.constructor?.name ?? '');
      if (ours) { try { await app.close(); } catch { /* gone */ } }
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
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      await clearChips();
      const live = created.items.filter(id => fighter.items.get(id));
      if (live.length) await fighter.deleteEmbeddedDocuments('Item', live);
      await pool.update({ 'system.uses.spent': priorPoolSpent });
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow' || Object.keys(m.flags?.[MOD] ?? {}).length || m.getFlag('core', 'initiativeRoll')));
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
    await set('reactionHold', true);          // Parry
    await set('holdTimer', 0);
    await set('holdReveal', true);
    await set('holdSkipFutile', false);
    await set('interruptList', game.settings.settings.get(`${MOD}.interruptList`)?.default ?? prior.interruptList);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', true);          // the chip spend (Feinting's marker) lives in the mastery machine
    await set('masteryAsk', 'auto');
    await set('saves', false);
    await set('castApply', true);              // Rally
    await set('concMode', 'off');
    await set('reminderList', 'effect');       // the gate reads the effect table only
    await set('conditionList', prior.conditionList);
    await set('effectList', game.settings.settings.get(`${MOD}.effectList`)?.default ?? prior.effectList);
    await set('maneuverFolds', "Commander's Strike:command");
    await set('d20Folds', 'Ambush:tactical, Tactical Assessment:tactical');
    await set('d20FoldAsk', true);
    await set('clockRiderList', '');
    await set('hitMenuList', '');
    await set('superiorityUseList', 'Evasive Footwork, Bait and Switch, Lunging Attack, Feinting Attack');
    await set('damageShieldList', '');
    await set('damageSaveList', '');
    await set('emanations', false);

    // -------------------------------------------------- fixtures
    const MANEUVERS = ['Parry', 'Feinting Attack', 'Lunging Attack', 'Evasive Footwork', 'Bait and Switch', 'Rally', 'Ambush', 'Tactical Assessment', "Commander's Strike"];
    const pack = game.packs.get('dnd-players-handbook.classes');
    if (!pack) return { fatal: 'the 2024 PHB classes pack is not in this world' };
    const index = await pack.getIndex();
    const add = [];
    for (const name of MANEUVERS) {
      if (fighter.items.some(i => (i.type === 'feat') && (i.name === name))) continue;
      const hit = index.find(e => e.name === name);
      if (!hit) return { fatal: `${name} not in the PHB pack` };
      const data = (await pack.getDocument(hit._id)).toObject();
      delete data._id;
      add.push(data);
    }
    if (add.length) {
      const docs = await fighter.createEmbeddedDocuments('Item', add);
      created.items.push(...docs.map(d => d.id));
      log.push(`gave the fighter ${docs.map(d => d.name).join(', ')} for the run`);
    }
    await refill();
    const feat = name => fighter.items.find(i => (i.type === 'feat') && (i.name === name));
    const actOf = (item, name) => [...(item?.system?.activities ?? [])].find(a => a.name === name);
    log.push(`pool: ${poolLeft()} superiority dice; weapon: ${sword.name}`);

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => [fighter.id, ranger.id, goblin.id].includes(t.actorId)).map(t => t.id);
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
    const { doc: fighterDoc, token: fighterToken } = await placeToken(fighter, 1500, 1200);
    const { doc: goblinDoc, token: goblinToken } = await placeToken(goblin, 1400, 1200);   // 5 ft left of the fighter
    const { doc: rangerDoc, token: rangerToken } = await placeToken(ranger, 1500, 1300);   // 5 ft below the fighter

    for (const a of [fighter, ranger, goblin]) {
      priorActor[a.id] = {
        'system.attributes.hp.value': a.system._source.attributes.hp.value,
        'system.attributes.hp.max': a.system._source.attributes.hp.max,
        'system.attributes.hp.temp': a.system._source.attributes.hp.temp ?? 0
      };
      await a.update({ 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
    }
    priorActor[goblin.id]['system.attributes.ac.calc'] = goblin.system._source.attributes.ac.calc;
    priorActor[goblin.id]['system.attributes.ac.flat'] = goblin.system._source.attributes.ac.flat;
    await goblin.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });
    const healFull = async () => { for (const a of [fighter, ranger, goblin]) await a.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 }); };

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
    const attackOf = item => item.system.activities.find(a => a.type === 'attack');
    const damageFor = originId => game.messages.contents.find(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
      && (m.getFlag('dnd5e', 'originatingMessage') === originId));
    const offerEl = () => [...foundry.applications.instances.values()].map(a => a.element)
      .find(el => (el?.innerHTML ?? '').includes('Damage — your roll')) ?? null;
    const rollDialog = () => [...foundry.applications.instances.values()]
      .find(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element && !app.element.querySelector('[data-bf-save-demand]')) ?? null;
    // ⚠ A POPUP, never the sidebar: the chat log is an application too and carries every card's
    // text, so a bare text match found the log and clicked nothing (first live run).
    const dialogWith = text => [...foundry.applications.instances.values()]
      .find(app => app.rendered && !/ChatLog|Sidebar|Tab/.test(app.constructor?.name ?? '') && (app.element?.innerHTML ?? '').includes(text)) ?? null;
    // The rescue window is the spine's own DOM window (the d20-fold suite's idiom): found in the
    // document, its rows are `[data-bf-rescue-action]` elements, not dialog buttons.
    const rescueWindow = text => [...document.querySelectorAll('.application')]
      .find(el => el.querySelector('[data-bf-rescue-row]') && (el.textContent ?? '').includes(text)) ?? null;
    const lastAttack = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag('dnd5e', 'roll.type') === 'attack')).pop() ?? null;
    /** A programmatic hit (no dialog) by `actor` with `weapon` at `victimToken`. */
    const swing = async (actor, actorToken, weapon, victimToken, { d20 = 19 } = {}) => {
      actorToken.control({ releaseOthers: true });
      target(victimToken);
      await sleep(80);
      face(d20);
      const act = attackOf(weapon);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': results.message.id } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      return { msg, originId: msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id };
    };
    const useAt = async (item, activityName, token, opts = {}) => {
      fighterToken.control({ releaseOthers: true });
      if (token) target(token); else game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      await sleep(80);
      const act = actOf(item, activityName);
      if (!act) throw new Error(`${item.name} has no activity "${activityName}"`);
      const results = await act.use({ ...opts }, { configure: false }, {});
      return results?.message ?? null;
    };
    const riderPart = (dmg, re) => (dmg?.rolls ?? []).find(r => re.test(r.formula));

    // ================================================== 1. Parry
    if (want(1)) {
      await clearChips(); await refill(); await healFull();
      const hpBefore = fighter.system.attributes.hp.value;
      const { msg } = await swing(goblin, goblinToken, goblinMelee, fighterToken);
      const hold = await waitFor(() => msg?.getFlag(MOD, 'hold') ?? null, 6000);
      const t = hold?.targets?.find(x => x.uuid === fighter.uuid);
      ok('1a. the goblin\'s melee hit on the fighter stamps a hold for Parry as a DAMAGE interrupt with the pack\'s reduction formula — the Monster Manual\'s AC Parry of the same name is not this',
        !!t && (t.reaction === 'Parry') && (t.kind === 'damage') && /superiority\.die/.test(t.reduce?.formula ?? ''), `target=${JSON.stringify(t)}`);
      const popup = await waitFor(() => dialogWith('Cast Parry'), 6000);
      popup?.element?.querySelector('button[data-action="cast"]')?.click();
      const resolved = await waitFor(() => (msg?.getFlag(MOD, 'hold')?.status === 'resolved') ? msg.getFlag(MOD, 'hold') : null, 10000);
      const rt = resolved?.targets?.find(x => x.uuid === fighter.uuid);
      const dieMsg = game.messages.contents.filter(m => (m.timestamp >= suiteStart) && /Parry — the die/.test(m.flavor ?? '')).at(-1);
      ok('1b. the answer rolls the die plus the modifier IN THE OPEN and rides the hold as the reduction', !!rt && (rt.answer === 'cast') && (Number(rt.reduceBy) > 0) && !!dieMsg && (dieMsg.rolls?.[0]?.total === rt.reduceBy),
        `reduceBy=${rt?.reduceBy} die=${dieMsg?.rolls?.[0]?.formula}=${dieMsg?.rolls?.[0]?.total}`);
      const dmg = await waitFor(() => { const d = damageFor(msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      const receipt = dmg?.getFlag(MOD, 'receipt')?.targets?.find(x => x.uuid === fighter.uuid);
      const total = (dmg?.rolls ?? []).reduce((n, r) => n + (r.total ?? 0), 0);
      const expected = Math.max(0, total - (rt?.reduceBy ?? 0));
      ok('1c. the damage lands REDUCED by that number through the receipt chokepoint — the receipt row says why, the HP moved by the rest',
        !!receipt && (receipt.taken === expected) && /Parry — reduced by/.test(receipt.note ?? '') && (fighter.system.attributes.hp.value === hpBefore - expected),
        `rolled=${total} reduceBy=${rt?.reduceBy} taken=${receipt?.taken} note="${receipt?.note}" hp ${hpBefore}→${fighter.system.attributes.hp.value}`);
      // Out of combat there is no turn to bring a Reaction back, so no chip is written (the settled rule) — the pool is the spend to assert.
      ok('1d. the pool is spent (the Reaction chip is a combat-only document — out of combat none is written, by the settled rule)', poolLeft() === 3, `pool=${poolLeft()}`);
      await clearChips();
    }

    // ================================================== 2. Feinting Attack
    if (want(2)) {
      await clearChips(); await refill(); await healFull();
      const card = await useAt(feat('Feinting Attack'), 'Damage', goblinToken);
      const marker = await waitFor(() => goblin.effects.find(e => e.name === 'Feinting Attack') ?? null, 6000);
      await waitFor(() => card?.getFlag(MOD, 'superiorityUse'), 4000);
      ok('2a. the use puts the pack\'s "Feinting Attack" marker on the goblin with the fighter as its source, the pool spent, the card says so',
        !!marker && (marker.getFlag(MOD, 'sourceUuid') === fighter.uuid) && (poolLeft() === 3) && !!card?.getFlag(MOD, 'superiorityUse'),
        `marker=${!!marker} source=${marker?.getFlag(MOD, 'sourceUuid')} pool=${poolLeft()} card=${JSON.stringify(card?.getFlag(MOD, 'superiorityUse'))}`);
      // The fighter's attack WITH the dialog: the gate reads the marker as Advantage.
      fighterToken.control({ releaseOthers: true });
      target(goblinToken);
      await sleep(80);
      const act = attackOf(sword);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const before = lastAttack()?.id ?? null;
      face(19);
      void act.rollAttack({}, {}, results?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': results.message.id } } : {});
      const dialog = await waitFor(rollDialog, 6000);
      await waitFor(() => dialog?.element?.querySelector('[data-bf-reminder]'), 2500);
      const section = textOf(dialog?.element?.querySelector('[data-bf-reminder]'));
      ok('2b. the fighter\'s attack gate lists Feinting Attack on the goblin — Net Advantage', /Feinting Attack/.test(section) && /Net Advantage/.test(section), `section="${section.slice(0, 200)}"`);
      dialog?.element?.querySelector('button[data-action="advantage"]')?.click();
      const attackMsg = await waitFor(() => { const m = lastAttack(); return (m && (m.id !== before)) ? m : null; }, 8000);
      const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      const sr = dmg?.getFlag(MOD, 'superiorityRide');
      ok('2c. the die rides the hit\'s damage as its own part in the weapon\'s type, the card says so, and the marker is spent',
        !!riderPart(dmg, /^1d8$/) && (sr?.rode?.[0]?.key === 'Feinting Attack') && !goblin.effects.some(e => e.name === 'Feinting Attack'),
        `formulas=[${(dmg?.rolls ?? []).map(r => r.formula + ':' + r.options?.type).join(' | ')}] ride=${JSON.stringify(sr?.rode)} markerLeft=${goblin.effects.some(e => e.name === 'Feinting Attack')}`);
      // Another creature's attack never reads the fighter's feint: a fresh marker, the RANGER's dialog.
      await useAt(feat('Feinting Attack'), 'Damage', goblinToken);
      await waitFor(() => goblin.effects.find(e => e.name === 'Feinting Attack') ?? null, 6000);
      rangerToken.control({ releaseOthers: true });
      target(goblinToken);
      await sleep(80);
      const ract = attackOf(rangerSword);
      const rres = await ract.use({ subsequentActions: false }, { configure: false }, {});
      face(19);
      void ract.rollAttack({}, {}, rres?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': rres.message.id } } : {});
      const rdialog = await waitFor(rollDialog, 6000);
      await sleep(1200);
      const rsection = textOf(rdialog?.element?.querySelector('[data-bf-reminder]'));
      ok('2d. the Ranger\'s gate does NOT read the fighter\'s feint (`only: "source"`)', !/Feinting Attack/.test(rsection), `section="${rsection.slice(0, 160)}"`);
      await closeDialogs();
      await sleep(600);
      await clearChips();
    }

    // ================================================== 3. Lunging Attack
    if (want(3)) {
      await clearChips(); await refill(); await healFull();
      await useAt(feat('Lunging Attack'), 'Damage', null);
      const chip = await waitFor(() => fighter.effects.find(e => (e.getFlag(MOD, 'mastery') === 'use') && (e.getFlag(MOD, 'useKey') === 'Lunging Attack')) ?? null, 6000);
      ok('3a. the use writes a chip on the fighter carrying the die, the pool spent', !!chip && (chip.getFlag(MOD, 'die') === '1d8') && (poolLeft() === 3), `chip=${chip?.name} die=${chip?.getFlag(MOD, 'die')} pool=${poolLeft()}`);
      const { msg, originId } = await swing(fighter, fighterToken, sword, goblinToken);
      const offer = await waitFor(offerEl, 6000);
      const box = offer?.querySelector('input[name="bf-rider"][value="lunge"]');
      ok('3b. the next melee hit\'s offer opens under auto damage with Lunging Attack as a TICKED checkbox — the 5-foot straight line is the player\'s', !!box && box.checked && /Lunging Attack — 1d8/.test(textOf(offer)), `box=${!!box} checked=${box?.checked} text="${textOf(offer).slice(0, 160)}"`);
      offer?.querySelector('button[data-action="roll"]')?.click();
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      await sleep(400);
      ok('3c. ticked, the die rides and the chip goes', !!riderPart(dmg, /^1d8$/) && (msg?.getFlag(MOD, 'lungePick') === true) && !fighter.effects.some(e => e.getFlag(MOD, 'useKey') === 'Lunging Attack'),
        `formulas=[${(dmg?.rolls ?? []).map(r => r.formula).join(' | ')}] pick=${msg?.getFlag(MOD, 'lungePick')} chipLeft=${fighter.effects.some(e => e.getFlag(MOD, 'useKey') === 'Lunging Attack')}`);
      // Unticked: nothing rides, the chip stays for a later hit this turn.
      await refill(); await healFull();
      await useAt(feat('Lunging Attack'), 'Damage', null);
      await waitFor(() => fighter.effects.find(e => e.getFlag(MOD, 'useKey') === 'Lunging Attack') ?? null, 6000);
      const { msg: m2, originId: o2 } = await swing(fighter, fighterToken, sword, goblinToken);
      const offer2 = await waitFor(offerEl, 6000);
      offer2?.querySelector('input[name="bf-rider"][value="lunge"]')?.click();
      await sleep(60);
      offer2?.querySelector('button[data-action="roll"]')?.click();
      const dmg2 = await waitFor(() => { const d = damageFor(o2); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      ok('3d. unticked, nothing rides and the chip stands', !!dmg2 && !riderPart(dmg2, /^1d8$/) && (m2?.getFlag(MOD, 'lungePick') === false) && fighter.effects.some(e => e.getFlag(MOD, 'useKey') === 'Lunging Attack'),
        `formulas=[${(dmg2?.rolls ?? []).map(r => r.formula).join(' | ')}] pick=${m2?.getFlag(MOD, 'lungePick')}`);
      await clearChips();
    }

    // ================================================== 4. Evasive Footwork
    if (want(4)) {
      await clearChips(); await refill();
      const acBefore = fighter.system.attributes.ac.value;
      const card = await useAt(feat('Evasive Footwork'), 'Evade', null);
      const chip = await waitFor(() => fighter.effects.find(e => (e.getFlag(MOD, 'mastery') === 'use') && (e.getFlag(MOD, 'useKey') === 'Evasive Footwork')) ?? null, 6000);
      await sleep(300);
      const n = Number(chip?.changes?.[0]?.value);
      ok('4a. the die is rolled in the open and the number rides the fighter\'s AC as a chip until the start of the next turn; the pool spent; the card says the number',
        !!chip && (chip.changes?.[0]?.key === 'system.attributes.ac.bonus') && (n >= 1) && (n <= 8) && (fighter.system.attributes.ac.value === acBefore + n) && (poolLeft() === 3)
          && (card?.getFlag(MOD, 'superiorityUse')?.total === n),
        `chip=${chip?.name} change=${JSON.stringify(chip?.changes?.[0])} ac ${acBefore}→${fighter.system.attributes.ac.value} pool=${poolLeft()} card=${JSON.stringify(card?.getFlag(MOD, 'superiorityUse'))}`);
      await clearChips();
    }

    // ================================================== 5. Bait and Switch
    if (want(5)) {
      await clearChips(); await refill();
      const rangerAC = ranger.system.attributes.ac.value;
      const card = await useAt(feat('Bait and Switch'), 'Switch Places', rangerToken);
      const bs = await waitFor(() => { const b = card?.getFlag(MOD, 'baitSwitch'); return b?.total ? b : null; }, 6000);
      const popup = await waitFor(() => dialogWith('Who gains AC'), 6000);
      ok('5a. the die is rolled and a popup asks who gains the AC — the fighter and the willing Ranger', !!bs && (bs.options?.length === 2) && !!popup, `flag=${JSON.stringify(bs && { total: bs.total, options: bs.options?.map(o => o.name) })} popup=${!!popup}`);
      popup?.element?.querySelector('button[data-action="pick-1"]')?.click();
      const chosen = await waitFor(() => card?.getFlag(MOD, 'baitSwitch')?.chosen ?? null, 6000);
      const resolved = await waitFor(() => card?.getFlag(MOD, 'baitSwitch')?.resolved ?? null, 10000);
      log.push(`5b: chosen=${chosen} flag=${JSON.stringify(card?.getFlag(MOD, 'baitSwitch'))} rangerFx=${ranger.effects.map(e => e.name).join('|')}`);
      const baited = ranger.effects.find(e => e.name === `Baited AC +${bs?.total}`);
      await sleep(300);
      ok('5b. the Ranger picked wears the pack\'s own "Baited AC +N" — ONE effect, receipted on the card, its AC up by the roll and nothing else (the cast slice is kept off the twelve)',
        !!resolved?.applied && !!baited && (ranger.effects.filter(e => /^Baited AC/.test(e.name)).length === 1) && (ranger.system.attributes.ac.value === rangerAC + (bs?.total ?? 0)) && (card?.getFlag(MOD, 'effectReceipt')?.targets?.some(t => t.uuid === ranger.uuid)),
        `resolved=${JSON.stringify(resolved)} baited=${!!baited} ac ${rangerAC}→${ranger.system.attributes.ac.value} receipt=${!!card?.getFlag(MOD, 'effectReceipt')}`);
      await clearChips();
    }

    // ================================================== 6. Rally — the platform's own heal
    if (want(6)) {
      await clearChips(); await refill(); await healFull();
      fighterToken.control({ releaseOthers: true });
      target(rangerToken);
      await sleep(80);
      const rally = actOf(feat('Rally'), 'Heal');
      void rally.use({}, { configure: false }, {});
      const dialog = await waitFor(rollDialog, 8000);
      const btn = dialog?.element?.querySelector('button[data-action="roll"], button[type="submit"]');
      btn?.click();
      const temp = await waitFor(() => (ranger.system.attributes.hp.temp > 0) ? ranger.system.attributes.hp.temp : null, 12000);
      ok('6a. Rally needs nothing built: the pack\'s heal activity rolls through the system\'s own dialog and the cast slice lands the Temporary Hit Points on the Ranger; the pool spent',
        !!dialog && (temp > 0) && (poolLeft() === 3), `dialog=${!!dialog} temp=${ranger.system.attributes.hp.temp} pool=${poolLeft()}`);
      await closeDialogs();
      await clearChips();
    }

    // ================================================== 7. the scoped folds on checks
    if (want(7)) {
      await clearChips(); await refill();
      await closeDialogs();
      const foldOf = async (skill) => {
        const before = game.messages.size;
        const rolls = await fighter.rollSkill({ skill }, { configure: false }, {});
        const m = rolls?.[0]?.parent ?? null;
        await sleep(600);
        return { m, flag: m?.getFlag(MOD, 'd20fold') ?? null, grew: game.messages.size - before };
      };
      const ste = await foldOf('ste');
      ok('7a. a Stealth check offers Ambush — the d20 fold\'s tactical spend with the feature\'s own scope — and not Tactical Assessment', (ste.flag?.offers?.map(o => o.label).join(',') === 'Ambush') && (ste.flag?.offers?.[0]?.dieFormula === '1d8') && (ste.flag?.skill === 'ste'),
        `offers=${JSON.stringify(ste.flag?.offers)} skill=${ste.flag?.skill}`);
      await closeDialogs();
      const his = await foldOf('his');
      ok('7b. a History check offers Tactical Assessment and not Ambush', his.flag?.offers?.map(o => o.label).join(',') === 'Tactical Assessment', `offers=${JSON.stringify(his.flag?.offers?.map(o => o.label))}`);
      await closeDialogs();
      const ath = await foldOf('ath');
      ok('7c. an Athletics check offers neither', !ath.flag, `flag=${JSON.stringify(ath.flag?.offers?.map(o => o.label))}`);
      // Accept Ambush on a fresh Stealth check: the rescue window's row.
      const ste2 = await foldOf('ste');
      const win = await waitFor(() => rescueWindow('Ambush'), 6000);
      win?.querySelector('[data-bf-rescue-action="tactical"]')?.click();
      const done = await waitFor(() => { const fl = ste2.m?.getFlag(MOD, 'd20fold'); return (fl?.status === 'resolved') ? fl : null; }, 10000);
      ok('7d. accepting Ambush spends a Superiority Die, rolls the die in the open and patches the check\'s total; the card names Ambush, not Tactical Mind',
        (done?.outcome === 'used') && (done?.spends?.[0]?.name === 'Ambush') && (done?.spends?.[0]?.label === 'Ambush') && (done?.foldedTotal === done?.baseTotal + done?.spends?.[0]?.die) && (poolLeft() === 3)
          && !game.messages.contents.some(m => (m.timestamp >= suiteStart) && /Second Wind isn't expended/.test(m.content ?? '')),
        `flag=${JSON.stringify(done && { outcome: done.outcome, spends: done.spends, base: done.baseTotal, folded: done.foldedTotal })} pool=${poolLeft()}`);
      await closeDialogs();
    }

    // ================================================== 8. Ambush on Initiative
    if (want(8)) {
      await clearChips(); await refill(); await closeDialogs();
      if (game.combat) await game.combat.delete();
      combat = await Combat.create({ scene: scene.id, active: true });
      await combat.createEmbeddedDocuments('Combatant', [{ actorId: fighter.id, tokenId: fighterDoc.id, sceneId: scene.id }, { actorId: goblin.id, tokenId: goblinDoc.id, sceneId: scene.id, initiative: 5 }]);
      await sleep(300);
      face(10);
      await fighter.rollInitiative({ createCombatants: false, rerollInitiative: true }, { configure: false });
      const combatant = combat.combatants.find(c => c.actorId === fighter.id);
      const initBefore = combatant?.initiative;
      const initMsg = await waitFor(() => game.messages.contents.slice(-10).reverse().find(m => m.getFlag('core', 'initiativeRoll') && m.getFlag(MOD, 'd20fold')) ?? null, 6000);
      const flag = initMsg?.getFlag(MOD, 'd20fold');
      ok('8a. the initiative roll is offered Ambush (testKind initiative, the combatant named)', (flag?.testKind === 'initiative') && (flag?.offers?.[0]?.label === 'Ambush') && flag?.combatantIds?.includes(combatant?.id),
        `flag=${JSON.stringify(flag && { testKind: flag.testKind, offers: flag.offers?.map(o => o.label), combatants: flag.combatantIds, base: flag.baseTotal })} init=${initBefore}`);
      const win = await waitFor(() => rescueWindow('Ambush'), 6000);
      win?.querySelector('[data-bf-rescue-action="tactical"]')?.click();
      const done = await waitFor(() => { const fl = initMsg?.getFlag(MOD, 'd20fold'); return (fl?.status === 'resolved') ? fl : null; }, 10000);
      await sleep(400);
      ok('8b. accepting moves the combatant\'s initiative by the die and says so', (done?.outcome === 'used') && (combat.combatants.get(combatant?.id)?.initiative === initBefore + (done?.spends?.[0]?.die ?? 0)) && (poolLeft() === 3),
        `init ${initBefore}→${combat.combatants.get(combatant?.id)?.initiative} die=${done?.spends?.[0]?.die} pool=${poolLeft()}`);
      await closeDialogs();
      await combat.delete(); combat = null;
    }

    // ================================================== 9. Commander's Strike
    if (want(9)) {
      await clearChips(); await refill(); await healFull(); await closeDialogs();
      const card = await useAt(feat("Commander's Strike"), 'Directed Attack', rangerToken);
      const cmd = await waitFor(() => { const c = card?.getFlag(MOD, 'command'); return (c?.status === 'pending') ? c : null; }, 6000);
      ok('9a. the use stamps the command on the card: the Ranger as the ally, the fighter\'s die resolved on the FIGHTER, the pool spent, and no damage dialog of dnd5e\'s own',
        !!cmd && (cmd.ally?.uuid === ranger.uuid) && (cmd.dieFormula === '1d8') && (poolLeft() === 3) && !rollDialog(),
        `cmd=${JSON.stringify(cmd && { ally: cmd.ally?.name, die: cmd.dieFormula, status: cmd.status })} pool=${poolLeft()} dialog=${!!rollDialog()}`);
      const popup = await waitFor(() => dialogWith('directs you to strike'), 6000);
      // The Ranger's owner (a GM here) targets the goblin and answers.
      target(goblinToken);
      await sleep(80);
      face(19);
      popup?.element?.querySelector('button[data-action="attack"]')?.click();
      const attackMsg = await waitFor(() => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'commandFor') === card?.id)).pop() ?? null, 10000);
      const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      const base = dmg?.rolls?.[0]?.formula ?? '';
      ok('9b. the Ranger\'s attack is driven at the goblin with the fighter\'s die on the damage (the riposte die\'s injection into the weapon\'s own roll — two dice), the answer folded on the card',
        !!attackMsg && (attackMsg.getAssociatedActor()?.uuid === ranger.uuid) && !!dmg && /1d8.*1d8/.test(base) && (card?.getFlag(MOD, 'command')?.answer === 'attack'),
        `attack=${!!attackMsg} by=${attackMsg?.getAssociatedActor()?.name} dmg=${base} answer=${card?.getFlag(MOD, 'command')?.answer} reaction=${ranger.effects.some(e => /Reaction — used/.test(e.name))}`);
      await clearChips();
    }

    // ================================================== 10. FIRED
    if (want(10)) {
      ok('10a. dnd5e.rollSkill fired (the scoped folds\' hook)', count('dnd5e.rollSkill') > 0, `count=${count('dnd5e.rollSkill')}`);
      ok('10b. dnd5e.rollInitiative fired (Ambush on Initiative)', count('dnd5e.rollInitiative') > 0, `count=${count('dnd5e.rollInitiative')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'superiority', out, plan, f });
