// Live suite: FAMILIAR FRIEND (Arcana Unleashed; RULINGS *Summons*, calls 45–47) — the feat's three benefits on a
// Find Familiar shaped as the feat grants it (a forward "(free casting)" activity spending the spell's one use per
// Long Rest): the free cast's use spent through the summon's cause, the boon's Hit Points landed off the feat's own
// enchantment change, and Helpful Friend's buy box in the skill dialog — offered within 5 ft of the familiar, greyed
// with the reason beyond it or with the familiar in its pocket, absent on an unproficient skill or a raw check.
// §8 connects the PLAYER test identity and casts the free cast with dnd5e's Allow Summoning OFF (session zero's
// premise): the record stamps `asked` on the player's own card, no token is created by the system, the use is spent.
//
// Fixtures: BTB Test Sorcerer (tools/fixture-suite.mjs) is lent the feat (the Arcana Unleashed feats pack) and the
// PHB's Find Familiar reshaped for the run; BTB Test Mage (the player's) the same for §8. Arcana proficiency is set on
// the Sorcerer for the run. The cards, the imported Owl, the tokens, the companion effect and the lent items are torn
// down; the settings put back. Like smoke-summons, the record is answered through the pure fold, never the popup.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, disposeSafely, finish, loadEnv, sectionArg, sectionPlan } from './harness.mjs';
import { playerConfig } from './target.mjs';
import { Foundry } from 'fvtt-mcp-dnd5e/client';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'summons.js',         // §1 the free cast's cause and spend, §2 a cancelled menu spends nothing, §3 the boon landed, §7 the pocket, §8 the player's cast
  'advantage-buys.js'   // §4 the box offered and spent, §5 greyed beyond 5 ft, §6 absent on an unproficient skill and a raw check, §7 greyed in the pocket
];

const SECTIONS = {
  1: 'THE FREE CAST: Find Familiar used through its "(free casting)" forward, sent to its card — the record stamps `asked`, the spell\'s one use is spent and no slot; answered as an Owl (Celestial), the elect lands it',
  2: 'A CANCELLED MENU SPENDS NOTHING: the forward used with the menu in the way, the menu cancelled — the use stands at 0 of 1 spent, no card',
  3: 'THE BOON: the landed Owl carries the feat\'s Hit Points — its maximum and current both the Owl\'s plus twice the caster\'s level; the record names Fortified Familiar',
  4: 'HELPFUL FRIEND, OFFERED: an Arcana check (proficient) with the Owl one square away — the box "Familiar Friend — 1 use · N left" with a tick; ticked, the net and default Advantage; pressed, a use spent, the record names the feat',
  5: 'BEYOND 5 FT: the Owl three squares away — the box stays, greyed, "your familiar is 15 ft away — within 5 feet only", no tick',
  6: 'NOT A PROFICIENT SKILL: a Stealth check (unproficient) and a raw Wisdom check carry no box at all',
  7: 'IN THE POCKET: the familiar put away — the box greyed "in its pocket dimension"; Dismiss ends it',
  8: 'THE PLAYER\'S CAST: with Allow Summoning off, the player test user\'s free cast on their own Mage posts its card with the record `asked`, no token created, the use spent'
};
const DEPENDS = { 3: [1], 4: [1], 5: [1], 7: [1] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const env = loadEnv();
const f = await connectSuite({ tag: 'familiar', watchdogMs: 300_000 });
announcePlan('familiar', plan, pulled);

/* --- the familiar as the feat grants it: lent to a caster, torn down after ------------------------- */
const LEND = `async ({ casterName }) => {
  const MOD = 'fvtt-mod-bythebooks';
  const caster = game.actors.getName(casterName);
  if (!caster) return { fatal: 'missing fixture: ' + casterName + ' — run tools/fixture-suite.mjs' };
  const fromPack = async (packId, name) => {
    const pack = game.packs.get(packId);
    if (!pack) throw new Error(packId + ' is not on this box');
    const hit = (await pack.getIndex()).find(e => e.name === name);
    if (!hit) throw new Error(packId + ' ships no "' + name + '"');
    const doc = await pack.getDocument(hit._id);
    const data = doc.toObject();
    delete data._id;
    foundry.utils.setProperty(data, '_stats.compendiumSource', doc.uuid);
    return data;
  };
  // a killed run's copies first (a lookup by name would find the stale one): the fixtures never carry these
  const stale = caster.items.filter(i => ((i.type === 'feat') && (i.name === 'Familiar Friend')) || ((i.type === 'spell') && (i.name === 'Find Familiar'))).map(i => i.id);
  if (stale.length) await caster.deleteEmbeddedDocuments('Item', stale);
  const feat = await fromPack('dnd-arcana-unleashed.feats', 'Familiar Friend');
  const spell = await fromPack('dnd-players-handbook.spells', 'Find Familiar');
  // as the feat's advancement grants it: prepared, one use per Long Rest, a forward spending that use with no slot
  spell.system.method = 'spell'; spell.system.prepared = 2;
  spell.system.uses = { max: '1', recovery: [{ period: 'lr', type: 'recoverAll' }], spent: 0 };
  const summonId = Object.values(spell.system.activities).find(a => a.type === 'summon')?._id;
  spell.system.activities.bfFreeCast000000 = { _id: 'bfFreeCast000000', type: 'forward', name: '(free casting)', sort: 1,
    activity: { id: summonId }, activation: { type: 'action', override: false },
    consumption: { targets: [{ type: 'itemUses', target: '', value: '1', scaling: {} }], scaling: { allowed: false }, spellSlot: true } };
  const made = await caster.createEmbeddedDocuments('Item', [feat, spell]);
  const featItem = made.find(i => i.type === 'feat');
  const spellItem = made.find(i => i.type === 'spell');
  if (!featItem || !spellItem) return { fatal: 'the lend made ' + made.length + ' item(s): ' + made.map(i => i.name + '/' + i.type).join(', ') };
  return { featId: featItem.id, spellId: spellItem.id, summonId, prof: Number(caster.system.attributes.prof) || 0, level: Number(caster.system.details.level) || 0 };
}`;

const out = await f.evaluate(async ({ sections, titles, extra }) => {
  const MOD = 'fvtt-mod-bythebooks';
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
  const waitFor = async (test, timeout = 8000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) { const v = await test(); if (v) return v; await sleep(200); }
    return test();
  };
  const suiteStart = Date.now();

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  const api = modDoc.api?.summons;
  if (!api?.askDismiss) return { fatal: 'no summons api — OLD code (reload the box)' };
  const { SUMMON_BOONS, ADVANTAGE_BUYS } = await import(`/modules/${MOD}/scripts/decide/registry.js`);
  if (!SUMMON_BOONS?.['Familiar Friend'] || !ADVANTAGE_BUYS?.['Familiar Friend']) return { fatal: 'the Familiar Friend rows are not in the loaded code — OLD code (reload the box)' };
  const { placedAnswer, companionAsk } = await import(`/modules/${MOD}/scripts/decide/summons.js`);
  const { SUMMON_CHOICES } = await import(`/modules/${MOD}/scripts/decide/registry.js`);
  const { poolFromPacks } = await import(`/modules/${MOD}/scripts/gallery.js`);

  const caster = game.actors.getName('BTB Test Sorcerer');
  if (!caster) return { fatal: 'missing fixture: BTB Test Sorcerer — run tools/fixture-suite.mjs' };
  const range = game.scenes.getName('By the Books Test Range');
  if (!range) return { fatal: 'missing fixture: scene By the Books Test Range — run tools/fixture-suite.mjs' };
  if (canvas.scene?.id !== range.id) await range.view();
  for (let i = 0; i < 40 && !(canvas.ready && canvas.scene?.id === range.id); i++) await sleep(250);
  if (canvas.scene?.id !== range.id) return { fatal: 'the canvas never readied on the test range' };
  const casterToken = canvas.scene.tokens.find(t => t.actor?.id === caster.id) ?? null;
  if (!casterToken) return { fatal: 'the Sorcerer has no token on the scene — run tools/fixture-suite.mjs' };
  const grid = canvas.scene.grid.size;

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'holdTimer', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'saves', 'castApply', 'concMode',
    'reminderList', 'conditionList', 'damageEitherList', 'clockRiderList', 'hitMenuList', 'd20Folds', 'd20FoldAsk'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;
  const skillsBefore = { arc: foundry.utils.deepClone(caster.system._source.skills?.arc ?? {}), ste: foundry.utils.deepClone(caster.system._source.skills?.ste ?? {}) };

  const lent = [];
  const madeTokens = [];
  const madeActors = [];
  const madeMessages = [];
  let restored = false;
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      const ours = /RollConfigurationDialog/.test(app.constructor?.name ?? '') || app.element?.querySelector?.('[data-bf-buy]')
        || (/Find Familiar/.test(app.element?.textContent ?? '') && (app instanceof foundry.applications.api.DialogV2));
      if (ours) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      await caster.update({ 'system.skills.arc': skillsBefore.arc, 'system.skills.ste': skillsBefore.ste });
      const tokens = madeTokens.filter(id => canvas.scene.tokens.get(id));
      if (tokens.length) await canvas.scene.deleteEmbeddedDocuments('Token', tokens);
      for (const e of caster.effects.filter(e => /^Familiar:/.test(e.name))) { try { await e.delete({ [MOD]: { companionEnd: true } }); } catch { try { await e.delete(); } catch { /* gone */ } } }
      const live = caster.items.filter(i => lent.includes(i.id) || ((i.type === 'feat') && (i.name === 'Familiar Friend')) || ((i.type === 'spell') && (i.name === 'Find Familiar'))).map(i => i.id);
      if (live.length) await caster.deleteEmbeddedDocuments('Item', live);
      for (const a of madeActors) { if (game.actors.get(a.id)) await a.delete(); }
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BTB Test') || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  // ---- the dialog drivers (smoke-lucky's)
  const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const rollDialog = () => [...foundry.applications.instances.values()]
    .find(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element) ?? null;
  const openDialog = async (expectBox = true) => {
    const dlg = await waitFor(rollDialog, 6000);
    if (expectBox) await waitFor(() => dlg?.element?.querySelector('[data-bf-buy]'), 3000);
    await sleep(300);
    return dlg;
  };
  const boxOf = dlg => dlg?.element?.querySelector('[data-bf-buy]') ?? null;
  const tickOf = dlg => dlg?.element?.querySelector('input[name="bf-buy"]') ?? null;
  const defaultOf = dlg => dlg?.element?.querySelector('button[data-bf-default]')?.dataset?.action ?? null;
  const netOf = dlg => dlg?.element?.querySelector('[data-bf-reminder-head] [data-bf-mode]')?.dataset?.bfMode ?? null;
  const tick = async dlg => { const t = tickOf(dlg); if (t) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); } await sleep(150); };
  const press = (dlg, mode) => { const b = dlg?.element?.querySelector(`button[data-action="${mode}"]`); b?.click(); return !!b; };
  const lastOf = type => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.type === type)).pop() ?? null;

  let featItem = null;
  let spellItem = null;
  let summon = null;
  let forward = null;
  const usesSpent = () => Number(caster.items.get(spellItem?.id)?.system?.uses?.spent ?? -1);
  const featLeft = () => Number(caster.items.get(featItem?.id)?.system?.uses?.value ?? -1);
  const slotsLeft = () => Number(caster.system.spells?.spell1?.value ?? -1);
  let landedMessage = null;
  let owlToken = null;
  let owlDoc = null;
  const owlBaseHp = async () => {
    const owl = (await poolFromPacks({ crMax: 0, types: ['beast'] })).find(r => r.name === 'Owl');
    const doc = owl ? await fromUuid(owl.uuid) : null;
    return { owl, max: Number(doc?.system?.attributes?.hp?.max) || 0 };
  };
  const moveOwl = async squaresRight => {
    await owlDoc.update({ x: casterToken.x + grid * squaresRight, y: casterToken.y });
    await waitFor(() => (canvas.tokens.get(owlDoc.id)?.document?.x === owlDoc.x) ? true : null, 4000);
    await sleep(300);
  };

  try {
    await set('autoDamage', 'all');
    await set('autoApply', false);
    await set('playerRollDamage', true);
    await set('damageTimer', 0);
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('holdTimer', 0);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('masteryAsk', false);
    await set('saves', false);
    await set('castApply', false);
    await set('concMode', 'off');
    await set('reminderList', 'buy');
    await set('conditionList', def('conditionList'));
    await set('damageEitherList', '');
    await set('clockRiderList', '');
    await set('hitMenuList', '');
    await set('d20Folds', '');
    await set('d20FoldAsk', false);
    if (game.combat) await game.combat.delete();
    // the Sorcerer proficient in Arcana, not in Stealth, for the run
    await caster.update({ 'system.skills.arc.value': 1, 'system.skills.ste.value': 0 });
    // a slot in hand, so "no slot spent" means something
    if ((caster.system.spells?.spell1?.max ?? 0) > 0) await caster.update({ 'system.spells.spell1.value': caster.system.spells.spell1.max });

    // ---- fixtures: the feat and the shaped spell
    const lendFn = new Function('return ' + extra.lend)();
    const lentOut = await lendFn({ casterName: caster.name });
    if (lentOut.fatal) return { fatal: lentOut.fatal };
    lent.push(lentOut.featId, lentOut.spellId);
    featItem = caster.items.get(lentOut.featId);
    spellItem = caster.items.get(lentOut.spellId);
    summon = spellItem.system.activities.get(lentOut.summonId);
    forward = spellItem.system.activities.get('bfFreeCast000000');
    if (!summon || !forward) return { fatal: `the lent Find Familiar lacks its activities (summon=${!!summon} forward=${!!forward})` };
    const level = lentOut.level;
    const PROF = lentOut.prof;
    log.push(`fixture: ${caster.name} level ${level}, proficiency ${PROF}; Find Familiar with "(free casting)" (${forward.relativeUUID})`);
    // a familiar standing from an earlier run would open the menu instead of a cast
    for (const e of caster.effects.filter(e => /^Familiar:/.test(e.name))) { try { await e.delete({ [MOD]: { companionEnd: true } }); } catch { /* gone */ } }

    // ---- 1. the free cast through the forward, to its card
    if (want(1)) {
      const slotsBefore = slotsLeft();
      const tokensBefore = new Set(canvas.scene.tokens.map(t => t.id));
      const result = await forward.use({ [MOD]: { toCard: true }, create: { measuredTemplate: false } }, { configure: false }, { create: true });
      const message = result?.message instanceof ChatMessage ? result.message : null;
      if (message) madeMessages.push(message);
      const flag = await waitFor(() => message?.getFlag(MOD, 'summon')?.status === 'asked' ? message.getFlag(MOD, 'summon') : null, 6000);
      ok('§1a the forward\'s cast posts its card with the record asked — the system placed nothing',
        !!flag && (canvas.scene.tokens.filter(t => !tokensBefore.has(t.id)).length === 0),
        `message=${!!message} status=${flag?.status} newTokens=${canvas.scene.tokens.filter(t => !tokensBefore.has(t.id)).length}`);
      ok('§1b the spell\'s one use is spent through the cause, no slot', (usesSpent() === 1) && (slotsLeft() === slotsBefore),
        `spent=${usesSpent()} slots ${slotsBefore}→${slotsLeft()}`);
      // answered as an Owl (Celestial), one square to the right
      const { owl } = await owlBaseHp();
      const patch = (flag && owl) ? placedAnswer(flag, { profileId: flag.profiles[0]?.id ?? null, pick: { uuid: owl.uuid, name: owl.name }, count: 1, sceneId: canvas.scene.id,
        creatureType: (flag.creatureTypes ?? []).includes('celestial') ? 'celestial' : (flag.creatureTypes?.[0] ?? null),
        placements: [{ x: casterToken.x + grid, y: casterToken.y, elevation: casterToken.elevation ?? 0, rotation: 0 }] }, SUMMON_CHOICES) : null;
      if (patch) await message.setFlag(MOD, 'summon', { ...flag, ...patch });
      const landed = patch ? await waitFor(() => message.getFlag(MOD, 'summon')?.applied ? message.getFlag(MOD, 'summon') : null, 20000) : null;
      owlDoc = canvas.scene.tokens.get(landed?.landed?.[0]?.tokenId) ?? null;
      if (owlDoc) madeTokens.push(owlDoc.id);
      for (const a of game.actors.filter(a => a.getFlag('dnd5e', 'isAutoImported') && a.name === 'Owl')) if (!madeActors.includes(a)) madeActors.push(a);
      owlToken = owlDoc ? await waitFor(() => canvas.tokens.get(owlDoc.id), 6000) : null;
      landedMessage = landed ? message : null;
      ok('§1c answered as an Owl, the elect lands it beside the caster with the companion effect on the caster',
        landed?.outcome === 'landed' && !!owlToken && caster.effects.some(e => e.getFlag(MOD, 'companion') === message.id),
        JSON.stringify({ patch: !!patch, owl: !!owl, outcome: landed?.outcome, failure: landed?.failure, token: !!owlToken }));
    }

    // ---- 2. a cancelled menu spends nothing
    if (want(2)) {
      await spellItem.update({ 'system.uses.spent': 0 });
      const before = game.messages.size;
      // the menu in the way: the standing companion's (after §1) or the cast's own picker
      const p = forward.use({}, { configure: false }, { create: true }).catch(() => null);
      const menu = await waitFor(() => [...foundry.applications.instances.values()].find(a => (a instanceof foundry.applications.api.DialogV2) && /Find Familiar/.test(a.element?.textContent ?? '')) ?? null, 8000);
      ok('§2a the forward\'s cast opens the module\'s menu, not the system\'s', !!menu, `menu=${!!menu}`);
      if (menu) { try { await menu.close(); } catch { /* gone */ } }
      await p;
      await sleep(600);
      ok('§2b cancelled: the use stands unspent and no card posted', (usesSpent() === 0) && (game.messages.size === before),
        `spent=${usesSpent()} messages ${before}→${game.messages.size}`);
      await closeDialogs();
    }

    // ---- 3. the boon
    if (want(3)) {
      const { max: base } = await owlBaseHp();
      const hp = owlDoc?.actor?.system?.attributes?.hp ?? {};
      const boon = landedMessage?.getFlag(MOD, 'summon')?.boon ?? null;
      ok(`§3a the Owl's Hit Points are its own plus twice the caster's level (${base} + ${2 * level})`,
        (Number(hp.max) === base + 2 * level) && (Number(hp.value) === base + 2 * level),
        `hp=${hp.value}/${hp.max} base=${base} level=${level}`);
      ok('§3b the record names Fortified Familiar and the amount', boon?.feature === 'Familiar Friend' && boon?.benefit === 'Fortified Familiar' && (Number(boon?.hp) === 2 * level),
        JSON.stringify(boon));
    }

    // ---- 4. Helpful Friend, offered
    if (want(4)) {
      await closeDialogs();
      await featItem.update({ 'system.uses.spent': 0 });
      const FULL = featLeft();
      await moveOwl(1);
      const before = lastOf('check')?.id ?? null;
      void caster.rollSkill({ skill: 'arc' });
      const dlg = await openDialog();
      const box = boxOf(dlg);
      ok(`§4a the box: "Familiar Friend — 1 use · ${FULL} left" with a tick, the default Normal`,
        new RegExp(`Familiar Friend — 1 use · ${FULL} left`).test(textOf(box)) && !!tickOf(dlg) && (defaultOf(dlg) === 'normal'),
        `box="${textOf(box).slice(0, 100)}" tick=${!!tickOf(dlg)} default=${defaultOf(dlg)}`);
      await tick(dlg);
      ok('§4b ticked: the net and the default move to Advantage', (netOf(dlg) === 'advantage') && (defaultOf(dlg) === 'advantage'), `net=${netOf(dlg)} default=${defaultOf(dlg)}`);
      press(dlg, 'advantage');
      const msg = await waitFor(() => { const m = lastOf('check'); return (m && (m.id !== before)) ? m : null; }, 8000);
      // the spend is the item's own write, after the roll: waited for, never a sleep (tools/README *A faster platform turns a poll into a lie*)
      await waitFor(() => (featLeft() === FULL - 1) ? true : null, 6000);
      await sleep(300);
      const rec = msg?.getFlag(MOD, 'reminder');
      ok('§4c pressed: the check went out at Advantage, a use spent, the record names Familiar Friend',
        (Number(msg?.rolls?.[0]?.options?.advantageMode) === 1) && (featLeft() === FULL - 1)
          && (rec?.sources ?? []).some(s => (s.kind === 'buy') && /Familiar Friend/.test(s.label)) && (msg?.getFlag(MOD, 'poolSpend')?.left === FULL - 1),
        `mode=${msg?.rolls?.[0]?.options?.advantageMode} left=${featLeft()} rec=${JSON.stringify(rec?.sources)} spend=${JSON.stringify(msg?.getFlag(MOD, 'poolSpend'))}`);
      await closeDialogs();
    }

    // ---- 5. beyond 5 ft
    if (want(5)) {
      await closeDialogs();
      await moveOwl(3);
      void caster.rollSkill({ skill: 'arc' });
      const dlg = await openDialog();
      const box = boxOf(dlg);
      ok('§5a three squares away: the box greyed "your familiar is 15 ft away — within 5 feet only", no tick',
        !!box && /your familiar is 15 ft away — within 5 feet only/.test(textOf(box)) && !tickOf(dlg),
        `box="${textOf(box).slice(0, 120)}" tick=${!!tickOf(dlg)}`);
      await closeDialogs();
      await moveOwl(1);
    }

    // ---- 6. not a proficient skill, not a skill
    if (want(6)) {
      await closeDialogs();
      void caster.rollSkill({ skill: 'ste' });
      let dlg = await openDialog(false);
      ok('§6a Stealth (unproficient): no box at all', !!dlg && !boxOf(dlg), `dialog=${!!dlg} box=${!!boxOf(dlg)}`);
      await closeDialogs();
      void caster.rollAbilityCheck({ ability: 'wis' });
      dlg = await openDialog(false);
      ok('§6b a raw Wisdom check: no box at all', !!dlg && !boxOf(dlg), `dialog=${!!dlg} box=${!!boxOf(dlg)}`);
      await closeDialogs();
    }

    // ---- 7. in the pocket, then Dismiss
    if (want(7) && landedMessage) {
      await closeDialogs();
      const flag = landedMessage.getFlag(MOD, 'summon');
      const patch = companionAsk(flag.companion, { kind: 'away' });
      if (patch) await landedMessage.setFlag(MOD, 'summon', { ...flag, companion: { ...flag.companion, ...patch } });
      const pocket = await waitFor(() => landedMessage.getFlag(MOD, 'summon')?.companion?.state === 'pocket' ? true : null, 15000);
      ok('§7a put away: the companion waits in its pocket, its token gone', !!pocket && !canvas.scene.tokens.get(owlDoc?.id), `state=${landedMessage.getFlag(MOD, 'summon')?.companion?.state} token=${!!canvas.scene.tokens.get(owlDoc?.id)}`);
      void caster.rollSkill({ skill: 'arc' });
      const dlg = await openDialog();
      const box = boxOf(dlg);
      ok('§7b the box greyed "your familiar is in its pocket dimension", no tick', !!box && /your familiar is in its pocket dimension/.test(textOf(box)) && !tickOf(dlg),
        `box="${textOf(box).slice(0, 120)}" tick=${!!tickOf(dlg)}`);
      await closeDialogs();
      await api.askDismiss(landedMessage);
      const dismissed = await waitFor(() => landedMessage.getFlag(MOD, 'summon')?.dismissed ? true : null, 15000);
      ok('§7c Dismiss ends it: the companion effect leaves the caster', !!dismissed && !caster.effects.some(e => e.getFlag(MOD, 'companion') === landedMessage.id),
        `dismissed=${!!dismissed} effects=${caster.effects.map(e => e.name).join(', ')}`);
    } else if (want(7)) {
      results.push({ name: '§7 skipped — §1 landed nothing', pass: false, detail: '' });
    }
  } catch (err) {
    results.push({ name: 'suite threw', pass: false, detail: `${err?.message}\n${err?.stack}` });
  } finally {
    await teardown();
  }
  return { results, log, skips };
}, sectionArg(plan, SECTIONS, { lend: LEND }));

/* --- §8: the player's own cast, Allow Summoning off ------------------------------------------------ */
if (!out.fatal && (!plan || plan.includes('8'))) {
  const gmSide = await f.evaluate(async () => {
    const was = game.settings.get('dnd5e', 'allowSummoning');
    if (was) await game.settings.set('dnd5e', 'allowSummoning', false);
    return { was };
  });
  let player = null;
  try {
    console.log('[familiar] player connecting…');
    player = new Foundry(playerConfig(env));
    await player.connect();
    const cast = await player.evaluate(async ({ lend }) => {
      const MOD = 'fvtt-mod-bythebooks';
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const waitFor = async (test, timeout = 8000) => {
        const until = Date.now() + timeout;
        while (Date.now() < until) { const v = await test(); if (v) return v; await sleep(200); }
        return test();
      };
      const mage = game.actors.getName('BTB Test Mage');
      if (!mage?.isOwner) return { fatal: `the player does not own BTB Test Mage (owner=${mage?.isOwner})` };
      for (const e of mage.effects.filter(e => /^Familiar:/.test(e.name))) { try { await e.delete({ [MOD]: { companionEnd: true } }); } catch { /* gone */ } }
      const lendFn = new Function('return ' + lend)();
      const lentOut = await lendFn({ casterName: mage.name });
      if (lentOut.fatal) return { fatal: lentOut.fatal };
      const spell = mage.items.get(lentOut.spellId);
      const forward = spell.system.activities.get('bfFreeCast000000');
      const tokensBefore = canvas.scene?.tokens?.size ?? 0;
      const result = await forward.use({ [MOD]: { toCard: true }, create: { measuredTemplate: false } }, { configure: false }, { create: true });
      const message = result?.message instanceof ChatMessage ? result.message : null;
      const flag = await waitFor(() => message?.getFlag(MOD, 'summon')?.status === 'asked' ? message.getFlag(MOD, 'summon') : null, 6000);
      return { user: game.user.name, allowSummoning: game.settings.get('dnd5e', 'allowSummoning'), messageId: message?.id ?? null, status: flag?.status ?? null,
        spent: Number(mage.items.get(spell.id)?.system?.uses?.spent ?? -1), newTokens: (canvas.scene?.tokens?.size ?? 0) - tokensBefore,
        lent: [lentOut.featId, lentOut.spellId] };
    }, { lend: LEND });
    if (cast.fatal) out.results.push({ name: '§8 the player\'s cast', pass: false, detail: cast.fatal });
    else {
      out.results.push({ name: '§8a with Allow Summoning off, the player\'s free cast posts its card with the record asked and no token',
        pass: (cast.allowSummoning === false) && (cast.status === 'asked') && (cast.newTokens === 0),
        detail: `user=${cast.user} allowSummoning=${cast.allowSummoning} status=${cast.status} newTokens=${cast.newTokens}` });
      out.results.push({ name: '§8b the use is spent on the player\'s own sheet', pass: cast.spent === 1, detail: `spent=${cast.spent}` });
      // the GM tears the player's card and lent items down
      await f.evaluate(async ({ messageId, lent }) => {
        const mage = game.actors.getName('BTB Test Mage');
        const live = (mage?.items ?? []).filter(i => (lent ?? []).includes(i.id) || ((i.type === 'feat') && (i.name === 'Familiar Friend')) || ((i.type === 'spell') && (i.name === 'Find Familiar'))).map(i => i.id);
        if (live.length) await mage.deleteEmbeddedDocuments('Item', live);
        const m = game.messages.get(messageId);
        if (m) await m.delete();
      }, { messageId: cast.messageId, lent: cast.lent });
    }
  } catch (err) {
    out.results.push({ name: '§8 the player\'s cast', pass: false, detail: `${err?.message}` });
  } finally {
    if (player) await disposeSafely(player, 'familiar');
    await f.evaluate(async ({ was }) => { if (was) await game.settings.set('dnd5e', 'allowSummoning', was); }, { was: gmSide.was });
  }
}

await finish({ tag: 'familiar', out, plan, f });
