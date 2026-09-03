// Battle Flow emanations smoke test — AN AURA APPLIES ITSELF TO THE CREATURES INSIDE IT (user
// ruling 2026-09-03: emanations are a core part of combat; DESIGN §4 amended). The platform keeps
// the geometry and the clock (a Region attached to the token, measured in tools/probe-emanations.mjs);
// the module puts the pack's effect on it with the SOURCE's numbers read in, and raises the saves a
// spell demands of creatures entering or ending a turn inside.
//
// Fixtures: BF Test Paladin (Paladin 10 / Ancients — the three auras, Cha 16: +3), BF Test Cleric
// (Cleric 5 — Spirit Guardians prepared), BF Test Ranger (friendly), BF Test Victim (hostile,
// unlinked). Built by tools/fixture-suite.mjs; the Paladin and Cleric live on the range's bottom
// row so the always-on aura reaches nobody between suites.
//
// Harness discipline: every setting touched is restored; every region, template, combat and
// message this run creates is deleted; member effects and chits are cleared; tokens go home.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'the behaviour type is registered at init, and the sweep raises the Paladin\'s aura: a Region attached to the token, the class\'s own 10 feet, the Paladin\'s +3 resolved into the effect',
  2: 'an ally walking in receives "Protected — BF Test Paladin" with the PALADIN\'s Charisma, not its own; walking out loses it',
  3: 'reach: a hostile inside a helpful aura receives nothing',
  4: 'the AREA moving onto a standing ally applies it; moving away lifts it',
  5: 'Incapacitated on the Paladin lifts the aura from everyone inside; recovering restores it',
  6: 'Spirit Guardians: the placed template is adopted — attached to the Cleric, Half Speed on the hostile inside and not on the ally',
  7: 'Spirit Guardians triggers: a save demand card when the hostile enters, another when it ends its turn inside, none for a second entry in the same turn',
  8: 'the template goes (concentration\'s end) — the region goes and Half Speed lifts',
  9: 'the switch: Emanations off removes the standing aura; on again raises it',
  10: 'the registrations FIRED (§11): createRegion, updateToken and the region events moved'
};
const DEPENDS = { 2: [1], 3: [1], 4: [1], 5: [1], 7: [6], 8: [6], 9: [1] };

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
  if (!game.settings.settings.has(`${MOD}.emanationList`)) return { fatal: 'emanationList not registered — OLD code (restart the box)' };

  const SETTING_KEYS = ['emanations', 'emanationList', 'saves', 'saveTimer', 'playerRollDamage', 'autoApply', 'requireTarget'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const paladin = game.actors.getName('BF Test Paladin');
  const cleric = game.actors.getName('BF Test Cleric');
  const ranger = game.actors.getName('BF Test Ranger');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !paladin || !cleric || !ranger || !victim) return { fatal: 'missing fixture: scene, BF Test Paladin, BF Test Cleric, BF Test Ranger or BF Test Victim — run tools/fixture-suite.mjs' };
  if (canvas.scene?.id !== scene.id) { await scene.view(); await sleep(1500); }
  const tok = actor => scene.tokens.find(t => t.actorId === actor.id) ?? null;
  const palTok = tok(paladin), clrTok = tok(cleric), rgrTok = tok(ranger), vicTok = tok(victim);
  if (!palTok || !clrTok || !rgrTok || !vicTok) return { fatal: 'a fixture token is missing from the range — run tools/fixture-suite.mjs' };
  const home = Object.fromEntries([palTok, clrTok, rgrTok, vicTok].map(t => [t.id, { x: t.x, y: t.y }]));
  const grid = scene.grid.size;
  const px = scene.dimensions?.distancePixels ?? (grid / scene.grid.distance);

  const memberFx = (actor, regionId = null) => (actor?.effects ?? []).filter(e => { const f = e.getFlag(MOD, 'emanation'); return f && (!regionId || f.regionId === regionId); });
  const featureRegion = (tokDoc, key) => scene.regions.find(r => { const f = r.getFlag(MOD, 'emanation'); return f?.kind === 'feature' && f.tokenId === tokDoc.id && f.key === key; }) ?? null;
  const spellRegion = key => scene.regions.find(r => { const f = r.getFlag(MOD, 'emanation'); return f?.kind === 'spell' && f.key === key; }) ?? null;
  const triggerCards = () => game.messages.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationTrigger'));

  let combat = null;
  let template = null;
  let restored = false;
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
      try { if (template && scene.templates.get(template.id)) await template.delete(); } catch { /* gone */ }
      for (const r of scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'spell')) await r.delete().catch(() => {});
      for (const [id, pos] of Object.entries(home)) { const t = scene.tokens.get(id); if (t && ((t.x !== pos.x) || (t.y !== pos.y))) await t.update(pos, mv()); }
      await sleep(600);
      await clearMembers();
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow' || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('emanations', true);
    await set('emanationList', 'Aura of Protection, Aura of Courage, Aura of Warding, Spirit Guardians');
    await set('saves', true); await set('saveTimer', 24); await set('playerRollDamage', false); await set('autoApply', true); await set('requireTarget', false);
    await clearMembers();
    // Everyone home and apart: the Paladin and Cleric on the bottom row, the line at y=1000.
    for (const [id, pos] of Object.entries(home)) { const t = scene.tokens.get(id); if ((t.x !== pos.x) || (t.y !== pos.y)) await t.update(pos, mv()); }
    await sleep(800);
    const chaMod = paladin.system.abilities.cha.mod;
    log.push(`paladin cha mod ${chaMod}, aura scale ${JSON.stringify(paladin.getRollData().scale?.paladin?.aura ?? null)}, dispositions pal=${palTok.disposition} rgr=${rgrTok.disposition} vic=${vicTok.disposition} clr=${clrTok.disposition}`);

    // ================================================== 1. the type, the sweep, the region
    if (want(1)) {
      ok('1a. the Battle Flow behaviour type is registered on CONFIG (init)', !!CONFIG.RegionBehavior.dataModels[TYPE], Object.keys(CONFIG.RegionBehavior.dataModels).filter(k => k.startsWith(MOD)).join(','));
      // Start from nothing: an aura standing from an earlier run is deleted, and the sweep the
      // deletion schedules raises it again (a feature's aura is always on — the region is not
      // its switch), which is what posts the card §1g reads.
      for (const r of scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature')) await r.delete().catch(() => {});
      // All three, not the first: the sweep raises them one create at a time.
      const region = await waitFor(() => ['Aura of Protection', 'Aura of Courage', 'Aura of Warding'].every(k => featureRegion(palTok, k)) ? featureRegion(palTok, 'Aura of Protection') : null, 12000);
      ok('1b. a Region for Aura of Protection stands, attached to the Paladin\'s token', !!region && (region.attachment?.token?.id === palTok.id), `region=${region?.id} attached=${region?.attachment?.token?.id}`);
      const shape = region?.shapes?.[0];
      ok('1c. its shape is the token\'s base plus the class\'s 10 feet (@scale.paladin.aura — no number in the module)', (shape?.type === 'emanation') && (shape?.radius === 10 * px), `shape=${shape?.type} radius=${shape?.radius} expected=${10 * px}`);
      const beh = region?.behaviors?.find(b => b.type === TYPE);
      const change = beh?.system?.effect?.changes?.[0];
      ok('1d. the behaviour carries the pack\'s effect with the PALADIN\'s Charisma resolved in', !!beh && (change?.key === 'system.bonuses.abilities.save') && (String(change?.value) === String(chaMod)), `changes=${JSON.stringify(beh?.system?.effect?.changes)}`);
      await sleep(1500);   // let a second sweep, if one was queued, settle before counting
      const featureRegions = scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature' && r.getFlag(MOD, 'emanation')?.tokenId === palTok.id);
      ok('1e. all three auras stand (Protection, Courage, Warding) — EXACTLY one region each', (featureRegions.length === 3) && ['Aura of Protection', 'Aura of Courage', 'Aura of Warding'].every(k => featureRegions.filter(r => r.getFlag(MOD, 'emanation').key === k).length === 1), featureRegions.map(r => r.name).join(' | '));
      ok('1f. drawn for everyone (visibility ALWAYS) in the palette\'s green', (region?.visibility === CONST.REGION_VISIBILITY.ALWAYS) && /^#46965f$/i.test(region?.color?.toString?.() ?? region?.color ?? ''), `visibility=${region?.visibility} color=${region?.color}`);
      ok('1g. a card announced the aura (R5)', game.messages.some(m => (m.timestamp >= suiteStart - 60_000) && m.getFlag(MOD, 'emanationCard')?.key === 'Aura of Protection') || game.messages.some(m => m.getFlag(MOD, 'emanationCard')?.key === 'Aura of Protection'), '');
      ok('1h. the Paladin does not receive its own aura twice (the transfer effect already covers it)', memberFx(paladin).length === 0, `memberFx=${memberFx(paladin).map(e => e.name).join(',')}`);
    }

    // ================================================== 2. an ally walks in, and out
    const region = featureRegion(palTok, 'Aura of Protection');
    const inside = { x: palTok.x, y: palTok.y - 2 * grid };     // two squares above: one square gap, inside 10 ft
    if (want(2) && region) {
      const saveBefore = ranger.system.bonuses?.abilities?.save ?? '';
      await rgrTok.update(inside, mv());
      const fx = await waitFor(() => memberFx(ranger, region.id)[0] ?? null, 6000);
      ok('2a. the Ranger receives "Protected — BF Test Paladin"', fx?.name === 'Protected — BF Test Paladin', `effects=${memberFx(ranger).map(e => e.name).join(',')}`);
      ok('2b. …with the PALADIN\'s Charisma (+3), not the Ranger\'s', String(fx?.changes?.[0]?.value) === String(chaMod), `value=${fx?.changes?.[0]?.value} paladinCha=${chaMod} rangerCha=${ranger.system.abilities.cha.mod}`);
      ok('2c. the Ranger\'s save bonus now carries it', String(ranger.system.bonuses?.abilities?.save ?? '').includes(String(chaMod)), `before="${saveBefore}" after="${ranger.system.bonuses?.abilities?.save}"`);
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
      try {
        await Promise.race([sgAct.use({ consume: { spellSlot: false, resources: false }, create: { measuredTemplate: false } }, { configure: false }, { create: true }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('use() did not settle')), 8000))]);
      } catch (err) { log.push(`use(): ${err.message}`); }
      await sleep(500);
      [template] = await scene.createEmbeddedDocuments('MeasuredTemplate', [{ t: 'circle', x: clrTok.x + grid / 2, y: clrTok.y + grid / 2, distance: 15,
        flags: { dnd5e: { origin: sgAct.uuid, item: sgItem.uuid, spellLevel: 3 } } }]);
      sgRegion = await waitFor(() => spellRegion('Spirit Guardians'), 8000);
      ok('6a. the template\'s Region is adopted: flagged, attached to the Cleric\'s token', !!sgRegion && (sgRegion.attachment?.token?.id === clrTok.id), `region=${sgRegion?.id} attached=${sgRegion?.attachment?.token?.id} cardsSinceUse=${game.messages.size - b6}`);
      const beh = await waitFor(() => scene.regions.get(sgRegion?.id)?.behaviors?.find(b => b.type === TYPE) ?? null, 4000);
      ok('6b. its behaviour carries Half Speed and the harmful reach', (beh?.system?.reach === 'harmful') && (beh?.system?.effect?.name === 'Half Speed'), `system=${JSON.stringify(beh?.system)}`);
      const vicActor = vicTok.actor;
      const fx = await waitFor(() => memberFx(vicActor, sgRegion?.id)[0] ?? null, 6000);
      ok('6c. the hostile Victim inside is Half Speed', !!fx && (vicActor.system.attributes.movement.walk === Math.floor((vicActor.system._source.attributes.movement.walk ?? 30) / 2)), `walk=${vicActor.system.attributes.movement.walk} source=${vicActor.system._source.attributes.movement.walk} fx=${fx?.name}`);
      ok('6d. the allied Ranger inside is untouched (designated unaffected by default)', memberFx(ranger, sgRegion?.id).length === 0, memberFx(ranger).map(e => e.name).join(','));
      const sgCard = await waitFor(() => game.messages.find(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationCard')?.key === 'Spirit Guardians') ?? null, 6000);
      ok('6e. a card announced the emanation as cast', !!sgCard, '');
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
      const dmg = await waitFor(() => game.messages.find(m => (m.timestamp >= suiteStart) && (m.getFlag('dnd5e', 'originatingMessage') === card?.id) && (m.getFlag('dnd5e', 'roll.type') === 'damage')) ?? null, 8000);
      ok('7c. the spell\'s damage rolled against the demand (3d8 at 3rd level — the card\'s own chain)', !!dmg && /3d8/.test(dmg.rolls?.[0]?.formula ?? ''), `formula=${dmg?.rolls?.[0]?.formula}`);
      ok('7d. out of combat, the demand is not once-per-turn — no chit is written', !vicActor.effects.some(e => e.getFlag(MOD, 'riderKey') === `emanation:${sgRegion.id}`), '');
      // Now in combat: a turn ended inside, and the once-per-turn.
      await closeDialogs();
      combat = await Combat.create({ scene: scene.id, active: true });
      await combat.createEmbeddedDocuments('Combatant', [{ tokenId: clrTok.id, actorId: cleric.id, initiative: 20 }, { tokenId: vicTok.id, actorId: victim.id, initiative: 10 }]);
      await combat.startCombat();
      await sleep(600);
      // The Cleric's turn (initiative 20) ends first — not the Victim's; then the Victim's turn ends INSIDE.
      const n1 = triggerCards().length;
      await combat.nextTurn();     // → the Victim's turn
      await sleep(800);
      await combat.nextTurn();     // the Victim's turn ENDS inside → tokenTurnEnd → a demand
      const endCard = await waitFor(() => triggerCards().find(m => m.getFlag(MOD, 'emanationTrigger')?.cause === 'turnEnd') ?? null, 8000);
      ok('7e. ending its turn inside raises a save demand (tokenTurnEnd on the GM)', !!endCard, `cards=${triggerCards().length} (was ${n1})`);
      ok('7f. the once-per-turn chit was written on the Victim for this emanation', vicActor.effects.some(e => e.getFlag(MOD, 'riderKey') === `emanation:${sgRegion.id}`), vicActor.effects.filter(e => e.getFlag(MOD, 'mastery')).map(e => e.name).join(','));
      const n2 = triggerCards().length;
      await closeDialogs();
      await vicTok.update(vicOut, mv()); await sleep(600);
      await vicTok.update(vicIn, mv()); await sleep(1500);
      ok('7g. a second entry in the SAME turn asks for no second save', triggerCards().length === n2, `cards=${triggerCards().length} (was ${n2}, before combat ${n0})`);
      await closeDialogs();
    }

    // ================================================== 8. the template goes
    if (want(8) && sgRegion) {
      const vicActor = vicTok.actor;
      const rid = sgRegion.id;
      if (template && scene.templates.get(template.id)) await template.delete();
      template = null;
      const gone = await waitFor(() => (!scene.regions.get(rid) && memberFx(vicActor, rid).length === 0) ? true : null, 8000);
      ok('8a. deleting the template deletes the region and lifts Half Speed from the Victim', !!gone, `region=${!!scene.regions.get(rid)} fx=${memberFx(vicActor, rid).map(e => e.name).join(',')} walk=${vicActor.system.attributes.movement.walk}`);
    }

    // ================================================== 9. the switch
    if (want(9)) {
      // The setting's own onChange sweeps (no token nudge needed — that is what §9 proves).
      await set('emanations', false);
      const gone = await waitFor(() => !featureRegion(palTok, 'Aura of Protection') ? true : null, 8000);
      ok('9a. Emanations off: the standing aura is removed from the scene', !!gone, scene.regions.filter(r => r.getFlag(MOD, 'emanation')).map(r => r.name).join(' | '));
      await set('emanations', true);
      const back = await waitFor(() => featureRegion(palTok, 'Aura of Protection'), 8000);
      ok('9b. on again: the aura is raised again', !!back, '');
    }

    // ================================================== 10. FIRED
    if (want(10)) {
      ok('10a. createRegion fired (the adoption seam)', count('createRegion') > 0, `count=${count('createRegion')}`);
      ok('10b. updateToken fired (the floor)', count('updateToken') > 0, `count=${count('updateToken')}`);
      ok('10c. deleteRegion fired (the lift)', count('deleteRegion') > 0, `count=${count('deleteRegion')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'emanations', out, plan, f });
