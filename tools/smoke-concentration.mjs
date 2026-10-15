// By the Books smoke test: the concentration assist end to end (damage → ask → roll → verdict →
// break) in both modes, on the elect's own client.
// Harness discipline: settings restored, this run's messages deleted, fixtures long-rested;
// outcomes forced (+30 save bonus, or a DC 30 ask).
// ⚠ New messages are found by ID-SET difference, never timestamp: message timestamps are the
// server's clock and Date.now() the client's.
// ⚠ Disconnect the MCP bridge first: two pages on one GM user both act as the elect.
// Sections: `--section 5`, `--section 12,13`, `--list` (ARCHITECTURE §11 *Adding a TEST* rule 2).
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs parses this; `npm run coverage` checks it both ways).
// ⚠ NEVER import a suite: it connects on evaluation.
export const COVERS = [
  'concentration.js'        // the assist — ask, roll, verdict, break, both modes
];

const SECTIONS = {
  1: 'auto mode: the floor DC, and quiet good news',
  2: 'the DC is half the damage…',
  3: '…and caps at 30 under modern rules',
  4: 'failure breaks, and the cascade is native',
  5: 'prompt mode: the popup, one control, the click',
  6: 'the timer rolls — expiry is the dice, not a pass',
  7: 'multiple instances queue — RAW, one popup at a time',
  8: 'a sheet-rolled save is the answer',
  9: 'the native whisper card is ours: the request card never leaks',
  10: 'private visibility — and the break that never is',
  12: 'the cause rides the real chain (every machine on: the decision timer lets the reaction hold and the offers pass)',
  13: 'a sheet edit is damage too — then zero HP is not a save',
  14: 'the crash-resume re-drives a dead fold',
  15: 'Incapacitated breaks concentration — no save, the cascade, the card (user, 2026-09-02)',
  16: 'Mage Slayer (the PHB feats, group 4): damage from its holder asks the save at Disadvantage — the ask records who, the card says it, the roll carries it (netted with the sheet); the dialog\'s gate lists it',
  17: "the check OWNS its DC (the user, 2026-09-27): a passed check offers no rescue; a failed one is WITHHELD — Heroic Inspiration offered, the spell still standing — and Pass lets it break"
};
// Concentration is a STATE: §§1, 5, 12, 13, 14 stand up their own; every other section names the
// nearest one that does. A section failing only under `--section` means a missing edge here.
const DEPENDS = {
  2: ['1'], 3: ['1'], 4: ['1'],
  6: ['5'], 7: ['5'], 8: ['5'], 9: ['5'], 10: ['5']
};
// §16 stands up its own concentration (ensureConc) and its own settings.

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
// Three casts, a dozen damage/poll cycles, one real attack chain, one 3.5s timer wait.
const f = await connectSuite({ tag: 'conc', watchdogMs: 480_000 });
announcePlan('conc', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-bythebooks';
  const { until, watch, tokenOn, snapshotSettings, faces, unrig } = window.__btb;
  const { results, log, skips, ok, want, section } = window.__btb.begin({ sections, titles });
  // The section gate (tools/harness.mjs): the plan arrives as DATA in this serialized closure.
  // Every moment payload published during the run, so a section can assert its resolve was heard.
  const moments = [];
  const momentHookId = Hooks.on('bythebooks.moment', p => moments.push(p));
  const momentsOf = (event, since = 0) => moments.filter(p => (p.event === event) && (p.at >= since));
  const plain = p => { try { return JSON.stringify(p) === JSON.stringify(JSON.parse(JSON.stringify(p))); } catch { return false; } };

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  for (const key of ['concMode', 'concTimer', 'concBreak', 'concVisibility']) {
    if (!game.settings.settings.has(`${MOD}.${key}`)) {
      return { fatal: `setting ${key} not registered — this client is running OLD code (F5)` };
    }
  }
  if (!game.users.activeGM?.isSelf) {
    return { fatal: 'this client is not the single active-GM elect — disconnect the bridge and any other GM page' };
  }

  // Id-set markers: marker() snapshots the log; newSince(mark) is everything new since.
  const marker = () => new Set(game.messages.contents.map(m => m.id));
  const newSince = mark => game.messages.contents.filter(m => !mark.has(m.id));
  const suiteMark = marker();

  const SETTING_KEYS = ['concMode', 'concTimer', 'concBreak', 'concVisibility',
    'autoDamage', 'autoApply', 'dramaticBeat', 'requireTarget', 'reactionHold',
    'riders', 'effectRiders', 'masteryRiders', 'fightingStyleList', 'reminderList', 'd20FoldAsk', 'd20Folds'];
  const settings = snapshotSettings(SETTING_KEYS);
  const { set } = settings;

  const scene = game.scenes.getName('By the Books Test Range');
  const shielder = game.actors.getName('BTB Test Shielder');
  const victim = game.actors.getName('BTB Test Victim');
  const npc = game.actors.getName('BTB Test Attacker');
  if (!scene || !shielder || !victim || !npc) {
    return { fatal: 'missing fixture: scene or BTB Test actors (shielder/victim/attacker)' };
  }

  const created = { items: [], effects: [], tokens: [] };
  const priorActor = {};
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    // ⚠ Settings restore first, in its own guard: a later cleanup error must never leave suite settings on the table.
    for (const failed of await settings.restore()) log.push(`TEARDOWN settings ERROR: ${failed}`);
    try {
      // End any concentration the run left (endConcentration cascades dependents, incl. the victim's rider).
      for (const e of [...(shielder.concentration?.effects ?? [])]) {
        try { await shielder.endConcentration(e.id); } catch { /* fine */ }
      }
      for (const [actorId, ids] of Object.entries(created.effects.reduce((m, e) => {
        (m[e.actorId] ??= []).push(e.id); return m;
      }, {}))) {
        const a = game.actors.get(actorId);
        const live = ids.filter(id => a?.effects.get(id));
        if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live);
      }
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
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
      // Sweep this run's chat: fixture speakers, the announcement alias, module-flagged messages,
      // and the native request card the off-half lets through.
      const mine = newSince(suiteMark).filter(m =>
        m.speaker?.alias?.startsWith?.('BTB Test') || m.speaker?.alias === 'By the Books'
          || Object.keys(m.flags?.[MOD] ?? {}).length
          || m.content?.includes?.('data-action="concentration"')
          || ((m.type === 'prompt') && (m.system?.buttons ?? []).some(b => /concentration/i.test(b.type ?? ''))));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };


  try {
    // Baseline: only the concentration machinery on.
    await set('autoDamage', 'off');
    await set('autoApply', false);
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('concMode', 'auto');
    await set('concTimer', 0);
    await set('concBreak', true);
    await set('concVisibility', true);

    // -------------------------------------------------- fixtures
    priorActor[shielder.id] = {
      'system.abilities.con.save.roll.bonus':
        shielder.system._source.abilities?.con?.save?.roll?.bonus ?? '',
      'system.attributes.hp.value': shielder.system._source.attributes.hp.value,
      'system.attributes.hp.temp': shielder.system._source.attributes.hp.temp,
      'system.attributes.ac.override': shielder.system._source.attributes.ac.override ?? null,
    };

    // Every DC/bonus lever below assumes con: bail loudly if the fixture says otherwise.
    const concAbility = (shielder.system.attributes?.concentration?.ability in CONFIG.DND5E.abilities)
      ? shielder.system.attributes.concentration.ability
      : CONFIG.DND5E.defaultAbilities.concentration;
    if (concAbility !== 'con') return { fatal: `fixture concentration ability is ${concAbility}, suite assumes con` };
    if ((shielder.system.abilities.con.mod ?? 0) > 9) {
      return { fatal: 'fixture con mod > +9 — the DC 30 failure sections would stop being deterministic' };
    }
    const modern = dnd5e.settings.rulesVersion === 'modern';
    log.push(`rules version: ${dnd5e.settings.rulesVersion} (DC cap ${modern ? 30 : 'none'})`);

    const saveBonus = v => shielder.update({ 'system.abilities.con.save.roll.bonus': v });
    const setTemp = v => shielder.update({ 'system.attributes.hp.temp': v });
    const healFull = () => shielder.update({
      'system.attributes.hp.value': shielder.system.attributes.hp.max,
      'system.attributes.hp.temp': 0 });

    // A concentration spell the fixture can really cast (its own, else Bless from a pack): the REAL
    // beginConcentrating path, never a hand-built effect.
    const findConcSpell = async () => {
      const owned = shielder.items.find(i => (i.type === 'spell')
        && i.system.properties?.has?.('concentration') && (i.system.level <= 1));
      if (owned) return owned;
      for (const pack of game.packs) {
        if (pack.documentName !== 'Item') continue;
        if (pack.metadata.id.startsWith('JB2A')) continue;
        let index;
        try { index = await pack.getIndex({ fields: ['type', 'system.level', 'name'] }); } catch { continue; }
        for (const entry of index) {
          if ((entry.type !== 'spell') || (entry.system?.level !== 1)) continue;
          if (entry.name !== 'Bless') continue;
          const doc = await pack.getDocument(entry._id);
          if (!doc.system.properties?.has?.('concentration')) continue;
          const [made] = await shielder.createEmbeddedDocuments('Item', [doc.toObject()]);
          created.items.push({ actorId: shielder.id, id: made.id });
          return made;
        }
      }
      return null;
    };
    const spell = await findConcSpell();
    if (!spell) return { fatal: 'no low-level concentration spell on the fixture and no Bless in any pack' };
    log.push(`concentration spell: ${spell.name} (level ${spell.system.level})`);

    const concEffects = () => [...(shielder.concentration?.effects ?? [])];
    const ensureConc = async () => {
      if (concEffects().length) return concEffects()[0];
      try { await shielder.longRest({ dialog: false, chat: false }); } catch { /* fine */ }
      const activity = shielder.items.get(spell.id).system.activities.contents[0];
      const r = await activity.use({ subsequentActions: false }, { configure: false }, {});
      if (r === undefined) return null; // the cast itself was refused (slots) — a fixture fact
      return until(() => concEffects()[0], { timeout: 6000, label: 'the concentration effect from the cast' });
    };

    // Direct damage, traits ignored: the DC is a function of the number chosen.
    const smack = n => shielder.applyDamage(
      [{ value: n, type: 'bludgeoning', properties: new Set() }],
      { isDelta: true, ignore: true });

    const asksNew = mark => newSince(mark)
      .filter(m => m.getFlag(MOD, 'concentration')?.actorUuid === shielder.uuid)
      .sort((a, b) => a.timestamp - b.timestamp);
    const doneAskNew = mark => asksNew(mark)
      .find(m => m.getFlag(MOD, 'concentration')?.status === 'done');
    const contentNew = (mark, needle) => newSince(mark)
      .find(m => m.content?.includes?.(needle));
    // The native concentration request is a 'prompt' card, its button as DATA, no content.
    const nativeNew = mark => newSince(mark)
      .find(m => (m.type === 'prompt') && (m.system?.buttons ?? []).some(b => b.type === 'concentration'));
    // The ask is the system's Saving Throw dialog, found by the registry and our fieldset (told
    // from a save demand by the fieldset's eyebrow).
    const concPopups = () => [...foundry.applications.instances.values()]
      .filter(app => app.rendered && (app.element?.querySelector?.('[data-bf-save-demand]')?.textContent ?? '').includes('Concentration check'))
      .map(app => app.element);
    const dialogButtons = popup => popup ? [...popup.querySelectorAll('[data-application-part="buttons"] button[data-action], footer button, .form-footer button, nav.dialog-buttons button')] : [];
    // The dialog rebuilds its rolls on CHANGE, so a programmatic value must dispatch one; the
    // re-rendered formula line shows the bonus once the rebuild has landed.
    const setSituational = async (popup, value) => {
      const input = popup?.querySelector('input[name="roll.0.situational"]');
      if (input) {
        input.value = value;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const digits = String(value).replace(/\D/g, '');
        await until(() => (popup.querySelector('.formulas .formula')?.textContent ?? '').includes(digits),
          { timeout: 4000, label: `the situational ${value} in the dialog's formula` });
      }
      return !!input;
    };

    // ================================================== 1. auto mode: the floor DC, and quiet good news
    let hpBefore;
    if (want(1)) await section(1, async () => {
      const eff = await ensureConc();
      if (!eff) throw new Error('the fixture could not begin concentrating (cast refused?)');
      await saveBonus('+30');
      await setTemp(500);
      hpBefore = shielder.system.attributes.hp.value;
      const t0 = marker();
      await smack(7);
      const askMsg = await until(() => doneAskNew(t0), { timeout: 8000 });
      const ask = askMsg?.getFlag(MOD, 'concentration');
      ok('1. damage to a concentrating creature stamps an ask that auto-resolves',
        !!ask, ask ? '' : 'no resolved ask appeared');
      ok('1b. DC floors at 10 (7 damage)', ask?.dc === 10, `dc=${ask?.dc}`);
      ok('1c. the ask recorded the damage that caused it', ask?.damage === 7, `damage=${ask?.damage}`);
      ok('1d. the save succeeded and concentration held (+30 forced)',
        (ask?.outcome?.success === true) && (concEffects().length === 1),
        `success=${ask?.outcome?.success} effects=${concEffects().length}`);
      // The announcement posts AFTER the flag flips done: wait for it.
      const holdsCard = await until(() => contentNew(t0, 'holds'), { timeout: 8000 });
      ok('1e. the table is told, quietly: a public "holds" card',
        !!holdsCard && (holdsCard.whisper?.length === 0),
        holdsCard ? `whisper=${holdsCard.whisper?.length}` : 'no holds card');
      const rollMsg = ask?.outcome?.rollMessageId ? game.messages.get(ask.outcome.rollMessageId) : null;
      ok('1f. the roll carries the ask\'s DC as its target, and the card\'s own marking agrees',
        (rollMsg?.rolls?.[0]?.options?.target === 10) && (rollMsg?.rolls?.[0]?.isSuccess === true),
        `target=${rollMsg?.rolls?.[0]?.options?.target} isSuccess=${rollMsg?.rolls?.[0]?.isSuccess}`);
    });

    // ================================================== 2. the DC is half the damage…
    if (want(2)) await section(2, async () => {
      const t0 = marker();
      await smack(31);
      const ask = (await until(() => doneAskNew(t0), { timeout: 8000 }))?.getFlag(MOD, 'concentration');
      ok('2. DC is half the damage, floored (31 → 15)', ask?.dc === 15, `dc=${ask?.dc}`);
    });

    // ================================================== 3. …and caps at 30 under modern rules
    if (want(3)) await section(3, async () => {
      const t0 = marker();
      await smack(70);
      const ask = (await until(() => doneAskNew(t0), { timeout: 8000 }))?.getFlag(MOD, 'concentration');
      const expected = modern ? 30 : 35;
      ok(`3. DC ${modern ? 'caps at 30' : 'is uncapped (legacy)'} (70 damage → ${expected})`,
        ask?.dc === expected, `dc=${ask?.dc}`);
      ok('3b. temp-HP damage triggers the check (the pool absorbed all 70, real HP never moved)',
        (ask?.damage === 70) && (shielder.system.attributes.hp.value === hpBefore),
        `damage=${ask?.damage} hp=${shielder.system.attributes.hp.value} was=${hpBefore}`);
    });

    // ================================================== 4. failure breaks, and the cascade is native
    if (want(4)) await section(4, async () => {
      await saveBonus('');
      // A dependent is a row in the concentration effect's `flags.dnd5e.dependents`, honoured when
      // the dependent names it as origin.
      const conc = concEffects()[0];
      const [dep] = await victim.createEmbeddedDocuments('ActiveEffect', [{
        name: 'BTB Conc Dependent', img: 'icons/svg/aura.svg', origin: conc.uuid }]);
      created.effects.push({ actorId: victim.id, id: dep.id });
      await conc.setFlag('dnd5e', 'dependents', [...(conc.getFlag('dnd5e', 'dependents') ?? []), { uuid: dep.uuid }]);
      const t0 = marker();
      await smack(70); // DC 30 vs a mortal modifier — deterministic failure
      const askMsg = await until(() => doneAskNew(t0), { timeout: 8000 });
      const ask = askMsg?.getFlag(MOD, 'concentration');
      ok('4. a failed save is a failure (DC 30 forced)', ask?.outcome?.success === false,
        `success=${ask?.outcome?.success} total=${ask?.outcome?.total}`);
      const gone = await until(() => concEffects().length === 0, { timeout: 8000 });
      ok('4b. the break is real: the concentration effect is gone', !!gone,
        `effects=${concEffects().length}`);
      // The verdict publishes `save` through the gate and the failure `break` beside it (one momentId).
      const cv = momentsOf('save').filter(p => p.messageId === askMsg?.id);
      const bv = momentsOf('break').filter(p => p.messageId === askMsg?.id);
      ok('4z. the verdict was PUBLISHED through the gate: bythebooks.moment "save" (kind concentration) and "break" — the concentrator (the ask record\'s own actor), success false, the DC; once each, the same momentId, plain and frozen',
        (cv.length === 1) && (bv.length === 1) && (cv[0].kind === 'concentration') && (cv[0].actorUuid === ask?.actorUuid) && !!ask?.actorUuid && (cv[0].details?.success === false)
          && (cv[0].details?.dc === ask?.dc) && (bv[0].momentId === cv[0].momentId) && Object.isFrozen(cv[0]) && plain(cv[0]) && plain(bv[0]),
        `save=${JSON.stringify(cv[0])} break=${JSON.stringify(bv[0])}`);
      const depGone = await until(() => !victim.effects.get(dep.id), { timeout: 8000 });
      ok('4c. the dependent effect cascades away with it (native dependentOn)', !!depGone,
        depGone ? '' : 'dependent survived the break');
      // The break card posts after the whole endConcentration cascade.
      const broke = await until(() => contentNew(t0, 'loses concentration'), { timeout: 8000 });
      ok('4d. the table is told, loudly and in public',
        !!broke && (broke.whisper?.length === 0),
        broke ? `whisper=${broke.whisper?.length}` : 'no break card');
      // Not concentrating any more ⇒ further damage asks nothing.
      const t1 = marker();
      await smack(9);
      const strayAsk = await watch(() => asksNew(t1)[0], { ms: 1200 });
      ok('4e. damage without concentration asks nothing', !strayAsk && (asksNew(t1).length === 0),
        `asks=${asksNew(t1).length}`);
    });

    // ================================================== 5. prompt mode: the popup, one control, the click
    if (want(5)) await section(5, async () => {
      await set('concMode', 'prompt');
      await saveBonus('+30');
      const eff = await ensureConc();
      if (!eff) throw new Error('recast failed (slots?)');
      await setTemp(500);
      const t0 = marker();
      await smack(12);
      const askMsg = await until(() => asksNew(t0)[0], { timeout: 8000 });
      // A window: the ask must still be pending at its end, nothing rolled in its place.
      const moved = await watch(() => {
        const s = askMsg.getFlag(MOD, 'concentration')?.status;
        return (s !== 'pending') ? (s ?? 'none') : null;
      }, { ms: 1500 });
      const ask = askMsg?.getFlag(MOD, 'concentration');
      ok('5. prompt mode waits for a human (ask still pending, nothing auto-rolled)',
        !!askMsg && (ask?.status === 'pending') && !moved, `status=${ask?.status} moved=${moved}`);
      const popup = await until(() => concPopups()[0], { timeout: 4000 });
      ok('5b. the popup is on screen for whoever owns the decision', !!popup,
        popup ? '' : 'no popup found in DOM');
      const buttons = dialogButtons(popup);
      const labels = buttons.map(b => b.textContent.trim());
      ok('5c. the ask IS the system\'s Saving Throw dialog: its Adv/Normal/Dis, its situational bonus, its roll mode — and our demand fieldset',
        (labels.join('/') === 'Advantage/Normal/Disadvantage')
          && !!popup?.querySelector('input[name="roll.0.situational"]')
          && !!popup?.querySelector('select[name="rollMode"]'),
        `buttons=[${labels.join('|')}] input=${!!popup?.querySelector('input[name="roll.0.situational"]')} rollMode=${!!popup?.querySelector('select[name="rollMode"]')}`);
      buttons.find(b => b.textContent.trim() === 'Normal')?.click();
      const doneMsg = await until(() => doneAskNew(t0), { timeout: 8000 });
      const done = doneMsg?.getFlag(MOD, 'concentration');
      ok('5d. the click rolls, the elect folds, the save holds',
        (done?.outcome?.success === true) && (concEffects().length === 1),
        `success=${done?.outcome?.success}`);
      const rollMsg = done?.outcome?.rollMessageId ? game.messages.get(done.outcome.rollMessageId) : null;
      ok('5e. the roll answers THIS ask (respondsTo channel)',
        !!askMsg && !!rollMsg && (rollMsg.getFlag(MOD, 'respondsTo') === askMsg.id),
        `respondsTo=${rollMsg?.getFlag(MOD, 'respondsTo')} ask=${askMsg?.id}`);
      await until(() => concPopups().length === 0, { timeout: 4000 });
      ok('5f. the answered popup closed itself', concPopups().length === 0,
        `popups=${concPopups().length}`);

      // The situational bonus and Advantage must reach the dice: the sheet bonus comes off, so
      // +30 can only come through the input.
      // The sheet bonus goes back in a finally: a wait that throws here must not leave it off for §6 on.
      await saveBonus('');
      try {
        const t1 = marker();
        await smack(12);
        await until(() => asksNew(t1)[0], { timeout: 8000 });
        const popup2 = await until(() => concPopups()[0], { timeout: 4000 });
        await setSituational(popup2, '+30');
        dialogButtons(popup2).find(b => b.textContent.trim() === 'Advantage')?.click();
        const done2 = await until(() => doneAskNew(t1), { timeout: 8000 });
        const o2 = done2?.getFlag(MOD, 'concentration')?.outcome;
        const roll2 = (o2?.rollMessageId ? game.messages.get(o2.rollMessageId) : null)?.rolls?.[0];
        ok('5g. the situational bonus reaches the formula and Advantage reaches the d20',
          (roll2?.options?.advantageMode === 1) && /30/.test(roll2?.formula ?? '')
            && (o2?.success === true),
          `advMode=${roll2?.options?.advantageMode} formula=${roll2?.formula}`);
      } finally {
        await saveBonus('+30');
      }
    });

    // ================================================== 6. the timer rolls — expiry is the dice, not a pass
    if (want(6)) await section(6, async () => {
      // The timer goes back off in a finally: a wait that throws here must not time §7's popups.
      await set('concTimer', 2);
      try {
        const t0 = marker();
        await smack(12);
        const askMsg = await until(() => asksNew(t0)[0], { timeout: 8000 });
        const pendingAsk = askMsg?.getFlag(MOD, 'concentration');
        ok('6. a timed ask carries its deadline', !!pendingAsk?.deadline && (pendingAsk?.window === 2),
          `window=${pendingAsk?.window}`);
        const done = await until(() => doneAskNew(t0), { timeout: 8000 });
        const ask = done?.getFlag(MOD, 'concentration');
        ok('6b. the buzzer rolled the save itself and marked it',
          (ask?.status === 'done') && (ask?.outcome?.timedOut === true) && (ask?.outcome?.success === true),
          `timedOut=${ask?.outcome?.timedOut} success=${ask?.outcome?.success}`);
        const holdsCard = await until(() => contentNew(t0, 'rolled by the timer'), { timeout: 8000 });
        ok('6c. the announcement says the timer pressed the button', !!holdsCard,
          holdsCard ? '' : 'no timer wording found');
        const roll6 = (ask?.outcome?.rollMessageId ? game.messages.get(ask.outcome.rollMessageId) : null)
          ?.rolls?.[0];
        // A concentration save inherits the sheet's con-save mode, so "straight" = the sheet's mode
        // and no ad-hoc input.
        const sheetMode6 = shielder.system.abilities?.con?.save?.roll?.mode ?? 0;
        ok('6d. the buzzer roll is straight — data-driven only (the sheet\x27s own con-save mode), no ad-hoc inputs',
          (roll6?.options?.advantageMode === sheetMode6),   // the +30 in the formula is the SHEET's (saveBonus), not an input
          `advMode=${roll6?.options?.advantageMode} sheetMode=${sheetMode6} formula=${roll6?.formula}`);
      } finally {
        await set('concTimer', 0);
      }
    });

    // ================================================== 7. multiple instances queue — RAW, one popup at a time
    if (want(7)) await section(7, async () => {
      const t0 = marker();
      await smack(10);
      await until(() => asksNew(t0).length === 1, { timeout: 8000 });
      await smack(11);
      await until(() => asksNew(t0).length === 2, { timeout: 8000 });
      const [first, second] = asksNew(t0);
      ok('7. two damage instances are two asks', !!first && !!second && (first.id !== second.id),
        `asks=${asksNew(t0).length}`);
      if (first && second) {
        // The oldest ask's popup comes; a window for a second one that must not.
        await until(() => concPopups().length >= 1, { timeout: 4000, label: 'the first ask\'s popup' });
        const twoUp = await watch(() => concPopups().length > 1, { ms: 1000 });
        ok('7b. only the oldest ask has a popup (the queue)', !twoUp && (concPopups().length === 1),
          `popups=${concPopups().length}${twoUp ? ' (two were up at once)' : ''}`);
        dialogButtons(concPopups()[0]).find(b => b.textContent.trim() === 'Normal')?.click();
        await until(() => first.getFlag(MOD, 'concentration')?.status === 'done', { timeout: 8000 });
        const secondPopup = await until(() => (concPopups().length === 1)
          && (second.getFlag(MOD, 'concentration')?.status === 'pending'), { timeout: 5000 });
        ok('7c. resolving the first advances the queue to the second', !!secondPopup,
          `popups=${concPopups().length} second=${second.getFlag(MOD, 'concentration')?.status}`);
        dialogButtons(concPopups()[0]).find(b => b.textContent.trim() === 'Normal')?.click();
        await until(() => second.getFlag(MOD, 'concentration')?.status === 'done', { timeout: 8000 });
        ok('7d. both asks resolved, concentration held through both',
          (second.getFlag(MOD, 'concentration')?.outcome?.success === true) && (concEffects().length === 1),
          `effects=${concEffects().length}`);
      } else {
        ok('7b-d. queue mechanics', false, 'skipped: the two asks never both appeared');
      }
    });

    // ================================================== 8. a sheet-rolled save is the answer
    if (want(8)) await section(8, async () => {
      const t0 = marker();
      await smack(12);
      const askMsg = await until(() => asksNew(t0)[0], { timeout: 8000 });
      // A sheet roll has no respondsTo and no target: the fold matches actor + ability.
      await shielder.rollConcentration({}, { configure: false }, {});
      const done = await until(() => doneAskNew(t0), { timeout: 8000 });
      const ask = done?.getFlag(MOD, 'concentration');
      ok('8. the fold catches a bare sheet roll as the answer',
        !!askMsg && (ask?.status === 'done') && (ask?.outcome?.success === true),
        `status=${ask?.status} success=${ask?.outcome?.success}`);
      await until(() => concPopups().length === 0, { timeout: 4000 });
      ok('8b. the sheet roll closes the popup too', concPopups().length === 0,
        `popups=${concPopups().length}`);
    });

    // ================================================== 9. the native whisper card is ours
    if (want(9)) await section(9, async () => {
      await set('concMode', 'auto'); // prompt would leave the ask pending and the popup open
      const t0 = marker();
      await smack(9);
      await until(() => doneAskNew(t0), { timeout: 8000 });
      // A window for the native request card to leak through.
      const leaked = await watch(() => nativeNew(t0), { ms: 800 });
      // Drain this section's announcement: it lands seconds after the fold, and a public one would
      // leak into §10's window.
      await until(() => contentNew(t0, 'holds'), { timeout: 8000 });
      ok('9. the native request card is suppressed while the mode is on',
        !leaked && !nativeNew(t0),
        'a native concentration request card leaked through');
    });

    // ================================================== 10. private visibility — and the break that never is
    if (want(10)) await section(10, async () => {
      // Visibility goes back to public in a finally: a wait that throws here must not whisper §12 on.
      await set('concVisibility', false);
      try {
        await set('concMode', 'auto');
        // Let earlier sections' paused announcements land before this window opens: each done ask's
        // `applied` receipt lands after its card.
        await until(() => newSince(suiteMark).every(m => {
          const a = m.getFlag(MOD, 'concentration');
          return (a?.status !== 'done') || (a.outcome?.applied === true);
        }), { timeout: 10_000, label: 'every earlier ask\'s announcement posted (its applied receipt)' });
        const t0 = marker();
        await smack(12);
        const done = await until(() => doneAskNew(t0), { timeout: 8000 });
        const ask = done?.getFlag(MOD, 'concentration');
        const rollMsg = ask?.outcome?.rollMessageId ? game.messages.get(ask.outcome.rollMessageId) : null;
        // Attribute the announcement by this ask's total-vs-DC signature, never by 'holds' alone.
        const sig = `${ask?.outcome?.total} vs DC ${ask?.dc}`;
        const holdsCard = await until(() => newSince(t0).find(m =>
          (m.speaker?.alias === 'By the Books') && m.content.includes('holds')
          && m.content.includes(sig)) ?? null, { timeout: 15000 });
        ok('10. private mode whispers the ask', (done?.whisper?.length ?? 0) > 0,
          `whisper=${done?.whisper?.length}`);
        ok('10b. private mode whispers the roll', (rollMsg?.whisper?.length ?? 0) > 0,
          `whisper=${rollMsg?.whisper?.length}`);
        ok('10c. private mode whispers the good news', (holdsCard?.whisper?.length ?? 0) > 0,
          `whisper=${holdsCard?.whisper?.length}`);
        // The break is never private: the cascade strips icons the whole table sees.
        await saveBonus('');
        const t1 = marker();
        await smack(70);
        await until(() => doneAskNew(t1), { timeout: 8000 });
        const broke = await until(() => newSince(t1).find(m =>
          (m.speaker?.alias === 'By the Books') && m.content.includes('loses concentration')), { timeout: 8000 });
        ok('10d. the break card is public even in private mode',
          !!broke && (broke.whisper?.length === 0), `whisper=${broke?.whisper?.length}`);
      } finally {
        await set('concVisibility', true);
      }
    });

    // ================================================== 12. the cause rides the real chain
    if (want(12)) await section(12, async () => {
      // Every machine is on: the Shielder's reaction hold and any hit offer wait on the decision
      // timer, so it is short here (they pass), and the section stands up its own concentration.
      await set('concMode', 'auto');
      // The timer goes back off in a finally: a wait that throws here must not time §13 on.
      await set('concTimer', 2);
      try {
        const eff12 = await ensureConc();
        if (!eff12) throw new Error('recast failed for section 12 (slots?)');
        await saveBonus('+30');
        await setTemp(500);
        if (canvas.scene?.id !== scene.id) await scene.view();
        // Use the shielder's linked token when it stands; create one only when missing.
        let tokenDoc = scene.tokens.find(t => (t.actorId === shielder.id) && t.actorLink);
        if (!tokenDoc) {
          [tokenDoc] = await scene.createEmbeddedDocuments('Token', [
            foundry.utils.mergeObject(shielder.prototypeToken.toObject(),
              { x: 1000, y: 1400, actorId: shielder.id, actorLink: true }, { inplace: false })]);
          created.tokens.push(tokenDoc.id);
        }
        const token = await tokenOn(tokenDoc.id);
        // AC 1 + advantage: a deterministic hit short of a double fumble.
        await shielder.update({ 'system.attributes.ac.override': 1 });
        const npcItem = npc.items.find(i => i.system.activities?.some?.(a => a.type === 'attack'));
        const activity = npcItem?.system.activities.find(a => a.type === 'attack');
        if (!activity) throw new Error('BTB Test Attacker has no attack activity');
        // The attacker's name as the table sees it: the speaker resolves through the scene token
        // ("Hobgoblin"), and an unlinked token's synthetic actor carries the token's name.
        const npcTokenDoc = scene.tokens.find(t => t.actorId === npc.id);
        const expectedAttacker = npcTokenDoc
          ? (npcTokenDoc.actorLink ? npc.name : npcTokenDoc.name) : npc.name;
        log.push(`expected attacker name at the table: ${expectedAttacker}`);
        let ask = null; let t0 = null;
        // A retry loop: a fumble swings again, and each try waits softly for its ask.
        for (let attempt = 0; attempt < 2 && !ask; attempt++) {
          t0 = marker();
          token.setTarget(true, { releaseOthers: true });
          await until(() => game.user.targets.has(token), { timeout: 2000, label: 'the shielder targeted' });
          const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
          const usageId = results?.message?.id ?? null;
          const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
            usageId ? { data: { 'system.origin': usageId } } : {});
          if (rolls?.[0]?.isFumble) { log.push('12: fumble, retrying'); continue; }
          ask = (await until(() => doneAskNew(t0), { timeout: 20_000 }).catch(() => null))?.getFlag(MOD, 'concentration');
        }
        ok('12. a real attack chain (auto-roll → auto-apply) raises the ask',
          !!ask, ask ? '' : 'no ask from the attack chain');
        ok('12b. the ask knows what hit them and who swung it',
          (ask?.cause?.attacker === expectedAttacker) && (ask?.cause?.source === npcItem.name),
          `cause=${JSON.stringify(ask?.cause ?? null)} expected=${expectedAttacker}`);
        const askMsg = doneAskNew(t0);
        ok('12c. the card tells the table the same story',
          !!askMsg?.content?.includes(expectedAttacker) && !!askMsg?.content?.includes(npcItem.name),
          'card content missing attacker or source');
      } finally {
        await set('concTimer', 0);
      }
    });

    // ================================================== 13. a sheet edit is damage too — then zero HP is not a save
    if (want(13)) await section(13, async () => {
      await set('concMode', 'auto');
      const eff = concEffects()[0] ?? await ensureConc();
      if (!eff) throw new Error('recast failed (slots?)');
      // Lowering HP by hand is damage to the system, so the edit's own ask must resolve (+30)
      // before the zero-HP half measures.
      const tSetup = marker();
      await shielder.update({
        'system.attributes.hp.value': 5, 'system.attributes.hp.temp': 0,
        'system.attributes.ac.override': priorActor[shielder.id]['system.attributes.ac.override'] });
      const setupAsk = await until(() => doneAskNew(tSetup), { timeout: 8000 });
      ok('13. a GM hand-lowering HP on a concentrator raises the check too',
        !!setupAsk && (setupAsk.getFlag(MOD, 'concentration')?.outcome?.success === true),
        setupAsk ? '' : 'no ask from the sheet edit');
      const t0 = marker();
      await smack(50);
      const gone = await until(() => concEffects().length === 0, { timeout: 8000 });
      ok('13b. dropping to 0 ends concentration with no save', !!gone,
        `effects=${concEffects().length}`);
      const strayAsk = await watch(() => asksNew(t0)[0], { ms: 1200 });
      ok('13c. no ask was stamped at 0 — there was nothing to roll', !strayAsk && (asksNew(t0).length === 0),
        `asks=${asksNew(t0).length}`);
      const card = await until(() => contentNew(t0, 'no save at 0 HP'), { timeout: 8000 });
      ok('13d. the break card says why (down, not a failed roll)',
        !!card && (card.whisper?.length === 0), card ? '' : 'no down-wording card');
      await healFull();
    });

    // ================================================== 14. the crash-resume re-drives a dead fold
    if (want(14)) await section(14, async () => {
      const eff = concEffects()[0] ?? await ensureConc();
      if (!eff) throw new Error('recast failed for section 14 (slots?)');
      const t0 = marker();
      // Forge a crash's residue: an ask folded to done (failed), never applied, answeredAt past the
      // resume horizon. Any GM render must run the cascade, post the break card, write the receipt.
      await ChatMessage.create({
        speaker: { alias: 'By the Books' },
        content: 'probe: crash-resume ask',
        flags: { [MOD]: { concentration: {
          status: 'done', actorUuid: shielder.uuid, ability: 'con', dc: 30, damage: 60,
          names: [spell.name], effectIds: [eff.id],
          outcome: { total: 3, success: false, rollMessageId: null, answeredAt: Date.now() - 30_000 }
        } } }
      });
      const gone = await until(() => concEffects().length === 0, { timeout: 10_000 });
      const card14 = await until(() => contentNew(t0, 'ends'), { timeout: 8000 });
      const askAfter = newSince(t0).find(m => m.getFlag(MOD, 'concentration')?.outcome);
      // The applied receipt lands AFTER the break card.
      await until(() => askAfter?.getFlag(MOD, 'concentration')?.outcome?.applied === true, { timeout: 8000 });
      ok('14. a done-but-unapplied fold re-drives: cascade, break card, applied receipt',
        !!gone && !!card14 && (askAfter?.getFlag(MOD, 'concentration')?.outcome?.applied === true),
        `effects=${concEffects().length} card=${!!card14} `
          + `applied=${askAfter?.getFlag(MOD, 'concentration')?.outcome?.applied}`);
    });
    // ================================================== 15. Incapacitated breaks concentration
    // dnd5e does not end concentration when the status lands; the module does.
    if (want(15)) await section(15, async () => {
      const eff = concEffects()[0] ?? await ensureConc();
      if (!eff) throw new Error('recast failed for section 15 (slots?)');
      const t0 = marker();
      const status = await ActiveEffect.implementation.fromStatusEffect('incapacitated');
      const [pressed] = await ActiveEffect.implementation.create(status.toObject(), { parent: shielder, keepId: true }).then(e => [e]);
      const gone = await until(() => concEffects().length === 0, { timeout: 10_000 });
      const card15 = await until(() => contentNew(t0, 'ends'), { timeout: 8000 });
      ok('15. the Incapacitated condition landing on a concentrator ends concentration — no save, the cascade, the card says why',
        !!gone && !!card15 && /Incapacitated/.test(card15?.content ?? ''),
        `effects=${concEffects().length} card=${!!card15} says=${/Incapacitated/.test(card15?.content ?? '')}`);
      if (pressed) await shielder.deleteEmbeddedDocuments('ActiveEffect', [pressed.id]).catch(() => {});
      await until(() => !pressed || !shielder.effects.get(pressed.id), { timeout: 4000, label: 'the Incapacitated effect lifted' });
    });

    // ================================================== 16. Mage Slayer's Concentration Breaker
    // The damage card speaks for the attacker (the dealer the ask reads); +30 keeps every verdict a
    // success, so the MODE is measured, against a control roll without the feat.
    if (want(16)) await section(16, async () => {
      await set('concMode', 'auto');
      await set('concTimer', 0);
      const eff = concEffects()[0] ?? await ensureConc();
      if (!eff) throw new Error('recast failed for section 16 (slots?)');
      await saveBonus('+30');
      await setTemp(500);
      const dealt = async (n = 12) => {
        const card = await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: npc }), content: 'probe: the attacker\'s damage' });
        await shielder.applyDamage([{ value: n, type: 'bludgeoning', properties: new Set() }],
          { isDelta: true, ignore: true, originatingMessage: card });
        return card;
      };
      const modeOf = ask => (ask?.outcome?.rollMessageId ? game.messages.get(ask.outcome.rollMessageId) : null)?.rolls?.[0]?.options?.advantageMode;
      // The control: the attacker without the feat.
      const tc = marker();
      await dealt();
      const control = (await until(() => doneAskNew(tc), { timeout: 8000 }))?.getFlag(MOD, 'concentration');
      const m0 = modeOf(control);
      ok('16. control: the attacker without Mage Slayer — the ask records no breaker',
        !!control && !control.breaker && Number.isFinite(m0), `ask=${!!control} breaker=${JSON.stringify(control?.breaker ?? null)} mode=${m0}`);
      // Lend the PHB's Mage Slayer to the attacker.
      const pack = game.packs.get('dnd-players-handbook.feats');
      const entry = pack ? (await pack.getIndex()).find(e => e.name === 'Mage Slayer') : null;
      const source = entry ? await pack.getDocument(entry._id) : null;
      if (!source) throw new Error('no Mage Slayer in dnd-players-handbook.feats');
      const [lent] = await npc.createEmbeddedDocuments('Item', [source.toObject()]);
      created.items.push({ actorId: npc.id, id: lent.id });
      const t1 = marker();
      await dealt();
      const askMsg = await until(() => doneAskNew(t1), { timeout: 8000 });
      const ask = askMsg?.getFlag(MOD, 'concentration');
      // The dealer is whoever the card speaks for: the goblin's unlinked token's synthetic actor,
      // holding the lent feat through the base.
      const dealer = ask?.breaker?.uuid ? fromUuidSync(ask.breaker.uuid) : null;
      ok('16b. damage from the holder: the ask records the breaker — the feat and who dealt it',
        (ask?.breaker?.feat === 'Mage Slayer') && (dealer?.id === npc.id) && (ask?.breaker?.rule?.benefit === 'Concentration Breaker'),
        `breaker=${JSON.stringify(ask?.breaker ?? null)} dealer=${dealer?.id} npc=${npc.id}`);
      ok('16c. the ask card says it',
        /Mage Slayer/.test(askMsg?.content ?? '') && /Disadvantage/.test(askMsg?.content ?? ''),
        'the card does not name Mage Slayer and Disadvantage');
      // dnd5e nets: the sheet's own Advantage beside the breaker is a plain roll; otherwise Disadvantage.
      const expected = (m0 > 0) ? 0 : -1;
      ok('16d. the auto roll carries the Disadvantage, netted by dnd5e with the sheet\'s own mode',
        modeOf(ask) === expected, `mode=${modeOf(ask)} expected=${expected} (control ${m0})`);
      // Prompt mode: the system's dialog opens with the gate's box naming the feat.
      await set('concMode', 'prompt');
      const t3 = marker();
      await dealt();
      await until(() => asksNew(t3)[0], { timeout: 8000 });
      const popup = await until(() => concPopups()[0], { timeout: 5000 });
      const gateText = popup?.querySelector('[data-bf-reminder]')?.textContent ?? '';
      ok('16f. prompt mode: the dialog\'s gate lists the attacker\'s Mage Slayer, counted as Disadvantage',
        /Mage Slayer/.test(gateText) && /Disadvantage/i.test(gateText), `gate="${gateText.replace(/\s+/g, ' ').slice(0, 200)}"`);
      dialogButtons(popup).find(b => b.textContent.trim() === 'Normal')?.click();
      await until(() => doneAskNew(t3), { timeout: 8000 });
      await set('concMode', 'auto');
    });

    // ================================================== 17. the check owns its DC — a rescue only on a failure
    if (want(17)) await section(17, async () => {
      await set('concMode', 'auto');
      await set('concTimer', 0);
      await set('d20FoldAsk', true);
      await set('d20Folds', game.settings.settings.get(`${MOD}.d20Folds`)?.default ?? '');
      await set('autoDamage', 'all');          // the fold's side gate (modeAllows)
      const priorInsp = shielder.system.attributes.inspiration;
      try {
        await shielder.update({ 'system.attributes.inspiration': true });
        const eff = concEffects()[0] ?? await ensureConc();
        if (!eff) throw new Error('recast failed for section 17 (slots?)');
        await saveBonus('+30');
        await setTemp(500);
        const t0 = marker();
        await smack(12);
        const passed = (await until(() => doneAskNew(t0), { timeout: 8000 }))?.getFlag(MOD, 'concentration');
        const passRoll = passed?.outcome?.rollMessageId ? game.messages.get(passed.outcome.rollMessageId) : null;
        ok('17a. a PASSED check offers no rescue — the ask knows the DC',
          (passed?.outcome?.success === true) && !passRoll?.getFlag(MOD, 'd20fold'),
          `success=${passed?.outcome?.success} fold=${JSON.stringify(passRoll?.getFlag(MOD, 'd20fold')?.offers ?? null)}`);
        await saveBonus('');
        const t1 = marker();
        // DC 10 failed on a 2: a reroll's 20 can still win (an offer that cannot win is not made, RULINGS *Rescuing the hit*)
        faces([[2, 20]]);
        await smack(12);
        const askMsg = await until(() => asksNew(t1)[0], { timeout: 8000 });
        unrig();
        const held = await until(() => {
          const a = askMsg?.getFlag(MOD, 'concentration');
          const r = a?.withheld ? game.messages.get(a.withheld) : null;
          return (r?.getFlag(MOD, 'd20fold')?.status === 'pending') ? r : null;
        }, { timeout: 8000 });
        const offers = (held?.getFlag(MOD, 'd20fold')?.offers ?? []).map(o => o.kind);
        ok('17b. a FAILED check is withheld: Heroic Inspiration offered against the DC, the ask still pending, the spell still up',
          !!held && offers.includes('heroic') && (held.getFlag(MOD, 'd20fold')?.dc === askMsg?.getFlag(MOD, 'concentration')?.dc)
            && (askMsg?.getFlag(MOD, 'concentration')?.status === 'pending') && (concEffects().length === 1),
          `held=${!!held} offers=[${offers}] status=${askMsg?.getFlag(MOD, 'concentration')?.status} effects=${concEffects().length}`);
        const pass = await until(() => [...document.querySelectorAll('.application')]
          .find(el => el.querySelector('[data-bf-rescue-action="heroic"]'))?.querySelector('button[data-action="pass"]'), { timeout: 6000 });
        pass?.click();
        const done = await until(() => (askMsg?.getFlag(MOD, 'concentration')?.status === 'done') ? askMsg.getFlag(MOD, 'concentration') : null, { timeout: 10000 });
        const gone = await until(() => concEffects().length === 0, { timeout: 8000 });
        ok('17c. Pass: the verdict lands — failed, and the concentration breaks', (done?.outcome?.success === false) && !!gone,
          `pass=${!!pass} success=${done?.outcome?.success} effects=${concEffects().length}`);
      } finally {
        unrig();
        await shielder.update({ 'system.attributes.inspiration': priorInsp });
        await saveBonus('+30');
      }
    });
  } catch (err) {
    ok('SUITE', false, `unhandled: ${err?.message}\n${err?.stack}`);
  } finally {
    Hooks.off('bythebooks.moment', momentHookId);
    await teardown();
    for (const a of [shielder, victim, npc].filter(Boolean)) {
      try { await a.longRest?.({ dialog: false, chat: false }); } catch { /* fine */ }
    }
  }

  return { results, log, skips };
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'conc', out, plan, f });
