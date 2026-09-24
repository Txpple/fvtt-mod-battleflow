/**
 * Battle Flow — Phase 1.9A: effect riders and the shared effect applier (applyEffectsWithReceipt - the Phase 3 convergence point).
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, isActiveGM, queueFlagWrite, statContext } from "./core.js";
import { cardActivity, resolveUuid } from "./lookup.js";
import { effectRecord, joinEffectReceipt, revertableEffect } from "./decide/receipt.js";
import { CHIP_FLAG } from "./decide/chips.js";
import { CARD, castLevelOn, concentrationIdOf, isCard, scalingOf } from "./decide/card.js";
import { statSourceOf } from "./shared.js";
import { METAMAGIC_FLAG, extendedDuration } from "./decide/metamagic.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1.9A — effect riders: a hit applies the effects riding it (the first build plan's section A — git history).
 * The attack activity's own effect list is the on-hit set; application mirrors the native
 * tray's _prepareEffectData (dnd5e 6.0 effect-application.mjs) — the activity's own changes,
 * the same `system.origin` provenance, the same dedupe on the copy's source stamp, the same
 * re-enable-instead-of-stack for an existing copy. Per-target on purpose: the damage riders'
 * split-target intersection refusal does not apply to effects, because each target gets its
 * own document.
 * ------------------------------------------------------------------------------------------- */

/**
 * The activity behind a chain message — the platform's own read (`system.activity.uuid` first,
 * the item's collection by id when the uuid is stale; dnd5e 6.0 `ChatMessage5e#getAssociatedActivity`),
 * through lookup.js's one home since 2026-09-22 (`cardActivity`, which never throws).
 */
export function messageActivity(message) {
  return cardActivity(message);
}

/**
 * Apply the attack's riding effects to the targets it hit, and stamp the effect receipt.
 * Runs on the active-GM elect (players cannot create effects on unowned actors).
 */
export async function applyEffectRiders(damageMessage, attackMessage, hits) {
  try {
    // One payout per roll — guarded by a RIDER-OWNED marker, not by the flag's existence:
    // applyMasteryEffect writes entries into this same effectReceipt flag, so "any flag
    // present" would make the riders silently skip if the stages ever reorder or a new
    // writer appears. The mastery applier deep-clones and preserves this marker.
    if ( damageMessage.getFlag(MODULE_ID, "effectReceipt")?.ridersDone ) return;
    const activity = messageActivity(attackMessage);
    // 6.0: an activity's effect list holds PROFILES whose effect resolves asynchronously.
    const effects = (await activity?.getApplicableEffects?.()) ?? [];
    if ( !effects.length ) return;

    // The usage card carries the cast's metadata (concentration id, scaling, spell level).
    // Cards are never suppressed since v1.10.0, so the no-card fallback below (base-level,
    // non-concentration assumed) only covers genuinely chainless rolls — kept because the
    // registry walk can still come up empty (a roll made without its card in the log).
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
 * THE application loop — every document-copy effect application in the module runs through
 * here (the Phase 3 convergence, completed v1.8.0): the riders, the cast slice, the save
 * slice, and the reaction's self-cast sliver. Built THE TRAY'S WAY (dnd5e 6.0
 * effect-application.mjs `_prepareEffectData`, adopted in the 6.0 pass, 2026-09-15): the
 * activity that lists the effect authors its changes (`getAppliedEffectChanges` — the clock,
 * see below), the provenance is `system.origin.{activity|item, effect, message, profile}`, the
 * dedupe key is the copy's `_stats.duplicateSource` (or `compendiumSource` for a pack effect),
 * and the changes are resolved for THIS application (`ActiveEffect.forApplication` — an `@` in a
 * change's value read on the origin's or the target's roll data). A tray-applied Bless and a
 * Battle Flow-applied Bless are now the same document, and the platform's own tooling
 * (`getSourceActor`, `matchesOrigin`, the rest expiry) sees ours. Returns receipt-shaped
 * entries ([{uuid, name, img, effects: [...]}], only targets where something landed) so callers
 * that cannot write a flag yet (the hold's answering client, whose response message does not
 * exist until after the application) still get the receipt to carry.
 *
 * THE CLOCK (user ruling 1 of the 6.0 pass, 2026-09-15 — DESIGN §5 states ONE rule now): the
 * platform's. `Activity#getAppliedEffectChanges` gives a clockless effect its activity's
 * duration (Death Armor's hour, written once on the spell) and pins a finite non-turns clock
 * landing in combat to `turnStart`; "until the end of ITS next turn" is the activity's own
 * `duration.expiry` at the data (`targetEnd`, one of the pseudo-expiries the platform judges
 * against the bearer's or the source's turn). This module's `appliedClock` — rule 1 re-derived,
 * rule 2's re-pin to the bearer's turnEnd — is retired with it. The once-per-turn chits stay
 * this module's (shared.js `writeTurnChit`).
 *
 * The two policy options exist for the reaction sliver and stay this narrow:
 *  - `matchNames`: dedupe by name AS WELL AS the source stamp — the casting client applies from
 *    an item CLONE (Activity#use clones the item), so its effect's uuid differs from the one
 *    the continuing client would compute, and a stamp-only test would happily apply Shield twice.
 *  - `extraFlags`: merged into the created/updated effect — how the reaction path keeps
 *    its `reactionEffect` marker (the flag inventory's "which module path created it").
 *
 * `source` is the CALLER's fact, not this loop's to derive: the actor uuid whose action is
 * applying these effects (the riders' attacker, the cast/save slices' caster, the reaction
 * sliver's own reactor — whose self-cast is exactly why no message walk from here could get
 * it right). It rides every record via the data-plane stamp, resolved once per application.
 * `message` is the card the application answers to (the tray's `chatMessage` — the usage card
 * when there is one) and `activity` the activity applying, when the caller knows it better than
 * the effect's own item does (a cast activity applying its linked spell's effects).
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
        // The module's application fingerprint — the twin-dedupe floor below polices ONLY
        // effects wearing it, so it can never delete another module's deliberate stack.
        // …and WHOSE action applied it, for the gate's `except: "source"` facet (a compendium
        // origin names no actor, so the origin alone cannot say).
        [MODULE_ID]: { applied: true, ...(source ? { sourceUuid: source } : {}) }
      };
      foundry.utils.mergeObject(flags, extraFlags ?? {});
      // THE PROVENANCE IS THIS APPLICATION'S, WHOLE (2026-09-23, Session 8's silent Hunter's
      // Mark). The template's own `system.origin` is its LINEAGE — the 6.0 migration left the
      // pack's uuid in `item` on 207 of the world's 243 applied templates — and a merge that
      // names only `activity` leaves it standing, so the platform's `getSourceActor` (actor ??
      // item ?? activity) walked to the compendium and found no caster: no rider die, and every
      // "your next turn" clock judged against nobody. Every key is written, null where this
      // application has nothing to say, and `item` names the item actually used.
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

      // Native parity: an existing copy of THIS effect is re-enabled and re-clocked rather than
      // duplicated — by the copy's source stamp (the tray's key), or by name for the reaction
      // sliver (`matchNames`). Two effects of one concentration spell no longer collide: the
      // 5.x tray keyed on `origin` (concentration ?? effect) and this loop matched it bug-for-bug.
      const existing = actor.effects.find(e => (e._stats?.[sourceKey] === effect.uuid)
        || (matchNames && (e.name === effect.name)));
      let applied;
      // `clock` (2026-09-10): a caller that knows the effect's RAW window better than the pack's
      // numbers — the reaction's self-cast, whose "until the start of your next turn" is the
      // Reaction chip's clock pinned to the REACTOR's place — hands `{duration, start}` in, and
      // it lands on create and on refresh alike, over the activity's own changes. Nobody else
      // passes one; the platform's clock stands.
      if ( existing ) {
        // ⚠ `?? existing`: an empty-diff update returns undefined (same bug as the
        // mastery applier) and the receipt entry would vanish with it.
        // ⚠ `expired: false` on the refresh: core v14 MARKS an expired effect rather than
        // deleting it, so a re-cast over a leftover would otherwise re-clock a document the
        // platform still reads as expired — suppressed, granting nothing.
        const data = foundry.utils.mergeObject({
          _id: existing.id, disabled: false, duration: { expired: false },
          start: effect.constructor.getEffectStart()
        }, changes);
        if ( clock ) foundry.utils.mergeObject(data, clock);
        applied = (await existing.update(data)) ?? existing;
      } else {
        // `origin` is still written beside `system.origin` — this module's own readers
        // (`grantingActor`, `effectSourceOf`, the chip's owner) walk it; the platform reads
        // `system.origin` first and falls back to it. Phase 2 of the 6.0 pass migrates the readers.
        const data = foundry.utils.mergeObject({
          ...effect.toObject(), disabled: false, transfer: false, origin: origin.uuid,
          _stats: { [sourceKey]: effect.uuid, [effect.inCompendium ? "duplicateSource" : "compendiumSource"]: null }
        }, changes);
        // ⚠ THE TEMPLATE'S CLOCK STATE NEVER RIDES INTO AN APPLICATION (2026-09-21, the Miasma's
        // −2 AC listed as Unavailable and granting nothing). The MM pack ships a `start` on its
        // feature effects, and an effect with a start is one core v14's expiry registry TRACKS —
        // the template on the dragon's own item, sitting on its sheet, is marked `expired` at the
        // next time advance or the dragon's own turn start, and `toObject()` copies the mark: a
        // copy born expired is suppressed on arrival. The tray has the same hole. Fresh start,
        // unexpired — exactly what the refresh branch above already writes.
        data.duration = { ...(data.duration ?? {}), expired: false };
        data.start = effect.constructor.getEffectStart();
        if ( clock ) foundry.utils.mergeObject(data, clock);
        data.system ??= {};
        data.system.changes = await ActiveEffect.implementation.forApplication(
          data.system.changes, act ?? item ?? resolveUuid(source) ?? actor, actor);
        applied = await ActiveEffect.implementation.create(data, { parent: actor });
      }
      // Extended Spell (metamagic, 2026-09-09): the cast's effects run twice as long, 24 hours at
      // most — the option's own words, done here because every cast's effects land through this
      // one applier (the cast slice's, the save verdict's).
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
 * Apply and stamp in one move — the shape the riders, the cast slice and the save slice
 * use, where the receipt message already exists. Entries merge into `receiptMessage`'s
 * effectReceipt flag under the caller's own done-`marker`, so the rider and cast stages
 * can never mistake each other's work for their own. `message` is the card the application
 * answers to when it is not the receipt's own (the riders: the usage card, the receipt on the
 * damage roll); `activity` the applying activity when the caller knows it.
 */
export async function applyEffectsWithReceipt(receiptMessage, effects, targets,
  { concentration = null, scaling = 0, spellLevel, marker, source = null, message = null, activity = null } = {}) {
  const entries = await applyEffectsTo(targets, effects, {
    // Extended Spell rides the receipt card (the usage card carries the metamagic flag).
    extend: receiptMessage?.getFlag?.(MODULE_ID, METAMAGIC_FLAG)?.key === "extended",
    concentration, scaling, spellLevel, source, message: message ?? receiptMessage, activity });
  if ( !entries.length && !marker ) return;
  // ⚠ THE READ MOVED BELOW THE AWAIT, and the write is queued (core.js `queueFlagWrite`). This
  // used to clone the flag FIRST and merge into that copy after `applyEffectsTo` — a window
  // wide enough to drive a save through, and the save slice does: per-target independence runs
  // two targets' consequence passes concurrently against one card, so each merged into its own
  // stale copy and the later write dropped the other's entries. Same defect the damage receipt
  // had, wider window. A lost effect entry also strands the legendary-resistance unwind, which
  // reads effectReceipt to know what a failure applied and must now un-apply.
  await queueFlagWrite(receiptMessage, "effectReceipt", flag => {
    flag.targets ??= [];
    for ( const entry of entries ) joinEffectReceipt(flag, entry);
    // The marker is written even when nothing landed — "asked and answered" must be
    // re-run-proof, or every render would retry a cast whose targets are all gone.
    if ( marker ) flag[marker] = true;
  });
}

/**
 * Remove one applied rider effect and mark its receipt entry. Tolerates the effect already
 * being gone — the concentration cascade, a manual right-click, or the target's death may
 * all beat the button. Reload-proof like the damage revert: the state is the flag, re-read at
 * click time, and the idempotence guard is decide/receipt.js's.
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

/* --- the twin-chip dedupe floor (the 2026-08-18 session's finding ⓪/②) ---------------------
 * `isActiveGM()` is per-USER: two sessions on the same account both pass it, both run an
 * applier, and the existing re-enable-instead-of-stack check races replication — each
 * client reads "no existing copy" before the other's create arrives, and the chip lands
 * twice (the session's Hunter's Mark ×2, Slow ×2, double Restrained). The race cannot be
 * prevented (no cross-client session identity exists), so it converges here instead: when
 * a module-fingerprinted effect arrives and an ELDER effect with the same name and origin
 * already stands on the same actor, the newcomer deletes itself. Fingerprints only —
 * `applied` (the shared loop above) and `mastery` (the chip applier's own flag) — so
 * another module's deliberate same-name stack is never touched. Deterministic (creation
 * time, then id), idempotent (the other twin's delete is a caught no-op).
 */
Hooks.on("createActiveEffect", effect => {
  if ( !isActiveGM() ) return;
  const actor = effect.parent;
  if ( !(actor instanceof Actor) ) return;
  const fingerprinted = e => !!(e.getFlag(MODULE_ID, "applied") || e.getFlag(MODULE_ID, CHIP_FLAG));
  if ( !fingerprinted(effect) ) return;
  const born = e => e._stats?.createdTime ?? 0;
  const elder = actor.effects.some(e => {
    if ( (e.id === effect.id) || !fingerprinted(e) ) return false;
    if ( (e.name !== effect.name) || (e.origin !== effect.origin) ) return false;
    return (born(e) < born(effect)) || ((born(e) === born(effect)) && (e.id < effect.id));
  });
  if ( elder ) effect.delete().catch(() => { /* the other twin got there first */ });
});
