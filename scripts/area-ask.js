/**
 * Battle Flow — SERVICE (ARCHITECTURE §7): the ask at the area. A question about the creatures in
 * a placed area goes to the caster (a popup, a clock that keeps the default); the answer fills the
 * save demand. Customers: metamagic (RULINGS *Metamagic*) and chosen areas (RULINGS *Spells that
 * choose their targets*) raise it via `newAsk`/`raiseAsk`, and may add an ANSWER PART
 * (`registerAskAnswerPart`). ⚠ The flag KEY stays `metamagicAsk`: stored on cards, read by the moment registry.
 */
import { MODULE_ID, TITLE, S, setting, statContext, queueFlagWrite, canAnswerFor } from "./core.js";
import { resolveUuid } from "./lookup.js";
import { isPartyMember } from "./shared.js";
import { tokenForUuid } from "./geometry.js";
import { bfCard, esc, holdBarHTML, popupKey, ruleLine } from "./decide/present.js";
import { AREA_ASK_FLAG, AREA_CHOICE_FLAG, askDefaults, askMark, askOutcome, askTicks, askWords } from "./decide/area-ask.js";
import { saveTargetEntry } from "./decide/demand.js";
import { activityUuidOf } from "./decide/card.js";
import { openMomentPopup, momentButton, armAskTimer, disarmAskTimer, livePopups, scheduleBarSync } from "./ui.js";
import { releaseHold } from "./holds.js";
import { SURFACES } from "./surfaces.js";

// Raising an ask: what the customers call.

/** The token document behind a demand row — its own id, the snapshot's token uuid, or the actor's token on the canvas. */
function tokenDocOf(c) {
  if ( c?.tokenId ) return canvas?.tokens?.get(c.tokenId)?.document ?? null;
  const viaUuid = c?.token ? resolveUuid(c.token) : null;
  if ( viaUuid instanceof TokenDocument ) return viaUuid;
  return tokenForUuid(c?.uuid)?.document ?? null;
}

/** The ask's rows, disposition and token filled from the canvas (a targeted cast's snapshot has neither). */
export function askCandidates(contained) {
  return (contained ?? []).map(c => {
    const tok = tokenDocOf(c);
    return { uuid: c.uuid, name: c.name, disposition: c.disposition ?? tok?.disposition ?? null, tokenId: c.tokenId ?? tok?.id ?? null, party: isPartyMember(c.uuid) };
  });
}

/**
 * A pending ask's flag, the one shape every raiser writes (a Hold Timer of 0 means clockless).
 * @param {{kind: string, feature: string, spell?: string|null, cap?: number|null, rule?: string|null, itemImg?: string|null,
 *          heightened?: {feature: string, rule?: string|null}|null, candidates: object[],
 *          caster: {uuid: string|null, disposition: number|null, name?: string|null}}} args
 */
export function newAsk({ kind, feature, spell = null, cap = null, rule = null, itemImg = null, heightened = null, candidates, caster }) {
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  return {
    status: "pending", kind, feature, ...(spell ? { spell } : {}), cap, rule: rule ?? null, ...(itemImg ? { itemImg } : {}), ...(heightened ? { heightened } : {}),
    candidates,
    casterUuid: caster?.uuid ?? null, casterDisposition: caster?.disposition ?? null, casterName: caster?.name ?? null,
    ...statContext(caster?.uuid ?? null),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  };
}

/** Write a pending ask on a card the caller may update. */
export async function raiseAsk(card, ask) {
  await card.setFlag(MODULE_ID, AREA_ASK_FLAG, ask);
}

/** The answer parts the customers registered — each may add flags, or take the answer over. */
const answerParts = [];
/**
 * @param {(message: ChatMessage, ask: object, outcome: object) => Promise<{handled?: boolean, flags?: object}|null>} part
 */
export function registerAskAnswerPart(part) { answerParts.push(part); }

// The card's line, the popup, the tick.

const askTimers = new Map();

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const ask = message.getFlag(MODULE_ID, AREA_ASK_FLAG);
    if ( !ask ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-metamagic-ask") ) return;
    if ( ask.status !== "pending" ) return;
    const words = askWords(ask);
    const div = document.createElement("div");
    div.className = "bf-metamagic-ask";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="${words.icon}" data-tooltip="${esc(words.iconTip)}"></i> ${esc(ask.feature)} — ${words.question} ${holdBarHTML(ask, "to answer")}`;
    const caster = resolveUuid(ask.casterUuid);
    if ( caster && canAnswerFor(caster) ) div.appendChild(momentButton("Answer", () => { void showAreaAsk(message); }));
    scheduleBarSync(div);
    content.appendChild(div);
    armAskTimer(askTimers, message, AREA_ASK_FLAG, live => answerAsk(live, null, { timedOut: true }));
    if ( caster && canAnswerFor(caster) ) void showAreaAsk(message);
  } catch(err) { console.warn(`${TITLE} | The ask at the area could not render.`, err); }
});

/** The ask's popup, defaults ticked: ticks for Careful and a chosen area, a radio for Heightened
 * (beside each row when a chosen area carries Heightened: one popup, not two). */
export async function showAreaAsk(message) {
  const ask = message.getFlag(MODULE_ID, AREA_ASK_FLAG);
  if ( !ask || (ask.status !== "pending") ) return;
  const caster = resolveUuid(ask.casterUuid);
  if ( !caster ) return;
  const defaults = new Set(askDefaults(ask).map(c => c.uuid));
  const ticks = askTicks(ask);
  const merged = (ask.kind === "choose") && !!ask.heightened;
  const markDefault = merged ? (askMark(ask, [...defaults])?.uuid ?? null) : null;
  const markOf = c => merged ? `<label style="display:flex;align-items:center;gap:0.25rem;margin-left:auto;font-size:var(--font-size-11,11px);opacity:0.85;cursor:pointer;">
      <input type="radio" name="bf-metamagic-ask-mark" value="${esc(c.uuid)}" data-mark-for="${esc(c.uuid)}" ${c.uuid === markDefault ? "checked" : ""} ${defaults.has(c.uuid) ? "" : "disabled"} style="margin:0;"> Disadvantage</label>` : "";
  const side = c => (c.disposition === ask.casterDisposition) ? "" : (c.disposition === 0 ? " <span style='opacity:0.7'>(neutral)</span>" : " <span style='opacity:0.7'>(hostile)</span>");
  const rowOf = c => `<div style="display:flex;align-items:center;gap:0.4rem;margin:0.2rem 0;"><label style="display:flex;align-items:center;gap:0.4rem;cursor:pointer;">
      <input type="${ticks ? "checkbox" : "radio"}" name="bf-metamagic-ask" value="${esc(c.uuid)}" data-name="${esc(c.name)}" data-token="${esc(c.tokenId ?? "")}" ${defaults.has(c.uuid) ? "checked" : ""} style="margin:0;"> ${esc(c.name)}${side(c)}</label>${markOf(c)}</div>`;
  const party = ask.candidates.filter(c => c.party), others = ask.candidates.filter(c => !c.party);
  const group = (title, list) => list.length ? `<div data-bf-ask-group="${title}" style="margin:0.3rem 0;"><div style="font-size:var(--font-size-11,11px);letter-spacing:0.08em;text-transform:uppercase;opacity:0.7;margin:0.2rem 0;">${title}</div>${list.map(rowOf).join("")}</div>` : "";
  const words = askWords(ask);
  const img = (ask.kind === "choose") ? (ask.itemImg ?? null) : (caster.items?.find(i => i.name === ask.feature)?.img ?? null);
  await openMomentPopup(message, AREA_ASK_FLAG, caster, {
    title: `${ask.feature} — ${caster.name}`, icon: words.icon, width: 420,
    content: bfCard({ img, eyebrow: words.eyebrow, tone: "pending", title: words.title, subtitle: words.subtitle, lines: [ask.rule ? ruleLine(ask.rule) : ""] })
      + `<div data-bf-metamagic-ask="${esc(ask.kind)}" data-cap="${ask.cap ?? ""}" style="margin:0.4rem 0;">${group("Party", party)}${group("Non-Party", others)}</div>` + holdBarHTML(ask, "to answer"),
    buttons: [
      { action: "ok", label: "OK", default: true, callback: (_event, button) => answerAsk(message,
        [...button.form.querySelectorAll('input[name="bf-metamagic-ask"]:checked')].map(i => i.value),
        { mark: button.form.querySelector('input[name="bf-metamagic-ask-mark"]:checked')?.value ?? null }) }
    ]
  });
}

// A tick pings the creature's token, and the cap holds as ticks are made.
Hooks.once("ready", () => document.addEventListener("change", ev => {
  const any = ev.target?.closest?.('input[name="bf-metamagic-ask"]');
  if ( !any ) return;
  if ( any.checked && any.dataset.token ) {
    const tok = canvas.tokens?.get(any.dataset.token);
    if ( tok ) { try { canvas.ping(tok.center); } catch { /* no canvas to ping */ } }
  }
  if ( any.type !== "checkbox" ) return;
  const holder = any.closest("[data-bf-metamagic-ask]");
  const cap = Number(holder?.dataset?.cap) || 99;
  const on = [...(holder?.querySelectorAll('input[name="bf-metamagic-ask"]:checked') ?? [])];
  if ( on.length > cap ) { any.checked = false; return; }
  for ( const b of holder?.querySelectorAll('input[name="bf-metamagic-ask"]') ?? [] ) if ( !b.checked ) b.disabled = on.length >= cap;
  // The merged ask: the radio follows its row's tick (only an affected creature saves at
  // Disadvantage); a mark lost with its tick moves to the first still ticked.
  const marks = [...(holder?.querySelectorAll('input[name="bf-metamagic-ask-mark"]') ?? [])];
  if ( !marks.length ) return;
  const ticked = new Set(on.map(b => b.value));
  for ( const r of marks ) { r.disabled = !ticked.has(r.dataset.markFor); if ( r.disabled ) r.checked = false; }
  if ( !marks.some(r => r.checked) ) { const first = marks.find(r => !r.disabled); if ( first ) first.checked = true; }
}));

/** The answer (the ticks, or the defaults at the clock): records written, answer parts consulted,
 * the save demand filled and clocked, then `battleflow.areaAskAnswered` for the deferred dice. */
export async function answerAsk(message, picked, { timedOut = false, mark = null } = {}) {
  try {
    const ask = message.getFlag(MODULE_ID, AREA_ASK_FLAG);
    if ( !ask || (ask.status !== "pending") ) return;
    const outcome = askOutcome(ask, picked, { mark, timedOut });
    const rule = (ask.kind === "choose") ? (ask.heightened?.rule ?? "") : (ask.rule ?? "");
    const done = { ...ask, status: "done", answer: outcome.chosen, ...(timedOut ? { timedOut: true } : {}) };
    let extra = {};
    for ( const part of answerParts ) {
      const result = await part(message, ask, { ...outcome, done, rule });
      if ( result?.handled ) return;
      if ( result?.flags ) extra = { ...extra, ...result.flags };
    }
    const areaChoice = outcome.areaChoice ? { ...outcome.areaChoice, ...statContext(ask.casterUuid ?? null) } : null;
    await message.update({ flags: { [MODULE_ID]: {
      ...extra,
      ...(areaChoice ? { [AREA_CHOICE_FLAG]: areaChoice } : {}),
      [AREA_ASK_FLAG]: done
    } } });
    // ⚠ The one write into another machine's record (the saves flag), through the serializer.
    const window = Math.max(0, Number(ask.window) || 0);
    const heightenedRule = ask.heightened?.rule ?? rule;
    await queueFlagWrite(message, "saves", flag => {
      // A closed demand takes no new targets: nothing would ask them, its area never swept.
      if ( (flag.status ?? "pending") !== "pending" ) return false;
      const prev = flag.targets ?? [];
      const fresh = ask.candidates.filter(c => outcome.stays(c.uuid) && !prev.some(t => t.uuid === c.uuid)).map(c => saveTargetEntry(c.uuid, c.name));
      flag.targets = [...prev.filter(t => t.done || outcome.stays(t.uuid)), ...fresh];
      flag.awaitingTemplate = false;
      if ( window ) { flag.window = window; flag.deadline = Date.now() + (window * 1000); }
      if ( outcome.mark ) flag.demand = { ...(flag.demand ?? {}), heightened: { ...outcome.mark, caster: ask.casterName ?? null, rule: heightenedRule } };
      if ( !flag.targets.length ) flag.status = "done";   // everyone spared
    });
    Hooks.callAll("battleflow.areaAskAnswered", message);
  } catch(err) {
    console.error(`${TITLE} | The ask at the area could not be answered — the demand waits; the card's Answer button reopens it.`, err);
  }
}

// An answered ask closes its popup (law 4) and stands its clock down.
Hooks.on("updateChatMessage", message => {
  const ask = message.getFlag(MODULE_ID, AREA_ASK_FLAG);
  if ( !ask || (ask.status === "pending") ) return;
  disarmAskTimer(askTimers, message.id);
  const open = livePopups.get(popupKey(message.id, AREA_ASK_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
  // A chosen area's picture waited on its question: lift the hold on every client (the answer may
  // be the elect's clock). A carrier's ask names no activity; its real card's birth lifts that hold.
  if ( ask.kind === "choose" ) { const uuid = activityUuidOf(message); if ( uuid ) releaseHold(uuid, message); }
});
