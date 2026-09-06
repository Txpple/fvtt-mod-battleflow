/**
 * Battle Flow — the reaction hold, part 4: THE SPELL TRIGGER. The hold's second entry point —
 * a listed spell at the moment of USE (Magic Missile against Shield), the `negate` kind whose
 * answer IS the verdict — and its resolution, `continueSpellHold`, which the continuation
 * hands a spell hold to.
 */
import { MODULE_ID, TITLE, S, setting, statContext } from "../core.js";
import { blockEntries } from "../settings.js";
import { bfCard } from "../decide/present.js";
import { reactionSpent, statSourceOf } from "../shared.js";
import { usableReaction, reactionNameFor, reactionImg } from "./lookup.js";
import { armHoldTimer, disarmHoldTimer } from "./clock.js";

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

/**
 * Resolve a `negate` hold — the whole of it. The answer IS the verdict: there is no roll to
 * re-test, no live AC to read and no dice waiting on the outcome, because this module never
 * rolled the spell's damage in the first place (Magic Missile is not an attack, so Phase 1a
 * ignores it and the caster presses their own Damage button).
 *
 * The verdict is what the preApplyDamage veto below reads, so writing it IS the block.
 */
export async function continueSpellHold(message, hold) {
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
