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
      ok('R2f. out of combat the reaction flag stays unset (the hold\'s own carve-out)',
        !pc.getFlag(MOD, 'reactionSpent'),
        `flag=${!!pc.getFlag(MOD, 'reactionSpent')}`);
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

    /* ============================================== P8 — finding ①: player-owned, owner OFFLINE */
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
          const popup = await until(() => dialogsWith('Use Precision Attack')[0], 6000);
          ok('P8b. player-owned attacker, owner offline — the GM STILL gets the popup (①)',
            !!popup, `popup=${!!popup}`);
          popup?.querySelector('button[data-action="pass"]')?.click();
          await until(() => msg.getFlag(MOD, 'precision')?.status === 'resolved', 6000);
        }
        await pc.update({ ownership: { [playerUser.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE } });
      }
    }

    /* ============================================== M1 — finding ④: two weapons, smart default */
    {
      const [offhand] = await pc.createEmbeddedDocuments('Item', [
        foundry.utils.mergeObject(enemyWeapon.toObject(), {
          name: 'BF Test Offhand', system: { equipped: true } }, { inplace: false })]);
      // Attack once WITH the offhand so it becomes the log's latest — the default must track
      // USAGE, not inventory order (options[0] is the original weapon).
      const offAct = pc.items.get(offhand.id)?.system.activities.find(a => a.type === 'attack');
      await acFlat(victim, 1);
      const { msg: offMsg } = await attack(offAct, victimToken);
      await waitDamage(offMsg?.getFlag('dnd5e', 'originatingMessage'), 8000);
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

    /* ============================================== RP — (l)+(p): the riposte HIT celebrates */
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
          const dmg = await waitDamage(driven?.getFlag('dnd5e', 'originatingMessage'), 12000);
          ok('RP2. the celebrated button rolls through the same chokepoint — the damage lands',
            !!dmg, `dmg=${!!dmg}`);
        }
      }
      await set('playerRollDamage', false);
      await closeDialogs('Riposte');
      await closeDialogs('Weapon Mastery');
    }

    /* ============================================== B — finding ⑤: the bash choice (Prone or push) */
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
          + `dnd5eTargets=${JSON.stringify((card?.getFlag('dnd5e', 'targets') ?? []).map(t => t.name))}, `
          + `tokenDestroyed=${!!token?.destroyed}, tokenActor=${token?.actor?.name ?? null}) — retrying`);
      }
      return null;
    };

    /* B1 — the failed save opens the choice; the verdict line is source-first, saver-spoken. */
    // ⚠ The victim must be ALIVE before every bash cast: it is an NPC, earlier sections'
    // applied damage can leave it at 0, and the DEAD-TARGET GATE (walk item 11, correct
    // behaviour) then stamps nothing — which reads exactly like a product bug (it cost a
    // run to diagnose; the castAt retry log now names the gate's inputs for next time).
    const reviveVictim = () => victim.update({
      'system.attributes.hp.value': victim.system.attributes.hp.max });
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
      const verdict = game.messages.contents.find(m =>
        m.getFlag(MOD, 'verdictLine')?.sourceMessageId === card?.id);
      ok('B1b. the verdict line leads with the SOURCE and speaks as the SAVER (⑦/⑧)',
        !!verdict && (verdict.content ?? '').includes('BF Shield Master — ')
          && (verdict.speaker?.actor === victim.id),
        `sourceTitle=${(verdict?.content ?? '').includes('BF Shield Master — ')} speaker=${verdict?.speaker?.actor} want=${victim.id}`);
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
      let offer = null, atkMsg = null;
      for (let i = 0; i < 6 && !offer; i++) {
        const { msg } = await attack(pcAttackAct(), victimToken);
        atkMsg = msg;
        offer = await until(() => msg?.getFlag(MOD, 'bashOffer'), 4000);
        if (!offer) log.push(`B4: attempt ${i + 1} produced no offer (miss/fumble) — retrying`);
      }
      ok('B4a. a melee weapon HIT by the listed carrier stamps the bash offer ((g))',
        (offer?.status === 'pending') && ((offer?.targets ?? []).length === 1),
        `offer=${!!offer} targets=${offer?.targets?.length}`);
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
      await acFlat(victim, 25);
      await closeDialogs('BF Shield Master');
    }

    /* ============================================== I — finding ⑥: Interpose (save-success reaction) */
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
          && !victim.getFlag(MOD, 'reactionSpent'),
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
          && !victim.getFlag(MOD, 'reactionSpent'),
        `applied=${!!applied} dropped=${dropped} offered=${offered} settle=${!!settle}`);
      await set('holdTimer', 0);
      await closeDialogs('BF Shield Master');
      await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
    }

    /* ============================================== H — ② + (c): the Hew reminder POPS now */
    {
      // The bash feat and the blasts leave first — their offers would stack popups onto
      // H's swings and muddy the dialog asserts.
      await pc.deleteEmbeddedDocuments('Item',
        [bashFeat.id, dexBlast.id, dexHard.id].filter(id => pc.items.get(id))).catch(() => {});
      const [gwm] = await pc.createEmbeddedDocuments('Item', [{
        name: 'BF Great Weapon Master', type: 'feat', system: { type: { value: 'feat' } } }]);
      await set('holdTimer', 15);   // the notice family pops only inside a live window
      await acFlat(victim, 1);
      let hew = null, dmg = null;
      for (let i = 0; i < 6 && !hew; i++) {
        await victim.update({ 'system.attributes.hp.value': 1 });
        const { msg } = await attack(pcAttackAct(), victimToken);
        dmg = await waitDamage(msg?.getFlag('dnd5e', 'originatingMessage'), 10000);
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

    /* ============================================== Q — (s): the cascade is a staircase queue */
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
    }

    return { log, results, skips, consoleErrors };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips, consoleErrors };
  } finally {
    console.error = origConsoleError;
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
if (out.consoleErrors?.length) {
  console.log('\n  CONSOLE ERRORS DURING THE RUN:');
  for (const e of out.consoleErrors) console.log(`   ⚠ ${e}`);
}
console.log(`\n[maneuvers] ${out.results.length - failures}/${out.results.length} passed`);
process.exit(failures ? 1 : 0);
