// NO-GM SMOKE — the flow keeps running when nobody is behind the screen (v1.27.0, user call).
//
// ⚠ THE ONLY SUITE IN THE TREE THAT CONNECTS **NO GM AT ALL**. Every other harness opens a
// GM session and asserts through it, which structurally cannot see the behaviour under test
// here: before v1.27.0 `isActiveGM()` was the sole gate on the payout chain, so a GM
// disconnect stopped Battle Flow dead — no chip, no card, no popup, and no error. The table
// read that as the module being flaky, because nothing ever said otherwise. That failure was
// invisible to the whole suite tree by construction: the tree always had a GM.
//
// The contract this asserts, in the user's words: "the popups all can run without a GM, and
// should, so the battleflow is always running. If there is no GM, then they simply do not
// apply effects like prone on the monster" — and whoever is driving is TOLD.
//
//   §runs    the reminder card and its flag still post with nobody behind the screen
//   §chip    …and the monster is NOT written to — no Sapped chip appears
//   §told    …and the driver gets a whisper naming what did not land
//   §rejoin  a GM reconnecting does not re-pay a payout the player already drove
//
// ⚠ RUN IT WITH THE BRIDGE DISCONNECTED AND NO GM WINDOW OPEN. The suite refuses to run if it
// finds an active GM — the whole point is their absence, and a stray GM silently converts this
// into a re-run of smoke-effects that passes for the wrong reason.
//
// Run:  node tools/smoke-nogm.mjs [--section runs,chip,told,rejoin] [--list]
import { announcePlan, disposeSafely, loadEnv, report, sectionPlan } from './harness.mjs';
import { playerConfig, foundryConfig } from './target.mjs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MOD = 'fvtt-mod-battleflow';
const SECTIONS = {
  runs: 'the mastery reminder still posts with no GM connected',
  chip: 'the monster is never written to — no chip lands',
  told: 'the driver is told what did not apply',
  rejoin: 'a GM rejoining does not re-pay what the player already drove',
  conc: 'CONCENTRATION runs end to end with no GM — the machine that loses least',
  spent: 'a chip the player cannot delete is spent ONCE — the record on the card, not the sheet, says so'
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
  // ⚠ EVERYTHING HERE RUNS ON THE PLAYER'S CLIENT, including the fixture prep — which is the
  // point. A player may grant an item to the actor they OWN and may roll their own attack;
  // they may not touch the monster. If any of this needed the GM the suite would be lying.
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

    // A weapon with a mastery, on the actor the player owns. Found by SHAPE from the packs —
    // the smoke-effects idiom, because names and pack ids shift and the shape is the need.
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
    // Sap: the purest case — it pays on the HIT alone with no damage gate, and its whole
    // enforcement is the reminder, so the no-GM degradation should cost almost nothing.
    if (weapon.system.mastery !== 'sap') await weapon.update({ 'system.mastery': 'sap' });
    if (!pc.system.traits?.weaponProf?.mastery?.value?.has?.(weapon.system.type.baseItem)) {
      await pc.update({ [`system.traits.weaponProf.mastery.value`]:
        [...(pc.system.traits?.weaponProf?.mastery?.value ?? []), weapon.system.type.baseItem] });
      log.push(`granted the ${weapon.system.type.baseItem} mastery trait`);
    }

    // The victim's token, targeted, with its AC pinned low so the swing lands. ⚠ The AC write
    // is on the MONSTER and the player cannot make it — so instead of pinning AC the attack
    // rolls with advantage and retries, exactly as a real player would have to.
    const scene = game.scenes.getName('Battle Flow Test Range');
    // ⚠ NAME THE MISSING FIXTURE, never crash on it. Both of these came back as
    // "Cannot read properties of undefined (reading 'id')" from inside a page.evaluate — a
    // stack trace with no fixture in it, which is the least readable failure this tree
    // produces. The scene is invisible to a player without OBSERVER, and the victim TOKEN is
    // swept off the range by other suites (smoke-effects says so in its own log), so both
    // are ordinary battery conditions rather than exotic ones.
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
        { data: { 'flags.dnd5e.originatingMessage': usageId } });
      attackMsg = rolls?.[0]?.parent ?? null;
      // hitTargets is the module's own reading; from here just ask the card.
      const targets = attackMsg?.getFlag('dnd5e', 'targets') ?? [];
      const total = rolls?.[0]?.total ?? 0;
      hitLanded = targets.some(t => total >= (t.ac ?? 99));
      if (!hitLanded) await sleep(250);
    }
    if (!hitLanded) return { error: 'could not land a hit in 8 attempts', madeWeapon };

    // Damage, so the payout chain runs its full length.
    const dmg = activity.damage ? await activity.rollDamage({}, { configure: false },
      { data: { 'flags.dnd5e.originatingMessage': attackMsg.id } }).catch(() => null) : null;

    // Wait for what the assertions read: the notice card.
    const notice = await until(() => game.messages.contents
      .filter(m => !before.has(m.id))
      .find(m => m.getFlag(modId, 'masteryNotice')?.key === 'sap') ?? null, 15_000);

    // ⚠ EVERY no-GM whisper, not the first one. This swing produces more than one — the damage
    // stage speaks for the target it could not touch, and the mastery stage speaks for the chip
    // — and an assertion that grabbed whichever landed first tested nothing about Sap.
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

    // ⚠ Scoped to THIS RUN. Counting sap notices across the whole log folds in every earlier
    // suite's leftovers, and the retry loop above can land more than one hit before it stops —
    // so the rejoin assertion compares this number against itself after the GM arrives rather
    // than against 1. The property is "the rejoin ADDS none", not "there is exactly one".
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
    // ⚠ THE HALF THAT MUST **NOT** HAPPEN. A player client has no permission to write the
    // monster, and the fix must skip that write rather than attempt it and throw.
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
   * ⚠ THE MACHINE THAT LOSES LEAST, and the reason the no-GM work was worth extending past
   * mastery. A concentrator is almost always a PC, so the subject of every step is a sheet
   * the player already owns: they take the damage, their client stamps the ask, they roll the
   * save, and ENDING concentration is a write to their own actor. Nothing here needs a GM at
   * all — before v1.27.2 the whole thing simply did not happen, silently.
   * ------------------------------------------------------------------------------------- */
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
      let effectId = null;
      try {
        // ⚠ Settings are WORLD-scoped: a player cannot write them. If the world is not already
        // in a state this section can use, say so rather than reporting a false red.
        if (priorMode === 'off') {
          return { skipped: 'concMode is off and a player cannot change a world setting' };
        }
        // A real concentration effect on the PC's own sheet — the player owns this write,
        // which is itself half the point of the section.
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
        effectId = eff?.id ?? null;
        if (!eff) return { error: 'could not seed a concentration effect' };
        const concentrating = (pc.concentration?.effects?.size ?? 0) > 0;

        // Damage the PC — their OWN sheet, so the player may apply it, and dnd5e.damageActor
        // fires on this client. That hook is where the ask is stamped.
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
        // Player-side cleanup only, and never leave a concentration marker behind.
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
   * ⚠ THE REVIEW'S FINDING 13 (2026-09-01). The spend writes its receipt on the attack card
   * FIRST and deletes the chip SECOND, and with no GM the delete cannot happen (the player
   * cannot write the monster) — so the Vexed chip lingered on the sheet, and the gate, reading
   * documents alone, listed it as live Advantage on EVERY swing and spent it again each time
   * until a GM connected. A recorded spend now counts as spent whatever the sheet says. A GM
   * plants the chip (as the earlier hit would have), leaves, and the player swings twice.
   * ------------------------------------------------------------------------------------- */
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
      const spent = await player.evaluate(async ({ modId, chipId, tokenId, weaponUuid }) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const until = async (fn, ms = 15_000) => {
          const t0 = Date.now();
          while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
          return fn();
        };
        const log = [];
        // The planter must be GONE — the whole point — and the chip must have replicated here.
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
        // The gate lives INSIDE the system's own roll dialog (2026-09-02): a rendered roll dialog
        // carrying Battle Flow's section is the gate; one without it is the bare system dialog.
        const rollDialog = () => [...foundry.applications.instances.values()]
          .find(app => /RollConfigurationDialog/.test(app.constructor?.name ?? '') && app.rendered && app.element) ?? null;
        const gateOpen = () => { const app = rollDialog(); return app?.element?.querySelector('[data-bf-reminder]') ? app : null; };
        const systemOpen = () => !!rollDialog();
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
          const attacksBefore = game.messages.contents.filter(m => m.getFlag('dnd5e', 'roll.type') === 'attack').length;
          void activity.rollAttack({ event }, {}, {});
          return { usageId, attacksBefore };
        };
        const lastAttack = () => game.messages.contents.filter(m => m.getFlag('dnd5e', 'roll.type') === 'attack').pop() ?? null;

        // Swing 1: the gate lists the Vex; press Advantage; the spend is RECORDED and the chip stays.
        const first = await buttonSwing();
        const gate1 = await until(gateOpen, 8000);
        const text1 = (gate1?.element?.querySelector('[data-bf-reminder]')?.textContent ?? '').replace(/\s+/g, ' ');
        gate1?.element?.querySelector('button[data-action="advantage"]')?.click();
        const msg1 = await until(() => { const m = lastAttack(); return (m && (m.getFlag('dnd5e', 'originatingMessage') === first.usageId)) ? m : null; }, 8000);
        const record = await until(() => game.messages.get(msg1?.id ?? '')?.getFlag(modId, 'chipSpend')?.spent?.find(s => s.id === chipId) ?? null, 8000);
        await sleep(1500);
        const chipStillThere = !!token.actor.effects.get(chipId);
        log.push(`swing 1: gate=${!!gate1} record=${JSON.stringify(record)} chipStillThere=${chipStillThere}`);
        await closeAll();

        // Swing 2: the same chip must NOT be offered again — nothing else bends, so the SYSTEM's own dialog opens.
        const second = await buttonSwing();
        const system2 = await until(systemOpen, 6000);
        await sleep(300);
        const gate2 = gateOpen();
        const text2 = (gate2?.element?.querySelector('[data-bf-reminder]')?.textContent ?? '').replace(/\s+/g, ' ');
        await closeAll();
        await sleep(300);
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

  // ------------------------------------------------------- §rejoin: the GM comes back
  if (want('rejoin')) {
    console.log('[nogm] GM joining to test the rejoin case…');
    gm = new Foundry(foundryConfig(env));
    await gm.connect();
    // Give the GM's client time to render the log and run every resume path it owns.
    await new Promise(r => setTimeout(r, 6000));
    const after = await gm.evaluate(async ({ modId, noticeId, beforeIds }) => {
      const before = new Set(beforeIds);
      const notice = game.messages.get(noticeId);
      const notices = game.messages.contents
        .filter(m => !before.has(m.id) && (m.getFlag(modId, 'masteryNotice')?.key === 'sap')).length;
      // The chip is the other half of the double-payout question: a GM whose resume paths
      // re-ran the payout would land the Sapped chip late, after the moment had passed.
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
    // ⚠ THE DOUBLE-PAYOUT GUARD. The player already drove this swing; the GM's render-resume
    // paths must recognise finished work rather than re-running it. A second Sap notice for
    // one swing is the failure this section exists to catch.
    ok('§rejoin the rejoining GM adds no new reminder — the run\'s count is unchanged',
      after.sapNotices === hit.sapNotices,
      `sap notices during the run: before rejoin=${hit.sapNotices} after=${after.sapNotices}`);
    ok('§rejoin …and no chip lands late — the resume never re-pays the payout',
      after.chips === 0, `sapped chips on the victim=${after.chips}`);
    ok('§rejoin the original card survives the rejoin', after.noticeStillThere,
      `notice present=${after.noticeStillThere}`);
  }

  // ----------------------------------------------------------------------------- teardown
  // ⚠ Player-side only — the suite created nothing on the monster side BY DESIGN, which is
  // the whole result. The granted weapon is the one thing to take back.
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

const failures = report({ tag: 'nogm', out, plan });
process.exit(failures ? 1 : 0);
