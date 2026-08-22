# NOTES.md — working knowledge

> **Not binding. Just expensive.** Everything here cost a debugging session, a live table
> failure, or a night of phantom test results. None of it is obvious, and most of it is not
> written down anywhere else.
>
> [DESIGN.md](DESIGN.md) is what the module is for. [ARCHITECTURE.md](ARCHITECTURE.md) is how
> the code must be shaped. This page is what we learned building it.
>
> Most of these are also commented at the line where they bit. **Do not rediscover them.**

---

## 1. Foundry v14

**`toggleStatusEffect(id, { active: true })` no-ops when ANY effect carrying that status
already exists** — including a *disabled* leftover. And `{ active: false }` only removes the
**canonical-id** effect (`dnd5eprone000000`-style), leaving custom-id carriers immortal. Both
silences are table-facing: the live "topple failed but nothing fell prone" was a disabled
leftover eating the press. Put statuses on actors through `forceStatus`: enable a disabled
carrier, build the effect directly (which also lets it carry an `origin` naming who pressed
it), verify the status landed, and log loudly if it did not.

**Never key persisted data by uuid.** Foundry expands dotted keys on write and every uuid
contains dots: `{ "Actor.abc": "cast" }` is stored as `{ Actor: { abc: "cast" } }`, so every
lookup misses silently and forever. Per-target state is an **array of entries with a `uuid`
field**.

**An async hook handler's throw is invisible.** `Hooks.on("x", doc => { void f(doc) })` turns
any rejection into an unhandled rejection nobody logs. Anything fallible in a
fire-and-forget handler needs its own try/catch with a `console.error`.

**A message renders into several DOM trees** — chat log, the notifications pane, popouts. Any
"once per message" latch inside a render hook fires on a tree that gets replaced while the
on-screen ones skip. **Render hooks must be stateless.** (Also why `querySelectorAll` over a
message's controls returns each button more than once.)

**ESM evaluation order is import-graph order, not entry-list order.** A file's imports evaluate
before its own body, so an "early" file importing a "late" one registers the late file's hooks
first — and `Hooks.call` stops at the first `false`, so relative order between same-hook
registrations can be behavioral. The existing import cycles are safe **only** because every
crossing symbol is a hoisted `function` declaration called at hook time, never at module-eval
time. Keep new cross-file symbols to that shape, or break the cycle.

**A CSS animation is not instantiated until its element is actually being rendered**, and a
chat message is first inserted into a tree that is not rendering yet. Measured: a card's
countdown bar reported zero animations and zero width more than a second after render, then
began its drain from zero and stayed seconds behind an identical bar in a popup.
`animation-delay` cannot fix it — it is relative to a start the element chooses. Build timed
visuals with `element.animate()` and set `currentTime` from an absolute deadline.

**Detached render trees hold un-upgraded custom elements.** `tray.open = false` writes a plain
property that shadows the accessor and never touches the attribute. Use `toggleAttribute` —
which is what the system's own collapse code does.

**A synthetic (unlinked-token) actor rebuilds its embedded collections from the delta on every
write**, so deleting documents one at a time throws `Item "…" does not exist!` on the second
call. Collect the ids and make **one** `deleteEmbeddedDocuments` call per collection.

**`PIXI.Circle.contains` is boundary-inclusive** — a point exactly on the rim is inside. Fine
live; keep test fixtures off the razor's edge.

**On a headless client, embedded MeasuredTemplate plumbing is half-dead**: `createMeasuredTemplate`
never dispatches for an embedded create, `tpl.update()` resolves without applying, and template
canvas objects never grow a `shape` (an await against one never returns). Consequences baked
into the code: the **render** hook is the reliability floor, CRUD hooks are fast-paths only,
containment falls back to document geometry, and nothing ever awaits template canvas readiness.

**`getSpeaker({actor})` resolves through the actor's oldest active token on the *viewed*
scene.** A stray unlinked fixture token made every programmatic save resolve to a *synthetic*
token uuid that can never string-match a linked snapshot entry — three suite runs to corner.
The module's exact-uuid match is correct for every real-table shape; the fix is harness
protocol (sweep stray tokens).

**PowerShell's `-Encoding utf8` writes a BOM**, which breaks `JSON.parse` for Foundry and the
deploy tooling alike. Edit `module.json` with editor tools, never shell rewrites — a
`-replace` pass also mangled its em-dashes to mojibake. Editor writes can flip a whole file to
CRLF against an LF `HEAD`; check `git diff --numstat` before committing.

---

## 2. dnd5e 5.3.x

### Rolls and damage

**Hit/miss is computed at render time and never persisted.** Recompute downstream.

**`D20Roll#isCritical` reads the D20 *die term's* `options.criticalSuccess`.** The roll's own
`options.criticalSuccess` is a **decoy** — present, numeric, plausible, and read by nothing.

**Injecting a damage part at `dnd5e.preRollDamageV2` gets crit doubling for free**, because
that hook fires before the keybinding pass stamps `isCritical` onto every entry in
`config.rolls` — including one a module pushed. Do not hand-roll it. And do not consult
`damage.critical.allow`: it governs the standalone button and reads inconsistently across
official content.

**A `min3` damage die survives crit doubling — the CARD is what lies.** Great Weapon Fighting
ships as a custom formula (`2d6min3`); `configureDamage` raises the die *count* and never
touches modifiers, so a crit rolls `4d6min3`. Foundry's `min` leaves `result: 1` and sets
`count: 3`, so the card prints a **1** with a faint `rerolled` class and the missing 2 appears
only in the total — identically on normal and crit. **A correct crit looks exactly like a
broken one; read the total, not the faces.**

**`flags.dnd5e.originatingMessage` is stamped only from a DOM click's enclosing card.** A
programmatic roll must pass it explicitly or the roll never enters the message registry and the
chain breaks.

**The target snapshot is not an attack-roll thing.** `flags.dnd5e.targets` comes from the
activity mixin's message flags, which *every* usage card and *every* damage card gets whole. So
a spell with no attack roll anywhere still tells you exactly who it was aimed at.

**`dnd5e.preApplyDamage(actor, amount, updates, options)` cancels on an explicit `false`**, and
the native tray passes the **damage message** as `options.originatingMessage`. It fires on
whichever client is applying, so a veto must not be GM-gated. **Healing takes this same path** —
any veto must check the roll type or it can refuse someone a cure.

**`calculateDamage` negates healing-typed entries itself** and derives `treatAs` from the
originating message's roll type — so passing the heal roll message as `originatingMessage`
makes `maximum` and `temphp` entries behave too. The shared applier needed zero changes to
apply healing.

### Activities and usage

**An activity carries its own `activation` only when `activation.override` is true**; otherwise
it inherits the item's. Spells keep casting time at item level, so an **activities-only
compendium scan finds zero reaction spells, Shield included.** Scan both signals.

**The usage card is a message *subtype* (`type: "usage"`)**; `flags.dnd5e.messageType` is the
legacy shape a migration writes, so matching only the flag no-ops on every current card.

**`dnd5e.renderChatMessage` fires for every message subtype**, so a usage card grows a module
row exactly as an attack message does.

**A damage activity rolls its damage the moment it is used**, same as an attack activity rolls
its attack. `subsequentActions: false` suppresses it — which is also how module-driven uses
avoid orphaning a native config dialog over the table.

**`activity.use()` returning `undefined` means the use was REFUSED** (no slot, no uses,
cancelled) — a different fact from a suppressed card, where `results` exists and only
`results.message` is empty. Conflating them sends you chasing suppression bugs that are empty
slot pools.

**`activity.use(usage, dialog, message)` — the dialog config is the *second* argument**, and
`dialog.configure === false` skips the roll dialog.

**`results.templates` entries are ARRAYS, not documents** — the placement pushes the raw
`createEmbeddedDocuments` return. Any consumer filtering by document fields silently drops
every live placement. `.flat()` first.

**Spell-slot consumption is skippable in data**: an activity built with
`consumption.spellSlot: false` casts with no slot at all. That is the shape innate casting
really has.

**Casting a concentration spell at the limit auto-replaces, silently** — the use ends the
existing effect and its dependents cascade away. No dialog.

### Saves and concentration

**`isSuccess` is a bare `total >= target`** — there is **no nat-1/nat-20 override on saves** at
5.3.x, so a verdict computed the same way can never disagree with the card.

**The global `system.bonuses.abilities.save` is NOT folded into `rollSavingThrow`** (measured:
a +30 bonus produced a total of 10). Force save outcomes through the per-ability
`system.abilities.<abl>.bonuses.save`.

**Forcing advantage/disadvantage with `configure: false`**: the keybinding pass recomputes
`advantageMode` unconditionally from the roll's `advantage`/`disadvantage` booleans — set
*those*, never `advantageMode` directly. Situational bonuses go in `config.rolls[0].parts`.

**A failed concentration save changes nothing natively, and neither does 0 HP.** Nothing in the
system links HP, statuses or save results to `endConcentration`. Both breaks are the module's.

**`getConcentrationDC(damage)` is `clamp(floor(damage/2), 10, 30)`** — the 30 cap exists only
under modern rules. The native trigger requires net HP+temp loss; rest and advancement return
before the damage hook fires, so it never sees them.

**A save message carries `flags.dnd5e.roll = { type: "save", ability }` — nothing marks it as
concentration.** Module rolls carry their own marker; a bare sheet roll is recognized by actor
+ ability + the *absence* of an originating message (a save belonging to an activity chain must
never be mistaken for a concentration answer).

**The save enricher's click really does chain**: the post builder derives `originatingMessage`
from the click's enclosing card, and the enricher passes the event through — so a save rolled
from a module card's `[[/save]]` button arrives chained to that card.

### Effects and marks

**A mark names its placer through `origin`, and there are TWO shapes**: normally the source
item's own effect, but the caster's *concentration* effect when the message carries one. A live
mark took the first branch while its ranger was concentrating throughout — so code to neither.
Walk the uuid up to the nearest Actor, and if no Item was passed, read the item flag off the
origin effect. **Concentration is never a gate**: the dependent cascade deletes the mark when
concentration breaks, so a mark still on the target still counts.

**`system.identifier` is NOT unique across rule versions.** The 2014 pack ships a Hunter's Mark
with the same identifier and *no bonus-damage activity at all*. A suite that selected by
identifier scored 4/8 with every negative assertion passing vacuously. **Select content by the
SHAPE you need, not by the identifier.**

**A usage card's `system.effects` is relative-uuid suffixes**, written immediately before the
card is created — so it is readable at `preCreateChatMessage`.

### Weapon masteries

**Eligibility is trait + weapon**: the wielder's mastery trait must contain the weapon's base
item AND the weapon must have a mastery set. With `configure: false` the roll takes the
weapon's own mastery and stamps it on the attack message; an ineligible wielder stamps nothing.
A test fixture needs **both** fields.

**The native usage card prints the mastery name in its subtitle** ("Simple Melee • Push"), so
matching announcements by `/push/i` over message content finds the *system's* card first. Match
module announcements by flag, or at minimum by their eyebrow text.

---

## 3. The statblock caster

Where most of the monster-side bugs lived.

**A 2024 statblock does not cast from the spell item at all.** Its Spellcasting feature carries
one **`cast` activity per spell**, and the activation, the resource and the consumption all
live on *that activity*. The linked spell item reports `spellSlot: true` with no uses and no
slots. Interrogating the spell item concluded every statblock caster was unable to cast, so
none ever held.

**`CastActivity#use` never uses itself.** It resolves (or lazily creates) a **cached copy of the
spell on the actor** and calls *that item's* `use()`. Three consequences the whole monster side
rests on:
- `dnd5e.postUseActivity` fires with the **cached spell's** activity — so matching on the used
  activity's item name gives "Shield", not "Spellcasting";
- a linked cast **never spends a slot**;
- payment routes to the **cast activity's own uses** instead.

That is why a statblock caster with 0/0 slots can cast at all.

**The system materializes that cached spell by itself**, about half a second after a cast
activity is created. Building one by hand races it and leaves the actor with **two** items of
the same name. Fixtures must wait for it, not build it.

**On a cast activity, no uses pool means AT-WILL** — the opposite of the spell-item rule.

**`prepared` is a PC concept.** Every levelled spell on a 2024 statblock reads `prepared: 0`.
Gating eligibility on it silently disqualifies the whole monster side.

**An NPC's spell-slot maxima are derived** and recompute to 0; a leftover `value` with `max: 0`
is phantom data.

**A name match is not a reaction.** A hobgoblin *wears* a shield — an equipment item literally
named "Shield". Matching an interrupt list on name alone made every shield-carrying monster hold
the chain for a spell it cannot cast. Eligibility must require a real reaction activation, at
item level or on an overriding activity.

**One name can match several items.** An armoured caster owns a worn shield AND the cached
Shield spell; `items.find()` returns whichever sorts first. Every question about a reaction —
did the effect land, what is its AC bonus, what artwork does the popup show — must route
through the one resolver that prefers the cast activity's cached spell. The mechanics came out
right for a long time while the *table was told the wrong thing*.

**⚠ `system.attributes.ac.calc === "flat"` returns before `ac.bonus` is ever added** — and
`ac.bonus` is exactly the field Shield's effect writes. **On a flat statblock the reaction is
inert**: the effect lands, the bonus reads 5, AC never moves, and the attack still hits. No
module can fix this; the system is refusing to count it.

**This is the first thing to check when a reaction "does nothing" on a monster.** It is bad
data, not a shape to support — the Monster Manual is 383 natural / 116 default / **1 flat** out
of 500. The fix is one field: `calc` → `natural`, leaving `flat` as the number (verified: the
printed AC does not move, and Shield now counts).

---

## 4. Lessons that generalize

**A change that only moves WHEN something happens can make a latent race reachable.** The
player-rolled damage offer added no new writer and no new state — it added fifteen seconds of
delay, and that was enough to turn a theoretical lost-merge into a measured double-application.

**A lost receipt entry is two faults, not one.** The card under-reports, *and* the receipt is
the idempotence guard — so a missing entry reads as "not applied yet" and the consequence lands
twice. Any flag that doubles as a guard must be written under a lock.

**Silent partial application is the worst failure class this module has.** It is the reasoning
behind the rider intersection rule, and behind refusing a no-GM degraded mode. Prefer "did
nothing, and said so" over "did some of it".

**When a report arrives, read the actual log and flags before theorising.** The flat-AC bug
looked exactly like the module bug that had just been fixed; one read of `ac.calc` settled it.

**Fix the content, not the module.** Every time a misbehaving ability was traced to its
compendium data, grafting the data was cheaper and more durable than teaching the module a
name. The module's job is kinds, not names.

**Structural detection is not membership.** Reading content data to decide whether a spell
participates was measured wrong in both directions — a premium spell shipping no count field at
all (so every fresh copy arrives bare), and a teleport spell shipping a count *with* a damage
activity (a false positive that would have fired on its mishap damage). Name-keyed registries
are the answer.

**Every copy of an idiom drifts.** Three walks of table findings traced back to new machines
copying the stamp/route/pop/answer/resolve pattern instead of composing it. Compose, or expect
the drift.

---

## 5. Process

### Deploy

WebDAV hot-deploy puts script changes live on the next world reload (F5) — no bounce, nobody
disconnected. **`module.json` changes keep vending old values until the Foundry process
restarts.** Expected, not a failure.

**After a deploy, refresh every other connected client.** The apply elect is usually the human
GM window, and it runs whatever code it *loaded* — a stale window fails brand-new assertions
while everything else passes. Ask the table first if a live session is running.

**⚠ The front cache serves module scripts briefly stale after a WebDAV deploy — and the cache
key is the *vended version string*.** Scripts load as `file.js?v=<version>`, the cache holds
each key for minutes, and the vended version only moves on a process restart. So every deploy
between two releases shares one cache key, and a suite launched seconds after a deploy runs
minutes-old code. **This burned half a night chasing phantom failures.** Wait a few minutes
after a deploy before any suite, or use a staging install (bump the version, build the zip,
register it through Foundry's own installer) when the result must be deterministic — a new
version string means a virgin cache key.

### Release

Three commits, then a tag on the middle one: `test:` the harness → `feat:`/`fix:` the code plus
the version bump *(tag this one)* → `docs:` the handoff. Assets are the zip **and** a bare
`module.json`. Commit bodies are **ASCII** — the log shows non-ASCII punctuation getting
mangled.

**⚠ Build the zip with `tools/build-release.ps1`, never `Compress-Archive`.** On Windows
PowerShell 5.1, `Compress-Archive` writes `scripts\file.js` with a **backslash**, which
Node-based extractors treat as one literal filename and drop at the archive root — so the entry
point resolves to nothing and the module installs as an empty shell. The build script reads the
archive back and fails on any backslash entry; that check is the whole point. **Every release
from v1.1.0 to v1.1.15 shipped that way** and never bit only because the live box is
hot-deployed rather than installed from the zip.

### Testing against the live sandbox

The sandbox is a byte copy of prod — same world id, same users, same fixtures — which is
exactly why a suite pointed at the wrong instance is easy to miss and expensive. Every harness
resolves its target in one place and prints the target it chose.

**⚠ Disconnect the MCP bridge before any suite run**, and let the sole-GM preflight fail the
run loudly if anything else is connected. Measured: one cast created two identical effect
chips, one attack posted two Push cards, and damage applied twice.

**How the elect is actually picked, because the obvious reading is wrong.** Core's
`Users#activeGM` picks the **highest-role** active GM; id breaks ties only between *equal*
roles. The human GM is role 4 and both assistant accounts are role 3, so **the user's own
window keeps the elect while it is connected — live MCP assistance during play is allowed.**
What still makes the disconnect matter: `isActiveGM()` is per-**user**, not per-page, so every
page on the elected account runs the apply/sweep — one GM-capable client *per account*. And
bridge and suite are both role 3, so with no role-4 client connected they **tie** and id
decides; the suite may not be the elect. The bridge is a hot standby that inherits the elect the
moment no role-4 client is around — which is why leaked processes matter.

**The world-settings reference table lives in `tools/verify-settings.mjs`, and only there.** It
was previously mirrored in a doc; a mirror is a thing that drifts. When the user changes a
setting, update that table — never fight the world to match a stale copy.

**⚠ Run suites one at a time, not chained in a single shell command.** A back-to-back battery
produced exactly one polluted assertion — a message-count delta of −20 — green in isolation,
twice. The shape says a prior suite's teardown sweep landing late.

**⚠ A crashed run launders its pins into the next run's "prior".** A suite crashed with its
settings pinned; the immediately-following green rerun snapshotted those pins as the "prior" it
faithfully restored. Eleven settings drifted with every suite reporting success. Settings-first
restore cannot catch this — **only an external reference can.** Verify world settings against
the reference table after every battery.

**Every teardown restores SETTINGS FIRST, in its own guard.** The teardowns used to run one
try/catch around the whole cleanup with the restore in the middle, so any earlier cleanup error
silently skipped it — and a night of failed diagnostic runs left settings residue on the live
table, which then got mis-read as the user's own tuning. **The user's config is sacred;
deletes and sweeps are best-effort.**

**A suite fixture that presses a status must plant canonical-id carriers only.** A random-id
disabled leftover cannot be removed by the standard cleanup, so the victim became immortally
prone and the poisoned fixture starved three sections **across runs**.

**Announcements leak across suite section windows.** A verdict card trails its fold by
dice-animation seconds, so a section that flips a setting and opens a new observation window can
catch the *previous* section's announcement wearing the old setting. Drain your own
announcements before leaving a section, and attribute cards by content signature, never by
keyword alone.

**The `applied` receipts land AFTER the announcements.** An assertion that reads `applied` the
moment the card appears races the last flag write and flakes. Wait for the receipt itself.

**Run the hook-order check before the battery** whenever a file, an import, or a same-hook
registration was added. It needs no Foundry and fails loudly.

---

## 6. Working with this table

- They **dogfood live and report bugs from real play.** Trust those reports — they have been
  right every time. Reproduce in the harness before fixing, and add the assertion that would
  have caught it.
- They **will ask whether a feature is worth its complexity, and they mean it.** Answer with
  the real cost and a recommendation *before* building, not after.
- They **keep git clean and want the rev cut when the work is done.** Never leave a bumped
  version dangling without the matching release. Build and test freely, then *offer* the
  release — they say yes, but the offer is the courtesy.
- They **test immediately after a release**, so say plainly what is live, what needs an F5, and
  what needs a process restart.
- They **cut prose that repeats itself.** Say it once.
- **Surface doc/code disagreements** rather than silently choosing.
