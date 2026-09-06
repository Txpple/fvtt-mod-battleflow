/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the Topple demand — the `topple` flag's lifecycle
 * off the card mastery.js posts as the payout: the twin-ask supersede, the popup (the system's
 * own saving-throw dialog), the buzzer, the fold, the failure's press and the GM button.
 * The machine-tier pass, Stage 4b (2026-09-05): mastery.js split by MOMENT — this file keeps
 * the payouts, the ask, the notices and the Cleave arm; topple.js took the `topple` flag's
 * lifecycle; chip-spend.js took the spend, the expiry tidy and the combat sweep. Every body is
 * the one mastery.js carried; nothing was rewritten.
 * The card is the bus (the emanations → saves precedent): mastery.js writes the flag, this file
 * drives it, and neither imports the other.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, isActiveGM, drivesMomentFor, canApplyTo, whisperNoGM, queueFlagWrite,
  canAnswerFor } from "./core.js";
import { resolveUuid } from "./lookup.js";
import { forceStatus, rollConfigFor } from "./shared.js";
import { popupKey, bfCard, momentBarHTML, ruleLine } from "./decide/present.js";
import { livePopups, DialogCarried, momentButton, scheduleBarSync, shownMoments, armDeadline,
  disarmDeadline, dramaticVerdictPause, registerDemand, demandAnsweredBy } from "./ui.js";

/** Does this client drive the topple moment the flag names? The elect, or the attacker's own
 * player with no GM connected — mastery.js's `drivesMasteryFlag`, the same core body. */
const drivesToppleFlag = flag => drivesMomentFor(flag?.attackerUuid);

/* --- the twin-ask supersede (the 2026-08-18 session's finding ⓪/②) -------------------------
 * `isActiveGM()` is per-USER, not per-CLIENT: two sessions logged in as the same account
 * BOTH pass it, and both stamp the ask — the session's twin Topple cards (00:37:24, both by
 * DM Assistant, contradictory verdicts: prone-by-timer AND saved-by-hand off one swing) are
 * the proof. Foundry exposes no cross-client session identity, so the race cannot be
 * prevented; it CAN be converged: every ask carries its provenance (sourceMessageId), and
 * when an ask arrives whose source already has an ELDER ask, the newcomer deletes itself.
 * Deterministic on every client (timestamp, then id), idempotent (a twin already deleted is
 * a caught no-op). The elder keeps the popups, the timer and the verdict. */
Hooks.on("createChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, "topple");
  if ( !flag?.sourceMessageId ) return;
  if ( !drivesToppleFlag(flag) ) return;
  const elder = game.messages.contents.some(m => {
    if ( m.id === message.id ) return false;
    if ( m.getFlag(MODULE_ID, "topple")?.sourceMessageId !== flag.sourceMessageId ) return false;
    return (m.timestamp < message.timestamp)
      || ((m.timestamp === message.timestamp) && (m.id < message.id));
  });
  if ( elder ) {
    disarmToppleTimer(message.id);
    message.delete().catch(() => { /* the other twin got there first */ });
  }
});

// Dialogs on their way up — between the call and the render that adopts them (saves.js's shape).
const toppleDialogsOpening = new Set();

/**
 * The topple save's table moment (v1.6.0, user call: "the GM didn't get a popup — the
 * cards are difficult to follow"). The same surface as the concentration ask — the story
 * over the native dialog's own controls (situational bonus, Advantage/Normal/Disadvantage)
 * — because it is the same class of moment: a save someone must roll NOW. Every button is
 * the same answer (roll, chained to the card so the fold judges); dismissing is not an
 * answer — the card's Roll button recalls this popup. Since v1.10.0 the demand carries the
 * save machine's timer (the flag's deadline), so the popup runs the same bar the card runs
 * — the pairing rule — and the buzzer below rolls whoever the clock catches.
 */
// ⚠ SINCE 2026-09-03 THIS IS THE SYSTEM'S OWN SAVING THROW DIALOG, not a house popup — the
// save demand's option E, applied here (DESIGN §5 *the save gate*): `rollSavingThrow` with
// `configure: true`, the demand riding `dialog.options` as a DialogCarried the spine paints
// (ui.js drawDemandFieldset) and adopts under the popup key the recall, the buzzer and the
// delete-sweep already use. The dialog's three buttons, its situational bonus and its roll
// mode are the system's; the save gate's section draws on it exactly as on a demanded save.
// ⚠ Its Fails button (a save the rules fail before the dice) is honoured below but never
// stands here today: Topple is a CONSTITUTION save and every automatic-failure row in
// SAVE_BENDS names Strength and Dexterity only (measured 2026-09-03).
async function showTopplePopup(message, topple, target) {
  const key = popupKey(message.id, `topple:${target.uuid}`);
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }
  if ( toppleDialogsOpening.has(key) ) return;
  toppleDialogsOpening.add(key);
  try {
    const flag = message.getFlag(MODULE_ID, "topple");
    const entry = flag?.targets?.find(t => t.uuid === target.uuid);
    if ( !entry || entry.done ) return;
    const actor = await fromUuid(target.uuid);
    if ( !(actor instanceof Actor) || !canAnswerFor(actor) ) return;
    const demand = new DialogCarried({
      cardId: message.id, key, failed: null,
      owed: card => { const e = card.getFlag(MODULE_ID, "topple")?.targets?.find(t => t.uuid === target.uuid); return !!e && !e.done; },
      present: card => ({
        img: card.getFlag(MODULE_ID, "topple")?.weapon?.img ?? null,
        eyebrow: "Weapon Mastery — Topple",
        title: `${target.name}: Constitution save, DC ${flag.dc}`,
        subtitle: `${flag.weapon?.name ?? "The weapon"} demands it.`,
        // (z): the consequence in the property's own words — the verbatim final sentence of
        // the Topple rule (the demand speaks to the TARGET; the trigger half is the attacker's).
        lines: [ruleLine("On a failed save, the creature has the Prone condition.")],
        tone: "pending"
      }),
      // The topple flag has no `status`; holdBarHTML gates on one, so hand it a pending view.
      bar: card => ({ status: "pending", ...card.getFlag(MODULE_ID, "topple") })
    });
    const rolls = await actor.rollSavingThrow(
      { ability: flag.ability || "con", target: flag.dc },
      { configure: true, options: { bfSaveDemand: demand } },
      { data: { "flags.dnd5e.originatingMessage": message.id } }
    );
    // Fails pressed: no roll, and the demand names what failed it — recorded as the failure
    // it is, the same write the fold makes, Prone pressed by the same consequence.
    if ( !rolls?.length && demand.failed ) await markToppleAutoFailed(message, target.uuid, demand.failed);
  } catch(err) {
    console.error(`${TITLE} | Topple save dialog failed — roll it from the sheet.`, err);
  } finally {
    toppleDialogsOpening.delete(key);
  }
}

/**
 * The fold without a die: a Topple save the rules fail before it is rolled (Paralyzed,
 * Stunned, Unconscious, Petrified — the save table's automatic failures), recorded exactly as
 * a rolled failure is and pressed through the same consequence; `total` stays null and the
 * card says why. The GM's "failed — Prone" button rides the same write.
 */
async function markToppleAutoFailed(message, uuid, sources = []) {
  let claimed = false;
  await queueFlagWrite(message, "topple", live => {
    const own = live.targets?.find(t => !t.done && (t.uuid === uuid));
    if ( !own ) return false;
    claimed = true;
    own.done = true;
    own.outcome = "prone";
    own.total = null;
    own.autoFailed = true;
    own.autoFailedBy = sources.filter(s => s.autoFail).map(s => s.statusName).join(", ") || null;
    own.answeredAt = Date.now();
  });
  if ( !claimed ) return;
  if ( (message.getFlag(MODULE_ID, "topple")?.targets ?? []).every(t => t.done) ) disarmToppleTimer(message.id);
  await applyToppleFailure(message, uuid);
}

/** Roll one pending topple target's save, chained to the card — the fold does the rest.
 * The buzzer's press rides the same path with `timedOut`, straight and data-driven. */
async function rollToppleSave(message, target, { mode = null, bonus = null, timedOut = false } = {}) {
  const flag = message.getFlag(MODULE_ID, "topple");
  const entry = flag?.targets?.find(t => t.uuid === target.uuid);
  if ( !entry || entry.done ) return;
  const actor = await fromUuid(target.uuid);
  if ( !(actor instanceof Actor) ) return;
  await actor.rollSavingThrow(
    { ability: flag.ability || "con", target: flag.dc,
      ...rollConfigFor(mode, bonus) },
    { configure: false },
    { data: {
      "flags.dnd5e.originatingMessage": message.id,
      ...(timedOut ? { [`flags.${MODULE_ID}.timedOut`]: true } : {})
    } });
}

/* --- the topple buzzer: expiry ROLLS, on the elect (v1.10.0) --------------------------------
 * The save machine's semantics on the topple demand: the deadline is stamped on the flag by
 * the caster's clock, the elect owns the buzzer, and an unanswered target's save is rolled
 * straight and data-driven at expiry — a demanded save is mandatory, so the timer only ever
 * decides who pressed the button. An answer already in the log beats the clock; a target
 * that no longer exists is voided (the save buzzer's rule — a demand must never sit pending
 * forever behind a buzzer that already fired).
 * ------------------------------------------------------------------------------------------- */
const toppleTimers = new Map();

function armToppleTimer(message) {
  const flag = message?.getFlag(MODULE_ID, "topple");
  if ( !flag?.deadline || !drivesToppleFlag(flag) ) return;
  if ( !(flag.targets ?? []).some(t => !t.done) ) return;
  armDeadline(toppleTimers, message.id, flag.deadline, fireToppleTimer);
}

const disarmToppleTimer = messageId => disarmDeadline(toppleTimers, messageId);

async function fireToppleTimer(messageId) {
  try {
    const card = game.messages.get(messageId);
    const flag = card?.getFlag(MODULE_ID, "topple");
    if ( !flag ) return;
    for ( const t of (flag.targets ?? []) ) {
      if ( t.done ) continue;
      // An unfolded answer beats the clock, not races it.
      const landed = game.messages.contents.find(m =>
        (m.getFlag("dnd5e", "roll.type") === "save")
        && (m.getFlag("dnd5e", "originatingMessage") === card.id)
        && (m.getAssociatedActor?.()?.uuid === t.uuid));
      if ( landed ) { void foldToppleSave(landed); continue; }
      const actor = await fromUuid(t.uuid).catch(() => null);
      if ( !(actor instanceof Actor) ) {
        // Through the serializer (D3): the read used to sit above this `await fromUuid`, and
        // this loop walks every target, so it races itself.
        await queueFlagWrite(card, "topple", live => {
          const gone = live.targets?.find(x => !x.done && (x.uuid === t.uuid));
          if ( !gone ) return false;
          gone.done = true;
          gone.outcome = "gone";
          gone.applied = true; // nothing to press
          gone.answeredAt = Date.now();
        });
        continue;
      }
      await rollToppleSave(card, t, { timedOut: true });
    }
  } catch(err) {
    console.error(`${TITLE} | Topple buzzer failed.`, err);
  }
}

/**
 * The Topple card folds its own save (user call 2026-08-16 — the Phase 2 seam pressed in
 * place, v1.5.0). The elect judges a Constitution save that answers a still-pending topple
 * target against the DC stored on the card — the ask's DC, exactly the concentration fold's
 * rule — and a failure presses the button itself: Prone, announced. The save ROLL stays
 * human-pressed; the GM per-target button remains for saves rolled on paper.
 *
 * Recognizer (the 2.5 shape): the roll's actor must be a still-pending target, the ability
 * must match, and the roll either chains to the topple card itself (the enricher click —
 * buildPost stamps originatingMessage from the enclosing card, basic-roll.mjs:173) or
 * chains to nothing at all (a bare sheet roll). A save chained to any OTHER message belongs
 * to that chain and is never read as a Topple answer. Pre-v1.5.0 cards carry no dc on the
 * flag and are skipped — their GM buttons still work.
 */
Hooks.on("createChatMessage", message => {
  if ( message.getFlag("dnd5e", "roll.type") !== "save" ) return;
  // The FOLD is a judgement plus a flag write on the card — reachable without a GM. Its
  // consequence (the Prone press) guards itself in applyToppleFailure.
  if ( !isActiveGM() && game.users.activeGM ) return;
  void foldToppleSave(message);
});

/**
 * The topple failure's consequence — the press, the announcement, and the resume receipt.
 * Split from the fold so the crash-resume can re-drive it: if the folding client dies inside
 * the verdict pause, the entry sits done+prone with no Prone on the token and no card — any
 * GM render past the resume horizon re-runs this. Idempotent by the `applied` receipt, and
 * the press VERIFIES (forceStatus) instead of trusting a toggle that no-ops silently over a
 * disabled leftover or a vetoed create (the live 2026-08-16 report).
 */
async function applyToppleFailure(card, uuid) {
  const flag = foundry.utils.deepClone(card.getFlag(MODULE_ID, "topple"));
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  if ( !entry || (entry.outcome !== "prone") || entry.applied ) return;
  const actor = resolveUuid(uuid);
  // ⚠ THE PRONE PRESS IS THE GM-ONLY HALF (v1.27.0). With no GM connected the save still
  // rolled and the card still judged it — the verdict is real and public — but nothing here
  // can touch the monster's conditions. This is the exact case the user named: tell the
  // driver what did not land, and leave the verdict standing.
  if ( (actor instanceof Actor) && !canApplyTo(actor) ) {
    await whisperNoGM(`Topple's Prone on ${entry.name}`,
      `The save failed (${entry.total ?? "?"} vs DC ${flag.dc}) and the card says so — set Prone by hand.`);
    return;
  }
  // The chip names its source (v1.11.0, finding ⑤) — pre-v1.11.0 cards carry no
  // attackerUuid and press sourceless, exactly as before.
  if ( actor instanceof Actor ) await forceStatus(actor, "prone", { origin: flag.attackerUuid ?? null });
  await ChatMessage.create({
    speaker: card.speaker,
    content: bfCard({
      img: flag.weapon?.img, eyebrow: "Weapon Mastery — Topple", tone: "good",
      title: `${entry.name} falls Prone`,
      subtitle: entry.autoFailed
        ? `Constitution save fails automatically — ${entry.autoFailedBy ?? "the condition"}`
        : `Constitution save ${entry.total ?? "?"} vs DC ${flag.dc}`
          + `${entry.timedOut ? " — rolled by the timer" : ""}`
    })
  });
  // ⚠ Through the serializer, and the claim re-checked INSIDE it (D3): two awaits stand
  // between the guard above and this write, which is exactly long enough for the fold to
  // record another target on the same flag and be overwritten.
  await queueFlagWrite(card, "topple", live => {
    const own = live.targets?.find(t => t.uuid === uuid);
    if ( !own || own.applied ) return false;
    own.applied = true;
  });
}

// Declared to the spine's demand registry (Stage 2, 2026-09-05), priority 2 — last, the ship
// order kept as ruling 1. A chained roll answers the card it chains to; a BARE roll defers to
// the older machines exactly as before: when a pending concentration ask or save demand names
// this actor with a matching ability, the bare roll is theirs — the topple's own popup and
// buzzer still stand, so nothing goes unresolved. ⚠ ANOTHER MACHINE'S STAMPED ANSWER IS NEVER A
// TOPPLE ANSWER (the 2026-08-18 session's finding ④, probe-proven): Edda's concentration answer
// — respondsTo on the roll, no originatingMessage — fell through to the whole-log branch and was
// claimed as her Topple save too; one roll, two verdicts, and her still-open Topple popup
// vanished resolved-by-theft. `answering: null` is that guard. Pre-v1.5.0 cards carry no dc and
// are skipped — their GM buttons still work.
registerDemand("topple", {
  priority: 2, chained: true, answering: null,
  pendingEntry: (flag, f) => (!(flag?.dc > 0) || (flag.ability && (f.ability !== flag.ability)))
    ? null : (flag.targets ?? []).find(t => !t.done && (t.uuid === f.actorUuid)) ?? null,
  pendingFor: (flag, uuid) => (flag?.dc > 0) ? (flag.targets ?? []).find(t => !t.done && (t.uuid === uuid)) ?? null : null
});

async function foldToppleSave(saveMessage) {
  try {
    const actor = saveMessage.getAssociatedActor?.();
    const total = saveMessage.rolls?.[0]?.total;
    if ( !actor || (typeof total !== "number") ) return;
    const found = demandAnsweredBy(saveMessage);
    if ( found?.flagKey !== "topple" ) return;   // another chain's, another machine's, or nobody's
    // Whole-log by design (the tail-window lesson); the oldest pending card answers first.
    for ( const { card } of found.matches ) {
      const flag = foundry.utils.deepClone(card.getFlag(MODULE_ID, "topple"));
      if ( !(flag?.dc > 0) ) continue;
      if ( flag.ability && (saveMessage.getFlag("dnd5e", "roll.ability") !== flag.ability) ) continue;
      const entry = flag.targets?.find(t => !t.done && (t.uuid === actor.uuid));
      if ( !entry ) continue;
      const success = total >= flag.dc;
      // ⚠ Through the serializer, claim repeated inside it (D3): per-target verdicts on one
      // shared array, and two saves answering one card land in the same tick. Re-finding the
      // entry under `!done` is also what stops two folds claiming the same roll.
      let claimed = false;
      await queueFlagWrite(card, "topple", live => {
        const own = live.targets?.find(t => !t.done && (t.uuid === actor.uuid));
        if ( !own ) return false;
        claimed = true;
        own.done = true;
        own.outcome = success ? "saved" : "prone";
        own.total = total;
        if ( saveMessage.getFlag(MODULE_ID, "timedOut") ) own.timedOut = true;
        // The crash-resume contract (the saves machine's `applied` discipline): answeredAt is
        // the horizon's clock and the new-era marker; a success has no consequence to resume.
        own.answeredAt = Date.now();
        if ( success ) own.applied = true;
      });
      // Another fold got there first — it owns the announcement and the consequence.
      if ( !claimed ) continue;
      // ⚠ Re-read, do NOT consult `flag`: it is the pre-write clone now that the verdict is
      // recorded inside the serializer, so it still shows this target as pending and the
      // clock would never be disarmed.
      if ( (card.getFlag(MODULE_ID, "topple")?.targets ?? []).every(t => t.done) ) {
        disarmToppleTimer(card.id);
      }
      if ( !success ) {
        await dramaticVerdictPause(saveMessage); // same instant-verdict class as the fold
        await applyToppleFailure(card, entry.uuid);
      } else {
        // A SUCCESS ANNOUNCES TOO (the 2026-08-18 session's finding ⑤, overturning the
        // v1.6.0 "closes quietly" choice): a public ask with a bar that resolves in
        // silence reads as a dropped machine — the user pressed Prone by hand all night,
        // sometimes on creatures that had SAVED, because nothing said the verdict landed.
        // Same shape as concentration's "holds" card: one line, the roll against the DC.
        await dramaticVerdictPause(saveMessage);
        // Source-then-result and the saver's own card (v1.19.x findings ⑦/⑧ — the same
        // sweep as the save verdict line).
        const stander = resolveUuid(entry.uuid);
        await ChatMessage.create({
          speaker: (stander instanceof Actor) ? ChatMessage.getSpeaker({ actor: stander }) : card.speaker,
          content: bfCard({
            img: flag.weapon?.img, eyebrow: "Weapon Mastery — Topple", tone: "neutral",
            title: `Topple — ${entry.name} stays standing`,
            subtitle: `Constitution save ${entry.total ?? "?"} vs DC ${flag.dc}`
              + `${entry.timedOut ? " — rolled by the timer" : ""}`
          })
        });
      }
      return; // one save answers one card
    }
  } catch(err) {
    console.error(`${TITLE} | Topple fold failed.`, err);
  }
}

// Every client closes a done entry's popup wherever it lives (a sheet roll answering the topple
// used to leave the popup open, still asking — the §4.3 withdrawal rule), and the buzzer
// disarms the moment nothing is pending.
Hooks.on("updateChatMessage", message => {
  const topple = message.getFlag(MODULE_ID, "topple");
  if ( topple ) {
    for ( const t of (topple.targets ?? []) ) {
      if ( !t.done ) continue;
      const dialog = livePopups.get(popupKey(message.id, `topple:${t.uuid}`));
      if ( dialog ) void dialog.close();
    }
    if ( !(topple.targets ?? []).some(t => !t.done) ) disarmToppleTimer(message.id);
    else armToppleTimer(message);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clock disarms here.
Hooks.on("deleteChatMessage", message => {
  disarmToppleTimer(message.id);
});

// The Topple card's rows: the demand's bar, the Roll button per target, the GM prone affordance.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const topple = message.getFlag(MODULE_ID, "topple");
  if ( topple?.targets?.length ) {
    // The demand's bar, card-side (v1.10.0 — the pairing rule): drains in step with every
    // popup, and the buzzer re-arms statelessly on render (a reload resumes the clock from
    // the flag's absolute deadline, the hold timer's discipline).
    if ( topple.deadline && topple.targets.some(t => !t.done) ) {
      const bar = document.createElement("div");
      bar.innerHTML = momentBarHTML(topple, "to roll");
      if ( bar.innerHTML.trim() ) {
        html.querySelector(".message-content")?.appendChild(bar);
        scheduleBarSync(bar);
      }
      armToppleTimer(message);
    }
    for ( const t of topple.targets ) {
      // Crash-resume: a folded failure whose press and announcement died with their client —
      // done+prone, unapplied, stale past any live pause. Elect-driven, new-era stamps only.
      if ( (t.outcome === "prone") && t.answeredAt && !t.applied && drivesToppleFlag(topple)
        && (Date.now() - t.answeredAt > 20_000) ) void applyToppleFailure(message, t.uuid);
      if ( t.done ) continue;
      const actor = resolveUuid(t.uuid);

      // ⚠ The native [[/save]] enricher rolls for whatever token is SELECTED — which right
      // after an attack is the ATTACKER, so the GM rolled Morgash's save at the dummy's
      // topple and the fold rightly ignored it (bit live 2026-08-16). The module's own
      // surface aims at the RIGHT actor: a popup on the decider's client (v1.6.0 — "the
      // cards are difficult to follow"), with the card's Roll button as its recall.
      if ( topple.dc && canAnswerFor(actor) ) {
        // v1.19.x finding (h): canAnswerFor alone routes — the extra `isGM &&
        // hasPlayerOwner` quiet was mutually exclusive with its active-owner check, so a
        // solo-GM room watched the buzzer eat every player-owned save ("failed (timer)",
        // twice, in the walk's log). The v1.12.0 taste is intact: an ONLINE owner still
        // excludes the GM inside canAnswerFor; only the nobody-home case now pops.
        const shownKey = popupKey(message.id, `topple:${t.uuid}`);
        if ( !shownMoments.has(shownKey) ) {
          shownMoments.add(shownKey);
          void showTopplePopup(message, topple, t);
        }
        html.querySelector(".message-content")?.appendChild(momentButton(`Roll save — ${t.name}`, () => {
          void showTopplePopup(message, message.getFlag(MODULE_ID, "topple"), t);
        }));
      }

      if ( game.user.isGM ) {
        html.querySelector(".message-content")?.appendChild(momentButton(`${t.name} failed — Prone`, async () => {
          const live = await fromUuid(t.uuid);
          if ( live instanceof Actor ) await forceStatus(live, "prone",
            { origin: message.getFlag(MODULE_ID, "topple")?.attackerUuid ?? null });
          // Through the serializer (D3): the GM's press lands after an await, on the same
          // per-target array a fold may be writing.
          await queueFlagWrite(message, "topple", live2 => {
            const entry = live2.targets?.find(x => x.uuid === t.uuid);
            if ( !entry ) return false;
            entry.done = true;
            entry.outcome = "prone";
            entry.applied = true;
            entry.answeredAt = Date.now();
          });
        }));
      }
    }
  }
});
