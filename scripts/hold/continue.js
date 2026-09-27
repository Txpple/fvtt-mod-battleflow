/**
 * Battle Flow — the reaction hold: THE CONTINUATION. Every held target answered → re-test against
 * the LIVE AC after the settle window, write the verdicts, announce, release the dice. Also closes
 * answered popups (the parts stay a DAG: views → continue, never back).
 */
import { MODULE_ID, TITLE, queueFlagWrite, isContinuingClient, drivesMomentFor, canApplyTo, HOLD_SETTLE_SECONDS } from "../core.js";
import { chipClock } from "../decide/chips.js";
import { placeOf, chipData } from "../shared.js";
import { applyEffectsTo } from "../effect-riders.js";
import { foldedRoll, interruptMultiplier } from "../decide/verdict.js";
import { INTERRUPT_MULTIPLIERS, INTERRUPT_ROLLS } from "../decide/registry.js";
import { rescueSpendText } from "../decide/rescue-hit.js";
import { damageAfterHold } from "../auto-damage.js";
import { joinEffectReceipt } from "../decide/receipt.js";
import { bfCard, popupKey, spendPhrase } from "../decide/present.js";
import { livePopups } from "../ui.js";
import { reactionItem, hasReactionEffect, applyReactionEffect, reactionACArrived, reactionImg } from "./lookup.js";
import { disarmHoldTimer } from "./clock.js";
import { resolveUuid, lower } from "../lookup.js";
import { continueSpellHold } from "./spell-hold.js";

// ⚠ Reads CURRENT state, not the diff: setFlag's flattened key never matches a nested test.
Hooks.on("updateChatMessage", message => {
  // Every client, before the continuing-client gate: the popup is usually elsewhere.
  closeAnsweredHoldPopups(message);

  const hold = message.getFlag(MODULE_ID, "hold");
  if ( hold?.status === "resolved" ) void landProtection(message, hold);
  if ( !hold || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  if ( !hold.targets.every(t => t.answer) ) return;
  void continueHold(message);
});

/**
 * ⚠ Claimed before the first await: the settle wait re-fires the watcher, and a second run rolls
 * damage twice. In memory, so a client dying mid-run cannot strand the hold.
 */
const continuationsInFlight = new Set();

/** Re-resolve a fully-answered hold against the LIVE AC (Shield's +5 must land first). */
export async function continueHold(attackMessage) {
  if ( continuationsInFlight.has(attackMessage.id) ) return;
  const hold = foundry.utils.deepClone(attackMessage.getFlag(MODULE_ID, "hold"));
  if ( !hold || (hold.status !== "pending") ) return;
  continuationsInFlight.add(attackMessage.id);
  try {
    return await driveHoldContinuation(attackMessage, hold);
  } finally {
    continuationsInFlight.delete(attackMessage.id);
  }
}

async function driveHoldContinuation(attackMessage, hold) {

  // Safety net: the cast reaction's effect must be ON the actor before the re-test. ⚠ Catches only
  // what this client OWNS; the monster side rests on the answering GM's applyReactionEffect.
  for ( const target of hold.targets.filter(t => t.answer === "cast") ) {
    const actor = await fromUuid(target.uuid);
    if ( !actor?.isOwner || hasReactionEffect(actor, target.reaction, target) ) continue;
    // The ITEM, by recorded itemId: a statblock's Shield keeps its effect only on the item.
    const item = reactionItem(actor, target.reaction, target);
    const activity = item?.system.activities?.contents?.[0];
    const entries = await applyReactionEffect(activity, actor, target.reaction, target);
    if ( entries.length ) {
      await queueFlagWrite(attackMessage, "effectReceipt", flag => {
        for ( const entry of entries ) joinEffectReceipt(flag, entry);
      });
    }
  }

  // A negate hold has nothing to re-test.
  if ( hold.trigger === "spell" ) return continueSpellHold(attackMessage, hold);

  if ( hold.targets.some(t => t.answer === "cast") ) await settleForACChange(hold);

  const roll = attackMessage.rolls[0];
  const announcements = [];
  for ( const target of hold.targets ) {
    const actor = await fromUuid(target.uuid);
    const liveAC = actor?.system?.attributes?.ac?.value ?? target.ac;
    // A `roll` answer's bent d20 is a `replace` with its own crit/fumble: fold it, never the raw total.
    const rolled = foldedRoll({ total: roll.total, isCritical: roll.isCritical, isFumble: roll.isFumble },
      bentFold(target));
    const hit = rolled.isCritical || (!rolled.isFumble && (rolled.total >= liveAC));
    target.verdict = hit ? "hit" : "miss";
    target.acAtVerdict = liveAC;
    if ( target.answer === "roll" ) {
      announcements.push(bentAnnouncement(actor, target, hit));
      continue;
    }
    if ( target.answer !== "cast" ) continue;
    const img = reactionImg(actor, target.reaction, target);
    if ( target.kind === "ac" ) {
      if ( !reactionACArrived(actor, target) ) {
        // ⚠ A FIXED AC (`ac.override` or `calc: "flat"`) ignores every AC bonus: a statblock to fix.
        const ac = actor?.system?.attributes?.ac;
        const flatAC = ((ac?.override !== null) && (ac?.override !== undefined) || (ac?.calc === "flat"))
          && hasReactionEffect(actor, target.reaction, target);
        announcements.push(bfCard({
          img, eyebrow: "Reaction — not applied", title: target.reaction, subtitle: target.name,
          tone: "bad",
          lines: flatAC
            ? [`<strong>${target.name}</strong>'s AC is a <strong>fixed number</strong>, so no `
              + `bonus can reach it — ${target.reaction}'s included.`,
              `The effect did land; the system ignores it. AC reads <strong>${liveAC}</strong>, `
              + `so this resolves as a hit (${roll.total}).`,
              `<em>Fix the statblock: set its AC calculation to Natural Armor with the same `
              + `number, and the reaction works.</em>`]
            : [`It was cast, but its AC has not arrived on <strong>${target.name}</strong>.`,
              `AC still reads <strong>${liveAC}</strong>, so this resolves as a hit (${roll.total}).`,
              `<em>Apply the effect from the card, then Revert the damage if needed.</em>`]
        }));
      } else {
        announcements.push(bfCard({
          img, eyebrow: hit ? "Reaction — not enough" : "Reaction — it worked",
          title: target.reaction, subtitle: target.name, tone: hit ? "bad" : "good",
          lines: [`AC <strong>${target.ac}</strong>`
            + `${liveAC !== target.ac ? ` → <strong>${liveAC}</strong>` : ""}`
            + ` vs the attack's <strong>${roll.total}</strong>.`,
            hit ? `The attack still hits.` : `<strong>The attack misses.</strong>`]
        }));
      }
    } else {
      // A damage-kind reaction the module can settle (halve, rolled reduction) is receipted; the rest by hand.
      const settled = interruptMultiplier(target, INTERRUPT_MULTIPLIERS);
      const reduced = (Number(target.reduceBy) > 0) ? Number(target.reduceBy) : null;
      const how = settled ? ((settled.multiplier === 0.5) ? "halved" : `×${settled.multiplier}`) : reduced ? `reduced by <strong>${reduced}</strong>` : null;
      const maneuver = !!target.reduce;
      const r = target.reduce ?? {};
      announcements.push(bfCard({
        img, eyebrow: maneuver ? `${r.eyebrow ?? "Maneuver"} — ${target.reaction}` : (settled || reduced) ? "Reaction — it worked" : "Reaction — cast",
        title: maneuver ? (reduced ? `${target.reaction} — ${target.name} reduces the damage by ${reduced}` : `${target.reaction} — reduce the damage by hand`) : target.reaction,
        subtitle: maneuver ? spendPhrase(target.poolSpend ? [target.poolSpend] : [], r.spend ?? "Superiority Die") : target.name,
        tone: (settled || reduced) ? "good" : "neutral",
        lines: [(settled || reduced)
          ? `The attack still hits, and its damage against <strong>${target.name}</strong> is ${how} — the receipt says so.`
          : `Reduce the damage by hand — the roll stands.`]
      }));
    }
  }

  hold.status = "resolved";
  disarmHoldTimer(attackMessage.id);
  await attackMessage.setFlag(MODULE_ID, "hold", hold);
  if ( announcements.length ) await ChatMessage.create({
    content: announcements.join(`<div style="height:0.3rem;"></div>`),
    speaker: { alias: TITLE }
  });

  // Release the dice rolled at attack time; the applier's hitTargets drops every flipped target.
  for ( const dmg of game.messages.contents.filter(m =>
    (m.getFlag(MODULE_ID, "attackFor") === attackMessage.id)
    && (m.getFlag(MODULE_ID, "attackHoldPending") === true) ) ) {
    await dmg.setFlag(MODULE_ID, "attackHoldPending", false);
  }

  // A crit the hold could undo was never rolled: roll it now, as the answer left it.
  if ( hold.critAtStake ) await damageAfterHold(attackMessage);
}

/**
 * Protection's standing half (RULINGS *The fighting styles*): "Protected — <guard>" until the GUARD's
 * next turn starts, landed once by the protected creature's driver.
 */
const protectionsLanding = new Set();
async function landProtection(message, hold) {
  for ( const target of (hold.targets ?? []) ) {
    const by = target.guardedBy;
    if ( !by || (target.answer !== "roll") || target.protectLanded ) continue;
    const key = `${message.id}|${target.uuid}`;
    if ( protectionsLanding.has(key) || !drivesMomentFor(target.uuid) ) continue;
    const defender = resolveUuid(target.uuid), guard = resolveUuid(by.uuid);
    const rowKey = Object.keys(INTERRUPT_ROLLS).find(k => lower(k) === lower(target.rescue ?? ""));
    const row = rowKey ? INTERRUPT_ROLLS[rowKey] : null;
    if ( !row?.effect || !(defender instanceof Actor) || !(guard instanceof Actor) || !canApplyTo(defender) ) continue;
    protectionsLanding.add(key);
    try {
      const item = guard.items.get(by.itemId);
      const effects = (item?.effects?.contents ?? []).filter(e => !e.transfer && (lower(e.name) === lower(row.effect)))
        .map(e => e.clone({ name: `${e.name} — ${by.name}` }, { keepId: true }));
      if ( !effects.length ) continue;
      const clock = chipClock("reaction", placeOf(guard));
      const entries = await applyEffectsTo([{ uuid: defender.uuid, name: target.name }], effects, {
        matchNames: true, source: guard.uuid,
        clock: clock?.start ? chipData(clock) : null,
        extraFlags: { [MODULE_ID]: { protectedBy: guard.uuid } }
      });
      if ( message.isOwner ) {
        await queueFlagWrite(message, "hold", h => {
          const t = h.targets?.find(x => x.uuid === target.uuid);
          if ( !t || t.protectLanded ) return false;
          t.protectLanded = true;
        });
        if ( entries.length ) await queueFlagWrite(message, "effectReceipt", flag => {
          for ( const entry of entries ) joinEffectReceipt(flag, entry);
        });
      }
    } catch(err) {
      console.error(`${TITLE} | ${rowKey}'s standing Disadvantage could not land on ${target.name} — apply "${row.effect}" by hand.`, err);
    }
  }
}

/** A target's bent roll as `foldedRoll`'s contribution. */
function bentFold(target) {
  const b = target?.bent;
  return Number.isFinite(b?.total)
    ? [{ uuid: target.uuid, replace: { total: b.total, isCritical: b.isCritical === true, isFumble: b.isFumble === true } }]
    : [];
}

/** The defender's card after a `roll` answer: the row, its cost, whether it turned the hit. */
function bentAnnouncement(actor, target, hit) {
  const found = Object.keys(INTERRUPT_ROLLS).find(k => k.toLowerCase() === String(target.rescue ?? "").toLowerCase());
  const row = found ? INTERRUPT_ROLLS[found] : null;
  const spend = rescueSpendText({ row, poolSpend: target.poolSpend ?? null });
  const by = target.guardedBy ?? null;
  const guardImg = by ? (resolveUuid(by.uuid)?.items?.get(by.itemId)?.img ?? null) : null;
  return bfCard({
    img: guardImg ?? reactionImg(actor, target.rescue ?? target.reaction, {}), eyebrow: `Reaction — ${target.rescue ?? target.reaction}`,
    title: target.rescue ?? target.reaction, subtitle: by ? `${by.name} protects ${target.name}` : target.name, tone: hit ? "bad" : "good",
    lines: [spend, hit ? "It did not turn the hit." : "<strong>The attack misses.</strong>"].filter(Boolean)
  });
}

/** Wait for every cast reaction's AC to ARRIVE (a baseline compare can race the recompute). */
async function settleForACChange(hold) {
  const deadline = Date.now() + (HOLD_SETTLE_SECONDS * 1000);
  const casts = hold.targets.filter(t => t.answer === "cast");
  while ( Date.now() < deadline ) {
    let allArrived = true;
    for ( const target of casts ) {
      const actor = await fromUuid(target.uuid);
      if ( !reactionACArrived(actor, target) ) { allArrived = false; break; }
    }
    if ( allArrived ) return;
    await new Promise(r => setTimeout(r, 250));
  }
}

/** ARCHITECTURE §5 law 4: a decision made ANYWHERE closes its popup — per target. */
function closeAnsweredHoldPopups(message) {
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold?.targets?.length ) return;
  for ( const target of hold.targets ) {
    const dialog = livePopups.get(popupKey(message.id, target.uuid));
    if ( dialog && ((hold.status !== "pending") || target.answer || target.selfPassed) ) void dialog.close();
    // A guard's own popup (Protection) also closes on its own pass.
    for ( const guard of (target.guards ?? []) ) {
      const own = livePopups.get(popupKey(message.id, `${target.uuid}|${guard.uuid}`));
      if ( own && ((hold.status !== "pending") || target.answer || guard.passed) ) void own.close();
    }
  }
}
