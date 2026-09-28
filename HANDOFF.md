# HANDOFF.md — the DMG register delivered; the DMG scope call, then Slice B (2026-09-28, night)

> **What this is:** the commission every session works from until it is delivered, written for a
> session that starts cold. It is retired when it is delivered, and its record is git history. The
> order after it is set (BACKLOG *The long-term order*): **Slice B, then session 0 of the next
> campaign sets the class slices.** Nothing starts until the user says go; a handoff is not a go.

## ⚠ The mode: rapid deployment, not walkthroughs (the user, 2026-09-28)

**The user's word:** *"make a note in the handoff we're pushing through rapid deployment not
walkthroughs as we had a free reset of tokens."* Until the user says otherwise: **build, prove with
the suites, push — and do not stop for a walk.** The walks of the spells slice (Tiers 1–4) and of
whatever is built next are DEFERRED, all to be walked together later; a walk table still goes in
RULINGS for each thing built. Releases stay on the user's word (the full battery is the floor before a
tag). Rapid means no hand-walk between builds, not less proof.

## State (2026-09-28, night)

**The spells slice is BUILT end to end and pushed, UNWALKED and UNRELEASED** (prod is v2.6.0). **The
DMG register is DELIVERED**: [audits/dmg-register.md](audits/dmg-register.md), 571 rows (50 OUT ·
367 TEXT · 111 NATIVE · 14 MODULE · 29 WAITS), from `tools/audit-dmg-register.mjs` off a DMG-only scan,
the registry, RULINGS and the drawing's two hand tables; RULINGS *The DMG register* is the record (the
WAITS word, the kinds, the shape column, the poison split). The shared readers are
`tools/register-shared.mjs`; the spells register regenerates byte-identical through them.

## The open call: what, if anything, the DMG builds now (the user's — asked 2026-09-28)

The user's word on seeing the commission: *"i never thought about equipment/magic items... lets see what
you come up with and decide scope."* The register is what came up. The two candidates, measured on the
pack (RULINGS *The DMG register*, the last paragraph):

| Candidate | What it is | The honest cost |
| --- | --- | --- |
| **`CRIT_RIDERS`** — Vorpal Sword, Sword of Life Stealing, Nine Lives Stealer, Hammer of Thunderbolts, Mace of Smiting, Silvered Weapon | a table on the damage seam, the crit the module already judges (`riderDue`'s `crit` facet; Piercer's Enhanced Critical is the precedent) | NOT cheap rows: the six ship as ENCHANTMENTS on a base weapon ("Vorpal {}"), so the row is found by the enchantment effect on the attacking weapon — a reader the machine lacks; three of six need a judgment the data cannot make (a head, shape-shifted, a Construct's HP after) and land as a caveated offer; no customer in the house world |
| **The injury poisons as `COATINGS` rows** — Lolth's Sting, Purple Worm Poison, Serpent Venom, Wyvern Poison | the coating machine (`use-chips.js`) on the item's own "Use Poison" save activity; the dose is the item's `itemUses` | a small generalisation of one machine: the row names the activity and its ability (no ASI pick), no Fighting Styles switch, the card's words from the row, the chip's name from the item; a suite row in `smoke-sneak` (the coating's suite); no customer in the house world |

Either is a build on its own commit with its RULINGS section and walk table (deferred), its own suites
run, pushed. **Neither starts without the user's word**; "Slice B" is also a valid answer — the order
after this is set.

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
- ⚠ `scan-corpus.mjs`'s dispose HANGS after writing: kill it, the file is good.

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
  (`tools/content/place-spells-walk.mjs`, the four RULINGS tables), then whatever is built next.
