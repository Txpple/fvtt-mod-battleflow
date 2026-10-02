// SMOKE — THE SPLAT BOOKS (RULINGS *Arcana Unleashed*; audits/plans/splat-books.md): the books' rows on the live box,
// each lent by its compendium uuid for the section and taken back. Fixtures: BF Test Attacker (hostile) swings at BF Test
// Halfling; BF Test PC Attacker shoots BF Test Victim. Sections: `--section N`, `--list`. Fixtures and teardown ALWAYS run.
//
//   node tools/smoke-splat.mjs [--section N ...] [--list]
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'd20-folds.js',           // §1 — the Survivor collision: Ravenloft's feat raises no D20_FLOORS critical
  'turn-grants.js',         // §1 — Ravenloft's Survivor pays no Heroic Rally
  'hit-menu.js',            // §2 — Arcane Shot's group: the option's save rides the Longbow hit, the group's one turn chit, no group on a Longsword
  'saves/demand.js',        // §2 — the option's save demanded at the Victim with its own dice
  'rebukes.js',             // §3 — Harvest Undead on BECOMING Bloodied (and not before); §4 Instinctive Charm on a hit within 30 ft
  'initiative-grants.js',   // §5 — Ever-Ready Shot: one Arcane Shot use back at Initiative, asked
  // HEROES OF FAERÛN
  'hold/lookup.js',         // §7 — Elemental Rebuke on the hold (the half, the save at the attacker)
  'hold/answer.js',         // §7 — the Cast answer
  'bystanders.js',          // §8 — Shared Resilience: a friend's failed save rerolled with the fighter's level
  'clock-riders.js',        // §9 — Polar Strikes' die on a weapon hit; §13 Ominous Strikes against a Frightened target
  'damage-rules.js',        // §9 — Biting Cold: the Cold ignores Resistance
  // RAVENLOFT: THE HORRORS WITHIN
  'mishaps.js',             // §11 — a 1 on the d20 demands the dark gift's save (Warping Flesh)
  'drop-to-one.js',         // §12 — Strength of the Grave: the drop held while the Charisma save rolls, the Hit Points SET on a success
  'heal-on-hit.js',         // §14 — Hungering Might: the heal on the ranger's own hit while Ghastly Form stands, Bloodied, once per turn
  'reminders.js'            // §15 — Terrorizer: Advantage against a Frightened target
];

const SECTIONS = {
  1: 'THE SURVIVOR COLLISION: BF Test Halfling lent Ravenloft\'s Survivor (a feat, not the Fighter\'s class feature) — a Bloodied turn start heals nothing (no Heroic Rally card), and a Death Saving Throw of 18 is no critical success',
  2: 'ARCANE SHOT: BF Test PC Attacker lent Arcane Shot (2 uses), Beguiling Shot and Bursting Shot; a Longbow hit opens the group "Arcane Shot"; Beguiling Shot ticked — the Wisdom save demanded at the Victim with its dice, a use spent; the next hit this turn greys the group; a Longsword hit shows no group',
  3: 'HARVEST UNDEAD — THE BLOODIED MOMENT: the Halfling at 400 of 400 takes a hit — no rebuke; at 201 of 400 the hit makes it Bloodied — the rebuke card offers Harvest Undead',
  4: 'INSTINCTIVE CHARM: the Attacker\'s hit on the Halfling (5 ft) offers the rebuke; Use demands the Wisdom save of the Attacker',
  5: 'EVER-READY SHOT: Arcane Shot at 1 of 3, Ever-Ready Shot lent; the PC Attacker\'s Initiative asks "use it now?"; Yes brings ONE use back (2 of 3)',
  // HEROES OF FAERÛN (RULINGS *Heroes of Faerûn*)
  6: 'BLOODTHIRST — THE BLOODIED MOMENT WATCHED: the Halfling lent Bloodthirst; the PC Attacker\'s hit takes the Victim (an enemy 10 ft from the Halfling) from 201 to half or fewer — the Halfling\'s rebuke card "BF Test Victim is Bloodied" offers Bloodthirst; a hit that leaves the Victim above half offers nothing',
  7: 'ELEMENTAL REBUKE: the Halfling lent it (1 use); the Attacker\'s hit opens the hold popup with the rebuke; Cast halves the damage on the receipt, spends the use and demands the Attacker\'s Dexterity save (it fails and takes the Rebuke\'s own damage)',
  8: 'SHARED RESILIENCE: the PC Attacker lent it and Indomitable (2 uses), 10 ft from the Halfling; the Halfling FAILS a demanded save — the fighter\'s bystander popup; Answer rerolls the Halfling\'s d20 and adds the fighter\'s level, an Indomitable use spent',
  9: 'FRIGID EXPLORER: the PC Attacker lent it; a Longsword hit\'s offer carries the ticked "Polar Strikes" (its cold die rides); the Victim with Cold Resistance takes the cold in FULL (Biting Cold ignores it)',
  10: 'CHILLING RETRIBUTION: the Halfling lent it (1 use); the Attacker\'s hit offers the rebuke; Use demands the Attacker\'s Wisdom save through the saves machine — a failure lands Stunned on the Attacker',
  // RAVENLOFT: THE HORRORS WITHIN (RULINGS *Ravenloft: The Horrors Within*)
  11: 'THE MISHAPS: the Halfling lent Aberrant Anatomy; a Dexterity save rolling a 1 demands Warping Flesh\'s Constitution save of the Halfling (the mishap card); a save rolling a 12 demands nothing',
  12: 'STRENGTH OF THE GRAVE: the Halfling lent Power of Shadow at 2 HP; the hit that drops it rolls the Charisma save (DC 5 + the damage) — a FAILURE lands the 0 and spends nothing; a SUCCESS keeps it up and spends the use',
  13: 'OMINOUS STRIKES: the PC Attacker lent Ancient Might (Wis 16); a Longsword hit on the FRIGHTENED Victim offers "Ominous Strikes — +3"; not Frightened, no row',
  14: 'HUNGERING MIGHT: the PC Attacker lent Wrath of the Wild, Ghastly Form on, at 5 of 20 HP; in a combat a Longsword hit heals it 1d10 + Wis (the heal-on-hit card); a second hit the same turn heals nothing more',
  15: 'TERRORIZER: the Attacker lent the dullahan\'s Terrorizer; its attack on the FRIGHTENED Halfling records the bend (Advantage); not Frightened, none',
  16: 'HYPERVIGILANCE: the PC Attacker lent the Survivor feat; an Initiative whose d20 shows 4 asks "reroll?"; Yes rerolls it, the record says so',
  17: 'STEEL YOURSELF: the PC Attacker lent the Survivor feat; the Attacker\'s Fear save FAILS by 1 — the popup asks; Answer adds the Proficiency Bonus and the save passes, the Reaction spent'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'splat', watchdogMs: 600_000 });
announcePlan('splat', plan, pulled);

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
  const { FEATURE_TYPES, HIT_GROUPS } = await import('/modules/fvtt-mod-battleflow/scripts/decide/registry.js');
  if (!FEATURE_TYPES?.Survivor || !HIT_GROUPS['arcane-shot']) return { fatal: 'the splat rows are not in the loaded code — OLD code (deploy --local, reload the box)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'holdTimer', 'holdReveal', 'holdSkipFutile', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'castApply', 'concMode', 'saveRolls', 'decisionTimer'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const halfling = game.actors.getName('BF Test Halfling');
  const pcAttacker = game.actors.getName('BF Test PC Attacker');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !attacker || !halfling || !pcAttacker || !victim) return { fatal: 'missing fixture: the range, BF Test Attacker, Halfling, PC Attacker or Victim — run tools/fixture-suite.mjs' };

  const created = { tokens: [], items: [], combats: [] };
  const lentBy = new Map();
  const priorActor = {};
  const keep = (actor, data) => { priorActor[actor.id] = { ...data, ...(priorActor[actor.id] ?? {}) }; };
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  // ⚠ Never the UI singletons (smoke-classes' lesson): a text match on "every rendered app" once closed the chat log.
  const popups = () => [...foundry.applications.instances.values()].filter(app => app.rendered && !Object.entries(ui).some(([k, v]) => (k !== 'activeWindow') && (v === app)));
  const titleOf = app => String(app?.title ?? app?.options?.window?.title ?? '');
  const titled = re => popups().find(app => re.test(titleOf(app))) ?? null;
  const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const closeOurs = async () => {
    for (const app of popups()) {
      const ours = /RollConfigurationDialog/.test(app.constructor?.name ?? '') || app.element?.querySelector?.('[data-bf-ticks], [data-bf-rescue-row], button[data-action^="pick-"], button[data-action^="use-"]')
        || /Damage — your roll|Ever-Ready Shot|Reaction —/.test(titleOf(app) + (app.element?.innerHTML ?? '').slice(0, 400));
      if (ours) { try { await app.close(); } catch { /* gone */ } }
    }
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
      await closeOurs();
      for (const id of created.combats) { const c = game.combats.get(id); if (c) await c.delete(); }
      for (const [actor, ids] of lentBy) {
        const live = ids.filter(id => actor.items.get(id));
        if (live.length) await actor.deleteEmbeddedDocuments('Item', live);
      }
      for (const actor of [halfling, pcAttacker, victim, attacker]) {
        const strays = actor.effects.filter(e => (e.getFlag(MOD, 'mastery') === 'rider') || (e.getFlag(MOD, 'mastery') === 'reaction') || ['Dead', 'Unconscious', 'Beguiling Shot'].includes(e.name)).map(e => e.id);
        if (strays.length) await actor.deleteEmbeddedDocuments('ActiveEffect', strays).catch(() => {});
      }
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
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
    await set('decisionTimer', 0);
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
    await set('saveRolls', 'auto');
    for (const c of game.combats.filter(c => c.scene?.id === scene.id)) await c.delete();

    // ---- fixtures: an item lent by its compendium uuid, its source stamped (a consumption target resolves by it), patched
    const lendUuid = async (actor, uuid, patch = null) => {
      const source = await fromUuid(uuid).catch(() => null);
      if (!source) { log.push(`this box ships no ${uuid}`); return null; }
      const data = source.toObject();
      foundry.utils.setProperty(data, '_stats.compendiumSource', source.uuid);
      if (data.type === 'weapon') data.system.equipped = true;
      const [item] = await actor.createEmbeddedDocuments('Item', [data]);
      lentBy.set(actor, [...(lentBy.get(actor) ?? []), item.id]);
      if (patch) await item.update(patch);
      return actor.items.get(item.id);
    };
    const unlend = async (actor, item) => {
      const id = item?.id ?? item;
      if (!id) return;
      if (actor.items.get(id)) await actor.deleteEmbeddedDocuments('Item', [id]).catch(() => {});
      lentBy.set(actor, (lentBy.get(actor) ?? []).filter(x => x !== id));
    };
    const AUN = 'Compendium.dnd-arcana-unleashed.subclasses.Item.';
    const PHB = 'Compendium.dnd-players-handbook.equipment.Item.';

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => t.actorLink && [attacker.id, halfling.id, pcAttacker.id, victim.id].includes(t.actorId)).map(t => t.id);
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
    // Two rows well inside the 2000×2000 range: the hostile Attacker beside the Halfling; the PC Attacker beside the Victim.
    const { token: attackerToken } = await placeToken(attacker, 1400, 1700, -1);
    const { token: halflingToken } = await placeToken(halfling, 1500, 1700, 1);
    const { token: pcToken } = await placeToken(pcAttacker, 1400, 1500, 1);
    const { token: victimToken } = await placeToken(victim, 1500, 1500, -1);

    // ---- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const since = (t, key) => game.messages.contents.filter(m => (m.timestamp >= t) && m.getFlag(MOD, key));
    const clearTargets = () => game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
    const hp = actor => Number(actor.system.attributes.hp.value);
    const damageFor = id => game.messages.contents.find(m => (m.type === 'damage') && (m.getFlag(MOD, 'attackFor') === id));
    const OFFER = 'Damage — your roll';
    const offerApp = before => popups().find(app => !before.has(app) && (app.element?.innerHTML ?? '').includes(OFFER)) ?? null;
    const hitBox = (offer, key) => offer?.element?.querySelector(`input[name="bf-hit"][value="${key}"]`) ?? null;
    const hitRow = (offer, key) => textOf(offer?.element?.querySelector(`[data-bf-hit-row="${key}"]`));
    const groupText = (offer, key) => textOf(offer?.element?.querySelector(`div[data-bf-hit-group="${key}"]`));
    const tick = async (offer, ...keys) => { for (const k of keys) { hitBox(offer, k)?.click(); await sleep(60); } };
    const rollOffer = (offer, msg) => { offer?.element?.querySelector('button[data-action="roll"]')?.click(); return waitFor(() => { const d = damageFor(msg?.id); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000); };
    const attackOf = (actor, w) => actor.items.get(w.id).system.activities.find(a => a.type === 'attack');
    /** `token` attacks `target` with `activity`, the d20 pinned to `face` (a second d20 if the gate adds one); the attack message and any new damage offer. */
    const strike = async (token, activity, target, face = 19, { offerWait = 4000 } = {}) => {
      token.control({ releaseOthers: true });
      target.setTarget(true, { releaseOthers: true });
      await sleep(80);
      const before = new Set(popups());
      faces([[face, 20], [face, 20], [3, 6], [3, 6], [3, 6]]);
      const usage = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await activity.rollAttack({}, { configure: false }, usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
      const msg = rolls?.[0]?.parent ?? null;
      const offer = await waitFor(() => offerApp(before), offerWait);
      return { msg, offer };
    };
    const settleDamage = msg => waitFor(() => { const d = damageFor(msg?.id); return d?.getFlag(MOD, 'receipt') ? d : null; }, 12000);
    const saveCardFor = (key, t) => game.messages.contents.find(m => (m.timestamp >= t) && (m.getFlag(MOD, 'hitManeuverCard')?.key === key)) ?? null;
    const outcomeOn = (card, actor) => card?.getFlag(MOD, 'saves')?.targets?.find(x => x.uuid === actor.uuid)?.outcome ?? null;
    const rebukePopup = () => popups().find(app => /^Reaction — /.test(titleOf(app))) ?? null;
    const rebukeCards = (t, actor) => since(t, 'rebuke').filter(m => m.getFlag(MOD, 'rebuke')?.actorUuid === actor.uuid);
    const hWeapon = attacker.items.find(i => (i.type === 'weapon') && i.system.activities?.some?.(a => a.type === 'attack'));
    if (!hWeapon) return { fatal: 'BF Test Attacker has no weapon attack' };
    keep(halfling, { 'system.attributes.hp.value': halfling.system._source.attributes.hp.value, 'system.attributes.hp.max': halfling.system._source.attributes.hp.max,
      'system.attributes.hp.temp': halfling.system._source.attributes.hp.temp, 'system.attributes.ac.override': halfling.system._source.attributes.ac.override ?? null,
      'system.attributes.death.success': 0, 'system.attributes.death.failure': 0 });
    keep(victim, { 'system.attributes.hp.value': victim.system._source.attributes.hp.value, 'system.attributes.hp.max': victim.system._source.attributes.hp.max,
      'system.attributes.ac.override': victim.system._source.attributes.ac.override ?? null, 'system.abilities.wis.save.roll.bonus': victim.system._source.abilities?.wis?.save?.roll?.bonus ?? '' });
    keep(attacker, { 'system.abilities.wis.save.roll.bonus': attacker.system._source.abilities?.wis?.save?.roll?.bonus ?? '',
      'system.abilities.dex.save.roll.bonus': attacker.system._source.abilities?.dex?.save?.roll?.bonus ?? '', 'system.attributes.hp.value': attacker.system._source.attributes.hp.value });
    keep(halfling, { 'system.abilities.wis.save.roll.bonus': halfling.system._source.abilities?.wis?.save?.roll?.bonus ?? '' });
    await halfling.update({ 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0, 'system.attributes.ac.override': 1 });
    await victim.update({ 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400, 'system.attributes.ac.override': 1 });
    // ⚠ The Halfling's Lucky would hold every hit on it for the rescue popup: its uses are spent for the run and put back after.
    const luckies = halfling.items.filter(i => (i.name === 'Lucky') && (Number(i.system?.uses?.max) > 0));
    const priorLuck = luckies.map(l => [l.id, Number(l.system.uses.spent ?? 0)]);
    for (const l of luckies) await l.update({ 'system.uses.spent': Number(l.system.uses.max) });
    const refillLuck = async () => { for (const [id, spent] of priorLuck) await halfling.items.get(id)?.update({ 'system.uses.spent': spent }).catch(() => {}); };

    // ---- 1. The Survivor collision
    if (want(1)) {
      const t0 = Date.now();
      const rav = await lendUuid(halfling, 'Compendium.dnd-ravenloft-horrors-within.options.Item.rhwSurvivor2zrM3');
      let combat = null;
      try {
        if (!rav) log.push('§1 skipped: no Ravenloft Survivor on this box');
        else {
          ok('1a. the lent Ravenloft Survivor is a FEAT (system.type.value "feat"), the Fighter\'s is a class feature', rav.type === 'feat' && rav.system?.type?.value === 'feat', `type=${rav.type} subtype=${rav.system?.type?.value}`);
          await halfling.update({ 'system.attributes.hp.value': 150, 'system.attributes.hp.temp': 0 });   // of 400: Bloodied
          const [c] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          combat = c; created.combats.push(c.id);
          await c.createEmbeddedDocuments('Combatant', [{ tokenId: halflingToken.document.id, sceneId: scene.id, actorId: halfling.id, initiative: 20 }]);
          await c.startCombat();
          await sleep(2000);
          ok('1b. the Bloodied turn start pays NO Heroic Rally (150 of 400 stays 150, no turnGrant card for the row)',
            (hp(halfling) === 150) && !since(t0, 'turnGrant').some(m => m.getFlag(MOD, 'turnGrant')?.row === 'Heroic Rally'), `hp=${hp(halfling)} cards=${since(t0, 'turnGrant').length}`);
          await c.delete(); combat = null;
          await halfling.update({ 'system.attributes.hp.value': 0, 'system.attributes.hp.temp': 0, 'system.attributes.death.success': 0, 'system.attributes.death.failure': 0 });
          faces([[18, 20], [18, 20]]);
          const rolls = await halfling.rollDeathSave({}, { configure: false }, {});
          CONFIG.Dice.randomUniform = realPRNG;
          const r0 = rolls?.[0];
          await sleep(1200);
          // dnd5e's own death-save threshold is 20; Defy Death would have lowered it to 18.
          ok('1c. a Death Saving Throw of 18 is an ordinary success — no Defy Death (no critical, the threshold the platform\'s 20, 0 Hit Points still)',
            !!r0 && (r0.isCritical !== true) && !(Number(r0.options?.criticalSuccess) < 20) && (hp(halfling) === 0),
            `critical=${r0?.isCritical} threshold=${r0?.options?.criticalSuccess} hp=${hp(halfling)}`);
        }
      } finally {
        if (combat && game.combats.get(combat.id)) await combat.delete();
        for (const e of halfling.effects.filter(e => ['Dead', 'Unconscious'].includes(e.name))) await e.delete().catch(() => {});
        await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0, 'system.attributes.death.success': 0, 'system.attributes.death.failure': 0 }).catch(() => {});
        if (rav) await unlend(halfling, rav);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 2. Arcane Shot
    if (want(2)) {
      const shot = await lendUuid(pcAttacker, `${AUN}aunArcaneShot000`, { 'system.uses.max': '2', 'system.uses.spent': 0 });
      const beguile = await lendUuid(pcAttacker, `${AUN}aunBeguilingShot`);
      const burst = await lendUuid(pcAttacker, `${AUN}aunBurstingShot0`);
      const bow = await lendUuid(pcAttacker, `${PHB}phbwepLongbow000`);
      const sword = await lendUuid(pcAttacker, `${PHB}phbwepLongsword0`);
      let combat = null;
      try {
        if (!shot || !beguile || !burst || !bow || !sword) log.push(`§2 skipped: shot=${!!shot} beguile=${!!beguile} burst=${!!burst} bow=${!!bow} sword=${!!sword}`);
        else {
          // The Arcane Shot Die is the subclass's scale (the fixture has none): the options' dice pinned on the lent copies.
          for (const [item, formula] of [[beguile, '2d6'], [burst, '2d6']]) {
            const act = item.system.activities.find(a => (a.type === 'save') || (a.type === 'damage'));
            const parts = act.toObject().damage.parts;
            parts[0].custom = { enabled: true, formula };
            await item.update({ [`system.activities.${act.id}.damage.parts`]: parts });
          }
          await victim.update({ 'system.abilities.wis.save.roll.bonus': '-30' });   // the save fails
          const spent = () => Number(pcAttacker.items.get(shot.id)?.system?.uses?.spent ?? 0);
          // In a combat on the PC Attacker's turn: the group's once per turn is a turn chit.
          const [c] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          combat = c; created.combats.push(c.id);
          await c.createEmbeddedDocuments('Combatant', [
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 20 },
            { tokenId: victimToken.document.id, sceneId: scene.id, actorId: victim.id, initiative: 10 }]);
          await c.startCombat();
          await sleep(500);
          const t1 = Date.now();
          const r1 = await strike(pcToken, attackOf(pcAttacker, bow), victimToken);
          ok('2a. a Longbow hit opens the damage offer with the group "Arcane Shot" (2 uses left), Beguiling Shot and Bursting Shot rows',
            !!r1.offer && !!hitBox(r1.offer, 'beguiling-shot') && !!hitBox(r1.offer, 'bursting-shot') && /2 (of 2 )?uses left/.test(groupText(r1.offer, 'arcane-shot')),
            `offer=${!!r1.offer} group="${groupText(r1.offer, 'arcane-shot').slice(0, 160)}" row="${hitRow(r1.offer, 'beguiling-shot')}"`);
          await tick(r1.offer, 'beguiling-shot');
          await rollOffer(r1.offer, r1.msg);
          const card = await waitFor(() => { const k = saveCardFor('beguiling-shot', t1); return outcomeOn(k, victim) ? k : null; }, 12000);
          const isCharmed = () => victim.effects.some(e => e.active && (e.statuses?.has?.('charmed') || /Beguiling Shot/.test(e.name)));
          await waitFor(isCharmed, 6000);
          await sleep(400);
          const charmed = isCharmed();
          ok('2b. Beguiling Shot ticked: the Wisdom save demanded at the Victim and FAILED, Charmed landed, ONE Arcane Shot use spent',
            !!card && (outcomeOn(card, victim) === 'failed') && charmed && (spent() === 1),
            `card=${!!card} outcome=${outcomeOn(card, victim)} charmed=${charmed} spent=${spent()} fx=${JSON.stringify(victim.effects.map(e => e.name))} saves=${JSON.stringify(card?.getFlag(MOD, 'saves') ?? null).slice(0, 500)} receipt=${JSON.stringify(card?.getFlag(MOD, 'effectReceipt') ?? null).slice(0, 300)}`);
          const r2 = await strike(pcToken, attackOf(pcAttacker, bow), victimToken, 19, { offerWait: 2500 });
          // With every option of the group used this turn there is nothing to pick: the offer stays shut and the damage rolls alone —
          // or, with another pick on the sheet, the group's rows read "used this turn". Either way no second use is spent.
          const greyed = !r2.offer || (/used this turn/.test(hitRow(r2.offer, 'beguiling-shot')) && /used this turn/.test(hitRow(r2.offer, 'bursting-shot')));
          if (r2.offer) await rollOffer(r2.offer, r2.msg); else await settleDamage(r2.msg);
          await sleep(500);
          ok('2c. a second Longbow hit this turn: the group is spent for the turn (no offer, or its rows "used this turn" — one chit for the whole group); the uses stay at 1 spent',
            greyed && (spent() === 1), `offer=${!!r2.offer} rows="${hitRow(r2.offer, 'beguiling-shot')}" / "${hitRow(r2.offer, 'bursting-shot')}" spent=${spent()}`);
          await c.nextRound(); await sleep(400);
          const r3 = await strike(pcToken, attackOf(pcAttacker, sword), victimToken, 19, { offerWait: 2500 });
          ok('2d. a Longsword hit (melee, no Ammunition): no Arcane Shot group',
            !r3.offer || (!hitBox(r3.offer, 'beguiling-shot') && !hitBox(r3.offer, 'bursting-shot')), `offer=${!!r3.offer}`);
          if (r3.offer) await rollOffer(r3.offer, r3.msg); else await settleDamage(r3.msg);
        }
      } finally {
        await closeOurs();
        if (combat && game.combats.get(combat.id)) await combat.delete();
        const fx = victim.effects.filter(e => e.statuses?.has?.('charmed') || /Beguiling Shot/.test(e.name)).map(e => e.id);
        if (fx.length) await victim.deleteEmbeddedDocuments('ActiveEffect', fx).catch(() => {});
        await victim.update({ 'system.attributes.hp.value': 400, 'system.abilities.wis.save.roll.bonus': priorActor[victim.id]['system.abilities.wis.save.roll.bonus'] }).catch(() => {});
        for (const it of [shot, beguile, burst, bow, sword]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 3. Harvest Undead — the Bloodied moment
    if (want(3)) {
      const harvest = await lendUuid(halfling, `${AUN}aunHarvestUndead`);
      try {
        if (!harvest) log.push('§3 skipped: no Harvest Undead');
        else {
          await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          const t0 = Date.now();
          const r0 = await strike(attackerToken, attackOf(attacker, hWeapon), halflingToken, 19, { offerWait: 2500 });
          if (r0.offer) await rollOffer(r0.offer, r0.msg); else await settleDamage(r0.msg);
          await sleep(1200);
          ok('3a. a hit at 400 of 400 (not Bloodied after): no Harvest Undead rebuke', !rebukeCards(t0, halfling).length && (hp(halfling) < 400) && (hp(halfling) > 200),
            `hp=${hp(halfling)} cards=${rebukeCards(t0, halfling).length}`);
          await closeOurs();
          await halfling.update({ 'system.attributes.hp.value': 201, 'system.attributes.hp.temp': 0 });
          const t1 = Date.now();
          const r1 = await strike(attackerToken, attackOf(attacker, hWeapon), halflingToken, 19, { offerWait: 2500 });
          if (r1.offer) await rollOffer(r1.offer, r1.msg); else await settleDamage(r1.msg);
          const card = await waitFor(() => rebukeCards(t1, halfling)[0] ?? null, 8000);
          const flag = card?.getFlag(MOD, 'rebuke');
          ok('3b. the hit that takes the Halfling to half or fewer: the rebuke card offers "Harvest Undead" (a Reaction, aimed at nobody)',
            !!card && (flag?.status === 'pending') && (flag.options ?? []).some(o => o.name === 'Harvest Undead') && (hp(halfling) <= 200) && (hp(halfling) > 0),
            `hp=${hp(halfling)} options=${JSON.stringify(flag?.options?.map(o => o.name) ?? null)}`);
          const pop = await waitFor(rebukePopup, 5000);
          pop?.element?.querySelector('button[data-action="pass"]')?.click();
          await sleep(300);
        }
      } finally {
        await closeOurs();
        await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 }).catch(() => {});
        if (harvest) await unlend(halfling, harvest);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 4. Instinctive Charm
    if (want(4)) {
      const charm = await lendUuid(halfling, `${AUN}aunInstinctiveCh`, { 'system.uses.max': '1', 'system.uses.spent': 0 });
      try {
        if (!charm) log.push('§4 skipped: no Instinctive Charm');
        else {
          await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          await attacker.update({ 'system.abilities.wis.save.roll.bonus': '-30' });   // the attacker's save fails
          const t0 = Date.now();
          const r0 = await strike(attackerToken, attackOf(attacker, hWeapon), halflingToken, 19, { offerWait: 2500 });
          if (r0.offer) await rollOffer(r0.offer, r0.msg); else await settleDamage(r0.msg);
          const card = await waitFor(() => rebukeCards(t0, halfling)[0] ?? null, 8000);
          const flag = card?.getFlag(MOD, 'rebuke');
          const idx = (flag?.options ?? []).findIndex(o => o.name === 'Instinctive Charm');
          ok('4a. the Attacker\'s hit 5 ft away offers the rebuke "Instinctive Charm" (within 30 ft, a use left)',
            !!card && (idx >= 0) && (flag.distance <= 30), `options=${JSON.stringify(flag?.options?.map(o => [o.name, o.reach, o.cost]) ?? null)} distance=${flag?.distance}`);
          const pop = await waitFor(rebukePopup, 5000);
          pop?.element?.querySelector(`button[data-action="use-${Math.max(idx, 0)}"]`)?.click();
          const demanded = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && m.getFlag(MOD, 'saves')?.targets?.some(x => x.uuid === attacker.uuid)) ?? null, 10000);
          await waitFor(() => outcomeOn(demanded, attacker), 10000);
          await sleep(500);
          ok('4b. Use: the Wisdom save demanded of the ATTACKER through the saves machine (it fails); the use spent',
            !!demanded && (outcomeOn(demanded, attacker) === 'failed') && (Number(halfling.items.get(charm.id)?.system?.uses?.spent ?? 0) === 1),
            `card=${!!demanded} outcome=${outcomeOn(demanded, attacker)} spent=${halfling.items.get(charm.id)?.system?.uses?.spent}`);
        }
      } finally {
        await closeOurs();
        await attacker.update({ 'system.abilities.wis.save.roll.bonus': priorActor[attacker.id]['system.abilities.wis.save.roll.bonus'] }).catch(() => {});
        await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 }).catch(() => {});
        if (charm) await unlend(halfling, charm);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 5. Ever-Ready Shot
    if (want(5)) {
      const shot = await lendUuid(pcAttacker, `${AUN}aunArcaneShot000`, { 'system.uses.max': '3', 'system.uses.spent': 2 });
      const ready = await lendUuid(pcAttacker, `${AUN}aunEverreadyShot`);
      let combat = null;
      try {
        if (!shot || !ready) log.push(`§5 skipped: shot=${!!shot} ready=${!!ready}`);
        else {
          const spent = () => Number(pcAttacker.items.get(shot.id)?.system?.uses?.spent ?? NaN);
          const [c] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          combat = c; created.combats.push(c.id);
          await c.createEmbeddedDocuments('Combatant', [{ tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id }]);
          const pcC = c.combatants.find(x => x.actorId === pcAttacker.id);
          const t0 = Date.now();
          await c.setInitiative(pcC.id, 15);
          const card = await waitFor(() => since(t0, 'initiativeGrant').find(m => m.getFlag(MOD, 'initiativeGrant')?.row === 'Ever-Ready Shot') ?? null, 8000);
          const pop = await waitFor(() => titled(/^Ever-Ready Shot — /), 6000);
          ok('5a. the PC Attacker\'s Initiative asks "Ever-Ready Shot — use it now?" (1 of 3 Arcane Shot uses left)',
            !!card && (card.getFlag(MOD, 'initiativeGrant')?.status === 'pending') && !!pop && (card.getFlag(MOD, 'initiativeGrant')?.back === 1),
            `card=${!!card} pop=${!!pop} flag=${JSON.stringify(card?.getFlag(MOD, 'initiativeGrant') ?? null).slice(0, 300)}`);
          pop?.element?.querySelector('button[data-action="yes"]')?.click();
          const done = await waitFor(() => card?.getFlag(MOD, 'initiativeGrant')?.applied ? card : null, 8000);
          await sleep(300);
          ok('5b. Yes: ONE use back — Arcane Shot at 2 of 3 (spent 1), the record says 1 regained',
            !!done && (spent() === 1) && (Number(done.getFlag(MOD, 'initiativeGrant')?.regained) === 1),
            `spent=${spent()} record=${JSON.stringify(done?.getFlag(MOD, 'initiativeGrant') ?? null).slice(0, 300)}`);
        }
      } finally {
        await closeOurs();
        if (combat && game.combats.get(combat.id)) await combat.delete();
        for (const it of [shot, ready]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ==== HEROES OF FAERÛN ====
    const HOF = 'Compendium.dnd-heroes-faerun.options.Item.';
    const holdOf = msg => msg?.getFlag(MOD, 'hold') ?? null;
    const dropReactionChips = async actor => {
      const ids = actor.effects.filter(e => e.getFlag(MOD, 'mastery') === 'reaction').map(e => e.id);
      if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {});
    };

    // ---- 6. Bloodthirst — the Bloodied moment, watched
    if (want(6)) {
      const thirst = await lendUuid(halfling, `${HOF}hofSotBloodthirs`, { 'system.uses.max': '2', 'system.uses.spent': 0 });
      const sword = await lendUuid(pcAttacker, `${PHB}phbwepLongsword0`);
      // The Halfling 10 ft from the Victim (two squares east), on the PC Attacker's side: the Victim is its enemy.
      await halflingToken.document.update({ x: 1700, y: 1500 });
      await sleep(300);
      try {
        if (!thirst || !sword) log.push(`§6 skipped: thirst=${!!thirst} sword=${!!sword}`);
        else {
          await victim.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          const t0 = Date.now();
          const r0 = await strike(pcToken, attackOf(pcAttacker, sword), victimToken, 19, { offerWait: 2500 });
          if (r0.offer) await rollOffer(r0.offer, r0.msg); else await settleDamage(r0.msg);
          await sleep(1200);
          ok('6a. a hit that leaves the Victim above half: no Bloodthirst card for the Halfling', !rebukeCards(t0, halfling).length && (hp(victim) > 200), `hp=${hp(victim)} cards=${rebukeCards(t0, halfling).length}`);
          await closeOurs();
          await victim.update({ 'system.attributes.hp.value': 201, 'system.attributes.hp.temp': 0 });
          const t1 = Date.now();
          const r1 = await strike(pcToken, attackOf(pcAttacker, sword), victimToken, 19, { offerWait: 2500 });
          if (r1.offer) await rollOffer(r1.offer, r1.msg); else await settleDamage(r1.msg);
          const card = await waitFor(() => rebukeCards(t1, halfling)[0] ?? null, 8000);
          const flag = card?.getFlag(MOD, 'rebuke');
          ok('6b. the hit that makes the Victim Bloodied: the Halfling\'s rebuke card "BF Test Victim is Bloodied" offers Bloodthirst (the Victim its target, 10 ft)',
            !!card && flag?.watch && (flag.sourceUuid === victim.uuid) && (flag.options ?? []).some(o => o.name === 'Bloodthirst') && (flag.distance === 10) && (hp(victim) <= 200) && (hp(victim) > 0),
            `hp=${hp(victim)} flag=${JSON.stringify(flag ?? null).slice(0, 300)}`);
          const pop = await waitFor(rebukePopup, 5000);
          pop?.element?.querySelector('button[data-action="use-0"]')?.click();
          await waitFor(() => card?.getFlag(MOD, 'rebuke')?.answer === 'use', 6000);
          await sleep(600);
          ok('6c. Use: the answer recorded, a Bloodthirst use spent', (card?.getFlag(MOD, 'rebuke')?.answer === 'use') && (Number(halfling.items.get(thirst.id)?.system?.uses?.spent ?? 0) === 1),
            `answer=${card?.getFlag(MOD, 'rebuke')?.answer} spent=${halfling.items.get(thirst.id)?.system?.uses?.spent}`);
        }
      } finally {
        await closeOurs();
        await halflingToken.document.update({ x: 1500, y: 1700 });
        await victim.update({ 'system.attributes.hp.value': 400 }).catch(() => {});
        if (thirst) await unlend(halfling, thirst);
        if (sword) await unlend(pcAttacker, sword);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 7. Elemental Rebuke
    if (want(7)) {
      const rebuke = await lendUuid(halfling, `${HOF}hofOngElementalR`, { 'system.uses.max': '1', 'system.uses.spent': 0 });
      try {
        if (!rebuke) log.push('§7 skipped: no Elemental Rebuke');
        else {
          await dropReactionChips(halfling);
          await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          await attacker.update({ 'system.abilities.dex.save.roll.bonus': '-30' });
          const atkHp = hp(attacker);
          const t0 = Date.now();
          attackerToken.control({ releaseOthers: true });
          halflingToken.setTarget(true, { releaseOthers: true });
          await sleep(80);
          faces([[19, 20], [4, 6], [4, 6], [4, 6]]);
          const act = attackOf(attacker, hWeapon);
          const usage = await act.use({ subsequentActions: false }, { configure: false }, {});
          const rolls = await act.rollAttack({}, { configure: false }, usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
          const msg = rolls?.[0]?.parent ?? null;
          CONFIG.Dice.randomUniform = realPRNG;
          const hold = await waitFor(() => holdOf(msg), 6000);
          const pop = await waitFor(() => popups().find(app => /Elemental Rebuke/.test(textOf(app.element))
            && (app.element?.querySelector?.('input[name="bf-rescue"][value="Elemental Rebuke"]') || app.element?.querySelector?.('button[data-action="cast"]'))) ?? null, 8000);
          ok('7a. the Attacker hits the Halfling: the hold and the Halfling\'s popup with Elemental Rebuke', !!hold && !!pop && (hold.targets?.[0]?.uuid === halfling.uuid), `hold=${!!hold} pop=${!!pop}`);
          const box = pop?.element?.querySelector('input[name="bf-rescue"][value="Elemental Rebuke"]');
          if (box) { if (!box.checked) box.click(); await sleep(50); pop.element.querySelector('button[data-action="answer"]')?.click(); }
          else pop?.element?.querySelector('button[data-action="cast"]')?.click();
          const target = await waitFor(() => { const h = holdOf(msg); return (h?.status === 'resolved') ? (h.targets.find(x => x.uuid === halfling.uuid) ?? null) : null; }, 12000);
          const dmg = await waitFor(() => { const d = damageFor(msg?.id); const r = d?.getFlag(MOD, 'receipt')?.targets?.find(x => x.uuid === halfling.uuid); return r ? { d, r } : null; }, 12000);
          const saveCard = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && m.getFlag(MOD, 'saves')?.targets?.some(x => x.uuid === attacker.uuid)) ?? null, 12000);
          await waitFor(() => outcomeOn(saveCard, attacker), 12000);
          await waitFor(() => hp(attacker) < atkHp, 8000);
          await sleep(400);
          ok('7b. Cast: the damage HALVED on the receipt, the use spent, the Rebuke\'s Dexterity save demanded of the Attacker — failed, its own damage lands on the Attacker',
            (target?.answer === 'cast') && (dmg?.r?.multiplier === 0.5) && (Number(halfling.items.get(rebuke.id)?.system?.uses?.spent) === 1)
              && (outcomeOn(saveCard, attacker) === 'failed') && (hp(attacker) < atkHp),
            `answer=${target?.answer} mult=${dmg?.r?.multiplier} spent=${halfling.items.get(rebuke.id)?.system?.uses?.spent} outcome=${outcomeOn(saveCard, attacker)} atkHp=${atkHp}→${hp(attacker)}`);
        }
      } finally {
        await closeOurs();
        await dropReactionChips(halfling);
        await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 }).catch(() => {});
        // The Rebuke's damage dropped the Attacker to 0: its HP, Dead status and save bonus restored for the sections after.
        await attacker.update({ 'system.attributes.hp.value': priorActor[attacker.id]['system.attributes.hp.value'], 'system.abilities.dex.save.roll.bonus': priorActor[attacker.id]['system.abilities.dex.save.roll.bonus'] }).catch(() => {});
        const dead = attacker.effects.filter(e => e.statuses?.has?.('dead') || e.statuses?.has?.('unconscious')).map(e => e.id);
        if (dead.length) await attacker.deleteEmbeddedDocuments('ActiveEffect', dead).catch(() => {});
        if (rebuke) await unlend(halfling, rebuke);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 8. Shared Resilience
    if (want(8)) {
      const shared = await lendUuid(pcAttacker, `${HOF}hofPdkSharedResi`);
      const indomitable = await lendUuid(pcAttacker, 'Compendium.dnd-players-handbook.classes.Item.phbftrIndomitabl', { 'system.uses.max': '2', 'system.uses.spent': 0 });
      const fighter = await lendUuid(pcAttacker, 'Compendium.dnd-players-handbook.classes.Item.phbftrFighter000', { 'system.levels': 15 });
      let combat = null;
      // The Halfling beside the fighter (10 ft), its save a demanded one: the Attacker casts at it.
      await halflingToken.document.update({ x: 1600, y: 1500 });
      await sleep(300);
      const spentIndom = () => Number(pcAttacker.items.get(indomitable?.id)?.system?.uses?.spent ?? NaN);
      try {
        if (!shared || !indomitable || !fighter) log.push(`§8 skipped: shared=${!!shared} indomitable=${!!indomitable} fighter=${!!fighter}`);
        else {
          await set('saveRolls', 'prompt');
          await dropReactionChips(pcAttacker);
          // In a combat (a Reaction chip is written only in one), the Attacker's turn.
          const [c] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          combat = c; created.combats.push(c.id);
          await c.createEmbeddedDocuments('Combatant', [
            { tokenId: attackerToken.document.id, sceneId: scene.id, actorId: attacker.id, initiative: 20 },
            { tokenId: halflingToken.document.id, sceneId: scene.id, actorId: halfling.id, initiative: 15 },
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 10 }]);
          await c.startCombat();
          await sleep(400);
          // The Attacker lent Hold Person (at will): the Halfling fails its Wisdom save.
          const hold = await lendUuid(attacker, 'Compendium.dnd-players-handbook.spells.Item.phbsplHoldPerson', { 'system.prepared': 1, 'system.method': 'atwill' });
          // -8, not -30: the margin gate asks only when a reroll CAN turn the verdict (a 1 - 8 fails DC 10; 15 + 15 - 8 passes).
          await halfling.update({ 'system.abilities.wis.save.roll.bonus': '-8' });
          const t0 = Date.now();
          const saveAct = hold?.system?.activities?.find(a => a.type === 'save');
          attackerToken.control({ releaseOthers: true });
          halflingToken.setTarget(true, { releaseOthers: true });
          await sleep(100);
          const use = await saveAct?.use({ consume: { spellSlot: false } }, { configure: false }, {});
          const card = use?.message ?? null;
          await waitFor(() => card?.getFlag(MOD, 'saves'), 6000);
          // The demanded save rolled by the Halfling (saveRolls prompt): a 1 — it fails; the fighter is asked before the verdict.
          faces([[1, 20]]);
          const rolls = await halfling.rollSavingThrow({ ability: 'wis' }, { configure: false }, {});
          const rolled = rolls?.[0]?.parent ?? null;
          const pop = await waitFor(() => popups().find(app => /Shared Resilience/.test(textOf(app.element)) && app.element?.querySelector?.('button[data-action="answer"]')) ?? null, 8000);
          const bflag = rolled?.getFlag(MOD, 'bystanderRoll');
          const { poolOf } = await import('/modules/fvtt-mod-battleflow/scripts/shared.js');
          const { bystanderRows } = await import('/modules/fvtt-mod-battleflow/scripts/lookup.js');
          const sharedAct = [...(pcAttacker.items.get(shared.id)?.system?.activities ?? [])][0] ?? null;
          const debug = `rows=${JSON.stringify(bystanderRows('save'))} pool=${poolOf(pcAttacker, sharedAct)?.name ?? null}/${poolOf(pcAttacker, sharedAct)?.system?.uses?.value ?? null} entry=${JSON.stringify(card?.getFlag(MOD, 'saves')?.targets?.find(x => x.uuid === halfling.uuid) ?? null).slice(0, 200)} dc=${card?.getFlag(MOD, 'saves')?.dc} rolledFlags=${JSON.stringify(Object.keys(rolled?.flags?.[MOD] ?? {}))}`;
          ok('8a. the Halfling fails Hold Person\'s save 10 ft from the fighter: the fighter is asked (Shared Resilience — a reroll + the fighter\'s level)',
            !!card && !!pop && !!bflag && (bflag.guards ?? []).some(g => (g.row === 'Shared Resilience') && (g.uuid === pcAttacker.uuid)),
            `card=${!!card} pop=${!!pop} guards=${JSON.stringify(bflag?.guards?.map(g => [g.row, g.name]) ?? null)} text="${textOf(pop?.element).slice(0, 200)}" ${debug}`);
          faces([[15, 20]]);   // the reroll's d20
          const guardBox = [...(pop?.element?.querySelectorAll?.('input[name="bf-bystander-roll"]') ?? [])][0] ?? null;
          if (guardBox && !guardBox.checked) { guardBox.click(); await sleep(50); }
          pop?.element?.querySelector('button[data-action="answer"]')?.click();
          const done = await waitFor(() => (rolled?.getFlag(MOD, 'bystanderRoll')?.status === 'resolved') ? rolled.getFlag(MOD, 'bystanderRoll') : null, 12000);
          const rerollMsg = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'respondsTo') === rolled?.id)) ?? null, 8000);
          CONFIG.Dice.randomUniform = realPRNG;
          await sleep(500);
          const bent = done?.bent ?? null;
          ok('8b. Answer: the Halfling\'s d20 rerolled (15) with "+ 15" (the fighter\'s level) in the flavor and the total, an Indomitable use spent',
            !!done && (done.answer === 'roll') && (bent?.how === 'reroll') && !!rerollMsg && /\+ 15/.test(rerollMsg.flavor ?? '') && (Number(bent?.total) >= 15 + 15 - 8) && (spentIndom() === 1),
            `answer=${done?.answer} bent=${JSON.stringify(bent)} flavor="${rerollMsg?.flavor}" indomitable=${spentIndom()}`);
          if (hold) await unlend(attacker, hold);
        }
      } finally {
        await closeOurs();
        await halfling.update({ 'system.abilities.wis.save.roll.bonus': priorActor[halfling.id]['system.abilities.wis.save.roll.bonus'] }).catch(() => {});
        await set('saveRolls', 'auto');
        if (combat && game.combats.get(combat.id)) await combat.delete();
        await dropReactionChips(pcAttacker);
        await halflingToken.document.update({ x: 1500, y: 1700 });
        const fx = halfling.effects.filter(e => /Paralyzed|Hold Person/.test(e.name) || e.statuses?.has?.('paralyzed')).map(e => e.id);
        if (fx.length) await halfling.deleteEmbeddedDocuments('ActiveEffect', fx).catch(() => {});
        for (const it of [shared, indomitable, fighter]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 9. Frigid Explorer — Polar Strikes and Biting Cold
    if (want(9)) {
      const frigid = await lendUuid(pcAttacker, `${HOF}hofWiwFrigidExpl`);
      // Polar Strike's die is the Winter Walker's scale value (@scale.frigid-explorer.die) — the lent feature has no subclass
      // behind it, so the part is pinned to the level-3 die by hand: 1d4 cold.
      const polar = frigid?.system?.activities?.find(a => a.name === 'Polar Strike') ?? null;
      if (frigid && polar) await frigid.update({ [`system.activities.${polar.id}.damage.parts`]: [{ number: 1, denomination: 4, types: ['cold'], custom: { enabled: false, formula: '' } }] });
      const sword = await lendUuid(pcAttacker, `${PHB}phbwepLongsword0`);
      keep(victim, { 'system.traits.dr.value': [...(victim.system._source.traits?.dr?.value ?? [])] });
      try {
        if (!frigid || !sword) log.push(`§9 skipped: frigid=${!!frigid} sword=${!!sword}`);
        else {
          await victim.update({ 'system.attributes.hp.value': 400, 'system.traits.dr.value': ['cold'] });
          const r0 = await strike(pcToken, attackOf(pcAttacker, sword), victimToken);
          const row = r0.offer?.element?.querySelector('[data-bf-rider-row="frigid-explorer-polar-strikes"]');
          const box = r0.offer?.element?.querySelector('input[name="bf-rider"][value="frigid-explorer-polar-strikes"]');
          ok('9a. a Longsword hit: the offer\'s TICKED row "Polar Strikes — 1d4 cold"', !!r0.offer && !!row && !!box?.checked && /Polar Strikes/.test(textOf(row)) && /1d4/.test(textOf(row)),
            `offer=${!!r0.offer} row="${textOf(row)}" ticked=${box?.checked}`);
          const dmg = await rollOffer(r0.offer, r0.msg);
          await sleep(400);
          const receipt = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid);
          // A rolled part's type sits in `options.type` or `options.types` (a rider's part); the receipt's parts say what landed.
          const typesOf = r => [...(r.options?.types ?? []), r.options?.type].filter(Boolean);
          const coldTotal = (dmg?.rolls ?? []).filter(r => typesOf(r).includes('cold')).reduce((n, r) => n + Number(r.total ?? 0), 0);
          const nonCold = (dmg?.rolls ?? []).filter(r => !typesOf(r).includes('cold')).reduce((n, r) => n + Number(r.total ?? 0), 0);
          const taken = 400 - hp(victim);
          const coldLanded = (receipt?.parts ?? []).filter(p => p.type === 'cold').reduce((n, p) => n + Number(p.taken ?? p.value ?? 0), 0);
          ok('9b. Biting Cold: the cold die rides and lands in FULL on the Cold-resistant Victim (the whole roll taken, nothing halved)',
            !!dmg && (coldTotal > 0) && (taken === coldTotal + nonCold),
            `cold=${coldTotal} other=${nonCold} taken=${taken} coldLanded=${coldLanded} hp=${hp(victim)} parts=${JSON.stringify(receipt?.parts ?? null).slice(0, 300)}`);
        }
      } finally {
        await closeOurs();
        await victim.update({ 'system.attributes.hp.value': 400, 'system.traits.dr.value': priorActor[victim.id]['system.traits.dr.value'] }).catch(() => {});
        for (const it of [frigid, sword]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 10. Chilling Retribution
    if (want(10)) {
      const chill = await lendUuid(halfling, `${HOF}hofWiwChillingRe`, { 'system.uses.max': '1', 'system.uses.spent': 0 });
      try {
        if (!chill) log.push('§10 skipped: no Chilling Retribution');
        else {
          await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          await attacker.update({ 'system.abilities.wis.save.roll.bonus': '-30' });
          const t0 = Date.now();
          const r0 = await strike(attackerToken, attackOf(attacker, hWeapon), halflingToken, 19, { offerWait: 2500 });
          if (r0.offer) await rollOffer(r0.offer, r0.msg); else await settleDamage(r0.msg);
          const card = await waitFor(() => rebukeCards(t0, halfling)[0] ?? null, 8000);
          const flag = card?.getFlag(MOD, 'rebuke');
          const idx = (flag?.options ?? []).findIndex(o => o.name === 'Chilling Retribution');
          ok('10a. the Attacker\'s hit offers the rebuke "Chilling Retribution"', !!card && (idx >= 0), `options=${JSON.stringify(flag?.options?.map(o => o.name) ?? null)}`);
          const pop = await waitFor(rebukePopup, 5000);
          pop?.element?.querySelector(`button[data-action="use-${Math.max(idx, 0)}"]`)?.click();
          const demanded = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && m.getFlag(MOD, 'saves')?.targets?.some(x => x.uuid === attacker.uuid)) ?? null, 10000);
          await waitFor(() => outcomeOn(demanded, attacker), 10000);
          const stunned = await waitFor(() => attacker.effects.some(e => e.active && (e.statuses?.has?.('stunned') || /Chilled/.test(e.name))), 6000);
          ok('10b. Use: the Attacker\'s Wisdom save demanded and failed — Stunned (Chilled) lands on the Attacker, the use spent',
            !!demanded && (outcomeOn(demanded, attacker) === 'failed') && !!stunned && (Number(halfling.items.get(chill.id)?.system?.uses?.spent ?? 0) === 1),
            `card=${!!demanded} outcome=${outcomeOn(demanded, attacker)} stunned=${!!stunned} fx=${JSON.stringify(attacker.effects.map(e => e.name))}`);
        }
      } finally {
        await closeOurs();
        const fx = attacker.effects.filter(e => e.statuses?.has?.('stunned') || /Chilled/.test(e.name)).map(e => e.id);
        if (fx.length) await attacker.deleteEmbeddedDocuments('ActiveEffect', fx).catch(() => {});
        await attacker.update({ 'system.abilities.wis.save.roll.bonus': priorActor[attacker.id]['system.abilities.wis.save.roll.bonus'] }).catch(() => {});
        await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 }).catch(() => {});
        if (chill) await unlend(halfling, chill);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ==== RAVENLOFT: THE HORRORS WITHIN ====
    const RHW = 'Compendium.dnd-ravenloft-horrors-within.options.Item.';
    // a monster's trait, lent off the book's bestiary actor by name (an actor pack's items have no uuid of their own to lend by)
    const lendTrait = async (actor, actorName, traitName) => {
      const pack = game.packs.get('dnd-ravenloft-horrors-within.actors');
      const entry = pack?.index.find(e => e.name === actorName) ?? null;
      const monster = entry ? await pack.getDocument(entry._id) : null;
      const trait = monster?.items?.getName?.(traitName) ?? null;
      if (!trait) { log.push(`this box ships no ${actorName}'s ${traitName}`); return null; }
      const data = trait.toObject();
      const [item] = await actor.createEmbeddedDocuments('Item', [data]);
      lentBy.set(actor, [...(lentBy.get(actor) ?? []), item.id]);
      return actor.items.get(item.id);
    };
    const setStatus = async (actor, id, active) => { if (actor.statuses.has(id) !== active) await actor.toggleStatusEffect(id, { active }); await sleep(200); };

    // ---- 11. The mishaps — a 1 on the d20
    if (want(11)) {
      const gift = await lendUuid(halfling, `${RHW}rhwAberrantAnato`);
      try {
        if (!gift) log.push('§11 skipped: no Aberrant Anatomy on this box');
        else {
          await set('saveRolls', 'auto');
          const t0 = Date.now();
          faces([[1, 20], [15, 20]]);   // the test's 1, then the mishap save's 15
          await halfling.rollSavingThrow({ ability: 'dex' }, { configure: false }, {});
          const card = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && m.getFlag(MOD, 'mishap')) ?? null, 8000);
          const mish = card?.getFlag(MOD, 'mishap');
          const saves = await waitFor(() => card?.getFlag(MOD, 'saves') ?? null, 6000);
          CONFIG.Dice.randomUniform = realPRNG;
          ok('11a. a Dexterity save rolling a 1: Warping Flesh demanded of the Halfling — the mishap card names the test, a Constitution save at the pack\'s DC',
            !!card && (mish?.row === 'Aberrant Anatomy') && (mish?.face === 1) && /saving throw/.test(mish?.test ?? '') && !!saves && (saves.abilities?.[0] === 'con')
              && (Number(saves.dc) > 0) && !!saves.targets?.some(x => x.uuid === halfling.uuid),
            `card=${!!card} mishap=${JSON.stringify(mish ?? null).slice(0, 200)} saves=${JSON.stringify({ abilities: saves?.abilities, dc: saves?.dc, targets: saves?.targets?.map(x => [x.name, x.outcome]) })}`);
          const t1 = Date.now();
          faces([[12, 20]]);
          await halfling.rollSavingThrow({ ability: 'dex' }, { configure: false }, {});
          CONFIG.Dice.randomUniform = realPRNG;
          await sleep(1500);
          const extra = game.messages.contents.filter(m => (m.timestamp >= t1) && m.getFlag(MOD, 'mishap')).length;
          ok('11b. a save rolling a 12: no mishap', extra === 0, `cards=${extra}`);
        }
      } finally {
        await closeOurs();
        for (const e of halfling.effects.filter(e => /Warping Flesh/.test(e.name) || e.statuses?.has?.('stunned'))) await e.delete().catch(() => {});
        if (gift) await unlend(halfling, gift);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 12. Strength of the Grave — the drop held by the dice, the use spent on the success alone
    if (want(12)) {
      const power = await lendUuid(halfling, `${RHW}rhwSSPowerofShNG`, { 'system.uses.max': '1', 'system.uses.spent': 0 });
      keep(halfling, { 'system.abilities.cha.save.roll.bonus': halfling.system._source.abilities?.cha?.save?.roll?.bonus ?? '' });
      try {
        if (!power) log.push('§12 skipped: no Power of Shadow on this box');
        else {
          const spent = () => Number(halfling.items.get(power.id)?.system?.uses?.spent ?? NaN);
          const dropOnce = async (bonus) => {
            for (const e of halfling.effects.filter(e => ['Dead', 'Unconscious'].includes(e.name))) await e.delete().catch(() => {});
            await halfling.update({ 'system.attributes.hp.value': 2, 'system.attributes.hp.temp': 0, 'system.abilities.cha.save.roll.bonus': bonus });
            const t0 = Date.now();
            const r0 = await strike(attackerToken, attackOf(attacker, hWeapon), halflingToken, 19, { offerWait: 2500 });
            if (r0.offer) await rollOffer(r0.offer, r0.msg); else await settleDamage(r0.msg);
            const drop = await waitFor(() => since(t0, 'dropToOne').find(m => m.getFlag(MOD, 'dropToOne')?.row === 'Power of Shadow') ?? null, 10000);
            await sleep(800);
            return drop?.getFlag(MOD, 'dropToOne') ?? null;
          };
          const failed = await dropOnce('-30');
          ok('12a. the hit that drops the Halfling to 0: Strength of the Grave\'s Charisma save rolls (DC 5 + the damage); it FAILS — 0 lands, the use is NOT spent (the success alone spends it)',
            !!failed && (failed.answer === 'failed') && (failed.save?.ability === 'cha') && (hp(halfling) === 0) && (spent() === 0),
            `flag=${JSON.stringify(failed).slice(0, 240)} hp=${hp(halfling)} spent=${spent()}`);
          const saved = await dropOnce('+30');
          await waitFor(() => spent() === 1, 6000);
          ok('12b. the same drop, the save SUCCEEDS: the Halfling stays up (its Hit Points set to Cha + the sorcerer level — at least the held 1), the use spent',
            !!saved && (saved.answer === 'saved') && (hp(halfling) >= 1) && (spent() === 1),
            `flag=${JSON.stringify(saved).slice(0, 240)} hp=${hp(halfling)} spent=${spent()}`);
        }
      } finally {
        await closeOurs();
        for (const e of halfling.effects.filter(e => ['Dead', 'Unconscious'].includes(e.name))) await e.delete().catch(() => {});
        await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0, 'system.abilities.cha.save.roll.bonus': priorActor[halfling.id]['system.abilities.cha.save.roll.bonus'] }).catch(() => {});
        if (power) await unlend(halfling, power);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 13. Ominous Strikes — the Wisdom modifier against a Frightened target
    if (want(13)) {
      const might = await lendUuid(pcAttacker, `${RHW}rhwHWAncientMibA`);
      const sword = await lendUuid(pcAttacker, `${PHB}phbwepLongsword0`);
      keep(pcAttacker, { 'system.abilities.wis.value': pcAttacker.system._source.abilities?.wis?.value ?? 10 });
      try {
        if (!might || !sword) log.push(`§13 skipped: might=${!!might} sword=${!!sword}`);
        else {
          await pcAttacker.update({ 'system.abilities.wis.value': 16 });
          await victim.update({ 'system.attributes.hp.value': 400 });
          await setStatus(victim, 'frightened', true);
          const r0 = await strike(pcToken, attackOf(pcAttacker, sword), victimToken);
          const row = r0.offer?.element?.querySelector('[data-bf-rider-row="ancient-might-ominous-strikes"]');
          ok('13a. a Longsword hit on the FRIGHTENED Victim: the offer\'s ticked row "Ominous Strikes — +3" (the Wisdom modifier, the weapon\'s type)',
            !!r0.offer && !!row && /Ominous Strikes/.test(textOf(row)) && /\+?3\b/.test(textOf(row)),
            `offer=${!!r0.offer} row="${textOf(row).slice(0, 160)}"`);
          const dmg = await rollOffer(r0.offer, r0.msg);
          await sleep(400);
          const rode = (dmg?.getFlag(MOD, 'clockRiders')?.riders ?? []).some(r => r.key === 'ancient-might-ominous-strikes');
          ok('13b. the +3 rides the damage (the clockRiders record names it)', !!dmg && rode, `dmg=${!!dmg} riders=${JSON.stringify(dmg?.getFlag(MOD, 'clockRiders')?.riders?.map(r => r.key) ?? null)}`);
          await setStatus(victim, 'frightened', false);
          const r1 = await strike(pcToken, attackOf(pcAttacker, sword), victimToken, 19, { offerWait: 2500 });
          const row1 = r1.offer?.element?.querySelector('[data-bf-rider-row="ancient-might-ominous-strikes"]');
          ok('13c. the Victim no longer Frightened: no Ominous Strikes row', !row1 || /not frightened/i.test(textOf(row1)), `offer=${!!r1.offer} row="${textOf(row1).slice(0, 120)}"`);
          if (r1.offer) await rollOffer(r1.offer, r1.msg); else await settleDamage(r1.msg);
        }
      } finally {
        await closeOurs();
        await setStatus(victim, 'frightened', false);
        await victim.update({ 'system.attributes.hp.value': 400 }).catch(() => {});
        await pcAttacker.update({ 'system.abilities.wis.value': priorActor[pcAttacker.id]['system.abilities.wis.value'] }).catch(() => {});
        for (const it of [might, sword]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 14. Hungering Might — the heal on the ranger's own hit while the form stands, Bloodied, once per turn
    if (want(14)) {
      const wrath = await lendUuid(pcAttacker, `${RHW}rhwHWWrathofth3C`);
      const sword = await lendUuid(pcAttacker, `${PHB}phbwepLongsword0`);
      keep(pcAttacker, { 'system.attributes.hp.value': pcAttacker.system._source.attributes.hp.value });
      let combat = null;
      try {
        if (!wrath || !sword) log.push(`§14 skipped: wrath=${!!wrath} sword=${!!sword}`);
        else {
          // the form is an ENCHANTMENT the feature puts on itself ("Transform Self"): the applied copy made by hand (the sheet's
          // use consumes a Favored Enemy the fixture has none of, and its enchant flow waits on a drop)
          const item = pcAttacker.items.get(wrath.id);
          const transform = item?.system?.activities?.find(a => a.name === 'Transform Self') ?? null;
          const applied = () => item?.effects?.find(e => (e.name === 'Ghastly Form') && e.isAppliedEnchantment && !e.disabled) ?? null;
          // ⚠ never `use` the enchant here: its drop-an-item flow waits on a hand the suite has none of
          if (!applied()) {
            const template = item?.effects?.find(e => (e.name === 'Ghastly Form') && (e.type === 'enchantment')) ?? null;
            if (template) {
              const data = template.toObject(); delete data._id;
              data.origin = transform?.uuid ?? item.uuid; data.disabled = false;
              await item.createEmbeddedDocuments('ActiveEffect', [data]);
              await sleep(300);
            }
          }
          const form = applied();
          await pcAttacker.update({ 'system.attributes.hp.value': 5 });
          await victim.update({ 'system.attributes.hp.value': 400 });
          const [c] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          combat = c; created.combats.push(c.id);
          await c.createEmbeddedDocuments('Combatant', [
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 20 },
            { tokenId: victimToken.document.id, sceneId: scene.id, actorId: victim.id, initiative: 10 }]);
          await c.startCombat();
          await sleep(400);
          const t0 = Date.now();
          const r0 = await strike(pcToken, attackOf(pcAttacker, sword), victimToken);
          if (r0.offer) await rollOffer(r0.offer, r0.msg); else await settleDamage(r0.msg);
          const heal = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && m.getFlag(MOD, 'healOnHit')?.hit && (m.getFlag(MOD, 'healOnHit')?.casterUuid === pcAttacker.uuid)) ?? null, 8000);
          await waitFor(() => hp(pcAttacker) > 5, 6000);
          const f = heal?.getFlag(MOD, 'healOnHit');
          ok('14a. Ghastly Form on, Bloodied: the Longsword hit heals the ranger 1d10 + Wis (the heal-on-hit card, the receipt on it)',
            !!form && !!heal && (f?.key === 'Wrath of the Wild') && (Number(f?.amount) > 0) && (hp(pcAttacker) === Math.min(20, 5 + Number(f?.amount))),
            `form=${!!form} card=${!!heal} flag=${JSON.stringify(f ?? null).slice(0, 200)} hp=${hp(pcAttacker)}`);
          const before = hp(pcAttacker);
          const t1 = Date.now();
          const r1 = await strike(pcToken, attackOf(pcAttacker, sword), victimToken);
          if (r1.offer) await rollOffer(r1.offer, r1.msg); else await settleDamage(r1.msg);
          await sleep(1500);
          const second = game.messages.contents.filter(m => (m.timestamp >= t1) && m.getFlag(MOD, 'healOnHit')?.hit).length;
          ok('14b. a second hit the same turn: once per turn — no second heal, the Hit Points unchanged', (second === 0) && (hp(pcAttacker) === before), `cards=${second} hp=${before}→${hp(pcAttacker)}`);
        }
      } finally {
        await closeOurs();
        if (combat && game.combats.get(combat.id)) await combat.delete();
        for (const e of pcAttacker.effects.filter(e => (e.getFlag(MOD, 'mastery') === 'rider'))) await e.delete().catch(() => {});
        // the aura's Frightened on whoever stood inside at the ranger's turn start
        for (const a of [attacker, victim, halfling]) for (const e of a.effects.filter(e => e.statuses?.has?.('frightened') && String(e.origin ?? '').startsWith(pcAttacker.uuid))) await e.delete().catch(() => {});
        await pcAttacker.update({ 'system.attributes.hp.value': priorActor[pcAttacker.id]['system.attributes.hp.value'] }).catch(() => {});
        await victim.update({ 'system.attributes.hp.value': 400 }).catch(() => {});
        for (const it of [wrath, sword]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 15. Terrorizer — Advantage against a Frightened target (the attack gate's bend)
    if (want(15)) {
      const terror = await lendTrait(attacker, 'Dullahan', 'Terrorizer');
      try {
        if (!terror) log.push('§15 skipped: no Terrorizer on this box');
        else {
          await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          await setStatus(halfling, 'frightened', true);
          await setStatus(attacker, 'frightened', false);   // a stray Frightened on the Attacker would read as its own Disadvantage
          // THE GATE lives in the roll dialog ("no dialog, no gate"): the attack rolls configured, the suite reads the gate's
          // section and presses its highlighted default, as a hand would (smoke-reminders' pattern).
          attackerToken.control({ releaseOthers: true });
          halflingToken.setTarget(true, { releaseOthers: true });
          await sleep(80);
          faces([[19, 20], [19, 20], [3, 6], [3, 6], [3, 6]]);
          const act = attackOf(attacker, hWeapon);
          const usage = await act.use({ subsequentActions: false }, { configure: false }, {});
          const rolling = act.rollAttack({}, { configure: true }, usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
          const dialog = await waitFor(() => [...foundry.applications.instances.values()].find(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element?.querySelector('[data-bf-reminder]')) ?? null, 6000);
          const gateText = textOf(dialog?.element?.querySelector('[data-bf-reminder]'));
          const def = dialog?.element?.querySelector('button[autofocus]')?.dataset?.action ?? null;
          ok('15a. the Attacker\'s attack on the FRIGHTENED Halfling: the gate opens with Terrorizer, Advantage the highlighted default',
            !!dialog && /Terrorizer/.test(gateText) && /Advantage/.test(gateText) && (def === 'advantage'), `dialog=${!!dialog} default=${def} text="${gateText.slice(0, 160)}"`);
          (dialog?.element?.querySelector('button[autofocus]') ?? dialog?.element?.querySelector('[data-application-part="buttons"] button[data-action="advantage"]'))?.click();
          const rolls = await Promise.race([rolling, sleep(15000)]);
          const msg = rolls?.[0]?.parent ?? null;
          const r0 = { msg, offer: null };
          if (msg) await settleDamage(msg);
          const rem = r0.msg?.getFlag(MOD, 'reminder');
          ok('15a2. the attack\'s record names Terrorizer among the sources, the net Advantage (two d20, the higher kept)',
            !!rem && (rem.sources ?? []).some(s => /Terrorizer/.test(s.label ?? '')) && (rem.net === 'advantage') && ((r0.msg?.rolls?.[0]?.dice?.[0]?.number ?? 1) === 2),
            `record=${JSON.stringify(rem ?? null).slice(0, 240)} d20s=${r0.msg?.rolls?.[0]?.dice?.[0]?.number}`);
          await setStatus(halfling, 'frightened', false);
          const r1 = await strike(attackerToken, attackOf(attacker, hWeapon), halflingToken, 19, { offerWait: 2500 });
          if (r1.offer) await rollOffer(r1.offer, r1.msg); else await settleDamage(r1.msg);
          const rem1 = r1.msg?.getFlag(MOD, 'reminder');
          ok('15b. the Halfling no longer Frightened: no Terrorizer source', !(rem1?.sources ?? []).some(s => /Terrorizer/.test(s.label ?? '')), `record=${JSON.stringify(rem1 ?? null).slice(0, 160)}`);
        }
      } finally {
        await closeOurs();
        await setStatus(halfling, 'frightened', false);
        await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 }).catch(() => {});
        if (terror) await unlend(attacker, terror);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 16. Hypervigilance — the Initiative d20 of 9 or lower offered a reroll
    if (want(16)) {
      const surv = await lendUuid(pcAttacker, `${RHW}rhwSurvivor2zrM3`);
      let combat = null;
      try {
        if (!surv) log.push('§16 skipped: no Survivor on this box');
        else {
          const [c] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          combat = c; created.combats.push(c.id);
          await c.createEmbeddedDocuments('Combatant', [{ tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id }]);
          const pcC = c.combatants.find(x => x.actorId === pcAttacker.id);
          const mod = Number(pcAttacker.system.attributes.init.total) || 0;
          const t0 = Date.now();
          await c.setInitiative(pcC.id, mod + 4);   // the d20 reads as a 4
          const card = await waitFor(() => since(t0, 'initiativeGrant').find(m => m.getFlag(MOD, 'initiativeGrant')?.row === 'Survivor (Ravenloft)') ?? null, 8000);
          const pop = await waitFor(() => titled(/^Survivor \(Ravenloft\) — /), 6000);
          const f = card?.getFlag(MOD, 'initiativeGrant');
          ok('16a. the PC Attacker\'s Initiative (the d20 a 4) asks "reroll the Initiative?" — the card pending, the face recorded',
            !!card && (f?.status === 'pending') && (f?.reroll?.face === 4) && !!pop, `card=${!!card} pop=${!!pop} flag=${JSON.stringify(f ?? null).slice(0, 240)}`);
          pop?.element?.querySelector('button[data-action="yes"]')?.click();
          const done = await waitFor(() => card?.getFlag(MOD, 'initiativeGrant')?.applied ? card : null, 8000);
          await sleep(300);
          const d = done?.getFlag(MOD, 'initiativeGrant');
          ok('16b. Yes: the Initiative rerolled — the record says from → to, the combatant\'s Initiative is the new roll',
            !!done && (d?.answer === 'yes') && (d?.rerolled?.from === mod + 4) && Number.isFinite(d?.rerolled?.to) && (Number(c.combatants.get(pcC.id)?.initiative) === d?.rerolled?.to),
            `record=${JSON.stringify(d ?? null).slice(0, 240)} init=${c.combatants.get(pcC.id)?.initiative}`);
        }
      } finally {
        await closeOurs();
        if (combat && game.combats.get(combat.id)) await combat.delete();
        if (surv) await unlend(pcAttacker, surv);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 17. Steel Yourself — the roller's own failed save against Frightened lifted by the Proficiency Bonus
    if (want(17)) {
      const surv = await lendUuid(pcAttacker, `${RHW}rhwSurvivor2zrM3`);
      const fear = await lendUuid(attacker, 'Compendium.dnd-players-handbook.spells.Item.phbsplFear000000', { 'system.prepared': 1, 'system.method': 'atwill' });
      keep(pcAttacker, { 'system.abilities.wis.save.roll.bonus': pcAttacker.system._source.abilities?.wis?.save?.roll?.bonus ?? '' });
      let combat = null;
      try {
        if (!surv || !fear) log.push(`§17 skipped: survivor=${!!surv} fear=${!!fear}`);
        else {
          await set('saveRolls', 'prompt');
          await dropReactionChips(pcAttacker);
          const [c] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          combat = c; created.combats.push(c.id);
          await c.createEmbeddedDocuments('Combatant', [
            { tokenId: attackerToken.document.id, sceneId: scene.id, actorId: attacker.id, initiative: 20 },
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 10 }]);
          await c.startCombat();
          await sleep(400);
          const saveAct = fear.system.activities.find(a => a.type === 'save');
          attackerToken.control({ releaseOthers: true });
          pcToken.setTarget(true, { releaseOthers: true });
          await sleep(100);
          // no cone placed (the template would wait on a hand): the save demanded of the targeted PC alone
          const use = await saveAct?.use({ consume: { spellSlot: false }, create: { measuredTemplate: false } }, { configure: false }, {});
          const card = use?.message ?? null;
          await waitFor(() => card?.getFlag(MOD, 'saves'), 6000);
          const dc = Number(card?.getFlag(MOD, 'saves')?.dc);
          const prof = Number(pcAttacker.system.attributes.prof) || 2;
          // a total one short of the DC: the d20 face that lands it, the save bonus zeroed; the Proficiency Bonus then passes it
          await pcAttacker.update({ 'system.abilities.wis.save.roll.bonus': '' });
          const mod = Number(pcAttacker.system.abilities.wis.save.value) || 0;
          const face = Math.min(19, Math.max(2, dc - 1 - mod));
          faces([[face, 20]]);
          const rolls = await pcAttacker.rollSavingThrow({ ability: 'wis' }, { configure: false }, {});
          const rolled = rolls?.[0]?.parent ?? null;
          CONFIG.Dice.randomUniform = realPRNG;
          const pop = await waitFor(() => popups().find(app => /Steel Yourself|Survivor/.test(textOf(app.element)) && app.element?.querySelector?.('button[data-action="answer"]')) ?? null, 8000);
          const bflag = rolled?.getFlag(MOD, 'bystanderRoll');
          ok('17a. the Fear save fails by 1 (the Frightened demand): the PC Attacker is asked — Steel Yourself, its own save lifted by the Proficiency Bonus',
            !!card && (dc > 0) && !!pop && !!bflag && (bflag.guards ?? []).some(g => (g.row === 'Survivor (Ravenloft)') && (g.uuid === pcAttacker.uuid)),
            `dc=${dc} face=${face} mod=${mod} total=${rolls?.[0]?.total} pop=${!!pop} guards=${JSON.stringify(bflag?.guards?.map(g => [g.row, g.name, g.die]) ?? null)} text="${textOf(pop?.element).slice(0, 160)}"`);
          const guardBox = [...(pop?.element?.querySelectorAll?.('input[name="bf-bystander-roll"]') ?? [])][0] ?? null;
          if (guardBox && !guardBox.checked) { guardBox.click(); await sleep(50); }
          pop?.element?.querySelector('button[data-action="answer"]')?.click();
          const done = await waitFor(() => (rolled?.getFlag(MOD, 'bystanderRoll')?.status === 'resolved') ? rolled.getFlag(MOD, 'bystanderRoll') : null, 12000);
          await sleep(600);
          const bent = done?.bent ?? null;
          const reaction = pcAttacker.effects.some(e => e.getFlag(MOD, 'mastery') === 'reaction');
          ok('17b. Answer: + the Proficiency Bonus on the roll — the total reaches the DC, the save passes, the Reaction spent',
            !!done && (done.answer === 'roll') && (Number(bent?.add) === prof) && (Number(bent?.total) >= dc) && reaction
              && (card?.getFlag(MOD, 'saves')?.targets?.find(x => x.uuid === pcAttacker.uuid)?.outcome === 'saved'),
            `answer=${done?.answer} bent=${JSON.stringify(bent)} reaction=${reaction} entry=${JSON.stringify(card?.getFlag(MOD, 'saves')?.targets?.find(x => x.uuid === pcAttacker.uuid) ?? null).slice(0, 160)}`);
        }
      } finally {
        await closeOurs();
        await set('saveRolls', 'auto');
        if (combat && game.combats.get(combat.id)) await combat.delete();
        await dropReactionChips(pcAttacker);
        for (const e of pcAttacker.effects.filter(e => e.statuses?.has?.('frightened'))) await e.delete().catch(() => {});
        await pcAttacker.update({ 'system.abilities.wis.save.roll.bonus': priorActor[pcAttacker.id]['system.abilities.wis.save.roll.bonus'] }).catch(() => {});
        if (fear) await unlend(attacker, fear);
        if (surv) await unlend(pcAttacker, surv);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    await refillLuck();
    await teardown();
    return { log, results, skips };
  } catch (err) {
    await teardown();
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'splat', out, plan, f });
