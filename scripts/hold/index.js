/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the reaction hold — a pause, NOT a system: the chain
 * pauses on "you are hit" and a human answers (DESIGN.md §4). One `hold` flag on the attack message;
 * a DIRECTORY whose only public face is this file (the layer checker enforces it).
 * ⚠ THE IMPORT LIST IS LOAD-BEARING: it is the parts' hook registration order (check-hook-order).
 */
// ⚠ Bare on purpose: pins auto-damage.js's evaluation (the asserted order). The cycle through
// trigger.js is safe: a hoisted `function` called at hook time. ARCHITECTURE §10.
import "../auto-damage.js";
// ⚠ ONE-WAY: ui.js must never import hold/. These make ui.js and effect-riders.js evaluate before
// any part, so the damage-offer bar registers above the hold row.
import "../ui.js";
import "../effect-riders.js";

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
