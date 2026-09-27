// @ts-check
/**
 * Battle Flow — DECISION: a cast that ships ALTERNATIVE effects, where the caster picks one.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * A pack activity can carry alternative effects with nothing marking them so (Fire Shield's Warm
 * OR Chill Shield); the caster picks at the cast and only the pick lands (RULINGS *Effect
 * choices*). Decided here: which effects are the alternatives, and which land after the pick.
 */

const lower = s => String(s ?? "").toLowerCase();

/**
 * The alternatives this cast offers, in the row's order — the row's names that the activity
 * actually carries. Fewer than two present is no choice at all (a hand-trimmed copy of the
 * spell that ships one shield needs no popup): null.
 * @param {{effects: readonly string[]}} row
 * @param {string[]} effectNames  the names of the effects the activity applies
 * @returns {string[]|null}
 */
export function effectChoiceFor(row, effectNames) {
  const have = new Set((effectNames ?? []).map(lower));
  const options = (row?.effects ?? []).filter(n => have.has(lower(n)));
  return (options.length >= 2) ? options : null;
}

/**
 * The effects that land once the choice is made: every effect that is NOT an alternative, plus
 * the one chosen. A pending choice (nothing chosen yet) lands nothing — null, the caller waits.
 * A pick that is not one of the options is treated as pending (a stale or forged answer never
 * applies a stranger's effect).
 * @param {string[]} effectNames  the names of the effects the activity applies
 * @param {{options?: string[], chosen?: string|null}|null|undefined} choice
 * @returns {string[]|null}
 */
export function effectsAfterChoice(effectNames, choice) {
  const names = effectNames ?? [];
  if ( !choice?.options?.length ) return [...names];
  const options = new Set(choice.options.map(lower));
  const chosen = lower(choice.chosen);
  if ( !chosen || !options.has(chosen) ) return null;
  return names.filter(n => !options.has(lower(n)) || (lower(n) === chosen));
}
