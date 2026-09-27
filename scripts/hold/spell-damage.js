/**
 * Battle Flow — the reaction hold: THE NO-ATTACK DAMAGE APPLIER and the `negate` veto. A
 * damage-activity roll with no attack in its chain applies itself on the elect, per target,
 * deferring to a pending spell hold and skipping a negated target; the veto at
 * `dnd5e.preApplyDamage` blocks wherever the tray's button is pressed.
 */
import { MODULE_ID, TITLE, S, setting, drivesMomentFor, canApplyTo, whisperNoGM } from "../core.js";
import { damagePartsOf } from "../shared.js";
import { CARD, isCard, itemNameOf, originIdOf, targetsOf } from "../decide/card.js";
import { registerResumable } from "../ui.js";

/**
 * The negate veto. A no-attack spell (Magic Missile) is applied at dnd5e.preApplyDamage or not at
 * all, so that is the one place a negated target can be spared (the hook cancels on an explicit
 * false). Scoped to a damage roll whose usage card carries a resolved `negate` hold naming THIS
 * actor `negated`; fires on whichever client applies, never GM-only.
 * ⚠ Accepted gap (ARCHITECTURE.md §6): Apply pressed while the hold is still PENDING lands — there
 * is no verdict yet, and vetoing pending applications would strand a hold answered Pass.
 */
Hooks.on("dnd5e.preApplyDamage", (actor, _amount, _updates, options) => {
  if ( !setting(S.reactionHold) || !actor ) return;
  // The tray passes the DAMAGE message; the usage card with the hold is one hop back.
  const damageMessage = options?.originatingMessage;
  // ⚠ Damage only: healing takes applyDamage too, and a reaction must never refuse someone a cure.
  if ( !isCard(damageMessage, CARD.damage) ) return;
  const origin = damageMessage.getOriginatingMessage?.();
  let hold = (origin && (origin !== damageMessage)) ? origin.getFlag(MODULE_ID, "hold") : null;
  // Fallback: an unbridged roll finds its hold by spell + actor, newest first, whole log.
  if ( !hold && damageMessage.getFlag(MODULE_ID, "spellDamage") ) {
    const name = itemNameOf(damageMessage)?.toLowerCase() ?? null;
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

/* --- the no-attack damage applier ----------------------------------------------------------
 * A damage-activity roll with no attack in its chain applies itself to its snapshot targets on
 * the elect: a pending spell-hold claim defers the whole roll (the resolution releases it), a
 * negated target is skipped, the rest land through the receipt applier. The birth stamp
 * (`spellDamage`) is the gate, so history is inert and render-resume is safe.
 * ------------------------------------------------------------------------------------------- */

async function applySpellDamage(message) {
  try {
    if ( message.getFlag(MODULE_ID, "spellDamage") !== true ) return;
    if ( message.getFlag(MODULE_ID, "receipt") ) return;                   // applied already (resume)
    const hold = message.getOriginatingMessage?.()?.getFlag?.(MODULE_ID, "hold");
    if ( hold && (hold.status === "pending") ) return;                     // bridged and still open
    if ( message.getFlag(MODULE_ID, "spellHoldPending") === true ) {
      // Claimed for a hold: a hold already RESOLVED (damage pressed after the answer) applies per
      // its verdicts; otherwise wait — the release write re-triggers.
      if ( !hold || (hold.status === "pending") ) return;
    }
    const targets = targetsOf(message)
      .filter(t => hold?.targets?.find(h => h.uuid === t.uuid)?.verdict !== "negated")
      .map(t => ({ uuid: t.uuid, name: t.name }));
    if ( !targets.length ) return;
    const damages = damagePartsOf(message.rolls);
    if ( !damages.length ) return;
    // ⚠ With no GM, only the targets this client may write are applied; the rest are spoken for.
    const writable = targets.filter(t => {
      try { return canApplyTo(fromUuidSync(t.uuid)); } catch { return false; }
    });
    const blocked = targets.length - writable.length;
    if ( blocked ) {
      await whisperNoGM(`this spell's damage to ${blocked} target${blocked === 1 ? "" : "s"}`,
        "The roll stands — apply it from the card's damage tray.");
    }
    if ( !writable.length ) return;
    // ⚠ LAZILY bound on purpose: a static import would evaluate auto-apply.js (and through it
    // concentration.js) first, registering concentration's preApplyDamage cause capture AHEAD of
    // the veto above. Foundry stops at the first false, so a vetoed application would strand a
    // captured cause. Keep this dynamic.
    const { applyDamagesWithReceipt } = await import("../auto-apply.js");
    await applyDamagesWithReceipt(message, writable, damages);
  } catch(err) {
    console.error(`${TITLE} | Spell damage auto-apply failed.`, err);
  }
}

/** The spell-damage moment's SUBJECT: the CASTER, whose roll and message it is. */
const spellDamageSubject = message => message?.getAssociatedActor?.()?.uuid ?? null;

// Three triggers, all flag-driven: arrival, the claim settling (cleared by the caster or released
// by the resolution below), and render (reload resume) — declared on the `spellDamage` stamp.
registerResumable("spellDamage", {
  pending: (_flag, message, cause) => (cause === "create")
    || ((cause === "update") && (message.getFlag(MODULE_ID, "spellHoldPending") === false) && !message.getFlag(MODULE_ID, "receipt"))
    || ((cause === "render") && (message.getFlag(MODULE_ID, "spellHoldPending") !== true) && !message.getFlag(MODULE_ID, "receipt")),
  drives: (_flag, message) => setting(S.autoApply) && drivesMomentFor(spellDamageSubject(message)),
  drive: applySpellDamage
});

Hooks.on("updateChatMessage", message => {
  if ( !setting(S.autoApply) || !drivesMomentFor(spellDamageSubject(message)) ) return;
  // A spell hold resolved: release every damage roll waiting on it (the release is the bus event).
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( (hold?.trigger === "spell") && (hold.status === "resolved") ) {
    for ( const dmg of game.messages.contents.filter(m =>
      (originIdOf(m) === message.id)
      && (m.getFlag(MODULE_ID, "spellHoldPending") === true) ) ) {
      void dmg.setFlag(MODULE_ID, "spellHoldPending", false);
    }
  }
});
