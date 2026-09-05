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
 * The caveat that rides a LABEL (user, 2026-09-02: "just say rogue — hiding"): a row's
 * "listed — …" caveat is the whole reason the row bends nothing, so it stays; a "counted — …"
 * caveat only restates the quoted rule's own condition, so it is dropped from the label —
 * the player reads the rule.
 * @param {{caveat?: string}|undefined} row
 */
const labelCaveat = row => (row?.caveat && !/^counted — /.test(row.caveat)) ? ` (${row.caveat})` : "";

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
          `${attackerName} — ${name}${labelCaveat(row)}`, row.rule));
      } else if ( row.note ) {
        out.push(reminderSource("condition", null, `${attackerName} — ${name}: ${row.note}`, row.rule));
      }
    }
    if ( theirs.has(key) && row.target ) {
      out.push(reminderSource("condition", row.target,
        `${targetName} is ${name}${labelCaveat(row)}`, row.rule));
    }
  }
  return out;
}

/**
 * THE SAVE GATE'S SOURCES, from plain facts (user ruling 2026-09-02 — option E: the demand
 * opens the system's own Saving Throw dialog and the gate meets the roller there, exactly as
 * it meets an attack). The roller's own statuses against the save table for THIS ability: a
 * row with a bend counts; a row with `autoFail` is LISTED (bend null — nothing to net) and
 * marks the judgement "cannot succeed", which the dialog draws as a fourth button. Nothing
 * here decides: the human presses Fails, or presses a mode against the net (R1).
 *
 * @param {{statuses?: Iterable<string>, ability: string, enabled: Iterable<string>,
 *          table: Readonly<Record<string, Readonly<{abilities: readonly string[], bend?: "advantage"|"disadvantage", autoFail?: boolean, rule: string, caveat?: string}>>>,
 *          name?: string}} facts
 *        `enabled` = the Condition Sources list (the same switch the attack gate reads);
 *        `table` = `SAVE_BENDS` (decide/registry.js)
 * @returns {{kind: string, bend: "advantage"|"disadvantage"|null, label: string, detail: string, autoFail?: boolean}[]}
 */
export function saveSources({ statuses = [], ability, enabled, table, name = "You" }) {
  const on = new Set(enabled ?? []);
  const mine = new Set(statuses);
  const out = [];
  for ( const key of Object.keys(table ?? {}) ) {
    if ( !on.has(key) || !mine.has(key) ) continue;
    const row = table[key];
    if ( !row?.abilities?.includes(ability) ) continue;
    const label = `${name} — ${conditionName(key)}${labelCaveat(row)}`;
    if ( row.autoFail ) {
      out.push(Object.assign(reminderSource("condition", null, `${label}: this save cannot succeed`, row.rule),
        { autoFail: true, status: key, statusName: conditionName(key) }));
    } else if ( row.bend ) {
      out.push(Object.assign(reminderSource("condition", row.bend, label, row.rule), { status: key }));
    }
  }
  return out;
}

/**
 * The save gate's judgement over its sources: the net is the attack arithmetic, unless a source
 * says the save cannot succeed — then the net is `fails`, drawn as the red tag, and the
 * header's tooltip says why instead of counting. One object for the dialog, the default button
 * and the record.
 * @param {{kind: string, bend: "advantage"|"disadvantage"|null, label: string, detail?: string, autoFail?: boolean}[]} sources
 * @returns {{sources: object[], net: "advantage"|"disadvantage"|"normal"|"fails", autoFail: boolean, view: object}}
 */
export function saveGate(sources) {
  const autoFail = sources.some(s => s.autoFail);
  const net = autoFail ? "fails" : netMode(sources);
  const view = reminderView(sources, net);
  if ( autoFail ) view.head.why = "This save cannot succeed — the rules fail it before any die is rolled. Fails records the failure without dice; a mode button still rolls.";
  return { sources, net, autoFail, view };
}

/**
 * CHECK SOURCES, from plain facts (user go 2026-09-03 — the third gate): the roller's statuses
 * against the check table (decide/registry.js CHECK_BENDS), the Condition Sources list as the
 * switch. Every row is a plain bend — no automatic failure on a check exists in the 2024 rules —
 * and the label is the fact alone, the quoted rule carrying the condition (the 2026-09-02
 * ruling on labels).
 * @param {{statuses?: Iterable<string>, enabled: Iterable<string>, table: Readonly<Record<string, any>>, name?: string}} facts
 */
export function checkSources({ statuses = [], enabled, table, name = "You" }) {
  const on = new Set(enabled ?? []);
  const mine = new Set(statuses);
  const out = [];
  for ( const key of Object.keys(table ?? {}) ) {
    if ( !on.has(key) || !mine.has(key) ) continue;
    const row = table[key];
    if ( !row?.bend ) continue;
    out.push(Object.assign(reminderSource("condition", row.bend, `${name} — ${conditionName(key)}`, row.rule), { status: key }));
  }
  return out;
}

/** The check gate's judgement: the attack arithmetic over its sources, one object for the
 * dialog, the default button and the record (no `fails` — no check rule fails before the dice). */
export function checkGate(sources) {
  const net = netMode(sources);
  return { sources, net, view: reminderView(sources, net) };
}

/**
 * MODE SOURCES, from plain facts (user, 2026-09-04 — "when saves are made, I would like to see
 * the calculus for why there is advantage/dis, just like attacks"): the effects on the roller's
 * OWN sheet whose changes set the platform's roll mode for this roll. ⚠ dnd5e 5.x carries no
 * advantage flags any more — an item like The Duskheart ("advantage on Wisdom saving throws")
 * ships an effect changing `system.abilities.wis.save.roll.mode` by +1, the system's
 * AdvantageModeField sums every such change into one mode, and the dialog opens with `1d20adv`
 * and no word about who. The counts on the sheet cannot say who either; the effect CHANGES can,
 * so this reads them — the key that names this roll, the sign of the value (+1 Advantage, −1
 * Disadvantage, anything else nothing, whatever the change mode). Each hit is one box: the fact
 * names the item (and the effect, when its name differs), the rule line says what the change
 * does in words, because a mode change carries no rules text of its own. The gate nets these
 * with the status sources exactly as the attack gate nets; the dialog's own default is the
 * platform's and is never re-set (R-A).
 *
 * The keys, as the system writes them (dnd5e.mjs, AdvantageModeField.setMode call sites):
 *   save  → `system.abilities.<ability>.save.roll.mode`
 *   check → `system.abilities.<ability>.check.roll.mode`, `system.skills.<skill>.roll.mode`,
 *           `system.tools.<tool>.roll.mode`
 *
 * @param {{effects?: {id?: string, name: string, item?: string|null, changes?: {key: string, value: string|number}[]}[],
 *          roll: {kind: "save"|"check", ability?: string|null, skill?: string|null, tool?: string|null},
 *          rollLabel?: string, name?: string}} facts
 *        `rollLabel` = the roll in the table's words ("Wisdom saving throws", "Stealth checks")
 * @returns {{kind: string, bend: "advantage"|"disadvantage"|null, label: string, detail: string, effectId?: string, effectName: string, item: string|null}[]}
 */
export function modeSources({ effects = [], roll, rollLabel = "this roll", name = "You" }) {
  const keys = modeKeys(roll);
  if ( !keys.length ) return [];
  const out = [];
  for ( const e of effects ) {
    let sign = 0;
    for ( const c of (e.changes ?? []) ) {
      if ( !keys.includes(c.key) ) continue;
      const v = Math.sign(Number(c.value));
      if ( v ) sign += v;
    }
    if ( !sign ) continue;
    const bend = (sign > 0) ? "advantage" : "disadvantage";
    const item = e.item ?? null;
    const what = item ? (item === e.name ? item : `${item} (${e.name})`) : e.name;
    const source = reminderSource("effect", bend, `${name} — ${what}`,
      `An effect on the sheet sets ${rollLabel} to roll with ${(bend === "advantage") ? "Advantage" : "Disadvantage"}.`);
    out.push(Object.assign(source, { effectName: e.name, item, ...(e.id ? { effectId: e.id } : {}) }));
  }
  return out;
}

/**
 * The sheet paths whose change sets the mode of this roll — see `modeSources`.
 * @param {{kind?: string|null, ability?: string|null, skill?: string|null, tool?: string|null}} [roll]
 * @returns {string[]}
 */
export function modeKeys({ kind = null, ability = null, skill = null, tool = null } = {}) {
  const keys = [];
  if ( kind === "save" ) {
    if ( ability ) keys.push(`system.abilities.${ability}.save.roll.mode`);
  } else if ( kind === "check" ) {
    if ( ability ) keys.push(`system.abilities.${ability}.check.roll.mode`);
    if ( skill ) keys.push(`system.skills.${skill}.roll.mode`);
    if ( tool ) keys.push(`system.tools.${tool}.roll.mode`);
  }
  return keys;
}

/**
 * EFFECT SOURCES, from plain facts (user, 2026-09-02 — the sixth kind): the abilities on either
 * sheet that bend this roll, read against the effect table (decide/registry.js EFFECT_BENDS).
 * An attacker-side row fires when the ATTACKER carries the effect (or the feature) and the
 * roll is in the row's scope; a target-side row when the TARGET does. A row with a `judge`
 * fires only when the fact it names is true; a row with `counted: false` is LISTED (bend null,
 * the caveat on the label); a row with a caveat is counted and says so. A row with `spend`
 * carries the effect's id so the spend hook can use it up. A row with `except: "source"` stands
 * against everyone but the creature whose action applied the effect (each effect's `sourceUuid`,
 * the EDGE's read): Goaded, Distracted.
 *
 * @param {{attacker?: {uuid?: string|null, effects?: {id: string, name: string, sourceUuid?: string|null}[], features?: string[], bloodied?: boolean},
 *          target?: {uuid?: string|null, effects?: {id: string, name: string, sourceUuid?: string|null}[], features?: string[], bloodied?: boolean, damaged?: boolean, grappled?: boolean, notActed?: boolean},
 *          enabled: Iterable<string>, table: Readonly<Record<string, any>>,
 *          scope?: {classification?: string|null, type?: string|null},
 *          attackerName?: string, targetName?: string, pass?: "both"|"attacker"|"target"}} facts
 *        `enabled` = the Effect Sources list (names, any case); `scope` = the attack's own
 *        classification ("weapon" | "spell" | "unarmed") and type ("melee" | "ranged").
 */
export function effectSources({ attacker = {}, target = {}, enabled, table, scope = {},
  attackerName = "You", targetName = "the target", pass = "both" }) {
  const on = new Set([...(enabled ?? [])].map(n => String(n).toLowerCase()));
  // The EDGE reads the attacker once and each target in turn: an attacker-side row that hinges
  // on the TARGET (Bloodied, Grappled…) belongs to the target pass, the rest to the attacker's.
  const targetJudges = new Set(["targetBloodied", "targetDamaged", "targetGrappled", "targetNotActed"]);
  // A row that excepts its SOURCE hinges on the target too: the goader is one target of many.
  const hingesOnTarget = row => targetJudges.has(row.judge) || (row.except === "source");
  const attackerRowHere = row => (pass === "both") || ((pass === "target") === hingesOnTarget(row));
  // `except: "source"`: the bend stands against everyone but the creature that put the effect
  // there — a carrier whose source is the other side of this roll is skipped, not counted.
  const exceptedFor = (row, e, otherUuid) => (row.except === "source") && !!e?.sourceUuid && !!otherUuid && (e.sourceUuid === otherUuid);
  const targetRowHere = pass !== "attacker";
  const inScope = row => {
    const s = row.scope ?? "any";
    if ( s === "any" ) return true;
    if ( (s === "spell") || (s === "weapon") ) return (scope.classification ?? null) === s;
    return (scope.type ?? null) === s;
  };
  const judged = row => {
    switch ( row.judge ) {
      case "bloodied": return !!attacker.bloodied;
      case "targetBloodied": return !!target.bloodied;
      case "targetDamaged": return !!target.damaged;
      case "targetGrappled": return !!target.grappled;
      // The combat clock (Assassinate): round one, and the target has not taken a turn — the
      // EDGE reads both off the running combat; out of combat the fact is simply false.
      case "targetNotActed": return !!target.notActed;
      default: return true;
    }
  };
  const carriers = (who, row) => {
    const name = row.__name.toLowerCase();
    if ( row.match === "feature" ) {
      return (who.features ?? []).some(f => String(f).toLowerCase() === name) ? [{ id: null }] : [];
    }
    return (who.effects ?? []).filter(e => String(e?.name ?? "").toLowerCase() === name);
  };
  const out = [];
  for ( const [key, base] of Object.entries(table ?? {}) ) {
    if ( !on.has(key.toLowerCase()) ) continue;
    const row = { ...base, __name: key };
    if ( !inScope(row) ) continue;
    const counted = row.counted !== false;
    const say = (who, bend) => {
      const label = `${who} — ${key}${labelCaveat(row)}`;
      return Object.assign(reminderSource("effect", counted ? bend : null, label, row.rule),
        row.spend ? { spend: row.spend } : {});
    };
    if ( row.attacker && attackerRowHere(row) && judged(row) ) {
      for ( const e of carriers(attacker, row) ) {
        if ( exceptedFor(row, e, target.uuid) ) continue;
        out.push(Object.assign(say(attackerName, row.attacker), e.id ? { effectId: e.id } : {}));
      }
    }
    if ( row.target && targetRowHere && judged(row) ) {
      for ( const e of carriers(target, row) ) {
        if ( exceptedFor(row, e, attacker.uuid) ) continue;
        out.push(Object.assign(say(`${targetName} is`, row.target), e.id ? { effectId: e.id } : {}));
      }
    }
  }
  return out;
}

/**
 * THE AUTOMATIC CRITICAL HIT, from plain facts (user, 2026-09-02): a hit on a creature whose
 * condition carries `critWithinFeet` (Paralyzed, Unconscious — the glossary's *"Any attack
 * roll that hits you is a Critical Hit if the attacker is within 5 feet of you"*) from within
 * that distance is a Critical Hit. An outcome, not a reminder — the caller makes the damage
 * roll critical. An unmeasurable distance (null) yields nothing: a crit is never guessed.
 * Membership is NOT consulted: the Condition Sources list switches what the gate NAGS about;
 * a rule that changes the dice applies whether or not the table wanted reminding.
 *
 * @param {{targetStatuses?: Iterable<string>, distanceFeet?: number|null, targetName?: string,
 *          table: Readonly<Record<string, Readonly<{rule: string, critWithinFeet?: number}>>>}} facts
 * @returns {{status: string, label: string, rule: string}[]}
 */
export function autoCritSources({ targetStatuses = [], distanceFeet = null, targetName = "the target", table }) {
  // null is "could not measure" (geometry.js nearestFeet), and Number(null) is 0 — never a crit.
  if ( (distanceFeet === null) || (distanceFeet === undefined) ) return [];
  const d = Number(distanceFeet);
  if ( !Number.isFinite(d) ) return [];
  const theirs = new Set(targetStatuses);
  const out = [];
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    const feet = Number(row?.critWithinFeet);
    if ( !(feet > 0) || !theirs.has(key) || (d > feet) ) continue;
    out.push({ status: key, label: `${targetName} is ${conditionName(key)} — within ${feet} feet, a hit is a Critical Hit`, rule: row.rule });
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
  : (mode === "disadvantage") ? "Disadvantage" : (mode === "fails") ? "Fails" : "Normal roll";

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
 *          attackerName?: string, targetName?: string, targetProneBy?: string|null}} facts
 */
export function proneSources({ attackerProne = false, targetProne = false, distanceFeet = null,
  attackerName = "You", targetName = "the target", targetProneBy = null } = {}) {
  const out = [];
  // Which effect put the target Prone, when it is not the plain status (user, 2026-09-02:
  // "why disadvantage for Morgash prone? he doesn't show prone" — a Cunning Strike Trip's own
  // effect, with no icon on the token). Said on the label, so the reader can find it.
  const by = (targetProneBy && (String(targetProneBy).toLowerCase() !== "prone")) ? ` (${targetProneBy})` : "";
  if ( attackerProne ) {
    out.push(reminderSource("prone", "disadvantage", `${attackerName} — Prone`,
      "A prone creature has Disadvantage on attack rolls."));
  }
  if ( targetProne ) {
    if ( (distanceFeet === null) || (distanceFeet === undefined) || !Number.isFinite(distanceFeet) ) {
      out.push(reminderSource("prone", null, `${targetName} is Prone${by} — distance unknown`,
        "Attacks against a prone creature have Advantage from within 5 feet and Disadvantage from beyond — judge the distance from the map."));
    } else if ( distanceFeet <= 5 ) {
      out.push(reminderSource("prone", "advantage", `${targetName} is Prone${by} — within 5 feet`,
        "Attacks against a prone creature have Advantage from within 5 feet of it."));
    } else {
      out.push(reminderSource("prone", "disadvantage", `${targetName} is Prone${by} — ${distanceFeet} feet away`,
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
      `Ranged attack within 5 feet of ${closeEnemies.join(", ")}`,
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
 * @param {"advantage"|"disadvantage"|"normal"|"fails"} net   "fails" is the save gate's fourth answer
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
