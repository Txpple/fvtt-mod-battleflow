/**
 * Battle Flow — Table polish: the no-target gate, per-source card suppression (with the cast-slice stamps and the replacement bfCard), dialog centering.
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting } from "./core.js";
import { blockEntries } from "./hold.js";
import { bfCard } from "./ui.js";

/* ---------------------------------------------------------------------------------------------
 * Table polish — the no-target gate, attack-card suppression, dialog centering
 * ------------------------------------------------------------------------------------------- */

// Require a target to attack: cancel the use before anything rolls or consumes. Same
// initiating-client veto pattern as combatplus's initiative gate — a table-manners rail.
Hooks.on("dnd5e.preUseActivity", activity => {
  if ( !setting(S.requireTarget) ) return;
  if ( activity?.type !== "attack" ) return;
  if ( game.user.targets.size ) return;
  ui.notifications.warn(`No target selected — ${activity.item?.name ?? "the attack"} stays sheathed. Target something, then attack.`);
  return false;
});

// Suppress the usage card (the Attack/Damage button card) for attack activities. The veto
// runs on the initiating client (preCreate document hooks are local). Without the card,
// dnd5e's own rollAttack gets no originatingMessage — the resolver's chain walk already
// falls back to the attack message itself as the origin, so auto-damage and auto-apply are
// unaffected. Consumption still happens; only its display card is skipped.
//
// Scope guard: attack-activity cards ONLY. Save-spell cards are load-bearing (targets click
// their saves there) until Phase 2 rolls saves itself.
/** The 1.9D per-source bucket for a usage card, by the item type behind the activity —
 * read straight off the card's own flags (messageFlags stamps `item: {type, id, uuid}` on
 * every usage card, mixin.mjs:139). No async resolution, no registry walk. */
function suppressBucketFor(doc) {
  const itemType = doc.getFlag("dnd5e", "item")?.type;
  return (itemType === "weapon") ? S.suppressWeaponCards
    : (itemType === "spell") ? S.suppressSpellCards
    : (itemType === "feat") ? S.suppressFeatureCards
    : S.suppressOtherCards;
}

/**
 * Phase 3's structural gate — no name list, a shape (design.md §2.6 done right): a used
 * activity with NO outcome gate. `utility` carrying effects applies them at cast (Bless,
 * Hunter's Mark's Mark Creature AND Move Mark, Heroism); `heal` applies its self-rolled
 * healing (the roll message is stamped separately — see the preCreate hook). Attack
 * activities are 1.9A's (gated on the hit); save activities are Phase 2's (their cards are
 * load-bearing); bare `damage` activities are deliberately OUT — Magic Missile is the
 * negate hold's seam, and an auto-apply here would beat every pending hold's verdict
 * (HANDOFF standing item 2).
 */
function castApplyQualifies(doc) {
  if ( !setting(S.castApply) ) return false;
  const activityType = doc.getFlag("dnd5e", "activity")?.type;
  if ( (activityType !== "utility") && (activityType !== "heal") ) return false;
  if ( !(doc.getFlag("dnd5e", "targets") ?? []).length ) return false;
  // ⚠ The activity must actually AIM at creatures. A range-self spell's target snapshot is
  // incidental UI targeting, not the spell's aim — and Shield is a utility-with-effects
  // cast, so without this gate the cast slice stacked a second +5 on top of the reaction
  // machinery's own application (+10 AC, two chips — caught by smoke-hold the first time
  // it ran with castApply on, 2026-08-16). Self-buffs stay the caster's own tray click.
  let affects = null;
  try { affects = fromUuidSync(doc.getFlag("dnd5e", "activity")?.uuid ?? "")?.target?.affects?.type ?? null; }
  catch { affects = null; }
  if ( !affects || (affects === "self") ) return false;
  // A heal's card is suppressible bare (its roll is the record); utility needs effects.
  return (activityType === "heal") || !!doc.system?.effects?.length;
}

/** Everything the elect needs to apply a cast, captured off the card (or its doomed data). */
function castPayload(doc) {
  return {
    activityUuid: doc.getFlag("dnd5e", "activity")?.uuid ?? null,
    concentration: doc.system?.concentration ?? null,
    scaling: doc.system?.scaling ?? 0,
    spellLevel: doc.system?.spellLevel ?? null,
    targets: (doc.getFlag("dnd5e", "targets") ?? []).map(t => ({ uuid: t.uuid, name: t.name }))
  };
}

/**
 * The replacement card for a suppressed cast: created on the CASTING client from the doomed
 * card's own data (preCreate is local, and players can create their own messages), carrying
 * the payload the elect applies from. Chat-log-as-bus survives suppression this way — a
 * vetoed card leaves nothing to react to, so the replacement IS the bus, and the receipt
 * carrier, and the table's record of the cast, in one message.
 */
async function postCastReplacement(doc) {
  try {
    const payload = castPayload(doc);
    let item = null;
    try { item = fromUuidSync(doc.getFlag("dnd5e", "item")?.uuid ?? ""); } catch { item = null; }
    const caster = doc.speaker?.alias ?? item?.actor?.name ?? "Someone";
    const names = payload.targets.map(t => t.name).join(", ");
    await ChatMessage.create({
      speaker: doc.speaker,
      content: bfCard({
        img: item?.img, eyebrow: "Cast", tone: "good",
        title: `${caster} casts ${item?.name ?? "a spell"}`,
        subtitle: names ? `On ${names}` : ""
      }),
      flags: { [MODULE_ID]: { castApply: payload } }
    });
  } catch(err) {
    console.error(`${TITLE} | Could not post the cast card.`, err);
  }
}

Hooks.on("preCreateChatMessage", doc => {
  // Cast auto-apply (Phase 3, cast slice): a healing roll aimed at targets is claimed at
  // creation, on the initiating client. The STAMP, never the setting, is what the elect
  // keys on later — an unstamped message can never be applied, so a render of last week's
  // log is inert by construction, and a mid-session kill still resolves what was stamped.
  if ( setting(S.castApply) && (doc.getFlag("dnd5e", "roll.type") === "healing")
    && (doc.getFlag("dnd5e", "targets") ?? []).length ) {
    doc.updateSource({ flags: { [MODULE_ID]: { healPending: true } } });
  }

  // The no-attack damage applier's birth stamp (v1.6.0, user call: "it should auto
  // apply; the shield stuff is its own mechanic"): a damage-ACTIVITY roll aimed at
  // targets is claimed at creation — same discipline as healPending, so history stays
  // inert. A BLOCKLISTED spell's roll additionally carries the hold's pending claim,
  // which makes the auto-applier defer until the hold question settles: the caster
  // clears it if no hold stamps, the hold's resolution releases it otherwise. The claim
  // is stamped from birth precisely so the applier can never lose a race to the hold.
  // NOT gated on autoApply: the stamp is also what linkSpellDamage bridges through, and
  // the veto needs that bridge whether or not anything auto-applies.
  if ( (doc.getFlag("dnd5e", "roll.type") === "damage")
    && (doc.getFlag("dnd5e", "activity")?.type === "damage")
    && (doc.getFlag("dnd5e", "targets") ?? []).length ) {
    const claim = { spellDamage: true };
    if ( setting(S.reactionHold) ) {
      let name = null;
      try { name = fromUuidSync(doc.getFlag("dnd5e", "item")?.uuid ?? "")?.name ?? null; }
      catch { name = null; }
      if ( name && blockEntries().some(e => e.spell.toLowerCase() === name.toLowerCase()) )
        claim.spellHoldPending = true;
    }
    doc.updateSource({ flags: { [MODULE_ID]: claim } });
  }

  // ⚠ At 5.3.3 the usage card is a real message SUBTYPE (`type: "usage"`, registered in
  // data/chat-message/_module.mjs). `flags.dnd5e.messageType === "usage"` is the LEGACY
  // shape the system's own migrateData writes for pre-subtype documents (chat-message.mjs:91)
  // — matching only that silently no-ops on every card this system actually creates
  // (bit live 2026-08-15). Accept both so old worlds and new agree.
  const isUsage = (doc.type === "usage") || (doc.getFlag("dnd5e", "messageType") === "usage");
  if ( !isUsage ) return;
  const activityType = doc.getFlag("dnd5e", "activity")?.type;

  if ( activityType === "attack" ) {
    if ( !setting(S.suppressAttackCards) ) return;
    if ( !setting(suppressBucketFor(doc)) ) return;
    // ⚠ A card carrying effects the riders will NOT handle must survive. With Effect Riders
    // off the card is the only place its effects can be applied from — suppressing it silently
    // ate Ray of Frost's slow (reported live 2026-08-15). With riders ON the card can go, the
    // effects land anyway — EXCEPT a concentration cast: the rider applier resolves the
    // concentration effect for origin linkage off the usage card (`system.concentration`,
    // stamped into the message data before creation, mixin.mjs:248), and the suppressed-card
    // fallback cannot rebuild that linkage — so those cards stay.
    if ( doc.system?.effects?.length
      && (!setting(S.effectRiders) || doc.system?.concentration) ) return;
    return false;
  }

  // Phase 3 (cast slice): a no-gate cast the applier will handle. Suppressed under the same
  // 1.9D switches as attack cards — and REPLACED, because the replacement card is the bus.
  // Unlike 1.9A's carve-out, a concentration cast's card can go here: the payload carries
  // the linkage the bare suppression could not rebuild. With suppression off, the native
  // card itself is stamped and stays the bus.
  if ( castApplyQualifies(doc) ) {
    if ( setting(S.suppressAttackCards) && setting(suppressBucketFor(doc)) ) {
      if ( doc.system?.effects?.length ) void postCastReplacement(doc); // a bare heal needs no replacement
      return false;
    }
    if ( doc.system?.effects?.length )
      doc.updateSource({ flags: { [MODULE_ID]: { castApply: castPayload(doc) } } });
    return;
  }

  // A bare damage-activity card (Magic Missile's shape) is suppressible spam (user call
  // 2026-08-16). Since v1.6.0 that includes BLOCKLISTED spells: the hold no longer needs
  // this card — it rides a replacement bfCard (postSpellHoldCard) that carries the same
  // target/item/activity flags, and the damage roll is bridged to it, so the rows, the
  // answers, the fold and the veto's origin walk all work unchanged.
  if ( activityType === "damage" ) {
    if ( !setting(S.suppressAttackCards) || !setting(suppressBucketFor(doc)) ) return;
    // Effects riding a damage card have no automated path (1.9A is attack-only, the cast
    // slice excludes damage) — the card is their only apply surface. It survives.
    if ( doc.system?.effects?.length ) return;
    return false;
  }
});

// Center the system's roll-configuration dialogs (dnd5e docks them lower-right:
// left = innerWidth - 710, top = clientY - 80). First render only — re-renders fire on every
// option change in the dialog, and re-centering those would fight the user dragging it.
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  if ( !setting(S.centerRollDialogs) || app._bfCentered ) return;
  app._bfCentered = true;
  app.setPosition({
    left: Math.max(0, (window.innerWidth - element.offsetWidth) / 2),
    top: Math.max(0, (window.innerHeight - element.offsetHeight) / 2)
  });
});

