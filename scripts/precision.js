/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): Precision Attack, the `precision` fold (v1.19.0,
 * FLOW item 1) — the attacker's own missed attack, patched after the fact by a superiority die.
 * The machine-tier pass, Stage 4a (2026-09-05): split out of maneuvers.js by MOMENT — one
 * feature per file, the shared readers in lookup.js, the rules text in decide/registry.js. Every
 * body here is the one maneuvers.js carried; nothing was rewritten.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite, canAnswerFor, statContext } from "./core.js";
import { resolveUuid, usableManeuver, maneuverDieFormula } from "./lookup.js";
import { maneuverFoldEntries } from "./settings.js";
import { hitTargets, modeAllows } from "./shared.js";
import { bfCard, holdBarHTML, spendPhrase, rescueView, rescueSourceFor } from "./decide/present.js";
// The same four names d20-folds.js takes, for the same reason and off the same registry: a
// resolver that announces a verdict must compose it, and there is exactly one composition.
import { ATTACK_FOLDS, foldsFrom, foldedRoll, foldedVerdict } from "./decide/verdict.js";
import { momentButton, scheduleBarSync, armAskTimer, disarmAskTimer, registerRescue,
  syncRescuePopup } from "./ui.js";
// Safe statically (the saves.js:12 argument): the entry evaluates auto-damage.js before this
// file, so nothing here can reorder auto-damage's registrations. Re-checked with
// check-hook-order; do not move this file's entry position without re-running it.
import { offerDamageRoll, rollDamageForAttack } from "./auto-damage.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1.6 — the maneuver folds (FLOW item 1, built v1.19.0 after probes P1-P3; the walk's
 * findings grew the list: "interpose" and "bash" live as save-card CHOICES in saves.js off
 * lookup.js's readers, "hew" is hew.js, and the fold popups now route
 * player-first with the GM as fallback — canAnswerFor alone, no GM-quiet of their own).
 *
 * The folds, one list (`maneuverFolds`, and the LIST is the switch):
 *
 *   PRECISION ("your own attack missed"): the attacker's client stamps a `precision` flag on
 *   the missed attack message; the attacker is offered the maneuver (Use/Pass, the hold's
 *   clock); accepting really USES the maneuver activity (the superiority die is consumed by
 *   the system, never mimed — the castReaction honesty rule), rolls the die publicly, writes
 *   per-target verdicts through hitTargets' own override channel (the hold's channel with the
 *   arrow reversed — shared.js), announces the arithmetic, and re-drives the damage exactly
 *   as the hold's continuation does: the popup if the player owns their dice, the straight
 *   roll otherwise.
 *
 *   RIPOSTE ("an enemy's melee attack missed you"): the elect stamps a `riposte` flag on the
 *   ENEMY's attack message (the Graze miss-path template — createChatMessage, complement of
 *   hitTargets, read AS ROLLED so a later hold flip never re-opens it); each eligible reactor
 *   is offered it on their own client; accepting really uses the maneuver (consumes the pool;
 *   spends the reaction), then drives a REAL attack with the chosen melee weapon at the
 *   original attacker — through the ordinary pipeline, so the resolver, the riders, receipts
 *   and revert all treat it as any hand-rolled attack — with the superiority die pushed into
 *   its damage roll as an extra part (the hit-riders idiom, never a mutation).
 *
 * ⚠ THE FLAG NEVER TOUCHES `hold` — three measured hazards (2026-08-20 exploration): the
 * one-message-one-hold slot (hold.js:301), hitTargets treating ANY hold verdict as
 * authoritative truthiness, and hold.js being the tree's most fragile file. Own keys, own
 * popup namespaces, own timers. hold.js is imported for two exports and edited not at all.
 *
 * ⚠ RIPOSTE MUST NEVER RE-ENTER THE INTERRUPT LIST: the name alone re-arms three unrelated
 * behaviours there (the cast-is-the-answer matcher, reactionSpent's setter, the cast slice's
 * disqualifier) and the hold parser coerces unknown kinds to "ac" — the exact mis-wiring
 * v1.16.0 struck. This file's parser is STRICT for the same reason: unknown kinds drop with
 * a warning, never default.
 *
 * BOTH folds ride the RESOLVER (modeAllows — Graze's argument): their payoff is driven
 * damage, and with the resolver off there is no path for it that the table asked for.
 *
 * THE PER-ROLL RIDER RULING (recorded for Pass C, the volleys): a module-driven attack that
 * stamps the FLAT `flags.dnd5e.originatingMessage` key is a REAL attack — riders ride it
 * unchanged, because riderTargets' first branch resolves the chain. Riders ride attack ROLLS;
 * the all-targets-or-nothing intersection lives WITHIN one damage roll; N driven rolls are N
 * independent rider folds. Riposte is the shipped precedent.
 *
 * PRECISION'S SCOPE FENCE, deliberate: the offer fires only when the attack hit NOBODY. On a
 * mixed hit+miss multi-target swing the hits' damage already rolled (one roll serves every
 * target — standing item 1), and patching a miss in behind it would either double-apply to
 * the original hits or need per-target damage, the exact "much bigger change" that item
 * warns about. A clean miss is the whole table case (00:46, 01:14, 02:42, 03:01 — all
 * single-target).
 * ------------------------------------------------------------------------------------------- */

// v1.19.x finding ①: the folds carry NO GM-quiet of their own — canAnswerFor already routes
// player-first with the GM as fallback (an active owning player excludes the GM entirely), and
// the old extra `isGM && hasPlayerOwner` gate was mutually exclusive with it: with only the GM
// in the room, NOBODY got the popup. The user's ruling: the player's client gets the popup;
// the DM gets it when no owning player is connected.

/* =============================================================================================
 * PRECISION ATTACK
 * ========================================================================================== */

const precisionTimers = new Map();
const precisionInFlight = new Set();

/** Stamp: the roller's own client, on the attack message it authored. */
Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  try {
    if ( !subject || (subject.type !== "attack") ) return;
    const attacker = subject.actor;
    if ( !attacker || !modeAllows(attacker) ) return;
    const attackMessage = rolls?.[0]?.parent;
    if ( !(attackMessage instanceof ChatMessage) ) return;
    if ( attackMessage.getFlag(MODULE_ID, "precision") ) return;      // never re-stamp
    const roll = rolls[0];
    if ( roll.isFumble ) return;                                       // a natural 1 stands
    const entry = maneuverFoldEntries().find(e => e.kind === "precision");
    if ( !entry ) return;
    const found = usableManeuver(attacker, entry.name);
    const raw = found ? maneuverDieFormula(found.activity) : null;
    if ( !found || !raw ) return;
    /**
     * ⚠ RESOLVE THE DIE HERE, AGAINST THE ATTACKER — the bardic side's argument, in the second
     * costume it wears in this tree. The PHB's Precision Attack stores its die as
     * `@scale.battle-master.superiority.die`, a scale token off the subclass, and a token is
     * not a thing to show a human: the offer window printed the raw string at the table
     * (2026-08-24) where "1d8" belonged. Resolving it once, at OFFER time, means the die the
     * window NAMES is the die the resolver ROLLS — there is no second reading to disagree with.
     *
     * ⚠ AND AN UNRESOLVED TOKEN COLLAPSES TO ZERO WITHOUT A WORD, which is the same silent
     * failure the bardic die documents: `new Roll("@scale…", data)` yields "0" and total 0
     * against roll data that does not carry the scale. Offering a die that adds nothing would
     * spend a real superiority die for a guaranteed miss, so a formula with no dice left in it
     * is refused rather than shown.
     */
    const resolved = await new Roll(raw, attacker.getRollData()).evaluate();
    const dieFormula = resolved.formula;
    if ( !resolved.dice.length ) {
      console.warn(`${TITLE} | "${entry.name}" resolved to "${dieFormula}" for ${attacker.name} `
        + "— no die left in it, so the offer stays off rather than spending one for nothing.");
      return;
    }

    // Clean misses only (the scope fence above): resolvable ACs, every one of them missed.
    const snapshot = attackMessage.getFlag("dnd5e", "targets") ?? [];
    if ( !snapshot.length || hitTargets(attackMessage).length ) return;
    const judged = snapshot.filter(t => (t.ac !== null) && (t.ac !== undefined));
    if ( !judged.length ) return;                                      // null AC — humans have it

    // The hopeless gate, the hold's own semantics: when even a maximised die cannot reach
    // the nearest AC, don't stop the game to offer it. Rides holdSkipFutile + holdReveal
    // exactly as the hold does — with the math hidden, a gate that reveals it stays off.
    const margins = judged.map(t => ({ uuid: t.uuid, name: t.name, ac: t.ac, margin: t.ac - roll.total }));
    if ( setting(S.holdSkipFutile) && setting(S.holdReveal) ) {
      const dieMax = (await new Roll(dieFormula, attacker.getRollData()).evaluate({ maximize: true })).total;
      if ( Math.min(...margins.map(m => m.margin)) > dieMax ) return;
    }

    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await attackMessage.setFlag(MODULE_ID, "precision", {
      status: "pending",
      itemId: found.item.id, activityId: found.activity.id,
      itemName: found.item.name, itemImg: found.item.img,
      attackerUuid: attacker.uuid, attackTotal: roll.total, dieFormula,
      answer: null,
      ...statContext(attacker.uuid), // the data-plane stamp
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
      targets: margins.map(m => ({ ...m, verdict: null }))
    });
    armPrecisionTimer(attackMessage);
  } catch(err) {
    console.error(`${TITLE} | Precision stamp failed.`, err);
  }
});

const armPrecisionTimer = message =>
  armAskTimer(precisionTimers, message, "precision", live => answerPrecision(live, "pass", { timedOut: true }));

/** One answer, first writer wins — serialized through the flag lock, then executed. */
async function answerPrecision(message, answer, { timedOut = false } = {}) {
  let claimed = false;
  let withdrawn = false;
  await queueFlagWrite(message, "precision", current => {
    if ( (current.status !== "pending") || current.answer ) return;
    /**
     * ⚠ THE SPEND-GUARD, INSIDE THE LOCK (§11 / D3). Precision only ever offers on an attack
     * that hit NOBODY, so any sibling fold turning it into a hit kills the premise — and this
     * resolver used to `activity.use()` first and compose afterwards, which spends a real
     * superiority die on a target that is already hit. `hitTargets` is the registry walk every
     * other reader goes through, so the question is answered the same way here as everywhere.
     */
    if ( (answer === "use") && hitTargets(message).length ) {
      current.status = "resolved";
      current.outcome = "no longer needed";
      withdrawn = true;
      return;
    }
    current.answer = answer;
    current.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)
    if ( timedOut ) current.timedOut = true;
    if ( answer !== "use" ) {
      current.status = "resolved";
      current.outcome = timedOut ? "passed (timer)" : "passed";
    }
    claimed = true;
  });
  if ( withdrawn ) {
    disarmAskTimer(precisionTimers, message.id);
    return;
  }
  if ( !claimed || (answer !== "use") ) return;
  await resolvePrecision(message);
}

/** The accept path: use the maneuver, roll the die, verdict, announce, re-drive. */
async function resolvePrecision(message) {
  if ( precisionInFlight.has(message.id) ) return;
  precisionInFlight.add(message.id);   // before the first await — the continueHold discipline
  try {
    const flag = message.getFlag(MODULE_ID, "precision");
    if ( !flag || (flag.answer !== "use") || (flag.status !== "pending") ) return;
    const attacker = await fromUuid(flag.attackerUuid);
    const item = attacker?.items?.get(flag.itemId);
    const activity = item?.system.activities?.get?.(flag.activityId)
      ?? item?.system.activities?.contents?.find(a => a.id === flag.activityId);
    if ( !(attacker instanceof Actor) || !activity ) return;

    // ⚠ AND AGAIN HERE, for `resolvePrecision`'s second caller: the elect's crash-resume
    // picks up an accepted answer whose client died, up to twenty seconds later, and the roll
    // can have been fixed in between. Spending then would be the wasted-spend trap arriving by
    // the back door.
    if ( hitTargets(message).length ) {
      await queueFlagWrite(message, "precision", current => {
        if ( current.status !== "pending" ) return false;
        current.status = "resolved";
        current.outcome = "no longer needed";
      });
      return;
    }

    // 1. REALLY use it — the system consumes the pool (P2: use() consumes, posts a card,
    //    rolls nothing). Recording "used" without using shipped a lie once (ui.js:407);
    //    never again.
    await activity.use({ subsequentActions: false }, { configure: false }, {
      data: { flags: { dnd5e: { originatingMessage: message.id } } }
    });

    // 2. The die, public, from the item's own formula — provenance-stamped so no other
    //    recognizer (topple's bare-roll fold, the save machine) can claim it.
    const dieRoll = new Roll(flag.dieFormula, attacker.getRollData());
    await dieRoll.evaluate();
    await dieRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: `${flag.itemName} — the superiority die`,
      flags: { [MODULE_ID]: { respondsTo: message.id } }
    });
    const die = dieRoll.total;

    // 3. Verdicts, COMPOSED across every fold on this message — not against this die alone.
    //
    // ⚠ THE 2026-08-23 RULING, THE OTHER HALF OF IT. d20-folds.js has obeyed "compose ONCE,
    // through the path every other reader uses" since v1.23.0; this resolver did not, and went
    // on adding its die to `flag.attackTotal` — the number the d20 showed before anything was
    // spent. A Battle Master holding a Bardic die is stamped by BOTH machines on ONE missed
    // attack, so the gap was reachable in one order (fold spends first, precision second) and
    // invisible in the other. Measured, not argued: `smoke-d20-folds` §6 drove 10 → +3 bardic
    // → +6 superiority against AC 18 and this block announced "10 + 6 = 16 — still misses"
    // while `hitTargets`, walking the same registry, had the target at 19 and HIT. That is the
    // "card disagrees with its own arithmetic" class for the third time, and the third time it
    // was the same cause: a resolver reaching for its own numbers instead of the registry.
    //
    // ⚠ THE PENDING FLAG IS SUBSTITUTED INTO THE READ, exactly as `resolveFold` does. This die
    // is not on the message yet — the write below is what puts it there — so a plain
    // `getFlag` walk would compose everything EXCEPT the spend being resolved.
    const pending = { ...flag, status: "resolved", outcome: "used", die };
    const folds = precisionFolds(message, pending);
    const baseRoll = precisionBase(message, flag);

    // Graze conflict named, never unwound.
    const lines = [];
    let anyHit = false;
    await queueFlagWrite(message, "precision", current => {
      current.status = "resolved";
      current.outcome = "used";
      current.die = die;
      for ( const t of current.targets ?? [] ) {
        // ⚠ PER TARGET, not once for the message. An attack is ONE roll judged against MANY
        // targets, so the registry holds a contribution per (target × spend) — summing all of
        // them would count every die once per target and announce a number nobody rolled.
        // `foldedVerdict` filters by uuid for exactly this reason; the sentence must match it.
        const mine = folds.filter(f => f.uuid === t.uuid);
        const composed = foldedRoll(baseRoll, mine);
        t.verdict = foldedVerdict(t, baseRoll, folds);
        if ( t.verdict === "hit" ) anyHit = true;
        // A defender's fold can have moved the number being tested against (a Shield), so the
        // AC printed is the composed one — the stale-AC trap, in the prose this time.
        const ac = mine.findLast(f => Number.isFinite(f.ac))?.ac ?? t.ac;
        const sum = composed.replaced
          ? `${current.attackTotal} → ${composed.total}`
          : `${current.attackTotal} + ${composed.added} = ${composed.total}`;
        lines.push(`${sum} vs AC ${ac} — `
          + (t.verdict === "hit" ? `<strong>now hits ${t.name}</strong>` : `still misses ${t.name}`));
      }
    });
    // Graze already paid on this miss? Say so — the ruling is announce, no unwind (the
    // symmetric twin of Graze's own "reads the attack as rolled" no-reopen).
    if ( (message.getFlag("dnd5e", "roll.mastery") === "graze")
      && message.getFlag(MODULE_ID, "receipt")?.targets?.length ) {
      lines.push("⚠ Graze already paid on the miss — revert its receipt if you rule it void.");
    }
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: bfCard({
        img: flag.itemImg, eyebrow: `Maneuver — ${flag.itemName}`,
        tone: anyHit ? "good" : "neutral",
        title: anyHit ? `${flag.itemName} — the miss becomes a hit` : `${flag.itemName} — still a miss`,
        subtitle: spendPhrase([]),   // the usage card the use posted carries the count (resources.js)
        lines
      })
    });

    // 4. The re-drive — the hold continuation's template: hitTargets re-run (it now reads
    //    the verdicts), the player's own dice honoured, the straight roll otherwise.
    if ( !anyHit || !hitTargets(message).length ) return;
    const attackActivity = await fromUuid(message.getFlag("dnd5e", "activity")?.uuid);
    if ( !attackActivity ) return;
    if ( setting(S.playerRollDamage) ) return void offerDamageRoll(attackActivity, message);
    await rollDamageForAttack(attackActivity, message);
  } catch(err) {
    console.error(`${TITLE} | Precision resolution failed.`, err);
  } finally {
    precisionInFlight.delete(message.id);
  }
}

/**
 * THE FOLD CONTRIBUTIONS THIS ATTACK CARRIES, from precision's point of view — one home, so the
 * resolver and the window can never announce different numbers. `pending` substitutes the spend
 * being resolved, which is not on the message yet.
 *
 * ⚠ ONE TARGET'S SLICE. An attack is ONE roll judged against MANY targets, so the registry holds
 * a contribution per (target × spend); summing the lot counts every die once per target. See
 * d20-folds.js's own copy of this argument — both resolvers learned it the same week.
 */
const precisionFolds = (message, flag) => foldsFrom(
  key => ((key === "precision") ? flag : message.getFlag(MODULE_ID, key)), ATTACK_FOLDS)
  .filter(f => f.uuid === flag?.targets?.[0]?.uuid);

/** The roll the folds compose over — the real d20 where there is one, the stamp's copy otherwise. */
const precisionBase = (message, flag) => message.rolls?.[0] ?? { total: flag?.attackTotal };

/**
 * PRECISION AS A RESCUE ROW (the merged window, ARCHITECTURE §5).
 *
 * ⚠ THIS MACHINE NO LONGER OPENS A POPUP OF ITS OWN. A Battle Master holding a Bardic die is
 * stamped by BOTH fold machines on one missed attack, and two windows for one decision is the
 * discombobulation this pass exists to end. The spine draws ONE window from every registered
 * source; this file hands it a key and four callbacks and never learns that d20-folds.js exists.
 *
 * ⚠ THE CARD IS UNCHANGED — pairing law 2. The durable row, its bar and its Answer button all
 * stay exactly where they were; what moved is only which window the Answer button opens.
 */
registerRescue("precision", {
  isPending: message => message.getFlag(MODULE_ID, "precision")?.status === "pending",
  subject: message => {
    const uuid = message.getFlag(MODULE_ID, "precision")?.attackerUuid;
    return resolveUuid(uuid);
  },
  /**
   * ⚠ COMPOSED HERE, NOT IN THE SPINE, and that is the §4.1 line: composing needs `foldsFrom`
   * over a real message and the reveal SETTING, and ui.js reads no world setting and imports no
   * machine. Each machine hands over a finished slice; the spine only concatenates.
   */
  view: message => {
    const flag = message.getFlag(MODULE_ID, "precision");
    if ( !flag ) return null;
    return rescueView(key => ((key === "precision") ? flag : null), {
      composed: foldedRoll(precisionBase(message, flag), precisionFolds(message, flag)),
      reveal: setting(S.holdReveal),
      sources: rescueSourceFor("precision")
    });
  },
  // The answer path is untouched: first-writer-wins, the crash-resume horizon, the in-flight
  // latch. `use` is the row; `pass` is the footer, and the spine sends it to every source.
  answer: (message, action) => answerPrecision(message, (action === "use") ? "use" : "pass")
});

/**
 * THE MOOT (user ruling, 2026-08-24): a sibling spend fixed the roll, so this offer withdraws.
 *
 * ⚠ IT SPENDS NOTHING, so it takes no decision away from anyone — and presentation law 4 makes
 * the withdrawal compulsory rather than polite: a window still asking "the attack missed" after
 * the attack has started hitting is a lie on screen, and a click on it burns a real superiority
 * die for a target that is already hit. The table met exactly that on the 2026-08-24 walk: a
 * heroic reroll turned 14 into 18 against AC 15, the header read "hits Practice Dummy", and the
 * window went on offering Precision Attack underneath it.
 *
 * ⚠ ELECT-OWNED, single writer (§3). Every client sees the same update and would otherwise race
 * to write the same withdrawal; the flag lock would serialise them, but the second write would
 * still be a lie about who decided. `hitTargets` is the registry walk every other reader goes
 * through, so "is the premise dead" is answered exactly once in this tree.
 */
async function mootPrecision(message) {
  await queueFlagWrite(message, "precision", current => {
    if ( (current.status !== "pending") || current.answer ) return false;   // someone answered
    current.status = "resolved";
    current.outcome = "no longer needed";
  });
  disarmAskTimer(precisionTimers, message.id);
}

/* =============================================================================================
 * THE ROW, THE WATCHER, THE CLEANUP — maneuvers.js's shared plumbing, this fold's slice of it.
 * ========================================================================================== */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  // --- Precision: one row on the attack card ------------------------------------------------
  const p = message.getFlag(MODULE_ID, "precision");
  if ( p ) {
    const row = document.createElement("div");
    row.className = "battleflow-maneuver";
    const pending = p.status === "pending";
    row.innerHTML = bfCard({
      img: p.itemImg, eyebrow: `Maneuver — ${p.itemName}`,
      tone: pending ? "pending" : (p.outcome === "used" ? "good" : "neutral"),
      // Source, then result (finding ⑦ — the walk's global wording rule).
      title: pending ? `${p.itemName} — offered: the attack missed`
        : (p.outcome === "used"
          ? `${p.itemName} — used${(p.targets ?? []).some(t => t.verdict === "hit") ? ", now hits" : ", still misses"}`
          : (p.outcome === "no longer needed")
            ? `${p.itemName} — no longer needed; nothing spent`
            : `${p.itemName} — passed${p.timedOut ? " (timer)" : ""}`),
      subtitle: (p.targets ?? []).map(t => t.name).join(", ")
    }) + (pending ? holdBarHTML(p, "to answer") : "");
    html.querySelector(".message-content")?.appendChild(row);
    if ( pending ) {
      scheduleBarSync(row);
      armPrecisionTimer(message);
      const attacker = resolveUuid(p.attackerUuid);
      if ( canAnswerFor(attacker) && !p.answer ) {
        // ⚠ ONE CALL FOR BOTH JOBS. The spine owns the latch now (the content signature), so
        // the auto-show and the redraw are the same request; the recall flag is what tells it
        // a HUMAN asked, which is allowed past a window they closed themselves.
        syncRescuePopup(message);
        row.appendChild(momentButton("Answer", () => {
          syncRescuePopup(message, { recall: true });
        }, { margin: "0.25rem 0 0" }));
      }
      // Crash-resume, elect-owned with the topple's 20s horizon: an ACCEPTED answer whose
      // executing client died sits answer="use", still pending. The normal path resolves on
      // the answering client the instant the claim lands; the elect only picks up stale
      // wrecks, so the two can never run the use() twice (resolvePrecision re-checks status
      // and holds an in-flight latch).
      if ( (p.answer === "use") && isActiveGM() && p.answeredAt
        && (Date.now() - p.answeredAt > 20_000) ) void resolvePrecision(message);
    }
  }
});

// Every client closes answered popups; the timers disarm when nothing is pending.
Hooks.on("updateChatMessage", message => {
  const p = message.getFlag(MODULE_ID, "precision");
  if ( p ) {
    // ⚠ THE PREMISE IS RE-DERIVED FROM THE COMPOSED ROLL, every update. Precision stamps only
    // when the attack hit NOBODY; the moment any sibling fold turns that into a hit, the
    // premise this offer rests on is gone and the offer goes with it.
    if ( (p.status === "pending") && !p.answer && isActiveGM() && hitTargets(message).length ) {
      void mootPrecision(message);
    }
    // ⚠ SYNC, DO NOT CLOSE. Precision no longer owns a window — it owns ROWS in one, shared
    // with whatever else is trying to rescue the same roll. Closing on this flag alone would
    // take a SIBLING's live offer off the screen because THIS one finished. The spine closes
    // the window when nothing is left asking, and redraws it with this row greyed otherwise.
    if ( (p.status !== "pending") || p.answer ) syncRescuePopup(message);
    if ( p.status !== "pending" ) disarmAskTimer(precisionTimers, message.id);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clock disarms here.
Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(precisionTimers, message.id);
});
