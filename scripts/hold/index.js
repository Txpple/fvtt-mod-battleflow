/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the reaction hold — Phase 1.5, a pause, NOT a
 * system. ONE machine on ONE `hold` flag whose lifecycle outgrew a file (1,564 lines), so it is
 * a DIRECTORY — the second customer of the rule the saves cut built (ruling 3, 2026-09-05):
 * one part per moment, the parts importing each other in ONE direction, and THIS file the
 * machine's only public face — the entry imports it, auto-damage.js imports its one export,
 * and the layer checker fails any outside import of a part ("import the index").
 *
 * Shield-class reactions trigger on "you are hit", BEFORE damage — and RAW the player knows
 * they were hit, not what the damage would be. Rolling damage instantly would make every
 * Shield decision perfectly informed and every fix a rewind. So the chain pauses here, and
 * a human answers. The module never plays the reaction; it only waits (DESIGN.md §4: reaction
 * automation is a permanent non-goal).
 *
 * The hold lives in a flag on the attack message — the popup and the card row are both just
 * views of it, so a reload rebuilds them and three different answer channels (the player's
 * Pass message, the player's own cast, the GM's flag flip) need no coordination at all.
 *
 * ⚠ THE IMPORT LIST BELOW IS LOAD-BEARING. The parts register their hooks as they evaluate, so
 * this order is the registration order — the one hold.js had, proven by the snapshot, with ONE
 * line moved: clock.js is imported by the triggers, so it evaluates first and its delete sweep
 * registers ahead of the rest (order-neutral — every delete handler sweeps its own key). The
 * parts are a DAG (no cycle), so a later part may import an earlier one statically; nothing
 * needs the first-listed-evaluates-LAST trick saves/index.js documents.
 */
// ⚠ Bare on purpose since (gg) retired the post-answer roll (the continuation releases the
// claim instead): the import itself still pins auto-damage.js's evaluation — and with it every
// hook registration order check-hook-order asserts — exactly where the §9 entry graph has it.
// The cycle auto-damage.js → hold/index.js → trigger.js is the one hold.js always had, safe for
// the §7 reason: a hoisted `function` declaration called at hook time (the re-export below is a
// live binding to it). PERMANENT by ruling (§10 D6).
import "../auto-damage.js";
// ⚠ ONE-WAY since D6 (2026-08-23). ui.js is the spine and no longer knows this feature exists;
// what comes back are spine primitives only. Do NOT let a hold-shaped name travel the other
// way — reinstating an `import … from "./hold/…"` in ui.js re-forms the cycle D6 broke.
// These two bare imports PIN the order hold.js's own import list had: ui.js's body (and its
// damage-offer bar registration) and effect-riders' evaluate before any part of this machine,
// so the bar still registers above the hold row (asserted in check-hook-order.mjs).
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

export { stampHoldIfInterrupted } from "./trigger.js";
