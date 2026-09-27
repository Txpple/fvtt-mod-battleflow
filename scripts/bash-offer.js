/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the bash OFFER, the `bash` fold's trigger — a listed
 * carrier's melee hit offers Shield Master's bash (and a `shove` feat's push); the save and the
 * Prone-or-push choice that follow are the saves machine's.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, inRunningCombat,
  combatStamp, statContext, drivesMomentFor } from "./core.js";
import { resolveUuid, foldEntryFor, itemNamed, dealtTypesOf, lower } from "./lookup.js";
import { maneuverFoldEntries } from "./settings.js";
import { RULE_TEXT, SHOVES } from "./decide/registry.js";
import { hitOfferStep, withinBashReach, sizeAllows } from "./decide/sequence.js";
import { nearestFeet, tokenForUuid, tokenOfActor } from "./geometry.js";
import { hitTargets, modeAllows, resolveAttackMessage } from "./shared.js";
import { popupKey, bfCard, holdBarHTML, ruleLine } from "./decide/present.js";
import { SURFACES } from "./surfaces.js";
import { CARD, isCard } from "./decide/card.js";
import { livePopups, openMomentPopup, momentButton, scheduleBarSync, shownMoments,
  armAskTimer, disarmAskTimer } from "./ui.js";

/* =============================================================================================
 * THE BASH OFFER — the HIT is the trigger: a Use/Pass offer stamped on the attacker's OWN attack
 * message (so the answer writes directly); accepting aims at the struck target and drives the
 * feat's save activity. Once per turn in combat; out of combat every hit offers.
 * ⚠ THE SEQUENCE (decide/sequence.js): stamped QUEUED at the hit, promoted to pending (the clock
 * starts) once the damage has landed and any mastery decision is answered; moot when nobody is
 * left standing. With every payout stage off nothing would promote it, so it opens at the hit.
 * ========================================================================================== */

const bashOfferTimers = new Map();
const bashOfferInFlight = new Set();

/**
 * The offer kinds. A `shove` has no save behind it: accepting announces the push (the token is
 * moved by hand, never by the module) and spends the turn's use.
 */
const OFFER_KINDS = Object.freeze({
  bash: { used: "bashUsed", eyebrow: "Maneuver", verb: "bash", use: "Use", icon: "fa-solid fa-shield-halved" },
  shove: { used: "shoveUsed", eyebrow: "Feat", verb: "push", use: "Push 5 feet", icon: "fa-solid fa-hand-back-fist" }
});

/** An Unarmed Strike — the attack's own classification (the pack's Tavern Brawler strike is a feat's activity). */
const isUnarmed = subject => subject?.attack?.type?.classification === "unarmed";

/** The SHOVES row a listed `shove` item runs by — Tavern Brawler's when the table does not name it. */
const shoveRowOf = name => Object.entries(SHOVES).find(([n]) => lower(n) === lower(name)) ?? ["Tavern Brawler", SHOVES["Tavern Brawler"]];

/** The first listed `shove` item whose row this hit fits and whose turn's use is unspent, or null. */
function shoveFor(subject, attacker, entries) {
  for ( const entry of entries.filter(e => e.kind === "shove") ) {
    const item = itemNamed(attacker, entry.name);
    if ( !item ) continue;
    const [name, row] = shoveRowOf(item.name);
    const fits = (row.on === "unarmed") ? (isUnarmed(subject) && (subject.attack?.type?.value === "melee"))
      : dealtTypesOf(subject).includes(row.on);
    if ( !fits ) continue;
    const used = attacker.getFlag(MODULE_ID, row.used);
    if ( used?.stamp && (used.stamp === combatStamp()) ) continue;   // once per turn, each feat its own
    return { kind: "shove", found: { entry, item }, activity: null, shoveRow: name };
  }
  return null;
}

/** Which offer this attack carries, and from what — `{ kind, found, activity, shoveRow? }` or null. */
function offerFor(subject, attacker) {
  const entries = maneuverFoldEntries();
  const shove = shoveFor(subject, attacker, entries);
  if ( shove ) return shove;
  if ( subject.attack?.type?.value !== "melee" ) return null;
  if ( subject.item?.type !== "weapon" ) return null;             // feat and spell attacks never bash
  const found = foldEntryFor(attacker, "bash", entries);
  const activity = found?.item.system.activities?.contents?.find(a => a.type === "save") ?? null;
  return activity ? { kind: "bash", found, activity } : null;
}

Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  try {
    if ( !subject || (subject.type !== "attack") ) return;
    const attacker = subject.actor;
    const message = rolls?.[0]?.parent;
    if ( !attacker || !(message instanceof ChatMessage) ) return;
    if ( message.getFlag(MODULE_ID, "bashOffer") ) return;       // never re-stamp
    if ( message.getFlag(MODULE_ID, "riposteFor") ) return;      // a driven attack never chains the offer
    if ( !modeAllows(attacker) ) return;
    const offer = offerFor(subject, attacker);
    if ( !offer ) return;
    const { kind, found, activity, shoveRow = null } = offer;
    const row = shoveRow ? SHOVES[shoveRow] : null;
    const used = attacker.getFlag(MODULE_ID, OFFER_KINDS[kind].used);
    if ( !row && used?.stamp && (used.stamp === combatStamp()) ) return; // once per turn (a shove row judged its own)
    const sizes = Object.keys(CONFIG.DND5E?.actorSizes ?? {});
    const hits = hitTargets(message);
    if ( !hits.length ) return;
    const attackerToken = tokenOfActor(attacker);
    const living = [];
    for ( const t of hits ) {
      const a = await fromUuid(t.uuid).catch(() => null);
      if ( !(a instanceof Actor) ) continue;
      if ( a.statuses?.has?.("dead") ) continue;
      if ( (a.type === "npc") && ((a.system.attributes?.hp?.value ?? 0) <= 0) ) continue;
      // "a creature within 5 feet of you", measured at the hit: a reach or thrown hit carries no bash.
      const token = tokenForUuid(t.uuid);
      if ( (!row || row.reach) && !withinBashReach((attackerToken && token) ? nearestFeet(attackerToken, token) : null) ) continue;
      // Crusher's "no more than one size larger than you"
      if ( row && !sizeAllows(sizes, attacker.system?.traits?.size ?? null, a.system?.traits?.size ?? null, row.larger) ) continue;
      living.push({ uuid: t.uuid, name: t.name });
    }
    if ( !living.length ) return;
    // Queued behind the damage unless nothing downstream would ever promote it.
    const sequenced = setting(S.autoApply) || setting(S.effectRiders) || setting(S.masteryRiders);
    await message.setFlag(MODULE_ID, "bashOffer", {
      status: sequenced ? "queued" : "pending", answer: null, kind, ...(shoveRow ? { shoveRow } : {}),
      itemId: found.item.id, activityId: activity?.id ?? null,
      itemName: found.item.name, itemImg: found.item.img,
      attackerUuid: attacker.uuid, targets: living,
      ...statContext(attacker.uuid), // the data-plane stamp
      ...(sequenced ? {} : offerClock())
    });
    if ( !sequenced ) armBashOfferTimer(message);
  } catch(err) {
    console.error(`${TITLE} | Bash offer stamp failed.`, err);
  }
});

const armBashOfferTimer = message =>
  armAskTimer(bashOfferTimers, message, "bashOffer", live => answerBashOffer(live, "pass", { timedOut: true }));

/** The offer's window and deadline, read at the moment the clock STARTS. */
function offerClock() {
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  return window ? { window, deadline: Date.now() + (window * 1000) } : {};
}

/* --- THE SEQUENCE: queued at the hit, promoted after the damage and the mastery's decision --- */

/** Is there a damage message for this attack? (The chokepoint calls in only after its stages ran.) */
function damageLandedFor(attackMessage) {
  return game.messages.contents.some(m => isCard(m, CARD.damage)
    && (resolveAttackMessage(m)?.id === attackMessage.id));
}

/** The facts the decision reads, gathered from the attack message and the world. */
async function offerFacts(attackMessage, { damageLanded } = {}) {
  const b = attackMessage.getFlag(MODULE_ID, "bashOffer");
  if ( !b ) return null;
  let living = 0;
  const standing = [];
  for ( const t of (b.targets ?? []) ) {
    const a = await fromUuid(t.uuid).catch(() => null);
    if ( !(a instanceof Actor) ) continue;
    if ( a.statuses?.has?.("dead") ) continue;
    if ( (a.type === "npc") && ((a.system.attributes?.hp?.value ?? 0) <= 0) ) continue;
    standing.push(t);
    living += 1;
  }
  return {
    status: b.status,
    masteryStatus: attackMessage.getFlag(MODULE_ID, "mastery")?.status ?? null,
    damageLanded: damageLanded ?? damageLandedFor(attackMessage),
    living, standing
  };
}

/**
 * Move a queued offer along, on the attacker's driver. Idempotent, so the chokepoint, the mastery
 * watcher and the render resume can all call it. Promotion starts the clock; moot resolves quietly.
 */
export async function sequenceBashOffer(attackMessage, { damageLanded } = {}) {
  try {
    const facts = await offerFacts(attackMessage, { damageLanded });
    if ( !facts ) return;
    const step = hitOfferStep(facts);
    if ( (step === "wait") || (step === "none") ) return;
    let moved = false;
    await queueFlagWrite(attackMessage, "bashOffer", current => {
      if ( current.status !== "queued" ) return;
      if ( step === "promote" ) {
        Object.assign(current, offerClock());
        current.targets = facts.standing;
        current.promotedAt = Date.now();
        current.status = "pending";
      } else {
        current.status = "moot";
        current.mootAt = Date.now();
      }
      moved = true;
    });
    if ( moved && (step === "promote") ) armBashOfferTimer(attackMessage);
  } catch(err) {
    console.error(`${TITLE} | Bash offer sequencing failed.`, err);
  }
}

/** Has the offer's driven usage already happened? The provenance flag is the receipt. */
const bashDriven = messageId => game.messages.contents.some(m =>
  m.getFlag(MODULE_ID, "bashFor") === messageId);

async function answerBashOffer(message, answer, { targetUuid = null, timedOut = false } = {}) {
  let claimed = false;
  await queueFlagWrite(message, "bashOffer", current => {
    if ( (current.status !== "pending") || current.answer ) return;
    current.answer = answer;
    current.answeredAt = Date.now();   // the crash-resume horizon
    if ( targetUuid ) current.targetUuid = targetUuid;
    if ( timedOut ) current.timedOut = true;
    current.status = "resolved";
    claimed = true;
  });
  if ( !claimed || (answer !== "use") ) return;
  await resolveBashOffer(message);
}

/** The accept path: aim at the struck target and drive the feat's OWN save activity. */
async function resolveBashOffer(message) {
  if ( bashOfferInFlight.has(message.id) ) return;
  bashOfferInFlight.add(message.id);
  try {
    const flag = message.getFlag(MODULE_ID, "bashOffer");
    if ( !flag || (flag.answer !== "use") ) return;
    if ( bashDriven(message.id) ) return;                        // idempotent — the usage exists
    const attacker = await fromUuid(flag.attackerUuid).catch(() => null);
    if ( flag.kind === "shove" ) { if ( attacker instanceof Actor ) await announceShove(message, flag, attacker); return; }
    const item = attacker?.items?.get(flag.itemId);
    const activity = item?.system.activities?.get?.(flag.activityId)
      ?? item?.system.activities?.contents?.find(a => a.id === flag.activityId);
    if ( !(attacker instanceof Actor) || !activity ) return;
    const targetUuid = flag.targetUuid ?? flag.targets?.[0]?.uuid ?? null;
    const token = canvas.tokens?.placeables?.find(t => t.actor?.uuid === targetUuid);
    const priorTargets = [...game.user.targets].map(t => t.id);
    if ( token ) {
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: false }); });
      token.setTarget(true, { releaseOthers: true });
    }
    try {
      await activity.use({ subsequentActions: false }, { configure: false }, {
        data: { flags: { [MODULE_ID]: { bashFor: message.id } } }
      });
      if ( inRunningCombat(attacker) ) {
        const stamp = combatStamp();
        if ( stamp ) void attacker.setFlag(MODULE_ID, "bashUsed", { stamp });
      }
    } finally {
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: false }); });
      for ( const id of priorTargets ) canvas.tokens?.get(id)?.setTarget(true, { releaseOthers: false });
    }
  } catch(err) {
    console.error(`${TITLE} | Bash offer resolution failed.`, err);
  } finally {
    bashOfferInFlight.delete(message.id);
  }
}

/** The shove's accept: the push announced on a card carrying `bashFor` (so it is found done), the turn's use spent. */
async function announceShove(message, flag, attacker) {
  const targetUuid = flag.targetUuid ?? flag.targets?.[0]?.uuid ?? null;
  const target = (flag.targets ?? []).find(t => t.uuid === targetUuid) ?? flag.targets?.[0] ?? null;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: bfCard({ img: flag.itemImg, eyebrow: `Feat — ${flag.itemName}`, tone: "good",
      title: `${attacker.name} pushes ${target?.name ?? "the target"} 5 feet`, subtitle: "Move the token by hand" }),
    flags: { [MODULE_ID]: { bashFor: message.id } }
  });
  if ( inRunningCombat(attacker) ) {
    const stamp = combatStamp();
    // Each feat its own turn's mark, written by literal name so the moments check sees both.
    if ( stamp && (shoveRowOf(flag.shoveRow ?? "Tavern Brawler")[1].used === "crushUsed") ) await attacker.setFlag(MODULE_ID, "crushUsed", { stamp });
    else if ( stamp ) await attacker.setFlag(MODULE_ID, "shoveUsed", { stamp });
  }
}

/** The Use/Pass popup — a target select only when the swing struck more than one. */
async function showBashOfferPopup(message, flag) {
  const attacker = resolveUuid(flag.attackerUuid);
  const kind = OFFER_KINDS[flag.kind] ?? OFFER_KINDS.bash;
  const options = flag.targets ?? [];
  const selectHTML = (options.length > 1) ? `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">${flag.kind === "shove" ? "Push" : "Bash"}</label>
      <select name="bf-bash-target" style="flex:1;min-width:0;">${options
        .map(o => `<option value="${o.uuid}">${o.name}</option>`).join("")}</select>
    </div>` : "";
  let dialog;
  const answer = kind => answerBashOffer(message, kind, {
    targetUuid: dialog?.element?.querySelector('select[name="bf-bash-target"]')?.value
      ?? options[0]?.uuid ?? null
  });
  const shove = flag.kind === "shove";
  dialog = await openMomentPopup(message, "bashoffer", attacker, {
    title: `${flag.itemName} — ${attacker?.name ?? ""}`, icon: kind.icon,
    content: bfCard({
      img: flag.itemImg, eyebrow: `${kind.eyebrow} — ${flag.itemName}`, tone: "pending",
      title: `${flag.itemName} — ${kind.verb} ${options.length === 1 ? options[0].name : "the target"}${shove ? " 5 feet" : ""}?`,
      lines: [ruleLine(shove ? (RULE_TEXT[shoveRowOf(flag.shoveRow ?? "Tavern Brawler")[1].rule] ?? RULE_TEXT.shove) : RULE_TEXT.bash)]
    }) + selectHTML + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "use", label: shove ? kind.use : `Use ${flag.itemName}`, default: true, callback: () => answer("use") },
      { action: "pass", label: "Pass", callback: () => answer("pass") }
    ]
  });
}


/* --- THE ROW, THE WATCHER, THE CLEANUP --------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const b = message.getFlag(MODULE_ID, "bashOffer");
  if ( b ) {
    const row = document.createElement("div");
    row.className = "battleflow-maneuver";
    const pending = b.status === "pending";
    const queued = b.status === "queued";
    const kind = OFFER_KINDS[b.kind] ?? OFFER_KINDS.bash;
    const title = pending ? `${b.itemName} — offered on the hit`
      : queued ? `${b.itemName} — offered after the damage`
      : (b.status === "moot") ? `${b.itemName} — no one left to ${kind.verb}`
      : (b.answer === "use" ? `${b.itemName} — ${b.kind === "shove" ? "pushed 5 feet" : "used"}` : `${b.itemName} — passed${b.timedOut ? " (timer)" : ""}`);
    row.innerHTML = bfCard({
      img: b.itemImg, eyebrow: `${kind.eyebrow} — ${b.itemName}`,
      tone: (pending || queued) ? "pending" : (b.answer === "use" ? "good" : "neutral"),
      title,
      subtitle: (b.targets ?? []).map(t => t.name).join(", ")
    }) + (pending ? holdBarHTML(b, "to answer") : "");
    html.querySelector(SURFACES.messageContent)?.appendChild(row);
    // Resume: a queued offer whose damage landed while nobody was driving.
    if ( queued && drivesMomentFor(b.attackerUuid) ) void sequenceBashOffer(message);
    if ( pending ) {
      scheduleBarSync(row);
      armBashOfferTimer(message);
      const attacker = resolveUuid(b.attackerUuid);
      if ( canAnswerFor(attacker) && !b.answer ) {
        const shownKey = popupKey(message.id, "bashoffer");
        if ( !shownMoments.has(shownKey) ) {
          shownMoments.add(shownKey);
          void showBashOfferPopup(message, b);
        }
        row.appendChild(momentButton("Answer", () => {
          void showBashOfferPopup(message, message.getFlag(MODULE_ID, "bashOffer"));
        }, { margin: "0.25rem 0 0" }));
      }
    }
    // Crash-resume on the GM: accepted 20s ago with no driven usage in the log.
    if ( (b.answer === "use") && isActiveGM() && b.answeredAt
      && (Date.now() - b.answeredAt > 20_000) && !bashDriven(message.id) ) {
      void resolveBashOffer(message);
    }
  }
});

// Every client closes answered popups; the timers disarm when nothing is pending.
Hooks.on("updateChatMessage", message => {
  const b = message.getFlag(MODULE_ID, "bashOffer");
  if ( b ) {
    const dialog = livePopups.get(popupKey(message.id, "bashoffer"));
    if ( dialog && ((b.status !== "pending") || b.answer) ) void dialog.close();
    if ( b.status !== "pending" ) disarmAskTimer(bashOfferTimers, message.id);
    // The sequence's second trigger: the mastery ask on this attack message just settled.
    if ( (b.status === "queued") && drivesMomentFor(b.attackerUuid)
      && (message.getFlag(MODULE_ID, "mastery")?.status === "done") ) void sequenceBashOffer(message);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clock disarms here.
Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(bashOfferTimers, message.id);
});
