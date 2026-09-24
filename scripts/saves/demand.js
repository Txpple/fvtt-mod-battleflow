/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the DEMAND — the casting client stamps the `saves` flag on the save
 * activity's own usage card (the bus), the dead-target gate, an emanation's reach at the cast.
 * The machine-tier pass, Stage 4c (2026-09-05, ruling 3): saves.js became this directory —
 * one flag, one machine, one part per spine step; index.js is the only public face and fixes
 * the registration order. Every body here is the one saves.js carried; nothing was rewritten.
 */
import { MODULE_ID, TITLE, S, setting, statContext } from "../core.js";
import { applicableProfiles, resolveUuid, itemNamed } from "../lookup.js";
import { CARD, activityUuidOf, isCard, targetsOf } from "../decide/card.js";
import { saveDemandData, saveTargetEntry } from "../decide/demand.js";
import { METAMAGIC_FLAG, METAMAGIC_ASK_FLAG, AREA_CHOICE_FLAG, carefulProtects, heightenedMark, metamagicRuleText,
  choiceCapFrom, choiceRuleFrom, chosenByDefault, choiceNeedsAsk } from "../decide/metamagic.js";
import { tokenForUuid, tokensInRegions } from "../geometry.js";
import { isDeadForSaves } from "../decide/eligible.js";
import { EMANATIONS, tableIndex } from "../decide/registry.js";
import { reachAdmits } from "../decide/emanations.js";
import { emanationEntries, spentAreaListed, chosenAreaListed } from "../settings.js";
import { isPartyMember } from "../shared.js";
import { raiseHold, releaseHold, isHeld } from "../holds.js";
// ⚠ SAFE STATICALLY, unlike auto-damage.js's own ui.js import (v1.6.1's ESM order trap): the
// entry reaches auto-damage.js long before this directory, so that module is fully evaluated
// before this line is read and no hook registration moves. Re-checked with check-hook-order; do
// not promote it to dynamic without re-running that.
import { offerSaveDamageRoll, rollDamageForSave } from "../auto-damage.js";

/* --- metamagic on the demand (the metamagic pass, Stage 2, 2026-09-09) ---------------------- */

/** The caster's identity and side, as Careful's and Heightened's defaults read them. */
function casterFactsOf(activity) {
  const caster = activity?.actor ?? null;
  const tok = caster?.token ?? caster?.getActiveTokens?.(true, true)?.[0] ?? null;
  return { casterUuid: caster?.uuid ?? null, casterDisposition: tok?.disposition ?? (caster ? CONST.TOKEN_DISPOSITIONS.FRIENDLY : null) };
}

/** The token document behind a demand row — its own id, the snapshot's token uuid, or the actor's token on the canvas. */
function tokenDocOf(c) {
  if ( c?.tokenId ) return canvas?.tokens?.get(c.tokenId)?.document ?? null;
  const viaUuid = c?.token ? resolveUuid(c.token) : null;
  if ( viaUuid instanceof TokenDocument ) return viaUuid;
  return tokenForUuid(c?.uuid)?.document ?? null;
}

/**
 * What the cast's metamagic does to THIS demand: Careful's protected creatures leave the target
 * list (no ask, no timer roll, no damage — the option's own words), Heightened's mark rides the
 * demand for the save gate to read. The card's birth flag (metamagic.js) says which option was
 * ticked; the lists are derived here from the creatures the save REACHES — at the stamp for a
 * targeted cast, at adoption for a bare cast whose area lands later — and written back onto the
 * metamagic flag so the card line and the adjust popup show what stands. The player's own
 * adjustment (`protected` / `target` already on the flag with `chosen: true`) is honoured, never
 * recomputed. Called from the stamp and from the adoption refresh alike.
 * @returns {Promise<{protectedUuids: Set<string>, heightened: {uuid: string, name: string, caster: string|null, rule: string}|null}>}
 */
export async function metamagicForDemand(card, activity, contained) {
  const mm = card?.getFlag(MODULE_ID, METAMAGIC_FLAG);
  // An ask still to come — Careful or Heightened, nothing chosen in the window yet: at the area
  // when it lands (`hold` says it is open now). The stamp defers the caster's dice on it.
  const pendingAsk = !!mm && ((mm.key === "careful") || (mm.key === "heightened")) && !mm.chosen;
  const none = { protectedUuids: new Set(), heightened: null, hold: false, pendingAsk };
  if ( !mm || !Array.isArray(contained) ) return none;
  const facts = casterFactsOf(activity);
  // THE ASK AT THE AREA (user ruling 2026-09-09, third look: "when the template is placed …
  // intercept the next message, do a popup like careful spell check marks, listing everything in
  // the template, then continue … with the ticked excluded"). A pick the window could not make —
  // nobody was selected, the area came later — is asked NOW, of the creatures the area holds, and
  // the demand WAITS (no targets, no clock, no asks) until the caster answers or the clock keeps
  // the default. The ask rides its own flag (metamagic.js opens the popup and answers it); this
  // helper only says "not yet".
  if ( ((mm.key === "careful") || (mm.key === "heightened")) && !mm.chosen && contained.length ) {
    const ask = card.getFlag(MODULE_ID, METAMAGIC_ASK_FLAG);
    if ( ask?.status !== "pending" && card.canUserModify?.(game.user, "update") ) {
      const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
      await card.setFlag(MODULE_ID, METAMAGIC_ASK_FLAG, {
        status: "pending", kind: mm.key, feature: mm.feature, cap: mm.cap ?? 1, rule: mm.rule ?? null,
        // A TARGETED cast's rows are the card's target snapshot — actor uuid, token uuid, name —
        // with no disposition and no token id, so the ask ticked nobody by default (the walk's
        // suite, 2026-09-18, once Careful stopped listing names in the window); the token fills both.
        candidates: contained.map(c => {
          const tok = tokenDocOf(c);
          return { uuid: c.uuid, name: c.name, disposition: c.disposition ?? tok?.disposition ?? null, tokenId: c.tokenId ?? tok?.id ?? null, party: isPartyMember(c.uuid) };
        }),
        casterUuid: facts.casterUuid, casterDisposition: facts.casterDisposition, casterName: activity?.actor?.name ?? null,
        ...statContext(facts.casterUuid),
        ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
      });
    }
    return { ...none, hold: true };
  }
  if ( mm.key === "careful" ) {
    const list = carefulProtects({ contained, ...facts, cap: mm.cap ?? 1, chosen: mm.chosen ? (mm.protected ?? []).map(p => p.uuid) : null });
    // ⚠ A CHOSEN list is the player's and is never rewritten — the stamp of a bare cast sees an
    // EMPTY reach, and writing that back erased the ticks made in the window (measured 2026-09-09,
    // §9: the protected two were asked their saves). Only a DEFAULT list is derived and written.
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

/* --- a spell that chooses its targets (2026-09-24, Session 8's Slow) ----------------------- */

/** The ask-at-the-area's rows for a demand's creatures — disposition and token filled from the canvas. */
function askCandidates(contained) {
  return contained.map(c => {
    const tok = tokenDocOf(c);
    return { uuid: c.uuid, name: c.name, disposition: c.disposition ?? tok?.disposition ?? null, tokenId: c.tokenId ?? tok?.id ?? null, party: isPartyMember(c.uuid) };
  });
}

/**
 * WHO A CHOSEN AREA AFFECTS (registry.js CHOSEN_AREAS — user, 2026-09-24: Slow asked Invictus,
 * inside its cube, for a save). A listed spell's area is where its caster CHOOSES, never who owes
 * the save. Read against the area's contents at the stamp and at adoption, before Careful and
 * Heightened:
 *   - a choice already on the card (`areaChoice` — answered, or the default written when there
 *     was nothing to choose) filters the contents to the chosen, however often the area is re-read;
 *   - an ask still open holds the demand, empty and clockless, as Careful's does;
 *   - a real choice to make (decide/metamagic.js `choiceNeedsAsk` — someone not hostile in the
 *     area, or more hostiles than the spell allows) raises the ask on the card, kind `choose`,
 *     carrying Heightened's radio when that pick is still to come (one popup), and holds;
 *   - no choice to make writes the default (every hostile, up to the spell's number) as the
 *     choice, so the card says who, and filters the contents to it.
 * The caster is never a candidate for their own spell, and a corpse never is (the dead gate).
 * Not a listed spell, or no area in hand (`contained` null): the contents pass through.
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
  const ask = card?.getFlag(MODULE_ID, METAMAGIC_ASK_FLAG);
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
    const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
    await card.setFlag(MODULE_ID, METAMAGIC_ASK_FLAG, {
      status: "pending", kind: "choose", feature: spell, spell, cap, rule: choiceRuleFrom(description), itemImg: activity.item.img ?? null,
      ...(heightened ? { heightened } : {}),
      candidates, casterUuid: facts.casterUuid, casterDisposition: facts.casterDisposition, casterName: activity.actor?.name ?? null,
      ...statContext(facts.casterUuid),
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
    });
  }
  return { contained: [], hold: true };
}

/**
 * THE PICTURE WAITS FOR THE CHOICE (the user's 2026-09-09 ruling on Careful's ask — "can
 * everything, including the animation, be paused so the person has time to select" — carried to
 * the chosen area). The card is NOT held back here: FX Studio asks the hold registry before it
 * plays anything keyed on the cast's activity, the card and the placed area alike, so a hold
 * raised before the card is born makes both wait. Raised on the casting client as the card is
 * born; released by the stamp when there is nothing to ask (below), or by the answer (metamagic.js,
 * on every client, so the caster's lifts wherever the answer came from). Bounded by the ask's own
 * clock plus slack; a clockless ask holds clockless (§5 law 11) and the consumer bounds its wait.
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
  const ask = message?.getFlag(MODULE_ID, METAMAGIC_ASK_FLAG);
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

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  if ( !setting(S.saves) ) return;
  if ( activity?.type !== "save" ) return;
  const message = (results?.message instanceof ChatMessage) ? results.message : null;
  if ( !message ) return; // used with create: false — no card, no bus, nothing to run
  void stampSaveDemand(activity, message, results).finally(() => settleChoiceHold(activity, message));
});

// A usage card the metamagic ask held back until the caster answered (metamagic.js, 2026-09-09):
// it is born with the pick made, so the stamp runs as it would have at the use — the placed
// templates in hand, the protected filtered, the dice rolled — on the client that posted it.
Hooks.on("battleflow.deferredUsageCard", ({ activity, message, templates }) => {
  if ( !setting(S.saves) ) return;
  if ( (activity?.type !== "save") || !(message instanceof ChatMessage) ) return;
  void stampSaveDemand(activity, message, { templates: [templates ?? []] }).finally(() => settleChoiceHold(activity, message));
});

async function stampSaveDemand(activity, message, results) {
  try {
    if ( message.getFlag(MODULE_ID, "saves") ) return; // never re-stamp
    // ⚠ A template spell's target set is what the AREA contains, not what was clicked —
    // in both directions (user call 2026-08-16: the mephit was targeted but stood outside
    // Moonbeam's circle; the dummy stood inside Shatter's untargeted). postUseActivity fires
    // after _finalizeUsage, so a placed area is already in results.templates, awaited and
    // real. Manual targeting stays the bus for everything without a template.
    // At dnd5e 6.0 `results.templates` is the RegionDocument[] the placement created (5.3.3
    // nested an array per placement — the flatten is kept, harmless on the flat shape, so a
    // hand-fired hook carrying the old nesting still stamps; smoke-saves §8d). Containment is
    // the platform's own test on the region document — no canvas readiness awaited here.
    const placed = emanationReach(activity, tokensInRegions((results?.templates ?? []).flat().filter(t => t?.parent)));
    // A spell that chooses its targets (CHOSEN_AREAS, 2026-09-24): the area is where the caster
    // chooses — the chosen stand in for the contents, or the demand waits on the ask.
    const choice = await areaChoiceForDemand(message, activity, placed);
    const contained = choice.contained;
    const raw = contained ?? targetsOf(message);
    // THE DEAD-TARGET GATE (v1.19.0 — the user call recorded in the corner list above). The
    // filter runs on the RESOLVED set only; raw emptiness keeps its meaning (a bare template
    // cast still stamps a WAITING demand below). Placed BEFORE the setFlag so an all-dead
    // cast starves everything downstream by construction: no demand, no auto-roll, and no
    // v1.18.0 caster damage offer — the offer block never runs.
    // Careful Spell's protected creatures leave the list here; Heightened's mark joins the demand
    // below (the metamagic pass, Stage 2). Read off the card's birth flag against the creatures
    // the save reaches — the snapshot for a targeted cast, the area for a placed one.
    // The chosen area's own ask holds the demand the same way — and reads Heightened's pick itself.
    const metamagic = choice.hold ? { protectedUuids: new Set(), heightened: null, hold: true, pendingAsk: false }
      : await metamagicForDemand(message, activity, contained ?? raw);
    // A metamagic ask still open (the area's creatures to be ticked) holds the demand EMPTY, the
    // clockless wait a not-yet-placed area already takes; the answer fills it (metamagic.js).
    const targets = metamagic.hold ? [] : raw.filter(saveDemandable).filter(t => !metamagic.protectedUuids.has(t.uuid));
    if ( raw.length && !targets.length && !metamagic.protectedUuids.size && !metamagic.hold ) return; // every target is dead — fully native cast
    // A TEMPLATE-SHAPED activity's targetless cast stamps a WAITING demand (v1.12.0,
    // finding ③ — the natural Web flow is cast bare, then place: the old bail meant
    // adoption had no customer and the area produced no saves at all). The demand stamps
    // with zero targets and NO deadline; adoption fills it when the template lands and
    // arms the clock on the first arrivals (armAskTimer no-ops without a deadline, so
    // nothing buzzes an empty wait). A targetless cast with no template shape anywhere
    // in its data still stays native — no area is ever coming.
    const templateShaped = !!activity.target?.template?.type;
    if ( !targets.length && !templateShaped ) return; // targetless, no area coming — the humans have it
    // A self-aimed save activity's snapshot is incidental UI targeting (the cast slice's
    // lesson). A BLANK affects is allowed on purpose, unlike the cast slice: hand-authored
    // statblock abilities often carry no affects data, and eating their saves in silence
    // would be a false negative the table can't see. The risk the cast slice gated against
    // (double-applying a self-buff) does not exist here — there is no second applier.
    if ( !contained && ((activity.target?.affects?.type ?? null) === "self") ) return;
    const dc = activity.save?.dc?.value;
    if ( !(dc > 0) ) return; // no DC prepared — nothing to judge against (pre-2024 data)
    const abilities = [...(activity.save?.ability ?? [])];
    if ( !abilities.length ) return;

    // The effect names by outcome, resolved NOW while the item surely exists — the popup's
    // stakes line and the LR unwind both read these without needing the live document.
    // 6.0: the activity's list holds PROFILES whose effects resolve asynchronously (lookup.js).
    const entries = (await applicableProfiles(activity)).map(({ profile, effect }) => ({ onSave: profile.onSave, effect }));
    // An EMANATION spell's effect (Spirit Guardians' Half Speed) is the area's STANDING effect,
    // kept by the region while a creature stands inside — the verdict never applies it, and the
    // dialog never promises it (user walk, 2026-09-03: two Half Speeds, two lifecycles).
    const emanation = !!emanationRowFor(activity);
    const effectNames = emanation ? { fail: [], always: [] } : {
      fail: entries.filter(e => !e.onSave).map(e => e.effect.name),
      always: entries.filter(e => e.onSave).map(e => e.effect.name)
    };

    // ⚠ `onSave: "full"` marks damage the save does NOT modulate — situational rider
    // damage stored on the save activity (Web's burn clause: 2d4 fire for starting a turn
    // in burning webs, nested there in the system's own PHB data). It is not the save's
    // consequence, so the demand carries no damage dimension at all: no auto-roll, no
    // per-verdict application (finding ③, 2026-08-17 — Web auto-rolled its burn at the
    // stamp and applied 8 to a timer-failed target; RAW deals that only when the webs
    // burn). The card text's own damage enricher stays clickable and lands through the
    // native tray, GM-judged — exactly what situational damage needs.
    const onSave = activity.damage?.onSave ?? "half";
    const saveModulated = !!activity.damage?.parts?.length && (onSave !== "full");

    // Walk-5 (y): Interpose is POST-VERDICT and success-only — the 2024 text conditions the
    // Reaction on succeeding ("…if you succeed on the saving throw and are holding a
    // Shield"), so NO choice stamps with the demand; saveChoiceSpec opens it when a SAVED
    // verdict lands. Finding (f)'s pre-roll gamble is overturned by the walk-5 ruling.
    const window = Math.max(0, Number(setting(S.saveTimer)) || 0);
    const awaiting = !targets.length; // template-shaped, area not placed yet (the gate above)
    // ⚠ THE EMPTY INSTANT (user ruling 2026-08-28): an instantaneous area that is PLACED and
    // contains nobody is already spent — the spell went off, nobody owes a save, and no more
    // area is ever coming. The demand stamps DONE so the elect's convergent floor sweeps the
    // template exactly as it sweeps a resolved one (no new deletion path, no permission edge:
    // this client may be a player). A clockless wait belongs only to an area that does not
    // exist yet (the bare Web cast — `contained` null, not empty). Duration areas are
    // untouched: placed-and-empty Web keeps its wait, its area persists by design.
    // ⚠ The ITEM's duration for a spell, the ACTIVITY's for a feature (2026-09-10, the user's
    // report: the Adult Green Dragon's Poison Breath and Noxious Miasma "don't clean up after
    // themselves"). A monster's feature is a `feat` item with NO system.duration, so its demand
    // stamped null, and the sweep (areas.js) read null as a duration area waiting on a
    // concentration that never existed — every breath weapon's cone stood forever, and a
    // breath at nobody left a pending card with zero targets instead of an empty instant.
    // A spell keeps the item's word: dnd5e's activity duration on a spell is not the spell's
    // (Shield's utility activity reads "inst" under a 1-round spell).
    const durationUnits = activity.item?.system?.duration?.units ?? activity.duration?.units ?? null;
    // …and a LISTED spent area (the fourth bucket, 2026-09-10) is an instant for this purpose too.
    const instantArea = (durationUnits === "inst") || spentAreaListed(activity.item?.name);
    const emptyInstant = awaiting && !!contained && instantArea && !metamagic.hold;
    // The flag through its one constructor (decide/demand.js, Stage 2 — emanations.js stamps the
    // same shape for its trigger card); the field order is the stamp's own.
    await message.setFlag(MODULE_ID, "saves", saveDemandData({
      status: emptyInstant ? "done" : "pending",
      stat: statContext(activity.actor?.uuid ?? null), // the data-plane stamp — the caster forced this
      abilities, dc,
      damageOnSave: onSave,
      hasDamage: saveModulated,
      effectNames,
      // WHAT THE SAVE IS AGAINST (2026-09-05, the save gate's effect facet): a spell's demand,
      // and the statuses its failed-save effects impose — Aura of Purity and Circle of Power read
      // these off the pending demand when the roller's dialog opens.
      demand: { spell: (activity.item?.type === "spell") || (activity.item?.system?.properties?.has?.("mgc") ?? false),
        statuses: [...new Set(entries.filter(e => !e.onSave).flatMap(e => [...(e.effect?.statuses ?? [])]))],
        // Heightened Spell's mark (2026-09-09): the one target whose gate opens at Disadvantage.
        ...(metamagic.heightened ? { heightened: metamagic.heightened } : {}) },
      effectsHandled: emanation ? "emanation" : null,
      activityUuid: activity.uuid,
      // The dnd5e area type (cube, sphere, …) — adoption's shape gate for a TOOLBAR-drawn
      // template, which carries no origin flag to match by (the v1.12.0 walk's finding ①).
      templateType: activity.target?.template?.type ?? null,
      templated: !!contained,
      awaitingTemplate: awaiting && !emptyInstant,
      durationUnits,
      item: { name: activity.item?.name ?? "the effect", img: activity.item?.img ?? null },
      casterName: activity.actor?.name ?? null,
      // A waiting demand carries its window but NO deadline — the clock starts when the
      // area delivers its first targets (the adoption write), not while nobody can roll.
      window: (window && !emptyInstant) ? window : 0,
      deadline: (window && !emptyInstant && !awaiting) ? Date.now() + (window * 1000) : null,
      // Per-target state is an ARRAY with uuid fields — never a uuid-keyed map (the dotted
      // key expansion ground truth).
      targets: targets.map(t => saveTargetEntry(t.uuid, t.name))
    }));

    // ⑯'s companion: with the card's Damage button hidden, the machine rolls the spell's
    // damage itself the moment the demand stamps — the attack path's symmetry (1a rolls on
    // hit). Chained to the card so upcast scaling and damageOnSave ride the native plumbing;
    // per-target independence already handles a roll arriving before any verdict.
    // Save-modulated damage only — rider damage (onSave "full") never rolls here. An empty
    // instant rolls nothing: there is no one to apply to and the card is already done.
    if ( saveModulated && !emptyInstant ) {
      // The caster asked for their own dice back, exactly as the attacker did (FLOW item 3;
      // the v1.18.0 walk's only finding was that the popup never reached this path). It costs
      // nothing extra to offer here for one reason: THIS HOOK ALREADY RUNS ON THE CASTING
      // CLIENT — postUseActivity fires wherever `use()` was called — which is the same
      // locality that let the attack popup skip the elect, canAnswerFor and the wire. Nothing
      // about the popup crosses a client boundary, so nothing about it needs one.
      //
      // ⚠ NOT awaited, and that is the point: the stamp must not sit inside a fifteen-second
      // window. Everything after this line is done, the demand is already written, and the
      // targets' own save asks arm off the FLAG — not off this call returning. The two windows
      // run concurrently on purpose; a caster thinking about dice must never hold up the
      // table's saves.
      // ⚠ NOT while the caster is being asked who the area spares (the metamagic ask, 2026-09-09 —
      // user: "can everything, including the animation, be paused so the person has time to
      // select their choices?"): the dice, their popup, its clock and their animation all wait
      // for the answer. The deferral rides the card; the ask's answer (metamagic.js) says when.
      // …and not while the ask is still TO COME: a bare cast's area lands later, and its ask with it.
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

// The deferred dice, once the metamagic ask is answered — on the client that answered it (the
// same locality as the stamp: the caster's, or the elect's at the clock). One runner, by
// construction: the hook is local, and the deferral flag is cleared before the dice roll.
Hooks.on("battleflow.metamagicAskAnswered", async message => {
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
 * AN EMANATION'S REACH AT THE CAST (user, 2026-09-03: "when I cast it as a cleric, it affects all
 * neutral/allies, should just be enemies"). A placed area asks everyone standing in it — right
 * for a Fireball, wrong for a spell whose text says "you can designate creatures to be
 * unaffected": the default designation is the row's reach (DESIGN §5 *Emanations* — harmful
 * reaches enemies, by disposition), and the caster's own token never owes its own spell a save.
 * Only a LISTED emanation row filters; every other area keeps the old answer. Null in, null out.
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
  const row = emanationRowFor(activity);
  if ( !row || !Array.isArray(contained) ) return contained;
  const caster = activity.actor ?? null;
  const casterTok = caster?.token ?? caster?.getActiveTokens?.(true, true)?.[0] ?? null;
  const casterDisposition = casterTok?.disposition ?? CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  return contained.filter(c => (c.tokenId !== casterTok?.id) && (c.uuid !== caster?.uuid)
    && reachAdmits(row.reach, casterDisposition, c.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL));
}
