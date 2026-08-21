/**
 * Battle Flow — Phase 1.5: the reaction hold. Two entry points, one machine - eligibility, both triggers (attack and listed spell), answers, continuation, the veto, the no-attack damage applier's claim. Views live in ui.js.
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM } from "./core.js";
import { hitTargets } from "./shared.js";
// ⚠ Bare on purpose since (gg) retired the post-answer roll (the continuation releases the
// claim instead): the import itself still pins auto-damage.js's evaluation — and with it every
// hook registration order check-hook-order asserts — exactly where the §9 entry graph has it.
import "./auto-damage.js";
import { bfCard, reactionImg, armHoldTimer, disarmHoldTimer, reactionACBonus, closeAnsweredPopups } from "./ui.js";
// Safe as a STATIC edge (unlike auto-apply.js below): effect-riders.js registers no hooks,
// so evaluating it early cannot reorder anything — check-hook-order.mjs proves it.
import { applyEffectsTo, joinEffectReceipt } from "./effect-riders.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1.5 — the reaction hold (a pause, NOT a system)
 *
 * Shield-class reactions trigger on "you are hit", BEFORE damage — and RAW the player knows
 * they were hit, not what the damage would be. Rolling damage instantly would make every
 * Shield decision perfectly informed and every fix a rewind. So the chain pauses here, and
 * a human answers. The module never plays the reaction; it only waits (design.md §8: reaction
 * automation is a permanent non-goal).
 *
 * The hold lives in a flag on the attack message — the popup and the card row are both just
 * views of it, so a reload rebuilds them and three different answer channels (the player's
 * Pass message, the player's own cast, the GM's flag flip) need no coordination at all.
 * ------------------------------------------------------------------------------------------- */

/** Parse the curated "Name:kind, Name:kind" world setting. Unknown kinds default to ac. */
export function interruptEntries() {
  return String(setting(S.interruptList) ?? "").split(",").map(chunk => {
    const [name, kind] = chunk.split(":").map(s => s?.trim());
    if ( !name ) return null;
    return { name, kind: (kind?.toLowerCase() === "damage") ? "damage" : "ac" };
  }).filter(Boolean);
}

/**
 * Parse the curated "Spell:Reaction" world setting — which spells a reaction stops outright.
 * Keyed by the SPELL, so one reaction can appear here and in the interrupt list without the
 * two lists having to agree about anything.
 */
export function blockEntries() {
  return String(setting(S.blockList) ?? "").split(",").map(chunk => {
    const [spell, reaction] = chunk.split(":").map(s => s?.trim());
    if ( !spell || !reaction ) return null;
    return { spell, reaction };
  }).filter(Boolean);
}

/**
 * The state of an item's OWN limited uses: "none" (it has no pool), "available" (a pool with
 * charges left) or "spent" (a pool, all used).
 *
 * There are two ways to pay for a spell — a slot, or the statblock's "Additional Spells" x/x
 * pool — and a monster usually has only the second, because NPC slot maxima derive from a
 * caster level most statblocks never set. Activity-level pools count too: an activity carries
 * its own uses independently of the item's.
 */
function limitedUses(item) {
  const pools = [item.system?.uses, ...(item.system?.activities?.contents ?? []).map(a => a.uses)];
  let pooled = false;
  for ( const pool of pools ) {
    const max = Number(pool?.max);      // "" for an unlimited item — Number("") is 0, not NaN
    if ( !Number.isFinite(max) || (max <= 0) ) continue;
    pooled = true;
    if ( Number(pool?.value) > 0 ) return "available";
  }
  return pooled ? "spent" : "none";
}

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
 * Can this item actually be USED as a reaction?
 *
 * ⚠ A NAME MATCH IS NOT A REACTION. A hobgoblin wears a mundane shield — an `equipment` item
 * literally named "Shield" — which matched the interrupt list on name alone and made every
 * shield-carrying monster in the world hold the chain for a spell it cannot cast (reported
 * live 2026-08-15: "Hobgoblin — Shield?" on a creature with no spells at all). Worn equipment
 * has no activation, so asking for one drops it cleanly, and this generalises to every other
 * collision a user-editable interrupt list can produce.
 *
 * ⚠ Test the ITEM's activation as well as its activities: an activity carries its own
 * activation only when `activation.override` is true, and spells keep their casting time at
 * item level — so an activities-only test finds ZERO reaction spells, Shield included.
 */
function isReactionItem(item) {
  if ( item?.system?.activation?.type === "reaction" ) return true;
  return (item?.system?.activities?.contents ?? []).some(activity =>
    activity.activation?.override && (activity.activation?.type === "reaction"));
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
    if ( !isReactionItem(item) ) continue;

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
    // stop this gate exists to prevent (design.md §8: the GM/player click economy).
    //
    // Narrow on purpose, twice over:
    //  - `ac` kind ONLY. An AC bonus does not stack, so a second cast is pure waste. A
    //    `damage` reaction is a different question — Absorb Elements grants resistance to the
    //    TRIGGERING damage type, so a standing one is no reason to refuse the next trigger.
    //  - The attack trigger ONLY. This function is not on the spell/negate path, and that is
    //    deliberate: a standing Shield already grants "no damage from Magic Missile", so
    //    silently skipping the hold there would apply damage to someone immune to it. That
    //    trigger keeps asking until it can auto-negate (not built; recorded in design.md).
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

/** Reaction-spent bookkeeping — the core click-volume guard (design.md §5). */
const reactionSpent = actor => !!actor?.getFlag(MODULE_ID, "reactionSpent");

// Any reaction an actor takes suppresses further holds for them until their next turn. The
// active GM is the single writer; the flag replicates to everyone who needs to read it.
Hooks.on("dnd5e.postUseActivity", activity => {
  if ( !setting(S.reactionHold) || !isActiveGM() ) return;
  if ( activity?.activation?.type !== "reaction" ) return;
  const actor = activity.actor;
  // Only inside a running combat. Out of combat there are no turns to refresh the flag, so
  // setting it would strand the actor with reactions permanently "spent" and silently
  // suppress every later hold — including the next time you sit down to test one.
  if ( !actor || !inRunningCombat(actor) ) return;
  void actor.setFlag(MODULE_ID, "reactionSpent", true);
});

/** Is this actor a combatant in a combat that has actually started? */
export function inRunningCombat(actor) {
  return game.combats.some(c => c.started && c.combatants.some(cb => cb.actor?.id === actor.id));
}

// Cleared when the actor's own turn comes round again.
// ⚠ The CLEAR hooks are deliberately not gated on the feature toggle — only the SET is.
// Killing the hold mid-combat (the §2.9 kill switch) used to strand every already-set
// reactionSpent flag: the combat ended with the clears disabled, and re-enabling the
// feature later silently suppressed those actors' first holds. Clearing is always harmless.
Hooks.on("updateCombat", combat => {
  if ( !isActiveGM() ) return;
  const actor = combat.combatant?.actor;
  if ( actor?.getFlag(MODULE_ID, "reactionSpent") ) void actor.unsetFlag(MODULE_ID, "reactionSpent");
});

// …and when the fight ends, so nobody carries a spent reaction into the next one.
Hooks.on("deleteCombat", combat => {
  if ( !isActiveGM() ) return;
  for ( const combatant of combat.combatants ) {
    if ( combatant.actor?.getFlag(MODULE_ID, "reactionSpent") )
      void combatant.actor.unsetFlag(MODULE_ID, "reactionSpent");
  }
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
  for ( const target of hits ) {
    const actor = await fromUuid(target.uuid);
    const found = await findInterrupt(actor, { isCritical: roll.isCritical });
    if ( found && !holdWouldMatter(actor, found, roll, target.ac) ) continue;
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
  if ( !held.length ) return false;

  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);

  // ⚠ Answers and verdicts live ON each target entry, never in a map keyed by uuid. Foundry
  // EXPANDS dotted keys when it persists an update, and every uuid contains dots — so
  // `{ "Actor.abc": "cast" }` comes back as `{ Actor: { abc: "cast" } }` and every lookup
  // silently misses forever (bit live 2026-08-15; Phase 1's receipts dodged it by accident
  // for the same reason — they are an array too).
  await attackMessage.setFlag(MODULE_ID, "hold", {
    status: "pending",
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
 * The SECOND trigger: a listed spell, not an attack (design.md §5 Phase 1.5).
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
    continuedBy: game.user.id,
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
    targets: held
  });
  armHoldTimer(message);
}

/**
 * Should THIS client drive the continuation? The client that rolled the attack owns it (its
 * attack, its dice); if that user has gone offline the active GM takes over so a hold can
 * never strand the chain.
 */
export function isContinuingClient(hold) {
  const owner = game.users.get(hold?.continuedBy);
  return owner?.active ? owner.isSelf : isActiveGM();
}

/** Everyone who may answer for a held target: its owners, or the GM for unowned NPCs. */
export function canAnswerFor(actor) {
  if ( !actor ) return false;
  if ( actor.isOwner && !game.user.isGM ) return true;
  // GMs own everything, so they answer only for targets no player owns (the monster side).
  if ( game.user.isGM ) return !game.users.some(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
  return false;
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

  // Players cannot update someone else's message, so a player's answer travels as their OWN
  // message; the continuing client applies it to the hold (design.md §4.1 — clients
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
    const receipt = foundry.utils.deepClone(
      attackMessage.getFlag(MODULE_ID, "effectReceipt") ?? { targets: [] });
    for ( const entry of appliedEffects ) joinEffectReceipt(receipt, entry);
    await attackMessage.setFlag(MODULE_ID, "effectReceipt", receipt);
  }
  await attackMessage.setFlag(MODULE_ID, "hold", hold);
}

// A player's answer message landing: the continuing client folds it into the hold flag.
Hooks.on("createChatMessage", message => {
  const response = message.getFlag(MODULE_ID, "respondsTo");
  if ( !response ) return;
  const attackMessage = game.messages.get(response);
  const hold = attackMessage?.getFlag(MODULE_ID, "hold");
  if ( !hold || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  const merged = foundry.utils.deepClone(hold);
  const target = merged.targets?.find(t => t.uuid === message.getFlag(MODULE_ID, "uuid"));
  if ( !target || target.answer ) return;
  target.answer = message.getFlag(MODULE_ID, "answer");
  void attackMessage.setFlag(MODULE_ID, "hold", merged);
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
      extraFlags: { [MODULE_ID]: { reactionEffect: true } }
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
  closeAnsweredPopups(message);

  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  if ( !hold.targets.every(t => t.answer) ) return;
  void continueHold(message);
});

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
        // the safety net's receipt lands there — same shape, same rows, same revert.
        const receipt = foundry.utils.deepClone(
          attackMessage.getFlag(MODULE_ID, "effectReceipt") ?? { targets: [] });
        for ( const entry of entries ) joinEffectReceipt(receipt, entry);
        await attackMessage.setFlag(MODULE_ID, "effectReceipt", receipt);
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
    (m.getFlag(MODULE_ID, "attackHoldFor") === attackMessage.id)
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
 * ⚠ Accepted gap (design.md §5): a GM who presses Apply while the hold is still PENDING beats
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
    const damages = dnd5e.dice.aggregateDamageRolls(message.rolls, { respectProperties: true })
      .map(roll => ({
        value: Math.max(0, roll.total),
        type: roll.options.type,
        properties: new Set(roll.options.properties ?? [])
      }));
    if ( !damages.length ) return;
    // ⚠ Lazily bound, and deliberately so (split, v1.6.1): a static import would evaluate
    // auto-apply.js — and through it mastery.js and concentration.js — before this file's
    // body, registering concentration's preApplyDamage cause capture AHEAD of the veto
    // above. Foundry stops calling preApplyDamage at the first false, so the veto must stay
    // first in line or a vetoed application strands a captured cause. Keep this dynamic.
    const { applyDamagesWithReceipt } = await import("./auto-apply.js");
    await applyDamagesWithReceipt(message, targets, damages);
  } catch(err) {
    console.error(`${TITLE} | Spell damage auto-apply failed.`, err);
  } finally {
    spellDamageApplications.delete(message.id);
  }
}

// Three triggers, all flag-driven: arrival, the claim settling, and render (reload resume).
Hooks.on("createChatMessage", message => {
  if ( !setting(S.autoApply) || !isActiveGM() ) return;
  if ( message.getFlag(MODULE_ID, "spellDamage") ) void applySpellDamage(message);
});

Hooks.on("updateChatMessage", message => {
  if ( !setting(S.autoApply) || !isActiveGM() ) return;
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
  if ( !setting(S.autoApply) || !isActiveGM() ) return;
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

