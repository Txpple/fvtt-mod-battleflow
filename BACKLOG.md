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

| Item | Shape |
| --- | --- |
| **Guidance / choice-bearing effects** | An effect applied without asking the choice it carries — the d4 landed on every ability check. Same family as Careful Spell. **Needs a "choice" moment kind.** |
| **Tactical Master — the mastery pick (fighter 9)** | User-named (2026-08-24): the 2024 fighter's **base level-9 feature** replaces the attacking weapon's mastery with **Push, Sap or Slow** for that attack — a choose-one-of-several moment the mastery machine has no shape for (its popups today are single-question asks and notices). ⚠ **The anatomy it reuses now SHIPS** (v1.24.0): the rescue view's row model and quote pane are `RESCUE_KINDS` / `RESCUE_SOURCES` / `rescueView` in `decide/present.js`, drawn by the spine's `registerRescue`. A mastery pick is a choice AT the attack, not a post-roll fix, so it borrows the PRESENTATION — buttons in the content, one quote pane, one Pass — and none of the rescue registry's semantics (no premise to die, so no moot). ⚠ Feature name and verbatim text from the world's own pack when scoped (N1). |
| **Light-family spells apply token light** | Cast on a shield, attached no light; the table hand-toggled a torch. |
| **Short-duration effect expiry** | Mastery chips get a 1-round duration and nothing sweeps an expired one. ⚠ **Do not build it before deciding whether this module should own TURN-TIME at all** — building the sweeper first commits that answer by accident. |
| **AC5e adoption** | ⚠ **Vendor and modify, never import** (user call — R2 rules out the dependency). And it is **complementary, not an alternative**: AC5e *decorates* rolls where this module *applies*. |

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
