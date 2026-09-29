// Classes smoke suite (Session 0, audits/plans/session-0-classes.md): the PHB classes' rows on the live box.
// §A3 — THE BYSTANDER'S BEND on a hit (RULINGS *The full release — the order*, Q2 option A): Cutting Words and
// Restore Balance asked for someone else's hit only when the bend can change the verdict (the margin gate);
// the quiet road on the card (Cutting Words' die off the damage); the reach; "Not this combat".
// Fixtures: BF Test Attacker swings at BF Test Halfling; BF Test Bard is lent Cutting Words, BF Test Sorcerer
// Restore Balance (the pack's own items). Everything written is restored.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'hold/trigger.js',        // the bystanders stamped beside the guards on a held hit
  'hold/lookup.js',         // bystandersOf: the side, the reach, the Reaction, the pool, the mute, the margin gate
  'hold/answer.js',         // the bystander's answer (the die, the neutralise), the mute and pass
  'hold/views.js',          // the bystander's popup, the card's quiet row, the bent card
  'hold/continue.js',       // the verdict retaken with the bent roll; the damage half announced
  'hold/dice.js',           // the bent roll's chips
  'chip-spend.js'           // the mute swept with the combat
];

const SECTIONS = {
  1: 'Cutting Words, asked: a hit a d8 can turn (margin 2) opens the Bard\'s popup; Answer rolls the d8 (5), the hit becomes a MISS, the card says "Cutting Words (BF Test Bard) −5", a Bardic Inspiration spent',
  2: 'the margin gate: a hit by 9 asks nobody — no hold, no popup, the damage lands',
  3: 'the quiet road: the Halfling\'s Lucky holds the hit, Cutting Words rides QUIET on the card; its Answer takes the d8 (3) off the damage — the hit stands, 3 less lands',
  4: 'Restore Balance: an Advantage hit (18 and 9) whose first die misses opens the Sorcerer\'s popup; Answer stands the 9 — a MISS; Cutting Words (margin 8) stays quiet',
  5: 'the reach: the Bard 65 ft from the attacker is not asked',
  6: '"Not this combat": in a running combat the popup\'s third button mutes Cutting Words on the Bard (an effect), the hit lands; the next hit asks nobody; the combat\'s end sweeps the mute',
  7: 'Guided Strike for an ally: BF Test PC Attacker misses by 7 within 30 ft of the Cleric — the Cleric\'s popup "+10 · a Reaction"; Answer turns the miss into a HIT and the damage rolls and lands',
  8: 'Guided Strike on the Cleric\'s own miss: its own popup, "No Reaction"; the +10 turns it, the guard entry marked self',
  9: 'Restore Balance on a Disadvantage miss (18 then 3): the Sorcerer\'s popup beside the Cleric\'s; Answer stands the 18 — a HIT, the Cleric\'s popup closes'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'classes', watchdogMs: 600_000 });
announcePlan('classes', plan, pulled);

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
  const errors = [];
  const realError = console.error;
  console.error = (...a) => { errors.push(a.map(x => (x?.stack ?? String(x))).join(' ').slice(0, 400)); realError(...a); };

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  const { INTERRUPT_ROLLS } = await import('/modules/fvtt-mod-battleflow/scripts/decide/registry.js');
  if (!INTERRUPT_ROLLS['Cutting Words']) return { fatal: 'Cutting Words is not in the loaded code — OLD code (deploy --local, reload the box)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'holdTimer', 'holdReveal', 'holdSkipFutile', 'holdApplyEffect', 'riders', 'effectRiders',
    'masteryRiders', 'masteryAsk', 'castApply', 'concMode'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const halfling = game.actors.getName('BF Test Halfling');
  const bard = game.actors.getName('BF Test Bard');
  const sorcerer = game.actors.getName('BF Test Sorcerer');
  const cleric = game.actors.getName('BF Test Cleric');
  const pcAttacker = game.actors.getName('BF Test PC Attacker');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !attacker || !halfling || !bard || !sorcerer || !cleric || !pcAttacker || !victim) return { fatal: 'missing fixture: the range, BF Test Attacker, Halfling, Bard, Sorcerer, Cleric, PC Attacker or Victim — run tools/fixture-suite.mjs' };
  const divinity = () => cleric.items.find(i => (i.name === 'Channel Divinity') && (Number(i.system?.uses?.max) > 0));
  const divinitySpentBefore = Number(divinity()?.system?.uses?.spent ?? 0);
  const lucky = () => halfling.items.find(i => (i.name === 'Lucky') && (Number(i.system?.uses?.max) > 0));
  const inspiration = () => bard.items.find(i => (i.name === 'Bardic Inspiration') && (Number(i.system?.uses?.max) > 0));

  const created = { tokens: [], items: [], combats: [] };
  const lentBy = new Map();
  const priorActor = {};
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const refillLuck = async () => { const l = lucky(); if (l) await l.update({ 'system.uses.spent': 0 }); };
  const spendLuck = async () => { const l = lucky(); if (l) await l.update({ 'system.uses.spent': Number(l.system.uses.max) }); };
  const inspirationSpentBefore = Number(inspiration()?.system?.uses?.spent ?? 0);
  const refillInspiration = async () => { const b = inspiration(); if (b) await b.update({ 'system.uses.spent': 0 }); };
  const popups = () => [...foundry.applications.instances.values()].filter(app => app.rendered);
  const bystanderPopup = () => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-bystander"]')) ?? null;
  const rescuePopup = () => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-rescue"]')) ?? null;
  const closeDialogs = async () => {
    for (const app of popups()) {
      if (app.element?.querySelector?.('[data-bf-ticks]')) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const dropMutes = async () => {
    const ids = bard.effects.filter(e => e.getFlag(MOD, 'bystanderMute')).map(e => e.id);
    if (ids.length) await bard.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {});
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    CONFIG.Dice.randomUniform = realPRNG;
    console.error = realError;
    if (errors.length) log.push(`console errors: ${JSON.stringify(errors.slice(0, 6))}`);
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      for (const id of created.combats) { const c = game.combats.get(id); if (c) await c.delete(); }
      await dropMutes();
      await refillLuck();
      const b = inspiration(); if (b) await b.update({ 'system.uses.spent': inspirationSpentBefore });
      const cd = divinity(); if (cd) await cd.update({ 'system.uses.spent': divinitySpentBefore });
      for (const [actor, ids] of lentBy) {
        const live = ids.filter(id => actor.items.get(id));
        if (live.length) await actor.deleteEmbeddedDocuments('Item', live);
      }
      for (const actor of [bard, sorcerer, cleric]) {
        const chips = actor.effects.filter(e => e.getFlag(MOD, 'mastery') === 'reaction').map(e => e.id);
        if (chips.length) await actor.deleteEmbeddedDocuments('ActiveEffect', chips).catch(() => {});
      }
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
          || Object.keys(m.flags?.[MOD] ?? {}).length));
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
    await set('holdApplyEffect', true);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('masteryAsk', false);
    await set('castApply', false);
    await set('concMode', 'off');
    for (const c of game.combats.filter(c => c.scene?.id === scene.id)) await c.delete();

    // ---- fixtures: the pack's own features, lent by name
    const findPHB = async (name, type) => {
      for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
        const hit = (await pack.getIndex({ fields: ['type'] })).find(e => (e.name === name) && (e.type === type));
        if (hit) return pack.getDocument(hit._id);
      }
      return null;
    };
    const lend = async (actor, name) => {
      const source = await findPHB(name, 'feat');
      if (!source) throw new Error(`the PHB ships no feat "${name}" this box can find`);
      const [item] = await actor.createEmbeddedDocuments('Item', [source.toObject()]);
      lentBy.set(actor, [...(lentBy.get(actor) ?? []), item.id]);
      return item;
    };
    await lend(bard, 'Cutting Words');
    await lend(cleric, 'Guided Strike');
    // BF Test Cleric carries no Channel Divinity: the pack's, with two uses (the pool Guided Strike spends).
    if (!divinity()) {
      const cd = await lend(cleric, 'Channel Divinity');
      await cd.update({ 'system.uses.max': '2', 'system.uses.spent': 0 });
    }
    const balance = await lend(sorcerer, 'Restore Balance');
    await balance.update({ 'system.uses.spent': 0 });
    await refillInspiration();

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => t.actorLink && [attacker.id, halfling.id, bard.id, sorcerer.id, cleric.id, pcAttacker.id, victim.id].includes(t.actorId)).map(t => t.id);
    if (strays.length) await scene.deleteEmbeddedDocuments('Token', strays);
    const placeToken = async (actor, x, y, disposition) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true, disposition }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const { token: attackerToken, doc: attackerDoc } = await placeToken(attacker, 1400, 2100, -1);
    const { token: halflingToken, doc: halflingDoc } = await placeToken(halfling, 1500, 2100, 1);
    let { doc: bardDoc } = await placeToken(bard, 1700, 2100, 1);
    const { doc: sorcererDoc } = await placeToken(sorcerer, 1800, 2100, 1);
    // The miss side, one row north: the PC attacker, its target, the Cleric 10 ft from the attacker.
    const { token: pcToken } = await placeToken(pcAttacker, 1400, 1900, 1);
    const { token: victimToken } = await placeToken(victim, 1500, 1900, -1);
    const { token: clericToken } = await placeToken(cleric, 1600, 1900, 1);

    // ---- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const cardEl = id => document.querySelector(`.message[data-message-id="${id}"]`);
    const cardText = id => textOf(cardEl(id));
    const weapon = attacker.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => a.type === 'attack'));
    if (!weapon) return { fatal: 'BF Test Attacker has no weapon attack' };
    const act = () => attacker.items.get(weapon.id).system.activities.find(a => a.type === 'attack');
    faces([[10, 20]]);
    const probe = await act().rollAttack({}, { configure: false }, { create: false });
    const atkMod = Number(probe?.[0]?.total) - Number(probe?.[0]?.d20?.total);
    if (!Number.isFinite(atkMod)) return { fatal: `could not measure the attacker's modifier (${probe?.[0]?.total})` };
    const AC = atkMod + 10;
    priorActor[halfling.id] = {
      'system.attributes.ac.override': halfling.system._source.attributes.ac.override ?? null,
      'system.attributes.hp.value': halfling.system._source.attributes.hp.value,
      'system.attributes.hp.max': halfling.system._source.attributes.hp.max
    };
    await halfling.update({ 'system.attributes.ac.override': AC, 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });
    const healFull = () => halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
    const damageFor = id => game.messages.contents.find(m => (m.type === 'damage') && (m.getFlag(MOD, 'attackFor') === id));
    const swing = async ({ d20 = [12], dmg = 3, advantage = false } = {}) => {
      await healFull();
      attackerToken.control({ releaseOthers: true });
      halflingToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      faces([...d20.map(n => [n, 20]), [dmg, 6], [dmg, 6]]);
      const usage = await act().use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act().rollAttack(advantage ? { advantage: true } : {}, { configure: false },
        usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      await waitFor(() => msg?.getFlag(MOD, 'hold') || damageFor(msg?.id), 4000);
      return msg;
    };
    const holdOf = msg => game.messages.get(msg?.id)?.getFlag(MOD, 'hold') ?? null;
    const resolvedTarget = async msg => {
      const h = await waitFor(() => (holdOf(msg)?.status === 'resolved') ? holdOf(msg) : null, 12000);
      return h?.targets?.find(x => x.uuid === halfling.uuid) ?? null;
    };
    const hp = () => Number(halfling.system.attributes.hp.value);
    const spentBI = () => Number(inspiration()?.system?.uses?.spent ?? 0);

    // ---- 1. Cutting Words, asked, turns the hit
    if (want(1)) {
      await closeDialogs(); await spendLuck(); await refillInspiration();
      const msg = await swing({ d20: [12] });
      const pop = await waitFor(bystanderPopup, 6000);
      const guards = holdOf(msg)?.targets?.[0]?.guards ?? [];
      ok('1a. the hit is held for the Bard: a bystander popup "Cutting Words … −d8 · a Reaction"; the Sorcerer is not listed (a plain roll)',
        !!pop && /Cutting Words/.test(textOf(pop?.element)) && /−d8/.test(textOf(pop?.element))
          && guards.some(g => (g.uuid === bard.uuid) && g.bystander && !g.quiet) && !guards.some(g => g.uuid === sorcerer.uuid),
        `pop=${!!pop} guards=${JSON.stringify(guards.map(g => [g.name, g.row, g.quiet ?? false]))}`);
      ok('1b. the popup states the margin: "a d8 can turn it"', /can turn it/.test(textOf(pop?.element)), textOf(pop?.element).slice(0, 200));
      faces([[5, 8]]);
      pop?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await resolvedTarget(msg);
      ok('1c. the d8 (5) off the attack: a MISS, answered by the Bard (rescue Cutting Words)',
        (t?.answer === 'roll') && (t?.verdict === 'miss') && (t?.rescue === 'Cutting Words') && (t?.guardedBy?.uuid === bard.uuid)
          && (t?.bent?.how === 'die') && (t?.bent?.add === -5),
        JSON.stringify({ answer: t?.answer, verdict: t?.verdict, rescue: t?.rescue, by: t?.guardedBy?.name, bent: t?.bent }));
      await sleep(800);
      ok('1d. the attack card: "Cutting Words (BF Test Bard) −5 … MISS"', /Cutting Words \(BF Test Bard\) −5.*MISS/.test(cardText(msg?.id)), cardText(msg?.id).slice(0, 240));
      ok('1e. one Bardic Inspiration spent; no damage landed; the popup closed', (spentBI() === 1) && (hp() === 400) && !bystanderPopup(),
        `spent=${spentBI()} hp=${hp()} pop=${!!bystanderPopup()}`);
    }

    // ---- 2. the margin gate: a hit by 9 asks nobody
    if (want(2)) {
      await closeDialogs(); await spendLuck(); await refillInspiration();
      const msg = await swing({ d20: [19] });
      await sleep(1200);
      ok('2a. no hold and no popup: a d8 cannot turn a hit by 9', !holdOf(msg) && !bystanderPopup(), `hold=${JSON.stringify(holdOf(msg))} pop=${!!bystanderPopup()}`);
      await waitFor(() => hp() < 400, 6000);
      ok('2b. the damage landed', hp() < 400, `hp=${hp()}`);
    }

    // ---- 3. the quiet road
    if (want(3)) {
      await closeDialogs(); await refillLuck(); await refillInspiration();
      const msg = await swing({ d20: [19], dmg: 5 });
      const own = await waitFor(rescuePopup, 6000);
      const quiet = (holdOf(msg)?.targets?.[0]?.guards ?? []).find(g => g.uuid === bard.uuid);
      const row = await waitFor(() => cardEl(msg?.id)?.querySelector?.('[data-bf-bystander^="Cutting Words|"]'), 6000);
      ok('3a. the Halfling\'s Lucky holds the hit; Cutting Words rides QUIET (no popup), its row on the card with Answer and "Not this combat"',
        !!own && quiet?.quiet === true && quiet?.passed === true && !bystanderPopup() && !!row
          && /off the damage/.test(textOf(row)) && /Not this combat/.test(textOf(row)),
        `own=${!!own} quiet=${JSON.stringify(quiet)} row=${textOf(row)}`);
      faces([[3, 8]]);
      [...(row?.querySelectorAll?.('button') ?? [])].find(b => b.textContent === 'Answer')?.click();
      const t = await resolvedTarget(msg);
      const dmg = await waitFor(() => damageFor(msg?.id), 6000);
      const full = (dmg?.rolls ?? []).reduce((n, r) => n + Number(r.total ?? 0), 0);
      await waitFor(() => hp() < 400, 6000);
      await sleep(600);
      ok('3b. the die (3) off the DAMAGE: the hit stands, the Bard answered, reduceBy 3', (t?.answer === 'roll') && (t?.verdict === 'hit') && (t?.reduceBy === 3) && !t?.bent && (t?.guardedBy?.uuid === bard.uuid),
        JSON.stringify({ answer: t?.answer, verdict: t?.verdict, reduceBy: t?.reduceBy, by: t?.guardedBy?.name }));
      ok('3c. 3 less landed; the Lucky popup closed', ((400 - hp()) === Math.max(0, full - 3)) && !rescuePopup(), `full=${full} taken=${400 - hp()} own=${!!rescuePopup()}`);
    }

    // ---- 4. Restore Balance on an Advantage hit
    if (want(4)) {
      await closeDialogs(); await spendLuck(); await refillInspiration();
      await balance.update({ 'system.uses.spent': 0 });
      const msg = await swing({ d20: [9, 18], advantage: true });
      const pop = await waitFor(bystanderPopup, 6000);
      const guards = holdOf(msg)?.targets?.[0]?.guards ?? [];
      ok('4a. the Sorcerer\'s popup: "Restore Balance … the first d20 (9) stands"; Cutting Words (margin 8) quiet',
        !!pop && /Restore Balance/.test(textOf(pop?.element)) && /first d20 \(9\)/.test(textOf(pop?.element))
          && guards.some(g => (g.uuid === bard.uuid) && g.quiet) && guards.some(g => (g.uuid === sorcerer.uuid) && !g.quiet),
        `pop=${textOf(pop?.element).slice(0, 160)} guards=${JSON.stringify(guards.map(g => [g.name, g.row, g.quiet ?? false]))}`);
      pop?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await resolvedTarget(msg);
      ok('4b. the first d20 stands: a MISS, rescue Restore Balance, a use spent',
        (t?.verdict === 'miss') && (t?.rescue === 'Restore Balance') && (t?.bent?.how === 'neutralised') && (t?.bent?.stood === 9)
          && (Number(sorcerer.items.get(balance.id)?.system?.uses?.spent) === 1),
        JSON.stringify({ verdict: t?.verdict, rescue: t?.rescue, bent: t?.bent, spent: sorcerer.items.get(balance.id)?.system?.uses?.spent }));
    }

    // ---- 5. the reach
    if (want(5)) {
      await closeDialogs(); await spendLuck(); await refillInspiration();
      // ⚠ The range's tokens sit below its 2000 px edge, where Foundry refuses a move: the Bard is re-placed 65 ft west.
      await scene.deleteEmbeddedDocuments('Token', [bardDoc.id]);
      ({ doc: bardDoc } = await placeToken(bard, 100, 2100, 1));
      await sleep(600);
      const msg = await swing({ d20: [12] });
      await sleep(1200);
      ok('5a. the Bard 65 ft from the attacker: nobody asked, no hold', !holdOf(msg) && !bystanderPopup(), `hold=${JSON.stringify(holdOf(msg)?.targets?.[0]?.guards ?? null)}`);
      await scene.deleteEmbeddedDocuments('Token', [bardDoc.id]);
      ({ doc: bardDoc } = await placeToken(bard, 1700, 2100, 1));
      await sleep(600);
    }

    // ---- 6. "Not this combat"
    if (want(6)) {
      await closeDialogs(); await spendLuck(); await refillInspiration(); await dropMutes();
      const [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
      created.combats.push(combat.id);
      await combat.createEmbeddedDocuments('Combatant', [attackerDoc, halflingDoc, bardDoc, sorcererDoc].map((d, i) =>
        ({ tokenId: d.id, sceneId: scene.id, actorId: d.actorId, initiative: 20 - i })));
      await combat.startCombat();
      await sleep(400);
      const msg = await swing({ d20: [12] });
      const pop = await waitFor(bystanderPopup, 6000);
      const mute = pop?.element?.querySelector('button[data-action="mute"]');
      ok('6a. the popup carries "Not this combat"', !!mute && /Not this combat/.test(textOf(mute)), textOf(pop?.element).slice(-120));
      mute?.click();
      const eff = await waitFor(() => bard.effects.find(e => e.getFlag(MOD, 'bystanderMute')?.key === 'Cutting Words'), 6000);
      const t = await resolvedTarget(msg);
      ok('6b. the mute on the Bard ("Cutting Words — muted this combat", this combat); the hit lands (passed)',
        /Cutting Words — muted this combat/.test(eff?.name ?? '') && (eff?.getFlag(MOD, 'bystanderMute')?.combat === combat.id) && (t?.verdict === 'hit'),
        `effect=${eff?.name ?? null} verdict=${t?.verdict}`);
      const msg2 = await swing({ d20: [12] });
      await sleep(1200);
      ok('6c. the next hit asks nobody', !holdOf(msg2) && !bystanderPopup(), `hold=${JSON.stringify(holdOf(msg2)?.targets?.[0]?.guards ?? null)}`);
      await combat.delete();
      const gone = await waitFor(() => !bard.effects.some(e => e.getFlag(MOD, 'bystanderMute')), 8000);
      ok('6d. the combat\'s end sweeps the mute', gone, `left=${bard.effects.filter(e => e.getFlag(MOD, 'bystanderMute')).map(e => e.name)}`);
    }

    // ---- the miss side: a friendly attacker, a hostile target
    const weaponOf = actor => actor.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => a.type === 'attack'));
    const pcWeapon = weaponOf(pcAttacker);
    let clericWeapon = weaponOf(cleric);
    if (!clericWeapon) {
      const mace = await findPHB('Mace', 'weapon');
      if (mace) { const data = mace.toObject(); data.system.equipped = true; [clericWeapon] = await cleric.createEmbeddedDocuments('Item', [data]); lentBy.set(cleric, [...(lentBy.get(cleric) ?? []), clericWeapon.id]); }
    }
    const attackOf = (actor, w) => actor.items.get(w.id).system.activities.find(a => a.type === 'attack');
    const modOf = async (actor, w) => {
      faces([[10, 20]]);
      const p = await attackOf(actor, w).rollAttack({}, { configure: false }, { create: false });
      return Number(p?.[0]?.total) - Number(p?.[0]?.d20?.total);
    };
    const missSide = (want(7) || want(8) || want(9)) && pcWeapon && clericWeapon;
    if ((want(7) || want(8) || want(9)) && !missSide) log.push(`miss side skipped: pcWeapon=${!!pcWeapon} clericWeapon=${!!clericWeapon}`);
    let VAC = null;
    if (missSide) {
      priorActor[victim.id] = {
        'system.attributes.ac.override': victim.system._source.attributes.ac.override ?? null,
        'system.attributes.hp.value': victim.system._source.attributes.hp.value,
        'system.attributes.hp.max': victim.system._source.attributes.hp.max
      };
      await victim.update({ 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });
    }
    const vhp = () => Number(victim.system.attributes.hp.value);
    const swingAt = async (actor, token, w, { d20 = [3], dmg = 3, disadvantage = false } = {}) => {
      await victim.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
      token.control({ releaseOthers: true });
      victimToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      faces([...d20.map(n => [n, 20]), [dmg, 6], [dmg, 6], [dmg, 6]]);
      const a = attackOf(actor, w);
      const usage = await a.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await a.rollAttack(disadvantage ? { disadvantage: true } : {}, { configure: false },
        usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      await waitFor(() => msg?.getFlag(MOD, 'hold'), 4000);
      return msg;
    };
    const missTarget = async msg => {
      const h = await waitFor(() => (holdOf(msg)?.status === 'resolved') ? holdOf(msg) : null, 12000);
      return h?.targets?.find(x => x.uuid === victim.uuid) ?? null;
    };
    const popupTitled = re => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-bystander"]') && re.test(textOf(app.element))) ?? null;
    const refillDivinity = async () => { const cd = divinity(); if (cd) await cd.update({ 'system.uses.spent': 0 }); };

    // ---- 7. Guided Strike for an ally
    if (want(7) && missSide) {
      await closeDialogs(); await refillDivinity();
      const pcMod = await modOf(pcAttacker, pcWeapon);
      VAC = pcMod + 10;
      await victim.update({ 'system.attributes.ac.override': VAC });
      const msg = await swingAt(pcAttacker, pcToken, pcWeapon, { d20: [3] });
      const pop = await waitFor(() => popupTitled(/Guided Strike/), 6000);
      const guards = holdOf(msg)?.targets?.[0]?.guards ?? [];
      ok('7a. a miss by 7 is held for the Cleric: "Guided Strike … +10 · a Reaction", the hold marked miss',
        !!pop && /\+10/.test(textOf(pop?.element)) && /a Reaction/.test(textOf(pop?.element)) && (holdOf(msg)?.miss === true)
          && guards.some(g => (g.uuid === cleric.uuid) && !g.self),
        `pop=${textOf(pop?.element).slice(0, 180)} hold.miss=${holdOf(msg)?.miss} guards=${JSON.stringify(guards.map(g => [g.name, g.row, !!g.self]))}`);
      pop?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await missTarget(msg);
      const landed = await waitFor(() => vhp() < 400, 8000);
      ok('7b. the +10 turns it: a HIT (rescue Guided Strike, the Cleric), the damage rolled and landed, a Channel Divinity spent',
        (t?.verdict === 'hit') && (t?.rescue === 'Guided Strike') && (t?.guardedBy?.uuid === cleric.uuid) && (t?.bent?.add === 10) && landed
          && (Number(divinity()?.system?.uses?.spent ?? 0) === 1),
        JSON.stringify({ verdict: t?.verdict, rescue: t?.rescue, bent: t?.bent?.add, hp: vhp(), cd: divinity()?.system?.uses?.spent }));
      await sleep(600);
      ok('7c. the attack card: "Guided Strike (BF Test Cleric) +10 … HIT"', /Guided Strike \(BF Test Cleric\) \+10.*HIT/.test(cardText(msg?.id)), cardText(msg?.id).slice(0, 240));
    }

    // ---- 8. Guided Strike on the Cleric's own miss
    if (want(8) && missSide) {
      await closeDialogs(); await refillDivinity();
      const clMod = await modOf(cleric, clericWeapon);
      await victim.update({ 'system.attributes.ac.override': clMod + 10 });
      const msg = await swingAt(cleric, clericToken, clericWeapon, { d20: [3] });
      const pop = await waitFor(() => popupTitled(/Guided Strike/), 6000);
      const g = (holdOf(msg)?.targets?.[0]?.guards ?? []).find(x => x.uuid === cleric.uuid);
      ok('8a. its own popup: "your attack", "No Reaction", the entry marked self',
        !!pop && /your attack/.test(textOf(pop?.element)) && /No Reaction/.test(textOf(pop?.element)) && !/a Reaction ·/.test(textOf(pop?.element)) && g?.self === true,
        `pop=${textOf(pop?.element).slice(0, 180)} guard=${JSON.stringify(g)}`);
      pop?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await missTarget(msg);
      ok('8b. the +10 turns it: a HIT', (t?.verdict === 'hit') && (t?.rescue === 'Guided Strike'), JSON.stringify({ verdict: t?.verdict, rescue: t?.rescue }));
    }

    // ---- 9. Restore Balance on a Disadvantage miss
    if (want(9) && missSide) {
      await closeDialogs(); await refillDivinity();
      await balance.update({ 'system.uses.spent': 0 });
      const pcMod = await modOf(pcAttacker, pcWeapon);
      await victim.update({ 'system.attributes.ac.override': pcMod + 10 });
      const msg = await swingAt(pcAttacker, pcToken, pcWeapon, { d20: [18, 3], disadvantage: true });
      const rb = await waitFor(() => popupTitled(/Restore Balance/), 6000);
      const gs = popupTitled(/Guided Strike/);
      ok('9a. the Sorcerer\'s popup ("the first d20 (18) stands") beside the Cleric\'s', !!rb && /first d20 \(18\)/.test(textOf(rb?.element)) && !!gs,
        `rb=${textOf(rb?.element).slice(0, 200)} gs=${!!gs}`);
      rb?.element?.querySelector('button[data-action="answer"]')?.click();
      const t = await missTarget(msg);
      await sleep(600);
      ok('9b. the 18 stands: a HIT, rescue Restore Balance; the Cleric\'s popup closed', (t?.verdict === 'hit') && (t?.rescue === 'Restore Balance')
        && (t?.bent?.stood === 18) && !popupTitled(/Guided Strike/),
        JSON.stringify({ verdict: t?.verdict, rescue: t?.rescue, bent: t?.bent, gs: !!popupTitled(/Guided Strike/) }));
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'classes', out, plan, f });
