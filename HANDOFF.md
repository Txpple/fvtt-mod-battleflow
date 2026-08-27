# HANDOFF.md — the commissioned work, and only that

> **Provenance.** Commissioned 2026-08-27 in the worklist session (the same one that shipped the
> rescue-clock fix, the 24s timers and the player-dice default). Per the standing convention this
> file exists only while a commission does: it was retired when the rescue view delivered and it
> retires again when this delivers. **Status 2026-08-27: Stage 0 ruled and Stage 1 DELIVERED in
> this repo — the module now stamps; what remains is Stage 2, the MCP half, in
> `../fvtt-mcp-molten5e`.** ⚠ **Wait for the user's "go" — a handoff is not one.**

---

## THE PARTY-STATS DATA PLANE

**Mission.** The user wants DPS meters, healing meters, buff metrics — "party stats" — built by
the **MCP scanning chat messages**, not by this module. The module's job is to make sure the
messages *carry the data*: discrete, machine-readable stamps an external reader can fold into a
ledger without parsing a card's HTML, ever. The user's own restatement at the go (2026-08-27):
*"if battleflow is assisting in the assignment of a condition/damage/healing/etc, it should be
stamping it correctly for later accurate analytics"* — and *"I will make the charts later, but I
need reliable data first. That is the job of this module."*

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

### The rulings — TAKEN 2026-08-27, all three

- **R-A: enrich the existing flags** (Option 1, the recommendation). One source of truth; the
  MCP normalizes shapes on its side. No stat envelope, ever — a second record of one event is a
  lie waiting to happen.
- **R-B: the MCP subtracts `reverted`.** Zero new module code; the ledger tells the truth the
  table settled on. Receipts mark per-target `reverted`, effect records mark theirs.
- **R-C: v1 = the recommended set PLUS the party-of-4's masteries and common abilities**
  (ranger / fighter / sorcerer / paladin): damage dealt/taken, healing + overheal, verdict
  flips, resource spends **including spell slots** (three of the four burn them), the Bless
  margin meter, and the mastery/maneuver moments (`mastery`, `precision`, `riposte`,
  `bashOffer`, `topple` all stamp). Buff *uptime* stays v2.
- **The user's architecture ruling, mid-build:** the stamp is a **baseline, wired once** — one
  shape (`statContext`), one source resolution (`statSourceOf`), constructors in the decision
  layer — never per-site copy-paste. Built that way.

---

### STAGE 1 — DELIVERED (this repo, 2026-08-27)

**The contract lives in ARCHITECTURE §4 "The data plane — stat stamps" — that section IS the
read contract; read it before writing the scan.** In brief:

1. Every family in the inventory below now carries `combat` (`"combatId:round:turn"`, **null
   out of combat by contract**) and `sourceUuid`, resolved AT WRITE TIME. Receipt entries and
   effect records are stamped **per entry** (a held target's late landing keeps its own turn);
   moment flags are stamped at creation.
2. **Explicit null vs absent field** is how the scan tells an out-of-combat event from a
   pre-plane legacy record. Do not conflate them.
3. `sourceUuid` for an unlinked token is the token's SYNTHETIC actor uuid (THAT goblin) —
   normalize to base identity MCP-side when aggregating archetypes. PCs are linked; their world
   actor uuid rides directly.
4. **NEW: the `spend` flag** on qualifying usage messages (elect-stamped at creation,
   ungated by any setting): `{combat, sourceUuid, rows?, slots?}` — `rows` =
   `[{pool, spent, left, max}]` for recovery-rhythm pools, `slots` =
   `[{slot, level, spent, left, max}]` for spell slots. Player-owned actors only; no-recovery
   expendables (torches) stay out; a message with no stamp still carries dnd5e's own
   `system.deltas` as the contextless fallback.
5. Where implemented: `statContext` (core.js), `statSourceOf` (shared.js), `statFields` /
   `receiptEntry` / `effectRecord` (decide/receipt.js), the spend stamp (resources.js), one
   spread at each moment-flag creation site.
6. Verified: unit (tests/decide-receipt.test.js — shape pins), live
   (smoke-battleflow §3b: receipt stamps in and out of a running combat;
   smoke-resources §7: spend rows, slots, the rhythm gate, the NPC line, the
   ungated-by-settings ruling).

### The inventory — what the messages carry now (verified 2026-08-27, post-Stage-1)

| Flag | Written by | Carries | Stats context |
| --- | --- | --- | --- |
| `receipt` | `applyDamagesWithReceipt` ([auto-apply.js](scripts/auto-apply.js)) — **the** chokepoint: attacks, saves, Graze, **healing** ([cast.js](scripts/cast.js), note "Healing"), volleys, holds | per-target `prior → delta → taken → traits`, `note`, `multiplier`, `reverted` | ✅ per entry |
| `effectReceipt` | `applyEffectsWithReceipt` ([effect-riders.js](scripts/effect-riders.js)) + mastery's chip applier + the hold's reaction sliver | per-target applied effects `{id, name, reverted, …}` | ✅ per effect record |
| `d20fold` | d20-folds.js | `testKind`, `baseTotal`, `spends[]`, `foldedTotal`, verdicts, `outcome`, `timedOut` | ✅ at creation |
| `precision` / `mastery` / `bashOffer` / `riposte` / `topple` | maneuvers.js / mastery.js | outcome, die, targets, verdicts | ✅ at creation |
| `saves` | saves.js | per-target totals, DCs, outcomes | ✅ at creation (source = the caster) |
| `hold` | hold.js | reaction, answer, `acAtVerdict`, timed out | ✅ at creation (source = attacker/caster) |
| `volley` | volleys.js | kind, n, castLevel, targets | ✅ at creation (source = the caster) |
| `concentration` | concentration.js | dc, damage, outcome | ✅ at creation (source = the concentrator; the damager is `cause`, by name) |
| `spend` **(new)** | resources.js, the elect | `rows` (recovery pools) / `slots` (spell slots), post-spend truths | ✅ IS the stamp |

**The dnd5e side already on every roll message:** `flags.dnd5e.targets` (uuid, name, ac),
`roll.type`, `originatingMessage`, `system.deltas` on usage messages, and the module's own
`respondsTo` chain.

**The Bless meter — buff CONTRIBUTION, asked for by a player (2026-08-27).** Entirely MCP-side,
and the data is complete: a Bless-style bonus rides the roll as its OWN DIE TERM
(`rolls[0]` parses), the demand flags carry per-target totals and DC/AC, so the flip test is
arithmetic: **succeeded, and `total − bonusDie < threshold` → the buff flipped it.** Failures
count toward "bonus wasted". Attribution: exact where parseable, labeled heuristic where two
same-size dice overlap — never silently wrong.

---

### STAGE 1.1 — the second pass (2026-08-27, the MCP session's round-2 asks, user-ruled) — DELIVERED

The stats reader's first live pass surfaced what the wire format could not serve; all shipped,
and **ARCHITECTURE §4's table carries them** (the read contract, as always):

- **`rollCtx`** on every d20 TEST message — attack, save, ability check, skill, tool, death
  save, concentration — `{combat, sourceUuid}` at roll time on the rolling client. Plain rolls
  finally carry round context; by-round meters stop inferring from timestamps.
- **`parts: [{type, amount}]`** on receipt entries — per-part POST-trait (measured semantics);
  with the message's pre-mitigation rolls this closes the damage-lost-to-traits meter.
- **`combatRoster`** — the turn→actor map that survives encounter deletion: a GM-whispered
  marker card at combatStart (static snapshot: actorUuid/tokenId/name/initiative/isPC), closed
  with `endedRound` at deleteCombat. User-ruled: static roster ≠ clock ownership; the fence
  stands — nothing may grow turn tracking here.
- **`answeredAt` on every moment answer** (most already carried it as the crash-resume
  horizon; mastery and the hold's three answer paths joined) — decision latency vs deadline is
  now arithmetic.
- **`holdSkipped`** — the futile-skip record, the stat only the module witnesses.

### STAGE 2 — the MCP half (in `../fvtt-mcp-molten5e`, its own conventions) — REMAINS

1. A scan that walks `game.messages` by flag presence (never HTML), folds entries into a
   per-combat ledger keyed by `combat`, subtracts `reverted`, and attributes flips.
2. Report generators on top of the ledger (the user runs these): damage dealt/taken/DPR,
   healing + overheal, flip credits, spend economy (pools AND slots), Bless margins.
   Session-flavor stats (nat 20s/1s, most-targeted) fall out of the same scan.
3. ⚠ Chat is not forever — messages get deleted and worlds get pruned. The scan must be
   runnable per-session (an export or incremental cursor), not assume infinite scrollback.
4. **Charts are a later commission (user, 2026-08-27: "i will make the charts later")** — the
   scan and the ledger come first; nothing chart-shaped gates Stage 2.

#### How the MCP reads, and where its tools go — for the session that ingests this

*(Written to be self-contained: the reader is expected to be a session working in
`fvtt-mcp-molten5e` that has not seen this repo.)*

**The read primitive.** The MCP repo's `dist/foundry.js` exports a `Foundry` class — a headless
client that joins the live world and runs code in page context. Battle Flow's own
[tools/verify-settings.mjs](tools/verify-settings.mjs) is the worked example of an external
script using it: build a config from the repo's `.env` (`MOLTEN_*` keys for prod, `LOCAL_*` for
the sandbox), `await f.connect()`, then `f.evaluate(fn, args)` — inside, the full Foundry API is
live. The whole scan is one evaluate:

```js
const ledger = await f.evaluate(() => {
  const MOD = "fvtt-mod-battleflow";
  const KEYS = ["receipt", "effectReceipt", "d20fold", "precision", "mastery", "bashOffer",
    "riposte", "topple", "saves", "hold", "volley", "concentration", "spend"];
  return game.messages.contents
    .filter(m => KEYS.some(k => m.flags?.[MOD]?.[k]))
    .map(m => ({ id: m.id, ts: m.timestamp, flags: m.flags[MOD],
                 deltas: m.system?.deltas ?? null,
                 dnd5e: { targets: m.getFlag("dnd5e", "targets"),
                          origin: m.getFlag("dnd5e", "originatingMessage") } }));
});
```

Everything else — folding into per-combat buckets, subtracting `reverted`, crediting flips —
is plain Node on the returned JSON. **ARCHITECTURE §4's data-plane table is the read
contract**; key buckets by the `combat` stamp (`"combatId:round:turn"`, null = out of combat,
absent = pre-plane legacy).

**Two integration shapes, both legitimate — start with the first:**
1. **A script** (`scripts/party-stats.mjs` beside `pull-prod-to-local.mjs` and kin): connect,
   scan, print or write a report. Cheapest loop, no server rebuild, runnable by hand or from
   another session. Target local or prod exactly as the deploy tooling does.
2. **An MCP tool**, so any Claude session can ask for stats conversationally (the way
   `list-chat-messages` and `export-chat-log` already exist as tools). That means following the
   MCP repo's OWN conventions — TypeScript in `src/`, its build, its tool registration; read
   that repo's README/design.md rather than trusting this file for its internals. The tool body
   is the same evaluate + fold as the script — build the script first, promote it when it has
   proven the shapes.

**Read discipline.** The scan is READ-ONLY — no writes, no settings, no fixtures — which makes
it safe beside a live session (the same standing distinction Battle Flow's own
`check-popup-routing` enjoys vs the mutating suites). The bridge identity (role-3 assistant)
never steals the elect from the human GM, so scanning DURING play is allowed; the existing
`export-chat-log` tool is the archival fallback when a session's chat is about to be pruned.

**Check-in points:** before anything in Stage 2 is presented as a deliverable of THIS repo.

---

### The traps, named up front — and where they stand after Stage 1

1. **Double-recording** — CLOSED by R-A: no envelope exists; the only new record family is
   `spend`, which records what nothing else does.
2. **Reverts** — the scan subtracts (R-B). Still Stage 2's obligation.
3. **Spend rows were render-derived** — CLOSED: the same derivation now runs ONCE at the
   elect's write site and stamps; the flash, the card line and the ledger share one code path.
4. **Healing is damage with a note** — unchanged: it flows through the same chokepoint; key
   healing off the receipt's sign/note (`taken < 0`, note "Healing"), never a separate path.
5. **`combatStamp` is null out of combat** — by contract; the scan groups the null bucket, and
   tells it from ABSENT (legacy) fields.
6. **No new dependencies** (DESIGN R3) and **no presentation changes** — held: the cards render
   exactly as before; the stamps are invisible freight.
7. **Flag writes ride the serializer** — held: receipt/effect stamps travel INSIDE the existing
   `queueFlagWrite` merges; the `spend` stamp is a creation-stamp (single writer, never
   re-stamped), the same idiom as every moment flag's creation write.

### What this commission deliberately does NOT do

- No reports, meters, or UI in this module — ever (the user's own split). Charts are a later,
  separate commission.
- No buff-uptime machinery (v2, its own ruling — it wants effect lifecycle times).
- No backfill of historic messages — the ledger starts when the stamps do (2026-08-27); absent
  stamp fields ARE the era marker.
- No turn-time ownership — same fence as the BACKLOG's expiry item: nothing here may quietly
  commit the module to owning the combat clock.
