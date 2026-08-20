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
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig, preflightSoleGM } from './target.mjs';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[maneuvers] WATCHDOG 600s'); process.exit(3); }, 600_000);

const f = new Foundry(foundryConfig(env));
console.log('[maneuvers] connecting…');
await f.connect();
await preflightSoleGM(f);
console.log('[maneuvers] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const suiteStart = Date.now();

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.maneuverFolds`)) {
    return { fatal: 'maneuverFolds not registered — this client is running OLD code (F5)' };
  }

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'riders', 'effectRiders', 'masteryRiders', 'playerRollDamage',
    'holdTimer', 'holdSkipFutile', 'holdReveal', 'castApply', 'maneuverFolds'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const enemy = game.actors.getName('BF Test Attacker');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !enemy || !victim) return { fatal: 'missing fixtures — run smoke-battleflow first' };

  const created = { tokens: [], enemyItems: [] };
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
      for (const [actorId, data] of Object.entries(priorActor)) {
        await game.actors.get(actorId)?.update(data);
      }
      await enemy.unsetFlag(MOD, 'reactionSpent').catch(() => {});
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
      'system.attributes.ac.calc': victim.system._source.attributes.ac.calc,
      'system.attributes.ac.flat': victim.system._source.attributes.ac.flat,
      'system.attributes.hp.value': victim.system._source.attributes.hp.value
    };
    priorActor[enemy.id] = {
      'system.attributes.ac.calc': enemy.system._source.attributes.ac.calc ?? 'default',
      'system.attributes.ac.flat': enemy.system._source.attributes.ac.flat ?? null,
      'system.attributes.hp.value': enemy.system._source.attributes.hp.value
    };
    const acFlat = (a, n) => a.update({
      'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': n });

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
        { configure: false }, usageId ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
      await sleep(200);
      return { usageId, msg: rolls?.[0]?.parent ?? null, roll: rolls?.[0] ?? null };
    };
    const until = async (fn, ms = 12000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
      return fn();
    };
    const waitDamage = (originId, ms = 10000) => until(() => game.messages.contents.find(x =>
      (x.getFlag('dnd5e', 'roll.type') === 'damage')
      && (x.getFlag('dnd5e', 'originatingMessage') === originId)), ms);
    const dialogsWith = text => [...document.querySelectorAll('.application')]
      .filter(el => (el.innerHTML ?? '').includes(text));
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

    /* ============================================== P1+P2 — the Precision stamp gates */
    await acFlat(victim, 25);   // miss band: disadvantage total 6..25, nat-20 retries
    await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
    {
      const { msg, flag } = await missUntilStamped(pcAttackAct(), victimToken, 'precision');
      ok('P1. a clean miss stamps a pending precision offer',
        !!flag && (flag.status === 'pending') && (flag.itemName === 'Precision Attack')
          && (flag.targets?.length === 1),
        JSON.stringify({ status: flag?.status, targets: flag?.targets?.length }));
      const popup = await until(() => dialogsWith('Use Precision Attack')[0], 6000);
      ok('P2. the offer popup carries the two controls (Use / Pass)',
        !!popup && !!popup.querySelector('button[data-action="use"]')
          && !!popup.querySelector('button[data-action="pass"]'),
        `popup=${!!popup}`);

      /* P3 — PASS: nothing rolls, the pool is untouched. */
      const usesBefore = poolUses();
      popup?.querySelector('button[data-action="pass"]')?.click();
      const resolved = await until(() => {
        const p = msg.getFlag(MOD, 'precision');
        return (p?.status === 'resolved') ? p : null;
      }, 6000);
      const dmg = await waitDamage(msg.getFlag('dnd5e', 'originatingMessage'), 2500);
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
      await waitDamage(msg?.getFlag('dnd5e', 'originatingMessage'), 8000); // let the chain finish
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
        const popup = await until(() => dialogsWith('Use Precision Attack')[0], 6000);
        popup?.querySelector('button[data-action="use"]')?.click();
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
        const dmg = await waitDamage(msg.getFlag('dnd5e', 'originatingMessage'), 12000);
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
        const dmg = await waitDamage(msg.getFlag('dnd5e', 'originatingMessage'), 2000);
        ok('P7. left alone — the buzzer answers Pass, nothing rolls, nothing spends',
          (resolved?.outcome === 'passed (timer)') && !dmg && (poolUses() === usesBefore),
          `outcome=${resolved?.outcome} uses ${usesBefore}→${poolUses()}`);
      }
      await set('holdTimer', 0);
      await closeDialogs('Precision');
    }

    /* ============================================== R1+R2 — the Riposte offer + the driven attack */
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
      ok('R2a. the popup carries Riposte/Pass and the weapon choice',
        !!popup && !!popup.querySelector('button[data-action="riposte"]')
          && !!popup.querySelector('select[name="bf-riposte-weapon"]'),
        `popup=${!!popup}`);

      popup?.querySelector('button[data-action="riposte"]')?.click();
      const driven = await until(() => game.messages.contents.find(m =>
        (m.getFlag(MOD, 'riposteFor') === msg?.id) && (m.getFlag(MOD, 'riposteBy') === pc.uuid)), 15000);
      ok('R2b. accepting drives a REAL attack carrying its provenance, aimed at the attacker',
        !!driven && (driven.getFlag('dnd5e', 'roll.type') === 'attack')
          && (driven.getFlag('dnd5e', 'targets') ?? []).some(t => t.uuid === enemy.uuid),
        `driven=${!!driven} targets=${JSON.stringify(driven?.getFlag('dnd5e', 'targets')?.map(t => t.name))}`);
      ok('R2c. the maneuver really spent — the pool is down one',
        poolUses() === usesBefore - 1, `uses ${usesBefore}→${poolUses()}`);

      const drivenRoll = driven?.rolls?.[0];
      if (drivenRoll?.isFumble) {
        skips.push('R2d/e — the driven attack rolled a natural 1 (miss); die-in-damage not exercised this run');
      } else {
        const dmg = await waitDamage(driven?.getFlag('dnd5e', 'originatingMessage'), 12000);
        const extraDie = dmg?.rolls?.some(r => (r.options?.type === 'slashing')
          && r.terms?.some(t => t.faces === 8) && (r !== dmg.rolls[0]));
        ok('R2d. the superiority die joins the driven attack\'s damage as its own part',
          !!dmg && (dmg.rolls?.length >= 2) && !!extraDie,
          `dmg=${!!dmg} rolls=${dmg?.rolls?.length} extraDie=${!!extraDie}`);
        const receipt = await until(() => dmg?.getFlag(MOD, 'receipt'), 8000);
        ok('R2e. the driven chain applies like any real attack (receipt on the enemy)',
          !!receipt?.targets?.some(t => t.uuid === enemy.uuid),
          `receipt=${!!receipt}`);
      }
      ok('R2f. out of combat the reaction flag stays unset (the hold\'s own carve-out)',
        !pc.getFlag(MOD, 'reactionSpent'),
        `flag=${!!pc.getFlag(MOD, 'reactionSpent')}`);
    }

    /* R3 — a spent reaction is never offered. */
    {
      await pc.setFlag(MOD, 'reactionSpent', true);
      const { msg } = await attack(enemyAttackAct(), pcToken);
      await sleep(1500);
      ok('R3. reactionSpent suppresses the offer entirely',
        !!msg && !msg.getFlag(MOD, 'riposte'),
        `flag=${!!msg?.getFlag(MOD, 'riposte')}`);
      await pc.unsetFlag(MOD, 'reactionSpent');
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
          { configure: false }, { data: { 'flags.dnd5e.originatingMessage': use?.message?.id } });
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
      }
      await closeDialogs('Precision');   // the PC's own precision may have offered on that miss
      await closeDialogs('Riposte');
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, null);

if (out.fatal) {
  console.error(`\n[maneuvers] FATAL: ${out.fatal}`);
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
console.log(`\n[maneuvers] ${out.results.length - failures}/${out.results.length} passed`);
process.exit(failures ? 1 : 0);
