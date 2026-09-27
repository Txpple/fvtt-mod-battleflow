/**
 * Battle Flow — the reaction hold, part 1 of the `hold/` machine: THE READERS. Eligibility, the
 * item a reaction IS on an actor, its artwork, the AC it grants, whether its effect and its AC
 * have landed, and the one applier for the reaction's own self-cast effect. No hooks, no flag
 * writes. The `hold/` parts import in one direction (ARCHITECTURE.md §7); `index.js` is the face.
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
    // ⚠ Both must be real: an NPC's slot maxima are derived and can recompute to 0, leaving a
    // stale `value` that would advertise slots it cannot spend.
    if ( !slot?.value || !slot?.max ) continue;
    const numbered = /^spell(\d+)$/.exec(key);
    const slotLevel = numbered ? Number(numbered[1]) : slot.level;
    if ( Number.isFinite(slotLevel) && (slotLevel >= level) ) return true;
  }
  return false;
}

/**
 * The item that IS this reaction on this actor — where its effect lives, its art, its AC bonus.
 *
 * ⚠ ONE NAME CAN MATCH SEVERAL ITEMS, and the wrong match is silent: an armoured statblock
 * caster owns a mundane "Shield" and, via its cast activity's cached copy, a Shield SPELL; on an
 * unlinked token the equipment sorts first. Preference: the cached spell of the recorded cast
 * activity, then a usable reaction with effects, then any usable reaction, then one with effects.
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
 * `{ item, activity }` or null. Conservative: a hold the target cannot answer is a false stop.
 */
export async function usableReaction(actor, name) {
  if ( !actor || !name ) return null;

  // ⚠ The monster pattern first: a 2024 statblock casts through a "Spellcasting" feature's
  // `cast` ACTIVITY, whose uses are the resource; the linked spell item reports no uses and
  // would read as uncastable.
  const cast = await findCastActivity(actor, name);
  if ( cast ) return { item: cast.item, activity: cast.activity };
  // ⚠ EVERY item of that name, not the first — a worn shield and the Shield spell share it.
  for ( const item of actor.items.filter(i => i.name.toLowerCase() === name.toLowerCase()) ) {
    // A text-only feature (the 2024 Uncanny Dodge) counts: it has no activity, and the answer
    // spends the Reaction chip itself.
    if ( !isReactionItem(item) && !isTextOnlyFeature(item) ) continue;

    const uses = limitedUses(item);
    if ( uses === "spent" ) continue;                 // limited-use feature, none left
    if ( item.type === "spell" ) {
      // ⚠ `prepared` is a PC concept: every levelled spell on a 2024 statblock reads prepared 0.
      if ( (actor.type === "character") && !item.system.prepared ) continue;
      // ⚠ A spell can be paid by its OWN uses instead of a slot (a statblock's x/day pool);
      // monster slot maxima usually sit at 0.
      if ( (uses === "none") && !hasSpellSlot(actor, item.system.level) ) continue;
    }
    return { item, activity: null };
  }
  return null;
}

/**
 * The first listed interrupt this actor can use right now, or null. `spentOk` looks past a spent
 * Reaction — only for the greyed row the rescue popup shows beside a live `roll` row.
 */
export async function findInterrupt(actor, { isCritical, spentOk = false }) {
  if ( !actor || (!spentOk && reactionSpent(actor)) ) return null;
  for ( const entry of interruptEntries() ) {
    // `roll` rows are never THE reaction: they ride beside it (rollRescuesOf).
    if ( entry.kind === "roll" ) continue;
    const found = await usableReaction(actor, entry.name);
    if ( !found ) continue;
    // A reduction row makes the reaction a `damage` interrupt whatever the list's kind says.
    const reduce = reductionFor(found.item, entry.name);
    // A reduction for ANOTHER creature (Interception) is asked of the guards (damage-holds.js).
    if ( reduce?.row?.ally ) continue;
    const kind = reduce ? "damage" : entry.kind;
    // A natural 20 hits regardless of AC, so an AC-type reaction cannot save it — no pause.
    if ( isCritical && (kind === "ac") ) continue;
    if ( reduce ) {
      const pool = reduce.row.pool ? poolOf(actor, reduce.activity) : null;
      if ( pool && !(Number(pool.system?.uses?.value ?? 0) > 0) ) continue;
      // The row's voice rides the hold flag so views and announcements need no lookup;
      // `maneuver` decides whether the resolve also publishes the `maneuver` word.
      const row = reduce.row;
      return { entry: { ...entry, kind }, ...found, reduce: { formula: reduce.formula, activityId: reduce.activity.id,
        eyebrow: row.eyebrow ?? "Maneuver", spend: row.spend ?? "Superiority Die", hit: row.hit ?? "melee attack",
        by: row.by ?? "the die plus your modifier", maneuver: (row.eyebrow ?? "Maneuver") === "Maneuver" } };
    }
    // An `ac` reaction already standing is not offered again — an AC bonus does not stack. Only
    // `ac` (a damage reaction answers each trigger), and only here: the spell trigger keeps
    // asking, since skipping it would apply damage a standing Shield negates.
    if ( (entry.kind === "ac") && hasReactionEffect(actor, entry.name,
      { itemId: found.item.id, activityId: found.activity?.id }) ) continue;
    return { entry, ...found };
  }
  return null;
}

/**
 * The `roll` rows this actor holds: every Interrupt-list entry of kind `roll` whose feature is on
 * the sheet, with its cost shape (INTERRUPT_ROLLS) and uses read live off the item. Spent rows
 * included — the popup greys them (decide/rescue-hit.js `rescueRows`).
 * ⚠ A row that spends uses demands the item carry them: the 2014 Halfling "Lucky" shares the
 * name and has none (dnd5e plays that reroll itself).
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
 * The guards: creatures within reach of the one being hit that could answer with a `roll` row
 * whose rule is for ANOTHER creature (Protection) — its ally, not the attacker, the feat on the
 * sheet, its Reaction free and holding what the row demands. Each is asked in its own popup.
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
  // A reduction's pool in its own words and count — the die pool for Parry, the feature's own
  // uses for Stone's Endurance.
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
 * What the popup that rescues a hit would hold for this defender now: the rows, the records the
 * hold stamps, and whether any row is live. Null when the defender holds no `roll` row — the
 * hold is then the plain one-reaction popup.
 *
 * With no live reaction (`found` null), a held one is still SHOWN greyed when the reason is
 * visible to the table — the Reaction spent, or a natural 20 against an AC reaction — and never
 * otherwise (`hidePrimary`: a Shield already standing, a hopeless one).
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
 * The rows as the popup draws them NOW: the stamped rows with the `roll` rows' costs re-read live
 * (a point spent elsewhere, the Reaction taken), each with its rule verbatim — a `roll` row's off
 * INTERRUPT_ROLLS, the reaction's off its own item's text.
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
  try { return (await fromUuid(uuid))?.name ?? null; } catch { return null; }
}

/** Whatever a used activity should be MATCHED against: its linked spell, or its item. */
export async function reactionNameFor(activity) {
  return (await castSpellName(activity)) ?? activity?.item?.name ?? null;
}

/**
 * A feature's `cast` activity for the named spell, if this actor can use it as a reaction.
 * ⚠ No pool means AT-WILL here (a statblock's at-will spells carry `uses.max: ""`); a pool that
 * exists and is empty disqualifies.
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
 * Is the named reaction's effect already on this actor? Matched by NAME as well as origin: the
 * casting client applies from an item CLONE, so its origin uuid differs.
 * ⚠ `active`, never `!disabled`: v14 MARKS an expired effect instead of deleting it, and an
 * expired Shield still on the sheet grants nothing — reading it as standing skipped the next hold.
 */
export function hasReactionEffect(actor, reactionName, ids) {
  if ( !actor || !reactionName ) return false;
  const item = reactionItem(actor, reactionName, ids);
  const names = new Set((item?.effects?.contents ?? []).map(e => e.name));
  return actor.effects.some(e => e.active && (names.has(e.name)
    || (e.origin && item && e.origin.includes(item.id))));
}

/**
 * Put a cast reaction's own effect on its caster — only the reaction that answered a hold, only
 * onto the caster. Without it the hold reads a stale AC: Shield's +5 lives in a non-transfer
 * effect, so a cast alone moves nothing. Runs through the shared applier (applyEffectsTo) with
 * name matching and the `reactionEffect` marker. Returns receipt-shaped entries; [] on nothing.
 */
export async function applyReactionEffect(activity, actor, reactionName, ids) {
  try {
    // ⚠ A cast activity has no effects of its own — they live on the linked spell; fall back to
    // the reaction's item via reactionItem, never a bare name match (the worn shield).
    const own = (await activity?.getApplicableEffects?.()) ?? [];   // 6.0: profiles resolve asynchronously
    let effects = own;
    if ( !effects.length && reactionName ) {
      const spell = reactionItem(actor, reactionName, ids);
      effects = (spell?.effects?.contents ?? []).filter(e => !e.transfer);
    }
    if ( !effects.length ) return [];
    // ⚠ The pack writes "until the start of your next turn" as `turnStart`, and the platform
    // stamps `start` with whoever's turn it is — the attacker's. Such an effect takes the
    // Reaction chip's clock, pinned to the reactor (RULINGS *Chips and clocks*); out of combat
    // the pack's own clock stands.
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
 * Has the reaction's AC actually ARRIVED — not merely its effect row?
 * ⚠ An effect exists the instant it is created; the AC it grants appears only once derived data
 * recomputes, a beat later and per client. A verdict must wait on the NUMBER.
 */
export function reactionACArrived(actor, target) {
  if ( !hasReactionEffect(actor, target.reaction, target) ) return false;
  // Already applied when stamped: the snapshot contains the bonus, so there is no delta to see.
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
 * The AC a listed reaction grants, read from its own effect (the list is editable, so never
 * Shield's +5). Null for a non-numeric bonus (Defensive Duelist's proficiency).
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
