/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE INITIATIVE SWAP — a feature that trades its
 * owner's Initiative with a willing ally's right after Initiative is rolled (decide/registry.js
 * INITIATIVE_SWAPS; Alert the one row). The origin feats, 2026-09-25 — the user: "initiative swap
 * should have a form after initiative all roll, list non incapacitated allies, each persons
 * initiative, and they can select which to swap, and then swap yes no buttons"; "alert pick is
 * enough" (the owner's pick is the ally's willingness — nobody else is asked).
 *
 * THE MOMENT is the last Initiative landing: when every combatant of a combat has one, the elect
 * (the active GM — the tracker is the GM's to write) posts one card per listed owner in that combat,
 * once per combat (the combat's own flag is the latch). An Incapacitated owner is not asked; the
 * allies are the other combatants on the owner's side (the token's disposition) who are not
 * Incapacitated, each with their Initiative; nobody to swap with, no card.
 *
 * THE POPUP opens on whoever answers for the owner (canAnswerFor): a radio per ally, "name — 17",
 * a tick pinging the token; "Swap" (live once an ally is picked) / "No"; the clock (the Hold Timer)
 * answers No. THE WRITE is the tracker, so it is the GM's: a GM answering folds directly; a player's
 * answer is an envelope the elect folds (the relay registry); the elect lands the swap from the two
 * combatants' LIVE numbers. With no GM on, the player is told to swap by hand.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, statContext, drivesMomentFor } from "./core.js";
import { lower, resolveUuid } from "./lookup.js";
import { initiativeSwapEntries, listedNames } from "./settings.js";
import { INITIATIVE_SWAPS } from "./decide/registry.js";
import { bfCard, esc, holdBarHTML, popupKey, foldedRuleHTML } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, shownMoments, scheduleBarSync, armDeadline, disarmDeadline,
  registerRelay, registerResumable } from "./ui.js";
import { SURFACES } from "./surfaces.js";

const SWAP_FLAG = "initiativeSwap";
/** The combat's own latch — which combatants were already asked (once per combat). */
const ASKED_FLAG = "initiativeSwapAsked";
const timers = new Map();
/** Combats this client is posting for right now — the updates of one Roll All land in one tick. */
const posting = new Set();

/** The listed swap row this actor holds — `{ name, row, item }` or null. */
function rowFor(actor) {
  const on = listedNames(initiativeSwapEntries());
  for ( const [name, row] of Object.entries(INITIATIVE_SWAPS) ) {
    if ( !on.has(lower(name)) ) continue;
    const item = actor?.items?.find(i => (i.type === "feat") && (lower(i.name) === lower(name)));
    if ( item ) return { name, row, item };
  }
  return null;
}

/** The rule's own clause: "if you or the ally has the Incapacitated condition" — every condition that implies it included. */
const incapacitated = actor => !!actor?.statuses?.has?.("incapacitated");

/* --- the moment: the last Initiative lands --------------------------------------------------------- */

Hooks.on("updateCombatant", (combatant, changes) => {
  if ( !("initiative" in (changes ?? {})) || !isActiveGM() ) return;
  const combat = combatant.parent;
  if ( combat ) void askFor(combat);
});

async function askFor(combat) {
  if ( posting.has(combat.id) ) return;
  const combatants = [...combat.combatants];
  if ( !combatants.length || combatants.some(c => (c.initiative === null) || (c.initiative === undefined)) ) return;
  posting.add(combat.id);
  try {
    const asked = { ...(combat.getFlag(MODULE_ID, ASKED_FLAG) ?? {}) };
    for ( const c of combatants ) {
      if ( asked[c.id] ) continue;
      const actor = c.actor;
      const found = rowFor(actor);
      if ( !found ) continue;
      asked[c.id] = true;   // once per combat, asked or not
      if ( incapacitated(actor) ) continue;
      const side = c.token?.disposition ?? null;
      const allies = combatants
        .filter(o => (o.id !== c.id) && (o.token?.disposition === side) && o.actor && !incapacitated(o.actor))
        .map(o => ({ combatantId: o.id, name: o.name, initiative: o.initiative, uuid: o.actor.uuid, tokenId: o.tokenId ?? null }))
        .sort((a, b) => b.initiative - a.initiative);
      if ( !allies.length ) continue;
      // THE LINEUP (user, 2026-09-25: the owner "greyed out saying (you) so they can easily see where
      // the init order swaps will play out"; "it should also include enemies, but greyed out"): every
      // combatant the tracker shows, in Initiative order; only the allies above are pickable.
      const pickable = new Set(allies.map(a => a.combatantId));
      const lineup = combatants
        .filter(o => (o.id === c.id) || !o.hidden)
        .sort((a, b) => b.initiative - a.initiative)
        .map(o => ({ combatantId: o.id, name: o.name, initiative: o.initiative, tokenId: o.tokenId ?? null,
          role: (o.id === c.id) ? "self" : pickable.has(o.id) ? "ally"
            : (o.token?.disposition === side) ? "incapacitated" : "enemy" }));
      const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor, token: c.token }),
        content: bfCard({ img: found.item.img, eyebrow: `Feat — ${found.name}`, tone: "pending", title: `${found.name} — swap Initiative?` }),
        flags: { [MODULE_ID]: { [SWAP_FLAG]: {
          status: "pending", row: found.name, actorUuid: actor.uuid, actorName: c.name,
          combatId: combat.id, combatantId: c.id, initiative: c.initiative, allies, lineup, ...statContext(actor.uuid),
          ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
        } } }
      });
    }
    await combat.setFlag(MODULE_ID, ASKED_FLAG, asked);
  } catch(err) {
    console.error(`${TITLE} | The initiative swap could not be asked — swap by hand.`, err);
  } finally {
    posting.delete(combat.id);
  }
}

/* --- the answer: the GM folds it, a player sends it ------------------------------------------------ */

const settle = (current, answer, pick, timedOut = false) => {
  if ( current.status !== "pending" ) return false;
  const ally = (current.allies ?? []).find(a => a.combatantId === pick) ?? null;
  Object.assign(current, { status: "resolved", answer: (answer === "swap" && ally) ? "swap" : "no",
    pick: ally?.combatantId ?? null, answeredAt: Date.now(), ...(timedOut ? { timedOut: true } : {}) });
};

async function answerSwap(message, answer, pick = null, { timedOut = false } = {}) {
  const flag = message.getFlag(MODULE_ID, SWAP_FLAG);
  if ( flag?.status !== "pending" ) return;
  if ( isActiveGM() ) {
    await queueFlagWrite(message, SWAP_FLAG, current => settle(current, answer, pick, timedOut));
    return;
  }
  if ( !game.users.activeGM ) {
    ui.notifications?.warn(`${flag.row}: a GM must be on to swap Initiative — swap it in the tracker by hand.`);
    return;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: resolveUuid(flag.actorUuid) }),
    content: "", whisper: game.users.filter(u => u.isGM).map(u => u.id),
    flags: { [MODULE_ID]: { initiativeSwapAnswer: { messageId: message.id, answer, pick } } }
  });
}

registerRelay("initiativeSwapAnswer", {
  flagKey: SWAP_FLAG,
  targetOf: a => a.messageId,
  owns: () => isActiveGM(),
  cleanup: true,
  fold: (current, a) => settle(current, a.answer, a.pick)
});

/** The elect lands a Swap: the two combatants' LIVE Initiatives exchanged in one tracker write. */
async function landSwap(message) {
  let claimed = false;
  await queueFlagWrite(message, SWAP_FLAG, current => {
    if ( (current.status !== "resolved") || (current.answer !== "swap") || current.applied || current.applying ) return false;
    current.applying = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = message.getFlag(MODULE_ID, SWAP_FLAG);
  const record = {};
  try {
    const combat = game.combats.get(flag.combatId);
    const own = combat?.combatants.get(flag.combatantId);
    const ally = combat?.combatants.get(flag.pick);
    if ( own && ally && (own.initiative !== null) && (ally.initiative !== null) ) {
      record.from = own.initiative;
      record.to = ally.initiative;
      await combat.updateEmbeddedDocuments("Combatant", [
        { _id: own.id, initiative: ally.initiative }, { _id: ally.id, initiative: own.initiative }]);
      record.allyName = ally.name;
    }
  } catch(err) {
    console.error(`${TITLE} | ${flag.row}'s swap failed — swap it in the tracker by hand.`, err);
  } finally {
    await queueFlagWrite(message, SWAP_FLAG, current => { Object.assign(current, record, { applied: true, applying: false }); });
  }
}

registerResumable(SWAP_FLAG, {
  pending: flag => (flag?.status === "resolved") && (flag.answer === "swap") && !flag.applied && !flag.applying,
  drives: () => isActiveGM(),
  drive: landSwap
});

/* --- the clock: No, on whoever drives the owner's moments ------------------------------------------ */

function armTimer(message) {
  const flag = message.getFlag(MODULE_ID, SWAP_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !drivesMomentFor(flag.actorUuid ?? null) ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( live?.getFlag(MODULE_ID, SWAP_FLAG)?.status === "pending" ) await answerSwap(live, "no", null, { timedOut: true });
  });
}

/* --- the popup and the card -------------------------------------------------------------------------- */

async function showSwapPopup(message) {
  const flag = message.getFlag(MODULE_ID, SWAP_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const row = INITIATIVE_SWAPS[flag.row] ?? null;
  // THE LINEUP, the whole tracker in Initiative order (the card's `lineup`, built at the ask): the
  // allies are the radios; the owner "(you)", the enemies and an Incapacitated ally stay, greyed.
  const lineup = flag.lineup ?? (flag.allies ?? []).map(a => ({ ...a, role: "ally" }));
  const NOTE = { self: "(you)", enemy: "(enemy)", incapacitated: "(Incapacitated)" };
  const rowStyle = "display:flex;align-items:center;gap:0.5rem;margin:0.25rem 0;padding:0.35rem 0.5rem;border-radius:4px;background:rgba(0,0,0,0.06);border:1px solid var(--color-border-light,rgba(0,0,0,0.2));";
  const rows = lineup.map(a => (a.role !== "ally")
    ? `<div data-bf-initiative-${esc(a.role)} style="${rowStyle}opacity:0.5;">
      <input type="radio" disabled style="margin:0;">
      <span style="flex:1;">${esc(a.name)} <em>${NOTE[a.role] ?? ""}</em></span><strong style="font-size:1.1em;">${esc(a.initiative)}</strong></div>`
    : `<label style="${rowStyle}cursor:pointer;">
      <input type="radio" name="bf-initiative-swap" value="${esc(a.combatantId)}" data-token="${esc(a.tokenId ?? "")}" style="margin:0;">
      <span style="flex:1;">${esc(a.name)}</span><strong style="font-size:1.1em;">${esc(a.initiative)}</strong></label>`).join("");
  const dialog = await openMomentPopup(message, SWAP_FLAG, actor, {
    title: `${flag.row} — ${flag.actorName}`, icon: "fa-solid fa-right-left", width: 400,
    content: bfCard({ img: actor.items.find(i => lower(i.name) === lower(flag.row))?.img ?? null,
      eyebrow: `Feat — ${flag.row}`, tone: "pending",
      title: `${flag.row} — swap your Initiative (${flag.initiative})?`,
      subtitle: "pick one ally",
      lines: [row?.rule ? foldedRuleHTML(esc(row.rule)) : ""] })
      + `<div data-bf-initiative-swap style="margin:0.4rem 0;">${rows}</div>` + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "swap", label: "Swap", default: true, callback: (event, button) => {
        const pick = button.form.querySelector('input[name="bf-initiative-swap"]:checked')?.value ?? null;
        void answerSwap(message, pick ? "swap" : "no", pick);
      } },
      { action: "no", label: "No", callback: () => { void answerSwap(message, "no"); } }
    ]
  });
  const form = dialog?.element?.querySelector?.("form") ?? dialog?.element ?? null;
  const swap = form?.querySelector?.('button[data-action="swap"]');
  if ( swap ) swap.disabled = true;
}

// A pick pings its creature's token and lights Swap (one listener for every popup).
Hooks.once("ready", () => document.addEventListener("change", ev => {
  const input = ev.target?.closest?.('input[name="bf-initiative-swap"]');
  if ( !input ) return;
  const tok = input.dataset.token ? canvas?.tokens?.get(input.dataset.token) : null;
  if ( tok ) { try { canvas.ping(tok.center); } catch { /* no canvas to ping */ } }
  const swap = input.closest("form")?.querySelector?.('button[data-action="swap"]');
  if ( swap ) swap.disabled = false;
}));

/** The card's line — what was done, or that it waits. */
function swapLine(flag) {
  const ally = (flag.allies ?? []).find(a => a.combatantId === flag.pick);
  if ( flag.answer === "swap" ) return flag.applied
    ? `${flag.actorName} swaps Initiative with ${flag.allyName ?? ally?.name ?? "an ally"}: ${flag.from ?? flag.initiative} ↔ ${flag.to ?? ally?.initiative ?? "?"}`
    : `swapping with ${ally?.name ?? "an ally"}…`;
  if ( flag.answer === "no" ) return `${flag.row} — no swap${flag.timedOut ? " (timer)" : ""}`;
  return `asking ${flag.actorName} about a swap (Initiative ${flag.initiative})`;
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, SWAP_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-initiative-swap-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-initiative-swap-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-right-left" data-tooltip="${esc(flag.row)}"></i> ${esc(swapLine(flag))}`
      + ((flag.status === "pending") ? ` ${holdBarHTML(flag, "to answer")}` : "");
    if ( flag.status === "pending" ) {
      const actor = resolveUuid(flag.actorUuid);
      if ( canAnswerFor(actor) ) {
        const shown = popupKey(message.id, SWAP_FLAG);
        if ( !shownMoments.has(shown) ) { shownMoments.add(shown); void showSwapPopup(message); }
        div.appendChild(momentButton("Answer", () => { void showSwapPopup(message); }));
      }
      scheduleBarSync(div);
      armTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The initiative-swap line could not render.`, err); }
});

// An answer anywhere closes the popup everywhere (law 4); the clock stands down with it.
Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, SWAP_FLAG);
  if ( !flag ) return;
  if ( flag.status === "pending" ) { armTimer(message); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, SWAP_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

Hooks.on("deleteChatMessage", message => { disarmDeadline(timers, message.id); });
