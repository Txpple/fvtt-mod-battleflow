/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE HEALING REROLLS — a healing die showing a 1,
 * rerolled at its owner's word (decide/registry.js HEAL_REROLLS; Healer the one row). The origin
 * feats, 2026-09-25 — the user: "use the empower spell form as a baseline listing all roll numbers,
 * the ones, and select the ones to replace"; "make sure the healer feat itself gets the 1 popup too
 * not just spells"; "1s ticked".
 *
 * THE MOMENT is the healing roll — a healing spell the owner casts, or the feat's own Battle Medic.
 * The roll message is born with `healReroll` DUE (preRollDamageV2, a birth flag like Savage
 * Attacker's), and the heal applier (cast.js) holds the healing while it waits — so it lands ONCE,
 * with the faces that stood. When the dice land (rollDamageV2, the roller's client) the record goes
 * pending if a 1 shows and settles "none" if not. The popup is Empowered Spell's (metamagic.js):
 * every die as a chip, eight to a row — the 1s pickable and TICKED, every other face shown and
 * greyed; "Reroll the picked dice" / "Keep the roll"; the clock keeps the roll. The feat has no
 * cost and no cap: every 1 may go.
 *
 * BATTLE MEDIC: the pack's own activities roll `1dXr1 + @prof` — the platform rerolling the 1
 * silently. The feat's rerolls are the popup's now, so the `r1` is taken off at the roll
 * (decide/damage-dice.js `stripRerollOnes`) and the 1 is asked like a spell's.
 *
 * THE PATCH is Empowered's (decide/damage-dice.js `rerollFaces`): the 1 struck in the message's own
 * roll data, the new face joining it, the rolls rebuilt with their totals taken again (shared.js
 * `rebuildRolls`), the new dice on their own card (Dice So Nice keys on it). "You must use the new
 * roll": a second 1 stands. Healing already applied off the message — the claim makes that the belt,
 * not the road — is moved by the difference (auto-apply.js `moveAppliedDamage`).
 */
import { MODULE_ID, TITLE, S, setting, statContext, queueFlagWrite, drivesMomentFor } from "./core.js";
import { lower, featureNamed, resolveUuid } from "./lookup.js";
import { healRerollEntries, listedNames } from "./settings.js";
import { rebuildRolls } from "./shared.js";
import { HEAL_REROLLS } from "./decide/registry.js";
import { healDiceOf, stripRerollOnes, rerollFaces } from "./decide/damage-dice.js";
import { rerollRise } from "./decide/dice-chips.js";
import { bfCard, esc, holdBarHTML, popupKey, foldedRuleHTML } from "./decide/present.js";
import { openMomentPopup, momentButton, armDeadline, disarmDeadline, livePopups, scheduleBarSync,
  dramaticVerdictPause, registerResumable, paintDieChip } from "./ui.js";
import { moveAppliedDamage } from "./auto-apply.js";
import { SURFACES } from "./surfaces.js";

const HEAL_FLAG = "healReroll";
const timers = new Map();
const offering = new Set();
const resolving = new Set();

/** The listed healing-reroll row this actor holds — `{ name, row, feature }` or null. */
function rowFor(actor) {
  const listed = listedNames(healRerollEntries());
  for ( const [name, row] of Object.entries(HEAL_REROLLS) ) {
    if ( !listed.has(lower(name)) ) continue;
    const feature = featureNamed(actor, name);
    if ( feature ) return { name, row, feature };
  }
  return null;
}

/* --- the birth flag: due, and Battle Medic's own r1 taken off ---------------------------------- */

Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  try {
    const rolls = config?.rolls ?? [];
    if ( !rolls.some(r => (r?.options?.type ?? null) === "healing") ) return;
    const activity = config?.subject;
    const actor = activity?.actor;
    const found = actor ? rowFor(actor) : null;
    if ( !found ) return;
    const item = activity.item;
    const own = found.row.own && (item?.id === found.feature.id);
    const spell = found.row.spells && (item?.type === "spell");
    if ( !own && !spell ) return;
    if ( own ) for ( const r of rolls ) if ( Array.isArray(r?.parts) ) r.parts = r.parts.map(p => (typeof p === "string") ? stripRerollOnes(p) : p);
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${HEAL_FLAG}`, {
      status: "due", feature: found.name, reroll: found.row.reroll, actorUuid: actor.uuid,
      source: item?.name ?? null, ...statContext(actor.uuid)
    });
  } catch(err) {
    console.error(`${TITLE} | The healing reroll could not be offered — reroll the 1s by hand.`, err);
  }
});

/* --- the promotion: due → pending when a 1 shows, "none" when none does ------------------------ */

Hooks.on("dnd5e.rollDamageV2", rolls => {
  const message = rolls?.[0]?.parent;
  if ( message instanceof ChatMessage ) void promote(message);
});

Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
  if ( !flag ) return;
  if ( (flag.status === "due") && message.isAuthor ) void promote(message);
  if ( flag.status === "pending" ) { armTimer(message); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, HEAL_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

Hooks.on("deleteChatMessage", message => { disarmDeadline(timers, message.id); });

/** The whole roll's total — the healing rolls only. */
const healTotal = rolls => (rolls ?? []).filter(r => (r?.options?.type ?? "healing") === "healing")
  .reduce((n, r) => n + (Number(r.total) || 0), 0);

async function promote(message) {
  const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
  if ( (flag?.status !== "due") || offering.has(message.id) ) return;
  offering.add(message.id);
  try {
    const dice = healDiceOf((message.rolls ?? []).map(r => r.toJSON()), flag.reroll);
    const any = dice.some(d => d.one);
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await queueFlagWrite(message, HEAL_FLAG, current => {
      if ( current.status !== "due" ) return false;
      if ( !any ) { current.status = "none"; return; }
      current.status = "pending";
      current.dice = dice;
      current.total = healTotal(message.rolls);
      if ( window ) { current.window = window; current.deadline = Date.now() + (window * 1000); }
    });
    if ( message.getFlag(MODULE_ID, HEAL_FLAG)?.status !== "pending" ) return;
    armTimer(message);
    // The table sees the dice land before the question about them opens (the verdict pause's rule).
    await dramaticVerdictPause(message);
    await showPopup(message);
  } finally {
    offering.delete(message.id);
  }
}

/** The buzzer, on whoever drives the healer's moments — the healing waits on this answer. */
function armTimer(message) {
  const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !drivesMomentFor(flag.actorUuid ?? null) ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( live?.getFlag(MODULE_ID, HEAL_FLAG)?.status === "pending" ) await keep(live, { timedOut: true });
  });
}

/* --- the popup: Empowered's chips, the 1s ticked ----------------------------------------------- */

/** The picked chips in a popup's form. */
const picksIn = form => [...(form?.querySelectorAll?.('[data-bf-heal-die][data-picked="1"]') ?? [])].map(b => b.dataset.bfHealDie);

async function showPopup(message) {
  const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const row = HEAL_REROLLS[flag.feature] ?? null;
  const ones = (flag.dice ?? []).filter(d => d.one).length;
  // Eight to a row (Empowered's grid). A 1 is ticked and pickable; any other face is shown, greyed.
  const chips = (flag.dice ?? []).map(d => `<button type="button" data-bf-heal-die="${esc(d.key)}" data-picked="${d.one ? "1" : "0"}" ${d.one ? "" : "disabled"} data-tooltip="d${d.faces}"
      style="width:2.2rem;height:2.2rem;margin:0;padding:0;font-weight:bold;${d.one ? "" : "opacity:0.45;"}">${d.result}</button>`).join("");
  const dialog = await openMomentPopup(message, HEAL_FLAG, actor, {
    title: `${flag.feature} — ${actor.name}`, icon: "fa-solid fa-hand-holding-medical", width: 460,
    content: bfCard({
      img: featureNamed(actor, flag.feature)?.img ?? null,
      eyebrow: `${flag.feature} — Healing Rerolls`, tone: "pending",
      title: `${flag.source ?? "Healing"} heals ${flag.total} — reroll the ${ones === 1 ? "1" : "1s"}?`,
      subtitle: "no cost · you must use the new roll",
      lines: [row?.rule ? foldedRuleHTML(esc(row.rule)) : ""]
    }) + `<div data-bf-heal-dice style="margin:0.4rem 0;display:grid;grid-template-columns:repeat(8, 2.2rem);gap:0.3rem;justify-content:start;">${chips}</div>`
      + holdBarHTML(flag, "to answer"),
    buttons: [
      // The window goes at the click (Empowered's lesson, 2026-09-10): the work is fired, not awaited.
      { action: "reroll", label: "Reroll the picked dice", default: true, callback: (event, button) => { const picks = picksIn(button.form); void reroll(message, picks); } },
      { action: "keep", label: "Keep the roll", callback: () => { void keep(message); } }
    ]
  });
  const box = dialog?.element?.querySelector?.("[data-bf-heal-dice]") ?? null;
  for ( const chip of box?.querySelectorAll?.("[data-bf-heal-die]") ?? [] ) paintDieChip(chip, chip.dataset.picked === "1");
  syncReroll(box);
}

/** Reroll is live only while at least one die is ticked (Empowered's rule, 2026-09-12). */
function syncReroll(box) {
  const button = box?.closest?.("form")?.querySelector?.('button[data-action="reroll"]');
  if ( button ) button.disabled = !box.querySelector('[data-picked="1"]');
}

// The chips toggle by delegation — one listener on the document serves every open popup.
Hooks.once("ready", () => document.addEventListener("click", ev => {
  const chip = ev.target?.closest?.("[data-bf-heal-die]");
  if ( !chip || chip.disabled ) return;
  ev.preventDefault();
  paintDieChip(chip, chip.dataset.picked !== "1");
  syncReroll(chip.closest("[data-bf-heal-dice]"));
}));

async function keep(message, { timedOut = false } = {}) {
  await queueFlagWrite(message, HEAL_FLAG, current => {
    if ( current.status !== "pending" ) return false;
    current.status = "kept";
    current.answeredAt = Date.now();
    if ( timedOut ) current.timedOut = true;
  });
}

/* --- the answer: the picked 1s rolled again, the new faces standing ---------------------------- */

async function reroll(message, keys) {
  if ( resolving.has(message.id) ) return;
  resolving.add(message.id);
  try {
    const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
    if ( flag?.status !== "pending" ) return;
    const wanted = new Set(keys ?? []);
    const picks = (flag.dice ?? []).filter(d => d.one && wanted.has(d.key));
    if ( !picks.length ) { await keep(message); return; }
    const actor = resolveUuid(flag.actorUuid);
    // ANSWERED IS NOT PENDING (the d20 folds' rule): the status leaves "pending" before the dice.
    await queueFlagWrite(message, HEAL_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "answering";
      current.answeredAt = Date.now();
    });
    if ( message.getFlag(MODULE_ID, HEAL_FLAG)?.status !== "answering" ) return;
    const data = (message.rolls ?? []).map(r => r.toJSON());
    const live = picks.filter(d => data[d.roll]?.terms?.[d.term]?.results?.[d.index]);
    // THE DICE ARE ONE ROLL, ON THEIR OWN CARD (Empowered's reason: the card every roll-reader and
    // Dice So Nice key on).
    const fresh = await new Roll(live.map(d => `1d${d.faces}`).join(" + ")).evaluate();
    const faces = fresh.dice.map(die => die.results.find(r => r.active !== false)?.result ?? die.total);
    const { data: patched, done } = rerollFaces(data, live, faces);
    const rebuilt = rebuildRolls(patched);
    const total = healTotal(rebuilt);
    const delta = total - (Number(flag.total) || 0);
    const rise = rerollRise({ done, on: actor?.uuid });   // the 1s turn over on the canvas, over the healer
    const announce = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [fresh],
      content: bfCard({ img: featureNamed(actor, flag.feature)?.img ?? null,
        eyebrow: `${flag.feature} — Healing Rerolls`, tone: "good",
        title: `${flag.feature} — ${done.length === 1 ? "the 1" : `${done.length} ones`} rerolled → ${done.map(p => p.new).join(", ")}`,
        subtitle: `${flag.source ?? "the healing"} heals ${total} now`, lines: [] }),
      flags: { [MODULE_ID]: { respondsTo: message.id, ...(rise ? { diceRise: rise } : {}) } }
    });
    // THE DURABLE INTENT, BEFORE THE PAUSE (Empowered's 2026-09-10 review): the elect's resume
    // finishes it if this client dies inside the dice.
    await queueFlagWrite(message, HEAL_FLAG, current => {
      if ( current.status !== "answering" ) return false;
      current.pending = { rolls: rebuilt.map(r => JSON.stringify(r.toJSON())), picks: done, newTotal: total, delta, at: Date.now() };
    });
    if ( announce ) await dramaticVerdictPause(announce);
    await complete(message);
  } catch(err) {
    console.error(`${TITLE} | The healing reroll failed — reroll the 1s by hand.`, err);
    if ( message.getFlag(MODULE_ID, HEAL_FLAG)?.pending ) await complete(message).catch(() => {});
    else await queueFlagWrite(message, HEAL_FLAG, current => {
      if ( current.status !== "answering" ) return false;
      current.status = "pending";
    }).catch(() => {});
  } finally {
    resolving.delete(message.id);
  }
}

/**
 * THE COMPLETION — the one step between "answering" and "used": the patched rolls onto the
 * message, the outcome onto the flag (the settling write the heal applier waits on), and any
 * healing already applied moved by the difference. Idempotent by status.
 */
async function complete(message) {
  const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
  if ( (flag?.status !== "answering") || !flag.pending ) return;
  const { rolls, picks, newTotal, delta } = flag.pending;
  const { pending: _done, ...rest } = flag;
  void _done;
  await message.update({
    rolls,
    flags: { [MODULE_ID]: { [HEAL_FLAG]: { ...rest, status: "used", picks, newTotal, delta, "-=pending": null } } }
  });
  await moveAppliedDamage(message, { delta, feature: flag.feature });
}

/** Past the longest the pause can be, with slack. */
const RESUME_MS = 20_000;
registerResumable(HEAL_FLAG, {
  // A completion the clicking client never took, and a DUE the roller never promoted: the driver
  // finishes the one and asks the other.
  pending: (flag, message) => ((flag?.status === "answering") && !!flag.pending && ((Date.now() - (flag.pending.at ?? 0)) > RESUME_MS))
    || ((flag?.status === "due") && ((Date.now() - (message.timestamp ?? 0)) > RESUME_MS)),
  drives: flag => drivesMomentFor(flag?.actorUuid ?? null),
  drive: message => (message.getFlag(MODULE_ID, HEAL_FLAG)?.status === "due") ? promote(message) : complete(message)
});

/* --- the card: what happened, and the recall while it asks ------------------------------------- */

/** The card's line, from the record — source, then result (law 6). */
function cardLine(flag) {
  const name = flag.feature ?? "Healer";
  switch ( flag.status ) {
    case "used": {
      const n = (flag.picks ?? []).length;
      return `${name} — ${n === 1 ? "the 1" : `${n} ones`} rerolled (${(flag.picks ?? []).map(p => `${p.old}→${p.new}`).join(", ")}): heals ${flag.newTotal}`;
    }
    case "kept": return `${name} — kept the roll${flag.timedOut ? " (the clock ran out)" : ""}`;
    case "answering": return `${name} — rerolling the 1s`;
    case "due": return `${name} — reading the dice`;
    case "none": return "";
    default: return `${name} — offered: reroll the 1s`;
  }
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
    if ( !flag || (flag.status === "none") ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-heal-reroll-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-heal-reroll-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-hand-holding-medical" data-tooltip="${esc(flag.feature ?? "")}"></i> ${esc(cardLine(flag))}`
      + ((flag.status === "pending") ? ` ${holdBarHTML(flag, "to answer")}` : "");
    if ( flag.status === "pending" ) {
      const actor = resolveUuid(flag.actorUuid);
      if ( actor?.isOwner ) div.appendChild(momentButton("Answer", () => { void showPopup(message); }));
      scheduleBarSync(div);
      armTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The healing-reroll line could not render.`, err); }
});
