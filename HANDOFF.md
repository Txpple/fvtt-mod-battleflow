# HANDOFF.md — the commissioned work for the next session

> **What this file is now:** the brief for one piece of work — **THE RESCUE VIEW** — commissioned
> by the user on 2026-08-24. The old continuity handoff is retired by the same call ("there
> should be no handoff; we added a backlog instead"): what is *parked* lives in
> [BACKLOG.md](BACKLOG.md), what is *permanent* lives in [DESIGN.md](DESIGN.md) /
> [ARCHITECTURE.md](ARCHITECTURE.md) / [NOTES.md](NOTES.md), and this file carries only what the
> next session is being handed. ⚠ **The retired continuity doc is preserved in full at commit
> `41583c2`** — its d20-folds history, the enforcement-pass record, the prod-deploy forensics,
> the design rulings and the do-not-re-derive table are all there; migrate a fact to NOTES.md
> when the work below actually needs it.
>
> ⚠ **Provenance, stated plainly because two sessions crossed on it.** This pass was designed in
> a conversation with the user on 2026-08-23 (brainstorm → plan → one presentation ruling
> settled). A parallel session recut the docs on 2026-08-24 and **dropped** the plan as
> unrequested and unverified — a fair objection from where it stood: it had not seen the
> conversation, and the bug claims were verified by reading, not by execution. **The user
> recommissioned the work later on 2026-08-24; this file is that instruction.** The SETTLED
> table below no longer carries the drop row for exactly that reason.
>
> **The standing cycle applies:** wait for the user's "go" (this handoff is not one), one
> battery-green pass per stage, check in at every marked point, docs recut at the end.

---

## Where the tree stands — 2026-08-24

**Nothing is owed.** v1.23.2 is released and runs byte-identical on prod and the sandbox; the
gate is green; the full battery is green over exactly this code; the hook-coverage report reads
clean. Quote the tools, never retype their numbers: `npm run verify` · `node tools/battery.mjs
--snapshot` · `git log v1.23.1..HEAD`.

---

## ✅ DELIVERED — v1.24.0 (2026-08-24)

**The commission is complete.** Every stage below landed, the user walked the window in the
sandbox and signed it off, and the release is built: `npm run verify` green (13 checks, 262
tests, zero moved pins, 83 hook registrations unchanged), full battery green over exactly this
code — 16/16 suites, `smoke-d20-folds` 60/60, settings CLEAN, hook coverage reporting nothing
never-fired. Quote the tools, never retype their numbers.

⚠ **THE WALK IS WHY THIS SHIPPED WORKING.** Six defects reached the release only because a human
opened the window and looked: a raw scale token where "1d8" belonged, a pane that resized the
dialog under the pointer, a timed-out offer still presenting live buttons, Tactical Mind calling
a DC-less check a miss, and — twice, an hour apart — a window that would not close. Not one of
them was visible to a green suite. **§8 and §9 exist because of that**: no suite had ever
asserted the window DISAPPEARS, only that it appeared.

⚠ **WHAT IS LEFT OF THIS FILE IS THE SETTLED TABLE.** The pass it briefs is done, and the user's
standing call is that there should be no handoff — what is parked lives in [BACKLOG.md](BACKLOG.md),
what is permanent in [DESIGN.md](DESIGN.md) / [ARCHITECTURE.md](ARCHITECTURE.md) / [NOTES.md](NOTES.md).
Retiring this file means finding a permanent home for SETTLED first; that is a decision, not
tidying, so it is left for the user rather than taken.

---

## ▶ THE RESCUE VIEW — the pass, as delivered

**The problem.** A Battle Master holding Heroic Inspiration who cleanly misses is stamped TWICE
on the same attack message — `precision` (maneuvers.js) and `d20fold` (d20-folds.js) — and gets
**two popups, two clocks, and no cross-talk** for what is one decision: *"this roll is short by
N; what do you burn?"* The ARITHMETIC side of concurrence is already solved (the D8 ruling:
compose, never order; `foldsFrom` walks every flag). **The OFFERS are not composed, and that is
this pass.** The chosen shape: **merge the VIEW, keep the flags** — R2 verbatim ("the popup is a
view; the flag is the state"), on the §4.1 relay precedent (machines register, the spine
composes, no machine imports another).

### The claims, and their standing — read first

⚠ **The two bug claims below are verified BY READING ONLY** (2026-08-23), by one session. That
was the drop's fair objection, so this pass is built to answer it: **Stage 1 turns the claims
into executable receipts before anything else builds on them.** The reading is current:
`git log 1425893..HEAD -- scripts/` names only `receipts.js` and `shared.js` — the two fold
machines are untouched since the lines below were read. Re-verify the line numbers anyway; it
costs seconds.

1. ⚠ **One-sided composition.** `resolveFold` composes across every fold on the message
   ([d20-folds.js:534](scripts/d20-folds.js:534), the D8 ruling obeyed); `resolvePrecision`
   still computes `attackTotal + its own die`
   ([maneuvers.js:265](scripts/maneuvers.js:265)). Spend bardic first (still misses), then
   precision: precision's card announces against the un-composed sum, and its `!anyHit` gate
   ([maneuvers.js:291](scripts/maneuvers.js:291)) can **skip the damage re-drive on a composed
   hit** while `hitTargets` — which walks the registry — says hit. Ordering-dependent:
   fold-side first is wrong, precision-side first is fine. The "card disagrees with its own
   arithmetic" class, third appearance.
2. ⚠ **The wasted-spend trap.** `resolveFold` REALLY spends at step 1
   ([d20-folds.js:521](scripts/d20-folds.js:521)) and only composes at step 3; nothing moots
   the sibling flag when one machine fixes the roll. Precision turns the miss into a hit → the
   d20fold popup stays open, still claiming "the attack missed" (presentation law 4: a lie on
   screen), and a click there **deletes a real Inspired effect for nothing**. Symmetric in both
   directions.
3. **Two windows, two clocks, one decision** — the discombobulation itself. The staircase keeps
   it legible; it cannot make it one question.

### The window — SETTLED (user, 2026-08-24): the quote pane, in the middle

Anatomy top to bottom — header (actor portrait, the stable "who is deciding", plus the composed
sum and margin) → **the pane**: ONE verbatim, labelled rule quote, swapping to the
hovered/focused row and defaulting to the first — law 8 keeps a quote always visible without
stacking four → the offer rows, **each led by its feature's own art** (item/effect img via the
`foldImg` family; `KIND_ICON` glyph where no document exists — heroic), spent rows greyed in
place with icon + rolled result → the bar → **Pass alone in the footer**. Rows therefore live in
the dialog CONTENT, not the DialogV2 footer. With one offer this **degenerates to today's
single-ability window** — quote mid-card, action below — the continuity the "UI/UX is the
asset" rule demands. Law 9 tooltips on every icon. Hover-swap is a DOM half in ui.js beside the
bar's; the markup stays pure in present.js.

```
┌ Rescue the roll — Aldric ──────────────────────┐
│ [Aldric]  10 + 5 = 15 vs AC 18 — miss by 3     │  ← header, composed line
│  ⚔ Precision Attack: "When you miss with an    │  ← THE PANE — swaps per hovered row
│    attack roll, you can expend one…"           │
│  [⚔] Precision Attack — add d8   ← hovering    │  ← rows, feature art each
│  [♪] Bardic Inspiration — add d6               │
│  [d20] Heroic Inspiration — reroll             │
│  ▓▓▓▓▓░░░░░  20s to answer                     │
├────────────────────────────────────────────────┤
│                    [ Pass ]                    │  ← footer
└────────────────────────────────────────────────┘
```

### The three rulings — ANSWERED (user, 2026-08-24)

1. **The moot — YES, and it GREYS rather than disappears.** When a sibling spend fixes the roll,
   the surviving offer auto-resolves and says **"no longer needed"** — the user's own words;
   "moot" was considered and dropped as jargon. ⚠ **The row STAYS on the window, greyed, exactly
   as a spent row does** (this is the correction to the original proposal, which dropped it):
   the window keeps the record of what was available and what became of it, so a player who
   looks up a second later can still see why their option went away. Nothing is spent, so no
   decision is taken from anyone; law 4 is satisfied by the withdrawal, and the greyed row is
   what makes the withdrawal legible instead of merely silent.
2. **The clock — NO. There is ONE clock, it covers resolving the WHOLE moment, and nothing
   resets it.** ⚠ This REVERSES the recommendation, and the merged window is precisely what
   makes it safe. The refresh rule exists because "an offer that expires before it is shown is
   worse than not offering" ([d20-folds.js:580](scripts/d20-folds.js:580)) — but that reasons
   about a popup that had not been SHOWN yet. In the merged window every surviving row has been
   on screen since the first stamp; a spend re-renders rows in place, it does not introduce a
   stranger. So the premise of the refresh is gone, and with it the refresh. ⚠ **This retires
   the existing intra-flag refresh too** — see Stage 4.3, which is now a deletion rather than a
   feature.
3. **The un-fumbled miss — declared absence, as recommended.** Precision never stamps on a
   natural 1 ([maneuvers.js:167](scripts/maneuvers.js:167)) and there is NO late stamp after a
   heroic reroll turns the fumble into a clean miss. Recorded the `MASTERY_NATIVE` way — a
   deliberate hole with its name on it, not an oversight. Reopens if the table actually meets it.

### Stage 1 — the composition receipt ✅ DONE (`23dab71`, `9dd49e9`)

- [x] **1.1** A smoke section for the ordering: forced dice (the smoke-d20-folds §3 PRNG
      technique — invert `Die#mapRandomFace`, never force 1 or 20, restore in a `finally`),
      bardic spend first (still short), then precision. Assert the composed verdict, the damage
      re-drive, and the precision card's sentence. **Expected RED at the card + re-drive — this
      is the receipt that answers the drop's objection.** ⚠ Needs the fixture fighter to carry
      Precision Attack + a superiority pool — `fixture-d20-folds.mjs` grows it the house way
      (clean provenance, the same discipline as the Longsword grant).
- [x] **1.2** `resolvePrecision` composes through `foldsFrom`/`ATTACK_FOLDS`/`foldedVerdict`
      exactly as `resolveFold` does — the same "compose ONCE, through the path every other
      reader uses" block. Its lines print the composed sum; `anyHit` comes from composed
      verdicts. Move, do not rewrite: the flag still stamps its own die; the contribution spec
      is untouched.
- [x] **1.3** Any missing unit case in decide-verdict (two adds composing on one target).
      Battery-green. **Own commit — releasable as a patch without the rest.**
- [x] ⚠ **CHECK IN.**

### Stage 2 — the pure rows ✅ DONE (DECISION layer, no behaviour change)

- [x] **2.1** `decide/present.js` gains the rescue row model, `foldsFrom`-shaped: a declared
      spec list per flag (`precision`, `d20fold`) turning plain flag objects + the composed
      roll + the reveal setting into `{ headerLines, rows, quotes, earliestDeadline }`. Rows
      carry label, action, cost, die, **and their icon ref**; `quotes` is the pane content per
      row (label + verbatim text, first row the default). **Spends render as greyed rows with
      icon + rolled results.** Margin lines stay gated behind `holdReveal`, exactly as
      `offerLines` does today.
      ⚠ **A THIRD ROW STATE ARRIVES IN STAGE 4** (ruling 1): a MOOTED row greys like a spent one
      but carries no result and no cost — "no longer needed". It is not modelled here because no
      flag state produces it yet; building the rendering before the state would be guessing at
      the shape. Stage 3 draws the greying, Stage 4 writes the state.
      ⚠ **AND THE TABLES CAME WITH IT.** `RESCUE_KINDS` holds the label, glyph, cost sentence and
      verbatim rule for all four rescue kinds in ONE place; d20-folds.js and maneuvers.js now
      read from it rather than keeping their own copies. Law 8 says the quote IS the rule, so a
      second copy that drifts is the module telling the table something untrue.
- [x] **2.2** Unit tests for every branch: both pending, one spent, fumble-filtered (heroic
      only), reveal on/off, and ⚠ the no-DC check case — a check's premise can never die (the
      DC finding, [d20-folds.js:642](scripts/d20-folds.js:642)); it keeps offering until a
      human passes.

### Stage 3 — one window ✅ DONE (`f6e88f4`)

- [x] **3.1** ui.js gains `registerRescue(flagKey, { isPending, view(message), answer(message,
      action) })` beside `registerRelay` — same architecture, same reason: the spine never
      names a feature; machines hand it keys and callbacks. One popup per message on
      `popupKey(message.id, "rescue")`, drawn through `openMomentPopup` (one staircase slot,
      law 7 unchanged). Offer rows render in the dialog CONTENT (momentButton family) with
      **Pass as the one footer button**; the hover→pane swap is wired in ui.js — the same
      markup-pure/DOM-half split as the countdown bar. ⚠ **Composition happens machine-side
      through decide** — ui.js imports no same-layer module and no feature; each machine's
      `view` callback reads its own flag, composes via shared.js, and calls Stage 2's row
      builders. Both sources derive the header from the same pure function; unit-asserted
      equal, deduped by string.
- [x] **3.2** The two machines stop opening their own popups for these flags and call the
      spine's `syncRescuePopup(message)` from their existing render/update handlers: show when
      any registered flag is pending (latched), re-render on change (the shipped
      close-and-reopen latch-delete, [d20-folds.js:619](scripts/d20-folds.js:619)), close when
      none. **Cards stay** — each flag keeps its durable row and bar (pairing law 2); the
      "Answer" recall buttons call the shared show. Answer paths untouched: `answerPrecision`,
      `answerFold`, first-writer-wins, crash-resume horizons, the withheld-save protocol.
      ⚠ **Pass answers every pending source** — one decision surface, one Pass; two flag
      writes, both idempotent.
- [x] **3.3** The spawn coalesce: both stamps land ms apart (maneuvers registers
      `rollAttackV2` before d20-folds — [d20-folds.js:536](scripts/d20-folds.js:536)); the
      show defers one tick so the first window renders both rows instead of popping twice.
- [x] **3.4** Suite sections: merged window shows both rows; answering one re-renders with the
      survivor + greyed spend. §11's rule — anything newly registered is asserted FIRED, and
      the hook-order/dispatch diffs are read, not reasoned about (no new registration is
      expected; the diff proves it, both directions of the §7 trap).
- [x] ⚠ **CHECK IN + sandbox walk of the window before Stage 4 builds coordination on it.**

### Stage 4 — coordination correctness ✅ DONE (`2966e24`)

- [x] **4.1** The spend-guard: both resolvers re-check the composed premise **before** the
      spend (today: spend first, compose after). Premise already dead at resolve time → moot,
      nothing burned. ⚠ Guard repeated inside the serializer lock (§11).
- [x] **4.2** The moot (per ruling 1): each machine's existing `updateChatMessage` handler
      re-derives its pending premise from the composed roll; premise dead → **elect-owned**
      auto-resolve `"no longer needed"` (single-writer, §3), timers disarmed, view syncs, card
      says nothing was spent. ⚠ Checks never moot (no DC); attacks moot on composed any-hit,
      DC'd saves on composed success. ⚠ **The row GREYS, it does not vanish** — the user's
      correction: a withdrawal nobody can see reads as a window that ate an option.
- [x] **4.3** The clock (per ruling 2) — **A DELETION, NOT A FEATURE.** There is ONE clock and
      it covers resolving the whole moment, so nothing refreshes it: remove the intra-flag
      re-offer refresh at [d20-folds.js:580](scripts/d20-folds.js:580) and add none of its own.
      ⚠ Its original argument does not survive the merge — it protects an offer that had not
      been SHOWN, and in the merged window every surviving row has been on screen since the
      first stamp. ⚠ The bar draws `earliestDeadline` (Stage 2), which is already the soonest
      thing that can be taken away; assert it never moves once stamped.
- [x] **4.4** ⚠ **Asserted by the BATTERY rather than by a new section** — `smoke-saves` ran
      74/74 over exactly this code, and its withhold/resume sections are that assertion. A save
      never carries `precision`, so the merged view degenerates to one source there and there
      was no new behaviour to pin.
- [x] **4.4 (as written)** The withheld-save path is asserted untouched — saves never carry `precision`, so
      the view degenerates to one source there; the withhold/resume sections re-run green.
- [x] Suite sections: the wasted-spend race (accept precision → composed hit → click bardic on
      the stale window → moot, **the Inspired effect survives**); the moot close needs no
      second client (both flags answer on the attacker's own client — the precision locality).
- [x] ⚠ **CHECK IN.**

### Stage 5 — walk, docs, release ✅ DONE

- [x] The USER's table walk (a walk is a human; nothing here substitutes). Open ruling 3 and
      the pane behaviour revisited with the window in hand.
- [x] Docs recut: ARCHITECTURE §5 gains the merged-view note (several moments about ONE roll
      present as one window; law 7 unchanged for everything else); BACKLOG's Tactical Master
      row updated if the anatomy shifted; this file replaced by whatever the next commission
      is.
- [x] `npm run verify`, full battery, `verify-settings`, `bump-version.mjs minor` → the
      release with the zip read-back. Prod is the user's call.

### The properties this pass holds itself to

**Zero moved pins.** No new fold kind (precision stays a `maneuverFold`; the merge is
presentation) — the R4 total stands. No new file — the source pin stands. No new setting
(§8.1: no new feature; rows appear only where a machine's own gates already stamped a flag).
No new hook registration expected — proven by diffing the printed order, not by reasoning.

### What this pass deliberately does NOT do

- **No state merge** — two flags stay two flags; no wire-format change, no migration (§4.1's
  own rule: unify the mechanism, leave the bytes alone).
- **No new kinds, no widened features** — Tactical Mind's refund stays unmodelled (SETTLED),
  heroic any-die stays out (SETTLED; §11 rule 4's revert debt still gates it).
- **No cross-client rescues** — Cutting Words / Silvery Barbs / Flash of Genius and kin are
  someone ELSE's reaction on your roll: N4 territory ("humans play reactions"), hold-family if
  they are ever anything.
- ⚠ **Why one window and not N, recorded for the next survey:** the own-roll retro-fixer family
  is much bigger than the three shipped — adds (Pact Talisman, Favored by the Gods, Dark One's
  Own Luck, Guided Strike) and replaces (Indomitable, Fanatical Focus, Diamond Soul, Lucky-2014's
  choose-better, Stroke of Luck's outcome-set — the last two are genuinely new contribution
  shapes and wait for their own ruling). Every future arrival is **a row in this window**, not a
  popup in the staircase; most reuse the existing spend shapes and arrive as list entries, which
  is the R4 bargain holding.
- ⚠ **FUTURE — the mastery machine is the next customer of this anatomy** (user, 2026-08-24):
  **Tactical Master, the fighter's base level-9 feature** — replace the attacking weapon's
  mastery with Push, Sap or Slow for that attack — is a choose-one-of-several moment the
  mastery machine has no shape for. Parked in [BACKLOG.md](BACKLOG.md); it reuses the Stage 2
  row/pane model and the rows-in-content anatomy, NOT the rescue registry's semantics (a
  mastery pick is a choice at the attack, not a post-roll fix). Out of this pass's scope;
  recorded so the pattern is built once and generalises.

---

## ▶ SETTLED — do not re-propose

**Carried forward from the retired handoff** (full history at `41583c2`). Each row is a decision
with the one condition that would reopen it; proposing one again without that condition costs
the session twice. ⚠ The *rescue pass* row that used to lead this table is gone because its
reopen condition was met differently than written: **the user recommissioned the work on
2026-08-24** — see the header.

| Settled | The ruling | What would reopen it |
| --- | --- | --- |
| **D9's four remaining machine→machine edges** | **NOT being repaid, and that is the finished answer, not a delay.** Each is pinned in `check-layers.mjs` with its reason and its trigger — see [BACKLOG.md](BACKLOG.md). ⚠ **The pins are SELF-EXPIRING** — repay an edge and the build fails until its row is deleted. | the trigger named in the pin actually arriving |
| **The two permanent import cycles** | `hold.js ↔ auto-damage.js` and `auto-apply.js ↔ mastery.js` are **PERMANENT BY DECISION**. ⚠ The first is **load-bearing**: the bare `import "./auto-damage.js"` pins module evaluation order and `check-hook-order` depends on it. **Doing this work would make the tree worse.** | nothing. Closed. |
| **Tactical Mind's refund** | **STAYS UNMODELLED.** The refund is conditional on the check FAILING, and **no DC exists for an ability check anywhere in dnd5e**. A manual *"Refund"* button was offered and **declined**. | dnd5e recording a DC for raw checks |
| **Widening Heroic Inspiration** to *"any die"* or the transfer clause | **NOT SHIPPING.** Widening to any-die/any-outcome triggers §11 rule 4's auto-revert obligation, and nothing ships that can do it yet. | building the revert machinery first, deliberately |
| **The `smoke-battleflow` flake** | ✅ **CLOSED 2026-08-24 — a real revert bug** (reverting a KILL restored the pool off-card; the lethal branch ran ~one run in eight). Fixed, and `smoke-battleflow` §4c is deterministic about it. | nothing. Closed, reproduced, fixed and pinned |
| **Short-duration effect expiry** (mastery chips) | **BLOCKED ON A LARGER DECISION**: whether this module should own TURN-TIME at all. Building the sweeper first commits that answer by accident. | that decision being made, either way |
| **A reaction-budget abstraction** | **REJECTED.** Action economy is not this module's job; every read of `reactionSpent` is an *offer gate*, never enforcement. | nothing. Closed. |
| **Hand-carrying any counted number into prose** | **DON'T.** ⚠ **Quote the tool's output; never retype it.** | nothing. This is a standing rule. |

---

## Operational spine — what the implementing session actually needs

- **`npm run verify`** first — seconds, offline. Green means the tree is as this file says.
- ⚠ **The sandbox is single-occupancy and HEADLESS.** `node <mcp>/scripts/local-foundry.mjs
  status` first; `users: 1` is usually the MCP BRIDGE — `disconnect-bridge` before any suite.
  Never the Electron app for suites. Establish who owns the box before running anything.
- **`scripts/` changed? `node tools/battery.mjs --snapshot`** (~20 min, rolls the world back)
  — and **read the hook-coverage report at the end**; it is the only output that speaks to
  behaviour. Docs and `tools/` changes do not need a battery.
- **After any test run, restore and verify world settings** against `tools/verify-settings.mjs`
  — verify, never assume. The battery ends with it; a hand-run suite does not.
- **Deploy: stop → `deploy-house-module.mjs fvtt-mod-battleflow --local` → start**, then
  hard-refresh both windows. ⚠ A bounce-less deploy silently leaves `module.json` behind — a
  `--check` naming exactly that one file IS that failure.
- **Running one suite by hand? Redirect it to a file.** Two flake sightings lost their evidence
  to a `| tail`.
- Two windows at the table (GM + player). **"Nothing popped" must always ask WHICH WINDOW.**
- The deeper operational lore (the prod-wake tell, fixtures, the first-cold-boot flake class)
  is in NOTES.md and the retired handoff at `41583c2`.
