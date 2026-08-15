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
  holdTimer: "holdTimer",
  holdSkipFutile: "holdSkipFutile",
  holdSettle: "holdSettle",
  holdView: "holdView",
  holdApplyEffect: "holdApplyEffect"
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
    hint: "When an attack hits at least one of its selected targets, the damage rolls itself on the attacker's own client — no dialog, crit pre-applied. A miss rolls nothing. Attacks must be made with targets selected. The mode gates on who is ATTACKING: \"NPC\" resolves the monster side only (the GM's own client does the work), \"PC\" the player side only, \"Everyone\" both.",
    scope: "world", config: true, type: String, default: "off",
    choices: { off: "Off", npc: "NPC Attacks Only", pc: "PC Attacks Only", all: "Everyone" }
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
    hint: "Open the system's roll-configuration dialogs (attack, damage, saves) centered on the screen instead of docked at the lower right. Per player: this only affects your own client, and it is ON unless you turn it off.",
    // Client-scoped so any player can opt out, but ON by default — the docked lower-right
    // position is the thing people notice and dislike, and a per-client setting nobody knows
    // to look for means every new login starts wrong (reported live 2026-08-15: centered as
    // GM, not centered as Gren, because that client had never been told).
    scope: "client", config: true, type: Boolean, default: true
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
    hint: "On (default): the attack total against their AC, and whether the reaction would actually turn it into a miss — so a player can tell whether spending the slot is worth it. Off (RAW): they are told only that they were hit, and react on faith. Both surfaces obey this one setting.",
    // ⚠ Defaults ON, and design.md §5 carries the matching correction. It shipped OFF on the
    // RAW argument; the user overruled that from live play, because a reaction spends a real
    // resource and a table that cannot see whether the guess pays is not tense, just annoyed.
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.holdTimer, {
    name: "Hold Timer Seconds",
    hint: "How long a held player has to answer before the hold passes itself and the attack resolves. 0 waits indefinitely — human-paced, and correct for a thoughtful table. About 5–10 keeps a big fight moving. A draining bar shows the time left on both the popup and the card.",
    scope: "world", config: true, type: Number, default: 0,
    range: { min: 0, max: 60, step: 1 }
  });

  game.settings.register(MODULE_ID, S.holdSkipFutile, {
    name: "Skip Hopeless Holds",
    hint: "Don't stop the game to offer a reaction that cannot change the outcome — if the attack beats the target's AC by more than the reaction would add, it resolves without asking. Requires \"Hold Shows the Math\": with the math hidden, a prompt that never appears would itself reveal that the attack beat your AC by more than 5.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.holdSettle, {
    name: "Hold Settle Seconds",
    hint: "After a reaction is cast, how long to wait for its AC change to actually land before re-testing the attack. Shield's +5 arrives as an active effect that must be applied (the native effects tray), so re-testing instantly would read a stale AC and wrongly call it a hit.",
    scope: "world", config: true, type: Number, default: 8,
    range: { min: 1, max: 30, step: 1 }
  });

  game.settings.register(MODULE_ID, S.holdApplyEffect, {
    name: "Apply the Reaction's Own Effect",
    hint: "When a held target casts their reaction, put its self-effect on them — Shield's +5 AC arrives as an effect the native tray would otherwise wait for someone to click, and until it lands the re-test reads the old AC and calls it a hit. Only ever applies the cast reaction's own effect, to the caster, while their hold is open. Turn off if you would rather click the effects tray yourself.",
    scope: "world", config: true, type: Boolean, default: true
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
    for ( const key of [S.interruptList, S.holdReveal, S.holdTimer, S.holdSkipFutile,
      S.holdSettle, S.holdView, S.holdApplyEffect] )
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
  // ⚠ Never suppress a card that carries effects. Attack-roll SPELLS are attack activities
  // too, and their card is the only place their riders can be applied from — suppressing it
  // silently ate Ray of Frost's slow (reported live 2026-08-15). Phase 3 will apply these
  // automatically; until then the card must survive to be clicked.
  if ( doc.system?.effects?.length ) return;
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
  // The mode gates on the ATTACKER's side of the table, and this hook runs on whichever client
  // rolled — so "npc" is in practice the GM's client and "pc" a player's own. Everything
  // downstream is side-agnostic: auto-apply is the GM elect regardless of who attacked, and a
  // hold's continuation follows the roller (see isContinuingClient).
  const isPC = subject.actor?.type === "character";
  if ( (mode === "npc") && isPC ) return;
  if ( (mode === "pc") && !isPC ) return;

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
 * The first curated interrupt this actor can actually use right now, or null. Eligibility is
 * deliberately conservative: a hold the target cannot answer is a pure false stop.
 */
async function findInterrupt(actor, { isCritical }) {
  if ( !actor || reactionSpent(actor) ) return null;
  for ( const entry of interruptEntries() ) {
    // A natural 20 hits regardless of AC, so an AC-type reaction cannot save it — no pause.
    if ( isCritical && (entry.kind === "ac") ) continue;

    // ⚠ THE MONSTER PATTERN COMES FIRST, because it is the common one. A 2024 statblock does
    // not cast from the spell item at all: its "Spellcasting" feature carries one `cast`
    // ACTIVITY per spell, and the resource lives on that activity — verified on Skeletal Mage
    // ("Shield - Spellcasting", activation reaction, uses 1/1, consumption activityUses) and
    // on the compendium Green Hag, which has the same shape on two features. The spell item
    // that activity points at is a linked target: it reports spellSlot:true and no uses, so
    // interrogating IT concluded the monster could not cast, and no statblock caster ever
    // held (reported live 2026-08-15).
    const cast = await findCastActivity(actor, entry.name);
    if ( cast ) return { entry, item: cast.item, activity: cast.activity };
    // ⚠ EVERY item of that name, not the first. A caster who both wears a shield and knows
    // Shield has two items called "Shield", and `find` returned whichever sorted first — so
    // picking the mundane one disqualified the entry and the spell was never even considered.
    // That is most armoured statblock casters.
    for ( const item of actor.items.filter(i => i.name.toLowerCase() === entry.name.toLowerCase()) ) {
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
      return { entry, item };
    }
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
function inRunningCombat(actor) {
  return game.combats.some(c => c.started && c.combatants.some(cb => cb.actor?.id === actor.id));
}

// Cleared when the actor's own turn comes round again.
Hooks.on("updateCombat", combat => {
  if ( !setting(S.reactionHold) || !isActiveGM() ) return;
  const actor = combat.combatant?.actor;
  if ( actor?.getFlag(MODULE_ID, "reactionSpent") ) void actor.unsetFlag(MODULE_ID, "reactionSpent");
});

// …and when the fight ends, so nobody carries a spent reaction into the next one.
Hooks.on("deleteCombat", combat => {
  if ( !setting(S.reactionHold) || !isActiveGM() ) return;
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
async function stampHoldIfInterrupted(attackMessage, roll, hits) {
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
      hadEffect: hasReactionEffect(actor, found.item.name),
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
  const bonus = reactionACBonus(found.item.name, actor);
  if ( bonus == null ) return true;               // unmeasurable bonus — ask the human
  const liveAC = actor?.system?.attributes?.ac?.value ?? snapshotAC;
  if ( !Number.isFinite(liveAC) ) return true;
  return roll.total < (liveAC + bonus);           // only worth asking if it can force a miss
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
    const effectLanded = reactionACArrived(actor, target);
    const cast = answer === "cast";
    const lines = cast
      ? [effectLanded ? `AC is now <strong>${ac}</strong>.`
                      : `<em>Its AC has not landed yet — the verdict will use the real number.</em>`]
      : [`No reaction — the attack lands.`];
    await ChatMessage.create({
      content: bfCard({
        img: reactionImg(actor, target.reaction),
        eyebrow: cast ? "Reaction — cast" : "Reaction — passed",
        title: cast ? target.reaction : "Lets it land",
        subtitle: target.name,
        lines,
        tone: cast ? "good" : "neutral"
      }),
      speaker: ChatMessage.getSpeaker({ actor }),
      flags: { [MODULE_ID]: { respondsTo: attackMessage.id, uuid, answer, ac, effectLanded } }
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
  const answering = [];
  for ( const message of game.messages.contents.slice(-25) ) {
    const hold = message.getFlag(MODULE_ID, "hold");
    if ( !hold || (hold.status !== "pending") ) continue;
    const target = hold.targets.find(t => (t.uuid === actor.uuid) && !t.answer);
    if ( target ) answering.push({ message, uuid: target.uuid, reaction: target.reaction });
  }
  if ( !answering.length ) return;

  if ( setting(S.holdApplyEffect) ) await applyReactionEffect(activity, actor, answering[0].reaction);
  for ( const { message, uuid } of answering ) await answerHold(message, uuid, "cast");
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
function hasReactionEffect(actor, reactionName) {
  if ( !actor || !reactionName ) return false;
  const item = actor.items.find(i => i.name.toLowerCase() === reactionName.toLowerCase());
  const names = new Set((item?.effects?.contents ?? []).map(e => e.name));
  return actor.effects.some(e => !e.disabled && (names.has(e.name)
    || (e.origin && item && e.origin.includes(item.id))));
}

async function applyReactionEffect(activity, actor, reactionName) {
  try {
    // ⚠ A  activity has no effects of its own — they live on the spell it links to. Its
    // owning item is the feature ("Spellcasting"), so fall back to the spell of the reaction's
    // NAME on this actor, which is where Imperceptible Barrier actually sits.
    let effects = activity?.applicableEffects ?? [];
    if ( !effects.length && reactionName ) {
      const spell = actor?.items.find(i => i.name.toLowerCase() === reactionName.toLowerCase());
      effects = (spell?.effects?.contents ?? []).filter(e => !e.transfer);
    }
    for ( const effect of effects ) {
      const existing = actor.effects.find(e => (e.origin === effect.uuid) || (e.name === effect.name));
      if ( existing ) {
        await existing.update({ ...effect.constructor.getInitialDuration(), disabled: false });
        continue;
      }
      await ActiveEffect.implementation.create({
        ...effect.toObject(),
        disabled: false,
        transfer: false,
        origin: effect.uuid,
        flags: { dnd5e: { dependentOn: effect.uuid }, [MODULE_ID]: { reactionEffect: true } }
      }, { parent: actor });
    }
  } catch(err) {
    console.error(`${TITLE} | Could not apply the reaction's effect — apply it from the card.`, err);
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
async function continueHold(attackMessage) {
  const hold = foundry.utils.deepClone(attackMessage.getFlag(MODULE_ID, "hold"));
  if ( !hold || (hold.status !== "pending") ) return;

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
      if ( !actor?.isOwner || hasReactionEffect(actor, target.reaction) ) continue;
      // The reaction NAME is what matters here, not the activity — applyReactionEffect falls
      // back to the named spell's own effects, which is the only place a statblock's Shield
      // keeps Imperceptible Barrier (its cast activity carries none).
      const item = actor.items.find(i => i.name.toLowerCase() === target.reaction.toLowerCase());
      const activity = item?.system.activities?.contents?.[0];
      await applyReactionEffect(activity, actor, target.reaction);
    }
  }

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
    const img = reactionImg(actor, target.reaction);
    if ( target.kind === "ac" ) {
      // If the reaction's AC never arrived, the number we just tested against is the one the
      // target had BEFORE reacting — so say so instead of reporting a stale value as fact.
      // A silent "still hits" here is the worst possible outcome: it looks authoritative.
      if ( !reactionACArrived(actor, target) ) {
        announcements.push(bfCard({
          img, eyebrow: "Reaction — not applied", title: target.reaction, subtitle: target.name,
          tone: "bad",
          lines: [`It was cast, but its AC has not arrived on <strong>${target.name}</strong>.`,
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

  // Damage rolls only if something is still hit — a Shield that turned the only hit into a
  // miss ends the chain here, and the dice never exist.
  if ( !hitTargets(attackMessage).length ) return;
  const activity = await fromUuid(attackMessage.getFlag("dnd5e", "activity")?.uuid);
  if ( activity ) await rollDamageForAttack(activity, attackMessage);
}

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
  if ( !hasReactionEffect(actor, target.reaction) ) return false;
  // Already applied when we stamped, so the snapshot contains the bonus and there is no delta
  // to look for — the effect row is the whole of what can be checked.
  if ( target.hadEffect ) return true;
  const bonus = reactionACBonus(target.reaction, actor);
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

/* ---------------------------------------------------------------------------------------------
 * The hold's views: a durable row on the attack card, plus a popup for whoever can answer.
 * Both are pure views of the flag — dismissing the popup is not an answer.
 * ------------------------------------------------------------------------------------------- */

/** Popups already shown by this client, so a re-render never stacks a second one. */
const shownPopups = new Set();

/**
 * Popups currently on screen, keyed message+target. The popup is the ANSWER SURFACE and the
 * card is the public record of the same moment — one decides, one watches. Two live controls
 * for one decision is exactly how they got out of step (reported live 2026-08-15: answering on
 * the card left the popup sitting open, still asking).
 */
const livePopups = new Map();
const popupKey = (messageId, uuid) => `${messageId}|${uuid}`;

/* ---------------------------------------------------------------------------------------------
 * The house card. Everything this module says out loud wears it.
 *
 * The module's messages used to be bare italic text — "lets it land — no reaction." — sitting
 * in a log where every native card around them had a portrait, a title and a structure. They
 * read as debug output rather than as part of the game (reported live 2026-08-15, twice).
 *
 * ⚠ Inline styles on purpose. module.json carries no `styles` entry, and adding one needs a
 * Foundry PROCESS restart to take effect, while a script change is live on the next F5 — so a
 * stylesheet would make every future tweak cost a bounce. If this ever grows past a few
 * helpers, add the stylesheet and take the one bounce.
 * ------------------------------------------------------------------------------------------- */

const TONE = {
  pending: "rgba(214,158,46,0.95)",   // waiting on a human
  good:    "rgba(70,150,95,0.95)",    // the reaction did its job
  bad:     "rgba(180,70,60,0.95)",    // it landed anyway
  neutral: "rgba(120,120,120,0.75)"
};

/**
 * One card: an accent spine, a portrait, an eyebrow/title/subtitle stack, and body lines.
 * `lines` are already-safe HTML fragments.
 */
function bfCard({ img, eyebrow, title, subtitle, lines = [], tone = "neutral" }) {
  const accent = TONE[tone] ?? TONE.neutral;
  const portrait = img
    ? `<img src="${img}" alt="" style="width:40px;height:40px;flex:0 0 auto;border-radius:4px;
         border:1px solid var(--color-border-dark,#0006);object-fit:cover;">`
    : "";
  const body = lines.filter(Boolean).map(line =>
    `<div style="margin-top:0.2rem;">${line}</div>`).join("");
  return `
  <div style="border-left:3px solid ${accent};border-radius:3px;padding:0.4rem 0.55rem;
              background:rgba(0,0,0,0.04);">
    <div style="display:flex;gap:0.5rem;align-items:center;">
      ${portrait}
      <div style="flex:1;min-width:0;">
        ${eyebrow ? `<div style="font-size:var(--font-size-10,10px);letter-spacing:0.08em;
             text-transform:uppercase;opacity:0.6;line-height:1.4;">${eyebrow}</div>` : ""}
        <div style="font-family:var(--font-h1,inherit);font-size:var(--font-size-15,15px);
             font-weight:bold;line-height:1.2;">${title}</div>
        ${subtitle ? `<div style="font-size:var(--font-size-11,11px);opacity:0.7;
             line-height:1.3;">${subtitle}</div>` : ""}
      </div>
    </div>
    ${body ? `<div style="margin-top:0.35rem;font-size:var(--font-size-12,12px);
         line-height:1.5;">${body}</div>` : ""}
  </div>`;
}

/** The reaction's own artwork, for cards that talk about it. */
function reactionImg(actor, reactionName) {
  return actor?.items.find(i => i.name.toLowerCase() === reactionName?.toLowerCase())?.img ?? null;
}

/* ---------------------------------------------------------------------------------------------
 * The countdown bar (design.md §4.3).
 *
 * ⚠ ZERO JS TICKING. The bar is one CSS animation whose duration is the hold's own window, and
 * a reload resumes it mid-drain with a NEGATIVE animation-delay computed from the deadline
 * stored on the flag — so every client, and every re-render, agrees without anyone counting.
 * A per-second interval per open hold per client is exactly the kind of thing that is fine
 * with one hold on screen and miserable with six.
 * ------------------------------------------------------------------------------------------- */

/**
 * The draining bar for a hold, or "" when there is no timer. `deadline` and `window` both live
 * on the flag, so this is a pure function of state — no client keeps its own clock.
 */
function holdBarHTML(hold) {
  if ( !hold?.deadline || !hold?.window || (hold.status !== "pending") ) return "";
  const remaining = (hold.deadline - Date.now()) / 1000;
  if ( remaining <= 0 ) return "";
  // Negative delay = start the animation already part-way through, which is what makes a
  // reload pick the bar up exactly where it should be rather than restarting it.
  const elapsed = hold.window - remaining;
  return `
  <div style="margin-top:0.45rem;display:flex;align-items:center;gap:0.4rem;">
    <div style="flex:1;height:6px;border-radius:3px;background:rgba(0,0,0,0.18);overflow:hidden;">
      <div data-bf-deadline="${hold.deadline}" data-bf-window="${hold.window}"
           style="height:100%;width:100%;border-radius:3px;
                  background:${TONE.good};"></div>
    </div>
    <span style="font-size:var(--font-size-10,10px);opacity:0.6;white-space:nowrap;">
      ${hold.window}s to answer</span>
  </div>`;
}

/**
 * Snap every bar to the actual deadline.
 *
 * ⚠ `animation-delay` is NOT enough, and this cost a measurement to find. A CSS animation's
 * clock starts when its element begins being RENDERED — and a chat message is first inserted
 * into a tree that is not rendering yet (the same several-DOM-trees behaviour that makes
 * render hooks stateless). So the card's bar started its drain seconds after the popup's,
 * from an identical declared delay, and stayed exactly that far behind for the whole hold:
 * measured at one instant, popup 71% and card 86%, both declaring -0.9s. The delay is relative
 * to a start the element chooses; `currentTime` is absolute, so it is what the deadline can
 * actually be written onto.
 *
 * One-shot, never a ticker — called on render and again on the next frame, because the first
 * call can land while the element is still not being rendered.
 */
function syncHoldBars(root) {
  const scope = (root && root.querySelectorAll) ? root : document;
  for ( const bar of scope.querySelectorAll("[data-bf-deadline]") ) {
    const deadline = Number(bar.dataset.bfDeadline);
    const seconds = Number(bar.dataset.bfWindow);
    if ( !deadline || !seconds ) continue;
    const duration = seconds * 1000;
    const elapsed = Math.max(0, Math.min(duration, duration - (deadline - Date.now())));

    // ⚠ Build the animation in JS rather than in CSS. A CSS animation is not INSTANTIATED
    // until its element is actually being rendered — measured: a freshly inserted card's bar
    // reported getAnimations().length === 0 and zero width more than a second after render,
    // so every correction pass found nothing to correct and the drain later started from zero.
    // element.animate() exists the moment it is called and runs on the document timeline, so
    // it neither waits for layout nor cares whether the element is on screen yet.
    let animations = bar.getAnimations?.() ?? [];
    if ( !animations.length ) animations = [
      bar.animate([{ width: "100%" }, { width: "0%" }],
        { duration, fill: "forwards", easing: "linear" }),
      bar.animate([
        { backgroundColor: TONE.good },
        { backgroundColor: TONE.pending, offset: 0.55 },
        { backgroundColor: TONE.bad }
      ], { duration, fill: "forwards", easing: "linear" })
    ];
    for ( const animation of animations ) {
      try { animation.currentTime = elapsed; } catch(err) { /* the next pass gets it */ }
    }
  }
}

/** Render, then correct — twice, because the first pass can precede the element rendering. */
function scheduleBarSync(root) {
  syncHoldBars(root);
  requestAnimationFrame(() => syncHoldBars(root));
  setTimeout(() => syncHoldBars(root), 400);
}

/**
 * The buzzer. Armed by whichever client owns the continuation — one authoritative clock, not a
 * cross-client timeout — and re-checked at the buzzer, because an answer landing in the last
 * instant must beat the timer rather than race it.
 */
const armedTimers = new Map();

function armHoldTimer(message) {
  const hold = message?.getFlag(MODULE_ID, "hold");
  if ( !hold?.deadline || (hold.status !== "pending") || !isContinuingClient(hold) ) return;
  if ( armedTimers.has(message.id) ) return;
  const delay = Math.max(0, hold.deadline - Date.now());
  armedTimers.set(message.id, setTimeout(() => {
    armedTimers.delete(message.id);
    void fireHoldTimer(message.id);
  }, delay));
}

function disarmHoldTimer(messageId) {
  const handle = armedTimers.get(messageId);
  if ( handle === undefined ) return;
  clearTimeout(handle);
  armedTimers.delete(messageId);
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
    target.timedOut = true;
    expired = true;
  }
  if ( !expired ) return;
  await message.setFlag(MODULE_ID, "hold", merged);
}

/**
 * The AC a listed reaction actually grants, read from the reaction's OWN effect instead of
 * hardcoding Shield's +5 — the interrupt list is user-editable, so anything that assumes
 * Shield is wrong for the other twelve entries. Returns null for a non-numeric bonus (a
 * proficiency-scaled one like Defensive Duelist), which simply omits the "would it flip" line.
 */
function reactionACBonus(reactionName, actor) {
  const item = actor?.items.find(i => i.name.toLowerCase() === reactionName?.toLowerCase());
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
  const bonus = (target.kind === "ac") ? reactionACBonus(target.reaction, actor) : null;
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
      const reveal = revealDetail(target, roll, actor);
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
      } else {
        const cast = target.answer === "cast";
        tone = (target.verdict === "miss") ? "good" : cast ? "bad" : "neutral";
        eyebrow = cast ? "Reaction — cast"
          : target.answer === "skip" ? "Reaction — skipped"
          : target.timedOut ? "Reaction — timed out" : "Reaction — passed";
        // Resolved cards carry the numbers the verdict was reached with, so a surprising
        // outcome can be read straight off the card instead of reconstructed.
        if ( cast && (target.acAtVerdict != null) ) {
          const moved = target.acAtVerdict !== target.ac;
          lines.push(`AC <strong>${target.ac}</strong>${moved ? ` → <strong>${target.acAtVerdict}</strong>` : ""}`
            + ` vs the attack's <strong>${roll?.total}</strong>`);
        }
        if ( target.verdict ) lines.push(target.verdict === "miss"
          ? `<strong>The attack misses.</strong>`
          : `The attack still hits.`);
        else if ( target.answer === "pass" ) lines.push(target.timedOut
          ? "The reaction window closed — no answer, so the attack lands."
          : "Let it land — no reaction.");
      }

      block.innerHTML = bfCard({
        img: reactionImg(actor, target.reaction),
        eyebrow, title: target.reaction, subtitle, lines, tone
      }) + holdBarHTML(hold);
      scheduleBarSync(block);

      if ( hold.status !== "pending" ) return;
      // A reload lands here with the hold still open — re-arm the buzzer from the flag's
      // deadline rather than restarting the window.
      armHoldTimer(message);
      if ( !canAnswerFor(actor) ) return;

      // ⚠ ONE input surface. When this client gets popups, the popup decides and the card only
      // watches — it offers a way to call the popup BACK (a dismissed popup must never strand
      // the decision) but never a second set of answer controls. With popups off the card is
      // the only surface there is, so it carries the real buttons.
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        display: "flex", gap: "0.3rem", marginTop: "0.4rem", justifyContent: "flex-end"
      });
      if ( setting(S.holdView) ) {
        controls.append(holdButton("Answer", () => {
          shownPopups.delete(message.id);
          void showHoldPopup(message, message.getFlag(MODULE_ID, "hold"));
        }));
      } else {
        controls.append(
          holdButton("Cast", () => castReaction(target)),
          holdButton("Pass", () => answerHold(message, target.uuid, "pass"))
        );
        if ( game.user.isGM ) controls.append(
          holdButton("Skip", () => answerHold(message, target.uuid, "skip")));
      }
      block.append(controls);
    });
  }
  html.querySelector(".message-content")?.appendChild(row);

  // The popup: attention for the person whose decision it is. Ephemeral by design — closing
  // it is not an answer, because the row above is the durable state.
  if ( (hold.status === "pending") && setting(S.holdView) && !shownPopups.has(message.id) ) {
    shownPopups.add(message.id);
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
 * (caught by Tom in live play, 2026-08-15). design.md §5 is explicit: the cast IS the answer,
 * and the button is convenience, not protocol. A cancelled cast answers nothing, correctly
 * leaving the hold open.
 */
async function castReaction(target) {
  const actor = await fromUuid(target.uuid);
  // Prefer the activity the hold recorded. A statblock casts Shield from its Spellcasting
  // feature's `cast` activity — the spell item of the same name is a linked target that
  // reports spellSlot:true with no slots, so casting THAT is refused for want of a resource.
  let activity = target.activityId
    ? actor?.items.get(target.itemId)?.system.activities?.get(target.activityId)
    : null;
  if ( !activity ) {
    const item = actor?.items.find(i => i.name.toLowerCase() === target.reaction.toLowerCase());
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
  // casts from their sheet instead — that is detected identically (design.md §5).
  await activity.use({}, { configure: false }, {});
}

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

/**
 * The reaction rendered as its own card: portrait, name, who is reacting, the ability's real
 * text, and — only if the reveal is on — the math. This is the moment the whole feature exists
 * to protect, so it should read like the ability rather than like a confirm box.
 */
async function holdPopupContent(target, roll, actor, hold) {
  const item = actor?.items.find(i => i.name.toLowerCase() === target.reaction.toLowerCase());
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

  const reveal = revealDetail(target, roll, actor);
  const situation = reveal
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
    <img src="${img}" alt="" style="width:48px;height:48px;flex:0 0 auto;border-radius:4px;
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
async function showHoldPopup(attackMessage, hold) {
  const roll = attackMessage.rolls[0];
  for ( const target of hold.targets ) {
    const actor = await fromUuid(target.uuid);
    if ( !canAnswerFor(actor) ) continue;

    const key = popupKey(attackMessage.id, target.uuid);
    if ( livePopups.has(key) ) continue;

    const buttons = [
      { action: "cast", label: `Cast ${target.reaction}`, default: true,
        callback: () => castReaction(target) },
      { action: "pass", label: "Pass",
        callback: () => answerHold(attackMessage, target.uuid, "pass") }
    ];
    // The GM's override lives beside the real choices rather than only on the card, so the
    // popup is a complete answer surface and the card never has to be the fallback.
    if ( game.user.isGM ) buttons.push({ action: "skip", label: "Skip",
      callback: () => answerHold(attackMessage, target.uuid, "skip") });

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: target.reaction, icon: "fa-solid fa-shield-halved" },
      position: { width: 460 },
      content: await holdPopupContent(target, roll, actor, hold),
      buttons,
      rejectClose: false
    });

    // Patch the instance rather than subclassing: whatever closes it — a button, the X, escape,
    // or closeAnsweredPopups below — must release the card row in exactly one place.
    const close = dialog.close.bind(dialog);
    dialog.close = async (...args) => {
      livePopups.delete(key);
      try { ui.chat?.updateMessage?.(attackMessage); } catch(err) { /* row refreshes next render */ }
      return close(...args);
    };

    livePopups.set(key, dialog);
    try {
      await dialog.render({ force: true });
      scheduleBarSync(dialog.element);
      // The row was drawn before this popup existed; redraw so it defers instead of offering
      // a second set of buttons.
      ui.chat?.updateMessage?.(attackMessage);
    } catch(err) {
      livePopups.delete(key);
      console.error(`${TITLE} | Could not open the reaction popup — answer from the card.`, err);
    }
  }
}

/**
 * A popup must not outlive the message it is a view of. Deleting the hold — which is what the
 * smoke suites do to every message they create — used to leave one open dialog per hold
 * stacked on every client that could answer, asking about attacks that no longer exist
 * (reported live 2026-08-15: "close all the popup window spam").
 */
Hooks.on("deleteChatMessage", message => {
  for ( const [key, dialog] of [...livePopups] ) {
    if ( !key.startsWith(`${message.id}|`) ) continue;
    livePopups.delete(key);
    void dialog.close();
  }
  shownPopups.delete(message.id);
  disarmHoldTimer(message.id);   // no message, no hold, nothing for the buzzer to pass
});

/** A decision made anywhere closes the popup asking for it. */
function closeAnsweredPopups(message) {
  const hold = message.getFlag(MODULE_ID, "hold");
  if ( !hold?.targets?.length ) return;
  for ( const target of hold.targets ) {
    const dialog = livePopups.get(popupKey(message.id, target.uuid));
    if ( !dialog ) continue;
    if ( (hold.status !== "pending") || target.answer ) void dialog.close();
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
  if ( !receipt?.targets?.length ) return;
  // Everyone sees WHO the damage landed on — otherwise a rolled number sits on the card with
  // no indication of who took it. Only the GM sees the HP pool and the revert control: the
  // party has no business reading a monster's hit points off a chat card.
  const isGM = game.user.isGM;

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

    const icon = document.createElement("i");
    icon.className = t.reverted ? "fa-solid fa-rotate-left" : "fa-solid fa-heart-crack";
    Object.assign(icon.style, { flex: "0 0 auto", opacity: t.reverted ? "0.5" : "0.85" });

    const name = document.createElement("span");
    name.textContent = t.name;
    Object.assign(name.style, { flex: "1", fontWeight: "bold" });
    if ( t.reverted ) name.style.textDecoration = "line-through";

    const lost = -((t.delta.value ?? 0) + (t.delta.temp ?? 0));
    const from = (t.prior.value ?? 0) + (t.prior.temp ?? 0);
    const detail = document.createElement("span");
    Object.assign(detail.style, { flex: "0 0 auto", fontVariantNumeric: "tabular-nums" });
    if ( t.reverted ) {
      detail.textContent = "reverted";
      detail.style.fontStyle = "italic";
    } else {
      // The HP pool is GM-only; players get the fact and the number, not the monster's book.
      detail.textContent = isGM ? `−${lost} HP (${from} → ${from - lost})` : `−${lost} HP`;
    }

    line.append(icon, name, detail);

    if ( isGM && !t.reverted ) {
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
