# HANDOFF.md — RETIRED 2026-10-02 (the overnight run done: Arcana v2.12.0 and Faerûn v2.13.0 on prod; Ravenloft HELD)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> Nothing is handed over. **Wait for the user's go.** A ruling in chat is not a go.

## Where things stand

- **Prod runs v2.13.0** (Heroes of Faerûn), byte-identical, settings CLEAN; v2.12.0 (Arcana Unleashed) before it the same
  night. The module.json version string and Errata 5e ON / Vendor Fixes OFF all wait the user's **process restart**.
- **The splat books:** Arcana Unleashed and Heroes of Faerûn BUILT, battery-green, released (BACKLOG 5b; RULINGS *Arcana
  Unleashed* and *Heroes of Faerûn*; the registers and drawings under audits/). **Ravenloft is HELD** — the user's stop. Its
  prework stands in [audits/plans/splat-books.md](audits/plans/splat-books.md); its Survivor collision is already fixed
  (`FEATURE_TYPES`). When the go comes: the drawing → `tools/audit-splat-register.mjs ravenloft` → rows on existing tables →
  smoke-splat sections → the full battery → v2.14.0.
- **E-004 wrapped:** Errata 5e deployed to prod and switched on in the world config (effective at the restart); Battle Flow
  needs nothing for the Sword of Sharpness.
- **Then 3.0.0** = PHB + DMG + MM + the three books, pre-walk — the user's to cut by hand.

## Suite lessons from the run (keep them)

- ⚠ No `foundry-local5e` MCP call while a battery runs: it joins the bridge and every later suite fails its preflight.
- A hold multiplier row whose activity CONSUMES itemUses takes no row `uses` (Elemental Rebuke): the row spend left the
  cast unpaid. Beguiling Defenses' row has `uses` because its activity consumes nothing.
- A bystander reroll row's `bonus` counts in the margin gate; a suite penalty that makes a pass impossible is never asked.
- A lent feature whose die is a subclass SCALE value (Polar Strike) needs its part pinned by hand in a suite.
- A section that drops a fixture to 0 HP restores HP AND the Dead/Unconscious status for the sections after.
- `keep()` a fixture value at SETUP, never after the section's write — the test value restores for good otherwise
  (the Halfling's -8 reached smoke-classes 42b).
- The Halfling fixture's Lucky HOLDS every hit on it: spend its uses for a run that hits the Halfling, put them back.
- Heredoc edits mangle backslashes: edit scripts go in a python file (`newline=''`). No dates or user quotes in code comments.
