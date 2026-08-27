/**
 * Battle Flow — Phase 1.9A: effect riders and the shared effect applier (applyEffectsWithReceipt - the Phase 3 convergence point).
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, isActiveGM, queueFlagWrite, statContext } from "./core.js";
import { effectRecord, joinEffectReceipt, revertableEffect } from "./decide/receipt.js";
import { statSourceOf } from "./shared.js";

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
    // Cards are never suppressed since v1.10.0, so the no-card fallback below (base-level,
    // non-concentration assumed) only covers genuinely chainless rolls — kept because the
    // registry walk can still come up empty (a roll made without its card in the log).
    const usage = attackMessage.getOriginatingMessage?.();
    const usageCard = (usage instanceof ChatMessage) ? usage : null;
    const concentration = usageCard
      ? usageCard.getAssociatedActor()?.effects.get(usageCard.system?.concentration) : null;

    await applyEffectsWithReceipt(damageMessage, effects, hits, {
      concentration,
      scaling: usageCard?.system?.scaling ?? 0,
      spellLevel: usageCard?.system?.spellLevel ?? undefined,
      marker: "ridersDone",
      source: statSourceOf(attackMessage)
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
 *
 * `source` is the CALLER's fact, not this loop's to derive: the actor uuid whose action is
 * applying these effects (the riders' attacker, the cast/save slices' caster, the reaction
 * sliver's own reactor — whose self-cast is exactly why no message walk from here could get
 * it right). It rides every record via the data-plane stamp, resolved once per application.
 */
export async function applyEffectsTo(targets, effects,
  { concentration = null, scaling = 0, spellLevel, matchNames = false, extraFlags = null, source = null } = {}) {
  const context = statContext(source);
  const out = [];
  for ( const target of targets ) {
    const actor = await fromUuid(target.uuid); // the targets snapshot carries ACTOR uuids
    if ( !(actor instanceof Actor) ) continue;
    const entry = { uuid: target.uuid, name: target.name, img: actor.img ?? null, effects: [] };
    for ( const effect of effects ) {
      const origin = concentration ?? effect;
      const effectFlags = foundry.utils.mergeObject({ flags: {
        dnd5e: {
          dependentOn: origin.uuid,
          scaling,
          spellLevel
        },
        // The module's application fingerprint — the twin-dedupe floor below polices ONLY
        // effects wearing it, so it can never delete another module's deliberate stack.
        [MODULE_ID]: { applied: true }
      } }, { flags: extraFlags ?? {} });
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
 * can never mistake each other's work for their own.
 */
export async function applyEffectsWithReceipt(receiptMessage, effects, targets,
  { concentration = null, scaling = 0, spellLevel, marker, source = null } = {}) {
  const entries = await applyEffectsTo(targets, effects, { concentration, scaling, spellLevel, source });
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
  const fingerprinted = e => !!(e.getFlag(MODULE_ID, "applied") || e.getFlag(MODULE_ID, "mastery"));
  if ( !fingerprinted(effect) ) return;
  const born = e => e._stats?.createdTime ?? 0;
  const elder = actor.effects.some(e => {
    if ( (e.id === effect.id) || !fingerprinted(e) ) return false;
    if ( (e.name !== effect.name) || (e.origin !== effect.origin) ) return false;
    return (born(e) < born(effect)) || ((born(e) === born(effect)) && (e.id < effect.id));
  });
  if ( elder ) effect.delete().catch(() => { /* the other twin got there first */ });
});
