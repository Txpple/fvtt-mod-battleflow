/**
 * Battle Flow — Table polish: the no-target gate, the cast-slice birth stamps, hidden card buttons, dialog centering.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 *
 * ⚠ The card SUPPRESSION machinery (the 1.1 master + the 1.9D per-source buckets + the
 * replacement-bfCard plumbing) was REMOVED at v1.10.0 — user call, 2026-08-17: "we rip out
 * the card suppression machinery, and we just have machinery to hide non-refund-resource
 * buttons." Every use posts its first card; hideCardButtons below is the one card-shaping
 * switch left. ARCHITECTURE.md §8 carries the full policy.
 */
import { MODULE_ID, S, setting } from "./core.js";
import { blockEntries, effectChoiceEntries, interruptEntries } from "./settings.js";
import { EFFECT_CHOICES, tableIndex } from "./decide/registry.js";
import { effectChoiceFor } from "./decide/choices.js";

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

/* ---------------------------------------------------------------------------------------------
 * A DRUNK POTION DEFAULTS TO THE DRINKER (FLOW item 4, re-shaped 2026-08-19 after the v1.16.0
 * walk). User's shape: "if no target, then auto target self; if target exists, then use that."
 *
 * ⚠ THIS IS A DEFAULT, NOT A FORCE — and that is the whole design. v1.11.0's `affects: self`
 * self-aim DISCARDS the snapshot, which is right for Second Wind (there is no other sensible
 * target) and wrong for a potion (handing one to a downed ally is a real table move). So the
 * empty case is filled and a real target always wins. This retires the "self-aim UNLESS the
 * target is friendly" carve-out FLOW item 4 had to invent — no friendliness is inferred here.
 *
 * MEASURED, 2026-08-19 (tools/probe-potion-aim.mjs), both facts load-bearing:
 * - Healing potions carry `affects.type: "creature"`, activity type `heal` — NOT `self` and
 *   NOT blank. So the module was never wrong to leave them alone (the 02:41:58 "healed the
 *   chest" sighting is faithful behaviour), the "blank affects must not guess" rule is not in
 *   play, and filling an empty aim is a default INSIDE what the data already allows.
 * - `messageFlags` snapshots targets BEFORE this hook fires (dnd5e 5.3.3 Activity#use), so
 *   setting a canvas target here does NOT reach the card — a three-case control proved it
 *   (target set before use: stamped; set in this hook: empty). The snapshot must be written
 *   directly. `messageConfig` is passed in mutable for exactly this.
 *
 * BOTH sides are written on purpose: the SNAPSHOT is what every downstream machine reads
 * (hold, saves, mastery, shared, cast), and the LIVE TARGET is what the dialog's target block
 * paints — so the table SEES the default before confirming instead of learning where it went
 * from the receipt afterwards (user call, 2026-08-19).
 *
 * The gate is structural and carries NO NAME LIST, keeping faith with the cast slice: `heal`
 * + `creature` + no template separates a drinkable potion from Oil, which is also subtype
 * `potion` but is `save`/`creature` plus `damage`/`space`-with-template because you THROW it.
 * No setting, for the same reason self-aim has none — and the application it feeds is already
 * gated by castApply.
 * ------------------------------------------------------------------------------------------- */

/** A consumable whose aim is "one creature, no template" — a potion you drink. */
function potionDefaultsToDrinker(activity) {
  if ( activity?.item?.type !== "consumable" ) return false;
  if ( activity.type !== "heal" ) return false;
  if ( activity.target?.affects?.type !== "creature" ) return false;
  if ( activity.target?.template?.type ) return false;
  return true;
}

/** The system's own target descriptor shape (getTargetDescriptors) — name off the TOKEN,
 *  identity off its actor, and AC nulled under total cover exactly as the system nulls it. */
function targetDescriptor(token, actor) {
  const subject = token?.actor ?? actor;
  if ( !subject?.uuid ) return null;
  const ac = subject.statuses?.has("coverTotal") ? null : subject.system?.attributes?.ac?.value;
  return { name: token?.name ?? subject.name, img: subject.img, uuid: subject.uuid, ac: ac ?? null };
}

Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, dialogConfig, messageConfig) => {
  if ( !potionDefaultsToDrinker(activity) ) return;

  // RULE 2 — a real target always wins. BOTH sides must be empty before filling: the snapshot
  // decides the outcome, the live set decides what the dialog shows, and acting on a
  // disagreement between them would target the canvas without changing the roll.
  const path = "data.flags.dnd5e.targets";
  const snapshot = foundry.utils.getProperty(messageConfig ?? {}, path);
  if ( game.user.targets.size || (Array.isArray(snapshot) && snapshot.length) ) return;

  const actor = activity.actor;
  if ( !actor ) return;
  // A token is needed to TARGET, but not to aim: an off-scene drinker still gets the snapshot
  // so the heal lands, matching how `affects: self` needs no token at all.
  const token = actor.getActiveTokens?.()?.[0] ?? null;
  const descriptor = targetDescriptor(token, actor);
  if ( !descriptor ) return;

  foundry.utils.setProperty(messageConfig, path, [descriptor]);
  token?.setTarget(true, { releaseOthers: false });
});

/**
 * The activity a card was produced by, or null.
 *
 * ⚠ The try/catch is not defensive noise. `fromUuidSync` THROWS on a uuid whose pack is not
 * already cached, so every call site had to guard it — and three byte-identical copies of the
 * guard stood in this file until the duplicate census collected them (2026-08-23). EDGE by §2
 * rule 1 (it resolves a document), so it belongs here rather than in `decide/`.
 */
function activityOf(doc) {
  try { return fromUuidSync(doc.getFlag("dnd5e", "activity")?.uuid ?? "") ?? null; }
  catch { return null; }
}

/**
 * Phase 3's structural gate — no name list, a shape (DESIGN.md R4 done right): a used
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
  const activity = activityOf(doc);
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
  // Supersedes the v1.5.1 "self-buffs stay tray clicks" stance; DESIGN.md R4 amended.
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

/**
 * A listed cast's CHOICE between alternative effects (EFFECT_CHOICES — Fire Shield's warm or
 * chill shield), stamped pending on the card; the caster answers on the card (cast.js) and the
 * elect applies only the pick. Null where the item is unlisted or the activity carries fewer
 * than two of the row's names.
 */
const EFFECT_CHOICE_INDEX = tableIndex(EFFECT_CHOICES);
function castChoice(activity) {
  const name = String(activity?.item?.name ?? "").toLowerCase();
  if ( !name || !effectChoiceEntries().some(e => String(e.kind).toLowerCase() === name) ) return null;
  const key = EFFECT_CHOICE_INDEX.keyNamed(name);
  const row = key ? EFFECT_CHOICES[key] : null;
  if ( !row ) return null;
  const options = effectChoiceFor(row, (activity?.applicableEffects ?? []).map(e => e?.name));
  return options ? { key, options, ask: row.ask, rule: row.rule, chosen: null } : null;
}

/** Everything the elect needs to apply a cast, captured off the card at preCreate. */
function castPayload(doc) {
  const activity = activityOf(doc);
  const self = (activity?.target?.affects?.type === "self") ? activity?.actor : null;
  const choice = castChoice(activity);
  return {
    activityUuid: doc.getFlag("dnd5e", "activity")?.uuid ?? null,
    concentration: doc.system?.concentration ?? null,
    scaling: doc.system?.scaling ?? 0,
    spellLevel: doc.system?.spellLevel ?? null,
    // A SELF-tagged activity aims at its own actor — the snapshot is incidental (v1.11.0).
    targets: self ? [{ uuid: self.uuid, name: self.name }]
      : (doc.getFlag("dnd5e", "targets") ?? []).map(t => ({ uuid: t.uuid, name: t.name })),
    // The caster's pick between alternative effects, pending until answered (2026-09-05).
    ...(choice ? { choice } : {})
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
    const activity = activityOf(doc);
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
// SELECTED (the live topple trap), a damage button that double-rolls. Exactly ONE
// survives: Refund Resource — bookkeeping, not workflow (the v1.9.5 spec, restored at
// v1.12.0 by the user's third ask; the v1.10.0/v1.11.0 Place Measured Template exemption
// and its conditional template-standing machinery are deleted outright). Post-cast
// placement lives in the cast-time usage prompt and the canvas template controls, and the
// save machine's WAITING demand (saves.js, v1.12.0) adopts an area whenever it lands —
// the containment-starvation rationale is gone. Display-level and stateless (every DOM
// tree); the handlers underneath survive, so anything that still slips through folds
// normally.
const KEPT_CARD_BUTTONS = new Set(["refundResource"]);

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  if ( !setting(S.hideCardButtons) ) return;
  for ( const button of html.querySelectorAll(".card-buttons button[data-action]") ) {
    if ( !KEPT_CARD_BUTTONS.has(button.dataset.action) ) button.style.display = "none";
  }
});

/* ---------------------------------------------------------------------------------------------
 * The target block (FLOW item 2) — the dialog says who it is aimed at, before the dice
 *
 * The mistake this catches, priced live 2026-08-18 at 02:11:15: "I'm trying to target Oscar"
 * — Goldthorn hit MORGASH for 8, reverted by hand. The player had a stale target and no
 * surface told them so until the damage landed.
 *
 * DISPLAY-ONLY, DELIBERATELY. An earlier design put a checkbox on each row to untarget from
 * the dialog; it was scoped out (user call, 2026-08-19) because every downstream machine here
 * reads the message SNAPSHOT — `flags.dnd5e.targets` in hold, saves, mastery, shared and cast —
 * while only the requireTarget veto and hit-riders read `game.user.targets` live. Until it is
 * MEASURED that dnd5e stamps that flag after the dialog resolves, a checkbox would change the
 * canvas and not the roll: a control that looks authoritative and lies. Because this stays
 * display-only and stateless it is the same class as hideCardButtons and carries NO setting.
 * Closing the dialog is still the cancel, so the veto survives — it just isn't a forced ack.
 *
 * The icon is NEUTRAL INFORMATION ON EVERY ROW, never a judgement on any row (user call,
 * 2026-08-19: "don't use ! because it's like a flag, and some spells are meant to cast on
 * allies"). Bless, Bane and every heal legitimately aim at allies; an alarm on all of those
 * trains the table to ignore it. The reader does the catching — a skull on the person you
 * meant to heal is the whole mechanism.
 * ------------------------------------------------------------------------------------------- */

const TARGET_BLOCK_CLASS = "battleflow-target-block";

/** Dialogs currently carrying a block, so a canvas re-target can refresh them. */
const openTargetBlocks = new Set();

/** A Foundry disposition colour as CSS, so the row can never disagree with the token border. */
function dispositionHex(value, fallback) {
  return (typeof value === "number") ? `#${value.toString(16).padStart(6, "0")}` : fallback;
}

/**
 * ABSOLUTE disposition, never relative to whoever is rolling (user call, 2026-08-19). The row
 * reads the target's OWN friendly/neutral/hostile exactly as the canvas border draws it, so it
 * means the same thing on every dialog on every client and can never contradict the screen.
 * ⚠ Known and accepted: when the GM rolls for a monster, a `friendly` token is that monster's
 * enemy but still draws the ally icon. The GM knows the fiction; a cue that silently flips
 * meaning depending on who holds the dice would be worse than one that is always literal.
 * Colour is never the only carrier — glyph, colour and word all say it (colour-blind readers,
 * and screenshots in scrollback).
 */
function dispositionStyle(token) {
  const D = CONST.TOKEN_DISPOSITIONS;
  const colors = CONFIG.Canvas?.dispositionColors ?? {};
  switch ( token?.document?.disposition ) {
    case D.FRIENDLY:
      return { icon: "fa-solid fa-shield-halved", label: "ally",
        color: dispositionHex(colors.FRIENDLY, "#43dfdf") };
    case D.NEUTRAL:
      return { icon: "fa-solid fa-circle-half-stroke", label: "neutral",
        color: dispositionHex(colors.NEUTRAL, "#f1d836") };
    case D.HOSTILE:
      return { icon: "fa-solid fa-skull", label: "enemy",
        color: dispositionHex(colors.HOSTILE, "#e72124") };
    case D.SECRET:
      return { icon: "fa-solid fa-eye-slash", label: "secret",
        color: dispositionHex(colors.SECRET, "#a612d4") };
    // A token with no readable disposition says so rather than guessing — calling an unknown
    // "enemy" would be exactly the false alarm the [!] flag was struck for.
    default:
      return { icon: "fa-solid fa-circle-question", label: "unknown", color: "inherit" };
  }
}

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

  // The ZERO case is not an edge case — it is the point. requireTarget only guards `attack`
  // activities (the veto at the top of this file), so a spell or an item reaches this dialog
  // with nothing targeted and nothing else says so.
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

    // THE TOKEN'S OWN ART, framed exactly like the receipt card's damage rows (user call,
    // 2026-08-19: "put the actor tokens in… like they are included on the cards for hp
    // changes"). The token texture beats the actor portrait here because the question this
    // block answers is "is that the thing I clicked on the canvas?" — so it should show what
    // is ON the canvas. Falls back to the actor portrait, then to the disposition glyph, so a
    // token with no art still renders a row rather than a hole.
    const art = token.document?.texture?.src || token.actor?.img || null;
    let portrait;
    if ( art ) {
      portrait = document.createElement("img");
      portrait.src = art;
      portrait.alt = label;
      portrait.className = "gold-icon"; // the receipts' native framing, same as the HP rows
      Object.assign(portrait.style, {
        flex: "0 0 auto", width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px",
        // Disposition rides the FRAME rather than a separate glyph — the border is the same
        // colour the canvas draws around that token, so the two cannot disagree.
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

    // ⚠ The WORD stays, and is not decoration. With the glyph gone, colour would otherwise be
    // the only thing separating ally from enemy — unreadable for a colour-blind player and in
    // any screenshot. Frame colour, alt text and this word are three independent carriers.
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
 * ⚠ Deliberately does NOT gate on `element.isConnected`. The render hook fires while the
 * dialog's element is still DETACHED — it is inserted into the document afterwards — so an
 * isConnected guard here rejects every genuine open and the block only ever appeared on a
 * forced re-render (measured 2026-08-19, probe-target-block.mjs). Appending to a detached
 * element is fine: the block travels with it when the app inserts it.
 */
function paintTargetBlock(element) {
  if ( !element ) return;
  for ( const stale of element.querySelectorAll(`.${TARGET_BLOCK_CLASS}`) ) stale.remove();
  element.append(buildTargetBlock());
}

// ⚠ THE OPPOSITE RE-RENDER DISCIPLINE FROM THE CENTERING DIRECTLY BELOW — deliberately, and
// do not "harmonize" them. Centering is FIRST RENDER ONLY because re-centering would fight the
// user dragging the window. This repaints on EVERY render: re-renders fire on every option
// change (advantage, attack mode, roll mode), and a stale target list is worse than no list.
// Rebuilding from live state each pass costs nothing and cannot drift.
//
// It is also registered BEFORE the centering hook on purpose: hooks run in registration order,
// so the block exists by the time centering measures offsetHeight. Move it after and every
// dialog centres as though it were shorter than it is.
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  paintTargetBlock(element);
  openTargetBlocks.add(app);
});

// The SPELL/ITEM half (user: "it showed for attacks, spells, items, etc"). The usage dialog —
// where a spell's slot level is chosen — is a different application class from the roll
// dialog: `ActivityUsageDialog` (probed 2026-08-19; Enchant/Summon/Transform/Order subclass
// it, and ApplicationV2 fires render hooks for every class in the inheritance chain, so the
// base name covers all of them). Same paint, same discipline, same block.
// VERIFIED rendering a real ActivityUsageDialog with the block present (2026-08-19).
Hooks.on("renderActivityUsageDialog", (app, element) => {
  paintTargetBlock(element);
  openTargetBlocks.add(app);
});

// The canvas can re-target while the dialog stands, and that fires no dialog re-render at all.
// A list that quietly ignores the canvas is the same class of lie as the rejected checkbox.
// ⚠ The set holds the APP, not the element: an element is detached at hook time and is
// REPLACED on re-render, so a set of elements both drops live dialogs and leaks dead ones.
// The app answers "am I still up?" honestly through its own lifecycle.
Hooks.on("targetToken", () => {
  for ( const app of openTargetBlocks ) {
    if ( app.rendered && app.element ) paintTargetBlock(app.element);
    else openTargetBlocks.delete(app); // closed dialogs drop out on the next re-target
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

