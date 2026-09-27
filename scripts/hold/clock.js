/**
 * Battle Flow — the reaction hold, part 2: THE BUZZER, and the clock's own delete sweep (the
 * popup/latch/ack sweep is the spine's, ui.js). Imported by the triggers and the continuation,
 * so its `deleteChatMessage` registration comes first among the hold's.
 */
import { MODULE_ID, isContinuingClient } from "../core.js";
import { armDeadline, disarmDeadline } from "../ui.js";

const armedTimers = new Map();

/**
 * Arm the hold's buzzer: one authoritative clock on the client that owns the continuation,
 * re-checked when it fires so an answer in the last instant wins.
 */
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
    target.answeredAt = Date.now();
    target.timedOut = true;
    expired = true;
  }
  if ( !expired ) return;
  await message.setFlag(MODULE_ID, "hold", merged);
}

// The buzzer must not outlive its message. The popup/latch/ack state is swept by ui.js, by prefix.
Hooks.on("deleteChatMessage", message => {
  disarmHoldTimer(message.id);
});
