// Battle Flow reminder-gate smoke test — THE GATE BEFORE THE ROLL (HANDOFF Stage 2 + 3,
// 2026-09-01): when something the module can read bends an attack roll, Battle Flow's popup
// stands in for the system's roll dialog with every source, the net, and the three modes; a
// human presses; the roll is re-issued with the press. Driven end to end in the live world,
// popup buttons included.
//
// Harness discipline (HANDOFF): every setting touched is restored; every message this run
// creates is deleted; statuses this run presses are cleared; chips are cleared between
// scenarios; the tokens it places are removed. No combat is created here (smoke-expiry owns
// the clock) — the gate is about the roll, not the round.
//
// Sections: `--section 3`, `--section 1,7`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'Vex: the gate stands in for the dialog, the press re-issues the roll, the card says so',
  2: 'programmatic rolls (configure: false) are never gated — and still spend the chip',
  3: 'multiple sources: Sapped attacker vs Vexed target lists both and nets to NORMAL',
  4: 'Prone, both roles, with the 5-foot geometry',
  5: 'the condition table: poisoned, blinded, incapacitated, frightened',
  6: 'the lists are the switch: an empty Reminder Sources list turns the gate off',
  7: 'closing the popup rolls nothing',
  8: 'the registration FIRED (§11): dnd5e.preRollAttackV2 moved'
};
const DEPENDS = { 8: ['1'] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'reminders', watchdogMs: 600_000 });
announcePlan('reminders', plan, pulled);

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

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  for (const key of ['reminderList', 'conditionList', 'masteryRiders']) {
    if (!game.settings.settings.has(`${MOD}.${key}`)) {
      return { fatal: `setting ${key} not registered — this client is running OLD code (F5)` };
    }
  }

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'dramaticBeat', 'requireTarget', 'reactionHold',
    'riders', 'effectRiders', 'masteryRiders', 'masteryAsk', 'holdTimer', 'saveTimer', 'castApply',
    'noticeTimer', 'reminderList', 'conditionList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const pc = game.actors.getName('BF Test PC Attacker');
  if (!scene || !victim || !pc) return { fatal: 'missing fixture: scene or BF Test actors' };

  const created = { items: [], tokens: [] };
  const priorActor = {};
  let priorBlade = null;
  let restored = false;
  const CHIP_NAMES = ['Vexed', 'Sapped', 'Slowed', 'Reduced Movement', 'Cleave — this turn'];
  const STATUSES = ['prone', 'poisoned', 'blinded', 'incapacitated', 'frightened', 'restrained'];
  const clearChips = async () => {
    for (const a of [victim, pc]) {
      const chips = a.effects.filter(e => e.getFlag(MOD, 'mastery') || CHIP_NAMES.includes(e.name));
      if (chips.length) await a.deleteEmbeddedDocuments('ActiveEffect', chips.map(e => e.id));
    }
  };
  const clearStatuses = async () => {
    for (const a of [victim, pc]) {
      const carriers = a.effects.filter(e => STATUSES.some(s => e.statuses?.has?.(s)));
      if (carriers.length) await a.deleteEmbeddedDocuments('ActiveEffect', carriers.map(e => e.id));
    }
  };
  const closeGates = async () => {
    for (const app of foundry.applications.instances.values()) {
      const gate = (app instanceof foundry.applications.api.DialogV2) && /Before you roll/.test(app.title ?? '');
      const system = /RollConfigurationDialog/.test(app.constructor?.name ?? '');
      if (gate || system) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const systemDialogOpen = () => [...foundry.applications.instances.values()]
    .some(app => /AttackRollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered);
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeGates();
      if (priorBlade && pc) await pc.items.get(priorBlade.id)?.update({ 'system.mastery': priorBlade.mastery });
      await clearChips();
      await clearStatuses();
      for (const [actorId, ids] of Object.entries(created.items.reduce((m, i) => {
        (m[i.actorId] ??= []).push(i.id); return m;
      }, {}))) {
        const a = game.actors.get(actorId);
        const live = ids.filter(id => a?.items.get(id));
        if (live.length) await a.deleteEmbeddedDocuments('Item', live);
      }
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
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
    await set('noticeTimer', 2);
    await set('reminderList', 'vex, sap, prone, condition');
    await set('conditionList', 'blinded, invisible, paralyzed, petrified, poisoned, restrained, stunned, unconscious, frightened, grappled, incapacitated, dodging, charmed');

    // -------------------------------------------------- fixtures (the smoke-expiry idiom)
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
      'system.abilities.str.value': 16, 'system.abilities.dex.value': 16
    });
    const setMastery = async key => pc.items.get(blade.id).update({ 'system.mastery': key });

    if (canvas.scene?.id !== scene.id) await scene.view();
    // ⚠ Sweep LINKED strays of the two actors first: a crashed run's token left adjacent to
    // the victim is what the gate measures the prone distance from, and it read "within 5
    // feet" while this run's token stood 30 feet away. The fixture's own UNLINKED tokens stay.
    {
      const strays = scene.tokens.filter(t => t.actorLink && [pc.id, victim.id].includes(t.actorId)).map(t => t.id);
      if (strays.length) { await scene.deleteEmbeddedDocuments('Token', strays); log.push(`swept ${strays.length} linked stray token(s)`); }
    }
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
    // Adjacent: one grid square apart (the range's grid is 5 feet a square).
    const { doc: victimTokenDoc, token: victimToken } = await placeToken(victim, 1400, 1400);
    const { doc: pcTokenDoc, token: pcToken } = await placeToken(pc, 1500, 1400);
    // The roller's own token: controlled, so the gate measures from THIS one whatever else stands.
    pcToken.control({ releaseOthers: true });
    const gridFeet = scene.grid.distance;
    const squarePx = scene.grid.size;
    log.push(`grid: ${gridFeet} ${scene.grid.units} per ${squarePx}px square`);

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
    const pcAttack = () => pc.items.get(blade.id).system.activities.find(a => a.type === 'attack');
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
    const target = token => { token.setTarget(true, { releaseOthers: true }); };
    /** A programmatic swing (no dialog): use + rollAttack with configure:false — never gated. */
    const swing = async (key, { advantage = false } = {}) => {
      await healFull();
      await setMastery(key);
      target(victimToken);
      await sleep(80);
      const before = new Set([victim, pc].flatMap(a => a.effects.map(e => e.id)));
      const results = await pcAttack().use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const rolls = await pcAttack().rollAttack({ advantage, disadvantage: false }, { configure: false },
        usageId ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
      const attackMsg = rolls?.[0]?.parent ?? null;
      const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
      await waitDamage(originId);
      const bearer = (key === 'cleave') ? pc : victim;
      const chip = rolls?.[0]?.isFumble ? null
        : await waitFor(() => bearer.effects.find(e => (e.getFlag(MOD, 'mastery') === key) && !before.has(e.id)), 12_000);
      await sleep(300);
      return { attackMsg, roll: rolls?.[0] ?? null, chip: chip ?? null, fumble: !!rolls?.[0]?.isFumble };
    };
    const ensureVexed = async () => {
      let r = await swing('vex');
      if (!r.chip) r = await swing('vex');
      return r.chip;
    };
    /** The HUMAN-style roll: the dialog is allowed, so the gate stands in. Returns the popup. */
    const gatedSwing = async () => {
      await healFull();
      target(victimToken);
      await sleep(80);
      const results = await pcAttack().use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const before = game.messages.size;
      void pcAttack().rollAttack({}, {}, usageId ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
      const dlg = await waitFor(() => [...foundry.applications.instances.values()]
        .find(app => (app instanceof foundry.applications.api.DialogV2) && /Before you roll/.test(app.title ?? '') && app.rendered), 6000);
      return { dialog: dlg ?? null, usageId, messagesBefore: before };
    };
    const popupText = dlg => (dlg?.element?.querySelector('.window-content')?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const press = async (dlg, mode) => {
      const btn = dlg?.element?.querySelector(`button[data-action="${mode}"]`);
      btn?.click();
      return !!btn;
    };
    const lastAttack = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag('dnd5e', 'roll.type') === 'attack')).pop() ?? null;
    const waitAttackAfter = async id => waitFor(() => { const m = lastAttack(); return (m && (m.id !== id)) ? m : null; }, 8000);
    /** Let a re-issued roll's whole chain land — damage, receipt AND the mastery payout that
     * follows the receipt — before the next section clears chips; a payout landing after a
     * clear is a stale chip in the next section's popup (seen on the first run). */
    const settle = async msg => {
      const originId = msg?.getFlag('dnd5e', 'originatingMessage') ?? msg?.id;
      const dmg = await waitDamage(originId, { flag: 'receipt', timeout: 8000 });
      if (dmg) await waitFor(() => game.messages.get(dmg.id)?.getFlag(MOD, 'effectReceipt'), 5000);
      await sleep(600);
    };
    const gone = async (actor, id) => waitFor(() => !actor.effects.get(id), 6000);
    const setStatus = async (actor, id, on) => {
      const carriers = actor.effects.filter(e => e.statuses?.has?.(id));
      if (on && !carriers.length) {
        const eff = await ActiveEffect.implementation.fromStatusEffect(id);
        await ActiveEffect.implementation.create(eff.toObject(), { parent: actor, keepId: true });
      } else if (!on && carriers.length) {
        await actor.deleteEmbeddedDocuments('ActiveEffect', carriers.map(e => e.id));
      }
      await sleep(150);
    };
    const cardText = id => (document.querySelector(`.message[data-message-id="${id}"]`)?.textContent ?? '').replace(/\s+/g, ' ');

    // ================================================== 1. Vex: the gate stands in
    if (want(1)) {
      await clearChips();
      const vexed = await ensureVexed();
      ok('1. (setup) the victim is Vexed by the PC', !!vexed, `vexed=${!!vexed}`);
      const before = lastAttack()?.id ?? null;
      const { dialog } = await gatedSwing();
      ok('1a. a human-style roll opens the gate instead of the system dialog',
        !!dialog, `dialog=${!!dialog} title=${dialog?.title ?? '-'}`);
      const text = popupText(dialog);
      ok('1b. the popup names the source, the bend and the net',
        /Vexed/.test(text) && /Advantage/.test(text) && /Net: Advantage/.test(text) && /Situational Bonus/.test(text),
        text.slice(0, 300));
      const pressed = await press(dialog, 'advantage');
      const msg = await waitAttackAfter(before);
      const roll = msg?.rolls?.[0];
      ok('1c. pressing Advantage re-issues the roll WITH advantage — the dice went out that way',
        pressed && !!roll && (roll.options?.advantageMode === 1) && /2d20kh|2d20adv/i.test(roll.formula ?? ''),
        `pressed=${pressed} mode=${roll?.options?.advantageMode} formula=${roll?.formula}`);
      const rem = msg?.getFlag(MOD, 'reminder');
      ok('1d. the attack message carries the reminder record: the source, net advantage, mode advantage, honoured, stamped',
        !!rem && (rem.sources?.[0]?.kind === 'vex') && (rem.net === 'advantage') && (rem.mode === 'advantage')
          && (rem.honoured === true) && ('combat' in rem) && (rem.sourceUuid === pc.uuid),
        JSON.stringify(rem));
      const spend = await waitFor(() => game.messages.get(msg?.id ?? '')?.getFlag(MOD, 'chipSpend'));
      const vexGone = await gone(victim, vexed?.id);
      ok('1e. …and the spend: the Vexed chip spent by this roll, honoured against the net',
        !!spend?.spent?.some(s => (s.id === vexed?.id) && (s.honoured === true)) && vexGone,
        `${JSON.stringify(spend?.spent)} gone=${vexGone}`);
      await waitFor(() => /Reminded/.test(cardText(msg?.id)), 4000);
      ok('1f. the card SAYS it was reminded (R5): net Advantage, rolled Advantage',
        /Reminded — net Advantage, rolled Advantage/.test(cardText(msg?.id)), cardText(msg?.id).slice(0, 240));
      await settle(msg);
    }

    // ================================================== 2. programmatic rolls never gate
    if (want(2)) {
      await clearChips();
      const vexed = await ensureVexed();
      const second = await swing('sap');
      ok('2. a configure:false roll at a Vexed target is NOT gated — it rolled, no popup',
        !!second.roll && !second.fumble !== undefined
          && ![...foundry.applications.instances.values()].some(app => /Before you roll/.test(app.title ?? '')),
        `rolled=${!!second.roll}`);
      const spend = await waitFor(() => game.messages.get(second.attackMsg?.id ?? '')?.getFlag(MOD, 'chipSpend'));
      ok('2a. …and the chip is still spent, honoured by its own bend (no net was shown)',
        !!spend?.spent?.some(s => (s.id === vexed?.id) && (s.honoured === false)) && !second.attackMsg?.getFlag(MOD, 'reminder'),
        JSON.stringify(spend?.spent));
    }

    // ================================================== 3. multiple sources net to NORMAL
    if (want(3)) {
      await clearChips();
      const vexed = await ensureVexed();
      // A Sapped chip on the PC — as the victim's Sap would have written it.
      const [sapped] = await ActiveEffect.implementation.create({
        name: 'Sapped', img: 'icons/svg/downgrade.svg', origin: victim.uuid,
        duration: { value: 1, units: 'rounds', expiry: 'turnStart' }, transfer: false,
        flags: { [MOD]: { mastery: 'sap' } }
      }, { parent: pc }).then(e => [e]);
      await sleep(200);
      const before = lastAttack()?.id ?? null;
      const { dialog } = await gatedSwing();
      const text = popupText(dialog);
      ok('3. Sapped attacker vs Vexed target: the popup lists BOTH sources',
        /Sapped/.test(text) && /Vexed/.test(text), text.slice(0, 400));
      ok('3a. …and nets to a NORMAL roll, quoting the glossary',
        /Net: Normal roll/.test(text) && /cancel/.test(text) && /can’t be affected by more than one Advantage/.test(text),
        text.slice(0, 400));
      await press(dialog, 'normal');
      const msg = await waitAttackAfter(before);
      const rem = msg?.getFlag(MOD, 'reminder');
      ok('3b. pressing Normal: the roll went out flat, the record says net normal / mode normal / honoured',
        (msg?.rolls?.[0]?.options?.advantageMode === 0) && (rem?.net === 'normal') && (rem?.mode === 'normal') && (rem?.honoured === true)
          && (rem?.sources?.length === 2),
        JSON.stringify({ mode: msg?.rolls?.[0]?.options?.advantageMode, rem }));
      const spend = await waitFor(() => game.messages.get(msg?.id ?? '')?.getFlag(MOD, 'chipSpend'));
      const sapRec = spend?.spent?.find(s => s.id === sapped.id);
      const vexRec = spend?.spent?.find(s => s.id === vexed?.id);
      const bothGone = (await gone(pc, sapped.id)) && (await gone(victim, vexed?.id));
      ok('3c. BOTH chips are spent by this one roll, and both are honoured against the NET (normal)',
        !!sapRec && !!vexRec && (sapRec.honoured === true) && (vexRec.honoured === true) && bothGone,
        `${JSON.stringify(spend?.spent)} gone=${bothGone}`);
      await settle(msg);
    }

    // ================================================== 4. Prone, both roles, geometry
    if (want(4)) {
      await sleep(1500); // any payout from the section before lands before the clear
      await clearChips();
      await clearStatuses();
      await setStatus(victim, 'prone', true);
      {
        const { dialog } = await gatedSwing();
        const text = popupText(dialog);
        ok('4. a prone target within 5 feet: Advantage, and the popup says the distance',
          /is Prone — within 5 feet/.test(text) && /Net: Advantage/.test(text), text.slice(0, 300));
        await closeGates();
      }
      // ⚠ A second, FAR token of the same (prone) victim, six squares from the attacker — moving
      // a token is a v13+ movement with its own pipeline (a plain x/y update was refused on the
      // first run, teleport option and all), and the geometry under test is the gate's, not the
      // platform's. Targeting the far token is the same question asked honestly.
      const { doc: farDoc, token: farToken } = await placeToken(victim, 1500 - (squarePx * 6), 1400);
      {
        await healFull();
        target(farToken);
        await sleep(80);
        const results = await pcAttack().use({ subsequentActions: false }, { configure: false }, {});
        const usageId = results?.message?.id ?? null;
        void pcAttack().rollAttack({}, {}, usageId ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
        const dialog = await waitFor(() => [...foundry.applications.instances.values()]
          .find(app => (app instanceof foundry.applications.api.DialogV2) && /Before you roll/.test(app.title ?? '') && app.rendered), 6000);
        const text = popupText(dialog);
        ok(`4a. the same prone target from ${gridFeet * 6} feet: Disadvantage`,
          new RegExp(`is Prone — ${gridFeet * 6} feet away`).test(text) && /Net: Disadvantage/.test(text), text.slice(0, 300));
        await closeGates();
      }
      await scene.deleteEmbeddedDocuments('Token', [farDoc.id]);
      created.tokens.splice(created.tokens.indexOf(farDoc.id), 1);
      await sleep(300);
      await setStatus(victim, 'prone', false);
      await setStatus(pc, 'prone', true);
      {
        const { dialog } = await gatedSwing();
        const text = popupText(dialog);
        ok('4b. a prone ATTACKER: Disadvantage', /BF Test PC Attacker — Prone/.test(text) && /Net: Disadvantage/.test(text), text.slice(0, 300));
        await closeGates();
      }
      await setStatus(victim, 'prone', true);
      {
        const { dialog } = await gatedSwing();
        const text = popupText(dialog);
        ok('4c. both prone, adjacent: Advantage and Disadvantage cancel — NORMAL',
          /Net: Normal roll/.test(text) && /cancel/.test(text), text.slice(0, 300));
        await closeGates();
      }
      await clearStatuses();
    }

    // ================================================== 5. the condition table
    if (want(5)) {
      await sleep(1000);
      await clearChips();
      await clearStatuses();
      await setStatus(pc, 'poisoned', true);
      {
        const { dialog } = await gatedSwing();
        const text = popupText(dialog);
        ok('5. a poisoned attacker: Disadvantage, with the glossary clause',
          /Poisoned/.test(text) && /Net: Disadvantage/.test(text) && /Disadvantage on attack rolls and ability checks/.test(text),
          text.slice(0, 300));
        await closeGates();
      }
      await setStatus(pc, 'poisoned', false);
      await setStatus(victim, 'blinded', true);
      {
        const { dialog } = await gatedSwing();
        const text = popupText(dialog);
        ok('5a. a blinded target: Advantage', /is Blinded/.test(text) && /Net: Advantage/.test(text), text.slice(0, 300));
        await closeGates();
      }
      await setStatus(victim, 'blinded', false);
      await setStatus(pc, 'incapacitated', true);
      {
        const { dialog } = await gatedSwing();
        const text = popupText(dialog);
        ok('5b. an incapacitated attacker is LISTED, not counted: the roll should not be happening, net normal',
          /Incapacitated/.test(text) && /should not be happening/.test(text) && /Nothing counted/.test(text), text.slice(0, 300));
        await closeGates();
      }
      await setStatus(pc, 'incapacitated', false);
      await setStatus(pc, 'frightened', true);
      {
        const { dialog } = await gatedSwing();
        const text = popupText(dialog);
        ok('5c. a frightened attacker: Disadvantage, counted, with the caveat spelled out',
          /Frightened/.test(text) && /press Normal if the source of the fear is out of sight/.test(text) && /Net: Disadvantage/.test(text),
          text.slice(0, 300));
        await closeGates();
      }
      await clearStatuses();
    }

    // ================================================== 6. the lists are the switch
    if (want(6)) {
      await clearChips();
      await clearStatuses();
      await setStatus(pc, 'poisoned', true);
      await set('reminderList', '');
      {
        const { dialog } = await gatedSwing();
        const system = await waitFor(systemDialogOpen, 4000);
        ok('6. an empty Reminder Sources list: no gate — the SYSTEM\'s own roll dialog opens, as it always did',
          !dialog && !!system, `gate=${!!dialog} systemDialog=${!!system}`);
        await closeGates();
      }
      await set('reminderList', 'vex, sap, prone, condition');
      await set('conditionList', 'blinded');
      {
        const { dialog } = await gatedSwing();
        const system = await waitFor(systemDialogOpen, 4000);
        ok('6a. poisoned dropped from the Condition Sources list: nothing to read, no gate — the system dialog opens',
          !dialog && !!system, `gate=${!!dialog} systemDialog=${!!system}`);
        await closeGates();
      }
      await set('conditionList', prior.conditionList);
      await set('reminderList', prior.reminderList);
      await clearStatuses();
    }

    // ================================================== 7. closing the popup rolls nothing
    if (want(7)) {
      await clearChips();
      const vexed = await ensureVexed();
      const before = lastAttack()?.id ?? null;
      const { dialog } = await gatedSwing();
      ok('7. (setup) the gate is up', !!dialog && !!vexed, `dialog=${!!dialog}`);
      await dialog?.close();
      await sleep(2500);
      ok('7a. closed with the X: no attack roll was made, the Vexed chip still stands',
        (lastAttack()?.id ?? null) === before && !!victim.effects.get(vexed?.id),
        `newAttack=${(lastAttack()?.id ?? null) !== before} vexed=${!!victim.effects.get(vexed?.id)}`);
    }

    // ================================================== 8. the registration FIRED
    if (want(8)) {
      ok('8. dnd5e.preRollAttackV2 fired during this suite (the gate\'s only system hook)',
        count('dnd5e.preRollAttackV2') > 0, `count=${count('dnd5e.preRollAttackV2')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
    for (const a of [victim, pc].filter(Boolean)) {
      try { await a.longRest?.({ dialog: false, chat: false }); } catch { /* fine */ }
    }
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'reminders', out, plan, f });
