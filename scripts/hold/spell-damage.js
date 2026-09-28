// @ts-check
/**
 * Battle Flow — the reaction hold: THE NO-ATTACK DAMAGE APPLIER and the `negate` veto at
 * `dnd5e.preApplyDamage` (which blocks wherever the tray's button is pressed).
 */
import { MODULE_ID, TITLE, drivesMomentFor, canApplyTo, whisperNoGM } from "../core.js";
import { damagePartsOf } from "../shared.js";
import { CARD, isCard, itemNameOf, originIdOf, targetsOf } from "../decide/card.js";
import { registerResumable } from "../ui.js";
import { applyDamagesWithReceipt } from "../auto-apply.js";
import { listen } from "../dispatch.js";

/* The negate veto: preApplyDamage is the one place a negated target can be spared (an explicit false
 * cancels), on whichever client applies. ⚠ Accepted gap (ARCHITECTURE.md §6): Apply pressed while
 * the hold is PENDING lands — vetoing it would strand a hold answered Pass. */
listen("dnd5e.preApplyDamage", "hold/spell-damage", (actor, _amount, _updates, options) => {
  if ( !actor ) return;
  const damageMessage = options?.originatingMessage;
  // ⚠ Damage only: healing takes applyDamage too.
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

/* The applier: a no-attack damage roll applies itself on the elect; a pending spell-hold claim defers
 * it, a negated target is skipped. The birth stamp (`spellDamage`) gates it, so history is inert. */

async function applySpellDamage(message) {
  try {
    if ( message.getFlag(MODULE_ID, "spellDamage") !== true ) return;
    if ( message.getFlag(MODULE_ID, "receipt") ) return;                   // applied already (resume)
    const hold = message.getOriginatingMessage?.()?.getFlag?.(MODULE_ID, "hold");
    if ( hold && (hold.status === "pending") ) return;                     // bridged and still open
    if ( message.getFlag(MODULE_ID, "spellHoldPending") === true ) {
      // A RESOLVED hold applies per its verdicts; otherwise the release write re-triggers.
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
    await applyDamagesWithReceipt(message, writable, damages);
  } catch(err) {
    console.error(`${TITLE} | Spell damage auto-apply failed.`, err);
  }
}

/** The spell-damage moment's SUBJECT: the CASTER, whose roll and message it is. */
const spellDamageSubject = message => message?.getAssociatedActor?.()?.uuid ?? null;

// Three triggers: arrival, the claim settling (update), and render (reload resume).
registerResumable("spellDamage", {
  pending: (_flag, message, cause) => (cause === "create")
    || ((cause === "update") && (message.getFlag(MODULE_ID, "spellHoldPending") === false) && !message.getFlag(MODULE_ID, "receipt"))
    || ((cause === "render") && (message.getFlag(MODULE_ID, "spellHoldPending") !== true) && !message.getFlag(MODULE_ID, "receipt")),
  drives: (_flag, message) => drivesMomentFor(spellDamageSubject(message)),
  drive: applySpellDamage
});

listen("updateChatMessage", "hold/spell-damage", message => {
  if ( !drivesMomentFor(spellDamageSubject(message)) ) return;
  // A resolved spell hold releases every damage roll waiting on it.
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( (hold?.trigger === "spell") && (hold.status === "resolved") ) {
    for ( const dmg of game.messages.contents.filter(m =>
      (originIdOf(m) === message.id)
      && (m.getFlag(MODULE_ID, "spellHoldPending") === true) ) ) {
      void dmg.setFlag(MODULE_ID, "spellHoldPending", false);
    }
  }
});
