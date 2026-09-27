# HANDOFF.md — the battery for the PHB feats walk (2026-09-26)

> **Written 2026-09-26 on the user's word** ("lets start the testing in a new session"). The
> session before WALKED the PHB feats groups 1–3 on the sandbox and built five changes during the
> walk (§1). Everything is committed on `main` (99b6e31..73f5e68, unpushed) and deployed to the
> sandbox (`--local`, byte-identical). **Nothing is released; prod is still v2.2.0.** This
> session's job is the TESTING: the suite sections the walk's changes are owed, then the full
> battery, green. Retire this file when the battery is green and the docs are recut. The release
> stays the user's call.

---

## 0. First, before anything runs

- **The user must be off the sandbox** (one GM only — the preflight names who holds it). The user
  asked for this session to test, so they stepped off; confirm with the preflight, don't assume.
- **Any other Claude session holding the local bridge BLOCKS suites** (memory: find it with
  `list_sessions`, `send_message` it to `disconnect-bridge`). Disconnect this session's own bridge
  (`disconnect-bridge`) before the first suite.
- The sandbox copy is the repo at `73f5e68`. If `git log` shows newer commits, redeploy first:
  `node ../fvtt-mcp-dnd5e/scripts/deploy-house-module.mjs fvtt-mod-battleflow --local`.
- Launch batteries DETACHED; after any killed suite: `verify-settings --fix` → `reset-fixture-state`
  → `fixture-suite` (memory: a killed suite poisons the next battery).

## 1. What changed during the walk (each is in RULINGS)

| Change | Where | Suite coverage today |
| --- | --- | --- |
| **Poisoner's Poison Coating** — Apply Poison vetoed into a chip on the ACTOR (a Bonus Action, a dose spent, floated); the next weapon hit spends it through the feat's own save (run from an in-memory copy — the save is an enchantment RIDER, hidden by dnd5e on its source); Poisoned until the end of the Poisoner's next turn (`SAVE_PRESSES` Poisoner, `forceStatus` with `expiry: "sourceEnd"`) | `use-chips.js` (COATINGS), `saves/consequences.js`, `shared.js` | **NONE — owed** (§2 a) |
| **Healer is automatic** — every 1 rerolled as the dice land, no popup | `heal-rerolls.js` | `smoke-heal` REWRITTEN (six sections) — **never run** |
| **A reroll keeps its die's floor** — `rerollFaces` honours a term's `minN` (`count`), so Empowered after Elemental Adept and Piercer under Great Weapon Fighting keep 2 / 3; Empowered's chips show the COUNTED value | `decide/damage-dice.js`, `metamagic.js` | unit tests only; `smoke-metamagic` / `smoke-savage` exercise the paths — **add** a floored case (§2 c) |
| **Elemental Adept's type pick** — a typeless copy landing on a character (or its own card, clicked) posts a card and asks; the answer renames the copy; a rename by hand settles it | `fighting-styles.js` (`typePick`, the row's `choices`) | **NONE — owed** (§2 b). ⚠ `smoke-styles` §13 LENDS a typeless "Elemental Adept" — the pick now fires there: expect its card and popup, and make the section close/answer it |
| **Wait for the Dice** — the verdict pause's Dice So Nice wait is a world setting (`diceWait`), default 0 (was a hardcoded 6 s) | `ui.js`, `settings.js`, `core.js`; `verify-settings` reference | none needed beyond the battery (every pause-reader runs through it) |

The walk also built `tools/content/place-feats-walk.mjs` (Party Camp's walkers and dummies) —
content, not a suite.

## 2. The owed suite sections (build, then run them alone, then the battery)

a. **The Poison Coating** — a section in the suite that claims `use-chips.js` (`smoke-sneak` §10
   holds Steady Aim; a new section there, or a new suite if the coverage map says so). Use →
   the chip on the actor ("Poison Coating", the dagger icon, 60 s), a dose spent, the card; no
   dose → a warning, nothing written; a weapon HIT → the chip gone, the save card at the target
   with the feat's DC, a failure → 2d8 poison (not halved against Poison Resistance with Potent
   Poison) and Poisoned with `duration.expiry === "sourceEnd"`; a MISS → the chip stays.
b. **The type pick** — in `smoke-styles`: a typeless Elemental Adept created on the fixture →
   the `typePick` card and the popup; a button → the copy renamed, the card chosen; a second copy
   → the chosen type absent from `left`; a rename by hand → the card settles; the displayCard path.
c. **The floor through a reroll** — `smoke-metamagic` (Empowered at an Elemental Adept caster, a
   die pinned to 1 on the reroll → counts 2) or `smoke-savage` (Piercer under a `min3` term).

Then: `node tools/battery.mjs --changed 99b6e31 --list` widens to the **full battery** (the walk
touched spine files: `ui.js`, `shared.js`, `core.js`). The full battery is also the release floor.
After it: `node tools/verify-settings.mjs` (CLEAN expected — the reference now carries `diceWait: 0`
and `maneuverFolds` with `Crusher:shove`).

## 3. Before the release (BACKLOG *Before the next release*)

The stored lists' Reset Defaults (Fighting Styles + Elemental Adept, Poisoner, Crossbow Expert;
Clock Riders + Slasher, Crusher, Piercer; Damage Rolled Twice + Piercer; Maneuver Folds +
`Crusher:shove`) — the sandbox already has them; prod will need them. The new `diceWait` setting
needs nothing (its default is the value). The release itself is the user's word.

## 4. At the end

The docs recut (session cycle): this file retired, BACKLOG's item 4 row told the battery's result,
RULINGS untouched unless a suite finds a bend.
