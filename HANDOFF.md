# HANDOFF.md — the commissioned work, and only that

> **Provenance.** Written 2026-09-02 at the end of the session that delivered the expiry/reminder
> review pass (`e7ee88b`…`b9bdea5`), then rebuilt the gate INSIDE the system's own roll dialog
> and added range (the commits below). Per the standing convention this file exists only while
> a commission does, and retires when this delivers. **Status: the native-dialog gate and range
> are BUILT and STATIC-GREEN (15 checks, 348 unit tests, 24 kinds pinned) and DEPLOYED to the
> sandbox, but LIVE-UNPROVEN — the user was connected to the sandbox and the server could not be
> bounced, so no suite has run on this build.** The user saw the native-dialog gate live (a hard
> refresh) and said *"looks very good"*.
>
> ⚠ **PROD IS ON FREEZE** (user, 2026-09-02): never deploy to prod, no release; the sandbox is
> the long-term test area. `deploy-house-module.mjs --check` against prod reads as drift by design.

---

## The first thing next session does

1. **The user bounces the server** (they said they would): `node scripts/local-foundry.mjs
   restart` in `../fvtt-mcp-molten5e` — it refuses while a human is connected; do not `--force`
   under them. The module on disk is already this build (`--local` deploy done 2026-09-02); a
   bounce is what the suites need (the harness caches scripts by version).
2. **Run, one at a time:** `node tools/smoke-reminders.mjs` (§1–§10 — the native-dialog gate, the
   card link, the highlighted net, the roll-mode pick, the metric grid, RANGE and the dropdown),
   `node tools/smoke-expiry.mjs` (§10 gates after a boundary), `node tools/smoke-nogm.mjs`
   (§spent — no other client connected). Then `node tools/verify-settings.mjs`.
3. **What may need a hand, in order of likelihood — none of it is measured yet:**
   - `smoke-reminders` §10's far tokens sit at `1500 − 100·13` px (x = 200): if the range's scene
     is narrower than that, place the far token the other way (x = 1500 + …) or use a
     shorter-ranged weapon; the section logs the weapon it found (`ranged: Dart (20/60 ft)`).
   - §10e–g drive the dialog's own `select[name="attackMode"]` with a synthetic `change` event
     and expect the section to grow/shrink; if dnd5e's form listener does not fire on a
     synthetic event, dispatch it on the form instead (`app.form.dispatchEvent`).
   - The victim fixture token's DISPOSITION is set hostile for §10 and restored; if the fixture
     ships it hostile already the point-blank box in §1–§9 would have appeared too — it did not
     on the last (pre-range) run because range was not yet a kind; watch §1b's text for
     "within 5 feet of" and, if it appears, set the victim neutral for §1–§9 in the fixture setup.
   - `drawGate` reads `app.form`; if dnd5e's dialog exposes it under another name the fallback
     `element.querySelector("form")` carries it.
4. Fix what fails, commit `fix:`, then the full battery once (≈27 min; two suites have a
   documented dice/fixture-HP flake — effects and expiry — re-run before diagnosing).
5. **Then the NEXT commission, recorded by the user 2026-09-02: volleys and the gate** —
   BACKLOG.md's row *"Volley spells and the gate"*: rays roll `configure: false` so the gate never
   meets them, and Sap is spent by the first ray. Design first (one press per volley at the aim
   popup, or per ray; whether Sap spends on the volley as a whole), then build.

## What this build is (commits after `b9bdea5`)

- **The gate inside the native dialog** (`scripts/reminders.js`, rewritten): the pre-roll hook
  judges the sources, forces `dialog.configure = true`, sets `dialog.options.defaultButton` to
  the net and hands the judgement (`judge(attackMode)`) to the dialog on `dialog.options.bfReminder`
  (shared with `config.bfReminder`); `renderRollConfigurationDialog` draws ONE fieldset
  (`decide/present.js` `reminderFieldsetHTML`, `decide/reminders.js` `reminderView`) after the
  dialog's CONFIGURATION part and moves `autofocus` to the net's button — re-judging from the
  form on every render (`drawGate`, the dropdown) and on `targetToken`;
  `dnd5e.postRollConfiguration` stamps the `reminder` record from the finalized roll's
  advantage mode. No re-issue, no house popup, no card requirement. Seams recorded in NOTES §2.
- **Range** (`decide/reminders.js` `rangeSources`, `decide/registry.js` `RANGE_RULES` + the
  fifth reminder kind `range`, pin 23 → 24): beyond normal → Disadvantage; beyond long / beyond a
  single range → listed, not counted; an enemy within 5 feet (alive, not Incapacitated, the
  other disposition) → Disadvantage with the can-it-see-you caveat. Facts from
  `activity.attack.type.value` / attack mode `thrown*`, `item.system.range` (or the activity's
  override / a spell's single range), converted to feet through the system table. The shipped
  Reminder Sources default and `tools/verify-settings.mjs` carry `range`.
- **Removed:** `rollChoices`, `choiceRowHTML`, the house-popup gate, `usageCardFor`, the
  forwarded-event/flat-key re-issue machinery. `situationalBonusHTML`/`modeButtons` stay for the
  concentration, save and Topple popups.
- **Suites:** smoke-reminders retargeted to the system dialog (`rollDialog`/`gateOf`,
  `popupText` reads the section, `press` clicks the dialog's own submit button, §6 asserts the
  BARE system dialog, §8 asserts all three hooks fired, §10 range + dropdown); smoke-expiry §10
  and smoke-nogm §spent retargeted the same way.
- **Docs recut:** DESIGN §5 (the gate inside the dialog, the section follows the dialog, range),
  NOTES §2 (the six seams), ARCHITECTURE §7 rows + §9 seam row, README, BACKLOG (volleys).

## The environment, as left

- Sandbox headless, Foundry 14.365 / dnd5e 5.3.3, this build on disk; the user's own window
  was connected at the end of the session. Fixtures present. Settings CLEAN as of the last
  check (the reference table now carries `range`, so the world's `reminderList` will read as
  DRIFT until `--fix` or the user adds `range` — that drift is the feature arriving, not residue).
- `x/` at the repo root is an untracked LevelDB directory the user has not said to delete.
- The MCP repo's stats scan still does not read the `chipSpend` and `reminder` families.
