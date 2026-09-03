/**
 * Battle Flow — Phase 1.5: the reaction hold. Two entry points, one machine - eligibility, both triggers (attack and listed spell), answers, continuation, the veto, the no-attack damage applier's claim. Views live in ui.js.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, drivesMomentFor,
  canApplyTo, whisperNoGM, canAnswerFor, isContinuingClient,
  statContext } from "./core.js";
import { limitedUses, isReactionItem, isTextOnlyFeature } from "./decide/eligible.js";
import { interruptEntries, blockEntries } from "./settings.js";
import { joinEffectReceipt } from "./decide/receipt.js";
// ⚠ Bare on purpose since (gg) retired the post-answer roll (the continuation releases the
// claim instead): the import itself still pins auto-damage.js's evaluation — and with it every
// hook registration order check-hook-order asserts — exactly where the §9 entry graph has it.
import "./auto-damage.js";
import { bfCard, popupKey, holdBarHTML } from "./decide/present.js";
// Safe as a STATIC edge: shared.js registers no hooks and the entry graph evaluates it first.
import { damagePartsOf, reactionSpent, spendReaction, statSourceOf } from "./shared.js";
// ⚠ ONE-WAY since D6 (2026-08-23). ui.js is the spine and no longer knows this feature exists;
// what comes back are spine primitives only. Do NOT let a hold-shaped name travel the other
// way — reinstating an `import … from "./hold.js"` in ui.js re-forms the cycle D6 broke.
// This import also PINS the order: ui.js's body evaluates before this file's, so the
// damage-offer bar still registers above the hold row exactly as it did when they shared one
// handler (asserted in check-hook-order.mjs).
import { openMomentPopup, momentButton, scheduleBarSync, armDeadline, disarmDeadline,
  shownMoments, livePopups, registerRelay } from "./ui.js";
// Safe as a STATIC edge (unlike auto-apply.js below): effect-riders.js registers no hooks,
// so evaluating it early cannot reorder anything — check-hook-order.mjs proves it.
import { applyEffectsTo } from "./effect-riders.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1.5 — the reaction hold (a pause, NOT a system)
 *
 * Shield-class reactions trigger on "you are hit", BEFORE damage — and RAW the player knows
 * they were hit, not what the damage would be. Rolling damage instantly would make every
 * Shield decision perfectly informed and every fix a rewind. So the chain pauses here, and
 * a human answers. The module never plays the reaction; it only waits (DESIGN.md §4: reaction
 * automation is a permanent non-goal).
 *
 * The hold lives in a flag on the attack message — the popup and the card row are both just
 * views of it, so a reload rebuilds them and three different answer channels (the player's
 * Pass message, the player's own cast, the GM's flag flip) need no coordination at all.
 * ------------------------------------------------------------------------------------------- */

/** Is a slot of at least `level` available (including pact magic)? */
function hasSpellSlot(actor, level) {
  if ( !level ) return true; // cantrip / at-will
  for ( const [key, slot] of Object.entries(actor.system.spells ?? {}) ) {
    // Both must be real. A remaining value with a zero maximum is phantom data — an NPC's
    // maxima are DERIVED from spellcasting progression and recompute to 0, leaving a stale
    // `value` behind that would advertise slots the actor cannot actually spend, and hold
    // every attack for a reaction it can never cast.
    if ( !slot?.value || !slot?.max ) continue;
    const numbered = /^spell(\d+)$/.exec(key);
    const slotLevel = numbered ? Number(numbered[1]) : slot.level;
    if ( Number.isFinite(slotLevel) && (slotLevel >= level) ) return true;
  }
  return false;
}

/**
 * The item that actually IS this reaction on this actor — for every question asked ABOUT a
 * reaction after eligibility: where its effect lives, what it looks like, what its AC bonus is.
 *
 * ⚠ ONE NAME CAN MATCH SEVERAL ITEMS, and the wrong match is silent. An armoured statblock
 * caster owns a mundane shield (`equipment` named "Shield" — no effects, no activation) AND,
 * because a `cast` activity keeps its spell as a cached copy on the actor, a Shield SPELL.
 * `items.find()` returns whichever sorts first, and on an unlinked token the base actor's
 * equipment sorts ahead of the delta-created cached spell. Every downstream question then
 * interrogates the wrong document: "has the effect landed?" is answered no forever, the +5
 * becomes unmeasurable so hopeless holds stop being skippable, and the popup shows a shield's
 * artwork above a shield's description. findInterrupt learned this for ELIGIBILITY (it tests
 * every match, ground truth 2026-08-15); these lookups never did, and the result was a hold
 * that resolved correctly as a miss while announcing "Reaction — not applied … so this
 * resolves as a hit" — authoritative and wrong (caught by smoke-hold's statblock section).
 *
 * Preference order: the cached spell of the cast activity the hold recorded, because a
 * statblock's Shield lives there and nowhere else; then a match that can really be used as a
 * reaction; then one that at least carries effects; then whatever is left.
 */
export function reactionItem(actor, reactionName, { itemId, activityId } = {}) {
  if ( !actor || !reactionName ) return null;
  const cached = activityId
    ? actor.items.get(itemId)?.system.activities?.get(activityId)?.cachedSpell
    : null;
  if ( cached ) return cached;
  const matches = actor.items.filter(i => i.name.toLowerCase() === reactionName.toLowerCase());
  return matches.find(i => isReactionItem(i) && i.effects.size)
    ?? matches.find(i => isReactionItem(i))
    ?? matches.find(i => i.effects.size)
    ?? matches[0] ?? null;
}

/**
 * Can this actor use the named reaction RIGHT NOW — and through which item and activity?
 * Returns `{ item, activity }` or null. Eligibility is deliberately conservative: a hold the
 * target cannot answer is a pure false stop.
 *
 * Asked by both triggers. The attack trigger walks the curated interrupt list until one of
 * them answers; the spell trigger asks about exactly one reaction by name (the one its block
 * list pairs with the spell being cast), which is why this is a lookup rather than a loop.
 */
async function usableReaction(actor, name) {
  if ( !actor || !name ) return null;

  // ⚠ THE MONSTER PATTERN COMES FIRST, because it is the common one. A 2024 statblock does
  // not cast from the spell item at all: its "Spellcasting" feature carries one `cast`
  // ACTIVITY per spell, and the resource lives on that activity — verified on Skeletal Mage
  // ("Shield - Spellcasting", activation reaction, uses 1/1, consumption activityUses) and
  // on the compendium Green Hag, which has the same shape on two features. The spell item
  // that activity points at is a linked target: it reports spellSlot:true and no uses, so
  // interrogating IT concluded the monster could not cast, and no statblock caster ever
  // held (reported live 2026-08-15).
  const cast = await findCastActivity(actor, name);
  if ( cast ) return { item: cast.item, activity: cast.activity };
  // ⚠ EVERY item of that name, not the first. A caster who both wears a shield and knows
  // Shield has two items called "Shield", and `find` returned whichever sorted first — so
  // picking the mundane one disqualified the entry and the spell was never even considered.
  // That is most armoured statblock casters.
  for ( const item of actor.items.filter(i => i.name.toLowerCase() === name.toLowerCase()) ) {
    // The ABILITY by name, not its effect (user, 2026-09-02): a listed feature the pack ships
    // as text only — the 2024 Uncanny Dodge — is found the way the maneuver folds find
    // Riposte. It has no activity to use; the answer spends the Reaction chip itself.
    if ( !isReactionItem(item) && !isTextOnlyFeature(item) ) continue;

    const uses = limitedUses(item);
    if ( uses === "spent" ) continue;                 // limited-use feature, none left
    if ( item.type === "spell" ) {
      // ⚠ `prepared` is a PC concept. Every levelled spell on a 2024-statblock NPC reads
      // prepared: 0 — verified on Skeletal Mage, whose whole spell list does — so gating on
      // it disqualified the entire monster side of this feature in silence.
      if ( (actor.type === "character") && !item.system.prepared ) continue;
      // ⚠ A spell can be paid for by its OWN limited uses rather than a slot: the Monster
      // Manual's "Additional Spells" x/x pool, which is how most statblock casters carry
      // Shield. Requiring a slot meant those never held, because monster slot maxima derive
      // from a caster level statblocks rarely set and sit at 0.
      if ( (uses === "none") && !hasSpellSlot(actor, item.system.level) ) continue;
    }
    return { item, activity: null };
  }
  return null;
}

/**
 * The first curated interrupt this actor can actually use right now, or null.
 */
async function findInterrupt(actor, { isCritical }) {
  if ( !actor || reactionSpent(actor) ) return null;
  for ( const entry of interruptEntries() ) {
    // A natural 20 hits regardless of AC, so an AC-type reaction cannot save it — no pause.
    if ( isCritical && (entry.kind === "ac") ) continue;
    const found = await usableReaction(actor, entry.name);
    if ( !found ) continue;
    // ALREADY STANDING ⇒ DON'T ASK AGAIN (user call, the v1.15.0 walk's finding ⑥: "if they
    // have shield up, just dont prompt for shield"). Gren was re-prompted for Shield with his
    // +5 already active — a pause offering a choice that changes nothing, which is the false
    // stop this gate exists to prevent (DESIGN.md §4: the GM/player click economy).
    //
    // Narrow on purpose, twice over:
    //  - `ac` kind ONLY. An AC bonus does not stack, so a second cast is pure waste. A
    //    `damage` reaction is a different question — Absorb Elements grants resistance to the
    //    TRIGGERING damage type, so a standing one is no reason to refuse the next trigger.
    //  - The attack trigger ONLY. This function is not on the spell/negate path, and that is
    //    deliberate: a standing Shield already grants "no damage from Magic Missile", so
    //    silently skipping the hold there would apply damage to someone immune to it. That
    //    trigger keeps asking until it can auto-negate (not built; recorded in DESIGN.md).
    if ( (entry.kind === "ac") && hasReactionEffect(actor, entry.name,
      { itemId: found.item.id, activityId: found.activity?.id }) ) continue;
    return { entry, ...found };
  }
  return null;
}

/** The spell a `cast` activity casts — the activity's own name is decoration, the link is truth. */
async function castSpellName(activity) {
  if ( activity?.type !== "cast" ) return null;
  const uuid = activity.spell?.uuid;
  if ( !uuid ) return null;
  try { return (await fromUuid(uuid))?.name ?? null; } catch(err) { return null; }
}

/** Whatever a used activity should be MATCHED against: its linked spell, or its item. */
async function reactionNameFor(activity) {
  return (await castSpellName(activity)) ?? activity?.item?.name ?? null;
}

/**
 * A feature's `cast` activity for the named spell, if this actor can use it as a reaction.
 *
 * ⚠ "No pool" means AT-WILL here, not "unavailable" — the opposite of the spell-item rule. A
 * statblock's at-will spells carry `uses.max: ""` and no consumption target at all (the Green
 * Hag's Spellcasting feature is exactly this), so demanding a pool would block every at-will
 * reaction. A pool that exists and is empty still disqualifies.
 */
async function findCastActivity(actor, spellName) {
  const wanted = spellName?.toLowerCase();
  for ( const item of actor.items ) {
    for ( const activity of item.system?.activities?.contents ?? [] ) {
      if ( activity.type !== "cast" ) continue;
      if ( activity.activation?.type !== "reaction" ) continue;
      if ( (await castSpellName(activity))?.toLowerCase() !== wanted ) continue;
      const max = Number(activity.uses?.max);
      const pooled = Number.isFinite(max) && (max > 0);
      if ( pooled && !(Number(activity.uses?.value) > 0) ) continue;   // pool exists, spent
      return { item, activity };
    }
  }
  return null;
}

// Reaction-spent bookkeeping — the core click-volume guard (ARCHITECTURE.md §6) — is a CHIP on
// the combat clock since 2026-09-02 (shared.js `reactionSpent` / `spendReaction`): any reaction
// an actor takes writes it, clocked to their own next turn, and the platform brings it back —
// the two clear hooks that used to live here counted turns by hand. Out of combat nothing is
// written (the old stranding guard, now the clock's own shape); a deleted combat sweeps the chip
// with every other window it clocked (mastery.js's tidy).
Hooks.on("dnd5e.postUseActivity", activity => {
  // ⚠ The reactor's OWN client may write this when no GM is on (v1.27.2): the chip lives on the
  // reacting actor, and a reaction is nearly always a PC's.
  if ( !setting(S.reactionHold) ) return;
  if ( !drivesMomentFor(activity?.actor?.uuid ?? null) ) return;
  if ( activity?.activation?.type !== "reaction" ) return;
  void spendReaction(activity.actor, { origin: activity.item?.uuid ?? null, what: activity.item?.name ?? "a Reaction" });
});

/**
 * If any hit target holds a usable interrupt, stamp the hold and return true (the caller
 * must not roll damage). The stamping client records itself as the one that will continue —
 * it is the attacker's client, the only one that can roll this activity's damage.
 */
export async function stampHoldIfInterrupted(attackMessage, roll, hits) {
  if ( !setting(S.reactionHold) ) return false;
  if ( attackMessage.getFlag(MODULE_ID, "hold") ) return true; // already held; never re-stamp

  const held = [];
  const skipped = [];
  for ( const target of hits ) {
    const actor = await fromUuid(target.uuid);
    const found = await findInterrupt(actor, { isCritical: roll.isCritical });
    if ( found && !holdWouldMatter(actor, found, roll, target.ac) ) {
      // The stat only this line witnesses (data-plane second pass, 2026-08-27): a hopeless
      // hold skipped in silence left NO record anywhere, so "how often did Shield actually
      // matter" was unanswerable. Recorded, never presented — the skip stays invisible at
      // the table, exactly as before.
      skipped.push({ uuid: target.uuid, name: target.name, reaction: found.entry.name });
      continue;
    }
    if ( found ) held.push({
      uuid: target.uuid, name: target.name, ac: target.ac,
      reaction: found.entry.name, kind: found.entry.kind,
      // The exact activity that answers this hold. A statblock casts Shield from a feature's
      // cast activity, not from the spell item, so a name lookup at Cast time finds the wrong
      // document (or an unusable one) — record the ids instead of rediscovering them.
      itemId: found.item.id, activityId: found.activity?.id ?? null,
      // Was the reaction's effect ALREADY on them when we stamped? If so the snapshot AC
      // already contains its bonus, and "did the AC move by the bonus" is unanswerable — see
      // reactionACArrived, which needs to know it cannot measure a delta.
      // ⚠ The ENTRY's name, not the found item's. On the statblock path the found item is the
      // "Spellcasting" feature, so asking about its effects answers a different question and
      // always says no.
      hadEffect: hasReactionEffect(actor, found.entry.name,
        { itemId: found.item.id, activityId: found.activity?.id }),
      answer: null, verdict: null
    });
  }
  if ( skipped.length ) {
    void attackMessage.setFlag(MODULE_ID, "holdSkipped", {
      targets: skipped, ...statContext(statSourceOf(attackMessage))
    }).catch(err => console.error(`${TITLE} | holdSkipped stamp failed.`, err));
  }
  if ( !held.length ) return false;

  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);

  // ⚠ Answers and verdicts live ON each target entry, never in a map keyed by uuid. Foundry
  // EXPANDS dotted keys when it persists an update, and every uuid contains dots — so
  // `{ "Actor.abc": "cast" }` comes back as `{ Actor: { abc: "cast" } }` and every lookup
  // silently misses forever (bit live 2026-08-15; Phase 1's receipts dodged it by accident
  // for the same reason — they are an array too).
  await attackMessage.setFlag(MODULE_ID, "hold", {
    status: "pending",
    ...statContext(statSourceOf(attackMessage)), // the data-plane stamp — the attacker's swing
    continuedBy: game.user.id,
    // The deadline is absolute and lives on the flag, so the bar is a pure function of state:
    // every client and every re-render derives the same remaining time without its own clock.
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
    targets: held
  });
  armHoldTimer(attackMessage);
  return true;
}

/**
 * Would this reaction actually change anything? A hold that cannot possibly help is a pure
 * false stop — it spends the table's attention and the player's nerve to ask a question with
 * one answer.
 *
 * ⚠ Gated on full disclosure, and that gate is not politeness. With the math hidden the player
 * is meant to decide on faith, and silently skipping the hopeless prompts would leak exactly
 * what the RAW setting withholds: a hold that never appears would tell them the attack beat
 * their AC by more than the reaction could add. Skip only when they could have worked it out
 * anyway.
 */
function holdWouldMatter(actor, found, roll, snapshotAC) {
  if ( !setting(S.holdSkipFutile) || !setting(S.holdReveal) ) return true;
  if ( found.entry.kind !== "ac" ) return true;   // damage reactions always reduce something
  // ⚠ The entry's name plus the found ids — `found.item` is the "Spellcasting" feature on a
  // statblock caster, whose effects say nothing about Shield's +5.
  const bonus = reactionACBonus(found.entry.name, actor,
    { itemId: found.item.id, activityId: found.activity?.id });
  if ( bonus == null ) return true;               // unmeasurable bonus — ask the human
  const liveAC = actor?.system?.attributes?.ac?.value ?? snapshotAC;
  if ( !Number.isFinite(liveAC) ) return true;
  return roll.total < (liveAC + bonus);           // only worth asking if it can force a miss
}

/* ---------------------------------------------------------------------------------------------
 * The SECOND trigger: a listed spell, not an attack (ARCHITECTURE.md §5).
 *
 * Shield's own text is "you have a +5 bonus to AC … and you take no damage from Magic Missile",
 * and the 2024 statblock condition says the same: "when you are hit by an attack roll or
 * targeted by the Magic Missile spell". That second half is unreachable from rollAttackV2 —
 * Magic Missile is a plain `damage` activity with no attack roll anywhere in it — so the hold
 * gets a second entry point here, at the moment of USE.
 *
 * The kind is neither of the existing two. There is no attack roll to re-test (`ac`) and
 * nothing to reduce by hand (`damage`): the spell's damage simply never lands on that target.
 * So a `negate` hold has no re-test, no settle window and no AC arithmetic — the answer IS the
 * verdict, and continueSpellHold is correspondingly short.
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  if ( !setting(S.reactionHold) ) return;
  // The usage card is the held document here, exactly as the attack message is over there — and
  // it already carries the same target snapshot, because getTargetDescriptors() is baked into
  // every activity's messageFlags (mixin.mjs), not into attack rolls specifically. Cards are
  // never suppressed (v1.10.0), so the native card is always the bus.
  const message = (results?.message instanceof ChatMessage) ? results.message : null;
  if ( !message ) return; // used with create: false — no card, no bus, nothing to hold

  void (async () => {
    // ⚠ Match what was CAST, not what owns the activity — the same rule the answer side lives
    // by. A statblock casting Magic Missile does it through a `cast` activity on a feature
    // called "Spellcasting", and CastActivity#use hands this hook the CACHED SPELL's activity,
    // whose item is genuinely named "Magic Missile". reactionNameFor covers both shapes.
    const spellName = (await reactionNameFor(activity))?.toLowerCase();
    if ( !spellName ) return;
    const entries = blockEntries().filter(e => e.spell.toLowerCase() === spellName);
    if ( !entries.length ) return;
    await stampSpellHold(message, entries);
    await releaseUnheldSpellDamage(activity, message);
  })();
});

/**
 * When NO hold stamped (nobody eligible, everyone spent), clear the damage roll's pending
 * claim (spellHoldPending: false) so the auto-applier stops waiting and applies. A stamped
 * hold needs nothing here: the native chain already ties the roll to the usage card, and
 * the hold's own resolution releases the claim. The subsequent damage roll can land a beat
 * after this runs — poll briefly for it.
 */
async function releaseUnheldSpellDamage(activity, holdMessage) {
  try {
    if ( holdMessage.getFlag(MODULE_ID, "hold") ) return; // held — resolution owns the release
    const itemUuid = activity?.item?.uuid ?? null;
    if ( !itemUuid ) return;
    const deadline = Date.now() + 4000;
    let damage = null;
    while ( !damage && (Date.now() < deadline) ) {
      damage = game.messages.contents.filter(m =>
        (m.getFlag("dnd5e", "roll.type") === "damage")
        && (m.author?.id === game.user.id)
        && (m.getFlag("dnd5e", "item")?.uuid === itemUuid)
        && (m.getFlag(MODULE_ID, "spellDamage") === true)
        && (m.timestamp >= holdMessage.timestamp - 10_000)).pop() ?? null;
      if ( !damage ) await new Promise(r => setTimeout(r, 200));
    }
    if ( !damage ) return; // rolled with subsequentActions:false, or autoApply off — fine
    if ( damage.getFlag(MODULE_ID, "spellHoldPending") )
      await damage.setFlag(MODULE_ID, "spellHoldPending", false);
  } catch(err) {
    console.error(`${TITLE} | Could not release the spell damage claim.`, err);
  }
}

/**
 * Stamp a `negate` hold on a usage card for every target holding a reaction that stops it.
 * Same flag shape as the attack hold, so the popup, the card row, the timer, all three answer
 * channels and the reaction-spent guard are reused verbatim — the only new thing on it is
 * `trigger: "spell"`, which is how the roll-dependent paths know to branch.
 */
async function stampSpellHold(message, entries) {
  if ( message.getFlag(MODULE_ID, "hold") ) return;      // already held; never re-stamp
  const targets = message.getFlag("dnd5e", "targets") ?? [];
  if ( !targets.length ) return;

  const held = [];
  for ( const target of targets ) {
    const actor = await fromUuid(target.uuid);
    if ( !actor || reactionSpent(actor) ) continue;
    for ( const entry of entries ) {
      const found = await usableReaction(actor, entry.reaction);
      if ( !found ) continue;
      held.push({
        uuid: target.uuid, name: target.name, ac: target.ac,
        reaction: entry.reaction, kind: "negate", spell: entry.spell,
        itemId: found.item.id, activityId: found.activity?.id ?? null,
        answer: null, verdict: null
      });
      break;   // one reaction answers the spell; a second hold on the same target asks twice
    }
  }
  if ( !held.length ) return;

  // ⚠ Deliberately NO holdSkipFutile test. A hopeless hold is one that cannot change the
  // outcome, and this one always can: negating means zero damage regardless of the numbers.
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await message.setFlag(MODULE_ID, "hold", {
    status: "pending",
    trigger: "spell",
    spell: entries[0].spell,
    ...statContext(statSourceOf(message)), // the data-plane stamp — the caster's spell
    continuedBy: game.user.id,
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
    targets: held
  });
  armHoldTimer(message);
}

/** Record an answer for one held target and continue once every held target has answered.
 * `appliedEffects` (receipt-shaped entries from applyEffectsTo) rides along when the
 * answering client just applied the reaction's own effect — the receipt must be written by
 * a client that OWNS its message, which is exactly what splits the two branches below:
 * the response message is the answering player's own (receipt embedded at creation), and
 * the direct branch runs only where this client owns the held message itself. */
export async function answerHold(attackMessage, uuid, answer, { appliedEffects = [] } = {}) {
  const hold = foundry.utils.deepClone(attackMessage.getFlag(MODULE_ID, "hold") ?? {});
  if ( hold.status !== "pending" ) return;
  const target = hold.targets?.find(t => t.uuid === uuid);
  if ( !target || target.answer ) return;                // idempotent: first answer wins
  target.answer = answer;
  target.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)

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
 * Is the named reaction's effect already on this actor? Matched by NAME as well as origin:
 * the casting client applies from an item CLONE (Activity#use clones the item), so its
 * origin uuid differs from the one the continuing client would compute, and an origin-only
 * test would happily apply Shield twice.
 */
function hasReactionEffect(actor, reactionName, ids) {
  if ( !actor || !reactionName ) return false;
  const item = reactionItem(actor, reactionName, ids);
  const names = new Set((item?.effects?.contents ?? []).map(e => e.name));
  return actor.effects.some(e => !e.disabled && (names.has(e.name)
    || (e.origin && item && e.origin.includes(item.id))));
}

// The reaction's self-cast sliver, CONVERGED at v1.8.0: the application runs through the
// one shared loop (applyEffectsTo — name-or-origin dedupe for the clone-origin problem
// above, the reactionEffect marker via extraFlags), and the entries it returns become the
// standard effectReceipt on whichever message the answer path OWNS (the response message,
// or the held message itself) — the §2.5 receipt/revert gap, closed. Two appliers remain
// in the module by POLICY, not accident: this shared loop for document copies, and
// applyMasteryEffect for authored chips (see its comment for why that stays separate).
// Returns receipt-shaped entries; [] when nothing landed or the application failed.
/**
 * Put a cast reaction's own effect on its caster — the button the native effects tray is
 * waiting for someone to press. Scoped hard: only the reaction that answered a hold, only
 * onto the caster, only while that hold is open. This is a deliberate sliver of Phase 3,
 * and it exists because without it the whole feature reads a stale AC and lies: Shield's +5
 * lives in a non-transfer effect, so a cast alone moves nothing.
 *
 * Mirrors EffectApplicationElement._applyEffectToActor (5.3.3): re-enable and refresh the
 * duration of an existing same-origin effect, otherwise create it disabled:false /
 * transfer:false with origin set, so the system's own cleanup and expiry apply unchanged.
 */
async function applyReactionEffect(activity, actor, reactionName, ids) {
  try {
    // ⚠ A cast activity has no effects of its own — they live on the spell it links to. Its
    // owning item is the feature ("Spellcasting"), so fall back to the reaction's own item on
    // this actor, which is where Imperceptible Barrier actually sits. Resolved through
    // reactionItem, never a bare name match: on an armoured caster that finds the worn shield.
    let effects = activity?.applicableEffects ?? [];
    if ( !effects.length && reactionName ) {
      const spell = reactionItem(actor, reactionName, ids);
      effects = (spell?.effects?.contents ?? []).filter(e => !e.transfer);
    }
    if ( !effects.length ) return [];
    return await applyEffectsTo([{ uuid: actor.uuid, name: actor.name }], effects, {
      matchNames: true,
      extraFlags: { [MODULE_ID]: { reactionEffect: true } },
      source: actor.uuid // the data-plane stamp's source — the reactor's own self-cast
    });
  } catch(err) {
    console.error(`${TITLE} | Could not apply the reaction's effect — apply it from the card.`, err);
    return [];
  }
}

// Drive the continuation whenever a held message changes and every held target has answered.
// Deliberately reads the message's CURRENT state rather than inspecting the update diff:
// setFlag issues a flattened `flags.<module>.hold` key, so a nested-path test against
// `changed` silently never matches (bit live 2026-08-15). The early-outs are cheap.
Hooks.on("updateChatMessage", message => {
  // Every client closes popups whose decision has already been made — this runs before the
  // continuing-client gate on purpose, because the popup to close is usually on a DIFFERENT
  // client from the one driving the continuation.
  closeAnsweredHoldPopups(message);

  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  if ( !hold.targets.every(t => t.answer) ) return;
  void continueHold(message);
});

/**
 * Continuations this client is already driving. The body below AWAITS for up to holdSettle
 * seconds with the flag still `pending`, and any OTHER update landing on the held message in
 * that window (a mastery ask stamped on the same attack, a receipt) re-fires the
 * updateChatMessage watcher, which would find "pending, all answered" and run the whole
 * continuation AGAIN — double announcements and a second damage roll. Over-applying damage
 * is the worst failure this module has, so the claim is taken before the first await.
 * In-memory on purpose: the race is same-client re-entry (the watcher is already gated to
 * one client by isContinuingClient), and a persisted claim would strand the hold if the
 * claiming client died mid-continuation — the render hook's resume check below needs the
 * flag still readable as "pending and ready".
 */
const continuationsInFlight = new Set();

/**
 * Re-resolve a fully-answered hold and continue the chain.
 *
 * ⚠ The re-test runs against the target's LIVE AC, never the stored descriptor — that
 * snapshot was taken before the Shield existed. And the AC does not move the instant a
 * reaction is cast: Shield's +5 arrives as a non-transfer active effect the native tray
 * applies (monster reactions ship theirs DISABLED for the GM to switch on), so a cast is
 * given a settle window to let the change land before the verdict is taken. Phase 3 closes
 * this properly by applying the effect itself.
 */
export async function continueHold(attackMessage) {
  if ( continuationsInFlight.has(attackMessage.id) ) return;
  const hold = foundry.utils.deepClone(attackMessage.getFlag(MODULE_ID, "hold"));
  if ( !hold || (hold.status !== "pending") ) return;
  continuationsInFlight.add(attackMessage.id);
  try {
    return await driveHoldContinuation(attackMessage, hold);
  } finally {
    continuationsInFlight.delete(attackMessage.id);
  }
}

async function driveHoldContinuation(attackMessage, hold) {

  // Safety net before the verdict: make sure a cast reaction's effect is actually ON the
  // actor. The casting client is supposed to have done this, but it only will if it owns the
  // actor AND is running current code — and if it didn't, the re-test silently reads the
  // pre-reaction AC and calls a miss a hit (exactly what happened live 2026-08-15: "Shield
  // raises AC to 12"). Idempotent: an effect already present is left alone.
  //
  // ⚠ This net only catches what the continuing client OWNS. On an NPC attack that client is
  // the GM, who owns everything — but on a PC attack (autoDamage "pc"/"all") it is the
  // attacking PLAYER, who owns none of the monsters holding reactions, so the net no-ops and
  // the monster side rests entirely on the answering GM's applyReactionEffect. Monster
  // reactions ship their effects DISABLED, so watch this seam when dogfooding PC attacks.
  if ( setting(S.holdApplyEffect) ) {
    for ( const target of hold.targets.filter(t => t.answer === "cast") ) {
      const actor = await fromUuid(target.uuid);
      if ( !actor?.isOwner || hasReactionEffect(actor, target.reaction, target) ) continue;
      // The reaction's own ITEM is what matters here, not the activity — applyReactionEffect
      // falls back to that item's effects, which is the only place a statblock's Shield keeps
      // Imperceptible Barrier (its cast activity carries none). `target` carries the itemId and
      // activityId the hold recorded, so the cached spell is found rather than a worn shield.
      const item = reactionItem(actor, target.reaction, target);
      const activity = item?.system.activities?.contents?.[0];
      const entries = await applyReactionEffect(activity, actor, target.reaction, target);
      if ( entries.length ) {
        // The continuing client owns the held message (its roll, or the GM fallback), so
        // the safety net's receipt lands there — same shape, same rows, same revert. Through
        // the serializer (D3): this loop runs per target, so it is its own concurrent writer.
        await queueFlagWrite(attackMessage, "effectReceipt", flag => {
          for ( const entry of entries ) joinEffectReceipt(flag, entry);
        });
      }
    }
  }

  // A negate hold ends here: there is nothing to re-test, so there is nothing to settle for
  // either. The effect above still went on — casting Shield against Magic Missile really does
  // also give you the +5 until your next turn — but this verdict does not depend on it.
  if ( hold.trigger === "spell" ) return continueSpellHold(attackMessage, hold);

  if ( hold.targets.some(t => t.answer === "cast") ) await settleForACChange(hold);

  const roll = attackMessage.rolls[0];
  const announcements = [];
  for ( const target of hold.targets ) {
    const actor = await fromUuid(target.uuid);
    const liveAC = actor?.system?.attributes?.ac?.value ?? target.ac;
    const hit = roll.isCritical || (!roll.isFumble && (roll.total >= liveAC));
    target.verdict = hit ? "hit" : "miss";
    target.acAtVerdict = liveAC;
    if ( target.answer !== "cast" ) continue;
    const img = reactionImg(actor, target.reaction, target);
    if ( target.kind === "ac" ) {
      // If the reaction's AC never arrived, the number we just tested against is the one the
      // target had BEFORE reacting — so say so instead of reporting a stale value as fact.
      // A silent "still hits" here is the worst possible outcome: it looks authoritative.
      if ( !reactionACArrived(actor, target) ) {
        // ⚠ A FLAT AC can never receive this, and saying so is the whole difference between a
        // one-field fix and a mystery. dnd5e's prepareArmorClass RETURNS on the flat branch
        // before ac.bonus is added ("Flat AC (no additional bonuses)"), so an actor whose AC is
        // a fixed number silently ignores every AC effect — Shield included. The effect really
        // did land; the system simply refuses to count it, and the old wording ("its AC has not
        // arrived") sent the reader looking for a module bug that was not there. Reported live
        // 2026-08-15 on a hand-authored Skeletal Mage; the official Monster Manual pack has
        // exactly one flat statblock out of 500, so this is bad data, not a shape to support.
        const flatAC = (actor?.system?.attributes?.ac?.calc === "flat")
          && hasReactionEffect(actor, target.reaction, target);
        announcements.push(bfCard({
          img, eyebrow: "Reaction — not applied", title: target.reaction, subtitle: target.name,
          tone: "bad",
          lines: flatAC
            ? [`<strong>${target.name}</strong>'s AC is a <strong>fixed number</strong>, so no `
              + `bonus can reach it — ${target.reaction}'s included.`,
              `The effect did land; the system ignores it. AC reads <strong>${liveAC}</strong>, `
              + `so this resolves as a hit (${roll.total}).`,
              `<em>Fix the statblock: set its AC calculation to Natural Armor with the same `
              + `number, and the reaction works.</em>`]
            : [`It was cast, but its AC has not arrived on <strong>${target.name}</strong>.`,
              `AC still reads <strong>${liveAC}</strong>, so this resolves as a hit (${roll.total}).`,
              `<em>Apply the effect from the card, then Revert the damage if needed.</em>`]
        }));
      } else {
        announcements.push(bfCard({
          img, eyebrow: hit ? "Reaction — not enough" : "Reaction — it worked",
          title: target.reaction, subtitle: target.name, tone: hit ? "bad" : "good",
          lines: [`AC <strong>${target.ac}</strong>`
            + `${liveAC !== target.ac ? ` → <strong>${liveAC}</strong>` : ""}`
            + ` vs the attack's <strong>${roll.total}</strong>.`,
            hit ? `The attack still hits.` : `<strong>The attack misses.</strong>`]
        }));
      }
    } else {
      announcements.push(bfCard({
        img, eyebrow: "Reaction — cast", title: target.reaction, subtitle: target.name,
        tone: "neutral",
        lines: [`Reduce the damage by hand — the roll stands.`]
      }));
    }
  }

  hold.status = "resolved";
  disarmHoldTimer(attackMessage.id);   // resolved: the clock has nothing left to decide
  await attackMessage.setFlag(MODULE_ID, "hold", hold);
  if ( announcements.length ) await ChatMessage.create({
    content: announcements.join(`<div style="height:0.3rem;"></div>`),
    speaker: { alias: TITLE }
  });

  // (gg), the v1.20.0 walk-1 ruling: the dice rolled AT ATTACK TIME (auto-damage.js stamps
  // them `attackHoldPending`), so resolution RELEASES the claim instead of rolling — the
  // darts' pattern on the attack chain. The applier re-reads hitTargets, whose verdict
  // override drops every Shield-flipped target, so an all-flipped release applies to nobody
  // and the dice do nothing (the announcement above already said "The attack misses").
  // A roll still in an open offer window needs nothing here: rollDamageForAttack reads the
  // hold at ROLL time, finds it resolved, stamps no claim, and applies straight.
  for ( const dmg of game.messages.contents.filter(m =>
    (m.getFlag(MODULE_ID, "attackFor") === attackMessage.id)
    && (m.getFlag(MODULE_ID, "attackHoldPending") === true) ) ) {
    await dmg.setFlag(MODULE_ID, "attackHoldPending", false);
  }
}

/**
 * Resolve a `negate` hold — the whole of it. The answer IS the verdict: there is no roll to
 * re-test, no live AC to read and no dice waiting on the outcome, because this module never
 * rolled the spell's damage in the first place (Magic Missile is not an attack, so Phase 1a
 * ignores it and the caster presses their own Damage button).
 *
 * The verdict is what the preApplyDamage veto below reads, so writing it IS the block.
 */
async function continueSpellHold(message, hold) {
  const announcements = [];
  for ( const target of hold.targets ) {
    const cast = target.answer === "cast";
    target.verdict = cast ? "negated" : "hit";
    if ( !cast ) continue;
    const actor = await fromUuid(target.uuid);
    announcements.push(bfCard({
      img: reactionImg(actor, target.reaction, target),
      eyebrow: "Reaction — it worked", title: target.reaction, subtitle: target.name,
      tone: "good",
      // One sentence, because it already says the whole thing. A second line spelling out
      // "its damage is not applied to them" restated the first in mechanical language, and
      // naming the other targets answered a question nobody watching had asked.
      lines: [`<strong>${hold.spell}</strong> does nothing to <strong>${target.name}</strong>.`]
    }));
  }

  hold.status = "resolved";
  disarmHoldTimer(message.id);
  await message.setFlag(MODULE_ID, "hold", hold);
  if ( announcements.length ) await ChatMessage.create({
    content: announcements.join(`<div style="height:0.3rem;"></div>`),
    speaker: { alias: TITLE }
  });
}

/**
 * The block itself, and the reason it is real rather than advisory.
 *
 * Nothing else in this module touches a spell like Magic Missile: it is not an attack, so
 * Phase 1a never rolls its damage and Phase 1b never applies it (resolveAttackMessage returns
 * null for a chain with no attack in it). The damage is rolled and applied by hand, which
 * means the ONE place a negated target can actually be spared is the moment of application —
 * dnd5e.preApplyDamage, which cancels on an explicit false (actor.mjs:754).
 *
 * Scoped as tightly as it can be: the damage must chain back to a usage card carrying a
 * resolved `negate` hold, and that hold must name THIS actor with a `negated` verdict. Fires
 * on whichever client is applying (applyDamage is local and ownership-gated), never GM-only —
 * the veto has to hold wherever the button was pressed.
 *
 * ⚠ Accepted gap (ARCHITECTURE.md §6): a GM who presses Apply while the hold is still PENDING beats
 * the verdict and the damage lands, because there is no verdict yet to read. Vetoing pending
 * applications instead would be worse — a hold answered Pass would then need a second Apply
 * click that nobody would remember to make. The card reads "held — waiting on …" throughout.
 */
Hooks.on("dnd5e.preApplyDamage", (actor, amount, updates, options) => {
  if ( !setting(S.reactionHold) || !actor ) return;
  // The tray passes the DAMAGE message as originatingMessage (damage-application.mjs:76); the
  // usage card carrying the hold is one hop further back through the system's own registry.
  const damageMessage = options?.originatingMessage;
  // ⚠ Damage only. applyDamage is the path healing takes too (a heal is negative damage with
  // roll.type "healing"), and a reaction that stops a spell must never be able to refuse
  // someone a cure cast from the same card. Phase 1b draws the same line for the same reason.
  if ( damageMessage?.getFlag("dnd5e", "roll.type") !== "damage" ) return;
  const origin = damageMessage.getOriginatingMessage?.();
  let hold = (origin && (origin !== damageMessage)) ? origin.getFlag(MODULE_ID, "hold") : null;
  // Fallback (v1.6.0): a genuinely unbridged roll still gets the block — find the governing
  // hold by spell + actor, newest first, whole log (the tail-window lesson).
  if ( !hold && damageMessage.getFlag(MODULE_ID, "spellDamage") ) {
    let name = null;
    try { name = fromUuidSync(damageMessage.getFlag("dnd5e", "item")?.uuid ?? "")?.name?.toLowerCase() ?? null; }
    catch { name = null; }
    if ( name ) {
      hold = game.messages.contents.filter(m => {
        const h = m.getFlag(MODULE_ID, "hold");
        return (h?.trigger === "spell") && (h.spell?.toLowerCase() === name)
          && h.targets?.some(t => t.uuid === actor.uuid);
      }).pop()?.getFlag(MODULE_ID, "hold") ?? null;
    }
  }
  if ( (hold?.trigger !== "spell") || (hold.status !== "resolved") ) return;
  const target = hold.targets?.find(t => t.uuid === actor.uuid);
  if ( target?.verdict !== "negated" ) return;
  ui.notifications.info(
    `${TITLE}: ${target.reaction} — ${target.name} takes no damage from ${hold.spell}.`);
  return false;
});

/* --- the no-attack damage applier (v1.6.0) -------------------------------------------------
 * "It should auto apply; the shield stuff is its own mechanic" (user call). A damage-
 * activity roll — Magic Missile's shape, no attack anywhere in its chain — applies itself
 * to its snapshot targets on the elect, per target: a pending spell-hold claim defers the
 * whole roll (the resolution below releases it), a negated verdict skips that target (the
 * preApplyDamage veto above also guards — belt and braces), everything else lands through
 * the shared receipt applier. The birth stamp (`spellDamage`, preCreate) is the gate, so
 * history is inert and render-resume is safe.
 * ------------------------------------------------------------------------------------------- */

const spellDamageApplications = new Set();

async function applySpellDamage(message) {
  if ( spellDamageApplications.has(message.id) ) return;
  spellDamageApplications.add(message.id);
  try {
    if ( message.getFlag(MODULE_ID, "spellDamage") !== true ) return;
    if ( message.getFlag(MODULE_ID, "receipt") ) return;                   // applied already (resume)
    const hold = message.getOriginatingMessage?.()?.getFlag?.(MODULE_ID, "hold");
    if ( hold && (hold.status === "pending") ) return;                     // bridged and still open
    if ( message.getFlag(MODULE_ID, "spellHoldPending") === true ) {
      // Claimed for a hold. If the bridged hold has RESOLVED already (a damage button
      // pressed after the answer), fall through and apply per its verdicts; an unresolved
      // or not-yet-bridged claim keeps waiting — the release write will re-trigger.
      if ( !hold || (hold.status === "pending") ) return;
    }
    const targets = (message.getFlag("dnd5e", "targets") ?? [])
      .filter(t => hold?.targets?.find(h => h.uuid === t.uuid)?.verdict !== "negated")
      .map(t => ({ uuid: t.uuid, name: t.name }));
    if ( !targets.length ) return;
    const damages = damagePartsOf(message.rolls);
    if ( !damages.length ) return;
    // ⚠ WITH NO GM, ONLY THE TARGETS THIS CLIENT MAY WRITE ARE APPLIED (v1.27.2), and the rest
    // are spoken for. A spell's targets are usually monsters, so this is normally the whole
    // set — the roll stands, the card stands, and the damage tray is still there to press by
    // hand. Silence here would read as the resolver having applied nothing for no reason.
    const writable = targets.filter(t => {
      try { return canApplyTo(fromUuidSync(t.uuid)); } catch { return false; }
    });
    const blocked = targets.length - writable.length;
    if ( blocked ) {
      await whisperNoGM(`this spell's damage to ${blocked} target${blocked === 1 ? "" : "s"}`,
        "The roll stands — apply it from the card's damage tray.");
    }
    if ( !writable.length ) return;
    // ⚠ Lazily bound, and deliberately so (split, v1.6.1): a static import would evaluate
    // auto-apply.js — and through it mastery.js and concentration.js — before this file's
    // body, registering concentration's preApplyDamage cause capture AHEAD of the veto
    // above. Foundry stops calling preApplyDamage at the first false, so the veto must stay
    // first in line or a vetoed application strands a captured cause. Keep this dynamic.
    const { applyDamagesWithReceipt } = await import("./auto-apply.js");
    await applyDamagesWithReceipt(message, writable, damages);
  } catch(err) {
    console.error(`${TITLE} | Spell damage auto-apply failed.`, err);
  } finally {
    spellDamageApplications.delete(message.id);
  }
}

/** Who drives a spell-damage roll's application: the GM, or with none the CASTER's own client
 * (v1.27.2 — the roll is theirs, and the message is theirs to stamp a receipt on). */
const drivesSpellDamage = message =>
  drivesMomentFor(message?.getAssociatedActor?.()?.uuid ?? null);

// Three triggers, all flag-driven: arrival, the claim settling, and render (reload resume).
Hooks.on("createChatMessage", message => {
  if ( !setting(S.autoApply) || !drivesSpellDamage(message) ) return;
  if ( message.getFlag(MODULE_ID, "spellDamage") ) void applySpellDamage(message);
});

Hooks.on("updateChatMessage", message => {
  if ( !setting(S.autoApply) || !drivesSpellDamage(message) ) return;
  // The pending claim settled (cleared by the caster, or released by the resolution below).
  if ( message.getFlag(MODULE_ID, "spellDamage")
    && (message.getFlag(MODULE_ID, "spellHoldPending") === false)
    && !message.getFlag(MODULE_ID, "receipt") ) void applySpellDamage(message);
  // A spell hold resolved — release every damage roll waiting on it. The elect owns this
  // write; the release itself (spellHoldPending → false) is the bus event that applies.
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( (hold?.trigger === "spell") && (hold.status === "resolved") ) {
    for ( const dmg of game.messages.contents.filter(m =>
      (m.getFlag("dnd5e", "originatingMessage") === message.id)
      && (m.getFlag(MODULE_ID, "spellHoldPending") === true) ) ) {
      void dmg.setFlag(MODULE_ID, "spellHoldPending", false);
    }
  }
});

Hooks.on("dnd5e.renderChatMessage", message => {
  if ( !setting(S.autoApply) || !drivesSpellDamage(message) ) return;
  if ( message.getFlag(MODULE_ID, "spellDamage")
    && (message.getFlag(MODULE_ID, "spellHoldPending") !== true)
    && !message.getFlag(MODULE_ID, "receipt") ) void applySpellDamage(message);
});

/**
 * Has the reaction's AC actually ARRIVED — as opposed to "is there an effect row for it"?
 *
 * ⚠ These are different questions, and treating them as one is how a hold announced
 * "Shield raises AC to 12 — the attack still hits" as fact while the same actor read AC 17 a
 * moment later (reported live 2026-08-15). An effect document exists the instant it is
 * created; the AC it grants appears only once derived data recomputes, which happens a beat
 * later and on every client separately. A verdict must wait on the NUMBER.
 */
function reactionACArrived(actor, target) {
  if ( !hasReactionEffect(actor, target.reaction, target) ) return false;
  // Already applied when we stamped, so the snapshot contains the bonus and there is no delta
  // to look for — the effect row is the whole of what can be checked.
  if ( target.hadEffect ) return true;
  const bonus = reactionACBonus(target.reaction, actor, target);
  if ( bonus == null ) return true; // proficiency-scaled or formula bonus: not measurable here
  const liveAC = actor?.system?.attributes?.ac?.value;
  return Number.isFinite(liveAC) && (liveAC >= ((target.ac ?? 0) + bonus));
}

/**
 * Wait (briefly) for every cast reaction's AC to actually arrive. Resolves as soon as it has.
 * Deliberately waits on arrival rather than on "the number changed from a baseline": a
 * baseline captured after the recompute never changes again, and one captured before it can
 * be moved by something unrelated.
 */
async function settleForACChange(hold) {
  const deadline = Date.now() + (Math.max(1, Number(setting(S.holdSettle)) || 8) * 1000);
  const casts = hold.targets.filter(t => t.answer === "cast");
  while ( Date.now() < deadline ) {
    let allArrived = true;
    for ( const target of casts ) {
      const actor = await fromUuid(target.uuid);
      if ( !reactionACArrived(actor, target) ) { allArrived = false; break; }
    }
    if ( allArrived ) return;
    await new Promise(r => setTimeout(r, 250));
  }
}


/* ===============================================================================================
 * THE HOLD'S OWN VIEWS — moved here from ui.js by D6 (2026-08-23), unchanged.
 *
 * They lived in the spine because the hold was the first moment machine and the spine grew out
 * of it. That left ui.js importing `reactionItem`, `answerHold` and `continueHold` from this
 * file — the ui.js ↔ hold.js cycle, and the last thing making the spine depend on a FEATURE.
 * A view of the hold flag belongs with the machine that owns the flag (ARCHITECTURE.md §7).
 *
 * ⚠ What did NOT come with them, deliberately:
 *   · the damage-offer bar — it is not the hold's, and it keeps its own registration in ui.js,
 *     still evaluated first so it still renders ABOVE the hold row.
 *   · the delete-SWEEP — it clears every machine's popups, latches and acks, so it is spine.
 *     Only its one `disarmHoldTimer` line came here, as this file's own sweep, which is what
 *     every other timer-owning machine already does.
 *   · ~~`closeAnsweredPopups`~~ — ✅ **CAME HERE AT D2 (2026-08-23)** as
 *     `closeAnsweredHoldPopups`. D6 left it in ui.js on the argument that reading the hold flag
 *     by STRING makes no import edge, which was true and was the wrong test: it meant the spine
 *     still knew this feature existed, and knew it in the one way no check could see. It builds
 *     on `livePopups` now, the same shape every other machine already used.
 * ============================================================================================= */

/** The reaction's own artwork, for cards that talk about it. */
export function reactionImg(actor, reactionName, ids) {
  return reactionItem(actor, reactionName, ids)?.img ?? null;
}

/**
 * The hold's buzzer. Armed by whichever client owns the continuation — one authoritative
 * clock, not a cross-client timeout — and re-checked at the buzzer, because an answer landing
 * in the last instant must beat the timer rather than race it.
 */
const armedTimers = new Map();

export function armHoldTimer(message) {
  const hold = message?.getFlag(MODULE_ID, "hold");
  if ( !hold?.deadline || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  armDeadline(armedTimers, message.id, hold.deadline, fireHoldTimer);
}

export function disarmHoldTimer(messageId) {
  disarmDeadline(armedTimers, messageId);
}

/** At the buzzer, every unanswered target passes — the default outcome of an unmade decision. */
async function fireHoldTimer(messageId) {
  const message = game.messages.get(messageId);
  const hold = message?.getFlag(MODULE_ID, "hold");
  if ( !hold || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  const merged = foundry.utils.deepClone(hold);
  let expired = false;
  for ( const target of merged.targets ) {
    if ( target.answer ) continue;      // answered in the last instant — it wins, not the clock
    target.answer = "pass";
    target.answeredAt = Date.now();     // the buzzer's moment is an answer time too
    target.timedOut = true;
    expired = true;
  }
  if ( !expired ) return;
  await message.setFlag(MODULE_ID, "hold", merged);
}

/**
 * PRESENTATION LAW 4 (§5): a popup asking something already answered is a lie on screen, so a
 * decision made ANYWHERE closes the popup asking for it — the card, another client, or the
 * buzzer.
 *
 * ⚠ D2 (2026-08-23) moved this out of ui.js, where it was the last thing in the spine that knew
 * this feature existed. It read the hold flag by STRING, so it made no import edge and D6's
 * cycle break went straight past it. Every other machine already closed its own popups exactly
 * like this; the hold was the one whose popup-closing lived in the spine. Per-target, because
 * one casting can answer many holds and only the answered target's popup should go.
 */
function closeAnsweredHoldPopups(message) {
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold?.targets?.length ) return;
  for ( const target of hold.targets ) {
    const dialog = livePopups.get(popupKey(message.id, target.uuid));
    if ( !dialog ) continue;
    if ( (hold.status !== "pending") || target.answer ) void dialog.close();
  }
}

/**
 * The AC a listed reaction actually grants, read from the reaction's OWN effect instead of
 * hardcoding Shield's +5 — the interrupt list is user-editable, so anything that assumes
 * Shield is wrong for the other twelve entries. Returns null for a non-numeric bonus (a
 * proficiency-scaled one like Defensive Duelist), which simply omits the "would it flip" line.
 */
export function reactionACBonus(reactionName, actor, ids) {
  const item = reactionItem(actor, reactionName, ids);
  for ( const effect of item?.effects ?? [] ) {
    for ( const change of effect.changes ?? [] ) {
      if ( change.key !== "system.attributes.ac.bonus" ) continue;
      const value = Number(change.value);
      if ( Number.isFinite(value) ) return value;
    }
  }
  return null;
}

/**
 * The math a hold is allowed to show, or null when the reveal is off (the RAW default: you know
 * you were hit, not by how much).
 *
 * ⚠ ONE gate for BOTH surfaces. The popup used to reveal the numbers while the card row said
 * only "Shield?", so the same hold told two different stories depending on where you read it.
 * Any new surface reads this too — do not re-derive the numbers locally.
 */
function revealDetail(target, roll, actor) {
  if ( !setting(S.holdReveal) ) return null;
  const liveAC = actor?.system?.attributes?.ac?.value ?? target.ac;
  const total = roll?.total ?? null;
  const bonus = (target.kind === "ac") ? reactionACBonus(target.reaction, actor, target) : null;
  return {
    total, liveAC, bonus,
    wouldAC: bonus == null ? null : liveAC + bonus,
    wouldMiss: bonus == null ? null : (total < (liveAC + bonus))
  };
}

/** The reveal as one compact line, for the card row. */
function revealLine(reveal, target) {
  let text = `<strong>${reveal.total}</strong> vs AC <strong>${reveal.liveAC}</strong>`;
  if ( reveal.bonus != null ) text += ` · ${target.reaction} → AC ${reveal.wouldAC}, `
    + `<em>${reveal.wouldMiss ? "enough to miss" : "still hits"}</em>`;
  return text;
}

// The hold's durable row on the attack card. ⚠ Registration order is on-card order, and this
// registration used to live in ui.js: the pinned assertion moved with it (check-hook-order.mjs
// now reads hold.js before mastery.js). ui.js's damage-offer bar still registers first because
// this file imports ui.js, which is the same relative order they had inside one handler.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold?.targets?.length ) return;

  const row = document.createElement("div");
  row.className = "battleflow-hold";
  row.style.margin = "0.4rem 0 0";

  for ( const target of hold.targets ) {
    const block = document.createElement("div");
    block.style.marginTop = "0.25rem";
    row.append(block);

    // The card is the PUBLIC record of this moment — everyone watching the log sees the same
    // thing, whether or not they are the one being asked.
    void fromUuid(target.uuid).then(actor => {
      const roll = message.rolls[0];
      // A spell hold has no d20 anywhere on its message, so there is no math to reveal — asking
      // revealDetail anyway prints "null vs AC 15" and invents a verdict about an attack that
      // was never rolled. The reveal SETTING is untouched by this: a negate hold discloses
      // nothing a target could metagame on, because the answer never depends on a number.
      const spell = hold.trigger === "spell";
      const reveal = spell ? null : revealDetail(target, roll, actor);
      const lines = [];
      let tone = "neutral";
      let eyebrow = "Reaction";
      let subtitle = target.name;

      if ( hold.status === "pending" ) {
        tone = "pending";
        eyebrow = "Reaction — held";
        const owner = game.users.find(u => !u.isGM && actor?.testUserPermission(u, "OWNER"));
        subtitle = `${target.name} · waiting on ${owner?.name ?? "the GM"}`;
        if ( reveal ) lines.push(revealLine(reveal, target));
        else if ( spell ) lines.push(`<strong>${hold.spell}</strong> · `
          + `${target.reaction} stops it completely`);
      } else {
        const cast = target.answer === "cast";
        const negated = target.verdict === "negated";
        tone = (target.verdict === "miss") || negated ? "good" : cast ? "bad" : "neutral";
        // "skip" is retired (v1.1.15) but still labelled, because holds answered that way are
        // already sitting in the chat log and a re-render must not relabel history.
        eyebrow = negated ? "Reaction — it worked"
          : cast ? "Reaction — cast"
          : target.answer === "skip" ? "Reaction — skipped"
          : target.timedOut ? "Reaction — timed out" : "Reaction — passed";
        // Resolved cards carry the numbers the verdict was reached with, so a surprising
        // outcome can be read straight off the card instead of reconstructed. A spell hold has
        // no acAtVerdict, so this skips itself.
        if ( cast && (target.acAtVerdict != null) ) {
          const moved = target.acAtVerdict !== target.ac;
          lines.push(`AC <strong>${target.ac}</strong>${moved ? ` → <strong>${target.acAtVerdict}</strong>` : ""}`
            + ` vs the attack's <strong>${roll?.total}</strong>`);
        }
        if ( negated ) lines.push(`<strong>${hold.spell}</strong> does nothing to them.`);
        else if ( target.verdict ) lines.push(target.verdict === "miss"
          ? `<strong>The attack misses.</strong>`
          : spell ? `The <strong>${hold.spell}</strong> lands in full.`
          : `The attack still hits.`);
        else if ( target.answer === "pass" ) lines.push(target.timedOut
          ? "The reaction window closed — no answer, so the attack lands."
          : "Let it land — no reaction.");
      }

      block.innerHTML = bfCard({
        img: reactionImg(actor, target.reaction, target),
        eyebrow, title: target.reaction, subtitle, lines, tone
      }) + holdBarHTML(hold);
      scheduleBarSync(block);

      if ( hold.status !== "pending" ) return;
      // A reload lands here with the hold still open — re-arm the buzzer from the flag's
      // deadline rather than restarting the window.
      armHoldTimer(message);
      // This target's decision is made; controls belong only to the still-undecided.
      if ( target.answer || !canAnswerFor(actor) ) return;

      // ⚠ ONE input surface. When this client gets popups, the popup decides and the card only
      // watches — it offers a way to call the popup BACK (a dismissed popup must never strand
      // the decision) but never a second set of answer controls. With popups off the card is
      // the only surface there is, so it carries the real buttons.
      // The popup decides, the card recalls it — the card-only mode (the old holdView
      // opt-out) left with the settings collapse (2026-08-16): one input surface, always.
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        display: "flex", gap: "0.3rem", marginTop: "0.4rem", justifyContent: "flex-end"
      });
      controls.append(momentButton("Answer", () => {
        shownMoments.delete(popupKey(message.id, "hold"));
        // `manual` — a deliberate click, so it bypasses the GM's player-owned quiet above.
        void showHoldPopup(message, message.getFlag(MODULE_ID, "hold"), { manual: true });
      }, { flex: "0 0 auto", margin: "0", padding: "0 0.4rem", fontSize: "inherit", lineHeight: "1.4" }));
      block.append(controls);
    });
  }
  html.querySelector(".message-content")?.appendChild(row);

  // Resume a hold that is READY but has nobody driving it: every answer landed, then the
  // continuing client reloaded before writing the verdict (the settle window makes that gap
  // up to holdSettle seconds wide). The buzzer only passes UNANSWERED targets, so without
  // this a fully-answered hold sat pending forever. Views are stateless and re-derive from
  // the flag, so the view is exactly where readiness gets re-checked; the in-flight claim
  // makes the drive idempotent across re-renders.
  if ( (hold.status === "pending") && hold.targets.every(t => t.answer)
    && isContinuingClient(hold) ) void continueHold(message);

  // The popup: attention for the person whose decision it is. Ephemeral by design — closing
  // it is not an answer, because the row above is the durable state.
  const shownKey = popupKey(message.id, "hold");
  if ( (hold.status === "pending") && !shownMoments.has(shownKey) ) {
    shownMoments.add(shownKey);
    void showHoldPopup(message, hold);
  }
});

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
async function castReaction(attackMessage, target) {
  const actor = await fromUuid(target.uuid);
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

/**
 * The reaction rendered as its own card: portrait, name, who is reacting, the ability's real
 * text, and — only if the reveal is on — the math. This is the moment the whole feature exists
 * to protect, so it should read like the ability rather than like a confirm box.
 */
async function holdPopupContent(target, roll, actor, hold) {
  // ⚠ The reaction's real item. Matched by bare name this showed a worn shield's artwork above
  // a worn shield's description in the popup that is supposed to be the moment of the spell.
  const item = reactionItem(actor, target.reaction, target);
  const img = item?.img ?? "icons/svg/shield.svg";
  const subtitle = [target.name, item?.system?.activation?.type === "reaction" ? "Reaction" : null]
    .filter(Boolean).join(" · ");

  // Enrich so the ability reads as it does on the sheet (inline rolls, references, links).
  const editor = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  let description = "";
  try {
    description = await editor.enrichHTML(item?.system?.description?.value ?? "",
      { rollData: actor?.getRollData?.() ?? {}, secrets: false });
  } catch(err) {
    description = item?.system?.description?.value ?? "";
  }

  // No d20 on a spell hold, so no math to show and nothing conditional to weigh: the question
  // is simply whether to spend the reaction, and the outcome of taking it is total.
  const spell = hold?.trigger === "spell";
  const reveal = spell ? null : revealDetail(target, roll, actor);
  const situation = spell
    ? `<div style="font-size:var(--font-size-14,14px);"><strong>${hold.spell}</strong> is about `
      + `to strike <strong>${target.name}</strong>.</div>`
      + `<div style="opacity:0.85;margin-top:0.15rem;">${target.reaction} stops it completely — `
      + `<em>no damage at all</em>.</div>`
    : reveal
    ? `<div style="font-size:var(--font-size-14,14px);"><strong>${reveal.total}</strong> vs AC `
      + `<strong>${reveal.liveAC}</strong> — a hit.</div>`
      + (reveal.bonus == null ? "" : `<div style="opacity:0.85;margin-top:0.15rem;">`
        + `${target.reaction} would make it AC <strong>${reveal.wouldAC}</strong> — `
        + `<em>${reveal.wouldMiss ? "enough to miss" : "still not enough"}</em>.</div>`)
    : `<div style="font-size:var(--font-size-14,14px);">Something hits `
      + `<strong>${target.name}</strong>.</div>`;

  return `
  <div style="display:flex;gap:0.6rem;align-items:center;padding-bottom:0.5rem;
              border-bottom:1px solid var(--color-border-light-2,#999a);">
    <img src="${img}" alt="${String(target.reaction ?? "").replace(/"/g, "&quot;")}"
         data-tooltip="${String(target.reaction ?? "").replace(/"/g, "&quot;")}"
         style="width:48px;height:48px;flex:0 0 auto;border-radius:4px;
         border:1px solid var(--color-border-dark,#0006);object-fit:cover;">
    <div style="flex:1;min-width:0;">
      <div style="font-family:var(--font-h1,inherit);font-size:var(--font-size-18,18px);
                  font-weight:bold;line-height:1.2;">${target.reaction}</div>
      <div style="opacity:0.7;font-size:var(--font-size-12,12px);">${subtitle}</div>
    </div>
  </div>
  ${holdBarHTML(hold)}
  <div style="padding:0.6rem 0.1rem;">${situation}</div>
  ${description ? `<div style="max-height:11rem;overflow-y:auto;padding:0.5rem 0.6rem;
       border-radius:4px;background:rgba(0,0,0,0.05);font-size:var(--font-size-13,13px);
       line-height:1.5;">${description}</div>` : ""}`;
}

/**
 * Show the hold popup and keep it honest about its own lifetime.
 *
 * ⚠ A popup is a VIEW, and a view must not outlive its state. This used to be a blocking
 * DialogV2.wait() with no handle, so answering anywhere else — the card row, a cast straight
 * from the sheet, a GM Skip — left it on screen still asking a question that had been answered
 * (reported live 2026-08-15). Now the instance is held so the hold's own update can close it,
 * and closing for ANY reason releases the decision back to the card row.
 */
async function showHoldPopup(attackMessage, hold, { manual = false } = {}) {
  const roll = attackMessage.rolls[0];
  for ( const target of hold.targets ) {
    // An answered target's decision is made — reopening its popup (the card's Answer button
    // recalls popups for the whole message) re-asked a question and produced a second
    // "passes" card through the response channel.
    if ( target.answer ) continue;
    const actor = await fromUuid(target.uuid);
    if ( !canAnswerFor(actor) ) continue;

    // THE GM'S UNSOLICITED POPUPS ARE NON-PLAYER-OWNED TARGETS ONLY. This is the save
    // machine's rule (v1.12.0 finding ④, user: "as a GM i dont care to see other player
    // saves"), and `gmQuiet` has lived in saves.js and mastery.js since — the hold was the
    // one machine that never got it. Restated against the hold 2026-08-19: "as a DM, I
    // shouldn't see Gren's shield popup. DM doesn't want to be spammed with player popups.
    // DM can just see the card timer tick."
    //
    // ⚠ The case this actually fixes is the OFFLINE owner. A player-owned target whose owner
    // is PRESENT never reaches this line — canAnswerFor is already false on the GM client,
    // which is why the requirement looked satisfied for as long as the players were logged
    // in and looked broken the moment the DM tested alone. canAnswerFor deliberately falls
    // back to the GM when the owner is away; that fallback is what was spamming the DM.
    // Such a target now rides the hold timer instead, which is the right answer twice over:
    // expiry is a PASS, and an absent player was never going to spend a reaction anyway.
    // NPCs and unowned characters keep their popups — the monster side is the GM's to answer.
    //
    // `manual` is the deliberate-recall escape hatch: the card's Answer button passes it, so
    // the DM can always summon the question on purpose. A click is never spam.
    if ( !manual && game.user.isGM && actor?.hasPlayerOwner ) continue;

    // ⚠ THE SAME TWO BUTTONS FOR EVERYONE. The question is binary — take the reaction or don't
    // — and it is the same question whoever is answering it. A GM-only third button ("Skip")
    // stood here until v1.1.15 and made the GM's popup a different shape from the player's for
    // no behavioural difference at all: it ran the same code as Pass, and the whole chain only
    // ever asks `answer === "cast"`. See the card controls for why it went.
    await openMomentPopup(attackMessage, target.uuid, actor, {
      title: target.reaction, icon: "fa-solid fa-shield-halved", width: 460,
      content: await holdPopupContent(target, roll, actor, hold),
      buttons: [
        { action: "cast", label: `Cast ${target.reaction}`, default: true,
          callback: () => castReaction(attackMessage, target) },
        { action: "pass", label: "Pass",
          callback: () => answerHold(attackMessage, target.uuid, "pass") }
      ]
    });
  }
}

// This file's own delete sweep — the buzzer must not outlive the message it was counting for.
// ⚠ The popup/latch/ack half of the old combined sweep stayed in ui.js: it is the SPINE's, it
// clears every machine's state off one `${messageId}|` prefix, and splitting that would be the
// five-per-machine drift it was built to collapse. This is only the clock.
Hooks.on("deleteChatMessage", message => {
  disarmHoldTimer(message.id);   // no message, no hold, nothing for the buzzer to pass
});
