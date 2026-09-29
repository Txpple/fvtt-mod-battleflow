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
  'turn-grants.js'          // §3 — the grappled target's damage at its own turn start (Constricting Vine) and turn end (Swarm of Proboscises); §4 the grappler's own turn start (Barbed Hide)
];

const SECTIONS = {
  1: 'PACIFYING SPORES: the Monster\'s save fails the Victim (Stunned lands from the trait); the Victim\'s turn END raises the repeat — Constitution at the trait\'s DC, not a spell; a failure holds, a success ends it',
  2: 'PETRIFYING BITE: the First Save lands Restrained; the turn end repeats on the SECOND Save; the failure presses Petrified INSTEAD — the Restrained gone, the card says so',
  3: 'CONSTRICTING VINE and SWARM OF PROBOSCISES: the grappled Victim takes the vine\'s "Damage: Grappled" at its own turn START, receipted; the swarm\'s at its turn END; nothing once the grapple ends',
  4: 'BARBED HIDE: the Monster\'s own turn start deals its damage to the creature it grapples (the Victim, Grappled by it), receipted; nothing when it grapples no one'
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

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'monsters', out, plan, f });
