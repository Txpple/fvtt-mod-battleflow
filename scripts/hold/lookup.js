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
import { INTERRUPT_MULTIPLIERS, INTERRUPT_ROLLS } from "../decide/registry.js";
import { d20ModeOf, liveRows, plainRule, rescueRows } from "../decide/rescue-hit.js";
import { interruptEntries } from "../settings.js";
import { lower, activityNamed, reductionFor, holdsFor } from "../lookup.js";
import { alliesWithin, tokenForUuid } from "../geometry.js";
import { reactionSpent, poolOf, placeOf, chipData } from "../shared.js";
import { chipClock } from "../decide/chips.js";
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
 * The first curated interrupt this actor can actually use right now, or null. `spentOk` asks
 * past a spent Reaction — only for the greyed row the popup that rescues a hit shows beside a live
 * `roll` row (Slice A, 2026-09-24: "a spent row stays, greyed, with the reason as its tag").
 */
export async function findInterrupt(actor, { isCritical, spentOk = false }) {
  if ( !actor || (!spentOk && reactionSpent(actor)) ) return null;
  for ( const entry of interruptEntries() ) {
    // The `roll` kind (Slice A) is never the ONE reaction this walk finds: its rows ride beside it,
    // every one the sheet holds (rollRescuesOf, below), and a spent Reaction does not hide Lucky.
    if ( entry.kind === "roll" ) continue;
    const found = await usableReaction(actor, entry.name);
    if ( !found ) continue;
    // A reduction row makes the reaction a `damage` interrupt whatever the list's kind says —
    // the Battle Master's Parry beside the Monster Manual's (2026-09-05).
    const reduce = reductionFor(found.item, entry.name);
    // A reduction for ANOTHER creature (Interception, 2026-09-26) is never its owner's own hold:
    // it is asked of the guards at the damage (damage-holds.js).
    if ( reduce?.row?.ally ) continue;
    const kind = reduce ? "damage" : entry.kind;
    // A natural 20 hits regardless of AC, so an AC-type reaction cannot save it — no pause.
    if ( isCritical && (kind === "ac") ) continue;
    if ( reduce ) {
      // The pool the die comes from: none left, nothing to offer.
      const pool = reduce.row.pool ? poolOf(actor, reduce.activity) : null;
      if ( pool && !(Number(pool.system?.uses?.value ?? 0) > 0) ) continue;
      // The row's voice rides the hold flag (Slice A, 2026-09-24), so the views, the answer and
      // the announcement say "Reaction — Stone's Endurance … one use spent" without a lookup;
      // `maneuver` decides whether the resolve also publishes the `maneuver` word.
      const row = reduce.row;
      return { entry: { ...entry, kind }, ...found, reduce: { formula: reduce.formula, activityId: reduce.activity.id,
        eyebrow: row.eyebrow ?? "Maneuver", spend: row.spend ?? "Superiority Die", hit: row.hit ?? "melee attack",
        by: row.by ?? "the die plus your modifier", maneuver: (row.eyebrow ?? "Maneuver") === "Maneuver" } };
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

/**
 * The `roll` rows this actor holds (Slice A, ruled 2026-09-24): every Interrupt-list entry of the
 * `roll` kind whose feature is on the sheet, with the facts its row is drawn from — the cost
 * shape off INTERRUPT_ROLLS, the uses left read live off the ITEM (N1). Every row, spent or not:
 * the popup greys a spent one with its reason (decide/rescue-hit.js `rescueRows`).
 * ⚠ A row that spends uses demands the item carry them: the 2014 Halfling's "Lucky" trait shares
 * the name and has none — it is the natural-1 reroll dnd5e plays itself.
 * @returns {{name: string, row: object, item: Item, activity: object|null, left: number|null, max: number|null}[]}
 */
export function rollRescuesOf(actor) {
  if ( !actor ) return [];
  const out = [];
  for ( const entry of interruptEntries() ) {
    if ( entry.kind !== "roll" ) continue;
    const key = Object.keys(INTERRUPT_ROLLS).find(k => lower(k) === lower(entry.name));
    const row = key ? INTERRUPT_ROLLS[key] : null;
    if ( !row ) continue;   // a `roll` entry the table has no cost shape for: nothing to spend, never guessed
    if ( row.ally ) continue;   // Protection's Disadvantage is for another creature: a guard's row (protectionGuardsOf)
    const item = actor.items.find(i => (i.type === "feat") && (lower(i.name) === lower(key))
      && (!row.uses || (Number(i.system?.uses?.max) > 0)));
    if ( !item ) continue;
    const max = row.uses ? Number(item.system.uses.max) : null;
    out.push({ name: key, row, item, activity: activityNamed(item, row.activity),
      left: row.uses ? Math.max(0, Number(item.system.uses.value ?? 0)) : null, max });
  }
  return out;
}

/**
 * THE GUARDS (the fighting styles, 2026-09-26, ruled R1 and P1): the creatures standing within reach
 * of a creature being hit that could answer with a listed `roll` row whose rule is for ANOTHER
 * creature (Protection) — on its side, not the attacker, the row's feat on the sheet, its Reaction
 * free and holding what the row demands (Protection: a Shield). Each is asked in a popup of its own.
 * @returns {{uuid: string, name: string, row: string, itemId: string, activityId: string|null, passed: boolean}[]}
 */
export function protectionGuardsOf(defender, attacker) {
  const rows = interruptEntries().filter(e => e.kind === "roll")
    .map(e => Object.keys(INTERRUPT_ROLLS).find(k => lower(k) === lower(e.name)))
    .filter(k => k && INTERRUPT_ROLLS[k].ally);
  if ( !rows.length || !defender ) return [];
  const guarded = tokenForUuid(defender.uuid);
  if ( !guarded ) return [];
  const out = [];
  for ( const key of rows ) {
    const row = INTERRUPT_ROLLS[key];
    for ( const token of alliesWithin(guarded, row.ally, [attacker?.uuid]) ) {
      const actor = token.actor;
      if ( out.some(g => g.uuid === actor.uuid) ) continue;
      const item = actor.items.find(i => (i.type === "feat") && (lower(i.name) === lower(key)));
      if ( !item || reactionSpent(actor) || !holdsFor(actor, row.holding) ) continue;
      out.push({ uuid: actor.uuid, name: token.document?.name ?? actor.name, row: key, itemId: item.id,
        activityId: activityNamed(item, row.activity)?.id ?? null, passed: false });
    }
  }
  return out;
}

/** The facts a rescue row is judged on, read off the actor and the attack roll. */
function rescueFactsOf(actor, roll) {
  const d20 = roll?.dice?.[0] ?? null;
  return { reactionSpent: reactionSpent(actor), isCritical: !!roll?.isCritical,
    mode: d20ModeOf({ number: d20?.number, modifiers: d20?.modifiers }) };
}

/** A found reaction as the plain facts its row is drawn from (decide/rescue-hit.js `rescueRows`). */
function primaryFacts(actor, found) {
  const kind = found.reduce ? "damage" : found.entry.kind;
  const item = found.item;
  const spell = (item?.type === "spell") || (found.activity?.type === "cast");
  const max = Number(item?.system?.uses?.max);
  const multiplierKey = Object.keys(INTERRUPT_MULTIPLIERS).find(k => lower(k) === lower(found.entry.name));
  // A reduction's POOL in its own words and count (the Goliath walk, 2026-09-25: Stone's Endurance
  // read "a Superiority Die" and no count) — the die pool for Parry, the boon's own uses for Stone's.
  const reduceActivity = found.reduce ? item?.system?.activities?.get(found.reduce.activityId) : null;
  const poolItem = reduceActivity ? poolOf(actor, reduceActivity) : null;
  const pool = found.reduce ? { spend: found.reduce.spend ?? "Superiority Die",
    left: Number(poolItem?.system?.uses?.value ?? 0), max: Number(poolItem?.system?.uses?.max ?? 0) } : null;
  return { name: found.entry.name, kind,
    bonus: (kind === "ac") ? reactionACBonus(found.entry.name, actor, { itemId: item?.id, activityId: found.activity?.id }) : null,
    spell, pool, multiplier: multiplierKey ? INTERRUPT_MULTIPLIERS[multiplierKey].multiplier : null,
    uses: (!spell && (max > 0)) ? { left: Number(item.system.uses.value ?? 0), max } : null };
}

/** A `roll` record as the plain facts its row is drawn from. */
const rollFacts = r => ({ name: r.name, reaction: r.row.reaction, uses: r.row.uses, point: r.row.point ?? null, left: r.left });

/**
 * THE POPUP THAT RESCUES A HIT — what it would hold for this defender right now (Slice A, ruled
 * 2026-09-24): the rows (decide/rescue-hit.js `rescueRows`), the records the hold stamps, and
 * whether any row is live. Null when the defender holds no `roll` row at all — the hold then
 * stays exactly the one-reaction popup it has always been.
 *
 * The reaction row: `found` when the walk found one live. When it did not, a reaction the actor
 * holds is still SHOWN, greyed, where the reason is a fact the table can see — the Reaction spent
 * this round, or a natural 20 that no AC can answer ("a crit ignores AC", prototype scene 2c) —
 * and never otherwise (a Shield already standing, a hopeless one: `hidePrimary`).
 * @param {Actor} actor
 * @param {object} roll  the attack's D20Roll
 * @param {{found?: object|null, hidePrimary?: boolean}} [opts]
 */
export async function rescueStateOf(actor, roll, { found = null, hidePrimary = false } = {}) {
  const rolls = rollRescuesOf(actor);
  if ( !rolls.length ) return null;
  const facts = rescueFactsOf(actor, roll);
  let shown = found;
  if ( !found && !hidePrimary ) {
    const candidate = await findInterrupt(actor, { isCritical: false, spentOk: true });
    const kind = candidate ? (candidate.reduce ? "damage" : candidate.entry.kind) : null;
    if ( candidate && (facts.reactionSpent || (facts.isCritical && (kind === "ac"))) ) shown = candidate;
  }
  const rows = rescueRows({ primary: shown ? primaryFacts(actor, shown) : null, rolls: rolls.map(rollFacts), facts });
  return { rows, live: liveRows(rows).length > 0,
    records: rolls.map(r => ({ name: r.name, itemId: r.item.id, activityId: r.activity?.id ?? null })) };
}

/**
 * The rows as the popup draws them NOW: the stamped rows, the `roll` rows' costs re-read live (a
 * Luck Point spent on another hold since, the Reaction taken) — and each with its rule, verbatim
 * (law 8): a `roll` row's off INTERRUPT_ROLLS, the reaction's off its own item's text.
 * @param {Actor} actor
 * @param {{rows?: object[], reaction?: string, itemId?: string, activityId?: string|null}} target
 * @param {object} roll
 */
export function rescueRowsNow(actor, target, roll) {
  const stamped = target?.rows ?? [];
  const fresh = new Map(rescueRows({ primary: null, rolls: rollRescuesOf(actor).map(rollFacts),
    facts: rescueFactsOf(actor, roll) }).map(r => [r.key, r]));
  return stamped.map(r => {
    const now = (r.kind === "roll") ? (fresh.get(r.key) ?? { ...r, off: "no longer on the sheet", tag: "no longer on the sheet" }) : r;
    const rollKey = Object.keys(INTERRUPT_ROLLS).find(k => lower(k) === lower(r.key));
    const rule = rollKey ? INTERRUPT_ROLLS[rollKey].rule
      : plainRule(reactionItem(actor, r.key, (r.key === target.reaction) ? target : {})?.system?.description?.value ?? "");
    return { ...now, rule };
  });
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
 *
 * ⚠ `active`, never `!disabled` (the 2026-09-09 table report, reproduced 2026-09-10 by
 * tools/probe-shield-leftover.mjs). Core v14 does not delete an effect whose clock ran out —
 * it marks it `duration.expired`, and `isSuppressed` reads that mark, so the barrier stays on
 * the sheet under dnd5e's *Unavailable Effects* granting nothing. Reading it as standing told
 * the offer gate "Shield is already up" over an AC that had gone back down: the next hit got no
 * hold, no popup, and landed. `active` is core's own `!disabled && !isSuppressed` — the same
 * exclusion the reminder gate's effect read makes.
 */
export function hasReactionEffect(actor, reactionName, ids) {
  if ( !actor || !reactionName ) return false;
  const item = reactionItem(actor, reactionName, ids);
  const names = new Set((item?.effects?.contents ?? []).map(e => e.name));
  return actor.effects.some(e => e.active && (names.has(e.name)
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
    const own = (await activity?.getApplicableEffects?.()) ?? [];   // 6.0: profiles resolve asynchronously
    let effects = own;
    if ( !effects.length && reactionName ) {
      const spell = reactionItem(actor, reactionName, ids);
      effects = (spell?.effects?.contents ?? []).filter(e => !e.transfer);
    }
    if ( !effects.length ) return [];
    // THE CLOCK (2026-09-10, the stale-Shield report). The pack writes Shield's "until the start
    // of your next turn" as `{1 rounds, expiry: turnStart}` and the platform stamps `start` with
    // whoever's turn it IS — the attacker's, since a reaction is cast on somebody else's turn. So
    // the barrier outlived the text by a turn and expired at the ATTACKER's next turn, exactly
    // when the next swing came. The sentence is the Reaction chip's own (decide/chips.js
    // CHIP_WINDOWS.reaction: zero turns, judged at the REACTOR's turnStart, pinned to the
    // reactor's place) — so a pack effect that says turnStart takes that clock, in the running
    // combat the reactor is part of. Out of combat there is no turn: the pack's own clock stands.
    const sameSentence = effects.every(e => (e._source?.duration?.expiry ?? e.duration?.expiry) === "turnStart");
    const clock = sameSentence ? chipClock("reaction", placeOf(actor)) : null;
    return await applyEffectsTo([{ uuid: actor.uuid, name: actor.name }], effects, {
      activity: (effects === own) ? (activity ?? null) : null,   // the applying activity, when the effects are its own
      matchNames: true,
      extraFlags: { [MODULE_ID]: { reactionEffect: true } },
      source: actor.uuid, // the data-plane stamp's source — the reactor's own self-cast
      clock: clock?.start ? chipData(clock) : null
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
