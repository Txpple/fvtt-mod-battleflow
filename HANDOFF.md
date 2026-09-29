# HANDOFF.md — the PHB classes: A6 + A7a pushed, A7b LOCAL, next the FULL battery (2026-09-29, night)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.**

## FIRST — the state

- **A6 PUSHED** (`b1ca408`; RULINGS *The PHB classes — A6*): `INITIATIVE_GRANTS` + `scripts/initiative-grants.js`
  (Persistent Rage automatic, Uncanny Metabolism offered), Vitality Surge (`on: "use"`) and Life-Giving Force (the rest
  song's hand-out) on `TURN_GRANTS`, the Rage reminder silenced by Persistent Rage; Circle Forms NATIVE. Own suites
  green (smoke-classes 154/154, battleflow, alert, spells, rest; monsters 50/51 — the §4a token-order lesson below).
- **A7a PUSHED** (`c3b1f67`; RULINGS *The PHB classes — A7*): `CAST_RIDERS` + `scripts/cast-riders.js` — Wild Magic
  Surge (the module's d20, the table on a 20, Tides of Chaos spent: the table at once and Tides back) and Inspiring
  Smite (the song's `distribute` popup, No keeps the Channel Divinity, the clock gives all to the paladin). Own suites
  green (smoke-classes 163/163, battleflow, rest).
- **A7b — Portent — is in `git stash` ("A7b Portent"), NOT committed, NOT pushed.** `git stash pop` restores it:
  `STORED_DICE` + two new files, stored-dice.js and its decide/ half (files 131), the `Portent` row on `INTERRUPT_ROLLS`
  (`bend: "set"`) through hold/lookup, hold/answer, hold/views, bystanders.js, `shared.js` (the chip helpers),
  `decide/rescue-hit.js` (`bentLines` "set"), smoke-classes §41, unit tests, RULINGS A7 (calls 4–7), the bend
  register's Portent row, the plan's A7 note, the drawing/register row. `npm run verify` green on it; deployed
  `--local` (the sandbox carries it now).
  - §41 ALONE: 7/7. Its battery (dist/battery/2026-09-29T22-00-03): battleflow, hold, saves 137/137, twoclient,
    superiority, rescue, wards, guards ALL green; **smoke-classes 167/170 — §41c, §41d, §41f red IN THE FULL RUN**:
    - §41f: `hp=60` — §37 leaves the Halfling's HP max at 60 (its `hgKeep` restores only at teardown), so `swing`'s
      `healFull` (400) clamps; the verdict and the bent roll were RIGHT. Fix: §41 sets the Halfling's max back to 400
      first (or §37 restores its own).
    - §41c/§41d: the pinned natural 1 did not land (the save totalled 14, it passed, nobody was asked). Something
      earlier in the full run leaves the dice queue or the Halfling's save state different — reproduce with
      `smoke-classes --section 37,38,39,40,41`, fix, re-run.
  - **The push gate for A7b:** those three green in a full smoke-classes run → commit (message drafted below) → push.
- **THE FULL BATTERY is next** — the letter series A is done once A7b is in (the rapid-mode cadence: a full battery
  after A7). The user asked for it to START the next session: `node tools/battery.mjs` (launch detached), then
  `node tools/verify-settings.mjs`. After a killed run: `verify-settings.mjs --fix` → `reset-fixture-state.mjs` →
  `fixture-suite.mjs`.

A7b's commit message (draft): "A7b: Portent - the stored dice (STORED_DICE, stored-dice.js) and the set bend" — the
Long Rest keeps two d20s on a chip; its own roll: a tick per face in the dialog, the d20 term rolls the face; another
creature's save or critical hit: the bystander's `bend: "set"`, after the roll (the register's row); no new kind
(tripwire 39); files 131; smoke-classes 41.

## The calls made today (each the user's to overrule; all in RULINGS)

- A6: Circle Forms NATIVE; Vitality Surge at the Rage's USE and Life-Giving Force at the turn START (the pack's text,
  not the plan's); the Initiative grants read per combatant as its own Initiative lands; never spent on nothing.
- A7: Wild Magic Surge rolled by the module (Q7, *Bent by choice*); Tides of Chaos per the 2024 text; Inspiring Smite
  offered and divided, its clock all-to-the-paladin (*Bent by choice*); Portent: NO `set` kind (a bend on the `roll`
  interrupt + a pinned die), faces on a chip, its own rolls before the roll, others' saves and crits after.

## Suite lessons (smoke-classes, keep them)

- `popups()` skips `ui`'s singletons (a text-match close once shut the CHAT LOG) but keeps `ui.activeWindow`.
- dnd5e 6: a message's targets are `system.targets[].actor`; an enchant use with `configure: false` applies
  nothing — `activity.applyEnchantment(profileId, item, { chatMessage, strict: false })` (§23, §31).
- The fixtures lack class scales (`@scale.monk.*`, `@scale.psi-warrior.*`, `@scale.barbarian.*`): pin the lent
  copy's part (`pinPart`); lend anything consumed BY UUID with its compendium source stamped (`hgLend`).
- Out of combat no Reaction chip is written; the save's outcome is forced by pinning every die to 1 or 20.
- An ATTACK with no target is refused outright (polish.js) — a casting-window test must target someone.
- dnd5e 6: a spell's class is `system.sourceItem` ("class:warlock"), `classIdentifier` only with the class on the
  sheet. An attack's rescue on a character is Heroic Inspiration (`system.attributes.inspiration`); Lucky's d20
  is an initiative fold only.
- Created embedded documents do NOT come back in the order asked (`createEmbeddedDocuments('Combatant', [a, b])`):
  find each by its actor (§37 set the wrong combatant's Initiative for half a day).
- An UNLINKED token shares its base actor's effects: smoke-battleflow's permanent unlinked Victim token (1100,1000)
  picks up a Grappled put on BF Test Victim — smoke-monsters §4a counts the Victim twice when it runs after
  smoke-battleflow without the full battery's order between them (not a code defect; delete the two unlinked
  "Hobgoblin" tokens and it passes).
- A moments-scan `[CONST]` key resolves across EVERY file: two machines using the same constant name for different
  keys collide (a new machine's flag constants carry its own prefix).
- Pinning a d20 face: override the TERM's `randomFace` (`d20.randomFace = () => face`) — the result IS the face; `min`/
  `max` modifiers only change `count` and dnd5e's crit/fumble never see them.



## Next — in this order, each on the user's go

1. **A7b's three §41 reds** (above) → commit → push.
2. **The FULL battery** (the end of letter series A) — green → the A series is closed.
3. **B1 → B5** (full battery after B5), **C1** (full), **D1** (full).
4. **Owed small:** a Legendary Resistance flip of a failed Stunning Strike lands no Slowed (`saves/verdict.js`);
   Physician's Touch's Poisoned is B4's; the `.claude/worktrees/a2-live` worktree can be removed.
5. Then **the DMG**, then **the splat books**; **the prod deploy** (v2.7.0 + everything since) and **the walks**
   whenever the user says.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in the same
  commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`; a new file bumps
  `tools/check-registry.mjs`'s pin (129 pushed; 131 with A7b) and joins check-layers / dispatch / battleflow.js; a new kind moves
  `EXPECTED_KINDS` (39).
- A change runs its own suites (in rapid mode a spine change too — the full battery after each letter series); deploy `--local`
  first; launch detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).
