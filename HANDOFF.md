# HANDOFF.md — picking this up cold

> Written 2026-08-15 at the end of the first build stretch. Read [design.md](design.md)
> first — it is binding and wins every disagreement. This file is only *where things stand*
> and *what already bit us*. Delete or rewrite it freely; it is a snapshot, not a contract.

## Where things stand

**Shipped and live** in *The Broken Heart of Greenrest* (Foundry 14.364 + dnd5e 5.3.3,
Molten-hosted). Latest release **v1.1.7**, installed and enabled, tag pushed, GitHub release
carries zip + manifest. **The box now tracks the GitHub manifest** (repointed 2026-08-15 —
the self-hosted dev manifest and zip are gone), so the process vends the real version string.

| Phase | State |
| --- | --- |
| 0 — native settings | **The user's to do**, at the table. Not code. |
| 1 — attack resolver | ✅ shipped. Auto-roll damage on hit, auto-apply via GM elect, receipts + revert. |
| 1.1 — dogfood polish | ✅ shipped. Tray auto-collapse, require-target gate, usage-card suppression, centered roll dialogs. |
| 1.5 — reaction hold | ✅ shipped, **actively being dogfooded** with Tom playing Gren (Shield). |
| 2 — saves | ⬜ next, unless the user redirects. |
| 2.5 — concentration | ⬜ has a queued user request (below). |
| 3 — effect application | ⬜ two open items depend on it. |

**Live settings as left**: auto-damage **`all`** (set 2026-08-15 to dogfood the PC side —
`pc` isolates it), auto-apply on, dramatic beat 3s, suppress attack cards on, require target
on, reaction hold on, apply-reaction-effect on, hold settle 8s, hold reveal off.

## Open items

1. **The hold's UI is settled and shipped** (user calls, 2026-08-15) — recorded because it is
   binding on anything built next: **the popup decides, the card watches, the card is public
   so the table sees the moment.** One card shape (`bfCard`) for everything the module says
   out loud; the card carries no answer controls where popups are on, only an *Answer* button
   that calls a dismissed popup back. ⚠ Never give one decision two live controls — that is
   how the card and popup got out of step. Look-and-feel is still being tuned against
   screenshots from real play; expect wording and density to move.
2. **The hold has no timer.** design.md §4.3 and Phase 1.5 both spec one — a world setting
   (off, or N seconds), a pure-CSS draining bar in popup and card, the continuing client as
   the one authoritative clock, resume-on-reload from the message timestamp, and auto-continue
   as Pass at the buzzer. **None of it is built**; there is no `holdTimer` setting in the code.
   Asked after live play, so it is wanted.
3. **The PC-attacker path is untested at the table** (v1.1.3 opened it). The harness covers the
   actor-type gate but runs as a GM, so it cannot BE a player client. Untested for real:
   a player's client stamping a hold on its own attack message, and then driving that hold's
   continuation. The known thin spot is `continueHold`'s effect safety net — it is guarded by
   `actor.isOwner`, so on a PC attack it no-ops for monster targets and the monster side rests
   entirely on the answering GM. Monster reactions ship their effects **disabled**.
4. **Usage-card suppression vs effects — partially fixed.** Cards carrying effects are now
   never suppressed (that was Ray of Frost's slow vanishing). The deeper fix is Phase 3
   applying effects itself, after which suppression can go back to being unconditional.
5. **Phase 2.5 concentration visibility** (user request, 2026-08-15): a world setting for who
   sees the concentration check — everyone, or just the concentrator + DM. Public is the
   interesting default for table tension when a party-wide buff like Bless is at stake.
6. **design.md §9 says "combatplus is the template."** The user has explicitly softened
   that: combatplus is a *reference*, not a template — do what is correct for Battle Flow.
   The doc sentence is a candidate for a §10-style correction.

## How to work on this

**Deploy** (all scripts in `../fvtt-mcp-molten5e/scripts/`, need its `.env` + built `dist/`):

```bash
node scripts/deploy-house-module.mjs fvtt-mod-battleflow
```

That is a WebDAV hot-deploy: script changes go live on the next **world reload (F5)**, no
bounce, nobody disconnected. `module.json` changes (the version string, new `esmodules`
entries) keep vending old values until the Foundry **process** restarts — expected, not a
failure. A bounce is `register-module.mjs --id … --manifest …`; enabling is
`configure-modules.mjs --enable …`. Never call `game.shutDown()` through the bridge.

⚠ **Never bound a "did the damage appear?" search to a tail window of the chat log.** These
suites fire dozens of attacks, and a late-resolving stray hold injects announcement messages
that push a real damage card out of a short tail — two assertions flaked that way on
2026-08-15 and cost a bisect. An originating id is unique to one attack, so searching the
whole log cannot produce a false positive.

**Test** — both suites restore every setting they touch and delete their own chat messages:

```bash
node tools/smoke-battleflow.mjs
```

```bash
node tools/smoke-hold.mjs
```

`tools/scan-reactions.mjs` regenerates the [REACTIONS.md](REACTIONS.md) survey after content
changes. Fixtures live in the world and are reused: scene **Battle Flow Test Range**, actors
**BF Test Attacker**, **BF Test Victim**, **BF Test Shielder**.

⚠ **The harness runs as a GM, and the module deliberately refuses to let a GM answer a hold
for a character a logged-in player owns.** So Gren's own Shield *cannot* be driven from the
bridge while a client owning Gren is connected — that is correct behaviour, not a bug. The
real-cast path is tested on **BF Test Shielder**, a GM-owned clone of Gren (a genuine
spellcaster with genuine slots). Do not "fix" this by weakening `canAnswerFor`.

The user **logs in as the player accounts themselves** to dogfood the player side, so an
"active player" in `get-world-info` is often just them in another browser. Logging that
session out hands the hold back to the GM and unblocks the bridge — ask before assuming a
connected player is someone else at the table.

## Ground truths that already cost a debugging session

Each of these is commented at the line where it bit. Do not rediscover them.

**Foundry / v14**

- **Never key persisted data by uuid.** Foundry expands dotted keys on write, and every uuid
  contains dots: `{ "Actor.abc": "cast" }` is stored as `{ Actor: { abc: "cast" } }` and the
  lookup misses silently forever. Per-target state is an **array of entries with a `uuid`
  field**. (Phase 1 receipts dodged this by accident — they were already an array.)
- **A message renders into several DOM trees** — chat log, the floating notifications pane,
  popouts. Any "do this once per message" latch in a render hook fires on a tree that gets
  replaced while the ones on screen skip. Render hooks must be **stateless**.
- **Detached render trees hold un-upgraded custom elements.** `tray.open = false` writes a
  plain property that shadows the accessor and never touches the attribute. Use
  `toggleAttribute` — which is exactly what the system's own `_collapseTrays` does.
- PowerShell's `-Encoding utf8` writes a **BOM**, which breaks `JSON.parse` for the deploy
  tooling and Foundry alike. Edit `module.json` with the editor tools, not shell rewrites.

**dnd5e 5.3.3** (clone at `D:\Workbench\LOCAL\Repos\dnd5e-release-5.3.3`, tag matches exactly)

- An activity carries its own `activation` **only when `activation.override` is true**;
  otherwise it inherits the item's. Spells keep casting time at item level, so an
  activities-only compendium scan finds **zero reaction spells, Shield included**. Scan both.
- **Shield's +5 is a non-transfer Active Effect** ("Imperceptible Barrier",
  `system.attributes.ac.bonus` ADD 5) that the native tray applies on click — casting alone
  moves nothing. Monster reactions ship theirs *disabled* with a note telling the GM to
  enable it by hand. Anything re-testing AC must make sure the effect actually landed.
- `flags.dnd5e.originatingMessage` is stamped **only from a DOM click's enclosing card**. A
  programmatic roll must pass it explicitly or the roll never enters the message registry.
- Hit/miss is computed at render time and **never persisted** — recompute downstream.
- The usage card is a message **subtype** (`type: "usage"`); `flags.dnd5e.messageType` is the
  legacy shape `migrateData` writes, so matching only the flag no-ops on every current card.
- `dialog.configure === false` skips a roll dialog. `activity.use(usage, dialog, message)` —
  the dialog config is the **second** argument.
- **An NPC's spell-slot maxima are derived** from spellcasting progression and recompute to
  0; a leftover `value` with `max: 0` is phantom data. Requiring a real `max` is what stops
  the module holding every attack for a reaction the actor can never cast.
- **An item added to a base actor reaches an unlinked token's delta stripped of its embedded
  effects and activities.** Set test fixtures up on the token actor, or use a linked token.
- **A name match is not a reaction.** A hobgoblin WEARS a shield — an `equipment` item named
  literally "Shield" — and eleven such items existed in the world. Matching the interrupt list
  on name alone made every shield-carrying monster hold the chain for a spell it cannot cast
  ("Hobgoblin — Shield?" on a creature with no spells). Eligibility must require a real
  reaction activation, at item level or on an overriding activity.

## The shape of the thing

One ES module, `scripts/battleflow.js`, no build step. Sections in order: settings + the
settings-sheet polish, shared hit-test/chain helpers, table polish, the reaction hold
(eligibility → trigger → answers → continuation → views), Phase 1a auto-damage, Phase 1b
auto-apply, receipts. Every hook's first line checks its feature toggle; every feature ships
**off**.

The load-bearing idea, worth re-reading in design.md §4 before changing anything: **the chat
log is the state and the bus.** No sockets, no in-memory workflow object. State lives in flags
on messages; the popup and card rows are *views* of those flags; clients volunteer actions
based on what appears in the log and never command each other. Three different answer channels
for a hold (the player's response message, the player's own cast, the GM's flag flip) need
zero coordination because of this.

## Working with this user

- They dogfood live, at the table, and report bugs from real play — Tom caught the Cast button
  not casting. **Trust those reports; they have been right every time.** Reproduce in the
  harness before fixing, and add the assertion that would have caught it.
- They asked for independence on long stretches ("I'm going to AFK, do the work"). Ship,
  test, release, and report honestly at the end.
- combatplus is a **reference, not a template**.
- Surface doc/code disagreements rather than silently choosing (design.md §10).
