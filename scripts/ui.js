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
  eldersDeepestFirst, rescuePaneHTML, rescueRowsHTML } from "./decide/present.js";

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

/* ---------------------------------------------------------------------------------------------
 * THE RESCUE REGISTRY (the spine) — §4.1's shape, applied to a VIEW instead of a write.
 *
 * ⚠ THE PROBLEM. A Battle Master holding a Bardic die who cleanly misses is stamped TWICE on
 * ONE attack — `precision` by maneuvers.js, `d20fold` by d20-folds.js — and used to get two
 * popups, two clocks and no cross-talk for what is one question: *this roll is short by N; what
 * do you burn?* The arithmetic side was solved by D8 (compose, never order). This is the OFFER
 * side, and the shape is **merge the VIEW, keep the flags** — R2 verbatim: the popup is a view,
 * the flag is the state. No state merge, no wire-format change, no migration.
 *
 * ⚠ WHY A REGISTRY AND NOT A MERGE, which is the same argument `registerRelay` makes one
 * section up: the spine must never name a feature. Machines hand it a key and four callbacks;
 * it draws one window and routes each press back to whoever supplied that row. The list of
 * rescues is data, so the next one — Pact Talisman, Indomitable, Fanatical Focus, and the rest
 * of the own-roll retro-fixer family — is a registration and a row, not a popup in the pile.
 *
 * ⚠ COMPOSITION HAPPENS MACHINE-SIDE, and that is deliberate rather than incidental. `view` is
 * a callback because composing the roll needs `foldsFrom` over the real message and the reveal
 * SETTING — and this file reads no world setting and imports no machine. Each machine composes
 * its own slice through decide/, and the spine only concatenates.
 * ------------------------------------------------------------------------------------------- */

/** flag key → { isPending, subject, view, answer } */
const rescues = new Map();

/**
 * Declare a rescue source. `isPending(message)` says whether it is still asking;
 * `subject(message)` names the actor whose decision it is (the `canAnswerFor` gate);
 * `view(message)` returns that flag's slice of the row model, already composed;
 * `answer(message, action)` takes the token the row carried — the machine's own vocabulary,
 * handed straight back to it.
 */
export function registerRescue(flagKey, { isPending, subject, view, answer }) {
  rescues.set(flagKey, { isPending, subject, view, answer });
}

/**
 * Every registered source's slice, as one window's model.
 *
 * ⚠ HEADERS DEDUPE BY STRING. Both sources describe the same roll and derive their header
 * through the same pure function (`rescueHeaderLines`), so they arrive identical — printing
 * both would be the window telling the table one fact in stereo. Comparing STRINGS rather than
 * numbers is what keeps this file from knowing what a margin is.
 */
function mergedRescueView(message) {
  const headerLines = [];
  const rows = [];
  const quotes = [];
  let earliestDeadline = null;
  let clockWindow = null;
  let pending = false;
  let subject = null;
  let stillFailing = false;
  let verdictKnown = false;
  for ( const rescue of rescues.values() ) {
    const slice = rescue.view(message);
    if ( !slice ) continue;
    if ( slice.stillFailing ) stillFailing = true;
    if ( slice.verdictKnown ) verdictKnown = true;
    if ( rescue.isPending(message) ) {
      pending = true;
      subject = subject ?? rescue.subject(message);
    }
    for ( const line of slice.headerLines ?? [] ) {
      if ( !headerLines.includes(line) ) headerLines.push(line);
    }
    rows.push(...(slice.rows ?? []));
    quotes.push(...(slice.quotes ?? []));
    // ⚠ The EARLIEST clock wins, and its own window travels with it — a bar is a pure function
    // of both, so pairing one source's deadline with another's window draws a drain that lies.
    if ( Number.isFinite(slice.earliestDeadline)
      && ((earliestDeadline === null) || (slice.earliestDeadline < earliestDeadline)) ) {
      earliestDeadline = slice.earliestDeadline;
      clockWindow = slice.clockWindow ?? null;
    }
  }
  // ⚠ SAY THAT IT DID NOT GET THERE. A spend that leaves the roll short used to re-render in
  // silence — one button greyed, the rest still lit — and the player had to work out from the
  // arithmetic why the window was still asking (user, 2026-08-24). The window names what was
  // burned and that it was not enough. ⚠ THE SPENT SET IS A FACT ABOUT THE WHOLE WINDOW, not
  // about any one flag, which is why it is composed HERE: a machine's own slice can only see
  // its own spends, and two slices each announcing half of it would print the same news twice.
  // ⚠ ONLY WHERE THERE IS A NUMBER TO FALL SHORT OF. On a raw ability check the module owns
  // no DC, so "not enough yet" would be a verdict it invented — the header points at the DM
  // there instead, and this line stays out of its way.
  const spent = rows.filter(r => r.spent).map(r => r.label);
  if ( spent.length && stillFailing && verdictKnown ) {
    headerLines.push(`<strong>${spent.join(" + ")}</strong> — not enough yet.`);
  }
  return { headerLines, rows, quotes, earliestDeadline, clockWindow, pending, subject,
    verdictKnown };
}

/** Route one row press back to the machine that supplied it. */
async function answerRescue(message, flagKey, action) {
  const rescue = rescues.get(flagKey);
  if ( !rescue ) return;
  try { await rescue.answer(message, action); }
  catch(err) { console.error(`${TITLE} | The rescue "${flagKey}" could not be answered.`, err); }
}

/**
 * ⚠ ONE PASS ANSWERS EVERY PENDING SOURCE. There is one decision on screen, so there is one
 * Pass — and a Pass that only closed the window would leave the OTHER flag pending, its clock
 * running, and its offer re-opening on the next render. Two flag writes, both idempotent,
 * both through the machines' own first-writer-wins answer paths.
 */
async function passEveryRescue(message) {
  for ( const [flagKey, rescue] of rescues ) {
    if ( !rescue.isPending(message) ) continue;
    await answerRescue(message, flagKey, "pass");
  }
}

/**
 * The DOM half of the window (the bar's split, one floor up): the pane swap and the row
 * presses. The markup is decide/present.js and stays pure; what is here is the listeners.
 *
 * ⚠ THE PANE SWAPS TEXT, IT DOES NOT RE-RENDER. Every quote ships in the markup as a hidden
 * `data-` payload, so hovering a row is a text assignment rather than a dialog rebuild — which
 * matters because a rebuild would fight the staircase for position on every mouse move.
 */
function wireRescueWindow(root, message) {
  if ( !root?.querySelectorAll ) return;
  // ⚠ THE SWAP IS A VISIBILITY FLIP, NOT A TEXT ASSIGNMENT. Every quote is already in the DOM,
  // stacked in one grid cell so the pane is sized once by the longest of them — writing text
  // into a single element is what made the window grow and shrink under the pointer.
  const quotes = [...root.querySelectorAll("[data-bf-rescue-quote]")];
  for ( const row of root.querySelectorAll("[data-bf-rescue-row]") ) {
    const key = row.dataset.bfRescueRow;
    const swap = () => {
      if ( !quotes.some(q => q.dataset.bfRescueQuote === key) ) return;   // no rule for this row
      for ( const q of quotes ) {
        q.style.visibility = (q.dataset.bfRescueQuote === key) ? "visible" : "hidden";
      }
    };
    row.addEventListener("mouseenter", swap);
    row.addEventListener("focus", swap);
    // ⚠ A GREYED ROW CARRIES NO ACTION and therefore gets no listener — a spent or withdrawn
    // row is a RECORD, not a control. Law 11's inverse: a control that does nothing is worse
    // than no control, so there is no control.
    const action = row.dataset.bfRescueAction;
    const flagKey = row.dataset.bfRescueFlag;
    if ( !action || !flagKey ) continue;
    row.addEventListener("click", () => void answerRescue(message, flagKey, action));
    row.addEventListener("keydown", ev => {
      if ( (ev.key !== "Enter") && (ev.key !== " ") ) return;
      ev.preventDefault();
      void answerRescue(message, flagKey, action);
    });
  }
}

/**
 * WHAT THE WINDOW LAST SAID — popup key → the exact content string drawn.
 *
 * ⚠ THIS IS WHAT KEEPS THE WINDOW STILL. Redrawing means CLOSE AND REOPEN (the shipped
 * latch-delete idiom), and `syncRescuePopup` is called from the machines' render handlers —
 * which fire on every chat re-render, for reasons that have nothing to do with this message.
 * Without a signature the table would watch the window blink shut and back open whenever
 * anything else happened in the log. Comparing the rendered STRING is exact and needs no
 * opinion about which fields matter.
 */
const rescueContent = new Map();

/** Draw, redraw or close the one rescue window this message owns. */
async function drawRescueWindow(message, { recall = false } = {}) {
  const key = popupKey(message.id, "rescue");
  const view = mergedRescueView(message);
  const open = livePopups.get(key);

  // Nothing left asking: the window goes, and its signature with it.
  if ( !view.pending || !view.rows.length ) {
    rescueContent.delete(key);
    if ( open ) {
      livePopups.delete(key);
      shownMoments.delete(key);
      try { await open.close(); } catch(err) { /* a closed dialog is the state we wanted */ }
    }
    return;
  }

  const content = bfCard({
    img: view.subject?.img ?? null,
    eyebrow: "Rescue the roll", tone: "pending",
    // ⚠ THE TITLE ASSERTS A VERDICT, so it only does so where the module has one. A check
    // window used to open with "This roll is short" over a roll nothing could call short.
    title: view.verdictKnown ? "This roll is short — what do you burn?" : "What do you burn?",
    subtitle: view.subject?.name ?? "",
    lines: view.headerLines
  })
    + rescuePaneHTML(view.quotes)
    + rescueRowsHTML(view.rows)
    + momentBarHTML({ deadline: view.earliestDeadline, window: view.clockWindow }, "to answer");

  if ( open && (rescueContent.get(key) === content) ) return;   // unchanged — leave it alone
  // ⚠ A PLAIN RE-RENDER MUST NOT REOPEN A WINDOW THE PLAYER CLOSED, but a CHANGE must. That is
  // the shipped fold behaviour, kept: the machine cleared its latch on a re-offer precisely so
  // a second offer could not arrive as a card row nobody was looking at. Here the content
  // signature answers the same question more exactly — closed plus unchanged is a no-op,
  // closed plus changed reopens, and the card's own Answer button recalls past the latch.
  if ( !open && !recall && shownMoments.has(key) && (rescueContent.get(key) === content) ) return;

  if ( open ) {
    livePopups.delete(key);
    shownMoments.delete(key);
    try { await open.close(); } catch(err) { /* a closed dialog is the state we wanted */ }
  }
  rescueContent.set(key, content);
  shownMoments.add(key);
  const dialog = await openMomentPopup(message, "rescue", view.subject, {
    title: `Rescue the roll — ${view.subject?.name ?? ""}`,
    icon: "fa-solid fa-life-ring",
    content,
    buttons: [
      { action: "pass", label: "Pass", default: true, callback: () => passEveryRescue(message) }
    ]
  });
  if ( dialog?.element ) wireRescueWindow(dialog.element, message);
}

/**
 * ⚠ DRAWS ARE SERIALISED PER MESSAGE, and this is not tidiness — it is the bug the table found
 * twice on 2026-08-24 ("the window should have closed", "passed time didn't close either").
 *
 * A redraw is CLOSE-THEN-REOPEN, and both halves await. Between them the dialog handle is
 * deliberately out of `livePopups` so the reopen does not collide with its own predecessor —
 * which means a SECOND draw landing in that gap reads `livePopups.get(key)` as undefined,
 * decides there is nothing to close, and returns having done nothing. The first draw then
 * finishes by opening a fresh window that nobody is left to close. Every symptom followed:
 * both offers expired and the window stayed; a bardic die made the attack hit, the survivor
 * withdrew itself correctly, and the window stayed.
 *
 * ⚠ THE SHAPE IS `queueFlagWrite`'s, deliberately — the same problem (interleaved writers over
 * one key) already had an answer in this tree, and `.then(run, run)` on purpose so one failed
 * draw cannot strand every draw queued behind it.
 */
const rescueDrawChain = new Map();
function queueRescueDraw(message, opts) {
  const run = () => drawRescueWindow(message, opts);
  const prior = rescueDrawChain.get(message.id) ?? Promise.resolve();
  const next = prior.then(run, run);
  // ⚠ AND THE REJECTION IS LOGGED RATHER THAN SWALLOWED. `void somePromise()` is how a broken
  // draw becomes "the window just does nothing", with no line anywhere to find it by.
  const tail = next.catch(err =>
    console.error(`${TITLE} | The rescue window could not be drawn.`, err));
  rescueDrawChain.set(message.id, tail);
  void tail.then(() => {
    if ( rescueDrawChain.get(message.id) === tail ) rescueDrawChain.delete(message.id);
  });
}

/**
 * ⚠ THE SPAWN COALESCE, and it is the difference between one window and two. Both stamps land
 * milliseconds apart — maneuvers.js registers `dnd5e.rollAttackV2` before d20-folds.js, which
 * `check-hook-order` pins — so the first machine to finish would draw a window carrying only
 * its own row, and the second would close and reopen it a tick later. The table would see a
 * popup flicker for no reason. Deferring the draw to the next tick lets both stamps land
 * first, and the window renders complete the only time it renders.
 *
 * ⚠ The tick is the COALESCE; the chain above is the ORDERING. They answer different halves of
 * the same problem and neither replaces the other: without the tick two stamps draw twice,
 * without the chain two draws race over one dialog handle.
 */
const rescueDraws = new Map();
export function syncRescuePopup(message, { recall = false } = {}) {
  if ( !(message instanceof ChatMessage) ) return;
  // A recall in the same tick wins: the card's Answer button must never lose to a render that
  // happened to arrive first, because "the button does nothing" is a report this tree has had.
  if ( rescueDraws.has(message.id) ) {
    if ( recall ) rescueDraws.set(message.id, true);
    return;
  }
  rescueDraws.set(message.id, recall);
  setTimeout(() => {
    const asked = rescueDraws.get(message.id) === true;
    rescueDraws.delete(message.id);
    queueRescueDraw(message, { recall: asked });
  }, 0);
}

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
  // The rescue window's content signature rides the same key shape, so it sweeps here too —
  // a stale one would make the window refuse to redraw for a message id Foundry later reuses.
  for ( const key of [...rescueContent.keys()] ) {
    if ( key.startsWith(prefix) ) rescueContent.delete(key);
  }
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

