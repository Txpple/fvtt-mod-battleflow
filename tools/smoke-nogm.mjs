// NO-GM SMOKE — the flow keeps running when nobody is behind the screen.
//
// ⚠ The only suite that connects NO GM AT ALL: a GM-connected harness structurally cannot see
// this. The contract (ARCHITECTURE §3, the driver table): the popups and cards run without a GM,
// monster writes like Prone are skipped, and whoever is driving is TOLD.
//
//   §runs    the reminder card and its flag still post with nobody behind the screen
//   §chip    …and the monster is NOT written to — no Sapped chip appears
//   §told    …and the driver gets a whisper naming what did not land
//   §rejoin  a GM reconnecting does not re-pay a payout the player already drove
//   §cast    a self-buff lands on the caster's own sheet on the caster's flow elect
//
// ⚠ RUN WITH THE BRIDGE DISCONNECTED AND NO GM WINDOW OPEN: it refuses to run beside an active
// GM, which would make it a re-run of smoke-effects passing for the wrong reason.
//
// Run:  node tools/smoke-nogm.mjs [--section runs,chip,told,rejoin] [--list]
import { announcePlan, disposeSafely, loadEnv, report, sectionPlan } from './harness.mjs';
import { playerConfig, foundryConfig } from './target.mjs';
import { Foundry } from 'fvtt-mcp-dnd5e/client';

const MOD = 'fvtt-mod-battleflow';
// The machines this suite drives (tools/coverage-map.mjs parses this). ⚠ NEVER import a suite:
// it connects on evaluation.
export const COVERS = [
  'mastery.js',             // runs / chip / told / rejoin — the payout with no GM behind the screen
  'chip-spend.js',          // spent — a chip the player cannot delete is spent once
  'concentration.js',       // conc — the assist end to end with no GM
  'cast.js'                 // cast — casting on the caster's flow elect
];

const SECTIONS = {
  runs: 'the mastery reminder still posts with no GM connected',
  chip: 'the monster is never written to — no chip lands',
  told: 'the driver is told what did not apply',
  rejoin: 'a GM rejoining does not re-pay what the player already drove',
  conc: 'CONCENTRATION runs end to end with no GM — the machine that loses least',
  spent: 'a chip the player cannot delete is spent ONCE — the record on the card, not the sheet, says so',
  cast: 'the CAST SLICE on the flow elect — a self-buff lands on the caster\'s own sheet with no GM (ruling 4, 2026-09-05)'
};
const { plan, pulled } = sectionPlan(SECTIONS, {});
const want = id => !plan || plan.includes(String(id));
const env = loadEnv();

const out = { results: [], log: [], skips: [] };
const ok = (name, pass, detail = '') => out.results.push({ name, pass, detail });

console.log('[nogm] player connecting (no GM session is opened by this suite)…');
const player = new Foundry(playerConfig(env));
await player.connect();
announcePlan('nogm', plan, pulled);

// The player page's own errors for the WHOLE run, with the STACK (pageerror carries it; a
// console.error(err) arrives as a JSHandle read back off the page), timed and counted so each
// lands between sections.
const pageErrors = [];
const runStart = Date.now();
const stampError = text => pageErrors.push(`[+${Date.now() - runStart}ms, after ${out.results.length} assertions] ${text}`);
try {
  player.page.on('pageerror', e => stampError(`pageerror: ${(e?.stack || e?.message || e)}`.slice(0, 1500)));
  player.page.on('console', m => {
    if (m.type() !== 'error') return;
    const loc = m.location?.();
    const where = loc?.url ? ` @ ${loc.url.replace(/^.*\/(modules|systems|scripts)\//, '$1/')}:${loc.lineNumber}` : '';
    stampError(`console: ${m.text().slice(0, 300)}${where}`);
    Promise.all(m.args().map(a => a.evaluate(v => (v instanceof Error) ? v.stack : null).catch(() => null)))
      .then(stacks => { for (const s of stacks) if (s) pageErrors.push(`  stack: ${s.slice(0, 1500)}`); })
      .catch(() => {});
  });
} catch { /* no page handle — nothing to listen to */ }

let gm = null;
try {
  // ---------------------------------------------------------------- preflight: truly no GM
  const pre = await player.evaluate(async modId => {
    const mod = game.modules.get(modId);
    return {
      ready: game.ready,
      me: game.user.name,
      isGM: game.user.isGM,
      activeGM: game.users.activeGM?.name ?? null,
      moduleActive: !!mod?.active,
      hasFlowSetting: game.settings.settings.has(`${modId}.noticeTimer`),
      masteryRiders: game.settings.get(modId, 'masteryRiders'),
      pc: game.actors.getName('BF Test PC Attacker')?.id ?? null,
      victim: game.actors.getName('BF Test Victim')?.id ?? null
    };
  }, MOD);
  console.log(`[nogm] connected as "${pre.me}" (isGM=${pre.isGM}); activeGM=${pre.activeGM ?? 'none'}`);
  if (pre.activeGM) {
    console.error(`[nogm] FATAL: a GM ("${pre.activeGM}") is connected — disconnect the bridge and`
      + ' close any GM window. This suite exists to test their ABSENCE.');
    process.exit(1);
  }
  if (pre.isGM) { console.error('[nogm] FATAL: the test user is GM-capable.'); process.exit(1); }
  if (!pre.moduleActive) { console.error('[nogm] FATAL: the module is not active.'); process.exit(1); }
  if (!pre.hasFlowSetting) {
    console.error('[nogm] FATAL: this client is running OLD code (noticeTimer unregistered) — F5.');
    process.exit(1);
  }
  if (!pre.pc || !pre.victim) {
    console.error('[nogm] FATAL: missing fixture — run tools/fixture-suite.mjs first.');
    process.exit(1);
  }
  if (!pre.masteryRiders) { console.error('[nogm] FATAL: masteryRiders is off.'); process.exit(1); }

  // ------------------------------------------------------------------------ drive one hit
  // ⚠ EVERYTHING HERE RUNS ON THE PLAYER'S CLIENT, fixture prep included: a player may grant an
  // item to their own actor and roll their own attack, never touch the monster.
  const hit = await player.evaluate(async modId => {
    const log = [];
    const pc = game.actors.getName('BF Test PC Attacker');
    const victim = game.actors.getName('BF Test Victim');
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const until = async (fn, ms = 12_000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
      return fn();
    };

    // A weapon with a mastery, found by SHAPE from the packs (names and pack ids shift).
    let weapon = pc.items.find(i => (i.type === 'weapon') && i.system.mastery
      && i.system.type?.baseItem && i.system.activities?.some?.(a => a.type === 'attack'));
    let madeWeapon = null;
    if (!weapon) {
      for (const pack of game.packs) {
        if (pack.documentName !== 'Item') continue;
        if (pack.metadata.id.startsWith('JB2A')) continue;
        let index;
        try { index = await pack.getIndex({ fields: ['type', 'system.mastery', 'system.type.baseItem'] }); }
        catch { continue; }
        for (const entry of index) {
          if ((entry.type !== 'weapon') || !entry.system?.mastery || !entry.system?.type?.baseItem) continue;
          const doc = await pack.getDocument(entry._id);
          if (!doc.system.activities?.some?.(a => a.type === 'attack')) continue;
          [weapon] = await pc.createEmbeddedDocuments('Item', [doc.toObject()]);
          madeWeapon = weapon.id;
          log.push(`granted ${weapon.name} to the PC (player-side create)`);
          break;
        }
        if (weapon) break;
      }
    }
    if (!weapon) return { error: 'no mastery weapon available in any pack' };
    // Sap pays on the HIT alone with no damage gate: the purest case.
    if (weapon.system.mastery !== 'sap') await weapon.update({ 'system.mastery': 'sap' });
    if (!pc.system.traits?.weaponProf?.mastery?.value?.has?.(weapon.system.type.baseItem)) {
      await pc.update({ "system.traits.weaponProf.mastery.value":
        [...(pc.system.traits?.weaponProf?.mastery?.value ?? []), weapon.system.type.baseItem] });
      log.push(`granted the ${weapon.system.type.baseItem} mastery trait`);
    }

    // ⚠ The player cannot pin the monster's AC, so the attack rolls with advantage and retries.
    const scene = game.scenes.getName('Battle Flow Test Range');
    // ⚠ NAME THE MISSING FIXTURE instead of crashing inside page.evaluate: the scene is invisible
    // without OBSERVER, and other suites sweep the victim token off the range.
    if (!scene) return { error: 'the test scene is not visible to this player — run tools/fixture-suite.mjs (it grants OBSERVER)' };
    if (canvas.scene?.id !== scene.id) await scene.view();
    await until(() => canvas.ready, 20_000);
    const tokenDoc = scene.tokens.find(t => t.actorId === victim.id);
    if (!tokenDoc) return { error: 'no BF Test Victim token on the range — a previous suite swept it; run tools/fixture-suite.mjs (a player cannot place one)' };
    const token = await until(() => canvas.tokens.get(tokenDoc.id), 10_000);
    if (!token) return { error: 'the victim token never reached the canvas' };
    token.setTarget(true, { releaseOthers: true });

    const activity = weapon.system.activities.find(a => a.type === 'attack');
    const before = new Set(game.messages.contents.map(m => m.id));
    const chipsBefore = (canvas.tokens.get(tokenDoc.id).actor.effects ?? [])
      .filter(e => e.getFlag(modId, 'mastery') === 'sap').length;

    let attackMsg = null;
    let hitLanded = false;
    for (let tryN = 0; tryN < 8 && !hitLanded; tryN++) {
      const use = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = use?.message?.id ?? null;
      const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
        { data: { 'system.origin': usageId } });
      attackMsg = rolls?.[0]?.parent ?? null;
      const targets = (attackMsg?.system?.targets ?? []).map(t => ({ ...t, uuid: t.actor }));
      const total = rolls?.[0]?.total ?? 0;
      hitLanded = targets.some(t => total >= (t.ac ?? 99));
      if (!hitLanded) await sleep(250);
    }
    if (!hitLanded) return { error: 'could not land a hit in 8 attempts', madeWeapon };

    const dmg = activity.damage ? await activity.rollDamage({}, { configure: false },
      { data: { 'system.origin': attackMsg.id } }).catch(() => null) : null;

    const notice = await until(() => game.messages.contents
      .filter(m => !before.has(m.id))
      .find(m => m.getFlag(modId, 'masteryNotice')?.key === 'sap') ?? null, 15_000);

    // ⚠ EVERY no-GM whisper, not the first: damage speaks for the target, mastery for the chip.
    await until(() => game.messages.contents.filter(m => !before.has(m.id))
      .some(m => (m.whisper ?? []).includes(game.user.id)
        && /no gm is connected/i.test(m.content ?? '')), 8_000);
    const whispers = game.messages.contents
      .filter(m => !before.has(m.id) && (m.whisper ?? []).includes(game.user.id)
        && /no gm is connected/i.test(m.content ?? ''))
      .map(m => (m.content ?? '').replace(/<[^>]+>/g, '').trim());

    const liveVictim = canvas.tokens.get(tokenDoc.id).actor;
    const chipsAfter = (liveVictim.effects ?? [])
      .filter(e => e.getFlag(modId, 'mastery') === 'sap').length;

    // ⚠ Scoped to THIS RUN, and the retry can land more than one hit: the property is "the rejoin
    // ADDS none", not "there is exactly one".
    const sapNotices = game.messages.contents
      .filter(m => !before.has(m.id) && (m.getFlag(modId, 'masteryNotice')?.key === 'sap')).length;

    return {
      log, madeWeapon, sapNotices,
      weaponUuid: weapon.uuid,
      beforeIds: [...before],
      attackId: attackMsg?.id ?? null,
      damageId: dmg?.[0]?.parent?.id ?? null,
      noticeId: notice?.id ?? null,
      noticeKey: notice?.getFlag(modId, 'masteryNotice')?.key ?? null,
      noticeWindow: notice?.getFlag(modId, 'masteryNotice')?.window ?? null,
      whispers, chipsBefore, chipsAfter
    };
  }, MOD);

  if (hit.error) { console.error(`[nogm] FATAL: ${hit.error}`); process.exit(1); }
  out.log.push(...(hit.log ?? []));

  if (want('runs')) {
    ok('§runs the Sap reminder card posts with nobody behind the screen',
      !!hit.noticeId && (hit.noticeKey === 'sap'),
      `notice=${hit.noticeId} key=${hit.noticeKey}`);
    ok('§runs …carrying its window, so the card runs the same clock it always did',
      hit.noticeWindow === 24, `window=${hit.noticeWindow}`);
  }

  if (want('chip')) {
    // ⚠ The player has no permission to write the monster: the write must be skipped, not attempted.
    ok('§chip the monster is never written to — no Sapped chip appears',
      hit.chipsAfter === hit.chipsBefore,
      `chips before=${hit.chipsBefore} after=${hit.chipsAfter}`);
  }

  if (want('told')) {
    const sapWhisper = (hit.whispers ?? []).find(w => /sap/i.test(w));
    ok('§told the driver is whispered that the Sap chip did not apply',
      !!sapWhisper, (hit.whispers ?? []).join(' | ') || 'no no-GM whisper at all');
    ok('§told …and the whisper says what still STANDS, not just what failed',
      !!sapWhisper && /still stands|roll dialog|by hand|card/i.test(sapWhisper),
      sapWhisper ?? 'no Sap whisper');
    ok('§told the blocked damage is spoken for too — one notice per consequence',
      (hit.whispers ?? []).some(w => /damage/i.test(w)),
      (hit.whispers ?? []).join(' | ') || 'none');
  }

  /* --- §conc: concentration, end to end, with nobody behind the screen -------------------
   * Every step touches a sheet the player owns: they take the damage, their client stamps the ask,
   * they roll the save, and ending concentration is a write to their own actor. */
  if (want('conc')) {
    const conc = await player.evaluate(async modId => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const until = async (fn, ms = 15_000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
        return fn();
      };
      const pc = game.actors.getName('BF Test PC Attacker');
      if (!pc) return { error: 'no PC fixture' };
      const priorMode = game.settings.get(modId, 'concMode');
      const priorBreak = game.settings.get(modId, 'concBreak');
      try {
        // ⚠ Settings are WORLD-scoped and a player cannot write them: skip rather than report a false red.
        if (priorMode === 'off') {
          return { skipped: 'concMode is off and a player cannot change a world setting' };
        }
        // A real concentration effect on the PC's own sheet — a write the player owns.
        const spell = pc.items.find(i => i.type === 'spell') ?? null;
        await pc.createEmbeddedDocuments('ActiveEffect', [{
          name: 'BF NoGM Concentration', img: 'icons/svg/daze.svg',
          origin: spell?.uuid ?? pc.uuid,
          duration: { seconds: 600 },
          statuses: ['concentrating'],
          flags: { dnd5e: { item: { name: 'BF NoGM Focus' } } }
        }]);
        await sleep(400);
        const eff = pc.effects.find(e => e.name === 'BF NoGM Concentration');
        if (!eff) return { error: 'could not seed a concentration effect' };
        const concentrating = (pc.concentration?.effects?.size ?? 0) > 0;

        // Damage the PC's OWN sheet, so dnd5e.damageActor (where the ask is stamped) fires on this client.
        const before = new Set(game.messages.contents.map(m => m.id));
        const hp = pc.system.attributes.hp;
        await pc.update({ 'system.attributes.hp.value': Math.max(1, hp.value - 5) });
        const ask = await until(() => game.messages.contents.filter(m => !before.has(m.id))
          .find(m => m.getFlag(modId, 'concentration')?.actorUuid === pc.uuid) ?? null, 12_000);

        return {
          concentrating,
          askPosted: !!ask,
          askAuthorIsMe: ask ? (ask.author?.id === game.user.id) : null,
          askStatus: ask?.getFlag(modId, 'concentration')?.status ?? null,
          priorMode, priorBreak
        };
      } finally {
        const strays = pc.effects.filter(e => e.name === 'BF NoGM Concentration');
        if (strays.length) await pc.deleteEmbeddedDocuments('ActiveEffect', strays.map(e => e.id));
        await pc.update({ 'system.attributes.hp.value': pc.system.attributes.hp.max });
      }
    }, MOD);

    if (conc.skipped) {
      out.skips.push(`§conc ${conc.skipped}`);
    } else if (conc.error) {
      ok('§conc the section could set itself up', false, conc.error);
    } else {
      ok('§conc the PC really is concentrating (the precondition)',
        conc.concentrating === true, JSON.stringify(conc));
      ok('§conc THE ASK IS STAMPED WITH NO GM — the machine runs at all',
        conc.askPosted === true, JSON.stringify(conc));
      ok('§conc …and the PLAYER\'S OWN client authored it, not a GM',
        conc.askAuthorIsMe === true, `author is me=${conc.askAuthorIsMe}`);
      ok('§conc …and it is pending, so the save can still be rolled',
        conc.askStatus === 'pending', `status=${conc.askStatus}`);
    }
  }

  /* --- §spent: a chip nobody here can delete is still spent — once ---------------------------
   * With no GM the chip's delete cannot happen, so a RECORDED spend counts as spent whatever the
   * sheet says. A GM plants the chip, leaves, and the player swings twice. */
  if (want('spent')) {
    console.log('[nogm] §spent: a GM plants a Vexed chip, then leaves…');
    const planter = new Foundry(foundryConfig(env));
    await planter.connect();
    const planted = await planter.evaluate(async ({ modId, weaponUuid }) => {
      const victim = game.actors.getName('BF Test Victim');
      const scene = game.scenes.getName('Battle Flow Test Range');
      const tok = scene?.tokens.find(t => t.actorId === victim?.id);
      const actor = tok?.actor;
      if (!actor) return { error: 'no victim token on the range' };
      const stale = actor.effects.filter(e => e.getFlag(modId, 'mastery') === 'vex').map(e => e.id);
      if (stale.length) await actor.deleteEmbeddedDocuments('ActiveEffect', stale);
      const chip = await ActiveEffect.implementation.create({
        name: 'Vexed', img: 'icons/svg/target.svg', origin: weaponUuid, transfer: false, disabled: false,
        duration: { value: 1, units: 'rounds', expiry: 'turnEnd', expired: false },
        flags: { [modId]: { mastery: 'vex' } }
      }, { parent: actor });
      const priorList = game.settings.get(modId, 'reminderList');
      if (!/\bvex\b/.test(priorList)) await game.settings.set(modId, 'reminderList', 'vex, sap, prone, condition');
      return { chipId: chip.id, actorUuid: actor.uuid, tokenId: tok.id, priorList };
    }, { modId: MOD, weaponUuid: hit.weaponUuid });
    await disposeSafely(planter, 'nogm-planter');
    if (planted.error) {
      ok('§spent the section could set itself up', false, planted.error);
    } else {
      // The player page's errors, so a swing that finds no dialog says WHY.
      const errorsBefore = pageErrors.length;
      const spent = await player.evaluate(async ({ modId, chipId, tokenId, weaponUuid }) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const until = async (fn, ms = 15_000) => {
          const t0 = Date.now();
          while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
          return fn();
        };
        const log = [];
        // The planter must be GONE and the chip replicated here.
        const noGM = await until(() => !game.users.activeGM, 20_000);
        const token = canvas.tokens.get(tokenId);
        const chip = await until(() => token?.actor?.effects?.get(chipId), 10_000);
        if (!noGM) return { error: `a GM is still active: ${game.users.activeGM?.name}` };
        if (!chip) return { error: 'the planted chip never reached the player' };
        token.setTarget(true, { releaseOthers: true });
        await sleep(100);
        const weapon = await fromUuid(weaponUuid);
        const activity = weapon?.system?.activities?.find(a => a.type === 'attack');
        if (!activity) return { error: 'the weapon has no attack activity' };
        // The gate lives INSIDE the system's roll dialog: one carrying Battle Flow's section is the gate.
        // ⚠ Read ALL roll dialogs: §conc can leave a Saving Throw dialog standing on this client. The
        // attack's is told by its class, the gate by our section.
        const rollDialogs = () => [...foundry.applications.instances.values()]
          .filter(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element);
        const gateOpen = () => rollDialogs().find(app => app.element.querySelector('[data-bf-reminder]')) ?? null;
        const systemOpen = () => rollDialogs().some(app => /AttackRollConfigurationDialog/.test(app.constructor?.name ?? ''));
        const closeAll = async () => {
          for (const app of foundry.applications.instances.values()) {
            if (/RollConfigurationDialog/.test(app.constructor?.name ?? '')) { try { await app.close(); } catch { /* gone */ } }
          }
        };
        const buttonSwing = async () => {
          const use = await activity.use({ subsequentActions: false }, { configure: false }, {});
          const usageId = use?.message?.id ?? null;
          const li = await until(() => document.querySelector(`.message[data-message-id="${usageId}"]`), 5000);
          if (!li) throw new Error('the usage card never reached the DOM');
          const event = { target: li.querySelector('button[data-action="rollAttack"]') ?? li, clientY: 200,
            altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
          const attacksBefore = game.messages.contents.filter(m => m.type === 'attack').length;
          void activity.rollAttack({ event }, {}, {});
          return { usageId, attacksBefore };
        };
        const lastAttack = () => game.messages.contents.filter(m => m.type === 'attack').pop() ?? null;

        // Swing 1: the gate lists the Vex; press Advantage; the spend is RECORDED and the chip stays.
        const first = await buttonSwing();
        const gate1 = await until(gateOpen, 8000);
        const text1 = (gate1?.element?.querySelector('[data-bf-reminder]')?.textContent ?? '').replace(/\s+/g, ' ');
        gate1?.element?.querySelector('button[data-action="advantage"]')?.click();
        const msg1 = await until(() => { const m = lastAttack(); return (m && (m._source.system?.origin === first.usageId)) ? m : null; }, 8000);
        const record = await until(() => game.messages.get(msg1?.id ?? '')?.getFlag(modId, 'chipSpend')?.spent?.find(s => s.id === chipId) ?? null, 8000);
        await sleep(1500);
        const chipStillThere = !!token.actor.effects.get(chipId);
        const system1 = systemOpen();
        log.push(`swing 1: gate=${!!gate1} system=${system1} record=${JSON.stringify(record)} chipStillThere=${chipStillThere}`
          + ` attackMsg=${!!msg1} dialogs=${[...foundry.applications.instances.values()].filter(a => /Dialog/.test(a.constructor?.name ?? '')).map(a => a.constructor.name).join('|')}`);
        await closeAll();

        // Swing 2: the same chip must NOT be offered again — nothing else bends, so the SYSTEM's own dialog opens.
        await buttonSwing();
        const system2 = await until(systemOpen, 6000);
        await sleep(300);
        const gate2 = gateOpen();
        const text2 = (gate2?.element?.querySelector('[data-bf-reminder]')?.textContent ?? '').replace(/\s+/g, ' ');
        await closeAll();
        // ⚠ Let the swing's consequences LAND (damage, then no-GM whispers) before returning, or they
        // become §cast's: wait for the log to go quiet, not a fixed beat.
        { const t0 = Date.now(); let last = game.messages.size, quietSince = Date.now();
          while ((Date.now() - t0 < 10_000) && (Date.now() - quietSince < 1500)) {
            await sleep(200);
            if (game.messages.size !== last) { last = game.messages.size; quietSince = Date.now(); }
          } }
        return { log, gate1: !!gate1, text1: text1.slice(0, 200), record, chipStillThere,
          gate2: !!gate2, text2: text2.slice(0, 200), system2, whisperedStays: game.messages.contents.some(m =>
            (m.whisper ?? []).includes(game.user.id) && /records the spend/i.test(m.content ?? '')) };
      }, { modId: MOD, chipId: planted.chipId, tokenId: planted.tokenId, weaponUuid: hit.weaponUuid });

      // The planted chip is the GM's to remove — reconnect just long enough to take it back.
      const sweeper = new Foundry(foundryConfig(env));
      await sweeper.connect();
      await sweeper.evaluate(async ({ modId, actorUuid, priorList }) => {
        const actor = await fromUuid(actorUuid);
        const ids = (actor?.effects ?? []).filter(e => e.getFlag(modId, 'mastery') === 'vex').map(e => e.id);
        if (ids.length) await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
        if (game.settings.get(modId, 'reminderList') !== priorList) await game.settings.set(modId, 'reminderList', priorList);
      }, { modId: MOD, actorUuid: planted.actorUuid, priorList: planted.priorList });
      await disposeSafely(sweeper, 'nogm-sweeper');

      if (pageErrors.length > errorsBefore) out.log.push(...pageErrors.slice(errorsBefore, errorsBefore + 12).map(e => `  · player page (during §spent): ${e}`));
      if (spent.error) {
        ok('§spent the section could run', false, spent.error);
      } else {
        out.log.push(...(spent.log ?? []));
        ok('§spent the gate lists the planted Vex on the first swing, with no GM', spent.gate1 && /Vexed/.test(spent.text1), spent.text1);
        ok('§spent …the spend is RECORDED on the attack card, honoured by the press', !!spent.record && (spent.record.honoured === true),
          JSON.stringify(spent.record));
        ok('§spent …and the chip STAYS on the monster — the player cannot delete it', spent.chipStillThere === true,
          `chip still there=${spent.chipStillThere}`);
        ok('§spent …and the driver is told the chip stays until a GM connects', spent.whisperedStays === true, `whispered=${spent.whisperedStays}`);
        ok('§spent THE SECOND SWING DOES NOT OFFER IT AGAIN — the record counts as spent; the system dialog opens instead',
          !spent.gate2 && spent.system2, `gate=${spent.gate2} system=${spent.system2} text=${spent.text2}`);
      }
    }
  }

  /* --- §cast: casting on the caster's flow elect ----------------------------------------------
   * This client applies what it MAY (the caster's own sheet), whispers the rest, and marks the card
   * answered. A self-aimed spell on the player's PC is the whole write set, so nothing is degraded
   * or whispered. The driver table in ARCHITECTURE §3 is the contract. */
  if (want('cast')) {
    const cast = await player.evaluate(async modId => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const until = async (fn, ms = 12_000) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
        return fn();
      };
      const pc = game.actors.getName('BF Test PC Attacker');
      if (!pc) return { error: 'no PC fixture' };
      if (!game.settings.get(modId, 'castApply')) return { skipped: 'castApply is off and a player cannot change a world setting' };
      const EFF = 'bfnogmfavor00000';
      const before = new Set(game.messages.contents.map(m => m.id));
      let item = null;
      try {
        // A self-aimed utility spell with one effect, on the player's PC: both writes are the player's.
        [item] = await pc.createEmbeddedDocuments('Item', [{
          name: 'BF NoGM Favor', type: 'spell',
          system: {
            level: 1, school: 'evo', properties: ['vocal'],
            target: { affects: { type: 'self', count: '', choice: false } },
            range: { units: 'self' },
            method: 'spell', prepared: 1, identifier: 'bf-nogm-favor',
            activities: {
              bfnogmutil000000: {
                _id: 'bfnogmutil000000', type: 'utility',
                activation: { type: 'bonus', override: false },
                consumption: { targets: [], spellSlot: false },
                effects: [{ _id: EFF }],
                target: { override: false, prompt: false }
              }
            }
          },
          effects: [{
            _id: EFF, name: 'BF NoGM Favored', transfer: false, disabled: false,
            img: 'icons/svg/sun.svg', duration: { seconds: 60 },
            description: '<p>+1d4 melee damage (BF no-GM fixture).</p>',
            changes: [{ key: 'system.rolls.damage.mwak.bonus', mode: 2, value: '1d4' }]
          }]
        }]);
        const activity = [...item.system.activities].find(a => a.type === 'utility');
        if (!activity) return { error: 'the fixture spell has no utility activity' };
        game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: false }); });
        await sleep(100);
        const use = await activity.use({}, { configure: false }, {});
        if (use === undefined) return { error: 'the fixture cast was refused' };
        const card = await until(() => game.messages.contents.filter(m => !before.has(m.id))
          .find(m => m.getFlag(modId, 'castApply')) ?? null, 12_000);
        const done = await until(() => (card?.getFlag(modId, 'effectReceipt')?.castDone ? card : null), 12_000);
        await sleep(300);
        const chip = pc.effects.find(e => e.name === 'BF NoGM Favored') ?? null;
        const whispers = game.messages.contents.filter(m => !before.has(m.id)
          && (m.whisper ?? []).includes(game.user.id) && /no gm is connected/i.test(m.content ?? ''))
          .map(m => (m.content ?? '').replace(/<[^>]+>/g, '').trim());
        return {
          pcUuid: pc.uuid,
          cardPosted: !!card,
          cardAuthorIsMe: card ? (card.author?.id === game.user.id) : null,
          targets: card?.getFlag(modId, 'castApply')?.targets ?? null,
          castDone: !!done,
          chipOnPc: !!chip,
          chipAuthorIsMe: chip ? ((chip._stats?.lastModifiedBy ?? chip._stats?.createdBy ?? game.user.id) === game.user.id) : null,
          receiptTargets: card?.getFlag(modId, 'effectReceipt')?.targets?.length ?? 0,
          whispers
        };
      } catch (err) {
        return { error: String(err?.message ?? err) };
      } finally {
        const strays = pc.effects.filter(e => e.name === 'BF NoGM Favored');
        if (strays.length) await pc.deleteEmbeddedDocuments('ActiveEffect', strays.map(e => e.id)).catch(() => {});
        if (item && pc.items.get(item.id)) await pc.deleteEmbeddedDocuments('Item', [item.id]).catch(() => {});
        const mine = game.messages.contents.filter(m => !before.has(m.id)
          && (m.isAuthor || m.canUserModify(game.user, 'delete')));
        if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id)).catch(() => {});
      }
    }, MOD);

    if (cast.skipped) {
      out.skips.push(`§cast ${cast.skipped}`);
    } else if (cast.error) {
      ok('§cast the section could set itself up', false, cast.error);
    } else {
      ok('§cast THE CAST SLICE DRIVES WITH NO GM — the usage card is stamped, and the PLAYER authored it',
        cast.cardPosted && (cast.cardAuthorIsMe === true), JSON.stringify({ posted: cast.cardPosted, mine: cast.cardAuthorIsMe }));
      ok('§cast …aimed at the caster alone (the self-aim), one target on the payload',
        Array.isArray(cast.targets) && (cast.targets.length === 1) && (cast.targets[0]?.uuid === cast.pcUuid),
        JSON.stringify(cast.targets));
      ok('§cast …and the effect LANDS on the caster\'s own sheet — a write the player owns',
        cast.chipOnPc === true, `chip on the PC=${cast.chipOnPc}`);
      ok('§cast …with the receipt marking the card asked-and-answered (castDone) and one target receipted',
        cast.castDone && (cast.receiptTargets === 1), `castDone=${cast.castDone} receiptTargets=${cast.receiptTargets}`);
      ok('§cast …and nothing to whisper — every target was writable, so nothing was degraded',
        (cast.whispers ?? []).length === 0, (cast.whispers ?? []).join(' | ') || 'no whisper');
    }
  }

  // ------------------------------------------------------- §rejoin: the GM comes back
  if (want('rejoin')) {
    console.log('[nogm] GM joining to test the rejoin case…');
    // ⚠ Hold the rejoin against the count just BEFORE the GM connects: §spent's swings post their
    // own notices, some late.
    const preRejoin = await player.evaluate(({ modId, beforeIds }) => {
      const before = new Set(beforeIds);
      return game.messages.contents.filter(m => !before.has(m.id) && (m.getFlag(modId, 'masteryNotice')?.key === 'sap')).length;
    }, { modId: MOD, beforeIds: hit.beforeIds });
    gm = new Foundry(foundryConfig(env));
    await gm.connect();
    // Give the GM's client time to render the log and run every resume path it owns.
    await new Promise(r => setTimeout(r, 6000));
    const after = await gm.evaluate(async ({ modId, noticeId, beforeIds }) => {
      const before = new Set(beforeIds);
      const notice = game.messages.get(noticeId);
      const notices = game.messages.contents
        .filter(m => !before.has(m.id) && (m.getFlag(modId, 'masteryNotice')?.key === 'sap')).length;
      // A GM re-running the payout would also land the Sapped chip late.
      const victim = game.actors.getName('BF Test Victim');
      const scene = game.scenes.getName('Battle Flow Test Range');
      const tok = scene?.tokens.find(t => t.actorId === victim?.id);
      const chips = (tok?.actor?.effects ?? [])
        .filter(e => e.getFlag(modId, 'mastery') === 'sap').length;
      return {
        activeGM: game.users.activeGM?.name ?? null,
        noticeStillThere: !!notice, sapNotices: notices, chips
      };
    }, { modId: MOD, noticeId: hit.noticeId, beforeIds: hit.beforeIds });

    ok('§rejoin a GM really did reconnect', !!after.activeGM, `activeGM=${after.activeGM}`);
    // ⚠ THE DOUBLE-PAYOUT GUARD: the GM's render-resume paths must recognise finished work.
    ok('§rejoin the rejoining GM adds no new reminder — the run\'s count is unchanged',
      after.sapNotices === preRejoin,
      `sap notices during the run: at §hit=${hit.sapNotices} before rejoin=${preRejoin} after=${after.sapNotices}`);
    ok('§rejoin …and no chip lands late — the resume never re-pays the payout',
      after.chips === 0, `sapped chips on the victim=${after.chips}`);
    ok('§rejoin the original card survives the rejoin', after.noticeStillThere,
      `notice present=${after.noticeStillThere}`);
  }

  // ----------------------------------------------------------------------------- teardown
  // ⚠ Player-side only: nothing was created on the monster side. Take back the granted weapon.
  await player.evaluate(async ({ modId, madeWeapon, ids }) => {
    const pc = game.actors.getName('BF Test PC Attacker');
    if (madeWeapon && pc?.items.get(madeWeapon)) {
      await pc.deleteEmbeddedDocuments('Item', [madeWeapon]);
    }
    const mine = game.messages.filter(m => ids.includes(m.id)
      || Object.keys(m.flags?.[modId] ?? {}).length
      || (m.whisper ?? []).includes(game.user.id));
    const deletable = mine.filter(m => m.isAuthor || m.canUserModify(game.user, 'delete'));
    if (deletable.length) await ChatMessage.deleteDocuments(deletable.map(m => m.id));
  }, { modId: MOD, madeWeapon: hit.madeWeapon,
    ids: [hit.attackId, hit.damageId, hit.noticeId].filter(Boolean) });
} finally {
  await disposeSafely(player, 'nogm-player');
  if (gm) await disposeSafely(gm, 'nogm-gm');
}

if (pageErrors.length) out.log.push(...pageErrors.slice(0, 30).map(e => `player page: ${e}`));
const failures = report({ tag: 'nogm', out, plan });
process.exit(failures ? 1 : 0);
