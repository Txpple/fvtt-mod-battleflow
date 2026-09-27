/**
 * Battle Flow — the reaction hold: THE ATTACK TRIGGER. "You are hit" reactions fire BEFORE damage,
 * so the chain pauses and a human answers; the module never plays the reaction (DESIGN.md §4).
 */
import { MODULE_ID, TITLE, S, setting, drivesMomentFor, statContext, decisionWindow } from "../core.js";
import { spendReaction, statSourceOf } from "../shared.js";
import { findInterrupt, hasReactionEffect, reactionACBonus, rescueStateOf, protectionGuardsOf } from "./lookup.js";
import { armHoldTimer } from "./clock.js";

// Any reaction use writes the reaction-spent chip (ARCHITECTURE.md §6); the reactor's own client
// writes it when no GM is on.
Hooks.on("dnd5e.postUseActivity", activity => {
  if ( !drivesMomentFor(activity?.actor?.uuid ?? null) ) return;
  if ( activity?.activation?.type !== "reaction" ) return;
  void spendReaction(activity.actor, { origin: activity.item?.uuid ?? null, what: activity.item?.name ?? "a Reaction" });
});

/** Stamp the hold and return true if any hit target has something to ask; the stamping client continues it. */
export async function stampHoldIfInterrupted(attackMessage, roll, hits) {
  if ( attackMessage.getFlag(MODULE_ID, "hold") ) return true; // already held; never re-stamp

  const held = [];
  const skipped = [];
  for ( const target of hits ) {
    const actor = await fromUuid(target.uuid);
    let found = await findInterrupt(actor, { isCritical: roll.isCritical });
    let futile = false;
    if ( found && !holdWouldMatter(actor, found, roll, target.ac) ) {
      // Skipped silently, recorded for the stats.
      skipped.push({ uuid: target.uuid, name: target.name, reaction: found.entry.name });
      futile = true;
      found = null;
    }
    // Every Disadvantage the defender holds rides beside the reaction (RULINGS *Rescuing the hit*).
    const rescue = await rescueStateOf(actor, roll, { found, hidePrimary: futile });
    // Protection from a creature beside this one, each in its own popup.
    const guards = protectionGuardsOf(actor, attackMessage.getAssociatedActor?.() ?? null);
    const guardFields = guards.length ? { guards } : {};
    if ( !found && !rescue?.live && !guards.length ) continue;
    const rescueFields = rescue ? { rows: rescue.rows, rescues: rescue.records } : {};
    if ( !found && !rescue?.live ) {
      // Only the guards are asked.
      held.push({ uuid: target.uuid, name: target.name, ac: target.ac,
        reaction: guards[0].row, kind: "roll", itemId: null, activityId: null, selfAsk: false,
        hadEffect: false, ...guardFields, answer: null, verdict: null });
      continue;
    }
    if ( !found ) {
      // The first live `roll` row stands as the hold's own, so `reaction`/`itemId` name a real ability.
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
      ...(found.reduce ? { reduce: found.reduce } : {}),
      // ⚠ The ids, not a name: a statblock casts Shield from a feature's cast activity.
      itemId: found.item.id, activityId: found.activity?.id ?? null,
      // Already on them: the snapshot AC holds the bonus, no delta to measure.
      // ⚠ The ENTRY's name: on a statblock the found item is "Spellcasting".
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

  const window = decisionWindow();

  // ⚠ Answers live ON each target entry, never a uuid-keyed map: Foundry expands dotted keys on write.
  await attackMessage.setFlag(MODULE_ID, "hold", {
    status: "pending",
    ...statContext(statSourceOf(attackMessage)),
    continuedBy: game.user.id,
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
    // A crit a live Disadvantage can undo: the dice wait for the answer.
    ...((roll.isCritical && held.some(t => t.rows?.some(r => (r.kind === "roll") && !r.off) || t.guards?.length)) ? { critAtStake: true } : {}),
    targets: held
  });
  armHoldTimer(attackMessage);
  return true;
}

/**
 * Would this reaction change anything? ⚠ Only judged with the math revealed: otherwise a skipped
 * prompt leaks that the attack beat the AC by more than the reaction adds.
 */
function holdWouldMatter(actor, found, roll, snapshotAC) {
  if ( !setting(S.holdReveal) ) return true;
  if ( found.entry.kind !== "ac" ) return true;   // damage reactions always reduce something
  // ⚠ The entry's name plus the found ids: `found.item` may be a statblock's "Spellcasting".
  const bonus = reactionACBonus(found.entry.name, actor,
    { itemId: found.item.id, activityId: found.activity?.id });
  if ( bonus == null ) return true;               // unmeasurable bonus — ask the human
  const liveAC = actor?.system?.attributes?.ac?.value ?? snapshotAC;
  if ( !Number.isFinite(liveAC) ) return true;
  return roll.total < (liveAC + bonus);           // only worth asking if it can force a miss
}
