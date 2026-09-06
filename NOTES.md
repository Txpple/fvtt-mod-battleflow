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

### v14 owns effect expiry — per effect, against the ORIGINATING combatant (2026-09-01)

**An ActiveEffect's clock is not `{rounds, startRound, startTurn}` any more.** v14's schema is
`start: {combat, combatant, initiative, round, turn, time}` plus
`duration: {value, units, expiry, expired}`, where `expiry` is a combat EVENT — `turnStart`,
`turnEnd`, `roundStart`, `roundEnd`, `combatStart`, `combatEnd` — and it **defaults to
`"turnStart"` the moment a numeric `value` is given.** The old keys still write (core shims
`rounds` → `value/units` and migrates `startRound` → `start.round`), which is why chips written
in the v12 shape kept working: they were expiring on the default event by accident.

**Core refreshes on every boundary and judges the event against `start.combatant`.**
`ActiveEffect.registry.refresh(event)` runs on `combatStart`/`combatEnd`, `roundStart`/`roundEnd`,
`turnStart`/`turnEnd`, `combatRewind` and `updateWorldTime`; `turnStart` matches when the current
combatant IS the effect's `start.combatant`, `turnEnd` when that combatant's turn just ended.
**Its own stamp is whoever's turn it is when the effect is created** (`_preCreate` →
`getEffectStart()`), and it prefers user-defined `start` keys over its own — so an effect applied
by an opportunity attack on somebody else's turn is judged against the WRONG creature unless the
writer names the attacker's combatant explicitly. `decide/chips.js` does.

**⚠ `turnEnd` and `roundEnd` refreshes do NOT recompute remaining time** ("these events never
entail a change in remaining duration"). A window meant to close at the end of the turn it was
written in must therefore ALREADY read zero — `{value: 0, units: "turns", expiry: "turnEnd"}`
is *"until the end of this turn"*; `{value: 1, units: "turns", expiry: "turnEnd"}` reads 1 at
that turn's end and lives a whole round longer than it says.

**Expiry is MARK, not delete, and it is GM-side.** `CONFIG.ActiveEffect.expiryAction` is
`"update"` (dnd5e 5.3.3 does not override it): the registry stamps `duration.expired: true` —
dnd5e's *Unavailable Effects* bucket — and only when `game.users.activeGM?.isSelf`. `"delete"`
exists and is a WORLD policy for every effect; a module tidies its own on the `updateActiveEffect`
that carries `duration.expired`. **Suppression keys off the flag, not the arithmetic:** an effect
with `remaining <= 0` keeps applying until the flag is written. `isTemporary` is
`!!expiry || Number.isFinite(value)`, so `value: 0` is still Temporary.

**⚠ `remaining` REACHES ZERO A WHOLE ROUND BEFORE THE MARK (the review's first finding,
2026-09-01 — the chip died a turn early).** A `rounds` window is measured from `start.round`
against the CURRENT round, recomputed at `roundStart` (and on every actor data prep), so a
one-round chip reads `remaining: 0` from the START of the round its boundary falls in — the
whole round in which Vex's `turnEnd` and Sap's `turnStart` both sit — and `expired` is written
only at the event. Reading zero as dead dropped Vex from the gate on the one turn it exists for.
**Zero on the clock is ALIVE; dead is the platform's mark, or a NEGATIVE clock** (which arrives
only in the round after the boundary — the arithmetic fallback for a no-GM table where the mark
is never written). `decide/chips.js` `chipIsDead`; `smoke-expiry` §10 steps a turn between the
chip and a gated swing, which no suite had done. And **the expiry mark arrives as ONE batched
update per parent, dispatched as one `updateActiveEffect` per effect, synchronously, in the same
tick** — so a tidy that deletes per hook call makes the one-at-a-time delete the synthetic-actor
note above forbids; collect per parent and flush on a microtask.

**⚠ A `turns` effect out of combat reads `remaining: Infinity`, not null** (the label says
*"None"*). Every `_prepareDuration` path in v14 assigns a number or Infinity; a null/NaN
`remaining` is unreachable, so a reader that treats those as dead is inert rather than wrong.

**⚠ `ActiveEffect#start.combat` is a ForeignDocumentField** — on the document it resolves to the
Combat, or null once that combat is deleted; read `.id` for a stamp. `getCombatantsByActor`
matches a synthetic (unlinked-token) actor by TOKEN id and a linked one by actor id — and a
synthetic actor's `id` IS its base actor's id, so `cb.actor?.id === actor.id` says "in the combat"
for a goblin whose SIBLING token is tracked. A chip then gets `start.combat` with a null
`combatant`, the one shape `isExpiryEvent` never matches: immortal, never swept. Match the way
the platform matches (core.js `activeCombatFor`, review finding 4).

**⚠ `_preCreate` fills only the `start` keys that are `undefined`** — an explicit `null` survives.
But `combat: null` does NOT make a chip time-based while the BEARER is tracked: the duration
prep and `isExpiryEvent` both fall back to `getCombatantsByActor(this.actor)[0]`, the bearer's
own combatant, and judge from `roundJoined`. So for an attacker who is in a running combat but
not in the tracker there is no better `start` to write than the platform's own (review finding
20, measured and refused).

**⚠ `DialogV2` ALWAYS has a default button.** With none flagged, the FIRST button is the default
(`isDefault = default || (i === 0 && !buttons.some(b => b.default))`), autofocused, and every
button is `type=submit` — so Enter, including Enter typed into a text input inside the dialog,
presses the first button. "No default" on a three-mode popup meant "Advantage on Enter"; the
gate marks its NET (user ruling 2026-09-01, `decide/present.js` `modeButtons`).

**⚠ `canvas.grid.measurePath().distance` is in the SCENE's units** (`scene.grid.distance` per
space, labelled by `scene.grid.units`, a free string dnd5e never maps). On a 1.5 m grid two
squares read "3"; the Prone rule is 5 FEET. Convert through `dnd5e.utils.convertLength` after
folding the units string (`decide/geometry.js` `lengthUnitKey`); an unreadable unit is
"distance unknown", never feet. The line in §2 below that called it "grid units (feet here)"
was true of the fixture and false of the world.

**⚠ Out of combat there is NO clock.** The only non-combat tick is `updateWorldTime`, which
fires when the GM presses the calendar HUD or takes a rest with *Advance time* ticked (off unless
chosen). A `rounds`/`turns` effect with no combatant is reframed as seconds (`CONFIG.time.roundTime`
× value) and measured against world time; a 6-second chip sits at "6 seconds remaining" forever,
alive, and any sweep that reads `remaining` reads it as alive. A `turns` effect out of combat
reads `remaining: Infinity`, label *"None"* (the premium PHB's Guiding Bolt ships exactly so;
this line said `null` until 2026-09-01 — it is not).
**Rules windows that are turn-shaped therefore have no end outside combat — the EVENT that spends
them (the next attack) is the only close, and that is the rule, not a gap.**

**⚠ `game.combat` IS THE COMBAT OF THE SCENE *THIS CLIENT* VIEWS — and three things read it.**
The platform's implicit `start` stamp (`getEffectStart(game.combat)`), `Actor#inCombat`
(`!!game.combat?.getCombatantsByActor(this).length`), and this module's own `activeCombatFor`.
A client looking at another map sees no combat at all: an effect it creates lands time-based with
no combatant, and — because world time advances **six seconds at every round boundary** — the
round's `updateWorldTime` refresh then expires every chip whose clock has run out on the TICK
rather than on its event (`isExpiryEvent` treats time advancement as satisfying any combat event
for an actor whose `inCombat` reads false). The first run of `tools/probe-expiry.mjs` measured
exactly this by accident, from a client that had not viewed the range. **Suites view the range
before creating a combat; a GM viewing another scene mid-fight would see the same drift, and
nothing in the module can prevent it** — the explicit `start.combat` the chips now carry keeps
their remaining-time arithmetic honest on any client, but not the world-time path.

**Out of combat the PREPARED duration is reframed**: a chip written `{value: 1, units: "rounds"}`
reads back as `{value: 6, units: "seconds"}` on `effect.duration` while `_source.duration` keeps
what was written. Assert on `_source` for the window, on `duration` for the platform's reading.

`duration.type` survives as a deprecated getter (`typeof value === "number" ? units : "none"`,
warns once, gone at v16) — read `units`/`value`/`expired` instead. Measured live by
`tools/probe-expiry.mjs`; pinned by `tools/smoke-expiry.mjs`.

---

### v14 models an emanation end to end — MEASURED (2026-09-03, tools/probe-emanations.mjs)

- **`RegionDocument.createTokenEmanation(token, range, regionData, {excludeToken, gridBased})`**
  makes a Region whose one shape is `{type: "emanation", base: {type: "token", …}, radius}` — the
  token's base plus the radius in pixels, an elevation band either side — **attached to the
  token** (`attachment.token`). Moving the token moved the shape; membership (`region.tokens`)
  was recomputed as it went. **The token is not a member of its own emanation.**
- **Any region can be attached** the same way: `region.update({attachment: {token: id}})` on a
  template's region moved the template document too.
- **The native `applyActiveEffect` behaviour** (`{effects: [uuid]}`, events `tokenEnter` /
  `tokenExit`) applied the effect on entry, lifted it on exit, lifted it when disabled and
  re-applied when re-enabled, and fired when the AREA moved onto a standing token. ⚠ Its
  handlers run on **`event.user.isSelf` — the client that moved the token** — so a player
  walking the Paladin onto a monster would try to write the monster. The module's own type runs
  its handlers on the active GM instead (the flow-elect law), with the membership floor as truth.
- **`tokenTurnStart` / `tokenTurnEnd` are dispatched by the Combat to the one designated GM**
  (`#onEndTurn` → `#triggerRegionEvents(TOKEN_TURN_END, context, [combatant])`).
- **A module-defined behaviour subtype must be declared in `module.json`** —
  `"documentTypes": {"RegionBehavior": {"emanation": {}}}` — or the server refuses any document
  carrying it **silently**: `Region.create` returned `undefined`, `createEmbeddedDocuments`
  returned `[]`, no error anywhere. Cost a run. The type id is `<module-id>.<name>`; the class
  goes into `CONFIG.RegionBehavior.dataModels` at `init` (dnd5e does the same for
  `dnd5e.difficultTerrain`), and a manifest change needs the process restarted.
- **A behaviour type's `static events` map** subscribes it; handlers are called with `this` as
  the type instance (`this.region`, `this.behavior`). Define the class INSIDE `init` — the
  static gate loads the module with `foundry = {}`.
- **A headless page has no token animation context**: a plain `token.update({x, y})` threw
  inside `#createAnimationMovementPath`; pass `{teleport: true, animate: false}` — and a FRESH
  options object per update, because Foundry defines a per-token property on it and a reused
  object throws "Cannot redefine property". A destination off the scene is refused without a
  word (only `preUpdateToken` fires) — a "moved out" reading against an off-scene square is a lie.
- **A template's region shares the template's id**, and the template's `flags.dnd5e` are copied
  onto it — which is how a cast emanation is recognised (`origin`, `item`, `spellLevel`).
- **A freshly created region's `tokens` is EMPTY for the first beat** — membership is computed
  after the create settles. A record of "who stood inside when the area appeared" taken from
  `region.tokens` at creation came out empty (smoke-emanations, sixth live run); read the
  template's geometry instead (`tokensInTemplates`). And **write such a record BEFORE creating
  a behaviour on the region**: the behaviour subscribes at once, and attaching the region raises
  `tokenEnter` for everyone inside — a handler that read the record before it landed asked
  twice.
- **`borderColor` on a MeasuredTemplate create came back `#000000`** on this box — the border
  stays black whatever is passed; `fillColor` takes. Foundry draws only TEMPORARY effects on a
  token (a duration, or a status) — a standing effect with neither has no token icon; a module
  status id on the effect is enough (`statuses: ["bfEmanation"]`, no CONFIG registration needed).
- **dnd5e 5.3 does not delete a placed template when concentration ends** (smoke-emanations §8
  measured the template standing after `endConcentration`), and `ActiveEffect5e#addDependent` is
  deprecated for the `dependentOn` flag — which only `Activity`, `SystemDocument` and
  `ActiveEffect5e` carry (`DependentDocumentMixin`), **not** `MeasuredTemplateDocument`. A module
  that wants an area to end with concentration deletes it itself on `deleteActiveEffect` of the
  concentrating effect, keyed by `effect.flags.dnd5e.activity.uuid` against the template's
  `flags.dnd5e.origin`.
- **A usage's placement prompt is `usageConfig.create.measuredTemplate`**, switchable in
  `dnd5e.preUseActivity`; `results.templates` is then `[]` at `postUseActivity`. dnd5e's own
  template for a `radius` type carries `flags.dnd5e.dimensions.adjustedSize: true` and adjusts
  the drawn radius by the token at draw time; a module-placed circle carries the adjusted
  distance itself (size + half the token in feet) and no `dimensions` block.
- **`game.combat` is `ui.combat.viewed` whenever the tracker is rendered** — the encounter the
  GM is LOOKING AT, not the active one (`Game#combat`, read 2026-09-03: only with no tracker does
  it fall back to `combats.find(c => c.isActive)`). A stale GLOBAL encounter (scene null, a walk's
  leftover at round 4) stayed viewed while a suite's freshly created, started, activated combat
  was not — so `activeCombatFor` read every combatant of the new fight as "out of combat", and
  `Combat#activate` alone does not change what is viewed. A suite that needs its own encounter
  to be THE combat cannot reliably take the view from a standing GLOBAL encounter — deactivating
  it, assigning `ui.combat.viewed`, making its own combat global: the tracker re-picked the stale
  one within a beat every time. The stale encounter was deleted (user's call) and the suite runs
  clean; a table with two encounters standing should expect the module to follow the tracker.
  ⚠ And a GLOBAL (scene-less) combat raised NO `tokenTurnEnd` for the range's regions — the
  Combat dispatches its turn events to the regions of ITS scene. A suite's combat is scene-bound.
- **The floor must be serialized.** One token move fires the region's enter event, `updateToken`
  and `updateRegion` within a tick; three reads of "no effect yet" before any create landed wrote
  the effect three times (Half Speed stacked to ×0.0625). One reconcile in flight per region, and
  one sweep per scene — the same lesson as `queueFlagWrite`, on documents instead of flags.
- **An ActiveEffect on a linked actor shows on every scene the actor has a token on** — and a
  campaign's party has a token left standing on every scene it has visited (Thomas: 22, read
  2026-09-04). A Region's `tokens` set and its events are per scene, so an aura applied through
  the token on scene A stands on the token on scene B where nothing will ever lift it, and B's
  own ring writes a second copy under a different region id. Two consequences the module now
  lives by: an emanation stands on the ACTIVE scene only (DESIGN §5), and a lift must read the
  world's actors, not just the scene's tokens — the token that wore the effect may be on another
  scene, or deleted.

**A bare token move is WALKED, and a teleport needs the `displace` action (measured 2026-09-04,
the test range, Foundry 14.365 / dnd5e 5.3.3).** `document.move([{x, y}])` with no action takes
the token's default action (walk): a wall stops it (`constrainMovementPath`, walls: "move") and
dnd5e's *full* movement automation stops it in front of a hostile creature. **`blink` is a
teleport that is STILL wall-checked** (its config carries walls: "move") — it stopped at the same
wall. **`displace`** (teleport: true, walls: null, canSelect: false — the action Foundry uses for
its own undo) crossed the wall and the creature, both as a waypoint action and as the token's
`movementAction` document field, which the schema accepts for any key of
`CONFIG.Token.movement.actions`. `constrainOptions: { ignoreWalls, ignoreTokens }` on the move's
options also crosses both — but those are the CALLER's to pass, and the animation module's
teleport passes none. The hooks: `preMoveToken(doc, move, options)` fires AFTER the path is
constrained and can only veto (`false`); `moveToken` fires after the commit. `move.destination`
is the final waypoint. A sight ray is `CONFIG.Canvas.polygonBackends.sight.testCollision(from, to,
{ type: "sight", mode: "any" })`. ⚠ A fix on this was built and PULLED BACK the same evening
(user: *"this particular fix isn't really a Battle Flow scoped item"*) — it is a movement-pipeline
concern, not a rule of the game this module resolves; the working patch is
[prototypes/teleports-in-battleflow.patch](prototypes/teleports-in-battleflow.patch), and its
home is the new sister module **fvtt-mod-miscpatches** (same evening, user call), where it ships
as `scripts/patches/teleports.js` with its own suite. Also measured: the animation module's own
"check collision" preset option is a MOVE-collision ray tested at the circle, before any move —
a wall refuses there whatever the pipeline would do; that is the preset's setting to turn off.

## 2. dnd5e 5.3.x

### Rolls and damage

**Hit/miss is computed at render time and never persisted.** Recompute downstream.

**Spells INHERIT activation; features DECLARE it (2026-09-02, the corpus scan over the 2024
packs).** A spell keeps its casting time on the item and an activity carries its own
`activation` only with `override: true`; a feature has no item-level activation at all — every
activity declares its own type with no override flag ever set. A test that demands the override
(the worn-"Shield" guard) refuses every 2024 reaction feature — Deflect Attacks, Warding Flare —
in silence. `decide/eligible.js isReactionItem` now tests the override for spells only.

**Some features are a paragraph and nothing else.** The 2024 PHB ships Uncanny Dodge, Steady
Aim, Evasion and a hundred-odd more with no activities, no activation, no effects. Nothing on
the item can be read; a curated list naming one means the feature BY NAME
(`isTextOnlyFeature`), and whatever a use would have done (spend the Reaction, write a chip)
the module does itself.

**DialogV2 sizes to its content and never scrolls it.** Eight menu rows under a card pushed
the footer — and the only button — off the bottom of the viewport. Anything that can grow
goes in its own `max-height: calc(100vh - Nrem); overflow-y: auto` box inside the content.

**The pre-roll hooks fire BEFORE the fast-forward keys are read (2026-09-01).** `buildConfigure`
dispatches `dnd5e.preRoll<Name>` / `preRoll<Name>V2` for every hook name, *then* calls
`applyKeybindings`, which is what turns a shift/alt/ctrl click into `dialog.configure = false`
and the mode booleans. So at hook time `dialog.configure` is whatever the CALLER passed —
undefined for every human-initiated roll, fast-forwarded or not; `false` only when code
suppressed the dialog (the resolver, the rays, a macro, the suites). **That is the whole basis
of the reminder gate's "no dialog, no gate" rule**, and the reason a shift-click is still gated.
Returning `false` from the hook cancels the roll cleanly: `rollAttack` resolves null, the usage
card keeps its Attack button, nothing is consumed twice — a re-issue is the same call the button
makes. The attack hook is TEMPLATED (`dnd5e.preRoll${hookName.capitalize()}V2` with
`hookNames: ["attack", "d20Test"]`), so both `preRollAttackV2` and `preRollD20TestV2` fire and
neither is visible to the dispatch gate — pinned, like `preRollDamageV2`.

**`getTargetDescriptors()` at the top of `rollAttack` reads `game.user.targets`** — the roller's
own targets on the roller's client — and the message's `flags.dnd5e.targets` is built from the
same set. A pre-roll reader that wants the targets reads `game.user.targets` directly.

**⚠ THE GATE LIVES INSIDE THE SYSTEM'S OWN ROLL DIALOG, and these are the seams it rides
(2026-09-02).** (1) `dialog.configure = true` written in a pre-roll hook SURVIVES the fast-forward
keys: `applyKeybindings` sets `dialog.configure ??=`, so a hook can force the dialog open under a
shift-click. (2) `dialog.options` are handed straight to the dialog's constructor
(`RollConfigurationDialog.configure`: `new this(config, message, dialog.options)`), so any key put
there — dnd5e's own `defaultButton`, or a payload of ours — is `app.options.<key>` at render.
`defaultButton` is read first in `_prepareButtonsContext`; "normal" is a valid value. (3) The
dialog's buttons are `type=submit` with `data-action` and the default carries `autofocus`; the
press reaches `#handleFormSubmission` through the form's submit event, so a `.click()` on one is a
real press. (4) A change to any of the dialog's own selects re-renders ONLY its `formulas` part
(`_onChangeForm` → `render({ parts: ["formulas"] })`) — a sibling inserted after the
`[data-application-part="configuration"]` fieldset stands through it — and every render, partial
or not, fires `renderRollConfigurationDialog` (the hook polish.js already rides), so a section
rebuilt from the form there follows the dropdown. `new FormDataExtended(app.form)` reads the
form's current values. (5) `dnd5e.postRollConfiguration` (the generic, in the dispatch set) fires
after the dialog closes with the FINALIZED rolls — `rolls[0].options.advantageMode` is what was
pressed — and before `buildEvaluate`/`buildPost`, so a write to `message.data` there lands on the
created message. A closed dialog hands back no rolls. (6) The ranged/melee question is
`activity.attack.type.value`, and a thrown weapon is the dialog's attack mode `thrown`/`thrown-offhand`;
a weapon's normal/long range is `item.system.range.{value, long, units}` unless
`activity.range.override`, a spell's is the activity's single `range.value`.
(7) A volley's rays never reach these seams — they roll `configure: false` — so the gate's judge
(`reminders.js` `judgeRoll`, a target and a spent-set handed in) runs in the volley's own aim
popup per ray, and the record goes out on the ray's roll as message DATA
(`flags.<module>.reminder` on `rollAttack`'s message config), which is exactly where
`postRollConfiguration` would have put it. A `<details>` element folds a section to its summary
natively — no toggle code, and `textContent` still reads the folded boxes, so a suite can assert
them closed.

**⚠ AT PRE-ROLL TIME `originatingMessage` COMES IN THREE SHAPES, AND ON THE BUTTON FLOW IT IS NOT
THERE AT ALL (review findings 2 and 12, 2026-09-01; the re-issue those findings were about is
gone since 2026-09-02, the facts stand).** The usage card's Attack button calls
`rollAttack({ event })` and nothing else; `buildPost` derives the id from
`event.target.closest("[data-message-id]")` AFTER the pre-roll hooks and `expandObject`s the
message data there. The sheet/`use()` auto-roll passes it as a FLAT key,
`message.data["flags.dnd5e.originatingMessage"]` — `mergeObject` expands dotted keys only at the
top level, so the nested path reads undefined at hook time. A hook that keys on the card reads
the event's enclosing card first, then the flat key, then the nested one (`reminders.js`
`usageCardFor`). And a RE-ISSUE that forwards no event has no link: `buildPost` finds nothing,
the message never enters `dnd5e.registry.messages`, `getAssociatedRolls("attack")` on the card
is empty, the Damage button rolls with no crit and no attack mode, and this module's own chain
walk misses it. **Write the flat key yourself on a re-issue.** ⚠ Do NOT forward the raw event
to fix it: `D20Roll.applyKeybindings` re-reads `altKey/ctrlKey/shiftKey` off `config.event` on
the re-issue, so an Alt-clicked Attack whose human then pressed Disadvantage would roll NORMAL.
The suites used to pass the flat key explicitly, which is exactly why they were green.

**With `configure: false` the attack mode, ammunition and mastery are exactly what the dialog
would have PRE-FILLED** — `config` → `last.<activityId>.*` → the first option — and the
human's chance to change them is what goes missing. `dialog.options.attackModeOptions` (may
carry `{rule: true}` separators), `ammunitionOptions` (a leading blank = none) and
`masteryOptions` (only when more than one and no `config.mastery`) are on the hook's `dialog`
argument; the roll-mode select is `CONFIG.ChatMessage.modes` (v14) minus `ic`. The mastery pick
is stamped on the attack message (`flags.dnd5e.roll.mastery`) and this module's riders key on it.
The spell-slot / resource CONSUME choice is the USAGE dialog's, before any attack roll, and a
pre-roll gate never touches it.

**A plain `x`/`y` update on a TokenDocument is a MOVE under v13+'s movement pipeline, and it can
be refused with no error** — measured 2026-09-01 on the test range (no walls): the update
resolved and the document stayed put, `{teleport: true, animate: false}` included. The reminder
suite stopped moving tokens and places a second one where it needs a distance measured.
`canvas.grid.measurePath([a, b]).distance` is SCENE units (see §1): 100px apart = 5 on the
fixture's 5-ft grid, and 1.5 on a 1.5 m grid.

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

**…and it fires AGAIN for an old card whenever the log re-renders it** — a flag write on the
card, an actor or effect change dnd5e refreshes cards for, and at a reload for EVERY card. A
machine that uses render as its "reload resume" and judges from the world as it stands
(distance, a ward on the sheet, a turn chit, a pool) will re-judge an old hit against a table
that has moved on. The shields suite caught it three ways in one full run (2026-09-05): a ranged
hit "paid" because the earlier melee card from 10 feet re-rendered after the attacker stepped
back to 5; an empty list "paid" because an unwarded hit's card re-rendered once the ward was
put on; a once-per-turn chit stood on the NEXT turn because the previous turn's second hit
re-rendered after the turn ended and wrote the chit afresh. Every section passed alone — the
residue was the earlier section's CARDS, not its state. The house gate is the appliers' (auto-apply.js,
hold/spell-damage.js): create judges an unheld roll once; update and render resume only a roll that WAS held
(`attackHoldPending === false`), once, with a stamp on the card so a reload cannot resume it
twice. `damage-shields.js` `consider` carries the note.

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

### What the platform applies for a 2024 condition — MEASURED, nothing to build (2026-09-03)

`tools/probe-conditions.mjs` pressed every one of the fourteen statuses (and Exhaustion 1 and 3)
on a fixture and read the derived data, the system's own `calculateDamage` (the receipt's
source) and a `configure: false` ability check. dnd5e 5.3.3 does all of it itself, through
`CONFIG.DND5E.conditionTypes` — the status effects carry NO `changes` at all; the system reads
the status set directly in data preparation:

| Clause | Who does it | Reading |
| --- | --- | --- |
| Petrified: Resistance to all damage, Immunity to Poison, immune to Poisoned/Diseased | the system | `dr.value ["ALL"]`, `di ["poison"]`, `ci ["poisoned","diseased"]`; a 10/10/10 slashing/poison/fire hit calculates 5/0/5 — the receipt honours it with no row |
| Speed 0 — Grappled, Restrained, Paralyzed, Petrified, Unconscious | the system | every movement key 0 |
| Paralyzed / Stunned / Petrified imply Incapacitated; Unconscious implies Incapacitated AND Prone | the system | `conditionTypes[x].statuses` / `riders`; the implied status lands on the actor |
| Exhaustion: −2 × level on every D20 Test, −5 ft × level Speed | the system | `1d20 + 1 - 2` at level 1, `- 6` at level 3; walk 25 / 15; `reduction: {rolls: 2, speed: 5}` |
| Poisoned: Disadvantage on ability checks | the system | `2d20dis + 1` on a `configure: false` check — the ROLL is bent, not just a dialog default |

⚠ Two consequences for the module. **A row that re-applied any of these would double it** — the
gate may REMIND (the Poisoned ability-check box is a reminder of a bend the dice already carry),
never apply. **Unconscious ending does NOT lift Prone** (rules-correct — you are still on the
floor), so a fixture that toggles Unconscious must toggle Prone off itself.

### The 2024 auras: the effect ships, who-is-inside does not (2026-09-03)

Read off the premium PHB packs (tools/probe-emanations.mjs):

| Item | What ships | Its own Foundry Note |
| --- | --- | --- |
| Aura of Protection | a TRANSFER effect *Protected* (`system.bonuses.abilities.save add @abilities.cha.mod`) on the Paladin; **no activity, no size in data** — the "10-foot" is prose | *"should not be used for other impacted characters because it will add their Charisma modifier and not the Paladin's"* |
| Aura of Courage | a utility activity whose template size is the formula **`@scale.paladin.aura`**, and a non-transfer effect *Courageous* with **no changes** | *"an Active Effect for tracking who is within your aura but it is not automatically added/removed nor does it remove the Frightened condition"* |
| Aura of Warding | a transfer effect with the three resistances; a utility activity with range 10 ft and no template | *"not automatically granted when a character enters/exits your aura"* |
| Aura Expansion (18) | text only | *"The range of your auras update automatically as you level up"* — because the size is the class's scale value |
| Spirit Guardians | a save activity, 15-ft `radius` (labelled Emanation), Wis, 3d8 necrotic/radiant, *Half Speed* (`movement.speed multiply 0.5`) with `onSave: true` | — |
| Aura of Vitality | a 30-ft emanation heal activity plus a second *Start of Turn Heal* activity aimed at one creature | — |

**The Paladin class carries a `ScaleValue` advancement `aura` (type distance): 10 at 6, 30 at 18** —
`actor.getRollData().scale.paladin.aura` is `{value: 10}` on a built Paladin 10 and `null` on a
Paladin 5. That object's `toString` is "10 ft", so read `.value`; `Roll.replaceFormulaData` over
it would put "10 ft" into a formula. **A formula on an effect resolves against the actor wearing
the effect**, which is what the pack's note on Protection warns about and what
`decide/emanations.js` `resolveChanges` reads in from the source before the platform hands it out.
⚠ A built Cleric 5 fixture with Wis 16 computes Spirit Guardians' DC as 11, not 14 — the class
item built without the advancement manager carries no spellcasting ability, so the DC is 8 +
proficiency; the content's number, not the module's.

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

### A roll's `dialog.options` reach the app as a COPY — carry state in a class instance (2026-09-02)

`Actor5e##rollD20Test` deep-clones the dialog config before the pre-roll hooks, and
`ApplicationV2._initializeApplicationOptions` merges the options into a fresh object: **a plain
object handed to `dialog.options` arrives at `app.options` copied twice**, so a machine that
stamps state on it in a pre-roll hook and reads it back on the rendered app is reading a different
object. Measured: the attack gate's re-judgement and the Sneak Attack tick were written on the
copy while `postRollConfiguration` read the original — the tick recorded as unarmed. Both
copiers pass a **class instance** through by reference (`deepClone` returns anything whose
constructor is not `Object`; `mergeObject` assigns it), so the gates carry `ui.js`'s
`DialogCarried`. `Object.freeze(options)` is shallow — the nested bag stays writable.

### `dnd5e.rollDamageV2` hands over the rolls and the activity, not the message (2026-09-02)

`rollAttackV2`'s `rolls[0].parent` is the attack message; the damage twin's is not reliably the
damage message. A machine that needs the damage MESSAGE the moment it lands listens to core's
`createChatMessage` and gates on `message.isAuthor` — the same locality (the roller's client)
without the guess. `sneak.js`'s effects run that way.

### The save machine REFUSES a dead target, and a fixture must survive the feature (2026-09-02)

A 7d6 Sneak Attack kills the 11-HP fixture goblin outright, and `stampSaveDemand` then skips the
corpse (the v1.19.0 dead-target gate) — so every Cunning Strike effect vanished with no error
anywhere: the demand was never stamped, for the truest of reasons. The suites give the victim a
400-HP pool for the run. When a chain "does nothing" after a big hit, read the target's HP before
the code.

### A built character resolves its scale values without the advancement manager (2026-09-02)

`Actor.create` with a class item whose `system.levels` is set, plus the subclass item, yields
`getRollData().scale.rogue["sneak-attack"]` (a `ScaleValueTypeDice` — `.number`, `.faces`,
`.formula`) and `@scale.gloom.dreadful-strike` beside it, and a Cunning Strike activity's
`save.dc.value` computes off the sheet (`tools/probe-rogue-fixture.mjs`). `level-up-pc` does not
persist advancement (NOTES §5 on the clones), but a class item at a level is enough for the
scale — which is what the built fixtures rest on. `Roll.replaceFormulaData(formula, rollData)`
turns `@scale.rogue.sneak-attack` into `7d6`; `parseDice` refuses anything that is not plain
dice, because an unresolved token rolls ZERO (above).

### The 2024 PHB pack's Envenom Weapons says 2d6 and ships 2d8 (2026-09-02)

The feature text reads *"the target also takes 2d6 Poison damage"*; the pack's Poison activity
carries `2d8`. The module reads the activity (N1 — the content is the content), so the table gets
2d8 until the pack is corrected; the registry row says so. The same pack misspells the feature's
own transfer effect *Assasinate*.

### The 2024 pack ships the Battle Master's maneuvers three ways at once (2026-09-04)

Measured item by item in `dnd-players-handbook.classes` for the hit menu. Three shapes, and a
reader has to take all three:

- **Two activities, the consumption target a bare IDENTIFIER.** Trip, Goading, Menacing,
  Pushing, Disarming, Maneuvering: a damage activity named *Superiority Die* (activation
  `special`, `@scale.battle-master.superiority.die`, all thirteen types) whose `itemUses`
  target is the string `combat-superiority`, plus a save activity (*Strength Save* / *Wisdom
  Save*). Advancement remaps the identifier to the item's ID on a built character; a clone or
  a hand-added item keeps the identifier.
- **One unnamed damage activity, the target a COMPENDIUM UUID.** Distracting Strike and
  Sweeping Attack: `Compendium.dnd-players-handbook.classes.Item.phbftrCombatSupe`. The reader
  matches it against the actor's item by `_stats.compendiumSource` (and by the UUID's last
  segment, for a source that was re-keyed).
- **Where the condition lives differs by row.** Menacing's Frightened and Goading's *Goaded*
  are effects LINKED to the save activity (`activity.effects[]`, `onSave: false`) — the saves
  machine applies them on the failure. **Trip's Prone sits on the ITEM with `activity.effects`
  EMPTY** — nothing applies it unless a follow-up presses it (`onFail: "prone"` in
  `HIT_OPTIONS`, the Envenom Weapons shape). Distracting's *Distracted* is linked to its damage
  activity, so it lands on the hit with no save at all. Pushing and Disarming carry no effect.

`hit-menu.js` `poolOf` / `dieFormulaOf` are the readers. `Roll.replaceFormulaData` resolves
`@scale.battle-master.superiority.die` to `d8` — a bare die with no count — which Foundry's
parser reads as one die but which the card should not print; the reader prefixes the `1`.

**Combat Superiority's own text has the pick limit** — *"You can use only one maneuver per
attack"* — and the DC rule (8 + Strength OR Dexterity + proficiency, the player's choice). The
save activities carry their own DC; the demand card reads it off them, never computes it.

### The pack ships Goaded as a TRANSFER effect, and that is why Goading Attack "did nothing" (2026-09-04)

The walk's report — Goading Attack demanded its save, Jetten failed, nothing landed — took four
measurements to pin, and the first conclusion (the MCP importer dropping the effect) was WRONG in
the part that mattered. The facts, in the order they were found:

1. The item on Morgash had no "Goaded" effect while the pack's copy has one linked to the save
   activity (`activity.effects[]` naming an id the item no longer carried — `resolves: false`,
   `applicableEffects: []`). The saves machine did everything right over an empty list.
2. A copy rebuilt from the pack carried Goaded, survived twelve seconds under my client, and
   survived a server restart on both Morgash and the test fighter — persistence was never the
   problem. It was gone again after the table's next session.
3. **Goaded is `transfer: true` in the pack.** With `legacyTransferral` off, a transfer effect on
   an item is a PASSIVE on the wielder: Morgash's own sheet listed Goaded (user: *"morgash says
   goaded … but he should never have the effect … it should be who he hits"*). A passive with a
   one-turn clock is exactly what a turn expiry or a hand tidy of the wielder's Effects tab
   deletes — and deleting it from the actor's sheet deletes the ITEM's only copy, which is what
   the save activity pointed at. The other seven maneuvers' effects are `transfer: false` and
   never moved.

**What the module does now (hit-menu.js):** a row's target-facing effects (the save activity's,
the damage activity's, the `onFail` status effect) with `transfer: true` are corrected to
`false` on the WIELDER's own copy of the item — world data, never the compendium — by the client
that owns the actor, at `ready` and when the item lands (`repairTransferEffects`). A copy that
has already lost the effect is not stranded: the follow-up presses it from the compendium's own
copy, found by the item's recorded source or by NAME in the premium packs (a copy made from pack
data records no source — the fixture's, the importer's, a hand-built one), the same effect id
the activity names (`compendiumCopyOf`). `smoke-hitmenu` §9c and §11 pin both.

**The rule that generalises:** when a save "applies nothing", read whether the activity's effect
entries RESOLVE before reading anything else. And a tester's second GM-capable client is a real
hazard while the table plays: two elects apply twice and the twin-dedupe floor removes both —
the harness's sole-GM preflight is the guard, and `--observe` on a probe bypasses it on purpose;
use it only with the world otherwise empty.

`tools/fixture-morgash-maneuvers.mjs` compares an actor's maneuvers against the pack effect by
effect and rebuilds a mismatch under `--fix`; `tools/probe-hitmenu-table.mjs` reads a hit-menu
demand card's flags.

**dnd5e 5.x has NO advantage flags — `flags.dnd5e.advantage.*` is gone (measured 2026-09-04,
5.3.3: zero hits in the system bundle).** The mode of a roll is a FIELD on the sheet:
`system.abilities.<abl>.save.roll.mode`, `.check.roll.mode`, `system.skills.<skl>.roll.mode`,
`system.tools.<tool>.roll.mode`, `system.attributes.{init,death,concentration}.roll.mode`. An
effect bends a roll by changing that key by ±1 (mode ADD; OVERRIDE forces), and the system's
`AdvantageModeField` counts the sources and resolves them by the rules (any advantage against any
disadvantage is normal) — `roll.modeCounts` on the prepared data holds the COUNTS, not the sources,
so nothing on the actor can say WHO bent the roll; only the effect changes can. The system also
sets some modes itself, from a rule and not an effect (heavy armour → `skills.ste.roll.mode` −1;
`hasConditionEffect("abilitySaveDisadvantage")` → every save −1), and those have no change to
read. The gates' `modeSources` reads the changes; the rest is the platform's own default and
stays unexplained by design (DESIGN §5).

### A DamageActivity's follow-up is a DIALOG; a HealActivity's too (2026-09-05, Heat Metal)

`DamageActivity#_triggerSubsequentActions` calls `rollDamage({event}, {}, {...})` — a damage
roll WITH the configuration dialog — and `HealActivity`'s does the same for its healing. The
ATTACK activity's is what does nothing after the card. So a bare damage spell (Heat Metal) or a
maneuver whose activity is typed damage (Feinting Attack's die, Commander's Strike's die) opens a
roll dialog on use, and with `hideCardButtons` on that dialog was the only path to Heat Metal's
2d8 — and a machine that also rolls would roll TWICE. The volley machine's claim is the fix:
`usageConfig.subsequentActions = false` in `dnd5e.preUseActivity`, then the module's own roll
(damage-casts.js) or none (superiority-uses.js, the fold files — the die belongs to the hit). A
heal's dialog is left alone: Rally rolls through it and the cast slice lands the temp HP, which
is the pack's design working.

### The cast slice will apply EVERY effect a utility activity links — Bait and Switch ships twelve (2026-09-05)

The 2024 pack models Bait and Switch's rolled AC bonus as TWELVE effects, "Baited AC +1" through
"+12", all linked to the "Switch Places" activity, for the player to apply the one matching
their roll. polish.js's `castApply` stamp reads "a utility with effects and a target" and the
elect applied all twelve to the willing creature: AC 13 → 91 (smoke-superiority, first live
run). Evasive Footwork's "Evasive AC" is the same class — a changeless placeholder for a rolled
number. superiority-uses.js strips the stamp for every Battle Master maneuver card one hook
after polish.js writes it (`flags.<module>.-=castApply` in `preCreateChatMessage`; the entry
order puts polish.js first). **The rule that generalises:** a pack that models a rolled number
as a fan of effects is not content for the cast slice; the machine that rolls the number
applies the one effect.

**The second shape of the same finding (2026-09-05, the walk of the overnight four):** Fire
Shield ships Warm Shield AND Chill Shield on its one utility activity — "as you choose" — and
marks nothing to say they are alternatives, so the same stamp landed both on Gren and he wore
Resistance to Cold and to Fire at once (the walk's "resistance didn't apply" was the pair
landing, not the change failing: each effect carries its `system.traits.dr.value` add, measured
on the PHB pack). The pack has no field for "one of these"; the module's EFFECT_CHOICES row is
where that fact lives, and the cast slice asks (cast.js, the Effect Choices list). A cast with
several effects that all stand together (Bless, the Paladin's auras) is unchanged.

### A utility activity with a roll formula does NOT roll it at the use — and the card's button is hidden (2026-09-05, Tactical Assessment)

The 2024 pack ships Tactical Assessment and Ambush as utility activities whose `roll.formula`
is the Superiority Die, consuming Combat Superiority. `use()` spends the die and posts a card
with a Roll button; it rolls nothing. Battle Flow hides the card's buttons (the v1.12.0 policy),
so a player pressing the maneuver on their sheet BEFORE the check spent a die and got nothing —
the walk's "Tactical Assessment does nothing". The rescue path (roll the check, be offered) never
met this because it never uses the activity from the sheet. Now the use is the ARMING
(d20-folds.js): the module rolls the formula itself, chips the number, and folds it into the
next check the scope names. Same class as Heat Metal's follow-up dialog (above): dnd5e leaves a
second click for the human, and the module has hidden the thing to click.

### The 2024 auras' SAVE clauses ship as prose only (2026-09-05, Aura of Purity)

Measured on the PHB pack: Aura of Purity's effect carries the Poison Resistance and nothing
else; Circle of Power's "Circle's Power" carries no change at all; Holy Aura's "Holy Protection"
carries +1 to every save's roll mode (the one the system reads). So "Advantage on saving throws
to avoid or end effects that include the Blinded, Charmed … condition" and "Advantage on saving
throws against spells" exist only in the description. The effect table's `saves` facet holds
them (decide/registry.js), and the save gate reads the DEMAND — the pending `saves` card's
`demand` — to judge them: the demanding activity's item type, and the statuses its failed-save
effects carry. A spell whose condition is not modelled as a status on its effect (a DDB import,
a hand-built spell) is invisible to this, the same limit every effect reader has.

### The emanation names what it applies "Effect — Source", and every effect reader matched exactly (2026-09-05)

The walk: Aura of Purity stood on Morgash as **"Aura of Purity — Thomas"** (emanations.js
appends the caster so two auras of one spell can be told apart), the demand card said
"against Paralyzed", the fixture path proved the gate end to end — and the table saw nothing,
because `effectSources`, `effectCheckSources` and the new `effectSaveSources` all matched an
effect's name to its row EXACTLY. So Holy Protection applied by the region was never read by
the attack gate either, since the day the second slice shipped. One helper now
(`effectNamedAs`: the bare name, or the name with " — " and anything after) serves every
reader. **The rule that generalises:** a reader that matches by name must know every shape
the module itself writes that name in; the fixture suites plant effects by hand under the bare
name and cannot catch this — the walk did.

### The offer row: NOTHING above the rule fold — the third time (2026-09-05)

Cunning Strike's rows lost their caveat line on 2026-09-02 ("just the rule tick"), the hit
menu's on 2026-09-04, and Lunging Attack's rider row shipped one anyway ("if you moved at least
5 feet…"). User: "you keep making this mistake … putting extra text above the rule tick".
`riderMenuHTML` and `hitMenuHTML` now IGNORE a row's `caveat`; a condition the module cannot
judge is in the pack's own rule text, folded. The card is where a caveat may be said.

### dnd5e marks a 0-HP creature `dead` on its own (2026-09-05, Aura of Life)

The built Ranger fixture at 0 HP wore the `dead` status without anyone pressing it, and a heal
guard that read "not if dead" refused the one creature the text names ("an ally with 0 Hit
Points"). The Hit Points are the condition; the platform's mark is bookkeeping. `healTriggerDue`
reads HP alone.

### Two "Parry"s, one name (2026-09-05)

The Monster Manual's Parry is a `utility` Reaction whose roll is `@prof` — a +AC reaction the
Interrupt list carries as `Parry:ac`. The Battle Master's Parry (the classes pack) is a `heal`
Reaction whose healing formula is `@scale.battle-master.superiority.die + max(@abilities.str.mod,
@abilities.dex.mod)` — the REDUCTION, modelled as a retroactive heal ("can be used to
retroactively recover the received damage", says the pack). The hold tells them apart by the
ACTIVITY (`INTERRUPT_REDUCTIONS["Parry"].activity === "Heal"` on the found item), never by the
name: the fighter's becomes a `damage` interrupt with the formula on the hold, the monster's
stays `ac`. The reduction is rolled at the ANSWER (the die spent from the pool, the Reaction
spent), rides the hold target as `reduceBy`, and `reduceDamages` takes it off the parts in order
before `applyDamage` — the receipt row reads "Parry — reduced by N".

### A scale-value die must be resolved on the SHEET IT BELONGS TO (2026-09-05, Commander's Strike)

`@scale.battle-master.superiority.die` on the fighter's Directed Attack rode the ALLY's weapon
roll as written and read 0 on the Ranger (the d20-folds' bardic lesson, again: an unresolved
`@scale` token rolls zero in silence). The command stamp resolves it on the fighter
(`Roll.replaceFormulaData` against the fighter's roll data, "d8" read as "1d8") before it is
armed for the injection.

### The rescue window is a DOM window; the chat log is an application too (2026-09-05, suites)

Two suite lessons the superiority suite paid for: a text match over `foundry.applications.instances`
finds the CHAT LOG (it renders every card's text) before the popup, so a popup finder must
exclude the sidebar classes; and the d20 folds' rescue window is the spine's own DOM window —
found through `document.querySelectorAll(".application")` with a `[data-bf-rescue-row]` inside,
its rows `[data-bf-rescue-action="<kind>"]` elements, not `data-action` buttons (the d20-folds
suite's idiom).

### The combat tracker's roll never fires `dnd5e.rollInitiative` (2026-09-05, the walk)

"Ambush works for Stealth but not for Initiative." The suite rolled through
`Actor5e#rollInitiative`, where dnd5e's hook lives; the table presses the tracker's d20, which
is `Combat#rollInitiative` → `Combatant#getInitiativeRoll` → an update and a message, and the
actor method is never entered. The platform's own `flags.core.initiativeRoll` on the created
message is the witness that covers BOTH roads, and by the time it exists the combatant's number
is already written (Foundry updates the combatants before creating the messages). d20-folds.js
stamps from that message too, latched so the two roads meet once. A suite that only exercises
the API method is not exercising the button.

### `dnd5e.rollSkill` hands over the skill; `dnd5e.rollInitiative` fires after the number is set (5.3.3)

The skill/tool hooks' second argument is `{ ability, skill|tool, subject }` — the scoped folds
read `data.skill` there. `dnd5e.rollInitiative(actor, combatants)` fires after
`Combat#rollInitiative` has written the combatant's initiative; the roll's own message is the
last `flags.core.initiativeRoll` message the actor authored, and a fold that moves the number
updates the combatant (`combatant.update({initiative})`) after composing.

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

**A record lands a round trip before its delete, and anything created in between meets the
thing twice.** The chip spend writes its receipt first (R5), then deletes the chip; a volley's
ray 2 was created in that gap and wrote the same Vex up again (smoke-volleys §10j, 2026-09-02).
The log-walk guard (`chipSpentOnRecord`) covers the case across time; an in-flight set on the
client covers the gap. Any consequence that is "record, then mutate" has this gap, and a second
event inside it is not hypothetical when events are driven back to back.

**A key with a dot in it is a PATH on a flag, never a name.** `setFlag` expands dotted keys
into nested paths, so a map keyed by actor uuid (`applied["Actor.x"] = true`) never reads back —
and a claim that never reads back is a loop: the Death Strike follow-up re-applied the attack's
damage on every card update until the victim was at zero (2026-09-02). The saves machine had
already written the rule down ("per-target state is an ARRAY with uuid fields — never a
uuid-keyed map"); the lesson is that every per-target record on a flag is that shape, including
the ones a new machine writes in a hurry.

**A registry row handed to a document must be COPIED.** `Object.freeze` on the table is right;
Foundry's document migration writes into an effect's `changes` on create, and a frozen array
refuses the whole create with *"Cannot add property type, object is not extensible"* — one
`.map(c => ({ ...c }))` at the seam (use-chips.js, 2026-09-02).

**"Until the start of your next turn" is NOT a one-round window when the thing is spent on
somebody else's turn.** A Reaction taken before the reactor's turn in the round comes back at
that turn, less than a round later; the `rounds: 1, turnStart` clock (right for Sap, which is
spent on the sapper's own turn) returned it a round late. The reaction chip is `0 turns,
turnStart` for the platform's mark, and its liveness is stamp arithmetic (`reactionStands`):
the reactor's next turn after the chip's start. When a window's start and its owner's turn can
differ, write the arithmetic; the duration data alone cannot say it.

**A combat left standing in the sandbox reds the battery for the wrong reason.** Two suites
assert "out of combat" facts — `smoke-battleflow` §3b (the roll context's combat is null) and
`smoke-effects` §17b (the Cleave arm's stamp is null) — and both go red under any running
Combat, whatever created it (2026-09-03: the user's own encounter from a morning walk, Practice
Dummy / Morgash / Jetten, round 2). The battery does not end combats and must not (they may be
the user's); look at `game.combats` before diagnosing either red, and ask before deleting one.

**"The" roll dialog is a list, never a first match.** Since 2026-09-03 three machines open the
system's RollConfigurationDialog (the save demand, the Topple save, the concentration ask) and
any of them can be standing while an attack dialog opens — a pending concentration ask on the
player's own client is the live case. `smoke-nogm` read the first rendered one, found the
concentration dialog, and reported "no gate" against an attack gate that was open (15/19, twice,
2026-09-03). Filter all rendered dialogs and tell them apart by what THEY carry — the attack's
class, our `[data-bf-reminder]` section, our `[data-bf-save-demand]` fieldset — never by position.

**A suite that reads a dialog after pressing it reads nothing.** The app's element is gone once
the dialog closes; every assertion about what a dialog SHOWED is read before the press and
carried out. Two hours of "the box is missing" on a box that was there (smoke-sneak, 2026-09-02).

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

The sandbox is a byte copy of prod — same world id, same users — which is
exactly why a suite pointed at the wrong instance is easy to miss and expensive. Every harness
resolves its target in one place and prints the target it chose.

**⚠ NOT the same FIXTURES, and this line used to claim otherwise (corrected 2026-09-01).** The
`BF Test` actors and their scene are deleted from PROD on purpose — they clutter the campaign's
actor list — so they exist in the sandbox alone. `pull-prod-to-local.mjs` MIRRORS prod, and a
mirror faithfully reproduces a deletion: **every refresh wipes the fixtures**, and every suite
then dies at its preflight with "missing fixture: scene or BF Test actors". Run
`tools/fixture-suite.mjs` first after any refresh — it rebuilds them all, filed under a
`Test Suite` folder so they stay cheap to keep. The same trap in a subtler form is recorded at
`smoke-battleflow.mjs:842`: a mirror once deleted BF Test PC Attacker's player OWNERSHIP along
with the actor, and two suites failed for a reason that looked nothing like the cause. **The
world is disposable, so everything a suite needs must live in a fixture step.**

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
setting, update that table — never fight the world to match a stale copy. **Since 2026-09-03 the
shipped defaults in `scripts/settings.js` are meant to agree with it** (user call: everything
ships on), so a table change is two edits, the reference and the default. ⚠ The tool exits 1
on unfixed drift since the same day — a battery once printed "settings clean" over six drifted
settings because drift alone exited 0.

**⚠ Run suites one at a time, not chained in a single shell command.** A back-to-back battery
produced exactly one polluted assertion — a message-count delta of −20 — green in isolation,
twice. The shape says a prior suite's teardown sweep landing late.

**⚠ A crashed run launders its pins into the next run's "prior".** A suite crashed with its
settings pinned; the immediately-following green rerun snapshotted those pins as the "prior" it
faithfully restored. Eleven settings drifted with every suite reporting success. Settings-first
restore cannot catch this — **only an external reference can.** Verify world settings against
the reference table after every battery.

**Effect and feature NAMES from the packs carry colons, ampersands and the odd misspelling
("Adv: Attacks & Saves", "Assasinate").** A list spec that splits on ":" eats them; the Effect
Sources spec is parsed whole-chunk (`whole: true`) and matched lower-cased on both sides. The
scan that found them (2026-09-02) read the packs' LevelDB off disk through `classic-level`
from a COPY without the LOCK file — Foundry holds the real one — and embedded effects live under
their own `!items.effects!<itemId>.<effectId>` keys, not inside the item record.

**⚠ A MID-RUN RESTORE GOES BACK TO THE SUITE'S OWN BASELINE, NEVER THE WORLD'S PRIOR
(2026-09-02).** `smoke-reminders` §6 turns the Reminder Sources list off to prove the list is
the switch, then put it back to `prior.reminderList` — the world's value from before the suite
pinned its own. The day `range` joined the kinds, the world still carried the pre-range list
(verify-settings read it as drift, correctly), so every section after §6 judged with range
DISABLED: §10's four range checks failed in a full run and passed under `--section 10`, and a
live probe showed the feature working — the failure was the suite's alone. `prior` is for the
TEARDOWN; inside the run, restore to the constant the suite itself pinned. The tell is the
same as the launder above: a section-only run that is greener than the full run.

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
registration was added or removed. It needs no Foundry and fails loudly — since 2026-09-05 on
any drift from `tools/hook-order.snapshot` too, not only on the named pairs; a deliberate
reorder refreshes the snapshot with `--snapshot` in the same commit.

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
