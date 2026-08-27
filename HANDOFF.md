# HANDOFF.md — the commissioned work, and only that

> **Provenance.** Commissioned 2026-08-27 in the worklist session (the same one that shipped the
> rescue-clock fix, the 24s timers and the player-dice default). Per the standing convention this
> file exists only while a commission does: it was retired when the rescue view delivered and it
> retires again when this delivers. ⚠ **Wait for the user's "go" — a handoff is not one.**

---

## THE PARTY-STATS DATA PLANE

**Mission.** The user wants DPS meters, healing meters, buff metrics — "party stats" — built by
the **MCP scanning chat messages**, not by this module. The module's job is to make sure the
messages *carry the data*: discrete, machine-readable stamps an external reader can fold into a
ledger without parsing a card's HTML, ever.

**The split is a user ruling, and it is the right one architecturally: stamps in the module,
reports in the MCP** (`../fvtt-mcp-molten5e`). Nothing analytics-shaped ships in the zip; nothing
presentation-facing changes at all. The stamps are invisible freight on cards that already exist.

**Why this module is unusually placed for it.** Meters built from raw chat can count dice; this
module can attribute *causation*, because consequences flow through its own chokepoints and its
flags already record the story: post-mitigation damage with the system's own "why" (immune /
resistant / threshold), reverts, and — uniquely — **verdict flips** ("10 + 8 = 18 vs AC 18 — the
miss became a hit"), which let a report credit the bard's die with the damage it unlocked. No
other tool can build that meter honestly.

---

### FIRST: three rulings to take, before any code

**R-A. Enrich the existing flags, or stamp a second normalized envelope?**
The inventory below shows the existing flags already carry ~80% of what a ledger needs. What is
MISSING everywhere is **combat context** (which combat, round, turn) and, on receipts,
**source attribution** (who dealt it — today it is implicit in the message chain via
`respondsTo` / `flags.dnd5e.originatingMessage`).
- *Option 1 — enrich:* add `combat` (from `combatStamp()`, [core.js:106](scripts/core.js) —
  already `"id:round:turn"`, already a service) and `sourceUuid` to the receipt families at
  their write sites. The MCP normalizes shapes on its side. **One source of truth; nothing can
  disagree with itself.**
- *Option 2 — envelope:* one versioned `flags.fvtt-mod-battleflow.stat = {v:1, kind, ...}`
  stamped beside every consequence. Friendlier to the MCP, but it **double-records**: a stat
  stamp that drifts from the receipt it sits beside is a lie with two faces, and D2's lesson
  (evidence goes stale silently) applies to data planes too.
- **Recommendation: Option 1.** The MCP is one reader written once; the module is the thing
  that must never disagree with itself. If a later, second consumer wants the envelope, the
  enriched flags are what it would be derived from anyway.

**R-B. Reverts.** Receipts already mark per-target `reverted` and effect receipts mark reverted
entries; the revert inverse lives in [decide/receipt.js](scripts/decide/receipt.js). Ruling
needed: does the scan **subtract reverted entries** (recommended — zero new module code, and the
ledger tells the truth the table settled on) or does the module flip a stat entry on revert
(more machinery, same answer)?

**R-C. v1 scope — which meters are owed first?** Recommended v1 kinds, smallest set that makes
the reports the user named: **damage dealt / taken** (receipts), **healing + overheal**
(receipts — `prior`/`after` vs max makes overheal exact), **verdict flips** (`d20fold` +
`precision` flags, already complete), **resource spends** (see the resources note below).
Buff *uptime* (effect duration windows) is a fine v2; it needs effect create/delete times the
current stamps do not carry, and should not gate v1.

---

### The inventory — what the messages already carry (verified 2026-08-27, at HEAD)

| Flag | Written by | Carries today | Missing for stats |
| --- | --- | --- | --- |
| `receipt` | `applyDamagesWithReceipt` ([auto-apply.js:105](scripts/auto-apply.js)) — **the** chokepoint: attacks, saves ([saves.js:1109](scripts/saves.js)), Graze ([mastery.js:640](scripts/mastery.js)), **healing** ([cast.js:77](scripts/cast.js), note "Healing"), volleys, holds | per-target `prior → delta → taken → traits` (dnd5e's own `calculateDamage` story: immune/resistant/vulnerable/threshold/modified), `note`, `multiplier`, `reverted` | `combat`, `sourceUuid` |
| `effectReceipt` | `applyEffectsWithReceipt` ([effect-riders.js:130](scripts/effect-riders.js)) + mastery's chip applier ([mastery.js:254](scripts/mastery.js)) | per-target applied effects `{id, name, reverted}` | `combat`, `sourceUuid` |
| `d20fold` | d20-folds.js | `testKind`, `baseTotal`, `spends[]` (kind + die/reroll), `foldedTotal`, per-target verdicts, `outcome`, `timedOut` | `combat` (source = the actor, already on the flag) |
| `precision` / `mastery` / `bashOffer` | maneuvers.js / mastery.js | outcome, die, targets, verdicts | `combat` (mastery topple arms already use `combatStamp`) |
| `saves` | saves.js | per-target totals, DCs, outcomes | `combat` |
| `hold` | hold.js | reaction, answer, `acAtVerdict`, timed out | `combat` |
| *(spends)* | [resources.js](scripts/resources.js) | ⚠ **derived at RENDER, not stamped** — `{pool, spent, left, max}` is recomputed from the usage message each draw | a stamp, if spends join v1 (see trap 3) |

**The dnd5e side already on every roll message:** `flags.dnd5e.targets` (uuid, name, ac),
`roll.type`, `originatingMessage`, and the module's own `respondsTo` chain.

---

### The build plan

**Stage 0 — the rulings above, put to the user.** Nothing is built on a guessed answer to R-A.

**Stage 1 — the module half (assuming R-A Option 1).**
1. `combat: combatStamp()` + `sourceUuid` join the receipt entry at its ONE write site
   (`applyDamagesWithReceipt`) and the effect-receipt sites. Source resolution: the actor of
   the message the receipt answers (`respondsTo` → `originatingMessage` → speaker, in that
   order), resolved at write time where the context is still live — never left for the reader
   to re-derive.
2. `combat` joins the moment stamps (`d20fold`, `precision`, `mastery`, `saves`, `hold`) at
   their `baseFlag`-equivalents — one line each; the writers already exist.
3. The pure half — entry shaping, source resolution order — lands in
   [decide/receipt.js](scripts/decide/receipt.js) beside the arithmetic it extends (no new
   file, no `EXPECTED_SOURCE_FILES` move, no new layer edge; if it grows a file after all,
   ARCHITECTURE §11 "adding a file" is the checklist and the pin moves deliberately).
4. Unit tests with the new fields; a live section asserting a damage application inside a
   running combat carries `combat` and `sourceUuid` (and that one outside combat carries
   `combat: null` — the `combatStamp` contract).

**Stage 2 — the MCP half (in `../fvtt-mcp-molten5e`, its own conventions).**
1. A scan that walks `game.messages` by flag presence (never HTML), folds entries into a
   per-combat ledger keyed by `combat`, subtracts `reverted`, and attributes flips.
2. Report generators on top of the ledger (the user runs these): damage dealt/taken/DPR,
   healing + overheal, flip credits, spend economy. Session-flavor stats (nat 20s/1s,
   most-targeted) fall out of the same scan.
3. ⚠ Chat is not forever — messages get deleted and worlds get pruned. The scan must be
   runnable per-session (an export or incremental cursor), not assume infinite scrollback.

**Check-in points:** after Stage 0 (the rulings ARE the design), after Stage 1's suite section
is green, before anything in Stage 2 is presented as a deliverable of THIS repo.

---

### The traps, named up front

1. **Double-recording** (the whole argument of R-A): two records of one event WILL disagree
   eventually, and the meter that disagrees with the card is worse than no meter.
2. **Reverts**: a meter that ignores `reverted` reports damage the table un-did. The revert
   flow already marks entries; the scan subtracts (R-B).
3. **Spend rows are render-derived** ([resources.js](scripts/resources.js) header: "idempotent
   render decoration") — there is deliberately no spend flag today. If spends join v1, the same
   derivation must run ONCE at a write site and stamp, or the MCP re-derives with the same
   code — do not have both halves derive independently.
4. **Healing is damage with a note** — it flows through the same chokepoint (`cast.js:77`).
   The ledger keys healing off the receipt's sign/note, not off a separate path that would
   miss potions applied through the same applier.
5. **`combatStamp` is null out of combat** — by contract. Reports group the null bucket as
   "out of combat", they do not drop it (short rests, traps, and RP damage are real).
6. **No new dependencies** (DESIGN R3 — nothing in `dependencies`, ever) and **no
   presentation changes** — the cards render exactly as today; if a stamp changes what a card
   shows, something is in the wrong layer.
7. **Flag writes ride the serializer** — any new write to a message flag goes through
   `queueFlagWrite` like every other (D3), or two appliers in one tick drop entries.

### What this commission deliberately does NOT do

- No reports, meters, or UI in this module — ever (the user's own split).
- No buff-uptime machinery (v2, its own ruling — it wants effect lifecycle times).
- No backfill of historic messages — the ledger starts when the stamps do.
- No turn-time ownership — same fence as the BACKLOG's expiry item: nothing here may quietly
  commit the module to owning the combat clock.
