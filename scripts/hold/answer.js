/**
 * Battle Flow — the reaction hold, part 5: THE ANSWER. `answerHold` and its relay fold, the cast
 * that IS the answer, and the popup's Cast button (natively, or Parry's die rolled in the open).
 */
import { MODULE_ID, TITLE, queueFlagWrite, canAnswerFor, isContinuingClient } from "../core.js";
import { isTextOnlyFeature } from "../decide/eligible.js";
import { interruptEntries } from "../decide/registry.js";
import { joinEffectReceipt } from "../decide/receipt.js";
import { bfCard } from "../decide/present.js";
import { reductionRise } from "../decide/dice-chips.js";
import { INTERRUPT_ROLLS } from "../decide/registry.js";
import { d20Faces, d20ModeOf, disadvantageOutcome, needsSecondD20, rescueSpendText } from "../decide/rescue-hit.js";
import { lower, holdsFor } from "../lookup.js";
import { spendReaction, poolOf, spendSuperiorityDie, spendPoolUses, reactionSpent } from "../shared.js";
import { registerRelay } from "../ui.js";
import { reactionItem, reactionNameFor, applyReactionEffect, reactionACArrived, reactionImg } from "./lookup.js";

/**
 * ONE ANSWER AMONG SEVERAL ASKED (RULINGS *The fighting styles*): the first that ACTS settles it;
 * a PASS only once everyone asked has passed. `by` is the guard's uuid, null for the target.
 * @returns {boolean|"partial"}  "partial" when a pass was only recorded
 */
export function recordAnswer(target, answer, by = null) {
  if ( !target || target.answer ) return false;
  const guard = by ? (target.guards ?? []).find(g => g.uuid === by) : null;
  if ( by && (!guard || guard.passed) ) return false;
  if ( answer === "pass" ) {
    if ( guard ) guard.passed = true;
    else if ( target.selfPassed ) return false;
    else target.selfPassed = true;
    const selfDone = (target.selfAsk === false) || (target.selfPassed === true);
    if ( !selfDone || !(target.guards ?? []).every(g => g.passed) ) return "partial";
  }
  target.answer = answer;
  if ( guard && (answer !== "pass") ) target.guardedBy = { uuid: guard.uuid, name: guard.name, itemId: guard.itemId };
  return true;
}

/** Record an answer for one held target: an owner writes the hold, anyone else sends its OWN message. */
export async function answerHold(attackMessage, uuid, answer, { appliedEffects = [], reduceBy = null, poolSpend = null, bent = null, rescue = null, by = null } = {}) {
  const hold = foundry.utils.deepClone(attackMessage.getFlag(MODULE_ID, "hold") ?? {});
  if ( hold.status !== "pending" ) return;
  const target = hold.targets?.find(t => t.uuid === uuid);
  const recorded = recordAnswer(target, answer, by);     // idempotent: the first act wins
  if ( !recorded ) return;
  if ( recorded === true ) target.answeredAt = Date.now();   // the crash-resume horizon
  if ( Number(reduceBy) > 0 ) target.reduceBy = Number(reduceBy);   // Parry's roll, at the answer
  if ( poolSpend ) target.poolSpend = poolSpend;                      // Parry's die, the spend record
  if ( bent ) target.bent = bent;
  if ( rescue ) target.rescue = rescue;

  // A player cannot update someone else's message: the answer travels as their OWN (ARCHITECTURE.md §3).
  const actor = await fromUuid(uuid);
  const ac = actor?.system?.attributes?.ac?.value ?? null;
  target.acAtAnswer = ac;
  // The moment event fires on the ANSWERING user's client, even when the answer is relayed.
  target.answeredBy = game.user.id;

  if ( !attackMessage.isOwner && by ) {
    // A GUARD's answer (Protection): its own card, in its own voice.
    const guard = await fromUuid(by);
    const guarding = answer === "roll";
    await ChatMessage.create({
      content: bfCard({
        img: guard?.items?.get((target.guards ?? []).find(g => g.uuid === by)?.itemId)?.img ?? null,
        eyebrow: guarding ? `Reaction — ${rescue}` : "Reaction — passed",
        title: guarding ? rescue : "Lets it land",
        subtitle: guarding ? `${guard?.name ?? "A guard"} protects ${target.name}` : `${guard?.name ?? "A guard"} · ${target.name}`,
        lines: guarding ? [rescueSpendLine(rescue, null)] : [`No reaction — ${guard?.name ?? "the guard"} lets it land.`],
        tone: guarding ? "good" : "neutral"
      }),
      speaker: ChatMessage.getSpeaker({ actor: guard }),
      flags: { [MODULE_ID]: { respondsTo: attackMessage.id, uuid, answer, by, ac,
        ...(bent ? { bent } : {}), ...(rescue ? { rescue } : {}) } }
    });
    return;
  }
  if ( !attackMessage.isOwner ) {
    // ⚠ Quote the AC only once it has ARRIVED: the effect exists before derived data recomputes.
    const cast = answer === "cast";
    const negate = target.kind === "negate";   // no AC story: the spell simply does nothing
    const bending = answer === "roll";   // the defender's card carries the spend; the verdict is the attack card's
    const effectLanded = (negate || bending) ? true : reactionACArrived(actor, target);
    const lines = bending ? [rescueSpendLine(rescue, poolSpend)] : negate
      ? [cast ? `<strong>${hold.spell}</strong> does nothing to them.`
              : `No reaction — the <strong>${hold.spell}</strong> lands.`]
      : cast
        ? [effectLanded ? `AC is now <strong>${ac}</strong>.`
                        : `<em>Its AC has not landed yet — the verdict will use the real number.</em>`]
        : [`No reaction — the attack lands.`];
    await ChatMessage.create({
      content: bfCard({
        img: bending ? reactionImg(actor, rescue, {}) : reactionImg(actor, target.reaction, target),
        eyebrow: bending ? `Reaction — ${rescue}` : cast ? "Reaction — cast" : "Reaction — passed",
        title: bending ? rescue : cast ? target.reaction : "Lets it land",
        subtitle: target.name,
        lines,
        tone: (cast || bending) ? "good" : "neutral"
      }),
      speaker: ChatMessage.getSpeaker({ actor }),
      // The receipt rides in the standard effectReceipt shape, so receipts.js renders it.
      flags: { [MODULE_ID]: { respondsTo: attackMessage.id, uuid, answer, ac, effectLanded,
        ...(Number(reduceBy) > 0 ? { reduceBy: Number(reduceBy) } : {}),
        ...(poolSpend ? { poolSpend } : {}),
        // Envelope fields are additive only (ARCHITECTURE §4 *The relay*).
        ...(bent ? { bent } : {}),
        ...(rescue ? { rescue } : {}),
        ...(appliedEffects.length ? { effectReceipt: { targets: appliedEffects } } : {}) } }
    });
    return;
  }
  if ( appliedEffects.length ) {
    // ⚠ Through the serializer: one casting answers many holds in one tick on one card.
    await queueFlagWrite(attackMessage, "effectReceipt", flag => {
      for ( const entry of appliedEffects ) joinEffectReceipt(flag, entry);
    });
  }
  await attackMessage.setFlag(MODULE_ID, "hold", hold);
}

// A player's answer message: the CONTINUING CLIENT (not the elect) folds it into the hold.
// ⚠ The envelope is FLAT beside its `effectReceipt`; nesting it is a wire-format change.
registerRelay("respondsTo", {
  flagKey: "hold",
  targetOf: response => response,
  owns: hold => (hold.status === "pending") && isContinuingClient(hold),
  // ⚠ A per-target write to a shared array: the guards repeat INSIDE the lock.
  fold: (flag, _response, message) => {
    if ( flag.status !== "pending" ) return false;
    const target = flag.targets?.find(t => t.uuid === message.getFlag(MODULE_ID, "uuid"));
    const recorded = recordAnswer(target, message.getFlag(MODULE_ID, "answer"), message.getFlag(MODULE_ID, "by") ?? null);
    if ( !recorded ) return false;
    if ( recorded === "partial" ) return;   // a guard's pass, recorded: the others are still asked
    target.answeredAt = Date.now();   // the crash-resume horizon
    target.answeredBy = message.author?.id ?? null;   // the gate publishes this moment on THAT user's client
    const reduceBy = Number(message.getFlag(MODULE_ID, "reduceBy"));
    if ( reduceBy > 0 ) target.reduceBy = reduceBy;
    const poolSpend = message.getFlag(MODULE_ID, "poolSpend");
    if ( poolSpend ) target.poolSpend = poolSpend;
    const bent = message.getFlag(MODULE_ID, "bent");        // a `roll` answer
    if ( bent ) target.bent = bent;
    const rescue = message.getFlag(MODULE_ID, "rescue");
    if ( rescue ) target.rescue = rescue;
  }
});

// The cast IS the answer: a listed reaction cast from the sheet answers its own hold.
Hooks.on("dnd5e.postUseActivity", activity => {
  const actor = activity?.actor;
  // A `roll` row (Lucky's "Disadvantage" is no Reaction) is checked before the activation gate.
  const bends = rollRowUsed(activity);
  if ( !actor || (!bends && (activity.activation?.type !== "reaction")) ) return;
  if ( !canAnswerFor(actor) ) return;

  void (async () => {
    if ( bends ) return bendFromTheSheet(actor, bends);
    // ⚠ Match on what was CAST: a statblock's Shield lives on "Spellcasting".
    const names = interruptEntries().map(e => e.name.toLowerCase());
    const castName = (await reactionNameFor(activity))?.toLowerCase();
    if ( !names.includes(castName) ) return;
    await answerHoldsFor(activity, actor);
  })();
});

/** Fold a real cast into every hold it answers. */
async function answerHoldsFor(activity, actor) {
  // ⚠ Collect every hold, THEN apply once: concurrent applications each pass the duplicate
  // check (+10 AC). The WHOLE log, never a tail: one round can emit dozens of messages.
  const answering = [];
  for ( const message of game.messages.contents ) {
    const hold = message.getFlag(MODULE_ID, "hold");
    if ( !hold || (hold.status !== "pending") ) continue;
    const target = hold.targets.find(t => (t.uuid === actor.uuid) && !t.answer);
    if ( target ) answering.push({ message, uuid: target.uuid, reaction: target.reaction });
  }
  if ( !answering.length ) return;

  let applied = [];
  applied = await applyReactionEffect(activity, actor, answering[0].reaction);
  for ( let i = 0; i < answering.length; i++ ) {
    const { message, uuid } = answering[i];
    await answerHold(message, uuid, "cast", { appliedEffects: i === 0 ? applied : [] });
  }
}

/* THE `roll` ANSWER (RULINGS *Rescuing the hit*): the cost paid BY HAND (a use() would post a
 * card, and Warding Flare's would place its emanation), the second d20 rolled in the open. */

/** The INTERRUPT_ROLLS row a name keys, case-insensitively. */
function rollRow(name) {
  const key = Object.keys(INTERRUPT_ROLLS).find(k => lower(k) === lower(name));
  return key ? { key, row: INTERRUPT_ROLLS[key] } : null;
}

function rescueSpendLine(rescue, poolSpend) {
  const found = rollRow(rescue);
  return found ? rescueSpendText({ row: found.row, poolSpend }) : "";
}

/** The row's key when this use is a listed `roll` row's own activity (Lucky ships two), else null. */
function rollRowUsed(activity) {
  const found = rollRow(activity?.item?.name);
  if ( !found || !interruptEntries().some(e => (e.kind === "roll") && (lower(e.name) === lower(found.key))) ) return null;
  return lower(activity?.name) === lower(found.row.activity) ? found.key : null;
}

/**
 * Disadvantage on a roll already made: a second d20 with the attack's die modifiers minus
 * keep/drop; on an Advantage roll nothing is rolled (the two cancel).
 */
async function bendTheRoll(attackMessage, actor, name) {
  const roll = attackMessage.rolls?.[0];
  const d20 = roll?.dice?.[0] ?? null;
  const { kept, plain } = d20Faces(d20?.results ?? []);
  if ( !roll || !Number.isFinite(kept) ) return null;
  const mode = d20ModeOf({ number: d20?.number, modifiers: d20?.modifiers });
  let second = null;
  if ( needsSecondD20(mode) ) {
    try {
      const mods = (d20?.modifiers ?? []).filter(m => !/^(k|d)[hl]?\d*$/i.test(String(m)));
      const die = await new Roll(`1d20${mods.join("")}`).evaluate();
      await die.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${name} — the second d20 (Disadvantage)` });
      second = Number(die.total);
    } catch(err) {
      console.error(`${TITLE} | ${name}'s second d20 could not be rolled — the first stands.`, err);
    }
  }
  const faces = (d20?.results ?? []).filter(r => !r?.rerolled).map(r => r.result);
  return disadvantageOutcome({ mode, kept, plain, second, total: Number(roll.total), faces,
    critAt: Number(d20?.options?.criticalSuccess ?? roll.options?.criticalSuccess ?? 20),
    fumbleAt: Number(d20?.options?.criticalFailure ?? roll.options?.criticalFailure ?? 1) });
}

/**
 * The popup's answer for a `roll` row. A row spent since the popup opened answers nothing.
 * @param {ChatMessage} attackMessage
 * @param {object} target  the hold's target entry
 * @param {string} name
 */
export async function rescueReaction(attackMessage, target, name) {
  const actor = await fromUuid(target.uuid);
  const found = rollRow(name);
  const record = (target.rescues ?? []).find(r => lower(r.name) === lower(name));
  const item = actor?.items.get(record?.itemId) ?? null;
  if ( !found || !item ) {
    ui.notifications.warn(`${TITLE}: could not find ${name} on ${target.name}.`);
    return;
  }
  const { key, row } = found;
  if ( row.reaction && reactionSpent(actor) ) {
    ui.notifications.warn(`${TITLE}: ${target.name}'s Reaction is already spent this round.`);
    return;
  }
  if ( row.uses && !(Number(item.system?.uses?.value ?? 0) > 0) ) {
    ui.notifications.warn(`${TITLE}: ${target.name} has no ${row.point ? `${row.point}s` : `uses of ${key}`} left.`);
    return;
  }
  let poolSpend = null;
  if ( row.uses ) poolSpend = await spendPoolUses(actor, item, key, 1, row.point ? `${row.point}s` : null)
    .catch(err => { console.warn(`${TITLE} | Could not spend a use of ${key}.`, err); return null; });
  if ( row.reaction ) await spendReaction(actor, { origin: item.uuid, what: key });
  const bent = await bendTheRoll(attackMessage, actor, key);
  return answerHold(attackMessage, target.uuid, "roll", { poolSpend, bent, rescue: key });
}

/**
 * A GUARD's answer (Protection), recorded on the protected target; refused when the Reaction or
 * the Shield is gone since the ask.
 * @param {ChatMessage} attackMessage
 * @param {object} target  the protected creature's entry
 * @param {object} guard
 */
export async function protectReaction(attackMessage, target, guard) {
  const actor = await fromUuid(guard.uuid);
  const found = rollRow(guard.row);
  const item = actor?.items.get(guard.itemId) ?? null;
  if ( !actor || !found || !item ) {
    ui.notifications.warn(`${TITLE}: could not find ${guard.row} on ${guard.name}.`);
    return;
  }
  if ( reactionSpent(actor) ) {
    ui.notifications.warn(`${TITLE}: ${guard.name}'s Reaction is already spent this round.`);
    return;
  }
  if ( !holdsFor(actor, found.row.holding) ) {
    ui.notifications.warn(`${TITLE}: ${guard.name} is not holding ${found.row.holding === "shield" ? "a Shield" : "a Shield or a weapon"} — ${found.key} cannot be used.`);
    return;
  }
  await spendReaction(actor, { origin: item.uuid, what: found.key });
  const bent = await bendTheRoll(attackMessage, actor, found.key);
  return answerHold(attackMessage, target.uuid, "roll", { bent, rescue: found.key, by: guard.uuid });
}

/** The sheet's answer for a `roll` row: ONE hold, the oldest asking (unlike Shield, "that roll" only). */
async function bendFromTheSheet(actor, name) {
  for ( const message of game.messages.contents ) {
    const hold = message.getFlag(MODULE_ID, "hold");
    if ( !hold || (hold.status !== "pending") ) continue;
    const target = hold.targets.find(t => (t.uuid === actor.uuid) && !t.answer
      && (t.rows ?? []).some(r => (lower(r.key) === lower(name)) && !r.off));
    if ( !target ) continue;
    const bent = await bendTheRoll(message, actor, name);
    return answerHold(message, target.uuid, "roll", { bent, rescue: name });
  }
}

/**
 * The Cast button REALLY casts; the usage hook answers the hold. ⚠ Never merely record "cast":
 * the hold would resolve against an unchanged AC (ARCHITECTURE.md §6).
 */
export async function castReaction(attackMessage, target) {
  const actor = await fromUuid(target.uuid);
  // Parry's pack activity is a heal that would post its own card: spent by hand instead.
  if ( target.reduce?.formula ) return parryReaction(attackMessage, target, actor);
  // A TEXT-ONLY feature (Uncanny Dodge): nothing to use.
  const own = actor?.items.get(target.itemId);
  if ( own && !target.activityId && isTextOnlyFeature(own) ) {
    await spendReaction(actor, { origin: own.uuid, what: own.name });
    return answerHold(attackMessage, target.uuid, "cast");
  }
  // ⚠ Prefer the recorded activity: a statblock casts Shield from Spellcasting's `cast` activity;
  // the linked spell item reports spellSlot:true with no slots and is refused.
  let activity = target.activityId
    ? actor?.items.get(target.itemId)?.system.activities?.get(target.activityId)
    : null;
  if ( !activity ) {
    // The reaction's real item, not the first name match (a worn shield is named Shield too).
    const item = reactionItem(actor, target.reaction);
    activity = item?.system.activities?.contents?.find(a => a.activation?.type === "reaction")
      ?? item?.system.activities?.contents?.[0];
  }
  if ( !activity ) {
    ui.notifications.warn(`${TITLE}: could not find ${target.reaction} on ${target.name} to cast.`);
    return;
  }
  // No usage dialog (the lowest slot; upcast from the sheet); the module drives what follows.
  await activity.use({ subsequentActions: false }, { configure: false }, {});
}

/** Parry's answer: pool and Reaction spent, the reduction rolled in the open. */
async function parryReaction(attackMessage, target, actor) {
  const item = actor?.items.get(target.itemId) ?? reactionItem(actor, target.reaction);
  const activity = item?.system?.activities?.get(target.reduce.activityId) ?? null;
  const pool = activity ? poolOf(actor, activity) : null;
  if ( pool && !(Number(pool.system?.uses?.value ?? 0) > 0) ) {
    ui.notifications.warn(`${TITLE}: ${actor.name} has no ${target.reduce.spend ?? "Superiority Die"} left for ${target.reaction}.`);
    return answerHold(attackMessage, target.uuid, "pass");
  }
  let total = 0;
  try {
    const formula = Roll.replaceFormulaData(String(target.reduce.formula), actor.getRollData());
    const roll = await new Roll(formula).evaluate();
    const rise = reductionRise({ roll: roll.toJSON(), from: actor.uuid });   // a reaction that modifies a roll: the dice, then the number, over the defender
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${target.reaction} — the die, plus the modifier`,
      ...(rise ? { flags: { [MODULE_ID]: { diceRise: rise } } } : {}) });
    total = Math.max(0, Number(roll.total) || 0);
  } catch(err) {
    console.error(`${TITLE} | ${target.reaction}'s reduction could not be rolled — reduce by hand.`, err);
  }
  let poolSpend = null;
  if ( pool ) poolSpend = await spendSuperiorityDie(actor, pool, target.reaction).catch(err => { console.warn(`${TITLE} | Could not spend a ${target.reduce.spend ?? "Superiority Die"} for ${target.reaction}.`, err); return null; });
  await spendReaction(actor, { origin: item?.uuid ?? null, what: target.reaction });
  return answerHold(attackMessage, target.uuid, "cast", { reduceBy: total, poolSpend });
}
