/**
 * Battle Flow — Table polish: the no-target gate, the cast-slice birth stamps, hidden card buttons, dialog centering.
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 *
 * ⚠ The card SUPPRESSION machinery (the 1.1 master + the 1.9D per-source buckets + the
 * replacement-bfCard plumbing) was REMOVED at v1.10.0 — user call, 2026-08-17: "we rip out
 * the card suppression machinery, and we just have machinery to hide non-refund-resource
 * buttons." Every use posts its first card; hideCardButtons below is the one card-shaping
 * switch left. design.md §5 Phase 1.1 carries the full policy.
 */
import { MODULE_ID, S, setting } from "./core.js";
import { blockEntries, interruptEntries } from "./hold.js";

/* ---------------------------------------------------------------------------------------------
 * Table polish — the no-target gate, the birth stamps, hidden buttons, dialog centering
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
  let activity = null;
  try { activity = fromUuidSync(doc.getFlag("dnd5e", "activity")?.uuid ?? ""); }
  catch { activity = null; }
  const affects = activity?.target?.affects?.type ?? null;
  // BLANK affects stays out — hand-authored shapes carry no aim data and the cast slice
  // must not guess (unchanged from v1.5.1).
  if ( !affects ) return false;
  const payloadWorthy = (activityType === "heal") || !!doc.system?.effects?.length;
  if ( affects !== "self" ) {
    return payloadWorthy && !!(doc.getFlag("dnd5e", "targets") ?? []).length;
  }
  // A SELF-tagged activity SELF-AIMS (v1.11.0, user call: "anything that is tagged SELF
  // should self aim") — the caster is the target, any UI snapshot is incidental (Second
  // Wind healed the targeted dummy, 2026-08-17), and no UI target is required at all.
  // Supersedes the v1.5.1 "self-buffs stay tray clicks" stance; design.md §2.6 amended.
  // ⚠ The one carve-out is v1.5.1's ORIGINAL catch, kept as a carve-out instead of a
  // blanket gate: a LISTED reaction with "Apply the Reaction's Own Effect" on is applied
  // by the hold machinery when cast through a hold (Shield's +5 — the +10-two-chips bug,
  // 2026-08-16), so the cast slice keeps its hands off listed reactions entirely.
  if ( setting(S.reactionHold) && setting(S.holdApplyEffect) ) {
    const itemName = (activity?.item?.name ?? "").toLowerCase();
    if ( interruptEntries().some(e => e.name.toLowerCase() === itemName) ) return false;
  }
  return payloadWorthy;
}

/** Everything the elect needs to apply a cast, captured off the card at preCreate. */
function castPayload(doc) {
  let activity = null;
  try { activity = fromUuidSync(doc.getFlag("dnd5e", "activity")?.uuid ?? ""); }
  catch { activity = null; }
  const self = (activity?.target?.affects?.type === "self") ? activity?.actor : null;
  return {
    activityUuid: doc.getFlag("dnd5e", "activity")?.uuid ?? null,
    concentration: doc.system?.concentration ?? null,
    scaling: doc.system?.scaling ?? 0,
    spellLevel: doc.system?.spellLevel ?? null,
    // A SELF-tagged activity aims at its own actor — the snapshot is incidental (v1.11.0).
    targets: self ? [{ uuid: self.uuid, name: self.name }]
      : (doc.getFlag("dnd5e", "targets") ?? []).map(t => ({ uuid: t.uuid, name: t.name }))
  };
}

Hooks.on("preCreateChatMessage", doc => {
  // Cast auto-apply (Phase 3, cast slice): a healing roll aimed at targets is claimed at
  // creation, on the initiating client. The STAMP, never the setting, is what the elect
  // keys on later — an unstamped message can never be applied, so a render of last week's
  // log is inert by construction, and a mid-session kill still resolves what was stamped.
  // A SELF-tagged heal aims at its own actor and needs no UI target at all (v1.11.0,
  // finding ① — Second Wind healed the targeted dummy because this stamp read the
  // incidental snapshot; the self-aim gate existed on the castApply path since v1.5.1
  // and the heal-roll path had missed it).
  if ( setting(S.castApply) && (doc.getFlag("dnd5e", "roll.type") === "healing") ) {
    let activity = null;
    try { activity = fromUuidSync(doc.getFlag("dnd5e", "activity")?.uuid ?? ""); }
    catch { activity = null; }
    if ( (activity?.target?.affects?.type === "self") && activity?.actor ) {
      doc.updateSource({ flags: { [MODULE_ID]: { healPending: {
        selfAim: true, uuid: activity.actor.uuid, name: activity.actor.name } } } });
    } else if ( (doc.getFlag("dnd5e", "targets") ?? []).length ) {
      doc.updateSource({ flags: { [MODULE_ID]: { healPending: true } } });
    }
  }

  // The no-attack damage applier's birth stamp (v1.6.0, user call: "it should auto
  // apply; the shield stuff is its own mechanic"): a damage-ACTIVITY roll aimed at
  // targets is claimed at creation — same discipline as healPending, so history stays
  // inert. A BLOCKLISTED spell's roll additionally carries the hold's pending claim,
  // which makes the auto-applier defer until the hold question settles: the caster
  // clears it if no hold stamps, the hold's resolution releases it otherwise. The claim
  // is stamped from birth precisely so the applier can never lose a race to the hold.
  // NOT gated on autoApply: the stamp is also what the veto's fallback keys on, whether
  // or not anything auto-applies.
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

  // Phase 3 (cast slice): a no-gate cast the applier will handle — the native card is the
  // bus, stamped with the payload the elect executes from. Cards are never suppressed
  // (v1.10.0); a bare heal needs no stamp here because its roll message carries healPending.
  if ( castApplyQualifies(doc) && doc.system?.effects?.length ) {
    doc.updateSource({ flags: { [MODULE_ID]: { castApply: castPayload(doc) } } });
  }
});

// Hide the cards' action buttons — the module RUNS those workflows (attacks auto-roll,
// saves pop up on their owners, damage applies by verdict), so the buttons are a second,
// manual path that forks the machine: a save button that rolls for whatever token is
// SELECTED (the live topple trap), a damage button that double-rolls. Two survive:
// Refund Resource (bookkeeping, not workflow) and Place Measured Template (v1.10.0 —
// nothing automates placement, and a placed template is how a save demand finds its
// targets; hiding the only post-cast placement affordance starved containment). Display-
// level and stateless (every DOM tree); the handlers underneath survive, so anything that
// still slips through folds normally.
const KEPT_CARD_BUTTONS = new Set(["refundResource", "placeTemplate"]);

/** Does a template this card's activity placed still stand on any scene? Same origin tie
 * as the save machine's adoption (flags.dnd5e.origin === the activity uuid). */
function cardTemplateStands(message) {
  const origin = message.getFlag("dnd5e", "activity")?.uuid;
  if ( !origin ) return false;
  for ( const scene of game.scenes ) {
    if ( scene.templates.some(t => t.getFlag("dnd5e", "origin") === origin) ) return true;
  }
  return false;
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  if ( !setting(S.hideCardButtons) ) return;
  // Place Measured Template survives the cut ONLY while no template stands (v1.11.0,
  // finding ② — with the circle already down, the button's one remaining power is
  // placing a SECOND copy). Deleting the template brings it back: the canceled-placement
  // path (cast → cancel → place from the card) must stay alive.
  const templateStands = cardTemplateStands(message);
  for ( const button of html.querySelectorAll(".card-buttons button[data-action]") ) {
    const keep = KEPT_CARD_BUTTONS.has(button.dataset.action)
      && !((button.dataset.action === "placeTemplate") && templateStands);
    if ( !keep ) button.style.display = "none";
  }
});

// The live toggle: a template landing or leaving re-renders its card so the button
// tracks the world without waiting for the next natural render. CRUD hooks are a
// fast-path only (they measured unreliable on headless clients — the containment
// ground truth); the render pass above is the floor that always corrects.
function refreshCardsForTemplate(templateDoc) {
  const origin = templateDoc.getFlag("dnd5e", "origin");
  if ( !origin || !setting(S.hideCardButtons) ) return;
  for ( const m of game.messages.contents ) {
    if ( m.getFlag("dnd5e", "activity")?.uuid !== origin ) continue;
    try { ui.chat?.updateMessage?.(m); } catch(err) { /* next render corrects */ }
  }
}
Hooks.on("createMeasuredTemplate", refreshCardsForTemplate);
Hooks.on("deleteMeasuredTemplate", refreshCardsForTemplate);

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

