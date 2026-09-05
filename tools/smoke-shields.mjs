// Battle Flow damage-shield smoke test — THE HIT RIDER MIRRORED (user, 2026-09-04: "death armor
// needs its damage shield effect automated"): a standing ward on the DEFENDER pays out against
// the ATTACKER when a melee attack roll hits it. Fire Shield's warm and chill shields (the type
// follows the effect that stands), Death Armor cast by one creature on ANOTHER (the walk from the
// ward to the caster's spell; once per turn as a chit on the defender), Armor of Agathys (no pack
// effect — the module marks the cast, strikes while the temp HP stand, ends the mark with them),
// the reach as the activity's own, a ranged hit striking nothing, the list as the switch.
//
// Fixtures: BF Test Cleric (the warded caster, linked), BF Test Ranger (Death Armor's warded ally,
// linked), BF Test Attacker (the goblin that hits them). The spells are added to the Cleric from
// the packs for the run and removed after. Built by tools/fixture-suite.mjs.
//
// Harness discipline: every setting touched is restored; every message this run creates is
// deleted; the items it adds are removed; the effects it writes are cleared; the tokens it
// places are removed; the pools it changes are put back; its combat is deleted.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'Fire Shield (warm): a melee hit from 5 feet — the ward\'s 2d8 rolled in the open as the Cleric\'s, typed FIRE by the standing effect, applied to the goblin with a receipt; the damage card carries the claim',
  2: 'Fire Shield (chill): the type follows the effect — COLD',
  3: 'the reach is the activity\'s: a hit from 10 feet strikes nothing; a RANGED hit from 5 feet strikes nothing',
  4: 'Death Armor cast by the Cleric on the RANGER: the goblin hitting the Ranger takes the Cleric\'s 2d4 necrotic — the ward walked to its caster; once per turn in combat (the chit), the next turn again; out of combat every hit',
  5: 'Armor of Agathys: the cast is MARKED (a chip, the card says so); a hit strikes 5 cold while the temp HP stand; the pool going to zero ends the mark with a card; a hit after strikes nothing',
  6: 'the Damage Shields list is the switch: an empty list strikes nothing',
  7: 'the registration FIRED (§11): the damage message hooks and postUseActivity moved'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'shields', watchdogMs: 600_000 });
announcePlan('shields', plan, pulled);

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
  const ledger = globalThis.__bfHookLedger ?? null;
  const count = name => ledger?.[name] ?? 0;
  const errors = [];
  const origError = console.error;
  console.error = (...args) => { errors.push('E ' + args.map(a => (a instanceof Error) ? a.message : String(a)).join(' ').slice(0, 300)); origError(...args); };

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.damageShieldList`)) return { fatal: 'damageShieldList not registered — OLD code (deploy --local, reload)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'saves', 'castApply', 'concMode',
    'reminderList', 'maneuverFolds', 'clockRiderList', 'hitMenuList', 'emanations', 'damageShieldList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const cleric = game.actors.getName('BF Test Cleric');
  const ranger = game.actors.getName('BF Test Ranger');
  const goblin = game.actors.getName('BF Test Attacker');
  if (!scene || !cleric || !ranger || !goblin) return { fatal: 'missing fixture: scene, BF Test Cleric, BF Test Ranger or BF Test Attacker — run tools/fixture-suite.mjs' };
  const melee = goblin.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => (a.type === 'attack') && (a.attack?.type?.value === 'melee')));
  const ranged = goblin.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => (a.type === 'attack') && (a.attack?.type?.value === 'ranged')));
  if (!melee) return { fatal: 'BF Test Attacker has no melee weapon' };
  log.push(`goblin melee: ${melee.name}${ranged ? `, ranged: ${ranged.name}` : ' (no ranged weapon — §3b skipped)'}`);

  const created = { items: [], tokens: [] };
  const priorActor = {};
  let combat = null;
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const SHIELD_NAMES = ['Warm Shield', 'Chill Shield', 'Death Armor', 'Armor of Agathys'];
  const clearWards = async () => {
    for (const a of [cleric, ranger, goblin]) {
      const fx = a.effects.filter(e => SHIELD_NAMES.includes(e.name) || e.getFlag(MOD, 'shield') || (e.getFlag(MOD, 'mastery') === 'rider' && /shield:/.test(e.getFlag(MOD, 'riderKey') ?? '')));
      const live = fx.map(e => e.id).filter(id => a.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
    }
  };
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      if (/RollConfigurationDialog/.test(app.constructor?.name ?? '') || (app.element?.innerHTML ?? '').includes('Damage — your roll')) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    console.error = origError;
    for (const e of errors) log.push('console: ' + e);
    CONFIG.Dice.randomUniform = realPRNG;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      await clearWards();
      const live = created.items.filter(id => cleric.items.get(id));
      if (live.length) await cleric.deleteEmbeddedDocuments('Item', live);
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
    await set('damageTimer', 0);
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('masteryAsk', false);
    await set('saves', false);
    await set('castApply', false);        // the temp HP are set by hand — the cast slice is another suite's
    await set('concMode', 'off');
    await set('reminderList', '');        // no gate: the swing rolls straight
    await set('maneuverFolds', '');
    await set('clockRiderList', '');
    await set('hitMenuList', '');
    await set('emanations', false);
    await set('damageShieldList', 'Death Armor, Fire Shield, Armor of Agathys');

    // -------------------------------------------------- fixtures: the spells on the Cleric
    const findPackItem = async (packIds, name) => {
      for (const id of packIds) {
        const pack = game.packs.get(id);
        if (!pack) continue;
        const index = await pack.getIndex();
        const hit = index.find(e => e.name === name);
        if (hit) { const doc = await pack.getDocument(hit._id); const data = doc.toObject(); delete data._id; return data; }
      }
      return null;
    };
    const add = [];
    for (const [name, packs] of [['Fire Shield', ['dnd-players-handbook.spells', 'dnd5e.spells24']], ['Armor of Agathys', ['dnd-players-handbook.spells', 'dnd5e.spells24']], ['Death Armor', ['dnd-heroes-faerun.options']]]) {
      if (cleric.items.some(i => (i.type === 'spell') && (i.name === name))) continue;
      const data = await findPackItem(packs, name);
      if (!data) return { fatal: `${name} not in the packs (${packs.join(', ')})` };
      data.system.preparation = { mode: 'always', prepared: true };
      add.push(data);
    }
    if (add.length) {
      const docs = await cleric.createEmbeddedDocuments('Item', add);
      created.items.push(...docs.map(d => d.id));
      log.push(`gave the Cleric ${docs.map(d => d.name).join(', ')} for the run`);
    }
    const spell = name => cleric.items.find(i => (i.type === 'spell') && (i.name === name));
    const fireShield = spell('Fire Shield'), agathys = spell('Armor of Agathys'), deathArmor = spell('Death Armor');
    if (!fireShield || !agathys || !deathArmor) return { fatal: 'the spells did not land on the Cleric' };

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => [cleric.id, ranger.id, goblin.id].includes(t.actorId)).map(t => t.id);
    if (strays.length) await scene.deleteEmbeddedDocuments('Token', strays);
    const placeToken = async (actor, x, y) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true, hidden: false }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    // The goblin one square LEFT of the Cleric (5 feet); the Ranger one square below the goblin.
    const { doc: clericDoc, token: clericToken } = await placeToken(cleric, 1500, 1200);
    const { doc: goblinDoc, token: goblinToken } = await placeToken(goblin, 1400, 1200);
    const { doc: rangerDoc, token: rangerToken } = await placeToken(ranger, 1400, 1300);
    const mv = () => ({ teleport: true, animate: false });

    for (const a of [cleric, ranger, goblin]) {
      priorActor[a.id] = {
        'system.attributes.ac.calc': a.system._source.attributes.ac.calc,
        'system.attributes.ac.flat': a.system._source.attributes.ac.flat,
        'system.attributes.hp.value': a.system._source.attributes.hp.value,
        'system.attributes.hp.max': a.system._source.attributes.hp.max,
        'system.attributes.hp.temp': a.system._source.attributes.hp.temp ?? 0
      };
      await a.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1,
        'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
    }
    const healFull = async () => {
      for (const a of [cleric, ranger, goblin]) await a.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
    };

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const face = (n, faces = 20) => { CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces); };
    const target = token => token.setTarget(true, { releaseOthers: true });
    const attackOf = item => item.system.activities.find(a => a.type === 'attack');
    const damageFor = originId => game.messages.contents.find(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
      && (m.getFlag('dnd5e', 'originatingMessage') === originId));
    const shieldCards = after => game.messages.contents.filter(m => (m.timestamp >= after) && m.getFlag(MOD, 'damageShield'));
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const cardText = id => textOf(document.querySelector(`.message[data-message-id="${id}"]`));
    /** The goblin hits `victimToken` with `weapon` (a forced 19): the damage message with its receipt, and the shield cards since. */
    const swing = async (victimToken, weapon = melee) => {
      const since = Date.now();
      goblinToken.control({ releaseOthers: true });
      target(victimToken);
      await sleep(80);
      face(19);
      const act = attackOf(weapon);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': results.message.id } } : {});
      const attackMsg = rolls?.[0]?.parent ?? null;
      const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
      const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
      // The shield's roll follows the damage landing; give it a beat, then read.
      const shield = await waitFor(() => shieldCards(since)[0] ?? null, 5000);
      await sleep(400);
      return { attackMsg, dmg, shield, cards: shieldCards(since), since };
    };
    /** Put the pack's effect (by name, off the Cleric's spell) on `actor`, origin the item's own effect — the tray's shape. */
    const ward = async (item, effectName, actor) => {
      const src = item.effects.find(e => e.name === effectName);
      if (!src) throw new Error(`${item.name} carries no effect named ${effectName}`);
      const data = src.toObject();
      delete data._id;
      const [e] = await actor.createEmbeddedDocuments('ActiveEffect', [{ ...data, origin: src.uuid, transfer: false, disabled: false }]);
      return e;
    };
    const goblinHP = () => goblin.system.attributes.hp.value;
    const startCombat = async (...entries) => {
      if (game.combat) await game.combat.delete();
      combat = await Combat.create({ scene: scene.id });
      await combat.createEmbeddedDocuments('Combatant', entries.map(([actor, doc, initiative]) =>
        ({ actorId: actor.id, tokenId: doc.id, sceneId: scene.id, initiative })));
      await combat.startCombat();
      await sleep(500);
    };

    // ================================================== 1. Fire Shield, warm
    if (want(1)) {
      await clearWards();
      await healFull();
      await ward(fireShield, 'Warm Shield', cleric);
      const hpBefore = goblinHP();
      const { dmg, shield, cards } = await swing(clericToken);
      const ds = shield?.getFlag(MOD, 'damageShield');
      ok('1a. the goblin\'s melee hit on the warded Cleric raises the ward\'s own roll — Flame Eruption\'s 2d8, posted as the CLERIC\'s, typed FIRE by the Warm Shield that stands',
        !!ds?.rolled && (ds.key === 'Fire Shield') && (ds.type === 'fire') && /2d8/.test(ds.formula ?? '') && (shield.speaker?.actor === cleric.id) && (shield.rolls?.length >= 1),
        `flag=${JSON.stringify(ds)} speaker=${shield?.speaker?.alias} rolls=${shield?.rolls?.map(r => r.formula + ':' + r.options?.type).join('|')}`);
      const receipt = shield?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === goblin.uuid);
      ok('1b. …applied to the GOBLIN through the receipt chokepoint: a receipt on the ward\'s roll card naming the ward, the goblin\'s HP down by the roll',
        !!receipt && (receipt.taken === ds?.total) && (goblinHP() === hpBefore - (ds?.total ?? 0)) && /Fire Shield on BF Test Cleric/.test(receipt.note ?? ''),
        `receipt=${JSON.stringify(receipt)} hp ${hpBefore}→${goblinHP()} total=${ds?.total}`);
      ok('1c. one ward, one payout: the damage message carries the claim, and exactly one shield card was posted',
        (dmg?.getFlag(MOD, 'damageShields')?.paid?.length === 1) && (cards.length === 1),
        `paid=${JSON.stringify(dmg?.getFlag(MOD, 'damageShields'))} cards=${cards.length}`);
      const text = await waitFor(() => { const t = cardText(shield?.id); return /Damage shield/i.test(t) ? t : null; }, 4000);
      ok('1d. the card says it (R5): the ward, the defender, the dice and the type, at the attacker, the rule folded',
        /Fire Shield on BF Test Cleric — 2d8 fire to BF Test Attacker/.test(text ?? '') && /every melee hit/.test(text ?? ''),
        (text ?? '').slice(0, 220));
    }

    // ================================================== 2. Fire Shield, chill
    if (want(2)) {
      await clearWards();
      await healFull();
      await ward(fireShield, 'Chill Shield', cleric);
      const { shield } = await swing(clericToken);
      const ds = shield?.getFlag(MOD, 'damageShield');
      ok('2a. the Chill Shield standing instead: the same activity rolls, typed COLD — the type follows the effect', !!ds?.rolled && (ds.type === 'cold') && (shield.rolls?.[0]?.options?.type === 'cold'),
        `flag type=${ds?.type} roll type=${shield?.rolls?.[0]?.options?.type}`);
    }

    // ================================================== 3. the reach, and a ranged hit
    if (want(3)) {
      await clearWards();
      await healFull();
      await ward(fireShield, 'Warm Shield', cleric);
      await goblinDoc.update({ x: 1300, y: 1200 }, mv());   // two squares away — 10 feet
      await sleep(300);
      const far = await swing(clericToken);
      ok('3a. a melee hit from 10 feet strikes nothing — the ward\'s reach is Flame Eruption\'s own 5 feet',
        !!far.dmg && !far.shield && !far.dmg.getFlag(MOD, 'damageShields'),
        `cards=${far.cards.length} claim=${JSON.stringify(far.dmg?.getFlag(MOD, 'damageShields'))}`);
      await goblinDoc.update({ x: 1400, y: 1200 }, mv());
      await sleep(300);
      if (ranged) {
        await healFull();
        const bow = await swing(clericToken, ranged);
        ok('3b. a RANGED hit from 5 feet strikes nothing — every row is a melee attack roll', !!bow.dmg && !bow.shield, `cards=${bow.cards.length} weapon=${ranged.name}`);
      }
    }

    // ================================================== 4. Death Armor, on another creature
    if (want(4)) {
      await clearWards();
      await healFull();
      // The Cleric's Death Armor wards the RANGER: the effect's origin is the Cleric's item's effect,
      // which is what the tray writes on a touch cast.
      await ward(deathArmor, 'Death Armor', ranger);
      const hpBefore = goblinHP();
      const out4 = await swing(rangerToken);
      const ds = out4.shield?.getFlag(MOD, 'damageShield');
      ok('4a. out of combat: the goblin hitting the warded RANGER takes the CLERIC\'s Retaliate — 2d4 necrotic, the ward walked to its caster\'s spell; posted as the Ranger\'s',
        !!ds?.rolled && (ds.key === 'Death Armor') && /2d4/.test(ds.formula ?? '') && (ds.type === 'necrotic') && (out4.shield.speaker?.actor === ranger.id) && /out of combat/.test(ds.why ?? '') && (goblinHP() === hpBefore - ds.total),
        `flag=${JSON.stringify(ds)} hp ${hpBefore}→${goblinHP()}`);
      await startCombat([goblin, goblinDoc, 30], [ranger, rangerDoc, 20]);
      await healFull();
      const c1 = await swing(rangerToken);
      const chit = ranger.effects.find(e => (e.getFlag(MOD, 'mastery') === 'rider') && (e.getFlag(MOD, 'riderKey') === 'shield:Death Armor'));
      ok('4b. in combat: the first hit of the turn strikes and writes the once-per-turn chit on the DEFENDER',
        !!c1.shield && !!chit && /once this turn/.test(c1.shield.getFlag(MOD, 'damageShield')?.why ?? ''),
        `cards=${c1.cards.length} chit=${chit?.name} why=${c1.shield?.getFlag(MOD, 'damageShield')?.why}`);
      const c2 = await swing(rangerToken);
      ok('4c. the second hit this turn strikes nothing — the chit stands', !!c2.dmg && !c2.shield, `cards=${c2.cards.length}`);
      await combat.nextTurn(); await sleep(500);
      await combat.nextTurn(); await sleep(500);
      const c3 = await swing(rangerToken);
      ok('4d. the next turn strikes again — the chit died with the turn it was written in', !!c3.shield && (combat.round === 2), `cards=${c3.cards.length} round=${combat.round}`);
      await combat.delete(); combat = null;
    }

    // ================================================== 5. Armor of Agathys
    if (want(5)) {
      await clearWards();
      await healFull();
      const cast = agathys.system.activities.find(a => a.name === 'Cast');
      clericToken.control({ releaseOthers: true });
      const results = await cast.use({ consume: { spellSlot: false, resources: false, action: false }, subsequentActions: false }, { configure: false }, {});
      const mark = await waitFor(() => cleric.effects.find(e => e.getFlag(MOD, 'shield')?.key === 'Armor of Agathys'), 5000);
      await waitFor(() => results?.message?.getFlag(MOD, 'shieldMark'), 4000);   // the card's line lands a beat after the chip
      ok('5a. the cast is MARKED: a chip named as the spell, the item\'s hour on its clock, the cast\'s level carried; the usage card says the ward stands',
        !!mark && (mark.name === 'Armor of Agathys') && (mark.duration?.seconds === 3600) && !!results?.message?.getFlag(MOD, 'shieldMark'),
        `mark=${mark?.name} seconds=${mark?.duration?.seconds} flag=${JSON.stringify(mark?.getFlag(MOD, 'shield'))} card=${!!results?.message?.getFlag(MOD, 'shieldMark')}`);
      await cleric.update({ 'system.attributes.hp.temp': 5 });
      await sleep(200);
      const hpBefore = goblinHP();
      const a1 = await swing(clericToken);
      const ds = a1.shield?.getFlag(MOD, 'damageShield');
      ok('5b. a melee hit while the temp HP stand strikes Frost Damage — 5 cold at the goblin, the mark found without any pack effect',
        !!ds?.rolled && (ds.key === 'Armor of Agathys') && (ds.type === 'cold') && (ds.total === 5) && (goblinHP() === hpBefore - 5),
        `flag=${JSON.stringify(ds)} hp ${hpBefore}→${goblinHP()}`);
      // The goblin's own damage took the temp HP: is the mark gone, and said?
      const ended = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= a1.since) && m.getFlag(MOD, 'shieldEnded')), 5000);
      const markGone = !cleric.effects.some(e => e.getFlag(MOD, 'shield')?.key === 'Armor of Agathys');
      ok('5c. the goblin\'s hit emptied the pool: the mark ends with it and a card says so (the strike that emptied it already paid)',
        (cleric.system.attributes.hp.temp === 0) && markGone && !!ended,
        `temp=${cleric.system.attributes.hp.temp} markGone=${markGone} ended=${!!ended}`);
      await healFull();
      const a2 = await swing(clericToken);
      ok('5d. with the mark gone a hit strikes nothing', !!a2.dmg && !a2.shield, `cards=${a2.cards.length}`);
    }

    // ================================================== 6. the list is the switch
    if (want(6)) {
      await clearWards();
      await healFull();
      await ward(fireShield, 'Warm Shield', cleric);
      await set('damageShieldList', '');
      const off = await swing(clericToken);
      ok('6a. an empty Damage Shields list strikes nothing — the ward stays the table\'s by hand', !!off.dmg && !off.shield && !off.dmg.getFlag(MOD, 'damageShields'), `cards=${off.cards.length}`);
      await set('damageShieldList', 'Death Armor, Fire Shield, Armor of Agathys');
    }

    // ================================================== 7. FIRED
    if (want(7)) {
      ok('7a. createChatMessage and dnd5e.renderChatMessage fired (the shield\'s triggers)', (count('createChatMessage') > 0) && (count('dnd5e.renderChatMessage') > 0),
        `create=${count('createChatMessage')} render=${count('dnd5e.renderChatMessage')}`);
      ok('7b. dnd5e.postUseActivity fired (the mark\'s hook)', count('dnd5e.postUseActivity') > 0, `count=${count('dnd5e.postUseActivity')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'shields', out, plan, f });
