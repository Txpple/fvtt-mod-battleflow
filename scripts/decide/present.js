// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the presentation formatters. Pure — strings
 * in, strings out; the spine keeps everything that touches a document, a dialog or the DOM.
 * ⚠ Inline styles on purpose: module.json has no `styles` entry, and adding one costs a Foundry
 * process restart where a script change is live on F5.
 * ⚠ `momentBarHTML` reads the wall clock (an input the tests fake). Depend downward only: nothing
 * here may import a machine, the spine, or core.js.
 */

/** The popup identity every machine shares: one decision, one key, one live view. */
export const popupKey = (messageId, uuid) => `${messageId}|${uuid}`;

/* The house card: everything this module says out loud wears it. */

/**
 * THE PALETTE — one meaning per hue (RULINGS *The gate before the roll*): green good for you,
 * red bad, orange waiting on you, yellow a crit, grey nothing bending. Blue stays out — dnd5e
 * means healing by it.
 */
export const TONE = {
  pending: "rgba(222,120,40,0.95)",   // waiting on a human — ORANGE
  good:    "rgba(70,150,95,0.95)",    // good for you: it did its job, Advantage, saved, honoured
  bad:     "rgba(180,70,60,0.95)",    // bad for you: it landed anyway, Disadvantage, failed
  neutral: "rgba(120,120,120,0.75)",  // nothing bends
  crit:    "rgba(232,190,50,0.95)"    // a critical hit — YELLOW, dark text
};

/** The tone a roll mode wears: Advantage good, Disadvantage bad, Normal and Listed neutral. */
export const modeTone = mode => ((mode === "advantage") || (mode === "succeeds")) ? TONE.good
  : ((mode === "disadvantage") || (mode === "fails")) ? TONE.bad : TONE.neutral;

/**
 * THE MODE TAG — one small coloured label wherever a roll mode is shown. Listed is the outline
 * of Normal (both "no bend counted"; colour is spent on bends alone). `fails` / `succeeds` are a
 * save the rules decide before the dice.
 * @param {"advantage"|"disadvantage"|"normal"|"listed"|"fails"|"succeeds"} mode
 */
export function modeTagHTML(mode) {
  const listed = (mode === "listed");
  const tone = listed ? TONE.neutral : modeTone(mode);
  const text = listed ? "Listed" : (mode === "advantage") ? "Advantage" : (mode === "disadvantage") ? "Disadvantage"
    : (mode === "fails") ? "Fails" : (mode === "succeeds") ? "Succeeds" : "Normal";
  const fill = listed
    ? `background:transparent;border:1px solid ${tone};color:inherit;opacity:0.85;`
    : `background:${tone};border:1px solid transparent;color:${((mode === "disadvantage") || (mode === "fails")) ? "#fff" : "#111"};`;
  return `<span data-bf-mode="${mode}" style="display:inline-block;font-size:var(--font-size-10,10px);letter-spacing:0.08em;
    text-transform:uppercase;font-weight:bold;padding:0.15rem 0.5rem;border-radius:3px;white-space:nowrap;
    line-height:1.3;vertical-align:middle;${fill}">${text}</span>`;
}

/**
 * One card: an accent spine, a portrait, an eyebrow/title/subtitle stack, and body lines.
 * `lines` are already-safe HTML fragments; the eyebrow, title and subtitle are TEXT and escaped
 * here - they carry token, actor and item names, which a player can set.
 */
export function bfCard({ img, eyebrow, title, subtitle, lines = [], tone = "neutral" }) {
  const accent = TONE[tone] ?? TONE.neutral;
  // The portrait's tooltip names the card; tags out and escaped, since it lands in an attribute.
  const tip = esc(String(eyebrow || title || "").replace(/<[^>]*>/g, ""));
  const portrait = img
    ? `<img src="${esc(img)}" alt="${tip}" data-tooltip="${tip}"
         style="width:40px;height:40px;flex:0 0 auto;border-radius:4px;
         border:1px solid var(--color-border-dark,#0006);object-fit:cover;">`
    : "";
  const body = lines.filter(Boolean).map(line =>
    `<div style="margin-top:0.2rem;">${line}</div>`).join("");
  return `
  <div style="border-left:3px solid ${accent};border-radius:3px;padding:0.4rem 0.55rem;
              background:rgba(0,0,0,0.04);">
    <div style="display:flex;gap:0.5rem;align-items:center;">
      ${portrait}
      <div style="flex:1;min-width:0;">
        ${eyebrow ? `<div style="font-size:var(--font-size-10,10px);letter-spacing:0.08em;
             text-transform:uppercase;opacity:0.6;line-height:1.4;">${esc(eyebrow)}</div>` : ""}
        <div style="font-family:var(--font-h1,inherit);font-size:var(--font-size-15,15px);
             font-weight:bold;line-height:1.2;">${esc(title)}</div>
        ${subtitle ? `<div style="font-size:var(--font-size-11,11px);opacity:0.7;
             line-height:1.3;">${esc(subtitle)}</div>` : ""}
      </div>
    </div>
    ${body ? `<div style="margin-top:0.35rem;font-size:var(--font-size-12,12px);
         line-height:1.5;">${body}</div>` : ""}
  </div>`;
}

/** The verbatim rule quote as a card line; the words come from the caller, this is the dress. */
export const ruleLine = text => `<em>“${text}”</em>`;

/**
 * THE ONE WORDING FOR A SPENT DIE — `Combat Superiority: 3 of 4 remaining` — so the popup, the
 * card and the floating text agree.
 * @param {{pool: string, left: number, max: number}} row
 */
export const spendLine = row => `${row.pool}: ${row.left} of ${row.max} remaining`;
/** "one Superiority Die spent · Combat Superiority: 3 of 4 remaining" — or the bare spend when no row is known. */
export const spendPhrase = (rows, die = "Superiority Die") => rows?.length
  ? `one ${die} spent · ${rows.map(spendLine).join(" · ")}` : `one ${die} spent`;

/**
 * The situational-bonus row every popup that stands in for a roll dialog carries. `name` is the
 * input's name, so the caller reads it back off the dialog.
 */
export function situationalBonusHTML(name) {
  return `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">Situational Bonus</label>
      <input type="text" name="${name}" placeholder="e.g. 1d4" autocomplete="off"
             style="flex:1;min-width:0;text-align:center;">
    </div>`;
}

/**
 * THE GATE'S SECTION — the header line ("2 Modifiers — Net [tag]"), then a box per source: the
 * fact, its bend as the mode tag, the rule quoted underneath (law 8). An unbent row wears the
 * Listed outline. See RULINGS *The gate before the roll*.
 * @param {{head: {title: string, net: "advantage"|"disadvantage"|"normal", why?: string},
 *          boxes: {label: string, bend: "advantage"|"disadvantage"|null, rule?: string}[]}} view
 */
export function reminderSectionHTML({ head, boxes }) {
  const rows = boxes.map(b => `
      <div style="display:grid;grid-template-columns:1fr auto;gap:0.2rem 0.6rem;align-items:center;
                  margin:0.4rem 0;padding:0.45rem 0.6rem;border-radius:4px;
                  background:rgba(0,0,0,0.25);border:1px solid var(--color-border-dark,rgba(0,0,0,0.4));
                  border-left:3px solid ${modeTone(b.bend ?? "listed")};">
        <div style="font-weight:bold;">${b.label}</div>
        ${modeTagHTML(b.bend ?? "listed")}
        ${b.rule ? `<div style="grid-column:1 / -1;font-size:var(--font-size-12,12px);line-height:1.45;opacity:0.85;">${ruleLine(b.rule)}</div>` : ""}
      </div>`).join("");
  return `
    <div data-bf-reminder-head style="display:flex;align-items:center;gap:0.45rem;margin:0.2rem 0 0.1rem;">
      <span>${attr(head.title)}</span> ${modeTagHTML(head.net)}
    </div>${rows}`;
}

/**
 * The section folded to its header line: a native `<details>` whose summary tag says what the
 * roll does without opening.
 * @param {{head: {title: string, net: "advantage"|"disadvantage"|"normal", why?: string},
 *          boxes: {label: string, bend: "advantage"|"disadvantage"|null, rule?: string}[]}} view
 * @param {{open?: boolean}} [opts]
 */
export function reminderDetailsHTML({ head, boxes }, { open = false } = {}) {
  const section = reminderSectionHTML({ head, boxes });
  // The head is the summary: lift it out of the section and wrap what remains.
  const headEnd = section.indexOf("</div>") + "</div>".length;
  const headHTML = section.slice(0, headEnd).replace("data-bf-reminder-head", "data-bf-reminder-head data-bf-summary");
  return `<details data-bf-reminder-details ${open ? "open" : ""}>
    <summary style="cursor:pointer;list-style:none;">${headHTML}</summary>${section.slice(headEnd)}
  </details>`;
}

/**
 * The section inside the system's own roll dialog: one `<fieldset>` shaped exactly like dnd5e's
 * CONFIGURATION fieldset beside it, so the dialog's own styling dresses it. The EDGE inserts it
 * after the CONFIGURATION fieldset.
 * @param {{head: {title: string, net: "advantage"|"disadvantage"|"normal", why?: string},
 *          boxes: {label: string, bend: "advantage"|"disadvantage"|null, rule?: string}[], legend?: string}} view
 */
export function reminderFieldsetHTML({ head, boxes, legend = "Before you roll" }, { open = false } = {}) {
  return `
  <fieldset data-bf-reminder>
    <legend>${attr(legend)}</legend>${reminderDetailsHTML({ head, boxes }, { open })}
  </fieldset>`;
}

/**
 * THE SNEAK ATTACK BOX under the gate's sources: a checkbox where the other boxes carry a tag
 * (the roll still needs its mode press, so the choice is never a fourth button). "Sneak Attack
 * — 5d6", the tick, the folded rule, nothing else. Used this turn: greyed, the reason, no tick.
 * @param {{dice: string, rule: string, checked?: boolean, used?: string|null}} view
 */
export function sneakBoxHTML({ dice, rule, checked = false, used = null }) {
  // The used reason sits on its own full-width line; beside the title it squeezes the title.
  const control = used ? "" : `<label style="display:flex;align-items:center;gap:0.4rem;white-space:nowrap;cursor:pointer;">
        <input type="checkbox" name="bf-sneak" ${checked ? "checked" : ""} style="margin:0;"> <span>Sneak Attack</span></label>`;
  return `
      <div data-bf-sneak style="display:grid;grid-template-columns:1fr auto;gap:0.2rem 0.6rem;align-items:center;
                  margin:0.4rem 0;padding:0.45rem 0.6rem;border-radius:4px;${used ? "opacity:0.6;" : ""}
                  background:rgba(0,0,0,0.25);border:1px solid var(--color-border-dark,rgba(0,0,0,0.4));
                  border-left:3px solid ${used ? TONE.neutral : TONE.pending};">
        <div style="font-weight:bold;">Sneak Attack — ${attr(dice)}</div>
        ${control}
        ${used ? `<div style="grid-column:1 / -1;font-size:var(--font-size-11,11px);line-height:1.45;opacity:0.85;">${attr(used)}</div>` : ""}
        ${foldedRuleHTML(rule)}
      </div>`;
}

/**
 * THE BUY BOX — the Sneak Attack box's shape for Advantage bought with an item's use
 * (`ADVANTAGE_BUYS`): "Lucky — 1 Luck Point · 3 left", a tick labelled Advantage, the folded
 * rule. No uses left: greyed, no tick, the reason said.
 * @param {{name: string, point: string, left: number, rule: string, checked?: boolean}} view
 */
export function buyBoxHTML({ name, point, left, rule, checked = false }) {
  const out = !(Number(left) > 0);
  const control = out ? "" : `<label style="display:flex;align-items:center;gap:0.4rem;white-space:nowrap;cursor:pointer;">
        <input type="checkbox" name="bf-buy" data-bf-buy-name="${attr(name)}" ${checked ? "checked" : ""} style="margin:0;"> <span>Advantage</span></label>`;
  return `
      <div data-bf-buy style="display:grid;grid-template-columns:1fr auto;gap:0.2rem 0.6rem;align-items:center;
                  margin:0.4rem 0;padding:0.45rem 0.6rem;border-radius:4px;${out ? "opacity:0.6;" : ""}
                  background:rgba(0,0,0,0.25);border:1px solid var(--color-border-dark,rgba(0,0,0,0.4));
                  border-left:3px solid ${out ? TONE.neutral : TONE.pending};">
        <div style="font-weight:bold;">${attr(name)} — 1 ${attr(point)} · ${Math.max(0, Number(left) || 0)} left</div>
        ${control}
        ${out ? `<div style="grid-column:1 / -1;font-size:var(--font-size-11,11px);line-height:1.45;opacity:0.85;">no ${attr(point)}s left</div>` : ""}
        ${foldedRuleHTML(rule)}
      </div>`;
}

/**
 * A rule quoted under a fold: a native `<details>`, closed, its summary "the rule ▸".
 * @param {string} rule
 */
export function foldedRuleHTML(rule) {
  if ( !rule ) return "";
  return `<details data-bf-rule style="grid-column:1 / -1;font-size:var(--font-size-12,12px);line-height:1.45;opacity:0.85;">
          <summary style="cursor:pointer;list-style:none;opacity:0.75;font-size:var(--font-size-11,11px);">the rule ▸</summary>${ruleLine(rule)}</details>`;
}

/**
 * THE CUNNING STRIKE MENU on the damage offer: a checkbox per option the sheet grants, its cost
 * as the tag, its rule folded; unaffordable rows show disabled. The header says the DC and how
 * many may be picked.
 * @param {{rows: {key: string, label: string, cost: number, rule: string, caveat?: string, line: boolean, affordable: boolean}[],
 *          max: number, dc: number|null, dice: string, chosen?: Iterable<string>}} view
 */
export function cunningMenuHTML({ rows, max, dc, dice, chosen = [] }) {
  if ( !rows.length ) return "";
  const picked = new Set(chosen);
  const items = rows.map(r => `
      <label data-bf-cunning-row="${attr(r.key)}" style="display:grid;grid-template-columns:auto 1fr auto;gap:0.2rem 0.5rem;align-items:center;
             margin:0.3rem 0;padding:0.35rem 0.5rem;border-radius:4px;background:rgba(0,0,0,0.06);
             border:1px solid var(--color-border-light,rgba(0,0,0,0.2));${r.affordable ? "cursor:pointer;" : "opacity:0.5;"}">
        <input type="checkbox" name="bf-cunning" value="${attr(r.key)}" ${picked.has(r.key) ? "checked" : ""} ${r.affordable ? "" : "disabled"} style="margin:0;">
        <span style="font-weight:bold;">${attr(r.label)}</span>
        <span style="font-size:var(--font-size-10,10px);letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;opacity:0.85;">${r.cost ? `${r.cost}d forgone` : "no cost"}</span>
        ${foldedRuleHTML(r.rule).replace("grid-column:1 / -1", "grid-column:2 / -1")}
      </label>`).join("");
  return `
    <div data-bf-cunning style="margin-top:0.5rem;">
      <div style="display:flex;align-items:baseline;gap:0.6rem;">
        <span style="font-weight:bold;font-size:var(--font-size-12,12px);">Cunning Strike</span>
        <span style="font-size:var(--font-size-10,10px);letter-spacing:0.06em;text-transform:uppercase;opacity:0.85;">${[attr(dice), dc ? `DC ${dc}` : null, (max > 1) ? `up to ${max}` : null].filter(Boolean).join(" · ")}</span>
      </div>
      ${items}
    </div>`;
}

/**
 * THE CLOCK RIDERS on the damage offer (RULINGS *The gate before the roll*): a checkbox per due
 * rider, TICKED by default (a limited use is the player's to decline). The row is the name, the
 * dice and type, the uses left after, the folded rule — nothing else. ⚠ No caveat line: `caveat`
 * is accepted and IGNORED here; the clock's `why` belongs on the card. An effect-only rider has
 * no dice; its `says` stands where the dice would.
 * @param {{key: string, label: string, formula: string|null, says?: string|null, type: string|null, why: string, rule: string,
 *          usesLeft?: number|null, caveat?: string}[]} riders
 */
export function riderMenuHTML(riders) {
  const rows = (riders ?? []).filter(r => r.formula || r.says);
  if ( !rows.length ) return "";
  const items = rows.map(r => `
      <label data-bf-rider-row="${attr(r.key)}" style="display:grid;grid-template-columns:auto 1fr auto;gap:0.2rem 0.5rem;align-items:center;
             margin:0.3rem 0;padding:0.35rem 0.5rem;border-radius:4px;background:rgba(0,0,0,0.06);
             border:1px solid var(--color-border-light,rgba(0,0,0,0.2));cursor:pointer;">
        <input type="checkbox" name="bf-rider" value="${attr(r.key)}" checked style="margin:0;">
        <span style="font-weight:bold;">${attr(r.label)} — ${r.formula ? `${attr(r.formula)}${r.type ? ` ${attr(r.type)}` : ""}` : attr(r.says)}</span>
        <span style="font-size:var(--font-size-10,10px);letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;opacity:0.85;">${(r.usesLeft === null) || (r.usesLeft === undefined) ? "" : `${Math.max(0, r.usesLeft - 1)} use${(r.usesLeft - 1) === 1 ? "" : "s"} left after`}</span>
        ${foldedRuleHTML(r.rule).replace("grid-column:1 / -1", "grid-column:2 / -1")}
      </label>`).join("");
  return `
    <div data-bf-riders style="margin-top:0.5rem;">
      <div style="font-weight:bold;font-size:var(--font-size-12,12px);">Riding this hit</div>
      ${items}
    </div>`;
}


/**
 * THE HIT MENU on the damage offer (RULINGS *The hit menu*): a group per paying feature, a row
 * per option — the name and its cost, the rule folded. One pick per group (the EDGE unticks the
 * sibling). A group with no die left keeps its rows, greyed, its tag saying why.
 * @param {{groups: {key: string, label: string, tag: string, off: boolean,
 *          rows: {key: string, label: string, cost: string, caveat?: string|null, rule: string, affordable: boolean}[]}[]}} view
 */
export function hitMenuHTML({ groups }) {
  if ( !groups?.length ) return "";
  const blocks = groups.map(g => {
    const items = g.rows.map(r => `
      <label data-bf-hit-row="${attr(r.key)}" style="display:grid;grid-template-columns:auto 1fr auto;gap:0.2rem 0.5rem;align-items:center;
             margin:0.3rem 0;padding:0.35rem 0.5rem;border-radius:4px;background:rgba(0,0,0,0.06);
             border:1px solid var(--color-border-light,rgba(0,0,0,0.2));${r.affordable ? "cursor:pointer;" : "opacity:0.5;"}">
        <input type="checkbox" name="bf-hit" value="${attr(r.key)}" data-bf-hit-group="${attr(g.key)}" ${r.affordable ? "" : "disabled"} style="margin:0;">
        <span style="font-weight:bold;">${attr(r.label)}</span>
        <span style="font-size:var(--font-size-10,10px);letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;opacity:0.85;">${attr(r.cost)}</span>
        ${foldedRuleHTML(r.rule).replace("grid-column:1 / -1", "grid-column:2 / -1")}
      </label>`).join("");
    return `
    <div data-bf-hit-group="${attr(g.key)}" style="margin-top:0.5rem;">
      <div style="display:flex;align-items:baseline;gap:0.6rem;">
        <span style="font-weight:bold;font-size:var(--font-size-12,12px);">${attr(g.label)}</span>
        <span style="font-size:var(--font-size-10,10px);letter-spacing:0.06em;text-transform:uppercase;opacity:0.85;${g.off ? "color:var(--color-level-error,#b44);" : ""}">${attr(g.tag)}</span>
      </div>
      ${items}
    </div>`;
  }).join("");
  return `
    <div data-bf-hit>
      ${blocks}
    </div>`;
}

/**
 * The three roll-mode buttons as DialogV2 descriptors, for every popup that stands in for a roll
 * dialog. `defaultMode` marks the button Enter triggers — the outcome the solver worked out.
 * ⚠ DialogV2 always has a default: with none flagged it makes the FIRST button (Advantage) the
 * Enter target.
 * @param {(mode: "advantage"|"normal"|"disadvantage") => void} press
 * @param {"advantage"|"normal"|"disadvantage"|null} [defaultMode]
 */
export function modeButtons(press, defaultMode = null) {
  return [
    { action: "advantage", label: "Advantage", default: defaultMode === "advantage",
      callback: () => press("advantage") },
    { action: "normal", label: "Normal", default: defaultMode === "normal",
      callback: () => press("normal") },
    { action: "disadvantage", label: "Disadvantage", default: defaultMode === "disadvantage",
      callback: () => press("disadvantage") }
  ];
}

/* The countdown bar (ARCHITECTURE.md §5). ⚠ Zero JS ticking: one CSS animation per bar, resumed
 * mid-drain by a negative animation-delay from the stored deadline (`syncHoldBars` in ui.js). */

/**
 * THE BAR: a pure function of `{deadline, window}` — no status field. The label names what the
 * buzzer does ("answer", or "roll" for a demanded save).
 */
export function momentBarHTML(spec, label = "to answer") {
  if ( !spec?.deadline || !spec?.window ) return "";
  if ( (spec.deadline - Date.now()) <= 0 ) return "";
  return `
  <div style="margin-top:0.45rem;display:flex;align-items:center;gap:0.4rem;">
    <div style="flex:1;height:6px;border-radius:3px;background:rgba(0,0,0,0.18);overflow:hidden;">
      <div data-bf-deadline="${spec.deadline}" data-bf-window="${spec.window}"
           style="height:100%;width:100%;border-radius:3px;
                  background:${TONE.good};"></div>
    </div>
    <span style="font-size:var(--font-size-10,10px);opacity:0.6;white-space:nowrap;">
      ${spec.window}s ${label}</span>
  </div>`;
}

/**
 * The status-gated wrapper for WHOLE flags: a resolved moment renders no bar. ⚠ A sub-object (a
 * choice, a notice) has no `status` — pass it to momentBarHTML, or the bar silently vanishes.
 */
export function holdBarHTML(hold, label = "to answer") {
  if ( hold?.status !== "pending" ) return "";
  return momentBarHTML(hold, label);
}

/* THE STAIRCASE (ARCHITECTURE.md §5 law 7): the arithmetic only; ui.js owns the anchor. */

export const CASCADE_STEP = 36;   // ≈ one window header — the full title stays visible

/** The smallest free slot. ⚠ Not a live-popup count: that lands a newcomer on a survivor. */
export function nextCascadeSlot(usedSlots) {
  const used = new Set(usedSlots);
  let slot = 0;
  while ( used.has(slot) ) slot += 1;
  return slot;
}

/** Where slot `n` sits, relative to the pile's anchor; modulo keeps a huge pile on screen. */
export function cascadePosition(anchor, slot) {
  const step = (slot % 8) * CASCADE_STEP;
  return { left: anchor.left + step, top: anchor.top + step };
}

/**
 * THE RANK (ARCHITECTURE §5 law 7): windows born of one hit front by CLASS, then event order.
 * The key's sub (`popupKey(messageId, sub)`) names the moment; the table ranks the classes.
 *   0  the damage prompt ("You hit! — roll damage", auto-damage.js)
 *   1  the weapon's mastery — the ask, the notice (Vex, Sap, Cleave), the Topple demand
 *   2  a listed carrier's OFFER on the hit (the Maneuver Folds list, decide/registry.js): the bash,
 *      the hew, Commander's Strike, the Riposte
 *   3  everything else, in event order
 * ⚠ A new sub stays at the last rank unless it is ruled into a class — the table is the ruling.
 */
export const POPUP_RANK = Object.freeze({
  damage: 0,
  mastery: 1, notice: 1, topple: 1,
  bashoffer: 2, hew: 2, command: 2, riposte: 2
});
const UNRANKED = 3;

/** A popup key's rank — the sub before its first `:`; unlisted keys rank last. */
export function popupRank(key) {
  const sub = String(key ?? "").split("|")[1] ?? "";
  const family = sub.split(":")[0] ?? "";
  return POPUP_RANK[family] ?? UNRANKED;
}

/**
 * The whole pile, BACK TO FRONT: fronting every key in this order (the newcomer included — it
 * may outrank an elder) leaves the lowest rank's earliest moment on top.
 */
export function pileBackToFront(slots) {
  return [...slots.entries()]
    .sort(([ka, a], [kb, b]) => (popupRank(kb) - popupRank(ka)) || (b - a))
    .map(([k]) => k);
}

/* THE RESCUE VIEW — the row model. Two flags on one roll (`precision`, `d20fold`) ask one
 * question — "short by N; what do you burn?" — so the VIEW merges and the flags stay separate.
 * Pure: flags, the composed roll and the reveal setting in, a row model out. A new own-roll
 * rescue is an entry in RESCUE_SOURCES, not a new popup. */

/**
 * THE RESCUE KINDS — label, glyph, cost and the verbatim rule. ⚠ One copy of each quote (law 8:
 * the quote is the rule); d20-folds.js and maneuvers.js read them from here.
 * ⚠ `label` is not the lookup key: the settings list finds `bardic` by the effect name
 * "Inspired"; the label only announces it. `cost` is per kind because the rules disagree.
 */
export const RESCUE_KINDS = {
  heroic: {
    label: "Heroic Inspiration",
    icon: "fa-solid fa-wand-sparkles",
    cost: "spent either way, and the new roll stands",
    rule: "If you have Heroic Inspiration, you can expend it to reroll any die immediately after rolling it, and you must use the new roll."
  },
  tactical: {
    label: "Tactical Mind",
    icon: "fa-solid fa-brain",
    cost: "not expended if the check still fails",
    rule: "When you fail an ability check, you can expend a use of your Second Wind to push yourself toward success. Rather than regaining Hit Points, you roll 1d10 and add the number rolled to the ability check, potentially turning it into a success."
  },
  bardic: {
    label: "Bardic Inspiration",
    icon: "fa-solid fa-music",
    cost: "expended when rolled, whether or not it helps",
    rule: "Once within the next hour when the creature fails a D20 Test, the creature can roll the Bardic Inspiration die and add the number rolled to the d20, potentially turning the failure into a success. A Bardic Inspiration die is expended when it's rolled."
  },
  seeking: {
    label: "Seeking Spell",
    icon: "fa-solid fa-compass",
    cost: "1 Sorcery Point, spent either way, and the new roll stands",
    rule: "If you make an attack roll for a spell and miss, you can spend 1 Sorcery Point to reroll the d20, and you must use the new roll. You can use Seeking Spell even if you’ve already used a different Metamagic option during the casting of the spell."
  },
  // Advantage bought on an initiative rolled with no dialog; the offer carries its row's name and rule.
  advantage: {
    icon: "fa-solid fa-clover",
    cost: "the use is spent either way, and the higher d20 stands"
  },
  // A save turned to a success (SAVE_SUCCEEDS); the offer carries its row's name and rule. No die.
  succeed: {
    icon: "fa-solid fa-shield-halved",
    cost: "one use, back after a Short or Long Rest"
  },
  precision: {
    label: "Precision Attack",
    icon: "fa-solid fa-crosshairs",
    cost: "the superiority die is spent either way it lands",
    rule: "When you miss with an attack roll, you can expend one Superiority Die, roll that die, and add it to the attack roll, potentially causing the attack to hit."
  }
};

/**
 * What to CALL an offer or a spend on screen. ⚠ The fallback is the wire-format rule: a flag
 * stamped by an older build may carry no `label`, and must still read right, not "undefined".
 */
export const rescueLabel = named =>
  named?.label ?? RESCUE_KINDS[named?.kind]?.label ?? named?.name ?? "a fold";

/**
 * WHERE THE ROWS COME FROM — one entry per message flag: its premise, whether it still asks,
 * and its offers and spends as rows. `action` is the machine's own answer token, handed back
 * to it by the spine, so one window drives two machines that never know each other.
 */
export const RESCUE_SOURCES = [
  {
    flag: "d20fold",
    premise: flag => ({
      testKind: flag?.testKind,
      baseTotal: flag?.baseTotal,
      targets: flag?.targets ?? [],
      dc: flag?.dc
    }),
    isPending: flag => (flag?.status === "pending"),
    rows: flag => [
      // ⚠ Offers only while pending: a resolved flag keeps its `offers`, and rendering them
      // would put live buttons on a finished moment.
      // ⚠ Two `tactical` rows can stand at once (Tactical Mind and Ambush), so a tactical
      // row's action carries its name — `tactical:Ambush`.
      ...((flag?.status === "pending") ? (flag?.offers ?? []) : []).map(o => ({
        kind: o.kind,
        action: (o.kind === "tactical") ? `tactical:${o.name}` : o.kind,
        label: rescueLabel(o),
        die: o.dieFormula ?? null,
        spent: false,
        // A scoped `tactical` offer carries its own cost and rule; the kind's are Tactical Mind's.
        ...(o.cost ? { cost: o.cost } : {}),
        ...(o.rule ? { rule: o.rule } : {})
      })),
      // Spends read off `spends`, never `offers`. A reroll (`heroic`) REPLACES the roll and
      // carries its number under `reroll`, with its own crit and fumble.
      ...(flag?.spends ?? []).map(s => ({
        kind: s.kind,
        action: (s.kind === "tactical") ? `tactical:${s.name}` : s.kind,
        label: rescueLabel(s),
        die: null,
        spent: true,
        result: Number.isFinite(s.reroll?.total) ? s.reroll.total
          : (Number.isFinite(s.die) ? s.die : null),
        replaced: Number.isFinite(s.reroll?.total)
      }))
    ]
  },
  {
    flag: "precision",
    // Precision rides an attack and names its total `attackTotal`; normalised so headers match.
    premise: flag => ({
      testKind: "attack",
      baseTotal: flag?.attackTotal,
      targets: flag?.targets ?? [],
      dc: undefined
    }),
    isPending: flag => (flag?.status === "pending"),
    // One flag, one row; the flag is its own spend record. Passed or expired: no row at all.
    rows: flag => {
      if ( !flag ) return [];
      const spent = (flag.outcome === "used") && Number.isFinite(flag.die);
      if ( !spent && (flag.status !== "pending") ) return [];
      return [{
        kind: "precision",
        action: "use",
        label: flag.itemName ?? RESCUE_KINDS.precision.label,
        img: flag.itemImg ?? null,
        die: spent ? null : (flag.dieFormula ?? null),
        spent,
        result: spent ? flag.die : null,
        replaced: false
      }];
    }
  }
];

/**
 * ONE flag's declared source. ⚠ An unknown key warns: an empty view silently never opens.
 */
export function rescueSourceFor(flagKey) {
  const sources = RESCUE_SOURCES.filter(s => s.flag === flagKey);
  if ( !sources.length ) {
    console.warn(`Battle Flow | No rescue source is declared for "${flagKey}" — its rows will `
      + "never render. Add it to RESCUE_SOURCES or fix the key.");
  }
  return sources;
}

/**
 * THE HEADER — the sentences both machines derive through this one function, so the view can
 * dedupe them by string. ⚠ `reveal` (`holdReveal`) gates the margin, never the player's own
 * total. ⚠ No verdict without a DC: dnd5e records none for a raw ability check.
 */
export function rescueHeaderLines(premise, composed, { reveal = false } = {}) {
  const base = Number(premise?.baseTotal) || 0;
  const total = Number.isFinite(composed?.total) ? composed.total : base;
  const added = Number(composed?.added) || 0;
  const sum = composed?.replaced ? `${base} → ${total}`
    : added ? `${base} + ${added} = ${total}` : `${total}`;
  // Initiative has nothing to land: the number is the order itself. A raw check has no DC, so
  // it goes to the DM — outside the reveal gate, since there is no number to hide.
  if ( premise?.testKind === "initiative" ) return [`Initiative: ${sum}`];
  const testable = (premise?.targets ?? []).some(t => Number.isFinite(t?.ac))
    || Number.isFinite(premise?.dc);
  if ( !testable ) return [`${sum} — ask your DM whether that lands.`];
  if ( !reveal ) return [sum];
  const lines = [];
  for ( const t of premise?.targets ?? [] ) {
    if ( !Number.isFinite(t?.ac) ) continue;          // a null AC is left to humans (DESIGN R1)
    const short = t.ac - total;
    lines.push(`${sum} vs AC ${t.ac} — `
      + ((short > 0) ? `misses ${t.name} by ${short}` : `hits ${t.name}`));
  }
  if ( Number.isFinite(premise?.dc) ) {
    const short = premise.dc - total;
    lines.push(`${sum} vs DC ${premise.dc} — `
      + ((short > 0) ? `short by ${short}` : "makes it"));
  }
  return lines.length ? lines : [sum];
}

/**
 * THE WHOLE VIEW — every rescue source on one message. `read(flagKey)` is the EDGE's reader,
 * so the model tests with plain objects.
 * @param {(key: string) => any} read
 * @param {object} [ctx]
 * @param {?{total?: number, added?: number, replaced?: boolean}} [ctx.composed] the composed roll
 * @param {boolean} [ctx.reveal]  `holdReveal` — gates the margin, never the arithmetic
 * @param {object[]} [ctx.sources]
 * @returns {{headerLines: string[], rows: object[], quotes: object[], earliestDeadline: ?number,
 *   clockWindow: ?number, stillFailing: boolean, verdictKnown: boolean}}
 */
export function rescueView(read, { composed = null, reveal = false,
  sources = RESCUE_SOURCES } = {}) {
  const headerLines = [];
  const premises = [];
  const rows = [];
  let earliestDeadline = null;
  let clockWindow = null;
  for ( const source of sources ) {
    const flag = read(source.flag);
    if ( !flag ) continue;
    premises.push(source.premise(flag));
    // Deduped by string: both premises describe the same roll.
    for ( const line of rescueHeaderLines(premises.at(-1), composed, { reveal }) ) {
      if ( !headerLines.includes(line) ) headerLines.push(line);
    }
    for ( const row of source.rows(flag) ) {
      rows.push({
        ...row,
        flag: source.flag,
        key: `${source.flag}:${(row.kind === "tactical") ? row.action : row.kind}`,   // one key per ROW where a kind can stand twice
        icon: RESCUE_KINDS[row.kind]?.icon ?? "fa-solid fa-dice-d20",
        img: row.img ?? null,
        cost: row.cost ?? RESCUE_KINDS[row.kind]?.cost ?? null,
        rule: row.rule ?? RESCUE_KINDS[row.kind]?.rule ?? null,
        result: row.result ?? null,
        replaced: row.replaced === true,
        // WITHDRAWN: a sibling spend already made this row moot. It greys like a spent row
        // rather than vanishing. No source produces it yet.
        withdrawn: row.withdrawn === true
      });
    }
    // The earliest PENDING clock wins; a resolved source may still carry a deadline.
    if ( source.isPending(flag) && Number.isFinite(flag.deadline) ) {
      if ( (earliestDeadline === null) || (flag.deadline < earliestDeadline) ) {
        earliestDeadline = flag.deadline;
        // ⚠ The window travels with its own deadline; mixing sources draws a lying drain.
        clockWindow = Number(flag.window) || null;
      }
    }
  }
  // One quote per row; the pane shows the hovered one. The die and the cost live in the pane,
  // beside the rule — a live button carries only the feature's name.
  const quotes = rows
    .map(r => ({
      key: r.key,
      label: r.label,
      text: r.rule ?? RESCUE_KINDS[r.kind]?.rule ?? null,
      detail: (r.spent || r.withdrawn) ? ""
        : `${((r.kind === "heroic") || (r.kind === "seeking")) ? "Rerolls the d20"
          : (r.kind === "advantage") ? "Roll another d20 for Advantage, the higher stands"
          : (r.kind === "succeed") ? "The save succeeds instead — no roll" : `Adds ${r.die ?? "a die"}`}`
          + (r.cost ? ` — ${r.cost}.` : ".")
    }))
    .filter(q => q.text);
  // Is the premise still alive (so the window can say "not enough yet")? A raw check always
  // answers yes — it has no DC — and a human ends it with Pass.
  const total = Number.isFinite(composed?.total) ? Number(composed?.total) : null;
  const stillFailing = premises.some(p => {
    if ( total === null ) return true;
    const targets = (p?.targets ?? []).filter(t => Number.isFinite(t?.ac));
    if ( targets.length ) return targets.every(t => total < t.ac);
    if ( Number.isFinite(p?.dc) ) return total < p.dc;
    return true;
  });
  // Is there a number to be short of at all (an AC on the snapshot, or a DC the ask owns)?
  const verdictKnown = premises.some(p =>
    (p?.targets ?? []).some(t => Number.isFinite(t?.ac)) || Number.isFinite(p?.dc));
  return { headerLines, rows, quotes, earliestDeadline, clockWindow, stillFailing, verdictKnown };
}

/* THE WINDOW'S MARKUP — the pane and the rows, with `data-bf-rescue-*` hooks for ui.js to bind.
 * Rows live in the dialog CONTENT (a DialogV2 footer is a row of equal buttons); Pass is the one
 * footer button. */

/** Attribute-safe: these strings land inside `data-…="…"` and a rules quote is full of both. */
const attr = s => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Text-safe: a name or a line that lands in markup (the same four characters as `attr`). */
export const esc = s => String(s ?? "").replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * THE PANE — one verbatim, labelled rule quote (law 8): the hovered row's, defaulting to the
 * first.
 */
export function rescuePaneHTML(quotes = []) {
  if ( !quotes.length ) return "";
  // ⚠ Every quote stacks in one grid cell, so the box is as tall as the longest and hovering
  // never resizes the window. `visibility`, never `display` — display:none gives no height.
  const panes = quotes.map((q, i) => `
    <div data-bf-rescue-quote="${attr(q.key)}"
         style="grid-area:1 / 1;${i ? "visibility:hidden;" : ""}">
      <strong>${q.label}</strong> <em>“${q.text}”</em>
      ${q.detail ? `<div style="margin-top:0.25rem;opacity:0.75;">${q.detail}</div>` : ""}
    </div>`).join("");
  return `
  <div data-bf-rescue-pane style="display:grid;margin:0.45rem 0 0.15rem;padding:0.35rem 0.5rem;
       border-left:2px solid ${TONE.neutral};background:rgba(0,0,0,0.05);border-radius:3px;
       font-size:var(--font-size-12,12px);line-height:1.45;">${panes}
  </div>`;
}

/**
 * THE ROWS — one per rescue, led by the document's art, else the kind's glyph (`heroic` is a
 * sheet boolean with no document). A spent or withdrawn row stays, greyed and unbound.
 */
export function rescueRowsHTML(rows = []) {
  return rows.map(row => {
    const art = row.img
      ? `<img src="${row.img}" alt="" aria-hidden="true"
           style="width:20px;height:20px;flex:0 0 auto;border-radius:3px;object-fit:cover;">`
      : `<i class="${attr(row.icon)}" aria-hidden="true"
           style="width:20px;flex:0 0 auto;text-align:center;opacity:0.85;"></i>`;
    // ⚠ A disabled button cannot be hovered, so a finished row carries its outcome on its face.
    const outcome = row.withdrawn ? "no longer needed"
      : row.replaced ? `rerolled — ${row.result}`
        : Number.isFinite(row.result) ? `rolled ${row.result}` : "spent";
    const inert = row.spent || row.withdrawn;
    return `
    <button type="button" data-bf-rescue-row="${attr(row.key)}"
      ${inert ? "disabled" : `data-bf-rescue-action="${attr(row.action)}"
      data-bf-rescue-flag="${attr(row.flag)}"`}
      style="display:flex;gap:0.5rem;align-items:center;justify-content:center;
             width:100%;margin-top:0.35rem;">
      ${art}
      <span>${row.label}${inert ? ` — ${outcome}` : ""}</span>
    </button>`;
  }).join("");
}

/**
 * THE DIE METER (Savage Attacker's hint): a strip from the lowest to the highest total, a tick at
 * the average, the roll pinned on it (orange under the average, green at or above), one line of
 * odds. It sits in the popup's header, never on the offer row.
 * @param {{value: number, min: number, max: number, avg: number, beat: number, gain: number, low: boolean}} m
 */
export function dieMeterHTML({ value, min, max, avg, beat, gain, low }) {
  const span = Math.max(1, max - min);
  const pos = v => Math.min(100, Math.max(0, ((v - min) / span) * 100));
  const tone = low ? "rgb(222,120,40)" : "rgb(70,150,95)";
  return `<div data-bf-die-meter="${low ? "low" : "high"}" style="margin:0.9rem 0 0.2rem;">
      <div style="position:relative;height:18px;border-radius:3px;background:linear-gradient(90deg,rgba(222,120,40,0.25),rgba(0,0,0,0.12) 55%,rgba(70,150,95,0.25));">
        <div style="position:absolute;top:-3px;bottom:-3px;left:calc(${pos(avg)}% - 1px);width:2px;background:rgba(127,127,127,0.9);"></div>
        <div style="position:absolute;top:-13px;left:${pos(avg)}%;transform:translateX(-50%);font-size:var(--font-size-10,10px);letter-spacing:0.06em;text-transform:uppercase;opacity:0.7;">avg</div>
        <div style="position:absolute;top:50%;left:${Math.min(96, Math.max(4, pos(value)))}%;transform:translate(-50%,-50%);min-width:22px;height:22px;padding:0 4px;border-radius:4px;display:grid;place-items:center;font-weight:bold;border:2px solid ${tone};background:var(--color-bg,#fff);color:${tone};">${esc(value)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:var(--font-size-10,10px);opacity:0.7;margin-top:2px;"><span>${esc(min)}</span><span>${Math.round(beat * 100)}% a second roll beats it · +${Number(gain).toFixed(1)} on average</span><span>${esc(max)}</span></div>
    </div>`;
}

/**
 * THE OFFER ROW, TICKED: one row per source — a tick, the name and dice, a fact as the tag (the
 * cost, or why it cannot be taken), "the rule ▸" folded. ⚠ Nothing else on, above or below the
 * row — never a caveat line. One tick at a time (the EDGE unticks the sibling), even on a
 * one-row popup. See RULINGS *Rescuing the hit*.
 * @param {{name: string, rows: {key: string, name: string, dice?: string|null, tag?: string|null,
 *          off?: string|null, rule?: string|null}[]}} view
 */
export function tickRowsHTML({ name, rows }) {
  const items = (rows ?? []).map(r => `
      <label data-bf-tick-row="${attr(r.key)}" style="display:grid;grid-template-columns:auto 1fr auto;gap:0.2rem 0.5rem;align-items:center;
             margin:0.3rem 0;padding:0.35rem 0.5rem;border-radius:4px;background:rgba(0,0,0,0.06);
             border:1px solid var(--color-border-light,rgba(0,0,0,0.2));${r.off ? "opacity:0.5;" : "cursor:pointer;"}">
        <input type="checkbox" name="${attr(name)}" value="${attr(r.key)}" ${r.off ? "disabled" : ""} style="margin:0;">
        <span style="font-weight:bold;">${esc(r.name)}${r.dice ? ` <span style="font-weight:normal;opacity:0.8;">${esc(r.dice)}</span>` : ""}</span>
        <span style="font-size:var(--font-size-10,10px);letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;opacity:0.85;${r.off ? "color:var(--color-level-error,#b44);" : ""}">${esc(r.off ?? r.tag ?? "")}</span>
        ${foldedRuleHTML(r.rule ?? "").replace("grid-column:1 / -1", "grid-column:2 / -1")}
      </label>`).join("");
  return `<div data-bf-ticks="${attr(name)}" style="margin-top:0.4rem;">${items}</div>`;
}
