// Battle Flow healing-rerolls smoke test — HEALER (the origin feats, 2026-09-25: "use the empower
// spell form as a baseline listing all roll numbers, the ones, and select the ones to replace";
// "make sure the healer feat itself gets the 1 popup too not just spells"; "1s ticked"). A healing
// roll by a Healer that shows a 1 opens Empowered's dice popup — every die a chip, the 1s ticked and
// pickable, the rest greyed; Reroll rolls them again and the new faces stand; the healing WAITS for
// the answer (cast.js's claim) and lands once. Battle Medic's own `r1` is taken off so it asks too.
//
// Fixtures: BF Test Cleric (a character; tools/fixture-suite.mjs) is lent the PHB's Healer and Cure
// Wounds for the run; BF Test Victim (the goblin) is the one healed, its hit points put back after.
//
// Harness discipline: every setting touched is restored; the lent items and every message this run
// creates are deleted; the PRNG is put back; the victim's hit points are restored.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'heal-rerolls.js',        // the whole fold — the birth flag, the popup, the patch, the card
  'cast.js'                 // the heal applier's claim — the healing waits for the answer
];

const SECTIONS = {
  1: 'Cure Wounds rolls [1, 6]: the popup lists both dice — the 1 ticked and pickable, the 6 greyed — and the healing WAITS (no receipt, the hit points unmoved)',
  2: 'Reroll: the 1 is rolled again (→ 5) on its own card, struck on the healing roll, the new total stands; the healing lands ONCE with it; the record is used',
  3: 'Keep the roll: the record says kept; the healing lands as rolled',
  4: 'no 1 among the dice: no popup, the record settles "none", the healing lands at once',
  5: 'Battle Medic (the feat\'s own d8 activity): the formula goes up without its r1, a 1 opens the same popup',
  6: 'the clock keeps the roll: an unanswered popup times out kept, and the healing lands',
  7: 'the list is the switch: Healer off the Healing Rerolls list — no record, and Battle Medic keeps its own r1'
};
const DEPENDS = { 2: ['1'] };   // §2 answers the popup §1 opened

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'heal', watchdogMs: 300_000 });
announcePlan('heal', plan, pulled);

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

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.healRerollList`)) return { fatal: 'healRerollList not registered — OLD code (reload the box)' };

  const SETTING_KEYS = ['healRerollList', 'castApply', 'holdTimer', 'dramaticBeat'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const scene = game.scenes.getName('Battle Flow Test Range');
  const cleric = game.actors.getName('BF Test Cleric');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !cleric || !victim) return { fatal: 'missing fixture: the test range, BF Test Cleric or BF Test Victim — run tools/fixture-suite.mjs' };

  const lent = [];
  const placed = [];
  const priorHp = { value: victim.system._source.attributes.hp.value, max: victim.system._source.attributes.hp.max };
  const realPRNG = CONFIG.Dice.randomUniform;
  /** The PRNG as a queue of faces — `[[1, 8], [6, 8]]`: each die takes the next; past the end, the last. */
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const realDice = () => { CONFIG.Dice.randomUniform = realPRNG; };
  const healPopup = () => [...foundry.applications.instances.values()]
    .find(app => app.rendered && app.element?.querySelector?.('[data-bf-heal-dice]')) ?? null;
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      if (app.element?.querySelector?.('[data-bf-heal-dice]')) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    realDice();
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      const live = lent.filter(id => cleric.items.get(id));
      if (live.length) await cleric.deleteEmbeddedDocuments('Item', live);
      const tokens = placed.filter(id => scene.tokens.get(id));
      if (tokens.length) await scene.deleteEmbeddedDocuments('Token', tokens);
      await victim.update({ 'system.attributes.hp.value': priorHp.value, 'system.attributes.hp.max': priorHp.max });
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && ((m.speaker?.actor === cleric.id) || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('healRerollList', def('healRerollList'));
    await set('castApply', true);
    await set('holdTimer', 0);         // the popup waits for the suite's click
    await set('dramaticBeat', 0);

    // Lend Healer and Cure Wounds from the PHB — found by name in the pack indexes.
    const lend = async (name, type) => {
      if (cleric.items.some(i => (i.name === name) && (i.type === type))) return cleric.items.find(i => (i.name === name) && (i.type === type));
      for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
        const hit = (await pack.getIndex()).find(e => (e.name === name) && (e.type === type));
        if (!hit) continue;
        const src = await pack.getDocument(hit._id);
        const [item] = await cleric.createEmbeddedDocuments('Item', [src.toObject()]);
        lent.push(item.id);
        return item;
      }
      return null;
    };
    const healer = await lend('Healer', 'feat');
    const cure = await lend('Cure Wounds', 'spell');
    if (!healer || !cure) return { fatal: `the PHB ships no ${!healer ? '"Healer" feat' : '"Cure Wounds" spell'} this box can find`, results, log, skips };
    const cureAct = () => cleric.items.get(cure.id)?.system.activities.find(a => a.type === 'heal');
    const medicAct = () => cleric.items.get(healer.id)?.system.activities.find(a => (a.type === 'heal') && /d8/.test(a.name ?? ''));
    if (!cureAct() || !medicAct()) return { fatal: `no heal activity: cure=${!!cureAct()} medic=${!!medicAct()}`, results, log, skips };

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    // The victim's own token for the run (smoke-savage's shape: linked, placed, deleted in teardown),
    // on a square nothing stands on.
    const g = scene.grid.size;
    const occupied = (x, y) => scene.tokens.some(t => (t.x < (x + 1) * g) && ((t.x + t.width * g) > x * g) && (t.y < (y + 1) * g) && ((t.y + t.height * g) > y * g));
    let spot = null;
    for (let y = 2; (y < 18) && !spot; y++) for (let x = 2; (x < 18) && !spot; x++) if (!occupied(x, y)) spot = { x, y };
    if (!spot) return { fatal: 'no free square on the test range for the victim\'s token', results, log, skips };
    const [victimDoc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(victim.prototypeToken.toObject(),
      { x: spot.x * g, y: spot.y * g, actorId: victim.id, actorLink: true }, { inplace: false })]);
    placed.push(victimDoc.id);
    for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(victimDoc.id)); i++) await sleep(250);
    const victimToken = canvas.tokens.get(victimDoc.id);
    if (!victimToken) return { fatal: 'the victim\'s token never reached the canvas', results, log, skips };

    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const hp = () => Number(victim.system.attributes.hp.value);
    const wound = () => victim.update({ 'system.attributes.hp.max': 200, 'system.attributes.hp.value': 1 });
    /** Roll a heal activity at the victim with the dice pinned; the healing message comes back. */
    const heal = async (activity, spec) => {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      victimToken.setTarget(true, { releaseOthers: true });
      await sleep(100);
      faces(spec);
      const rolls = await activity.rollDamage({}, { configure: false }, {});
      realDice();
      await sleep(300);
      return rolls?.[0]?.parent ?? null;
    };
    const flagOf = m => m?.getFlag(MOD, 'healReroll') ?? null;
    const healTotal = m => (m?.rolls ?? []).reduce((n, r) => n + (Number(r.total) || 0), 0);

    // ================================================== 1–2. Cure Wounds [1, 6], then Reroll → 5
    let first = null;
    if (want(1)) {
      await wound();
      first = await heal(cureAct(), [[1, 8], [6, 8]]);
      const app = await waitFor(healPopup, 6000);
      const chips = [...(app?.element?.querySelectorAll('[data-bf-heal-die]') ?? [])];
      const one = chips.find(c => c.textContent.trim() === '1'), six = chips.find(c => c.textContent.trim() === '6');
      ok('1a. the popup lists both dice — the 1 ticked and pickable, the 6 greyed',
        (chips.length === 2) && (one?.dataset.picked === '1') && !one?.disabled && !!six?.disabled,
        `popup=${!!app} chips=${chips.map(c => `${c.textContent.trim()}:${c.dataset.picked}${c.disabled ? ':off' : ''}`).join(',')}`);
      ok('1b. the healing waits: pending, no receipt, the hit points unmoved',
        (flagOf(first)?.status === 'pending') && !first?.getFlag(MOD, 'receipt') && (hp() === 1),
        `status=${flagOf(first)?.status} receipt=${!!first?.getFlag(MOD, 'receipt')} hp=${hp()}`);
    }
    if (want(2)) {
      const app = healPopup();
      const before = healTotal(first);
      faces([[5, 8]]);
      app?.element?.querySelector('button[data-action="reroll"]')?.click();
      const used = await waitFor(() => (flagOf(first)?.status === 'used') ? flagOf(first) : null, 10000);
      realDice();
      const receipt = await waitFor(() => first?.getFlag(MOD, 'receipt'), 8000);
      const results0 = first?.rolls?.[0]?.dice?.[0]?.results ?? [];
      await sleep(500);
      ok('2a. the 1 rerolled to 5: struck on the roll, the new total stands (+4)',
        !!used && (used.picks?.[0]?.old === 1) && (used.picks?.[0]?.new === 5) && (healTotal(first) === before + 4)
          && results0.some(r => (r.result === 1) && (r.active === false)),
        `picks=${JSON.stringify(used?.picks)} total=${before}→${healTotal(first)}`);
      ok('2b. the healing lands ONCE, with the new total',
        !!receipt && (hp() === 1 + healTotal(first)),
        `receipt=${!!receipt} hp=${hp()} expected=${1 + healTotal(first)}`);
      const announce = game.messages.contents.find(m => m.getFlag(MOD, 'respondsTo') === first?.id);
      ok('2c. the new die is on its own card', !!announce && (announce.rolls?.[0]?.total === 5), `card=${!!announce} roll=${announce?.rolls?.[0]?.total}`);
    }

    // ================================================== 3. Keep the roll
    if (want(3)) {
      await wound();
      const m = await heal(cureAct(), [[1, 8], [4, 8]]);
      const app = await waitFor(healPopup, 6000);
      app?.element?.querySelector('button[data-action="keep"]')?.click();
      const receipt = await waitFor(() => m?.getFlag(MOD, 'receipt'), 8000);
      ok('3a. Keep the roll: kept, and the healing lands as rolled',
        (flagOf(m)?.status === 'kept') && !!receipt && (hp() === 1 + healTotal(m)),
        `status=${flagOf(m)?.status} hp=${hp()} total=${healTotal(m)}`);
    }

    // ================================================== 4. no 1
    if (want(4)) {
      await wound();
      const m = await heal(cureAct(), [[3, 8], [7, 8]]);
      const receipt = await waitFor(() => m?.getFlag(MOD, 'receipt'), 8000);
      ok('4a. no 1: no popup, the record settles "none", the healing lands at once',
        (flagOf(m)?.status === 'none') && !healPopup() && !!receipt && (hp() === 1 + healTotal(m)),
        `status=${flagOf(m)?.status} popup=${!!healPopup()} hp=${hp()} total=${healTotal(m)}`);
    }

    // ================================================== 5. Battle Medic
    if (want(5)) {
      await wound();
      const m = await heal(medicAct(), [[1, 8]]);
      const formula = m?.rolls?.[0]?.formula ?? '';
      const app = await waitFor(healPopup, 6000);
      ok('5a. Battle Medic rolls without its own r1, and a 1 opens the same popup',
        !/r1/.test(formula) && (flagOf(m)?.status === 'pending') && !!app,
        `formula="${formula}" status=${flagOf(m)?.status} popup=${!!app}`);
      faces([[7, 8]]);
      app?.element?.querySelector('button[data-action="reroll"]')?.click();
      await waitFor(() => (flagOf(m)?.status === 'used'), 10000);
      realDice();
      const receipt = await waitFor(() => m?.getFlag(MOD, 'receipt'), 8000);
      ok('5b. the reroll stands and the healing lands with it', (flagOf(m)?.status === 'used') && !!receipt && (hp() === 1 + healTotal(m)),
        `status=${flagOf(m)?.status} hp=${hp()} total=${healTotal(m)}`);
    }

    // ================================================== 6. the clock
    if (want(6)) {
      await set('holdTimer', 3);
      await wound();
      const m = await heal(cureAct(), [[1, 8], [2, 8]]);
      await waitFor(healPopup, 6000);
      const kept = await waitFor(() => (flagOf(m)?.status === 'kept') ? flagOf(m) : null, 12000);
      const receipt = await waitFor(() => m?.getFlag(MOD, 'receipt'), 8000);
      ok('6a. the clock keeps the roll: kept (timed out), and the healing lands',
        !!kept?.timedOut && !!receipt && (hp() === 1 + healTotal(m)),
        `status=${flagOf(m)?.status} timedOut=${!!kept?.timedOut} hp=${hp()}`);
      await set('holdTimer', 0);
      await closeDialogs();
    }

    // ================================================== 7. off the list
    if (want(7)) {
      await set('healRerollList', '');
      await wound();
      const m = await heal(medicAct(), [[5, 8]]);
      const formula = m?.rolls?.[0]?.formula ?? '';
      ok('7a. Healer off the list: no record, and Battle Medic keeps its own r1', !flagOf(m) && /r1/.test(formula),
        `record=${JSON.stringify(flagOf(m))} formula="${formula}"`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'heal', out, plan, f });
