/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the REBUKE — a Reaction to taking damage, aimed at
 * the creature that dealt it (decide/registry.js REBUKES, arithmetic in decide/rebukes.js). The
 * shape is Riposte's: a popup, a card with the bar, a clock that passes; Use drives the REAL use at
 * the damager on the answering client, and the ordinary pipeline does the rest.
 *
 * The trigger is `dnd5e.applyDamage` — the one seam that knows the ORIGINATING card, and so the
 * damager. Native buttons pass it too; a raw HP edit names no source and offers nothing. The
 * applying client stamps the card and folds answers (or the active GM, with the author gone).
 * The gate (decide/rebukes.js rebukeBlocked) reads facts only; "that you can see" is the table's.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { lower, itemNamed, activityNamed, cardActivity, resolveUuid, meleeOptions, preferredMeleeOption } from "./lookup.js";
import { rebukeEntries, listedNames } from "./settings.js";
import { REBUKES } from "./decide/registry.js";
import { rebukeReach, rebukeBlocked, rebukeCost, rebukeLine } from "./decide/rebukes.js";
import { poolOf, reactionSpent, resolveAttackMessage, spendReaction, withTargets } from "./shared.js";
import { feetOf, nearestFeet, tokenForUuid } from "./geometry.js";
import { bfCard, esc, holdBarHTML, popupKey, ruleLine } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, scheduleBarSync, shownMoments,
  armDeadline, disarmDeadline, registerRelay } from "./ui.js";
import { SURFACES } from "./surfaces.js";

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

/**
 * Every listed rebuke this bearer may take at this damager, right now — the options its popup offers.
 * `ward`: the WARD rows only (Sentinel — the bearer a bystander to a hit on someone else), else the
 * bearer's own rebukes only; `attackHit`: the damage came from an attack (a `hit` row's need).
 */
function offersFor(actor, source, { ward = false, attackHit = false } = {}) {
  const listed = listedNames(rebukeEntries());
  const bearer = tokenForUuid(actor.uuid);
  const damager = tokenForUuid(source.uuid);
  const distance = (bearer && damager) ? nearestFeet(bearer, damager) : null;
  const out = [];
  for ( const [name, row] of Object.entries(REBUKES) ) {
    if ( !listed.has(lower(name)) ) continue;
    if ( !!row.ward !== ward ) continue;
    if ( row.hit && !attackHit ) continue;
    const item = itemNamed(actor, name);
    if ( !item ) continue;
    const activity = reactionActivity(item, row);
    if ( !activity && !row.attack ) continue;
    const pool = activity ? poolOf(actor, activity) : null;
    // A SPELL WITH USES OF ITS OWN (Fiendish Legacy's Hellish Rebuke "once without a spell slot"):
    // while a free cast is left no slot is asked for — the drive casts slotless and the use pays
    // (`free`). With none left, a slot is.
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
      cost: rebukeCost({ usesLeft, usesMax, spell: !free && (slotStands(actor, item) !== null) }) });
  }
  return { distance, options: out };
}

/* --- the stamp: the damage landed ------------------------------------------------------------- */

Hooks.on("dnd5e.applyDamage", (actor, amount, options) => {
  try {
    if ( !(Number(amount) > 0) || !(actor instanceof Actor) ) return;
    const origin = options?.originatingMessage;
    if ( !(origin instanceof ChatMessage) ) return;
    if ( !listedNames(rebukeEntries()).size ) return;
    const source = origin.getAssociatedActor?.();
    if ( !(source instanceof Actor) || (source.uuid === actor.uuid) ) return;
    const attackHit = isAttackDamage(origin);
    void stampRebuke(actor, source, Number(amount), origin, { attackHit });
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

async function stampRebuke(actor, source, amount, origin, { attackHit = false, ward = null } = {}) {
  const { distance, options } = offersFor(actor, source, { ward: !!ward, attackHit });
  if ( !options.length ) return;
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  const flag = {
    status: "pending", actorUuid: actor.uuid, actorName: actor.name,
    sourceUuid: source.uuid, sourceName: source.name, distance, amount, originId: origin.id,
    options, answer: null, choice: null,
    ...(ward ? { ward: true, targetUuid: ward.uuid, targetName: ward.name } : {}),
    ...statContext(source.uuid),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  };
  const first = options[0];
  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({ img: first.img, eyebrow: `Reaction — ${options.map(o => o.name).join(" / ")}`, tone: "pending",
      title: ward ? `${source.name} hit ${ward.name}` : `${source.name} damaged ${actor.name}`,
      subtitle: ward ? `${actor.name}${(distance !== null) ? ` · ${distance} ft from ${source.name}` : ""}`
        : `${amount} damage${(distance !== null) ? ` · ${distance} ft away` : ""}` }),
    flags: { [MODULE_ID]: { [REBUKE_FLAG]: flag } }
  });
  if ( message ) armTimer(message);
}

/**
 * THE WARDS (Sentinel's Guardian: an Opportunity Attack when a creature within 5 feet hits a
 * target other than you): the same damage landing, asked of every OTHER creature holding a listed
 * ward row, within reach of the hitter and on another side from it (offersFor). One ask per bearer
 * per dealing card — a second application of the same damage asks nothing more.
 */
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

const keeps = message => message.isAuthor || (!message.author?.active && isActiveGM());

function armTimer(message) {
  const flag = message?.getFlag(MODULE_ID, REBUKE_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !keeps(message) ) return;
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
  if ( keeps(message) ) {
    let claimed = false;
    await queueFlagWrite(message, REBUKE_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "resolved"; current.answer = answer; current.choice = option?.name ?? null; current.answeredAt = Date.now();
      claimed = true;
    });
    if ( claimed && option ) await driveRebuke(message, option);
    return;
  }
  // The relay: the answer travels as the answerer's own card and the keeper folds it; the drive
  // runs here at once — waiting for the round trip would idle their dice.
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
  owns: (_flag, target) => keeps(target),
  fold: (current, a) => {
    if ( current.status !== "pending" ) return false;
    current.status = "resolved"; current.answer = a.answer; current.choice = a.choice ?? null; current.answeredAt = Date.now();
  }
});

/**
 * THE DRIVE — the real use at the damager, on the answering client: aimed first, so every card in
 * the sequence names it; the Reaction spent after. An attack row rolls the attack (Advantage where
 * the row says so) and auto-damage carries it; any other activity's use is the ordinary pipeline's.
 */
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
          // The free cast: no slot; the use pays — through the activity's own item-use target when
          // it has one, by hand when the uses sit on the spell with no target naming them.
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
    ruleLine(esc(REBUKES[o.name]?.rule ?? "")), ...(REBUKES[o.name]?.caveat ? [`<em>${esc(REBUKES[o.name].caveat)} — the table's call</em>`] : [])]);
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

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, REBUKE_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-rebuke-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-rebuke-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-bolt" data-tooltip="Reaction"></i> ${esc(rebukeLine(flag))}`;
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
Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, REBUKE_FLAG);
  if ( !flag ) return;
  if ( flag.status === "pending" ) { armTimer(message); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, REBUKE_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

Hooks.on("deleteChatMessage", message => { disarmDeadline(timers, message.id); });
