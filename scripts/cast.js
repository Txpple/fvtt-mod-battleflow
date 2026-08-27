/**
 * Battle Flow — Phase 3 (cast slice): the elect executes a stamped cast payload - utility effects and healing, receipts throughout.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, isActiveGM } from "./core.js";
import { damagePartsOf, statSourceOf } from "./shared.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { applyEffectsWithReceipt } from "./effect-riders.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 3 (cast slice) — auto-apply on cast (ARCHITECTURE.md §6, pulled ahead 2026-08-16).
 *
 * A used activity with no outcome gate resolves at cast, on the elect: a utility activity's
 * effects land on every snapshot target (Bless, Mark Creature / Move Mark, Heroism), and a
 * heal activity's self-rolled healing lands through the shared applier — calculateDamage
 * negates healing-typed entries natively, and the "maximum"/"temphp" types ride the same
 * treatAs plumbing off the roll message we pass as originatingMessage (actor.mjs:807/:868).
 * Receipts + revert everywhere, as always.
 *
 * The bus: the STAMP is the trigger, never the setting. preCreate (initiating client) stamps
 * the `castApply` payload on a qualifying usage card — always the native card since v1.10.0
 * (the suppression machinery and its replacement bfCard are gone) — and `healPending` on a
 * targeted healing roll. The elect reacts to the flag from createChatMessage AND from the
 * render hook (the reload-resume discipline the v1.3.1 review established): an unstamped
 * message can never be applied, so rendering last week's log is inert by construction.
 *
 * Deliberately OUT: save activities (Phase 2 — their cards are load-bearing), bare damage
 * activities (Magic Missile is the negate hold's seam — auto-apply would beat a pending
 * hold's verdict), and enchant/summon/forward (not effects-on-target casts).
 * ------------------------------------------------------------------------------------------- */

/** Same-client concurrency latch — create + render can fire in one tick, same as the
 * mastery ask's executions latch and for the same reason. */
const castExecutions = new Set();

async function executeCastApply(message) {
  if ( castExecutions.has(message.id) ) return;
  castExecutions.add(message.id);
  try {
    const payload = message.getFlag(MODULE_ID, "castApply");
    if ( !payload?.targets?.length ) return;
    if ( message.getFlag(MODULE_ID, "effectReceipt")?.castDone ) return;
    const activity = payload.activityUuid ? await fromUuid(payload.activityUuid) : null;
    const effects = activity?.applicableEffects ?? [];
    if ( !effects.length ) return;
    // The caster's concentration effect, for origin linkage — the tray's own rule
    // (concentration ?? effect); the riders' origin walk handles both shapes downstream.
    const concentration = payload.concentration
      ? (activity?.actor?.effects.get(payload.concentration) ?? null) : null;
    await applyEffectsWithReceipt(message, effects, payload.targets, {
      concentration, scaling: payload.scaling ?? 0,
      spellLevel: payload.spellLevel ?? undefined,
      marker: "castDone",
      source: statSourceOf(message) // the data-plane stamp — the caster's own usage card
    });
  } catch(err) {
    console.error(`${TITLE} | Cast auto-apply failed.`, err);
  } finally {
    castExecutions.delete(message.id);
  }
}

async function applyCastHealing(message) {
  const key = `heal:${message.id}`;
  if ( castExecutions.has(key) ) return;
  castExecutions.add(key);
  try {
    if ( message.getFlag(MODULE_ID, "receipt") ) return; // applied (or reverted) already
    // A SELF-aimed heal carries its target ON the stamp (v1.11.0 self-aim, finding ① —
    // the dnd5e targets snapshot is incidental UI targeting for a range-self activity).
    const stamp = message.getFlag(MODULE_ID, "healPending");
    const targets = stamp?.selfAim
      ? [{ uuid: stamp.uuid, name: stamp.name }]
      : (message.getFlag("dnd5e", "targets") ?? []).map(t => ({ uuid: t.uuid, name: t.name }));
    if ( !targets.length ) return;
    const damages = damagePartsOf(message.rolls);
    if ( !damages.length ) return;
    await applyDamagesWithReceipt(message, targets, damages, { note: "Healing" });
  } catch(err) {
    console.error(`${TITLE} | Healing auto-apply failed.`, err);
  } finally {
    castExecutions.delete(key);
  }
}

/** The elect volunteers for stamped casts — on arrival, and on render for reload resume. */
function resolveStampedCast(message) {
  if ( !isActiveGM() ) return;
  if ( message.getFlag(MODULE_ID, "castApply") ) void executeCastApply(message);
  if ( message.getFlag(MODULE_ID, "healPending") ) void applyCastHealing(message);
}
Hooks.on("createChatMessage", resolveStampedCast);
Hooks.on("dnd5e.renderChatMessage", message => resolveStampedCast(message));

