# tools/

Everything here is **development tooling**. None of it ships in the module zip.

Suites and probes drive a **live Foundry world** through the sibling MCP repo's headless
browser (`../fvtt-mcp-molten5e`, needs its `.env` and a built `dist/`). Read
[NOTES.md §5](../NOTES.md) before running anything — the protocol there is not optional.

```bash
node tools/smoke-saves.mjs                 # the local sandbox (default)
BF_TARGET=prod node tools/smoke-saves.mjs  # the live world, deliberately
```

## Static — no Foundry, no world, seconds

| Tool | What it asserts |
| --- | --- |
| `check-hook-order.mjs` | the load-bearing same-hook registration orders (ARCHITECTURE §7). Run it whenever a file, an import or a hook registration is added. |
| `check-registry.mjs` | every `S` key is registered and every registration is named in `S`; every registry entry declares a known kind and no amount; every shipped list-setting default survives its own strict parser. |

Both run inside `npm run verify`, along with biome, knip and the unit tests.

## Live contract checks — read-only, safe beside a session

| Tool | What it asserts |
| --- | --- |
| `check-mastery-rules.mjs` | the verbatim rule text still matches the system's own rules journal (ARCHITECTURE §5 law 8). Run after any dnd5e upgrade. |
| `check-popup-routing.mjs` | popups route to whoever owns the decision, across **two** clients. The only two-client harness here, and the only thing that can see this. |

## Smoke suites — drive real chains, MUTATE the world

One per feature area. Every suite restores the settings it touches and deletes its own chat
messages. **Run one at a time**, disconnect the MCP bridge first, and verify settings after.

`smoke-battleflow` (run first — it places the shared victim token) · `smoke-hold` ·
`smoke-riders` · `smoke-effects` · `smoke-maneuvers` · `smoke-concentration` · `smoke-cast` ·
`smoke-volleys` · `smoke-resources` · `smoke-saves` (run last)

## Probes pending promotion

Verification harnesses that earned their keep but have not yet been folded into a suite
(PLAN.md Phase 1.1): `probe-player-damage.mjs`, `probe-save-damage-popup.mjs`,
`probe-volley-resources.mjs`.

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

### The disposable-world cycle

```bash
node tools/world-snapshot.mjs take     # before the battery
# ... run suites ...
node tools/world-snapshot.mjs restore  # after
```

Rolling back makes most of the ceremony in NOTES §5 unnecessary — teardown correctness,
settings restore, the crash-launder hazard and cross-run fixture poisoning all stop mattering
when the world is thrown away. The suites have not yet been simplified to take advantage of
it (PLAN.md Phase 5).

## content/

World **content** repair, not module tooling — grafts and audits that fix compendium data so
the module does not have to learn an ability's name (NOTES §4). These are not part of the
module's test surface and are not run as part of any battery.
