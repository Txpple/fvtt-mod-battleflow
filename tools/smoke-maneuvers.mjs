// Maneuver-fold smoke suite: Precision Attack patches a declared miss; Riposte answers an enemy
// melee miss with a real driven attack; plus the bash, shove, Interpose, Hew and Pole Strike
// folds. The folds share nothing with the hold machine, so they have their own suite.
// Determinism levers:
//   - The fixture Precision die is "1d8 + 20", so a flip is guaranteed against AC 25; a
//     natural 20 (a hit, no stamp) retries.
//   - holdSkipFutile OFF for the stamp sections; its own section pins the hopeless gate (AC 60).
//   - holdTimer 0 (popups wait for the suite's click); the buzzer section pins 2s locally.
// ⚠ Run `smoke-battleflow` FIRST (BF Test Attacker / BF Test Victim). Sections are named after
// their fold; fixtures and teardown always run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'precision.js',           // P, P8, M1, Q — Precision Attack
  'riposte.js',             // R, RP — Riposte's driven attack
  'hew.js',                 // H — the Hew reminder
  'bash-offer.js',          // B — the bash offer on a listed carrier's hit; T — Tavern Brawler's shove; C — Crusher's push
  'unarmed-dice.js',        // T4 — Tavern Brawler's die on the plain Unarmed Strike
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
  T: 'Tavern Brawler: the shove offer on an Unarmed Strike hit (Push 5 feet / Pass, announced), none on a weapon hit, none unlisted; the plain Unarmed Strike rolls the feat 1d4 with a card line, flat again off the Unarmed Strike Dice list',
  C: 'Crusher (the PHB feats, group 3, 2026-09-26): a Mace hit (Bludgeoning) offers the push — the Crusher rule quoted, Push 5 feet announced; a Dagger hit (Piercing) offers nothing; a Huge target (two sizes larger) offers nothing',
  I: 'finding ⑥: Interpose (save-success reaction)',
  H: '② + (c): the Hew reminder POPS now',
  PS: "Pole Strike (Polearm Master, 2026-09-27): an attack with a Spear posts Hew's reminder for the other end's Bonus Action swing, and it pops; a weapon that does not qualify says nothing",
  Q: '(s): the cascade is a staircase queue'
};
// Each group stands up its own fixtures and settings. `P` leaves the victim on AC 25; others set their own.
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'maneuvers', watchdogMs: 600_000 });
announcePlan('maneuvers', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  // The spent Reaction is an effect chip.
  const clearReaction = async a => { const ids = (a?.effects ?? []).filter(e => e.getFlag(MOD, 'mastery') === 'reaction').map(e => e.id); if (ids.length) await a.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {}); };
  const spendReactionOf = async a => { await a.createEmbeddedDocuments('ActiveEffect', [{ name: 'Reaction — used', img: 'icons/svg/clockwork.svg', transfer: false, flags: { [MOD]: { mastery: 'reaction' } } }]); };
  const reactionChip = a => !!a?.effects?.some(e => e.getFlag(MOD, 'mastery') === 'reaction');
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  // The page-side section gate (tools/harness.mjs); the plan arrives as data.
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const suiteStart = Date.now();

  // Console-error capture: the module logs its failures there.
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
    'saves', 'saveTimer', 'unarmedDiceList'];
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
    // The rows §B, §I and §H drive; each sets them itself because §T rewrites the list.
    const SUITE_FOLDS = 'Precision Attack:precision, Riposte:riposte, '
      + 'BF Shield Master:bash, BF Shield Master:interpose, BF Great Weapon Master:hew';

    // ---- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    // ⚠ Sweep existing fixture tokens FIRST: getSpeaker resolves through the actor's OLDEST
    // token, and an unlinked leftover makes the attack speak as a synthetic actor.
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
    // The pool first: the maneuvers' consumption targets its id.
    const [pool] = await pc.createEmbeddedDocuments('Item', [{
      name: 'BF Combat Superiority', type: 'feat',
      system: { type: { value: 'feat' }, uses: { spent: 0, max: '4', recovery: [] } }
    }]);
    await pc.createEmbeddedDocuments('Item', [
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

    const attack = async (activity, token, _opts = {}) => {
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
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
     * The merged rescue window: one row per rescue, the control is `[data-bf-rescue-action]` on a
     * div (no `Use <item>` button). `Pass` stays a footer button, sent to every pending source.
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
      // Two logged tries: a target that lands late in the dnd5e snapshot stamps nothing.
      for (let attempt = 1; attempt <= 2; attempt++) {
        game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
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
    // ⚠ Revive the victim before every bash cast: the dead-target gate stamps nothing.
    const reviveVictim = () => victim.update({
      'system.attributes.hp.value': victim.system.attributes.hp.max });

    /* ==== P1+P2 — the Precision stamp gates */
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
          // The re-drive stamps the FLAT originating key the riders key on (riderTargets branch 1).
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

    /* ==== R1+R2 — the Riposte offer + the driven attack */
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
        // ONE equipped melee weapon skips the dropdown: the popup NAMES it.
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
          // The die folds INTO the base roll: two d8 terms in one roll, counted by group, not by
          // literal "1d8" (a driven crit doubles both to 2d8).
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

        // The maneuver's own use must NOT chain dnd5e's follow-up damage dialog; it would open
        // async, so this is a negative assert after a settle.
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
          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
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
        // Make the ENEMY riposte-eligible and force the driven attack to miss: only the
        // riposteFor guard stops a chained offer.
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
          // The announced miss: the card posts before any Graze/Precision offer can arrive.
          // ⚠ A natural 20 hits through AC 40 and correctly posts no miss card: skipped, not failed.
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

    /* ==== P8 — player-owned, owner OFFLINE: player-first, GM fallback (the GM gets the popup) */
    if (want('P8')) {
      {
        const playerUser = game.users.find(u => !u.isGM);
        if (!playerUser) {
          skips.push('P8 — no player user in this world; the ①-gate pin not exercised');
        } else {
          // Object form: a dotted key raises "is not a mapping". The grant must provably land, or
          // the pin passes vacuously.
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

    /* ==== M1 — two weapons, smart default */
    if (want('M1')) {
      {
        const [offhand] = await pc.createEmbeddedDocuments('Item', [
          foundry.utils.mergeObject(enemyWeapon.toObject(), {
            name: 'BF Test Offhand', system: { equipped: true } }, { inplace: false })]);
        // Attack with the offhand first: the default tracks USAGE, not inventory order.
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

    /* ==== RP — the riposte HIT celebrates */
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
            // The offer popup on the driving client names the riposte, with the die-riding note.
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

    /* ==== B — the bash choice (Prone or push) */
    if (want('B')) {
      await set('saves', true);
      await set('maneuverFolds', SUITE_FOLDS);
      // A listed feat whose save presses an effect on failure (DC 30: always fails; the effect
      // wired by its real id after creation).
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
        // The usage card carries the verdict; no separate verdict card posts.
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

      /* B2 — the prone answer presses the STANDARD Prone chip (canonical id, origin names the
       * presser), never the item's own effect. */
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

      /* B3 — the choice bar is VISIBLE, then the buzzer defaults to Prone and says so. */
      {
        await set('holdTimer', 4);
        await reviveVictim();
        await victim.effects.find(e => e.statuses.has('prone'))?.delete().catch(() => {});
        const card = await castAt(bashAct(), victimToken);
        // The pending choice draws its bar (card row AND popup). The DOM is the assertion: the
        // flags can be right while a status-gated wrapper renders "".
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

      /* B4 — the HIT is the trigger: offer → drive → demand → choice → press. */
      {
        // Unkillable for the section: the dead gate would silently eat the demand.
        priorActor[victim.id]['system.attributes.hp.max'] = victim.system._source.attributes.hp.max;
        await victim.update({ 'system.attributes.hp.max': 1000, 'system.attributes.hp.value': 1000 });
        await acFlat(victim, 1);
        await victim.effects.find(e => e.statuses.has('prone'))?.delete().catch(() => {});
        // The feat's reach (within 5 feet): a hit from two squares off stamps nothing; then the
        // PC steps beside the target for the chain below.
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
          // The hit stamps the offer QUEUED; it goes pending (clock starts) once the damage lands.
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
        // holdTimer is 0 here, so promotedAt is the proof the clock starts at the promotion.
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

    /* ==== T — Tavern Brawler's push (the `shove` kind) */
    if (want('T')) {
      // The PHB's own Tavern Brawler: its Enhanced Unarmed Strike is an attack activity classified unarmed.
      let brawlerSrc = null;
      for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
        const hit = (await pack.getIndex()).find(e => e.name === 'Tavern Brawler');
        if (hit) { brawlerSrc = await pack.getDocument(hit._id); break; }
      }
      if (!brawlerSrc) {
        ok('T0. the PHB ships Tavern Brawler', false, 'no "Tavern Brawler" in the PHB packs');
      } else {
        const [brawler] = await pc.createEmbeddedDocuments('Item', [brawlerSrc.toObject()]);
        const unarmedAct = () => pc.items.get(brawler.id)?.system.activities.find(a => a.type === 'attack');
        await set('maneuverFolds', 'Tavern Brawler:shove');
        priorActor[victim.id]['system.attributes.hp.max'] ??= victim.system._source.attributes.hp.max;
        await victim.update({ 'system.attributes.hp.max': 1000, 'system.attributes.hp.value': 1000 });
        await acFlat(victim, 1);
        const pcHome = { x: pcToken.document.x, y: pcToken.document.y };
        await pcToken.document.update({ x: victimToken.document.x, y: victimToken.document.y + canvas.grid.size }, { animate: false });
        await sleep(500);
        const hitUntil = async act => {
          for (let i = 0; i < 6; i++) {
            const { msg, roll } = await attack(act, victimToken);
            if (roll && !roll.isFumble && (roll.total > 1)) return msg;
          }
          return null;
        };

        /* T1 — an Unarmed Strike hit: queued, promoted after the damage, Push 5 feet / Pass. */
        {
          const msg = await hitUntil(unarmedAct());
          const stamped = await until(() => msg?.getFlag(MOD, 'bashOffer'), 4000);
          const offer = await until(() => { const b = msg?.getFlag(MOD, 'bashOffer'); return (b?.status === 'pending') ? b : null; }, 12000);
          ok('T1a. an Unarmed Strike hit by a Tavern Brawler stamps the shove offer (kind shove), pending after the damage',
            (stamped?.kind === 'shove') && (offer?.status === 'pending') && ((offer?.targets ?? []).length === 1),
            `stamped=${JSON.stringify(stamped ? { kind: stamped.kind, status: stamped.status } : null)} offer=${offer?.status}`);
          const popup = await until(() => dialogsWith('5 feet?')[0], 6000);
          const use = popup?.querySelector('button[data-action="use"]');
          ok('T1b. the popup asks "push … 5 feet?" with Push 5 feet / Pass',
            !!use && /Push 5 feet/.test(use.textContent ?? '') && !!popup?.querySelector('button[data-action="pass"]'),
            `popup=${!!popup} use="${use?.textContent ?? ''}"`);
          use?.click();
          const card = await until(() => game.messages.contents.find(m => m.getFlag(MOD, 'bashFor') === msg?.id), 8000);
          const text = (card?.content ?? '').replace(/<[^>]+>/g, ' ');
          ok('T1c. Push announces it — "pushes Victim 5 feet", moved by hand — and drives no save activity',
            !!card && /pushes .* 5 feet/.test(text) && /by hand/.test(text) && !card.getFlag(MOD, 'saves'),
            `card=${!!card} text="${text.replace(/\s+/g, ' ').trim().slice(0, 120)}"`);
          ok('T1d. the offer resolved "use"', msg?.getFlag(MOD, 'bashOffer')?.answer === 'use', `answer=${msg?.getFlag(MOD, 'bashOffer')?.answer}`);
          await closeDialogs('Tavern Brawler');
        }

        /* T2 — a weapon hit carries no shove. */
        {
          const msg = await hitUntil(pcAttackAct());
          await sleep(2500);
          ok('T2a. a weapon hit stamps no shove offer — the Unarmed Strike alone', !!msg && !msg.getFlag(MOD, 'bashOffer'),
            `hit=${!!msg} offer=${JSON.stringify(msg?.getFlag(MOD, 'bashOffer') ?? null)}`);
        }

        /* T3 — off the list. */
        {
          await set('maneuverFolds', '');
          const msg = await hitUntil(unarmedAct());
          await sleep(2500);
          ok('T3a. Tavern Brawler off the Maneuver Folds list: no offer', !!msg && !msg.getFlag(MOD, 'bashOffer'),
            `hit=${!!msg} offer=${JSON.stringify(msg?.getFlag(MOD, 'bashOffer') ?? null)}`);
        }
        /* T4 — the plain Unarmed Strike (the PHB's own weapon) rolls the feat's die, and says so. */
        {
          const usSrc = await fromUuid('Compendium.dnd-players-handbook.equipment.Item.phbUnarmedStrike');
          if (!usSrc) {
            ok('T4. the PHB ships the Unarmed Strike weapon', false, 'no phbUnarmedStrike');
          } else {
            const [us] = await pc.createEmbeddedDocuments('Item', [usSrc.toObject()]);
            const usAct = () => pc.items.get(us.id)?.system.activities.find(a => a.type === 'attack');
            await set('unarmedDiceList', 'Tavern Brawler');
            const dmgOf = async () => {
              for (let i = 0; i < 6; i++) {
                const { usageId, roll } = await attack(usAct(), victimToken);
                if (!roll || roll.isFumble || (roll.total <= 1)) continue;
                return waitDamage(usageId);
              }
              return null;
            };
            const dmg = await dmgOf();
            const flag = dmg?.getFlag(MOD, 'unarmedDice');
            const formula = dmg?.rolls?.[0]?.formula ?? '';
            ok('T4a. the plain Unarmed Strike rolls the feat 1d4 (1s rerolled) + Str, not the flat 1 + Str; the flag names the swap',
              /1d4r1/.test(formula) && (flag?.feature === 'Tavern Brawler') && /1d4r1/.test(flag?.formula ?? '') && !/d/.test(flag?.was ?? 'd'),
              `formula="${formula}" flag=${JSON.stringify(flag ?? null)}`);
            const line = await until(() => document.querySelector(`[data-message-id="${dmg?.id}"] .bf-unarmed-dice-line`), 4000);
            ok('T4b. the damage card says so: "Tavern Brawler — 1d4r1 + N in place of 1 + N"',
              /Tavern Brawler — 1d4r1 .* in place of 1 \+/.test(line?.textContent ?? ''), `line="${line?.textContent ?? ''}"`);
            await set('unarmedDiceList', '');
            const flat = await dmgOf();
            ok('T4c. off the Unarmed Strike Dice list: the flat damage, no line',
              !!flat && !/d/.test(flat.rolls?.[0]?.formula ?? 'd') && !flat.getFlag(MOD, 'unarmedDice'),
              `formula="${flat?.rolls?.[0]?.formula ?? ''}"`);
            await pc.deleteEmbeddedDocuments('Item', [us.id]);
          }
        }
        await pcToken.document.update(pcHome, { animate: false });
        await acFlat(victim, 25);
        await closeDialogs('Tavern Brawler');
        await closeDialogs('Weapon Mastery');
      }
    }

    /* ==== C — Crusher's push */
    if (want('C')) {
      const phb = async (name, type) => {
        for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
          const hit = (await pack.getIndex({ fields: ['type'] })).find(e => (e.name === name) && (e.type === type));
          if (hit) return pack.getDocument(hit._id);
        }
        return null;
      };
      const srcs = { crusher: await phb('Crusher', 'feat'), mace: await phb('Mace', 'weapon'), dagger: await phb('Dagger', 'weapon') };
      if (!srcs.crusher || !srcs.mace || !srcs.dagger) {
        ok('C0. the PHB ships Crusher, a Mace and a Dagger', false, JSON.stringify(Object.fromEntries(Object.entries(srcs).map(([k, v]) => [k, !!v]))));
      } else {
        const made = await pc.createEmbeddedDocuments('Item', [srcs.crusher.toObject(), srcs.mace.toObject(), srcs.dagger.toObject()]);
        // ⚠ BY NAME: createEmbeddedDocuments' result order is not the request's.
        const mace = made.find(i => (i.name === 'Mace') && (i.type === 'weapon'));
        const dagger = made.find(i => (i.name === 'Dagger') && (i.type === 'weapon'));
        const actOf = item => () => pc.items.get(item.id)?.system.activities.find(a => a.type === 'attack');
        const sizeBefore = victim.system._source.traits?.size ?? 'med';
        await set('maneuverFolds', 'Crusher:shove');
        priorActor[victim.id]['system.attributes.hp.max'] ??= victim.system._source.attributes.hp.max;
        await victim.update({ 'system.attributes.hp.max': 1000, 'system.attributes.hp.value': 1000 });
        await acFlat(victim, 1);
        const hitUntil = async act => {
          if (!act) {
            // Say what the sheet held when the Mace's attack is missing.
            const it = pc.items.get(mace?.id);
            log.push(`§C: no attack activity — made=${JSON.stringify(made.map(x => [x.name, x.id]))} onSheet=${!!it} activities=${JSON.stringify(it ? [...it.system.activities].map(a => a.type) : null)} pc=${pc.name}/${pc.uuid} items=${pc.items.size}`);
            ok('C. the Mace on the sheet carries its attack', false, log.at(-1));
            return null;
          }
          for (let i = 0; i < 6; i++) {
            const { msg, roll } = await attack(act, victimToken);
            if (roll && !roll.isFumble && (roll.total > 1)) return msg;
          }
          return null;
        };
        try {
          {
            const msg = await hitUntil(actOf(mace)());
            const offer = await until(() => { const b = msg?.getFlag(MOD, 'bashOffer'); return (b?.status === 'pending') ? b : null; }, 12000);
            ok('C1a. a Mace hit (Bludgeoning) by a Crusher stamps the shove offer, its row named Crusher',
              (offer?.kind === 'shove') && (offer?.shoveRow === 'Crusher'), `offer=${JSON.stringify(offer ? { kind: offer.kind, row: offer.shoveRow, status: offer.status } : null)}`);
            const popup = await until(() => dialogsWith('5 feet?')[0], 6000);
            const text = (popup?.textContent ?? '').replace(/\s+/g, ' ');
            ok('C1b. the popup quotes Crusher\'s own rule ("…deals Bludgeoning damage…one size larger…")',
              /deals Bludgeoning damage/.test(text) && /one size larger/.test(text), text.slice(0, 200));
            popup?.querySelector('button[data-action="use"]')?.click();
            const card = await until(() => game.messages.contents.find(m => m.getFlag(MOD, 'bashFor') === msg?.id), 8000);
            ok('C1c. Push 5 feet announces it', !!card && /pushes .* 5 feet/.test((card?.content ?? '').replace(/<[^>]+>/g, ' ')), `card=${!!card}`);
            await closeDialogs('Crusher');
          }
          {
            const msg = await hitUntil(actOf(dagger)());
            await sleep(2500);
            ok('C2. a Dagger hit (Piercing) stamps no push', !!msg && !msg.getFlag(MOD, 'bashOffer'), `offer=${JSON.stringify(msg?.getFlag(MOD, 'bashOffer') ?? null)}`);
          }
          {
            await victim.update({ 'system.traits.size': 'huge' });
            const msg = await hitUntil(actOf(mace)());
            await sleep(2500);
            ok('C3. a Huge target (two sizes larger than a Medium pusher): no push', !!msg && !msg.getFlag(MOD, 'bashOffer'),
              `size=${victim.system.traits.size} pc=${pc.system.traits.size} offer=${JSON.stringify(msg?.getFlag(MOD, 'bashOffer') ?? null)}`);
          }
        } finally {
          await victim.update({ 'system.traits.size': sizeBefore }).catch(() => {});
          await pc.deleteEmbeddedDocuments('Item', made.map(i => i.id).filter(id => pc.items.get(id))).catch(() => {});
          await acFlat(victim, 25);
          await closeDialogs('Crusher');
          await closeDialogs('Weapon Mastery');
        }
      }
    }

    /* ==== I — Interpose (save-success reaction) */
    if (want('I')) {
      // A shield + the listed feat on the VICTIM; a DEX half-damage demand it always saves.
      await set('maneuverFolds', SUITE_FOLDS);   // its own row — §T above rewrites the list
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

      /* I1 — NOTHING stamps with the demand; the SAVED verdict opens the choice; use turns the
       * half into NONE (the 2024 text conditions the Reaction on succeeding). */
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

      /* I2 — the buzzer PASSES (a Reaction is never spent by a timer): the saved half applies. */
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

      /* I3 — a FAILED save never offers and never spends: full damage, no choice, no popup. */
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

    /* ==== H — the Hew reminder POPS */
    if (want('H')) {
      await set('maneuverFolds', SUITE_FOLDS);   // its own row — §T above rewrites the list
      {
        // The bash feat and the blasts leave first (their popups would stack). ⚠ BY NAME: a
        // `--section H` run never made them.
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
        // Easy-to-forget things pop a notice, not just a card.
        const hewPopup = await until(() => dialogsWith('Hew —')
          .find(d => d.querySelector('button[data-action="ok"]')), 6000);
        ok('H3. the reminder POPS — the OK-only notice shape on the fold\'s own namespace ((c))',
          !!hewPopup, `popup=${!!hewPopup}`);
        hewPopup?.querySelector('button[data-action="ok"]')?.click();
        // The ACK: OK resolves the pending presentation (flag recorded, no bar). The notice family
        // shares acknowledgeMoment.
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

    /* ==== PS — Pole Strike's reminder (Hew's shape): after a Quarterstaff, Spear or Heavy + Reach
     * attack, an OK-only reminder of the Bonus Action swing; other weapons say nothing. */
    if (want('PS')) {
      await set('maneuverFolds', `${SUITE_FOLDS}, Polearm Master:hew`);
      const phb = async (name, type) => {
        for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
          const hit = (await pack.getIndex({ fields: ['type'] })).find(e => (e.name === name) && (e.type === type));
          if (hit) return (await pack.getDocument(hit._id)).toObject();
        }
        return null;
      };
      const feat = await phb('Polearm Master', 'feat');
      const spear = await phb('Spear', 'weapon');
      if (!feat || !spear) return { fatal: 'section PS: no Polearm Master or Spear in the PHB packs' };
      spear.system.equipped = true;
      const lent = await pc.createEmbeddedDocuments('Item', [feat, spear]);
      try {
        await set('holdTimer', 15);
        await acFlat(victim, 1);
        await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
        const spearAct = pc.items.get(lent.find(i => i.type === 'weapon').id).system.activities.find(a => a.type === 'attack');
        const pole = t => game.messages.contents.filter(m => (m.timestamp >= t) && /Pole Strike — .*can attack again/.test(m.content ?? ''));
        const t0 = Date.now();
        const { msg } = await attack(spearAct, victimToken);
        await waitDamage(msg?._source.system?.origin, 10000);
        const card = await until(() => pole(t0)[0] ?? null, 10000);
        const offerOf = card?.getFlag(MOD, 'hewNotice')?.offer ?? null;
        ok('PS1. an attack with a Spear, held by a Polearm Master, posts Pole Strike\'s OFFER — the rule and the other end',
          !!card && /Pole Strike\. Immediately after you take the Attack action/.test(card.content ?? '') && /other end/.test(card.content ?? '') && !!offerOf,
          `card=${!!card} offer=${JSON.stringify(offerOf)}`);
        const popup = await until(() => dialogsWith('Pole Strike —').find(d => d.querySelector('button[data-action="use"]')), 6000);
        ok('PS2. the offer POPS with Pole Strike / Pass (the walk, 2026-09-27)', !!popup?.querySelector('button[data-action="pass"]'), `popup=${!!popup}`);
        const tUse = Date.now();
        popup?.querySelector('button[data-action="use"]')?.click();
        const swing = await until(() => game.messages.contents.find(m => (m.timestamp >= tUse) && m.rolls?.length
          && (m.getFlag(MOD, 'poleStrike') === card?.id)), 10000);
        const die = await until(() => game.messages.contents.find(m => (m.timestamp >= tUse) && m.getFlag(MOD, 'poleStrikeDie')), 12000);
        const dieFlag = die?.getFlag(MOD, 'poleStrikeDie') ?? null;
        const dieTypes = [...(die?.rolls?.[0]?.options?.types ?? [])];
        ok('PS2b. Use drives the SPEAR\'s own attack at the same target; its damage is a d4 of Bludgeoning, and the card says so',
          !!swing && !!dieFlag && /d4/.test(dieFlag.now ?? '') && ((die.rolls?.[0]?.options?.type === 'bludgeoning') || dieTypes.includes('bludgeoning')),
          `swing=${!!swing} die=${JSON.stringify(dieFlag)} type=${die?.rolls?.[0]?.options?.type} types=[${dieTypes}]`);
        await sleep(600);
        ok('PS3. one offer for the attack (the driven swing offers none), and no Hew beside it', (pole(t0).length === 1)
          && !game.messages.contents.some(m => (m.timestamp >= t0) && /Hew — /.test(m.content ?? '')), `pole=${pole(t0).length}`);
        const t1 = Date.now();
        const { msg: m2 } = await attack(pcAttackAct(), victimToken);
        await waitDamage(m2?._source.system?.origin, 10000);
        await sleep(2000);   // load-bearing: time for a WRONG reminder
        ok('PS4. an attack with a weapon that does not qualify says nothing', !pole(t1).length, `pole=${pole(t1).length}`);
      } finally {
        await pc.deleteEmbeddedDocuments('Item', lent.map(i => i.id).filter(id => pc.items.get(id))).catch(() => {});
        await acFlat(victim, 25);
        await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
        await set('holdTimer', 0);
        await set('maneuverFolds', SUITE_FOLDS);
      }
    }

    /* ==== Q — the cascade is a staircase queue: common anchor, one header-height step per slot,
     * slots reused as they free; the FIRST moment's popup stays in front. */
    if (want('Q')) {
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
        // THE RANK: the mastery fronts the bash offer though it arrives second; the unranked go
        // behind both. Real subs, through the real popups' opener.
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
