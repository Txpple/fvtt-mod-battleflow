# Battle Flow

**Battles, flowing.** Attack → hit → damage → save → effect resolves itself, and the table only
touches the moments that are theirs.

A house combat-resolution module for Foundry VTT (v14) + dnd5e (5.3.x, 2024 rules). The system
already owns all the math — hit determination, resistance-correct damage, real saves, effect
application, concentration — but every link ends at a button. Battle Flow presses the buttons
whose outcomes are already determined, pauses at the moments a human gets a say, announces what
matters, and leaves a receipt (with a revert) everywhere it acts. The native buttons are never
removed — vanilla stays the substrate and the fallback.

**Zero dependencies. No sockets. No patching.** Clients coordinate by reading the same chat
log, not by messaging each other; the only `relationships` entry is a version pin on dnd5e.

## Built so far

Every feature is behind its own world setting and ships **off** — 30 world settings and 2 client
settings at v1.20.0. The dogfood ladder is walked one setting at a time.

| | Feature |
| --- | --- |
| **Attack resolver** | auto-roll damage on hit, auto-apply to the targets it hit, revert receipts on every application |
| **Reaction hold** | a Shield-window pause with popup + card row — on a hit **or** on a listed spell, so Magic Missile really is stopped |
| **Damage riders** | a mark pays out with the attack that earned it (Hunter's Mark tier) |
| **Effect & mastery riders** | a hit applies the effects riding it; weapon masteries pay out with the attack — Vex/Sap automatic, Slow/Topple/Push/Graze as a Use/Pass ask. The chips expire on Foundry's own clock at the turn the rules name, Vex and Sap are spent by the next attack roll (recorded on the attack card), and Cleave's once-per-turn is a chit, not a memory |
| **The gate before the roll** | when something the module can read bends an attack roll — your own Vex on the target, a Sap on you, Prone on either side (the 5-foot rule, judged in feet whatever the scene's units), any of the thirteen 2024 conditions or Hiding, a ranged attack's own range (beyond normal, beyond long, an enemy within 5 feet), or an ability on either sheet by name (Innate Sorcery, Reckless, Blur, Vow of Enmity, Pack Tactics and seventy more from a scan of every pack; the ones the rules spend on the next attack, like Guiding Bolt, are spent by the roll) — the system's own Attack Roll dialog opens, even on a shift-click, with a Battle Flow section in it: one header line ("2 Modifiers — Net" and the net as a coloured tag: green Advantage, red Disadvantage, grey Normal), then a box per source with its rule quoted. The net is the highlighted button; Advantage and Disadvantage cancel, however many of each. The section follows the dialog's own dropdowns. You press; nothing is applied for you. Three lists switch it: Reminder Sources (the kinds), Condition Sources (which conditions) and Effect Sources (which abilities) |
| **Maneuver folds** | Precision Attack patches a declared miss, Riposte drives a real attack, Interpose and the Shield Master bash resolve post-verdict |
| **Saves** | auto-roll for everyone, per-target popups, half-damage-on-save made real, template containment |
| **Concentration assist** | an un-buryable prompt, and a failed save actually ends the spell — which the system never does itself |
| **Cast slice** | no-save effects and healing apply on cast |
| **The automatic Critical Hit** | a hit within 5 feet of a Paralyzed or Unconscious creature rolls critical damage whatever the d20 said — the glossary's own clause, applied at every path that rolls the damage, and the card says why |
| **Volleys** | Magic Missile / Scorching Ray / Eldritch Blast / Steel Wind Strike aimed dart-by-dart in one popup — and for rays, the gate judges each ray at the aim (folded to its header line; the mode defaults to the net; a Sap or Vex is spent by the first ray that uses it and shown on that row alone) |
| **Resource notices** | a spend announces itself, on every client, with a durable card line |

## Documentation

Four documents, and only four.

- **[DESIGN.md](DESIGN.md)** — the north star. What the module is for, the four goals it exists
  to serve, what is permanently out of scope. Stable; read it before proposing anything.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the code is required to be shaped so it stays
  that way. Layers, the volunteer model, the state model, the moment spine, the registry model,
  and the checklist for adding anything.
- **[NOTES.md](NOTES.md)** — working knowledge. Every Foundry and dnd5e fact that cost a
  debugging session, plus deploy/release/test protocol. Not binding, just expensive.
- **[BACKLOG.md](BACKLOG.md)** — known and deliberately not scheduled, each with the reason and
  the thing that would change it. ⚠ **Nothing in it is owed** — it exists so that "we looked at
  this and decided not to" stops being read as a to-do list. Read it when you are picking work.

Development tooling lives in [tools/](tools/README.md) and ships in nothing. The short version:
`npm run verify` is the offline gate (static checks plus the unit tests, all offline, all in
seconds — it prints its own tallies, so do not carry them into prose),
and `node tools/battery.mjs` is the live one — every suite, in the order that works, each
captured to a file.

## Family

Sibling of [Combat Plus](https://github.com/Txpple/fvtt-mod-combatplus) — Combat Plus is combat
*UX* (music, gates, cues); Battle Flow is combat *resolution* (dice consequences). Separate so
dnd5e churn can never take down the initiative gate mid-campaign.

Curated content lists are swept from the official compendia, and nothing ships that has not been
played. What stays a permanent non-goal is a *platform*: no flags engine, no macro hooks, no
extension points ([DESIGN.md §4](DESIGN.md)).

## License

MIT
