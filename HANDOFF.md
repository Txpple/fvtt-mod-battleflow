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
- **Still open:** the final settings list, drafted for the user at the start of Phase 2.

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

## Phase 1 — comments and docs

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

## Phase 2 — the content shape, in one move

- **Measure:** probe the sandbox's packs and snapshot every row's identifier, compendium source
  and rules version. dnd5e stamps `system.identifier` when an item is created and indexes it
  (`actor.identifiedItems`). Seventeen differ between the SRD and PHB copies (the named-wizard
  spells, Channel Divinity), so an alias table covers them.
- **Look items up** by identifier (type-scoped, rules version checked), then compendium source as
  a tie-break, then the name with a warning. The lookups are `scripts/lookup.js` and
  `scripts/hold/lookup.js`.
- **The tables are the only list:** the 31 list settings go, after prod's saved lists are
  compared with the defaults (read only) so no house row is lost. The list parsers,
  `tools/verify-settings.mjs` and the release's "settings clean" step retire with them.
- **Settings:** down to about ten, one decision timer in place of eight; the list is the user's.
- **Rule text:** read from the item's own description, or dnd5e's rules reference for the
  glossary rows. The "the rule ▸" fold changes, so it gets a prototype first.
- **Proof:** a CI check that every row resolves in the snapshot; the full battery; a walk.

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
