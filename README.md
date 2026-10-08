# Open Roll 5e: Battle Flow

[![verify](https://github.com/Txpple/fvtt-mod-battleflow/actions/workflows/verify.yml/badge.svg)](https://github.com/Txpple/fvtt-mod-battleflow/actions/workflows/verify.yml)
[![release](https://github.com/Txpple/fvtt-mod-battleflow/actions/workflows/release.yml/badge.svg)](https://github.com/Txpple/fvtt-mod-battleflow/actions/workflows/release.yml)

A Foundry VTT module for the dnd5e system that automates combat under the D&D 5e 2024 rules. When
an attack hits, the damage rolls and applies. When a spell demands a save, everyone rolls. When a
reaction could change the outcome, the player gets a popup with a timer. Every automatic action
leaves a receipt with a one-click revert. It exists to help new players keep track of the rule
details of 5e (weapon masteries, maneuvers, reactions, the small rules that are easy to forget)
and to take routine steps off experienced players. It is one module with no dependencies beyond
the system.

## Status

**Usable now, and in use at our own table.** Every book is built; the walks, playing each rule at
the table, are what remains before 3.0.

| Built | Next |
| --- | --- |
| The combat chain: hit, damage, apply, reactions, saves, concentration, auras, cover | The walks: each built rule played at the table, book by book |
| The Player's Handbook: every species, feat, fighting style, class and subclass feature, and spell that touches a fight | The rows that wait for a first customer (the rare shapes no table has needed yet) |
| The Dungeon Master's Guide: the crit riders and the enchanted weapons | Summons and Wild Shape ([#1](https://github.com/Txpple/fvtt-mod-battleflow/issues/1), [#2](https://github.com/Txpple/fvtt-mod-battleflow/issues/2)) |
| The Monster Manual: Magic Resistance, Undead Fortitude, Regeneration, the auras, the reactions | The epic boons |
| Heroes of Faerûn, Arcana Unleashed, Ravenloft: The Horrors Within | |
| Ten settings; every feature always on | |

Nothing is finished until it has been played. What is in works; what is not in yet is simply left
to the table, the way vanilla dnd5e does.

## How it works

- **Zero dependencies, no patching.** Public hooks and document writes only. The chat log is the
  state: every client reads the same one, so there is nothing in memory to fall out of sync and
  a reload loses nothing.
- **Canon only.** Every number, die and DC is read from the content the compendia ship. The
  module never stores an amount and never homebrews. When content is wrong, fix the content.
- **Automate outcomes, never decisions.** If the rules settle it, the module does it. If a
  person gets a say, a person is asked, with a default and a clock.
- **The system stays underneath.** The card buttons the module takes over are hidden so there
  is one path; the system's damage tray, refund and revert stay.
- **Combat Plus and FX Studio are separate modules on purpose.** Battle Flow resolves the fight;
  Combat Plus does the chores around it and FX Studio plays the pictures. Each detects the others
  and none requires another, so a dnd5e update can never take all three down.

## Installation

Paste the manifest URL into Foundry's *Install Module* dialog:

```
https://github.com/Txpple/fvtt-mod-battleflow/releases/latest/download/module.json
```

- Foundry VTT 14.
- dnd5e 6.x (2024 rules). v1.42.0 is the last release for dnd5e 5.3.x.
- No other modules. No libWrapper, no socketlib, no DAE.
- The free 2024 rules that ship with dnd5e are enough. The premium Player's Handbook, Dungeon
  Master's Guide and Monster Manual unlock everything the free rules leave out; Heroes of Faerûn,
  Arcana Unleashed and Ravenloft: The Horrors Within are read when installed.
- A GM must be logged in. The GM's client is the one that applies damage and effects.

## What it does

- **Attacks resolve.** A hit rolls damage and applies it through the system's own resistance
  math. A miss rolls nothing. Every application is stamped on the card with a revert button.
- **Reactions get a window.** Shield, Uncanny Dodge, Parry, Warding Flare and other listed
  reactions pause the chain and ask the player. The popup shows the rule from the book and a
  timer. No answer means the default happens and the fight moves on.
- **Saves happen at once.** A save spell rolls for every target on the owning player's client,
  half damage on a success, and the buzzer rolls for anyone who walks away. A spell that lets the
  target repeat the save (Hold Person, Tasha's Hideous Laughter, Slow, Fear, Flesh to Stone and
  their kin) asks again at the end of its turn, or when it takes damage, and ends the effect on a
  success with a line on the card.
- **Your abilities are already accounted for.** Before a roll, the dialog lists everything the
  module can read that changes it: a condition, a feat, a fighting style, cover, an ally beside
  the target. Riders like Sneak Attack, Hunter's Mark and weapon masteries ride the damage as
  ticked boxes.
- **Cover is measured for you.** Select your token and hover another: a Cover section at the
  top of its card says No Cover, Half (+2 AC), Three-Quarters (+5 AC) or Total, and what is in
  the way. It uses the 2024 DMG grid method, lines from a corner of your space to the corners of
  the target's, walls and creatures counted. When you attack, the same measure applies to the
  target's AC on its own, and the card says so. Sharpshooter and Spell Sniper take it off.
- **Auras work.** A Paladin's Aura of Protection follows the token; allies get the bonus
  walking in and lose it walking out. Spirit Guardians and friends do the same with their saves,
  and so do the areas you place and drag: Moonbeam, Cloudkill, Cloud of Daggers.
- **Sanctuary and Mirror Image play themselves.** Whoever targets a warded creature saves first,
  and a failed save turns the attack aside before it rolls. A hit on a mirrored creature rolls a
  d6 per duplicate off the token; a 3 or higher and a duplicate takes it.
- **The odd spells too.** Warding Bond hands the caster the same damage. Vampiric Touch heals
  half of what landed. Prismatic Spray rolls its d8 per creature and raises a save per ray. Wall
  of Fire burns on the side you pick, Spike Growth charges for every 5 feet walked through it,
  and Magic Circle and Forcecage say so when a creature crosses their line. Every PHB spell is
  accounted for in [the register](audits/spells-register.md).
- **Concentration is kept honest.** A failed check ends the spell. Incapacitated drops it.
- **Everything announces itself.** Spent slots, used reactions, effects landing and expiring, a
  crit against a paralyzed creature. Each is a line on a card so nothing is a mystery.
- **Players can see their buffs.** An effect bar above the hotbar, hover cards on any token, and
  Alt to see everyone's.

## The trade

Battle Flow is built to be **easy to run**, not to be configured. That is a deliberate trade
against midi-qol.

| | Battle Flow | midi-qol stack |
| --- | --- | --- |
| Install | one module | midi + DAE + premades + their dependencies |
| Settings | ten | hundreds |
| Homebrew hooks, macros, custom flags | none | extensive |
| Coverage | the official 2024 books, growing | nearly everything, if you set it up |
| Surviving a dnd5e update | public hooks only, nothing patched | waits for each module to catch up |

If you want to shape every part of your automation, midi-qol is built for that. If you want to
install one thing and play, this is for you.

**What it will not do, on purpose:** auto-cast reactions, detect opportunity attacks, pick
targets for area spells, run macros, or offer an extension point for homebrew. Those are
judgement calls or platforms. The answer to both is the same: ask a person, or add a row to a
list. The full list and the reasons are in [DESIGN.md §4](DESIGN.md).

## Settings

*Game Settings → Configure Settings → Open Roll 5e: Battle Flow.*

| Setting | Scope | What it does |
| --- | --- | --- |
| Decision Timer Seconds | world | How long every question waits. 0 waits forever. A required roll rolls itself when time is up; an optional offer passes. |
| Dramatic Beat Before Damage | world | Seconds between the hit and the damage dice. |
| Players Roll Their Own Saves | world | Prompt the owning player, or roll automatically. |
| Concentration Checks Are Public | world | Open, or whispered to the owner and GM. |
| Hold Shows the Math | world | A held reaction shows the attack total against AC, or (rules as written) only that you were hit. |
| Optional Masteries | world | Ask before Slow, Topple, Push and Graze, or take them automatically. |
| Resource Use Notices | world | Flash a notice when a player spends a limited-use ability. |
| Roll Your Own Damage | client | Ask before rolling your damage instead of rolling it for you. |
| Effect Bar | client | The buff and debuff strip above the hotbar. |
| Effect Cards on Hover and Alt | client | Effect cards beside any token you point at. |

Every feature is always on. There is no per-feature switch. A table that wants one wants midi.

## Documentation

- [DESIGN.md](DESIGN.md): what the module is for and what it refuses. Start here.
- [RULINGS.md](RULINGS.md): what each feature does, as decided at the table.
- [ARCHITECTURE.md](ARCHITECTURE.md): how the code is shaped and why.
- [NOTES.md](NOTES.md): Foundry and dnd5e facts that cost a debugging session.
- [BACKLOG.md](BACKLOG.md): known and deliberately not scheduled.
- [SWEEP.md](SWEEP.md): the 2024 content sorted by mechanism.

## Development

There is no build step: the module is plain ES modules loaded straight from `scripts/`. Dev
tooling is in [tools/](tools/README.md) and ships in nothing. `npm run verify` runs the static
checks and unit tests in seconds; the live battery runs against a real Foundry world. The
`verify` workflow runs the offline gate on every push, and the `release` workflow builds and
publishes the GitHub release, zip and manifest together, from a `vX.Y.Z` tag.

<!-- openroll5e:family -->
## Part of Open Roll 5e

Battle Flow is one of the Open Roll 5e modules for Foundry VTT, a suite built for one D&D 5e table and
shared. Each module installs and works on its own and none needs another; together they cover the
table from the fog of war to the loot. The other modules:

- [Open Roll 5e: Autoexplore](https://github.com/Txpple/fvtt-mod-autoexplore): lets a scene start fully explored, so the whole map shows through the fog of war while tokens still need line of sight.
- [Open Roll 5e: Combat Plus](https://github.com/Txpple/fvtt-mod-combatplus): automates the chores of running a fight: combat music, an initiative gate, an out-of-turn movement block, defeated marking at 0 HP and turn alerts.
- [Open Roll 5e: Errata](https://github.com/Txpple/fvtt-mod-errata5e): corrects, in memory, bugs in the premium D&D 2024 books, the dnd5e system and Foundry itself, each fix held until the vendor ships its own.
- [Open Roll 5e: FX Studio](https://github.com/Txpple/fvtt-mod-fxstudio): visual and sound effects for dnd5e, played from what actually happened at the table, with about a thousand stock FX and a window for authoring your own.
- [Open Roll 5e: Loot Shelf](https://github.com/Txpple/fvtt-mod-lootshelf): loot chests and merchant shelves that players can take from, buy from and sell to without owning them, with a receipt for every trade.
- [Open Roll 5e: Open Server](https://github.com/Txpple/fvtt-mod-openserver): for hosted worlds: clears the startup pause so players can play before the GM arrives, and gives any user a landing scene of their own.
- [Open Roll 5e: Party Stash](https://github.com/Txpple/fvtt-mod-partystash): makes a dnd5e Group actor's inventory a working party stash: drags move instead of copying, coin moves through a dialog, and every transfer posts a receipt.
- [Open Roll 5e: Soundscape](https://github.com/Txpple/fvtt-mod-soundscape): background sound for scenes: random one-shots with silence between them, seamless crossfaded loops, day and night gating, and quiet during combat.

Three MCP servers for [Claude Code](https://claude.com/claude-code) complete the suite:

- [fvtt-mcp-dnd5e](https://github.com/Txpple/fvtt-mcp-dnd5e): builds D&D 5e content in a live Foundry world from Claude Code: a stat block becomes a complete NPC, a map image a walled and lit scene, an adventure its journals, tables and handouts.
- [fvtt-mcp-imagegen](https://github.com/Txpple/fvtt-mcp-imagegen): makes the art with Google's Gemini image models: icons, tokens, props, portraits, illustrations and battlemap restyles, grounded in what the world already shows.
- [fvtt-mcp-sessionscribe](https://github.com/Txpple/fvtt-mcp-sessionscribe): turns a session's Discord recording and Foundry chat log into its record. Its end-to-end `session-scribe` skill drives the server from the Craig link to a speaker-labelled transcript, a fully illustrated player recap, combat statistics, GM notes and a party snapshot.

Issues are welcome on every repo in the family; pull requests are not accepted, since each is one
author's design for one table, shared because it might suit yours. How they fit together is mapped in [fvtt-suite-openroll5e](https://github.com/Txpple/fvtt-suite-openroll5e).
<!-- /openroll5e:family -->

## License

MIT. See [LICENSE](LICENSE).
