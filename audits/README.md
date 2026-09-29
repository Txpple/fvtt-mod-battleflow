# audits/ — the 2024 corpus, measured

> **What this folder is:** the evidence behind the sweep's drawings — every PHB spell, every class and
> subclass feature, the options nothing grants, the DMG's own rows and the Monster Manual's traits, each
> with the mechanism families its text and structure trip, and whether `scripts/decide/registry.js`
> names it already. The evidence files are regenerated, never edited by hand; the verdicts live in
> [drawings/](drawings/) (SWEEP §6 holds Slice A's, the first drawing, from before this folder).
>
> **How:** `node tools/scan-corpus.mjs <corpus.json>` (live, read-only, ~12 min, the user out of the
> world) → `node tools/classify-corpus.mjs <corpus.json>` → `node tools/audit-corpus.mjs
> <corpus-classified.json>`. Last generated 2026-09-28 on the sandbox (dnd5e 6.0.5).

| File | What |
| --- | --- |
| [spells.md](spells.md) | the PHB spells — SWEEP §7 is the drawing |
| [spells-register.md](spells-register.md) | **the PHB spell register** — every spell: NATIVE / MODULE / TEXT / OUT, why not or how, the bends, the walk tier; `node tools/audit-spells-register.mjs <corpus.json>` from a spells-only scan, the registry, RULINGS and the drawing's *Register verdicts* |
| [classes/](classes/) | one file per class: the class's features, then each subclass — the order the user asked for (2026-09-28: class by class, all its subclasses, then the next) |
| [options.md](options.md) | invocations, metamagic, maneuvers, boons |
| [dm.md](dm.md) | the DMG's features and equipment |
| [dmg-register.md](dmg-register.md) | **the DMG register** — every DMG row (magic items, poisons, gifts, traps, hazards, siege weapons, the NPC traits): NATIVE / MODULE / WAITS / TEXT / OUT, the kind, the shape a waiting row lands on, why not or how; `node tools/audit-dmg-register.mjs <corpus.json>` from a DMG-only scan, the registry, RULINGS and the drawing's two hand tables |
| [monsters.md](monsters.md) | the Monster Manual's traits — Slice B's ground |
| [monsters-register.md](monsters-register.md) | **the Monster Manual register** — every trait, action and reaction: NATIVE / MODULE / WAITS / TEXT / OUT, the kind, the shape a waiting row lands on, why not or how, the bends, the GM's-side walk; `node tools/audit-monsters-register.mjs <corpus.json>` from a Monster-Manual-only scan, the registry, RULINGS and the drawing's *Register verdicts* (the 424 no-family rows read by hand there, 2026-09-28) |
| [drawings/](drawings/) | **the verdicts, by hand** — NATIVE / ROW / KIND / OUT per row with the precedent named: [spells](drawings/spells.md), [classes](drawings/classes.md), [the DMG](drawings/dm.md), [the monsters](drawings/monsters.md) |
