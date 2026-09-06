/**
 * Battle Flow — the reaction hold, part 7: THE NO-ATTACK DAMAGE APPLIER (v1.6.0) and the
 * `negate` veto. A damage-activity roll with no attack in its chain applies itself on the elect,
 * per target, deferring to a pending spell hold and skipping a negated target; the veto at
 * `dnd5e.preApplyDamage` is the block wherever the tray's button is pressed. Registered after
 * the continuation and before the views — where hold.js had them.
 */
import { MODULE_ID, TITLE, S, setting, drivesMomentFor, canApplyTo, whisperNoGM } from "../core.js";
import { damagePartsOf } from "../shared.js";
import { registerResumable } from "../ui.js";

/**
 * The block itself, and the reason it is real rather than advisory.
 *
 * Nothing else in this module touches a spell like Magic Missile: it is not an attack, so
 * Phase 1a never rolls its damage and Phase 1b never applies it (resolveAttackMessage returns
 * null for a chain with no attack in it). The damage is rolled and applied by hand, which
 * means the ONE place a negated target can actually be spared is the moment of application —
 * dnd5e.preApplyDamage, which cancels on an explicit false (actor.mjs:754).
 *
 * Scoped as tightly as it can be: the damage must chain back to a usage card carrying a
 * resolved `negate` hold, and that hold must name THIS actor with a `negated` verdict. Fires
 * on whichever client is applying (applyDamage is local and ownership-gated), never GM-only —
 * the veto has to hold wherever the button was pressed.
 *
 * ⚠ Accepted gap (ARCHITECTURE.md §6): a GM who presses Apply while the hold is still PENDING beats
 * the verdict and the damage lands, because there is no verdict yet to read. Vetoing pending
 * applications instead would be worse — a hold answered Pass would then need a second Apply
 * click that nobody would remember to make. The card reads "held — waiting on …" throughout.
 */
Hooks.on("dnd5e.preApplyDamage", (actor, amount, updates, options) => {
  if ( !setting(S.reactionHold) || !actor ) return;
  // The tray passes the DAMAGE message as originatingMessage (damage-application.mjs:76); the
  // usage card carrying the hold is one hop further back through the system's own registry.
  const damageMessage = options?.originatingMessage;
  // ⚠ Damage only. applyDamage is the path healing takes too (a heal is negative damage with
  // roll.type "healing"), and a reaction that stops a spell must never be able to refuse
  // someone a cure cast from the same card. Phase 1b draws the same line for the same reason.
  if ( damageMessage?.getFlag("dnd5e", "roll.type") !== "damage" ) return;
  const origin = damageMessage.getOriginatingMessage?.();
  let hold = (origin && (origin !== damageMessage)) ? origin.getFlag(MODULE_ID, "hold") : null;
  // Fallback (v1.6.0): a genuinely unbridged roll still gets the block — find the governing
  // hold by spell + actor, newest first, whole log (the tail-window lesson).
  if ( !hold && damageMessage.getFlag(MODULE_ID, "spellDamage") ) {
    let name = null;
    try { name = fromUuidSync(damageMessage.getFlag("dnd5e", "item")?.uuid ?? "")?.name?.toLowerCase() ?? null; }
    catch { name = null; }
    if ( name ) {
      hold = game.messages.contents.filter(m => {
        const h = m.getFlag(MODULE_ID, "hold");
        return (h?.trigger === "spell") && (h.spell?.toLowerCase() === name)
          && h.targets?.some(t => t.uuid === actor.uuid);
      }).pop()?.getFlag(MODULE_ID, "hold") ?? null;
    }
  }
  if ( (hold?.trigger !== "spell") || (hold.status !== "resolved") ) return;
  const target = hold.targets?.find(t => t.uuid === actor.uuid);
  if ( target?.verdict !== "negated" ) return;
  ui.notifications.info(
    `${TITLE}: ${target.reaction} — ${target.name} takes no damage from ${hold.spell}.`);
  return false;
});

/* --- the no-attack damage applier (v1.6.0) -------------------------------------------------
 * "It should auto apply; the shield stuff is its own mechanic" (user call). A damage-
 * activity roll — Magic Missile's shape, no attack anywhere in its chain — applies itself
 * to its snapshot targets on the elect, per target: a pending spell-hold claim defers the
 * whole roll (the resolution below releases it), a negated verdict skips that target (the
 * preApplyDamage veto above also guards — belt and braces), everything else lands through
 * the shared receipt applier. The birth stamp (`spellDamage`, preCreate) is the gate, so
 * history is inert and render-resume is safe.
 * ------------------------------------------------------------------------------------------- */

async function applySpellDamage(message) {
  try {
    if ( message.getFlag(MODULE_ID, "spellDamage") !== true ) return;
    if ( message.getFlag(MODULE_ID, "receipt") ) return;                   // applied already (resume)
    const hold = message.getOriginatingMessage?.()?.getFlag?.(MODULE_ID, "hold");
    if ( hold && (hold.status === "pending") ) return;                     // bridged and still open
    if ( message.getFlag(MODULE_ID, "spellHoldPending") === true ) {
      // Claimed for a hold. If the bridged hold has RESOLVED already (a damage button
      // pressed after the answer), fall through and apply per its verdicts; an unresolved
      // or not-yet-bridged claim keeps waiting — the release write will re-trigger.
      if ( !hold || (hold.status === "pending") ) return;
    }
    const targets = (message.getFlag("dnd5e", "targets") ?? [])
      .filter(t => hold?.targets?.find(h => h.uuid === t.uuid)?.verdict !== "negated")
      .map(t => ({ uuid: t.uuid, name: t.name }));
    if ( !targets.length ) return;
    const damages = damagePartsOf(message.rolls);
    if ( !damages.length ) return;
    // ⚠ WITH NO GM, ONLY THE TARGETS THIS CLIENT MAY WRITE ARE APPLIED (v1.27.2), and the rest
    // are spoken for. A spell's targets are usually monsters, so this is normally the whole
    // set — the roll stands, the card stands, and the damage tray is still there to press by
    // hand. Silence here would read as the resolver having applied nothing for no reason.
    const writable = targets.filter(t => {
      try { return canApplyTo(fromUuidSync(t.uuid)); } catch { return false; }
    });
    const blocked = targets.length - writable.length;
    if ( blocked ) {
      await whisperNoGM(`this spell's damage to ${blocked} target${blocked === 1 ? "" : "s"}`,
        "The roll stands — apply it from the card's damage tray.");
    }
    if ( !writable.length ) return;
    // ⚠ Lazily bound, and deliberately so (split, v1.6.1): a static import would evaluate
    // auto-apply.js — and through it mastery.js and concentration.js — before this file's
    // body, registering concentration's preApplyDamage cause capture AHEAD of the veto
    // above. Foundry stops calling preApplyDamage at the first false, so the veto must stay
    // first in line or a vetoed application strands a captured cause. Keep this dynamic.
    const { applyDamagesWithReceipt } = await import("../auto-apply.js");
    await applyDamagesWithReceipt(message, writable, damages);
  } catch(err) {
    console.error(`${TITLE} | Spell damage auto-apply failed.`, err);
  }
}

/** The spell-damage moment's SUBJECT — the CASTER (the roll is theirs, and the message is theirs
 * to stamp a receipt on). Who drives it is core's one question, `drivesMomentFor`; v1.27.2's
 * wrapper folded away in Stage 5 of the machine-tier pass (2026-09-05). */
const spellDamageSubject = message => message?.getAssociatedActor?.()?.uuid ?? null;

// Three triggers, all flag-driven: arrival, the claim settling (the pending claim cleared by the
// caster, or released by the resolution below), and render (reload resume) — declared to the
// spine's resumable registry on the `spellDamage` stamp (Stage 3, 2026-09-05); the in-flight
// latch (spellDamageApplications) is the spine's `spellDamage|<id>` now.
registerResumable("spellDamage", {
  pending: (_flag, message, cause) => (cause === "create")
    || ((cause === "update") && (message.getFlag(MODULE_ID, "spellHoldPending") === false) && !message.getFlag(MODULE_ID, "receipt"))
    || ((cause === "render") && (message.getFlag(MODULE_ID, "spellHoldPending") !== true) && !message.getFlag(MODULE_ID, "receipt")),
  drives: (_flag, message) => setting(S.autoApply) && drivesMomentFor(spellDamageSubject(message)),
  drive: applySpellDamage
});

Hooks.on("updateChatMessage", message => {
  if ( !setting(S.autoApply) || !drivesMomentFor(spellDamageSubject(message)) ) return;
  // A spell hold resolved — release every damage roll waiting on it. The elect owns this
  // write; the release itself (spellHoldPending → false) is the bus event that applies.
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( (hold?.trigger === "spell") && (hold.status === "resolved") ) {
    for ( const dmg of game.messages.contents.filter(m =>
      (m.getFlag("dnd5e", "originatingMessage") === message.id)
      && (m.getFlag(MODULE_ID, "spellHoldPending") === true) ) ) {
      void dmg.setFlag(MODULE_ID, "spellHoldPending", false);
    }
  }
});
