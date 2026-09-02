// Battle Flow expiry smoke test — THE PLATFORM'S CLOCK ON THE CHIPS (HANDOFF Stage 1,
// 2026-09-01): a real Combat stepped through rounds while Foundry v14's own registry expires
// the mastery chips on the boundaries the rules name; the spend that closes Vex and Sap on the
// swing; the once-per-turn Cleave chit; the sweep when a combat is deleted; and the out-of-
// combat truth (no clock at all — only the spend). Driven end to end in the live world.
//
// ⚠ Every boundary asserted here was MEASURED first (tools/probe-expiry.mjs) — this suite
// pins the measurement, it does not reason about what v14 "should" do.
//
// Harness discipline (HANDOFF): every setting touched is restored to whatever was found;
// every message this run creates is deleted on the way out; the combat it creates is deleted
// whatever happens (a leftover combat poisons every later suite — smoke-hold's lesson); HP is
// topped up before any attack; chips are cleared between scenarios so "the chip landed" means
// THIS attack landed it.
//
// Sections: `--section 4`, `--section 1,7`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'the clock: v14 shape, the RAW window, the attacker\'s OWN combatant',
  2: 'the spend: the attacker\'s next attack on the bearer spends Vex — record first, chip second',
  3: 'the spend: the bearer\'s next attack spends Sap',
  4: 'turnStart: Sap and Slow die when the attacker\'s next turn STARTS, and the document is tidied',
  5: 'turnEnd: Vex dies when the attacker\'s next turn ENDS — not at its start',
  6: 'the Cleave chit: once per turn, dies with the turn',
  7: 'deleteCombat sweeps every chip it clocked',
  8: 'out of combat: no clock, no expiry — the spend still closes it',
  9: 'the registrations FIRED (§11): updateActiveEffect carried the expiry, deleteCombat swept',
  10: 'the gate after a boundary: zero on the clock is ALIVE; the chit belongs to the turn in progress'
};
const DEPENDS = { 9: ['4', '7'] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'expiry', watchdogMs: 600_000 });
announcePlan('expiry', plan, pulled);

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
  const snap = () => (ledger ? { ...ledger } : {});
  const moved = (before, name) => ((ledger?.[name] ?? 0) - (before[name] ?? 0));

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  for (const key of ['masteryRiders', 'masteryAsk', 'noticeTimer']) {
    if (!game.settings.settings.has(`${MOD}.${key}`)) {
      return { fatal: `setting ${key} not registered — this client is running OLD code (F5)` };
    }
  }

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'holdTimer',
    'saveTimer', 'castApply', 'noticeTimer', 'reminderList', 'conditionList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const pc = game.actors.getName('BF Test PC Attacker');
  const npc = game.actors.getName('BF Test Attacker');
  if (!scene || !victim || !pc || !npc) return { fatal: 'missing fixture: scene or BF Test actors' };

  const created = { items: [], tokens: [] };
  const priorActor = {};
  let priorBlade = null;
  let combat = null;
  let restored = false;
  const CHIP_NAMES = ['Vexed', 'Sapped', 'Slowed', 'Reduced Movement', 'Cleave — this turn'];
  const clearChips = async () => {
    for (const a of [victim, pc, npc]) {
      const chips = a.effects.filter(e => e.getFlag(MOD, 'mastery') || CHIP_NAMES.includes(e.name));
      if (chips.length) await a.deleteEmbeddedDocuments('ActiveEffect', chips.map(e => e.id));
    }
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      // ⚠ THE COMBAT GOES FIRST — a leftover would poison every later suite.
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      try { if (game.combat) await game.combat.delete(); } catch { /* gone */ }
      if (priorBlade && pc) {
        await pc.items.get(priorBlade.id)?.update({ 'system.mastery': priorBlade.mastery });
      }
      await clearChips();
      await pc.unsetFlag(MOD, 'cleaveArm').catch(() => {});
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

  try {
    await set('autoDamage', 'all');
    await set('autoApply', true);
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('riders', false);
    await set('effectRiders', true);
    await set('masteryRiders', true);
    await set('masteryAsk', 'auto');
    await set('holdTimer', 0);
    await set('saveTimer', 0);
    await set('castApply', false);
    await set('noticeTimer', 2); // the reminder popups this suite provokes drain fast
    await set('reminderList', 'vex, sap, prone, condition'); // §10 gates a swing; every other swing is configure:false

    // -------------------------------------------------- fixtures (the smoke-effects idiom)
    const findWeapon = async () => {
      const owned = pc.items.find(i => (i.type === 'weapon') && i.system.mastery
        && i.system.type?.baseItem && i.system.activities?.some?.(a => a.type === 'attack'));
      if (owned) return owned;
      for (const pack of game.packs) {
        if (pack.documentName !== 'Item') continue;
        if (pack.metadata.id.startsWith('JB2A')) continue;
        let index;
        try { index = await pack.getIndex({ fields: ['type', 'system.mastery', 'system.type.baseItem'] }); } catch { continue; }
        for (const entry of index) {
          if ((entry.type !== 'weapon') || !entry.system?.mastery || !entry.system?.type?.baseItem) continue;
          const doc = await pack.getDocument(entry._id);
          if (doc.system.activities?.some?.(a => a.type === 'attack')) {
            const [made] = await pc.createEmbeddedDocuments('Item', [doc.toObject()]);
            created.items.push({ actorId: pc.id, id: made.id });
            return made;
          }
        }
      }
      return null;
    };
    const blade = await findWeapon();
    if (!blade) return { fatal: 'no mastery-bearing weapon found on the PC or in any pack' };
    priorBlade = { id: blade.id, mastery: blade.system._source.mastery };
    log.push(`weapon: ${blade.name} (base ${blade.system.type.baseItem}, ships ${blade.system.mastery})`);
    priorActor[pc.id] = {
      'system.traits.weaponProf.mastery.value':
        Array.from(pc.system._source.traits?.weaponProf?.mastery?.value ?? []),
      'system.abilities.str.value': pc.system._source.abilities?.str?.value ?? 10,
      'system.abilities.dex.value': pc.system._source.abilities?.dex?.value ?? 10,
      'system.attributes.hp.value': pc.system._source.attributes?.hp?.value ?? 10
    };
    await pc.update({
      'system.traits.weaponProf.mastery.value': [blade.system.type.baseItem],
      'system.abilities.str.value': 16,
      'system.abilities.dex.value': 16
    });
    const setMastery = async key => pc.items.get(blade.id).update({ 'system.mastery': key });

    if (canvas.scene?.id !== scene.id) await scene.view();
    const placeToken = async (actor, x, y) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(),
          { x, y, actorId: actor.id, actorLink: true }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const { doc: victimTokenDoc, token: victimToken } = await placeToken(victim, 1400, 1400);
    const { doc: pcTokenDoc, token: pcToken } = await placeToken(pc, 1500, 1400);

    priorActor[victim.id] = {
      'system.attributes.ac.calc': victim.system._source.attributes.ac.calc,
      'system.attributes.ac.flat': victim.system._source.attributes.ac.flat
    };
    await victim.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });
    const healFull = async () => {
      await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });
      await pc.update({ 'system.attributes.hp.value': pc.system.attributes.hp.max });
    };

    // -------------------------------------------------- helpers
    const attack = async (activity, target, { advantage = false } = {}) => {
      target.setTarget(true, { releaseOthers: true });
      await sleep(80);
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      if (results === undefined) return { failed: true, attackMsg: null, roll: null };
      const usageId = results?.message?.id ?? null;
      const rolls = await activity.rollAttack(
        { advantage, disadvantage: false },
        { configure: false },
        usageId ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
      return { usageId, attackMsg: rolls?.[0]?.parent ?? null, roll: rolls?.[0] ?? null };
    };
    const pcAttack = () => pc.items.get(blade.id).system.activities.find(a => a.type === 'attack');
    const victimAttack = () => victim.items.find(i => i.system.activities?.some?.(a => a.type === 'attack'))
      ?.system.activities.find(a => a.type === 'attack') ?? null;
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) {
        const v = test();
        if (v) return v;
        await sleep(250);
      }
      return test();
    };
    const waitDamage = async (originId, { flag = 'receipt', timeout = 10_000 } = {}) => waitFor(() =>
      game.messages.contents.find(x => (x.getFlag('dnd5e', 'roll.type') === 'damage')
        && (x.getFlag('dnd5e', 'originatingMessage') === originId)
        && (!flag || x.getFlag(MOD, flag))), timeout);
    const chipOn = (actor, key) => actor.effects.find(e => e.getFlag(MOD, 'mastery') === key);
    // ⚠ `duration` is the PREPARED clock — out of combat the platform reframes rounds as
    // seconds in it — so the window as WRITTEN rides along under `source`.
    const clockOf = e => e ? ({
      value: e.duration.value, units: e.duration.units, expiry: e.duration.expiry,
      expired: e.duration.expired, remaining: e.duration.remaining,
      source: { value: e._source.duration?.value, units: e._source.duration?.units, expiry: e._source.duration?.expiry },
      combat: e.start?.combat?.id ?? null, combatant: e.start?.combatant ?? null,
      round: e.start?.round ?? null, turn: e.start?.turn ?? null
    }) : null;
    /**
     * One mastery attack by the PC on the victim, waited to quiescence; the chip it left.
     * ⚠ The chip is WAITED FOR, not read after a fixed pause: the payout runs after the receipt
     * and the first swing of a run is the slowest (the weapon's first use). A fumble (nat 1)
     * leaves no chip by the rules; the roll rides back so an assertion can say which it was.
     */
    const swing = async (key, { advantage = false } = {}) => {
      // ⚠ RETRY A FUMBLE OR A KILL, bounded. The swing rolls one d20 (no advantage), so a nat 1 is
      // a 5% event per swing and a run has a dozen of them; and the victim's 11 max HP is
      // within one crit of the dagger, and the dead are skipped everywhere (no chip, no ask).
      // Neither is the module: the battery of 2026-09-02 lost §4 and §5's setup chips to
      // exactly this after a clean standalone run, and the sections did not say why.
      let last = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        await healFull();
        await setMastery(key);
        const before = new Set([victim, pc].flatMap(a => a.effects.map(e => e.id)));
        const { attackMsg, roll } = await attack(pcAttack(), victimToken, { advantage });
        const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
        await waitDamage(originId);
        const bearer = (key === 'cleave') ? pc : victim;
        const fresh = () => bearer.effects.find(e => (e.getFlag(MOD, 'mastery') === key) && !before.has(e.id));
        const fumble = !!roll?.isFumble;
        const chip = fumble ? null : await waitFor(fresh, 12_000);
        await sleep(300);
        last = { attackMsg, roll, chip: chip ?? null, fumble };
        // A second Cleave hit in one turn writes no NEW chit by design, so for cleave only a
        // fumble (no hit, no notice) is worth another swing.
        if (key === 'cleave') { if (!fumble) return last; }
        else if (chip) return last;
        const killed = (victim.system.attributes?.hp?.value ?? 1) <= 0;
        if (!fumble && !killed) return last;
        log.push(`swing(${key}) attempt ${attempt + 1}: ${fumble ? 'fumbled' : 'killed the victim'} — swinging again`);
      }
      return last;
    };
    const ensureCombat = async () => {
      if (combat && game.combats.get(combat.id)) return combat;
      if (game.combat) await game.combat.delete();
      combat = await Combat.create({ scene: scene.id });
      await combat.createEmbeddedDocuments('Combatant', [
        { actorId: pc.id, tokenId: pcTokenDoc.id, sceneId: scene.id, initiative: 30 },
        { actorId: victim.id, tokenId: victimTokenDoc.id, sceneId: scene.id, initiative: 20 },
        { actorId: npc.id, sceneId: scene.id, initiative: 10 }
      ]);
      await combat.startCombat();
      await sleep(500);
      log.push(`combat ${combat.id}: ${combat.turns.map(c => c.name).join(' → ')}`);
      return combat;
    };
    const pcCombatant = () => combat?.combatants.find(c => c.actorId === pc.id) ?? null;
    const current = () => combat?.combatant?.actorId ?? null;
    const where = () => `r${combat?.round}t${combat?.turn}:${combat?.combatant?.name ?? '-'}`;
    const step = async () => { await combat.nextTurn(); await sleep(600); };
    const stepTo = async actorId => {
      for (let i = 0; (i < 6) && (current() !== actorId); i++) await step();
      return current() === actorId;
    };
    const noticeCount = key => game.messages.contents.filter(m =>
      (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'masteryNotice')?.key === key)).length;
    const cardText = id => document.querySelector(`.message[data-message-id="${id}"]`)?.textContent ?? '';

    // -------------------------------------------------- the gate (§10) — the smoke-reminders idiom
    /** The click the card's Attack BUTTON makes: an event whose target sits inside the usage
     * card's element and nothing else — the shape the table uses (smoke-reminders says why). */
    const buttonEvent = async usageId => {
      const li = await waitFor(() => document.querySelector(`.message[data-message-id="${usageId}"]`), 4000);
      if (!li) throw new Error(`usage card ${usageId} never reached the chat DOM`);
      return { target: li.querySelector('button[data-action="rollAttack"]') ?? li, clientY: 200,
        altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
    };
    const findGate = () => waitFor(() => [...foundry.applications.instances.values()]
      .find(app => (app instanceof foundry.applications.api.DialogV2) && /Before you roll/.test(app.title ?? '') && app.rendered), 6000);
    /** A HUMAN-style swing — the dialog allowed, so the gate stands in when it has something to say. */
    const gatedSwing = async (activity, token) => {
      await healFull();
      token.setTarget(true, { releaseOthers: true });
      await sleep(80);
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      void activity.rollAttack({ event: await buttonEvent(usageId) }, {}, {});
      const dialog = await findGate();
      return { dialog: dialog ?? null, usageId };
    };
    const popupText = dlg => (dlg?.element?.querySelector('.window-content')?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const press = async (dlg, mode) => { const btn = dlg?.element?.querySelector(`button[data-action="${mode}"]`); btn?.click(); return !!btn; };
    const closeGates = async () => {
      for (const app of foundry.applications.instances.values()) {
        const gate = (app instanceof foundry.applications.api.DialogV2) && /Before you roll/.test(app.title ?? '');
        const system = /RollConfigurationDialog/.test(app.constructor?.name ?? '');
        if (gate || system) { try { await app.close(); } catch { /* gone */ } }
      }
    };
    const lastAttack = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag('dnd5e', 'roll.type') === 'attack')).pop() ?? null;
    const waitAttackAfter = async id => waitFor(() => { const m = lastAttack(); return (m && (m.id !== id)) ? m : null; }, 8000);
    /** Let a re-issued roll's whole chain land — damage, receipt and the payout after it. */
    const settle = async msg => {
      const originId = msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id;
      const dmg = await waitDamage(originId, { flag: 'receipt', timeout: 8000 });
      if (dmg) await waitFor(() => game.messages.get(dmg.id)?.getFlag(MOD, 'effectReceipt'), 5000);
      await sleep(600);
    };

    const fired = {}; // §9 reads these

    // ================================================== 1. the clock
    if (want(1)) {
      await ensureCombat();
      await stepTo(pc.id);
      await clearChips();
      let first = await swing('vex');
      if (first.fumble) { log.push('§1: the first swing fumbled — swinging again'); first = await swing('vex'); }
      const { chip } = first;
      const c = clockOf(chip);
      ok('1. a Vexed chip carries the RAW window in v14 shape: 1 round, judged at turnEnd',
        !!c && (c.value === 1) && (c.units === 'rounds') && (c.expiry === 'turnEnd') && (c.expired === false),
        `${JSON.stringify(c)} fumble=${first.fumble}`);
      ok('1b. its start is the ATTACKER\'s own combatant in THIS combat, this round',
        !!c && (c.combat === combat.id) && (c.combatant === pcCombatant()?.id) && (c.round === combat.round),
        `start=${JSON.stringify({ combat: c?.combat, combatant: c?.combatant, round: c?.round })} want=${pcCombatant()?.id}/r${combat.round}`);
      ok('1c. one round on the clock, temporary, not suppressed',
        !!chip && (c.remaining === 1) && chip.isTemporary && !chip.isSuppressed,
        `remaining=${c?.remaining} temporary=${chip?.isTemporary} suppressed=${chip?.isSuppressed}`);
    }

    // ================================================== 2. the spend — Vex
    if (want(2)) {
      await ensureCombat();
      await stepTo(pc.id);
      await clearChips();
      const first = await swing('vex');
      const vexId = first.chip?.id ?? null;
      ok('2. (setup) the victim is Vexed', !!vexId, `vexed=${!!vexId}`);
      // The NEXT attack — rolled FLAT, with the blade on Sap so the payout leaves a Sapped
      // chip rather than a fresh Vexed one, and the spend is unambiguous.
      const before = snap();
      const second = await swing('sap');
      const msg = game.messages.get(second.attackMsg?.id ?? '');
      const spend = await waitFor(() => game.messages.get(msg?.id ?? '')?.getFlag(MOD, 'chipSpend'));
      const rec = spend?.spent?.find(s => s.id === vexId) ?? null;
      ok('2a. the attack message records the spend: the Vexed chip, by id, key vex, rolled flat, unclaimed',
        !!rec && (rec.key === 'vex') && (rec.mode === 'normal') && (rec.honoured === false)
          && (rec.uuid === victim.uuid) && (rec.bearer === victim.name),
        JSON.stringify(spend));
      ok('2b. the record carries the data-plane stamp (combat + sourceUuid), once per flag',
        !!spend && ('combat' in spend) && (spend.sourceUuid === pc.uuid),
        `combat=${spend?.combat} sourceUuid=${spend?.sourceUuid}`);
      const gone = await waitFor(() => !victim.effects.get(vexId));
      ok('2c. the Vexed chip is gone from the victim — and the Sapped chip from THIS swing stands',
        gone && !!chipOn(victim, 'sap'), `vexGone=${gone} sapped=${!!chipOn(victim, 'sap')}`);
      const text = cardText(msg?.id);
      ok('2d. the attack card SAYS so (R5): the spend line renders on the card',
        /Vexed — spent/.test(text) && /flat/.test(text), text.slice(0, 200).replace(/\s+/g, ' '));
      fired.createChatMessage = moved(before, 'createChatMessage');
      // The honoured case: Vex again, then a swing WITH advantage.
      await clearChips();
      const again = await swing('vex');
      const vex2 = again.chip?.id ?? null;
      const third = await swing('vex', { advantage: true });
      const spend2 = await waitFor(() => game.messages.get(third.attackMsg?.id ?? '')?.getFlag(MOD, 'chipSpend'));
      const rec2 = spend2?.spent?.find(s => s.id === vex2) ?? null;
      ok('2e. a swing rolled WITH advantage spends the chip as honoured',
        !!rec2 && (rec2.mode === 'advantage') && (rec2.honoured === true),
        JSON.stringify(rec2));
      ok('2f. …and the payout of that same swing leaves a FRESH Vexed chip (a new id) on the victim',
        !!chipOn(victim, 'vex') && (chipOn(victim, 'vex').id !== vex2),
        `fresh=${chipOn(victim, 'vex')?.id} old=${vex2}`);
    }

    // ================================================== 3. the spend — Sap
    if (want(3)) {
      await ensureCombat();
      await stepTo(pc.id);
      await clearChips();
      const act = victimAttack();
      if (!act) {
        skips.push('§3 the victim has no attack activity to swing with');
      } else {
        const { chip } = await swing('sap');
        const sapId = chip?.id ?? null;
        ok('3. (setup) the victim is Sapped, judged at turnStart', !!chip && (clockOf(chip).expiry === 'turnStart'),
          JSON.stringify(clockOf(chip)));
        // The victim swings at the PC — its next attack roll, at anyone.
        await stepTo(victim.id);
        const { attackMsg } = await attack(act, pcToken);
        const spend = await waitFor(() => game.messages.get(attackMsg?.id ?? '')?.getFlag(MOD, 'chipSpend'));
        const rec = spend?.spent?.find(s => s.id === sapId) ?? null;
        ok('3a. the victim\'s attack message records the Sap spend: key sap, the victim as bearer',
          !!rec && (rec.key === 'sap') && (rec.uuid === victim.uuid), JSON.stringify(spend));
        const gone = await waitFor(() => !victim.effects.get(sapId));
        ok('3b. the Sapped chip is gone', gone, `gone=${gone}`);
        const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
        await waitDamage(originId, { flag: null, timeout: 6000 }); // let the chain settle
        await healFull();
      }
    }

    // ================================================== 4. turnStart — Sap and Slow
    if (want(4)) {
      await ensureCombat();
      await stepTo(pc.id);
      await clearChips();
      await swing('sap');
      await swing('slow');
      const sapped = chipOn(victim, 'sap');
      const slowed = chipOn(victim, 'slow');
      ok('4. (setup) Sapped and Slowed stand, both judged at the attacker\'s turnStart',
        !!sapped && !!slowed && (clockOf(sapped).expiry === 'turnStart') && (clockOf(slowed).expiry === 'turnStart'),
        `sapped=${JSON.stringify(clockOf(sapped))} slowed=${JSON.stringify(clockOf(slowed))}`);
      const startRound = combat.round;
      await step(); // the attacker's turn ENDS — nothing judged at turnStart moves
      ok(`4a. ${where()}: the attacker's turn ended — both chips still stand, not expired`,
        !!victim.effects.get(sapped?.id) && !!victim.effects.get(slowed?.id)
          && !sapped.duration.expired && !slowed.duration.expired,
        `sapped=${!!victim.effects.get(sapped?.id)} slowed=${!!victim.effects.get(slowed?.id)}`);
      await step(); // the third body's turn
      ok(`4b. ${where()}: still standing through the round`,
        !!victim.effects.get(sapped?.id) && !!victim.effects.get(slowed?.id), '');
      const before = snap();
      await step(); // the attacker's NEXT turn STARTS
      const onPc = current() === pc.id;
      const gone = await waitFor(() => !victim.effects.get(sapped?.id) && !victim.effects.get(slowed?.id));
      ok(`4c. ${where()}: the attacker's next turn started (round ${startRound} → ${combat.round}) — both chips expired AND were tidied off the sheet`,
        onPc && gone, `onPc=${onPc} gone=${gone} sapped=${JSON.stringify(clockOf(victim.effects.get(sapped?.id)))}`);
      fired.updateActiveEffect = moved(before, 'updateActiveEffect');
      fired.deleteActiveEffect = moved(before, 'deleteActiveEffect');
    }

    // ================================================== 5. turnEnd — Vex
    if (want(5)) {
      await ensureCombat();
      await stepTo(pc.id);
      await clearChips();
      const { chip } = await swing('vex');
      const id = chip?.id ?? null;
      ok('5. (setup) Vexed stands, judged at turnEnd', !!chip && (clockOf(chip).expiry === 'turnEnd'), JSON.stringify(clockOf(chip)));
      await step(); // the attacker's OWN turn ends — one round still on the clock
      ok(`5a. ${where()}: the attacker's own turn ended — Vexed stands (a round remains)`,
        !!victim.effects.get(id) && !victim.effects.get(id)?.duration.expired,
        `standing=${!!victim.effects.get(id)} clock=${JSON.stringify(clockOf(victim.effects.get(id)))}`);
      await step(); // the third body
      await step(); // the attacker's next turn STARTS — zero on the clock, but the event is turnEnd
      await sleep(800);
      ok(`5b. ${where()}: the attacker's next turn STARTED — Vexed still stands (the window is its END)`,
        (current() === pc.id) && !!victim.effects.get(id) && !victim.effects.get(id)?.duration.expired,
        `onPc=${current() === pc.id} standing=${!!victim.effects.get(id)} clock=${JSON.stringify(clockOf(victim.effects.get(id)))}`);
      await step(); // …and ENDS
      const gone = await waitFor(() => !victim.effects.get(id));
      ok(`5c. ${where()}: the attacker's next turn ended — Vexed expired and was tidied`, gone, `gone=${gone}`);
    }

    // ================================================== 6. the Cleave chit
    if (want(6)) {
      await ensureCombat();
      await stepTo(pc.id);
      await clearChips();
      const n0 = noticeCount('cleave');
      const { chip } = await swing('cleave');
      const c = clockOf(chip);
      ok('6. the first Cleave hit this turn writes the chit on the ATTACKER: 0 turns, judged at turnEnd, the attacker\'s combatant',
        !!c && (c.value === 0) && (c.units === 'turns') && (c.expiry === 'turnEnd') && (c.combatant === pcCombatant()?.id),
        JSON.stringify(c));
      const n1 = await waitFor(() => (noticeCount('cleave') > n0) ? noticeCount('cleave') : 0);
      ok('6a. …and the reminder card posts', n1 === n0 + 1, `notices ${n0} → ${n1}`);
      await swing('cleave');
      await sleep(1200);
      ok('6b. a second Cleave hit THIS TURN: no second reminder, still one chit',
        (noticeCount('cleave') === n1) && (pc.effects.filter(e => e.getFlag(MOD, 'mastery') === 'cleave').length === 1),
        `notices=${noticeCount('cleave')} chits=${pc.effects.filter(e => e.getFlag(MOD, 'mastery') === 'cleave').length}`);
      await step(); // the attacker's turn ends
      const gone = await waitFor(() => !chipOn(pc, 'cleave'));
      ok(`6c. ${where()}: the turn ended — the chit expired and was tidied`, gone, `gone=${gone}`);
      await stepTo(pc.id);
      const n2 = noticeCount('cleave');
      await swing('cleave');
      const n3 = await waitFor(() => (noticeCount('cleave') > n2) ? noticeCount('cleave') : 0);
      ok('6d. a new turn: the reminder is offered again, a new chit stands',
        (n3 === n2 + 1) && !!chipOn(pc, 'cleave'), `notices ${n2} → ${n3} chit=${!!chipOn(pc, 'cleave')}`);
    }

    // ================================================== 7. deleteCombat sweeps
    if (want(7)) {
      await ensureCombat();
      await stepTo(pc.id);
      await clearChips();
      // The chit first: a Vex swing does not spend a chit, but a Cleave swing after a Vex
      // swing is the attacker's next attack on the bearer — and SPENDS the Vex (§2).
      await swing('cleave');
      await swing('vex');
      const vexed = !!chipOn(victim, 'vex');
      const chit = !!chipOn(pc, 'cleave');
      ok('7. (setup) a Vexed chip and a Cleave chit stand', vexed && chit, `vexed=${vexed} chit=${chit}`);
      const before = snap();
      await combat.delete();
      combat = null;
      const gone = await waitFor(() => !chipOn(victim, 'vex') && !chipOn(pc, 'cleave'));
      ok('7a. the combat is deleted — every chip it clocked is swept off every combatant', gone,
        `vexed=${!!chipOn(victim, 'vex')} chit=${!!chipOn(pc, 'cleave')}`);
      fired.deleteCombat = moved(before, 'deleteCombat');
    }

    // ================================================== 8. out of combat
    if (want(8)) {
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      combat = null;
      try { if (game.combat) await game.combat.delete(); } catch { /* gone */ }
      await clearChips();
      const { chip } = await swing('vex');
      const c = clockOf(chip);
      // The window as WRITTEN is the same; the platform PRESENTS it reframed as six seconds,
      // because with no combatant a round has no meaning (measured — tools/probe-expiry.mjs).
      ok('8. out of combat a Vexed chip is WRITTEN with the same window (1 round, turnEnd), no combat in its start, and read back as six seconds',
        !!c && (c.source.value === 1) && (c.source.units === 'rounds') && (c.source.expiry === 'turnEnd')
          && (c.combat === null) && (c.expired === false) && (c.units === 'seconds') && (c.value === 6),
        JSON.stringify(c));
      await sleep(2500);
      ok('8a. nothing ticks out of combat: seconds later it still stands, unexpired',
        !!victim.effects.get(chip?.id) && !victim.effects.get(chip?.id)?.duration.expired,
        JSON.stringify(clockOf(victim.effects.get(chip?.id))));
      const second = await swing('sap');
      const spend = await waitFor(() => game.messages.get(second.attackMsg?.id ?? '')?.getFlag(MOD, 'chipSpend'));
      const gone = await waitFor(() => !victim.effects.get(chip?.id));
      ok('8b. the spend still closes it: the next attack records it and the chip goes',
        !!spend?.spent?.some(s => s.id === chip?.id) && gone && (spend?.combat === null),
        `recorded=${!!spend?.spent?.some(s => s.id === chip?.id)} gone=${gone} combat=${spend?.combat}`);
    }

    // ================================================== 9. the registrations FIRED
    if (want(9)) {
      ok('9. updateActiveEffect carried the platform\'s expiry write (the tidy hook\'s trigger) in §4',
        (fired.updateActiveEffect ?? 0) > 0, `updateActiveEffect moved by ${fired.updateActiveEffect ?? 'n/a'}`);
      ok('9a. deleteActiveEffect followed — the tidy deleted what the platform marked',
        (fired.deleteActiveEffect ?? 0) > 0, `deleteActiveEffect moved by ${fired.deleteActiveEffect ?? 'n/a'}`);
      ok('9b. deleteCombat fired around §7\'s sweep', (fired.deleteCombat ?? 0) > 0,
        `deleteCombat moved by ${fired.deleteCombat ?? 'n/a'}`);
      ok('9c. createChatMessage fired around §2\'s spend', (fired.createChatMessage ?? 0) > 0,
        `createChatMessage moved by ${fired.createChatMessage ?? 'n/a'}`);
    }

    // ================================================== 10. the gate after a boundary
    // ⚠ THE REVIEW'S FIRST FINDING (2026-09-01): a one-round chip reads `remaining: 0` from the
    // START of the round its boundary falls in, and `expired` only at the event — so on the
    // attacker's next turn, the one attack Vex exists for, the gate dropped it and the dice
    // went out flat. Neither suite stepped a turn between the chip and a gated swing; this one
    // does. And the once-per-turn chit belongs to the turn IN PROGRESS: written on somebody
    // else's turn (an opportunity attack), it dies with THAT turn.
    if (want(10)) {
      await ensureCombat();
      await stepTo(pc.id);
      await clearChips();
      // (a) Vex on the attacker's turn; three steps later it is the attacker's turn again.
      let first = await swing('vex');
      if (first.fumble) { log.push('§10: the first swing fumbled — swinging again'); first = await swing('vex'); }
      const vexId = first.chip?.id ?? null;
      ok('10. (setup) Vexed on the attacker\'s turn', !!vexId, `vexed=${!!vexId} fumble=${first.fumble}`);
      await step(); await step(); await step();
      const chip = victim.effects.get(vexId);
      ok(`10a. ${where()}: the attacker's NEXT turn — the chip reads remaining 0, is NOT expired, and stands`,
        (current() === pc.id) && !!chip && (chip.duration.remaining === 0) && !chip.duration.expired,
        `onPc=${current() === pc.id} ${JSON.stringify(clockOf(chip))}`);
      const before = lastAttack()?.id ?? null;
      const { dialog, usageId } = await gatedSwing(pcAttack(), victimToken);
      const text = popupText(dialog);
      ok('10b. …and the gate LISTS it — Vexed, net Advantage (zero on the clock is alive)',
        !!dialog && /Vexed/.test(text) && /Net: Advantage/.test(text), text.slice(0, 300));
      await press(dialog, 'advantage');
      const msg = await waitAttackAfter(before);
      const spend = await waitFor(() => game.messages.get(msg?.id ?? '')?.getFlag(MOD, 'chipSpend'));
      const vexGone = await waitFor(() => !victim.effects.get(vexId));
      ok('10c. pressed Advantage: the spend is honoured and the chip is gone; the re-issue is linked to its card',
        !!spend?.spent?.some(s => (s.id === vexId) && (s.honoured === true)) && vexGone
          && (msg?.getFlag('dnd5e', 'originatingMessage') === usageId),
        `${JSON.stringify(spend?.spent)} gone=${vexGone} linked=${msg?.getFlag('dnd5e', 'originatingMessage') === usageId}`);
      await settle(msg);

      // (b) Sap on a bearer whose turn comes BEFORE the attacker's next: the victim to the top.
      const act = victimAttack();
      const vc = combat.combatants.find(c => c.actorId === victim.id);
      if (!act || !vc) {
        skips.push('§10d–f the victim has no attack activity or combatant');
      } else {
        await clearChips();
        await vc.update({ initiative: 40 }); // order: victim, pc, npc
        await sleep(300);
        await stepTo(pc.id);
        let sap = await swing('sap');
        if (sap.fumble) sap = await swing('sap');
        const sapId = sap.chip?.id ?? null;
        await stepTo(victim.id); // the victim's next turn — before the attacker's turnStart
        const chip2 = victim.effects.get(sapId);
        ok(`10d. ${where()}: the Sapped bearer acts BEFORE the attacker's next turn — remaining 0, not expired, stands`,
          !!chip2 && (current() === victim.id) && (chip2.duration.remaining === 0) && !chip2.duration.expired,
          `onVictim=${current() === victim.id} ${JSON.stringify(clockOf(chip2))}`);
        const before2 = lastAttack()?.id ?? null;
        const { dialog: d2 } = await gatedSwing(act, pcToken);
        const t2 = popupText(d2);
        ok('10e. …and the gate lists Sapped — net Disadvantage', !!d2 && /Sapped/.test(t2) && /Net: Disadvantage/.test(t2), t2.slice(0, 300));
        await press(d2, 'disadvantage');
        const m2 = await waitAttackAfter(before2);
        const spend2 = await waitFor(() => game.messages.get(m2?.id ?? '')?.getFlag(MOD, 'chipSpend'));
        ok('10f. pressed Disadvantage: the Sap spend is honoured against the net',
          !!spend2?.spent?.some(s => (s.id === sapId) && (s.honoured === true)), JSON.stringify(spend2?.spent));
        const originId2 = m2?.getFlag('dnd5e', 'originatingMessage') ?? m2?.id;
        await waitDamage(originId2, { flag: null, timeout: 6000 });
        await vc.update({ initiative: 20 }); // the fixture order back
        await sleep(300);
        await healFull();
      }

      // (c) An opportunity attack's chit dies with the turn it was written in.
      await clearChips();
      await stepTo(victim.id);
      const n0 = noticeCount('cleave');
      const { chip: chit } = await swing('cleave');
      const cc = clockOf(chit);
      ok(`10g. ${where()}: a Cleave on the VICTIM's turn writes the chit against the CURRENT turn — its combatant, its round and turn`,
        !!cc && (cc.combatant === combat.combatant?.id) && (cc.round === combat.round) && (cc.turn === combat.turn),
        `${JSON.stringify(cc)} want=${combat.combatant?.id}/r${combat.round}t${combat.turn}`);
      ok('10g2. …and the reminder posted', (await waitFor(() => (noticeCount('cleave') > n0) ? noticeCount('cleave') : 0)) === n0 + 1, '');
      await step(); // the victim's turn ends — not the attacker's
      const chitGone = await waitFor(() => !chipOn(pc, 'cleave'));
      ok(`10h. ${where()}: the victim's turn ended — the chit expired and was tidied`, chitGone, `gone=${chitGone}`);
      await stepTo(pc.id);
      const n1 = noticeCount('cleave');
      await swing('cleave');
      const n2 = await waitFor(() => (noticeCount('cleave') > n1) ? noticeCount('cleave') : 0);
      ok('10i. …and on the attacker\'s own turn Cleave is reminded again', n2 === n1 + 1, `notices ${n1} → ${n2}`);
      await closeGates();
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
    for (const a of [victim, pc, npc].filter(Boolean)) {
      try { await a.longRest?.({ dialog: false, chat: false }); } catch { /* fine */ }
    }
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'expiry', out, plan, f });
