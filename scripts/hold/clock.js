// @ts-check
/**
 * By the Books — the reaction hold: THE BUZZER. Imported by the triggers and the continuation, so
 * its `deleteChatMessage` registration comes first among the hold's.
 */
import { readFlag, isContinuingClient, queueFlagWrite } from "../core.js";
import { armAskTimer, disarmAskTimer, continuingOwns } from "../ui.js";
import { listen } from "../dispatch.js";

const armedTimers = new Map();

/** One authoritative clock, on the continuing client; re-checked at fire so a last-instant answer wins. */
export function armHoldTimer(message) {
  armAskTimer(armedTimers, message, "hold", live => fireHoldTimer(live.id), { owns: continuingOwns });
}

export function disarmHoldTimer(messageId) {
  disarmAskTimer(armedTimers, messageId);
}

/** At the buzzer every unanswered target passes. */
async function fireHoldTimer(messageId) {
  const message = game.messages.get(messageId);
  const hold = readFlag(message, "hold");
  if ( !hold || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  // Under the serializer, the guards repeated inside: an answer folded ahead of the buzzer wins.
  await queueFlagWrite(message, "hold", live => {
    if ( live.status !== "pending" ) return false;
    let expired = false;
    for ( const target of live.targets ?? [] ) {
      if ( target.answer ) continue;
      target.answer = "pass";
      target.answeredAt = Date.now();
      target.timedOut = true;
      expired = true;
    }
    if ( !expired ) return false;
  });
}

// The buzzer must not outlive its message (ui.js sweeps the popup/latch/ack state).
listen("deleteChatMessage", "hold/clock", message => {
  disarmHoldTimer(message.id);
});
