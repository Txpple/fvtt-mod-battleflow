// @ts-check
/**
 * Battle Flow — DECISION: a cast that ships ALTERNATIVE effects, where the caster picks one.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * THE SHAPE (user, 2026-09-05: "when i apply warm or chill shield, it applies both … this should
 * also be a popup asking the player which shield to apply"). A pack activity carries several
 * effects and marks nothing to say they are alternatives — Fire Shield's Warm Shield OR Chill
 * Shield, "as you choose" — so the cast slice, reading "a utility with effects", landed them
 * all. The choice is the caster's (R1: judgment is never played), asked at the cast the way
 * Spirit Guardians' damage type is asked; only the pick lands. What is decided here is WHICH
 * of the activity's effects are the alternatives, and which land once the pick is made.
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
