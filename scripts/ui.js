/**
 * Battle Flow — The table-moment surfaces: the managed-popup lifecycle, the house card (bfCard), the countdown bar, and the hold's own row/popup views and timers.
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting } from "./core.js";
import { reactionItem, isContinuingClient, canAnswerFor, answerHold, continueHold } from "./hold.js";

/* ---------------------------------------------------------------------------------------------
 * The hold's views: a durable row on the attack card, plus a popup for whoever can answer.
 * Both are pure views of the flag — dismissing the popup is not an answer.
 * ------------------------------------------------------------------------------------------- */

/** Popups already shown by this client, so a re-render never stacks a second one. */
const shownPopups = new Set();

/**
 * Popups currently on screen, keyed message+target. The popup is the ANSWER SURFACE and the
 * card is the public record of the same moment — one decides, one watches. Two live controls
 * for one decision is exactly how they got out of step (reported live 2026-08-15: answering on
 * the card left the popup sitting open, still asking).
 */
export const livePopups = new Map();
export const popupKey = (messageId, uuid) => `${messageId}|${uuid}`;

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
    try { ui.chat?.updateMessage?.(message); } catch(err) { /* row refreshes next render */ }
    return close(...args);
  };
  livePopups.set(key, dialog);
  try {
    await dialog.render({ force: true });
    scheduleBarSync(dialog.element);
    // The row was drawn before this popup existed; redraw so it defers to the popup
    // instead of offering a second set of controls.
    ui.chat?.updateMessage?.(message);
  } catch(err) {
    livePopups.delete(key);
    console.error(`${TITLE} | Could not open the popup — answer from the card.`, err);
  }
}

/* ---------------------------------------------------------------------------------------------
 * The house card. Everything this module says out loud wears it.
 *
 * The module's messages used to be bare italic text — "lets it land — no reaction." — sitting
 * in a log where every native card around them had a portrait, a title and a structure. They
 * read as debug output rather than as part of the game (reported live 2026-08-15, twice).
 *
 * ⚠ Inline styles on purpose. module.json carries no `styles` entry, and adding one needs a
 * Foundry PROCESS restart to take effect, while a script change is live on the next F5 — so a
 * stylesheet would make every future tweak cost a bounce. If this ever grows past a few
 * helpers, add the stylesheet and take the one bounce.
 * ------------------------------------------------------------------------------------------- */

const TONE = {
  pending: "rgba(214,158,46,0.95)",   // waiting on a human
  good:    "rgba(70,150,95,0.95)",    // the reaction did its job
  bad:     "rgba(180,70,60,0.95)",    // it landed anyway
  neutral: "rgba(120,120,120,0.75)"
};

/**
 * One card: an accent spine, a portrait, an eyebrow/title/subtitle stack, and body lines.
 * `lines` are already-safe HTML fragments.
 */
export function bfCard({ img, eyebrow, title, subtitle, lines = [], tone = "neutral" }) {
  const accent = TONE[tone] ?? TONE.neutral;
  const portrait = img
    ? `<img src="${img}" alt="" style="width:40px;height:40px;flex:0 0 auto;border-radius:4px;
         border:1px solid var(--color-border-dark,#0006);object-fit:cover;">`
    : "";
  const body = lines.filter(Boolean).map(line =>
    `<div style="margin-top:0.2rem;">${line}</div>`).join("");
  return `
  <div style="border-left:3px solid ${accent};border-radius:3px;padding:0.4rem 0.55rem;
              background:rgba(0,0,0,0.04);">
    <div style="display:flex;gap:0.5rem;align-items:center;">
      ${portrait}
      <div style="flex:1;min-width:0;">
        ${eyebrow ? `<div style="font-size:var(--font-size-10,10px);letter-spacing:0.08em;
             text-transform:uppercase;opacity:0.6;line-height:1.4;">${eyebrow}</div>` : ""}
        <div style="font-family:var(--font-h1,inherit);font-size:var(--font-size-15,15px);
             font-weight:bold;line-height:1.2;">${title}</div>
        ${subtitle ? `<div style="font-size:var(--font-size-11,11px);opacity:0.7;
             line-height:1.3;">${subtitle}</div>` : ""}
      </div>
    </div>
    ${body ? `<div style="margin-top:0.35rem;font-size:var(--font-size-12,12px);
         line-height:1.5;">${body}</div>` : ""}
  </div>`;
}

/** The reaction's own artwork, for cards that talk about it. */
export function reactionImg(actor, reactionName, ids) {
  return reactionItem(actor, reactionName, ids)?.img ?? null;
}

/* ---------------------------------------------------------------------------------------------
 * The countdown bar (design.md §4.3).
 *
 * ⚠ ZERO JS TICKING. The bar is one CSS animation whose duration is the hold's own window, and
 * a reload resumes it mid-drain with a NEGATIVE animation-delay computed from the deadline
 * stored on the flag — so every client, and every re-render, agrees without anyone counting.
 * A per-second interval per open hold per client is exactly the kind of thing that is fine
 * with one hold on screen and miserable with six.
 * ------------------------------------------------------------------------------------------- */

/**
 * The draining bar for a hold, or "" when there is no timer. `deadline` and `window` both live
 * on the flag, so this is a pure function of state — no client keeps its own clock. The label
 * names the default action the buzzer takes — "answer" for the decisions, "roll" for the
 * concentration ask, whose expiry rolls instead of passing.
 */
export function holdBarHTML(hold, label = "to answer") {
  if ( !hold?.deadline || !hold?.window || (hold.status !== "pending") ) return "";
  const remaining = (hold.deadline - Date.now()) / 1000;
  if ( remaining <= 0 ) return "";
  // Negative delay = start the animation already part-way through, which is what makes a
  // reload pick the bar up exactly where it should be rather than restarting it.
  const elapsed = hold.window - remaining;
  return `
  <div style="margin-top:0.45rem;display:flex;align-items:center;gap:0.4rem;">
    <div style="flex:1;height:6px;border-radius:3px;background:rgba(0,0,0,0.18);overflow:hidden;">
      <div data-bf-deadline="${hold.deadline}" data-bf-window="${hold.window}"
           style="height:100%;width:100%;border-radius:3px;
                  background:${TONE.good};"></div>
    </div>
    <span style="font-size:var(--font-size-10,10px);opacity:0.6;white-space:nowrap;">
      ${hold.window}s ${label}</span>
  </div>`;
}

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

/**
 * The buzzer. Armed by whichever client owns the continuation — one authoritative clock, not a
 * cross-client timeout — and re-checked at the buzzer, because an answer landing in the last
 * instant must beat the timer rather than race it.
 */
const armedTimers = new Map();

export function armHoldTimer(message) {
  const hold = message?.getFlag(MODULE_ID, "hold");
  if ( !hold?.deadline || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  if ( armedTimers.has(message.id) ) return;
  const delay = Math.max(0, hold.deadline - Date.now());
  armedTimers.set(message.id, setTimeout(() => {
    armedTimers.delete(message.id);
    void fireHoldTimer(message.id);
  }, delay));
}

export function disarmHoldTimer(messageId) {
  const handle = armedTimers.get(messageId);
  if ( handle === undefined ) return;
  clearTimeout(handle);
  armedTimers.delete(messageId);
}

/** At the buzzer, every unanswered target passes — the default outcome of an unmade decision. */
async function fireHoldTimer(messageId) {
  const message = game.messages.get(messageId);
  const hold = message?.getFlag(MODULE_ID, "hold");
  if ( !hold || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  const merged = foundry.utils.deepClone(hold);
  let expired = false;
  for ( const target of merged.targets ) {
    if ( target.answer ) continue;      // answered in the last instant — it wins, not the clock
    target.answer = "pass";
    target.timedOut = true;
    expired = true;
  }
  if ( !expired ) return;
  await message.setFlag(MODULE_ID, "hold", merged);
}

/**
 * The AC a listed reaction actually grants, read from the reaction's OWN effect instead of
 * hardcoding Shield's +5 — the interrupt list is user-editable, so anything that assumes
 * Shield is wrong for the other twelve entries. Returns null for a non-numeric bonus (a
 * proficiency-scaled one like Defensive Duelist), which simply omits the "would it flip" line.
 */
export function reactionACBonus(reactionName, actor, ids) {
  const item = reactionItem(actor, reactionName, ids);
  for ( const effect of item?.effects ?? [] ) {
    for ( const change of effect.changes ?? [] ) {
      if ( change.key !== "system.attributes.ac.bonus" ) continue;
      const value = Number(change.value);
      if ( Number.isFinite(value) ) return value;
    }
  }
  return null;
}

/**
 * The math a hold is allowed to show, or null when the reveal is off (the RAW default: you know
 * you were hit, not by how much).
 *
 * ⚠ ONE gate for BOTH surfaces. The popup used to reveal the numbers while the card row said
 * only "Shield?", so the same hold told two different stories depending on where you read it.
 * Any new surface reads this too — do not re-derive the numbers locally.
 */
function revealDetail(target, roll, actor) {
  if ( !setting(S.holdReveal) ) return null;
  const liveAC = actor?.system?.attributes?.ac?.value ?? target.ac;
  const total = roll?.total ?? null;
  const bonus = (target.kind === "ac") ? reactionACBonus(target.reaction, actor, target) : null;
  return {
    total, liveAC, bonus,
    wouldAC: bonus == null ? null : liveAC + bonus,
    wouldMiss: bonus == null ? null : (total < (liveAC + bonus))
  };
}

/** The reveal as one compact line, for the card row. */
function revealLine(reveal, target) {
  let text = `<strong>${reveal.total}</strong> vs AC <strong>${reveal.liveAC}</strong>`;
  if ( reveal.bonus != null ) text += ` · ${target.reaction} → AC ${reveal.wouldAC}, `
    + `<em>${reveal.wouldMiss ? "enough to miss" : "still hits"}</em>`;
  return text;
}

// ⚠ THREE dnd5e.renderChatMessage hooks append rows to a card, and their on-card ORDER is
// their registration order, which is their order in this file: the hold row (here), then
// the mastery row + Topple affordance, then the receipt rows. Moving a section moves every
// card's layout — if the file ever splits by phase, this ordering must be made explicit.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold?.targets?.length ) return;

  const row = document.createElement("div");
  row.className = "battleflow-hold";
  row.style.margin = "0.4rem 0 0";

  for ( const target of hold.targets ) {
    const block = document.createElement("div");
    block.style.marginTop = "0.25rem";
    row.append(block);

    // The card is the PUBLIC record of this moment — everyone watching the log sees the same
    // thing, whether or not they are the one being asked.
    void fromUuid(target.uuid).then(actor => {
      const roll = message.rolls[0];
      // A spell hold has no d20 anywhere on its message, so there is no math to reveal — asking
      // revealDetail anyway prints "null vs AC 15" and invents a verdict about an attack that
      // was never rolled. The reveal SETTING is untouched by this: a negate hold discloses
      // nothing a target could metagame on, because the answer never depends on a number.
      const spell = hold.trigger === "spell";
      const reveal = spell ? null : revealDetail(target, roll, actor);
      const lines = [];
      let tone = "neutral";
      let eyebrow = "Reaction";
      let subtitle = target.name;

      if ( hold.status === "pending" ) {
        tone = "pending";
        eyebrow = "Reaction — held";
        const owner = game.users.find(u => !u.isGM && actor?.testUserPermission(u, "OWNER"));
        subtitle = `${target.name} · waiting on ${owner?.name ?? "the GM"}`;
        if ( reveal ) lines.push(revealLine(reveal, target));
        else if ( spell ) lines.push(`<strong>${hold.spell}</strong> · `
          + `${target.reaction} stops it completely`);
      } else {
        const cast = target.answer === "cast";
        const negated = target.verdict === "negated";
        tone = (target.verdict === "miss") || negated ? "good" : cast ? "bad" : "neutral";
        // "skip" is retired (v1.1.15) but still labelled, because holds answered that way are
        // already sitting in the chat log and a re-render must not relabel history.
        eyebrow = negated ? "Reaction — it worked"
          : cast ? "Reaction — cast"
          : target.answer === "skip" ? "Reaction — skipped"
          : target.timedOut ? "Reaction — timed out" : "Reaction — passed";
        // Resolved cards carry the numbers the verdict was reached with, so a surprising
        // outcome can be read straight off the card instead of reconstructed. A spell hold has
        // no acAtVerdict, so this skips itself.
        if ( cast && (target.acAtVerdict != null) ) {
          const moved = target.acAtVerdict !== target.ac;
          lines.push(`AC <strong>${target.ac}</strong>${moved ? ` → <strong>${target.acAtVerdict}</strong>` : ""}`
            + ` vs the attack's <strong>${roll?.total}</strong>`);
        }
        if ( negated ) lines.push(`<strong>${hold.spell}</strong> does nothing to them.`);
        else if ( target.verdict ) lines.push(target.verdict === "miss"
          ? `<strong>The attack misses.</strong>`
          : spell ? `The <strong>${hold.spell}</strong> lands in full.`
          : `The attack still hits.`);
        else if ( target.answer === "pass" ) lines.push(target.timedOut
          ? "The reaction window closed — no answer, so the attack lands."
          : "Let it land — no reaction.");
      }

      block.innerHTML = bfCard({
        img: reactionImg(actor, target.reaction, target),
        eyebrow, title: target.reaction, subtitle, lines, tone
      }) + holdBarHTML(hold);
      scheduleBarSync(block);

      if ( hold.status !== "pending" ) return;
      // A reload lands here with the hold still open — re-arm the buzzer from the flag's
      // deadline rather than restarting the window.
      armHoldTimer(message);
      // This target's decision is made; controls belong only to the still-undecided.
      if ( target.answer || !canAnswerFor(actor) ) return;

      // ⚠ ONE input surface. When this client gets popups, the popup decides and the card only
      // watches — it offers a way to call the popup BACK (a dismissed popup must never strand
      // the decision) but never a second set of answer controls. With popups off the card is
      // the only surface there is, so it carries the real buttons.
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        display: "flex", gap: "0.3rem", marginTop: "0.4rem", justifyContent: "flex-end"
      });
      if ( setting(S.holdView) ) {
        controls.append(holdButton("Answer", () => {
          shownPopups.delete(message.id);
          void showHoldPopup(message, message.getFlag(MODULE_ID, "hold"));
        }));
      } else {
        // ⚠ TWO buttons, because the decision has two answers. A GM-only "Skip" used to sit
        // here as the AFK override from design.md §5, but it called the same code as Pass and
        // every consumer downstream tests only `answer === "cast"` — so it was a third control
        // for a binary choice, and it appeared only where the GM already IS the decider (an
        // unowned monster). On a player's character canAnswerFor denies the GM outright, so it
        // was missing from the one case it was written for. The hold timer took that job
        // properly at v1.1.8: unanswered targets auto-pass and are marked timedOut.
        controls.append(
          holdButton("Cast", () => castReaction(target)),
          holdButton("Pass", () => answerHold(message, target.uuid, "pass"))
        );
      }
      block.append(controls);
    });
  }
  html.querySelector(".message-content")?.appendChild(row);

  // Resume a hold that is READY but has nobody driving it: every answer landed, then the
  // continuing client reloaded before writing the verdict (the settle window makes that gap
  // up to holdSettle seconds wide). The buzzer only passes UNANSWERED targets, so without
  // this a fully-answered hold sat pending forever. Views are stateless and re-derive from
  // the flag, so the view is exactly where readiness gets re-checked; the in-flight claim
  // makes the drive idempotent across re-renders.
  if ( (hold.status === "pending") && hold.targets.every(t => t.answer)
    && isContinuingClient(hold) ) void continueHold(message);

  // The popup: attention for the person whose decision it is. Ephemeral by design — closing
  // it is not an answer, because the row above is the durable state.
  if ( (hold.status === "pending") && setting(S.holdView) && !shownPopups.has(message.id) ) {
    shownPopups.add(message.id);
    void showHoldPopup(message, hold);
  }
});

/**
 * The Cast button REALLY casts — it uses the reaction activity natively, exactly as clicking
 * the spell on the sheet would: the slot is spent, the card is posted, and the usage hook
 * fires, which is what answers the hold and applies the effect.
 *
 * ⚠ It must never merely record "cast" as an answer. Doing that (the shape this shipped in
 * first) produced a hold that resolved against an unchanged AC — Shield "cast" with no slot
 * spent, no effect, and a cheerful "raises AC to 12" over a hit that should have missed
 * (caught by Tom in live play, 2026-08-15). design.md §5 is explicit: the cast IS the answer,
 * and the button is convenience, not protocol. A cancelled cast answers nothing, correctly
 * leaving the hold open.
 */
async function castReaction(target) {
  const actor = await fromUuid(target.uuid);
  // Prefer the activity the hold recorded. A statblock casts Shield from its Spellcasting
  // feature's `cast` activity — the spell item of the same name is a linked target that
  // reports spellSlot:true with no slots, so casting THAT is refused for want of a resource.
  let activity = target.activityId
    ? actor?.items.get(target.itemId)?.system.activities?.get(target.activityId)
    : null;
  if ( !activity ) {
    // No recorded activity (an older hold, or a spell-item reaction): resolve the reaction's
    // real item rather than the first thing sharing its name — a worn shield has no activities
    // at all, so a bare name match here produces "could not find Shield to cast".
    const item = reactionItem(actor, target.reaction);
    activity = item?.system.activities?.contents?.find(a => a.activation?.type === "reaction")
      ?? item?.system.activities?.contents?.[0];
  }
  if ( !activity ) {
    ui.notifications.warn(`${TITLE}: could not find ${target.reaction} on ${target.name} to cast.`);
    return;
  }
  // No usage dialog: the reaction window is already a table pause, and stacking a slot
  // picker inside it spends the moment this feature exists to protect. The system picks the
  // lowest available slot, which is what a Shield cast wants. A player who needs to upcast
  // casts from their sheet instead — that is detected identically (design.md §5).
  await activity.use({}, { configure: false }, {});
}

function holdButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, {
    flex: "0 0 auto", width: "auto", margin: "0", padding: "0 0.4rem",
    fontSize: "inherit", lineHeight: "1.4"
  });
  button.addEventListener("click", () => onClick());
  return button;
}

/**
 * The reaction rendered as its own card: portrait, name, who is reacting, the ability's real
 * text, and — only if the reveal is on — the math. This is the moment the whole feature exists
 * to protect, so it should read like the ability rather than like a confirm box.
 */
async function holdPopupContent(target, roll, actor, hold) {
  // ⚠ The reaction's real item. Matched by bare name this showed a worn shield's artwork above
  // a worn shield's description in the popup that is supposed to be the moment of the spell.
  const item = reactionItem(actor, target.reaction, target);
  const img = item?.img ?? "icons/svg/shield.svg";
  const subtitle = [target.name, item?.system?.activation?.type === "reaction" ? "Reaction" : null]
    .filter(Boolean).join(" · ");

  // Enrich so the ability reads as it does on the sheet (inline rolls, references, links).
  const editor = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  let description = "";
  try {
    description = await editor.enrichHTML(item?.system?.description?.value ?? "",
      { rollData: actor?.getRollData?.() ?? {}, secrets: false });
  } catch(err) {
    description = item?.system?.description?.value ?? "";
  }

  // No d20 on a spell hold, so no math to show and nothing conditional to weigh: the question
  // is simply whether to spend the reaction, and the outcome of taking it is total.
  const spell = hold?.trigger === "spell";
  const reveal = spell ? null : revealDetail(target, roll, actor);
  const situation = spell
    ? `<div style="font-size:var(--font-size-14,14px);"><strong>${hold.spell}</strong> is about `
      + `to strike <strong>${target.name}</strong>.</div>`
      + `<div style="opacity:0.85;margin-top:0.15rem;">${target.reaction} stops it completely — `
      + `<em>no damage at all</em>.</div>`
    : reveal
    ? `<div style="font-size:var(--font-size-14,14px);"><strong>${reveal.total}</strong> vs AC `
      + `<strong>${reveal.liveAC}</strong> — a hit.</div>`
      + (reveal.bonus == null ? "" : `<div style="opacity:0.85;margin-top:0.15rem;">`
        + `${target.reaction} would make it AC <strong>${reveal.wouldAC}</strong> — `
        + `<em>${reveal.wouldMiss ? "enough to miss" : "still not enough"}</em>.</div>`)
    : `<div style="font-size:var(--font-size-14,14px);">Something hits `
      + `<strong>${target.name}</strong>.</div>`;

  return `
  <div style="display:flex;gap:0.6rem;align-items:center;padding-bottom:0.5rem;
              border-bottom:1px solid var(--color-border-light-2,#999a);">
    <img src="${img}" alt="" style="width:48px;height:48px;flex:0 0 auto;border-radius:4px;
         border:1px solid var(--color-border-dark,#0006);object-fit:cover;">
    <div style="flex:1;min-width:0;">
      <div style="font-family:var(--font-h1,inherit);font-size:var(--font-size-18,18px);
                  font-weight:bold;line-height:1.2;">${target.reaction}</div>
      <div style="opacity:0.7;font-size:var(--font-size-12,12px);">${subtitle}</div>
    </div>
  </div>
  ${holdBarHTML(hold)}
  <div style="padding:0.6rem 0.1rem;">${situation}</div>
  ${description ? `<div style="max-height:11rem;overflow-y:auto;padding:0.5rem 0.6rem;
       border-radius:4px;background:rgba(0,0,0,0.05);font-size:var(--font-size-13,13px);
       line-height:1.5;">${description}</div>` : ""}`;
}

/**
 * Show the hold popup and keep it honest about its own lifetime.
 *
 * ⚠ A popup is a VIEW, and a view must not outlive its state. This used to be a blocking
 * DialogV2.wait() with no handle, so answering anywhere else — the card row, a cast straight
 * from the sheet, a GM Skip — left it on screen still asking a question that had been answered
 * (reported live 2026-08-15). Now the instance is held so the hold's own update can close it,
 * and closing for ANY reason releases the decision back to the card row.
 */
async function showHoldPopup(attackMessage, hold) {
  const roll = attackMessage.rolls[0];
  for ( const target of hold.targets ) {
    // An answered target's decision is made — reopening its popup (the card's Answer button
    // recalls popups for the whole message) re-asked a question and produced a second
    // "passes" card through the response channel.
    if ( target.answer ) continue;
    const actor = await fromUuid(target.uuid);
    if ( !canAnswerFor(actor) ) continue;

    const key = popupKey(attackMessage.id, target.uuid);
    if ( livePopups.has(key) ) continue;

    // ⚠ THE SAME TWO BUTTONS FOR EVERYONE. The question is binary — take the reaction or don't
    // — and it is the same question whoever is answering it. A GM-only third button ("Skip")
    // stood here until v1.1.15 and made the GM's popup a different shape from the player's for
    // no behavioural difference at all: it ran the same code as Pass, and the whole chain only
    // ever asks `answer === "cast"`. See the card controls for why it went.
    const buttons = [
      { action: "cast", label: `Cast ${target.reaction}`, default: true,
        callback: () => castReaction(target) },
      { action: "pass", label: "Pass",
        callback: () => answerHold(attackMessage, target.uuid, "pass") }
    ];

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: target.reaction, icon: "fa-solid fa-shield-halved" },
      position: { width: 460 },
      content: await holdPopupContent(target, roll, actor, hold),
      buttons,
      rejectClose: false
    });
    await openManagedPopup(key, attackMessage, dialog);
  }
}

/**
 * A popup must not outlive the message it is a view of. Deleting the hold — which is what the
 * smoke suites do to every message they create — used to leave one open dialog per hold
 * stacked on every client that could answer, asking about attacks that no longer exist
 * (reported live 2026-08-15: "close all the popup window spam").
 */
Hooks.on("deleteChatMessage", message => {
  for ( const [key, dialog] of [...livePopups] ) {
    if ( !key.startsWith(`${message.id}|`) ) continue;
    livePopups.delete(key);
    void dialog.close();
  }
  shownPopups.delete(message.id);
  disarmHoldTimer(message.id);   // no message, no hold, nothing for the buzzer to pass
});

/** A decision made anywhere closes the popup asking for it. */
export function closeAnsweredPopups(message) {
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold?.targets?.length ) return;
  for ( const target of hold.targets ) {
    const dialog = livePopups.get(popupKey(message.id, target.uuid));
    if ( !dialog ) continue;
    if ( (hold.status !== "pending") || target.answer ) void dialog.close();
  }
}

