/**
 * Battle Flow — the volley registry: which spells volley, and how each one's projectiles resolve.
 *
 * ⚠ THE REGISTRY IS VOLLEY MEMBERSHIP, because content data is wrong in both directions
 * (tools/scan-volley-spells.mjs): the premium pack ships Scorching Ray with NO count field,
 * Eldritch Blast with count "1" (its beams live only in prose), and Dimension Door with count "2"
 * AND a damage activity (a false positive that would volley its mishap damage). So a spell volleys
 * iff its NAME is listed here, with the listed handling, whatever its data says; adding a spell is
 * one entry.
 *   kind             "damage" (darts — simultaneous by RAW, aggregated per target) | "attack"
 *                    (rays — independent attacks, one real rollAttack each). The USED activity
 *                    must be of this type too, so a listed spell's other activities stay native.
 *   count            a formula (@item.level = cast level, @scaling provided) or a function
 *                    ({ activity, castLevel, rollData }) => n. Below 2 at this cast is the native
 *                    path (Eldritch Blast at character level 4 is one beam).
 *   distinctTargets  at most ONE projectile per creature by RAW — n clamps to the target count
 *                    and the popup refuses duplicate picks.
 * Not volleys: Prismatic Spray, Chain Lightning and Acid Splash are multi-target but SAVE-shaped —
 * nothing to aim per projectile; the saves pipeline owns them.
 * Exposed at `game.modules.get(MODULE_ID).api.volleyRegistry` so the smoke suites can register
 * scratch fixtures; the shipped list IS the supported scope.
 */
import { MODULE_ID, TITLE } from "./core.js";
import { VOLLEY_KINDS } from "./decide/registry.js";

/**
 * Eldritch Blast's beams band by CHARACTER level (5/11/17), not by the cast: PC rollData carries
 * details.level, NPC rollData details.cr with details.level 0. An unreadable level gets 0 — native.
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
 * ⚠ An entry whose `kind` is not in the closed set is REFUSED, not guessed (ARCHITECTURE §6 rule
 * 6), so the shipped list and a runtime-added one (the smoke suites' fixtures) obey one contract.
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
 * The projectile count for this use: deterministic rollData, the cast level riding in as both
 * `@item.level` and `@scaling` so either authoring convention evaluates.
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
