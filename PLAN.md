# PLAN.md — v1.2.1 (receipt legibility) then v1.3.0 (Phase 1.9: effect & mastery riders)

> Written 2026-08-15 from a design session with the user. Read [HANDOFF.md](HANDOFF.md) and
> [design.md](design.md) first — design.md is binding, HANDOFF carries the ground truths and
> the release/test mechanics; nothing there is restated here. Items marked **user call** are
> decided — do not relitigate. Delete this file once v1.3.0 ships (fold anything still true
> into HANDOFF).

The user redirected the roadmap: these two releases come **before** Phase 2 (saves).
Rationale, once: on-hit effects and masteries fire every round; saves fire a few times a
fight; the machinery is hot from v1.2.0. Topple deliberately ships with a *manual* save so
Phase 2 can upgrade it in place.

## Release 1 — v1.2.1: the "rolled 9, took 0" fix — ✅ SHIPPED 2026-08-15

> Landed as written (all suites green, tagged, released). Kept for reference: the
> `calculateDamage` annotations and per-target `taken`/`traits` receipt fields below are
> what Phase 1.9's damage-dealt gates (Vex/Slow) read.

An Ice Mephit (cold-immune) hit by Ray of Frost shows the 9 prominently and the real story —
took 0 — only in the GM-only receipt row. Confusing to the player (reported from live play,
screenshot 2026-08-15).

- In `applyToHitTargets` (scripts/battleflow.js:2073), call `actor.calculateDamage(damages)`
  **before** `applyDamage` — it is public and side-effect-free, and annotates each damage
  entry in place: `d.active.multiplier === 0` for immunity, resistance/vulnerability flags,
  `d.active.threshold` (dnd5e actor.mjs:833–891). Persist the per-type annotations in the
  receipt flag. Use the system's math; do not recompute traits from `di/dr/dv` by hand
  (bypasses, modification, threshold all live in `calculateDamage`).
- Split the receipt row's audience (**user call**): a **public** per-target line with the
  taken amount and the reason — "Ice Mephit takes 0 — immune to cold" — while HP pools
  (21 → 21) and the revert button stay GM-only. Never show players an HP pool. Render the
  reason only when traits changed the number; unremarkable applications stay quiet
  (HANDOFF standing item 4: cards say one thing, once).
- Smoke (extend `tools/smoke-battleflow.mjs`, receipts live there): grant BF Test Victim a
  temporary cold immunity, attack, assert the applied amount AND the receipt **wording**
  (assert what the table is TOLD — HANDOFF), then restore. The "took 0" assertion is only
  valid if HP could have moved — heal first (HANDOFF's vacuous-assertion trap).
- Release solo as v1.2.1, house pattern from HANDOFF. It is player-facing and independent.

## Release 2 — v1.3.0: Phase 1.9 — effect riders + weapon masteries

Scope in one line: when an attack resolves, the effects riding it are applied (or offered)
automatically — spell-card effects and weapon-mastery payouts — with receipts and revert.
**The fence (user call): this phase never modifies a d20.** Advantage/disadvantage
enforcement and consumed-on-use expiry (the AC5e-sized lift) are explicitly out; the applied
effect chips are the reminder, the roll dialog's adv/dis buttons are the enforcement surface.
`dnd5e.preRollAttackV2` exists if a later phase wants enforcement; nothing here blocks it.

### What 5.3.3 gives us (verified against the clone 2026-08-15)

- Masteries are **labeling only**: config is label + journal ref (config.mjs:383–416), no
  effects ship anywhere, no automation. The payout definitions are ours to author.
- **The gift**: the attack flow stamps the mastery used onto the roll AND onto
  `flags.dnd5e.roll.mastery` on the attack message (attack.mjs:167–170) — only when the
  wielder genuinely has mastery with that weapon (`masteryOptions`, weapon.mjs:327). The
  system also already asks the "which mastery" question when a swap is possible (dialog
  dropdown only if >1 option). Detection = one flag read off a message the chain already
  holds. Eligibility, identity, choice-of-which: pre-solved.
- Masteries are **PC-only** — `traits.weaponProf.mastery` exists on character data, zero
  mentions in npc.mjs. The popup always has one natural owner: the attacking player.
- The native mastery surface (a "Mastery: Vex" supplement line, chat-message.mjs:429) rides
  the attack usage card — which our suppression currently eats. This module's announcements
  are restoring information, not adding noise.
- Save enricher for Topple: `[[/save ability=con dc=N format=long]]` (enrichers.mjs:632+)
  renders a clickable, sheet-respecting save in any chat card.

### A. Spell effect riders (build first)

At the point the chain applies damage, apply the usage card's `system.effects` (the same
array the suppression carve-out reads, battleflow.js:360) to each **hit** target, on the
active-GM elect (players cannot create effects on unowned actors — same elect pattern as
auto-apply). Per-target application, so the damage riders' split-target intersection refusal
does NOT apply here — hit the quarry and an unmarked goblin, both get slowed.

- Mirror the native tray's application path, including origin:
  `origin = concentration ?? effect` (dnd5e effect-application.mjs:184). Both origin shapes
  are real (HANDOFF ground truth) — reuse the walk, don't code to one.
- **Condition:** RAW gates some payouts on damage actually dealt. The v1.2.1 annotations give
  effective per-target damage — a target that took 0 (immune) still gets Ray of Frost's slow?
  No: RoF's rider is "on a hit", so it lands. But Vex/Slow masteries below require damage
  dealt. Keep the per-target effective amount available to this code path.
- Effect receipts join the damage card's receipt row: public line ("Reduced Movement applied
  to Ice Mephit"), GM-only revert = delete the effect, tolerating already-gone (concentration
  cascade, manual right-click, dead target). Same flag-is-state/row-is-view discipline;
  entries are an ARRAY with uuid fields, never uuid-keyed (HANDOFF ground truth).
- Setting `effectRiders`, world, Boolean, **default off**.

### B. Mastery riders (build second — reuses the applier and the popup)

Detect from `flags.dnd5e.roll.mastery` + the chain's existing hit/miss recompute. Payouts
(2024 RAW, conditions matter):

| Mastery | Trigger | Payout | Mode |
| --- | --- | --- | --- |
| Vex | hit AND dealt damage | authored effect on target: "Vexed (by X)" — attacker has adv on next attack vs it, until END of attacker's next turn | **auto** (no "can" in RAW) |
| Sap | hit | authored effect: disadvantage on target's next attack, until START of attacker's next turn | **auto** |
| Slow | hit AND dealt damage | authored effect: −10 ft speed (system.attributes.movement — self-enforcing), until start of attacker's next turn; refresh, never stack | **ask** |
| Topple | hit | popup ask → bfCard with `[[/save ability=con dc=8+prof+attackAbilityMod]]` + an apply-prone affordance (prone is a core status). Save is MANUAL until Phase 2 upgrades this same card | **ask** |
| Push | hit | announce only ("Push 10 ft") — never move tokens | **ask** |
| Graze | **miss** | flat damage = attack ability mod, weapon's damage type, through the apply/receipt machinery, own small bfCard receipt (no damage message exists on a miss) | **ask** |
| Cleave, Nick | — | out of scope (action economy / second attack roll) | — |

- Authored effects need proper names, icons, and turn-based durations so the chips read well.
  Combat turn durations, not seconds.
- Hopeless skips (mirrors Skip Hopeless Holds): no Topple ask on a target already prone, no
  Slow ask at 0 speed, nothing asked of/about the dead.
- Settings: `masteryRiders` (world, Boolean, off) and `masteryAsk` (`ask`/`auto`, default
  `ask`) — auto is the "tedium" escape hatch (**user call**: players like being reminded of
  options; the gate exists for tables that tire of it).

### C. The mastery popup

Hold design language, lighter machinery: **popups ask questions, cards state facts** (the
hold's own contract — popup decides, card watches, card is public). One question, exactly two
controls (Use/Pass — the two-control rule is binding, HANDOFF standing item 3), answered by
the attacking player's owner. Nothing downstream waits — no continuation, no settle, no
re-test; it is a payout with a confirm, not an interrupt.

- **Timer (user call): the 15s hold-timer pattern applies.** Reuse the `holdTimer` setting
  value and machinery (0 = wait indefinitely). Expiry = Pass, no payout. Build the bar with
  `element.animate()` from the flag's absolute deadline — never CSS animation (HANDOFF
  ground truth on detached-tree desync). Card keeps the call-a-dismissed-popup-back
  affordance while pending, exactly like holds.
- Auto-mode payouts (and Vex/Sap always) skip the popup entirely and go straight to
  apply + receipt.

### D. Card suppression rework + per-source settings (build last)

Correction to fold in: the current boolean already suppresses ALL attack usage cards
regardless of item type (battleflow.js:346–361); Ray of Frost survives only via the
effects carve-out (:360). A weapon carrying effects would survive too.

- Replace/extend `suppressAttackCards` with per-source suppression by the item type behind
  the activity: **weapon / spell / feature / other** (consumables+tools+tail), each
  defaulting to suppressed ("defaults to off" = not shown, **user call**). Migration
  constraint: a world with the old boolean on must carry forward with identical behavior
  without anyone touching settings — the live world has it on.
- The carve-out becomes: never suppress a card carrying effects **that the riders will not
  handle** (riders off → carve-out behaves exactly as today; riders on → the card can go,
  the effects land anyway). This ordering is why settings ship WITH 1.9, not before — a
  suppress-spell-cards toggle shipped alone would be visibly inert against the carve-out.
- Scope guard: touch only attack-activity usage cards. Save-spell cards are load-bearing
  (targets click their saves there) until Phase 2.
- New settings need placement in the settings-sheet divider polish (battleflow.js:260s).

### E. Day-1 verification (before building anything)

1. One live attack from a real PC (2024 premium sheets): confirm `flags.dnd5e.roll.mastery`
   appears on the attack message at this table. First assertion of the new suite.
2. What item type this world's 2024 monster attacks are (weapon vs feat) so NPC attacks land
   in the right suppression bucket.
3. Ray of Frost's card: confirm `system.effects` resolves to the item's Reduced Movement
   effect and the application path applies it cleanly to a token actor.

### F. Tests

New suite `tools/smoke-effects.mjs` mirroring the harness discipline (restore settings,
delete own messages, long-rest BF fixtures, whole-log searches by originating id, HP that
could have moved). Assertions at minimum: flag stamp present for a mastery PC / absent for a
non-mastery attacker; spell effect lands on hit targets only, never on miss; Vex/Slow gate on
damage dealt (immune target ⇒ no Vex); Sap/Vex auto vs Slow/Topple/Push asked; popup control
set is exactly Use/Pass and the timer expires to Pass; Topple card carries the enricher save
with the right DC; Graze pays exactly the ability mod on a miss, with receipt; revert deletes
the effect and tolerates already-deleted; suppression per-source honors the carve-out both
with riders off and on. Use **linked** tokens for ownership-sensitive assertions
(smoke-riders precedent).

### G. Docs

- design.md: add a Phase 1.9 section — the phase list doesn't know this phase exists, and
  the doc is binding, so extend it rather than silently diverging (design.md §10 pattern).
  Record the d20 fence and the popups-ask/cards-state rule there.
- HANDOFF.md: rewrite at release per house pattern. Delete this PLAN.md.

## Release order & mechanics

v1.2.1 first (solo, small), then v1.3.0 as one release built A → B → C → D. Both follow
HANDOFF's release mechanics exactly (three commits, tag the middle, build-release.ps1, zip +
bare module.json, ASCII commit bodies). The user tests immediately after every release — say
what is live, what needs F5, what needs a process restart.

## Decided calls (do not reopen)

- Mastery popups have the 15s timer (holdTimer reuse); expiry = Pass.
- Receipt public line shows taken amounts and reasons, never HP pools.
- All new features default off; `masteryAsk` defaults to `ask`.
- Manual save for Topple until Phase 2; Phase 2 upgrades the same card in place.
- No d20 modification anywhere in 1.9; Cleave/Nick/token-movement out of scope.
- Phase 2 (saves) is next after this ships.
