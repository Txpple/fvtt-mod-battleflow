// @ts-check
/**
 * Battle Flow — the reaction hold's READERS (`hold/` part 1, ARCHITECTURE.md §7): eligibility, the
 * item a reaction IS, its AC and art, whether it landed, and the self-cast effect applier. No hooks.
 */
import { MODULE_ID, TITLE } from "../core.js";
import { limitedUses, isReactionItem, isTextOnlyFeature } from "../decide/eligible.js";
import { INTERRUPT_MULTIPLIERS, INTERRUPT_ROLLS, DUPLICATES, answers, duplicateEntries, listedNames } from "../decide/registry.js";
import { repeatRowFor } from "../decide/repeat-saves.js";
import { standingDuplicates, seesThrough } from "../decide/duplicates.js";
import { d20ModeOf, liveRows, plainRule, rescueRows } from "../decide/rescue-hit.js";
import { interruptEntries } from "../decide/registry.js";
import { lower, activityNamed, reductionFor, holdsFor, itemsNamed, featureNamed } from "../lookup.js";
import { alliesWithin, tokenForUuid } from "../geometry.js";
import { reactionSpent, poolOf, placeOf, chipData, effectSourceOf } from "../shared.js";
import { chipClock } from "../decide/chips.js";
import { applyEffectsTo } from "../effect-riders.js";

/** The item types a reaction's or a spell's row means: a spell or a monster's feature, never the
 * +1 Shield armor that shares the Shield spell's identifier. */
export const SPELL_ROW_TYPES = ["spell", "feat"];

/** Is a slot of at least `level` available (including pact magic)? */
function hasSpellSlot(actor, level) {
  if ( !level ) return true; // cantrip / at-will
  for ( const [key, slot] of Object.entries(actor.system.spells ?? {}) ) {
    // ⚠ Both: an NPC's derived max can recompute to 0 under a stale `value`.
    if ( !slot?.value || !slot?.max ) continue;
    const numbered = /^spell(\d+)$/.exec(key);
    const slotLevel = numbered ? Number(numbered[1]) : slot.level;
    if ( Number.isFinite(slotLevel) && (slotLevel >= level) ) return true;
  }
  return false;
}

/** The item that IS this reaction on this actor, a spell or a feature. ⚠ One row can match several
 * (a statblock's feature and a cast activity's cached SPELL), hence the preference order.
 * @param {any} actor
 * @param {string} reactionName
 * @param {{itemId?: string|null, activityId?: string|null}} [ids] */
export function reactionItem(actor, reactionName, { itemId, activityId } = {}) {
  if ( !actor || !reactionName ) return null;
  const cached = activityId
    ? actor.items.get(itemId)?.system.activities?.get(activityId)?.cachedSpell
    : null;
  if ( cached ) return cached;
  const matches = itemsNamed(actor, reactionName, { types: SPELL_ROW_TYPES });
  return matches.find(i => isReactionItem(i) && i.effects.size)
    ?? matches.find(i => isReactionItem(i))
    ?? matches.find(i => i.effects.size)
    ?? matches[0] ?? null;
}

/** `{ item, activity }` through which this actor can use the named reaction now, or null.
 * Conservative: a hold the target cannot answer is a false stop. */
export async function usableReaction(actor, name) {
  if ( !actor || !name ) return null;

  // ⚠ Statblock first: its "Spellcasting" `cast` ACTIVITY holds the uses; the linked spell has none.
  const cast = await findCastActivity(actor, name);
  if ( cast ) return { item: cast.item, activity: cast.activity };
  // ⚠ EVERY spell or feature answering the row: a worn shield shares the Shield spell's name.
  for ( const item of itemsNamed(actor, name, { types: SPELL_ROW_TYPES }) ) {
    // A text-only feature (Uncanny Dodge) counts; the answer spends the Reaction chip itself.
    if ( !isReactionItem(item) && !isTextOnlyFeature(item) ) continue;

    const uses = limitedUses(item);
    if ( uses === "spent" ) continue;                 // limited-use feature, none left
    if ( item.type === "spell" ) {
      // ⚠ `prepared` is a PC concept: every levelled spell on a 2024 statblock reads prepared 0.
      if ( (actor.type === "character") && !item.system.prepared ) continue;
      // ⚠ A statblock spell can be paid by its OWN x/day uses instead of a slot.
      if ( (uses === "none") && !hasSpellSlot(actor, item.system.level) ) continue;
    }
    return { item, activity: null };
  }
  return null;
}

/**
 * The first listed interrupt usable now; `spentOk` looks past a spent Reaction (a greyed row).
 * @returns {Promise<{entry: any, item: any, activity: any, reduce?: any}|null>}
 */
export async function findInterrupt(actor, { isCritical, spentOk = false }) {
  if ( !actor || (!spentOk && reactionSpent(actor)) ) return null;
  for ( const entry of interruptEntries() ) {
    // `roll` rows are never THE reaction: they ride beside it (rollRescuesOf).
    if ( entry.kind === "roll" ) continue;
    const found = await usableReaction(actor, entry.name);
    if ( !found ) continue;
    const reduce = reductionFor(found.item, entry.name);
    // A reduction for ANOTHER creature (Interception) is the guards' (damage-holds.js).
    if ( reduce?.row?.ally ) continue;
    const kind = reduce ? "damage" : entry.kind;
    // A natural 20 hits regardless of AC.
    if ( isCritical && (kind === "ac") ) continue;
    if ( reduce ) {
      const pool = reduce.row.pool ? poolOf(actor, reduce.activity) : null;
      if ( pool && !(Number(pool.system?.uses?.value ?? 0) > 0) ) continue;
      // The row's voice rides the hold flag; `maneuver` decides the resolve's `maneuver` word.
      const row = reduce.row;
      return { entry: { ...entry, kind }, ...found, reduce: { formula: reduce.formula, activityId: reduce.activity.id,
        eyebrow: row.eyebrow ?? "Maneuver", spend: row.spend ?? "Superiority Die", hit: row.hit ?? "melee attack",
        by: row.by ?? "the die plus your modifier", maneuver: (row.eyebrow ?? "Maneuver") === "Maneuver" } };
    }
    // A standing `ac` reaction is not re-offered (no stacking) — here only: the spell trigger
    // keeps asking, or damage a standing Shield negates would apply.
    if ( (entry.kind === "ac") && hasReactionEffect(actor, entry.name,
      { itemId: found.item.id, activityId: found.activity?.id }) ) continue;
    return { entry, ...found };
  }
  return null;
}

/**
 * The `roll` rows on this sheet with live uses, spent ones included (greyed). ⚠ A uses row needs
 * uses on the item: the 2014 Halfling "Lucky" shares the name and has none.
 * @returns {{name: string, row: object, item: Item, activity: object|null, left: number|null, max: number|null}[]}
 */
export function rollRescuesOf(actor) {
  if ( !actor ) return [];
  const out = [];
  for ( const entry of interruptEntries() ) {
    if ( entry.kind !== "roll" ) continue;
    const key = Object.keys(INTERRUPT_ROLLS).find(k => lower(k) === lower(entry.name));
    const row = key ? INTERRUPT_ROLLS[key] : null;
    if ( !key || !row ) continue;   // a `roll` entry the table has no cost shape for: nothing to spend, never guessed
    if ( row.ally ) continue;   // Protection's Disadvantage is for another creature: a guard's row (protectionGuardsOf)
    const item = itemsNamed(actor, key, { types: ["feat"] })
      .find(i => !row.uses || (Number(i.system?.uses?.max) > 0));
    if ( !item ) continue;
    const max = row.uses ? Number(item.system.uses.max) : null;
    out.push({ name: key, row, item, activity: activityNamed(item, row.activity),
      left: row.uses ? Math.max(0, Number(item.system.uses.value ?? 0)) : null, max });
  }
  return out;
}

/**
 * THE DUPLICATES standing on a defender (DUPLICATES, Mirror Image), read against this attacker: the row, the
 * count, the effects in the row's order, and whether the attacker sees through them. Null with none.
 * @returns {{key: string, at: number, die: number, count: number, of: number, ids: string[], names: string[], img: string|null, seenThrough: string|null}|null}
 */
export function duplicatesOf(defender, attacker) {
  if ( !defender ) return null;
  const listed = listedNames(duplicateEntries());
  for ( const effect of defender.effects ) {
    if ( !effect.active ) continue;
    const item = effectSourceOf(effect)?.item ?? null;
    const row = repeatRowFor({ table: DUPLICATES, item, effectName: effect.name, listed, answers });
    if ( !row ) continue;
    const standing = standingDuplicates(row, defender.effects.contents);
    if ( !standing.length ) return null;
    const seen = seesThrough(row, { statuses: attacker?.statuses ?? [], senses: attacker?.system?.attributes?.senses ?? {} });
    return { key: row.key, at: row.at, die: row.die, count: standing.length, of: Array.isArray(row.effect) ? row.effect.length : 1,
      ids: standing.map(e => e.id), names: standing.map(e => e.name), img: item?.img ?? effect.img ?? null, seenThrough: seen.why };
  }
  return null;
}

/**
 * The guards: allies in reach who could answer with a `roll` row for ANOTHER creature (Protection).
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
      const item = featureNamed(actor, key);
      if ( !item || reactionSpent(actor) || !holdsFor(actor, row.holding) ) continue;
      out.push({ uuid: actor.uuid, name: token.document?.name ?? actor.name, row: key, itemId: item.id,
        activityId: activityNamed(item, row.activity)?.id ?? null, passed: false });
    }
  }
  return out;
}

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
  // The pool: Parry's dice, or the feature's own uses (Stone's Endurance).
  const reduceActivity = found.reduce ? item?.system?.activities?.get(found.reduce.activityId) : null;
  const poolItem = reduceActivity ? poolOf(actor, reduceActivity) : null;
  const pool = found.reduce ? { spend: found.reduce.spend ?? "Superiority Die",
    left: Number(poolItem?.system?.uses?.value ?? 0), max: Number(poolItem?.system?.uses?.max ?? 0) } : null;
  return { name: found.entry.name, kind,
    bonus: (kind === "ac") ? reactionACBonus(found.entry.name, actor, { itemId: item?.id, activityId: found.activity?.id }) : null,
    spell, pool, multiplier: multiplierKey ? INTERRUPT_MULTIPLIERS[multiplierKey].multiplier : null,
    uses: (!spell && (max > 0)) ? { left: Number(item.system.uses.value ?? 0), max } : null };
}

const rollFacts = r => ({ name: r.name, reaction: r.row.reaction, uses: r.row.uses, point: r.row.point ?? null, left: r.left });

/**
 * The rescue popup's rows, records and liveness for this defender; null with no `roll` row. A dead
 * reaction shows greyed only for a visible reason (Reaction spent, a nat 20 against AC).
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
 * The stamped rows with `roll` costs re-read live, each with its rule pointer.
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

/** The spell a `cast` activity casts — the link, never the activity's own name. */
async function castSpellOf(activity) {
  if ( activity?.type !== "cast" ) return null;
  const uuid = activity.spell?.uuid;
  if ( !uuid ) return null;
  try { return (await fromUuid(uuid)) ?? null; } catch { return null; }
}

/** Whatever a used activity should be MATCHED against: its linked spell, or its item. */
export async function reactionItemFor(activity) {
  return (await castSpellOf(activity)) ?? activity?.item ?? null;
}

/** A reaction `cast` activity for the row's spell. ⚠ No pool is AT-WILL (`uses.max: ""`). */
async function findCastActivity(actor, spellName) {
  for ( const item of actor.items ) {
    for ( const activity of item.system?.activities?.contents ?? [] ) {
      if ( activity.type !== "cast" ) continue;
      if ( activity.activation?.type !== "reaction" ) continue;
      if ( !answers(spellName, await castSpellOf(activity), SPELL_ROW_TYPES) ) continue;
      const max = Number(activity.uses?.max);
      const pooled = Number.isFinite(max) && (max > 0);
      if ( pooled && !(Number(activity.uses?.value) > 0) ) continue;   // pool exists, spent
      return { item, activity };
    }
  }
  return null;
}

/** Is the reaction's effect on this actor? By NAME too: the caster applies from an item CLONE.
 * ⚠ `active`, never `!disabled`: v14 MARKS an expired effect instead of deleting it. */
export function hasReactionEffect(actor, reactionName, ids) {
  if ( !actor || !reactionName ) return false;
  const item = reactionItem(actor, reactionName, ids);
  const names = new Set((item?.effects?.contents ?? []).map(e => e.name));
  return actor.effects.some(e => e.active && (names.has(e.name)
    || (e.origin && item && e.origin.includes(item.id))));
}

/** Put the answering reaction's own effect on its caster (Shield's +5 is a non-transfer effect; a
 * cast alone moves no AC). Receipt-shaped entries, [] on nothing. */
export async function applyReactionEffect(activity, actor, reactionName, ids) {
  try {
    // ⚠ A cast activity's effects live on the linked spell: reactionItem, never a bare name match.
    const own = (await activity?.getApplicableEffects?.()) ?? [];   // 6.0: profiles resolve asynchronously
    let effects = own;
    if ( !effects.length && reactionName ) {
      const spell = reactionItem(actor, reactionName, ids);
      effects = (spell?.effects?.contents ?? []).filter(e => !e.transfer);
    }
    if ( !effects.length ) return [];
    // ⚠ A `turnStart` effect would be stamped on the ATTACKER's turn: it takes the Reaction chip's
    // clock, pinned to the reactor (RULINGS *Chips and clocks*).
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

/** Has the reaction's AC ARRIVED? ⚠ The derived AC lags the effect row, per client — wait on the NUMBER. */
export function reactionACArrived(actor, target) {
  if ( !hasReactionEffect(actor, target.reaction, target) ) return false;
  // Applied before the stamp: the snapshot already holds the bonus.
  if ( target.hadEffect ) return true;
  const bonus = reactionACBonus(target.reaction, actor, target);
  if ( bonus == null ) return true; // proficiency-scaled or formula bonus: not measurable here
  const liveAC = actor?.system?.attributes?.ac?.value;
  return Number.isFinite(liveAC) && (liveAC >= ((target.ac ?? 0) + bonus));
}

export function reactionImg(actor, reactionName, ids) {
  return reactionItem(actor, reactionName, ids)?.img ?? null;
}

/** The AC the reaction's own effect grants; null for a non-numeric bonus (Defensive Duelist). */
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
