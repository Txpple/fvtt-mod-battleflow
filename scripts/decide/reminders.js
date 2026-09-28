// @ts-check
/**
 * Battle Flow — DECISION: what bends a d20 roll, and what it nets to. Pure, no imports
 * (ARCHITECTURE.md §2); the tables come in as parameters. The gate lists every source and the net;
 * a human presses the mode (DESIGN R1). A source whose bend is unknown is listed and does not vote.
 */

/** The flag the gate stamps on the attack message it re-issued (`flags.<module>.reminder`). */
export const REMINDER_FLAG = "reminder";

const conditionName = key => key.charAt(0).toUpperCase() + key.slice(1);

/** Does an effect answer to a row's name? Exactly, or as the emanation machine names it
 * ("Aura of Purity — Thomas").
 * @param {string|null|undefined} effectName
 * @param {string} key */
export const effectNamedAs = (effectName, key) => {
  const name = String(effectName ?? "").toLowerCase();
  const k = String(key ?? "").toLowerCase();
  return !!k && ((name === k) || name.startsWith(`${k} — `));
};

/** Does this effect stand for the row? By name, and by ITEM when both name one: two pack effects
 * are "Protected" (Aura of Protection, Protection from Evil and Good).
 * @param {{name?: string, item?: string|null}} effect
 * @param {string} key
 * @param {{item?: string}|null} [row] */
export const effectCarriesRow = (effect, key, row = null) => {
  if ( !effectNamedAs(effect?.name, key) ) return false;
  const want = row?.item ? String(row.item).toLowerCase() : "";
  const have = effect?.item ? String(effect.item).toLowerCase() : "";
  return !want || !have || (want === have);
};

/** A "listed — …" caveat rides the label (it is why the row bends nothing); "counted — …" is dropped.
 * @param {{caveat?: string}|undefined} row */
const labelCaveat = row => (row?.caveat && !/^counted — /.test(row.caveat)) ? ` (${row.caveat})` : "";

/** The condition table's sources for one roll; a row with only a note is listed (bend null).
 * ⚠ `enabled` and `table` never default: a caller that forgets the list reads nothing, not everything.
 * @param {{attackerStatuses?: Iterable<string>, targetStatuses?: Iterable<string>,
 *          enabled: Iterable<string>,
 *          table: Readonly<Record<string, Readonly<{attacker: "advantage"|"disadvantage"|null, target: "advantage"|"disadvantage"|null, rule: object|string|null, caveat?: string, note?: string}>>>,
 *          attackerName?: string, targetName?: string,
 *          attackerSeenBy?: {sense: string, range: number, sees: string[]}|null,
 *          targetSeenBy?: {sense: string, range: number, sees: string[]}|null}} facts */
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

/** Does the observer's Blindsight or Truesight reach? Then Invisible's "if a creature can somehow
 * see you" lists the bend instead. Blindsight finds the hidden too; Truesight answers Invisible only.
 * @param {{blindsight?: number, truesight?: number}} senses  in feet
 * @param {number|null} feet
 * @returns {{sense: string, range: number, sees: string[]}|null} */
export function sightOf(senses, feet) {
  if ( (typeof feet !== "number") || !Number.isFinite(feet) ) return null;
  const blind = Number(senses?.blindsight) || 0, tru = Number(senses?.truesight) || 0;
  if ( blind && (feet <= blind) ) return { sense: "Blindsight", range: blind, sees: ["invisible", "hiding"] };
  if ( tru && (feet <= tru) ) return { sense: "Truesight", range: tru, sees: ["invisible"] };
  return null;
}

/** The save gate's sources for THIS ability. An `autoFail` row is listed and marks the save
 * "cannot succeed" (the dialog's fourth button).
 * @param {{statuses?: Iterable<string>, ability: string, enabled: Iterable<string>,
 *          table: Readonly<Record<string, Readonly<{abilities: readonly string[], bend?: "advantage"|"disadvantage", autoFail?: boolean, rule: object|string|null, caveat?: string}>>>,
 *          name?: string}} facts
 * @returns {{kind: string, bend: "advantage"|"disadvantage"|null, label: string, detail: string, autoFail?: boolean}[]} */
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

/** The save gate's net: the attack arithmetic, unless the save cannot succeed (`fails`, which wins)
 * or cannot fail (`succeeds`).
 * @param {{kind: string, bend: "advantage"|"disadvantage"|null, label: string, detail?: string, autoFail?: boolean, autoSucceed?: boolean}[]} sources
 * @returns {{sources: object[], net: "advantage"|"disadvantage"|"normal"|"fails"|"succeeds", autoFail: boolean, autoSucceed: boolean, view: object}} */
export function saveGate(sources) {
  const autoFail = sources.some(s => s.autoFail);
  const autoSucceed = !autoFail && sources.some(s => s.autoSucceed);
  const net = autoFail ? "fails" : autoSucceed ? "succeeds" : netMode(sources);
  const view = reminderView(sources, net);
  if ( autoFail ) view.head.why = "This save cannot succeed — the rules fail it before any die is rolled. Fails records the failure without dice; a mode button still rolls.";
  if ( autoSucceed ) view.head.why = "This save cannot fail — the rules pass it before any die is rolled. Succeeds records the success without dice; a mode button still rolls.";
  return { sources, net, autoFail, autoSucceed, view };
}

/** The check gate's sources against `CHECK_BENDS` (no 2024 rule fails a check automatically).
 * @param {{statuses?: Iterable<string>, enabled: Iterable<string>, table: Readonly<Record<string, any>>, name?: string}} facts */
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

/** The row's carriers: effects named as it, or one id-less carrier for a `match: "feature"` row (Brave).
 * @param {any} row
 * @param {string} key
 * @param {{id?: string|null, name: string}[]} [effects]
 * @param {string[]} [features]
 * @returns {{id?: string|null, name?: string}[]} */
function rowCarriers(row, key, effects = [], features = []) {
  if ( row?.match === "feature" ) {
    return (features ?? []).some(f => String(f).toLowerCase() === key.toLowerCase()) ? [{ id: null }] : [];
  }
  return (effects ?? []).filter(e => effectNamedAs(e?.name, key));
}

/** Effect rows whose `checks` facet bends ability checks; `checksWhen` narrows to statuses/skills.
 * @param {{effects?: {id?: string|null, name: string}[], features?: string[], enabled: Iterable<string>,
 *          table: Readonly<Record<string, any>>, name?: string, statuses?: Iterable<string>, skill?: string|null}} facts */
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

/** Effect rows with a `saves` facet, read against the DEMAND (what the save is against). With no
 * demand (a bare sheet roll) every row is LISTED — never guess what a roll is against.
 * @param {{effects?: {id: string, name: string}[], features?: string[], enabled: Iterable<string>,
 *          table: Readonly<Record<string, any>>,
 *          demand?: {spell?: boolean|null, statuses?: string[]|null, sleep?: boolean|null, abilities?: string[]|null}|null, name?: string}} facts */
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
        : facet.spells ? "a save against a spell or other magical effect"
          : facet.abilities?.length ? `a ${facet.abilities.map(abilityName).join(" or ")} save` : "this save";
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
      // Greater Magic Resistance: the save against magic cannot fail — the fourth button, Trance's shape.
      succeeds = !!facet.succeeds;
      bend = succeeds ? null : (facet.bend ?? null);
      caveat = succeeds ? ": this save cannot fail — against a spell or other magical effect" : " — against a spell";
    } else if ( facet.abilities?.length ) {
      // The save's own ability (Irresistible Dance's Dexterity); a demand naming none is not this one.
      const hits = (demand.abilities ?? []).filter(a => facet.abilities.includes(String(a).toLowerCase()));
      if ( !hits.length ) continue;
      bend = facet.bend;
      caveat = ` — a ${hits.map(abilityName).join(" or ")} save`;
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

/** The 2024 ability names, for a row's words. */
const abilityName = key => ({ str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" })[String(key ?? "").toLowerCase()] ?? String(key ?? "");

/** The demand's OWN bend (a repeated save raised by damage has Advantage — Tasha's Hideous Laughter):
 * one counted source, its label the spell's, its rule the row's.
 * @param {{bend?: {mode: "advantage"|"disadvantage", label: string, rule?: object|string|null}|null}|null} demand
 * @param {string} [name] */
export function demandBendSources(demand, name = "You") {
  const b = demand?.bend;
  if ( !b?.mode || !b.label ) return [];
  return [reminderSource("effect", b.mode, `${name} — ${b.label}`, b.rule ?? null)];
}

/** The key of a row that turns a half-on-save SUCCESS into none (`halfToNone`, Circle of Power).
 * @param {{effects?: {name: string}[], features?: string[], enabled: Iterable<string>, table: Readonly<Record<string, any>>,
 *          demand?: {spell?: boolean|null}|null}} facts
 * @returns {string|null} */
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

/** The check gate's net: the attack arithmetic. */
export function checkGate(sources) {
  const net = netMode(sources);
  return { sources, net, view: reminderView(sources, net) };
}

/** Effects whose CHANGES set the platform's roll mode (keys: `modeKeys`); the value's sign decides.
 * ⚠ dnd5e sums them into one mode and the dialog opens `1d20adv` with no word of who; only the
 * changes can say. The dialog's own default is never re-set.
 * @param {{effects?: {id?: string, name: string, item?: string|null, changes?: {key: string, value: string|number}[]}[],
 *          roll: {kind: "save"|"check", ability?: string|null, skill?: string|null, tool?: string|null, concentration?: boolean},
 *          rollLabel?: string, name?: string}} facts
 * @returns {{kind: string, bend: "advantage"|"disadvantage"|null, label: string, detail: string, effectId?: string, effectName: string, item: string|null}[]} */
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

/** The dnd5e AdvantageModeField paths for this roll. A Concentration save adds
 * `concentration.roll.mode` (`rollConcentration` combines that field alone; Mage Slayer nets against it).
 * @param {{kind?: string|null, ability?: string|null, skill?: string|null, tool?: string|null, concentration?: boolean}} [roll]
 * @returns {string[]} */
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

/** The `EFFECT_BENDS` rows either sheet carries for this roll. Facets: `judge`, `counted: false`,
 * `spend`, `except: "source"` (Goaded), `only: "source"` (Feinting Attack), `sourceWithin`.
 * `allyNear` is three-valued: only a measured false skips — never guess an exemption.
 * @param {{attacker?: {uuid?: string|null, effects?: {id: string, name: string, sourceUuid?: string|null}[], features?: string[], bloodied?: boolean},
 *          target?: {uuid?: string|null, effects?: {id: string, name: string, sourceUuid?: string|null}[], features?: string[], bloodied?: boolean, damaged?: boolean, grappled?: boolean, notActed?: boolean, allyNear?: boolean|null, incapacitated?: boolean},
 *          enabled: Iterable<string>, table: Readonly<Record<string, any>>,
 *          scope?: {classification?: string|null, type?: string|null},
 *          attackerName?: string, targetName?: string, pass?: "both"|"attacker"|"target"}} facts */
export function effectSources({ attacker = {}, target = {}, enabled, table, scope = {},
  attackerName = "You", targetName = "the target", pass = "both" }) {
  const on = new Set([...(enabled ?? [])].map(n => String(n).toLowerCase()));
  // The EDGE reads the attacker once, then each target: a row hinging on the TARGET is the target pass's.
  const targetJudges = new Set(["targetBloodied", "targetDamaged", "targetGrappled", "targetNotActed", "allyNearTarget", "notIncapacitated"]);
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
      case "targetNotActed": return !!target.notActed;
      case "allyNearTarget": return target.allyNear !== false;
      case "notIncapacitated": return !target.incapacitated;    // Displacement: off while the bearer is Incapacitated
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

/** The automatic Critical Hit from within `critWithinFeet` (Paralyzed, Unconscious) — an outcome,
 * not a reminder. The Condition Sources list is NOT consulted: a rule that changes dice always applies.
 * @param {{targetStatuses?: Iterable<string>, distanceFeet?: number|null, targetName?: string,
 *          table: Readonly<Record<string, Readonly<{rule: object|string|null, critWithinFeet?: number}>>>}} facts
 * @returns {{status: string, label: string, rule: object|string|null}[]} */
export function autoCritSources({ targetStatuses = [], distanceFeet = null, targetName = "the target", table }) {
  // null is "could not measure"; Number(null) is 0 — never a crit.
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

/** One source of Advantage or Disadvantage on a roll.
 * @param {string} kind  a REMINDER_KINDS key
 * @param {"advantage"|"disadvantage"|null} bend  null = listed, not counted
 * @param {string} label
 * @param {string} [detail]  the rule line */
export function reminderSource(kind, bend, label, detail = "") {
  return { kind, bend, label, detail };
}

/** THE NET: any Advantage against any Disadvantage is a normal roll, however many of each.
 * @param {{bend?: string|null}[]} sources
 * @returns {"advantage"|"disadvantage"|"normal"} */
export function netMode(sources) {
  const adv = sources.some(s => s.bend === "advantage");
  const dis = sources.some(s => s.bend === "disadvantage");
  if ( adv && dis ) return "normal";
  if ( adv ) return "advantage";
  if ( dis ) return "disadvantage";
  return "normal";
}

export const modeTitle = mode => (mode === "advantage") ? "Advantage"
  : (mode === "disadvantage") ? "Disadvantage" : (mode === "fails") ? "Fails" : (mode === "succeeds") ? "Succeeds" : "Normal roll";

/** How a roll went out — "with Advantage", "flat"; one vocabulary for every line on the card.
 * @param {"advantage"|"disadvantage"|"normal"|null|undefined} mode */
export const rolledWith = mode => (mode === "advantage") ? "with Advantage"
  : (mode === "disadvantage") ? "with Disadvantage" : "flat";

/** Why the net is what it is, in one line.
 * @param {{bend?: string|null}[]} sources */
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

/** Prone, both roles. A null distance lists the target's Prone without counting it. Distances are
 * FEET — the EDGE converts the scene's units.
 * @param {{attackerProne?: boolean, targetProne?: boolean, distanceFeet?: number|null,
 *          attackerName?: string, targetName?: string, targetProneBy?: string|null}} facts */
export function proneSources({ attackerProne = false, targetProne = false, distanceFeet = null,
  attackerName = "You", targetName = "the target", targetProneBy = null } = {}) {
  const out = [];
  // A non-status Prone (a Trip's effect shows no token icon) is named so the reader can find it.
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

/** RANGE for a ranged attack: beyond normal → Disadvantage; beyond long → cannot be made (listed);
 * an enemy within 5 feet → Disadvantage. A cancelling feat or ignored cover is listed, named. FEET.
 * @param {{ranged?: boolean, distanceFeet?: number|null, normalFeet?: number|null, longFeet?: number|null,
 *          closeEnemies?: string[], targetName?: string,
 *          cancels?: {feature: string, rows: string[], rule: object|string|null}[],
 *          coverBonus?: number, coverFeat?: {feature: string, rule: object|string|null}|null,
 *          rules: {long: object|string, single: object|string, close: object|string}}} facts  `rules` = `RANGE_RULES` */
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

/** The attacker's RANGE_FEATS rows that fit this attack: what they cancel, cover ignored, spell reach.
 * @param {string[]} features
 * @param {{rangedWeapon?: boolean, spell?: boolean, crossbow?: boolean}} attack
 * @param {Readonly<Record<string, {scope: string, cancels?: readonly string[], cover?: boolean, reach?: number, rule: object|string|null}>>} table
 * @returns {{cancels: {feature: string, rows: string[], rule: object|string|null}[], cover: {feature: string, rule: object|string|null}|null,
 *            reach: {feature: string, feet: number}|null}} */
export function rangeFeatsFor(features, attack, table) {
  const have = new Set((features ?? []).map(n => String(n).toLowerCase()));
  const fits = scope => ((scope === "rangedWeapon") && !!attack?.rangedWeapon) || ((scope === "spell") && !!attack?.spell)
    || ((scope === "crossbow") && !!attack?.crossbow);
  /** @type {{cancels: {feature: string, rows: string[], rule: object|string|null}[], cover: {feature: string, rule: object|string|null}|null, reach: {feature: string, feet: number}|null}} */
  const out = { cancels: [], cover: null, reach: null };
  for ( const [feature, row] of Object.entries(table ?? {}) ) {
    if ( !have.has(feature.toLowerCase()) || !fits(row.scope) ) continue;
    if ( row.cancels?.length ) out.cancels.push({ feature, rows: [...row.cancels], rule: row.rule });
    if ( row.cover && !out.cover ) out.cover = { feature, rule: row.rule };
    if ( row.reach && !out.reach ) out.reach = { feature, feet: Number(row.reach) };
  }
  return out;
}

/** Spell Sniper's reach on a spell range of at least 10 feet; a two-band weapon range stands.
 * @param {{normalFeet?: number|null, longFeet?: number|null}} range
 * @param {{feet: number}|null} reach */
export function reachedRange(range, reach) {
  const normal = Number(range?.normalFeet);
  if ( !reach || !(normal >= 10) || (Number(range?.longFeet) > 0) ) return range;
  return { ...range, normalFeet: normal + reach.feet, reachedBy: reach.feet };
}

/** The AC less the cover bonus dnd5e folded in, for an attacker who ignores cover; null stays null.
 * @param {number|null} ac
 * @param {number} cover
 * @returns {number|null} */
export function acWithoutCover(ac, cover) {
  if ( (ac === null) || (ac === undefined) || !Number.isFinite(Number(ac)) ) return ac ?? null;
  return Number(ac) - Math.max(0, Number(cover) || 0);
}

/** The gate's view (present.js `reminderSectionHTML`): a header with the count and net, the
 * arithmetic as its tooltip, and a box per source.
 * @param {{kind: string, bend: "advantage"|"disadvantage"|null, label: string, detail?: string}[]} sources
 * @param {"advantage"|"disadvantage"|"normal"|"fails"|"succeeds"} net */
export function reminderView(sources, net) {
  const n = sources.length;
  return {
    head: { title: `${n} ${(n === 1) ? "Modifier" : "Modifiers"} — Net`, net, why: resolutionLine(sources) },
    boxes: sources.map(s => ({ label: s.label, bend: s.bend ?? null, rule: s.detail ?? "" }))
  };
}

/** The record on the re-issued attack message: shown, net, pressed, and whether they matched.
 * @param {{sources: {kind: string, bend: string|null, label: string}[],
 *          net: "advantage"|"disadvantage"|"normal", mode: "advantage"|"disadvantage"|"normal",
 *          answeredAt: number}} answer */
export function reminderRecord({ sources, net, mode, answeredAt }) {
  return {
    sources: sources.map(({ kind, bend, label }) => ({ kind, bend: bend ?? null, label })),
    net, mode, honoured: mode === net, answeredAt
  };
}
