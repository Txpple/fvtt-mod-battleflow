// Battle Flow v1.19.0 smoke test — the MANEUVER FOLDS (FLOW item 1): Precision Attack
// patches a declared miss; Riposte answers an enemy melee miss with a real driven attack.
//
// Its own suite ON PURPOSE (recorded deviation from the plan's "extend smoke-hold"): the
// folds deliberately share nothing with the hold machine — own flags, own popups, own
// timers — and smoke-hold is the most fragile suite around the most fragile file. A fresh
// suite keeps both untouched. Battery position: straight after smoke-hold.
//
// Determinism levers, all deliberate:
//   - The fixture Precision die is "1d8 + 20" so a flip is GUARANTEED against AC 25
//     (margin ≤ 19 < 21 ≤ die) while a natural 20 (which would hit and stamp nothing)
//     just retries. The world's real die (@scale…) is probe-verified separately.
//   - holdSkipFutile OFF for the stamp sections (a suite must never lose an offer to good
//     rolling); its own section pins the hopeless gate with AC 60.
//   - holdTimer 0 (popups wait for the suite's click); the buzzer section pins 2s locally.
//
// ⚠ Run `smoke-battleflow` FIRST — rides BF Test Attacker / BF Test Victim.
//
// Sections (PLAN 1.1): named after the fold they exercise — `--section B`, `--section P,R`,
// `--list`. Fixtures and teardown ALWAYS run; only the fold groups are skippable.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs): the machines this suite drives — a change to one
// re-runs it under `battery.mjs --changed`. Spine files are never claimed: their change is the
// full battery. `npm run coverage` checks the claims both ways. Exported only so the linter reads
// it as the declaration it is: ⚠ NEVER import a suite (it connects on evaluation) — the map is parsed.
export const COVERS = [
  'precision.js',           // P, P8, M1, Q — Precision Attack
  'riposte.js',             // R, RP — Riposte's driven attack
  'hew.js',                 // H — the Hew reminder
  'bash-offer.js',          // B — the bash offer on a listed carrier's hit
  'saves/choices.js',       // B / I — the Prone-or-push choice and Interpose
  'saves/verdict.js'        // I — Interpose on a save success
];

const SECTIONS = {
  P: 'Precision — the stamp gates, Pass, Use, the re-drive',
  R: 'Riposte — the offer and the driven attack',
  P8: 'finding ①: player-owned, owner OFFLINE',
  M1: 'finding ④: two weapons, smart default',
  RP: '(l)+(p): the riposte HIT celebrates',
  B: 'finding ⑤: the bash choice (Prone or push)',
  I: 'finding ⑥: Interpose (save-success reaction)',
  H: '② + (c): the Hew reminder POPS now',
  Q: '(s): the cascade is a staircase queue'
};
// Each group stands up its own fixtures and restores the settings it pinned, so none of them
// names another. ⚠ `P` leaves the victim on flat AC 25 (its miss band); a group that needs a
// different AC sets its own, which is why that is not a dependency.
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'maneuvers', watchdogMs: 600_000 });
announcePlan('maneuvers', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  // The Reaction is a CHIP (2026-09-02): these stand in for the old flag's set, unset and read.
  const clearReaction = async a => { const ids = (a?.effects ?? []).filter(e => e.getFlag(MOD, 'mastery') === 'reaction').map(e => e.id); if (ids.length) await a.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {}); };
  const spendReactionOf = async a => { await a.createEmbeddedDocuments('ActiveEffect', [{ name: 'Reaction — used', img: 'icons/svg/clockwork.svg', transfer: false, flags: { [MOD]: { mastery: 'reaction' } } }]); };
  const reactionChip = a => !!a?.effects?.some(e => e.getFlag(MOD, 'mastery') === 'reaction');
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  // The section gate — see tools/harness.mjs. This closure is serialized into the page, so the
  // plan and the titles arrive as DATA and the predicate is spelled out here.
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const suiteStart = Date.now();

  // Console-error capture (diagnostic, removed noise-free when green): the module logs its
  // failures there and the suite otherwise cannot see them.
  const consoleErrors = [];
  const origConsoleError = console.error;
  console.error = (...a) => {
    try { consoleErrors.push(a.map(x => x?.message ?? String(x)).join(' | ').slice(0, 300)); } catch {}
    origConsoleError(...a);
  };

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.maneuverFolds`)) {
    return { fatal: 'maneuverFolds not registered — this client is running OLD code (F5)' };
  }

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'riders', 'effectRiders', 'masteryRiders', 'playerRollDamage',
    'holdTimer', 'holdSkipFutile', 'holdReveal', 'castApply', 'maneuverFolds',
    'saves', 'saveTimer'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const enemy = game.actors.getName('BF Test Attacker');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !enemy || !victim) return { fatal: 'missing fixtures — run smoke-battleflow first' };

  const created = { tokens: [], enemyItems: [], victimItems: [] };
  let pc = null;
  const priorActor = {};
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      const liveItems = created.enemyItems.filter(id => enemy.items.get(id));
      if (liveItems.length) await enemy.deleteEmbeddedDocuments('Item', liveItems);
      const liveVictimItems = created.victimItems.filter(id => victim.items.get(id));
      if (liveVictimItems.length) await victim.deleteEmbeddedDocuments('Item', liveVictimItems);
      for (const e of victim.effects.filter(x => x.name === 'BF Test Prone')) await e.delete().catch(() => {});
      for (const [actorId, data] of Object.entries(priorActor)) {
        await game.actors.get(actorId)?.update(data);
      }
      await clearReaction(enemy);
      if (pc) await pc.delete().catch(() => {});
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
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('playerRollDamage', false);
    await set('holdTimer', 0);
    await set('holdSkipFutile', false);
    await set('holdReveal', true);
    await set('castApply', false);
    await set('saves', false);
    await set('saveTimer', 1);
    await set('maneuverFolds', 'Precision Attack:precision, Riposte:riposte');

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    // ⚠ Sweep pre-existing fixture tokens FIRST (the smoke-saves §fixtures lesson, hit again
    // here on this suite's first run): getSpeaker resolves through the actor's OLDEST token
    // on the viewed scene, and smoke-battleflow leaves UNLINKED ones — the enemy's attack
    // then speaks as a SYNTHETIC token actor, the riposte stamps that uuid as its attacker,
    // and every base-uuid assertion fails while the machine works perfectly.
    const stale = scene.tokens.filter(t => [enemy.id, victim.id].includes(t.actorId)).map(t => t.id);
    if (stale.length) await scene.deleteEmbeddedDocuments('Token', stale);
    const enemyWeapon = enemy.items.find(i => i.system.activities?.some?.(a => a.type === 'attack'));
    if (!enemyWeapon) return { fatal: 'BF Test Attacker has no weapon' };

    pc = await Actor.create({
      name: 'BF Test Maneuver PC', type: 'character',
      system: { abilities: { str: { value: 16 }, dex: { value: 16 } },
        attributes: { hp: { value: 30, max: 30 } } },
      items: [foundry.utils.mergeObject(enemyWeapon.toObject(), {
        system: { equipped: true } }, { inplace: false })]
    });
    // The pool first (the maneuvers' consumption targets its id), then the maneuvers.
    const [pool] = await pc.createEmbeddedDocuments('Item', [{
      name: 'BF Combat Superiority', type: 'feat',
      system: { type: { value: 'feat' }, uses: { spent: 0, max: '4', recovery: [] } }
    }]);
    const [precisionItem, riposteItem] = await pc.createEmbeddedDocuments('Item', [
      { name: 'Precision Attack', type: 'feat',
        system: { type: { value: 'feat' }, activities: {
          bfprecision00000: {
            _id: 'bfprecision00000', type: 'utility',
            activation: { type: '', override: false },
            consumption: { targets: [{ type: 'itemUses', target: pool.id, value: '1' }] },
            roll: { formula: '1d8 + 20', name: 'Bonus' }
          }
        } } },
      { name: 'Riposte', type: 'feat',
        system: { type: { value: 'feat' }, activities: {
          bfriposte0000000: {
            _id: 'bfriposte0000000', type: 'damage',
            activation: { type: 'reaction', override: false },
            consumption: { targets: [{ type: 'itemUses', target: pool.id, value: '1' }] },
            damage: { parts: [{ custom: { enabled: true, formula: '1d8' }, types: ['slashing'] }] },
            target: { affects: { type: 'creature' } }
          }
        } } }
    ]);
    const poolUses = () => pc.items.get(pool.id)?.system.uses?.value ?? -1;
    log.push(`fixture: ${pc.name} · weapon ${enemyWeapon.name} · pool ${poolUses()}/4`);

    const mkToken = async (actor, x, y) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(),
          { x, y, actorId: actor.id, actorLink: true }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      return canvas.tokens.get(doc.id);
    };
    const pcToken = await mkToken(pc, 900, 900);
    const enemyToken = await mkToken(enemy, 1000, 900);
    const victimToken = await mkToken(victim, 1100, 900);
    if (!pcToken || !enemyToken || !victimToken) return { fatal: 'tokens never reached the canvas' };

    priorActor[victim.id] = {
      'system.attributes.ac.override': victim.system._source.attributes.ac.override ?? null,
      'system.attributes.hp.value': victim.system._source.attributes.hp.value
    };
    priorActor[enemy.id] = {
      'system.attributes.ac.override': enemy.system._source.attributes.ac.override ?? null,
      'system.attributes.hp.value': enemy.system._source.attributes.hp.value
    };
    const acFlat = (a, n) => a.update({
      'system.attributes.ac.override': n });

    const pcAttackAct = () => pc.items.find(i => i.name === enemyWeapon.name)
      ?.system.activities.find(a => a.type === 'attack');
    const enemyAttackAct = () => enemy.items.get(enemyWeapon.id)
      ?.system.activities.find(a => a.type === 'attack');

    const attack = async (activity, token, opts = {}) => {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      token.setTarget(true, { releaseOthers: true });
      await sleep(100);
      const use = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = use?.message?.id ?? null;
      const rolls = await activity.rollAttack({ advantage: false, disadvantage: true },
        { configure: false }, usageId ? { data: { 'system.origin': usageId } } : {});
      await sleep(200);
      return { usageId, msg: rolls?.[0]?.parent ?? null, roll: rolls?.[0] ?? null };
    };
    const until = async (fn, ms = 12000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
      return fn();
    };
    const waitDamage = (originId, ms = 10000) => until(() => game.messages.contents.find(x =>
      (x.type === 'damage')
      && (x._source.system?.origin === originId)), ms);
    const dialogsWith = text => [...document.querySelectorAll('.application')]
      .filter(el => (el.innerHTML ?? '').includes(text));
    /**
     * THE MERGED RESCUE WINDOW — precision no longer opens a popup of its own.
     *
     * ⚠ Since the rescue view merged the offer surfaces, a Battle Master holding a Bardic die
     * gets ONE window with a row per rescue rather than one popup per machine. So the control
     * is `[data-bf-rescue-action]` on a div and the old `Use <item name>` BUTTON is gone —
     * which is why matching on that label found nothing and reported "the popup did not open".
     * `Pass` is still a real footer button: it is the one thing that is not a choice between
     * features, and the spine sends it to every pending source.
     */
    const rescueWindow = (action = 'use') => [...document.querySelectorAll('.application')]
      .find(el => (el.tagName === 'DIALOG')
        && !!el.querySelector(`[data-bf-rescue-action="${action}"]`));
    const rescueRow = (win, action = 'use') =>
      win?.querySelector(`[data-bf-rescue-action="${action}"]`) ?? null;
    const closeDialogs = async text => {
      for (const el of dialogsWith(text)) {
        try { (el.querySelector('[data-action="close"]') ?? el.querySelector('.header-control'))?.click(); } catch {}
      }
      await sleep(300);
    };
    /** Attack until the fold stamps (a nat-20 hit stamps nothing and retries). */
    const missUntilStamped = async (activity, token, flagKey, tries = 8) => {
      for (let i = 0; i < tries; i++) {
        const { msg } = await attack(activity, token);
        const flag = await until(() => msg?.getFlag(MOD, flagKey), 4000);
        if (flag) return { msg, flag };
        log.push(`${flagKey}: attempt ${i + 1} did not stamp (hit or fumble) — retrying`);
        await closeDialogs('Weapon Mastery');
      }
      return { msg: null, flag: null };
    };

    const castAt = async (activity, token) => {
      // Two tries with a stamp-wait: the demand rides the dnd5e targets snapshot, and a
      // target that lands late stamps NOTHING (saves.js's targetless gate) — which is
      // indistinguishable from a product bug unless the retry is logged.
      for (let attempt = 1; attempt <= 2; attempt++) {
        game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
        token.setTarget(true, { releaseOthers: true });
        await sleep(250);
        const use = await activity.use({ subsequentActions: false }, { configure: false }, {});
        const card = use?.message?.id ? game.messages.get(use.message.id) : null;
        const stamped = await until(() => card?.getFlag(MOD, 'saves'), 5000);
        if (stamped) return card;
        log.push(`castAt: the demand did not stamp (attempt ${attempt}: card=${!!card}, userTargets=${game.user.targets.size}, `
          + `dnd5eTargets=${JSON.stringify((card?.system?.targets ?? []).map(t => ({ ...t, uuid: t.actor })).map(t => t.name))}, `
          + `tokenDestroyed=${!!token?.destroyed}, tokenActor=${token?.actor?.name ?? null}) — retrying`);
      }
      return null;
    };
    // ⚠ The victim must be ALIVE before every bash cast: it is an NPC, earlier sections'
    // applied damage can leave it at 0, and the DEAD-TARGET GATE (walk item 11, correct
    // behaviour) then stamps nothing — which reads exactly like a product bug (it cost a
    // run to diagnose; the castAt retry log now names the gate's inputs for next time).
    const reviveVictim = () => victim.update({
      'system.attributes.hp.value': victim.system.attributes.hp.max });

    /* ============================================== P1+P2 — the Precision stamp gates */
    if (want('P')) {
      await acFlat(victim, 25);   // miss band: disadvantage total 6..25, nat-20 retries
      await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
      {
        const { msg, flag } = await missUntilStamped(pcAttackAct(), victimToken, 'precision');
        ok('P1. a clean miss stamps a pending precision offer',
          !!flag && (flag.status === 'pending') && (flag.itemName === 'Precision Attack')
            && (flag.targets?.length === 1),
          JSON.stringify({ status: flag?.status, targets: flag?.targets?.length }));
        const popup = await until(() => rescueWindow('use'), 6000);
        ok('P2. the offer window carries a pressable row and ONE Pass',
          !!popup && !!rescueRow(popup, 'use')
            && (popup.querySelectorAll('button[data-action="pass"]').length === 1),
          `popup=${!!popup} rows=${popup?.querySelectorAll('[data-bf-rescue-row]').length ?? 0}`);

        /* P3 — PASS: nothing rolls, the pool is untouched. */
        const usesBefore = poolUses();
        popup?.querySelector('button[data-action="pass"]')?.click();
        const resolved = await until(() => {
          const p = msg.getFlag(MOD, 'precision');
          return (p?.status === 'resolved') ? p : null;
        }, 6000);
        const dmg = await waitDamage(msg._source.system?.origin, 2500);
        ok('P3. Pass — the miss stands, nothing rolls, the die is not spent',
          (resolved?.outcome === 'passed') && !dmg && (poolUses() === usesBefore),
          `outcome=${resolved?.outcome} dmg=${!!dmg} uses ${usesBefore}→${poolUses()}`);
      }

      /* P4 — a HIT stamps nothing. */
      {
        await acFlat(victim, 1);
        const { msg } = await attack(pcAttackAct(), victimToken);
        await sleep(1500);
        ok('P4. a hit stamps no precision offer',
          !!msg && !msg.getFlag(MOD, 'precision'),
          `flag=${!!msg?.getFlag(MOD, 'precision')}`);
        await waitDamage(msg?._source.system?.origin, 8000); // let the chain finish
        await acFlat(victim, 25);
      }

      /* P5 — ACCEPT: the die is spent, the verdict flips, the damage chain runs, applied. */
      {
        await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
        const hpBefore = victim.system.attributes.hp.value;
        const usesBefore = poolUses();
        const { msg, flag } = await missUntilStamped(pcAttackAct(), victimToken, 'precision');
        if (!flag) {
          ok('P5. accept — the die spends, the verdict flips, damage lands', false, 'no stamp in 8 tries');
        } else {
          const popup = await until(() => rescueWindow('use'), 6000);
          rescueRow(popup, 'use')?.click();
          const resolved = await until(() => {
            const p = msg.getFlag(MOD, 'precision');
            return ((p?.status === 'resolved') && (p.outcome === 'used')) ? p : null;
          }, 15000);
          ok('P5a. accept — the pool spends exactly one use and the die is recorded',
            !!resolved && (poolUses() === usesBefore - 1) && (resolved.die >= 21),
            `uses ${usesBefore}→${poolUses()} die=${resolved?.die}`);
          ok('P5b. the verdict flips through the shared channel ("now hits")',
            resolved?.targets?.[0]?.verdict === 'hit',
            JSON.stringify(resolved?.targets));
          const dieMsg = game.messages.contents.find(m =>
            (m.getFlag(MOD, 'respondsTo') === msg.id) && m.rolls?.length);
          ok('P5c. the die rolled PUBLICLY with provenance (respondsTo the attack)',
            !!dieMsg, `dieMsg=${!!dieMsg}`);
          // The re-drive stamps the FLAT originating key — the exact property the riders key
          // on (riderTargets branch 1), so this single assert pins the per-roll rider ruling's
          // mechanism without a full rider fixture.
          const dmg = await waitDamage(msg._source.system?.origin, 12000);
          const applied = await until(() => {
            const r = dmg?.getFlag(MOD, 'receipt');
            return r?.targets?.some(t => t.uuid === victim.uuid) ? r : null;
          }, 10000);
          ok('P5d. the re-driven damage lands and APPLIES to the flipped target',
            !!dmg && !!applied && (victim.system.attributes.hp.value < hpBefore),
            `dmg=${!!dmg} applied=${!!applied} hp ${hpBefore}→${victim.system.attributes.hp.value}`);
          const announce = game.messages.contents.find(m =>
            (m.timestamp >= suiteStart) && /now hits/.test(m.content ?? ''));
          ok('P5e. the arithmetic announces ("A + die = B vs AC — now hits")',
            !!announce, `announce=${!!announce}`);
        }
      }

      /* P6 — the hopeless gate: an unreachable AC is never offered (math shown). */
      {
        await set('holdSkipFutile', true);
        await acFlat(victim, 60);
        const { msg } = await attack(pcAttackAct(), victimToken);
        await sleep(1500);
        ok('P6. hopeless (margin beyond the maximised die) — no offer, the miss just stands',
          !!msg && !msg.getFlag(MOD, 'precision'),
          `flag=${!!msg?.getFlag(MOD, 'precision')}`);
        await set('holdSkipFutile', false);
        await acFlat(victim, 25);
      }

      /* P7 — the buzzer passes an unanswered offer. */
      {
        await set('holdTimer', 2);
        const usesBefore = poolUses();
        const { msg, flag } = await missUntilStamped(pcAttackAct(), victimToken, 'precision');
        if (!flag) {
          ok('P7. the buzzer passes', false, 'no stamp in 8 tries');
        } else {
          const resolved = await until(() => {
            const p = msg.getFlag(MOD, 'precision');
            return (p?.status === 'resolved') ? p : null;
          }, 10000);
          const dmg = await waitDamage(msg._source.system?.origin, 2000);
          ok('P7. left alone — the buzzer answers Pass, nothing rolls, nothing spends',
            (resolved?.outcome === 'passed (timer)') && !dmg && (poolUses() === usesBefore),
            `outcome=${resolved?.outcome} uses ${usesBefore}→${poolUses()}`);
        }
        await set('holdTimer', 0);
        await closeDialogs('Precision');
      }
    }

    /* ============================================== R1+R2 — the Riposte offer + the driven attack */
    if (want('R')) {
      await acFlat(pc, 40);   // the enemy always misses the PC
      await acFlat(enemy, 1);              // the riposte always hits back (a fumble retries below)
      {
        const usesBefore = poolUses();
        const { msg, flag } = await missUntilStamped(enemyAttackAct(), pcToken, 'riposte');
        ok('R1. an enemy MELEE miss offers the riposte to the missed reactor',
          !!flag && (flag.status === 'pending') && (flag.reactors?.length === 1)
            && (flag.reactors[0].uuid === pc.uuid) && (flag.attackerUuid === enemy.uuid),
          JSON.stringify({ reactors: flag?.reactors?.map(r => r.name),
            attackerUuid: flag?.attackerUuid, want: enemy.uuid }));
        const popup = await until(() => dialogsWith('Riposte with')[0], 6000);
        // v1.19.x finding ④: ONE equipped melee weapon skips the dropdown — the popup NAMES it.
        ok('R2a. the popup carries Riposte/Pass and NAMES the single weapon (no dropdown, ④)',
          !!popup && !!popup.querySelector('button[data-action="riposte"]')
            && !popup.querySelector('select[name="bf-riposte-weapon"]')
            && (popup.innerHTML ?? '').includes(enemyWeapon.name),
          `popup=${!!popup} select=${!!popup?.querySelector('select[name="bf-riposte-weapon"]')}`);

        popup?.querySelector('button[data-action="riposte"]')?.click();
        const driven = await until(() => game.messages.contents.find(m =>
          (m.getFlag(MOD, 'riposteFor') === msg?.id) && (m.getFlag(MOD, 'riposteBy') === pc.uuid)), 15000);
        ok('R2b. accepting drives a REAL attack carrying its provenance, aimed at the attacker',
          !!driven && (driven.type === 'attack')
            && (driven.system?.targets ?? []).map(t => ({ ...t, uuid: t.actor })).some(t => t.uuid === enemy.uuid),
          `driven=${!!driven} targets=${JSON.stringify(driven?.system?.targets?.map(t => t.name))}`);
        ok('R2c. the maneuver really spent — the pool is down one',
          poolUses() === usesBefore - 1, `uses ${usesBefore}→${poolUses()}`);

        const drivenRoll = driven?.rolls?.[0];
        if (drivenRoll?.isFumble) {
          skips.push('R2d/e — the driven attack rolled a natural 1 (miss); die-in-damage not exercised this run');
        } else {
          const dmg = await waitDamage(driven?._source.system?.origin, 12000);
          // v1.19.x finding (d): the die folds INTO the base roll — ONE dice group, one
          // total. Weapon d8 + die d8 ⇒ exactly two d8 TERMS in a single roll — counted by
          // GROUP, not by literal "1d8": a driven CRIT doubles both to 2d8 (the 2024 rule,
          // recorded in DESIGN.md), and the literal count read a crit as "no die" (flaked
          // round 3, formula "2d8 + 3 + 2d8").
          const d8s = (dmg?.rolls?.[0]?.formula?.match(/\d+d8/g) ?? []).length;
          ok('R2d. the superiority die is BAKED INTO the base damage roll — one group ((d))',
            !!dmg && (dmg.rolls?.length === 1) && (d8s === 2),
            `dmg=${!!dmg} rolls=${dmg?.rolls?.length} d8Groups=${d8s} formula=${dmg?.rolls?.[0]?.formula}`);
          const receipt = await until(() => dmg?.getFlag(MOD, 'receipt'), 8000);
          ok('R2e. the driven chain applies like any real attack (receipt on the enemy)',
            !!receipt?.targets?.some(t => t.uuid === enemy.uuid),
            `receipt=${!!receipt}`);
        }
        ok('R2f. out of combat no Reaction chip is written (no turn to bring it back)',
          !reactionChip(pc),
          `chip=${reactionChip(pc)}`);
        const rFlag = msg?.getFlag(MOD, 'riposte');
        ok('R2g. the chosen weapon is RECORDED on the fold — the card can name it (④)',
          rFlag?.reactors?.[0]?.weaponName === enemyWeapon.name,
          `weaponName=${rFlag?.reactors?.[0]?.weaponName} want=${enemyWeapon.name}`);

        // (v) walk-4: the maneuver's own use must NOT chain dnd5e's follow-up damage roll —
        // the walk found a native "Damage Roll — Riposte" config dialog orphaned over the
        // table (the bare superiority d8; subsequentActions:false pins it shut now). The
        // orphan opened ASYNC beside the drive, so this is a negative assert after a settle.
        await sleep(1200);
        const orphan = [...document.querySelectorAll('.application')].find(el =>
          (el.querySelector('.window-title')?.textContent ?? '').includes('Damage Roll')
          && (el.innerHTML ?? '').includes('Riposte'));
        ok('R2h. (v) no native damage dialog orphans off the maneuver use',
          !orphan, `orphanDialog=${!!orphan}`);
      }

      /* R3 — a spent reaction is never offered. */
      {
        await spendReactionOf(pc);
        const { msg } = await attack(enemyAttackAct(), pcToken);
        await sleep(1500);
        ok('R3. a standing Reaction chip suppresses the offer entirely',
          !!msg && !msg.getFlag(MOD, 'riposte'),
          `offered=${!!msg?.getFlag(MOD, 'riposte')}`);
        await clearReaction(pc);
      }

      /* R4 — a RANGED miss never offers. */
      {
        const importByName = async name => {
          for (const p of game.packs.filter(p => p.documentName === 'Item')) {
            const e = p.index.find(i => i.name === name);
            if (e) { const d = await p.getDocument(e._id); return d.toObject(); }
          }
          return null;
        };
        const bowSrc = await importByName('Shortbow');
        if (bowSrc) {
          const [bow] = await enemy.createEmbeddedDocuments('Item', [
            { ...bowSrc, name: 'BF Test Bow', system: { ...bowSrc.system, equipped: true } }]);
          created.enemyItems.push(bow.id);
          const bowAct = bow.system.activities?.contents?.find(a => a.type === 'attack');
          game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
          pcToken.setTarget(true, { releaseOthers: true });
          await sleep(100);
          const use = await bowAct.use({ subsequentActions: false }, { configure: false }, {});
          const rolls = await bowAct.rollAttack({ advantage: false, disadvantage: true },
            { configure: false }, { data: { 'system.origin': use?.message?.id } });
          await sleep(1800);
          const msg = rolls?.[0]?.parent;
          ok('R4. a ranged miss offers nothing — the fold is melee-gated',
            !!msg && !msg.getFlag(MOD, 'riposte'),
            `flag=${!!msg?.getFlag(MOD, 'riposte')}`);
        } else {
          skips.push('R4 — no Shortbow in any pack; ranged gate not exercised');
        }
      }

      /* R5 — decline: nothing drives, nothing spends. */
      {
        const usesBefore = poolUses();
        const { msg, flag } = await missUntilStamped(enemyAttackAct(), pcToken, 'riposte');
        if (!flag) {
          ok('R5. decline — nothing drives', false, 'no stamp in 8 tries');
        } else {
          const popup = await until(() => dialogsWith('Riposte with')[0], 6000);
          popup?.querySelector('button[data-action="pass"]')?.click();
          const resolved = await until(() => {
            const r = msg.getFlag(MOD, 'riposte');
            return (r?.status === 'resolved') ? r : null;
          }, 6000);
          await sleep(800);
          const driven = game.messages.contents.find(m => m.getFlag(MOD, 'riposteFor') === msg.id);
          ok('R5. decline — no driven attack, the die stays in the pool',
            (resolved?.reactors?.[0]?.answer === 'declined') && !driven && (poolUses() === usesBefore),
            `answer=${resolved?.reactors?.[0]?.answer} driven=${!!driven}`);
        }
      }

      /* R6 — a DRIVEN attack never chains a second offer, even at an eligible reactor. */
      {
        // Make the ENEMY riposte-eligible (own pool + Riposte + melee weapon already equipped),
        // then force the PC's driven attack to miss them — the riposteFor guard is now the ONLY
        // thing standing between that miss and a chained offer.
        const [ePool] = await enemy.createEmbeddedDocuments('Item', [{
          name: 'BF Enemy Superiority', type: 'feat',
          system: { type: { value: 'feat' }, uses: { spent: 0, max: '4', recovery: [] } }
        }]);
        created.enemyItems.push(ePool.id);
        const [eRiposte] = await enemy.createEmbeddedDocuments('Item', [{
          name: 'Riposte', type: 'feat',
          system: { type: { value: 'feat' }, activities: {
            bfriposteenemy00: {
              _id: 'bfriposteenemy00', type: 'damage',
              activation: { type: 'reaction', override: false },
              consumption: { targets: [{ type: 'itemUses', target: ePool.id, value: '1' }] },
              damage: { parts: [{ custom: { enabled: true, formula: '1d8' }, types: ['slashing'] }] },
              target: { affects: { type: 'creature' } }
            }
          } } }]);
        created.enemyItems.push(eRiposte.id);
        await acFlat(enemy, 40);   // the driven attack will MISS the now-eligible enemy
        const { msg, flag } = await missUntilStamped(enemyAttackAct(), pcToken, 'riposte');
        if (!flag) {
          ok('R6. a driven attack never re-offers', false, 'no stamp in 8 tries');
        } else {
          const popup = await until(() => dialogsWith('Riposte with')[0], 6000);
          popup?.querySelector('button[data-action="riposte"]')?.click();
          const driven = await until(() => game.messages.contents.find(m =>
            (m.getFlag(MOD, 'riposteFor') === msg.id) && (m.getFlag(MOD, 'riposteBy') === pc.uuid)), 15000);
          await sleep(2000);   // the stamp hook would need a beat to fire, if it wrongly did
          ok('R6. the driven attack misses an ELIGIBLE reactor and still never chains an offer',
            !!driven && !driven.getFlag(MOD, 'riposte'),
            `driven=${!!driven} chained=${!!driven?.getFlag(MOD, 'riposte')}`);
          // (p) the announced miss: the strike back never ends in silence — the card posts
          // BEFORE any Graze/Precision offer can arrive from nowhere ((e)-KEEP still fires).
          //
          // ⚠ A NATURAL 20 AUTO-HITS THROUGH FLAT AC 40, and then the miss card correctly never
          // posts — the hit's moment is the damage offer instead. That is a 1-in-20 per run, and
          // it is what produced the 53/54 seen 2026-08-23. R6 above cannot catch it: its
          // predicate only checks that the driven attack EXISTS and never chained, so it passes
          // on a hit too and R6b took the failure alone. Skipped rather than failed, the same
          // way R2d/e and RP already skip on a natural 1 defeating THEIR forcing.
          const drivenCrit = driven?.rolls?.[0]?.isCritical === true;
          if (drivenCrit) {
            skips.push('R6b — the driven attack rolled a natural 20 and auto-hit through flat AC 40; '
              + 'the miss announcement cannot post, so (p) is not exercised this run');
          } else {
            const missCard = await until(() => game.messages.contents.find(m => (m.timestamp >= suiteStart)
              && /the strike back misses/.test(m.content ?? '')), 6000);
            ok('R6b. (p) the driven MISS announces itself — "the strike back misses" posts',
              !!missCard, `card=${!!missCard}`);
          }
        }
        await closeDialogs('Precision');   // the PC's own precision may have offered on that miss
        await closeDialogs('Riposte');
      }
    }

    /* ============================================== P8 — finding ①: player-owned, owner OFFLINE */
    if (want('P8')) {
      // The walk's regression: the old fold gate (`isGM && hasPlayerOwner`) was mutually
      // exclusive with canAnswerFor's own active-owner check, so a GM alone in the room got
      // the card and the buzzer but never the popup. Ruling: player-first, GM fallback.
      {
        const playerUser = game.users.find(u => !u.isGM);
        if (!playerUser) {
          skips.push('P8 — no player user in this world; the ①-gate pin not exercised');
        } else {
          // Object form, never a dotted key — the dotted write raises "ownership: is not a
          // mapping" validation noise; and the ownership must PROVABLY land or this pin
          // passes vacuously (the popup shows either way when hasPlayerOwner stayed false).
          await pc.update({ ownership: { [playerUser.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
          ok('P8a. the fixture is really player-owned (the pin cannot pass vacuously)',
            pc.hasPlayerOwner === true, `hasPlayerOwner=${pc.hasPlayerOwner}`);
          const { msg, flag } = await missUntilStamped(pcAttackAct(), victimToken, 'precision');
          if (!flag) {
            ok('P8b. player-owned attacker, owner offline — the GM STILL gets the popup (①)', false, 'no stamp in 8 tries');
          } else {
            const popup = await until(() => rescueWindow('use'), 6000);
            ok('P8b. player-owned attacker, owner offline — the GM STILL gets the popup (①)',
              !!popup, `popup=${!!popup}`);
            popup?.querySelector('button[data-action="pass"]')?.click();
            await until(() => msg.getFlag(MOD, 'precision')?.status === 'resolved', 6000);
          }
          await pc.update({ ownership: { [playerUser.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE } });
        }
      }
    }

    /* ============================================== M1 — finding ④: two weapons, smart default */
    if (want('M1')) {
      {
        const [offhand] = await pc.createEmbeddedDocuments('Item', [
          foundry.utils.mergeObject(enemyWeapon.toObject(), {
            name: 'BF Test Offhand', system: { equipped: true } }, { inplace: false })]);
        // Attack once WITH the offhand so it becomes the log's latest — the default must track
        // USAGE, not inventory order (options[0] is the original weapon).
        const offAct = pc.items.get(offhand.id)?.system.activities.find(a => a.type === 'attack');
        await acFlat(victim, 1);
        const { msg: offMsg } = await attack(offAct, victimToken);
        await waitDamage(offMsg?._source.system?.origin, 8000);
        await acFlat(victim, 25);
        await closeDialogs('Weapon Mastery');

        const { msg, flag } = await missUntilStamped(enemyAttackAct(), pcToken, 'riposte');
        if (!flag) {
          ok('M1. two weapons — the dropdown returns, preselected to the LAST-ATTACKED (④)', false, 'no stamp in 8 tries');
        } else {
          const popup = await until(() => dialogsWith('Riposte with')[0], 6000);
          const select = popup?.querySelector('select[name="bf-riposte-weapon"]');
          ok('M1. two weapons — the dropdown returns, preselected to the LAST-ATTACKED (④)',
            !!select && (select.value === offhand.id),
            `select=${!!select} value=${select?.value} want=${offhand.id}`);
          popup?.querySelector('button[data-action="pass"]')?.click();
          await until(() => msg.getFlag(MOD, 'riposte')?.status === 'resolved', 6000);
        }
        await pc.deleteEmbeddedDocuments('Item', [offhand.id]).catch(() => {});
        await closeDialogs('Riposte');
      }
    }

    /* ============================================== RP — (l)+(p): the riposte HIT celebrates */
    if (want('RP')) {
      {
        await pc.items.get(pool.id)?.update({ 'system.uses.spent': 0 });   // top the pool back up
        await set('playerRollDamage', true);
        await acFlat(enemy, 1);   // the strike back always hits
        const { msg, flag } = await missUntilStamped(enemyAttackAct(), pcToken, 'riposte');
        if (!flag) {
          ok('RP1. (l)/(p) the damage offer celebrates the riposte BY NAME, die note aboard', false, 'no stamp in 8 tries');
        } else {
          const popup = await until(() => dialogsWith('Riposte with')[0], 6000);
          popup?.querySelector('button[data-action="riposte"]')?.click();
          const driven = await until(() => game.messages.contents.find(m =>
            (m.getFlag(MOD, 'riposteFor') === msg.id) && (m.getFlag(MOD, 'riposteBy') === pc.uuid)), 15000);
          if (!driven || driven.rolls?.[0]?.isFumble) {
            skips.push('RP — the driven attack fumbled (nat 1 vs flat AC 1); the celebration popup not exercised this run');
            await closeDialogs('Precision');
          } else {
            // The offer popup on the DRIVING client — the riposte named as its own moment with
            // the die-riding note ((p)'s hit half; (l): the one chokepoint, consistent flavors).
            const offer = await until(() => [...document.querySelectorAll('.application')]
              .find(el => el.querySelector('button[data-action="roll"]') && /riposte/i.test(el.innerHTML ?? '')), 8000);
            const title = offer?.querySelector('.window-title')?.textContent ?? '';
            ok('RP1. (l)/(p) the damage offer celebrates the riposte BY NAME, die note aboard',
              !!offer && /riposte/i.test(title) && /roll damage/i.test(title)
                && /superiority die rides this roll/i.test(offer?.innerHTML ?? ''),
              `offer=${!!offer} title="${title}"`);
            offer?.querySelector('button[data-action="roll"]')?.click();
            const dmg = await waitDamage(driven?._source.system?.origin, 12000);
            ok('RP2. the celebrated button rolls through the same chokepoint — the damage lands',
              !!dmg, `dmg=${!!dmg}`);
          }
        }
        await set('playerRollDamage', false);
        await closeDialogs('Riposte');
        await closeDialogs('Weapon Mastery');
      }
    }

    /* ============================================== B — finding ⑤: the bash choice (Prone or push) */
    if (want('B')) {
      await set('saves', true);
      await set('maneuverFolds', 'Precision Attack:precision, Riposte:riposte, '
        + 'BF Shield Master:bash, BF Shield Master:interpose, BF Great Weapon Master:hew');
      // The bash fixture: a listed feat whose save activity presses an effect on failure —
      // the Shield Bash shape (DC 30 so the victim ALWAYS fails; effect wired by REAL id
      // after creation, never by assumed keepId).
      const [bashFeat] = await pc.createEmbeddedDocuments('Item', [{
        name: 'BF Shield Master', type: 'feat',
        system: { type: { value: 'feat' }, activities: {
          bfbash0000000000: {
            _id: 'bfbash0000000000', type: 'save',
            activation: { type: '', override: false },
            damage: { parts: [], onSave: 'half' },
            effects: [],
            save: { ability: ['str'], dc: { calculation: '', formula: '30' } },
            target: { affects: { type: 'creature' } }
          }
        } },
        effects: [{ name: 'BF Test Prone', icon: 'icons/svg/falling.svg',
          transfer: false, statuses: ['prone'] }]
      }]);
      const proneEffect = bashFeat.effects.contents[0];
      await bashFeat.update({
        'system.activities.bfbash0000000000.effects': [{ _id: proneEffect.id, onSave: false }] });
      const bashAct = () => pc.items.get(bashFeat.id)?.system.activities.get('bfbash0000000000');

      /* B1 — the failed save opens the choice; the verdict line is source-first, saver-spoken. */
      {
        await reviveVictim();
        const card = await castAt(bashAct(), victimToken);
        const choice = await until(() => {
          const t = card?.getFlag(MOD, 'saves')?.targets?.[0];
          return (t?.choice && !t.choice.answer) ? t.choice : null;
        }, 20000);
        ok('B1a. a failed listed save opens the bash choice instead of hard-pressing (⑤)',
          choice?.kind === 'bash',
          `choice=${choice ? choice.kind : JSON.stringify(card?.getFlag(MOD, 'saves')?.targets?.[0] ?? null)}`);
        // The v1.19.0 verdict line is RETIRED (2026-09-18): the usage card carries the verdict —
        // in the platform's summary row or its own line — and no public card posts for it.
        const verdictCards = game.messages.contents.filter(m => m.getFlag(MOD, 'verdictLine')?.sourceMessageId === card?.id);
        const cardTextB1 = () => (ui.chat.element?.querySelector(`.message[data-message-id="${card?.id}"]`)?.textContent ?? '').replace(/\s+/g, ' ');
        const onCardB1 = await until(() => /vs DC \d+ — failed/.test(cardTextB1()) ? cardTextB1() : null, 6000);
        ok('B1b. the verdict is on the usage card — "vs DC … — failed" — and no public verdict card posts (the line retired 2026-09-18)',
          !!onCardB1 && (verdictCards.length === 0),
          `cards=${verdictCards.length} text="${(onCardB1 ?? cardTextB1()).slice(0, 160)}"`);
        const popup = await until(() => dialogsWith('Knock Prone')[0], 6000);
        ok('B1c. the choice popup carries Knock Prone / Push 5 feet, quotes the feat verbatim ((z)) and tooltips its icon ((aa))',
          !!popup && !!popup.querySelector('button[data-action="prone"]')
            && !!popup.querySelector('button[data-action="push"]')
            && (popup.textContent ?? '').includes('cause it to have the Prone condition')
            && !!popup.querySelector('img[data-tooltip]'),
          `popup=${!!popup} verbatim=${(popup?.textContent ?? '').includes('cause it to have the Prone condition')} tooltip=${!!popup?.querySelector('img[data-tooltip]')}`);
        popup?.querySelector('button[data-action="push"]')?.click();
        const applied = await until(() => card?.getFlag(MOD, 'saves')?.targets?.[0]?.applied, 15000);
        const pressed = victim.effects.some(e => e.name === 'BF Test Prone');
        const pushMsg = game.messages.contents.find(m => (m.timestamp >= suiteStart)
          && /pushes .* 5 feet/.test(m.content ?? ''));
        ok('B1d. push — NO press lands (custom or standard), the announce card does (the Push idiom)',
          !!applied && !pressed && !victim.statuses.has('prone') && !!pushMsg,
          `applied=${!!applied} pressed=${pressed} prone=${victim.statuses.has('prone')} pushMsg=${!!pushMsg}`);
      }

      /* B2 — (x): the prone answer presses the STANDARD Prone chip (Topple's forceStatus
       * idiom — canonical id, origin names the presser), never the item's own effect. */
      {
        await reviveVictim();
        await victim.effects.find(e => e.statuses.has('prone'))?.delete().catch(() => {});
        const card = await castAt(bashAct(), victimToken);
        const popup = await until(() => dialogsWith('Knock Prone')[0], 20000);
        popup?.querySelector('button[data-action="prone"]')?.click();
        const applied = await until(() => card?.getFlag(MOD, 'saves')?.targets?.[0]?.applied, 15000);
        const chip = await until(() => victim.effects.find(e => e.statuses.has('prone')), 6000);
        ok('B2. (x) prone — the STANDARD Prone chip lands: canonical id, attacker origin, no custom effect',
          !!applied && (chip?.id === 'dnd5eprone000000') && (chip?.origin === pc.uuid)
            && !victim.effects.some(e => e.name === 'BF Test Prone'),
          `applied=${!!applied} chip=${chip?.id ?? null} origin=${chip?.origin ?? null} want=${pc.uuid} `
            + `custom=${victim.effects.some(e => e.name === 'BF Test Prone')}`);
        await chip?.delete().catch(() => {});
      }

      /* B3 — the choice bar is VISIBLE ((n)), then the buzzer defaults to Prone and says so. */
      {
        await set('holdTimer', 4);
        await reviveVictim();
        await victim.effects.find(e => e.statuses.has('prone'))?.delete().catch(() => {});
        const card = await castAt(bashAct(), victimToken);
        // (n): the pending choice draws its bar — card row AND popup — through momentBarHTML.
        // The DOM is the assertion, because every flag-level one passed for a whole round
        // while nothing rendered (the sub-object has no `status`; the status-gated wrapper
        // silently returned "" at both call sites).
        const choiceStamped = await until(() => {
          const x = card?.getFlag(MOD, 'saves')?.targets?.[0];
          return (x?.choice && !x.choice.answer) ? x.choice : null;
        }, 20000);
        const choicePopup = await until(() => dialogsWith('Knock Prone')[0], 4000);
        const cardBar = await until(() => document.querySelector(
          `.message[data-message-id="${card?.id}"] [data-bf-deadline]`), 3000);
        const popupBar = choicePopup?.querySelector('[data-bf-deadline]') ?? null;
        ok('B3a. (n) the pending choice bar RENDERS — card row and popup both carry data-bf-deadline',
          !!choiceStamped?.deadline && !!cardBar && !!popupBar,
          `deadline=${!!choiceStamped?.deadline} cardBar=${!!cardBar} popupBar=${!!popupBar}`);
        const t = await until(() => {
          const x = card?.getFlag(MOD, 'saves')?.targets?.[0];
          return (x?.choice?.answer && x.applied) ? x : null;
        }, 25000);
        const chip = victim.effects.find(e => e.statuses.has('prone'));
        ok('B3. left alone — the buzzer defaults the bash to Prone (the (x) standard chip, stated on the card)',
          (t?.choice?.answer === 'prone') && !!t?.choice?.timedOut && (chip?.id === 'dnd5eprone000000'),
          `answer=${t?.choice?.answer} timedOut=${!!t?.choice?.timedOut} chip=${chip?.id ?? null}`);
        await chip?.delete().catch(() => {});
        await set('holdTimer', 0);
        await closeDialogs('BF Shield Master');
      }

      /* B4 — finding (g): the HIT is the trigger — offer → drive → demand → choice → press. */
      {
        // Unkillable for the section: the swing's auto-applied damage must never turn the
        // demand's target into a corpse mid-chain (the dead gate would eat it silently).
        priorActor[victim.id]['system.attributes.hp.max'] = victim.system._source.attributes.hp.max;
        await victim.update({ 'system.attributes.hp.max': 1000, 'system.attributes.hp.value': 1000 });
        await acFlat(victim, 1);
        await victim.effects.find(e => e.statuses.has('prone'))?.delete().catch(() => {});
        // THE FEAT'S REACH (Session 8, 2026-09-22 — the bash offered on hits beyond 5 feet): "if
        // you attack a creature within 5 feet of you". The PC stands two squares off; a HIT from
        // there stamps nothing. Then the PC steps beside the target, where the chain below runs.
        {
          let far = null;
          for (let i = 0; i < 4 && !far; i++) {
            const { msg, roll } = await attack(pcAttackAct(), victimToken);
            if (roll && !roll.isFumble) far = msg;
          }
          await sleep(2500);
          const feet = canvas.grid.measurePath([pcToken.center, victimToken.center]).distance;
          ok('B4e. a HIT from beyond 5 feet stamps no bash offer — the feat\'s own reach (Session 8)',
            !!far && (feet > 5) && !far.getFlag(MOD, 'bashOffer'),
            `hit=${!!far} feet=${feet} offer=${JSON.stringify(far?.getFlag(MOD, 'bashOffer') ?? null)}`);
        }
        const pcHome = { x: pcToken.document.x, y: pcToken.document.y };
        await pcToken.document.update({ x: victimToken.document.x, y: victimToken.document.y + canvas.grid.size },
          { animate: false });
        await sleep(500);
        let offer = null, atkMsg = null, queuedFirst = null, dmgAtPromotion = null;
        for (let i = 0; i < 6 && !offer; i++) {
          const { msg } = await attack(pcAttackAct(), victimToken);
          atkMsg = msg;
          // THE SEQUENCE (user ruling 2026-09-13): the hit stamps the offer QUEUED, and it goes
          // pending only once the damage has landed — the clock starts then, not at the hit.
          const stamped = await until(() => msg?.getFlag(MOD, 'bashOffer'), 4000);
          if (stamped) {
            queuedFirst = stamped.status;
            offer = await until(() => {
              const b = msg?.getFlag(MOD, 'bashOffer');
              return (b?.status === 'pending') ? b : null;
            }, 12000);
            const dmg = offer ? await waitDamage(msg?._source.system?.origin, 500) : null;
            dmgAtPromotion = dmg ? dmg.timestamp : null;
          }
          if (!offer) log.push(`B4: attempt ${i + 1} produced no offer (miss/fumble) — retrying`);
        }
        ok('B4a. a melee weapon HIT by the listed carrier stamps the bash offer ((g))',
          (offer?.status === 'pending') && ((offer?.targets ?? []).length === 1),
          `offer=${!!offer} targets=${offer?.targets?.length}`);
        // (holdTimer is 0 in this section — a clockless ask by setting — so the proof of "the clock
        // starts at the promotion" is promotedAt, stamped by the promote write, after the damage.)
        ok('B4a2. THE SEQUENCE — stamped queued at the hit, pending only after the damage landed, promoted after it',
          (queuedFirst === 'queued') && Number.isFinite(dmgAtPromotion) && Number.isFinite(offer?.promotedAt)
            && (offer.promotedAt >= dmgAtPromotion) && (offer.promotedAt > (atkMsg?.timestamp ?? 0)),
          `first=${queuedFirst} damageAt=${dmgAtPromotion} promotedAt=${offer?.promotedAt} attackAt=${atkMsg?.timestamp}`);
        const popup = await until(() => dialogsWith('— bash')[0], 6000);
        ok('B4b. the offer popup carries Use/Pass',
          !!popup && !!popup.querySelector('button[data-action="use"]')
            && !!popup.querySelector('button[data-action="pass"]'),
          `popup=${!!popup}`);
        popup?.querySelector('button[data-action="use"]')?.click();
        const usage = await until(() => game.messages.contents.find(m =>
          m.getFlag(MOD, 'bashFor') === atkMsg?.id), 12000);
        ok('B4c. accepting drives the feat\'s OWN save activity, provenance-stamped',
          !!usage && !!(await until(() => usage?.getFlag(MOD, 'saves'), 8000)),
          `usage=${!!usage} demand=${!!usage?.getFlag(MOD, 'saves')}`);
        const choicePopup = await until(() => dialogsWith('Knock Prone')[0], 25000);
        choicePopup?.querySelector('button[data-action="prone"]')?.click();
        const applied = await until(() => usage?.getFlag(MOD, 'saves')?.targets?.[0]?.applied, 15000);
        const chip = await until(() => victim.effects.find(e => e.statuses.has('prone')), 6000);
        ok('B4d. the driven demand fails and the chosen press lands the (x) standard chip — end to end',
          !!applied && (chip?.id === 'dnd5eprone000000'), `applied=${!!applied} chip=${chip?.id ?? null}`);
        await chip?.delete().catch(() => {});
        await pcToken.document.update(pcHome, { animate: false });
        await acFlat(victim, 25);
        await closeDialogs('BF Shield Master');
      }
    }

    /* ============================================== I — finding ⑥: Interpose (save-success reaction) */
    if (want('I')) {
      // The saver's side: an equipped shield + the listed feat on the VICTIM, a DEX half-damage
      // demand from the PC (DC 1 + dex 16 so the victim ALWAYS saves).
      priorActor[victim.id]['system.abilities.dex.value'] = victim.system._source.abilities.dex.value;
      await victim.update({ 'system.abilities.dex.value': 16 });
      {
        const [shield] = await victim.createEmbeddedDocuments('Item', [{
          name: 'BF Test Shield', type: 'equipment',
          system: { type: { value: 'shield' }, equipped: true, armor: { value: 2 } }
        }]);
        created.victimItems.push(shield.id);
        const [interposeFeat] = await victim.createEmbeddedDocuments('Item', [{
          name: 'BF Shield Master', type: 'feat', system: { type: { value: 'feat' } } }]);
        created.victimItems.push(interposeFeat.id);
      }
      const [dexBlast] = await pc.createEmbeddedDocuments('Item', [{
        name: 'BF Test Dex Blast', type: 'feat',
        system: { type: { value: 'feat' }, activities: {
          bfdexblast000000: {
            _id: 'bfdexblast000000', type: 'save',
            activation: { type: '', override: false },
            damage: { parts: [{ custom: { enabled: true, formula: '10' }, types: ['fire'] }], onSave: 'half' },
            save: { ability: ['dex'], dc: { calculation: '', formula: '1' } },
            target: { affects: { type: 'creature' } }
          }
        } } }]);
      const dexAct = () => pc.items.get(dexBlast.id)?.system.activities.get('bfdexblast000000');

      /* I1 — walk-5 (y): NOTHING stamps with the demand; the SAVED verdict opens the choice;
       * use turns the half into NONE. The 2024 text conditions the Reaction on succeeding. */
      {
        await set('saveTimer', 1);    // the verdict lands fast — the choice is what we watch
        await set('holdTimer', 15);   // the post-verdict choice window — room to click
        await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
        const hpBefore = victim.system.attributes.hp.value;
        const card = await castAt(dexAct(), victimToken);
        const early = card?.getFlag(MOD, 'saves')?.targets?.[0];
        ok('I1a. (y) nothing stamps with the demand — the choice is the VERDICT\'s to open',
          !early?.choice && (early?.done === false),
          `choice=${JSON.stringify(early?.choice ?? null)} done=${early?.done}`);
        const opened = await until(() => {
          const t = card?.getFlag(MOD, 'saves')?.targets?.[0];
          return (t?.done && (t.outcome === 'saved') && t.choice && !t.choice.answer) ? t : null;
        }, 20000);
        ok('I1b. (y) the SAVED verdict opens the interpose choice — post-verdict, success-only',
          opened?.choice?.kind === 'interpose',
          `outcome=${opened?.outcome} kind=${opened?.choice?.kind ?? null}`);
        const popup = await until(() => dialogsWith('take no damage')[0], 6000);
        ok('I1c. (z)+(aa) the popup quotes the feat verbatim, tooltips its icon, offers Use / Take half',
          !!popup && (popup.textContent ?? '').includes('holding a Shield')
            && !!popup.querySelector('img[data-tooltip]')
            && !!popup.querySelector('button[data-action="use"]')
            && !!popup.querySelector('button[data-action="pass"]'),
          `popup=${!!popup} verbatim=${(popup?.textContent ?? '').includes('holding a Shield')} `
            + `tooltip=${!!popup?.querySelector('img[data-tooltip]')}`);
        popup?.querySelector('button[data-action="use"]')?.click();
        const applied = await until(() => card?.getFlag(MOD, 'saves')?.targets?.[0]?.applied, 20000);
        const validation = game.messages.contents.find(m => (m.timestamp >= suiteStart)
          && /takes no damage/.test(m.content ?? ''));
        ok('I1d. use — the half becomes NONE, the settle card posts, no reaction flag out of combat',
          !!applied && (victim.system.attributes.hp.value === hpBefore) && !!validation
            && !reactionChip(victim),
          `applied=${!!applied} hp ${hpBefore}→${victim.system.attributes.hp.value} card=${!!validation}`);
        await set('holdTimer', 0);
        await closeDialogs('BF Shield Master');
      }

      /* I2 — the buzzer PASSES (a Reaction is never spent by a timer): the saved half applies.
       * Post-verdict since (y): verdict at ~1s (saveTimer), the choice buzzer 2s after. */
      {
        await set('holdTimer', 2);
        await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
        const hpBefore = victim.system.attributes.hp.value;
        const card = await castAt(dexAct(), victimToken);
        const t = await until(() => {
          const x = card?.getFlag(MOD, 'saves')?.targets?.[0];
          return (x?.choice?.answer && x.applied) ? x : null;
        }, 25000);
        const dropped = hpBefore - victim.system.attributes.hp.value;
        ok('I2. left alone — the buzzer passes and the saved HALF (5 of 10) applies normally',
          (t?.choice?.answer === 'pass') && !!t?.choice?.timedOut && (dropped === 5),
          `answer=${t?.choice?.answer} timedOut=${!!t?.choice?.timedOut} dropped=${dropped}`);
        await set('holdTimer', 0);
        await closeDialogs('BF Shield Master');
        await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
      }

      /* I3 — the (y) NEGATIVE: a FAILED save never offers and never spends — full damage,
       * no choice, no popup, no settle card. (The old pre-roll gamble is overturned.) */
      const [dexHard] = await pc.createEmbeddedDocuments('Item', [{
        name: 'BF Test Dex Blast Hard', type: 'feat',
        system: { type: { value: 'feat' }, activities: {
          bfdexhard0000000: {
            _id: 'bfdexhard0000000', type: 'save',
            activation: { type: '', override: false },
            damage: { parts: [{ custom: { enabled: true, formula: '10' }, types: ['fire'] }], onSave: 'half' },
            save: { ability: ['dex'], dc: { calculation: '', formula: '30' } },
            target: { affects: { type: 'creature' } }
          }
        } } }]);
      {
        const before = Date.now();
        await set('holdTimer', 15);   // were a choice to open wrongly it would STAND, and be seen
        await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
        const hpBefore = victim.system.attributes.hp.value;
        const act = pc.items.get(dexHard.id)?.system.activities.get('bfdexhard0000000');
        const card = await castAt(act, victimToken);
        const applied = await until(() => card?.getFlag(MOD, 'saves')?.targets?.[0]?.applied, 25000);
        const t = card?.getFlag(MOD, 'saves')?.targets?.[0];
        const dropped = hpBefore - victim.system.attributes.hp.value;
        const offered = !!t?.choice || !!dialogsWith('take no damage')[0];
        const settle = game.messages.contents.find(m => (m.timestamp >= before)
          && /takes no damage|Reaction is spent/.test(m.content ?? ''));
        ok('I3. (y) the failed save: NO interpose offer, NO spend — the full 10 applies',
          !!applied && (dropped === 10) && !offered && !settle
            && !reactionChip(victim),
          `applied=${!!applied} dropped=${dropped} offered=${offered} settle=${!!settle}`);
        await set('holdTimer', 0);
        await closeDialogs('BF Shield Master');
        await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
      }
    }

    /* ============================================== H — ② + (c): the Hew reminder POPS now */
    if (want('H')) {
      {
        // The bash feat and the blasts leave first — their offers would stack popups onto
        // H's swings and muddy the dialog asserts. ⚠ BY NAME, not by binding: those fixtures
        // are created inside §B and §I, and a `--section H` run never made them.
        const inTheWay = ['BF Shield Master', 'BF Test Dex Blast', 'BF Test Dex Blast Hard'];
        await pc.deleteEmbeddedDocuments('Item',
          pc.items.filter(i => inTheWay.includes(i.name)).map(i => i.id)).catch(() => {});
        const [gwm] = await pc.createEmbeddedDocuments('Item', [{
          name: 'BF Great Weapon Master', type: 'feat', system: { type: { value: 'feat' } } }]);
        await set('holdTimer', 15);   // the notice family pops only inside a live window
        await acFlat(victim, 1);
        let hew = null, dmg = null;
        for (let i = 0; i < 6 && !hew; i++) {
          await victim.update({ 'system.attributes.hp.value': 1 });
          const { msg } = await attack(pcAttackAct(), victimToken);
          dmg = await waitDamage(msg?._source.system?.origin, 10000);
          if (!dmg) { log.push(`H1: attempt ${i + 1} rolled no damage (fumble) — retrying`); continue; }
          hew = await until(() => game.messages.contents.find(m => (m.timestamp >= suiteStart)
            && /Hew — .*can attack again/.test(m.content ?? '')), 10000);
        }
        ok('H1. a module-applied KILL with a melee weapon posts the Hew reminder (②)',
          !!hew && (victim.system.attributes.hp.value <= 0) && (dmg?.getFlag(MOD, 'hewNoticed') === true),
          `hew=${!!hew} hp=${victim.system.attributes.hp.value} noticed=${!!dmg?.getFlag(MOD, 'hewNoticed')}`);
        const hewCount = game.messages.contents.filter(m => (m.timestamp >= suiteStart)
          && /Hew — /.test(m.content ?? '')).length;
        ok('H2. exactly ONE reminder for the swing (the crit-defers-to-kill dedupe)',
          hewCount === 1, `count=${hewCount}`);
        // The design law ((c), the user verbatim): "give players popup notifications on easy
        // things to forget" — the card alone was scrolled past at the walk.
        const hewPopup = await until(() => dialogsWith('Hew —')
          .find(d => d.querySelector('button[data-action="ok"]')), 6000);
        ok('H3. the reminder POPS — the OK-only notice shape on the fold\'s own namespace ((c))',
          !!hewPopup, `popup=${!!hewPopup}`);
        hewPopup?.querySelector('button[data-action="ok"]')?.click();
        // (j) the ACK: OK resolves the reminder's pending presentation — the flag records it
        // (this client authored the notice as the elect, the durable path) and the card
        // renders no bar. The whole notice family rides the same acknowledgeMoment.
        const hewAcked = await until(() => hew?.getFlag(MOD, 'hewNotice')?.acknowledged === true, 5000);
        await sleep(400);
        const hewBar = hew ? document.querySelector(`.message[data-message-id="${hew.id}"] [data-bf-deadline]`) : null;
        ok('H4. (j) OK ACKNOWLEDGES the reminder — flag recorded, the card bar leaves',
          (hewAcked === true) && !hewBar, `acked=${hewAcked} bar=${!!hewBar}`);
        await pc.deleteEmbeddedDocuments('Item', [gwm.id]).catch(() => {});
        await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
        await acFlat(victim, 25);
        await set('holdTimer', 0);
        skips.push('H — the CRIT trigger is not forced headlessly (nat-20 farming under disadvantage); it now rides the SAME damage-side chain context the kill path pins ((k): dedupe unified on the damage message)');
      }
    }

    /* ============================================== Q — (s): the cascade is a staircase queue */
    if (want('Q')) {
      // Walk-4 finding (s) + the event-order LAW (user ruling): common anchor, one header-height
      // step per slot, slots reused as they free — and the FIRST moment's popup stays in FRONT,
      // later arrivals layered behind, so the player clicks through in the order things happened.
      {
        const uiMod = await import('/modules/fvtt-mod-battleflow/scripts/ui.js');
        const anyMsg = game.messages.contents.at(-1);
        const mk = title => new foundry.applications.api.DialogV2({
          window: { title }, position: { width: 300 },
          content: '<p>cascade probe</p>',
          buttons: [{ action: 'ok', label: 'OK', default: true, callback: () => {} }],
          rejectClose: false
        });
        const zOf = d => Number(d.position?.zIndex ?? d.element?.style?.zIndex ?? 0);
        const d1 = mk('BF Cascade First');
        const d2 = mk('BF Cascade Second');
        await uiMod.openManagedPopup('bf-cascade-1', anyMsg, d1);
        await uiMod.openManagedPopup('bf-cascade-2', anyMsg, d2);
        await sleep(300);
        const p1 = { left: d1.position.left, top: d1.position.top };
        const step = { left: d2.position.left - p1.left, top: d2.position.top - p1.top };
        ok('Q1. (s) the second popup steps down-right one header from the first',
          (step.left === 36) && (step.top === 36), `step=${JSON.stringify(step)}`);
        ok('Q2. (s) event order IS z-order — the first moment stays in front',
          zOf(d1) > zOf(d2), `z1=${zOf(d1)} z2=${zOf(d2)}`);
        await d1.close();
        await sleep(150);
        const d3 = mk('BF Cascade Third');
        await uiMod.openManagedPopup('bf-cascade-3', anyMsg, d3);
        await sleep(300);
        ok('Q3. (s) a freed slot is reused — the third lands on the anchor, never on the survivor',
          (d3.position.left === p1.left) && (d3.position.top === p1.top),
          `third=${JSON.stringify({ left: d3.position.left, top: d3.position.top })} anchor=${JSON.stringify(p1)}`);
        await d2.close(); await d3.close();
        await sleep(150);
        // THE RANK (user ruling 2026-09-13, Thomas Invictus' sword): the bash offer is stamped
        // on the attack roll and the mastery rides the damage message a beat later, so event
        // order alone put the feat's offer in front of the weapon's own mastery. Ranked: the
        // mastery fronts even though it arrived second; the unranked go behind both. The keys
        // are the machines' real subs through the same opener the real popups take.
        const dBash = mk('BF Rank Bash');
        const dMast = mk('BF Rank Mastery');
        const dHold = mk('BF Rank Hold');
        await uiMod.openManagedPopup(`${anyMsg.id}|bashoffer`, anyMsg, dBash);
        await uiMod.openManagedPopup(`${anyMsg.id}|mastery`, anyMsg, dMast);
        await sleep(300);
        ok('Q4. the RANK — the mastery arrives second and still fronts the bash offer',
          zOf(dMast) > zOf(dBash), `mastery=${zOf(dMast)} bash=${zOf(dBash)}`);
        await uiMod.openManagedPopup(`${anyMsg.id}|hold`, anyMsg, dHold);
        await sleep(300);
        ok('Q5. an unranked newcomer goes to the back — mastery, then the offer, then the rest',
          (zOf(dMast) > zOf(dBash)) && (zOf(dBash) > zOf(dHold)),
          `mastery=${zOf(dMast)} bash=${zOf(dBash)} hold=${zOf(dHold)}`);
        await dBash.close(); await dMast.close(); await dHold.close();
        await sleep(150);
      }
    }

    return { log, results, skips, consoleErrors };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips, consoleErrors };
  } finally {
    console.error = origConsoleError;
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'maneuvers', out, plan, f });
