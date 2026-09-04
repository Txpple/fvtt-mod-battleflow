# Battle Flow

**Battles, flowing.** A combat-resolution module for Foundry VTT (v14) and the dnd5e system
(5.3.x, 2024 rules). When an attack hits, the damage rolls, applies, and the effects that ride
it land. When a spell demands a save, everyone rolls. When an aura moves, the creatures inside
it feel it. The table only touches the moments that are genuinely theirs.

## The idea

The dnd5e system already knows how to do everything hard about a fight. It works out whether
an attack hits, applies damage through the right resistances, rolls real saving throws,
applies effects, and tracks concentration. The trouble is that every one of those steps ends at
a button, and somebody has to find that button in the chat log and press it. Combat slows to
the pace of the person hunting for the right card.

Battle Flow presses the buttons whose outcomes are already decided. Where a human genuinely
gets a say, it pauses and asks. Where something worth knowing happens, it says so. Everywhere
it acts, it leaves a receipt with a one-click revert. And it never removes the native buttons,
so vanilla dnd5e is always underneath and always the fallback.

**Automate outcomes, never decisions.** That is the whole rule. If the rules already determine
the result, the module does it. If judgement is involved, a person is asked.

## What it does for your table

**Attacks resolve themselves.** A hit rolls its damage and applies it to the targets it hit,
through the system's own resistance math. A miss rolls nothing. Every application is stamped on
the damage card with a per-target receipt and a revert button, so nothing is ever lost to a
misclick.

**Reactions get their window.** When a target holds Shield, Uncanny Dodge, a riposte or another
listed reaction, the chain pauses instead of applying. The reactor gets a popup with a clock.
If they do nothing, the default happens and the fight moves on. The Reaction is a chip on the
character, spent when used and back at the start of their next turn, so the window is only
offered when it is real.

**Your abilities are already accounted for.** Before an attack roll, if anything the module can
read bends it, the system's own roll dialog opens with a Battle Flow section listing every
source with its rule quoted: a condition on either side, the target being within five feet of a
prone creature, the range of a ranged attack, or a feature on either sheet by name. Innate
Sorcery, Reckless Attack, Vow of Enmity, Pack Tactics, Blur and seventy more were swept from
every official pack. The net result is the highlighted button. You still press it.

**Riders pay out with the hit.** Hunter's Mark, weapon masteries, Sneak Attack with the full
Cunning Strike menu, Divine Strike, Dreadful Strike, the Assassin's first-round dice, and other
listed features ride the damage roll when the round and the turn say they should. Each one is a
ticked checkbox on the damage offer. Untick it to keep the use. The card says what rode and why.

**Saves happen at once.** A spell that forces a save rolls it for every target, opens the
system's own Saving Throw dialog for each player with the demand and the stakes above it, and
resolves half damage on a success. Anyone who does not press in time is rolled by the buzzer.
Restrained, the Dodge action, Evasion and the conditions that fail a save outright are all read
and offered.

**Auras apply themselves.** A Paladin's Aura of Protection stands around the token wherever it
goes, and allies walking in receive the bonus with the Paladin's Charisma and lose it walking
out. Spirit Guardians halves enemy speed inside its area and demands the save when a creature
enters or ends its turn there. Foundry keeps the geometry and the clock.

**Concentration gets kept honest.** A concentration prompt cannot be buried, a failed check
actually ends the spell, and the moment a concentrator is Incapacitated the spell drops. The
system does none of these on its own.

**Everything announces itself.** A spent slot, a used reaction, an effect landing or expiring,
an automatic critical hit against a Paralyzed creature. Each one is a durable line on a card,
on every client, so an icon appearing or vanishing is never a mystery.

**And the small things.** Magic Missile, Scorching Ray and Eldritch Blast are aimed dart by dart
in one popup. No-save effects and healing apply on cast. Web's Restrained presses the standard
condition even though the pack does not carry it as an effect. Steady Aim becomes a real chip on
use.

## Why it is built this way

**New players first.** Someone who has never played 5e can take their turn. The thing they must
answer comes to them, centred, with the rule quoted from the feature's own text. They never
need to know which chat card to hunt for.

**The GM does almost nothing.** In steady state the GM answers no prompts. Every feature that
would add a recurring mandatory GM click is treated as a design mistake.

**Nothing blocks the table.** Every pause has a default outcome and a timer. A player who
stepped away does not stop the fight unless the table chooses that.

**Canon only.** The module reads amounts, dice and DCs from the content the compendia already
ship. It never stores a number of its own, never transcribes a rule, and never homebrews. When
content is wrong, the content is fixed, not the module.

**Zero dependencies, no sockets, no patching.** Clients coordinate by reading the same chat log.
Only public hooks are used. The only relationship in the manifest is a version pin on dnd5e, so
a system update can never take the module down with it silently.

**Every feature has its own switch.** There are 39 world settings and 2 client settings. All of
them ship on, and any one can be turned off mid-session without touching the others.

## Documentation

Four documents, plus **[SWEEP.md](SWEEP.md)** for the length of the abilities sweep it surveys:
the 2024 corpus sorted into the module's mechanism families, kind by kind.

- **[DESIGN.md](DESIGN.md)** is the north star. What the module is for, the four goals it exists
  to serve, what is permanently out of scope. Read it before proposing anything.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** is how the code is required to be shaped so it stays
  that way. Layers, the volunteer model, the state model, the moment spine, the registry model,
  and the checklist for adding anything.
- **[NOTES.md](NOTES.md)** is working knowledge. Every Foundry and dnd5e fact that cost a
  debugging session, plus deploy, release and test protocol.
- **[BACKLOG.md](BACKLOG.md)** is what is known and deliberately not scheduled, each with the
  reason and the thing that would change it. Nothing in it is owed.

Development tooling lives in [tools/](tools/README.md) and ships in nothing. `npm run verify`
is the offline gate: static checks plus the unit tests, in seconds. `node tools/battery.mjs` is
the live one, every suite in the order that works, each captured to a file.

## Family

Sibling of [Combat Plus](https://github.com/Txpple/fvtt-mod-combatplus). Combat Plus is combat
*UX* (music, gates, cues). Battle Flow is combat *resolution* (dice consequences). They are
separate so that dnd5e churn can never take down the initiative gate mid-campaign.

Curated content lists are swept from the official compendia, and nothing ships that has not
been played. What stays a permanent non-goal is a *platform*: no flags engine, no macro hooks,
no extension points ([DESIGN.md §4](DESIGN.md)).

## Why it is not midi-qol

If you have used Foundry for dnd5e, you know midi-qol. It is the module that automates combat,
and it is very good at it. Battle Flow exists because we wanted the same flowing fight without
the shape midi has to take to deliver it.

midi is a workflow engine. Around fifty thousand lines, its own flags platform, three hard
dependencies, and wholesale replacement of the system's document classes, pinned to each dnd5e
minor version. Its workflow runs in memory and blocks on prompts to other clients with timeouts,
which is where its race conditions come from and why it needs a large undo system. When the
system updates, midi has to move with it, and until it does the table waits.

Battle Flow takes a different bet. The system has become good enough that a small module can
orchestrate its public hooks directly, without patching anything. There is no in-memory
workflow to fall out of sync, because the chat log is the state and every client reads the same
one. There is no undo system, because each application carries its own revert receipt. There is
no flags platform or macro hook, because every ability the module knows about is a row in a
curated list swept from the official packs. A few thousand lines cover the chain that consumes
table time, and the rest is left to the humans at the table.

That means there are things midi does that Battle Flow will never do, on purpose. It does not
auto-cast reactions, detect opportunity attacks, measure cover or line of sight, manage
template targets, run macros, or offer an extension point for homebrew. Those are judgement
calls or platforms, and the module's answer to both is the same: ask a person, or add a row to
a list. The full list of what is refused and why is in [DESIGN.md §4](DESIGN.md).

The trade is fewer features for a module that is small enough to read, cannot be taken down by
a system update it did not see coming, and never plays a decision for you.

## License

MIT
