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
 * The one effect applier — 1.9A's loop, extracted the day the cast slice arrived (the
 * Phase 3 convergence the v1.3.1 review predicted; the reaction effect's missing receipt is
 * now the only appliance left outside it). Apply `effects` to every target, mirroring the
 * native tray's _applyEffectToActor: same origin rule (concentration ?? effect), same
 * dependentOn cascade, same re-enable-instead-of-stack. Entries merge into
 * `receiptMessage`'s effectReceipt flag under the caller's own done-`marker`, so the rider
 * and cast stages can never mistake each other's work for their own.
 */
export async function applyEffectsWithReceipt(receiptMessage, effects, targets,
  { concentration = null, scaling = 0, spellLevel, marker } = {}) {
  const flag = foundry.utils.deepClone(
    receiptMessage.getFlag(MODULE_ID, "effectReceipt") ?? { targets: [] });
  for ( const target of targets ) {
    const actor = await fromUuid(target.uuid); // the targets snapshot carries ACTOR uuids
    if ( !(actor instanceof Actor) ) continue;
    let entry = flag.targets.find(t => t.uuid === target.uuid);
    if ( !entry ) flag.targets.push(entry = { uuid: target.uuid, name: target.name, img: actor.img ?? null, effects: [] });
    for ( const effect of effects ) {
      const origin = concentration ?? effect;
      const effectFlags = { flags: { dnd5e: {
        dependentOn: origin.uuid,
        scaling,
        spellLevel
      } } };
      // Native parity, bug-for-bug: an existing effect with this origin is re-enabled and
      // re-clocked rather than duplicated. (Like the tray, a concentration spell carrying
      // TWO effects collides with itself here — both share the concentration origin — but
      // deviating from the button the module is pressing would be worse than matching it.)
      const existing = actor.effects.find(e => e.origin === origin.uuid);
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
    if ( !entry.effects.length ) flag.targets.splice(flag.targets.indexOf(entry), 1);
  }
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

