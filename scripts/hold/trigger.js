/**
 * Battle Flow — the reaction hold, part 3: THE ATTACK TRIGGER. The reaction-spent chip on ANY
 * reaction use, and the stamp auto-damage.js asks for at the moment of the hit —
 * `stampHoldIfInterrupted`, the machine's one outside export (re-exported by index.js) — with
 * the futile-hold gate behind it. Phase 1.5 (a pause, NOT a system): Shield-class reactions
 * trigger on "you are hit", BEFORE damage, so the chain pauses here and a human answers; the
 * module never plays the reaction (DESIGN.md §4).
 */
import { MODULE_ID, TITLE, S, setting, drivesMomentFor, statContext } from "../core.js";
import { spendReaction, statSourceOf } from "../shared.js";
import { findInterrupt, hasReactionEffect, reactionACBonus } from "./lookup.js";
import { armHoldTimer } from "./clock.js";

// Reaction-spent bookkeeping — the core click-volume guard (ARCHITECTURE.md §6) — is a CHIP on
// the combat clock since 2026-09-02 (shared.js `reactionSpent` / `spendReaction`): any reaction
// an actor takes writes it, clocked to their own next turn, and the platform brings it back —
// the two clear hooks that used to live here counted turns by hand. Out of combat nothing is
// written (the old stranding guard, now the clock's own shape); a deleted combat sweeps the chip
// with every other window it clocked (mastery.js's tidy).
Hooks.on("dnd5e.postUseActivity", activity => {
  // ⚠ The reactor's OWN client may write this when no GM is on (v1.27.2): the chip lives on the
  // reacting actor, and a reaction is nearly always a PC's.
  if ( !setting(S.reactionHold) ) return;
  if ( !drivesMomentFor(activity?.actor?.uuid ?? null) ) return;
  if ( activity?.activation?.type !== "reaction" ) return;
  void spendReaction(activity.actor, { origin: activity.item?.uuid ?? null, what: activity.item?.name ?? "a Reaction" });
});

/**
 * If any hit target holds a usable interrupt, stamp the hold and return true (the caller
 * must not roll damage). The stamping client records itself as the one that will continue —
 * it is the attacker's client, the only one that can roll this activity's damage.
 */
export async function stampHoldIfInterrupted(attackMessage, roll, hits) {
  if ( !setting(S.reactionHold) ) return false;
  if ( attackMessage.getFlag(MODULE_ID, "hold") ) return true; // already held; never re-stamp

  const held = [];
  const skipped = [];
  for ( const target of hits ) {
    const actor = await fromUuid(target.uuid);
    const found = await findInterrupt(actor, { isCritical: roll.isCritical });
    if ( found && !holdWouldMatter(actor, found, roll, target.ac) ) {
      // The stat only this line witnesses (data-plane second pass, 2026-08-27): a hopeless
      // hold skipped in silence left NO record anywhere, so "how often did Shield actually
      // matter" was unanswerable. Recorded, never presented — the skip stays invisible at
      // the table, exactly as before.
      skipped.push({ uuid: target.uuid, name: target.name, reaction: found.entry.name });
      continue;
    }
    if ( found ) held.push({
      uuid: target.uuid, name: target.name, ac: target.ac,
      reaction: found.entry.name, kind: found.entry.kind,
      // A reduction reaction (Parry): the formula the answer rolls, off the pack (N1).
      ...(found.reduce ? { reduce: found.reduce } : {}),
      // The exact activity that answers this hold. A statblock casts Shield from a feature's
      // cast activity, not from the spell item, so a name lookup at Cast time finds the wrong
      // document (or an unusable one) — record the ids instead of rediscovering them.
      itemId: found.item.id, activityId: found.activity?.id ?? null,
      // Was the reaction's effect ALREADY on them when we stamped? If so the snapshot AC
      // already contains its bonus, and "did the AC move by the bonus" is unanswerable — see
      // reactionACArrived, which needs to know it cannot measure a delta.
      // ⚠ The ENTRY's name, not the found item's. On the statblock path the found item is the
      // "Spellcasting" feature, so asking about its effects answers a different question and
      // always says no.
      hadEffect: hasReactionEffect(actor, found.entry.name,
        { itemId: found.item.id, activityId: found.activity?.id }),
      answer: null, verdict: null
    });
  }
  if ( skipped.length ) {
    void attackMessage.setFlag(MODULE_ID, "holdSkipped", {
      targets: skipped, ...statContext(statSourceOf(attackMessage))
    }).catch(err => console.error(`${TITLE} | holdSkipped stamp failed.`, err));
  }
  if ( !held.length ) return false;

  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);

  // ⚠ Answers and verdicts live ON each target entry, never in a map keyed by uuid. Foundry
  // EXPANDS dotted keys when it persists an update, and every uuid contains dots — so
  // `{ "Actor.abc": "cast" }` comes back as `{ Actor: { abc: "cast" } }` and every lookup
  // silently misses forever (bit live 2026-08-15; Phase 1's receipts dodged it by accident
  // for the same reason — they are an array too).
  await attackMessage.setFlag(MODULE_ID, "hold", {
    status: "pending",
    ...statContext(statSourceOf(attackMessage)), // the data-plane stamp — the attacker's swing
    continuedBy: game.user.id,
    // The deadline is absolute and lives on the flag, so the bar is a pure function of state:
    // every client and every re-render derives the same remaining time without its own clock.
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
    targets: held
  });
  armHoldTimer(attackMessage);
  return true;
}

/**
 * Would this reaction actually change anything? A hold that cannot possibly help is a pure
 * false stop — it spends the table's attention and the player's nerve to ask a question with
 * one answer.
 *
 * ⚠ Gated on full disclosure, and that gate is not politeness. With the math hidden the player
 * is meant to decide on faith, and silently skipping the hopeless prompts would leak exactly
 * what the RAW setting withholds: a hold that never appears would tell them the attack beat
 * their AC by more than the reaction could add. Skip only when they could have worked it out
 * anyway.
 */
function holdWouldMatter(actor, found, roll, snapshotAC) {
  if ( !setting(S.holdSkipFutile) || !setting(S.holdReveal) ) return true;
  if ( found.entry.kind !== "ac" ) return true;   // damage reactions always reduce something
  // ⚠ The entry's name plus the found ids — `found.item` is the "Spellcasting" feature on a
  // statblock caster, whose effects say nothing about Shield's +5.
  const bonus = reactionACBonus(found.entry.name, actor,
    { itemId: found.item.id, activityId: found.activity?.id });
  if ( bonus == null ) return true;               // unmeasurable bonus — ask the human
  const liveAC = actor?.system?.attributes?.ac?.value ?? snapshotAC;
  if ( !Number.isFinite(liveAC) ) return true;
  return roll.total < (liveAC + bonus);           // only worth asking if it can force a miss
}
