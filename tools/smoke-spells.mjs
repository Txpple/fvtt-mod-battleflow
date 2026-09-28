// Live suite: THE SPELLS SLICE (HANDOFF.md, 2026-09-28) — the turn-start grant (Heroism's Temporary Hit
// Points, rolled again on the caster at each of the bearer's turn starts) and the repeating save (Hold
// Person's Paralyzed demanded at the bearer's turn end; a success removes it through the cast card's
// receipt and the card says so; a failure keeps it; damage raises Tasha's with Advantage; Otto's is offered
// as the bearer's action; Flesh to Stone counts its failures to Petrified).
//
// Fixtures: BF Test Cleric (tools/fixture-suite.mjs) is lent the PHB's spells; BF Test Victim is the one
// they land on, its own linked token placed on the test range. Settings, lent items, effects, hit points,
// the combat and messages are put back. The demanded saves ROLL THEMSELVES here (`saveRolls` auto), the
// verdict steered by the Victim's Wisdom save bonus (±30).
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'turn-grants.js',         // §1 — Heroism's temp HP at the bearer's turn start, once per turn, receipted
  'repeat-saves.js'         // §2–§5 — the repeat at the turn end, on damage, as the action; the count
];

const SECTIONS = {
  1: 'Heroism: the cast lands Bravery and the temp HP once; each of the Victim\'s turn starts pays them again on the Cleric\'s modifier — a card, a receipt, once per turn',
  2: 'Hold Person: the Victim\'s turn END raises the repeat (a saves demand pinned to it, Wisdom, the spell\'s DC, effectsHandled "repeat"); a failure keeps Paralyzed and the card says so; a success removes it through the cast card\'s receipt (reverted), the card says it ended, the line renders',
  3: 'Tasha\'s Hideous Laughter: damage landing on the Victim raises the repeat with the demand\'s own Advantage (the auto roll rolls it); healing raises nothing; a second turn end while one is unanswered raises no second',
  4: 'Otto\'s Irresistible Dance: the Victim\'s turn START offers the save as its action (a card with a button, no demand); the button raises the demand; a success ends the dance',
  5: 'Flesh to Stone: three failures at three turn ends — the tally on the effect (1, 2), the third pressing Petrified and locking (a fourth turn end asks nothing)'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'spells', watchdogMs: 600_000 });
announcePlan('spells', plan, pulled);

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

  const SETTING_KEYS = ['decisionTimer', 'dramaticBeat', 'saveRolls'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const cleric = game.actors.getName('BF Test Cleric');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !cleric || !victim) return { fatal: 'missing fixture: the test range, BF Test Cleric or BF Test Victim — run tools/fixture-suite.mjs' };

  const lent = [];
  const placed = [];
  let combat = null;
  const priorActiveCombats = [];
  const priorHp = { value: victim.system._source.attributes.hp.value, max: victim.system._source.attributes.hp.max, temp: victim.system._source.attributes.hp.temp };
  const priorWis = victim.system._source.abilities?.wis?.save?.roll?.bonus ?? '';
  const priorCon = victim.system._source.abilities?.con?.save?.roll?.bonus ?? '';
  const priorVictimEffects = new Set(victim.effects.map(e => e.id));
  const priorClericEffects = new Set(cleric.effects.map(e => e.id));
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
      const cstrays = cleric.effects.filter(e => !priorClericEffects.has(e.id)).map(e => e.id);
      if (cstrays.length) await cleric.deleteEmbeddedDocuments('ActiveEffect', cstrays);
      const live = lent.filter(id => cleric.items.get(id));
      if (live.length) await cleric.deleteEmbeddedDocuments('Item', live);
      const tokens = placed.filter(id => scene.tokens.get(id));
      if (tokens.length) await scene.deleteEmbeddedDocuments('Token', tokens);
      await victim.update({ 'system.attributes.hp.value': priorHp.value, 'system.attributes.hp.max': priorHp.max, 'system.attributes.hp.temp': priorHp.temp,
        'system.abilities.wis.save.roll.bonus': priorWis, 'system.abilities.con.save.roll.bonus': priorCon });
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && ((m.speaker?.actor === cleric.id) || (m.speaker?.actor === victim.id) || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('decisionTimer', 0);
    await set('dramaticBeat', 0);
    await set('saveRolls', 'auto');   // the demanded saves roll themselves; the bonus steers the verdict

    const lend = async (name, type) => {
      if (cleric.items.some(i => (i.name === name) && (i.type === type))) return cleric.items.find(i => (i.name === name) && (i.type === type));
      for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
        const hit = (await pack.getIndex()).find(e => (e.name === name) && (e.type === type));
        if (!hit) continue;
        const src = await pack.getDocument(hit._id);
        const data = src.toObject();
        data.system.prepared = 1;
        if (Number(data.system.level) > 2) data.system.level = 1;   // a level-5 Cleric has no 6th-level slot; the DC does not read the level
        const [item] = await cleric.createEmbeddedDocuments('Item', [data]);
        lent.push(item.id);
        return item;
      }
      return null;
    };
    const spells = {};
    for (const name of ['Heroism', 'Hold Person', "Tasha's Hideous Laughter", "Otto's Irresistible Dance", 'Flesh to Stone']) {
      spells[name] = await lend(name, 'spell');
      if (!spells[name]) return { fatal: `the PHB ships no "${name}" this box can find`, results, log, skips };
    }
    const actOf = (name, type) => cleric.items.get(spells[name].id)?.system.activities.find(a => a.type === type) ?? null;

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const g = scene.grid.size;
    const occupied = (x, y) => scene.tokens.some(t => (t.x < (x + 1) * g) && ((t.x + t.width * g) > x * g) && (t.y < (y + 1) * g) && ((t.y + t.height * g) > y * g));
    let spot = null;
    for (let y = 2; (y < 18) && !spot; y++) for (let x = 2; (x < 18) && !spot; x++) if (!occupied(x, y) && !occupied(x + 1, y)) spot = { x, y };
    if (!spot) return { fatal: 'no free square on the test range for the tokens', results, log, skips };
    const place = async (actor, dx) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(actor.prototypeToken.toObject(),
        { x: (spot.x + dx) * g, y: spot.y * g, actorId: actor.id, actorLink: true }, { inplace: false })]);
      placed.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      return canvas.tokens.get(doc.id);
    };
    const victimToken = await place(victim, 0);
    const clericToken = await place(cleric, 1);
    if (!victimToken || !clericToken) return { fatal: 'the tokens never reached the canvas', results, log, skips };

    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const target = () => { game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); }); victimToken.setTarget(true, { releaseOthers: true }); };
    const wisBonus = v => victim.update({ 'system.abilities.wis.save.roll.bonus': v });
    /** The save bonus on the ability a spell's save names (Flesh to Stone is Constitution). */
    const saveBonusFor = (name, v) => victim.update({ [`system.abilities.${actOf(name, 'save')?.save?.ability?.[0] ?? 'wis'}.save.roll.bonus`]: v });
    const healFull = () => victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });
    const effectNamed = name => victim.effects.find(e => e.name === name) ?? null;
    const clearVictim = async () => {
      const strays = victim.effects.filter(e => !priorVictimEffects.has(e.id)).map(e => e.id);
      if (strays.length) await victim.deleteEmbeddedDocuments('ActiveEffect', strays);
      await cleric.endConcentration?.().catch?.(() => {});
    };
    const repeatCards = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'repeatSave'));
    const offerCards = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'repeatOffer'));
    const grantCards = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'turnGrant'));
    const settledRepeat = async (n, timeout = 15000) => waitFor(() => {
      const cards = repeatCards();
      const c = cards[n - 1];
      return (cards.length >= n) && c?.getFlag(MOD, 'repeatSave')?.says ? c : null;
    }, timeout);

    /** Cast a save spell at the Victim with the save steered: the demand card, its verdict done. */
    const castAt = async (name, bonus) => {
      await saveBonusFor(name, bonus);
      target();
      await sleep(120);
      const use = await actOf(name, 'save').use({ consume: { spellSlot: false } }, { configure: false }, {});
      const card = use?.message instanceof ChatMessage ? use.message : null;
      if (!card) return null;
      await waitFor(() => card.getFlag(MOD, 'saves')?.targets?.[0]?.applied ? true : null, 15000);
      return card;
    };

    const startCombat = async () => {
      for (const c of game.combats.filter(c => c.active)) { priorActiveCombats.push(c.id); await c.update({ active: false }); }
      combat = await Combat.create({ scene: scene.id, active: true });
      await combat.createEmbeddedDocuments('Combatant', [{ tokenId: clericToken.id, actorId: cleric.id, initiative: 20 }, { tokenId: victimToken.id, actorId: victim.id, initiative: 10 }]);
      await combat.startCombat();   // the Cleric's turn
      if (game.combat?.id !== combat.id) { try { ui.combat.viewed = combat; } catch { /* the tracker */ } }
      await sleep(300);
    };
    const endCombat = async () => {
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      combat = null;
    };

    // ================================================== 1. Heroism
    if (want(1)) {
      await healFull();
      const mod = Number(cleric.system.abilities?.wis?.mod ?? 0);
      target();
      await sleep(120);
      const use = await actOf('Heroism', 'heal').use({ consume: { spellSlot: false } }, { configure: false }, {});
      const card = use?.message instanceof ChatMessage ? use.message : null;
      const bravery = await waitFor(() => effectNamed('Bravery'), 12000);
      ok('1a. the cast lands Bravery on the Victim, its origin the Cleric\'s Heroism (the applier\'s stamp)',
        !!card && !!bravery && (bravery.system?.origin?.item === cleric.items.get(spells.Heroism.id)?.uuid),
        `card=${!!card} bravery=${!!bravery} origin=${bravery?.system?.origin?.item}`);
      await startCombat();
      const n0 = grantCards().length;
      await combat.nextTurn();   // the Victim's turn starts
      const grant = await waitFor(() => grantCards()[n0] ?? null, 10000);
      const receipt = await waitFor(() => grant?.getFlag(MOD, 'receipt'), 8000);
      const tg = grant?.getFlag(MOD, 'turnGrant');
      ok('1b. the Victim\'s turn start pays the temp HP again: a card naming Heroism, the Cleric\'s modifier as temphp, receipted on it',
        !!grant && (tg?.key === 'Heroism') && (tg?.type === 'temphp') && (tg?.total === mod) && !!receipt && (Number(victim.system.attributes.hp.temp) === mod),
        `card=${!!grant} flag=${JSON.stringify(tg && { key: tg.key, type: tg.type, total: tg.total })} receipt=${!!receipt} temp=${victim.system.attributes.hp.temp} mod=${mod}`);
      await combat.nextTurn();   // the Cleric — round 2
      await sleep(400);
      ok('1c. the Cleric\'s turn pays nothing', grantCards().length === n0 + 1, `cards=${grantCards().length}`);
      await combat.nextTurn();   // the Victim again
      const second = await waitFor(() => grantCards()[n0 + 1] ?? null, 10000);
      ok('1d. the next round pays once more — once per turn, one card each', !!second && (grantCards().length === n0 + 2), `cards=${grantCards().length}`);
      await combat.previousTurn?.();
      await sleep(300);
      ok('1e. a backward step pays nothing', grantCards().length === n0 + 2, `cards=${grantCards().length}`);
      await endCombat();
      await clearVictim();
    }

    // ================================================== 2. Hold Person at the turn end
    if (want(2)) {
      await healFull();
      const cast = await castAt('Hold Person', '-30');
      const paralyzed = await waitFor(() => effectNamed('Paralyzed'), 8000);
      ok('2a. Hold Person fails the Victim: Paralyzed stands, receipted on the cast card', !!cast && !!paralyzed && !!cast?.getFlag(MOD, 'effectReceipt')?.targets?.some(t => t.effects?.some(e => e.id === paralyzed.id)),
        `cast=${!!cast} paralyzed=${!!paralyzed} outcome=${cast?.getFlag(MOD, 'saves')?.targets?.[0]?.outcome}`);
      await startCombat();
      const n0 = repeatCards().length;
      await combat.nextTurn();   // → the Victim's turn
      await sleep(400);
      ok('2b. the Victim\'s turn START raises nothing (Hold Person repeats at the END)', repeatCards().length === n0, `cards=${repeatCards().length}`);
      await combat.nextTurn();   // the Victim's turn ENDS
      const first = await settledRepeat(n0 + 1);
      const f1 = first?.getFlag(MOD, 'saves');
      const r1 = first?.getFlag(MOD, 'repeatSave');
      ok('2c. the turn end raises a saves demand pinned to the Victim — Wisdom, the spell\'s DC, effectsHandled "repeat", the cast\'s activity',
        !!first && (f1?.abilities?.[0] === 'wis') && (f1?.dc === actOf('Hold Person', 'save')?.save?.dc?.value) && (f1?.effectsHandled === 'repeat')
          && (f1?.targets?.length === 1) && (f1.targets[0].uuid === victim.uuid) && (f1?.activityUuid === actOf('Hold Person', 'save')?.uuid) && f1?.pinnedTargets,
        `flag=${JSON.stringify(f1 && { abilities: f1.abilities, dc: f1.dc, handled: f1.effectsHandled, targets: f1.targets.map(t => t.name), pinned: f1.pinnedTargets })}`);
      ok('2d. the save failed (−30): Paralyzed holds and the card says so',
        (f1?.targets?.[0]?.outcome === 'failed') && !!effectNamed('Paralyzed') && (r1?.says === 'Paralyzed holds — the save failed') && (r1?.ended === false) && (r1?.cause === 'turnEnd'),
        `outcome=${f1?.targets?.[0]?.outcome} paralyzed=${!!effectNamed('Paralyzed')} says="${r1?.says}"`);
      await wisBonus('+30');
      await combat.nextTurn();   // the Cleric
      await sleep(300);
      await combat.nextTurn();   // the Victim
      await sleep(300);
      await combat.nextTurn();   // the Victim's turn ends again
      const second = await settledRepeat(n0 + 2);
      const f2 = second?.getFlag(MOD, 'saves');
      const r2 = second?.getFlag(MOD, 'repeatSave');
      await waitFor(() => effectNamed('Paralyzed') ? null : true, 6000);
      const receiptEntry = cast?.getFlag(MOD, 'effectReceipt')?.targets?.find(t => t.uuid === victim.uuid)?.effects?.find(e => e.id === paralyzed?.id);
      ok('2e. the save succeeded (+30): Paralyzed is REMOVED through the cast card\'s receipt (reverted), the card says it ended',
        (f2?.targets?.[0]?.outcome === 'saved') && !effectNamed('Paralyzed') && (r2?.ended === true) && (r2?.says === 'Paralyzed ended — the save succeeded') && (receiptEntry?.reverted === true),
        `outcome=${f2?.targets?.[0]?.outcome} paralyzed=${!!effectNamed('Paralyzed')} says="${r2?.says}" reverted=${receiptEntry?.reverted}`);
      const line = await waitFor(() => document.querySelector(`[data-message-id="${second?.id}"] .bf-repeat-line`) ?? null, 6000);
      ok('2f. the line renders on the card', /Paralyzed ended/.test(line?.textContent ?? ''), `line="${line?.textContent?.trim()}"`);
      await combat.nextTurn();   // the Cleric
      await sleep(300);
      await combat.nextTurn();   // the Victim
      await sleep(300);
      await combat.nextTurn();   // the Victim's turn ends with no effect standing
      await sleep(800);
      ok('2g. with the effect gone, a turn end raises nothing', repeatCards().length === n0 + 2, `cards=${repeatCards().length}`);
      await endCombat();
      await clearVictim();
    }

    // ================================================== 3. Tasha's on damage
    if (want(3)) {
      await healFull();
      const cast = await castAt("Tasha's Hideous Laughter", '-30');
      const laughing = await waitFor(() => effectNamed('Uncontrollable Laughter'), 8000);
      ok('3a. the laughter lands', !!cast && !!laughing, `cast=${!!cast} effect=${!!laughing}`);
      const n0 = repeatCards().length;
      await victim.applyDamage([{ value: 3, type: 'bludgeoning' }]);
      const card = await settledRepeat(n0 + 1);
      const flag = card?.getFlag(MOD, 'saves');
      const rep = card?.getFlag(MOD, 'repeatSave');
      const roll = flag?.targets?.[0]?.rollMessageId ? game.messages.get(flag.targets[0].rollMessageId) : null;
      const rollAdv = roll?.rolls?.[0]?.options?.advantage ?? roll?.rolls?.[0]?.hasAdvantage ?? null;
      ok('3b. damage raises the repeat (cause damaged) with the demand\'s own Advantage; the auto roll rolls it with Advantage',
        !!card && (rep?.cause === 'damaged') && (flag?.demand?.bend?.mode === 'advantage') && (rollAdv === true),
        `cause=${rep?.cause} bend=${JSON.stringify(flag?.demand?.bend)} rollAdv=${rollAdv} formula=${roll?.rolls?.[0]?.formula}`);
      ok('3c. the save failed: the laughter holds', (flag?.targets?.[0]?.outcome === 'failed') && !!effectNamed('Uncontrollable Laughter'), `outcome=${flag?.targets?.[0]?.outcome}`);
      await victim.applyDamage([{ value: 5, type: 'healing' }]);
      await sleep(800);
      ok('3d. healing raises nothing', repeatCards().length === n0 + 1, `cards=${repeatCards().length}`);
      // An unanswered repeat blocks a second: prompt mode leaves the demand open, then a turn end asks nothing more.
      await set('saveRolls', 'prompt');
      const t0 = Date.now();
      await victim.applyDamage([{ value: 2, type: 'bludgeoning' }]);
      const open = await waitFor(() => repeatCards().find(m => m.timestamp >= t0) ?? null, 8000);
      await sleep(400);
      await victim.applyDamage([{ value: 2, type: 'bludgeoning' }]);
      await sleep(800);
      ok('3e. while a repeat is unanswered, more damage raises no second one', !!open && (open.getFlag(MOD, 'saves')?.status === 'pending') && (repeatCards().length === n0 + 2),
        `open=${!!open} status=${open?.getFlag(MOD, 'saves')?.status} cards=${repeatCards().length}`);
      for (const app of [...foundry.applications.instances.values()]) { if (app.rendered && app.element?.querySelector?.('[data-bf-save-demand]')) { try { await app.close(); } catch { /* gone */ } } }
      await set('saveRolls', 'auto');
      await clearVictim();
    }

    // ================================================== 4. Otto's: the action, offered
    if (want(4)) {
      await healFull();
      const cast = await castAt("Otto's Irresistible Dance", '-30');
      const dance = await waitFor(() => effectNamed('Irresistible Dance'), 8000);
      ok('4a. the dance lands', !!cast && !!dance, `cast=${!!cast} effect=${!!dance}`);
      await startCombat();
      const n0 = repeatCards().length;
      const o0 = offerCards().length;
      await combat.nextTurn();   // the Victim's turn starts
      const offer = await waitFor(() => offerCards()[o0] ?? null, 8000);
      const of = offer?.getFlag(MOD, 'repeatOffer');
      await sleep(400);
      ok('4b. the Victim\'s turn start OFFERS the save (a card, no demand): the effect named, the button drawn',
        !!offer && (of?.key === "Otto's Irresistible Dance") && (repeatCards().length === n0)
          && !![...(document.querySelector(`[data-message-id="${offer?.id}"]`)?.querySelectorAll('button') ?? [])].find(b => /Repeat the save/.test(b.textContent ?? '')),
        `offer=${!!offer} key=${of?.key} demands=${repeatCards().length - n0}`);
      await combat.nextTurn();   // the Victim's turn ENDS — an action row asks nothing by the clock
      await sleep(800);
      ok('4c. the turn end raises no demand for an action row', repeatCards().length === n0, `cards=${repeatCards().length}`);
      await wisBonus('+30');
      const button = [...(document.querySelector(`[data-message-id="${offer?.id}"]`)?.querySelectorAll('button') ?? [])].find(b => /Repeat the save/.test(b.textContent ?? ''));
      button?.click();
      const card = await settledRepeat(n0 + 1);
      const rep = card?.getFlag(MOD, 'repeatSave');
      await waitFor(() => effectNamed('Irresistible Dance') ? null : true, 6000);
      ok('4d. the button raises the demand (cause action); the success ends the dance', !!card && (rep?.cause === 'action') && (rep?.ended === true) && !effectNamed('Irresistible Dance'),
        `card=${!!card} cause=${rep?.cause} ended=${rep?.ended} dance=${!!effectNamed('Irresistible Dance')}`);
      await endCombat();
      await clearVictim();
    }

    // ================================================== 5. Flesh to Stone: the count
    if (want(5)) {
      await healFull();
      const cast = await castAt('Flesh to Stone', '-30');
      const stone = await waitFor(() => effectNamed('Turning to Stone'), 8000);
      ok('5a. Turning to Stone lands', !!cast && !!stone, `cast=${!!cast} effect=${!!stone}`);
      await startCombat();
      const n0 = repeatCards().length;
      const endTurn = async () => { await combat.nextTurn(); await sleep(300); await combat.nextTurn(); };
      await combat.nextTurn();   // → the Victim
      await sleep(300);
      await combat.nextTurn();   // ends — the first failure
      const c1 = await settledRepeat(n0 + 1);
      const t1 = effectNamed('Turning to Stone')?.getFlag(MOD, 'repeatCount');
      ok('5b. the first failure tallies on the effect (1 of 3) and the card counts', (t1?.fails === 1) && (c1?.getFlag(MOD, 'repeatSave')?.says === 'Turning to Stone holds — 1 of 3 failures'),
        `tally=${JSON.stringify(t1)} says="${c1?.getFlag(MOD, 'repeatSave')?.says}"`);
      await endTurn();
      const c2 = await settledRepeat(n0 + 2);
      ok('5c. the second: 2 of 3', (effectNamed('Turning to Stone')?.getFlag(MOD, 'repeatCount')?.fails === 2) && /2 of 3/.test(c2?.getFlag(MOD, 'repeatSave')?.says ?? ''),
        `tally=${JSON.stringify(effectNamed('Turning to Stone')?.getFlag(MOD, 'repeatCount'))}`);
      await endTurn();
      const c3 = await settledRepeat(n0 + 3);
      const petrified = await waitFor(() => victim.statuses?.has?.('petrified') ? true : null, 6000);
      const t3 = effectNamed('Turning to Stone')?.getFlag(MOD, 'repeatCount');
      ok('5d. the third failure presses Petrified, locks the count, and the effect stands under it',
        !!petrified && (t3?.fails === 3) && (t3?.locked === true) && !!effectNamed('Turning to Stone') && /third failure: Petrified/.test(c3?.getFlag(MOD, 'repeatSave')?.says ?? ''),
        `petrified=${!!petrified} tally=${JSON.stringify(t3)} says="${c3?.getFlag(MOD, 'repeatSave')?.says}"`);
      await endTurn();
      await sleep(800);
      ok('5e. locked: a fourth turn end asks nothing', repeatCards().length === n0 + 3, `cards=${repeatCards().length}`);
      await endCombat();
      await clearVictim();
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'spells', out, plan, f });
