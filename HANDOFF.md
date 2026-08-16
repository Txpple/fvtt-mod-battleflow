# HANDOFF.md — picking this up cold

> Rewritten 2026-08-15 at the end of a long dogfood stretch (v1.1.2 → v1.1.16). Read
> [design.md](design.md) first — it is binding and wins every disagreement. This file is only
> *where things stand* and *what already bit us*. Delete or rewrite it freely; it is a
> snapshot, not a contract.
>
> **Phase 1.5 is done and dogfooded — start on Phase 1.75 (hit riders: Hunter's Mark, Hex)**
> unless the user redirects; design.md carries the swept rider table and the four findings that
> are binding on it. Nothing is tracked open against the reaction hold. The standing notes
> below are design constraints rather than to-dos.

## Where things stand

**Shipped and live** in *The Broken Heart of Greenrest* (Foundry 14.364 + dnd5e 5.3.3,
Molten-hosted). Latest release **v1.1.16**, deployed, tag pushed, GitHub release carries zip +
manifest. **The box tracks the GitHub manifest** (repointed 2026-08-15 — the self-hosted dev
manifest and zip are gone), so the process vends the real version string after a restart.

| Phase | State |
| --- | --- |
| 0 — native settings | **The user's to do**, at the table. Not code. |
| 1 — attack resolver | ✅ shipped. Auto-roll damage on hit, auto-apply via GM elect, receipts + revert. |
| 1.1 — dogfood polish | ✅ shipped. Tray auto-collapse, require-target gate, usage-card suppression, centered roll dialogs. |
| 1.5 — reaction hold | ✅ **feature-complete at v1.1.16** and dogfooded — both triggers exist: an attack hit, and a listed spell. Magic Missile and the player-client seam were both played at the table 2026-08-15 with nothing reported; Magic Missile stays in normal dogfood rotation rather than on a list. |
| 1.75 — hit riders | ⬜ **next.** Hunter's Mark / Hex, at `dnd5e.preRollDamageV2`. |
| 2 — saves | ⬜ after 1.75. |
| 2.5 — concentration | ⬜ has a queued user request (below). |
| 3 — effect application | ⬜ two standing notes depend on it. |

⚠ **World data changed 2026-08-15:** the Skeletal Mage's `system.attributes.ac.calc` went
`flat` → `natural`. Its `flat: 16` is untouched, so its printed AC is still 16 — but a flat AC
ignores every bonus, which made Shield inert on it. See the flat-AC ground truth; reverting the
field restores the old behaviour, bug included.

**Live settings as left** — verify with a read before trusting this list; the suites restore
whatever they find, so it drifts:

| Setting | Value | |
| --- | --- | --- |
| Auto-Roll Damage on Hit | `all` | `pc` / `npc` isolate one side for testing |
| Auto-Apply Damage | on | active-GM elect, receipts + revert |
| Dramatic Beat | 3s | |
| Suppress Attack Cards | on | cards carrying effects survive anyway |
| Require a Target | on | |
| Reaction Hold | on | governs **both** triggers |
| Spells a Reaction Blocks | `Magic Missile:Shield` | new in v1.1.16 — the second trigger |
| Hold Shows the Math | **on** | default flipped in v1.1.8 — design.md §5 carries the correction |
| Hold Timer | **15s** | 0 waits indefinitely |
| Skip Hopeless Holds | **on** | gated on the reveal, deliberately — see the setting's hint |
| Apply the Reaction's Effect | on | |
| Hold Settle | 8s | |

## Open items

### Standing

1. **The second trigger, and the two things it deliberately does not solve** (v1.1.16).
   Casting a spell on the **`blockList`** setting (`Spell:Reaction`, default
   `Magic Missile:Shield`) stamps a hold on its own **usage card** at `dnd5e.postUseActivity` —
   same flag shape, same popup, same card, same timer, same three answer channels — carrying
   `trigger: "spell"` and a third kind, **`negate`**. No re-test, no settle window: the answer
   IS the verdict. The block is enforced at **`dnd5e.preApplyDamage`**, the only seam that can
   do anything, because nothing else in the module touches this spell (not an attack ⇒ Phase 1a
   never rolls its damage, Phase 1b never applies it).
   ⚠ **The dice roll anyway.** `DamageActivity._triggerSubsequentActions` rolls damage on use,
   so it is on the table while the hold is open. Harmless *here* and only here: a negate answer
   never depends on the number, so there is nothing to metagame — which is why this trigger does
   not fight to suppress the roll the way the attack path does. Do not copy that reasoning to a
   reaction whose answer depends on the damage.
   ⚠ **Apply-before-answer wins.** A GM who presses Apply while the hold is still `pending`
   beats the verdict and the damage lands. Vetoing pending applications is worse: a hold
   answered Pass would then need a second Apply click nobody would remember to make. The card
   reads "held — waiting on …" the whole time. If this bites in play, the fix is Phase 2/3
   owning non-attack damage application, not a bigger veto.

2. **The hold's UI is settled and shipped** (user calls, 2026-08-15) — recorded because it is
   binding on anything built next: **the popup decides, the card watches, the card is public
   so the table sees the moment.** One card shape (`bfCard`) for everything the module says out
   loud; the card carries no answer controls where popups are on, only an *Answer* button that
   calls a dismissed popup back.
   ⚠ **One decision, two controls, and the same two for everybody.** The hold asks a binary
   question — take the reaction or don't — and the GM's surface must be the *same shape* as the
   player's. A GM-only third button ("Skip") stood on both surfaces until **v1.1.15**: it ran
   the same code as Pass, the whole chain only ever asks `answer === "cast"`, and it appeared
   only where the GM already *is* the decider (an unowned monster) while being denied by
   `canAnswerFor` on the player-owned targets it was designed for. Reported by the user as
   "it seems like it should be a binary choice". The AFK fallback is the **timer**, not a
   button. `smoke-hold` §4d3 and §6 both assert the control set is exactly `Cast/Pass`.
3. **Cards say one thing, once.** The verdict card for a negate hold was two lines until the
   user cut it back: "Magic Missile does nothing to Skeletal Mage" already says the whole thing,
   and a second line restating it mechanically ("its damage is not applied to them") plus a
   note about the other targets answered questions nobody watching had asked. Worth remembering
   when writing the next announcement.
4. **The hold timer is built** (v1.1.8–v1.1.10) — `holdTimer` seconds, 0 = wait indefinitely,
   live at 15s. The continuing client owns the one authoritative clock and re-checks at the
   buzzer; unanswered targets pass and are marked `timedOut`. The bar is built with
   `element.animate()` and positioned from the flag's absolute deadline, so popup and card
   agree exactly (measured drift 0). ⚠ Do not "simplify" it back to a CSS animation — see the
   ground truth below for why that silently desyncs.
5. **Usage-card suppression vs effects — partially fixed.** Cards carrying effects are now
   never suppressed (that was Ray of Frost's slow vanishing). The deeper fix is Phase 3
   applying effects itself, after which suppression can go back to being unconditional.
6. **Phase 2.5 concentration visibility** (user request, 2026-08-15): a world setting for who
   sees the concentration check — everyone, or just the concentrator + DM. Public is the
   interesting default for table tension when a party-wide buff like Bless is at stake.
7. **design.md §9 says "combatplus is the template."** The user has explicitly softened that:
   combatplus is a *reference*, not a template — do what is correct for Battle Flow. The doc
   sentence is a candidate for a §10-style correction.

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

**Release** (the house pattern, three commits then a tag on the middle one):
`test:` the harness → `fix:`/`feat:` the code + `module.json` bump *(tag this one)* → `docs:`
the handoff. Release title `vX.Y.Z — short phrase`; assets are `fvtt-mod-battleflow.zip`
**and** a bare `module.json`. Commit bodies in this repo are **ASCII** — the log shows
non-ASCII punctuation getting mangled.

⚠ **Build the zip with the script, never with `Compress-Archive`:**

```bash
powershell -ExecutionPolicy Bypass -File tools/build-release.ps1
```

It writes `dist/fvtt-mod-battleflow.zip` (gitignored) with exactly `scripts/`, `module.json`,
`LICENSE`, `README.md`, and then reads the archive back and **fails** if any entry name contains
a backslash. That check is the whole point. `Compress-Archive` on Windows PowerShell 5.1 writes
`scripts\battleflow.js` with a backslash, which is not what the ZIP spec says and not what
Node-based extractors do with it — they treat it as one literal filename and drop the file at
the archive root, so `esmodules: ["scripts/battleflow.js"]` resolves to nothing and the module
installs as an empty shell. **Every release from v1.1.0 to v1.1.15 shipped that way.** It never
bit because the live box is hot-deployed over WebDAV rather than installed from the zip, but a
clean install from any of those tags would have. v1.1.16 onward is correct; the old assets were
left alone, so re-cut one only if someone ever needs to install it.

**Test** — both suites restore every setting they touch and delete their own chat messages:

```bash
node tools/smoke-battleflow.mjs
```

```bash
node tools/smoke-hold.mjs
```

`tools/scan-reactions.mjs` regenerates the [REACTIONS.md](REACTIONS.md) survey after content
changes. Fixtures live in the world and are reused: scene **Battle Flow Test Range**, actors
**BF Test Attacker** (NPC — also the Magic Missile caster in §6, which builds the spell on it
and sweeps it again on the way out), **BF Test Victim** (NPC — wears a mundane shield for the
name-collision test, and hosts the statblock cast-activity fixture), **BF Test Shielder**
(GM-owned clone of Gren) and **BF Test PC Attacker** (character-type). The suites **long rest
every `BF Test` fixture on the way out** — they spend real slots and real HP, and nothing else
puts it back. Fixtures only: live PCs are restored to whatever was found, because resting the
party is the user's call, not the harness's.

`smoke-hold`'s sections, so you can find the one you need: **1–3** hold/cast/pass on Gren,
**4** reaction-spent, **4b/4b2** the real Cast control and one-cast-many-holds on the
GM-owned stand-in, **4c** the effect safety net, **4d** a mundane shield never holds,
**4d2** an NPC paying with x/x uses, **4d3** the statblock cast activity end to end (+ the
control set and the announcement wording), **4d4** at-will, **4d5** a PC attacker,
**4d6** a flat AC, **4e** the timer, **4f** hopeless holds, **5** the crit skip,
**6** Magic Missile — the negate hold, the real block, the Pass control case, and a target who
only *wears* a shield.

⚠ **HP is a fixture resource, and forgetting to reset it makes a damage assertion lie.** The
stand-in takes real, auto-applied hits in §4b–4c, so it reached §6 at **0 HP** — where "took no
damage" and "took the lot" are the same reading. The negate assertion passed 0 → 0 while
proving nothing; only its Pass counterpart failed (HP clamps at zero) and gave the pair away.
`ensureShielder` now heals to full alongside the slots it already refilled, and both §6
assertions check `hpBefore` against `hp.max` so a regression there fails loudly instead of
passing vacuously. **Generalise this:** an assertion that a number did not move is only worth
anything if the number could have moved.

⚠ **The harness runs as a GM, and the module deliberately refuses to let a GM answer a hold
for a character a logged-in player owns.** So Gren's own Shield *cannot* be driven from the
bridge while a client owning Gren is connected — that is correct behaviour, not a bug. The
real-cast path is tested on **BF Test Shielder**, a GM-owned clone of Gren (a genuine
spellcaster with genuine slots). Do not "fix" this by weakening `canAnswerFor`.

⚠ **Never bound a "did the damage appear?" search to a tail window of the chat log.** These
suites fire dozens of attacks, and a late-resolving stray hold injects announcement messages
that push a real damage card out of a short tail — two assertions flaked that way on
2026-08-15 and cost a bisect. An originating id is unique to one attack, so searching the
whole log cannot produce a false positive.

⚠ **Assert what the table is TOLD, not just what happens.** The verdict and the wording of the
card are computed separately, so a hold can resolve perfectly and still publish nonsense. Both
bugs found on 2026-08-15 (v1.1.13, v1.1.14) were visible *only* in the announcement; every
mechanical assertion passed straight through them.

The user **logs in as the player accounts themselves** to dogfood the player side, so an
"active player" in `get-world-info` is often just them in another browser. Logging that
session out hands the hold back to the GM and unblocks the bridge — ask before assuming a
connected player is someone else at the table.

## Ground truths that already cost a debugging session

Most of these are commented at the line where it bit. Do not rediscover them.

**Foundry / v14**

- **Never key persisted data by uuid.** Foundry expands dotted keys on write, and every uuid
  contains dots: `{ "Actor.abc": "cast" }` is stored as `{ Actor: { abc: "cast" } }` and the
  lookup misses silently forever. Per-target state is an **array of entries with a `uuid`
  field**. (Phase 1 receipts dodged this by accident — they were already an array.)
- **A message renders into several DOM trees** — chat log, the floating notifications pane,
  popouts. Any "do this once per message" latch in a render hook fires on a tree that gets
  replaced while the ones on screen skip. Render hooks must be **stateless**. (Also why a
  `querySelectorAll` over a message's controls returns each button more than once.)
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
- ⚠ **A synthetic (unlinked-token) actor rebuilds its embedded collections from the delta on
  every write**, so deleting documents one at a time throws `Item "…" does not exist!` on the
  second call — the loop is deleting a document the server already dropped. Collect the ids and
  make **one** `deleteEmbeddedDocuments` call. Same for its effects.
- PowerShell's `-Encoding utf8` writes a **BOM**, which breaks `JSON.parse` for the deploy
  tooling and Foundry alike. Edit `module.json` with the editor tools, not shell rewrites.
  Editor writes can also flip a whole file to CRLF against an LF `HEAD`, which turns a 300-line
  diff into a 2000-line one — check `git diff --numstat` before committing.

**dnd5e 5.3.3** (clone at `D:\Workbench\LOCAL\Repos\dnd5e-release-5.3.3`, tag matches exactly)

- An activity carries its own `activation` **only when `activation.override` is true**;
  otherwise it inherits the item's. Spells keep casting time at item level, so an
  activities-only compendium scan finds **zero reaction spells, Shield included**. Scan both.
- **Shield's +5 is a non-transfer Active Effect** ("Imperceptible Barrier",
  `system.attributes.ac.bonus` ADD 5) that the native tray applies on click — casting alone
  moves nothing. Monster reactions ship theirs *disabled* with a note telling the GM to
  enable it by hand. Anything re-testing AC must make sure the effect actually landed.
- ⚠⚠ **`system.attributes.ac.calc === "flat"` RETURNS before `ac.bonus` is ever added**
  (`data/actor/templates/attributes.mjs`, comment: *"Flat AC (no additional bonuses)"*), and
  `ac.bonus` is precisely the field Shield's effect writes. **On a flat statblock the reaction
  is inert**: the effect lands, `ac.bonus` reads 5, `ac.value` never moves, and the attack still
  hits. No module can fix this — the system is refusing to count it.

  **This is the first thing to check when a reaction "does nothing" on a monster.** It bit live
  on 2026-08-15: the hand-authored Skeletal Mage had `calc: "flat", flat: 16`, so Gren's 16
  stayed a hit through two casts of Shield. It is bad data, not a shape to support —
  `dnd-monster-manual.actors` is 383 natural / 116 default / **1 flat** out of 500, and this
  world's 130 NPCs are 113 default / 15 natural / 2 flat. Fix is one field: `calc` →
  `natural`, leaving `flat` as the number. Natural uses it as the BASE and then adds shield,
  bonus and cover, so the printed AC does not move (verified 16 → 16, and 21 under Shield).
  Since **v1.1.14** the verdict card names this case specifically instead of saying "its AC has
  not arrived", which is what sent a debugging session after a module bug that was not there.
  `smoke-hold` §4d6 holds the line. *(Note: this cannot bite the Magic Missile trigger — a
  negate hold never reads AC at all.)*
- `flags.dnd5e.originatingMessage` is stamped **only from a DOM click's enclosing card**. A
  programmatic roll must pass it explicitly or the roll never enters the message registry.
- Hit/miss is computed at render time and **never persisted** — recompute downstream.
- The usage card is a message **subtype** (`type: "usage"`); `flags.dnd5e.messageType` is the
  legacy shape `migrateData` writes, so matching only the flag no-ops on every current card.
- `dialog.configure === false` skips a roll dialog. `activity.use(usage, dialog, message)` —
  the dialog config is the **second** argument.
- **An item added to a base actor reaches an unlinked token's delta stripped of its embedded
  effects and activities.** Set test fixtures up on the token actor, or use a linked token.
- **The target snapshot is not an attack-roll thing.** `flags.dnd5e.targets` comes from the
  activity mixin's `messageFlags` getter (`mixin.mjs:140`), which every usage card gets whole
  (`mixin.mjs:203`) — and every damage card too (`:895`). So a spell with no attack roll
  anywhere in it still tells you exactly who it was aimed at. That is what made the second
  trigger cheap.
- `_createUsageMessage` returns **plain data, not a ChatMessage**, when `create: false`
  (`mixin.mjs:812`) — hence the `instanceof ChatMessage` guard on the spell trigger.
- **`dnd5e.renderChatMessage` fires for EVERY message subtype** (`chat-message.mjs:142`, outside
  the usage/roll branch), so a usage card grows the hold row exactly as an attack message does.
- **A damage activity rolls its damage the moment it is used** —
  `DamageActivity._triggerSubsequentActions` (`damage.mjs:53`), same as an attack activity rolls
  its attack. `subsequentActions: false` suppresses it, which is how the harness controls timing.
- **`dnd5e.preApplyDamage(actor, amount, updates, options)` cancels on an explicit `false`**
  (`actor.mjs:754`), and the native tray passes the **damage message** as
  `options.originatingMessage` (`damage-application.mjs:76`) — one `getOriginatingMessage()` hop
  gets you the usage card. It fires on whichever client is applying, so a veto must not be
  GM-gated. **Healing takes this same path** (`roll.type: "healing"`), so any veto must check
  the roll type or it can refuse someone a cure.
- ⚠ **A `min3` damage die survives crit doubling — the CARD is what lies.** Great Weapon
  Fighting is not automated by the system (its own feature text says so); the premades and this
  world both express it as a **custom damage formula**, `2d6min3` on the weapon's base part.
  `configureDamage` raises the die COUNT through `term.alter(cm, cb)` and never touches
  `term.modifiers`, so a crit rolls `4d6min3`. Measured on Morgash's greatsword, 250 rolls each
  way: every die under 3 paid out as a 3, normal and crit alike. What misleads is the render —
  Foundry's `min` leaves `result: 1` and sets `count: 3`, so the card prints the glyph **1**
  with a faint `rerolled` class and the missing 2 shows up only in the total, identically on
  both. **A correct crit looks exactly like a broken one; read the total, not the faces.**
  *(Reported 2026-08-15 as "the 1 became a 3 on a normal hit but not on a crit"; closed by
  building the real roll through `getDamageConfig` → `DamageRoll.build` with `create: false`.)*
- **Spell-slot consumption is skippable in data**: `hasSpellSlotConsumption` is
  `requiresSpellSlot && consumption.spellSlot` (`mixin.mjs:432`), so an activity built with
  `consumption.spellSlot: false` casts with no slot at all. That is how §6 gives an NPC with no
  slot maxima a working Magic Missile, and it is the shape innate casting really has.

**The statblock caster (the monster side, and where most of the bugs lived)**

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
- ⚠ **`CastActivity#use` never uses itself.** It resolves (or lazily creates) a **cached copy
  of the spell on the actor** — flagged `dnd5e.cachedFor: <activity relativeUUID>`, with
  `_stats.compendiumSource` pointing at the linked spell — and calls **that item's** `use()`.
  Three consequences the whole monster side rests on: `dnd5e.postUseActivity` fires with the
  **cached spell's** activity (so matching on the used activity's item name gives "Shield", not
  "Spellcasting"); `_prepareUsageConfig` sets `consume.spellSlot ??= !linked && …`, so a linked
  cast **never spends a slot**; and `config.cause.resources` routes payment to the **cast
  activity's own uses** instead. That is why a statblock caster with 0/0 slots can cast at all.
  *(This is also why the spell trigger matches through `reactionNameFor`: a monster casting
  Magic Missile arrives with the cached spell's activity, whose item really is named for the
  spell.)*
- **The system materializes that cached spell by itself**, about half a second after a cast
  activity is created on an actor. Creating one by hand (`getCachedSpellData()`) races it and
  leaves the actor with **two** items called Shield — a name collision the module then has to
  survive. Fixtures must wait for it, not build it.
- A cast activity's `activation.type` lives in **its own source** — the Skeletal Mage stores
  `reaction` with `override: false` — and `prepareFinalData` overrides it from the cached spell
  when one exists. So it reads `reaction` from the moment of creation; an `override: true` is
  not needed and would model a shape no statblock has.
- **An NPC's spell-slot maxima are derived** from spellcasting progression and recompute to
  0; a leftover `value` with `max: 0` is phantom data. Requiring a real `max` is what stops
  the module holding every attack for a reaction the actor can never cast.
- **There are TWO ways to pay for a spell**, and monsters mostly use the second: a slot, or the
  statblock's "Additional Spells" x/x uses pool (item-level or activity-level). Verified on
  Skeletal Mage: `spellcasting: "int"`, `details.spellLevel: null`, every slot 0/0.
- **`prepared` is a PC concept.** Every levelled spell on a 2024-statblock NPC reads
  `prepared: 0` (Skeletal Mage's entire list does). Gating eligibility on it silently
  disqualified the whole monster side.
- **A name match is not a reaction.** A hobgoblin WEARS a shield — an `equipment` item named
  literally "Shield" — and eleven such items existed in the world. Matching the interrupt list
  on name alone made every shield-carrying monster hold the chain for a spell it cannot cast
  ("Hobgoblin — Shield?" on a creature with no spells). Eligibility must require a real
  reaction activation, at item level or on an overriding activity — which is what
  `usableReaction()` is, and why **both** triggers go through it.
- **One name can match several items.** An armoured caster owns a worn shield AND (via the
  cached copy above) the Shield spell; `items.find()` returns whichever sorts first, and on an
  unlinked token the base actor's equipment sorts ahead of the delta-created spell.
  `usableReaction` handles this for **eligibility** (it tests every match). Every *other*
  question — has the effect landed, what is its AC bonus, what artwork and description does the
  popup show, what does the Cast fallback use — was still a bare name match until **v1.1.13**,
  and all of them read the worn shield: no effects, no bonus, no activities. The mechanics
  still came out right, so the failure was purely in what the table was TOLD. They all route
  through **`reactionItem()`** now, which prefers the cached spell of the cast activity the hold
  recorded. **If you add another question about a reaction, ask it through that helper.**

## The shape of the thing

One ES module, `scripts/battleflow.js`, no build step. Sections in order: settings + the
settings-sheet polish, shared hit-test/chain helpers, table polish, the reaction hold
(eligibility → **both triggers** → answers → continuation → the veto → views), Phase 1a
auto-damage, Phase 1b auto-apply, receipts. Every hook's first line checks its feature toggle;
every feature ships **off**.

The hold has **two entry points and one machine**. `stampHoldIfInterrupted` (from
`dnd5e.rollAttackV2`) writes a hold onto the **attack message**; `stampSpellHold` (from
`dnd5e.postUseActivity`) writes the same shape onto a **usage card** with `trigger: "spell"`.
Everything downstream is shared, and the four places that need a d20 branch on that one field —
`continueHold`, the card row, the popup's situation line, and the response message's wording.
Holds already in the log carry no `trigger` at all, which is exactly why the branches cannot
reach the shipped attack path. **If you add a third trigger, add it as a stamp function and a
`trigger` value, not as a second machine.**

The load-bearing idea, worth re-reading in design.md §4 before changing anything: **the chat
log is the state and the bus.** No sockets, no in-memory workflow object. State lives in flags
on messages; the popup and card rows are *views* of those flags; clients volunteer actions
based on what appears in the log and never command each other. Three different answer channels
for a hold (the player's response message, the player's own cast, the GM's flag flip) need
zero coordination because of this.

## Working with this user

- They dogfood live, at the table, and report bugs from real play — Tom caught the Cast button
  not casting; the user caught the flat AC and the extra Skip button. **Trust those reports;
  they have been right every time.** Reproduce in the harness before fixing, and add the
  assertion that would have caught it.
- **When a report arrives, read the actual log and flags before theorising.** The flat-AC bug
  looked exactly like the module bug that had just been fixed; one read of `ac.calc` settled it.
- **They will ask whether a feature is worth its complexity, and they mean it.** Magic Missile
  opened with "i dont want to do it if it overly complicates things". Answer with the real cost
  and a recommendation *before* building, not after.
- They asked for independence on long stretches ("I'm going to AFK, do the work"). Ship, test,
  release, and report honestly at the end. **They keep their git clean and want the rev cut when
  the work is done** — never leave a bumped `module.json` dangling without the matching GitHub
  release; a later fix becomes a new rev rather than a reason to hold one back. Build and test
  freely, then *offer* the release — they say yes, but the offer is the courtesy.
- They test immediately after a release, so say plainly what is live, what needs an F5, and
  what needs a process restart.
- They cut prose that repeats itself. Say it once (standing item 3).
- combatplus is a **reference, not a template**.
- Surface doc/code disagreements rather than silently choosing (design.md §10).
