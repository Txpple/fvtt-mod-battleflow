/**
 * Battle Flow — Table polish: the no-target gate, the drinker default, the cast birth stamps,
 * hidden card buttons, the dialog target block and dialog centering. EDGE layer (ARCHITECTURE.md §7).
 * Every use posts its first card; hiding buttons is the one card-shaping switch (ARCHITECTURE.md §8).
 */
import { MODULE_ID, S, setting } from "./core.js";
import { blockEntries, effectChoiceEntries, interruptEntries } from "./settings.js";
import { EFFECT_CHOICES, tableIndex } from "./decide/registry.js";
import { effectChoiceFor } from "./decide/choices.js";
import { CARD, TARGETS_KEY, activityTypeOf, activityUuidOf, castLevelOn, isCard, itemNameOf, targetsOf } from "./decide/card.js";
import { targetDescriptorOf, dispositionStyle } from "./shared.js";
import { cardActivity, profileEffectSync } from "./lookup.js";


// Require a target to attack: veto the use on the initiating client before anything rolls or consumes.
Hooks.on("dnd5e.preUseActivity", activity => {
  if ( !setting(S.requireTarget) ) return;
  if ( activity?.type !== "attack" ) return;
  if ( game.user.targets.size ) return;
  ui.notifications.warn(`No target selected — ${activity.item?.name ?? "the attack"} stays sheathed. Target something, then attack.`);
  return false;
});

/* A DRUNK POTION DEFAULTS TO THE DRINKER: with no target, the drinker; a real target always wins
 * (handing a potion to a downed ally is a real table move). Structural, no name list: `heal` +
 * `creature` + no template (Oil is thrown: save/damage with a template).
 * ⚠ `messageFlags` snapshots targets BEFORE this hook, so a canvas target set here never reaches
 * the card: the snapshot is written directly (downstream reads it), and the live target is set
 * so the dialog shows the default before confirming. */

/** A consumable whose aim is "one creature, no template" — a potion you drink. */
function potionDefaultsToDrinker(activity) {
  if ( activity?.item?.type !== "consumable" ) return false;
  if ( activity.type !== "heal" ) return false;
  if ( activity.target?.affects?.type !== "creature" ) return false;
  if ( activity.target?.template?.type ) return false;
  return true;
}

Hooks.on("dnd5e.preUseActivity", (activity, _usageConfig, _dialogConfig, messageConfig) => {
  if ( !potionDefaultsToDrinker(activity) ) return;

  // Both the snapshot and the live set must be empty before filling.
  const path = `data.${TARGETS_KEY}`;
  const snapshot = foundry.utils.getProperty(messageConfig ?? {}, path);
  if ( game.user.targets.size || (Array.isArray(snapshot) && snapshot.length) ) return;

  const actor = activity.actor;
  if ( !actor ) return;
  // No token needed to aim: an off-scene drinker still gets the snapshot.
  const token = actor.getActiveTokens?.()?.[0] ?? null;
  const descriptor = targetDescriptorOf(token, actor);
  if ( !descriptor ) return;

  foundry.utils.setProperty(messageConfig, path, [descriptor]);
  token?.setTarget(true, { releaseOthers: false });
});

/** The activity a card was produced by, or null (lookup.js `cardActivity`). */
const activityOf = doc => cardActivity(doc);

/**
 * The cast gate, structural (DESIGN.md R4): a used `utility` activity carrying effects, or a
 * `heal`. Attacks are gated on the hit and saves on their cards; bare `damage` is OUT — an
 * auto-apply here would beat a pending negate hold's verdict.
 */
function castApplyQualifies(doc) {
  if ( !setting(S.castApply) ) return false;
  const activityType = activityTypeOf(doc);
  if ( (activityType !== "utility") && (activityType !== "heal") ) return false;
  const activity = activityOf(doc);
  const affects = activity?.target?.affects?.type ?? null;
  // BLANK affects stays out: no aim data, and the cast must not guess.
  if ( !affects ) return false;
  const payloadWorthy = (activityType === "heal") || !!doc.system?.effects?.length;
  if ( affects !== "self" ) {
    return payloadWorthy && !!targetsOf(doc).length;
  }
  // A SELF-tagged activity self-aims: the caster is the target, any UI snapshot is incidental.
  // ⚠ Except a LISTED reaction cast in answer to a PENDING hold: the hold applies its effect
  // (hold/answer.js), so the cast keeps its hands off. Freestanding, it self-aims
  // (RULINGS *A listed reaction cast freestanding*). The hold's message exists before the
  // answering card, so preCreate sees it; the two paths never both land.
  if ( setting(S.reactionHold) && setting(S.holdApplyEffect) ) {
    const itemName = (activity?.item?.name ?? "").toLowerCase();
    if ( interruptEntries().some(e => e.name.toLowerCase() === itemName)
      && holdPendingFor(activity?.actor?.uuid) ) return false;
  }
  return payloadWorthy;
}

/**
 * Is a hold WAITING on this actor's reaction (the flag shape hold/answer.js reads)? The WHOLE log
 * is scanned, never a tail window.
 */
function holdPendingFor(actorUuid) {
  if ( !actorUuid ) return false;
  return game.messages.contents.some(message => {
    const hold = message.getFlag(MODULE_ID, "hold");
    return !!hold && (hold.status === "pending")
      && (hold.targets ?? []).some(t => (t.uuid === actorUuid) && !t.answer);
  });
}

/**
 * A listed cast's CHOICE between alternative effects (EFFECT_CHOICES — Fire Shield's warm or chill),
 * stamped pending on the card for the caster to answer. Null when unlisted or fewer than two match.
 */
const EFFECT_CHOICE_INDEX = tableIndex(EFFECT_CHOICES);
function castChoice(activity) {
  const name = String(activity?.item?.name ?? "").toLowerCase();
  if ( !name || !effectChoiceEntries().some(e => String(e.kind).toLowerCase() === name) ) return null;
  const key = EFFECT_CHOICE_INDEX.keyNamed(name);
  const row = key ? EFFECT_CHOICES[key] : null;
  if ( !row ) return null;
  // ⚠ SYNC at preCreate: profiles resolve effects asynchronously, so names come off the item's
  // embedded effects by the profile's id (lookup.js).
  const options = effectChoiceFor(row, (activity?.applicableEffects ?? []).map(p => profileEffectSync(p, activity?.item)?.name));
  return options ? { key, options, ask: row.ask, rule: row.rule, chosen: null } : null;
}

/** Everything the elect needs to apply a cast, captured off the card at preCreate. */
function castPayload(doc) {
  const activity = activityOf(doc);
  const self = (activity?.target?.affects?.type === "self") ? activity?.actor : null;
  const choice = castChoice(activity);
  return {
    activityUuid: activityUuidOf(doc),
    concentration: doc.system?.concentration ?? null,
    scaling: doc.system?.scaling ?? 0,
    spellLevel: castLevelOn(doc),
    // A SELF-tagged activity aims at its own actor.
    targets: self ? [{ uuid: self.uuid, name: self.name }]
      : targetsOf(doc).map(t => ({ uuid: t.uuid, name: t.name })),
    ...(choice ? { choice } : {})
  };
}

Hooks.on("preCreateChatMessage", doc => {
  // Cast auto-apply: a healing roll aimed at targets is claimed at creation, on the initiating
  // client. The STAMP, never the setting, is what the elect keys on, so an old log is inert and a
  // mid-session kill still resolves. A SELF-tagged heal aims at its own actor, no UI target.
  if ( setting(S.castApply) && isCard(doc, CARD.healing) ) {
    const activity = activityOf(doc);
    if ( (activity?.target?.affects?.type === "self") && activity?.actor ) {
      doc.updateSource({ flags: { [MODULE_ID]: { healPending: {
        selfAim: true, uuid: activity.actor.uuid, name: activity.actor.name } } } });
    } else if ( targetsOf(doc).length ) {
      doc.updateSource({ flags: { [MODULE_ID]: { healPending: true } } });
    }
  }

  // The no-attack damage applier's birth stamp: a damage-activity roll aimed at targets. A
  // BLOCKLISTED spell's roll also carries the hold's pending claim, from birth, so the applier
  // defers and can never win a race against the hold. Not gated on autoApply: the veto's
  // fallback keys on the stamp too.
  if ( isCard(doc, CARD.damage) && (activityTypeOf(doc) === "damage") && targetsOf(doc).length ) {
    const claim = { spellDamage: true };
    if ( setting(S.reactionHold) ) {
      const name = itemNameOf(doc);   // the card's item reference carries the name
      if ( name && blockEntries().some(e => e.spell.toLowerCase() === name.toLowerCase()) )
        claim.spellHoldPending = true;
    }
    doc.updateSource({ flags: { [MODULE_ID]: claim } });
  }

  // The usage card is a message SUBTYPE (`type: "usage"`, decide/card.js).
  if ( !isCard(doc, CARD.usage) ) return;

  // A no-gate cast the applier will handle: the usage card is stamped with the elect's payload
  // (a bare heal needs none — its roll message carries healPending).
  if ( castApplyQualifies(doc) && doc.system?.effects?.length ) {
    doc.updateSource({ flags: { [MODULE_ID]: { castApply: castPayload(doc) } } });
  }
});

// Hide the cards' action buttons: the module RUNS those workflows, so the buttons are a second,
// manual path that forks the machine (a save button rolls for whatever token is selected).
// Only Refund Resource survives — bookkeeping, not workflow. The buttons are DATA
// (`system.buttons[]`), filtered at the card's birth, so no re-render can draw one back; the
// handlers underneath survive (NOTES §2).
const KEPT_CARD_BUTTONS = new Set(["refundResource"]);

Hooks.on("dnd5e.preCreateUsageMessage", (_activity, messageConfig) => {
  if ( !setting(S.hideCardButtons) ) return;
  const buttons = messageConfig?.data?.system?.buttons;
  if ( !Array.isArray(buttons) ) return;
  messageConfig.data.system.buttons = buttons.filter(b => KEPT_CARD_BUTTONS.has(b?.action));
});

/* ---------------------------------------------------------------------------------------------
 * The target block: the roll and usage dialogs say who they are aimed at, before the dice (a
 * stale target otherwise shows only when the damage lands).
 * DISPLAY-ONLY: every downstream machine reads the message SNAPSHOT, so an untarget checkbox
 * would change the canvas and not the roll. The disposition is neutral information on every row,
 * never an alarm — Bless and heals legitimately aim at allies.
 * ------------------------------------------------------------------------------------------- */

const TARGET_BLOCK_CLASS = "battleflow-target-block";

/** Dialogs currently carrying a block, so a canvas re-target can refresh them. */
const openTargetBlocks = new Set();

/** The block itself, built fresh from live targets every time it is painted. */
function buildTargetBlock() {
  const block = document.createElement("div");
  block.className = TARGET_BLOCK_CLASS;
  Object.assign(block.style, {
    margin: "0.5rem 0 0", padding: "0.35rem 0.5rem",
    border: "1px solid var(--color-border-light-2, #999a)", borderRadius: "4px",
    fontSize: "var(--font-size-12, 12px)", lineHeight: "1.5"
  });

  const targets = Array.from(game.user.targets);

  // The ZERO case is the point: requireTarget guards only attacks, so a spell arrives untargeted.
  const heading = document.createElement("div");
  heading.textContent = targets.length ? `Targeted — ${targets.length}` : "No targets";
  Object.assign(heading.style, {
    fontWeight: "bold",
    ...(targets.length ? { opacity: "0.85" } : { color: "var(--dnd5e-color-maroon, #740b0b)" })
  });
  block.append(heading);

  for ( const token of targets ) {
    const { icon, label, color } = dispositionStyle(token);
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex", alignItems: "center", gap: "0.5rem", margin: "2px 0"
    });

    // The token's own art (what is ON the canvas), then the actor portrait, then the glyph.
    const art = token.document?.texture?.src || token.actor?.img || null;
    let portrait;
    if ( art ) {
      portrait = document.createElement("img");
      portrait.src = art;
      portrait.alt = label;
      portrait.className = "gold-icon"; // the receipts' native framing
      Object.assign(portrait.style, {
        flex: "0 0 auto", width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px",
        // Disposition rides the frame, the colour the canvas draws around that token.
        border: `2px solid ${color}`
      });
    } else {
      portrait = document.createElement("i");
      portrait.className = icon;
      Object.assign(portrait.style, { flex: "0 0 auto", width: "32px", textAlign: "center", color });
    }
    portrait.title = label;

    const name = document.createElement("span");
    name.textContent = token.document?.name ?? token.name ?? "Unknown";
    Object.assign(name.style, {
      flex: "1", minWidth: "0", fontWeight: "bold",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
    });

    // ⚠ The WORD stays: frame colour, alt text and word are three carriers (colour-blind readers).
    const word = document.createElement("span");
    word.textContent = label;
    Object.assign(word.style, { flex: "0 0 auto", opacity: "0.7", fontSize: "0.9em", color });

    row.append(portrait, name, word);
    block.append(row);
  }
  return block;
}

/**
 * Idempotent repaint: the old block is removed, never appended beside.
 * ⚠ Do NOT gate on `element.isConnected`: the render hook fires while the element is still
 * DETACHED, so that guard would reject every genuine open.
 */
function paintTargetBlock(element) {
  if ( !element ) return;
  for ( const stale of element.querySelectorAll(`.${TARGET_BLOCK_CLASS}`) ) stale.remove();
  element.append(buildTargetBlock());
}

// ⚠ Repaints on EVERY render (option changes re-render; a stale list is worse than none), unlike
// centering, which is first-render only. Registered BEFORE the centering hook on purpose: hooks run
// in registration order, so the block exists when centering measures offsetHeight.
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  paintTargetBlock(element);
  openTargetBlocks.add(app);
});

// The usage dialog (spells, items): `ActivityUsageDialog`; its subclasses fire the base's render hook.
Hooks.on("renderActivityUsageDialog", (app, element) => {
  paintTargetBlock(element);
  openTargetBlocks.add(app);
});

// A canvas re-target fires no dialog re-render. ⚠ The set holds the APP, not the element: the
// element is replaced on re-render.
Hooks.on("targetToken", () => {
  for ( const app of openTargetBlocks ) {
    if ( app.rendered && app.element ) paintTargetBlock(app.element);
    else openTargetBlocks.delete(app); // closed dialogs drop out on the next re-target
  }
});

// Center the system's roll dialogs (dnd5e docks them lower-right). First render only, so it never
// fights a player dragging the window.
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  if ( !setting(S.centerRollDialogs) || app._bfCentered ) return;
  app._bfCentered = true;
  app.setPosition({
    left: Math.max(0, (window.innerWidth - element.offsetWidth) / 2),
    top: Math.max(0, (window.innerHeight - element.offsetHeight) / 2)
  });
});

