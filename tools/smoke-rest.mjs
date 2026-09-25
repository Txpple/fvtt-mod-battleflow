// Battle Flow rest smoke test — THE REST GRANTS (2026-09-25, the Human walk: "human i think just
// needs initiatve to be ticked on long rest"): Resourceful's Heroic Inspiration on a Long Rest.
//
// Fixtures: BF Test Halfling (a character; tools/fixture-suite.mjs) is lent the PHB's Resourceful
// for the run. Its hit points, hit dice, uses and inspiration are put back afterwards.
//
// Harness discipline: every setting touched is restored; the lent item and every message this run
// creates are deleted; the actor's own state is restored from its source.
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'rest-grants.js'          // §1–§3 — the grant on the rest's own update, the card's line, the switches
];

const SECTIONS = {
  1: 'a Long Rest with Resourceful: the Heroic Inspiration box is ticked, and the rest card says "Heroic Inspiration gained"',
  2: 'a Short Rest: nothing is given',
  3: 'Resourceful off the Rest Grants list: a Long Rest gives nothing'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'rest', watchdogMs: 180_000 });
announcePlan('rest', plan, pulled);

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
  if (!game.settings.settings.has(`${MOD}.restGrantList`)) return { fatal: 'restGrantList not registered — OLD code (reload the box)' };

  const prior = { restGrantList: game.settings.get(MOD, 'restGrantList') };
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const actor = game.actors.getName('BF Test Halfling');
  if (!actor || (actor.type !== 'character')) return { fatal: 'missing fixture: BF Test Halfling (a character) — run tools/fixture-suite.mjs' };
  const snapshot = actor.toObject();
  const lent = [];
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      const live = lent.filter(id => actor.items.get(id));
      if (live.length) await actor.deleteEmbeddedDocuments('Item', live);
      await actor.update({ system: { attributes: snapshot.system.attributes } }, { isRest: true });
      const items = snapshot.items.filter(i => actor.items.get(i._id)).map(i => ({ _id: i._id, 'system.uses': i.system?.uses ?? {} }));
      if (items.length) await actor.updateEmbeddedDocuments('Item', items);
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart) && ((m.speaker?.actor === actor.id) || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('restGrantList', def('restGrantList'));
    // Lend Resourceful from the PHB — found by name in the pack's item indexes.
    let source = null;
    for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
      const hit = (await pack.getIndex()).find(e => e.name === 'Resourceful');
      if (hit) { source = await pack.getDocument(hit._id); break; }
    }
    if (!source) return { fatal: 'the PHB ships no "Resourceful" item this box can find' };
    if (!actor.items.some(i => i.name === 'Resourceful')) {
      const [item] = await actor.createEmbeddedDocuments('Item', [source.toObject()]);
      lent.push(item.id);
    }
    const inspired = () => actor.system.attributes.inspiration === true;
    const clear = () => actor.update({ 'system.attributes.inspiration': false });
    const lastRestCard = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.speaker?.actor === actor.id)).pop() ?? null;
    const textOf = id => (document.querySelector(`.message[data-message-id="${id}"]`)?.textContent ?? '').replace(/\s+/g, ' ');

    // ================================================== 1. a Long Rest
    if (want(1)) {
      await clear();
      await actor.longRest({ dialog: false, chat: true, newDay: false, advanceTime: false });
      await sleep(800);
      const card = lastRestCard();
      ok('1a. the Long Rest ticked Heroic Inspiration', inspired(), `inspiration=${actor.system.attributes.inspiration}`);
      ok('1b. the rest card says "Heroic Inspiration gained" (Resourceful)',
        (card?.getFlag(MOD, 'restGrant') ?? []).some(g => g.name === 'Resourceful') && /Heroic Inspiration gained/.test(textOf(card?.id)),
        `flag=${JSON.stringify(card?.getFlag(MOD, 'restGrant'))} text="${textOf(card?.id).slice(-120)}"`);
    }

    // ================================================== 2. a Short Rest
    if (want(2)) {
      await clear();
      await actor.shortRest({ dialog: false, chat: true, advanceTime: false });
      await sleep(600);
      ok('2a. a Short Rest gives nothing', !inspired(), `inspiration=${actor.system.attributes.inspiration}`);
    }

    // ================================================== 3. off the list
    if (want(3)) {
      await clear();
      await set('restGrantList', '');
      await actor.longRest({ dialog: false, chat: true, newDay: false, advanceTime: false });
      await sleep(600);
      ok('3a. Resourceful off the list: the Long Rest gives nothing', !inspired(), `inspiration=${actor.system.attributes.inspiration}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'rest', out, plan, f });
