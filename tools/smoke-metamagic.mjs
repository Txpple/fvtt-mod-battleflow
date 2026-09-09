// Battle Flow metamagic smoke test — THE METAMAGIC PASS (user, 2026-09-09: "need metamagic
// implemented … follow pattern like sneak attk/manuevers with check box"; DESIGN §6 *Metamagic*).
// Stage 1: the group in the casting window (a row per option the sheet grants, the tag, the
// rule folded under, one pick greys the rest), the spend BY HAND on the spell's card (the
// poolSpend record the flash, the card line and the ledger read), and the three data-only
// options — Subtle (a line), Quickened (a line, 2 SP), Distant (the gate's range doubled).
//
// Fixtures: BF Test Sorcerer (Sorcerer 5, Font of Magic at 5 points, all ten options, Fireball /
// Hold Person / Chromatic Orb — tools/fixture-suite.mjs), BF Test Attacker (a target).
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
  8: 'the registration FIRED (§11): renderActivityUsageDialog and dnd5e.postUseActivity moved'
};
const DEPENDS = { 4: ['3'] };

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

  const SETTING_KEYS = ['metamagicList', 'reminderList', 'requireTarget', 'saves', 'autoApply'];
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
      ok('1i. nothing above the fold but the tick, the name and the tag (the offer-row law)', rows.every(r => r.rule && (r.rule.previousElementSibling?.tagName === 'SPAN')), '');
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
