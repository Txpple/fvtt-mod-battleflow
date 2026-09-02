/**
 * Battle Flow — Settings registration and the settings-sheet polish (dividers, dependent grey-out).
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting } from "./core.js";
import { KIND_SETS, LIST_SPECS, parseList, rejectMessage } from "./decide/registry.js";

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

  // ⚠ A per-CLIENT setting, and a DELIBERATE reversal of "max options later, one switch
  // now" — recorded as one in DESIGN.md's Per-client section. v1.9.5 DELETED `saveAutoRoll`,
  // whose shape was "the POPUP is the default, the opt-out is silent auto-roll"; this is that
  // mirrored, and it exists because a player asked for their own dice back (FLOW item 3).
  // ⚠ Default ON since 2026-08-27 (user call, from live play: a new login was silently losing
  // its own dice). That REVERSES the original "changes nothing until you go find it" default,
  // and the original's own reasoning is what flips it: a per-client setting nobody knows to
  // look for means every new login starts wrong — and the table's normal is players pressing
  // their own damage, so the wrong start was the silent auto-roll. The buzzer keeps a missed
  // popup from ever stalling the table, which is what makes ON a safe default.
  // ⚠ ONE SWITCH ACROSS ALL THREE DAMAGE PATHS — attacks, save spells and areas. The first cut
  // covered attacks alone and the walk found the hole immediately; a second switch for "and my
  // spells too" would be asking the table to opt into the same answer twice.
  game.settings.register(MODULE_ID, S.playerRollDamage, {
    name: "Roll Your Own Damage",
    hint: "Ask before rolling YOUR damage, instead of the automation rolling it for you: a popup with one button and a timer, on your client alone. It covers every roll the machine would have taken — an attack that hits, a save spell like Vicious Mockery or Fireball, and areas like Web. Press it and the dice roll exactly as the automation would have rolled them — same damage, same crit, same everything downstream — and the buzzer rolls for you if you miss the window, so a missed popup can never stall the table. An attack popup also says when the hit was a CRITICAL; a spell popup says what a successful save does to the number. Per player: this affects your own client only, and it is ON unless you turn it off.",
    scope: "client", config: true, type: Boolean, default: true
  });

  // The window HAD no setting ("one switch, not two") while the popup was invisible to
  // everyone but its roller. Walk-4 finding (w) made the wait a TABLE moment — the card runs
  // the same draining bar for everyone — and a visible clock earns the family's own knob.
  game.settings.register(MODULE_ID, S.damageTimer, {
    name: "Damage Roll Timer Seconds",
    hint: "How long an offered damage roll waits before the module rolls it. 0 waits indefinitely. Expiry ROLLS, never cancels — closing the popup does the same — so the timer only ever decides who pressed the button. The draining bar shows on the roller's popup AND on the card, so the whole table can see the dice everyone is waiting on.",
    scope: "world", config: true, type: Number, default: 24,
    range: { min: 0, max: 60, step: 1 }
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

  // The suppression machinery (the 1.1 master + the 1.9D buckets) was REMOVED at v1.10.0
  // (user call 2026-08-17: "we rip out the card suppression machinery, and we just have
  // machinery to hide non-refund-resource buttons"). Every use posts its first card; the
  // one card-shaping switch left is hideCardButtons below.
  game.settings.register(MODULE_ID, S.hideCardButtons, {
    name: "Hide Redundant Buttons",
    hint: "Hide the action buttons on chat cards — Attack, Damage, Saving Throw and the rest — leaving only Refund Resource and Place Measured Template. The module runs those workflows itself (attacks auto-roll, saves pop up, damage applies by verdict), so the buttons are a second, manual path that mostly confuses; the card keeps its text, its targets and its effects tray. Placing a template stays pressable because nothing automates it — and a placed template is how a save spell finds its targets.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.centerRollDialogs, {
    name: "Center Popups",
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
    hint: 'Which reactions pause the chain, as "Name:kind" separated by commas. kind is "ac" (raises AC — the hold re-tests the attack against the new AC, and crits skip the pause since a natural 20 hits regardless) or "damage" (reduces damage — the hold pauses and announces; the reduction itself stays a human call). Names must match the item on the actor. See ARCHITECTURE.md §6 for the full survey.',
    // ⚠ THE DEFAULT LIVES WITH ITS PARSER (decide/registry.js), and so does the note on why
    // Riposte is deliberately absent from it. A default the gate can only reach by scraping
    // source is a default the gate cannot really check — see the spec header.
    scope: "world", config: true, type: String,
    default: LIST_SPECS.interrupt.default
  });

  game.settings.register(MODULE_ID, S.blockList, {
    name: "Spells a Reaction Blocks",
    hint: 'Which spells a reaction stops outright, as "Spell:Reaction" separated by commas. '
      + 'Casting a listed spell at someone holding that reaction pauses exactly like a hit does — '
      + 'and taking the reaction means the spell\'s damage is never applied to them. Shield reads '
      + '"you take no damage from Magic Missile"; nothing else in 2024 content does this, so one '
      + 'entry is the whole list.',
    // Keyed by the TRIGGERING SPELL, not by the reaction, which is what keeps the interrupt list
    // above untouched. Shield is genuinely both things — it raises AC against an attack roll AND
    // negates Magic Missile — and folding that into the `Name:kind` grammar would need two
    // entries and two colons to say one thing about one spell.
    scope: "world", config: true, type: String, default: LIST_SPECS.block.default
  });

  game.settings.register(MODULE_ID, S.holdReveal, {
    name: "Hold Shows the Math",
    hint: "On (default): the attack total against their AC, and whether the reaction would actually turn it into a miss — so a player can tell whether spending the slot is worth it. Off (RAW): they are told only that they were hit, and react on faith. Both surfaces obey this one setting.",
    // ⚠ Defaults ON, and ARCHITECTURE.md §6 carries the matching correction. It shipped OFF on the
    // RAW argument; the user overruled that from live play, because a reaction spends a real
    // resource and a table that cannot see whether the guess pays is not tense, just annoyed.
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.holdTimer, {
    name: "Hold Timer Seconds",
    hint: "How long a held player has to answer before the hold passes itself and the attack resolves. 0 waits indefinitely — human-paced, and correct for a thoughtful table. A draining bar shows the time left on both the popup and the card.",
    // Default 24 (user call 2026-08-27: every timer defaults to 24s — set 30 and trimmed to 24
    // the same day; superseded 2026-08-17's 15s, which live play kept losing to) — a popup
    // that can pass itself needs a window a human at a watched window can win.
    scope: "world", config: true, type: Number, default: 24,
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

  game.settings.register(MODULE_ID, S.riders, {
    name: "Hit Riders",
    hint: "Fold a marked target's extra damage into the attack's own damage roll — Hunter's Mark's 1d6 force arrives with the sword instead of waiting for a second button. Only ever adds damage the caster has already earned: the mark must be on the target, and it must be THIS attacker's mark.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.riderList, {
    name: "Rider Table",
    hint: 'Which marks add damage, as system identifiers separated by commas — "hunters-mark", not "Hunter\'s Mark". How MUCH is never listed here: it is read from the spell\'s own bonus-damage activity, so the number is always the one the content ships. Swept from official 2024 content by tools/scan-riders.mjs.',
    // Identifiers, not names. A Ranger's Favored Enemy casts arrive as a SEPARATE item
    // ("Hunter's Mark - Favored Enemy", a cachedFor copy) sharing the identifier and the marker
    // but not the name — matching on name would silently skip the free casts, which are the
    // ones a ranger uses most. Same trap as a hobgoblin's worn "Shield" vs the Shield spell.
    //
    // A list is still needed even though the damage is self-describing: the no-activation
    // damage-activity shape is also worn by things that are NOT attack riders — Ensnaring
    // Strike's "Start of Turn Damage" sits on the target with the caster as its origin and
    // would otherwise pay out on every attack against a restrained creature.
    scope: "world", config: true, type: String,
    default: LIST_SPECS.rider.default
  });

  game.settings.register(MODULE_ID, S.riderUpgrades, {
    name: "Rider Upgrades",
    hint: 'Features that REPLACE a mark\'s damage, as "feature:mark" identifier pairs. The Ranger\'s level-20 Foe Slayer makes Hunter\'s Mark a d10 instead of a d6 — and like the mark itself, how much is read from the feature\'s own bonus-damage activity rather than typed here.',
    scope: "world", config: true, type: String, default: LIST_SPECS.riderUpgrade.default
  });

  // THE REMINDER GATE (Stage 2 + 3, 2026-09-01). Two lists: what KINDS of source the gate reads,
  // and which rows of the condition table count under the `condition` kind. Both are switches —
  // an empty Reminder Sources list turns the gate off entirely.
  game.settings.register(MODULE_ID, S.reminderList, {
    name: "Reminder Sources",
    hint: 'What the gate reads before an attack roll, separated by commas: "vex" (your own Vexed chip on the target — Advantage), "sap" (a Sapped chip on the attacker — Disadvantage), "prone" (either side prone — the attacker at Disadvantage; the target gives Advantage within 5 feet and Disadvantage beyond), "condition" (the conditions in the Condition Sources list), "range" (a ranged attack beyond normal range or with an enemy within 5 feet — Disadvantage; beyond long range — cannot be made). When any listed source applies, the system\'s own Attack Roll dialog opens — even on a fast-forward key — with a Battle Flow section: a box per source with its rule, and the net, which is the highlighted button. YOU press; nothing is ever applied for you. An empty list turns the gate off.',
    scope: "world", config: true, type: String, default: LIST_SPECS.reminders.default
  });

  game.settings.register(MODULE_ID, S.conditionList, {
    name: "Condition Sources",
    hint: "Which conditions the gate reads, by the system's own status ids, separated by commas. Each one's effect on attack rolls comes from the 2024 Rules Glossary and is quoted in the popup. Remove a condition here to stop being reminded of it.",
    scope: "world", config: true, type: String, default: LIST_SPECS.conditions.default
  });

  game.settings.register(MODULE_ID, S.effectRiders, {
    name: "Effect Riders",
    hint: "A hit applies the effects riding it: the attack's own effects land on the targets it hit, through the system's application path — Ray of Frost's slow arrives with its damage instead of waiting for a click in the card's tray. Every application leaves a receipt on the damage card with a per-effect revert.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.masteryRiders, {
    name: "Weapon Mastery Riders",
    hint: "A weapon mastery pays out with the attack that earned it. Vex and Sap apply themselves (the rules give no choice); Slow, Topple, Push and Graze are the wielder's option — see Ask First. Effects are visible chips with the rule in their description; nothing ever modifies a d20, and Cleave/Nick (extra attacks) stay native. On-hit payouts ride the damage roll wherever it came from — the resolver's auto-roll or the native Damage button. Graze alone needs the attack resolver on: a miss has no damage button to press.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.masteryAsk, {
    name: "Mastery: Ask First",
    hint: "\"Ask\" puts the optional masteries (Slow, Topple, Push, Graze) to the attacking player as a Use/Pass popup on the reaction hold's timer — players like being reminded of their options. \"Auto\" takes them silently for tables that find the popup tedious. Vex and Sap never ask; the rules make them automatic.",
    scope: "world", config: true, type: String, default: "ask",
    choices: { ask: "Ask the attacker", auto: "Take them automatically" }
  });

  // ⚠ THE CLOCK THE 2026-08-27 SWEEP COULD NOT REACH. The Vex/Sap/Cleave reminder ran on a
  // 15-second constant hardcoded in mastery.js — the last survivor of the superseded
  // 2026-08-17 era. "Every timer is 24s" was a pass over THIS FILE, and a window that was
  // never a setting was never in the pass's reach; it outlived the decision by six weeks and
  // was found from live play (Thomas's average decision time is 17.7s, Gren's 19.4s — the
  // window sat under both, so the reminder was unwinnable by design for the whole table).
  // A visible clock earns the family's own knob (the damageTimer precedent).
  game.settings.register(MODULE_ID, S.noticeTimer, {
    name: "Reminder Timer Seconds",
    hint: "How long a weapon-mastery reminder (Vex, Sap, Cleave) stays up before it dismisses itself. 0 stays until dismissed. Expiry is a NON-EVENT for Vex and Sap — the chip is already applied and the card keeps the record either way — but Cleave's reminder carries a real choice (Arm the Cleave), so the window has to be one a human can win.",
    scope: "world", config: true, type: Number, default: 24,
    range: { min: 0, max: 60, step: 1 }
  });

  game.settings.register(MODULE_ID, S.maneuverFolds, {
    name: "Maneuver Folds",
    hint: 'Post-roll maneuver folds, as "Name:kind" separated by commas. kind is "precision" (your own attack misses — the maneuver\'s die is offered, patches the total, and a hit that emerges is resolved like any other), "riposte" (an enemy\'s melee attack misses you — the reaction is offered, a real attack rolls inside the fold, and the maneuver\'s die joins its damage), "interpose" (you SAVE against a Dexterity half-damage effect holding a shield — the Reaction is offered and turns half into none), "bash" (your own listed save demand FAILS — choose the Prone press or the announced 5-foot push), or "hew" (a crit or a kill with a melee weapon — a reminder card only, nothing automated). Names must match the item on the actor; dice and costs are read from the item, never typed here. An empty list turns every fold off. Unknown kinds are ignored, never guessed.',
    // The LIST is the switch — no separate boolean, no separate timer (the folds ride the
    // hold family's clock and reveal settings). ⚠ Riposte lives HERE and must never return
    // to the Interrupt Reactions list above: the hold offers on HITS and treats unknown
    // kinds as "ac", which is exactly the mis-wiring v1.16.0 struck (an every-hit nonsense
    // hold answered with a bare 1d8). This parser is strict where that one is forgiving.
    scope: "world", config: true, type: String,
    default: LIST_SPECS.maneuverFolds.default
  });

  game.settings.register(MODULE_ID, S.d20Folds, {
    name: "D20 Folds",
    hint: 'Post-roll d20 folds, as "Lookup:kind" separated by commas. kind is "heroic" (Heroic Inspiration — a REROLL of the d20, and the new roll stands, crit and fumble included), "tactical" (Tactical Mind — 1d10 added to an ability check, spending a use of Second Wind), or "bardic" (a Bardic Inspiration die the bard gave you, added to a d20 that failed). ⚠ The first half is a LOOKUP KEY, not a display name: for "tactical" it must match the ITEM on the actor, and for "bardic" it must match the EFFECT the bard applies, which the system calls "Inspired" — the cards and popups still say "Bardic Inspiration", because that is what the feature is called. For "heroic" the lookup is unused entirely: the marker is a bare true/false on the sheet with no document behind it. Dice and costs are read from the content, never typed here. An empty list turns every d20 fold off. Unknown kinds are ignored, never guessed.',
    scope: "world", config: true, type: String,
    default: LIST_SPECS.d20Folds.default
  });

  game.settings.register(MODULE_ID, S.d20FoldAsk, {
    name: "D20 Folds: Offer Automatically",
    hint: "Where the module OWNS the number a d20 was judged against — an attack's target AC, or the DC of a save this module demanded — it can offer a fold the moment the roll fails, the way Precision Attack already does. Turn this off to make every d20 fold a button the player presses instead. ⚠ Ability and skill checks are ALWAYS player-pressed regardless of this setting: dnd5e records no DC for a raw check, so there is no number to judge a failure against and the module refuses to guess one.",
    scope: "world", config: true, type: Boolean, default: true
  });

  // Membership lives in the volley registry (volley-registry.js — finding (ff), which
  // OVERTURNS FLOW item 6's structural-only instruction by user directive 2026-08-21):
  // premium content ships its multi-projectile data too inconsistently to detect from (the
  // census: Scorching Ray bare, Eldritch Blast count "1", Dimension Door a false positive),
  // so the module tracks the few real volley spells by name, each with its own handling.
  // An unlisted spell is simply never a volley — graceful degradation, never a guess.
  game.settings.register(MODULE_ID, S.volleys, {
    name: "Volley Spells",
    hint: "Multi-projectile spells resolve as volleys: the caster gets one popup to aim every dart or ray, instead of the system rolling a single shot and forgetting the rest. Magic Missile's darts strike together — each target gets ONE aggregated damage roll (and so one concentration check). Scorching Ray's rays are separate attacks — each ray rolls its own attack at its own target through the ordinary pipeline, reactions and riders included. The window is the Damage Roll Timer; expiry fires the volley with an even spread, it never cancels. Rides the Attack Resolver's mode.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.concMode, {
    name: "Concentration Checks",
    hint: "When a concentrating creature takes damage, run the save instead of leaving the system's whisper card to be forgotten. \"Prompt\" pops the check up for whoever owns the concentrator — what hit them, for how much, the DC — with one button: Roll. \"Auto\" skips the popup and just rolls. Either way the dice land on the owning player's client when one is connected (their character, their dice), the GM's otherwise, and NPC concentrators get the identical treatment GM-side.",
    scope: "world", config: true, type: String, default: "off",
    choices: { off: "Off", prompt: "Prompt to roll", auto: "Roll automatically" }
  });

  game.settings.register(MODULE_ID, S.concTimer, {
    name: "Concentration Timer Seconds",
    hint: "How long the prompt waits before rolling the save itself. 0 waits indefinitely. Unlike the reaction hold's timer, expiry ROLLS rather than passes — a concentration save is mandatory, so the timer only ever decides who pressed the button.",
    scope: "world", config: true, type: Number, default: 24,
    range: { min: 0, max: 60, step: 1 }
  });

  game.settings.register(MODULE_ID, S.concBreak, {
    name: "Failure Breaks Concentration",
    hint: "A failed save ends concentration through the system's own path, and everything depending on it goes too — Bless strips from the whole party the moment the save is missed. The system never does this itself (a failed save changes nothing natively); this is the forgotten click the feature exists to press. Off announces the failure and leaves the ending to you.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.concVisibility, {
    name: "Concentration Checks Are Public",
    hint: "On (default): the check and the roll play out in the open — the table gets to hold its breath over the party's Bless. Off: whispered to the concentrator's owners and the GM. A BROKEN concentration is announced publicly either way — the cascade strips icons across the whole table, and an icon vanishing must never be a mystery.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.saves, {
    name: "Resolve Saving Throws",
    hint: "A save spell or ability runs its own saves: each targeted creature's save pops up on the client that owns it — the native dialog's controls (situational bonus, Advantage/Normal/Disadvantage) — and the verdict applies the consequences: the card's damage in full on a failure or per the spell's own word on a success (half, none), a failure applies the card's effects. NPCs and offline owners resolve on the GM's client; the card's native buttons keep working. Per target and independent — nobody waits on anyone else's dice. Damage application honors Auto-Apply Damage; legendary resistance overturns a folded failure, receipts and all.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.saveTimer, {
    name: "Save Timer Seconds",
    hint: "How long a prompted save waits before rolling itself. 0 waits indefinitely. Like the concentration timer — and unlike the reaction hold's — expiry ROLLS rather than passes: a demanded save is mandatory, so the timer only ever decides who pressed the button.",
    scope: "world", config: true, type: Number, default: 24,
    range: { min: 0, max: 60, step: 1 }
  });

  game.settings.register(MODULE_ID, S.castApply, {
    name: "Auto-Apply on Cast",
    hint: "A cast with no roll to gate on resolves itself: a no-save spell's effects land on every target it was aimed at (Bless on all three, Hunter's Mark's mark on the quarry), and healing rolls its dice and lands (Healing Word). Receipts with per-target revert, as everywhere. Attack spells ride the hit under Effect Riders; save spells wait for the saves phase; plain damage spells (Magic Missile) keep their manual tray — the reaction that negates them must stay answerable.",
    scope: "world", config: true, type: Boolean, default: false
  });

  game.settings.register(MODULE_ID, S.resourceNotices, {
    name: "Resource Use Notices",
    hint: "When a player character spends a limited-use ability — Second Wind, a superiority die, Channel Divinity, sorcery points, a magic item's daily cast — a big text notice flashes on every screen and fades: who used what, and how many uses remain. The usage card keeps the same line durably. Structural: anything whose uses carry a recovery rhythm (per rest, per day) announces itself; expendables with no recovery (torches, potions, rations) and spell slots stay quiet. NPC abilities never announce — monster resources are the GM's secret.",
    scope: "world", config: true, type: Boolean, default: true
  });

  // ARCHITECTURE §6 rule 5: registries are exposed READ-ONLY so tooling and the suites can
  // inspect them. Inspection, not an extension point (DESIGN §4) — hence the freeze, and hence
  // live reader FUNCTIONS rather than snapshots: a suite that flips a setting wants what the
  // module would read next, not what it read at init. ⚠ `volleyRegistry` is deliberately NOT
  // here and deliberately NOT frozen: it is a code registry the suites genuinely mutate to
  // register scratch fixtures, and volley-registry.js exposes it itself.
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { registries: Object.freeze({
    specs: LIST_SPECS,
    kindSets: KIND_SETS,
    interrupt: interruptEntries,
    block: blockEntries,
    maneuverFolds: maneuverFoldEntries,
    d20Folds: d20FoldEntries,
    rider: riderEntries,
    riderUpgrade: riderUpgradeEntries
  }) });
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
  addDivider(input(S.riders), "Hit Riders");
  addDivider(input(S.concMode), "Concentration");
  addDivider(input(S.saves), "Saving Throws");
  addDivider(input(S.volleys), "Volleys");
  addDivider(input(S.castApply), "Casts");
  addDivider(input(S.resourceNotices), "Resource Notices");
  addDivider(input(S.hideCardButtons), "Table Polish");

  const hold = input(S.reactionHold);
  const riders = input(S.riders);
  const mastery = input(S.masteryRiders);
  const conc = input(S.concMode);
  const saves = input(S.saves);
  const syncAll = () => {
    setEnabled(input(S.dramaticBeat), autoDamage?.value !== "off");
    // ⚠ TWO OWNERS since the save path joined it: the popup fires for attacks under Auto-Roll
    // Damage and for save spells and areas under Saving Throws. Greying it out on the attack
    // switch alone would leave a control that reads as inert and still fires — the "looks
    // authoritative and lies" failure the untarget checkboxes were scoped out over. Enabled
    // while EITHER path can reach it. (It stays under the Attack Resolver divider on purpose:
    // the v1.18.0 walk confirmed people find it there, and moving a control the table has just
    // learned costs more than the divider's slight inaccuracy.)
    setEnabled(input(S.playerRollDamage), (autoDamage?.value !== "off") || !!saves?.checked);
    setEnabled(input(S.damageTimer), (autoDamage?.value !== "off") || !!saves?.checked);
    for ( const key of [S.interruptList, S.blockList, S.holdReveal, S.holdTimer, S.holdSkipFutile,
      S.holdSettle, S.holdApplyEffect] )
      setEnabled(input(key), !!hold?.checked);
    for ( const key of [S.riderList, S.riderUpgrades] )
      setEnabled(input(key), !!riders?.checked);
    for ( const key of [S.masteryAsk, S.noticeTimer] )
      setEnabled(input(key), !!mastery?.checked);
    for ( const key of [S.concTimer, S.concBreak, S.concVisibility] )
      setEnabled(input(key), conc?.value !== "off");
    setEnabled(input(S.saveTimer), !!saves?.checked);
    // The volleys ride the resolver (the maneuver-folds precedent): their whole payoff is
    // driven rolls, and with the resolver off there is no path for them.
    setEnabled(input(S.volleys), autoDamage?.value !== "off");
  };
  syncAll();
  autoDamage?.addEventListener("change", syncAll);
  hold?.addEventListener("change", syncAll);
  riders?.addEventListener("change", syncAll);
  mastery?.addEventListener("change", syncAll);
  conc?.addEventListener("change", syncAll);
  saves?.addEventListener("change", syncAll);
});

/* ---------------------------------------------------------------------------------------------
 * The list settings, read and parsed. EDGE wrappers over decide/registry.js's one parser — they
 * live with the settings surface (section 8) rather than inside the feature that happens to
 * consume them, which is what D1 was about: hold.js owned two of these, and polish.js had to
 * import a FEATURE to ask what the interrupt list said.
 *
 * ⚠ ALL FIVE LIVE HERE NOW (PLAN.md Phase 3), including the two that used to sit in their own
 * machines. That is not tidiness: the warn-once bookkeeping below is the "one warn-once path"
 * the phase asks for, and a path is only one path if every list walks it. maneuvers.js had the
 * only implementation and only the folds got warned; the other four failed silently.
 *
 * ⚠ Order-neutral by construction: `settings.js` is the SECOND import in battleflow.js, ahead
 * of every machine, so maneuvers.js and hit-riders.js importing it adds no evaluation-order
 * edge — the same argument D1 made for hold.js and polish.js. Do not move this file down the
 * entry list without re-reading check-hook-order.mjs.
 * ------------------------------------------------------------------------------------------- */

/**
 * Warned chunks, by list. ⚠ A world setting is read on nearly every hook, so an unwarned parse
 * would put one line per bad entry per attack in the console — which is how a warning gets
 * ignored. Once per bad chunk per list per session, and the entry is keyed by ACTION too, so an
 * entry that changes from dropped to defaulted still says so.
 */
const warnedChunks = new Set();

/**
 * THE ONE LIST READ. Read the setting, parse against the spec, warn once per bad chunk, return
 * the entries. Every list-shaped setting in the module comes through here.
 */
function listEntries(spec) {
  const { entries, rejects } = parseList(spec, setting(S[spec.setting]));
  for ( const reject of rejects ) {
    const seen = `${spec.setting}|${reject.action}|${reject.chunk}`;
    if ( warnedChunks.has(seen) ) continue;
    warnedChunks.add(seen);
    console.warn(`${TITLE} | ${rejectMessage(spec, reject)}`);
  }
  return entries;
}

/** Which reactions interrupt an attack, and what each one changes — `{ name, kind }`. */
export function interruptEntries() {
  return listEntries(LIST_SPECS.interrupt);
}

/**
 * Which spells a reaction stops outright — `{ spell, reaction }`. Keyed by the SPELL, so one
 * reaction can appear here and in the interrupt list without the two lists having to agree
 * about anything.
 */
export function blockEntries() {
  return listEntries(LIST_SPECS.block);
}

/** Which listed feats fold into an attack after the roll, and how — `{ name, kind }`. */
export function maneuverFoldEntries() {
  return listEntries(LIST_SPECS.maneuverFolds);
}

/**
 * Which post-roll d20 folds are live, and what each one spends — `{ name, kind }`.
 *
 * ⚠ `name` is a lookup key for `tactical` (an item) and `bardic` (an effect) and a bare LABEL
 * for `heroic`, which has no document behind it at all. The spec's own comment carries the
 * measurement; this wrapper only reads the world.
 */
export function d20FoldEntries() {
  return listEntries(LIST_SPECS.d20Folds);
}

/** Which marks pay, by system identifier — `{ name }`. What they pay is read from the mark. */
export function riderEntries() {
  return listEntries(LIST_SPECS.rider);
}

/** Which of the attacker's own features replaces a mark's damage — `{ feature, rider }`. */
export function riderUpgradeEntries() {
  return listEntries(LIST_SPECS.riderUpgrade);
}

/** What kinds of source the reminder gate reads before an attack roll — `{ kind }`. */
export function reminderEntries() {
  return listEntries(LIST_SPECS.reminders);
}

/** Which rows of the condition table the gate reads, by status id — `{ kind }`. */
export function conditionEntries() {
  return listEntries(LIST_SPECS.conditions);
}
