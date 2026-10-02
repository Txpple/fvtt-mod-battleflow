# HANDOFF.md — 2026-10-02: Ravenloft built (the third splat book); the release in flight

> **What this is:** the pick-up point for a session that starts cold. It is retired when what it hands over is done.
> **Wait for the user's go.** A ruling in chat is not a go. Rapid dev mode stands (no walkthroughs). **Between campaigns:
> no prod deploys** (the user, 2026-10-02) — a release is GitHub via CI, nothing more.

## The state

- **Ravenloft: The Horrors Within BUILT** on the user's go (*"lets continue on to ravenloft!"*): RULINGS *Ravenloft: The
  Horrors Within*, [audits/ravenloft-register.md](audits/ravenloft-register.md) (502 rows: 59 MODULE · 14 WAITS · 20 OUT ·
  183 TEXT · 226 NATIVE), the drawing [audits/drawings/splat-ravenloft.md](audits/drawings/splat-ravenloft.md). ~45 rows,
  ONE new table (`MISHAPS` + `scripts/mishaps.js` — six dark gifts' save on a 1; not a kind), a dozen facets (the registry's
  table docs name each). The unit test is tests/decide-splat-ravenloft.test.js; the live sections are smoke-splat §11–§17.
- **The WAITS rows of all three books stand** for a pass of their own (the user: *"keep those waits rows hanging"*): 23
  Arcana, 16 Faerûn, 14 Ravenloft — each register names the precedent. The Spellfire rows are among them.
- **Then 3.0.0** = PHB + DMG + MM + the three books, pre-walk — the user's to cut by hand.

## In flight — the release of v2.14.0

1. smoke-splat §11–§17 green on the sandbox (§12, §13, §16 were green first; §11 needed the saves machine to admit a
   self-aimed MISHAP demand; §14 the `while` readers to see an ITEM's transferred effect — `wearsEffectNamed`; §15 a trait
   lent off the pack's Dullahan; §17 Fear in place of Cause Fear — the 2024 PHB has none).
2. `npm run verify`, commit on main after 5f8152e/64d441c, push.
3. The full battery (detached, `dist/battery-ravenloft.log`; `node tools/battery-status.mjs`); reds re-run alone.
4. v2.14.0: `node tools/bump-version.mjs 2.14.0` → `release: v2.14.0` commit (module.json alone) → annotated tag →
   `git push --follow-tags` → CI publishes. **No prod deploy.**
5. HANDOFF retired; BACKLOG 5b, the memory updated.

## Suite lessons (keep them)

- `dnd5e.postRollConfiguration` fires BEFORE the dice land — a kept face is read on the evaluated hooks (dnd5e.rollAttack /
  rollSavingThrow / rollAbilityCheck / rollSkill / rollToolCheck / rollDeathSave).
- An item's transferred effect (a feature's form: Ghastly Form, Frozen Soul) is never on `actor.effects` — read
  `actor.appliedEffects` (lookup.js `wearsEffectNamed`); a suite switches it on ON THE ITEM.
- A bestiary actor pack's items have no uuid of their own: lend a trait by loading the actor from the pack index and copying
  the item (smoke-splat `lendTrait`).
- The saves machine refuses a self-aimed save unless the card carries `mishap` — the pack types the dark gifts' saves "self".
- A pack activity may name a consumption of its own uses and carry none to count (Steel Yourself): `uses: false` and a caveat.
- `keep()` a fixture value at SETUP, never after the section's write.
- ⚠ No `foundry-local5e` MCP call while a battery runs. Heredoc edits mangle backslashes: python files, `newline=''`.
