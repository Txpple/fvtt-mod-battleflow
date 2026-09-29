/**
 * Battle Flow — effect riders (a hit applies the attack activity's own effects, per target) and
 * the one shared effect applier, mirroring the native tray's `_prepareEffectData`.
 */
import { MODULE_ID, TITLE, isActiveGM, queueFlagWrite, statContext } from "./core.js";
import { cardActivity, lower, profileEffects, resolveUuid } from "./lookup.js";
import { CLOCK_RIDERS } from "./decide/registry.js";
import { effectRecord, joinEffectReceipt, revertableEffect } from "./decide/receipt.js";
import { CHIP_FLAG, TURN_PINNED, chipClock } from "./decide/chips.js";
import { CARD, castLevelOn, concentrationIdOf, isCard, scalingOf } from "./decide/card.js";
import { chipData, placeOf, statSourceOf, turnPlace } from "./shared.js";
import { METAMAGIC_FLAG, extendedDuration } from "./decide/metamagic.js";
import { listen } from "./dispatch.js";

export function messageActivity(message) {
  return cardActivity(message);
}

/** Apply the attack's riding effects to the targets it hit, and stamp the receipt. Elect-run. */
export async function applyEffectRiders(damageMessage, attackMessage, hits) {
  try {
    // ⚠ Guarded by a RIDER-OWNED marker: the mastery applier writes into the same flag.
    if ( damageMessage.getFlag(MODULE_ID, "effectReceipt")?.ridersDone ) return;
    const activity = messageActivity(attackMessage);
    let effects = (await activity?.getApplicableEffects?.()) ?? [];
    // A `random` clock rider on this very item (Chaos Blade) lands ONE of its numbered effects by the die: the
    // rider's, never the attack's own application of all of them.
    if ( Object.values(CLOCK_RIDERS).some(r => r.random && r.self && (lower(r.feature) === lower(activity?.item?.name))) ) {
      effects = effects.filter(e => !/^\d+\s*:/.test(String(e?.name ?? "")));
    }
    if ( !effects.length ) return;

    // The usage card carries the cast's metadata; without one, base level and no concentration.
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

/** The activity on the effect's item that lists it, or null. */
function activityOfEffect(effect) {
  const item = effect?.parent;
  const activities = item?.system?.activities;
  if ( !activities?.contents ) return null;
  return activities.contents.find(a => (a.effects ?? []).some(e => e._id === effect.id)) ?? null;
}

/**
 * THE application loop, the tray's way (the platform's tooling sees our copies as its own);
 * returns receipt entries for targets where something landed. `matchNames` dedupes by name too:
 * a casting client applies from an item CLONE, whose effect uuid differs. `source` is the acting
 * actor's uuid, the caller's fact (a reactor's self-cast has no message to walk).
 * @param {{uuid: string, name: string}[]} targets
 * @param {any[]} effects
 * @param {{concentration?: any, scaling?: number, spellLevel?: number, matchNames?: boolean,
 *   extraFlags?: object|null, source?: string|null, extend?: boolean, clock?: object|null,
 *   message?: any, activity?: any}} [opts]
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

      const changes = act?.getAppliedEffectChanges?.(effect, { chatMessage: message ?? undefined, target: actor }) ?? {};
      const flags = {
        dnd5e: {
          ...(concentration ? { dependentOn: concentration.uuid } : {}),
          scaling,
          ...(((spellLevel !== undefined) && (spellLevel !== null)) ? { spellLevel } : {})
        },
        // The fingerprint the twin floor polices, and whose action applied it (`except: "source"`).
        [MODULE_ID]: { applied: true, ...(source ? { sourceUuid: source } : {}) }
      };
      foundry.utils.mergeObject(flags, extraFlags ?? {});
      // ⚠ Write EVERY `system.origin` key: a partial merge leaves `getSourceActor` walking to the
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

      // Native parity: an existing copy is re-enabled and re-clocked, not duplicated.
      const existing = actor.effects.find(e => (e._stats?.[sourceKey] === effect.uuid)
        || (matchNames && (e.name === effect.name)));
      let applied;
      // `clock` ({duration, start}) overrides the activity's on create and refresh alike.
      if ( existing ) {
        // ⚠ `?? existing`: an empty-diff update returns undefined.
        // ⚠ `expired: false`: core v14 MARKS an expired effect rather than deleting it.
        const data = foundry.utils.mergeObject({
          _id: existing.id, disabled: false, duration: { expired: false },
          start: effect.constructor.getEffectStart()
        }, changes);
        if ( clock ) foundry.utils.mergeObject(data, clock);
        applied = (await existing.update(data)) ?? existing;
      } else {
        // Legacy `origin` too: `grantingActor`, `effectSourceOf` and the chip's owner walk it.
        const data = foundry.utils.mergeObject({
          ...effect.toObject(), disabled: false, transfer: false, origin: origin.uuid,
          _stats: { [sourceKey]: effect.uuid, [effect.inCompendium ? "duplicateSource" : "compendiumSource"]: null }
        }, changes);
        // ⚠ Fresh clock: `toObject()` copies a template's `expired` mark — a copy born suppressed (NOTES §1).
        data.duration = { ...(data.duration ?? {}), expired: false };
        data.start = effect.constructor.getEffectStart();
        if ( clock ) foundry.utils.mergeObject(data, clock);
        data.system ??= {};
        data.system.changes = await ActiveEffect.implementation.forApplication(
          data.system.changes, act ?? item ?? resolveUuid(source) ?? actor, actor);
        applied = await ActiveEffect.implementation.create(data, { parent: actor });
      }
      if ( applied && extend ) {
        const longer = extendedDuration(applied.duration ?? {});
        if ( Object.keys(longer).length ) applied = (await applied.update({ duration: longer })) ?? applied;
      }
      if ( applied && !entry.effects.some(e => e.id === applied.id) ) {
        entry.effects.push(effectRecord({ id: applied.id, name: applied.name,
          img: applied.img, description: applied.description }, context));
      }
    }
    if ( entry.effects.length ) out.push(entry);
  }
  return out;
}

/** Apply and stamp, under the caller's own done-`marker` so stages never mistake each other's work. */
export async function applyEffectsWithReceipt(receiptMessage, effects, targets,
  { concentration = null, scaling = 0, spellLevel, marker, source = null, message = null, activity = null, clock = null } = {}) {
  const entries = await applyEffectsTo(targets, effects, {
    extend: receiptMessage?.getFlag?.(MODULE_ID, METAMAGIC_FLAG)?.key === "extended",
    concentration, scaling, spellLevel, source, clock, message: message ?? receiptMessage, activity });
  if ( !entries.length && !marker ) return;
  // ⚠ Read AFTER the await, through the queued write: concurrent passes would drop each other's entries.
  await queueFlagWrite(receiptMessage, "effectReceipt", flag => {
    flag.targets ??= [];
    for ( const entry of entries ) joinEffectReceipt(flag, entry);
    // The marker is written even when nothing landed, or every render retries the cast.
    if ( marker ) flag[marker] = true;
  });
}

/** Remove one applied rider effect and mark its receipt entry; tolerates the effect already gone. */
export async function revertEffect(message, targetUuid, effectId) {
  if ( !revertableEffect(message.getFlag(MODULE_ID, "effectReceipt"), targetUuid, effectId) ) return;
  const actor = await fromUuid(targetUuid);
  if ( actor instanceof Actor ) await actor.effects.get(effectId)?.delete();
  // The mark, through the serializer (ARCHITECTURE §4 law 2), the guard repeated inside the lock.
  await queueFlagWrite(message, "effectReceipt", flag => {
    const entry = revertableEffect(flag, targetUuid, effectId);
    if ( !entry ) return false;
    entry.reverted = true;
  });
}

/* THE TWIN FLOOR. ⚠ `isActiveGM()` is per-USER: two sessions on one account both apply. A
 * fingerprinted newcomer with an ELDER same-name, same-origin twin deletes itself. */
listen("createActiveEffect", "effect-riders", effect => {
  if ( !isActiveGM() ) return;
  const actor = effect.parent;
  if ( !(actor instanceof Actor) ) return;
  const fingerprinted = e => !!(e.getFlag(MODULE_ID, "applied") || e.getFlag(MODULE_ID, CHIP_FLAG));
  if ( !fingerprinted(effect) ) return;
  // A deliberate STACK (use-chips.js) is not a twin.
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
 * A rider's clock pins to the ATTACKER's place (an opportunity attack's window is still the
 * attacker's turn), or for TURN_PINNED windows to the turn it lands in.
 */
const clockPlace = (clock, attacker) => TURN_PINNED.includes(clock) ? turnPlace() : (attacker ? placeOf(attacker) : null);

/**
 * An effect with no activity to carry it (Slasher, Crusher): `lands` as a template on the
 * FEATURE, under a fixed id so a second hit refreshes the one copy.
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
 * An activity's own effects on the hit; `clock` is a CHIP_WINDOWS key, or null for the pack's; `only` picks
 * among them (a die's face — Chaos Blade). Returns the effects landed.
 * @param {ChatMessage} receiptMessage
 * @param {object|null} activity
 * @param {{uuid: string, name: string}[]} targets
 * @param {{clock?: string|null, attacker?: Actor|null, source?: object|null, only?: ((effect: any) => boolean)|null}} [options]
 */
export async function applyActivityEffectsOnHit(receiptMessage, activity, targets, { clock = null, attacker = null, source = null, only = null } = {}) {
  const effects = (await profileEffects(activity?.effects)).map(({ effect }) => effect).filter(e => e && (!only || only(e)));
  if ( !effects.length || !targets?.length ) return [];
  const window = clock ? chipClock(clock, clockPlace(clock, attacker)) : null;
  await applyEffectsWithReceipt(receiptMessage, effects, targets,
    { source: source ?? statSourceOf(receiptMessage), clock: window ? chipData(window) : null });
  return effects;
}
