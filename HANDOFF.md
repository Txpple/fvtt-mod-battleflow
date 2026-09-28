# HANDOFF.md — the refactor and recalibration (commission, 2026-09-27)

> **What this is:** the commission every session works from until it is delivered. It is retired
> when Phase 4 lands, and its record is git history. Future slices (spells, Slice B's monsters,
> the class walk) wait for it: the user, 2026-09-27, *"we will push our future slices down in
> priority so we can level set here a bit on the refactor and recalibration"*.

## Why

Battle Flow was measured at `c0dc19c` against the repos of its peers: midi-qol, Chris's Premades
with its engine, Gambit's Premades, Automated Conditions 5e, Build-a-Bonus, Ready Set Roll and
dnd5e itself. It is the best-engineered module of the group and the only one already on dnd5e 6
that patches nothing. It is behind every maintained peer on how it identifies content and on how
readable its code is.

| Measure | Battle Flow | The peers |
| --- | --- | --- |
| Comment lines in shipped code | 39% (14,766 lines), 1,086 of them dated | 1% to 13%; midi has one dated line |
| Comment text in blocks carrying dates, quotes or walk/slice/release history | 65% | none; history lives in changelogs |
| How content is found | English item names, in 47 code tables **and** 31 list settings | dnd5e's `system.identifier`, or data on the item |
| Copied rule text | 244 strings, about 45,700 characters (DESIGN N1 says nothing is transcribed) | Chris's engine ships none; it reads the item |
| Hook registrations | 304 on 61 hooks, 137 on chat events, order frozen by a snapshot | one ordered dispatcher (Chris's engine, AC5e, midi's state machine) |
| Settings | 65 (61 world) | 7 to 30 |
| Listeners on dnd5e's undocumented `…V2` hook aliases | 32 | — |

## The rulings (the user, 2026-09-27)

- **The vision:** batteries included, a "just install it" layout of 5e written by one author;
  midi is the alternative for anyone who wants to configure everything. Settings shrink to a few
  configs for DMs.
- **The repo stays public and MIT, closed to contributions:** the README says so and GitHub
  Issues are off. Nothing is built for an outside contributor (translations, contributor docs,
  publishing the test tooling).
- **Comments first**, after the clean start.
- **Code-only content tables:** no per-world list and no per-row switch.
- **The cover branch merged first.**
- **The settings list, ruled** (the user, 2026-09-27, *"this is fine for now"*): ten settings,
  listed under Phase 2.

## Ground rules

- A refactor never rides inside a feature, and a feature never rides inside a refactor.
- Every phase lands with `npm run verify` green (CI runs it on every push) and its own proof.
- `biome --write` runs on named files and one rule at a time, never on a directory.
- `noThisInStatic` is suppressed in `emanations.js`, never fixed: Foundry calls a region
  behavior's event handlers with `this` bound to the behavior instance.
- Prod is read, never written, by this work (the molten5e bridge is prod).

## Phase 0 — the clean start ✅ delivered 2026-09-27

- The cover branch merged (`883f624`): smoke-reminders §14 6/6, probe-effect-view 17/17,
  smoke-surfaces 20/20 on the merged tree.
- CI: [.github/workflows/verify.yml](.github/workflows/verify.yml) runs `npm ci` and
  `npm run verify` on every push. Its first run, on Linux, caught `toPosix` keeping Windows
  backslashes (`53a7f2e`).
- Biome at zero warnings, and `check` runs with `--error-on-warnings` (`5436720`).
- The README's *Contributing* section; GitHub Issues off.

## Phase 1 — comments and docs ✅ delivered 2026-09-27

| | Before | After |
| --- | --- | --- |
| `scripts/` comment lines | 14,766 (39%) | 5,094 (17.8%) |
| `scripts/` total lines | 40,412 | 30,884 |
| `tools/` comment lines | 6,695 (18%) | 3,533 (10.5%) |
| Dated comment lines, both | 1,559 | 0 |

- The rule is ARCHITECTURE §11 *Writing a comment*; `tools/check-comments.mjs` fails the gate on
  history in a `scripts/` comment; every `comments:` commit is proven by
  `tools/check-comment-only.mjs`, locally and in CI.
- 34 rulings the comments carried and RULINGS did not are in RULINGS *Rulings the code carried*,
  to fold into their features' sections at the next recut.
- What stays above ~15% is typed JSDoc in `decide/` (the type checker reads it) and hazards.
- The docs keep their dated records (a measurement keeps its date); BACKLOG's header lost its
  story of retired commissions.

The plan as written:

- **The rule, written down:** a comment says what the code does and why, in the present tense.
  No dates, no quotes of the user, no walk, slice, session or release history, no "was" or
  "used to". A ruling lives in RULINGS, a platform fact in NOTES, history in git.
- **The checker:** `tools/check-comments.mjs` grows a rule that fails on a dated line, a quote of
  the user, or a history word in a `scripts/` comment.
- **The proof:** a commit that only touches comments is proven by parsing each changed file with
  the repo's TypeScript, printing it with comments removed, and comparing it with the parent
  commit's. Identical means the code did not change. It becomes a tool in `tools/` and a CI step
  for commits whose subject starts `comments:`. No sandbox runs are needed for this phase.
- **Before a ruling's comment goes:** confirm RULINGS covers the topic. When it does not, add one
  timeless line there first.
- **The order:** the biggest first (`decide/registry.js`, `ui.js`, `d20-folds.js`,
  `decide/present.js`, `emanations.js`, `shared.js`), then the rest; the docs' history prose; the
  `tools/` comments last.
- **Done when:** no dated line in a `scripts/` comment, and comments at or under about 15% of the
  shipped lines.

## Phase 2 — the content shape ✅ delivered 2026-09-27

| | Before | After |
| --- | --- | --- |
| Settings | 65 (31 lists) | 10 (seven world, three client) |
| How content is found | English names | dnd5e `system.identifier` first, the name as fallback |
| Copied rule text | 258 strings | 0: pointers to the book, read at render time |
| Proved by the build | — | 228 content rows and 251 rule pointers against the packs' snapshot |

- **Settings** (`4357272`, RULINGS *The settings*): every machine always on; one Decision Timer;
  Players Roll Their Own Saves covers the demanded saves too. The 31 lists are code tables (prod's
  saved lists all equalled the defaults). The suites' retired keys are translated by
  `tools/harness.mjs` `retireSettings`; `verify-settings` holds the seven world settings.
- **Identity** (`b51a161`, ARCHITECTURE §6 *How a row names its content*): measured on the sandbox
  (dnd5e 6.0.5, 32 packs): every table name slugs to its item's identifier, so the tables keep
  their names; `ALIASES` is empty. Newly found: a statblock's renamed copy ("Heat Metal -
  Spellcasting"). Shield-like names are type-scoped.
- **Rule text** (`fc82949`, `c5b92d9`, RULINGS *The rule fold reads the book*, option A off the
  prototype): `scripts/rule-text.js` fills every pointer from the item's own paragraph (its bold
  lead) or dnd5e's rules page; pointers name the house's books first.
- **The proof:** `npm run identifiers` in verify; the full battery green on the committed code
  (2026-09-28, 43 rows, 76 min; `858b4af` adapted the suites, no module bug among 27 failing
  ones); WALKED by the user 2026-09-28, all good. Nothing released: prod stays v2.5.0.
- **The walk** (the user's): the settings page shows ten; a popup's "the rule ▸" opens the book's
  own paragraph (Guarded Mind, a Battle Master maneuver, Prone in the attack gate); a monster
  casting a renamed spell ("Heat Metal - Spellcasting") is recognised.
- **Residue:** BACKLOG *Phase 2's residue*.

## Phase 3 — machine hygiene

- One ordered handler per chat event, with an explicit order table. It retires the hook-order
  snapshot and the lazy import. A static check proves every writing handler is gated to one
  client. Two to read closely: the relay in `ui.js` (its `owns` lets any owner write) and the
  forced-save flip in `saves/views.js`.
- The 32 listeners on `…V2` hook names move to the documented names.
- The waits that poll for another client's write become one wait-for-message helper.
- `@ts-check` spreads outward from the damage chain (auto-damage, auto-apply, the hold).
- A static check for HTML built from unescaped values.
- **Proof:** the battery.

## Phase 4 — release discipline

- A tag builds and publishes the release zip through CI, only from a green commit.
- Then this file retires, and the slices resume in the user's order. Spells come with two new
  machines (placed areas that trigger, the save repeated at the end of a turn) and about 40 rows.
  Slice B's monsters follow.

## Recalibration, written into DESIGN during Phases 1 and 2

- The vision statement, and what Battle Flow leaves to midi.
- The budgets the checks enforce: no chat hook outside the dispatcher, a file-size ceiling, the
  comment rule.
- Watch the platform before building a machine: dnd5e 6.1 plans native auras (issue #5559).
