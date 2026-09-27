// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): a cast whose effects are ALTERNATIVES (Fire Shield's
 * Warm OR Chill); only the caster's pick lands (RULINGS *Effect choices*).
 */

const lower = s => String(s ?? "").toLowerCase();

/** The row's alternatives the activity carries, in order; fewer than two is no choice (null).
 * @param {{effects: readonly string[]}} row
 * @param {string[]} effectNames
 * @returns {string[]|null} */
export function effectChoiceFor(row, effectNames) {
  const have = new Set((effectNames ?? []).map(lower));
  const options = (row?.effects ?? []).filter(n => have.has(lower(n)));
  return (options.length >= 2) ? options : null;
}

/** The non-alternatives plus the pick; null while pending — a pick not among the options is pending.
 * @param {string[]} effectNames
 * @param {{options?: string[], chosen?: string|null}|null|undefined} choice
 * @returns {string[]|null} */
export function effectsAfterChoice(effectNames, choice) {
  const names = effectNames ?? [];
  if ( !choice?.options?.length ) return [...names];
  const options = new Set(choice.options.map(lower));
  const chosen = lower(choice.chosen);
  if ( !chosen || !options.has(chosen) ) return null;
  return names.filter(n => !options.has(lower(n)) || (lower(n) === chosen));
}
