// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the `roll` interrupt — a defender's rescue
 * of a hit that imposes Disadvantage on the attack roll AFTER the verdict showed (Slice A, ruled
 * 2026-09-24 off prototypes/slice-a.html: Lucky, Warding Flare, Shadowy Dodge; the rows in
 * decide/registry.js INTERRUPT_ROLLS). Plain data in, plain data out — no `game`, no documents.
 *
 * ⚠ THE ARITHMETIC, AND WHY IT IS HERE. Disadvantage on a roll already made is not "reroll the
 * d20": it is a SECOND d20 with the attack's own modifiers, and the LOWER of the two standing.
 * Three cases, and the house cannot afford to get one wrong — this layer decides whether an
 * attack lands (§11 *Adding a FOLD* rule 5):
 *   normal        the attack rolled one d20 → a second is rolled, the lower stands
 *   advantage     the attack rolled 2d20kh → Advantage and Disadvantage CANCEL: the roll is a
 *                 plain roll, and the plain d20 is the FIRST die rolled — chosen before anyone
 *                 saw a face, so it is as fair as a fresh die, and no second die is rolled
 *   disadvantage  the attack already had it → Disadvantage does not stack; nothing changes, so
 *                 the row is shown spent ("already at Disadvantage") and never offered live
 * The stood d20 carries its own crit and fumble (the attack roll's own thresholds): a natural 20
 * replaced by a lower die is NO LONGER A CRIT — the case the ruling names — which is why the
 * verdict composes a `replace` (decide/verdict.js), never an `add`.
 */

/**
 * The roll mode a d20 term was rolled in, off its modifiers. dnd5e 6.0's D20Die writes its own
 * `adv` / `dis` (`adv2` for Elven Accuracy) — measured live 2026-09-24: an Advantage attack is
 * `2d20adv`, `modifiers: ["adv"]`, and the term's `number` is 1 until it evaluates — so those
 * are read first and whatever the number; core's `kh` (Advantage) / `kl` (Disadvantage) are still
 * read for a roll typed by hand. A single die with no mode modifier is a plain roll.
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
 * The d20 faces a term's results carry: the one that STOOD (active) and the PLAIN one — the first
 * face rolled that a reroll modifier did not replace (a Halfling's natural 1, rerolled natively
 * by dnd5e, is not a face the attack ever used).
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
 * Disadvantage imposed on an attack roll already made — what stands, and whether it moved.
 * @param {object} args
 * @param {"advantage"|"disadvantage"|"normal"} args.mode   the attack's own mode (d20ModeOf)
 * @param {number} args.kept      the d20 face the attack's total used
 * @param {number|null} [args.plain]   the first face rolled (the Advantage case's plain roll)
 * @param {number|null} [args.second]  the second d20's face (the plain case)
 * @param {number} args.total     the attack's total as rolled
 * @param {number} [args.critAt]  the attack roll's own critical threshold (20 unless a feature lowers it)
 * @param {number} [args.fumbleAt]
 * @param {number[]|null} [args.faces]  the attack's d20 faces in the order rolled (bentChips)
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
    // the attack's own d20 faces in the order rolled — the dice the canvas shows (bentChips)
    ...(Array.isArray(faces) ? { faces: faces.map(Number).filter(Number.isFinite) } : {})
  };
}

/**
 * THE DICE OF A BENT ROLL, as the canvas shows them (dice-rise.js; the user, 2026-09-26: "rebuild
 * the shape, start with 1"): every d20 in play, in the order rolled, the one that STANDS gold-edged
 * and the rest dropped under a strike — red when the drop took a critical with it.
 *   lower      the attack's die, then the second: the lower stands (a tie keeps the first)
 *   cancelled  the Advantage pair: the FIRST die stands (the register), the other drops
 *   none       nothing moved (already at Disadvantage): no dice
 * @param {{how: string, first: number, second: number|null, stood: number, wasCritical: boolean,
 *          isCritical: boolean, faces?: number[]}|null} bent
 * @returns {{label: string, up?: boolean, drop?: boolean, lost?: boolean}[]}
 */
export function bentChips(bent) {
  if ( !bent || (bent.how === "none") ) return [];
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
 * Does a rolled critical stand for the damage? One damage roll serves every target the attack
 * hit, so the crit doubles the dice only when it stands against ALL of them — the automatic
 * crit's intersection rule (auto-damage.js `critFor`). A target whose hold bent the roll carries
 * its own `bent` result; the crit is gone for the roll when any hit target's bent roll is not one.
 * @param {{rolledCrit: boolean, hitUuids: string[], bents: Record<string, {isCritical?: boolean}|null|undefined>}} args
 */
export function critStands({ rolledCrit, hitUuids, bents }) {
  if ( !rolledCrit ) return false;
  return (hitUuids ?? []).every(uuid => bents?.[uuid]?.isCritical !== false);
}

/**
 * The rows the popup that rescues a hit shows (the ruled prototype's scenes 2a–2c): the held
 * reaction the list found first (Shield, Parry — `primary`) and every `roll` row the sheet holds.
 * A row is the name, what it does, and a FACT as its tag — the cost, or, when it cannot be
 * taken, why ("Reaction spent this round", "no uses left"). A spent row stays, greyed, with its
 * reason; the popup opens only when one row is live (`liveRows`).
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
 * A GUARD's row (Protection, beside the creature hit): Disadvantage for another. When the attack
 * already rolled with Disadvantage the row still shows — the guard is asked, the table sees why it
 * would do nothing — but greyed, and the popup says so above it (the walk, 2026-09-26: "when
 * someone already attacked with disadvantage and it still hits, its kinda pointless to protect,
 * but pop it up, but say its not worth spending reaction").
 * @param {{name: string, rule?: string, mode: string}} args
 * @returns {{row: {key: string, name: string, dice: string, tag: string, off: string|null, rule: string}, futile: boolean}}
 */
export function guardRow({ name, rule = "", mode }) {
  const futile = mode === "disadvantage";
  const off = futile ? "no effect — already at Disadvantage" : null;
  return { row: { key: name, name, dice: "Disadvantage", tag: off ?? "a Reaction", off, rule }, futile };
}

/** The guard popup's line when the row can do nothing: why, and that the Reaction is better kept. */
export const futileGuardLine = name =>
  `It was already rolled with <strong>Disadvantage</strong>, and Disadvantage doesn't stack — ${name} would spend your Reaction for nothing. Keep it for something else.`;

const usesLeft = n => `${n} use${n === 1 ? "" : "s"} left`;

/**
 * A reduction's pool in its own word, with the count (the Goliath walk, 2026-09-25): "2 of 3 uses
 * left" for a boon paying from its own uses, "3 of 4 Superiority Dice left" for Parry's pool.
 */
const poolLeft = ({ spend = "Superiority Die", left = 0, max = 0 } = {}) => {
  const word = (spend === "use") ? "uses" : /die$/i.test(spend) ? spend.replace(/die$/i, m => (m[0] === "D" ? "Dice" : "dice")) : `${spend}s`;
  return (max > 0) ? `${left} of ${max} ${word} left` : `${left} ${word} left`;
};

/**
 * A reaction's own text as its row's folded rule (law 8 — read off the sheet's item, never
 * copied): the description's HTML flattened to words, an enricher shown as the label the card
 * renders (`&Reference[prone]` → "Prone"), an inline roll or lookup dropped, and the pack's
 * trailing "Foundry Note" (about the automation, not the rule) cut.
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
 * The defender's card line for what the answer cost (the prototype's scene 2b): "1 Luck Point
 * spent · Luck Points: 2 of 3 remaining", "Reaction spent · Warding Flare: 1 of 2 remaining",
 * "Reaction spent · teleport up to 30 feet if you wish (the table moves the token)". The count
 * is the spend record's (shared.js `spendPoolUses`) — absent when the sheet's own use paid it.
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
 * The popup's title: the ruled "Rescue the hit — <defender>" when there are several rows; one
 * row keeps the house's single-moment title, the ability and who.
 * @param {{name: string}[]} rows
 * @param {string} defender
 */
export function rescueTitle(rows, defender) {
  if ( (rows?.length ?? 0) > 1 ) return `Rescue the hit — ${defender}`;
  return rows?.[0] ? `${rows[0].name} — ${defender}` : `Rescue the hit — ${defender}`;
}

/**
 * The attacker's card, after (prototype scene 2d, source then result — law 6): the headline says
 * who bent the roll and what it did, the detail keeps the struck die for anyone checking.
 * `verdict` is the one the continuation took against the live AC.
 * @param {{rescue: string, bent: ReturnType<typeof disadvantageOutcome>, verdict: "hit"|"miss", ac: number|null}} args
 * @returns {{headline: string, detail: string}}
 */
export function bentLines({ rescue, bent, verdict, ac }) {
  const word = (verdict === "miss") ? "MISS"
    : (bent.wasCritical && !bent.isCritical) ? "a hit, no longer a crit"
    : bent.changed ? "HIT" : "still a HIT";
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
