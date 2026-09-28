/**
 * Battle Flow — the only esmodules entry: it imports every machine, and nothing else. The chat log
 * is the state and the bus, no sockets, no patching (ARCHITECTURE.md §4; platform facts NOTES §2).
 */

/* ⚠ Hooks register in import order and card rows render in registration order, so a card's row
 * order follows this list (tools/check-hook-order.mjs pins it; ARCHITECTURE.md §7). The hold's
 * preApplyDamage veto runs before concentration's capture only because hold/spell-damage.js reaches
 * auto-apply.js through a LAZY import — keep it lazy. */

import "./core.js";
import "./settings.js";
import "./rule-text.js";
import "./shared.js";
import "./holds.js";
import "./events.js";
import "./polish.js";
import "./auto-damage.js";
import "./hold/index.js";
import "./ui.js";
import "./hit-riders.js";
import "./auto-apply.js";
import "./effect-riders.js";
import "./mastery.js";
// topple.js and chip-spend.js in mastery.js's slot: its rows stay above theirs.
import "./topple.js";
import "./chip-spend.js";
import "./reminders.js";
// advantage-buys.js right after reminders.js: it adds to the gate's section and overwrites its record.
import "./advantage-buys.js";
import "./rest-grants.js";
import "./drop-to-one.js";
// sneak.js after reminders.js: it reads the gate's arm; its lines sit under the gate's.
import "./sneak.js";
// clock-riders.js beside sneak.js: the same seam (preRollDamageV2).
import "./clock-riders.js";
import "./damage-shields.js";
import "./damage-casts.js";
import "./hit-menu.js";
import "./superiority-uses.js";
import "./use-chips.js";
// metamagic.js before saves/: its birth flag must exist in the preCreate the demand stamp reads.
import "./metamagic.js";
// dice-changers.js's preRollDamageV2 follows every rider's; it reads none of them.
import "./dice-changers.js";
import "./heal-rerolls.js";
// unarmed-dice.js swaps a formula at preRollDamageV2; auto-damage.js counts ROLLS, so nothing moves.
import "./unarmed-dice.js";
// fighting-styles.js beside unarmed-dice.js: Unarmed Fighting's die is theirs.
import "./fighting-styles.js";
import "./kit-tend.js";
import "./initiative-swap.js";
// ⚠ The maneuver folds after mastery.js, before concentration.js, in this relative order: rows below
// mastery's, above the saves verdict and receipts. check-hook-order.mjs asserts it.
import "./precision.js";
import "./riposte.js";
import "./hew.js";
import "./bash-offer.js";
import "./command.js";
// rebukes.js after the folds, so its card row renders below theirs.
import "./rebukes.js";
import "./damage-holds.js";
// ⚠ d20-folds.js right after the maneuver folds: its row directly below theirs (asserted).
import "./d20-folds.js";
import "./concentration.js";
import "./cast.js";
// ⚠ volleys.js after cast.js, before saves/: its row above the saves rows, and its preRollDamageV2
// must not disturb hit-riders' registration order.
import "./volleys.js";
// ⚠ saves/ before receipts.js: its verdict row above the receipts; it reaches receipts.js only by a
// lazy import(), so this position decides the order (asserted). Its index orders its parts.
import "./saves/index.js";
// emanations.js after saves/: its trigger card carries a `saves` demand (through the chat log).
import "./emanations.js";
// token-lights.js after emanations.js: its row renders beneath the use's own rows.
import "./token-lights.js";
import "./receipts.js";
// resources.js last among the rows: its spend line is the usage card's footer.
import "./resources.js";
// stats.js renders no rows; at the end so the pinned order is unchanged.
import "./stats.js";
import "./effect-view.js";
