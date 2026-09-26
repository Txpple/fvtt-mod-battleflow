/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the damage dice, rolled twice — Savage Attacker
 * (Slice A, ruled 2026-09-24 off prototypes/slice-a.html; the row is decide/registry.js
 * DAMAGE_EITHER, the arithmetic decide/damage-dice.js).
 *
 * THE MOMENT is the weapon hit's damage roll. The popup asks ONE question — whether to use it on
 * THIS hit (once per turn, and a Fighter with Extra Attack may want it for a bigger roll later) —
 * a tick row, "Roll again" / "Keep the roll", a clock that keeps the roll. It never asks which set
 * to keep: on "Roll again" the weapon's dice are rolled again AS A SET, the two set totals are
 * compared, and the higher stands with no second question. The card shows both sets, the loser
 * struck, and "Savage Attacker — used this turn"; a second hit the same turn gets no popup, only
 * that tag. Out of combat once-per-turn cannot be counted, so every hit offers.
 *
 * THE SEQUENCE (the ruling's order: the defender's hold, then the damage stands, then the
 * attacker's offer). The damage message is born with `either` DUE (preRollDamageV2, a birth flag
 * like the clock riders'), and auto-apply.js holds the application while it waits — so the dice
 * land ONCE, with the set that stood. The question is asked only once the attack's hold is off the
 * roll: a roll born `attackHoldPending` waits for the hold's release write (hold/continue.js), which
 * reaches this file as an update, and an attack the hold turned into a miss resolves the offer moot.
 *
 * THE PATCH is Empowered Spell's (metamagic.js), lifted into shared pieces on 2026-09-24: the old
 * faces struck in the message's own roll data (decide/damage-dice.js), the rolls rebuilt with their
 * totals taken again (shared.js `rebuildRolls`), the message updated, and — the §11 rule 4
 * obligation — damage already applied off it moved by the difference (auto-apply.js
 * `moveAppliedDamage`); with the claim holding the application that last step is a belt, not the
 * road. ⚠ dnd5e dispatches the damage hook TWICE per roll (metamagic.js measured it, 2026-09-09):
 * an in-flight set keeps the offer single.
 */
import { MODULE_ID, TITLE, S, setting, statContext, queueFlagWrite, drivesMomentFor } from "./core.js";
import { lower, featureNamed, resolveUuid } from "./lookup.js";
import { damageEitherEntries, listedNames } from "./settings.js";
import { hitTargets, turnChitStands, writeTurnChit, rebuildRolls } from "./shared.js";
import { DAMAGE_EITHER } from "./decide/registry.js";
import { weaponDiceOf, setFormula, setTotal, eitherOutcome, eitherPatch, eitherDue, eitherCardLine, eitherOdds } from "./decide/damage-dice.js";
import { bfCard, esc, holdBarHTML, popupKey, tickRowsHTML, dieMeterHTML } from "./decide/present.js";
import { eitherRise } from "./decide/dice-chips.js";
import { openMomentPopup, momentButton, armDeadline, disarmDeadline, livePopups, scheduleBarSync,
  dramaticVerdictPause, registerResumable } from "./ui.js";
import { attackMessageForDamage } from "./auto-damage.js";
import { moveAppliedDamage } from "./auto-apply.js";
import { SURFACES } from "./surfaces.js";

const EITHER_FLAG = "either";
const timers = new Map();
const offering = new Set();
const resolving = new Set();

/** The listed rolled-twice row this attacker holds — `{ name, row, feature }` or null. */
function eitherRowFor(attacker) {
  const listed = listedNames(damageEitherEntries());
  for ( const [name, row] of Object.entries(DAMAGE_EITHER) ) {
    if ( !listed.has(lower(name)) ) continue;
    const feature = featureNamed(attacker, name);
    if ( feature ) return { name, row, feature };
  }
  return null;
}

/* --- the birth flag: due, or spent this turn --------------------------------------------------- */

Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  try {
    const activity = config?.subject;
    if ( activity?.type !== "attack" ) return;
    const attacker = activity.actor;
    const found = eitherRowFor(attacker);
    if ( !found ) return;
    const attackMessage = attackMessageForDamage(config, message);
    if ( !attackMessage ) return;
    const status = eitherDue({ listed: true, owned: true, weapon: activity.item?.type === "weapon",
      chitStands: turnChitStands(attacker, "rider", found.row.key) });
    if ( !status ) return;
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${EITHER_FLAG}`, {
      status, feature: found.name, key: found.row.key, actorUuid: attacker.uuid, attackId: attackMessage.id,
      ...statContext(attacker.uuid)
    });
  } catch(err) {
    console.error(`${TITLE} | The weapon's dice could not be offered again — roll them again by hand.`, err);
  }
});

/* --- the promotion: due → pending, once the hold is off the roll -------------------------------- */

// The roller's client, as the dice land (twice — the in-flight set keeps it single).
Hooks.on("dnd5e.rollDamageV2", rolls => {
  const message = rolls?.[0]?.parent;
  if ( message instanceof ChatMessage ) void promote(message);
});

// The hold's release (hold/continue.js writes `attackHoldPending: false` on the roll), on the
// client that rolled it; a settled fold closes its popup (law 4) and stands its buzzer down, and a
// pending one re-arms here on whichever client drives the moment.
Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, EITHER_FLAG);
  if ( !flag ) return;
  if ( (flag.status === "due") && message.isAuthor ) void promote(message);
  if ( flag.status === "pending" ) { armEitherTimer(message); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, EITHER_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

async function promote(message) {
  const flag = message.getFlag(MODULE_ID, EITHER_FLAG);
  if ( (flag?.status !== "due") || offering.has(message.id) ) return;
  // The hold first: its release write brings this back (the update hook above).
  if ( message.getFlag(MODULE_ID, "attackHoldPending") === true ) return;
  offering.add(message.id);
  try {
    const attackMessage = game.messages.get(flag.attackId);
    const dice = weaponDiceOf((message.rolls ?? []).map(r => r.toJSON()), weaponRollsOf(message));
    // A hold that turned the hit into a miss leaves nothing to roll again, and spends nothing.
    const moot = !attackMessage || !hitTargets(attackMessage).length || !dice.length;
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await queueFlagWrite(message, EITHER_FLAG, current => {
      if ( current.status !== "due" ) return false;
      if ( moot ) { current.status = "moot"; return; }
      current.status = "pending";
      current.formula = setFormula(dice);
      current.first = setTotal(dice);
      current.odds = eitherOdds(dice, current.first);
      current.total = rollsTotal(message.rolls);
      if ( window ) { current.window = window; current.deadline = Date.now() + (window * 1000); }
    });
    if ( message.getFlag(MODULE_ID, EITHER_FLAG)?.status !== "pending" ) return;
    armEitherTimer(message);
    // The table sees the dice land before the question about them opens (the verdict pause's rule).
    await dramaticVerdictPause(message);
    await showEitherPopup(message);
  } finally {
    offering.delete(message.id);
  }
}

/** How many of the message's rolls are the activity's own (auto-damage.js stamps it); one when unstamped. */
const weaponRollsOf = message => {
  const n = Number(message.getFlag(MODULE_ID, "weaponRolls"));
  return Number.isFinite(n) && (n > 0) ? n : 1;
};

/** The whole roll's total, every part. */
const rollsTotal = rolls => (rolls ?? []).reduce((n, r) => n + (Number(r.total) || 0), 0);

/**
 * The buzzer, on whoever drives the attacker's moments (core.js `drivesMomentFor`: the active GM,
 * and with no GM the attacker's own player) — the damage waits on this answer, so a table with no
 * GM must still have a clock that keeps the roll.
 */
function armEitherTimer(message) {
  const flag = message.getFlag(MODULE_ID, EITHER_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !drivesMomentFor(flag.actorUuid ?? null) ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( live?.getFlag(MODULE_ID, EITHER_FLAG)?.status === "pending" ) await keepEither(live, { timedOut: true });
  });
}

/* --- the popup ---------------------------------------------------------------------------------- */

async function showEitherPopup(message) {
  const flag = message.getFlag(MODULE_ID, EITHER_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  if ( !actor ) return;
  const row = DAMAGE_EITHER[flag.feature] ?? null;
  const weapon = game.messages.get(flag.attackId)?.getAssociatedActivity?.()?.item ?? null;
  const formula = (message.rolls ?? []).map(r => r.formula).join(" + ");
  const lean = flag.odds?.low !== false;   // no odds (an old card): today's default, Roll again
  const dialog = await openMomentPopup(message, EITHER_FLAG, actor, {
    title: `${flag.feature} — ${actor.name}`, icon: "fa-solid fa-dice", width: 440,
    content: bfCard({
      img: featureNamed(actor, flag.feature)?.img ?? weapon?.img ?? null,
      eyebrow: `Damage — ${flag.feature}`, tone: "pending",
      title: `${flag.total} damage — roll it again?`,
      subtitle: `${weapon?.name ?? "the weapon"} · ${formula} → ${flag.total}`
    }) + holdBarHTML(flag, "to answer")
      // THE HINT (option D, ruled 2026-09-25 off prototypes/savage-hint.html): the die meter in the
      // header, and the defaults LEAN — under the average the row starts ticked and "Roll again" is
      // the default; at or above it, "Keep the roll". Nothing added to the row (the offer-row rule).
      + (flag.odds ? dieMeterHTML({ value: flag.first, ...flag.odds }) : "")
      + tickRowsHTML({ name: "bf-either", rows: [{ key: flag.key, name: flag.feature, dice: `${flag.formula} again`,
        tag: "once per turn", rule: row?.rule ?? null }] }),
    buttons: [
      // The window goes at the click (Empowered's lesson, 2026-09-10): the work is fired, not awaited.
      { action: "again", label: "Roll again", callback: () => { void rollAgain(message); } },
      { action: "keep", label: "Keep the roll", callback: () => { void keepEither(message); } }
    ]
  });
  // BOTH BUTTONS, THE TICK PICKS WHICH IS LIVE (user, 2026-09-25: "just a normal button ... i
  // liked it when they were side by side both, you can just grey the opposing one out"): ticked,
  // "Roll again" is live and "Keep the roll" greyed; unticked, the other way. The tick starts
  // where the hint leans (under the average: ticked). The clock always keeps the roll (keepEither).
  const form = dialog?.element?.querySelector?.("form") ?? dialog?.element ?? null;
  const again = form?.querySelector?.('button[data-action="again"]');
  const keep = form?.querySelector?.('button[data-action="keep"]');
  const box = form?.querySelector?.('input[name="bf-either"]');
  if ( !again || !keep || !box ) return;
  const follow = () => { again.disabled = !box.checked; keep.disabled = box.checked; };
  box.checked = lean;
  follow();
  box.addEventListener("change", follow);
}

async function keepEither(message, { timedOut = false } = {}) {
  await queueFlagWrite(message, EITHER_FLAG, current => {
    if ( current.status !== "pending" ) return false;
    current.status = "kept";
    current.answeredAt = Date.now();
    if ( timedOut ) current.timedOut = true;
  });
}

/* --- the answer: the set rolled again, the higher standing ------------------------------------- */

async function rollAgain(message) {
  if ( resolving.has(message.id) ) return;
  resolving.add(message.id);
  try {
    const flag = message.getFlag(MODULE_ID, EITHER_FLAG);
    if ( flag?.status !== "pending" ) return;
    const actor = resolveUuid(flag.actorUuid);
    // ANSWERED IS NOT PENDING (the d20 folds' rule): the status leaves "pending" before the dice, so
    // the buzzer can no longer keep a roll the attacker chose to roll again, and the popup closes.
    await queueFlagWrite(message, EITHER_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "answering";
      current.answeredAt = Date.now();
    });
    if ( message.getFlag(MODULE_ID, EITHER_FLAG)?.status !== "answering" ) return;
    const data = (message.rolls ?? []).map(r => r.toJSON());
    const dice = weaponDiceOf(data, weaponRollsOf(message));
    // THE SECOND SET, ONE ROLL, ON ITS OWN CARD — the card every roll-reader and Dice So Nice key on
    // (Empowered's announce card, the same reason). Its die terms are the weapon's, term for term.
    const fresh = await new Roll(setFormula(dice)).evaluate();
    const freshResults = fresh.dice.map(d => d.results.map(r => ({ ...r })));
    const second = fresh.dice.reduce((n, d) => n + d.results.filter(r => (r.active !== false) && !r.discarded)
      .reduce((a, r) => a + (Number(r.result) || 0), 0), 0);
    const outcome = eitherOutcome({ first: setTotal(dice), second });
    const rebuilt = rebuildRolls(eitherPatch(data, dice, freshResults, outcome.stands === "second"));
    const total = rollsTotal(rebuilt);
    const rise = eitherRise({ first: setTotal(dice), second, stands: outcome.stands, on: actor?.uuid });
    const announce = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [fresh],
      content: bfCard({ img: featureNamed(actor, flag.feature)?.img ?? null,
        eyebrow: `Damage — ${flag.feature}`, tone: outcome.delta > 0 ? "good" : "neutral",
        title: `${flag.feature} — ${flag.formula} again → ${second}`,
        subtitle: outcome.delta > 0 ? `the higher stands: ${total}` : `the first stands: ${total}`,
        lines: [] }),
      // the two sets on the canvas, over the attacker: the one that stands glows (the dice that rise, group 3)
      flags: { [MODULE_ID]: { respondsTo: message.id, ...(rise ? { diceRise: rise } : {}) } }
    });
    // THE DURABLE INTENT, BEFORE THE PAUSE (Empowered's 2026-09-10 review): everything the
    // completion needs is written first, so the elect's resume can finish it if this client dies.
    await queueFlagWrite(message, EITHER_FLAG, current => {
      if ( current.status !== "answering" ) return false;
      current.pending = { rolls: rebuilt.map(r => JSON.stringify(r.toJSON())), second, stands: outcome.stands,
        delta: outcome.delta, total, at: Date.now() };
    });
    // Once per turn: the chit, on the attacker, for the turn in progress (none out of combat).
    if ( actor ) void writeTurnChit(actor, "rider", { name: `${flag.feature} — used this turn`,
      img: featureNamed(actor, flag.feature)?.img ?? null,
      description: `${flag.feature} rolled a weapon's damage dice again this turn. Once per turn; this chit ends with the turn.`,
      origin: featureNamed(actor, flag.feature)?.uuid ?? null, riderKey: flag.key })
      .catch(err => console.warn(`${TITLE} | Could not write the ${flag.feature} chit.`, err));
    if ( announce ) await dramaticVerdictPause(announce);
    await completeEither(message);
  } catch(err) {
    console.error(`${TITLE} | The weapon's second set failed to roll — roll the dice again by hand.`, err);
    // Never strand "answering": with nothing written the offer comes back; a written intent completes.
    if ( message.getFlag(MODULE_ID, EITHER_FLAG)?.pending ) await completeEither(message).catch(() => {});
    else await queueFlagWrite(message, EITHER_FLAG, current => {
      if ( current.status !== "answering" ) return false;
      current.status = "pending";
    }).catch(() => {});
  } finally {
    resolving.delete(message.id);
  }
}

/**
 * THE COMPLETION — the one step between "answering" and "used": the patched rolls onto the
 * message, the outcome onto the flag (the settling write auto-apply's claim waits on), and any
 * damage already applied moved by the difference. Idempotent by status.
 */
async function completeEither(message) {
  const flag = message.getFlag(MODULE_ID, EITHER_FLAG);
  if ( (flag?.status !== "answering") || !flag.pending ) return;
  const { rolls, second, stands, delta, total } = flag.pending;
  const { pending: _done, ...rest } = flag;
  void _done;
  await message.update({
    rolls,
    flags: { [MODULE_ID]: { [EITHER_FLAG]: { ...rest, status: "used", second, stands, delta, total, "-=pending": null } } }
  });
  await moveAppliedDamage(message, { delta, feature: flag.feature });
}

/** Past the longest the pause can be (six seconds of dice, up to ten of dramatic beat), with slack. */
const EITHER_RESUME_MS = 20_000;
registerResumable(EITHER_FLAG, {
  // A completion the clicking client never took, and a DUE the roller never promoted (its client
  // gone before the hold released): the driver finishes the one and asks the other.
  pending: (flag, message) => ((flag?.status === "answering") && !!flag.pending && ((Date.now() - (flag.pending.at ?? 0)) > EITHER_RESUME_MS))
    || ((flag?.status === "due") && (message.getFlag(MODULE_ID, "attackHoldPending") !== true)
      && ((Date.now() - (message.timestamp ?? 0)) > EITHER_RESUME_MS)),
  drives: flag => drivesMomentFor(flag?.actorUuid ?? null),
  drive: message => (message.getFlag(MODULE_ID, EITHER_FLAG)?.status === "due") ? promote(message) : completeEither(message)
});

/* --- the card (R5): what happened, and the recall while it asks -------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, EITHER_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-either-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-either-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-dice" data-tooltip="${esc(flag.feature ?? "")}"></i> ${esc(eitherCardLine(flag))}`
      + ((flag.status === "pending") ? ` ${holdBarHTML(flag, "to answer")}` : "");
    if ( flag.status === "pending" ) {
      const actor = resolveUuid(flag.actorUuid);
      if ( actor?.isOwner ) div.appendChild(momentButton("Answer", () => { void showEitherPopup(message); }));
      scheduleBarSync(div);
      armEitherTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The rolled-twice line could not render.`, err); }
});
