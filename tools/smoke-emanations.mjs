// Battle Flow emanations smoke test: an aura applies itself to the creatures inside it. The
// platform keeps the geometry and clock (a Region attached to the token); the module puts the
// pack's effect on it with the source's numbers, and raises the saves a spell demands on entry
// or turn end. Fixtures (tools/fixture-suite.mjs): BF Test Paladin, Cleric, Ranger, Victim.
// Harness discipline: settings restored; regions, templates, combats and messages deleted;
// member effects and chits cleared; tokens go home. Sections: `--section 3`, `--list`.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs parses this; `npm run coverage` checks it both ways).
// ⚠ NEVER import a suite: it connects on evaluation.
export const COVERS = [
  'emanations.js',          // the auras, Spirit Guardians, the live scenes, the §12-15 spells
  'saves/demand.js',        // §7 — the demand on enter and on turn end
  'saves/areas.js'          // §6 / §7 — the placed area the demand is judged against
];

const SECTIONS = {
  1: 'the behaviour type is registered at init, and the sweep raises the Paladin\'s aura: a Region attached to the token, the class\'s own 10 feet, the Paladin\'s +3 resolved into the effect',
  2: 'an ally walking in receives "Protected — BF Test Paladin" with the PALADIN\'s Charisma, not its own; walking out loses it',
  3: 'reach: a hostile inside a helpful aura receives nothing',
  4: 'the AREA moving onto a standing ally applies it; moving away lifts it',
  5: 'Incapacitated on the Paladin lifts the aura from everyone inside; recovering restores it',
  6: 'Spirit Guardians: the placed area (a Region, dnd5e 6.0) is adopted — attached to the Cleric, Half Speed on the hostile inside and not on the ally',
  7: 'Spirit Guardians triggers: a save demand card when the hostile enters, another when it ends its turn inside, none for a second entry in the same turn',
  8: 'the area goes (concentration\'s end) — the region goes and Half Speed lifts',
  10: 'the registrations FIRED (§11): createRegion, updateToken and the region events moved',
  18: 'THE AREA KIND (the spells slice, Tier 3, 2026-09-28): Moonbeam\'s placed region is adopted where it stands, attached to nothing; a creature walking in is demanded the save (its damage rolled); the beam MOVED onto a standing creature demands it; in combat a turn ended inside demands it, once per turn',
  19: 'Cloud of Daggers: an area whose activity is plain damage — a creature walking in takes the dice, rolled on the caster and applied with a receipt, no save',
  20: 'THE HELD SPELLS — Wall of Fire: the placed wall (a line) is adopted and WIDENED 10 ft on the side away from the Cleric (the base shape kept); the cast\'s card offers both sides by compass name; a creature ending its turn on the hot side is demanded the Dexterity save with the 5d8 fire, one on the cold side is not; flipping the side on the card re-shapes the region',
  21: 'Spike Growth: a walked move of 15 ft INSIDE the area pays 6d4 piercing when the move lands — a card with the roll and the feet, a receipt; a teleport pays nothing',
  22: 'Magic Circle: adopted with every type picked and no save demanded at the placement; a Fiend moving in raises the entry notice (the move carries on); the Fiend attacking a target INSIDE the circle has the gate list "Magic Circle — a fiend attacking into the circle" (net Disadvantage), attacking one outside it lists nothing; unticking Fiend on the card reaches the region and the gate lists nothing',
  23: 'Forcecage: adopted; a creature walking OUT of the cage raises the exit notice (the move carries on), walking in raises nothing',
  11: 'LIVE SCENES ONLY (user, 2026-09-04: the bleed; 2026-09-23: a viewed scene is live): another scene made active and viewed brings the range\'s rings down and lifts the ally\'s effects; a stale ring on a scene nobody is on is brought down by the ready sweep; the range VIEWED (not active) raises them; two live scenes with the ally inside the ring on both give ONE copy per aura; the range active again raises them once, no stack',
  12: 'THE SECOND SLICE — Aura of Life: the pack\'s effect on the ally inside, nothing on the hostile; an ally at 0 HP starting its turn inside regains the activity\'s own 1 HP, receipted',
  13: 'Crusader\'s Mantle: the ally inside wears the +1d4 radiant weapon-damage change the pack ships',
  14: 'Aura of Vitality: a NOTICE — nothing applied; at the caster\'s turn start a card offers Start of Turn Heal with a button, never played',
  15: 'Antilife Shell: a ring and a card, nothing applied; ends with concentration',
  16: 'a NO-SAVE concentration area (Fog Cloud, 2026-09-19): no demand card, no dependent at 6.0 — the module\'s own sweep ends the region with the concentration, exactly the areas the effect is tied to; a re-cast\'s area stands when the old concentration goes; an untied area is swept only when no other concentration of the spell stands',
  24: 'THE GM\'S SIDE — Fear Aura (2026-09-28): the Monster lent the trait raises a harmful ring off its save activity\'s Emanation; the Victim STARTING its turn inside is demanded the Wisdom save (cause turnStart, the failure\'s Frightened named), a failure lands Frightened by the verdict; the Monster Incapacitated, the next turn start asks nothing',
  25: 'Displacement (2026-09-28): the Victim attacking the Monster wearing the text-only trait sees "BF Test Monster is — Displacement", net Disadvantage; the Monster Incapacitated, the row is gone',
  17: "Polearm Master's Reactive Strike (2026-09-27): holding a Glaive, an invisible ring of its reach stands (no card); the hostile MOVING in raises Hew's reminder 'Reactive Strike' on the wielder; the ring sliding over a standing hostile does not; one walked move THROUGH the reach raises it too; the Glaive put away, the ring goes"
};
const DEPENDS = { 2: [1], 3: [1], 4: [1], 5: [1], 7: [6], 8: [6], 11: [1] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'emanations', watchdogMs: 600_000 });
announcePlan('emanations', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  const TYPE = `${MOD}.emanation`;
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
  const waitFor = async (fn, ms = 6000, step = 150) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > end) return null; await sleep(step); } };
  const suiteStart = Date.now();
  const ledger = globalThis.__bfHookLedger ?? null;
  const count = name => ledger?.[name] ?? 0;
  const mv = () => ({ teleport: true, animate: false });

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.decisionTimer`)) return { fatal: 'decisionTimer not registered — OLD code (restart the box)' };

  const SETTING_KEYS = ['emanations', 'emanationList', 'saves', 'saveTimer', 'playerRollDamage', 'autoApply', 'requireTarget', 'saveRolls'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const paladin = game.actors.getName('BF Test Paladin');
  const cleric = game.actors.getName('BF Test Cleric');
  const ranger = game.actors.getName('BF Test Ranger');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !paladin || !cleric || !ranger || !victim) return { fatal: 'missing fixture: scene, BF Test Paladin, BF Test Cleric, BF Test Ranger or BF Test Victim — run tools/fixture-suite.mjs' };
  const tok = actor => scene.tokens.find(t => t.actorId === actor.id) ?? null;
  const palTok = tok(paladin), clrTok = tok(cleric), rgrTok = tok(ranger), vicTok = tok(victim);
  if (!palTok || !clrTok || !rgrTok || !vicTok) return { fatal: 'a fixture token is missing from the range — run tools/fixture-suite.mjs' };
  // The range is made ACTIVE as well as viewed (a ring stands on a live scene; §11 moves the active
  // scene away and back). Done after every fatal check; the prior active scene returns in teardown.
  const priorActiveScene = game.scenes.active?.id ?? null;
  if (game.scenes.active?.id !== scene.id) { await scene.activate(); await sleep(1500); }
  if (canvas.scene?.id !== scene.id) { await scene.view(); await sleep(1500); }
  const home = Object.fromEntries([palTok, clrTok, rgrTok, vicTok].map(t => [t.id, { x: t.x, y: t.y }]));
  const grid = scene.grid.size;
  const px = scene.dimensions?.distancePixels ?? (grid / scene.grid.distance);

  const memberFx = (actor, regionId = null) => (actor?.effects ?? []).filter(e => { const f = e.getFlag(MOD, 'emanation'); return f && (!regionId || f.regionId === regionId); });
  const featureRegion = (tokDoc, key) => scene.regions.find(r => { const f = r.getFlag(MOD, 'emanation'); return f?.kind === 'feature' && f.tokenId === tokDoc.id && f.key === key; }) ?? null;
  const spellRegion = key => scene.regions.find(r => { const f = r.getFlag(MOD, 'emanation'); return f?.kind === 'spell' && f.key === key; }) ?? null;
  const triggerCards = () => game.messages.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationTrigger'));

  let combat = null;
  let template = null;
  const addedItems = [];   // the §12-15 spells, given to the Cleric for the run
  let elsewhere = null;   // §11's other scene
  let restored = false;
  const priorActiveCombats = [];
  const sgItemUuid = () => cleric.items.find(i => i.name === 'Spirit Guardians')?.uuid ?? null;
  const clearMembers = async () => {
    for (const a of [paladin, cleric, ranger, victim, vicTok.actor].filter(Boolean)) {
      const fx = a.effects.filter(e => e.getFlag(MOD, 'emanation') || (e.getFlag(MOD, 'mastery') === 'rider' && /^Spirit Guardians/.test(e.name)) || ['incapacitated'].some(s => e.statuses?.has?.(s)));
      const live = fx.map(e => e.id).filter(id => a.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
    }
  };
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      if (/RollConfigurationDialog/.test(app.constructor?.name ?? '') || app.element?.querySelector?.('[data-bf-save-demand]') || (app.element?.innerHTML ?? '').includes('Damage — your roll')) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      for (const id of priorActiveCombats) { try { await game.combats.get(id)?.update({ active: true }); } catch { /* gone */ } }
      try { if (template && scene.regions.get(template.id)) await template.delete(); } catch { /* gone */ }
      try { const live = addedItems.filter(id => cleric.items.get(id)); if (live.length) await cleric.deleteEmbeddedDocuments('Item', live); } catch { /* gone */ }
      // End the cast's concentration so the next cast is not asked about it.
      try { if (cleric.concentration?.effects?.size) await cleric.endConcentration(); } catch { /* none */ }
      for (const r of scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'spell')) await r.delete().catch(() => {});
      for (const [id, pos] of Object.entries(home)) { const t = scene.tokens.get(id); if (t && ((t.x !== pos.x) || (t.y !== pos.y))) await t.update(pos, mv()); }
      await sleep(600);
      await clearMembers();
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow' || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
      // The range's rings come down with the scene going inactive (§11); the prior active scene returns.
      if (elsewhere && game.scenes.get(elsewhere.id)) await elsewhere.delete().catch(() => {});
      const back = priorActiveScene ? game.scenes.get(priorActiveScene) : null;
      if (back && (game.scenes.active?.id !== back.id)) { await back.activate().catch(() => {}); await sleep(1500); }
      await clearMembers();
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('emanations', true);
    await set('emanationList', 'Aura of Protection, Aura of Courage, Aura of Warding, Spirit Guardians');
    await set('saves', true); await set('saveTimer', 24); await set('playerRollDamage', false); await set('autoApply', true); await set('requireTarget', false);
    await clearMembers();
    // The Victim's token actor takes §7's damage; at 0 HP the dead-target gate skips it, so heal it.
    if (vicTok.actor && (vicTok.actor.system.attributes.hp.value < vicTok.actor.system.attributes.hp.max)) await vicTok.actor.update({ 'system.attributes.hp.value': vicTok.actor.system.attributes.hp.max });
    try { if (cleric.concentration?.effects?.size) await cleric.endConcentration(); } catch { /* none */ }
    for (const r of scene.regions.filter(r => r.getFlag('dnd5e', 'item') === sgItemUuid())) await r.delete().catch(() => {});
    // Everyone home: the Paladin and Cleric on the bottom row, the line at y=1000.
    for (const [id, pos] of Object.entries(home)) { const t = scene.tokens.get(id); if ((t.x !== pos.x) || (t.y !== pos.y)) await t.update(pos, mv()); }
    await sleep(800);
    const chaMod = paladin.system.abilities.cha.mod;
    log.push(`paladin cha mod ${chaMod}, aura scale ${JSON.stringify(paladin.getRollData().scale?.paladin?.aura ?? null)}, dispositions pal=${palTok.disposition} rgr=${rgrTok.disposition} vic=${vicTok.disposition} clr=${clrTok.disposition}`);

    // ================================================== 1. the type, the sweep, the region
    if (want(1)) {
      ok('1a. the Battle Flow behaviour type is registered on CONFIG (init)', !!CONFIG.RegionBehavior.dataModels[TYPE], Object.keys(CONFIG.RegionBehavior.dataModels).filter(k => k.startsWith(MOD)).join(','));
      // Start from nothing: delete any standing aura; the sweep the deletion schedules raises it
      // again (a feature's aura is always on) and posts the card §1g reads.
      for (const r of scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature')) { if (scene.regions.get(r.id)) await r.delete().catch(() => {}); }
      // All three: the sweep raises them one create at a time.
      const region = await waitFor(() => ['Aura of Protection', 'Aura of Courage', 'Aura of Warding'].every(k => featureRegion(palTok, k)) ? featureRegion(palTok, 'Aura of Protection') : null, 12000);
      ok('1b. a Region for Aura of Protection stands, attached to the Paladin\'s token', !!region && (region.attachment?.token?.id === palTok.id), `region=${region?.id} attached=${region?.attachment?.token?.id}`);
      const palShape = region?.shapes?.[0] ?? null;
      ok('1c. it is the platform\'s own EMANATION shape on the token\'s base — the class\'s 10 feet from the edge (@scale.paladin.aura — no number in the module), no dnd5e flags', !!palShape && (palShape.type === 'emanation') && (palShape.radius === 10 * px) && (palShape.base?.x === palTok.x) && (palShape.base?.y === palTok.y) && !region.getFlag('dnd5e', 'activity'), `region=${region?.id} shape=${JSON.stringify(palShape)}`);
      const beh = region?.behaviors?.find(b => b.type === TYPE);
      const change = beh?.system?.effect?.changes?.[0];
      ok('1d. the behaviour carries the pack\'s effect with the PALADIN\'s Charisma resolved in', !!beh && ['system.rolls.ability.save.bonus', 'system.bonuses.abilities.save'].includes(change?.key) && (String(change?.value) === String(chaMod)), `changes=${JSON.stringify(beh?.system?.effect?.changes)}`);
      await sleep(1500);   // let a second sweep, if one was queued, settle before counting
      const featureRegions = scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature' && r.getFlag(MOD, 'emanation')?.tokenId === palTok.id);
      ok('1e. all three auras stand (Protection, Courage, Warding) — EXACTLY one region each', (featureRegions.length === 3) && ['Aura of Protection', 'Aura of Courage', 'Aura of Warding'].every(k => featureRegions.filter(r => r.getFlag(MOD, 'emanation').key === k).length === 1), featureRegions.map(r => r.name).join(' | '));
      ok('1f. the region is drawn nowhere — locked with LAYER_UNLOCKED visibility, hidden even on the Regions layer (user rulings 2026-09-18/19), its own shape', (region?.visibility === CONST.REGION_VISIBILITY.LAYER_UNLOCKED) && (region?.locked === true) && (region?.highlightMode === 'shapes'), `visibility=${region?.visibility} locked=${region?.locked} highlightMode=${region?.highlightMode}`);
      ok('1g. a card announced the aura (R5)', game.messages.some(m => (m.timestamp >= suiteStart - 60_000) && m.getFlag(MOD, 'emanationCard')?.key === 'Aura of Protection') || game.messages.some(m => m.getFlag(MOD, 'emanationCard')?.key === 'Aura of Protection'), '');
      ok('1h. the Paladin does not receive its own aura twice (the transfer effect already covers it)', memberFx(paladin).length === 0, `memberFx=${memberFx(paladin).map(e => e.name).join(',')}`);
    }

    // ================================================== 2. an ally walks in, and out
    const region = featureRegion(palTok, 'Aura of Protection');
    const inside = { x: palTok.x, y: palTok.y - 2 * grid };     // two squares above: one square gap, inside 10 ft
    if (want(2) && region) {
      const saveBonus = () => ranger.system.rolls?.ability?.save?.bonus ?? ranger.system.bonuses?.abilities?.save ?? '';   // 6.0 moved it under rolls.*
      const saveBefore = saveBonus();
      await rgrTok.update(inside, mv());
      const fx = await waitFor(() => memberFx(ranger, region.id)[0] ?? null, 6000);
      ok('2a. the Ranger receives "Protected — BF Test Paladin"', fx?.name === 'Protected — BF Test Paladin', `effects=${memberFx(ranger).map(e => e.name).join(',')}`);
      ok('2b. …with the PALADIN\'s Charisma (+3), not the Ranger\'s', String(fx?.changes?.[0]?.value) === String(chaMod), `value=${fx?.changes?.[0]?.value} paladinCha=${chaMod} rangerCha=${ranger.system.abilities.cha.mod}`);
      ok('2c. the Ranger\'s save bonus now carries it', String(saveBonus()).includes(String(chaMod)), `before="${saveBefore}" after="${saveBonus()}"`);
      // ⚠ The three floors are serialized (one create each): wait for all three, not the first.
      await waitFor(() => (memberFx(ranger).length === 3) ? true : null, 6000);
      ok('2d. Courage and Warding land too — three member effects, one per aura', memberFx(ranger).length === 3, memberFx(ranger).map(e => e.name).join(' | '));
      await rgrTok.update(home[rgrTok.id], mv());
      const gone = await waitFor(() => memberFx(ranger).length === 0 ? true : null, 6000);
      ok('2e. walking out lifts every member effect', !!gone, `left=${memberFx(ranger).map(e => e.name).join(',')}`);
    }

    // ================================================== 3. reach
    if (want(3) && region) {
      await vicTok.update({ x: palTok.x + 2 * grid, y: palTok.y }, mv());
      await sleep(1500);
      const vicActor = vicTok.actor;
      ok('3a. the hostile Victim inside a helpful aura receives nothing', memberFx(vicActor).length === 0 && (region.tokens?.has?.(vicTok) ?? true), `inside=${region.tokens?.has?.(vicTok)} effects=${memberFx(vicActor).map(e => e.name).join(',')} disposition=${vicTok.disposition}`);
      await vicTok.update(home[vicTok.id], mv());
      await sleep(500);
    }

    // ================================================== 4. the area moves
    if (want(4) && region) {
      const standing = { x: 1300, y: 1400 };
      await rgrTok.update(standing, mv());
      await sleep(600);
      ok('4a. the Ranger standing apart carries nothing', memberFx(ranger).length === 0, '');
      await palTok.update({ x: standing.x - 2 * grid, y: standing.y }, mv());
      const fx = await waitFor(() => memberFx(ranger, region.id)[0] ?? null, 6000);
      ok('4b. the Paladin walking up to the Ranger applies the aura (the area entered the Ranger\'s space)', !!fx, `effects=${memberFx(ranger).map(e => e.name).join(',')}`);
      await palTok.update(home[palTok.id], mv());
      const gone = await waitFor(() => memberFx(ranger).length === 0 ? true : null, 6000);
      ok('4c. the Paladin walking away lifts it', !!gone, `left=${memberFx(ranger).map(e => e.name).join(',')}`);
      await rgrTok.update(home[rgrTok.id], mv());
      await sleep(400);
      // 4d. a ring whose base came off its token is only SHIFTED by the platform on a move; the sweep
      // puts it back under the bearer.
      const live4 = scene.regions.get(region.id);
      const s4 = live4?.shapes?.[0]?.toObject?.() ?? foundry.utils.deepClone(live4?.shapes?.[0]);
      if (s4) {
        await live4.update({ shapes: [{ ...s4, base: { ...s4.base, x: s4.base.x - grid, y: s4.base.y - grid } }] });
        await palTok.update({ x: palTok._source.x + grid, y: palTok._source.y }, mv());
        const healed = await waitFor(() => {
          const b = scene.regions.get(region.id)?.shapes?.[0]?.base;
          return (b && (b.x === palTok._source.x) && (b.y === palTok._source.y)) ? b : null;
        }, 8000);
        ok('4d. a ring knocked off its token is back under it after the next move — the sweep re-bases it', !!healed,
          `base=${JSON.stringify(scene.regions.get(region.id)?.shapes?.[0]?.base ?? null)} token=${palTok._source.x},${palTok._source.y}`);
        await palTok.update(home[palTok.id], mv());
        await sleep(600);
      }
    }

    // ================================================== 5. Incapacitated
    if (want(5) && region) {
      await rgrTok.update(inside, mv());
      await waitFor(() => memberFx(ranger).length === 3 ? true : null, 6000);
      await paladin.toggleStatusEffect('incapacitated', { active: true });
      const lifted = await waitFor(() => memberFx(ranger).length === 0 ? true : null, 8000);
      const beh = scene.regions.get(region.id)?.behaviors?.find(b => b.type === TYPE);
      ok('5a. Incapacitated on the Paladin disables the aura\'s behaviour and lifts it from the Ranger', !!lifted && !!beh?.disabled, `disabled=${beh?.disabled} left=${memberFx(ranger).map(e => e.name).join(',')}`);
      await paladin.toggleStatusEffect('incapacitated', { active: false });
      const back = await waitFor(() => memberFx(ranger).length === 3 ? true : null, 8000);
      ok('5b. recovering re-enables it and the Ranger has the aura again', !!back, `effects=${memberFx(ranger).map(e => e.name).join(',')}`);
      await rgrTok.update(home[rgrTok.id], mv());
      await sleep(500);
    }

    // ================================================== 6. Spirit Guardians adopted
    let sgRegion = null;
    const sgItem = cleric.items.find(i => i.name === 'Spirit Guardians');
    const sgAct = [...(sgItem?.system?.activities ?? [])].find(a => a.type === 'save');
    const clrPost = { x: 1300, y: 600 };
    const vicIn = { x: 1300, y: 850 };          // 10 ft below the Cleric's base — inside 15 ft
    const vicOut = { x: 1700, y: 1400 };
    if (want(6)) {
      await clrTok.update(clrPost, mv());
      await vicTok.update(vicIn, mv());
      await rgrTok.update({ x: 1300, y: 300 }, mv());   // 15 ft above: inside too, but an ALLY
      await sleep(500);
      const b6 = game.messages.size;
      // A real cast, no placement config: the module switches the prompt off and places the area on the caster.
      try {
        await Promise.race([sgAct.use({ consume: { spellSlot: false, resources: false } }, { configure: false }, { create: true }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('use() did not settle — the placement prompt was not switched off')), 8000))]);
      } catch (err) { log.push(`use(): ${err.message}`); }
      template = await waitFor(() => scene.regions.find(r => r.getFlag('dnd5e', 'activity') === sgAct.uuid) ?? null, 8000);
      const sgShape = template?.shapes?.[0] ?? null;
      ok('6-. the area placed itself on the Cleric — no click: the platform\'s emanation shape on the token\'s base, 15 ft from the edge, the placement\'s flags (activity, item, the token as origin, spell level)', !!sgShape && (sgShape.type === 'emanation') && (sgShape.base?.x === clrTok.x) && (sgShape.base?.y === clrTok.y) && (sgShape.radius === 15 * px) && (template.getFlag('dnd5e', 'item') === sgItemUuid()) && (template.getFlag('dnd5e', 'origin') === clrTok.uuid) && (template.getFlag('dnd5e', 'spellLevel') === 3), `region=${template?.id} shape=${JSON.stringify(sgShape)} flags=${JSON.stringify(template?.flags?.dnd5e)}`);
      ok('6-2. no platform behaviour rides the adopted ring (the §3.6 ruling) — only Battle Flow\'s', !!template && !template.behaviors.some(b => String(b.type).startsWith('dnd5e.')), `behaviours=${template?.behaviors.map(b => b.type).join(',')}`);
      const conc = [...(cleric.concentration?.effects ?? [])].at(-1);
      ok('6+. …and the Cleric is concentrating on it (the effect the area will end with)', !!conc && (conc.flags?.dnd5e?.activity?.uuid === sgAct.uuid), `conc=${conc?.name} activity=${conc?.flags?.dnd5e?.activity?.uuid}`);
      // Adoption writes the flag, the behaviour, then the attachment: wait for the last.
      sgRegion = await waitFor(() => { const r = spellRegion('Spirit Guardians'); return r?.attachment?.token ? r : null; }, 8000) ?? spellRegion('Spirit Guardians');
      ok('6a. the placed Region is adopted: flagged, attached to the Cleric\'s token', !!sgRegion && (sgRegion.attachment?.token?.id === clrTok.id), `region=${sgRegion?.id} attached=${sgRegion?.attachment?.token?.id} cardsSinceUse=${game.messages.size - b6}`);
      const beh = await waitFor(() => scene.regions.get(sgRegion?.id)?.behaviors?.find(b => b.type === TYPE) ?? null, 4000);
      ok('6b. its behaviour carries Half Speed and the harmful reach', (beh?.system?.reach === 'harmful') && (beh?.system?.effect?.name === 'Half Speed'), `system=${JSON.stringify(beh?.system)}`);
      const vicActor = vicTok.actor;
      const fx = await waitFor(() => memberFx(vicActor, sgRegion?.id)[0] ?? null, 6000);
      // Battle Flow owns the EFFECT: one per region per creature, the pack's change, a status. Whether
      // the platform then halves the sheet's speed depends on its prepare order, so speed is logged, not asserted.
      ok('6c. the hostile Victim inside is Half Speed — ONE effect carrying the pack\'s change, and it wears a status so the token shows it', !!fx && (memberFx(vicActor, sgRegion?.id).length === 1) && fx.changes.some(c => /movement/.test(c.key) && (String(c.value) === '0.5')) && vicActor.effects.get(fx.id)?.statuses?.has?.('bfEmanation'), `speed=${vicActor.system.attributes.movement.speed} walk=${vicActor.system.attributes.movement.walk} source=${vicActor.system._source.attributes.movement.speeds?.walk} fx=${memberFx(vicActor, sgRegion?.id).map(e => e.name).join(',')} statuses=${[...(vicActor.effects.get(fx?.id)?.statuses ?? [])].join(',')}`);
      await sleep(1500);
      ok('6c2. standing inside at the cast, the Victim was asked ONCE — by the cast\'s demand, not by an "enter" trigger', triggerCards().length === 0, `triggerCards=${triggerCards().length} initial=${JSON.stringify(sgRegion?.getFlag(MOD, 'emanation')?.initial)}`);
      const castFlag = game.messages.contents.filter(x => (x.timestamp >= suiteStart) && x.getFlag(MOD, 'saves') && !x.getFlag(MOD, 'saves').pinnedTargets && x.getFlag(MOD, 'saves').activityUuid === sgAct.uuid).at(-1)?.getFlag(MOD, 'saves');
      ok('6c3. the cast\'s demand promises no effect and applies none (Half Speed is the region\'s)', !!castFlag && (castFlag.effectsHandled === 'emanation') && !(castFlag.effectNames?.always?.length), `effectsHandled=${castFlag?.effectsHandled} always=[${castFlag?.effectNames?.always?.join(',')}]`);
      ok('6d. the allied Ranger inside is untouched (designated unaffected by default)', memberFx(ranger, sgRegion?.id).length === 0, memberFx(ranger).map(e => e.name).join(','));
      const sgCard = await waitFor(() => game.messages.find(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationCard')?.key === 'Spirit Guardians') ?? null, 6000);
      ok('6e. a card announced the emanation as cast', !!sgCard, '');
      // The cast's own save demand reaches enemies only: allies and the caster inside owe none.
      const castCard = await waitFor(() => { const m = game.messages.contents.filter(x => (x.timestamp >= suiteStart) && x.getFlag(MOD, 'saves') && !x.getFlag(MOD, 'saves').pinnedTargets && x.getFlag(MOD, 'saves').activityUuid === sgAct.uuid).at(-1); return m?.getFlag(MOD, 'saves')?.targets?.length ? m : null; }, 8000);
      const castTargets = castCard?.getFlag(MOD, 'saves')?.targets?.map(t => t.name) ?? [];
      ok('6f. the cast\'s demand asks the hostile Victim and NOT the allied Ranger or the Cleric standing inside', castTargets.includes(vicTok.name) && !castTargets.includes('BF Test Ranger') && !castTargets.includes('BF Test Cleric'), `targets=[${castTargets.join(', ')}]`);
    }

    // ================================================== 7. the triggers
    if (want(7) && sgRegion) {
      const vicActor = vicTok.actor;
      const n0 = triggerCards().length;
      await vicTok.update(vicOut, mv());
      await waitFor(() => memberFx(vicActor, sgRegion.id).length === 0 ? true : null, 6000);
      ok('7a. walking out lifts Half Speed', memberFx(vicActor, sgRegion.id).length === 0, '');
      await vicTok.update(vicIn, mv());
      const card = await waitFor(() => triggerCards().find(m => m.getFlag(MOD, 'emanationTrigger')?.cause === 'enter' && m.getFlag(MOD, 'emanationTrigger')?.targetUuid === vicActor.uuid) ?? null, 8000);
      const flag = card?.getFlag(MOD, 'saves');
      ok('7b. entering raises a save demand card for the Victim alone — Wisdom, the spell\'s DC, half on a success', !!card && (flag?.abilities?.[0] === 'wis') && (flag?.dc === sgAct.save.dc.value) && (flag?.targets?.length === 1) && (flag.targets[0].uuid === vicActor.uuid) && (flag?.damageOnSave === 'half'), `flag=${JSON.stringify(flag && { abilities: flag.abilities, dc: flag.dc, targets: flag.targets.map(t => t.name), effectsHandled: flag.effectsHandled, scaling: flag.scaling })}`);
      const dmg = await waitFor(() => game.messages.find(m => (m.timestamp >= suiteStart) && (m._source.system?.origin === card?.id) && (m.type === 'damage')) ?? null, 8000);
      ok('7c. the spell\'s damage rolled against the demand (3d8 at 3rd level — the card\'s own chain)', !!dmg && /3d8/.test(dmg.rolls?.[0]?.formula ?? ''), `formula=${dmg?.rolls?.[0]?.formula}`);
      // The pack's part offers necrotic OR radiant; alignment decides the default (none → radiant).
      const emCard = game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationCard')?.activityUuid === sgAct.uuid).at(-1);
      const emFlag = emCard?.getFlag(MOD, 'emanationCard');
      ok('7c2. the emanation card offers the two types with radiant as the alignment\'s default', !!emFlag && (emFlag.types?.join(',') === 'necrotic,radiant') && (emFlag.damageType === 'radiant') && !emFlag.chosen, `types=${emFlag?.types} default=${emFlag?.damageType} why="${emFlag?.damageWhy}" alignment="${cleric.system.details?.alignment}"`);
      const cardEl = await waitFor(() => document.querySelector(`[data-message-id="${emCard?.id}"]`) ?? null, 4000);
      ok('7c2b. …and the card RENDERS the two buttons in the log', (cardEl?.querySelectorAll('[data-bf-emanation-type]').length ?? 0) === 2, `buttons=${cardEl?.querySelectorAll('[data-bf-emanation-type]').length ?? 'no element'}`);
      // The casting window carries the choice: open the usage dialog unawaited, read, close.
      const pendingUse = sgAct.use({}, { configure: true }, { create: false });
      pendingUse?.catch?.(() => { /* closed below */ });
      const usageApp = await waitFor(() => [...foundry.applications.instances.values()].find(a => /ActivityUsageDialog|UsageDialog/.test(a.constructor?.name ?? '') && a.element?.querySelector?.('[data-bf-emanation-type-field]')) ?? null, 6000);
      const radios = usageApp?.element?.querySelectorAll('input[name="bf-emanation-type"]') ?? [];
      ok('7c2c. the CASTING WINDOW carries the choice — a Battle Flow fieldset with a radio per type, radiant checked', (radios.length === 2) && [...radios].some(r => r.value === 'radiant' && r.checked), `dialog=${usageApp?.constructor?.name} radios=${[...radios].map(r => `${r.value}${r.checked ? '✓' : ''}`).join(',')}`);
      try { await usageApp?.close(); } catch { /* gone */ }
      ok('7c3. the trigger\'s roll wears radiant', (dmg?.rolls?.[0]?.options?.type === 'radiant') && (dmg?.getFlag(MOD, 'emanationType')?.type === 'radiant'), `type=${dmg?.rolls?.[0]?.options?.type} flag=${JSON.stringify(dmg?.getFlag(MOD, 'emanationType'))}`);
      // The caster picks necrotic over the relay envelope; the next roll wears it.
      if (emCard) {
        await ChatMessage.create({ whisper: [game.user.id], speaker: { alias: 'Battle Flow' }, content: '<p>necrotic</p>', flags: { [MOD]: { emanationTypeAnswer: { cardId: emCard.id, type: 'necrotic' } } } });
        const picked = await waitFor(() => emCard.getFlag(MOD, 'emanationCard')?.chosen ? emCard.getFlag(MOD, 'emanationCard') : null, 6000);
        ok('7c4. the pick folds onto the card over the relay: necrotic, chosen', picked?.damageType === 'necrotic', `flag=${JSON.stringify(picked && { damageType: picked.damageType, chosen: picked.chosen })}`);
      }
      ok('7d. out of combat, the demand is not once-per-turn — no chit is written', !vicActor.effects.some(e => e.getFlag(MOD, 'riderKey') === `emanation:${sgRegion.id}`), '');
      // In combat: a turn ended inside, and once per turn.
      await closeDialogs();
      // ⚠ Ours must be `game.combat`: Foundry prefers a standing active combat and `activate()` does
      // not displace it. Other active combats go INACTIVE for the run and return in teardown.
      for (const c of game.combats.filter(c => c.active)) { priorActiveCombats.push(c.id); await c.update({ active: false }); }
      // Scene-bound: a Combat dispatches turn events to its own scene's regions (a scene-less one raises none).
      combat = await Combat.create({ scene: scene.id, active: true });
      await combat.createEmbeddedDocuments('Combatant', [{ tokenId: clrTok.id, actorId: cleric.id, initiative: 20 }, { tokenId: vicTok.id, actorId: victim.id, initiative: 10 }]);
      await combat.startCombat();
      // `game.combat` is `ui.combat.viewed` while the tracker renders: point the tracker at ours.
      if (game.combat?.id !== combat.id) { try { ui.combat.viewed = combat; } catch (err) { log.push(`tracker: ${err.message}`); } }
      const viewedOk = await waitFor(() => game.combat?.id === combat.id ? true : null, 4000);
      if (!viewedOk) log.push(`⚠ game.combat is still ${game.combat?.id}, not ours (${combat.id})`);
      await sleep(400);
      log.push(`combat ${combat.id} active=${game.combat?.id === combat.id}; others on the range: ${game.combats.filter(c => c.id !== combat.id && c.scene?.id === scene.id).map(c => `${c.id} r${c.round}`).join(', ') || 'none'}`);
      // Once per turn (the Cleric's): the Victim walks in (a save, a chit), then out and in again (no second save).
      const n1 = triggerCards().length;
      await vicTok.update(vicOut, mv()); await sleep(600);
      await vicTok.update(vicIn, mv());
      const inCard = await waitFor(() => triggerCards().length > n1 ? triggerCards().at(-1) : null, 8000);
      const facts = { combat: game.combat?.id, started: game.combat?.started, round: game.combat?.round, turn: game.combat?.turn, vicCombatants: game.combat?.getCombatantsByActor?.(vicActor)?.length, isToken: vicActor.isToken, trigger: inCard?.getFlag(MOD, 'emanationTrigger') };
      ok('7f. in combat, entering raises the save and writes the once-per-turn chit on the Victim', !!inCard && vicActor.effects.some(e => e.getFlag(MOD, 'riderKey') === `emanation:${sgRegion.id}`), `cards=${triggerCards().length} chits=${vicActor.effects.filter(e => e.getFlag(MOD, 'mastery')).map(e => e.name).join(',')} facts=${JSON.stringify(facts)}`);
      const n2 = triggerCards().length;
      await closeDialogs();
      await vicTok.update(vicOut, mv()); await sleep(600);
      await vicTok.update(vicIn, mv()); await sleep(1500);
      ok('7g. a second entry in the SAME turn asks for no second save', triggerCards().length === n2, `cards=${triggerCards().length} (was ${n2}, before combat ${n0})`);
      await closeDialogs();
      // The Victim's turn begins and ENDS inside → tokenTurnEnd → a demand (a new turn, so no chit blocks it).
      await combat.nextTurn();     // → the Victim's turn
      await sleep(800);
      await combat.nextTurn();     // the Victim's turn ENDS inside
      const endCard = await waitFor(() => triggerCards().find(m => m.getFlag(MOD, 'emanationTrigger')?.cause === 'turnEnd') ?? null, 8000);
      ok('7e. ending its turn inside raises a save demand (tokenTurnEnd on the GM)', !!endCard, `cards=${triggerCards().length} (was ${n2})`);
      const endDmg = await waitFor(() => game.messages.find(m => (m.timestamp >= suiteStart) && (m._source.system?.origin === endCard?.id) && (m.type === 'damage')) ?? null, 8000);
      ok('7e2. …and its damage wears the chosen type, necrotic', endDmg?.rolls?.[0]?.options?.type === 'necrotic', `type=${endDmg?.rolls?.[0]?.options?.type} chosen=${endDmg?.getFlag(MOD, 'emanationType')?.chosen}`);
      await closeDialogs();
    }

    // ================================================== 8. the template goes
    if (want(8) && sgRegion) {
      const vicActor = vicTok.actor;
      const rid = sgRegion.id;
      const tid = template?.id ?? null;
      // Concentration drops; no placed region is a dependent, so the module ends the area
      // (endCastEmanations), and the region's going lifts the effect.
      await cleric.endConcentration();
      const gone = await waitFor(() => (!(tid && scene.regions.get(tid)) && !scene.regions.get(rid) && memberFx(vicActor, rid).length === 0) ? true : null, 10000);
      if (!(tid && scene.regions.get(tid))) template = null;
      ok('8a. ending concentration ends the area (the module\'s own hook — no dependent at 6.0), and lifts Half Speed from the Victim', !!gone, `area=${!!(tid && scene.regions.get(tid))} region=${!!scene.regions.get(rid)} fx=${memberFx(vicActor, rid).map(e => e.name).join(',')} walk=${vicActor.system.attributes.movement.walk}`);
    }

    // ================================================== 16. a no-save concentration area ends with the concentration
    if (want(16)) {
      // Fog Cloud's shape: a no-save concentration area has no card of this module's, so
      // endConcentrationAreas ends it. Faked at the documents: a concentration effect carrying the
      // activity uuid and a region stamped the same; a re-cast is a NEWER effect and region.
      const fogAct = `Actor.${cleric.id}.Item.bfFogCloud000000.Activity.bfFogCloudAct000`;
      const mkRegion = async name => (await scene.createEmbeddedDocuments('Region', [{ name, shapes: [{ type: 'circle', x: 300, y: 300, radius: 100 }], flags: { dnd5e: { activity: fogAct } } }]))[0];
      const mkConc = async () => (await cleric.createEmbeddedDocuments('ActiveEffect', [{ name: 'Concentrating: BF Fog', statuses: ['concentrating'], flags: { dnd5e: { activity: { uuid: fogAct } } } }]))[0];
      // The casting client writes `areas` on its concentration effect; the fake writes it by hand.
      const e1 = await mkConc(); const r1 = await mkRegion('BF Fog area 1'); await e1.setFlag(MOD, 'areas', [r1.uuid]);
      const e2 = await mkConc(); const r2 = await mkRegion('BF Fog area 2'); await e2.setFlag(MOD, 'areas', [r2.uuid]);
      let e3 = null, e4 = null, r3 = null;
      try {
        await e1.delete();
        const oldGone = await waitFor(() => !scene.regions.get(r1.id) ? true : null, 8000);
        await sleep(600);
        ok('16a. the OLD concentration ending takes ITS area down and leaves the re-cast\'s standing (the tie: each effect names the areas its cast placed)', !!oldGone && !!scene.regions.get(r2.id), `r1=${!!scene.regions.get(r1.id)} r2=${!!scene.regions.get(r2.id)}`);
        await e2.delete();
        const allGone = await waitFor(() => !scene.regions.get(r2.id) ? true : null, 8000);
        ok('16b. the LAST concentration ending takes the last area down — no demand card, no dependent, the module\'s sweep alone', !!allGone, `r2=${!!scene.regions.get(r2.id)}`);
        // 16c. an UNTIED area is spared while another concentration of the spell stands, and swept
        // when the last one goes.
        e3 = await mkConc(); r3 = await mkRegion('BF Fog area 3 (untied)'); e4 = await mkConc();
        await e3.delete(); await sleep(800);
        const sparedC = !!scene.regions.get(r3.id);
        await e4.delete();
        const sweptC = await waitFor(() => !scene.regions.get(r3.id) ? true : null, 8000);
        ok('16c. an untied area is spared while another concentration of the spell stands, and swept when the last one goes', sparedC && !!sweptC, `spared=${sparedC} swept=${!!sweptC}`);
      } finally {
        for (const r of [r1, r2, r3]) if (r && scene.regions.get(r.id)) await r.delete().catch(() => {});
        for (const e of [e1, e2, e3, e4]) if (e && cleric.effects.get(e.id)) await e.delete().catch(() => {});
      }
    }

    // ================================================== 11. live scenes only
    if (want(11)) {
      const ringsUp = () => ['Aura of Protection', 'Aura of Courage', 'Aura of Warding'].every(k => featureRegion(palTok, k));
      const ringsDown = () => !scene.regions.some(r => r.getFlag(MOD, 'emanation')?.kind === 'feature');
      await rgrTok.update(inside, mv());
      const three = await waitFor(() => memberFx(ranger).length === 3 ? true : null, 8000);
      ok('11a. the Ranger inside the ring wears the three auras on the ACTIVE range', !!three, memberFx(ranger).map(e => e.name).join(' | '));
      elsewhere = await Scene.create({ name: 'BF Test Elsewhere', width: 2000, height: 2000, grid: { size: 100, distance: 5 } });
      // The linked Ranger stands on that scene too: no ring is raised there (no Paladin token), and
      // the range's ring must not reach the Ranger through the actor.
      await elsewhere.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(ranger.prototypeToken.toObject(), { x: 500, y: 500, actorId: ranger.id }, { inplace: false })]);
      await elsewhere.activate();
      const lifted = await waitFor(() => (memberFx(ranger).length === 0) ? true : null, 10000);
      ok('11b. another scene made active (every client views it): the Ranger\'s three effects are LIFTED, though its range token still stands inside the ring', !!lifted, `left=${memberFx(ranger).map(e => e.name).join(',')} active=${game.scenes.active?.name} viewing=${game.users.filter(u => u.active).map(u => `${u.name}@${game.scenes.get(u.viewedScene)?.name}`).join(',')}`);
      const down = await waitFor(() => ringsDown() ? true : null, 10000);
      ok('11c. the range\'s rings come down: nobody is on the range — neither active nor viewed', !!down, scene.regions.filter(r => r.getFlag(MOD, 'emanation')).map(r => r.name).join(' | '));
      ok('11d. no ring was raised on the other scene (no Paladin there)', !elsewhere.regions.some(r => r.getFlag(MOD, 'emanation')), '');
      // A ring left on an INACTIVE scene: the ready sweep brings it down (raised here by hand, the
      // Ranger's token inside). ⚠ The effect goes down first, wearing the region id the create will
      // carry: a sweep landing between region and effect would remove the region and orphan the effect.
      const staleId = foundry.utils.randomID();
      await ranger.createEmbeddedDocuments('ActiveEffect', [{ name: 'Protected — BF Test Paladin (stale)', flags: { [MOD]: { emanation: { regionId: staleId } } } }]);
      const stale = await scene.createEmbeddedDocuments('Region', [{ _id: staleId, name: 'stale ring', shapes: [{ type: 'circle', x: palTok.x + grid / 2, y: palTok.y + grid / 2, radius: 12.5 * px }], flags: { [MOD]: { emanation: { kind: 'feature', key: 'Aura of Protection', tokenId: palTok.id, itemUuid: paladin.items.find(i => i.name === 'Aura of Protection')?.uuid } } } }], { keepId: true });
      await sleep(800);
      Hooks.call(`${MOD}.emanationsChanged`);   // the same everywhere-sweep ready runs
      const swept = await waitFor(() => (!scene.regions.get(stale[0].id) && memberFx(ranger, stale[0].id).length === 0) ? true : null, 10000);
      ok('11e. a stale ring on a scene nobody is on is brought down by the everywhere-sweep, and the effect it wrote is lifted from the actor', !!swept, `region=${!!scene.regions.get(stale[0].id)} fx=${memberFx(ranger, stale[0].id).length}`);
      // The range VIEWED, not active: with no player connected, a GM's view counts. ⚠ A player client
      // left connected to the sandbox fails this step, rightly (the player case is smoke-twoclient `pull`).
      const navBefore = count('renderSceneNavigation');
      await scene.view();
      const viewed = await waitFor(() => (ringsUp() && memberFx(ranger).length === 3) ? true : null, 15000);
      ok('11g. the range VIEWED while another scene is active: the rings stand and the Ranger wears the three auras', !!viewed && (game.scenes.active?.id === elsewhere.id), `fx=${memberFx(ranger).length} rings=${scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature').length} active=${game.scenes.active?.name} viewing=${game.user.viewedScene === scene.id}`);
      ok('11h. renderSceneNavigation FIRED on the view (the live-set watch\'s signal — ARCHITECTURE §11: a registered hook is asserted fired)', count('renderSceneNavigation') > navBefore, `before=${navBefore} after=${count('renderSceneNavigation')}`);
      // Two live scenes, one copy: a linked bearer's aura is one aura on every scene
      // (decide/emanations.js emanationGroup): three copies, never six.
      const elsePal = (await elsewhere.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(paladin.prototypeToken.toObject(), { x: 700, y: 500, actorId: paladin.id }, { inplace: false })]))[0];
      const elseRgr = elsewhere.tokens.find(t => t.actorId === ranger.id);
      const elseRings = () => elsewhere.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature');
      const both = await waitFor(() => (elseRings().length === 3) && ringsUp() ? true : null, 15000);
      await sleep(1500);   // load-bearing: a second floor, if one were going to write a second copy, lands before counting
      ok('11i. two live scenes, the Ranger inside the Paladin\'s ring on BOTH: three rings on each, and EXACTLY three effects — one per aura, no stack', !!both && (memberFx(ranger).length === 3) && ['Aura of Protection', 'Aura of Courage', 'Aura of Warding'].every(k => memberFx(ranger).filter(e => e.getFlag(MOD, 'emanation')?.key === k).length === 1), `fx=${memberFx(ranger).map(e => e.name).join(' | ')} elseRings=${elseRings().length} rangeRings=${scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature').length} elseRanger=${!!elseRgr} elsePal=${!!elsePal}`);
      await rgrTok.update(home[rgrTok.id], mv());
      await sleep(1500);   // load-bearing: the lift, if it were going to take the copy the other scene still grants, lands first
      ok('11j. the Ranger steps out on the range: still three — it stands inside the ring on the other live scene', memberFx(ranger).length === 3, `fx=${memberFx(ranger).length}`);
      await elseRgr.update({ x: 1500, y: 1500 }, mv());
      const outBoth = await waitFor(() => (memberFx(ranger).length === 0) ? true : null, 8000);
      ok('11k. out on both scenes: all three lifted', !!outBoth, `fx=${memberFx(ranger).map(e => e.name).join(',')}`);
      await rgrTok.update(inside, mv());
      await scene.activate();
      const back = await waitFor(() => (ringsUp() && memberFx(ranger).length === 3) ? true : null, 15000);
      await sleep(1500);   // a second sweep, if queued, settles before counting
      ok('11f. the range active again: the rings stand and the Ranger wears the three auras — exactly three, no stack', !!back && (memberFx(ranger).length === 3) && (scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature').length === 3), `fx=${memberFx(ranger).length} rings=${scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature').length}`);
      const elseDown = await waitFor(() => (elseRings().length === 0) ? true : null, 10000);
      ok('11l. the other scene, no longer active and viewed by nobody: its rings come down', !!elseDown, elseRings().map(r => r.name).join(' | '));
      await rgrTok.update(home[rgrTok.id], mv());
      await waitFor(() => memberFx(ranger).length === 0 ? true : null, 6000);
      if (game.scenes.get(elsewhere.id)) await elsewhere.delete().catch(() => {});
      elsewhere = null;
    }

    // ================================================== 10. FIRED
    if (want(10)) {
      ok('10a. createRegion fired (the adoption seam)', count('createRegion') > 0, `count=${count('createRegion')}`);
      ok('10b. updateToken fired (the floor)', count('updateToken') > 0, `count=${count('updateToken')}`);
      ok('10c. deleteRegion fired (the lift)', count('deleteRegion') > 0, `count=${count('deleteRegion')}`);
    }

    // ================================================== 12. Aura of Life
    // The Cleric is given the four spells for the run; each cast's concentration ends before the next.
    const SECOND = ['Aura of Life', "Crusader's Mantle", 'Aura of Vitality', 'Antilife Shell'];
    const giveSpell = async name => {
      if (cleric.items.some(i => (i.type === 'spell') && (i.name === name))) return cleric.items.find(i => (i.type === 'spell') && (i.name === name));
      for (const id of ['dnd-players-handbook.spells', 'dnd5e.spells24']) {
        const pack = game.packs.get(id);
        if (!pack) continue;
        const index = await pack.getIndex();
        const hit = index.find(e => e.name === name);
        if (!hit) continue;
        const data = (await pack.getDocument(hit._id)).toObject();
        delete data._id;
        data.system.preparation = { mode: 'always', prepared: true };
        const [doc] = await cleric.createEmbeddedDocuments('Item', [data]);
        addedItems.push(doc.id);
        return doc;
      }
      return null;
    };
    const castSecond = async name => {
      const item = await giveSpell(name);
      if (!item) throw new Error(`${name} not in the packs`);
      const act = [...item.system.activities].find(a => a.target?.template?.type === 'radius') ?? item.system.activities.contents[0];
      try { if (cleric.concentration?.effects?.size) await cleric.endConcentration(); } catch { /* none */ }
      await sleep(800);
      try {
        await Promise.race([act.use({ consume: { spellSlot: false, resources: false }, subsequentActions: false }, { configure: false }, { create: true }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('use() did not settle')), 8000))]);
      } catch (err) { log.push(`use(${name}): ${err.message}`); }
      const tpl = await waitFor(() => scene.regions.find(r => r.getFlag('dnd5e', 'activity') === act.uuid) ?? null, 8000);
      const region = await waitFor(() => { const r = spellRegion(name); return r?.attachment?.token ? r : null; }, 8000) ?? spellRegion(name);
      return { item, act, tpl, region };
    };
    const secondList = `${prior.emanationList || 'Aura of Protection, Aura of Courage, Aura of Warding, Spirit Guardians'}, ${SECOND.join(', ')}`;
    const ownCombat = async entries => {
      // §7's combat goes first, or overwriting the binding leaks it past teardown.
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      combat = null;
      for (const c of game.combats.filter(c => c.active)) { if (!priorActiveCombats.includes(c.id)) priorActiveCombats.push(c.id); await c.update({ active: false }); }
      combat = await Combat.create({ scene: scene.id, active: true });
      await combat.createEmbeddedDocuments('Combatant', entries.map(([tokDoc, actor, initiative]) => ({ tokenId: tokDoc.id, actorId: actor.id, initiative })));
      await combat.startCombat();
      if (ui.combat) ui.combat.viewed = combat;
      await sleep(600);
    };
    if (want(12)) {
      await set('emanationList', secondList);
      await clrTok.update(clrPost, mv());
      await rgrTok.update({ x: 1300, y: 300 }, mv());     // 15 ft above the Cleric — inside 30 ft
      await vicTok.update(vicIn, mv());                   // inside too, but HOSTILE
      await sleep(400);
      const { region, tpl } = await castSecond('Aura of Life');
      template = tpl ?? template;
      ok('12a. Aura of Life cast: the area placed itself on the Cleric (30 ft from the token\'s edge) and its region is adopted, attached', !!tpl && (tpl.shapes?.[0]?.type === 'emanation') && (tpl.shapes?.[0]?.radius === 30 * px) && !!region && (region.attachment?.token?.id === clrTok.id), `shape=${JSON.stringify(tpl?.shapes?.[0])} region=${region?.id} attached=${region?.attachment?.token?.id}`);
      const fx = await waitFor(() => memberFx(ranger, region?.id)[0] ?? null, 6000);
      ok('12b. the allied Ranger inside wears "Aura of Life — BF Test Cleric": the pack\'s own effect — Resistance to necrotic', !!fx && /^Aura of Life — BF Test Cleric/.test(fx.name) && fx.changes.some(c => (c.key === 'system.traits.dr.value') && (c.value === 'necrotic')), `fx=${fx?.name} changes=${JSON.stringify(fx?.changes)}`);
      await sleep(800);
      ok('12c. the hostile Victim inside receives nothing (a helpful aura)', memberFx(vicTok.actor, region?.id).length === 0, memberFx(vicTok.actor).map(e => e.name).join(','));
      // A spell's emanation is "you and your allies": the caster wears it too, exactly once.
      const own = await waitFor(() => memberFx(cleric, region?.id)[0] ?? null, 6000);
      const lifeOnCleric = cleric.effects.filter(e => /^Aura of Life/.test(e.name));
      ok('12c2. the CASTER wears its own spell aura from the ring — "Aura of Life — BF Test Cleric", exactly one Aura of Life effect on the sheet (the cast slice does not double it)',
        !!own && /^Aura of Life — BF Test Cleric/.test(own.name) && (lifeOnCleric.length === 1), `own=${own?.name} all=${JSON.stringify(cleric.effects.map(e => e.name))}`);
      // The ally at 0 HP at the start of its turn regains the activity's own 1 HP.
      const rgrHP = ranger.system._source.attributes.hp.value;
      await ranger.update({ 'system.attributes.hp.value': 0 });
      await ownCombat([[clrTok, cleric, 20], [rgrTok, ranger, 10]]);
      const h0 = game.messages.size;
      await combat.nextTurn();   // the Ranger's turn starts inside the aura
      const healCard = await waitFor(() => game.messages.find(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationHeal')?.targetUuid === ranger.uuid) ?? null, 8000);
      const receipt = await waitFor(() => healCard?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === ranger.uuid) ?? null, 6000);
      ok('12d. the Ranger at 0 HP starting its turn inside regains 1 HP — the activity\'s own healing, a card and a receipt, never a number typed', !!healCard && (healCard.getFlag(MOD, 'emanationHeal')?.total === 1) && !!receipt && (ranger.system.attributes.hp.value === 1), `card=${!!healCard} total=${healCard?.getFlag(MOD, 'emanationHeal')?.total} hp=${ranger.system.attributes.hp.value} receipt=${JSON.stringify(receipt && { taken: receipt.taken, note: receipt.note })} msgs=${game.messages.size - h0}`);
      await combat.nextTurn(); await sleep(400);   // round 2, the Cleric
      await combat.nextTurn();                       // the Ranger again — at 1 HP now: no heal
      await sleep(1500);
      ok('12e. at 1 HP the next turn start pays nothing — the clause is 0 Hit Points', game.messages.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationHeal')?.targetUuid === ranger.uuid).length === 1, '');
      await combat.delete(); combat = null;
      await ranger.update({ 'system.attributes.hp.value': rgrHP });
    }

    // ================================================== 13. Crusader's Mantle
    if (want(13)) {
      await set('emanationList', secondList);
      await clrTok.update(clrPost, mv());
      await rgrTok.update({ x: 1300, y: 300 }, mv());
      const { region } = await castSecond("Crusader's Mantle");
      const fx = await waitFor(() => memberFx(ranger, region?.id)[0] ?? null, 6000);
      ok('13a. Crusader\'s Mantle cast: the Ranger inside wears the pack\'s effect — +1d4[radiant] to weapon damage, the platform\'s own change', !!fx && fx.changes.some(c => ['system.rolls.damage.mwak.bonus', 'system.bonuses.mwak.damage'].includes(c.key) && /1d4/.test(String(c.value))), `fx=${fx?.name} changes=${JSON.stringify(fx?.changes)}`);
      await rgrTok.update(home[rgrTok.id], mv());
      const lifted = await waitFor(() => memberFx(ranger, region?.id).length === 0 ? true : null, 6000);
      ok('13b. walking out lifts it', !!lifted, '');
    }

    // ================================================== 14. Aura of Vitality — a notice, never played
    if (want(14)) {
      await set('emanationList', secondList);
      await clrTok.update(clrPost, mv());
      await rgrTok.update({ x: 1300, y: 300 }, mv());
      const { region, act } = await castSecond('Aura of Vitality');
      await sleep(1200);
      ok('14a. Aura of Vitality cast: the ring stands, and NOTHING is applied to the Ranger inside — the heal is aimed, a choice', !!region && (memberFx(ranger, region?.id).length === 0), `region=${region?.id} fx=${memberFx(ranger).map(e => e.name).join(',')}`);
      const card = game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationCard')?.key === 'Aura of Vitality').at(-1);
      ok('14b. the emanation card says it is a notice at the start of your turn', /start of your turn/.test(card?.content ?? ''), (card?.content ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 200));
      await ownCombat([[clrTok, cleric, 20], [rgrTok, ranger, 10]]);
      await combat.nextTurn(); await sleep(300);   // the Ranger
      await combat.nextTurn();                       // round 2 — the Cleric's turn starts
      const notice = await waitFor(() => game.messages.find(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationRemind')?.key === 'Aura of Vitality') ?? null, 8000);
      const rf = notice?.getFlag(MOD, 'emanationRemind');
      ok('14c. at the CASTER\'s turn start a notice card names Start of Turn Heal as theirs to use, with the creatures inside', !!rf && (rf.activityName === 'Start of Turn Heal') && (rf.activityUuid === [...act.item.system.activities].find(a => a.name === 'Start of Turn Heal')?.uuid) && /BF Test Ranger/.test(notice.content), `flag=${JSON.stringify(rf)}`);
      const el = await waitFor(() => document.querySelector(`.message[data-message-id="${notice?.id}"] button`) ?? null, 4000);
      ok('14d. …and the card carries the button for the caster (a GM answers for the fixture)', !!el && /Start of Turn Heal/.test(el.textContent ?? ''), el?.textContent ?? 'no button');
      await combat.delete(); combat = null;
    }

    // ================================================== 15. Antilife Shell — a ring and nothing else
    if (want(15)) {
      await set('emanationList', secondList);
      await clrTok.update(clrPost, mv());
      await vicTok.update({ x: 1300, y: 700 }, mv());   // 5 ft below — inside the 10-ft barrier
      const { region, tpl } = await castSecond('Antilife Shell');
      await sleep(1200);
      const card = game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationCard')?.key === 'Antilife Shell').at(-1);
      ok('15a. Antilife Shell cast: the ring stands (10 ft from the token\'s edge), the region is adopted harmful, nothing is applied to the hostile inside, and the card says it is a barrier', !!tpl && (tpl.shapes?.[0]?.radius === 10 * px) && !!region && (memberFx(vicTok.actor, region?.id).length === 0) && /barrier/.test(card?.content ?? ''), `shape=${JSON.stringify(tpl?.shapes?.[0])} region=${!!region} fx=${memberFx(vicTok.actor).length} card=${!!card}`);
      try { if (cleric.concentration?.effects?.size) await cleric.endConcentration(); } catch { /* none */ }
      const gone = await waitFor(() => (!scene.regions.get(region?.id) && !(tpl && scene.regions.get(tpl.id))) ? true : null, 8000);
      ok('15b. ending concentration takes the ring down', !!gone, '');
      template = null;
    }
    await set('emanationList', prior.emanationList);
    if (addedItems.length) { const live = addedItems.filter(id => cleric.items.get(id)); if (live.length) await cleric.deleteEmbeddedDocuments('Item', live); addedItems.length = 0; }


    // ================================================== 17. Polearm Master's Reactive Strike
    // The Ranger is lent the feat and a Glaive: an invisible 10-foot ring with no card; a hostile
    // MOVING in raises Hew's reminder ("Reactive Strike"); the ring sliding over a standing Victim
    // does not; the Glaive unequipped, the ring goes.
    if (want(17)) {
      const phb = async (name, type) => {
        for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
          const hit = (await pack.getIndex({ fields: ['type'] })).find(e => (e.name === name) && (e.type === type));
          if (hit) return (await pack.getDocument(hit._id)).toObject();
        }
        return null;
      };
      const feat = await phb('Polearm Master', 'feat');
      const glaive = await phb('Glaive', 'weapon');
      if (!feat || !glaive) return { fatal: 'section 17: no Polearm Master or Glaive in the PHB packs', results, log, skips };
      glaive.system.equipped = true;
      const lent = await ranger.createEmbeddedDocuments('Item', [feat, glaive]);
      const lentIds = lent.map(i => i.id);
      const glaiveItem = lent.find(i => i.type === 'weapon');
      try {
        await set('emanationList', 'Aura of Protection, Aura of Courage, Aura of Warding, Spirit Guardians, Polearm Master');
        // Fixed empty squares (a move onto another token's square or off the map is refused silently).
        const spot = { x: 10 * grid, y: 5 * grid };
        const far = { x: spot.x + 6 * grid, y: spot.y };
        const near = { x: spot.x + 2 * grid, y: spot.y };     // one square between: inside 10 ft
        await rgrTok.update(spot, mv());
        await vicTok.update(far, mv());
        await sleep(600);
        const t0 = Date.now();
        const ring = await waitFor(() => featureRegion(rgrTok, 'Polearm Master'), 10000);
        const shape = ring?.shapes?.[0] ?? null;
        ok('17a. holding the Glaive, an invisible ring of its REACH (10 ft) stands around the Ranger, and no card announces it',
          !!ring && (shape?.radius === 10 * px) && (ring.visibility === CONST.REGION_VISIBILITY.LAYER_UNLOCKED)
            && !game.messages.some(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'emanationCard')?.key === 'Polearm Master')),
          `ring=${ring?.id} radius=${shape?.radius} expected=${10 * px}`);
        const notices = t => game.messages.filter(m => (m.timestamp >= t) && (m.getFlag(MOD, 'hewNotice')?.label === 'Reactive Strike'));
        // The hostile MOVES in.
        const t1 = Date.now();
        await vicTok.update(near, mv());
        let card = await waitFor(() => notices(t1)[0] ?? null, 4000);
        let how = 'update (teleport)';
        if (!card) {
          // A teleport may carry no waypoints (tokenMoveIn wants a movement): walk it.
          await vicTok.update(far, mv());
          await sleep(600);
          await vicTok.move([{ x: near.x, y: near.y, action: 'displace' }]);
          card = await waitFor(() => notices(t1)[0] ?? null, 5000);
          how = 'move (displace)';
        }
        log.push(`§17: the entry was raised by ${card ? how : 'NEITHER move'}`);
        const n = card?.getFlag(MOD, 'hewNotice');
        ok('17b. the hostile moving into the reach raises Hew\'s reminder on the Ranger — "Reactive Strike", the one who entered named',
          !!card && (n?.attackerUuid === ranger.uuid) && (n?.targetName === vicTok.name) && /Reactive Strike/.test(card.content ?? ''),
          `card=${!!card} via=${how} notice=${JSON.stringify(n ?? null)}`);
        // The ring slides over a standing Victim.
        await vicTok.update(far, mv());
        await sleep(800);
        const t2 = Date.now();
        await rgrTok.update({ x: far.x - 2 * grid, y: far.y }, mv());
        await sleep(2500);   // load-bearing: time for a WRONG reminder
        ok('17c. the Ranger stepping up to a standing Victim is no entry — no reminder', !notices(t2).length, `notices=${notices(t2).length}`);
        await rgrTok.update(spot, mv());
        await sleep(600);
        // Passing through: one walked move that ends outside the reach. Foundry splits a move at the
        // edge of a move-in region (TokenDocument#splitMovementPath). Walls and tokens ignored.
        await vicTok.update({ x: spot.x - 6 * grid, y: spot.y - grid }, mv());
        await sleep(800);
        const t3 = Date.now();
        await vicTok.move([{ x: spot.x + 6 * grid, y: spot.y - grid, action: 'walk' }],
          { constrainOptions: { ignoreWalls: true, ignoreTokens: true } });
        const through = await waitFor(() => notices(t3)[0] ?? null, 8000);
        // The move goes on past the checkpoint: wait for it to END, then read where it stands.
        const arrived = await waitFor(() => vicTok.x === spot.x + 6 * grid, 10000);
        const endedOutside = !!arrived && !featureRegion(rgrTok, 'Polearm Master')?.tokens?.has?.(vicTok);
        ok('17e. a creature PASSING THROUGH the reach in one walked move raises the reminder too — the move is split at the edge',
          !!through && endedOutside, `notice=${!!through} endedOutside=${endedOutside} at=(${vicTok.x},${vicTok.y})`);
        await vicTok.update(home[vicTok.id], mv());
        await sleep(600);
        await glaiveItem.update({ 'system.equipped': false });
        const gone = await waitFor(() => !featureRegion(rgrTok, 'Polearm Master'), 8000);
        ok('17d. the Glaive put away: the ring goes', !!gone, `ring=${featureRegion(rgrTok, 'Polearm Master')?.id ?? 'gone'}`);
      } finally {
        const live = lentIds.filter(id => ranger.items.get(id));
        if (live.length) await ranger.deleteEmbeddedDocuments('Item', live).catch(() => {});
        await vicTok.update(home[vicTok.id], mv()).catch(() => {});
        await rgrTok.update(home[rgrTok.id], mv()).catch(() => {});
        await set('emanationList', 'Aura of Protection, Aura of Courage, Aura of Warding, Spirit Guardians');
        await sleep(800);
      }
    }
    // ================================================== 18. the AREA kind — Moonbeam
    const areaRegion = key => scene.regions.find(r => { const f = r.getFlag(MOD, 'emanation'); return f?.kind === 'area' && f.key === key; }) ?? null;
    /** A placed area as the system's placement writes it (a Region with the dnd5e flags), no click. */
    const placeArea = async (item, act, shape, spellLevel) => (await scene.createEmbeddedDocuments('Region', [{
      name: `${item.name} [${game.user.name}]`, color: game.user.color, shapes: [shape],
      flags: { dnd5e: { activity: act.uuid, item: item.uuid, origin: clrTok.uuid, spellLevel } } }], { dnd5e: { createActivityBehaviors: false } }))[0];
    const areaList = `${prior.emanationList || 'Aura of Protection, Aura of Courage, Aura of Warding, Spirit Guardians'}, Moonbeam, Cloud of Daggers`;
    if (want(18)) {
      await set('emanationList', areaList);
      await set('saveRolls', 'auto');
      const item = await giveSpell('Moonbeam');
      const act = [...(item?.system?.activities ?? [])].find(a => a.type === 'save');
      if (!item || !act) { ok('18-. Moonbeam lent', false, 'the PHB ships no Moonbeam this box can find'); }
      else {
        const far = { x: 300, y: 1900 };
        await vicTok.update(far, mv()); await rgrTok.update({ x: 300, y: 1600 }, mv()); await clrTok.update({ x: 600, y: 1900 }, mv());
        await sleep(500);
        const beamAt = { x: 1200, y: 1200 };   // empty ground
        const t18 = Date.now();
        const region = await placeArea(item, act, { type: 'circle', x: beamAt.x, y: beamAt.y, radius: 5 * px }, 2);
        const adopted = await waitFor(() => { const r = areaRegion('Moonbeam'); return r?.behaviors?.some(b => b.type === TYPE) ? r : null; }, 8000);
        ok('18a. the placed region is adopted as an AREA: flagged kind "area", the module\'s behaviour on it, attached to NO token', !!adopted && (adopted.id === region.id) && !adopted.attachment?.token && !adopted.behaviors.some(b => String(b.type).startsWith('dnd5e.')),
          `adopted=${adopted?.id} kind=${adopted?.getFlag(MOD, 'emanation')?.kind} attached=${adopted?.attachment?.token?.id ?? 'none'} behaviours=${adopted?.behaviors.map(b => b.type).join(',')}`);
        const areaCard = await waitFor(() => game.messages.find(m => (m.timestamp >= t18) && m.getFlag(MOD, 'emanationCard')?.key === 'Moonbeam') ?? null, 6000);
        ok('18b. a card announced the area as cast', !!areaCard, '');
        // The Victim walks in: entered → a save demand, Constitution, the spell\'s DC, half on a success, the damage rolled.
        await vicTok.update({ x: beamAt.x - grid / 2, y: beamAt.y - grid / 2 }, mv());
        const inCard = await waitFor(() => triggerCards().find(m => (m.timestamp >= t18) && m.getFlag(MOD, 'emanationTrigger')?.cause === 'enter' && m.getFlag(MOD, 'emanationTrigger')?.targetUuid === vicTok.actor.uuid) ?? null, 8000);
        const f = inCard?.getFlag(MOD, 'saves');
        ok('18c. walking into the beam raises the save demand for the Victim alone — Constitution, the spell\'s DC, half on a success, effectsHandled "emanation", pinned', !!inCard && (f?.abilities?.[0] === 'con') && (f?.dc === act.save.dc.value) && (f?.targets?.length === 1) && (f.targets[0].uuid === vicTok.actor.uuid) && (f?.damageOnSave === 'half') && (f?.effectsHandled === 'emanation') && (f?.pinnedTargets === true),
          `card=${!!inCard} flag=${JSON.stringify(f && { abilities: f.abilities, dc: f.dc, targets: f.targets.map(t => t.name), effectsHandled: f.effectsHandled, pinned: f.pinnedTargets })} title=${inCard?.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 120)}`);
        const dmg = await waitFor(() => game.messages.find(m => (m.timestamp >= t18) && (m._source.system?.origin === inCard?.id) && (m.type === 'damage')) ?? null, 8000);
        ok('18d. the spell\'s damage rolled against the demand (2d10 at 2nd level, radiant)', !!dmg && /2d10/.test(dmg.rolls?.[0]?.formula ?? '') && (dmg.rolls?.[0]?.options?.type === 'radiant'), `formula=${dmg?.rolls?.[0]?.formula} type=${dmg?.rolls?.[0]?.options?.type}`);
        ok('18e. the card names the CASTER, not a source token ("entered BF Test Cleric\'s Moonbeam")', /BF Test Cleric.s Moonbeam/.test(inCard?.content ?? ''), inCard?.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160) ?? '');
        await closeDialogs();
        // The beam MOVES onto the standing Ranger (the caster\'s Magic action is a drag of the template).
        const n1 = triggerCards().length;
        await vicTok.update(far, mv()); await sleep(600);
        await scene.regions.get(region.id).update({ shapes: [{ type: 'circle', x: rgrTok.x + grid / 2, y: rgrTok.y + grid / 2, radius: 5 * px }] });
        const moveCard = await waitFor(() => triggerCards().find(m => (m.timestamp >= t18) && m.getFlag(MOD, 'emanationTrigger')?.targetUuid === ranger.uuid) ?? null, 8000);
        ok('18f. the beam moved onto the standing Ranger: the platform raises the entry and the module demands the save — reach "all", an ally included', !!moveCard && (moveCard.getFlag(MOD, 'emanationTrigger')?.cause === 'enter'), `cards=${triggerCards().length} (was ${n1}) target=${moveCard?.getFlag(MOD, 'emanationTrigger')?.targetUuid}`);
        await closeDialogs();
        await scene.regions.get(region.id).update({ shapes: [{ type: 'circle', x: beamAt.x, y: beamAt.y, radius: 5 * px }] });
        await sleep(600);
        // In combat: the Victim\'s turn ends inside → a demand; once per turn.
        await ownCombat([[clrTok, cleric, 20], [vicTok, victim, 10]]);
        const n2 = triggerCards().length;
        await vicTok.update({ x: beamAt.x - grid / 2, y: beamAt.y - grid / 2 }, mv());
        const cIn = await waitFor(() => triggerCards().length > n2 ? triggerCards().at(-1) : null, 8000);
        // ⚠ The Victim's token is UNLINKED: the chit lives on the token's own actor.
        ok('18g. in combat, entering demands the save and writes the once-per-turn chit', !!cIn && vicTok.actor.effects.some(e => e.getFlag(MOD, 'riderKey') === `emanation:${region.id}`), `cards=${triggerCards().length} chits=${vicTok.actor.effects.filter(e => e.getFlag(MOD, 'riderKey')).map(e => e.name).join(',')}`);
        await closeDialogs();
        const n3 = triggerCards().length;
        await combat.nextTurn(); await sleep(600);   // → the Victim\'s turn
        await combat.nextTurn();                     // the Victim\'s turn ENDS inside
        const endCard = await waitFor(() => triggerCards().find(m => (m.timestamp >= t18) && m.getFlag(MOD, 'emanationTrigger')?.cause === 'turnEnd') ?? null, 8000);
        ok('18h. the Victim\'s turn ending inside the beam demands the save (a new turn: the chit is gone)', !!endCard && (triggerCards().length === n3 + 1), `cards=${triggerCards().length} (was ${n3})`);
        await closeDialogs();
        try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
        combat = null;
        await scene.regions.get(region.id)?.delete().catch(() => {});
        await vicTok.update(home[vicTok.id], mv()); await rgrTok.update(home[rgrTok.id], mv()); await clrTok.update(home[clrTok.id], mv());
        await sleep(500);
      }
    }

    // ================================================== 19. the AREA kind — Cloud of Daggers (plain damage)
    if (want(19)) {
      await set('emanationList', areaList);
      const item = await giveSpell('Cloud of Daggers');
      const act = [...(item?.system?.activities ?? [])].find(a => a.type === 'damage');
      if (!item || !act) { ok('19-. Cloud of Daggers lent', false, 'the PHB ships no Cloud of Daggers this box can find'); }
      else {
        const far = { x: 300, y: 1900 };
        await vicTok.update(far, mv()); await clrTok.update({ x: 600, y: 1900 }, mv());
        await sleep(400);
        // ⚠ Unlinked: the damage lands on the token's own actor, and a token MOVE re-creates that synthetic
        // actor — read it fresh at every assertion, never off an instance captured before the move.
        const vicActor = () => scene.tokens.get(vicTok.id).actor;
        await vicActor().update({ 'system.attributes.hp.value': vicActor().system.attributes.hp.max });   // earlier sections drain it
        const hp0 = vicActor().system.attributes.hp.value;
        const cubeAt = { x: 1200, y: 1200 };
        const t19 = Date.now();
        const region = await placeArea(item, act, { type: 'rectangle', x: cubeAt.x - grid / 2, y: cubeAt.y - grid / 2, width: grid, height: grid }, 2);
        const adopted = await waitFor(() => { const r = areaRegion('Cloud of Daggers'); return r?.behaviors?.some(b => b.type === TYPE) ? r : null; }, 8000);
        ok('19a. the cube is adopted as an area', !!adopted && (adopted.id === region.id), `adopted=${adopted?.id}`);
        await vicTok.update({ x: cubeAt.x - grid / 2, y: cubeAt.y - grid / 2 }, mv());
        const card = await waitFor(() => triggerCards().find(m => (m.timestamp >= t19) && m.getFlag(MOD, 'emanationTrigger')?.key === 'Cloud of Daggers' && m.getFlag(MOD, 'emanationTrigger')?.targetUuid === vicTok.actor.uuid) ?? null, 8000);
        const tf = card?.getFlag(MOD, 'emanationTrigger');
        const receipt = await waitFor(() => card?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === vicActor().uuid) ?? null, 8000);
        const hpDown = await waitFor(() => (vicActor().system.attributes.hp.value < hp0) ? true : null, 6000);
        ok('19b. walking into the cube takes the dice — NO save demand: a card with the roll (4d4 slashing), a receipt, the Hit Points down', !!card && !card.getFlag(MOD, 'saves') && (tf?.damage === true) && /4d4/.test(card.rolls?.[0]?.formula ?? '') && !!receipt && !!hpDown,
          `preds=${JSON.stringify({ card: !!card, noSaves: !card?.getFlag(MOD, 'saves'), damage: tf?.damage === true, formula: /4d4/.test(card?.rolls?.[0]?.formula ?? ''), receipt: !!receipt, hpDown: !!hpDown })} flag=${JSON.stringify(tf)} formula=${card?.rolls?.[0]?.formula} receipt=${JSON.stringify(receipt && { taken: receipt.taken, delta: receipt.delta, note: receipt.note })} hp=${hp0}→${vicActor().system.attributes.hp.value}`);
        await scene.regions.get(region.id)?.delete().catch(() => {});
        await vicActor().update({ 'system.attributes.hp.value': hp0 });
        await vicTok.update(home[vicTok.id], mv()); await clrTok.update(home[clrTok.id], mv());
        await set('emanationList', 'Aura of Protection, Aura of Courage, Aura of Warding, Spirit Guardians');
        await sleep(500);
      }
    }

    // ================================================== THE HELD SPELLS (§20–§23): the shared bits
    const vicActor = () => scene.tokens.get(vicTok.id).actor;   // ⚠ unlinked: read fresh after every move
    const walk = (tokDoc, x, y) => tokDoc.move([{ x, y, action: 'walk' }], { constrainOptions: { ignoreWalls: true, ignoreTokens: true } });
    const noticesSince = t => game.messages.filter(m => (m.timestamp >= t) && m.getFlag(MOD, 'areaNotice'));
    const parkAll = async () => { await vicTok.update({ x: 300, y: 1900 }, mv()); await rgrTok.update({ x: 300, y: 1600 }, mv()); await clrTok.update({ x: 600, y: 1900 }, mv()); await palTok.update({ x: 900, y: 1900 }, mv()); await sleep(500); };
    const homeAll = async () => { for (const t of [palTok, clrTok, rgrTok, vicTok]) await t.update(home[t.id], mv()); await sleep(500); };
    const adoptedArea = key => waitFor(() => { const r = areaRegion(key); return r?.behaviors?.some(b => b.type === TYPE) ? r : null; }, 8000);

    // ================================================== 20. Wall of Fire — the band
    if (want(20)) {
      await set('saveRolls', 'auto');
      const item = await giveSpell('Wall of Fire');
      const act = [...(item?.system?.activities ?? [])].find(a => a.name === 'Create Wall');
      if (!item || !act) { ok('20-. Wall of Fire lent', false, 'the PHB ships no Wall of Fire this box can find'); }
      else {
        await parkAll();
        await clrTok.update({ x: 1200, y: 900 }, mv());   // the Cleric NORTH of the wall
        await sleep(400);
        const t20 = Date.now();
        // An east–west wall at y = 1200, 30 ft long, 1 ft thick, from x = 1000.
        const region = await placeArea(item, act, { type: 'line', x: 1000, y: 1200, length: 6 * grid, width: px, rotation: 0 }, 4);
        const adopted = await waitFor(() => { const r = areaRegion('Wall of Fire'); return r?.getFlag(MOD, 'emanation')?.band ? r : null; }, 8000);
        const f = adopted?.getFlag(MOD, 'emanation');
        const shape = adopted?.shapes?.[0];
        ok('20a. the wall is adopted and WIDENED by 10 ft on the side AWAY from the Cleric (south, +1): the line\'s width grew by 10 ft, its centreline moved 5 ft south, the base shape kept on the flag',
          !!adopted && (adopted.id === region.id) && (f?.band?.side === 1) && (shape?.type === 'line') && (Math.round(shape.width) === Math.round(11 * px)) && (Math.round(shape.y) === Math.round(1200 + 5 * px)) && (Math.round(f.band.base?.width) === Math.round(px)),
          `adopted=${!!adopted} band=${JSON.stringify(f?.band && { side: f.band.side, base: f.band.base?.width })} shape=${JSON.stringify(shape && { type: shape.type, y: shape.y, width: shape.width })} px=${px}`);
        const card = await waitFor(() => game.messages.find(m => (m.timestamp >= t20) && m.getFlag(MOD, 'emanationCard')?.key === 'Wall of Fire') ?? null, 6000);
        const band = card?.getFlag(MOD, 'emanationCard')?.band;
        ok('20b. the cast\'s card offers the two sides by compass name, the south side chosen', (band?.side === 1) && (band?.options?.map(o => o.label).join('|') === 'the south side|the north side'),
          `band=${JSON.stringify(band)}`);
        // The Victim 5 ft south (inside the band), the Ranger 5 ft north (the cold side); a combat; their turns end.
        await vicTok.update({ x: 1200, y: 1200 + grid / 2 }, mv()); await rgrTok.update({ x: 1400, y: 1200 - grid * 1.5 }, mv());
        await sleep(500);
        await ownCombat([[clrTok, cleric, 20], [vicTok, vicActor(), 10], [rgrTok, ranger, 5]]);
        await combat.nextTurn(); await sleep(300);   // → the Victim
        await combat.nextTurn();                     // the Victim's turn ends on the hot side
        const endCard = await waitFor(() => triggerCards().find(m => (m.timestamp >= t20) && m.getFlag(MOD, 'emanationTrigger')?.key === 'Wall of Fire' && m.getFlag(MOD, 'emanationTrigger')?.cause === 'turnEnd' && m.getFlag(MOD, 'emanationTrigger')?.targetUuid === vicActor().uuid) ?? null, 8000);
        const ef = endCard?.getFlag(MOD, 'saves');
        const dmg = await waitFor(() => game.messages.find(m => (m.timestamp >= t20) && (m._source.system?.origin === endCard?.id) && (m.type === 'damage')) ?? null, 8000);
        ok('20c. the Victim ending its turn within 10 ft of the hot side is demanded the Dexterity save, the 5d8 fire rolled', !!endCard && (ef?.abilities?.[0] === 'dex') && !!dmg && /5d8/.test(dmg?.rolls?.[0]?.formula ?? '') && (dmg?.rolls?.[0]?.options?.type === 'fire'),
          `card=${!!endCard} abilities=${JSON.stringify(ef?.abilities)} formula=${dmg?.rolls?.[0]?.formula} type=${dmg?.rolls?.[0]?.options?.type}`);
        await closeDialogs();
        const nBefore = triggerCards().length;
        await combat.nextTurn();   // the Ranger's turn ends on the cold side
        await sleep(900);
        ok('20d. the Ranger ending its turn on the cold side is asked nothing', triggerCards().length === nBefore, `cards=${triggerCards().length} (was ${nBefore})`);
        // The flip, on the card (the GM writes straight): the region follows.
        await card.setFlag(MOD, 'emanationCard', { ...card.getFlag(MOD, 'emanationCard'), band: { ...band, side: -1 } });
        const flipped = await waitFor(() => { const r = scene.regions.get(region.id); return (r?.getFlag(MOD, 'emanation')?.band?.side === -1) ? r : null; }, 8000);
        ok('20e. flipping the side on the card moves the band: the region re-shaped 5 ft NORTH of the wall', !!flipped && (Math.round(flipped.shapes[0].y) === Math.round(1200 - 5 * px)) && (Math.round(flipped.shapes[0].width) === Math.round(11 * px)),
          `side=${flipped?.getFlag(MOD, 'emanation')?.band?.side} y=${flipped?.shapes?.[0]?.y} width=${flipped?.shapes?.[0]?.width}`);
        try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
        combat = null;
        await scene.regions.get(region.id)?.delete().catch(() => {});
        await homeAll();
      }
    }

    // ================================================== 21. Spike Growth — the move
    if (want(21)) {
      const item = await giveSpell('Spike Growth');
      const act = [...(item?.system?.activities ?? [])].find(a => a.type === 'damage');
      if (!item || !act) { ok('21-. Spike Growth lent', false, 'the PHB ships no Spike Growth this box can find'); }
      else {
        await parkAll();
        const at = { x: 1200, y: 1200 };
        const t21 = Date.now();
        const region = await placeArea(item, act, { type: 'circle', x: at.x, y: at.y, radius: 20 * px }, 2);
        const adopted = await adoptedArea('Spike Growth');
        ok('21a. the sphere is adopted as an area', !!adopted && (adopted.id === region.id), `adopted=${adopted?.id}`);
        const moveCards = () => game.messages.filter(m => (m.timestamp >= t21) && m.getFlag(MOD, 'areaMove'));
        // The Victim teleports IN at the west edge (a teleport pays nothing), then WALKS 15 ft east inside.
        const west = { x: at.x - 3 * grid - grid / 2, y: at.y - grid / 2 };
        await vicTok.update(west, mv());
        await sleep(800);
        await vicActor().update({ 'system.attributes.hp.value': vicActor().system.attributes.hp.max });   // earlier sections drain it
        const hp0 = vicActor().system.attributes.hp.value;
        const n0 = moveCards().length;
        ok('21b. the teleport in paid nothing', n0 === 0, `cards=${n0}`);
        await walk(vicTok, at.x - grid / 2, at.y - grid / 2);
        const card = await waitFor(() => moveCards()[n0] ?? null, 10000);
        const mf = card?.getFlag(MOD, 'areaMove');
        const receipt = await waitFor(() => card?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === vicActor().uuid) ?? null, 8000);
        const hpDown = await waitFor(() => (vicActor().system.attributes.hp.value < hp0) ? true : null, 6000);
        ok('21c. the walked move of 15 ft inside pays 6d4 piercing when it lands — a card with the roll and the feet, a receipt, the Hit Points down',
          !!card && (mf?.feet === 15) && (mf?.steps === 3) && /6d4/.test(mf?.formula ?? '') && (mf?.type === 'piercing') && /6d4/.test(card?.rolls?.[0]?.formula ?? '') && !!receipt && !!hpDown,
          `card=${!!card} flag=${JSON.stringify(mf && { feet: mf.feet, steps: mf.steps, formula: mf.formula, total: mf.total, type: mf.type })} receipt=${!!receipt} hp=${hp0}→${vicActor().system.attributes.hp.value}`);
        await sleep(800);
        ok('21d. one movement, one payment', moveCards().length === n0 + 1, `cards=${moveCards().length}`);
        await scene.regions.get(region.id)?.delete().catch(() => {});
        await vicActor().update({ 'system.attributes.hp.value': hp0 });
        await homeAll();
      }
    }

    // ================================================== 22. Magic Circle — the ask, the notice, the gate
    if (want(22)) {
      const item = await giveSpell('Magic Circle');
      const act = [...(item?.system?.activities ?? [])].find(a => a.type === 'save');
      if (!item || !act) { ok('22-. Magic Circle lent', false, 'the PHB ships no Magic Circle this box can find'); }
      else {
        await parkAll();
        const at = { x: 1200, y: 1200 };
        // The Ranger INSIDE the circle, the Cleric beside it, the Victim (a Fiend for the run) 20 ft west.
        await rgrTok.update({ x: at.x - grid / 2, y: at.y - grid / 2 }, mv()); await clrTok.update({ x: at.x + 3 * grid - grid / 2, y: at.y - grid / 2 }, mv()); await vicTok.update({ x: at.x - 4 * grid - grid / 2, y: at.y - grid / 2 }, mv());
        await sleep(400);
        const priorType = vicActor().system._source.details?.type?.value ?? '';
        await vicActor().update({ 'system.details.type.value': 'fiend' });
        // A club for the Fiend's attacks.
        let club = null;
        for (const id of ['dnd-players-handbook.equipment', 'dnd5e.items24']) {
          const pack = game.packs.get(id);
          const hit = pack ? (await pack.getIndex()).find(e => e.name === 'Club') : null;
          if (!hit) continue;
          const data = (await pack.getDocument(hit._id)).toObject(); delete data._id; data.system.equipped = true;
          [club] = await vicActor().createEmbeddedDocuments('Item', [data]);
          break;
        }
        const t22 = Date.now();
        const region = await placeArea(item, act, { type: 'circle', x: at.x, y: at.y, radius: 10 * px }, 3);
        const adopted = await adoptedArea('Magic Circle');
        const f = adopted?.getFlag(MOD, 'emanation');
        const card = await waitFor(() => game.messages.find(m => (m.timestamp >= t22) && m.getFlag(MOD, 'emanationCard')?.key === 'Magic Circle') ?? null, 6000);
        const picks = card?.getFlag(MOD, 'emanationCard')?.picks;
        const FIVE = 'celestial,elemental,fey,fiend,undead';
        const castDemand = game.messages.find(m => (m.timestamp >= t22) && (m.getFlag(MOD, 'saves')?.activityUuid === act.uuid)) ?? null;
        ok('22a. adopted with every type picked; the card lists the five, all on; no save demanded at the placement', !!adopted && ((f?.picked ?? []).join(',') === FIVE) && ((picks?.options ?? []).join(',') === FIVE) && ((picks?.picked ?? []).join(',') === FIVE) && !castDemand,
          `adopted=${!!adopted} picked=${JSON.stringify(f?.picked)} card=${JSON.stringify(picks)} castDemand=${!!castDemand}`);
        // The Fiend walks in: the entry notice, the move carried on.
        await walk(vicTok, at.x - 2 * grid - grid / 2, at.y - grid / 2);
        const notice = await waitFor(() => noticesSince(t22).find(m => m.getFlag(MOD, 'areaNotice')?.cause === 'moveIn') ?? null, 8000);
        const arrived = await waitFor(() => (vicTok.x === at.x - 2 * grid - grid / 2) ? true : null, 8000);
        ok('22b. the Fiend moving IN raises the entry notice ("cannot willingly enter"); the move carried on', !!notice && /cannot willingly enter/.test(notice?.content ?? '') && !!arrived && (notice?.getFlag(MOD, 'areaNotice')?.targetUuid === vicActor().uuid),
          `notice=${!!notice} arrived=${!!arrived} text=${notice?.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 140)}`);
        // The gate: the Fiend attacks the Ranger INSIDE → Disadvantage listed; the Cleric OUTSIDE → nothing.
        const clubAct = () => vicActor().items.get(club?.id)?.system.activities.find(a => a.type === 'attack') ?? null;
        // The gate draws in the DIALOG (no dialog, no gate): open it, read the section, close it.
        const gateAt = async tok => {
          canvas.tokens.get(vicTok.id)?.control({ releaseOthers: true });
          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
          canvas.tokens.get(tok.id)?.setTarget(true, { releaseOthers: true });
          await sleep(120);
          const p = clubAct()?.rollAttack({}, {}, {});
          const app = await waitFor(() => [...foundry.applications.instances.values()].find(a => /RollConfigurationDialog/.test(a.constructor?.name ?? '')) ?? null, 6000);
          await sleep(400);
          const text = app?.element?.querySelector('[data-bf-reminder]')?.textContent?.replace(/\s+/g, ' ') ?? '';
          const net = app?.options?.bfReminder?.net ?? null;
          try { await app?.close(); } catch { /* gone */ }
          await Promise.resolve(p).catch(() => {});
          return { text, net };
        };
        const inside = club ? await gateAt(rgrTok) : null;
        ok('22c. the Fiend attacking the Ranger INSIDE the circle: the gate lists "Magic Circle — a fiend attacking into the circle", net Disadvantage', !!club && !!inside && /Magic Circle — a fiend attacking into the circle/.test(inside.text) && (inside.net === 'disadvantage'),
          `club=${!!club} net=${inside?.net} text=${inside?.text?.slice(0, 200)}`);
        const outside = club ? await gateAt(clrTok) : null;
        ok('22d. the Fiend attacking the Cleric OUTSIDE the circle: no Magic Circle row', !!outside && !/Magic Circle/.test(outside.text),
          `net=${outside?.net} text=${outside?.text?.slice(0, 200)}`);
        // Untick Fiend on the card (the GM writes straight): the region follows, the gate lists nothing.
        const c = card.getFlag(MOD, 'emanationCard');
        await card.setFlag(MOD, 'emanationCard', { ...c, picks: { ...c.picks, picked: c.picks.picked.filter(x => x !== 'fiend') } });
        const followed = await waitFor(() => (scene.regions.get(region.id)?.getFlag(MOD, 'emanation')?.picked ?? []).includes('fiend') ? null : true, 8000);
        const after = club ? await gateAt(rgrTok) : null;
        ok('22e. unticking Fiend on the card reaches the region, and the gate lists nothing for the Fiend now', !!followed && !!after && !/Magic Circle/.test(after.text),
          `picked=${JSON.stringify(scene.regions.get(region.id)?.getFlag(MOD, 'emanation')?.picked)} text=${after?.text?.slice(0, 200)}`);
        await closeDialogs();
        canvas.tokens.get(vicTok.id)?.release();
        game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
        if (club && vicActor().items.get(club.id)) await vicActor().deleteEmbeddedDocuments('Item', [club.id]);
        await vicActor().update({ 'system.details.type.value': priorType });
        await scene.regions.get(region.id)?.delete().catch(() => {});
        await homeAll();
      }
    }

    // ================================================== 23. Forcecage — the exit notice
    if (want(23)) {
      const item = await giveSpell('Forcecage');
      const act = [...(item?.system?.activities ?? [])].find(a => a.name === 'Create Cage');
      if (!item || !act) { ok('23-. Forcecage lent', false, 'the PHB ships no Forcecage this box can find'); }
      else {
        await parkAll();
        const at = { x: 1000, y: 1000 };   // a 20-ft cube: 4 squares a side
        await vicTok.update({ x: at.x + grid, y: at.y + grid }, mv());
        await sleep(400);
        const t23 = Date.now();
        const region = await placeArea(item, act, { type: 'rectangle', x: at.x, y: at.y, width: 4 * grid, height: 4 * grid }, 7);
        const adopted = await adoptedArea('Forcecage');
        const card = await waitFor(() => game.messages.find(m => (m.timestamp >= t23) && m.getFlag(MOD, 'emanationCard')?.key === 'Forcecage') ?? null, 6000);
        ok('23a. the cage is adopted and announced; no effect, no save', !!adopted && (adopted.id === region.id) && !!card && !game.messages.find(m => (m.timestamp >= t23) && (m.getFlag(MOD, 'saves')?.activityUuid === act.uuid)),
          `adopted=${!!adopted} card=${!!card}`);
        await walk(vicTok, at.x + 6 * grid, at.y + grid);
        const notice = await waitFor(() => noticesSince(t23).find(m => m.getFlag(MOD, 'areaNotice')?.cause === 'moveOut') ?? null, 8000);
        const arrived = await waitFor(() => (vicTok.x === at.x + 6 * grid) ? true : null, 8000);
        ok('23b. the creature walking OUT of the cage raises the exit notice ("the walls hold it"); the move carried on', !!notice && /walls hold it/.test(notice?.content ?? '') && !!arrived,
          `notice=${!!notice} arrived=${!!arrived} text=${notice?.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 140)}`);
        const n = noticesSince(t23).length;
        await walk(vicTok, at.x + grid, at.y + grid);
        await waitFor(() => (vicTok.x === at.x + grid) ? true : null, 8000);
        await sleep(800);
        ok('23c. walking back IN raises nothing', noticesSince(t23).length === n, `notices=${noticesSince(t23).length} (was ${n})`);
        await scene.regions.get(region.id)?.delete().catch(() => {});
        await homeAll();
      }
    }

    // ================================================== 24 / 25. the GM's side — the Monster
    const monster = game.actors.getName('BF Test Monster');
    const monTok = monster ? tok(monster) : null;
    const lendTrait = async name => {
      const pack = game.packs.get('dnd-monster-manual.features');
      const hit = (await pack?.getIndex())?.find(e => e.name === name);
      if (!hit) throw new Error(`the Monster Manual ships no "${name}" this box can find`);
      const [item] = await monster.createEmbeddedDocuments('Item', [(await pack.getDocument(hit._id)).toObject()]);
      return item;
    };
    const setIncapacitated = async (actor, on) => {
      const carriers = actor.effects.filter(e => e.statuses?.has?.('incapacitated'));
      if (on && !carriers.length) { const eff = await ActiveEffect.implementation.fromStatusEffect('incapacitated'); await ActiveEffect.implementation.create(eff.toObject(), { parent: actor, keepId: true }); }
      else if (!on && carriers.length) await actor.deleteEmbeddedDocuments('ActiveEffect', carriers.map(e => e.id));
      await sleep(300);
    };
    if ((want(24) || want(25)) && (!monster || !monTok)) { ok('24/25-. BF Test Monster on the range', false, 'missing fixture: BF Test Monster or its token — run tools/fixture-suite.mjs'); }

    if (want(24) && monster && monTok) {
      let aura = null;
      const priorWis = vicActor().system._source.abilities?.wis?.save?.roll?.bonus ?? '';
      const priorDisposition = vicTok.disposition;
      try {
        await parkAll();
        // The Victim turned FRIENDLY for the section: the Monster's enemy (a harmful reach), an NPC roller.
        await vicTok.update({ disposition: 1 });
        await sleep(200);
        await vicTok.update({ x: monTok.x + 2 * grid, y: monTok.y }, mv());   // 10 ft away, inside the ring
        await sleep(300);
        await set('saveRolls', 'auto');
        await vicActor().update({ 'system.abilities.wis.save.roll.bonus': '-30' });
        const t24 = Date.now();
        aura = await lendTrait('Fear Aura');
        const ring = await waitFor(() => { const r = featureRegion(monTok, 'Fear Aura'); return r?.behaviors?.find(b => b.type === TYPE) ? r : null; }, 12000);
        const beh = ring?.behaviors?.find(b => b.type === TYPE);
        log.push(`Fear Aura ring: radius ${ring?.shapes?.[0]?.radius} px (${(ring?.shapes?.[0]?.radius ?? 0) / px} ft)`);
        ok('24a. Fear Aura lent: a harmful ring rises on the Monster’s token — the save activity’s own Emanation, no member effect',
          !!ring && (ring.attachment?.token?.id === monTok.id) && (ring.shapes?.[0]?.radius > 0) && (beh?.system?.reach === 'harmful') && (beh?.system?.effect === null),
          `ring=${ring?.id} radius=${ring?.shapes?.[0]?.radius} reach=${beh?.system?.reach} effect=${JSON.stringify(beh?.system?.effect)}`);
        for (const c of game.combats.filter(c => c.active)) { priorActiveCombats.push(c.id); await c.update({ active: false }); }
        combat = await Combat.create({ scene: scene.id, active: true });
        await combat.createEmbeddedDocuments('Combatant', [{ tokenId: monTok.id, actorId: monster.id, initiative: 20 }, { tokenId: vicTok.id, actorId: victim.id, initiative: 10 }]);
        await combat.startCombat();   // the Monster's turn
        if (game.combat?.id !== combat.id) { try { ui.combat.viewed = combat; } catch { /* the tracker */ } }
        await sleep(400);
        const n0 = triggerCards().length;
        await combat.nextTurn();      // the Victim's turn STARTS inside
        const card = await waitFor(() => triggerCards().find(m => (m.timestamp >= t24) && (m.getFlag(MOD, 'emanationTrigger')?.cause === 'turnStart') && (m.getFlag(MOD, 'emanationTrigger')?.key === 'Fear Aura')) ?? null, 10000);
        const sv = card?.getFlag(MOD, 'saves');
        ok('24b. the Victim (the Monster’s enemy) starting its turn inside is demanded the Wisdom save — cause turnStart, the trait’s DC, the failure’s Frightened named, nothing handled by a standing effect',
          !!card && (sv?.abilities?.[0] === 'wis') && (sv?.targets?.length === 1) && (sv.targets[0].uuid === vicActor().uuid) && ((sv?.effectNames?.fail ?? []).includes('Frightened')) && !sv?.effectsHandled && /started its turn inside/.test(card?.content ?? ''),
          `card=${!!card} saves=${JSON.stringify(sv && { abilities: sv.abilities, dc: sv.dc, targets: sv.targets.map(t => t.name), effectNames: sv.effectNames, effectsHandled: sv.effectsHandled })}`);
        await waitFor(() => game.messages.get(card?.id)?.getFlag(MOD, 'saves')?.targets?.[0]?.applied ? true : null, 15000);
        const frightened = await waitFor(() => vicActor().effects.find(e => e.name === 'Frightened') ?? null, 8000);
        ok('24c. the failed save (−30) lands Frightened on the Victim by the verdict, receipted on the card',
          !!frightened && (game.messages.get(card?.id)?.getFlag(MOD, 'saves')?.targets?.[0]?.outcome === 'failed') && !!game.messages.get(card?.id)?.getFlag(MOD, 'effectReceipt'),
          `frightened=${!!frightened} outcome=${game.messages.get(card?.id)?.getFlag(MOD, 'saves')?.targets?.[0]?.outcome} receipt=${!!game.messages.get(card?.id)?.getFlag(MOD, 'effectReceipt')}`);
        await closeDialogs();
        // The Monster Incapacitated: the ring is disabled, the next turn start asks nothing.
        await setIncapacitated(monster, true);
        await waitFor(() => featureRegion(monTok, 'Fear Aura')?.behaviors?.find(b => b.type === TYPE)?.disabled ? true : null, 8000);
        const n1 = triggerCards().length;
        await combat.nextTurn();      // the Monster
        await sleep(300);
        await combat.nextTurn();      // the Victim's turn starts inside again — the aura is off
        await sleep(1500);
        ok('24d. the Monster Incapacitated: the ring stands disabled and the Victim’s next turn start asks nothing', (triggerCards().length === n1) && !!featureRegion(monTok, 'Fear Aura')?.behaviors?.find(b => b.type === TYPE)?.disabled,
          `cards=${triggerCards().length} (was ${n1}, before combat ${n0}) disabled=${featureRegion(monTok, 'Fear Aura')?.behaviors?.find(b => b.type === TYPE)?.disabled}`);
      } finally {
        await closeDialogs();
        try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
        combat = null;
        await setIncapacitated(monster, false);
        await vicActor().update({ 'system.abilities.wis.save.roll.bonus': priorWis });
        const fr = vicActor().effects.filter(e => e.name === 'Frightened').map(e => e.id);
        if (fr.length) await vicActor().deleteEmbeddedDocuments('ActiveEffect', fr).catch(() => {});
        await aura?.delete().catch(() => {});
        await waitFor(() => featureRegion(monTok, 'Fear Aura') ? null : true, 8000);
        await vicTok.update({ disposition: priorDisposition }, mv());
        await homeAll();
      }
    }

    if (want(25) && monster && monTok) {
      let trait = null;
      let club = null;
      try {
        await parkAll();
        await vicTok.update({ x: monTok.x - 2 * grid, y: monTok.y }, mv());
        await sleep(300);
        trait = await lendTrait('Displacement');
        for (const id of ['dnd-players-handbook.equipment', 'dnd5e.items24']) {
          const pack = game.packs.get(id);
          const hit = pack ? (await pack.getIndex()).find(e => e.name === 'Club') : null;
          if (!hit) continue;
          const data = (await pack.getDocument(hit._id)).toObject(); delete data._id; data.system.equipped = true;
          [club] = await vicActor().createEmbeddedDocuments('Item', [data]);
          break;
        }
        const clubAct = () => vicActor().items.get(club?.id)?.system.activities.find(a => a.type === 'attack') ?? null;
        const gateAt = async () => {
          canvas.tokens.get(vicTok.id)?.control({ releaseOthers: true });
          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
          canvas.tokens.get(monTok.id)?.setTarget(true, { releaseOthers: true });
          await sleep(120);
          const p = clubAct()?.rollAttack({}, {}, {});
          const app = await waitFor(() => [...foundry.applications.instances.values()].find(a => /RollConfigurationDialog/.test(a.constructor?.name ?? '')) ?? null, 6000);
          await sleep(400);
          const text = app?.element?.querySelector('[data-bf-reminder]')?.textContent?.replace(/\s+/g, ' ') ?? '';
          const net = app?.options?.bfReminder?.net ?? null;
          try { await app?.close(); } catch { /* gone */ }
          await Promise.resolve(p).catch(() => {});
          return { text, net };
        };
        const up = club ? await gateAt() : null;
        ok('25a. the Victim attacking the Monster with Displacement on its sheet: the gate lists "BF Test Monster is — Displacement", net Disadvantage',
          !!club && !!up && /BF Test Monster is — Displacement/.test(up.text) && (up.net === 'disadvantage'), `club=${!!club} net=${up?.net} text=${up?.text?.slice(0, 200)}`);
        await setIncapacitated(monster, true);
        const off = club ? await gateAt() : null;
        ok('25b. the Monster Incapacitated: no Displacement row', !!off && !/Displacement/.test(off.text), `net=${off?.net} text=${off?.text?.slice(0, 200)}`);
      } finally {
        await closeDialogs();
        await setIncapacitated(monster, false);
        await club?.delete().catch(() => {});
        await trait?.delete().catch(() => {});
        game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
        await homeAll();
      }
    }
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'emanations', out, plan, f });
