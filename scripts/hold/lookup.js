/**
 * Battle Flow — the reaction hold, part 1 of the `hold/` machine: THE READERS. Eligibility
 * (which reaction this actor can take right now, and through which item and activity), the
 * item a reaction IS on an actor, its artwork, the AC it grants, whether its effect has landed
 * and whether the AC has actually arrived, and the one applier for the reaction's own self-cast
 * effect. No hooks, no flag writes — every other part asks here, none is asked back.
 *
 * The directory (ARCHITECTURE.md §7, the second customer of the directory rule, 2026-09-05):
 * one `hold` flag whose lifecycle outgrew a file, cut by MOMENT — readers, clock, the attack
 * trigger, the spell trigger, the answer, the continuation, the no-attack applier, the views —
 * `index.js` the only face. Parts import each other in ONE direction (a DAG, no cycle): the
 * index's import list is the registration order.
 */
import { MODULE_ID, TITLE } from "../core.js";
import { limitedUses, isReactionItem, isTextOnlyFeature } from "../decide/eligible.js";
import { INTERRUPT_REDUCTIONS } from "../decide/registry.js";
import { interruptEntries } from "../settings.js";
import { reactionSpent, poolOf } from "../shared.js";
import { applyEffectsTo } from "../effect-riders.js";

/** Is a slot of at least `level` available (including pact magic)? */
function hasSpellSlot(actor, level) {
  if ( !level ) return true; // cantrip / at-will
  for ( const [key, slot] of Object.entries(actor.system.spells ?? {}) ) {
    // Both must be real. A remaining value with a zero maximum is phantom data — an NPC's
    // maxima are DERIVED from spellcasting progression and recompute to 0, leaving a stale
    // `value` behind that would advertise slots the actor cannot actually spend, and hold
    // every attack for a reaction it can never cast.
    if ( !slot?.value || !slot?.max ) continue;
    const numbered = /^spell(\d+)$/.exec(key);
    const slotLevel = numbered ? Number(numbered[1]) : slot.level;
    if ( Number.isFinite(slotLevel) && (slotLevel >= level) ) return true;
  }
  return false;
}

/**
 * The item that actually IS this reaction on this actor — for every question asked ABOUT a
 * reaction after eligibility: where its effect lives, what it looks like, what its AC bonus is.
 *
 * ⚠ ONE NAME CAN MATCH SEVERAL ITEMS, and the wrong match is silent. An armoured statblock
 * caster owns a mundane shield (`equipment` named "Shield" — no effects, no activation) AND,
 * because a `cast` activity keeps its spell as a cached copy on the actor, a Shield SPELL.
 * `items.find()` returns whichever sorts first, and on an unlinked token the base actor's
 * equipment sorts ahead of the delta-created cached spell. Every downstream question then
 * interrogates the wrong document: "has the effect landed?" is answered no forever, the +5
 * becomes unmeasurable so hopeless holds stop being skippable, and the popup shows a shield's
 * artwork above a shield's description. findInterrupt learned this for ELIGIBILITY (it tests
 * every match, ground truth 2026-08-15); these lookups never did, and the result was a hold
 * that resolved correctly as a miss while announcing "Reaction — not applied … so this
 * resolves as a hit" — authoritative and wrong (caught by smoke-hold's statblock section).
 *
 * Preference order: the cached spell of the cast activity the hold recorded, because a
 * statblock's Shield lives there and nowhere else; then a match that can really be used as a
 * reaction; then one that at least carries effects; then whatever is left.
 */
export function reactionItem(actor, reactionName, { itemId, activityId } = {}) {
  if ( !actor || !reactionName ) return null;
  const cached = activityId
    ? actor.items.get(itemId)?.system.activities?.get(activityId)?.cachedSpell
    : null;
  if ( cached ) return cached;
  const matches = actor.items.filter(i => i.name.toLowerCase() === reactionName.toLowerCase());
  return matches.find(i => isReactionItem(i) && i.effects.size)
    ?? matches.find(i => isReactionItem(i))
    ?? matches.find(i => i.effects.size)
    ?? matches[0] ?? null;
}

/**
 * Can this actor use the named reaction RIGHT NOW — and through which item and activity?
 * Returns `{ item, activity }` or null. Eligibility is deliberately conservative: a hold the
 * target cannot answer is a pure false stop.
 *
 * Asked by both triggers. The attack trigger walks the curated interrupt list until one of
 * them answers; the spell trigger asks about exactly one reaction by name (the one its block
 * list pairs with the spell being cast), which is why this is a lookup rather than a loop.
 */
export async function usableReaction(actor, name) {
  if ( !actor || !name ) return null;

  // ⚠ THE MONSTER PATTERN COMES FIRST, because it is the common one. A 2024 statblock does
  // not cast from the spell item at all: its "Spellcasting" feature carries one `cast`
  // ACTIVITY per spell, and the resource lives on that activity — verified on Skeletal Mage
  // ("Shield - Spellcasting", activation reaction, uses 1/1, consumption activityUses) and
  // on the compendium Green Hag, which has the same shape on two features. The spell item
  // that activity points at is a linked target: it reports spellSlot:true and no uses, so
  // interrogating IT concluded the monster could not cast, and no statblock caster ever
  // held (reported live 2026-08-15).
  const cast = await findCastActivity(actor, name);
  if ( cast ) return { item: cast.item, activity: cast.activity };
  // ⚠ EVERY item of that name, not the first. A caster who both wears a shield and knows
  // Shield has two items called "Shield", and `find` returned whichever sorted first — so
  // picking the mundane one disqualified the entry and the spell was never even considered.
  // That is most armoured statblock casters.
  for ( const item of actor.items.filter(i => i.name.toLowerCase() === name.toLowerCase()) ) {
    // The ABILITY by name, not its effect (user, 2026-09-02): a listed feature the pack ships
    // as text only — the 2024 Uncanny Dodge — is found the way the maneuver folds find
    // Riposte. It has no activity to use; the answer spends the Reaction chip itself.
    if ( !isReactionItem(item) && !isTextOnlyFeature(item) ) continue;

    const uses = limitedUses(item);
    if ( uses === "spent" ) continue;                 // limited-use feature, none left
    if ( item.type === "spell" ) {
      // ⚠ `prepared` is a PC concept. Every levelled spell on a 2024-statblock NPC reads
      // prepared: 0 — verified on Skeletal Mage, whose whole spell list does — so gating on
      // it disqualified the entire monster side of this feature in silence.
      if ( (actor.type === "character") && !item.system.prepared ) continue;
      // ⚠ A spell can be paid for by its OWN limited uses rather than a slot: the Monster
      // Manual's "Additional Spells" x/x pool, which is how most statblock casters carry
      // Shield. Requiring a slot meant those never held, because monster slot maxima derive
      // from a caster level statblocks rarely set and sit at 0.
      if ( (uses === "none") && !hasSpellSlot(actor, item.system.level) ) continue;
    }
    return { item, activity: null };
  }
  return null;
}

/**
 * A listed reaction whose effect is a REDUCTION the module can roll (decide/registry.js
 * INTERRUPT_REDUCTIONS — the Battle Master's Parry): the found item carries the row's activity,
 * whose healing formula is the number. Null for anything else — the Monster Manual's Parry is an
 * AC reaction of the same name and carries no such activity, so it stays `ac`.
 */
function reductionFor(item, reactionName) {
  const key = Object.keys(INTERRUPT_REDUCTIONS).find(k => k.toLowerCase() === String(reactionName ?? "").toLowerCase());
  const row = key ? INTERRUPT_REDUCTIONS[key] : null;
  if ( !row ) return null;
  const activity = [...(item?.system?.activities ?? [])].find(a => a.name?.toLowerCase() === row.activity.toLowerCase()) ?? null;
  const h = activity?.healing;
  const formula = h ? (h.custom?.enabled ? h.custom.formula : ((Number(h.number) > 0 && Number(h.denomination) > 0) ? `${h.number}d${h.denomination}${h.bonus ? ` + ${h.bonus}` : ""}` : (h.bonus || null))) : null;
  if ( !activity || !formula ) return null;
  return { row, activity, formula };
}

/**
 * The first curated interrupt this actor can actually use right now, or null.
 */
export async function findInterrupt(actor, { isCritical }) {
  if ( !actor || reactionSpent(actor) ) return null;
  for ( const entry of interruptEntries() ) {
    const found = await usableReaction(actor, entry.name);
    if ( !found ) continue;
    // A reduction row makes the reaction a `damage` interrupt whatever the list's kind says —
    // the Battle Master's Parry beside the Monster Manual's (2026-09-05).
    const reduce = reductionFor(found.item, entry.name);
    const kind = reduce ? "damage" : entry.kind;
    // A natural 20 hits regardless of AC, so an AC-type reaction cannot save it — no pause.
    if ( isCritical && (kind === "ac") ) continue;
    if ( reduce ) {
      // The pool the die comes from: none left, nothing to offer.
      const pool = reduce.row.pool ? poolOf(actor, reduce.activity) : null;
      if ( pool && !(Number(pool.system?.uses?.value ?? 0) > 0) ) continue;
      return { entry: { ...entry, kind }, ...found, reduce: { formula: reduce.formula, activityId: reduce.activity.id } };
    }
    // ALREADY STANDING ⇒ DON'T ASK AGAIN (user call, the v1.15.0 walk's finding ⑥: "if they
    // have shield up, just dont prompt for shield"). Gren was re-prompted for Shield with his
    // +5 already active — a pause offering a choice that changes nothing, which is the false
    // stop this gate exists to prevent (DESIGN.md §4: the GM/player click economy).
    //
    // Narrow on purpose, twice over:
    //  - `ac` kind ONLY. An AC bonus does not stack, so a second cast is pure waste. A
    //    `damage` reaction is a different question — Absorb Elements grants resistance to the
    //    TRIGGERING damage type, so a standing one is no reason to refuse the next trigger.
    //  - The attack trigger ONLY. This function is not on the spell/negate path, and that is
    //    deliberate: a standing Shield already grants "no damage from Magic Missile", so
    //    silently skipping the hold there would apply damage to someone immune to it. That
    //    trigger keeps asking until it can auto-negate (not built; recorded in DESIGN.md).
    if ( (entry.kind === "ac") && hasReactionEffect(actor, entry.name,
      { itemId: found.item.id, activityId: found.activity?.id }) ) continue;
    return { entry, ...found };
  }
  return null;
}

/** The spell a `cast` activity casts — the activity's own name is decoration, the link is truth. */
async function castSpellName(activity) {
  if ( activity?.type !== "cast" ) return null;
  const uuid = activity.spell?.uuid;
  if ( !uuid ) return null;
  try { return (await fromUuid(uuid))?.name ?? null; } catch(err) { return null; }
}

/** Whatever a used activity should be MATCHED against: its linked spell, or its item. */
export async function reactionNameFor(activity) {
  return (await castSpellName(activity)) ?? activity?.item?.name ?? null;
}

/**
 * A feature's `cast` activity for the named spell, if this actor can use it as a reaction.
 *
 * ⚠ "No pool" means AT-WILL here, not "unavailable" — the opposite of the spell-item rule. A
 * statblock's at-will spells carry `uses.max: ""` and no consumption target at all (the Green
 * Hag's Spellcasting feature is exactly this), so demanding a pool would block every at-will
 * reaction. A pool that exists and is empty still disqualifies.
 */
async function findCastActivity(actor, spellName) {
  const wanted = spellName?.toLowerCase();
  for ( const item of actor.items ) {
    for ( const activity of item.system?.activities?.contents ?? [] ) {
      if ( activity.type !== "cast" ) continue;
      if ( activity.activation?.type !== "reaction" ) continue;
      if ( (await castSpellName(activity))?.toLowerCase() !== wanted ) continue;
      const max = Number(activity.uses?.max);
      const pooled = Number.isFinite(max) && (max > 0);
      if ( pooled && !(Number(activity.uses?.value) > 0) ) continue;   // pool exists, spent
      return { item, activity };
    }
  }
  return null;
}

/**
 * Is the named reaction's effect already on this actor? Matched by NAME as well as origin:
 * the casting client applies from an item CLONE (Activity#use clones the item), so its
 * origin uuid differs from the one the continuing client would compute, and an origin-only
 * test would happily apply Shield twice.
 */
export function hasReactionEffect(actor, reactionName, ids) {
  if ( !actor || !reactionName ) return false;
  const item = reactionItem(actor, reactionName, ids);
  const names = new Set((item?.effects?.contents ?? []).map(e => e.name));
  return actor.effects.some(e => !e.disabled && (names.has(e.name)
    || (e.origin && item && e.origin.includes(item.id))));
}

// The reaction's self-cast sliver, CONVERGED at v1.8.0: the application runs through the
// one shared loop (applyEffectsTo — name-or-origin dedupe for the clone-origin problem
// above, the reactionEffect marker via extraFlags), and the entries it returns become the
// standard effectReceipt on whichever message the answer path OWNS (the response message,
// or the held message itself) — the §2.5 receipt/revert gap, closed. Two appliers remain
// in the module by POLICY, not accident: this shared loop for document copies, and
// applyMasteryEffect for authored chips (see its comment for why that stays separate).
// Returns receipt-shaped entries; [] when nothing landed or the application failed.
/**
 * Put a cast reaction's own effect on its caster — the button the native effects tray is
 * waiting for someone to press. Scoped hard: only the reaction that answered a hold, only
 * onto the caster, only while that hold is open. This is a deliberate sliver of Phase 3,
 * and it exists because without it the whole feature reads a stale AC and lies: Shield's +5
 * lives in a non-transfer effect, so a cast alone moves nothing.
 *
 * Mirrors EffectApplicationElement._applyEffectToActor (5.3.3): re-enable and refresh the
 * duration of an existing same-origin effect, otherwise create it disabled:false /
 * transfer:false with origin set, so the system's own cleanup and expiry apply unchanged.
 */
export async function applyReactionEffect(activity, actor, reactionName, ids) {
  try {
    // ⚠ A cast activity has no effects of its own — they live on the spell it links to. Its
    // owning item is the feature ("Spellcasting"), so fall back to the reaction's own item on
    // this actor, which is where Imperceptible Barrier actually sits. Resolved through
    // reactionItem, never a bare name match: on an armoured caster that finds the worn shield.
    let effects = activity?.applicableEffects ?? [];
    if ( !effects.length && reactionName ) {
      const spell = reactionItem(actor, reactionName, ids);
      effects = (spell?.effects?.contents ?? []).filter(e => !e.transfer);
    }
    if ( !effects.length ) return [];
    return await applyEffectsTo([{ uuid: actor.uuid, name: actor.name }], effects, {
      matchNames: true,
      extraFlags: { [MODULE_ID]: { reactionEffect: true } },
      source: actor.uuid // the data-plane stamp's source — the reactor's own self-cast
    });
  } catch(err) {
    console.error(`${TITLE} | Could not apply the reaction's effect — apply it from the card.`, err);
    return [];
  }
}

/**
 * Has the reaction's AC actually ARRIVED — as opposed to "is there an effect row for it"?
 *
 * ⚠ These are different questions, and treating them as one is how a hold announced
 * "Shield raises AC to 12 — the attack still hits" as fact while the same actor read AC 17 a
 * moment later (reported live 2026-08-15). An effect document exists the instant it is
 * created; the AC it grants appears only once derived data recomputes, which happens a beat
 * later and on every client separately. A verdict must wait on the NUMBER.
 */
export function reactionACArrived(actor, target) {
  if ( !hasReactionEffect(actor, target.reaction, target) ) return false;
  // Already applied when we stamped, so the snapshot contains the bonus and there is no delta
  // to look for — the effect row is the whole of what can be checked.
  if ( target.hadEffect ) return true;
  const bonus = reactionACBonus(target.reaction, actor, target);
  if ( bonus == null ) return true; // proficiency-scaled or formula bonus: not measurable here
  const liveAC = actor?.system?.attributes?.ac?.value;
  return Number.isFinite(liveAC) && (liveAC >= ((target.ac ?? 0) + bonus));
}

/** The reaction's own artwork, for cards that talk about it. */
export function reactionImg(actor, reactionName, ids) {
  return reactionItem(actor, reactionName, ids)?.img ?? null;
}

/**
 * The AC a listed reaction actually grants, read from the reaction's OWN effect instead of
 * hardcoding Shield's +5 — the interrupt list is user-editable, so anything that assumes
 * Shield is wrong for the other twelve entries. Returns null for a non-numeric bonus (a
 * proficiency-scaled one like Defensive Duelist), which simply omits the "would it flip" line.
 */
export function reactionACBonus(reactionName, actor, ids) {
  const item = reactionItem(actor, reactionName, ids);
  for ( const effect of item?.effects ?? [] ) {
    for ( const change of effect.changes ?? [] ) {
      if ( change.key !== "system.attributes.ac.bonus" ) continue;
      const value = Number(change.value);
      if ( Number.isFinite(value) ) return value;
    }
  }
  return null;
}
