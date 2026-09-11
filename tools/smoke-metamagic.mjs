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
  9: 'Careful Spell (Stage 2, the third look): a bare Fireball cast with Careful, the area placed over the Sorcerer, the Ranger and the two goblins — the ASK opens at the area listing the four with the two non-hostiles ticked while the demand waits empty; OK → the two leave the demand, the goblins owe the save, the card names the protected',
  10: 'Heightened Spell (Stage 2): the same area — the first goblin is marked on the demand; its save gate opens with "Heightened Spell" as a Disadvantage source and Disadvantage as the default; the other goblin\'s gate carries no such source',
  11: 'Heightened with nobody targeted (the third look): the window lists nobody; the ask at the area lists the four with the first goblin marked; the SECOND goblin picked is the one the demand marks',
  12: 'Twinned Spell (Stage 3): Hold Person fits (its source target count is a formula over the cast\'s level), Fireball does not; the cast spends the point and the card says one more target',
  13: 'Transmuted Spell (Stage 3): ticking it shows the five other listed types; cold picked; the card carries cold from fire; the spell\'s damage roll chained to the card wears cold',
  14: 'Extended Spell (Stage 3): Hold Person on the Victim, a forced failure — Paralyzed lands with its clock doubled (120 s); the caster\'s concentration save opens with Extended Spell as an Advantage source',
  15: 'Seeking Spell (Stage 4): a missed Chromatic Orb (AC 60) is offered Seeking as a d20 fold; the popup\'s button rerolls the d20, the spend records the reroll, one Sorcery Point goes by hand with the record on the attack message',
  16: 'Empowered Spell (Stage 4): a Fireball damage roll is offered Empowered; the popup shows the eight dice, the cap holds at three, Reroll spends the point, patches the message\'s own roll (three faces struck, the total moved), and announces old → new',
  17: 'Careful\'s ticks in the casting window (user, 2026-09-09): with the Ranger and a goblin targeted, the row lists both with the ally pre-ticked; the player\'s own pick (the goblin) is honoured on the demand',
  18: 'Careful with NO target selected (the third look): the window lists nobody; the ask at the area lists exactly the creatures inside',
  19: 'the cantrip (2026-09-10): Fire Bolt has no slot, template or scaling, so the system never opened the usage dialog and the group never showed - the module opens it; Distant, Quickened, Subtle and Transmuted fit, Careful, Heightened, Extended and Twinned (no slot to raise) do not; Transmuted\'s type radios are inert until Transmuted is ticked',
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
    try { const a = game.actors.getName('BF Test Sorcerer'); if (a) log.push(`hp@${id}: ${a.system.attributes.hp.value}/${a.system.attributes.hp.max} dead=${a.statuses?.has?.('dead')}`); } catch { /* trace only */ }
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

  const SETTING_KEYS = ['metamagicList', 'reminderList', 'requireTarget', 'saves', 'autoApply', 'saveTimer', 'd20Folds', 'd20FoldAsk', 'holdTimer'];
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
  const uiMod = await import(`/modules/${MOD}/scripts/ui.js`);
  /** The module's own moment popup for a message + sub-key, or null. */
  const popupFor = (messageId, sub) => uiMod.livePopups.get(`${messageId}|${sub}`) ?? null;
  const closeMomentPopups = async () => { for (const [key, dlg] of [...uiMod.livePopups]) { if (/|(empowered|d20fold|armed|metamagicAsk)$/.test(key) || key.includes('|empowered')) { try { await dlg.close(); } catch { /* gone */ } } } };
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
  const castWith = async (name, key, usage = {}, tweak = null) => {
    const before = new Set(game.messages.map(m => m.id));
    const { app, fs } = await openWindow(name, usage);
    if (!fs) return { card: null, why: 'no fieldset' };
    const row = rowsOf(fs).find(r => r.key === key);
    if (!row?.box || row.box.disabled) { await app?.close(); return { card: null, why: `row ${key} ${row ? (row.box?.disabled ? 'disabled' : 'no box') : 'missing'}` }; }
    if (!row.box.checked) row.box.click();   // a pick still pending from an earlier window arrives ticked
    await sleep(100);
    if (tweak) { await tweak(fs); await sleep(80); }
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
    try { await closeMomentPopups(); } catch { /* fine */ }
    await sleep(1500);   // in-flight verdicts land before their cards go
    try { const live = (globalThis.__bfMetamagicTemplates ?? []).filter(id => scene.templates.get(id)); if (live.length) await scene.deleteEmbeddedDocuments('MeasuredTemplate', live); } catch { /* fine */ }
    try { const ids = myCards().map(m => m.id); if (ids.length) await ChatMessage.deleteDocuments(ids); } catch (e) { log.push(`message cleanup failed: ${e.message}`); }
  };

  try {
    await set('metamagicList', game.settings.settings.get(`${MOD}.metamagicList`).default);
    await set('requireTarget', false);
    await set('reminderList', game.settings.settings.get(`${MOD}.reminderList`).default);
    const p0 = pool();
    if (p0.system.uses.spent) await p0.update({ 'system.uses.spent': 0 });
    // The Sorcerer at full HP: an earlier run's Fireball can leave him at 0, and a dead caster is
    // filtered from every list and demand (found 2026-09-09 - 10c and 18a read him missing).
    if (sorc.system.attributes.hp.value < sorc.system.attributes.hp.max) await sorc.update({ 'system.attributes.hp.value': sorc.system.attributes.hp.max });
    for (const e of sorc.effects.filter(e => e.statuses?.has?.('dead'))) await e.delete().catch(() => {});
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
      ok('1i. nothing above the fold but the tick, the name, the tag - and a control only where the option demands one (Transmuted: the type)', rows.every(r => r.rule && ((r.rule.previousElementSibling?.tagName === 'SPAN') || (r.rule.previousElementSibling?.dataset?.bfMetamagicSub && ['transmuted', 'careful', 'heightened'].includes(r.key)))), rows.filter(r => r.rule?.previousElementSibling?.tagName !== 'SPAN').map(r => r.key).join(','));
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
      // Let in-flight verdicts land before their cards go (the 2026-09-09 run: 'Verdict line failed - ChatMessage does not exist').
      await closeDialogs(); await closeMomentPopups(); await sleep(1500);
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
    const castArea = async (key, tweak = null, pick = null) => {
      const { card, why } = await castWith('Fireball', key, { consume: { spellSlot: false }, create: { measuredTemplate: false } }, tweak);
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
      // The ask at the area (the third look, 2026-09-09): the popup lists everyone inside; the demand waits until OK.
      const askPopup = await waitFor(() => { const d = popupFor(card.id, 'metamagicAsk'); return (d?.rendered && d.element?.querySelector?.('[data-bf-metamagic-ask]')) ? d : null; }, 8000);
      const askRows = [...(askPopup?.element?.querySelectorAll('input[name="bf-metamagic-ask"]') ?? [])].map(i => ({ name: i.dataset.name, uuid: i.value, checked: i.checked, el: i, group: i.closest('[data-bf-ask-group]')?.dataset?.bfAskGroup ?? null, token: i.dataset.token }));
      const heldEmpty = !(card.getFlag(MOD, 'saves')?.targets?.length);
      // Everything waits on the answer: no damage dice, no damage popup, while the ask stands.
      const damageFor = () => game.messages.filter(m => (m.getFlag('dnd5e', 'originatingMessage') === card.id) && (m.getFlag('dnd5e', 'roll.type') === 'damage')).length;
      const damageBefore = damageFor();
      const offerBefore = [...foundry.applications.instances.values()].some(a => a.rendered && /Damage — your roll|Roll damage/i.test(a.element?.textContent ?? ''));
      const deferred = !!card.getFlag(MOD, 'savesDeferredRoll');
      if (pick) await pick(askRows, askPopup?.element ?? null);
      askPopup?.element?.querySelector('button[data-action="ok"]')?.click();
      const adopted = await waitFor(() => { const f2 = card.getFlag(MOD, 'saves'); return (f2?.status === 'done' || (f2?.templated && f2.targets.length)) ? f2 : null; }, 8000);
      const damageAfter = adopted ? await waitFor(() => damageFor() > damageBefore ? damageFor() : null, 8000) : null;
      return { card, askRows, heldEmpty, damageBefore, offerBefore, deferred, damageAfter, why: askPopup ? (adopted ? '' : 'the ask was answered but the demand never filled') : 'no ask popup opened' };
    };
    const names = list => (list ?? []).map(t => t.name).sort().join(',');

    let carefulCard = null;
    if (want(9) && rgrTok && vicTok) {
      await gather();
      await set('saveTimer', 0);
      const { card, why, askRows, heldEmpty, damageBefore, offerBefore, deferred, damageAfter } = await castArea('careful');
      carefulCard = card;
      ok('9x. the ask opened at the area listing everyone inside — four, the Sorcerer and the Ranger ticked, the goblins not — while the demand waited empty', askRows?.length === 4 && askRows.filter(r => r.checked).map(r => r.name).sort().join(',') === 'BF Test Ranger,BF Test Sorcerer' && heldEmpty === true, `rows=${askRows?.map(r => `${r.name}:${r.checked}`).join(',')} heldEmpty=${heldEmpty}`);
      ok('9z. the dice waited on the answer: no damage roll and no damage popup while the ask stood, the deferral on the card; the roll landed after OK', askRows && damageBefore === 0 && offerBefore === false && deferred === true && (damageAfter ?? 0) > 0, JSON.stringify({ damageBefore, offerBefore, deferred, damageAfter }));
      ok('9y. two groups: the Sorcerer (player-owned for the run) under Party, the Ranger and the goblins under Non-Party; every row names its token', askRows?.find(r => r.name === 'BF Test Sorcerer')?.group === 'Party' && askRows?.filter(r => r.name !== 'BF Test Sorcerer').every(r => r.group === 'Non-Party') && askRows.every(r => !!r.token), askRows?.map(r => r.name + '@' + r.group).join(','));
      if (card) keepCards.add(card.id);
      const saves = card?.getFlag(MOD, 'saves'), mm = card?.getFlag(MOD, 'metamagic');
      log.push(`§9: saves=${JSON.stringify({ status: saves?.status, templated: saves?.templated, awaiting: saves?.awaitingTemplate, n: saves?.targets?.length, mmKeys: Object.keys(mm ?? {}) })} templates=${scene.templates.filter(t => t.getFlag('dnd5e', 'origin') === saves?.activityUuid).length} otherDemands=${game.messages.filter(m => m.id !== card?.id && m.getFlag(MOD, 'saves')?.activityUuid === saves?.activityUuid).length}`);
      log.push(`§9: demand targets=${names(saves?.targets)} protected=${names(mm?.protected)} dispositions sorc=${sorcTok.disposition} rgr=${rgrTok.disposition} att=${attTok.disposition} vic=${vicTok.disposition}`);
      ok('9a. the cast is born with Careful and the cap (Charisma +3)', mm?.key === 'careful' && mm?.cap === 3, why || JSON.stringify({ key: mm?.key, cap: mm?.cap }));
      // The window's default: every non-hostile in reach up to the cap (three) - the Sorcerer first, the Ranger
      // beside him, a third ally from the row (the Paladin, 35 ft off); the DEMAND protects the two the area holds.
      ok('9b. the answer is the caster first and the Ranger, marked chosen', mm?.chosen === true && (mm?.protected?.length === 2) && (mm.protected[0].uuid === sorc.uuid) && (mm.protected[1].uuid === ranger.uuid), JSON.stringify(mm?.protected));
      ok('9c. the demand holds the two goblins and neither ally', (saves?.targets?.length === 2) && saves.targets.every(t => [attacker.id, victim.id].some(id => String(t.uuid).endsWith(id))), names(saves?.targets));
      const line = card ? await renderedLine(card, 'bf-metamagic-line') : null;
      ok('9d. the card names the protected: no save, no damage', /Careful Spell — .*protected: no save, no damage/.test(line ?? '') && /BF Test Sorcerer/.test(line ?? '') && /BF Test Ranger/.test(line ?? ''), line);
      await sleep(800);
      const asks = savePopups().map(demandText);
      ok('9e. asks open for the goblins and none for a protected creature', (asks.length === 2) && !asks.some(t => /Saving throw\s+(BF Test Sorcerer|BF Test Ranger):/.test(t.replace(/\s+/g, ' '))), asks.map(t => t.replace(/\s+/g, ' ').trim().slice(0, 60)).join(' | '));
      ok('9f. no picker on the card - the ticks are in the casting window (the second look, 2026-09-09)', !document.querySelector(`[data-message-id="${card?.id}"] [data-bf-metamagic-adjust]`), '');
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

    if (want(11) && rgrTok && vicTok) {
      await gather();
      await set('saveTimer', 0);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      let radios = [];
      let windowRadios = 0;
      const { card, why } = await castArea('heightened', fs => {
        windowRadios = (fs?.querySelectorAll('[data-bf-metamagic-row="heightened"] input[name="bf-metamagic-mark"]') ?? []).length;
      }, rows => {
        radios = rows;
        const goblins = rows.filter(r => /Hobgoblin|Goblin/.test(r.name));
        goblins[1]?.el?.click();
      });
      ok('11a. with nobody targeted the window lists nobody; the ask at the area lists the four with the first goblin marked', windowRadios === 0 && radios.length === 4 && radios.filter(r => r.checked).length === 1 && /Hobgoblin|Goblin/.test(radios.find(r => r.checked)?.name ?? ''), `window=${windowRadios} rows=${radios.map(r => `${r.name}:${r.checked}`).join(',')}`);
      const mm = card?.getFlag(MOD, 'metamagic'), saves = card?.getFlag(MOD, 'saves');
      const second = radios.filter(r => /Hobgoblin|Goblin/.test(r.name))[1];
      ok('11b. the second goblin picked is the one the demand marks', mm?.chosen === true && !!mm?.target && saves?.demand?.heightened?.uuid === second?.uuid && mm.target.uuid === second?.uuid, why || JSON.stringify({ target: mm?.target, mark: saves?.demand?.heightened?.name }));
      await closeDialogs();
    } else if (want(11)) ok('11. fixtures', false, 'BF Test Ranger or BF Test Victim missing');

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
      const { app, fs } = await openWindow('Fireball', { consume: { spellSlot: false }, create: { measuredTemplate: false } });
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
      // The same roll is offered Empowered (its own moment, §16): keep it, so its popup is not the one §16 finds.
      await sleep(300); try { await popupFor(dmg?.id, 'empowered')?.close(); } catch { /* gone */ }
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
      // The applier creates the effect, THEN doubles its clock (a second write): wait for the doubled clock, not the effect.
      const paralyzed = await waitFor(() => { const e = vicActor.effects.find(x => x.statuses?.has?.('paralyzed') && x.getFlag(MOD, 'applied')); return (e && (e.duration?.seconds === 120)) ? e : null; }, 12000) ?? vicActor.effects.find(x => x.statuses?.has?.('paralyzed')) ?? null;
      const receiptCards = game.messages.filter(m => (m.getFlag(MOD, 'effectReceipt')?.targets ?? []).some(t => t.uuid === vicActor.uuid)).map(m => `${m.id === card?.id ? 'THIS' : m.id}:${m.getFlag(MOD, 'metamagic')?.key ?? '-'}`);
      ok('14b. the failed save lands Paralyzed with its clock DOUBLED: 120 seconds, not 60', paralyzed?.duration?.seconds === 120, `seconds=${paralyzed?.duration?.seconds} outcome=${JSON.stringify(card?.getFlag(MOD, 'saves')?.targets?.map(t => t.outcome))} origin=${paralyzed?.origin} receipts=${receiptCards.join(',')} cardKey=${card?.getFlag(MOD, 'metamagic')?.key}`);
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

    // --- Stage 4: Seeking and Empowered ------------------------------------------------------
    if (want(15)) {
      const p = pool(); if (p.system.uses.spent) await p.update({ 'system.uses.spent': 0 });
      await set('d20Folds', game.settings.settings.get(`${MOD}.d20Folds`).default);
      await set('d20FoldAsk', true);
      await set('holdTimer', 0);
      const foe = attTok.actor;
      const priorAC = { calc: foe.system._source.attributes.ac.calc, flat: foe.system._source.attributes.ac.flat ?? null };
      await foe.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 60 });   // a guaranteed miss
      await sorcTok.update(sorcHome, { teleport: true, animate: false });
      await attTok.update({ x: sorcHome.x + scene.grid.size * 2, y: sorcHome.y }, { teleport: true, animate: false });
      const foeTok = canvas.tokens.get(attTok.id);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      foeTok?.setTarget(true, { releaseOthers: true });
      await sleep(200);
      const before = new Set(game.messages.map(m => m.id));
      await spellAct('Chromatic Orb').use({ consume: { spellSlot: false }, create: { measuredTemplate: false } }, { configure: false }, {});
      const card = await waitFor(() => game.messages.find(m => !before.has(m.id) && (m.getFlag('dnd5e', 'messageType') === 'usage' || m.type === 'usage')) ?? null, 6000);
      // WITH ADVANTAGE (user, 2026-09-10: 'it seemed like it rolled 4 dice not 2') - dnd5e 5.3 expands
      // `1d20adv` to two dice at evaluation, so the original's formula reads `2d20adv`; a reroll rebuilt
      // from it with the original's `configured` option skipped the normalisation and expanded AGAIN.
      await spellAct('Chromatic Orb').rollAttack({ advantage: true }, { configure: false }, { data: { 'flags.dnd5e.originatingMessage': card?.id } });
      const attack = await waitFor(() => game.messages.find(m => !before.has(m.id) && m.getFlag('dnd5e', 'roll.type') === 'attack' && m.getFlag(MOD, 'd20fold')) ?? null, 8000);
      const fold = attack?.getFlag(MOD, 'd20fold');
      ok('15a. the missed spell attack is offered Seeking Spell as a d20 fold', !!fold && (fold.offers ?? []).some(o => o.kind === 'seeking') && fold.spell === true, `offers=${JSON.stringify((fold?.offers ?? []).map(o => `${o.kind}:${o.label}`))} spell=${fold?.spell}`);
      // Answer from the popup, as the player would: the offer's own button.
      const popup = await waitFor(() => [...foundry.applications.instances.values()].find(a => a.rendered && a.element?.querySelector?.('[data-bf-rescue-action="seeking"]')) ?? null, 6000);
      const clickedAt = Date.now();
      popup?.element?.querySelector('[data-bf-rescue-action="seeking"]')?.click();
      // THE WINDOW GOES AT THE CLICK (user, 2026-09-10: "the form stays for a few seconds"), not at the
      // verdict - the dice are still landing for up to six seconds after this.
      const goneAfter = await waitFor(() => (!popup?.rendered || !popup?.element?.isConnected) ? { ms: Date.now() - clickedAt } : null, 5000);
      // The spend is RECORDED before the dice are waited out (the 2026-09-10 review), so a spend on the flag
      // is no longer the verdict - foldedTotal is. Wait for the verdict.
      const resolved = await waitFor(() => { const f2 = attack?.getFlag(MOD, 'd20fold'); return ((f2?.spends ?? []).some(s => s.kind === 'seeking') && Number.isFinite(f2?.foldedTotal)) ? f2 : null; }, 15000);
      const f15 = attack?.getFlag(MOD, 'd20fold');
      ok('15b. Seeking rerolls the d20 — the spend records the reroll, the total replaced', !!resolved && Number.isFinite(resolved.spends.find(s => s.kind === 'seeking')?.reroll?.total) && Number.isFinite(resolved.foldedTotal), JSON.stringify({ popup: !!popup, status: f15?.status, outcome: f15?.outcome, answer: f15?.answer, spends: f15?.spends, folded: f15?.foldedTotal, base: f15?.baseTotal }));
      ok('15c. one Sorcery Point spent by hand, the record on the attack message', pool().system.uses.value === 4 && attack?.getFlag(MOD, 'poolSpend')?.pool === 'Sorcery Points' && attack?.getFlag(MOD, 'poolSpend')?.ability === 'Seeking Spell', `pool=${pool().system.uses.value} record=${JSON.stringify(attack?.getFlag(MOD, 'poolSpend'))}`);
      const res = attack ? await renderedLine(attack, 'bf-resource-line') : null;
      ok('15d. the attack card carries the resource line', /Sorcery Points: 4 of 5 remaining/.test(res ?? ''), res);
      // THE DICE ROLL AGAIN (user, 2026-09-10: "the dice so nice, if avail, should roll again"). Dice So
      // Nice animates any CREATED message that is a roll with dice, content visible, not flagged skip -
      // its own gate, read from its source. The reroll rides its own message, so the gate must hold.
      const reroll15 = game.messages.find(m => m.getFlag(MOD, 'respondsTo') === attack?.id && m.isRoll) ?? null;
      const gate15 = !!reroll15 && reroll15.rolls.some(r => r.dice.length > 0) && reroll15.isContentVisible && !reroll15.getFlag('dice-so-nice', 'skip');
      ok('15e. the reroll rides its own message and passes the Dice So Nice gate (a roll, dice, visible)', gate15 && reroll15.rolls[0].dice[0].faces === 20, JSON.stringify({ found: !!reroll15, isRoll: reroll15?.isRoll, dice: reroll15?.rolls?.[0]?.dice?.length, faces: reroll15?.rolls?.[0]?.dice?.[0]?.faces, visible: reroll15?.isContentVisible }));
      const origD20 = attack?.rolls?.[0]?.dice?.[0]?.results?.length ?? 0;
      const reD20 = reroll15?.rolls?.[0]?.dice?.[0]?.results?.length ?? 0;
      ok('15f. under advantage the original rolled two d20s and the reroll rolled exactly as many - two, never four', origD20 === 2 && reD20 === 2, JSON.stringify({ original: origD20, reroll: reD20, formula: reroll15?.rolls?.[0]?.formula }));
      ok('15g. the window closed at the click, well before the dice landed', !!goneAfter && goneAfter.ms < 1500, JSON.stringify(goneAfter ?? { gone: false }));
      await closeDialogs();
      await foe.update({ 'system.attributes.ac.calc': priorAC.calc, 'system.attributes.ac.flat': priorAC.flat });
      await attTok.update(attHome, { teleport: true, animate: false });
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
    }

    if (want(16)) {
      const p = pool(); if (p.system.uses.spent) await p.update({ 'system.uses.spent': 0 });
      const fired0 = count('dnd5e.rollDamageV2');
      const t16 = Date.now();
      log.push(`§16 start: pool ${pool().system.uses.value}/${pool().system.uses.max}, rollDamageV2 fired ${fired0} so far`);
      await set('holdTimer', 0);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      const before = new Set(game.messages.map(m => m.id));
      await spellAct('Fireball').use({ consume: { spellSlot: false }, create: { measuredTemplate: false } }, { configure: false }, {});
      const card = await waitFor(() => game.messages.find(m => !before.has(m.id) && (m.getFlag('dnd5e', 'messageType') === 'usage' || m.type === 'usage')) ?? null, 6000);
      await spellAct('Fireball').rollDamage({}, { configure: false }, { data: { 'flags.dnd5e.originatingMessage': card?.id } });
      const dmg = await waitFor(() => game.messages.find(m => !before.has(m.id) && m.getFlag('dnd5e', 'roll.type') === 'damage' && m.getFlag(MOD, 'empowered')) ?? null, 8000);
      const flag = dmg?.getFlag(MOD, 'empowered');
      ok('16a. the spell\'s damage roll is offered Empowered: eight dice, the cap 3, the total recorded', flag?.status === 'pending' && flag?.dice?.length === 8 && flag?.cap === 3 && flag?.oldTotal === dmg?.rolls?.[0]?.total, JSON.stringify({ status: flag?.status, dice: flag?.dice?.length, cap: flag?.cap, old: flag?.oldTotal }));
      const popup = await waitFor(() => { const d = popupFor(dmg?.id, 'empowered'); return (d?.rendered && d.element?.querySelector?.('[data-bf-empowered-dice]')) ? d : null; }, 6000);
      const chips = [...(popup?.element?.querySelectorAll('[data-bf-die]') ?? [])];
      ok('16b. the popup shows the eight dice as chips', chips.length === 8, `chips=${chips.length}`);
      // Tick the two lowest dice, then a third and a fourth — the cap holds at three.
      const sorted = chips.slice().sort((a, b) => Number(a.textContent) - Number(b.textContent));
      for (const c of sorted.slice(0, 4)) { c.click(); await sleep(30); }
      const picked = chips.filter(c => c.dataset.picked === '1');
      ok('16c. the cap holds: four ticks, three picked', picked.length === 3, `picked=${picked.length}`);
      const oldTotal = dmg.rolls[0].total;
      const oldFaces = picked.map(c => Number(c.textContent));
      const clicked16 = Date.now();
      popup?.element?.querySelector('button[data-action="reroll"]')?.click();
      // THE WINDOW GOES AT THE CLICK (user, 2026-09-10: "when you pick the dice and roll, kinda lags
      // closing") - the dice are still landing for up to six seconds after this.
      const gone16 = await waitFor(() => (!popup?.rendered || !popup?.element?.isConnected) ? { ms: Date.now() - clicked16 } : null, 5000);
      const used = await waitFor(() => { const f2 = dmg.getFlag(MOD, 'empowered'); return f2?.status === 'used' ? f2 : null; }, 10000);
      log.push(`§16 after: pool ${pool().system.uses.value}, rollDamageV2 fired ${count('dnd5e.rollDamageV2') - fired0} for this roll, poolSpend=${JSON.stringify(dmg.getFlag(MOD, 'poolSpend'))}`);
      log.push(`§16 spends since start: ${game.messages.filter(m => (m.timestamp >= t16) && m.getFlag(MOD, 'poolSpend')).map(m => `${m.getFlag(MOD, 'poolSpend').ability}@${m.id.slice(-4)}`).join(',')} | empowered flags: ${game.messages.filter(m => m.getFlag(MOD, 'empowered')).map(m => `${m.id.slice(-4)}:${m.getFlag(MOD, 'empowered').status}`).join(',')} | spent=${pool().system.uses.spent}`);
      ok('16d. Reroll: the point spent, three dice rerolled, the flag says which and what', !!used && used.picks?.length === 3 && pool().system.uses.value === 4 && used.picks.every(pk => Number.isFinite(pk.old) && Number.isFinite(pk.new)), JSON.stringify({ picks: used?.picks, pool: pool().system.uses.value }));
      const roll = game.messages.get(dmg.id)?.rolls?.[0];
      const results = roll?.terms?.find(t => Array.isArray(t.results))?.results ?? [];
      const struck = results.filter(r => r.active === false && r.rerolled).length;
      const active = results.filter(r => r.active !== false).length;
      ok('16e. the message\'s own roll is patched: three faces struck and inactive, eight active, the total moved by the difference', struck === 3 && active === 8 && roll?.total === (oldTotal + used.delta) && roll?.total === used.newTotal, `struck=${struck} active=${active} total=${roll?.total} old=${oldTotal} delta=${used?.delta} new=${used?.newTotal}`);
      const announce = await waitFor(() => game.messages.find(m => !before.has(m.id) && m.getFlag(MOD, 'respondsTo') === dmg.id && /Empowered Spell/.test(m.content ?? '')) ?? null, 6000);
      ok('16f. the announce card says the old faces, the arrow, the new, and the totals', !!announce && new RegExp(`${oldFaces.sort((a, b) => a - b).join(', ')}|${used?.picks?.map(pk => pk.old).join(', ')}`).test(announce.content) && /→/.test(announce.content), announce?.content?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 140));
      const line = dmg ? await renderedLine(dmg, 'bf-empowered-line') : null;
      ok('16g. the damage card carries the Empowered line', /Empowered Spell — .*→/.test(line ?? ''), line);
      // THE DICE ROLL AGAIN (user, 2026-09-10). Empowered PATCHES the damage message's own roll, so no
      // created message ever carried the fresh dice and Dice So Nice never saw them. Now the ticked dice
      // are ONE Roll on the announce card - a roll, dice, visible - and the faces on it are the faces
      // the picks record, in order.
      const gate16 = !!announce && announce.isRoll && announce.rolls.some(r => r.dice.length > 0) && announce.isContentVisible && !announce.getFlag('dice-so-nice', 'skip');
      const faces16 = announce?.rolls?.[0]?.dice?.map(d => d.results.find(r => r.active !== false)?.result) ?? [];
      const picksNew = (used?.picks ?? []).map(pk => pk.new);
      ok('16i. the window closed at the click, well before the dice landed', !!gone16 && gone16.ms < 1500, JSON.stringify(gone16 ?? { gone: false }));
      ok('16h. the announce card carries the rerolled dice as ONE roll that passes the Dice So Nice gate, its faces the new faces of the picks in order', gate16 && faces16.length === picksNew.length && faces16.every((f, i) => f === picksNew[i]), JSON.stringify({ isRoll: announce?.isRoll, faces: faces16, picks: picksNew, visible: announce?.isContentVisible }));
      await closeDialogs();
    }

    // --- Careful's ticks in the window (user, 2026-09-09) ---------------------------------------
    if (want(17) && rgrTok) {
      const p17 = pool(); if (p17.system.uses.spent) await p17.update({ 'system.uses.spent': 0 });
      await set('saveTimer', 0);
      await sorcTok.update(sorcHome, { teleport: true, animate: false });
      await rgrTok.update({ x: sorcHome.x + scene.grid.size, y: sorcHome.y }, { teleport: true, animate: false });
      await attTok.update({ x: sorcHome.x, y: sorcHome.y - scene.grid.size }, { teleport: true, animate: false });
      await sleep(300);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      canvas.tokens.get(rgrTok.id)?.setTarget(true, { releaseOthers: true });
      canvas.tokens.get(attTok.id)?.setTarget(true, { releaseOthers: false });
      await sleep(200);
      // HOLD PERSON, not Fireball (2026-09-10): a template spell lists nobody in the window - the pick
      // waits for the area (18w) - so the window's creature controls are exercised on a targeted spell.
      const { app, fs } = await openWindow('Hold Person', { consume: { spellSlot: false }, create: { measuredTemplate: false } });
      // HEIGHTENED'S RADIO IS INERT UNTIL HEIGHTENED IS TICKED (user, 2026-09-10).
      const radios17 = () => [...(fs?.querySelectorAll('[data-bf-metamagic-row="heightened"] input[name="bf-metamagic-mark"]') ?? [])];
      const hRow = rowsOf(fs).find(r => r.key === 'heightened');
      const inertBefore = radios17().length === 2 && radios17().every(r => r.disabled);
      hRow?.box?.click(); await sleep(80);
      const liveAfter = radios17().every(r => !r.disabled);
      hRow?.box?.click(); await sleep(80);
      const inertAgain = radios17().every(r => r.disabled);
      ok('17c. the Heightened radio is greyed until Heightened is ticked, live once it is, greyed again when it is not', inertBefore && liveAfter && inertAgain, JSON.stringify({ radios: radios17().length, inertBefore, liveAfter, inertAgain }));
      const row = rowsOf(fs).find(r => r.key === 'careful');
      row?.box?.click(); await sleep(80);
      const ticks = [...(fs?.querySelectorAll('[data-bf-metamagic-row="careful"] input[name="bf-metamagic-protect"]') ?? [])];
      const tickOf = uuid => ticks.find(t => t.value === uuid);
      ok('17a. with two creatures targeted, the Careful row lists both, the Ranger (an ally) pre-ticked and the goblin not', ticks.length === 2 && tickOf(ranger.uuid)?.checked === true && !!tickOf(attTok.actor?.uuid) && !tickOf(attTok.actor?.uuid).checked, ticks.map(t => `${t.dataset.name}:${t.checked}`).join(','));
      // The player's own pick: the goblin protected, the Ranger not.
      tickOf(ranger.uuid)?.click(); await sleep(50);
      tickOf(attTok.actor?.uuid)?.click(); await sleep(80);
      const before = new Set(game.messages.map(m => m.id));
      app.element.querySelector('button[data-action="use"], button[type="submit"]')?.click();
      const card = await waitFor(() => game.messages.find(m => !before.has(m.id) && (m.getFlag('dnd5e', 'messageType') === 'usage' || m.type === 'usage') && m.getFlag('dnd5e', 'activity')?.uuid === spellAct('Hold Person')?.uuid) ?? null, 8000);
      await waitFor(() => card?.getFlag(MOD, 'saves')?.targets?.length ? card : null, 6000);
      const mm = card?.getFlag(MOD, 'metamagic'), saves = card?.getFlag(MOD, 'saves');
      ok('17b. the pick is honoured on the demand: the goblin protected, the Ranger owes the save', mm?.chosen === true && (mm?.protected ?? []).length === 1 && String(mm.protected[0].uuid).endsWith(attacker.id) && (saves?.targets ?? []).some(t => t.uuid === ranger.uuid) && !(saves?.targets ?? []).some(t => String(t.uuid).endsWith(attacker.id)), JSON.stringify({ protected: mm?.protected, targets: names(saves?.targets) }));
      await closeDialogs();
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      await scatter();
    } else if (want(17)) ok('17. fixtures', false, 'BF Test Ranger missing');

    if (want(18) && rgrTok) {
      await gather();
      // 18w. A TEMPLATE SPELL WITH CREATURES TARGETED STILL LISTS NOBODY (user, 2026-09-10: Fireball with
      // Thomas targeted "shouldn't have him in the check box") - the pick waits for the area.
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      canvas.tokens.get(rgrTok.id)?.setTarget(true, { releaseOthers: true });
      canvas.tokens.get(attTok.id)?.setTarget(true, { releaseOthers: false });
      await sleep(200);
      const w18 = await openWindow('Fireball', { consume: { spellSlot: false }, create: { measuredTemplate: false } });
      rowsOf(w18.fs).find(r => r.key === 'careful')?.box?.click(); await sleep(80);
      const ticksW = [...(w18.fs?.querySelectorAll('[data-bf-metamagic-row="careful"] input[name="bf-metamagic-protect"]') ?? [])];
      const marksW = [...(w18.fs?.querySelectorAll('[data-bf-metamagic-row="heightened"] input[name="bf-metamagic-mark"]') ?? [])];
      ok('18w. a template spell with two creatures targeted lists nobody in the window - Careful ticks none, Heightened radios none', ticksW.length === 0 && marksW.length === 0, JSON.stringify({ targeted: game.user.targets.size, ticks: ticksW.length, radios: marksW.length }));
      await w18.app?.close();
      await closeDialogs();
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      const { app, fs } = await openWindow('Fireball', { consume: { spellSlot: false }, create: { measuredTemplate: false } });
      rowsOf(fs).find(r => r.key === 'careful')?.box?.click(); await sleep(80);
      const ticks = [...(fs?.querySelectorAll('[data-bf-metamagic-row="careful"] input[name="bf-metamagic-protect"]') ?? [])];
      const names18 = ticks.map(t => t.dataset.name);
      ok('18x. with nobody targeted the window lists nobody — the pick waits for the area', ticks.length === 0, names18.join(','));
      await app?.close();
      await closeDialogs();
      const gone = await castArea('careful');
      ok('18y. the ask at the area lists exactly the four inside — never the Paladin or Gren out on the range', gone.askRows?.length === 4 && !gone.askRows.some(r => /Paladin|Gren|Cleric|Rogue|Shielder/.test(r.name)), gone.why || gone.askRows?.map(r => r.name).join(','));
      await scatter();
    } else if (want(18)) ok('18. fixtures', false, 'BF Test Ranger missing');

    if (want(19)) {
      const p19 = pool(); if (p19.system.uses.spent) await p19.update({ 'system.uses.spent': 0 });
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      // The real path: the default dialog config (configure undecided), which for a cantrip used to mean no window at all.
      const act19 = spellAct('Fire Bolt');
      const pending19 = act19?.use({ consume: { spellSlot: false } }, {}, { create: true });
      pending19?.catch?.(() => {});
      const app19 = await waitFor(() => [...foundry.applications.instances.values()].find(a => /ActivityUsageDialog|UsageDialog/.test(a.constructor?.name ?? '') && a.element?.querySelector?.('[data-bf-metamagic-field]')) ?? null, 6000);
      const fs19 = app19?.element?.querySelector('[data-bf-metamagic-field]') ?? null;
      ok('19a. Fire Bolt opens the casting window with the metamagic group (the system alone would have opened nothing)', !!act19 && !!fs19, JSON.stringify({ spell: !!act19, window: !!app19, group: !!fs19 }));
      const rows19 = rowsOf(fs19);
      const on19 = rows19.filter(r => !r.off).map(r => r.key).sort();
      const off19 = rows19.filter(r => r.off).map(r => r.key).sort();
      // Twinned (2024) fits only a spell that a HIGHER SLOT lets target one more creature - a cantrip cannot be
      // cast with a slot at all, so it is greyed, rightly (the first draft of this line expected it lit).
      ok('19b. the rows that fit a cantrip attack: Distant, Quickened, Subtle, Transmuted; Careful, Heightened, Extended and Twinned greyed', on19.join(',') === 'distant,quickened,subtle,transmuted' && ['careful', 'extended', 'heightened', 'twinned'].every(k => off19.includes(k)), JSON.stringify({ on: on19, off: off19 }));
      ok('19c. no scaling section was drawn for the cantrip - the lever is invisible', !app19?.element?.querySelector('[name="scalingValue"], [name="spell.slot"]'), 'scaling controls present');
      // TRANSMUTED'S TYPE RADIOS ARE INERT UNTIL TRANSMUTED IS TICKED (user, 2026-09-10).
      const types19 = () => [...(fs19?.querySelectorAll('[data-bf-metamagic-row="transmuted"] input[name="bf-metamagic-type"]') ?? [])];
      const tRow = rows19.find(r => r.key === 'transmuted');
      const inert0 = types19().length > 0 && types19().every(r => r.disabled);
      tRow?.box?.click(); await sleep(80);
      const live1 = types19().every(r => !r.disabled);
      tRow?.box?.click(); await sleep(80);
      const inert2 = types19().every(r => r.disabled);
      ok('19d. the Transmuted type radios are greyed until Transmuted is ticked, live once it is, greyed again when it is not', inert0 && live1 && inert2, JSON.stringify({ radios: types19().length, inert0, live1, inert2 }));
      await app19?.close();
      await closeDialogs();
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
