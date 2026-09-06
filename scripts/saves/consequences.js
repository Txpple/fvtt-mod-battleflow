/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the CONSEQUENCES — Phase 3's save slice, per target, receipts
 * throughout: effects per outcome, the SAVE_PRESSES status press, Evasion and Circle of Power,
 * the chained damage at the verdict's multiplier.
 * The machine-tier pass, Stage 4c (2026-09-05, ruling 3): saves.js became this directory —
 * one flag, one machine, one part per spine step; index.js is the only public face and fixes
 * the registration order. Every body here is the one saves.js carried; nothing was rewritten.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, canApplyTo, whisperNoGM, statContext } from "../core.js";
import { resolveUuid } from "../lookup.js";
import { saveMultiplier } from "../decide/verdict.js";
import { forceStatus, damagePartsOf, statSourceOf } from "../shared.js";
import { dramaticVerdictPause } from "../ui.js";
import { EFFECT_BENDS, EVASION, SAVE_PRESSES } from "../decide/registry.js";
import { effectRecord, joinEffectReceipt } from "../decide/receipt.js";
import { saveNoneOnSuccess } from "../decide/reminders.js";
import { effectEntries, reminderEntries } from "../settings.js";
import { applyDamagesWithReceipt } from "../auto-apply.js";
import { applyEffectsWithReceipt } from "../effect-riders.js";
import { announceSaveVerdict } from "./verdict.js";
import { gateSaveChoice, announceBashOutcome, settleInterpose } from "./choices.js";
import { cleanupSpentTemplates } from "./areas.js";

/* --- the consequences: Phase 3's save slice, per target, receipts throughout ---------------- */

/** Same-client latch across the verdict pause — fold, update watcher and render can overlap. */
const saveApplications = new Set();

/**
 * One target's consequences, once: wait out the dice (the verdict pause — mechanics are
 * already written, only the table-facing part holds), then effects per outcome, then any
 * already-rolled damage per outcome. The flag is RE-READ after the pause on purpose: a
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

    // ⚠ THE CONSEQUENCE IS A WRITE TO THE SAVER (v1.27.2). With no GM connected this splits by
    // WHO SAVED: a party-wide demand — fireball, a dragon's breath — lands on PCs their own
    // players own, so the damage and the chips apply exactly as always. A demand aimed at
    // monsters cannot land, and the announcement below is the point at which to say so: the
    // verdict is already public and true, only the press is missing.
    const saver = resolveUuid(uuid);
    if ( (saver instanceof Actor) && !canApplyTo(saver) ) {
      await announceSaveVerdict(card, flag, entry);
      await whisperNoGM(`${entry.name ?? saver.name}'s save consequences`,
        "The verdict stands on the card — apply the damage and any condition by hand.");
      return;
    }

    // The verdict ANNOUNCES before its consequences land (v1.19.0, FLOW item 7 — the line
    // sits above the receipt rows, per "cards say one thing, once"), and AFTER the pause +
    // re-read, so a legendary-resistance flip mid-pause announces the FINAL verdict.
    await announceSaveVerdict(card, flag, entry);

    // A fold CHOICE can hold this target's pass here (v1.19.x, findings ⑤/⑥): Interpose on
    // a successful DEX save, the bash's Prone-or-push on a failed listed save. `applied`
    // stays false, so the update/render floors resume the pass the moment the answer (or
    // the buzzer's default) lands in the flag.
    if ( await gateSaveChoice(card, flag, entry) ) return;
    flag = card.getFlag(MODULE_ID, "saves");   // the choice write moved the flag — re-read
    entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry?.done || entry.applied ) return;

    await applySaveEffects(card, flag, entry);
    if ( (entry.choice?.kind === "bash") && entry.choice.answer ) await announceBashOutcome(card, flag, entry);
    if ( entry.choice?.kind === "interpose" ) await settleInterpose(card, flag, entry);
    await reconcileSaveDamage(card, uuid);

    // ⚠ THROUGH THE SERIALIZER, not a bare read-modify-write (core.js). Per-target
    // independence means two targets' consequence passes run at once against this one card,
    // and a clone-merge-set here can land without the other pass's entry. Losing THIS field
    // is the measured double-application itself: `reconcileSaveDamage` reads the receipt as
    // its idempotence guard, so a dropped `applied` reads as "not applied yet" and the
    // damage lands on that target a second time.
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
 * The activity's effects, filtered by the verdict: a failure applies them all, a success
 * applies only the entries whose own `onSave` says so — the flag the system stores and
 * nothing native reads. Through the shared applier: same origin rule (the caster's
 * concentration effect when the card carries one — the native dependentOn cascade rides
 * along), same receipts, same revert.
 */
async function applySaveEffects(card, flag, entry) {
  // A bash ANSWER replaces the generic pass entirely (v1.19.x ⑤ + walk-5 (x)): the push is
  // the Push idiom (a card, a hand-moved token), and the Prone press is the STANDARD chip
  // via forceStatus — never the item's own custom effect. announceBashOutcome owns both.
  if ( (entry.choice?.kind === "bash") && entry.choice.answer ) return;
  // An emanation's TRIGGERED demand (emanations.js, 2026-09-03): the activity's effect (Spirit
  // Guardians' Half Speed) is the area's STANDING effect, kept by the region while the creature
  // stands inside — applying it again here would double it. The demand says so; damage still lands.
  if ( flag.effectsHandled ) return;
  const activity = flag.activityUuid ? await fromUuid(flag.activityUuid) : null;
  if ( !activity ) return; // the item is gone (a consumed scroll) — accepted corner above
  const applicable = new Set((activity.applicableEffects ?? []).map(e => e.id));
  const toApply = (activity.effects ?? [])
    .filter(e => e.effect && applicable.has(e.effect.id))
    .filter(e => (entry.outcome === "failed") || e.onSave)
    .map(e => e.effect);
  // A pack that brought NO effect for a failure the text names (Web's Restrained — SAVE_PRESSES,
  // 2026-09-02): press the standard status, the caster as its origin, and receipt it on the card
  // so the revert is there — the Topple idiom, as data.
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
    spellLevel: card.system?.spellLevel ?? undefined,
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
    enabled: effectEntries().map(e => e.kind), table: EFFECT_BENDS, demand: flag.demand ?? null });
}

/** The SAVE_PRESSES press: the canonical status on the failer, receipted as an applied effect
 * (the effect the status became — so the card's revert removes exactly it). */
async function pressSaveStatus(card, flag, entry, press) {
  const subject = await fromUuid(entry.uuid).catch(() => null);
  const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
  if ( !(saver instanceof Actor) || !canApplyTo(saver) ) return;
  if ( saver.statuses?.has?.(press.status) ) return;   // already wearing it — nothing to press, nothing to receipt
  const landed = await forceStatus(saver, press.status, { origin: flag.sourceUuid ?? null });
  if ( !landed ) return;
  const effect = saver.effects.find(e => e.statuses?.has?.(press.status));
  if ( !effect ) return;
  await queueFlagWrite(card, "effectReceipt", current => {
    joinEffectReceipt(current, { uuid: entry.uuid, name: entry.name, img: saver.img ?? null,
      effects: [effectRecord({ id: effect.id, name: effect.name, img: effect.img, description: press.rule }, statContext(flag.sourceUuid ?? null))] });
  });
}

/** Every damage roll chained to the demand card — the card's own Damage button chains its
 * click natively, and the module's suite rolls pass the origin explicitly. Whole log. */
export function saveDamageMessages(card) {
  return game.messages.contents.filter(m =>
    (m.getFlag("dnd5e", "roll.type") === "damage")
    && (m.getFlag("dnd5e", "originatingMessage") === card.id));
}

/** Land one chained damage roll on one target at its verdict's multiplier — the receipt says
 * why. Shared by the reconcile pass (behind its guards) and the legendary-resistance unwind
 * (which reverts first and re-applies DIRECTLY, because the guard below deliberately treats
 * any existing receipt entry — reverted included — as "handled": a human's manual ↩ revert
 * must stick, never be re-fought by the machine). */
export async function applyOneSaveDamage(damageMessage, flag, entry) {
  const damageOnSave = damageMessage.getFlag("dnd5e", "roll.damageOnSave")
    ?? flag.damageOnSave ?? "half";
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
 * Land every chained damage roll on every DONE target that has no receipt entry yet, at the
 * verdict's multiplier — the applier records a non-1 multiplier on the entry, so the card
 * says why the number halved. Order-independent: damage before verdicts, verdicts before
 * damage, or interleaved per target, the receipt gate makes every path idempotent. Gated on
 * Auto-Apply Damage — a table that keeps its trays keeps them here too; the verdict rows
 * still say who saved.
 */
export async function reconcileSaveDamage(card, onlyUuid = null) {
  if ( !setting(S.autoApply) ) return;
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;
  // A demand with no damage dimension (no parts, or rider damage the save doesn't
  // modulate — the onSave "full" stamp rule) never applies chained damage by verdict:
  // a Web-burn enricher click chains to the card, and per-verdict application would
  // re-create finding ③ through the side door. The native tray owns those rolls.
  if ( !flag.hasDamage ) return;
  for ( const damageMessage of saveDamageMessages(card) ) {
    for ( const entry of flag.targets ) {
      if ( !entry.done ) continue;
      // The general passes (damage arrival, render resume, update watcher) apply only
      // targets whose consequence pass has FINISHED — the verdict pause gates every
      // table-facing consequence, damage included, and the fold's flag write must not let
      // a reconcile racing ahead of the pause undercut it (caught by smoke-saves 3d: the
      // damage landed while the effects were still waiting out the dice). The explicit
      // per-target path (the post-pause consequence pass, the LR unwind) applies regardless.
      if ( onlyUuid ? (entry.uuid !== onlyUuid) : !entry.applied ) continue;
      const key = `${damageMessage.id}|${entry.uuid}`;
      if ( saveDamageApplications.has(key) ) continue;
      // ANY receipt entry — reverted included — means this pairing is handled: applied by an
      // earlier pass, or applied and then manually reverted by a human whose ↩ the machine
      // must never re-fight. (The legendary-resistance unwind re-applies through
      // applyOneSaveDamage directly, not through this guard.)
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
