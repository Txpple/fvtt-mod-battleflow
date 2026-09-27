/**
 * Battle Flow — the reaction hold, part 3: THE ATTACK TRIGGER. The reaction-spent chip on any
 * reaction use, and `stampHoldIfInterrupted` (re-exported by index.js) with the futile-hold gate.
 * Shield-class reactions trigger on "you are hit", BEFORE damage, so the chain pauses and a human
 * answers; the module never plays the reaction (DESIGN.md §4).
 */
import { MODULE_ID, TITLE, S, setting, drivesMomentFor, statContext } from "../core.js";
import { spendReaction, statSourceOf } from "../shared.js";
import { findInterrupt, hasReactionEffect, reactionACBonus, rescueStateOf, protectionGuardsOf } from "./lookup.js";
import { armHoldTimer } from "./clock.js";

// Any reaction use writes the reaction-spent chip (shared.js `spendReaction`, ARCHITECTURE.md §6),
// clocked to the actor's next turn; out of combat nothing is written.
Hooks.on("dnd5e.postUseActivity", activity => {
  // The reactor's own client writes it when no GM is on: a reaction is nearly always a PC's.
  if ( !setting(S.reactionHold) ) return;
  if ( !drivesMomentFor(activity?.actor?.uuid ?? null) ) return;
  if ( activity?.activation?.type !== "reaction" ) return;
  void spendReaction(activity.actor, { origin: activity.item?.uuid ?? null, what: activity.item?.name ?? "a Reaction" });
});

/**
 * If any hit target holds a usable interrupt, stamp the hold and return true (the damage's
 * application waits for it). The stamping client, the attacker's, records itself as the continuer.
 */
export async function stampHoldIfInterrupted(attackMessage, roll, hits) {
  if ( !setting(S.reactionHold) ) return false;
  if ( attackMessage.getFlag(MODULE_ID, "hold") ) return true; // already held; never re-stamp

  const held = [];
  const skipped = [];
  for ( const target of hits ) {
    const actor = await fromUuid(target.uuid);
    let found = await findInterrupt(actor, { isCritical: roll.isCritical });
    let futile = false;
    if ( found && !holdWouldMatter(actor, found, roll, target.ac) ) {
      // A hopeless hold is skipped silently at the table but recorded for the stats (`holdSkipped`).
      skipped.push({ uuid: target.uuid, name: target.name, reaction: found.entry.name });
      futile = true;
      found = null;
    }
    // The `roll` rows: every Disadvantage the defender holds rides beside the reaction in one popup
    // (RULINGS *Rescuing the hit*), and holds even where the reaction would not.
    const rescue = await rescueStateOf(actor, roll, { found, hidePrimary: futile });
    // The guards: Protection from a creature beside this one, each asked in its own popup.
    const guards = protectionGuardsOf(actor, attackMessage.getAssociatedActor?.() ?? null);
    const guardFields = guards.length ? { guards } : {};
    // Nothing live: no popup.
    if ( !found && !rescue?.live && !guards.length ) continue;
    const rescueFields = rescue ? { rows: rescue.rows, rescues: rescue.records } : {};
    if ( !found && !rescue?.live ) {
      // Only the guards are asked: the defender itself has nothing to take (`selfAsk: false`).
      held.push({ uuid: target.uuid, name: target.name, ac: target.ac,
        reaction: guards[0].row, kind: "roll", itemId: null, activityId: null, selfAsk: false,
        hadEffect: false, ...guardFields, answer: null, verdict: null });
      continue;
    }
    if ( !found ) {
      // The first live `roll` row stands as the hold's own, so `reaction` / `itemId` name a real ability.
      const first = rescue.records.find(r => !rescue.rows.find(x => x.key === r.name)?.off);
      held.push({ uuid: target.uuid, name: target.name, ac: target.ac,
        reaction: first.name, kind: "roll", itemId: first.itemId, activityId: first.activityId,
        hadEffect: false, ...rescueFields, ...guardFields, answer: null, verdict: null });
      continue;
    }
    held.push({
      ...rescueFields, ...guardFields,
      uuid: target.uuid, name: target.name, ac: target.ac,
      reaction: found.entry.name, kind: found.entry.kind,
      // A reduction reaction (Parry): the formula the answer rolls, off the pack (N1).
      ...(found.reduce ? { reduce: found.reduce } : {}),
      // ⚠ The ids, not a name: a statblock casts Shield from a feature's cast activity, so a name
      // lookup at Cast time finds the wrong document.
      itemId: found.item.id, activityId: found.activity?.id ?? null,
      // Already on them at the stamp? Then the snapshot AC holds the bonus and reactionACArrived
      // cannot measure a delta. ⚠ The ENTRY's name: on a statblock the found item is "Spellcasting".
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

  // ⚠ Answers live ON each target entry, never in a uuid-keyed map: Foundry expands dotted keys on
  // write, so `{ "Actor.abc": … }` comes back as `{ Actor: { abc: … } }`.
  await attackMessage.setFlag(MODULE_ID, "hold", {
    status: "pending",
    ...statContext(statSourceOf(attackMessage)),
    continuedBy: game.user.id,
    // An absolute deadline on the flag: every client derives the same bar with no clock of its own.
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
    // A crit a live Disadvantage can undo: the dice wait for the answer (auto-damage.js).
    ...((roll.isCritical && held.some(t => t.rows?.some(r => (r.kind === "roll") && !r.off) || t.guards?.length)) ? { critAtStake: true } : {}),
    targets: held
  });
  armHoldTimer(attackMessage);
  return true;
}

/**
 * Would this reaction change anything? A hopeless hold is a false stop.
 * ⚠ Only with the math revealed: with it hidden, a skipped prompt would leak that the attack beat
 * the AC by more than the reaction could add.
 */
function holdWouldMatter(actor, found, roll, snapshotAC) {
  if ( !setting(S.holdSkipFutile) || !setting(S.holdReveal) ) return true;
  if ( found.entry.kind !== "ac" ) return true;   // damage reactions always reduce something
  // ⚠ The entry's name plus the found ids: `found.item` may be a statblock's "Spellcasting".
  const bonus = reactionACBonus(found.entry.name, actor,
    { itemId: found.item.id, activityId: found.activity?.id });
  if ( bonus == null ) return true;               // unmeasurable bonus — ask the human
  const liveAC = actor?.system?.attributes?.ac?.value ?? snapshotAC;
  if ( !Number.isFinite(liveAC) ) return true;
  return roll.total < (liveAC + bonus);           // only worth asking if it can force a miss
}
