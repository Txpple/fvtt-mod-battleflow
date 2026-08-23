/**
 * Battle Flow — the volley registry (finding (ff), 2026-08-21; user directive verbatim:
 * "create an edge case utility that tracks and handles volley spells, since the scope of
 * this all is prem modules no homebrew … each spell may also have indiviual handling cases
 * … long term scalable, no hacks, modular").
 *
 * THE REGISTRY IS VOLLEY MEMBERSHIP. Content data alone was measured wrong in BOTH
 * directions (the fifteenth-session census, tools/scan-volley-spells.mjs): the 2024 premium
 * "Spells" pack ships Scorching Ray with NO count field (every fresh copy arrives bare, so
 * a per-copy graft can never keep up), Eldritch Blast ships count "1" (its beams live only
 * in prose), and Dimension Door ships count "2" WITH a damage activity — a structural false
 * positive that would have volley-popped its teleport-mishap damage. So: a spell volleys
 * iff its NAME is listed here, with the listed handling, regardless of what its copy's data
 * says — and an unlisted spell never volleys. Premium-modules scope by the same directive;
 * adding a spell is one entry.
 *
 * Entry shape — per-spell handling, because the spells genuinely differ:
 *   kind             "damage" (darts — simultaneous by RAW, aggregated per target) |
 *                    "attack" (rays — independent attacks, one real rollAttack each).
 *                    Membership also requires the USED activity to be of this type, so a
 *                    listed spell's utility/rider activities stay native.
 *   count            projectile count: a formula string (evaluated with @item.level = cast
 *                    level and @scaling provided, the volleys.js evaluator) or a function
 *                    ({ activity, castLevel, rollData }) => n. Below 2 at this cast means
 *                    the native path — Eldritch Blast at character level 4 is one beam and
 *                    never a volley.
 *   distinctTargets  RAW allows at most ONE projectile per creature (Steel Wind Strike:
 *                    "against each of up to five creatures") — n clamps to the target
 *                    count and the popup refuses duplicate picks.
 *
 * Census exclusions, on the record: Prismatic Spray, Chain Lightning and Acid Splash are
 * multi-target but SAVE-shaped — no aiming, nothing to drive per projectile; the saves
 * pipeline owns them.
 *
 * The registry is exposed at `game.modules.get(MODULE_ID).api.volleyRegistry` so the smoke
 * suites can register scratch fixtures (and a GM macro could, in principle, add an entry at
 * runtime — though the shipped list IS the supported scope).
 */
import { MODULE_ID, TITLE } from "./core.js";
import { VOLLEY_KINDS } from "./decide/registry.js";

/**
 * Eldritch Blast's beams band by CHARACTER level (5/11/17 — cantrip scaling), not by the
 * cast; measured 2026-08-21: PC rollData carries details.level, NPC rollData carries
 * details.cr with details.level 0. An actor whose level cannot be read gets 0 — native.
 */
function eldritchBlastBeams({ rollData }) {
  const level = Number(rollData?.details?.level) || Math.ceil(Number(rollData?.details?.cr) || 0);
  return (level > 0) ? 1 + Math.floor((level + 1) / 6) : 0;
}

export const VOLLEY_REGISTRY = new Map([
  ["Magic Missile",     { kind: "damage", count: "2 + @item.level" }],
  ["Scorching Ray",     { kind: "attack", count: "1 + @item.level" }],
  ["Eldritch Blast",    { kind: "attack", count: eldritchBlastBeams }],
  ["Steel Wind Strike", { kind: "attack", count: "5", distinctTargets: true }]
]);

/** Names already warned about an unknown kind — once per session, not once per attack. */
const warnedEntries = new Set();

/**
 * The registry entry for this item, or null — membership is name-keyed, spells only.
 *
 * ⚠ An entry whose `kind` is not in the closed set is REFUSED, not guessed at (ARCHITECTURE §6
 * rule 6), which is what makes the shipped list and a runtime-added one obey the same contract.
 * The shipped four cannot fail this; the API is open so the smoke suites can register scratch
 * fixtures, and that is the path where a bad kind can actually arrive.
 */
export function volleyEntryFor(item) {
  if ( item?.type !== "spell" ) return null;
  const entry = VOLLEY_REGISTRY.get(item.name) ?? null;
  if ( entry && !VOLLEY_KINDS.has(entry.kind) ) {
    if ( !warnedEntries.has(item.name) ) {
      warnedEntries.add(item.name);
      console.warn(`${TITLE} | Volley registry: "${item.name}" declares kind "${entry.kind}" (${[...VOLLEY_KINDS].join("/")}) — ignored, never guessed.`);
    }
    return null;
  }
  return entry;
}

/**
 * The projectile count for this use. The evaluator is the one the structural detector used
 * (deterministic rollData; the cast level rides in as both `@item.level` and `@scaling` so
 * either authoring convention evaluates) — only the SOURCE of the formula moved from the
 * item's data to the registry entry.
 */
export function resolveVolleyCount(entry, activity, castLevel) {
  let rollData = {};
  try { rollData = activity.getRollData({ deterministic: true }) ?? {}; } catch { rollData = {}; }
  rollData.scaling = Math.max(0, castLevel - (activity.item?.system?.level ?? 0));
  if ( rollData.item ) rollData.item = { ...rollData.item, level: castLevel };
  try {
    if ( typeof entry.count === "function" ) {
      return Math.floor(Number(entry.count({ activity, castLevel, rollData }))) || 0;
    }
    return Math.floor(dnd5e.utils.simplifyBonus(String(entry.count ?? ""), rollData)) || 0;
  } catch { return 0; }
}

Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { volleyRegistry: VOLLEY_REGISTRY });
});
