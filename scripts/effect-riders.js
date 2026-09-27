/**
 * Battle Flow — effect riders (a hit applies the attack activity's own effects, per target) and
 * the one shared effect applier every document-copy application in the module runs through.
 * Application mirrors the native tray's `_prepareEffectData` (dnd5e effect-application.mjs).
 */
import { MODULE_ID, TITLE, isActiveGM, queueFlagWrite, statContext } from "./core.js";
import { cardActivity, profileEffects, resolveUuid } from "./lookup.js";
import { effectRecord, joinEffectReceipt, revertableEffect } from "./decide/receipt.js";
import { CHIP_FLAG, TURN_PINNED, chipClock } from "./decide/chips.js";
import { CARD, castLevelOn, concentrationIdOf, isCard, scalingOf } from "./decide/card.js";
import { chipData, placeOf, statSourceOf, turnPlace } from "./shared.js";
import { METAMAGIC_FLAG, extendedDuration } from "./decide/metamagic.js";

/** The activity behind a chain message (`cardActivity`, which never throws). */
export function messageActivity(message) {
  return cardActivity(message);
}

/**
 * Apply the attack's riding effects to the targets it hit, and stamp the effect receipt.
 * Runs on the active-GM elect (players cannot create effects on unowned actors).
 */
export async function applyEffectRiders(damageMessage, attackMessage, hits) {
  try {
    // ⚠ One payout per roll, guarded by a RIDER-OWNED marker, not the flag's existence: the
    // mastery applier writes into this same effectReceipt flag.
    if ( damageMessage.getFlag(MODULE_ID, "effectReceipt")?.ridersDone ) return;
    const activity = messageActivity(attackMessage);
    // An activity's effect list holds PROFILES whose effect resolves asynchronously.
    const effects = (await activity?.getApplicableEffects?.()) ?? [];
    if ( !effects.length ) return;

    // The usage card carries the cast's metadata (concentration id, scaling, spell level); a
    // roll with no card in the log falls back to base level, no concentration.
    const usage = attackMessage.getOriginatingMessage?.();
    const usageCard = ((usage instanceof ChatMessage) && isCard(usage, CARD.usage)) ? usage : null;
    const concentration = usageCard
      ? usageCard.getAssociatedActor()?.effects.get(concentrationIdOf(usageCard)) : null;

    await applyEffectsWithReceipt(damageMessage, effects, hits, {
      concentration,
      scaling: scalingOf(usageCard),
      spellLevel: castLevelOn(usageCard) ?? undefined,
      marker: "ridersDone",
      source: statSourceOf(attackMessage),
      message: usageCard ?? attackMessage,
      activity
    });
  } catch(err) {
    console.error(`${TITLE} | Effect riders failed.`, err);
  }
}

/** The activity an effect belongs to: the one on its item that lists it (null when none does). */
function activityOfEffect(effect) {
  const item = effect?.parent;
  const activities = item?.system?.activities;
  if ( !activities?.contents ) return null;
  return activities.contents.find(a => (a.effects ?? []).some(e => e._id === effect.id)) ?? null;
}

/**
 * THE application loop, built the tray's way: the listing activity authors the changes and the
 * clock (`getAppliedEffectChanges`), provenance is `system.origin`, the dedupe key is the copy's
 * `_stats.duplicateSource` (`compendiumSource` for a pack effect), and `@` values resolve for this
 * application (`forApplication`) — so the platform's tooling sees our copies as its own. Returns
 * receipt entries (only targets where something landed) for callers that cannot write a flag yet.
 * - `matchNames`: dedupe by name too — the casting client applies from an item CLONE, whose
 *   effect uuid differs, so a stamp-only test would apply Shield twice.
 * - `extraFlags`: merged into the effect (the reaction path's `reactionEffect` marker).
 * - `source`: the actor uuid whose action applies these — the caller's fact (a reactor's
 *   self-cast is why no message walk could derive it).
 * - `message` / `activity`: the card answered to and the applying activity, when the caller
 *   knows them better than the effect's own item.
 */
export async function applyEffectsTo(targets, effects,
  { concentration = null, scaling = 0, spellLevel, matchNames = false, extraFlags = null, source = null,
    extend = false, clock = null, message = null, activity = null } = {}) {
  const context = statContext(source);
  const out = [];
  for ( const target of targets ) {
    const actor = await fromUuid(target.uuid); // the targets snapshot carries ACTOR uuids
    if ( !(actor instanceof Actor) ) continue;
    const entry = { uuid: target.uuid, name: target.name, img: actor.img ?? null, effects: [] };
    for ( const effect of effects ) {
      const act = activity ?? activityOfEffect(effect);
      const item = act?.item ?? ((effect.parent instanceof Item) ? effect.parent : null);
      const origin = concentration ?? effect;
      const sourceKey = effect.inCompendium ? "compendiumSource" : "duplicateSource";
      const profile = act?.effects?.find?.(e => (e.uuid === effect.uuid) || (e._id === effect.id))?._id ?? null;

      // The activity's own changes first (the clock), then the provenance and the flags.
      const changes = act?.getAppliedEffectChanges?.(effect, { chatMessage: message ?? undefined, target: actor }) ?? {};
      const flags = {
        dnd5e: {
          ...(concentration ? { dependentOn: concentration.uuid } : {}),
          scaling,
          ...(((spellLevel !== undefined) && (spellLevel !== null)) ? { spellLevel } : {})
        },
        // The module's fingerprint (the twin-dedupe floor polices only these) and WHOSE action
        // applied it, for the gate's `except: "source"` (a compendium origin names no actor).
        [MODULE_ID]: { applied: true, ...(source ? { sourceUuid: source } : {}) }
      };
      foundry.utils.mergeObject(flags, extraFlags ?? {});
      // ⚠ Write EVERY `system.origin` key: the template's own origin is its lineage (often the
      // pack's uuid in `item`), and a partial merge leaves `getSourceActor` walking to the
      // compendium — no caster, no rider die, no turn clock (NOTES §2).
      foundry.utils.mergeObject(changes, {
        flags,
        system: { origin: {
          actor: null, behavior: null,
          activity: act?.uuid ?? null,
          item: (act?.item ?? item)?.uuid ?? null,
          effect: concentration?.uuid ?? null,
          message: message?.uuid ?? null,
          ...(profile ? { profile } : {})
        } }
      });

      // Native parity: an existing copy of THIS effect is re-enabled and re-clocked, not
      // duplicated — by the source stamp, or by name (`matchNames`).
      const existing = actor.effects.find(e => (e._stats?.[sourceKey] === effect.uuid)
        || (matchNames && (e.name === effect.name)));
      let applied;
      // `clock`: a caller that knows the rule's window better than the pack hands
      // `{duration, start}` in; it lands on create and refresh alike, over the activity's.
      if ( existing ) {
        // ⚠ `?? existing`: an empty-diff update returns undefined.
        // ⚠ `expired: false`: core v14 MARKS an expired effect rather than deleting it, so a
        // re-clocked leftover would otherwise stay suppressed.
        const data = foundry.utils.mergeObject({
          _id: existing.id, disabled: false, duration: { expired: false },
          start: effect.constructor.getEffectStart()
        }, changes);
        if ( clock ) foundry.utils.mergeObject(data, clock);
        applied = (await existing.update(data)) ?? existing;
      } else {
        // Legacy `origin` beside `system.origin`: this module's readers (`grantingActor`,
        // `effectSourceOf`, the chip's owner) still walk it.
        const data = foundry.utils.mergeObject({
          ...effect.toObject(), disabled: false, transfer: false, origin: origin.uuid,
          _stats: { [sourceKey]: effect.uuid, [effect.inCompendium ? "duplicateSource" : "compendiumSource"]: null }
        }, changes);
        // ⚠ The template's clock state never rides in: a pack effect with a `start` is tracked
        // by core v14 and may already be marked `expired` on its item, and `toObject()` copies
        // the mark — a copy born suppressed. Fresh start, unexpired (NOTES §1).
        data.duration = { ...(data.duration ?? {}), expired: false };
        data.start = effect.constructor.getEffectStart();
        if ( clock ) foundry.utils.mergeObject(data, clock);
        data.system ??= {};
        data.system.changes = await ActiveEffect.implementation.forApplication(
          data.system.changes, act ?? item ?? resolveUuid(source) ?? actor, actor);
        applied = await ActiveEffect.implementation.create(data, { parent: actor });
      }
      // Extended Spell: the cast's effects run twice as long, 24 hours at most.
      if ( applied && extend ) {
        const longer = extendedDuration(applied.duration ?? {});
        if ( Object.keys(longer).length ) applied = (await applied.update({ duration: longer })) ?? applied;
      }
      if ( applied && !entry.effects.some(e => e.id === applied.id) ) {
        // Plain fields only across the layer line (§2 rule 1) — the document stays here.
        entry.effects.push(effectRecord({ id: applied.id, name: applied.name,
          img: applied.img, description: applied.description }, context));
      }
    }
    if ( entry.effects.length ) out.push(entry);
  }
  return out;
}

/**
 * Apply and stamp in one move, where the receipt message already exists. Entries merge into its
 * effectReceipt flag under the caller's own done-`marker`, so stages never mistake each other's
 * work. Options as applyEffectsTo.
 */
export async function applyEffectsWithReceipt(receiptMessage, effects, targets,
  { concentration = null, scaling = 0, spellLevel, marker, source = null, message = null, activity = null, clock = null } = {}) {
  const entries = await applyEffectsTo(targets, effects, {
    // Extended Spell rides the receipt card (the usage card carries the metamagic flag).
    extend: receiptMessage?.getFlag?.(MODULE_ID, METAMAGIC_FLAG)?.key === "extended",
    concentration, scaling, spellLevel, source, clock, message: message ?? receiptMessage, activity });
  if ( !entries.length && !marker ) return;
  // ⚠ Read AFTER the await, through the queued write: concurrent per-target save passes on one
  // card would otherwise each merge into a stale copy and drop the other's entries.
  await queueFlagWrite(receiptMessage, "effectReceipt", flag => {
    flag.targets ??= [];
    for ( const entry of entries ) joinEffectReceipt(flag, entry);
    // The marker is written even when nothing landed, or every render retries the cast.
    if ( marker ) flag[marker] = true;
  });
}

/**
 * Remove one applied rider effect and mark its receipt entry; tolerates the effect already gone.
 * The state is the flag, re-read at click time.
 */
export async function revertEffect(message, targetUuid, effectId) {
  const flag = foundry.utils.deepClone(message.getFlag(MODULE_ID, "effectReceipt") ?? {});
  const entry = revertableEffect(flag, targetUuid, effectId);
  if ( !entry ) return;
  const actor = await fromUuid(targetUuid);
  if ( actor instanceof Actor ) await actor.effects.get(effectId)?.delete();
  entry.reverted = true;
  await message.setFlag(MODULE_ID, "effectReceipt", flag);
}

/* --- the twin-chip dedupe floor ---------------------------------------------------------------
 * ⚠ `isActiveGM()` is per-USER: two sessions on one account both run an applier and race
 * replication, landing a chip twice. Converged here: a fingerprinted newcomer with an ELDER
 * same-name, same-origin twin deletes itself (creation time, then id). Other modules' stacks
 * are never touched. */
Hooks.on("createActiveEffect", effect => {
  if ( !isActiveGM() ) return;
  const actor = effect.parent;
  if ( !(actor instanceof Actor) ) return;
  const fingerprinted = e => !!(e.getFlag(MODULE_ID, "applied") || e.getFlag(MODULE_ID, CHIP_FLAG));
  if ( !fingerprinted(effect) ) return;
  // A deliberate STACK (use-chips.js marks it — Tinker's devices, a chip each) is not a twin.
  if ( effect.getFlag(MODULE_ID, "stacks") ) return;
  const born = e => e._stats?.createdTime ?? 0;
  const elder = actor.effects.some(e => {
    if ( (e.id === effect.id) || !fingerprinted(e) ) return false;
    if ( (e.name !== effect.name) || (e.origin !== effect.origin) ) return false;
    return (born(e) < born(effect)) || ((born(e) === born(effect)) && (e.id < effect.id));
  });
  if ( elder ) effect.delete().catch(() => { /* the other twin got there first */ });
});

/**
 * Where a rider's clock is pinned: the ATTACKER's place (the Slow mastery's — an opportunity attack's
 * window is still the attacker's next turn start), or — for a window "for the rest of the current
 * turn" (Halt, TURN_PINNED) — the turn it lands in, whoever's that is.
 */
const clockPlace = (clock, attacker) => TURN_PINNED.includes(clock) ? turnPlace() : (attacker ? placeOf(attacker) : null);

/**
 * An effect with no activity to carry it (Slasher, Crusher): the rider's `lands` built as a
 * template on the FEATURE — its effect `from` (changes kept unless `bare`), renamed, under a fixed
 * id so a second hit refreshes the one copy — landed through the same applier and receipt.
 * @param {ChatMessage} receiptMessage
 * @param {Item} feature
 * @param {{name: string, from?: string, id: string, bare?: boolean}} lands
 * @param {{uuid: string, name: string}[]} targets
 */
export async function applyItemEffectOnHit(receiptMessage, feature, lands, targets, { clock = null, attacker = null, source = null } = {}) {
  if ( !feature || !lands?.name || !targets?.length ) return;
  const base = lands.from ? [...(feature.effects ?? [])].find(e => e.name === lands.from) : null;
  const data = base ? base.toObject() : { name: lands.name, img: feature.img };
  Object.assign(data, { _id: lands.id, name: lands.name, transfer: false, disabled: false });
  if ( !base || lands.bare ) {
    data.changes = [];
    if ( data.system ) data.system.changes = [];
  }
  const template = new ActiveEffect.implementation(data, { parent: feature });
  const window = clock ? chipClock(clock, clockPlace(clock, attacker)) : null;
  await applyEffectsWithReceipt(receiptMessage, [template], targets,
    { source: source ?? statSourceOf(receiptMessage), clock: window ? chipData(window) : null });
}

/**
 * An activity's own effects on the hit — the hit menu's `effects` option and a clock rider's
 * `effects` row. `clock` is a CHIP_WINDOWS key pinned per `clockPlace`, or null for the pack's
 * own duration.
 * @param {ChatMessage} receiptMessage
 * @param {object|null} activity   the activity whose `effects` profiles land
 * @param {{uuid: string, name: string}[]} targets
 * @param {{clock?: string|null, attacker?: Actor|null, source?: object|null}} [options]
 */
export async function applyActivityEffectsOnHit(receiptMessage, activity, targets, { clock = null, attacker = null, source = null } = {}) {
  const effects = (await profileEffects(activity?.effects)).map(({ effect }) => effect).filter(Boolean);
  if ( !effects.length || !targets?.length ) return;
  const window = clock ? chipClock(clock, clockPlace(clock, attacker)) : null;
  await applyEffectsWithReceipt(receiptMessage, effects, targets,
    { source: source ?? statSourceOf(receiptMessage), clock: window ? chipData(window) : null });
}
