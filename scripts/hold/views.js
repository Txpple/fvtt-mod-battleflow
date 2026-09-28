// @ts-check
/**
 * Battle Flow — the reaction hold: THE VIEWS. The durable card row (with the reload resumes) and the
 * popups. The row renders below ui.js's damage-offer bar (dispatch.js ORDER).
 */
import { MODULE_ID, S, setting, canAnswerFor, isContinuingClient } from "../core.js";
import { INTERRUPT_REDUCTIONS, INTERRUPT_ROLLS } from "../decide/registry.js";
import { bfCard, popupKey, holdBarHTML, ruleLine, spendLine, spendPhrase, tickRowsHTML } from "../decide/present.js";
import { bentLines, d20ModeOf, futileGuardLine, guardRow, liveRows, rescueTitle } from "../decide/rescue-hit.js";
import { poolOf } from "../shared.js";
import { openMomentPopup, momentButton, scheduleBarSync, shownMoments } from "../ui.js";
import { reactionItem, reactionImg, reactionACBonus, rescueRowsNow } from "./lookup.js";
import { armHoldTimer } from "./clock.js";
import { answerHold, castReaction, rescueReaction, protectReaction } from "./answer.js";
import { resolveUuid } from "../lookup.js";
import { continueHold } from "./continue.js";
import { SURFACES } from "../surfaces.js";
import { listen } from "../dispatch.js";

/** The math a hold may show, or null with the reveal off. ⚠ ONE gate for card and popup — never re-derive. */
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

// The hold's durable row on the attack card, above mastery's rows (dispatch.js ORDER).
listen("dnd5e.renderChatMessage", "hold/views", (message, html) => {
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold?.targets?.length ) return;

  const row = document.createElement("div");
  row.className = "battleflow-hold";
  row.style.margin = "0.4rem 0 0";

  for ( const target of hold.targets ) {
    const block = document.createElement("div");
    block.style.marginTop = "0.25rem";
    row.append(block);

    // The card is the PUBLIC record: everyone sees the same thing.
    void fromUuid(target.uuid).then(actor => {
      const roll = message.rolls[0];
      // A spell hold has no d20, so no math to reveal.
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
        const guards = (target.guards ?? []).filter(g => !g.passed).map(g => g.name);
        const self = (target.selfAsk !== false) && !target.selfPassed ? [owner?.name ?? "the GM"] : [];
        subtitle = `${target.name} · waiting on ${[...self, ...guards].join(", ") || "the GM"}`;
        if ( reveal ) lines.push(revealLine(reveal, target));
        else if ( spell ) lines.push(`<strong>${hold.spell}</strong> · `
          + `${target.reaction} stops it completely`);
      } else {
        const cast = target.answer === "cast";
        const negated = target.verdict === "negated";
        tone = (target.verdict === "miss") || negated ? "good" : cast ? "bad" : "neutral";
        // "skip" is still labelled: holds answered that way sit in old logs.
        eyebrow = negated ? "Reaction — it worked"
          : cast ? "Reaction — cast"
          : target.answer === "skip" ? "Reaction — skipped"
          : target.timedOut ? "Reaction — timed out" : "Reaction — passed";
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
      // A resolved BENT roll: who bent it and what it did.
      if ( (target.answer === "roll") && target.bent && target.verdict && (hold.status !== "pending") ) {
        const rescue = target.rescue ?? target.reaction;
        const by = target.guardedBy ?? null;
        const label = by ? `${rescue} (${by.name})` : rescue;
        const { headline, detail } = bentLines({ rescue: label, bent: target.bent, verdict: target.verdict, ac: target.acAtVerdict ?? null });
        const guardImg = by ? (resolveUuid(by.uuid)?.items?.get(by.itemId)?.img ?? null) : null;
        block.innerHTML = bfCard({
          img: guardImg ?? reactionImg(actor, rescue, {}), eyebrow: `Attack — Disadvantage · ${label}`,
          title: rescue, subtitle: target.name, tone: (target.verdict === "miss") ? "good" : "bad",
          lines: [`<strong>${headline}</strong>`, detail]
        });
        return;
      }

      // A reduction reaction (INTERRUPT_REDUCTIONS) wears the maneuver family's shape.
      const maneuver = !!target.reduce;
      let title = target.reaction;
      if ( maneuver ) {
        const attackerName = message.getAssociatedActor?.()?.name ?? "The attacker";
        const r = target.reduce;
        eyebrow = `${r.eyebrow ?? "Maneuver"} — ${target.reaction}`;
        if ( hold.status === "pending" ) {
          title = `${target.reaction} — ${target.name} may reduce the damage`;
          subtitle = `${attackerName}'s ${r.hit ?? "melee attack"} hit`;
        } else if ( target.answer === "cast" ) {
          title = (Number(target.reduceBy) > 0)
            ? `${target.reaction} — ${target.name} reduces the damage by ${target.reduceBy}`
            : `${target.reaction} — ${target.name} reacts; reduce the damage by hand`;
          subtitle = spendPhrase(target.poolSpend ? [target.poolSpend] : [], r.spend ?? "Superiority Die");
        } else {
          title = `${target.reaction} — ${target.name} declined${target.timedOut ? " (timer)" : ""}`;
          subtitle = `${attackerName}'s ${r.hit ?? "melee attack"} hit`;
        }
      }
      block.innerHTML = bfCard({
        img: reactionImg(actor, target.reaction, target),
        eyebrow, title, subtitle, lines, tone
      }) + holdBarHTML(hold);
      scheduleBarSync(block);

      if ( hold.status !== "pending" ) return;
      // A reload lands here with the hold open: re-arm the buzzer from the flag's deadline.
      armHoldTimer(message);
      const selfOpen = (target.selfAsk !== false) && !target.selfPassed && canAnswerFor(actor);
      const guardOpen = (target.guards ?? []).some(g => !g.passed && canAnswerFor(resolveUuid(g.uuid)));
      if ( target.answer || (!selfOpen && !guardOpen) ) return;

      // ⚠ ONE input surface: the popup decides; the card only calls it BACK, never a second set of controls.
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        display: "flex", gap: "0.3rem", marginTop: "0.4rem", justifyContent: "flex-end"
      });
      controls.append(momentButton("Answer", () => {
        shownMoments.delete(popupKey(message.id, "hold"));
        void showHoldPopup(message, message.getFlag(MODULE_ID, "hold"));
      }, { flex: "0 0 auto", margin: "0", padding: "0 0.4rem", fontSize: "inherit", lineHeight: "1.4" }));
      block.append(controls);
    });
  }
  html.querySelector(SURFACES.messageContent)?.appendChild(row);

  // Resume a READY hold nobody drives (the continuing client reloaded before the verdict): the buzzer
  // passes only UNANSWERED targets. The in-flight claim makes this idempotent across re-renders.
  if ( (hold.status === "pending") && hold.targets.every(t => t.answer)
    && isContinuingClient(hold) ) void continueHold(message);

  // Closing the popup is not an answer; the row is the durable state.
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
  const item = actor?.items.get(target.itemId) ?? reactionItem(actor, target.reaction);
  const activity = item?.system?.activities?.get(target.reduce?.activityId) ?? null;
  const pool = activity ? poolOf(actor, activity) : null;
  const standing = pool ? spendLine({ pool: pool.name, left: Number(pool.system?.uses?.value ?? 0), max: Number(pool.system?.uses?.max ?? 0) }) : null;
  const r = target.reduce ?? {};
  return bfCard({
    img: reactionImg(actor, target.reaction, target), eyebrow: `${r.eyebrow ?? "Maneuver"} — ${target.reaction}`, tone: "pending",
    title: `${attackerName} hit you`,
    subtitle: `Spend ${r.spend === "use" ? "a use" : `a ${r.spend ?? "Superiority Die"}`} and your Reaction to reduce the damage by ${r.by ?? "the die plus your modifier"}${standing ? ` · ${standing}` : ""}`,
    lines: row?.rule ? [ruleLine(row.rule)] : []
  }) + holdBarHTML(hold, "to answer");
}

/** The reaction rendered as itself (portrait, enriched text, the math if revealed), not a confirm box. */
async function holdPopupContent(target, roll, actor, hold) {
  // ⚠ The reaction's real item, not a bare-name match (a worn shield shares the spell's name).
  const item = reactionItem(actor, target.reaction, target);
  const img = item?.img ?? "icons/svg/shield.svg";
  const subtitle = [target.name, item?.system?.activation?.type === "reaction" ? "Reaction" : null]
    .filter(Boolean).join(" · ");

  const editor = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  let description = "";
  try {
    description = await editor.enrichHTML(item?.system?.description?.value ?? "",
      { rollData: actor?.getRollData?.() ?? {}, secrets: false });
  } catch {
    description = item?.system?.description?.value ?? "";
  }

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
 * Show the hold popup. ⚠ A popup is a VIEW: the hold's own update closes it, and closing releases
 * the decision to the card.
 */
async function showHoldPopup(attackMessage, hold) {
  const roll = attackMessage.rolls[0];
  for ( const target of hold.targets ) {
    // Reopening an answered target would produce a second "passes" card.
    if ( target.answer ) continue;
    const actor = await fromUuid(target.uuid);
    // Each unanswered guard (Protection) gets a popup of its own.
    for ( const guard of (target.guards ?? []) ) {
      if ( guard.passed ) continue;
      const guardActor = resolveUuid(guard.uuid);
      if ( !canAnswerFor(guardActor) ) continue;
      await showGuardPopup(attackMessage, target, guard, guardActor, hold, roll);
    }
    if ( (target.selfAsk === false) || target.selfPassed ) continue;
    // canAnswerFor ALONE routes: the owning player while connected, else the GM.
    if ( !canAnswerFor(actor) ) continue;

    if ( target.rows?.length ) { await showRescuePopup(attackMessage, target, actor, hold, roll); continue; }

    // The same two buttons for everyone; a maneuver's answer button is its name.
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

/** A GUARD's popup (Protection), keyed apart from the target's so each closes on its own answer. */
async function showGuardPopup(attackMessage, target, guard, guardActor, hold, roll) {
  const row = INTERRUPT_ROLLS[guard.row] ?? null;
  const attacker = attackMessage.getAssociatedActor?.()?.name ?? "The attacker";
  const weapon = attackMessage.getAssociatedActivity?.()?.item?.name ?? "the attack";
  const defender = resolveUuid(target.uuid);
  const reveal = revealDetail(target, roll, defender);
  const situation = roll?.isCritical ? "<strong>natural 20</strong> — a <strong>critical hit</strong>."
    : reveal ? `<strong>${reveal.total}</strong> vs AC <strong>${reveal.liveAC}</strong> — a hit.`
    : `Something hits <strong>${target.name}</strong>.`;
  const d20 = roll?.dice?.[0] ?? null;
  const { row: guardOffer, futile } = guardRow({ name: guard.row, rule: row?.rule ?? "",
    mode: d20ModeOf({ number: d20?.number, modifiers: d20?.modifiers }) });
  const rows = [guardOffer];
  const dialog = await openMomentPopup(attackMessage, `${target.uuid}|${guard.uuid}`, guardActor, {
    title: `${guard.row} — ${guard.name}`, icon: "fa-solid fa-shield-halved", width: 460,
    content: bfCard({ img: guardActor?.items?.get(guard.itemId)?.img ?? guardActor?.img ?? null, eyebrow: `Reaction — ${guard.row}`, tone: "pending",
      title: `${attacker} hits ${target.name}`, subtitle: `${weapon} · ${target.name} is beside you · Reaction` })
      + holdBarHTML(hold) + `<div style="padding:0.4rem 0.1rem;">${situation}${futile ? ` ${futileGuardLine(guard.row)}` : ""}</div>`
      + tickRowsHTML({ name: "bf-guard", rows }),
    buttons: [
      { action: "answer", label: "Answer", default: !futile, callback: (_event, button) => {
        if ( futile || !button?.form?.querySelector?.('input[name="bf-guard"]:checked') ) return;
        void protectReaction(attackMessage, target, guard);
      } },
      { action: "pass", label: futile ? "Keep my Reaction" : "Pass", default: futile,
        callback: () => answerHold(attackMessage, target.uuid, "pass", { by: guard.uuid }) }
    ]
  });
  // The tick stays even on one row; a futile row starts unticked with Answer off.
  const form = dialog?.element?.querySelector?.("form") ?? dialog?.element ?? null;
  const box = form?.querySelector?.('input[name="bf-guard"]') ?? null;
  const answer = form?.querySelector?.('button[data-action="answer"]') ?? null;
  if ( futile ) { if ( box ) { box.checked = false; box.disabled = true; } if ( answer ) answer.disabled = true; return; }
  if ( box ) box.checked = true;
  box?.addEventListener("change", () => { if ( answer ) answer.disabled = !box.checked; });
}

/**
 * THE POPUP THAT RESCUES A HIT (RULINGS *Rescuing the hit — the `roll` interrupt*): one tick row per
 * rescue, one ticked at a time; the situation line states the premise, never an outcome.
 */
async function showRescuePopup(attackMessage, target, actor, hold, roll) {
  const rows = rescueRowsNow(actor, target, roll);
  if ( !liveRows(rows).length ) return;   // spent since the stamp: nothing left to take (the buzzer passes it)
  const attacker = attackMessage.getAssociatedActor?.()?.name ?? "The attacker";
  const weapon = attackMessage.getAssociatedActivity?.()?.item?.name ?? "the attack";
  const reveal = revealDetail(target, roll, actor);
  const situation = roll?.isCritical ? "<strong>natural 20</strong> — a <strong>critical hit</strong>."
    : reveal ? `<strong>${reveal.total}</strong> vs AC <strong>${reveal.liveAC}</strong> — a hit.`
    : `Something hits <strong>${target.name}</strong>.`;
  const dialog = await openMomentPopup(attackMessage, target.uuid, actor, {
    title: rescueTitle(rows, target.name), icon: "fa-solid fa-shield-halved", width: 460,
    content: bfCard({ img: actor?.img ?? null, eyebrow: "Reaction — held", tone: "pending",
      title: `${attacker} hit you`, subtitle: `${weapon} · ${target.name} · Reaction` })
      + holdBarHTML(hold) + `<div style="padding:0.4rem 0.1rem;">${situation}</div>`
      + tickRowsHTML({ name: "bf-rescue", rows }),
    buttons: [
      // The window goes at the click: the answer is fired, not awaited.
      { action: "answer", label: "Answer", default: true, callback: (_event, button) => {
        const pick = button?.form?.querySelector?.('input[name="bf-rescue"]:checked')?.value ?? null;
        const row = rows.find(r => (r.key === pick) && !r.off);
        if ( !row ) return;
        if ( row.kind === "roll" ) void rescueReaction(attackMessage, target, row.key);
        else void castReaction(attackMessage, target);
      } },
      { action: "pass", label: "Pass", callback: () => answerHold(attackMessage, target.uuid, "pass") }
    ]
  });
  // One tick at a time; Answer live only while one is ticked.
  const form = dialog?.element?.querySelector?.("form") ?? dialog?.element ?? null;
  const answer = form?.querySelector?.('button[data-action="answer"]') ?? null;
  const boxes = [...(form?.querySelectorAll?.('input[name="bf-rescue"]') ?? [])];
  if ( answer ) answer.disabled = true;
  for ( const box of boxes ) box.addEventListener("change", () => {
    if ( box.checked ) for ( const other of boxes ) if ( other !== box ) other.checked = false;
    if ( answer ) answer.disabled = !boxes.some(b => b.checked);
  });
}
