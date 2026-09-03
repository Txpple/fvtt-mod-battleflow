// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the presentation formatters.
 *
 * Moved out of ui.js (PLAN.md Phase 2, "move, do not rewrite"). §2's own layer table names
 * formatting as DECISION work, and these were already pure — strings in, strings out — sitting
 * in the spine because that is where they were first written. The spine keeps everything that
 * touches a document, a dialog or the DOM.
 *
 * ⚠ Inline styles on purpose. module.json carries no `styles` entry, and adding one needs a
 * Foundry PROCESS restart to take effect, while a script change is live on the next F5 — so a
 * stylesheet would make every future tweak cost a bounce. If this ever grows past a few
 * helpers, add the stylesheet and take the one bounce.
 *
 * ⚠ `momentBarHTML` reads the wall clock, which is an INPUT rather than a Foundry dependency —
 * the tests fake the clock rather than the API. Nothing else here knows what time it is.
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js.
 */

/** The popup identity every machine shares: one decision, one key, one live view. */
export const popupKey = (messageId, uuid) => `${messageId}|${uuid}`;

/* ---------------------------------------------------------------------------------------------
 * The house card. Everything this module says out loud wears it.
 *
 * The module's messages used to be bare italic text — "lets it land — no reaction." — sitting
 * in a log where every native card around them had a portrait, a title and a structure. They
 * read as debug output rather than as part of the game (reported live 2026-08-15, twice).
 * ------------------------------------------------------------------------------------------- */

/**
 * THE PALETTE — one meaning per hue, everywhere the module paints (user ruling 2026-09-02,
 * "normalize the palette"): green is good for you, red is bad for you, orange is waiting on
 * you, yellow is a critical hit, grey is nothing bending. Advantage wears green and
 * Disadvantage red wherever a bend is shown; Normal is grey because colour means the roll
 * bends and Normal is the absence of one. Blue stays out — dnd5e already means healing by it.
 * Foundry's disposition colours and dnd5e's damage maroon are the platform's, untouched.
 * `pending` moved from amber to orange the same day so it no longer matches the crit badge it
 * shares a card with.
 */
export const TONE = {
  pending: "rgba(222,120,40,0.95)",   // waiting on a human — ORANGE
  good:    "rgba(70,150,95,0.95)",    // good for you: it did its job, Advantage, saved, honoured
  bad:     "rgba(180,70,60,0.95)",    // bad for you: it landed anyway, Disadvantage, failed
  neutral: "rgba(120,120,120,0.75)",  // nothing bends
  crit:    "rgba(232,190,50,0.95)"    // a critical hit — YELLOW, dark text
};

/** The tone a roll mode wears: Advantage good, Disadvantage bad, Normal and Listed neutral. */
export const modeTone = mode => (mode === "advantage") ? TONE.good
  : ((mode === "disadvantage") || (mode === "fails")) ? TONE.bad : TONE.neutral;

/**
 * THE MODE TAG — Advantage / Disadvantage / Normal / Listed as one small coloured label, the
 * same wherever a mode is shown (the gate's header line, its boxes, a volley's ray rows).
 * Listed is the outline of the Normal tag: both are "no bend counted", told apart by fill,
 * never by hue — colour is spent on bends alone. `fails` is the save gate's fourth answer (a
 * save the rules fail before the dice): red, because it is bad for the roller.
 * @param {"advantage"|"disadvantage"|"normal"|"listed"|"fails"} mode
 */
export function modeTagHTML(mode) {
  const listed = (mode === "listed");
  const tone = listed ? TONE.neutral : modeTone(mode);
  const text = listed ? "Listed" : (mode === "advantage") ? "Advantage" : (mode === "disadvantage") ? "Disadvantage"
    : (mode === "fails") ? "Fails" : "Normal";
  const fill = listed
    ? `background:transparent;border:1px solid ${tone};color:inherit;opacity:0.85;`
    : `background:${tone};border:1px solid transparent;color:${((mode === "disadvantage") || (mode === "fails")) ? "#fff" : "#111"};`;
  return `<span data-bf-mode="${mode}" style="display:inline-block;font-size:var(--font-size-10,10px);letter-spacing:0.08em;
    text-transform:uppercase;font-weight:bold;padding:0.15rem 0.5rem;border-radius:3px;white-space:nowrap;
    line-height:1.3;vertical-align:middle;${fill}">${text}</span>`;
}

/**
 * One card: an accent spine, a portrait, an eyebrow/title/subtitle stack, and body lines.
 * `lines` are already-safe HTML fragments.
 */
export function bfCard({ img, eyebrow, title, subtitle, lines = [], tone = "neutral" }) {
  const accent = TONE[tone] ?? TONE.neutral;
  // Walk-5 (aa): every card icon says what it is on hover — the eyebrow (or the title) is
  // the name. Tags out, quotes escaped: these strings go into an attribute.
  const tip = String(eyebrow || title || "").replace(/<[^>]*>/g, "").replace(/"/g, "&quot;");
  const portrait = img
    ? `<img src="${img}" alt="${tip}" data-tooltip="${tip}"
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
             text-transform:uppercase;opacity:0.6;line-height:1.4;">${eyebrow}</div>` : ""}
        <div style="font-family:var(--font-h1,inherit);font-size:var(--font-size-15,15px);
             font-weight:bold;line-height:1.2;">${title}</div>
        ${subtitle ? `<div style="font-size:var(--font-size-11,11px);opacity:0.7;
             line-height:1.3;">${subtitle}</div>` : ""}
      </div>
    </div>
    ${body ? `<div style="margin-top:0.35rem;font-size:var(--font-size-12,12px);
         line-height:1.5;">${body}</div>` : ""}
  </div>`;
}

/** Walk-5 (z): the verbatim rule quote as a card line — one shape wherever a popup cites
 * the actual feature text. The words come from the caller (RULE_TEXT / MASTERY_RULES);
 * this is only the dress. */
export const ruleLine = text => `<em>“${text}”</em>`;

/**
 * The situational-bonus row every popup that STANDS IN FOR A ROLL DIALOG carries — the
 * concentration ask, the save ask, the Topple demand and the reminder gate — the native
 * dialog's own control, in the module's popup. `name` is the input's name, so the caller reads
 * it back off the dialog. (One shape, 2026-09-01: it was copied between popups before it was
 * shared; the last two copies left in the review pass, finding 10.)
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
 * THE GATE'S SECTION — the header line, then the boxes (user rulings 2026-09-02: the gate lives
 * in the native Attack Roll dialog; each source is a BOX; "no net block" — one line on top,
 * "2 Modifiers — Net [tag]", says everything the net block said, and the arithmetic sits on
 * that line as its tooltip). A box per source: the fact on the left, its bend as the mode tag
 * on the right, the rule quoted underneath (law 8). A row with no bend (listed, not counted)
 * wears the Listed outline. Strings in, a string out. The dialog wraps this in
 * `reminderFieldsetHTML`; a volley's aim popup draws it bare under each ray.
 *
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
 * The section folded to its header line — a volley's ray rows (user, 2026-09-02: "for the rays,
 * start in collapsed mode"). A native `<details>`: the header line is its summary, the boxes
 * open under it on a click, and the tag on the summary says what the ray rolls without opening.
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
  // Folded to its header line like a volley's ray rows (user, 2026-09-02: "attacks should have
  // the nice collapse like volleys") — the tag says what the roll does; the boxes are a click.
  return `
  <fieldset data-bf-reminder>
    <legend>${attr(legend)}</legend>${reminderDetailsHTML({ head, boxes }, { open })}
  </fieldset>`;
}

/**
 * THE SNEAK ATTACK BOX (user, 2026-09-02 — the prototype's screen 1): one more box under the
 * gate's sources, with a CHECKBOX where the other boxes carry a tag — the roll still needs its
 * mode press, so the choice rides beside it, never as a fourth button. The rule verbatim, and
 * the "read for you" line: what the module judged, what it leaves to the player. Used this
 * turn: the box stays, greyed, with the reason and no checkbox (screen 6).
 * @param {{dice: string, rule: string, read: string[], checked?: boolean, used?: string|null}} view
 */
export function sneakBoxHTML({ dice, rule, read, checked = false, used = null }) {
  // Used this turn: no tick, and the reason on its own full-width line under the title (user,
  // 2026-09-02 — beside the title it squeezed the title into a one-word column).
  const control = used ? "" : `<label style="display:flex;align-items:center;gap:0.4rem;white-space:nowrap;cursor:pointer;">
        <input type="checkbox" name="bf-sneak" ${checked ? "checked" : ""} style="margin:0;"> <span>Sneak Attack</span></label>`;
  return `
      <div data-bf-sneak style="display:grid;grid-template-columns:1fr auto;gap:0.2rem 0.6rem;align-items:center;
                  margin:0.4rem 0;padding:0.45rem 0.6rem;border-radius:4px;${used ? "opacity:0.6;" : ""}
                  background:rgba(0,0,0,0.25);border:1px solid var(--color-border-dark,rgba(0,0,0,0.4));
                  border-left:3px solid ${used ? TONE.neutral : TONE.pending};">
        <div style="font-weight:bold;">Sneak Attack — ${attr(dice)} on a hit, once per turn</div>
        ${control}
        ${used ? `<div style="grid-column:1 / -1;font-size:var(--font-size-11,11px);line-height:1.45;opacity:0.85;">${attr(used)}</div>` : ""}
        ${foldedRuleHTML(rule)}
        <div style="grid-column:1 / -1;font-size:var(--font-size-11,11px);line-height:1.45;opacity:0.8;">Read for you: ${read.map(attr).join(" · ")}</div>
      </div>`;
}

/**
 * A rule quoted under a fold (user, 2026-09-02: "the desc should be collapsed here, to save
 * vertical space") — a native `<details>` closed by default, its summary the one word "the
 * rule". Used by the boxes that carry a long feature text: the Sneak Attack box, a clock rider's
 * row on the offer.
 * @param {string} rule
 */
export function foldedRuleHTML(rule) {
  if ( !rule ) return "";
  return `<details data-bf-rule style="grid-column:1 / -1;font-size:var(--font-size-12,12px);line-height:1.45;opacity:0.85;">
          <summary style="cursor:pointer;list-style:none;opacity:0.75;font-size:var(--font-size-11,11px);">the rule ▸</summary>${ruleLine(rule)}</details>`;
}

/**
 * THE CUNNING STRIKE MENU on the damage offer (the prototype's screen 3): a checkbox per option
 * the sheet grants, its cost as the tag, its rule underneath; unaffordable rows are shown and
 * disabled — the dice say why. The header says the DC and how many may be picked. The button
 * under it names the formula the pick leaves (the EDGE re-labels it on change).
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
        <span style="font-weight:bold;">${attr(r.label)}${r.line ? " <span style=\"opacity:0.6;font-weight:normal;\">— a line on the card</span>" : ""}</span>
        <span style="font-size:var(--font-size-10,10px);letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;opacity:0.85;">${r.cost ? `${r.cost}d forgone` : "no cost"}</span>
        ${r.caveat ? `<span style="grid-column:2 / -1;font-size:var(--font-size-11,11px);line-height:1.4;opacity:0.8;"><em>${attr(r.caveat)}</em></span>` : ""}
        ${foldedRuleHTML(r.rule).replace("grid-column:1 / -1", "grid-column:2 / -1")}
      </label>`).join("");
  return `
    <div data-bf-cunning style="margin-top:0.5rem;">
      <div style="font-weight:bold;font-size:var(--font-size-12,12px);">Cunning Strike</div>
      <div style="font-size:var(--font-size-11,11px);opacity:0.8;line-height:1.45;">Forgo Sneak Attack dice (${attr(dice)}) for an effect${max > 1 ? ` — up to ${max} (Improved Cunning Strike)` : ""}.${dc ? ` Save DC ${dc}.` : ""} The effect lands right after the damage.</div>
      ${items}
    </div>`;
}

/**
 * THE CLOCK RIDERS on the damage offer (user ruling 2026-09-02, revised the same evening:
 * "dreadful strike should have a check box, optional to use, so make like sneak attack"): a
 * checkbox per rider the clock says is due, TICKED by default — the rules make it available and
 * the player may decline (a limited use is theirs to keep). The line names the dice, the type,
 * why it is due and the uses left after; the rule folds under it.
 * @param {{key: string, label: string, formula: string|null, type: string|null, why: string, rule: string,
 *          usesLeft?: number|null, caveat?: string}[]} riders
 */
export function riderMenuHTML(riders) {
  const rows = (riders ?? []).filter(r => r.formula);
  if ( !rows.length ) return "";
  const items = rows.map(r => `
      <label data-bf-rider-row="${attr(r.key)}" style="display:grid;grid-template-columns:auto 1fr auto;gap:0.2rem 0.5rem;align-items:center;
             margin:0.3rem 0;padding:0.35rem 0.5rem;border-radius:4px;background:rgba(0,0,0,0.06);
             border:1px solid var(--color-border-light,rgba(0,0,0,0.2));cursor:pointer;">
        <input type="checkbox" name="bf-rider" value="${attr(r.key)}" checked style="margin:0;">
        <span style="font-weight:bold;">${attr(r.label)} — ${attr(r.formula)}${r.type ? ` ${attr(r.type)}` : ""}</span>
        <span style="font-size:var(--font-size-10,10px);letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;opacity:0.85;">${(r.usesLeft === null) || (r.usesLeft === undefined) ? attr(r.why) : `${Math.max(0, r.usesLeft - 1)} use${(r.usesLeft - 1) === 1 ? "" : "s"} left after`}</span>
        <span style="grid-column:2 / -1;font-size:var(--font-size-11,11px);opacity:0.8;">${attr(r.why)}${r.caveat ? ` — ${attr(r.caveat)}` : ""}</span>
        ${foldedRuleHTML(r.rule).replace("grid-column:1 / -1", "grid-column:2 / -1")}
      </label>`).join("");
  return `
    <div data-bf-riders style="margin-top:0.5rem;">
      <div style="font-weight:bold;font-size:var(--font-size-12,12px);">Riding this hit</div>
      ${items}
    </div>`;
}

/**
 * The three roll-mode buttons — Advantage / Normal / Disadvantage — as DialogV2 button
 * descriptors: one shape for every popup that stands in for a roll dialog. `press(mode)` is
 * the caller's answer; `defaultMode` marks the button Enter triggers — the one DialogV2
 * highlights and focuses. ⚠ There is ALWAYS a default on this platform: with none flagged,
 * DialogV2 makes the FIRST button the default, so "no default" meant "Advantage on Enter"
 * (review finding 19, 2026-09-01). The user's ruling: the highlighted button is the outcome
 * the solver worked out — the concentration ask hints it from actor data the way the native
 * dialog does. (The reminder gate lives inside the native dialog since 2026-09-02 and sets
 * that dialog's own default instead.) Enter is still a press (DESIGN R-A).
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

/* ---------------------------------------------------------------------------------------------
 * The countdown bar (ARCHITECTURE.md §5).
 *
 * ⚠ ZERO JS TICKING. The bar is one CSS animation whose duration is the hold's own window, and
 * a reload resumes it mid-drain with a NEGATIVE animation-delay computed from the deadline
 * stored on the flag — so every client, and every re-render, agrees without anyone counting.
 * A per-second interval per open hold per client is exactly the kind of thing that is fine
 * with one hold on screen and miserable with six. The snap-to-deadline half of that contract
 * is `syncHoldBars` in ui.js, which needs the DOM; only the markup is here.
 * ------------------------------------------------------------------------------------------- */

/**
 * THE BAR (the spine): a pure function of `{deadline, window}` — no status field, no hidden
 * contract. This is the primitive every moment surface draws; the wrapper below adds the
 * status gate for whole flags. Finding (n) is what the hidden contract cost: the save-choice
 * sub-object carries no `status`, both of its call sites passed it to the status-gated
 * wrapper, and the choice bars never rendered anywhere — invisible, and invisible to every
 * flag-level assertion too. The label names the default action the buzzer takes — "answer"
 * for the decisions, "roll" for the demanded saves, whose expiry rolls instead of passing.
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
 * The status-gated wrapper for WHOLE flags (`hold`, `saves`, `mastery`, `precision`, …):
 * a resolved moment renders no bar even while its deadline is still in the future. Pass a
 * sub-object (a choice, a notice) to momentBarHTML directly, gated by its own answer state
 * at the call site — never through here, where the missing status silently eats the bar.
 */
export function holdBarHTML(hold, label = "to answer") {
  if ( hold?.status !== "pending" ) return "";
  return momentBarHTML(hold, label);
}

/* ---------------------------------------------------------------------------------------------
 * THE STAIRCASE (ARCHITECTURE.md §5 law 7, recut by walk-4 finding (s)).
 *
 * The pile is the standard OS staircase — a common top-left anchor (the first popup of an
 * empty pile donates its own rendered position), one title-bar step per slot so every header
 * stays readable, and slots reused as popups close so a newcomer never lands exactly on a
 * survivor (the depth-count hole). The anchor dies with the pile; ui.js owns that lifecycle
 * because it owns the dialogs. What is here is only the arithmetic.
 * ------------------------------------------------------------------------------------------- */

export const CASCADE_STEP = 36;   // ≈ one window header — the full title stays visible

/** The smallest free slot. Reuse over depth-count: a closed popup's slot is free again, and
 * counting live popups instead would land a newcomer exactly on top of a survivor. */
export function nextCascadeSlot(usedSlots) {
  const used = new Set(usedSlots);
  let slot = 0;
  while ( used.has(slot) ) slot += 1;
  return slot;
}

/** Where slot `n` sits, relative to the pile's anchor. Modulo keeps a pathological pile on
 * screen rather than marching it off the bottom-right corner. */
export function cascadePosition(anchor, slot) {
  const step = (slot % 8) * CASCADE_STEP;
  return { left: anchor.left + step, top: anchor.top + step };
}

/**
 * The other popups, DEEPEST FIRST — the re-fronting order that makes Z-ORDER CAUSAL ORDER
 * (user ruling): the FIRST moment's popup stays in FRONT, every later arrival layers BEHIND
 * it, and the player clicks through in the order things happened. A bash exists because the
 * hit landed; the hit answers first. Fronting them deepest-first leaves slot 0 on top and the
 * newcomer at the back of the pile.
 */
export function eldersDeepestFirst(slots, key) {
  return [...slots.entries()].filter(([k]) => k !== key)
    .sort(([, a], [, b]) => b - a)
    .map(([k]) => k);
}

/* ---------------------------------------------------------------------------------------------
 * THE RESCUE VIEW — the row model (the merged window's DECISION half)
 *
 * ⚠ THE PROBLEM THIS ANSWERS. A Battle Master holding a Bardic die who cleanly misses is
 * stamped TWICE on ONE attack — `precision` by maneuvers.js and `d20fold` by d20-folds.js — and
 * gets two popups, two clocks and no cross-talk for what is one question: *this roll is short
 * by N; what do you burn?* The ARITHMETIC half of that concurrence is already solved (the D8
 * ruling: compose, never order — decide/verdict.js). The OFFERS were not, and the chosen shape
 * is **merge the VIEW, keep the flags**: the popup is a view, the flag is the state.
 *
 * ⚠ WHAT LIVES HERE AND WHY IT IS PURE. This is the DECISION half — plain flag objects, the
 * composed roll and the reveal setting in, a row model out. No `game`, no documents, no
 * settings read, no DOM. The spine draws it (§5) and each machine feeds it its own flag (§4.1:
 * machines register, the spine composes, no machine imports another).
 *
 * ⚠ `foldsFrom`-SHAPED ON PURPOSE, and for the reason D8 gave: a `read(flagKey)` reader and a
 * DECLARED source list mean a third rescue is an entry in a list rather than a new parameter to
 * a builder. The own-roll retro-fixer family is much bigger than the three shipped — Pact
 * Talisman, Favored by the Gods, Dark One's Own Luck, Indomitable, Fanatical Focus and kin —
 * and every one of them is meant to arrive as a ROW in this window, not a popup in the pile.
 * ------------------------------------------------------------------------------------------- */

/**
 * THE RESCUE KINDS — label, glyph, cost and the verbatim rule, in one place.
 *
 * ⚠ ONE COPY OF EACH QUOTE. These strings are the RULES, read off this world's own compendium
 * items (2026-08-23 for the three d20 folds; `phbmnvPrecisionA` for precision), and law 8 says
 * the quote IS the rule — so a second copy that drifts is the module telling the table
 * something untrue. d20-folds.js and maneuvers.js read them from here rather than keeping
 * their own.
 *
 * ⚠ `label` IS NOT THE LOOKUP KEY, and the split is deliberate (user 2026-08-23): the settings
 * list finds `bardic` by the effect's name, "Inspired", because that is what the bard's own
 * activity puts on the recipient — but nobody at the table calls the feature that. The key
 * finds it; the label announces it; renaming the effect changes what is FOUND, never what is
 * SAID.
 *
 * ⚠ `cost` is per-kind because the three do NOT agree, and the intuitive reading gets two of
 * three wrong: bardic is expended when rolled, heroic is spent either way, and tactical's own
 * rule hands the use back if the check still fails.
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
  precision: {
    label: "Precision Attack",
    icon: "fa-solid fa-crosshairs",
    cost: "the superiority die is spent either way it lands",
    rule: "When you miss with an attack roll, you can expend one Superiority Die, roll that die, and add it to the attack roll, potentially causing the attack to hit."
  }
};

/**
 * What to CALL an offer or a spend on screen, re-derived rather than trusted.
 *
 * ⚠ THIS FALLBACK IS NOT DEFENSIVE PADDING — it is the §4.1 wire-format rule applied to a flag.
 * A `d20fold` stamped by an earlier build has no `label` on its offers, and a deploy does not
 * rewrite flags already sitting in the chat log. Reading `offer.label` straight printed
 * "undefined — reroll the d20" on a real card in the sandbox, on an offer that was still
 * perfectly answerable. A moment in flight across a deploy must degrade to the right WORDS,
 * not to the string "undefined".
 */
export const rescueLabel = named =>
  named?.label ?? RESCUE_KINDS[named?.kind]?.label ?? named?.name ?? "a fold";

/**
 * WHERE THE ROWS COME FROM — declared, one entry per message flag.
 *
 * ⚠ Each source knows THREE things and nothing else: how to read its own premise (so both
 * sources derive the SAME header through the same pure function), whether it is still asking,
 * and how to turn its offers and its spends into rows. It never names the other source, and it
 * never learns what a popup is.
 *
 * ⚠ `action` IS THE MACHINE'S OWN ANSWER TOKEN, carried on the row rather than reconstructed by
 * whoever draws it: `d20fold` answers by KIND (`answerFold(message, "bardic")`) and `precision`
 * answers with the word `use` (`answerPrecision(message, "use")`). The spine hands the token
 * back to the machine that supplied it, which is what lets ONE window drive TWO machines
 * without either of them knowing the other exists.
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
      // ⚠ AN OFFER ONLY EXISTS WHILE THE FLAG IS ASKING. `answerFold`'s pass path resolves the
      // flag and leaves `offers` populated — it has no reason to clear a list nothing reads —
      // so rendering them unconditionally puts LIVE, PRESSABLE buttons on a moment that is
      // already over. Seen at the table on 2026-08-24: the window timed out, both cards said
      // so, and it went on offering a reroll of a d20 nobody could still spend on.
      ...((flag?.status === "pending") ? (flag?.offers ?? []) : []).map(o => ({
        kind: o.kind,
        action: o.kind,
        label: rescueLabel(o),
        die: o.dieFormula ?? null,
        spent: false
      })),
      // ⚠ Spends read off `spends`, NEVER `offers` — an offer is what they COULD burn, a spend
      // is what they DID, and rendering an offer as spent would grey out a row that is still
      // answerable. `heroic` is the one that REPLACES rather than adds, and it carries its
      // number under `reroll` because a reroll brings its own crit and fumble with it.
      ...(flag?.spends ?? []).map(s => ({
        kind: s.kind,
        action: s.kind,
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
    // ⚠ Precision only ever rides an ATTACK, and it stores the rolled number under its own
    // name. Normalising here is what makes the two headers comparable at all.
    premise: flag => ({
      testKind: "attack",
      baseTotal: flag?.attackTotal,
      targets: flag?.targets ?? [],
      dc: undefined
    }),
    isPending: flag => (flag?.status === "pending"),
    // ⚠ ONE FLAG, ONE ROW, and the flag is its own spend record — precision has no `offers`
    // list to walk because it only ever offers itself. A flag that was PASSED, expired or
    // found gone contributes nothing at all: there is no die to grey out and nothing left to
    // press, and a row for it would be a control that does nothing (law 11's inverse).
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
 * ONE flag's declared source — a machine composes its own slice and nobody else's (§4.1).
 *
 * ⚠ AN UNKNOWN KEY YIELDS AN EMPTY LIST, AND THEREFORE AN EMPTY VIEW — a window with no rows,
 * which the spine reads as "nothing to ask" and simply does not open. That is the silent-death
 * shape this tree has paid for repeatedly (a hook name never dispatched, a consumption target
 * that never remaps, a scale value that collapses to zero), so a mistyped key says so out loud
 * rather than removing a feature quietly.
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
 * THE HEADER — the one sentence both machines must agree on, derived from the composed roll.
 *
 * ⚠ ONE FUNCTION, TWO CALLERS, BY DESIGN. The merged window is fed by both flags and each
 * machine derives the header from its OWN premise; if the two ever disagreed the window would
 * print the same fact twice in two different sentences. Deriving both through here makes them
 * string-identical, which is what lets the view dedupe them without comparing numbers.
 *
 * ⚠ THE MARGIN IS GATED, THE ARITHMETIC IS NOT. `holdReveal` off hides what the roll had to
 * BEAT — the same gate `offerLines` has always applied — but the player is still told what
 * their own roll now totals, because that number is theirs.
 *
 * ⚠ NO VERDICT WITHOUT A DC. A raw ability check has no number to test against anywhere in
 * dnd5e, so this states the arithmetic and stops (presentation law 5, the DC finding). It is
 * the same fact that makes a check's premise unkillable: nothing can decide it succeeded, so
 * the offer stands until a human passes.
 */
export function rescueHeaderLines(premise, composed, { reveal = false } = {}) {
  const base = Number(premise?.baseTotal) || 0;
  const total = Number.isFinite(composed?.total) ? composed.total : base;
  const added = Number(composed?.added) || 0;
  const sum = composed?.replaced ? `${base} → ${total}`
    : added ? `${base} + ${added} = ${total}` : `${total}`;
  /**
   * ⚠ A RAW CHECK HAS NOTHING TO TEST AGAINST, so the window hands it to a human instead of
   * implying a verdict it cannot have (user, 2026-08-24). dnd5e records no DC for an ability
   * check anywhere — the GM holds it in their head — and Tactical Mind is offered on checks and
   * nothing else. Saying "short by N" there would be inventing the DC; saying nothing at all
   * left the player reading a window whose title claimed the roll had missed.
   *
   * ⚠ AND THIS IS OUTSIDE THE REVEAL GATE, deliberately. `holdReveal` hides a number the module
   * KNOWS. Here there is no number to hide, so the sentence is the same either way.
   */
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
 * THE WHOLE VIEW — every rescue source on one message, as one window's worth of model.
 *
 * `read(flagKey)` is the same one-argument reader `foldsFrom` takes, for the same reason: the
 * EDGE supplies the document and the model stays testable with plain objects.
 *
 * ⚠ `@public` IS A SELF-EXPIRING PIN, NOT A DECORATION. Nothing under `scripts/` calls this yet
 * — the two machines still open their own popups, and swapping them onto this model is the NEXT
 * stage of the rescue-view pass, deliberately kept out of this one so the row model could ship
 * unit-tested and behaviour-neutral. knip is right that it has no production caller; the tag
 * says "not yet" rather than "never". **Delete the tag the moment ui.js draws from this** — a
 * `@public` left on a function that now has real callers hides the next dead export.
 *
 * @public
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
    // ⚠ DEDUPED BY STRING, not by which source got there first. Both premises describe the
    // same roll, so both produce the same sentences — printing them twice would be the window
    // telling the table one fact in stereo.
    for ( const line of rescueHeaderLines(premises.at(-1), composed, { reveal }) ) {
      if ( !headerLines.includes(line) ) headerLines.push(line);
    }
    for ( const row of source.rows(flag) ) {
      rows.push({
        ...row,
        flag: source.flag,
        key: `${source.flag}:${row.kind}`,
        icon: RESCUE_KINDS[row.kind]?.icon ?? "fa-solid fa-dice-d20",
        img: row.img ?? null,
        cost: RESCUE_KINDS[row.kind]?.cost ?? null,
        result: row.result ?? null,
        replaced: row.replaced === true,
        // ⚠ THE THIRD ROW STATE, DECLARED HERE AND WRITTEN IN STAGE 4 (user ruling,
        // 2026-08-24). A WITHDRAWN row is one whose premise a sibling spend already killed —
        // "no longer needed", nothing spent. It greys exactly as a spent row does rather than
        // disappearing, because a withdrawal nobody can see reads as a window that ate an
        // option. No source produces it yet; normalising it to a boolean now means the markup
        // and the model agree the day the moot lands, instead of one of them guessing.
        withdrawn: row.withdrawn === true
      });
    }
    // ⚠ THE EARLIEST CLOCK WINS. Two flags, two deadlines, one bar — and the bar must promise
    // the SOONEST thing that can be taken away, never the latest. A resolved source can still
    // be carrying a deadline field, so the PENDING gate is what is checked, not the number.
    if ( source.isPending(flag) && Number.isFinite(flag.deadline) ) {
      if ( (earliestDeadline === null) || (flag.deadline < earliestDeadline) ) {
        earliestDeadline = flag.deadline;
        // ⚠ THE WINDOW TRAVELS WITH THE DEADLINE IT BELONGS TO. The bar is a pure function of
        // BOTH (`momentBarHTML`), and pairing one source's deadline with another's window
        // would draw a drain that lies about how much time is left — the hidden-contract trap
        // finding (n) already paid for once, in a shape that renders instead of vanishing.
        clockWindow = Number(flag.window) || null;
      }
    }
  }
  // ⚠ THE PANE IS ONE QUOTE, NEVER A STACK (law 8). Four features on screen means four rules,
  // and printing all of them turns the window into a rulebook page nobody reads — so the rows
  // each carry their own and the pane shows the hovered one, defaulting to the first.
  // ⚠ THE DIE AND ITS COST LIVE IN THE PANE, NOT ON THE BUTTON (user, 2026-08-24). A button
  // carries the feature's NAME and nothing else — that is what makes a stack of them scan as
  // choices — and the pane has room to say what pressing it rolls and what it costs, right
  // beside the rule those two qualify.
  const quotes = rows
    .map(r => ({
      key: r.key,
      label: r.label,
      text: RESCUE_KINDS[r.kind]?.rule ?? null,
      detail: (r.spent || r.withdrawn) ? ""
        : `${(r.kind === "heroic") ? "Rerolls the d20" : `Adds ${r.die ?? "a die"}`}`
          + (r.cost ? ` — ${r.cost}.` : ".")
    }))
    .filter(q => q.text);
  /**
   * ⚠ IS THE PREMISE STILL ALIVE? The window has to be able to say "that did not get there"
   * after a spend, rather than silently re-rendering with one row greyed and leaving the player
   * to work out why it is still asking (user, 2026-08-24).
   *
   * ⚠ A CHECK ALWAYS ANSWERS YES, and that is the DC finding again: dnd5e records no DC for a
   * raw ability check, so nothing here can know the roll succeeded. The offer keeps standing
   * and a human ends it with Pass.
   */
  const total = Number.isFinite(composed?.total) ? Number(composed?.total) : null;
  const stillFailing = premises.some(p => {
    if ( total === null ) return true;
    const targets = (p?.targets ?? []).filter(t => Number.isFinite(t?.ac));
    if ( targets.length ) return targets.every(t => total < t.ac);
    if ( Number.isFinite(p?.dc) ) return total < p.dc;
    return true;
  });
  /**
   * ⚠ IS THERE A NUMBER TO BE SHORT OF AT ALL? Everything the window says about falling short —
   * its title, and the "not enough yet" line after a spend — is only true where the module owns
   * the number being tested against: an AC on the attack's own snapshot, or a DC the ask owns.
   * On a raw ability check it owns neither, so it says nothing about the outcome and points at
   * the DM instead.
   */
  const verdictKnown = premises.some(p =>
    (p?.targets ?? []).some(t => Number.isFinite(t?.ac)) || Number.isFinite(p?.dc));
  return { headerLines, rows, quotes, earliestDeadline, clockWindow, stillFailing, verdictKnown };
}

/* ---------------------------------------------------------------------------------------------
 * THE WINDOW'S MARKUP — the pane and the rows.
 *
 * ⚠ THE SAME SPLIT THE COUNTDOWN BAR HAS, for the same reason: strings are pure and testable,
 * and the one thing a pure function cannot do — put a listener on a real element — is the
 * spine's half. Everything below hands ui.js `data-bf-rescue-*` hooks and knows nothing about
 * events, dialogs or the DOM.
 *
 * ⚠ ROWS LIVE IN THE DIALOG *CONTENT*, NOT THE FOOTER, and that is the anatomy the user settled
 * (2026-08-24): a DialogV2 footer is a row of equal buttons, which is exactly wrong for a list
 * that has to carry art, a die, a cost and a spent state. **Pass is the one footer button** —
 * the single thing that is not a choice between features.
 * ------------------------------------------------------------------------------------------- */

/** Attribute-safe: these strings land inside `data-…="…"` and a rules quote is full of both. */
const attr = s => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * THE PANE — one verbatim, labelled rule quote (law 8).
 *
 * ⚠ ONE QUOTE, NEVER A STACK. Four rescues on screen means four rules, and a window that
 * printed all of them would be a rulebook page nobody reads — but law 8 still wants the rule
 * VISIBLE rather than a hover away. So the pane always shows exactly one: the hovered row's,
 * defaulting to the first. Every quote ships in the markup as a `data-` payload so the swap is
 * a text assignment on the client rather than a re-render of the dialog.
 */
export function rescuePaneHTML(quotes = []) {
  if ( !quotes.length ) return "";
  /**
   * ⚠ EVERY QUOTE IS IN THE DOM AT ONCE, STACKED IN ONE GRID CELL, and that is what stops the
   * window resizing under the mouse (user, 2026-08-24). Swapping the pane's TEXT reflows it to
   * whatever the hovered rule happens to be as long as, so the dialog grew and shrank as the
   * pointer moved down a list — motion the reader did not ask for, on the one element that is
   * supposed to sit still and be read. Putting all of them in `grid-area: 1 / 1` makes the box
   * exactly as tall as the LONGEST quote, once, and hovering only flips which one is visible.
   * Padding under the short ones is the deliberate price.
   *
   * ⚠ `visibility`, never `display`. A hidden-by-display element is out of flow and contributes
   * no height, which would put the resizing straight back.
   */
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
 * THE ROWS — one per rescue, each led by its own art.
 *
 * ⚠ A SPENT OR WITHDRAWN ROW STAYS ON SCREEN, GREYED (user, 2026-08-24). It is not a control
 * any more — no `data-bf-rescue-action`, so the spine has nothing to bind — but it keeps the
 * record of what was available and what became of it. A row that simply VANISHED would read as
 * a window that ate an option, which is the opposite of what withdrawing it is for.
 *
 * ⚠ `img` FIRST, GLYPH SECOND. Every rescue that has a document leads with that document's own
 * art; `heroic` has no document anywhere in dnd5e — it is a boolean on the sheet — so the kind's
 * glyph carries the row. Law 9: both wear a tooltip naming the feature.
 */
export function rescueRowsHTML(rows = []) {
  return rows.map(row => {
    const art = row.img
      ? `<img src="${row.img}" alt="" aria-hidden="true"
           style="width:20px;height:20px;flex:0 0 auto;border-radius:3px;object-fit:cover;">`
      : `<i class="${attr(row.icon)}" aria-hidden="true"
           style="width:20px;flex:0 0 auto;text-align:center;opacity:0.85;"></i>`;
    // ⚠ A DISABLED BUTTON CANNOT BE HOVERED, so a finished row has to carry its own outcome
    // on its face — the pane will never get the chance to tell it. A LIVE row carries only the
    // feature's name (user, 2026-08-24): the die and what it costs belong in the pane, where
    // there is room for them beside the rule they qualify.
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
