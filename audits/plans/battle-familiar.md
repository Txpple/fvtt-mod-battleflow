# Plan — Battle Familiar (Arcana Unleashed), for By the Books

**BUILT 2026-10-14** (Phases A and B, RULINGS *Summons* calls 48–55; the suites green on the sandbox). Drafted 2026-10-14 off the spell as the pack ships it (`dnd-arcana-unleashed.spells` `aunBattleFamilq9`, its three
actors, the Warlike Familiar feat), dnd5e 6.0.6's `transformInto` / `revertOriginalForm` / `SummonActivity#getChanges`
(read off the installed source map) and the module at 3.4.5. Nothing here is built. The rulings it needs are at the end.

## The spell, as contours

| # | The text | What it asks of the module |
| --- | --- | --- |
| C1 | "conjure a familiar … resembles an animal of your choice but is a Celestial, Fey, or Fiend … choose the Brute, Flyer, or Stalker form" | the summon path: three profile rows, the type pills, placement within 10 ft |
| C2 | "rolls its own Initiative and acts on its own turn" | its own seat (today it FOLLOWS the caster — wrong) |
| C3 | "disappears when the spell ends, if it drops to 0 Hit Points, or if you die … leaves behind … anything it was wearing or carrying" | the 1-hour clock; 0 HP ends it (today only companions fall); the caster's death ends it; the gear drop |
| C4 | "If you cast this spell again, you decide whether you summon the familiar that disappeared or a different one" | a recast remembers the last form and offers it first (cosmetic: the form and the art) |
| C5 | "You can't have more than one familiar at a time … that familiar is replaced by the new one" | one at a time, the new one taking the old one's place (today two can stand) |
| C6 | "If you have a familiar from Find Familiar when you cast this spell, you EMPOWER your existing familiar rather than conjuring a new one" | the branch the pack does not model at all (its Foundry note: drag the actor on, pick Polymorph by hand); the cast while a Find Familiar companion stands must never conjure a second creature |
| C7 | "your familiar's game statistics are replaced by the Battle Familiar stat block, but it retains its creature type, alignment, Hit Points, Hit Point Dice, and any features granted by Find Familiar" | a polymorph with `keep: hp, type, bio`; the form's AC, speeds, attacks, Talented, the immunities |
| C8 | "gains Temporary Hit Points equal to the Hit Points of the battle familiar. Battle Familiar ends early if the familiar has no more Temporary Hit Points left … vanish if any remain … reverts to its previous form" | temp HP = the form's HP at the cast level (30 / 20 + 5 per level above 2); `noTemp` ends it; the revert keeps the HP lost, drops the temp |
| C9 | "Use the spell slot's level for the spell's level in the stat block" | `flags.dnd5e.summon.level`: AC 11 + level (+2 Brute), HP, Rend's +level force, Multiattack's floor(level / 2), Talented's floor(level / 2); PB = the caster's |
| C10 | Warlike Familiar: "cast it once without a spell slot … regain … when you finish a Long Rest" | a free cast — the pack ships NO forward activity and NO uses pool on the feat (unlike Familiar Friend's "(free casting)") |
| C11 | Warlike Familiar — Intercept Attack: "When a creature within 5 feet of your familiar is hit by an attack roll, your familiar can take a Reaction to add a bonus to the creature's AC … equal to your Proficiency Bonus" | an `ac` hold answered by a GUARD (the familiar) for another creature — the `ac` kind has no guard facet today (Protection's guard is `roll`, Interception's `damage`) |
| C12 | Familiar Friend's benefits on the empowered familiar | Fortified Familiar's HP is in the kept HP; Helpful Friend's `near` must still find the companion through the transform and the revert |

**Measured on the pack.** One summon activity, three profiles, `creatureTypes` celestial · fey · fiend, `bonuses.ac: @item.level`,
`bonuses.hp: 5 * (@item.level - 2)`, `match` attacks · disposition · proficiency, `tempHP: ""`, no Concentration, 1 hour, range
10 ft, M a 25 gp diamond (not consumed). The actors: Rend 1d8 + `@flags.dnd5e.summon.level` force; Multiattack
`floor(@flags.dnd5e.summon.level / 2)` Rends (the Stalker may swap one for Prowl); Talented `floor(level / 2)` on checks and
saves (an effect whose origin on all three points at the Brute's item — cosmetic); immune Charmed and Frightened; Darkvision 60.
**Vendor gaps for Errata**: the Flyer's and the Stalker's `details.type` is `{}` and the Brute's is `custom` with no name (the summon
landing writes the picked type over it, so the conjure branch is fine; the empower branch keeps the familiar's own type anyway);
the activity's `range.units: "self"` with `override: false` inherits the spell's 10 ft.

## What stands today (3.4.5)

- The conjure branch already lands as a generic summon: `takes` claims any summon activity with profiles; the menu shows the three
  rows and the type pills; it stands on a 1-hour effect of the caster's (RULINGS *Summons* call 19 names Battle Familiar); it is
  in `ART_SPELLS` (call 28) and prod's Summon Art table carries art for its three forms.
- Wrong or missing: the seat (no `SUMMON_OWN_INITIATIVE` row → it follows the caster), one at a time (no `SUMMON_SINGLES` row),
  0 HP (only `COMPANIONS` fall), the caster's death, the gear drop (companions only), C4, and all of C6–C12.
- The cast while a Find Familiar stands: `currentCompanion` is keyed by the spell cast, so Battle Familiar sees no companion and
  conjures a second creature next to the owl — the opposite of C6.

## The calls proposed

1. **Battle Familiar is a `SUMMON_SINGLES` and a `SUMMON_OWN_INITIATIVE` row** (C2, C5): `says` the book's sentences. One
   table row each, no code.
2. **A standing summon can fall and drop its gear** (C3): `SUMMON_FALLS` (new table, or a facet on the standing record):
   Battle Familiar's creature at 0 HP is dismissed by the elect with the card line "dropped to 0 HP and disappeared", and
   `dropCarried` runs for it as it does for a companion (the Loot Shelf chest, else lost). The watcher is the companion's
   `updateActor` road generalised to any standing summon with the row. **The caster's death**: the `dead` status landing on
   the caster (not 0 HP — a PC at 0 is Dying) dismisses every standing summon with `endsOnCasterDeath`. Table-driven, no
   amount.
3. **The last form is remembered** (C4): the record keeps `lastForm` on the caster's flag scope per spell; the menu marks
   that row "last time" and pre-picks it (the Wild Shape picker's "last used" mark reused). The art is the Summon Art table's
   by form name as today; "the familiar that disappeared" is the same form and art — nothing else persists.
4. **The empower branch is a transform of the standing companion** (C6–C8): a new `TRANSFORMS` shape, `subject: "companion"`
   with `companion: "Find Familiar"` (read through `SUMMON_AS`, so a Wild Companion's or Pact of the Chain's familiar is
   empowered too). The flow:
   - **The route (ruled 2026-10-14, the user).** `dnd5e.preUseActivity` on Battle Familiar reads the caster's standing Find
     Familiar companion (`standingCompanion`, through `SUMMON_AS`):
     - **no familiar**: the summon road as today (the three rows, the type, the placement; no Concentration — the caster's
       1-hour effect);
     - **a familiar in the pocket**: refused before any slot is spent — "You can't cast Battle Familiar while your familiar is
       in its pocket dimension" (a warning, the `needsGM` shape);
     - **a familiar on the table**: one question first — **Summon a new one** (dismisses the familiar forever, the gear dropped,
       then the summon road) or **Empower ⟨name⟩** (the empower road below). A HOUSE BEND: the text empowers with no choice;
       the table may prefer a fresh Battle Familiar over its bonded one. The register and the rule tick say so.
     - A conjured Battle Familiar already standing is replaced by a recast (call 1, SUMMON_SINGLES) — the summon road's own.
   - dnd5e's Cast Spell dialog first (call 33), then the module's menu with the three form rows (no type pills: the familiar
     keeps its type; no placement: it stands where it is). The rows read at the cast level (the attack line "1d8 + 2 force",
     "AC 13 · 30 temp HP" for the Brute at level 2).
   - **The elect transforms** through the transforms machine's `transformOne` on the familiar's TOKEN actor (dnd5e updates an
     unlinked token in place — same token id, so the combatant, the companion record and the owner's marker survive) with a
     custom `TransformationSetting`: `keep: hp, type, bio, vision` (C7; `vision` is dnd5e's default), `effects: origin,
     otherOrigin, spell` (the polymorph preset's — the companion's Fortified HP sits in the delta's HP, not in an effect),
     `tempFormula` = the form's HP at the cast level (C8; computed by the module, not `@source.attributes.hp.max`, which is
     the compendium's 30 with no level bonus).
   - Then **the stat block at the spell's level** (C9): `activity.getChanges(landed, profile)` as the summon landing uses it,
     with its HP branch and its creature-type branch set aside (the temp HP and the kept type are the module's here): the
     AC bonus, the proficiency and attack match, `flags.dnd5e.summon.level / mod` (Rend, Multiattack and Talented read them),
     the disposition. Measure first that `getChanges` applied to a transformed token actor lands its effects on the delta.
   - **The levers**: the caster's standing summon effect (call 19: "Battle Familiar", 1 hour) is THE lever, as for the conjure
     branch; the form effect on the familiar ("Battle Familiar — Brute · 1 h", the transforms machine's) carries
     `dependentOn` it, so the caster's Short Rest (*Rests end the short effects*: 1 hour or less), the clock, a hand on either,
     or `noTemp` (the transforms machine's existing end) all revert through one road. `ends: ["noTemp"]`; 0 HP is the
     companion's own fall (it disappears per Find Familiar, the gear dropped).
   - **The revert** is dnd5e's `revertOriginalForm`: with `keep: hp` the HP lost while empowered carries back and the temp HP
     is dropped (measured: `revertOriginalForm` writes `hp.value` back and `hp.temp` only with `keep: tempHP`, which we omit) —
     C8 for free. For a token actor the revert CREATES A NEW TOKEN and deletes the old (`TokenDocument.create` + `delete`
     with replacements): the companion record's token uuid, the combatant and the owner's marker must be re-pointed — the
     pocket's recall already rebuilds a token and re-seats it, so that road is reused (`rebuildCompanionToken`).
   - **Looks and names**: dnd5e names the form "Owl (Battle Familiar (Brute))" and swaps the token art to the Brute's; the
     empowered familiar should keep its own name and art (it is the same creature, empowered) with the form effect's icon
     showing the form — ruling Q2. `wearFormArt` already restores art after a transform; the name is one update.
   - The companion menu while empowered: "Put it away" ends Battle Familiar? (the text says nothing; a pocketed familiar
     cannot fight) — ruling Q3. "Dismiss forever" and 0 HP end both.
   - The card: "⟨caster⟩'s Owl is empowered — Battle Familiar (Brute), 30 temp HP, 1 hour", Revert on it for the owner or a
     GM (the transforms machine's button); the end card "Battle Familiar ended — no Temporary Hit Points left / the hour
     passed / reverted by hand".
5. **Helpful Friend through the transform** (C12): `standingCompanion` resolves the record's token; the in-place transform
   keeps the id, the revert re-points it (call 4) — one unit test on the pure resolver and `smoke-familiar` §9 covers it.
   Fortified Familiar: nothing to do (kept HP); assert it in the suite.
6. **Warlike Familiar's free cast** (C10): the pack carries no forward and no pool, so the module gives the feat one way to
   pay: `FREE_CASTS` (new table; the Wild Companion precedent, call 39): a second Consumption line on the Cast dialog, "Cast
   for free — Warlike Familiar? (1 remaining, regained on a Long Rest)", ticked by default while unspent, the slot the
   fallback; the counter a flag on the feat item (`freeCastSpent`), reset by the resting client at `dnd5e.restCompleted`
   (long). No Errata patch: the rule would be doubled (the Fortified Familiar precedent, call 46). The spellcasting ability
   ("the one chosen for Faithful Companion") is the sheet's. **Always prepared** is the sheet's too.
7. **Intercept Attack is an `ac` guard** (C11): the register's 2026-10-02 verdict ("the redirect kind", OUT) is wrong on the
   text — it ADDS TO AC like Shield, from a bystander like Protection. A `guard` facet on the `ac` kind (`INTERRUPT_ACS`,
   new, or a facet on INTERRUPTS' `ac` rows): `of: { companion: "Find Familiar" }` (the reactor is the caster's standing
   familiar, its Reaction spent), `reach: 5` from the familiar to the HIT creature, `bonus: "@prof"` on the FEAT OWNER's roll
   data (the familiar's own PB is +2 until empowered), `activity: "Intercept Attack"` (the pack's utility rolls the bonus;
   the hold applies it). Offered only when it can win (the 3.4.4 rule): the hit's margin ≤ PB. Answered on the owner's
   client (the caster owns the familiar). The hold's `by` / `guards` plumbing exists for `roll` and `damage`; the `ac` road
   gains the guard branch. Battle Familiar is not required for it — the owl can intercept from level 4.
8. **Moments and FX**: the empower branch publishes a `summon`-shaped moment on the familiar's token (`details.empowered`,
   the form) so FX Studio can play the summon FX where it stands, and the revert a `summon-leaves`-shaped one; the conjure
   branch's moments are unchanged. FX Studio's rows are its own pass.

## Where it lands

| Piece | Layer | Precedent |
| --- | --- | --- |
| `SUMMON_SINGLES`, `SUMMON_OWN_INITIATIVE` rows; `SUMMON_FALLS`; `lastForm` | `decide/registry.js`, `decide/summons.js`, `summons.js` | Find Familiar's rows; the companion's fall; Wild Shape's "last used" |
| `TRANSFORMS["Battle Familiar"]` `subject: "companion"`; the custom setting; `getChanges` on top | `decide/registry.js`, `transforms.js`, `decide/transforms.js`, `summons.js` (the route at `preUseActivity`) | Polymorph's row (`noTemp`); the summon landing's `getChanges`; the pocket's token rebuild |
| `FREE_CASTS` | `decide/registry.js`, `summons.js` `renderActivityUsageDialog` / `preActivityConsumption`, `rest-grants.js` | Wild Companion's second line (call 39), Familiar Friend's way to pay (call 45) |
| The `ac` guard | `decide/registry.js`, `hold/trigger.js`, `hold/answer.js`, `decide/rescue-hit.js` | Protection's guard (`roll`), Interception's `ally` (`damage`), the "offered only when it can win" rule |
| Moments | `decide/moments.js` | the `summon` moment, `companion-<id>` markers |

Gates to mind (summons-handoff.md *What the mastery build taught*): new flag keys prefixed per machine (`EMPOWER_FLAG` if any —
prefer riding the `transform` record), every key classified in `decide/moments.js`, `WORLD_WRITERS` pinned, `EXPECTED_SOURCE_FILES`
moved if a file is added, `tools/check-pickers.mjs` (the form rows through `openPicker`), `check-rule-folds` (the rule under its
closed tick, every row with `rule`).

## Measured on the sandbox (2026-10-14, Foundry 14.369, dnd5e 6.0.6, a job through `tools/job.mjs`)

A Monster Manual Owl as the module lands a familiar (an unlinked token, Fortified's +2 on the delta: 3/3 HP, Celestial,
`flags.dnd5e.summon` stamped), seated in a started combat; then the Brute through `transformInto` with
`keep: hp, type, bio, vision`, the polymorph preset's `effects`, `tempFormula: "30"`; then the spell's own
`getChanges(familiar, Brute)` on top; then 3 damage past the temp HP and `revertOriginalForm`. Twice, 2.5 s a run.

| Question | Measured |
| --- | --- |
| `transformInto` on an unlinked token | **in place, same token id** (336 ms, returns the TokenDocument); the combatant survives; the sheet is the Brute's: AC 13 (flat), Medium, walk 40 / swim 30, immune Charmed · Frightened, Talented · Multiattack · Rend; **HP 3/3 kept** (Fortified's bonus with it), **temp 30**, **type Celestial kept**, alignment kept |
| The familiar's art | **kept the Owl's** token art, not the Brute's (Q2 as ruled, for free — one check owed on a familiar whose token is not a wildcard set; the MM Owl's is) |
| The name | dnd5e's "Owl (Battle Familiar (Brute))" on the actor and the token — one update to put "Owl" back (Q2) |
| Proficiency | ⚠ dnd5e's transform lands its own "Proficiency" override effect (`dnd5eTransformProf`) with the SOURCE's PB — the Brute has no CR, so **PB null**; with `getChanges`' Match Proficiency beside it the measure read 0 (no caster on a compendium spell). **The landing must delete `dnd5eTransformProf`** so Match Proficiency alone speaks (the caster's PB, C9) |
| `getChanges` on the transformed actor | returns `flags.dnd5e.summon` (level, mod, origin, activity, profile), `system.details.type.value` (set aside), two effects (Match Proficiency, Bonus Armor Class) and Rend's attack-match enchantment as an item update; applied by `update` + `createEmbeddedDocuments("ActiveEffect")` + `updateEmbeddedDocuments("Item")` it lands on the delta: **AC 15** at level 2 (13 + 2), Rend reads "1d8 + 5 Force" (Str +3 and the level, as the pack's own conjured Brute does), Multiattack's `floor(level / 2)` resolves |
| `revertOriginalForm` | 52 ms; **a NEW token** (new id, the old deleted); **HP value carried back** (0 of 3 after the 3 damage), **temp HP gone** (null), the Owl's items, type, size and `summon` flag back, no effects left |
| The combatant after the revert | ⚠ **still points at the OLD token id** with the old name — `delete({ replacements })` re-points nothing. The landing's revert must update the combatant's `tokenId` (and the companion record's token, the owner's marker) — the pocket recall's rebuild road |
| `dead` | `CONFIG.statusEffects` has `dead` (Q4's lever) |
| Permissions | `allowPolymorphing` is OFF on the sandbox; the elect is a GM, so `transformInto` passes as the transforms machine already relies on |

Not measured: a real cast's `mod` (the compendium spell has no caster, so `summon.mod` read 0 and Rend's to-hit "+0";
on the caster's own item `getChanges` reads the caster's roll data — the summon landing's path, known good); Prowl on the
Stalker. The job body is in the session scratchpad (`measure-battle-familiar.js`), not in the repo.

## Build order

1. ~~Measure~~ **DONE 2026-10-14** (the table above): two things the build must do that the plan had not named — delete
   dnd5e's `dnd5eTransformProf` effect at the landing, and re-point the combatant (and the record) after the revert.
2. **Phase A — the conjure branch right** (calls 1–3, 8): table rows, the fall, the gear, the caster's death, the last form.
   Small; `smoke-summons` gains a Battle Familiar section.
3. **Phase B — the empower branch** (calls 4–5): the route, the transform, the levers, the revert's re-pointing, the card.
   `smoke-familiar` §9–§12 (Owl standing → cast → empowered; temp HP to 0 → reverted, HP lost kept; the hour → reverted;
   Helpful Friend's box still found within 5 ft).
4. ~~Phase C — Warlike Familiar~~ **PARKED 2026-10-14** (the user: "right now I just want to support the spell"): calls 6–7
   stay as WAITS rows in the register (the free cast with no pack pool, the `ac` guard), to be built when a player takes
   the feat. Nothing in Phases A–B depends on them.
5. The register rows updated (`audits/arcana-register.md`: Battle Familiar MODULE, Warlike Familiar's two benefits), RULINGS
   *Summons* calls 48+, the README's spells list, FX Studio's reader row for the new moment details (its own repo).

A patch or a minor? The empower branch is a new machine shape; the user names minors (*Release versioning*).

**Scope (2026-10-14): the spell alone** — Phases A and B. The two platform patches the measure found (dnd5e's transform
Proficiency effect deleted at the landing; the combatant and the record re-pointed after the revert) are named in RULINGS
as where the platform makes us, each contained in one function.

## Rulings needed before Phase B

| Q | Question | Lean |
| --- | --- | --- |
| Q1 | ~~Familiar in the pocket~~ **RULED 2026-10-14: refused** — "you can't cast this while your familiar is in its pocket"; no slot spent | — |
| Q1b | **RULED 2026-10-14: a familiar on the table asks** Summon a new one (dismiss it forever) or Empower it — a house bend on the text, which empowers without asking | — |
| Q2 | **RULED 2026-10-14: the empowered familiar keeps its own name and art**; the form effect's icon shows the form | — |
| Q3 | "Put it away" while empowered: refuse, or allow and end Battle Familiar (the temp HP vanish) | refuse, the mirror of Q1 — the pocket and Battle Familiar never overlap |
| Q4 | **RULED 2026-10-14 (the user took the lean): the `dead` status on the caster ends it**; 0 HP alone is Dying and does not | — |
| Q5 | Intercept Attack's offer: the familiar's Reaction, answered on the caster's client, offered only when the margin ≤ PB | parked with Phase C |
| Q6 | **RULED 2026-10-14: Prowl is the sheet's** (the actor ships it as its own action) | — |
| Q7 | **RULED 2026-10-14: Errata rows filed** for the three actors' empty `details.type` and the Talented effect's origin; no fix needed for the module's roads | — |
