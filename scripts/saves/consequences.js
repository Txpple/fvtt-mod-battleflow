/**
 * Battle Flow — MACHINE, part of scripts/saves/ (ARCHITECTURE.md §7): the CONSEQUENCES per target,
 * receipted — effects per outcome, status presses, Evasion, chained damage at the verdict's multiplier.
 */
import { MODULE_ID, TITLE, queueFlagWrite, canApplyTo, whisperNoGM, statContext } from "../core.js";
import { ruleHTML } from "../rule-text.js";
import { applicableProfiles, cardActivity, featureNamed, namesAnswering, resolveUuid } from "../lookup.js";
import { CARD, castLevelOn, isCard, onSaveOf, originIdOf } from "../decide/card.js";
import { saveMultiplier } from "../decide/verdict.js";
import { forceStatus, damagePartsOf, statSourceOf } from "../shared.js";
import { dramaticVerdictPause } from "../ui.js";
import { EFFECT_BENDS, EVASION, SAVE_PRESSES, tableIndex } from "../decide/registry.js";
import { effectRecord, joinEffectReceipt } from "../decide/receipt.js";
import { saveNoneOnSuccess } from "../decide/reminders.js";
import { effectEntries, reminderEntries } from "../decide/registry.js";
import { applyDamagesWithReceipt } from "../auto-apply.js";
import { applyEffectsWithReceipt } from "../effect-riders.js";

import { gateSaveChoice, announceBashOutcome, settleInterpose } from "./choices.js";
import { cleanupSpentTemplates } from "./areas.js";

/** Same-client latch across the verdict pause — fold, update watcher and render can overlap. */
const saveApplications = new Set();

const SAVE_PRESS_INDEX = tableIndex(SAVE_PRESSES);

/** One target's consequences, once: the verdict pause, effects, then rolled damage. ⚠ RE-READ the
 * flag after the pause: a legendary-resistance flip can land mid-pause. */
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

    // ⚠ A write to the SAVER: with no GM, a monster's cannot be made — say so.
    const saver = resolveUuid(uuid);
    if ( (saver instanceof Actor) && !canApplyTo(saver) ) {
      await whisperNoGM(`${entry.name ?? saver.name}'s save consequences`,
        "The verdict stands on the card — apply the damage and any condition by hand.");
      return;
    }

    // A fold CHOICE (Interpose, the bash) holds the pass; `applied` stays false so the floors resume it.
    if ( await gateSaveChoice(card, flag, entry) ) return;
    flag = card.getFlag(MODULE_ID, "saves");   // the choice write moved the flag — re-read
    entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry?.done || entry.applied ) return;

    await applySaveEffects(card, flag, entry);
    if ( (entry.choice?.kind === "bash") && entry.choice.answer ) await announceBashOutcome(card, flag, entry);
    if ( entry.choice?.kind === "interpose" ) await settleInterpose(card, flag, entry);
    await reconcileSaveDamage(card, uuid);

    // ⚠ THROUGH THE SERIALIZER: a lost `applied` (two targets at once) lands the damage twice.
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

/** The activity's effects by verdict: all on a failure, on a success only `onSave` entries (stored
 * by the system, read by nothing native). The concentration origin keeps the dependentOn cascade. */
async function applySaveEffects(card, flag, entry) {
  // A bash ANSWER replaces the generic pass (announceBashOutcome owns it).
  if ( (entry.choice?.kind === "bash") && entry.choice.answer ) return;
  // A triggered demand's effect is the area's STANDING effect — never doubled. Damage still lands.
  if ( flag.effectsHandled ) return;
  // Through the CARD: the use may have deleted the item (a thrown vial, a scroll's last use).
  const activity = cardActivity(card, flag.activityUuid);
  if ( !activity ) return;
  const toApply = (await applicableProfiles(activity))
    .filter(({ profile }) => (entry.outcome === "failed") || profile.onSave)
    .map(({ effect }) => effect);
  // No pack effect for a failure the text names (Web's Restrained): press the standard status.
  if ( !toApply.length && (entry.outcome === "failed") ) {
    const press = SAVE_PRESS_INDEX.rowFor(activity.item);
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

/** Does EVASION (registry.js) apply? Read at the fold and stamped on the entry. */
export function evasionApplies(actor, flag) {
  if ( !(actor instanceof Actor) || !flag?.hasDamage || (flag.damageOnSave !== "half") ) return false;
  if ( !flag.abilities?.includes?.(EVASION.ability) ) return false;
  if ( actor.statuses?.has?.("incapacitated") ) return false;
  return !!featureNamed(actor, EVASION.feature);
}

/** The key of a `halfToNone` effect (Circle of Power) on this saver, or null. */
export function noneOnSuccessFor(actor, flag) {
  if ( !(actor instanceof Actor) || !flag?.hasDamage || (flag.damageOnSave !== "half") ) return null;
  if ( !reminderEntries().some(e => e.kind === "effect") ) return null;
  return saveNoneOnSuccess({ effects: actor.effects.filter(e => !e.disabled).map(e => ({ name: e.name })),
    features: namesAnswering(actor.items.filter(i => i.type === "feat"), Object.keys(EFFECT_BENDS)),
    enabled: effectEntries().map(e => e.kind), table: EFFECT_BENDS, demand: flag.demand ?? null });
}

/** The SAVE_PRESSES status on the failer, receipted as the effect it became (so revert removes it). */
async function pressSaveStatus(card, flag, entry, press) {
  const subject = await fromUuid(entry.uuid).catch(() => null);
  const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
  if ( !(saver instanceof Actor) || !canApplyTo(saver) ) return;
  if ( saver.statuses?.has?.(press.status) ) return;   // already wearing it — nothing to press, nothing to receipt
  const landed = await forceStatus(saver, press.status, { origin: flag.sourceUuid ?? null, expiry: press.expiry ?? null });
  if ( !landed ) return;
  const effect = saver.effects.find(e => e.statuses?.has?.(press.status));
  if ( !effect ) return;
  const description = await ruleHTML(press.rule);
  await queueFlagWrite(card, "effectReceipt", current => {
    joinEffectReceipt(current, { uuid: entry.uuid, name: entry.name, img: saver.img ?? null,
      effects: [effectRecord({ id: effect.id, name: effect.name, img: effect.img, description }, statContext(flag.sourceUuid ?? null))] });
  });
}

/** Every damage roll chained to the demand card, across the whole log. */
export function saveDamageMessages(card) {
  return game.messages.contents.filter(m =>
    isCard(m, CARD.damage) && (originIdOf(m) === card.id));
}

/** One chained damage roll on one target at its verdict's multiplier. The legendary-resistance
 * unwind calls it DIRECTLY, past the reconcile's receipt guard. */
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

/** Every chained roll on every DONE, unreceipted target; the receipt gate makes it idempotent. */
export async function reconcileSaveDamage(card, onlyUuid = null) {
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;
  // No damage dimension: an enricher click chains to the card too, and the native tray owns it.
  if ( !flag.hasDamage ) return;
  for ( const damageMessage of saveDamageMessages(card) ) {
    for ( const entry of flag.targets ) {
      if ( !entry.done ) continue;
      // ⚠ Only FINISHED passes (the verdict pause gates damage too); `onlyUuid` applies regardless.
      if ( onlyUuid ? (entry.uuid !== onlyUuid) : !entry.applied ) continue;
      const key = `${damageMessage.id}|${entry.uuid}`;
      if ( saveDamageApplications.has(key) ) continue;
      // ANY receipt entry, reverted included, is handled: a manual ↩ revert sticks.
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
