/**
 * Battle Flow — combat resolution that flows (design.md is the north star).
 *
 * Phase 1: the attack resolver. Two independent halves plus receipts, each behind its own
 * world setting (Game Settings → Configure Settings → Battle Flow), all default OFF:
 *
 *   - Auto-Roll Damage on Hit: when an attack roll resolves on the attacker's own client,
 *     re-run the system's hit test against the targets snapshotted on the attack message and,
 *     if at least one target was hit, press the card's Damage button programmatically —
 *     ammo/attack-mode recovery identical to the native handler, crit pre-configured, no
 *     dialog. A miss means the damage dice never exist. Modes: off / NPC attacks only /
 *     everyone, plus an optional "dramatic beat" delay between hit reveal and damage dice.
 *   - Auto-Apply Damage: on the active GM's client (single writer), a damage-roll message
 *     that chains back to an attack applies itself to the targets that attack hit, through
 *     the system's own resistance/immunity/threshold math (Actor5e#applyDamage) — exactly
 *     what the GM-only damage tray does, pressed automatically. The tray stays rendered and
 *     remains the manual path for corrections and edge calls — but it collapses on the
 *     applied card exactly as if Apply had been pressed (same setting guard), so an already-
 *     applied roll is never one accidental click away from landing twice.
 *   - Receipts + revert: every application stamps what it did (per-target prior HP snapshot,
 *     deltas, and WHY the number moved — immune/resists/vulnerable/threshold, read from the
 *     system's own calculateDamage annotations) into a flag on the damage message. The card
 *     grows a receipt row everyone can read — who took what, and the reason when traits
 *     changed the number — while HP pools and the per-target ↩ revert stay GM-only.
 *     Idempotent and reload-proof: the flag is the state, the row is just a view of it.
 *   - Effect riders (Phase 1.9A): a hit applies the effects riding it — the attack
 *     activity's own effect list lands on the targets it hit through the native application
 *     path (same origin rules, same re-enable-instead-of-stack), per target, with a
 *     per-effect receipt + revert on the damage card. Ray of Frost's slow arrives with its
 *     damage instead of waiting for a click in the card's tray.
 *   - The reaction hold (Phase 1.5): when an attack hits someone holding a curated interrupt
 *     reaction, the chain pauses instead of resolving — popup for whoever owns the decision,
 *     durable row on the attack card, GM override, and a re-test against the target's LIVE
 *     AC once answered (a Shield that turns the hit into a miss ends the chain and the
 *     damage dice never exist). The module waits for a human; it never plays the reaction.
 *   - Table polish (first dogfood feedback, 2026-08-15; recut 2026-08-17): a no-target gate
 *     that cancels an attack before anything rolls or consumes ("popup error, then exit
 *     out"), hidden card action buttons (every use posts its first card, the machine runs
 *     the workflows — only Refund Resource and Place Measured Template stay pressable), and
 *     a per-client setting that centers the system's roll dialogs instead of lower-right.
 *     The card SUPPRESSION machinery was removed at v1.10.0 (design.md §5 Phase 1.1).
 *   - Concentration assist (Phase 2.5): a concentrating creature that takes damage gets the
 *     save run instead of a whisper card nobody reads — popup (or silent auto-roll) on the
 *     owner's client, DC from the system, and on a failure the module presses the button the
 *     system never presses itself: endConcentration, whose native cascade strips everything
 *     riding the spell. At 0 HP there is no save; concentration just ends, announced.
 *
 * Architecture (design.md §4): the chat log is the state and the bus. No sockets, no
 * in-memory workflow object, no patching. The attacker's client volunteers the damage roll
 * (its attack, its dice); the active-GM elect volunteers the application (ownership is a
 * permission fact; a single writer prevents double-apply); the chain is resolved through the
 * system's own message registry (flags.dnd5e.originatingMessage), never a parallel one.
 *
 * Ground truths (dnd5e release-5.3.3 = commit 965ad2d, on Foundry v14):
 *   - dnd5e.rollAttackV2 fires on the rolling client only, after the attack message exists
 *     and before ammo consumption; rolls[0].parent IS the attack message (basic-roll.mjs
 *     buildPost assigns it whenever a message document was created).
 *   - Hit/miss is computed at render time and never persisted (chat-message.mjs:463):
 *     isMiss = !crit && ((total < ac) || fumble). Downstream consumers must recompute.
 *   - flags.dnd5e.targets = [{uuid, name, img, ac}] where uuid is the target ACTOR's uuid
 *     (utils.mjs getTargetDescriptors) and ac is null under total cover.
 *   - flags.dnd5e.originatingMessage is natively stamped from the DOM click's enclosing card
 *     (basic-roll.mjs:173); a programmatic roll MUST pass it in message data explicitly or
 *     the roll never enters dnd5e.registry.messages and the chain breaks.
 *   - The native damage tray builds damages via aggregateDamageRolls(rolls,
 *     {respectProperties: true}) → {value, type, properties: Set} and applies with
 *     actor.applyDamage(damages, {multiplier: 1, isDelta: true, originatingMessage, origin})
 *     (damage-application.mjs:335). Mirrored verbatim so the system's math stays
 *     authoritative. Healing activities mark their rolls "healing", never "damage".
 *   - applyDamage writes system.attributes.hp.{value,temp,tempmax}. Receipts snapshot the
 *     SOURCE values (actor.system._source): Actor#update writes source data, and derived
 *     values can carry active-effect noise that a later revert must not bake in.
 *   - dnd5e.renderChatMessage (message, html) fires after all system card enrichment — the
 *     seam the receipt row renders on.
 */

/* ---------------------------------------------------------------------------------------------
 * The entry (design.md §9): the only esmodules entry, importing every sibling in the original
 * section order. Plain ES imports — no build step, no manifest change. Evaluation order is
 * import-graph order, not this list; the one registration-order constraint that matters (the
 * hold's preApplyDamage veto before concentration's cause capture) is held by hold.js reaching
 * auto-apply.js through a lazy import — see the comment at that call site before making it
 * static.
 * ------------------------------------------------------------------------------------------- */

import "./core.js";
import "./settings.js";
import "./shared.js";
import "./polish.js";
import "./auto-damage.js";
import "./hold.js";
import "./ui.js";
import "./hit-riders.js";
import "./auto-apply.js";
import "./effect-riders.js";
import "./mastery.js";
// ⚠ maneuvers.js after mastery.js, before concentration.js ON PURPOSE (v1.19.0): its card
// rows must render below the mastery rows and above the saves verdict row / receipt rows —
// renderChatMessage surface order IS registration order. check-hook-order.mjs asserts it.
import "./maneuvers.js";
import "./concentration.js";
import "./cast.js";
// ⚠ saves.js before receipts.js ON PURPOSE: its verdict row must register (and so render)
// above the receipt rows, and it reaches receipts.js only through a lazy import() so this
// entry position is what actually decides the order. check-hook-order.mjs asserts it.
import "./saves.js";
import "./receipts.js";
