// Battle Flow initiative-swap smoke test — ALERT (the origin feats, 2026-09-25: "initiative swap
// should have a form after initiative all roll, list non incapacitated allies, each persons
// initiative, and they can select which to swap, and then swap yes no buttons"; "alert pick is
// enough"). Once every combatant has an Initiative, the Alert holder is asked once per combat; the
// allies on its side who are not Incapacitated are listed with their Initiative; Swap exchanges the
// two numbers in the tracker, No leaves it.
//
// Fixtures: BF Test Halfling (a character; tools/fixture-suite.mjs) is lent the PHB's Alert; BF Test
// Cleric and BF Test Bard stand as its allies, BF Test Victim as the enemy. The suite places
// TEMPORARY linked tokens in a strip it finds empty and runs its own combats; both are deleted in
// teardown.
//
// Harness discipline: every setting touched is restored; the lent item, the tokens, the combats, the
// statuses it set and every message this run creates are deleted.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'initiative-swap.js'      // the whole machine — the ask, the popup, the relay-free GM fold, the swap, the switches
];

const SECTIONS = {
  1: 'the last Initiative lands: the Alert holder\'s card lists the two allies with their Initiative (not the enemy); the popup is a radio per ally, Swap dark until one is picked; the whole lineup shown, the holder and the enemy greyed',
  2: 'Swap with the Bard: the two Initiatives are exchanged in the tracker, and the card says so (11 ↔ 17)',
  3: 'once per combat: a later Initiative change asks nothing new',
  4: 'an Incapacitated ally is not listed',
  5: 'No: the order stands; an Incapacitated Alert holder is not asked at all',
  6: 'the clock answers No (timed out)',
  7: 'the list is the switch: Alert off the Initiative Swaps list — no card'
};
const DEPENDS = { 2: ['1'], 3: ['1'] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'alert', watchdogMs: 300_000 });
announcePlan('alert', plan, pulled);

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
  if (!game.settings.settings.has(`${MOD}.initiativeSwapList`)) return { fatal: 'initiativeSwapList not registered — OLD code (reload the box)' };

  const SETTING_KEYS = ['initiativeSwapList', 'holdTimer'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const scene = game.scenes.getName('Battle Flow Test Range');
  const [halfling, cleric, bard, victim] = ['BF Test Halfling', 'BF Test Cleric', 'BF Test Bard', 'BF Test Victim'].map(n => game.actors.getName(n));
  if (!scene || !halfling || !cleric || !bard || !victim) return { fatal: 'missing fixtures — run tools/fixture-suite.mjs' };

  const lent = [];
  const placed = [];
  const combats = [];
  let restored = false;
  const clearIncap = async a => {
    if (a.statuses.has('incapacitated')) await a.toggleStatusEffect('incapacitated', { active: false }).catch(() => {});
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      for (const app of foundry.applications.instances.values()) {
        if (app.element?.querySelector?.('[data-bf-initiative-swap]')) { try { await app.close(); } catch { /* gone */ } }
      }
      for (const c of combats) if (game.combats.get(c.id)) await c.delete().catch(() => {});
      const tokens = placed.filter(id => scene.tokens.get(id));
      if (tokens.length) await scene.deleteEmbeddedDocuments('Token', tokens);
      for (const a of [halfling, cleric, bard]) await clearIncap(a);
      const live = lent.filter(id => halfling.items.get(id));
      if (live.length) await halfling.deleteEmbeddedDocuments('Item', live);
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart) && Object.keys(m.flags?.[MOD] ?? {}).length);
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('initiativeSwapList', def('initiativeSwapList'));
    await set('holdTimer', 0);   // the popup waits for the suite's click

    let alertSrc = null;
    for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
      const hit = (await pack.getIndex()).find(e => (e.name === 'Alert') && (e.type === 'feat'));
      if (hit) { alertSrc = await pack.getDocument(hit._id); break; }
    }
    if (!alertSrc) return { fatal: 'the PHB ships no "Alert" feat this box can find', results, log, skips };
    if (!halfling.items.some(i => i.name === 'Alert')) {
      const [item] = await halfling.createEmbeddedDocuments('Item', [alertSrc.toObject()]);
      lent.push(item.id);
    }

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const g = scene.grid.size;
    const occupied = (x, y) => scene.tokens.some(t => (t.x < (x + 1) * g) && ((t.x + t.width * g) > x * g) && (t.y < (y + 1) * g) && ((t.y + t.height * g) > y * g));
    let strip = null;
    for (let y = 3; (y < 17) && !strip; y++) for (let x = 0; (x <= 14) && !strip; x++) {
      let clear = true;
      for (let dx = 0; (dx < 5) && clear; dx++) if (occupied(x + dx, y)) clear = false;
      if (clear) strip = { x, y };
    }
    if (!strip) return { fatal: 'no empty 5-square strip on the test range', results, log, skips };
    const place = async (a, dx, disposition) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(a.prototypeToken.toObject(),
        { x: (strip.x + dx) * g, y: strip.y * g, actorId: a.id, actorLink: true, disposition }, { inplace: false })]);
      placed.push(doc.id);
      return doc;
    };
    const tHalfling = await place(halfling, 0, 1);
    const tCleric = await place(cleric, 1, 1);
    const tBard = await place(bard, 2, 1);
    const tVictim = await place(victim, 4, -1);

    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const cardFor = combat => game.messages.contents.filter(m => m.getFlag(MOD, 'initiativeSwap')?.combatId === combat.id).pop() ?? null;
    const swapPopup = () => [...foundry.applications.instances.values()]
      .find(app => app.rendered && app.element?.querySelector?.('[data-bf-initiative-swap]')) ?? null;
    /** A fresh combat of the four, the Initiatives set one by one — the last one is the moment. */
    const fight = async (inits) => {
      const combat = await Combat.create({ scene: scene.id, active: false });
      combats.push(combat);
      const docs = [[tHalfling, 11], [tCleric, 14], [tBard, 17], [tVictim, 9]];
      const made = await combat.createEmbeddedDocuments('Combatant', docs.map(([t]) => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId })));
      const byToken = Object.fromEntries(made.map(c => [c.tokenId, c]));
      for (const [t, n] of docs) await combat.setInitiative(byToken[t.id].id, inits?.[t.id] ?? n);
      return { combat, of: t => combat.combatants.get(byToken[t.id].id) };
    };

    // ================================================== 1–3. the ask, Swap, once per combat
    let first = null;
    if (want(1)) {
      first = await fight();
      const card = await waitFor(() => cardFor(first.combat), 6000);
      const flag = card?.getFlag(MOD, 'initiativeSwap');
      const names = (flag?.allies ?? []).map(a => `${a.name}:${a.initiative}`);
      ok('1a. the card lists the two allies with their Initiative, not the enemy',
        !!flag && (flag.allies.length === 2) && flag.allies.some(a => a.initiative === 17) && flag.allies.some(a => a.initiative === 14)
          && !flag.allies.some(a => a.name === tVictim.name) && (flag.initiative === 11),
        `allies=${names.join(', ')} own=${flag?.initiative}`);
      const app = await waitFor(swapPopup, 6000);
      const radios = [...(app?.element?.querySelectorAll('input[name="bf-initiative-swap"]') ?? [])];
      const swapBtn = app?.element?.querySelector('button[data-action="swap"]');
      ok('1b. the popup: a radio per ally, Swap dark until one is picked, and No',
        (radios.length === 2) && !!swapBtn?.disabled && !!app?.element?.querySelector('button[data-action="no"]'),
        `popup=${!!app} radios=${radios.length} swapDisabled=${swapBtn?.disabled}`);
      const lineup = flag?.lineup ?? [];
      const inits = lineup.map(r => r.initiative);
      ok('1c. the lineup: every combatant in Initiative order, coloured by side, the holder "(you)", the enemy unpickable',
        (lineup.length === 4) && inits.every((v, i) => !i || (inits[i - 1] >= v))
          && (lineup.find(r => r.role === 'self')?.initiative === 11) && (lineup.find(r => r.role === 'enemy')?.name === tVictim.name)
          && !!app?.element?.querySelector('[data-bf-initiative-row="self"]')?.textContent?.includes('(you)')
          && !!app?.element?.querySelector('[data-bf-initiative-row="enemy"]') && !app?.element?.querySelector('[data-bf-initiative-row="enemy"] input'),
        `lineup=${lineup.map(r => `${r.name}:${r.initiative}:${r.role}`).join(', ')}`);
    }
    if (want(2)) {
      const app = swapPopup();
      const bardRadio = [...(app?.element?.querySelectorAll('input[name="bf-initiative-swap"]') ?? [])]
        .find(r => r.value === first.of(tBard).id);
      if (bardRadio) { bardRadio.checked = true; bardRadio.dispatchEvent(new Event('change', { bubbles: true })); }
      app?.element?.querySelector('button[data-action="swap"]')?.click();
      const card = cardFor(first.combat);
      const applied = await waitFor(() => card?.getFlag(MOD, 'initiativeSwap')?.applied, 8000);
      ok('2a. Swap: the Halfling has 17, the Bard has 11, and the card says 11 ↔ 17',
        !!applied && (first.of(tHalfling).initiative === 17) && (first.of(tBard).initiative === 11)
          && (card.getFlag(MOD, 'initiativeSwap').from === 11) && (card.getFlag(MOD, 'initiativeSwap').to === 17),
        `halfling=${first.of(tHalfling).initiative} bard=${first.of(tBard).initiative} flag=${JSON.stringify({ from: card?.getFlag(MOD, 'initiativeSwap')?.from, to: card?.getFlag(MOD, 'initiativeSwap')?.to })}`);
    }
    if (want(3)) {
      const before = game.messages.contents.filter(m => m.getFlag(MOD, 'initiativeSwap')?.combatId === first.combat.id).length;
      await first.combat.setInitiative(first.of(tCleric).id, 20);
      await sleep(1500);
      const after = game.messages.contents.filter(m => m.getFlag(MOD, 'initiativeSwap')?.combatId === first.combat.id).length;
      ok('3a. once per combat: a later Initiative change asks nothing new', after === before, `cards ${before} → ${after}`);
    }

    // ================================================== 4. an Incapacitated ally
    if (want(4)) {
      await cleric.toggleStatusEffect('incapacitated', { active: true });
      const { combat } = await fight();
      const card = await waitFor(() => cardFor(combat), 6000);
      const allies = card?.getFlag(MOD, 'initiativeSwap')?.allies ?? [];
      ok('4a. the Incapacitated Cleric is not listed; the Bard is', !!card && (allies.length === 1) && (allies[0].initiative === 17),
        `allies=${allies.map(a => a.name).join(', ')}`);
      swapPopup()?.element?.querySelector('button[data-action="no"]')?.click();
      await clearIncap(cleric);
      await sleep(400);
    }

    // ================================================== 5. No; an Incapacitated holder
    if (want(5)) {
      const { combat, of } = await fight();
      const card = await waitFor(() => cardFor(combat), 6000);
      const app = await waitFor(swapPopup, 6000);
      app?.element?.querySelector('button[data-action="no"]')?.click();
      const answered = await waitFor(() => card?.getFlag(MOD, 'initiativeSwap')?.answer, 6000);
      ok('5a. No: the order stands', (answered === 'no') && (of(tHalfling).initiative === 11) && (of(tBard).initiative === 17),
        `answer=${answered} halfling=${of(tHalfling).initiative}`);
      await halfling.toggleStatusEffect('incapacitated', { active: true });
      const second = await fight();
      await sleep(1500);
      ok('5b. an Incapacitated Alert holder is not asked', !cardFor(second.combat), `card=${!!cardFor(second.combat)}`);
      await clearIncap(halfling);
    }

    // ================================================== 6. the clock
    if (want(6)) {
      await set('holdTimer', 3);
      const { combat, of } = await fight();
      const card = await waitFor(() => cardFor(combat), 6000);
      const flag = await waitFor(() => (card?.getFlag(MOD, 'initiativeSwap')?.answer === 'no') ? card.getFlag(MOD, 'initiativeSwap') : null, 12000);
      ok('6a. the clock answers No (timed out); the order stands', !!flag?.timedOut && (of(tHalfling).initiative === 11),
        `answer=${card?.getFlag(MOD, 'initiativeSwap')?.answer} timedOut=${!!flag?.timedOut}`);
      await set('holdTimer', 0);
    }

    // ================================================== 7. off the list
    if (want(7)) {
      await set('initiativeSwapList', '');
      const { combat } = await fight();
      await sleep(1500);
      ok('7a. Alert off the list: no card', !cardFor(combat), `card=${!!cardFor(combat)}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'alert', out, plan, f });
