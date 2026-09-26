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
import { dispositionStyle } from "./shared.js";
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
  if ( !combat ) return;
  // A RESET RE-ARMS (user, 2026-09-25: "if i reset initiative and reroll, alert doesnt retrigger"):
  // the holder's Initiative cleared means the next roll is a new "roll Initiative", so its latch
  // goes and the last roll landing asks again. A number merely changed asks nothing (once per roll).
  if ( changes.initiative === null ) {
    if ( combat.getFlag(MODULE_ID, ASKED_FLAG)?.[combatant.id] ) {
      void combat.update({ [`flags.${MODULE_ID}.${ASKED_FLAG}.-=${combatant.id}`]: null })
        .catch(err => console.error(`${TITLE} | The initiative swap could not re-arm — swap by hand.`, err));
    }
    return;
  }
  void askFor(combat);
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
      // the init order swaps will play out"; "it should also include enemies, but greyed out"; then
      // "enemy is red, ally is green, yellow is neutral ... friendly for an initiative list"): every
      // combatant the tracker shows, in Initiative order, its side read off the token's disposition
      // against the owner's; only the allies above are pickable.
      const pickable = new Set(allies.map(a => a.combatantId));
      const NEUTRAL = CONST.TOKEN_DISPOSITIONS?.NEUTRAL ?? 0;
      const lineup = combatants
        .filter(o => (o.id === c.id) || !o.hidden)
        .sort((a, b) => b.initiative - a.initiative)
        .map(o => ({ combatantId: o.id, name: o.name, initiative: o.initiative, tokenId: o.tokenId ?? null,
          img: o.token?.texture?.src ?? o.img ?? null,
          role: (o.id === c.id) ? "self" : pickable.has(o.id) ? "ally"
            : (o.token?.disposition === side) ? "incapacitated"
            : (o.token?.disposition === NEUTRAL) ? "neutral" : "enemy" }));
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
  // THE TARGET LIST'S SHAPE (user, 2026-09-25: "hard to read when entire row is colored. like in
  // the select windows /target list we have the icon and its highlighted portrait ... you have the
  // precedent" — polish.js's Targeted block, shared.js `dispositionStyle`): a plain row, the token's
  // art framed in its canvas disposition colour, the word beside it in that colour; the rank and
  // the number; the owner bold "(you)"; an Incapacitated ally dimmed. A pick previews the two new
  // numbers on the owner's row and the ally's ("→ 17").
  const lineup = flag.lineup ?? (flag.allies ?? []).map(a => ({ ...a, role: "ally" }));
  const rows = lineup.map((a, i) => {
    const pick = a.role === "ally";
    const cue = dispositionStyle(a.tokenId ? canvas?.tokens?.get(a.tokenId) : null);
    const word = (a.role === "self") ? "(you)" : (a.role === "incapacitated") ? "Incapacitated" : cue.label;
    // ONE GRID for every row (user, 2026-09-25: "needs alignment on the icon"): the rank, the radio's
    // slot (empty on a row that cannot be picked, the same width), the portrait, the name, the word,
    // the number right-aligned, the preview — so the portraits and the numbers line up down the list.
    const style = "display:grid;grid-template-columns:1.2rem 1.4rem 32px minmax(0,1fr) auto 2rem 2.8rem;gap:0.5rem;align-items:center;"
      + "margin:2px 0;padding:0.2rem 0.4rem;border-radius:4px;"
      + (pick ? "cursor:pointer;background:rgba(0,0,0,0.06);" : "") + ((a.role === "incapacitated") ? "opacity:0.55;" : "");
    const radio = pick
      ? `<input type="radio" name="bf-initiative-swap" value="${esc(a.combatantId)}" data-token="${esc(a.tokenId ?? "")}" style="margin:0;justify-self:center;">`
      : "<span></span>";
    const portrait = a.img
      ? `<img src="${esc(a.img)}" alt="${esc(cue.label)}" class="gold-icon" style="width:32px;height:32px;object-fit:cover;border-radius:4px;border:2px solid ${cue.color};box-sizing:border-box;">`
      : `<i class="${cue.icon}" style="width:32px;text-align:center;color:${cue.color};"></i>`;
    const tag = pick ? "label" : "div";
    return `<${tag} data-bf-initiative-row="${esc(a.role)}" data-combatant="${esc(a.combatantId)}" data-initiative="${esc(a.initiative)}" style="${style}">
      <span style="text-align:right;opacity:0.6;font-size:var(--font-size-11,11px);">${i + 1}</span>${radio}${portrait}
      <span style="font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.name)}</span>
      <span style="opacity:0.7;font-size:0.9em;color:${(a.role === "self" || a.role === "incapacitated") ? "inherit" : cue.color};">${esc(word)}</span>
      <strong style="font-size:1.15em;text-align:right;">${esc(a.initiative)}</strong><span data-bf-initiative-after style="font-weight:bold;white-space:nowrap;"></span></${tag}>`;
  }).join("");
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
  // The preview: the owner's row and the picked ally's show the numbers they would trade to.
  const list = input.closest("[data-bf-initiative-swap]");
  const self = list?.querySelector('[data-bf-initiative-row="self"]');
  const picked = input.closest("[data-bf-initiative-row]");
  for ( const after of list?.querySelectorAll("[data-bf-initiative-after]") ?? [] ) after.textContent = "";
  if ( self && picked ) {
    self.querySelector("[data-bf-initiative-after]").textContent = `→ ${picked.dataset.initiative}`;
    picked.querySelector("[data-bf-initiative-after]").textContent = `→ ${self.dataset.initiative}`;
  }
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
  floatSwap(message, flag);
});

/**
 * THE FLOATING TEXT (user, 2026-09-25: "alert should have a floating white text about the swap so
 * everyone can see it. same as like when something is decremented"): once the swap lands, every
 * client floats the new number over each of the two tokens — "Initiative 11 → 17" — the canvas's
 * own scrolling text, white, as the system floats a hit-point change. Live updates only: a reload
 * replays nothing (the set remembers what this client floated).
 */
const floated = new Set();
function floatSwap(message, flag) {
  if ( (flag.answer !== "swap") || !flag.applied || !Number.isFinite(flag.from) || !Number.isFinite(flag.to) ) return;
  if ( floated.has(message.id) ) return;
  floated.add(message.id);
  try {
    const combat = game.combats.get(flag.combatId);
    const float = (combatantId, from, to) => {
      const token = combat?.combatants.get(combatantId)?.token?.object;
      if ( !token?.visible || !canvas?.interface?.createScrollingText ) return;
      canvas.interface.createScrollingText(token.center, `Initiative ${from} → ${to}`, {
        anchor: CONST.TEXT_ANCHOR_POINTS.TOP, fill: "#ffffff", stroke: 0x000000, strokeThickness: 4,
        fontSize: 28, jitter: 0.25, duration: 3000
      });
    };
    float(flag.combatantId, flag.from, flag.to);
    float(flag.pick, flag.to, flag.from);
  } catch(err) { console.warn(`${TITLE} | The initiative swap's floating text could not draw.`, err); }
}

Hooks.on("deleteChatMessage", message => { disarmDeadline(timers, message.id); });
