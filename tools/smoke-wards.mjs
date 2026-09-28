// Live suite: THE SPELLS SLICE, TIER 3 (RULINGS *The spells slice — Tier 3*, 2026-09-28) — Sanctuary's gate
// before the roll (the attacker's save demanded, a failure turning the attack aside, a success making the
// attack again; the same before a damaging spell's cast; the ward ending on its bearer's own attack) and
// Mirror Image's duplicates rolled on a hit that stands (a duplicate destroyed and the hit absorbed; the hit
// through on low dice; the last duplicate ending it; an attacker with Blindsight rolling nothing).
//
// Fixtures: BF Test Attacker (the goblin) swings a lent club with FLAT damage (no damage dice, so the PRNG
// queue is the d20 then the d6s); BF Test Victim wears Sanctuary's Warded from BF Test Cleric's lent spell;
// BF Test Sorcerer wears Mirror Image's three duplicates from its own lent spell. Settings, lent items,
// effects, hit points, the tokens and messages are put back.
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'wards.js',              // §1–§4 — the gate at the roll and at the cast, the verdict, the end
  'hold/trigger.js',       // §5–§8 — the duplicates stamped on the hold
  'hold/continue.js',      // §5–§7 — the duplicates rolled on the hit that stands, the effect landed
  'hold/lookup.js'         // §5, §8 — the duplicates read, who sees through
];

const SECTIONS = {
  1: 'Sanctuary at the ROLL: the goblin attacks the warded Victim — no attack roll; a save demand card for the goblin (Wisdom, the Cleric\'s DC, effectsHandled "ward"); the save FAILS: the card says turned aside, no attack message follows',
  2: 'Sanctuary at the roll, the save PASSES: the attack is made again with the pass in hand — an attack message follows, one demand only',
  3: 'Sanctuary at the CAST: the Cleric\'s Sacred Flame at the warded Victim is gated before its cast (a failure: no usage card); an AREA spell is not gated',
  4: 'the ward ENDS: the Warded goblin makes an attack roll — Warded leaves its sheet and a card says why',
  5: 'Mirror Image: a hit on the Sorcerer that stands rolls 3d6 in the open — a 3 or higher: the hold\'s entry reads "absorbed", one Duplicate effect deleted (C first), no damage applied, the card says a duplicate took it',
  6: 'Mirror Image: every die under 3 — the hit gets through, the damage applies, every duplicate stands',
  7: 'Mirror Image: one duplicate left and a 3 or higher — the last is destroyed and the card says the spell ended',
  8: 'Mirror Image: the attacker has Blindsight — no dice, no hold for it, a card says it sees through',
  9: 'a PLAYER CHARACTER (BF Test Fighter) at the warded Victim: gated, its save rolled by the elect, the attack made again on a pass'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'wards', watchdogMs: 600_000 });
announcePlan('wards', plan, pulled);

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
  const { WARDS, DUPLICATES } = await import('/modules/fvtt-mod-battleflow/scripts/decide/registry.js');
  if (!WARDS?.Sanctuary || !DUPLICATES?.['Mirror Image']) return { fatal: 'WARDS / DUPLICATES are not in the loaded code — OLD code (reload the box)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'holdTimer', 'holdReveal', 'holdSkipFutile', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk',
    'castApply', 'concMode', 'reminderList', 'damageEitherList', 'decisionTimer', 'saveRolls'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const victim = game.actors.getName('BF Test Victim');
  const cleric = game.actors.getName('BF Test Cleric');
  const sorcerer = game.actors.getName('BF Test Sorcerer');
  if (!scene || !attacker || !victim || !cleric || !sorcerer) return { fatal: 'missing fixture: the test range, BF Test Attacker, BF Test Victim, BF Test Cleric or BF Test Sorcerer — run tools/fixture-suite.mjs' };

  const created = { tokens: [], items: {} };
  const priorActor = {};
  const priorEffects = {};
  for (const a of [attacker, victim, sorcerer, cleric]) priorEffects[a.id] = new Set(a.effects.map(e => e.id));
  const priorSenses = foundry.utils.deepClone(attacker.system._source.attributes.senses ?? {});
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  /** The PRNG as a queue of faces `[n, of]`: each die takes the next; past the end, the last. */
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      if (/RollConfigurationDialog|ActivityUsageDialog|UsageDialog/.test(app.constructor?.name ?? '') || app.element?.querySelector?.('[data-bf-ticks]') || app.element?.querySelector?.('[data-bf-save-demand]')) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const strayEffects = async a => {
    const ids = a.effects.filter(e => !priorEffects[a.id].has(e.id)).map(e => e.id);
    if (ids.length) await a.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {});
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    CONFIG.Dice.randomUniform = realPRNG;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      for (const a of [attacker, victim, sorcerer, cleric]) await strayEffects(a);
      for (const [actorId, ids] of Object.entries(created.items)) {
        const a = game.actors.get(actorId);
        const live = ids.filter(id => a?.items.get(id));
        if (live.length) await a.deleteEmbeddedDocuments('Item', live);
      }
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
      await attacker.update({ 'system.attributes.senses': priorSenses });
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
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
    await set('reactionHold', true);
    await set('holdTimer', 0);
    await set('holdReveal', true);
    await set('holdSkipFutile', false);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('masteryAsk', false);
    await set('castApply', false);
    await set('concMode', 'off');
    await set('reminderList', '');
    await set('damageEitherList', '');
    await set('decisionTimer', 0);
    await set('saveRolls', 'auto');   // the demanded saves roll themselves; a ±30 bonus steers the verdict

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    // ⚠ No stray sweep: the range's fixture tokens (the Cleric's, the Sorcerer's — LINKED) belong to the other
    // suites; this one places its own beside them and deletes only those.
    const placeToken = async (actor, x, y) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const { token: atkTok } = await placeToken(attacker, 1400, 1700);
    const { token: vicTok } = await placeToken(victim, 1500, 1700);
    const { token: sorTok } = await placeToken(sorcerer, 1500, 1800);
    await placeToken(cleric, 1400, 1800);   // the ward's caster stands on the range too

    const lend = async (actor, name, type) => {
      const own = actor.items.find(i => (i.name === name) && (i.type === type));
      if (own) return own;
      for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
        const hit = (await pack.getIndex()).find(e => (e.name === name) && (e.type === type));
        if (!hit) continue;
        const data = (await pack.getDocument(hit._id)).toObject();
        delete data._id;
        if (type === 'spell') { data.system.prepared = 1; data.system.method = 'atwill'; }
        const [item] = await actor.createEmbeddedDocuments('Item', [data]);
        (created.items[actor.id] ??= []).push(item.id);
        return item;
      }
      return null;
    };
    // The goblin's club: FLAT damage, so the only dice on the table are the d20 and the duplicates' d6s.
    const [club] = await attacker.createEmbeddedDocuments('Item', [{ name: 'BF Test Club', type: 'weapon', system: {
      type: { value: 'simpleM' }, equipped: true, proficient: 1,
      damage: { base: { number: 0, denomination: 0, custom: { enabled: true, formula: '1' }, types: ['bludgeoning'] } },
      activities: { bfclub0000000000: { type: 'attack', _id: 'bfclub0000000000', name: 'Attack', attack: { ability: 'str', type: { value: 'melee', classification: 'weapon' } },
        damage: { includeBase: true, parts: [] }, activation: { type: 'action' }, range: { units: 'ft', reach: 5 } } } } }]);
    (created.items[attacker.id] ??= []).push(club.id);
    const act = () => attacker.items.get(club.id).system.activities.find(a => a.type === 'attack');
    const sanctuary = await lend(cleric, 'Sanctuary', 'spell');
    const mirror = await lend(sorcerer, 'Mirror Image', 'spell');
    const flame = await lend(attacker, 'Sacred Flame', 'spell');
    if (!sanctuary || !mirror || !flame) return { fatal: `the PHB ships no ${!sanctuary ? 'Sanctuary' : !mirror ? 'Mirror Image' : 'Sacred Flame'} this box can find`, results, log, skips };

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const target = tok => { game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); }); tok.setTarget(true, { releaseOthers: true }); };
    /** The pack's effect landed on a bearer from the lent spell (its origin the bearer's or the caster's own item). */
    const wear = async (bearer, item, names) => {
      const data = item.effects.filter(e => names.includes(e.name)).map(e => ({ ...e.toObject(), origin: item.uuid, disabled: false }));
      return bearer.createEmbeddedDocuments('ActiveEffect', data);
    };
    const wardCards = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag(MOD, 'ward'));
    const attackMessages = since => game.messages.contents.filter(m => (m.timestamp >= since) && (m.type === 'attack'));
    const wisBonus = (a, v) => a.update({ 'system.abilities.wis.save.roll.bonus': v });
    priorActor[attacker.id] = { 'system.abilities.wis.save.roll.bonus': attacker.system._source.abilities?.wis?.save?.roll?.bonus ?? '' };
    priorActor[cleric.id] = { 'system.abilities.dex.save.roll.bonus': cleric.system._source.abilities?.dex?.save?.roll?.bonus ?? '',
      'system.abilities.wis.save.roll.bonus': cleric.system._source.abilities?.wis?.save?.roll?.bonus ?? '' };
    priorActor[sorcerer.id] = { 'system.attributes.ac.calc': sorcerer.system._source.attributes.ac.calc, 'system.attributes.ac.flat': sorcerer.system._source.attributes.ac.flat,
      'system.attributes.hp.value': sorcerer.system._source.attributes.hp.value, 'system.attributes.hp.max': sorcerer.system._source.attributes.hp.max };
    priorActor[victim.id] = { 'system.attributes.hp.value': victim.system._source.attributes.hp.value };
    await sorcerer.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1, 'system.attributes.hp.max': 200, 'system.attributes.hp.value': 200 });
    const dupes = () => sorcerer.effects.filter(e => /^Duplicate [ABC]$/.test(e.name)).map(e => e.name).sort();
    const clearDupes = async () => { const ids = sorcerer.effects.filter(e => /^Duplicate [ABC]$/.test(e.name)).map(e => e.id); if (ids.length) await sorcerer.deleteEmbeddedDocuments('ActiveEffect', ids); };
    const clearWards = async () => { for (const a of [victim, attacker]) { const ids = a.effects.filter(e => e.name === 'Warded').map(e => e.id); if (ids.length) await a.deleteEmbeddedDocuments('ActiveEffect', ids); } };
    /** The goblin swings at a token with the d20 and the d6s forced; returns the attack message (or null when the gate held it). */
    const swing = async (tok, spec) => {
      atkTok.control({ releaseOthers: true });
      target(tok);
      await sleep(80);
      faces(spec);
      const rolls = await act().rollAttack({}, { configure: false }, {});
      return rolls?.[0]?.parent ?? null;
    };

    // ================================================== 1. Sanctuary at the roll — the save fails
    if (want(1)) {
      await clearWards();
      await wear(victim, sanctuary, ['Warded']);
      await wisBonus(attacker, -30);
      const t = Date.now();
      const msg = await swing(vicTok, [[15, 20]]);
      const card = await waitFor(() => wardCards().find(m => m.timestamp >= t) ?? null, 6000);
      const sv = card?.getFlag(MOD, 'saves');
      const w = card?.getFlag(MOD, 'ward');
      ok('1a. the attack does NOT roll: no attack message; a save demand card for the goblin — Wisdom, the Cleric\'s DC, effectsHandled "ward", pinned, the goblin the one target',
        !msg && !!card && (sv?.abilities?.[0] === 'wis') && (sv?.dc === sanctuary.system.activities.find(a => a.type === 'save')?.save?.dc?.value) && (sv?.effectsHandled === 'ward') && (sv?.pinnedTargets === true) && (sv?.targets?.length === 1) && (sv.targets[0].uuid === attacker.uuid) && (w?.gate === 'attack') && (w?.wardUuid === victim.uuid),
        `msg=${!!msg} card=${!!card} saves=${JSON.stringify(sv && { abilities: sv.abilities, dc: sv.dc, handled: sv.effectsHandled, pinned: sv.pinnedTargets, targets: sv.targets.map(x => x.name) })} ward=${JSON.stringify(w)}`);
      const settled = await waitFor(() => card?.getFlag(MOD, 'ward')?.settled ? card.getFlag(MOD, 'ward') : null, 10000);
      ok('1b. the save FAILS (−30): the ward settles "turned aside", and no attack message follows', (settled?.outcome === 'failed') && /turned aside/.test(settled?.says ?? '') && (attackMessages(t).length === 0),
        `settled=${JSON.stringify(settled && { outcome: settled.outcome, says: settled.says })} attacks=${attackMessages(t).length} verdict=${card?.getFlag(MOD, 'saves')?.targets?.[0]?.outcome}`);
      const el = await waitFor(() => document.querySelector(`[data-message-id="${card?.id}"] .bf-ward-line`) ?? null, 4000);
      ok('1c. the card renders the line: turned aside, choose a new target or the attack is lost', /turned aside/.test(el?.textContent ?? '') && /Choose a new target/.test(el?.textContent ?? ''), `line="${el?.textContent?.trim()}"`);
      ok('1d. Warded stands on the Victim (a failure ends nothing)', victim.effects.some(e => e.name === 'Warded'), '');
      await closeDialogs();
    }

    // ================================================== 2. Sanctuary at the roll — the save passes
    if (want(2)) {
      await clearWards();
      await wear(victim, sanctuary, ['Warded']);
      await wisBonus(attacker, 30);
      const t = Date.now();
      const first = await swing(vicTok, [[15, 20]]);
      const card = await waitFor(() => wardCards().find(m => m.timestamp >= t) ?? null, 6000);
      const settled = await waitFor(() => card?.getFlag(MOD, 'ward')?.settled ? card.getFlag(MOD, 'ward') : null, 10000);
      const atk = await waitFor(() => attackMessages(t)[0] ?? null, 8000);
      ok('2a. the first press rolled nothing; the save PASSES (+30); the attack is then made AGAIN with the pass in hand — one attack message, one demand', !first && (settled?.outcome === 'saved') && !!atk && (attackMessages(t).length === 1) && (wardCards().filter(m => m.timestamp >= t).length === 1),
        `first=${!!first} settled=${JSON.stringify(settled && { outcome: settled.outcome, says: settled.says })} attacks=${attackMessages(t).length} demands=${wardCards().filter(m => m.timestamp >= t).length}`);
      await sleep(600);
      ok('2b. the pass is spent: nothing else was demanded after the attack rolled', wardCards().filter(m => m.timestamp >= t).length === 1, `demands=${wardCards().filter(m => m.timestamp >= t).length}`);
      await closeDialogs();
    }

    // ================================================== 3. Sanctuary at the cast
    if (want(3)) {
      await clearWards();
      await wear(victim, sanctuary, ['Warded']);
      // The GOBLIN casts (an NPC: its save rolls on the elect, whoever else is connected); the DC is Sanctuary's.
      await wisBonus(attacker, -30);
      atkTok.control({ releaseOthers: true });
      target(vicTok);
      await sleep(80);
      const t = Date.now();
      const flameAct = attacker.items.get(flame.id).system.activities.find(a => a.type === 'save');
      const use = await flameAct.use({ consume: { spellSlot: false } }, { configure: false }, {});
      const card = await waitFor(() => wardCards().find(m => (m.timestamp >= t) && (m.getFlag(MOD, 'ward')?.gate === 'damagingSpell')) ?? null, 6000);
      const settled = await waitFor(() => card?.getFlag(MOD, 'ward')?.settled ? card.getFlag(MOD, 'ward') : null, 10000);
      const usage = game.messages.contents.find(m => (m.timestamp >= t) && (m.getFlag('dnd5e', 'use') || m.system?.activity) && (m.speaker?.actor === attacker.id) && !m.getFlag(MOD, 'ward'));
      ok('3a. Sacred Flame at the warded Victim is gated BEFORE its cast: no usage card, a "damagingSpell" demand of the caster; the save fails and the cast is turned aside', !use?.message && !!card && (card.getFlag(MOD, 'ward')?.attackerUuid === attacker.uuid) && (settled?.outcome === 'failed') && !usage,
        `use=${!!use?.message} card=${!!card} settled=${JSON.stringify(settled && { outcome: settled.outcome, gate: card?.getFlag(MOD, 'ward')?.gate })} usage=${!!usage} saves=${JSON.stringify(card?.getFlag(MOD, 'saves')?.targets)} ward=${JSON.stringify(card?.getFlag(MOD, 'ward'))}`);
      await closeDialogs();
      // An AREA is never gated: a spell with a template passes through (Sanctuary "doesn't protect from areas of effect").
      const burning = await lend(attacker, 'Burning Hands', 'spell');
      const burnAct = burning ? attacker.items.get(burning.id).system.activities.find(a => a.type === 'save') : null;
      if (burnAct) {
        const t2 = Date.now();
        const use2 = await burnAct.use({ consume: { spellSlot: false }, create: { measuredTemplate: false } }, { configure: false }, {});
        await sleep(400);
        ok('3b. an area spell (Burning Hands) aimed with the Victim targeted is NOT gated: its usage card posts, no ward demand', !!use2?.message && !wardCards().some(m => m.timestamp >= t2), `usage=${!!use2?.message} demands=${wardCards().filter(m => m.timestamp >= t2).length}`);
      } else log.push('§3b skipped: no Burning Hands to lend');
      await closeDialogs();
      await clearWards();
    }

    // ================================================== 4. the ward ends
    if (want(4)) {
      await clearWards();
      await wear(attacker, sanctuary, ['Warded']);   // the goblin is warded now
      await sleep(200);
      ok('4-. Warded on the goblin', attacker.effects.some(e => e.name === 'Warded'), '');
      const t = Date.now();
      const msg = await swing(vicTok, [[15, 20]]);
      const gone = await waitFor(() => attacker.effects.some(e => e.name === 'Warded') ? null : true, 6000);
      const endCard = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t) && m.getFlag(MOD, 'wardEnded')) ?? null, 6000);
      ok('4a. the warded goblin\'s own attack roll ENDS Sanctuary: Warded leaves its sheet, a card says "made an attack roll"; the attack itself rolled', !!msg && !!gone && (endCard?.getFlag(MOD, 'wardEnded')?.act === 'attack') && /made an attack roll/.test(endCard?.content ?? ''),
        `attack=${!!msg} gone=${!!gone} card=${JSON.stringify(endCard?.getFlag(MOD, 'wardEnded') ?? null)}`);
      await closeDialogs();
    }

    // ================================================== 5. Mirror Image — a duplicate takes the hit
    const holdOf = msg => game.messages.get(msg?.id)?.getFlag(MOD, 'hold') ?? null;
    const entryOf = msg => holdOf(msg)?.targets?.find(t => t.uuid === sorcerer.uuid) ?? null;
    const healSorc = () => sorcerer.update({ 'system.attributes.hp.value': 200, 'system.attributes.hp.temp': 0 });
    const resolved = msg => waitFor(() => { const h = holdOf(msg); return (h?.status === 'resolved') ? h : null; }, 10000);
    if (want(5)) {
      await clearWards(); await clearDupes(); await healSorc();
      await wear(sorcerer, mirror, ['Duplicate A', 'Duplicate B', 'Duplicate C']);
      const t = Date.now();
      const msg = await swing(sorTok, [[15, 20], [1, 6], [4, 6], [2, 6]]);   // the d20 hits AC 1; the d6s: 1, 4, 2
      const hold = await resolved(msg);
      const e = entryOf(msg);
      const landed = await waitFor(() => (dupes().length === 2) ? true : null, 8000);
      ok('5a. the hit stands: the hold carries a "duplicate" entry answered by the machine, 3d6 rolled (1, 4, 2), the 4 redirects — verdict "absorbed", Duplicate C destroyed, two stand',
        !!hold && (e?.kind === 'duplicate') && (e?.answer === 'auto') && (e?.verdict === 'absorbed') && (JSON.stringify(e?.duplicates?.faces) === '[1,4,2]') && (e?.duplicates?.winner === 1) && (e?.duplicates?.took?.name === 'Duplicate C') && !!landed && (JSON.stringify(dupes()) === '["Duplicate A","Duplicate B"]'),
        `status=${hold?.status} entry=${JSON.stringify(e && { kind: e.kind, answer: e.answer, verdict: e.verdict, dup: e.duplicates })} dupes=${dupes().join(',')}`);
      await sleep(800);
      ok('5b. no damage reached the Sorcerer', sorcerer.system.attributes.hp.value === 200, `hp=${sorcerer.system.attributes.hp.value}`);
      const said = game.messages.contents.find(m => (m.timestamp >= t) && /A duplicate takes the hit/.test(m.content ?? ''));
      ok('5c. the announcement: "A duplicate takes the hit", the dice, "duplicates: 2 of 3 left"', !!said && /3d6/.test(said.content) && /2 of 3 left/.test(said.content), said?.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200) ?? 'no card');
      await closeDialogs();
    }

    // ================================================== 6. the hit gets through
    if (want(6)) {
      await clearDupes(); await healSorc();
      await wear(sorcerer, mirror, ['Duplicate A', 'Duplicate B', 'Duplicate C']);
      const t = Date.now();
      const msg = await swing(sorTok, [[15, 20], [1, 6], [2, 6], [1, 6]]);
      const hold = await resolved(msg);
      const e = entryOf(msg);
      const hurt = await waitFor(() => (sorcerer.system.attributes.hp.value < 200) ? true : null, 8000);
      ok('6a. every d6 under 3: the hit gets through — verdict "hit", the flat 1 applied, all three duplicates stand', !!hold && (e?.verdict === 'hit') && (e?.duplicates?.absorbed === false) && !!hurt && (dupes().length === 3),
        `entry=${JSON.stringify(e && { verdict: e.verdict, dup: e.duplicates })} hp=${sorcerer.system.attributes.hp.value} dupes=${dupes().join(',')}`);
      const said = game.messages.contents.find(m => (m.timestamp >= t) && /The hit gets through/.test(m.content ?? ''));
      ok('6b. the announcement says the hit got through', !!said, '');
      await closeDialogs();
    }

    // ================================================== 7. the last duplicate
    if (want(7)) {
      await clearDupes(); await healSorc();
      await wear(sorcerer, mirror, ['Duplicate A']);
      const t = Date.now();
      const msg = await swing(sorTok, [[15, 20], [5, 6]]);
      const hold = await resolved(msg);
      const e = entryOf(msg);
      const gone = await waitFor(() => (dupes().length === 0) ? true : null, 8000);
      const said = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t) && /The last duplicate takes the hit/.test(m.content ?? '')) ?? null, 6000);
      ok('7a. one duplicate, a 5: the last is destroyed, none stand, the card says the spell ended', !!hold && (e?.verdict === 'absorbed') && (e?.duplicates?.left === 0) && !!gone && !!said && /Mirror Image ended/.test(said.content),
        `entry=${JSON.stringify(e && { verdict: e.verdict, dup: e.duplicates })} dupes=${dupes().join(',')} said=${!!said}`);
      await closeDialogs();
    }

    // ================================================== 8. Blindsight sees through
    if (want(8)) {
      await clearDupes(); await healSorc();
      await wear(sorcerer, mirror, ['Duplicate A', 'Duplicate B', 'Duplicate C']);
      await attacker.update({ 'system.attributes.senses.blindsight': 30 });
      const t = Date.now();
      const msg = await swing(sorTok, [[15, 20], [6, 6]]);
      await sleep(1200);
      const seen = game.messages.contents.find(m => (m.timestamp >= t) && m.getFlag(MOD, 'duplicatesSeen'));
      const hurt = await waitFor(() => (sorcerer.system.attributes.hp.value < 200) ? true : null, 8000);
      ok('8a. an attacker with Blindsight: no hold for the duplicates, a card says it sees through ("Blindsight"), the hit lands, all three stand', !!msg && !holdOf(msg) && (seen?.getFlag(MOD, 'duplicatesSeen')?.why === 'Blindsight') && !!hurt && (dupes().length === 3),
        `hold=${!!holdOf(msg)} seen=${JSON.stringify(seen?.getFlag(MOD, 'duplicatesSeen') ?? null)} hp=${sorcerer.system.attributes.hp.value} dupes=${dupes().length}`);
      await attacker.update({ 'system.attributes.senses': priorSenses });
      await closeDialogs();
    }

    // ================================================== 9. a PLAYER CHARACTER attacks the ward
    if (want(9)) {
      await clearWards(); await clearDupes();
      await wear(victim, sanctuary, ['Warded']);
      const fighter = game.actors.getName('BF Test Fighter');
      const weapon = fighter?.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => a.type === 'attack'));
      if (!fighter || !weapon) { ok('9-. BF Test Fighter with a weapon', false, 'missing'); }
      else {
        const { token: ftrTok } = await placeToken(fighter, 1300, 1700);
        priorActor[fighter.id] = { 'system.abilities.wis.save.roll.bonus': fighter.system._source.abilities?.wis?.save?.roll?.bonus ?? '' };
        await wisBonus(fighter, 30);
        ftrTok.control({ releaseOthers: true });
        target(vicTok);
        await sleep(80);
        faces([[15, 20]]);
        const t = Date.now();
        const fAct = fighter.items.get(weapon.id).system.activities.find(a => a.type === 'attack');
        const rolls = await fAct.rollAttack({}, { configure: false }, {});
        const card = await waitFor(() => wardCards().find(m => m.timestamp >= t) ?? null, 6000);
        const settled = await waitFor(() => card?.getFlag(MOD, 'ward')?.settled ? card.getFlag(MOD, 'ward') : null, 10000);
        const atk = await waitFor(() => attackMessages(t)[0] ?? null, 8000);
        ok('9a. a PLAYER CHARACTER (the Fighter) at the warded Victim: gated, its save rolled by the elect (no owner connected), passed, the attack made again', !rolls?.[0]?.parent && !!card && (settled?.outcome === 'saved') && !!atk,
          `first=${!!rolls?.[0]?.parent} card=${!!card} settled=${JSON.stringify(settled && { outcome: settled.outcome })} saves=${JSON.stringify(card?.getFlag(MOD, 'saves')?.targets)} attack=${!!atk}`);
        await closeDialogs();
      }
    }

    await clearDupes();
    await clearWards();
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'wards', out, plan, f });
