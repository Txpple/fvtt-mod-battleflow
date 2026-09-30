/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the REBUKE — a Reaction to taking damage, at the
 * damager (registry.js REBUKES, decide/rebukes.js). Riposte's shape; Use drives the REAL use on the
 * answering client. The trigger is `dnd5e.applyDamage`, the one seam that knows the ORIGINATING
 * card (a raw HP edit offers nothing). "That you can see" is the table's.
 */
import { MODULE_ID, TITLE, keepsMessage, queueFlagWrite, canAnswerFor, statContext, decisionWindow } from "./core.js";
import { lower, itemNamed, activityNamed, cardActivity, resolveUuid, meleeOptions, preferredMeleeOption } from "./lookup.js";
import { rebukeEntries, listedNames } from "./decide/registry.js";
import { REBUKES } from "./decide/registry.js";
import { rebukeReach, rebukeBlocked, rebukeCost, rebukeLine, rebukeTypesAdmit } from "./decide/rebukes.js";
import { poolOf, reactionSpent, resolveAttackMessage, spendReaction, withTargets, hitTargets } from "./shared.js";
import { CARD, isCard, targetsOf } from "./decide/card.js";
import { isActiveGM } from "./core.js";
import { feetOf, nearestFeet, tokenForUuid } from "./geometry.js";
import { bfCard, esc, holdBarHTML, popupKey, ruleLine } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, scheduleBarSync, shownMoments,
  armDeadline, disarmDeadline, registerRelay } from "./ui.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const REBUKE_FLAG = "rebuke";
const timers = new Map();
const driving = new Set();

/* --- the offer's facts, off the bearer's sheet ------------------------------------------------ */

/** Does a spell slot stand that this spell can be cast with? Null when the item is not a slotted spell. */
function slotStands(actor, item) {
  if ( item?.type !== "spell" ) return null;
  const level = Number(item.system?.level ?? 0);
  if ( !(level > 0) ) return null;
  if ( !["spell", "pact"].includes(item.system?.method ?? "spell") ) return null;   // innate, at will: its uses
  const spells = actor.system?.spells ?? {};
  return Object.entries(spells).some(([key, s]) => {
    const at = (key === "pact") ? Number(s?.level ?? 0) : Number(key.replace(/^spell/, ""));
    return (at >= level) && (Number(s?.value ?? 0) > 0);
  });
}

/** The item's first REACTION activity, or the row's named one. */
function reactionActivity(item, row) {
  if ( row.activity ) return activityNamed(item, row.activity);
  return [...(item?.system?.activities ?? [])].find(a => a.activation?.type === "reaction") ?? null;
}

/** The rebukes this bearer may take at this damager now. `ward`: the WARD rows only (Sentinel, a
 * bystander to the hit); `attackHit`: the damage came from an attack. */
function offersFor(actor, source, { ward = false, attackHit = false, miss = false, damageTypes = [] } = {}) {
  const listed = listedNames(rebukeEntries());
  const bearer = tokenForUuid(actor.uuid);
  const damager = tokenForUuid(source.uuid);
  const distance = (bearer && damager) ? nearestFeet(bearer, damager) : null;
  const out = [];
  for ( const [name, row] of Object.entries(REBUKES) ) {
    if ( !listed.has(lower(name)) ) continue;
    if ( !!row.ward !== ward ) continue;
    if ( (row.on === "miss") !== miss ) continue;           // a miss row only on a miss, never on damage
    if ( row.hit && !attackHit ) continue;
    if ( !rebukeTypesAdmit(row.types, damageTypes) ) continue;
    const item = itemNamed(actor, name);
    if ( !item ) continue;
    const activity = reactionActivity(item, row);
    if ( !activity && !row.attack ) continue;
    const pool = activity ? poolOf(actor, activity) : null;
    // A spell with uses of its own (Fiendish Legacy): while a free cast is left, no slot is asked.
    const ownUses = (item.type === "spell") && (Number(item.system?.uses?.max) > 0);
    const usesMax = Number((pool ?? (ownUses ? item : null))?.system?.uses?.max ?? 0);
    const usesLeft = (usesMax > 0) ? Number((pool ?? item).system.uses.value ?? 0) : null;
    const free = (item.type === "spell") && (usesLeft !== null) && (usesLeft > 0);
    const reach = rebukeReach(row, activity ? feetOf(activity.range?.value, activity.range?.units) : null);
    const blocked = rebukeBlocked({
      self: actor.uuid === source.uuid, hp: Number(actor.system?.attributes?.hp?.value ?? 0),
      reactionSpent: reactionSpent(actor), distance, reach,
      usesLeft: (item.type === "spell") ? null : usesLeft,              // a spell with no free cast left may still take a slot
      slot: free ? null : slotStands(actor, item),
      whileStands: row.while ? actor.effects.some(e => !e.disabled && (lower(e.name) === lower(row.while))) : null,
      equipped: row.equipped ? !!item.system?.equipped : null,
      // a ward's: the one who hit stands on another side of the map (the tokens' dispositions)
      side: row.ward ? (!!bearer && !!damager && (bearer.document.disposition !== damager.document.disposition)) : null
    });
    if ( blocked ) continue;
    out.push({ name, itemId: item.id, activityId: activity?.id ?? null, img: item.img, reach,
      attack: row.attack ?? null, advantage: !!row.advantage, free, handUse: free && !pool,
      ...(row.opportunity ? { opportunity: true } : {}), ...(row.ward ? { ward: true } : {}),
      cost: rebukeCost({ usesLeft, usesMax, spell: !free && (slotStands(actor, item) !== null) }),
      ...(row.follow?.length ? { follow: [...row.follow] } : {}) });
  }
  return { distance, options: out };
}

/* --- the stamp: the damage landed ------------------------------------------------------------- */

listen("dnd5e.applyDamage", "rebukes", (actor, amount, options) => {
  try {
    if ( !(Number(amount) > 0) || !(actor instanceof Actor) ) return;
    const origin = options?.originatingMessage;
    if ( !(origin instanceof ChatMessage) ) return;
    if ( !listedNames(rebukeEntries()).size ) return;
    const source = origin.getAssociatedActor?.();
    if ( !(source instanceof Actor) || (source.uuid === actor.uuid) ) return;
    const attackHit = isAttackDamage(origin);
    // The damage's types, off the card's rolls (a `types` row); a card with none is unreadable and counts.
    const damageTypes = [...new Set((origin.rolls ?? []).map(r => r?.options?.type).filter(Boolean))];
    void stampRebuke(actor, source, Number(amount), origin, { attackHit, damageTypes });
    if ( attackHit ) void stampWards(actor, source, Number(amount), origin);
  } catch(err) {
    console.error(`${TITLE} | The rebuke offer failed — use the reaction from the sheet.`, err);
  }
});

/** Did this damage come from an attack's hit — its card's activity an attack, or chained to one? */
function isAttackDamage(origin) {
  if ( cardActivity(origin)?.type === "attack" ) return true;
  try { return !!resolveAttackMessage(origin); } catch { return false; }
}

async function stampRebuke(actor, source, amount, origin, { attackHit = false, ward = null, miss = false, damageTypes = [] } = {}) {
  const { distance, options } = offersFor(actor, source, { ward: !!ward, attackHit, miss, damageTypes });
  if ( !options.length ) return;
  const window = decisionWindow();
  const flag = {
    status: "pending", actorUuid: actor.uuid, actorName: actor.name,
    sourceUuid: source.uuid, sourceName: source.name, distance, amount, originId: origin.id,
    options, answer: null, choice: null,
    ...(ward ? { ward: true, targetUuid: ward.uuid, targetName: ward.name } : {}),
    ...(miss ? { miss: true } : {}),
    ...statContext(source.uuid),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  };
  const first = options[0];
  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({ img: first.img, eyebrow: `Reaction — ${options.map(o => o.name).join(" / ")}`, tone: "pending",
      title: ward ? `${source.name} hit ${ward.name}` : miss ? `${source.name} missed ${actor.name}` : `${source.name} damaged ${actor.name}`,
      subtitle: ward ? `${actor.name}${(distance !== null) ? ` · ${distance} ft from ${source.name}` : ""}`
        : miss ? `a melee weapon attack${(distance !== null) ? ` · ${distance} ft away` : ""}`
        : `${amount} damage${(distance !== null) ? ` · ${distance} ft away` : ""}` }),
    flags: { [MODULE_ID]: { [REBUKE_FLAG]: flag } }
  });
  if ( message ) armTimer(message);
}

/* --- the miss (Sticky Shield): a melee weapon attack that MISSED the bearer, stamped by the elect ---- */

listen("createChatMessage", "rebukes", async message => {
  try {
    if ( !isActiveGM() || !isCard(message, CARD.attack) ) return;
    if ( message.getFlag(MODULE_ID, "rebukeFor") ) return;            // a driven attack never chains re-offers
    const listed = listedNames(rebukeEntries());
    if ( !Object.entries(REBUKES).some(([name, row]) => (row.on === "miss") && listed.has(lower(name))) ) return;
    const activity = cardActivity(message);
    if ( (activity?.attack?.type?.value !== "melee") || (activity?.item?.type !== "weapon") ) return;
    const attacker = message.getAssociatedActor?.();
    if ( !(attacker instanceof Actor) ) return;
    const hitSet = new Set(hitTargets(message).map(t => t.uuid));
    for ( const t of targetsOf(message) ) {
      if ( hitSet.has(t.uuid) ) continue;
      const actor = await fromUuid(t.uuid).catch(() => null);
      if ( !(actor instanceof Actor) || (actor.uuid === attacker.uuid) ) continue;
      void stampRebuke(actor, attacker, 0, message, { miss: true });
    }
  } catch(err) {
    console.error(`${TITLE} | The miss rebuke offer failed — use the reaction from the sheet.`, err);
  }
});

/** THE WARDS (Sentinel's Guardian): asked of every OTHER holder in reach of the hitter, on another
 * side; one ask per bearer per dealing card. */
const wardsAsked = new Set();
async function stampWards(hurt, source, amount, origin) {
  const listed = listedNames(rebukeEntries());
  if ( !Object.entries(REBUKES).some(([name, row]) => row.ward && listed.has(lower(name))) ) return;
  const seen = new Set();
  for ( const t of canvas.tokens?.placeables ?? [] ) {
    const bearer = t.actor;
    if ( !bearer || seen.has(bearer.uuid) ) continue;
    seen.add(bearer.uuid);
    if ( (bearer.uuid === hurt.uuid) || (bearer.uuid === source.uuid) ) continue;
    const key = `${origin.id}|${bearer.uuid}`;
    if ( wardsAsked.has(key) ) continue;
    if ( !offersFor(bearer, source, { ward: true, attackHit: true }).options.length ) continue;
    wardsAsked.add(key);
    await stampRebuke(bearer, source, amount, origin, { attackHit: true, ward: { uuid: hurt.uuid, name: hurt.name } });
  }
}

/* --- who folds and who keeps the clock: the author, or the GM when the author has gone --------- */


function armTimer(message) {
  const flag = message?.getFlag(MODULE_ID, REBUKE_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !keepsMessage(message) ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( !live ) return;
    await queueFlagWrite(live, REBUKE_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "resolved"; current.answer = "pass"; current.timedOut = true; current.answeredAt = Date.now();
    });
  });
}

/* --- the answer ------------------------------------------------------------------------------- */

/** One answer: folded where this client may write, relayed otherwise; a Use drives the use HERE. */
async function answerRebuke(message, answer, index = null) {
  const flag = message.getFlag(MODULE_ID, REBUKE_FLAG);
  if ( flag?.status !== "pending" ) return;
  const option = (answer === "use") ? flag.options?.[index] : null;
  if ( (answer === "use") && !option ) return;
  if ( keepsMessage(message) ) {
    let claimed = false;
    await queueFlagWrite(message, REBUKE_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "resolved"; current.answer = answer; current.choice = option?.name ?? null; current.answeredAt = Date.now();
      claimed = true;
    });
    if ( claimed && option ) await driveRebuke(message, option);
    return;
  }
  // The relay carries the answer to the keeper; the drive runs here at once.
  const actor = resolveUuid(flag.actorUuid);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({ img: option?.img ?? null, eyebrow: `Reaction — ${option?.name ?? "Rebuke"}`,
      tone: option ? "good" : "neutral", title: rebukeLine({ ...flag, answer, choice: option?.name ?? null }) }),
    flags: { [MODULE_ID]: { rebukeAnswer: { messageId: message.id, answer, choice: option?.name ?? null } } }
  });
  if ( option ) await driveRebuke(message, option);
}

registerRelay("rebukeAnswer", {
  flagKey: REBUKE_FLAG,
  targetOf: a => a.messageId,
  owns: (_flag, target) => keepsMessage(target),
  fold: (current, a) => {
    if ( current.status !== "pending" ) return false;
    current.status = "resolved"; current.answer = a.answer; current.choice = a.choice ?? null; current.answeredAt = Date.now();
  }
});

/** THE DRIVE: the real use at the damager, aimed first so every card names it; the Reaction spent
 * after. An attack row rolls the attack; anything else is the ordinary pipeline's. */
async function driveRebuke(message, option) {
  const key = `${message.id}|${option.name}`;
  if ( driving.has(key) ) return;
  driving.add(key);
  try {
    const flag = message.getFlag(MODULE_ID, REBUKE_FLAG);
    const actor = resolveUuid(flag?.actorUuid);
    const damager = tokenForUuid(flag?.sourceUuid);
    if ( !(actor instanceof Actor) || !damager ) return;
    const item = actor.items.get(option.itemId);
    await withTargets([damager], async () => {
      let attack = null;
      if ( option.attack === "melee" ) {
        // Retaliation: one melee attack with the weapon last swung (Riposte's pick, lookup.js).
        const choice = preferredMeleeOption(actor, meleeOptions(actor));
        const weapon = choice ? actor.items.get(choice.itemId) : null;
        attack = weapon?.system?.activities?.get(choice.activityId) ?? null;
      } else {
        const activity = item?.system?.activities?.get(option.activityId) ?? null;
        if ( activity?.type !== "attack" ) {
          // The free cast: the activity's item-use target pays, else the spell's uses by hand.
          const usage = option.free ? { consume: { spellSlot: false } } : {};
          if ( activity ) {
            const done = await activity.use(usage, { configure: false }, { data: { flags: { [MODULE_ID]: { rebukeFor: message.id } } } });
            if ( done && option.handUse && item ) await item.update({ "system.uses.spent": Number(item.system.uses?.spent ?? 0) + 1 });
          }
          return;
        }
        attack = activity;
      }
      if ( !attack ) return;
      // An Opportunity Attack says so on its cards (Sentinel's Guardian): the Halt rider reads it.
      const oa = !!option.opportunity;
      const use = await attack.use({ subsequentActions: false }, { configure: false },
        { data: { flags: { [MODULE_ID]: { rebukeFor: message.id, ...(oa ? { opportunity: true } : {}) } } } });
      const usageId = use?.message?.id ?? null;
      await attack.rollAttack(option.advantage ? { advantage: true } : {}, { configure: false },
        { data: { ...(usageId ? { "system.origin": usageId } : {}), flags: { [MODULE_ID]: { rebukeFor: message.id, ...(oa ? { opportunity: true } : {}) } } } });
    });
    await spendReaction(actor, { origin: item?.uuid ?? null, what: option.name });
  } catch(err) {
    console.error(`${TITLE} | ${option.name} could not be driven — use it from the sheet.`, err);
  } finally {
    driving.delete(key);
  }
}

/* --- the popup and the card ------------------------------------------------------------------- */

async function showPopup(message) {
  const flag = message.getFlag(MODULE_ID, REBUKE_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  const lines = flag.options.flatMap(o => [`<strong>${esc(o.name)}</strong> · ${esc(o.cost)} · reach ${o.reach} ft`,
    ruleLine(REBUKES[o.name]?.rule ?? ""), ...(REBUKES[o.name]?.caveat ? [`<em>${esc(REBUKES[o.name].caveat)} — the table's call</em>`] : [])]);
  await openMomentPopup(message, REBUKE_FLAG, actor, {
    title: `Reaction — ${flag.actorName}`, icon: "fa-solid fa-bolt",
    content: bfCard({ img: flag.options[0]?.img ?? null, eyebrow: `Reaction — ${flag.options.map(o => o.name).join(" / ")}`, tone: "pending",
      title: flag.ward ? `${flag.sourceName} hit ${flag.targetName} — strike?` : `${flag.sourceName} damaged you — answer?`,
      subtitle: flag.ward ? `${flag.sourceName} is ${flag.distance} ft from you — an Opportunity Attack`
        : `${flag.amount} damage${(flag.distance !== null) ? ` · ${flag.distance} ft away` : ""}`, lines })
      + holdBarHTML(flag, "to answer"),
    buttons: [
      ...flag.options.map((o, i) => ({ action: `use-${i}`, label: o.name, default: i === 0, callback: () => { void answerRebuke(message, "use", i); } })),
      { action: "pass", label: "Pass", callback: () => { void answerRebuke(message, "pass"); } }
    ]
  });
}

listen("dnd5e.renderChatMessage", "rebukes", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, REBUKE_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-rebuke-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-rebuke-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-bolt" data-tooltip="Reaction"></i> ${esc(rebukeLine(flag))}`;
    // B4 — `follow` (Misty Escape's Steps): once the answer is driven, the feature's follow-up activities as buttons, the pick the owner's.
    const used = (flag.status === "resolved") && (flag.answer === "use") ? (flag.options ?? []).find(o => o.name === flag.choice) : null;
    if ( used?.follow?.length && !flag.followed ) {
      const actor = resolveUuid(flag.actorUuid);
      const item = actor?.items?.get(used.itemId) ?? null;
      if ( item && canAnswerFor(actor) ) {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:0.35rem;align-items:center;margin-top:0.3rem;flex-wrap:wrap;";
        const label = document.createElement("span");
        label.style.opacity = "0.8";
        label.textContent = `${used.name} — then:`;
        row.appendChild(label);
        for ( const name of used.follow ) {
          const act = activityNamed(item, name);
          if ( !act ) continue;
          row.appendChild(momentButton(name, () => void (async () => {
            await act.use({}, { configure: false }, {});
            if ( message.canUserModify?.(game.user, "update") ) await message.setFlag(MODULE_ID, REBUKE_FLAG, { ...message.getFlag(MODULE_ID, REBUKE_FLAG), followed: name });
          })().catch(err => console.error(`${TITLE} | ${name} could not be used — use it from the sheet.`, err))));
        }
        div.appendChild(row);
      }
    } else if ( flag.followed ) {
      div.insertAdjacentHTML("beforeend", ` · ${esc(flag.followed)}`);
    }
    if ( flag.status === "pending" ) {
      div.insertAdjacentHTML("beforeend", ` ${holdBarHTML(flag, "to answer")}`);
      const actor = resolveUuid(flag.actorUuid);
      if ( canAnswerFor(actor) ) {
        const shown = popupKey(message.id, REBUKE_FLAG);
        if ( !shownMoments.has(shown) ) { shownMoments.add(shown); void showPopup(message); }
        div.appendChild(momentButton("Answer", () => { void showPopup(message); }));
      }
      scheduleBarSync(div);
      armTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The rebuke line could not render.`, err); }
});

// An answer anywhere closes the popup everywhere (law 4); the clock stands down with it.
listen("updateChatMessage", "rebukes", message => {
  const flag = message.getFlag(MODULE_ID, REBUKE_FLAG);
  if ( !flag ) return;
  if ( flag.status === "pending" ) { armTimer(message); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, REBUKE_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

listen("deleteChatMessage", "rebukes", message => { disarmDeadline(timers, message.id); });
