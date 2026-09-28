# HANDOFF.md — Slice B, the GM's side (commission, 2026-09-28, night)

> **What this is:** the commission every session works from until it is delivered, written for a
> session that starts cold. It is retired when it is delivered, and its record is git history. The
> order after it is set (BACKLOG *The long-term order*): **session 0 of the next campaign sets the
> class slices.** The user's word on 2026-09-28: *"lets move on to slice B"* — this IS the go; a session
> picking this up builds.

## ⚠ The mode: rapid deployment, not walkthroughs (the user, 2026-09-28)

**Build, prove with the suites, push — do not stop for a walk.** Every walk (the spells slice's four
tiers, whatever this builds) is DEFERRED, to be walked together later; a walk table still goes in
RULINGS for each thing built. Releases stay on the user's word (the full battery is the floor before a
tag). Rapid means no hand-walk between builds, not less proof. The user is not watching in real time.

## State (2026-09-28, night)

- Prod is **v2.6.0**. Main carries, UNRELEASED and UNWALKED: the spells slice end to end (RULINGS *The
  spells slice — Tiers 1 and 2*, *Tier 3*, *the held spells*) and the DMG register
  ([audits/dmg-register.md](audits/dmg-register.md), RULINGS *The DMG register*).
- **The DMG is RULED OUT** (the user, 2026-09-28: "high impact limited value"): nothing in it is built —
  not `CRIT_RIDERS`, not the injury-poison coatings, not the 29 WAITS rows. Never owed; never re-ask.
- The Monster Manual corpus scan of this session is at `dist/corpus-mm.json` (git-ignored; if it is
  missing, re-scan: `node tools/scan-corpus.mjs dist/corpus-mm.json --only dnd-monster-manual.features`,
  live on the sandbox, ~3 min; ⚠ the scanner's dispose HANGS after "# written" — kill it, the file is
  good). `node tools/classify-corpus.mjs dist/corpus-mm.json` writes the classified copy.

## The commission: Slice B — the five shapes, then the rows

**The drawing** is [audits/drawings/monsters.md](audits/drawings/monsters.md), read against
[audits/monsters.md](audits/monsters.md) (675 traits; ⚠ the 2025 book has no *Relentless*, *Reckless*,
*Brute*, *Martial Advantage* or *Legendary Actions* item). Its finding: the packs own the traits; what the
GM's side owes is **five shapes**, three of which land as facets on machines that exist, then two
groups of rows. Build in this order, one commit per stage, each with its RULINGS section (the ruling,
the table, the walk table), its own suites run and pushed:

### Stage 1 — the five shapes

| Shape | Customer | Precedent (name it in the row) | What this session measured — the seam and the facet |
| --- | --- | --- | --- |
| **The kill moment, the victim's side** | **Undead Fortitude** (a Con save, DC 5 + the damage taken; never against Radiant damage or a Critical Hit; a success drops to 1 instead of 0) | `DROP_TO_ONE` (Relentless Endurance asked, Death Ward automatic) — `drop-to-one.js` | the seam is `dnd5e.preApplyDamage` (synchronous, the update in hand: `updates[HP] = 1` holds the creature at 1 in the same write; the "killed outright" test is already there). A **`save` facet**: `{ ability: "con", dc: "5 + damage", unless: ["radiant", "crit"] }` — the machine rolls the bearer's Con save on the KEEPER (the client that applied, else the GM; `keepsMessage`) with the DC computed, no popup (R1: the dice decide, the GM chooses nothing), a card with the roll; a failure lands the 0 the way `land()` does for a passed ask. The damage type and the crit come off `options.originatingMessage` (the damage card: its rolls' `options.types`, and `attackMessageForDamage` → `rolls[0].isCritical`); a damage message that cannot be read counts the row (the gate never guesses an exemption). `outright` stays: a kill past the max never asks |
| **The kill moment, the death's side** | **Death Throes** (an Emanation save when the bearer dies — the pack's save activity with its area) | the same seam, the killer's side is `DROP_TO_ONE`'s sibling; the drawing calls it a **`died` trigger** — ROW+VOCAB on `DROP_TO_ONE` (`on: "died"`: the row fires when the update leaves HP at 0 and nothing held it) | the activity is the feature's own; use it AT THE CORPSE through the saves machine (`withTargets` over the creatures inside its Emanation is the demand's own area logic when the activity carries a template — measure the pack's Death Throes first: does it ship a template or a bare save?). One card: "Death Throes — N creatures save". Multiple Heads and Split are OUT (the GM's dice / a summon) |
| **Save bends against magic** | **Magic Resistance** (Advantage), **Greater Magic Resistance** (the save auto-succeeds; spell attacks auto-miss), **Avoidance** (Evasion's shape on ANY save: none on a success, half on a failure), Poison Tolerant (Dwarven Resilience's row, DMG) | `EFFECT_BENDS` rows with `match: "feature"` and a **`saves` facet** — the `vsSpells` judge EXISTS already: `saves: { bend: "advantage", spells: true }` (the Circle's Power row, registry line ~1147); `decide/reminders.js` `effectSaveSources` reads `demand.spell`, which `saves/demand.js` sets when the activity's item is a spell or carries the `mgc` property | Magic Resistance is a ROW, nothing more (a feature row: `"Magic Resistance": { match: "feature", saves: { bend: "advantage", spells: true }, rule: {…mmMagicResistan…} }` — the uuid off the scan). Greater: `saves: { succeeds: true, spells: true }` — `succeeds` exists only paired with `sleep` today (`effectSaveSources`: the `autoSucceed` source); one branch generalises it (a save against a spell cannot fail — the fourth button); the **spell-attack auto-miss is a bend the attack gate does not have**: land it as the register's line (the caveat on the row) unless it is one facet cheap. **Avoidance**: `EVASION` is a one-row constant (`{ feature: "Evasion", ability: "dex" }`, read in `saves/consequences.js` ~line 111 and `decide/verdict.js` `entry.evasion`); make it a TABLE of two rows keyed by feature (`Evasion`: dex only · `Avoidance`: any ability) — a small change, unit-tested. Poison Tolerant: a `match: "feature"` row copying Dwarven Resilience's `saves` |
| **Legendary Resistance** | every legendary creature: a failed save the GM chooses to succeed, N per day | `SAVE_SUCCEEDS` (Mage Slayer's Guarded Mind: `d20-folds.js` `SUCCEED` — offered on a demanded save before its verdict, the `succeed` fold kind) | ROW+VOCAB: a **pool facet** — `pool: "legres"` reads `system.resources.legres` (value/max) on an NPC instead of the feature's activity uses; the spend writes `legres.value − 1`. `SUCCEED.find` reads `row.abilities` (all six for this row) and `poolOf(actor, activity)`; measure the pack's Legendary Resistance item first (does it ship an activity consuming `legres`? then it is the activity's own pool and the facet is smaller). ⚠ The GM's CHOICE, never automatic (R1): the offer, not the fold |
| **A heal at the turn start** | **Regeneration** (N HP at the start of each of its turns while above 0; the troll's clause: not if it took Fire or Acid damage since its last turn) | `TURN_GRANTS` (`turn-grants.js`: Heroism's Bravery — a landed EFFECT whose origin item's activity is rolled again and applied with a receipt, once per turn, on the bearer's driver at `updateCombat`) | ROW+VOCAB: **`match: "feature"`** — the grant is the bearer's OWN feature's heal activity (no effect, no caster: rolled on the bearer's numbers), and an **`unless: { damagedBy: [...] }` judge** read off the receipts since the bearer's last turn start (every applied damage carries a receipt flag with its types — `decide/receipt.js`; the query is the messages since the bearer's last turn stamp, `combat|round|turn`). `while: aboveZero`. Measure the pack first: the troll's Regeneration carries its own `unless` types in text only — the row names them (a row is data) |

### Stage 2 — the aura rows (one shape, eight customers) and the attack bends

- **Fear Aura, Fetid Aura, Stench, Sickening Vapors, Vile Appearance, Horror Nimbus, Horrific Visage,
  Lordly Presence**: `EMANATIONS` `kind: "feature"`, `reach: "harmful"`, the pack's save activity with
  its effect, **`trigger: { on: ["turnStart"] }`** — NEW VOCABULARY: today's triggers are `enter`,
  `turnEnd` and `move` (`emanations.js` ~line 73–75: the region behaviour's `#onTurnEnd`; add
  `#onTurnStart` on the same path, `maybeTrigger(..., "turnStart")`, the `why` line "started its turn
  inside"). The "immune for 24 hours after a success" clause is the pack effect's own or the register's.
  Measure each: some are `each creature in the Emanation` on the bearer's turn (a save the bearer USES —
  NATIVE), others `any creature that starts its turn` (the trigger). Only the second kind is a row.
- **Aura of Authority**: `EMANATIONS` feature row, `reach: "helpful"` (allies' Advantage while inside —
  the effect the pack ships or a bare ring with the card).
- **Displacement, Blurred Form**: `EFFECT_BENDS` `match: "feature"`, `target: "disadvantage"`, off while
  the bearer is Incapacitated — a `judge` fact the gate holds (`EFFECT_BENDS` `judge` vocabulary:
  bloodied, targetBloodied, targetDamaged…; add `notIncapacitated` if none reads the bearer's statuses).

### Stage 3 — the reaction rows, on lists that exist

| Trait | Lands on | Note |
| --- | --- | --- |
| Counterattack, Defensive Stance, Whirlwind of Sand, Toxic Escape | `INTERRUPTS` (`ac`) | three are rows already; Toxic Escape is `row("Toxic Escape", "ac")` if its response is AC-shaped — measure |
| Warding Charm, Jinx | `REBUKES` on hit, the activity's own save at the attacker | a row each; the save is the activity's (the machine uses it) |
| Sticky Shield | `REBUKES` with **`on: "miss"`** — NEW VOCAB (Riposte's trigger) | one customer; build the facet only if the rebukes' seam sees the miss cheaply (`dnd5e.postRollAttack` verdict) |
| Deflect Missile | `INTERRUPT_REDUCTIONS` (Deflect Attacks' shape, ranged only) | a row; the redirect is the table's |
| Limited Foresight | `INTERRUPT_ROLLS` (Shadowy Dodge's row) | a row |
| Elemental Absorption, Ink Cloud, Fiendish Blood | `REBUKES` `on: "damaged"` with a damage-type judge | ROW+VOCAB; the classes' Misty Escape shares the trigger — build once |
| Reactive | the Reaction chip's `everyTurn` facet (`decide/chips.js` `reactionStands`) | one customer — build last, or leave as the register's line |
| Redirect Attack, the cast-triggered seven (Spell Reflection, Counterspell…), Eye Rays, Divine Beam | WAIT (a kind each; no player customer) | the register's |

**OUT, by the drawing:** Rampage, Pounce, Charge, Frenzied Rush (movement then an attack), Swarm,
Antimagic Cone, Darkness Aura, Legendary and Lair Actions (the tracker's), Life Suppression and Negative
Energy Cone (a `noHealing` facet with no customer). Arcana Unleashed's bestiary stays out.

### Measured on the pack this session (`dist/corpus-mm.json`, dnd5e 6.0.5) — do not re-measure

| Trait (uuid tail, `dnd-monster-manual.features`) | The pack ships | So the row is |
| --- | --- | --- |
| **Undead Fortitude** (`mmUndeadFortitud`) | TEXT only — no activity, no effect | the machine rolls the save itself (`actor.rollSavingThrow`, con, the computed DC); nothing to `use` |
| **Death Throes** (`mmDeathThroes000`) | ONE save activity, no name: Dex, DC con, `onSave: none`, damage `9d6 fire` + `9d6 force` (the balor's), `target: creature` with the Emanation template on the activity | use the activity at the corpse; the saves machine's own area logic finds who is inside |
| **Legendary Resistance** (`mmLegendaryResis`) | a utility activity **"Expend Use"**, activation `special` ("fails a saving throw"), consumption **`attribute`** (the `legres` resource) | `SAVE_SUCCEEDS` row `activity: "Expend Use"`, `abilities: all six`; the pool is the activity's attribute consumption — `poolOf` reads item uses today, so the pool facet reads `system.resources.legres` and the spend goes through `activity.use()` as Guarded Mind's does (it consumes the attribute itself — measure that first; if it does, no facet at all) |
| **Magic Resistance** (`mmMagicResistanc`), **Greater Magic Resistance** (`mmGreaterMagicRe`), **Avoidance** (`mmAvoidance00000`), **Displacement** (`mmDisplacement00`), **Blurred Form** (`mmBlurredForm000`), **Reactive** (`mmReactive000000`) | TEXT only | feature rows (`match: "feature"`), as drawn above; Avoidance's text carries its own "not while Incapacitated" |
| **Regeneration** (`mmRegeneration00`) | ONE heal activity, no name, activation `special` ("starts its turn with at least 1 Hit Point"), `target: self`, the healing number is the MONSTER's own (a `{…}` lookup — read it off the actor's copy, never the pack's) | `TURN_GRANTS` `match: "feature"`, `activity: null` (the first heal), rolled on the BEARER; the troll's fire/acid `unless` is the row's data |
| **Fetid Aura** (`mmFetidAura00000`), **Stench** (`mmStench00000000`), **Vile Appearance** (`mmVileAppearance`, range 30, "can see its true form" — a caveat), **Lordly Presence** (`mmLordlyPresence`: "Initial Save" + three utility activities carrying the failure's three effects — the failure's pick is the GM's, the row uses "Initial Save" only), **Fear Aura** (`mmFearAura000000`, `target: enemy`; confirm its text is "starts its turn") | a save activity (Con or Wis, DC off the bearer) with the Emanation template and the condition effect on it — the text: **"any creature that starts its turn in"** | `EMANATIONS` feature rows, `trigger: { on: ["turnStart"] }` — the NEW vocabulary; the "immune for 24 hours / 1 hour after a success" clause is the register's |
| **Sickening Vapors** (`mmSickeningVapor`: "at the end of the bearer's turn"), **Horror Nimbus** (`mmHorrorNimbus00`: a Bonus Action, recharge), **Horrific Visage** (`mmHorrificVisage`: an action, a cone) | a save the BEARER uses | NATIVE — not turnStart rows; the drawing's "eight" is five |
| **Aura of Authority** (`mmAuraOfAuthorit`) | a utility activity "Expend Use" (`target: ally`, the condition "doesn't have the Incapacitated condition"), NO effect | `EMANATIONS` feature row, helpful, `effect: null` (a ring and a card), `incapacitated: true`; the Advantage on the members' attacks and saves is the register's line unless a bare-ring member bend is one facet cheap |
| **Sticky Shield** (`mmStickyShield00`) | a reaction save activity "Save" (Str, `range: 5`, Grappled effect), condition "A creature misses … with a melee attack roll using a weapon" + two check activities | `REBUKES` `on: "miss"`, `activity: "Save"` — the machine uses the save at the attacker |
| **Warding Charm** (`mmWardingCharm00`: Wis save, `onSave: half` (sic), Charmed 6 s), **Jinx** (`mmJinx0000000000`: Wis save, DC int) | a reaction save activity "Save", condition "hits … with an attack roll"; a failure turns the hit into a miss | `REBUKES` `activity: "Save"` on hit; ⚠ "the attack misses instead" is the DUPLICATES / rescue seam's word, not the rebukes' — land the save and let the card say the miss is the table's, or build the miss on the rescue seam (Unbreakable Majesty's shape, the `WARDS` comment) — the second is a real build; the first is a row |
| **Toxic Escape** (`mmToxicEscape000`) | a reaction save "Save" (`target: self`, range 30: the creatures within 5 ft of the destination), halves the damage, teleports | `INTERRUPTS` `damage` half is the module's (Uncanny Dodge's row); the teleport and the save at the destination are the table's — a row + caveat |
| **Deflect Missile** (`mmDeflectMissile`) | a reaction heal "Reduce Damage" (1d10, recharge, `itemUses`) + a save "Save" (Dex, 1d10 force, range 60) | `INTERRUPT_REDUCTIONS` `activity: "Reduce Damage"`, `pool: true`, ranged only (the condition's words); the redirect the table's |
| **Limited Foresight** (`mmLimitedForesig`) | a reaction utility "Expend Use" (recharge, `itemUses`) | `INTERRUPT_ROLLS` `activity: "Expend Use"`, `reaction: true`, `uses: true`; the Advantage-after is an `EFFECT_BENDS` row if the pack lands an effect (it ships none — the register's line) |
| **Elemental Absorption** (`mmElementalAbsor`) | a reaction heal (temp HP, once per day) on "takes Acid, Cold, Fire, Lightning, or Thunder damage" + five transfer resistance effects the GM toggles | `REBUKES` `on: "damaged"` with `types: [...]` — the vocabulary; the resistance to "that instance" is the GM's toggle (the pack's own note) |

### The suites

Existing suites to extend rather than new files: `smoke-drop` (DROP_TO_ONE: §1–§5), `smoke-d20-folds`
(SAVE_SUCCEEDS), `smoke-saves` (the save gate's bends, `spell` demands), `smoke-spells` (TURN_GRANTS),
`smoke-emanations` (the triggers). A monster fixture: `tools/fixture-suite.mjs` builds the BF Test
actors — add a **BF Test Monster** (an NPC with `resources.legres`, lent the MM traits per section from
`dnd-monster-manual.features` by uuid) the way `smoke-drop` lends Relentless Endurance. Every list a
new row joins has a settings default — `tools/verify-settings.mjs`'s reference table must carry it in
the same commit (`node tools/verify-settings.mjs` after any run).

## Ground rules

- Every row names its precedent before it is written ([[land-by-mechanism-not-family]]); a bend forced
  by the platform goes in RULINGS *Where the table bends the rule* in the same commit, a bend the table
  chooses in *Bent by choice*. A new flag key is classified in `decide/moments.js` (`check-moments` fails
  the build otherwise).
- A change runs its own suites: `node tools/battery.mjs --changed --list`, then the feature's own suites
  (`node tools/deploy-house-module.mjs --local` first — a battery tests the DEPLOYED copy; a FULL verdict
  for a feature still means its own suites). Launch a suite detached. After any run,
  `node tools/verify-settings.mjs` against the reference.
- Prod is never touched; a release goes out only on the user's word, by a pushed annotated tag (CI
  builds the zip). The full battery is the release floor.
- `npm run verify` green on every commit; `biome --write` on named files only (never a directory).
- ⚠ Heredocs mangle backslashes and backticks in shell — write code with the editor tools.
- Docs at the end of each stage: RULINGS (the section), BACKLOG row 4b's state, this file's State.

## After this

- **Session 0** ([audits/drawings/classes.md](audits/drawings/classes.md)): the party's classes one
  level band ahead of play; the reroll kind with its first customer; the prototypes ruled when that
  player sits down.
- **The walks**, when the mode changes back: Tiers 1–4 of the spells slice
  (`tools/content/place-spells-walk.mjs`, the four RULINGS tables), then Slice B's.
- **The release**: the full battery, then a tag, on the user's word — everything since v2.6.0.
