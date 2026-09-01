// TWO-CLIENT SMOKE — the properties a single-client suite is STRUCTURALLY unable to see
// (PLAN.md FOUNDATION 3.2 + 3.3).
//
// Everything else in tools/ drives one client that is simultaneously the attacker, the elect
// and the answerer. Two of this module's load-bearing behaviours only exist when those are
// DIFFERENT clients, and both have shipped untested since they were written:
//
//   §relay — THE RELAY'S RELAYED HALF (ARCHITECTURE §4.1). A player cannot write someone
//            else's message, so their answer travels as their OWN message carrying an
//            envelope, and the owning client folds it in. When the answerer can write the
//            target message the envelope never travels at all — so a solo suite exercises
//            the direct path and nothing else, every time, and the registry's `owns` column
//            (the hold's fold is the CONTINUING CLIENT's, the other two are the elect's) is
//            never put to the question.
//
//   §close  — THE POPUP CLOSING ACROSS CLIENTS (debt D2). `closeAnsweredHoldPopups` runs on
//            EVERY client, before the continuing-client gate, precisely because the popup to
//            close is usually on a different client from the one driving the resolution. When
//            the GM is both answerer and elect there is no second client's popup to close, so
//            the whole reason that function is not gated has never been demonstrated. Here the
//            GM's BUZZER resolves a hold and the PLAYER's popup must vanish — the GM never
//            touches the player's DOM; the player's own client closes it on seeing the flag.
//
// ⚠ THIS SUITE MUTATES. `check-popup-routing.mjs` is the read-only two-client check that is
// safe beside a live session; this one fires real attacks and is not.
//
// Fixture: `BF Test Player Shielder`, a clone of Gren (who carries a real Shield) OWNED BY THE
// PLAYER TEST USER, on the test range. Deleted on the way out. ⚠ It is a separate actor from
// `BF Test Shielder` on purpose — that one is deliberately GM-only (`ownership: {default: 0}`)
// so smoke-hold can answer for it, which is the exact opposite of what this suite needs.
//
// Sections: `--section relay`, `--section close`, `--list`.
import { announcePlan, connectSuite, disposeSafely, loadEnv, report, sectionPlan }
  from './harness.mjs';
import { playerConfig } from './target.mjs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const SECTIONS = {
  relay: "the hold's RELAYED answer — the player writes its own message, the elect folds it",
  close: "the hold's popup CLOSES on the other client when the buzzer answers it",
  ack: "a PLAYER's OK on a GM-authored notice reaches the GM's card (the relayed ack)"
};
// Each section stands its own attack up on the shared fixture and cleans up after itself.
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const want = id => !plan || plan.includes(String(id));
const env = loadEnv();
// Two real attack loops, each hunting a plain hit, plus a 5s buzzer wait.
const gm = await connectSuite({ tag: '2client', watchdogMs: 420_000 });
announcePlan('2client', plan, pulled);

const out = { results: [], log: [], skips: [] };
const ok = (name, pass, detail = '') => out.results.push({ name, pass, detail });
const note = l => out.log.push(l);

console.log('[2client] player connecting…');
const player = new Foundry(playerConfig(env));
await player.connect();
const who = await player.evaluate(async () => ({ name: game.user.name, id: game.user.id }), null);
console.log(`[2client] player "${who.name}" connected`);

/* --- setup: settings, the player-owned shielder, its token -------------------------------- */

const setup = await gm.evaluate(async ({ playerId }) => {
  const MODULE = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [];
  const KEYS = ['reactionHold', 'interruptList', 'holdTimer', 'holdSkipFutile', 'holdApplyEffect',
    'autoDamage', 'autoApply', 'requireTarget', 'dramaticBeat', 'riders', 'effectRiders',
    'masteryRiders', 'masteryAsk', 'saves', 'concMode', 'castApply', 'volleys', 'resourceNotices'];
  const prior = Object.fromEntries(KEYS.map(k => [k, game.settings.get(MODULE, k)]));
  const set = (k, v) => game.settings.set(MODULE, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const gren = game.actors.getName('Gren Greenmantle');
  if (!scene || !attacker || !gren) return { fatal: 'missing fixture: scene, BF Test Attacker or Gren' };
  if (canvas.scene?.id !== scene.id) { await scene.view(); await sleep(800); }

  await set('reactionHold', true);
  // ⚠ holdSkipFutile OFF for this suite, and it is not a shortcut. With it on, a hold is only
  // offered when the reaction's +5 could actually flip the outcome — so the attack has to land
  // inside a 5-wide band, which headless dice reach on roughly one roll in four. This suite is
  // about WHERE the answer travels and WHOSE popup closes, not about the futility gate
  // (smoke-hold §4f owns that), so every hit stamping a hold removes a flake that would have
  // nothing to do with what is under test.
  await set('holdSkipFutile', false);
  await set('holdApplyEffect', true);
  await set('holdTimer', 20);          // §relay answers by hand well inside this
  await set('autoDamage', 'all');
  await set('autoApply', true);
  await set('requireTarget', false);
  await set('dramaticBeat', 0);
  for (const k of ['riders', 'effectRiders', 'masteryRiders', 'saves', 'castApply', 'volleys',
    'resourceNotices']) await set(k, false);
  await set('masteryAsk', 'auto');
  await set('concMode', 'off');
  if (!String(game.settings.get(MODULE, 'interruptList')).includes('Shield:ac')) {
    return { fatal: 'the interrupt list does not carry Shield:ac — this suite has nothing to hold' };
  }

  // The player-owned shielder: Gren's sheet (a real Shield, real slots), the player as OWNER.
  let shielder = game.actors.getName('BF Test Player Shielder');
  if (!shielder) {
    const data = gren.toObject();
    delete data._id;
    data.name = 'BF Test Player Shielder';
    data.prototypeToken.actorLink = true;
    data.prototypeToken.name = 'BF Test Player Shielder';
    shielder = await Actor.create(data);
    log.push('created BF Test Player Shielder');
  }
  // OWNER for the player, and DEFAULT NONE — canAnswerFor must route to exactly one client.
  await shielder.update({ ownership: { default: 0, [playerId]: 3 } }, { diff: false, recursive: false });
  await shielder.update({
    'system.spells.spell1.value': shielder.system.spells.spell1.max || 4,
    'system.attributes.hp.value': shielder.system.attributes.hp.max,
    'system.attributes.hp.temp': 0
  });
  await shielder.unsetFlag(MODULE, 'reactionSpent');
  for (const e of shielder.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();

  let tok = scene.tokens.find(t => t.actorId === shielder.id);
  if (!tok) {
    [tok] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(
      shielder.prototypeToken.toObject(),
      { x: 1700, y: 1000, actorId: shielder.id, actorLink: true }, { inplace: false })]);
  }
  for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(tok.id)); i++) await sleep(250);
  if (!canvas.tokens.get(tok.id)) return { fatal: 'the shielder token never reached the canvas' };

  const weapon = attacker.items.find(i => i.system.activities?.some?.(a => a.type === 'attack'));
  if (!weapon) return { fatal: 'BF Test Attacker has no attack activity' };

  globalThis.__bf2c = { prior, shielderId: shielder.id, tokenId: tok.id, weaponId: weapon.id,
    suiteStart: Date.now() };
  return { log, shielderUuid: shielder.uuid, shielderName: shielder.name,
    ac: shielder.system.attributes.ac.value, hasPlayerOwner: shielder.hasPlayerOwner };
}, { playerId: who.id });

if (setup.fatal) {
  console.error(`\n[2client] FATAL: ${setup.fatal}`);
  await disposeSafely(player, '2client');
  await gm.disconnect?.();
  process.exit(2);
}
for (const l of setup.log) note(l);
note(`shielder ${setup.shielderName} AC ${setup.ac}, playerOwned=${setup.hasPlayerOwner}`);

/* --- the shared move: one plain hit on the shielder, and the hold it stamps ---------------- */

/** Attack until a plain (non-crit, non-fumble) hit stamps a pending hold. Returns its ids. */
const holdOnShielder = () => gm.evaluate(async () => {
  const MODULE = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const st = globalThis.__bf2c;
  const attacker = game.actors.getName('BF Test Attacker');
  const shielder = game.actors.get(st.shielderId);
  const token = canvas.tokens.get(st.tokenId);
  const activity = () => attacker.items.get(st.weaponId).system.activities.find(a => a.type === 'attack');
  const tried = [];
  for (let i = 0; i < 25; i++) {
    token.setTarget(true, { releaseOthers: true });
    const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
    const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
      { data: { 'flags.dnd5e.originatingMessage': usage?.message?.id } });
    const roll = rolls?.[0];
    const msg = roll?.parent;
    const ac = shielder.system.attributes.ac.value;
    if (roll && !roll.isCritical && !roll.isFumble && (roll.total >= ac)) {
      // The stamp is written by the attacker's own client, so it is here or it is nowhere.
      for (let w = 0; w < 40; w++) {
        const hold = game.messages.get(msg.id)?.getFlag(MODULE, 'hold');
        if (hold?.status === 'pending') {
          return { attackId: msg.id, usageId: usage?.message?.id, total: roll.total, ac,
            reaction: hold.targets?.[0]?.reaction ?? null, tried };
        }
        await sleep(150);
      }
      tried.push(`hit ${roll.total} vs AC ${ac} stamped NO hold`);
      continue;
    }
    tried.push(`total=${roll?.total} crit=${roll?.isCritical} fumble=${roll?.isFumble} ac=${ac}`);
    await sleep(120);
  }
  return { fatal: `no plain hit stamped a hold in 25 attempts: ${tried.slice(-6).join(' | ')}` };
}, null);

/** The player's view of a hold popup for a given attack, by its DialogV2 window title. */
const playerPopup = attackId => player.evaluate(async ({ id }) => {
  const dialogs = [...foundry.applications.instances.values()]
    .filter(a => (a instanceof foundry.applications.api.DialogV2) && a.rendered);
  const titles = dialogs.map(a => a.options?.window?.title ?? null);
  const dom = [...document.querySelectorAll('.application.dialog, dialog.application')]
    .map(d => d.querySelector('.window-title')?.textContent?.trim() ?? d.id);
  return {
    user: game.user.name,
    titles, dom,
    sawHold: !!game.messages.get(id)?.getFlag('fvtt-mod-battleflow', 'hold'),
    holdStatus: game.messages.get(id)?.getFlag('fvtt-mod-battleflow', 'hold')?.status ?? null
  };
}, { id: attackId });

/* --- §relay -------------------------------------------------------------------------------- */

if (want('relay')) {
  const hold = await holdOnShielder();
  if (hold.fatal) {
    ok('relay. an attack on the player-owned shielder stamps a hold', false, hold.fatal);
  } else {
    note(`relay: attack ${hold.attackId} total ${hold.total} vs AC ${hold.ac}, holding ${hold.reaction}`);
    // Give the player's client a moment to receive the flag and open its popup.
    const before = await player.evaluate(async ({ id }) => {
      for (let i = 0; i < 40; i++) {
        const dlg = [...foundry.applications.instances.values()]
          .find(a => (a instanceof foundry.applications.api.DialogV2) && a.rendered
            && /Shield/i.test(a.options?.window?.title ?? ''));
        if (dlg) return { found: true, title: dlg.options?.window?.title ?? null };
        await new Promise(r => setTimeout(r, 200));
      }
      const seen = game.messages.get(id)?.getFlag('fvtt-mod-battleflow', 'hold');
      return { found: false, holdSeen: !!seen, status: seen?.status ?? null };
    }, { id: hold.attackId });

    ok('relay/1. the popup opened on the PLAYER client — it owns the reacting actor',
      before.found === true, JSON.stringify(before));

    // The player answers. Pass, not Cast: the relay is the same either way, and Pass leaves
    // no effect to clean up on an actor this suite is about to delete.
    const answered = await player.evaluate(async () => {
      const before = new Set(game.messages.contents.map(m => m.id));
      const dlg = [...foundry.applications.instances.values()]
        .find(a => (a instanceof foundry.applications.api.DialogV2) && a.rendered
          && /Shield/i.test(a.options?.window?.title ?? ''));
      if (!dlg) return { clicked: false };
      dlg.element.querySelector('button[data-action="pass"]')?.click();
      // Wait for the player's OWN message — that is the relay, and it is written here.
      for (let i = 0; i < 40; i++) {
        const mine = game.messages.contents.find(m => !before.has(m.id)
          && (m.author?.id === game.user.id));
        if (mine) {
          return { clicked: true, msgId: mine.id, author: mine.author?.name ?? null,
            respondsTo: mine.getFlag('fvtt-mod-battleflow', 'respondsTo') ?? null,
            answer: mine.getFlag('fvtt-mod-battleflow', 'answer') ?? null,
            uuid: mine.getFlag('fvtt-mod-battleflow', 'uuid') ?? null,
            flags: Object.keys(mine.flags?.['fvtt-mod-battleflow'] ?? {}) };
        }
        await new Promise(r => setTimeout(r, 200));
      }
      return { clicked: true, msgId: null };
    }, null);

    ok('relay/2. the answer travelled as the PLAYER\'S OWN message, stamped respondsTo',
      !!answered.msgId && (answered.respondsTo === hold.attackId),
      JSON.stringify(answered));
    ok('relay/3. and it was authored by the player, not the GM — the whole point of the relay',
      answered.author === who.name, `author=${answered.author} want=${who.name}`);

    // The GM is the CONTINUING CLIENT (its own attack), so the fold happens over there.
    const folded = await gm.evaluate(async ({ id }) => {
      const MODULE = 'fvtt-mod-battleflow';
      for (let i = 0; i < 60; i++) {
        const h = game.messages.get(id)?.getFlag(MODULE, 'hold');
        if (h?.targets?.[0]?.answer) {
          return { answer: h.targets[0].answer, status: h.status,
            verdict: h.targets[0].verdict ?? null };
        }
        await new Promise(r => setTimeout(r, 250));
      }
      const h = game.messages.get(id)?.getFlag(MODULE, 'hold');
      return { answer: null, status: h?.status ?? null };
    }, { id: hold.attackId });

    ok('relay/4. the CONTINUING CLIENT folded the envelope into its own hold flag',
      folded.answer === 'pass', JSON.stringify(folded));
    ok('relay/5. and the fold ran the hold to a verdict — the chain continued on this side',
      (folded.status === 'resolved') && !!folded.verdict, JSON.stringify(folded));

    // The answered popup must also be gone on the answerer's own client (the same function,
    // local path) — the cross-client half is §close.
    const after = await playerPopup(hold.attackId);
    ok('relay/6. the answerer\'s own popup closed behind the answer',
      !after.titles.some(t => /Shield/i.test(t ?? '')), JSON.stringify(after.titles));
  }
} else {
  out.skips.push(`§relay ${SECTIONS.relay}`);
}

/* --- §close -------------------------------------------------------------------------------- */

if (want('close')) {
  // A short buzzer, so the GM's timer answers the hold while the player is still looking at it.
  await gm.evaluate(async () => game.settings.set('fvtt-mod-battleflow', 'holdTimer', 5), null);
  const hold = await holdOnShielder();
  if (hold.fatal) {
    ok('close. an attack on the player-owned shielder stamps a hold', false, hold.fatal);
  } else {
    note(`close: attack ${hold.attackId} total ${hold.total} vs AC ${hold.ac}`);
    const open = await player.evaluate(async () => {
      for (let i = 0; i < 40; i++) {
        const dlg = [...foundry.applications.instances.values()]
          .find(a => (a instanceof foundry.applications.api.DialogV2) && a.rendered
            && /Shield/i.test(a.options?.window?.title ?? ''));
        if (dlg) return { found: true, title: dlg.options?.window?.title ?? null };
        await new Promise(r => setTimeout(r, 200));
      }
      return { found: false };
    }, null);
    ok('close/1. the popup is open on the PLAYER client, unanswered',
      open.found === true, JSON.stringify(open));

    // ⚠ NOBODY TOUCHES THE PLAYER'S DOM. The buzzer fires on the CONTINUING CLIENT (the GM's,
    // because it rolled the attack), writes `answer: 'pass'` into the flag, and the player's
    // own client closes its popup on seeing that update. That is the whole of D2's gap, and it
    // is invisible to any suite where one client is both answerer and elect.
    const buzzed = await gm.evaluate(async ({ id }) => {
      const MODULE = 'fvtt-mod-battleflow';
      for (let i = 0; i < 60; i++) {
        const h = game.messages.get(id)?.getFlag(MODULE, 'hold');
        if (h && (h.status !== 'pending')) {
          return { status: h.status, answer: h.targets?.[0]?.answer ?? null,
            timedOut: h.targets?.[0]?.timedOut ?? null };
        }
        await new Promise(r => setTimeout(r, 250));
      }
      return { status: game.messages.get(id)?.getFlag(MODULE, 'hold')?.status ?? null };
    }, { id: hold.attackId });
    ok('close/2. the GM\'s buzzer answered the hold without the player touching it',
      (buzzed.status === 'resolved') && (buzzed.answer === 'pass'), JSON.stringify(buzzed));

    const closed = await player.evaluate(async () => {
      for (let i = 0; i < 40; i++) {
        const dlg = [...foundry.applications.instances.values()]
          .find(a => (a instanceof foundry.applications.api.DialogV2) && a.rendered
            && /Shield/i.test(a.options?.window?.title ?? ''));
        if (!dlg) return { open: false, at: i * 200 };
        await new Promise(r => setTimeout(r, 200));
      }
      return { open: true };
    }, null);
    ok('close/3. THE PLAYER\'S POPUP CLOSED — the other client\'s resolution reached it (D2)',
      closed.open === false, JSON.stringify(closed));
  }
} else {
  out.skips.push(`§close ${SECTIONS.close}`);
}

/* --- §ack: the player's OK reaches the GM's card (v1.27.1, reported from the table) ---------
 * ⚠ THE BUG THIS PINS. `acknowledgeMoment` wrote the flag only when `message.isOwner`, and the
 * reminder CARD is posted by the elect — so at a real table the acknowledger is a PLAYER and
 * the card belongs to the GM. Thomas pressed OK, his own popup closed, and the GM's card kept
 * draining for the full window and timed out: the press was invisible to the only client that
 * could record it. No solo suite could see this, because there the presser and the card's owner
 * are the same client and the direct write always ran.
 * ------------------------------------------------------------------------------------------- */
if (want('ack')) {
  // A notice card authored by the GM, exactly as postMasteryNotice writes one, naming the
  // PLAYER'S actor so the player's client is the one that owns the moment.
  const card = await gm.evaluate(async () => {
    const MODULE = 'fvtt-mod-battleflow';
    const st = globalThis.__bf2c;
    const msg = await ChatMessage.create({
      content: '<p>ack relay fixture</p>',
      flags: { [MODULE]: { masteryNotice: {
        key: 'sap', attackerUuid: game.actors.get(st.shielderId)?.uuid ?? null,
        weapon: { id: null, name: 'Fixture Blade', img: null },
        title: 'Sap', subtitle: 'ack relay fixture', lines: [],
        window: 24, deadline: Date.now() + 24_000
      } } }
    });
    return { id: msg.id, ackedAtBirth: msg.getFlag(MODULE, 'masteryNotice')?.acknowledged ?? false };
  }, null);
  ok('ack/1. the GM-authored notice card starts unacknowledged',
    card.ackedAtBirth === false, JSON.stringify(card));

  // The PLAYER acknowledges it. They are not the author and not a GM, so the direct write is
  // unavailable — this is precisely the path that used to stop at a local latch.
  const relayed = await player.evaluate(async cardId => {
    const MODULE = 'fvtt-mod-battleflow';
    const msg = game.messages.get(cardId);
    if (!msg) return { error: 'the player cannot see the card' };
    const isOwner = msg.isOwner;
    await game.modules.get(MODULE)?.api?.acknowledgeMoment?.(msg, 'masteryNotice');
    return { isOwner, called: !!game.modules.get(MODULE)?.api?.acknowledgeMoment };
  }, card.id);
  ok('ack/2. the player genuinely cannot write the card (the condition under test)',
    relayed.isOwner === false, JSON.stringify(relayed));

  // The GM's copy must now read acknowledged — that is the whole fix.
  const landed = await gm.evaluate(async cardId => {
    const MODULE = 'fvtt-mod-battleflow';
    for (let i = 0; i < 50; i++) {
      const m = game.messages.get(cardId);
      if (m?.getFlag(MODULE, 'masteryNotice')?.acknowledged === true) {
        // …and the wire signal must not survive as a line in the log.
        const envelopes = game.messages.contents
          .filter(x => x.getFlag(MODULE, 'momentAck')).length;
        return { acked: true, at: i * 200, envelopes };
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return { acked: false, envelopes: game.messages.contents
      .filter(x => x.getFlag(MODULE, 'momentAck')).length };
  }, card.id);
  ok('ack/3. THE PLAYER\'S OK REACHED THE GM\'S CARD — the bar stops, no timeout',
    landed.acked === true, JSON.stringify(landed));
  ok('ack/4. the relay envelope deleted itself — a wire signal, not a line in the log',
    landed.envelopes === 0, JSON.stringify(landed));
} else {
  out.skips.push(`§ack ${SECTIONS.ack}`);
}

/* --- teardown: always ---------------------------------------------------------------------- */

const torn = await gm.evaluate(async () => {
  const MODULE = 'fvtt-mod-battleflow';
  const st = globalThis.__bf2c;
  const errs = [];
  try { for (const [k, v] of Object.entries(st.prior)) await game.settings.set(MODULE, k, v); }
  catch (err) { errs.push(`settings: ${err?.message}`); }
  try {
    const scene = game.scenes.getName('Battle Flow Test Range');
    const tok = scene?.tokens.get(st.tokenId);
    if (tok) await scene.deleteEmbeddedDocuments('Token', [st.tokenId]);
    const shielder = game.actors.get(st.shielderId);
    if (shielder) await shielder.delete();
    for (const t of game.user.targets) t.setTarget(false, { releaseOthers: true });
    const mine = game.messages.filter(m => (m.timestamp >= st.suiteStart)
      && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
        || (Object.keys(m.flags?.[MODULE] ?? {}).length > 0)));
    if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    return { errs, deleted: mine.length };
  } catch (err) {
    errs.push(`cleanup: ${err?.message}`);
    return { errs, deleted: 0 };
  }
}, null);
for (const e of torn.errs ?? []) note(`TEARDOWN ERROR: ${e}`);
note(`teardown removed ${torn.deleted} messages, the token and the fixture actor`);

await disposeSafely(player, '2client');
const failures = report({ tag: '2client', out, plan });
await gm.disconnect?.();
process.exit(failures ? 1 : 0);
