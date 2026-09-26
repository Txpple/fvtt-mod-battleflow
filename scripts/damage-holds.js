/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the DAMAGE HOLD — a reduction "when you take damage"
 * asked before ANY damage lands, not only an attack's (the Goliath walk, 2026-09-25: "what is the
 * level of effort to trigger stones endurance on any damage applied from not only attack but also
 * applied damage from a spell"; ruled "Hold before it lands"). The row is decide/registry.js
 * INTERRUPT_REDUCTIONS with `any: true` (Stone's Endurance); Parry stays an attack hold's.
 *
 * THE SEAM is the applier's claim (auto-apply.js `registerDamageClaim`): every damage the module
 * applies — a save's, an area's, an emanation's pulse, a rider's, a shield's — passes through
 * `applyDamagesWithReceipt`, and before a target's share lands this machine may claim it. A claimed
 * share is stamped whole on a card of its own (the damages, the multiplier, the note, the card the
 * receipt belongs on) and the damage WAITS; the owner answers in a popup — Stone's Endurance rolls
 * its 1d12 + CON in the open, spends a use and the Reaction — or takes it, or the clock takes it for
 * them; then the keeper lands the share, short by the roll, through the same applier (`held`, never
 * claimed twice), the receipt row saying why. An attack HIT the attack hold already asked about is
 * not claimed again (hold/ owns that moment, and one Reaction is one Reaction).
 *
 * ⚠ THE BEND (RULINGS' register): damage applied with the card's OWN buttons, or typed on a sheet,
 * never passes the module's applier — it is not held, and Stone's Endurance there is the table's.
 *
 * THE ORDER, by the rule: a save's multiplier (half on a success) first, then the reduction, then
 * the system's own resistances and immunities as it applies the number (PHB: resistance "after all
 * other modifiers to damage").
 * ------------------------------------------------------------------------------------------- */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { lower, itemNamed, resolveUuid, reductionFor, holdsFor } from "./lookup.js";
import { alliesWithin, tokenForUuid } from "./geometry.js";
import { interruptEntries } from "./settings.js";
import { INTERRUPT_REDUCTIONS } from "./decide/registry.js";
import { reduceDamages } from "./decide/verdict.js";
import { poolOf, reactionSpent, spendReaction, spendSuperiorityDie, resolveAttackMessage } from "./shared.js";
import { applyDamagesWithReceipt, registerDamageClaim } from "./auto-apply.js";
import { bfCard, esc, holdBarHTML, popupKey, ruleLine } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, scheduleBarSync, shownMoments,
  armDeadline, disarmDeadline, registerRelay, registerResumable } from "./ui.js";
import { SURFACES } from "./surfaces.js";

const HOLD_FLAG = "damageHold";
const timers = new Map();
const answering = new Set();
const NOT_DAMAGE = new Set(["healing", "temphp"]);
/** `receiptId|targetUuid` → when it was claimed; a second pass inside the window is the same share. */
const claimedShares = new Map();
const CLAIM_WINDOW_MS = 30_000;

/** The listed any-damage reduction this actor can take now — `{ name, row, item, activity, formula, pool }` or null. */
function anyReductionOf(actor) {
  for ( const entry of interruptEntries() ) {
    const name = entry.name;
    const key = Object.keys(INTERRUPT_REDUCTIONS).find(k => lower(k) === lower(name));
    const row = key ? INTERRUPT_REDUCTIONS[key] : null;
    if ( !row?.any ) continue;
    const item = itemNamed(actor, key);
    const found = item ? reductionFor(item, key) : null;
    if ( !found ) continue;
    const pool = row.pool ? poolOf(actor, found.activity) : null;
    if ( row.pool && !(Number(pool?.system?.uses?.value ?? 0) > 0) ) continue;
    return { name: key, row, item, activity: found.activity, formula: found.formula, pool };
  }
  return null;
}

/**
 * THE GUARDS (Interception, the fighting styles 2026-09-26, ruled P1): the creatures within a row's
 * `ally` reach of the one being hit who could reduce the damage for it — on its side, not the
 * attacker, the row's feature on the sheet with its reduction, the Reaction free, holding what the
 * row demands. `[{ actorUuid, actorName, itemId, activityId, formula, passed }]`, with the row's key.
 */
function interceptorsFor(defender, attacker) {
  const guarded = tokenForUuid(defender?.uuid);
  if ( !guarded ) return null;
  for ( const entry of interruptEntries() ) {
    const key = Object.keys(INTERRUPT_REDUCTIONS).find(k => lower(k) === lower(entry.name));
    const row = key ? INTERRUPT_REDUCTIONS[key] : null;
    if ( !row?.ally ) continue;
    const guards = [];
    for ( const token of alliesWithin(guarded, row.ally, [attacker?.uuid]) ) {
      const actor = token.actor;
      const item = itemNamed(actor, key);
      const found = item ? reductionFor(item, key) : null;
      if ( !found || reactionSpent(actor) || !holdsFor(actor, row.holding) ) continue;
      guards.push({ actorUuid: actor.uuid, actorName: token.document?.name ?? actor.name, itemId: item.id,
        activityId: found.activity.id, formula: found.formula, passed: false });
    }
    if ( guards.length ) return { name: key, row, guards };
  }
  return null;
}

/** The damage's plain, serializable shape — and back. */
const packDamages = damages => damages.map(d => ({ value: Number(d.value) || 0, type: d.type ?? null, properties: [...(d.properties ?? [])] }));
const unpackDamages = damages => (damages ?? []).map(d => ({ ...d, properties: new Set(d.properties ?? []) }));

/* --- the claim: before the share lands ------------------------------------------------------- */

registerDamageClaim((receiptMessage, target, actor, damages, { multiplier = 1, note } = {}) => {
  const own = listed(), guarded = guardsListed();
  if ( !own && !guarded ) return false;
  if ( !damages?.length || damages.every(d => NOT_DAMAGE.has(d.type)) ) return false;
  // ONE CLAIM PER SHARE (the pass-2 walk, 2026-09-25: "i get two popups instead of 1"): a save's
  // damage reaches the applier twice, and a claimed share has no receipt yet to stop the second
  // pass — the same receipt and target inside the window is the share already held.
  const key = `${receiptMessage.id}|${target.uuid}`;
  const at = claimedShares.get(key);
  if ( at && ((Date.now() - at) < CLAIM_WINDOW_MS) ) return true;
  if ( !(Number(actor.system?.attributes?.hp?.value ?? 0) > 0) ) return false;
  const attack = resolveAttackMessage(receiptMessage);
  // An attack hit the attack hold already asked this target about stays the hold's.
  const heldByAttack = !!attack?.getFlag(MODULE_ID, "hold")?.targets?.some(t => t.uuid === target.uuid);
  const found = (own && !reactionSpent(actor) && !heldByAttack) ? anyReductionOf(actor) : null;
  if ( !found ) {
    // THE GUARDS (Interception): an ATTACK's damage to a creature with a guard beside it — "hits
    // another creature within 5 feet of you with an attack roll" — held for the guards to answer.
    const guards = (guarded && attack) ? interceptorsFor(actor, attack.getAssociatedActor?.() ?? null) : null;
    if ( !guards ) return false;
    claimedShares.set(key, Date.now());
    void stampHold(receiptMessage, target, actor, damages, { multiplier, note }, guards, { guarded: true })
      .catch(async err => {
        console.error(`${TITLE} | ${guards.name}'s hold could not be stamped — the damage lands whole.`, err);
        await applyDamagesWithReceipt(receiptMessage, [target], damages, { multiplier, ...(note ? { note } : {}), held: true });
      });
    return true;
  }
  claimedShares.set(key, Date.now());
  void stampHold(receiptMessage, target, actor, damages, { multiplier, note }, found)
    .catch(async err => {
      console.error(`${TITLE} | ${found.name}'s hold could not be stamped — the damage lands whole.`, err);
      await applyDamagesWithReceipt(receiptMessage, [target], damages, { multiplier, ...(note ? { note } : {}), held: true });
    });
  return true;
});

const listed = () => interruptEntries().some(e => INTERRUPT_REDUCTIONS[Object.keys(INTERRUPT_REDUCTIONS).find(k => lower(k) === lower(e.name))]?.any);
const guardsListed = () => interruptEntries().some(e => INTERRUPT_REDUCTIONS[Object.keys(INTERRUPT_REDUCTIONS).find(k => lower(k) === lower(e.name))]?.ally);

async function stampHold(receiptMessage, target, actor, damages, { multiplier, note }, found, { guarded = false } = {}) {
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  const amount = Math.floor(damages.reduce((n, d) => n + (Number(d.value) || 0), 0) * multiplier);
  const source = receiptMessage.getAssociatedActor?.() ?? null;
  // A guarded share (Interception): nobody reacts yet — the guards are asked, the one who
  // intercepts becomes the reactor (actorUuid) at the answer.
  const who = guarded ? { actorUuid: null, actorName: null, itemId: null, activityId: null, formula: null, guards: found.guards }
    : { actorUuid: actor.uuid, actorName: target.name ?? actor.name, itemId: found.item.id, activityId: found.activity.id, formula: found.formula };
  const flag = {
    status: "pending", ...who,
    reaction: found.name,
    receiptId: receiptMessage.id, target: { uuid: target.uuid, name: target.name ?? actor.name },
    damages: packDamages(damages), multiplier, note: note ?? null, amount,
    sourceName: source?.name ?? null, answer: null, reduceBy: 0, applied: false,
    ...statContext(source?.uuid ?? null),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  };
  const guardNames = guarded ? found.guards.map(g => g.actorName).join(" or ") : null;
  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({ img: guarded ? (resolveUuid(found.guards[0].actorUuid)?.items?.get(found.guards[0].itemId)?.img ?? null) : found.item.img,
      eyebrow: `Reaction — ${found.name}`, tone: "pending",
      title: `${target.name ?? actor.name} is about to take ${amount} damage`,
      subtitle: guarded ? `${guardNames} may intercept${source ? ` · from ${source.name}` : ""}` : (source ? `from ${source.name}` : "the damage waits for the answer") }),
    flags: { [MODULE_ID]: { [HOLD_FLAG]: flag } }
  });
  if ( message ) armTimer(message);
}

/* --- the keeper: the author, or the GM when the author has gone -------------------------------- */

const keeps = message => message.isAuthor || (!message.author?.active && isActiveGM());

function armTimer(message) {
  const flag = message?.getFlag(MODULE_ID, HOLD_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !keeps(message) ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( !live ) return;
    await queueFlagWrite(live, HOLD_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "resolved"; current.answer = "pass"; current.timedOut = true; current.answeredAt = Date.now();
    });
  });
}

/* --- the answer ------------------------------------------------------------------------------- */

/**
 * One answer folded onto the hold (the keeper's write and the relay's fold share it). A guarded
 * share (Interception, ruled P1): the first guard to intercept takes it and becomes the reactor; a
 * guard's pass is recorded and the share lands whole only once every guard has passed.
 */
function foldAnswer(current, { answer, reduceBy = 0, poolSpend = null, who = null }) {
  if ( current.status !== "pending" ) return false;
  if ( current.guards?.length ) {
    const guard = current.guards.find(g => g.actorUuid === who);
    if ( !guard || guard.passed ) return false;
    if ( answer !== "cast" ) {
      guard.passed = true;
      if ( current.guards.every(g => g.passed) ) Object.assign(current, { status: "resolved", answer: "pass", answeredAt: Date.now() });
      return;
    }
    Object.assign(current, { status: "resolved", answer, reduceBy: Number(reduceBy) || 0, poolSpend,
      actorUuid: guard.actorUuid, actorName: guard.actorName, itemId: guard.itemId, activityId: guard.activityId,
      formula: guard.formula, answeredAt: Date.now() });
    return;
  }
  Object.assign(current, { status: "resolved", answer, reduceBy: Number(reduceBy) || 0, poolSpend, answeredAt: Date.now() });
}

/** Cast: the roll in the open, the use and the Reaction spent HERE (their dice), the number folded or relayed. */
async function answerHold(message, answer, who = null) {
  if ( answering.has(message.id) ) return;
  answering.add(message.id);
  try {
    const flag = message.getFlag(MODULE_ID, HOLD_FLAG);
    if ( flag?.status !== "pending" ) return;
    // A guard answers for itself: its item, its formula, its Reaction.
    const guard = who ? (flag.guards ?? []).find(g => g.actorUuid === who) : null;
    if ( flag.guards?.length && !guard ) return;
    const mine = guard ?? flag;
    const actor = resolveUuid(mine.actorUuid);
    let reduceBy = 0;
    let poolSpend = null;
    if ( (answer === "cast") && (actor instanceof Actor) ) {
      const item = actor.items.get(mine.itemId);
      const activity = item?.system?.activities?.get(mine.activityId) ?? null;
      const pool = activity ? poolOf(actor, activity) : null;
      if ( pool && !(Number(pool.system?.uses?.value ?? 0) > 0) ) {
        ui.notifications.warn(`${TITLE}: ${actor.name} has no uses of ${flag.reaction} left.`);
        answer = "pass";
      } else {
        try {
          const roll = await new Roll(Roll.replaceFormulaData(String(mine.formula), actor.getRollData())).evaluate();
          await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${flag.reaction} — the die, plus the modifier` });
          reduceBy = Math.max(0, Number(roll.total) || 0);
        } catch(err) {
          console.error(`${TITLE} | ${flag.reaction}'s reduction could not be rolled — reduce by hand.`, err);
        }
        if ( pool ) poolSpend = await spendSuperiorityDie(actor, pool, flag.reaction).catch(() => null);
        await spendReaction(actor, { origin: item?.uuid ?? null, what: flag.reaction });
      }
    }
    if ( keeps(message) ) {
      await queueFlagWrite(message, HOLD_FLAG, current => foldAnswer(current, { answer, reduceBy, poolSpend, who }));
      return;
    }
    const name = mine.actorName ?? actor?.name ?? "";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({ img: actor?.items.get(mine.itemId)?.img ?? null, eyebrow: `Reaction — ${flag.reaction}`,
        tone: (answer === "cast") ? "good" : "neutral",
        title: (answer === "cast") ? `${flag.reaction} — ${name} reduces the damage${guard ? ` to ${flag.target?.name}` : ""} by ${reduceBy}`
          : guard ? `${name} lets it land` : `${name} takes it` }),
      flags: { [MODULE_ID]: { damageHoldAnswer: { messageId: message.id, answer, reduceBy, poolSpend, ...(who ? { who } : {}) } } }
    });
  } finally {
    answering.delete(message.id);
  }
}

registerRelay("damageHoldAnswer", {
  flagKey: HOLD_FLAG,
  targetOf: a => a.messageId,
  owns: (_flag, target) => keeps(target),
  fold: (current, a) => foldAnswer(current, { answer: a.answer, reduceBy: a.reduceBy, poolSpend: a.poolSpend ?? null, who: a.who ?? null })
});

/* --- the landing: the keeper applies the share, short by the roll ------------------------------ */

async function landHeld(message) {
  let claimed = false;
  await queueFlagWrite(message, HOLD_FLAG, current => {
    if ( (current.status !== "resolved") || current.applied || current.applying ) return false;
    current.applying = true;
    claimed = true;
  });
  if ( !claimed ) return;
  const flag = message.getFlag(MODULE_ID, HOLD_FLAG);
  const receipt = game.messages.get(flag.receiptId) ?? message;
  const multiplier = Number(flag.multiplier ?? 1);
  let damages = unpackDamages(flag.damages);
  let note = flag.note ?? undefined;
  let applyMultiplier = multiplier;
  const by = Number(flag.reduceBy) || 0;
  if ( (flag.answer === "cast") && (by > 0) ) {
    // The save's multiplier first, then the reduction (the rule's order); the system's own
    // resistances still apply as it lands the number.
    if ( multiplier !== 1 ) damages = damages.map(d => ({ ...d, value: Math.floor((Number(d.value) || 0) * multiplier) }));
    damages = reduceDamages(damages, by);
    applyMultiplier = 1;
    note = `${note ? `${note} · ` : ""}${flag.reaction}${flag.guards?.length ? ` (${flag.actorName})` : ""} — reduced by ${by}`;
  }
  try {
    await applyDamagesWithReceipt(receipt, [flag.target], damages, { multiplier: applyMultiplier, ...(note ? { note } : {}), held: true });
  } finally {
    await queueFlagWrite(message, HOLD_FLAG, current => { current.applied = true; current.applying = false; });
  }
}

registerResumable(HOLD_FLAG, {
  pending: flag => (flag?.status === "resolved") && !flag.applied && !flag.applying,
  drives: (_flag, message) => keeps(message),
  drive: landHeld
});

/* --- the popup and the card ------------------------------------------------------------------- */

/** A guard's popup (Interception, ruled P1): its own, keyed apart, closed by any intercept or its own pass. */
async function showGuardPopup(message, guard) {
  const flag = message.getFlag(MODULE_ID, HOLD_FLAG);
  if ( (flag?.status !== "pending") || guard.passed ) return;
  const actor = resolveUuid(guard.actorUuid);
  const row = INTERRUPT_REDUCTIONS[flag.reaction];
  await openMomentPopup(message, `${HOLD_FLAG}|${guard.actorUuid}`, actor, {
    title: `Reaction — ${flag.reaction}`, icon: "fa-solid fa-shield-halved",
    content: bfCard({ img: actor?.items.get(guard.itemId)?.img ?? null, eyebrow: `Reaction — ${flag.reaction}`, tone: "pending",
      title: `${flag.sourceName ?? "An attacker"} hits ${flag.target?.name} for ${flag.amount} — intercept?`,
      subtitle: `${flag.target?.name} is beside you · a Reaction`,
      lines: [ruleLine(esc(row?.rule ?? "")), `Reduce by ${esc(row?.by ?? guard.formula)}.`] })
      + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "cast", label: "Intercept", default: true, callback: () => { void answerHold(message, "cast", guard.actorUuid); } },
      { action: "pass", label: "Pass", callback: () => { void answerHold(message, "pass", guard.actorUuid); } }
    ]
  });
}

async function showPopup(message) {
  const flag = message.getFlag(MODULE_ID, HOLD_FLAG);
  if ( flag?.status !== "pending" ) return;
  if ( flag.guards?.length ) {
    for ( const guard of flag.guards ) if ( !guard.passed && canAnswerFor(resolveUuid(guard.actorUuid)) ) await showGuardPopup(message, guard);
    return;
  }
  const actor = resolveUuid(flag.actorUuid);
  const row = INTERRUPT_REDUCTIONS[flag.reaction];
  const pool = actor?.items.get(flag.itemId);
  const left = Number(pool?.system?.uses?.value ?? 0), max = Number(pool?.system?.uses?.max ?? 0);
  await openMomentPopup(message, HOLD_FLAG, actor, {
    title: `Reaction — ${flag.reaction}`, icon: "fa-solid fa-shield-halved",
    content: bfCard({ img: pool?.img ?? null, eyebrow: `Reaction — ${flag.reaction}`, tone: "pending",
      title: `${flag.reaction} — ${flag.actorName} may reduce ${flag.amount} damage`,
      subtitle: `${flag.sourceName ? `from ${flag.sourceName} · ` : ""}a Reaction${max > 0 ? ` · ${left} of ${max} uses left` : ""}`,
      lines: [ruleLine(esc(row?.rule ?? "")), `Reduce by ${esc(row?.by ?? flag.formula)}.`] })
      + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "cast", label: flag.reaction, default: true, callback: () => { void answerHold(message, "cast"); } },
      { action: "pass", label: "Take it", callback: () => { void answerHold(message, "pass"); } }
    ]
  });
}

/** The card's line — source, then result (law 6). */
function holdLine(flag) {
  const guarded = !!flag.guards?.length;
  const to = guarded ? ` to ${flag.target?.name}` : "";
  if ( flag.answer === "cast" ) return `${flag.reaction} — ${flag.actorName} reduces the damage${to} by ${flag.reduceBy}`;
  if ( flag.answer === "pass" ) return `${guarded ? flag.target?.name : flag.actorName} takes the damage${flag.timedOut ? " (timer)" : ""}`;
  if ( guarded ) return `${flag.reaction} — ${flag.guards.filter(g => !g.passed).map(g => g.actorName).join(" or ")} may reduce ${flag.amount} damage${to}; it waits for the answer`;
  return `${flag.reaction} — ${flag.actorName} may reduce ${flag.amount} damage; it waits for the answer`;
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, HOLD_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-damage-hold-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-damage-hold-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-shield-halved" data-tooltip="${esc(flag.reaction)}"></i> ${esc(holdLine(flag))}`;
    if ( flag.status === "pending" ) {
      div.insertAdjacentHTML("beforeend", ` ${holdBarHTML(flag, "to answer")}`);
      const actor = resolveUuid(flag.actorUuid);
      const mayAnswer = flag.guards?.length
        ? flag.guards.some(g => !g.passed && canAnswerFor(resolveUuid(g.actorUuid))) : canAnswerFor(actor);
      if ( mayAnswer ) {
        const shown = popupKey(message.id, HOLD_FLAG);
        if ( !shownMoments.has(shown) ) { shownMoments.add(shown); void showPopup(message); }
        div.appendChild(momentButton("Answer", () => { void showPopup(message); }));
      }
      scheduleBarSync(div);
      armTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The damage hold's line could not render.`, err); }
});

// An answer anywhere closes the popup everywhere (law 4); the clock stands down with it.
Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, HOLD_FLAG);
  if ( !flag ) return;
  if ( flag.status === "pending" ) { armTimer(message); closeGuardPopups(message, flag, false); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, HOLD_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
  closeGuardPopups(message, flag, true);
});

/** The guards' own popups: every one once the share is answered, a passed guard's at once. */
function closeGuardPopups(message, flag, all) {
  for ( const guard of (flag?.guards ?? []) ) {
    if ( !all && !guard.passed ) continue;
    const open = livePopups.get(popupKey(message.id, `${HOLD_FLAG}|${guard.actorUuid}`));
    if ( open ) { try { void open.close(); } catch { /* gone */ } }
  }
}

Hooks.on("deleteChatMessage", message => { disarmDeadline(timers, message.id); });
