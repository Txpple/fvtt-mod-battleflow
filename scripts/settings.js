/**
 * Battle Flow — the ten settings (ARCHITECTURE §8): seven world configs for the DM, three per-client
 * preferences. Everything else is the module itself and always on.
 */
import { MODULE_ID, S } from "./core.js";
import { KIND_SETS, interruptEntries, blockEntries, maneuverFoldEntries, d20FoldEntries,
  riderEntries, riderUpgradeEntries } from "./decide/registry.js";
import { listenOnce } from "./dispatch.js";

listenOnce("init", "settings", () => {
  game.settings.register(MODULE_ID, S.decisionTimer, {
    name: "Decision Timer Seconds",
    hint: "How long every question the module asks waits for its answer: a reaction to a hit, an offered damage roll, a save or concentration check, a mastery or maneuver offer, a reminder. 0 waits indefinitely. A mandatory roll ROLLS when it runs out; an optional offer PASSES. A draining bar shows the time left on the popup and the card.",
    scope: "world", config: true, type: Number, default: 24,
    range: { min: 0, max: 60, step: 1 }
  });

  game.settings.register(MODULE_ID, S.dramaticBeat, {
    name: "Dramatic Beat Before Damage",
    hint: "Seconds between the hit reveal and the damage dice hitting the table. 0 rolls immediately.",
    scope: "world", config: true, type: Number, default: 0,
    range: { min: 0, max: 10, step: 0.5 }
  });

  game.settings.register(MODULE_ID, S.saveRolls, {
    name: "Players Roll Their Own Saves",
    hint: "\"Prompt\": a saving throw the module demands, and a concentration check, pops up for whoever owns the creature, with the native dialog's controls and one button: Roll. \"Roll automatically\": no popup; the dice roll at once. Either way the dice land on the owning player's client when one is connected, the GM's otherwise.",
    scope: "world", config: true, type: String, default: "prompt",
    choices: { prompt: "Prompt to roll", auto: "Roll automatically" }
  });

  game.settings.register(MODULE_ID, S.concVisibility, {
    name: "Concentration Checks Are Public",
    hint: "On: the check and the roll play out in the open. Off: whispered to the concentrator's owners and the GM. A BROKEN concentration is announced publicly either way: the effects it ends vanish from the whole table.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.holdReveal, {
    name: "Hold Shows the Math",
    hint: "On: a held reaction shows the attack total against the AC, and whether the reaction would turn it into a miss; a reaction that cannot change the outcome is never offered. Off (RAW): the player is told only that they were hit, and reacts on faith.",
    scope: "world", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.masteryAsk, {
    name: "Optional Masteries",
    hint: "\"Ask\" puts the optional masteries (Slow, Topple, Push, Graze) to the attacking player as a Use/Pass popup. \"Take them automatically\" takes them without asking. Vex and Sap never ask; the rules make them automatic.",
    scope: "world", config: true, type: String, default: "ask",
    choices: { ask: "Ask the attacker", auto: "Take them automatically" }
  });

  game.settings.register(MODULE_ID, S.resourceNotices, {
    name: "Resource Use Notices",
    hint: "When a player character spends a limited-use ability (Second Wind, a superiority die, Channel Divinity, a magic item's daily cast), a notice flashes on every screen: who used what, and how many uses remain. The usage card keeps the same line. Expendables with no recovery and spell slots stay quiet; NPC abilities never announce.",
    scope: "world", config: true, type: Boolean, default: true
  });

  // ⚠ Per-CLIENT and ON by default, or every new login starts wrong. Covers all three damage paths.
  game.settings.register(MODULE_ID, S.playerRollDamage, {
    name: "Roll Your Own Damage",
    hint: "Ask before rolling YOUR damage, instead of the automation rolling it for you: a popup with one button and a timer, on your client alone. It covers an attack that hits, a save spell, and an area. The dice roll exactly as the automation would have rolled them, and the timer rolls for you if you miss the window. Your client only.",
    scope: "client", config: true, type: Boolean, default: true
  });

  game.settings.register(MODULE_ID, S.effectBar, {
    name: "Effect Bar",
    hint: "A strip above the hotbar listing the buffs and debuffs on the token you control (or your own character): every temporary effect on the sheet, including the ones that paint no icon on the token. Your client only.",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => Hooks.callAll(`${MODULE_ID}.effectViewChanged`)
  });

  game.settings.register(MODULE_ID, S.effectHover, {
    name: "Effect Cards on Hover and Alt",
    hint: "Point at any token to see its buffs and debuffs beside it; hold Alt (Foundry's highlight key) to see every creature's list at once. Your client only.",
    scope: "client", config: true, type: Boolean, default: true
  });

  // Registries READ-ONLY for the suites (ARCHITECTURE §6), as live readers. ⚠ `volleyRegistry` is
  // absent on purpose: the suites mutate it, and volley-registry.js exposes it.
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { registries: Object.freeze({
    kindSets: KIND_SETS,
    interrupt: interruptEntries,
    block: blockEntries,
    maneuverFolds: maneuverFoldEntries,
    d20Folds: d20FoldEntries,
    rider: riderEntries,
    riderUpgrade: riderUpgradeEntries
  }) });
});
