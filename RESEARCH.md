# RESEARCH.md — the evidence behind design.md

Source-level evaluation run 2026-08-14 (five parallel research passes over real clones:
midi-qol `v14` branch, DAE `v14` branch, dnd5e `release-5.3.3`, the local house-module family,
and a web survey of the 2025–2026 ecosystem). This file preserves the load-bearing findings so
the design's judgments can be re-checked without re-running the research. Environment evaluated:
**Foundry VTT v14 + dnd5e 5.3.3 (2024 rules), Molten-hosted, headless-bridge-driven world.**

---

## 1. midi-qol (v14 branch, HEAD `fd289b7`, 2026-07-31, release 14.0.x)

Repo: https://gitlab.com/tposney/midi-qol — branches `master`/`dnd3`/`v12dnd4`/`v13`/`v14` +
an active `wfrefactor` (one branch per Foundry/dnd5e generation is the maintenance model).
License: **CC-BY 3.0 Unported** (not a software license).

**Size**: 59 TS files, **50,584 lines** (src only). Largest: `utils.ts` 9,810 · `Workflow.ts`
8,792 · `patching.ts` 3,040 · `GMAction.ts` 2,618 · `MidiActivityMixin.ts` 2,540 ·
`Hooks.ts` 2,112 · `settings.ts` 2,019 (34 settings, ~500 configSettings keys) · config UI
(`apps/`) 5,946 · a 1,670-line FLAGS.md documenting the flag system.

**Hard requirements**: `dae` (>= 14.0.0), `socketlib`, `lib-wrapper`. dnd5e pinned
**5.2.4–5.3.99** (hard minor-family ceiling). times-up is NOT required on v14 — its duration
management moved into DAE.

**Architecture**: an explicit async state machine (`Workflow` class, ~7,270 lines + 7
subclasses) with **29 `WorkflowState_*` states** and ~60 dynamic pre/post hooks + 12+ OnUse
macro passes. **33 libWrapper patches** (many on `_private` methods: `_preCreate`, `_onUpdate`,
`_onClickLeft`, `_isVisionSource`…). **Replaces 8 document classes wholesale** (Actor, Item,
ActiveEffect, ChatMessage, Combat, TokenDocument, Region, AmbientLight) and subclasses **every
dnd5e activity type** (15 mixin classes). ~57 socketlib GM-proxy handlers (player-save prompts,
reactions, reverse damage cards, undo family). References 49 distinct `dnd5e.*` hooks.

**Apportionment**: the core attack→hit→damage→save→apply chain ≈ **15–20%** (~8–10k lines).
The rest: `flags.midi-qol.*` advantage/grants/DR platform (70+ flag paths, ~2,500 lines),
reactions (~1,000+), cover/LOS/range/flanking (~1,200+), OverTime DoT ticks (~900), OnUse
macro platform incl. 1,354 lines of macro-editor autocomplete (~2,500), undo (~700), roll
stats (767), sounds (875), config UI + troubleshooter (~6k), region behaviors, 70+ API exports.

**Key findings**:
- Even midi's core chain is not self-contained: the effect-application payoff step is
  **delegated to DAE** (`DAE.doActivityEffects` from `WorkflowState_ApplyDynamicEffects`),
  and player-side saves ride the socketlib proxy.
- On v14, midi largely **orchestrates native dnd5e machinery** rather than re-implementing it
  (native damage application + `calculateDamage` hooks, native concentration — midi only wraps
  to add flags/DC tweaks, native roll pipeline). This is the existence proof that a thin module
  can orchestrate the same public hooks.
- Changelog is dominated by chasing core/dnd5e churn + workflow-race fixes (double callbacks,
  looping activity chains, out-of-order cards) — the cost of the serial in-memory state machine.
- Residual value dnd5e doesn't have natively: unattended chain auto-rolling, hit determination
  with auto-advance, socket-prompted saves with timeouts, hit/save-filtered effect application,
  reactions, flags/auras, cover/range gating, OverTime ticks. (Battle Flow rebuilds only the
  first four, without sockets; refuses the rest.)

## 2. DAE — Dynamic Active Effects (v14 branch, release 14.0.13, 2026-07-31)

Repo: https://gitlab.com/tposney/dae. 23 TS files, **10,045 lines** + vendored expression
tokenizer. Requires lib-wrapper + socketlib. ~11 libWrapper patches + a direct monkey-patch of
v14 core's `ActiveEffect.registry.refresh()`.

**What it is**: midi's delegated effect engine — (1) `doEffects`/`doActivityEffects`: apply an
item's non-transfer effects to targeted tokens with GM socket routing (midi's backbone);
(2) macro change keys (`macro.execute`/`itemMacro`/`actorUpdate`/`createItem`/`tokenMagic`)
firing on apply/remove; (3) ~30 special durations (`1Attack`, `1Hit`, `isAttacked`,
`isDamaged`, `isSave.dex`, `shortRest`…) that **only midi's workflow fires — inert without
midi** (DAE has zero rest/combat hooks of its own); (4) stackable effects, `deleteUuid`/
`deleteOrigin` cleanup, source↔target links (warding bond); (5) a much richer effect editor.

**Verdict for this table**: DAE's own README opens *"First off you probably don't need DAE. The
core Foundry system has active effects that do at least 80+% of what you might want."* Its
2020-era reasons (formula evaluation, transfer effects, timed expiry, an effects UI at all) are
now native to v14 core + dnd5e 5.x; its in-repo maintainer docs (`redundancy-review-2026-04-01`,
`dnd5e-v6-impact-2026-05-30`) chart a deliberate convergence onto native features. Without
midi, installing DAE buys an editor + scripting hooks this module doesn't need. **Not a
dependency.**

## 3. dnd5e 5.3.3 native automation (tag `release-5.3.3`, commit 965ad2d)

Roughly **half the chain is native, and every link ends at a button**:

- **Attack**: using an attack activity posts a card and auto-opens the attack flow. Targets at
  use-time are snapshotted into `flags.dnd5e.targets` as `{uuid, name, img, ac}` (AC null under
  cover status; single target pre-fills the roll's target AC). Hit/miss vs AC is computed **at
  render time** per client (`ChatMessage5e._enrichAttackTargets`;
  `isMiss = !crit && (total < ac || fumble)`) and shown in a targets tray — gated by world
  setting `attackRollVisibility` (`all`/`hideAC`/`none`, default **none**). Hit/miss is
  **never persisted** — downstream must recompute. The card's Damage button recovers
  attackMode/ammo and pre-selects critical via the message registry.
- **Message registry**: `flags.dnd5e.originatingMessage` stamped from the DOM click's enclosing
  card; `dnd5e.registry.messages` provides `getAssociatedRolls("attack"|"save")` /
  `getOriginatingMessage()` — the chain linkage Battle Flow rides.
- **Damage**: `<damage-application>` tray on damage cards — **GM-only** (`if (game.user.isGM)`),
  manual, and does **not** filter to hit targets. Per-target preview runs the real
  `Actor5e#calculateDamage` (immunity/resistance/vulnerability incl. `ALL` + physical-bypass
  properties, modification, threshold, temp/tempmax); multipliers (−1, 0, ¼, ½, 1, 2) and
  per-source ignore toggles. Apply = plain local `actor.applyDamage(damages, {isDelta:true})`
  → **requires ownership, no GM proxy, no auto-apply setting of any kind**. Hooks:
  `preCalculateDamage`/`calculateDamage`/`preApplyDamage` (updates mutable)/`applyDamage`
  (local) then `damageActor`/`healActor` on ALL clients.
- **Saves**: save cards render per-ability DC buttons visible to **everyone**; clicking rolls a
  real save for the clicker's selected tokens with success/failure marked vs `options.target`.
  No aggregation of who saved. **Half-damage-on-save is display text only**
  (`flags.dnd5e.roll.damageOnSave`). Legendary resistance is native (a "Resist" button flips a
  `forceSuccess` flag). A `"request"` message type with per-target tracking exists but is wired
  only to rest/skill at 5.3.3.
- **Effects**: usage cards carry `system.effects` with an apply tray (all users; rows filtered
  to owned actors). Applying under concentration sets the effect's `origin` to the
  concentration effect + `flags.dnd5e.dependentOn` ⇒ the **active-GM client deletes all
  dependents when concentration ends — the one native cross-client pattern in the system**.
  Save-effect `onSave` flag is informational only. Enchantments + condition riders native.
- **Concentration**: native prompt on HP loss (whispered card, computed DC via
  `challengeConcentration`), native limit/replace dialogs, native effect creation —
  **but a failed save does NOT end concentration** (manual via token HUD / effect delete).
- **No effect expiry code in the system repo** at 5.3.3; Foundry **v14 core** absorbed
  timed/round expiry (`ActiveEffectRegistry`, `duration.expiry` — the reason Times Up has no
  v14 version and DAE migrates its turn-durations to core). Exact end-to-end behavior in a live
  world = Phase 4's verify-first experiment.
- **Other native**: death saves fully automated; bloodied (default `player`); exhaustion→dead;
  NPC `autoRecharge`; `autoRollNPCHP`; **no auto-defeated at 0 HP** (combatplus's feature);
  **no sockets or queries API usage anywhere in the system at 5.3.3** — application is local +
  ownership-gated.
- Roll pipeline hooks all fire on the rolling client only; `hookNames` expand most-specific-
  first (`preRollAttackV2` → `preRollD20Test` → bare), with `postBuild<Name>RollConfig` /
  `post<Name>RollConfiguration` (rolls built, not evaluated, cancelable) stages.
  `dnd5e.rollAttackV2` fires after evaluation+message, **before ammo consumption**
  (`ammoUpdate` mutable). Combat recovery hooks (`preCombatRecovery` etc.) fire on the
  **active-GM** client.

## 4. House-module family patterns (from the local combatplus/autoexplore repos)

`fvtt-mod-combatplus` = the template: 4 tracked files, one 564-line ES module, no build step,
**no relationships block at all** (no deps, no system pin — it's system-agnostic), 8 linear
direct-to-main commits, version-per-feature tags, manifest-URL releases. Idioms: hoisted `S`
key map + `setting()` getter; every feature defaults OFF and early-returns at hook top;
`isActiveGM()` single-writer for world-visible writes (auto-defeated at lines 440–461 is the
GM-elect precedent Battle Flow's apply step copies); initiating-client veto for gates
("table-manners rail, not enforcement"); self-tracked combat-state maps (never trust
`Combat#previous`); `renderSettingsConfig` dividers + dependent-field grey-out (added at v1.2.1/2
because 20 settings hit the readable ceiling); v14 ground truths commented at the line that bit
(`User#updateTokenTargets` gone ⇒ `Token#setTarget` + `broadcastActivity`).

**Why Battle Flow is a sibling, not a combatplus feature**: combatplus's binding contract is
core-document-hooks-only / system-agnostic / no dnd5e dependency; automation must pin dnd5e and
ride its workflow hooks (different churn cadence — isolate it so a dnd5e minor can never take
down the initiative gate mid-campaign); the settings ceiling is already reached; and the family
pattern is one small module per concern (six exist, ~100–600 LOC each).

## 5. Ecosystem survey (August 2026)

The midi-free consensus stack: **dnd5e native + Automated Conditions 5e**, with per-gap
micro-modules. Nobody midi-free does zero-click damage application or NPC save auto-rolling —
the exact niche Battle Flow fills for one table.

| Module | What | License | State (2026-08) |
| --- | --- | --- | --- |
| **AC5e** (thatlonelybugbear) | Conditions/range/cover → adv/dis/auto-crit on rolls; flags + API; does NOT apply damage/effects | **MIT** | v14.533.15, verified 14.365 + dnd5e 5.3.3, exceptionally active; Phase-5 adoption candidate |
| Effective Tray NG (alterNERDtive) | Players use native damage/effect trays via sockets | GPLv3 | v14-current; unnecessary under our GM-elect design |
| Auto Damage Rolls (Injust) | Auto-rolls damage after every activity use (rolls only) | unlisted | small, v14/5.3.3; overlaps Phase 1a only |
| RSReforged (arrowedagain) | Maintained Ready-Set-Roll fork: one-click rolls, per-type apply buttons | GPL-3.0 | v14-current; conflicts with midi-class pipelines |
| Custom D&D 5e (Larkinabout) | HP-threshold conditions (bloodied/unconscious/dead), house rules | unlisted | active; overlaps combatplus auto-defeated |
| Rest Recovery | Short/long-rest automation | unlisted | active |
| Times Up (tposney) | Effect expiry | — | **EOL: "no version for v14"** — absorbed by core |
| Effective Transferral | Effect application from cards | — | dead (absorbed by dnd5e 3.x+) |
| Better Rolls 5e | Roll pipeline | — | dead (lineage → RSR → RSReforged) |
| babonus (Zhell) | Conditional bonuses | — | stale at Foundry 12 |

dnd5e's own roadmap (release-5.0.0 notes) announces further absorption: "Progressive chat
cards, Action tracking, Conditional ActiveEffects, ActiveEffect expiry" — the basis for
design.md §2.7 (thin and deletable).

Sourcing caveat: r/FoundryVTT is not crawlable by the tooling used; consensus was triangulated
from package listings, module READMEs/repos, and the dnd5e roadmap rather than quoted threads.

## 6. Decisions log (the simmer session, 2026-08-14)

1. Build a thin house module; skip midi-qol and DAE entirely. Named **`fvtt-mod-battleflow`**
   ("autoresolve could mean anything" — the outcome-word won; "CombatFlow" exists as a
   non-Foundry standalone tracker, so `combatflow` avoided).
2. Zero sockets/deps: attacker-client rolls, owner-client saves, active-GM-elect applies;
   coordination via document replication only ("the chat log is the state and the bus").
3. Damage only ever rolls **after** hit determination (midi's roll-both-together confuses
   players); miss = the damage dice never exist; crits pre-configure doubled dice.
4. Revert receipts from day one (wrong-target fix): per-target snapshot + one-click revert on
   the damage card; native tray = the re-apply path; no workflow undo.
5. Reactions scoped in as a **hold**, never a system: curated interrupt list, player-side
   Cast/Pass controls (the cast IS the answer), GM override, re-resolve vs live AC,
   reaction-spent suppression, AC-type interrupts skip crits.
6. Popup + card row + optional countdown timer = the reusable "table moment" shell; popup
   reveal (show the math + Shield verdict) is a dedicated world toggle; timer default ≈5s when
   enabled, authoritative clock = the continuing client, buzzer races land in revert.
7. Saves auto-roll for **everyone** (players' own clients), mode ladder prompt-all → auto-NPC →
   auto-all, per-player opt-out later; per-target independent application (no barriers).
8. Concentration assist: reuse the shell (its second customer), prompt/auto modes, timer
   default action = Roll, **break-on-failure** via native endConcentration (the forgotten
   click), announce by stakes.
9. Damage riders solved by curation (Hunter's Mark: the mark effect on the target IS the
   state; inject at `preRollDamageV2`), not a conditional-bonus platform; delete when dnd5e
   ships Conditional ActiveEffects.
10. Expiry: verify-first (cast Bless, run 10 rounds) — likely zero code on v14 core; 20-line
    active-GM sweep as fallback; always announce expirations.
11. GM click economy ≈ zero is a design invariant ("I don't want to manage a million
    resolves").
