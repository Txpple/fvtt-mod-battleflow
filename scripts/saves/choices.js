/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the CHOICES a verdict
 * opens — Interpose on a listed shield-bearer's success, the bash's Prone-or-push on the listed
 * feat's failure — on the same `saves` flag, no new key: spec, gate, answer, relay, clock, popup,
 * announce, settle.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, 
  drivesMomentFor } from "../core.js";
import { applicableProfiles, cardActivity, equippedShield, foldEntryFor, resolveUuid } from "../lookup.js";
import { forceStatus, reactionSpent, spendReaction } from "../shared.js";
import { bfCard, momentBarHTML, ruleLine } from "../decide/present.js";
import { openMomentPopup, armDeadline, disarmDeadline, registerRelay } from "../ui.js";
import { RULE_TEXT } from "../decide/registry.js";
import { maneuverFoldEntries } from "../settings.js";

/* --- the fold choices: a verdict opens a decision ---------------------------------------------
 * Both are keyed off the maneuver-folds list (the list is the switch), and both hold one target's
 * consequence pass between the verdict's announce and its application.
 *
 *   INTERPOSE (the saver's): the save SUCCEEDED against Dex half-on-success damage, shield in hand,
 *   Reaction free — the Reaction turns half into NONE. The text conditions it on succeeding, so a
 *   failure never offers. Expiry passes; a timer never spends a Reaction.
 *   BASH (the attacker's): the listed feat's own save FAILED — knock Prone (the standard Prone chip
 *   via forceStatus) or push 5 feet (a card, a hand-moved token). Expiry defaults to Prone.
 *
 * The popup goes to the subject's owner, else the GM; a non-owner's answer rides its own message
 * and the elect folds it in. The consequence pass resumes off the update.
 * ------------------------------------------------------------------------------------------- */

const saveChoiceTimers = new Map();

/** What choice, if any, this VERDICT opens — bash on the listed feat's own failure, interpose on a
 * listed shield-bearer's SUCCESS. Null for almost every save. */
async function saveChoiceSpec(card, flag, entry) {
  if ( entry.outcome === "saved" ) {
    // Interpose eligibility, read at VERDICT time: half-on-success DEX damage, the listed
    // feat on the saver, a shield in hand, the Reaction free — and the save already held.
    if ( !flag.hasDamage || (flag.damageOnSave !== "half") ) return null;
    if ( !(flag.abilities ?? []).includes("dex") || !setting(S.autoApply) ) return null;
    const subject = await fromUuid(entry.uuid).catch(() => null);
    const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
    if ( !(saver instanceof Actor) ) return null;
    if ( reactionSpent(saver) ) return null;
    const found = foldEntryFor(saver, "interpose", maneuverFoldEntries());
    if ( !found || !equippedShield(saver) ) return null;
    return { kind: "interpose", itemName: found.item.name, itemImg: found.item.img,
      subjectUuid: entry.uuid };
  }
  if ( entry.outcome !== "failed" ) return null;
  const attacker = card.getAssociatedActor?.();
  if ( !attacker ) return null;
  const found = foldEntryFor(attacker, "bash", maneuverFoldEntries());
  if ( !found ) return null;
  if ( found.item.name.toLowerCase() !== String(flag.item?.name ?? "").toLowerCase() ) return null;
  const activity = cardActivity(card, flag.activityUuid);
  // The activity's list holds PROFILES whose effects resolve asynchronously (lookup.js).
  const presses = (await applicableProfiles(activity)).some(({ profile }) => !profile.onSave);
  if ( !presses ) return null;   // nothing to choose between — the push against no press is no choice
  return { kind: "bash", itemName: found.item.name, itemImg: found.item.img,
    subjectUuid: attacker.uuid, attackerName: attacker.name };
}

/** True while a choice HOLDS this target's pass — stamps it on first sight. */
export async function gateSaveChoice(card, flag, entry) {
  if ( entry.applied ) return false;
  if ( entry.choice ) return !entry.choice.answer;
  const spec = await saveChoiceSpec(card, flag, entry);
  if ( !spec ) return false;
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await queueFlagWrite(card, "saves", current => {
    const t = current.targets?.find(x => x.uuid === entry.uuid);
    if ( !t || t.applied || t.choice ) return;
    t.choice = { ...spec, answer: null,
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}) };
  });
  armSaveChoiceTimer(card);
  const live = card.getFlag(MODULE_ID, "saves")?.targets?.find(x => x.uuid === entry.uuid)?.choice;
  return !!live && !live.answer;
}

/** One answer, first writer wins; a non-owner's answer relays as their own message (§4.1). */
async function answerSaveChoice(card, uuid, answer) {
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  const c = entry?.choice;
  if ( !c || c.answer ) return;
  if ( !card.isOwner ) {
    const subject = await fromUuid(c.subjectUuid ?? uuid).catch(() => null);
    // Law 3 (declaration never claims an outcome) governs the BASH labels — the press follows the
    // choice. Interpose is post-verdict, so its accept may state the known result.
    const labels = {
      use: `${c.itemName} — ${entry.name} spends the Reaction: no damage`,
      pass: `${c.itemName} — passed, the Reaction is kept`,
      prone: `${c.itemName} — ${c.attackerName ?? "the attacker"} chooses Prone`,
      push: `${c.itemName} — ${c.attackerName ?? "the attacker"} chooses the push`
    };
    await ChatMessage.create({
      speaker: (subject instanceof Actor) ? ChatMessage.getSpeaker({ actor: subject }) : undefined,
      content: bfCard({
        img: c.itemImg, eyebrow: `Maneuver — ${c.itemName}`,
        tone: (answer === "pass") ? "neutral" : "good",
        title: labels[answer] ?? `${c.itemName} — ${answer}`,
        subtitle: flag.item?.name ?? ""
      }),
      flags: { [MODULE_ID]: { saveChoiceAnswer: { cardId: card.id, uuid, answer } } }
    });
    return;
  }
  await queueFlagWrite(card, "saves", current => {
    const t = current.targets?.find(x => x.uuid === uuid);
    const cc = t?.choice;
    if ( !cc || cc.answer ) return;
    cc.answer = answer;
    cc.answeredAt = Date.now();
  });
}

/** A relayed choice answer landing: the ELECT folds it in through the spine's relay registry
 * (idempotent, first answer wins). */
registerRelay("saveChoiceAnswer", {
  flagKey: "saves",
  targetOf: a => a.cardId,
  owns: flag => drivesMomentFor(flag?.sourceUuid ?? null),
  fold: (current, a) => {
    const t = current.targets?.find(x => x.uuid === a.uuid);
    const c = t?.choice;
    if ( !c || c.answer ) return;
    c.answer = a.answer;
    c.answeredAt = Date.now();
  }
});

export function disarmSaveChoiceTimer(cardId) { return disarmDeadline(saveChoiceTimers, cardId); }

export function armSaveChoiceTimer(card) {
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !drivesMomentFor(flag?.sourceUuid ?? null) ) return;
  const pending = (flag?.targets ?? []).filter(t => t.choice && !t.choice.answer && t.choice.deadline);
  if ( !pending.length ) { disarmSaveChoiceTimer(card.id); return; }
  armDeadline(saveChoiceTimers, card.id, Math.min(...pending.map(t => t.choice.deadline)),
    fireSaveChoiceTimer);
}

/** Expiry defaults: bash → Prone; interpose → pass. The update the write raises drives the
 * consequence pass and any later deadline re-arms below. */
async function fireSaveChoiceTimer(cardId) {
  try {
    const card = game.messages.get(cardId);
    if ( !card ) return;
    const now = Date.now();
    await queueFlagWrite(card, "saves", current => {
      for ( const t of current.targets ?? [] ) {
        const c = t.choice;
        if ( !c || c.answer || !c.deadline || (c.deadline > now) ) continue;
        c.answer = (c.kind === "bash") ? "prone" : "pass";
        c.timedOut = true;
        c.answeredAt = now;
      }
    });
    armSaveChoiceTimer(card);
  } catch(err) {
    console.error(`${TITLE} | Save-choice buzzer failed.`, err);
  }
}

/** The choice popup — two controls, the moment bar, the fold family's routing. */
export async function showSaveChoicePopup(card, uuid) {
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  const c = entry?.choice;
  if ( !c || c.answer ) return;
  const subject = resolveUuid(c.subjectUuid);
  const interpose = c.kind === "interpose";
  await openMomentPopup(card, `choice:${uuid}`, subject, {
    title: `${c.itemName} — ${subject?.name ?? ""}`,
    icon: interpose ? "fa-solid fa-shield" : "fa-solid fa-hand-fist",
    content: bfCard({
      img: c.itemImg, eyebrow: `Maneuver — ${c.itemName}`, tone: "pending",
      // Interpose asks only whether the Reaction turns the half into none — the save already
      // succeeded. The rule line is the feature's own sentence, verbatim; the module's read is the hint.
      title: interpose ? `${c.itemName} — take no damage?`
                       : `${c.itemName} — ${entry.name} failed: choose`,
      subtitle: interpose
        ? `You succeeded on the Dexterity save against ${flag.item?.name ?? "the effect"}.`
        : `${flag.item?.name ?? "The effect"} — the save failed.`,
      lines: interpose
        ? [ruleLine(RULE_TEXT.interpose),
           "Use it: the Reaction is spent and the half damage becomes none."]
        : [ruleLine(RULE_TEXT.bashChoice),
           "The push is by hand — nothing moves the token for you."]
      // ⚠ The choice sub-object goes through momentBarHTML, NEVER holdBarHTML: it has no `status`,
      // and the status-gated wrapper silently eats the bar.
    }) + momentBarHTML(c, "to answer"),
    buttons: interpose
      ? [
        { action: "use", label: `Use ${c.itemName}`, default: true,
          callback: () => answerSaveChoice(card, uuid, "use") },
        // "Take half" states a KNOWN outcome — the verdict is already in (law 3 bars it only unrolled).
        { action: "pass", label: "Take half",
          callback: () => answerSaveChoice(card, uuid, "pass") }
      ]
      : [
        { action: "prone", label: "Knock Prone", default: true,
          callback: () => answerSaveChoice(card, uuid, "prone") },
        { action: "push", label: "Push 5 feet",
          callback: () => answerSaveChoice(card, uuid, "push") }
      ]
  });
}

/** The bash outcome, announced once — the push a card and a hand-moved token; the Prone press the
 * STANDARD Prone chip via forceStatus (canonical id, origin names the presser), never the item's
 * own custom effect. */
export async function announceBashOutcome(card, _flag, entry) {
  const c = entry.choice;
  if ( !c?.answer || c.announced ) return;
  let claimed = false;
  await queueFlagWrite(card, "saves", current => {
    const t = current.targets?.find(x => x.uuid === entry.uuid);
    if ( t?.choice && !t.choice.announced ) { t.choice.announced = true; claimed = true; }
  });
  if ( !claimed ) return;
  const attacker = card.getAssociatedActor?.();
  const push = c.answer === "push";
  if ( !push ) {
    const subject = await fromUuid(entry.uuid).catch(() => null);
    const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
    if ( saver instanceof Actor ) await forceStatus(saver, "prone", { origin: attacker?.uuid ?? null });
  }
  await ChatMessage.create({
    speaker: attacker ? ChatMessage.getSpeaker({ actor: attacker }) : card.speaker,
    content: bfCard({
      img: c.itemImg, eyebrow: `Maneuver — ${c.itemName}`, tone: "good",
      title: push
        ? `${c.itemName} — ${attacker?.name ?? "the attacker"} pushes ${entry.name} 5 feet`
        : `${c.itemName} — ${attacker?.name ?? "the attacker"} knocks ${entry.name} Prone`,
      subtitle: c.timedOut ? "defaulted by the timer" : "the attacker's choice",
      lines: push ? ["Straight away from the attacker. Move the token; nothing is automated."] : []
    })
  });
}

/** Interpose settles on the ACCEPT: the save already succeeded, so the settle card states the known
 * outcome (no damage) and the Reaction is spent here and only here — a pass or a buzzer spends
 * nothing. The card is the durable record: a zeroed number must never read as a dropped machine. */
export async function settleInterpose(card, flag, entry) {
  const c = entry.choice;
  if ( (c?.answer !== "use") || c.validated ) return;
  if ( entry.outcome !== "saved" ) return; // an accept exists only past a held save
  let claimed = false;
  await queueFlagWrite(card, "saves", current => {
    const t = current.targets?.find(x => x.uuid === entry.uuid);
    if ( t?.choice && !t.choice.validated ) { t.choice.validated = true; claimed = true; }
  });
  if ( !claimed ) return;
  const subject = await fromUuid(entry.uuid).catch(() => null);
  const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
  if ( saver instanceof Actor ) void spendReaction(saver, { origin: null, what: `Interpose (${c.itemName})` });
  await ChatMessage.create({
    speaker: (saver instanceof Actor) ? ChatMessage.getSpeaker({ actor: saver }) : card.speaker,
    content: bfCard({
      img: c.itemImg, eyebrow: `Maneuver — ${c.itemName}`, tone: "good",
      title: `${c.itemName} — ${entry.name} takes no damage`,
      subtitle: `${flag.item?.name ?? "The effect"}: the Reaction turns the half into none.`,
      lines: ["The saving throw held; the shield does the rest."]
    })
  });
}
