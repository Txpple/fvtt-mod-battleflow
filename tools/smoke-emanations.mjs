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
  10: 'the registrations FIRED (§11): createRegion, updateToken and the region events moved',
  11: 'THE ACTIVE SCENE ONLY (user, 2026-09-04: the bleed): another scene made active brings the range\'s rings down and lifts the ally\'s effects; the range active again raises them once, no stack; a ring left on an inactive scene is brought down by the ready sweep'
};
const DEPENDS = { 2: [1], 3: [1], 4: [1], 5: [1], 7: [6], 8: [6], 9: [1], 11: [1] };

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
  const tok = actor => scene.tokens.find(t => t.actorId === actor.id) ?? null;
  const palTok = tok(paladin), clrTok = tok(cleric), rgrTok = tok(ranger), vicTok = tok(victim);
  if (!palTok || !clrTok || !rgrTok || !vicTok) return { fatal: 'a fixture token is missing from the range — run tools/fixture-suite.mjs' };
  // The range must be ACTIVE, not merely viewed: a ring stands on the active scene only. Done
  // after every fatal check (a fatal return runs no teardown — the battery's copy once left the
  // range active), and the user's active scene is handed back in teardown.
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
      try { if (template && scene.templates.get(template.id)) await template.delete(); } catch { /* gone */ }
      // The cast began concentration; end it so the next cast is not asked about the last one.
      try { if (cleric.concentration?.effects?.size) await cleric.endConcentration(); } catch { /* none */ }
      for (const r of scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'spell')) await r.delete().catch(() => {});
      for (const [id, pos] of Object.entries(home)) { const t = scene.tokens.get(id); if (t && ((t.x !== pos.x) || (t.y !== pos.y))) await t.update(pos, mv()); }
      await sleep(600);
      await clearMembers();
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow' || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
      // The range's rings come down with the scene going inactive (that is §11's rule); the
      // user's active scene is handed back, and §11's scene is gone.
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
    try { if (cleric.concentration?.effects?.size) await cleric.endConcentration(); } catch { /* none */ }
    for (const t of scene.templates.filter(t => t.getFlag('dnd5e', 'item') === sgItemUuid())) await t.delete().catch(() => {});
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
      for (const r of scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature')) { const t = scene.templates.get(r.id); if (t) await t.delete().catch(() => {}); if (scene.regions.get(r.id)) await r.delete().catch(() => {}); }
      // All three, not the first: the sweep raises them one create at a time.
      const region = await waitFor(() => ['Aura of Protection', 'Aura of Courage', 'Aura of Warding'].every(k => featureRegion(palTok, k)) ? featureRegion(palTok, 'Aura of Protection') : null, 12000);
      ok('1b. a Region for Aura of Protection stands, attached to the Paladin\'s token', !!region && (region.attachment?.token?.id === palTok.id), `region=${region?.id} attached=${region?.attachment?.token?.id}`);
      const palTemplate = region ? scene.templates.get(region.id) : null;
      ok('1c. it is a TEMPLATE (the ring the table sees) centred on the token, the class\'s 10 feet plus half the token (@scale.paladin.aura — no number in the module)', !!palTemplate && (palTemplate.distance === 12.5) && (palTemplate.x === palTok.x + grid / 2) && (palTemplate.y === palTok.y + grid / 2) && !palTemplate.getFlag('dnd5e', 'origin'), `template=${palTemplate?.id} distance=${palTemplate?.distance} at=(${palTemplate?.x},${palTemplate?.y}) region shape=${region?.shapes?.[0]?.type}`);
      const beh = region?.behaviors?.find(b => b.type === TYPE);
      const change = beh?.system?.effect?.changes?.[0];
      ok('1d. the behaviour carries the pack\'s effect with the PALADIN\'s Charisma resolved in', !!beh && (change?.key === 'system.bonuses.abilities.save') && (String(change?.value) === String(chaMod)), `changes=${JSON.stringify(beh?.system?.effect?.changes)}`);
      await sleep(1500);   // let a second sweep, if one was queued, settle before counting
      const featureRegions = scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature' && r.getFlag(MOD, 'emanation')?.tokenId === palTok.id);
      ok('1e. all three auras stand (Protection, Courage, Warding) — EXACTLY one region each', (featureRegions.length === 3) && ['Aura of Protection', 'Aura of Courage', 'Aura of Warding'].every(k => featureRegions.filter(r => r.getFlag(MOD, 'emanation').key === k).length === 1), featureRegions.map(r => r.name).join(' | '));
      ok('1f. the region itself is invisible — the template draws the ring (the black circle, user 2026-09-03)', region?.visibility === CONST.REGION_VISIBILITY.LAYER, `visibility=${region?.visibility}`);
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
      // A REAL cast, no placement config: the module switches the prompt off and places the area
      // itself (user, 2026-09-03: "it should just put it where the caster's token is").
      try {
        await Promise.race([sgAct.use({ consume: { spellSlot: false, resources: false } }, { configure: false }, { create: true }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('use() did not settle — the placement prompt was not switched off')), 8000))]);
      } catch (err) { log.push(`use(): ${err.message}`); }
      template = await waitFor(() => scene.templates.find(t => t.getFlag('dnd5e', 'origin') === sgAct.uuid) ?? null, 8000);
      ok('6-. the area placed itself on the Cleric — no click: centred on the token, 15 ft plus half the token', !!template && (template.x === clrTok.x + grid / 2) && (template.y === clrTok.y + grid / 2) && (template.distance === 17.5), `template=${template?.id} at=(${template?.x},${template?.y}) distance=${template?.distance} spellLevel=${template?.getFlag('dnd5e', 'spellLevel')}`);
      const conc = [...(cleric.concentration?.effects ?? [])].at(-1);
      ok('6+. …and the Cleric is concentrating on it (the effect the area will end with)', !!conc && (conc.flags?.dnd5e?.activity?.uuid === sgAct.uuid), `conc=${conc?.name} activity=${conc?.flags?.dnd5e?.activity?.uuid}`);
      // Adoption writes the flag first, the behaviour, then the attachment — wait for the last.
      sgRegion = await waitFor(() => { const r = spellRegion('Spirit Guardians'); return r?.attachment?.token ? r : null; }, 8000) ?? spellRegion('Spirit Guardians');
      ok('6a. the template\'s Region is adopted: flagged, attached to the Cleric\'s token', !!sgRegion && (sgRegion.attachment?.token?.id === clrTok.id), `region=${sgRegion?.id} attached=${sgRegion?.attachment?.token?.id} cardsSinceUse=${game.messages.size - b6}`);
      const beh = await waitFor(() => scene.regions.get(sgRegion?.id)?.behaviors?.find(b => b.type === TYPE) ?? null, 4000);
      ok('6b. its behaviour carries Half Speed and the harmful reach', (beh?.system?.reach === 'harmful') && (beh?.system?.effect?.name === 'Half Speed'), `system=${JSON.stringify(beh?.system)}`);
      const vicActor = vicTok.actor;
      const fx = await waitFor(() => memberFx(vicActor, sgRegion?.id)[0] ?? null, 6000);
      ok('6c. the hostile Victim inside is Half Speed — ONE effect, and it wears a status so the token shows it', !!fx && (memberFx(vicActor, sgRegion?.id).length === 1) && (vicActor.system.attributes.movement.walk === Math.floor((vicActor.system._source.attributes.movement.walk ?? 30) / 2)) && vicActor.effects.get(fx.id)?.statuses?.has?.('bfEmanation'), `walk=${vicActor.system.attributes.movement.walk} source=${vicActor.system._source.attributes.movement.walk} fx=${memberFx(vicActor, sgRegion?.id).map(e => e.name).join(',')} statuses=${[...(vicActor.effects.get(fx?.id)?.statuses ?? [])].join(',')}`);
      await sleep(1500);
      ok('6c2. standing inside at the cast, the Victim was asked ONCE — by the cast\'s demand, not by an "enter" trigger', triggerCards().length === 0, `triggerCards=${triggerCards().length} initial=${JSON.stringify(sgRegion?.getFlag(MOD, 'emanation')?.initial)}`);
      const castFlag = game.messages.contents.filter(x => (x.timestamp >= suiteStart) && x.getFlag(MOD, 'saves') && !x.getFlag(MOD, 'saves').pinnedTargets && x.getFlag(MOD, 'saves').activityUuid === sgAct.uuid).at(-1)?.getFlag(MOD, 'saves');
      ok('6c3. the cast\'s demand promises no effect and applies none (Half Speed is the region\'s)', !!castFlag && (castFlag.effectsHandled === 'emanation') && !(castFlag.effectNames?.always?.length), `effectsHandled=${castFlag?.effectsHandled} always=[${castFlag?.effectNames?.always?.join(',')}]`);
      ok('6d. the allied Ranger inside is untouched (designated unaffected by default)', memberFx(ranger, sgRegion?.id).length === 0, memberFx(ranger).map(e => e.name).join(','));
      const sgCard = await waitFor(() => game.messages.find(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationCard')?.key === 'Spirit Guardians') ?? null, 6000);
      ok('6e. a card announced the emanation as cast', !!sgCard, '');
      // The CAST's own save demand (the saves machine's area adoption) reaches enemies only: the
      // Victim owes a save; the Ranger and the Cleric inside the area do not (user, 2026-09-03).
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
      const dmg = await waitFor(() => game.messages.find(m => (m.timestamp >= suiteStart) && (m.getFlag('dnd5e', 'originatingMessage') === card?.id) && (m.getFlag('dnd5e', 'roll.type') === 'damage')) ?? null, 8000);
      ok('7c. the spell\'s damage rolled against the demand (3d8 at 3rd level — the card\'s own chain)', !!dmg && /3d8/.test(dmg.rolls?.[0]?.formula ?? ''), `formula=${dmg?.rolls?.[0]?.formula}`);
      // The TYPE: the pack's part offers necrotic OR radiant; the alignment decides the default
      // (the built Cleric has none → radiant), and the card carries the choice.
      const emCard = game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationCard')?.activityUuid === sgAct.uuid).at(-1);
      const emFlag = emCard?.getFlag(MOD, 'emanationCard');
      ok('7c2. the emanation card offers the two types with radiant as the alignment\'s default', !!emFlag && (emFlag.types?.join(',') === 'necrotic,radiant') && (emFlag.damageType === 'radiant') && !emFlag.chosen, `types=${emFlag?.types} default=${emFlag?.damageType} why="${emFlag?.damageWhy}" alignment="${cleric.system.details?.alignment}"`);
      const cardEl = await waitFor(() => document.querySelector(`[data-message-id="${emCard?.id}"]`) ?? null, 4000);
      ok('7c2b. …and the card RENDERS the two buttons in the log', (cardEl?.querySelectorAll('[data-bf-emanation-type]').length ?? 0) === 2, `buttons=${cardEl?.querySelectorAll('[data-bf-emanation-type]').length ?? 'no element'}`);
      // The CASTING WINDOW carries the choice: open the usage dialog (not awaited — nothing answers
      // it), read the fieldset, close it (the probe-surfaces idiom).
      const pendingUse = sgAct.use({}, { configure: true }, { create: false });
      pendingUse?.catch?.(() => { /* closed below */ });
      const usageApp = await waitFor(() => [...foundry.applications.instances.values()].find(a => /ActivityUsageDialog|UsageDialog/.test(a.constructor?.name ?? '') && a.element?.querySelector?.('[data-bf-emanation-type-field]')) ?? null, 6000);
      const radios = usageApp?.element?.querySelectorAll('input[name="bf-emanation-type"]') ?? [];
      ok('7c2c. the CASTING WINDOW carries the choice — a Battle Flow fieldset with a radio per type, radiant checked', (radios.length === 2) && [...radios].some(r => r.value === 'radiant' && r.checked), `dialog=${usageApp?.constructor?.name} radios=${[...radios].map(r => `${r.value}${r.checked ? '✓' : ''}`).join(',')}`);
      try { await usageApp?.close(); } catch { /* gone */ }
      ok('7c3. the trigger\'s roll wears radiant', (dmg?.rolls?.[0]?.options?.type === 'radiant') && (dmg?.getFlag(MOD, 'emanationType')?.type === 'radiant'), `type=${dmg?.rolls?.[0]?.options?.type} flag=${JSON.stringify(dmg?.getFlag(MOD, 'emanationType'))}`);
      // The caster picks necrotic — as a player would, over the relay envelope — and the next roll wears it.
      if (emCard) {
        await ChatMessage.create({ whisper: [game.user.id], speaker: { alias: 'Battle Flow' }, content: '<p>necrotic</p>', flags: { [MOD]: { emanationTypeAnswer: { cardId: emCard.id, type: 'necrotic' } } } });
        const picked = await waitFor(() => emCard.getFlag(MOD, 'emanationCard')?.chosen ? emCard.getFlag(MOD, 'emanationCard') : null, 6000);
        ok('7c4. the pick folds onto the card over the relay: necrotic, chosen', picked?.damageType === 'necrotic', `flag=${JSON.stringify(picked && { damageType: picked.damageType, chosen: picked.chosen })}`);
      }
      ok('7d. out of combat, the demand is not once-per-turn — no chit is written', !vicActor.effects.some(e => e.getFlag(MOD, 'riderKey') === `emanation:${sgRegion.id}`), '');
      // Now in combat: a turn ended inside, and the once-per-turn.
      await closeDialogs();
      // ⚠ OURS must be `game.combat`: a standing GLOBAL combat (the user's walk, round 4) kept
      // reading as the running one — Foundry prefers it, `activate()` did not displace it — so the
      // Victim was "out of combat" and no chit was written (NOTES: look at game.combats before
      // diagnosing; ask before deleting). Set every other active combat INACTIVE for the run and
      // reactivate it in teardown — reversible, nothing deleted.
      for (const c of game.combats.filter(c => c.active)) { priorActiveCombats.push(c.id); await c.update({ active: false }); }
      // SCENE-BOUND: the Combat dispatches its turn events to the regions of ITS scene — a global
      // (scene-less) combat raised no tokenTurnEnd for the range's emanation (measured).
      combat = await Combat.create({ scene: scene.id, active: true });
      await combat.createEmbeddedDocuments('Combatant', [{ tokenId: clrTok.id, actorId: cleric.id, initiative: 20 }, { tokenId: vicTok.id, actorId: victim.id, initiative: 10 }]);
      await combat.startCombat();
      // `game.combat` IS `ui.combat.viewed` while the tracker is rendered (measured, Foundry
      // 14.365) — the encounter the GM is LOOKING AT, which stayed on the stale one. Point the
      // tracker at ours, as a GM's click would.
      if (game.combat?.id !== combat.id) { try { ui.combat.viewed = combat; } catch (err) { log.push(`tracker: ${err.message}`); } }
      const viewedOk = await waitFor(() => game.combat?.id === combat.id ? true : null, 4000);
      if (!viewedOk) log.push(`⚠ game.combat is still ${game.combat?.id}, not ours (${combat.id})`);
      await sleep(400);
      log.push(`combat ${combat.id} active=${game.combat?.id === combat.id}; others on the range: ${game.combats.filter(c => c.id !== combat.id && c.scene?.id === scene.id).map(c => `${c.id} r${c.round}`).join(', ') || 'none'}`);
      // ONCE PER TURN, within one turn (the Cleric's, initiative 20, round 1): the Victim walks
      // in (a save, a chit stamped with this turn), then out and in again (no second save).
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
      // Then the turns move: the Victim's turn begins and ENDS inside → tokenTurnEnd → a demand
      // (a new turn, so the chit from the Cleric's turn does not block it).
      await combat.nextTurn();     // → the Victim's turn
      await sleep(800);
      await combat.nextTurn();     // the Victim's turn ENDS inside
      const endCard = await waitFor(() => triggerCards().find(m => m.getFlag(MOD, 'emanationTrigger')?.cause === 'turnEnd') ?? null, 8000);
      ok('7e. ending its turn inside raises a save demand (tokenTurnEnd on the GM)', !!endCard, `cards=${triggerCards().length} (was ${n2})`);
      const endDmg = await waitFor(() => game.messages.find(m => (m.timestamp >= suiteStart) && (m.getFlag('dnd5e', 'originatingMessage') === endCard?.id) && (m.getFlag('dnd5e', 'roll.type') === 'damage')) ?? null, 8000);
      ok('7e2. …and its damage wears the chosen type, necrotic', endDmg?.rolls?.[0]?.options?.type === 'necrotic', `type=${endDmg?.rolls?.[0]?.options?.type} chosen=${endDmg?.getFlag(MOD, 'emanationType')?.chosen}`);
      await closeDialogs();
    }

    // ================================================== 8. the template goes
    if (want(8) && sgRegion) {
      const vicActor = vicTok.actor;
      const rid = sgRegion.id;
      const tid = template?.id ?? null;
      // The REAL end: concentration drops, and the system's own dependent cascade takes the
      // template, the template takes its region, the region's going lifts the effect.
      await cleric.endConcentration();
      const gone = await waitFor(() => (!(tid && scene.templates.get(tid)) && !scene.regions.get(rid) && memberFx(vicActor, rid).length === 0) ? true : null, 10000);
      if (!scene.templates.get(tid)) template = null;
      ok('8a. ending concentration deletes the template (its dependent), the region with it, and lifts Half Speed from the Victim', !!gone, `template=${!!(tid && scene.templates.get(tid))} region=${!!scene.regions.get(rid)} fx=${memberFx(vicActor, rid).map(e => e.name).join(',')} walk=${vicActor.system.attributes.movement.walk}`);
    }

    // ================================================== 9. the switch
    if (want(9)) {
      // The setting's own onChange sweeps (no token nudge needed — that is what §9 proves).
      await set('emanations', false);
      const gone = await waitFor(() => (!featureRegion(palTok, 'Aura of Protection') && !scene.templates.some(t => t.getFlag(MOD, 'emanation')?.tokenId === palTok.id)) ? true : null, 8000);
      ok('9a. Emanations off: the standing aura — template and region — is removed from the scene', !!gone, scene.regions.filter(r => r.getFlag(MOD, 'emanation')).map(r => r.name).join(' | '));
      await set('emanations', true);
      const back = await waitFor(() => featureRegion(palTok, 'Aura of Protection'), 8000);
      ok('9b. on again: the aura is raised again', !!back, '');
    }

    // ================================================== 11. the active scene only
    if (want(11)) {
      const ringsUp = () => ['Aura of Protection', 'Aura of Courage', 'Aura of Warding'].every(k => featureRegion(palTok, k));
      const ringsDown = () => !scene.regions.some(r => r.getFlag(MOD, 'emanation')?.kind === 'feature') && !scene.templates.some(t => t.getFlag(MOD, 'emanation')?.kind === 'feature');
      await rgrTok.update(inside, mv());
      const three = await waitFor(() => memberFx(ranger).length === 3 ? true : null, 8000);
      ok('11a. the Ranger inside the ring wears the three auras on the ACTIVE range', !!three, memberFx(ranger).map(e => e.name).join(' | '));
      elsewhere = await Scene.create({ name: 'BF Test Elsewhere', width: 2000, height: 2000, grid: { size: 100, distance: 5 } });
      // The Ranger stands on that scene too — a linked actor, as every PC is — right where a
      // ring would reach nobody. The point: no ring is raised THERE for the Paladin (no Paladin
      // token), and the range's ring must not reach the Ranger through the actor.
      await elsewhere.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(ranger.prototypeToken.toObject(), { x: 500, y: 500, actorId: ranger.id }, { inplace: false })]);
      await elsewhere.activate();
      const lifted = await waitFor(() => (memberFx(ranger).length === 0) ? true : null, 10000);
      ok('11b. another scene made active: the Ranger\'s three effects are LIFTED, though its range token still stands inside the ring', !!lifted, `left=${memberFx(ranger).map(e => e.name).join(',')} active=${game.scenes.active?.name}`);
      const down = await waitFor(() => ringsDown() ? true : null, 10000);
      ok('11c. the range\'s rings — regions and templates — come down: a ring stands on the active scene only', !!down, scene.regions.filter(r => r.getFlag(MOD, 'emanation')).map(r => r.name).join(' | '));
      ok('11d. no ring was raised on the other scene (no Paladin there)', !elsewhere.regions.some(r => r.getFlag(MOD, 'emanation')), '');
      // A ring left standing on an INACTIVE scene (the old code's, or a GM's reload mid-sweep):
      // the ready sweep brings it down. Raised by hand here as the old code would have, with the
      // Ranger's range token inside; the sweep of that scene must lift and delete it.
      const stale = await scene.createEmbeddedDocuments('MeasuredTemplate', [{ t: 'circle', x: palTok.x + grid / 2, y: palTok.y + grid / 2, distance: 12.5, flags: { [MOD]: { emanation: { kind: 'feature', key: 'Aura of Protection', tokenId: palTok.id, itemUuid: paladin.items.find(i => i.name === 'Aura of Protection')?.uuid } } } }]);
      await sleep(800);
      await ranger.createEmbeddedDocuments('ActiveEffect', [{ name: 'Protected — BF Test Paladin (stale)', flags: { [MOD]: { emanation: { regionId: stale[0].id } } } }]);
      Hooks.call(`${MOD}.emanationsChanged`);   // the same everywhere-sweep ready runs
      const swept = await waitFor(() => (!scene.templates.get(stale[0].id) && memberFx(ranger, stale[0].id).length === 0) ? true : null, 10000);
      ok('11e. a stale ring on an inactive scene is brought down by the everywhere-sweep, and the effect it wrote is lifted from the actor', !!swept, `template=${!!scene.templates.get(stale[0].id)} fx=${memberFx(ranger, stale[0].id).length}`);
      await scene.activate();
      const back = await waitFor(() => (ringsUp() && memberFx(ranger).length === 3) ? true : null, 15000);
      await sleep(1500);   // a second sweep, if queued, settles before counting
      ok('11f. the range active again: the rings stand and the Ranger wears the three auras — exactly three, no stack', !!back && (memberFx(ranger).length === 3) && (scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature').length === 3), `fx=${memberFx(ranger).length} rings=${scene.regions.filter(r => r.getFlag(MOD, 'emanation')?.kind === 'feature').length}`);
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

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'emanations', out, plan, f });
