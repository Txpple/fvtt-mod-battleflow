/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the REBUKE — a Reaction to taking damage, aimed at
 * the creature that dealt it (the Goliath walk, 2026-09-25: "Storms thunder is not triggering
 * anything. when you fix it, also make sure the 60ft range calc is in there. Also … pick up
 * hellish rebuke and anything else in that family"). The table is decide/registry.js REBUKES, the
 * arithmetic decide/rebukes.js.
 *
 * THE SHAPE IS RIPOSTE'S (riposte.js): the defender is offered a strike back, a popup to the one
 * who answers for it, a card with the same bar, a clock that passes; Use drives the REAL use at the
 * attacker on the answering client (their dice, their slot), so everything after is the ordinary
 * pipeline — a bare damage activity is rolled by damage-casts.js and applied by
 * hold/spell-damage.js with its receipt (Storm's Thunder), a save activity demands through the
 * saves machine (Hellish Rebuke, Fount of Moonlight), an attack rolls and auto-damage takes it from
 * there (Sword of Answering; Retaliation with the weapon last swung).
 *
 * THE TRIGGER IS THE DAMAGE LANDING: dnd5e.applyDamage, on the client that applied it — the one
 * seam that knows the ORIGINATING card, and so the creature behind the damage (its speaker). Both
 * the module's own applier (auto-apply.js, the originatingMessage it passes) and the card's native
 * buttons pass it, so hand-applied damage offers too; a raw HP edit names no source and offers
 * nothing (the honest floor, concentration.js's). That client stamps the card: it is the moment's
 * author and folds the answers (the relay), or, with the author gone, the active GM does.
 *
 * WHAT THE GATE READS (decide/rebukes.js rebukeBlocked), all facts: the bearer up after the damage,
 * its Reaction unspent, the row's `while` effect standing, the item held when it must be, a use or
 * a slot left, and the damager within the reaction's own reach — measured token to token on the
 * grid (geometry.js nearestFeet), a Large body from its nearest square. "That you can see" is the
 * table's (the row's caveat, said on the popup).
 * ------------------------------------------------------------------------------------------- */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { lower, itemNamed, activityNamed, resolveUuid, meleeOptions, preferredMeleeOption } from "./lookup.js";
import { rebukeEntries, listedNames } from "./settings.js";
import { REBUKES } from "./decide/registry.js";
import { rebukeReach, rebukeBlocked, rebukeCost, rebukeLine } from "./decide/rebukes.js";
import { poolOf, reactionSpent, spendReaction, withTargets } from "./shared.js";
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

/** Every listed rebuke this bearer may take at this damager, right now — the options its popup offers. */
function offersFor(actor, source) {
  const listed = listedNames(rebukeEntries());
  const bearer = tokenForUuid(actor.uuid);
  const damager = tokenForUuid(source.uuid);
  const distance = (bearer && damager) ? nearestFeet(bearer, damager) : null;
  const out = [];
  for ( const [name, row] of Object.entries(REBUKES) ) {
    if ( !listed.has(lower(name)) ) continue;
    const item = itemNamed(actor, name);
    if ( !item ) continue;
    const activity = reactionActivity(item, row);
    if ( !activity && !row.attack ) continue;
    const pool = activity ? poolOf(actor, activity) : null;
    // A SPELL WITH USES OF ITS OWN (the Tiefling walk, 2026-09-25: "hellish rebuke did not trigger"):
    // Fiendish Legacy grants Hellish Rebuke "once without a spell slot" per Long Rest — the spell
    // item's own uses — and a Fighter has no slots at all. While a free cast is left, the slot is not
    // asked for; the drive casts it slotless and the use pays (`free`). With none left, a slot is.
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
      equipped: row.equipped ? !!item.system?.equipped : null
    });
    if ( blocked ) continue;
    out.push({ name, itemId: item.id, activityId: activity?.id ?? null, img: item.img, reach,
      attack: row.attack ?? null, advantage: !!row.advantage, free, handUse: free && !pool,
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
    void stampRebuke(actor, source, Number(amount), origin);
  } catch(err) {
    console.error(`${TITLE} | The rebuke offer failed — use the reaction from the sheet.`, err);
  }
});

async function stampRebuke(actor, source, amount, origin) {
  const { distance, options } = offersFor(actor, source);
  if ( !options.length ) return;
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  const flag = {
    status: "pending", actorUuid: actor.uuid, actorName: actor.name,
    sourceUuid: source.uuid, sourceName: source.name, distance, amount, originId: origin.id,
    options, answer: null, choice: null,
    ...statContext(source.uuid),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  };
  const first = options[0];
  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({ img: first.img, eyebrow: `Reaction — ${options.map(o => o.name).join(" / ")}`, tone: "pending",
      title: `${source.name} damaged ${actor.name}`, subtitle: `${amount} damage${(distance !== null) ? ` · ${distance} ft away` : ""}` }),
    flags: { [MODULE_ID]: { [REBUKE_FLAG]: flag } }
  });
  if ( message ) armTimer(message);
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
  // The relay (riposte's §4.1 split): the answer travels as the answerer's own card, the keeper
  // folds it; the drive runs here at once — waiting for the round trip would idle their dice.
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
          // The free cast (2026-09-25): no slot; the use pays — through the activity's own item-use
          // target when it has one, by hand when the uses sit on the spell with no target naming them.
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
      const use = await attack.use({ subsequentActions: false }, { configure: false }, { data: { flags: { [MODULE_ID]: { rebukeFor: message.id } } } });
      const usageId = use?.message?.id ?? null;
      await attack.rollAttack(option.advantage ? { advantage: true } : {}, { configure: false },
        { data: { ...(usageId ? { "system.origin": usageId } : {}), flags: { [MODULE_ID]: { rebukeFor: message.id } } } });
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
      title: `${flag.sourceName} damaged you — answer?`,
      subtitle: `${flag.amount} damage${(flag.distance !== null) ? ` · ${flag.distance} ft away` : ""}`, lines })
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
