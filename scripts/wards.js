/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE WARDS (WARDS) — a standing effect that makes whoever
 * targets its bearer save FIRST (Sanctuary). The gate sits where the buy box sits, before the roll
 * (`dnd5e.preRollAttack`) and before a damaging spell's cast (`dnd5e.preUseActivity`): the use is vetoed,
 * the save demanded of the attacker through the saves machine on a card of this file's, and on a success
 * the use is made again with a pass in hand; a failure leaves the card saying the attack is turned aside
 * (the target is the attacker's to change — a new attack is a new attack). The ward ends on the bearer's
 * own attack roll, cast or damage roll, no choice (R1). Rulings: RULINGS *The spells slice — Tier 3*.
 */
import { MODULE_ID, TITLE, drivesMomentFor, statContext, decisionWindow, queueFlagWrite, canApplyTo } from "./core.js";
import { activityNamed, resolveUuid } from "./lookup.js";
import { effectSourceOf } from "./shared.js";
import { WARDS, answers, wardEntries, listedNames } from "./decide/registry.js";
import { repeatRowFor, needsFloat } from "./decide/repeat-saves.js";
import { wardGateFor, wardEnds, wardWords, wardVerdict } from "./decide/wards.js";
import { saveDemandData, saveTargetEntry } from "./decide/demand.js";
import { bfCard, esc, ruleLine } from "./decide/present.js";
import { tokenForUuid } from "./geometry.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const WARD_FLAG = "ward";
/** A pass in hand: `attacker|ward|gate` → until; the next use of that shape goes through unasked. */
const passes = new Map();
const PASS_MS = 90_000;

/** The item a landed effect came from (the activity first — a tray-applied copy's `item` names the pack). */
const originItemOf = effect => effectSourceOf(effect)?.item ?? null;

/** The listed ward rows standing on this creature: `{ row, effect, item }`. */
function wardsOn(actor) {
  if ( !(actor instanceof Actor) ) return [];
  const listed = listedNames(wardEntries());
  const out = [];
  for ( const effect of actor.effects ) {
    if ( !effect.active ) continue;
    const item = originItemOf(effect);
    const row = repeatRowFor({ table: WARDS, item, effectName: effect.name, listed, answers });
    if ( row ) out.push({ row, effect, item });
  }
  return out;
}

const passKey = (attackerUuid, wardUuid, gate) => `${attackerUuid}|${wardUuid}|${gate}`;
function hasPass(key) {
  const until = passes.get(key);
  if ( !until ) return false;
  if ( until < Date.now() ) { passes.delete(key); return false; }
  return true;
}

/** Is a ward demand for this attacker at this ward still unanswered? */
const pendingFor = (attackerUuid, wardUuid) => game.messages.contents.some(m => {
  const w = m.getFlag(MODULE_ID, WARD_FLAG);
  return w && (w.attackerUuid === attackerUuid) && (w.wardUuid === wardUuid) && !w.settled;
});

/* --- the gates: the attack roll, the damaging spell's cast ----------------------------------- */

/** The first warded creature among the aimed-at that gates this use, or null. */
function gatedTarget(attacker, targetActors, use) {
  for ( const actor of targetActors ) {
    if ( !(actor instanceof Actor) || (actor.uuid === attacker.uuid) ) continue;
    for ( const w of wardsOn(actor) ) {
      const gate = wardGateFor(w.row, use);
      if ( !gate ) continue;
      const key = passKey(attacker.uuid, actor.uuid, gate);
      if ( hasPass(key) ) { passes.delete(key); return null; }   // spent on this use
      return { ...w, ward: actor, gate };
    }
  }
  return null;
}

listen("dnd5e.preRollAttack", "wards", (config, dialog, message) => {
  try {
    const activity = config?.subject;
    const attacker = activity?.item?.actor ?? activity?.actor ?? null;
    if ( !(attacker instanceof Actor) ) return;
    const snapshot = message?.data?.system?.targets;
    const aimed = (Array.isArray(snapshot) && snapshot.length) ? snapshot.map(t => resolveUuid(t?.actor))
      : [...game.user.targets].map(t => t.actor);
    const found = gatedTarget(attacker, aimed, { seam: "attack", activityType: activity.type, itemType: activity.item?.type ?? null,
      hasDamage: !!activity.damage?.parts?.length, hasTemplate: !!activity.target?.template?.type });
    if ( !found ) return;
    if ( !pendingFor(attacker.uuid, found.ward.uuid) ) void raiseWard(found, attacker, activity, "attack", dialog?.configure !== false);
    else ui.notifications.warn(`${TITLE}: ${found.row.key}'s save is still unanswered.`);
    return false;   // the roll waits for the save
  } catch(err) { console.error(`${TITLE} | The ward's gate failed — rolling natively.`, err); }
});

listen("dnd5e.preUseActivity", "wards", (activity, _usageConfig, dialogConfig) => {
  try {
    const attacker = activity?.actor ?? null;
    if ( !(attacker instanceof Actor) ) return;
    const aimed = [...game.user.targets].map(t => t.actor);
    if ( !aimed.length ) return;
    const found = gatedTarget(attacker, aimed, { seam: "use", activityType: activity.type, itemType: activity.item?.type ?? null,
      hasDamage: !!activity.damage?.parts?.length, hasTemplate: !!activity.target?.template?.type });
    if ( !found ) return;
    if ( !pendingFor(attacker.uuid, found.ward.uuid) ) void raiseWard(found, attacker, activity, "damagingSpell", dialogConfig?.configure !== false);
    else ui.notifications.warn(`${TITLE}: ${found.row.key}'s save is still unanswered.`);
    return false;   // the cast waits for the save
  } catch(err) { console.error(`${TITLE} | The ward's gate failed — casting natively.`, err); }
});

/** The demand: the ward item's save activity, of the ATTACKER, on a card of this file's. */
async function raiseWard({ row, effect, item, ward }, attacker, activity, gate, configure = true) {
  try {
    const save = activityNamed(item, row.activity) ?? item?.system?.activities?.find?.(a => a.type === "save") ?? null;
    const dc = save?.save?.dc?.value;
    const abilities = [...(save?.save?.ability ?? [])];
    if ( !save || !(dc > 0) || !abilities.length ) {
      console.warn(`${TITLE} | ${row.key} on ${ward.name}: no save activity to demand — the attack rolls natively.`);
      passes.set(passKey(attacker.uuid, ward.uuid, gate), Date.now() + PASS_MS);
      return retrigger(activity, gate, configure);
    }
    const caster = item.actor ?? null;
    const token = attacker.token ?? attacker.getActiveTokens?.(true, true)?.[0] ?? null;
    const window = decisionWindow();
    const words = wardWords({ spell: row.key, attacker: attacker.name, ward: ward.name, gate, what: activity.item?.name ?? null });
    const abilityLabel = CONFIG.DND5E.abilities[abilities[0]]?.label ?? abilities[0];
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: bfCard({
        img: item.img ?? null, eyebrow: `${row.key} — the ward`, tone: "pending",
        title: words.title, subtitle: `${words.subtitle} · ${abilityLabel} save DC ${dc}`,
        lines: [ruleLine(row.rule)]
      }),
      flags: { [MODULE_ID]: {
        saves: saveDemandData({
          // The WARD's driver runs the verdict: its caster may be the attacker (a Cleric at its own warded ally).
          stat: statContext(ward.uuid),
          abilities, dc, damageOnSave: "none", hasDamage: false,
          effectNames: { fail: [], always: [] }, effectsHandled: "ward",
          // ⚠ Pinned: the ward's cast shares this activity; the area adoption must not rewrite the targets.
          pinnedTargets: true,
          demand: { spell: true, abilities, statuses: [], sleep: false },
          activityUuid: save.uuid, templateType: null, templated: false,
          durationUnits: item.system?.duration?.units ?? null,
          item: { name: item.name, img: item.img ?? null }, casterName: caster?.name ?? null,
          scaling: 0, window, deadline: window ? Date.now() + (window * 1000) : null,
          targets: [saveTargetEntry(attacker.uuid, token?.name ?? attacker.name)]
        }),
        [WARD_FLAG]: { ...statContext(ward.uuid), key: row.key, gate, attackerUuid: attacker.uuid,
          wardUuid: ward.uuid, wardName: ward.name, effectId: effect.id, activityUuid: activity.uuid, useName: activity.item?.name ?? null, configure }
      } }
    });
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "The ward"}'s save could not be demanded — ask for it by hand.`, err);
  }
}

/** The use, made again with the pass in hand: the dialog asks as the first press would have had it. */
function retrigger(activity, gate, configure = true) {
  if ( !activity ) return;
  if ( gate === "attack" ) return void activity.rollAttack({}, { configure }, {});
  return void activity.use({}, { configure }, {});
}

/* --- the verdict: on the attacker's driver, the use goes on or is turned aside ------------------ */

const settling = new Set();
async function settleWard(card) {
  const w = card.getFlag(MODULE_ID, WARD_FLAG);
  if ( !w || w.settled ) return;
  const entry = card.getFlag(MODULE_ID, "saves")?.targets?.find(t => t.uuid === w.attackerUuid);
  if ( !entry?.done || !drivesMomentFor(w.attackerUuid) ) return;
  if ( settling.has(card.id) ) return;
  settling.add(card.id);
  try {
    const verdict = wardVerdict(entry.outcome, w.gate);
    let claimed = !card.canUserModify?.(game.user, "update");   // not ours to write: act once, locally
    if ( !claimed ) await queueFlagWrite(card, WARD_FLAG, current => {
      if ( current.settled ) return false;
      current.settled = true; current.outcome = entry.outcome; current.says = verdict.says;
      claimed = true;
    });
    if ( !claimed ) return;
    if ( !verdict.through ) return;
    passes.set(passKey(w.attackerUuid, w.wardUuid, w.gate), Date.now() + PASS_MS);
    // live only: the use is made AGAIN on the live sheet — a used-up item has nothing left to roll, and the notice says so
    const activity = resolveUuid(w.activityUuid);
    if ( !activity ) { ui.notifications.info(`${TITLE}: ${w.key}'s save passed — make the ${w.gate === "attack" ? "attack" : "cast"} again.`); return; }
    retrigger(activity, w.gate, w.configure !== false);
  } catch(err) {
    console.error(`${TITLE} | The ward's verdict could not land — make the attack again by hand.`, err);
  } finally {
    settling.delete(card.id);
  }
}

listen("updateChatMessage", "wards", message => { void settleWard(message); void floatAside(message); });

/* --- the cue: "turned aside" floats off the ward on a failure, every client, once ---------------- */

const floated = new Set();
function floatAside(message) {
  try {
    const w = message.getFlag(MODULE_ID, WARD_FLAG);
    if ( !w || floated.has(message.id) ) return;
    const entry = message.getFlag(MODULE_ID, "saves")?.targets?.find(t => t.uuid === w.attackerUuid);
    if ( !entry?.done || (entry.outcome === "saved") ) return;
    floated.add(message.id);
    const token = tokenForUuid(w.wardUuid);
    if ( !token?.visible || !canvas?.interface?.createScrollingText ) return;
    canvas.interface.createScrollingText(token.center, "turned aside", {
      anchor: CONST.TEXT_ANCHOR_POINTS.CENTER, direction: CONST.TEXT_ANCHOR_POINTS.TOP,
      distance: 2 * token.h, fontSize: 28, stroke: 0x000000, strokeThickness: 4, jitter: 0.25
    });
  } catch(err) { console.warn(`${TITLE} | The ward's cue could not draw.`, err); }
}

/* --- the card: the verdict's line ---------------------------------------------------------------- */

listen("dnd5e.renderChatMessage", "wards", (message, html) => {
  try {
    const w = message.getFlag(MODULE_ID, WARD_FLAG);
    if ( !w ) return;
    void settleWard(message);   // the reload-resume twin of the update watcher
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    const entry = message.getFlag(MODULE_ID, "saves")?.targets?.find(t => t.uuid === w.attackerUuid);
    if ( !entry?.done || !content || content.querySelector(".bf-ward-line") ) return;
    const verdict = wardVerdict(entry.outcome, w.gate);
    const words = wardWords({ spell: w.key, attacker: "", ward: w.wardName, gate: w.gate });
    const div = document.createElement("div");
    div.className = "bf-ward-line";
    div.style.cssText = `margin:0.25rem 0;font-size:var(--font-size-11,11px);font-weight:bold;opacity:0.9;color:${verdict.through ? "var(--dnd5e-color-maroon, #740b0b)" : "var(--dnd5e-color-blue, #3a7ca5)"};`;
    div.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${esc(verdict.says)}${verdict.through ? "" : ` — ${esc(words.failed)}`}`;
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The ward's line could not render.`, err); }
});

/* --- the end: the bearer's own attack roll, cast or damage roll ends it, on its driver ----------- */

async function endWards(actor, act, { ownItem = null } = {}) {
  try {
    if ( !(actor instanceof Actor) || !drivesMomentFor(actor.uuid) ) return;
    for ( const { row, effect, item } of wardsOn(actor) ) {
      const own = !!ownItem && !!item && ((ownItem.uuid === item.uuid) || answers(row.key, ownItem));
      const verdict = wardEnds(row, act, { ownItem: own });
      if ( !verdict.ends ) continue;
      if ( !canApplyTo(actor) ) { console.warn(`${TITLE} | ${row.key} on ${actor.name} should end (${verdict.why}) — no owner here to end it.`); continue; }
      const floats = needsFloat({ statuses: effect.statuses, changes: effect.changes ?? [] });
      await effect.delete();
      if ( floats ) floatEnd(actor, effect.name);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: bfCard({ img: item?.img ?? null, eyebrow: `${row.key} — ended`, tone: "neutral",
          title: `${row.key} ended — ${actor.name} ${verdict.why}`,
          subtitle: "the ward ends when its bearer makes an attack roll, casts a spell, or deals damage",
          lines: [ruleLine(row.rule)] }),
        flags: { [MODULE_ID]: { wardEnded: { ...statContext(item?.actor?.uuid ?? null), key: row.key, actorUuid: actor.uuid, act, why: verdict.why } } }
      });
    }
  } catch(err) {
    console.error(`${TITLE} | The ward could not end — remove its effect by hand.`, err);
  }
}

/** The platform floats an effect with a status or a change; a bare ward (Warded) is floated here. */
function floatEnd(actor, name) {
  try {
    if ( !canvas?.interface?.createScrollingText ) return;
    for ( const token of actor.getActiveTokens(true) ) {
      if ( !token.visible || token.document.isSecret ) continue;
      canvas.interface.createScrollingText(token.center, `−(${name})`, {
        anchor: CONST.TEXT_ANCHOR_POINTS.CENTER, direction: CONST.TEXT_ANCHOR_POINTS.BOTTOM,
        distance: 2 * token.h, fontSize: 28, stroke: 0x000000, strokeThickness: 4, jitter: 0.25
      });
    }
  } catch(err) { console.warn(`${TITLE} | The ended ward's float could not draw.`, err); }
}

listen("dnd5e.rollAttack", "wards", (_rolls, data) => { void endWards(data?.subject?.actor ?? null, "attack"); });
listen("dnd5e.rollDamage", "wards", (_rolls, data) => { void endWards(data?.subject?.actor ?? null, "damage"); });
// ⚠ Registered ahead of cast.js in ORDER: the ward's own cast is judged before its effect lands.
listen("dnd5e.postUseActivity", "wards", activity => {
  if ( activity?.item?.type !== "spell" ) return;
  void endWards(activity.actor ?? null, "spell", { ownItem: activity.item });
});
