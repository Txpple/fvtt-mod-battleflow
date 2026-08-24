/**
 * Battle Flow — THE SPINE (ARCHITECTURE.md §5, the moment map): the managed-popup lifecycle +
 * cascade, the popper discipline, the one shown-latch registry, the countdown bar's DOM half,
 * the ACK, the moment clocks.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 *
 * ⚠ **This file imports NO machine, and must not start.** It used to end with "plus the hold's
 * own row/popup views", and those views needed `reactionItem`/`answerHold`/`continueHold` from
 * hold.js — the ui.js ↔ hold.js cycle (§10 D6), and the one place the spine depended on a
 * FEATURE. D6 (2026-08-23) moved all 349 lines of them into hold.js, where the flag they are a
 * view of already lives. The dependency now runs one way, hold.js → ui.js, and the §7 rule
 * "depend downward only" holds here without an exception.
 *
 * The MARKUP the spine draws — the house card, the bar, the rule line, the staircase
 * arithmetic — is one layer down in decide/present.js: strings in, strings out, no document
 * and no DOM. What stays here is everything that touches a dialog, an element or a clock.
 */
// ⚠ Narrowed by D6: `S`, `setting`, `isContinuingClient` and `holdBarHTML` left with the hold's
// views. The spine reads no world setting and asks no ownership question of its own — every
// remaining core import is either identity (MODULE_ID, TITLE) or a gate a CALLER hands it.
import { MODULE_ID, TITLE, S, setting, isActiveGM, deadlineIsLive, canAnswerFor,
  queueFlagWrite } from "./core.js";
import { TONE, popupKey, bfCard, momentBarHTML, nextCascadeSlot, cascadePosition,
  eldersDeepestFirst } from "./decide/present.js";

/* ---------------------------------------------------------------------------------------------
 * The hold's views: a durable row on the attack card, plus a popup for whoever can answer.
 * Both are pure views of the flag — dismissing the popup is not an answer.
 * ------------------------------------------------------------------------------------------- */

/**
 * THE ONE SHOWN-LATCH REGISTRY (the spine). Popups a client has auto-shown, so a re-render
 * never stacks a second one — and the LATCH KEY IS THE POPUP KEY (`popupKey(messageId, sub)`),
 * which is what lets ONE delete-sweep below clean every machine's latches. Eleven per-machine
 * sets used to hold this state with four different key shapes, and their per-file cleanup
 * loops drifted (the copies are what round 3 exists to end). Machines un-latch through the
 * same key when their queue advances (a resolved conc ask re-offers the next, a save demand's
 * dropped entry re-arms a fresh ask).
 */
export const shownMoments = new Set();

/**
 * Popups currently on screen, keyed message+target. The popup is the ANSWER SURFACE and the
 * card is the public record of the same moment — one decides, one watches. Two live controls
 * for one decision is exactly how they got out of step (reported live 2026-08-15: answering on
 * the card left the popup sitting open, still asking).
 */
export const livePopups = new Map();

/**
 * THE CASCADE'S BOOKKEEPING (walk-4 finding (s)): the live half of the staircase — which key
 * holds which slot, and the anchor the pile grows from. The layout arithmetic itself is
 * decide/present.js; what is owned here is the LIFECYCLE, because only this file knows when a
 * dialog opens and closes. The anchor dies with the pile.
 */
const popupSlots = new Map();       // popup key → staircase slot
let cascadeAnchor = null;           // {left, top} the staircase grows from

/**
 * Register, render and lifecycle-manage a decision popup — ONE home for the discipline that
 * a popup is a VIEW: whatever closes it (a button, the X, escape, or an answer landing
 * anywhere else) releases the card row in exactly one place, and a failed render releases it
 * immediately, because the card is always the fallback surface. Both machines (the hold and
 * the mastery ask) and any future table moment (Phase 2.5) open their popups through this.
 */
export async function openManagedPopup(key, message, dialog) {
  const close = dialog.close.bind(dialog);
  dialog.close = async (...args) => {
    livePopups.delete(key);
    popupSlots.delete(key);
    if ( !popupSlots.size ) cascadeAnchor = null;   // the staircase dies with its pile
    try { ui.chat?.updateMessage?.(message); } catch(err) { /* row refreshes next render */ }
    return close(...args);
  };
  // THE CASCADE (ARCHITECTURE.md §5 law 7, recut by walk-4 finding (s)): the pile is a QUEUE IN
  // EVENT ORDER, and Z-ORDER IS CAUSAL ORDER (user ruling). The layout arithmetic — smallest
  // free slot, the step, the elders' fronting order — is decide/present.js; the dialogs are
  // this file's.
  const slot = nextCascadeSlot(popupSlots.values());
  popupSlots.set(key, slot);
  livePopups.set(key, dialog);
  try {
    await dialog.render({ force: true });
    const { left, top } = dialog.position ?? {};
    if ( Number.isFinite(left) && Number.isFinite(top) ) {
      if ( !cascadeAnchor ) cascadeAnchor = { left, top };
      const want = cascadePosition(cascadeAnchor, slot);
      if ( (want.left !== left) || (want.top !== top) ) dialog.setPosition(want);
    }
    if ( slot ) {
      // Re-front the elders, deepest first, so slot 0 ends on top and this newcomer sits
      // at the BACK of the pile — its turn comes when the earlier moments are answered.
      for ( const k of eldersDeepestFirst(popupSlots, key) ) {
        const d = livePopups.get(k);
        if ( d?.rendered ) { try { d.bringToFront?.(); } catch(err) { /* fronting is best-effort */ } }
      }
    }
    scheduleBarSync(dialog.element);
    // The row was drawn before this popup existed; redraw so it defers to the popup
    // instead of offering a second set of controls.
    ui.chat?.updateMessage?.(message);
  } catch(err) {
    livePopups.delete(key);
    popupSlots.delete(key);
    if ( !popupSlots.size ) cascadeAnchor = null;
    console.error(`${TITLE} | Could not open the popup — answer from the card.`, err);
  }
}

/**
 * THE POPPER DISCIPLINE (the spine): every machine popup opens through this — the
 * canAnswerFor gate, the shared key, front-a-live-popup-on-recall (a recall must never be a
 * silent no-op — "the Roll button does nothing" was a live report), DialogV2 construction,
 * and the notice family's auto-close. Content and buttons stay the machine's own; pass
 * `gate: false` to skip canAnswerFor (locality popups whose hook already runs on the right
 * client) — a NULL subject with the gate on is refused, exactly as a broken uuid should be.
 * Returns the dialog, or null when gated off or already open.
 */
export async function openMomentPopup(message, sub, subject, {
  title, icon, width = 440, content, buttons, autoCloseAt = null, gate = true
} = {}) {
  if ( gate && !canAnswerFor(subject) ) return null;
  const key = popupKey(message.id, sub);
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return null; }
  const dialog = new foundry.applications.api.DialogV2({
    window: { title, icon },
    position: { width },
    content, buttons,
    rejectClose: false
  });
  if ( autoCloseAt ) setTimeout(() => {
    if ( livePopups.get(key) === dialog ) void dialog.close();
  }, Math.max(0, autoCloseAt - Date.now()));
  await openManagedPopup(key, message, dialog);
  return dialog;
}

/* ---------------------------------------------------------------------------------------------
 * THE ACK (ARCHITECTURE.md §5 law 3 — finding (j)): any notice button press resolves its card's
 * pending presentation — bar gone, recall gone, popup gone. Durable via a flag write where
 * the acknowledger CAN write (the author or a GM — every solo case); client-local otherwise,
 * where the spectators' bars simply drain out as the window (the recorded trade: a player
 * cannot write the elect's message, and relaying an acknowledgement would spend a §4.1
 * message on a non-event). The ask machines already comply through their answer flags; the
 * notice family (Vex/Sap/Cleave/Hew) rides this.
 * ------------------------------------------------------------------------------------------- */

const localAcks = new Set();

export function momentAcknowledged(message, flagKey) {
  return (message.getFlag(MODULE_ID, flagKey)?.acknowledged === true)
    || localAcks.has(`${message.id}|${flagKey}`);
}

export async function acknowledgeMoment(message, flagKey) {
  if ( momentAcknowledged(message, flagKey) ) return;
  if ( message.isOwner ) {
    const flag = foundry.utils.deepClone(message.getFlag(MODULE_ID, flagKey) ?? {});
    flag.acknowledged = true;
    await message.setFlag(MODULE_ID, flagKey, flag);   // the update re-renders every client
    return;
  }
  localAcks.add(`${message.id}|${flagKey}`);
  try { ui.chat?.updateMessage?.(message); } catch(err) { /* row refreshes next render */ }
}

/** The one recall/answer button factory — eight hand-rolled copies collapsed here. */
export function momentButton(label, onClick, style = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, {
    width: "auto", margin: "0.25rem 0.25rem 0 0", padding: "0 0.6rem", ...style
  });
  button.addEventListener("click", () => onClick());
  return button;
}

/* ---------------------------------------------------------------------------------------------
 * The countdown bar, DOM half (ARCHITECTURE.md §5). The markup is decide/present.js; what is
 * here is the one thing a pure function cannot do — put the animation on the real element.
 *
 * ⚠ ZERO JS TICKING. The bar is one CSS animation whose duration is the hold's own window, and
 * a reload resumes it mid-drain from the deadline stored on the flag — so every client, and
 * every re-render, agrees without anyone counting. A per-second interval per open hold per
 * client is exactly the kind of thing that is fine with one hold on screen and miserable with
 * six.
 * ------------------------------------------------------------------------------------------- */

/**
 * Snap every bar to the actual deadline.
 *
 * ⚠ `animation-delay` is NOT enough, and this cost a measurement to find. A CSS animation's
 * clock starts when its element begins being RENDERED — and a chat message is first inserted
 * into a tree that is not rendering yet (the same several-DOM-trees behaviour that makes
 * render hooks stateless). So the card's bar started its drain seconds after the popup's,
 * from an identical declared delay, and stayed exactly that far behind for the whole hold:
 * measured at one instant, popup 71% and card 86%, both declaring -0.9s. The delay is relative
 * to a start the element chooses; `currentTime` is absolute, so it is what the deadline can
 * actually be written onto.
 *
 * One-shot, never a ticker — called on render and again on the next frame, because the first
 * call can land while the element is still not being rendered.
 */
function syncHoldBars(root) {
  const scope = (root && root.querySelectorAll) ? root : document;
  for ( const bar of scope.querySelectorAll("[data-bf-deadline]") ) {
    const deadline = Number(bar.dataset.bfDeadline);
    const seconds = Number(bar.dataset.bfWindow);
    if ( !deadline || !seconds ) continue;
    const duration = seconds * 1000;
    const elapsed = Math.max(0, Math.min(duration, duration - (deadline - Date.now())));

    // ⚠ Build the animation in JS rather than in CSS. A CSS animation is not INSTANTIATED
    // until its element is actually being rendered — measured: a freshly inserted card's bar
    // reported getAnimations().length === 0 and zero width more than a second after render,
    // so every correction pass found nothing to correct and the drain later started from zero.
    // element.animate() exists the moment it is called and runs on the document timeline, so
    // it neither waits for layout nor cares whether the element is on screen yet.
    let animations = bar.getAnimations?.() ?? [];
    if ( !animations.length ) animations = [
      bar.animate([{ width: "100%" }, { width: "0%" }],
        { duration, fill: "forwards", easing: "linear" }),
      bar.animate([
        { backgroundColor: TONE.good },
        { backgroundColor: TONE.pending, offset: 0.55 },
        { backgroundColor: TONE.bad }
      ], { duration, fill: "forwards", easing: "linear" })
    ];
    for ( const animation of animations ) {
      try { animation.currentTime = elapsed; } catch(err) { /* the next pass gets it */ }
    }
  }
}

/** Render, then correct — twice, because the first pass can precede the element rendering. */
export function scheduleBarSync(root) {
  syncHoldBars(root);
  requestAnimationFrame(() => syncHoldBars(root));
  setTimeout(() => syncHoldBars(root), 400);
}

/* ---------------------------------------------------------------------------------------------
 * THE MOMENT CLOCKS (the spine). armDeadline/disarmDeadline is the raw primitive — one timer
 * per id, absolute deadline, re-arm is a no-op; every machine clock builds its own GATE on it
 * (who owns the clock, what counts as pending) and its own FIRE (what expiry means). Three
 * hand-rolled arm/disarm trios used to reimplement the primitive with small drifts.
 * ------------------------------------------------------------------------------------------- */

export function armDeadline(timers, id, deadline, fire) {
  if ( !deadline || timers.has(id) ) return;
  // The roof (core.js): a deadline past the staleness ceiling belongs to a table that has moved
  // on. Arming it would fire on the next tick, and two of the five buzzers ROLL DICE.
  if ( !deadlineIsLive(deadline) ) return;
  timers.set(id, setTimeout(() => {
    timers.delete(id);
    void fire(id);
  }, Math.max(0, deadline - Date.now())));
}

export function disarmDeadline(timers, id) {
  const handle = timers.get(id);
  if ( handle === undefined ) return;
  clearTimeout(handle);
  timers.delete(id);
}

/**
 * The elect-owned single-answer clock — the mastery ask, the concentration ask, the save
 * demand, precision and the bash offer are true twins here (one pending flag, one answer,
 * expiry re-checks the live flag before acting). Moved here from mastery.js at round 3: the
 * spine was living in a machine file. The HOLD's clock below stays its own gate on purpose —
 * a different owner (the continuing client, not the elect) and per-target answers.
 */
export function armAskTimer(timers, message, flagKey, expire) {
  const flag = message?.getFlag(MODULE_ID, flagKey);
  if ( !flag?.deadline || (flag.status !== "pending") || flag.answer || !isActiveGM() ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    const cur = live?.getFlag(MODULE_ID, flagKey);
    if ( !cur || (cur.status !== "pending") || cur.answer ) return;
    await expire(live);
  });
}

export function disarmAskTimer(timers, messageId) {
  disarmDeadline(timers, messageId);
}

/**
 * Let the table SEE the roll before its verdict acts (user call 2026-08-16): wait out Dice
 * So Nice's animation when that module is present, then the same dramatic beat the attack →
 * damage reveal uses. The MECHANICS never wait — flags are written and timers disarmed
 * before this runs, so the buzzer cannot double-fire into the pause; only the table-facing
 * consequences (the break, the prone, the announcement) hold for the dice.
 *
 * ⚠ It lived in `concentration.js` until 2026-08-23, and `saves.js` and `mastery.js` imported it
 * from there — a presentation-timing primitive inside a feature, with two outside customers.
 * That is the D1 pattern exactly, and it was pinned as §10 D9(a). It is here because **the spine
 * owns HOW a moment is presented** (§7's generalisation of D6); concentration owns only what its
 * own moment says.
 */
export async function dramaticVerdictPause(rollMessage) {
  // ⚠ CAPPED, not merely caught. A rejection lands in the catch, but a DSN promise that
  // never RESOLVES (a cross-client animation that never played, a headless page) would hang
  // this await forever — and everything behind the pause (the cascade, the prone, the break
  // card) would silently never happen, which is exactly the live 2026-08-16 shape of
  // "concentration read broken but Bless survived". Dice are cosmetic; six seconds is more
  // drama than any roll needs.
  try {
    const dice = game.dice3d?.waitFor3DAnimationByMessageID?.(rollMessage.id);
    if ( dice ) await Promise.race([dice, new Promise(r => setTimeout(r, 6000))]);
  }
  catch(err) { /* dice are cosmetic; never let them block a verdict */ }
  const beat = (Math.max(0, Number(setting(S.dramaticBeat)) || 0)) * 1000;
  if ( beat ) await new Promise(r => setTimeout(r, beat));
}

// ⚠ dnd5e.renderChatMessage hooks append rows to a card, and their on-card ORDER is their
// registration order — which is now ACROSS files, not down this one: this bar, then the hold
// row (hold.js), then the mastery row + Topple affordance, then the receipt rows.
//
// ⚠ D6 (2026-08-23) made that ordering explicit rather than incidental. The bar used to share
// the hold's registration in this file, which is why it rendered above the hold row for free.
// It keeps that position for a structural reason now: hold.js imports THIS file, so this body
// evaluates first and this registration lands first. Both halves of that are asserted in
// check-hook-order.mjs (`ui.js` before `hold.js`). ⚠ If ui.js ever stops being imported by
// hold.js, this bar moves BELOW the hold row and nothing but that assertion will say so.
//
// The bar is a view of `damageOffer`, which this file does not own — a layering smell left
// deliberately unaddressed by D6, whose scope was the cycle. Its natural home is whichever
// machine stamps the flag; moving it is a separate stage with its own hook-order change.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  // THE TABLE'S VIEW OF AN OFFERED ROLL (walk-4 finding (w)): while a damage popup waits on
  // its roller, every client shows the same draining bar on the card. Gated on the deadline
  // still being live: a roller who vanished mid-window (the documented F5 limit) leaves a
  // drained bar until the next render quietly drops the row — never a stale "waiting" card.
  const offer = message.getFlag(MODULE_ID, "damageOffer");
  if ( (offer?.status === "pending") && (offer.deadline > Date.now()) ) {
    const row = document.createElement("div");
    row.className = "battleflow-damage-offer";
    row.style.margin = "0.4rem 0 0";
    row.innerHTML = bfCard({
      eyebrow: "Damage", tone: "pending",
      title: "Waiting on the dice",
      subtitle: `${message.getAssociatedActor()?.name ?? "The roller"} has the damage roll`
    }) + momentBarHTML(offer, "to roll");
    html.querySelector(".message-content")?.appendChild(row);
    scheduleBarSync(row);
  }
});

/**
 * A popup must not outlive the message it is a view of. Deleting the hold — which is what the
 * smoke suites do to every message they create — used to leave one open dialog per hold
 * stacked on every client that could answer, asking about attacks that no longer exist
 * (reported live 2026-08-15: "close all the popup window spam").
 */
/* ---------------------------------------------------------------------------------------------
 * THE RELAY (the spine, ARCHITECTURE.md §4.1).
 *
 * A player cannot write someone else's message. So when the answerer is not the client that
 * owns the flag, the answer travels as its OWN public message carrying an ENVELOPE, and the
 * owning client folds it in. Three machines needed that and each hand-wrote it: the hold's
 * answer (`respondsTo`), a save's choice (`saveChoiceAnswer`), a riposte's (`riposteAnswer`) —
 * three registrations, three envelope shapes, one skeleton copied three times.
 *
 * ⚠ WHAT IS SHARED AND WHAT IS NOT. Shared: find the envelope, resolve the target message,
 * check the target still carries its flag, ask whether THIS client owns the fold, and write
 * through the serializer. Not shared, and deliberately callbacks: the FOLD (a per-target
 * answer, a per-target choice, a per-reactor answer with a weapon and a status transition are
 * genuinely different bodies) and the OWNER.
 *
 * ⚠⚠ THE OWNER IS WHY THIS IS A REGISTRY AND NOT A MERGE. The hold's fold is owned by the
 * CONTINUING CLIENT; the other two by the elect. A three-into-one merge would silently move
 * the hold's fold onto the elect — the same trap as its clock, on the most-used feature at the
 * table. `owns` receives the target's live flag precisely so `isContinuingClient(flag)` can
 * answer; the elect-owned relays ignore the argument.
 *
 * ⚠ The ENVELOPE SHAPES are deliberately NOT unified. The hold's is flat sibling flags
 * (`respondsTo` + `uuid`/`answer`/`ac`), because that same message also carries an
 * `effectReceipt` for receipts.js to render — flattening it into a nested object is a WIRE
 * FORMAT change on messages players write and another client reads, and an in-flight answer
 * across a deploy would simply stop folding. `targetOf` exists so a relay can name its own
 * shape instead. Unify the mechanism; leave the bytes alone.
 * ------------------------------------------------------------------------------------------- */

/** envelope flag key → { flagKey, targetOf, owns, fold } */
const relays = new Map();

/**
 * Declare a relay. `targetOf(envelope)` returns the message id the answer is FOR; `owns(flag)`
 * decides whether this client does the folding; `fold(current, envelope, message)` mutates the
 * flag inside the serializer and may return `false` to skip the write entirely.
 */
export function registerRelay(envelopeKey, { flagKey, targetOf, owns, fold }) {
  relays.set(envelopeKey, { flagKey, targetOf, owns, fold });
}

// ONE registration for every relay (was three). ⚠ Every guard is repeated INSIDE the
// serializer by the folds themselves — the D3 rule: the state a fold tests must be the state
// it writes, because two answers can land in the same tick.
Hooks.on("createChatMessage", message => {
  for ( const [envelopeKey, relay] of relays ) {
    const envelope = message.getFlag(MODULE_ID, envelopeKey);
    if ( !envelope ) continue;
    const target = game.messages.get(relay.targetOf(envelope));
    const flag = target?.getFlag(MODULE_ID, relay.flagKey);
    if ( !flag || !relay.owns(flag) ) continue;
    void queueFlagWrite(target, relay.flagKey, current => relay.fold(current, envelope, message));
  }
});

// THE ONE DELETE-SWEEP (the spine): a deleted message takes its popups, every machine's
// shown-latches and any local acknowledgements with it — the uniform `${messageId}|` key
// prefix is what makes one sweep cover them all (five per-machine cleanup loops collapsed
// here, two of which had already drifted apart on key shape).
Hooks.on("deleteChatMessage", message => {
  for ( const [key, dialog] of [...livePopups] ) {
    if ( !key.startsWith(`${message.id}|`) ) continue;
    livePopups.delete(key);
    void dialog.close();
  }
  const prefix = `${message.id}|`;
  for ( const key of [...shownMoments] ) if ( key.startsWith(prefix) ) shownMoments.delete(key);
  for ( const key of [...localAcks] ) if ( key.startsWith(prefix) ) localAcks.delete(key);
  // ⚠ The hold's buzzer used to be disarmed HERE. D6 moved the clock into hold.js, which now
  // registers its own one-line sweep — the same shape every other timer-owning machine already
  // uses (concentration, maneuvers, mastery, saves, volleys). This sweep stays generic: it
  // clears popups, latches and acks for EVERY machine off one `${messageId}|` prefix, which is
  // the collapse it exists for. Do not re-add a feature's name to it.
});

// ⚠ `closeAnsweredPopups` USED TO LIVE HERE, and it was the last place the spine knew a
// FEATURE existed (D2, 2026-08-23). Its doc line read like a spine primitive — "a decision made
// anywhere closes the popup asking for it" — but its body read `message.getFlag(MODULE_ID,
// "hold")` and walked the hold's own per-target array. It had exactly one caller. Because it
// reached the feature by STRING rather than by import, it survived D6's cycle break untouched
// and made no edge for check-imports to see: the layering smell D6 recorded and deferred.
//
// It is hold.js's own `closeAnsweredHoldPopups` now, built on `livePopups` — the same shape
// every other machine already used for presentation law 4 (mastery, maneuvers, saves and
// concentration each close their own popups this way). ⚠ Do not re-add a feature's flag name to
// this file. The spine holds the PRIMITIVES; knowing what "answered" means is the machine's.

