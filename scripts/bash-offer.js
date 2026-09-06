/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the bash OFFER, the `bash` fold's trigger
 * (v1.19.x, walk finding (g)) — a listed carrier's melee hit offers Shield Master's bash; the
 * save and the Prone-or-push choice that follow are the saves machine's.
 * The machine-tier pass, Stage 4a (2026-09-05): split out of maneuvers.js by MOMENT — one
 * feature per file, the shared readers in lookup.js, the rules text in decide/registry.js. Every
 * body here is the one maneuvers.js carried; nothing was rewritten.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, inRunningCombat,
  combatStamp, statContext } from "./core.js";
import { resolveUuid, foldEntryFor } from "./lookup.js";
import { maneuverFoldEntries } from "./settings.js";
import { RULE_TEXT } from "./decide/registry.js";
import { hitTargets, modeAllows } from "./shared.js";
import { popupKey, bfCard, holdBarHTML, ruleLine } from "./decide/present.js";
import { livePopups, openMomentPopup, momentButton, scheduleBarSync, shownMoments,
  armAskTimer, disarmAskTimer } from "./ui.js";

/* =============================================================================================
 * THE BASH OFFER (v1.19.x, walk finding (g)) — the HIT is the trigger. The first walk's
 * item 8 drove Shield Bash from the sheet; the table hit with the sword and expected the
 * offer ("shield bash never triggered a popup attacking combat dummy"). RAW agrees: "if
 * you attack... and hit with a Melee weapon, you can immediately bash." A melee weapon hit
 * by a listed `bash` carrier stamps a Use/Pass offer on the attacker's OWN attack message
 * (their message, so the answer writes directly — the precision locality); accepting aims
 * at the struck target and drives the feat's save activity, and everything downstream (the
 * demand, the failure's Prone-or-push choice) is the machinery that already exists. Once
 * per turn in combat (the feat's own clause, the Cleave stamp discipline); out of combat
 * every hit offers — "we don't have timers and combat rounds yet".
 * ========================================================================================== */

const bashOfferTimers = new Map();
const bashOfferInFlight = new Set();

Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  try {
    if ( !subject || (subject.type !== "attack") ) return;
    if ( subject.item?.type !== "weapon" ) return;               // feat and spell attacks never bash
    if ( subject.attack?.type?.value !== "melee" ) return;
    const attacker = subject.actor;
    const message = rolls?.[0]?.parent;
    if ( !attacker || !(message instanceof ChatMessage) ) return;
    if ( message.getFlag(MODULE_ID, "bashOffer") ) return;       // never re-stamp
    if ( message.getFlag(MODULE_ID, "riposteFor") ) return;      // a driven attack never chains the offer
    if ( !modeAllows(attacker) ) return;
    const found = foldEntryFor(attacker, "bash", maneuverFoldEntries());
    if ( !found ) return;
    const activity = found.item.system.activities?.contents?.find(a => a.type === "save");
    if ( !activity ) return;
    const used = attacker.getFlag(MODULE_ID, "bashUsed");
    if ( used?.stamp && (used.stamp === combatStamp()) ) return; // once on each of your turns
    const hits = hitTargets(message);
    if ( !hits.length ) return;
    const living = [];
    for ( const t of hits ) {
      const a = await fromUuid(t.uuid).catch(() => null);
      if ( !(a instanceof Actor) ) continue;
      if ( a.statuses?.has?.("dead") ) continue;
      if ( (a.type === "npc") && ((a.system.attributes?.hp?.value ?? 0) <= 0) ) continue;
      living.push({ uuid: t.uuid, name: t.name });
    }
    if ( !living.length ) return;                                // a corpse cannot be bashed (the dead gate)
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await message.setFlag(MODULE_ID, "bashOffer", {
      status: "pending", answer: null,
      itemId: found.item.id, activityId: activity.id,
      itemName: found.item.name, itemImg: found.item.img,
      attackerUuid: attacker.uuid, targets: living,
      ...statContext(attacker.uuid), // the data-plane stamp
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    });
    armBashOfferTimer(message);
  } catch(err) {
    console.error(`${TITLE} | Bash offer stamp failed.`, err);
  }
});

const armBashOfferTimer = message =>
  armAskTimer(bashOfferTimers, message, "bashOffer", live => answerBashOffer(live, "pass", { timedOut: true }));

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

/** The accept path: aim at the struck target, drive the feat's OWN save activity — the
 * demand and the Prone-or-push choice are the existing machinery from here. */
async function resolveBashOffer(message) {
  if ( bashOfferInFlight.has(message.id) ) return;
  bashOfferInFlight.add(message.id);
  try {
    const flag = message.getFlag(MODULE_ID, "bashOffer");
    if ( !flag || (flag.answer !== "use") ) return;
    if ( bashDriven(message.id) ) return;                        // idempotent — the usage exists
    const attacker = await fromUuid(flag.attackerUuid).catch(() => null);
    const item = attacker?.items?.get(flag.itemId);
    const activity = item?.system.activities?.get?.(flag.activityId)
      ?? item?.system.activities?.contents?.find(a => a.id === flag.activityId);
    if ( !(attacker instanceof Actor) || !activity ) return;
    const targetUuid = flag.targetUuid ?? flag.targets?.[0]?.uuid ?? null;
    const token = canvas.tokens?.placeables?.find(t => t.actor?.uuid === targetUuid);
    const priorTargets = [...game.user.targets].map(t => t.id);
    if ( token ) {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
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
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      for ( const id of priorTargets ) canvas.tokens?.get(id)?.setTarget(true, { releaseOthers: false });
    }
  } catch(err) {
    console.error(`${TITLE} | Bash offer resolution failed.`, err);
  } finally {
    bashOfferInFlight.delete(message.id);
  }
}

/** The Use/Pass popup — a target select only when the swing struck more than one. */
async function showBashOfferPopup(message, flag) {
  const attacker = resolveUuid(flag.attackerUuid);
  const options = flag.targets ?? [];
  const selectHTML = (options.length > 1) ? `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">Bash</label>
      <select name="bf-bash-target" style="flex:1;min-width:0;">${options
        .map(o => `<option value="${o.uuid}">${o.name}</option>`).join("")}</select>
    </div>` : "";
  let dialog;
  const answer = kind => answerBashOffer(message, kind, {
    targetUuid: dialog?.element?.querySelector('select[name="bf-bash-target"]')?.value
      ?? options[0]?.uuid ?? null
  });
  dialog = await openMomentPopup(message, "bashoffer", attacker, {
    title: `${flag.itemName} — ${attacker?.name ?? ""}`, icon: "fa-solid fa-shield-halved",
    content: bfCard({
      img: flag.itemImg, eyebrow: `Maneuver — ${flag.itemName}`, tone: "pending",
      title: `${flag.itemName} — bash ${options.length === 1 ? options[0].name : "the target"}?`,
      // (z): the rule line is the feat's own passage, verbatim — trigger, either/or and the
      // once-a-turn limit all in the feature's words.
      lines: [ruleLine(RULE_TEXT.bash)]
    }) + selectHTML + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "use", label: `Use ${flag.itemName}`, default: true, callback: () => answer("use") },
      { action: "pass", label: "Pass", callback: () => answer("pass") }
    ]
  });
}


/* =============================================================================================
 * THE ROW, THE WATCHER, THE CLEANUP — maneuvers.js's shared plumbing, this offer's slice of it.
 * ========================================================================================== */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  // --- Bash offer: one row on the attacker's own attack card (finding (g)) -----------------
  const b = message.getFlag(MODULE_ID, "bashOffer");
  if ( b ) {
    const row = document.createElement("div");
    row.className = "battleflow-maneuver";
    const pending = b.status === "pending";
    row.innerHTML = bfCard({
      img: b.itemImg, eyebrow: `Maneuver — ${b.itemName}`,
      tone: pending ? "pending" : (b.answer === "use" ? "good" : "neutral"),
      title: pending ? `${b.itemName} — offered on the hit`
        : (b.answer === "use" ? `${b.itemName} — used` : `${b.itemName} — passed${b.timedOut ? " (timer)" : ""}`),
      subtitle: (b.targets ?? []).map(t => t.name).join(", ")
    }) + (pending ? holdBarHTML(b, "to answer") : "");
    html.querySelector(".message-content")?.appendChild(row);
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
    // Crash-resume, elect-owned, the precision block's 20s horizon: an accepted offer whose
    // driving client died is answer="use" with no driven usage in the log.
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
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clock disarms here.
Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(bashOfferTimers, message.id);
});
