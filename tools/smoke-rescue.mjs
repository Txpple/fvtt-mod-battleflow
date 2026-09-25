// Battle Flow rescue-the-hit smoke test — THE `roll` INTERRUPT (Slice A, ruled 2026-09-24 off
// prototypes/slice-a.html; RULINGS.md owes the section). A defender's post-hit answer that imposes
// Disadvantage on the attack roll already made: Lucky (a Luck Point, no Reaction), Warding Flare
// (the Reaction and a use), Shadowy Dodge (the Reaction alone) as rows in the hold's popup beside
// Shield and the rest; a second d20 with the attack's own modifiers, the lower standing, the verdict
// taken again against the live AC through the composed roll; a natural 20 can be undone, so a crit
// with a live row is asked and its dice wait for the answer; every row spent skips the popup.
//
// Fixtures: BF Test Halfling (Lucky at its proficiency's Luck Points — added to tools/fixture-suite.mjs
// by the Slice A tier 1+2 build), BF Test Attacker (the goblin that swings). Warding Flare and Shadowy
// Dodge are ADDED to the Halfling from the PHB classes pack for §3/§4 and removed in the teardown —
// no fixture of their own (a Light Domain cleric and a level-15 Gloom Stalker would each be one).
//
// Written blind 2026-09-24 (the sandbox was in use by the parallel build) and first run the same night:
// 18/18 after two CODE fixes it caught (7eca747 nested flag stamps, 32894d7 dnd5e's adv/dis markers).
//
// Harness discipline: every setting touched is restored; every message this run creates is deleted;
// the Luck Points and uses it spends are refilled; the items and tokens it adds are removed.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs): the machines this suite drives — a change to one
// re-runs it under `battery.mjs --changed`. Spine files are never claimed: their change is the
// full battery. `npm run coverage` checks the claims both ways. Exported only so the linter reads
// it as the declaration it is: ⚠ NEVER import a suite (it connects on evaluation) — the map is parsed.
export const COVERS = [
  'hold/lookup.js',         // the rows — rollRescuesOf, rescueStateOf, rescueRowsNow
  'hold/trigger.js',        // the stamp — a live row holds, all-spent skips, critAtStake
  'hold/answer.js',         // the answer — the spend by hand, the second d20, the sheet's use
  'hold/continue.js',       // the verdict through the composed roll, the held crit's dice
  'hold/views.js'           // the popup ("Rescue the hit"), the attacker's card line
];

const SECTIONS = {
  1: 'Lucky turns the hit: one row ("Lucky — BF Test Halfling"), the tick lights Answer; a second d20 lower → MISS; a Luck Point spent by hand; the attacker\'s card reads "Lucky bent the roll — Disadvantage, … MISS"; the held damage applies to nobody',
  2: 'Lucky, the second d20 higher: the first stands, still a HIT — the point is spent either way, the damage lands',
  3: 'three rows (Warding Flare and Shadowy Dodge added): the title "Rescue the hit — BF Test Halfling", three tags; Warding Flare answers — the Reaction chip, a use spent, the roll bent',
  4: 'the Reaction spent: Warding Flare and Shadowy Dodge grey with "Reaction spent this round", Lucky stays live',
  5: 'every row spent (no Luck Points, the Reaction gone): no hold at all — no popup, the damage lands at once',
  6: 'a natural 20 with a live row: the popup opens, NO damage is rolled until the answer; Lucky\'s lower die makes it "a hit, no longer a crit" and the dice roll once, not doubled',
  7: 'Advantage cancels: an attack rolled with Advantage, Lucky answers — no second d20, the FIRST die stands as the plain roll',
  8: 'Pass: nothing spent, the hit lands as rolled',
  9: 'the sheet\'s use answers (the fix-the-rules-gap rule): Lucky\'s "Disadvantage" activity used from the sheet mid-hold bends that ONE hold',
  10: 'the registration FIRED (§11): dnd5e.rollAttackV2 and dnd5e.postUseActivity moved'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'rescue', watchdogMs: 600_000 });
announcePlan('rescue', plan, pulled);

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

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  const { INTERRUPT_KINDS } = await import('/modules/fvtt-mod-battleflow/scripts/decide/registry.js');
  if (!INTERRUPT_KINDS.has('roll')) return { fatal: 'the `roll` interrupt kind is not in the loaded code — OLD code (F5)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'interruptList', 'holdTimer', 'holdReveal', 'holdSkipFutile', 'holdApplyEffect', 'riders', 'effectRiders',
    'masteryRiders', 'masteryAsk', 'castApply', 'concMode', 'reminderList', 'damageEitherList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const halfling = game.actors.getName('BF Test Halfling');
  if (!scene || !attacker || !halfling) return { fatal: 'missing fixture: scene, BF Test Attacker or BF Test Halfling — run tools/fixture-suite.mjs' };
  const lucky = () => halfling.items.find(i => (i.name === 'Lucky') && (Number(i.system?.uses?.max) > 0));
  if (!lucky()) return { fatal: 'BF Test Halfling lacks the Lucky FEAT (with Luck Points) — re-run fixture-suite' };

  const created = { tokens: [], items: [] };
  const priorActor = {};
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  /** The PRNG as a queue of faces: each die takes the next; past the end, the last. */
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const refillLuck = async () => { const l = lucky(); if (l) await l.update({ 'system.uses.spent': 0 }); };
  const clearChips = async () => {
    for (const a of [attacker, halfling]) {
      const chips = a.effects.filter(e => e.getFlag(MOD, 'mastery'));
      const live = chips.map(e => e.id).filter(id => a.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
    }
  };
  const rescuePopup = () => [...foundry.applications.instances.values()]
    .find(app => app.rendered && app.element?.querySelector?.('[data-bf-ticks="bf-rescue"]')) ?? null;
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      if (app.element?.querySelector?.('[data-bf-ticks]')) { try { await app.close(); } catch { /* gone */ } }
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
      await refillLuck();
      const liveItems = created.items.filter(id => halfling.items.get(id));
      if (liveItems.length) await halfling.deleteEmbeddedDocuments('Item', liveItems);
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
    await set('interruptList', game.settings.settings.get(`${MOD}.interruptList`)?.default ?? prior.interruptList);
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
    await set('damageEitherList', '');   // the attacker is a goblin, but keep the damage free of any other fold
    await refillLuck();

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => [attacker.id, halfling.id].includes(t.actorId)).map(t => t.id);
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
    const { token: halflingToken } = await placeToken(halfling, 1500, 1700);

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
    // The attack's own modifier, measured once off a roll that posts nothing — the AC is set so a d20
    // of 12 hits and a d20 of 8 misses, whatever the goblin's bonus.
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
    /** A programmatic attack on the Halfling with the d20 face(s) forced; returns the attack message once the hold (if any) stands. */
    const swing = async ({ d20 = [12], advantage = false } = {}) => {
      await healFull();
      attackerToken.control({ releaseOthers: true });
      halflingToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      faces([...d20.map(n => [n, 20]), [3, 6]]);
      const usage = await act().use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act().rollAttack(advantage ? { advantage: true } : {}, { configure: false },
        usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      await waitFor(() => msg?.getFlag(MOD, 'hold') || damageFor(msg?.id), 4000);
      return msg;
    };
    const holdOf = msg => game.messages.get(msg?.id)?.getFlag(MOD, 'hold') ?? null;
    const targetOf = msg => holdOf(msg)?.targets?.find(t => t.uuid === halfling.uuid) ?? null;
    const tickAndAnswer = async (popup, name) => {
      const box = [...(popup?.element?.querySelectorAll('input[name="bf-rescue"]') ?? [])].find(b => b.value === name);
      if (box && !box.checked) box.click();
      await sleep(50);
      popup?.element?.querySelector('button[data-action="answer"]')?.click();
    };
    const luckLeft = () => Number(lucky()?.system?.uses?.value ?? 0);

    // ================================================== 1. Lucky turns the hit
    if (want(1)) {
      await clearChips(); await refillLuck();
      const before = luckLeft();
      const msg = await swing({ d20: [12] });
      const popup = await waitFor(rescuePopup, 6000);
      const answerBtn = popup?.element?.querySelector('button[data-action="answer"]');
      ok('1a. one row, one title: "Lucky — BF Test Halfling", the row "Disadvantage" with "1 Luck Point · N left" as its tag; Answer dark until the tick',
        !!popup && /Lucky — BF Test Halfling/.test(popup.title ?? popup.options?.window?.title ?? '')
          && /1 Luck Point · \d+ left/.test(textOf(popup.element)) && answerBtn?.disabled === true,
        `popup=${!!popup} title="${popup?.title}" text="${textOf(popup?.element).slice(0, 200)}" disabled=${answerBtn?.disabled}`);
      faces([[8, 20]]);
      await tickAndAnswer(popup, 'Lucky');
      const resolved = await waitFor(() => (holdOf(msg)?.status === 'resolved') ? holdOf(msg) : null, 12000);
      const t = targetOf(msg);
      ok('1b. the second d20 (8) is lower: it stands, the verdict is a MISS against the live AC', !!resolved && (t?.answer === 'roll') && (t?.verdict === 'miss')
        && (t?.bent?.how === 'lower') && (t?.bent?.stood === 8), JSON.stringify({ answer: t?.answer, verdict: t?.verdict, bent: t?.bent }));
      ok('1c. one Luck Point spent by hand, the record on the hold target', (luckLeft() === before - 1) && (t?.poolSpend?.pool === 'Luck Points'),
        `luck ${before}→${luckLeft()} poolSpend=${JSON.stringify(t?.poolSpend)}`);
      const text = await waitFor(() => { const c = cardText(msg?.id); return /bent the roll/.test(c) ? c : null; }, 4000);
      ok('1d. the attacker\'s card: "Lucky bent the roll — Disadvantage, … MISS"', /Lucky bent the roll — Disadvantage, \d+ → \d+, MISS/.test(text ?? ''), (text ?? '').slice(0, 240));
      await sleep(1500);
      const dmg = damageFor(msg?.id);
      ok('1e. the held damage was released and applies to NOBODY (the miss drops the target)', !dmg || !dmg.getFlag(MOD, 'receipt')?.targets?.length,
        `dmg=${!!dmg} receipt=${JSON.stringify(dmg?.getFlag(MOD, 'receipt')?.targets?.map(x => x.name))}`);
    }

    // ================================================== 2. the second die higher
    if (want(2)) {
      await clearChips(); await refillLuck();
      const before = luckLeft();
      const msg = await swing({ d20: [12] });
      const popup = await waitFor(rescuePopup, 6000);
      faces([[16, 20]]);
      await tickAndAnswer(popup, 'Lucky');
      await waitFor(() => holdOf(msg)?.status === 'resolved', 12000);
      const t = targetOf(msg);
      ok('2a. the second d20 higher: the first stands, still a HIT; the point is spent anyway', (t?.verdict === 'hit') && (t?.bent?.changed === false) && (luckLeft() === before - 1),
        JSON.stringify({ verdict: t?.verdict, bent: t?.bent, luck: luckLeft() }));
      const dmg = await waitFor(() => { const d = damageFor(msg?.id); return d?.getFlag(MOD, 'receipt') ? d : null; }, 10000);
      ok('2b. the damage lands', !!dmg, '');
    }

    // Warding Flare and Shadowy Dodge off the pack, onto the Halfling, for §3 and §4.
    const addFromPack = async name => {
      const pack = game.packs.get('dnd-players-handbook.classes');
      const entry = pack?.index?.find(e => e.name === name) ?? (await pack?.getIndex())?.find(e => e.name === name);
      const doc = entry ? await pack.getDocument(entry._id) : null;
      if (!doc) return null;
      const [item] = await halfling.createEmbeddedDocuments('Item', [doc.toObject()]);
      created.items.push(item.id);
      if (Number(item.system?.uses?.max) > 0) await item.update({ 'system.uses.spent': 0 });
      return item;
    };

    // ================================================== 3. three rows
    if (want(3) || want(4)) {
      const flare = await addFromPack('Warding Flare');
      const dodge = await addFromPack('Shadowy Dodge');
      if (!flare || !dodge) ok('3-. Warding Flare and Shadowy Dodge found in dnd-players-handbook.classes', false, `flare=${!!flare} dodge=${!!dodge}`);
      if (want(3) && flare && dodge) {
        await clearChips(); await refillLuck();
        const usesBefore = Number(flare.system.uses.value);
        const msg = await swing({ d20: [12] });
        const popup = await waitFor(rescuePopup, 6000);
        const rows = [...(popup?.element?.querySelectorAll('[data-bf-tick-row]') ?? [])].map(r => textOf(r));
        ok('3a. "Rescue the hit — BF Test Halfling", three rows with their cost tags (a Reaction · N uses left / a Reaction / 1 Luck Point · N left)',
          /Rescue the hit — BF Test Halfling/.test(popup?.title ?? '') && (rows.length === 3)
            && rows.some(r => /Warding Flare/.test(r) && /a Reaction · \d+ uses? left/i.test(r)) && rows.some(r => /Shadowy Dodge/.test(r) && /a Reaction/i.test(r)),
          `title="${popup?.title}" rows=${JSON.stringify(rows)}`);
        faces([[8, 20]]);
        await tickAndAnswer(popup, 'Warding Flare');
        await waitFor(() => holdOf(msg)?.status === 'resolved', 12000);
        const t = targetOf(msg);
        const reaction = halfling.effects.find(e => e.getFlag(MOD, 'mastery') === 'reaction');
        ok('3b. Warding Flare answers: the roll bent (a MISS) and a use spent (the Reaction chip is written only in combat — out of combat there is no turn to bring it back)',
          (t?.rescue === 'Warding Flare') && (t?.verdict === 'miss') && (Number(halfling.items.get(flare.id)?.system?.uses?.value) === usesBefore - 1),
          JSON.stringify({ rescue: t?.rescue, verdict: t?.verdict, uses: halfling.items.get(flare.id)?.system?.uses?.value, reaction: !!reaction }));
      }
      if (want(4) && flare && dodge) {
        await clearChips(); await refillLuck();
        // The Reaction spent by hand, the chip every reaction writes (a clockless mark, the smoke-hold idiom).
        await halfling.createEmbeddedDocuments('ActiveEffect', [{ name: 'Reaction — used', img: 'icons/svg/clockwork.svg', transfer: false, flags: { [MOD]: { mastery: 'reaction' } } }]);
        await swing({ d20: [12] });
        const popup = await waitFor(rescuePopup, 6000);
        const rows = [...(popup?.element?.querySelectorAll('[data-bf-tick-row]') ?? [])];
        const off = rows.filter(r => r.querySelector('input')?.disabled).map(r => textOf(r));
        const live = rows.filter(r => !r.querySelector('input')?.disabled).map(r => textOf(r));
        ok('4a. the Reaction spent: the two Reaction rows greyed with "Reaction spent this round", Lucky live',
          (off.length === 2) && off.every(r => /Reaction spent this round/i.test(r)) && (live.length === 1) && /Lucky/.test(live[0]),
          `off=${JSON.stringify(off)} live=${JSON.stringify(live)}`);
        popup?.element?.querySelector('button[data-action="pass"]')?.click();
        await clearChips();
      }
    }

    // ================================================== 5. every row spent: no popup
    if (want(5)) {
      await clearChips();
      const l = lucky();
      await l.update({ 'system.uses.spent': Number(l.system.uses.max) });
      const extra = created.items.filter(id => halfling.items.get(id));
      if (extra.length) { await halfling.deleteEmbeddedDocuments('Item', extra); }
      const msg = await swing({ d20: [12] });
      await sleep(1500);
      const dmg = await waitFor(() => { const d = damageFor(msg?.id); return d?.getFlag(MOD, 'receipt') ? d : null; }, 10000);
      ok('5a. no Luck Points left and nothing else: no hold, no popup — the damage lands at once', !holdOf(msg) && !rescuePopup() && !!dmg,
        `hold=${JSON.stringify(holdOf(msg)?.status)} popup=${!!rescuePopup()} dmg=${!!dmg}`);
      await refillLuck();
    }

    // ================================================== 6. a natural 20 can be undone
    if (want(6)) {
      await clearChips(); await refillLuck();
      const msg = await swing({ d20: [20] });
      const popup = await waitFor(rescuePopup, 6000);
      await sleep(1200);
      ok('6a. a crit with a live row is ASKED (the crit skip does not apply to the `roll` kind), and its dice WAIT — no damage rolled yet (critAtStake)',
        !!popup && (holdOf(msg)?.critAtStake === true) && !damageFor(msg?.id) && /natural 20/.test(textOf(popup?.element)),
        `popup=${!!popup} critAtStake=${holdOf(msg)?.critAtStake} dmg=${!!damageFor(msg?.id)}`);
      faces([[14, 20], [3, 6], [3, 6]]);
      await tickAndAnswer(popup, 'Lucky');
      await waitFor(() => holdOf(msg)?.status === 'resolved', 12000);
      const t = targetOf(msg);
      const dmg = await waitFor(() => damageFor(msg?.id), 10000);
      const dieCount = (dmg?.rolls?.[0]?.dice ?? []).reduce((n, d) => n + d.number, 0);
      const baseCount = weapon.system.damage?.base?.number ?? 1;
      ok('6b. the lower die stood: "a hit, no longer a crit", and the damage rolled ONCE, not doubled',
        (t?.verdict === 'hit') && (t?.bent?.isCritical === false) && !!dmg && (dieCount === baseCount) && !dmg.rolls?.[0]?.isCritical,
        JSON.stringify({ verdict: t?.verdict, bent: t?.bent, dice: dieCount, base: baseCount, crit: dmg?.rolls?.[0]?.isCritical }));
      const text = await waitFor(() => { const c = cardText(msg?.id); return /no longer a crit/.test(c) ? c : null; }, 4000);
      ok('6c. the attacker\'s card says "a hit, no longer a crit"', /no longer a crit/.test(text ?? ''), (text ?? '').slice(0, 240));
    }

    // ================================================== 7. Advantage cancels
    if (want(7)) {
      await clearChips(); await refillLuck();
      const since = Date.now();
      const msg = await swing({ d20: [6, 13], advantage: true });   // kh keeps the 13; the first die (6) is the plain roll
      const popup = await waitFor(rescuePopup, 6000);
      await tickAndAnswer(popup, 'Lucky');
      await waitFor(() => holdOf(msg)?.status === 'resolved', 12000);
      const t = targetOf(msg);
      const seconds = game.messages.contents.filter(m => (m.timestamp >= since) && /the second d20/.test(m.flavor ?? ''));
      ok('7a. Advantage and Disadvantage cancel: no second d20 rolled, the first die (6) stands — a MISS',
        (t?.bent?.how === 'cancelled') && (t?.bent?.stood === 6) && (t?.verdict === 'miss') && (seconds.length === 0),
        JSON.stringify({ bent: t?.bent, verdict: t?.verdict, seconds: seconds.length }));
    }

    // ================================================== 8. pass
    if (want(8)) {
      await clearChips(); await refillLuck();
      const before = luckLeft();
      const msg = await swing({ d20: [12] });
      const popup = await waitFor(rescuePopup, 6000);
      popup?.element?.querySelector('button[data-action="pass"]')?.click();
      await waitFor(() => holdOf(msg)?.status === 'resolved', 12000);
      const dmg = await waitFor(() => { const d = damageFor(msg?.id); return d?.getFlag(MOD, 'receipt') ? d : null; }, 10000);
      ok('8a. Pass: nothing spent, the hit lands', (targetOf(msg)?.answer === 'pass') && (luckLeft() === before) && !!dmg, `luck=${luckLeft()} dmg=${!!dmg}`);
    }

    // ================================================== 9. the sheet's use answers
    if (want(9)) {
      await clearChips(); await refillLuck();
      const msg = await swing({ d20: [12] });
      await waitFor(rescuePopup, 6000);
      faces([[8, 20]]);
      const dis = [...(lucky()?.system?.activities ?? [])].find(a => a.name === 'Disadvantage');
      await dis?.use({}, { configure: false }, {});
      await waitFor(() => holdOf(msg)?.status === 'resolved', 12000);
      const t = targetOf(msg);
      ok('9a. Lucky\'s "Disadvantage" used from the sheet answers the hold: the roll bent, a MISS', (t?.answer === 'roll') && (t?.rescue === 'Lucky') && (t?.verdict === 'miss'),
        JSON.stringify({ answer: t?.answer, rescue: t?.rescue, verdict: t?.verdict }));
    }

    // ================================================== 10. FIRED
    if (want(10)) {
      ok('10a. dnd5e.rollAttackV2 and dnd5e.postUseActivity fired', (count('dnd5e.rollAttackV2') > 0) && (count('dnd5e.postUseActivity') > 0),
        `attack=${count('dnd5e.rollAttackV2')} use=${count('dnd5e.postUseActivity')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'rescue', out, plan, f });
