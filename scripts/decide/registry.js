/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the world-setting list parsers.
 *
 * Moved verbatim out of hold.js, maneuvers.js and hit-riders.js (PLAN.md Phase 2, "move, do
 * not rewrite"). Strings in, entries out — no `game`, no `setting()`, no warnings, no
 * globals. Each machine keeps a one-line EDGE wrapper that reads its setting and delegates,
 * which is the whole split: reading the world is EDGE, deciding what the string MEANS is not.
 *
 * ⚠ WHY THIS MATTERS MORE THAN IT LOOKS (ARCHITECTURE.md §6, the strict-parse contract): a
 * typo in a world setting does not raise anything. The entry simply drops and the feature it
 * named silently does nothing, forever, with no error to notice. These parsers are the only
 * thing standing between a stray character and a dead feature, and until now none of them
 * could be tested — `tools/check-registry.mjs` had to re-implement the parse with a lookalike
 * and say so in a comment. It imports the real ones now.
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js.
 */

/** The closed set of maneuver fold kinds. Unknown kinds are DROPPED, never guessed. */
export const MANEUVER_KINDS = new Set(["precision", "riposte", "interpose", "bash", "hew"]);

/** Split a comma list into trimmed, non-empty chunks — the shape every list setting wears. */
const chunks = raw => String(raw ?? "").split(",").map(s => s.trim()).filter(Boolean);

/** Split one `A:B` chunk into its trimmed halves. */
const pair = chunk => chunk.split(":").map(s => s?.trim());

/**
 * Parse the curated "Name:kind, Name:kind" interrupt list.
 * ⚠ Unknown kinds default to `ac` here — deliberately unlike the maneuver folds below, which
 * drop them. The difference is real: an interrupt with a mistyped kind is still a reaction
 * worth pausing for, and `ac` is the conservative reading; a fold with no recognised kind has
 * no machine to run at all.
 */
export function parseInterruptList(raw) {
  return String(raw ?? "").split(",").map(chunk => {
    const [name, kind] = pair(chunk);
    if ( !name ) return null;
    return { name, kind: (kind?.toLowerCase() === "damage") ? "damage" : "ac" };
  }).filter(Boolean);
}

/**
 * Parse the curated "Spell:Reaction" block list — which spells a reaction stops outright.
 * Keyed by the SPELL, so one reaction can appear here and in the interrupt list without the
 * two lists having to agree about anything. Both halves are required.
 */
export function parseBlockList(raw) {
  return String(raw ?? "").split(",").map(chunk => {
    const [spell, reaction] = pair(chunk);
    if ( !spell || !reaction ) return null;
    return { spell, reaction };
  }).filter(Boolean);
}

/**
 * Parse the "Name:kind" maneuver folds against the closed kind set.
 *
 * Returns `{ entries, unknown }` rather than warning: the warn-once bookkeeping is a side
 * effect and belongs to the EDGE caller, which owns the console and the seen-set. Same
 * dropping behaviour as before the move — an unrecognised kind is never guessed at.
 */
export function parseManeuverFolds(raw) {
  const entries = [];
  const unknown = [];
  for ( const chunk of chunks(raw) ) {
    const [name, kind] = pair(chunk);
    if ( !name || !MANEUVER_KINDS.has(kind?.toLowerCase()) ) { unknown.push(chunk); continue; }
    entries.push({ name, kind: kind.toLowerCase() });
  }
  return { entries, unknown };
}

/** Which marks pay, by system identifier — a bare comma list, no kinds. */
export function parseIdentifierList(raw) {
  return chunks(raw);
}

/**
 * Parse the "feature:rider" upgrade list — which of the attacker's own features replaces a
 * given mark's damage. Both halves required; the OWNERSHIP test belongs to the caller, which
 * needs an actor and is therefore EDGE.
 */
export function parseUpgradeList(raw) {
  return chunks(raw).map(chunk => {
    const [feature, rider] = pair(chunk);
    if ( !feature || !rider ) return null;
    return { feature, rider };
  }).filter(Boolean);
}
