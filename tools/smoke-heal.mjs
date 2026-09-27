// Battle Flow healing-rerolls smoke test — HEALER (the origin feats, 2026-09-25: "use the empower
// spell form as a baseline listing all roll numbers, the ones, and select the ones to replace";
// "make sure the healer feat itself gets the 1 popup too not just spells"; "1s ticked"). AUTOMATIC
// since 2026-09-26 ("fix healer that way too ... consistent with that great weapon one"): a healing
// roll by a Healer that shows a 1 rerolls every 1 as the dice land — no popup — and the new faces
// stand; the healing WAITS for the new dice (cast.js's claim) and lands once. Battle Medic's own `r1`
// is taken off so it goes the same road.
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
  'heal-rerolls.js',        // the whole fold — the birth flag, the automatic reroll, the patch, the card
  'cast.js',                // the heal applier's claim — the healing waits for the new dice
  'kit-tend.js'             // §6 — Battle Medic on the Healer's Kit's use (2026-09-25)
];

const SECTIONS = {
  1: 'Cure Wounds rolls [1, 6]: no popup — the 1 is rerolled (→ 5) on its own card, struck on the healing roll, the new total stands; the healing lands ONCE with it; the record is used',
  2: 'two 1s among the dice: both rerolled at once, one card, one landing',
  3: 'no 1 among the dice: the record settles "none", the healing lands at once',
  4: 'Battle Medic (the feat\'s own d8 activity): the formula goes up without its r1, and a 1 is rerolled the same way',
  5: 'the list is the switch: Healer off the Healing Rerolls list — no record, and Battle Medic keeps its own r1',
  6: 'Battle Medic on the Healer’s Kit: the kit used on a creature within 5 ft asks which Hit Die; Tend spends it on the creature and rolls the feature’s own heal of that size at it; the healing lands'
};
const DEPENDS = {};

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

  const SETTING_KEYS = ['healRerollList', 'castApply', 'holdTimer', 'dramaticBeat', 'kitTendList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const scene = game.scenes.getName('Battle Flow Test Range');
  const cleric = game.actors.getName('BF Test Cleric');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !cleric || !victim) return { fatal: 'missing fixture: the test range, BF Test Cleric or BF Test Victim — run tools/fixture-suite.mjs' };

  const lent = [];
  let clericPrior = null;
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
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    realDice();
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      const live = lent.filter(id => cleric.items.get(id));
      if (live.length) await cleric.deleteEmbeddedDocuments('Item', live);
      const tokens = placed.filter(id => scene.tokens.get(id));
      if (tokens.length) await scene.deleteEmbeddedDocuments('Token', tokens);
      await victim.update({ 'system.attributes.hp.value': priorHp.value, 'system.attributes.hp.max': priorHp.max });
      if (clericPrior) {
        await cleric.update({ 'system.attributes.hp.value': clericPrior.hp });
        for (const [id, spent] of Object.entries(clericPrior.hd)) await cleric.items.get(id)?.update({ 'system.hd.spent': spent });
      }
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

    /** Roll a heal activity with the dice pinned through the automatic reroll too; the message back once settled. */
    const healThrough = async (activity, spec) => {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      victimToken.setTarget(true, { releaseOthers: true });
      await sleep(100);
      faces(spec);
      const rolls = await activity.rollDamage({}, { configure: false }, {});
      const m = rolls?.[0]?.parent ?? null;
      await waitFor(() => ['used', 'none'].includes(flagOf(m)?.status), 12000);
      realDice();
      return m;
    };
    const popupOpen = () => [...foundry.applications.instances.values()].some(app => app.rendered && /Healer/.test(app.title ?? ''));

    // ================================================== 1. Cure Wounds [1, 6] → the 1 rerolled to 5
    if (want(1)) {
      await wound();
      const m = await healThrough(cureAct(), [[1, 8], [6, 8], [5, 8]]);
      const used = flagOf(m);
      const receipt = await waitFor(() => m?.getFlag(MOD, 'receipt'), 8000);
      const results0 = m?.rolls?.[0]?.dice?.[0]?.results ?? [];
      await sleep(500);
      ok('1a. no popup: the 1 rerolled to 5 at once, struck on the roll, the new total stands',
        !popupOpen() && (used?.status === 'used') && (used.picks?.[0]?.old === 1) && (used.picks?.[0]?.new === 5)
          && results0.some(r => (r.result === 1) && (r.active === false)),
        `status=${used?.status} picks=${JSON.stringify(used?.picks)} total=${healTotal(m)} popup=${popupOpen()}`);
      ok('1b. the healing lands ONCE, with the new total', !!receipt && (hp() === 1 + healTotal(m)),
        `receipt=${!!receipt} hp=${hp()} expected=${1 + healTotal(m)}`);
      const announce = game.messages.contents.find(x => x.getFlag(MOD, 'respondsTo') === m?.id);
      ok('1c. the new die is on its own card', !!announce && (announce.rolls?.[0]?.total === 5), `card=${!!announce} roll=${announce?.rolls?.[0]?.total}`);
    }

    // ================================================== 2. two 1s
    if (want(2)) {
      await wound();
      const m = await healThrough(cureAct(), [[1, 8], [1, 8], [4, 8], [7, 8]]);
      const used = flagOf(m);
      const receipt = await waitFor(() => m?.getFlag(MOD, 'receipt'), 8000);
      ok('2a. both 1s rerolled at once (→ 4, 7); the healing lands once with them',
        (used?.status === 'used') && ((used.picks ?? []).length === 2) && (used.picks ?? []).every(p => p.old === 1)
          && !!receipt && (hp() === 1 + healTotal(m)),
        `picks=${JSON.stringify(used?.picks)} hp=${hp()} total=${healTotal(m)}`);
    }

    // ================================================== 3. no 1
    if (want(3)) {
      await wound();
      const m = await healThrough(cureAct(), [[3, 8], [7, 8]]);
      const receipt = await waitFor(() => m?.getFlag(MOD, 'receipt'), 8000);
      ok('3a. no 1: the record settles "none", the healing lands at once',
        (flagOf(m)?.status === 'none') && !!receipt && (hp() === 1 + healTotal(m)),
        `status=${flagOf(m)?.status} hp=${hp()} total=${healTotal(m)}`);
    }

    // ================================================== 4. Battle Medic
    if (want(4)) {
      await wound();
      const m = await healThrough(medicAct(), [[1, 8], [7, 8]]);
      const formula = m?.rolls?.[0]?.formula ?? '';
      const receipt = await waitFor(() => m?.getFlag(MOD, 'receipt'), 8000);
      ok('4a. Battle Medic rolls without its own r1, the 1 is rerolled (→ 7), and the healing lands with it',
        !/r1/.test(formula) && (flagOf(m)?.status === 'used') && (flagOf(m)?.picks?.[0]?.new === 7) && !!receipt && (hp() === 1 + healTotal(m)),
        `formula="${formula}" status=${flagOf(m)?.status} hp=${hp()} total=${healTotal(m)}`);
    }

    // ================================================== 5. off the list
    if (want(5)) {
      await set('healRerollList', '');
      await wound();
      const m = await heal(medicAct(), [[5, 8]]);
      const formula = m?.rolls?.[0]?.formula ?? '';
      ok('5a. Healer off the list: no record, and Battle Medic keeps its own r1', !flagOf(m) && /r1/.test(formula),
        `record=${JSON.stringify(flagOf(m))} formula="${formula}"`);
    }

    // ================================================== 6. Battle Medic on the kit's use
    if (want(6)) {
      await set('kitTendList', def('kitTendList'));
      await set('healRerollList', def('healRerollList'));
      const kitSrc = await fromUuid('Compendium.dnd-players-handbook.equipment.Item.phbagHealersKit0');
      const [kit] = kitSrc ? await cleric.createEmbeddedDocuments('Item', [kitSrc.toObject()]) : [];
      if (kit) lent.push(kit.id);
      const cls = Object.values(cleric.classes ?? {})[0];
      clericPrior = { hp: Number(cleric.system.attributes.hp.value), hd: Object.fromEntries(Object.values(cleric.classes ?? {}).map(c => [c.id, Number(c.system.hd.spent) || 0])) };
      // The Cleric tends itself (a creature within 5 feet of yourself — itself, 0 feet): its own token, placed.
      const [clericDoc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(cleric.prototypeToken.toObject(),
        { x: (spot.x + 1) * g, y: spot.y * g, actorId: cleric.id, actorLink: true }, { inplace: false })]);
      placed.push(clericDoc.id);
      for (let i = 0; i < 40 && !canvas.tokens.get(clericDoc.id); i++) await sleep(250);
      const clericToken = canvas.tokens.get(clericDoc.id);
      if (!kit || !cls || !clericToken) {
        ok('6. the fixtures: a Healer’s Kit, a class with Hit Dice, the Cleric’s token', false, `kit=${!!kit} cls=${!!cls} token=${!!clericToken}`);
      } else {
        await cls.update({ 'system.hd.spent': 0 });
        await cleric.update({ 'system.attributes.hp.value': 1 });
        const faces0 = Number(String(cls.system.hd.denomination).replace(/^d/i, ''));
        game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
        clericToken.setTarget(true, { releaseOthers: true });
        await sleep(100);
        const use = await cleric.items.get(kit.id)?.system.activities.contents[0]?.use({}, { configure: false }, {});
        const card = use?.message ?? null;
        const offer = await waitFor(() => card?.getFlag(MOD, 'kitTend'), 6000);
        const tendPopup = () => [...foundry.applications.instances.values()]
          .find(app => app.rendered && app.element?.querySelector?.('input[name="bf-kit-tend"]')) ?? null;
        const app = await waitFor(tendPopup, 6000);
        const box = app?.element?.querySelector('input[name="bf-kit-tend"]');
        ok('6a. the kit’s use asks: the card holds the offer, the popup lists the Cleric’s Hit Die by size, the largest ticked',
          (offer?.status === 'pending') && (offer?.pools ?? []).some(p => p.faces === faces0) && !!box?.checked,
          `offer=${JSON.stringify(offer ? { status: offer.status, pools: offer.pools } : null)} popup=${!!app} ticked=${box?.checked}`);
        faces([[5, faces0]]);
        app?.element?.querySelector('button[data-action="tend"]')?.click();
        const done = await waitFor(() => (card?.getFlag(MOD, 'kitTend')?.applied) ? card.getFlag(MOD, 'kitTend') : null, 12000);
        const healMsg = await waitFor(() => game.messages.contents.find(m => (m.getFlag(MOD, 'kitTendFor') === card?.id) && m.rolls?.length), 8000);
        realDice();
        const receipt = await waitFor(() => healMsg?.getFlag(MOD, 'receipt'), 8000);
        const prof = Number(cleric.system.attributes.prof) || 0;
        ok('6b. Tend: the Cleric’s die spent on its class, the feature’s own heal of that size rolled (5 + PB), the healing landed',
          !!done?.spent && (Number(cls.system.hd.spent) === 1) && new RegExp(`1d${faces0}`).test(healMsg?.rolls?.[0]?.formula ?? '')
            && !!receipt && (Number(cleric.system.attributes.hp.value) === 1 + 5 + prof),
          `done=${JSON.stringify(done ? { spent: done.spent, faces: done.faces } : null)} hdSpent=${cls.system.hd.spent} formula="${healMsg?.rolls?.[0]?.formula ?? ''}" hp=${cleric.system.attributes.hp.value}`);
      }
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'heal', out, plan, f });
