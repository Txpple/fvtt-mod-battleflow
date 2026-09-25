// Battle Flow rest smoke test — THE REST GRANTS (2026-09-25, the Human walk: "human i think just
// needs initiatve to be ticked on long rest"): Resourceful's Heroic Inspiration on a Long Rest.
//
// THE SONG (2026-09-25, the origin feats: "for musician, give a courtesy popup after long and short
// rest, listing the allies within 30 ft, player picks which oens to give inspiration. grey out the
// ones that already have and so note it"): §4–§7.
//
// Fixtures: BF Test Halfling (a character; tools/fixture-suite.mjs) is lent the PHB's Resourceful
// and Musician for the run. Its hit points, hit dice, uses and inspiration are put back afterwards.
// The song's sections place TEMPORARY linked tokens on the test range — the Halfling, BF Test
// Cleric 10 ft away, BF Test Bard 15 ft away (already inspired), BF Test Fighter 40 ft away — in a
// strip the suite finds empty at run time, and delete them in teardown.
//
// Harness discipline: every setting touched is restored; the lent items, the placed tokens and every
// message this run creates are deleted; each actor's own state is restored from its source.
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'rest-grants.js'          // §1–§3 — the grant on the rest's own update, the card's line, the switches; §4–§7 the song to allies
];

const SECTIONS = {
  1: 'a Long Rest with Resourceful: the Heroic Inspiration box is ticked, and the rest card says "Heroic Inspiration gained"',
  2: 'a Short Rest: nothing is given',
  3: 'Resourceful off the Rest Grants list: a Long Rest gives nothing',
  4: 'Musician after a Long Rest: the card lists the allies within 30 ft (not the one at 40), the popup ticks the one without Heroic Inspiration and greys the one with it ("already has"); OK gives it, the card names who',
  5: 'Musician after a Short Rest: it asks too',
  6: 'every ally within 30 ft already has Heroic Inspiration: no card, no popup',
  7: 'Musician off the Rest Grants list: no card'
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
  const placed = [];      // the song's temporary tokens
  const snapshots = [];   // the song's allies' inspiration
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      const scene = game.scenes.getName('Battle Flow Test Range');
      const live = placed.filter(id => scene?.tokens.get(id));
      if (live.length) await scene.deleteEmbeddedDocuments('Token', live);
      for (const s of snapshots) await s.actor.update({ 'system.attributes.inspiration': s.inspiration });
    } catch (err) { log.push(`TEARDOWN tokens ERROR: ${err?.message}`); }
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
    await set('restGrantList', 'Resourceful');   // the song (Musician) has its own sections below
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

    // ================================================== 4–7. the song
    if (['4', '5', '6', '7'].some(id => !sections || sections.includes(id))) {
      await set('restGrantList', 'Musician');   // Resourceful out: the Halfling's own box stays out of it
      let musician = null;
      for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
        const hit = (await pack.getIndex()).find(e => e.name === 'Musician');
        if (hit) { musician = await pack.getDocument(hit._id); break; }
      }
      if (!musician) return { fatal: 'the PHB ships no "Musician" item this box can find', results, log, skips };
      if (!actor.items.some(i => i.name === 'Musician')) {
        const [item] = await actor.createEmbeddedDocuments('Item', [musician.toObject()]);
        lent.push(item.id);
      }
      const scene = game.scenes.getName('Battle Flow Test Range');
      if (!scene) return { fatal: 'missing fixture: the Battle Flow Test Range scene — run tools/fixture-suite.mjs', results, log, skips };
      if (canvas.scene?.id !== scene.id) await scene.view();
      for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
      const g = scene.grid.size;
      const allies = ['BF Test Cleric', 'BF Test Bard', 'BF Test Fighter'].map(n => game.actors.getName(n));
      if (allies.some(a => !a || (a.type !== 'character'))) return { fatal: `missing fixture characters: ${allies.map(a => a?.name ?? '?').join(', ')}`, results, log, skips };
      const [cleric, bard, fighter] = allies;
      for (const a of allies) snapshots.push({ actor: a, inspiration: a.system.attributes.inspiration });
      // A strip of 10 squares on one row with nothing on it, three rows clear above and below.
      const occupied = (x, y) => scene.tokens.some(t => (t.x < (x + 1) * g) && ((t.x + t.width * g) > x * g) && (t.y < (y + 1) * g) && ((t.y + t.height * g) > y * g));
      let strip = null;
      for (let y = 3; (y < 17) && !strip; y++) {
        for (let x = 0; (x <= 10) && !strip; x++) {
          let clear = true;
          for (let dx = 0; (dx < 10) && clear; dx++) for (let dy = -1; (dy <= 1) && clear; dy++) if (occupied(x + dx, y + dy)) clear = false;
          if (clear) strip = { x, y };
        }
      }
      if (!strip) return { fatal: 'no empty 10-square strip on the test range for the song\'s tokens', results, log, skips };
      const place = async (a, dx) => {
        const [doc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(a.prototypeToken.toObject(),
          { x: (strip.x + dx) * g, y: strip.y * g, actorId: a.id, actorLink: true, disposition: 1 }, { inplace: false })]);
        placed.push(doc.id);
        for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
        return canvas.tokens.get(doc.id);
      };
      const own = await place(actor, 0);
      await place(cleric, 2);    // 10 ft
      await place(bard, 3);      // 15 ft
      await place(fighter, 8);   // 40 ft
      own?.control({ releaseOthers: true });   // tokenOfActor: the controlled token is the actor's
      const songCard = t0 => game.messages.contents.filter(m => (m.timestamp >= t0) && m.getFlag(MOD, 'restSong')).pop() ?? null;
      const songPopup = () => [...foundry.applications.instances.values()]
        .find(app => app.rendered && (app.element?.textContent ?? '').includes('Who gets Heroic Inspiration')) ?? null;
      const waitFor = async (test, timeout = 8000) => {
        const until = Date.now() + timeout;
        while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
        return test();
      };
      const boxOf = (app, a) => app?.element?.querySelector(`input[name="bf-rest-song"][value="${a.uuid}"]`) ?? null;
      const prime = async () => {
        await cleric.update({ 'system.attributes.inspiration': false });
        await bard.update({ 'system.attributes.inspiration': true });
        await fighter.update({ 'system.attributes.inspiration': false });
      };

      if (want(4)) {
        await prime();
        const t0 = Date.now();
        await actor.longRest({ dialog: false, chat: true, newDay: false, advanceTime: false });
        const card = await waitFor(() => songCard(t0), 6000);
        const flag = card?.getFlag(MOD, 'restSong');
        const names = (flag?.candidates ?? []).map(c => `${c.name}:${c.feet}${c.has ? ':has' : ''}`);
        ok('4a. the card lists the allies within 30 ft — the Cleric (10 ft), the Bard (15 ft, already has it) — and not the Fighter at 40',
          !!flag && flag.candidates.some(c => (c.uuid === cleric.uuid) && !c.has) && flag.candidates.some(c => (c.uuid === bard.uuid) && c.has)
            && !flag.candidates.some(c => c.uuid === fighter.uuid) && (flag.cap === Number(actor.system.attributes.prof)),
          `candidates=${names.join(', ')} cap=${flag?.cap} prof=${actor.system.attributes.prof}`);
        const app = await waitFor(songPopup, 6000);
        const cb = boxOf(app, cleric), bb = boxOf(app, bard);
        ok('4b. the popup: the Cleric ticked, the Bard greyed and marked "already has Heroic Inspiration"',
          !!cb?.checked && !cb?.disabled && !!bb?.disabled && !bb?.checked && /already has Heroic Inspiration/.test(bb?.closest('label')?.textContent ?? ''),
          `popup=${!!app} cleric=${cb?.checked}/${cb?.disabled} bard=${bb?.checked}/${bb?.disabled}`);
        app?.element?.querySelector('button[data-action="ok"]')?.click();
        const landed = await waitFor(() => card?.getFlag(MOD, 'restSong')?.applied, 6000);
        ok('4c. OK gives it: the Cleric has Heroic Inspiration, the Fighter does not, the card names the Cleric',
          !!landed && (cleric.system.attributes.inspiration === true) && (fighter.system.attributes.inspiration !== true)
            && (card.getFlag(MOD, 'restSong').given ?? []).includes(cleric.name),
          `applied=${!!landed} cleric=${cleric.system.attributes.inspiration} fighter=${fighter.system.attributes.inspiration} given=${JSON.stringify(card?.getFlag(MOD, 'restSong')?.given)}`);
      }

      if (want(5)) {
        await prime();
        const t0 = Date.now();
        await actor.shortRest({ dialog: false, chat: true, advanceTime: false });
        const card = await waitFor(() => songCard(t0), 6000);
        ok('5a. a Short Rest asks too', !!card, `card=${!!card}`);
        const app = await waitFor(songPopup, 4000);
        app?.element?.querySelector('button[data-action="ok"]')?.click();
        await waitFor(() => card?.getFlag(MOD, 'restSong')?.applied, 6000);
      }

      if (want(6)) {
        await prime();
        await cleric.update({ 'system.attributes.inspiration': true });
        const t0 = Date.now();
        await actor.longRest({ dialog: false, chat: true, newDay: false, advanceTime: false });
        await sleep(1200);
        ok('6a. everyone within 30 ft already has it: no card, no popup', !songCard(t0) && !songPopup(), `card=${!!songCard(t0)} popup=${!!songPopup()}`);
      }

      if (want(7)) {
        await prime();
        await set('restGrantList', '');
        const t0 = Date.now();
        await actor.longRest({ dialog: false, chat: true, newDay: false, advanceTime: false });
        await sleep(1200);
        ok('7a. Musician off the list: no card', !songCard(t0), `card=${!!songCard(t0)}`);
      }
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'rest', out, plan, f });
