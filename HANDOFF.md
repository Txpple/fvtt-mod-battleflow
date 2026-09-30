# HANDOFF.md — the PHB classes: the A series CLOSED, next B1 (2026-09-30)

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Do nothing until the user says go, and do not re-ask what is ruled below.**

## FIRST — the state

- **A7b PUSHED** (`cecf450`): Portent — `STORED_DICE`, stored-dice.js and its decide/ half (files 131), the `set` bend
  on `INTERRUPT_ROLLS`; tripwire still 39. smoke-classes 170/170 in a full run.
- **The A series' full battery ran** (dist/battery/2026-09-30T02-26-05): 41 of 46 green, settings CLEAN. The five reds:
  - three one-off flakes, green on the rerun (dist/battery/2026-09-30T04-22-54): superiority §11d, classes §28e,
    probe-effect-view §4/§6/§6c (effect-view failed the same way in the A3 battery and went green after);
  - two suite races, FIXED in the suites and green (dist/battery/2026-09-30T04-45-10): emanations §22a read the Magic
    Circle's flag before its picks landed; monsters §4a — smoke-monsters now sets the Victim's UNLINKED tokens aside
    for its run and puts them back with their own ids (the §4a lesson below is closed).
  - No module defect. **The A series is closed.**

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
- A moments-scan `[CONST]` key resolves across EVERY file: two machines using the same constant name for different
  keys collide (a new machine's flag constants carry its own prefix).
- A setting one section changes and only the TEARDOWN restores leaks into every later section (§28 on leave
  `saveRolls` at 'auto': §41c's demanded save rolled itself before the pinned die). A section pins what it needs.
- A hit's damage rolls WHILE the hold waits: pin a later die only after `damageFor(msg)` exists (§16 — a cold server
  rolled the damage after the pin and the two dice swapped).
- Pinning a d20 face: override the TERM's `randomFace` (`d20.randomFace = () => face`) — the result IS the face; `min`/
  `max` modifiers only change `count` and dnd5e's crit/fumble never see them.



## Next — in this order, each on the user's go

1. **B1 → B5** (the full battery after B5), **C1** (full), **D1** (full) — the plan is audits/plans/session-0-classes.md.
2. **Owed small:** a Legendary Resistance flip of a failed Stunning Strike lands no Slowed (`saves/verdict.js`);
   Physician's Touch's Poisoned is B4's; the `.claude/worktrees/a2-live` worktree can be removed.
3. Then **the DMG**, then **the splat books**; **the prod deploy** (v2.7.0 + everything since) and **the walks**
   whenever the user says.

## Ground rules (unchanged)

- Every row names its precedent; a platform-forced bend goes in RULINGS *Where the table bends the rule* in the same
  commit; a bend by choice in *Bent by choice*; a new flag key is classified in `decide/moments.js`; a new file bumps
  `tools/check-registry.mjs`'s pin (131) and joins check-layers / dispatch / battleflow.js; a new kind moves
  `EXPECTED_KINDS` (39).
- A change runs its own suites (in rapid mode a spine change too — the full battery after each letter series); deploy `--local`
  first; launch detached.
- `npm run verify` green on every commit; `biome --write` on named files only; commit bodies ASCII.
- After any run: `node tools/verify-settings.mjs` (`--fix` restores).
