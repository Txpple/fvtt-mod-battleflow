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
import { spendReaction, poolOf, spendSuperiorityDie } from "../shared.js";
import { registerRelay } from "../ui.js";
import { reactionItem, reactionNameFor, applyReactionEffect, reactionACArrived, reactionImg } from "./lookup.js";

/** Record an answer for one held target and continue once every held target has answered.
 * `appliedEffects` (receipt-shaped entries from applyEffectsTo) rides along when the
 * answering client just applied the reaction's own effect — the receipt must be written by
 * a client that OWNS its message, which is exactly what splits the two branches below:
 * the response message is the answering player's own (receipt embedded at creation), and
 * the direct branch runs only where this client owns the held message itself. */
export async function answerHold(attackMessage, uuid, answer, { appliedEffects = [], reduceBy = null, poolSpend = null } = {}) {
  const hold = foundry.utils.deepClone(attackMessage.getFlag(MODULE_ID, "hold") ?? {});
  if ( hold.status !== "pending" ) return;
  const target = hold.targets?.find(t => t.uuid === uuid);
  if ( !target || target.answer ) return;                // idempotent: first answer wins
  target.answer = answer;
  target.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)
  if ( Number(reduceBy) > 0 ) target.reduceBy = Number(reduceBy);   // Parry's roll, at the answer
  if ( poolSpend ) target.poolSpend = poolSpend;                      // Parry's die, the spend record

  // Players cannot update someone else's message, so a player's answer travels as their OWN
  // message; the continuing client applies it to the hold (ARCHITECTURE.md §3 — clients
  // volunteer, they never command). "Gren passes" is good table record either way.
  const actor = await fromUuid(uuid);
  const ac = actor?.system?.attributes?.ac?.value ?? null;
  target.acAtAnswer = ac;

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
    const effectLanded = negate ? true : reactionACArrived(actor, target);
    const lines = negate
      ? [cast ? `<strong>${hold.spell}</strong> does nothing to them.`
              : `No reaction — the <strong>${hold.spell}</strong> lands.`]
      : cast
        ? [effectLanded ? `AC is now <strong>${ac}</strong>.`
                        : `<em>Its AC has not landed yet — the verdict will use the real number.</em>`]
        : [`No reaction — the attack lands.`];
    await ChatMessage.create({
      content: bfCard({
        img: reactionImg(actor, target.reaction, target),
        eyebrow: cast ? "Reaction — cast" : "Reaction — passed",
        title: cast ? target.reaction : "Lets it land",
        subtitle: target.name,
        lines,
        tone: cast ? "good" : "neutral"
      }),
      speaker: ChatMessage.getSpeaker({ actor }),
      // The reaction's own receipt (v1.8.0 — the §2.5 gap closed) rides the answering
      // player's OWN message, because they cannot flag someone else's: the standard
      // effectReceipt shape, so receipts.js renders the row + the GM's revert for free.
      flags: { [MODULE_ID]: { respondsTo: attackMessage.id, uuid, answer, ac, effectLanded,
        ...(Number(reduceBy) > 0 ? { reduceBy: Number(reduceBy) } : {}),
        ...(poolSpend ? { poolSpend } : {}),
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
    if ( !target || target.answer ) return false;
    target.answer = message.getFlag(MODULE_ID, "answer");
    target.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)
    const reduceBy = Number(message.getFlag(MODULE_ID, "reduceBy"));
    if ( reduceBy > 0 ) target.reduceBy = reduceBy;
    const poolSpend = message.getFlag(MODULE_ID, "poolSpend");
    if ( poolSpend ) target.poolSpend = poolSpend;
  }
});

// The cast IS the answer: a listed reaction used by a held target answers its own hold, so a
// player who just casts Shield from their sheet never has to touch our buttons at all.
Hooks.on("dnd5e.postUseActivity", activity => {
  if ( !setting(S.reactionHold) ) return;
  const actor = activity?.actor;
  if ( !actor || (activity.activation?.type !== "reaction") ) return;
  // Exactly one client may volunteer this answer — the same client that owns the decision.
  // Without this gate every client that sees the cast posts its own "Gren reacts" message.
  if ( !canAnswerFor(actor) ) return;

  void (async () => {
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
    ui.notifications.warn(`${TITLE}: ${actor.name} has no Superiority Die left for ${target.reaction}.`);
    return answerHold(attackMessage, target.uuid, "pass");
  }
  let total = 0;
  try {
    const formula = Roll.replaceFormulaData(String(target.reduce.formula), actor.getRollData());
    const roll = await new Roll(formula).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${target.reaction} — the die, plus the modifier` });
    total = Math.max(0, Number(roll.total) || 0);
  } catch(err) {
    console.error(`${TITLE} | ${target.reaction}'s reduction could not be rolled — reduce by hand.`, err);
  }
  // The one pass-through for a hand spend (shared.js): the record rides the answer so the card,
  // the popup and the flash all say "Combat Superiority: N of M remaining" (user, 2026-09-05).
  let poolSpend = null;
  if ( pool ) poolSpend = await spendSuperiorityDie(actor, pool, target.reaction).catch(err => { console.warn(`${TITLE} | Could not spend a Superiority Die for ${target.reaction}.`, err); return null; });
  await spendReaction(actor, { origin: item?.uuid ?? null, what: target.reaction });
  return answerHold(attackMessage, target.uuid, "cast", { reduceBy: total, poolSpend });
}
