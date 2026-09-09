// Battle Flow metamagic smoke test — THE METAMAGIC PASS (user, 2026-09-09: "need metamagic
// implemented … follow pattern like sneak attk/manuevers with check box"; DESIGN §6 *Metamagic*).
// Stage 1: the group in the casting window (a row per option the sheet grants, the tag, the
// rule folded under, one pick greys the rest), the spend BY HAND on the spell's card (the
// poolSpend record the flash, the card line and the ledger read), and the three data-only
// options — Subtle (a line), Quickened (a line, 2 SP), Distant (the gate's range doubled).
// Stage 2: Careful's protected creatures leave the save demand (the area's adoption road), the
// picker on the card adjusts the list, Heightened's mark rides the demand into the save gate.
// Stage 3: Twinned's fit off the source target count, Transmuted's type on every roll of the cast,
// Extended's doubled clock on the effects the cast lands and its Advantage on the concentration save.
//
// Fixtures: BF Test Sorcerer (Sorcerer 5, Font of Magic at 5 points, all ten options, Fireball /
// Hold Person / Chromatic Orb — tools/fixture-suite.mjs), BF Test Attacker and BF Test Victim (the
// goblins), BF Test Ranger (an ally under the area).
//
// Harness discipline: every setting touched is restored; every message this run creates is
// deleted; the pool it spends and the slots it burns are refilled; the token it moves goes home;
// its dialogs are closed.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'the casting window carries the group: Fireball on the Sorcerer shows the eight cast-time rows — six fit, Extended (instantaneous) and Twinned greyed with the reason as the tag — the pool line reads 5 of 5, every row folds its rule',
  2: 'one option per cast: ticking Subtle greys the other rows; unticking frees them',
  3: 'Subtle Spell, cast: the card is born with the pick, the points spend BY HAND on the card (Font of Magic 5 → 4; poolSpend says Sorcery Points 4 of 5), the card carries the metamagic line and the resource line',
  4: 'Quickened Spell costs 2: Fireball again, the pool 4 → 2, the card says Bonus Action',
  5: 'Distant Spell on Chromatic Orb: the card carries 180 ft; the attack gate\'s range reminder reads the doubled range for a target at 120 ft (in normal range with Distant, beyond it without)',
  6: 'no points: with Font of Magic spent out every row stays, greyed, "1 SP — 0 left"; the pool line says 0 of 5',
  7: 'the list is the switch: an empty Metamagic list draws no group; a list of one draws one row',
  8: 'the registration FIRED (§11): renderActivityUsageDialog and dnd5e.postUseActivity moved',
  9: 'Careful Spell (Stage 2): a bare Fireball cast with Careful, the area placed over the Sorcerer, the Ranger and the two goblins — the two allies leave the demand (protected, the caster first), the goblins owe the save, the card names the protected, no ask opens for them',
  10: 'Heightened Spell (Stage 2): the same area — the first goblin is marked on the demand; its save gate opens with "Heightened Spell" as a Disadvantage source and Disadvantage as the default; the other goblin\'s gate carries no such source',
  11: 'the picker to adjust (Stage 2): from the card, the Ranger is released from Careful\'s list — the Ranger joins the demand as a fresh entry, the Sorcerer stays protected',
  12: 'Twinned Spell (Stage 3): Hold Person fits (its source target count is a formula over the cast\'s level), Fireball does not; the cast spends the point and the card says one more target',
  13: 'Transmuted Spell (Stage 3): ticking it shows the five other listed types; cold picked; the card carries cold from fire; the spell\'s damage roll chained to the card wears cold',
  14: 'Extended Spell (Stage 3): Hold Person on the Victim, a forced failure — Paralyzed lands with its clock doubled (120 s); the caster\'s concentration save opens with Extended Spell as an Advantage source'
};
const DEPENDS = { 4: ['3'], 11: ['9'] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'metamagic', watchdogMs: 600_000 });
announcePlan('metamagic', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const errors = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitFor = async (fn, ms = 6000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) return null; await sleep(step); } };
  const suiteStart = Date.now();
  const ledger = globalThis.__bfHookLedger ?? null;
  const count = name => ledger?.[name] ?? 0;
  const origError = console.error, origWarn = console.warn;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
  console.warn = (...a) => { if (String(a[0]).includes('Battle Flow')) errors.push(a.map(String).join(' ')); origWarn(...a); };

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.metamagicList`)) return { fatal: 'metamagicList not registered — OLD code (deploy --local, wait out the cache, or restart the box)' };

  const SETTING_KEYS = ['metamagicList', 'reminderList', 'requireTarget', 'saves', 'autoApply', 'saveTimer'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const sorc = game.actors.getName('BF Test Sorcerer');
  const attacker = game.actors.getName('BF Test Attacker');
  if (!scene || !sorc || !attacker) return { fatal: 'missing fixture: scene, BF Test Sorcerer or BF Test Attacker — run tools/fixture-suite.mjs' };
  const tok = actor => scene.tokens.find(t => t.actorId === actor.id) ?? null;
  const sorcTok = tok(sorc), attTok = tok(attacker);
  if (!sorcTok || !attTok) return { fatal: 'a fixture token is missing — run tools/fixture-suite.mjs' };
  if (canvas.scene?.id !== scene.id) { await scene.view(); await sleep(1500); }
  const attHome = { x: attTok.x, y: attTok.y };
  const sorcHome = { x: sorcTok.x, y: sorcTok.y };
  // The uniform spend's reader (poolSpendsOn) draws the flash and the card line for PLAYER-OWNED
  // actors only — the party's meters are the commission. The fixture is GM-owned (the harness's
  // rule), so a player owner is granted for the run and taken back after, as BF Test PC Attacker's is.
  const player = game.users.find(u => !u.isGM && (u.name === 'PC Assistant')) ?? game.users.find(u => !u.isGM) ?? null;
  const ownership0 = foundry.utils.deepClone(sorc.ownership);
  if (player) await sorc.update({ [`ownership.${player.id}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER });
  const px = scene.dimensions?.distancePixels ?? (scene.grid.size / scene.grid.distance);

  const pool = () => sorc.items.find(i => i.name === 'Font of Magic');
  const spellAct = name => { const it = sorc.items.find(i => (i.type === 'spell') && (i.name === name)); return it?.system.activities?.contents?.[0] ?? null; };
  const poolSpent0 = pool()?.system.uses.spent ?? 0;
  const slots0 = foundry.utils.deepClone(sorc.system._source.spells ?? {});
  const myCards = () => game.messages.filter(m => (m.timestamp >= suiteStart) && ((m.author?.id === game.user.id) || m.getFlag(MOD, 'metamagic')));
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      if (/ActivityUsageDialog|UsageDialog|RollConfigurationDialog/.test(app.constructor?.name ?? '') || app.element?.querySelector?.('[data-bf-metamagic-field]')) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  /** Open a spell's casting window (not awaited — nothing answers it) and hand back the app + our fieldset. */
  const openWindow = async (name, usage = {}) => {
    const act = spellAct(name);
    const pendingUse = act.use(usage, { configure: true }, { create: true });
    pendingUse?.catch?.(() => { /* closed or cancelled below */ });
    const app = await waitFor(() => [...foundry.applications.instances.values()].find(a => /ActivityUsageDialog|UsageDialog/.test(a.constructor?.name ?? '') && a.element?.querySelector?.('[data-bf-metamagic-field]')) ?? null, 6000);
    return { act, app, fs: app?.element?.querySelector('[data-bf-metamagic-field]') ?? null, pendingUse };
  };
  const rowsOf = fs => [...(fs?.querySelectorAll('[data-bf-metamagic-row]') ?? [])].map(r => ({
    key: r.dataset.bfMetamagicRow, off: r.dataset.bfOff === '1', tag: r.querySelector('span')?.textContent?.trim() ?? '',
    box: r.querySelector('input[name="bf-metamagic"]'), rule: r.querySelector('details[data-bf-rule]')
  }));
  /** Tick a row and press the window's own Use button; wait for the usage card. */
  const castWith = async (name, key, usage = {}) => {
    const before = new Set(game.messages.map(m => m.id));
    const { app, fs } = await openWindow(name, usage);
    if (!fs) return { card: null, why: 'no fieldset' };
    const row = rowsOf(fs).find(r => r.key === key);
    if (!row?.box || row.box.disabled) { await app?.close(); return { card: null, why: `row ${key} ${row ? (row.box?.disabled ? 'disabled' : 'no box') : 'missing'}` }; }
    row.box.click();
    await sleep(100);
    const useBtn = app.element.querySelector('button[data-action="use"], button[type="submit"]');
    if (!useBtn) { await app?.close(); return { card: null, why: 'no use button' }; }
    useBtn.click();
    const card = await waitFor(() => game.messages.find(m => !before.has(m.id) && (m.getFlag('dnd5e', 'messageType') === 'usage' || m.type === 'usage') && m.getFlag('dnd5e', 'activity')?.uuid === spellAct(name)?.uuid) ?? null, 8000);
    await waitFor(() => card?.getFlag(MOD, 'metamagic')?.spent === true, 6000);
    await sleep(300);
    return { card, why: card ? '' : 'no usage card' };
  };
  const renderedLine = async (card, cls) => {
    const el = await waitFor(() => document.querySelector(`[data-message-id="${card.id}"] .${cls}`), 5000);
    return el?.textContent?.trim() ?? null;
  };

  const teardown = async () => {
    console.error = origError; console.warn = origWarn;
    try { await closeDialogs(); } catch { /* best effort */ }
    try { for (const [k, v] of Object.entries(prior)) if (game.settings.get(MOD, k) !== v) await set(k, v); } catch (e) { log.push(`settings restore failed: ${e.message}`); }
    try { const p = pool(); if (p && (p.system.uses.spent !== poolSpent0)) await p.update({ 'system.uses.spent': poolSpent0 }); } catch (e) { log.push(`pool refill failed: ${e.message}`); }
    try { if (Object.keys(slots0).length) await sorc.update({ 'system.spells': slots0 }); } catch (e) { log.push(`slot restore failed: ${e.message}`); }
    try { if ((attTok.x !== attHome.x) || (attTok.y !== attHome.y)) await attTok.update(attHome, { teleport: true, animate: false }); } catch { /* fine */ }
    try { if ((sorcTok.x !== sorcHome.x) || (sorcTok.y !== sorcHome.y)) await sorcTok.update(sorcHome, { teleport: true, animate: false }); } catch { /* fine */ }
    try { const orb = sorc.items.find(i => (i.type === 'spell') && (i.name === 'Chromatic Orb')); if (orb && (orb.system._source.range.value !== 90)) await orb.update({ 'system.range.value': 90 }); } catch { /* fine */ }
    try { if (player) await sorc.update({ ownership: ownership0 }, { diff: false, recursive: false }); } catch (e) { log.push(`ownership restore failed: ${e.message}`); }
    try { const live = (globalThis.__bfMetamagicTemplates ?? []).filter(id => scene.templates.get(id)); if (live.length) await scene.deleteEmbeddedDocuments('MeasuredTemplate', live); } catch { /* fine */ }
    try { const ids = myCards().map(m => m.id); if (ids.length) await ChatMessage.deleteDocuments(ids); } catch (e) { log.push(`message cleanup failed: ${e.message}`); }
  };

  try {
    await set('metamagicList', game.settings.settings.get(`${MOD}.metamagicList`).default);
    await set('requireTarget', false);
    await set('reminderList', game.settings.settings.get(`${MOD}.reminderList`).default);
    const p0 = pool();
    if (p0.system.uses.spent) await p0.update({ 'system.uses.spent': 0 });
    log.push(`Font of Magic: ${p0.system.uses.value}/${p0.system.uses.max}; CHA mod ${sorc.system.abilities.cha.mod}`);

    if (want(1)) {
      const { app, fs } = await openWindow('Fireball');
      const rows = rowsOf(fs);
      ok('1a. the casting window carries a Battle Flow fieldset', !!fs, `dialog=${app?.constructor?.name}`);
      ok('1b. eight cast-time rows (Empowered and Seeking are later moments)', rows.length === 8, rows.map(r => r.key).join(','));
      const fit = rows.filter(r => !r.off).map(r => r.key).sort();
      ok('1c. Careful, Distant, Heightened, Quickened, Subtle, Transmuted fit Fireball', fit.join(',') === 'careful,distant,heightened,quickened,subtle,transmuted', fit.join(','));
      ok('1d. Extended greyed: "instantaneous"', rows.find(r => r.key === 'extended')?.tag === 'instantaneous', rows.find(r => r.key === 'extended')?.tag);
      ok('1e. Twinned greyed with its reason', rows.find(r => r.key === 'twinned')?.off === true && /higher level/.test(rows.find(r => r.key === 'twinned')?.tag ?? ''), rows.find(r => r.key === 'twinned')?.tag);
      ok('1f. the tags read the cost off the sheet: Heightened 2 SP, Careful 1 SP', rows.find(r => r.key === 'heightened')?.tag === '2 SP' && rows.find(r => r.key === 'careful')?.tag === '1 SP', rows.map(r => `${r.key}:${r.tag}`).join(' '));
      const poolLine = fs?.querySelector('[data-bf-metamagic-pool]')?.textContent ?? '';
      ok('1g. the pool line reads Sorcery Points: 5 of 5', /Sorcery Points: 5 of 5/.test(poolLine), poolLine.trim());
      ok('1h. every row folds its rule, and the fold carries the pack\'s text without the cost line', rows.every(r => r.rule) && rows.every(r => !/Cost:/.test(r.rule?.textContent ?? '')) && /protect some of those creatures/.test(rows.find(r => r.key === 'careful')?.rule?.textContent ?? ''), rows.find(r => r.key === 'careful')?.rule?.textContent?.slice(0, 80));
      ok('1i. nothing above the fold but the tick, the name, the tag - and a control only where the option demands one (Transmuted: the type)', rows.every(r => r.rule && ((r.rule.previousElementSibling?.tagName === 'SPAN') || (r.rule.previousElementSibling?.dataset?.bfMetamagicSub && r.key === 'transmuted'))), rows.filter(r => r.rule?.previousElementSibling?.tagName !== 'SPAN').map(r => r.key).join(','));
      await app?.close();
    }

    if (want(2)) {
      const { app, fs } = await openWindow('Fireball');
      const rows = rowsOf(fs);
      const subtle = rows.find(r => r.key === 'subtle');
      subtle?.box?.click(); await sleep(80);
      const after = rowsOf(fs);
      ok('2a. ticking Subtle greys every other row', after.filter(r => r.key !== 'subtle').every(r => r.box?.disabled) && !after.find(r => r.key === 'subtle')?.box?.disabled, after.map(r => `${r.key}:${r.box?.disabled ? 'off' : 'on'}`).join(' '));
      subtle?.box?.click(); await sleep(80);
      const freed = rowsOf(fs);
      ok('2b. unticking frees the rows that fit', freed.filter(r => !r.off).every(r => !r.box?.disabled) && freed.filter(r => r.off).every(r => r.box?.disabled), freed.map(r => `${r.key}:${r.box?.disabled ? 'off' : 'on'}`).join(' '));
      await app?.close();
    }

    let subtleCard = null;
    if (want(3)) {
      const { card, why } = await castWith('Fireball', 'subtle', { consume: { spellSlot: false }, create: { measuredTemplate: false } });
      subtleCard = card;
      const flag = card?.getFlag(MOD, 'metamagic');
      ok('3a. the usage card is born with the pick', flag?.key === 'subtle' && flag?.feature === 'Subtle Spell' && flag?.cost === 1, why || JSON.stringify(flag));
      ok('3b. the points spend BY HAND: Font of Magic 5 → 4', pool().system.uses.value === 4, `value=${pool().system.uses.value}`);
      const spend = card?.getFlag(MOD, 'poolSpend');
      ok('3c. the poolSpend record on the card: Sorcery Points, 1 spent, 4 of 5, the option as the ability', spend?.pool === 'Sorcery Points' && spend?.spent === 1 && spend?.left === 4 && spend?.max === 5 && spend?.ability === 'Subtle Spell', JSON.stringify(spend));
      ok('3d. the flag says spent', flag?.spent === true || card?.getFlag(MOD, 'metamagic')?.spent === true, '');
      const line = card ? await renderedLine(card, 'bf-metamagic-line') : null;
      ok('3e. the card carries the metamagic line', /Subtle Spell — cast without components/.test(line ?? ''), line);
      const res = card ? await renderedLine(card, 'bf-resource-line') : null;
      ok('3f. …and the resource line the uniform spend draws', /Sorcery Points: 4 of 5 remaining/.test(res ?? ''), res);
    }

    if (want(4)) {
      const { card, why } = await castWith('Fireball', 'quickened', { consume: { spellSlot: false }, create: { measuredTemplate: false } });
      const flag = card?.getFlag(MOD, 'metamagic');
      ok('4a. Quickened is born on the card at cost 2', flag?.key === 'quickened' && flag?.cost === 2, why || JSON.stringify(flag));
      ok('4b. the pool 4 → 2', pool().system.uses.value === 2, `value=${pool().system.uses.value}`);
      const spend = card?.getFlag(MOD, 'poolSpend');
      ok('4c. the record says 2 spent, 2 of 5', spend?.spent === 2 && spend?.left === 2, JSON.stringify(spend));
      const line = card ? await renderedLine(card, 'bf-metamagic-line') : null;
      ok('4d. the card says Bonus Action', /Quickened Spell — a Bonus Action/.test(line ?? ''), line);
    }

    if (want(5)) {
      // The range is a 100-ft square, so a target beyond Chromatic Orb's 90 ft and within Distant's
      // 180 stands on the opposite corner: 85 ft on each axis, 120+ ft on the diagonal by any rule.
      // …and the world measures that diagonal at 85 ft (its diagonal rule), short of Chromatic Orb's
      // 90 — so the ORB's range is 60 ft for this section (restored after): 85 is beyond 60 and
      // within Distant's 120.
      const orbItem = sorc.items.find(i => (i.type === 'spell') && (i.name === 'Chromatic Orb'));
      const orbRange0 = orbItem.system._source.range.value;
      await orbItem.update({ 'system.range.value': 60 });
      const g = scene.grid.size, span = Math.round((85 / scene.grid.distance) * g);
      await sorcTok.update({ x: g, y: g }, { teleport: true, animate: false });
      await attTok.update({ x: g + span, y: g + span }, { teleport: true, animate: false });
      await sleep(400);
      const geo = await import(`/modules/${MOD}/scripts/geometry.js`);
      log.push(`§5: sorcerer to (${sorcTok.x},${sorcTok.y}), attacker to (${attTok.x},${attTok.y}); ${geo.nearestFeet(canvas.tokens.get(sorcTok.id), canvas.tokens.get(attTok.id))} ft apart`);
      const { card, why } = await castWith('Chromatic Orb', 'distant', { consume: { spellSlot: false } });
      const flag = card?.getFlag(MOD, 'metamagic');
      ok('5a. the Chromatic Orb card carries Distant with the doubled range (60 → 120 ft)', flag?.key === 'distant' && flag?.rangeFeet === 120, why || JSON.stringify(flag));
      const line = card ? await renderedLine(card, 'bf-metamagic-line') : null;
      ok('5b. the card line says range 120 ft', /range 120 ft/.test(line ?? ''), line);
      // The gate's judgement, called as the hook calls it, with and without the card's range.
      const rem = await import(`/modules/${MOD}/scripts/reminders.js`);
      const act = spellAct('Chromatic Orb');
      const targets = [canvas.tokens.get(attTok.id)].filter(Boolean);
      const plain = rem.judgeRoll(sorc, { activity: act, targets });
      const distant = rem.judgeRoll(sorc, { activity: act, targets, rangeFeet: 120 });
      const rangeRow = j => (j?.sources ?? []).find(s => s.kind === 'range') ?? null;
      const diag = `activity.range=${JSON.stringify({ v: act.range?.value, u: act.range?.units, o: act.range?.override })} item.range=${JSON.stringify({ v: act.item.system.range?.value, u: act.item.system.range?.units })} feet=${geo.nearestFeet(canvas.tokens.get(sorcTok.id), canvas.tokens.get(attTok.id))} kinds=${JSON.stringify(plain?.sources?.map(s => s.kind))}`;
      ok('5c. without Distant the gate reminds: 85 ft is beyond 60', !!rangeRow(plain), rangeRow(plain)?.text ?? diag);
      ok('5d. with Distant the range row is gone — 85 ft is within 120', !rangeRow(distant), JSON.stringify(rangeRow(distant)?.text ?? null));
      await orbItem.update({ 'system.range.value': orbRange0 });
      await attTok.update(attHome, { teleport: true, animate: false });
      await sorcTok.update(sorcHome, { teleport: true, animate: false });
    }

    if (want(6)) {
      const p = pool();
      const spentBefore = p.system.uses.spent;
      await p.update({ 'system.uses.spent': p.system.uses.max });
      const { app, fs } = await openWindow('Fireball');
      const rows = rowsOf(fs);
      ok('6a. with no points every row stays, greyed', rows.length === 8 && rows.every(r => r.off && r.box?.disabled), rows.map(r => `${r.key}:${r.off}`).join(' '));
      ok('6b. an affordable-by-fit row says "1 SP — 0 left"', rows.find(r => r.key === 'subtle')?.tag === '1 SP — 0 left', rows.find(r => r.key === 'subtle')?.tag);
      const poolLine = fs?.querySelector('[data-bf-metamagic-pool]')?.textContent ?? '';
      ok('6c. the pool line says 0 of 5', /Sorcery Points: 0 of 5/.test(poolLine), poolLine.trim());
      await app?.close();
      await p.update({ 'system.uses.spent': spentBefore });
    }

    if (want(7)) {
      await set('metamagicList', '');
      const empty = await openWindow('Fireball');
      ok('7a. an empty Metamagic list draws no group', !empty.fs, empty.fs ? 'fieldset present' : '');
      await closeDialogs();
      await set('metamagicList', 'Subtle Spell');
      const one = await openWindow('Fireball');
      const rows = rowsOf(one.fs);
      ok('7b. a list of one draws one row', rows.length === 1 && rows[0].key === 'subtle', rows.map(r => r.key).join(','));
      await one.app?.close();
      await set('metamagicList', prior.metamagicList);
    }

    // --- Stage 2: the save demand -------------------------------------------------------------
    const ranger = game.actors.getName('BF Test Ranger');
    const victim = game.actors.getName('BF Test Victim');
    const rgrTok = ranger ? tok(ranger) : null, vicTok = victim ? tok(victim) : null;
    const homes = Object.fromEntries([rgrTok, vicTok].filter(Boolean).map(t => [t.id, { x: t.x, y: t.y }]));
    const templates = (globalThis.__bfMetamagicTemplates = []);
    const savePopups = () => [...foundry.applications.instances.values()].filter(app => app.rendered && app.element?.querySelector?.('[data-bf-save-demand]'));
    const demandText = app => app?.element?.querySelector?.('[data-bf-save-demand]')?.textContent ?? '';
    /** The area over four tokens on the bottom row: the Sorcerer at home, the Ranger and the goblins beside him. */
    const keepCards = new Set();
    const gather = async () => {
      const g = scene.grid.size;
      // A fresh pool (the earlier sections spent it), and no other waiting Fireball demand of this
      // suite's making left to claim the area — the template's origin is the ACTIVITY, shared by
      // every cast of the spell, and adoption serves the oldest waiting card.
      const p = pool(); if (p.system.uses.spent) await p.update({ 'system.uses.spent': 0 });
      const stale = myCards().filter(m => !keepCards.has(m.id)).map(m => m.id);
      if (stale.length) await ChatMessage.deleteDocuments(stale);
      await sorcTok.update(sorcHome, { teleport: true, animate: false });
      await rgrTok.update({ x: sorcHome.x + g, y: sorcHome.y }, { teleport: true, animate: false });
      await attTok.update({ x: sorcHome.x, y: sorcHome.y - g }, { teleport: true, animate: false });
      await vicTok.update({ x: sorcHome.x + g, y: sorcHome.y - g }, { teleport: true, animate: false });
      await sleep(400);
    };
    const scatter = async () => {
      for (const [id, home] of Object.entries(homes)) { const t = scene.tokens.get(id); if (t && ((t.x !== home.x) || (t.y !== home.y))) await t.update(home, { teleport: true, animate: false }); }
      if ((attTok.x !== attHome.x) || (attTok.y !== attHome.y)) await attTok.update(attHome, { teleport: true, animate: false });
    };
    /** A bare cast with the option, then the area placed by hand over the gathered tokens (the adoption road). */
    const castArea = async key => {
      const { card, why } = await castWith('Fireball', key, { consume: { spellSlot: false }, create: { measuredTemplate: false } });
      if (!card) return { card: null, why };
      await waitFor(() => card.getFlag(MOD, 'saves') ? card : null, 6000);
      const g = scene.grid.size;
      const [tpl] = await scene.createEmbeddedDocuments('MeasuredTemplate', [{
        t: 'circle', x: sorcTok.x + g / 2, y: sorcTok.y + g / 2, distance: 20,
        flags: { dnd5e: { origin: card.getFlag(MOD, 'saves')?.activityUuid ?? spellAct('Fireball').uuid } }
      }]);
      templates.push(tpl.id);
      await sleep(300);
      try { ui.chat?.updateMessage?.(card); } catch { /* the next render adopts */ }
      const adopted = await waitFor(() => { const f2 = card.getFlag(MOD, 'saves'); return (f2?.templated && f2.targets.length) ? f2 : null; }, 8000);
      return { card, why: adopted ? '' : 'the area was never adopted' };
    };
    const names = list => (list ?? []).map(t => t.name).sort().join(',');

    let carefulCard = null;
    if (want(9) && rgrTok && vicTok) {
      await gather();
      await set('saveTimer', 0);
      const { card, why } = await castArea('careful');
      carefulCard = card;
      if (card) keepCards.add(card.id);
      const saves = card?.getFlag(MOD, 'saves'), mm = card?.getFlag(MOD, 'metamagic');
      log.push(`§9: saves=${JSON.stringify({ status: saves?.status, templated: saves?.templated, awaiting: saves?.awaitingTemplate, n: saves?.targets?.length, mmKeys: Object.keys(mm ?? {}) })} templates=${scene.templates.filter(t => t.getFlag('dnd5e', 'origin') === saves?.activityUuid).length} otherDemands=${game.messages.filter(m => m.id !== card?.id && m.getFlag(MOD, 'saves')?.activityUuid === saves?.activityUuid).length}`);
      log.push(`§9: demand targets=${names(saves?.targets)} protected=${names(mm?.protected)} dispositions sorc=${sorcTok.disposition} rgr=${rgrTok.disposition} att=${attTok.disposition} vic=${vicTok.disposition}`);
      ok('9a. the cast is born with Careful and the cap (Charisma +3)', mm?.key === 'careful' && mm?.cap === 3, why || JSON.stringify({ key: mm?.key, cap: mm?.cap }));
      ok('9b. the two allies are protected — the caster first, then the Ranger', (mm?.protected?.length === 2) && (mm.protected[0].uuid === sorc.uuid) && (mm.protected[1].uuid === ranger.uuid), JSON.stringify(mm?.protected));
      ok('9c. the demand holds the two goblins and neither ally', (saves?.targets?.length === 2) && saves.targets.every(t => [attacker.id, victim.id].some(id => String(t.uuid).endsWith(id))), names(saves?.targets));
      const line = card ? await renderedLine(card, 'bf-metamagic-line') : null;
      ok('9d. the card names the protected: no save, no damage', /Careful Spell — .*protected: no save, no damage/.test(line ?? '') && /BF Test Sorcerer/.test(line ?? '') && /BF Test Ranger/.test(line ?? ''), line);
      await sleep(800);
      const asks = savePopups().map(demandText);
      ok('9e. asks open for the goblins and none for a protected creature', (asks.length === 2) && !asks.some(t => /Saving throw\s+(BF Test Sorcerer|BF Test Ranger):/.test(t.replace(/\s+/g, ' '))), asks.map(t => t.replace(/\s+/g, ' ').trim().slice(0, 60)).join(' | '));
      ok('9f. the card carries the Protect… button for the caster', !!(await waitFor(() => document.querySelector(`[data-message-id="${card?.id}"] [data-bf-metamagic-adjust="careful"]`), 4000)), '');
      await closeDialogs();
    } else if (want(9)) ok('9. fixtures', false, 'BF Test Ranger or BF Test Victim missing');

    if (want(10) && rgrTok && vicTok) {
      await gather();
      await set('saveTimer', 0);
      const { card, why } = await castArea('heightened');
      const saves = card?.getFlag(MOD, 'saves'), mm = card?.getFlag(MOD, 'metamagic');
      const mark = saves?.demand?.heightened ?? null;
      ok('10a. the demand carries the mark on the first goblin, with the caster and the rule', !!mark && [attacker.id, victim.id].some(id => String(mark.uuid).endsWith(id)) && (mark.caster === sorc.name) && /Disadvantage on saves/.test(mark.rule ?? ''), why || JSON.stringify(mark));
      ok('10b. the card line names the marked creature', /Heightened Spell — .* saves with Disadvantage/.test((card ? await renderedLine(card, 'bf-metamagic-line') : '') ?? ''), '');
      ok('10c. every creature in the area owes the save — Heightened protects nobody', (saves?.targets?.length === 4), names(saves?.targets));
      // The marked goblin's gate: its ask is the system's saving-throw dialog, open on this client.
      const markedName = mark?.name ?? '';
      const marked = await waitFor(() => savePopups().find(app => demandText(app).includes(markedName)) ?? null, 6000);
      const gateText = marked?.element?.querySelector?.('[data-bf-reminder]')?.textContent?.replace(/\s+/g, ' ') ?? '';
      ok('10d. the marked creature\'s gate carries Heightened Spell as a source', /Heightened Spell/.test(gateText), gateText.slice(0, 160) || 'no gate section');
      const buttons = [...(marked?.element?.querySelectorAll?.('[data-application-part="buttons"] button[data-action]') ?? [])];
      log.push(`§10 gate buttons: ${buttons.map(b => `${b.dataset.action}[${b.className}]`).join(' ')}`);
      ok('10e. …and Disadvantage as the net', /Net Disadvantage/.test(gateText), gateText.slice(0, 80));
      const other = savePopups().find(app => !demandText(app).includes(markedName) && /BF Test/.test(demandText(app)));
      const otherGate = other?.element?.querySelector?.('[data-bf-reminder]')?.textContent ?? '';
      ok('10f. the other goblin\'s gate carries no Heightened source', !/Heightened Spell/.test(otherGate), otherGate.replace(/\s+/g, ' ').slice(0, 100));
      await closeDialogs();
    } else if (want(10)) ok('10. fixtures', false, 'BF Test Ranger or BF Test Victim missing');

    if (want(11) && carefulCard) {
      const card = carefulCard;
      const mmBefore = card.getFlag(MOD, 'metamagic');
      const btn = await waitFor(() => document.querySelector(`[data-message-id="${card.id}"] [data-bf-metamagic-adjust="careful"]`), 4000);
      btn?.click();
      const dlg = await waitFor(() => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.querySelector?.('input[name="bf-metamagic-adjust"]')) ?? null, 5000);
      const boxes = [...(dlg?.element?.querySelectorAll?.('input[name="bf-metamagic-adjust"]') ?? [])];
      ok('11a. the picker lists the four creatures with the two allies ticked', boxes.length === 4 && boxes.filter(b => b.checked).length === 2, `button=${!!btn} dialog=${dlg?.constructor?.name ?? null} boxes=${boxes.map(b => `${b.value.slice(-4)}:${b.checked}`).join(',')}`);
      const rangerBox = boxes.find(b => b.value === ranger.uuid);
      if (rangerBox?.checked) rangerBox.click();
      dlg?.element?.querySelector?.('button[data-action="ok"]')?.click();
      const after = await waitFor(() => { const f2 = card.getFlag(MOD, 'saves'); return f2?.targets?.some(t => t.uuid === ranger.uuid) ? f2 : null; }, 6000);
      const mmAfter = card.getFlag(MOD, 'metamagic');
      ok('11b. the Ranger joins the demand as a fresh entry', !!after && after.targets.some(t => (t.uuid === ranger.uuid) && !t.done), names(after?.targets ?? card.getFlag(MOD, 'saves')?.targets));
      ok('11c. the Sorcerer stays protected, the list marked chosen', (mmAfter?.protected?.length === 1) && (mmAfter.protected[0].uuid === sorc.uuid) && (mmAfter.chosen === true), JSON.stringify({ before: mmBefore?.protected?.length, after: mmAfter?.protected, chosen: mmAfter?.chosen }));
      await closeDialogs();
    } else if (want(11)) ok('11. needs §9\'s card', false, 'no Careful card');

    await scatter();

    // --- Stage 3: Twinned, Transmuted, Extended -----------------------------------------------
    if (want(12)) {
      const { app, fs } = await openWindow('Hold Person', { consume: { spellSlot: false } });
      const rows = rowsOf(fs);
      const tw = rows.find(r => r.key === 'twinned'), ex = rows.find(r => r.key === 'extended'), tr = rows.find(r => r.key === 'transmuted');
      ok('12a. Hold Person fits Twinned — the source count is a formula over the cast\'s level', !!tw && !tw.off && tw.tag === '1 SP', tw?.tag);
      ok('12b. …and Extended (1 minute), not Transmuted (no damage)', !!ex && !ex.off && !!tr && tr.off && tr.tag === 'no listed damage type', `extended=${ex?.tag} transmuted=${tr?.tag}`);
      await app?.close();
      const fb = await openWindow('Fireball', { consume: { spellSlot: false } });
      const fbRows = rowsOf(fb.fs);
      ok('12c. Fireball does not fit Twinned (a fixed area, no count formula)', fbRows.find(r => r.key === 'twinned')?.off === true, fbRows.find(r => r.key === 'twinned')?.tag);
      await fb.app?.close();
      const { card, why } = await castWith('Hold Person', 'twinned', { consume: { spellSlot: false } });
      const flag = card?.getFlag(MOD, 'metamagic');
      ok('12d. Twinned cast: the pick on the card, the point spent, the line', flag?.key === 'twinned' && flag?.spent === true && /one more target/.test((card ? await renderedLine(card, 'bf-metamagic-line') : '') ?? ''), why || JSON.stringify(flag));
    }

    if (want(13)) {
      const p = pool(); if (p.system.uses.spent) await p.update({ 'system.uses.spent': 0 });
      const { app, fs } = await openWindow('Fireball', { consume: { spellSlot: false } });
      const row = rowsOf(fs).find(r => r.key === 'transmuted');
      row?.box?.click(); await sleep(80);
      const radios = [...(fs?.querySelectorAll('input[name="bf-metamagic-type"]') ?? [])];
      ok('13a. ticking Transmuted shows the five other listed types, fire absent', radios.length === 5 && !radios.some(r => r.value === 'fire') && radios.some(r => r.checked), radios.map(r => `${r.value}${r.checked ? '✓' : ''}`).join(','));
      const cold = radios.find(r => r.value === 'cold'); cold?.click(); await sleep(80);
      const before = new Set(game.messages.map(m => m.id));
      app.element.querySelector('button[data-action="use"], button[type="submit"]')?.click();
      const card = await waitFor(() => game.messages.find(m => !before.has(m.id) && (m.getFlag('dnd5e', 'messageType') === 'usage' || m.type === 'usage') && m.getFlag('dnd5e', 'activity')?.uuid === spellAct('Fireball')?.uuid) ?? null, 8000);
      await waitFor(() => card?.getFlag(MOD, 'metamagic')?.spent === true, 6000);
      const flag = card?.getFlag(MOD, 'metamagic');
      ok('13b. the card carries the pick: cold, from fire', flag?.key === 'transmuted' && flag?.type === 'cold' && (flag?.from ?? []).includes('fire'), JSON.stringify({ key: flag?.key, type: flag?.type, from: flag?.from }));
      ok('13c. the card line says the damage is cold', /the damage is cold/.test((card ? await renderedLine(card, 'bf-metamagic-line') : '') ?? ''), '');
      // The spell's own damage roll, chained to the card as the module and the card button chain it.
      const dmgBefore = new Set(game.messages.map(m => m.id));
      await spellAct('Fireball').rollDamage({}, { configure: false }, { data: { 'flags.dnd5e.originatingMessage': card?.id } });
      const dmg = await waitFor(() => game.messages.find(m => !dmgBefore.has(m.id) && m.rolls?.length && m.getFlag('dnd5e', 'roll.type') === 'damage') ?? null, 6000);
      ok('13d. the damage roll wears cold, not fire, and says why', dmg?.rolls?.[0]?.options?.type === 'cold' && dmg?.getFlag(MOD, 'metamagicType')?.type === 'cold', `type=${dmg?.rolls?.[0]?.options?.type} flag=${JSON.stringify(dmg?.getFlag(MOD, 'metamagicType'))}`);
    }

    if (want(14) && victim) {
      const p = pool(); if (p.system.uses.spent) await p.update({ 'system.uses.spent': 0 });
      const vicActor = scene.tokens.find(t => t.actorId === victim.id)?.actor ?? victim;
      const bonus0 = vicActor.system._source.abilities?.wis?.bonuses?.save ?? '';
      await vicActor.update({ 'system.abilities.wis.bonuses.save': '-30' });   // a forced failure (the saves suite's idiom)
      for (const e of vicActor.effects.filter(e => e.statuses?.has?.('paralyzed'))) await e.delete();
      await set('saveTimer', 1);
      const vTok = canvas.tokens.get(scene.tokens.find(t => t.actorId === victim.id)?.id);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      vTok?.setTarget(true, { releaseOthers: true });
      await sleep(200);
      const { card, why } = await castWith('Hold Person', 'extended', { consume: { spellSlot: false } });
      const flag = card?.getFlag(MOD, 'metamagic');
      ok('14a. Extended cast: the pick on the card with the spell\'s uuid and its rule', flag?.key === 'extended' && flag?.spellUuid === sorc.items.find(i => i.name === 'Hold Person')?.uuid && /Advantage on any saving throw/.test(flag?.rule ?? ''), why || JSON.stringify({ key: flag?.key, spellUuid: flag?.spellUuid, rule: (flag?.rule ?? '').slice(0, 40) }));
      // The buzzer rolls the forced failure; the verdict applies Paralyzed through the one applier.
      const paralyzed = await waitFor(() => vicActor.effects.find(e => e.statuses?.has?.('paralyzed') && e.getFlag(MOD, 'applied')) ?? null, 12000);
      ok('14b. the failed save lands Paralyzed with its clock DOUBLED: 120 seconds, not 60', paralyzed?.duration?.seconds === 120, `seconds=${paralyzed?.duration?.seconds} outcome=${JSON.stringify(card?.getFlag(MOD, 'saves')?.targets?.map(t => t.outcome))}`);
      // The caster concentrates on Hold Person: the concentration save's gate carries Extended as Advantage.
      const conc = sorc.effects.find(e => e.statuses?.has?.('concentrating'));
      log.push(`§14 concentration effect: ${conc ? `${conc.name} origin=${conc.origin}` : 'none'}`);
      const rem = await import(`/modules/${MOD}/scripts/reminders.js`);
      let gateText = '';
      if (conc) {
        const pendingRoll = sorc.rollConcentration({ target: 10 }, { configure: true }, {});
        pendingRoll?.catch?.(() => {});
        const dlg = await waitFor(() => [...foundry.applications.instances.values()].find(a => /RollConfigurationDialog/.test(a.constructor?.name ?? '') && a.element?.querySelector?.('[data-bf-reminder]')) ?? null, 6000);
        gateText = dlg?.element?.querySelector?.('[data-bf-reminder]')?.textContent?.replace(/\s+/g, ' ') ?? '';
        try { await dlg?.close(); } catch { /* gone */ }
      }
      ok('14c. the concentration save\'s gate carries Extended Spell as an Advantage source', !!conc && /Extended Spell/.test(gateText) && /Net Advantage/.test(gateText), conc ? (gateText.slice(0, 160) || 'no gate section') : 'no concentration effect on the caster');
      void rem;
      await closeDialogs();
      for (const e of vicActor.effects.filter(e => e.statuses?.has?.('paralyzed'))) await e.delete().catch(() => {});
      for (const e of sorc.effects.filter(e => e.statuses?.has?.('concentrating'))) await e.delete().catch(() => {});
      await vicActor.update({ 'system.abilities.wis.bonuses.save': bonus0 });
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
    } else if (want(14)) ok('14. fixtures', false, 'BF Test Victim missing');

    if (want(8)) {
      ok('8a. renderActivityUsageDialog fired', count('renderActivityUsageDialog') > 0, `count=${count('renderActivityUsageDialog')}`);
      ok('8b. dnd5e.postUseActivity fired', count('dnd5e.postUseActivity') > 0, `count=${count('dnd5e.postUseActivity')}`);
    }

    const bf = errors.filter(e => /Battle Flow/.test(e) && !/deprecat/i.test(e));
    ok('no Battle Flow errors or warnings during the run', bf.length === 0, bf.slice(0, 3).join(' | '));
    void subtleCard;
  } catch (err) {
    ok('suite threw', false, `${err.message}\n${err.stack}`);
  } finally {
    await teardown();
  }
  return { results, log, skips };
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'metamagic', out, plan, f });
