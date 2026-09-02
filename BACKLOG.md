# BACKLOG.md — known, deliberately not scheduled

> **What this file is:** things worth knowing about that **nobody owes anybody**. Each one was
> found, understood, and parked on purpose, with the reason and the thing that would un-park it.
>
> **What this file is NOT:** a to-do list. ⚠ **Nothing here blocks a release, a deploy or a
> battery, and nothing here is a defect waiting on someone.** If an item ever becomes owed it
> leaves this file and becomes a debt row in [ARCHITECTURE.md](ARCHITECTURE.md) §10 or a
> commission the user hands the next session — that register is the "owed" surface and this one
> is not. ⚠ **There is no standing handoff file, deliberately** (user call): a commission is
> written when there is one and retired when it is delivered, so nothing can quietly accumulate
> in it between passes.

**Why it exists.** These items used to live in the debt register and the handoff, which are read
at the top of every session and are written to be LOUD — that is what makes a real debt hard to
ignore. Carrying "we looked at this and decided not to" in the same voice made every session open
with a list of alarms that were not alarms. **The noise was costing more than the items.**

**Three files, three jobs, and keeping them apart is the point:**

| | |
| --- | --- |
| **This file** | *Not now, and here is why.* Awareness. Re-read when you are picking work. |
| [DESIGN.md](DESIGN.md) §8 *Settled* | *No, and here is what would change the answer.* **Closed** — a proposal that keeps coming back and should stop. ⚠ Moved there when the rescue-view commission was delivered (v1.24.0); it had outlived two temporary homes and the rulings are not temporary. |
| [ARCHITECTURE.md](ARCHITECTURE.md) §10 | *Owed, or repaid, with evidence.* The permanent record — the full argument for everything below still lives there. |

⚠ **Two of these are enforced by tooling and cannot rot in place.** The layer pins and the
coverage pins are **checked both ways**: repay the thing, or have the platform change under you,
and the build or the report says the pin is stale. **A backlog item here is quiet, not
unwatched** — which is exactly why it is safe to be quiet about it.

---

## Architecture

### The never-fired hook: `dnd5e.rollDeathSaveV2` (coverage gap, not a dead handler)

**What:** the D11 hook-coverage report has printed this line on every battery since the stat
plane shipped, and its own instruction is *"do not let a line sit here unexplained across two
releases."* This is the explanation, so the next session does not re-investigate it from scratch.

**Verdict: a genuine coverage gap.** Both halves were checked on 2026-09-01. The hook NAME is
real — it is in `tools/dnd5e-hooks.json`, the system’s own reference — so this is **not** the
`rollToolV2` class of bug, where v1.23.0 registered a hook that never existed and nothing noticed
for a release. And the registration is live: `stats.js` lists it among `D20_TEST_HOOKS`, which is
what stamps `rollCtx` on every d20 test message.

**Why it never fires:** nothing in the battery drives a PC to 0 HP and rolls death saves. No
suite has a reason to — death saves are not a machine this module resolves; the stat plane only
STAMPS them for later reporting.

**Cost of leaving it:** low, and knowable. If the stamp were broken, the loss would be death-save
rows missing their context in party-stats reporting — not a table-facing failure. The fix, when
someone wants it, is a fixture that drops a PC to 0 and rolls three death saves; the assertion is
simply that the message carries `rollCtx`.

**Do not “fix” it by removing the registration.** The hook is correct and cheap; only its
exercise is missing.

### The four sideways edges (was debt row D9)

**What:** the tree is layered and the rule is *depend downward only*. Seven places had one
feature importing another feature — sideways. **Three were repaid** by moving the shared thing
down into the plumbing where both could reach it. **Four remain, deliberately.**

**Why not now:** you cannot design a good shared seam from one example. The house lesson (D8) is
that **the seam is built by the feature that proves its shape** — build it on one caller and you
are guessing, and a wrong shared part is worse than an honest sideways one.

**What would un-park each — the trigger is written into the pin itself:**

| Edge | Waiting for |
| --- | --- |
| `saves → maneuvers` | a **third** choice kind, to prove the registry's shape |
| `saves ↔ d20-folds` | a **second** machine that needs withhold-and-resume, before it becomes a spine primitive |
| `saves → receipts` | `receipts.js` gaining a **second** importer |
| `volleys → reminders` (BY DESIGN, 2026-09-02) | a **third** surface for the gate's judge (`judgeRoll` — the dialog's gate and the volley's aim are two), to prove a spine home |

⚠ **Self-expiring:** the pins live in [tools/check-layers.mjs](tools/check-layers.mjs) and
`npm run layers` fails on a pin whose edge has GONE, as well as on an edge with no pin. **Repay
one and the build refuses until its row is deleted.** This list cannot go stale the way the old
register did.

⚠ **Separately and permanently closed, not backlog:** the two surviving import cycles
(`hold.js ↔ auto-damage.js`, `auto-apply.js ↔ mastery.js`). The first is **load-bearing** — the
bare import pins module evaluation order and the hook-order check depends on it. **Breaking them
would make the tree worse.** See *SETTLED*.

### The template fast-path Foundry 14 took away (was debt row D12)

**What:** `saves.js` listens for `createMeasuredTemplate` / `updateMeasuredTemplate` so it can
re-derive who is standing inside a spell's area the moment one is placed. **Foundry 14 dispatches
neither name.** Measured 2026-08-24 ([tools/probe-surfaces.mjs](tools/probe-surfaces.mjs)):
placing one template moves `scene.templates` 0→1 **and `scene.regions` 0→1**, and what fires is
`preCreateRegion` / `createRegion` / `drawRegion`. The update dispatched **nothing at all**.

**Why nothing is broken:** those two are a *fast-path*. The real work is done by a **reliability
floor** that re-derives containment on the card's render hook, and that floor is what has carried
template adoption the whole time — table-proven on Shatter and Moonbeam, asserted by
`smoke-saves` §8.

**Why not now:** re-pointing at the Region hooks is **not a rename**. `refreshTemplatedDemands`
reads `getFlag("dnd5e", "origin")` and `.t` off a *template* document, and a Region carries
neither — it needs a region→template mapping and a walk to prove it. **It buys latency on a path
that already works.**

⚠ **Do not "fix" it by deleting the two registrations either.** The sandbox is one Foundry
version and prod may be another; a dead registration costs nothing, and a deleted one cannot come
back on its own.

**What would un-park it:** a table-visible lag in area adoption, or Foundry restoring the names —
and the pin in [tools/hook-coverage.mjs](tools/hook-coverage.mjs) is checked both ways, so **the
day the names come back the report says the pin is stale** rather than quietly reviving an
untested path.

---

## Features — surveyed, not scheduled

> Three surveyed rows left this list 2026-09-01 by user call — Tactical Master's mastery pick,
> Guidance/choice-bearing effects, light-family spells applying token light. Not settled, just
> off the list for now; git history holds the full survey text if one comes back.

> **Short-duration effect expiry left this list 2026-09-01 — DELIVERED** (DESIGN §5 *the platform
> keeps the clock*, DESIGN §8's settled row). The turn-time question it was blocked on dissolved
> on measurement: Foundry v14 keeps effect clocks itself, per effect, against the originating
> combatant, so the module never has to.

> **AC5e adoption left this list 2026-09-01 — its TABLE shipped as data** (DESIGN §5 *the gate
> before the roll*; `CONDITION_BENDS` in `decide/registry.js`), and vendoring its code is
> SETTLED against (DESIGN §8). The geometry features it also carries — range bands, nearby foes,
> flanking, armour, encumbrance — were never wanted and are not here.

| Item | Shape |
| --- | --- |
| **The reminder gate on other d20 tests** | The gate reads ATTACK rolls. Saving throws and ability checks have their own bends (Restrained on Dexterity saves, Poisoned on checks, Paralyzed's automatic failures) and the same pre-roll hook family (`dnd5e.preRollSavingThrowV2`, `preRollAbilityCheckV2` — templated like the attack one). Same mechanism, a second table. **Not asked for; surveyed only.** |
| **The double reminder on a Vexing hit** | The Vexing hit's notice popup ("Advantage on your next attack") AND the gate at the next swing are both live — the second says what the first already said. Whether the notice should quieten when the gate is on is a table call. |
| **Sneak Attack as a choice on the gate** (user, 2026-09-02 — NEXT) | When the attacker's sheet carries the Sneak Attack FEATURE, the gate's section offers a *Sneak Attack* choice beside the roll — a checkbox in the section, not a fourth button, because the roll still needs its Advantage / Normal press. The PLAYER decides whether the conditions hold (an ally within 5 feet, Advantage on the roll — the module can list them, never judge them; user: *"the player can determine if they have the conditions"*); the module automates the DAMAGE: the Sneak Attack dice ride the damage roll through to the card (the hit-riders seam at `preRollDamageV2`, scaled from the feature's own damage part), double on a Critical Hit (free — `applyKeybindings` stamps `isCritical` on every part), once per turn (the Cleave chit's shape). Shape to measure first: the 2024 Sneak Attack item ships a damage activity — read its part rather than a table of dice by level. |
| **Damage riders on the combat CLOCK** (user, 2026-09-02 — the fold after Sneak Attack) | A second class of rider whose condition is the round or the turn, not a mark on the target: the Gloom Stalker's first-turn strike, the 2024 Assassin's extra damage on a Sneak Attack in round 1 against a creature that has not acted, and every *once per turn* rider (Sneak Attack itself, Dreadful Strike). The facts are the platform's — `combat.round`, whether the target's combatant has taken a turn, the attacker's turn chip — and the module already reads them for expiry. The shape: a rider row carries a `when` (firstRound · targetNotActed · oncePerTurn) beside its damage part, judged at `preRollDamageV2` like hit-riders, and the turn chip (the Cleave chit) is the once-per-turn latch. Design with the Sneak Attack flow (the same offer surface), build after it. |
| **Incapacitated breaks Concentration** (survey, 2026-09-02 — TODO) | The glossary: *"No Concentration. Your Concentration is broken."* Paralyzed, Petrified, Stunned and Unconscious all carry Incapacitated. concentration.js ends concentration at ZERO HP (unconscious ⇒ incapacitated) and nowhere else. An outcome, not a decision (R1). **Measure first:** whether dnd5e 5.3 already ends concentration when the status lands (a status-effect hook on the actor, or nothing). If the platform does it, this row closes; if not, the seam is the status-effect create hook and the existing concentration-ends path. |
| **Petrified resists all damage, and is immune to Poisoned** (survey, 2026-09-02 — TODO) | *"Resist Damage. You have Resistance to all damage."* The damage receipt honours whatever traits the actor carries (decide/receipt.js reads the system's own calculation), so this is honoured exactly when the Petrified status carries `dr.all` as an effect change. **Measure first:** apply Petrified to a fixture and read the receipt of a hit. Same fork as the row above: the platform's, or ours. |
| **What the platform already applies for a status — measure before building** (survey, 2026-09-02) | The 2024 glossary carries outcome clauses this module has never read and may never need to: Exhaustion's *"the roll is reduced by 2 times your Exhaustion level"* on every D20 Test, *Speed 0* for Grappled, Restrained, Paralyzed, Petrified and Unconscious, and Unconscious granting Prone. dnd5e ships each status with its own effect changes, and the honest first step for every one is a fixture, the status pressed, and a reading — a row here for each that the platform does NOT do, none for the ones it does. Out of scope by design (not a d20 the module meets): Blinded/Deafened failing sight or hearing checks, Charmed's social Advantage, Frightened's no-approach, Prone's stand-up cost, and initiative (Invisible's Advantage, Incapacitated's Disadvantage). |

### Two content facts worth keeping

Both are unmodelled, and neither is findable by guessing.

- **Heroic Inspiration's rules text**, quoted verbatim in the popup (presentation law 8), is
  `dnd5e.content24` → *Appendix D: Rule References* → page **`nkEPI89CiQnOaLYh`**. ⚠ The full
  text is **wider than what shipped**: *"any die"* reaches **damage rolls**, and the transfer
  clause — *"it's lost unless you give it to a player character who lacks it"* — is a **second
  unmodelled half**. ⚠ Widening it is what triggers §11 rule 4's auto-revert obligation, and it
  is **SETTLED as not shipping** until that machinery exists.
- **Tactical Mind's refund** — *"if the check still fails, this use of Second Wind isn't
  expended."* ⚠ **Unbuildable as an automatic rule**: the refund is conditional on the check
  FAILING and **no DC exists for an ability check anywhere in dnd5e**. It is a GM ruling or a
  player-pressed un-spend, not arithmetic. Also **SETTLED** — a manual *"Refund"* button was
  offered and declined.
