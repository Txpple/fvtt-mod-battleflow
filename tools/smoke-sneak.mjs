// Battle Flow Sneak Attack smoke test — THE PROTOTYPE, BUILT AS DRAWN (user ruling 2026-09-02,
// "Sneak Attack, Cunningly"): the tick at the gate, the Cunning Strike menu on the damage offer,
// the costs off the dice before the roll, the crit doubling what is left, the effects through
// the saves machine on the pack's own activities, once per turn as a turn chit. Driven end to
// end in the live world on the BUILT rogue fixture (Rogue 14 / Thief — tools/fixture-suite.mjs).
//
// Harness discipline: every setting touched is restored; every message this run creates is
// deleted; the items it adds (Envenom Weapons, Death Strike) are removed; the chits and
// conditions it presses are cleared; the tokens it places are removed; its combat is deleted.
//
// Sections: `--section 3`, `--section 1,7`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'the gate: the Sneak Attack box under the sources, ticked on Advantage, the record on the card',
  2: 'the weapon and the list are the switch: a longsword offers nothing, and so does a list without sneak',
  3: 'the damage offer opens under AUTO damage, the menu is read off the sheet, the pick stays legal',
  4: 'the dice ride the roll minus the costs, the Trip effect lands through the saves machine',
  5: 'a critical hit doubles what is left',
  6: 'once per turn: the chit, the greyed box, and the next turn',
  7: 'Envenom Weapons: the upgraded Poison — its damage, and Poisoned on top',
  8: 'Death Strike: round one, the Con save, the damage again',
  9: 'the registration FIRED (§11): preRollDamageV2 moved'
};
const DEPENDS = { 4: ['3'], 9: ['4'] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'sneak', watchdogMs: 720_000 });
announcePlan('sneak', plan, pulled);

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
  const errors = [];
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args) => { errors.push('E ' + args.map(a => (a instanceof Error) ? a.message : String(a)).join(' ').slice(0, 300)); origError(...args); };
  console.warn = (...args) => { errors.push('W ' + args.map(a => (a instanceof Error) ? a.message : String(a)).join(' ').slice(0, 300)); origWarn(...args); };
  const ledger = globalThis.__bfHookLedger ?? null;
  const count = name => ledger?.[name] ?? 0;

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.reminderList`)) return { fatal: 'reminderList not registered — OLD code (F5)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'saves', 'saveTimer', 'castApply',
    'concMode', 'reminderList', 'conditionList', 'effectList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const rogue = game.actors.getName('BF Test Rogue');
  if (!scene || !victim || !rogue) return { fatal: 'missing fixture: scene, BF Test Victim or BF Test Rogue — run tools/fixture-suite.mjs' };

  const created = { items: [], tokens: [] };
  const priorActor = {};
  let combat = null;
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const STATUSES = ['prone', 'poisoned', 'unconscious', 'blinded'];
  const clearChips = async () => {
    for (const a of [victim, rogue]) {
      const chips = a.effects.filter(e => e.getFlag(MOD, 'mastery') || /^(Cunning Strike|Devious Strikes|Sneak Attack|Vexed|Sapped)/.test(e.name)
        || STATUSES.some(s => e.statuses?.has?.(s)));
      // Re-filtered and tolerant: a deleted combat tidies the chits it clocked at the same moment
      // (mastery.js's sweep), and a delete naming a gone id throws.
      const live = chips.map(e => e.id).filter(id => a.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
    }
  };
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      const ours = app.element?.querySelector?.('[data-bf-reminder], [data-bf-save-demand], [data-bf-cunning]')
        || /RollConfigurationDialog/.test(app.constructor?.name ?? '')
        || (app.element?.innerHTML ?? '').includes('Damage — your roll');
      if (ours) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    console.error = origError;
    console.warn = origWarn;
    for (const e of errors) log.push('console: ' + e);
    CONFIG.Dice.randomUniform = realPRNG;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      await clearChips();
      for (const [actorId, ids] of Object.entries(created.items.reduce((m, i) => { (m[i.actorId] ??= []).push(i.id); return m; }, {}))) {
        const a = game.actors.get(actorId);
        const live = ids.filter(id => a?.items.get(id));
        if (live.length) await a.deleteEmbeddedDocuments('Item', live);
      }
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
    await set('playerRollDamage', false);   // AUTO damage: the offer must open for an armed sneak anyway
    await set('damageTimer', 0);            // the offer waits for a press — this suite presses
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
    await set('conditionList', prior.conditionList || 'blinded, invisible, hiding, paralyzed, petrified, poisoned, restrained, stunned, unconscious, frightened, grappled, incapacitated, dodging, charmed');

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => [victim.id, rogue.id].includes(t.actorId)).map(t => t.id);
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
    const { doc: victimDoc, token: victimToken } = await placeToken(victim, 1400, 1600);
    const { doc: rogueDoc, token: rogueToken } = await placeToken(rogue, 1500, 1600);
    rogueToken.control({ releaseOthers: true });

    priorActor[victim.id] = {
      'system.attributes.ac.calc': victim.system._source.attributes.ac.calc,
      'system.attributes.ac.flat': victim.system._source.attributes.ac.flat,
      'system.abilities.dex.bonuses.save': victim.system._source.abilities?.dex?.bonuses?.save ?? '',
      'system.abilities.con.bonuses.save': victim.system._source.abilities?.con?.bonuses?.save ?? '',
      'system.attributes.hp.value': victim.system._source.attributes.hp.value,
      'system.attributes.hp.max': victim.system._source.attributes.hp.max
    };
    // ⚠ A DEEP POOL, on purpose: 7d6 kills an 11-HP goblin outright, and the saves machine
    // rightly refuses a demand on a dead target (the v1.19.0 gate) — so every Cunning Strike
    // effect would vanish for the truest of reasons. The victim must survive a rogue.
    await victim.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1,
      'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400,
      'system.abilities.dex.bonuses.save': '-30', 'system.abilities.con.bonuses.save': '-30' });
    const healFull = async () => {
      await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });
      const down = victim.effects.filter(e => ['dead', 'unconscious'].some(s => e.statuses?.has?.(s)));
      if (down.length) await victim.deleteEmbeddedDocuments('ActiveEffect', down.map(e => e.id)).catch(() => {});
    };
    const weapon = name => rogue.items.find(i => (i.type === 'weapon') && (i.name === name));
    const rapier = weapon('Rapier');
    const longsword = weapon('Longsword');
    if (!rapier || !longsword) return { fatal: 'the rogue fixture lacks its Rapier or Longsword — re-run fixture-suite' };
    const attackOf = item => item.system.activities.find(a => a.type === 'attack');

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const face = (n, faces = 20) => { CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces); };
    const target = token => token.setTarget(true, { releaseOthers: true });
    const lastAttack = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag('dnd5e', 'roll.type') === 'attack')).pop() ?? null;
    const waitAttackAfter = async id => waitFor(() => { const m = lastAttack(); return (m && (m.id !== id)) ? m : null; }, 8000);
    const rollDialog = () => [...foundry.applications.instances.values()]
      .find(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element) ?? null;
    const offerEl = () => [...foundry.applications.instances.values()].map(a => a.element)
      .find(el => (el?.innerHTML ?? '').includes('Damage — your roll')) ?? null;
    const saveDialogEl = () => [...foundry.applications.instances.values()]
      .filter(app => app.rendered && app.element?.querySelector?.('[data-bf-save-demand]')).map(app => app.element)[0] ?? null;
    const damageFor = originId => game.messages.contents.find(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
      && (m.getFlag('dnd5e', 'originatingMessage') === originId));
    /** Open the gate for a swing with `item`, the sheet/use shape (dialog allowed). */
    const openGate = async (item, { d20 = 19 } = {}) => {
      await healFull();
      target(victimToken);
      await sleep(80);
      const act = attackOf(item);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const before = lastAttack()?.id ?? null;
      face(d20);
      void act.rollAttack({}, {}, usageId ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
      const dialog = await waitFor(rollDialog, 6000);
      // The section rides the render hook — wait for it rather than for the dialog (a bare dialog
      // is the §2 shape, so this wait may legitimately time out there).
      await waitFor(() => dialog?.element?.querySelector('[data-bf-reminder]'), 2500);
      await sleep(100);
      return { dialog, usageId, before };
    };
    const press = (dlg, mode) => { const b = dlg?.element?.querySelector(`button[data-action="${mode}"]`); b?.click(); return !!b; };
    const boxOf = dlg => dlg?.element?.querySelector('[data-bf-sneak]') ?? null;
    const tickOf = dlg => dlg?.element?.querySelector('input[name="bf-sneak"]') ?? null;
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    /** Swing, arm as the box stands (or force the tick), press the mode, return the attack message. */
    const armedSwing = async (item, { mode = 'advantage', tick = null, d20 = 19 } = {}) => {
      const { dialog, usageId, before } = await openGate(item, { d20 });
      const box = tickOf(dialog);
      if (box && (tick !== null) && (box.checked !== tick)) box.click();
      // Everything the assertions read off the dialog is read HERE — its element is gone once it closes.
      const seen = { boxText: textOf(boxOf(dialog)), boxInDetails: !!boxOf(dialog)?.closest('details'), hasTick: !!box,
        ticked: !!box?.checked, sectionText: textOf(dialog?.element?.querySelector('[data-bf-reminder]')) };
      press(dialog, mode);
      const msg = await waitAttackAfter(before);
      return { dialog, usageId, msg, seen, originId: msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id };
    };
    const ensureVexed = async () => {
      // Vex the victim with the rapier (Vex is its 2024 mastery) — a programmatic hit, no dialog.
      const act = attackOf(rapier);
      await rapier.update({ 'system.mastery': 'vex' });
      await healFull();
      target(victimToken);
      face(19);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': results.message.id } } : {});
      const attackMsg = rolls?.[0]?.parent ?? null;
      const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
      await waitFor(() => damageFor(originId)?.getFlag(MOD, 'receipt'), 10000);
      // ⚠ masteryRiders is OFF (no chips from the mastery machine); press Vexed by hand instead —
      // the gate reads the chip, not who wrote it.
      const [vexed] = await victim.createEmbeddedDocuments('ActiveEffect', [{
        name: 'Vexed', img: 'icons/svg/eye.svg', origin: rapier.uuid, transfer: false,
        // ⚠ NO clock: out of combat a one-round window never resolves and the gate reads the chip as
        // DEAD (decide/chips.js chipIsDead) — a clockless chip is left alone, which is what this needs.
        flags: { [MOD]: { mastery: 'vex' } }
      }]);
      return vexed;
    };
    const answerSave = async () => {
      const el = await waitFor(saveDialogEl, 8000);
      el?.querySelector('button[data-action="normal"]')?.click();
      return !!el;
    };
    const cardsWith = flagKey => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, flagKey));

    // ================================================== 1. the gate
    if (want(1)) {
      await clearChips();
      const vexed = await ensureVexed();
      ok('1. (setup) the victim is Vexed by the rogue', !!vexed, `vexed=${!!vexed}`);
      const { msg, seen } = await armedSwing(rapier, { mode: 'advantage' });
      const text = seen.boxText;
      ok('1a. the gate carries the Sneak Attack box under the sources: the dice, the rule, the read-for-you line',
        !!text && /Sneak Attack — 7d6 on a hit, once per turn/.test(text) && /Once per turn, you can deal an extra/.test(text)
          && /Rapier is Finesse ✓/.test(text) && /nets Advantage ✓/.test(text) && /chosen after the hit/.test(text),
        text.slice(0, 260));
      ok("1b. the box is OUTSIDE the fold — visible without a click, and ticked by the roll's Advantage", !!text && !seen.boxInDetails && seen.ticked,
        `inDetails=${seen.boxInDetails} ticked=${seen.ticked} section="${seen.sectionText.slice(0, 120)}"`);
      const s = msg?.getFlag(MOD, 'sneak');
      ok('1c. Advantage ticks it by default; the press records the arm on the attack message — dice, type, weapon',
        !!s && (s.armed === true) && (s.dice === '7d6') && (s.number === 7) && (s.faces === 6) && (s.type === 'piercing')
          && (s.weaponName === 'Rapier') && (s.mode === 'advantage') && ('combat' in s) && (s.sourceUuid === rogue.uuid),
        JSON.stringify(s));
      const cardText = await waitFor(() => { const t = textOf(document.querySelector(`.message[data-message-id="${msg?.id}"]`)); return /Sneak Attack armed/.test(t) ? t : null; }, 4000);
      ok('1d. the attack card says it: Sneak Attack armed — 7d6 on the hit', /Sneak Attack armed — 7d6 on the hit, once per turn/.test(cardText ?? ''), (cardText ?? '').slice(0, 200));
      // the offer opened (auto damage) — dismiss it to roll and let the chain land before §2
      const offer = await waitFor(offerEl, 6000);
      offer?.querySelector('button[data-action="roll"]')?.click();
      await waitFor(() => damageFor(msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id)?.getFlag(MOD, 'receipt'), 10000);
      await sleep(500);
    }

    // ================================================== 2. the switches
    if (want(2)) {
      await clearChips();
      // 2a: a longsword — neither Finesse nor ranged — offers no box; with no other source the dialog
      // is not even forced (the roll goes out natively under a fast-forward, as before).
      const { dialog: d2a, before: b2a } = await openGate(longsword);
      const noBox = !boxOf(d2a);
      ok('2a. a longsword offers no Sneak Attack — no box', !!d2a && noBox, `dialog=${!!d2a} box=${!noBox}`);
      if (d2a) { press(d2a, 'normal'); await waitAttackAfter(b2a); }
      await waitFor(() => cardsWith('receipt').length, 8000);
      await sleep(400);
      // 2b: the list is the switch — without `sneak` the rapier offers no box either.
      await set('reminderList', 'vex, sap, prone, condition, range, effect');
      const vexed = await ensureVexed();
      const { dialog: d2b, before: b2b } = await openGate(rapier);
      ok('2b. the Reminder Sources list is the switch: without sneak, the rapier offers no box — the Vex source still shows',
        !!vexed && !!d2b && !boxOf(d2b) && /Vexed/.test(textOf(d2b?.element?.querySelector('[data-bf-reminder]'))),
        `dialog=${!!d2b} box=${!!boxOf(d2b)}`);
      if (d2b) { press(d2b, 'advantage'); await waitAttackAfter(b2b); }
      await sleep(600);
      await set('reminderList', 'vex, sap, prone, condition, range, effect, sneak');
    }

    // ================================================== 3. the offer and the menu
    let msg3 = null;
    let originId3 = null;
    if (want(3)) {
      await clearChips();
      await ensureVexed();
      const { msg } = await armedSwing(rapier, { mode: 'advantage', tick: true });
      msg3 = msg;
      originId3 = msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id;
      const offer = await waitFor(offerEl, 6000);
      const menu = offer?.querySelector('[data-bf-cunning]');
      const rows = [...(menu?.querySelectorAll('[data-bf-cunning-row]') ?? [])].map(r => r.dataset.bfCunningRow);
      ok('3a. an armed Sneak Attack opens the damage offer under AUTO damage, and the offer carries the Cunning Strike menu',
        !!offer && !!menu, `offer=${!!offer} menu=${!!menu}`);
      ok('3b. the menu is READ OFF THE SHEET: Cunning Strike, Devious Strikes, and the Thief\'s Stealth Attack; up to two; DC 17',
        (rows.join() === 'poison,trip,withdraw,daze,knockOut,obscure,stealthAttack') && /up to 2/.test(textOf(menu)) && /Save DC 17/.test(textOf(menu)),
        `rows=[${rows.join()}] text="${textOf(menu).slice(0, 160)}"`);
      const box = key => offer?.querySelector(`input[name="bf-cunning"][value="${key}"]`);
      const button = () => offer?.querySelector('button[data-action="roll"]');
      box('knockOut')?.click();
      await sleep(50);
      const afterKnockOut = textOf(button());
      box('poison')?.click();
      await sleep(50);
      const afterBoth = textOf(button());
      box('trip')?.click();   // a third pick: the OLDEST (Knock Out) gives way
      await sleep(50);
      ok('3c. the button names the formula the pick leaves: Knock Out → 1d6; Knock Out + Poison → every die forgone',
        /Sneak Attack 1d6/.test(afterKnockOut) && /every Sneak Attack die forgone/.test(afterBoth),
        `knockOut="${afterKnockOut}" both="${afterBoth}"`);
      ok('3d. the pick stays legal: a third tick drops the oldest (Knock Out), leaving Poison + Trip',
        !box('knockOut')?.checked && !!box('poison')?.checked && !!box('trip')?.checked && /Sneak Attack 5d6/.test(textOf(button())),
        `knockOut=${box('knockOut')?.checked} poison=${box('poison')?.checked} trip=${box('trip')?.checked} button="${textOf(button())}"`);
      // settle on Trip alone for §4
      box('poison')?.click();
      await sleep(50);
      ok('3e. …and untick Poison: Trip alone, 6d6 left', !box('poison')?.checked && /Sneak Attack 6d6/.test(textOf(button())), textOf(button()));
      button()?.click();
    }

    // ================================================== 4. the dice and the Trip
    if (want(4)) {
      const dmg = await waitFor(() => { const d = damageFor(originId3); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      const sd = dmg?.getFlag(MOD, 'sneakDamage');
      const formulas = (dmg?.rolls ?? []).map(r => r.formula);
      ok('4a. the sneak dice ride the weapon\'s damage roll as their own part — 6d6 piercing after Trip\'s 1d6',
        !!dmg && formulas.some(f => /^6d6$/.test(f)) && (dmg.rolls.find(r => /^6d6$/.test(r.formula))?.options?.type === 'piercing'),
        `formulas=[${formulas.join(' | ')}] types=[${(dmg?.rolls ?? []).map(r => r.options?.type).join()}]`);
      ok('4b. the damage message records it: formula 6d6, cost 1, Trip, DC 17 — and the attack message is marked rolled',
        !!sd && (sd.formula === '6d6') && (sd.cost === 1) && (sd.cunning?.[0]?.key === 'trip') && (sd.dc === 17)
          && (game.messages.get(msg3?.id)?.getFlag(MOD, 'sneak')?.rolled === true),
        JSON.stringify(sd));
      const receipt = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid);
      const total = (dmg?.rolls ?? []).reduce((n, r) => n + (r.total ?? 0), 0);
      ok('4c. one roll, one receipt: the victim took the weapon and the sneak dice together',
        !!receipt && (receipt.taken === total) && (total > 6), `taken=${receipt?.taken} total=${total}`);
      const cardText = await waitFor(() => { const t = textOf(document.querySelector(`.message[data-message-id="${dmg?.id}"]`)); return /rode this roll/.test(t) ? t : null; }, 4000);
      ok('4d. the damage card says what rode and what was forgone', /6d6 rode this roll/.test(cardText ?? '') && /1d forgone for Trip/.test(cardText ?? ''), (cardText ?? '').slice(0, 200));
      // the Trip: a save demand on the Cunning Strike item's own activity, at the victim
      const tripCard = await waitFor(() => cardsWith('cunning').find(m => m.getFlag(MOD, 'cunning')?.key === 'trip' && m.getFlag(MOD, 'saves')), 10000);
      const saves = tripCard?.getFlag(MOD, 'saves');
      ok('4e. the Trip effect goes through the saves machine: the demand on Cunning Strike\'s own Trip activity, Dex save DC 17, at the victim',
        !!tripCard && (saves?.abilities?.join() === 'dex') && (saves?.dc === 17) && (saves?.targets?.[0]?.uuid === victim.uuid)
          && (tripCard.getFlag(MOD, 'cunning')?.attackId === msg3?.id),
        `card=${!!tripCard} abilities=${saves?.abilities?.join()} dc=${saves?.dc} target=${saves?.targets?.[0]?.name}`);
      const answered = await answerSave();
      await waitFor(() => tripCard?.getFlag(MOD, 'saves')?.targets?.every(t => t.done && t.applied), 15000);
      const entry = tripCard?.getFlag(MOD, 'saves')?.targets?.[0];
      const er = tripCard?.getFlag(MOD, 'effectReceipt')?.targets?.find(t => t.uuid === victim.uuid);
      ok('4f. the victim fails (-30) and lands Prone through the pack\'s own effect, receipted on the demand card',
        answered && (entry?.outcome === 'failed') && victim.statuses?.has?.('prone') && !!er?.effects?.some(e => /Tripped/.test(e.name)),
        `answered=${answered} outcome=${entry?.outcome} prone=${victim.statuses?.has?.('prone')} receipt=${JSON.stringify(er?.effects?.map(e => e.name))}`);
      await clearChips();
    }

    // ================================================== 5. the crit
    if (want(5)) {
      await clearChips();
      await ensureVexed();
      const { msg } = await armedSwing(rapier, { mode: 'advantage', tick: true, d20: 20 });
      const originId = msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id;
      ok('5. (setup) the forced 20 crit', msg?.rolls?.[0]?.isCritical === true, `crit=${msg?.rolls?.[0]?.isCritical}`);
      const offer = await waitFor(offerEl, 6000);
      offer?.querySelector('input[name="bf-cunning"][value="knockOut"]')?.click();
      await sleep(50);
      offer?.querySelector('button[data-action="roll"]')?.click();
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      const sneakRoll = (dmg?.rolls ?? []).find(r => r.dice.some(d => d.faces === 6));
      const sixes = sneakRoll?.dice?.filter(d => d.faces === 6).reduce((n, d) => n + d.number, 0) ?? 0;
      ok('5a. Knock Out forgoes six dice; the crit doubles the ONE that is left — two d6 rolled, not fourteen',
        !!sneakRoll && (sixes === 2) && (dmg?.getFlag(MOD, 'sneakDamage')?.formula === '1d6') && dmg?.rolls?.[0]?.isCritical,
        `sixes=${sixes} formula=${dmg?.getFlag(MOD, 'sneakDamage')?.formula} crit=${dmg?.rolls?.[0]?.isCritical} rolls=[${(dmg?.rolls ?? []).map(r => r.formula).join(' | ')}]`);
      const koCard = await waitFor(() => cardsWith('cunning').find(m => m.getFlag(MOD, 'cunning')?.key === 'knockOut' && m.getFlag(MOD, 'saves')), 10000);
      ok('5b. Knock Out demands its Con save through the saves machine', (koCard?.getFlag(MOD, 'saves')?.abilities?.join() === 'con'), `abilities=${koCard?.getFlag(MOD, 'saves')?.abilities?.join()}`);
      await answerSave();
      await waitFor(() => koCard?.getFlag(MOD, 'saves')?.targets?.every(t => t.done && t.applied), 15000);
      ok('5c. …and the failure lands Unconscious', victim.statuses?.has?.('unconscious'), `unconscious=${victim.statuses?.has?.('unconscious')}`);
      await clearChips();
      face(19);
    }

    // ================================================== 6. once per turn
    if (want(6)) {
      await clearChips();
      if (game.combat) await game.combat.delete();
      combat = await Combat.create({ scene: scene.id });
      await combat.createEmbeddedDocuments('Combatant', [
        { actorId: rogue.id, tokenId: rogueDoc.id, sceneId: scene.id, initiative: 30 },
        { actorId: victim.id, tokenId: victimDoc.id, sceneId: scene.id, initiative: 20 }
      ]);
      await combat.startCombat();
      await sleep(500);
      await ensureVexed();
      const { msg: m1 } = await armedSwing(rapier, { mode: 'advantage', tick: true });
      const o1 = m1?.getFlag('dnd5e', 'originatingMessage') ?? m1?.id;
      (await waitFor(offerEl, 6000))?.querySelector('button[data-action="roll"]')?.click();
      await waitFor(() => damageFor(o1)?.getFlag(MOD, 'receipt'), 12000);
      const chit = await waitFor(() => rogue.effects.find(e => e.getFlag(MOD, 'mastery') === 'sneak'), 6000);
      ok('6a. dealing the damage in combat writes the once-per-turn chit on the rogue, stamped with the turn in progress',
        !!chit && (chit.name === 'Sneak Attack — used this turn') && (chit.start?.round === combat.round) && (chit.start?.turn === combat.turn),
        `chit=${chit?.name} start=${JSON.stringify(chit?.start ? { round: chit.start.round, turn: chit.start.turn } : null)} combat=r${combat.round}t${combat.turn}`);
      await ensureVexed();
      const { msg: m2, seen: seen2 } = await armedSwing(rapier, { mode: 'advantage' });
      ok('6b. the second swing this turn shows the box greyed with the reason, and no tick',
        !!seen2.boxText && /used this turn/.test(seen2.boxText) && !seen2.hasTick, `text="${seen2.boxText.slice(0, 120)}" tick=${seen2.hasTick}`);
      const o2 = m2?.getFlag('dnd5e', 'originatingMessage') ?? m2?.id;
      const dmg2 = await waitFor(() => { const d = damageFor(o2); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      ok('6c. …not armed: auto damage rolls straight (no offer), and no sneak dice ride',
        (m2?.getFlag(MOD, 'sneak')?.armed === false) && !!dmg2 && !dmg2.getFlag(MOD, 'sneakDamage') && !offerEl(),
        `armed=${m2?.getFlag(MOD, 'sneak')?.armed} sneakDamage=${!!dmg2?.getFlag(MOD, 'sneakDamage')} offer=${!!offerEl()}`);
      await combat.nextTurn(); await sleep(600);   // the victim's turn
      await combat.nextTurn(); await sleep(600);   // the rogue's next turn — round 2
      await ensureVexed();
      const { dialog: d3, before: b3 } = await openGate(rapier);
      ok('6d. the next turn offers the tick again — the chit died with the turn it was written in',
        !!tickOf(d3) && (combat.round === 2), `tick=${!!tickOf(d3)} round=${combat.round}`);
      if (d3) { const t = tickOf(d3); if (t?.checked) t.click(); press(d3, 'advantage'); await waitAttackAfter(b3); }
      await sleep(800);
      await combat.delete(); combat = null;
      await clearChips();
    }

    // ================================================== 7. Envenom Weapons
    if (want(7)) {
      await clearChips();
      const pack = game.packs.get('dnd-players-handbook.classes');
      const idx = await pack.getIndex();
      const src = idx.find(e => e.name === 'Envenom Weapons');
      const data = src ? (await pack.getDocument(src._id)).toObject() : null;
      if (!data) { skips.push('§7: Envenom Weapons not in the PHB pack'); }
      else {
        delete data._id;
        const [envenom] = await rogue.createEmbeddedDocuments('Item', [data]);
        created.items.push({ actorId: rogue.id, id: envenom.id });
        await ensureVexed();
        const { msg } = await armedSwing(rapier, { mode: 'advantage', tick: true });
        const originId = msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id;
        const offer = await waitFor(offerEl, 6000);
        const label = textOf(offer?.querySelector('[data-bf-cunning-row="poison"]'));
        ok('7a. the menu shows Poison upgraded by Envenom Weapons', /Poison \(Envenom Weapons\)/.test(label), label.slice(0, 120));
        offer?.querySelector('input[name="bf-cunning"][value="poison"]')?.click();
        await sleep(50);
        offer?.querySelector('button[data-action="roll"]')?.click();
        await waitFor(() => damageFor(originId)?.getFlag(MOD, 'receipt'), 12000);
        const card = await waitFor(() => cardsWith('cunning').find(m => m.getFlag(MOD, 'cunning')?.key === 'poison' && m.getFlag(MOD, 'saves')), 10000);
        const c = card?.getFlag(MOD, 'cunning');
        const s = card?.getFlag(MOD, 'saves');
        ok('7b. the demand is Envenom Weapons\' own Poison activity — Con save, its 2d8 on a failure — and the follow-up is armed: Poisoned on top',
          !!card && (s?.abilities?.join() === 'con') && (s?.hasDamage === true) && (s?.damageOnSave === 'none')
            && (c?.onFail === 'poisoned') && !!c?.effectUuid && (card.getAssociatedItem?.()?.name === 'Envenom Weapons'),
          `abilities=${s?.abilities?.join()} hasDamage=${s?.hasDamage} onSave=${s?.damageOnSave} onFail=${c?.onFail} item=${card?.getAssociatedItem?.()?.name}`);
        const hpBefore = victim.system.attributes.hp.value;
        await answerSave();
        await waitFor(() => card?.getFlag(MOD, 'saves')?.targets?.every(t => t.done && t.applied), 15000);
        await waitFor(() => card?.getFlag(MOD, 'cunning')?.applied?.includes?.(victim.uuid) && victim.statuses?.has?.('poisoned'), 10000);
        const er = card?.getFlag(MOD, 'effectReceipt')?.targets?.find(t => t.uuid === victim.uuid);
        const poisonDmg = await waitFor(() => damageFor(card?.id)?.getFlag(MOD, 'receipt'), 8000);
        ok('7c. the failure takes the 2d8 (the saves machine) AND Poisoned (the follow-up), both receipted on the demand card',
          victim.statuses?.has?.('poisoned') && !!er?.effects?.some(e => /Poisoned/.test(e.name)) && !!poisonDmg
            && (victim.system.attributes.hp.value < hpBefore),
          `poisoned=${victim.statuses?.has?.('poisoned')} effects=${JSON.stringify(er?.effects?.map(e => e.name))} dmgReceipt=${!!poisonDmg} hp=${hpBefore}→${victim.system.attributes.hp.value}`);
        await rogue.deleteEmbeddedDocuments('Item', [envenom.id]);
        await clearChips();
      }
    }

    // ================================================== 8. Death Strike
    if (want(8)) {
      await clearChips();
      const pack = game.packs.get('dnd-players-handbook.classes');
      const idx = await pack.getIndex();
      const src = idx.find(e => e.name === 'Death Strike');
      const data = src ? (await pack.getDocument(src._id)).toObject() : null;
      if (!data) { skips.push('§8: Death Strike not in the PHB pack'); }
      else {
        delete data._id;
        const [ds] = await rogue.createEmbeddedDocuments('Item', [data]);
        created.items.push({ actorId: rogue.id, id: ds.id });
        if (game.combat) await game.combat.delete();
        combat = await Combat.create({ scene: scene.id });
        await combat.createEmbeddedDocuments('Combatant', [
          { actorId: rogue.id, tokenId: rogueDoc.id, sceneId: scene.id, initiative: 30 },
          { actorId: victim.id, tokenId: victimDoc.id, sceneId: scene.id, initiative: 20 }
        ]);
        await combat.startCombat();
        await sleep(500);
        await ensureVexed();
        const { msg } = await armedSwing(rapier, { mode: 'advantage', tick: true });
        const originId = msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id;
        (await waitFor(offerEl, 6000))?.querySelector('button[data-action="roll"]')?.click();
        const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
        const taken = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid)?.taken ?? 0;
        const card = await waitFor(() => cardsWith('cunning').find(m => m.getFlag(MOD, 'cunning')?.key === 'deathStrike' && m.getFlag(MOD, 'saves')), 10000);
        ok('8a. a Sneak Attack hit on round one demands Death Strike\'s Con save — from the feature\'s own activity',
          !!card && (card.getFlag(MOD, 'saves')?.abilities?.join() === 'con') && (card.getFlag(MOD, 'cunning')?.onFail === 'double') && (combat.round === 1),
          `card=${!!card} abilities=${card?.getFlag(MOD, 'saves')?.abilities?.join()} round=${combat.round}`);
        const hpBefore = victim.system.attributes.hp.value;
        await answerSave();
        await waitFor(() => card?.getFlag(MOD, 'saves')?.targets?.every(t => t.done && t.applied), 15000);
        const again = await waitFor(() => card?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid), 10000);
        ok('8b. the failure lands the attack\'s damage AGAIN — the same amount, receipted on the demand card and said',
          !!again && (again.taken === taken) && /Death Strike/.test(again.note ?? '') && (victim.system.attributes.hp.value === hpBefore - taken),
          `first=${taken} again=${again?.taken} note="${again?.note}" hp=${hpBefore}→${victim.system.attributes.hp.value}`);
        await combat.delete(); combat = null;
        await rogue.deleteEmbeddedDocuments('Item', [ds.id]);
        await clearChips();
      }
    }

    // ================================================== 9. the registrations FIRED
    if (want(9)) {
      ok('9a. dnd5e.preRollDamageV2 fired (the rider\'s hook)', count('dnd5e.preRollDamageV2') > 0, `count=${count('dnd5e.preRollDamageV2')}`);
      ok('9b. dnd5e.rollDamageV2 fired (the effects\' hook)', count('dnd5e.rollDamageV2') > 0, `count=${count('dnd5e.rollDamageV2')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'sneak', out, plan, f });
