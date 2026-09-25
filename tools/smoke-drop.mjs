// Battle Flow drop-to-1 smoke test — DROP TO 1 HP (2026-09-25, the Orc walk: "if sometihng takes them
// to zero, then a popup should ask to use the feat. same shape as death ward which you should do now
// too"): Relentless Endurance asked with the Hit Points held at 1; Death Ward automatic.
//
// Fixtures: BF Test Halfling (a character; tools/fixture-suite.mjs) is lent the PHB's Relentless
// Endurance, and wears a "Protection from Death" effect for §1. Damage is applied with the system's
// own Actor#applyDamage — the road the card's buttons and the module's applier both take.
//
// Harness discipline: every setting touched is restored; the lent item, the effect, the Hit Points
// and every message this run creates are put back or deleted.
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'drop-to-one.js'          // §1–§5 — the hold at 1, the ask, the answer, Death Ward, the outright kill
];

const SECTIONS = {
  1: 'Death Ward: damage past 0 leaves the Halfling at 1, the "Protection from Death" effect is gone, a card says so',
  2: 'Relentless Endurance, Drop to 1 HP: the Hit Points held at 1, the popup asks; the answer spends the use and the 1 stands',
  3: 'Relentless Endurance, Drop to 0: the 0 lands after the answer; the use stays',
  4: 'killed outright (the remainder meets the Hit Point maximum): no ask, the 0 lands at once',
  5: 'no use left: no ask, the 0 lands at once'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'drop', watchdogMs: 240_000 });
announcePlan('drop', plan, pulled);

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
  if (!game.settings.settings.has(`${MOD}.dropToOneList`)) return { fatal: 'dropToOneList not registered — OLD code (reload the box)' };

  const SETTING_KEYS = ['dropToOneList', 'holdTimer', 'concMode', 'interruptList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const actor = game.actors.getName('BF Test Halfling');
  if (!actor || (actor.type !== 'character')) return { fatal: 'missing fixture: BF Test Halfling (a character) — run tools/fixture-suite.mjs' };
  const priorHp = foundry.utils.deepClone(actor.system._source.attributes.hp);
  const lent = [];
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      for (const app of foundry.applications.instances.values()) {
        if ((app.element?.textContent ?? '').includes('drop to 1 instead')) { try { await app.close(); } catch { /* gone */ } }
      }
      const live = lent.filter(id => actor.items.get(id));
      if (live.length) await actor.deleteEmbeddedDocuments('Item', live);
      const fx = actor.effects.filter(e => e.name === 'Protection from Death').map(e => e.id);
      if (fx.length) await actor.deleteEmbeddedDocuments('ActiveEffect', fx);
      await actor.update({ 'system.attributes.hp': priorHp });
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart) && ((m.speaker?.actor === actor.id) || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('dropToOneList', def('dropToOneList'));
    await set('holdTimer', 0);                 // the ask waits for the suite's click
    await set('concMode', 'off');
    await set('interruptList', '');            // no Stone's Endurance or the like on the way
    let source = null;
    for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
      const hit = (await pack.getIndex()).find(e => e.name === 'Relentless Endurance');
      if (hit) { source = await pack.getDocument(hit._id); break; }
    }
    if (!source) return { fatal: 'the PHB ships no "Relentless Endurance" item this box can find' };
    const [item] = await actor.createEmbeddedDocuments('Item', [source.toObject()]);
    lent.push(item.id);
    const relentless = () => actor.items.get(item.id);
    if (!(Number(relentless()?.system?.uses?.max) > 0)) return { fatal: `the lent Relentless Endurance carries no uses (${JSON.stringify(relentless()?.system?.uses)})` };

    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const hpNow = () => Number(actor.system.attributes.hp.value);
    const setHp = (value, max = 40) => actor.update({ 'system.attributes.hp.max': max, 'system.attributes.hp.value': value, 'system.attributes.hp.temp': 0 });
    const refill = () => relentless()?.update({ 'system.uses.spent': 0 });
    const hit = n => actor.applyDamage([{ value: n, type: 'slashing' }]);
    const cardAfter = t0 => game.messages.contents.filter(m => (m.timestamp >= t0) && m.getFlag(MOD, 'dropToOne')).pop() ?? null;
    const popup = () => [...foundry.applications.instances.values()]
      .find(app => app.rendered && (app.element?.textContent ?? '').includes('drop to 1 instead')) ?? null;
    const press = (app, action) => { const b = app?.element?.querySelector(`button[data-action="${action}"]`); b?.click(); return !!b; };

    // ================================================== 1. Death Ward
    if (want(1)) {
      await setHp(20);
      await actor.createEmbeddedDocuments('ActiveEffect', [{ name: 'Protection from Death', img: 'icons/magic/death/skull-horned-worn-fire-blue.webp' }]);
      const t0 = Date.now();
      await hit(30);
      const card = await waitFor(() => cardAfter(t0), 6000);
      await sleep(400);
      ok('1a. Death Ward: 20 HP takes 30 and stops at 1; the effect is gone; the card says so (automatic)',
        (hpNow() === 1) && !actor.effects.some(e => e.name === 'Protection from Death') && (card?.getFlag(MOD, 'dropToOne')?.answer === 'auto'),
        `hp=${hpNow()} effect=${actor.effects.some(e => e.name === 'Protection from Death')} card=${JSON.stringify(card?.getFlag(MOD, 'dropToOne'))}`);
    }

    // ================================================== 2. Relentless, Drop to 1
    if (want(2)) {
      await setHp(20); await refill();
      const t0 = Date.now();
      await hit(30);
      ok('2a. the Hit Points are held at 1 while the ask stands', hpNow() === 1, `hp=${hpNow()}`);
      const card = await waitFor(() => cardAfter(t0), 6000);
      const app = await waitFor(popup, 6000);
      ok('2b. the popup asks: "drops to 0 Hit Points — drop to 1 instead?", "1 of 1 use left"',
        !!app && /1 of 1 use left/.test(app.element?.textContent ?? '') && (card?.getFlag(MOD, 'dropToOne')?.status === 'pending'),
        `popup=${!!app} text="${(app?.element?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 140)}"`);
      press(app, 'use');
      await waitFor(() => card?.getFlag(MOD, 'dropToOne')?.applied, 8000);
      await sleep(300);
      ok('2c. Drop to 1 HP: the 1 stands, the use is spent', (hpNow() === 1) && (Number(relentless()?.system?.uses?.value) === 0),
        `hp=${hpNow()} uses=${relentless()?.system?.uses?.value} flag=${JSON.stringify(card?.getFlag(MOD, 'dropToOne'))}`);
    }

    // ================================================== 3. Relentless, Drop to 0
    if (want(3)) {
      await setHp(20); await refill();
      const t0 = Date.now();
      await hit(30);
      const card = await waitFor(() => cardAfter(t0), 6000);
      const app = await waitFor(popup, 6000);
      press(app, 'pass');
      await waitFor(() => card?.getFlag(MOD, 'dropToOne')?.applied, 8000);
      await sleep(300);
      ok('3a. Drop to 0: the 0 lands after the answer, the use stays', (hpNow() === 0) && (Number(relentless()?.system?.uses?.value) === 1),
        `hp=${hpNow()} uses=${relentless()?.system?.uses?.value}`);
    }

    // ================================================== 4. killed outright
    if (want(4)) {
      await setHp(20); await refill();
      const t0 = Date.now();
      await hit(60);                            // 20 to 0, 40 left over = the maximum
      await sleep(1200);
      ok('4a. killed outright: no ask, the 0 lands at once', (hpNow() === 0) && !cardAfter(t0) && !popup(), `hp=${hpNow()} card=${!!cardAfter(t0)}`);
    }

    // ================================================== 5. no use left
    if (want(5)) {
      await setHp(20);
      await relentless()?.update({ 'system.uses.spent': 1 });
      const t0 = Date.now();
      await hit(30);
      await sleep(1200);
      ok('5a. no use left: no ask, the 0 lands at once', (hpNow() === 0) && !cardAfter(t0), `hp=${hpNow()} card=${!!cardAfter(t0)}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'drop', out, plan, f });
