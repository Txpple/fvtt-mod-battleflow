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
  'initiative-grants.js'    // §5 — Ever-Ready Shot: one Arcane Shot use back at Initiative, asked
];

const SECTIONS = {
  1: 'THE SURVIVOR COLLISION: BF Test Halfling lent Ravenloft\'s Survivor (a feat, not the Fighter\'s class feature) — a Bloodied turn start heals nothing (no Heroic Rally card), and a Death Saving Throw of 18 is no critical success',
  2: 'ARCANE SHOT: BF Test PC Attacker lent Arcane Shot (2 uses), Beguiling Shot and Bursting Shot; a Longbow hit opens the group "Arcane Shot"; Beguiling Shot ticked — the Wisdom save demanded at the Victim with its dice, a use spent; the next hit this turn greys the group; a Longsword hit shows no group',
  3: 'HARVEST UNDEAD — THE BLOODIED MOMENT: the Halfling at 400 of 400 takes a hit — no rebuke; at 201 of 400 the hit makes it Bloodied — the rebuke card offers Harvest Undead',
  4: 'INSTINCTIVE CHARM: the Attacker\'s hit on the Halfling (5 ft) offers the rebuke; Use demands the Wisdom save of the Attacker',
  5: 'EVER-READY SHOT: Arcane Shot at 1 of 3, Ever-Ready Shot lent; the PC Attacker\'s Initiative asks "use it now?"; Yes brings ONE use back (2 of 3)'
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
    keep(attacker, { 'system.abilities.wis.save.roll.bonus': attacker.system._source.abilities?.wis?.save?.roll?.bonus ?? '' });
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
