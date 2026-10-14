# Plan — Portent's offers on other creatures' rolls, widened

**BUILT 2026-10-14 as recommended** (RULINGS *Portent widened*): W1 (a check or a requested save whose roll carries a DC), the
rest's dice rolled by the bearer (the user's ask, outside this plan); W3 left as ruled. `smoke-classes` §126 proves W1.
**W2 BUILT the same day in its direct form, by the user's ruling** (RULINGS *The asks widened*): `ask: "crit"` dropped, every hit
or miss a face turns asks, with two mutes ("until my turn", "this combat") as the brake — the 8–9 popups a fight measured below,
chosen with that number in view. The quiet road (the card-only row) is retired; the same day Cutting Words' damage half moved to
the damage hold with a down guard. `smoke-classes` §41g proves W2.

Drafted 2026-10-14 at the user's ask ("widen Portent's bystander offers: what it would take to offer a stored face on other
creatures' ordinary hits and checks, and what it costs in popups"). Measured on the module at 3.4.5 (`main` identical in every
file named here), dnd5e 6.0.6 and the prototype's noise meter (`prototypes/session-0-classes.html`, group N) ported to node
with the widened options added. **Nothing here is built.** The rulings it needs are at the end.

## What stands today

Portent's offers are three roads, built 2026-09-30 (A7b, RULINGS *The PHB classes — A7*, calls 4–7) and unchanged since:

| Road | Where | What the diviner sees |
| --- | --- | --- |
| the diviner's OWN roll | `stored-dice.js` `carry`, on `dnd5e.preRollAttack` / `preRollSavingThrow` / `preRollAbilityCheck` (dnd5e fires the last for skills and tools too) | "By the Books — before the roll" with a tick per face, in every roll dialog: attack, save, check, skill, tool. Verified on the sandbox 2026-10-14 (an Intelligence check, an Arcana check, a Dexterity save, plain and from the sheet) |
| another creature's DEMANDED save | `bystanders.js` `bystandersFor`, `bend: "set"`, the DC off the demand | a popup with only the faces that turn the verdict, the save's verdict withheld meanwhile |
| another creature's CRITICAL HIT | `hold/lookup.js` `bystandersOf`, `ask: "crit"` | a popup with the faces whose total misses; the damage waits |
| another creature's ORDINARY hit | the same, `quiet: true` | nothing of its own: a face-button row on the attack card only where a hold already stands for someone else (`hold/views.js` `appendBystanderRows`) |
| a friend's MISS | `on: "both"` but never a crit → quiet; `stampMissHoldIfBystanders` drops quiet rows | nothing |
| another creature's CHECK, or a sheet save with no demand | `INTERRUPT_ROLLS.Portent.tests` is `["attack", "save"]`; the set branch needs a known DC | nothing |

That is the 2026-09-29 ruling (Q2 option A, RULINGS *The full release — the order*): **"Portent is narrowed to saves and critical
hits."** The meter behind it: 20 popups ungated against 9 under A, with every wanted chance still taken, and the finding that *Portent
is the noise* — a stored 3 flips almost any enemy hit, the margin gate cannot quiet it, and a mute pressed against the noise costs the
crit and the big save.

**Why Portent is the spam case and Cutting Words is not.** The two rows share one shape (a bystander's bend on the `roll` interrupt,
asked after the roll, the quiet road under the gate). Cutting Words has three brakes the gate can lean on: a Reaction (one per round),
a pool (Bardic Inspiration), and a margin (a d8 turns only a near hit). Portent has one: the faces in hand (two per Long Rest, once per
turn — and *once per turn* is a combat stamp, `storedTurnNow()` is null out of one). A low face is never "short": it turns every
ordinary hit by a foe; a high face turns every miss by a friend. So "ask when it can matter" asks on nearly every attack.

The brakes Portent does not have today, and would need before any widening: no "Not this combat" out of combat (`muteBystander`
returns null without a combat), no once-per-turn out of combat.

## The three widenings

### W1 — a check (or a save) whose roll CARRIES a DC: the save road, no new noise

dnd5e puts the DC on the roll when it knows one: `D20Roll#options.target` (set by the `[[/check … dc=]]` and `[[/save … dc=]]`
enrichers, an activity's own check DC, a GM's roll request with a DC); `isSuccess` / `isFailure` read it and the chat card colours
the total. The module never reads it (no `options.target` read anywhere in `scripts/`): `bystanders.js` stamps every check with
`dc: null`, and a sheet save with no demand is not stamped at all.

- **Change.** `bystanders.js`: on the three check hooks, read `rolls[0].options.target`; a finite one is the DC — stamp
  `"check"` with it. The set branch then works unchanged (`facesThatTurn`, the faces that turn the verdict, want by side). Add
  `"check"` to `INTERRUPT_ROLLS.Portent.tests`. The same read on `dnd5e.rollSavingThrow` for a save that is not a module demand
  but carries a target (a requested save) — a new, small listener, nothing withheld (no demand card to withhold for; the offer
  rides the roll's own message like a check's).
- **What the diviner sees.** The save popup as today: "Portent — replace the 4 with the 18", the faces that turn it only. The
  card: "Portent (Tychon) — 4 → 18, 22 vs DC 15 — SUCCESS".
- **Cost.** None measurable: a check with a DC on it is rare in a fight (the meter's one check has none) and it is exactly the
  check the GM chose to make a test of. Out of a fight it is the GM-requested skill check — the Portent moment the rule means.
- **Caveat.** `Portent.tests` gaining `"check"` makes `bystanderRows("check")` list Portent; the set branch's `!known → continue`
  must stay so a bare check still asks nobody until W3 says otherwise.

### W2 — ORDINARY hits (and friends' misses): the attack road, the measured spam

- **Change, the direct form.** Drop `ask: "crit"` from the row (or make it `ask: "turn"`): `bystandersOf` then lists Portent
  *asked* on every hit a face turns and every miss (`on: "both"`) a face turns. `hold/trigger.js` opens the hold for the asking
  bystander alone (`asking.length`), so the damage waits the decision window (24 s by default) for the diviner's popup, with the
  face tick rows `showBystanderPopup` already draws; `stampMissHoldIfBystanders` holds a friend's miss the same way. No new
  code on the answer side (`bystanderReaction` with `face` exists for the quiet row).
- **What the diviner sees.** A popup on most enemy turns: "Portent — the Bugbear's attack at Aster · 17 vs AC 15 — a hit. A stored
  face replaces the d20 (12)", a tick per face that turns it, Answer / Pass / Not this combat.
- **Cost, measured** (the meter's fight: 3 rounds, 23 D20 Tests, 11 foe attacks of which 8 hit, 5 friend misses, 3 demanded saves,
  1 check; the diviner's appetite as the prototype modelled it — only the crit and the Hag's save are wanted; the mute pressed after
  three passes in a row):

| Faces in hand | Today (saves + crits) | + ordinary hits, no mute pressed | + ordinary hits, the mute as modelled |
| --- | --- | --- | --- |
| 17 · 3 (the prototype's) | 3 popups, both big moments taken | **8 popups**, both taken | 3 popups then **muted on the third pass; both big moments missed** |
| 1 · 6 (Tychon's, 2026-10-14) | 2 popups, the crit taken | **9 popups** | 3 then muted; the crit missed |
| 10 · 11 (middling) | 1 popup | **8 popups** | 3 then muted |
| 20 · 2 | 3 popups | **8 popups** | 3 then muted; both missed |

  Portent alone goes from 1–3 popups a fight to 8–9, i.e. the whole table's bystander popups from 7–9 to 13–15 — back where the
  ungated prototype was. Every one of those is also a **hold**: the damage of nearly every enemy hit waits for the diviner (or the
  timer). And the model's player who *takes* the first ordinary flip spends both faces in round 1 and meets the crit with an empty
  chip — the meter counts that as wanted, a table would call it regret.

- **The quieter forms**, if the hits are wanted at all:
  1. **Card only, on a short Portent hold** (option C's lesson without its second surface): no popup; the quiet row's face buttons
     (`appendBystanderRows` already draws them, on the diviner's client only) on a hold that opens for Portent alone with a SHORT
     window — the dramatic beat (`S.dramaticBeat`, a world setting, default 0) or a fixed few seconds — then the damage rolls.
     Zero popups; a short pause on every hit a face turns; the chance missed whenever the diviner is not watching the log (the
     prototype's "left to the card" count). Needs: a `window` per hold entry (today one per hold), the hold-timer's pass path
     unchanged.
  2. **A world setting, off by default** ("Portent asks on ordinary hits"): the direct form behind a switch. Against the ruling's
     "no setting"; honest about the cost; the one form that gives a diviner who *wants* the noise the noise.
  3. **A narrower trigger** (ask on an ordinary hit only when the target is Bloodied, or at the diviner itself): fewer popups, but a
     rule of the module's own invention that the player has to learn; not recommended.

### W3 — a bare CHECK (no DC): Cutting Words' check shape, cheap in a fight and spam out of one

- **Change.** `bystanders.js` set branch: with no DC, offer the faces that move the total the side's way — a lower face on a foe's
  check, a higher one on a friend's (a new pure `facesThatMove` beside `facesThatTurn` in `decide/stored-dice.js`). Nothing withheld
  (the raw-check shape, RULINGS 2026-09-29: "the bent total is stated on the check's card — ask your DM whether it still succeeds").
  The popup's situation line says no DC is known; the card: "Portent (Tychon) — 8 → 17: 21 — ask your DM whether it still succeeds".
- **Cost in a fight.** 0–1 extra popup (one check in the meter's fight; a face that moves it is offered only while faces remain).
- **Cost out of a fight — the real one.** Every ability, skill and tool check by any creature on the scene (the row's reach is
  `"sight"`, i.e. the whole scene) asks the diviner: a group Stealth check is one popup per roller, at once; a session of exploration
  is dozens. And out of combat Portent has NO brakes: "Not this combat" does not exist (`muteBystander` → null), once-per-turn does not
  apply, and the faces last until the next Long Rest. This is also where the offers are *wanted* most often (a stored 17 on the
  rogue's lockpicking is the rule's own example), so a mute pressed here costs more than in a fight.
- **What it needs before it is playable.** A mute with a scope that exists out of combat: "Not on this scene" (a chip keyed by scene
  id, swept on `canvasReady` to another scene) beside "Not this combat"; or a session mute (swept at the Long Rest with the faces).
  New chip flag, the effect view lists it, `bystanderMuted` reads both.
- **Narrower, no new mute needed:** only checks the GM REQUESTED (dnd5e's roll-request card) or that carry a DC (W1) — the bare sheet
  check never asks. That keeps the rule's "a creature you can see" honest enough: the GM asked for the test.

## The build, if ruled

| Piece | Files | Tests |
| --- | --- | --- |
| W1: the DC off the roll; `"check"` on the row; the requested-save listener | `bystanders.js`, `decide/registry.js` | `decide-classes-a7.test.js` (the row); `smoke-classes` §41h — an ally's `[[/check dex dc=15]]` failed, the popup with the faces that turn it, Answer: SUCCESS; §41i — a bare check asks nobody |
| W2 direct: `ask` dropped | `decide/registry.js`; no machine change | §41j — a Bugbear's ordinary hit a stored 3 turns: the popup, Answer: MISS, no damage; a friend's miss a 17 turns: the popup, Answer: HIT, the damage rolls |
| W2 card-only: a per-entry short window | `hold/trigger.js` (`window` per target), `hold/clock.js` (the pass at the entry's own deadline), `hold/views.js` (no popup for a `cardOnly` guard) | §41j′ — the row's face buttons live for the window, the damage after it |
| W2 setting: `S.portentHits` | `settings.js`, `core.js`, `hold/lookup.js` (`asked` reads it) | §41j behind the setting on, §41g unchanged with it off |
| W3: `facesThatMove`; the no-DC branch; the scene mute | `decide/stored-dice.js`, `bystanders.js`, `shared.js` (`bystanderMuted` / `muteBystander` scope), `effect-view.js` | `decide-classes-a7.test.js` (`facesThatMove`); `smoke-classes` §41k — a foe's Athletics, the popup "replace the 16 with the 3", the card's "ask your DM" line; the scene mute set and swept |
| Docs | RULINGS.md (the Portent row of 2026-09-29, the Q2 note's "narrowed to saves and crits", the A7 calls 7); README's Portent line; `audits/classes-register.md` row; the prototype's meter gains the widened options (so the next ruling can see them) | `check-rule-folds`, `check-registry`, `check-doc-links` |

Two-client: the diviner's popup on a save or a check already relays as the bystander's own message (`bystanderRollAnswer`); the
attack hold's answer relays through `respondsTo` / `by`. Neither widening adds a relay.

## Recommendation

- **W1 now.** It costs nothing, it is the rule's own case (a test the GM set a DC on), and it needs no ruling change beyond adding
  `"check"` to the row's tests.
- **W3 only with a scope for the mute** — and even then prefer the narrow form (requested checks and checks with a DC) over bare
  sheet checks, which are the exploration-time spam.
- **W2: not the popup.** The 2026-09-29 measurement still holds with today's code: eight to nine popups a fight, and the mute the
  player reaches for costs the crit and the big save. If ordinary hits are wanted, the card-only short hold is the honest form (no
  popup, a short pause, the chance on the card), or the setting for a table that wants to be asked.

## The rulings it needs

1. **Checks and saves that carry a DC** (W1): build? — recommended yes.
2. **Ordinary hits** (W2): the popup (8–9 a fight), the card-only short hold, a setting, or stay narrowed? — recommended stay or
   card-only.
3. **Friends' misses**: the same answer as 2 (the row is `on: "both"`; a high face is the mirror of a low one).
4. **Bare checks** (W3): never, GM-requested only, or every check with a scene-scoped mute? — recommended GM-requested only.
5. **The mute's scope out of combat**, if 4 widens: "Not on this scene" or "Not until the next Long Rest"?
