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

/** What the gate calls each of the native dialog's own selects. */
export const CHOICE_LABELS = Object.freeze({ attackMode: "Attack mode", ammunition: "Ammunition", mastery: "Mastery" });

/**
 * THE DIALOG'S OWN CHOICES the gate must carry (user ruling 2026-09-01 — "need a gate for the
 * little solvers"; review finding 14). dnd5e's attack dialog offers a select for attack mode
 * (one- or two-handed, thrown), ammunition and — when a weapon has more than one — the mastery,
 * and a re-issue with `configure: false` would otherwise pin each to its remembered default in
 * silence. The mastery pick is not cosmetic: it is stamped on the attack message and this
 * module's own riders key on it.
 *
 * From the hook's `dialog.options` lists (plain `{value, label}` entries; dnd5e's `{rule: true}`
 * separators are dropped) and the hook-time `config` values: one choice per list that has more
 * than one real entry, pre-set to the config's value when the list carries it, else the first.
 * Ammunition's blank entry (dnd5e's own "none") is kept and named.
 *
 * @param {{attackModeOptions?: {value?: string, label?: string, rule?: boolean}[],
 *          ammunitionOptions?: {value?: string, label?: string, rule?: boolean}[],
 *          masteryOptions?: {value?: string, label?: string, rule?: boolean}[]}} [dialogOptions]
 * @param {{attackMode?: string, ammunition?: string, mastery?: string}} [config]
 * @returns {{key: "attackMode"|"ammunition"|"mastery", label: string,
 *            options: {value: string, label: string}[], value: string}[]}
 */
export function rollChoices({ attackModeOptions = [], ammunitionOptions = [], masteryOptions = [] } = {}, config = {}) {
  /** @type {["attackMode"|"ammunition"|"mastery", {value?: string, label?: string, rule?: boolean}[]][]} */
  const lists = [["attackMode", attackModeOptions], ["ammunition", ammunitionOptions], ["mastery", masteryOptions]];
  const out = [];
  for ( const [key, raw] of lists ) {
    const options = (raw ?? []).filter(o => o && !o.rule && (o.value !== undefined) && (o.value !== null))
      .map(o => ({ value: String(o.value), label: String(o.label || (o.value === "" ? "None" : o.value)) }));
    const first = options[0];
    if ( (options.length < 2) || !first ) continue;
    const current = (config?.[key] === undefined || config?.[key] === null) ? null : String(config[key]);
    const value = options.some(o => o.value === current) ? /** @type {string} */ (current) : first.value;
    out.push({ key, label: CHOICE_LABELS[key], options, value });
  }
  return out;
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
