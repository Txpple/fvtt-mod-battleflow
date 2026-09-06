/**
 * Battle Flow — the reaction hold, part 6: THE CONTINUATION. Every held target answered → the
 * continuing client re-tests the attack against the LIVE AC after the settle window, writes
 * the verdicts, announces, and releases the dice rolled at attack time. Also the watcher's
 * popup-closing (presentation law 4) — it sits with the update watcher that calls it, which is
 * what keeps the parts a DAG (views → continue, never back).
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, isContinuingClient } from "../core.js";
import { interruptMultiplier } from "../decide/verdict.js";
import { INTERRUPT_MULTIPLIERS } from "../decide/registry.js";
import { joinEffectReceipt } from "../decide/receipt.js";
import { bfCard, popupKey, spendPhrase } from "../decide/present.js";
import { livePopups } from "../ui.js";
import { reactionItem, hasReactionEffect, applyReactionEffect, reactionACArrived, reactionImg } from "./lookup.js";
import { disarmHoldTimer } from "./clock.js";
import { continueSpellHold } from "./spell-hold.js";

// Drive the continuation whenever a held message changes and every held target has answered.
// Deliberately reads the message's CURRENT state rather than inspecting the update diff:
// setFlag issues a flattened `flags.<module>.hold` key, so a nested-path test against
// `changed` silently never matches (bit live 2026-08-15). The early-outs are cheap.
Hooks.on("updateChatMessage", message => {
  // Every client closes popups whose decision has already been made — this runs before the
  // continuing-client gate on purpose, because the popup to close is usually on a DIFFERENT
  // client from the one driving the continuation.
  closeAnsweredHoldPopups(message);

  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  if ( !hold.targets.every(t => t.answer) ) return;
  void continueHold(message);
});

/**
 * Continuations this client is already driving. The body below AWAITS for up to holdSettle
 * seconds with the flag still `pending`, and any OTHER update landing on the held message in
 * that window (a mastery ask stamped on the same attack, a receipt) re-fires the
 * updateChatMessage watcher, which would find "pending, all answered" and run the whole
 * continuation AGAIN — double announcements and a second damage roll. Over-applying damage
 * is the worst failure this module has, so the claim is taken before the first await.
 * In-memory on purpose: the race is same-client re-entry (the watcher is already gated to
 * one client by isContinuingClient), and a persisted claim would strand the hold if the
 * claiming client died mid-continuation — the render hook's resume check below needs the
 * flag still readable as "pending and ready".
 */
const continuationsInFlight = new Set();

/**
 * Re-resolve a fully-answered hold and continue the chain.
 *
 * ⚠ The re-test runs against the target's LIVE AC, never the stored descriptor — that
 * snapshot was taken before the Shield existed. And the AC does not move the instant a
 * reaction is cast: Shield's +5 arrives as a non-transfer active effect the native tray
 * applies (monster reactions ship theirs DISABLED for the GM to switch on), so a cast is
 * given a settle window to let the change land before the verdict is taken. Phase 3 closes
 * this properly by applying the effect itself.
 */
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

  // Safety net before the verdict: make sure a cast reaction's effect is actually ON the
  // actor. The casting client is supposed to have done this, but it only will if it owns the
  // actor AND is running current code — and if it didn't, the re-test silently reads the
  // pre-reaction AC and calls a miss a hit (exactly what happened live 2026-08-15: "Shield
  // raises AC to 12"). Idempotent: an effect already present is left alone.
  //
  // ⚠ This net only catches what the continuing client OWNS. On an NPC attack that client is
  // the GM, who owns everything — but on a PC attack (autoDamage "pc"/"all") it is the
  // attacking PLAYER, who owns none of the monsters holding reactions, so the net no-ops and
  // the monster side rests entirely on the answering GM's applyReactionEffect. Monster
  // reactions ship their effects DISABLED, so watch this seam when dogfooding PC attacks.
  if ( setting(S.holdApplyEffect) ) {
    for ( const target of hold.targets.filter(t => t.answer === "cast") ) {
      const actor = await fromUuid(target.uuid);
      if ( !actor?.isOwner || hasReactionEffect(actor, target.reaction, target) ) continue;
      // The reaction's own ITEM is what matters here, not the activity — applyReactionEffect
      // falls back to that item's effects, which is the only place a statblock's Shield keeps
      // Imperceptible Barrier (its cast activity carries none). `target` carries the itemId and
      // activityId the hold recorded, so the cached spell is found rather than a worn shield.
      const item = reactionItem(actor, target.reaction, target);
      const activity = item?.system.activities?.contents?.[0];
      const entries = await applyReactionEffect(activity, actor, target.reaction, target);
      if ( entries.length ) {
        // The continuing client owns the held message (its roll, or the GM fallback), so
        // the safety net's receipt lands there — same shape, same rows, same revert. Through
        // the serializer (D3): this loop runs per target, so it is its own concurrent writer.
        await queueFlagWrite(attackMessage, "effectReceipt", flag => {
          for ( const entry of entries ) joinEffectReceipt(flag, entry);
        });
      }
    }
  }

  // A negate hold ends here: there is nothing to re-test, so there is nothing to settle for
  // either. The effect above still went on — casting Shield against Magic Missile really does
  // also give you the +5 until your next turn — but this verdict does not depend on it.
  if ( hold.trigger === "spell" ) return continueSpellHold(attackMessage, hold);

  if ( hold.targets.some(t => t.answer === "cast") ) await settleForACChange(hold);

  const roll = attackMessage.rolls[0];
  const announcements = [];
  for ( const target of hold.targets ) {
    const actor = await fromUuid(target.uuid);
    const liveAC = actor?.system?.attributes?.ac?.value ?? target.ac;
    const hit = roll.isCritical || (!roll.isFumble && (roll.total >= liveAC));
    target.verdict = hit ? "hit" : "miss";
    target.acAtVerdict = liveAC;
    if ( target.answer !== "cast" ) continue;
    const img = reactionImg(actor, target.reaction, target);
    if ( target.kind === "ac" ) {
      // If the reaction's AC never arrived, the number we just tested against is the one the
      // target had BEFORE reacting — so say so instead of reporting a stale value as fact.
      // A silent "still hits" here is the worst possible outcome: it looks authoritative.
      if ( !reactionACArrived(actor, target) ) {
        // ⚠ A FLAT AC can never receive this, and saying so is the whole difference between a
        // one-field fix and a mystery. dnd5e's prepareArmorClass RETURNS on the flat branch
        // before ac.bonus is added ("Flat AC (no additional bonuses)"), so an actor whose AC is
        // a fixed number silently ignores every AC effect — Shield included. The effect really
        // did land; the system simply refuses to count it, and the old wording ("its AC has not
        // arrived") sent the reader looking for a module bug that was not there. Reported live
        // 2026-08-15 on a hand-authored Skeletal Mage; the official Monster Manual pack has
        // exactly one flat statblock out of 500, so this is bad data, not a shape to support.
        const flatAC = (actor?.system?.attributes?.ac?.calc === "flat")
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
      // A damage-kind reaction the module can settle (Uncanny Dodge halves; Parry's roll reduces)
      // is applied by the applier and receipted; the rest are reduced by hand, as before.
      const settled = interruptMultiplier(target, INTERRUPT_MULTIPLIERS);
      const reduced = (Number(target.reduceBy) > 0) ? Number(target.reduceBy) : null;
      const how = settled ? ((settled.multiplier === 0.5) ? "halved" : `×${settled.multiplier}`) : reduced ? `reduced by <strong>${reduced}</strong>` : null;
      const maneuver = !!target.reduce;   // Parry: the maneuver family's words (user, 2026-09-05)
      announcements.push(bfCard({
        img, eyebrow: maneuver ? `Maneuver — ${target.reaction}` : (settled || reduced) ? "Reaction — it worked" : "Reaction — cast",
        title: maneuver ? (reduced ? `${target.reaction} — ${target.name} reduces the damage by ${reduced}` : `${target.reaction} — reduce the damage by hand`) : target.reaction,
        subtitle: maneuver ? spendPhrase(target.poolSpend ? [target.poolSpend] : []) : target.name,
        tone: (settled || reduced) ? "good" : "neutral",
        lines: [(settled || reduced)
          ? `The attack still hits, and its damage against <strong>${target.name}</strong> is ${how} — the receipt says so.`
          : `Reduce the damage by hand — the roll stands.`]
      }));
    }
  }

  hold.status = "resolved";
  disarmHoldTimer(attackMessage.id);   // resolved: the clock has nothing left to decide
  await attackMessage.setFlag(MODULE_ID, "hold", hold);
  if ( announcements.length ) await ChatMessage.create({
    content: announcements.join(`<div style="height:0.3rem;"></div>`),
    speaker: { alias: TITLE }
  });

  // (gg), the v1.20.0 walk-1 ruling: the dice rolled AT ATTACK TIME (auto-damage.js stamps
  // them `attackHoldPending`), so resolution RELEASES the claim instead of rolling — the
  // darts' pattern on the attack chain. The applier re-reads hitTargets, whose verdict
  // override drops every Shield-flipped target, so an all-flipped release applies to nobody
  // and the dice do nothing (the announcement above already said "The attack misses").
  // A roll still in an open offer window needs nothing here: rollDamageForAttack reads the
  // hold at ROLL time, finds it resolved, stamps no claim, and applies straight.
  for ( const dmg of game.messages.contents.filter(m =>
    (m.getFlag(MODULE_ID, "attackFor") === attackMessage.id)
    && (m.getFlag(MODULE_ID, "attackHoldPending") === true) ) ) {
    await dmg.setFlag(MODULE_ID, "attackHoldPending", false);
  }
}

/**
 * Wait (briefly) for every cast reaction's AC to actually arrive. Resolves as soon as it has.
 * Deliberately waits on arrival rather than on "the number changed from a baseline": a
 * baseline captured after the recompute never changes again, and one captured before it can
 * be moved by something unrelated.
 */
async function settleForACChange(hold) {
  const deadline = Date.now() + (Math.max(1, Number(setting(S.holdSettle)) || 8) * 1000);
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

/**
 * PRESENTATION LAW 4 (§5): a popup asking something already answered is a lie on screen, so a
 * decision made ANYWHERE closes the popup asking for it — the card, another client, or the
 * buzzer.
 *
 * ⚠ D2 (2026-08-23) moved this out of ui.js, where it was the last thing in the spine that knew
 * this feature existed. It read the hold flag by STRING, so it made no import edge and D6's
 * cycle break went straight past it. Every other machine already closed its own popups exactly
 * like this; the hold was the one whose popup-closing lived in the spine. Per-target, because
 * one casting can answer many holds and only the answered target's popup should go.
 */
function closeAnsweredHoldPopups(message) {
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold?.targets?.length ) return;
  for ( const target of hold.targets ) {
    const dialog = livePopups.get(popupKey(message.id, target.uuid));
    if ( !dialog ) continue;
    if ( (hold.status !== "pending") || target.answer ) void dialog.close();
  }
}
