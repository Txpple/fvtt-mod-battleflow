// SMOKE — THE MONSTER MANUAL'S WAITING ROWS BUILT (RULINGS *The Monster Manual — the waiting rows built*):
// BF Test Monster is lent each trait by name from `dnd-monster-manual.features` and uses it at BF Test Victim;
// the machines the rows sit on are driven from there. Sections: `--section 2`, `--list`. Fixtures and teardown
// ALWAYS run: the lent traits go back, the Victim's strays and the placed tokens go, the combat is deleted.
//
//   node tools/smoke-monsters.mjs [--section N ...] [--list]
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'repeat-saves.js',        // §1 — a monster's own activity repeats at the target's turn end (Pacifying Spores); §2 the escalation (Petrifying Bite: Petrified instead of Restrained)
  'turn-grants.js',         // §3 — the grappled target's damage at its own turn start (Constricting Vine) and turn end (Swarm of Proboscises); §4 the grappler's own turn start (Barbed Hide)
  'emanations.js',          // §5 — the fire auras' pulse at the bearer's turn end (Flame Aura); §6 Gibbering's turn-start demand; §7 the alerts — Watery Rebuke on a move-in, Unnerving Gaze on a turn start
  'clock-riders.js'         // §8 — Chaos Blade's d4: one of the attack's four conditions lands on the hit, the card says which
];

const SECTIONS = {
  1: 'PACIFYING SPORES: the Monster\'s save fails the Victim (Stunned lands from the trait); the Victim\'s turn END raises the repeat — Constitution at the trait\'s DC, not a spell; a failure holds, a success ends it',
  2: 'PETRIFYING BITE: the First Save lands Restrained; the turn end repeats on the SECOND Save; the failure presses Petrified INSTEAD — the Restrained gone, the card says so',
  3: 'CONSTRICTING VINE and SWARM OF PROBOSCISES: the grappled Victim takes the vine\'s "Damage: Grappled" at its own turn START, receipted; the swarm\'s at its turn END; nothing once the grapple ends',
  4: 'BARBED HIDE: the Monster\'s own turn start deals its damage to the creature it grapples (the Victim, Grappled by it), receipted; nothing when it grapples no one',
  5: 'FLAME AURA: a ring off the damage activity\'s Emanation; the Monster\'s turn END rolls the fire once and lands it on the Victim inside, receipted; the Victim outside takes nothing',
  6: 'GIBBERING: the Victim starting its turn inside the ring is demanded the Wisdom save (cause turnStart); the Monster Incapacitated, nothing',
  7: 'THE ALERTS: Watery Rebuke — the Victim moving within 5 feet raises the reminder card (hewNotice, the Reaction from the sheet); Unnerving Gaze — the Victim STARTING its turn within 30 feet raises it (cause turnStart), once per turn',
  8: 'CHAOS BLADE: the Monster\'s hit lands ONE of the attack\'s four conditions by a d4 (the rider records the face and the name); a hit with another attack lands none'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'monsters', watchdogMs: 600_000 });
announcePlan('monsters', plan, pulled);

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
  // The module's own errors, into the log (they say what failed and where).
  const realError = console.error;
  console.error = (...a) => { try { log.push(`ERR ${a.map(x => (x instanceof Error) ? `${x.message}\n${x.stack}` : String(x)).join(' ').slice(0, 900)}`); } catch { /* the log */ } realError(...a); };

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.decisionTimer`)) return { fatal: 'decisionTimer not registered — OLD code (reload the box)' };

  const SETTING_KEYS = ['decisionTimer', 'dramaticBeat', 'saveRolls', 'playerRollDamage'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const monster = game.actors.getName('BF Test Monster');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !monster || !victim) return { fatal: 'missing fixture: the test range, BF Test Monster or BF Test Victim — run tools/fixture-suite.mjs' };

  const lent = [];
  const placed = [];
  let combat = null;
  const priorActiveCombats = [];
  const priorHp = { value: victim.system._source.attributes.hp.value, max: victim.system._source.attributes.hp.max, temp: victim.system._source.attributes.hp.temp };
  const priorSaves = Object.fromEntries(['con', 'wis', 'dex', 'str'].map(a => [a, victim.system._source.abilities?.[a]?.save?.roll?.bonus ?? '']));
  const priorVictimEffects = new Set(victim.effects.map(e => e.id));
  const priorMonsterEffects = new Set(monster.effects.map(e => e.id));
  const priorMonsterHp = monster.system._source.attributes.hp.value;
  // ⚠ Every die a 5: a natural 20 SUCCEEDS a 2024 save whatever the bonus, and the saves here are steered by ±30.
  const realPRNG = CONFIG.Dice.randomUniform;
  CONFIG.Dice.randomUniform = () => 1 - ((5 - 0.5) / 20);
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    CONFIG.Dice.randomUniform = realPRNG;
    console.error = realError;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      for (const id of priorActiveCombats) { try { await game.combats.get(id)?.update({ active: true }); } catch { /* gone */ } }
      const strays = victim.effects.filter(e => !priorVictimEffects.has(e.id)).map(e => e.id);
      if (strays.length) await victim.deleteEmbeddedDocuments('ActiveEffect', strays);
      const mstrays = monster.effects.filter(e => !priorMonsterEffects.has(e.id)).map(e => e.id);
      if (mstrays.length) await monster.deleteEmbeddedDocuments('ActiveEffect', mstrays);
      const live = lent.filter(id => monster.items.get(id));
      if (live.length) await monster.deleteEmbeddedDocuments('Item', live);
      const tokens = placed.filter(id => scene.tokens.get(id));
      if (tokens.length) await scene.deleteEmbeddedDocuments('Token', tokens);
      await victim.update({ 'system.attributes.hp.value': priorHp.value, 'system.attributes.hp.max': priorHp.max, 'system.attributes.hp.temp': priorHp.temp,
        ...Object.fromEntries(Object.entries(priorSaves).map(([a, v]) => [`system.abilities.${a}.save.roll.bonus`, v])) });
      await monster.update({ 'system.attributes.hp.value': priorMonsterHp });
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && ((m.speaker?.actor === monster.id) || (m.speaker?.actor === victim.id) || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('decisionTimer', 0);
    await set('dramaticBeat', 0);
    await set('saveRolls', 'auto');   // the demanded saves roll themselves; the bonus steers the verdict
    await set('playerRollDamage', false);

    /** The Monster Manual's trait by name, on the Monster; taken back at the end. */
    const lendTrait = async name => {
      const have = monster.items.find(i => i.name === name);
      if (have) return have;
      const pack = game.packs.get('dnd-monster-manual.features');
      if (!pack) throw new Error('the Monster Manual features pack is not on this box');
      const hit = (await pack.getIndex()).find(e => e.name === name);
      if (!hit) throw new Error(`the Monster Manual ships no "${name}" this box can find`);
      const src = await pack.getDocument(hit._id);
      const [item] = await monster.createEmbeddedDocuments('Item', [src.toObject()]);
      lent.push(item.id);
      return item;
    };
    const takeBack = async name => {
      const ids = monster.items.filter(i => i.name === name).map(i => i.id);
      if (ids.length) await monster.deleteEmbeddedDocuments('Item', ids);
    };
    const actOf = (item, { type = null, name = null } = {}) => [...(monster.items.get(item.id)?.system.activities ?? [])]
      .find(a => (name ? (a.name === name) : true) && (type ? (a.type === type) : true)) ?? null;

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const g = scene.grid.size;
    const monsterToken = canvas.tokens.placeables.find(t => t.actor?.uuid === monster.uuid) ?? null;
    if (!monsterToken) return { fatal: 'BF Test Monster has no token on the range — run tools/fixture-suite.mjs', results, log, skips };
    /** The Victim's own token, placed `squares` from the Monster (the fixture line moves under walks). */
    const placeVictim = async (squares = 1) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(victim.prototypeToken.toObject(),
        { x: monsterToken.document.x + squares * g, y: monsterToken.document.y, actorId: victim.id, actorLink: true }, { inplace: false })]);
      placed.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      return canvas.tokens.get(doc.id);
    };
    const victimToken = await placeVictim(1);
    if (!victimToken) return { fatal: 'the Victim\'s token never reached the canvas', results, log, skips };

    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const target = () => { game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); }); victimToken.setTarget(true, { releaseOthers: true }); };
    const saveBonus = (ability, v) => victim.update({ [`system.abilities.${ability}.save.roll.bonus`]: v });
    const healFull = () => victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });
    const hpNow = () => Number(victim.system.attributes.hp.value);
    const effectNamed = name => victim.effects.find(e => e.name === name) ?? null;
    const clearVictim = async () => {
      const strays = victim.effects.filter(e => !priorVictimEffects.has(e.id)).map(e => e.id);
      if (strays.length) await victim.deleteEmbeddedDocuments('ActiveEffect', strays);
    };
    const cardsWith = flag => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, flag));
    const repeatCards = () => cardsWith('repeatSave');
    const grantCards = () => cardsWith('turnGrant');
    const settledRepeat = async (n, timeout = 15000) => waitFor(() => {
      const cards = repeatCards();
      const c = cards[n - 1];
      return (cards.length >= n) && c?.getFlag(MOD, 'repeatSave')?.says ? c : null;
    }, timeout);

    /** The Monster uses a save activity at the Victim with the save steered: the demand card, its verdict done. */
    const useAt = async (activity, bonus) => {
      const ability = [...(activity?.save?.ability ?? [])][0] ?? 'con';
      await saveBonus(ability, bonus);
      target();
      await sleep(120);
      const use = await activity.use({ consume: { resources: false, uses: false } }, { configure: false }, {});
      const card = use?.message instanceof ChatMessage ? use.message : null;
      if (!card) return null;
      await waitFor(() => card.getFlag(MOD, 'saves')?.targets?.[0]?.applied ? true : null, 15000);
      return card;
    };

    const startCombat = async () => {
      for (const c of game.combats.filter(c => c.active)) { priorActiveCombats.push(c.id); await c.update({ active: false }); }
      combat = await Combat.create({ scene: scene.id, active: true });
      await combat.createEmbeddedDocuments('Combatant', [{ tokenId: monsterToken.id, actorId: monster.id, initiative: 20 }, { tokenId: victimToken.id, actorId: victim.id, initiative: 10 }]);
      await combat.startCombat();   // the Monster's turn
      if (game.combat?.id !== combat.id) { try { ui.combat.viewed = combat; } catch { /* the tracker */ } }
      await sleep(300);
    };
    const endCombat = async () => {
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      combat = null;
    };
    /** The pack's Grappled effect from a trait's attack, landed on the Victim as the tray would (origin: the activity). */
    const grappleFrom = async (item, effectName = 'Grappled') => {
      const activity = actOf(item, { type: 'attack' });
      const src = item.effects.find(e => e.name === effectName) ?? item.effects.contents[0];
      if (!src) throw new Error(`${item.name} ships no "${effectName}" effect`);
      const data = src.toObject();
      data.origin = activity?.uuid ?? item.uuid;
      data.disabled = false;
      const [fx] = await victim.createEmbeddedDocuments('ActiveEffect', [data]);
      return fx;
    };

    // ================================================== 1. Pacifying Spores
    if (want(1)) {
      await healFull();
      const spores = await lendTrait('Pacifying Spores');
      const save = actOf(spores, { type: 'save' });
      const card = await useAt(save, '-30');
      const stunned = await waitFor(() => effectNamed('Stunned'), 8000);
      ok('1a. the Monster\'s Pacifying Spores fails the Victim: Stunned stands, its origin the trait\'s activity',
        !!card && !!stunned && /Pacifying Spores/.test(String(stunned?.origin ?? '')) || (!!stunned && (stunned.origin ?? '').includes(spores.id)),
        `card=${!!card} stunned=${!!stunned} origin=${stunned?.origin}`);
      await startCombat();
      const n0 = repeatCards().length;
      await combat.nextTurn();   // → the Victim's turn
      await sleep(400);
      ok('1b. the Victim\'s turn START raises nothing', repeatCards().length === n0, `cards=${repeatCards().length}`);
      await combat.nextTurn();   // the Victim's turn ENDS
      const first = await settledRepeat(n0 + 1);
      const f1 = first?.getFlag(MOD, 'saves');
      const r1 = first?.getFlag(MOD, 'repeatSave');
      ok('1c. the turn end raises a saves demand pinned to the Victim — Constitution, the trait\'s DC, effectsHandled "repeat", NOT a spell',
        !!first && (f1?.abilities?.[0] === 'con') && (f1?.dc === save?.save?.dc?.value) && (f1?.effectsHandled === 'repeat')
          && (f1?.targets?.length === 1) && (f1.targets[0].uuid === victim.uuid) && (f1?.demand?.spell === false) && (r1?.key === 'Pacifying Spores'),
        `flag=${JSON.stringify(f1 && { abilities: f1.abilities, dc: f1.dc, handled: f1.effectsHandled, spell: f1.demand?.spell })} key=${r1?.key}`);
      ok('1d. the save failed (−30): Stunned holds and the card says so',
        (f1?.targets?.[0]?.outcome === 'failed') && !!effectNamed('Stunned') && (r1?.says === 'Stunned holds — the save failed') && (r1?.ended === false),
        `outcome=${f1?.targets?.[0]?.outcome} stunned=${!!effectNamed('Stunned')} says="${r1?.says}"`);
      await saveBonus('con', '+30');
      await combat.nextTurn();   // the Monster
      await sleep(300);
      await combat.nextTurn();   // the Victim
      await sleep(300);
      await combat.nextTurn();   // the Victim's turn ends again
      const second = await settledRepeat(n0 + 2);
      const r2 = second?.getFlag(MOD, 'repeatSave');
      await waitFor(() => effectNamed('Stunned') ? null : true, 6000);
      ok('1e. the save succeeded (+30): Stunned is gone, the card says it ended',
        (second?.getFlag(MOD, 'saves')?.targets?.[0]?.outcome === 'saved') && !effectNamed('Stunned') && (r2?.ended === true) && (r2?.says === 'Stunned ended — the save succeeded'),
        `stunned=${!!effectNamed('Stunned')} says="${r2?.says}"`);
      await endCombat();
      await clearVictim();
      await takeBack('Pacifying Spores');
    }

    // ================================================== 2. Petrifying Bite — the escalation
    if (want(2)) {
      await healFull();
      const bite = await lendTrait('Petrifying Bite');
      const first = actOf(bite, { type: 'save', name: 'First Save' });
      const second = actOf(bite, { type: 'save', name: 'Second Save' });
      ok('2-pre. the pack ships the two saves', !!first && !!second, `first=${!!first} second=${!!second}`);
      await useAt(first, '-30');
      const restrained = await waitFor(() => effectNamed('Restrained'), 8000);
      ok('2a. the First Save fails the Victim: Restrained stands from the trait', !!restrained, `restrained=${!!restrained}`);
      await startCombat();
      const n0 = repeatCards().length;
      await combat.nextTurn();   // → the Victim
      await sleep(300);
      await combat.nextTurn();   // the Victim's turn ends — the second failure
      const card = await settledRepeat(n0 + 1);
      const fs = card?.getFlag(MOD, 'saves');
      const rs = card?.getFlag(MOD, 'repeatSave');
      const petrified = await waitFor(() => victim.statuses?.has?.('petrified') ? true : null, 6000);
      await waitFor(() => effectNamed('Restrained') ? null : true, 6000);
      ok('2b. the repeat runs on the SECOND Save (its activity), the Victim failing it',
        !!card && (fs?.activityUuid === second?.uuid) && (fs?.targets?.[0]?.outcome === 'failed') && (rs?.key === 'Petrifying Bite'),
        `activity=${fs?.activityUuid === second?.uuid} outcome=${fs?.targets?.[0]?.outcome}`);
      ok('2c. the failure presses Petrified INSTEAD of Restrained: the status on, the Restrained gone, the card says "instead"',
        !!petrified && !effectNamed('Restrained') && (rs?.ended === true) && /first failure: Petrified instead/.test(rs?.says ?? ''),
        `petrified=${!!petrified} restrained=${!!effectNamed('Restrained')} says="${rs?.says}"`);
      await combat.nextTurn();
      await sleep(300);
      await combat.nextTurn();
      await sleep(800);
      ok('2d. with the Restrained gone, the next turn end asks nothing', repeatCards().length === n0 + 1, `cards=${repeatCards().length}`);
      await endCombat();
      await clearVictim();
      await takeBack('Petrifying Bite');
    }

    // ================================================== 3. Constricting Vine / Swarm of Proboscises — the grappled target's turns
    if (want(3)) {
      await healFull();
      const vine = await lendTrait('Constricting Vine');
      const grappled = await grappleFrom(vine, 'Grappled');
      ok('3-pre. Grappled stands on the Victim, its origin the vine\'s attack', !!grappled && String(grappled.origin ?? '').includes(vine.id), `origin=${grappled?.origin}`);
      await startCombat();
      const n0 = grantCards().length;
      const hp0 = hpNow();
      await combat.nextTurn();   // → the Victim's turn START
      const card = await waitFor(() => grantCards()[n0] ?? null, 10000);
      await waitFor(() => card?.getFlag(MOD, 'receipt'), 8000);
      const tg = card?.getFlag(MOD, 'turnGrant');
      ok('3a. the Victim\'s turn start deals the vine\'s "Damage: Grappled" (1d8 bludgeoning) to the Victim, receipted, the card naming the grapple',
        !!card && (tg?.key === 'Constricting Vine') && (tg?.deals === true) && (tg?.type === 'bludgeoning') && (tg?.total > 0) && (hpNow() === hp0 - tg.total) && !!card?.getFlag(MOD, 'receipt') && new RegExp(`takes ${tg?.total} bludgeoning`).test(card?.content ?? ''),
        `card=${!!card} flag=${JSON.stringify(tg && { key: tg.key, deals: tg.deals, type: tg.type, total: tg.total })} hp=${hpNow()} vs ${hp0}`);
      await combat.nextTurn();   // the Victim's turn ends
      await sleep(600);
      ok('3b. the turn END pays nothing for the vine (its clock is the turn start)', grantCards().length === n0 + 1, `cards=${grantCards().length}`);
      await grappled.delete();
      await combat.nextTurn();   // the Monster
      await sleep(300);
      await combat.nextTurn();   // the Victim, no longer grappled
      await sleep(800);
      ok('3c. the grapple ended: the next turn start deals nothing', grantCards().length === n0 + 1, `cards=${grantCards().length}`);
      await endCombat();
      await takeBack('Constricting Vine');
      // The swarm: the damage at the END of the target's turn.
      const swarm = await lendTrait('Swarm of Proboscises');
      const g2 = await grappleFrom(swarm, 'Grappled');
      await startCombat();
      const n1 = grantCards().length;
      const hp1 = hpNow();
      await combat.nextTurn();   // → the Victim's turn start
      await sleep(600);
      ok('3d. the swarm pays nothing at the Victim\'s turn START', grantCards().length === n1, `cards=${grantCards().length}`);
      await combat.nextTurn();   // the Victim's turn END
      const c2 = await waitFor(() => grantCards()[n1] ?? null, 10000);
      await waitFor(() => c2?.getFlag(MOD, 'receipt'), 8000);
      const t2 = c2?.getFlag(MOD, 'turnGrant');
      ok('3e. the Victim\'s turn end deals the swarm\'s "Damage: Grappled" (2d6 necrotic), receipted, the card an end-of-turn one',
        !!c2 && (t2?.key === 'Swarm of Proboscises') && (t2?.type === 'necrotic') && (t2?.on === 'turnEnd') && (t2?.total > 0) && (hpNow() === hp1 - t2.total) && !!c2?.getFlag(MOD, 'receipt'),
        `flag=${JSON.stringify(t2 && { key: t2.key, type: t2.type, total: t2.total })} hp=${hpNow()} vs ${hp1}`);
      await g2.delete();
      await endCombat();
      await clearVictim();
      await takeBack('Swarm of Proboscises');
    }

    // ================================================== 4. Barbed Hide — the grappler's own turn start
    if (want(4)) {
      await healFull();
      await lendTrait('Barbed Hide');
      // The Victim Grappled BY the Monster: the module's own stamp names the grappler (Unarmed Fighting's finder).
      const [fx] = await victim.createEmbeddedDocuments('ActiveEffect', [{ name: 'Grappled', statuses: ['grappled'], origin: monster.uuid, flags: { [MOD]: { sourceUuid: monster.uuid } } }]);
      await startCombat();   // the Monster's turn START (round 1)
      const n0 = grantCards().length;
      const hp0 = hpNow();
      await combat.nextTurn();   // the Victim
      await sleep(300);
      await combat.nextTurn();   // → the Monster's turn start, round 2
      const card = await waitFor(() => grantCards()[n0] ?? null, 10000);
      await waitFor(() => card?.getFlag(MOD, 'receipt'), 8000);
      const tg = card?.getFlag(MOD, 'turnGrant');
      ok('4a. the Monster\'s turn start deals Barbed Hide\'s 1d10 piercing to the Victim it grapples, receipted, the card naming it',
        !!card && (tg?.key === 'Barbed Hide') && (tg?.deals === 'grappled') && (tg?.type === 'piercing') && (tg?.total > 0) && (tg?.targets?.[0]?.uuid === victim.uuid) && (hpNow() === hp0 - tg.total) && !!card?.getFlag(MOD, 'receipt'),
        `card=${!!card} flag=${JSON.stringify(tg && { key: tg.key, deals: tg.deals, total: tg.total, targets: tg.targets?.map(t => t.name) })} hp=${hpNow()} vs ${hp0}`);
      await fx.delete();
      await combat.nextTurn();
      await sleep(300);
      await combat.nextTurn();   // the Monster again, grappling no one
      await sleep(800);
      ok('4b. grappling no one, its turn start deals nothing', grantCards().length === n0 + 1, `cards=${grantCards().length}`);
      await endCombat();
      await clearVictim();
      await takeBack('Barbed Hide');
    }

    // ================================================== the rings — helpers
    const TYPE = `${MOD}.emanation`;
    const mv = () => ({ teleport: true, animate: false });
    const featureRegion = key => scene.regions.find(r => { const f = r.getFlag(MOD, 'emanation'); return f?.kind === 'feature' && f.tokenId === monsterToken.document.id && f.key === key; }) ?? null;
    const ringOf = async key => waitFor(() => { const r = featureRegion(key); return r?.behaviors?.find(b => b.type === TYPE) ? r : null; }, 12000);
    const moveVictim = async squares => { await victimToken.document.update({ x: monsterToken.document.x + squares * g, y: monsterToken.document.y }, mv()); await sleep(400); };
    const triggerCards = () => cardsWith('emanationTrigger');
    const pulseCards = () => cardsWith('emanationPulse');
    const notices = label => game.messages.filter(m => (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'hewNotice')?.label === label));
    const setIncapacitated = async (actor, on) => {
      const carriers = actor.effects.filter(e => e.statuses?.has?.('incapacitated'));
      if (on && !carriers.length) { const eff = await ActiveEffect.implementation.fromStatusEffect('incapacitated'); await ActiveEffect.implementation.create(eff.toObject(), { parent: actor, keepId: true }); }
      else if (!on && carriers.length) await actor.deleteEmbeddedDocuments('ActiveEffect', carriers.map(e => e.id));
      await sleep(300);
    };
    const ringWanted = [5, 6, 7].some(n => want(n));
    if (ringWanted) {
      // The Victim turned FRIENDLY for the ring sections: the Monster's enemy (a harmful reach).
      await victimToken.document.update({ disposition: 1 });
      await sleep(200);
    }

    // ================================================== 5. Flame Aura — the pulse
    if (want(5)) {
      await healFull();
      const t5 = Date.now();
      const aura = await lendTrait('Flame Aura');
      const ring = await ringOf('Flame Aura');
      const beh = ring?.behaviors?.find(b => b.type === TYPE);
      ok('5a. Flame Aura lent: a ring rises on the Monster\'s token off the damage activity\'s Emanation, reaching all, no member effect',
        !!ring && (ring.shapes?.[0]?.radius > 0) && (beh?.system?.reach === 'all') && (beh?.system?.effect === null), `ring=${!!ring} radius=${ring?.shapes?.[0]?.radius} reach=${beh?.system?.reach}`);
      await moveVictim(1);   // inside
      await startCombat();   // the Monster's turn
      const hp0 = hpNow();
      await combat.nextTurn();   // the Monster's turn ENDS → the pulse
      const card = await waitFor(() => pulseCards().find(m => (m.timestamp >= t5) && (m.getFlag(MOD, 'emanationPulse')?.key === 'Flame Aura')) ?? null, 10000);
      await waitFor(() => card?.getFlag(MOD, 'receipt'), 8000);
      const p = card?.getFlag(MOD, 'emanationPulse');
      ok('5b. the Monster\'s turn end rolls the aura\'s fire once and lands it on the Victim inside, receipted',
        !!card && (p?.type === 'fire') && (p?.total > 0) && (p?.targets?.some(t => t.uuid === victim.uuid)) && (hpNow() === hp0 - p.total) && !!card?.getFlag(MOD, 'receipt'),
        `card=${!!card} flag=${JSON.stringify(p && { type: p.type, total: p.total, targets: p.targets?.map(t => t.name) })} hp=${hpNow()} vs ${hp0}`);
      await moveVictim(-6);   // 30 ft away on the near side, outside (a stray token may still sit inside the ring — the range is shared)
      await sleep(1500);      // the ring re-bases and the region's membership settles
      const hp1 = hpNow();
      const n1 = pulseCards().length;
      await combat.nextTurn();   // the Victim
      await sleep(300);
      await combat.nextTurn();   // the Monster's turn ends again, the Victim outside
      await sleep(1000);
      const later = pulseCards().slice(n1);
      ok('5c. the Victim outside: the next turn end names it in no pulse and its Hit Points stand', !later.some(m => m.getFlag(MOD, 'emanationPulse')?.targets?.some(x => x.uuid === victim.uuid)) && (hpNow() === hp1),
        `later=${later.length} targets=${later.map(m => m.getFlag(MOD, 'emanationPulse')?.targets?.map(x => x.name).join('+')).join(';')} hp=${hpNow()} vs ${hp1}`);
      await endCombat();
      await aura.delete();
      await waitFor(() => featureRegion('Flame Aura') ? null : true, 8000);
      await moveVictim(1);
    }

    // ================================================== 6. Gibbering — the turn-start ring
    if (want(6)) {
      await healFull();
      await saveBonus('wis', '-30');
      const t6 = Date.now();
      const gib = await lendTrait('Gibbering');
      const ring = await ringOf('Gibbering');
      ok('6a. Gibbering lent: a ring rises off the save activity\'s Emanation', !!ring && (ring.shapes?.[0]?.radius > 0), `ring=${!!ring}`);
      await moveVictim(1);
      await startCombat();
      const n0 = triggerCards().length;
      await combat.nextTurn();   // the Victim's turn STARTS inside
      const card = await waitFor(() => triggerCards().find(m => (m.timestamp >= t6) && (m.getFlag(MOD, 'emanationTrigger')?.cause === 'turnStart') && (m.getFlag(MOD, 'emanationTrigger')?.key === 'Gibbering')) ?? null, 10000);
      const sv = card?.getFlag(MOD, 'saves');
      ok('6b. the Victim starting its turn inside is demanded the Wisdom save — cause turnStart, the trait\'s DC, pinned to it',
        !!card && (sv?.abilities?.[0] === 'wis') && (sv?.targets?.length === 1) && (sv.targets[0].uuid === victim.uuid) && /started its turn inside/.test(card?.content ?? ''),
        `card=${!!card} saves=${JSON.stringify(sv && { abilities: sv.abilities, dc: sv.dc, targets: sv.targets.map(t => t.name) })}`);
      await waitFor(() => game.messages.get(card?.id)?.getFlag(MOD, 'saves')?.targets?.[0]?.applied ? true : null, 15000);
      await setIncapacitated(monster, true);
      await waitFor(() => featureRegion('Gibbering')?.behaviors?.find(b => b.type === TYPE)?.disabled ? true : null, 8000);
      const n1 = triggerCards().length;
      await combat.nextTurn();   // the Monster
      await sleep(300);
      await combat.nextTurn();   // the Victim again — the ring disabled
      await sleep(1000);
      ok('6c. the Monster Incapacitated: the ring stands disabled and the next turn start asks nothing', (triggerCards().length === n1) && !!featureRegion('Gibbering')?.behaviors?.find(b => b.type === TYPE)?.disabled, `cards=${triggerCards().length} (was ${n1}, before ${n0})`);
      await setIncapacitated(monster, false);
      await endCombat();
      await gib.delete();
      await waitFor(() => featureRegion('Gibbering') ? null : true, 8000);
      await clearVictim();
    }

    // ================================================== 7. the alerts — Watery Rebuke (move-in), Unnerving Gaze (turn start)
    if (want(7)) {
      await moveVictim(4);   // 20 ft away: outside a 5-ft ring
      const rebuke = await lendTrait('Watery Rebuke');
      const ring = await ringOf('Watery Rebuke');
      const beh = ring?.behaviors?.find(b => b.type === TYPE);
      ok('7a. Watery Rebuke lent: a quiet 5-foot ring rises, harmful, no effect', !!ring && (beh?.system?.reach === 'harmful') && (beh?.system?.effect === null), `ring=${!!ring} reach=${beh?.system?.reach}`);
      const t7 = Date.now();
      await victimToken.document.update({ x: monsterToken.document.x + g, y: monsterToken.document.y }, { animate: false });   // a real move, into the ring
      const card = await waitFor(() => notices('Watery Rebuke').find(m => m.timestamp >= t7) ?? null, 10000);
      const n = card?.getFlag(MOD, 'hewNotice');
      ok('7b. the Victim moving within 5 feet raises the Monster\'s reminder: the trait, the swing, the Reaction from the sheet',
        !!card && (n?.attackerUuid === monster.uuid) && (n?.itemName === 'Watery Rebuke') && (n?.cause === 'moveIn') && /Watery Rebuke — .* entered/.test(card?.content ?? '') && /Trait — Watery Rebuke/.test(card?.content ?? ''),
        `card=${!!card} flag=${JSON.stringify(n && { attacker: n.attackerUuid === monster.uuid, item: n.itemName, cause: n.cause })}`);
      await rebuke.delete();
      await waitFor(() => featureRegion('Watery Rebuke') ? null : true, 8000);
      // Unnerving Gaze: the turn start inside 30 feet.
      const gaze = await lendTrait('Unnerving Gaze');
      await ringOf('Unnerving Gaze');
      await moveVictim(2);   // 10 ft: inside
      await startCombat();
      const t7b = Date.now();
      await combat.nextTurn();   // the Victim's turn starts inside
      const c2 = await waitFor(() => notices('Unnerving Gaze').find(m => m.timestamp >= t7b) ?? null, 10000);
      const n2 = c2?.getFlag(MOD, 'hewNotice');
      ok('7c. the Victim STARTING its turn within 30 feet raises Unnerving Gaze\'s reminder — cause turnStart, the card says so',
        !!c2 && (n2?.cause === 'turnStart') && (n2?.itemName === 'Unnerving Gaze') && /started its turn within/.test(c2?.content ?? ''),
        `card=${!!c2} flag=${JSON.stringify(n2 && { cause: n2.cause, item: n2.itemName })}`);
      const k = notices('Unnerving Gaze').length;
      await combat.nextTurn();   // the Monster
      await sleep(300);
      await combat.nextTurn();   // the Victim again: a second turn, a second reminder
      await waitFor(() => notices('Unnerving Gaze').length > k ? true : null, 8000);
      ok('7d. the next turn start raises it again — once per turn, not once ever', notices('Unnerving Gaze').length === k + 1, `notices=${notices('Unnerving Gaze').length} (was ${k})`);
      await endCombat();
      await gaze.delete();
      await waitFor(() => featureRegion('Unnerving Gaze') ? null : true, 8000);
      await moveVictim(1);
    }

    // ================================================== 8. Chaos Blade — the random condition on a hit
    if (want(8)) {
      await healFull();
      await moveVictim(1);
      const priorAc = { calc: victim.system._source.attributes.ac.calc, flat: victim.system._source.attributes.ac.flat };
      await victim.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });   // every swing hits
      const blade = await lendTrait('Chaos Blade');
      const attack = actOf(blade, { type: 'attack' });
      ok('8-pre. the pack ships the attack with its four numbered effects', !!attack && (blade.effects.size === 4) && blade.effects.some(e => /^1\s*:/.test(e.name)), `attack=${!!attack} effects=${blade.effects.map(e => e.name).join('|')}`);
      const damageFor = originId => game.messages.contents.find(m => (m.type === 'damage') && (m._source.system?.origin === originId));
      const offerEl = () => [...foundry.applications.instances.values()].map(a => a.element).find(el => (el?.innerHTML ?? '').includes('Damage — your roll')) ?? null;
      const swing = async act => {
        monsterToken.control({ releaseOthers: true });
        target();
        await sleep(80);
        const results = await act.use({ subsequentActions: false, consume: { uses: false, resources: false } }, { configure: false }, {});
        const rolls = await act.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'system.origin': results.message.id } } : {});
        const attackMsg = rolls?.[0]?.parent ?? null;
        const originId = attackMsg?._source.system?.origin ?? attackMsg?.id;
        const offer = await waitFor(offerEl, 2500);
        offer?.querySelector('button[data-action="roll"]')?.click();
        const dmg = await waitFor(() => { const d = damageFor(originId); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
        return { attackMsg, dmg };
      };
      const before = new Set(victim.effects.map(e => e.id));
      const { attackMsg, dmg } = await swing(attack);
      const hit = attackMsg?.rolls?.[0]?.total >= 1;
      await waitFor(() => dmg?.getFlag(MOD, 'clockRiders')?.riders?.[0]?.random?.face ? true : null, 10000);
      const cr = game.messages.get(dmg?.id)?.getFlag(MOD, 'clockRiders');
      const rider = cr?.riders?.find(r => r.key === 'chaos-blade');
      log.push(`§8 attack clockPick=${JSON.stringify(attackMsg?.getFlag(MOD, 'clockPick'))} attackFlags=${Object.keys(attackMsg?.flags?.[MOD] ?? {}).join(',')} dmgFlags=${Object.keys(game.messages.get(dmg?.id)?.flags?.[MOD] ?? {}).join(',')} riders=${JSON.stringify(cr?.riders?.map(r => r.key))}`);
      const landed = victim.effects.filter(e => !before.has(e.id) && !e.statuses?.has?.('bloodied'));   // Bloodied is the platform's, on any damage
      ok('8a. the hit lands: the rider rode (self, no extra dice), its d4 rolled, the face and the landed name on the record',
        hit && !!dmg && !!rider && (rider.formula === null) && (rider.random?.face >= 1) && (rider.random?.face <= 4) && (rider.random?.landed?.length === 1) && new RegExp(`^${rider.random?.face}\\s*:`).test(rider.random?.landed?.[0] ?? ''),
        `hit=${hit} dmg=${!!dmg} rider=${JSON.stringify(rider && { formula: rider.formula, random: rider.random })}`);
      ok('8b. exactly ONE of the four conditions stands on the Victim — the one the face named — receipted on the damage card',
        (landed.length === 1) && (landed[0].name === rider?.random?.landed?.[0]) && !!game.messages.get(dmg?.id)?.getFlag(MOD, 'effectReceipt'),
        `landed=${landed.map(e => e.name).join('|')} receipt=${!!game.messages.get(dmg?.id)?.getFlag(MOD, 'effectReceipt')}`);
      await clearVictim();
      // Another attack of the Monster's: the rider is Chaos Blade's alone.
      const other = await lendTrait('Claw');
      const before2 = new Set(victim.effects.map(e => e.id));
      const { dmg: dmg2 } = await swing(actOf(other, { type: 'attack' }));
      await sleep(800);
      ok('8c. a Claw hit rides no Chaos Blade: no rider record, nothing landed',
        !!dmg2 && !game.messages.get(dmg2.id)?.getFlag(MOD, 'clockRiders')?.riders?.some(r => r.key === 'chaos-blade') && (victim.effects.filter(e => !before2.has(e.id) && !e.statuses?.has?.('bloodied')).length === 0),
        `dmg=${!!dmg2} riders=${JSON.stringify(game.messages.get(dmg2?.id)?.getFlag(MOD, 'clockRiders')?.riders?.map(r => r.key))} landed=${victim.effects.filter(e => !before2.has(e.id) && !e.statuses?.has?.('bloodied')).length}`);
      await victim.update({ 'system.attributes.ac.calc': priorAc.calc, 'system.attributes.ac.flat': priorAc.flat });
      await clearVictim();
      await takeBack('Chaos Blade');
      await takeBack('Claw');
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'monsters', out, plan, f });
