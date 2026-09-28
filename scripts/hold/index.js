// @ts-check
/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the reaction hold — a pause, NOT a system: the chain
 * pauses on "you are hit" and a human answers (DESIGN.md §4). One `hold` flag on the attack message;
 * a DIRECTORY whose only public face is this file (the layer checker enforces it). The parts' hooks
 * run in dispatch.js's ORDER; cross-part calls are hoisted functions, which keeps the cycle through
 * auto-damage.js safe.
 */
import "./lookup.js";
import "./clock.js";
import "./trigger.js";
import "./spell-hold.js";
import "./answer.js";
import "./continue.js";
import "./spell-damage.js";
import "./views.js";
import "./dice.js";

export { stampHoldIfInterrupted } from "./trigger.js";
