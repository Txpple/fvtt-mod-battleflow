/**
 * Battle Flow — Phase 1.6 (v1.19.0): the maneuver folds. Precision Attack patches a declared
 * miss after the fact; Riposte answers an enemy's melee miss with a real attack. FLOW item 1.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite,
  canAnswerFor, inRunningCombat, combatStamp, statContext } from "./core.js";
import { maneuverFoldEntries } from "./settings.js";
import { hitTargets, modeAllows } from "./shared.js";
import { popupKey, bfCard, holdBarHTML, momentBarHTML, ruleLine, RESCUE_KINDS,
  rescueView, rescueSourceFor } from "./decide/present.js";
// The same four names d20-folds.js takes, for the same reason and off the same registry: a
// resolver that announces a verdict must compose it, and there is exactly one composition.
import { ATTACK_FOLDS, foldsFrom, foldedRoll, foldedVerdict } from "./decide/verdict.js";
import { livePopups, openMomentPopup,
  momentButton, scheduleBarSync, shownMoments, acknowledgeMoment, momentAcknowledged,
  armAskTimer, disarmAskTimer, armDeadline, disarmDeadline, registerRelay,
  registerRescue, syncRescuePopup } from "./ui.js";
// Safe statically (the saves.js:12 argument): the entry evaluates auto-damage.js at :90 and
// this file at :97, so nothing here can reorder auto-damage's registrations. Re-checked with
// check-hook-order; do not move this file's entry position without re-running it.
import { offerDamageRoll, rollDamageForAttack } from "./auto-damage.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1.6 — the maneuver folds (FLOW item 1, built v1.19.0 after probes P1-P3; the walk's
 * findings grew the list: "interpose" and "bash" live as save-card CHOICES in saves.js off
 * this file's helpers, "hew" is the reminder block below, and the fold popups now route
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

/* --- the list: strict parse, the list is the switch ---------------------------------------- */



/** Walk-5 (z): the rule line every popup quotes — the 2024 text VERBATIM, read off this
 * world's own PHB compendium items 2026-08-21 (punctuation included; the source mixes curly
 * and straight apostrophes). The popups keep the module's operational hints as separate
 * lines; these strings are the rules and must never be paraphrased. Keyed by KIND — the
 * folds list maps items onto kinds, and each kind's mechanics are these features'. */
export const RULE_TEXT = {
  // ⚠ PRECISION'S QUOTE LIVES IN `RESCUE_KINDS` (decide/present.js) AND IS READ FROM THERE.
  // It is the one kind in this table that is also a RESCUE — the merged window draws it into
  // its own quote pane — and law 8 says the quote IS the rule, so a second copy that drifts is
  // the module telling the table something untrue. Every other kind here is this machine's
  // alone and stays put.
  precision: RESCUE_KINDS.precision.rule,
  riposte: "When a creature misses you with a melee attack roll, you can take a Reaction and expend one Superiority Die to make a melee attack roll with a weapon or an Unarmed Strike against the creature. If you hit, add the Superiority Die to the attack's damage.",
  bash: "If you attack a creature within 5 feet of you as part of the Attack action and hit with a Melee weapon, you can immediately bash the target with your Shield if it’s equipped, forcing the target to make a Strength saving throw (DC 8 plus your Strength modifier and Proficiency Bonus). On a failed save, you either push the target 5 feet from you or cause it to have the Prone condition (your choice). You can use this benefit only once on each of your turns.",
  bashChoice: "On a failed save, you either push the target 5 feet from you or cause it to have the Prone condition (your choice).",
  interpose: "If you’re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you can take a Reaction to take no damage if you succeed on the saving throw and are holding a Shield.",
  hew: "Immediately after you score a Critical Hit with a Melee weapon or reduce a creature to 0 Hit Points with one, you can make one attack with the same weapon as a Bonus Action."
};

/**
 * The listed folds, `{ name, kind }`. ⚠ This used to be the module's ONLY warn-once list read,
 * hand-rolled here with its own seen-set; Phase 3 moved the read and the warning to the one
 * path in settings.js, where the other four lists now join it. The re-export keeps this
 * module's own vocabulary — a caller here asks maneuvers.js what the folds are.
 */
export const maneuverEntries = maneuverFoldEntries;

/**
 * The folds entry of `kind` this actor actually carries — the listed item, by name. The
 * pool-drawing kinds (precision/riposte) still go through usableManeuver for consumption;
 * interpose/bash/hew have no pool of their own, so the item's PRESENCE is the capability
 * and everything past that (shield in hand, verdict, melee) belongs to the caller.
 */
export function foldEntryFor(actor, kind) {
  for ( const entry of maneuverEntries() ) {
    if ( entry.kind !== kind ) continue;
    const item = actor?.items?.find(i => i.name.toLowerCase() === entry.name.toLowerCase());
    if ( item ) return { entry, item };
  }
  return null;
}

/** An equipped shield — Interpose's "holding a Shield" clause, read off the sheet. */
export const equippedShield = actor =>
  !!actor?.itemTypes?.equipment?.some(i => (i.system.type?.value === "shield") && i.system.equipped);

/**
 * The actor's usable copy of a listed maneuver: the item by name (case-insensitive), its
 * first activity, and the consumption check — every itemUses consumption target must have a
 * use left (Precision/Riposte both draw on the Combat Superiority pool, measured by probe
 * P2). An activity with no consumption is simply usable.
 */
function usableManeuver(actor, name) {
  const item = actor?.items?.find(i => i.name.toLowerCase() === name.toLowerCase());
  const activity = item?.system.activities?.contents?.[0];
  if ( !activity ) return null;
  for ( const c of (activity.consumption?.targets ?? []) ) {
    if ( c.type !== "itemUses" ) continue;
    const pool = c.target ? actor.items.get(c.target) : item;
    if ( ((pool?.system.uses?.value ?? 0) <= 0) ) return null;
  }
  return { item, activity };
}

/** The die formula behind a maneuver — read from the item's own data, never typed anywhere:
 * a utility activity's roll formula (Precision) or a damage activity's first part (Riposte). */
function maneuverDieFormula(activity) {
  return activity.roll?.formula
    || activity.damage?.parts?.[0]?.formula
    || null;
}

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
    const entry = maneuverEntries().find(e => e.kind === "precision");
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
        subtitle: `${attacker.name} spends a superiority die`,
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
    try { return uuid ? fromUuidSync(uuid) : null; } catch { return null; }
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

/* =============================================================================================
 * RIPOSTE
 * ========================================================================================== */

const riposteTimers = new Map();
const riposteInFlight = new Set();

/** One-shot armed dice for the injection below: reactor uuid → {formula, type, armedAt}. */
const riposteDie = new Map();
const RIPOSTE_DIE_TTL_MS = 60_000;

/** The reactor's melee options — every melee weapon CARRIED, not just equipped (v1.19.x
 * finding (i)): 2024's weapon-swap rides any attack, so equipped-state bookkeeping must
 * not hide the greatsword or eat the offer. Equipped first, stowed ones say so, and the
 * sheet is never mutated — the resolved card names what swung; the bookkeeping stays
 * human. (P3: the discriminator is activity.attack.type.value.) */
function meleeOptions(actor) {
  const out = [];
  for ( const item of actor.items.filter(i => i.type === "weapon") ) {
    for ( const a of (item.system.activities?.contents ?? []) ) {
      if ( (a.type === "attack") && (a.attack?.type?.value === "melee") )
        out.push({ itemId: item.id, activityId: a.id, name: item.name,
          equipped: !!item.system.equipped,
          label: item.name + (item.system.equipped ? "" : " (stowed)") });
    }
  }
  out.sort((a, b) => Number(b.equipped) - Number(a.equipped));
  return out;
}

/** The weapon this reactor last ATTACKED with, off the log (v1.19.x finding ④ — the walk's
 * "how is the weapon picked?"): newest attack message by this actor whose activity names an
 * item still among the options. Inventory order was the old default and told nobody anything. */
function preferredMeleeOption(actor, options) {
  if ( options.length <= 1 ) return options[0] ?? null;
  const mine = game.messages.contents.slice(-100).reverse().filter(m =>
    (m.getFlag("dnd5e", "roll.type") === "attack") && (m.getAssociatedActor?.()?.uuid === actor.uuid));
  for ( const m of mine ) {
    const itemId = m.getFlag("dnd5e", "activity")?.uuid?.match(/\.Item\.([^.]+)\./)?.[1] ?? null;
    const match = itemId ? options.find(o => o.itemId === itemId) : null;
    if ( match ) return match;
  }
  return options[0];
}

/** Stamp: the elect, on the ENEMY's attack message — the Graze miss-path template. */
Hooks.on("createChatMessage", async message => {
  try {
    if ( !isActiveGM() ) return;
    if ( message.getFlag("dnd5e", "roll.type") !== "attack" ) return;
    if ( message.getFlag(MODULE_ID, "riposte") ) return;               // never re-stamp
    if ( message.getFlag(MODULE_ID, "riposteFor") ) return;            // a driven attack never chains re-offers
    const entry = maneuverEntries().find(e => e.kind === "riposte");
    if ( !entry ) return;
    const activityUuid = message.getFlag("dnd5e", "activity")?.uuid;
    const attackActivity = activityUuid ? await fromUuid(activityUuid) : null;
    if ( attackActivity?.attack?.type?.value !== "melee" ) return;     // melee misses only (P3)
    const attacker = message.getAssociatedActor?.();
    if ( !attacker ) return;

    const hitSet = new Set(hitTargets(message).map(t => t.uuid));      // as rolled — Graze's no-reopen
    const reactors = [];
    for ( const t of (message.getFlag("dnd5e", "targets") ?? []) ) {
      if ( hitSet.has(t.uuid) ) continue;
      const actor = await fromUuid(t.uuid).catch(() => null);
      if ( !(actor instanceof Actor) ) continue;
      if ( (actor.system.attributes?.hp?.value ?? 0) <= 0 ) continue;  // the dead don't riposte
      if ( actor.uuid === attacker.uuid ) continue;
      // ⚠ NOT a budget test — this flag is the CLICK-VOLUME GUARD (hold.js), and the module
      // does not track action economy at all: that is the table's job, by user ruling. Every
      // read of it, here and in hold.js/saves.js, only declines to OFFER; nothing anywhere
      // refuses a cast or blocks an action. Read as "don't nag this actor again this turn."
      // The old wording here said "one reaction per round" and led a careful reviewer to
      // diagnose a rules violation the module cannot commit.
      if ( actor.getFlag(MODULE_ID, "reactionSpent") ) continue;
      if ( !modeAllows(actor) ) continue;                              // rides the resolver (Graze's argument)
      const found = usableManeuver(actor, entry.name);
      const dieFormula = found ? maneuverDieFormula(found.activity) : null;
      if ( !found || !dieFormula ) continue;
      if ( !meleeOptions(actor).length ) continue;                     // nothing to swing back with
      reactors.push({
        uuid: t.uuid, name: t.name,
        itemId: found.item.id, activityId: found.activity.id,
        itemName: found.item.name, itemImg: found.item.img,
        dieFormula, answer: null
      });
    }
    if ( !reactors.length ) return;

    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await message.setFlag(MODULE_ID, "riposte", {
      status: "pending",
      attackerUuid: attacker.uuid, attackerName: attacker.name,
      ...statContext(attacker.uuid), // the data-plane stamp — the swing that invited the counter
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}),
      reactors
    });
    armRiposteTimer(message);
  } catch(err) {
    console.error(`${TITLE} | Riposte stamp failed.`, err);
  }
});

/* Per-reactor answers don't fit armAskTimer's single-answer shape — the per-target gate on
 * the spine's raw clock (the topple timer's idiom). */
function armRiposteTimer(message) {
  const flag = message?.getFlag(MODULE_ID, "riposte");
  if ( !flag?.deadline || (flag.status !== "pending") || !isActiveGM() ) return;
  if ( !(flag.reactors ?? []).some(r => !r.answer) ) return;
  armDeadline(riposteTimers, message.id, flag.deadline, fireRiposteTimer);
}

const disarmRiposteTimer = messageId => disarmDeadline(riposteTimers, messageId);

/** Expiry DECLINES — a reaction nobody took is a reaction not taken (the hold's pass, not
 * the save machine's roll: nothing here is mandatory). */
async function fireRiposteTimer(messageId) {
  try {
    const message = game.messages.get(messageId);
    if ( !message ) return;
    await queueFlagWrite(message, "riposte", current => {
      if ( current.status !== "pending" ) return;
      for ( const r of current.reactors ?? [] ) {
        if ( !r.answer ) { r.answer = "declined"; r.timedOut = true; }
      }
      if ( (current.reactors ?? []).every(r => r.answer) ) current.status = "resolved";
    });
  } catch(err) {
    console.error(`${TITLE} | Riposte buzzer failed.`, err);
  }
}

/** One reactor's answer — claim through the flag lock; "riposte" executes on this client.
 * ⚠ A PLAYER reactor cannot update the enemy's attack message (ChatMessage update is
 * author-or-GM), so their answer travels as their OWN message and the elect folds it in —
 * hold.js answerHold's §4.1 split, applied here. The driven attack still runs on the
 * answering client (their dice, their pool); the fold and the drive are independent, and
 * the elect's 20s crash-resume covers a client that died between the two. */
async function answerRiposte(message, uuid, answer, { weaponId = null, weaponName = null } = {}) {
  if ( !message.isOwner ) {
    const live = message.getFlag(MODULE_ID, "riposte");
    const reactor = live?.reactors?.find(x => x.uuid === uuid);
    if ( !reactor || reactor.answer || (live.status !== "pending") ) return;
    const actor = (() => { try { return fromUuidSync(uuid); } catch { return null; } })();
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({
        img: reactor.itemImg, eyebrow: `Maneuver — ${reactor.itemName}`,
        tone: (answer === "riposte") ? "good" : "neutral",
        title: (answer === "riposte")
          ? `${reactor.itemName} — ${reactor.name} strikes back${weaponName ? ` with ${weaponName}` : ""}`
          : `${reactor.itemName} — ${reactor.name} declines`,
        subtitle: `${live.attackerName}'s melee attack missed`
      }),
      flags: { [MODULE_ID]: { riposteAnswer: {
        messageId: message.id, uuid, answer, weaponId, weaponName
      } } }
    });
    if ( answer === "riposte" ) await resolveRiposte(message, uuid, weaponId, { trusted: true });
    return;
  }
  let claimed = false;
  await queueFlagWrite(message, "riposte", current => {
    const r = (current.reactors ?? []).find(x => x.uuid === uuid);
    if ( !r || r.answer || (current.status !== "pending") ) return;
    r.answer = answer;
    r.answeredAt = Date.now();   // the crash-resume horizon (the topple discipline)
    if ( weaponId ) { r.weaponId = weaponId; r.weaponName = weaponName; }
    if ( (current.reactors ?? []).every(x => x.answer) ) current.status = "resolved";
    claimed = true;
  });
  if ( !claimed || (answer !== "riposte") ) return;
  await resolveRiposte(message, uuid, weaponId);
}

/** A relayed answer landing: the ELECT folds it into the riposte flag (idempotent - the claim
 * rules are the same as the direct path's, so a twin relay changes nothing).
 * ⚠ Through the spine's relay registry since the §4.1 consolidation. `owns` ignores the flag
 * here because the elect is the owner; the hold's relay is the one that reads it. */
registerRelay("riposteAnswer", {
  flagKey: "riposte",
  targetOf: a => a.messageId,
  owns: () => isActiveGM(),
  fold: (current, a) => {
    const r = (current.reactors ?? []).find(x => x.uuid === a.uuid);
    if ( !r || r.answer || (current.status !== "pending") ) return;
    r.answer = a.answer;
    r.answeredAt = Date.now();
    if ( a.weaponId ) { r.weaponId = a.weaponId; r.weaponName = a.weaponName; }
    if ( (current.reactors ?? []).every(x => x.answer) ) current.status = "resolved";
  }
});

/** Has this reactor's driven attack already been made? The provenance flags ARE the receipt. */
const riposteDriven = (messageId, uuid) => game.messages.contents.some(m =>
  (m.getFlag(MODULE_ID, "riposteFor") === messageId) && (m.getFlag(MODULE_ID, "riposteBy") === uuid));

/** The accept path: use the maneuver, spend the reaction, arm the die, drive the attack.
 * `trusted` is the relay branch trusting its OWN just-posted answer — the flag fold happens
 * on the elect a beat later, and waiting for the round-trip would idle the player's dice. */
async function resolveRiposte(message, uuid, weaponId, { trusted = false } = {}) {
  const key = `${message.id}|${uuid}`;
  if ( riposteInFlight.has(key) ) return;
  riposteInFlight.add(key);
  try {
    const flag = message.getFlag(MODULE_ID, "riposte");
    const reactor = flag?.reactors?.find(r => r.uuid === uuid);
    if ( !reactor ) return;
    if ( !trusted && (reactor.answer !== "riposte") ) return;
    if ( riposteDriven(message.id, uuid) ) return;   // idempotent — the attack already exists
    const actor = await fromUuid(uuid);
    if ( !(actor instanceof Actor) ) return;
    const attackerToken = canvas.tokens?.placeables?.find(t => t.actor?.uuid === flag.attackerUuid);

    // Aim first, so every card in the sequence says who it is aimed at.
    const priorTargets = [...game.user.targets].map(t => t.id);
    if ( attackerToken ) {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      attackerToken.setTarget(true, { releaseOthers: true });
    }

    try {
      // 1. REALLY use the maneuver — the pool is consumed by the system (P2), and the
      //    reaction is SPENT: the hold's own setter fires only when reactionHold is on, so
      //    the fold sets the same flag itself, same in-combat carve-out, idempotently.
      const item = actor.items.get(reactor.itemId);
      const activity = item?.system.activities?.contents?.find(a => a.id === reactor.activityId);
      if ( !activity ) return;
      //    ⚠ subsequentActions:false or dnd5e follows the use by rolling the maneuver's own
      //    damage activity — a native d8 config dialog parked over the whole resolution
      //    (walk-4 finding (v)). Consumption and the card are all this step wants.
      await activity.use({ subsequentActions: false }, { configure: false }, {
        data: { flags: { [MODULE_ID]: { riposteUse: message.id } } }
      });
      if ( inRunningCombat(actor) ) void actor.setFlag(MODULE_ID, "reactionSpent", true);

      // 2. Arm the one-shot die for the injection hook, THEN drive the real attack — the
      //    P3-measured shape: use() for the usage card, rollAttack chained to it, module
      //    provenance in FLAT message data (nested data is invisible to the riders).
      const options = meleeOptions(actor);
      const wantId = weaponId ?? reactor.weaponId ?? null;   // the stored choice survives a crash-resume
      const chosen = options.find(o => o.itemId === wantId) ?? preferredMeleeOption(actor, options);
      if ( !chosen ) return;
      const weapon = actor.items.get(chosen.itemId);
      const weaponAct = weapon?.system.activities?.contents?.find(a => a.id === chosen.activityId);
      if ( !weaponAct ) return;
      riposteDie.set(uuid, {
        formula: reactor.dieFormula,
        type: [...(weapon.system.damage?.base?.types ?? [])][0] ?? "",
        armedAt: Date.now()
      });
      const use = await weaponAct.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = use?.message?.id ?? null;
      await weaponAct.rollAttack({}, { configure: false }, {
        data: {
          "flags.dnd5e.originatingMessage": usageId ?? message.id,
          [`flags.${MODULE_ID}.riposteFor`]: message.id,
          [`flags.${MODULE_ID}.riposteBy`]: uuid
        }
      });
      // The rest is the ordinary pipeline: rollAttackV2 fires here (P3), auto-damage rolls
      // or offers, the injection below adds the die, auto-apply and the riders do their
      // usual work on the elect. Nothing else to drive.
    } finally {
      // Put the table back the way the reactor had it.
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      for ( const id of priorTargets ) canvas.tokens?.get(id)?.setTarget(true, { releaseOthers: false });
    }
  } catch(err) {
    console.error(`${TITLE} | Riposte resolution failed.`, err);
  } finally {
    riposteInFlight.delete(key);
  }
}

/** The die injection — the hit-riders push idiom, gated on the armed one-shot. */
Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    const actor = activity.item?.actor;
    if ( !actor ) return;
    const armed = riposteDie.get(actor.uuid);
    if ( !armed ) return;
    if ( (Date.now() - armed.armedAt) > RIPOSTE_DIE_TTL_MS ) { riposteDie.delete(actor.uuid); return; }
    // When the damage names its chain, verify it leads to OUR driven attack — a different
    // attack rolled inside the window must not inherit the die. A chainless roll (the native
    // button) falls back to the actor+TTL match.
    const originId = message?.data?.["flags.dnd5e.originatingMessage"];
    if ( originId ) {
      const origin = game.messages.get(originId);
      if ( origin ) {
        const chainAttacks = (origin.getFlag("dnd5e", "roll.type") === "attack")
          ? [origin] : (origin.getAssociatedRolls?.("attack") ?? []);
        if ( !chainAttacks.some(a => a.getFlag(MODULE_ID, "riposteFor")) ) return;
      }
    }
    riposteDie.delete(actor.uuid);   // one-shot, consumed
    // The die folds INTO the base roll (v1.19.x finding (d) — the walk: it must ride the
    // snap-back's own roll, one dice group, one total; a pushed entry rendered as its own
    // window). A base part crit-doubles too — a riposte crit doubling the superiority die
    // is the 2024 rule. The typed-entry push stays only as the never-observed fallback.
    const base = (config.rolls ?? []).find(r => r.base === true);
    if ( base ) base.parts = [...(base.parts ?? []), armed.formula];
    else config.rolls.push({
      data: config.rolls[0]?.data ?? {},
      parts: [armed.formula],
      options: { type: armed.type, types: armed.type ? [armed.type] : [] }
    });
  } catch(err) {
    console.error(`${TITLE} | Riposte die injection failed.`, err);
  }
});

/* The riposte's swing never ends in silence (finding (p)): a MISS announces itself, so any
 * Graze/Precision offer that follows ((e)-KEEP — driven attacks are real attacks) arrives
 * from an announced miss instead of from nowhere. The ROLLING client posts (rollAttackV2's
 * locality — one client, one card); the HIT half of (p) lives in offerDamageRoll, which
 * names the riposte as its own moment and notes the riding die. */
Hooks.on("dnd5e.rollAttackV2", async rolls => {
  try {
    const message = rolls?.[0]?.parent;
    if ( !(message instanceof ChatMessage) ) return;
    const riposteFor = message.getFlag(MODULE_ID, "riposteFor");
    if ( !riposteFor ) return;
    if ( hitTargets(message).length ) return;   // the hit's moment is the damage offer
    const reactor = message.getAssociatedActor?.();
    const held = game.messages.get(riposteFor)?.getFlag(MODULE_ID, "riposte");
    const r = held?.reactors?.find(x => x.uuid === message.getFlag(MODULE_ID, "riposteBy"));
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: reactor }),
      content: bfCard({
        img: r?.itemImg ?? null, eyebrow: `Maneuver — ${r?.itemName ?? "Riposte"}`,
        tone: "neutral",
        title: `${r?.itemName ?? "Riposte"} — the strike back misses`,
        subtitle: `${reactor?.name ?? "The reactor"}'s answer to ${held?.attackerName ?? "the attacker"}`
          + `${r?.weaponName ? ` — ${r.weaponName}` : ""}`
      })
    });
  } catch(err) {
    console.error(`${TITLE} | Riposte miss announce failed.`, err);
  }
});

/** The Riposte/Pass popup — two controls plus the weapon choice (an input, like the topple
 * bonus field: inputs inform the answer, they are not answers). */
async function showRipostePopup(message, flag, reactor) {
  const actor = (() => { try { return fromUuidSync(reactor.uuid); } catch { return null; } })();
  // The weapon choice (finding ④, the walk's ruling): default to the weapon last attacked
  // with; a single equipped melee weapon skips the dropdown entirely and is simply NAMED.
  const options = actor ? meleeOptions(actor) : [];
  const preferred = actor ? preferredMeleeOption(actor, options) : null;
  const selectHTML = (options.length > 1) ? `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">Riposte with</label>
      <select name="bf-riposte-weapon" style="flex:1;min-width:0;">${options
        .map(o => `<option value="${o.itemId}"${o.itemId === preferred?.itemId ? " selected" : ""}>${o.label}</option>`)
        .join("")}</select>
    </div>` : "";
  let dialog;
  const answer = kind => {
    const chosenId = dialog?.element?.querySelector('select[name="bf-riposte-weapon"]')?.value
      ?? preferred?.itemId ?? null;
    return answerRiposte(message, reactor.uuid, kind, {
      weaponId: chosenId,
      // The clean name, never the display label — "(stowed)" is popup dressing, not card record.
      weaponName: options.find(o => o.itemId === chosenId)?.name ?? preferred?.name ?? null
    });
  };
  dialog = await openMomentPopup(message, `riposte:${reactor.uuid}`, actor, {
    title: `Riposte — ${reactor.name}`, icon: "fa-solid fa-reply",
    content: bfCard({
      img: reactor.itemImg, eyebrow: `Maneuver — ${reactor.itemName}`, tone: "pending",
      title: `${flag.attackerName} missed you`,
      // (z): the rule line is the maneuver's own sentence, verbatim; the one-weapon note
      // stays as the module's hint.
      lines: [ruleLine(RULE_TEXT.riposte),
        ...((options.length === 1) ? [`Riposte with <strong>${preferred?.label ?? "your weapon"}</strong> — your one melee weapon.`] : [])]
    }) + selectHTML + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "riposte", label: preferred && (options.length === 1) ? `Riposte with ${preferred.label}` : "Riposte",
        default: true, callback: () => answer("riposte") },
      { action: "pass", label: "Pass", callback: () => answer("declined") }
    ]
  });
}

/* =============================================================================================
 * HEW (v1.19.x, walk scope-add ②) — reminder-card-only by the user's ruling: Great Weapon
 * Master's third bullet ("Immediately after you score a Critical Hit with a Melee weapon or
 * reduce a creature to 0 Hit Points with one, you can make one attack with the same weapon
 * as a Bonus Action"). Nothing rolls, nothing arms, nothing times out — the Push mastery's
 * announce idiom: the card states the option, the player swings from the sheet.
 * Two triggers, one card per swing: the CRIT posts from the roller's own client at attack
 * time; the KILL posts from the elect when a receipt shows a target at 0 HP — and defers to
 * the crit's card when both fire on one swing. A hand-tray kill posts no receipt and so no
 * reminder; module-applied damage is the only exact witness of "reduced to 0".
 * ========================================================================================== */

async function postHewReminder(attacker, featItem, weapon, why) {
  // The card is the durable record; the POPUP is the moment (walk finding (c), the user's
  // design law verbatim: "our design language is to give players popup notifications on
  // easy things to forget" — the first walk's crit card posted and was scrolled past).
  // The notice family's shape exactly: OK-only, drain bar, auto-close at the deadline.
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: bfCard({
      img: featItem.img, eyebrow: `Feat — ${featItem.name}`, tone: "good",
      title: `Hew — ${attacker.name} can attack again`,
      subtitle: why,
      // (z): the rule line is the feat's own sentence, verbatim; the swing note stays as
      // the module's hint.
      lines: [ruleLine(RULE_TEXT.hew),
        `Swing <strong>${weapon?.name ?? "the same weapon"}</strong> from the sheet; nothing is automated.`]
    }),
    flags: { [MODULE_ID]: { hewNotice: {
      attackerUuid: attacker.uuid, itemName: featItem.name, itemImg: featItem.img,
      weaponName: weapon?.name ?? null, why,
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    } } }
  });
}

/** The Hew popup — the mastery notice's OK-only shape on the fold's own namespace. */
async function showHewPopup(message, notice) {
  const attacker = (() => { try { return fromUuidSync(notice.attackerUuid); } catch { return null; } })();
  await openMomentPopup(message, "hew", attacker, {
    title: `Hew — ${attacker?.name ?? ""}`, icon: "fa-solid fa-axe-battle", width: 420,
    content: bfCard({
      img: notice.itemImg, eyebrow: `Feat — ${notice.itemName}`, tone: "good",
      title: `Hew — ${attacker?.name ?? "you"} can attack again`,
      subtitle: notice.why,
      lines: [ruleLine(RULE_TEXT.hew),
        `Swing <strong>${notice.weaponName ?? "the same weapon"}</strong> from the sheet; nothing is automated.`]
    }) + momentBarHTML(notice, "reminder"),
    // The ACK (law 2, finding (j)): OK resolves the card's pending presentation everywhere.
    buttons: [{ action: "ok", label: "OK", default: true,
      callback: () => acknowledgeMoment(message, "hewNotice") }],
    autoCloseAt: notice.deadline || null
  });
}

/** The reminder pops while the moment is live — the notice family's render discipline. */
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const notice = message.getFlag(MODULE_ID, "hewNotice");
  if ( !notice ) return;
  if ( !notice.deadline || (notice.deadline <= Date.now()) ) return;
  if ( momentAcknowledged(message, "hewNotice") ) return;   // the ACK ends the presentation
  const row = document.createElement("div");
  row.innerHTML = momentBarHTML(notice, "reminder");
  html.querySelector(".message-content")?.appendChild(row);
  scheduleBarSync(row);
  const attacker = (() => { try { return fromUuidSync(notice.attackerUuid); } catch { return null; } })();
  const shownKey = popupKey(message.id, "hew");
  if ( canAnswerFor(attacker) && !shownMoments.has(shownKey) ) {
    shownMoments.add(shownKey);
    void showHewPopup(message, notice);
  }
});

/* --- the Hew triggers (finding (k)): BOTH live on the damage side now ------------------------
 * The old crit trigger posted from rollAttackV2 — the reminder arrived BEFORE the damage was
 * rolled, so "attack again" preceded the attack's own resolution on screen (and with the
 * damage popup open, preceded it by the whole window). Both triggers now key off the crit's
 * damage MESSAGE: damage first, then "attack again", and the dedupe is ONE flag on that
 * message — a crit that kills still reminds once (create precedes the receipt update, so the
 * crit's post wins and the kill defers). Both run on the elect; the per-message check queue
 * serializes the two triggers so neither can double-post nor eat the other's turn.
 * ------------------------------------------------------------------------------------------- */

const hewChecks = new Map();

function queueHewCheck(damageMessage, fn) {
  // The queueFlagWrite idiom (core.js): the stored link never rejects, so the chain cannot
  // break, and the map self-cleans when its tail drains.
  const prior = hewChecks.get(damageMessage.id) ?? Promise.resolve();
  const next = prior.then(fn, fn);
  const tail = next.catch(() => {});
  hewChecks.set(damageMessage.id, tail);
  void tail.then(() => { if ( hewChecks.get(damageMessage.id) === tail ) hewChecks.delete(damageMessage.id); });
  return next;
}

/** The chain behind a damage message, resolved for Hew — the die injection's measured shape:
 * the damage's originatingMessage is the USAGE card, not the attack roll. Null when this
 * damage cannot earn a Hew (no melee attack chain, no listed carrier, resolver off). */
async function hewChainContext(damageMessage) {
  const originId = damageMessage.getFlag("dnd5e", "originatingMessage");
  const origin = originId ? game.messages.get(originId) : null;
  if ( !origin ) return null;
  const attackMessage = (origin.getFlag("dnd5e", "roll.type") === "attack")
    ? origin
    : ((origin.getAssociatedRolls?.("attack") ?? []).at(-1) ?? null);
  if ( !attackMessage || (attackMessage.getFlag("dnd5e", "roll.type") !== "attack") ) return null;
  const activity = await fromUuid(attackMessage.getFlag("dnd5e", "activity")?.uuid ?? "").catch(() => null);
  if ( activity?.attack?.type?.value !== "melee" ) return null;
  const attacker = attackMessage.getAssociatedActor?.();
  if ( !attacker || !modeAllows(attacker) ) return null;
  const found = foldEntryFor(attacker, "hew");
  if ( !found ) return null;
  return { attackMessage, activity, attacker, found };
}

/** The crit trigger — the elect, the moment the crit's damage roll EXISTS. */
async function maybeHewCritReminder(damageMessage) {
  try {
    if ( !isActiveGM() ) return;
    if ( damageMessage.getFlag(MODULE_ID, "hewNoticed") ) return;
    const ctx = await hewChainContext(damageMessage);
    if ( !ctx ) return;
    if ( !(ctx.attackMessage.rolls?.[0]?.isCritical ?? false) ) return;
    await damageMessage.setFlag(MODULE_ID, "hewNoticed", true);
    await postHewReminder(ctx.attacker, ctx.found.item, ctx.activity.item, "A Critical Hit with a melee weapon");
  } catch(err) {
    console.error(`${TITLE} | Hew crit reminder failed.`, err);
  }
}

Hooks.on("createChatMessage", message => {
  if ( !isActiveGM() ) return;
  if ( message.getFlag("dnd5e", "roll.type") !== "damage" ) return;
  void queueHewCheck(message, () => maybeHewCritReminder(message));
});

/** The kill trigger — the elect, off the receipt it just wrote. A hand-tray kill posts no
 * receipt and so no reminder (recorded and accepted). */
async function maybeHewKillReminder(damageMessage) {
  try {
    if ( !isActiveGM() ) return;
    if ( damageMessage.getFlag(MODULE_ID, "hewNoticed") ) return;   // the crit already said it
    const receipt = damageMessage.getFlag(MODULE_ID, "receipt");
    if ( !receipt?.targets?.length ) return;
    const ctx = await hewChainContext(damageMessage);
    if ( !ctx ) return;
    const downed = [];
    for ( const t of receipt.targets ?? [] ) {
      if ( t.reverted ) continue;
      const actor = await fromUuid(t.uuid).catch(() => null);
      if ( actor && ((actor.system?.attributes?.hp?.value ?? 1) <= 0) ) downed.push(t.name ?? actor.name);
    }
    if ( !downed.length ) return;
    await damageMessage.setFlag(MODULE_ID, "hewNoticed", true);
    await postHewReminder(ctx.attacker, ctx.found.item, ctx.activity.item, `${downed.join(", ")} down to 0 HP`);
  } catch(err) {
    console.error(`${TITLE} | Hew kill reminder failed.`, err);
  }
}

/* =============================================================================================
 * THE BASH OFFER (v1.19.x, walk finding (g)) — the HIT is the trigger. The first walk's
 * item 8 drove Shield Bash from the sheet; the table hit with the sword and expected the
 * offer ("shield bash never triggered a popup attacking combat dummy"). RAW agrees: "if
 * you attack... and hit with a Melee weapon, you can immediately bash." A melee weapon hit
 * by a listed `bash` carrier stamps a Use/Pass offer on the attacker's OWN attack message
 * (their message, so the answer writes directly — the precision locality); accepting aims
 * at the struck target and drives the feat's save activity, and everything downstream (the
 * demand, the failure's Prone-or-push choice) is the machinery that already exists. Once
 * per turn in combat (the feat's own clause, the Cleave stamp discipline); out of combat
 * every hit offers — "we don't have timers and combat rounds yet".
 * ========================================================================================== */

const bashOfferTimers = new Map();
const bashOfferInFlight = new Set();

Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  try {
    if ( !subject || (subject.type !== "attack") ) return;
    if ( subject.item?.type !== "weapon" ) return;               // feat and spell attacks never bash
    if ( subject.attack?.type?.value !== "melee" ) return;
    const attacker = subject.actor;
    const message = rolls?.[0]?.parent;
    if ( !attacker || !(message instanceof ChatMessage) ) return;
    if ( message.getFlag(MODULE_ID, "bashOffer") ) return;       // never re-stamp
    if ( message.getFlag(MODULE_ID, "riposteFor") ) return;      // a driven attack never chains the offer
    if ( !modeAllows(attacker) ) return;
    const found = foldEntryFor(attacker, "bash");
    if ( !found ) return;
    const activity = found.item.system.activities?.contents?.find(a => a.type === "save");
    if ( !activity ) return;
    const used = attacker.getFlag(MODULE_ID, "bashUsed");
    if ( used?.stamp && (used.stamp === combatStamp()) ) return; // once on each of your turns
    const hits = hitTargets(message);
    if ( !hits.length ) return;
    const living = [];
    for ( const t of hits ) {
      const a = await fromUuid(t.uuid).catch(() => null);
      if ( !(a instanceof Actor) ) continue;
      if ( a.statuses?.has?.("dead") ) continue;
      if ( (a.type === "npc") && ((a.system.attributes?.hp?.value ?? 0) <= 0) ) continue;
      living.push({ uuid: t.uuid, name: t.name });
    }
    if ( !living.length ) return;                                // a corpse cannot be bashed (the dead gate)
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await message.setFlag(MODULE_ID, "bashOffer", {
      status: "pending", answer: null,
      itemId: found.item.id, activityId: activity.id,
      itemName: found.item.name, itemImg: found.item.img,
      attackerUuid: attacker.uuid, targets: living,
      ...statContext(attacker.uuid), // the data-plane stamp
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    });
    armBashOfferTimer(message);
  } catch(err) {
    console.error(`${TITLE} | Bash offer stamp failed.`, err);
  }
});

const armBashOfferTimer = message =>
  armAskTimer(bashOfferTimers, message, "bashOffer", live => answerBashOffer(live, "pass", { timedOut: true }));

/** Has the offer's driven usage already happened? The provenance flag is the receipt. */
const bashDriven = messageId => game.messages.contents.some(m =>
  m.getFlag(MODULE_ID, "bashFor") === messageId);

async function answerBashOffer(message, answer, { targetUuid = null, timedOut = false } = {}) {
  let claimed = false;
  await queueFlagWrite(message, "bashOffer", current => {
    if ( (current.status !== "pending") || current.answer ) return;
    current.answer = answer;
    current.answeredAt = Date.now();   // the crash-resume horizon
    if ( targetUuid ) current.targetUuid = targetUuid;
    if ( timedOut ) current.timedOut = true;
    current.status = "resolved";
    claimed = true;
  });
  if ( !claimed || (answer !== "use") ) return;
  await resolveBashOffer(message);
}

/** The accept path: aim at the struck target, drive the feat's OWN save activity — the
 * demand and the Prone-or-push choice are the existing machinery from here. */
async function resolveBashOffer(message) {
  if ( bashOfferInFlight.has(message.id) ) return;
  bashOfferInFlight.add(message.id);
  try {
    const flag = message.getFlag(MODULE_ID, "bashOffer");
    if ( !flag || (flag.answer !== "use") ) return;
    if ( bashDriven(message.id) ) return;                        // idempotent — the usage exists
    const attacker = await fromUuid(flag.attackerUuid).catch(() => null);
    const item = attacker?.items?.get(flag.itemId);
    const activity = item?.system.activities?.get?.(flag.activityId)
      ?? item?.system.activities?.contents?.find(a => a.id === flag.activityId);
    if ( !(attacker instanceof Actor) || !activity ) return;
    const targetUuid = flag.targetUuid ?? flag.targets?.[0]?.uuid ?? null;
    const token = canvas.tokens?.placeables?.find(t => t.actor?.uuid === targetUuid);
    const priorTargets = [...game.user.targets].map(t => t.id);
    if ( token ) {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      token.setTarget(true, { releaseOthers: true });
    }
    try {
      await activity.use({ subsequentActions: false }, { configure: false }, {
        data: { flags: { [MODULE_ID]: { bashFor: message.id } } }
      });
      if ( inRunningCombat(attacker) ) {
        const stamp = combatStamp();
        if ( stamp ) void attacker.setFlag(MODULE_ID, "bashUsed", { stamp });
      }
    } finally {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      for ( const id of priorTargets ) canvas.tokens?.get(id)?.setTarget(true, { releaseOthers: false });
    }
  } catch(err) {
    console.error(`${TITLE} | Bash offer resolution failed.`, err);
  } finally {
    bashOfferInFlight.delete(message.id);
  }
}

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

/** The Use/Pass popup — a target select only when the swing struck more than one. */
async function showBashOfferPopup(message, flag) {
  const attacker = (() => { try { return fromUuidSync(flag.attackerUuid); } catch { return null; } })();
  const options = flag.targets ?? [];
  const selectHTML = (options.length > 1) ? `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
      <label style="flex:1;font-size:var(--font-size-12,12px);">Bash</label>
      <select name="bf-bash-target" style="flex:1;min-width:0;">${options
        .map(o => `<option value="${o.uuid}">${o.name}</option>`).join("")}</select>
    </div>` : "";
  let dialog;
  const answer = kind => answerBashOffer(message, kind, {
    targetUuid: dialog?.element?.querySelector('select[name="bf-bash-target"]')?.value
      ?? options[0]?.uuid ?? null
  });
  dialog = await openMomentPopup(message, "bashoffer", attacker, {
    title: `${flag.itemName} — ${attacker?.name ?? ""}`, icon: "fa-solid fa-shield-halved",
    content: bfCard({
      img: flag.itemImg, eyebrow: `Maneuver — ${flag.itemName}`, tone: "pending",
      title: `${flag.itemName} — bash ${options.length === 1 ? options[0].name : "the target"}?`,
      // (z): the rule line is the feat's own passage, verbatim — trigger, either/or and the
      // once-a-turn limit all in the feature's words.
      lines: [ruleLine(RULE_TEXT.bash)]
    }) + selectHTML + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "use", label: `Use ${flag.itemName}`, default: true, callback: () => answer("use") },
      { action: "pass", label: "Pass", callback: () => answer("pass") }
    ]
  });
}

/* =============================================================================================
 * SHARED PLUMBING — rows, popups on render, answer watcher, cleanup
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
      const attacker = (() => { try { return fromUuidSync(p.attackerUuid); } catch { return null; } })();
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

  // --- Riposte: one row per reactor on the enemy's attack card ------------------------------
  const r = message.getFlag(MODULE_ID, "riposte");
  if ( r?.reactors?.length ) {
    const row = document.createElement("div");
    row.className = "battleflow-maneuver";
    const pending = r.status === "pending";
    for ( const reactor of r.reactors ) {
      const line = document.createElement("div");
      line.innerHTML = bfCard({
        img: reactor.itemImg, eyebrow: `Maneuver — ${reactor.itemName}`,
        tone: !reactor.answer ? "pending" : (reactor.answer === "riposte" ? "good" : "neutral"),
        // Source, then result (⑦); the resolved line NAMES the weapon (④ — the walk's
        // "unclear how a weapon is picked" is answered on the card, not just in the popup).
        title: !reactor.answer ? `${reactor.itemName} — ${reactor.name} may strike back`
          : (reactor.answer === "riposte"
            ? `${reactor.itemName} — ${reactor.name} strikes back${reactor.weaponName ? ` with ${reactor.weaponName}` : ""}`
            : `${reactor.itemName} — ${reactor.name} declined${reactor.timedOut ? " (timer)" : ""}`),
        subtitle: `${r.attackerName}'s melee attack missed`
      });
      row.appendChild(line);
      if ( pending && !reactor.answer ) {
        const bar = document.createElement("div");
        bar.innerHTML = holdBarHTML(r, "to answer");
        row.appendChild(bar);
        const actor = (() => { try { return fromUuidSync(reactor.uuid); } catch { return null; } })();
        if ( canAnswerFor(actor) ) {
          const shownKey = popupKey(message.id, `riposte:${reactor.uuid}`);
          if ( !shownMoments.has(shownKey) ) {
            shownMoments.add(shownKey);
            void showRipostePopup(message, r, reactor);
          }
          row.appendChild(momentButton(`Answer — ${reactor.name}`, () => {
            const live = message.getFlag(MODULE_ID, "riposte");
            const lr = live?.reactors?.find(x => x.uuid === reactor.uuid);
            if ( live && lr && !lr.answer ) void showRipostePopup(message, live, lr);
          }));
        }
      }
    }
    if ( pending ) { scheduleBarSync(row); armRiposteTimer(message); }
    // Crash-resume, elect-owned, 20s horizon (the precision block's twin): an accepted
    // riposte whose driving client died is answer="riposte" with no driven attack in the
    // log — the provenance flags are the receipt, so the check is exact.
    if ( isActiveGM() ) {
      for ( const reactor of r.reactors ?? [] ) {
        if ( (reactor.answer === "riposte") && reactor.answeredAt
          && (Date.now() - reactor.answeredAt > 20_000)
          && !riposteDriven(message.id, reactor.uuid) ) {
          void resolveRiposte(message, reactor.uuid, null);
        }
      }
    }
    html.querySelector(".message-content")?.appendChild(row);
  }

  // --- Bash offer: one row on the attacker's own attack card (finding (g)) -----------------
  const b = message.getFlag(MODULE_ID, "bashOffer");
  if ( b ) {
    const row = document.createElement("div");
    row.className = "battleflow-maneuver";
    const pending = b.status === "pending";
    row.innerHTML = bfCard({
      img: b.itemImg, eyebrow: `Maneuver — ${b.itemName}`,
      tone: pending ? "pending" : (b.answer === "use" ? "good" : "neutral"),
      title: pending ? `${b.itemName} — offered on the hit`
        : (b.answer === "use" ? `${b.itemName} — used` : `${b.itemName} — passed${b.timedOut ? " (timer)" : ""}`),
      subtitle: (b.targets ?? []).map(t => t.name).join(", ")
    }) + (pending ? holdBarHTML(b, "to answer") : "");
    html.querySelector(".message-content")?.appendChild(row);
    if ( pending ) {
      scheduleBarSync(row);
      armBashOfferTimer(message);
      const attacker = (() => { try { return fromUuidSync(b.attackerUuid); } catch { return null; } })();
      if ( canAnswerFor(attacker) && !b.answer ) {
        const shownKey = popupKey(message.id, "bashoffer");
        if ( !shownMoments.has(shownKey) ) {
          shownMoments.add(shownKey);
          void showBashOfferPopup(message, b);
        }
        row.appendChild(momentButton("Answer", () => {
          void showBashOfferPopup(message, message.getFlag(MODULE_ID, "bashOffer"));
        }, { margin: "0.25rem 0 0" }));
      }
    }
    // Crash-resume, elect-owned, the precision block's 20s horizon: an accepted offer whose
    // driving client died is answer="use" with no driven usage in the log.
    if ( (b.answer === "use") && isActiveGM() && b.answeredAt
      && (Date.now() - b.answeredAt > 20_000) && !bashDriven(message.id) ) {
      void resolveBashOffer(message);
    }
  }
});

// Every client closes answered popups; the timers disarm when nothing is pending.
Hooks.on("updateChatMessage", message => {
  // The Hew kill trigger rides receipt writes — the elect's own update landing back. Through
  // the check queue, so it can never interleave with the crit trigger's create-side check.
  if ( message.getFlag(MODULE_ID, "receipt") && isActiveGM() ) {
    void queueHewCheck(message, () => maybeHewKillReminder(message));
  }
  // A durably-acknowledged Hew notice closes its popup wherever it lives (the ACK, law 2).
  if ( message.getFlag(MODULE_ID, "hewNotice")?.acknowledged ) {
    const dialog = livePopups.get(popupKey(message.id, "hew"));
    if ( dialog ) void dialog.close();
  }
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
  const r = message.getFlag(MODULE_ID, "riposte");
  if ( r ) {
    for ( const reactor of r.reactors ?? [] ) {
      if ( !reactor.answer ) continue;
      const dialog = livePopups.get(popupKey(message.id, `riposte:${reactor.uuid}`));
      if ( dialog ) void dialog.close();
    }
    if ( !(r.reactors ?? []).some(x => !x.answer) ) disarmRiposteTimer(message.id);
    else armRiposteTimer(message);
  }
  const b = message.getFlag(MODULE_ID, "bashOffer");
  if ( b ) {
    const dialog = livePopups.get(popupKey(message.id, "bashoffer"));
    if ( dialog && ((b.status !== "pending") || b.answer) ) void dialog.close();
    if ( b.status !== "pending" ) disarmAskTimer(bashOfferTimers, message.id);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clocks disarm here.
Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(precisionTimers, message.id);
  disarmAskTimer(bashOfferTimers, message.id);
  disarmRiposteTimer(message.id);
});
