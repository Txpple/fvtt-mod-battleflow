# HANDOFF.md — the DMG register, after the spells slice (commission, 2026-09-28, night)

> **What this is:** the commission every session works from until it is delivered, written for a
> session that starts cold. It is retired when it is delivered, and its record is git history. The
> order after it is set (BACKLOG *The long-term order*): **Slice B, then session 0 of the next
> campaign sets the class slices.** Nothing starts until the user says go; a handoff is not a go.

## ⚠ The mode: rapid deployment, not walkthroughs (the user, 2026-09-28)

**The user's word:** *"make a note in the handoff we're pushing through rapid deployment not
walkthroughs as we had a free reset of tokens."* Until the user says otherwise: **build, prove with
the suites, push — and do not stop for a walk.** The walks of the spells slice (Tiers 1–4) and of
whatever this commission builds are DEFERRED, all to be walked together later; a walk table still
goes in RULINGS for each thing built, so the walk is ready when it comes. Releases stay on the user's
word (the full battery is the floor before a tag). Nothing here means skipping the suites or the
verify gate: rapid means no hand-walk between builds, not less proof.

## State (2026-09-28, night)

**The spells slice is BUILT end to end and pushed, UNWALKED and UNRELEASED** (prod is v2.6.0).
RULINGS *The spells slice — Tiers 1 and 2*, *Tier 3* and *the held spells* are the record; the PHB spell
register is generated ([audits/spells-register.md](audits/spells-register.md): 391 spells — the counts
are in its header — from `tools/audit-spells-register.mjs`, run on a spells-only corpus scan joined
with the registry, RULINGS and the drawing's *Register verdicts* table). The four walk tables sit in
RULINGS, the walk tool `tools/content/place-spells-walk.mjs` places the whole slice on Party Camp.
Counterspell is NATIVE by the user's ruling (the caster targets the creature and the saves machine
demands its Constitution save; *Bent by choice*).

## The commission: the DMG — a register, not a slice

**The drawing** is [audits/drawings/dm.md](audits/drawings/dm.md), read against
[audits/dm.md](audits/dm.md): 548 equipment rows and 23 features. Its finding stands: *"the DMG is not
a slice"* — nothing is granted by a class or a species; a magic item is at a table only when the GM
hands it out; the house world holds none of the rows below in play. **This session decides what
"a register" means and delivers it.** The spells register is the pattern, and the answer should be
the same shape: **one row per DMG row, generated, never edited** — a new generator (name it
audit-dmg-register) beside `tools/audit-spells-register.mjs` (lift the shared readers into one small
module rather than copy them), from a DMG-only corpus scan (`node tools/scan-corpus.mjs <out.json> --only
dnd-dungeon-masters-guide.equipment,dnd-dungeon-masters-guide.features`, live, the user out of the
world — the scanner's dispose hangs after writing; the file is good), classified, joined with the
registry, RULINGS and a *Register verdicts* table in the DMG drawing.

The columns the DMG needs beyond the spells': **Kind** (magic item · poison · trap · hazard · siege
weapon · supernatural gift · feature) and **Shape** (the drawing's shared-shape row it lands on:
`vsSpells`, the reroll kind, `SAVE_SUCCEEDS`, the on-hit reactions, the cast-triggered reaction,
`CRIT_RIDERS`, `COATINGS`, the turn-start rider, bends-until-damaged, or —). The verdict column
stays NATIVE / MODULE / TEXT / OUT with a fifth word the DMG needs: **WAITS** — a row whose shape is
drawn and whose customer is a found item (the drawing: "built when the first is found"). The
generator's default for the ~347 no-family rows is TEXT ("a utility item — no combat mechanism").

**What to BUILD in the same pass, if anything — the user's call, asked at the start:** the drawing
names one table with six customers and no build — **`CRIT_RIDERS`** (Vorpal Sword, Sword of Life
Stealing, Nine Lives Stealer, Hammer of Thunderbolts, Mace of Smiting, Silvered Weapon — the crit
the module already judges, RULINGS *The hit's sequence*; the precedent is `CLOCK_RIDERS`' `crit`
facet, Slasher's and Piercer's Enhanced Critical) — and the **injury poisons as `COATINGS` rows**
(Poisoner's Poison Coating is the machine; the item's own activity is the save and the damage).
Both are cheap rows on machines that exist; both are found items with no customer in the house
world. Rapid-deployment mode says build them if the user says go — a register alone is a document,
and the mode is about shipping.

## Ground rules

- Every row names its precedent before it is written ([[land-by-mechanism-not-family]]); a bend
  forced by the platform goes in RULINGS *Where the table bends the rule* in the same commit, a bend
  the table chooses in *Bent by choice*.
- A change runs its own suites: `node tools/battery.mjs --changed --list`, then the feature's own
  suites (`--local` deploy first — a battery tests the deployed copy; a FULL verdict for a feature
  still means its own suites). After any run, `node tools/verify-settings.mjs` against the reference.
- Prod is never touched; a release goes out only on the user's word, by a pushed annotated tag (CI
  builds the zip). The full battery is the release floor.
- `npm run verify` green on every commit; `biome --write` on named files only.
- ⚠ Heredocs mangle backslashes and backticks in shell — write files with the editor tools, never
  `cat <<EOF` for code.

## After this — the next two, already drawn

- **Slice B** ([audits/drawings/monsters.md](audits/drawings/monsters.md)): Undead Fortitude and
  Death Throes on `DROP_TO_ONE` (a `save` facet, a `died` trigger); Legendary Resistance on
  `SAVE_SUCCEEDS` from the `legres` pool; Magic Resistance and its greater form on a `vsSpells`
  save facet (nine customers across three books — the DMG's six ride along); Regeneration on the
  turn-start grant; the eight harmful aura rows; the reaction rows on lists that exist.
- **Session 0** ([audits/drawings/classes.md](audits/drawings/classes.md)): the party's classes one
  level band ahead of play; the reroll kind with its first customer; the prototypes (Brutal Strike's
  gate box, Portent, Wild Magic Surge, Inspiring Smite) ruled when that player sits down.
- **The walks**, when the mode changes back: Tiers 1–4 of the spells slice
  (`tools/content/place-spells-walk.mjs`, the four RULINGS tables), then whatever this commission
  built.
