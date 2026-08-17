/**
 * Battle Flow — Phase 1.9A: effect riders and the shared effect applier (applyEffectsWithReceipt - the Phase 3 convergence point).
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE } from "./core.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1.9A — effect riders: a hit applies the effects riding it (PLAN.md section A).
 * The attack activity's own effect list is the on-hit set; application mirrors the native
 * tray's _applyEffectToActor (effect-application.mjs:182) — same origin rules
 * (concentration ?? effect), same dependentOn cascade, same re-enable-instead-of-stack for
 * an existing same-origin copy. Per-target on purpose: the damage riders' split-target
 * intersection refusal does not apply to effects, because each target gets its own document.
 * ------------------------------------------------------------------------------------------- */

/** The activity behind a chain message, from the flag every activity message carries. */
export function messageActivity(message) {
  const uuid = message?.getFlag("dnd5e", "activity")?.uuid;
  if ( !uuid ) return null;
  try { return fromUuidSync(uuid); } catch { return null; }
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
    const effects = activity?.applicableEffects ?? [];
    if ( !effects.length ) return;

    // The usage card carries the cast's metadata (concentration id, scaling, spell level).
    // Under suppression there is no card and a base-level non-concentration cast is assumed.
    // Since 1.9D this is a LIVE path: with Effect Riders on, a non-concentration attack
    // spell's card is suppressible (Ray of Frost — the effects land right here instead).
    // The carve-out keeps every card this fallback cannot stand in for: riders off, or a
    // concentration cast, whose origin linkage only the card can supply.
    const usage = attackMessage.getOriginatingMessage?.();
    const usageCard = (usage instanceof ChatMessage) ? usage : null;
    const concentration = usageCard
      ? usageCard.getAssociatedActor()?.effects.get(usageCard.system?.concentration) : null;

    await applyEffectsWithReceipt(damageMessage, effects, hits, {
      concentration,
      scaling: usageCard?.system?.scaling ?? 0,
      spellLevel: usageCard?.system?.spellLevel ?? undefined,
      marker: "ridersDone"
    });
  } catch(err) {
    console.error(`${TITLE} | Effect riders failed.`, err);
  }
}

/**
 * THE application loop — every document-copy effect application in the module runs through
 * here (the Phase 3 convergence, completed v1.8.0): the riders, the cast slice, the save
 * slice, and the reaction's self-cast sliver. Mirrors the native tray's
 * _applyEffectToActor: same origin rule (concentration ?? effect), same dependentOn
 * cascade, same re-enable-instead-of-stack. Returns receipt-shaped entries
 * ([{uuid, name, img, effects: [...]}], only targets where something landed) so callers
 * that cannot write a flag yet (the hold's answering client, whose response message does
 * not exist until after the application) still get the receipt to carry.
 *
 * The two policy options exist for the reaction sliver and stay this narrow:
 *  - `matchNames`: dedupe by name AS WELL AS origin — the casting client applies from an
 *    item CLONE (Activity#use clones the item), so its origin uuid differs from the one
 *    the continuing client would compute, and an origin-only test would happily apply
 *    Shield twice.
 *  - `extraFlags`: merged into the created/updated effect — how the reaction path keeps
 *    its `reactionEffect` marker (the flag inventory's "which module path created it").
 */
export async function applyEffectsTo(targets, effects,
  { concentration = null, scaling = 0, spellLevel, matchNames = false, extraFlags = null } = {}) {
  const out = [];
  for ( const target of targets ) {
    const actor = await fromUuid(target.uuid); // the targets snapshot carries ACTOR uuids
    if ( !(actor instanceof Actor) ) continue;
    const entry = { uuid: target.uuid, name: target.name, img: actor.img ?? null, effects: [] };
    for ( const effect of effects ) {
      const origin = concentration ?? effect;
      const effectFlags = foundry.utils.mergeObject({ flags: { dnd5e: {
        dependentOn: origin.uuid,
        scaling,
        spellLevel
      } } }, { flags: extraFlags ?? {} });
      // Native parity, bug-for-bug: an existing effect with this origin is re-enabled and
      // re-clocked rather than duplicated. (Like the tray, a concentration spell carrying
      // TWO effects collides with itself here — both share the concentration origin — but
      // deviating from the button the module is pressing would be worse than matching it.)
      const existing = actor.effects.find(e => (e.origin === origin.uuid)
        || (matchNames && (e.name === effect.name)));
      let applied;
      if ( existing ) {
        // ⚠ `?? existing`: an empty-diff update returns undefined (same bug as the
        // mastery applier) and the receipt entry would vanish with it.
        applied = (await existing.update(foundry.utils.mergeObject({
          ...effect.constructor.getInitialDuration(), disabled: false
        }, effectFlags))) ?? existing;
      } else {
        applied = await ActiveEffect.implementation.create(foundry.utils.mergeObject({
          ...effect.toObject(), disabled: false, transfer: false, origin: origin.uuid
        }, effectFlags), { parent: actor });
      }
      if ( applied && !entry.effects.some(e => e.id === applied.id) ) {
        entry.effects.push({ id: applied.id, name: applied.name, img: applied.img,
          description: applied.description ?? "", reverted: false });
      }
    }
    if ( entry.effects.length ) out.push(entry);
  }
  return out;
}

/**
 * Merge one applied-entry into an effectReceipt flag object — THE receipt bookkeeping,
 * shared by every writer (the appliers here, the mastery chips, the hold's answer paths)
 * so the merge discipline can never drift between them: entries keyed by uuid, effects
 * deduped by id, nothing ever overwritten.
 */
export function joinEffectReceipt(flag, entry) {
  let target = flag.targets.find(t => t.uuid === entry.uuid);
  if ( !target ) flag.targets.push(target = { uuid: entry.uuid, name: entry.name, img: entry.img ?? null, effects: [] });
  for ( const e of entry.effects ) {
    if ( !target.effects.some(x => x.id === e.id) ) target.effects.push(e);
  }
  return target;
}

/**
 * Apply and stamp in one move — the shape the riders, the cast slice and the save slice
 * use, where the receipt message already exists. Entries merge into `receiptMessage`'s
 * effectReceipt flag under the caller's own done-`marker`, so the rider and cast stages
 * can never mistake each other's work for their own.
 */
export async function applyEffectsWithReceipt(receiptMessage, effects, targets,
  { concentration = null, scaling = 0, spellLevel, marker } = {}) {
  const flag = foundry.utils.deepClone(
    receiptMessage.getFlag(MODULE_ID, "effectReceipt") ?? { targets: [] });
  const entries = await applyEffectsTo(targets, effects, { concentration, scaling, spellLevel });
  for ( const entry of entries ) joinEffectReceipt(flag, entry);
  // The marker is written even when nothing landed — "asked and answered" must be
  // re-run-proof, or every render would retry a cast whose targets are all gone.
  if ( marker ) flag[marker] = true;
  if ( flag.targets.length || marker ) await receiptMessage.setFlag(MODULE_ID, "effectReceipt", flag);
}

/**
 * Remove one applied rider effect and mark its receipt entry. Tolerates the effect already
 * being gone — the concentration cascade, a manual right-click, or the target's death may
 * all beat the button. Idempotent and reload-proof like the damage revert.
 */
export async function revertEffect(message, targetUuid, effectId) {
  const flag = foundry.utils.deepClone(message.getFlag(MODULE_ID, "effectReceipt") ?? {});
  const target = flag.targets?.find(t => t.uuid === targetUuid);
  const entry = target?.effects?.find(e => e.id === effectId);
  if ( !entry || entry.reverted ) return;
  const actor = await fromUuid(targetUuid);
  if ( actor instanceof Actor ) await actor.effects.get(effectId)?.delete();
  entry.reverted = true;
  await message.setFlag(MODULE_ID, "effectReceipt", flag);
}

