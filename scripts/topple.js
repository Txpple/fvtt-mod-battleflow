/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the Topple demand — the `topple` flag's lifecycle off
 * the card mastery.js posts: the twin-ask supersede, the save dialog, the buzzer, the fold, the
 * failure's Prone press and the GM button. The card is the bus: mastery.js writes the flag, this
 * file drives it, and neither imports the other.
 */
import { MODULE_ID, TITLE, isActiveGM, drivesMomentFor, canApplyTo, whisperNoGM, queueFlagWrite,
  canAnswerFor } from "./core.js";
import { resolveUuid } from "./lookup.js";
import { forceStatus, rollConfigFor } from "./shared.js";
import { popupKey, bfCard, momentBarHTML, ruleLine } from "./decide/present.js";
import { SURFACES } from "./surfaces.js";
import { CARD, abilityOf, isCard, originData, originIdOf } from "./decide/card.js";
import { livePopups, DialogCarried, momentButton, scheduleBarSync, shownMoments, armDeadline,
  disarmDeadline, dramaticVerdictPause, registerDemand, demandAnsweredBy } from "./ui.js";

/* --- the twin-ask supersede ---------------------------------------------------------------
 * ⚠ `isActiveGM()` is per-USER, not per-client: two sessions on one account both stamp the ask,
 * and Foundry exposes no cross-client identity. So the race is converged: an ask whose source
 * already has an ELDER ask (timestamp, then id) deletes itself, deterministically on every client. */
Hooks.on("createChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, "topple");
  if ( !flag?.sourceMessageId ) return;
  if ( !drivesMomentFor(flag?.attackerUuid) ) return;
  const elder = game.messages.contents.some(m => {
    if ( m.id === message.id ) return false;
    if ( m.getFlag(MODULE_ID, "topple")?.sourceMessageId !== flag.sourceMessageId ) return false;
    return (m.timestamp < message.timestamp)
      || ((m.timestamp === message.timestamp) && (m.id < message.id));
  });
  if ( elder ) {
    disarmToppleTimer(message.id);
    message.delete().catch(() => { /* the other twin got there first */ });
  }
});

// Dialogs on their way up, between the call and the render that adopts them.
const toppleDialogsOpening = new Set();

/**
 * The Topple save's table moment: the system's OWN saving-throw dialog (`configure: true`), the
 * demand riding `dialog.options` as a DialogCarried the spine paints (ui.js drawDemandFieldset)
 * and adopts under the popup key the recall, buzzer and delete-sweep use. Dismissing is not an
 * answer — the card's Roll button recalls it. The save gate draws on it as on any demanded save.
 */
async function showTopplePopup(message, _topple, target) {
  const key = popupKey(message.id, `topple:${target.uuid}`);
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }
  if ( toppleDialogsOpening.has(key) ) return;
  toppleDialogsOpening.add(key);
  try {
    const flag = message.getFlag(MODULE_ID, "topple");
    const entry = flag?.targets?.find(t => t.uuid === target.uuid);
    if ( !entry || entry.done ) return;
    const actor = await fromUuid(target.uuid);
    if ( !(actor instanceof Actor) || !canAnswerFor(actor) ) return;
    const demand = new DialogCarried({
      cardId: message.id, key, failed: null,
      owed: card => { const e = card.getFlag(MODULE_ID, "topple")?.targets?.find(t => t.uuid === target.uuid); return !!e && !e.done; },
      present: card => ({
        img: card.getFlag(MODULE_ID, "topple")?.weapon?.img ?? null,
        eyebrow: "Weapon Mastery — Topple",
        title: `${target.name}: Constitution save, DC ${flag.dc}`,
        subtitle: `${flag.weapon?.name ?? "The weapon"} demands it.`,
        // The consequence in the property's own words (the demand speaks to the TARGET).
        lines: [ruleLine("On a failed save, the creature has the Prone condition.")],
        tone: "pending"
      }),
      // The topple flag has no `status`; holdBarHTML gates on one, so hand it a pending view.
      bar: card => ({ status: "pending", ...card.getFlag(MODULE_ID, "topple") })
    });
    const rolls = await actor.rollSavingThrow(
      { ability: flag.ability || "con", target: flag.dc },
      { configure: true, options: { bfSaveDemand: demand } },
      { data: originData(message.id) }
    );
    // Fails pressed: no roll; recorded as the failure it is, Prone pressed by the same consequence.
    if ( !rolls?.length && demand.failed ) await markToppleAutoFailed(message, target.uuid, demand.failed);
  } catch(err) {
    console.error(`${TITLE} | Topple save dialog failed — roll it from the sheet.`, err);
  } finally {
    toppleDialogsOpening.delete(key);
  }
}

/**
 * The fold without a die: a Topple save the rules fail before it is rolled, recorded as a rolled
 * failure (`total` null, the card says why) and pressed through the same consequence.
 */
async function markToppleAutoFailed(message, uuid, sources = []) {
  let claimed = false;
  await queueFlagWrite(message, "topple", live => {
    const own = live.targets?.find(t => !t.done && (t.uuid === uuid));
    if ( !own ) return false;
    claimed = true;
    own.done = true;
    own.outcome = "prone";
    own.total = null;
    own.autoFailed = true;
    own.autoFailedBy = sources.filter(s => s.autoFail).map(s => s.statusName).join(", ") || null;
    own.answeredAt = Date.now();
  });
  if ( !claimed ) return;
  if ( (message.getFlag(MODULE_ID, "topple")?.targets ?? []).every(t => t.done) ) disarmToppleTimer(message.id);
  await applyToppleFailure(message, uuid);
}

/** Roll one pending topple target's save, chained to the card; the buzzer passes `timedOut`. */
async function rollToppleSave(message, target, { mode = null, bonus = null, timedOut = false } = {}) {
  const flag = message.getFlag(MODULE_ID, "topple");
  const entry = flag?.targets?.find(t => t.uuid === target.uuid);
  if ( !entry || entry.done ) return;
  const actor = await fromUuid(target.uuid);
  if ( !(actor instanceof Actor) ) return;
  await actor.rollSavingThrow(
    { ability: flag.ability || "con", target: flag.dc,
      ...rollConfigFor(mode, bonus) },
    { configure: false },
    { data: {
      ...originData(message.id),
      ...(timedOut ? { flags: { [MODULE_ID]: { timedOut: true } } } : {})   // nested: a roll hook's nested stamp would displace a dotted key
    } });
}

/* --- the topple buzzer: expiry ROLLS, on the elect ------------------------------------------
 * A demanded save is mandatory, so the timer only decides who presses: an unanswered target's
 * save is rolled straight at the deadline. An answer already in the log beats the clock; a target
 * that no longer exists is voided so the demand never sits pending forever.
 * ------------------------------------------------------------------------------------------- */
const toppleTimers = new Map();

function armToppleTimer(message) {
  const flag = message?.getFlag(MODULE_ID, "topple");
  if ( !flag?.deadline || !drivesMomentFor(flag?.attackerUuid) ) return;
  if ( !(flag.targets ?? []).some(t => !t.done) ) return;
  armDeadline(toppleTimers, message.id, flag.deadline, fireToppleTimer);
}

const disarmToppleTimer = messageId => disarmDeadline(toppleTimers, messageId);

async function fireToppleTimer(messageId) {
  try {
    const card = game.messages.get(messageId);
    const flag = card?.getFlag(MODULE_ID, "topple");
    if ( !flag ) return;
    for ( const t of (flag.targets ?? []) ) {
      if ( t.done ) continue;
      // An unfolded answer beats the clock, not races it.
      const landed = game.messages.contents.find(m =>
        isCard(m, CARD.save)
        && (originIdOf(m) === card.id)
        && (m.getAssociatedActor?.()?.uuid === t.uuid));
      if ( landed ) { void foldToppleSave(landed); continue; }
      const actor = await fromUuid(t.uuid).catch(() => null);
      if ( !(actor instanceof Actor) ) {
        // Through the serializer: this loop walks every target, so it races itself.
        await queueFlagWrite(card, "topple", live => {
          const gone = live.targets?.find(x => !x.done && (x.uuid === t.uuid));
          if ( !gone ) return false;
          gone.done = true;
          gone.outcome = "gone";
          gone.applied = true; // nothing to press
          gone.answeredAt = Date.now();
        });
        continue;
      }
      await rollToppleSave(card, t, { timedOut: true });
    }
  } catch(err) {
    console.error(`${TITLE} | Topple buzzer failed.`, err);
  }
}

/**
 * The Topple card folds its own save: the elect judges a Constitution save answering a pending
 * target against the card's DC, and a failure presses Prone. The roll stays human-pressed; the GM
 * button remains for saves rolled on paper. A save chained to any OTHER message is never a Topple
 * answer; a bare sheet roll may be. Cards with no `dc` are skipped.
 */
Hooks.on("createChatMessage", message => {
  if ( !isCard(message, CARD.save) ) return;
  // The fold is a judgement plus a flag write, reachable without a GM; the Prone press guards itself.
  if ( !isActiveGM() && game.users.activeGM ) return;
  void foldToppleSave(message);
});

/**
 * The failure's consequence: the press, the announcement, the `applied` receipt. Split from the
 * fold so the crash-resume can re-drive it; idempotent by `applied`, and the press VERIFIES
 * (forceStatus) rather than trusting a toggle that no-ops silently.
 */
async function applyToppleFailure(card, uuid) {
  const flag = foundry.utils.deepClone(card.getFlag(MODULE_ID, "topple"));
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  if ( !entry || (entry.outcome !== "prone") || entry.applied ) return;
  const actor = resolveUuid(uuid);
  // ⚠ The Prone press is the GM-only half: with no GM the verdict stands and the driver is told
  // what did not land.
  if ( (actor instanceof Actor) && !canApplyTo(actor) ) {
    await whisperNoGM(`Topple's Prone on ${entry.name}`,
      `The save failed (${entry.total ?? "?"} vs DC ${flag.dc}) and the card says so — set Prone by hand.`);
    return;
  }
  // The chip names its source; cards without attackerUuid press sourceless.
  if ( actor instanceof Actor ) await forceStatus(actor, "prone", { origin: flag.attackerUuid ?? null });
  await ChatMessage.create({
    speaker: card.speaker,
    content: bfCard({
      img: flag.weapon?.img, eyebrow: "Weapon Mastery — Topple", tone: "good",
      title: `${entry.name} falls Prone`,
      subtitle: entry.autoFailed
        ? `Constitution save fails automatically — ${entry.autoFailedBy ?? "the condition"}`
        : `Constitution save ${entry.total ?? "?"} vs DC ${flag.dc}`
          + `${entry.timedOut ? " — rolled by the timer" : ""}`
    })
  });
  // ⚠ Through the serializer, the claim re-checked INSIDE it: two awaits since the guard are long
  // enough for the fold to record another target on the same flag.
  await queueFlagWrite(card, "topple", live => {
    const own = live.targets?.find(t => t.uuid === uuid);
    if ( !own || own.applied ) return false;
    own.applied = true;
  });
}

// Declared to the demand registry, priority 2 (last). A chained roll answers its card; a BARE roll
// defers to a pending concentration ask or save demand for this actor and ability.
// ⚠ Another machine's STAMPED answer is never a Topple answer (`answering: null`): a concentration
// answer (respondsTo, no originatingMessage) would otherwise be claimed twice — one roll, two verdicts.
registerDemand("topple", {
  priority: 2, chained: true, answering: null,
  pendingEntry: (flag, f) => (!(flag?.dc > 0) || (flag.ability && (f.ability !== flag.ability)))
    ? null : (flag.targets ?? []).find(t => !t.done && (t.uuid === f.actorUuid)) ?? null,
  pendingFor: (flag, uuid) => (flag?.dc > 0) ? (flag.targets ?? []).find(t => !t.done && (t.uuid === uuid)) ?? null : null
});

async function foldToppleSave(saveMessage) {
  try {
    const actor = saveMessage.getAssociatedActor?.();
    const total = saveMessage.rolls?.[0]?.total;
    if ( !actor || (typeof total !== "number") ) return;
    const found = demandAnsweredBy(saveMessage);
    if ( found?.flagKey !== "topple" ) return;   // another chain's, another machine's, or nobody's
    // Whole-log by design; the oldest pending card answers first.
    for ( const { card } of found.matches ) {
      const flag = foundry.utils.deepClone(card.getFlag(MODULE_ID, "topple"));
      if ( !(flag?.dc > 0) ) continue;
      if ( flag.ability && (abilityOf(saveMessage) !== flag.ability) ) continue;
      const entry = flag.targets?.find(t => !t.done && (t.uuid === actor.uuid));
      if ( !entry ) continue;
      const success = total >= flag.dc;
      // ⚠ Through the serializer, claim repeated inside it: two saves answering one card land in
      // the same tick, and re-finding under `!done` stops two folds claiming one roll.
      let claimed = false;
      await queueFlagWrite(card, "topple", live => {
        const own = live.targets?.find(t => !t.done && (t.uuid === actor.uuid));
        if ( !own ) return false;
        claimed = true;
        own.done = true;
        own.outcome = success ? "saved" : "prone";
        own.total = total;
        if ( saveMessage.getFlag(MODULE_ID, "timedOut") ) own.timedOut = true;
        // The crash-resume contract: answeredAt is the horizon's clock; a success has nothing to resume.
        own.answeredAt = Date.now();
        if ( success ) own.applied = true;
      });
      // Another fold claimed it; it owns the announcement and the consequence.
      if ( !claimed ) continue;
      // ⚠ Re-read, do NOT consult `flag`: it is the pre-write clone and still shows this target pending.
      if ( (card.getFlag(MODULE_ID, "topple")?.targets ?? []).every(t => t.done) ) {
        disarmToppleTimer(card.id);
      }
      if ( !success ) {
        await dramaticVerdictPause(saveMessage); // same instant-verdict class as the fold
        await applyToppleFailure(card, entry.uuid);
      } else {
        // A SUCCESS ANNOUNCES TOO: a public ask that resolves in silence reads as a dropped machine.
        await dramaticVerdictPause(saveMessage);
        // The saver's own card, the roll against the DC.
        const stander = resolveUuid(entry.uuid);
        await ChatMessage.create({
          speaker: (stander instanceof Actor) ? ChatMessage.getSpeaker({ actor: stander }) : card.speaker,
          content: bfCard({
            img: flag.weapon?.img, eyebrow: "Weapon Mastery — Topple", tone: "neutral",
            title: `Topple — ${entry.name} stays standing`,
            // ⚠ `entry` is the pre-write clone; the total is the roll's.
            subtitle: `Constitution save ${total} vs DC ${flag.dc}`
              + `${saveMessage.getFlag(MODULE_ID, "timedOut") ? " — rolled by the timer" : ""}`
          })
        });
      }
      return; // one save answers one card
    }
  } catch(err) {
    console.error(`${TITLE} | Topple fold failed.`, err);
  }
}

// Every client closes a done entry's popup wherever it lives, and the buzzer disarms when nothing
// is pending.
Hooks.on("updateChatMessage", message => {
  const topple = message.getFlag(MODULE_ID, "topple");
  if ( topple ) {
    for ( const t of (topple.targets ?? []) ) {
      if ( !t.done ) continue;
      const dialog = livePopups.get(popupKey(message.id, `topple:${t.uuid}`));
      if ( dialog ) void dialog.close();
    }
    if ( !(topple.targets ?? []).some(t => !t.done) ) disarmToppleTimer(message.id);
    else armToppleTimer(message);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clock disarms here.
Hooks.on("deleteChatMessage", message => {
  disarmToppleTimer(message.id);
});

// The Topple card's rows: the demand's bar, the Roll button per target, the GM prone affordance.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const topple = message.getFlag(MODULE_ID, "topple");
  if ( topple?.targets?.length ) {
    // The demand's bar, card-side, draining in step with every popup; the buzzer re-arms on render
    // from the flag's absolute deadline (a reload resumes the clock).
    if ( topple.deadline && topple.targets.some(t => !t.done) ) {
      const bar = document.createElement("div");
      bar.innerHTML = momentBarHTML(topple, "to roll");
      if ( bar.innerHTML.trim() ) {
        html.querySelector(SURFACES.messageContent)?.appendChild(bar);
        scheduleBarSync(bar);
      }
      armToppleTimer(message);
    }
    for ( const t of topple.targets ) {
      // Crash-resume: a folded failure whose press died with its client (done+prone, unapplied,
      // stale past any live pause). Elect-driven.
      if ( (t.outcome === "prone") && t.answeredAt && !t.applied && drivesMomentFor(topple?.attackerUuid)
        && (Date.now() - t.answeredAt > 20_000) ) void applyToppleFailure(message, t.uuid);
      if ( t.done ) continue;
      const actor = resolveUuid(t.uuid);

      // ⚠ The native [[/save]] enricher rolls for whatever token is SELECTED (the attacker, right
      // after an attack). The module's own surface aims at the right actor: a popup, recalled by
      // the card's Roll button.
      if ( topple.dc && canAnswerFor(actor) ) {
        // canAnswerFor alone routes: an online owner excludes the GM; with nobody home the GM gets it.
        const shownKey = popupKey(message.id, `topple:${t.uuid}`);
        if ( !shownMoments.has(shownKey) ) {
          shownMoments.add(shownKey);
          void showTopplePopup(message, topple, t);
        }
        html.querySelector(SURFACES.messageContent)?.appendChild(momentButton(`Roll save — ${t.name}`, () => {
          void showTopplePopup(message, message.getFlag(MODULE_ID, "topple"), t);
        }));
      }

      if ( game.user.isGM ) {
        html.querySelector(SURFACES.messageContent)?.appendChild(momentButton(`${t.name} failed — Prone`, async () => {
          const live = await fromUuid(t.uuid);
          if ( live instanceof Actor ) await forceStatus(live, "prone",
            { origin: message.getFlag(MODULE_ID, "topple")?.attackerUuid ?? null });
          // Through the serializer: the GM's press lands after an await, on the array a fold may write.
          await queueFlagWrite(message, "topple", live2 => {
            const entry = live2.targets?.find(x => x.uuid === t.uuid);
            if ( !entry ) return false;
            entry.done = true;
            entry.outcome = "prone";
            entry.applied = true;
            entry.answeredAt = Date.now();
          });
        }));
      }
    }
  }
});
