# HANDOFF.md — 2026-10-01 (night): the splat books ruled in BEFORE 3.0, prework done; next the rulings, then book by book

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Wait for the user's go.** A ruling in chat is not a go. Rapid dev mode stands (no walkthroughs). 3.0.0 is the user's
> to cut by hand.

## FIRST — the state

- **On prod: v2.11.0** (2026-10-01, byte-identical, settings CLEAN; the module.json version string waits on a Foundry
  PROCESS restart, which is the user's).
- **main, pushed as far as cbc4b02, UNRELEASED:** the DMG built out (crit riders, enchanted weapons via `lookup.js`
  `wieldsAs`, Luck Blade, Moonblade native; `smoke-classes` §115–§125; verify 1244 tests green). The DMG register: 39
  MODULE, 7 WAITS. ⚠ Sword of Sharpness's pack data types its 14 as Necrotic — a Vendor Fixes task.
- **Local commits after cbc4b02 (this session, docs + tools only, NOT pushed):** the epic boons parked in BACKLOG
  (a63701c), then the splat-books prework (this handoff's commit). Push them.
- **Scoped out for good** (BACKLOG *Scoped out for good*; never raised unless the user names one): the reaction-AC items,
  Fight or Flight / Success at a Cost, the redirect and cast-triggered kinds.

## The re-ruling (2026-10-01, RULINGS *The full release — the order*)

The user, in a holding pattern: *"start a new project whereby we will add in arcana unleashed, heroes of faerun, and
ravenloft to the scope … these will be added prior to 3.0 … we are still in rapid devmode … stay out of the sandbox …
add epic boons to the backlog."* So:

- **v3.0.0 = PHB + DMG + MM + Arcana Unleashed + Heroes of Faerûn + Ravenloft**, all built, unwalked. 3.x = the walks.
- The 3.0 floor battery moves to AFTER the splat books (it was "next" in the previous handoff).
- **Epic boons — every book's — are PARKED** in BACKLOG *Features* as a slice of their own, no longer out.

## The prework — DONE, nothing built

- **The plan:** [audits/plans/splat-books.md](audits/plans/splat-books.md) — the numbers, what fires already, the
  hazards, the work by shape with the precedent named per row, the proposed order, the questions.
- **The evidence:** [audits/splat/](audits/splat/) — one file per book, from an OFFLINE scan.
- **The tools (new):** `tools/scan-corpus-offline.mjs` (copies the LevelDB packs out of the data folder minus LOCK and
  reads the copies with classic-level from the sibling `fvtt-mcp-dnd5e` checkout — no Foundry, no bridge, no sole-GM;
  flattens Actor packs into bestiary rows), `tools/classify-corpus.mjs` (ranks the three books; `actor` rows →
  `monster`, `.items` packs → `dm`), `tools/audit-splat-books.mjs` (the evidence tables). Regenerate in seconds:
  ```
  node tools/scan-corpus-offline.mjs dist/splat-corpus.json dnd-arcana-unleashed dnd-heroes-faerun dnd-ravenloft-horrors-within
  node tools/classify-corpus.mjs dist/splat-corpus.json
  node tools/audit-splat-books.mjs dist/splat-corpus-classified.json dist/splat-corpus.json
  ```
- **The sandbox was touched once** (three read-only index probes, before the user said stay out). Nothing else.

### The findings the next session must carry

1. ⚠ **A live defect — Ravenloft's `Survivor` feat collides with the Fighter's `Survivor`.** `scripts/lookup.js`
   `featureNamed` matches any `feat`-type item by name, so a holder of the Ravenloft feat gets `D20_FLOORS` Defy Death and
   the `TURN_GRANTS` Heroic Rally offer. Fix: a type-aware feature match (`system.type.value` `class` vs `feat`/`origin`,
   or the row's `rule.uuid` source). Its own suite section. Ravenloft's `Touch of Death` feat shares a name with
   Ankhtepot's action too — no row yet, guard whichever lands first.
2. **Heroes of Faerûn is half in already** — its `.options` pack has ranked in the corpus since Slice A and three rows are
   keyed (Death Armor, Purple Dragon Commandant, Street Justice) — but NO register ever read it (the classes and spells
   registers filter to the PHB packs). Its register is the main gap.
3. **The MM machine covers the splat bestiaries for free:** ~25 trait/reaction names are MM rows (Magic Resistance on 36
   bearers, Undead Fortitude, Regeneration, Parry / Shield / Protection, Life Drain, Avoidance, Misty Escape…). Ravenloft's
   `fallback-actors` (54) are MM-shaped reprints.
4. **The work by shape** (plan §5): ~110 rows on existing tables; small kinds — Arcane Shot as a hit-menu GROUP row (8
   options; Piercing/Seeking Shot are TEXT), one new moment (BECOMING Bloodied — Harvest Undead, Bloodthirst, Sentinel at
   Death's Door; classify the flag key in `decide/moments.js`), initiative-time rows (`INITIATIVE_SWAPS`' moment), a
   companion-drop reaction (Vestige Recovery), evolving items on the `wieldsAs` reader (measure one first; Arcana's
   `.effects` pack is the house's first ActiveEffect compendium), halve + crit-cancel interrupt.
5. **OUT / held:** summons-shaped features park on GitHub issue #1; cast-triggered and redirect stay held; mist talismans,
   soul trinkets, the Tarokka, factions, bastions are narrative.

## Next, in order (each on the user's go)

1. **The user rules plan §7** — order (default Faerûn → Ravenloft → Arcana), both bestiaries in by name, summons parked
   on #1, one minor per book (2.12 / 2.13 / 2.14) or one, when the Survivor fix ships (default: first commit).
2. **The prework commit of the slice:** the Survivor collision fix + its suite section; BACKLOG / DESIGN §3 frame lines
   if the rulings move anything.
3. **Book 1 — Heroes of Faerûn:** a register (NATIVE / MODULE / ROW / TABLE / KIND / TEXT / OUT / WAITS, precedent named;
   a new per-book auditor on `tools/register-shared.mjs`, the way `tools/audit-dmg-register.mjs` was written) → rows → their own suites
   (`battery.mjs --changed`) → v2.12.0. ~35 rows, the Bloodied moment, the initiative rows.
4. **Book 2 — Ravenloft:** species, 7 subclasses, 11 feats, 5 dark gifts, then the bestiary's ~40 new monster rows on
   Slice B's shapes → v2.13.0.
5. **Book 3 — Arcana Unleashed:** Arcane Shot's group, the 8 school subclasses, 33 spells, 38 combat items → v2.14.0.
6. **The 3.0 floor battery** (clean the sandbox first: verify-settings --fix, reset-fixture-state, fixture-suite; no
   other session on the bridge), the docs frame lines ("PHB + DMG + MM + the splat books built"), then the user cuts
   v3.0.0 by hand; prod only on the user's word.

## Suite lessons (keep them)

- ⚠ No `foundry-local5e` MCP call while a battery runs: it joins the bridge and every later suite fails its preflight.
- The offline scan needs NO bridge — prefer it over `scan-corpus.mjs` for any book census.
- A vial's Use Poison is both the coating's use and its save: the hit's own use is marked (`hitUses`) so the veto skips it.
- Never delete an item whose activity a just-posted save card still reads.
- A ring's MEMBER copy is named `<effect> — <source>`: match it by `startsWith`.
- A PENDING save demand routes a sheet save of the same creature into the demand's withhold: roll sheet saves first.
- The off-scene main row (y 2100): a token there cannot be moved back onto it.
- Heredoc edits mangle backslashes AND `\'`: write edit scripts to a scratchpad FILE (python, `newline=''`).
- No dates in code comments, no user quotes in code comments (a check fails them in `scripts/`). Commit bodies ASCII.
  `biome --write` on named files only.
