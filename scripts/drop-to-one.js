/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): DROP TO 1 HP (DROP_TO_ONE; RULINGS *Where the table
 * bends the rule*). A row that ASKS (Relentless Endurance) holds the HP at 1 while its popup asks
 * — not offered when the damage kills outright; an automatic row (Death Ward) stops at 1 and ends
 * its effect; a `save` row (Undead Fortitude, the GM's side) holds at 1 while the bearer's save rolls on the
 * keeper — the dice decide (R1), a failure lands the 0. A `died` row (Death Throes) is THE DEATH'S SIDE:
 * when the damage leaves the bearer at 0 and nothing held it, its save is used at the corpse against
 * every creature in its Emanation — one demand card, the saves machine from there.
 * THE SEAM is `dnd5e.preApplyDamage` — synchronous, with the update in hand, on every application
 * path — so the 1 is written in the same update and the creature never touches 0; the landed 0 is
 * seen at `dnd5e.applyDamage`, after the write.
 * THE KEEPER of an ask is the client that applied the damage, or the GM once it has gone; any
 * other answer is relayed to it.
 */
import { MODULE_ID, TITLE, keepsMessage, queueFlagWrite, canAnswerFor, statContext, decisionWindow } from "./core.js";
import { featureNamed, lower, resolveUuid, activityNamed, activityOfType, applicableProfiles } from "./lookup.js";
import { dropToOneEntries, listedNames } from "./decide/registry.js";
import { DROP_TO_ONE } from "./decide/registry.js";
import { dropSaveDc, dropSaveExempt, dropSaveTitle, diedTitle } from "./decide/drop-to-one.js";
import { saveDemandData, saveTargetEntry } from "./decide/demand.js";
import { bfCard, esc, holdBarHTML, popupKey, ruleLine } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, scheduleBarSync, shownMoments,
  armDeadline, disarmDeadline, registerRelay, registerResumable } from "./ui.js";
import { resolveAttackMessage } from "./shared.js";
import { creaturesWithin, feetOf, tokenOfActor } from "./geometry.js";
import { rollDamageForSave } from "./auto-damage.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const DROP_FLAG = "dropToOne";
const HP = "system.attributes.hp.value";
const timers = new Map();
const answering = new Set();
/** Actors with an ask standing — a second drop while it stands lands as it would. Client-local. */
const asking = new Set();
/** Actors whose 0 is about to land with a `died` row on the sheet: stamped before the write, read after it. */
const dying = new Map();

/** The first listed row this actor holds that can act now — `{ name, row, item?, effect? }` or null.
 * A `died` row never holds: it is the death's side (`diedRowsFor`). */
function rowFor(actor, { outright }) {
  const on = listedNames(dropToOneEntries());
  for ( const [name, row] of Object.entries(DROP_TO_ONE) ) {
    if ( !on.has(lower(name)) || (row.on === "died") ) continue;
    if ( outright && !row.outright ) continue;
    if ( row.effect ) {
      const effect = actor.effects.find(e => !e.disabled && !e.isSuppressed && (lower(e.name) === lower(row.effect)));
      if ( effect ) return { name, row, effect };
      continue;
    }
    const item = featureNamed(actor, name);
    if ( !item ) continue;
    if ( row.uses && !(Number(item.system?.uses?.value ?? 0) > 0) ) continue;
    return { name, row, item };
  }
  return null;
}

/** The listed `died` rows this actor holds — `{ name, row, item }[]`. */
function diedRowsFor(actor) {
  const on = listedNames(dropToOneEntries());
  const out = [];
  for ( const [name, row] of Object.entries(DROP_TO_ONE) ) {
    if ( (row.on !== "died") || !on.has(lower(name)) ) continue;
    const item = featureNamed(actor, name);
    if ( item ) out.push({ name, row, item });
  }
  return out;
}

/** What the damage card says about the damage: its types, and whether it came off a Critical Hit. A card the
 * module cannot read is `readable: false` — the row counts (the gate never guesses an exemption). */
function damageFacts(message) {
  try {
    if ( !(message instanceof ChatMessage) ) return { readable: false, types: [], crit: false };
    const rolls = message.rolls ?? [];
    const types = [...new Set(rolls.map(r => r?.options?.type).filter(Boolean))];
    let crit = rolls.some(r => r?.isCritical === true);
    if ( !crit ) {
      let attack = null;
      try { attack = resolveAttackMessage(message); } catch { attack = null; }
      crit = !!attack?.rolls?.[0]?.isCritical;
    }
    return { readable: types.length > 0, types, crit };
  } catch {
    return { readable: false, types: [], crit: false };
  }
}

listen("dnd5e.preApplyDamage", "drop-to-one", (actor, amount, updates, options) => {
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
    const source = options?.originatingMessage?.getAssociatedActor?.() ?? null;
    if ( !found ) { markDying(actor, { amount, source }); return; }
    if ( found.row.save ) {
      const facts = damageFacts(options?.originatingMessage ?? null);
      const { exempt, why } = dropSaveExempt(found.row.save.unless, facts);
      if ( exempt ) {
        void exemptCard(actor, found, why, { amount, source });
        markDying(actor, { amount, source });
        return;
      }
      updates[HP] = 1;                                                 // held at 1 while the dice roll
      asking.add(actor.uuid);
      void rollDropSave(actor, found, { amount, source, dc: dropSaveDc(found.row.save.dc, amount) })
        .catch(err => { asking.delete(actor.uuid); console.error(`${TITLE} | ${found.name}'s save failed — the creature stays at 1 HP; set it by hand.`, err); });
      return;
    }
    updates[HP] = 1;                                                   // held at 1, in this very update
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
    content: bfCard({ img: found.effect?.img ?? found.item?.img ?? null, eyebrow: found.name, tone: "good",
      title: `${actor.name} drops to 1 Hit Point instead`, subtitle: found.row.ends ? "the spell ends" : "",
      lines: [ruleLine(found.row.rule), found.row.caveat ? `<span style="opacity:0.8;">${found.row.caveat}</span>` : null] }),
    flags: { [MODULE_ID]: { [DROP_FLAG]: { status: "resolved", answer: "auto", row: found.name, actorUuid: actor.uuid,
      actorName: actor.name, amount, applied: true, ...statContext(source?.uuid ?? null) } } }
  });
}

/* --- the `save` row: the dice decide (Undead Fortitude) ------------------------------------------- */

/** The damage set the row aside (Radiant, a Critical Hit): the 0 lands, the card says why. */
async function exemptCard(actor, found, why, { amount, source }) {
  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({ img: found.item?.img ?? null, eyebrow: found.name, tone: "neutral",
        title: `${actor.name} drops to 0 — ${found.name} does not apply`, subtitle: `${why}: no save`,
        lines: [ruleLine(found.row.rule)] }),
      flags: { [MODULE_ID]: { [DROP_FLAG]: { status: "resolved", answer: "exempt", why, row: found.name, actorUuid: actor.uuid,
        actorName: actor.name, amount, applied: true, ...statContext(source?.uuid ?? null) } } }
    });
  } catch(err) { console.warn(`${TITLE} | ${found.name}'s card could not post.`, err); }
}

/** The bearer's save, rolled here on the keeper with the computed DC; the verdict lands the 1 or the 0. */
async function rollDropSave(actor, found, { amount, source, dc }) {
  const ability = found.row.save.ability;
  let total = null;
  try {
    const rolls = await actor.rollSavingThrow({ ability, target: dc }, { configure: false },
      { data: { flags: { [MODULE_ID]: { dropToOneSave: { row: found.name, actorUuid: actor.uuid, dc } } } } });
    const t = Number(rolls?.[0]?.total);
    total = Number.isFinite(t) ? t : null;
  } catch(err) {
    console.error(`${TITLE} | ${found.name}'s save did not roll — the creature stays at 1 HP; roll it by hand.`, err);
  }
  const saved = (total !== null) && (total >= dc);
  try {
    if ( !saved && (total !== null) && (Number(actor.system.attributes.hp.value) === 1) ) {
      // Only the 1 the roll held: a heal in between is left alone.
      await actor.update({ [HP]: 0 });
    }
  } finally {
    asking.delete(actor.uuid);
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({ img: found.item?.img ?? null, eyebrow: found.name, tone: saved ? "good" : "bad",
      title: dropSaveTitle({ name: actor.name, saved, total, dc }),
      subtitle: `Constitution save, DC 5 + ${Number(amount)} damage`,
      lines: [ruleLine(found.row.rule)] }),
    flags: { [MODULE_ID]: { [DROP_FLAG]: { status: "resolved", answer: (total === null) ? "unrolled" : saved ? "saved" : "failed",
      row: found.name, actorUuid: actor.uuid, actorName: actor.name, amount, applied: true,
      save: { ability, dc, total }, ...statContext(source?.uuid ?? null) } } }
  });
  if ( !saved && (total !== null) ) await landedZero(actor, { amount, source });
}

/* --- the `died` row: the death's side (Death Throes) --------------------------------------------- */

/** Stamped before the write when a `died` row stands; `dnd5e.applyDamage` reads it after. */
function markDying(actor, ctx) {
  if ( diedRowsFor(actor).length ) dying.set(actor.uuid, ctx);
}

listen("dnd5e.applyDamage", "drop-to-one", (actor, _amount, _options) => {
  try {
    const ctx = dying.get(actor?.uuid);
    if ( !ctx ) return;
    dying.delete(actor.uuid);
    if ( Number(actor.system?.attributes?.hp?.value ?? 1) > 0 ) return;   // something else held it
    void landedZero(actor, ctx);
  } catch(err) {
    console.error(`${TITLE} | The death's side failed — use the trait by hand.`, err);
  }
});

/** The 0 landed and nothing held it: every listed `died` row fires at the corpse. */
async function landedZero(actor, { source }) {
  for ( const found of diedRowsFor(actor) ) {
    try {
      const item = found.item;
      // A `notice` row: the death's side is the GM's move (the vampire's mist) — the card says what, nothing is used.
      if ( found.row.notice ) {
        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: bfCard({ img: item.img ?? null, eyebrow: found.name, tone: "neutral",
            title: `${actor.name} drops to 0 — ${found.name}`, subtitle: found.row.notice,
            lines: [ruleLine(found.row.rule), found.row.caveat ? `<span style="opacity:0.8;">${found.row.caveat}</span>` : null] }),
          flags: { [MODULE_ID]: { deathThroes: { ...statContext(actor.uuid), key: found.name, actorUuid: actor.uuid, sourceUuid: source?.uuid ?? null, count: 0, feet: 0, notice: true } } }
        });
        continue;
      }
      const activity = found.row.activity ? activityNamed(item, found.row.activity) : activityOfType(item, "save");
      const dc = activity?.save?.dc?.value;
      const abilities = [...(activity?.save?.ability ?? [])];
      if ( !activity || !(dc > 0) || !abilities.length ) { console.warn(`${TITLE} | ${found.name}: no save activity on ${actor.name}'s sheet — use it by hand.`); continue; }
      const corpse = tokenOfActor(actor);
      const feet = feetOf(Number(activity.target?.template?.size), activity.target?.template?.units || "ft");
      if ( !corpse || !(feet > 0) ) { console.warn(`${TITLE} | ${found.name}: ${actor.name} has no token in view, or its activity no Emanation — use it by hand.`); continue; }
      const victims = creaturesWithin(corpse, feet);
      const entries = (await applicableProfiles(activity)).map(({ profile, effect }) => ({ onSave: profile.onSave, effect }));
      const effectNames = { fail: entries.filter(e => !e.onSave).map(e => e.effect.name), always: entries.filter(e => e.onSave).map(e => e.effect.name) };
      const onSave = activity.damage?.onSave ?? "half";
      const hasDamage = !!activity.damage?.parts?.length && (onSave !== "full");
      const window = decisionWindow();
      const abilityLabel = CONFIG.DND5E.abilities[abilities[0]]?.label ?? abilities[0];
      const content = bfCard({ img: item.img ?? null, eyebrow: found.name, tone: "bad",
        title: diedTitle({ row: found.name, name: actor.name, count: victims.length }),
        subtitle: `${abilityLabel} save DC ${dc} · ${feet}-foot Emanation${hasDamage ? ` · ${onSave === "half" ? "half on a success" : "none on a success"}` : ""}`,
        lines: [ruleLine(found.row.rule)] });
      const throes = { ...statContext(actor.uuid), key: found.name, actorUuid: actor.uuid, sourceUuid: source?.uuid ?? null, count: victims.length, feet };
      if ( !victims.length ) {
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor, token: corpse.document }), content, flags: { [MODULE_ID]: { deathThroes: throes } } });
        continue;
      }
      const card = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor, token: corpse.document }),
        content,
        flags: { [MODULE_ID]: {
          saves: saveDemandData({
            stat: statContext(actor.uuid),
            abilities, dc, damageOnSave: onSave, hasDamage, effectNames,
            demand: { spell: !!activity.item?.system?.properties?.has?.("mgc"), abilities,
              statuses: [...new Set(entries.filter(e => !e.onSave).flatMap(e => [...(e.effect?.statuses ?? [])]))], sleep: false },
            // ⚠ Pinned: the area adoption keys on the activity and would rewrite the targets.
            pinnedTargets: true,
            activityUuid: activity.uuid, templateType: null, templated: false,
            durationUnits: activity.duration?.units ?? null,
            item: { name: item.name, img: item.img ?? null }, casterName: actor.name,
            window, deadline: window ? Date.now() + (window * 1000) : null,
            targets: victims.map(t => saveTargetEntry(t.actor.uuid, t.name))
          }),
          deathThroes: throes
        } }
      });
      if ( hasDamage && card ) await rollDamageForSave(activity, card);
    } catch(err) {
      console.error(`${TITLE} | ${found.name} failed — use the trait by hand.`, err);
    }
  }
}

/* --- the ask (Relentless Endurance) --------------------------------------------------------------- */

async function stampAsk(actor, found, { amount, source }) {
  const window = decisionWindow();
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

// The keeper.


function armTimer(message) {
  const flag = message?.getFlag(MODULE_ID, DROP_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !keepsMessage(message) ) return;
  armDeadline(timers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    if ( !live ) return;
    await queueFlagWrite(live, DROP_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      Object.assign(current, { status: "resolved", answer: "pass", timedOut: true, answeredAt: Date.now() });
    });
  });
}

// The answer: folded by the keeper, relayed by anyone else.

async function answer(message, choice) {
  if ( answering.has(message.id) ) return;
  answering.add(message.id);
  try {
    const flag = message.getFlag(MODULE_ID, DROP_FLAG);
    if ( flag?.status !== "pending" ) return;
    if ( keepsMessage(message) ) {
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
  owns: (_flag, target) => keepsMessage(target),
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
  let fell = false;
  try {
    if ( actor instanceof Actor ) {
      if ( flag.answer === "use" ) {
        const item = actor.items.get(flag.itemId);
        if ( item ) await item.update({ "system.uses.spent": Number(item.system.uses?.spent ?? 0) + 1 });
      } else if ( Number(actor.system.attributes.hp.value) === 1 ) {
        // Only the 1 the ask held: a heal in between is left alone.
        await actor.update({ [HP]: 0 });
        fell = true;
      }
    }
  } finally {
    asking.delete(flag.actorUuid);
    await queueFlagWrite(message, DROP_FLAG, current => { current.applied = true; current.applying = false; });
  }
  if ( fell ) await landedZero(actor, { source: flag.sourceUuid ? resolveUuid(flag.sourceUuid) : null });
}

registerResumable(DROP_FLAG, {
  pending: flag => (flag?.status === "resolved") && !flag.applied && !flag.applying,
  drives: (_flag, message) => keepsMessage(message),
  drive: land
});

// The popup and the card.

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
      lines: [ruleLine(row?.rule ?? "")] })
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

/** The card IS the record for a row the dice or the damage settled: no line under it. */
const CARD_SAYS_IT = new Set(["auto", "saved", "failed", "unrolled", "exempt"]);

listen("dnd5e.renderChatMessage", "drop-to-one", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, DROP_FLAG);
    if ( !flag || CARD_SAYS_IT.has(flag.answer) ) return;
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
listen("updateChatMessage", "drop-to-one", message => {
  const flag = message.getFlag(MODULE_ID, DROP_FLAG);
  if ( !flag ) return;
  if ( flag.status === "pending" ) { armTimer(message); return; }
  disarmDeadline(timers, message.id);
  const open = livePopups.get(popupKey(message.id, DROP_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

listen("deleteChatMessage", "drop-to-one", message => { disarmDeadline(timers, message.id); });
