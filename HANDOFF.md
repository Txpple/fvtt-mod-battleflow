# HANDOFF.md — the dice that rise: testing, then the docs recut

> **Written 2026-09-26 on the user's word** ("ok so lets do a handoff and start testing"). Supersedes
> the fighting-styles walk handoff (bf66fe1): that walk is DONE — all nine styles passed, every
> finding fixed. ⚠ **It is not a "go" for anything past §3**: the next session runs the tests
> (§3), fixes what they find (fast loop), recuts the docs, and retires this file. Push and release
> stay the user's call.

---

## 0. Where things stand (2026-09-26, end of session)

| | |
| --- | --- |
| **Prod** | v2.0.8 on dnd5e 6.0.5. Untouched. |
| **main** | `ea1f01c`, **24 commits ahead of origin, NOT pushed** (`829e97d` .. `ea1f01c`; before them the fighting styles `f8664c7` .. `bf66fe1`, also unpushed). |
| **fvtt-app-sessionscribe** | `d523366` (the `fightingStyle` stats tally) — still NOT pushed. |
| **The sandbox** | runs main (`deploy-house-module --local`, byte-identical). Settings not re-verified since the walk began — `verify-settings --fix` first. |
| **Unit tests** | `npm run verify` green, 903 tests. |
| **In-world suites** | ⚠ **NOT RUN since the walk began** — the user was signed in as GM all session. Everything below is unit-tested only. |

## 1. What this session built (all on the sandbox, all unpushed)

**The fighting-styles walk findings** (RULINGS *The fighting styles*):
- The face is one line, **"Fighting Style: <the feat's name>"**, no suffix; a style feat's own effect
  (Blind Fighting's senses) is titled the same (dnd5e's `fightingStyle` subtype). Thrown's face is
  always on (the thrown mode is its gate).
- An equip change floats core's own **"+(Fighting Style: Defense)" / "−(…)"** for every face; core's
  own float is quieted on the face writes (`animate: false`, a FRESH object per write — a shared
  frozen one threw and froze every face: `5626364`).
- Protection is still asked when the attack already had Disadvantage — greyed, "no effect — already at
  Disadvantage", the button "Keep my Reaction".
- Empowered Spell is damage only — a spell's healing is never offered it (`e3dc7e4`).

**The dice that rise** — ⚠ a SETTLED RULE (RULINGS *The dice that rise — THE RULE*; do not reopen):
the canvas dice play, for everyone, only when (1) a die's number changes — module or platform — or
(2) a Fighting Style's bonus; a die merely ADDED stays on the card.
- `scripts/dice-rise.js` (SPINE): the one renderer — chips over a token (turn over / gold / struck /
  red for a lost crit), above the tokens (core's scrolling-text depth), and the `diceRise` flag
  listener (any roll message carrying it plays on every client). `driftChip` stays for the listener.
- `scripts/decide/dice-chips.js` (DECISION): `rerollRise`, `eitherRise`, `foldRise`, `changedDice`.
- `scripts/hold/dice.js` (MACHINE part): a bent d20 (Protection, Lucky, Warding Flare, Shadowy
  Dodge) rises over the creature hit, off the hold record; a reload replays nothing.
- Wired: the fighting styles (card chips + canvas), Empowered, Savage Attacker, Healer's 1s, Heroic
  Inspiration's reroll, Lucky's second d20, and the platform's own rerolls/floors (`changedDice`).
- The card: the style line is Empowered's chips in the card's own ink (the gold line is gone).

## 2. The test roster on the sandbox — Party Camp

- **BF Styles** folder (nine fighters, the walk's roster) — around the west Dummy and Gren.
- **BF Dice** folder (NEW, copies — the suite fixtures are untouched), around the east Dummy:
  BF Dice Attacker (hostile), Lucky Flare (Lucky + Warding Flare), Parry (+ Parry), Stone, Shield,
  Savage, Heroic, Bard, Empowered.
- **Gren** has the PHB **Healer** feat (sandbox only — a prod refresh drops it).

## 3. For the next session — the order

1. **The sandbox to itself**: the user signed OUT (the preflight refuses a second GM); no other
   Claude session holding the bridge (find it with the session list, ask it to `disconnect-bridge`).
2. `verify-settings --fix`, then the **change-scoped battery**: `battery.mjs --changed bf66fe1 --list`,
   then without `--list`, DETACHED. Expected to exercise at least smoke-styles, smoke-guards,
   smoke-rescue, smoke-superiority, smoke-metamagic, smoke-hold. Suites assert the old wording in
   places — a red there is the suite, fix the assertion (the lines are `data-bf-style-line` now).
3. **A probe for `changedDice`** (the one guess in the build): how dnd5e 6.0 marks Halfling Luck's
   reroll (`r1=1` → `rerolled: true`?) and Reliable Talent (`min10` → `count`?). A wrong guess = the
   dice never rise, never a wrong number.
4. Fix the reds on the fast loop (the change, verify, `--local`, that suite's section only).
5. **Present the dice walk table (§4)** to the user and wait — the in-world look is theirs.
6. Docs recut (DESIGN/ARCHITECTURE/NOTES/BACKLOG as the change touched them; ARCHITECTURE §4 has
   `fightingStyle.dice`), retire this file, update the memory pointer.

## 4. The dice walk table — present at step 5

| What | Try | You should see |
| --- | --- | --- |
| **Great Weapon Fighting** | BF Style GWF hits a Dummy until a 1 or 2 shows | Card: the dice as chips, the 1 turning to a gold-edged 3; canvas: the same dice rise off the fighter |
| **Dueling / Thrown / Two-Weapon** | their BF Style fighters hit a Dummy | A gold "+2" (or "+N") chip on the card and rising off the fighter |
| **A bent d20** | BF Dice Attacker hits BF Dice Lucky Flare; answer Warding Flare or a Luck Point (or Protection beside Gren) | Two d20s over the one hit: the lower gold, the other struck; a struck 20 red; Advantage cancelled keeps the first die |
| **Empowered** | BF Dice Empowered casts a damage spell, rerolls dice | Each rerolled die turns over above the caster |
| **Savage Attacker** | BF Dice Savage hits, rolls again | The two totals; the one that stands glows |
| **Healer** | Gren casts Cure Wounds, rerolls a 1 | The 1 turns over above Gren (and NO Empowered popup) |
| **Heroic Inspiration / Lucky** | BF Dice Heroic rerolls a d20; a Luck Point after a roll | The d20 turning over; Lucky's two d20s, the higher gold |
| **The platform's own** | BF Species Halfling rolls a natural 1 (Halfling Luck) | The 1 turns over to the reroll above the Halfling |
| **Nothing** | Interception, Parry, Stone's Endurance, Shield, Bardic Inspiration | The card as before; NO canvas dice |
