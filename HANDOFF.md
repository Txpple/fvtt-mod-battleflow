# HANDOFF — final testing of v1.41.0 (written 2026-09-15, evening)

> A commission file: written because there is one, retired when it is delivered (BACKLOG's rule —
> no standing handoff). The session that wrote it ran out of context with the prod MCP bridge
> wedged; nothing below is a guess, every line is the state at the moment of writing.

## Where things stand

- **Main = tag v1.41.0 = GitHub release = prod.** Released and deployed 2026-09-15 on the user's
  "commit/push/release": 78/78 files byte-identical over WebDAV. The user's prod window needs a
  **reload** (the version string vends stale until the Molten PROCESS restarts — cosmetic).
- **What v1.41.0 carries:** the effect view (DESIGN §6 — bar above the hotbar, hover card, held
  Alt; the bar the one interactive surface) and the applied effect's clock (DESIGN §5,
  `appliedClock`). `dist/RELEASE-NOTES.md` is the plain-language summary.
- **The sandbox** runs the same bytes (deployed, server bounced) but its CONTENT has two hand
  edits the user asked for during testing (see step 1) and test residue (a "Damaged: −2 AC"
  effect on Invictus with no clock, applied out of combat; Slowed on him; the Test Range scene
  active). The prod → sandbox copy in step 2 wipes all of that, which is the point.
- **prod is v1.41.0; prod CONTENT is untouched** — the Bramblemaw edits below have NOT been made
  on prod.

## What is owed, in order

### 1. Two content edits on PROD (the user's content; the user said "make the necessary edits on prod items/actors")

The Monster Manual's Adult Green Dragon writes Noxious Miasma's "Damaged: −2 AC" effect against
`system.armor.value` — an armor ITEM's field, which does nothing on a creature (BACKLOG carries
the measurement; DESIGN §5 the ruling: no carve-out in the module, fix the data). Two records:

1. **The base actor Bramblemaw** → item *Noxious Miasma* → effect *Damaged: −2 AC*
   (effect id `TSWsGeApnMgxOyIF`, the same id on prod and the sandbox — the sandbox is a byte
   copy): change key `system.armor.value` → `system.attributes.ac.bonus`, value −2, mode add.
2. **The Bramblemaw TOKEN on the scene "Party Camp"** (an unlinked token keeps its own copy of
   the feature; on the sandbox its token id was `KwoAuBIQgxBExLC7` — re-read it on prod with
   `list-tokens`, do not trust the id). Same edit, targeting the token id as the actor
   identifier. Check "Bramblemaw's Lair" for a second placed copy.

Both were made on the SANDBOX this way and verified (Invictus's AC read 20 with the fixed
effect): `manage-effect list` → `manage-effect edit` with
`changes: [{key: "system.attributes.ac.bonus", value: "-2", type: "add"}]` on the molten5e
server. ⚠ **The molten5e bridge WEDGED 2026-09-15 evening** — three calls hung 10 minutes each
("world never became joinable", then "system unknown"), locking the user's machine — while the
Molten box was waking. Start a fresh session (the MCP server restarts with it), confirm with ONE
`get-world-info` that the world answers as dnd5e before any edit, and if it hangs again hand the
two edits to the user to make in the sheet (Changes tab of the effect).

### 2. Copy prod → sandbox (an EXACT copy, no fixtures — the standing rule)

```
node D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/scripts/local-foundry.mjs stop
node D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/scripts/pull-prod-to-local.mjs
node D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/scripts/deploy-house-module.mjs fvtt-mod-battleflow --local
node D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/scripts/local-foundry.mjs start
```

- The pull REFUSES while anyone is logged into prod (it snapshots LevelDB) — the user must be out.
- `stop` REFUSES while a client is on the sandbox — the user must be out of that too
  (`disconnect-bridge` on local5e first).
- The pull mirrors prod's module folder over the sandbox's, so the `--local` deploy after it is
  mandatory, then `start`. Do NOT run `tools/fixture-suite.mjs` unless the user asks — the copy is
  exact by rule; the BF Test actors exist only when a suite needs them.
- After the copy, the sandbox carries the prod edits from step 1 (do step 1 first, or the copy
  brings the broken key back).

### 3. The final testing walk (the user, in a new window, on the SANDBOX)

What to look at, in the order the rulings landed. Every item was proven headless
(`tools/probe-effect-view.mjs` 16/16, `tools/probe-applied-clock.mjs` 8/8); this walk is the
user's eyes on it.

1. **The bar** above the hotbar stands for the controlled token — the name alone when nothing is
   on them; select another token and it follows. Hard-refresh first (same version string all day).
2. **Tones:** concentration yellow and first; a condition or a mark red; a penalty in the changes
   red; an enemy's marker red; buffs green. Temporary HP and Heroic Inspiration as green rows.
3. **The name** opens the full list upward, vertical, reading left: Temporary / Passive /
   Unavailable, concentration first in Temporary.
4. **A chip** (owner only) opens a fold with ONE button: Remove / Disable / Clear. Escape or a
   click elsewhere closes it. The GM gets it on any token.
5. **The hover card** on any token; **Alt held** shows every creature; both read-only.
6. **Death Armor** cast from Midnight lands with **1 hr** and paints a token icon.
7. **Noxious Miasma** in a running combat, Bramblemaw first: the victim's "Damaged: −2 AC" shows
   a one-round clock, survives the dragon's turn end, survives the victim's own turn, expires at
   the END of the victim's turn — and (after step 1) the sheet's AC drops by 2 while it stands.

Report findings as table findings (NOTES §6); a fixture that shows a bug before any fix.

## Hazards the last session paid for

- The sandbox harness (`tools/probe-*.mjs`, `tools/smoke-*.mjs`) REFUSES while the user's own
  "Matt the DM" window is on the sandbox, and `local-foundry.mjs restart` refuses too — ask them
  to close it; their window then needs a HARD refresh (same version string).
- A Foundry client auto-reconnects after a server restart, so "im out" can silently become
  "1 user connected" a minute later. Check `status` before a probe.
- An effect applied from a chat card that predates a record edit carries the OLD data; a fresh
  use is needed. And a same-named leftover on the target gets read as the landed one — sweep
  first, find the landed one by the applier's returned id (probe-applied-clock does).
- Measured 2026-09-15 on Foundry 14.365 / dnd5e 5.3.3: a bare status is NOT `isTemporary`; the
  token paints an icon for a clocked effect or a condition, nothing for a clockless applied one;
  a clockless effect derives `seconds: Infinity`; an effect's clock is `{value, units, expiry}`.

## When this is delivered

Retire this file (delete it, say so in the commit), and if the walk found nothing, nothing else
is owed: BACKLOG's Adult Green Dragon row stays as awareness, the upstream bug report is the
user's call.
