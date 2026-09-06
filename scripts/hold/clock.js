/**
 * Battle Flow — the reaction hold, part 2: THE BUZZER. One authoritative clock, armed by the
 * client that owns the continuation and re-checked at the buzzer, and this machine's own
 * delete sweep (the popup/latch/ack half of the sweep is the spine's, ui.js). Imported by the
 * triggers and the continuation, so it evaluates before them — its `deleteChatMessage` line
 * sits FIRST among the hold's registrations (the one line the directory moved; order-neutral,
 * every delete handler in the tree sweeps its own key).
 */
import { MODULE_ID, isContinuingClient } from "../core.js";
import { armDeadline, disarmDeadline } from "../ui.js";

/**
 * The hold's buzzer. Armed by whichever client owns the continuation — one authoritative
 * clock, not a cross-client timeout — and re-checked at the buzzer, because an answer landing
 * in the last instant must beat the timer rather than race it.
 */
const armedTimers = new Map();

export function armHoldTimer(message) {
  const hold = message?.getFlag(MODULE_ID, "hold");
  if ( !hold?.deadline || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  armDeadline(armedTimers, message.id, hold.deadline, fireHoldTimer);
}

export function disarmHoldTimer(messageId) {
  disarmDeadline(armedTimers, messageId);
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
    target.answeredAt = Date.now();     // the buzzer's moment is an answer time too
    target.timedOut = true;
    expired = true;
  }
  if ( !expired ) return;
  await message.setFlag(MODULE_ID, "hold", merged);
}

// This file's own delete sweep — the buzzer must not outlive the message it was counting for.
// ⚠ The popup/latch/ack half of the old combined sweep stayed in ui.js: it is the SPINE's, it
// clears every machine's state off one `${messageId}|` prefix, and splitting that would be the
// five-per-machine drift it was built to collapse. This is only the clock.
Hooks.on("deleteChatMessage", message => {
  disarmHoldTimer(message.id);   // no message, no hold, nothing for the buzzer to pass
});
