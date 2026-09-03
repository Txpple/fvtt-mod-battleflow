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

> **Sneak Attack as a choice on the gate and the damage riders on the combat CLOCK left this list 2026-09-02 — DELIVERED** (DESIGN §5; `sneak.js`, `clock-riders.js`; `smoke-sneak`, `smoke-clock`), built from the prototype *Sneak Attack, Cunningly* as drawn. The rulings they carried are in DESIGN §8.

> **AC5e adoption left this list 2026-09-01 — its TABLE shipped as data** (DESIGN §5 *the gate
> before the roll*; `CONDITION_BENDS` in `decide/registry.js`), and vendoring its code is
> SETTLED against (DESIGN §8). The geometry features it also carries — range bands, nearby foes,
> flanking, armour, encumbrance — were never wanted and are not here.

| Item | Shape |
| --- | --- |
| **Hypnotic Pattern's area outliving an "instantaneous" cast** (2026-09-02 — user: "it's an edge case, leave it") | The spent-template sweep (saves.js) has three buckets: instantaneous → swept at the last verdict; concentration → swept with concentration; any other duration → the GM's to clear. The PHB copy of Hypnotic Pattern is Concentration, 1 minute, so it is already the second bucket; an imported or edited copy with the concentration flag missing falls into the third. No data rule separates it from Grease (1 minute, no concentration, an area that MUST persist) — only the text does. If it ever matters: a "Spent Areas" list, the Block List's shape, read as a fourth bucket. Not before a second spell lands in it. |
| **An ability that lands as an effect shows no chit on the token** (user observation, 2026-09-03 — parked, undecided) | Steady Aim is the example and the class is every `USE_CHIPS` row and every feature whose use puts an ActiveEffect on the sheet: the effect exists, the gate reads it, the roll spends it — but the TOKEN shows nothing, because the chip carries no status and Foundry paints a token icon only for effects that do. The mastery chips (Vexed, Sapped, Slowed) have the same shape. User: *"not sure if it's a good thing or bad thing because stuff would stack up too much, but something to think about."* The two honest answers: give the module's chips a status/icon so the token says what the sheet says (a data change on the chip row, one line each, and the platform's expiry keeps them tidy), or leave the token clean and let the gate's box be the reminder (today's shape). **A third, the user's (same day): a BUFF BAR** — a strip of the character's live chips, read off the sheet, as the first slice of the chit layer (DESIGN §6): it is a view over the registries and the effects already there, shows what a token icon would show without crowding the canvas, and is the surface the spendable chits would later join. Long-term; it rides the chit layer's timeline, not this list's. **What would settle the near-term half:** a walk where a player looks for the buff on the token and does not find it — or one where the icons pile up and the table asks for quiet. Until then nothing is owed. |
| **The abilities sweep** (surveyed 2026-09-02; **SHELVED 2026-09-03**, user: "a longer term project") | SWEEP.md, a deliberate fifth document for the sweep's length: the 2024 corpus sorted into the walk's eight mechanism families, what each kind (race → class → subclass → feat → spell) would need, and a suggested order. **Its three questions are ruled** (SWEEP §5: ignore 2014; ONE hit-menu popup per hit grouped by feature/class, smites excluded as a separate Bonus Action; ONE shared Effect Sources list for both gates) and the corpus was rescanned the same day with the numbers holding. **Start at SWEEP §0 when it is picked up** — it says where to begin (item 1, the save-side bends) and what needs a prototype first (item 2). Nothing scheduled. |
| **A Cunning Strike option no fixture exercises: Rend Mind** (2026-09-02) | The row is data (`CUNNING_OPTIONS.rendMind` — Psychic Blades only, the free use before the three-dice use) and the unit tests read it, but no Soulknife stands on the sandbox, so `smoke-sneak` never drives it live. The first Soulknife at the table is the measurement; a fixture is the fix. |
| **Clock riders with a damage TYPE the rules leave to the player** (2026-09-02) | Divine Strike, Primal Strike and Divine Fury ride with the activity's FIRST type and say so on the card (DESIGN §8 — no picker was wanted). A cleric who wants Radiant over Necrotic edits the activity's part order once. **A picker on the offer is one row of controls away if a table asks.** |
| **The pack's own "Assasinate" (sic) effect row beside the "Assassinate" feature row** (2026-09-02) | The 2024 PHB's Assassinate feature ships a transfer effect misspelled *Assasinate* (its Initiative Advantage), and the effect scan of 2026-09-02 carried it into `EFFECT_BENDS` under that name. The clock row added the same day is keyed by the FEATURE's name, correctly spelled, with the clock as its judge. Two rows, two things; if the pack ever fixes the spelling the effect row's key must follow it. |
| **Incapacitated breaks Concentration** — ✅ DELIVERED 2026-09-02 (user report: Hypnotized left Hunter's Mark up) | Measured: dnd5e 5.3 does NOT end it when the status lands. `concentration.js` breaks it off `createActiveEffect` / a re-enabled effect carrying the status, on the client that drives the concentrator — no save, the card says why. `smoke-concentration` §15. |

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
