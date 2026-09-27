// Testing utility: strip every TEMPORARY effect (chips and statuses) from every token actor on the
// canvas, then LONG REST each. ⚠ A full board reset, monsters included: never mid-fight.
// Batch-deleted per actor in one call: an unlinked token's synthetic actor rebuilds its collections
// on every write, so one-at-a-time deletes throw on the second id.
// ⚠ dialog:false (longRest pops one dialog PER actor otherwise); chat:false (one summary, not N cards).
// It acts on TOKEN actors: an unlinked token rests as its synthetic actor; check the token, not the directory.
if ( !canvas?.scene ) { ui.notifications.warn("No active scene."); return; }

// Snapshot the actors first (placeables is live, a rest redraws tokens), deduped by uuid (a linked
// actor's tokens share one document).
const actors = [];
const seen = new Set();
for ( const token of canvas.tokens.placeables ) {
  const actor = token.actor;
  if ( !actor || seen.has(actor.uuid) ) continue;
  seen.add(actor.uuid);
  actors.push(actor);
}

let cleared = 0, clearedOn = 0, rested = 0, skipped = 0;
const failed = [];
for ( const actor of actors ) {
  try {
    // Effects first, so the rest restores the real pool, not a buffed one.
    // ⚠ statuses.size is needed: a bare condition (no duration) reports isTemporary falsy.
    const ids = actor.effects.filter(e => e.isTemporary || e.statuses.size).map(e => e.id);
    if ( ids.length ) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
      cleared += ids.length;
      clearedOn += 1;
    }
    // ⚠ initiateRest returns undefined when it bails (a vehicle, a preLongRest veto): not a success.
    const result = await actor.longRest({ dialog: false, chat: false });
    if ( result ) rested += 1;
    else skipped += 1;
  } catch(err) {
    failed.push(actor.name);
    console.error("Clear Temp Effects + Full Rest |", actor.name, err);
  }
}

ui.notifications.info(
  `Battle Flow: cleared ${cleared} temporary effect(s) across ${clearedOn} actor(s), `
  + `long-rested ${rested} of ${actors.length} on ${canvas.scene.name}.`
  + (skipped ? ` ${skipped} skipped the rest (vehicle, or a module blocked it).` : "")
  + (failed.length ? ` ${failed.length} FAILED (${failed.join(", ")}) — see console.` : "")
);
