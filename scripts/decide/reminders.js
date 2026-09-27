// @ts-check
/**
 * Battle Flow — DECISION: what bends an attack roll, and what it nets to.
 *
 * Pure functions over plain data (ARCHITECTURE.md §2). No Foundry, no imports. The gate lists
 * every source of Advantage or Disadvantage and shows the net; a human presses the mode (DESIGN
 * R1). Any Advantage against any Disadvantage is a normal roll, however many of each; a source
 * whose bend is unknown is listed and does not vote. The condition table is `CONDITION_BENDS`
 * (decide/registry.js), handed in as a parameter.
 */

/** The flag the gate stamps on the attack message it re-issued (`flags.<module>.reminder`). */
export const REMINDER_FLAG = "reminder";

/** The condition's name as the table says it. */
const conditionName = key => key.charAt(0).toUpperCase() + key.slice(1);

/**
 * Does an effect on a sheet answer to a table row's name? Exactly, or as the emanation machine
 * names what it applies — the pack's name with the source appended ("Aura of Purity — Thomas").
 * @param {string|null|undefined} effectName
 * @param {string} key
 */
export const effectNamedAs = (effectName, key) => {
  const name = String(effectName ?? "").toLowerCase();
  const k = String(key ?? "").toLowerCase();
  return !!k && ((name === k) || name.startsWith(`${k} — `));
};

/**
 * Does this worn effect stand for the row? By name, and — when both the row and the effect name
 * their ITEM — by that item too: two pack effects share the name "Protected" (Aura of Protection,
 * Protection from Evil and Good). An effect whose item is unknown still matches by name.
 * @param {{name?: string, item?: string|null}} effect
 * @param {string} key
 * @param {{item?: string}|null} [row]
 */
export const effectCarriesRow = (effect, key, row = null) => {
  if ( !effectNamedAs(effect?.name, key) ) return false;
  const want = row?.item ? String(row.item).toLowerCase() : "";
  const have = effect?.item ? String(effect.item).toLowerCase() : "";
  return !want || !have || (want === have);
};

/**
 * The caveat that rides a label: a "listed — …" caveat is why the row bends nothing, so it
 * stays; a "counted — …" caveat only restates the quoted rule, so it is dropped.
 * @param {{caveat?: string}|undefined} row
 */
const labelCaveat = row => (row?.caveat && !/^counted — /.test(row.caveat)) ? ` (${row.caveat})` : "";

/**
 * The sources the condition table yields for one roll. A row with a bend on that side counts; a
 * row with only a note is listed (bend null).
 * ⚠ `enabled` and `table` are REQUIRED and never default: a caller that forgets the list must
 * read nothing, never everything.
 *
 * @param {{attackerStatuses?: Iterable<string>, targetStatuses?: Iterable<string>,
 *          enabled: Iterable<string>,
 *          table: Readonly<Record<string, Readonly<{attacker: "advantage"|"disadvantage"|null, target: "advantage"|"disadvantage"|null, rule: string, caveat?: string, note?: string}>>>,
 *          attackerName?: string, targetName?: string,
 *          attackerSeenBy?: {sense: string, range: number, sees: string[]}|null,
 *          targetSeenBy?: {sense: string, range: number, sees: string[]}|null}} facts
 *        `enabled` = the Condition Sources list; `table` = `CONDITION_BENDS`, in reading order.
 */
export function conditionSources({ attackerStatuses = [], targetStatuses = [], enabled, table,
  attackerName = "You", targetName = "the target", attackerSeenBy = null, targetSeenBy = null }) {
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
      if ( row.attacker && attackerSeenBy?.sees?.includes(key) ) {
        // the rule's own "If a creature can somehow see you": the target does — listed, not counted
        out.push(reminderSource("condition", null,
          `${attackerName} — ${name}: ${targetName} sees you (${attackerSeenBy.sense} ${attackerSeenBy.range} ft)`, row.rule));
      } else if ( row.attacker ) {
        out.push(reminderSource("condition", row.attacker,
          `${attackerName} — ${name}${labelCaveat(row)}`, row.rule));
      } else if ( row.note ) {
        out.push(reminderSource("condition", null, `${attackerName} — ${name}: ${row.note}`, row.rule));
      }
    }
    if ( theirs.has(key) && row.target && targetSeenBy?.sees?.includes(key) ) {
      out.push(reminderSource("condition", null,
        `${targetName} is ${name} — ${attackerName} sees it (${targetSeenBy.sense} ${targetSeenBy.range} ft)`, row.rule));
    } else if ( theirs.has(key) && row.target ) {
      out.push(reminderSource("condition", row.target,
        `${targetName} is ${name}${labelCaveat(row)}`, row.rule));
    }
  }
  return out;
}

/**
 * Does the observer's Blindsight or Truesight reach the other creature? Invisible's own clause —
 * "If a creature can somehow see you" — then lists the bend instead of counting it. Blindsight
 * finds the hidden too; Truesight answers Invisible only (it does not see past cover).
 * @param {{blindsight?: number, truesight?: number}} senses  the observer's ranges, in feet
 * @param {number|null} feet  the distance between the two
 * @returns {{sense: string, range: number, sees: string[]}|null}
 */
export function sightOf(senses, feet) {
  if ( (typeof feet !== "number") || !Number.isFinite(feet) ) return null;
  const blind = Number(senses?.blindsight) || 0, tru = Number(senses?.truesight) || 0;
  if ( blind && (feet <= blind) ) return { sense: "Blindsight", range: blind, sees: ["invisible", "hiding"] };
  if ( tru && (feet <= tru) ) return { sense: "Truesight", range: tru, sees: ["invisible"] };
  return null;
}

/**
 * The save gate's sources: the roller's statuses against the save table for THIS ability. A row
 * with a bend counts; a row with `autoFail` is listed and marks the save "cannot succeed", which
 * the dialog draws as a fourth button. The human still presses (DESIGN R1).
 *
 * @param {{statuses?: Iterable<string>, ability: string, enabled: Iterable<string>,
 *          table: Readonly<Record<string, Readonly<{abilities: readonly string[], bend?: "advantage"|"disadvantage", autoFail?: boolean, rule: string, caveat?: string}>>>,
 *          name?: string}} facts
 *        `enabled` = the Condition Sources list; `table` = `SAVE_BENDS` (decide/registry.js)
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
 * The save gate's judgement: the attack arithmetic, unless a source says the save cannot
 * succeed (`fails`) or cannot fail (`succeeds`); an automatic failure stands over a success.
 * @param {{kind: string, bend: "advantage"|"disadvantage"|null, label: string, detail?: string, autoFail?: boolean, autoSucceed?: boolean}[]} sources
 * @returns {{sources: object[], net: "advantage"|"disadvantage"|"normal"|"fails"|"succeeds", autoFail: boolean, autoSucceed: boolean, view: object}}
 */
export function saveGate(sources) {
  const autoFail = sources.some(s => s.autoFail);
  const autoSucceed = !autoFail && sources.some(s => s.autoSucceed);
  const net = autoFail ? "fails" : autoSucceed ? "succeeds" : netMode(sources);
  const view = reminderView(sources, net);
  if ( autoFail ) view.head.why = "This save cannot succeed — the rules fail it before any die is rolled. Fails records the failure without dice; a mode button still rolls.";
  if ( autoSucceed ) view.head.why = "This save cannot fail — the rules pass it before any die is rolled. Succeeds records the success without dice; a mode button still rolls.";
  return { sources, net, autoFail, autoSucceed, view };
}

/**
 * The check gate's sources: the roller's statuses against `CHECK_BENDS`. Every row is a plain
 * bend — no 2024 rule fails a check automatically.
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

/**
 * What carries a row on the roller's sheet: the worn effects named as the row, or — for a
 * `match: "feature"` row (text-only features such as Brave) — one carrier with no effect id.
 * @param {any} row
 * @param {string} key
 * @param {{id?: string|null, name: string}[]} [effects]
 * @param {string[]} [features]
 * @returns {{id?: string|null, name?: string}[]}
 */
function rowCarriers(row, key, effects = [], features = []) {
  if ( row?.match === "feature" ) {
    return (features ?? []).some(f => String(f).toLowerCase() === key.toLowerCase()) ? [{ id: null }] : [];
  }
  return (effects ?? []).filter(e => effectNamedAs(e?.name, key));
}

/**
 * Effect-table rows whose `checks` facet bends ABILITY CHECKS (Heated Metal, Averse). A row with
 * `checksWhen` counts only on the statuses and skills it names.
 * @param {{effects?: {id?: string|null, name: string}[], features?: string[], enabled: Iterable<string>,
 *          table: Readonly<Record<string, any>>, name?: string, statuses?: Iterable<string>, skill?: string|null}} facts
 */
export function effectCheckSources({ effects = [], features = [], enabled, table, name = "You", statuses = [], skill = null }) {
  const on = new Set([...(enabled ?? [])].map(n => String(n).toLowerCase()));
  const mine = new Set(statuses ?? []);
  const out = [];
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    if ( !row?.checks || !on.has(key.toLowerCase()) ) continue;
    const when = row.checksWhen;
    if ( when?.statuses?.length && !when.statuses.some(s => mine.has(s)) ) continue;
    if ( when?.skills?.length && !when.skills.includes(skill) ) continue;
    const carriers = rowCarriers(row, key, effects, features);
    for ( const e of carriers ) {
      out.push(Object.assign(reminderSource("effect", row.checks, `${name} — ${key}`, row.rule), e.id ? { effectId: e.id } : {}));
    }
  }
  return out;
}

/**
 * Effects on the roller's own sheet whose row carries a `saves` facet, read against the DEMAND
 * (what the save is against): a `statuses` row fires when the demand imposes one of them, a
 * `spells` row when a spell demands it. With no demand (a bare sheet roll, including a repeat
 * save to end a condition) every row is LISTED — the module never guesses what a roll is against.
 * A `succeeds` row makes the save unable to fail (`autoSucceed`).
 * @param {{effects?: {id: string, name: string}[], features?: string[], enabled: Iterable<string>,
 *          table: Readonly<Record<string, any>>,
 *          demand?: {spell?: boolean|null, statuses?: string[]|null, sleep?: boolean|null}|null, name?: string}} facts
 */
export function effectSaveSources({ effects = [], features = [], enabled, table, demand = null, name = "You" }) {
  const on = new Set([...(enabled ?? [])].map(n => String(n).toLowerCase()));
  const out = [];
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    const facet = row?.saves;
    if ( !facet || !on.has(key.toLowerCase()) ) continue;
    const carriers = rowCarriers(row, key, effects, features);
    if ( !carriers.length ) continue;
    const scope = facet.statuses?.length
      ? `a save against ${facet.statuses.map(conditionName).join(", ")}`
      : facet.sleep ? "a save against magic that would put you to sleep"
        : facet.spells ? "a save against a spell or other magical effect" : "this save";
    let bend = null;
    let caveat = "";
    let succeeds = false;
    if ( !demand ) {
      caveat = facet.succeeds ? ` (listed — ${scope}; it cannot fail if this is one)`
        : ` (listed — ${scope}; press ${facet.bend === "advantage" ? "Advantage" : "Disadvantage"} if this is one)`;
    } else if ( facet.sleep ) {
      if ( !demand.spell || !demand.sleep ) continue;
      succeeds = !!facet.succeeds;
      bend = succeeds ? null : (facet.bend ?? null);
      caveat = succeeds ? ": this save cannot fail — magic can't put you to sleep" : " — against magic that would put you to sleep";
    } else if ( facet.statuses?.length ) {
      const hits = (demand.statuses ?? []).filter(s => facet.statuses.includes(String(s).toLowerCase()));
      if ( !hits.length ) continue;
      bend = facet.bend;
      caveat = ` — against ${hits.map(conditionName).join(", ")}`;
    } else if ( facet.spells ) {
      if ( !demand.spell ) continue;
      bend = facet.bend;
      caveat = " — against a spell";
    } else {
      bend = facet.bend;
    }
    for ( const e of carriers ) {
      out.push(Object.assign(reminderSource("effect", bend, `${name} — ${key}${caveat}`, row.rule), e.id ? { effectId: e.id } : {},
        succeeds ? { autoSucceed: true, feature: key } : {}));
    }
  }
  return out;
}

/**
 * Does a standing effect turn a SUCCESS against half-on-save damage into none (Circle of
 * Power's `halfToNone`, against a spell)? The row's key when one does, for the receipt's note.
 * @param {{effects?: {name: string}[], features?: string[], enabled: Iterable<string>, table: Readonly<Record<string, any>>,
 *          demand?: {spell?: boolean|null}|null}} facts
 * @returns {string|null}
 */
export function saveNoneOnSuccess({ effects = [], features = [], enabled, table, demand = null }) {
  const on = new Set([...(enabled ?? [])].map(n => String(n).toLowerCase()));
  for ( const [key, row] of Object.entries(table ?? {}) ) {
    const facet = row?.saves;
    if ( !facet?.halfToNone || !on.has(key.toLowerCase()) ) continue;
    if ( facet.spells && !demand?.spell ) continue;
    if ( rowCarriers(row, key, effects, features).length ) return key;
  }
  return null;
}

/** The check gate's judgement: the attack arithmetic over its sources (no check fails before the dice). */
export function checkGate(sources) {
  const net = netMode(sources);
  return { sources, net, view: reminderView(sources, net) };
}

/**
 * Effects on the roller's own sheet whose CHANGES set the platform's roll mode for this roll.
 * ⚠ dnd5e sums every such change into one mode and the dialog opens with `1d20adv` and no word
 * about who; only the changes can say. The sign of the value decides (+ Advantage, − Disadvantage,
 * whatever the change mode). The dialog's own default is the platform's and is never re-set.
 *
 * The keys, as dnd5e writes them (AdvantageModeField):
 *   save  → `system.abilities.<ability>.save.roll.mode`; a Concentration save also
 *           `system.attributes.concentration.roll.mode` (War Caster — `rollConcentration`
 *           combines that field alone, and Mage Slayer nets against it)
 *   check → `system.abilities.<ability>.check.roll.mode`, `system.skills.<skill>.roll.mode`,
 *           `system.tools.<tool>.roll.mode`
 *
 * @param {{effects?: {id?: string, name: string, item?: string|null, changes?: {key: string, value: string|number}[]}[],
 *          roll: {kind: "save"|"check", ability?: string|null, skill?: string|null, tool?: string|null, concentration?: boolean},
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
 * @param {{kind?: string|null, ability?: string|null, skill?: string|null, tool?: string|null, concentration?: boolean}} [roll]
 * @returns {string[]}
 */
export function modeKeys({ kind = null, ability = null, skill = null, tool = null, concentration = false } = {}) {
  const keys = [];
  if ( kind === "save" ) {
    if ( ability ) keys.push(`system.abilities.${ability}.save.roll.mode`);
    if ( concentration ) keys.push("system.attributes.concentration.roll.mode");
  } else if ( kind === "check" ) {
    if ( ability ) keys.push(`system.abilities.${ability}.check.roll.mode`);
    if ( skill ) keys.push(`system.skills.${skill}.roll.mode`);
    if ( tool ) keys.push(`system.tools.${tool}.roll.mode`);
  }
  return keys;
}

/**
 * The abilities on either sheet that bend this roll, against `EFFECT_BENDS`. An attacker-side row
 * fires when the attacker carries it and the roll is in scope; a target-side row when the target
 * does. Row facets: `judge` (a fact that must hold), `counted: false` (listed), `spend` (the
 * effect's id rides along to be used up), `except: "source"` (against all but the creature that
 * applied it — Goaded), `only: "source"` (for that creature alone — Feinting Attack),
 * `sourceWithin` (only while the source is within reach). `allyNear` is three-valued: only a
 * measured false skips; null counts — the gate never guesses an exemption.
 *
 * @param {{attacker?: {uuid?: string|null, effects?: {id: string, name: string, sourceUuid?: string|null}[], features?: string[], bloodied?: boolean},
 *          target?: {uuid?: string|null, effects?: {id: string, name: string, sourceUuid?: string|null}[], features?: string[], bloodied?: boolean, damaged?: boolean, grappled?: boolean, notActed?: boolean, allyNear?: boolean|null},
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
  // on the TARGET belongs to the target pass, the rest to the attacker's.
  const targetJudges = new Set(["targetBloodied", "targetDamaged", "targetGrappled", "targetNotActed", "allyNearTarget"]);
  const hingesOnTarget = row => targetJudges.has(row.judge) || (row.except === "source") || (row.only === "source");
  const notOnlyFor = (row, e, otherUuid) => (row.only === "source") && (!e?.sourceUuid || !otherUuid || (e.sourceUuid !== otherUuid));
  const attackerRowHere = row => (pass === "both") || ((pass === "target") === hingesOnTarget(row));
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
      // Assassinate: round one and the target has not acted; out of combat, false.
      case "targetNotActed": return !!target.notActed;
      case "allyNearTarget": return target.allyNear !== false;
      default: return true;
    }
  };
  // A MEASURED farther source skips the row; an unmeasured one counts.
  const outOfReach = (row, e) => Number.isFinite(row.sourceWithin) && Number.isFinite(e?.sourceFeet) && (e.sourceFeet > row.sourceWithin);
  const carriers = (who, row) => {
    // `named`: the effect's own name when the row's key cannot be it (a second "Protected")
    const name = String(row.named ?? row.__name).toLowerCase();
    if ( row.match === "feature" ) {
      return (who.features ?? []).some(f => String(f).toLowerCase() === name) ? [{ id: null }] : [];
    }
    return (who.effects ?? []).filter(e => effectCarriesRow(e, name, row));
  };
  const out = [];
  for ( const [key, base] of Object.entries(table ?? {}) ) {
    if ( !on.has(key.toLowerCase()) ) continue;
    const row = { ...base, __name: key };
    if ( !inScope(row) ) continue;
    const counted = row.counted !== false;
    const say = (who, bend, /** @type {{name?: string}|null} */ e = null) => {
      const label = `${who} — ${row.named ? (e?.name ?? row.named) : key}${labelCaveat(row)}`;
      return Object.assign(reminderSource("effect", counted ? bend : null, label, row.rule),
        row.spend ? { spend: row.spend } : {});
    };
    if ( row.attacker && attackerRowHere(row) && judged(row) ) {
      for ( const e of carriers(attacker, row) ) {
        if ( exceptedFor(row, e, target.uuid) || notOnlyFor(row, e, target.uuid) ) continue;
        if ( outOfReach(row, e) ) continue;
        out.push(Object.assign(say(attackerName, row.attacker, e), e.id ? { effectId: e.id } : {}));
      }
    }
    if ( row.target && targetRowHere && judged(row) ) {
      for ( const e of carriers(target, row) ) {
        if ( exceptedFor(row, e, attacker.uuid) || notOnlyFor(row, e, attacker.uuid) ) continue;
        if ( outOfReach(row, e) ) continue;
        out.push(Object.assign(say(`${targetName} is`, row.target, e), e.id ? { effectId: e.id } : {}));
      }
    }
  }
  return out;
}

/**
 * The automatic Critical Hit: a hit from within a condition's `critWithinFeet` (Paralyzed,
 * Unconscious) is a crit. An outcome, not a reminder — the caller makes the damage critical. An
 * unmeasured distance yields nothing. The Condition Sources list is NOT consulted: it switches
 * what the gate nags about, and a rule that changes the dice applies regardless.
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
  : (mode === "disadvantage") ? "Disadvantage" : (mode === "fails") ? "Fails" : (mode === "succeeds") ? "Succeeds" : "Normal roll";

/**
 * How a roll went out, in a sentence — "with Advantage", "flat". One vocabulary for every line
 * on the same attack card.
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
 * Prone, both roles: the attacker prone is Disadvantage; the target prone is Advantage from
 * within 5 feet, Disadvantage from beyond. A null distance lists the target's Prone without
 * counting it. `distanceFeet` is FEET — the EDGE converts the scene's units.
 *
 * @param {{attackerProne?: boolean, targetProne?: boolean, distanceFeet?: number|null,
 *          attackerName?: string, targetName?: string, targetProneBy?: string|null}} facts
 */
export function proneSources({ attackerProne = false, targetProne = false, distanceFeet = null,
  attackerName = "You", targetName = "the target", targetProneBy = null } = {}) {
  const out = [];
  // The effect that put the target Prone when it is not the plain status (a Trip's own effect
  // shows no icon on the token) — named on the label so the reader can find it.
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
 * RANGE, for any ranged attack roll (weapon, thrown or spell):
 *
 *   beyond normal range, within long              → Disadvantage
 *   beyond long range (or beyond a single range)  → cannot be made: LISTED, not counted
 *   an enemy within 5 feet of the attacker        → Disadvantage
 *
 * A melee attack yields nothing; an unmeasured distance skips the range rows. A feat that cancels
 * a row (`rangeFeatsFor`) leaves it listed with the feat named; ignored cover is listed the same
 * way. Distances are FEET.
 *
 * @param {{ranged?: boolean, distanceFeet?: number|null, normalFeet?: number|null, longFeet?: number|null,
 *          closeEnemies?: string[], targetName?: string,
 *          cancels?: {feature: string, rows: string[], rule: string}[],
 *          coverBonus?: number, coverFeat?: {feature: string, rule: string}|null,
 *          rules: {long: string, single: string, close: string}}} facts
 *        `rules` = `RANGE_RULES` (decide/registry.js) — handed in because this layer imports nothing
 */
export function rangeSources({ ranged = false, distanceFeet = null, normalFeet = null, longFeet = null,
  closeEnemies = [], targetName = "the target", cancels = [], coverBonus = 0, coverFeat = null, rules }) {
  const out = [];
  if ( !ranged || !rules ) return out;
  const cancelOf = row => (cancels ?? []).find(c => (c.rows ?? []).includes(row)) ?? null;
  const bent = (row, label, rule) => {
    const c = cancelOf(row);
    return c ? reminderSource("range", null, `${label} — ${c.feature}: no Disadvantage`, c.rule)
      : reminderSource("range", "disadvantage", label, rule);
  };
  if ( closeEnemies.length ) out.push(bent("close", `Ranged attack within 5 feet of ${closeEnemies.join(", ")}`, rules.close));
  if ( coverFeat && (Number(coverBonus) > 0) ) {
    out.push(reminderSource("range", null, `${targetName}'s cover (+${Number(coverBonus)} AC) — ${coverFeat.feature} ignores it`, coverFeat.rule));
  }
  const d = Number(distanceFeet), normal = Number(normalFeet), long = Number(longFeet);
  if ( !Number.isFinite(d) || !(normal > 0) ) return out;
  if ( long > normal ) {
    if ( d > long ) {
      out.push(reminderSource("range", null,
        `${targetName} is beyond long range — ${d} feet, long range ${long}: this attack cannot be made`, rules.long));
    } else if ( d > normal ) {
      out.push(bent("long", `${targetName} is beyond normal range — ${d} feet (${normal}/${long})`, rules.long));
    }
  } else if ( d > normal ) {
    out.push(reminderSource("range", null,
      `${targetName} is beyond range — ${d} feet, range ${normal}: this attack cannot be made`, rules.single));
  }
  return out;
}

/**
 * The RANGE_FEATS rows on the attacker's sheet whose scope takes in this attack — what they
 * cancel, whether cover is ignored, and the reach a spell gains.
 * @param {string[]} features  the attacker's feat names
 * @param {{rangedWeapon?: boolean, spell?: boolean, crossbow?: boolean}} attack
 * @param {Readonly<Record<string, {scope: string, cancels?: readonly string[], cover?: boolean, reach?: number, rule: string}>>} table
 * @returns {{cancels: {feature: string, rows: string[], rule: string}[], cover: {feature: string, rule: string}|null,
 *            reach: {feature: string, feet: number}|null}}
 */
export function rangeFeatsFor(features, attack, table) {
  const have = new Set((features ?? []).map(n => String(n).toLowerCase()));
  const fits = scope => ((scope === "rangedWeapon") && !!attack?.rangedWeapon) || ((scope === "spell") && !!attack?.spell)
    || ((scope === "crossbow") && !!attack?.crossbow);
  /** @type {{cancels: {feature: string, rows: string[], rule: string}[], cover: {feature: string, rule: string}|null, reach: {feature: string, feet: number}|null}} */
  const out = { cancels: [], cover: null, reach: null };
  for ( const [feature, row] of Object.entries(table ?? {}) ) {
    if ( !have.has(feature.toLowerCase()) || !fits(row.scope) ) continue;
    if ( row.cancels?.length ) out.cancels.push({ feature, rows: [...row.cancels], rule: row.rule });
    if ( row.cover && !out.cover ) out.cover = { feature, rule: row.rule };
    if ( row.reach && !out.reach ) out.reach = { feature, feet: Number(row.reach) };
  }
  return out;
}

/**
 * A spell's range with Spell Sniper's reach: "a range of at least 10 feet" gains the feet; a range
 * under 10, a Touch or Self spell, or a weapon's two-band range stands.
 * @param {{normalFeet?: number|null, longFeet?: number|null}} range
 * @param {{feet: number}|null} reach
 */
export function reachedRange(range, reach) {
  const normal = Number(range?.normalFeet);
  if ( !reach || !(normal >= 10) || (Number(range?.longFeet) > 0) ) return range;
  return { ...range, normalFeet: normal + reach.feet, reachedBy: reach.feet };
}

/**
 * The AC an attack records against a target whose cover the attacker ignores: its AC less the cover
 * bonus dnd5e folded in. Total Cover (no AC recorded) stays null.
 * @param {number|null} ac
 * @param {number} cover
 * @returns {number|null}
 */
export function acWithoutCover(ac, cover) {
  if ( (ac === null) || (ac === undefined) || !Number.isFinite(Number(ac)) ) return ac ?? null;
  return Number(ac) - Math.max(0, Number(cover) || 0);
}

/**
 * The gate's view of one roll's sources (decide/present.js `reminderSectionHTML`): one header
 * line — the count and the net, drawn as a tag — and a box per source. The arithmetic
 * (`resolutionLine`) rides the header as its tooltip.
 * @param {{kind: string, bend: "advantage"|"disadvantage"|null, label: string, detail?: string}[]} sources
 * @param {"advantage"|"disadvantage"|"normal"|"fails"|"succeeds"} net   "fails" is the save gate's fourth answer ("succeeds" its mirror)
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
 * to, what the human pressed, and whether the press matched the net. The EDGE spreads the
 * data-plane context at the flag level.
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
