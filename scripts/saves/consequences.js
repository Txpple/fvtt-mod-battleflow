/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the CONSEQUENCES, per
 * target, receipts throughout: effects per outcome, the SAVE_PRESSES status press, Evasion and
 * Circle of Power, the chained damage at the verdict's multiplier.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, canApplyTo, whisperNoGM, statContext } from "../core.js";
import { applicableProfiles, cardActivity, resolveUuid } from "../lookup.js";
import { CARD, castLevelOn, isCard, onSaveOf, originIdOf } from "../decide/card.js";
import { saveMultiplier } from "../decide/verdict.js";
import { forceStatus, damagePartsOf, statSourceOf } from "../shared.js";
import { dramaticVerdictPause } from "../ui.js";
import { EFFECT_BENDS, EVASION, SAVE_PRESSES } from "../decide/registry.js";
import { effectRecord, joinEffectReceipt } from "../decide/receipt.js";
import { saveNoneOnSuccess } from "../decide/reminders.js";
import { effectEntries, reminderEntries } from "../settings.js";
import { applyDamagesWithReceipt } from "../auto-apply.js";
import { applyEffectsWithReceipt } from "../effect-riders.js";

import { gateSaveChoice, announceBashOutcome, settleInterpose } from "./choices.js";
import { cleanupSpentTemplates } from "./areas.js";

/* --- the consequences: per target, receipts throughout -------------------------------------- */

/** Same-client latch across the verdict pause — fold, update watcher and render can overlap. */
const saveApplications = new Set();

/**
 * One target's consequences, once: wait out the dice (the verdict pause), then effects per
 * outcome, then any already-rolled damage. ⚠ The flag is RE-READ after the pause: a
 * legendary-resistance flip landing mid-pause overturns the outcome before anything applied.
 */
export async function applySaveConsequences(card, uuid, rollMessage = null) {
  const key = `${card.id}|${uuid}`;
  if ( saveApplications.has(key) ) return;
  saveApplications.add(key);
  try {
    let flag = card.getFlag(MODULE_ID, "saves");
    let entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry?.done || entry.applied ) return;
    if ( !rollMessage && entry.rollMessageId ) rollMessage = game.messages.get(entry.rollMessageId);
    if ( rollMessage ) await dramaticVerdictPause(rollMessage);

    flag = card.getFlag(MODULE_ID, "saves"); // the pause is wide — re-read before acting
    entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry?.done || entry.applied ) return;

    // ⚠ The consequence is a write to the SAVER. With no GM connected, a PC saver's own player
    // can still apply; a monster's cannot, so say so — the verdict on the card stands.
    const saver = resolveUuid(uuid);
    if ( (saver instanceof Actor) && !canApplyTo(saver) ) {
      await whisperNoGM(`${entry.name ?? saver.name}'s save consequences`,
        "The verdict stands on the card — apply the damage and any condition by hand.");
      return;
    }

    // No verdict card here: the usage card already carries the verdict, once.

    // A fold CHOICE can hold this target's pass (Interpose on a successful DEX save, the bash's
    // Prone-or-push on a failed listed save). `applied` stays false, so the update/render floors
    // resume the pass when the answer (or the buzzer's default) lands.
    if ( await gateSaveChoice(card, flag, entry) ) return;
    flag = card.getFlag(MODULE_ID, "saves");   // the choice write moved the flag — re-read
    entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry?.done || entry.applied ) return;

    await applySaveEffects(card, flag, entry);
    if ( (entry.choice?.kind === "bash") && entry.choice.answer ) await announceBashOutcome(card, flag, entry);
    if ( entry.choice?.kind === "interpose" ) await settleInterpose(card, flag, entry);
    await reconcileSaveDamage(card, uuid);

    // ⚠ THROUGH THE SERIALIZER: two targets' passes run at once against this card, and a lost
    // `applied` reads as "not applied yet" to the reconcile — the damage lands twice.
    await queueFlagWrite(card, "saves", current => {
      const done = current.targets?.find(t => t.uuid === uuid);
      if ( done && !done.applied ) done.applied = true;
    });
    await cleanupSpentTemplates(card);
  } catch(err) {
    console.error(`${TITLE} | Save consequences failed.`, err);
  } finally {
    saveApplications.delete(key);
  }
}

/**
 * The activity's effects, filtered by the verdict: a failure applies them all, a success only
 * the entries whose own `onSave` says so (the system stores it; nothing native reads it).
 * Through the shared applier, with the caster's concentration effect as origin when the card
 * carries one, so the native dependentOn cascade rides along.
 */
async function applySaveEffects(card, flag, entry) {
  // A bash ANSWER replaces the generic pass: announceBashOutcome owns the push card and the
  // standard Prone chip (never the item's own custom effect).
  if ( (entry.choice?.kind === "bash") && entry.choice.answer ) return;
  // An emanation's triggered demand: the activity's effect is the area's STANDING effect, kept
  // by the region — applying it again would double it. Damage still lands.
  if ( flag.effectsHandled ) return;
  // Through the CARD (lookup.js): an item the use deleted (a thrown vial, a scroll's last use)
  // is read off the card's snapshot.
  const activity = cardActivity(card, flag.activityUuid);
  if ( !activity ) return;
  // 6.0: the activity's list holds PROFILES whose effects resolve asynchronously (lookup.js).
  const toApply = (await applicableProfiles(activity))
    .filter(({ profile }) => (entry.outcome === "failed") || profile.onSave)
    .map(({ effect }) => effect);
  // A pack that brought NO effect for a failure the text names (Web's Restrained — SAVE_PRESSES):
  // press the standard status, the caster as origin, receipted on the card so the revert is there.
  if ( !toApply.length && (entry.outcome === "failed") ) {
    const press = SAVE_PRESSES[activity.item?.name] ?? null;
    if ( press?.onFail ) await pressSaveStatus(card, flag, entry, press);
    return;
  }
  if ( !toApply.length ) return;
  const concentration = card.getAssociatedActor?.()?.effects.get(card.system?.concentration) ?? null;
  await applyEffectsWithReceipt(card, toApply, [{ uuid: entry.uuid, name: entry.name }], {
    concentration,
    scaling: card.system?.scaling ?? 0,
    spellLevel: castLevelOn(card) ?? undefined,
    source: statSourceOf(card) // the data-plane stamp — the caster whose demand this is
  });
}

/**
 * EVASION applies to this demand for this saver (decide/registry.js EVASION): the feature on
 * the sheet by name, a Dexterity save, an effect that deals half on a success, the saver not
 * Incapacitated. Read at the fold and stamped on the entry; the multiplier and the row read it.
 */
export function evasionApplies(actor, flag) {
  if ( !(actor instanceof Actor) || !flag?.hasDamage || (flag.damageOnSave !== "half") ) return false;
  if ( !flag.abilities?.includes?.(EVASION.ability) ) return false;
  if ( actor.statuses?.has?.("incapacitated") ) return false;
  return actor.items.some(i => (i.type === "feat") && (i.name.toLowerCase() === EVASION.feature.toLowerCase()));
}

/** A standing effect that turns this saver's SUCCESS against half-on-save damage into none
 * (the effect table's `halfToNone` — Circle of Power against a spell): the row's key, or null. */
export function noneOnSuccessFor(actor, flag) {
  if ( !(actor instanceof Actor) || !flag?.hasDamage || (flag.damageOnSave !== "half") ) return null;
  if ( !reminderEntries().some(e => e.kind === "effect") ) return null;
  return saveNoneOnSuccess({ effects: actor.effects.filter(e => !e.disabled).map(e => ({ name: e.name })),
    features: actor.items.filter(i => i.type === "feat").map(i => i.name),
    enabled: effectEntries().map(e => e.kind), table: EFFECT_BENDS, demand: flag.demand ?? null });
}

/** The SAVE_PRESSES press: the canonical status on the failer, receipted as an applied effect
 * (the effect the status became — so the card's revert removes exactly it). */
async function pressSaveStatus(card, flag, entry, press) {
  const subject = await fromUuid(entry.uuid).catch(() => null);
  const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
  if ( !(saver instanceof Actor) || !canApplyTo(saver) ) return;
  if ( saver.statuses?.has?.(press.status) ) return;   // already wearing it — nothing to press, nothing to receipt
  const landed = await forceStatus(saver, press.status, { origin: flag.sourceUuid ?? null, expiry: press.expiry ?? null });
  if ( !landed ) return;
  const effect = saver.effects.find(e => e.statuses?.has?.(press.status));
  if ( !effect ) return;
  await queueFlagWrite(card, "effectReceipt", current => {
    joinEffectReceipt(current, { uuid: entry.uuid, name: entry.name, img: saver.img ?? null,
      effects: [effectRecord({ id: effect.id, name: effect.name, img: effect.img, description: press.rule }, statContext(flag.sourceUuid ?? null))] });
  });
}

/** Every damage roll chained to the demand card (its origin is the card), across the whole log. */
export function saveDamageMessages(card) {
  return game.messages.contents.filter(m =>
    isCard(m, CARD.damage) && (originIdOf(m) === card.id));
}

/** Land one chained damage roll on one target at its verdict's multiplier — the receipt says
 * why. Shared by the reconcile pass (behind its guards) and the legendary-resistance unwind,
 * which reverts first and re-applies DIRECTLY past the reconcile's receipt guard. */
export async function applyOneSaveDamage(damageMessage, flag, entry) {
  const damageOnSave = onSaveOf(damageMessage) ?? flag.damageOnSave ?? "half";
  const multiplier = saveMultiplier(entry, damageOnSave);
  if ( multiplier == null ) return;
  const damages = damagePartsOf(damageMessage.rolls);
  if ( !damages.length ) return;
  await applyDamagesWithReceipt(damageMessage, [{ uuid: entry.uuid, name: entry.name }], damages, {
    multiplier,
    note: entry.evasion
      ? ((entry.outcome === "saved") ? "saved — Evasion, no damage" : "failed — Evasion, half damage")
      : (entry.noneOnSuccess && (entry.outcome === "saved")) ? `saved — ${entry.noneOnSuccess}, no damage`
      : (entry.outcome === "saved")
        ? ((multiplier === 0.5) ? "saved — half damage" : "saved — full damage anyway")
        : undefined
  });
}

/** Per (damage message, target) latch — the fold path and the damage-arrival path share it. */
const saveDamageApplications = new Set();

/**
 * Land every chained damage roll on every DONE target with no receipt entry yet, at the
 * verdict's multiplier (the receipt records a non-1 multiplier). Order-independent: the receipt
 * gate makes every path idempotent. Gated on Auto-Apply Damage.
 */
export async function reconcileSaveDamage(card, onlyUuid = null) {
  if ( !setting(S.autoApply) ) return;
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;
  // A demand with no damage dimension (no parts, or rider damage the save does not modulate)
  // never applies chained damage by verdict: an enricher click chains to the card too, and the
  // native tray owns those rolls.
  if ( !flag.hasDamage ) return;
  for ( const damageMessage of saveDamageMessages(card) ) {
    for ( const entry of flag.targets ) {
      if ( !entry.done ) continue;
      // ⚠ The general passes apply only targets whose consequence pass FINISHED — the verdict
      // pause gates damage too, and a reconcile racing ahead of it would land damage while the
      // effects still wait. The explicit per-target path (`onlyUuid`) applies regardless.
      if ( onlyUuid ? (entry.uuid !== onlyUuid) : !entry.applied ) continue;
      const key = `${damageMessage.id}|${entry.uuid}`;
      if ( saveDamageApplications.has(key) ) continue;
      // ANY receipt entry — reverted included — means handled: a human's manual ↩ revert must
      // stick, never be re-fought by the machine.
      if ( damageMessage.getFlag(MODULE_ID, "receipt")?.targets
        ?.some(t => t.uuid === entry.uuid) ) continue;
      saveDamageApplications.add(key);
      try {
        await applyOneSaveDamage(damageMessage, flag, entry);
      } finally {
        saveDamageApplications.delete(key);
      }
    }
  }
}
