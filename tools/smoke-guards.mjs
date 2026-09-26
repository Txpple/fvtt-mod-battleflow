// Battle Flow guards smoke test — THE TWO FIGHTING STYLES THAT ANSWER FOR SOMEONE ELSE (the fighting
// styles, 2026-09-26, ruled off prototypes/fighting-styles.html: P1 "each gets a popup", R1 "asked
// after the hit shows"). Protection: a guard beside the creature being hit bends the attack roll
// (Disadvantage, the second d20, the lower standing) and the protected creature carries
// "Protected — <guard>" until the guard's next turn, read by the gate while the guard stays within
// 5 ft. Interception: a guard beside it reduces the attack's damage by 1d10 + PB at the applier.
//
// Fixtures: BF Test Attacker swings at BF Test Halfling; BF Test Fighter stands beside the Halfling
// and is lent the PHB's Protection and Interception feats, a Shield and a Longsword (equipped for
// the run). The Halfling's own Lucky is a second party to the P1 cases. The three tokens are placed
// for the run (the Halfling and the Fighter friendly, the Attacker hostile) and removed after.
//
// Harness discipline: every setting touched is restored; every message this run creates is deleted;
// the lent items, the placed tokens and the Luck Points go back; the Fighter's equipped boxes too.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'hold/trigger.js',        // the guards stamped on the held target
  'hold/answer.js',         // a guard's answer, the parties' passes (P1)
  'hold/dice.js',            // Protection's d20s rise over the creature it guards (2026-09-26)
  'hold/views.js',          // the guard's own popup, the attacker's card naming the guard
  'hold/continue.js',       // "Protected — <guard>" landed at the resolve
  'damage-holds.js',        // Interception: the attack's damage claimed for the guards
  'reminders.js'            // the standing Disadvantage, while the guard stays within 5 ft
];

const SECTIONS = {
  1: 'Protection turns the hit: the guard\'s own popup beside the Halfling\'s Lucky; Answer rolls the second d20, the lower stands, MISS; the card says "Protection (BF Test Fighter) bent the roll"; both popups close',
  2: 'the standing half: "Protected — BF Test Fighter" on the Halfling; the next attack at it meets Disadvantage in the gate while the Fighter is within 5 ft, and not from 15 ft',
  3: 'P1 — a guard\'s pass waits for the others: the Fighter passes, the hold stays open for the Halfling\'s Lucky; the Halfling passes, the hit lands',
  4: 'the guard alone (Lucky spent): the Fighter passes, the hit lands; with no Shield held nobody is asked at all',
  5: 'Interception: the attack\'s damage waits; the Fighter\'s popup "intercept?"; Intercept rolls 1d10 + PB and the damage lands short by it, the receipt says so',
  6: 'Interception passed: the damage lands whole'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'guards', watchdogMs: 600_000 });
announcePlan('guards', plan, pulled);

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
  // The module's own console errors, into the log (a failed answer says why there).
  const errors = [];
  const realError = console.error;
  console.error = (...a) => { errors.push(a.map(x => (x?.stack ?? String(x))).join(' ').slice(0, 400)); realError(...a); };

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  const { INTERRUPT_ROLLS } = await import('/modules/fvtt-mod-battleflow/scripts/decide/registry.js');
  if (!INTERRUPT_ROLLS.Protection) return { fatal: 'Protection is not in the loaded code — OLD code (reload the box)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'interruptList', 'holdTimer', 'holdReveal', 'holdSkipFutile', 'holdApplyEffect', 'riders', 'effectRiders',
    'masteryRiders', 'masteryAsk', 'castApply', 'concMode', 'reminderList', 'damageEitherList', 'fightingStyleList', 'effectList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const halfling = game.actors.getName('BF Test Halfling');
  const fighter = game.actors.getName('BF Test Fighter');
  if (!scene || !attacker || !halfling || !fighter) return { fatal: 'missing fixture: the range, BF Test Attacker, Halfling or Fighter — run tools/fixture-suite.mjs' };
  const lucky = () => halfling.items.find(i => (i.name === 'Lucky') && (Number(i.system?.uses?.max) > 0));

  const created = { tokens: [], items: [] };
  const priorActor = {};
  const equippedBefore = fighter.items.filter(i => i.system?.equipped === true).map(i => i.id);
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const refillLuck = async () => { const l = lucky(); if (l) await l.update({ 'system.uses.spent': 0 }); };
  const spendLuck = async () => { const l = lucky(); if (l) await l.update({ 'system.uses.spent': Number(l.system.uses.max) }); };
  const popups = () => [...foundry.applications.instances.values()].filter(app => app.rendered);
  const guardPopup = () => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-guard"]')) ?? null;
  const rescuePopup = () => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-rescue"]')) ?? null;
  const interceptPopup = () => popups().find(app => /intercept\?/.test(app.element?.textContent ?? '') && app.element?.querySelector?.('button[data-action="cast"]')) ?? null;
  const closeDialogs = async () => {
    for (const app of popups()) {
      if (app.element?.querySelector?.('[data-bf-ticks]') || /intercept\?/.test(app.element?.textContent ?? '')) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const dropProtected = async () => {
    const live = halfling.effects.filter(e => e.getFlag(MOD, 'protectedBy')).map(e => e.id);
    if (live.length) await halfling.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    CONFIG.Dice.randomUniform = realPRNG;
    console.error = realError;
    if (errors.length) log.push(`console errors: ${JSON.stringify(errors.slice(0, 6))}`);
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      await dropProtected();
      await refillLuck();
      const liveItems = created.items.filter(id => fighter.items.get(id));
      if (liveItems.length) await fighter.deleteEmbeddedDocuments('Item', liveItems);
      const back = fighter.items.filter(i => ('equipped' in (i.system ?? {}))).map(i => ({ _id: i.id, 'system.equipped': equippedBefore.includes(i.id) }));
      if (back.length) await fighter.updateEmbeddedDocuments('Item', back);
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
    await set('reactionHold', true);
    const noIntercept = () => def('interruptList').replace(/,\s*Interception:damage/, '');
    await set('interruptList', noIntercept());   // §1–§4 are Protection's; §5–§6 set their own
    await set('holdTimer', 0);
    await set('holdReveal', true);
    await set('holdSkipFutile', false);
    await set('holdApplyEffect', true);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('masteryAsk', false);
    await set('castApply', false);
    await set('concMode', 'off');
    await set('reminderList', '');
    await set('damageEitherList', '');
    await set('fightingStyleList', '');   // the faces are smoke-styles'; this suite is the reactions
    await set('effectList', def('effectList'));
    await refillLuck();

    // -------------------------------------------------- fixtures
    const findPHB = async (name, type) => {
      for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
        const hit = (await pack.getIndex({ fields: ['type'] })).find(e => (e.name === name) && (e.type === type));
        if (hit) return pack.getDocument(hit._id);
      }
      return null;
    };
    const lend = async (name, type, equipped = false) => {
      const source = await findPHB(name, type);
      if (!source) throw new Error(`the PHB ships no ${type} "${name}" this box can find`);
      const data = source.toObject();
      if ('equipped' in (data.system ?? {})) data.system.equipped = equipped;
      const [item] = await fighter.createEmbeddedDocuments('Item', [data]);
      created.items.push(item.id);
      return item;
    };
    const off = fighter.items.filter(i => i.system?.equipped === true).map(i => ({ _id: i.id, 'system.equipped': false }));
    if (off.length) await fighter.updateEmbeddedDocuments('Item', off);
    await lend('Protection', 'feat');
    await lend('Interception', 'feat');
    const shield = await lend('Shield', 'equipment', true);
    await lend('Longsword', 'weapon', true);

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => t.actorLink && [attacker.id, halfling.id, fighter.id].includes(t.actorId)).map(t => t.id);
    if (strays.length) await scene.deleteEmbeddedDocuments('Token', strays);
    const placeToken = async (actor, x, y, disposition) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true, disposition }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const { token: attackerToken } = await placeToken(attacker, 1400, 2100, -1);
    const { token: halflingToken } = await placeToken(halfling, 1500, 2100, 1);
    await placeToken(fighter, 1600, 2100, 1);

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const cardText = id => textOf(document.querySelector(`.message[data-message-id="${id}"]`));
    const weapon = attacker.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => a.type === 'attack'));
    if (!weapon) return { fatal: 'BF Test Attacker has no weapon attack' };
    const act = () => attacker.items.get(weapon.id).system.activities.find(a => a.type === 'attack');
    faces([[10, 20]]);
    const probe = await act().rollAttack({}, { configure: false }, { create: false });
    const atkMod = Number(probe?.[0]?.total) - Number(probe?.[0]?.d20?.total);
    if (!Number.isFinite(atkMod)) return { fatal: `could not measure the attacker's modifier (${probe?.[0]?.total})` };
    const AC = atkMod + 10;
    priorActor[halfling.id] = {
      'system.attributes.ac.override': halfling.system._source.attributes.ac.override ?? null,
      'system.attributes.hp.value': halfling.system._source.attributes.hp.value,
      'system.attributes.hp.max': halfling.system._source.attributes.hp.max
    };
    await halfling.update({ 'system.attributes.ac.override': AC, 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });
    const healFull = () => halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
    const damageFor = id => game.messages.contents.find(m => (m.type === 'damage') && (m.getFlag(MOD, 'attackFor') === id));
    const swing = async ({ d20 = [12], dmg = 3 } = {}) => {
      await healFull();
      attackerToken.control({ releaseOthers: true });
      halflingToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      faces([...d20.map(n => [n, 20]), [dmg, 6]]);
      const usage = await act().use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act().rollAttack({}, { configure: false }, usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      await waitFor(() => msg?.getFlag(MOD, 'hold') || damageFor(msg?.id), 4000);
      return msg;
    };
    const holdOf = msg => game.messages.get(msg?.id)?.getFlag(MOD, 'hold') ?? null;
    const targetOf = msg => holdOf(msg)?.targets?.find(t => t.uuid === halfling.uuid) ?? null;
    const hp = () => Number(halfling.system.attributes.hp.value);

    // ================================================== 1. Protection turns the hit
    if (want(1)) {
      await closeDialogs(); await dropProtected(); await refillLuck();
      const msg = await swing({ d20: [12] });
      const guard = await waitFor(guardPopup, 6000);
      const own = rescuePopup();
      const t0 = targetOf(msg);
      ok('1a. the hit is held with the Fighter on guard; the guard\'s own popup ("Protection · Disadvantage · a Reaction") beside the Halfling\'s Lucky',
        !!guard && !!own && (t0?.guards ?? []).some(g => g.uuid === fighter.uuid) && /Protection/.test(textOf(guard?.element)) && /a Reaction/.test(textOf(guard?.element)),
        `guard=${!!guard} own=${!!own} guards=${JSON.stringify(t0?.guards ?? null)}`);
      faces([[6, 20]]);
      guard?.element?.querySelector('button[data-action="answer"]')?.click();
      const resolved = await waitFor(() => (holdOf(msg)?.status === 'resolved') ? holdOf(msg) : null, 12000);
      const t = resolved?.targets?.find(x => x.uuid === halfling.uuid);
      ok('1b. the second d20 (6) stands: a MISS, answered by the guard (guardedBy the Fighter, rescue Protection)',
        (t?.answer === 'roll') && (t?.verdict === 'miss') && (t?.rescue === 'Protection') && (t?.guardedBy?.uuid === fighter.uuid),
        JSON.stringify({ answer: t?.answer, verdict: t?.verdict, rescue: t?.rescue, by: t?.guardedBy }));
      await sleep(800);
      ok('1c. the attack card: "Protection (BF Test Fighter) bent the roll … MISS"', /Protection \(BF Test Fighter\) bent the roll.*MISS/.test(cardText(msg?.id)),
        cardText(msg?.id).slice(0, 220));
      ok('1d. both popups closed; no damage landed', !guardPopup() && !rescuePopup() && (hp() === 400), `guard=${!!guardPopup()} own=${!!rescuePopup()} hp=${hp()}`);
    }

    // ================================================== 2. the standing half
    if (want(2)) {
      const eff = await waitFor(() => halfling.effects.find(e => e.getFlag(MOD, 'protectedBy') === fighter.uuid), 6000);
      ok('2a. "Protected — BF Test Fighter" on the Halfling', /Protected — BF Test Fighter/.test(eff?.name ?? ''), `effect=${eff?.name ?? null}`);
      await set('reminderList', def('reminderList'));
      const { judgeRoll } = await import('/modules/fvtt-mod-battleflow/scripts/reminders.js');
      const near = judgeRoll(attacker, { activity: act(), targets: [halflingToken] });
      const src = (near?.sources ?? []).find(s => /Protected — BF Test Fighter/.test(s.label));
      // ⚠ and ONLY that row: the spell's "Protected" (Protection from Evil and Good) must not stand for it
      ok('2b. the next attack at the Halfling: Disadvantage in the gate, the row named, the spell\'s "Protected" not matched',
        src?.bend === 'disadvantage' && (near?.net === 'disadvantage') && !(near?.sources ?? []).some(x => / — Protected$/.test(x.label)),
        `net=${near?.net} sources=${JSON.stringify((near?.sources ?? []).map(s => [s.label, s.bend]))}`);
      // Re-placed, not moved: a position update is constrained by the range's walls (it never moved).
      const moveFighter = async x => {
        const live = created.tokens.filter(id => scene.tokens.get(id)?.actorId === fighter.id);
        if (live.length) await scene.deleteEmbeddedDocuments('Token', live);
        await placeToken(fighter, x, 2100, 1);
        await sleep(300);
      };
      await moveFighter(1800);   // 15 ft from the Halfling
      const far = judgeRoll(attacker, { activity: act(), targets: [halflingToken] });
      ok('2c. the Fighter 15 ft away: the row stands down', !(far?.sources ?? []).some(s => /Protected — /.test(s.label) && s.bend),
        `net=${far?.net} sources=${JSON.stringify((far?.sources ?? []).map(s => [s.label, s.bend]))}`);
      await moveFighter(1600);
      await set('reminderList', '');
      await dropProtected();
    }

    // ================================================== 3. P1 — a guard's pass waits for the others
    if (want(3)) {
      await closeDialogs(); await refillLuck();
      const msg = await swing({ d20: [12] });
      const guard = await waitFor(guardPopup, 6000);
      guard?.element?.querySelector('button[data-action="pass"]')?.click();
      await sleep(1200);
      const mid = targetOf(msg);
      ok('3a. the Fighter passes: the hold stays open for the Halfling (guard marked passed, no answer)',
        (holdOf(msg)?.status === 'pending') && !mid?.answer && (mid?.guards ?? []).every(g => g.passed) && !!rescuePopup(),
        JSON.stringify({ status: holdOf(msg)?.status, answer: mid?.answer, guards: mid?.guards, own: !!rescuePopup() }));
      rescuePopup()?.element?.querySelector('button[data-action="pass"]')?.click();
      const resolved = await waitFor(() => (holdOf(msg)?.status === 'resolved') ? holdOf(msg) : null, 12000);
      const dmg = await waitFor(() => damageFor(msg?.id), 8000);
      await sleep(800);
      ok('3b. the Halfling passes too: the hit lands', !!resolved && (targetOf(msg)?.answer === 'pass') && !!dmg && (hp() < 400),
        `answer=${targetOf(msg)?.answer} dmg=${!!dmg} hp=${hp()}`);
    }

    // ================================================== 4. the guard alone; no Shield, no guard
    if (want(4)) {
      await closeDialogs(); await spendLuck();
      const msg = await swing({ d20: [12] });
      const guard = await waitFor(guardPopup, 6000);
      const own = rescuePopup();
      const t0 = targetOf(msg);
      ok('4a. Lucky spent: only the guard is asked (selfAsk false, no Halfling popup)', !!guard && !own && (t0?.selfAsk === false),
        JSON.stringify({ guard: !!guard, own: !!own, selfAsk: t0?.selfAsk }));
      guard?.element?.querySelector('button[data-action="pass"]')?.click();
      const resolved = await waitFor(() => (holdOf(msg)?.status === 'resolved') ? holdOf(msg) : null, 12000);
      ok('4b. the guard passes: the hit lands', !!resolved && (targetOf(msg)?.answer === 'pass'), `answer=${targetOf(msg)?.answer}`);
      await fighter.updateEmbeddedDocuments('Item', [{ _id: shield.id, 'system.equipped': false }]);
      await closeDialogs();
      const bare = await swing({ d20: [12] });
      await sleep(1200);
      ok('4c. no Shield held: nobody is asked — no hold, the damage lands at once', !holdOf(bare) && !guardPopup() && !!damageFor(bare?.id),
        `hold=${!!holdOf(bare)} popup=${!!guardPopup()} dmg=${!!damageFor(bare?.id)}`);
      await fighter.updateEmbeddedDocuments('Item', [{ _id: shield.id, 'system.equipped': true }]);
      await refillLuck();
    }

    // ================================================== 5. Interception
    if (want(5)) {
      await closeDialogs(); await spendLuck();
      await set('interruptList', def('interruptList').replace(/,\s*Protection:roll/, ''));
      const msg = await swing({ d20: [12], dmg: 5 });
      const pop = await waitFor(interceptPopup, 8000);
      const card = game.messages.contents.find(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'damageHold')?.guards?.some(g => g.actorUuid === fighter.uuid)
        && (m.getFlag(MOD, 'damageHold')?.status === 'pending'));
      ok('5a. the attack\'s damage waits: a hold card naming the Fighter, the guard\'s popup "… intercept?"', !!pop && !!card && (hp() === 400),
        `popup=${!!pop} card=${!!card} hp=${hp()}`);
      faces([[9, 10]]);
      pop?.element?.querySelector('button[data-action="cast"]')?.click();
      const landed = await waitFor(() => { const f = game.messages.get(card?.id)?.getFlag(MOD, 'damageHold'); return (f?.applied) ? f : null; }, 12000);
      await sleep(600);
      const taken = 400 - hp();
      ok('5b. Intercept: 1d10 + PB rolled (9 + PB), the damage lands short by it — the Fighter the reactor, the receipt says so',
        (landed?.answer === 'cast') && (landed?.actorUuid === fighter.uuid) && (Number(landed?.reduceBy) >= 10) && (taken === 0),
        `flag=${JSON.stringify({ answer: landed?.answer, actor: landed?.actorName, reduceBy: landed?.reduceBy })} taken=${taken}`);
      void msg;
    }

    // ================================================== 6. Interception passed
    if (want(6)) {
      await closeDialogs(); await spendLuck();
      await set('interruptList', def('interruptList').replace(/,\s*Protection:roll/, ''));
      await swing({ d20: [12], dmg: 5 });
      const pop = await waitFor(interceptPopup, 8000);
      const card = game.messages.contents.filter(m => m.getFlag(MOD, 'damageHold')?.status === 'pending').pop();
      pop?.element?.querySelector('button[data-action="pass"]')?.click();
      const landed = await waitFor(() => { const f = game.messages.get(card?.id)?.getFlag(MOD, 'damageHold'); return (f?.applied) ? f : null; }, 12000);
      await sleep(600);
      ok('6a. passed: the damage lands whole', (landed?.answer === 'pass') && ((400 - hp()) > 0), `answer=${landed?.answer} taken=${400 - hp()}`);
      await set('interruptList', def('interruptList'));
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'guards', out, plan, f });
