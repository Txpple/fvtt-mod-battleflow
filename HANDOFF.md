# HANDOFF.md — the fighting styles walk, by hand, on the sandbox

> **A commission, written 2026-09-26 on the user's word** ("when you are done make a handoff and in
> new session there give me the walk table for the fighting styles"). ⚠ **It is not a "go"**: the
> walk is the USER's, at the sandbox; the next session's first job is to PRESENT the walk table (§2)
> in the user's format — one *Style | What you should see* table — and wait. Fixes on the user's
> findings run the fast loop (§3). Retired when the walk's findings are fixed and the docs recut
> (BACKLOG's header rule).

---

## 0. Where things stand (2026-09-26)

**The fighting styles are BUILT, battery-proven, NOT released, NOT pushed.** Ruled off
`prototypes/fighting-styles.html` (the Artifact "Fighting Styles"): one FIGHTING_STYLES table; each
style an effect on the character (a *face*) gated on what is EQUIPPED; notice **B**; guards **P1**;
Protection **R1**; Unarmed Fighting **U1**; Truesight counts. RULINGS *The fighting styles* has
every ruling; the register has five new rows.

| | |
| --- | --- |
| **Prod** | v2.0.8 on dnd5e 6.0.5. Untouched. |
| **main** | `f8664c7` the table and faces · `e0dd58c` who sees the unseen · `a6523c7` the guards · `d620ba8` the grapple ask · `13f2548` docs · `2726955` two suite fixes. **Not pushed.** Slice A before them is pushed (`34692fa`). |
| **fvtt-app-sessionscribe** | `d523366` the combat stats tally `fightingStyle` per attacker ("fighting styles: Great Weapon Fighting ×2 (+5 dmg)"). **Not pushed.** |
| **The sandbox** | runs main (deployed `--local`, byte-identical). Settings CLEAN. The walk roster (§1) is on **Party Camp**. |
| **Suites** | the FULL battery 2026-09-26 (`dist/battery/2026-09-26T12-56-49`): 40/43, settings clean, the world rolled back; the three reds were not the module — smoke-battleflow a 1-in-400 double fumble (its own words), smoke-hitmenu and smoke-superiority pinned exact formulas on BF Test Fighter, whose own Great Weapon Fighting now floors its dice (both suites now switch the Fighting Styles list off, like every list they are not testing); re-run alone green — §4. New: `smoke-styles` 31/31, `smoke-guards` 15/15. |
| **Owed by the user** | the walk (§2); the event audit (`slice-a-event-audit.md`); the release call (BACKLOG's list); the Savage popup's rank (DESIGN §8). |
| **Owed by Claude** | present §2; fix the walk's findings (§3); docs recut; retire this file. |

## 1. The walk roster — Actor folder **BF Styles**, tokens on **Party Camp** (BUILT 2026-09-26)

Nine copies of BF Feat Alert (a level-5 Dwarf Champion Fighter built through advancement), Alert
and Blind Fighting taken off, ONE PHB Fighting Style feat each, the PHB's own gear; linked tokens,
friendly, placed by `tools/content/place-styles-roster.mjs` (re-run it to put them back), read back
by `tools/content/check-styles-roster.mjs` — every face as below, settings CLEAN.

| Actor | Where | Equipped (carried) | Face read back |
| --- | --- | --- | --- |
| BF Style GWF | west of the west Dummy | Greatsword (Longsword) | Great Weapon Fighting — live, "Greatsword, two hands" |
| BF Style Dueling | east of the west Dummy | Longsword, Shield (Dagger) | Dueling — live, "Longsword in one hand" |
| BF Style Defense | north of the west Dummy | Longsword, Chain Mail | Defense — live, "Chain Mail"; AC 17 (16 + 1) |
| BF Style TWF | south of the west Dummy | Shortsword, Dagger (Longsword) | Two-Weapon Fighting — live |
| BF Style Unarmed | north-west of the west Dummy | Unarmed Strike (Shield, Longsword) | Unarmed Fighting — live, "d8 — hands empty" |
| BF Style Blind | south-east of the west Dummy | Longsword | none (Blind Fighting is the pack's own senses effect) |
| BF Style Thrown | 3 squares west of the east Dummy | Javelin ×5 (Longsword) | Thrown Weapon Fighting — live |
| BF Style Protection | west of Gren | Longsword, Shield | none (a reaction, not a face) |
| BF Style Interception | north of Gren | Longsword, Shield | none (a reaction, not a face) |

BF Feat Healer stands east of Gren too (friendly) — it is no guard: it has neither style.

## 2. The walk table — present THIS, in this shape, at the next session's start

Target a Practice Dummy unless the row says otherwise. The Fighting Styles list ships with all six;
the Interrupts list gains Interception and Protection (a released world needs Reset Defaults — BACKLOG).

| Style — actor | What you should see |
| --- | --- |
| **Great Weapon Fighting** — BF Style GWF (Greatsword) | Open the actor's effects panel (click the name on the effect bar): **Great Weapon Fighting — Greatsword, two hands** under Passive. Hit a Dummy: when a damage die shows 1 or 2, the card shows a gold line **"Great Weapon Fighting — 1 → 3: +2"** and **"+2 Great Weapon Fighting"** floats over the Dummy. No 1 or 2 → no line, no float. Unequip the Greatsword → the face moves to Unavailable, "no Two-Handed or Versatile melee weapon equipped". |
| **Dueling** — BF Style Dueling (Longsword + Shield) | The face **Dueling — Longsword in one hand**; every one-handed hit carries **"Dueling — +2"**. Swing the Longsword two-handed (the attack's mode) → **"Dueling off — two hands"**, no +2. Equip a Dagger too → the face greys, **"a second weapon held (Dagger)"**, no +2 and no line. The pack's own Dueling effect is off and hidden (the face carries the rule). |
| **Defense** — BF Style Defense (Chain Mail) | The face **Defense — Chain Mail**, the AC one higher than the armor gives. Unequip the Chain Mail → the face greys, **"no armor worn"**, the AC drops by 1 more than the armor. A Shield alone does not count. |
| **Thrown Weapon Fighting** — BF Style Thrown (Javelins) | Throw a Javelin (the thrown mode): **"Thrown Weapon Fighting — +2"** and the float. Stab with it in melee: nothing. |
| **Two-Weapon Fighting** — BF Style TWF (Shortsword + Dagger) | The Dagger's off-hand attack adds the modifier: **"Two-Weapon Fighting — +N on the off-hand"** and the float. The main-hand swing: nothing extra. |
| **Unarmed Fighting** — BF Style Unarmed (nothing equipped) | The sheet's Unarmed Strike rolls **1d8 + Str** with **"Unarmed Fighting — 1d8 + N in place of 1 + N (hands empty)"**; equip the Shield → **1d6**, "(a weapon or Shield held)"; the face says which die. **Grapple** a Dummy (the Unarmed Strike's Grapple, or the token HUD's Grappled — the HUD's names no grappler, see below), start a combat with the fighter first: at its turn a popup **"Deal 1d4 to the Practice Dummy you're grappling?"** — Deal it lands 1d4 with a card; Skip deals nothing; with a Hold Timer and no answer, the clock deals it. A Grappled from the token HUD (no grappler recorded) is offered only within 5 ft and never dealt by the clock. |
| **Blind Fighting** — BF Style Blind | Make a Dummy **Invisible** (token HUD). Attack it from 5 ft: the roll dialog's gate lists **"Practice Dummy is Invisible — BF Style Blind sees it (Blindsight 10 ft)"**, not counted — Normal. From 15 ft: Invisible counts, Disadvantage. Any creature with Blindsight or Truesight gets the same (a monster's Truesight 120 ft sees it). |
| **Protection** — BF Style Protection (Shield + Longsword) beside **Gren** (or any ally) | A Dummy (or the GM) attacks Gren and HITS: the Protection fighter gets its own popup **"<attacker> hits Gren"** — one row **Protection · Disadvantage · a Reaction**. Answer: the second d20, the lower stands; the attack card says **"Protection (BF Style Protection) bent the roll — Disadvantage, 17 → 9, MISS"**. Gren then wears **"Protected — BF Style Protection"** until the fighter's next turn: every later attack at Gren meets Disadvantage in the gate while the fighter stands within 5 ft (step away 15 ft → the row stands down). If Gren has a reaction of its own (Lucky, Shield), both popups show; a Pass waits for the other; the first to act wins. No Shield equipped → nobody is asked. |
| **Interception** — BF Style Interception (Shield + Longsword) beside **Gren** | Gren is hit: the damage WAITS on a card, and the fighter's popup **"<attacker> hits Gren for N — intercept?"**. Intercept rolls **1d10 + PB** and the damage lands short by it, the receipt saying "Interception (BF Style Interception) — reduced by N". Pass → it lands whole. Damage applied with the card's own buttons is not held (the register). |
| **Archery, Blessed Warrior, Druidic Warrior, Arcane Warrior** | Native — nothing to walk. |

**Report findings the usual way** (the walk-session restate rule: the OPEN list restated after every
update). Each finding is a fix-pass item on the fast loop (§3).

## 3. For Claude, on the user's findings — the FAST loop

Per finding: the ruling (ask with options where the rule leaves a choice), the code, `npm run
verify`, `deploy-house-module --local`, then ONLY that style's own suite section (`smoke-styles
--section N`, `smoke-guards --section N`) — minutes. **No full battery per finding**; the change-scoped
battery (`battery.mjs --changed <base> --list`, then without `--list`) once at the end of the walk.
Settings CLEAN after every run (`verify-settings --fix` — a new list row drifts a stored list). The
harness lessons stand (NOTES §5; memory): a killed run → `verify-settings --fix` →
`reset-fixture-state` → `fixture-suite`; launch batteries DETACHED; another session's bridge blocks
every suite — find it with the session list and ask it to disconnect.

## 4. This handoff's own commit

`2726955` the two suite fixes, re-run alone green (smoke-battleflow ALL PASS, smoke-hitmenu 45/45,
smoke-superiority 41/41, settings CLEAN; `dist/battery/2026-09-26T13-56-19`). This file, the roster
tools under `tools/content/`, and the roster itself on the sandbox (§1).
