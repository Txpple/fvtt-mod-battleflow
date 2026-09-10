# Handoff — the metamagic pass, delivered and being walked (2026-09-09)

Read [CLAUDE.md](CLAUDE.md), then this page. Written on the user's word ("make a handoff for next
session"); retire it when the commission below is delivered (BACKLOG's rule: no standing handoff).

**Where we are.** The metamagic pass — all ten 2024 Sorcerer options — was drawn, ruled and
delivered on 2026-09-09 in one day (PLAN.md *THE METAMAGIC PASS*, DESIGN §6 *Metamagic*), then
recut three times the same evening from the user's live walks on the sandbox. **Everything is
committed and pushed** (main == origin/main). ✅ **RELEASED as v1.35.0 on 2026-09-10** (the user:
"commit/push release to prod") — the metamagic pass and the hold registry together, after the
battery on HEAD went green. The sandbox carries HEAD;
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

## 3. FX Studio — the hold, now a registry rather than a patch (recut 2026-09-09, later)

The user uses **FX Studio** (`../fvtt-mod-fxstudio`, their own module, in active development), not
Automated Animations. Its area picture plays on the template's **Region** — before the ask. The
first answer, written the same day, was one Map inside metamagic.js. **It is now
[scripts/holds.js](scripts/holds.js), a spine file**, built on the user's written authorization
(*"if you need to take action to improve battleflow to be systemically compatible, you are
authorized to plan and edit this repo"*) while the FX Studio session built the matching seam.

- **The api** is recorded in [ARCHITECTURE.md](ARCHITECTURE.md) §7, *The public API* — the contract
  in full, and the four decisions in holds.js that are load-bearing for the modal sequence.
  `holdFor(subject)` is the general surface; **`castHold(uuid)` is an alias and is kept forever**
  (FX Studio shipped against that name); `holds` is `{ version, keys }` for capability detection;
  `battleflow.holdOpened` fires when one is raised, `battleflow.castReleased` when one settles.
- **Two defects fixed on the way**, both found writing the contract down:
  1. metamagic.js had **no `deleteChatMessage` handler** — the only moment machine without one. A
     GM deleting the carrier whisper stranded the hold forever: FX Studio waited its full five
     minutes and no card ever posted. It now posts the card as cast, the failed-carrier road's
     own repair. ⚠ The guard is the hold itself — only the casting client holds one.
  2. The hold **released one beat too late** (after `ChatMessage.create` resolved, while
     `createChatMessage` hooks fire *during* it), so a consumer reading the released card found
     the hold still open for the very card that lifts it. Release moved to `preCreateChatMessage`.
- **A self-bound**, tied to the ask's own clock plus 30s slack. ⚠ A **clockless** ask gets a
  clockless hold deliberately (§5 law 11); a default bound would lift while the caster reads.
  ⚠ An expired bound **LIFTS, it does not cancel** — a hold settles three ways (the card, `null`
  for nothing-was-posted, a truthy sentinel for lifted-and-nothing-known). Collapsing the third
  into `null` shipped for an hour and would have suppressed the picture permanently for a late
  answer; FX Studio caught it reviewing its gate against the contract text.
- **[tests/holds.test.js](tests/holds.test.js), 14 tests** — the refcount, the self-bound, and the
  null-return-vs-null-resolution distinction, which are what a later refactor would quietly break.
- ⚠ **The hold is CLIENT-LOCAL**, and this is the thing to know before trusting it: plain Maps in
  the casting client's memory. Elsewhere `holdFor` answers `null`, which means *nothing here can
  see one*, not *nothing is holding*. Harmless today because the template's placer is the caster —
  **a GM placing a template for a player is already outside that luck.** Promoting a hold to world
  state is a real change with a real cost; it is not done, and the docs do not pretend otherwise.
- **FX Studio's side** (`scripts/readers/dnd5e.js`, the `createRegion` handler, commit `8ea90d0`)
  still awaits the hold, bounded at five minutes, and keeps working unchanged through the rename.
  That session is building a **gate seam** — the wait in its *dispatcher*, asking a list of
  registered gates, with Battle Flow one feature-detected tenant and no dependency either way. The
  advisory it worked from is in this session's transcript; its `holdFor` signature had not landed
  back here when this was written. ⚠ **Neither module may import the other**, and some tables
  install neither.
- ✅ **The joint proof — MADE, and it is green on both roads** (2026-09-09, after the four commits).
  `deploy-house-module.mjs fvtt-mod-battleflow --local` put `holds.js` on the sandbox
  (byte-identical), and FX Studio's `smoke-replay` ran **50 of 50**, its §15 gate section included:
  nothing plays while the hold stands · it plays when the hold lifts · a hold that lifts on NOTHING
  plays nothing · the gate unregisters · with nothing holding, the same cast plays straight away.
  Settings **CLEAN** after. The earlier 50/50 had run against the PRE-`holds.js` build, which
  separately proves the `castHold` fallback live — so **both roads are now covered**, the old and
  the new. It remains the only automated proof the two modules work together: this repo's own
  harness cannot reach the carrier road at all (§2).
  ⚠ **A GREEN EXIT CODE IS NOT A PASS** — read the `PASS: n of n` line and the `⚠ PARTIAL RUN`
  stamp. A deliberately partial run (`--section n`) exits 0 by design, and the first invocation
  here **stopped mid-§6 at 15 assertions with no report line at all** and still exited 0. ⚠ The
  cause is **UNKNOWN and unchased** — an earlier version of this bullet blamed passing `--help`,
  and that was **wrong**: `sectionPlan` parses with `strict: false`, so an unknown flag is ignored
  and asks for the WHOLE suite (verified both repos, 2026-09-09). Do not pass a flag believing it
  truncates. If it recurs, the candidates are the 900 s connection watchdog or a section throwing
  inside the page, and the last console line before the report says which.

## 4. Known gaps and where the evidence is

- ✅ **The battery on HEAD is GREEN** (2026-09-10T01-22-08, after the hold commits): every suite
  green, settings clean, **40m 20s**; hook coverage **188/188 registrations, 49/49 observable
  names** (181 last time — the seven new are the hold work's). ⚠ Both sections that failed INSIDE
  the previous battery and passed alone (saves §22, emanations §11 — the ordering class, NOTES §5)
  ran clean in-battery this time: saves 102/102, emanations 68/68. `dist/battery/2026-09-10T01-22-08`
  holds every suite's full output. This is the pre-release check, made.
- **Twinned** is a data read with an exceptions table (`TWINNED_EXCEPTIONS`, registry.js); every
  name the user was asked about is ruled — Magic Missile, Scorching Ray, Animate Dead, Create
  Undead, Cordon of Arrows, Tasha's Mind Whip OUT; Jump, Chain Lightning IN.
- **The ask timer keeps rolling saves for PCs** (ruled; do not re-raise).
- **Dreadful Strike's floating text** — fixed the same day (clock-riders.js writes the uniform
  spend record); Jetten's next hit should flash *Dreadful Strike: N of M remaining*.
- **Docs recut for the metamagic pass:** PLAN (the block with HOW IT WENT per stage), DESIGN §6
  *Metamagic*, ARCHITECTURE (the decide row, the machines list), SWEEP §2's row, README, BACKLOG.
  The three evening recuts (ask at the area, deferred card, cast hold) are in the commit messages
  and DESIGN's Careful bullet. ARCHITECTURE §7 now records the public API in full (§3).

## 5. Release, when the user says so

`tools/build-release.ps1` for the zip; `deploy-house-module.mjs fvtt-mod-battleflow` (no flag) is
PROD — never run it unasked. Three new files since v1.34.3 (`scripts/metamagic.js`,
`scripts/decide/metamagic.js`, `scripts/holds.js`); WebDAV never prunes, nothing was removed this pass.
⚠ **A half-awake Molten box answers every WebDAV GET with a 404 page, so `--check` reports every
file DIFFER with ONE identical hash** — seen 2026-09-10 on the first check of the night. It is not
a stopped box: a read through the molten5e bridge (`get-world-info`) wakes it, and the re-check is
then sane. Never deploy on an all-identical check; wake it, re-check, then deploy. The R4 pin is
30 (`seeking`), the source-file pin 72.
