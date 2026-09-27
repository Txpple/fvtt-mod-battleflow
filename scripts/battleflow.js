/**
 * Battle Flow — combat resolution that flows (DESIGN.md is the north star). The only esmodules
 * entry: it imports every machine, and nothing else.
 * The chat log is the state and the bus (ARCHITECTURE.md §4): no sockets, no in-memory workflow,
 * no patching; the chain is resolved through dnd5e's own message registry. The platform facts the
 * machines stand on are NOTES §2.
 */

/* ⚠ Hooks register in module evaluation order (import-graph order, which this list drives), and
 * renderChatMessage rows render in registration order, so a card's row order follows this list
 * (tools/check-hook-order.mjs pins it; ARCHITECTURE.md §7). The hold's preApplyDamage veto before
 * concentration's cause capture is held by hold/spell-damage.js reaching auto-apply.js through a
 * LAZY import — keep it lazy. */

import "./core.js";
import "./settings.js";
import "./shared.js";
import "./holds.js";
import "./events.js";   // the moment events: what the module PUBLISHES at a resolve
import "./polish.js";
import "./auto-damage.js";
import "./hold/index.js";
import "./ui.js";
import "./hit-riders.js";
import "./auto-apply.js";
import "./effect-riders.js";
import "./mastery.js";
// topple.js and chip-spend.js sit in mastery.js's slot: its rows stay above theirs on an attack card.
import "./topple.js";
import "./chip-spend.js";
import "./reminders.js";
// advantage-buys.js right after reminders.js: it adds its box to the section the gate just drew,
// and its record overwrites the gate's with the buy in.
import "./advantage-buys.js";
import "./rest-grants.js";
import "./drop-to-one.js";
// sneak.js after reminders.js: the gate stamps the arm on the attack, sneak reads it at the damage
// roll; its card lines sit under the gate's.
import "./sneak.js";
// clock-riders.js beside sneak.js: the same seam (preRollDamageV2).
import "./clock-riders.js";
import "./damage-shields.js";
import "./damage-casts.js";
import "./hit-menu.js";
import "./superiority-uses.js";
// use-chips.js: a text-only feature's use becomes a chip the gate reads.
import "./use-chips.js";
// metamagic.js before saves/: its birth flag must exist on the same preCreate cycle the demand
// stamp reads.
import "./metamagic.js";
// dice-changers.js registers its preRollDamageV2 after every rider's, which is nothing it reads:
// the weapon's roll count is auto-damage.js's, taken first.
import "./dice-changers.js";
// heal-rerolls.js: the damage machines' seams on a HEALING roll; cast.js's heal applier waits on its claim.
import "./heal-rerolls.js";
// unarmed-dice.js swaps the Unarmed Strike's formula at preRollDamageV2; auto-damage.js counts
// ROLLS, not parts, so the swap moves nothing it counts.
import "./unarmed-dice.js";
// fighting-styles.js beside unarmed-dice.js: Unarmed Fighting's die is theirs.
import "./fighting-styles.js";
import "./kit-tend.js";
import "./initiative-swap.js";
// ⚠ The maneuver folds after mastery.js, before concentration.js ON PURPOSE: their rows render
// below the mastery rows and above the saves verdict and receipt rows. These five keep the
// relative order one file once held. check-hook-order.mjs asserts it.
import "./precision.js";
import "./riposte.js";
import "./hew.js";
import "./bash-offer.js";
import "./command.js";
// rebukes.js after the folds, so its card row renders below theirs.
import "./rebukes.js";
// damage-holds.js: a reduction "when you take damage", claimed at the applier for every damage landed.
import "./damage-holds.js";
// ⚠ d20-folds.js right after the maneuver folds ON PURPOSE: the same family of post-roll fold,
// its row directly below theirs (Precision and a Bardic die patch the same missed attack).
// check-hook-order.mjs asserts the pair.
import "./d20-folds.js";
import "./concentration.js";
import "./cast.js";
// ⚠ volleys.js after cast.js, before saves/ ON PURPOSE: its row renders above the saves rows, and
// its preRollDamageV2 dart multiplier must not disturb hit-riders' registration order.
import "./volleys.js";
// ⚠ saves/ before receipts.js ON PURPOSE: its verdict row renders above the receipt rows, and it
// reaches receipts.js only through a lazy import(), so this position decides the order.
// check-hook-order.mjs asserts it. The entry imports the index only; its list orders the parts.
import "./saves/index.js";
// emanations.js after saves/: its trigger card carries a `saves` demand the saves machine drives
// (through the chat log, no import); it renders no row on a shared card.
import "./emanations.js";
// token-lights.js after emanations.js: its card row renders beneath the use's own rows.
import "./token-lights.js";
import "./receipts.js";
// resources.js last among the rows: its spend line is the usage card's footer.
import "./resources.js";
// stats.js renders no rows; at the end so the machines' pinned order is unchanged.
import "./stats.js";
// The effect view: a view over the sheet, writes nothing.
import "./effect-view.js";
