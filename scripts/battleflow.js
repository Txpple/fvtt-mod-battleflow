/**
 * Battle Flow — combat resolution that flows (design.md is the north star).
 *
 * Phase 1: the attack resolver. Two independent halves plus receipts, each behind its own
 * world setting (Game Settings → Configure Settings → Battle Flow), all default OFF:
 *
 *   - Auto-Roll Damage on Hit: when an attack roll resolves on the attacker's own client,
 *     re-run the system's hit test against the targets snapshotted on the attack message and,
 *     if at least one target was hit, press the card's Damage button programmatically —
 *     ammo/attack-mode recovery identical to the native handler, crit pre-configured, no
 *     dialog. A miss means the damage dice never exist. Modes: off / NPC attacks only /
 *     everyone, plus an optional "dramatic beat" delay between hit reveal and damage dice.
 *   - Auto-Apply Damage: on the active GM's client (single writer), a damage-roll message
 *     that chains back to an attack applies itself to the targets that attack hit, through
 *     the system's own resistance/immunity/threshold math (Actor5e#applyDamage) — exactly
 *     what the GM-only damage tray does, pressed automatically. The tray stays rendered and
 *     remains the manual path for corrections and edge calls — but it collapses on the
 *     applied card exactly as if Apply had been pressed (same setting guard), so an already-
 *     applied roll is never one accidental click away from landing twice.
 *   - Receipts + revert: every application stamps what it did (per-target prior HP snapshot
 *     and deltas) into a flag on the damage message, and the card grows a GM-only receipt
 *     row with a per-target ↩ revert that restores the snapshot. Idempotent and
 *     reload-proof: the flag is the state, the row is just a view of it.
 *   - The reaction hold (Phase 1.5): when an attack hits someone holding a curated interrupt
 *     reaction, the chain pauses instead of resolving — popup for whoever owns the decision,
 *     durable row on the attack card, GM override, and a re-test against the target's LIVE
 *     AC once answered (a Shield that turns the hit into a miss ends the chain and the
 *     damage dice never exist). The module waits for a human; it never plays the reaction.
 *   - Table polish (first dogfood feedback, 2026-08-15): a no-target gate that cancels an
 *     attack before anything rolls or consumes ("popup error, then exit out"), a world
 *     setting that suppresses the attack usage card (the Attack/Damage button card — spam
 *     under auto-resolution; the chain rides the attack-message-origin fallback), and a
 *     per-client setting that centers the system's roll dialogs instead of lower-right.
 *
 * Architecture (design.md §4): the chat log is the state and the bus. No sockets, no
 * in-memory workflow object, no patching. The attacker's client volunteers the damage roll
 * (its attack, its dice); the active-GM elect volunteers the application (ownership is a
 * permission fact; a single writer prevents double-apply); the chain is resolved through the
 * system's own message registry (flags.dnd5e.originatingMessage), never a parallel one.
 *
 * Ground truths (dnd5e release-5.3.3 = commit 965ad2d, on Foundry v14):
 *   - dnd5e.rollAttackV2 fires on the rolling client only, after the attack message exists
 *     and before ammo consumption; rolls[0].parent IS the attack message (basic-roll.mjs
 *     buildPost assigns it whenever a message document was created).
 *   - Hit/miss is computed at render time and never persisted (chat-message.mjs:463):
 *     isMiss = !crit && ((total < ac) || fumble). Downstream consumers must recompute.
 *   - flags.dnd5e.targets = [{uuid, name, img, ac}] where uuid is the target ACTOR's uuid
 *     (utils.mjs getTargetDescriptors) and ac is null under total cover.
 *   - flags.dnd5e.originatingMessage is natively stamped from the DOM click's enclosing card
 *     (basic-roll.mjs:173); a programmatic roll MUST pass it in message data explicitly or
 *     the roll never enters dnd5e.registry.messages and the chain breaks.
 *   - The native damage tray builds damages via aggregateDamageRolls(rolls,
 *     {respectProperties: true}) → {value, type, properties: Set} and applies with
 *     actor.applyDamage(damages, {multiplier: 1, isDelta: true, originatingMessage, origin})
 *     (damage-application.mjs:335). Mirrored verbatim so the system's math stays
 *     authoritative. Healing activities mark their rolls "healing", never "damage".
 *   - applyDamage writes system.attributes.hp.{value,temp,tempmax}. Receipts snapshot the
 *     SOURCE values (actor.system._source): Actor#update writes source data, and derived
 *     values can carry active-effect noise that a later revert must not bake in.
 *   - dnd5e.renderChatMessage (message, html) fires after all system card enrichment — the
 *     seam the receipt row renders on.
 */

const MODULE_ID = "fvtt-mod-battleflow";
const TITLE = "Battle Flow";

/** Setting keys. */
const S = {
  autoDamage: "autoDamage",
  dramaticBeat: "dramaticBeat",
  autoApply: "autoApply",
  requireTarget: "requireTarget",
  suppressAttackCards: "suppressAttackCards",
  centerRollDialogs: "centerRollDialogs",
  reactionHold: "reactionHold",
  interruptList: "interruptList",
  holdReveal: "holdReveal",
  holdSettle: "holdSettle",
  holdView: "holdView"
};

const setting = key => game.settings.get(MODULE_ID, key);

/** Exactly one client may perform world-visible applications: the active GM's. */
const isActiveGM = () => game.users.activeGM?.isSelf ?? false;

/* ---------------------------------------------------------------------------------------------
 * Settings registration
 * ------------------------------------------------------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, S.autoDamage, {
    name: "Auto-Roll Damage on Hit",
    hint: "When an attack hits at least one of its selected targets, the damage rolls itself on the attacker's own client — no dialog, crit pre-applied. A miss rolls nothing. Attacks must be made with targets selected.",
    scope: "world", config: true, type: String, default: "off",
    choices: { off: "Off", npc: "NPC Attacks Only", all: "Everyone" }
  });

  game.settings.register(MODULE_ID, S.dramaticBeat, {
    name: "Dramatic Beat Before Damage",
    hint: "Seconds between the hit reveal and the damage dice hitting the table. 0 rolls immediately.",
    scope: "world", config: true, type: Number, default: 0,
    range: { min: 0, max: 10, step: 0.5 }
  });

  game.settings.register(MODULE_ID, S.autoApply, {
    name: "Auto-Apply Damage",
    hint: "The active GM's client applies a rolled attack's damage to the targets that attack hit, through the system's own resistance and immunity math. Every application leaves a receipt on the damage card with a per-target revert. The native damage tray stays available for manual calls, and collapses on applied cards as if Apply had been pressed.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.requireTarget, {
    name: "Require a Target to Attack",
    hint: "Using an attack with no target selected shows a warning and cancels the attack before anything is rolled or consumed. The whole resolver keys off targets — this makes the table discipline structural.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.suppressAttackCards, {
    name: "Suppress Attack Usage Cards",
    hint: "Skip the chat card with Attack/Damage buttons that posting an attack normally creates — under auto-resolution the workflow record is the attack roll, the damage roll, and the receipt. Turning this off restores the native cards immediately.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.centerRollDialogs, {
    name: "Center Roll Dialogs",
    hint: "Open the system's roll-configuration dialogs (attack, damage, saves) centered on the screen instead of docked at the lower right. Per player: this only affects your own client.",
    scope: "client", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.reactionHold, {
    name: "Reaction Hold",
    hint: "When an attack hits someone holding an interrupt reaction (Shield and friends), pause before the damage instead of resolving instantly — the target's player chooses to cast or pass, and the GM can always override. A pause, never automation: the module waits for a human, it never plays the reaction.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.interruptList, {
    name: "Interrupt Reactions",
    hint: 'Which reactions pause the chain, as "Name:kind" separated by commas. kind is "ac" (raises AC — the hold re-tests the attack against the new AC, and crits skip the pause since a natural 20 hits regardless) or "damage" (reduces damage — the hold pauses and announces; the reduction itself stays a human call). Names must match the item on the actor. See REACTIONS.md for the full survey.',
    scope: "world", config: true, type: String,
    default: "Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, "
      + "Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, "
      + "Riposte:ac, Whirlwind of Sand:ac, Deflect Attacks:damage, Stone's Endurance:damage"
  });

  game.settings.register(MODULE_ID, S.holdReveal, {
    name: "Hold Shows the Math",
    hint: "Off (default, RAW): the held player is told only that they were hit — they react on faith, as the rules intend. On: the popup shows the attack total against their AC and whether the reaction would actually turn it into a miss.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.holdSettle, {
    name: "Hold Settle Seconds",
    hint: "After a reaction is cast, how long to wait for its AC change to actually land before re-testing the attack. Shield's +5 arrives as an active effect that must be applied (the native effects tray), so re-testing instantly would read a stale AC and wrongly call it a hit.",
    scope: "world", config: true, type: Number, default: 8,
    range: { min: 1, max: 30, step: 1 }
  });

  game.settings.register(MODULE_ID, S.holdView, {
    name: "Hold: Show Me the Popup",
    hint: "On: reaction holds you can answer pop up in the middle of the screen. Off: no popup — the hold's buttons live on the attack card in chat only. Per player; GMs running monster-side holds often prefer card-only.",
    scope: "client", config: true, type: Boolean, default: true
  });
});

// Settings-sheet polish (the combatplus idiom, from day one): a divider heading the module's
// block, and dependent fields greying out live while their governing setting is off.
Hooks.on("renderSettingsConfig", (app, element) => {
  const el = element instanceof HTMLElement ? element : element?.[0];
  if ( !el ) return;
  const input = key => el.querySelector(`[name="${MODULE_ID}.${key}"]`);
  const setEnabled = (field, enabled) => {
    if ( !field ) return;
    field.disabled = !enabled;
    const group = field.closest(".form-group");
    if ( group ) group.style.opacity = enabled ? "" : "0.4";
  };

  const addDivider = (field, text) => {
    const group = field?.closest(".form-group");
    if ( !group || group.previousElementSibling?.classList?.contains("bf-divider") ) return;
    const header = document.createElement("h4");
    header.className = "divider bf-divider";
    header.textContent = text;
    group.before(header);
  };
  const autoDamage = input(S.autoDamage);
  addDivider(autoDamage, "Attack Resolver");
  addDivider(input(S.reactionHold), "Reaction Hold");
  addDivider(input(S.suppressAttackCards), "Table Polish");

  const hold = input(S.reactionHold);
  const syncAll = () => {
    setEnabled(input(S.dramaticBeat), autoDamage?.value !== "off");
    for ( const key of [S.interruptList, S.holdReveal, S.holdSettle, S.holdView] )
      setEnabled(input(key), !!hold?.checked);
  };
  syncAll();
  autoDamage?.addEventListener("change", syncAll);
  hold?.addEventListener("change", syncAll);
});

/* ---------------------------------------------------------------------------------------------
 * Shared: the hit test and the chain walk
 * ------------------------------------------------------------------------------------------- */

/**
 * Targets from an attack message's snapshot that the attack roll actually hit, recomputing
 * the system's own render-time test: crit hits, fumble misses, otherwise total >= ac.
 * A null AC (total cover, or a target with no AC data) is deliberately NOT auto-resolvable:
 * the system's targets tray classes those rows as hits (total < null is false), but the
 * outcome isn't determined by data we trust, so those targets are left to humans
 * (design.md §2.1) and the native tray.
 */
function hitTargets(attackMessage) {
  const roll = attackMessage.rolls[0];
  if ( !(roll instanceof dnd5e.dice.D20Roll) ) return [];
  const targets = attackMessage.getFlag("dnd5e", "targets") ?? [];
  // A resolved reaction hold's verdict OVERRIDES the snapshot: after a Shield the stored
  // descriptor's AC is stale, and auto-apply would otherwise damage a target the module
  // already announced as missed (design.md §5 Phase 1.5, the stale-AC trap).
  const held = attackMessage.getFlag(MODULE_ID, "hold")?.targets ?? [];
  return targets.filter(t => {
    const verdict = held.find(h => h.uuid === t.uuid)?.verdict;
    if ( verdict ) return verdict === "hit";
    return (t.ac !== null) && (t.ac !== undefined)
      && (roll.isCritical || (!roll.isFumble && (roll.total >= t.ac)));
  });
}

/**
 * The attack roll a damage message descends from, walked through the system's registry:
 * damage → originating usage card → associated attack rolls (chronological) → the last one
 * rolled before this damage. When the origin itself IS an attack message (an attack rolled
 * without a usage card; our own programmatic stamp falls back to the attack's id), use it
 * directly. Null when the damage isn't part of an attack chain (save/AoE damage — Phase 2).
 */
function resolveAttackMessage(damageMessage) {
  const origin = damageMessage.getOriginatingMessage(); // falls back to the message itself
  if ( origin === damageMessage ) return null;
  if ( origin.getFlag("dnd5e", "roll.type") === "attack" ) return origin;
  return origin.getAssociatedRolls("attack")
    .filter(m => m.timestamp <= damageMessage.timestamp)
    .pop() ?? null;
}

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
Hooks.on("preCreateChatMessage", doc => {
  if ( !setting(S.suppressAttackCards) ) return;
  // ⚠ At 5.3.3 the usage card is a real message SUBTYPE (`type: "usage"`, registered in
  // data/chat-message/_module.mjs). `flags.dnd5e.messageType === "usage"` is the LEGACY
  // shape the system's own migrateData writes for pre-subtype documents (chat-message.mjs:91)
  // — matching only that silently no-ops on every card this system actually creates
  // (bit live 2026-08-15). Accept both so old worlds and new agree.
  const isUsage = (doc.type === "usage") || (doc.getFlag("dnd5e", "messageType") === "usage");
  if ( !isUsage ) return;
  if ( doc.getFlag("dnd5e", "activity")?.type !== "attack" ) return;
  return false;
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

/* ---------------------------------------------------------------------------------------------
 * Phase 1a — auto-roll damage on hit (the attacker's client; its attack, its dice)
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  const mode = setting(S.autoDamage);
  if ( (mode === "off") || !subject ) return;
  if ( (mode === "npc") && (subject.actor?.type === "character") ) return;

  const attackMessage = rolls[0]?.parent;
  if ( !(attackMessage instanceof ChatMessage) ) return; // rolled with create:false — no chain to ride

  // Mirror the native card: no Damage button (no damage parts, no ammo), nothing to roll.
  if ( !subject.damage?.parts?.length && !subject.item?.system.properties?.has("amm") ) return;

  const hits = hitTargets(attackMessage);
  if ( !hits.length ) return; // a miss means the damage dice never exist

  // The one legitimate interrupt: someone hit is holding a Shield-class reaction. Pause here
  // rather than rolling damage, and let a human answer (design.md §5 Phase 1.5).
  if ( await stampHoldIfInterrupted(attackMessage, rolls[0], hits) ) return;

  const beat = (Math.max(0, Number(setting(S.dramaticBeat)) || 0)) * 1000;
  setTimeout(() => rollDamageForAttack(subject, attackMessage), beat);
});

/**
 * Press the Damage button the way AttackActivity.#rollDamage does at 5.3.3: recover attack
 * mode and ammunition from the attack message's flags — including the stored copy of
 * ammunition destroyed by consumption — pre-set critical, skip the dialog. The
 * originatingMessage is stamped explicitly because a programmatic roll has no DOM click to
 * inherit it from; without it the damage message never registers and auto-apply can't chain.
 */
async function rollDamageForAttack(activity, attackMessage) {
  try {
    const attackMode = attackMessage.getFlag("dnd5e", "roll.attackMode");
    let ammunition;
    const actor = attackMessage.getAssociatedActor();
    if ( actor ) {
      const storedData = attackMessage.getFlag("dnd5e", "roll.ammunitionData");
      ammunition = storedData
        ? new Item.implementation(storedData, { parent: actor })
        : actor.items.get(attackMessage.getFlag("dnd5e", "roll.ammunition"));
    }
    const isCritical = attackMessage.rolls[0]?.isCritical ?? false;
    const originId = attackMessage.getFlag("dnd5e", "originatingMessage") ?? attackMessage.id;
    await activity.rollDamage(
      { ammunition, attackMode, isCritical },
      { configure: false },
      { data: { "flags.dnd5e.originatingMessage": originId } }
    );
  } catch(err) {
    console.error(`${TITLE} | Auto-roll damage failed.`, err);
  }
}

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
function interruptEntries() {
  return String(setting(S.interruptList) ?? "").split(",").map(chunk => {
    const [name, kind] = chunk.split(":").map(s => s?.trim());
    if ( !name ) return null;
    return { name, kind: (kind?.toLowerCase() === "damage") ? "damage" : "ac" };
  }).filter(Boolean);
}

/** Is a slot of at least `level` available (including pact magic)? */
function hasSpellSlot(actor, level) {
  if ( !level ) return true; // cantrip / at-will
  for ( const [key, slot] of Object.entries(actor.system.spells ?? {}) ) {
    if ( !slot?.value ) continue;
    const numbered = /^spell(\d+)$/.exec(key);
    const slotLevel = numbered ? Number(numbered[1]) : slot.level;
    if ( Number.isFinite(slotLevel) && (slotLevel >= level) ) return true;
  }
  return false;
}

/**
 * The first curated interrupt this actor can actually use right now, or null. Eligibility is
 * deliberately conservative: a hold the target cannot answer is a pure false stop.
 */
function findInterrupt(actor, { isCritical }) {
  if ( !actor || reactionSpent(actor) ) return null;
  for ( const entry of interruptEntries() ) {
    // A natural 20 hits regardless of AC, so an AC-type reaction cannot save it — no pause.
    if ( isCritical && (entry.kind === "ac") ) continue;
    const item = actor.items.find(i => i.name.toLowerCase() === entry.name.toLowerCase());
    if ( !item ) continue;
    if ( item.type === "spell" ) {
      if ( !item.system.prepared ) continue;            // 0 unprepared / 1 prepared / 2 always
      if ( !hasSpellSlot(actor, item.system.level) ) continue;
    }
    const uses = item.system.uses;
    if ( uses?.max && !uses.value ) continue;           // limited-use feature, none left
    return { entry, item };
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
  void activity.actor?.setFlag(MODULE_ID, "reactionSpent", true);
});

// Cleared when the actor's own turn comes round again.
Hooks.on("updateCombat", combat => {
  if ( !setting(S.reactionHold) || !isActiveGM() ) return;
  const actor = combat.combatant?.actor;
  if ( actor?.getFlag(MODULE_ID, "reactionSpent") ) void actor.unsetFlag(MODULE_ID, "reactionSpent");
});

/**
 * If any hit target holds a usable interrupt, stamp the hold and return true (the caller
 * must not roll damage). The stamping client records itself as the one that will continue —
 * it is the attacker's client, the only one that can roll this activity's damage.
 */
async function stampHoldIfInterrupted(attackMessage, roll, hits) {
  if ( !setting(S.reactionHold) ) return false;
  if ( attackMessage.getFlag(MODULE_ID, "hold") ) return true; // already held; never re-stamp

  const held = [];
  for ( const target of hits ) {
    const actor = await fromUuid(target.uuid);
    const found = findInterrupt(actor, { isCritical: roll.isCritical });
    if ( found ) held.push({
      uuid: target.uuid, name: target.name, ac: target.ac,
      reaction: found.item.name, kind: found.entry.kind,
      answer: null, verdict: null
    });
  }
  if ( !held.length ) return false;

  // ⚠ Answers and verdicts live ON each target entry, never in a map keyed by uuid. Foundry
  // EXPANDS dotted keys when it persists an update, and every uuid contains dots — so
  // `{ "Actor.abc": "cast" }` comes back as `{ Actor: { abc: "cast" } }` and every lookup
  // silently misses forever (bit live 2026-08-15; Phase 1's receipts dodged it by accident
  // for the same reason — they are an array too).
  await attackMessage.setFlag(MODULE_ID, "hold", {
    status: "pending",
    continuedBy: game.user.id,
    targets: held
  });
  return true;
}

/**
 * Should THIS client drive the continuation? The client that rolled the attack owns it (its
 * attack, its dice); if that user has gone offline the active GM takes over so a hold can
 * never strand the chain.
 */
function isContinuingClient(hold) {
  const owner = game.users.get(hold?.continuedBy);
  return owner?.active ? owner.isSelf : isActiveGM();
}

/** Everyone who may answer for a held target: its owners, or the GM for unowned NPCs. */
function canAnswerFor(actor) {
  if ( !actor ) return false;
  if ( actor.isOwner && !game.user.isGM ) return true;
  // GMs own everything, so they answer only for targets no player owns (the monster side).
  if ( game.user.isGM ) return !game.users.some(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
  return false;
}

/** Record an answer for one held target and continue once every held target has answered. */
async function answerHold(attackMessage, uuid, answer) {
  const hold = foundry.utils.deepClone(attackMessage.getFlag(MODULE_ID, "hold") ?? {});
  if ( hold.status !== "pending" ) return;
  const target = hold.targets?.find(t => t.uuid === uuid);
  if ( !target || target.answer ) return;                // idempotent: first answer wins
  target.answer = answer;

  // Players cannot update someone else's message, so a player's answer travels as their OWN
  // message; the continuing client applies it to the hold (design.md §4.1 — clients
  // volunteer, they never command). "Gren passes" is good table record either way.
  if ( !attackMessage.isOwner ) {
    await ChatMessage.create({
      content: `<em>${answer === "cast" ? "reacts" : "lets it land"}.</em>`,
      speaker: ChatMessage.getSpeaker({ actor: await fromUuid(uuid) }),
      flags: { [MODULE_ID]: { respondsTo: attackMessage.id, uuid, answer } }
    });
    return;
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
  const names = interruptEntries().map(e => e.name.toLowerCase());
  if ( !names.includes(activity.item?.name?.toLowerCase()) ) return;

  for ( const message of game.messages.contents.slice(-25) ) {
    const hold = message.getFlag(MODULE_ID, "hold");
    if ( !hold || (hold.status !== "pending") ) continue;
    const target = hold.targets.find(t => (t.uuid === actor.uuid) && !hold.answers?.[t.uuid]);
    if ( target ) void answerHold(message, target.uuid, "cast");
  }
});

// Drive the continuation whenever a held message changes and every held target has answered.
// Deliberately reads the message's CURRENT state rather than inspecting the update diff:
// setFlag issues a flattened `flags.<module>.hold` key, so a nested-path test against
// `changed` silently never matches (bit live 2026-08-15). The early-outs are cheap.
Hooks.on("updateChatMessage", message => {
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
async function continueHold(attackMessage) {
  const hold = foundry.utils.deepClone(attackMessage.getFlag(MODULE_ID, "hold"));
  if ( !hold || (hold.status !== "pending") ) return;

  if ( hold.targets.some(t => t.answer === "cast") ) await settleForACChange(hold);

  const roll = attackMessage.rolls[0];
  const announcements = [];
  for ( const target of hold.targets ) {
    const actor = await fromUuid(target.uuid);
    const liveAC = actor?.system?.attributes?.ac?.value ?? target.ac;
    const hit = roll.isCritical || (!roll.isFumble && (roll.total >= liveAC));
    target.verdict = hit ? "hit" : "miss";
    if ( target.answer !== "cast" ) continue;
    if ( target.kind === "ac" ) {
      announcements.push(hit
        ? `<strong>${target.name}:</strong> ${target.reaction} raises AC to ${liveAC} — the attack still hits (${roll.total}).`
        : `<strong>${target.name}:</strong> ${target.reaction} — ${roll.total} vs AC ${liveAC}. <em>The attack misses.</em>`);
    } else {
      announcements.push(`<strong>${target.name}:</strong> ${target.reaction} — reduce the damage by hand (the roll stands).`);
    }
  }

  hold.status = "resolved";
  await attackMessage.setFlag(MODULE_ID, "hold", hold);
  if ( announcements.length ) await ChatMessage.create({
    content: announcements.join("<br>"),
    speaker: { alias: TITLE }
  });

  // Damage rolls only if something is still hit — a Shield that turned the only hit into a
  // miss ends the chain here, and the dice never exist.
  if ( !hitTargets(attackMessage).length ) return;
  const activity = await fromUuid(attackMessage.getFlag("dnd5e", "activity")?.uuid);
  if ( activity ) await rollDamageForAttack(activity, attackMessage);
}

/** Wait (briefly) for a cast reaction's AC change to actually land. Resolves early. */
async function settleForACChange(hold) {
  const deadline = Date.now() + (Math.max(1, Number(setting(S.holdSettle)) || 8) * 1000);
  const baseline = new Map();
  for ( const t of hold.targets ) {
    const actor = await fromUuid(t.uuid);
    baseline.set(t.uuid, actor?.system?.attributes?.ac?.value ?? t.ac);
  }
  while ( Date.now() < deadline ) {
    for ( const t of hold.targets ) {
      if ( t.answer !== "cast" ) continue;
      const actor = await fromUuid(t.uuid);
      if ( (actor?.system?.attributes?.ac?.value ?? null) !== baseline.get(t.uuid) ) return;
    }
    await new Promise(r => setTimeout(r, 250));
  }
}

/* ---------------------------------------------------------------------------------------------
 * The hold's views: a durable row on the attack card, plus a popup for whoever can answer.
 * Both are pure views of the flag — dismissing the popup is not an answer.
 * ------------------------------------------------------------------------------------------- */

/** Popups already shown by this client, so a re-render never stacks a second one. */
const shownPopups = new Set();

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold?.targets?.length ) return;

  const row = document.createElement("div");
  row.className = "battleflow-hold";
  Object.assign(row.style, {
    margin: "0.25rem 0 0", padding: "0.35rem 0.5rem", borderRadius: "4px",
    border: "1px solid var(--color-border-light-2, #999a)",
    background: hold.status === "pending" ? "rgba(255,180,0,0.10)" : "transparent",
    fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6"
  });

  for ( const target of hold.targets ) {
    const line = document.createElement("div");
    Object.assign(line.style, { display: "flex", alignItems: "center", gap: "0.4rem" });
    const label = document.createElement("span");
    Object.assign(label.style, { flex: "1" });
    label.innerHTML = (hold.status === "pending")
      ? `<strong>${target.name}</strong> — ${target.reaction}?`
      : `<strong>${target.name}</strong> — ${target.answer === "cast" ? target.reaction
        : target.answer === "skip" ? "skipped by GM" : "passed"}`
        + `${target.verdict ? ` · <em>${target.verdict}</em>` : ""}`;
    line.append(label);

    if ( hold.status === "pending" ) {
      void fromUuid(target.uuid).then(actor => {
        if ( !canAnswerFor(actor) ) return;
        line.append(
          holdButton("Cast", () => answerHold(message, target.uuid, "cast")),
          holdButton("Pass", () => answerHold(message, target.uuid, "pass"))
        );
        if ( game.user.isGM ) line.append(
          holdButton("Skip", () => answerHold(message, target.uuid, "skip")));
      });
    }
    row.append(line);
  }
  html.querySelector(".message-content")?.appendChild(row);

  // The popup: attention for the person whose decision it is. Ephemeral by design — closing
  // it is not an answer, because the row above is the durable state.
  if ( (hold.status === "pending") && setting(S.holdView) && !shownPopups.has(message.id) ) {
    shownPopups.add(message.id);
    void showHoldPopup(message, hold);
  }
});

function holdButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  Object.assign(button.style, {
    flex: "0 0 auto", width: "auto", margin: "0", padding: "0 0.4rem",
    fontSize: "inherit", lineHeight: "1.4"
  });
  button.addEventListener("click", () => onClick());
  return button;
}

async function showHoldPopup(attackMessage, hold) {
  const roll = attackMessage.rolls[0];
  for ( const target of hold.targets ) {
    const actor = await fromUuid(target.uuid);
    if ( !canAnswerFor(actor) ) continue;

    // Reveal off (default) is RAW: you know you were hit, not by how much. On shows the math
    // and the verdict the re-test would reach.
    let detail = `<p>Something hits <strong>${target.name}</strong>.</p>`;
    if ( setting(S.holdReveal) ) {
      const liveAC = actor?.system?.attributes?.ac?.value ?? target.ac;
      detail = `<p><strong>${roll.total}</strong> vs AC <strong>${liveAC}</strong> — a hit.</p>`;
      if ( target.kind === "ac" ) {
        const bonus = /Shield/i.test(target.reaction) ? 5 : null;
        if ( bonus ) detail += `<p>${target.reaction} would make it AC ${liveAC + bonus} — `
          + `<em>${roll.total < (liveAC + bonus) ? "enough to miss" : "still not enough"}</em>.</p>`;
      }
    }

    await foundry.applications.api.DialogV2.wait({
      window: { title: `${target.reaction}?`, icon: "fa-solid fa-hand" },
      position: { width: 420 },
      content: `${detail}<p>Cast <strong>${target.reaction}</strong>, or let it land?</p>`,
      buttons: [
        { action: "cast", label: `Cast ${target.reaction}`, default: true,
          callback: () => answerHold(attackMessage, target.uuid, "cast") },
        { action: "pass", label: "Pass",
          callback: () => answerHold(attackMessage, target.uuid, "pass") }
      ],
      rejectClose: false
    }).catch(() => null); // dismissed ≠ answered; the card row keeps the hold alive
  }
}

/* ---------------------------------------------------------------------------------------------
 * Phase 1b — auto-apply damage to hit targets (the active-GM elect; single writer)
 * ------------------------------------------------------------------------------------------- */

Hooks.on("createChatMessage", message => {
  if ( !setting(S.autoApply) || !isActiveGM() ) return;
  if ( message.getFlag("dnd5e", "roll.type") !== "damage" ) return; // healing is typed "healing"
  const attackMessage = resolveAttackMessage(message);
  if ( !attackMessage ) return;
  const hits = hitTargets(attackMessage);
  if ( hits.length ) void applyToHitTargets(message, hits);
});

/**
 * Apply a damage message's rolls to the given targets exactly as the native tray would, and
 * stamp the receipt. Damages are built with the system's own aggregation; application runs
 * through Actor5e#applyDamage so di/dr/dv, modification, threshold and temp-HP math stay
 * authoritative. The receipt records the pre-application SOURCE hp so a revert restores the
 * exact stored values.
 */
async function applyToHitTargets(damageMessage, hits) {
  try {
    const damages = dnd5e.dice.aggregateDamageRolls(damageMessage.rolls, { respectProperties: true })
      .map(roll => ({
        value: Math.max(0, roll.total),
        type: roll.options.type,
        properties: new Set(roll.options.properties ?? [])
      }));

    const receipts = [];
    for ( const target of hits ) {
      const actor = await fromUuid(target.uuid); // the targets snapshot carries ACTOR uuids
      if ( !(actor instanceof Actor) || !actor.system.attributes?.hp ) continue;
      const src = actor.system._source.attributes.hp;
      const prior = { value: src.value, temp: src.temp, tempmax: src.tempmax };
      await actor.applyDamage(damages, {
        multiplier: 1, isDelta: true, originatingMessage: damageMessage, origin: damageMessage
      });
      const after = actor.system._source.attributes.hp;
      receipts.push({
        uuid: target.uuid,
        name: target.name,
        prior,
        delta: {
          value: (after.value ?? 0) - (prior.value ?? 0),
          temp: (after.temp ?? 0) - (prior.temp ?? 0)
        },
        reverted: false
      });
    }
    if ( receipts.length ) await damageMessage.setFlag(MODULE_ID, "receipt", { targets: receipts });
  } catch(err) {
    console.error(`${TITLE} | Auto-apply failed.`, err);
  }
}

/* ---------------------------------------------------------------------------------------------
 * Receipts — the GM-only revert row on damage cards. The flag is the state; this is a view.
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const receipt = message.getFlag(MODULE_ID, "receipt");
  if ( !receipt?.targets?.length || !game.user.isGM ) return;

  // While an un-reverted application stands, every render of the card starts with its damage
  // tray collapsed, as if Apply had been pressed (same "manual" setting guard as the native
  // handler, damage-application.mjs:337). Stateless and per-tree by hard-won necessity: a
  // message renders into SEVERAL DOM trees (chat log, the notifications pane, popouts), and
  // any latched once-per-message guard collapses a tree that gets replaced while the ones on
  // screen skip (bit live 2026-08-15). A manually reopened tray survives until the next
  // re-render — which only a receipt change or a log rebuild triggers — because the flag is
  // the state and the tray, like the receipt row, is just a view of it.
  // ⚠ Toggle the ATTRIBUTE, never the property: this render tree is detached, so custom
  // elements in it are not yet upgraded — `tray.open = false` writes a plain property that
  // shadows the accessor and never touches the attribute (the system's own _collapseTrays
  // uses toggleAttribute for the same reason, chat-message.mjs:166).
  if ( receipt.targets.some(t => !t.reverted)
    && (game.settings.get("dnd5e", "autoCollapseChatTrays") !== "manual") ) {
    html.querySelector("damage-application")?.toggleAttribute("open", false);
  }

  const row = document.createElement("div");
  row.className = "battleflow-receipt";
  Object.assign(row.style, {
    margin: "0.25rem 0 0", padding: "0.25rem 0.5rem",
    border: "1px solid var(--color-border-light-2, #999a)", borderRadius: "4px",
    fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6"
  });

  for ( const t of receipt.targets ) {
    const line = document.createElement("div");
    Object.assign(line.style, { display: "flex", alignItems: "center", gap: "0.4rem" });

    const name = document.createElement("span");
    name.textContent = t.name;
    Object.assign(name.style, { flex: "1", fontWeight: "bold" });
    if ( t.reverted ) name.style.textDecoration = "line-through";

    const detail = document.createElement("span");
    const lost = -((t.delta.value ?? 0) + (t.delta.temp ?? 0));
    const from = (t.prior.value ?? 0) + (t.prior.temp ?? 0);
    detail.textContent = t.reverted
      ? "reverted"
      : `−${lost} HP (${from} → ${from - lost})`;
    if ( t.reverted ) detail.style.fontStyle = "italic";

    line.append(name, detail);

    if ( !t.reverted ) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "↩ Revert";
      Object.assign(button.style, {
        flex: "0 0 auto", width: "auto", margin: "0",
        padding: "0 0.4rem", fontSize: "inherit", lineHeight: "1.4"
      });
      button.addEventListener("click", () => revertTarget(message, t.uuid));
      line.append(button);
    }

    row.append(line);
  }

  html.querySelector(".message-content")?.appendChild(row);
});

/**
 * Restore one receipt target to its pre-application HP snapshot. Idempotent and
 * reload-proof: state is re-read from the message flag at click time, never from the DOM,
 * and the reverted marker is written back to the flag (whose update re-renders the card on
 * every client). Deliberately NOT rewound: rolls, resources, ammo, concentration
 * (design.md §5 Phase 1) — re-applying to the right target is the native tray's job.
 */
async function revertTarget(message, uuid) {
  const receipt = foundry.utils.deepClone(message.getFlag(MODULE_ID, "receipt") ?? {});
  const entry = receipt.targets?.find(t => t.uuid === uuid);
  if ( !entry || entry.reverted ) return;

  const actor = await fromUuid(uuid);
  if ( !(actor instanceof Actor) ) {
    ui.notifications.warn(`${TITLE}: that target no longer exists — nothing to revert.`);
    return;
  }

  await actor.update({
    "system.attributes.hp.value": entry.prior.value,
    "system.attributes.hp.temp": entry.prior.temp,
    "system.attributes.hp.tempmax": entry.prior.tempmax
  });

  // Interaction contract with combatplus (design.md §9): a revert that raises the target
  // back above 0 also clears the defeated mark + dead overlay its auto-defeated set at 0.
  // combatplus's own heal-up handler usually beats us to it; this covers the table where
  // that feature is off at revert time, and no-ops when everything is already clean.
  if ( (entry.prior.value ?? 0) > 0 ) await clearDefeated(actor);

  entry.reverted = true;
  await message.setFlag(MODULE_ID, "receipt", receipt);
}

/** Mirror of combatplus's combatant matching (its updateActor handler), run in reverse. */
async function clearDefeated(actor) {
  for ( const combat of game.combats ) {
    for ( const c of combat.combatants ) {
      const match = actor.isToken ? c.tokenId === actor.token.id
        : (c.actorId === actor.id) && (c.token?.actorLink !== false);
      if ( match && c.isDefeated ) await c.update({ defeated: false });
    }
  }
  if ( actor.statuses.has("dead") ) await actor.toggleStatusEffect("dead", { active: false, overlay: true });
}
