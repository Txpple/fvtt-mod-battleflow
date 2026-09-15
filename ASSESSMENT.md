# ASSESSMENT — Battle Flow on dnd5e 6.0.1 (written 2026-09-15, evening)

> A commission file, like HANDOFF: it exists because dnd5e 6.0 landed on prod and Battle Flow
> stopped. It is retired when the compatibility pass ships. Everything below was measured, not
> guessed: the 5.3.3 → 6.0.1 source diff (573 files, 27,684 lines added) read against every
> Battle Flow call site, the 6.0.0 release notes, and one battery run on the sandbox at 6.0.1.

## 0. Where things stand

- **Prod runs Foundry 14.367 and dnd5e 6.0.1, with Battle Flow SWITCHED OFF in the world.** The
  sandbox is an exact copy of prod and its module configuration has Battle Flow disabled. Prod
  is playing without the module today.
- **The module cannot be switched back on as shipped.** `module.json` pins dnd5e to a maximum of
  5.3.99. Foundry's server silently refuses to activate a module whose declared system maximum
  is exceeded: the setting write is accepted and dropped. (Measured on the sandbox: the client
  reports the package "verified", the world setting never changes.) With the pin raised on the
  sandbox copy the module activates, the entry script loads, and all 50 settings register.
- **Every hook Battle Flow registers still fires by the same name.** The hook inventory was
  regenerated from the 6.0.1 bundle: 8 hooks added, 0 removed. The V2 roll hooks still dispatch.
  The roll classes (`D20Roll`, `DamageRoll`, `aggregateDamageRolls`, `simplifyBonus`) are at the
  same paths. The roll configuration dialog templates are unchanged.
- **What moved is the chat message.** Every roll card is now a typed message (`attack`,
  `damage`, `healing`, `save`, `check`, `generic`, `usage`, `prompt`, …) with a data model, and
  nothing is written to `flags.dnd5e` any more. The world migration DELETES the old flags from
  historical messages. Battle Flow reads those flags in roughly 90 places across 40 files, and
  every guard that reads one now fails closed. The battery's very first chain shows it: the
  attack lands, the damage rolls, and no receipt follows.
- **Battle Flow's sandbox state right now:** the module.json pin raised on the SANDBOX copy only
  (6.0.99), the module enabled in the world, the BF Test fixtures placed, a world snapshot taken
  BEFORE the fixtures (`tools/world-snapshot.mjs restore` returns it to the exact prod copy), and
  the battery running to `dist/battery/2026-09-15T18-09-57/`. The repo is untouched except
  `tools/dnd5e-hooks.json` (regenerated at 6.0.1) and this file.
- **The 6.0.1 source** is cloned in the session scratchpad (`dnd5e-src`, tags `release-5.3.3`
  and `release-6.0.1`) — the diff quoted below is reproducible with one `git diff`.

## 1. Why it broke, in one paragraph

In 5.3.3 a roll card was a plain message carrying `flags.dnd5e.{messageType, roll.type,
activity, item, targets, originatingMessage}`. Battle Flow was built as a reader of that log:
who was hit, what rolled, from which card. In 6.0.1 the card IS the data: `message.type` says
what it is, `message.system.{origin, targets, activity, item, ability, mode, mastery,
ammunition, onSave, resisted, level}` says the rest, target descriptors are token-precise
(`{actor, token, ac, img, name}` — there is no `uuid` key), and the message registry files rolls
by `system.origin` only. Alongside that, three smaller foundations moved: activity areas are
Regions now (no MeasuredTemplate is created), an activity's effect profiles resolve their
effect asynchronously, and `CONFIG.statusEffects` became an object keyed by id.

## 2. The breaks, by class, with the fix

Each class is one rewrite applied everywhere it occurs. Counts are call sites found in
`scripts/`; the per-file lists are in the diff analyses (kept with the session; ask and they are
pasted into NOTES).

### A. The manifest pin — the module cannot be enabled (1 file)
`module.json` `relationships.systems[0].compatibility.maximum: "5.3.99"`. Raise to `6.0.99`,
verified `6.0.1`, minimum `6.0.0` (nothing below 6.0 can run the rewritten code). Regenerate
`tools/dnd5e-hooks.json` (done, uncommitted) and the `verified` pin check passes.

### B. `flags.dnd5e.roll.type` → `message.type` (≈25 sites, 20 files)
The base guard of every chain: `auto-apply.js:51` (attack damage never auto-applies),
`shared.js:77` `resolveAttackMessage`, `auto-damage.js:135`, `hew`, `hit-riders`, `riposte`,
`chip-spend`, `mastery`, `lookup`, `bash-offer`, `hold/*`, `polish`, `saves/views`,
`saves/consequences`, `topple`, `ui.js:1028` (the demand's rollType fact), `reminders.js:736`
(reads `message.data.flags.dnd5e.roll.type` at postRollConfiguration → `message.data.type`).
Mapping: attack→`"attack"`, damage→`"damage"`, healing→`"healing"`, save→`"save"` (death and
concentration are ALSO type `"save"` now, discriminated by `system.type === "death" |
"concentration" | "ability"`), ability/skill/tool→`"check"`, initiative→`"check"` with
`system.type === "initiative"`, utility→`"generic"`.

### C. `flags.dnd5e.targets` → `system.targets`, and the descriptor lost its `uuid` (≈20 sites)
`shared.js:32` `hitTargets` reads `t.uuid` — undefined on every 6.0 snapshot, so nothing is ever
hit. Same read in `d20-folds`, `precision`, `mastery`, `riposte`, `chip-spend`, `command`,
`cast`, `damage-casts`, `volleys`, `superiority-uses`, `hold/*`, `saves/demand`, `polish`.
New shape from `TargetsField.getDescriptors()`: `{actor, token, ac, img, name}`, keyed by token
(two tokens of one actor now both appear — a fix for the receipts' unlinked-token collision).
The pre-create snapshot Battle Flow WRITES (potion self-aim, `polish.js:84-96`) and reads
(`volleys.js:94`, `damage-casts.js:65`) lives at `messageConfig.data.system.targets`; write it
with `TargetsField.getDescriptors([token])`.

### D. `flags.dnd5e.originatingMessage` → `system.origin` (≈20 sites)
Battle Flow writes the flag on every roll it drives (`auto-damage`, `topple`, `saves/ask`,
`precision`, `d20-folds`, `riposte`, `volleys`). `getOriginatingMessage()` still resolves it
through a fallback, so the chain LOOKS intact — but the registry indexes `system.origin` only,
so every Battle Flow-driven roll is invisible to `getAssociatedRolls`, the usage card's
outcomes and summaries, and the delete cascade. Direct flag reads (`hew`, `resources`, `ui`,
`topple`, `consequences`, `hold/spell-damage`, `auto-damage`, `hit-riders`, `riposte`,
`metamagic`, `reminders`) find nothing on system-created rolls. Write `data.system.origin` (a
message id; the field resolves to the document on read, so read the id as
`message._source.system.origin` or `system.origin?.id`). A `type: "base"` Battle Flow card has
no `system.origin` — `respondsTo` stays for those.

### E. `flags.dnd5e.activity` / `.item` → `system.activity` / `system.item` (≈25 sites)
`effect-riders.js:23` `messageActivity` (feeds chip-spend, mastery, hit-menu), `polish`,
`resources`, `hew`, `riposte`, `lookup`, `precision`, `d20-folds`, `metamagic`,
`concentration.js:56`, `hold/*`, `superiority-uses`, `saves/demand`, `reminders`, `events`,
`decide/moments.js:101`. Use `message.getAssociatedActivity()` / `getAssociatedItem()` (they
read `system.*` first) or `message.system.activity?.uuid`. `flags.dnd5e.messageType` is gone
entirely; the `doc.type === "usage"` half of each test carries it.

### F. The other `roll.*` sub-keys (≈10 sites)
`roll.ability`→`system.ability`; `roll.mastery`→`system.mastery`; `roll.attackMode`→
`system.mode` (renamed); `roll.ammunition`→`system.ammunition`; `roll.ammunitionData`→
`system.deltas.deleted[]` (getter `system.ammunitionItem`); `roll.damageOnSave`→`system.onSave`;
`roll.forceSuccess`→`system.resisted` (the legendary-resistance watcher in `saves/views.js:45`
and `saves/verdict.js:107` never match). `auto-damage.js:178-186` `rollDamageForAttack` mirrors
the deleted 5.3.3 body; the 6.0.1 body is one line: `const { ability, ammunitionItem:
ammunition, mode: attackMode } = lastAttack?.system ?? {}` — and it forwards `ability`.
Usage card `system.spellLevel`→`system.level` (6 sites; a deprecated getter warns until 6.2).

### G. Effect profiles resolve asynchronously (≈12 sites)
`activity.applicableEffects` now returns profiles, not effects, and `profile.effect` is a
deprecated getter that returns a PROMISE. Every `e.effect && applicable.has(e.effect.id)` test
(`effect-riders.js:40`, `cast.js:45`, `hold/lookup.js:262`, `polish.js:187`, `saves/choices`,
`saves/consequences`, `saves/demand`, `hit-menu.js:119,307,347`) qualifies nothing and logs a
warning per read. Use `await activity.getApplicableEffects()` / `await profile.getEffect()` /
`profile.relativeUUID`.

### H. `CONFIG.statusEffects` is an object — `forceStatus` throws (1 site, 3 callers)
`shared.js:164` `.find(s => s.id === statusId)` is a TypeError. Topple's Prone, every
`SAVE_PRESSES` status, the bash choice. Fix: `CONFIG.statusEffects[statusId]`.

### I. Activity areas are Regions (≈8 sites, 4 files)
`TemplatePlacement.fromActivity` creates RegionDocuments; no MeasuredTemplate exists;
`results.templates` is `RegionDocument[]`; the region's `flags.dnd5e.origin` is now the USAGE
TOKEN uuid (was the activity uuid) and the activity moved to `flags.dnd5e.activity`.
`saves/areas.js` walks `scene.templates` and matches the old origin (never matches; its
template hooks never fire); `saves/demand.js:138`, `metamagic.js:444,503` hand regions to
`tokensInTemplates`, which expects template geometry (`geometry.js:96-169`,
`decide/geometry.js:34-43`); `emanations.js:616` counts regions as "the system placed one" and
skips `placeCastEmanation`; `emanations.js:706` ends only Battle Flow's own hand-placed
templates with concentration. Regions expose `shapes[]` and `region.tokens` — the containment
math simplifies to the platform's. New hooks `dnd5e.preCreateMeasuredTemplate` (veto),
`dnd5e.createMeasuredTemplate(activity, regionData[])` (edit before create),
`dnd5e.postCreateMeasuredTemplate(activity, regions)`.

### J. Concentration: the native prompt is back, twice (2 sites)
`concentration.js:684-692` vetoes the native prompt by matching card content; the prompt is now
`type: "prompt"` with `system.buttons[{type: "concentration"}]` and no content, so BOTH the
native whisper and Battle Flow's ask appear on every hit. New in 6.0: a `dead` or
`incapacitated` effect on a concentrator triggers `promptConcentrationEnd()` — a second native
prompt beside Battle Flow's outright break (`concentration.js:111-124`). Veto by
`doc.type === "prompt" && doc.system.buttons?.some(b => b.type === "concentration" |
"endConcentration")`, or ride the native prompts instead (§3.5).

### K. The applied clock, rule 1, is dead (1 site)
`effect-riders.js:80` reads `activity.duration.getEffectData()` and `appliedClock` tests
`cast.seconds/rounds/turns`; 6.0.1 returns `{value, units, expiry}`. Death Armor lands
clockless again. Rule 2 (the turns re-pin) still fires. The platform now has its own version of
rule 1 (§3.4) — adopt it rather than patch the shape.

### L. Effect application parity with the tray (1 file)
The tray no longer writes `origin`; it writes `system.origin.{activity|item, effect, message,
profile}`, stamps `_stats.duplicateSource = effect.uuid`, dedupes on that stamp, sets
`dependentOn` for concentration only, and runs `ActiveEffect.forApplication(changes, source,
target)`. `applyEffectsWithReceipt` (`effect-riders.js:111-179`) still writes `origin` and
dedupes on it — so a tray-applied Bless and a Battle Flow-applied Bless stack, and Battle Flow's
copies have no `system.origin`, so `matchesOrigin()`, `getSourceActor()` and the platform's
tooling do not see them. Also `dependentOn` on non-concentration copies exempts them from the
new rest expiry. Fix: build the create data the tray's way (§3.4 O2 gives the changes for free).

### M. The card DOM (2 sites)
`polish.js:283` hides `.card-buttons button[data-action]`; usage cards render
`section.icon-row > ul > li > button.icon[data-action]` now, so `hideCardButtons` hides nothing.
Buttons are data (`system.buttons[]` with `visibility`) — filter them in
`dnd5e.preCreateUsageMessage` instead. And: a save or check rolled against a usage card is
rendered as a summary INSIDE the usage card and its own message is HIDDEN by default (client
setting `chatCardSummary`, default on). Every row Battle Flow appends to a save message
(`saves/views`, `topple`, `d20-folds`, `concentration`, `reminders`, `ui.js:550`) becomes
invisible for chained saves once D is fixed. The rows belong in the summary block
(`.card-summary[data-message-id][data-target-uuid]` inside the usage card).

### N. Small semantic flips
- A null AC (total cover) is a MISS in the platform's own verdict now (`evaluatedTargets`);
  5.3.3 read it as a hit and Battle Flow leaves it to humans (`decide/verdict.js`).
- Riders share `config.rolls[0].data` by reference (`hit-riders`, `sneak`, `hit-menu`,
  `clock-riders`, `command`, `superiority-uses`, `volleys`); the new per-roll damage rules write
  `data.roll.damageType` and `@ruleBonus` into that shared object — the last rider's type
  overwrites roll 0's. `deepClone` the data per rider.
- `WeaponAttackMode` gained `"ranged"`; `reminders.js:90` and any attack-mode table should
  accept it.
- Condition immunity now SUPPRESSES the condition effect; `forceStatus` reports "refused to
  land" for an immune creature though the outcome is right.
- The active GM deletes expired effects outside combat and on a combatant's exit;
  `chip-spend.js`'s tidy now races it (tolerated by its re-checks; expect "does not exist" noise).
- The emanation card's change-key labels (`emanations.js:719-727`) name `system.bonuses.*`;
  migrated pack effects carry `system.rolls.*`. Movement keys Battle Flow writes
  (`system.attributes.movement.walk`) are shimmed silently to `movement.speeds.walk`.
- Battle Flow's `system.bonuses.rwak.damage` / `mwak` / `abilities.save` reads warn once each
  (moved to `system.rolls.*`, shim until 7.0).

### O. The test harness reads the same flags
The suites and probes assert on `flags.dnd5e.targets`, `roll.type`, `originatingMessage`
(smoke-hold died at setup on `.targets` of undefined). The battery is rewritten alongside the
module, class by class; a suite green on 5.3.3 semantics proves nothing on 6.0. The fixtures
and `verify-settings` reference table are unaffected.

## 3. What the platform now does that Battle Flow does by hand

Ranked by how much they overlap a Battle Flow ruling. Each says what Battle Flow does today,
what the platform offers, and whether they agree. The ones marked ADOPT are the shape the
compatibility fix should take anyway; the others need your ruling.

### 3.1 The origin chain and the registry — ADOPT (it is fix D)
Stamp `system.origin` on every roll Battle Flow drives and the platform files them:
`card.getAssociatedRolls("attack"|"damage"|"save"|"healing")` replaces the whole-log filters in
`consequences`, `topple`, `spell-hold`, `bash-offer`, `lookup`, `metamagic`, `reminders`;
`roll.options.originatingMessage` / `BasicRoll#getOriginatingMessage()` give the chain from
inside `dnd5e.rollDamageV2` without a message; deleting the card cascades its children.

### 3.2 Token-precise targets and the platform's own verdicts — ADOPT (it is fix C)
`TargetsField.getDescriptors(tokens)` / `TargetsField.resolve(descriptor)` replace the
hand-built descriptor and every `tokenOfActor` / `getActiveTokens()[0]` guess.
`AttackMessageData#evaluatedTargets` gives `{…descriptor, isMiss}` — the platform's hit verdict
as the base of `hitTargets`, with Battle Flow's folds adjusting the delta. For saves,
`UsageMessageData#outcomes` (token uuid → success/failure, honouring legendary resistance),
`selectOutcomes`, `SaveMessageData.{resisted, outcome, deltas}` and the damage tray's own
`saveMultiplier` (reads `system.onSave` + outcomes → 1/½/0 per target) do what `saves.targets[]
.outcome`, `saveMultiplier` and `flipForcedSave` do by hand. One divergence: null AC is a miss
(§2.N) — your call whether Battle Flow's "leave it to humans" stands.

### 3.3 Card buttons as data — ADOPT (it is fix M)
`system.buttons[].visibility` and `activity.shouldHideChatButton(button, message)` replace the
per-render DOM hide and persist across renders.

### 3.4 The applied effect's clock — ADOPT, and reconcile DESIGN §5
The platform now carries BOTH of Battle Flow's clock rules, in its own words:
- **O2, rule 1:** `Activity#getAppliedEffectChanges(effect, {chatMessage, target})` — an effect
  with no expiry and no finite duration takes the activity's duration. Call it from the applier
  and rule 1 is back, with tray parity.
- **O1, rule 2:** pseudo-expiries `sourceStart | sourceEnd | targetStart | targetEnd`
  (`ActiveEffect5e.PSEUDO_EXPIRIES`), judged against the SOURCE actor (via `getSourceActor()`)
  or the bearer, creation turn skipped, source-left-combat handled. The Miasma re-pin ("until the
  end of ITS next turn") is exactly `targetEnd`; Vex is `sourceEnd`; Sap and Slow are
  `sourceStart`; the reaction chip is `targetStart`. Activities gained `duration.expiry`, so the
  Monster Manual Miasma fix at the data becomes one field on the activity, and BACKLOG's row
  shrinks to that.
- **Divergences to rule on:** the platform pins a finite non-turns clock landing in combat to
  `turnStart`; Battle Flow's rule 2 pins to the BEARER's `turnEnd`. Out of combat a
  pseudo-expiry dies on the first time advance (Battle Flow's Vex/Sap out of combat are a bare
  one-round duration). The once-per-turn chits (cleave, sneak, rider, steady aim — "dies with
  the turn in progress, whoever's it is") have no platform equivalent and stay Battle Flow's.
- The label side is free: `duration.label`, `getSpecialDurationParts()` for the effect view.

### 3.5 Concentration prompts — NEEDS A RULING
The platform's stance is "prompt the owner" (a `prompt` card with a Concentration button on
damage; an End Concentration prompt when dead/incapacitated lands). DESIGN R1's stance is "a
determined outcome plays" (Battle Flow asks with a draining bar and breaks outright at 0 or
incapacitated). Two shapes: keep Battle Flow's machine and veto both native prompts (fix J), or
ride the native prompt cards (`system.buttons` are actions Battle Flow could press for the
table). `rollConcentration` messages are `type: "save"`, `system.type: "concentration"`.

### 3.6 Emanations and areas — PARTIAL, NEEDS A RULING
The platform now auto-attaches `dnd5e.applyActiveEffect` behaviours to an activity's area
region: on enter it creates the effects on the actor (with `system.origin`), on exit it deletes
them, dispositions derived from the activity's targeting (ally → FRIENDLY only, enemy → HOSTILE
only), and an `"emanation"` shape attaches the region to the caster's token. That is Battle
Flow's standing-aura-with-effects ruling, natively — with two divergences: Battle Flow admits
NEUTRAL creatures to a helpful aura, the platform does not; and the platform's behaviour is
created by the active GM on `createRegion`, the same hook Battle Flow's `adoptSpellRegion` rides,
so an adopted spell region gets BOTH standing effects unless one side yields
(`options.dnd5e.createActivityBehaviors === false` suppresses the platform's). What the platform
does NOT do: the turn-start heal notice (Aura of Vitality), the enter-and-turn-end save with the
once-per-turn chit (Spirit Guardians), the caster's own reach exclusion, feature auras that stand
without a cast (the Paladin's). `reconcileScene` stays regardless. Ruling needed: adopt the
platform's behaviour for the plain "effect while inside" auras and keep Battle Flow's for the
rest, or keep Battle Flow's for all and suppress the platform's.

### 3.7 Rule changes on effects — PARTIAL, a design opportunity
Effects can now carry rule changes: `attack|check|save|d20 : advantage|bonus|minimum|maximum`
and `damage|healing : bonus`, each with JSON conditions against roll data (`roll.type`,
`roll.ability`, `roll.attack.{mode,type,classification}`, `roll.damage.type`, `roll.item`,
`roll.proficient`…). The platform resolves them at every d20 and folds `damage:bonus` into
`@ruleBonus`. Sap ("disadvantage on your next attack") and Bless-class bonuses can be authored
as one effect with a conditioned rule and the dialog defaults, shows and applies it — no gate
row, no chip machinery. Vex CANNOT: roll data carries no target, so "advantage against the
creature you vexed" stays Battle Flow's. Divergence from DESIGN §5's reminder gate: a rule
PRE-SELECTS the dialog's advantage rather than reminding, and nothing spends it on the roll —
the chip's spend and receipt would still be Battle Flow's. Worth a prototype, not part of the
compatibility fix.

### 3.8 Chained cards are summaries — ride it
With the origin chain fixed, a save's verdict rows belong in the usage card's summary block
(where players will look; the save message is hidden by default). This changes where
`saves/views`, `topple`, `d20-folds` and `reminders` draw, not what they say.

### 3.9 Settings that overlap
`autoApplyDowned` (dead/unconscious at 0 HP, with `flags.dnd5e.autoDowned`, removed when HP
rises) overlaps `receipts.js clearDefeated` and the reminders' downed checks; the expired-effect
auto-delete overlaps chip-spend's tidy; `allowPlayerDamageTray` / `allowPlayerEffectsTray` let
players press the native trays Battle Flow "never removes". The reference table in
`verify-settings` grows by these, with a ruling each.

### 3.10 Smaller adoptions, free with the fix
`effect.getSourceActor()` / `matchesOrigin()` / `system.origin.message` replace
`effectSourceOf`, `grantingActor`, `hostileOriginOf`, `chipOwnedBy`'s prefix test, and the
receipt's own back-link; `system.ammunitionItem` drops the ammo rebuild; `getAssociatedActivity
({scaled: true})` replaces passing `scaling` by hand; `aggregateDamageTerms` gives receipts a
per-type dice/constant breakdown; `performBulkUpdate` / `modifyBatch` for the appliers'
delete-then-create pairs; `Actor5e#conditionRollReductions` folds exhaustion natively;
`hp.bloodied` / `hp.pct` for the bloodied facet; `dnd5e.buildDamageRollConfig` re-runs on every
dialog change — the native place for type-dependent riders (Transmuted, emanation type) instead
of a one-shot `preRollDamageV2` mutation.

## 3b. What is written against the card's HTML (the user's question, 2026-09-15)

The card's DATA is now the stable part and its HTML the unstable part — the reverse of 5.x.
dnd5e treats `message.system` as API (typed models, every rename shimmed "since 6.0, until
6.2"); the release notes say outright not to rely on the card's HTML structure, which "has
changed substantially" and now renders from Handlebars templates that will move through 6.x.
Battle Flow's HTML dependencies are FEW against ~90 data reads:

| Anchor | Where | State | Direction |
| --- | --- | --- | --- |
| `.card-buttons button[data-action]` (hide the card's buttons) | polish.js:283 | broken | data: `system.buttons[].visibility` |
| `<damage-application>` open attribute (close the tray) | receipts.js:45 | works | keep, or the tray's own setting |
| card CONTENT match for the concentration prompt | concentration.js:684 | broken | data: `message.type === "prompt"` |
| `.message-content` — Battle Flow's OWN rows appended | saves/views, topple, d20-folds, concentration, reminders, ui.js:550 | anchor exists; chained saves now HIDDEN | the summary block inside the parent card (§2.M) |
| roll dialog parts: `[data-application-part="configuration"\|"buttons"]`, `button[autofocus]` | reminders.js:253-256, ui.js:223 | unchanged in 6.0 | keep; the likeliest 6.x cosmetic drift |
| usage dialog `footer, .form-footer` insert | metamagic.js:241, emanations.js:673 | unchanged in 6.0 | keep; same |

**The posture, in the house style** (the hook-dispatch gate's class, applied to selectors):
1. every HTML anchor lives in ONE surfaces map — no selector strings elsewhere;
2. a static check (`tools/check-surfaces.mjs`) reads dnd5e's SHIPPED templates and fails the
   build when an anchor no longer appears, pinned to the verified version like
   `dnd5e-hooks.json` — 6.x template churn becomes a build failure at the pin bump, not a row
   that silently never draws;
3. data over anchors wherever the platform offers it (after 6.0, most places);
4. the platform's `getFlag` READ FALLBACKS (activity, item, originatingMessage) are courtesy,
   not contract — never load-bearing; the fix writes and reads `system.*`.
Cadence, measured: 5.3 shipped three patch releases with zero breaking changes; 6.0.1 was five
bug fixes. Breaks land on the major, deprecations expire on the second minor (6.2), patches are
safe. The realistic exposure is one deprecation sweep at 6.2 plus cosmetic template churn.

## 4. The work, in order

Each phase ends battery-green on the sandbox at 6.0.1 for the suites it touches; nothing is
released until the last. Sizes are my estimate against the machine-tier and metamagic passes.

1. **Foundations** — the pin (A), the hook artifact, `statusEffects` (H), the shared readers:
   `shared.js` (`hitTargets`, `resolveAttackMessage`, `forceStatus`), `effect-riders.js`
   (`messageActivity`, the applier built the tray's way — L, K via O2), `lookup.js`. One helper
   module for "what kind of card, whose, from which" so the 90 sites read ONE seam
   (`decide/`-tier, unit-tested against 6.0.1 message shapes), and the surfaces map with its
   static gate (§3b) so the HTML anchors are counted and checked at the pin. The Phase 1 chain
   green (smoke-battleflow, smoke-hold). Two to three sessions.
2. **The readers** — classes B–F swept file by file through the seam; the suites' own asserts
   rewritten in the same commits. The battery's middle (saves, volleys, maneuvers, folds, cast,
   riders, concentration with fix J, effects, expiry, reminders, sneak, clock, hit menu, shields,
   heat metal, superiority, metamagic, resources). Three to four sessions.
3. **Areas** — class I: `saves/areas`, `geometry` on regions, `emanations` on the new placement
   hooks, with the §3.6 ruling applied. smoke-emanations, smoke-surfaces. One to two sessions.
4. **Summaries and buttons** — M and §3.8: where Battle Flow's rows draw on chained cards; the
   data-level button hide. One session.
5. **Docs and release** — DESIGN §5 reconciled with the platform's clock (§3.4), ARCHITECTURE's
   "what we read from the card" section rewritten, NOTES' three-shapes note corrected, BACKLOG's
   Miasma row reduced to the one field, RELEASE-NOTES, the version, prod deploy with the pin.
   ⚠ The prod deploy must prune nothing this time but MUST ship the new module.json.

Not in this pass, recorded for the next: §3.7 rule changes (a prototype first), §3.6's
platform-behaviour adoption beyond the ruling, `autoApplyDowned` and the trays' player settings
(§3.9), the null-AC verdict (§2.N).

## 5. Rulings needed before phase 1 starts

1. **The clock (§3.4):** ✅ RULED 2026-09-15 (yes) — adopt the platform's pseudo-expiries as the
   applied clock's vocabulary (Vex `sourceEnd`, Sap/Slow `sourceStart`, Miasma `targetEnd`), and
   let the platform's `turnStart` pin stand where Battle Flow said `turnEnd`. The platform's
   turn-edge rules are the same reading of "until the end of its next turn" and are judged by
   the same combat tracker the player sees; DESIGN §5 then states one rule, not two. The
   once-per-turn chits stay Battle Flow's.
2. **Concentration (§3.5):** ✅ RULED 2026-09-15 — VETO both native prompts, keep the machine.
   The user's rationale, to be carried verbatim into `concentration.js`'s veto comment, DESIGN
   R1, and the phase-2 commit: *the platform's prompt is a reminder, Battle Flow's machine is a
   resolution.* The platform whispers the owner a card with a button and stops — nobody waits on
   it, nothing expires, an unpressed button leaves the spell running; at 0 HP or incapacitated it
   still asks, on a rule with no choice in it. Battle Flow asks on the right client with a
   draining bar, rolls for a player who walks away, breaks the spell and cascades its effects on
   a failure, writes the card that says why, and at 0 HP or incapacitated ends concentration
   because the rule says so (DESIGN R1, "a determined outcome plays"). Running both is two asks
   for one save and a race: a player who presses the platform's button rolls a save the machine
   never sees while its bar drains toward a second roll. Riding the platform's prompt would mean
   rebuilding the machine's timing and cascade on a card designed to be optional, for nothing
   the table would notice. The veto costs one line — match the prompt card by its TYPE
   (`doc.type === "prompt"` with a `concentration` or `endConcentration` button) instead of by
   its content. **Revisit** only if a 6.x prompt gains a timer and a consequence; then it is a
   record with a decision attached, and the "read the platform's" rule applies.
3. **Emanations (§3.6):** suppress the platform's auto-behaviour on regions Battle Flow adopts,
   this pass, and revisit adoption with the neutral-disposition divergence in a prototype? My
   recommendation: yes.
4. **Null AC (§2.N):** ✅ RULED 2026-09-15 — adopt 6.0: a target whose AC cannot be read is a
   MISS, the platform's own verdict (`evaluatedTargets`). `decide/verdict.js`'s "leave it to
   humans" row goes; `shared.js:17-19`'s note is rewritten.
5. **The sandbox:** ✅ RULED 2026-09-15 — KEEP the fixtures, the raised pin and the module on
   for the whole pass. `tools/world-snapshot.mjs restore` is the way back to the exact prod copy
   (the snapshot was taken 2026-09-15 before the fixtures). The exact-copy rule stands for the
   NEXT prod → sandbox copy.
3. **Emanations (§3.6):** ✅ RULED 2026-09-15 — KEEP Battle Flow's emanations. The pass
   suppresses the platform's auto-behaviour on regions Battle Flow adopts
   (`options.dnd5e.createActivityBehaviors === false`, or a veto in `dnd5e.createMeasuredTemplate`).
   The measurement that ruled it follows. The user had asked whether 6.0's region behaviour is
   fully functional. From the source: it does the plain "effect while inside, gone on exit, attached to
   the caster's token" case; it does NOT admit neutrals to a helpful aura, exclude the caster's
   own reach, fire turn events (Aura of Vitality's notice, Spirit Guardians' enter + turn-end
   save with the chit), or place feature auras that stand without a cast. It is five-day-old
   code with 18 unreleased commits on 6.0.x. To be MEASURED live before ruling: a probe with
   Battle Flow's adoption off — cast Crusader's Mantle, walk a friendly, a neutral and a hostile
   through it, end concentration, report what landed and what cleaned up. Until measured the
   pass suppresses the platform's behaviour on adopted regions. The user's lean (2026-09-15):
   keep Battle Flow's emanations; the probe runs after the battery, then the ruling.
   **MEASURED 2026-09-15 (sandbox, Battle Flow OFF, `probe-platform-emanations.mjs`):**
   - *The pack declares nothing.* Every aura spell in the Player's Handbook pack — Crusader's
     Mantle, Aura of Life, Aura of Vitality, Antilife Shell, Spirit Guardians — carries ZERO
     activity behaviours (`activity.behaviors = []`). The platform attaches behaviours only
     from that field, so at this table its region machinery does nothing for any of them until
     the pack data is updated or a behaviour is authored by hand on each spell.
   - *The mechanism itself works.* A hand-authored `dnd5e.applyActiveEffect` behaviour on an
     emanation region attached to the Cleric's token: the FRIENDLY Ranger wore the effect on
     enter, lost it on exit, wore it again on re-entry; the NEUTRAL Paladin and the HOSTILE
     Victim got nothing (dispositions FRIENDLY only — the neutral divergence, confirmed); the
     CASTER wore their own aura (matches Battle Flow's ruling). The effect's origin is the
     behaviour's uuid; `system.origin` carries activity, item and behaviour.
   - *Concentration did not clean it up.* Ending the Cleric's concentration left the region
     standing and the effects on the Ranger and the Cleric; deleting the region lifted them.
     Caveat: the region was created by mimicking `TemplatePlacement.fromActivity` (placement
     needs a click headless), so the activation may register a placed region as a
     concentration dependent in the real flow — unverified.
   - Untouched by the platform, as the source said: turn events, the caster's reach exclusion,
     feature auras without a cast, neutrals.
   The measurement supports the lean: nothing the platform offers here is usable at this table
   without authoring, and what it offers diverges on neutrals and (as placed) on concentration.
