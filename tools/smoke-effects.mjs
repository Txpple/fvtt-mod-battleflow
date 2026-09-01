// Battle Flow Phase 1.9 smoke test — effect riders, mastery riders, the Use/Pass ask, the
// topple fold + its timer, and the reminders, driven end to end in the live world.
// (The per-source suppression sections died with the machinery at v1.10.0 — the preflight
// now FAILS if any suppress* setting is still registered, the reverse of the old ghost.)
//
// Harness discipline (HANDOFF): every setting touched is restored to whatever was found;
// every message this run creates is deleted on the way out; BF Test fixtures are long-rested
// (they spend real HP and real slots); HP is topped up before any "did not move" assertion
// (a number that could not have moved proves nothing); damage searches go by originating id
// over the WHOLE log, never a tail window.
//
// Sections (PLAN 1.1): `--section 14`, `--section 1,10`, `--list`. Fixtures and teardown
// ALWAYS run; only the numbered assertion blocks are skippable.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

const SECTIONS = {
  1: 'the mastery flag stamp (PLAN E1)',
  2: 'Vex pays on damage dealt (auto)',
  3: 'the damage gate: immune ⇒ no Vex, Sap anyway',
  4: 'refresh, never stack',
  5: 'ask mode: Slow asks, Use pays',
  6: 'the timer expires to Pass',
  7: 'Topple: the enricher save + prone',
  8: 'Topple hopeless skip: already prone',
  9: 'Push in AUTO mode (the un-spot-checked path)',
  10: 'Graze pays the mod on a MISS',
  11: 'spell effect riders (1.9A)',
  12: 'effect revert: delete + tolerate gone',
  13: 'every use shows its first card (v1.10.0)',
  14: 'the Topple card folds its own save',
  15: 'the reminders (vex / sap / cleave)',
  16: "the 2026-08-18 session's fixes (v1.15.0)",
  17: 'the Cleave arm (v1.19.0, FLOW item 8)'
};
// §§12 and 13 are written INSIDE §11's block — they reuse the spell it found by shape, which
// is the expensive part — so they name it. Everything else stands its own fixtures up.
const DEPENDS = { 12: ['11'], 13: ['11'] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
// Roughly a dozen full attack chains with polls between them; a suite that dies at the
// watchdog reports nothing, so the ceiling is generous.
const f = await connectSuite({ tag: 'effects', watchdogMs: 600_000 });
announcePlan('effects', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const skip = why => skips.push(why);
  // The section gate — see tools/harness.mjs. This closure is serialized into the page, so the
  // plan and the titles arrive as DATA and the predicate is spelled out here.
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const suiteStart = Date.now();

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  for (const key of ['effectRiders', 'masteryRiders', 'masteryAsk', 'noticeTimer', 'castApply']) {
    if (!game.settings.settings.has(`${MOD}.${key}`)) {
      return { fatal: `setting ${key} not registered — this client is running OLD code (F5)` };
    }
  }
  if (game.settings.settings.has(`${MOD}.suppressAttackCards`)) {
    return { fatal: 'suppressAttackCards is registered — this client is running PRE-RIP code (F5)' };
  }

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'riders', 'effectRiders', 'masteryRiders',
    'masteryAsk', 'holdTimer', 'saveTimer', 'castApply'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const shielder = game.actors.getName('BF Test Shielder');
  let pc = game.actors.getName('BF Test PC Attacker');
  const npc = game.actors.getName('BF Test Attacker');
  let priorBlade = null; // the blade's run-start mastery — setMastery mutates it per section
  if (!scene || !victim || !npc) return { fatal: 'missing fixture: scene or BF Test actors' };

  const created = { items: [], effects: [], tokens: [] };
  const priorActor = {};
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    // ⚠ SETTINGS FIRST, in their own guard — a cleanup error later in this sequence must
    // never leave the table wearing suite settings (bit live 2026-08-17). The user's
    // config is sacred; the rest is best-effort.
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      // ⚠ Batched deletes per collection — a synthetic actor rebuilds its collections from
      // the delta on every write, so a one-at-a-time loop deletes already-dropped documents.
      for (const [actorId, ids] of Object.entries(created.effects.reduce((m, e) => {
        (m[e.actorId] ??= []).push(e.id); return m;
      }, {}))) {
        const a = game.actors.get(actorId);
        const live = ids.filter(id => a?.effects.get(id));
        if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live);
      }
      // Mastery/rider effects the MODULE created land outside `created` — sweep every BF
      // fixture for module-flagged and known-name chips, plus prone.
      // ⚠ Restore the blade's mastery FIRST: setMastery mutates the persistent PC's
      // weapon per section and an aborted run leaves the LAST section's key in place —
      // two 2026-08-19 aborts at section 11 left it on 'graze', and smoke-hold's windowed
      // misses then paid a deterministic -3 to its stand-in. The mutation must never
      // outlive the run.
      if (priorBlade && pc) {
        await pc.items.get(priorBlade.id)?.update({ 'system.mastery': priorBlade.mastery });
      }
      for (const a of [victim, shielder, pc, npc].filter(Boolean)) {
        const strays = a.effects.filter(e => e.getFlag(MOD, 'mastery')
          || ['Vexed', 'Sapped', 'Slowed', 'Reduced Movement'].includes(e.name)
          || e.getFlag(MOD, 'reactionEffect')
          || e.getFlag(MOD, 'applied'));
        if (strays.length) await a.deleteEmbeddedDocuments('ActiveEffect', strays.map(e => e.id));
        if (a.statuses?.has?.('prone')) await a.toggleStatusEffect('prone', { active: false });
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
      // Sweep this run's own chat: everything since suiteStart that is ours — fixture
      // speakers, the module's announcement alias, or a module flag.
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
    // ⚠ 0 for the classic topple sections (§14 forces outcomes through chained rolls and
    // must never race a buzzer); §14g pins its own short window and restores this.
    await set('saveTimer', 0);
    await set('castApply', false); // the cast slice has its own suite; isolation here

    // -------------------------------------------------- fixtures
    // A character-type attacker (masteries are PC-only). Created once by smoke-battleflow;
    // make it here if absent so this suite stands alone.
    if (!pc) {
      const weapon = npc.items.find(i => i.system.activities?.some?.(a => a.type === 'attack'));
      pc = await Actor.create({ name: 'BF Test PC Attacker', type: 'character',
        items: weapon ? [weapon.toObject()] : [] });
      log.push('created BF Test PC Attacker');
    }

    // A 2024 weapon with a mastery, found by SHAPE (type weapon + mastery + attack activity)
    // — names and packs shift; the shape is the requirement (the smoke-riders lesson).
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

    // Mastery eligibility is trait + weapon (weapon.mjs:327): the actor must have mastery
    // with this base weapon. Grant it, restore whatever was there.
    priorActor[pc.id] = {
      'system.traits.weaponProf.mastery.value':
        Array.from(pc.system._source.traits?.weaponProf?.mastery?.value ?? []),
      'system.abilities.str.value': pc.system._source.abilities?.str?.value ?? 10,
      'system.abilities.dex.value': pc.system._source.abilities?.dex?.value ?? 10,
    };
    // Positive ability mods, or Graze (flat mod damage) has nothing to pay.
    await pc.update({
      'system.traits.weaponProf.mastery.value': [blade.system.type.baseItem],
      'system.abilities.str.value': 16,
      'system.abilities.dex.value': 16,
    });

    const setMastery = async key => {
      await pc.items.get(blade.id).update({ 'system.mastery': key });
    };

    // Linked victim token (PLAN F: linked for ownership-sensitive assertions; the base actor
    // IS the token actor, so uuids and HP reads are unambiguous).
    if (canvas.scene?.id !== scene.id) await scene.view();
    const [victimTokenDoc] = await scene.createEmbeddedDocuments('Token', [
      foundry.utils.mergeObject(victim.prototypeToken.toObject(),
        { x: 1400, y: 1400, actorId: victim.id, actorLink: true }, { inplace: false })]);
    created.tokens.push(victimTokenDoc.id);
    for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(victimTokenDoc.id)); i++) await sleep(250);
    const victimToken = canvas.tokens.get(victimTokenDoc.id);
    if (!victimToken) return { fatal: 'victim token never reached the canvas' };

    priorActor[victim.id] = {
      'system.attributes.ac.calc': victim.system._source.attributes.ac.calc,
      'system.attributes.ac.flat': victim.system._source.attributes.ac.flat,
      'system.traits.di.value': Array.from(victim.system._source.traits?.di?.value ?? []),
    };
    const acFlat = async n => victim.update({
      'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': n });
    const healFull = async () => victim.update({
      'system.attributes.hp.value': victim.system.attributes.hp.max,
      'system.attributes.hp.temp': 0 });

    // -------------------------------------------------- the one attack helper
    // use() with subsequentActions:false, then an explicit rollAttack with the originating
    // id stamped — the exact deterministic idiom the Phase 1 suite uses. `origin:false`
    // leaves the id off, which is the SUPPRESSED-card reality (no card, no DOM click, no
    // flag) — the chain then rides the attack-message fallback.
    const attack = async (activity, { advantage = true, disadvantage = false, origin = true } = {}) => {
      victimToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      // ⚠ `undefined` means the USE ITSELF was refused (no slot, no uses) — a totally
      // different fact from "the card was suppressed" (results exist, message vetoed).
      // Conflating them once sent a suite chasing suppression bugs that were empty slot
      // pools (the smoke-battleflow 5b lesson, learned again by this suite's first run).
      if (results === undefined) return { failed: true, usageId: null, attackMsg: null, roll: null };
      const usageId = results?.message?.id ?? null;
      const rolls = await activity.rollAttack(
        { advantage, disadvantage },
        { configure: false },
        (origin && usageId) ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
      const attackMsg = rolls?.[0]?.parent ?? null;
      return { usageId, attackMsg, roll: rolls?.[0] ?? null };
    };
    const pcAttack = () => pc.items.get(blade.id).system.activities.find(a => a.type === 'attack');
    const waitDamage = async (originId, { flag = null, timeout = 10_000 } = {}) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) {
        const m = game.messages.contents.find(x =>
          (x.getFlag('dnd5e', 'roll.type') === 'damage')
          && (x.getFlag('dnd5e', 'originatingMessage') === originId)
          && (!flag || x.getFlag(MOD, flag)));
        if (m) return m;
        await sleep(250);
      }
      return null;
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
    // Clear chips between scenarios so "the effect landed" always means THIS attack landed it.
    // Up here rather than inside §2 where it was written: every section from §3 on calls it.
    const clearChips = async () => {
      const chips = victim.effects.filter(e => e.getFlag(MOD, 'mastery')
        || ['Vexed', 'Sapped', 'Slowed', 'Reduced Movement'].includes(e.name));
      if (chips.length) await victim.deleteEmbeddedDocuments('ActiveEffect', chips.map(e => e.id));
    };
    // The id-set watermark idiom, up here with the other helpers rather than inside §14 where
    // it was written: §§15 and 16 read it too, so a block-scoped `const` under the section
    // gate would put it out of their reach. The `14` suffix records where it was born.
    const snap14 = () => new Set(game.messages.contents.map(m => m.id));
    const fresh14 = before => game.messages.contents.filter(m => !before.has(m.id));
    const until14 = async (fn, ms = 8000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(200); }
      return fn();
    };

    // ================================================== 1. the mastery flag stamp (PLAN E1)
    if (want(1)) {
      await acFlat(1);
      await healFull();
      await setMastery('vex');
      {
        const { attackMsg, roll } = await attack(pcAttack());
        ok('1. a mastery PC attack stamps flags.dnd5e.roll.mastery',
          attackMsg?.getFlag('dnd5e', 'roll.mastery') === 'vex',
          `flag=${attackMsg?.getFlag('dnd5e', 'roll.mastery')} fumble=${roll?.isFumble}`);
        // Wait for the RECEIPT, not merely the damage message: the receipt is stamped after
        // application finishes, so this is the pipeline-quiescence marker. Section 2 heals and
        // asserts HP-dependent payouts — an application still in flight from here would drain
        // the healed pool underneath it and the dead-skip would eat the payout.
        await waitDamage(attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id, { flag: 'receipt' });
        await sleep(600); // payout tail (the mastery stage runs after the receipt)
      }
      {
        const activity = npc.items.find(i => i.system.activities?.some?.(a => a.type === 'attack'))
          ?.system.activities.find(a => a.type === 'attack');
        const { attackMsg } = await attack(activity);
        ok('1b. a non-mastery (NPC) attack stamps nothing',
          !attackMsg?.getFlag('dnd5e', 'roll.mastery'),
          `flag=${attackMsg?.getFlag('dnd5e', 'roll.mastery')}`);
        await waitDamage(attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id, { flag: 'receipt' });
        await sleep(600);
      }
    }

    // ================================================== 2. Vex pays on damage dealt (auto)
    if (want(2)) {
      await healFull();
      await clearChips();
      {
        const { attackMsg, roll } = await attack(pcAttack());
        const vexed = await waitFor(() => victim.effects.find(e => (e.getFlag(MOD, 'mastery') === 'vex') && !e.disabled), 12_000);
        ok('2. Vex (auto): damage dealt ⇒ Vexed chip with the weapon as origin',
          !!vexed && (vexed.origin === pc.items.get(blade.id).uuid),
          `vexed=${!!vexed} origin=${vexed?.origin} fumble=${roll?.isFumble}`);
        // The chip proves the payout ran, so the receipt hunt starts AFTER it — waiting for
        // the damage message first flaked once when the chain ran slow and the 10s window
        // expired an instant before everything landed at once.
        const dmg = await waitDamage(attackMsg.getFlag('dnd5e', 'originatingMessage'), { flag: 'effectReceipt' });
        const receipt = dmg?.getFlag(MOD, 'effectReceipt');
        ok('2b. the Vexed chip joins the effect receipt',
          !!receipt?.targets?.some(t => (t.uuid === victim.uuid)
            && t.effects.some(e => e.id === vexed?.id)),
          JSON.stringify(receipt?.targets?.map(t => ({ uuid: t.uuid, effects: t.effects }))));
      }
    }

    // ================================================== 3. the damage gate: immune ⇒ no Vex, Sap anyway
    if (want(3)) {
      await clearChips();
      await healFull();
      {
        const weaponTypes = new Set([
          ...(pc.items.get(blade.id).system.damage?.base?.types ?? []),
          ...((pcAttack()?.damage?.parts ?? []).flatMap(p => [...(p.types ?? [])])),
        ]);
        if (!weaponTypes.size) {
          skip('immunity gate: weapon deals no typed damage');
        } else {
          await victim.update({ 'system.traits.di.value': [...weaponTypes] });
          const hpBefore = victim.system.attributes.hp.value;
          const { attackMsg } = await attack(pcAttack());
          const dmg = await waitDamage(attackMsg.getFlag('dnd5e', 'originatingMessage'), { flag: 'receipt' });
          const entry = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid);
          const vexed = victim.effects.find(e => (e.getFlag(MOD, 'mastery') === 'vex') && !e.disabled);
          ok('3. immune target: pool full, took 0, and NO Vex (the damage gate)',
            (hpBefore === victim.system.attributes.hp.max) && (entry?.taken === 0) && !vexed,
            `hp=${hpBefore}/${victim.system.attributes.hp.max} taken=${entry?.taken} vexed=${!!vexed}`);

          await setMastery('sap');
          const second = await attack(pcAttack());
          await waitDamage(second.attackMsg.getFlag('dnd5e', 'originatingMessage'), { flag: 'receipt' });
          const sapped = await waitFor(() => victim.effects.find(e => (e.getFlag(MOD, 'mastery') === 'sap') && !e.disabled));
          ok('3b. Sap lands on the same immune target (hit is enough — no damage gate)',
            !!sapped, `sapped=${!!sapped}`);
          await victim.update({ 'system.traits.di.value': priorActor[victim.id]['system.traits.di.value'] });
        }
      }
    }

    // ================================================== 4. refresh, never stack
    if (want(4)) {
      await clearChips();
      await healFull();
      await setMastery('sap');
      {
        // ⚠ RETRY UNTIL IT LANDS, because this section needs TWO hits and `attack()` rolls
        // ONCE. Sap has no damage gate — a hit is enough (§3b) — so a MISS leaves no chip at
        // all, and `count=0` then fails an assertion whose whole subject is "one chip, not
        // two". That is not the module stacking a twin; it is a d20. It happened on the
        // battery of 2026-08-24 and cost a full re-run to disprove. Every other fold suite in
        // this tree retries for exactly this reason; this one was the last that did not.
        //
        // ⚠ NO DAMAGE MESSAGE IS THE MISS TEST, and it is free: the resolver drives damage
        // only on a hit, so `waitDamage` coming back empty IS the miss. Four tries with
        // advantage is past the point where another one means anything but a broken fixture.
        const hit = async () => {
          for ( let i = 0; i < 4; i++ ) {
            const r = await attack(pcAttack());
            const dmg = await waitDamage(r.attackMsg?.getFlag('dnd5e', 'originatingMessage'),
              { flag: 'receipt' });
            if (dmg) return true;
            log.push(`§4: the swing missed — rolling again (${i + 1}/4)`);
          }
          return false;
        };
        const landed = (await hit()) && (await waitFor(() =>
          victim.effects.find(e => e.getFlag(MOD, 'mastery') === 'sap'))) && (await hit());
        if (!landed) {
          // ⚠ SKIP OUT LOUD RATHER THAN ASSERT ON A SWING THAT NEVER CONNECTED. Four misses in
          // a row with advantage is a fixture problem — the wrong AC, the wrong weapon — and
          // saying THAT is useful, where "count=0" sends the next reader into mastery.js.
          skip('4: four swings with advantage never landed — that is the fixture, not the code');
        } else {
          await sleep(1000);
          const saps = victim.effects.filter(e => (e.getFlag(MOD, 'mastery') === 'sap') && !e.disabled);
          ok('4. a second hit re-clocks the chip instead of stacking a twin', saps.length === 1,
            `count=${saps.length}`);
        }
      }
    }

    // ================================================== 5. ask mode: Slow asks, Use pays
    if (want(5)) {
      await clearChips();
      await healFull();
      await set('masteryAsk', 'ask');
      await setMastery('slow');
      {
        // Bounded retry — a nat-1 miss stamps no ask and flaked this section (2026-08-20).
        let attackMsg = null, m = null;
        for (let try5 = 0; (try5 < 4) && !m; try5++) {
          ({ attackMsg } = await attack(pcAttack()));
          await waitDamage(attackMsg.getFlag('dnd5e', 'originatingMessage'), { flag: 'receipt' });
          m = await waitFor(() => {
            const flag = game.messages.get(attackMsg.id)?.getFlag(MOD, 'mastery');
            return (flag?.status === 'pending') ? flag : null;
          });
        }
        ok('5. ask mode stamps a pending mastery ask on the attack message',
          (m?.key === 'slow') && (m?.status === 'pending'),
          JSON.stringify({ key: m?.key, status: m?.status }));

        // The popup is on THIS client (the bridge answers for an unowned PC). Exactly two
        // controls, Use and Pass — the two-control rule is binding (HANDOFF standing item 3).
        // ⚠ Count the FOOTER's action buttons only: DialogV2's window frame carries its own
        // [data-action] controls (toggleControls, close), which are chrome, not answers.
        const dialog = await waitFor(() => {
          for (const el of document.querySelectorAll('.application.dialog')) {
            const actions = [...el.querySelectorAll('.form-footer button[data-action]')].map(b => b.dataset.action);
            if (actions.includes('use') && actions.includes('pass')) return el;
          }
          return null;
        });
        const actions = dialog ? [...dialog.querySelectorAll('.form-footer button[data-action]')].map(b => b.dataset.action) : [];
        ok('5b. the popup offers exactly Use/Pass', dialog && (actions.length === 2)
          && actions.includes('use') && actions.includes('pass'), `actions=${actions.join(',')}`);

        dialog?.querySelector('button[data-action="use"]')?.click();
        const slowed = await waitFor(() => victim.effects.find(e => (e.getFlag(MOD, 'mastery') === 'slow') && !e.disabled));
        const done = await waitFor(() => {
          const flag = game.messages.get(attackMsg.id)?.getFlag(MOD, 'mastery');
          return (flag?.status === 'done') ? flag : null;
        });
        const walkNow = victim.system.attributes.movement.walk;
        const walkBase = victim.system._source.attributes?.movement?.walk
          ?? (walkNow + (slowed ? 10 : 0));
        ok('5c. Use pays out: Slowed chip, −10 speed, ask resolved "used"',
          !!slowed && (done?.outcome === 'used') && (walkNow === Math.max(0, walkBase - 10)),
          `slowed=${!!slowed} outcome=${done?.outcome} walk=${walkNow} (base ${walkBase})`);
        ok('5d. the popup closed once the answer landed',
          await waitFor(() => !document.querySelector('.application.dialog button[data-action="use"]')) !== null,
          'a Use/Pass dialog is still open');
      }
    }

    // ================================================== 6. the timer expires to Pass
    if (want(6)) {
      await clearChips();
      await healFull();
      await set('holdTimer', 2);
      {
        const { attackMsg } = await attack(pcAttack());
        await waitDamage(attackMsg.getFlag('dnd5e', 'originatingMessage'), { flag: 'receipt' });
        const pending = await waitFor(() => {
          const flag = game.messages.get(attackMsg.id)?.getFlag(MOD, 'mastery');
          return (flag?.status === 'pending') ? flag : null;
        });
        const done = await waitFor(() => {
          const flag = game.messages.get(attackMsg.id)?.getFlag(MOD, 'mastery');
          return (flag?.status === 'done') ? flag : null;
        }, 8000);
        const slowed = victim.effects.find(e => (e.getFlag(MOD, 'mastery') === 'slow') && !e.disabled);
        ok('6. an unanswered ask times out to Pass and pays nothing',
          !!pending?.deadline && (done?.answer === 'pass') && done?.timedOut
          && (done?.outcome === 'timed out') && !slowed,
          JSON.stringify({ deadline: !!pending?.deadline, answer: done?.answer,
            timedOut: done?.timedOut, outcome: done?.outcome, slowed: !!slowed }));
        // Close the popup the timeout orphaned, if the close hook missed it.
        document.querySelectorAll('.application.dialog button[data-action="pass"]').forEach(b => b.click());
      }
      await set('holdTimer', 0);
    }

    // ================================================== 7. Topple: the enricher save + prone
    if (want(7)) {
      await clearChips();
      await healFull();
      await set('masteryAsk', 'auto');
      await setMastery('topple');
      {
        if (victim.statuses?.has?.('prone')) await victim.toggleStatusEffect('prone', { active: false });
        const before = game.messages.size;
        const { attackMsg, roll } = await attack(pcAttack());
        // vs AC 1 with advantage only a nat-1 fumble misses (1/400) — and a miss legitimately
        // pays no Topple, so report the flake as a flake (the house pattern), not a failure.
        if (roll?.isFumble) {
          skip('topple: nat-1 fumble missed outright (flake, 1/400) — hit path not exercised');
        } else {
        await waitDamage(attackMsg.getFlag('dnd5e', 'originatingMessage'), { flag: 'receipt' });
        const card = await waitFor(() => game.messages.contents.slice(before).find(m => m.getFlag(MOD, 'topple')));
        const dc = 8 + (pc.system.attributes?.prof ?? 0)
          + (pc.system.abilities?.[pcAttack().ability || 'str']?.mod ?? 0);
        ok('7. Topple (auto) posts the save card with the computed DC in the enricher',
          !!card && card.content.includes(`dc=${dc}`) && card.content.includes('ability=con'),
          `dc expected ${dc}; content has: ${card?.content?.match(/\[\[\/save[^\]]*\]\]/)?.[0] ?? 'no enricher'}`);

        // The GM prone affordance: a real DOM click on the card's button — selected by its
        // label, because the [[/save]] enricher renders its own clickable element in the card.
        const button = await waitFor(() =>
          [...document.querySelectorAll(`[data-message-id="${card?.id}"] button`)]
            .find(b => /prone/i.test(b.textContent)));
        button?.click();
        const prone = await waitFor(() => victim.statuses?.has?.('prone'));
        const flagDone = game.messages.get(card?.id)?.getFlag(MOD, 'topple')?.targets?.every(t => t.done);
        ok('7b. the card\'s prone button really knocks the target prone',
          !!prone && !!(await waitFor(() => game.messages.get(card?.id)?.getFlag(MOD, 'topple')?.targets?.every(t => t.done))),
          `prone=${!!prone} done=${flagDone}`);
        // v1.11.0 (finding ⑤): the pressed chip names WHO pressed it — the attacker rides
        // the topple stamp and lands as the effect's origin, on the GM-button path here.
        const proneEffect7 = victim.effects.find(e => e.statuses?.has?.('prone'));
        ok('7c. the pressed Prone names its source — the attacker',
          proneEffect7?.origin === pc.uuid,
          `origin=${proneEffect7?.origin ?? 'none'} attacker=${pc.uuid}`);
        await victim.toggleStatusEffect('prone', { active: false });
        }
      }
    }

    // ================================================== 8. Topple hopeless skip: already prone
    if (want(8)) {
      {
        await victim.toggleStatusEffect('prone', { active: true });
        const before = game.messages.size;
        const { attackMsg } = await attack(pcAttack());
        await waitDamage(attackMsg.getFlag('dnd5e', 'originatingMessage'), { flag: 'receipt' });
        await sleep(1200);
        const card = game.messages.contents.slice(before).find(m => m.getFlag(MOD, 'topple'));
        ok('8. a target already prone is never asked about Topple', !card, `card=${!!card}`);
        await victim.toggleStatusEffect('prone', { active: false });
      }
    }

    // ================================================== 9. Push in AUTO mode (the un-spot-checked path)
    if (want(9)) {
      await clearChips();
      await healFull(); // a dead target is skipped by design — the pool must be able to pay
      await setMastery('push');
      {
        const before = game.messages.size;
        const { attackMsg } = await attack(pcAttack());
        await waitDamage(attackMsg.getFlag('dnd5e', 'originatingMessage'), { flag: 'receipt' });
        // ⚠ Match the ANNOUNCEMENT's eyebrow, not /push/i — the native usage card prints the
        // mastery name in its subtitle ("Simple Melee • Push") and matched first.
        const cards = await waitFor(() => {
          const found = game.messages.contents.slice(before)
            .filter(m => (m.content ?? '').includes('Weapon Mastery — Push'));
          return found.length ? found : null;
        });
        // Exactly ONE card — a doubled announcement means two clients both believed they were
        // the single-writer elect (two pages logged in as one GM user — a harness topology
        // this world can produce; the module's elect is per-user, not per-page).
        ok('9. Push (auto) announces the option exactly once and moves nothing',
          (cards?.length === 1) && /10 feet/.test(cards[0].content),
          `cards=${cards?.length ?? 0}`);
      }
    }

    // ================================================== 10. Graze pays the mod on a MISS
    if (want(10)) {
      await clearChips();
      await healFull();
      await setMastery('graze');
      {
        await acFlat(40);
        const mod = pc.system.abilities?.[pcAttack().ability || 'str']?.mod ?? 0;
        const hpBefore = victim.system.attributes.hp.value;
        const { attackMsg, roll } = await attack(pcAttack(), { advantage: false, disadvantage: true });
        if (roll?.isCritical) {
          skip('graze: nat-20 crit hit vs AC 40 (flake, 1/400) — miss path not exercised');
        } else {
          const receipted = await waitFor(() =>
            game.messages.get(attackMsg.id)?.getFlag(MOD, 'receipt'), 10_000);
          const entry = receipted?.targets?.find(t => t.uuid === victim.uuid);
          const hpAfter = victim.system.attributes.hp.value;
          ok('10. Graze: the miss pays exactly the ability mod, receipted on the ATTACK card',
            (entry?.taken === mod) && (entry?.note ?? '').includes('Graze')
            && (hpAfter === hpBefore - mod) && (hpBefore === victim.system.attributes.hp.max),
            JSON.stringify({ mod, taken: entry?.taken, note: entry?.note, hpBefore, hpAfter }));
        }
        await acFlat(1);
      }
    }

    // ================================================== 11. spell effect riders (1.9A)
    if (want(11)) {
      await clearChips();
      await healFull();
      // An attack-roll spell whose ATTACK ACTIVITY carries effects, found by shape.
      // ⚠ Item-level effects are not enough: the usage card's system.effects comes from the
      // USED activity's applicableEffects, so a spell whose effect rides a utility activity
      // (Alter Self) produces an attack card with no effects at all — correctly suppressed,
      // wrongly failing a carve-out assertion built on it.
      const attackWithEffects = i => i.system.activities?.some?.(a =>
        (a.type === 'attack') && a.effects?.length);
      const findSpell = async ({ concentration }) => {
        const owned = [...pc.items, ...(shielder?.items ?? [])].find(i => (i.type === 'spell')
          && attackWithEffects(i)
          && (i.system.properties?.has?.('concentration') === concentration));
        if (owned) return { item: owned, actor: owned.actor };
        for (const pack of game.packs) {
          if (pack.documentName !== 'Item') continue;
          if (pack.metadata.id.startsWith('JB2A')) continue;
          let index;
          try { index = await pack.getIndex({ fields: ['type'] }); } catch { continue; }
          for (const entry of index.filter(e => e.type === 'spell')) {
            const doc = await pack.getDocument(entry._id);
            if (!attackWithEffects(doc)) continue;
            if ((doc.system.properties?.has?.('concentration') ?? false) !== concentration) continue;
            if (concentration && doc.system.level > 3) continue; // castable by the fixture
            // ⚠ The non-conc pick must be a CANTRIP: the fixture PC has no slot pool, and a
            // leveled pick's use comes back UNDEFINED (refused) — which is how the battery
            // aborted on 2026-08-19 when the pack walk started surfacing Guiding Bolt ahead
            // of Ray of Frost. The pick was only ever stable by accident; pin the shape.
            if (!concentration && doc.system.level > 0) continue;
            const [made] = await pc.createEmbeddedDocuments('Item', [doc.toObject()]);
            created.items.push({ actorId: pc.id, id: made.id });
            return { item: made, actor: pc };
          }
        }
        return null;
      };
      const rof = await findSpell({ concentration: false });
      if (!rof) {
        skip('1.9A: no non-concentration attack spell with effects found anywhere');
      } else {
        log.push(`effect spell: ${rof.item.name} (on ${rof.actor.name}, level ${rof.item.system.level})`);
        const spellAttack = () => rof.actor.items.get(rof.item.id).system.activities.find(a => a.type === 'attack');
        const effectNames = new Set(rof.item.effects.map(e => e.name));
        const chip = () => victim.effects.find(e => effectNames.has(e.name) && !e.disabled);
        // ⚠ clearChips knows the mastery names; the SPELL's effect names it cannot know.
        // Leaving them behind made "a miss applies nothing" find the previous hit's chip.
        const clearSpellChips = async () => {
          const mine = victim.effects.filter(e => effectNames.has(e.name));
          if (mine.length) await victim.deleteEmbeddedDocuments('ActiveEffect', mine.map(e => e.id));
        };
        // A levelled spell spends real slots and this block casts repeatedly — rest the
        // caster before each cluster so a dry pool can never impersonate a module bug.
        const restCaster = async () => { try { await rof.actor.longRest({ dialog: false, chat: false }); } catch { /* fine */ } };
        await restCaster();

        const { attackMsg, usageId, failed } = await attack(spellAttack());
        if (failed || !(usageId ?? attackMsg?.id)) {
          // A refused use is a FIXTURE fact, not a module bug — name it instead of dying on
          // a null id (the 2026-08-19 abort read as a mystery crash until probed).
          ok('11. a spell hit applies the card\'s effects to the target (1.9A)', false,
            `FIXTURE: the cast itself was refused (${rof.item.name} on ${rof.actor.name})`);
          throw new Error(`FIXTURE: cast refused — ${rof.item.name} on ${rof.actor.name} (slotless?)`);
        }
        const dmg = await waitDamage(usageId ?? attackMsg.id, { flag: 'effectReceipt' });
        const applied = chip();
        const receipt = dmg?.getFlag(MOD, 'effectReceipt');
        ok('11. a spell hit applies the card\'s effects to the target (1.9A)',
          !!applied && !!receipt?.targets?.some(t => (t.uuid === victim.uuid) && t.effects.length),
          `chip=${applied?.name ?? 'none'} receipt=${!!receipt}`);
        ok('11b. the applied effect\'s origin is the spell\'s own effect (non-concentration shape)',
          !!applied?.origin && rof.item.effects.some(e => e.uuid === applied.origin),
          `origin=${applied?.origin}`);

        // Re-cast: refresh, never stack (native parity).
        const again = await attack(spellAttack());
        await waitDamage(again.usageId ?? again.attackMsg.id, { flag: 'effectReceipt' });
        await sleep(800);
        const copies = victim.effects.filter(e => effectNames.has(e.name) && !e.disabled);
        ok('11c. a second cast re-clocks the effect instead of stacking a twin',
          copies.length === 1, `count=${copies.length}`);

        // Never on a miss.
        await clearChips();
        await clearSpellChips();
        await acFlat(40);
        const miss = await attack(spellAttack(), { advantage: false, disadvantage: true });
        if (miss.roll?.isCritical) {
          skip('1.9A miss path: nat-20 crit vs AC 40 (flake, 1/400)');
        } else {
          await sleep(2500);
          ok('11d. a missed spell attack applies nothing', !chip(), `chip=${chip()?.name ?? 'none'}`);
        }
        await acFlat(1);

        // ============================================ 12. effect revert: delete + tolerate gone
        if (want(12)) {
          await clearChips();
          await clearSpellChips();
          await healFull();
          await restCaster();
          const hit = await attack(spellAttack());
          const dmg2 = await waitDamage(hit.usageId ?? hit.attackMsg.id, { flag: 'effectReceipt' });
          const applied2 = await waitFor(() => chip());
          const revertBtn = await waitFor(() => {
            const row = document.querySelector(`[data-message-id="${dmg2?.id}"] .battleflow-receipt`);
            return [...(row?.querySelectorAll('button') ?? [])].find(b => b.textContent.includes('✕'));
          });
          revertBtn?.click();
          const gone = await waitFor(() => !victim.effects.get(applied2?.id));
          const marked = await waitFor(() => dmg2?.getFlag(MOD, 'effectReceipt')?.targets?.some(t =>
            t.effects.some(e => (e.id === applied2?.id) && e.reverted)));
          ok('12. the receipt\'s revert deletes the applied effect and marks the entry',
            !!gone && !!marked, `gone=${!!gone} marked=${!!marked}`);

          // Tolerating already-gone: land it again, delete it by hand, then click revert.
          await clearChips();
          await clearSpellChips();
          const hit2 = await attack(spellAttack());
          const dmg3 = await waitDamage(hit2.usageId ?? hit2.attackMsg.id, { flag: 'effectReceipt' });
          const applied3 = await waitFor(() => chip());
          await applied3?.delete();
          const revertBtn2 = await waitFor(() => {
            const row = document.querySelector(`[data-message-id="${dmg3?.id}"] .battleflow-receipt`);
            return [...(row?.querySelectorAll('button') ?? [])].find(b => b.textContent.includes('✕'));
          });
          revertBtn2?.click();
          const marked2 = await waitFor(() => dmg3?.getFlag(MOD, 'effectReceipt')?.targets?.some(t =>
            t.effects.some(e => (e.id === applied3?.id) && e.reverted)));
          ok('12b. revert tolerates an effect that is already gone',
            !!marked2, `marked=${!!marked2}`);
        }

        // ============================================ 13. every use shows its first card (v1.10.0)
        // The suppression machinery is deleted; what stays asserted is the COUNT (one cast,
        // exactly one card) and COEXISTENCE — the card posts AND the riders land the effect,
        // where 1.9D used to trade one for the other.
        if (want(13)) {
          const usageCards = () => game.messages.contents.filter(m =>
            ((m.type === 'usage') || (m.getFlag('dnd5e', 'messageType') === 'usage'))
            && m.speaker?.alias?.startsWith?.('BF Test'));

          await setMastery('vex');
          await clearChips();
          await clearSpellChips();
          await healFull();
          await restCaster();
          const before13 = usageCards().length;
          const co = await attack(spellAttack());
          const dmg13 = co.failed ? null
            : await waitDamage(co.usageId ?? co.attackMsg.id, { flag: 'effectReceipt' });
          ok('13. the spell card posts (exactly one) AND the riders land the effect anyway',
            !co.failed && (usageCards().length === before13 + 1) && !!chip() && !!dmg13,
            co.failed ? 'FIXTURE: the cast itself was refused (slots?)'
              : `cardDelta=${usageCards().length - before13} chip=${chip()?.name ?? 'none'} receipt=${!!dmg13}`);
        }
      }
    }

    // ---------------------------------------------------- 14. the Topple card folds its own save
    // (v1.5.0): a save chained to the card — the enricher click — or bare from a pending
    // target is judged against the card's stored DC on the elect; failure applies Prone and
    // announces, success closes quietly, and a save chained to any OTHER message is ignored.
    // Outcomes are FORCED through the actor's own save bonus (±30) — the concentration
    // suite's lesson: a suite that can lose a coin flip lies once a week.
    if (want(14)) {
      await set('autoApply', true);
      await set('masteryAsk', 'auto');
      await setMastery('topple');
      await healFull();
      await acFlat(1); // fumble-only misses — the victim's natural AC gave a real ~12% flake
      // getSpeaker picks the actor's FIRST active token on the viewed scene, and an older
      // UNLINKED victim token (another suite's reused fixture) makes every save resolve to a
      // synthetic uuid that can never match the linked snapshot entry — sweep the strays.
      const strayVictimTokens = scene.tokens.filter(t =>
        (t.actorId === victim.id) && (t.id !== victimTokenDoc.id));
      if (strayVictimTokens.length) {
        await scene.deleteEmbeddedDocuments('Token', strayVictimTokens.map(t => t.id));
        log.push(`14: swept ${strayVictimTokens.length} stray victim token(s) off the range`);
      }
      if (victim.statuses?.has?.('prone')) await victim.toggleStatusEffect('prone', { active: false });
      // ④'s regression net (2026-08-16): a DISABLED Prone leftover makes
      // toggleStatusEffect({active: true}) a silent no-op — the live "topple failed but
      // nothing fell prone". The press must land THROUGH it (forceStatus enables the
      // carrier), so plant exactly that leftover before the failing save.
      // ⚠ CANONICAL id on purpose: toggleStatusEffect(false) — every cleanup in this suite —
      // only ever removes the canonical-id effect. A random-id carrier, once enabled, outlives
      // every cleanup and hopeless-gates the rest of the run (how 2026-08-16's battery
      // poisoned itself: §7/14d/14e all starved behind an immortal Prone).
      await victim.createEmbeddedDocuments('ActiveEffect', [{
        _id: 'dnd5eprone000000', name: 'Prone', statuses: ['prone'], disabled: true,
        img: 'icons/svg/falling.svg'
      }], { keepId: true });
      // ⚠ Force outcomes through the PER-ABILITY save bonus (abilities.con.bonuses.save) —
      // the smoke-saves channel. The global system.bonuses.abilities.save is NOT folded into
      // rollSavingThrow at 5.3.3 (measured 2026-08-17: bonus "+30", saveTotal 10), so the old
      // ±30 here never forced anything and §14d was a coin flip the whole time.
      priorActor[victim.id]['system.abilities.con.bonuses.save'] =
        victim.system._source.abilities?.con?.bonuses?.save ?? '';

      let before14 = snap14();
      const atk14 = await attack(pcAttack());
      await until14(() => fresh14(before14).some(m => m.getFlag(MOD, 'topple')));
      const toppleMsg = fresh14(before14).find(m => m.getFlag(MOD, 'topple'));
      const tflag = toppleMsg?.getFlag(MOD, 'topple');
      const diag14 = () => JSON.stringify({
        total: atk14.roll?.total ?? null,
        mastery: atk14.attackMsg?.getFlag('dnd5e', 'roll.mastery') ?? null,
        snapTargets: (atk14.attackMsg?.getFlag('dnd5e', 'targets') ?? []).map(t => `${t.name}:${t.ac}`),
        dmgMsg: fresh14(before14).some(m => m.getFlag('dnd5e', 'roll.type') === 'damage'),
        prone: victim.statuses.has('prone'), hp: victim.system.attributes.hp.value,
        fresh: fresh14(before14).length
      });
      ok('14a. a topple hit posts the save card carrying dc, ability and weapon',
        !!toppleMsg && (tflag?.dc > 0) && (tflag?.ability === 'con') && !!tflag?.weapon?.name
          && (tflag?.targets?.[0]?.done === false),
        toppleMsg ? `dc=${tflag.dc}` : `no topple card — ${diag14()}`);

      if (toppleMsg && atk14.attackMsg) {
        await victim.update({ 'system.abilities.con.bonuses.save': '-30' });
        await victim.rollSavingThrow({ ability: 'con' }, { configure: false },
          { data: { 'flags.dnd5e.originatingMessage': atk14.attackMsg.id } });
        await sleep(1200);
        ok('14b. a save chained to another message does not fold the topple card',
          toppleMsg.getFlag(MOD, 'topple').targets[0].done === false,
          `done=${toppleMsg.getFlag(MOD, 'topple').targets[0].done}`);

        before14 = snap14();
        const saveRolls14 = await victim.rollSavingThrow({ ability: 'con' }, { configure: false },
          { data: { 'flags.dnd5e.originatingMessage': toppleMsg.id } });
        await until14(() => toppleMsg.getFlag(MOD, 'topple').targets[0].done);
        // The announcement posts AFTER the flag flips done (the handoff's same-breath race) —
        // and since v1.5.1 also after the dice-animation pause — give it a generous wait.
        await until14(() => fresh14(before14).some(m => m.content?.includes('falls Prone')), 10_000);
        // The applied receipt is written AFTER the announcement posts — wait for it or the
        // assert races the last flag write (the same-breath lesson, applied-side).
        await until14(() => toppleMsg.getFlag(MOD, 'topple').targets[0].applied, 8000);
        const e14 = toppleMsg.getFlag(MOD, 'topple').targets[0];
        const announced = fresh14(before14).filter(m => m.content?.includes('falls Prone')).length;
        const sm14 = saveRolls14?.[0]?.parent;
        ok('14c. a failed save presses Prone THROUGH a disabled leftover, marks applied, announces once',
          e14.done && (e14.outcome === 'prone') && victim.statuses.has('prone')
            && (e14.applied === true) && (announced === 1),
          `outcome=${e14.outcome} prone=${victim.statuses.has('prone')} applied=${e14.applied} announced=${announced}`
            + ` | save: type=${sm14?.getFlag('dnd5e', 'roll.type')} origin=${sm14?.getFlag('dnd5e', 'originatingMessage')}`
            + ` total=${sm14?.rolls?.[0]?.total} assoc=${sm14?.getAssociatedActor?.()?.uuid} expected=${victim.uuid}`);

        // v1.11.0 (finding ⑤), the ENABLE branch: pressing THROUGH the disabled leftover
        // stamps the source onto the carrier it enables — origin comes from the topple
        // stamp's attackerUuid, whoever swung.
        const prone14 = victim.effects.find(e => e.statuses?.has?.('prone'));
        ok('14c2. the pressed-through chip names its source from the topple stamp',
          !!toppleMsg.getFlag(MOD, 'topple').attackerUuid
            && (prone14?.origin === toppleMsg.getFlag(MOD, 'topple').attackerUuid),
          `origin=${prone14?.origin ?? 'none'} attackerUuid=${toppleMsg.getFlag(MOD, 'topple').attackerUuid ?? 'none'}`);

        await victim.toggleStatusEffect('prone', { active: false });
        await victim.update({ 'system.abilities.con.bonuses.save': '+30' });
        // ⚠ Retry the attack until a topple card appears (bounded): vs AC 1 only a fumble
        // misses, but a double-nat-1 under advantage IS a real 0.25% — and it hit this
        // section twice on 2026-08-17. Heal + un-prone between tries (the dead-skip and
        // already-prone gates both eat the card silently).
        let topple2 = null;
        let atk14d = null;
        for (let try14d = 0; (try14d < 4) && !topple2; try14d++) {
          await victim.toggleStatusEffect('prone', { active: false });
          await healFull(); // 11 max HP — the section's own attacks kill it (the fixture-HP trap)
          before14 = snap14();
          atk14d = await attack(pcAttack());
          await until14(() => fresh14(before14).some(m => m.getFlag(MOD, 'topple')), 12_000);
          topple2 = fresh14(before14).find(m => m.getFlag(MOD, 'topple'));
        }
        if (topple2) {
          const preAnnounce = snap14();
          const rolls14d = await victim.rollSavingThrow({ ability: 'con' }, { configure: false },
            { data: { 'flags.dnd5e.originatingMessage': topple2.id } });
          await until14(() => topple2.getFlag(MOD, 'topple').targets[0].done);
          const e14b = topple2.getFlag(MOD, 'topple').targets[0];
          // RECUT at v1.15.0 (the 2026-08-18 session's finding ⑤, overturning v1.6.0's
          // "closes quietly"): a public ask that resolves in silence reads as a dropped
          // machine — the success must announce, exactly one card, and still no Prone.
          await until14(() => fresh14(preAnnounce).some(m => m.content?.includes('stays standing')), 10_000);
          const announced2 = fresh14(preAnnounce).filter(m => m.content?.includes('falls Prone')).length;
          const stood2 = fresh14(preAnnounce).filter(m => m.content?.includes('stays standing')).length;
          ok('14d. a successful save announces — stays standing, once, and no Prone',
            e14b.done && (e14b.outcome === 'saved') && !victim.statuses.has('prone')
              && (announced2 === 0) && (stood2 === 1),
            `outcome=${e14b.outcome} prone=${victim.statuses.has('prone')} prone-cards=${announced2} stood-cards=${stood2}`
              + ` | saveTotal=${rolls14d?.[0]?.total} dc=${topple2.getFlag(MOD, 'topple').dc}`
              + ` bonusNow=${JSON.stringify(victim.system.abilities?.con?.bonuses?.save ?? null)}`);
        } else {
          ok('14d. a successful save announces — stays standing, once, and no Prone', false,
            `no second topple card — ${JSON.stringify({
              attackTotal: atk14d?.roll?.total ?? null,
              isCrit: atk14d?.roll?.isCritical ?? null,
              mastery: atk14d?.attackMsg?.getFlag('dnd5e', 'roll.mastery') ?? null,
              victimHp: victim.system.attributes.hp.value,
              victimProne: victim.statuses.has('prone'),
              dmgAppeared: fresh14(before14).some(m => m.getFlag('dnd5e', 'roll.type') === 'damage'),
              freshCount: fresh14(before14).length
            })}`);
        }

        await victim.update({ 'system.abilities.con.bonuses.save': '-30' });
        // Bounded retry — a miss (or a leftover Prone, which the stamp skips) flaked this
        // section (2026-08-20); 14g below already carries the same loop for the same reason.
        let topple3 = null;
        for (let try14e = 0; (try14e < 4) && !topple3; try14e++) {
          await victim.toggleStatusEffect('prone', { active: false });
          await healFull();
          before14 = snap14();
          await attack(pcAttack());
          await until14(() => fresh14(before14).some(m => m.getFlag(MOD, 'topple')));
          topple3 = fresh14(before14).find(m => m.getFlag(MOD, 'topple'));
        }
        if (topple3) {
          // 14f first, while the card is still pending: the card must offer its own
          // correctly-aimed Roll control — the native enricher rolls for the SELECTION,
          // which right after an attack is the ATTACKER (bit live 2026-08-16).
          let cardEl = null;
          await until14(() => {
            cardEl = document.querySelector(`.message[data-message-id="${topple3.id}"]`);
            return !!cardEl;
          }, 4000);
          const rollBtn = cardEl && [...cardEl.querySelectorAll('button')]
            .some(b => b.textContent?.includes('Roll save'));
          ok('14f. a pending topple card offers its own Roll control (the selection trap)',
            !!rollBtn, cardEl ? 'no Roll button in the rendered card' : 'card element not found');

          await victim.rollSavingThrow({ ability: 'con' }, { configure: false }, {});
          await until14(() => topple3.getFlag(MOD, 'topple').targets[0].done);
          const e14c = topple3.getFlag(MOD, 'topple').targets[0];
          // Prone lands after the verdict pause since v1.5.1 — wait for the status itself,
          // not just the flag.
          await until14(() => victim.statuses.has('prone'), 10_000);
          ok('14e. a bare sheet save from a pending target answers the card',
            e14c.done && (e14c.outcome === 'prone') && victim.statuses.has('prone'),
            `outcome=${e14c.outcome} prone=${victim.statuses.has('prone')}`);
        } else {
          ok('14e. a bare sheet save from a pending target answers the card', false,
            'no third topple card (did the attack hit?)');
        }

        // 14g–i. the buzzer (v1.10.0): the demand stamps saveTimer's deadline, the card runs
        // the bar (the pairing rule, asserted at the DOM by the [data-bf-deadline] node the
        // drain animates on), and expiry ROLLS the still-pending target straight — marked as
        // the timer's press — with the failure pressing Prone. The -30 save bonus from 14e is
        // still on, so the outcome is forced, not flipped.
        await set('saveTimer', 3);
        let topple4 = null;
        for (let try14g = 0; (try14g < 4) && !topple4; try14g++) {
          await victim.toggleStatusEffect('prone', { active: false });
          await healFull();
          before14 = snap14();
          await attack(pcAttack());
          await until14(() => fresh14(before14).some(m => m.getFlag(MOD, 'topple')), 12_000);
          topple4 = fresh14(before14).find(m => m.getFlag(MOD, 'topple'));
        }
        if (topple4) {
          const t4 = topple4.getFlag(MOD, 'topple');
          ok('14g. the topple demand stamps the save timer (window + deadline on the flag)',
            (t4.window === 3) && (t4.deadline > Date.now() - 60_000),
            `window=${t4.window ?? 'none'} deadline=${t4.deadline ?? 'none'}`);
          let barEl = null;
          await until14(() => {
            barEl = document.querySelector(`.message[data-message-id="${topple4.id}"] [data-bf-deadline]`);
            return !!barEl;
          }, 4000);
          ok('14h. the topple card runs the deadline bar (the pairing rule at the DOM)',
            !!barEl, 'no [data-bf-deadline] node in the rendered topple card');
          // Nobody rolls. The buzzer must — and its roll is marked as the timer's press.
          await until14(() => topple4.getFlag(MOD, 'topple').targets[0].done, 12_000);
          const e14g = topple4.getFlag(MOD, 'topple').targets[0];
          await until14(() => victim.statuses.has('prone'), 10_000);
          const timerRoll = game.messages.contents.find(m =>
            (m.getFlag('dnd5e', 'originatingMessage') === topple4.id)
            && m.getFlag(MOD, 'timedOut'));
          ok('14i. the buzzer rolls the unanswered save (marked) and the failure presses Prone',
            e14g.done && (e14g.outcome === 'prone') && (e14g.timedOut === true)
              && !!timerRoll && victim.statuses.has('prone'),
            `outcome=${e14g.outcome} timedOut=${e14g.timedOut} timerRoll=${!!timerRoll} prone=${victim.statuses.has('prone')}`);
        } else {
          ok('14g. the topple demand stamps the save timer (window + deadline on the flag)', false,
            'no fourth topple card (did the attack hit?)');
        }
        await set('saveTimer', 0);
        await victim.toggleStatusEffect('prone', { active: false });
        await victim.update({ 'system.abilities.con.bonuses.save':
          priorActor[victim.id]['system.abilities.con.bonuses.save'] });
      }
    }

    // ---------------------------------------------------- 15. the reminders (vex / sap / cleave)
    // v1.5.0 user call: "the design is for people to know weapon masteries". The card is the
    // durable record (flag masteryNotice, windowed by S.noticeTimer); the popup is a per-client view of it
    // and is not asserted here — popup discipline is the managed-popup machinery's, already
    // proven by the ask and the concentration suite.
    if (want(15)) {
      await setMastery('vex');
      let before15 = snap14();
      for (let try15 = 0; try15 < 4; try15++) {
        await healFull(); // dead targets are skipped — every §15 attack starts from full
        before15 = snap14();
        await attack(pcAttack());
        await until14(() => fresh14(before15).some(m => m.getFlag(MOD, 'masteryNotice')?.key === 'vex'), 10_000);
        if (fresh14(before15).some(m => m.getFlag(MOD, 'masteryNotice')?.key === 'vex')) break;
      }
      let msgs15 = fresh14(before15);
      const vexNotice = msgs15.find(m => m.getFlag(MOD, 'masteryNotice')?.key === 'vex');
      const vexChip = victim.effects.find(e => e.getFlag(MOD, 'mastery') === 'vex');
      // ⚠ THIS ASSERTION PINNED THE BUG IT WAS MEANT TO GUARD (fixed 2026-09-01). It hard-coded
      // 15, so the reminder's stale constant was not merely unnoticed — the suite went green
      // BECAUSE of it, every run, while live play lost the window to it. Read the SETTING: the
      // contract is "the card's window is the configured one", not "the window is 15".
      const noticeWindow = game.settings.get(MOD, 'noticeTimer');
      // 0 is the STICKY setting — no window is stamped at all, so the reminder never expires
      // and the card draws no bar. Asserting `window === 0` there would demand a field the
      // contract deliberately omits, so the two cases are checked as the two shapes they are.
      const gotWindow = vexNotice?.getFlag(MOD, 'masteryNotice')?.window;
      const windowOk = noticeWindow ? (gotWindow === noticeWindow) : (gotWindow === undefined);
      ok(`15a. vex pays AND reminds: the chip and a notice card on the configured ${noticeWindow || 'sticky'} window`,
        !!vexChip && !!vexNotice && windowOk && vexNotice.content.includes('Weapon Mastery'),
        `chip=${!!vexChip} notice=${!!vexNotice} window=${gotWindow} want=${noticeWindow || 'none (sticky)'}`);
      // The pairing rule (v1.10.0): the popup's drain runs on the CARD too — asserted at
      // the DOM by the bar node the drain animates on, while the window is still open.
      let noticeBar = null;
      await until14(() => {
        noticeBar = document.querySelector(`.message[data-message-id="${vexNotice?.id}"] [data-bf-deadline]`);
        return !!noticeBar;
      }, 4000);
      // A sticky reminder has no clock, so there is correctly no bar to find — the pairing
      // rule binds the bar to the WINDOW, not to the card.
      ok(`15a2. the reminder card ${noticeWindow ? 'runs the drain bar' : 'draws no bar when sticky'} (the pairing rule at the DOM)`,
        noticeWindow ? !!noticeBar : !noticeBar,
        noticeWindow ? 'no [data-bf-deadline] node in the rendered notice card'
          : 'a [data-bf-deadline] node appeared on a windowless notice');
      const dmg15 = msgs15.find(m => m.getFlag(MOD, 'effectReceipt')?.targets?.length);
      ok('15b. the mastery receipt entry carries the effect description (the tooltip)',
        !!dmg15?.getFlag(MOD, 'effectReceipt')?.targets?.[0]?.effects?.[0]?.description,
        `desc=${JSON.stringify(dmg15?.getFlag(MOD, 'effectReceipt')?.targets?.[0]?.effects?.[0]?.description ?? null)}`);

      await setMastery('sap');
      await healFull(); // dead targets are skipped — every §15 attack starts from full
      before15 = snap14();
      await attack(pcAttack());
      await until14(() => fresh14(before15).some(m => m.getFlag(MOD, 'masteryNotice')?.key === 'sap'));
      const sapNotice = fresh14(before15).find(m => m.getFlag(MOD, 'masteryNotice')?.key === 'sap');
      ok('15c. sap reminds the attacker what it did',
        !!victim.effects.find(e => e.getFlag(MOD, 'mastery') === 'sap') && !!sapNotice,
        `notice=${!!sapNotice}`);

      await setMastery('cleave');
      await healFull();
      before15 = snap14();
      await attack(pcAttack());
      await until14(() => fresh14(before15).some(m => m.getFlag(MOD, 'masteryNotice')?.key === 'cleave'));
      msgs15 = fresh14(before15);
      const cleaveNotice = msgs15.find(m => m.getFlag(MOD, 'masteryNotice')?.key === 'cleave');
      ok('15d. cleave reminds without paying anything',
        !!cleaveNotice && !victim.effects.some(e => e.getFlag(MOD, 'mastery') === 'cleave')
          && !msgs15.some(m => m.getFlag(MOD, 'mastery')),
        `notice=${!!cleaveNotice}`);

      // (u) walk-4: the dead-skip must NOT eat cleave — a kill is its signature moment (Morgash
      // killed Jetten and the reminder died with him). Victim at 1 HP so the applied damage
      // kills; the reminder must post anyway, the corpse still anchoring "within 5 feet of".
      let killNotice15 = null;
      for (let tryU = 0; (tryU < 4) && !killNotice15; tryU++) {
        await victim.update({ 'system.attributes.hp.value': 1 });
        before15 = snap14();
        await attack(pcAttack());
        await until14(() => fresh14(before15).some(m => m.getFlag(MOD, 'masteryNotice')?.key === 'cleave'), 10_000);
        killNotice15 = fresh14(before15).find(m => m.getFlag(MOD, 'masteryNotice')?.key === 'cleave');
      }
      ok('15d2. (u) a KILLING swing still posts the cleave reminder',
        !!killNotice15 && (victim.system.attributes.hp.value <= 0),
        `notice=${!!killNotice15} hp=${victim.system.attributes.hp.value}`);
      await healFull();
      // No litter: 15d2's reminder popups must not be the [0] a later section's picker clicks
      // (17a Arm-clicked a stale one here and the ack landed on the wrong notice).
      for (const el of [...document.querySelectorAll('.application')]
        .filter(el => (el.innerHTML ?? '').includes('Weapon Mastery'))) {
        try { (el.querySelector('[data-action="close"]') ?? el.querySelector('.header-control'))?.click(); } catch {}
      }
      await sleep(300);
    }

    // ---------------------------------- 16. the 2026-08-18 session's fixes (v1.15.0)
    // ④ the fold refuses other machines' rolls; ⓪/② twin asks and twin chips converge.
    if (want(16)) {
      await setMastery('topple');
      await victim.update({ 'system.abilities.con.bonuses.save': '+30' }); // every save succeeds — no Prone side-effects
      let card16 = null;
      for (let try16 = 0; (try16 < 4) && !card16; try16++) {
        await victim.toggleStatusEffect('prone', { active: false });
        await healFull();
        const b16 = snap14();
        await attack(pcAttack());
        await until14(() => fresh14(b16).some(m => m.getFlag(MOD, 'topple')), 12_000);
        card16 = fresh14(b16).find(m => m.getFlag(MOD, 'topple'));
      }
      if (card16) {
        // 16a. provenance: the ask names the damage message that earned it (the supersede's key).
        ok('16a. the topple ask carries its provenance (sourceMessageId)',
          !!card16.getFlag(MOD, 'topple').sourceMessageId,
          `sourceMessageId=${card16.getFlag(MOD, 'topple').sourceMessageId ?? 'MISSING'}`);

        // 16b. finding ④, the theft: a roll stamped as ANOTHER machine's answer (respondsTo)
        // must never fold the topple — Edda's concentration answer was claimed live.
        await victim.rollSavingThrow({ ability: 'con' }, { configure: false },
          { data: { flags: { [MOD]: { respondsTo: 'bfstubforeign000' } } } });
        await sleep(1500);
        ok('16b. a respondsTo roll (another machine\'s answer) never folds the topple',
          card16.getFlag(MOD, 'topple').targets[0].done === false,
          `done=${card16.getFlag(MOD, 'topple').targets[0].done}`);

        // 16c. finding ④, the bare-roll half: while a concentration ask PENDS for the same
        // actor and ability, a bare sheet roll is the conc machine's (ship-order priority);
        // the topple stands for its own popup and buzzer.
        const stub16 = await ChatMessage.create({ content: 'BF test — pending conc ask stub',
          flags: { [MOD]: { concentration: {
            status: 'pending', actorUuid: victim.uuid, ability: 'con', dc: 10 } } } });
        await victim.rollSavingThrow({ ability: 'con' }, { configure: false }, {});
        await sleep(1500);
        ok('16c. a bare roll defers to a pending concentration ask — the topple stands',
          card16.getFlag(MOD, 'topple').targets[0].done === false,
          `done=${card16.getFlag(MOD, 'topple').targets[0].done}`);

        // 16d. the ask resolved and gone, the next bare roll is the topple's again — and the
        // success ANNOUNCES (finding ⑤ at the fold's bare path).
        await ChatMessage.deleteDocuments([stub16.id]);
        const pre16d = snap14();
        await victim.rollSavingThrow({ ability: 'con' }, { configure: false }, {});
        await until14(() => card16.getFlag(MOD, 'topple').targets[0].done, 8000);
        await until14(() => fresh14(pre16d).some(m => m.content?.includes('stays standing')), 10_000);
        const e16 = card16.getFlag(MOD, 'topple').targets[0];
        ok('16d. with the ask gone the bare roll answers the topple, and the save announces',
          e16.done && (e16.outcome === 'saved')
            && fresh14(pre16d).some(m => m.content?.includes('stays standing')),
          `done=${e16.done} outcome=${e16.outcome}`);

        // 16e. finding ⓪/②, the twin ask: isActiveGM() is per-USER — two sessions on one
        // account both stamp. A twin arriving over the same sourceMessageId deletes itself;
        // the elder keeps the question. (Targets arrive done so no popup flashes.)
        const twin16 = await ChatMessage.create({ content: 'BF test — twin topple ask',
          flags: { [MOD]: { topple: {
            dc: 14, ability: 'con',
            sourceMessageId: card16.getFlag(MOD, 'topple').sourceMessageId,
            targets: [{ uuid: victim.uuid, name: victim.name,
              done: true, outcome: 'saved', applied: true }] } } } });
        const gone16 = await until14(() => !game.messages.get(twin16.id), 6000);
        ok('16e. a twin ask over the same source supersedes itself — the elder keeps the question',
          !!gone16 && !!game.messages.get(card16.id),
          `twinGone=${!!gone16} elderStands=${!!game.messages.get(card16.id)}`);
      } else {
        for (const name of ['16a. the topple ask carries its provenance (sourceMessageId)',
          '16b. a respondsTo roll (another machine\'s answer) never folds the topple',
          '16c. a bare roll defers to a pending concentration ask — the topple stands',
          '16d. with the ask gone the bare roll answers the topple, and the save announces',
          '16e. a twin ask over the same source supersedes itself — the elder keeps the question']) {
          ok(name, false, 'no topple card after 4 attacks (fixture)');
        }
      }

      // 16f. finding ⓪/②, the twin chip: two module-fingerprinted effects with the same name
      // and origin converge to one — the newcomer deletes itself, the elder stands.
      // Clean slate: a crashed prior run's twin chips are ELDERS to this section's pair
      // and would eat both newcomers (bit 2026-08-19, take 3).
      for (const stale of victim.effects.filter(e => e.name === 'BF Twin Chip')) await stale.delete();
      // ⚠ The origin must RESOLVE — this box nulls an ActiveEffect create whose origin
      // uuid points at nothing (probed 2026-08-19: every synthetic-origin attempt of this
      // section silently created NOTHING and the assert was reading phantoms). The victim's
      // own uuid is the cheapest real origin. The elder's create is race-free (no twin
      // exists yet) so ITS return is safe to hold; the newcomer's return is NOT held — the
      // watcher can delete it before the creation workflow resolves, which is the fix
      // winning its race. Converge on the COUNT.
      const eA16 = await ActiveEffect.implementation.create({
        name: 'BF Twin Chip', origin: victim.uuid,
        flags: { [MOD]: { applied: true } } }, { parent: victim });
      await sleep(60); // distinct server creation stamps — the dedupe orders by them
      void ActiveEffect.implementation.create({
        name: 'BF Twin Chip', origin: victim.uuid,
        flags: { [MOD]: { applied: true } } }, { parent: victim });
      await sleep(600); // let the twin land before asking for convergence
      const converged16 = await until14(() =>
        victim.effects.filter(e => e.name === 'BF Twin Chip').length === 1, 6000);
      ok('16f. a twin fingerprinted chip converges to one — newcomer deletes, elder stands',
        !!converged16 && !!eA16 && !!victim.effects.get(eA16.id),
        `converged=${!!converged16} elderStands=${!!(eA16 && victim.effects.get(eA16.id))} `
          + `count=${victim.effects.filter(e => e.name === 'BF Twin Chip').length}`);
      for (const e of victim.effects.filter(e => e.name === 'BF Twin Chip')) await e.delete();
      await victim.update({ 'system.abilities.con.bonuses.save':
        priorActor[victim.id]['system.abilities.con.bonuses.save'] });
    }

    // ================================================== 17. the Cleave arm (v1.19.0, FLOW item 8)
    // The reminder popup is now a DECISION (Arm the Cleave / Dismiss); the arm is a one-shot
    // actor flag; the strip drops the literal "@mod" part from the BASE entry of the next
    // damage roll with that weapon, skipping when the mod is negative (the RAW corner), and
    // expiring by STAMP MISMATCH (in combat) or 60s TTL (out of combat).
    if (want(17)) {
      await setMastery('cleave');
      await acFlat(1);
      await healFull();
      await clearChips();
      {
        const cleaveDialogs = () => [...document.querySelectorAll('.application')]
          .filter(el => (el.innerHTML ?? '').includes('Arm the Cleave'));
        const closeCleaveDialogs = async () => {
          for (const el of [...document.querySelectorAll('.application')]
            .filter(el => (el.innerHTML ?? '').includes('Weapon Mastery'))) {
            try { (el.querySelector('[data-action="close"]') ?? el.querySelector('.header-control'))?.click(); } catch {}
          }
          await sleep(300);
        };
        const modOf = () => pc.system.abilities.str.mod; // the blade is STR-based at 16 (+3)

        // 17a — the reminder pops with the Arm control; pressing it writes the actor flag.
        {
          const { attackMsg } = await attack(pcAttack());
          await waitDamage(attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id, { flag: 'receipt' });
          const dialog = await waitFor(() => cleaveDialogs()[0], 8000);
          ok('17a. the Cleave reminder offers Arm/Dismiss (a decision, not an OK)',
            !!dialog && !!dialog.querySelector('button[data-action="arm"]')
              && !!dialog.querySelector('button[data-action="dismiss"]'),
            `dialog=${!!dialog} arm=${!!dialog?.querySelector('button[data-action="arm"]')}`);
          dialog?.querySelector('button[data-action="arm"]')?.click();
          const arm = await waitFor(() => pc.getFlag(MOD, 'cleaveArm'), 5000);
          ok('17b. Arm writes the one-shot actor flag keyed to THIS weapon',
            (arm?.itemId === blade.id) && (arm?.stamp === null),
            `arm=${JSON.stringify(arm)}`);
          // (j) the ACK, round 3: ANY notice button resolves the card's pending presentation —
          // Arm acknowledges durably (this client authored the notice as the elect) and the
          // card's bar leaves; the "Cleave — armed" block is the ARM's and stays.
          const notice17 = game.messages.contents.filter(m =>
            m.getFlag(MOD, 'masteryNotice')?.key === 'cleave').pop();
          const acked17 = await waitFor(() =>
            notice17?.getFlag(MOD, 'masteryNotice')?.acknowledged === true, 5000);
          await sleep(400);
          const bar17 = notice17 ? document.querySelector(
            `.message[data-message-id="${notice17.id}"] [data-bf-deadline]`) : null;
          ok('17b2. (j) Arm ACKNOWLEDGES the reminder — flag recorded, the card bar leaves',
            (acked17 === true) && !bar17, `acked=${acked17} bar=${!!bar17}`);
          await closeCleaveDialogs();
        }

        // 17c — the armed swing: "@mod" leaves the BASE entry, the receipt line lands, the
        // arm is consumed. (str 16 ⇒ the unstripped formula would carry "+ 3".)
        {
          const { attackMsg } = await attack(pcAttack());
          const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
          const dmg = await waitDamage(originId, { flag: 'receipt' });
          const formula = dmg?.rolls?.[0]?.formula ?? '';
          ok('17c. armed — the damage roll drops the ability modifier',
            !!dmg && !formula.includes(`+ ${modOf()}`) && !!dmg.getFlag(MOD, 'cleaveStripped')
              && !pc.getFlag(MOD, 'cleaveArm'),
            `formula="${formula}" stripped=${!!dmg?.getFlag(MOD, 'cleaveStripped')} armLeft=${!!pc.getFlag(MOD, 'cleaveArm')}`);
          await closeCleaveDialogs();
        }

        // 17d — the RAW corner: a NEGATIVE mod is never stripped (removing a minus would RAISE
        // the damage), but the arm is still consumed. ⚠ BOTH abilities go to 6 — the fixture
        // blade can be FINESSE (a dagger was picked on this suite's first run), and lowering
        // STR alone leaves a +3 DEX mod that the strip then rightly removes.
        {
          await pc.update({ 'system.abilities.str.value': 6, 'system.abilities.dex.value': 6 }); // mod −2
          await pc.setFlag(MOD, 'cleaveArm',
            { itemId: blade.id, itemName: blade.name, stamp: null, armedAt: Date.now() });
          const { attackMsg } = await attack(pcAttack());
          const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
          const dmg = await waitDamage(originId, { flag: 'receipt' });
          const formula = dmg?.rolls?.[0]?.formula ?? '';
          ok('17d. negative mod — the strip SKIPS (the penalty stays), the arm still consumes',
            !!dmg && /-\s*2/.test(formula) && !dmg.getFlag(MOD, 'cleaveStripped')
              && !pc.getFlag(MOD, 'cleaveArm'),
            `formula="${formula}" stripped=${!!dmg?.getFlag(MOD, 'cleaveStripped')} armLeft=${!!pc.getFlag(MOD, 'cleaveArm')}`);
          await pc.update({ 'system.abilities.str.value': 16, 'system.abilities.dex.value': 16 });
          await closeCleaveDialogs();
        }

        // 17e — staleness: a combat stamp that matches no live combat (the turn moved on, the
        // fight ended, the arm was yesterday's) strips NOTHING and cleans itself up.
        {
          await pc.setFlag(MOD, 'cleaveArm',
            { itemId: blade.id, itemName: blade.name, stamp: 'staleCombat:1:0', armedAt: Date.now() });
          const { attackMsg } = await attack(pcAttack());
          const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
          const dmg = await waitDamage(originId, { flag: 'receipt' });
          const formula = dmg?.rolls?.[0]?.formula ?? '';
          ok('17e. a stale combat stamp never strips — mismatch IS expiry, the flag self-cleans',
            !!dmg && formula.includes(`+ ${modOf()}`) && !dmg.getFlag(MOD, 'cleaveStripped')
              && !pc.getFlag(MOD, 'cleaveArm'),
            `formula="${formula}" armLeft=${!!pc.getFlag(MOD, 'cleaveArm')}`);
          await closeCleaveDialogs();
        }

        // 17f — the unarmed baseline: no flag, no strip, byte-identical to before the feature.
        {
          const { attackMsg } = await attack(pcAttack());
          const originId = attackMsg?.getFlag('dnd5e', 'originatingMessage') ?? attackMsg?.id;
          const dmg = await waitDamage(originId, { flag: 'receipt' });
          const formula = dmg?.rolls?.[0]?.formula ?? '';
          ok('17f. unarmed — the modifier rides as always, no strip stamp',
            !!dmg && formula.includes(`+ ${modOf()}`) && !dmg.getFlag(MOD, 'cleaveStripped'),
            `formula="${formula}"`);
          await closeCleaveDialogs();
        }
        await pc.unsetFlag(MOD, 'cleaveArm').catch(() => {});
      }
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
    for (const a of [victim, shielder, pc, npc].filter(Boolean)) {
      try { await a.longRest?.({ dialog: false, chat: false }); } catch { /* fine */ }
    }
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'effects', out, plan, f });
