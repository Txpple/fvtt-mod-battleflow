/**
 * Battle Flow — MACHINE layer (ARCHITECTURE.md §2): the post-roll D20 FOLDS.
 *
 * Heroic Inspiration, Tactical Mind and a Bardic Inspiration die — the three surveyed features,
 * built together because they are ONE mechanism (ARCHITECTURE.md §11, "Adding a FOLD").
 * Precision Attack in maneuvers.js is the working template: `activity.use()` where there is an
 * activity, the die posts as its own public message stamped `respondsTo`, the verdict is
 * recomputed ON A MODULE FLAG with the original `Roll` never touched, and `hitTargets` re-reads
 * it and re-drives the chain.
 *
 * ⚠ Depend downward only: core → decide → spine (ui) → here.
 *
 * ---------------------------------------------------------------------------------------------
 * ⚠ THE v1 OF THIS FILE SHIPPED WITH FOUR OF SIX OFFER PATHS DEAD, AND A GREEN SUITE. Every
 * finding below came from the user testing it at the table, not from the checks. Read this
 * before touching the offer half; the arithmetic was never implicated in any of it.
 *
 *   1. `dnd5e.rollAbilityCheckV2` AND `dnd5e.rollSavingThrowV2` DO NOT EXIST. Measured in the
 *      5.3.3 source: `Actor5e##rollD20Test` serves BOTH ability checks and saving throws and
 *      fires only the non-V2 `dnd5e.roll${name}`. Only `#rollSkillTool` fires a V2 pair — and
 *      its tool hook is `rollToolCheck`, not `rollTool`. Registering a hook name that is never
 *      dispatched costs nothing and does nothing, forever, silently. **The suite now asserts
 *      that each hook FIRES** (smoke-d20-folds §4) rather than that it is registered.
 *   2. Saving throws were not hooked at all — neither the native kind nor the demanded kind.
 *   3. A DEMANDED save (Fireball, Shatter, Hold Person) folds its verdict the instant the roll
 *      lands, so an offer arriving afterwards is already too late. saves.js now WITHHOLDS that
 *      fold while an offer is live — see `offerFoldOnSave`.
 *   4. Only the FIRST listed fold was offered. `heroic` is first in the shipped list, so it
 *      masked Tactical Mind and Bardic entirely. The offer is now MULTI-SELECT.
 *   5. Nothing matched a fold to the KIND of roll, so Tactical Mind — an ability-check feature —
 *      was offerable on an attack. Each kind now declares the tests it is legal on.
 *
 * ---------------------------------------------------------------------------------------------
 * THE THREE SPENDS (measured 2026-08-23, dnd5e 5.3.3 + this world's PHB pack)
 *
 *   heroic    has NO ACTIVITY ANYWHERE. `system.attributes.inspiration` is a bare BooleanField
 *             and a boolean is not one of the five consumption kinds, so there is no route to
 *             `use()`. Spending it is a WRITE — what the system's own sheet toggle does.
 *   bardic    lands on the recipient as an ACTIVE EFFECT ("Inspired", 1 hour, transfer:false)
 *             with no item and no activity. Spending it is a DELETE. Its die formula,
 *             `@scale.bard.inspiration`, is a scale value on the GRANTING BARD, read
 *             cross-actor through the effect's `origin`.
 *   tactical  is the only Precision-shaped one: a real utility activity with `roll.formula`
 *             "1d10", consuming `itemUses` against Second Wind.
 *
 * ---------------------------------------------------------------------------------------------
 * WHERE THE MODULE MAY OFFER BY ITSELF (HANDOFF ruling 2b)
 *
 * `Actor5e##rollD20Test` never sets `options.target` for a plain check: dnd5e records no DC for
 * a raw ability check anywhere, because the GM holds it in their head. So the gate exists only
 * where the module OWNS the number:
 *
 *   attack             AC on the attack's own target snapshot   → auto-offer on a clean miss
 *   DEMANDED save      the DC the ask owns                      → auto-offer on a failure
 *   native save        nothing                                  → the player presses a button
 *   ability/skill/tool nothing, ever                            → the player presses a button
 *
 * ⚠ `d20FoldAsk` can turn auto-offering OFF; it cannot turn it on where no number exists.
 * ------------------------------------------------------------------------------------------- */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, canAnswerFor } from "./core.js";
import { d20FoldEntries } from "./settings.js";
import { hitTargets, modeAllows } from "./shared.js";
import { bfCard, holdBarHTML, RESCUE_KINDS, rescueLabel, rescueView, rescueSourceFor }
  from "./decide/present.js";
import { ATTACK_FOLDS, SAVE_FOLDS, foldsFrom, foldedRoll, foldedVerdict } from "./decide/verdict.js";
import { momentButton, scheduleBarSync, armAskTimer, disarmAskTimer,
  registerRescue, syncRescuePopup } from "./ui.js";
import { offerDamageRoll, rollDamageForAttack } from "./auto-damage.js";

/**
 * THE PER-KIND TABLES ARE VIEWS ONTO `RESCUE_KINDS` (decide/present.js), NOT COPIES.
 *
 * ⚠ ONE COPY OF EACH QUOTE. The rescue view draws the same labels, glyphs, cost sentences and
 * verbatim rules text into its rows, and presentation law 8 says the quote IS the rule — so two
 * copies that drift are the module telling the table something untrue. The strings, and the
 * long arguments for why each of them is per-kind data (the lookup-key/label split, the cost
 * sentences that get two of three wrong if you guess at them), live there now.
 *
 * ⚠ The local names stay because every call site in this file reads better with them, and
 * because a per-kind lookup is exactly what this file wants. `RESCUE_KINDS` also carries
 * `precision`, which is another machine's kind and simply never appears as a `d20fold` key.
 */
const kindTable = pick => Object.fromEntries(
  Object.entries(RESCUE_KINDS).map(([kind, spec]) => [kind, spec[pick]]));
const KIND_LABEL = kindTable("label");
const SPEND_COST = kindTable("cost");
const labelOf = rescueLabel;

/* =============================================================================================
 * THE SPEND RESOLVERS — one per kind (ARCHITECTURE.md §6 rule 3)
 *
 * ⚠ `tests` is the eligibility half and it is NOT decoration: it is the feature's own trigger,
 * read off its rules text. Tactical Mind says "when you fail an ABILITY CHECK" and is illegal
 * on an attack; the other two say "any die" / "a D20 Test" and reach everything. v1 had no such
 * matching and would have offered Tactical Mind on an attack roll whenever heroic happened to
 * be unavailable — a bug the shipped list ORDER was accidentally hiding.
 * ========================================================================================== */

const HEROIC = {
  tests: ["attack", "save", "check"],
  find: actor => ((actor?.type === "character") && (actor.system?.attributes?.inspiration === true))
    ? { kind: "heroic" } : null,
  die: () => null,                                        // a REROLL contributes no die
  /**
   * ⚠ THE WRITE IS THE SPEND. dnd5e's consumption kinds are activityUses · itemUses · material ·
   * hitDice · spellSlots · attribute, and a boolean is none of them; there is no reroll code
   * anywhere in 5.3.3 either. This is the same update the system's own sheet toggle performs.
   */
  spend: async actor => { await actor.update({ "system.attributes.inspiration": false }); return true; }
};

/**
 * Tactical Mind — checks only, by its own rules text.
 *
 * ⚠ THE CONSUMPTION TARGET IS A COMPENDIUM UUID ON DISK AND A LOCAL ITEM ID IN MEMORY. The
 * shipped item consumes `itemUses` against
 * `Compendium.dnd-players-handbook.classes.Item.phbftrSecondWind`; dnd5e re-links that to the
 * actor's own copy in `prepareData` (`Activity#_remapConsumptionTarget`), but ONLY via
 * `actor.sourcedItems`, which matches on recorded compendium source. An actor whose Second Wind
 * came from a DDB import or a hand-made copy fails the remap, the target stays a UUID, and the
 * feature would offer NOTHING FOREVER with no error. The pool miss is therefore REPORTED rather
 * than read as "no uses left" — a mis-sourced feature and an exhausted one look identical from
 * outside and only one of them is the table's fault.
 */
const TACTICAL = {
  tests: ["check"],
  find: (actor, entry) => {
    const item = actor?.items?.find(i => i.name.toLowerCase() === entry.name.toLowerCase());
    const activity = item?.system.activities?.contents?.[0];
    if ( !activity ) return null;
    for ( const c of (activity.consumption?.targets ?? []) ) {
      if ( c.type !== "itemUses" ) continue;
      const pool = c.target ? actor.items.get(c.target) : item;
      if ( !pool ) {
        warnOnce(`${entry.name}|unremapped`, `${TITLE} | "${entry.name}" consumes uses of an item `
          + `this actor does not have (target "${c.target}"). If that looks like a compendium `
          + "UUID rather than an id, the actor's copy of the pool item was not imported from the "
          + "pack the feature expects, so dnd5e could not re-link it — the fold stays off.");
        return null;
      }
      if ( (pool.system.uses?.value ?? 0) <= 0 ) return null;   // genuinely spent — stay quiet
    }
    return { kind: "tactical", item, activity };
  },
  die: marker => marker.activity.roll?.formula || null,
  spend: async (_actor, marker, message) => {
    await marker.activity.use({ subsequentActions: false }, { configure: false }, {
      data: { flags: { dnd5e: { originatingMessage: message.id } } }
    });
    return true;
  }
};

/**
 * A Bardic Inspiration die somebody gave you.
 *
 * ⚠ THE DIE IS THE BARD'S, NOT YOURS, and getting that wrong is silent. See `die` below.
 */
const BARDIC = {
  tests: ["attack", "save", "check"],
  find: (actor, entry) => {
    const effect = actor?.effects?.find(e =>
      !e.disabled && (e.name?.toLowerCase() === entry.name.toLowerCase()));
    return effect ? { kind: "bardic", effect } : null;
  },
  die: marker => {
    const bard = grantingActor(marker.effect);
    if ( !bard ) {
      warnOnce(`bardic|${marker.effect.id}`, `${TITLE} | "${marker.effect.name}" does not lead back `
        + `to the actor who granted it (origin "${marker.effect.origin}"), and the die size is `
        + "theirs to know — the fold stays off rather than guessing one.");
      return null;
    }
    /**
     * ⚠ RESOLVED HERE, AGAINST THE BARD, AND IT MUST BE — measured in the sandbox 2026-08-23,
     * and this is the most dangerous line in the file:
     *
     *     new Roll("@scale.bard.inspiration", bard.getRollData())      → "1d8", total 7   ✅
     *     new Roll("@scale.bard.inspiration", recipient.getRollData()) → "0",    total 0   ⚠
     *
     * The second does NOT throw and does NOT warn. An unresolved `@scale` token collapses to
     * literal zero, so handing the raw token to the recipient's roll data would spend a real
     * Bardic die, post a public roll, and add EXACTLY NOTHING — a wrong number that reads as an
     * unlucky one. Resolving to a literal here makes the recipient's roll data irrelevant.
     *
     * ⚠ `ScaleValueTypeDice` carries `formula`/`die` ("d8") as GETTERS — `JSON.stringify` shows
     * only `{number, faces, modifiers}`, so a serialized snapshot looks like it has no formula.
     * Never stringify the object into a formula; refuse anything that is not a plain string.
     */
    const scale = foundry.utils.getProperty(bard.getRollData(), "scale.bard.inspiration");
    const formula = scale?.formula ?? scale?.die ?? null;
    if ( (typeof formula !== "string") || !formula.trim() ) {
      warnOnce(`bardic|scale|${bard.id}`, `${TITLE} | ${bard.name} has no readable bard inspiration `
        + "scale value, so the die they grant cannot be known — the fold stays off rather than "
        + "guessing a d6.");
      return null;
    }
    return formula;
  },
  spend: async (_actor, marker) => { await marker.effect.delete(); return true; }
};

const KINDS = { heroic: HEROIC, tactical: TACTICAL, bardic: BARDIC };

/** The bard behind an Inspired effect: `origin` is their ITEM, and the actor is its parent. */
function grantingActor(effect) {
  try {
    const origin = effect?.origin ? fromUuidSync(effect.origin) : null;
    return (origin?.actor instanceof Actor) ? origin.actor : null;
  } catch { return null; }
}

/** Warn once per distinct cause — the list parsers' discipline, applied to content problems. */
const warned = new Set();
function warnOnce(key, message) {
  if ( warned.has(key) ) return;
  warned.add(key);
  console.warn(message);
}

/**
 * EVERY listed fold this actor can spend on THIS KIND of test, in list order.
 *
 * ⚠ v1 returned the first match and stopped, which meant `heroic` — first in the shipped list —
 * masked Tactical Mind and Bardic completely. Three separate table reports, one cause. The
 * table curates the list; it does not thereby choose which resource a player burns.
 *
 * `spent` excludes kinds already used on this roll, so the re-offer after a fold resolves does
 * not offer the same die twice.
 */
function availableFolds(actor, testKind, spent = []) {
  const out = [];
  for ( const entry of d20FoldEntries() ) {
    const spec = KINDS[entry.kind];
    if ( !spec || !spec.tests.includes(testKind) ) continue;
    if ( spent.includes(entry.kind) ) continue;
    const marker = spec.find(actor, entry);
    if ( !marker ) continue;
    const dieFormula = spec.die(marker);
    if ( (entry.kind !== "heroic") && !dieFormula ) continue;   // a die-kind with no die is off
    // ⚠ `name` is the LOOKUP KEY (the item or effect to find); `label` is what the table reads.
    // For `bardic` those genuinely differ — "Inspired" vs "Bardic Inspiration". See KIND_LABEL.
    out.push({ kind: entry.kind, name: entry.name, label: KIND_LABEL[entry.kind] ?? entry.name,
      dieFormula });
  }
  return out;
}

/* =============================================================================================
 * STAMP — the roller's own client, on the message it authored (the precision locality)
 * ========================================================================================== */

const foldTimers = new Map();
const foldInFlight = new Set();

function baseFlag(actor, offers, testKind, total, window) {
  return {
    status: "pending",
    testKind,
    actorUuid: actor.uuid,
    baseTotal: total,
    offers,                                   // ⚠ every eligible fold, not the first one
    spends: [],                               // what has actually been burned, in order
    answer: null,
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  };
}

/**
 * ATTACKS — the module owns the AC, so this is Precision's own path: a clean miss, every judged
 * target missed, and an offer that arrives by itself.
 */
Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  try {
    if ( !setting(S.d20FoldAsk) ) return;
    if ( !subject || (subject.type !== "attack") ) return;
    const attacker = subject.actor;
    if ( !attacker || !modeAllows(attacker) ) return;
    const message = rolls?.[0]?.parent;
    if ( !(message instanceof ChatMessage) ) return;
    if ( message.getFlag(MODULE_ID, "d20fold") ) return;            // never re-stamp
    const roll = rolls[0];

    let offers = availableFolds(attacker, "attack");
    // ⚠ A natural 1 stands for the ADD kinds — precision's fence, same reason: no die added to a
    // fumble un-fumbles it. It does NOT stand for `heroic`, because a reroll replaces the die
    // outright and rerolling a 1 is the entire point of the feature.
    if ( roll.isFumble ) offers = offers.filter(o => o.kind === "heroic");
    if ( !offers.length ) return;

    const snapshot = message.getFlag("dnd5e", "targets") ?? [];
    if ( !snapshot.length || hitTargets(message).length ) return;   // clean misses only
    const judged = snapshot.filter(t => (t.ac !== null) && (t.ac !== undefined));
    if ( !judged.length ) return;                                   // null AC — humans have it

    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await message.setFlag(MODULE_ID, "d20fold", {
      ...baseFlag(attacker, offers, "attack", roll.total, window),
      targets: judged.map(t => ({ uuid: t.uuid, name: t.name, ac: t.ac,
        margin: t.ac - roll.total, verdict: null }))
    });
    armFoldTimer(message);
  } catch(err) {
    console.error(`${TITLE} | D20 fold stamp (attack) failed.`, err);
  }
});

/**
 * CHECKS AND NATIVE SAVES — no DC exists, so these stamp an OFFER and never a gate.
 *
 * ⚠ THEY CARRY THE SAME CLOCK AS EVERY OTHER MOMENT. v1 stamped these with no window, on the
 * reasoning that an offer nobody is waiting on should not run a timer. That was wrong twice
 * over once the offer started popping (user ruling): law 11 says **every moment has a clock
 * that RESOLVES it**, and a modal with no clock is a modal that sits on screen until somebody
 * clicks it — which is precisely the stale-popup state law 4 calls a lie on screen. The clock
 * here resolves to `pass` and spends nothing, so the cost of letting it run out is zero.
 * ⚠ `holdTimer: 0` is still the documented "wait forever" escape hatch — a zero window stamps
 * no deadline at all, and `armAskTimer` has nothing to arm.
 *
 * ⚠ THE HOOK NAMES ARE THE ONES THE SYSTEM ACTUALLY DISPATCHES, not the V2 names the rest of
 * the module uses. `#rollD20Test` (ability checks AND saving throws) fires only the non-V2
 * name; `#rollSkillTool` fires both, and calls the tool one `rollToolCheck`. Getting this wrong
 * is invisible — see the header. smoke-d20-folds §4 asserts each one fires.
 */
const PLAIN_HOOKS = [
  ["dnd5e.rollAbilityCheck", "check"],
  ["dnd5e.rollSkill", "check"],
  ["dnd5e.rollToolCheck", "check"],
  ["dnd5e.rollSavingThrow", "save"]
];
for ( const [hook, testKind] of PLAIN_HOOKS ) {
  Hooks.on(hook, async (rolls, { subject }) => {
    try {
      if ( !(subject instanceof Actor) || !modeAllows(subject) ) return;
      const message = rolls?.[0]?.parent;
      if ( !(message instanceof ChatMessage) ) return;
      if ( message.getFlag(MODULE_ID, "d20fold") ) return;
      // ⚠ A DEMANDED save is handled by saves.js through `offerFoldOnSave`, which knows the DC
      // and can therefore gate on the failure. Stamping here as well would put an ungated
      // button on the same message and race the withheld verdict.
      if ( (testKind === "save") && pendingSaveDemandFor(subject) ) return;
      const offers = availableFolds(subject, testKind);
      if ( !offers.length ) return;
      const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
      await message.setFlag(MODULE_ID, "d20fold",
        baseFlag(subject, offers, testKind, rolls[0].total, window));
      armFoldTimer(message);
    } catch(err) {
      console.error(`${TITLE} | D20 fold stamp (${hook}) failed.`, err);
    }
  });
}

/** Is this actor mid-answer on a save this module demanded? Read off the demand cards, so the
 * native-roll path can stand aside without importing the save machine. */
function pendingSaveDemandFor(actor) {
  return game.messages.contents.some(m => {
    const flag = m.getFlag(MODULE_ID, "saves");
    return flag && (flag.status === "pending")
      && (flag.targets ?? []).some(t => !t.done && (t.uuid === actor.uuid));
  });
}

const armFoldTimer = message =>
  armAskTimer(foldTimers, message, "d20fold", live => answerFold(live, "pass", { timedOut: true }));

/* =============================================================================================
 * THE DEMANDED-SAVE EDGE — the one export, and the only one
 *
 * ⚠ WHY THIS EXISTS AT ALL. Fireball, Shatter and Hold Person all demand saves through saves.js,
 * which folds and APPLIES the verdict the instant the roll lands. An offer arriving afterwards
 * is already too late — the damage is on the sheet. Three table reports in one session; the v1
 * decision to defer this path was simply wrong.
 *
 * ⚠ WITHHOLD, DO NOT UNDO. saves.js pauses its verdict while this offer is live, exactly as a
 * reaction hold pauses an attack chain. That keeps this clear of §11 rule 4's auto-revert debt:
 * nothing has been applied yet, so nothing has to be taken back.
 *
 * Returns true when an offer was stamped and the caller must NOT fold yet.
 * ========================================================================================== */
export async function offerFoldOnSave(rollMessage, card, uuid, total, dc) {
  try {
    if ( !setting(S.d20FoldAsk) ) return false;
    const existing = rollMessage.getFlag(MODULE_ID, "d20fold");
    if ( existing ) return existing.status === "pending";   // already asked; don't ask twice
    if ( !Number.isFinite(dc) || !Number.isFinite(total) || (total >= dc) ) return false;
    const actor = await fromUuid(uuid);
    if ( !(actor instanceof Actor) || !modeAllows(actor) ) return false;
    const offers = availableFolds(actor, "save");
    if ( !offers.length ) return false;

    const window = Math.max(0, Number(setting(S.saveTimer)) || 0);
    await rollMessage.setFlag(MODULE_ID, "d20fold", {
      ...baseFlag(actor, offers, "save", total, window),
      dc,                                   // ⚠ the ask OWNS it — never re-derived here
      resume: { cardId: card.id, uuid }     // how the withheld verdict gets finished
    });
    armFoldTimer(rollMessage);
    return true;
  } catch(err) {
    console.error(`${TITLE} | D20 fold offer on save failed.`, err);
    return false;   // ⚠ fail OPEN: a broken offer must never swallow a save's verdict
  }
}

/** Finish a verdict saves.js withheld for us — win, lose or pass, the save must resolve. */
async function resumeWithheldSave(flag, rollMessage) {
  if ( !flag?.resume ) return;
  try {
    const card = game.messages.get(flag.resume.cardId);
    if ( !card ) return;
    const { foldSaveAnswer } = await import("./saves.js");
    await foldSaveAnswer(card, flag.resume.uuid, rollMessage);
  } catch(err) {
    console.error(`${TITLE} | resuming the withheld save failed.`, err);
  }
}

/* =============================================================================================
 * ANSWER + RESOLVE
 * ========================================================================================== */

/** `answer` is a KIND to spend, or "pass". First writer wins, then the work is executed. */
async function answerFold(message, answer, { timedOut = false } = {}) {
  let claimed = false;
  await queueFlagWrite(message, "d20fold", current => {
    if ( (current.status !== "pending") || current.answer ) return;
    if ( (answer !== "pass") && !(current.offers ?? []).some(o => o.kind === answer) ) return;
    current.answer = answer;
    current.answeredAt = Date.now();          // the crash-resume horizon (the topple discipline)
    if ( timedOut ) current.timedOut = true;
    if ( answer === "pass" ) {
      current.status = "resolved";
      current.outcome = current.spends?.length ? "used" : (timedOut ? "passed (timer)" : "passed");
    }
    claimed = true;
  });
  if ( !claimed ) return;
  const live = message.getFlag(MODULE_ID, "d20fold");
  if ( answer === "pass" ) {
    if ( !live?.spends?.length ) await announceIfNeeded(message, live);
    await resumeWithheldSave(live, message);
    return;
  }
  await resolveFold(message, answer);
}

/** The accept path: spend the marker, roll (or REROLL), stamp, announce, re-offer or finish. */
async function resolveFold(message, kind) {
  if ( foldInFlight.has(message.id) ) return;
  foldInFlight.add(message.id);   // before the first await — the continueHold discipline
  try {
    const flag = message.getFlag(MODULE_ID, "d20fold");
    if ( !flag || (flag.answer !== kind) || (flag.status !== "pending") ) return;
    const actor = await fromUuid(flag.actorUuid);
    if ( !(actor instanceof Actor) ) return;
    const spec = KINDS[kind];
    const offer = (flag.offers ?? []).find(o => o.kind === kind);
    if ( !spec || !offer ) return;

    // ⚠ RE-FIND AT RESOLVE TIME, never trust the stamp. Minutes can pass inside the window and
    // the marker can be gone — the boolean toggled off on the sheet, the effect expired, the
    // last Second Wind spent elsewhere. Recording a spend that did not happen shipped a lie
    // once (ui.js:407); spending something no longer there is the same lie in reverse.
    const marker = spec.find(actor, { name: offer.name, kind });
    if ( !marker ) {
      await queueFlagWrite(message, "d20fold", current => {
        current.status = "resolved";
        current.outcome = current.spends?.length ? "used" : "gone";
      });
      await resumeWithheldSave(flag, message);
      return;
    }

    // 1. REALLY spend it — a write, a use() or a delete, whichever this kind is.
    if ( !(await spec.spend(actor, marker, message)) ) return;

    // 2. The new number, public, stamped so no other recognizer can claim it.
    const rolled = (kind === "heroic")
      ? await rerollOf(message, actor)
      : await rollDie(spec.die(marker) ?? offer.dieFormula, actor);
    if ( !rolled ) return;
    await rolled.roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: (kind === "heroic") ? `${labelOf(offer)} — the reroll` : `${labelOf(offer)} — the die`,
      flags: { [MODULE_ID]: { respondsTo: message.id } }
    });

    // 3. Record the spend, then compose the verdict across EVERY fold on this message.
    //
    // ⚠ THE 2026-08-23 RULING, OBEYED RATHER THAN QUOTED, and not hypothetical: maneuvers.js
    // registers `dnd5e.rollAttackV2` BEFORE this file, so a Battle Master holding Heroic
    // Inspiration is offered a Precision die AND a fold on the same missed attack. Announcing
    // `baseTotal + die` here would ignore a superiority die already spent on the same roll and
    // disagree with `hitTargets`, which walks the whole registry. Compose ONCE, through the
    // path every other reader uses.
    const spends = [...(flag.spends ?? []), {
      kind, name: offer.name, label: offer.label,
      ...(kind === "heroic" ? { reroll: rolled.summary } : { die: rolled.summary.total })
    }];
    const pending = { ...flag, status: "resolved", outcome: "used", spends };
    /**
     * ⚠ PICK THE SPEC SET BY TEST KIND. This defaulted to `ATTACK_FOLDS` and that was a real
     * bug the table caught: the attack spec walks `flag.targets` (an attack is one roll judged
     * against many targets), so on a CHECK or a SAVE — which have no `targets` at all — it
     * returned an EMPTY fold list and the die contributed nothing. Tactical Mind spent a use of
     * Second Wind, rolled its 1d10 in public, and then announced the unchanged total.
     *
     * ⚠ The save VERDICT was never wrong, because saves.js composes it itself through
     * `SAVE_FOLDS` — which is exactly what made this hard to see: the number on the save card
     * was right while the number on the fold's own card was not. That divergence is the
     * "card disagrees with its own arithmetic" class receipt arithmetic was unified to kill,
     * and it reappeared here because this resolver reached for the default instead of choosing.
     */
    const folds = foldFolds(message, pending);
    const baseRoll = foldBase(message, flag);
    /**
     * ⚠ ONE TARGET'S SLICE, NOT THE WHOLE LIST — the multi-target trap, and the twin of the
     * bug this resolver's precision counterpart shipped. An attack is ONE roll judged against
     * MANY targets, so `ATTACK_FOLDS` holds a contribution per (target × spend): two missed
     * targets and one bardic die is TWO `add`s of that die, and summing them announces a
     * number nobody rolled and stores it as `foldedTotal`. `foldedVerdict` has always filtered
     * by uuid, so the VERDICTS were right the whole time and only the sentence lied — the
     * "card disagrees with its own arithmetic" class again, one level up from the verdict.
     *
     * ⚠ Why one target's slice is the whole roll's number: every ATTACKER-side contribution is
     * the same for every target (the spend list does not vary by who was swung at), and the
     * only per-target contribution is the defence-side `ac`, which `foldedRoll` does not read.
     * A save or a check has no target dimension at all — `SAVE_FOLDS` yields one contribution
     * per spend — so that side composes flat, exactly as it always has.
     */
    const composed = (flag.testKind === "attack")
      ? foldedRoll(baseRoll, folds.filter(f => f.uuid === flag.targets?.[0]?.uuid))
      : foldedRoll(baseRoll, folds);

    // What is still available AFTER this spend — the re-offer (finding 6).
    const remaining = availableFolds(actor, flag.testKind, spends.map(s => s.kind));
    const stillFailing = isStillFailing(flag, composed, baseRoll, folds);
    const reoffer = remaining.length && stillFailing;

    const lines = [];
    let anyHit = false;
    await queueFlagWrite(message, "d20fold", current => {
      current.spends = spends;
      current.foldedTotal = composed.total;
      current.answer = null;                       // ⚠ cleared so a re-offer can be answered
      current.offers = reoffer ? remaining : [];
      current.status = reoffer ? "pending" : "resolved";
      if ( !reoffer ) current.outcome = "used";
      // ⚠ A RE-OFFER NEEDS A FRESH DEADLINE. The original is spent by the time the first fold
      // has rolled and announced, so re-arming against it would fire the timer immediately and
      // pass the second offer before anyone could read it — an offer that expires before it is
      // shown is worse than not offering at all.
      if ( reoffer && current.window ) current.deadline = Date.now() + (current.window * 1000);
      else if ( !reoffer ) delete current.deadline;
      if ( current.testKind === "attack" ) {
        for ( const t of current.targets ?? [] ) {
          t.verdict = foldedVerdict(t, baseRoll, folds);
          if ( t.verdict === "hit" ) anyHit = true;
          const ac = folds.filter(f => f.uuid === t.uuid).findLast(f => Number.isFinite(f.ac))?.ac
            ?? t.ac;
          lines.push(`${sumText(flag, composed)} vs AC ${ac} — `
            + (t.verdict === "hit" ? `<strong>now hits ${t.name}</strong>` : `still misses ${t.name}`));
        }
      } else if ( Number.isFinite(current.dc) ) {
        const made = composed.total >= current.dc;
        lines.push(`${sumText(flag, composed)} vs DC ${current.dc} — `
          + (made ? "<strong>now saves</strong>" : "still fails"));
      } else {
        // ⚠ NO VERDICT WITHOUT A DC — the finding, showing up in the prose. The module does not
        // know a raw check's DC, so it states the ARITHMETIC and stops (presentation law 5).
        lines.push(`${sumText(flag, composed)} — the roll now totals <strong>${composed.total}</strong>.`);
      }
    });

    // ⚠ The unmodelled refund goes on the SETTLE CARD too, not just the row. This is the card
    // the table actually reads at the moment the use is spent, and Tactical Mind is the one
    // fold whose rule says the use may come back — see resolvedLines for the full argument.
    if ( kind === "tactical" ) {
      lines.push("⚠ If the check still fails, this use of Second Wind isn't expended — "
        + "restore it by hand; the module cannot tell whether the check succeeded.");
    }
    await announce(message, actor, labelOf(offer), flag.testKind, anyHit, lines, marker);

    if ( reoffer ) {
      // Still failing and something left to spend: ask again rather than deciding for them.
      // ⚠ The window is REDRAWN rather than re-popped. A second offer that rendered only as a
      // card row would be invisible to whoever is looking at the window — the reason the latch
      // used to be cleared here — but the surviving rows have been on screen since the first
      // stamp, so what is needed is a redraw, not a new popup. The spine's content signature
      // decides: changed, so it reopens.
      syncRescuePopup(message);
      if ( message.getFlag(MODULE_ID, "d20fold")?.deadline ) armFoldTimer(message);
      return;
    }

    // 4. Finish: re-drive an attack chain, or hand a withheld save back to saves.js.
    if ( flag.testKind === "save" ) {
      await resumeWithheldSave(flag, message);
      return;
    }
    if ( flag.testKind !== "attack" ) return;
    if ( !anyHit || !hitTargets(message).length ) return;
    const attackActivity = await fromUuid(message.getFlag("dnd5e", "activity")?.uuid);
    if ( !attackActivity ) return;
    if ( setting(S.playerRollDamage) ) return void offerDamageRoll(attackActivity, message);
    await rollDamageForAttack(attackActivity, message);
  } catch(err) {
    console.error(`${TITLE} | D20 fold resolution failed.`, err);
  } finally {
    foldInFlight.delete(message.id);
  }
}

/**
 * Is the roll still a failure after everything spent so far? ⚠ A CHECK ALWAYS ANSWERS YES, and
 * that is the DC finding again: with no number to test against the module cannot know the roll
 * succeeded, so it keeps offering and lets the human stop by pressing Pass. Deciding "you made
 * it, no more offers" would be inventing the DC.
 */
function isStillFailing(flag, composed, baseRoll, folds) {
  if ( flag.testKind === "attack" ) {
    return !(flag.targets ?? []).some(t => foldedVerdict(t, baseRoll, folds) === "hit");
  }
  if ( Number.isFinite(flag.dc) ) return composed.total < flag.dc;
  return true;
}

/** The arithmetic sentence — a reroll REPLACES and reads with an arrow; a die ADDS and sums. */
const sumText = (flag, composed) => composed.replaced
  ? `${flag.baseTotal} → ${composed.total}`
  : `${flag.baseTotal} + ${composed.added} = ${composed.total}`;

async function announce(message, actor, name, testKind, anyHit, lines, marker) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({
      img: marker?.item?.img ?? marker?.effect?.img ?? null,
      eyebrow: `D20 Fold — ${name}`,
      tone: (testKind === "attack") ? (anyHit ? "good" : "neutral") : "good",
      title: (testKind === "attack")
        ? (anyHit ? `${name} — the miss becomes a hit` : `${name} — still a miss`)
        : `${name} — the roll is patched`,
      subtitle: `${actor.name} spends ${name}`,
      lines
    })
  });
}

/** A pass with nothing spent says so on a WITHHELD save, where the table is waiting on it. */
async function announceIfNeeded(message, flag) {
  if ( !flag?.resume ) return;
  const actor = (() => { try { return fromUuidSync(flag.actorUuid); } catch { return null; } })();
  if ( !actor ) return;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({
      eyebrow: "D20 Fold", tone: "neutral", title: "Passed — the save stands",
      subtitle: actor.name,
      lines: [`${flag.baseTotal} vs DC ${flag.dc} — nothing spent.`]
    })
  });
}

/** A plain added die, from the content's own formula. */
async function rollDie(formula, actor) {
  if ( !formula ) return null;
  const roll = new Roll(String(formula), actor.getRollData());
  await roll.evaluate();
  return { roll, summary: { total: roll.total, isCritical: false, isFumble: false } };
}

/**
 * THE REROLL. ⚠ Rebuilt from the ORIGINAL roll's own class, data and options — not a fresh
 * `new Roll("1d20+…")`. A D20Roll decides `isCritical`/`isFumble` from
 * `options.criticalSuccess`/`criticalFailure`, which an actor can move (a Champion crits on 19);
 * a plain Roll would silently reinstate a 20-only threshold and lose a crit the table is owed.
 * This is also why a reroll is a `replace` and not an `add` (decide/verdict.js).
 */
async function rerollOf(message, actor) {
  const original = message.rolls?.[0];
  if ( !original ) return null;
  const RollCls = original.constructor;
  const roll = new RollCls(original.formula, original.data ?? actor.getRollData(),
    foundry.utils.deepClone(original.options ?? {}));
  await roll.evaluate();
  return { roll, summary: {
    total: roll.total,
    isCritical: roll.isCritical === true,
    isFumble: roll.isFumble === true
  } };
}

/* =============================================================================================
 * PRESENT — a button PER OFFER, on the card and in the popup
 * ========================================================================================== */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, "d20fold");
    if ( !flag ) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if ( !root ) return;

    const actor = (() => { try { return fromUuidSync(flag.actorUuid); } catch { return null; } })();
    const block = document.createElement("div");
    block.className = "battleflow-d20fold";
    block.style.margin = "0.4rem 0 0";

    if ( flag.status === "pending" ) {
      const offers = flag.offers ?? [];
      /**
       * ⚠ THE CARD IS A CARD, NOT A ROW OF NAKED BUTTONS (user 2026-08-23). v1 appended bare
       * `momentButton`s to a bare div, which read as a debug affordance next to the reaction
       * hold's card sitting inches away on the same log. The hold is the house shape: a
       * `bfCard` with art, an eyebrow, a subtitle naming who is being waited on, the reveal
       * lines and the shared bar.
       *
       * ⚠ AND ONE INPUT SURFACE, which is the half that is architecture rather than taste
       * (hold.js's own note): the POPUP decides and the card only offers a way to call it
       * BACK. v1 put a full set of answer buttons on the card AND in the popup — two surfaces
       * for one decision, which is exactly what the hold family stopped doing in 2026-08-16.
       */
      block.innerHTML = bfCard({
        img: foldImg(actor, offers),
        eyebrow: "D20 Fold — offered",
        title: offers.length === 1 ? labelOf(offers[0]) : `${offers.length} ways to patch this roll`,
        subtitle: `${actor?.name ?? ""} · ${testKindPhrase(flag)}`,
        tone: "pending",
        lines: offerLines(flag, offers)
      }) + holdBarHTML(flag, "to answer");
      scheduleBarSync(block);
      root.append(block);

      if ( !canAnswerFor(actor) ) return;      // spectators get the card, not the controls
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        display: "flex", gap: "0.3rem", marginTop: "0.4rem", justifyContent: "flex-end"
      });
      controls.append(momentButton("Answer", () => {
        syncRescuePopup(message, { recall: true });
      }, { flex: "0 0 auto", margin: "0", padding: "0 0.4rem", fontSize: "inherit", lineHeight: "1.4" }));
      block.append(controls);

      /**
       * ⚠ EVERY OFFER POPS, TIMED OR NOT (user ruling 2026-08-23).
       *
       * v1 popped only when there was a deadline, reasoning that law 11's clock governs moments
       * that BLOCK and that a modal for an unblocked roll is the interruption N4 forbids. That
       * read the wrong law. **Presentation law 1 is "easy-to-forget moments get a popup, not
       * just a card"** — and a spendable Heroic Inspiration or Tactical Mind on a check you have
       * already rolled is the definition of easy to forget. A card row scrolls away; the whole
       * reason the popup family exists is that the table missed things exactly like this.
       *
       * The pairing rule (law 2) still holds and is unchanged: where there IS a deadline, the
       * popup and the card bar run off the same absolute one. An untimed offer simply renders
       * no bar — `holdBarHTML` already returns "" without a window, so nothing special is done
       * for it here.
       */
      syncRescuePopup(message);
      return;
    }

    // RESOLVED — the durable public record, in the same shape as the hold's settled card, so
    // scrollback reads consistently instead of switching typography halfway down a moment.
    if ( flag.outcome ) {
      const spends = flag.spends ?? [];
      const spent = spends.map(labelOf).join(" + ");
      const used = flag.outcome === "used";
      block.innerHTML = bfCard({
        img: foldImg(actor, spends),
        eyebrow: used ? "D20 Fold — spent"
          : (flag.outcome === "gone") ? "D20 Fold — gone"
          : flag.timedOut ? "D20 Fold — timed out" : "D20 Fold — passed",
        title: used ? spent : "Nothing spent",
        subtitle: actor?.name ?? "",
        tone: used ? "good" : "neutral",
        lines: resolvedLines(flag)
      });
      root.append(block);
    }
  } catch(err) {
    console.error(`${TITLE} | D20 fold render failed.`, err);
  }
});

/**
 * The art for the card — the marker's own, the way the hold shows the reaction's.
 * ⚠ `heroic` has NO DOCUMENT, so it contributes no art and the next named fold supplies it;
 * an actor with only Heroic Inspiration falls through to their portrait rather than a blank.
 */
function foldImg(actor, named = []) {
  for ( const n of named ) {
    const item = actor?.items?.find(i => i.name.toLowerCase() === n.name?.toLowerCase());
    if ( item?.img ) return item.img;
    const effect = actor?.effects?.find(e => e.name?.toLowerCase() === n.name?.toLowerCase());
    if ( effect?.img ) return effect.img;
  }
  return actor?.img ?? null;
}

/** What kind of roll is being patched, in table English — the card's subtitle half. */
function testKindPhrase(flag) {
  if ( flag.testKind === "attack" ) return "the attack missed";
  if ( flag.testKind === "save" ) {
    return Number.isFinite(flag.dc) ? `the save failed (${flag.baseTotal} vs DC ${flag.dc})`
      : `saving throw · rolled ${flag.baseTotal}`;
  }
  return `check · rolled ${flag.baseTotal}`;
}

/** The offer card's body: what can be spent, and — under holdReveal — what it has to beat. */
function offerLines(flag, offers) {
  // ⚠ The cost rides on the offer's OWN line, so it reaches the card and the popup alike and
  // can never be read as applying to a different fold in the list.
  const lines = offers.map(o => `<strong>${labelOf(o)}</strong>`
    + (o.kind === "heroic" ? " — reroll the d20" : ` — add ${o.dieFormula}`)
    + (SPEND_COST[o.kind] ? ` <em>(${SPEND_COST[o.kind]})</em>` : ""));
  if ( setting(S.holdReveal) ) {
    for ( const t of flag.targets ?? [] ) {
      lines.push(`Needs +${t.margin} to reach ${t.name} (AC ${t.ac} vs ${flag.baseTotal}).`);
    }
    if ( Number.isFinite(flag.dc) ) {
      lines.push(`Needs +${flag.dc - flag.baseTotal} to reach DC ${flag.dc}.`);
    }
  }
  if ( flag.spends?.length ) {
    lines.push(`Already spent: <strong>${flag.spends.map(labelOf).join(", ")}</strong> — still short.`);
  }
  return lines;
}

/** The settled card's body — the numbers the verdict was reached with, as the hold does. */
function resolvedLines(flag) {
  if ( flag.outcome === "gone" ) return ["The resource was no longer there to spend."];
  if ( flag.outcome !== "used" ) {
    return [flag.timedOut
      ? "The window closed with no answer — the roll stands."
      : "Passed — the roll stands."];
  }
  const lines = [];
  if ( Number.isFinite(flag.foldedTotal) ) {
    lines.push(`<strong>${flag.baseTotal}</strong> → <strong>${flag.foldedTotal}</strong>`);
  }
  if ( flag.testKind === "attack" ) {
    for ( const t of flag.targets ?? [] ) {
      if ( t.verdict ) lines.push(t.verdict === "hit"
        ? `<strong>Now hits ${t.name}</strong> (AC ${t.ac}).`
        : `Still misses ${t.name} (AC ${t.ac}).`);
    }
  } else if ( Number.isFinite(flag.dc) ) {
    lines.push((flag.foldedTotal >= flag.dc)
      ? `<strong>The save succeeds</strong> against DC ${flag.dc}.`
      : `Still fails DC ${flag.dc}.`);
  }
  /**
   * ⚠ THE UNMODELLED REFUND, SAID OUT LOUD (user ruling 2026-08-23: leave it unmodelled).
   * Tactical Mind is the only one of the three with a refund clause, and the module cannot
   * decide it — the refund turns on the check FAILING and no DC exists for a check. Leaving the
   * rule unimplemented is a decision; leaving it unimplemented AND unmentioned would be the
   * module quietly eating a use the rules say the player keeps. So the card names it and hands
   * it to the humans, which is R1 rather than an apology.
   */
  if ( (flag.spends ?? []).some(s => s.kind === "tactical") ) {
    lines.push("⚠ If the check still fails, this use of Second Wind isn't expended — "
      + "restore it by hand; the module cannot tell whether the check succeeded.");
  }
  return lines;
}

/**
 * THE FOLD CONTRIBUTIONS THIS ROLL CARRIES — one home, so the resolver and the window can never
 * announce different numbers. `pending` substitutes the spend being resolved, which is not on
 * the message yet.
 *
 * ⚠ PICK THE SPEC SET BY TEST KIND, and ⚠ ONE TARGET'S SLICE on the attack side. Both arguments
 * are written out at `resolveFold`, which is this helper's other caller; the point of the
 * helper is that there is no second place for either of them to be got wrong.
 */
function foldFolds(message, flag) {
  const specs = (flag?.testKind === "attack") ? ATTACK_FOLDS : SAVE_FOLDS;
  const folds = foldsFrom(
    key => ((key === "d20fold") ? flag : message.getFlag(MODULE_ID, key)), specs);
  return (flag?.testKind === "attack")
    ? folds.filter(f => f.uuid === flag.targets?.[0]?.uuid) : folds;
}

/** The roll the folds compose over — the real d20 where there is one, the stamp's copy otherwise. */
const foldBase = (message, flag) => message.rolls?.[0] ?? { total: flag?.baseTotal };

/**
 * THE D20 FOLDS AS RESCUE ROWS (the merged window, ARCHITECTURE §5).
 *
 * ⚠ THIS MACHINE NO LONGER OPENS A POPUP OF ITS OWN, and neither does maneuvers.js. A Battle
 * Master holding a Bardic die is stamped by BOTH on one missed attack, and two windows, two
 * clocks and no cross-talk for ONE question is the discombobulation this pass exists to end.
 * The spine draws one window from every registered source; this file hands it a key and four
 * callbacks and never learns that maneuvers.js exists.
 *
 * ⚠ THE CARD IS UNCHANGED — pairing law 2. The durable block, its bar, its offer lines and its
 * Answer button all stay; what moved is only which window the Answer button opens.
 *
 * ⚠ AND THE ANSWER PATH IS UNCHANGED. `answerFold` still serialises through the flag lock,
 * first writer wins, the withheld-save protocol resumes exactly as it did. The rows carry the
 * KIND as their action token because that is this machine's own vocabulary — the spine hands
 * back whatever it was given.
 */
registerRescue("d20fold", {
  isPending: message => message.getFlag(MODULE_ID, "d20fold")?.status === "pending",
  subject: message => {
    const uuid = message.getFlag(MODULE_ID, "d20fold")?.actorUuid;
    try { return uuid ? fromUuidSync(uuid) : null; } catch { return null; }
  },
  view: message => {
    const flag = message.getFlag(MODULE_ID, "d20fold");
    if ( !flag ) return null;
    return rescueView(key => ((key === "d20fold") ? flag : null), {
      composed: foldedRoll(foldBase(message, flag), foldFolds(message, flag)),
      reveal: setting(S.holdReveal),
      sources: rescueSourceFor("d20fold")
    });
  },
  answer: (message, action) => answerFold(message, action)
});

/* =============================================================================================
 * EXPIRE + RESUME
 * ========================================================================================== */

Hooks.on("updateChatMessage", (message) => {
  const flag = message.getFlag(MODULE_ID, "d20fold");
  if ( !flag ) return;
  if ( flag.status !== "pending" ) {
    disarmAskTimer(foldTimers, message.id);
    // ⚠ SYNC, DO NOT CLOSE. This machine no longer owns a window — it owns ROWS in one. If the
    // sibling rescue is still pending the window must STAY, with this fold's rows greyed in
    // place; closing it here would take a live offer off the screen because a different one
    // finished. The spine closes it when nothing is left asking, and only then.
    syncRescuePopup(message);
    return;
  }
  // Crash-resume, the precision block's 20s horizon: an accepted offer whose resolver never ran
  // (the answerer's client died between the write and the spend) is picked up by whoever is
  // still here; `resolveFold` re-checks status so the two can never spend twice.
  if ( flag.answer && (flag.answer !== "pass") && flag.answeredAt
    && (Date.now() - flag.answeredAt > 20_000) ) {
    void resolveFold(message, flag.answer);
  }
});

Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(foldTimers, message.id);
  // ⚠ No latch to clear here any more. The spine's ONE delete-sweep already drops every
  // `${messageId}|` key, and the merged window's is `|rescue` — a key this file does not own
  // and must not name. Re-adding a feature's name to that sweep is exactly what it forbids.
});
