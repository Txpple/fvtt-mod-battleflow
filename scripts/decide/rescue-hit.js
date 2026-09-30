// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the `roll` interrupt, Disadvantage imposed on
 * an attack AFTER the verdict showed (INTERRUPT_ROLLS; RULINGS *Rescuing the hit*). Pure.
 * ⚠ Not a reroll: a plain roll gets a SECOND d20, the LOWER standing; Advantage CANCELS to the FIRST
 * die; Disadvantage does not stack. The stood d20 carries its own crit, hence a `replace`.
 */

/**
 * A d20 term's roll mode off its modifiers. ⚠ dnd5e's `adv`/`dis` keep `number` 1 until evaluated,
 * so they are read first; `kh`/`kl` cover a hand-typed roll.
 * @param {{number?: number, modifiers?: string[]}} term
 * @returns {"advantage"|"disadvantage"|"normal"}
 */
export function d20ModeOf(term) {
  const mods = (term?.modifiers ?? []).map(m => String(m).toLowerCase());
  if ( mods.some(m => /^adv\d*$/.test(m)) ) return "advantage";
  if ( mods.some(m => /^dis\d*$/.test(m)) ) return "disadvantage";
  if ( mods.some(m => m.startsWith("kl") || m.startsWith("dh")) ) return "disadvantage";
  if ( mods.some(m => /^kh?\d*$/.test(m) || m.startsWith("dl")) && ((term?.number ?? 1) > 1) ) return "advantage";
  return "normal";
}

/**
 * The face that STOOD and the PLAIN one: the first face a native reroll (Halfling) did not replace.
 * @param {{result: number, active?: boolean, rerolled?: boolean, discarded?: boolean}[]} results
 * @returns {{kept: number|null, plain: number|null}}
 */
export function d20Faces(results) {
  const live = (results ?? []).filter(r => !r?.rerolled);
  const kept = live.find(r => (r.active !== false) && !r.discarded)?.result ?? null;
  const plain = live[0]?.result ?? null;
  return { kept: Number.isFinite(kept) ? kept : null, plain: Number.isFinite(plain) ? plain : null };
}

/** Does this mode need a second d20 rolled? Only a plain roll does (see the header). */
export const needsSecondD20 = mode => mode === "normal";

/**
 * Disadvantage imposed on an attack roll already made: what stands, and whether it moved.
 * @param {object} args
 * @param {"advantage"|"disadvantage"|"normal"} args.mode
 * @param {number} args.kept      the face the attack's total used
 * @param {number|null} [args.plain]
 * @param {number|null} [args.second]
 * @param {number} args.total
 * @param {number} [args.critAt]
 * @param {number} [args.fumbleAt]
 * @param {number[]|null} [args.faces]  in the order rolled
 * @returns {{how: "lower"|"cancelled"|"none", first: number, second: number|null, stood: number,
 *            firstTotal: number, total: number, isCritical: boolean, isFumble: boolean,
 *            wasCritical: boolean, changed: boolean}}
 */
export function disadvantageOutcome({ mode, kept, plain = null, second = null, total, critAt = 20, fumbleAt = 1, faces = null }) {
  const modifier = Number(total) - Number(kept);
  /** @type {"lower"|"cancelled"|"none"} */
  let how = "none";
  let stood = Number(kept);
  if ( mode === "advantage" ) {
    how = "cancelled";
    stood = Number.isFinite(plain) ? Number(plain) : Number(kept);
  } else if ( mode === "normal" ) {
    how = "lower";
    stood = Number.isFinite(second) ? Math.min(Number(kept), Number(second)) : Number(kept);
  }
  return {
    how, first: Number(kept), second: (mode === "normal") && Number.isFinite(second) ? Number(second) : null,
    stood, firstTotal: Number(total), total: stood + modifier,
    isCritical: stood >= critAt, isFumble: stood <= fumbleAt,
    wasCritical: Number(kept) >= critAt, changed: stood !== Number(kept),
    ...(Array.isArray(faces) ? { faces: faces.map(Number).filter(Number.isFinite) } : {})
  };
}

/* THE BYSTANDER'S BEND (RULINGS *The full release — the order*, Q2 and its noise gate, option A): another
 * creature's roll bent by a die (Cutting Words' −1d8, Guided Strike's +10) or neutralised (Restore
 * Balance: the first d20 stands, a RULE OF COOL). The same `bent` shape as Disadvantage, so the hold's
 * fold, card and dice read it unchanged: `how` "die" or "neutralised". */

/**
 * A die's largest face off a plain formula ("1d8" → 8, "+10" → 10); null when unreadable.
 * @param {string|number|null} formula
 */
export function dieMaxOf(formula) {
  const s = String(formula ?? "").replace(/\s+/g, "").replace(/^[+-]/, "");
  const dice = /^(\d*)d(\d+)$/i.exec(s);
  if ( dice ) return (Number(dice[1] || 1) * Number(dice[2])) || null;
  const flat = Number(s);
  return (s !== "") && Number.isFinite(flat) ? Math.abs(flat) : null;
}

/**
 * A roll bent by a die or a flat number already rolled: the d20 stands, its own crit and fumble with it.
 * @param {{kept: number, total: number, add: number, critAt?: number, fumbleAt?: number}} args
 */
export function dieOutcome({ kept, total, add, critAt = 20, fumbleAt = 1 }) {
  const delta = Number(add) || 0;
  return { how: "die", first: Number(kept), second: null, stood: Number(kept), add: delta,
    firstTotal: Number(total), total: Number(total) + delta,
    isCritical: Number(kept) >= critAt, isFumble: Number(kept) <= fumbleAt,
    wasCritical: Number(kept) >= critAt, changed: delta !== 0 };
}

/**
 * A roll REROLLED after the fact (Countercharm's bend on a friend's save): the new d20 stands, the modifiers with it.
 * @param {{kept: number, total: number, newKept: number, newTotal: number, critAt?: number, fumbleAt?: number, faces?: number[]|null}} args
 */
export function rerollOutcome({ kept, total, newKept, newTotal, critAt = 20, fumbleAt = 1, faces = null }) {
  return { how: "reroll", first: Number(kept), second: null, stood: Number(newKept), add: 0,
    firstTotal: Number(total), total: Number(newTotal),
    isCritical: Number(newKept) >= critAt, isFumble: Number(newKept) <= fumbleAt,
    wasCritical: Number(kept) >= critAt, changed: Number(newTotal) !== Number(total),
    ...(Array.isArray(faces) ? { faces: faces.map(Number).filter(Number.isFinite) } : {}) };
}

/**
 * Advantage or Disadvantage taken away after the roll: the FIRST d20 stands (Q3, a rule of cool).
 * @param {{mode: string, kept: number, plain?: number|null, total: number, critAt?: number, fumbleAt?: number, faces?: number[]|null}} args
 */
export function neutraliseOutcome({ mode, kept, plain = null, total, critAt = 20, fumbleAt = 1, faces = null }) {
  const modifier = Number(total) - Number(kept);
  const stood = ((mode !== "normal") && Number.isFinite(plain)) ? Number(plain) : Number(kept);
  return { how: (mode === "normal") ? "none" : "neutralised", first: Number(kept), second: null, stood,
    firstTotal: Number(total), total: stood + modifier,
    isCritical: stood >= critAt, isFumble: stood <= fumbleAt,
    wasCritical: Number(kept) >= critAt, changed: stood !== Number(kept),
    ...(Array.isArray(faces) ? { faces: faces.map(Number).filter(Number.isFinite) } : {}) };
}

/**
 * THE MARGIN GATE (Q2, option A): can this bystander's bend change the verdict? The futile-skip gate's
 * shape (`holdSkipped`), for another creature's roll. `want` is the verdict the bystander is after.
 * @param {{bend: "die"|"neutralise"|"reroll", sign?: number, dieMax?: number|null, want: "miss"|"hit",
 *   kept: number, plain?: number|null, total: number, target: number, mode?: string,
 *   isCritical?: boolean, isFumble?: boolean, critAt?: number, fumbleAt?: number}} args
 * @returns {boolean}
 */
export function bystanderMatters({ bend, sign = 1, dieMax = null, want, kept, plain = null, total, target, mode = "normal",
  isCritical = false, isFumble = false, critAt = 20, fumbleAt = 1 }) {
  if ( !Number.isFinite(Number(target)) ) return false;
  if ( bend === "die" ) {
    if ( isCritical || isFumble || !(Number(dieMax) > 0) ) return false;   // a natural 20 or 1 stands against any die
    const reach = Number(total) + (sign * Number(dieMax));
    return (want === "miss") ? (sign < 0) && (reach < target) : (sign > 0) && (reach >= target);
  }
  if ( bend === "neutralise" ) {
    const o = neutraliseOutcome({ mode, kept, plain, total, critAt, fumbleAt });
    if ( !o.changed ) return false;
    const hits = o.isCritical || (!o.isFumble && (o.total >= target));
    return (want === "miss") ? !hits : hits;
  }
  // A reroll is a gift: offered only to make a FAILURE pass, and only where a 20 on the new die would reach the DC.
  if ( bend === "reroll" ) {
    if ( want !== "hit" ) return false;
    const modifier = Number(total) - Number(kept);
    return (Number(total) < Number(target)) && ((20 + modifier) >= Number(target));
  }
  return false;
}

/**
 * THE DICE OF A BENT ROLL for the canvas: every d20 in order, the one that STANDS up, the rest
 * struck (`lost` when the drop took a critical). A tie keeps the first.
 * @param {{how: string, first: number, second: number|null, stood: number, wasCritical: boolean,
 *          isCritical: boolean, faces?: number[], add?: number}|null} bent
 * @returns {{label: string, up?: boolean, drop?: boolean, lost?: boolean}[]}
 */
export function bentChips(bent) {
  if ( !bent || (bent.how === "none") ) return [];
  // A bystander's die: the number it moved the roll by, one chip (a signed label).
  if ( bent.how === "die" ) {
    const n = Number(bent.add) || 0;
    return n ? [{ label: `${n > 0 ? "+" : "−"}${Math.abs(n)}`, up: true }] : [];
  }
  const lost = !!bent.wasCritical && !bent.isCritical;
  let dice, keep;
  if ( bent.how === "lower" ) {
    if ( !Number.isFinite(bent.second) ) return [];
    const second = Number(bent.second);
    dice = [bent.first, second];
    keep = (second < bent.first) ? 1 : 0;
  } else {
    const faces = bent.faces ?? [];
    dice = (faces.length > 1) ? faces.slice(0, 2) : [bent.stood, bent.first];
    keep = 0;
  }
  return dice.map((v, i) => (i === keep)
    ? { label: String(v), up: true }
    : { label: String(v), drop: true, ...((lost && (v === bent.first)) ? { lost: true } : {}) });
}

/**
 * Does a rolled crit stand for the damage? One damage roll serves every hit target, so only when it
 * stands against ALL of them (the intersection rule of `critFor`).
 * @param {{rolledCrit: boolean, hitUuids: string[], bents: Record<string, {isCritical?: boolean}|null|undefined>}} args
 */
export function critStands({ rolledCrit, hitUuids, bents }) {
  if ( !rolledCrit ) return false;
  return (hitUuids ?? []).every(uuid => bents?.[uuid]?.isCritical !== false);
}

/**
 * The rescue popup's rows: the held reaction (`primary`) and every `roll` row. A row's tag is its
 * cost or why it is off; an off row stays, greyed.
 * @param {object} args
 * @param {{name: string, kind: string, bonus?: number|null, spell?: boolean, pool?: {spend: string, left: number, max: number}|null,
 *          multiplier?: number|null, uses?: {left: number, max: number}|null}|null} args.primary
 * @param {{name: string, reaction: boolean, uses: boolean, point?: string|null, left?: number|null}[]} args.rolls
 * @param {{reactionSpent: boolean, isCritical: boolean, mode: string}} args.facts
 * @returns {{key: string, name: string, kind: string, dice: string, tag: string, off: string|null}[]}
 */
export function rescueRows({ primary, rolls, facts }) {
  const out = [];
  if ( primary ) {
    const off = facts.reactionSpent ? "Reaction spent this round"
      : (facts.isCritical && (primary.kind === "ac")) ? "a crit ignores AC" : null;
    const dice = (primary.kind === "ac") ? (Number.isFinite(primary.bonus) ? `+${primary.bonus} AC` : "raises AC")
      : (primary.multiplier === 0.5) ? "halves the damage" : "reduces the damage";
    const tag = off ?? (primary.spell ? "a Reaction, a spell slot"
      : primary.pool ? `a Reaction · ${poolLeft(primary.pool)}`
      : primary.uses ? `a Reaction · ${usesLeft(primary.uses.left)}` : "a Reaction");
    out.push({ key: primary.name, name: primary.name, kind: primary.kind, dice, tag, off });
  }
  for ( const r of (rolls ?? []) ) {
    const left = Number(r.left ?? 0);
    const off = (r.reaction && facts.reactionSpent) ? "Reaction spent this round"
      : (r.uses && !(left > 0)) ? (r.point ? `no ${r.point}s left` : "no uses left")
      : (facts.mode === "disadvantage") ? "already at Disadvantage" : null;
    const cost = r.uses
      ? (r.point ? `1 ${r.point} · ${left} left` : `${r.reaction ? "a Reaction · " : ""}${usesLeft(left)}`)
      : (r.reaction ? "a Reaction" : "no cost");
    out.push({ key: r.name, name: r.name, kind: "roll", dice: "Disadvantage", tag: off ?? cost, off });
  }
  return out;
}

/**
 * A GUARD's row (Disadvantage for another); greyed and `futile` against a roll already at Disadvantage.
 * @param {{name: string, rule?: object|string|null, mode: string}} args
 * @returns {{row: {key: string, name: string, dice: string, tag: string, off: string|null, rule: object|string|null}, futile: boolean}}
 */
export function guardRow({ name, rule = "", mode }) {
  const futile = mode === "disadvantage";
  const off = futile ? "no effect — already at Disadvantage" : null;
  return { row: { key: name, name, dice: "Disadvantage", tag: off ?? "a Reaction", off, rule }, futile };
}

/** Text made safe for HTML. ⚠ The pure layer imports nothing: decide/present.js's `esc`, repeated. */
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The guard popup's line when the row can do nothing. */
export const futileGuardLine = name =>
  `It was already rolled with <strong>Disadvantage</strong>, and Disadvantage doesn't stack — ${esc(name)} would spend your Reaction for nothing. Keep it for something else.`;

const usesLeft = n => `${n} use${n === 1 ? "" : "s"} left`;

/** A reduction's pool in its own word: "3 of 4 Superiority Dice left". */
const poolLeft = ({ spend = "Superiority Die", left = 0, max = 0 } = {}) => {
  const word = (spend === "use") ? "uses" : /die$/i.test(spend) ? spend.replace(/die$/i, m => (m[0] === "D" ? "Dice" : "dice")) : `${spend}s`;
  return (max > 0) ? `${left} of ${max} ${word} left` : `${left} ${word} left`;
};

/**
 * A reaction's description as plain words: enrichers as their labels, inline rolls dropped, the
 * pack's trailing "Foundry Note" (automation, not rule) cut.
 * @param {string} html
 */
export function plainRule(html) {
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  return String(html ?? "")
    .replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, "$1")
    .replace(/&Reference\[[^\]]*\]\{([^}]*)\}/g, "$1")
    .replace(/&Reference\[([^\]\s]*)[^\]]*\]/g, (_m, key) => cap(String(key).replace(/[-_]/g, " ")))
    .replace(/\[\[[^\]]*\]\]/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim()
    .replace(/\s*Foundry Note\b.*$/i, "");
}

/**
 * The defender's card line for what the answer cost; the count is the spend record's, if any.
 * @param {{row: {reaction: boolean, uses: boolean, point?: string|null, after?: string},
 *          poolSpend?: {pool: string, left: number, max: number}|null}} args
 */
export function rescueSpendText({ row, poolSpend = null }) {
  const parts = [];
  if ( row?.reaction ) parts.push("Reaction spent");
  else if ( row?.uses && row.point ) parts.push(`1 ${row.point} spent`);
  if ( poolSpend ) parts.push(`${poolSpend.pool}: ${poolSpend.left} of ${poolSpend.max} remaining`);
  if ( row?.after ) parts.push(row.after);
  return parts.join(" · ");
}

/** The rows a player can still take. */
export const liveRows = rows => (rows ?? []).filter(r => !r.off);

/**
 * The popup's title: "Rescue the hit" for several rows, the ability's name for one.
 * @param {{name: string}[]} rows
 * @param {string} defender
 */
export function rescueTitle(rows, defender) {
  if ( (rows?.length ?? 0) > 1 ) return `Rescue the hit — ${defender}`;
  return rows?.[0] ? `${rows[0].name} — ${defender}` : `Rescue the hit — ${defender}`;
}

/**
 * The attacker's card: who bent the roll and what it did, the detail keeping the struck die.
 * `verdict` is against the live AC.
 * @param {{rescue: string, bent: {how: string, first: number, second: number|null, stood: number, firstTotal: number,
 *   total: number, wasCritical: boolean, isCritical: boolean, changed: boolean, add?: number}, verdict: "hit"|"miss", ac: number|null}} args
 * @returns {{headline: string, detail: string}}
 */
export function bentLines({ rescue, bent, verdict, ac }) {
  const word = (verdict === "miss") ? "MISS"
    : (bent.wasCritical && !bent.isCritical) ? "a hit, no longer a crit"
    : bent.changed ? "HIT" : "still a HIT";
  if ( bent.how === "die" ) {
    const n = Number(bent.add) || 0;
    const signed = `${n < 0 ? "−" : "+"}${Math.abs(n)}`;
    const vs2 = Number.isFinite(ac) ? ` vs AC ${ac}` : "";
    return { headline: `${rescue} ${signed} — ${bent.firstTotal} → ${bent.total}, ${word}`,
      detail: `d20 ${bent.first} (${bent.firstTotal}) ${signed} = ${bent.total}${vs2}` };
  }
  if ( bent.how === "set" ) {
    const vs2 = Number.isFinite(ac) ? ` vs AC ${ac}` : "";
    return { headline: `${rescue} — ${bent.first} → ${bent.stood}, ${bent.firstTotal} → ${bent.total}, ${word}`,
      detail: `the stored ${bent.stood} replaces the d20 (${bent.first}): ${bent.total}${vs2}` };
  }
  if ( bent.how === "neutralised" ) {
    const vs2 = Number.isFinite(ac) ? ` vs AC ${ac}` : "";
    return { headline: `${rescue} — no Advantage or Disadvantage, ${bent.firstTotal} → ${bent.total}, ${word}`,
      detail: `the first d20 stands: ${bent.stood} (${bent.total})${vs2}` };
  }
  const how = (bent.how === "cancelled") ? "Disadvantage cancels the Advantage" : "Disadvantage";
  const first = bent.wasCritical ? "natural 20" : `${bent.firstTotal}`;
  const headline = bent.changed
    ? `${rescue} bent the roll — ${how}, ${first} → ${bent.total}, ${word}`
    : `${rescue} bent the roll — ${how}, the ${bent.firstTotal} stands, ${word}`;
  const vs = Number.isFinite(ac) ? ` vs AC ${ac}` : "";
  const detail = (bent.how === "cancelled")
    ? `d20 ${bent.first} (${bent.firstTotal}) — the plain roll is the first die, ${bent.stood} (${bent.total})${vs}`
    : (bent.how === "lower")
      ? `d20 ${bent.first} (${bent.firstTotal}), second d20 ${bent.second ?? "?"} — the lower stands: ${bent.stood} (${bent.total})${vs}`
      : `d20 ${bent.first} (${bent.firstTotal})${vs}`;
  return { headline, detail };
}
