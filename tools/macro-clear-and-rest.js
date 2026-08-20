// Testing utility: strip every TEMPORARY effect (duration'd chips + statuses) from every token
// actor on the current canvas, then LONG REST every one of them. Batch-deleted per actor in ONE
// call — an unlinked token's synthetic actor rebuilds its collections on every write, so
// one-at-a-time deletes throw "does not exist" on the second id.
//
// ⚠ FULL BOARD RESET, MONSTERS INCLUDED (user's call 2026-08-19). The long rest restores every
// NPC on the scene as well — spell slots, features, hit dice, hit points, legendary resistances.
// That is what makes it a reset button, and exactly why it is the wrong button to press in the
// middle of a fight.
//
// ⚠ Two flags are load-bearing, both measured against dnd5e 5.3.3's initiateRest:
//   dialog:false — longRest() defaults dialog TRUE and would pop one configuration dialog PER
//                  ACTOR, which on a populated scene is unusable.
//   chat:false   — one summary beats N rest cards in the log.
// Long rest also carries newDay:true and exhaustionDelta:-1 from CONFIG.DND5E.restTypes.long
// (both wanted, both RAW) and does NOT advance the world clock.
//
// ⚠ It acts on TOKEN actors, so an unlinked token is rested as its own synthetic actor and the
// base actor in the sidebar is untouched. That is the correct target — it is what is on the
// board — but it means "did it work?" must be checked on the token, not in the directory.
if ( !canvas?.scene ) { ui.notifications.warn("No active scene."); return; }

// Snapshot the actors BEFORE mutating anything: canvas.tokens.placeables is live and a rest
// redraws tokens (HP bar, status icons). Deduped by uuid because several tokens of one LINKED
// actor share a single document — an unlinked token's synthetic actor has its own uuid and so
// is correctly treated as separate.
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
    // Effects first, then the rest: clearing a max-HP or temp-HP effect before resting is what
    // makes the restored pool the real one rather than the buffed one.
    const ids = actor.effects.filter(e => e.isTemporary).map(e => e.id);
    if ( ids.length ) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
      cleared += ids.length;
      clearedOn += 1;
    }
    // ⚠ initiateRest returns UNDEFINED when it bails — a vehicle, or any module vetoing the
    // dnd5e.preLongRest hook — and an object when it actually rested. Counting a bail as a
    // success made this summary lie during the build (it said "long-rested 2 of 2" for a rest
    // that had not happened), which is the whole reason the macro reports numbers at all.
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
