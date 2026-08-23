# tools/

Everything here is **development tooling**. None of it ships in the module zip.

Suites drive a **live Foundry world** through the sibling MCP repo's headless
browser (`../fvtt-mcp-molten5e`, needs its `.env` and a built `dist/`). Read
[NOTES.md §5](../NOTES.md) before running anything — the protocol there is not optional.

```bash
node tools/battery.mjs                     # every suite, in order, each captured to a file
node tools/smoke-saves.mjs                 # one suite, the local sandbox (default)
node tools/smoke-saves.mjs --list          # its sections, without connecting
node tools/smoke-saves.mjs --section 8     # just §8 (plus anything §8 depends on)
BF_TARGET=prod node tools/smoke-saves.mjs  # the live world, deliberately
```

**Every suite is section-filterable.** `--list` prints the table; `--section 3,5` runs a subset
and stamps its summary **`⚠ PARTIAL RUN`**, so a filtered green can never be mistaken for a
battery green. Setup, fixtures and teardown always run — only assertion blocks are skippable —
and a section that needs another declares it (`DEPENDS` at the head of the file), so asking for
it quietly runs the prerequisite and says so.

## Static — no Foundry, no world, seconds

| Tool | What it asserts |
| --- | --- |
| `check-hook-order.mjs` | the load-bearing same-hook registration orders (ARCHITECTURE §7). Run it whenever a file, an import or a hook registration is added. |
| `check-registry.mjs` | every `S` key is registered and every registration is named in `S`; every registry entry declares a known kind and no amount; every shipped list-setting default survives its own strict parser; the **R4 kind total** and the **source-file count** match their pins. |
| `check-imports.mjs` | every relative import resolves, and every named binding is really exported — including through the lazy `await import()` idiom. |
| `check-comments.mjs` | every `/**` block sits on a declaration, so an extraction cannot strand a doc. |
| `bump-version.mjs --check` | `module.json`'s `version` and its `download` URL name the same tag. |

All of them run inside `npm run verify`, along with biome, knip and the unit tests.

## Live contract checks — read-only, safe beside a session

| Tool | What it asserts |
| --- | --- |
| `check-mastery-rules.mjs` | the verbatim rule text still matches the system's own rules journal (ARCHITECTURE §5 law 8). Run after any dnd5e upgrade. |
| `check-popup-routing.mjs` | popups route to whoever owns the decision, across **two** clients — asserted on BOTH sides ("the GM got it" only means something beside "and the player did not"), with the diagnostic ledger still printed in full. |

## Smoke suites — drive real chains, MUTATE the world

One per feature area. Every suite restores the settings it touches and deletes its own chat
messages. Disconnect the MCP bridge first, and verify settings after — **`battery.mjs` does the
ordering, the capture and the settings check for you**, which is why it is the front door.

`smoke-battleflow` (first — it places the shared victim token) · `smoke-hold` (⚠ **immediately**
after it) · `smoke-saves` · `smoke-volleys` · `smoke-maneuvers` · `smoke-cast` · `smoke-riders` ·
`smoke-concentration` · `smoke-twoclient` · `check-popup-routing` · `reset-fixture-state` ·
`smoke-effects` · `smoke-resources`

⚠ **`smoke-twoclient` is the one that needs a SECOND client**, and it is where the properties no
solo suite can reach are asserted: the relay's **relayed** half (a player's answer travels as
their own message and the *continuing client* folds it) and D2's **cross-client popup close**
(the GM's buzzer resolves a hold and the player's popup vanishes without anyone touching its
DOM). It connects the player itself; just do not be logged in as the player test account.

⚠ **One at a time is enforced now, not remembered.** Suites take a pid lockfile in `harness.mjs`:
a second one refuses and names the first. The sole-GM preflight could never see this, because
both suites join as the same user and it counts users, not sockets (NOTES §5).

### The battery

| Flag | Effect |
| --- | --- |
| *(none)* | all eleven, in the canonical order, each captured to `dist/battery/<stamp>/` |
| `--from smoke-saves` | resume after a failure, still in order |
| `smoke-hold smoke-battleflow` | a subset — still run in the canonical order |
| `--snapshot` | take a world snapshot first, roll it back after (the cure for the crash-launder hazard) |
| `--list` | the order and why, without running anything |

Failures print in full to the console **as well as** landing in the file — the `| tail` that
twice lost `smoke-battleflow`'s "2 FAILURE(S)" evidence cannot happen through this door.

## Censuses — how registries get built

`scan-reactions.mjs` · `scan-riders.mjs` · `scan-volley-spells.mjs`

Read-only sweeps of the official compendia. Curated lists are built from what 5e 2024 actually
ships, never from what the party owns (DESIGN N1). Re-run after adding content.

## Operations

| Tool | Job |
| --- | --- |
| `target.mjs` | **which instance a suite talks to** — one decision, one place. Every harness resolves through it and prints the target it chose. |
| `verify-settings.mjs` | diffs the live world against the reference table it carries — **the single source for the user's configuration**. `--fix` restores drift. Run after every battery. |
| `reset-fixture-state.mjs` | shared fixtures back to a known state (conditions off, pools full). |
| `reload-clients.mjs` | refresh every other connected client after a hot-deploy. |
| `maintain-party.mjs` | strip temporary actor-level effects, on demand. |
| `build-release.ps1` | the release zip. **Never use `Compress-Archive`** — see NOTES §5. |
| `world-snapshot.mjs` | `take` / `restore` / `status` / `drop` — roll the sandbox's databases back after a battery. The copy is 24 MB and takes 0.05s; the ~75s cost is the world bounce either side. **Local only.** |
| `harness.mjs` | the twenty lines every suite used to copy — env, watchdog, connect, preflight, the section plan, one reporter, and the **suite lock**. Not a suite; nothing runs it directly. |
| `battery.mjs` | the whole battery in one command, in the order that works, captured to files. |
| `bump-version.mjs` | move **both** `module.json` version fields together; `--check` asserts they are in step and is part of the gate. |

### The disposable-world cycle

```bash
node tools/world-snapshot.mjs take     # before the battery
# ... run suites ...
node tools/world-snapshot.mjs restore  # after
```

`node tools/battery.mjs --snapshot` does both ends for you, which is where it belongs: the
crash-launder hazard bites a BATTERY, and the round trip costs ~75s of world bounce — more than
every `sleep()` in the tree put together, so it is not a per-suite move.

⚠ **The suites keep their own teardowns and probably should.** Rolling back would make that
ceremony unnecessary, but it is also what lets one suite — or one `--section` — run alone
without a bounce either side, which is the workflow the section filter exists to make normal.
Decide before simplifying (PLAN.md Phase 5).

## content/

World **content** repair, not module tooling — grafts and audits that fix compendium data so
the module does not have to learn an ability's name (NOTES §4). These are not part of the
module's test surface and are not run as part of any battery.
