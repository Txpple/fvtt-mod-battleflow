/**
 * Battle Flow — the reaction hold, part 4: THE SPELL TRIGGER (ARCHITECTURE.md §5). A listed spell
 * at the moment of USE (Magic Missile against Shield) has no attack roll, so the hold enters here;
 * a `negate` answer IS the verdict (no re-test, no AC arithmetic). Resolution: `continueSpellHold`.
 */
import { MODULE_ID, TITLE, S, setting, statContext } from "../core.js";
import { blockEntries } from "../settings.js";
import { bfCard } from "../decide/present.js";
import { reactionSpent, statSourceOf } from "../shared.js";
import { CARD, isCard, itemUuidOf, targetsOf } from "../decide/card.js";
import { usableReaction, reactionNameFor, reactionImg } from "./lookup.js";
import { armHoldTimer, disarmHoldTimer } from "./clock.js";


Hooks.on("dnd5e.postUseActivity", (activity, _usageConfig, results) => {
  if ( !setting(S.reactionHold) ) return;
  // The usage card is the held document: it carries the target snapshot and is never suppressed.
  const message = (results?.message instanceof ChatMessage) ? results.message : null;
  if ( !message ) return; // create: false — no card, nothing to hold

  void (async () => {
    // ⚠ Match what was CAST, not what owns the activity: a statblock casts through a `cast` activity
    // on "Spellcasting", and this hook gets the CACHED SPELL's activity. reactionNameFor covers both.
    const spellName = (await reactionNameFor(activity))?.toLowerCase();
    if ( !spellName ) return;
    const entries = blockEntries().filter(e => e.spell.toLowerCase() === spellName);
    if ( !entries.length ) return;
    await stampSpellHold(message, entries);
    await releaseUnheldSpellDamage(activity, message);
  })();
});

/** When NO hold stamped, clear the damage roll's pending claim so the auto-applier applies; the
 * roll can land a beat later, so poll briefly. */
async function releaseUnheldSpellDamage(activity, holdMessage) {
  try {
    if ( holdMessage.getFlag(MODULE_ID, "hold") ) return; // held — resolution owns the release
    const itemUuid = activity?.item?.uuid ?? null;
    if ( !itemUuid ) return;
    const deadline = Date.now() + 4000;
    let damage = null;
    while ( !damage && (Date.now() < deadline) ) {
      damage = game.messages.contents.filter(m =>
        isCard(m, CARD.damage)
        && (m.author?.id === game.user.id)
        && (itemUuidOf(m) === itemUuid)
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

/** Stamp a `negate` hold in the attack hold's flag shape (so its surfaces are reused); `trigger: "spell"`
 * is how the roll-dependent paths branch. */
async function stampSpellHold(message, entries) {
  if ( message.getFlag(MODULE_ID, "hold") ) return;      // already held; never re-stamp
  const targets = targetsOf(message);
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

  // ⚠ Deliberately NO holdSkipFutile test: negating always changes the outcome.
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await message.setFlag(MODULE_ID, "hold", {
    status: "pending",
    trigger: "spell",
    spell: entries[0].spell,
    ...statContext(statSourceOf(message)),
    continuedBy: game.user.id,
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
    targets: held
  });
  armHoldTimer(message);
}

/** Resolve a `negate` hold: the verdict is what the preApplyDamage veto reads, so writing it IS the block. */
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
