/**
 * Battle Flow — THE SPINE (ARCHITECTURE.md §5): popups and their cascade, countdown bars, the ACK,
 * moment clocks, and the relay / rescue / demand / resumable / withhold registries.
 * ⚠ Imports NO machine (ARCHITECTURE §7).
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, deadlineIsLive, canAnswerFor,
  queueFlagWrite } from "./core.js";
import { TONE, popupKey, bfCard, momentBarHTML, holdBarHTML, nextCascadeSlot, cascadePosition,
  pileBackToFront, rescuePaneHTML, rescueRowsHTML } from "./decide/present.js";
import { pendingDemands, resolveDemand } from "./decide/demand.js";
import { abilityOf, originIdOf, rollKindOf, subKindOf } from "./decide/card.js";
import { SURFACES } from "./surfaces.js";

/** Popup keys this client has auto-shown, so a re-render never stacks a second one. */
export const shownMoments = new Set();

/** Popups on screen, by popup key. */
export const livePopups = new Map();

const popupSlots = new Map();       // popup key → staircase slot
let cascadeAnchor = null;           // {left, top} the staircase grows from; dies with the pile

/** Render and lifecycle-manage a decision popup; a failed render leaves the card to answer from. */
export async function openManagedPopup(key, message, dialog) {
  const close = dialog.close.bind(dialog);
  dialog.close = async (...args) => {
    livePopups.delete(key);
    popupSlots.delete(key);
    if ( !popupSlots.size ) cascadeAnchor = null;
    try { ui.chat?.updateMessage?.(message); } catch { /* row refreshes next render */ }
    return close(...args);
  };
  // ARCHITECTURE.md §5 law 7: z-order is rank, then causal order.
  const slot = nextCascadeSlot(popupSlots.values());
  popupSlots.set(key, slot);
  livePopups.set(key, dialog);
  const priorFocus = document.activeElement;
  try {
    await dialog.render({ force: true });
    returnTheKeyboard(dialog, priorFocus);
    const { left, top } = dialog.position ?? {};
    if ( Number.isFinite(left) && Number.isFinite(top) ) {
      if ( !cascadeAnchor ) cascadeAnchor = { left, top };
      const want = cascadePosition(cascadeAnchor, slot);
      if ( (want.left !== left) || (want.top !== top) ) dialog.setPosition(want);
    }
    if ( popupSlots.size > 1 ) {
      for ( const k of pileBackToFront(popupSlots) ) {
        const d = livePopups.get(k);
        if ( d?.rendered ) { try { d.bringToFront?.(); } catch { /* fronting is best-effort */ } }
      }
    }
    scheduleBarSync(dialog.element);
    // The row redraws to defer to the popup.
    ui.chat?.updateMessage?.(message);
  } catch(err) {
    livePopups.delete(key);
    popupSlots.delete(key);
    if ( !popupSlots.size ) cascadeAnchor = null;
    console.error(`${TITLE} | Could not open the popup — answer from the card.`, err);
  }
}

/** ⚠ Hand focus back: DialogV2 autofocuses its default (NOTES *A dialog's DEFAULT button takes the keyboard*). */
function returnTheKeyboard(dialog, priorFocus) {
  const active = document.activeElement;
  if ( !active || !dialog.element?.contains?.(active) ) return;
  const back = priorFocus && (priorFocus !== document.body) && priorFocus.isConnected
    && !dialog.element.contains(priorFocus) && (typeof priorFocus.focus === "function");
  if ( back ) priorFocus.focus({ preventScroll: true });
  else active.blur?.();
}

/**
 * ⚠ A plain object on a roll's `dialog.options` is copied twice (`deepClone`, `mergeObject`); both
 * pass a class instance by reference, so a gate that must stay one object wears this class.
 */
export class DialogCarried {
  constructor(data = {}) { Object.assign(this, data); }
}

/**
 * The demand fieldset in the SYSTEM's save dialog, from a DialogCarried `dialog.options.bfSaveDemand`:
 * { cardId, key, owed(card) (false closes it), present(card) → bfCard args, bar(card), failed }.
 */
function drawDemandFieldset(app, element, demand) {
  const card = game.messages.get(demand.cardId);
  if ( !card ) return;
  if ( demand.owed && !demand.owed(card) ) { void app.close(); return; }
  adoptManagedPopup(demand.key, card, app);
  if ( element.querySelector("[data-bf-save-demand]") ) return;
  const host = document.createElement("div");
  host.innerHTML = `<fieldset data-bf-save-demand><legend>${demand.legend ?? "The demand"}</legend>`
    + `${bfCard(demand.present(card))}${holdBarHTML(demand.bar?.(card) ?? null, "to roll")}</fieldset>`;
  const fieldset = host.firstElementChild;
  const configuration = element.querySelector(SURFACES.dialogConfiguration);
  const formulas = element.querySelector('[data-application-part="formulas"]');
  if ( configuration ) configuration.insertAdjacentElement("beforebegin", fieldset);
  else if ( formulas ) formulas.insertAdjacentElement("afterend", fieldset);
  else element.querySelector("form")?.prepend(fieldset);
  scheduleBarSync(element);
}

/**
 * Mark a roll dialog's default button with a persistent style (⚠ `autofocus` is lost to any click).
 * @param {HTMLElement} element
 * @param {string} action         advantage | normal | disadvantage | bf-fails
 */
export function markDefaultButton(element, action) {
  const hue = { advantage: TONE.good, disadvantage: TONE.bad, "bf-fails": TONE.bad }[action] ?? TONE.neutral;
  // ⚠ Outline drawn by hand: a dialog opened by someone else's roll has no focus ring.
  const MARK = {
    background: `color-mix(in srgb, ${hue} 38%, transparent)`,
    borderColor: hue,
    boxShadow: `0 0 0 2px ${hue}, inset 0 0 0 1px ${hue}`,
    outline: `2px solid ${hue}`,
    outlineOffset: "2px",
    fontWeight: "bold",
    textShadow: "0 1px 2px rgba(0,0,0,0.6)"
  };
  for ( const button of element.querySelectorAll(`${SURFACES.dialogButtons} button[data-action]`) ) {
    const isDefault = button.dataset.action === action;
    button.toggleAttribute("autofocus", isDefault);
    button.toggleAttribute("data-bf-default", isDefault);
    for ( const [prop, value] of Object.entries(MARK) ) button.style[prop] = isDefault ? value : "";
    if ( isDefault ) { try { button.focus(); } catch { /* not focusable yet */ } }
  }
}

// Every system roll dialog: mark its default (a gate re-marks after), then paint a demand.
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  try {
    const markOwn = () => {
      if ( element.querySelector("[data-bf-default]") ) return;   // a gate got there first
      const own = element.querySelector(`${SURFACES.dialogButtons} ${SURFACES.dialogDefault}`)?.dataset?.action;
      if ( own ) markDefaultButton(element, own);
    };
    markOwn();
    // ⚠ The buttons part can land a frame after the hook.
    requestAnimationFrame(markOwn);
    const demand = app.options?.bfSaveDemand ?? null;
    if ( demand?.present ) drawDemandFieldset(app, element, demand);
  } catch(err) {
    console.error(`${TITLE} | Demand fieldset failed to draw.`, err);
  }
});

/**
 * Adopt a dialog the platform is already rendering (`openManagedPopup` minus the render); idempotent.
 * @param {string} key
 * @param {ChatMessage} message
 * @param {foundry.applications.api.ApplicationV2} dialog
 */
export function adoptManagedPopup(key, message, dialog) {
  if ( livePopups.get(key) === dialog ) return;
  const close = dialog.close.bind(dialog);
  dialog.close = async (...args) => {
    if ( livePopups.get(key) === dialog ) livePopups.delete(key);
    popupSlots.delete(key);
    if ( !popupSlots.size ) cascadeAnchor = null;
    try { ui.chat?.updateMessage?.(message); } catch { /* row refreshes next render */ }
    return close(...args);
  };
  const slot = nextCascadeSlot(popupSlots.values());
  popupSlots.set(key, slot);
  livePopups.set(key, dialog);
  try {
    const { left, top } = dialog.position ?? {};
    if ( Number.isFinite(left) && Number.isFinite(top) ) {
      if ( !cascadeAnchor ) cascadeAnchor = { left, top };
      const want = cascadePosition(cascadeAnchor, slot);
      if ( (want.left !== left) || (want.top !== top) ) dialog.setPosition(want);
    }
  } catch { /* the platform's own position stands */ }
  try { ui.chat?.updateMessage?.(message); } catch { /* row refreshes next render */ }
}

/** Open a machine popup behind the canAnswerFor gate; null when gated off or already open (fronted). */
export async function openMomentPopup(message, sub, subject, {
  title, icon, width = 440, content, buttons, autoCloseAt = null, gate = true
} = {}) {
  if ( gate && !canAnswerFor(subject) ) return null;
  const key = popupKey(message.id, sub);
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return null; }
  const dialog = new foundry.applications.api.DialogV2({
    window: { title, icon },
    position: { width },
    content, buttons,
    rejectClose: false
  });
  if ( autoCloseAt ) setTimeout(() => {
    if ( livePopups.get(key) === dialog ) void dialog.close();
  }, Math.max(0, autoCloseAt - Date.now()));
  await openManagedPopup(key, message, dialog);
  return dialog;
}

// THE ACK (ARCHITECTURE.md §5 law 3): the card's owner writes it; anyone else latches and relays.

const localAcks = new Set();

export function momentAcknowledged(message, flagKey) {
  return (message.getFlag(MODULE_ID, flagKey)?.acknowledged === true)
    || localAcks.has(`${message.id}|${flagKey}`);
}

export async function acknowledgeMoment(message, flagKey) {
  if ( momentAcknowledged(message, flagKey) ) return;
  if ( message.isOwner ) {
    const flag = foundry.utils.deepClone(message.getFlag(MODULE_ID, flagKey) ?? {});
    flag.acknowledged = true;
    await message.setFlag(MODULE_ID, flagKey, flag);   // the update re-renders every client
    return;
  }
  // ⚠ The ack must TRAVEL, or the elect's card drains to timeout.
  localAcks.add(`${message.id}|${flagKey}`);
  try { ui.chat?.updateMessage?.(message); } catch { /* row refreshes next render */ }
  try {
    await ChatMessage.create({
      whisper: [game.user.id],           // the fold deletes it; this only limits a brief flash
      content: "",
      flags: { [MODULE_ID]: { momentAck: { cardId: message.id, flagKey } } }
    });
  } catch(err) {
    console.warn(`${TITLE} | Could not relay the acknowledgement.`, err);
  }
}

// The ack relay registers below `relays` (its dead zone here). Test seam, published on `init`:
// ⚠ a `ready` hook runs before a suite's ledger arms.
Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { acknowledgeMoment });
});

export function momentButton(label, onClick, style = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, {
    width: "auto", margin: "0.25rem 0.25rem 0 0", padding: "0 0.6rem", ...style
  });
  button.addEventListener("click", () => onClick());
  return button;
}

// The countdown bar: ⚠ no JS ticking — one animation per bar, positioned from the flag's deadline.

/** Snap every bar to its deadline via `currentTime` (⚠ `animation-delay` drifts before render). */
function syncHoldBars(root) {
  const scope = root?.querySelectorAll ? root : document;
  for ( const bar of scope.querySelectorAll("[data-bf-deadline]") ) {
    const deadline = Number(bar.dataset.bfDeadline);
    const seconds = Number(bar.dataset.bfWindow);
    if ( !deadline || !seconds ) continue;
    const duration = seconds * 1000;
    const elapsed = Math.max(0, Math.min(duration, duration - (deadline - Date.now())));
    // ⚠ In JS: a CSS animation does not exist until its element renders; animate() runs at once.
    let animations = bar.getAnimations?.() ?? [];
    if ( !animations.length ) animations = [
      bar.animate([{ width: "100%" }, { width: "0%" }],
        { duration, fill: "forwards", easing: "linear" }),
      bar.animate([
        { backgroundColor: TONE.good },
        { backgroundColor: TONE.pending, offset: 0.55 },
        { backgroundColor: TONE.bad }
      ], { duration, fill: "forwards", easing: "linear" })
    ];
    for ( const animation of animations ) {
      try { animation.currentTime = elapsed; } catch { /* the next pass gets it */ }
    }
  }
}

/** Sync now and twice more: the first pass can precede the render. */
export function scheduleBarSync(root) {
  syncHoldBars(root);
  requestAnimationFrame(() => syncHoldBars(root));
  setTimeout(() => syncHoldBars(root), 400);
}

/** THE MOMENT CLOCKS: one timer per id on an absolute deadline; re-arming is a no-op. */
export function armDeadline(timers, id, deadline, fire) {
  if ( !deadline || timers.has(id) ) return;
  // ⚠ A deadline past the staleness roof (core.js) would fire at once, and some buzzers roll dice.
  if ( !deadlineIsLive(deadline) ) return;
  timers.set(id, setTimeout(() => {
    timers.delete(id);
    void fire(id);
  }, Math.max(0, deadline - Date.now())));
}

export function disarmDeadline(timers, id) {
  const handle = timers.get(id);
  if ( handle === undefined ) return;
  clearTimeout(handle);
  timers.delete(id);
}

/** The elect-owned single-answer clock; expiry re-checks the live flag. */
export function armAskTimer(timers, message, flagKey, expire) {
  const flag = message?.getFlag(MODULE_ID, flagKey);
  if ( !flag?.deadline || (flag.status !== "pending") || flag.answer || !isActiveGM() ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    const cur = live?.getFlag(MODULE_ID, flagKey);
    if ( !cur || (cur.status !== "pending") || cur.answer ) return;
    await expire(live);
  });
}

export function disarmAskTimer(timers, messageId) {
  disarmDeadline(timers, messageId);
}

/** Wait out Dice So Nice, then the dramatic beat, before a table-facing verdict acts. */
export async function dramaticVerdictPause(rollMessage) {
  // ⚠ CAPPED: a DSN promise may never resolve.
  const wait = Math.max(0, Number(setting(S.diceWait)) || 0) * 1000;
  try {
    const dice = wait ? game.dice3d?.waitFor3DAnimationByMessageID?.(rollMessage.id) : null;
    if ( dice ) await Promise.race([dice, new Promise(r => setTimeout(r, wait))]);
  }
  catch { /* dice are cosmetic */ }
  const beat = (Math.max(0, Number(setting(S.dramaticBeat)) || 0)) * 1000;
  if ( beat ) await new Promise(r => setTimeout(r, beat));
}

// ⚠ Card-row order is hook registration order: this bar draws first (check-hook-order.mjs).
// Every client shows a live `damageOffer`'s bar (a flag this file does not own).
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const offer = message.getFlag(MODULE_ID, "damageOffer");
  if ( (offer?.status === "pending") && (offer.deadline > Date.now()) ) {
    const row = document.createElement("div");
    row.className = "battleflow-damage-offer";
    row.style.margin = "0.4rem 0 0";
    row.innerHTML = bfCard({
      eyebrow: "Damage", tone: "pending",
      title: "Waiting on the dice",
      subtitle: `${message.getAssociatedActor()?.name ?? "The roller"} has the damage roll`
    }) + momentBarHTML(offer, "to roll");
    html.querySelector(SURFACES.messageContent)?.appendChild(row);
    scheduleBarSync(row);
  }
});

// THE CARD ROWS SEAM (NOTES §2): a chained roll draws as a SUMMARY in its usage card; `cardRow`
// draws on whichever host shows. ⚠ A FLAG write does not re-render the origin — nudged below.

const summaryRows = [];

/** The platform's predicate (ChatMessage5e#renderHTML). */
const rendersAsSummary = message => !!message?.system?.summaryTemplate
  && !!message.system.origin?.system?.rendersSummaries
  && game.settings.get("dnd5e", "chatCardSummary") === true;

/** Wrap a row drawer `(message, host, root)`; a summarized roll's hidden copy is skipped. */
export function cardRow(draw) {
  summaryRows.push(draw);
  return (message, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if ( !root || root.hidden ) return;
    draw(message, root.querySelector(SURFACES.messageContent) ?? root, root);
  };
}

Hooks.on("dnd5e.renderChatMessage", (_message, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if ( !root ) return;
  for ( const el of root.querySelectorAll(SURFACES.cardSummary) ) {
    const summarized = game.messages.get(el.dataset.messageId);
    if ( !summarized ) continue;
    for ( const draw of summaryRows ) {
      try { draw(summarized, el, el); }
      catch(err) { console.error(`${TITLE} | A summary row failed to render.`, err); }
    }
  }
});

// The nudge.
Hooks.on("updateChatMessage", (message, changed) => {
  if ( !changed?.flags?.[MODULE_ID] || !rendersAsSummary(message) ) return;
  ui.chat?.updateMessage(message.system.origin);
});

// THE RELAY (ARCHITECTURE.md §4.1): an answer travels as its own message carrying an ENVELOPE;
// the owning client folds it in. ⚠ An envelope's shape is wire format — answers in flight break.

/** envelope flag key → { flagKey, targetOf, owns, fold, cleanup } */
const relays = new Map();

/**
 * `targetOf(envelope)` → the card id; `owns(flag, target)` → this client folds; `fold(current,
 * envelope, message)` mutates inside the serializer, `false` skips the write.
 */
export function registerRelay(envelopeKey, { flagKey, targetOf, owns, fold, cleanup = false }) {
  relays.set(envelopeKey, { flagKey, targetOf, owns, fold, cleanup });
}

// ⚠ The folds repeat every guard INSIDE the serializer: two answers can land in one tick.
Hooks.on("createChatMessage", message => {
  for ( const [envelopeKey, relay] of relays ) {
    const envelope = message.getFlag(MODULE_ID, envelopeKey);
    if ( !envelope ) continue;
    const target = game.messages.get(relay.targetOf(envelope));
    const flagKey = (typeof relay.flagKey === "function") ? relay.flagKey(envelope) : relay.flagKey;
    const flag = target?.getFlag(MODULE_ID, flagKey);
    if ( !flag || !relay.owns(flag, target) ) continue;
    const written = queueFlagWrite(target, flagKey, current => relay.fold(current, envelope, message));
    if ( relay.cleanup ) {
      void Promise.resolve(written)
        .then(() => message.delete())
        .catch(() => { /* another client's fold got there first */ });
    }
  }
});

registerRelay("momentAck", {
  flagKey: envelope => envelope.flagKey,
  targetOf: envelope => envelope.cardId,
  owns: (_flag, target) => !!target?.isOwner,
  cleanup: true,
  fold: current => {
    if ( current.acknowledged ) return false;
    current.acknowledged = true;
  }
});

// THE RESCUE REGISTRY: several sources ask one roll "what do you burn?"; ONE window concatenates
// their slices and routes each press back to its source.

/** flag key → { isPending, subject, view, answer } */
const rescues = new Map();

/** `subject` feeds canAnswerFor; `answer(message, action)` takes back the token its row carried. */
export function registerRescue(flagKey, { isPending, subject, view, answer }) {
  rescues.set(flagKey, { isPending, subject, view, answer });
}

/** Every source's slice as one window's model; headers dedupe by string. */
function mergedRescueView(message) {
  const headerLines = [];
  const rows = [];
  const quotes = [];
  let earliestDeadline = null;
  let clockWindow = null;
  let pending = false;
  let subject = null;
  let stillFailing = false;
  let verdictKnown = false;
  for ( const rescue of rescues.values() ) {
    const slice = rescue.view(message);
    if ( !slice ) continue;
    if ( slice.stillFailing ) stillFailing = true;
    if ( slice.verdictKnown ) verdictKnown = true;
    if ( rescue.isPending(message) ) {
      pending = true;
      subject = subject ?? rescue.subject(message);
    }
    for ( const line of slice.headerLines ?? [] ) {
      if ( !headerLines.includes(line) ) headerLines.push(line);
    }
    rows.push(...(slice.rows ?? []));
    quotes.push(...(slice.quotes ?? []));
    // ⚠ The earliest clock wins and its own window travels with it: a bar is a function of both.
    if ( Number.isFinite(slice.earliestDeadline)
      && ((earliestDeadline === null) || (slice.earliestDeadline < earliestDeadline)) ) {
      earliestDeadline = slice.earliestDeadline;
      clockWindow = slice.clockWindow ?? null;
    }
  }
  // Say when a spend did not get there — ⚠ only where there is a DC; a raw check has no verdict.
  const spent = rows.filter(r => r.spent).map(r => r.label);
  if ( spent.length && stillFailing && verdictKnown ) {
    headerLines.push(`<strong>${spent.join(" + ")}</strong> — not enough yet.`);
  }
  return { headerLines, rows, quotes, earliestDeadline, clockWindow, pending, subject,
    verdictKnown };
}

async function answerRescue(message, flagKey, action) {
  const rescue = rescues.get(flagKey);
  if ( !rescue ) return;
  try { await rescue.answer(message, action); }
  catch(err) { console.error(`${TITLE} | The rescue "${flagKey}" could not be answered.`, err); }
}

/** ⚠ One Pass answers EVERY pending source, or the other's clock and offer live on. */
async function passEveryRescue(message) {
  for ( const [flagKey, rescue] of rescues ) {
    if ( !rescue.isPending(message) ) continue;
    await answerRescue(message, flagKey, "pass");
  }
}

function wireRescueWindow(root, message) {
  if ( !root?.querySelectorAll ) return;
  // Quotes stack in one grid cell and flip visibility, so the pane never resizes.
  const quotes = [...root.querySelectorAll("[data-bf-rescue-quote]")];
  for ( const row of root.querySelectorAll("[data-bf-rescue-row]") ) {
    const key = row.dataset.bfRescueRow;
    const swap = () => {
      if ( !quotes.some(q => q.dataset.bfRescueQuote === key) ) return;   // no rule for this row
      for ( const q of quotes ) {
        q.style.visibility = (q.dataset.bfRescueQuote === key) ? "visible" : "hidden";
      }
    };
    row.addEventListener("mouseenter", swap);
    row.addEventListener("focus", swap);
    // A greyed (spent) row carries no action.
    const action = row.dataset.bfRescueAction;
    const flagKey = row.dataset.bfRescueFlag;
    if ( !action || !flagKey ) continue;
    row.addEventListener("click", () => void answerRescue(message, flagKey, action));
    row.addEventListener("keydown", ev => {
      if ( (ev.key !== "Enter") && (ev.key !== " ") ) return;
      ev.preventDefault();
      void answerRescue(message, flagKey, action);
    });
  }
}

/** popup key → last drawn content. ⚠ A redraw is close-and-reopen, so unchanged must be a no-op. */
const rescueContent = new Map();

/** Draw, redraw or close the one rescue window this message owns. */
async function drawRescueWindow(message, { recall = false } = {}) {
  const key = popupKey(message.id, "rescue");
  const view = mergedRescueView(message);
  const open = livePopups.get(key);

  if ( !view.pending || !view.rows.length ) {
    rescueContent.delete(key);
    if ( open ) {
      livePopups.delete(key);
      shownMoments.delete(key);
      try { await open.close(); } catch { /* a closed dialog is the state we wanted */ }
    }
    return;
  }

  const content = bfCard({
    img: view.subject?.img ?? null,
    eyebrow: "Rescue the roll", tone: "pending",
    title: view.verdictKnown ? "This roll is short — what do you burn?" : "What do you burn?",
    subtitle: view.subject?.name ?? "",
    lines: view.headerLines
  })
    + rescuePaneHTML(view.quotes)
    + rescueRowsHTML(view.rows)
    + momentBarHTML({ deadline: view.earliestDeadline, window: view.clockWindow }, "to answer");

  if ( open && (rescueContent.get(key) === content) ) return;
  // ⚠ A plain re-render must not reopen a window the player closed; a CHANGE must.
  if ( !open && !recall && shownMoments.has(key) && (rescueContent.get(key) === content) ) return;

  if ( open ) {
    livePopups.delete(key);
    shownMoments.delete(key);
    try { await open.close(); } catch { /* a closed dialog is the state we wanted */ }
  }
  rescueContent.set(key, content);
  shownMoments.add(key);
  const dialog = await openMomentPopup(message, "rescue", view.subject, {
    title: `Rescue the roll — ${view.subject?.name ?? ""}`,
    icon: "fa-solid fa-life-ring",
    content,
    buttons: [
      { action: "pass", label: "Pass", default: true, callback: () => passEveryRescue(message) }
    ]
  });
  if ( dialog?.element ) wireRescueWindow(dialog.element, message);
}

/**
 * ⚠ Draws are SERIALISED per message: a second draw mid close-and-reopen would orphan a window.
 * `.then(run, run)` so one failure cannot strand the queue.
 */
const rescueDrawChain = new Map();
function queueRescueDraw(message, opts) {
  const run = () => drawRescueWindow(message, opts);
  const prior = rescueDrawChain.get(message.id) ?? Promise.resolve();
  const next = prior.then(run, run);
  const tail = next.catch(err =>
    console.error(`${TITLE} | The rescue window could not be drawn.`, err));
  rescueDrawChain.set(message.id, tail);
  void tail.then(() => {
    if ( rescueDrawChain.get(message.id) === tail ) rescueDrawChain.delete(message.id);
  });
}

/** ⚠ Sources stamp one roll milliseconds apart: wait a tick and draw once. A recall wins the tick. */
const rescueDraws = new Map();
export function syncRescuePopup(message, { recall = false } = {}) {
  if ( !(message instanceof ChatMessage) ) return;
  if ( rescueDraws.has(message.id) ) {
    if ( recall ) rescueDraws.set(message.id, true);
    return;
  }
  rescueDraws.set(message.id, recall);
  setTimeout(() => {
    const asked = rescueDraws.get(message.id) === true;
    rescueDraws.delete(message.id);
    queueRescueDraw(message, { recall: asked });
  }, 0);
}

// THE ONE DELETE-SWEEP, off the uniform `${messageId}|` key prefix.
Hooks.on("deleteChatMessage", message => {
  for ( const [key, dialog] of [...livePopups] ) {
    if ( !key.startsWith(`${message.id}|`) ) continue;
    livePopups.delete(key);
    void dialog.close();
  }
  const prefix = `${message.id}|`;
  for ( const key of [...shownMoments] ) if ( key.startsWith(prefix) ) shownMoments.delete(key);
  for ( const key of [...localAcks] ) if ( key.startsWith(prefix) ) localAcks.delete(key);
  for ( const key of [...rescueContent.keys()] ) {
    if ( key.startsWith(prefix) ) rescueContent.delete(key);
  }
  // Timers are swept by their owning machines; the spine names no feature.
});

// THE DEMAND REGISTRY: which pending demand a roll answers; the arithmetic is decide/demand.js.
// ⚠ `respondsTo` keeps every meaning (ARCHITECTURE §4).

/** flag key → { flagKey, priority, chained, answering, pendingEntry, pendingFor } */
const demands = new Map();

/**
 * `priority` orders a BARE roll's claim (lower first); `chained`: a roll chained to the card answers
 * it; `answering(flag, facts)` the entry a `respondsTo` roll answers (null: never stamped);
 * `pendingEntry(flag, facts)` / `pendingFor(flag, actorUuid)` the undone entry.
 */
export function registerDemand(flagKey, { priority, chained = true, answering = null, pendingEntry, pendingFor }) {
  demands.set(flagKey, { flagKey, priority, chained, answering, pendingEntry, pendingFor });
}

/** The log as plain cards carrying only the registered flags, oldest first. */
function demandCards() {
  const keys = [...demands.keys()];
  const out = [];
  for ( const m of game.messages.contents ) {
    let flags = null;
    for ( const k of keys ) {
      const f = m.getFlag(MODULE_ID, k);
      if ( !f ) continue;
      flags ??= {};
      flags[k] = f;
    }
    if ( flags ) out.push({ id: m.id, timestamp: m.timestamp ?? 0, flags });
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

const withCards = matches => matches.map(x => ({ ...x, card: game.messages.get(x.cardId) })).filter(x => x.card);

/** Which demand this roll answers — `{ flagKey, matches: [{ card, entry }] }` or null. */
export function demandAnsweredBy(rollMessage) {
  const facts = {
    respondsTo: rollMessage.getFlag(MODULE_ID, "respondsTo") ?? null,
    saveFor: rollMessage.getFlag(MODULE_ID, "saveFor") ?? null,
    originatingMessage: originIdOf(rollMessage),
    actorUuid: rollMessage.getAssociatedActor?.()?.uuid ?? null,
    ability: abilityOf(rollMessage),
    rollType: rollKindOf(rollMessage),
    saveKind: subKindOf(rollMessage)
  };
  const found = resolveDemand(facts, demandCards(), [...demands.values()]);
  return found ? { flagKey: found.flagKey, matches: withCards(found.matches) } : null;
}

/** Every pending demand naming this actor, oldest first — `[{ flagKey, card, entry }]`; `flagKey` narrows to one machine. */
export function pendingDemandsFor(actorUuid, { flagKey = null } = {}) {
  return withCards(pendingDemands(actorUuid, demandCards(), [...demands.values()], { flagKey }));
}

// THE RESUMABLE REGISTRY: `pending(flag, message, cause)` (create | update | render), `drives`
// (this client?), `drive(message)`. ⚠ A drive does no DOM work: these hooks run ahead of every row.

/** flag key → { pending, drives, drive, flagless } */
const resumables = new Map();
/** `${flagKey}|${messageId}` in flight on this client */
const resuming = new Set();

/** `flagless: true` for an arrival with no module flag (an attack's damage roll). */
export function registerResumable(flagKey, { pending, drives, drive, flagless = false }) {
  resumables.set(flagKey, { pending, drives, drive, flagless });
}

function resume(message, cause) {
  for ( const [flagKey, r] of resumables ) {
    let flag;
    try { flag = message.getFlag(MODULE_ID, flagKey) ?? null; } catch { continue; }
    if ( !flag && !r.flagless ) continue;
    const key = `${flagKey}|${message.id}`;
    if ( resuming.has(key) ) continue;
    try {
      if ( !r.pending(flag, message, cause) || !r.drives(flag, message) ) continue;
    } catch(err) {
      console.error(`${TITLE} | The ${flagKey} resume check failed.`, err);
      continue;
    }
    resuming.add(key);
    Promise.resolve()
      .then(() => r.drive(message))
      .catch(err => console.error(`${TITLE} | The ${flagKey} drive failed.`, err))
      .finally(() => resuming.delete(key));
  }
}

Hooks.on("createChatMessage", message => resume(message, "create"));
Hooks.on("updateChatMessage", message => resume(message, "update"));
Hooks.on("dnd5e.renderChatMessage", message => resume(message, "render"));

// THE WITHHOLD REGISTRY: a withholder may pause another machine's verdict with an offer and hands
// it back via `resumeWithheld`. An offer FAILS OPEN.

/** flag key → { offer } */
const withholders = new Map();
/** name → { resume } */
const withheldMachines = new Map();

export function registerWithhold(flagKey, { offer }) {
  withholders.set(flagKey, { offer });
}

export function registerWithheld(name, { resume }) {
  withheldMachines.set(name, { resume });
}

/** True: do not fold yet. */
export async function withholds(rollMessage, ctx) {
  for ( const [flagKey, w] of withholders ) {
    try {
      if ( await w.offer(rollMessage, ctx) ) return true;
    } catch(err) {
      console.error(`${TITLE} | The ${flagKey} withhold offer failed — folding the verdict as it is.`, err);
    }
  }
  return false;
}

/** Without `by`, falls to the one machine registered. */
export async function resumeWithheld(by, ctx, rollMessage) {
  const machine = withheldMachines.get(by) ?? ((withheldMachines.size === 1) ? [...withheldMachines.values()][0] : null);
  if ( !machine ) { console.warn(`${TITLE} | No machine registered to resume a withheld verdict${by ? ` for ${by}` : ""}.`); return; }
  await machine.resume(ctx, rollMessage);
}

/**
 * Paint a dice chip picked or not (`!important` beats themes); `data-picked` is what the answer reads.
 * @param {HTMLElement} chip
 * @param {boolean} on
 */
export function paintDieChip(chip, on) {
  if ( !chip ) return;
  chip.dataset.picked = on ? "1" : "0";
  const set = (prop, value) => value ? chip.style.setProperty(prop, value, "important") : chip.style.removeProperty(prop);
  set("background", on ? "rgba(222,120,40,0.85)" : "");
  set("color", on ? "#fff" : "");
  set("border-color", on ? "rgb(222,120,40)" : "");
  set("box-shadow", on ? "0 0 0 2px rgb(222,120,40)" : "");
  set("outline", "");
  chip.setAttribute("aria-pressed", on ? "true" : "false");
}
