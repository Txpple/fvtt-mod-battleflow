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

⚠ **AND THE REMOVAL SIDE FAILS THE OPPOSITE WAY — IT THROWS (2026-08-24).**
`toggleStatusEffect(id, { active: false })` resolves the canonical id and issues a delete
**without re-checking that the effect is still there**, so anything removing the same status
concurrently wins the race and leaves the call rejecting with
`ActiveEffect "dnd5edead0000000" does not exist!` straight out of the server backend. ⚠ **That
race is ordinary, not exotic:** restoring a pool above zero is exactly what makes dnd5e clear
`dead`, so any code that raises HP and *then* tidies the mark is racing the system every time.
Take statuses OFF through `clearStatus`, the twin: delete every carrier by its own id, re-read
before each delete, treat a lost race as success, never throw. **Between them the pair is the
rule: `toggleStatusEffect` is unreliable in both directions and the two failure modes are
opposite — a silent no-op adding, a throw removing.**

**Never key persisted data by uuid.** Foundry expands dotted keys on write and every uuid
contains dots: `{ "Actor.abc": "cast" }` is stored as `{ Actor: { abc: "cast" } }`, so every
lookup misses silently and forever. Per-target state is an **array of entries with a `uuid`
field**.

**An async hook handler's throw is invisible.** `Hooks.on("x", doc => { void f(doc) })` turns
any rejection into an unhandled rejection nobody logs. Anything fallible in a
fire-and-forget handler needs its own try/catch with a `console.error`.
⚠ **AND A CLICK LISTENER IS THE SAME HAZARD, which cost three battery runs to see.**
`button.addEventListener("click", () => doThing(...))` discards the promise exactly the way
`void` does. When `revertTarget` started rejecting on the status race above, the symptom was
not an error — it was **two writes that quietly did not happen**: the actor was reverted and the
card never recorded it. ⚠ **The only channel it was ever visible on was
`window.addEventListener("unhandledrejection", …)`**, which is now how `smoke-battleflow` §4c
asserts it. **A suite that drives a button should listen on that channel; it is the one place a
no-catch listener can fail.**

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

**A MEASURED TEMPLATE IS A REGION NOW, AND THE `*MeasuredTemplate` CRUD HOOKS ARE NEVER
DISPATCHED (v14.365, measured 2026-08-24).** Creating one embedded `MeasuredTemplate` moves
`scene.templates` 0→1 **and `scene.regions` 0→1**, and the hooks that fire are
`preCreateRegion` / `createRegion` / `drawRegion`. Updating it dispatched **nothing at all** —
not one hook name moved. Deleting it fired the Region trio. `documentName` still reads
`"MeasuredTemplate"` and the document still lands in `scene.templates`, so **everything about
the document looks normal; only the dispatch has moved.** ⚠ A listener on
`createMeasuredTemplate` therefore registers cleanly and does nothing forever — the D10
failure class, on the CORE side, where the dispatch gate cannot reach: the same extraction that
recovers 105 `dnd5e.*` names from that system's bundle recovers **0 of 15** core names from
Foundry's minified client bundle. ⚠ **It stood for eight days as a correct measurement with an
unexamined cause:** `smoke-saves` §8 had counted the zero since 2026-08-16 and a source
comment recorded it faithfully — *"the CRUD hooks measurably never fire on this page"* — and
**nobody asked why the count was zero.** A correct measurement with an unexamined cause reads
exactly like a known limitation. The way to settle it is to wrap `Hooks.call`/`callAll` and
print EVERY name that fires around the action (`tools/probe-surfaces.mjs`); the delta names the
real hook instead of confirming a guess.

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

### An unresolved `@scale` token rolls ZERO — silently (2026-08-23)

⚠ **The most expensive single fact of the d20-fold pass, and it fails in the quiet direction.**
Measured in the sandbox against a real Bard 5 and a real Fighter 2:

```
new Roll("@scale.bard.inspiration", bard.getRollData())       →  "1d8",  total 7   ✅
new Roll("@scale.bard.inspiration", recipient.getRollData())  →  "0",    total 0   ⚠
```

The second **does not throw and does not warn.** A missing `@scale` path collapses to the literal
string `"0"` and evaluates to zero. So handing a cross-actor scale formula to the wrong actor's
roll data produces a real, public, spent-resource roll that adds **nothing**, and at the table it
reads as bad luck rather than a bug.

**Resolve a formula on the actor that OWNS it, down to a literal, before any Roll is built.**
`ScaleValueTypeDice` carries `formula`/`die` (`"d8"`) as **getters** — `JSON.stringify` shows only
`{number, faces, modifiers}`, so a serialized snapshot of one looks like it has no formula at all.
Never stringify the object into a formula; read `formula`/`die` and refuse anything that is not a
plain non-empty string.

### There is no DC for an ability check. Anywhere. (2026-08-23)

⚠ `Actor5e##rollD20Test` builds ability checks and saving throws through one private method, and
it **never sets `options.target`**. A DC reaches a roll only when a caller supplies one (an
activity's save DC does; the sheet's own check button does not). So *"when you fail an ability
check"* — the literal trigger of Tactical Mind, and of a whole family of 2024 features — **is not
computable from system data**. The GM holds that number in their head and nothing writes it down.

This is not a gap to work around with inference. It is a boundary — and the ruling that draws
it (where the module may offer BY ITSELF, and where a human must press) is written out in
`scripts/d20-folds.js`'s own header, which is the only place it can go stale against the code.

### dnd5e DECLARES ITS OWN HOOKS, machine-readably, in the shipped bundle (2026-08-23)

⚠ **This killed a "policy question" that had blocked a check for a day.** The question was *who
maintains a curated list of the hooks dnd5e dispatches, across releases* — and the answer is
**nobody has to**, because the system's own `dnd5e.mjs` carries the list twice over:

| Source | At 5.3.3 | Catches |
| --- | --- | --- |
| literal `Hooks.call` / `Hooks.callAll` names | **88** `dnd5e.*` | `rollAttackV2` and everything dispatched by a plain string |
| JSDoc blocks tagged `@memberof hookEvents`, read for `@function` | **92** names | ⚠ the **TEMPLATED** dispatches — `rollAbilityCheck`, `rollSavingThrow`, `rollSkill`, `rollToolCheck` |
| the union, `dnd5e.*` only | **105** | what `tools/dnd5e-hooks.json` holds |

⚠ **NEITHER SOURCE IS SUFFICIENT ALONE, and the gap is exactly the family that caused the v1.23.0
bug.** The roll hooks come out of ``Hooks.callAll(`dnd5e.roll${name}V2`, …)``, so no literal
exists for them and only the JSDoc above the call site names them; conversely `rollAttackV2` is a
literal with no JSDoc block. **Take both.** One hole survives even the union
(`preRollDamageV2` — templated *and* documented only in its non-V2 form) and is pinned.

⚠ **THE SAME TECHNIQUE DOES NOT WORK ON FOUNDRY, and that was measured, not assumed:** the same
extraction over `resources/app/public/scripts/foundry.mjs` (7.9 MB, v14.365) recovers **0 of the
15 core hook names this module registers** — computed names, minified, no JSDoc to fall back on.
**A core-hook check built on it would pass everything and prove nothing.**

### Forcing a die face: invert `mapRandomFace` (2026-08-23)

⚠ **The technique that turns a live fold suite from a retry loop into an assertion.** Every die in
Foundry goes through `CONFIG.Dice.randomUniform`, and `Die#mapRandomFace(u) = ceil((1 - u) * faces)`.
So to force face `n`, take the midpoint of the band that maps to it:

```js
CONFIG.Dice.randomUniform = () => 1 - ((n - 0.5) / faces);   // n on a d`faces`
```

- ⚠ **Never force 1 or 20 on a d20.** A fumble and a crit take different paths through any verdict,
  and neither is usually the case under test. `smoke-d20-folds` §3 uses **5 then 19**.
- ⚠ **Restore it in a `finally`.** A suite that leaves the PRNG stubbed makes every later section
  deterministic *without saying so* — a silent instrument failure.
- ⚠ It affects **every** die in the page, damage included. That is usually harmless and always
  worth knowing before reading a damage total.
- **Why it is worth the intrusion:** the existing `missUntilStamped` idiom can prove a STAMP but
  never an OUTCOME. Whether a reroll converts a miss to a hit — the whole feature — is
  unobservable while the reroll is random. Forcing the faces is what let §3 assert that a reroll
  **replaces** (`base + 14`) rather than **adds** (`base + reroll`).

### `itemUses` consumption targets are UUIDs on disk and ids in memory (2026-08-23)

A compendium feature that consumes another item's uses stores the target as a **compendium UUID**
(`Compendium.dnd-players-handbook.classes.Item.phbftrSecondWind`). `Activity#_remapConsumptionTarget`
rewrites it to the actor's own item id during `prepareData`, but **only via `actor.sourcedItems`**,
which matches on recorded compendium source.

⚠ **`item.toObject()` therefore shows the UUID while the live activity shows the id** — a forensic
that reads stored data concludes the remap never happened. Read the prepared activity.

⚠ **And when the remap fails, nothing says so.** An actor whose pool item came from a DDB import or
a hand-made copy keeps the UUID, `actor.items.get(uuid)` returns undefined, and any feature gated
on "does this actor have a use left" answers *no* forever. **Distinguish "pool not found" from
"pool empty" and warn on the first** — they look identical from outside and only one is the
table's fault.

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

**A blocker phrased as a POLICY question is often an unmeasured assumption wearing a suit.**
D10 stayed open on *"who owns keeping a curated list of dnd5e's hooks true across a release"* —
a real-sounding governance problem, and the wrong question. Nobody had checked whether the
system could answer it, and it could, twice over (§2). ⚠ **The tell is a blocker that names no
measurement.** D2's stale evidence row, the by-hand import graph and the sleep budget were all
this same shape: an argument everyone accepted because nobody had taken the reading.

**An instrument that can break what it measures is worth less than a coarser one that cannot.**
The hook ledger wraps `Hooks.call`/`callAll` rather than replacing the module's own callbacks in
`Hooks.events`, which would have given per-registration truth and put live function identities at
risk during the very run being measured. Coarser and trustworthy beats precise and suspect.

**Coverage is reported; rules are enforced. Do not confuse the two.** A rule that fails on a
legitimately rare case gets tuned until it passes, and a tuned-out check still *reads* as
coverage to the next person — which is worse than not having it. When the honest answer is "a
human must look at this", print it and say so.

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

**⚠ And the same blind spot bit a second time, in a new shape — v1.21.0, 2026-08-23.** The
builder enumerated `scripts/` with a **non-recursive** `Get-ChildItem`, and said so in a comment
that promised "a new phase file rides along without a tooling change". True of a new *file*;
false of a new *directory*. Phase 2 added `scripts/decide/`, and its six modules — which eleven
files import, 23 import statements — **fell out of every zip built after 2026-08-22**. A clean
install would have died on the first import and loaded the module as an empty shell. **No published
release was ever affected** — v1.20.0 was tagged 2026-08-21, before the split — and it was caught
at the next release by reading the builder's own file list.

The generalization is worth more than either bug. **Both survived because nothing ever installs
what we ship.** `check-imports.mjs` proves the *working tree* resolves; hot-deploy over WebDAV
copies the *working tree*; the zip is the one artifact nobody exercises, so it is the one
artifact that silently rots. The builder now recurses **and** re-reads the finished archive to
prove every relative import resolves to something *inside it* — the archive checking itself,
because that is the only place the defect was ever visible.

### Testing against the live sandbox

The sandbox is a byte copy of prod — same world id, same users, same fixtures — which is
exactly why a suite pointed at the wrong instance is easy to miss and expensive. Every harness
resolves its target in one place and prints the target it chose.

**⚠ THE SANDBOX CAN BE STOPPED BY WINDOWS, WITH NOTHING HERE CHANGED (2026-08-28).** The
headless server died at launch on `An Application Control policy has blocked this file` —
Foundry's own unsigned `classic-level` native module. **Smart App Control**, which vets
unsigned binaries by asking Microsoft's *cloud* reputation service and caching the answer on
the file. Nothing local had changed: the binary, node.exe and the SAC policy version were all
weeks old. The cached verdict simply expired and the re-query came back "unknown". **This is
why it presents as "it worked yesterday and no one touched it" — because no one did.** The
tells: the CodeIntegrity log (`Microsoft-Windows-CodeIntegrity/Operational`, event 3077 names
the file and the policy), and a *cluster* of unrelated unsigned binaries refused in the same
days — this repo's own `rollup.win32-x64-msvc.node` (vitest's chain) among them, so the battery
is collateral, not just the sandbox. **SAC has no exclusion list by design** — the user turned
it off on 2026-08-28 and everything loaded immediately. ⚠ That switch is one-way (re-enabling
needs a Windows reset), so it is the user's call and never a session's.

**⚠ `/api/status` "users" is not a socket count, and it blocks the prod→local refresh.** The
refresh refuses to image the world while users are connected — correctly, since a mid-write
LevelDB snapshot tears. But the count it reads sat at **1 with every client disconnected**
(measured across 90s, 2026-08-28) while `game.users` in-world showed nobody but the bridge.
**Check the in-world truth before believing the guard**, then `--force`. Same family as the
sole-GM preflight's blind spot: these endpoints count sessions, not connections.

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

**⚠ THE SOLE-GM PREFLIGHT CANNOT SEE A SECOND SUITE, and now something else does.** Two suites
launched against one box both join as `Tester Assistant`, and `preflightSoleGM` counts
**users, not sockets** — one user, one GM, preflight green. Seen for real 2026-08-23: a second
suite started while `smoke-maneuvers` was mid-run, re-pinned six settings underneath it and left
an orphaned fixture actor; nothing in the harness said a word, and the run's failures would have
belonged to neither. `tools/harness.mjs` now takes a **pid lockfile** per target: the second
starter refuses and names the first. A stale lock (the holder died) is taken over and reported,
because a suite that cannot start is worse than one that says what it stepped over.

**⚠ SOME `sleep()` CALLS ARE LOAD-BEARING, and converting them weakens the suite.** Of the 213
seconds of unconditional sleeping measured across the suites on 2026-08-23, **73 seconds sits
under an assertion that something did NOT happen** — no hold stamped, no ask raised, nothing
applied. You cannot wait for a thing not to occur, so the sleep IS the assertion's window;
`smoke-hold` has two commented exactly that way (*"give a (wrong) premature application time to
stamp its receipt"*). Say so beside the number when you write one, because the next reader is
looking for sleeps to remove.

**⚠ WAIT FOR THE THING THE NEXT ASSERTION READS — three surfaces, three moments.** A cast
produces a usage CARD (a document), a transient BANNER (a hook, immediate) and a durable card
LINE (a `renderChatMessage` decoration, later). Waiting on one and asserting on another fails a
module that is working perfectly. It happened twice in one afternoon while converting sleeps:
`smoke-resources` waited for the banner and three "the card keeps its line" assertions went red,
and `smoke-volleys` waited for `status === 'resolved'` when the two spread ROLLS post after it.
Both were the conversion, not the code.

**⚠ A BINDING DECLARED INSIDE A SECTION GATE IS INVISIBLE UNTIL SOMEONE FILTERS.** Once suites
gained `--section`, any `const` declared in one section and read from another still passed a
FULL run — declaration order is unchanged — and threw only under `--section`. Three were found
by static scan before any suite ran, and one was subtle: `smoke-maneuvers` §H deleted §B's and
§I's fixtures **by binding**, so `--section H` would have died in a cleanup line. It deletes by
NAME now. **After gating a suite, scan for names declared in one gate and read outside it.**

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
