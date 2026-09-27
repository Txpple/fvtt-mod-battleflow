/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the saving throws — demand, roll, verdict,
 * consequences. ONE machine on ONE `saves` flag, a DIRECTORY with one part per spine step and
 * THIS file its only public face: the entry imports it, it exports nothing, and the layer checker
 * fails any outside import of a part.
 *
 * ⚠ THE IMPORT LIST BELOW IS LOAD-BEARING: the parts register hooks as they evaluate, so this order
 * is the registration order. verdict.js is listed BEFORE ask.js although ask's dialog hook must
 * register FIRST — the two are an import cycle, and ESM evaluates a cycle's first-listed member
 * LAST. Cross-part symbols are hoisted `function` declarations called at hook time (§7), which is
 * the only reason the cycles are safe.
 */

/* ---------------------------------------------------------------------------------------------
 * The flow: the casting client stamps a `saves` demand on the save activity's usage card (the
 * bus); each target's save runs on the client that owns the decision (canAnswerFor) as a popup
 * wearing the native roll dialog's controls — the player presses it (a per-player client setting
 * opts out to a silent roll). The roll answers the demand (`respondsTo`), the elect folds the
 * verdict against the DC STORED AT CAST TIME, and per target the consequences apply through the
 * shared appliers: effects on a failure (honouring each effect's own `onSave`), damage at ×1 on a
 * failure or the activity's `damage.onSave` word on a success. Receipts and reverts everywhere.
 *
 * The buzzer ROLLS — a demanded save is mandatory: at the deadline the elect rolls every
 * unanswered target straight. Legendary resistance flips `system.resisted` as a later UPDATE, so
 * the elect watches for it and OVERTURNS the verdict, receipt-exact.
 *
 * Native interplay: the card's own ability buttons roll for SELECTED tokens but chain to the card,
 * so the fold reads them; a bare sheet roll answers the oldest pending demand for that actor
 * (deferring to a pending concentration ask). Corners:
 *  - A multi-ability save ("Str or Dex") auto-rolls the FIRST listed ability; the fold accepts any.
 *  - A consumed item (a scroll's last use) strands its effects: a late verdict applies damage only.
 *  - ⚠ DEAD targets are skipped at the stamp — dead status, or an NPC at 0 HP — deliberately
 *    narrower than mastery's hp<=0: a DYING PC must still be demanded and take the damage. A cast
 *    whose every target is dead stamps nothing: fully native.
 *  - The deadline is on the caster's clock, the buzzer on the elect's: skew moves the buzzer,
 *    never the verdict (it re-checks state before acting).
 * ------------------------------------------------------------------------------------------- */

import "./demand.js";        // the stamp on the usage card, the dead-target gate, the emanation reach
import "./areas.js";         // template adoption, the bare-template claim, the spent-area sweep
import "./verdict.js";       // ⚠ before ask.js — see the header; the fold, the verdict line, LR
import "./ask.js";           // the system dialog with the demand fieldset, the straight roll, the buzzer
import "./consequences.js";  // effects per outcome, the status press, damage reconcile
import "./choices.js";       // Interpose and the bash, on the same `saves` flag
import "./views.js";         // the card row and the create / update / delete watchers
