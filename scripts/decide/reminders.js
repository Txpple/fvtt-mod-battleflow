// @ts-check
/**
 * Battle Flow — DECISION: what bends an attack roll, and what it nets to.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports.
 *
 * THE GATE'S ARITHMETIC (HANDOFF Stage 2, 2026-09-01). The gate lists every source of
 * Advantage or Disadvantage it can read off the table and shows the resolution; a human presses
 * the mode (DESIGN R-A — nothing here sets one). The resolution is the 5e rule, restated by the
 * user as the ruling this file pins:
 *
 *   adv / adv                → Advantage        (more of one side is still one side)
 *   adv / disadv             → a normal roll    (they cancel)
 *   adv / disadv / disadv    → a normal roll    (however many of each — never a majority vote)
 *
 * A source whose bend is UNKNOWN (a prone target at an unmeasurable distance) is listed for the
 * table to judge and does not vote.
 *
 * The CONDITION TABLE itself — the thirteen rows and their glossary clauses — is membership
 * data and lives in decide/registry.js (`CONDITION_BENDS`), one declaration beside the list
 * spec that admits it; `conditionSources` below takes it as a parameter.
 */

/** The flag the gate stamps on the attack message it re-issued (`flags.<module>.reminder`). */
export const REMINDER_FLAG = "reminder";

/** The condition's name as the table says it. */
const conditionName = key => key.charAt(0).toUpperCase() + key.slice(1);

/**
 * The sources the CONDITION TABLE yields for one roll, from plain facts: which listed
 * conditions the attacker has, which the target has. A row with a bend on that side counts; a
 * row with only a note is listed for the table and never counted (bend null).
 *
 * ⚠ `enabled` and `table` are REQUIRED, and neither defaults (review finding 11c): the list IS
 * the switch — a caller that forgets it is a caller that reads nothing, never one that reads
 * everything — and the table is the registry's, handed in because this layer imports nothing.
 *
 * @param {{attackerStatuses?: Iterable<string>, targetStatuses?: Iterable<string>,
 *          enabled: Iterable<string>,
 *          table: Readonly<Record<string, Readonly<{attacker: "advantage"|"disadvantage"|null, target: "advantage"|"disadvantage"|null, rule: string, caveat?: string, note?: string}>>>,
 *          attackerName?: string, targetName?: string}} facts
 *        `enabled` = the Condition Sources list; a condition not in it is not read at all.
 *        `table` = `CONDITION_BENDS` (decide/registry.js), in the order the table reads it.
 */
export function conditionSources({ attackerStatuses = [], targetStatuses = [], enabled, table,
  attackerName = "You", targetName = "the target" }) {
  const on = new Set(enabled ?? []);
  const mine = new Set(attackerStatuses);
  const theirs = new Set(targetStatuses);
  const out = [];
  for ( const key of Object.keys(table ?? {}) ) {
    if ( !on.has(key) ) continue;
    const row = table[key];
    if ( !row ) continue;
    const name = conditionName(key);
    if ( mine.has(key) ) {
      if ( row.attacker ) {
        out.push(reminderSource("condition", row.attacker,
          `${attackerName} — ${name}${row.caveat ? ` (${row.caveat})` : ""}`, row.rule));
      } else if ( row.note ) {
        out.push(reminderSource("condition", null, `${attackerName} — ${name}: ${row.note}`, row.rule));
      }
    }
    if ( theirs.has(key) && row.target ) {
      out.push(reminderSource("condition", row.target,
        `${targetName} is ${name}${row.caveat ? ` (${row.caveat})` : ""}`, row.rule));
    }
  }
  return out;
}

/**
 * One source of Advantage or Disadvantage on a roll.
 * @param {string} kind          a REMINDER_KINDS key (decide/registry.js)
 * @param {"advantage"|"disadvantage"|null} bend   what it does to the roll; null = listed, not counted
 * @param {string} label         the one-line fact, in the table's names ("You Vexed Hobgoblin")
 * @param {string} [detail]      the rule line under it
 */
export function reminderSource(kind, bend, label, detail = "") {
  return { kind, bend, label, detail };
}

/**
 * THE NET. Any Advantage against any Disadvantage is a normal roll, however many of each;
 * otherwise whichever side is present; nothing present is normal.
 * @param {{bend?: string|null}[]} sources
 * @returns {"advantage"|"disadvantage"|"normal"}
 */
export function netMode(sources) {
  const adv = sources.some(s => s.bend === "advantage");
  const dis = sources.some(s => s.bend === "disadvantage");
  if ( adv && dis ) return "normal";
  if ( adv ) return "advantage";
  if ( dis ) return "disadvantage";
  return "normal";
}

/** The mode, as a title or a button reads it. */
export const modeTitle = mode => (mode === "advantage") ? "Advantage"
  : (mode === "disadvantage") ? "Disadvantage" : "Normal roll";

/**
 * How a roll WENT OUT, in a sentence — "rolled with Advantage", "rolled flat". ONE vocabulary
 * for the reminder line and the spend line that sit on the same attack card (review finding
 * 11d: the card used to say "rolled Normal roll" on one line and "flat" on the next).
 * @param {"advantage"|"disadvantage"|"normal"|null|undefined} mode
 */
export const rolledWith = mode => (mode === "advantage") ? "with Advantage"
  : (mode === "disadvantage") ? "with Disadvantage" : "flat";

/**
 * The resolution sentence — why the net is what it is, in one line.
 * @param {{bend?: string|null}[]} sources
 */
export function resolutionLine(sources) {
  const adv = sources.filter(s => s.bend === "advantage").length;
  const dis = sources.filter(s => s.bend === "disadvantage").length;
  const unknown = sources.filter(s => !s.bend).length;
  const tail = unknown ? ` ${unknown === 1 ? "One source" : `${unknown} sources`} could not be judged from here — see below.` : "";
  if ( adv && dis ) {
    return `Advantage (${adv}) and Disadvantage (${dis}) cancel — a normal roll, however many of each.${tail}`;
  }
  if ( adv ) return `${adv > 1 ? `${adv} sources of Advantage — still one Advantage.` : "One source of Advantage."}${tail}`;
  if ( dis ) return `${dis > 1 ? `${dis} sources of Disadvantage — still one Disadvantage.` : "One source of Disadvantage."}${tail}`;
  return unknown ? `Nothing counted.${tail}` : "Nothing bends this roll.";
}

/**
 * Prone, both roles, from plain facts: the attacker prone is Disadvantage on the roll; the
 * target prone is Advantage from within 5 feet and Disadvantage from beyond. A null distance
 * (no token to measure from, or a scene whose units cannot be read) lists the target's Prone
 * without counting it — the table can see the map and the module cannot.
 *
 * `distanceFeet` is FEET — the EDGE converts the scene's own units before it gets here
 * (review finding 5: a metric grid's 3 m used to read as "within 5 feet").
 *
 * @param {{attackerProne?: boolean, targetProne?: boolean, distanceFeet?: number|null,
 *          attackerName?: string, targetName?: string}} facts
 */
export function proneSources({ attackerProne = false, targetProne = false, distanceFeet = null,
  attackerName = "You", targetName = "the target" } = {}) {
  const out = [];
  if ( attackerProne ) {
    out.push(reminderSource("prone", "disadvantage", `${attackerName} — Prone`,
      "A prone creature has Disadvantage on attack rolls."));
  }
  if ( targetProne ) {
    if ( (distanceFeet === null) || (distanceFeet === undefined) || !Number.isFinite(distanceFeet) ) {
      out.push(reminderSource("prone", null, `${targetName} is Prone — distance unknown`,
        "Attacks against a prone creature have Advantage from within 5 feet and Disadvantage from beyond — judge the distance from the map."));
    } else if ( distanceFeet <= 5 ) {
      out.push(reminderSource("prone", "advantage", `${targetName} is Prone — within 5 feet`,
        "Attacks against a prone creature have Advantage from within 5 feet of it."));
    } else {
      out.push(reminderSource("prone", "disadvantage", `${targetName} is Prone — ${distanceFeet} feet away`,
        "Attacks against a prone creature have Disadvantage from more than 5 feet away."));
    }
  }
  return out;
}

/**
 * RANGE, from plain facts (user, 2026-09-02 — "bake in the disadvantage at long range"; the
 * class, not the example: any RANGED attack roll — a bow, a thrown dagger, a ranged spell).
 * Two glossary rules, both read off the same distance Prone measures:
 *
 *   beyond normal range, within long   → Disadvantage
 *   beyond long range (or beyond a single range)  → the attack cannot be made: LISTED, not counted
 *   an enemy within 5 feet of the attacker        → Disadvantage, with the caveat the module
 *                                                    cannot judge (can it see you? is it Incapacitated?)
 *
 * A melee attack yields nothing. An unmeasurable distance yields nothing on the range side (a
 * ranged attack at an unknown distance is not worth a box); the close-combat side needs no
 * target distance at all. Distances and ranges are FEET — the EDGE converts.
 *
 * @param {{ranged?: boolean, distanceFeet?: number|null, normalFeet?: number|null, longFeet?: number|null,
 *          closeEnemies?: string[], attackerName?: string, targetName?: string,
 *          rules: {long: string, single: string, close: string}}} facts
 *        `rules` = `RANGE_RULES` (decide/registry.js) — handed in because this layer imports nothing
 */
export function rangeSources({ ranged = false, distanceFeet = null, normalFeet = null, longFeet = null,
  closeEnemies = [], attackerName = "You", targetName = "the target", rules }) {
  const out = [];
  if ( !ranged || !rules ) return out;
  if ( closeEnemies.length ) {
    out.push(reminderSource("range", "disadvantage",
      `${attackerName} — a ranged attack within 5 feet of ${closeEnemies.join(", ")} (counted — press Normal if none of them can see you)`,
      rules.close));
  }
  const d = Number(distanceFeet), normal = Number(normalFeet), long = Number(longFeet);
  if ( !Number.isFinite(d) || !(normal > 0) ) return out;
  if ( long > normal ) {
    if ( d > long ) {
      out.push(reminderSource("range", null,
        `${targetName} is beyond long range — ${d} feet, long range ${long}: this attack cannot be made`, rules.long));
    } else if ( d > normal ) {
      out.push(reminderSource("range", "disadvantage",
        `${targetName} is beyond normal range — ${d} feet (${normal}/${long})`, rules.long));
    }
  } else if ( d > normal ) {
    out.push(reminderSource("range", null,
      `${targetName} is beyond range — ${d} feet, range ${normal}: this attack cannot be made`, rules.single));
  }
  return out;
}

/**
 * THE GATE'S VIEW of one roll's sources (decide/present.js `reminderSectionHTML`): ONE header
 * line — the count of modifiers and the net, which the section draws as a tag — and a box per
 * source with the fact, its bend and its rule. No net block (user ruling 2026-09-02: "just not
 * having the net" — the tag on the header line IS the net, and the boxes under it are why).
 * The arithmetic (`resolutionLine`) rides the header as its tooltip, for the reader who wants
 * it, and costs no vertical space.
 * @param {{kind: string, bend: "advantage"|"disadvantage"|null, label: string, detail?: string}[]} sources
 * @param {"advantage"|"disadvantage"|"normal"} net
 */
export function reminderView(sources, net) {
  const n = sources.length;
  return {
    head: { title: `${n} ${(n === 1) ? "Modifier" : "Modifiers"} — Net`, net, why: resolutionLine(sources) },
    boxes: sources.map(s => ({ label: s.label, bend: s.bend ?? null, rule: s.detail ?? "" }))
  };
}

/**
 * The record stamped on the attack message the gate re-issued — what was shown, what it netted
 * to, what the human pressed, and whether the press matched the net. The data-plane context is
 * spread at the flag level by the EDGE that writes it.
 *
 * @param {{sources: {kind: string, bend: string|null, label: string}[],
 *          net: "advantage"|"disadvantage"|"normal", mode: "advantage"|"disadvantage"|"normal",
 *          answeredAt: number}} answer
 */
export function reminderRecord({ sources, net, mode, answeredAt }) {
  return {
    sources: sources.map(({ kind, bend, label }) => ({ kind, bend: bend ?? null, label })),
    net, mode, honoured: mode === net, answeredAt
  };
}
