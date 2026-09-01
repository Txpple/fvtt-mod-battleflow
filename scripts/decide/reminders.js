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
 */

/** The flag the gate stamps on the attack message it re-issued (`flags.<module>.reminder`). */
export const REMINDER_FLAG = "reminder";

/**
 * THE CONDITION TABLE (Stage 3, 2026-09-01) — what the 2024 conditions do to an ATTACK ROLL,
 * both roles, with each condition's own "Attacks Affected" clause quoted VERBATIM from the
 * world's Rules Glossary (dnd5e.content24 / the premium PHB — presentation law 8). This is the
 * knowledge AC5e carries, as DATA the gate reads; nothing here decides anything.
 *
 *   attacker   what the condition does to the bearer's OWN attack rolls
 *   target     what it does to attack rolls AGAINST the bearer
 *   null       no bend on that side; a NOTE means "listed for the table, never counted"
 *
 * Prone is the one row with geometry, and it lives in `proneSources` rather than here.
 * Membership — which of these a table wants nagged about — is the Condition Sources list.
 *
 * Each row: `attacker` and `target` are the bend on that side ("advantage" | "disadvantage" |
 * null), `rule` the glossary clause verbatim, `caveat` a condition the module cannot judge (counted,
 * and said), `note` a fact listed for the table and never counted.
 *
 * @type {Readonly<Record<string, Readonly<{attacker: "advantage"|"disadvantage"|null, target: "advantage"|"disadvantage"|null, rule: string, caveat?: string, note?: string}>>>}
 */
export const CONDITION_BENDS = Object.freeze({
  blinded: Object.freeze({ attacker: "disadvantage", target: "advantage",
    rule: "Attack rolls against you have Advantage, and your attack rolls have Disadvantage." }),
  invisible: Object.freeze({ attacker: "advantage", target: "disadvantage",
    rule: "Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don’t gain this benefit against that creature." }),
  paralyzed: Object.freeze({ attacker: null, target: "advantage",
    rule: "Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you." }),
  petrified: Object.freeze({ attacker: null, target: "advantage",
    rule: "Attack rolls against you have Advantage." }),
  poisoned: Object.freeze({ attacker: "disadvantage", target: null,
    rule: "You have Disadvantage on attack rolls and ability checks." }),
  restrained: Object.freeze({ attacker: "disadvantage", target: "advantage",
    rule: "Attack rolls against you have Advantage, and your attack rolls have Disadvantage." }),
  stunned: Object.freeze({ attacker: null, target: "advantage",
    rule: "Attack rolls against you have Advantage." }),
  unconscious: Object.freeze({ attacker: null, target: "advantage",
    rule: "Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you." }),
  frightened: Object.freeze({ attacker: "disadvantage", target: null,
    rule: "You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.",
    caveat: "counted — press Normal if the source of the fear is out of sight" }),
  grappled: Object.freeze({ attacker: "disadvantage", target: null,
    rule: "You have Disadvantage on attack rolls against any target other than the grappler.",
    caveat: "counted — press Normal if this attack is against the grappler" }),
  incapacitated: Object.freeze({ attacker: null, target: null,
    rule: "You can’t take any action, Bonus Action, or Reaction.",
    note: "an Incapacitated creature cannot attack at all — this roll should not be happening" }),
  dodging: Object.freeze({ attacker: null, target: "disadvantage",
    rule: "Until the start of your next turn, any attack roll made against you has Disadvantage if you can see the attacker. You lose these benefits if you have the Incapacitated condition or if your Speed is 0.",
    caveat: "counted — press Normal if it cannot see the attacker, is Incapacitated, or has Speed 0" }),
  charmed: Object.freeze({ attacker: null, target: null,
    rule: "You can’t attack the charmer or target the charmer with damaging abilities or magical effects.",
    note: "a Charmed creature cannot attack its charmer — if this is the charmer, this roll should not be happening" })
});

/** The thirteen, in the order the table reads them. */
export const CONDITION_KEYS = Object.freeze(Object.keys(CONDITION_BENDS));

/** The condition's name as the table says it. */
const conditionName = key => key.charAt(0).toUpperCase() + key.slice(1);

/**
 * The sources the CONDITION TABLE yields for one roll, from plain facts: which listed
 * conditions the attacker has, which the target has. A row with a bend on that side counts; a
 * row with only a note is listed for the table and never counted (bend null).
 *
 * @param {{attackerStatuses?: Iterable<string>, targetStatuses?: Iterable<string>,
 *          enabled?: Iterable<string>, attackerName?: string, targetName?: string}} facts
 *        `enabled` = the Condition Sources list; a condition not in it is not read at all
 */
export function conditionSources({ attackerStatuses = [], targetStatuses = [], enabled = CONDITION_KEYS,
  attackerName = "You", targetName = "the target" } = {}) {
  const on = new Set(enabled);
  const out = [];
  for ( const key of CONDITION_KEYS ) {
    if ( !on.has(key) ) continue;
    const row = CONDITION_BENDS[key];
    if ( !row ) continue;
    const name = conditionName(key);
    if ( new Set(attackerStatuses).has(key) ) {
      if ( row.attacker ) {
        out.push(reminderSource("condition", row.attacker,
          `${attackerName} — ${name}${row.caveat ? ` (${row.caveat})` : ""}`, row.rule));
      } else if ( row.note ) {
        out.push(reminderSource("condition", null, `${attackerName} — ${name}: ${row.note}`, row.rule));
      }
    }
    if ( new Set(targetStatuses).has(key) && row.target ) {
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

/** The mode, as the table says it. */
export const modeLabel = mode => (mode === "advantage") ? "Advantage"
  : (mode === "disadvantage") ? "Disadvantage" : "a normal roll";

/**
 * The resolution sentence — why the net is what it is, in one line.
 * @param {{bend?: string|null}[]} sources
 * @param {"advantage"|"disadvantage"|"normal"} net
 */
export function resolutionLine(sources, net) {
  const adv = sources.filter(s => s.bend === "advantage").length;
  const dis = sources.filter(s => s.bend === "disadvantage").length;
  const unknown = sources.filter(s => !s.bend).length;
  const tail = unknown ? ` ${unknown === 1 ? "One source" : `${unknown} sources`} could not be judged from here — see below.` : "";
  if ( adv && dis ) {
    return `Advantage (${adv}) and Disadvantage (${dis}) cancel — a normal roll, however many of each.${tail}`;
  }
  if ( adv ) return `${adv > 1 ? `${adv} sources of Advantage — still one Advantage.` : "One source of Advantage."}${tail}`;
  if ( dis ) return `${dis > 1 ? `${dis} sources of Disadvantage — still one Disadvantage.` : "One source of Disadvantage."}${tail}`;
  return unknown ? `Nothing counted.${tail}` : `Nothing bends this roll — ${modeLabel(net)}.`;
}

/**
 * Prone, both roles, from plain facts: the attacker prone is Disadvantage on the roll; the
 * target prone is Advantage from within 5 feet and Disadvantage from beyond. A null distance
 * (no token to measure from) lists the target's Prone without counting it — the table can see
 * the map and the module cannot.
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
