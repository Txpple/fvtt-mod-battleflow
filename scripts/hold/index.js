/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the reaction hold — a pause, NOT a system. One
 * machine on one `hold` flag, a DIRECTORY: one part per moment, importing each other one way, and
 * THIS file its only public face (the layer checker fails any outside import of a part).
 * Shield-class reactions trigger on "you are hit", BEFORE damage, so the chain pauses and a human
 * answers; the module never plays the reaction (DESIGN.md §4). The hold lives on the attack
 * message; popup and card row are views of it, so every answer channel needs no coordination.
 * ⚠ THE IMPORT LIST IS LOAD-BEARING: parts register hooks as they evaluate, so this order is the
 * registration order (check-hook-order). The parts are a DAG; clock.js evaluates first via
 * trigger.js, which is order-neutral.
 */
// ⚠ Bare on purpose: this import pins auto-damage.js's evaluation, and with it the registration
// order check-hook-order asserts. The cycle auto-damage.js → hold/index.js → trigger.js is safe:
// a hoisted `function` called at hook time (the re-export below is a live binding). ARCHITECTURE §10.
import "../auto-damage.js";
// ⚠ ONE-WAY: ui.js is the spine and knows nothing of the hold; importing anything under hold/ from
// ui.js re-forms a cycle. These two bare imports make ui.js (and its damage-offer bar) and
// effect-riders.js evaluate before any part, so the bar registers above the hold row.
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
