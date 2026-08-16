// Battle Flow Phase 2.5 smoke test — the concentration assist, driven end to end in the live
// world: damage → ask → roll → verdict → break, in both modes, on the elect's own client.
//
// Harness discipline (HANDOFF): every setting touched is restored to whatever was found;
// every message this run creates is deleted on the way out; BF Test fixtures are long-rested
// (they spend real slots and real HP); ask/answer searches go by module flag over the WHOLE
// log, never a tail window; and outcomes are forced deterministically — success by a +30
// save bonus, failure by a DC 30 ask against a mortal modifier — because a suite that can
// lose a coin flip is a suite that lies once a week.
//
// ⚠ "New messages" are found by ID-SET DIFFERENCE, never by timestamp. Message timestamps
// come from the server's clock and this suite's Date.now() from the client's; the first run
// of this suite lost every ask to a ~2-3s skew between them — the machinery all worked, and
// every `timestamp >= t0` search read straight past it. A snapshot of ids taken before the
// action and diffed after cannot be lied to by any clock. (The tail-window lesson, clock
// edition.)
//
// ⚠ Disconnect the MCP bridge first (two pages on one GM user make both clients the elect —
// the double-apply lesson of 2026-08-16, and here it would stamp every ask twice).
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}

// Three casts, a dozen damage/poll cycles, one real attack chain, one 3.5s timer wait.
setTimeout(() => { console.error('[conc] WATCHDOG 480s'); process.exit(3); }, 480_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
console.log('[conc] connecting…');
await f.connect();
console.log('[conc] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const skip = why => skips.push(why);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

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

  // ⚠ Id-set markers, not timestamps (see the file banner). marker() snapshots the log;
  // newSince(mark) is everything that did not exist at the snapshot, whatever any clock says.
  const marker = () => new Set(game.messages.contents.map(m => m.id));
  const newSince = mark => game.messages.contents.filter(m => !mark.has(m.id));
  const suiteMark = marker();

  const SETTING_KEYS = ['concMode', 'concTimer', 'concBreak', 'concVisibility',
    'autoDamage', 'autoApply', 'dramaticBeat', 'requireTarget', 'reactionHold',
    'suppressAttackCards', 'riders', 'effectRiders', 'masteryRiders'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const shielder = game.actors.getName('BF Test Shielder');
  const victim = game.actors.getName('BF Test Victim');
  const npc = game.actors.getName('BF Test Attacker');
  if (!scene || !shielder || !victim || !npc) {
    return { fatal: 'missing fixture: scene or BF Test actors (shielder/victim/attacker)' };
  }

  const created = { items: [], effects: [], tokens: [] };
  const priorActor = {};
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try {
      // End any concentration the run left standing (endConcentration cascades dependents,
      // which also sweeps the victim's rider effect if a break section died mid-way).
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
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      for (const [k, v] of Object.entries(prior)) await set(k, v);
      // Sweep this run's chat: everything created since the suite's opening snapshot that is
      // ours — fixture speakers, the module's announcement alias, any module-flagged message
      // (asks and stamped rolls), and the native request card the off-half lets through.
      const mine = newSince(suiteMark).filter(m =>
        m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
          || Object.keys(m.flags?.[MOD] ?? {}).length
          || m.content?.includes?.('data-action="concentration"'));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  const waitFor = async (test, timeout = 8000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const v = test();
      if (v) return v;
      await sleep(250);
    }
    return null;
  };

  try {
    // Baseline: only the concentration machinery lives; the ghost-chaser stays pinned off.
    await set('autoDamage', 'off');
    await set('autoApply', false);
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('suppressAttackCards', false);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('concMode', 'auto');
    await set('concTimer', 0);
    await set('concBreak', true);
    await set('concVisibility', true);

    // -------------------------------------------------- fixtures
    priorActor[shielder.id] = {
      'system.abilities.con.bonuses.save':
        shielder.system._source.abilities?.con?.bonuses?.save ?? '',
      'system.attributes.hp.value': shielder.system._source.attributes.hp.value,
      'system.attributes.hp.temp': shielder.system._source.attributes.hp.temp,
      'system.attributes.ac.calc': shielder.system._source.attributes.ac.calc,
      'system.attributes.ac.flat': shielder.system._source.attributes.ac.flat,
    };

    // The concentration ability as the module will resolve it — every DC/bonus lever below
    // assumes con, so bail loudly if this world's fixture says otherwise.
    const concAbility = (shielder.system.attributes?.concentration?.ability in CONFIG.DND5E.abilities)
      ? shielder.system.attributes.concentration.ability
      : CONFIG.DND5E.defaultAbilities.concentration;
    if (concAbility !== 'con') return { fatal: `fixture concentration ability is ${concAbility}, suite assumes con` };
    if ((shielder.system.abilities.con.mod ?? 0) > 9) {
      return { fatal: 'fixture con mod > +9 — the DC 30 failure sections would stop being deterministic' };
    }
    const modern = dnd5e.settings.rulesVersion === 'modern';
    log.push(`rules version: ${dnd5e.settings.rulesVersion} (DC cap ${modern ? 30 : 'none'})`);

    const saveBonus = v => shielder.update({ 'system.abilities.con.bonuses.save': v });
    const setTemp = v => shielder.update({ 'system.attributes.hp.temp': v });
    const healFull = () => shielder.update({
      'system.attributes.hp.value': shielder.system.attributes.hp.max,
      'system.attributes.hp.temp': 0 });

    // A concentration spell the fixture can really cast: its own first, Bless from a pack
    // otherwise. The cast is the REAL beginConcentrating path — hand-building the effect
    // would test an imitation.
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
      return waitFor(() => concEffects()[0], 6000);
    };

    // Direct damage, traits ignored — the DC must be a function of the number we chose.
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
    const concPopups = () => [...document.querySelectorAll('.application.dialog')]
      .filter(el => el.textContent.includes('Concentration check'));

    // ================================================== 1. auto mode: the floor DC, and quiet good news
    let hpBefore;
    {
      const eff = await ensureConc();
      if (!eff) return { fatal: 'the fixture could not begin concentrating (cast refused?)' };
      await saveBonus('+30');
      await setTemp(500);
      hpBefore = shielder.system.attributes.hp.value;
      const t0 = marker();
      await smack(7);
      const askMsg = await waitFor(() => doneAskNew(t0));
      const ask = askMsg?.getFlag(MOD, 'concentration');
      ok('1. damage to a concentrating creature stamps an ask that auto-resolves',
        !!ask, ask ? '' : 'no resolved ask appeared');
      ok('1b. DC floors at 10 (7 damage)', ask?.dc === 10, `dc=${ask?.dc}`);
      ok('1c. the ask recorded the damage that caused it', ask?.damage === 7, `damage=${ask?.damage}`);
      ok('1d. the save succeeded and concentration held (+30 forced)',
        (ask?.outcome?.success === true) && (concEffects().length === 1),
        `success=${ask?.outcome?.success} effects=${concEffects().length}`);
      // The announcement posts AFTER the flag flips done — always waited for, never read
      // in the same breath (4d and 6c lost that race before this suite learned it).
      const holdsCard = await waitFor(() => contentNew(t0, 'holds'));
      ok('1e. the table is told, quietly: a public "holds" card',
        !!holdsCard && (holdsCard.whisper?.length === 0),
        holdsCard ? `whisper=${holdsCard.whisper?.length}` : 'no holds card');
      const rollMsg = ask?.outcome?.rollMessageId ? game.messages.get(ask.outcome.rollMessageId) : null;
      ok('1f. the roll carries the ask\'s DC as its target, and the card\'s own marking agrees',
        (rollMsg?.rolls?.[0]?.options?.target === 10) && (rollMsg?.rolls?.[0]?.isSuccess === true),
        `target=${rollMsg?.rolls?.[0]?.options?.target} isSuccess=${rollMsg?.rolls?.[0]?.isSuccess}`);
    }

    // ================================================== 2. the DC is half the damage…
    {
      const t0 = marker();
      await smack(31);
      const ask = (await waitFor(() => doneAskNew(t0)))?.getFlag(MOD, 'concentration');
      ok('2. DC is half the damage, floored (31 → 15)', ask?.dc === 15, `dc=${ask?.dc}`);
    }

    // ================================================== 3. …and caps at 30 under modern rules
    {
      const t0 = marker();
      await smack(70);
      const ask = (await waitFor(() => doneAskNew(t0)))?.getFlag(MOD, 'concentration');
      const expected = modern ? 30 : 35;
      ok(`3. DC ${modern ? 'caps at 30' : 'is uncapped (legacy)'} (70 damage → ${expected})`,
        ask?.dc === expected, `dc=${ask?.dc}`);
      ok('3b. temp-HP damage triggers the check (the pool absorbed all 70, real HP never moved)',
        (ask?.damage === 70) && (shielder.system.attributes.hp.value === hpBefore),
        `damage=${ask?.damage} hp=${shielder.system.attributes.hp.value} was=${hpBefore}`);
    }

    // ================================================== 4. failure breaks, and the cascade is native
    {
      await saveBonus('');
      const [dep] = await victim.createEmbeddedDocuments('ActiveEffect', [{
        name: 'BF Conc Dependent', img: 'icons/svg/aura.svg' }]);
      created.effects.push({ actorId: victim.id, id: dep.id });
      await concEffects()[0].addDependent(dep);
      const t0 = marker();
      await smack(70); // DC 30 vs a mortal modifier — deterministic failure
      const askMsg = await waitFor(() => doneAskNew(t0));
      const ask = askMsg?.getFlag(MOD, 'concentration');
      ok('4. a failed save is a failure (DC 30 forced)', ask?.outcome?.success === false,
        `success=${ask?.outcome?.success} total=${ask?.outcome?.total}`);
      const gone = await waitFor(() => concEffects().length === 0);
      ok('4b. the break is real: the concentration effect is gone', !!gone,
        `effects=${concEffects().length}`);
      const depGone = await waitFor(() => !victim.effects.get(dep.id));
      ok('4c. the dependent effect cascades away with it (native dependentOn)', !!depGone,
        depGone ? '' : 'dependent survived the break');
      // The break card posts after the whole endConcentration cascade — wait for it.
      const broke = await waitFor(() => contentNew(t0, 'loses concentration'));
      ok('4d. the table is told, loudly and in public',
        !!broke && (broke.whisper?.length === 0),
        broke ? `whisper=${broke.whisper?.length}` : 'no break card');
      // Not concentrating any more ⇒ further damage asks nothing.
      const t1 = marker();
      await smack(9);
      await sleep(1200);
      ok('4e. damage without concentration asks nothing', asksNew(t1).length === 0,
        `asks=${asksNew(t1).length}`);
    }

    // ================================================== 5. prompt mode: the popup, one control, the click
    {
      await set('concMode', 'prompt');
      await saveBonus('+30');
      const eff = await ensureConc();
      if (!eff) return { fatal: 'recast failed (slots?)' };
      await setTemp(500);
      const t0 = marker();
      await smack(12);
      const askMsg = await waitFor(() => asksNew(t0)[0]);
      await sleep(1500);
      const ask = askMsg?.getFlag(MOD, 'concentration');
      ok('5. prompt mode waits for a human (ask still pending, nothing auto-rolled)',
        !!askMsg && (ask?.status === 'pending'), `status=${ask?.status}`);
      const popup = await waitFor(() => concPopups()[0], 4000);
      ok('5b. the popup is on screen for whoever owns the decision', !!popup,
        popup ? '' : 'no popup found in DOM');
      const buttons = popup ? [...popup.querySelectorAll('footer button, .form-footer button')] : [];
      const labels = buttons.map(b => b.textContent.trim());
      ok('5c. the controls are the native dialog\'s: Adv/Normal/Dis + a situational bonus field',
        (labels.join('/') === 'Advantage/Normal/Disadvantage')
          && !!popup?.querySelector('input[name="bf-conc-bonus"]'),
        `buttons=[${labels.join('|')}] input=${!!popup?.querySelector('input[name="bf-conc-bonus"]')}`);
      buttons.find(b => b.textContent.trim() === 'Normal')?.click();
      const doneMsg = await waitFor(() => doneAskNew(t0));
      const done = doneMsg?.getFlag(MOD, 'concentration');
      ok('5d. the click rolls, the elect folds, the save holds',
        (done?.outcome?.success === true) && (concEffects().length === 1),
        `success=${done?.outcome?.success}`);
      const rollMsg = done?.outcome?.rollMessageId ? game.messages.get(done.outcome.rollMessageId) : null;
      ok('5e. the roll answers THIS ask (respondsTo channel)',
        !!askMsg && !!rollMsg && (rollMsg.getFlag(MOD, 'respondsTo') === askMsg.id),
        `respondsTo=${rollMsg?.getFlag(MOD, 'respondsTo')} ask=${askMsg?.id}`);
      await waitFor(() => concPopups().length === 0, 4000);
      ok('5f. the answered popup closed itself', concPopups().length === 0,
        `popups=${concPopups().length}`);

      // The situational bonus and the Advantage button must reach the actual dice. The save
      // bonus comes off so the +30 in the formula can only have come through the input.
      await saveBonus('');
      const t1 = marker();
      await smack(12);
      await waitFor(() => asksNew(t1)[0]);
      const popup2 = await waitFor(() => concPopups()[0], 4000);
      const input2 = popup2?.querySelector('input[name="bf-conc-bonus"]');
      if (input2) input2.value = '+30';
      [...(popup2?.querySelectorAll('footer button, .form-footer button') ?? [])]
        .find(b => b.textContent.trim() === 'Advantage')?.click();
      const done2 = await waitFor(() => doneAskNew(t1));
      const o2 = done2?.getFlag(MOD, 'concentration')?.outcome;
      const roll2 = (o2?.rollMessageId ? game.messages.get(o2.rollMessageId) : null)?.rolls?.[0];
      ok('5g. the situational bonus reaches the formula and Advantage reaches the d20',
        (roll2?.options?.advantageMode === 1) && /30/.test(roll2?.formula ?? '')
          && (o2?.success === true),
        `advMode=${roll2?.options?.advantageMode} formula=${roll2?.formula}`);
      await saveBonus('+30');
    }

    // ================================================== 6. the timer rolls — expiry is the dice, not a pass
    {
      await set('concTimer', 2);
      const t0 = marker();
      await smack(12);
      const askMsg = await waitFor(() => asksNew(t0)[0]);
      const pendingAsk = askMsg?.getFlag(MOD, 'concentration');
      ok('6. a timed ask carries its deadline', !!pendingAsk?.deadline && (pendingAsk?.window === 2),
        `window=${pendingAsk?.window}`);
      const done = await waitFor(() => doneAskNew(t0), 8000);
      const ask = done?.getFlag(MOD, 'concentration');
      ok('6b. the buzzer rolled the save itself and marked it',
        (ask?.status === 'done') && (ask?.outcome?.timedOut === true) && (ask?.outcome?.success === true),
        `timedOut=${ask?.outcome?.timedOut} success=${ask?.outcome?.success}`);
      const holdsCard = await waitFor(() => contentNew(t0, 'rolled by the timer'));
      ok('6c. the announcement says the timer pressed the button', !!holdsCard,
        holdsCard ? '' : 'no timer wording found');
      const roll6 = (ask?.outcome?.rollMessageId ? game.messages.get(ask.outcome.rollMessageId) : null)
        ?.rolls?.[0];
      ok('6d. the buzzer roll is straight — data-driven only, no ad-hoc inputs',
        roll6?.options?.advantageMode === 0,
        `advMode=${roll6?.options?.advantageMode}`);
      await set('concTimer', 0);
    }

    // ================================================== 7. multiple instances queue — RAW, one popup at a time
    {
      const t0 = marker();
      await smack(10);
      await waitFor(() => asksNew(t0).length === 1);
      await smack(11);
      await waitFor(() => asksNew(t0).length === 2);
      const [first, second] = asksNew(t0);
      ok('7. two damage instances are two asks', !!first && !!second && (first.id !== second.id),
        `asks=${asksNew(t0).length}`);
      if (first && second) {
        await sleep(1000);
        ok('7b. only the oldest ask has a popup (the queue)', concPopups().length === 1,
          `popups=${concPopups().length}`);
        [...(concPopups()[0]?.querySelectorAll('footer button, .form-footer button') ?? [])]
          .find(b => b.textContent.trim() === 'Normal')?.click();
        await waitFor(() => first.getFlag(MOD, 'concentration')?.status === 'done');
        const secondPopup = await waitFor(() => (concPopups().length === 1)
          && (second.getFlag(MOD, 'concentration')?.status === 'pending'), 5000);
        ok('7c. resolving the first advances the queue to the second', !!secondPopup,
          `popups=${concPopups().length} second=${second.getFlag(MOD, 'concentration')?.status}`);
        [...(concPopups()[0]?.querySelectorAll('footer button, .form-footer button') ?? [])]
          .find(b => b.textContent.trim() === 'Normal')?.click();
        await waitFor(() => second.getFlag(MOD, 'concentration')?.status === 'done');
        ok('7d. both asks resolved, concentration held through both',
          (second.getFlag(MOD, 'concentration')?.outcome?.success === true) && (concEffects().length === 1),
          `effects=${concEffects().length}`);
      } else {
        ok('7b-d. queue mechanics', false, 'skipped: the two asks never both appeared');
      }
    }

    // ================================================== 8. a sheet-rolled save is the answer
    {
      const t0 = marker();
      await smack(12);
      const askMsg = await waitFor(() => asksNew(t0)[0]);
      // The player ignores the popup and rolls from their sheet: no respondsTo, no target —
      // the fold must still catch it (actor + ability match, no originatingMessage).
      await shielder.rollConcentration({}, { configure: false }, {});
      const done = await waitFor(() => doneAskNew(t0));
      const ask = done?.getFlag(MOD, 'concentration');
      ok('8. the fold catches a bare sheet roll as the answer',
        !!askMsg && (ask?.status === 'done') && (ask?.outcome?.success === true),
        `status=${ask?.status} success=${ask?.outcome?.success}`);
      await waitFor(() => concPopups().length === 0, 4000);
      ok('8b. the sheet roll closes the popup too', concPopups().length === 0,
        `popups=${concPopups().length}`);
    }

    // ================================================== 9. the native whisper card: ours while on, native while off
    {
      await set('concMode', 'auto'); // prompt would leave the ask pending and the popup open
      const t0 = marker();
      await smack(9);
      await waitFor(() => doneAskNew(t0));
      await sleep(800);
      // Drain this section's own announcement before moving on: since the verdict pause
      // (v1.6.0) the holds card lands seconds after the fold, and an undrained PUBLIC one
      // leaks into section 10's window wearing the wrong whisper (bit 10c, 2026-08-16).
      await waitFor(() => contentNew(t0, 'holds'));
      ok('9. the native request card is suppressed while the mode is on',
        !contentNew(t0, 'data-action="concentration"'),
        'a native concentration request card leaked through');
      await set('concMode', 'off');
      const t1 = marker();
      await smack(9);
      const native = await waitFor(() => contentNew(t1, 'data-action="concentration"'), 5000);
      ok('9b. with the mode off the native card returns (kill-switch discipline)', !!native,
        native ? '' : 'no native card appeared with the module off');
      await sleep(800);
      ok('9c. and the module asks nothing while off', asksNew(t1).length === 0,
        `asks=${asksNew(t1).length}`);
    }

    // ================================================== 10. private visibility — and the break that never is
    {
      await set('concVisibility', false);
      await set('concMode', 'auto');
      // Let every EARLIER section's paused announcement land before this window opens —
      // since the verdict pause, a public holds card can trail its fold by seconds and
      // leak into the next section's observation wearing the wrong whisper.
      await sleep(3500);
      const t0 = marker();
      await smack(12);
      const done = await waitFor(() => doneAskNew(t0));
      const ask = done?.getFlag(MOD, 'concentration');
      const rollMsg = ask?.outcome?.rollMessageId ? game.messages.get(ask.outcome.rollMessageId) : null;
      // The announcement posts after the verdict pause — wait for it, and attribute it by
      // THIS ask's own total-vs-DC signature, never by 'holds' alone.
      const sig = `${ask?.outcome?.total} vs DC ${ask?.dc}`;
      const holdsCard = await waitFor(() => newSince(t0).find(m =>
        (m.speaker?.alias === 'Battle Flow') && m.content.includes('holds')
        && m.content.includes(sig)) ?? null, 15000);
      ok('10. private mode whispers the ask', (done?.whisper?.length ?? 0) > 0,
        `whisper=${done?.whisper?.length}`);
      ok('10b. private mode whispers the roll', (rollMsg?.whisper?.length ?? 0) > 0,
        `whisper=${rollMsg?.whisper?.length}`);
      ok('10c. private mode whispers the good news', (holdsCard?.whisper?.length ?? 0) > 0,
        `whisper=${holdsCard?.whisper?.length}`);
      // The break is never private: the cascade strips icons the whole table can see.
      await saveBonus('');
      const t1 = marker();
      await smack(70);
      await waitFor(() => doneAskNew(t1));
      const broke = await waitFor(() => newSince(t1).find(m =>
        (m.speaker?.alias === 'Battle Flow') && m.content.includes('loses concentration')));
      ok('10d. the break card is public even in private mode',
        !!broke && (broke.whisper?.length === 0), `whisper=${broke?.whisper?.length}`);
      await set('concVisibility', true);
    }

    // ================================================== 11. break-on-failure off: announce, touch nothing
    {
      await set('concBreak', false);
      const eff = await ensureConc();
      if (!eff) return { fatal: 'recast failed (slots?)' };
      await setTemp(500);
      const t0 = marker();
      await smack(70); // still bonus-less: deterministic failure
      const done = await waitFor(() => doneAskNew(t0));
      const ask = done?.getFlag(MOD, 'concentration');
      const card = await waitFor(() => contentNew(t0, 'Breaking is off'));
      ok('11. with breaking off the failure is announced but nothing is ended',
        (ask?.outcome?.success === false) && (concEffects().length === 1) && !!card,
        `success=${ask?.outcome?.success} effects=${concEffects().length} card=${!!card}`);
      await set('concBreak', true);
      await saveBonus('+30');
    }

    // ================================================== 12. the cause rides the real chain
    {
      await set('autoDamage', 'all');
      await set('autoApply', true);
      if (canvas.scene?.id !== scene.id) await scene.view();
      // The range keeps standing fixture tokens — use the shielder's if it is linked (a
      // duplicate would be litter), create one only when it is missing.
      let tokenDoc = scene.tokens.find(t => (t.actorId === shielder.id) && t.actorLink);
      if (!tokenDoc) {
        [tokenDoc] = await scene.createEmbeddedDocuments('Token', [
          foundry.utils.mergeObject(shielder.prototypeToken.toObject(),
            { x: 1000, y: 1400, actorId: shielder.id, actorLink: true }, { inplace: false })]);
        created.tokens.push(tokenDoc.id);
      }
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(tokenDoc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(tokenDoc.id);
      if (!token) return { fatal: 'shielder token never reached the canvas' };
      // Flat AC 1 + advantage = a deterministic hit shy of a double fumble.
      await shielder.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });
      const npcItem = npc.items.find(i => i.system.activities?.some?.(a => a.type === 'attack'));
      const activity = npcItem?.system.activities.find(a => a.type === 'attack');
      if (!activity) return { fatal: 'BF Test Attacker has no attack activity' };
      // The attacker's name AS THE TABLE SEES IT: the speaker resolves through the actor's
      // scene token when one stands on the range (the fixture's prototype token is named
      // "Hobgoblin"), and an unlinked token's synthetic actor carries the token's name.
      // The first run of this suite expected npc.name and learned better.
      const npcTokenDoc = scene.tokens.find(t => t.actorId === npc.id);
      const expectedAttacker = npcTokenDoc
        ? (npcTokenDoc.actorLink ? npc.name : npcTokenDoc.name) : npc.name;
      log.push(`expected attacker name at the table: ${expectedAttacker}`);
      let ask = null; let t0 = null;
      for (let attempt = 0; attempt < 2 && !ask; attempt++) {
        t0 = marker();
        token.setTarget(true, { releaseOthers: true });
        await sleep(80);
        const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
        const usageId = results?.message?.id ?? null;
        const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
          usageId ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
        if (rolls?.[0]?.isFumble) { log.push('12: fumble, retrying'); continue; }
        ask = (await waitFor(() => doneAskNew(t0), 10_000))?.getFlag(MOD, 'concentration');
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
      await set('autoDamage', 'off');
      await set('autoApply', false);
    }

    // ================================================== 13. a sheet edit is damage too — then zero HP is not a save
    {
      await set('concMode', 'auto');
      const eff = concEffects()[0] ?? await ensureConc();
      if (!eff) return { fatal: 'recast failed (slots?)' };
      // Lowering HP by hand IS damage to the system (onUpdateHP has no idea about sheets),
      // so the module checks concentration for it — a feature, and this section's setup:
      // the edit's own ask must resolve (+30 holds it) before the zero-HP half measures.
      const tSetup = marker();
      await shielder.update({
        'system.attributes.hp.value': 5, 'system.attributes.hp.temp': 0,
        'system.attributes.ac.calc': priorActor[shielder.id]['system.attributes.ac.calc'],
        'system.attributes.ac.flat': priorActor[shielder.id]['system.attributes.ac.flat'] });
      const setupAsk = await waitFor(() => doneAskNew(tSetup));
      ok('13. a GM hand-lowering HP on a concentrator raises the check too',
        !!setupAsk && (setupAsk.getFlag(MOD, 'concentration')?.outcome?.success === true),
        setupAsk ? '' : 'no ask from the sheet edit');
      const t0 = marker();
      await smack(50);
      const gone = await waitFor(() => concEffects().length === 0);
      ok('13b. dropping to 0 ends concentration with no save', !!gone,
        `effects=${concEffects().length}`);
      await sleep(1200);
      ok('13c. no ask was stamped at 0 — there was nothing to roll', asksNew(t0).length === 0,
        `asks=${asksNew(t0).length}`);
      const card = await waitFor(() => contentNew(t0, 'no save at 0 HP'));
      ok('13d. the break card says why (down, not a failed roll)',
        !!card && (card.whisper?.length === 0), card ? '' : 'no down-wording card');
      await healFull();
    }
  } catch (err) {
    ok('SUITE', false, `unhandled: ${err?.message}\n${err?.stack}`);
  } finally {
    await teardown();
    for (const a of [shielder, victim, npc].filter(Boolean)) {
      try { await a.longRest?.({ dialog: false, chat: false }); } catch { /* fine */ }
    }
  }

  return { results, log, skips };
}, null);

if (out.fatal) {
  console.error(`\n[conc] FATAL: ${out.fatal}`);
  for (const r of out.results ?? []) console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.name}`);
  process.exit(2);
}
for (const l of out.log) console.log(`  ${l}`);
console.log('');
let failures = 0;
for (const r of out.results) {
  if (!r.pass) failures++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.pass ? '' : ` — ${r.detail}`}`);
}
for (const s of out.skips ?? []) console.log(`  SKIP ${s}`);
console.log(`\n[conc] ${out.results.length - failures}/${out.results.length} passed`);
process.exit(failures ? 1 : 0);
