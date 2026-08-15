# HANDOFF.md — picking this up cold

> Written 2026-08-15, then rewritten through the same day's dogfood stretch (v1.1.2 → v1.1.12,
> eleven releases, every one of them driven by a bug found at the table) and once more at
> v1.1.13 — the first release of the day found by the **harness** instead of by a player. Read
> [design.md](design.md) first — it is binding and wins every disagreement. This file is only
> *where things stand* and *what already bit us*. Delete or rewrite it freely; it is a
> snapshot, not a contract.
>
> **Start with Open item 1.** The statblock path it used to point at is now covered; what is
> left there is the one seam no bridge-driven test can reach.

## Where things stand

**Shipped and live** in *The Broken Heart of Greenrest* (Foundry 14.364 + dnd5e 5.3.3,
Molten-hosted). Latest release **v1.1.13**, deployed, tag pushed, GitHub release carries zip +
manifest. **The box now tracks the GitHub manifest** (repointed 2026-08-15 — the self-hosted
dev manifest and zip are gone), so the process vends the real version string.

| Phase | State |
| --- | --- |
| 0 — native settings | **The user's to do**, at the table. Not code. |
| 1 — attack resolver | ✅ shipped. Auto-roll damage on hit, auto-apply via GM elect, receipts + revert. |
| 1.1 — dogfood polish | ✅ shipped. Tray auto-collapse, require-target gate, usage-card suppression, centered roll dialogs. |
| 1.5 — reaction hold | ✅ shipped, **actively being dogfooded**. PC side (Gren + Shield) has real table miles; the **monster side only started working at v1.1.12**, has almost no table miles, but is now covered end to end by `smoke-hold` §4d3–4d5. |
| 2 — saves | ⬜ next, unless the user redirects. |
| 2.5 — concentration | ⬜ has a queued user request (below). |
| 3 — effect application | ⬜ two open items depend on it. |

**Live settings as left** — verify with a read before trusting this list; the suites restore
whatever they find, so it drifts:

| Setting | Value | |
| --- | --- | --- |
| Auto-Roll Damage on Hit | `all` | `pc` / `npc` isolate one side for testing |
| Auto-Apply Damage | on | active-GM elect, receipts + revert |
| Dramatic Beat | 3s | |
| Suppress Attack Cards | on | cards carrying effects survive anyway |
| Require a Target | on | |
| Reaction Hold | on | |
| Hold Shows the Math | **on** | default flipped in v1.1.8 — design.md §5 carries the correction |
| Hold Timer | **15s** | 0 waits indefinitely |
| Skip Hopeless Holds | **on** | gated on the reveal, deliberately — see the setting's hint |
| Apply the Reaction's Effect | on | |
| Hold Settle | 8s | |

## Open items

### Next up, in order

1. **The one seam no bridge-driven test can reach: a real player's client.** Everything else
   about the reaction hold now has coverage. What does not, and cannot from here, is *being* a
   player: the harness authenticates as a GM, so on a PC attack it is a GM that rolls and
   therefore a GM that continues the hold. `continueHold`'s effect safety net is
   `actor.isOwner`-gated — trivially true for a GM, a no-op for a player against a monster it
   does not own — so on a genuine player attack the monster side rests entirely on the
   answering GM's `applyReactionEffect`. Dogfood it from a player's browser: have a player
   attack a Shield-carrying monster and watch whether the +5 lands before the verdict.
   `smoke-hold` §4d5 covers everything else about that path (the mode gate, the stamp, the
   answer, the verdict) with a character-type attacker.

   > **Done 2026-08-15 (was: build the statblock fixture).** `smoke-hold` §4d3 now drives the
   > Skeletal Mage's shape end to end on `BF Test Victim`'s token actor — hold fires, the
   > target records the feature's `itemId` and the cast activity's `activityId`, the card's
   > real Cast button spends the ACTIVITY's use and no slot, the effect lands from the linked
   > spell, the verdict flips the hit to a miss, and the card the table reads says so. §4d4
   > covers the at-will variant, §4d5 a PC attacker. Two corrections to the plan this item
   > carried: the activity's `activation.override` is **false** on the real statblock (the type
   > lives in the activity's own source), and the cached spell must **not** be hand-built —
   > the system creates it itself about half a second later, and racing it leaves two items
   > called Shield. Both are in the ground truths below.

2. **Magic Missile must trigger Shield** (user request, 2026-08-15). Shield's own text is
   *"you have a +5 bonus to AC … and you take no damage from Magic Missile"*, and the activity
   condition on the statblock says so too: *"when you are hit by an attack roll or targeted by
   the Magic Missile spell"*. The hold only ever triggers on an **attack hit** —
   `dnd5e.rollAttackV2` is the sole entry point — so the Magic Missile half has never existed.
   This needs a second trigger: a usage of a listed spell against targets, pausing before its
   damage for anyone holding a reaction whose condition covers it. Note the *kind* is neither
   of the current two: Shield vs Magic Missile is not "raise AC" (there is no attack roll to
   re-test) and not "reduce damage" — it is **negate entirely**. The interrupt-list grammar
   (`Name:kind`) will need a third kind, and the verdict wording along with it.

3. **GWF: a 1 became a 3 on a normal hit but not on a crit** (observed on Morgash,
   2026-08-15). **Probably not ours, and probably not core either.** dnd5e 5.3.3 contains *no
   implementation of Great Weapon Fighting* — `grep -rn -i "greatWeapon" module/` finds only
   the feature-category label at `config.mjs:1814`. So the 1→3 comes from world data (an
   effect, or a `min3` modifier on the damage part). Crit doubling runs through
   `term.alter(cm, cb)` in `module/dice/damage-roll.mjs`, which raises the die COUNT on the
   existing term and keeps its modifiers, so a genuine `min3` should survive into crit dice.
   **The experiment that settles it:** turn auto-damage off, land a crit, and press the native
   Damage button by hand. Same behaviour ⇒ it is the data or the system, and nothing to do with
   this module — we call the identical `activity.rollDamage(..., { isCritical })` the native
   button calls. Different behaviour ⇒ it IS ours, and the difference will be in the options we
   pass at `rollDamageForAttack`.

### Standing

4. **The hold's UI is settled and shipped** (user calls, 2026-08-15) — recorded because it is
   binding on anything built next: **the popup decides, the card watches, the card is public
   so the table sees the moment.** One card shape (`bfCard`) for everything the module says
   out loud; the card carries no answer controls where popups are on, only an *Answer* button
   that calls a dismissed popup back. ⚠ Never give one decision two live controls — that is
   how the card and popup got out of step. Look-and-feel is still being tuned against
   screenshots from real play; expect wording and density to move.
5. **The hold timer is built** (v1.1.8–v1.1.10) — `holdTimer` seconds, 0 = wait indefinitely,
   live at 15s. The continuing client owns the one authoritative clock and re-checks at the
   buzzer; unanswered targets pass and are marked `timedOut`. The bar is built with
   `element.animate()` and positioned from the flag's absolute deadline, so popup and card
   agree exactly (measured drift 0). ⚠ Do not "simplify" it back to a CSS animation — see the
   ground truth below for why that silently desyncs.
6. **The PC-attacker path is untested at the table** (v1.1.3 opened it) — promoted to Open
   item 1, since it is now the only part of the reaction hold without coverage. Monster
   reactions ship their effects **disabled**, so the GM keeps a switch to throw when the
   safety net cannot reach.
7. **Usage-card suppression vs effects — partially fixed.** Cards carrying effects are now
   never suppressed (that was Ray of Frost's slow vanishing). The deeper fix is Phase 3
   applying effects itself, after which suppression can go back to being unconditional.
8. **Phase 2.5 concentration visibility** (user request, 2026-08-15): a world setting for who
   sees the concentration check — everyone, or just the concentrator + DM. Public is the
   interesting default for table tension when a party-wide buff like Bless is at stake.
9. **design.md §9 says "combatplus is the template."** The user has explicitly softened
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
**BF Test Attacker** (NPC), **BF Test Victim** (NPC, also wears a mundane shield for the
name-collision test), **BF Test Shielder** (GM-owned clone of Gren) and **BF Test PC Attacker**
(character-type, for the attacker-side mode gate). The suites **long rest every `BF Test`
fixture on the way out** — they spend real slots and real HP, and nothing else puts it back.
Fixtures only: live PCs are restored to whatever was found, because resting the party is the
user's call, not the harness's.

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
- **A CSS animation is not instantiated until its element is actually being rendered**, and a
  chat message is inserted into a tree that is not rendering yet. Measured: a card's countdown
  bar reported `getAnimations().length === 0` and zero width more than a second after render,
  so it later began its drain from zero and stayed seconds behind the same bar in a popup —
  from an identical `animation-delay`. `animation-delay` cannot fix it (it is relative to a
  start the element chooses). Build timed visuals with `element.animate()`, which exists the
  moment it is called and runs on the document timeline, and set `currentTime` from an
  absolute deadline.
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
- ⚠ **A synthetic (unlinked-token) actor rebuilds its embedded collections from the delta on
  every write**, so deleting documents one at a time throws `Item "…" does not exist!` on the
  second call — the loop is deleting a document the server already dropped. Collect the ids
  and make **one** `deleteEmbeddedDocuments` call. Same for its effects.
- ⚠ **`CastActivity#use` never uses itself.** It resolves (or lazily creates) a **cached copy
  of the spell on the actor** — flagged `dnd5e.cachedFor: <activity relativeUUID>`, with
  `_stats.compendiumSource` pointing at the linked spell — and calls **that item's** `use()`.
  Three consequences the whole monster side rests on: `dnd5e.postUseActivity` fires with the
  **cached spell's** activity (so matching on the used activity's item name gives "Shield", not
  "Spellcasting"); `_prepareUsageConfig` sets `consume.spellSlot ??= !linked && …`, so a linked
  cast **never spends a slot**; and `config.cause.resources` routes payment to the **cast
  activity's own uses** instead. That is why a statblock caster with 0/0 slots can cast at all.
- **The system materializes that cached spell by itself**, about half a second after a cast
  activity is created on an actor. Creating one by hand (`getCachedSpellData()`) races it and
  leaves the actor with **two** items called Shield — which is a name collision the module then
  has to survive. Fixtures must wait for it, not build it (measured 2026-08-15).
- A cast activity's `activation.type` lives in **its own source** — the Skeletal Mage stores
  `reaction` with `override: false` — and `prepareFinalData` overrides it from the cached spell
  when one exists. So it reads `reaction` from the moment of creation; an `override: true` is
  not needed and would model a shape no statblock has.
- ⚠ **`system.attributes.ac.calc === "flat"` returns before `ac.bonus` is ever added**
  (`data/actor/templates/attributes.mjs`), and `ac.bonus` is precisely the field Shield's effect
  writes. Pinning a test actor's AC flat makes "the +5 arrived" permanently unobservable —
  looking exactly like a module bug. `natural` (the NPC default) does add it.
- ⚠ **A 2024 statblock does not cast from the spell item at all.** Its "Spellcasting" feature
  carries one **`cast` activity per spell**, and the activation, the resource and the
  consumption all live on THAT activity — the spell item it links to is a target that reports
  `spellSlot: true` with no uses and no slots. Verified on Skeletal Mage
  (`Shield - Spellcasting`, activation `reaction`, uses 1/1, consumption `activityUses`) and on
  the compendium Green Hag, which has the same shape on two features. Interrogating the spell
  item concluded every statblock caster was unable to cast, so none ever held. Resolve
  `activity.spell.uuid` for the real name; the activity's own name is decoration
  ("Shield - Spellcasting" on one, plain "Augury" on another).
  **On a cast activity, no uses pool means AT-WILL** — the opposite of the spell-item rule.
  The Green Hag's at-will spells carry `uses.max: ""` and no consumption target at all.
- **There are TWO ways to pay for a spell**, and monsters mostly use the second: a slot, or the
  statblock's "Additional Spells" x/x uses pool (item-level or activity-level). NPC slot maxima
  are derived from a caster level most statblocks never set, so they sit at 0/0 — requiring a
  slot meant no monster ever held a reaction spell. Verified on Skeletal Mage: `spellcasting:
  "int"`, `details.spellLevel: null`, every slot 0/0.
- **`prepared` is a PC concept.** Every levelled spell on a 2024-statblock NPC reads
  `prepared: 0` (Skeletal Mage's entire list does). Gating eligibility on it silently
  disqualified the whole monster side.
- **One name can match several items.** A caster who wears a shield AND knows Shield has two
  items called "Shield"; `items.find()` returned whichever sorted first, and picking the
  mundane one abandoned the entry before the spell was ever considered. Filter and test them
  all — that is most armoured statblock casters.
  ⚠ **That lesson was learned for eligibility only.** Every *other* question about a reaction —
  has its effect landed, what is its AC bonus, what artwork and description does the popup
  show, what does the Cast fallback use — was still doing a bare name match until **v1.1.13**,
  and on a statblock caster they all read the worn shield: no effects, no bonus, no activities.
  The mechanics still came out right (the verdict reads the live AC directly), so the failure
  was purely in what the table was TOLD — a hold that correctly ended in a miss announcing
  "Reaction — not applied … so this resolves as a hit". Caught by `smoke-hold` §4d3's
  announcement assertion, not by a human. They all route through **`reactionItem()`** now,
  which prefers the cached spell of the cast activity the hold recorded. If you add another
  question about a reaction, ask it through that helper.
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
