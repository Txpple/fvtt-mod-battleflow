/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the DEMAND — the casting
 * client stamps the `saves` flag on the save activity's own usage card (the bus), with the
 * dead-target gate, metamagic, a chosen area and an emanation's reach applied at the cast.
 * index.js is the directory's only public face and fixes the registration order.
 */
import { MODULE_ID, TITLE, S, setting, statContext } from "../core.js";
import { applicableProfiles, resolveUuid, itemNamed } from "../lookup.js";
import { CARD, activityUuidOf, isCard, targetsOf } from "../decide/card.js";
import { saveDemandData, saveTargetEntry, putsToSleep } from "../decide/demand.js";
import { METAMAGIC_FLAG, metamagicRuleText } from "../decide/metamagic.js";
import { AREA_ASK_FLAG, AREA_CHOICE_FLAG, carefulProtects, heightenedMark, choiceCapFrom, choiceRuleFrom, chosenByDefault, choiceNeedsAsk } from "../decide/area-ask.js";
import { askCandidates, newAsk, raiseAsk } from "../area-ask.js";
import { tokensInRegions } from "../geometry.js";
import { isDeadForSaves } from "../decide/eligible.js";
import { EMANATIONS, tableIndex } from "../decide/registry.js";
import { reachAdmits, affectsAdmits } from "../decide/emanations.js";
import { emanationEntries, spentAreaListed, chosenAreaListed } from "../settings.js";
import { raiseHold, releaseHold, isHeld } from "../holds.js";
// ⚠ Safe statically, unlike auto-damage.js's own ui.js import (the ESM order trap): the entry
// reaches auto-damage.js long before this directory, so no hook registration moves. Do not make
// it dynamic without re-running check-hook-order.
import { offerSaveDamageRoll, rollDamageForSave } from "../auto-damage.js";

/* --- metamagic on the demand ------------------------------------------------------------------ */

/** The caster's identity and side, as Careful's and Heightened's defaults read them. */
function casterFactsOf(activity) {
  const caster = activity?.actor ?? null;
  const tok = caster?.token ?? caster?.getActiveTokens?.(true, true)?.[0] ?? null;
  return { casterUuid: caster?.uuid ?? null, casterDisposition: tok?.disposition ?? (caster ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : null) };
}

/**
 * What the cast's metamagic does to THIS demand: Careful's protected creatures leave the target
 * list, Heightened's mark rides the demand for the save gate. Derived from the creatures the save
 * REACHES (at the stamp, or at adoption for a bare cast) and written back onto the metamagic flag;
 * a player's own pick (`chosen: true`) is honoured, never recomputed.
 * @returns {Promise<{protectedUuids: Set<string>, heightened: {uuid: string, name: string, caster: string|null, rule: string}|null}>}
 */
export async function metamagicForDemand(card, activity, contained) {
  const mm = card?.getFlag(MODULE_ID, METAMAGIC_FLAG);
  // An ask still to come (Careful or Heightened, nothing chosen yet): the stamp defers the dice on it.
  const pendingAsk = !!mm && ((mm.key === "careful") || (mm.key === "heightened")) && !mm.chosen;
  const none = { protectedUuids: new Set(), heightened: null, hold: false, pendingAsk };
  if ( !mm || !Array.isArray(contained) ) return none;
  const facts = casterFactsOf(activity);
  // THE ASK AT THE AREA: a pick the window could not make (nobody selected, the area came later)
  // is asked NOW of the creatures the area holds, and the demand WAITS (no targets, no clock) until
  // the caster answers or the clock keeps the default. area-ask.js opens and answers the ask.
  if ( ((mm.key === "careful") || (mm.key === "heightened")) && !mm.chosen && contained.length ) {
    const ask = card.getFlag(MODULE_ID, AREA_ASK_FLAG);
    if ( ask?.status !== "pending" && card.canUserModify?.(game.user, "update") ) {
      await raiseAsk(card, newAsk({ kind: mm.key, feature: mm.feature, cap: mm.cap ?? 1, rule: mm.rule ?? null,
        candidates: askCandidates(contained), caster: { uuid: facts.casterUuid, disposition: facts.casterDisposition, name: activity?.actor?.name ?? null } }));
    }
    return { ...none, hold: true };
  }
  if ( mm.key === "careful" ) {
    const list = carefulProtects({ contained, ...facts, cap: mm.cap ?? 1, chosen: mm.chosen ? (mm.protected ?? []).map(p => p.uuid) : null });
    // ⚠ A CHOSEN list is the player's and is never rewritten — a bare cast's stamp sees an EMPTY
    // reach, and writing that back would erase the ticks. Only a DEFAULT list is written.
    const same = JSON.stringify(list) === JSON.stringify(mm.protected ?? null);
    if ( !mm.chosen && !same && card.canUserModify?.(game.user, "update") ) await card.setFlag(MODULE_ID, METAMAGIC_FLAG, { ...mm, protected: list });
    return { protectedUuids: new Set(list.map(p => p.uuid)), heightened: null, hold: false, pendingAsk };
  }
  if ( mm.key === "heightened" ) {
    const mark = heightenedMark({ contained, ...facts, chosen: mm.chosen ? (mm.target?.uuid ?? null) : null });
    if ( !mark ) return none;
    const rule = mm.rule ?? metamagicRuleText(itemNamed(activity?.actor, mm.feature)?.system?.description?.value ?? "");
    const same = (mm.target?.uuid === mark.uuid) && (mm.rule === rule);
    if ( !mm.chosen && !same && card.canUserModify?.(game.user, "update") ) await card.setFlag(MODULE_ID, METAMAGIC_FLAG, { ...mm, target: mark, rule });
    return { protectedUuids: new Set(), heightened: { ...mark, caster: activity?.actor?.name ?? null, rule }, hold: false, pendingAsk };
  }
  return none;
}

/* --- a spell that chooses its targets --------------------------------------------------------- */

/**
 * WHO A CHOSEN AREA AFFECTS (registry.js CHOSEN_AREAS): a listed spell's area is where its caster
 * CHOOSES, never who owes the save (RULINGS *Spells that choose their targets*). Read at the stamp
 * and at adoption, before Careful and Heightened:
 *   - a choice on the card (`areaChoice`) filters the contents to the chosen;
 *   - an open ask holds the demand, empty and clockless;
 *   - a real choice to make (`choiceNeedsAsk`) raises the ask, kind `choose` (carrying Heightened's
 *     radio when that pick is still to come), and holds;
 *   - otherwise the default (every hostile, up to the spell's number) is written as the choice.
 * The caster and a corpse are never candidates. Not listed, or no area in hand: pass through.
 * @returns {Promise<{contained: object[]|null, hold: boolean}>}
 */
export async function areaChoiceForDemand(card, activity, contained) {
  if ( !Array.isArray(contained) || !chosenAreaListed(activity?.item?.name) ) return { contained, hold: false };
  const facts = casterFactsOf(activity);
  const casterTok = activity?.actor?.token ?? activity?.actor?.getActiveTokens?.(true, true)?.[0] ?? null;
  const pool = contained.filter(c => (c.uuid !== facts.casterUuid) && !(casterTok && (c.tokenId === casterTok.id))).filter(saveDemandable);
  const record = card?.getFlag(MODULE_ID, AREA_CHOICE_FLAG);
  if ( Array.isArray(record?.chosen) ) {
    const chosen = new Set(record.chosen.map(c => c.uuid));
    return { contained: pool.filter(c => chosen.has(c.uuid)), hold: false };
  }
  const ask = card?.getFlag(MODULE_ID, AREA_ASK_FLAG);
  if ( (ask?.status === "pending") && (ask.kind === "choose") ) return { contained: [], hold: true };
  if ( !pool.length ) return { contained: pool, hold: false };
  const spell = activity.item.name;
  const description = activity.item.system?.description?.value ?? "";
  const cap = choiceCapFrom(description);
  const candidates = askCandidates(pool);
  const writable = !!card?.canUserModify?.(game.user, "update");
  if ( !choiceNeedsAsk({ candidates, ...facts, cap }) ) {
    const chosen = chosenByDefault({ candidates, ...facts, cap });
    const ids = new Set(chosen.map(c => c.uuid));
    if ( writable ) await card.setFlag(MODULE_ID, AREA_CHOICE_FLAG, { spell, chosen, cap, asked: false,
      left: candidates.filter(c => !ids.has(c.uuid)).map(c => ({ uuid: c.uuid, name: c.name })), ...statContext(facts.casterUuid) });
    return { contained: pool.filter(c => ids.has(c.uuid)), hold: false };
  }
  if ( writable ) {
    // Heightened's pick still to come rides the same popup — a radio among the chosen.
    const mm = card.getFlag(MODULE_ID, METAMAGIC_FLAG);
    const heightened = ((mm?.key === "heightened") && !mm.chosen)
      ? { feature: mm.feature, rule: mm.rule ?? metamagicRuleText(itemNamed(activity.actor, mm.feature)?.system?.description?.value ?? "") } : null;
    await raiseAsk(card, newAsk({ kind: "choose", feature: spell, spell, cap, rule: choiceRuleFrom(description), itemImg: activity.item.img ?? null, heightened,
      candidates, caster: { uuid: facts.casterUuid, disposition: facts.casterDisposition, name: activity.actor?.name ?? null } }));
  }
  return { contained: [], hold: true };
}

/**
 * THE PICTURE WAITS FOR THE CHOICE: FX Studio asks the hold registry before playing anything keyed
 * on the cast's activity, so a hold raised as the card is born makes the card and area wait.
 * Released by the stamp when nothing is asked, or by the answer (area-ask.js, on every client).
 * Bounded by the ask's clock plus slack; a clockless ask holds clockless and the consumer bounds it.
 */
const CHOICE_HOLD_SLACK_MS = 30_000;
Hooks.on("preCreateChatMessage", doc => {
  try {
    if ( !setting(S.saves) || !isCard(doc, CARD.usage) ) return;
    // metamagic's held card re-posted with its answer: the question was asked before it existed.
    if ( doc.getFlag?.(MODULE_ID, AREA_CHOICE_FLAG) || doc.getFlag?.(MODULE_ID, METAMAGIC_FLAG)?.chosen ) return;
    const uuid = activityUuidOf(doc);
    const activity = uuid ? resolveUuid(uuid) : null;
    if ( (activity?.type !== "save") || !activity.target?.template?.type || !chosenAreaListed(activity.item?.name) ) return;
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    raiseHold(uuid, { reason: "area-choice", bound: window ? (window * 1000) + CHOICE_HOLD_SLACK_MS : null });
  } catch(err) { console.warn(`${TITLE} | The chosen area's hold could not be raised — the picture plays at once.`, err); }
});

/** After the stamp: lift the chosen area's hold unless its ask now stands (the answer lifts it then). */
function settleChoiceHold(activity, message) {
  const uuid = activity?.uuid ?? "";
  if ( !uuid || !isHeld(uuid) ) return;
  const ask = message?.getFlag(MODULE_ID, AREA_ASK_FLAG);
  if ( (ask?.status === "pending") && (ask.kind === "choose") ) return;
  if ( !chosenAreaListed(activity.item?.name) ) return;   // somebody else's hold (metamagic's held card) — theirs to lift
  releaseHold(uuid, message ?? null);
}

/* --- the stamp: the casting client writes the demand on the usage card --------------------- */

/** Stamp-time filter: an unresolvable uuid stays IN (the buzzer voids gone targets — never
 * eat a demand on a lookup miss); a dead one stays out. */
export function saveDemandable(t) {
  const actor = resolveUuid(t.uuid);
  if ( !(actor instanceof Actor) ) return true;
  return !isDeadForSaves(actor);
}

Hooks.on("dnd5e.postUseActivity", (activity, _usageConfig, results) => {
  if ( !setting(S.saves) ) return;
  if ( activity?.type !== "save" ) return;
  const message = (results?.message instanceof ChatMessage) ? results.message : null;
  if ( !message ) return; // used with create: false — no card, no bus, nothing to run
  void stampSaveDemand(activity, message, results).finally(() => settleChoiceHold(activity, message));
});

// A usage card the metamagic ask held back until the caster answered: born with the pick made, so
// the stamp runs as at the use — the placed areas in hand — on the client that posted it.
Hooks.on("battleflow.deferredUsageCard", ({ activity, message, templates }) => {
  if ( !setting(S.saves) ) return;
  if ( (activity?.type !== "save") || !(message instanceof ChatMessage) ) return;
  void stampSaveDemand(activity, message, { templates: [templates ?? []] }).finally(() => settleChoiceHold(activity, message));
});

async function stampSaveDemand(activity, message, results) {
  try {
    if ( message.getFlag(MODULE_ID, "saves") ) return; // never re-stamp
    // ⚠ A template spell's target set is what the AREA contains, not what was clicked, in both
    // directions; manual targeting stays the bus for everything without a template. postUseActivity
    // fires after the placement, so `results.templates` is real: the RegionDocument[] it created
    // (the flatten tolerates a nested shape, smoke-saves §8d). Containment is the platform's own test.
    const placed = emanationReach(activity, tokensInRegions((results?.templates ?? []).flat().filter(t => t?.parent)));
    // A spell that chooses its targets: the chosen stand in for the contents, or the demand waits.
    const choice = await areaChoiceForDemand(message, activity, placed);
    const contained = choice.contained;
    const raw = contained ?? targetsOf(message);
    // THE DEAD-TARGET GATE runs on the RESOLVED set, before the setFlag, so an all-dead cast
    // starves everything downstream by construction; raw emptiness keeps its meaning (a bare
    // template cast still stamps a WAITING demand). Careful's protected leave here, Heightened's
    // mark joins below; a chosen area's own ask holds the demand the same way.
    const metamagic = choice.hold ? { protectedUuids: new Set(), heightened: null, hold: true, pendingAsk: false }
      : await metamagicForDemand(message, activity, contained ?? raw);
    // An open metamagic ask holds the demand EMPTY, clockless; the answer fills it (metamagic.js).
    const targets = metamagic.hold ? [] : raw.filter(saveDemandable).filter(t => !metamagic.protectedUuids.has(t.uuid));
    if ( raw.length && !targets.length && !metamagic.protectedUuids.size && !metamagic.hold ) return; // every target is dead — fully native cast
    // A TEMPLATE-SHAPED activity's targetless cast (Web: cast bare, then place) stamps a WAITING
    // demand — zero targets, NO deadline; adoption fills it and arms the clock. No template shape
    // anywhere means no area is coming: it stays native.
    const templateShaped = !!activity.target?.template?.type;
    if ( !targets.length && !templateShaped ) return; // targetless, no area coming — the humans have it
    // A self-aimed save's snapshot is incidental UI targeting. A BLANK affects is allowed on
    // purpose: hand-authored statblock abilities often carry none, and eating their saves silently
    // is a false negative the table cannot see.
    if ( !contained && ((activity.target?.affects?.type ?? null) === "self") ) return;
    const dc = activity.save?.dc?.value;
    if ( !(dc > 0) ) return; // no DC prepared — nothing to judge against (pre-2024 data)
    const abilities = [...(activity.save?.ability ?? [])];
    if ( !abilities.length ) return;

    // The effect names by outcome, resolved NOW while the item surely exists (the popup's stakes line
    // and the LR unwind read them). The activity's list holds PROFILES whose effects resolve async.
    const entries = (await applicableProfiles(activity)).map(({ profile, effect }) => ({ onSave: profile.onSave, effect }));
    // An EMANATION's effect (Spirit Guardians' Half Speed) is the area's STANDING effect, kept by the
    // region — the verdict never applies it, and the dialog never promises it.
    const emanation = !!emanationRowFor(activity);
    const effectNames = emanation ? { fail: [], always: [] } : {
      fail: entries.filter(e => !e.onSave).map(e => e.effect.name),
      always: entries.filter(e => e.onSave).map(e => e.effect.name)
    };

    // ⚠ `onSave: "full"` marks damage the save does NOT modulate — situational rider damage (Web's
    // burn, only when the webs burn). The demand carries no damage for it: no auto-roll, no
    // per-verdict application; the card's own enricher stays clickable, GM-judged.
    const onSave = activity.damage?.onSave ?? "half";
    const saveModulated = !!activity.damage?.parts?.length && (onSave !== "full");

    // Interpose Shield is POST-VERDICT and success-only: no choice stamps with the demand;
    // saveChoiceSpec opens it when a SAVED verdict lands.
    const window = Math.max(0, Number(setting(S.saveTimer)) || 0);
    const awaiting = !targets.length; // template-shaped, area not placed yet (the gate above)
    // ⚠ THE EMPTY INSTANT: an instantaneous area PLACED with nobody inside is spent — the demand
    // stamps DONE so the elect's floor sweeps it like a resolved one. A clockless wait belongs
    // only to an area not placed yet (`contained` null); a duration area keeps its wait.
    // ⚠ The ITEM's duration for a spell (a spell's activity duration is not the spell's — Shield's
    // reads "inst"), the ACTIVITY's for a feature: a monster's `feat` has no system.duration, and a
    // null reads as a duration area that never ends.
    const durationUnits = activity.item?.system?.duration?.units ?? activity.duration?.units ?? null;
    // …and a LISTED spent area counts as an instant.
    const instantArea = (durationUnits === "inst") || spentAreaListed(activity.item?.name);
    const emptyInstant = awaiting && !!contained && instantArea && !metamagic.hold;
    // The flag through its one constructor (decide/demand.js; emanations.js stamps the same shape).
    await message.setFlag(MODULE_ID, "saves", saveDemandData({
      status: emptyInstant ? "done" : "pending",
      stat: statContext(activity.actor?.uuid ?? null), // the data-plane stamp — the caster forced this
      abilities, dc,
      damageOnSave: onSave,
      hasDamage: saveModulated,
      effectNames,
      // WHAT THE SAVE IS AGAINST: a spell's demand and its failed-save statuses — Aura of Purity
      // and Circle of Power read these off the pending demand when the roller's dialog opens.
      demand: { spell: (activity.item?.type === "spell") || (activity.item?.system?.properties?.has?.("mgc") ?? false),
        statuses: [...new Set(entries.filter(e => !e.onSave).flatMap(e => [...(e.effect?.statuses ?? [])]))],
        // Trance: whether a failure would put the target to sleep (decide/demand.js `putsToSleep`).
        sleep: putsToSleep({ itemName: activity.item?.name ?? null, effectNames: entries.filter(e => !e.onSave).map(e => e.effect?.name) }),
        // Heightened Spell's mark: the one target whose gate opens at Disadvantage.
        ...(metamagic.heightened ? { heightened: metamagic.heightened } : {}) },
      effectsHandled: emanation ? "emanation" : null,
      activityUuid: activity.uuid,
      // The dnd5e area type — adoption's shape gate for a TOOLBAR-drawn area, which has no origin flag.
      templateType: activity.target?.template?.type ?? null,
      templated: !!contained,
      awaitingTemplate: awaiting && !emptyInstant,
      durationUnits,
      item: { name: activity.item?.name ?? "the effect", img: activity.item?.img ?? null },
      casterName: activity.actor?.name ?? null,
      // A waiting demand carries its window but NO deadline — the clock starts at adoption.
      window: (window && !emptyInstant) ? window : 0,
      deadline: (window && !emptyInstant && !awaiting) ? Date.now() + (window * 1000) : null,
      // Per-target state is an ARRAY with uuid fields — never a uuid-keyed map (dotted-key expansion).
      targets: targets.map(t => saveTargetEntry(t.uuid, t.name))
    }));

    // The machine rolls the spell's damage itself as the demand stamps (the card's Damage button is
    // hidden), chained to the card so upcasting and damageOnSave ride the native plumbing. Save-
    // modulated damage only; an empty instant rolls nothing. The caster's own-dice popup can be
    // offered here because this hook runs on the casting client.
    if ( saveModulated && !emptyInstant ) {
    // ⚠ NOT awaited: the targets' save asks arm off the FLAG, and a caster thinking about dice must
    // never hold up the table's saves.
    // ⚠ Deferred while the caster is asked who the area spares, or while that ask is still to come:
    // the dice, their popup and their animation wait for the answer (metamagic.js says when).
      if ( metamagic.hold || (metamagic.pendingAsk && awaiting) ) await message.setFlag(MODULE_ID, "savesDeferredRoll", { damageOnSave: onSave });
      else await rollSaveDamageNow(activity, message, { damageOnSave: onSave, targets, awaiting });
    }
  } catch(err) {
    console.error(`${TITLE} | Could not stamp the save demand.`, err);
  }
}

/** The caster's dice — their own popup, or the automation's roll — for a demand just stamped. */
async function rollSaveDamageNow(activity, message, { damageOnSave, targets, awaiting }) {
  if ( setting(S.playerRollDamage) ) {
    void offerSaveDamageRoll(activity, message, { damageOnSave, targets, awaiting });
  }
  else await rollDamageForSave(activity, message);
}

// The deferred dice, once the area ask is answered — on the answering client (the caster's, or the
// elect's at the clock). One runner: the hook is local and the flag is cleared before the roll.
Hooks.on("battleflow.areaAskAnswered", async message => {
  try {
    const deferred = message?.getFlag(MODULE_ID, "savesDeferredRoll");
    if ( !deferred ) return;
    const activity = resolveUuid(activityUuidOf(message) ?? "");
    if ( !activity ) return;
    await message.unsetFlag(MODULE_ID, "savesDeferredRoll");
    const flag = message.getFlag(MODULE_ID, "saves");
    if ( !flag || (flag.status === "done") ) return;   // everyone spared — no dice owed
    await rollSaveDamageNow(activity, message, { damageOnSave: deferred.damageOnSave ?? "half", targets: flag.targets ?? [], awaiting: false });
  } catch(err) {
    console.error(`${TITLE} | The deferred save damage could not roll — press the card's damage.`, err);
  }
});

/**
 * AN EMANATION'S REACH AT THE CAST: a placed area asks everyone in it, which is wrong for a spell
 * that lets the caster designate creatures unaffected. A LISTED emanation row filters by its reach
 * (DESIGN §5 *Emanations* — harmful reaches enemies, by disposition), any area whose activity
 * names who it affects filters by that (`affectsAdmits`), and the caster's own token never owes
 * its own spell a save. Null in, null out.
 */
const EMANATION_INDEX = tableIndex(EMANATIONS);
function emanationRowFor(activity) {
  if ( !activity?.item || !setting(S.emanations) ) return null;
  const key = EMANATION_INDEX.keyNamed(activity.item.name);
  const row = key ? EMANATIONS[key] : null;
  if ( !row?.reach || !emanationEntries().some(e => e.kind === key.toLowerCase()) ) return null;
  return row;
}
export function emanationReach(activity, contained) {
  if ( !Array.isArray(contained) ) return contained;
  const row = emanationRowFor(activity);
  const affects = activity?.target?.affects?.type ?? null;
  if ( !row && (affects !== "enemy") && (affects !== "ally") ) return contained;
  const caster = activity.actor ?? null;
  const casterTok = caster?.token ?? caster?.getActiveTokens?.(true, true)?.[0] ?? null;
  const casterDisposition = casterTok?.disposition ?? CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  return contained.filter(c => (c.tokenId !== casterTok?.id) && (c.uuid !== caster?.uuid)
    && (!row || reachAdmits(row.reach, casterDisposition, c.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL))
    && affectsAdmits(affects, casterDisposition, c.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL));
}
