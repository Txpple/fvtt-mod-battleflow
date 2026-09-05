/**
 * Battle Flow — SPINE (ARCHITECTURE.md §7): the shared sheet and document readers.
 *
 * The machine-tier pass, Stage 1 (2026-09-05). Nine machines carried their own lower-case
 * helper, four their own feature-by-name, three their own activity-by-name, thirty sites the
 * same inline `try { fromUuidSync } catch` and five the same replace-and-validate die idiom —
 * the copy-the-last-machine growth of 2026-09-04/05, measured by grep before this file was
 * written. One home, the same bodies. **Nothing here decides anything**: every function reads a
 * document the caller already holds and answers a lookup question about it.
 *
 * ⚠ SPINE, NOT DECISION. `fromUuidSync` and `Roll` are Foundry globals, and `actor.items` is a
 * document collection — EDGE by §2's test, so this cannot live in decide/. It imports nothing
 * and owns no hook, no flag, no write; keep it that way. `core.js` and `shared.js` keep their own
 * copies of the uuid guard on purpose: core is the leaf and shared is this file's own layer.
 *
 * ⚠ Names match CASE-INSENSITIVELY everywhere here, because that is what every copy did: the
 * packs' names are the tables' keys and the tables are typed by hand.
 */

/** A name folded for comparison — the one lower-case helper. */
export const lower = s => String(s ?? "").toLowerCase();

/** Do two names mean the same feature, spell or activity? */
export const sameName = (a, b) => lower(a) === lower(b);

/** The item on the sheet by name, any type, or null. */
export const itemNamed = (actor, name) => actor?.items?.find(i => sameName(i.name, name)) ?? null;

/** The feat on the sheet by name, or null. */
export const featureNamed = (actor, name) =>
  actor?.items?.find(i => (i.type === "feat") && sameName(i.name, name)) ?? null;

/** The activity on an item by name, or null. */
export const activityNamed = (item, name) =>
  [...(item?.system?.activities ?? [])].find(a => sameName(a.name, name)) ?? null;

/** The first activity of a type on an item (`save`, `damage`, …), or null. */
export const activityOfType = (item, type) =>
  [...(item?.system?.activities ?? [])].find(a => a.type === type) ?? null;

/**
 * The document behind a uuid, or null — never a throw. `fromUuidSync` THROWS on a uuid whose
 * pack is not loaded and on a malformed one (polish.js measured it), and a flag written weeks
 * ago may name a document that has since gone; every caller wants "not here" for both.
 */
export function resolveUuid(uuid) {
  if ( !uuid ) return null;
  try { return fromUuidSync(uuid) ?? null; }
  catch { return null; }
}

/**
 * A die formula resolved on THIS actor's roll data, or null when it does not resolve: a scale
 * value (`@scale.battle-master.superiority.die`) read on the wrong sheet collapses to "0" in
 * silence (NOTES §2; d20-folds.js measured it), so an `@` left standing is a refusal, and a bare
 * "d8" reads as "1d8" so the Roll parser and the card agree.
 */
export function resolveDie(actor, raw) {
  if ( !raw || !actor ) return null;
  try {
    const r = String(Roll.replaceFormulaData(String(raw), actor.getRollData())).trim().replace(/^d(\d+)/i, "1d$1");
    return (Roll.validate(r) && !/@/.test(r)) ? r : null;
  } catch { return null; }
}
