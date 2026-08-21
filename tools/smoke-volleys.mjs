// Battle Flow v1.20.0 (Pass C) smoke test — the volley folds, driven end to end in the live
// world: membership is the REGISTRY (volley-registry.js, finding (ff) — fixtures join it
// through the module api seam and real-name sections pin the shipped entries), the native
// single follow-up is suppressed, the caster's popup aims every projectile (per-ray
// Adv/Normal/Dis under (dd)), darts aggregate per target into ONE roll message (k dice
// groups), rays drive N real attacks through the ordinary pipeline, every driven roll names
// its target on the card ((ee)), the blocklist claim rides the driven rolls, distinct-target
// entries never double up ((ff)/Steel Wind Strike), and expiry fires the even spread.
//
// Harness discipline (HANDOFF): settings restored to whatever was found (settings FIRST in
// teardown, own guard); every message deleted on the way out; new-message searches by
// ID-SET DIFFERENCE; fixture spells are the innate shape (consumption.spellSlot: false —
// the §6 smoke-cast lesson: that is how an NPC casts without slots).
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig, preflightSoleGM } from './target.mjs';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}

setTimeout(() => { console.error('[volleys] WATCHDOG 540s'); process.exit(3); }, 540_000);

const f = new Foundry(foundryConfig(env));
console.log('[volleys] connecting…');
await f.connect();
await preflightSoleGM(f);
console.log('[volleys] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const suiteStart = Date.now();

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.volleys`)) {
    return { fatal: 'setting volleys not registered — this client is running OLD code (F5)' };
  }
  const registry = mod.api?.volleyRegistry;
  if (!registry) return { fatal: 'volley registry api missing — this client is running OLD code (F5)' };

  const SETTING_KEYS = ['volleys', 'autoDamage', 'autoApply', 'playerRollDamage', 'dramaticBeat',
    'damageTimer', 'requireTarget', 'reactionHold', 'blockList', 'riders', 'effectRiders',
    'masteryRiders', 'concMode', 'saves', 'castApply', 'resourceNotices'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const shielder = game.actors.getName('BF Test Shielder');
  const npc = game.actors.getName('BF Test Attacker');
  if (!scene || !victim || !npc || !shielder) return { fatal: 'missing fixture: scene or BF Test actors' };

  const created = { items: [], tokens: [] };
  const priorActor = {};
  // Fixture registry entries — added in §0, deleted on the way out; the SHIPPED entries
  // (Magic Missile, Scorching Ray, Eldritch Blast, Steel Wind Strike) are never touched.
  const TEST_ENTRIES = ['BF Volley Missile', 'BF Volley Up', 'BF Volley Rays', 'BF Volley Unlisted'];
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try { for (const n of TEST_ENTRIES) registry.delete(n); }
    catch (err) { log.push(`TEARDOWN registry ERROR: ${err?.message}`); }
    try {
      for (const [actorId, ids] of Object.entries(created.items.reduce((m, i) => {
        (m[i.actorId] ??= []).push(i.id); return m;
      }, {}))) {
        const a = game.actors.get(actorId);
        const live = ids.filter(id => a?.items.get(id));
        if (live.length) await a.deleteEmbeddedDocuments('Item', live);
      }
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) {
        await game.actors.get(actorId)?.update(data);
      }
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
          || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  // Any DialogV2 whose window title contains the tag — the volley popup's own surface.
  const findDialog = tag => [...foundry.applications.instances.values()]
    .find(a => (a instanceof foundry.applications.api.DialogV2)
      && a.options?.window?.title?.includes?.(tag) && a.rendered);
  const closeStrays = () => {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof foundry.applications.api.DialogV2) void app.close();
      if (app.constructor?.name?.includes('RollConfigurationDialog')) void app.close();
    }
  };
  const fresh = beforeIds => game.messages.contents.filter(m => !beforeIds.has(m.id));
  const snap = () => new Set(game.messages.contents.map(m => m.id));

  try {
    await set('volleys', true);
    await set('autoDamage', 'all');
    await set('autoApply', true);
    await set('playerRollDamage', false);
    await set('dramaticBeat', 0);
    await set('damageTimer', 15);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('blockList', prior.blockList);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('concMode', 'off');
    await set('saves', false);
    await set('castApply', false);
    await set('resourceNotices', false);   // the resources suite owns those asserts

    // Fixture names join the registry through the api seam (the (ff) design's own test
    // surface) — membership is name-keyed, so scratch spells register like premium ones.
    registry.set('BF Volley Missile', { kind: 'damage', count: '2 + @item.level' });
    registry.set('BF Volley Up',      { kind: 'damage', count: '2 + @item.level' });
    registry.set('BF Volley Rays',    { kind: 'attack', count: '1 + @item.level' });

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    const mkToken = async (actor, x) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(),
          { x, y: 1400, actorId: actor.id, actorLink: true }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      return canvas.tokens.get(doc.id);
    };
    const victimToken = await mkToken(victim, 1000);
    const shielderToken = await mkToken(shielder, 1200);
    if (!victimToken || !shielderToken) return { fatal: 'target tokens never reached the canvas' };
    priorActor[victim.id] = { 'system.attributes.hp.value': victim.system._source.attributes.hp.value };
    priorActor[shielder.id] = { 'system.attributes.hp.value': shielder.system._source.attributes.hp.value };

    // The Magic Missile shape: damage activity, count "2 + @item.level", innate consumption
    // (self-uses so the consumed-flag replication has something to record; no slots needed),
    // scaling allowed so §2's upcast takes without slots.
    const [mmItem] = await npc.createEmbeddedDocuments('Item', [{
      name: 'BF Volley Missile', type: 'spell',
      system: {
        level: 1, school: 'evo', properties: ['vocal'],
        range: { value: '120', units: 'ft' },
        method: 'spell', prepared: 1, identifier: 'bf-volley-missile',
        uses: { spent: 0, max: '9', recovery: [{ period: 'lr', type: 'recoverAll' }] },
        target: { affects: { type: 'creature', count: '2 + @item.level' }, template: { type: '' } },
        activities: { bfvolleydarts000: {
          _id: 'bfvolleydarts000', type: 'damage', name: 'Darts',
          activation: { type: 'action' },
          target: { override: false, affects: {}, template: {} },
          damage: { parts: [{ number: 1, denomination: 4, bonus: '1', types: ['force'] }] },
          consumption: { targets: [{ type: 'itemUses', target: '', value: '1' }],
            scaling: { allowed: true, max: '' }, spellSlot: false }
        } }
      }
    }]);
    created.items.push({ actorId: npc.id, id: mmItem.id });
    const mmAct = mmItem.system.activities.contents[0];

    // The Scorching Ray shape: attack activity, count "1 + @item.level", flat +30 so every
    // ray hits, 2d6 fire per ray.
    const [srItem] = await npc.createEmbeddedDocuments('Item', [{
      name: 'BF Volley Rays', type: 'spell',
      system: {
        level: 2, school: 'evo', properties: ['vocal'],
        range: { value: '120', units: 'ft' },
        method: 'spell', prepared: 1, identifier: 'bf-volley-rays',
        target: { affects: { type: 'creature', count: '1 + @item.level' }, template: { type: '' } },
        activities: { bfvolleyrays0000: {
          _id: 'bfvolleyrays0000', type: 'attack', name: 'Rays',
          activation: { type: 'action' },
          target: { override: false, affects: {}, template: {} },
          attack: { type: { value: 'ranged', classification: 'spell' }, bonus: '30', flat: true },
          damage: { includeBase: true, parts: [{ number: 2, denomination: 6, bonus: '', types: ['fire'] }] },
          consumption: { targets: [], scaling: { allowed: false, max: '' }, spellSlot: false }
        } }
      }
    }]);
    created.items.push({ actorId: npc.id, id: srItem.id });
    const srAct = srItem.system.activities.contents[0];

    const targetBoth = () => {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      victimToken.setTarget(true, { releaseOthers: true });
      shielderToken.setTarget(true, { releaseOthers: false });
    };

    // ============================================================ §1 darts, aimed by hand
    log.push('§1 darts');
    targetBoth();
    let before = snap();
    await mmAct.use({}, { configure: false }, {});
    await sleep(1200);
    let msgs = fresh(before);
    const card1 = msgs.find(m => m.getFlag(MOD, 'volley'));
    const v1 = card1?.getFlag(MOD, 'volley');
    ok('1a volley stamps: kind damage, n 3, two targets, pending',
      (v1?.kind === 'damage') && (v1?.n === 3) && (v1?.targets?.length === 2) && (v1?.status === 'pending'),
      JSON.stringify({ kind: v1?.kind, n: v1?.n, t: v1?.targets?.length, s: v1?.status }));
    ok('1b the native single follow-up is suppressed (no damage roll, no stray dialog roll)',
      !msgs.some(m => m.getFlag('dnd5e', 'roll.type') === 'damage'),
      `${msgs.length} new messages`);
    const dlg1 = findDialog('BF Volley Missile');
    ok('1c the caster popup is up with one stepper per target and the bar',
      !!dlg1 && (dlg1.element.querySelectorAll('[data-bf-volley-uuid]').length === 2)
        && !!dlg1.element.querySelector('[data-bf-deadline]'),
      dlg1 ? 'dialog found' : 'NO dialog');
    // (hh), v1.20.0 walk 1 (user, on the dart popup screenshot): "in thee row where it
    // says thomas -- 3" — every dart row leads with its target's token icon, law-8 tooltip.
    ok('1c2 (hh) each dart row leads with its target token icon (tooltip = the name)',
      !!dlg1 && [...dlg1.element.querySelectorAll('[data-bf-volley-uuid]')].every(inp =>
        !!inp.parentElement?.querySelector('img[data-tooltip]')));
    if (dlg1) {
      const steppers = dlg1.element.querySelectorAll('[data-bf-volley-uuid]');
      for (const s of steppers) s.value = (s.dataset.bfVolleyUuid === victim.uuid) ? '2' : '1';
      dlg1.element.querySelector('button[data-action="fire"]')?.click();
    }
    await sleep(2500);
    msgs = fresh(before);
    const dartRolls = msgs.filter(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
      && m.getFlag(MOD, 'volleyFor'));
    const forVictim = dartRolls.find(m => m.getFlag(MOD, 'volleyTarget') === victim.uuid);
    const forShielder = dartRolls.find(m => m.getFlag(MOD, 'volleyTarget') === shielder.uuid);
    ok('1d two aimed damage rolls — one per target, chained to the card',
      (dartRolls.length === 2) && !!forVictim && !!forShielder
        && dartRolls.every(m => m.getFlag('dnd5e', 'originatingMessage') === card1?.id),
      `rolls=${dartRolls.length}`);
    ok('1e dart aggregation: 2 darts = 2 dice groups in ONE message, 1 dart = 1',
      (forVictim?.rolls?.length === 2) && (forShielder?.rolls?.length === 1)
        && forVictim.rolls.every(r => r.formula.includes('1d4')),
      JSON.stringify({ v: forVictim?.rolls?.length, s: forShielder?.rolls?.length }));
    ok('1f each dart roll snapshots exactly its own target',
      ((forVictim?.getFlag('dnd5e', 'targets') ?? []).map(t => t.uuid).join() === victim.uuid)
        && ((forShielder?.getFlag('dnd5e', 'targets') ?? []).map(t => t.uuid).join() === shielder.uuid));
    await sleep(1500);
    ok('1g both rolls applied through the existing spellDamage machinery (receipts per target)',
      !!forVictim?.getFlag(MOD, 'receipt') && !!forShielder?.getFlag(MOD, 'receipt'));
    const v1r = card1?.getFlag(MOD, 'volley');
    ok('1h the flag resolved with the aimed assignment; the card row shows the summary',
      (v1r?.status === 'resolved')
        && (v1r?.assignment?.find(a => a.uuid === victim.uuid)?.count === 2)
        && !!document.querySelector(`[data-message-id="${card1?.id}"] .bf-volley-row`),
      JSON.stringify(v1r?.assignment ?? null));
    // ⚠ Measured ground truth: the system's createConsumedFlag records HIT DICE only and
    // returns void for ordinary uses — Refund Resource's real channel is the usage
    // message's own deltas, which consumption stamps whether or not subsequentActions run.
    ok('1i Refund Resource\'s channel survives the suppression: the usage card carries the consumption deltas',
      !!card1?.system?.deltas?.item && Object.keys(card1.system.deltas.item).length > 0
        && (mmItem.getFlag('dnd5e', 'consumed') == null),
      JSON.stringify(card1?.system?.deltas ?? null));
    // ⚠ the name asserted is the SNAPSHOT's (token name — BF Test Victim's prototype token
    // is named "Hobgoblin"), never the actor name.
    ok('1j (ee) each dart roll names its target on the card — icon with tooltip + name',
      [forVictim, forShielder].every(m =>
        !!document.querySelector(`[data-message-id="${m?.id}"] .bf-volley-aim img[data-tooltip]`)
          && !!document.querySelector(`[data-message-id="${m?.id}"] .bf-volley-aim`)
            ?.textContent.includes((m?.getFlag('dnd5e', 'targets') ?? [])[0]?.name ?? '@@')));

    // ============================================================ §2 upcast — the count scales
    // The REAL channel: a slot pick. The system re-resolves bare `scaling` during consume
    // (measured — it reaches postUse as 0), so the fixture spends an actual 3rd-level slot
    // and the stamp reads the message's own spellLevel.
    log.push('§2 upcast');
    priorActor[npc.id] = {
      ...(priorActor[npc.id] ?? {}),
      'system.spells.spell3': foundry.utils.deepClone(npc.system._source.spells?.spell3 ?? { value: 0, override: null })
    };
    await npc.update({ 'system.spells.spell3.override': 2, 'system.spells.spell3.value': 2 });
    const [upItem] = await npc.createEmbeddedDocuments('Item', [{
      name: 'BF Volley Up', type: 'spell',
      system: {
        level: 1, school: 'evo', properties: ['vocal'],
        range: { value: '120', units: 'ft' },
        method: 'spell', prepared: 1, identifier: 'bf-volley-up',
        target: { affects: { type: 'creature', count: '2 + @item.level' }, template: { type: '' } },
        activities: { bfvolleyup000000: {
          _id: 'bfvolleyup000000', type: 'damage', name: 'Darts',
          activation: { type: 'action' },
          target: { override: false, affects: {}, template: {} },
          damage: { parts: [{ number: 1, denomination: 4, bonus: '1', types: ['force'] }] },
          consumption: { targets: [], scaling: { allowed: true, max: '' }, spellSlot: true }
        } }
      }
    }]);
    created.items.push({ actorId: npc.id, id: upItem.id });
    targetBoth();
    before = snap();
    await upItem.system.activities.contents[0].use(
      { spell: { slot: 'spell3' } }, { configure: false }, {});
    await sleep(1200);
    msgs = fresh(before);
    const card2 = msgs.find(m => m.getFlag(MOD, 'volley'));
    const v2 = card2?.getFlag(MOD, 'volley');
    ok('2a a 3rd-level slot reads 5 darts off the content formula (message spellLevel is the channel)',
      (v2?.n === 5) && (v2?.castLevel === 3) && (card2?.system?.spellLevel === 3),
      JSON.stringify({ n: v2?.n, lvl: v2?.castLevel, msgLvl: card2?.system?.spellLevel }));
    const dlg2 = findDialog('BF Volley Up');
    // The X is "get on with it": closing fires the volley with the default even spread (3/2).
    await dlg2?.close();
    await sleep(2500);
    msgs = fresh(before);
    const upRolls = msgs.filter(m => (m.getFlag('dnd5e', 'roll.type') === 'damage') && m.getFlag(MOD, 'volleyFor'));
    const upV = upRolls.find(m => m.getFlag(MOD, 'volleyTarget') === victim.uuid);
    const upS = upRolls.find(m => m.getFlag(MOD, 'volleyTarget') === shielder.uuid);
    ok('2b closing fired the even spread: 3 dice groups and 2',
      (upV?.rolls?.length === 3) && (upS?.rolls?.length === 2),
      JSON.stringify({ v: upV?.rolls?.length, s: upS?.rolls?.length }));

    // ============================================================ §3 rays — real attacks
    log.push('§3 rays');
    targetBoth();
    before = snap();
    await srAct.use({}, { configure: false }, {});
    await sleep(1200);
    msgs = fresh(before);
    const card3 = msgs.find(m => m.getFlag(MOD, 'volley'));
    const v3 = card3?.getFlag(MOD, 'volley');
    ok('3a volley stamps: kind attack, n 3 — and NO native first ray rolled',
      (v3?.kind === 'attack') && (v3?.n === 3)
        && !msgs.some(m => m.getFlag('dnd5e', 'roll.type') === 'attack'),
      JSON.stringify({ kind: v3?.kind, n: v3?.n, msgs: msgs.length }));
    const dlg3 = findDialog('BF Volley Rays');
    ok('3b the popup offers one target pick per ray',
      !!dlg3 && (dlg3.element.querySelectorAll('[data-bf-volley-ray]').length === 3));
    // (hh) "match that pattern for rays too": each ray row carries its PICK's token icon,
    // and the icon tracks the select (the listener needs a real change event, so dispatch
    // one — a bare .value write never fires it).
    let rayIcon = null;
    if (dlg3) {
      const icon0 = dlg3.element.querySelector('[data-bf-volley-icon="0"]');
      const sel0 = dlg3.element.querySelector('[data-bf-volley-ray="0"]');
      const srcBefore = icon0?.getAttribute('src') ?? null;
      sel0.value = shielder.uuid;
      sel0.dispatchEvent(new Event('change'));
      rayIcon = { present: !!icon0, srcBefore,
        srcAfter: icon0?.getAttribute('src') ?? null,
        tipAfter: icon0?.dataset?.tooltip ?? null,
        wantTip: v3?.targets?.find(t => t.uuid === shielder.uuid)?.name ?? '@@' };
    }
    ok('3b2 (hh) the ray row carries its pick\'s token icon and it TRACKS the select',
      rayIcon?.present === true && !!rayIcon?.srcBefore && !!rayIcon?.srcAfter
        && (rayIcon.srcBefore !== rayIcon.srcAfter) && (rayIcon.tipAfter === rayIcon.wantTip),
      JSON.stringify(rayIcon));
    if (dlg3) {
      const sels = [...dlg3.element.querySelectorAll('[data-bf-volley-ray]')];
      sels[0].value = victim.uuid; sels[1].value = shielder.uuid; sels[2].value = victim.uuid;
      dlg3.element.querySelector('button[data-action="fire"]')?.click();
    }
    await sleep(4500);
    msgs = fresh(before);
    const rays = msgs.filter(m => (m.getFlag('dnd5e', 'roll.type') === 'attack') && m.getFlag(MOD, 'volleyRay'))
      .sort((a, b) => a.getFlag(MOD, 'volleyRay') - b.getFlag(MOD, 'volleyRay'));
    ok('3c three real attacks drove, in ray order, chained to the card',
      (rays.length === 3) && rays.every(m => m.getFlag('dnd5e', 'originatingMessage') === card3?.id),
      `rays=${rays.length}`);
    ok('3d each ray aims exactly its chosen target',
      ((rays[0]?.getFlag('dnd5e', 'targets') ?? []).map(t => t.uuid).join() === victim.uuid)
        && ((rays[1]?.getFlag('dnd5e', 'targets') ?? []).map(t => t.uuid).join() === shielder.uuid)
        && ((rays[2]?.getFlag('dnd5e', 'targets') ?? []).map(t => t.uuid).join() === victim.uuid));
    const rayDamage = msgs.filter(m => (m.getFlag('dnd5e', 'roll.type') === 'damage') && !m.getFlag(MOD, 'volleyFor'));
    ok('3e the ordinary pipeline resolved each hitting ray: three auto-rolled 2d6 damages, receipted',
      (rayDamage.length === 3) && rayDamage.every(m => m.rolls?.[0]?.formula?.includes('2d6'))
        && rayDamage.every(m => !!m.getFlag(MOD, 'receipt')),
      `damage=${rayDamage.length}`);
    ok('3f (ee) each ray attack names its ray and target on the card',
      !!document.querySelector(`[data-message-id="${rays[0]?.id}"] .bf-volley-aim img[data-tooltip]`)
        && !!document.querySelector(`[data-message-id="${rays[0]?.id}"] .bf-volley-aim`)
          ?.textContent.includes('Ray 1'));

    // ============================================================ §4 negatives — never a volley
    log.push('§4 negatives');
    // (a) the switch
    await set('volleys', false);
    targetBoth();
    before = snap();
    await mmAct.use({}, { configure: false }, {});
    await sleep(1500);
    closeStrays();   // the native follow-up parks a damage config dialog — expected, closed
    ok('4a volleys OFF: no volley flag, the native path untouched',
      !fresh(before).some(m => m.getFlag(MOD, 'volley')));
    await set('volleys', true);
    // (b) a single-projectile count — the REGISTRY's count; content counts decide nothing
    registry.set('BF Volley Missile', { kind: 'damage', count: '1' });
    targetBoth();
    before = snap();
    await mmAct.use({}, { configure: false }, {});
    await sleep(1500);
    closeStrays();
    ok('4b registry count 1: not a volley', !fresh(before).some(m => m.getFlag(MOD, 'volley')));
    registry.set('BF Volley Missile', { kind: 'damage', count: '2 + @item.level' });
    // (c) targetless
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
    before = snap();
    await mmAct.use({}, { configure: false }, {});
    await sleep(1500);
    closeStrays();
    ok('4c targetless cast: not a volley (native path keeps it)',
      !fresh(before).some(m => m.getFlag(MOD, 'volley')));
    // (d) the census false positive (Dimension Door's shape): a CONTENT count of 2 with a
    // damage activity, but the name is UNLISTED — never a volley under (ff).
    const [unlisted] = await npc.createEmbeddedDocuments('Item', [{
      name: 'BF Volley Unlisted', type: 'spell',
      system: {
        level: 4, school: 'con', properties: ['vocal'],
        method: 'spell', prepared: 1, identifier: 'bf-volley-unlisted',
        target: { affects: { type: 'willing', count: '2' }, template: { type: '' } },
        activities: { bfvolleyunlist00: {
          _id: 'bfvolleyunlist00', type: 'damage', name: 'Mishap',
          activation: { type: 'action' },
          target: { override: false, affects: {}, template: {} },
          damage: { parts: [{ number: 4, denomination: 6, bonus: '', types: ['force'] }] },
          consumption: { targets: [], scaling: { allowed: false, max: '' }, spellSlot: false }
        } }
      }
    }]);
    created.items.push({ actorId: npc.id, id: unlisted.id });
    targetBoth();
    before = snap();
    await unlisted.system.activities.contents[0].use({}, { configure: false }, {});
    await sleep(1500);
    closeStrays();
    ok('4d an UNLISTED spell with content count 2 + damage never volleys (the Dimension Door pin)',
      !fresh(before).some(m => m.getFlag(MOD, 'volley')));

    // ============================================================ §5 expiry fires the spread
    log.push('§5 expiry');
    await set('damageTimer', 3);
    targetBoth();
    before = snap();
    await mmAct.use({}, { configure: false }, {});
    await sleep(1000);
    const card5 = fresh(before).find(m => m.getFlag(MOD, 'volley'));
    ok('5a pending with a 3s deadline and the public card bar',
      (card5?.getFlag(MOD, 'volley')?.status === 'pending')
        && !!document.querySelector(`[data-message-id="${card5?.id}"] .bf-volley-row [data-bf-deadline]`));
    await sleep(4200);
    const v5 = card5?.getFlag(MOD, 'volley');
    const expRolls = fresh(before).filter(m => (m.getFlag('dnd5e', 'roll.type') === 'damage') && m.getFlag(MOD, 'volleyFor'));
    ok('5b the buzzer fired the even spread: resolved, 2+1 dice groups across two rolls',
      (v5?.status === 'resolved') && (expRolls.length === 2)
        && (expRolls.map(m => m.rolls.length).sort().join() === '1,2'),
      JSON.stringify({ s: v5?.status, rolls: expRolls.map(m => m.rolls.length) }));
    await set('damageTimer', 15);

    // ============================================================ §6 the blocklist claim rides
    // ⚠ VICTIM ONLY: BF Test Shielder exists to hold Shield, and a targeted holder stamps a
    // real spell hold — a different (already-covered) machine. This section pins the claim
    // WIRING on the driven rolls plus the volley's own release when no hold stamps.
    log.push('§6 blocklist claim');
    await set('reactionHold', true);
    await set('blockList', 'BF Volley Missile:Shield');
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
    victimToken.setTarget(true, { releaseOthers: true });
    before = snap();
    await mmAct.use({}, { configure: false }, {});
    await sleep(1000);
    const card6 = fresh(before).find(m => m.getFlag(MOD, 'volley'));
    ok('6a no eligible holder was targeted, so no hold stamped on the card',
      !!card6 && !card6.getFlag(MOD, 'hold'));
    await findDialog('BF Volley Missile')?.close();   // fire the default spread
    await sleep(2500);
    const claimed = fresh(before).filter(m => (m.getFlag('dnd5e', 'roll.type') === 'damage') && m.getFlag(MOD, 'volleyFor'));
    ok('6b the driven dart roll was born with BOTH claims (spellDamage + the hold pending)',
      (claimed.length === 1) && claimed.every(m => (m.getFlag(MOD, 'spellDamage') === true)
        && (m.getFlag(MOD, 'spellHoldPending') !== undefined)),
      JSON.stringify(claimed.map(m => [m.getFlag(MOD, 'spellDamage'), m.getFlag(MOD, 'spellHoldPending')])));
    await sleep(3000);
    ok('6c with no hold on the card, the volley released its own claim and the roll applied',
      claimed.every(m => (m.getFlag(MOD, 'spellHoldPending') === false) && !!m.getFlag(MOD, 'receipt')),
      JSON.stringify(claimed.map(m => [m.getFlag(MOD, 'spellHoldPending'), !!m.getFlag(MOD, 'receipt')])));
    await set('reactionHold', false);
    await set('blockList', prior.blockList);

    // ============================================================ §7 the registry IS membership ((ff))
    log.push('§7 registry');
    ok('7a the shipped registry carries the census four',
      ['Magic Missile', 'Scorching Ray', 'Eldritch Blast', 'Steel Wind Strike'].every(n => registry.has(n)),
      [...registry.keys()].join(', '));
    // Real-name Scorching Ray with NO count field anywhere — the (bb) pin: the 2024 pack
    // ships it bare, and the registry makes it volley anyway.
    const [srReal] = await npc.createEmbeddedDocuments('Item', [{
      name: 'Scorching Ray', type: 'spell',
      system: {
        level: 2, school: 'evo', properties: ['vocal'],
        range: { value: '120', units: 'ft' },
        method: 'spell', prepared: 1, identifier: 'bf-scorching-ray',
        target: { affects: { type: '', count: '' }, template: { type: '' } },
        activities: { bfsrreal00000000: {
          _id: 'bfsrreal00000000', type: 'attack', name: 'Rays',
          activation: { type: 'action' },
          target: { override: false, affects: {}, template: {} },
          attack: { type: { value: 'ranged', classification: 'spell' }, bonus: '30', flat: true },
          damage: { includeBase: true, parts: [{ number: 2, denomination: 6, bonus: '', types: ['fire'] }] },
          consumption: { targets: [], scaling: { allowed: false, max: '' }, spellSlot: false }
        } }
      }
    }]);
    created.items.push({ actorId: npc.id, id: srReal.id });
    targetBoth();
    before = snap();
    await srReal.system.activities.contents[0].use({}, { configure: false }, {});
    await sleep(1200);
    const card7 = fresh(before).find(m => m.getFlag(MOD, 'volley'));
    const v7 = card7?.getFlag(MOD, 'volley');
    ok('7b a BARE Scorching Ray volleys off the shipped entry — 3 rays at 2nd',
      (v7?.kind === 'attack') && (v7?.n === 3) && (v7?.status === 'pending'),
      JSON.stringify({ kind: v7?.kind, n: v7?.n }));
    await findDialog('Scorching Ray')?.close();   // fire the default spread
    await sleep(4500);
    const rays7 = fresh(before).filter(m => (m.getFlag('dnd5e', 'roll.type') === 'attack') && m.getFlag(MOD, 'volleyRay'));
    ok('7c its three rays drove for real', rays7.length === 3, `rays=${rays7.length}`);
    // Eldritch Blast's beams band by CHARACTER level — the count fn, pinned pure (no world
    // actor carries EB; the machinery it rides is the same evaluator §7b just exercised).
    const eb = registry.get('Eldritch Blast');
    const beams = (level, cr = null) => eb.count({ rollData: { details: { level, ...(cr != null ? { cr } : {}) } } });
    ok('7d EB bands: 1 beam to 4th, 2 at 5th, 3 at 11th, 4 at 17th — and CR carries an NPC',
      (beams(4) === 1) && (beams(5) === 2) && (beams(11) === 3) && (beams(17) === 4)
        && (beams(20) === 4) && (beams(0, 7) === 2),
      JSON.stringify([beams(4), beams(5), beams(11), beams(17), beams(0, 7)]));

    // ============================================================ §8 distinct targets (Steel Wind Strike)
    log.push('§8 distinct');
    const [sws] = await npc.createEmbeddedDocuments('Item', [{
      name: 'Steel Wind Strike', type: 'spell',
      system: {
        level: 5, school: 'con', properties: ['somatic'],
        range: { value: '30', units: 'ft' },
        method: 'spell', prepared: 1, identifier: 'bf-steel-wind',
        target: { affects: { type: '', count: '' }, template: { type: '' } },
        activities: { bfswstrike000000: {
          _id: 'bfswstrike000000', type: 'attack', name: 'Flurry',
          activation: { type: 'action' },
          target: { override: false, affects: {}, template: {} },
          attack: { type: { value: 'melee', classification: 'spell' }, bonus: '30', flat: true },
          damage: { includeBase: true, parts: [{ number: 1, denomination: 6, bonus: '', types: ['force'] }] },
          consumption: { targets: [], scaling: { allowed: false, max: '' }, spellSlot: false }
        } }
      }
    }]);
    created.items.push({ actorId: npc.id, id: sws.id });
    targetBoth();
    before = snap();
    await sws.system.activities.contents[0].use({}, { configure: false }, {});
    await sleep(1200);
    const card8 = fresh(before).find(m => m.getFlag(MOD, 'volley'));
    const v8 = card8?.getFlag(MOD, 'volley');
    ok('8a n clamps to the target count and the flag says distinct — 2 targets, 2 rays, not 5',
      (v8?.n === 2) && (v8?.distinct === true), JSON.stringify({ n: v8?.n, d: v8?.distinct }));
    const dlg8 = findDialog('Steel Wind Strike');
    if (dlg8) {
      // Duplicate picks must fall back to the one-each default, never fire doubled.
      for (const sel of dlg8.element.querySelectorAll('[data-bf-volley-ray]')) sel.value = victim.uuid;
      dlg8.element.querySelector('button[data-action="fire"]')?.click();
    }
    await sleep(4000);
    const rays8 = fresh(before).filter(m => (m.getFlag('dnd5e', 'roll.type') === 'attack') && m.getFlag(MOD, 'volleyRay'));
    const targets8 = rays8.map(m => (m.getFlag('dnd5e', 'targets') ?? [])[0]?.uuid).sort();
    ok('8b duplicate picks fell back to one-each: two attacks, DISTINCT targets',
      (rays8.length === 2) && (new Set(targets8).size === 2),
      JSON.stringify(targets8));

    // ============================================================ §9 per-ray adv/dis ((dd))
    log.push('§9 adv/dis');
    targetBoth();
    before = snap();
    await srAct.use({}, { configure: false }, {});
    await sleep(1200);
    const dlg9 = findDialog('BF Volley Rays');
    ok('9a the popup offers a mode select per ray',
      !!dlg9 && (dlg9.element.querySelectorAll('[data-bf-volley-mode]').length === 3));
    if (dlg9) {
      dlg9.element.querySelector('[data-bf-volley-mode="0"]').value = 'advantage';
      dlg9.element.querySelector('[data-bf-volley-mode="1"]').value = 'disadvantage';
      dlg9.element.querySelector('button[data-action="fire"]')?.click();
    }
    await sleep(4500);
    const rays9 = fresh(before).filter(m => (m.getFlag('dnd5e', 'roll.type') === 'attack') && m.getFlag(MOD, 'volleyRay'))
      .sort((a, b) => a.getFlag(MOD, 'volleyRay') - b.getFlag(MOD, 'volleyRay'));
    // dnd5e renders its advantage modifier as 2d20adv / 2d20dis (its own alias, not kh/kl).
    ok('9b ray 1 rolled at advantage, ray 2 at disadvantage, ray 3 a bare d20',
      (rays9.length === 3)
        && /2d20(adv|kh)/.test(rays9[0]?.rolls?.[0]?.formula ?? '')
        && /2d20(dis|kl)/.test(rays9[1]?.rolls?.[0]?.formula ?? '')
        && (rays9[2]?.rolls?.[0]?.formula ?? '').includes('1d20'),
      JSON.stringify(rays9.map(m => m.rolls?.[0]?.formula ?? null)));
    const v9 = fresh(before).find(m => m.getFlag(MOD, 'volley'))?.getFlag(MOD, 'volley');
    ok('9c the resolved assignment carries the modes (and normal carries none)',
      (v9?.assignment?.[0]?.mode === 'advantage') && (v9?.assignment?.[1]?.mode === 'disadvantage')
        && (v9?.assignment?.[2]?.mode === undefined),
      JSON.stringify(v9?.assignment ?? null));

    await teardown();
  } catch (err) {
    log.push(`SUITE ERROR: ${err?.stack ?? err}`);
    await teardown();
  }
  return { results, log };
});

if (out.fatal) { console.error(`[volleys] FATAL: ${out.fatal}`); process.exit(2); }
let pass = 0, fail = 0;
for (const r of out.results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
  r.pass ? pass++ : fail++;
}
for (const l of out.log) console.log(`  · ${l}`);
console.log(`\n[volleys] ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
