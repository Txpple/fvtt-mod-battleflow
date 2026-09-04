// Battle Flow hit-menu smoke test — THE PROTOTYPE, BUILT AS DRAWN (user ruling 2026-09-04, "Battle
// Flow Hit Menu": "looks good … just give the cost for the sup die, just like Cunning Strike"):
// on a hit the damage offer carries a Combat Superiority group with the Battle Master's on-hit
// maneuvers read off the sheet, one pick per group, the die riding the damage roll, the pool
// spent, the maneuver's own save through the saves machine, the sweep at a second creature.
// Driven end to end in the live world on the CLONED fighter fixture (BF Test Fighter — Morgash,
// Fighter 5 Battle Master: Combat Superiority, four d8s — tools/fixture-suite.mjs), with the
// eight maneuvers added from the 2024 PHB pack for the run.
//
// Harness discipline: every setting touched is restored; every message this run creates is
// deleted; the items it adds are removed; the pool it spends is refilled; the conditions it
// presses are cleared; the tokens it places are removed.
//
// Sections: `--section 3`, `--section 1,6`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'the offer opens under AUTO damage: the Combat Superiority group, eight rows read off the sheet, the row the name and the cost',
  2: 'one pick per group: the sibling gives way; the summary names what rides',
  3: 'Trip Attack: the die rides as its own part, the pool is spent, the Strength save through the saves machine, Prone pressed on the failure',
  4: 'Menacing Attack: the activity\'s own Frightened lands through the saves machine',
  5: 'Distracting Strike: no save — Distracted applied on the hit, receipted',
  6: 'Sweeping Attack: nothing rides; the POPUP lists the creature within 5 feet; the pick rolls the die and applies it when the attack would hit',
  7: 'no dice left: the offer does not open for the menu; asked for, the rows stay greyed',
  8: 'the Hit Menu list is the switch: an empty list offers nothing',
  9: 'a critical hit doubles the die',
  10: 'the registration FIRED (§11): preRollDamageV2 moved with a maneuver on it'
};
const DEPENDS = { 10: ['3'] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'hitmenu', watchdogMs: 720_000 });
announcePlan('hitmenu', plan, pulled);

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
  if (!game.settings.settings.has(`${MOD}.hitMenuList`)) return { fatal: 'hitMenuList not registered — OLD code (bounce the sandbox)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'saves', 'saveTimer', 'castApply',
    'concMode', 'reminderList', 'maneuverFolds', 'hitMenuList', 'clockRiderList', 'holdTimer'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const second = game.actors.getName('BF Test Attacker');
  const fighter = game.actors.getName('BF Test Fighter');
  if (!scene || !victim || !second || !fighter) return { fatal: 'missing fixture: scene, BF Test Victim, BF Test Attacker or BF Test Fighter — run tools/fixture-suite.mjs' };
  const pool = fighter.items.find(i => i.name === 'Combat Superiority');
  // The clone's own Greataxe (Morgash carries it — plain 1d12 slashing, melee, no rider of its
  // own); the d20-folds Longsword when it stands, else any equipped plain melee weapon.
  const sword = fighter.items.find(i => (i.type === 'weapon') && (i.name === 'Greataxe'))
    ?? fighter.items.find(i => (i.type === 'weapon') && (i.name === 'Longsword'))
    ?? fighter.items.find(i => (i.type === 'weapon') && i.system.equipped && (i.system.attack?.type?.value !== 'ranged'));
  if (!pool || !sword) return { fatal: 'the fighter fixture lacks Combat Superiority or a melee weapon — run tools/fixture-suite.mjs' };
  log.push(`weapon: ${sword.name}`);

  const created = { items: [], tokens: [] };
  const priorActor = {};
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const STATUSES = ['prone', 'frightened'];
  const clearChips = async () => {
    for (const a of [victim, second, fighter]) {
      const chips = a.effects.filter(e => e.getFlag(MOD, 'mastery') || /^(Distracted|Goaded|Frightened|Prone)/.test(e.name)
        || STATUSES.some(s => e.statuses?.has?.(s)));
      const live = chips.map(e => e.id).filter(id => a.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
    }
  };
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      const ours = app.element?.querySelector?.('[data-bf-reminder], [data-bf-save-demand], [data-bf-hit]')
        || /RollConfigurationDialog/.test(app.constructor?.name ?? '')
        || (app.element?.innerHTML ?? '').includes('Damage — your roll');
      if (ours) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const priorPoolSpent = pool.system._source.uses?.spent ?? 0;
  const refill = () => pool.update({ 'system.uses.spent': 0 });
  const poolLeft = () => fighter.items.get(pool.id)?.system.uses?.value ?? -1;
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
      const live = created.items.filter(id => fighter.items.get(id));
      if (live.length) await fighter.deleteEmbeddedDocuments('Item', live);
      await pool.update({ 'system.uses.spent': priorPoolSpent });
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
    await set('playerRollDamage', false);   // AUTO damage: the offer must open for an affordable maneuver anyway
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
    await set('holdTimer', 0);              // the sweep popup waits for a press (the hold family's clock)
    await set('reminderList', '');          // no gate: the swing rolls straight
    await set('maneuverFolds', '');         // no Precision offer on a miss that should not happen
    await set('clockRiderList', '');
    await set('hitMenuList', 'Trip Attack, Goading Attack, Menacing Attack, Pushing Attack, Disarming Attack, Distracting Strike, Maneuvering Attack, Sweeping Attack');

    // -------------------------------------------------- fixtures
    const MANEUVERS = ['Trip Attack', 'Goading Attack', 'Menacing Attack', 'Pushing Attack', 'Disarming Attack', 'Distracting Strike', 'Maneuvering Attack', 'Sweeping Attack'];
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
    log.push(`pool: ${poolLeft()} superiority dice`);

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => [victim.id, second.id, fighter.id].includes(t.actorId)).map(t => t.id);
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
    const { token: victimToken } = await placeToken(victim, 1500, 1600);
    const { token: secondToken } = await placeToken(second, 1500, 1700);   // one square below the victim — 5 feet
    const { token: fighterToken } = await placeToken(fighter, 1400, 1600);
    fighterToken.control({ releaseOthers: true });

    for (const a of [victim, second]) {
      priorActor[a.id] = {
        'system.attributes.ac.calc': a.system._source.attributes.ac.calc,
        'system.attributes.ac.flat': a.system._source.attributes.ac.flat,
        'system.abilities.str.bonuses.save': a.system._source.abilities?.str?.bonuses?.save ?? '',
        'system.abilities.wis.bonuses.save': a.system._source.abilities?.wis?.bonuses?.save ?? '',
        'system.attributes.hp.value': a.system._source.attributes.hp.value,
        'system.attributes.hp.max': a.system._source.attributes.hp.max
      };
      // AC 1 so every forced 19 hits (and the sweep's verdict is a hit); a deep pool so nobody
      // dies under a longsword; the saves forced to fail.
      await a.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1,
        'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400,
        'system.abilities.str.bonuses.save': '-30', 'system.abilities.wis.bonuses.save': '-30' });
    }
    const healFull = async () => {
      for (const a of [victim, second]) {
        await a.update({ 'system.attributes.hp.value': a.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });
        const down = a.effects.filter(e => ['dead', 'unconscious'].some(s => e.statuses?.has?.(s)));
        if (down.length) await a.deleteEmbeddedDocuments('ActiveEffect', down.map(e => e.id)).catch(() => {});
      }
    };
    const attack = sword.system.activities.find(a => a.type === 'attack');

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const face = (n, faces = 20) => { CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces); };
    const target = token => token.setTarget(true, { releaseOthers: true });
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const offerEl = () => [...foundry.applications.instances.values()].map(a => a.element)
      .find(el => (el?.innerHTML ?? '').includes('Damage — your roll')) ?? null;
    const saveDialogEl = () => [...foundry.applications.instances.values()]
      .filter(app => app.rendered && app.element?.querySelector?.('[data-bf-save-demand]')).map(app => app.element)[0] ?? null;
    const damageFor = originId => game.messages.contents.find(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
      && (m.getFlag('dnd5e', 'originatingMessage') === originId));
    const cardsWith = flagKey => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, flagKey));
    /** A programmatic hit with the longsword at the victim — no dialog; the offer is the machine's to open. */
    const swing = async ({ d20 = 19 } = {}) => {
      await healFull();
      target(victimToken);
      await sleep(80);
      face(d20);
      const results = await attack.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const rolls = await attack.rollAttack({}, { configure: false }, usageId ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      return { msg, originId: msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id };
    };
    const menuOf = offer => offer?.querySelector('[data-bf-hit]') ?? null;
    const box = (offer, key) => offer?.querySelector(`input[name="bf-hit"][value="${key}"]`) ?? null;
    const rollButton = offer => offer?.querySelector('button[data-action="roll"]') ?? null;
    const answerSave = async () => {
      const el = await waitFor(saveDialogEl, 8000);
      el?.querySelector('button[data-action="normal"]')?.click();
      return !!el;
    };
    /** Swing, pick one maneuver on the offer, roll; return the attack, the damage message and its stamp. */
    const swingWith = async (key, { d20 = 19 } = {}) => {
      const { msg, originId } = await swing({ d20 });
      const offer = await waitFor(offerEl, 6000);
      if (key) box(offer, key)?.click();
      await sleep(60);
      rollButton(offer)?.click();
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      return { msg, originId, dmg, hm: dmg?.getFlag(MOD, 'hitManeuver') ?? null };
    };
    const settle = async () => { await sleep(400); await clearChips(); await healFull(); };

    // ================================================== 1. the offer and the rows
    if (want(1)) {
      await refill();
      const { msg } = await swing();
      const offer = await waitFor(offerEl, 6000);
      const menu = menuOf(offer);
      const rows = [...(menu?.querySelectorAll('[data-bf-hit-row]') ?? [])].map(r => r.dataset.bfHitRow);
      ok('1a. a hit with a Superiority Die left opens the damage offer under AUTO damage, and the offer carries the hit menu',
        !!msg && !!offer && !!menu, `attack=${!!msg} offer=${!!offer} menu=${!!menu}`);
      ok('1b. the group is Combat Superiority, tagged with the dice left and the die read off the sheet: 4 × 1d8',
        /Combat Superiority/.test(textOf(menu)) && /4 × 1d8 left/.test(textOf(menu)), textOf(menu).slice(0, 160));
      ok('1c. eight rows, read off the sheet in table order',
        rows.join() === 'trip-attack,goading-attack,menacing-attack,pushing-attack,disarming-attack,distracting-strike,maneuvering-attack,sweeping-attack',
        rows.join());
      const trip = menu?.querySelector('[data-bf-hit-row="trip-attack"]');
      const tripText = textOf(trip);
      ok('1d. the row is the name and the cost — "1d8 Superiority Die" — the save left to the rule under it (user, 2026-09-04)',
        /Trip Attack/.test(tripText) && /1d8 Superiority Die/i.test(tripText) && !/Strength/.test(tripText.replace(/the rule.*$/, ''))
          && /Large or smaller/.test(tripText),
        tripText.slice(0, 200));
      ok('1e. the offer\'s line says what the menu is for',
        /Maneuvers/.test(textOf(offer)) && /one maneuver per attack/.test(textOf(offer)), textOf(offer).slice(0, 200));
      rollButton(offer)?.click();
      await waitFor(() => damageFor(msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id)?.getFlag(MOD, 'receipt'), 12000);
      await settle();
    }

    // ================================================== 2. one pick per group
    if (want(2)) {
      await refill();
      const { msg } = await swing();
      const offer = await waitFor(offerEl, 6000);
      const summary = () => textOf(offer?.querySelector('[data-bf-hit-summary]'));
      const before = summary();
      box(offer, 'trip-attack')?.click();
      await sleep(50);
      const afterTrip = summary();
      box(offer, 'goading-attack')?.click();
      await sleep(50);
      ok('2a. nothing ticked: the summary says the weapon rolls alone; Trip ticked: the summary names it',
        /weapon rolls alone/.test(before) && /Trip Attack/.test(afterTrip) && /1d8 Superiority Die rides/.test(afterTrip),
        `before="${before}" trip="${afterTrip}"`);
      ok('2b. a second tick in the group unticks the first — one maneuver per attack',
        !box(offer, 'trip-attack')?.checked && !!box(offer, 'goading-attack')?.checked && /Goading Attack/.test(summary()) && !/Trip Attack/.test(summary()),
        `trip=${box(offer, 'trip-attack')?.checked} goading=${box(offer, 'goading-attack')?.checked} summary="${summary()}"`);
      box(offer, 'goading-attack')?.click();
      await sleep(50);
      ok('2c. untick it: nothing rides again', !box(offer, 'goading-attack')?.checked && /weapon rolls alone/.test(summary()), summary());
      rollButton(offer)?.click();
      const dmg = await waitFor(() => { const d = damageFor(msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      ok('2d. no pick: no maneuver on the damage message, the pool untouched, the attack message records the empty pick',
        !!dmg && !dmg.getFlag(MOD, 'hitManeuver') && (poolLeft() === 4) && (game.messages.get(msg?.id)?.getFlag(MOD, 'hitPick')?.key === null),
        `hm=${!!dmg?.getFlag(MOD, 'hitManeuver')} pool=${poolLeft()} pick=${JSON.stringify(game.messages.get(msg?.id)?.getFlag(MOD, 'hitPick'))}`);
      await settle();
    }

    // ================================================== 3. Trip Attack
    if (want(3)) {
      await refill();
      const { msg, dmg, hm } = await swingWith('trip-attack');
      const formulas = (dmg?.rolls ?? []).map(r => r.formula);
      const part = (dmg?.rolls ?? []).find(r => /^1d8$/.test(r.formula));
      ok('3a. the die rides the weapon\'s damage roll as its own part — 1d8 slashing',
        !!dmg && !!part && (part.options?.type === 'slashing'), `formulas=[${formulas.join(' | ')}] type=${part?.options?.type}`);
      ok('3b. the damage message records it: Trip Attack, 1d8, one Superiority Die spent, 3 left — and the attack message is marked rolled',
        !!hm && (hm.key === 'trip-attack') && (hm.formula === '1d8') && hm.rides && (hm.poolLeft === 3) && hm.save && (hm.onFail === 'prone')
          && (game.messages.get(msg?.id)?.getFlag(MOD, 'hitPick')?.rolled === true),
        JSON.stringify(hm));
      ok('3c. the pool is spent on the sheet: 3 of 4 left', poolLeft() === 3, `pool=${poolLeft()}`);
      const receipt = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid);
      const total = (dmg?.rolls ?? []).reduce((n, r) => n + (r.total ?? 0), 0);
      ok('3d. one roll, one receipt: the victim took the weapon and the die together', !!receipt && (receipt.taken === total), `taken=${receipt?.taken} total=${total}`);
      const cardText = await waitFor(() => { const t = textOf(document.querySelector(`.message[data-message-id="${dmg?.id}"]`)); return /rode this roll/.test(t) ? t : null; }, 4000);
      ok('3e. the damage card says what rode: Trip Attack — 1d8 slashing rode this roll · one Superiority Die spent · 3 left',
        /Trip Attack — 1d8 slashing rode this roll/.test(cardText ?? '') && /one Superiority Die spent/.test(cardText ?? '') && /3 left/.test(cardText ?? ''),
        (cardText ?? '').slice(0, 220));
      const card = await waitFor(() => cardsWith('hitManeuverCard').find(m => m.getFlag(MOD, 'hitManeuverCard')?.key === 'trip-attack' && m.getFlag(MOD, 'saves')), 10000);
      const saves = card?.getFlag(MOD, 'saves');
      ok('3f. the save goes through the saves machine: the demand on Trip Attack\'s own Strength Save activity, at the victim, a DC read off the sheet',
        !!card && (saves?.abilities?.join() === 'str') && (saves?.dc > 0) && (saves?.targets?.[0]?.uuid === victim.uuid)
          && (card.getFlag(MOD, 'hitManeuverCard')?.attackId === msg?.id),
        `card=${!!card} abilities=${saves?.abilities?.join()} dc=${saves?.dc} target=${saves?.targets?.[0]?.name}`);
      log.push(`Trip Attack save DC on the demand: ${saves?.dc} (fighter prof ${fighter.system.attributes.prof}, str ${fighter.system.abilities.str.mod}, dex ${fighter.system.abilities.dex.mod})`);
      const answered = await answerSave();
      await waitFor(() => card?.getFlag(MOD, 'saves')?.targets?.every(t => t.done), 15000);
      // The receipt is a QUEUED write that lands after the press — wait on it, not on the status.
      const er = await waitFor(() => game.messages.get(card?.id)?.getFlag(MOD, 'effectReceipt')?.targets?.find(t => (t.uuid === victim.uuid) && t.effects?.length), 12000);
      const applied = card?.getFlag(MOD, 'hitManeuverCard')?.applied?.includes?.(victim.uuid) && victim.statuses?.has?.('prone');
      const entry = card?.getFlag(MOD, 'saves')?.targets?.[0];
      ok('3g. the victim fails (-30) and Prone — the effect the pack left on the ITEM, unlinked — is pressed by the follow-up, receipted on the demand card',
        answered && (entry?.outcome === 'failed') && !!applied && !!er?.effects?.length,
        `answered=${answered} outcome=${entry?.outcome} prone=${victim.statuses?.has?.('prone')} receipt=${JSON.stringify(er?.effects?.map(e => e.name))}`);
      const demandText = textOf(document.querySelector(`.message[data-message-id="${card?.id}"]`));
      ok('3h. the demand card says whose maneuver it is', /Trip Attack — from BF Test Fighter/.test(demandText), demandText.slice(0, 160));
      await settle();
    }

    // ================================================== 4. Menacing Attack
    if (want(4)) {
      await refill();
      const { hm } = await swingWith('menacing-attack');
      ok('4a. Menacing Attack rides and demands', !!hm && (hm.key === 'menacing-attack') && hm.rides && hm.save && !hm.onFail, JSON.stringify(hm));
      const card = await waitFor(() => cardsWith('hitManeuverCard').find(m => m.getFlag(MOD, 'hitManeuverCard')?.key === 'menacing-attack' && m.getFlag(MOD, 'saves')), 10000);
      ok('4b. the Wisdom save through the saves machine', card?.getFlag(MOD, 'saves')?.abilities?.join() === 'wis', `abilities=${card?.getFlag(MOD, 'saves')?.abilities?.join()}`);
      await answerSave();
      await waitFor(() => card?.getFlag(MOD, 'saves')?.targets?.every(t => t.done && t.applied), 15000);
      ok('4c. the failure lands Frightened — the activity\'s own effect, through the saves machine', victim.statuses?.has?.('frightened'), `frightened=${victim.statuses?.has?.('frightened')}`);
      await settle();
    }

    // ================================================== 5. Distracting Strike
    if (want(5)) {
      await refill();
      const { dmg, hm } = await swingWith('distracting-strike');
      ok('5a. Distracting Strike rides, no save, effects on the hit', !!hm && (hm.key === 'distracting-strike') && hm.rides && !hm.save && hm.effects, JSON.stringify(hm));
      // The receipt is a QUEUED write that lands after the effect — wait on it, not on the effect.
      const er = await waitFor(() => game.messages.get(dmg?.id)?.getFlag(MOD, 'effectReceipt')?.targets?.find(t => (t.uuid === victim.uuid) && t.effects?.length), 12000);
      const applied = game.messages.get(dmg?.id)?.getFlag(MOD, 'hitManeuver')?.effectsApplied && victim.effects.some(e => e.name === 'Distracted');
      ok('5b. Distracted lands on the victim on the elect, receipted on the damage card', !!applied && !!er?.effects?.some(e => /Distracted/.test(e.name)),
        `applied=${!!applied} distracted=${victim.effects.some(e => e.name === 'Distracted')} receipt=${JSON.stringify(er?.effects?.map(e => e.name))}`);
      ok('5c. no demand card — nothing to save against', !cardsWith('hitManeuverCard').some(m => m.getFlag(MOD, 'hitManeuverCard')?.key === 'distracting-strike'), '');
      await settle();
    }

    // ================================================== 6. Sweeping Attack
    if (want(6)) {
      await refill();
      const { dmg, hm } = await swingWith('sweeping-attack');
      const formulas = (dmg?.rolls ?? []).map(r => r.formula);
      ok('6a. nothing rides the damage roll — the die is not on it; the pool is spent',
        !!hm && (hm.key === 'sweeping-attack') && (hm.mode === 'sweep') && !hm.rides && !formulas.some(f => /^1d8$/.test(f)) && (poolLeft() === 3),
        `formulas=[${formulas.join(' | ')}] pool=${poolLeft()} hm=${JSON.stringify(hm)}`);
      const card = await waitFor(() => cardsWith('sweepCard')[0], 10000);
      const sc = card?.getFlag(MOD, 'sweepCard');
      ok('6b. the sweep card lists the creature within 5 feet of the target — the second goblin, not the fighter, not the victim',
        !!sc && (sc.candidates?.length === 1) && (sc.candidates[0].uuid === second.uuid) && !sc.chosen,
        `candidates=${JSON.stringify(sc?.candidates?.map(c => c.name))}`);
      // The pick is a POPUP (user, 2026-09-04: "sweeping attack should be a popup choice, its just on
      // the card"): a button per creature and Nobody, the bar, the card's own reopen button.
      // The DIALOG, not the chat log (whose element also carries the card's words).
      const popup = await waitFor(() => [...foundry.applications.instances.values()]
        .find(app => (app instanceof foundry.applications.api.DialogV2) && app.rendered && /pick the second creature/.test(app.element?.innerHTML ?? '')), 6000);
      const pickButton = popup?.element?.querySelector('button[data-action="pick-0"]');
      const nobody = popup?.element?.querySelector('button[data-action="none"]');
      const cardText6 = textOf(document.querySelector(`.message[data-message-id="${card?.id}"]`));
      // holdTimer is 0 here, so no bar drains — the popup waits for a human (a 0 window arms nothing).
      ok('6c. the pick is a popup: one button per creature within 5 feet, and Nobody; the card carries a reopen button; no bar at a 0 window',
        !!popup && !!pickButton && (textOf(pickButton) === 'Hobgoblin') && !!nobody && /Pick — Sweeping Attack/.test(cardText6)
          && !popup.element.querySelector('[data-bf-deadline]'),
        `popup=${!!popup} pick="${textOf(pickButton)}" nobody=${!!nobody} bar=${!!popup?.element?.querySelector('[data-bf-deadline]')} card="${cardText6.slice(-160)}"`);
      const hpBefore = second.system.attributes.hp.value;
      pickButton?.click();
      const resolved = await waitFor(() => game.messages.get(card?.id)?.getFlag(MOD, 'sweepCard')?.resolved, 12000);
      const rollMsg = game.messages.contents.find(m => (m.timestamp >= suiteStart) && /Sweeping Attack — the die/.test(m.flavor ?? ''));
      const receipt = game.messages.get(card?.id)?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === second.uuid);
      ok('6d. the pick rolls the die in the open, judges the ORIGINAL attack roll against the second creature (AC 1 — a hit), and applies it with a receipt',
        !!resolved && (resolved.verdict === 'hit') && (resolved.rolled >= 1) && (resolved.rolled <= 8) && !!rollMsg
          && !!receipt && (receipt.taken === resolved.rolled) && (second.system.attributes.hp.value === hpBefore - resolved.rolled),
        `resolved=${JSON.stringify(resolved)} roll=${!!rollMsg} receipt=${JSON.stringify(receipt)} hp=${hpBefore}→${second.system.attributes.hp.value}`);
      const cardText = textOf(document.querySelector(`.message[data-message-id="${card?.id}"]`));
      ok('6e. the card says it', /the die rolled/.test(cardText) && /would hit, applied/.test(cardText), cardText.slice(0, 200));
      await settle();
    }

    // ================================================== 7. no dice left
    if (want(7)) {
      await pool.update({ 'system.uses.spent': pool.system.uses.max });
      ok('7. (setup) the pool is empty', poolLeft() === 0, `pool=${poolLeft()}`);
      const { msg, originId } = await swing();
      const offer = await waitFor(offerEl, 2500);
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      ok('7a. under AUTO damage the offer does not open for a menu nobody can afford — the damage rolls itself, no maneuver on it',
        !offer && !!dmg && !dmg.getFlag(MOD, 'hitManeuver'), `offer=${!!offer} dmg=${!!dmg} hm=${!!dmg?.getFlag(MOD, 'hitManeuver')} attack=${!!msg}`);
      await settle();
      await set('playerRollDamage', true);
      const { originId: o2 } = await swing();
      const offer2 = await waitFor(offerEl, 6000);
      const menu = menuOf(offer2);
      const boxes = [...(menu?.querySelectorAll('input[name="bf-hit"]') ?? [])];
      ok('7b. asked for, the offer shows the group with "no dice left" and every row greyed',
        !!menu && /no dice left/.test(textOf(menu)) && (boxes.length === 8) && boxes.every(b => b.disabled),
        `menu=${!!menu} text="${textOf(menu).slice(0, 80)}" boxes=${boxes.length} disabled=${boxes.filter(b => b.disabled).length}`);
      rollButton(offer2)?.click();
      await waitFor(() => damageFor(o2)?.getFlag(MOD, 'receipt'), 12000);
      await set('playerRollDamage', false);
      await settle();
    }

    // ================================================== 8. the list is the switch
    if (want(8)) {
      await refill();
      await set('hitMenuList', '');
      const { originId } = await swing();
      const offer = await waitFor(offerEl, 2500);
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      ok('8. an empty Hit Menu list: no offer opens for it, nothing rides', !offer && !!dmg && !dmg.getFlag(MOD, 'hitManeuver'), `offer=${!!offer} hm=${!!dmg?.getFlag(MOD, 'hitManeuver')}`);
      await set('hitMenuList', 'Trip Attack, Goading Attack, Menacing Attack, Pushing Attack, Disarming Attack, Distracting Strike, Maneuvering Attack, Sweeping Attack');
      await settle();
    }

    // ================================================== 9. the crit
    if (want(9)) {
      await refill();
      const { dmg, hm } = await swingWith('goading-attack', { d20: 20 });
      // The crit stamp REWRITES the part's formula (1d8 → 2d8) rather than adding a die to it.
      const part = (dmg?.rolls ?? []).find(r => /^[12]d8$/.test(r.formula));
      const eights = part?.dice?.filter(d => d.faces === 8).reduce((n, d) => n + d.number, 0) ?? 0;
      ok('9. a forced 20: the die is crit-doubled by the same stamp — the maneuver part rolls 2d8',
        !!hm && dmg?.rolls?.[0]?.isCritical && (eights === 2), `crit=${dmg?.rolls?.[0]?.isCritical} eights=${eights} formulas=[${(dmg?.rolls ?? []).map(r => r.formula).join(' | ')}]`);
      const card = await waitFor(() => cardsWith('hitManeuverCard').find(m => m.getFlag(MOD, 'hitManeuverCard')?.key === 'goading-attack' && m.getFlag(MOD, 'saves')), 10000);
      if (card) { await answerSave(); await waitFor(() => card.getFlag(MOD, 'saves')?.targets?.every(t => t.done && t.applied), 15000); }
      // Goaded is the one maneuver effect the pack ships with transfer:true (the table, 2026-09-04:
      // "applying goading attack didnt do anything") — it must still land on the failure.
      const goaded = await waitFor(() => victim.effects.find(e => e.name === 'Goaded'), 8000);
      const gr = game.messages.get(card?.id)?.getFlag(MOD, 'effectReceipt')?.targets?.find(t => t.uuid === victim.uuid);
      ok('9b. the failure lands Goaded — the activity\'s own effect, shipped transfer:true — receipted on the demand card',
        !!goaded && !!gr?.effects?.some(e => /Goaded/.test(e.name)),
        `goaded=${!!goaded} outcome=${card?.getFlag(MOD, 'saves')?.targets?.[0]?.outcome} applied=${card?.getFlag(MOD, 'saves')?.targets?.[0]?.applied} receipt=${JSON.stringify(gr?.effects?.map(e => e.name))} effects=${JSON.stringify(victim.effects.map(e => e.name))}`);
      face(19);
      await settle();
    }

    // ================================================== 10. the registration FIRED
    if (want(10)) {
      ok('10. dnd5e.preRollDamageV2 fired (the rider\'s hook)', count('dnd5e.preRollDamageV2') > 0, `count=${count('dnd5e.preRollDamageV2')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'hitmenu', out, plan, f });
