/**
 * Battle Flow — Settings registration and the settings-sheet polish (dividers, dependent grey-out).
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, S, setting } from "./core.js";

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
  // now" — recorded as one in design.md's Per-client section. v1.9.5 DELETED `saveAutoRoll`,
  // whose shape was "the POPUP is the default, the opt-out is silent auto-roll"; this is that
  // mirrored, and it exists because a player asked for their own dice back (FLOW item 3).
  // Default OFF for the reason centerRollDialogs records the other way round: a per-client
  // setting nobody knows to look for means every new login starts wrong — so the safe default
  // is the one that changes nothing until you go find it, and the patch notes carry the pointer.
  // The window is the family's 15s and carries NO setting of its own: one switch, not two.
  game.settings.register(MODULE_ID, S.playerRollDamage, {
    name: "Roll Your Own Damage",
    hint: "When your attack hits, ask before rolling the damage: a popup with one button and a 15-second timer, on your client alone. Press it and the dice roll exactly as the automation would have rolled them — same damage, same crit, same everything downstream — and the buzzer rolls for you if you miss the window, so a missed popup can never stall the table. The popup also says when the hit was a CRITICAL. Per player: this affects your own client only, and it is OFF unless you turn it on.",
    scope: "client", config: true, type: Boolean, default: false
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
    hint: 'Which reactions pause the chain, as "Name:kind" separated by commas. kind is "ac" (raises AC — the hold re-tests the attack against the new AC, and crits skip the pause since a natural 20 hits regardless) or "damage" (reduces damage — the hold pauses and announces; the reduction itself stays a human call). Names must match the item on the actor. See REACTIONS.md for the full survey.',
    scope: "world", config: true, type: String,
    default: "Shield:ac, Absorb Elements:damage, Uncanny Dodge:damage, Defensive Duelist:ac, "
      + "Illusory Self:ac, Glorious Defense:ac, Parry:ac, Counterattack:ac, Defensive Stance:ac, "
      + "Riposte:ac, Whirlwind of Sand:ac, Deflect Attacks:damage, Stone's Endurance:damage"
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
    scope: "world", config: true, type: String, default: "Magic Missile:Shield"
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
    hint: "How long a held player has to answer before the hold passes itself and the attack resolves. 0 waits indefinitely — human-paced, and correct for a thoughtful table. A draining bar shows the time left on both the popup and the card.",
    // Default 15 since v1.11.0 (user call 2026-08-17: every timer defaults to 15s) — a
    // popup that can pass itself needs a window a human at a watched window can win.
    scope: "world", config: true, type: Number, default: 15,
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
    default: "hunters-mark, hex, great-old-one-hex"
  });

  game.settings.register(MODULE_ID, S.riderUpgrades, {
    name: "Rider Upgrades",
    hint: 'Features that REPLACE a mark\'s damage, as "feature:mark" identifier pairs. The Ranger\'s level-20 Foe Slayer makes Hunter\'s Mark a d10 instead of a d6 — and like the mark itself, how much is read from the feature\'s own bonus-damage activity rather than typed here.',
    scope: "world", config: true, type: String, default: "foe-slayer:hunters-mark"
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

  game.settings.register(MODULE_ID, S.concMode, {
    name: "Concentration Checks",
    hint: "When a concentrating creature takes damage, run the save instead of leaving the system's whisper card to be forgotten. \"Prompt\" pops the check up for whoever owns the concentrator — what hit them, for how much, the DC — with one button: Roll. \"Auto\" skips the popup and just rolls. Either way the dice land on the owning player's client when one is connected (their character, their dice), the GM's otherwise, and NPC concentrators get the identical treatment GM-side.",
    scope: "world", config: true, type: String, default: "off",
    choices: { off: "Off", prompt: "Prompt to roll", auto: "Roll automatically" }
  });

  game.settings.register(MODULE_ID, S.concTimer, {
    name: "Concentration Timer Seconds",
    hint: "How long the prompt waits before rolling the save itself. 0 waits indefinitely. Unlike the reaction hold's timer, expiry ROLLS rather than passes — a concentration save is mandatory, so the timer only ever decides who pressed the button.",
    scope: "world", config: true, type: Number, default: 15,
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
    scope: "world", config: true, type: Number, default: 15,
    range: { min: 0, max: 60, step: 1 }
  });

  game.settings.register(MODULE_ID, S.castApply, {
    name: "Auto-Apply on Cast",
    hint: "A cast with no roll to gate on resolves itself: a no-save spell's effects land on every target it was aimed at (Bless on all three, Hunter's Mark's mark on the quarry), and healing rolls its dice and lands (Healing Word). Receipts with per-target revert, as everywhere. Attack spells ride the hit under Effect Riders; save spells wait for the saves phase; plain damage spells (Magic Missile) keep their manual tray — the reaction that negates them must stay answerable.",
    scope: "world", config: true, type: Boolean, default: false
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
  addDivider(input(S.riders), "Hit Riders");
  addDivider(input(S.concMode), "Concentration");
  addDivider(input(S.saves), "Saving Throws");
  addDivider(input(S.castApply), "Casts");
  addDivider(input(S.hideCardButtons), "Table Polish");

  const hold = input(S.reactionHold);
  const riders = input(S.riders);
  const mastery = input(S.masteryRiders);
  const conc = input(S.concMode);
  const saves = input(S.saves);
  const syncAll = () => {
    setEnabled(input(S.dramaticBeat), autoDamage?.value !== "off");
    setEnabled(input(S.playerRollDamage), autoDamage?.value !== "off");
    for ( const key of [S.interruptList, S.blockList, S.holdReveal, S.holdTimer, S.holdSkipFutile,
      S.holdSettle, S.holdApplyEffect] )
      setEnabled(input(key), !!hold?.checked);
    for ( const key of [S.riderList, S.riderUpgrades] )
      setEnabled(input(key), !!riders?.checked);
    setEnabled(input(S.masteryAsk), !!mastery?.checked);
    for ( const key of [S.concTimer, S.concBreak, S.concVisibility] )
      setEnabled(input(key), conc?.value !== "off");
    setEnabled(input(S.saveTimer), !!saves?.checked);
  };
  syncAll();
  autoDamage?.addEventListener("change", syncAll);
  hold?.addEventListener("change", syncAll);
  riders?.addEventListener("change", syncAll);
  mastery?.addEventListener("change", syncAll);
  conc?.addEventListener("change", syncAll);
  saves?.addEventListener("change", syncAll);
});

