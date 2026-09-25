/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): DROP TO 1 HP — a feature or an effect that turns a
 * drop to 0 Hit Points into a drop to 1 (decide/registry.js DROP_TO_ONE). The Orc walk, 2026-09-25
 * (user: "endurance we want to add here for this slice. if sometihng takes them to zero, then a
 * popup should ask to use the feat. same shape as death ward which you should do now too"):
 *
 *   - Relentless Endurance ASKS ("you can drop to 1 Hit Point instead"): the HP is held at 1 while
 *     the owner answers in a popup; Drop to 1 HP spends the use, Drop to 0 (or the clock) lands the
 *     0. Not offered when the damage kills outright (the remainder ≥ the Hit Point maximum).
 *   - Death Ward is AUTOMATIC ("the target instead drops to 1 Hit Point, and the spell ends" — the
 *     rule leaves no choice, R1): the HP stops at 1, the spell's effect is removed, a card says so.
 *
 * THE SEAM is `dnd5e.preApplyDamage` — synchronous, on whichever client applies, with the actor's
 * update in hand: every application goes through it, the module's applier AND the card's own
 * buttons, so the 1 is written in the same update and the creature never touches 0 (no Unconscious,
 * no death save, no flash). Only an HP typed on a sheet goes around it (RULINGS' register).
 *
 * THE KEEPER of an ask is the client that applied the damage (it could write the HP) — or the GM
 * when that client has gone; an answer from anyone else is relayed to it (the damage-holds shape).
 * ------------------------------------------------------------------------------------------- */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { lower, resolveUuid } from "./lookup.js";
import { dropToOneEntries, listedNames } from "./settings.js";
import { DROP_TO_ONE } from "./decide/registry.js";
import { bfCard, esc, holdBarHTML, popupKey, ruleLine } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, scheduleBarSync, shownMoments,
  armDeadline, disarmDeadline, registerRelay, registerResumable } from "./ui.js";
import { SURFACES } from "./surfaces.js";

const DROP_FLAG = "dropToOne";
const HP = "system.attributes.hp.value";
const timers = new Map();
const answering = new Set();
/** Actors with an ask standing — a second drop while it stands lands as it would. Client-local. */
const asking = new Set();

/** The first listed row this actor holds that can act now — `{ name, row, item?, effect? }` or null. */
function rowFor(actor, { outright }) {
  const on = listedNames(dropToOneEntries());
  for ( const [name, row] of Object.entries(DROP_TO_ONE) ) {
    if ( !on.has(lower(name)) ) continue;
    if ( outright && !row.outright ) continue;
    if ( row.effect ) {
      const effect = actor.effects.find(e => !e.disabled && !e.isSuppressed && (lower(e.name) === lower(row.effect)));
      if ( effect ) return { name, row, effect };
      continue;
    }
    const item = actor.items.find(i => (i.type === "feat") && (lower(i.name) === lower(name)));
    if ( !item ) continue;
    if ( row.uses && !(Number(item.system?.uses?.value ?? 0) > 0) ) continue;
    return { name, row, item };
  }
  return null;
}

Hooks.on("dnd5e.preApplyDamage", (actor, amount, updates, options) => {
  try {
    if ( !(actor instanceof Actor) || !(Number(amount) > 0) || !(HP in (updates ?? {})) ) return;
    const hp = actor.system?.attributes?.hp;
    const before = Number(hp?.value ?? 0);
    if ( !(before > 0) || (Number(updates[HP]) > 0) ) return;
    if ( asking.has(actor.uuid) ) return;
    // Killed outright: the damage left after 0 meets the Hit Point maximum (the rule's own test).
    const tempTaken = Math.max(0, Number(hp.temp ?? 0) - Number(updates["system.attributes.hp.temp"] ?? hp.temp ?? 0));
    const remainder = Number(amount) - tempTaken - before;
    const outright = remainder >= Number(hp.max ?? Infinity);
    const found = rowFor(actor, { outright });
    if ( !found ) return;
    updates[HP] = 1;                                                   // held at 1, in this very update
    const source = options?.originatingMessage?.getAssociatedActor?.() ?? null;
    if ( !found.row.ask ) { void settle(actor, found, { amount, source }); return; }
    asking.add(actor.uuid);
    void stampAsk(actor, found, { amount, source })
      .catch(err => { asking.delete(actor.uuid); console.error(`${TITLE} | ${found.name}'s ask failed — the creature stays at 1 HP; set it by hand.`, err); });
  } catch(err) {
    console.error(`${TITLE} | Drop to 1 HP failed — the damage lands as the system has it.`, err);
  }
});

/** An automatic row (Death Ward): the effect ends, the card says so. */
async function settle(actor, found, { amount, source }) {
  try { if ( found.effect && actor.effects.get(found.effect.id) ) await found.effect.delete(); }
  catch(err) { console.warn(`${TITLE} | ${found.name}'s effect could not be removed — end it by hand.`, err); }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({ img: found.effect?.img ?? null, eyebrow: found.name, tone: "good",
      title: `${actor.name} drops to 1 Hit Point instead`, subtitle: found.row.ends ? "the spell ends" : "",
      lines: [ruleLine(esc(found.row.rule))] }),
    flags: { [MODULE_ID]: { [DROP_FLAG]: { status: "resolved", answer: "auto", row: found.name, actorUuid: actor.uuid,
      actorName: actor.name, amount, applied: true, ...statContext(source?.uuid ?? null) } } }
  });
}

async function stampAsk(actor, found, { amount, source }) {
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  const flag = {
    status: "pending", row: found.name, actorUuid: actor.uuid, actorName: actor.name, itemId: found.item.id,
    amount, sourceName: source?.name ?? null, answer: null, applied: false,
    ...statContext(source?.uuid ?? null),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  };
  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({ img: found.item.img, eyebrow: found.name, tone: "pending",
      title: `${actor.name} drops to 0 Hit Points`, subtitle: "held at 1 until the answer" }),
    flags: { [MODULE_ID]: { [DROP_FLAG]: flag } }
  });
  if ( message ) armTimer(message);
}

/* --- the keeper ------------------------------------------------------------------------------- */

const keeps = message => message.isAuthor || (!message.author?.active && isActiveGM());

function armTimer(message) {
  const flag = message?.getFlag(MODULE_ID, DROP_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !keeps(message) ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( !live ) return;
    await queueFlagWrite(live, DROP_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      Object.assign(current, { status: "resolved", answer: "pass", timedOut: true, answeredAt: Date.now() });
    });
  });
}

/* --- the answer: folded by the keeper, relayed by anyone else ---------------------------------- */

async function answer(message, choice) {
  if ( answering.has(message.id) ) return;
  answering.add(message.id);
  try {
    const flag = message.getFlag(MODULE_ID, DROP_FLAG);
    if ( flag?.status !== "pending" ) return;
    if ( keeps(message) ) {
      await queueFlagWrite(message, DROP_FLAG, current => {
        if ( current.status !== "pending" ) return false;
        Object.assign(current, { status: "resolved", answer: choice, answeredAt: Date.now() });
      });
      return;
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: resolveUuid(flag.actorUuid) }),
      content: bfCard({ eyebrow: flag.row, tone: (choice === "use") ? "good" : "neutral",
        title: (choice === "use") ? `${flag.actorName} drops to 1 Hit Point instead` : `${flag.actorName} drops to 0` }),
      flags: { [MODULE_ID]: { dropToOneAnswer: { messageId: message.id, answer: choice } } }
    });
  } finally {
    answering.delete(message.id);
  }
}

registerRelay("dropToOneAnswer", {
  flagKey: DROP_FLAG,
  targetOf: a => a.messageId,
  owns: (_flag, target) => keeps(target),
  fold: (current, a) => {
    if ( current.status !== "pending" ) return false;
    Object.assign(current, { status: "resolved", answer: a.answer, answeredAt: Date.now() });
  }
});

/** The keeper lands the answer: the use spent, or the 0 the damage would have left. */
async function land(message) {
  let claimed = false;
  await queueFlagWrite(message, DROP_FLAG, current => {
    if ( (current.status !== "resolved") || current.applied || current.applying ) return false;
    current.applying = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = message.getFlag(MODULE_ID, DROP_FLAG);
  const actor = resolveUuid(flag.actorUuid);
  try {
    if ( actor instanceof Actor ) {
      if ( flag.answer === "use" ) {
        const item = actor.items.get(flag.itemId);
        if ( item ) await item.update({ "system.uses.spent": Number(item.system.uses?.spent ?? 0) + 1 });
      } else if ( Number(actor.system.attributes.hp.value) === 1 ) {
        // Only the 1 the ask held: a heal in between is left alone.
        await actor.update({ [HP]: 0 });
      }
    }
  } finally {
    asking.delete(flag.actorUuid);
    await queueFlagWrite(message, DROP_FLAG, current => { current.applied = true; current.applying = false; });
  }
}

registerResumable(DROP_FLAG, {
  pending: flag => (flag?.status === "resolved") && !flag.applied && !flag.applying,
  drives: (_flag, message) => keeps(message),
  drive: land
});

/* --- the popup and the card ------------------------------------------------------------------- */

async function showPopup(message) {
  const flag = message.getFlag(MODULE_ID, DROP_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  const row = DROP_TO_ONE[flag.row];
  const item = actor?.items.get(flag.itemId);
  const left = Number(item?.system?.uses?.value ?? 0), max = Number(item?.system?.uses?.max ?? 0);
  await openMomentPopup(message, DROP_FLAG, actor, {
    title: `${flag.row} — ${flag.actorName}`, icon: "fa-solid fa-heart-pulse",
    content: bfCard({ img: item?.img ?? null, eyebrow: flag.row, tone: "pending",
      title: `${flag.actorName} drops to 0 Hit Points — drop to 1 instead?`,
      subtitle: `${flag.sourceName ? `from ${flag.sourceName} · ` : ""}${max > 0 ? `${left} of ${max} ${(max === 1) ? "use" : "uses"} left` : ""}`,
      lines: [ruleLine(esc(row?.rule ?? ""))] })
      + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "use", label: "Drop to 1 HP", default: true, callback: () => { void answer(message, "use"); } },
      { action: "pass", label: "Drop to 0", callback: () => { void answer(message, "pass"); } }
    ]
  });
}

/** The card's line — source, then result (law 6). */
function askLine(flag) {
  if ( flag.answer === "use" ) return `${flag.row} — ${flag.actorName} drops to 1 Hit Point instead`;
  if ( flag.answer === "pass" ) return `${flag.actorName} drops to 0${flag.timedOut ? " (timer)" : ""}`;
  if ( flag.answer === "auto" ) return "";
  return `${flag.row} — ${flag.actorName} is held at 1 Hit Point; it waits for the answer`;
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, DROP_FLAG);
    if ( !flag || (flag.answer === "auto") ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-drop-to-one-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-drop-to-one-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-heart-pulse" data-tooltip="${esc(flag.row)}"></i> ${esc(askLine(flag))}`;
    if ( flag.status === "pending" ) {
      div.insertAdjacentHTML("beforeend", ` ${holdBarHTML(flag, "to answer")}`);
      const actor = resolveUuid(flag.actorUuid);
      if ( canAnswerFor(actor) ) {
        const shown = popupKey(message.id, DROP_FLAG);
        if ( !shownMoments.has(shown) ) { shownMoments.add(shown); void showPopup(message); }
        div.appendChild(momentButton("Answer", () => { void showPopup(message); }));
      }
      scheduleBarSync(div);
      armTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The drop-to-1 line could not render.`, err); }
});

// An answer anywhere closes the popup everywhere (law 4); the clock stands down with it.
Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, DROP_FLAG);
  if ( !flag ) return;
  if ( flag.status === "pending" ) { armTimer(message); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, DROP_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

Hooks.on("deleteChatMessage", message => { disarmDeadline(timers, message.id); });
