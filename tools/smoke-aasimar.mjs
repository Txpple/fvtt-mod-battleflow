// Battle Flow Aasimar smoke test — CELESTIAL REVELATION AND THE TOKEN LIGHTS (the Aasimar walk,
// 2026-09-25: "the transformations create a region/template, and i have to place it. it should
// always just be centered on the token"; "inner radiance needs to pulse"; "necrotic shroud - put
// the fix in the vendor fixes sister repo … implement the ability correctly"; "extra damage for
// revelation - you need to add this in"; "inner radiance - add the bright/dim light settings …
// edit the Light spell so it adds light emission to a token target as well").
//
// Fixtures: BF Test Halfling (Rogue 3 — Proficiency Bonus 2, a Shortsword; friendly) is lent the
// PHB's Celestial Revelation, Light and Sacred Flame for the run; BF Test Victim (hostile) and BF
// Test Ranger (friendly) stand beside it. All three linked, tokens placed on the Battle Flow Test
// Range for the run. Built by tools/fixture-suite.mjs.
//
// Harness discipline: every setting touched is restored; the lent items, the effects, the tokens,
// the regions, the combat and the messages this run creates are deleted.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs): the machines this suite drives — a change to one
// re-runs it under `battery.mjs --changed`. Spine files are never claimed: their change is the
// full battery. `npm run coverage` checks the claims both ways. Exported only so the linter reads
// it as the declaration it is: ⚠ NEVER import a suite (it connects on evaluation) — the map is parsed.
export const COVERS = [
  'token-lights.js',        // §2, §7 — Searing Radiance with its light, the Light spell on a token
  'emanations.js',          // §1, §2, §4, §6 — the self area placed on the token, the `while` ring, the pulse
  'clock-riders.js',        // §1, §3, §5 — the form chip, the Revelation rider on a hit and on a spell
  'saves/demand.js'         // §1 — an `enemy` area asks no ally
];

const SECTIONS = {
  1: 'Necrotic Shroud: no placement — the area lands on the token by itself; its save asks the hostile beside it and NOT the ally; the form chip marks the Aasimar; the failed save\'s Frightened ends at the end of the Aasimar\'s next turn (VF-002, when Vendor Fixes is on); a hit then carries +PB NECROTIC',
  2: 'Inner Radiance: the use places no area and rolls no damage; Searing Radiance lands on the Aasimar with 10 ft Bright / 20 ft Dim on its token, and the 10-ft ring stands on it, announced',
  3: 'a spell with no attack roll (Sacred Flame): once its damage lands, its card offers +PB radiant to ONE damaged target; the pick lands on its own card with a receipt',
  4: 'the pulse: the Aasimar\'s turn ends in combat — every creature within 10 ft, the ally included, takes PB radiant on one card with receipts; the Aasimar does not',
  5: 'a weapon hit in combat carries +PB RADIANT once; the second hit the same turn carries none',
  6: 'the transformation ends (Searing Radiance removed): the ring comes down and the token\'s light goes',
  7: 'the Light spell at a targeted token: no summon, a "Light" effect with 20 ft Bright / 40 ft Dim on its token; cast again at another, the first light goes out'
};
const DEPENDS = { 3: [2], 4: [2], 5: [2], 6: [2] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'aasimar', watchdogMs: 600_000 });
announcePlan('aasimar', plan, pulled);

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

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.tokenLightList`)) return { fatal: 'tokenLightList not registered — OLD code (restart the box)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'holdTimer', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'saves', 'saveTimer', 'castApply',
    'concMode', 'reminderList', 'clockRiderList', 'damageEitherList', 'emanations', 'emanationList', 'tokenLightList', 'metamagicList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const aas = game.actors.getName('BF Test Halfling');
  const ally = game.actors.getName('BF Test Ranger');
  if (!scene || !victim || !aas || !ally) return { fatal: 'missing fixture: scene, BF Test Victim, BF Test Halfling or BF Test Ranger — run tools/fixture-suite.mjs' };

  const created = { tokens: [], items: [] };
  const priorActor = {};
  let combat = null;
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const realDice = () => { CONFIG.Dice.randomUniform = realPRNG; };
  const ours = e => e.getFlag(MOD, 'tokenLight') || e.getFlag(MOD, 'formChip') || e.getFlag(MOD, 'mastery')
    || /^(Searing Radiance|Heavenly Wings|Necrotic Shroud|Light)$/.test(e.name) || /Celestial Revelation|used this turn/.test(e.name);
  const clearEffects = async () => {
    for (const a of [victim, aas, ally]) {
      const live = a.effects.filter(ours).map(e => e.id).filter(id => a.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
    }
  };
  const areaRegions = () => scene.regions.filter(r => {
    const item = r.getFlag('dnd5e', 'item') ?? r.getFlag(MOD, 'emanation')?.itemUuid ?? '';
    return created.items.some(([, id]) => String(item).endsWith(`Item.${id}`));
  });
  const teardown = async () => {
    if (restored) return;
    restored = true;
    realDice();
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await clearEffects();
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      for (const r of areaRegions()) await r.delete().catch(() => {});
      for (const [actorId, ids] of Object.entries(created.items.reduce((m, [a, id]) => ((m[a] ??= []).push(id), m), {}))) {
        const actor = game.actors.get(actorId);
        const live = ids.filter(id => actor?.items.get(id));
        if (live.length) await actor.deleteEmbeddedDocuments('Item', live);
      }
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow' || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('autoDamage', 'all');
    await set('autoApply', true);
    await set('playerRollDamage', false);
    await set('damageTimer', 1);      // a due rider opens the damage offer; its clock rolls it
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('holdTimer', 0);
    await set('riders', false);
    await set('effectRiders', true);
    await set('masteryRiders', false);
    await set('masteryAsk', false);
    await set('saves', true);
    await set('saveTimer', 2);        // nobody answers: the buzzer rolls, the dice are the suite's
    await set('castApply', true);
    await set('concMode', 'off');
    await set('reminderList', '');
    await set('damageEitherList', '');   // the Halfling's Savage Attacker would pause every hit
    await set('metamagicList', '');
    await set('clockRiderList', def('clockRiderList'));
    await set('emanations', true);
    await set('emanationList', def('emanationList'));
    await set('tokenLightList', def('tokenLightList'));

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => [victim.id, aas.id].includes(t.actorId)).map(t => t.id);
    if (strays.length) await scene.deleteEmbeddedDocuments('Token', strays);
    const px = scene.grid.size / scene.grid.distance;
    const placeToken = async (actor, x, y) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const g = scene.grid.size;
    const { doc: aasDoc, token: aasToken } = await placeToken(aas, 15 * g, 17 * g);
    const { doc: victimDoc, token: victimToken } = await placeToken(victim, 14 * g, 17 * g);
    const { doc: allyDoc, token: allyToken } = await placeToken(ally, 16 * g, 17 * g);
    log.push(`dispositions aas=${aasDoc.disposition} victim=${victimDoc.disposition} ally=${allyDoc.disposition}; PB ${aas.system.attributes.prof}`);
    const pb = Number(aas.system.attributes.prof);

    for (const a of [victim, ally]) {
      priorActor[a.id] = { 'system.attributes.hp.value': a.system._source.attributes.hp.value, 'system.attributes.hp.max': a.system._source.attributes.hp.max,
        'system.attributes.ac.override': a.system._source.attributes.ac.override ?? null };
      await a.update({ 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400, 'system.attributes.ac.override': 10 });
    }
    const healAll = async () => { for (const a of [victim, ally]) await a.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 }); };

    // The lent items, from the packs a player's would come from.
    const lend = async (packId, name) => {
      const pack = game.packs.get(packId);
      const entry = (await pack.getIndex()).find(e => e.name === name);
      if (!entry) throw new Error(`${name} not in ${packId}`);
      const doc = await pack.getDocument(entry._id);
      const [item] = await aas.createEmbeddedDocuments('Item', [doc.toObject()]);
      created.items.push([aas.id, item.id]);
      return item;
    };
    await clearEffects();
    const rev = await lend('dnd-players-handbook.origins', 'Celestial Revelation');
    const light = await lend('dnd-players-handbook.spells', 'Light');
    const flame = await lend('dnd-players-handbook.spells', 'Sacred Flame');
    const actNamed = (item, n) => item.system.activities.find(a => a.name === n);
    const shroudAct = actNamed(rev, 'Necrotic Shroud');
    const irAct = actNamed(rev, 'Inner Radiance');
    const freshUse = async () => rev.update({ 'system.uses.spent': 0 });

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const cardEl = id => document.querySelector(`.message[data-message-id="${id}"]`);
    const use = async (activity, config = {}) => {
      aasToken.control({ releaseOthers: true });
      let settled = false;
      const res = await Promise.race([
        activity.use({ consume: { spellSlot: false }, ...config }, { configure: false }, { create: true }).then(r => { settled = true; return r; }),
        sleep(8000).then(() => null)
      ]).catch(err => { log.push(`use(${activity.name}): ${err?.message}`); return null; });
      return { res, settled };
    };
    const target = (...tokens) => {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      tokens.forEach((t, i) => t.setTarget(true, { releaseOthers: i === 0 }));
    };
    const shortsword = aas.items.find(i => (i.type === 'weapon') && (i.name === 'Shortsword'));
    const swordAct = shortsword?.system.activities.find(a => a.type === 'attack');
    const damageFor = originId => game.messages.contents.find(m => (m.type === 'damage') && (m._source.system?.origin === originId));
    const swing = async () => {
      aasToken.control({ releaseOthers: true });
      target(victimToken);
      await sleep(80);
      faces([[15, 20], [3, 6]]);
      const results = await swordAct.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await swordAct.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'system.origin': results.message.id } } : {});
      const attackMsg = rolls?.[0]?.parent ?? null;
      const originId = attackMsg?._source.system?.origin ?? attackMsg?.id;
      const dmg = await waitFor(() => damageFor(originId), 15000);
      realDice();
      if (!dmg) log.push(`swing: no damage message for ${originId}`);
      return dmg;
    };
    const revRider = dmg => (dmg?.getFlag(MOD, 'clockRiders')?.riders ?? []).find(r => r.key === 'celestial-revelation') ?? null;
    const ring = () => scene.regions.find(r => (r.getFlag(MOD, 'emanation')?.key === 'Inner Radiance') && (r.getFlag(MOD, 'emanation')?.tokenId === aasDoc.id)) ?? null;
    const lightOf = doc => ({ bright: scene.tokens.get(doc.id)?.light?.bright ?? null, dim: scene.tokens.get(doc.id)?.light?.dim ?? null });

    // ================================================== 1. Necrotic Shroud
    if (want(1)) {
      await freshUse();
      target();
      faces([[1, 20]]);   // the victim's save, when the buzzer rolls it
      const { settled } = await use(shroudAct);
      ok('1a. the use settles with no placement click (the prompt is off for a self-centered area)', settled, '');
      const area = await waitFor(() => scene.regions.find(r => r.getFlag('dnd5e', 'activity') === shroudAct.uuid) ?? null, 8000);
      const shape = area?.shapes?.[0];
      ok('1b. the area is on the Aasimar\'s token — an attached emanation, 10 ft from the edge, never drawn (the ring ruling reaches every area placed on a token)',
        !!area && (area.attachment?.token?.id === aasDoc.id) && (shape?.type === 'emanation') && (shape?.radius === 10 * px) && (area.visibility === CONST.REGION_VISIBILITY.LAYER_UNLOCKED) && area.locked,
        `area=${area?.id} attached=${area?.attachment?.token?.id} shape=${JSON.stringify(shape)} visibility=${area?.visibility}`);
      const demand = await waitFor(() => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'saves')?.activityUuid === shroudAct.uuid)).at(-1)?.getFlag(MOD, 'saves')?.targets?.length
        ? game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'saves')?.activityUuid === shroudAct.uuid)).at(-1) : null, 10000);
      const names = demand?.getFlag(MOD, 'saves')?.targets?.map(t => t.name) ?? [];
      ok('1c. the save asks the hostile beside the Aasimar and NOT the ally or the Aasimar ("creatures other than your allies")',
        names.includes(victimDoc.name) && !names.includes(allyDoc.name) && !names.includes(aasDoc.name), `targets=[${names.join(', ')}]`);
      const chip = await waitFor(() => aas.effects.find(e => e.getFlag(MOD, 'formChip')?.form === 'necrotic shroud') ?? null, 6000);
      ok('1d. the form chip marks the Aasimar: "Celestial Revelation: Necrotic Shroud", the transformation\'s minute',
        !!chip && (chip.name === 'Celestial Revelation: Necrotic Shroud') && (chip.duration?.seconds === 60 || chip.duration?.value === 1 || chip._source.duration?.value === 1),
        `chip=${chip?.name} duration=${JSON.stringify(chip?._source?.duration)}`);
      const frightened = await waitFor(() => victim.effects.find(e => (e.name === 'Necrotic Shroud') && e.statuses.has('frightened')) ?? null, 15000);
      realDice();
      const vf = game.modules.get('fvtt-mod-vendorfixes');
      const vfOn = !!vf?.active && !!game.settings.settings.get('fvtt-mod-vendorfixes.necroticShroudClock') && game.settings.get('fvtt-mod-vendorfixes', 'necroticShroudClock');
      if (vfOn) {
        ok('1e. the failed save frightens — and (VF-002) until the end of the Aasimar\'s next turn: expiry sourceEnd',
          !!frightened && (frightened._source.duration?.expiry === 'sourceEnd'), `effect=${frightened?.name} duration=${JSON.stringify(frightened?._source?.duration)}`);
      } else {
        ok('1e. the failed save frightens (Vendor Fixes VF-002 is off or absent here — the clock is the pack\'s)', !!frightened,
          `vendorfixes active=${vf?.active} duration=${JSON.stringify(frightened?._source?.duration)}`);
      }
      const dmg = await swing();
      const r = revRider(dmg);
      ok(`1f. a weapon hit while the Shroud stands carries +${pb} NECROTIC (the form's type)`, !!r && (r.type === 'necrotic') && (String(r.formula) === String(pb)),
        `rider=${JSON.stringify(r)}`);
      for (const x of scene.regions.filter(r2 => r2.getFlag('dnd5e', 'activity') === shroudAct.uuid)) await x.delete().catch(() => {});
      await clearEffects();
      await healAll();
    }

    // ================================================== 2. Inner Radiance
    let searing = null;
    if (want(2)) {
      await freshUse();
      target(victimToken);
      const before = new Set(game.messages.map(m => m.id));
      const baseLight = lightOf(aasDoc);
      const trace = Hooks.on('dnd5e.preRollDamageV2', config => { if (config?.subject?.name === 'Inner Radiance') log.push(`IR damage roll from: ${new Error().stack.split('\n').slice(2, 14).join(' | ')}`); });
      const { settled } = await use(irAct);
      setTimeout(() => Hooks.off('dnd5e.preRollDamageV2', trace), 4000);
      ok('2a. the transform settles with no placement click', settled, '');
      searing = await waitFor(() => aas.effects.find(e => (e.name === 'Searing Radiance') && e.getFlag(MOD, 'tokenLight')) ?? null, 8000);
      const keys = (searing?.system?.changes ?? []).map(c => `${c.key}=${c.value}`);
      ok('2b. Searing Radiance lands on the Aasimar carrying the light (token.light.bright 10, token.light.dim 20)',
        !!searing && keys.includes('token.light.bright=10') && keys.includes('token.light.dim=20'), `effect=${searing?.name} changes=[${keys.join(', ')}]`);
      const lit = await waitFor(() => (lightOf(aasDoc).bright === 10) ? lightOf(aasDoc) : null, 5000);
      ok('2c. the token itself sheds it: 10 ft Bright, 20 ft Dim', !!lit && (lit.dim === 20), `light=${JSON.stringify(lightOf(aasDoc))} before=${JSON.stringify(baseLight)}`);
      const rg = await waitFor(() => ring()?.behaviors?.find(b => b.type === `${MOD}.emanation`) ? ring() : null, 8000);
      ok('2d. the 10-ft ring stands on the Aasimar (reach every creature) while Searing Radiance does',
        !!rg && (rg.shapes?.[0]?.radius === 10 * px) && (rg.behaviors.find(b => b.type === `${MOD}.emanation`)?.system?.reach === 'all'),
        `ring=${rg?.id} radius=${rg?.shapes?.[0]?.radius} reach=${rg?.behaviors.find(b => b.type === `${MOD}.emanation`)?.system?.reach}`);
      await sleep(1500);
      const fresh = game.messages.filter(m => !before.has(m.id));
      const damageRolls = fresh.filter(m => m.type === 'damage');
      const placed = scene.regions.filter(r => r.getFlag('dnd5e', 'activity') === irAct.uuid);
      ok('2e. no damage at the transform and no area placed for it (the pulse is the damage; the ring is the area)',
        !damageRolls.length && !placed.length && !victim.effects.some(e => e.name === 'Searing Radiance'),
        `damage=${damageRolls.length} placed=${placed.length} ${damageRolls.map(m => `[${m.getAssociatedActivity?.()?.item?.name}/${m.getAssociatedActivity?.()?.name} flags=${Object.keys(m.flags?.[MOD] ?? {}).join(',')} origin=${m._source.system?.origin}]`).join(' ')}`);
      const card = fresh.find(m => m.getFlag(MOD, 'emanationCard')?.key === 'Inner Radiance');
      ok('2f. the ring is announced, naming the pulse', !!card && /end of your turns/.test(textOf(cardEl(card.id)) || card.content), (card?.content ?? '').replace(/<[^>]+>/g, ' ').slice(0, 200));
      const useCard = fresh.find(m => m.getFlag(MOD, 'tokenLight'));
      ok('2g. the use\'s card says the light landed (Token light) and carries the effect receipt', !!useCard?.getFlag(MOD, 'tokenLight')?.landed?.length && !!useCard?.getFlag(MOD, 'effectReceipt'),
        JSON.stringify(useCard?.getFlag(MOD, 'tokenLight')));
    }

    // ================================================== 3. a spell's damage, the ONE target
    if (want(3) && searing) {
      await healAll();
      target(victimToken);
      faces([[1, 20]]);   // every die its lowest: the victim's save fails, the flame deals 1
      await use(flame.system.activities.find(a => a.type === 'save'));
      const spellDmg = await waitFor(() => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.type === 'damage') && (m.getFlag(MOD, 'receipt')?.targets?.length)
        && (m.getAssociatedActivity?.()?.item?.name === 'Sacred Flame')).at(-1) ?? null, 15000);
      realDice();
      ok('3a. Sacred Flame\'s damage landed on the victim (a receipt on its damage card)', !!spellDmg, '');
      const offer = await waitFor(() => [...(cardEl(spellDmg?.id)?.querySelectorAll('button') ?? [])].find(b => textOf(b) === victimDoc.name) ?? null, 5000);
      ok(`3b. the card offers +${pb} radiant to one damaged target — a button per creature`, !!offer && /Celestial Revelation — \+\d+ radiant to one target/.test(textOf(cardEl(spellDmg?.id))),
        textOf(cardEl(spellDmg?.id)).slice(-240));
      const hp0 = victim.system.attributes.hp.value;
      offer?.click();
      const riderCard = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'spellRiderCard') && m.getFlag(MOD, 'receipt')) ?? null, 8000);
      const taken = riderCard?.getFlag(MOD, 'receipt')?.targets?.[0]?.taken;
      ok(`3c. the pick lands ${pb} radiant on the victim on its own card, with a receipt`, (taken === pb) && (victim.system.attributes.hp.value === hp0 - pb), `taken=${taken} hp ${hp0}→${victim.system.attributes.hp.value}`);
      const named = await waitFor(() => { const t = textOf(cardEl(spellDmg?.id)); return (!/to one target \(/.test(t) && /Celestial Revelation — \+\d+ radiant to/.test(t)) ? t : null; }, 6000);
      ok('3d. the offer is gone and the spell\'s card names where the extra went', !!named,
        `flag=${JSON.stringify(game.messages.get(spellDmg?.id)?.getFlag(MOD, 'spellRider'))} text=${textOf(cardEl(spellDmg?.id)).slice(0, 400)}`);
    }

    // ================================================== 4. the pulse
    if (want(4) && searing) {
      await healAll();
      if (game.combat) await game.combat.delete();
      combat = await Combat.create({ scene: scene.id });
      await combat.createEmbeddedDocuments('Combatant', [
        { actorId: aas.id, tokenId: aasDoc.id, sceneId: scene.id, initiative: 20 },
        { actorId: victim.id, tokenId: victimDoc.id, sceneId: scene.id, initiative: 10 },
        { actorId: ally.id, tokenId: allyDoc.id, sceneId: scene.id, initiative: 5 }]);
      await combat.startCombat();
      await sleep(600);
      ok('4-. the Aasimar has the turn', combat.combatant?.actorId === aas.id, `current=${combat.combatant?.name}`);
      await combat.nextTurn();
      const pulseCard = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationPulse') && m.getFlag(MOD, 'receipt')?.targets?.length >= 2) ?? null, 10000);
      const rec = pulseCard?.getFlag(MOD, 'receipt')?.targets ?? [];
      const byName = Object.fromEntries(rec.map(t => [t.name, t.taken]));
      ok(`4a. the turn ended: ONE card, every creature within 10 ft takes ${pb} radiant — the hostile AND the ally`,
        (byName[victimDoc.name] === pb) && (byName[allyDoc.name] === pb), JSON.stringify(byName));
      ok('4b. the Aasimar takes none of its own light', !(aasDoc.name in byName), JSON.stringify(Object.keys(byName)));
      await sleep(1200);
      const again = game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationPulse'));
      ok('4c. once per ended turn — one pulse card, however the update echoes', again.length === 1, `cards=${again.length}`);
      await combat.nextTurn(); await sleep(1000);   // the victim's turn ends — no pulse
      ok('4d. another creature\'s turn ending pays nothing', game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'emanationPulse')).length === 1, '');
    }

    // ================================================== 5. the rider on a hit, once per turn
    if (want(5) && searing) {
      await healAll();
      const first = await swing();
      const r1 = revRider(first);
      ok(`5a. a hit carries +${pb} RADIANT (Inner Radiance's type)`, !!r1 && (r1.type === 'radiant') && (String(r1.formula) === String(pb)), JSON.stringify(r1));
      if (combat) {
        const second = await swing();
        ok('5b. in combat, the second hit the same turn carries none (the rider chit)', !!second && !revRider(second), `dmg=${!!second} rider=${JSON.stringify(revRider(second))}`);
      }
    }

    // ================================================== 6. the transformation ends
    if (want(6) && searing) {
      if (combat && game.combats.get(combat.id)) { await combat.delete(); combat = null; }
      const live = aas.effects.find(e => e.name === 'Searing Radiance');
      if (live) await live.delete();
      const gone = await waitFor(() => !ring(), 8000);
      ok('6a. the ring comes down with the transformation', gone, `ring=${ring()?.id}`);
      const dark = await waitFor(() => lightOf(aasDoc).bright !== 10, 5000);
      ok('6b. the token\'s light goes with the effect', dark, JSON.stringify(lightOf(aasDoc)));
    }

    // ================================================== 7. the Light spell on a token
    if (want(7)) {
      const act = light.system.activities.contents[0];
      const lightActorsBefore = scene.tokens.filter(t => /^Light/.test(t.name)).length;
      target(victimToken);
      await use(act);
      const onVictim = await waitFor(() => victim.effects.find(e => e.getFlag(MOD, 'tokenLight')?.key === 'Light') ?? null, 8000);
      const vl = await waitFor(() => (lightOf(victimDoc).bright === 20) ? lightOf(victimDoc) : null, 5000);
      ok('7a. the targeted token wears "Light" and sheds 20 ft Bright, 40 ft Dim', !!onVictim && !!vl && (vl.dim === 40),
        `effect=${onVictim?.name} light=${JSON.stringify(lightOf(victimDoc))} duration=${JSON.stringify(onVictim?._source?.duration)}`);
      await sleep(800);
      ok('7b. cast at a token, nothing is summoned', scene.tokens.filter(t => /^Light/.test(t.name)).length === lightActorsBefore, '');
      target(allyToken);
      await use(act);
      const onAlly = await waitFor(() => ally.effects.find(e => e.getFlag(MOD, 'tokenLight')?.key === 'Light') ?? null, 8000);
      const out = await waitFor(() => !victim.effects.some(e => e.getFlag(MOD, 'tokenLight')?.key === 'Light'), 5000);
      ok('7c. cast again at the ally: the ally is lit and the victim\'s light is out ("the spell ends if you cast it again")', !!onAlly && out,
        `ally=${onAlly?.name} victimStill=${!out} victimLight=${JSON.stringify(lightOf(victimDoc))}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'aasimar', out, plan, f });
