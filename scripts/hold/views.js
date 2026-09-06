/**
 * Battle Flow — the reaction hold, part 8: THE VIEWS. The durable row on the attack card (with
 * the reload resumes: the buzzer re-armed, a ready hold re-driven, the popup re-shown) and the
 * popup — the ability rendered as itself, the math only when the reveal is on. Moved into the
 * hold from ui.js by D6 (2026-08-23): a view of the hold flag belongs with the machine that
 * owns the flag, and the spine knows nothing of this feature. The damage-offer bar is NOT the
 * hold's and stays in ui.js, registered first (this part imports ui.js, so ui.js's body — and
 * its registration — evaluate first; check-hook-order asserts `ui.js` before `hold/views.js`).
 */
import { MODULE_ID, S, setting, canAnswerFor, isContinuingClient } from "../core.js";
import { INTERRUPT_REDUCTIONS } from "../decide/registry.js";
import { bfCard, popupKey, holdBarHTML, ruleLine, spendLine, spendPhrase } from "../decide/present.js";
import { poolOf } from "../shared.js";
import { openMomentPopup, momentButton, scheduleBarSync, shownMoments } from "../ui.js";
import { reactionItem, reactionImg, reactionACBonus } from "./lookup.js";
import { armHoldTimer } from "./clock.js";
import { answerHold, castReaction } from "./answer.js";
import { continueHold } from "./continue.js";

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

// The hold's durable row on the attack card. ⚠ Registration order is on-card order, and this
// registration used to live in ui.js: the pinned assertion moved with it (check-hook-order.mjs
// now reads hold.js before mastery.js). ui.js's damage-offer bar still registers first because
// this file imports ui.js, which is the same relative order they had inside one handler.
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

      // A MANEUVER reaction (Parry — INTERRUPT_REDUCTIONS) wears the maneuver family's language
      // (user, 2026-09-05: "the same UI language and design as Riposte and other maneuvers"):
      // `Maneuver — Name`, `Name — what happened`, who and the cost. The hold's own words stay
      // for spells and features.
      const maneuver = !!target.reduce;
      let title = target.reaction;
      if ( maneuver ) {
        const attackerName = message.getAssociatedActor?.()?.name ?? "The attacker";
        eyebrow = `Maneuver — ${target.reaction}`;
        if ( hold.status === "pending" ) {
          title = `${target.reaction} — ${target.name} may reduce the damage`;
          subtitle = `${attackerName}'s melee attack hit`;
        } else if ( target.answer === "cast" ) {
          title = (Number(target.reduceBy) > 0)
            ? `${target.reaction} — ${target.name} reduces the damage by ${target.reduceBy}`
            : `${target.reaction} — ${target.name} parries; reduce the damage by hand`;
          subtitle = spendPhrase(target.poolSpend ? [target.poolSpend] : []);
        } else {
          title = `${target.reaction} — ${target.name} declined${target.timedOut ? " (timer)" : ""}`;
          subtitle = `${attackerName}'s melee attack hit`;
        }
      }
      block.innerHTML = bfCard({
        img: reactionImg(actor, target.reaction, target),
        eyebrow, title, subtitle, lines, tone
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
      // The popup decides, the card recalls it — the card-only mode (the old holdView
      // opt-out) left with the settings collapse (2026-08-16): one input surface, always.
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        display: "flex", gap: "0.3rem", marginTop: "0.4rem", justifyContent: "flex-end"
      });
      controls.append(momentButton("Answer", () => {
        shownMoments.delete(popupKey(message.id, "hold"));
        // `manual` — a deliberate click, so it bypasses the GM's player-owned quiet above.
        void showHoldPopup(message, message.getFlag(MODULE_ID, "hold"), { manual: true });
      }, { flex: "0 0 auto", margin: "0", padding: "0 0.4rem", fontSize: "inherit", lineHeight: "1.4" }));
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
  const shownKey = popupKey(message.id, "hold");
  if ( (hold.status === "pending") && !shownMoments.has(shownKey) ) {
    shownMoments.add(shownKey);
    void showHoldPopup(message, hold);
  }
});

/** A maneuver reaction's popup (Parry): Riposte's shape — the card, the cost, the rule, the clock. */
function maneuverPopupContent(attackMessage, target, actor, hold) {
  const key = Object.keys(INTERRUPT_REDUCTIONS).find(k => k.toLowerCase() === String(target.reaction ?? "").toLowerCase());
  const row = key ? INTERRUPT_REDUCTIONS[key] : null;
  const attackerName = attackMessage.getAssociatedActor?.()?.name ?? "The attacker";
  // The pool as it stands, before the spend — the same words the card will use after it.
  const item = actor?.items.get(target.itemId) ?? reactionItem(actor, target.reaction);
  const activity = item?.system?.activities?.get(target.reduce?.activityId) ?? null;
  const pool = activity ? poolOf(actor, activity) : null;
  const standing = pool ? spendLine({ pool: pool.name, left: Number(pool.system?.uses?.value ?? 0), max: Number(pool.system?.uses?.max ?? 0) }) : null;
  return bfCard({
    img: reactionImg(actor, target.reaction, target), eyebrow: `Maneuver — ${target.reaction}`, tone: "pending",
    title: `${attackerName} hit you`,
    subtitle: `Spend a Superiority Die and your Reaction to reduce the damage by the die plus your modifier${standing ? ` · ${standing}` : ""}`,
    lines: row?.rule ? [ruleLine(row.rule)] : []
  }) + holdBarHTML(hold, "to answer");
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
    <img src="${img}" alt="${String(target.reaction ?? "").replace(/"/g, "&quot;")}"
         data-tooltip="${String(target.reaction ?? "").replace(/"/g, "&quot;")}"
         style="width:48px;height:48px;flex:0 0 auto;border-radius:4px;
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
async function showHoldPopup(attackMessage, hold, { manual = false } = {}) {
  const roll = attackMessage.rolls[0];
  for ( const target of hold.targets ) {
    // An answered target's decision is made — reopening its popup (the card's Answer button
    // recalls popups for the whole message) re-asked a question and produced a second
    // "passes" card through the response channel.
    if ( target.answer ) continue;
    const actor = await fromUuid(target.uuid);
    if ( !canAnswerFor(actor) ) continue;

    // THE GM'S UNSOLICITED POPUPS ARE NON-PLAYER-OWNED TARGETS ONLY. This is the save
    // machine's rule (v1.12.0 finding ④, user: "as a GM i dont care to see other player
    // saves"), and `gmQuiet` has lived in saves.js and mastery.js since — the hold was the
    // one machine that never got it. Restated against the hold 2026-08-19: "as a DM, I
    // shouldn't see Gren's shield popup. DM doesn't want to be spammed with player popups.
    // DM can just see the card timer tick."
    //
    // ⚠ The case this actually fixes is the OFFLINE owner. A player-owned target whose owner
    // is PRESENT never reaches this line — canAnswerFor is already false on the GM client,
    // which is why the requirement looked satisfied for as long as the players were logged
    // in and looked broken the moment the DM tested alone. canAnswerFor deliberately falls
    // back to the GM when the owner is away; that fallback is what was spamming the DM.
    // Such a target now rides the hold timer instead, which is the right answer twice over:
    // expiry is a PASS, and an absent player was never going to spend a reaction anyway.
    // NPCs and unowned characters keep their popups — the monster side is the GM's to answer.
    //
    // `manual` is the deliberate-recall escape hatch: the card's Answer button passes it, so
    // the DM can always summon the question on purpose. A click is never spam.
    if ( !manual && game.user.isGM && actor?.hasPlayerOwner ) continue;

    // ⚠ THE SAME TWO BUTTONS FOR EVERYONE. The question is binary — take the reaction or don't
    // — and it is the same question whoever is answering it. A GM-only third button ("Skip")
    // stood here until v1.1.15 and made the GM's popup a different shape from the player's for
    // no behavioural difference at all: it ran the same code as Pass, and the whole chain only
    // ever asks `answer === "cast"`. See the card controls for why it went.
    // A maneuver reaction (Parry) asks in the maneuver family's shape — Riposte's popup: the
    // art, `Maneuver — Name`, what happened, the cost, the rule; the answer button is the
    // maneuver's own name (user, 2026-09-05).
    const maneuver = !!target.reduce;
    await openMomentPopup(attackMessage, target.uuid, actor, {
      title: maneuver ? `${target.reaction} — ${actor?.name ?? ""}` : target.reaction,
      icon: maneuver ? "fa-solid fa-hand-back-fist" : "fa-solid fa-shield-halved", width: 460,
      content: maneuver ? maneuverPopupContent(attackMessage, target, actor, hold) : await holdPopupContent(target, roll, actor, hold),
      buttons: [
        { action: "cast", label: maneuver ? target.reaction : `Cast ${target.reaction}`, default: true,
          callback: () => castReaction(attackMessage, target) },
        { action: "pass", label: "Pass",
          callback: () => answerHold(attackMessage, target.uuid, "pass") }
      ]
    });
  }
}
