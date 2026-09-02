# HANDOFF.md — the commissioned work, and only that

> **Provenance.** Written 2026-09-02 at the end of the session that delivered the native-dialog
> gate's live proof, the palette ladder, the header-line section, volleys at the aim, Hiding,
> the 5-foot automatic crit, the trimmed notices, and EFFECT SOURCES (`d1cceb3`…`a8615fc`).
> Per the standing convention this file exists only while a commission does, and retires when
> this delivers. **Status: everything built today is BATTERY-GREEN on the sandbox (20/20 steps,
> settings clean, 28m30s) and committed; the tree is clean. What is open is DESIGN, not code:
> three items the user has prototypes for and has not yet ruled on.**
>
> ⚠ **PROD IS ON FREEZE** (user, 2026-09-02): never deploy to prod, no release; the sandbox is
> the long-term test area. `deploy-house-module.mjs --check` against prod reads as drift by design.

---

## The first thing next session does

1. **Wait for "go".** A handoff is not one (the standing cycle). Say what is open, then wait.
2. **Check the sandbox** — `node scripts/local-foundry.mjs status` in `../fvtt-mcp-molten5e`. If
   the user's own window is connected, no suite can run (two GM-capable clients); a bounce
   refuses too. Never `--force` under them. The module on disk IS this build (`--check --local`
   is byte-identical as of `a8615fc`'s scripts, i.e. `9fab402`); a bounce is only needed after
   a new deploy.
3. **The open commissions, in the order the user raised them** — each has a prototype the user
   asked for and has NOT ruled off yet. Do not build any of them without the ruling.

   | Item | The prototype | The pending ruling | Where the design is written |
   | --- | --- | --- | --- |
   | **The save gate** | *The Save Gate* — https://claude.ai/code/artifact/0e3edaa0-2358-4d43-bf88-19e33aa44bb8 | A–E; the recommendation is **E** (forced saves open the system's own Saving Throw dialog with our fieldsets — the attack pattern; our save popup retires), A as fallback, never C. Open question inside E: whether the GM's "queue of saves" habit matters when the native dialog cascades. | the artifact; BACKLOG *"The reminder gate on other d20 tests"* row |
   | **Sneak Attack + Cunning Strike + Devious Strikes** | *Sneak Attack, Cunningly* — https://claude.ai/code/artifact/ac1b9fb3-542d-47db-9640-9b97bfa69f0f (six screens) | The flow as drawn: tick at the gate (rule text + a read-for-you line; the player judges the ally clause), Cunning Strike picked on the DAMAGE OFFER after the hit (which opens even under auto damage when a Sneak Attack is armed), costs off the sneak dice before the roll, crit doubles what is left, effects via the shipped save activities, once per turn as a turn chip. The user ruled: the player decides the conditions; the module automates the damage and the crit; options are read off the sheet, subclass included (Supreme Sneak's Stealth Attack, Envenom Weapons, Death Strike, Rend Mind). | BACKLOG *"Sneak Attack as a choice on the gate"* |
   | **Damage riders on the combat clock** | none yet — designed WITH the Sneak Attack flow | first round / target not yet acted / once per turn as a `when` on a rider row (Gloom Stalker, Assassin) | BACKLOG *"Damage riders on the combat CLOCK"* |

4. When the user rules, build in the house way: static-green (`npm run verify`), deploy
   `--local`, bounce, the touched suites one at a time, `verify-settings`, commit, then one
   full battery (≈28 min; `smoke-expiry` §8b is a documented flake — re-run before diagnosing),
   docs recut, and retire this file.

## What today built (for orientation — the docs carry the detail)

- **The gate's section** (`decide/present.js` `reminderSectionHTML` / `reminderDetailsHTML` /
  `reminderFieldsetHTML`): one header line "N Modifiers — Net [tag]", no net block, folded to
  the header by default (`<details>`), the arithmetic as the header's tooltip. **The palette**
  (`TONE`): green good, red bad, orange pending, yellow crit, grey nothing; Normal is grey,
  Listed is the grey outline (`modeTagHTML`).
- **Six reminder kinds** (`REMINDER_KINDS`, pin 25): vex, sap, prone, condition (14 rows incl.
  Hiding), range, **effect** — `EFFECT_BENDS`, 73 rows from a 30-pack scan (the survey artifact
  *Effect Sources* — https://claude.ai/code/artifact/84a60b2b-a8b6-4ef6-adc3-8c4cfa08d591):
  match by effect or feature NAME, side, scope, caveat, `counted:false` = listed, `judge`
  (bloodied / targetBloodied / targetDamaged / targetGrappled), `spend:"attack"` (spent by the
  roll through mastery.js `spendChips`, key `effect`). Three world lists switch it: Reminder
  Sources, Condition Sources, Effect Sources (parsed whole-chunk — names carry colons).
- **The judge is shared** (`reminders.js` `judgeRoll`) and runs in the volley aim popup per ray
  with the spends carried forward (`volleys.js`, layer pin `volleys -> reminders` BY DESIGN).
- **The automatic crit** (`auto-damage.js` `critFor`, the `preRollDamageV2` hook): a hit within
  5 feet of Paralyzed/Unconscious rolls critical damage; `critWithinFeet` on the condition rows.
  Token distance lives in `scripts/geometry.js` (spine) now.
- **Suites touched:** smoke-reminders (60 checks, §5d–e Hiding, §11 effects), smoke-volleys §10,
  smoke-battleflow §5e, smoke-expiry/nogm retargeted. `tools/verify-settings.mjs` imports
  `LIST_SPECS` for the effect list's default.

## The environment, as left

- Sandbox headless, Foundry 14.365 / dnd5e 5.3.3, this build on disk, fixtures present,
  settings CLEAN (the reference table carries `range, effect` and `hiding`; a world that
  predates them reads as drift until `--fix`).
- The `x/` stray LevelDB at the repo root was deleted (user, 2026-09-02).
- The MCP repo's stats scan still does not read the `chipSpend`, `reminder` and `autoCrit`
  flag families.
- Reading compendia OFF-LINE: copy the pack dir without `LOCK`, open with `classic-level` from
  the MCP repo's node_modules; embedded effects are under `!items.effects!` keys (NOTES §5).
