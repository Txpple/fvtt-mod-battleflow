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
| [classes-register.md](classes-register.md) | **the PHB classes register** — every class feature, subclass feature and option: NATIVE / MODULE / ROW / TABLE / KIND / TEXT / OUT / WAITS, the precedent named, the Session 0 stage, why not or how, the bends; `node tools/audit-classes-register.mjs [--plan audits/plans/session-0-classes.md]` — OFFLINE, from the measured class files above, the registry, RULINGS and the drawing's *Register verdicts* (2026-09-29) |
| [plans/](plans/) | **the plans** — [session-0-classes.md](plans/session-0-classes.md): the PHB classes for Session 0 (2026-09-29, planning only): the summary, the register inline, the stages with machines, keys, suites and walk tables, the questions for the user, the risks; [dmg-build.md](plans/dmg-build.md): the DMG's rules chapters scanned and the order of the DMG work (2026-10-01); [splat-books.md](plans/splat-books.md): the three splat books' prework — numbers, what fires already, hazards, the work by shape, the order, the questions (2026-10-01) |
| [dm.md](dm.md) | the DMG's features and equipment |
| [dmg-register.md](dmg-register.md) | **the DMG register** — every DMG row (magic items, poisons, gifts, traps, hazards, siege weapons, the NPC traits): NATIVE / MODULE / WAITS / TEXT / OUT, the kind, the shape a waiting row lands on, why not or how; `node tools/audit-dmg-register.mjs <corpus.json>` from a DMG-only scan, the registry, RULINGS and the drawing's two hand tables |
| [monsters.md](monsters.md) | the Monster Manual's traits — Slice B's ground |
| [monsters-register.md](monsters-register.md) | **the Monster Manual register** — every trait, action and reaction: NATIVE / MODULE / WAITS / TEXT / OUT, the kind, the shape a waiting row lands on, why not or how, the bends, the GM's-side walk; `node tools/audit-monsters-register.mjs <corpus.json>` from a Monster-Manual-only scan, the registry, RULINGS and the drawing's *Register verdicts* (the 424 no-family rows read by hand there, 2026-09-28) |
| [splat/](splat/) | **the splat books, measured OFFLINE** (2026-10-01): [arcana-unleashed.md](splat/arcana-unleashed.md), [heroes-faerun.md](splat/heroes-faerun.md), [ravenloft.md](splat/ravenloft.md) — species, each subclass, the options, feats, spells, items and the bestiary per book, with families, structure and the registry names; `tools/scan-corpus-offline.mjs` → `tools/classify-corpus.mjs` → `tools/audit-splat-books.mjs`; the plan is [plans/splat-books.md](plans/splat-books.md) |
| [drawings/](drawings/) | **the verdicts, by hand** — NATIVE / ROW / KIND / OUT per row with the precedent named: [spells](drawings/spells.md), [classes](drawings/classes.md), [the DMG](drawings/dm.md), [the monsters](drawings/monsters.md) |
