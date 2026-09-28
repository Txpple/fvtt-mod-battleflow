# Battle Flow

Battle Flow is a combat automation module for D&D 5e (2024 rules) on Foundry VTT. It is one
module with no dependencies beyond the dnd5e system.

It exists to help new players keep track of the rule details of 5e: weapon mastery reminders
and automation, maneuvers, reactions, and the other small rules that are easy to forget. It also
takes routine steps off experienced players.

What it does: when an attack hits, the damage rolls and applies. When a spell demands a save,
everyone rolls. When a reaction could change the outcome, the player gets a popup with a timer.
Every automatic action leaves a receipt with a one-click revert.

## Status

**Usable now, and in nightly use at our own table.** It is not finished. The plan is core rules
first, supplemental books later.

| Done | Next |
| --- | --- |
| The combat chain: hit, damage, apply, reactions, saves, concentration, auras, cover | Spells (the PHB spell list, beyond the ones already in) |
| Every Player's Handbook species and origin feat | More classes and subclasses |
| Every Player's Handbook general feat that touches a fight | The Monster Manual (traits like Magic Resistance, Undead Fortitude, Regeneration) |
| Fighting styles, weapon masteries, Battle Master maneuvers, Sorcerer metamagic | Supplemental books, after the core three |
| Ten settings; every feature always on | |

Nothing ships until it has been played. What is in works; what is not in yet is simply left to
the table, the way vanilla dnd5e does.

## Requirements

- Foundry VTT 14
- dnd5e 6.x (2024 rules). v1.42.0 is the last release for dnd5e 5.3.x.
- No other modules. No libWrapper, no socketlib, no DAE.
- The free 2024 rules that ship with dnd5e are enough. The premium Player's Handbook, Monster
  Manual and Dungeon Master's Guide unlock everything the free rules leave out.
- A GM must be logged in. The GM's client is the one that applies damage and effects.

Install with the manifest URL:

```
https://github.com/Txpple/fvtt-mod-battleflow/releases/latest/download/module.json
```

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
  walking in and lose it walking out. Spirit Guardians and friends do the same with their saves.
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

## How it is built

- **Zero dependencies, no patching.** Public hooks and document writes only. The chat log is the
  state: every client reads the same one, so there is nothing in memory to fall out of sync and
  a reload loses nothing.
- **Canon only.** Every number, die and DC is read from the content the compendia ship. The
  module never stores an amount and never homebrews. When content is wrong, fix the content.
- **Automate outcomes, never decisions.** If the rules settle it, the module does it. If a
  person gets a say, a person is asked, with a default and a clock.
- **The system stays underneath.** The card buttons the module takes over are hidden so there
  is one path; the system's damage tray, refund and revert stay.

## Documentation

- [DESIGN.md](DESIGN.md): what the module is for and what it refuses. Start here.
- [RULINGS.md](RULINGS.md): what each feature does, as decided at the table.
- [ARCHITECTURE.md](ARCHITECTURE.md): how the code is shaped and why.
- [NOTES.md](NOTES.md): Foundry and dnd5e facts that cost a debugging session.
- [BACKLOG.md](BACKLOG.md): known and deliberately not scheduled.
- [SWEEP.md](SWEEP.md): the 2024 content sorted by mechanism.

Dev tooling is in [tools/](tools/README.md) and ships in nothing. `npm run verify` runs the
static checks and unit tests in seconds; the live battery runs against a real Foundry world.

## Family

Sibling of [Combat Plus](https://github.com/Txpple/fvtt-mod-combatplus), which does combat UX
(music, gates, cues). Battle Flow does combat resolution. They are separate so a dnd5e update can
never take both down.

## Contributing

This is one author's design for how a 2024 fight should run, built for one table and shared
because it might suit yours. It is public so you can read it and use it. Issues and pull
requests are not accepted.

## License

MIT
