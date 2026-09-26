/**
 * Battle Flow — the reaction hold, part 5: THE ANSWER. `answerHold` (the three channels: the
 * player's own response message, the GM's flag flip, the fold the spine's relay applies), the
 * cast that IS the answer (a listed reaction used by a held target), and the two ways the
 * popup's Cast button really casts — natively, or Parry's die rolled in the open.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, canAnswerFor, isContinuingClient } from "../core.js";
import { isTextOnlyFeature } from "../decide/eligible.js";
import { interruptEntries } from "../settings.js";
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
 * ONE ANSWER AMONG SEVERAL ASKED (the fighting styles, 2026-09-26, ruled P1): a held target may be
 * asked of itself AND of the guards beside it (Protection). Any answer that ACTS — a cast, a bent
 * roll — settles the target, the first one winning; a PASS settles it only once everyone asked has
 * passed (a guard's pass must not take the others' chance away), and until then it is recorded on
 * the one who passed. With no guards this is exactly the old rule: the first answer wins. `by` is
 * the answering guard's uuid, null for the target itself.
 * @returns {boolean|"partial"}  true when the target is now answered, "partial" when a pass was only
 *   recorded, false when there was nothing to record
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

/** Record an answer for one held target and continue once every held target has answered.
 * `appliedEffects` (receipt-shaped entries from applyEffectsTo) rides along when the
 * answering client just applied the reaction's own effect — the receipt must be written by
 * a client that OWNS its message, which is exactly what splits the two branches below:
 * the response message is the answering player's own (receipt embedded at creation), and
 * the direct branch runs only where this client owns the held message itself. */
export async function answerHold(attackMessage, uuid, answer, { appliedEffects = [], reduceBy = null, poolSpend = null, bent = null, rescue = null, by = null } = {}) {
  const hold = foundry.utils.deepClone(attackMessage.getFlag(MODULE_ID, "hold") ?? {});
  if ( hold.status !== "pending" ) return;
  const target = hold.targets?.find(t => t.uuid === uuid);
  const recorded = recordAnswer(target, answer, by);     // idempotent: the first act wins
  if ( !recorded ) return;
  if ( recorded === true ) target.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)
  if ( Number(reduceBy) > 0 ) target.reduceBy = Number(reduceBy);   // Parry's roll, at the answer
  if ( poolSpend ) target.poolSpend = poolSpend;                      // Parry's die, the spend record
  // A `roll` answer (Slice A, 2026-09-24): which row bent the roll, and what stood — the second
  // d20 was rolled at the answer, in the open, so the continuation only takes the verdict again.
  if ( bent ) target.bent = bent;
  if ( rescue ) target.rescue = rescue;

  // Players cannot update someone else's message, so a player's answer travels as their OWN
  // message; the continuing client applies it to the hold (ARCHITECTURE.md §3 — clients
  // volunteer, they never command). "Gren passes" is good table record either way.
  const actor = await fromUuid(uuid);
  const ac = actor?.system?.attributes?.ac?.value ?? null;
  target.acAtAnswer = ac;
  // THE MOMENT (events.js version 2, 2026-09-11): the gate publishes `hold-answered` (and `maneuver`
  // for Parry's die) when this answer lands on the hold record — on the ANSWERING client, which is
  // why the user id is written here: a relayed answer is folded by the continuing client below, and
  // the picture should still fire where the player pressed.
  target.answeredBy = game.user.id;

  if ( !attackMessage.isOwner && by ) {
    // A GUARD's answer (Protection): its own card, in its own voice — who protected whom, the cost.
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
    // Say what actually happened, not just "reacts" — this card is the table's record AND
    // the first thing anyone reads when a hold resolves oddly, so it carries the reaction,
    // the AC it produced, and whether the reaction's effect is actually on the actor yet.
    // ⚠ Only quote the AC once it has actually ARRIVED. This card is written the instant the
    // cast returns, when the effect document exists but derived data has not recomputed — so
    // reading the number here printed "casts Shield — AC now 12" under a +5 (reported live
    // 2026-08-15). Better to say it is coming than to publish a number that is wrong.
    const cast = answer === "cast";
    // A negate hold has no AC story to tell — the reaction's whole effect on this moment is
    // that the spell does nothing, and quoting an AC here would answer a question nobody asked.
    const negate = target.kind === "negate";
    const bending = answer === "roll";   // Slice A: the defender's card carries the spend; the verdict is the attack card's
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
      // The reaction's own receipt (v1.8.0 — the §2.5 gap closed) rides the answering
      // player's OWN message, because they cannot flag someone else's: the standard
      // effectReceipt shape, so receipts.js renders the row + the GM's revert for free.
      flags: { [MODULE_ID]: { respondsTo: attackMessage.id, uuid, answer, ac, effectLanded,
        ...(Number(reduceBy) > 0 ? { reduceBy: Number(reduceBy) } : {}),
        ...(poolSpend ? { poolSpend } : {}),
        // Slice A's two envelope fields, additive (the bytes of the others unchanged, §4 *The relay*).
        ...(bent ? { bent } : {}),
        ...(rescue ? { rescue } : {}),
        ...(appliedEffects.length ? { effectReceipt: { targets: appliedEffects } } : {}) } }
    });
    return;
  }
  if ( appliedEffects.length ) {
    // ⚠ Through the serializer (D3): "one casting answers many holds" means this path can run
    // twice in a tick against the same card, and a clone-mutate-set would drop the first
    // merge. Same defect the damage receipt had — core.js records the measurement.
    await queueFlagWrite(attackMessage, "effectReceipt", flag => {
      for ( const entry of appliedEffects ) joinEffectReceipt(flag, entry);
    });
  }
  await attackMessage.setFlag(MODULE_ID, "hold", hold);
}

// A player's answer message landing: the CONTINUING CLIENT folds it into the hold flag.
// ⚠ Through the spine's relay registry since the §4.1 consolidation - ONE createChatMessage
// registration now serves all three relays. The OWNER stays this machine's (`isContinuingClient`,
// not the elect), which is exactly why the relay is a registry and not a merge.
// ⚠ The envelope is FLAT - `respondsTo` plus sibling `uuid`/`answer` flags - because this same
// message also carries an `effectReceipt` for receipts.js to render, so `targetOf` is the
// identity function here. Do NOT tidy it into a nested object: that is a wire-format change on
// messages players write and another client reads, and an answer in flight across a deploy
// would simply stop folding.
registerRelay("respondsTo", {
  flagKey: "hold",
  targetOf: response => response,
  owns: hold => (hold.status === "pending") && isContinuingClient(hold),
  // ⚠ THROUGH THE SERIALIZER (D3, 2026-08-22). This is a PER-TARGET write to a shared array:
  // two answer messages landing in one tick both cloned the same stale flag, each recorded its
  // own target, and the second write dropped the first answer. The guards repeat INSIDE the
  // lock - saves.js's flip idiom - so the state they test is the state being written, and
  // "nothing to record" skips the write entirely rather than churning a render.
  fold: (flag, _response, message) => {
    if ( flag.status !== "pending" ) return false;
    const target = flag.targets?.find(t => t.uuid === message.getFlag(MODULE_ID, "uuid"));
    // `by` (2026-09-26): a guard's answer — additive to the envelope, absent on every other one.
    const recorded = recordAnswer(target, message.getFlag(MODULE_ID, "answer"), message.getFlag(MODULE_ID, "by") ?? null);
    if ( !recorded ) return false;
    if ( recorded === "partial" ) return;   // a guard's pass, recorded: the others are still asked
    target.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)
    target.answeredBy = message.author?.id ?? null;   // the gate publishes this moment on THAT user's client
    const reduceBy = Number(message.getFlag(MODULE_ID, "reduceBy"));
    if ( reduceBy > 0 ) target.reduceBy = reduceBy;
    const poolSpend = message.getFlag(MODULE_ID, "poolSpend");
    if ( poolSpend ) target.poolSpend = poolSpend;
    const bent = message.getFlag(MODULE_ID, "bent");        // a `roll` answer (Slice A, 2026-09-24)
    if ( bent ) target.bent = bent;
    const rescue = message.getFlag(MODULE_ID, "rescue");
    if ( rescue ) target.rescue = rescue;
  }
});

// The cast IS the answer: a listed reaction used by a held target answers its own hold, so a
// player who just casts Shield from their sheet never has to touch our buttons at all.
Hooks.on("dnd5e.postUseActivity", activity => {
  if ( !setting(S.reactionHold) ) return;
  const actor = activity?.actor;
  // A `roll` row used from the sheet (Slice A, 2026-09-24) answers too — and Lucky's
  // "Disadvantage" is no Reaction, so it is asked before the activation gate. The use has
  // already spent what it costs (dnd5e's own consumption, and the Reaction chip above).
  const bends = rollRowUsed(activity);
  if ( !actor || (!bends && (activity.activation?.type !== "reaction")) ) return;
  // Exactly one client may volunteer this answer — the same client that owns the decision.
  // Without this gate every client that sees the cast posts its own "Gren reacts" message.
  if ( !canAnswerFor(actor) ) return;

  void (async () => {
    if ( bends ) return bendFromTheSheet(actor, bends);
    // ⚠ Match on what was CAST, not on what owns the activity. A statblock's Shield lives on a
    // feature called "Spellcasting", so matching the item's name never matched any interrupt
    // and a monster casting from its own sheet answered nothing.
    const names = interruptEntries().map(e => e.name.toLowerCase());
    const castName = (await reactionNameFor(activity))?.toLowerCase();
    if ( !names.includes(castName) ) return;
    await answerHoldsFor(activity, actor);
  })();
});

/** Fold a real cast into every hold it answers. */
async function answerHoldsFor(activity, actor) {
  // ⚠ Collect every hold this cast answers, THEN act once. A multiattack that lands twice
  // stamps two holds on the same target and one Shield answers both — but spawning the work
  // per hold ran the applications CONCURRENTLY, and applyReactionEffect's duplicate check is
  // a read followed by an await: each call looked before any other had created anything, so
  // each created its own. One casting, +10 AC (caught by smoke-hold 2026-08-15 — "AC moves
  // +5" read 12 → 22). RAW a reaction is cast once and covers every attack it answers, so
  // the effect lands once up front and the answers are sequenced behind it.
  // ⚠ The WHOLE log, never a tail window. Under auto-resolution one multiattack round can
  // emit dozens of messages (attacks, damage, receipts, announcements, mastery cards), and a
  // tail-bounded scan silently missed the hold — the same trap the smoke suites document for
  // damage searches. Pending holds are rare; the filter is one cheap in-memory pass.
  const answering = [];
  for ( const message of game.messages.contents ) {
    const hold = message.getFlag(MODULE_ID, "hold");
    if ( !hold || (hold.status !== "pending") ) continue;
    const target = hold.targets.find(t => (t.uuid === actor.uuid) && !t.answer);
    if ( target ) answering.push({ message, uuid: target.uuid, reaction: target.reaction });
  }
  if ( !answering.length ) return;

  let applied = [];
  if ( setting(S.holdApplyEffect) ) applied = await applyReactionEffect(activity, actor, answering[0].reaction);
  // The effect landed ONCE (RAW: one cast covers every attack it answers), so its receipt
  // rides the FIRST answer only — a receipt per hold would say it applied twice.
  for ( let i = 0; i < answering.length; i++ ) {
    const { message, uuid } = answering[i];
    await answerHold(message, uuid, "cast", { appliedEffects: i === 0 ? applied : [] });
  }
}

/* ---------------------------------------------------------------------------------------------
 * THE `roll` ANSWER (Slice A, ruled 2026-09-24 off prototypes/slice-a.html): Lucky, Warding Flare,
 * Shadowy Dodge — Disadvantage imposed on the attack roll after the hit showed. The answering
 * client pays the row's cost BY HAND (the Parry precedent: a use() would post a usage card, and
 * Warding Flare's would place its 30-foot emanation), rolls the second d20 in the open, and the
 * arithmetic of what stands is decide/rescue-hit.js's. The verdict is taken again by the
 * continuation against the live AC (continue.js), through the composed roll.
 * ------------------------------------------------------------------------------------------- */

/** The INTERRUPT_ROLLS row a name keys, case-insensitively — `{ key, row }` or null. */
function rollRow(name) {
  const key = Object.keys(INTERRUPT_ROLLS).find(k => lower(k) === lower(name));
  return key ? { key, row: INTERRUPT_ROLLS[key] } : null;
}

/** The defender's card line for the spend — the prototype's words, one reader. */
function rescueSpendLine(rescue, poolSpend) {
  const found = rollRow(rescue);
  return found ? rescueSpendText({ row: found.row, poolSpend }) : "";
}

/**
 * Was this use a `roll` row's own answer? The item is a listed `roll` row and the activity is
 * the one the row names (Lucky ships two, and "Advantage" answers nothing here). The row's key or null.
 */
function rollRowUsed(activity) {
  const found = rollRow(activity?.item?.name);
  if ( !found || !interruptEntries().some(e => (e.kind === "roll") && (lower(e.name) === lower(found.key))) ) return null;
  return lower(activity?.name) === lower(found.row.activity) ? found.key : null;
}

/**
 * Disadvantage on the attack roll already made: the second d20 rolled in the open with the
 * attack's own die modifiers (a Halfling attacker's natural-1 reroll rides it; the keep and drop
 * never do), and what stands (decide/rescue-hit.js `disadvantageOutcome` — the Advantage case
 * rolls nothing: the two cancel and the first die is the plain roll).
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
 * The popup's answer for a `roll` row: the cost paid (a Luck Point or a use by the one hand-spend
 * pass-through — its record rides the hold target for the flash and the card; the Reaction chip),
 * the roll bent, the answer recorded. A row spent since the popup opened says so and answers
 * nothing — the hold stays open, the card's Answer recalls the popup.
 * @param {ChatMessage} attackMessage
 * @param {object} target  the hold's target entry
 * @param {string} name    the row's name
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
 * A GUARD's answer (the fighting styles, 2026-09-26, ruled R1): Protection, from the creature beside
 * the one being hit — its Reaction spent, the attack roll bent exactly as Lucky's is (the second d20
 * in the open, the lower standing), the answer recorded on the protected target with who gave it.
 * The standing half (Disadvantage on every attack against it until the guard's next turn) lands at
 * the continuation. Refused, and said, when the Reaction went or the Shield came off since the ask.
 * @param {ChatMessage} attackMessage
 * @param {object} target  the hold's target entry — the protected creature
 * @param {object} guard   the entry's guard record
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

/**
 * The sheet's answer for a `roll` row — the fix-the-rules-gap rule (2026-09-24): a player who
 * uses Lucky's Disadvantage or Warding Flare from the sheet mid-hold answers the hold the popup
 * would have. ONE hold, the oldest this defender is still being asked about with the row live —
 * Disadvantage is imposed on "that roll", never on every roll the way one Shield covers them all.
 */
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
 * The Cast button REALLY casts — it uses the reaction activity natively, exactly as clicking
 * the spell on the sheet would: the slot is spent, the card is posted, and the usage hook
 * fires, which is what answers the hold and applies the effect.
 *
 * ⚠ It must never merely record "cast" as an answer. Doing that (the shape this shipped in
 * first) produced a hold that resolved against an unchanged AC — Shield "cast" with no slot
 * spent, no effect, and a cheerful "raises AC to 12" over a hit that should have missed
 * (caught by Tom in live play, 2026-08-15). ARCHITECTURE.md §6 is explicit: the cast IS the answer,
 * and the button is convenience, not protocol. A cancelled cast answers nothing, correctly
 * leaving the hold open.
 */
export async function castReaction(attackMessage, target) {
  const actor = await fromUuid(target.uuid);
  // A REDUCTION reaction (Parry, 2026-09-05): nothing to use — the pack's activity is a heal
  // that would post a card of its own. The die is spent from the pool, the Reaction spent, the
  // formula rolled in the open, and the number rides the answer for the applier to subtract.
  if ( target.reduce?.formula ) return parryReaction(attackMessage, target, actor);
  // A TEXT-ONLY feature (the 2024 Uncanny Dodge): nothing to use, so the answer is written
  // here and the Reaction chip spent here — the two things a use would have done.
  const own = actor?.items.get(target.itemId);
  if ( own && !target.activityId && isTextOnlyFeature(own) ) {
    await spendReaction(actor, { origin: own.uuid, what: own.name });
    return answerHold(attackMessage, target.uuid, "cast");
  }
  // Prefer the activity the hold recorded. A statblock casts Shield from its Spellcasting
  // feature's `cast` activity — the spell item of the same name is a linked target that
  // reports spellSlot:true with no slots, so casting THAT is refused for want of a resource.
  let activity = target.activityId
    ? actor?.items.get(target.itemId)?.system.activities?.get(target.activityId)
    : null;
  if ( !activity ) {
    // No recorded activity (an older hold, or a spell-item reaction): resolve the reaction's
    // real item rather than the first thing sharing its name — a worn shield has no activities
    // at all, so a bare name match here produces "could not find Shield to cast".
    const item = reactionItem(actor, target.reaction);
    activity = item?.system.activities?.contents?.find(a => a.activation?.type === "reaction")
      ?? item?.system.activities?.contents?.[0];
  }
  if ( !activity ) {
    ui.notifications.warn(`${TITLE}: could not find ${target.reaction} on ${target.name} to cast.`);
    return;
  }
  // No usage dialog: the reaction window is already a table pause, and stacking a slot
  // picker inside it spends the moment this feature exists to protect. The system picks the
  // lowest available slot, which is what a Shield cast wants. A player who needs to upcast
  // casts from their sheet instead — that is detected identically (ARCHITECTURE.md §6).
  // subsequentActions:false — the (v) guard: a reaction whose activity carries a damage part
  // must not chain dnd5e's own follow-up roll; the module drives everything after the use.
  await activity.use({ subsequentActions: false }, { configure: false }, {});
}

/** Parry's answer: the pool spent, the Reaction spent, the reduction rolled in the open, the number on the answer. */
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
  // The one pass-through for a hand spend (shared.js): the record rides the answer so the card,
  // the popup and the flash all say "Combat Superiority: N of M remaining" (user, 2026-09-05).
  let poolSpend = null;
  if ( pool ) poolSpend = await spendSuperiorityDie(actor, pool, target.reaction).catch(err => { console.warn(`${TITLE} | Could not spend a ${target.reduce.spend ?? "Superiority Die"} for ${target.reaction}.`, err); return null; });
  await spendReaction(actor, { origin: item?.uuid ?? null, what: target.reaction });
  return answerHold(attackMessage, target.uuid, "cast", { reduceBy: total, poolSpend });
}
