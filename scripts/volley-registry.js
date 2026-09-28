/**
 * Battle Flow — the volley registry. A spell volleys by its row alone, found by identifier then name (⚠ the pack's counts are wrong both
 * ways: Scorching Ray has none, Eldritch Blast says 1, Dimension Door says 2 — tools/scan-volley-spells.mjs).
 *   kind   "damage" (darts, aggregated per target) | "attack" (rays, a rollAttack each); the used activity must match
 *   count  a formula (@item.level the cast level, @scaling) or ({ activity, castLevel, rollData }) => n; under 2 is native
 *   distinctTargets  one projectile per creature, clamped to the target count
 */
import { MODULE_ID, TITLE } from "./core.js";
import { VOLLEY_KINDS, matchOf } from "./decide/registry.js";

/** Eldritch Blast's beams band by CHARACTER level (an NPC's CR stands in); unreadable → 0, native. */
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

/** Rows already warned about an unknown kind — once per session, not once per attack. */
const warnedEntries = new Set();

/** This spell's entry, or null; ⚠ an unknown `kind` is refused, never guessed (ARCHITECTURE §6). */
export function volleyEntryFor(item) {
  if ( item?.type !== "spell" ) return null;
  let key = null;
  for ( const k of VOLLEY_REGISTRY.keys() ) {
    const how = matchOf(k, item, ["spell"]);
    if ( how === "identifier" ) { key = k; break; }
    if ( how === "name" ) key ??= k;
  }
  const entry = (key !== null) ? (VOLLEY_REGISTRY.get(key) ?? null) : null;
  if ( entry && !VOLLEY_KINDS.has(entry.kind) ) {
    if ( !warnedEntries.has(key) ) {
      warnedEntries.add(key);
      console.warn(`${TITLE} | Volley registry: "${key}" declares kind "${entry.kind}" (${[...VOLLEY_KINDS].join("/")}) — ignored, never guessed.`);
    }
    return null;
  }
  return entry;
}

/** The projectile count at this cast level, offered as both `@item.level` and `@scaling`. */
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
