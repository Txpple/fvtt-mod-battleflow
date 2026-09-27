// Battle Flow rest smoke test — THE REST GRANTS (2026-09-25, the Human walk: "human i think just
// needs initiatve to be ticked on long rest"): Resourceful's Heroic Inspiration on a Long Rest.
//
// THE SONG (2026-09-25, the origin feats: "for musician, give a courtesy popup after long and short
// rest, listing the allies within 30 ft, player picks which oens to give inspiration. grey out the
// ones that already have and so note it"): §4–§7.
//
// Fixtures: BF Test Halfling (a character; tools/fixture-suite.mjs) is lent the PHB's Resourceful
// and Musician for the run. Its hit points, hit dice, uses and inspiration are put back afterwards.
// §8–§11 (the PHB feats, group 5, 2026-09-27) lend Inspiring Leader and Chef and reuse the song's
// tokens; every creature they touch keeps its hit points, Hit Dice and temp HP (restored whole).
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
  4: 'Musician after a Long Rest: the card lists the allies within 30 ft (not the one at 40), the popup ticks the one without Heroic Inspiration and greys the one with it ("(has it)"); OK gives it, the card names who',
  5: 'Musician after a Short Rest: it asks too',
  6: 'every ally within 30 ft already has Heroic Inspiration: no card, no popup',
  7: 'Musician off the Rest Grants list: no card',
  8: 'Inspiring Leader (the PHB feats, group 5) after a Short Rest: the amount read off its activity (level + the higher of Wis/Cha on a copy with no ASI record), up to six, the owner too, within 30 ft; a creature holding more is greyed; OK gives the temp HP',
  9: 'Chef after a Long Rest: Bolstering Treats handed out as the Proficiency Bonus in temp HP, up to that many, every ally on the scene; no meal on a Long Rest',
  10: 'Chef after a Short Rest: Replenishing Meal — the Cleric rested first and spent Hit Dice (healed 1d8 now, its dice on a card), the Fighter spent none (greyed), the Bard still resting (carries the meal); every Short Rest card records its Hit Dice',
  11: 'the Bard\'s own Short Rest ends with Hit Dice spent: the meal heals it then'
};
const DEPENDS = { 11: ['10'] };

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
      for (const s of snapshots) {
        if (s.whole) {
          await s.actor.update({ system: { attributes: s.whole.system.attributes } }, { isRest: true });
          const classes = s.whole.items.filter(i => (i.type === 'class') && s.actor.items.get(i._id))
            .map(i => ({ _id: i._id, 'system.hd.spent': i.system?.hd?.spent ?? 0 }));
          if (classes.length) await s.actor.updateEmbeddedDocuments('Item', classes);
          if (s.actor.getFlag(MOD, 'mealFed')) await s.actor.unsetFlag(MOD, 'mealFed');
        }
        for (const a of game.actors.filter(x => x.getFlag(MOD, 'mealFed'))) await a.unsetFlag(MOD, 'mealFed');
        await s.actor.update({ 'system.attributes.inspiration': s.inspiration });
      }
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
    if (['4', '5', '6', '7', '8', '9', '10', '11'].some(id => !sections || sections.includes(id))) {
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
        ok('4b. the popup: the Cleric ticked, the Bard greyed and marked "(has it)"',
          !!cb?.checked && !cb?.disabled && !!bb?.disabled && !bb?.checked && /(has it)/.test(bb?.closest('label')?.textContent ?? ''),
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

      // ================================================== 8–11. the PHB feats, group 5 (2026-09-27)
      // The same popup, a grant of Temporary Hit Points (Inspiring Leader, Chef's Bolstering Treats)
      // and Chef's Replenishing Meal. Each lends the PHB's own feat and reads the amount the way the
      // machine must: off the feat's heal activity, on the Halfling's sheet.
      const lendFeat = async name => {
        if (actor.items.some(i => i.name === name)) return actor.items.find(i => i.name === name);
        let doc = null;
        for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
          const hit = (await pack.getIndex()).find(e => (e.name === name) && (e.type === 'feat'));
          if (hit) { doc = await pack.getDocument(hit._id); break; }
        }
        if (!doc) return null;
        const [item] = await actor.createEmbeddedDocuments('Item', [doc.toObject()]);
        lent.push(item.id);
        return item;
      };
      const popupFor = text => [...foundry.applications.instances.values()]
        .find(app => app.rendered && (app.element?.textContent ?? '').includes(text)) ?? null;
      const tempOf = a => Number(a.system.attributes.hp.temp) || 0;
      // ⚠ A row with no reach lists EVERY ally on the scene — the test range carries party tokens (Gren)
      // and other fixtures. The popup's ticks are set to the suite's own creatures only before OK.
      const tickOnly = (app, keep) => {
        for (const box of app?.element?.querySelectorAll('input[name="bf-rest-song"]') ?? []) {
          // the cap greys unticked rows (disabled); only a "has it" row stays out of reach
          const on = !box.dataset.has && keep.some(a => a.uuid === box.value);
          box.checked = on;
          if (on) box.disabled = false;
        }
      };
      const hpOf = a => Number(a.system.attributes.hp.value) || 0;
      // Every creature this block touches keeps its hit points, Hit Dice and temp HP (teardown restores).
      for (const a of [actor, ...allies]) {
        if (!snapshots.some(s => s.actor === a && s.whole)) {
          const whole = a.toObject();
          snapshots.push({ actor: a, whole, inspiration: a.system.attributes.inspiration });
        }
      }

      if (want(8)) {
        await set('restGrantList', 'Inspiring Leader');
        const feat = await lendFeat('Inspiring Leader');
        if (!feat) return { fatal: 'the PHB ships no "Inspiring Leader" feat this box can find', results, log, skips };
        // The lent copy carries no Ability Score Improvement record, so the higher of Wisdom and
        // Charisma stands (the Poisoner's pick); the amount is the activity's own: level + that modifier.
        const mod = Math.max(actor.system.abilities.wis.mod, actor.system.abilities.cha.mod);
        const amount = Number(actor.system.details.level) + mod;
        await cleric.update({ 'system.attributes.hp.temp': 0 });
        await bard.update({ 'system.attributes.hp.temp': amount + 5 });   // holds more already — greyed
        await fighter.update({ 'system.attributes.hp.temp': 0 });
        await actor.update({ 'system.attributes.hp.temp': 0 });
        const t0 = Date.now();
        await actor.shortRest({ dialog: false, chat: true, advanceTime: false });
        const card = await waitFor(() => songCard(t0), 6000);
        const flag = card?.getFlag(MOD, 'restSong');
        const names = (flag?.candidates ?? []).map(c => `${c.name}:${c.feet}${c.has ? ':has' : ''}`);
        ok('8a. Inspiring Leader after a Short Rest: the amount is the activity\'s (level + the higher of Wis/Cha), up to six, the owner too, within 30 ft',
          !!flag && (flag.grant === 'temphp') && (flag.amount === amount) && (flag.cap === 6)
            && flag.candidates.some(c => (c.uuid === actor.uuid) && c.self) && flag.candidates.some(c => (c.uuid === cleric.uuid) && !c.has)
            && flag.candidates.some(c => (c.uuid === bard.uuid) && c.has) && !flag.candidates.some(c => c.uuid === fighter.uuid),
          `amount=${flag?.amount} expected=${amount} cap=${flag?.cap} candidates=${names.join(', ')}`);
        const app = await waitFor(() => popupFor(`Who gets ${amount} Temporary Hit Points`), 6000);
        const bb = boxOf(app, bard);
        ok('8b. the popup asks "Who gets N Temporary Hit Points?", the Bard greyed with what it holds',
          !!app && !!bb?.disabled && /temp HP/.test(bb?.closest('label')?.textContent ?? ''),
          `popup=${!!app} bard=${bb?.disabled} "${(bb?.closest('label')?.textContent ?? '').replace(/\s+/g, ' ').trim()}"`);
        app?.element?.querySelector('button[data-action="ok"]')?.click();
        const landed = await waitFor(() => card?.getFlag(MOD, 'restSong')?.applied, 6000);
        ok('8c. OK gives it: the Cleric and the leader hold the amount, the Bard keeps its larger pool, the Fighter (40 ft) nothing',
          !!landed && (tempOf(cleric) === amount) && (tempOf(actor) === amount) && (tempOf(bard) === amount + 5) && (tempOf(fighter) === 0),
          `cleric=${tempOf(cleric)} self=${tempOf(actor)} bard=${tempOf(bard)} fighter=${tempOf(fighter)} amount=${amount}`);

        // 8d. A feat taken through its Ability Score Improvement names the ability — the LOWER one here
        // (Wisdom 16, Charisma 10, the record says Charisma), so the amount is level + 0, not level + 3;
        // the rest card keeps that one activity row, called "Inspire with Performance" (the walk).
        // The live item's advancement is a collection (`feat.advancement.byId`, lookup.js asiAssigned's
        // read); the write goes to the SOURCE, which may be keyed by id or a list — both are written back whole.
        const asi = Object.values(feat.advancement?.byId ?? {}).find(v => v?.type === 'AbilityScoreImprovement');
        if (!asi) skips.push('8d. the lent feat carries no Ability Score Improvement advancement');
        else {
          const was = { wis: actor.system.abilities.wis.value, cha: actor.system.abilities.cha.value };
          await actor.update({ 'system.abilities.wis.value': 16, 'system.abilities.cha.value': 10 });
          const src = foundry.utils.deepClone(feat.toObject().system.advancement);
          const row = Array.isArray(src) ? src.find(r => r._id === asi.id) : src[asi.id];
          foundry.utils.setProperty(row, 'value.assignments', { cha: 1 });
          await feat.update({ 'system.advancement': src });
          for (const a of [actor, cleric, bard, fighter]) await a.update({ 'system.attributes.hp.temp': 0 });
          const want8d = Number(actor.system.details.level) + actor.system.abilities.cha.mod;
          const t1 = Date.now();
          await actor.shortRest({ dialog: false, chat: true, advanceTime: false });
          const card8d = await waitFor(() => songCard(t1), 6000);
          const f8d = card8d?.getFlag(MOD, 'restSong');
          const rest = game.messages.contents.find(m => (m.timestamp >= t1) && (m.type === 'rest'));
          await sleep(500);
          const rows = [...(document.querySelector(`#chat [data-message-id="${rest?.id}"]`)?.querySelectorAll('.activities li.activity') ?? [])];
          const subs = rows.map(li => li.querySelector('.subtitle')?.textContent?.trim());
          ok('8d. the feat’s own Ability Score Improvement names the ability (Charisma, the lower): level + its modifier; the rest card lists ONE row, "Inspire with Performance"',
            (f8d?.amount === want8d) && (subs.filter(n => /Inspire with/.test(n ?? '')).length === 1) && subs.includes('Inspire with Performance'),
            `amount=${f8d?.amount} expected=${want8d} rows=[${subs.join(' | ')}] rest=${rest?.id}/${rest?.system?.type}/${rest?.system?.actor?.uuid} lis=[${rows.map(li => li.dataset.activityUuid).join(',')}] acts=[${[...feat.system.activities].map(x => x.uuid).join(',')}]`);
          const app8d = await waitFor(() => popupFor('Temporary Hit Points'), 6000);
          app8d?.close?.();
          await actor.update({ 'system.abilities.wis.value': was.wis, 'system.abilities.cha.value': was.cha });
        }
      }

      if (want(9)) {
        await set('restGrantList', 'Bolstering Treats, Replenishing Meal');
        const chef = await lendFeat('Chef');
        if (!chef) return { fatal: 'the PHB ships no "Chef" feat this box can find', results, log, skips };
        const prof = Number(actor.system.attributes.prof);
        for (const a of [actor, cleric, bard, fighter]) await a.update({ 'system.attributes.hp.temp': 0 });
        const t0 = Date.now();
        await actor.longRest({ dialog: false, chat: true, newDay: false, advanceTime: false });
        const card = await waitFor(() => songCard(t0), 6000);
        const flag = card?.getFlag(MOD, 'restSong');
        ok('9a. Chef after a Long Rest: Bolstering Treats handed out — the Proficiency Bonus as Temporary Hit Points, up to that many, every ally on the scene (the Fighter at 40 ft too)',
          !!flag && (flag.row === 'Bolstering Treats') && (flag.amount === prof) && (flag.cap === prof) && (flag.reach === null)
            && flag.candidates.some(c => c.uuid === fighter.uuid),
          `row=${flag?.row} amount=${flag?.amount} cap=${flag?.cap} reach=${flag?.reach} candidates=${(flag?.candidates ?? []).map(c => c.name).join(', ')}`);
        const app = await waitFor(() => popupFor(`Who gets ${prof} Temporary Hit Points`), 6000);
        const startTicked = [...(app?.element?.querySelectorAll('input[name="bf-rest-song"]:checked') ?? [])].length;
        const mine = [cleric, fighter].slice(0, prof);
        tickOnly(app, mine);
        app?.element?.querySelector('button[data-action="ok"]')?.click();
        await waitFor(() => card?.getFlag(MOD, 'restSong')?.applied, 6000);
        const given = [actor, cleric, bard, fighter].filter(a => tempOf(a) === prof).map(a => a.uuid);
        ok('9b. the first cap-many start ticked; OK gives exactly the picked the treats (the Cleric, the Fighter at 40 ft)',
          (startTicked === Math.min(prof, flag?.candidates?.length ?? 0)) && (given.length === mine.length) && mine.every(a => given.includes(a.uuid)),
          `startTicked=${startTicked} given=${given.length} picked=${mine.length} prof=${prof}`);
        ok('9c. a Long Rest is not Replenishing Meal\'s — no meal card', !game.messages.contents.some(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'restSong')?.row === 'Replenishing Meal')),
          'a meal card appeared on a Long Rest');
      }

      // The meal in both orders: the Cleric has rested (Hit Dice spent), the Fighter has rested (none
      // spent), the Bard has not rested yet — then the Chef's own Short Rest asks.
      let mealCard = null;
      if (want(10)) {
        await set('restGrantList', 'Replenishing Meal');   // the Long Rest below must not hand out treats
        if (!await lendFeat('Chef')) return { fatal: 'the PHB ships no "Chef" feat this box can find', results, log, skips };
        await actor.longRest({ dialog: false, chat: false, newDay: false, advanceTime: false });   // Hit Dice back, a clean slate
        for (const m of game.messages.contents.filter(m => m.getFlag(MOD, 'restSong') && (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'restSong').status === 'pending'))) await m.delete();
        for (const a of [cleric, bard, fighter]) await a.longRest({ dialog: false, chat: false, newDay: false, advanceTime: false });
        await cleric.update({ 'system.attributes.hp.value': Math.max(1, cleric.system.attributes.hp.max - 20) });
        await bard.update({ 'system.attributes.hp.value': Math.max(1, bard.system.attributes.hp.max - 20) });
        // The Cleric rests first and spends Hit Dice (autoHD, no dialog); the Fighter rests at full HP and spends none.
        await cleric.shortRest({ dialog: false, chat: true, advanceTime: false, autoHD: true, autoHDThreshold: 1 });
        await fighter.shortRest({ dialog: false, chat: true, advanceTime: false });
        await sleep(600);
        const clericCard = game.messages.contents.filter(m => (m.type === 'rest') && (m.speaker?.actor === cleric.id)).pop();
        const spentCleric = clericCard?.getFlag(MOD, 'restSpent');
        ok('10a. every Short Rest card records the Hit Dice its creature spent (the Cleric\'s, autoHD)',
          (spentCleric?.actorUuid === cleric.uuid) && (spentCleric?.hitDice > 0), JSON.stringify(spentCleric ?? null));
        const clericHp = hpOf(cleric);
        const t0 = Date.now();
        await actor.shortRest({ dialog: false, chat: true, advanceTime: false });
        mealCard = await waitFor(() => game.messages.contents.filter(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'restSong')?.row === 'Replenishing Meal')).pop(), 6000);
        const flag = mealCard?.getFlag(MOD, 'restSong');
        const cOf = a => flag?.candidates?.find(c => c.uuid === a.uuid);
        ok('10b. the Chef\'s Short Rest asks who eats — up to 4 + Proficiency Bonus; the Cleric spent Hit Dice, the Fighter spent none (greyed), the Bard is still resting',
          !!flag && (flag.grant === 'meal') && (flag.formula === '1d8') && (flag.cap === 4 + Number(actor.system.attributes.prof))
            && (cOf(cleric)?.meal === 'spent') && !cOf(cleric)?.has && (cOf(fighter)?.meal === 'none') && cOf(fighter)?.has
            && (cOf(bard)?.meal === 'resting') && !cOf(bard)?.has,
          `formula=${flag?.formula} cap=${flag?.cap} ${(flag?.candidates ?? []).map(c => `${c.name}:${c.meal}${c.has ? ':greyed' : ''}`).join(', ')}`);
        const app = await waitFor(() => popupFor('Who gets an extra 1d8 Hit Points'), 6000);
        tickOnly(app, [cleric, bard]);
        app?.element?.querySelector('button[data-action="ok"]')?.click();
        const landed = await waitFor(() => mealCard?.getFlag(MOD, 'restSong')?.applied, 8000);
        const served = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && (m.rolls?.length) && /Replenishing Meal/.test(m.content ?? '') && m.content.includes(cleric.name)), 6000);
        const gain = hpOf(cleric) - clericHp;
        const rolled = served?.rolls?.[0]?.total;
        ok('10c. OK: the Cleric (rested, Hit Dice spent) is healed now by the rolled 1d8, on one card with the dice',
          !!landed && !!served && Number.isFinite(rolled) && (rolled >= 1) && (rolled <= 8) && (gain === Math.min(rolled, cleric.system.attributes.hp.max - clericHp)),
          `served=${!!served} rolled=${rolled} gain=${gain}`);
        const fed = bard.getFlag(MOD, 'mealFed');
        ok('10d. the Bard, still resting, carries the meal to its own rest\'s end; the card says it waits',
          (fed?.formula === '1d8') && ((mealCard?.getFlag(MOD, 'restSong')?.waiting ?? []).join() === bard.name),
          `fed=${JSON.stringify(fed ?? null)} waiting=${JSON.stringify(mealCard?.getFlag(MOD, 'restSong')?.waiting)}`);
      }

      if (want(11)) {
        if (!bard.getFlag(MOD, 'mealFed')) {
          skips.push('§11 needs §10 (the Bard carrying the meal)');
        } else {
          const before = hpOf(bard);
          const t1 = Date.now();
          await bard.shortRest({ dialog: false, chat: true, advanceTime: false, autoHD: true, autoHDThreshold: 1 });
          const served = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t1) && (m.rolls?.length) && /Replenishing Meal/.test(m.content ?? '') && m.content.includes(bard.name)), 8000);
          await waitFor(() => !bard.getFlag(MOD, 'mealFed'), 4000);
          const restCard = game.messages.contents.filter(m => (m.type === 'rest') && (m.speaker?.actor === bard.id)).pop();
          const spent = restCard?.getFlag(MOD, 'restSpent')?.hitDice ?? 0;
          ok('11a. the Bard\'s own Short Rest ends with Hit Dice spent: the meal\'s 1d8 heals it then, its card with the dice, and the mark is gone',
            (spent > 0) && !!served && !bard.getFlag(MOD, 'mealFed') && (hpOf(bard) > before),
            `spent=${spent} served=${!!served} fed=${!!bard.getFlag(MOD, 'mealFed')} hp ${before} → ${hpOf(bard)}`);
        }
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
