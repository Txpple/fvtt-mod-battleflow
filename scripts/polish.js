/**
 * Battle Flow — Table polish: the no-target gate, the drinker default, the cast birth stamps, hidden
 * card buttons, the dialog target block and centering. EDGE layer (ARCHITECTURE.md §7, §8).
 */
import { MODULE_ID } from "./core.js";
import { blockEntries, effectChoiceEntries, interruptEntries } from "./decide/registry.js";
import { EFFECT_CHOICES, tableIndex } from "./decide/registry.js";
import { effectChoiceFor } from "./decide/choices.js";
import { CARD, TARGETS_KEY, activityTypeOf, activityUuidOf, castLevelOn, isCard, itemNameOf, targetsOf } from "./decide/card.js";
import { targetDescriptorOf, dispositionStyle } from "./shared.js";
import { cardActivity, profileEffectSync } from "./lookup.js";


// Require a target to attack: veto the use on the initiating client before anything rolls or consumes.
Hooks.on("dnd5e.preUseActivity", activity => {
  if ( activity?.type !== "attack" ) return;
  if ( game.user.targets.size ) return;
  ui.notifications.warn(`No target selected — ${activity.item?.name ?? "the attack"} stays sheathed. Target something, then attack.`);
  return false;
});

/* A DRUNK POTION with no target aims at the drinker; a real target always wins.
 * ⚠ `messageFlags` snapshots targets BEFORE this hook: the snapshot is written directly, and the
 * live target set only so the dialog shows it. */

/** A heal consumable aimed at one creature, no template — a potion you drink. */
function potionDefaultsToDrinker(activity) {
  if ( activity?.item?.type !== "consumable" ) return false;
  if ( activity.type !== "heal" ) return false;
  if ( activity.target?.affects?.type !== "creature" ) return false;
  if ( activity.target?.template?.type ) return false;
  return true;
}

Hooks.on("dnd5e.preUseActivity", (activity, _usageConfig, _dialogConfig, messageConfig) => {
  if ( !potionDefaultsToDrinker(activity) ) return;

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

const activityOf = doc => cardActivity(doc);

/**
 * The cast gate (DESIGN.md R4): a `utility` activity carrying effects, or a `heal`. Bare `damage`
 * is OUT: an auto-apply here would beat a pending negate hold's verdict.
 */
function castApplyQualifies(doc) {
  const activityType = activityTypeOf(doc);
  if ( (activityType !== "utility") && (activityType !== "heal") ) return false;
  const activity = activityOf(doc);
  const affects = activity?.target?.affects?.type ?? null;
  if ( !affects ) return false;   // no aim data: never guess
  const payloadWorthy = (activityType === "heal") || !!doc.system?.effects?.length;
  if ( affects !== "self" ) {
    return payloadWorthy && !!targetsOf(doc).length;
  }
  // A SELF-tagged activity self-aims. ⚠ Except a LISTED reaction answering a PENDING hold: the hold
  // applies its effect (RULINGS *A listed reaction cast freestanding*); the two paths never both land.
  const itemName = (activity?.item?.name ?? "").toLowerCase();
  if ( interruptEntries().some(e => e.name.toLowerCase() === itemName)
    && holdPendingFor(activity?.actor?.uuid) ) return false;
  return payloadWorthy;
}

/** Is a hold WAITING on this actor's reaction? The WHOLE log is scanned, never a tail window. */
function holdPendingFor(actorUuid) {
  if ( !actorUuid ) return false;
  return game.messages.contents.some(message => {
    const hold = message.getFlag(MODULE_ID, "hold");
    return !!hold && (hold.status === "pending")
      && (hold.targets ?? []).some(t => (t.uuid === actorUuid) && !t.answer);
  });
}

/* A listed cast's CHOICE between alternative effects (EFFECT_CHOICES), stamped pending on the card;
 * null when unlisted or fewer than two match. */
const EFFECT_CHOICE_INDEX = tableIndex(EFFECT_CHOICES);
function castChoice(activity) {
  const name = String(activity?.item?.name ?? "").toLowerCase();
  if ( !name || !effectChoiceEntries().some(e => String(e.kind).toLowerCase() === name) ) return null;
  const key = EFFECT_CHOICE_INDEX.keyNamed(name);
  const row = key ? EFFECT_CHOICES[key] : null;
  if ( !row ) return null;
  // ⚠ SYNC at preCreate: profiles resolve effects async, so names come off the item's effects by id.
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
    targets: self ? [{ uuid: self.uuid, name: self.name }]
      : targetsOf(doc).map(t => ({ uuid: t.uuid, name: t.name })),
    ...(choice ? { choice } : {})
  };
}

Hooks.on("preCreateChatMessage", doc => {
  // A healing roll aimed at targets is claimed at birth. The elect keys on the STAMP, never the
  // setting, so an old log is inert and a mid-session kill still resolves.
  if ( isCard(doc, CARD.healing) ) {
    const activity = activityOf(doc);
    if ( (activity?.target?.affects?.type === "self") && activity?.actor ) {
      doc.updateSource({ flags: { [MODULE_ID]: { healPending: {
        selfAim: true, uuid: activity.actor.uuid, name: activity.actor.name } } } });
    } else if ( targetsOf(doc).length ) {
      doc.updateSource({ flags: { [MODULE_ID]: { healPending: true } } });
    }
  }

  // The no-attack damage applier's birth stamp (not gated on autoApply: the veto's fallback reads
  // it). A BLOCKLISTED spell also carries the hold's claim from birth, so the applier can never win the race.
  if ( isCard(doc, CARD.damage) && (activityTypeOf(doc) === "damage") && targetsOf(doc).length ) {
    const claim = { spellDamage: true };
    const name = itemNameOf(doc);
    if ( name && blockEntries().some(e => e.spell.toLowerCase() === name.toLowerCase()) )
      claim.spellHoldPending = true;
    doc.updateSource({ flags: { [MODULE_ID]: claim } });
  }

  if ( !isCard(doc, CARD.usage) ) return;

  // A no-gate cast: the usage card carries the elect's payload (a bare heal's roll carries healPending).
  if ( castApplyQualifies(doc) && doc.system?.effects?.length ) {
    doc.updateSource({ flags: { [MODULE_ID]: { castApply: castPayload(doc) } } });
  }
});

// Hide the cards' action buttons: a second, manual path that forks the machine; Refund Resource stays.
// They are DATA (`system.buttons[]`), filtered at birth so no re-render draws one back (NOTES §2).
const KEPT_CARD_BUTTONS = new Set(["refundResource"]);

Hooks.on("dnd5e.preCreateUsageMessage", (_activity, messageConfig) => {
  const buttons = messageConfig?.data?.system?.buttons;
  if ( !Array.isArray(buttons) ) return;
  messageConfig.data.system.buttons = buttons.filter(b => KEPT_CARD_BUTTONS.has(b?.action));
});

/* The target block: roll and usage dialogs name who they aim at. DISPLAY-ONLY — downstream reads
 * the message SNAPSHOT, so an untarget control would change the canvas, not the roll. */

const TARGET_BLOCK_CLASS = "battleflow-target-block";

const openTargetBlocks = new Set();

function buildTargetBlock() {
  const block = document.createElement("div");
  block.className = TARGET_BLOCK_CLASS;
  Object.assign(block.style, {
    margin: "0.5rem 0 0", padding: "0.35rem 0.5rem",
    border: "1px solid var(--color-border-light-2, #999a)", borderRadius: "4px",
    fontSize: "var(--font-size-12, 12px)", lineHeight: "1.5"
  });

  const targets = Array.from(game.user.targets);

  // The ZERO case matters: requireTarget guards only attacks.
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

    const art = token.document?.texture?.src || token.actor?.img || null;
    let portrait;
    if ( art ) {
      portrait = document.createElement("img");
      portrait.src = art;
      portrait.alt = label;
      portrait.className = "gold-icon"; // the receipts' native framing
      Object.assign(portrait.style, {
        flex: "0 0 auto", width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px",
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

    // ⚠ The WORD stays: colour is never the only carrier.
    const word = document.createElement("span");
    word.textContent = label;
    Object.assign(word.style, { flex: "0 0 auto", opacity: "0.7", fontSize: "0.9em", color });

    row.append(portrait, name, word);
    block.append(row);
  }
  return block;
}

/** Idempotent repaint. ⚠ Never gate on `element.isConnected`: the render hook fires while DETACHED. */
function paintTargetBlock(element) {
  if ( !element ) return;
  for ( const stale of element.querySelectorAll(`.${TARGET_BLOCK_CLASS}`) ) stale.remove();
  element.append(buildTargetBlock());
}

// ⚠ Repaints on EVERY render. Registered BEFORE the centering hook: hooks run in registration
// order, so the block exists when centering measures offsetHeight.
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  paintTargetBlock(element);
  openTargetBlocks.add(app);
});

// ActivityUsageDialog's subclasses fire the base's render hook.
Hooks.on("renderActivityUsageDialog", (app, element) => {
  paintTargetBlock(element);
  openTargetBlocks.add(app);
});

// A re-target fires no dialog re-render. ⚠ Hold the APP: the element is replaced on re-render.
Hooks.on("targetToken", () => {
  for ( const app of openTargetBlocks ) {
    if ( app.rendered && app.element ) paintTargetBlock(app.element);
    else openTargetBlocks.delete(app); // closed dialogs drop out on the next re-target
  }
});

// Center roll dialogs, first render only, so it never fights a player dragging the window.
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  if ( app._bfCentered ) return;
  app._bfCentered = true;
  app.setPosition({
    left: Math.max(0, (window.innerWidth - element.offsetWidth) / 2),
    top: Math.max(0, (window.innerHeight - element.offsetHeight) / 2)
  });
});

