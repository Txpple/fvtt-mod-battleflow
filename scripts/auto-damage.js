/**
 * Battle Flow — auto-roll damage on hit, on the attacker's own client, and the damage offer
 * (the popup that asks the roller for their own dice). Owns the one crit judgement (`critFor`).
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting } from "./core.js";
import { resolveUuid } from "./lookup.js";
import { hitTargets, modeAllows } from "./shared.js";
import { TONE, esc } from "./decide/present.js";
import { CONDITION_BENDS } from "./decide/registry.js";
import { autoCritSources } from "./decide/reminders.js";
import { critStands } from "./decide/rescue-hit.js";
import { CARD, isCard, originData, originIdInData, originIdOf } from "./decide/card.js";
import { nearestFeet, tokenForUuid, tokenOfActor } from "./geometry.js";
import { stampHoldIfInterrupted } from "./hold/index.js";
import { SURFACES } from "./surfaces.js";

/** The "Against …" line: each target with its token icon (law 8 tooltip).
 * ⚠ `display:inline-block` is load-bearing: the dialog stylesheet makes imgs block, and only an
 * inline style outranks it. */
const againstLine = targets => {
  const list = (targets ?? []).filter(t => t?.name);
  if ( !list.length ) return null;
  return `Against ${list.map(t =>
    `${t.img ? `<img src="${esc(t.img)}" alt="${esc(t.name)}" data-tooltip="${esc(t.name)}"
      style="display:inline-block;width:18px;height:18px;border:none;border-radius:3px;object-fit:cover;vertical-align:-4px;margin:0 2px 0 0;">` : ""}<strong>${esc(t.name)}</strong>`).join(", ")}.`;
};

/* --- Auto-roll damage on hit (the attacker's client; its attack, its dice) -------------------- */

Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  // The mode gates on the attacker's side; this hook runs on whichever client rolled.
  if ( !subject || !modeAllows(subject.actor) ) return;

  const attackMessage = rolls[0]?.parent;
  if ( !(attackMessage instanceof ChatMessage) ) return; // rolled with create:false — no chain to ride

  // Mirror the native card: no Damage button (no damage parts, no ammo), nothing to roll.
  if ( !subject.damage?.parts?.length && !subject.item?.system.properties?.has("amm") ) return;

  const hits = hitTargets(attackMessage);
  if ( !hits.length ) return; // a miss means the damage dice never exist

  // A hold (a Shield-class reaction) pauses the APPLICATION, never the dice: the roll is born
  // attackHoldPending and the hold's resolution releases or discards it.
  await stampHoldIfInterrupted(attackMessage, rolls[0], hits);
  // The one case the dice wait: a crit a Disadvantage reaction could undo. `damageAfterHold` rolls them.
  if ( attackMessage.getFlag(MODULE_ID, "hold")?.critAtStake ) return;
  return offerOrRollDamage(subject, attackMessage);
});

/** The damage after a hit: offered to the attacker, or rolled after the dramatic beat. One path for every hit. */
function offerOrRollDamage(subject, attackMessage) {
  // The offer replaces the beat rather than stacking behind it, and opens whatever the setting
  // when a contribution has a decision pending (`registerOfferPart`).
  if ( setting(S.playerRollDamage) || offerPartsDue(attackMessage, subject) ) {
    return void offerDamageRoll(subject, attackMessage);
  }

  const beat = (Math.max(0, Number(setting(S.dramaticBeat)) || 0)) * 1000;
  setTimeout(() => rollDamageForAttack(subject, attackMessage), beat);
}

/**
 * The crit the hold held back, once the hold resolved (hold/continue.js): offered or rolled as at
 * the hit, if the attack still hits someone.
 * @param {ChatMessage} attackMessage
 */
export async function damageAfterHold(attackMessage) {
  try {
    if ( !hitTargets(attackMessage).length ) return;
    const activity = attackMessage.getAssociatedActivity?.() ?? null;
    if ( !activity ) {
      console.warn(`${TITLE} | The held crit's damage has no activity to roll from — roll it from the card.`);
      return;
    }
    return offerOrRollDamage(activity, attackMessage);
  } catch(err) {
    console.error(`${TITLE} | The held crit's damage failed — roll it from the card.`, err);
  }
}

/* ---------------------------------------------------------------------------------------------
 * THE CRIT, ONE SOURCE: the d20's own `isCritical`, or a condition's automatic crit within reach
 * (decide/reminders.js `autoCritSources`; RULINGS *The gate before the roll*). Every roll path and
 * the offer's badge read `critFor`, so the badge and the dice cannot disagree.
 * ⚠ One damage roll serves every target it hit: the crit applies only when true of ALL of them;
 * the dropped case is said on the offer.
 * ------------------------------------------------------------------------------------------- */

/**
 * @param {ChatMessage} attackMessage
 * @returns {{isCritical: boolean, rolled: boolean, auto: boolean,
 *            sources: {status: string, label: string, rule: string}[], dropped: string[]}}
 */
function critFor(attackMessage) {
  const d20Crit = attackMessage?.rolls?.[0]?.isCritical ?? false;
  // A natural 20 a defender's Disadvantage undid no longer doubles, unless it stands for every hit target.
  const rolled = d20Crit && rolledCritStands(attackMessage);
  const out = { isCritical: rolled, rolled, undone: d20Crit && !rolled, auto: false, sources: [], dropped: [] };
  try {
    const hits = hitTargets(attackMessage);
    if ( !hits.length ) return out;
    const attackerToken = tokenOfActor(attackMessage.getAssociatedActor());
    const per = hits.map(t => {
      const token = tokenForUuid(t.uuid);
      const actor = token?.actor ?? resolveUuid(t.uuid);
      const distanceFeet = (attackerToken && token) ? nearestFeet(attackerToken, token) : null;
      return { name: t.name ?? actor?.name ?? "the target",
        sources: autoCritSources({ targetStatuses: actor?.statuses ?? [], distanceFeet,
          targetName: token?.document?.name ?? actor?.name ?? "the target", table: CONDITION_BENDS }) };
    });
    const qualifying = per.filter(p => p.sources.length);
    if ( !qualifying.length ) return out;
    if ( qualifying.length === per.length ) {
      out.auto = true;
      out.isCritical = true;
      out.sources = per.flatMap(p => p.sources);
    } else {
      out.dropped = qualifying.map(p => p.name);
    }
  } catch(err) {
    console.error(`${TITLE} | Automatic crit judgement failed — the d20's own verdict stands.`, err);
  }
  return out;
}

/** Does the d20's own crit still stand after the hold — no bent roll took it from a hit target? */
function rolledCritStands(attackMessage) {
  try {
    const bents = Object.fromEntries((attackMessage?.getFlag(MODULE_ID, "hold")?.targets ?? [])
      .filter(t => t.bent).map(t => [t.uuid, t.bent]));
    if ( !Object.keys(bents).length ) return true;
    return critStands({ rolledCrit: true, hitUuids: hitTargets(attackMessage).map(t => t.uuid), bents });
  } catch(err) {
    console.error(`${TITLE} | The bent roll's crit could not be read — the d20's own verdict stands.`, err);
    return true;
  }
}

/**
 * The attack an about-to-roll damage answers, from the message DATA (no document yet): the
 * module's `attackFor` stamp, else the clicked card's last attack roll (as dnd5e's #rollDamage reads it).
 */
export function attackMessageForDamage(config, message) {
  const data = message?.data ?? {};
  const forId = foundry.utils.getProperty(data, `flags.${MODULE_ID}.attackFor`) ?? data[`flags.${MODULE_ID}.attackFor`];
  if ( forId ) return game.messages.get(forId) ?? null;
  const cardId = config?.event?.target?.closest?.(SURFACES.messageId)?.dataset?.messageId
    ?? originIdInData(data);
  const card = cardId ? game.messages.get(cardId) : null;
  if ( !card ) return null;
  if ( isCard(card, CARD.attack) ) return card;
  return card.getAssociatedRolls?.("attack")?.pop() ?? null;
}

// Makes the card's own Damage button honour the crit: `applyKeybindings` runs AFTER this hook and
// stamps `config.isCritical` onto every roll. The flag lets the card say why the dice doubled (R5).
Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  try {
    if ( config?.subject?.type !== "attack" ) return;
    // ⚠ The count of the activity's own rolls, taken before any rider pushes one: this handler
    // must stay first on the hook (tools/hook-order.snapshot). Savage Attacker rerolls only these.
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.weaponRolls`, config.rolls?.length ?? 0);
    const attackMessage = attackMessageForDamage(config, message);
    if ( !attackMessage ) return;
    const crit = critFor(attackMessage);
    // The card's Damage button carries the d20's crit in: a crit the hold undid is taken out.
    if ( crit.undone && !crit.auto ) { config.isCritical = false; return; }
    if ( !crit.auto ) return;
    config.isCritical = true;
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.autoCrit`,
      { sources: crit.sources.map(s => ({ status: s.status, label: s.label })), attackId: attackMessage.id });
  } catch(err) {
    console.error(`${TITLE} | Automatic crit failed to apply — the d20's own verdict stands.`, err);
  }
});

// The damage card SAYS why it doubled (R5): the badge and the fact, under the roll.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const auto = message.getFlag(MODULE_ID, "autoCrit");
  if ( !auto?.sources?.length ) return;
  const line = document.createElement("div");
  line.style.cssText = "margin:0.3rem 0;font-size:var(--font-size-12,12px);line-height:1.5;";
  line.innerHTML = `${CRIT_BADGE} <span style="opacity:0.85;">${auto.sources.map(s => s.label).join(" · ")}</span>`;
  html.querySelector(SURFACES.messageContent)?.appendChild(line);
});

/**
 * Press the Damage button as AttackActivity#rollDamage does: ability, attack mode and ammunition
 * off the attack card's data, crit pre-set, no dialog. ⚠ The origin is stamped explicitly (a
 * programmatic roll has no click to inherit it); without it auto-apply cannot chain.
 */
export async function rollDamageForAttack(activity, attackMessage) {
  try {
    const { ability, mode: attackMode, ammunitionItem: ammunition } = attackMessage.system ?? {};
    const isCritical = critFor(attackMessage).isCritical;
    const originId = originIdOf(attackMessage) ?? attackMessage.id;
    // Every driven roll names the exact attack it answers (`attackFor`): under a volley the rays
    // share one usage card. A roll made while the hold is open is born claimed; the hold is read
    // at ROLL time, so one resolved while the popup sat open applies straight.
    const holdPending = attackMessage.getFlag(MODULE_ID, "hold")?.status === "pending";
    // ⚠ Stamps ride NESTED under `flags`, never as dotted keys: data holding both a nested
    // `flags.<module>` and a dotted `flags.<module>.x` keeps only the nested one.
    await activity.rollDamage(
      { ability, ammunition, attackMode, isCritical },
      { configure: false },
      { data: { ...originData(originId),
        flags: { [MODULE_ID]: { attackFor: attackMessage.id, ...(holdPending ? { attackHoldPending: true } : {}) } } } }
    );
  } catch(err) {
    console.error(`${TITLE} | Auto-roll damage failed.`, err);
  }
}

/**
 * Roll a SAVE activity's damage, chained to its own usage card. The twin of the function above:
 * the auto-roll and the player's button call ONE function, so nothing downstream can tell who
 * pressed it. ⚠ The origin is stamped explicitly, or the verdict fold never finds the roll.
 */
export async function rollDamageForSave(activity, card) {
  try {
    // The upcast: on the demand (an emanation's triggered demand is a plain card), else the usage card's.
    const scaling = Number(card.getFlag(MODULE_ID, "saves")?.scaling ?? card.system?.scaling ?? 0);
    // ⚠ The card's OWN targets ride the roll: dnd5e snapshots the client's live targets, which a
    // driver may have changed by now.
    const data = foundry.utils.expandObject(originData(card.id));
    const aimed = card._source?.system?.targets;
    if ( Array.isArray(aimed) && aimed.length ) foundry.utils.setProperty(data, "system.targets", foundry.utils.deepClone(aimed));
    await activity.rollDamage(scaling > 0 ? { scaling } : {}, { configure: false }, { data });
  } catch(err) {
    console.error(`${TITLE} | Could not auto-roll the save spell's damage.`, err);
  }
}

/* ---------------------------------------------------------------------------------------------
 * The player's own roll — offered, never taken. The hooks fire on the client that acted, so the
 * popup needs no elect and nothing crosses the wire. Two paths: attacks on hit (with the crit),
 * and save spells and areas at the demand stamp (saves.js; the stakes take the badge's slot).
 * ⚠ The button and the buzzer call the SAME roll function as the auto-roll, so nothing downstream
 * can tell a player's dice from the machine's. Never add a popup-only variant.
 * ⚠ Known limit: the window is a `setTimeout` on one client, so a reload mid-popup loses the
 * roll; the GM rolls it by hand.
 * ------------------------------------------------------------------------------------------- */

/** The offer's window in seconds (`damageTimer`); 0 waits indefinitely and draws no bar. */
const playerRollWindow = () => Math.max(0, Number(setting(S.damageTimer)) || 0);

/** The crit badge: never shown on a guess, only off `critFor`. */
const CRIT_BADGE = `<span style="display:inline-block;padding:0.05rem 0.45rem;border-radius:3px;
  background:${TONE.crit};color:#111;font-weight:bold;letter-spacing:0.07em;
  font-size:var(--font-size-11,11px);text-transform:uppercase;">&#10022; Critical Hit</span>`;

/**
 * The shell every damage offer wears: the button, the X and the buzzer all funnel through ONE
 * `roll` thunk. One popup per roll (keyed to the card), never per target: a second call raises
 * the open one.
 */
async function offerRoll(message, { roll, windowTitle, windowIcon, buttonLabel, buttonIcon, extraHTML = "", wire = null, ...card }) {
  // ⚠ Keep these imports dynamic: a static import of ui.js runs its hook registrations ahead of
  // this file's and changes the hook order (check-hook-order).
  const { popupKey, bfCard, momentBarHTML } = await import("./decide/present.js");
  const { livePopups, openManagedPopup } = await import("./ui.js");

  const key = popupKey(message.id, "damage");
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }

  const window = playerRollWindow();
  const deadline = window ? Date.now() + (window * 1000) : null;

  // The wait is stamped on the card so every client draws the bar; a failed stamp never blocks the offer.
  if ( deadline ) {
    void message.setFlag(MODULE_ID, "damageOffer", { status: "pending", deadline, window })
      .catch(() => { /* the popup still offers; only the table's bar is lost */ });
  }

  // Idempotent: only the first of button, dismissal and buzzer rolls.
  let fired = false;
  const fire = () => {
    if ( fired ) return;
    fired = true;
    void roll();
    if ( deadline ) void message.setFlag(MODULE_ID, "damageOffer", { status: "done" })
      .catch(() => { /* a stale bar drains to empty and the next render drops it */ });
  };

  const dialog = new foundry.applications.api.DialogV2({
    window: { title: windowTitle, icon: windowIcon },
    position: { width: 420 },
    // ⚠ DialogV2 sizes to its content: long menus scroll in a viewport-bounded box so the Roll
    // button stays on screen.
    content: bfCard({ tone: "pending", ...card })
      + (extraHTML ? `<div data-bf-offer-menus style="max-height:calc(100vh - 20rem);overflow-y:auto;overflow-x:hidden;">${extraHTML}</div>` : "")
      + (deadline ? momentBarHTML({ deadline, window }, "to roll") : ""),
    buttons: [{
      action: "roll",
      label: buttonLabel,
      icon: buttonIcon,
      default: true,
      callback: () => fire()
    }],
    rejectClose: false
  });

  // Dismissing is not a veto: the X and Escape roll immediately.
  const close = dialog.close.bind(dialog);
  dialog.close = (...args) => { fire(); return close(...args); };

  // The buzzer, unconditional so it rolls even if the popup never rendered. A 0 window arms nothing.
  if ( window ) setTimeout(() => { void dialog.close(); }, window * 1000);

  await openManagedPopup(key, message, dialog);

  // A failed render leaves nothing to press (the native Damage button is hidden): roll now.
  if ( livePopups.get(key) !== dialog ) return fire();
  if ( wire ) { try { wire(dialog.element); } catch(err) { console.error(`${TITLE} | Offer controls failed to wire.`, err); } }
}

/**
 * The offer's contributions. The offer is a service that knows no feature; a machine declares
 * what it paints on the offer at module evaluation (the `registerRelay` idiom), so the edge points
 * machine → service. A part declares:
 *   due(attackMessage, activity)        → true when a decision is pending: the offer opens even under auto damage
 *   parts(attackMessage, activity, ctx) → null, or `{ html, lines, wire(element), commit() }`;
 *                                         `commit` writes onto the attack message BEFORE the dice
 * The order on the offer is registration order, i.e. the entry's import order.
 */
const offerParts = [];

/** Declare a contribution to the damage offer. Called at module evaluation by a machine. */
export function registerOfferPart(part) {
  offerParts.push(part);
}

/** Is any contribution waiting on a decision for this hit? The offer opens for it whatever the auto-damage setting. */
function offerPartsDue(attackMessage, activity) {
  return offerParts.some(p => {
    try { return !!p.due?.(attackMessage, activity); }
    catch(err) { console.error(`${TITLE} | An offer contribution (${p.key}) failed its due check.`, err); return false; }
  });
}

/** Every contribution's parts for this hit, in registration order, the failed ones dropped with a note. */
function offerPartsFor(attackMessage, activity, ctx) {
  const out = [];
  for ( const p of offerParts ) {
    try {
      const parts = p.parts?.(attackMessage, activity, ctx);
      if ( parts ) out.push(parts);
    } catch(err) {
      console.error(`${TITLE} | An offer contribution (${p.key}) failed to render — the offer opens without it.`, err);
    }
  }
  return out;
}

/** Ask the ATTACKER to roll their own damage, with a `damageTimer` buzzer that rolls it for them. */
export async function offerDamageRoll(activity, attackMessage) {
  // ⚠ The crit comes from `critFor` only, never re-derived from the d20 face.
  const crit = critFor(attackMessage);
  const isCritical = crit.isCritical;
  const against = againstLine(hitTargets(attackMessage));
  // Each pick is committed onto the attack message inside the roll thunk, BEFORE the dice.
  const parts = offerPartsFor(attackMessage, activity, { isCritical });

  // The popup leads with the hit (ARCHITECTURE.md §5 law 10); a riposte or precision re-drive names itself.
  const riposte = !!attackMessage.getFlag(MODULE_ID, "riposteFor");
  const precisionUsed = attackMessage.getFlag(MODULE_ID, "precision")?.outcome === "used";
  const headline = isCritical
    ? (riposte ? "Critical riposte! — roll damage" : "Critical hit! — roll damage")
    : (riposte ? "Your riposte hit! — roll damage" : "You hit! — roll damage");

  return offerRoll(attackMessage, {
    roll: async () => { for ( const p of parts ) await p.commit?.(); return rollDamageForAttack(activity, attackMessage); },
    windowTitle: headline,
    windowIcon: isCritical ? "fa-solid fa-burst" : "fa-solid fa-dice-d6",
    buttonLabel: isCritical ? "Roll Critical Damage" : "Roll Damage",
    buttonIcon: isCritical ? "fa-solid fa-burst" : "fa-solid fa-dice-d6",
    extraHTML: parts.map(p => p.html ?? "").join(""),
    wire: parts.some(p => p.wire) ? element => { for ( const p of parts ) p.wire?.(element); } : null,
    img: activity.item?.img,
    eyebrow: "Damage — your roll",
    title: headline,
    subtitle: `${activity.item?.name ?? "Attack"} — ${attackMessage.getAssociatedActor()?.name ?? ""}`,
    lines: [
      riposte ? `<strong>Riposte</strong> — the superiority die rides this roll${isCritical ? " and crit-doubles with it" : ""}.` : null,
      precisionUsed ? `<strong>Precision Attack</strong> turned the miss — this hit is yours to roll.` : null,
      ...parts.flatMap(p => p.lines ?? []),
      isCritical ? `${CRIT_BADGE} <span style="opacity:0.85;">${crit.auto && !crit.rolled
        ? `${crit.sources.map(s => s.label).join(" · ")} — set on the roll, nothing extra to do.`
        : "Already set on the roll — nothing extra to do."}</span>` : null,
      crit.dropped.length ? `<span style="opacity:0.85;">${crit.dropped.join(", ")} would take a Critical Hit (Paralyzed or Unconscious, within 5 feet), but this one roll also serves a target that would not — roll that damage by hand.</span>` : null,
      against
    ]
  });
}

/**
 * Ask the CASTER to roll a save spell's damage. No crit badge (no attack roll); the stakes line
 * takes its slot. Leaving the roll hanging is safe: `reconcileSaveDamage` applies in any order.
 * An area not placed yet is offered the roll anyway, targetless: only the application waits.
 * ⚠ The caller gates on `saveModulated` (excludes `onSave: "full"`), so rider damage never reaches here.
 */
export async function offerSaveDamageRoll(activity, card, { damageOnSave, targets, awaiting } = {}) {
  const against = againstLine(targets);
  // The save popup's own phrasing (saves.js), so caster and target read the same words.
  const stake = (damageOnSave === "half") ? "A successful save <strong>halves</strong> it."
    : (damageOnSave === "none") ? "A successful save avoids it <strong>entirely</strong>."
    : null;

  return offerRoll(card, {
    roll: () => rollDamageForSave(activity, card),
    windowTitle: "Roll damage",
    windowIcon: "fa-solid fa-dice-d6",
    buttonLabel: "Roll Damage",
    buttonIcon: "fa-solid fa-dice-d6",
    img: activity.item?.img,
    eyebrow: "Damage — your roll",
    title: "Roll your damage",
    subtitle: `${activity.item?.name ?? "Spell"} — ${activity.actor?.name ?? ""}`,
    lines: [
      stake,
      against,
      (awaiting && !against)
        ? `<span style="opacity:0.85;">The area is not placed yet — your dice can go first.</span>`
        : null
    ]
  });
}
