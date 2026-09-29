// @ts-check
/**
 * Battle Flow — auto-roll damage on hit (the attacker's client) and the damage offer popup.
 * Owns the one crit judgement (`critFor`). Split shape (ARCHITECTURE.md §7).
 */
import { MODULE_ID, TITLE, S, setting, decisionWindow, drivesMomentFor } from "./core.js";
import { missShareFor, resolveUuid } from "./lookup.js";
import { hitTargets } from "./shared.js";
import { TONE, esc, popupKey, bfCard, momentBarHTML } from "./decide/present.js";
import { livePopups, offerParts, openManagedPopup } from "./ui.js";
import { CONDITION_BENDS } from "./decide/registry.js";
import { autoCritSources } from "./decide/reminders.js";
import { critStands } from "./decide/rescue-hit.js";
import { CARD, isCard, originData, originIdInData, originIdOf } from "./decide/card.js";
import { nearestFeet, tokenForUuid, tokenOfActor } from "./geometry.js";
import { stampHoldIfInterrupted, stampMissHoldIfBystanders } from "./hold/index.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

/** The "Against …" line. ⚠ The inline `display:inline-block` outranks the dialog stylesheet's block imgs. */
const againstLine = targets => {
  const list = (targets ?? []).filter(t => t?.name);
  if ( !list.length ) return null;
  return `Against ${list.map(t =>
    `${t.img ? `<img src="${esc(t.img)}" alt="${esc(t.name)}" data-tooltip="${esc(t.name)}"
      style="display:inline-block;width:18px;height:18px;border:none;border-radius:3px;object-fit:cover;vertical-align:-4px;margin:0 2px 0 0;">` : ""}<strong>${esc(t.name)}</strong>`).join(", ")}.`;
};

/* --- Auto-roll damage on hit ---------------------------------------------------------------- */

listen("dnd5e.rollAttack", "auto-damage", async (rolls, { subject }) => {
  if ( !subject ) return;

  const attackMessage = rolls[0]?.parent;
  if ( !(attackMessage instanceof ChatMessage) ) return; // rolled with create:false — no chain to ride

  // Mirror the native card: no damage parts and no ammo means no Damage button.
  if ( !subject.damage?.parts?.length && !subject.item?.system.properties?.has("amm") ) return;

  const hits = hitTargets(attackMessage);
  // A clean miss a bystander could turn (Guided Strike): held for them; a turned miss rolls at the resolve.
  if ( !hits.length ) {
    if ( await stampMissHoldIfBystanders(attackMessage, rolls[0]) ) return;
    // A miss that still pays (Potent Cantrip): rolled now unless a rescue window is about to open on it.
    if ( missShareFor(subject) && !rescueComing(subject, attackMessage, rolls[0]) ) {
      const beat = (Math.max(0, Number(setting(S.dramaticBeat)) || 0)) * 1000;
      setTimeout(() => void rollMissShare(subject, attackMessage), beat);
    }
    return;
  }

  // A hold pauses the APPLICATION, never the dice: the roll is born attackHoldPending.
  await stampHoldIfInterrupted(attackMessage, rolls[0], hits);
  // Except a crit a Disadvantage reaction could undo: `damageAfterHold` rolls it.
  if ( attackMessage.getFlag(MODULE_ID, "hold")?.critAtStake ) return;
  return offerOrRollDamage(subject, attackMessage);
});

/* --- A miss that still pays (EVASIONS `onMiss` — Potent Cantrip) ------------------------------ */
// ⚠ ROLLED ONCE THE MISS IS FINAL: a rescue that could turn it (the d20 fold, Precision) says so AT THE ROLL,
// synchronously (a machine's stamp lands after this listener); its resolve — or the bystander hold's — is an
// update on the attack card, read below. The applier (auto-apply.js) lands the share on the missed targets.

/** `(subject, attackMessage, roll) => boolean`: a machine that will open a rescue on this clean miss. */
const missWaits = [];
/** A machine that may reopen a clean miss registers the synchronous half of its stamp. */
export function registerMissWait(fn) { missWaits.push(fn); }
const rescueComing = (subject, message, roll) => missWaits.some(fn => {
  try { return !!fn(subject, message, roll); } catch(err) { console.warn(`${TITLE} | A miss wait failed — the miss's share waits for nothing.`, err); return false; }
});

/** The attack-card flags that hold a miss open while pending. */
const MISS_HOLDERS = ["hold", "d20fold", "precision"];
const missSettled = message => MISS_HOLDERS.every(k => message.getFlag(MODULE_ID, k)?.status !== "pending");
const missShareRolled = new Set();

/** The miss's damage, rolled like a hit's (the applier deals the share); once, and never beside a hit's roll. */
async function rollMissShare(activity, attackMessage) {
  if ( missShareRolled.has(attackMessage.id) ) return;
  if ( hitTargets(attackMessage).length || !missSettled(attackMessage) ) return;
  // A rescue still to stamp (its flag not yet landed) holds it too.
  if ( rescueComing(activity, attackMessage, attackMessage.rolls?.[0]) ) return;
  if ( game.messages.contents.some(m => (m.type === "damage") && (m.getFlag(MODULE_ID, "attackFor") === attackMessage.id)) ) return;
  missShareRolled.add(attackMessage.id);
  await rollDamageForAttack(activity, attackMessage);
}

/**
 * The miss settled — a rescue or a hold resolved with it standing, or a machine that said it would open one
 * found nothing to offer: the share rolls now, on the attacker's driver. Idempotent.
 * @param {ChatMessage} attackMessage
 */
export function settleMiss(attackMessage) {
  try {
    if ( !isCard(attackMessage, CARD.attack) ) return;
    const activity = attackMessage.getAssociatedActivity?.() ?? null;
    if ( !missShareFor(activity) ) return;
    if ( !drivesMomentFor(attackMessage.getAssociatedActor?.()?.uuid ?? null) ) return;
    void rollMissShare(activity, attackMessage);
  } catch(err) {
    console.error(`${TITLE} | The miss's share could not be rolled — roll the damage from the card.`, err);
  }
}

listen("updateChatMessage", "auto-damage", (message, changes) => {
  const touched = changes?.flags?.[MODULE_ID];
  if ( touched && MISS_HOLDERS.some(k => (k in touched) || (`-=${k}` in touched)) ) settleMiss(message);
});

/** The damage after a hit: offered to the attacker, or rolled after the dramatic beat. One path for every hit. */
function offerOrRollDamage(subject, attackMessage) {
  // The offer replaces the beat; a pending contribution decision opens it whatever the setting.
  if ( setting(S.playerRollDamage) || offerPartsDue(attackMessage, subject) ) {
    return void offerDamageRoll(subject, attackMessage);
  }

  const beat = (Math.max(0, Number(setting(S.dramaticBeat)) || 0)) * 1000;
  setTimeout(() => rollDamageForAttack(subject, attackMessage), beat);
}

/**
 * The crit the hold held back, once it resolved: offered or rolled as at the hit, if it still hits.
 * @param {ChatMessage} attackMessage
 */
export async function damageAfterHold(attackMessage) {
  try {
    if ( !hitTargets(attackMessage).length ) return;
    // Rolled already (a fold on the same miss got there first): never twice.
    if ( game.messages.contents.some(m => (m.type === "damage") && (m.getFlag(MODULE_ID, "attackFor") === attackMessage.id)) ) return;
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

/**
 * THE crit, one source for every roll path and the badge: the d20's own, or a condition's auto-crit
 * (RULINGS *The gate before the roll*). ⚠ One roll serves every hit target: the crit needs ALL of them.
 * @param {ChatMessage} attackMessage
 * @returns {{isCritical: boolean, rolled: boolean, undone: boolean, auto: boolean,
 *            sources: {status: string, label: string, rule: object|string|null}[], dropped: string[]}}
 */
function critFor(attackMessage) {
  const d20Crit = attackMessage?.rolls?.[0]?.isCritical ?? false;
  // A natural 20 a defender's Disadvantage undid doubles only if it stands for every hit target.
  const rolled = d20Crit && rolledCritStands(attackMessage);
  /** @type {ReturnType<typeof critFor>} */
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

/** The attack an about-to-roll damage answers, from the message DATA: `attackFor`, else the clicked card's last attack. */
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

// The card's own Damage button honours the crit: `applyKeybindings` runs AFTER this hook and
// stamps `config.isCritical` onto every roll.
listen("dnd5e.preRollDamage", "auto-damage", (config, _dialog, message) => {
  try {
    if ( config?.subject?.type !== "attack" ) return;
    // ⚠ The activity's own roll count, before any rider pushes one: this handler runs first on the
    // hook (dispatch.js ORDER). Savage Attacker rerolls only these.
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.weaponRolls`, config.rolls?.length ?? 0);
    const attackMessage = attackMessageForDamage(config, message);
    if ( !attackMessage ) return;
    const crit = critFor(attackMessage);
    if ( crit.undone && !crit.auto ) { config.isCritical = false; return; }
    if ( !crit.auto ) return;
    config.isCritical = true;
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.autoCrit`,
      { sources: crit.sources.map(s => ({ status: s.status, label: s.label })), attackId: attackMessage.id });
  } catch(err) {
    console.error(`${TITLE} | Automatic crit failed to apply — the d20's own verdict stands.`, err);
  }
});

// The damage card says why it doubled (R5).
listen("dnd5e.renderChatMessage", "auto-damage", (message, html) => {
  const auto = message.getFlag(MODULE_ID, "autoCrit");
  if ( !auto?.sources?.length ) return;
  const line = document.createElement("div");
  line.style.cssText = "margin:0.3rem 0;font-size:var(--font-size-12,12px);line-height:1.5;";
  line.innerHTML = `${CRIT_BADGE} <span style="opacity:0.85;">${esc(auto.sources.map(s => s.label).join(" · "))}</span>`;
  html.querySelector(SURFACES.messageContent)?.appendChild(line);
});

/**
 * Press the Damage button as AttackActivity#rollDamage does, crit pre-set, no dialog.
 * ⚠ The origin is stamped explicitly (no click to inherit it); without it auto-apply cannot chain.
 */
export async function rollDamageForAttack(activity, attackMessage) {
  try {
    const { ability, mode: attackMode, ammunitionItem: ammunition } = attackMessage.system ?? {};
    const isCritical = critFor(attackMessage).isCritical;
    const originId = originIdOf(attackMessage) ?? attackMessage.id;
    // `attackFor` names the exact attack (a volley's rays share one usage card). The hold is read at
    // ROLL time, so one resolved while the popup sat open applies straight.
    const holdPending = attackMessage.getFlag(MODULE_ID, "hold")?.status === "pending";
    // ⚠ Stamps ride NESTED under `flags`: data with both nested and dotted module flags keeps only the nested.
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
 * Roll a SAVE activity's damage, chained to its usage card; auto-roll and button share it.
 * ⚠ The origin is stamped explicitly, or the verdict fold never finds the roll.
 */
export async function rollDamageForSave(activity, card) {
  try {
    // The upcast: the demand's (an emanation's demand is a plain card), else the usage card's.
    const scaling = Number(card.getFlag(MODULE_ID, "saves")?.scaling ?? card.system?.scaling ?? 0);
    // ⚠ The card's OWN targets ride the roll: dnd5e snapshots the client's live targets, which may have changed.
    const data = foundry.utils.expandObject(originData(card.id));
    const aimed = card._source?.system?.targets;
    if ( Array.isArray(aimed) && aimed.length ) foundry.utils.setProperty(data, "system.targets", foundry.utils.deepClone(aimed));
    await activity.rollDamage(scaling > 0 ? { scaling } : {}, { configure: false }, { data });
  } catch(err) {
    console.error(`${TITLE} | Could not auto-roll the save spell's damage.`, err);
  }
}

/* --- The player's own roll: offered on the client that acted, nothing crosses the wire ------- */
// ⚠ Button and buzzer call the SAME roll function as the auto-roll; never add a popup-only variant.
// ⚠ The window is a `setTimeout` on one client: a reload mid-popup loses the roll (the GM rolls by hand).

/** The offer's window in seconds; 0 waits indefinitely and draws no bar. */
const playerRollWindow = () => decisionWindow();

const CRIT_BADGE = `<span style="display:inline-block;padding:0.05rem 0.45rem;border-radius:3px;
  background:${TONE.crit};color:#111;font-weight:bold;letter-spacing:0.07em;
  font-size:var(--font-size-11,11px);text-transform:uppercase;">&#10022; Critical Hit</span>`;

/**
 * The shell every damage offer wears: button, X and buzzer funnel through ONE `roll`; one popup per card.
 * @param {any} message
 * @param {{roll: () => any, windowTitle: string, windowIcon: string, buttonLabel: string, buttonIcon: string,
 *   extraHTML?: string, wire?: ((element: any) => void)|null, img?: string|null, eyebrow?: string, title?: string,
 *   subtitle?: string, lines?: (string|null|undefined|false)[]}} opts
 */
async function offerRoll(message, { roll, windowTitle, windowIcon, buttonLabel, buttonIcon, extraHTML = "", wire = null, ...card }) {
  const key = popupKey(message.id, "damage");
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }

  const window = playerRollWindow();
  const deadline = window ? Date.now() + (window * 1000) : null;

  // Stamped on the card so every client draws the bar.
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
    // ⚠ DialogV2 sizes to content: long menus scroll in a bounded box so Roll stays on screen.
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

  // The buzzer, armed even if the popup never renders.
  if ( window ) setTimeout(() => { void dialog.close(); }, window * 1000);

  await openManagedPopup(key, message, dialog);

  // A failed render leaves nothing to press (the native Damage button is hidden): roll now.
  if ( livePopups.get(key) !== dialog ) return fire();
  if ( wire ) { try { wire(dialog.element); } catch(err) { console.error(`${TITLE} | Offer controls failed to wire.`, err); } }
}

/* The offer's contributions are declared by machines at their evaluation, into ui.js's registry
 * (`registerOfferPart`); this service reads them in registration order. */

function offerPartsDue(attackMessage, activity) {
  return offerParts.some(p => {
    try { return !!p.due?.(attackMessage, activity); }
    catch(err) { console.error(`${TITLE} | An offer contribution (${p.key}) failed its due check.`, err); return false; }
  });
}

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
  const parts = offerPartsFor(attackMessage, activity, { isCritical });

  // The popup leads with the hit (ARCHITECTURE.md §5 law 10).
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
 * Ask the CASTER to roll a save spell's damage; `reconcileSaveDamage` applies in any order, and an
 * unplaced area is offered targetless. ⚠ The caller gates on `saveModulated`: rider damage never gets here.
 * @param {any} activity
 * @param {any} card
 * @param {{damageOnSave?: string|null, targets?: object[], awaiting?: boolean}} [opts]
 */
export async function offerSaveDamageRoll(activity, card, { damageOnSave, targets, awaiting } = {}) {
  const against = againstLine(targets);
  // The save popup's own phrasing (saves.js).
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
