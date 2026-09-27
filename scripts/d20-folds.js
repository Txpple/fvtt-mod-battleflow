/**
 * Battle Flow — MACHINE layer (ARCHITECTURE.md §2): the post-roll D20 FOLDS, the spends that patch
 * an already-rolled d20 (ARCHITECTURE.md §11, "Adding a FOLD"). The original `Roll` is never
 * touched: the die posts as its own message stamped `respondsTo` and the verdict is recomputed on
 * a module flag. The module offers by itself only where it owns the number (an attack's snapshot
 * AC, a demanded save's DC); a raw check has no DC in dnd5e, so `d20FoldAsk` can turn
 * auto-offering off but never on. Depend downward only: core → decide → spine (ui) → here.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, canAnswerFor, isActiveGM, statContext }
  from "./core.js";
import { d20FoldEntries, metamagicEntries, listedNames } from "./settings.js";
import { activityNamed, cardActivity, itemNamed, lower, resolveUuid, resolveDie } from "./lookup.js";
import { grantingActor, hitTargets, modeAllows, poolSpendsOn, poolOf, spendPoolUses } from "./shared.js";
import { bfCard, holdBarHTML, momentBarHTML, popupKey, ruleLine, spendPhrase, RESCUE_KINDS, rescueLabel, rescueView, rescueSourceFor }
  from "./decide/present.js";
import { ATTACK_FOLDS, SAVE_FOLDS, foldsFrom, foldedRoll, foldedVerdict } from "./decide/verdict.js";
import { ADVANTAGE_BUYS, SAVE_SUCCEEDS, SUPERIORITY_FOLDS } from "./decide/registry.js";
import { CHIP_FLAG } from "./decide/chips.js";
import { foldRise } from "./decide/dice-chips.js";
import { cardRow, momentButton, scheduleBarSync, armAskTimer, disarmAskTimer, openMomentPopup, shownMoments, acknowledgeMoment, momentAcknowledged, registerRescue, syncRescuePopup, pendingDemandsFor, registerWithhold, resumeWithheld, dramaticVerdictPause } from "./ui.js";
import { offerDamageRoll, rollDamageForAttack } from "./auto-damage.js";
import { activityUuidOf, originData, targetsOf } from "./decide/card.js";

/** Per-kind views onto `RESCUE_KINDS`: one copy of each quoted string, shared with the rescue view. */
const kindTable = pick => Object.fromEntries(
  Object.entries(RESCUE_KINDS).map(([kind, spec]) => [kind, spec[pick]]));
const KIND_LABEL = kindTable("label");
const SPEND_COST = kindTable("cost");
const labelOf = rescueLabel;

// THE SPEND RESOLVERS, one per kind (ARCHITECTURE.md §6 rule 3). ⚠ `tests` is each feature's
// own trigger, read off its rules text (Tactical Mind: checks only).

const HEROIC = {
  tests: ["attack", "save", "check"],
  find: actor => ((actor?.type === "character") && (actor.system?.attributes?.inspiration === true))
    ? { kind: "heroic" } : null,
  die: () => null,                                        // a REROLL contributes no die
  /** ⚠ The write IS the spend: a boolean is none of dnd5e's consumption kinds, so there is no
   * activity to `use()` — this is the sheet toggle's own update. */
  spend: async actor => { await actor.update({ "system.attributes.inspiration": false }); return true; }
};

/** Tactical Mind. ⚠ The consumption target is a compendium UUID re-linked only via
 * `actor.sourcedItems`; a hand-copied Second Wind fails that silently, so a pool miss is REPORTED. */
const TACTICAL = {
  tests: ["check"],
  find: (actor, entry) => {
    const item = itemNamed(actor, entry.name);
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
      // `foldSpend` marks this use as the rescue's spend, so the sheet-arming hook stands aside.
      data: { ...originData(message.id), flags: { [MODULE_ID]: { foldSpend: message.id } } }
    });
    return true;
  }
};

/** A Bardic Inspiration die somebody gave you. ⚠ The die is the BARD's (see `die`). */
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
    // ⚠ Resolved against the BARD: against the recipient `@scale.bard.inspiration` is silently 0.
    // ⚠ `formula`/`die` are getters on `ScaleValueTypeDice`; accept only a plain string.
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

/** Seeking Spell: a spell attack's miss rerolled, paid from Font of Magic by hand. On the sheet AND
 * on the Metamagic list; the cost is its activity's consumption value, read live. */
const SEEKING = {
  tests: ["attack"],
  find: (actor, entry, ctx = {}) => {
    if ( !ctx.spell ) return null;
    if ( !listedNames(metamagicEntries()).has(lower(entry.name)) ) return null;
    const item = itemNamed(actor, entry.name);
    const activity = item?.system?.activities?.contents?.[0] ?? null;
    if ( !item || !activity ) return null;
    const pool = poolOf(actor, activity);
    const cost = Math.max(1, Number(activity.consumption?.targets?.find(t => t.type === "itemUses")?.value) || 1);
    if ( !pool || ((pool.system?.uses?.value ?? 0) < cost) ) return null;
    return { kind: "seeking", item, pool, cost };
  },
  die: () => null,                                        // a REROLL contributes no die
  spend: async (actor, marker, message) => {
    const record = await spendPoolUses(actor, marker.pool, "Seeking Spell", marker.cost, "Sorcery Points");
    if ( !record ) return false;
    if ( message ) await message.setFlag(MODULE_ID, "poolSpend", record);
    return true;
  }
};

/** Lucky's Advantage on a dialog-less initiative (`Combat#rollInitiative` never pauses): a second
 * d20 after the roll, the HIGHER standing — RULINGS *Where the table bends the rule*. */
const ADVANTAGE = {
  tests: ["initiative"],
  find: (actor, entry) => {
    const key = Object.keys(ADVANTAGE_BUYS).find(k => lower(k) === lower(entry.name));
    const row = key ? ADVANTAGE_BUYS[key] : null;
    if ( !row ) return null;
    const item = actor?.items?.find(i => (i.type === "feat") && (lower(i.name) === lower(key))
      && (!row.uses || (Number(i.system?.uses?.max) > 0)));
    if ( !item || (row.uses && !(Number(item.system.uses.value ?? 0) > 0)) ) return null;
    return { kind: "advantage", key, row, item };
  },
  die: () => null,                                        // the second d20 is the reroll's rebuild
  spend: async (actor, marker, message) => {
    const record = await spendPoolUses(actor, marker.item, marker.key, 1, `${marker.row.point}s`);
    if ( !record ) return false;
    if ( message ) await message.setFlag(MODULE_ID, "poolSpend", record);
    return true;
  }
};

/** Guarded Mind: a FAILED save of a listed ability made a success (SAVE_SUCCEEDS). Nothing is
 * rolled; the spend is the feature's own activity. */
const SUCCEED = {
  tests: ["save"],
  find: (actor, entry, ctx = {}) => {
    const key = Object.keys(SAVE_SUCCEEDS).find(k => lower(k) === lower(entry.name));
    const row = key ? SAVE_SUCCEEDS[key] : null;
    if ( !row || !ctx.ability || !row.abilities.includes(ctx.ability) ) return null;
    const item = itemNamed(actor, key);
    const activity = item ? activityNamed(item, row.activity) : null;
    if ( !item || !activity ) return null;
    const pool = poolOf(actor, activity) ?? item;
    const left = Number(pool?.system?.uses?.value ?? 0);
    if ( !(left > 0) ) return null;
    return { kind: "succeed", key, row, item, activity, pool, left };
  },
  die: () => null,                                        // no die: the verdict itself
  spend: async (_actor, marker, message) => {
    const used = await marker.activity.use({ subsequentActions: false }, { configure: false }, {
      data: { ...originData(message.id), flags: { [MODULE_ID]: { foldSpend: message.id } } }
    });
    return !!used;                                        // a use that did not happen grants nothing
  }
};

const KINDS = { heroic: HEROIC, tactical: TACTICAL, bardic: BARDIC, seeking: SEEKING, advantage: ADVANTAGE, succeed: SUCCEED };
/** The kinds that REPLACE the d20 rather than add to it (Lucky's Advantage keeps the HIGHER — `resolveFold`). */
const REROLL_KINDS = new Set(["heroic", "seeking", "advantage"]);
/** The kinds whose contribution is the VERDICT — nothing rolled, nothing added. */
const VERDICT_KINDS = new Set(["succeed"]);

/** Warn once per distinct cause. */
const warned = new Set();
function warnOnce(key, message) {
  if ( warned.has(key) ) return;
  warned.add(key);
  console.warn(message);
}

/** A `tactical` entry with a SCOPE of its own — the Battle Master's Ambush / Tactical Assessment (decide/registry.js SUPERIORITY_FOLDS). */
const scopeOf = entry => (entry.kind === "tactical")
  ? (Object.entries(SUPERIORITY_FOLDS).find(([k]) => k.toLowerCase() === String(entry.name ?? "").toLowerCase())?.[1] ?? null) : null;

/**
 * EVERY listed fold this actor can spend on this kind of test, never just the first (list order
 * must not choose the resource). `spent` excludes what this roll already used.
 * @param {Actor} actor
 * @param {"attack"|"save"|"check"|"initiative"} testKind
 * @param {string[]} [spent]
 * @param {{skill?: string|null, spell?: boolean, ability?: string|null}} [ctx]
 */
function availableFolds(actor, testKind, spent = [], ctx = {}) {
  const out = [];
  for ( const entry of d20FoldEntries() ) {
    const spec = KINDS[entry.kind];
    if ( !spec ) continue;
    // A SCOPED entry: the feature's text says which checks (and whether Initiative) it reaches.
    const scope = scopeOf(entry);
    const tests = scope ? [...((scope.skills?.length) ? ["check"] : []), ...(scope.initiative ? ["initiative"] : [])] : spec.tests;
    if ( !tests.includes(testKind) ) continue;
    if ( scope && (testKind === "check") && !(ctx.skill && scope.skills.includes(ctx.skill)) ) continue;
    if ( spent.includes(entry.kind) || spent.includes(entry.name) ) continue;   // by NAME too: two tactical rows can stand
    const marker = spec.find(actor, entry, ctx);
    if ( !marker ) continue;
    let dieFormula = spec.die(marker);
    if ( scope && dieFormula ) {
      dieFormula = resolveDie(actor, dieFormula);
    }
    if ( !REROLL_KINDS.has(entry.kind) && !VERDICT_KINDS.has(entry.kind) && !dieFormula ) continue;   // a die-kind with no die is off
    // ⚠ `name` is the LOOKUP KEY, `label` what the table reads; they differ for `bardic`.
    const buy = (entry.kind === "advantage") ? { cost: `1 ${marker.row.point} · ${Number(marker.item.system.uses.value ?? 0)} left`,
      rule: marker.row.rule } : {};
    const succeed = (entry.kind === "succeed") ? { label: marker.row.label, rule: marker.row.rule,
      cost: `${RESCUE_KINDS.succeed.cost} · ${marker.left} left` } : {};
    out.push({ kind: entry.kind, name: entry.name, label: scope ? entry.name : (KIND_LABEL[entry.kind] ?? entry.name),
      dieFormula, ...(scope ? { cost: "the superiority die is spent either way it lands", rule: scope.rule } : {}), ...buy, ...succeed });
  }
  return out;
}

// STAMP: on the roller's own client, on the message it authored.

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
    ...statContext(actor.uuid),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  };
}

/** ATTACKS: the module owns the AC, so a clean miss (every judged target) is offered by itself. */
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

    const spell = subject.item?.type === "spell";
    let offers = availableFolds(attacker, "attack", [], { spell });
    // ⚠ A natural 1 stands against an added die; only a reroll replaces it.
    if ( roll.isFumble ) offers = offers.filter(o => REROLL_KINDS.has(o.kind));
    if ( !offers.length ) return;

    const snapshot = targetsOf(message);
    if ( !snapshot.length || hitTargets(message).length ) return;   // clean misses only
    const judged = snapshot.filter(t => (t.ac !== null) && (t.ac !== undefined));
    if ( !judged.length ) return;                                   // null AC — humans have it

    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await message.setFlag(MODULE_ID, "d20fold", {
      ...baseFlag(attacker, offers, "attack", roll.total, window),
      ...(spell ? { spell: true } : {}),
      targets: judged.map(t => ({ uuid: t.uuid, name: t.name, ac: t.ac,
        margin: t.ac - roll.total, verdict: null }))
    });
    armFoldTimer(message);
  } catch(err) {
    console.error(`${TITLE} | D20 fold stamp (attack) failed.`, err);
  }
});

/**
 * CHECKS AND NATIVE SAVES: no DC exists, so these stamp an OFFER that times out to `pass`.
 * ⚠ The names the system DISPATCHES (`#rollD20Test` fires only non-V2 hooks); a wrong name fails
 * silently — smoke-d20-folds §4 asserts each one fires.
 */
const PLAIN_HOOKS = [
  ["dnd5e.rollAbilityCheck", "check"],
  ["dnd5e.rollSkill", "check"],
  ["dnd5e.rollToolCheck", "check"],
  ["dnd5e.rollSavingThrow", "save"]
];
for ( const [hook, testKind] of PLAIN_HOOKS ) {
  Hooks.on(hook, async (rolls, data) => {
    try {
      const subject = data?.subject;
      if ( !(subject instanceof Actor) || !modeAllows(subject) ) return;
      const message = rolls?.[0]?.parent;
      if ( !(message instanceof ChatMessage) ) return;
      if ( message.getFlag(MODULE_ID, "d20fold") ) return;
      // ⚠ A DEMANDED (or module concentration) save is offered by `offerFoldOnSave`, which knows the
      // DC; stamping here too would race the withheld verdict.
      if ( (testKind === "save") && pendingSaveDemandFor(subject) ) return;
      if ( (testKind === "save") && rolls?.[0]?.options?.isConcentration && pendingDemandsFor(subject.uuid, { flagKey: "concentration" }).length ) return;
      const skill = data?.skill ?? null;
      const ability = (testKind === "save") ? (data?.ability ?? null) : null;
      // A maneuver ARMED from the sheet folds in by itself; the other folds are offered after.
      if ( (testKind === "check") && await applyArmedFold(message, subject, testKind, { skill }) ) return;
      const offers = availableFolds(subject, testKind, [], { skill, ability });
      if ( !offers.length ) return;
      const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
      await message.setFlag(MODULE_ID, "d20fold",
        { ...baseFlag(subject, offers, testKind, rolls[0].total, window), ...(skill ? { skill } : {}), ...(ability ? { ability } : {}) });
      armFoldTimer(message);
    } catch(err) {
      console.error(`${TITLE} | D20 fold stamp (${hook}) failed.`, err);
    }
  });
}

/** INITIATIVE: a scoped fold or Lucky's Advantage offered on the roll's message; accepting re-sets
 * the combatant's initiative to the composed total (DESIGN §4). */
const initiativeStamps = new Set();   // same-client latch: the two roads below can meet on one message
async function stampInitiative(actor, combatants, message) {
  if ( !(actor instanceof Actor) || !modeAllows(actor) ) return;
  if ( !message || message.getFlag(MODULE_ID, "d20fold") || !message.isAuthor ) return;
  if ( initiativeStamps.has(message.id) ) return;
  initiativeStamps.add(message.id);
  try {
    const total = Number(message.rolls?.[0]?.total ?? combatants?.[0]?.initiative ?? 0);
    if ( await applyArmedFold(message, actor, "initiative", { combatants: combatants ?? [], total }) ) return;
    // Lucky's Advantage only on a PLAIN roll: not already at Advantage, no dialog showed the box.
    const roll = message.rolls?.[0] ?? null;
    const plain = !roll?.options?.bfBuyShown && !(Number(roll?.options?.advantageMode) > 0)
      && !(Number(roll?.options?.advantageMode) < 0);
    const offers = availableFolds(actor, "initiative").filter(o => (o.kind !== "advantage") || plain);
    if ( !offers.length ) return;
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await message.setFlag(MODULE_ID, "d20fold", { ...baseFlag(actor, offers, "initiative", total, window),
      combatId: game.combat?.id ?? null, combatantIds: (combatants ?? []).map(c => c.id) });
    armFoldTimer(message);
  } finally {
    initiativeStamps.delete(message.id);
  }
}

// The actor's own roll (`Actor5e#rollInitiative` — the sheet, a macro): dnd5e's hook.
Hooks.on("dnd5e.rollInitiative", async (actor, combatants) => {
  try {
    if ( !(actor instanceof Actor) ) return;
    const message = game.messages.contents.slice(-30).reverse().find(m => m.getFlag("core", "initiativeRoll")
      && ((m.speaker?.actor === actor.id) || (m.getAssociatedActor?.()?.uuid === actor.uuid)));
    await stampInitiative(actor, combatants, message);
  } catch(err) {
    console.error(`${TITLE} | D20 fold stamp (initiative) failed.`, err);
  }
});

// ⚠ The tracker's roll button never fires `dnd5e.rollInitiative` (`Combat#rollInitiative` bypasses
// the actor's); its `initiativeRoll` message is the witness. The latch keeps the two roads to one stamp.
Hooks.on("createChatMessage", async message => {
  try {
    if ( !message.getFlag("core", "initiativeRoll") || !message.isAuthor ) return;
    const actor = message.getAssociatedActor?.() ?? null;
    if ( !(actor instanceof Actor) ) return;
    const combatants = game.combat?.combatants?.filter(c => c.actor?.uuid === actor.uuid) ?? [];
    await stampInitiative(actor, combatants, message);
  } catch(err) {
    console.error(`${TITLE} | D20 fold stamp (initiative message) failed.`, err);
  }
});

/** Is this actor mid-answer on a save this module demanded? (the spine's demand registry) */
function pendingSaveDemandFor(actor) {
  return pendingDemandsFor(actor.uuid, { flagKey: "saves" }).length > 0;
}

const armFoldTimer = message =>
  armAskTimer(foldTimers, message, "d20fold", live => answerFold(live, "pass", { timedOut: true }));

// THE DEMANDED-SAVE EDGE. ⚠ WITHHOLD, DO NOT UNDO: the save machine's verdict pauses while this
// offer is live; `offer` returns true when the caller must NOT fold yet. `by` names the machine
// the verdict goes back to, on the resume stamp so a reload knows who is owed.
registerWithhold("d20fold", {
  offer: (rollMessage, { by, card, uuid, total, dc }) => offerFoldOnSave(rollMessage, card, uuid, total, dc, by)
});

async function offerFoldOnSave(rollMessage, card, uuid, total, dc, by = null) {
  try {
    if ( !setting(S.d20FoldAsk) ) return false;
    const existing = rollMessage.getFlag(MODULE_ID, "d20fold");
    if ( existing ) return existing.status === "pending";   // already asked; don't ask twice
    if ( !Number.isFinite(dc) || !Number.isFinite(total) || (total >= dc) ) return false;
    const actor = await fromUuid(uuid);
    if ( !(actor instanceof Actor) || !modeAllows(actor) ) return false;
    const ability = rollMessage.system?.ability ?? null;
    const offers = availableFolds(actor, "save", [], { ability });
    if ( !offers.length ) return false;

    const window = Math.max(0, Number(setting(S.saveTimer)) || 0);
    await rollMessage.setFlag(MODULE_ID, "d20fold", {
      ...baseFlag(actor, offers, "save", total, window),
      ...(ability ? { ability } : {}),
      dc,                                   // ⚠ the ask OWNS it — never re-derived here
      resume: { cardId: card.id, uuid, ...(by ? { by } : {}) }     // how, and by whom, the withheld verdict gets finished
    });
    armFoldTimer(rollMessage);
    return true;
  } catch(err) {
    console.error(`${TITLE} | D20 fold offer on save failed.`, err);
    return false;   // ⚠ fail OPEN: a broken offer must never swallow a save's verdict
  }
}

/** Finish a verdict another machine withheld for us — win, lose or pass, the save must resolve.
 * A resume stamped without `by` falls to the one machine registered. */
async function resumeWithheldSave(flag, rollMessage) {
  if ( !flag?.resume ) return;
  try {
    await resumeWithheld(flag.resume.by ?? null, flag.resume, rollMessage);
  } catch(err) {
    console.error(`${TITLE} | resuming the withheld save failed.`, err);
  }
}

// ANSWER + RESOLVE

/** `answer` is a KIND to spend, or "pass". First writer wins, then the work is executed. */
async function answerFold(message, answer, { timedOut = false } = {}) {
  let claimed = false;
  let withdrawn = false;
  await queueFlagWrite(message, "d20fold", current => {
    if ( (current.status !== "pending") || current.answer ) return;
    if ( (answer !== "pass") && !(current.offers ?? []).some(o => offerAnswers(o, answer)) ) return;
    // ⚠ THE SPEND-GUARD, inside the lock on purpose: a sibling can have fixed the roll since the
    // window rendered; only the serializer makes "still failing" and "claimed" one decision.
    if ( (answer !== "pass") && !foldPremiseAlive(message, current) ) {
      current.status = "resolved";
      current.outcome = "no longer needed";
      current.offers = [];
      withdrawn = true;
      return;
    }
    current.answer = answer;
    current.answeredAt = Date.now();          // the crash-resume horizon
    if ( timedOut ) current.timedOut = true;
    if ( answer === "pass" ) {
      current.status = "resolved";
      current.outcome = current.spends?.length ? "used" : (timedOut ? "passed (timer)" : "passed");
    }
    claimed = true;
  });
  if ( withdrawn ) {
    disarmAskTimer(foldTimers, message.id);
    return;
  }
  if ( !claimed ) return;
  const live = message.getFlag(MODULE_ID, "d20fold");
  if ( answer === "pass" ) {
    if ( !live?.spends?.length ) await announceIfNeeded(message, live);
    await resumeWithheldSave(live, message);
    return;
  }
  await resolveFold(message, answer);
}

/** Does this offer answer to this token? A kind, or `tactical:<name>` where two tactical rows stand. */
const offerAnswers = (o, answer) => (o.kind === answer) || (`${o.kind}:${o.name}` === answer);

/** The accept path: spend the marker, roll (or REROLL), stamp, announce, re-offer or finish. */
async function resolveFold(message, answer) {
  if ( foldInFlight.has(message.id) ) return;
  foldInFlight.add(message.id);   // before the first await
  try {
    const flag = message.getFlag(MODULE_ID, "d20fold");
    if ( !flag || (flag.answer !== answer) || (flag.status !== "pending") ) return;
    const actor = await fromUuid(flag.actorUuid);
    if ( !(actor instanceof Actor) ) return;
    const offer = (flag.offers ?? []).find(o => offerAnswers(o, answer));
    const kind = offer?.kind;
    const spec = kind ? KINDS[kind] : null;
    if ( !spec || !offer ) return;

    // ⚠ THE RESUME GATE: a spend with `pendingVerdict` means a resolver died after the dice; the
    // crash-resume composes, never spends or rolls again.
    const already = (flag.spends ?? []).some(sp => sp.pendingVerdict && (sp.kind === kind) && ((sp.name ?? sp.kind) === (offer.name ?? kind)));
    let spends;
    let marker = null;   // a resume has none: the spend already took it
    if ( already ) {
      spends = flag.spends ?? [];
    } else {
      // ⚠ RE-FIND AT RESOLVE TIME: the marker can be gone after minutes in the window.
      marker = spec.find(actor, { name: offer.name, kind }, { spell: !!flag.spell, ability: flag.ability ?? null });
      if ( !marker ) {
        await queueFlagWrite(message, "d20fold", current => {
          current.status = "resolved";
          current.outcome = current.spends?.length ? "used" : "gone";
        });
        await resumeWithheldSave(flag, message);
        return;
      }

      // ⚠ Re-check the PREMISE: a crash-resume arrives late, the roll perhaps fixed meanwhile.
      if ( !foldPremiseAlive(message, flag) ) {
        await queueFlagWrite(message, "d20fold", current => {
          if ( current.status !== "pending" ) return false;
          current.status = "resolved";
          current.outcome = "no longer needed";
          current.offers = [];
        });
        await resumeWithheldSave(flag, message);
        return;
      }

      if ( !(await spec.spend(actor, marker, message)) ) return;

      // The new number, public, stamped `respondsTo` so no recognizer claims it. A VERDICT kind rolls nothing.
      let rolled = null;
      let rolledMessage = null;
      if ( !VERDICT_KINDS.has(kind) ) {
        rolled = REROLL_KINDS.has(kind)
          ? await rerollOf(message, actor)
          : await rollDie(spec.die(marker) ?? offer.dieFormula, actor);
        if ( !rolled ) return;
        // Lucky's Advantage: the HIGHER of the two d20s stands, its crit with it.
        if ( kind === "advantage" ) {
          const first = message.rolls?.[0];
          if ( first && (Number(first.total) > Number(rolled.summary.total)) ) {
            rolled.summary = { total: first.total, isCritical: first.isCritical === true, isFumble: first.isFumble === true };
          }
        }
        const faceOf = r => r?.dice?.[0]?.results?.find(x => (x.active !== false) && !x.discarded)?.result ?? null;
        const rise = foldRise({ mode: (kind === "advantage") ? "advantage" : REROLL_KINDS.has(kind) ? "reroll" : "die",
          oldFace: faceOf(message.rolls?.[0]), newFace: faceOf(rolled.roll), total: rolled.summary.total, on: actor.uuid });
        rolledMessage = await rolled.roll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: (kind === "advantage") ? `${labelOf(offer)} — the second d20`
            : REROLL_KINDS.has(kind) ? `${labelOf(offer)} — the reroll` : `${labelOf(offer)} — the die`,
          flags: { [MODULE_ID]: { respondsTo: message.id, ...(rise ? { diceRise: rise } : {}) } }
        });
      }

      // Record the spend; the verdict composes across EVERY fold on the message (Precision too).
      // ⚠ Recorded BEFORE the dice pause, with `pendingVerdict`, so a crash is never spent twice.
      const entry = {
        kind, name: offer.name, label: offer.label, pendingVerdict: true,
        ...(VERDICT_KINDS.has(kind) ? { verdict: "saved" }
          : REROLL_KINDS.has(kind) ? { reroll: rolled.summary } : { die: rolled.summary.total })
      };
      await queueFlagWrite(message, "d20fold", current => {
        if ( current.status !== "pending" ) return false;
        current.spends = [...(current.spends ?? []), entry];
      });
      spends = [...(flag.spends ?? []), entry];

      // The dice land BEFORE the verdict (a capped, cosmetic pause).
      if ( rolledMessage ) await dramaticVerdictPause(rolledMessage);
    }
    const pending = { ...flag, status: "resolved", outcome: "used", spends };
    // ⚠ The spec set is picked BY TEST KIND: the attack spec walks `flag.targets`, a save has none.
    const folds = foldFolds(message, pending);
    const baseRoll = foldBase(message, flag);
    // ⚠ ONE TARGET'S SLICE on an attack: `ATTACK_FOLDS` holds a contribution per target × spend;
    // summing them all double-counts a die.
    const composed = (flag.testKind === "attack")
      ? foldedRoll(baseRoll, folds.filter(f => f.uuid === flag.targets?.[0]?.uuid))
      : foldedRoll(baseRoll, folds);

    // The re-offer, excluded by NAME: spending Ambush must not hide Tactical Mind, its kind-mate.
    const remaining = availableFolds(actor, flag.testKind, spends.map(s => s.name ?? s.kind), { skill: flag.skill ?? null, spell: !!flag.spell, ability: flag.ability ?? null });
    const stillFailing = isStillFailing(flag, composed, baseRoll, folds);
    const reoffer = remaining.length && stillFailing;
    const succeeded = folds.some(f => f.verdict === "saved");

    const lines = [];
    let anyHit = false;
    await queueFlagWrite(message, "d20fold", current => {
      current.spends = spends.map(sp => { const done = { ...sp }; delete done.pendingVerdict; return done; });
      current.foldedTotal = composed.total;
      current.answer = null;                       // ⚠ cleared so a re-offer can be answered
      current.offers = reoffer ? remaining : [];
      current.status = reoffer ? "pending" : "resolved";
      if ( !reoffer ) current.outcome = "used";
      // ⚠ The re-offer keeps the ORIGINAL deadline: a clock any spend could extend has no bound.
      if ( !reoffer ) delete current.deadline;
      if ( current.testKind === "attack" ) {
        for ( const t of current.targets ?? [] ) {
          t.verdict = foldedVerdict(t, baseRoll, folds);
          if ( t.verdict === "hit" ) anyHit = true;
          const ac = folds.filter(f => f.uuid === t.uuid).findLast(f => Number.isFinite(f.ac))?.ac
            ?? t.ac;
          lines.push(`${sumText(flag, composed)} vs AC ${ac} — `
            + (t.verdict === "hit" ? `<strong>now hits ${t.name}</strong>` : `still misses ${t.name}`));
        }
      } else if ( succeeded ) {
        lines.push(Number.isFinite(current.dc)
          ? `${flag.baseTotal} vs DC ${current.dc} — <strong>succeeds instead</strong>.`
          : "<strong>The save succeeds instead.</strong>");
      } else if ( Number.isFinite(current.dc) ) {
        const made = composed.total >= current.dc;
        lines.push(`${sumText(flag, composed)} vs DC ${current.dc} — `
          + (made ? `<strong>${(current.testKind === "save") ? "now saves" : "now passes"}</strong>` : "still fails"));
      } else {
        // ⚠ No verdict without a DC: state the arithmetic and stop.
        lines.push(`${sumText(flag, composed)} — the roll now totals <strong>${composed.total}</strong>.`);
      }
    });

    // Tactical Mind's refund clause is ASKED (DESIGN §8): the module cannot judge the check.
    const refundable = (kind === "tactical") && !scopeOf({ kind, name: offer.name });
    if ( refundable ) {
      lines.push("If the check still fails, this use of Second Wind isn't expended — "
        + "the next window asks which it was.");
    }
    if ( flag.testKind === "initiative" ) {
      const combat = flag.combatId ? game.combats.get(flag.combatId) : game.combat;
      for ( const id of (flag.combatantIds ?? []) ) {
        const c = combat?.combatants?.get(id);
        if ( c ) await c.update({ initiative: composed.total }).catch(err => console.warn(`${TITLE} | Could not move the initiative.`, err));
      }
      lines.push(`Initiative <strong>${flag.baseTotal} → ${composed.total}</strong> — the order is updated.`);
    }
    await announce(message, actor, labelOf(offer), flag.testKind, anyHit, lines, marker);
    // The refund ask is SHOWN only once the fold is resolved, never beside a re-offer window.
    if ( refundable ) await stampRefundAsk(message, actor, offer, marker, {
      baseTotal: flag.baseTotal, total: composed.total, dc: Number.isFinite(flag.dc) ? flag.dc : null,
      die: spends.findLast(s => s.kind === "tactical")?.die ?? null
    });

    if ( reoffer ) {
      // Still failing, something left: the window is REDRAWN, not re-popped.
      syncRescuePopup(message);
      if ( message.getFlag(MODULE_ID, "d20fold")?.deadline ) armFoldTimer(message);
      return;
    }

    // Finish: re-drive an attack chain, or hand a withheld save back.
    if ( flag.testKind === "save" ) {
      await resumeWithheldSave(flag, message);
      return;
    }
    if ( flag.testKind !== "attack" ) return;
    if ( !anyHit || !hitTargets(message).length ) return;
    const attackActivity = cardActivity(message, activityUuidOf(message));
    if ( !attackActivity ) return;
    if ( setting(S.playerRollDamage) ) return void offerDamageRoll(attackActivity, message);
    await rollDamageForAttack(attackActivity, message);
  } catch(err) {
    console.error(`${TITLE} | D20 fold resolution failed.`, err);
  } finally {
    foldInFlight.delete(message.id);
  }
}

/** Still a failure after everything spent? ⚠ A check with no DC always answers yes. */
function isStillFailing(flag, composed, baseRoll, folds) {
  if ( flag.testKind === "attack" ) {
    return !(flag.targets ?? []).some(t => foldedVerdict(t, baseRoll, folds) === "hit");
  }
  if ( (folds ?? []).some(f => f.verdict === "saved") ) return false;
  if ( Number.isFinite(flag.dc) ) return composed.total < flag.dc;
  return true;
}

/** The arithmetic sentence — a reroll REPLACES and reads with an arrow; a die ADDS and sums. */
const sumText = (flag, composed) => composed.replaced
  ? `${flag.baseTotal} → ${composed.total}`
  : `${flag.baseTotal} + ${composed.added} = ${composed.total}`;

async function announce(_message, actor, name, testKind, anyHit, lines, marker) {
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({
      img: marker?.item?.img ?? marker?.effect?.img ?? null,
      eyebrow: (marker?.kind === "tactical") ? `Maneuver — ${name}` : `D20 Fold — ${name}`,
      tone: (testKind === "attack") ? (anyHit ? "good" : "neutral") : "good",
      title: (testKind === "attack")
        ? (anyHit ? `${name} — the miss becomes a hit` : `${name} — still a miss`)
        : (marker?.kind === "succeed") ? `${name} — the failed save succeeds instead`
        : `${name} — the roll is patched`,
      subtitle: (marker?.kind === "tactical") ? "one Superiority Die spent" : `${actor.name} spends ${name}`,
      lines
    })
  });
}

/** A pass with nothing spent says so on a WITHHELD save, where the table is waiting on it. */
async function announceIfNeeded(_message, flag) {
  if ( !flag?.resume ) return;
  const actor = resolveUuid(flag.actorUuid);
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

/** THE REROLL, rebuilt from the original roll's class, data and options: a plain `Roll` would lose
 * a moved crit threshold. */
async function rerollOf(message, actor) {
  const original = message.rolls?.[0];
  if ( !original ) return null;
  const RollCls = original.constructor;
  // ⚠ Drop `configured`: an evaluated advantage roll's formula reads `2d20adv`, and with
  // `configured: true` the constructor skips the system's normalisation and rolls four dice.
  const options = foundry.utils.deepClone(original.options ?? {});
  delete options.configured;
  const roll = new RollCls(original.formula, original.data ?? actor.getRollData(), options);
  await roll.evaluate();
  return { roll, summary: {
    total: roll.total,
    isCritical: roll.isCritical === true,
    isFumble: roll.isFumble === true
  } };
}

// PRESENT. A demanded save's roll is drawn as a SUMMARY inside the usage card, so the block rides
// the `cardRow` seam: the same drawer on the shown card or inside the summary.
Hooks.on("dnd5e.renderChatMessage", cardRow((message, host) => {
  try {
    const flag = message.getFlag(MODULE_ID, "d20fold");
    if ( !flag ) return;

    const actor = resolveUuid(flag.actorUuid);
    const block = document.createElement("div");
    block.className = "battleflow-d20fold";
    block.style.margin = "0.4rem 0 0";

    if ( (flag.status === "pending") && flag.answer ) {
      // ANSWERED, NOT YET RESOLVED: the dice are landing.
      const chosen = (flag.offers ?? []).find(o => offerAnswers(o, flag.answer)) ?? null;
      block.innerHTML = bfCard({
        img: foldImg(actor, chosen ? [chosen] : (flag.offers ?? [])),
        eyebrow: "D20 Fold — answered",
        title: chosen ? labelOf(chosen) : "Passed",
        subtitle: chosen ? `${actor?.name ?? ""} · the dice are rolling` : `${actor?.name ?? ""} · ${testKindPhrase(flag)}`,
        tone: "neutral"
      });
      host.append(block);
      syncRescuePopup(message);   // the window closes at the answer, not after the dice
      return;
    }

    if ( flag.status === "pending" ) {
      const offers = flag.offers ?? [];
      // The card only calls the popup BACK; the popup is the one input surface.
      block.innerHTML = bfCard({
        img: foldImg(actor, offers),
        eyebrow: "D20 Fold — offered",
        title: offers.length === 1 ? labelOf(offers[0]) : `${offers.length} ways to patch this roll`,
        subtitle: `${actor?.name ?? ""} · ${testKindPhrase(flag)}`,
        tone: "pending",
        lines: offerLines(flag, offers)
      }) + holdBarHTML(flag, "to answer");
      scheduleBarSync(block);
      host.append(block);

      // ⚠ The elect arms HERE too: a player's stamp runs where `armAskTimer` is a no-op, so this
      // render is the clock owner's first sight (and the re-arm after a reload).
      armFoldTimer(message);

      if ( !canAnswerFor(actor) ) return;      // spectators get the card, not the controls
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        display: "flex", gap: "0.3rem", marginTop: "0.4rem", justifyContent: "flex-end"
      });
      controls.append(momentButton("Answer", () => {
        syncRescuePopup(message, { recall: true });
      }, { flex: "0 0 auto", margin: "0", padding: "0 0.4rem", fontSize: "inherit", lineHeight: "1.4" }));
      block.append(controls);

      // EVERY offer pops, timed or not; an untimed one has no bar.
      syncRescuePopup(message);
      return;
    }

    // RESOLVED: the durable public record.
    if ( flag.outcome ) {
      const spends = flag.spends ?? [];
      const spent = spends.map(labelOf).join(" + ");
      const used = flag.outcome === "used";
      const maneuver = used && spends.length && spends.every(s => s.kind === "tactical");
      block.innerHTML = bfCard({
        img: foldImg(actor, spends),
        eyebrow: maneuver ? `Maneuver — ${spent}` : used ? "D20 Fold — spent"
          : (flag.outcome === "gone") ? "D20 Fold — gone"
          : flag.timedOut ? "D20 Fold — timed out" : "D20 Fold — passed",
        title: used ? spent : "Nothing spent",
        subtitle: actor?.name ?? "",
        tone: used ? "good" : "neutral",
        lines: resolvedLines(flag, message)
      });
      host.append(block);
    }
  } catch(err) {
    console.error(`${TITLE} | D20 fold render failed.`, err);
  }
}));

/** The card's art: the first named fold's document, else the actor's portrait (`heroic` has none). */
function foldImg(actor, named = []) {
  for ( const n of named ) {
    const item = itemNamed(actor, n.name);
    if ( item?.img ) return item.img;
    const effect = actor?.effects?.find(e => e.name?.toLowerCase() === n.name?.toLowerCase());
    if ( effect?.img ) return effect.img;
  }
  return actor?.img ?? null;
}

/** What kind of roll is being patched, in table English — the card's subtitle half. */
function testKindPhrase(flag) {
  if ( flag.testKind === "attack" ) return "the attack missed";
  if ( flag.testKind === "initiative" ) return `initiative · rolled ${flag.baseTotal}`;
  if ( flag.testKind === "save" ) {
    return Number.isFinite(flag.dc) ? `the save failed (${flag.baseTotal} vs DC ${flag.dc})`
      : `saving throw · rolled ${flag.baseTotal}`;
  }
  return `check · rolled ${flag.baseTotal}`;
}

/** The cost the card says for an offer — the kind's sentence; a verdict kind's own (its uses left). */
const costOnCard = o => (VERDICT_KINDS.has(o.kind) ? (o.cost ?? SPEND_COST[o.kind]) : SPEND_COST[o.kind]) ?? null;

/** The offer card's body: what can be spent (each cost on its own line), and under holdReveal what it must beat. */
function offerLines(flag, offers) {
  const lines = offers.map(o => `<strong>${labelOf(o)}</strong>`
    + (REROLL_KINDS.has(o.kind) ? " — reroll the d20" : VERDICT_KINDS.has(o.kind) ? " — succeed instead" : ` — add ${o.dieFormula}`)
    + (costOnCard(o) ? ` <em>(${costOnCard(o)})</em>` : ""));
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

/** The settled card's body: the numbers the verdict was reached with. */
function resolvedLines(flag, message) {
  if ( flag.outcome === "gone" ) return ["The resource was no longer there to spend."];
  if ( flag.outcome === "no longer needed" ) {
    return ["No longer needed — the roll got there without it, and nothing was spent."];
  }
  if ( flag.outcome !== "used" ) {
    return [flag.timedOut
      ? "The window closed with no answer — the roll stands."
      : "Passed — the roll stands."];
  }
  const lines = [];
  if ( (flag.spends ?? []).some(s => VERDICT_KINDS.has(s.kind)) ) {
    lines.push(Number.isFinite(flag.dc)
      ? `<strong>The save succeeds instead</strong> — ${flag.baseTotal} vs DC ${flag.dc}.`
      : "<strong>The save succeeds instead.</strong>");
    return lines;
  }
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
  const refund = message.getFlag(MODULE_ID, "tacticalRefund");
  if ( refund ) lines.push(refundLine(refund));
  else if ( (flag.spends ?? []).some(s => (s.kind === "tactical") && !scopeOf({ kind: s.kind, name: s.name })) ) {   // Tactical Mind, never a scoped die
    lines.push("If the check still fails, this use of Second Wind isn't expended.");
  }
  return lines;
}

/** The fold contributions this roll carries, one home for the resolver and the window. `flag` may be
 * a pending copy; spec set by test kind, one target's slice on an attack (see `resolveFold`). */
function foldFolds(message, flag) {
  const specs = (flag?.testKind === "attack") ? ATTACK_FOLDS : SAVE_FOLDS;
  const folds = foldsFrom(
    key => ((key === "d20fold") ? flag : message.getFlag(MODULE_ID, key)), specs);
  return (flag?.testKind === "attack")
    ? folds.filter(f => f.uuid === flag.targets?.[0]?.uuid) : folds;
}

/** The roll the folds compose over — the real d20 where there is one, the stamp's copy otherwise. */
const foldBase = (message, flag) => message.rolls?.[0] ?? { total: flag?.baseTotal };

/** The d20 folds as RESCUE ROWS in the spine's one window (ARCHITECTURE §5); the KIND is the action token. */
registerRescue("d20fold", {
  // ⚠ Answered is not pending: the status stays "pending" until the dice land, but the popup withdraws at the answer.
  isPending: message => { const f = message.getFlag(MODULE_ID, "d20fold"); return (f?.status === "pending") && !f.answer; },
  subject: message => {
    const uuid = message.getFlag(MODULE_ID, "d20fold")?.actorUuid;
    return resolveUuid(uuid);
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

/** THE MOOT: a sibling spend fixed the roll, so this offer withdraws unspent. ⚠ Elect-owned, single writer. */
async function mootFold(message) {
  await queueFlagWrite(message, "d20fold", current => {
    if ( (current.status !== "pending") || current.answer ) return false;
    current.status = "resolved";
    current.outcome = "no longer needed";
    current.offers = [];
  });
  disarmAskTimer(foldTimers, message.id);
}

/** Is this offer's premise still alive, composed across everything already spent? */
function foldPremiseAlive(message, flag) {
  const folds = foldFolds(message, flag);
  const baseRoll = foldBase(message, flag);
  return isStillFailing(flag, foldedRoll(baseRoll, folds), baseRoll, folds);
}

// EXPIRE + RESUME

Hooks.on("updateChatMessage", (message) => {
  const flag = message.getFlag(MODULE_ID, "d20fold");
  if ( !flag ) return;
  // ⚠ RE-DERIVED EVERY UPDATE from the COMPOSED roll: a sibling's spend usually kills the premise.
  if ( (flag.status === "pending") && !flag.answer && isActiveGM()
    && !foldPremiseAlive(message, flag) ) {
    void mootFold(message);
    return;
  }
  if ( flag.status !== "pending" ) {
    disarmAskTimer(foldTimers, message.id);
    // ⚠ SYNC, DO NOT CLOSE: this machine owns rows in a shared window; a sibling may still be asking.
    syncRescuePopup(message);
    return;
  }
  // Crash-resume past the 20s horizon: whoever is still here picks up an accepted answer.
  if ( flag.answer && (flag.answer !== "pass") && flag.answeredAt
    && (Date.now() - flag.answeredAt > 20_000) ) {
    void resolveFold(message, flag.answer);
  }
});

Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(foldTimers, message.id);
});

// ARMED FROM THE SHEET: a scoped tactical fold used before the check rolls its die, a chip carries
// the number, and the next check the scope names folds it in. The chip has no clock
// (RULINGS *The rest of the maneuvers*).

const ARMED_KEY = "tactical";

function armedChipFor(actor, testKind, skill = null) {
  return actor?.effects?.find(e => {
    if ( (e.getFlag(MODULE_ID, CHIP_FLAG) !== "use") || (e.getFlag(MODULE_ID, "useKey") !== ARMED_KEY) ) return false;
    const a = e.getFlag(MODULE_ID, "armed");
    if ( !a ) return false;
    if ( testKind === "initiative" ) return !!a.initiative;
    return (testKind === "check") && !!skill && (a.skills ?? []).includes(skill);
  }) ?? null;
}

/** "an Intelligence (History or Investigation) or Wisdom (Insight) check" — off the system's own labels. */
function checkPhrase(skills = [], initiative = false) {
  const byAbility = new Map();
  for ( const k of skills ) {
    const s = CONFIG.DND5E.skills?.[k];
    const ab = CONFIG.DND5E.abilities?.[s?.ability]?.label ?? String(s?.ability ?? "").toUpperCase();
    if ( !byAbility.has(ab) ) byAbility.set(ab, []);
    byAbility.get(ab).push(s?.label ?? k);
  }
  const parts = [...byAbility].map(([ab, names]) => `${ab} (${names.join(" or ")})`);
  const checks = parts.length ? `${parts.join(" or ")} check` : "";
  return [checks, initiative ? "Initiative roll" : ""].filter(Boolean).join(" or ");
}
const article = what => (/^[aeiou]/i.test(what) ? "an" : "a");

Hooks.on("dnd5e.postUseActivity", async (activity, usageConfig, results) => {
  try {
    const actor = activity?.actor;
    if ( !actor?.isOwner || (activity.type !== "utility") ) return;
    const entry = d20FoldEntries().find(e => (e.kind === "tactical") && scopeOf(e) && (e.name.toLowerCase() === String(activity.item?.name ?? "").toLowerCase()));
    if ( !entry ) return;
    const scope = scopeOf(entry);
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    if ( message?.getFlag(MODULE_ID, "tacticalArmed") ) return;
    // The rescue's own spend is already folded into the roll: arm nothing.
    if ( message?.getFlag(MODULE_ID, "foldSpend") || usageConfig?.data?.flags?.[MODULE_ID]?.foldSpend ) return;
    const formula = resolveDie(actor, activity.roll?.formula || null);
    const rolled = formula ? await rollDie(formula, actor) : null;
    if ( !rolled ) { console.warn(`${TITLE} | ${entry.name}'s die could not be read off the sheet — add it by hand.`); return; }
    await rolled.roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${entry.name} — the die` });
    const total = Number(rolled.summary.total) || 0;
    const stale = actor.effects.filter(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "use") && (e.getFlag(MODULE_ID, "useKey") === ARMED_KEY) && (e.getFlag(MODULE_ID, "armed")?.name === entry.name));
    if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id)).catch(() => {});
    const what = checkPhrase(scope.skills ?? [], !!scope.initiative);
    const chip = await ActiveEffect.implementation.create({
      name: activity.item.name, img: activity.item.img ?? "icons/svg/dice-target.svg",
      description: `<p><em>“${scope.rule}”</em></p><p>Written by Battle Flow when ${entry.name} was used: the die rolled ${total}; the next ${what} adds it.</p>`,
      origin: activity.item.uuid, disabled: false, transfer: false,
      flags: { [MODULE_ID]: { [CHIP_FLAG]: "use", useKey: ARMED_KEY, armed: { name: entry.name, total, skills: [...(scope.skills ?? [])], initiative: !!scope.initiative, cardId: message?.id ?? null } } }
    }, { parent: actor }).catch(err => { console.error(`${TITLE} | ${entry.name} could not be armed — add the die by hand.`, err); return null; });
    if ( !message ) return;
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await message.setFlag(MODULE_ID, "tacticalArmed", { ...statContext(actor.uuid), name: entry.name, total, what, rule: scope.rule,
      skills: [...(scope.skills ?? [])], initiative: !!scope.initiative,
      itemImg: activity.item.img ?? null, chipId: chip?.id ?? null, spent: null,
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}) });
  } catch(err) {
    console.error(`${TITLE} | A maneuver's use failed to arm — add the die by hand.`, err);
  }
});

/** Fold the armed die into the check (or Initiative) as a SPENT fold; true when it did. */
async function applyArmedFold(message, actor, testKind, { skill = null, combatants = [], total = null } = {}) {
  const chip = armedChipFor(actor, testKind, skill);
  if ( !chip ) return false;
  const a = chip.getFlag(MODULE_ID, "armed");
  const base = Number(message.rolls?.[0]?.total ?? total ?? 0);
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  const spends = [{ kind: "tactical", name: a.name, label: a.name, die: a.total }];
  const remaining = availableFolds(actor, testKind, [], { skill }).filter(o => o.name.toLowerCase() !== a.name.toLowerCase());
  const flag = { ...baseFlag(actor, remaining, testKind, base, remaining.length ? window : 0), spends, armed: true,
    ...(skill ? { skill } : {}),
    ...(testKind === "initiative" ? { combatId: game.combat?.id ?? null, combatantIds: combatants.map(c => c.id) } : {}) };
  const composed = foldedRoll(foldBase(message, flag), foldFolds(message, { ...flag, status: "resolved", outcome: "used" }));
  flag.foldedTotal = composed.total;
  if ( !remaining.length ) { flag.status = "resolved"; flag.outcome = "used"; }
  await message.setFlag(MODULE_ID, "d20fold", flag);
  await chip.delete().catch(() => {});
  const lines = [`${sumText(flag, composed)} — the roll now totals <strong>${composed.total}</strong>.`];
  if ( testKind === "initiative" ) {
    const combat = flag.combatId ? game.combats.get(flag.combatId) : game.combat;
    for ( const id of (flag.combatantIds ?? []) ) {
      const c = combat?.combatants?.get(id);
      if ( c ) await c.update({ initiative: composed.total }).catch(err => console.warn(`${TITLE} | Could not move the initiative.`, err));
    }
    lines.push(`Initiative <strong>${base} → ${composed.total}</strong> — the order is updated.`);
  }
  const item = resolveUuid(chip.origin);
  await announce(message, actor, a.name, testKind, false, lines, { kind: "tactical", item });
  if ( a.cardId ) {
    const card = game.messages.get(a.cardId);
    if ( card ) await queueFlagWrite(card, "tacticalArmed", current => {
      if ( current.spent ) return false;
      current.spent = { total: composed.total, base, testKind, skill: skill ?? null, at: Date.now() };
    }).catch(() => { /* the roll's own card says it */ });
  }
  if ( remaining.length ) armFoldTimer(message);
  return true;
}

async function showArmedNotice(message) {
  const t = message.getFlag(MODULE_ID, "tacticalArmed");
  if ( !t || t.spent ) return;
  const actor = resolveUuid(t.sourceUuid);
  // The checks ARE the buttons (Initiative too in a combat); a press rolls it and acknowledges.
  const buttons = (t.skills ?? []).map((k, i) => ({
    action: `skill-${k}`, label: CONFIG.DND5E.skills?.[k]?.label ?? k, default: i === 0,
    callback: async () => { await acknowledgeMoment(message, "tacticalArmed"); void actor?.rollSkill?.({ skill: k }); }
  }));
  if ( t.initiative && actor && game.combat?.combatants?.some(c => c.actor?.uuid === actor.uuid) ) {
    buttons.push({ action: "initiative", label: "Initiative",
      callback: async () => { await acknowledgeMoment(message, "tacticalArmed"); void actor.rollInitiative({ createCombatants: false, rerollInitiative: true }); } });
  }
  await openMomentPopup(message, "armed", actor, {
    title: `${t.name} — ${actor?.name ?? ""}`, icon: "fa-solid fa-dice-d20", width: 440,
    content: bfCard({ img: t.itemImg, eyebrow: `Maneuver — ${t.name}`, tone: "pending",
      title: `${t.name} — the die rolled ${t.total}`,
      subtitle: `Which check? ${t.total} is added to it`,
      lines: [ruleLine(t.rule)] }) + (t.deadline ? momentBarHTML(t, "reminder") : ""),
    buttons,
    autoCloseAt: t.deadline || null
  });
}

Hooks.on("dnd5e.renderChatMessage", cardRow((message, host) => {
  const t = message.getFlag(MODULE_ID, "tacticalArmed");
  if ( !t ) return;
  const live = !t.spent && (!t.deadline || (t.deadline > Date.now())) && !momentAcknowledged(message, "tacticalArmed");
  const line = document.createElement("div");
  line.innerHTML = bfCard({ img: t.itemImg, eyebrow: `Maneuver — ${t.name}`, tone: t.spent ? "good" : "pending",
    title: t.spent ? `${t.name} — +${t.total} added: ${t.spent.base} + ${t.total} = ${t.spent.total}`
      : `${t.name} — the die rolled ${t.total}; pick the check (${article(t.what)} ${t.what})`,
    subtitle: spendPhrase(poolSpendsOn(message)), lines: [ruleLine(t.rule)] }) + (live ? momentBarHTML(t, "reminder") : "");
  host.appendChild(line);
  const actor = resolveUuid(t.sourceUuid);
  if ( live && canAnswerFor(actor) ) {
    const shownKey = popupKey(message.id, "armed");
    if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showArmedNotice(message); }
    line.appendChild(momentButton(`Answer — ${t.name}`, () => void showArmedNotice(message)));
  }
}));

// THE REFUND ASK: Tactical Mind's use is not expended if the check still fails. A raw check has no
// DC, so the module ASKS and writes the use back. ⚠ The popup closes at its clock but the card's
// control STAYS until answered: a use the rules hand back must stay claimable.

/** The pool the feature consumes: the activity's `itemUses` target. */
function refundPoolFor(actor, name, marker = null) {
  const item = marker?.item ?? itemNamed(actor, name);
  const activity = marker?.activity ?? item?.system.activities?.contents?.[0];
  if ( !activity ) return null;
  const c = (activity.consumption?.targets ?? []).find(t => t.type === "itemUses");
  if ( !c ) return null;
  return (c.target ? actor.items.get(c.target) : item) ?? null;
}

/** @param {{baseTotal?: number|null, total?: number|null, dc?: number|null, die?: number|null}} [numbers] */
async function stampRefundAsk(message, actor, offer, marker, numbers = {}) {
  try {
    const pool = refundPoolFor(actor, offer.name, marker);
    if ( !pool ) return;
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    const num = v => (Number.isFinite(Number(v)) && (v !== null) && (v !== "")) ? Number(v) : null;
    await queueFlagWrite(message, "tacticalRefund", current => {
      if ( current.status ) return false;                 // one ask per roll
      delete current.targets;
      Object.assign(current, {
        status: "pending", name: offer.name, label: labelOf(offer), actorUuid: actor.uuid,
        poolUuid: pool.uuid, poolName: pool.name,
        itemImg: marker?.item?.img ?? itemNamed(actor, offer.name)?.img ?? null,
        rule: RESCUE_KINDS.tactical.rule,
        baseTotal: num(numbers.baseTotal), total: num(numbers.total), dc: num(numbers.dc), die: num(numbers.die),
        ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
      });
    });
  } catch(err) {
    console.error(`${TITLE} | The ${offer.name} refund ask failed to stamp.`, err);
  }
}

/** The check's arithmetic in words, or null on an ask that carries no numbers. */
function refundArithmetic(r) {
  if ( !Number.isFinite(r?.baseTotal) || !Number.isFinite(r?.total) ) return null;
  const die = Number.isFinite(r.die) ? `${r.label}'s d10 rolled ${r.die}, so ` : "";
  return `The check was ${r.baseTotal}; ${die}it is now <strong>${r.total}</strong>${Number.isFinite(r.dc) ? ` vs DC ${r.dc}` : ""}.`;
}

/** The question itself, with the number the GM rules on. */
function refundQuestion(r) {
  if ( !Number.isFinite(r?.total) ) return "Did the check succeed?";
  return Number.isFinite(r.dc) ? `Does ${r.total} pass DC ${r.dc}?` : `Does ${r.total} pass? Ask your GM.`;
}

/** The state sentence on the settled card. */
function refundLine(r) {
  const total = Number.isFinite(r.total) ? ` (${r.total})` : "";
  if ( r.status === "refunded" ) return `The check still failed${total} — the use of ${r.poolName} was <strong>refunded</strong>.`;
  if ( r.status === "kept" ) return `The check succeeded${total} — the use of ${r.poolName} stays spent.`;
  const math = refundArithmetic(r);
  return `${math ? `${math} ` : ""}${refundQuestion(r)} If it still failed, this use of ${r.poolName} isn't expended — answer to refund it.`;
}

/** First writer wins; a refund then writes the pool back and posts the receipt. */
async function answerRefund(message, choice) {
  let claimed = false;
  await queueFlagWrite(message, "tacticalRefund", current => {
    if ( current.status !== "pending" ) return false;
    current.status = choice;                              // "kept" | "refunded"
    current.answeredAt = Date.now();
    claimed = true;
  });
  if ( !claimed || (choice !== "refunded") ) return;
  const r = message.getFlag(MODULE_ID, "tacticalRefund");
  const actor = resolveUuid(r.actorUuid);
  try {
    const pool = await fromUuid(r.poolUuid);
    if ( !pool ) throw new Error(`the pool ${r.poolUuid} is gone`);
    const spent = Number(pool.system?.uses?.spent ?? 0);
    if ( spent > 0 ) await pool.update({ "system.uses.spent": spent - 1 });
    const uses = pool.system?.uses ?? {};
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({
        img: r.itemImg, eyebrow: `D20 Fold — ${r.label}`, tone: "good",
        title: `${r.label} — the use is refunded`,
        subtitle: `${actor?.name ?? ""} · the check still failed`,
        lines: [`${r.poolName}: <strong>${uses.value ?? 0} of ${uses.max ?? 0}</strong> remaining.`, ruleLine(r.rule)]
      })
    });
  } catch(err) {
    console.error(`${TITLE} | The ${r.poolName} refund failed to write.`, err);
    ui.notifications?.warn(`${TITLE} | The refund could not be written — restore the use of ${r.poolName} by hand.`);
  }
}

async function showRefundNotice(message) {
  const r = message.getFlag(MODULE_ID, "tacticalRefund");
  if ( !r || (r.status !== "pending") ) return;
  const actor = resolveUuid(r.actorUuid);
  await openMomentPopup(message, "refund", actor, {
    title: `${r.label} — ${actor?.name ?? ""}`, icon: RESCUE_KINDS.tactical.icon, width: 440,
    content: bfCard({
      img: r.itemImg, eyebrow: `D20 Fold — ${r.label}`, tone: "pending",
      title: refundQuestion(r),
      subtitle: `If it still failed, this use of ${r.poolName} comes back`,
      lines: [refundArithmetic(r), ruleLine(r.rule)]
    }) + (r.deadline ? momentBarHTML(r, "to answer") : ""),
    buttons: [
      { action: "keep", label: "It succeeded — keep the spend", callback: () => answerRefund(message, "kept") },
      { action: "refund", label: `It still failed — refund the use`, callback: () => answerRefund(message, "refunded") }
    ],
    autoCloseAt: r.deadline || null
  });
}

// The ask shows once the fold is settled: the bar while the clock runs, the recall button until answered.
Hooks.on("dnd5e.renderChatMessage", cardRow((message, host) => {
  try {
    const r = message.getFlag(MODULE_ID, "tacticalRefund");
    if ( !r || (r.status !== "pending") ) return;
    if ( message.getFlag(MODULE_ID, "d20fold")?.status === "pending" ) return;
    const block = host.querySelector(".battleflow-d20fold") ?? host;
    const line = document.createElement("div");
    line.innerHTML = momentBarHTML(r, "to answer");
    block.appendChild(line);
    scheduleBarSync(line);
    const actor = resolveUuid(r.actorUuid);
    if ( !canAnswerFor(actor) ) return;
    const shownKey = popupKey(message.id, "refund");
    if ( !shownMoments.has(shownKey) ) { shownMoments.add(shownKey); void showRefundNotice(message); }
    line.appendChild(momentButton(`Answer — ${r.label}`, () => void showRefundNotice(message)));
  } catch(err) {
    console.error(`${TITLE} | The refund ask failed to render.`, err);
  }
}));
