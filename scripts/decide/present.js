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

export const TONE = {
  pending: "rgba(214,158,46,0.95)",   // waiting on a human
  good:    "rgba(70,150,95,0.95)",    // the reaction did its job
  bad:     "rgba(180,70,60,0.95)",    // it landed anyway
  neutral: "rgba(120,120,120,0.75)"
};

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
