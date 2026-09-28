/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE REPEATING SAVE (REPEAT_SAVES) — a landed effect's save
 * repeated at the bearer's turn end, when damage lands on it, or as its own action offered at its turn
 * start. The demand is the saves machine's, raised on a card of this file's; the verdict's success
 * removes the effect through the cast card's receipt, no choice (R1); the card says what happened. The
 * platform floats the name off the token for an effect with a status or a change (NOTES §1); the float
 * here is for the bare ones. The precedent is the emanation's `trigger on "turnEnd"`.
 */
import { MODULE_ID, TITLE, drivesMomentFor, statContext, decisionWindow, queueFlagWrite, canAnswerFor, canApplyTo } from "./core.js";
import { activityOfType, resolveUuid } from "./lookup.js";
import { effectSourceOf, forceStatus } from "./shared.js";
import { REPEAT_SAVES, answers, repeatSaveEntries, listedNames } from "./decide/registry.js";
import { repeatRowFor, repeatDue, repeatBend, repeatVerdict, needsFloat, repeatTitle } from "./decide/repeat-saves.js";
import { saveDemandData, saveTargetEntry } from "./decide/demand.js";
import { bfCard, esc, ruleLine } from "./decide/present.js";
import { momentButton } from "./ui.js";
import { rollDamageForSave } from "./auto-damage.js";
import { revertEffect } from "./effect-riders.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const REPEAT_FLAG = "repeatSave";
const OFFER_FLAG = "repeatOffer";
const COUNT_FLAG = "repeatCount";

/** The item a landed effect came from: shared.js's walk (the activity first — a tray-applied copy's `item`
 * names the pack, NOTES §2). */
const originItemOf = effect => effectSourceOf(effect)?.item ?? null;

/** The listed row a standing effect answers, with its item — null for almost every effect. */
function rowOf(effect) {
  if ( !effect || effect.disabled || effect.getFlag(MODULE_ID, COUNT_FLAG)?.locked ) return null;
  const item = originItemOf(effect);
  const found = repeatRowFor({ table: REPEAT_SAVES, item, effectName: effect.name, listed: listedNames(repeatSaveEntries()), answers });
  return found ? { ...found, item } : null;
}

/** Is a repeat for this effect still unanswered anywhere in the log? */
const pendingFor = effect => game.messages.contents.some(m => (m.getFlag(MODULE_ID, REPEAT_FLAG)?.effectUuid === effect.uuid)
  && (m.getFlag(MODULE_ID, "saves")?.status === "pending"));

/* --- the triggers ------------------------------------------------------------------------------ */

/** The turns this client has asked or offered on: `effect|round|turn`. The log is the durable copy. */
const raised = new Set();

listen("updateCombat", "repeat-saves", (combat, changes, options) => {
  try {
    if ( !("turn" in changes) && !("round" in changes) ) return;
    if ( !combat.started || (options?.direction === -1) ) return;
    // The turn that ENDED: the previous combatant's listed effects repeat.
    const prev = combat.previous ?? null;
    const ended = prev?.combatantId ? (combat.combatants.get(prev.combatantId)?.actor ?? null) : null;
    if ( (ended instanceof Actor) && drivesMomentFor(ended.uuid) ) {
      for ( const effect of ended.effects ) {
        const row = rowOf(effect);
        if ( !row ) continue;
        const key = `${effect.uuid}|${prev.round}|${prev.turn}|end`;
        if ( raised.has(key) ) continue;
        const due = repeatDue(row, "turnEnd", { pending: pendingFor(effect) });
        if ( !due.due ) continue;
        raised.add(key);
        void raiseRepeat(effect, row, "turnEnd", due.why);
      }
    }
    // The turn that STARTED: an `action` row is offered to the bearer.
    const current = combat.combatant?.actor ?? null;
    if ( (current instanceof Actor) && drivesMomentFor(current.uuid) ) {
      for ( const effect of current.effects ) {
        const row = rowOf(effect);
        if ( !row?.on.includes("action") ) continue;
        const key = `${effect.uuid}|${combat.round}|${combat.turn}|start`;
        if ( raised.has(key) ) continue;
        raised.add(key);
        void offerRepeat(effect, row, combat);
      }
    }
  } catch(err) {
    console.error(`${TITLE} | The repeated save could not be raised — ask for it by hand.`, err);
  }
});

// Damage landed on the bearer: the `damaged` rows repeat, on the bearer's driver.
listen("dnd5e.damageActor", "repeat-saves", (actor, changes) => {
  try {
    if ( !(actor instanceof Actor) || !drivesMomentFor(actor.uuid) ) return;
    const total = Number(changes?.total ?? ((Number(changes?.hp) || 0) + (Number(changes?.temp) || 0)));
    if ( !(total < 0) ) return;   // healing, or a change that took nothing
    for ( const effect of actor.effects ) {
      const row = rowOf(effect);
      if ( !row ) continue;
      const due = repeatDue(row, "damaged", { pending: pendingFor(effect) });
      if ( !due.due ) continue;
      void raiseRepeat(effect, row, "damaged", due.why);
    }
  } catch(err) {
    console.error(`${TITLE} | The repeated save could not be raised — ask for it by hand.`, err);
  }
});

/** The demand: the saves machine's flag on this file's card, pinned to the bearer, the row's bend riding. */
async function raiseRepeat(effect, row, cause, why) {
  try {
    const actor = effect.parent;
    const item = row.item;
    const activity = activityOfType(item, "save");
    const dc = activity?.save?.dc?.value;
    const abilities = [...(activity?.save?.ability ?? [])];
    if ( !(actor instanceof Actor) || !activity || !(dc > 0) || !abilities.length ) return;
    const token = actor.token ?? actor.getActiveTokens?.(true, true)?.[0] ?? null;
    const caster = item.actor ?? null;
    const onSave = row.onSave ?? activity.damage?.onSave ?? "half";
    const hasDamage = !!activity.damage?.parts?.length && (onSave !== "full");
    const window = decisionWindow();
    const bend = repeatBend(row, cause, row.key);
    const abilityLabel = CONFIG.DND5E.abilities[abilities[0]]?.label ?? abilities[0];
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster ?? actor }),
      content: bfCard({
        img: item.img ?? null, eyebrow: "Repeated save", tone: "pending",
        title: repeatTitle({ effectName: effect.name, bearer: token?.name ?? actor.name, cause, spell: row.key }),
        subtitle: `${abilityLabel} save DC ${dc} · a success ends ${effect.name}`
          + `${hasDamage ? ` · ${onSave === "half" ? "half" : "none"} on a success` : ""}${bend ? " · with Advantage" : ""}`,
        lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${esc(row.caveat)}</span>` : null]
      }),
      flags: { [MODULE_ID]: {
        saves: saveDemandData({
          stat: statContext(caster?.uuid ?? null),
          abilities, dc, damageOnSave: onSave, hasDamage,
          effectNames: { fail: [], always: [] }, effectsHandled: "repeat",
          // ⚠ Pinned: the area adoption keys on the activity this card shares with the cast and would rewrite the targets.
          pinnedTargets: true,
          demand: { spell: true, abilities, statuses: [...(effect.statuses ?? [])], sleep: false, ...(bend ? { bend } : {}) },
          activityUuid: activity.uuid, templateType: null, templated: false,
          durationUnits: item.system?.duration?.units ?? null,
          item: { name: item.name, img: item.img ?? null }, casterName: caster?.name ?? null,
          scaling: Number(effect.getFlag("dnd5e", "scaling") ?? 0),
          window, deadline: window ? Date.now() + (window * 1000) : null,
          targets: [saveTargetEntry(actor.uuid, token?.name ?? actor.name)]
        }),
        [REPEAT_FLAG]: { ...statContext(caster?.uuid ?? null), key: row.key, cause, why, effectUuid: effect.uuid, effectId: effect.id,
          effectName: effect.name, actorUuid: actor.uuid, castCard: effect.system?.origin?.message ?? null }
      } }
    });
    if ( hasDamage && card ) await rollDamageForSave(activity, card);
  } catch(err) {
    console.error(`${TITLE} | The repeated save could not be raised — ask for it by hand.`, err);
  }
}

/* --- the offer: an `action` row at the bearer's turn start, its button raising the demand --------- */

async function offerRepeat(effect, row, combat) {
  try {
    const actor = effect.parent;
    const item = row.item;
    if ( !(actor instanceof Actor) ) return;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({
        img: item.img ?? null, eyebrow: "Repeated save", tone: "pending",
        title: repeatTitle({ effectName: effect.name, bearer: actor.name, cause: "action", spell: row.key }),
        subtitle: `${effect.name} stands — the save costs the action; a success ends it`,
        lines: [ruleLine(row.rule)]
      }),
      flags: { [MODULE_ID]: { [OFFER_FLAG]: { ...statContext(item.actor?.uuid ?? null), key: row.key, effectUuid: effect.uuid,
        actorUuid: actor.uuid, combatId: combat.id, round: combat.round, turn: combat.turn } } }
    });
  } catch(err) {
    console.error(`${TITLE} | The repeated save could not be offered.`, err);
  }
}

/** Has this offer been taken — a repeat card for its effect born after it? */
const offerTaken = (card, offer) => game.messages.contents.some(m => (m.getFlag(MODULE_ID, REPEAT_FLAG)?.effectUuid === offer.effectUuid)
  && (m.timestamp >= card.timestamp));

/* --- the verdict: the effect ends on a success, holds or tallies on a failure ---------------------- */

const settling = new Set();

async function settleRepeat(card) {
  const rep = card.getFlag(MODULE_ID, REPEAT_FLAG);
  if ( !rep || rep.settled ) return;
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === rep.actorUuid);
  if ( !entry?.done || !drivesMomentFor(flag.sourceUuid ?? null) ) return;
  if ( settling.has(card.id) ) return;
  settling.add(card.id);
  try {
    let claimed = false;
    await queueFlagWrite(card, REPEAT_FLAG, current => {
      if ( current.settled ) return false;
      current.settled = true;
      claimed = true;
    });
    if ( !claimed ) return;
    const actor = resolveUuid(rep.actorUuid);
    const effect = (actor instanceof Actor) ? (actor.effects.get(rep.effectId) ?? null) : null;
    const row = REPEAT_SAVES[rep.key] ?? null;
    if ( !row ) return;
    const verdict = repeatVerdict(row, entry.outcome, effect?.getFlag(MODULE_ID, COUNT_FLAG) ?? null);
    let landed = "";
    if ( !effect ) landed = " (the effect was already gone)";
    else if ( !canApplyTo(actor) ) landed = " — no GM: end it by hand";
    else {
      if ( verdict.ends ) await endEffect(rep, actor, effect);
      else if ( verdict.tally ) await effect.setFlag(MODULE_ID, COUNT_FLAG, { ...verdict.tally, ...(verdict.locks ? { locked: true } : {}) });
      if ( verdict.press ) await forceStatus(actor, verdict.press, { origin: flag.sourceUuid ?? null });
    }
    await queueFlagWrite(card, REPEAT_FLAG, current => {
      current.outcome = entry.outcome;
      current.ended = verdict.ends && !!effect;
      current.says = `${verdict.says}${landed}`;
    });
  } catch(err) {
    console.error(`${TITLE} | The repeated save's verdict could not land — end the effect by hand.`, err);
  } finally {
    settling.delete(card.id);
  }
}

/** The removal: through the cast card's receipt where it has one (the revert marks it), else the effect goes. */
async function endEffect(rep, actor, effect) {
  const cast = rep.castCard ? resolveUuid(rep.castCard) : null;
  if ( cast instanceof ChatMessage ) {
    await revertEffect(cast, actor.uuid, effect.id);
    if ( !actor.effects.get(effect.id) ) return;
  }
  await effect.delete();
}

listen("updateChatMessage", "repeat-saves", message => { void settleRepeat(message); });

/* --- the float, where the platform draws none (a bare effect: Confused) --------------------------- */

listen("deleteActiveEffect", "repeat-saves", effect => {
  try {
    const actor = effect.parent;
    if ( !(actor instanceof Actor) || !canvas?.interface?.createScrollingText ) return;
    if ( !needsFloat({ statuses: effect.statuses, changes: effect.system?.changes ?? effect.changes ?? [] }) ) return;
    if ( !rowOf(effect) ) return;
    // The platform's own float (ActiveEffect#_displayScrollingStatus), for the effect it skips.
    for ( const token of actor.getActiveTokens(true) ) {
      if ( !token.visible || token.document.isSecret ) continue;
      canvas.interface.createScrollingText(token.center, `−(${effect.name})`, {
        anchor: CONST.TEXT_ANCHOR_POINTS.CENTER, direction: CONST.TEXT_ANCHOR_POINTS.BOTTOM,
        distance: 2 * token.h, fontSize: 28, stroke: 0x000000, strokeThickness: 4, jitter: 0.25
      });
    }
  } catch(err) { console.warn(`${TITLE} | The ended effect's float could not draw.`, err); }
});

/* --- the cards: the verdict's line, the offer's button ----------------------------------------- */

listen("dnd5e.renderChatMessage", "repeat-saves", (message, html) => {
  try {
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content ) return;
    const rep = message.getFlag(MODULE_ID, REPEAT_FLAG);
    if ( rep ) {
      void settleRepeat(message);   // the reload-resume twin of the update watcher
      if ( rep.says && !content.querySelector(".bf-repeat-line") ) {
        const div = document.createElement("div");
        div.className = "bf-repeat-line";
        div.style.cssText = `margin:0.25rem 0;font-size:var(--font-size-11,11px);font-weight:bold;opacity:0.9;color:${rep.ended ? "var(--dnd5e-color-blue, #3a7ca5)" : "var(--dnd5e-color-maroon, #740b0b)"};`;
        div.innerHTML = `<i class="fa-solid fa-rotate"></i> ${esc(rep.says)}`;
        content.appendChild(div);
      }
      return;
    }
    const offer = message.getFlag(MODULE_ID, OFFER_FLAG);
    if ( !offer ) return;
    const actor = resolveUuid(offer.actorUuid);
    const effect = (actor instanceof Actor) ? actor.effects.find(e => e.uuid === offer.effectUuid) : null;
    if ( !effect || offerTaken(message, offer) || !canAnswerFor(actor) ) return;
    content.appendChild(momentButton("Repeat the save — your action", () => {
      const live = actor.effects.find(e => e.uuid === offer.effectUuid) ?? null;
      const row = live ? rowOf(live) : null;
      if ( !row ) { ui.notifications.warn(`${TITLE}: ${offer.key}'s effect is no longer on the sheet.`); return; }
      if ( pendingFor(live) ) { ui.notifications.warn(`${TITLE}: a repeat of this save is still unanswered.`); return; }
      void raiseRepeat(live, row, "action", "its action");
    }));
  } catch(err) { console.warn(`${TITLE} | The repeated save's line could not render.`, err); }
});
