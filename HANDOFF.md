# Handoff — the metamagic pass, delivered and being walked (2026-09-09)

Read [CLAUDE.md](CLAUDE.md), then this page. Written on the user's word ("make a handoff for next
session"); retire it when the commission below is delivered (BACKLOG's rule: no standing handoff).

**Where we are.** The metamagic pass — all ten 2024 Sorcerer options — was drawn, ruled and
delivered on 2026-09-09 in one day (PLAN.md *THE METAMAGIC PASS*, DESIGN §6 *Metamagic*), then
recut three times the same evening from the user's live walks on the sandbox. **Everything is
committed and pushed** (main == origin/main, 24 commits after v1.34.3). **Nothing is released:
prod stays on v1.34.3**, and the release is the user's call alone. The sandbox carries HEAD;
`smoke-metamagic` is 76/76 on it, settings CLEAN, the battery green (2026-09-09, before the
evening's recuts — see §4).

---

## 1. What the user is walking, and how it should behave

Cast Fireball as Gren (every option is on his sheet, sandbox only, 5 Sorcery Points):

1. **The casting window** carries the *Battle Flow — Metamagic* group: a row per option the sheet
   grants, the cost as the tag, the rule folded under; rows the spell does not fit or the points
   cannot afford stay greyed with the reason. One tick greys the rest (one option per cast).
   Careful/Heightened list creatures IN the window only when the caster had targets selected.
2. **Place the template.** For a Careful or Heightened cast that selected nobody, the usage card is
   HELD (cancelled at birth, its data kept), so nothing downstream fires.
3. **The ask at the area:** one popup, *Party* then *Non-Party*, everyone inside the area, party
   members pre-ticked up to the Charisma cap (then the caster's side, then neutrals); a tick pings
   the token on the map; the hold-timer clock keeps the defaults. Heightened is a radio, the first
   hostile marked.
4. **OK posts the real card**, which is when everything else goes: FX Studio's picture (it awaits
   Battle Flow's hold — §3), the caster's dice (their popup, or the auto-roll), the save prompts
   for everyone not spared, the Sorcery Points spend with the floating text and the card line.

Empowered opens after the damage dice land (eight chips to a row, waits out the dice animation);
Seeking is a d20 fold offered beside Heroic Inspiration on a spell attack's miss.

## 2. The commission for the next session

Nothing is owed by default. When the user walks and reports:

- **Reproduce in the harness first** (`tools/smoke-metamagic.mjs`, 18 sections; `--section 9`
  is the Careful area road, `--section 16` Empowered, `--section 15` Seeking). ⚠ The **carrier
  road** — card held at birth, the ask off a whisper, the real card posted on OK — is exercised only
  by the user's live cast: the headless harness cannot click through the system's own template
  placement, so the suite's Careful sections take the ADOPTION road (card first, template placed by
  hand, the ask on the card). A live report on the carrier road has no test behind it yet; writing
  one means driving `activity.use()` with `create.measuredTemplate: true` and completing the
  preview with synthetic pointer events on the canvas — untried.
- **Disconnect the MCP bridge and check the user is out of the sandbox** before any suite (the
  preflight refuses two GMs; "Matt the DM" logged in is the user testing).
- **Fixtures:** `node tools/fixture-suite.mjs` after any live walk (it moves tokens off the range)
  and after any prod refresh (which wipes them). BF Test Sorcerer is the metamagic fixture; every
  built actor is healed to full each run.

The three other play reports of 2026-09-09 stay parked in BACKLOG *From play* (Spirit Guardians
out of range, the stale Shield/Immutable Barrier effect, private rolls) — not owed.

## 3. FX Studio — what changed there, and the note to keep

The user uses **FX Studio** (`../fvtt-mod-fxstudio`, their own module, in active development), not
Automated Animations. Its area picture plays on the template's **Region** — before the ask. So:

- **Battle Flow** exposes `game.modules.get("fvtt-mod-battleflow").api.castHold(activityUuid)`
  (metamagic.js): a promise that settles with the cast's card when a held cast posts its real
  card, on this client or arriving from another (the elect's clock kept the default);
  `battleflow.castReleased` fires beside it. No hold → `null`. Also `battleflow.deferredUsageCard`
  (saves/demand.js stamps the demand off it) and `battleflow.metamagicAskAnswered` (the deferred
  dice) — both local hooks.
- **FX Studio** (`scripts/readers/dnd5e.js`, the `createRegion` handler, commit `8ea90d0`) awaits
  that hold before an area picture, bounded at five minutes; no hold, no wait. Its three checks
  (`check-imports`, `check-layers`, `check-legacy`) are green; deployed to the sandbox with
  `deploy-house-module.mjs fvtt-mod-fxstudio --local`; pushed.
- ⚠ **It is a PATCH, and the user asked for the note to be kept** ("keep a note on that fx studio,
  as that is a tool in active development"): one reader, one call site; the message and effect
  readers never ask (harmless today — Battle Flow holds the card itself); FX Studio's timing policy
  and Battle Flow's ARCHITECTURE do not name the hold. **The systemic shape is drawn, not ruled**, in
  FX Studio's BACKLOG (first section, *The cast hold*): the wait in the dispatcher for every moment,
  one timing-policy line, the api recorded in ARCHITECTURE beside the volley registry. About an
  hour. Do not start it unasked; do not let a later FX Studio refactor drop the hold.

## 4. Known gaps and where the evidence is

- **The battery** (2026-09-09, 25 suites, 181/181 registrations fired, `dist/battery/2026-09-09T16-49-37`)
  ran before the evening's recuts (the ask at the area, the deferred card, the cast hold, the
  Dreadful Strike spend record). Only `smoke-metamagic` (76/76) and `smoke-clock` §1 have run on
  HEAD. A full battery on HEAD is the honest next check before any release; two sections failed
  inside the last battery and passed alone (saves §22, emanations §11 — NOTES §5, the ordering
  class): rerun alone before diagnosing.
- **Twinned** is a data read with an exceptions table (`TWINNED_EXCEPTIONS`, registry.js); every
  name the user was asked about is ruled — Magic Missile, Scorching Ray, Animate Dead, Create
  Undead, Cordon of Arrows, Tasha's Mind Whip OUT; Jump, Chain Lightning IN.
- **The ask timer keeps rolling saves for PCs** (ruled; do not re-raise).
- **Dreadful Strike's floating text** — fixed the same day (clock-riders.js writes the uniform
  spend record); Jetten's next hit should flash *Dreadful Strike: N of M remaining*.
- **Docs recut for the metamagic pass:** PLAN (the block with HOW IT WENT per stage), DESIGN §6
  *Metamagic*, ARCHITECTURE (the decide row, the machines list), SWEEP §2's row, README, BACKLOG.
  The three evening recuts (ask at the area, deferred card, cast hold) are in the commit messages
  and DESIGN's Careful bullet; ARCHITECTURE does not yet list the `api.castHold` surface (§3).

## 5. Release, when the user says so

`tools/build-release.ps1` for the zip; `deploy-house-module.mjs fvtt-mod-battleflow` (no flag) is
PROD — never run it unasked. Two new files since v1.34.3 (`scripts/metamagic.js`,
`scripts/decide/metamagic.js`); WebDAV never prunes, nothing was removed this pass. The R4 pin is
30 (`seeking`), the source-file pin 71.
