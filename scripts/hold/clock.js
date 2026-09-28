/**
 * Battle Flow — the reaction hold: THE BUZZER. Imported by the triggers and the continuation, so
 * its `deleteChatMessage` registration comes first among the hold's.
 */
import { MODULE_ID, isContinuingClient } from "../core.js";
import { armDeadline, disarmDeadline } from "../ui.js";
import { listen } from "../dispatch.js";

const armedTimers = new Map();

/** One authoritative clock, on the continuing client; re-checked at fire so a last-instant answer wins. */
export function armHoldTimer(message) {
  const hold = message?.getFlag(MODULE_ID, "hold");
  if ( !hold?.deadline || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  armDeadline(armedTimers, message.id, hold.deadline, fireHoldTimer);
}

export function disarmHoldTimer(messageId) {
  disarmDeadline(armedTimers, messageId);
}

/** At the buzzer every unanswered target passes. */
async function fireHoldTimer(messageId) {
  const message = game.messages.get(messageId);
  const hold = message?.getFlag(MODULE_ID, "hold");
  if ( !hold || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  const merged = foundry.utils.deepClone(hold);
  let expired = false;
  for ( const target of merged.targets ) {
    if ( target.answer ) continue;
    target.answer = "pass";
    target.answeredAt = Date.now();
    target.timedOut = true;
    expired = true;
  }
  if ( !expired ) return;
  await message.setFlag(MODULE_ID, "hold", merged);
}

// The buzzer must not outlive its message (ui.js sweeps the popup/latch/ack state).
listen("deleteChatMessage", "hold/clock", message => {
  disarmHoldTimer(message.id);
});
