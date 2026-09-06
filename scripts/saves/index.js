/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the saving throws — Phase 2, joint with Phase 3's
 * save slice: demand, roll, verdict, consequences. ONE machine on ONE `saves` flag whose
 * lifecycle outgrew a file, so it is a DIRECTORY (the machine-tier pass, Stage 4c, 2026-09-05,
 * ruling 3): one part per spine step, the parts importing each other freely, and THIS file the
 * machine's only public face — the entry imports it and nothing else in here, it exports
 * nothing, and the layer checker fails any outside import of a part ("import the index").
 *
 * ⚠ THE IMPORT LIST BELOW IS LOAD-BEARING. The parts register their hooks as they evaluate, so
 * this order is the registration order — the one saves.js had, proven by the snapshot.
 * ⚠ verdict.js is listed BEFORE ask.js although ask's dialog hook must register FIRST: the two
 * are an import cycle (the buzzer in ask.js folds; the fold in verdict.js disarms ask's clock),
 * and ESM evaluates a cycle's first-listed member LAST — its dependency's body runs first. Listing
 * verdict first is what lands ask's renderRollConfigurationDialog where saves.js had it, ahead
 * of the verdict line's twin watcher. Cross-part symbols are hoisted `function` declarations
 * called at hook time (§7) — the only reason the cycles in here are safe.
 */

/* ---------------------------------------------------------------------------------------------
 * Phase 2 — saving throws (ARCHITECTURE.md §6), shipping WITH Phase 3's save slice: a save's
 * consequences ARE the feature, so failed-save effects and half-on-save damage ride the shared
 * appliers in this same machine.
 *
 * The machine is Phase 2.5 generalized per target — deliberately nothing new: the casting
 * client stamps a `saves` demand on the save activity's own usage card (the card was already
 * load-bearing; now it is the bus); each targeted creature gets the save run on the client
 * that owns the decision (canAnswerFor — the concentration ask's election), as a POPUP wearing
 * the native roll dialog's controls (situational bonus, Advantage/Normal/Disadvantage, default
 * hinted from actor data) — deliberately NOT midi-qol's silent roll-and-apply: the save is a
 * table moment and the player presses it (user call, 2026-08-16). A per-player client setting
 * opts out to a silent data-driven roll. The roll message answers the demand (respondsTo — the
 * hold's channel, the concentration fold's meaning), the elect folds the verdict against the
 * DC STORED AT CAST TIME (the ask's-DC rule), and per target — independent, nobody waits on
 * anyone else's dice — the consequences apply: the activity's effects on a failure (honoring
 * each effect's own `onSave` "applies even on save" flag, data the system carries but nothing
 * native consults at 5.3.3), and the card's damage roll at ×1 on a failure or the activity's
 * own `damage.onSave` word on a success (half → the applier's threaded multiplier; none →
 * nothing at all). Receipts and reverts everywhere, through the same two appliers everything
 * else uses.
 *
 * The buzzer ROLLS (a demanded save is mandatory — the concentration timer's rule, not the
 * hold's): at the deadline the elect rolls every still-unanswered target straight,
 * data-driven. Legendary resistance is the one late answer: resistSave flips
 * `flags.dnd5e.roll.forceSuccess` onto the save message as an UPDATE after the failure
 * landed, so the elect watches for it and OVERTURNS the verdict — un-applying what the
 * failure applied (receipt-exact) and re-applying what a success grants. That closes the
 * corner Phase 2.5 accepted.
 *
 * Native interplay, kept deliberately: the save card's own per-ability buttons still work —
 * they roll for whatever tokens are SELECTED (getSceneTargets — the topple enricher's trap,
 * which is exactly why the popup aims at the right actor by construction) but they chain to
 * the card, so the fold reads them; a bare sheet roll answers the oldest pending demand for
 * that actor (deferring to a pending concentration ask, whose recognizer this cannot be told
 * apart from). No card is ever suppressed since v1.10.0 — the demand's card is always the
 * native one — and no other applier touches this chain: auto-apply's walk requires an
 * attack, and the v1.6.0 spellDamage claim requires a bare damage activity.
 *
 * Corners, accepted and recorded:
 *  - A multi-ability save ("Str or Dex") auto-rolls the FIRST listed ability; the popup rolls
 *    it too. A target who wants the other ability rolls it from the sheet or the native
 *    button — the fold accepts any listed ability.
 *  - A consumed item (a scroll's last use) can strand its effects: they live on the item
 *    document, so once it is gone a late verdict applies damage but not effects.
 *  - ⚠ DEAD targets are SKIPPED at the stamp since v1.19.0 — a USER CALL (2026-08-20)
 *    deliberately REVERSING the earlier recorded corner ("dead targets still roll"). The
 *    predicate is deliberately NARROWER than mastery's plain hp<=0: dead status, or an NPC
 *    at 0 HP — because a DYING PC (0 HP, death saves ahead) must still be demanded, take the
 *    area's damage, and eat the failure. Unconscious-with-HP targets still roll; RAW Str/Dex
 *    auto-failure while unconscious stays a condition-layer rule (Phase 5). A cast whose
 *    every target is dead stamps NOTHING — no demand, no auto-roll, no caster damage offer:
 *    fully native.
 *  - The demand's deadline is stamped on the casting client's clock and the buzzer runs on
 *    the elect's; a couple of seconds of skew moves the buzzer, never the verdict (it
 *    re-checks state before acting).
 * ------------------------------------------------------------------------------------------- */

import "./demand.js";        // the stamp on the usage card, the dead-target gate, the emanation reach
import "./areas.js";         // template adoption, the bare-template claim, the spent-area sweep
import "./verdict.js";       // ⚠ before ask.js — see the header; the fold, the verdict line, LR
import "./ask.js";           // the system dialog with the demand fieldset, the straight roll, the buzzer
import "./consequences.js";  // effects per outcome, the status press, damage reconcile
import "./choices.js";       // Interpose and the bash, on the same `saves` flag
import "./views.js";         // the card row and the create / update / delete watchers
