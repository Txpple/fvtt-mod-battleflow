/**
 * Battle Flow — MACHINE, part of scripts/saves/ (ARCHITECTURE.md §7): the CONSEQUENCES per target,
 * receipted — effects per outcome, status presses, Evasion, chained damage at the verdict's multiplier.
 */
import { MODULE_ID, TITLE, queueFlagWrite, canApplyTo, whisperNoGM, statContext } from "../core.js";
import { ruleHTML } from "../rule-text.js";
import { bfCard } from "../decide/present.js";
import { applicableProfiles, cardActivity, enchantedAs, featureNamed, lower, namesAnswering, resolveUuid } from "../lookup.js";
import { CARD, castLevelOn, isCard, onSaveOf, originIdOf } from "../decide/card.js";
import { saveMultiplier } from "../decide/verdict.js";
import { forceStatus, damagePartsOf, statSourceOf } from "../shared.js";
import { dramaticVerdictPause } from "../ui.js";
import { EFFECT_BENDS, EVASIONS, SAVE_PRESSES, tableIndex } from "../decide/registry.js";
import { effectRecord, joinEffectReceipt } from "../decide/receipt.js";
import { saveNoneOnSuccess } from "../decide/reminders.js";
import { effectEntries, reminderEntries } from "../decide/registry.js";
import { applyDamagesWithReceipt } from "../auto-apply.js";
import { applyEffectsWithReceipt } from "../effect-riders.js";
import { nearestFeet, tokenOfActor } from "../geometry.js";

import { gateSaveChoice, announceBashOutcome, announceWordOutcome, settleInterpose } from "./choices.js";
import { cleanupSpentTemplates } from "./areas.js";

/** Same-client latch across the verdict pause — fold, update watcher and render can overlap. */
const saveApplications = new Set();

const SAVE_PRESS_INDEX = tableIndex(SAVE_PRESSES);

/** The press a save activity answers: its item's row, else (THE DMG) the row of an ENCHANTED item naming this activity
 * ("Life Stealing" on a "Nine Lives Stealer Longsword"). */
function pressFor(activity) {
  const direct = SAVE_PRESS_INDEX.rowFor(activity?.item);
  if ( direct ) return direct;
  for ( const [key, row] of Object.entries(SAVE_PRESSES) ) {
    if ( row.activity && (lower(row.activity) === lower(activity?.name)) && enchantedAs(activity?.item, key) ) return { key, ...row };
  }
  return null;
}

/** THE DMG — a `spend` press: one of the activity's own charges, when the sheet set them (Nine Lives Stealer). */
async function spendActivityCharge(activity) {
  const uses = activity?.uses;
  if ( !activity?.item || !uses || (uses.max === "") || (uses.max === null) || (uses.max === undefined) ) return;
  await activity.item.update({ [`system.activities.${activity.id}.uses.spent`]: (Number(uses.spent) || 0) + 1 });
}

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
    await applyFailDamage(card, flag, entry);
    if ( (entry.choice?.kind === "bash") && entry.choice.answer ) await announceBashOutcome(card, flag, entry);
    if ( (entry.choice?.kind === "word") && entry.choice.answer ) await announceWordOutcome(card, flag, entry);
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
 * by the system, read by nothing native). The concentration origin keeps the dependentOn cascade.
 * `successOnly`: the SAVE_PRESSES `success` effects alone (Stunning Strike's Slowed) — the legendary-resistance
 * flip lands them after the failure is unwound (the `always` ones it kept, the failure's it reverted). */
export async function applySaveEffects(card, flag, entry, { successOnly = false } = {}) {
  // A bash ANSWER replaces the generic pass (announceBashOutcome owns it).
  if ( (entry.choice?.kind === "bash") && entry.choice.answer ) return;
  // A triggered demand's effect is the area's STANDING effect — never doubled. Damage still lands.
  if ( flag.effectsHandled ) return;
  // Through the CARD: the use may have deleted the item (a thrown vial, a scroll's last use).
  const activity = cardActivity(card, flag.activityUuid);
  if ( !activity ) return;
  // A SAVE_PRESSES `success` row's effects land on a success and never on a failure (Stunning Strike's Slowed).
  const success = new Set((pressFor(activity)?.success ?? []).map(n => n.toLowerCase()));
  const onSuccess = effect => success.has(String(effect?.name ?? "").toLowerCase());
  const toApply = (await applicableProfiles(activity))
    .filter(({ profile, effect }) => onSuccess(effect)
      ? (entry.outcome !== "failed") : (!successOnly && ((entry.outcome === "failed") || profile.onSave)))
    .map(({ effect }) => effect);
  // No pack effect for a failure the text names (Web's Restrained): press the standard status. A press
  // behind the caster's WORD (Command) lands only when the word answered is the pressing one.
  if ( !toApply.length && (entry.outcome === "failed") && !successOnly ) {
    const press = pressFor(activity);
    const spoken = !press?.word || ((entry.choice?.kind === "word") && wordPresses(press.word, entry.choice.answer));
    if ( press?.onFail && spoken ) await pressSaveStatus(card, flag, entry, press, activity);
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

/** B2 — a hit reaction's `failDamage` (Beguiling Defenses): on the FAILURE the saver takes the type named, equal to the
 * damage the reactor took from the hit — read off the hit's receipts (`attackFor` the attack, the reactor the target). No
 * receipt yet (the save answered before the damage landed): a card says so and the table applies it by hand. */
async function applyFailDamage(card, flag, entry) {
  const fd = flag?.failDamage;
  if ( !fd || (entry.outcome !== "failed") ) return;
  let amount = Number(fd.amount);
  if ( !Number.isFinite(amount) && (fd.equalTo === "taken") && fd.attackId && fd.takenBy ) {
    amount = game.messages.contents.filter(m => m.getFlag(MODULE_ID, "attackFor") === fd.attackId)
      .flatMap(m => (m.getFlag(MODULE_ID, "receipt")?.targets ?? []).filter(t => (t.uuid === fd.takenBy) && !t.reverted))
      .reduce((n, t) => n + (Number(t.taken) || 0), 0);
  }
  const by = fd.by ?? flag.item?.name ?? "the reaction";
  if ( !(amount > 0) ) {
    await ChatMessage.create({ speaker: card.speaker,
      content: bfCard({ img: flag.item?.img ?? null, eyebrow: `Reaction — ${by}`, tone: "pending",
        title: `${entry.name} failed: ${fd.type ?? "psychic"} damage equal to the damage taken`,
        subtitle: "the hit's damage has no receipt yet — apply it by hand from the damage card" }) });
    return;
  }
  await applyDamagesWithReceipt(card, [{ uuid: entry.uuid, name: entry.name }],
    [{ value: amount, type: fd.type ?? "psychic", properties: new Set() }],
    { note: `${by} — ${fd.type ?? "psychic"}, equal to the damage taken (${amount})` });
}

/** Which EVASIONS row (registry.js) applies — its key (Evasion, Avoidance) or null. Read at the fold and
 * stamped on the entry. A row's `ability` narrows it; null reaches every save. Never while Incapacitated. */
export function evasionApplies(actor, flag) {
  if ( !(actor instanceof Actor) || !flag?.hasDamage || (flag.damageOnSave !== "half") ) return null;
  if ( actor.statuses?.has?.("incapacitated") ) return null;
  for ( const [key, row] of Object.entries(EVASIONS) ) {
    if ( row.side === "caster" ) continue;   // the caster's mirror (Potent Cantrip) — casterHalfFor
    if ( row.ability && !flag.abilities?.includes?.(row.ability) ) continue;
    if ( featureNamed(actor, key) ) return key;
  }
  // C1 — a `share` row (Leading Evasion): ANOTHER target of the same demand holds it within `share` feet of this one,
  // and is not Incapacitated; the verdict is shared for this save alone. The card names the sharer.
  const own = tokenOfActor(actor);
  if ( !own ) return null;
  for ( const [key, row] of Object.entries(EVASIONS) ) {
    if ( !row.share || (row.side === "caster") ) continue;
    if ( row.ability && !flag.abilities?.includes?.(row.ability) ) continue;
    for ( const t of (flag.targets ?? []) ) {
      if ( t.uuid === actor.uuid ) continue;
      const other = resolveUuid(t.uuid);
      if ( !(other instanceof Actor) || other.statuses?.has?.("incapacitated") || !featureNamed(other, key) ) continue;
      const tok = tokenOfActor(other);
      const feet = tok ? nearestFeet(own, tok) : null;
      if ( (feet !== null) && (feet <= row.share) ) return `${key} (${other.name})`;
    }
  }
  return null;
}

/** The EVASIONS row keyed to the CASTER (`side: "caster"` — Potent Cantrip) that this demand's damage carries:
 * `{ by, onSuccess }` or null. The caster's feature, the demand's own item a cantrip where the row says so. */
export function casterHalfFor(card, flag) {
  if ( !flag?.hasDamage ) return null;
  const caster = card?.getAssociatedActor?.() ?? null;
  if ( !(caster instanceof Actor) ) return null;
  const item = cardActivity(card, flag.activityUuid ?? null)?.item ?? null;
  for ( const [key, row] of Object.entries(EVASIONS) ) {
    if ( row.side !== "caster" ) continue;
    if ( row.cantrip && !((item?.type === "spell") && (Number(item.system?.level) === 0)) ) continue;
    if ( featureNamed(caster, key) ) return { by: key, onSuccess: row.onSuccess };
  }
  return null;
}

/** The key of a `halfToNone` effect (Circle of Power) on this saver, or null. */
export function noneOnSuccessFor(actor, flag) {
  if ( !(actor instanceof Actor) || !flag?.hasDamage || (flag.damageOnSave !== "half") ) return null;
  if ( !reminderEntries().some(e => e.kind === "effect") ) return null;
  return saveNoneOnSuccess({ effects: actor.effects.filter(e => !e.disabled).map(e => ({ name: e.name })),
    features: namesAnswering(actor.items.filter(i => i.type === "feat"), Object.keys(EFFECT_BENDS)),
    enabled: effectEntries().map(e => e.kind), table: EFFECT_BENDS, demand: flag.demand ?? null });
}

/** Does the caster's word press? Command's one pressing option, or (B2) a `statuses` map where every word presses its own. */
export const wordPresses = (word, answer) => word?.statuses ? !!word.statuses[answer] : (answer === word?.presses);
/** The status a word lands: the map's (Beguiling Twist's Charmed or Frightened), else the row's. */
export const wordStatus = (press, answer) => press?.word?.statuses?.[answer] ?? press?.status ?? null;

/** The SAVE_PRESSES status on the failer, receipted as the effect it became (so revert removes it). */
async function pressSaveStatus(card, flag, entry, press, activity = null) {
  const subject = await fromUuid(entry.uuid).catch(() => null);
  const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
  if ( !(saver instanceof Actor) || !canApplyTo(saver) ) return;
  const status = wordStatus(press, entry.choice?.answer ?? null);
  if ( !status || saver.statuses?.has?.(status) ) return;   // already wearing it — nothing to press, nothing to receipt
  const landed = await forceStatus(saver, status, { origin: flag.sourceUuid ?? null, expiry: press.expiry ?? null, duration: press.lasts ?? null });
  if ( !landed ) return;
  // THE DMG — `slain` (Nine Lives Stealer): 0 Hit Points too. ⚠ After the status: the platform's own Dead at 0 would race it.
  if ( press.slain && (Number(saver.system?.attributes?.hp?.value) > 0) ) await saver.update({ "system.attributes.hp.value": 0 });
  if ( press.spend ) await spendActivityCharge(activity).catch(err => console.warn(`${TITLE} | Could not spend the charge — mark it by hand.`, err));
  const effect = saver.effects.find(e => e.statuses?.has?.(status));
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
      ? ((entry.outcome === "saved") ? `saved — ${entry.evasionBy ?? "Evasion"}, no damage` : `failed — ${entry.evasionBy ?? "Evasion"}, half damage`)
      : (entry.noneOnSuccess && (entry.outcome === "saved")) ? `saved — ${entry.noneOnSuccess}, no damage`
      : (entry.casterHalf && (entry.outcome === "saved")) ? `saved — ${entry.casterHalf.by}, half damage`
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
