/**
 * Battle Flow — Phase 2: saving throws, joint with Phase 3's save slice - demand, roll, verdict, consequences.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, rollerUserFor,
  drivesMomentFor, canApplyTo, whisperNoGM, canAnswerFor,
  statContext, sheetModeEffects, rollLabelFor } from "./core.js";
import { resolveUuid } from "./lookup.js";
import { saveDemandData, saveTargetEntry } from "./decide/demand.js";
import { tokensInTemplates } from "./geometry.js";
import { SAVE_FOLDS, foldedSave, foldsFrom, saveMultiplier, verdictText } from "./decide/verdict.js";
import { isDeadForSaves } from "./decide/eligible.js";
import { forceStatus, damagePartsOf, reactionSpent, rollConfigFor, spendReaction, statSourceOf } from "./shared.js";
import { popupKey, bfCard, holdBarHTML, momentBarHTML, ruleLine, reminderFieldsetHTML, TONE } from "./decide/present.js";
import { livePopups, openMomentPopup, adoptManagedPopup, DialogCarried, markDefaultButton, momentButton, scheduleBarSync, shownMoments, armAskTimer, disarmAskTimer, armDeadline, disarmDeadline, registerRelay, dramaticVerdictPause, registerDemand, demandAnsweredBy, pendingDemandsFor } from "./ui.js";
import { EFFECT_BENDS, EMANATIONS, EVASION, SAVE_BENDS, SAVE_PRESSES, tableIndex } from "./decide/registry.js";
import { reachAdmits } from "./decide/emanations.js";
import { effectRecord, joinEffectReceipt } from "./decide/receipt.js";
import { REMINDER_FLAG, effectSaveSources, modeSources, reminderRecord, saveGate, saveNoneOnSuccess, saveSources } from "./decide/reminders.js";
import { rollModeOf } from "./decide/chips.js";
import { conditionEntries, effectEntries, emanationEntries, reminderEntries } from "./settings.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { applyEffectsWithReceipt, revertEffect } from "./effect-riders.js";
// ⚠ SAFE STATICALLY, unlike auto-damage.js's own ui.js import (v1.6.1's ESM order trap): the
// entry reaches auto-damage.js at battleflow.js:90 — earlier still via polish.js -> hold.js —
// and saves.js only at :102, so this module is fully evaluated before this line is read and no
// hook registration moves. Re-checked with check-hook-order; do not promote it to dynamic
// without re-running that.
import { offerSaveDamageRoll, rollDamageForSave } from "./auto-damage.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 2 — saving throws (ARCHITECTURE.md §6), shipping WITH Phase 3's save slice: a save's
 * consequences ARE the feature, so failed-save effects and half-on-save damage ride the shared
 * appliers in this same file.
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

/* --- the stamp: the casting client writes the demand on the usage card --------------------- */

/** Stamp-time filter: an unresolvable uuid stays IN (the buzzer voids gone targets — never
 * eat a demand on a lookup miss); a dead one stays out. */
function saveDemandable(t) {
  const actor = resolveUuid(t.uuid);
  if ( !(actor instanceof Actor) ) return true;
  return !isDeadForSaves(actor);
}

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  if ( !setting(S.saves) ) return;
  if ( activity?.type !== "save" ) return;
  const message = (results?.message instanceof ChatMessage) ? results.message : null;
  if ( !message ) return; // used with create: false — no card, no bus, nothing to run
  void stampSaveDemand(activity, message, results);
});

async function stampSaveDemand(activity, message, results) {
  try {
    if ( message.getFlag(MODULE_ID, "saves") ) return; // never re-stamp
    // ⚠ A template spell's target set is what the TEMPLATE contains, not what was clicked —
    // in both directions (user call 2026-08-16: the mephit was targeted but stood outside
    // Moonbeam's circle; the dummy stood inside Shatter's untargeted). postUseActivity fires
    // after _finalizeUsage, so a placed template is already in results.templates, awaited
    // and real. Manual targeting stays the bus for everything without a template.
    // ⚠⚠ results.templates entries are ARRAYS, not documents (5.3.3 ground truth, read from
    // source after two live misfires): #placeTemplate pushes drawPreview()'s resolution,
    // which is the raw createEmbeddedDocuments result — an array per placement. Unflattened,
    // the parent filter dropped every live placement and the stamp silently fell back to the
    // manual snapshot (the Shatter/Gren strand, 2026-08-17) — the adoption floor then had to
    // drag the demand back to the area, stranding the snapshot targets' popups.
    // Containment reads the drawn shape when one exists and falls back to document
    // geometry otherwise (templateShape) — never await canvas readiness here: an await
    // against template.object has been observed to never come back on the headless elect,
    // and the fallback makes it unnecessary.
    const contained = emanationReach(activity, tokensInTemplates((results?.templates ?? []).flat().filter(t => t?.parent)));
    const raw = contained ?? (message.getFlag("dnd5e", "targets") ?? []);
    // THE DEAD-TARGET GATE (v1.19.0 — the user call recorded in the corner list above). The
    // filter runs on the RESOLVED set only; raw emptiness keeps its meaning (a bare template
    // cast still stamps a WAITING demand below). Placed BEFORE the setFlag so an all-dead
    // cast starves everything downstream by construction: no demand, no auto-roll, and no
    // v1.18.0 caster damage offer — the offer block never runs.
    const targets = raw.filter(saveDemandable);
    if ( raw.length && !targets.length ) return; // every target is dead — fully native cast
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
    const applicable = new Set((activity.applicableEffects ?? []).map(e => e.id));
    const entries = (activity.effects ?? []).filter(e => e.effect && applicable.has(e.effect.id));
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
    const durationUnits = activity.item?.system?.duration?.units ?? null;
    const emptyInstant = awaiting && !!contained && (durationUnits === "inst");
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
        statuses: [...new Set(entries.filter(e => !e.onSave).flatMap(e => [...(e.effect?.statuses ?? [])]))] },
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
      if ( setting(S.playerRollDamage) ) {
        void offerSaveDamageRoll(activity, message,
          { damageOnSave: onSave, targets, awaiting });
      }
      else await rollDamageForSave(activity, message);
    }
  } catch(err) {
    console.error(`${TITLE} | Could not stamp the save demand.`, err);
  }
}

/** Every template on any scene that this activity placed — the origin flag is the tie. */
function templatesForOrigin(activityUuid) {
  const found = [];
  for ( const scene of game.scenes ) {
    for ( const t of scene.templates ) {
      if ( t.getFlag("dnd5e", "origin") === activityUuid ) found.push(t);
    }
  }
  return found;
}

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
function emanationReach(activity, contained) {
  const row = emanationRowFor(activity);
  if ( !row || !Array.isArray(contained) ) return contained;
  const caster = activity.actor ?? null;
  const casterTok = caster?.token ?? caster?.getActiveTokens?.(true, true)?.[0] ?? null;
  const casterDisposition = casterTok?.disposition ?? CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  return contained.filter(c => (c.tokenId !== casterTok?.id) && (c.uuid !== caster?.uuid)
    && reachAdmits(row.reach, casterDisposition, c.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL));
}

/** The foundry template type a demand's area will wear (cube → rect &c.) — the system's
 * own map, so the module never hardcodes the correspondence. Null when the demand predates
 * templateType (pre-v1.13.0 stamps) or the type is unmapped: no toolbar adoption, only the
 * origin-tied paths. */
function expectedTemplateT(flag) {
  if ( !flag.templateType ) return null;
  return CONFIG.DND5E?.areaTargetTypes?.[flag.templateType]?.template ?? null;
}

/**
 * A TOOLBAR-drawn template carries no dnd5e origin flag — there is nothing for
 * templatesForOrigin to ever match, so before v1.13.0 the card's own "waiting for the
 * template's area" line pointed at a placement path that could not work (the v1.12.0
 * walk's finding ①). The waiting demand may CLAIM such a template: the newest origin-less
 * template of the demand's expected shape, on the ELECT'S CURRENT SCENE only (the toolbar
 * draw happens where the table is looking; and _stats.createdTime has been observed
 * unreadable on this box, so the created-after gate cannot carry the fossil bound alone —
 * the scene restriction is the second wall). The claim writes the origin flag onto the
 * template, so from that moment every downstream mechanism — moves, re-placement, the
 * spent sweep — treats it exactly like a dialog placement. Elect write, like every
 * world-visible mutation.
 */
async function claimBareTemplate(card, flag) {
  const expected = expectedTemplateT(flag);
  if ( !expected ) return null;
  const here = canvas?.scene;
  if ( !here ) return null;
  const candidates = [];
  for ( const t of here.templates ) {
    if ( t.getFlag("dnd5e", "origin") ) continue;
    if ( t.t !== expected ) continue;
    const born = t._stats?.createdTime ?? t._source?._stats?.createdTime ?? null;
    if ( born && (born < card.timestamp) ) continue; // predates the cast — decoration
    candidates.push({ t, born: born ?? 0 });
  }
  if ( !candidates.length ) return null;
  candidates.sort((a, b) => a.born - b.born);
  const tpl = candidates.at(-1).t;
  await tpl.setFlag("dnd5e", "origin", flag.activityUuid);
  return tpl;
}

/** Same-client latch: one containment refresh in flight per card. */
const templateRefreshes = new Set();

/**
 * Re-derive a live demand's target set from its templates — the area is the authority, in
 * both directions (2026-08-16: the mephit was targeted but outside Moonbeam; the dummy
 * stood inside Shatter untargeted). Done entries keep their verdicts (history never
 * re-rolls); pending entries outside drop; new arrivals join fresh. The elect owns the
 * write. Idempotent: no template ⇒ no-op; an unchanged set writes nothing.
 *
 * ⚠ Driven from the RENDER hook as the reliability floor, with the template CRUD hooks as
 * fast-paths. The original placement's create event fires BEFORE the stamp exists and finds
 * nothing, so the render floor is the only thing that catches it — measured 2026-08-16:
 * createMeasuredTemplate simply never dispatched on the
 * headless elect for an embedded create (a listener registered around the create counted
 * zero fires), so anything that MUST happen cannot ride those hooks alone. And NO awaiting
 * canvas readiness anywhere in here — a shape-wait against template.object never came back
 * on that same elect; templateShape's document-geometry fallback carries containment.
 */
async function refreshDemandFromTemplates(card) {
  if ( !setting(S.saves) ) return;
  if ( !drivesMomentFor(card.getFlag(MODULE_ID, "saves")?.sourceUuid ?? null) ) return;
  if ( templateRefreshes.has(card.id) ) return;
  templateRefreshes.add(card.id);
  try {
    const flag = card.getFlag(MODULE_ID, "saves");
    if ( flag?.status !== "pending" ) return;
    // An emanation's TRIGGERED demand (emanations.js, 2026-09-03) names ONE creature and shares
    // the cast's activity — the area is not its authority and never re-derives it.
    if ( flag.pinnedTargets ) return;
    // A WAITING demand (zero targets — the v1.12.0 targetless template stamp) is a
    // customer too: it exists precisely so the area can deliver its targets later.
    const wasWaiting = !(flag.targets ?? []).length;
    if ( !wasWaiting && !(flag.targets ?? []).some(t => !t.done) ) return;
    // ONE customer per area among WAITING casts: the newest same-activity waiting demand
    // owns any arriving template (the fossil rule, standing item 17, applied to waiting —
    // the v1.12.0 walk left FOUR bare Web casts waiting, and without this gate one placed
    // cube fills all four: four popup sets for one area. Older waiting casts stay waiting
    // forever, which is already item 5's deliberate shape).
    if ( wasWaiting ) {
      // ⚠ ANY newer same-activity cast disarms this one — not just a newer cast that is
      // still WAITING. The narrower test (v1.13.0) held only until the newer demand
      // adopted: the claim stamps `origin = activityUuid` onto the toolbar template, the
      // newer card then has targets and stops counting as "newer waiting", and this older
      // card walks straight into templatesForOrigin — which now MATCHES, because the
      // origin it was just stamped with is shared by every cast of that activity. Both
      // demands then own one area and both apply damage (smoke-saves §10d2/§10f, caught
      // 2026-08-19: the victim died at 0/11 off one rect). Same fossil rule as the sweep's
      // wall, stated the same way: the NEWEST cast owns the area, period.
      const newer = game.messages.contents.some(m => {
        if ( (m.id === card.id) || (m.timestamp <= card.timestamp) ) return false;
        const f = m.getFlag(MODULE_ID, "saves");
        return (f?.activityUuid === flag.activityUuid) && !f.pinnedTargets;   // a triggered demand is not a cast
      });
      if ( newer ) return;
    }
    let templates = templatesForOrigin(flag.activityUuid);
    // Nothing origin-tied: a waiting demand may claim a toolbar-drawn (origin-less)
    // template of its expected shape — the claim stamps the origin, so this branch runs
    // at most once per template ever.
    if ( !templates.length && wasWaiting ) {
      const claimed = await claimBareTemplate(card, flag);
      if ( claimed ) templates = [claimed];
    }
    if ( !templates.length ) return;
    const activity = flag.activityUuid ? resolveUuid(flag.activityUuid) : null;
    const contained = emanationReach(activity, tokensInTemplates(templates)) ?? [];
    // ⚠ THROUGH THE SERIALIZER (core.js), and the derivation moved INSIDE it. Everything
    // above is async — the template lookup and the bare-template claim both await — so the
    // `flag` read at the top of this function is stale by the time the write lands. Building
    // the new target list from that stale read is a lost update with teeth: a save answer
    // folding in during the await window (rollSaveAnswer's own write) would be rebuilt away,
    // and the target would be re-demanded after it had already rolled. The mutate is
    // synchronous, so only the derivation moves; the awaits stay out here.
    await queueFlagWrite(card, "saves", current => {
      const prev = current.targets ?? [];
      const done = prev.filter(t => t.done);
      const keep = prev.filter(t => !t.done && contained.some(c => c.uuid === t.uuid));
      const fresh = contained.filter(c => !prev.some(t => t.uuid === c.uuid))
        // The dead-target gate reaches adoption too (v1.19.0): a corpse standing in the placed
        // area never joins the demand — same filter, same predicate, same user call.
        .filter(saveDemandable)
        .map(c => saveTargetEntry(c.uuid, c.name));
      // No choice stamps at adoption either (walk-5 (y)): Interpose opens off the VERDICT, so
      // a late-adopted shield-bearer meets it exactly like a snapshot target — when they save.
      const next = [...done, ...keep, ...fresh];
      if ( !next.length ) return false; // waiting keeps waiting; a populated one never strands
      // ⚠ `return false` is LOOP PROTECTION, not tidiness: this refresh is driven from the
      // render hook as its reliability floor, so an unconditional write would be
      // write → render → write without end. Same identity test as before the move —
      // already templated, same uuids, same order, same length.
      const same = current.templated && (next.length === prev.length)
        && prev.every((t, i) => next[i]?.uuid === t.uuid);
      if ( same ) return false;
      // Re-read from `current`, not the outer `wasWaiting`: if targets arrived while the
      // awaits above ran, this demand is no longer waiting and must not restart its clock.
      const stillWaiting = !prev.length;
      current.templated = true;
      current.targets = next;
      // The first arrivals start the clock a waiting stamp deliberately withheld: deadline
      // from NOW (the elect's clock — the skew note in the file banner already covers it),
      // so the table gets the full window from the moment there is somebody to roll.
      if ( stillWaiting ) {
        current.awaitingTemplate = false;
        if ( current.window && !current.deadline ) current.deadline = Date.now() + (current.window * 1000);
      }
    });
  } catch(err) {
    console.error(`${TITLE} | Template containment refresh failed.`, err);
  } finally {
    templateRefreshes.delete(card.id);
  }
}

/** The CRUD fast-path: when the hooks DO fire, refresh the newest live demand at once.
 * An origin-LESS template (the toolbar draw, finding ①) is offered to the newest WAITING
 * demand expecting its shape — the refresh's claim does the actual tying. */
function refreshTemplatedDemands(templateDoc) {
  if ( !setting(S.saves) ) return;
  // Per-demand rather than per-room: the loop below already filters to live demands, and each
  // one is driven by whoever drives its caster (v1.27.2).
  const origin = templateDoc.getFlag("dnd5e", "origin");
  const live = game.messages.contents.filter(m => {
    const f = m.getFlag(MODULE_ID, "saves");
    if ( (f?.status !== "pending") || f.pinnedTargets ) return false;
    if ( origin ) return (f.activityUuid === origin)
      // Undone targets, or a WAITING demand (zero targets) whose area just arrived.
      && (!(f.targets ?? []).length || (f.targets ?? []).some(t => !t.done));
    return !(f.targets ?? []).length && (expectedTemplateT(f) === templateDoc.t);
  }).sort((a, b) => a.timestamp - b.timestamp);
  const card = live.at(-1);
  if ( card ) void refreshDemandFromTemplates(card);
}
Hooks.on("createMeasuredTemplate", doc => { refreshTemplatedDemands(doc); });
Hooks.on("updateMeasuredTemplate", doc => { refreshTemplatedDemands(doc); });

/** The sweep's same-client re-entry latch (the banner note inside cleanupSpentTemplates). */
const templateSweepsInFlight = new Set();

/**
 * An INSTANTANEOUS spell's template is spent once every verdict's consequences landed —
 * Shatter's circle has nothing left to say, so it leaves the canvas (user call 2026-08-16).
 * Duration spells (Moonbeam, Web) keep theirs: the area persists and containment keeps
 * reading it. The card keeps the spell's text either way — nothing is lost with the shape.
 *
 * ⚠ Since v1.14.0 this is a CONVERGENT FLOOR, not only a completion one-shot (the
 * v1.13.0 walk's finding ②): the one-shot at the last consequence pass demonstrably got
 * lost live — stale Fireball circles stood with every target applied — most plausibly to
 * an elect flip mid-chain (a second GM session connecting/disconnecting re-elects; probe
 * sessions did exactly that during the walk). The render/update floors now re-offer the
 * sweep for done demands, so a lost one-shot converges on the next render, whoever the
 * elect is by then. Idempotent and cheap: the origin filter usually finds nothing.
 *
 * ⚠ The NEWEST-CAST fossil wall: re-casting the same activity reuses the same
 * activityUuid, so an OLD done card's sweep would delete the CURRENT cast's area. Any
 * newer same-activity save card disarms this card's sweep forever. (The narrow blind
 * spot — a re-render landing in the ms between the new cast's template and its stamp —
 * needs a full-log re-render inside that window; accepted.)
 */
async function cleanupSpentTemplates(card, { endedConcentrationId = null } = {}) {
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag?.templated ) return;
  if ( !(flag.targets ?? []).every(t => t.done && (t.applied || (t.outcome === "gone"))) ) return;
  // An INSTANTANEOUS area is spent when its last consequence lands (v1.14.0). A DURATION
  // area is spent when the CONCENTRATION that sustains it is gone (the 2026-08-18 session's
  // finding ①: Faerie Fire's region outlived the spell — the native end-of-concentration
  // cascade owns that deletion but demonstrably lost it, the same lost-one-shot class as
  // finding ② was, so the same convergent floor answers it). The usage card carries its own
  // concentration effect id (system.concentration, stamped by the system at cast); when the
  // caster no longer wears that effect, the spell is over and the area goes — dependents
  // (the marked targets' chips) correctly cascading with it. A non-concentration duration
  // area stays the GM's to clear (leftover, recorded); an unresolvable caster leaves the
  // area standing rather than guessing.
  if ( flag.durationUnits !== "inst" ) {
    const concId = card.system?.concentration;
    if ( !concId ) return;
    // ⚠ The hook's hint, not a collection read, decides the just-ended case: `deleteActiveEffect`
    // can fire while the effect is still in the parent's collection, and reading it there raced
    // the sweep into never running (2026-08-19, smoke-saves §14c). The trigger KNOWS which
    // concentration ended; trust it, and only fall back to the live read for the floor's own
    // later re-offers (render/update), where no hint exists and the collection is settled.
    if ( endedConcentrationId !== concId ) {
      const caster = card.getAssociatedActor?.();
      if ( !(caster instanceof Actor) ) return;
      if ( caster.effects.get(concId) ) return; // still concentrating — the area is alive
    }
  }
  const superseded = game.messages.contents.some(m => {
    if ( (m.id === card.id) || (m.timestamp <= card.timestamp) ) return false;
    const f = m.getFlag(MODULE_ID, "saves");
    return (f?.activityUuid === flag.activityUuid) && !f.pinnedTargets;   // a triggered demand is not a re-cast
  });
  if ( superseded ) return;
  // ⚠ ONE SWEEP IN FLIGHT PER CARD (2026-08-28, the live Fireball's three red banners). The
  // floor is convergent on purpose — consequence pass, update and render all offer it in the
  // same beat — and the try/catch below does tolerate the losers' misses. But v14 shims every
  // template onto a backing Region, and a concurrent second delete surfaces "Region does not
  // exist" as a UI NOTIFICATION the catch never sees — one banner per extra floor. The latch
  // makes the overlap not happen; a floor arriving after the winner finishes still runs and
  // correctly finds nothing.
  if ( templateSweepsInFlight.has(card.id) ) return;
  templateSweepsInFlight.add(card.id);
  try {
    for ( const scene of game.scenes ) {
      const spent = scene.templates.filter(t => t.getFlag("dnd5e", "origin") === flag.activityUuid);
      // Tolerate the race against the native cascade deleting the same documents — whichever
      // cleanup wins, the other's miss must not throw the floor off its next offer.
      try {
        if ( spent.length ) await scene.deleteEmbeddedDocuments("MeasuredTemplate", spent.map(t => t.id));
      } catch(err) { /* already gone — the cascade or the other elect twin got there */ }
    }
  } finally {
    templateSweepsInFlight.delete(card.id);
  }
}

/* The trigger for the duration half of the floor above: the moment a concentration effect
 * is deleted, the elect re-offers the sweep to every templated demand that cast rode —
 * matched by the id the system stamped on the usage card. The render/update floors remain
 * the convergent backstop (a lost trigger lands on the next render, whoever the elect is
 * by then); this hook just makes the common case immediate. */
Hooks.on("deleteActiveEffect", effect => {
  if ( !(effect.parent instanceof Actor) ) return;
  for ( const m of game.messages.contents ) {
    if ( m.system?.concentration !== effect.id ) continue;
    if ( !drivesMomentFor(m.getFlag(MODULE_ID, "saves")?.sourceUuid ?? null) ) continue;
    if ( m.getFlag(MODULE_ID, "saves")?.templated ) {
      void cleanupSpentTemplates(m, { endedConcentrationId: effect.id });
    }
  }
});

/* --- the roll: whoever owns the decision presses it ----------------------------------------- */

/** Same-client re-entry latch (render resume + the buzzer can volunteer in one tick). */
const saveRollsInFlight = new Set();

/** The message data every answer to a demand carries — chained to the card, and the exact channel. */
function saveAnswerData(card, uuid, timedOut) {
  return { data: { flags: {
    // Chained to the demand card so the system's registry ties the whole moment together — a
    // programmatic roll must pass this explicitly (no DOM click to inherit it from).
    dnd5e: { originatingMessage: card.id },
    // The exact answer channel: WHICH card, WHICH target. Immune to the getSpeaker
    // oldest-token trap by construction — the fold never has to resolve this roll's actor.
    [MODULE_ID]: { respondsTo: card.id, saveFor: uuid, ...(timedOut ? { timedOut: true } : {}) }
  } } };
}

/** Is this target still owed an answer — pending, unanswered, and no roll already on the log? */
function saveStillOwed(card, uuid) {
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  if ( !entry || entry.done || (flag.status !== "pending") ) return null;
  // An answer that already landed wins even though the entry still reads pending — the fold
  // is the elect's job and may not have caught up. Whole-log by flag, never a tail.
  if ( game.messages.some(m => (m.getFlag(MODULE_ID, "respondsTo") === card.id)
    && (m.getFlag(MODULE_ID, "saveFor") === uuid)) ) return null;
  return { flag, entry };
}

/**
 * Roll one target's save STRAIGHT, answering the demand: the buzzer's press, data-driven, no
 * dialog, sheet-borne modifiers still applying themselves. The stored DC rides as `target` so
 * the system's own success test marks the card and can never disagree with the fold. (The
 * human's press goes through `openSaveDialog` below — the system's own dialog, since option E.)
 */
async function rollSaveAnswer(card, uuid, { mode = null, bonus = null, timedOut = false } = {}) {
  const key = `${card.id}|${uuid}`;
  if ( saveRollsInFlight.has(key) ) return;
  saveRollsInFlight.add(key);
  try {
    const owed = saveStillOwed(card, uuid);
    if ( !owed ) return;
    const actor = await fromUuid(uuid);
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    await actor.rollSavingThrow(
      { ability: owed.flag.abilities[0], target: owed.flag.dc, ...rollConfigFor(mode, bonus) },
      { configure: false },
      saveAnswerData(card, uuid, timedOut)
    );
  } catch(err) {
    console.error(`${TITLE} | Save roll failed — roll it from the sheet.`, err);
  } finally {
    saveRollsInFlight.delete(key);
  }
}

/* ---------------------------------------------------------------------------------------------
 * THE DEMAND OPENS THE SYSTEM'S OWN SAVING THROW DIALOG (user ruling 2026-09-02 — option E of
 * *The Save Gate*: "the attack pattern"; the house save popup retires). One surface for every
 * save, forced or from the sheet: dnd5e's dialog, its own situational bonus and roll mode, its
 * own three buttons — and Battle Flow adds two fieldsets. THE DEMAND (who is rolling, the DC,
 * what a success buys, the timer bar) sits above the dialog's CONFIGURATION; the gate's section
 * — BEFORE YOU ROLL, the save table's bends under one header line, folded to the header like the
 * attack gate's — sits below it, and the highlighted default is the net. A save the rules FAIL
 * before any die (Paralyzed, Stunned, Unconscious, Petrified on Strength or Dexterity) grows a
 * fourth button, **Fails**, as the default: no dice, the failure recorded on the card with the
 * condition as the number's replacement. The human still presses (R1) — option C, the module
 * resolving with no press, was ruled out.
 *
 * Cascading, no queue (user, 2026-09-02): every pending demand for an actor opens its dialog,
 * stepped down the staircase; the GM's old "queue of saves" habit is gone with the popup.
 *
 * The dialog is enrolled in `livePopups` under the popup key the card row already uses, so the
 * update hook that closes an answered popup closes this one exactly as it did the house popup,
 * and the card's Roll button fronts it. The roll it produces is the same answer the popup
 * produced — the demand's chain and channel ride the message data — so the fold, the verdict,
 * the consequences and the receipts cannot tell the two apart. Dismissing (the X) is not an
 * answer: the dialog resolves to no roll, the row's button recalls it, the buzzer rolls.
 * ------------------------------------------------------------------------------------------- */

/** Dialogs on their way up — between the call and the render that enrols them in `livePopups`. */
const saveDialogsOpening = new Set();

/**
 * Open the system's Saving Throw dialog for one demanded target — the human's press (the
 * buzzer's straight roll is `rollSaveAnswer`). Recall fronts a live one. The demand rides
 * `dialog.options` as a DialogCarried so the render hook below meets the same object the
 * Fails button writes to; the roll's own flags ride the message data as every answer does.
 */
async function openSaveDialog(card, uuid) {
  const key = popupKey(card.id, `save:${uuid}`);
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }
  if ( saveDialogsOpening.has(key) ) return;
  saveDialogsOpening.add(key);
  try {
    const owed = saveStillOwed(card, uuid);
    if ( !owed ) return;
    const actor = await fromUuid(uuid);
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    const demand = new DialogCarried({ cardId: card.id, uuid, failed: null });
    const rolls = await actor.rollSavingThrow(
      { ability: owed.flag.abilities[0], target: owed.flag.dc },
      { configure: true, options: { bfSaveDemand: demand } },
      saveAnswerData(card, uuid, false)
    );
    // Fails pressed: the dialog closed with no roll and the demand carries the sources that
    // failed it. The fold is the same fold — the number is the condition.
    if ( !rolls?.length && demand.failed ) await foldSaveAutoFail(card, uuid, { sources: demand.failed });
  } catch(err) {
    console.error(`${TITLE} | Save dialog failed — roll it from the sheet.`, err);
  } finally {
    saveDialogsOpening.delete(key);
  }
}

/**
 * THE SAVE GATE'S JUDGE: the roller's statuses against the save table for this ability, and
 * the effects on the roller's own sheet that set the platform's mode for it (user, 2026-09-04:
 * "see the calculus for why there is advantage/dis, just like attacks" — The Duskheart's
 * `+1` on Wisdom saves opened the dialog at `1d20adv` with no word about who), netted as the
 * attack gate nets, or `fails` when a source says the save cannot succeed. Null when the
 * Reminder Sources list carries neither `condition` nor `effect` — the list is the switch, for
 * saves as for attacks; WHICH conditions is the Condition Sources list, and the mode reader
 * rides the `effect` kind because that is what it reads. A DialogCarried, so the pre-roll
 * hook, the rendered dialog and the record all hold one object.
 * @param {Actor} actor
 * @param {string} ability
 */
function judgeSave(actor, ability) {
  const on = new Set(reminderEntries().map(e => e.kind));
  if ( !on.has("condition") && !on.has("effect") ) return null;
  const sources = [];
  if ( on.has("condition") ) {
    sources.push(...saveSources({ statuses: actor.statuses ?? [], ability,
      enabled: conditionEntries().map(e => e.kind), table: SAVE_BENDS, name: actor.name }));
  }
  if ( on.has("effect") ) {
    const roll = { kind: "save", ability };
    sources.push(...modeSources({ effects: sheetModeEffects(actor), roll, rollLabel: rollLabelFor(roll), name: actor.name }));
    // The effect table's `saves` facet (Aura of Purity, Circle of Power — 2026-09-05), read
    // against the DEMAND this roller is answering; a bare sheet roll has none and is listed.
    sources.push(...effectSaveSources({ effects: actor.effects.filter(e => !e.disabled).map(e => ({ id: e.id, name: e.name })),
      enabled: effectEntries().map(e => e.kind), table: EFFECT_BENDS, demand: pendingDemandFor(actor)?.demand ?? null, name: actor.name }));
  }
  return new DialogCarried({ ...saveGate(sources), actorUuid: actor.uuid, ability, failed: false });
}

/** The demand this actor is mid-answer on, if any — the newest pending card naming it undone. */
function pendingDemandFor(actor) {
  return pendingDemandsFor(actor.uuid, { flagKey: "saves" }).at(-1)?.card.getFlag(MODULE_ID, "saves") ?? null;
}

// THE GATE, on every saving throw that opens a dialog — forced by a demand or rolled from the
// sheet (option E folds the old option D in: one surface for every save). Templated like the
// attack hook (dnd5e.preRoll<Name>V2 — pinned in check-hook-dispatch). A judgement with a
// source forces the dialog open — a shift-clicked save still meets it — and sets the default.
Hooks.on("dnd5e.preRollSavingThrowV2", (config, dialog, message) => {
  try {
    if ( dialog?.configure === false ) return;       // no dialog, no gate
    const actor = config?.subject;
    if ( !(actor instanceof Actor) ) return;
    const gate = judgeSave(actor, config.ability);
    if ( !gate ) return;
    dialog.options ??= {};
    dialog.options.bfSaveGate = gate;
    config.bfSaveGate = gate;
    if ( !gate.sources.length ) return;
    dialog.configure = true;
    // Fails takes the focus itself below; the dialog's own default stays Normal behind it.
    dialog.options.defaultButton = gate.autoFail ? "normal" : gate.net;
  } catch(err) {
    console.error(`${TITLE} | Save gate failed — rolling natively.`, err);
  }
});

/** The demand's fieldset — who, the DC, the stakes, the bar — above the dialog's CONFIGURATION. */
function drawSaveDemand(app, element, demand) {
  const card = game.messages.get(demand.cardId);
  if ( !card ) return;
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === demand.uuid);
  // A question withdrawn between the ask and this render — the entry dropped by a template's
  // adoption (the Shatter strand), or answered elsewhere — closes here rather than standing:
  // the update sweep that closes answered popups runs on the WRITE, and this dialog was not
  // yet enrolled when that write landed (smoke-saves §8a2, 2026-09-02).
  if ( !entry || entry.done || (flag.status !== "pending") ) { void app.close(); return; }
  adoptManagedPopup(popupKey(card.id, `save:${demand.uuid}`), card, app);
  if ( element.querySelector("[data-bf-save-demand]") ) return;
  const actor = resolveUuid(demand.uuid);
  const ability = flag.abilities[0];
  const abilityLabel = CONFIG.DND5E.abilities[ability]?.label ?? ability;
  const stakes = [];
  if ( flag.hasDamage ) stakes.push(
    (flag.damageOnSave === "half") ? "A successful save <strong>halves</strong> the damage."
      : (flag.damageOnSave === "none") ? "A successful save avoids the damage <strong>entirely</strong>."
      : "The damage lands either way.");
  if ( flag.effectNames?.fail?.length ) stakes.push(
    `A failure also applies: <strong>${flag.effectNames.fail.join(", ")}</strong>.`);
  if ( flag.effectNames?.always?.length ) stakes.push(
    `Applies either way: <strong>${flag.effectNames.always.join(", ")}</strong>.`);
  const host = document.createElement("div");
  host.innerHTML = `<fieldset data-bf-save-demand><legend>The demand</legend>${bfCard({
    // WHO is rolling leads, portrait included — the creature is the load-bearing fact (user
    // call 2026-08-16); the spell is subtitle work.
    img: actor?.img ?? flag.item?.img ?? null,
    eyebrow: "Saving throw",
    title: `${entry.name}: ${abilityLabel} save, DC ${flag.dc}`,
    subtitle: `${flag.item?.name ?? "An effect"}${flag.casterName ? `, from ${flag.casterName}` : ""}`,
    lines: stakes, tone: "pending"
  })}${holdBarHTML(flag, "to roll")}</fieldset>`;
  const fieldset = host.firstElementChild;
  const configuration = element.querySelector('[data-application-part="configuration"]');
  const formulas = element.querySelector('[data-application-part="formulas"]');
  if ( configuration ) configuration.insertAdjacentElement("beforebegin", fieldset);
  else if ( formulas ) formulas.insertAdjacentElement("afterend", fieldset);
  else element.querySelector("form")?.prepend(fieldset);
  scheduleBarSync(element);
}

/**
 * The gate's section in the dialog — the attack gate's fieldset, on the save hook — and the
 * fourth button when the save cannot succeed. Idempotent across the dialog's own re-renders
 * (only its formulas part is replaced; the section and the button are siblings that persist).
 */
function drawSaveGate(app, element, gate, demand) {
  if ( !gate?.sources?.length ) return;
  if ( !element.querySelector("[data-bf-reminder]") ) {
    const host = document.createElement("div");
    host.innerHTML = reminderFieldsetHTML(gate.view, { open: false });
    const fieldset = host.firstElementChild;
    const configuration = element.querySelector('[data-application-part="configuration"]');
    const buttons = element.querySelector('[data-application-part="buttons"]');
    if ( configuration ) configuration.insertAdjacentElement("afterend", fieldset);
    else if ( buttons ) buttons.insertAdjacentElement("beforebegin", fieldset);
    else element.querySelector("form")?.appendChild(fieldset);
  }
  const modeButtonsEl = [...element.querySelectorAll('[data-application-part="buttons"] button[data-action]')];
  if ( gate.autoFail && !element.querySelector("[data-bf-fails]") ) {
    const sibling = modeButtonsEl.find(b => b.dataset.action !== "bf-fails");
    if ( sibling ) {
      const fails = document.createElement("button");
      fails.type = "button";
      fails.className = sibling.className;
      fails.dataset.action = "bf-fails";
      fails.setAttribute("data-bf-fails", "");
      fails.innerHTML = `<i class="fa-solid fa-xmark" inert></i> Fails`;
      fails.style.cssText = `border-color:${TONE.bad};`;
      fails.addEventListener("click", () => {
        try {
          gate.failed = true;
          if ( demand ) demand.failed = gate.sources;
          else postSheetAutoFail(gate);
        } finally {
          void app.close();
        }
      });
      sibling.insertAdjacentElement("beforebegin", fails);
    }
  }
  // The highlighted default follows the net — Fails when the save cannot succeed — marked to
  // stay marked (ui.js markDefaultButton).
  markDefaultButton(element, gate.autoFail ? "bf-fails" : gate.net);
}

/** A sheet save that cannot succeed, pressed Fails with no demand to record it on: the card
 * is the record (R5) — nothing else in the world knows this save was owed. */
function postSheetAutoFail(gate) {
  const actor = resolveUuid(gate.actorUuid);
  if ( !(actor instanceof Actor) ) return;
  const abilityLabel = CONFIG.DND5E.abilities[gate.ability]?.label ?? gate.ability;
  const failing = gate.sources.filter(s => s.autoFail);
  void ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({
      img: actor.img ?? null, eyebrow: "Saving throw — automatic failure", tone: "bad",
      title: `${actor.name}: ${abilityLabel} save fails`,
      subtitle: failing.map(s => s.statusName).join(", "),
      lines: [...new Set(failing.map(s => s.detail))].map(ruleLine)
    }),
    flags: { [MODULE_ID]: { saveAutoFail: { ...statContext(actor.uuid), ability: gate.ability,
      sources: failing.map(s => ({ status: s.status, label: s.label })) } } }
  }).catch(err => console.error(`${TITLE} | Automatic-failure card failed.`, err));
}

// The section, and the demand, on every render of a save dialog carrying either (the first,
// and each re-render the dialog's own dropdowns cause). polish.js rides the same hook for the
// target block; the entry order keeps its paint ahead of these inserts.
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  try {
    const demand = app.options?.bfSaveDemand ?? null;
    const gate = app.options?.bfSaveGate ?? null;
    // A demand carrying `present` is another machine's (Topple, concentration — ui.js
    // drawDemandFieldset paints those); this one builds from the saves flag and would close a
    // dialog whose card has no saves entry (bit 2026-09-03: the first concentration dialog
    // closed on render, adopted by nobody).
    if ( demand && !demand.present ) drawSaveDemand(app, element, demand);
    if ( gate ) drawSaveGate(app, element, gate, demand);
  } catch(err) {
    console.error(`${TITLE} | Save dialog section failed to draw.`, err);
  }
});

// The record: what the gate showed, what it netted to, what was pressed — on the save message,
// the attack gate's flag and the attack gate's card line (reminders.js reads it for any roll).
Hooks.on("dnd5e.postRollConfiguration", (rolls, config, dialog, message) => {
  try {
    const gate = config?.bfSaveGate;
    if ( !gate?.sources?.length || !rolls?.length ) return;
    if ( foundry.utils.getProperty(message, "data.flags.dnd5e.roll.type") !== "save" ) return;
    const mode = rollModeOf(rolls[0]?.options?.advantageMode);
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${REMINDER_FLAG}`, {
      ...reminderRecord({ sources: gate.sources, net: gate.net, mode, answeredAt: Date.now() }),
      ...statContext(gate.actorUuid)
    });
  } catch(err) {
    console.error(`${TITLE} | Save gate record failed.`, err);
  }
});

/**
 * THE FOLD WITHOUT A DIE: a save the rules fail before it is rolled, recorded as the failure
 * it is. The same write `foldSaveAnswer` makes — `done`, the outcome, the card closing when
 * every target is in — with no roll message and the condition standing where the total would.
 * The consequences follow exactly as for a rolled failure. The buzzer takes this path too for
 * a target that cannot succeed (`timedOut`): rolling dice the rules have already failed would
 * be the module contradicting the table.
 */
async function foldSaveAutoFail(card, uuid, { sources = [], timedOut = false } = {}) {
  const key = `${card.id}|${uuid}`;
  if ( saveFolds.has(key) ) return;
  saveFolds.add(key);
  try {
    const failing = sources.filter(s => s.autoFail);
    let folded = false;
    let allDone = false;
    await queueFlagWrite(card, "saves", current => {
      if ( current.status !== "pending" ) return false;
      const entry = current.targets?.find(t => !t.done && (t.uuid === uuid));
      if ( !entry ) return false;
      entry.done = true;
      entry.outcome = "failed";
      entry.total = null;
      entry.rollMessageId = null;
      entry.autoFailed = true;
      entry.autoFailedBy = failing.map(s => s.statusName).join(", ");
      if ( timedOut ) entry.timedOut = true;
      if ( current.targets.every(t => t.done) ) {
        current.status = "done";
        allDone = true;
      }
      folded = true;
    });
    if ( !folded ) return;
    if ( allDone ) disarmAskTimer(saveTimers, card.id);
    await applySaveConsequences(card, uuid, null);
  } finally {
    saveFolds.delete(key);
  }
}

/* --- the fold: the elect judges the roll against the stored DC ------------------------------ */

/** Which pending demand target a save roll answers, or null. */
// Declared to the spine's demand registry (Stage 2, 2026-09-05), the three channels as before:
//   1) The module's own roll — `respondsTo` + `saveFor`: exact by construction; a stamp without
//      the target is another machine's channel.
//   2) Chained to a demand card — the native card's own save button arrives this way (buildPost
//      stamps originatingMessage from the click's enclosing card). A save chained to any OTHER
//      message belongs to that chain and is never read as an answer here.
//   3) A bare sheet roll answers the oldest pending demand naming this actor with a matching
//      ability — DEFERRING to a pending concentration ask (priority 0 to this 1; the two cannot
//      be told apart; simultaneous pendings are a corner the topple fold already accepts).
registerDemand("saves", {
  priority: 1, chained: true,
  answering: (flag, f) => (flag && f.saveFor) ? { uuid: f.saveFor } : null,
  pendingEntry: (flag, f) => ((flag.status === "pending") && flag.abilities?.includes(f.ability))
    ? (flag.targets ?? []).find(t => !t.done && (t.uuid === f.actorUuid)) ?? null : null,
  pendingFor: (flag, uuid) => (flag.status === "pending") ? (flag.targets ?? []).find(t => !t.done && (t.uuid === uuid)) ?? null : null
});
function saveAnsweredBy(rollMessage) {
  const found = demandAnsweredBy(rollMessage);
  if ( found?.flagKey !== "saves" ) return null;
  const first = found.matches[0];
  return first ? { card: first.card, uuid: first.entry.uuid } : null;
}

/** Same-client fold latch — the create watcher, the buzzer and the render resume can race. */
const saveFolds = new Set();

export async function foldSaveAnswer(card, uuid, rollMessage) {
  const key = `${card.id}|${uuid}`;
  if ( saveFolds.has(key) ) return;
  saveFolds.add(key);
  try {
    const total = rollMessage.rolls?.[0]?.total;
    if ( typeof total !== "number" ) return;
    // The stored DC is the authority (the ask's-DC rule) — plus forceSuccess, in case
    // legendary resistance beat the fold to the message (a resume after an elect reload).
    const forced = rollMessage.getFlag("dnd5e", "roll.forceSuccess") === true;
    const timedOut = rollMessage.getFlag(MODULE_ID, "timedOut") === true;

    /* --- THE D20 FOLD OFFER: WITHHOLD, DO NOT UNDO (v1.23.0) ---------------------------------
     *
     * ⚠ THIS IS THE ONE PLACE A FAILED SAVE CAN STILL BE PATCHED, and v1 shipped without it.
     * Three table reports in one session — Fireball, Shatter, Hold Person — all the same cause:
     * this function folds AND APPLIES the verdict the instant the roll lands, so an offer made
     * afterwards arrives after the damage is already on the sheet.
     *
     * ⚠ It is a WITHHOLD, exactly like a reaction hold pausing an attack chain, and never an
     * undo. Nothing has been applied at this point, so §11 rule 4's auto-revert debt is not
     * reached — which is the whole reason to pause HERE rather than let the verdict land and
     * take it back.
     *
     * ⚠ The offer is gated on the FAILURE, and it can be, because this side owns the DC (the
     * ask's-DC rule). That is the one thing a raw ability check can never do.
     *
     * ⚠ Legendary resistance and a timed-out roll are excluded: `forced` is a ruling rather than
     * arithmetic, and a save the clock already answered has nobody left at the keyboard.
     * ⚠ The import is LAZY and the call FAILS OPEN — a broken offer must never swallow a
     * verdict. `saveFolds` releases on the early return, so the resume can re-enter here.
     */
    if ( !forced && !timedOut ) {
      const dc = card.getFlag(MODULE_ID, "saves")?.dc;
      const { offerFoldOnSave } = await import("./d20-folds.js");
      if ( await offerFoldOnSave(rollMessage, card, uuid, total, dc) ) return;
    }
    // ⚠ THROUGH THE SERIALIZER (core.js): per-target independence means two targets can fold
    // their answers against this one card at the same instant, and a clone-mutate-set drops
    // whichever landed first. A lost fold re-demands a target that has already rolled.
    let folded = false;
    let allDone = false;
    await queueFlagWrite(card, "saves", current => {
      if ( current.status !== "pending" ) return false;
      const entry = current.targets?.find(t => !t.done && (t.uuid === uuid));
      if ( !entry ) return false;   // nothing to fold — never write
      entry.done = true;
      // ⚠ THROUGH THE FOLD (D8, 2026-08-23). `SAVE_FOLDS` ships empty, so this is today's
      // arithmetic exactly — `saveOutcome(total, dc, forced)` with nothing added and nothing
      // replaced. What it buys is that the SEAM exists: a rerolled or boosted save lands by
      // declaring a spec, not by editing this resolver. The attack side had that channel since
      // v1.19.0 and the save side had none at all, which is the half of D8 that was real work.
      // ⚠ The folds are read off the ROLL MESSAGE, not off this card. A save-side fold changes
      // the number a particular roll produced, so it belongs on the roll — the same locality the
      // attack side uses, where the folds ride the attack message rather than the usage card.
      const judged = foldedSave({
        total, dc: current.dc, forced,
        folds: foldsFrom(key => rollMessage.getFlag(MODULE_ID, key), SAVE_FOLDS)
      });
      entry.outcome = judged.outcome;
      entry.total = judged.total;
      entry.rollMessageId = rollMessage.id;
      if ( evasionApplies(rollMessage.getAssociatedActor?.(), current) ) entry.evasion = true;
      // Circle of Power (2026-09-05): a success against half-on-save spell damage takes none.
      const noneBy = noneOnSuccessFor(rollMessage.getAssociatedActor?.(), current);
      if ( noneBy ) entry.noneOnSuccess = noneBy;
      if ( timedOut ) entry.timedOut = true;
      if ( forced ) entry.forced = true;
      if ( current.targets.every(t => t.done) ) {
        current.status = "done";
        allDone = true;
      }
      folded = true;
    });
    if ( !folded ) return;          // the guards above declined — no consequences either
    if ( allDone ) disarmAskTimer(saveTimers, card.id);
    await applySaveConsequences(card, uuid, rollMessage);
  } finally {
    saveFolds.delete(key);
  }
}

/* --- the verdict line: a table moment opened in public is closed in public ------------------ *
 * v1.19.0 (FLOW item 7) — a deliberate, user-sanctioned REVERSAL of standing item 15's "NO
 * verdict announcement cards": the demand card's rows fold verdicts silently, so on scrollback
 * an open demand was indistinguishable from a stalled one — the same silence finding ⑤ priced
 * for Topple. One public card per verdict, tone by stakes (good holds / bad fails), wording
 * from verdictText so the card can never disagree with the row. It says the VERDICT and the
 * stakes-word only — never "damage landed" (autoApply may be off; verdictText already keeps
 * that honesty). Idempotence: `announced` is claimed through queueFlagWrite BEFORE posting —
 * two targets' consequence passes run concurrently against one card, which is exactly the
 * measured shape queueFlagWrite exists for. Twin-supersede below covers the two-elects race. */

async function announceSaveVerdict(card, flag, entry) {
  try {
    if ( entry.announced ) return;
    let claimed = false;
    await queueFlagWrite(card, "saves", current => {
      const t = current.targets?.find(x => x.uuid === entry.uuid);
      if ( t && t.done && !t.announced ) { t.announced = true; claimed = true; }
    });
    if ( !claimed ) return;
    const saved = entry.outcome === "saved";
    // The line speaks AS THE SAVER, not the caster (v1.19.x finding ⑧ — "Thomas holds"
    // rendered under Salyth's card), and the title leads with the SOURCE (finding ⑦ —
    // the walk's global rule: the ability, then the result).
    const saver = resolveUuid(entry.uuid);
    await ChatMessage.create({
      speaker: (saver instanceof Actor) ? ChatMessage.getSpeaker({ actor: saver }) : card.speaker,
      content: bfCard({
        img: flag.item?.img ?? null,
        eyebrow: `Saving Throw — ${flag.item?.name ?? "the effect"}`,
        tone: saved ? "good" : "bad",
        title: saved ? `${flag.item?.name ?? "The effect"} — ${entry.name} holds`
                     : `${flag.item?.name ?? "The effect"} — ${entry.name} fails`,
        subtitle: verdictText(flag, entry) ?? ""
      }),
      flags: { [MODULE_ID]: { verdictLine: {
        sourceMessageId: card.id, uuid: entry.uuid,
        // Part of the supersede KEY: a legendary-resistance correction re-announces the same
        // (card, target) with forced=true, and must never be eaten as the fail line's twin.
        forced: !!entry.forced
      } } }
    });
  } catch(err) {
    console.error(`${TITLE} | Verdict line failed.`, err);
  }
}

/* The twin-line supersede — the topple card's sourceMessageId idiom, applied to the new
 * elect-posted card: isActiveGM() is per-USER, so two sessions on one account can both
 * announce. Keyed (sourceMessageId, uuid); the elder stays, the newcomer deletes itself. */
Hooks.on("createChatMessage", message => {
  const v = message.getFlag(MODULE_ID, "verdictLine");
  if ( !v?.sourceMessageId ) return;
  if ( !drivesMomentFor(game.messages.get(v.sourceMessageId)
    ?.getFlag(MODULE_ID, "saves")?.sourceUuid ?? null) ) return;
  const elder = game.messages.contents.some(m => {
    if ( m.id === message.id ) return false;
    const o = m.getFlag(MODULE_ID, "verdictLine");
    if ( !o || (o.sourceMessageId !== v.sourceMessageId) || (o.uuid !== v.uuid)
      || (!!o.forced !== !!v.forced) ) return false;
    return (m.timestamp < message.timestamp)
      || ((m.timestamp === message.timestamp) && (m.id < message.id));
  });
  if ( elder ) message.delete().catch(() => { /* the other twin got there first */ });
});

/* --- the fold choices (v1.19.x, walk findings ⑤/⑥ + walk-5 (y)): a verdict opens a decision *
 * Two choices, both keyed off the maneuver-folds list (the list stays the switch), both
 * opened BY the verdict, and both holding one target's consequence pass between the
 * verdict's announce and its application:
 *
 *   INTERPOSE (kind "interpose", the saver's): the save SUCCEEDED against DEX half-on-success
 *   damage, shield in hand, Reaction free — the Reaction turns half into NONE. The 2024 text
 *   conditions the Reaction on succeeding, so a failure never offers and never spends
 *   (walk-5 (y) — finding (f)'s pre-roll gamble is overturned). Expiry passes; a Reaction is
 *   never spent by a timer.
 *
 *   BASH (kind "bash", the attacker's): this demand IS the listed feat's own save and it
 *   FAILED — the feat's either/or: knock Prone (the STANDARD Prone chip via forceStatus —
 *   walk-5 (x), Topple's press) or the 5-foot push (the Push mastery's idiom: a card, a
 *   hand-moved token, no press). Expiry defaults to Prone — the machine finishes what the
 *   failure started, and says so.
 *
 * The answer travels like every fold answer (finding ①'s routing): the popup goes to the
 * subject's owner, the GM when no owning player is connected; a non-owner's answer rides its
 * own message (§4.1) and the elect folds it in. The consequence pass resumes off the update.
 * ------------------------------------------------------------------------------------------- */

const saveChoiceTimers = new Map();

/** What choice, if any, this VERDICT opens — bash on the listed feat's own failure (the
 * attacker's either/or), interpose on a listed shield-bearer's SUCCESS (walk-5 (y)).
 * Null for almost every save. */
async function saveChoiceSpec(card, flag, entry) {
  const { foldEntryFor, equippedShield } = await import("./maneuvers.js");
  if ( entry.outcome === "saved" ) {
    // Interpose eligibility, read at VERDICT time: half-on-success DEX damage, the listed
    // feat on the saver, a shield in hand, the Reaction free — and the save already held.
    if ( !flag.hasDamage || (flag.damageOnSave !== "half") ) return null;
    if ( !(flag.abilities ?? []).includes("dex") || !setting(S.autoApply) ) return null;
    const subject = await fromUuid(entry.uuid).catch(() => null);
    const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
    if ( !(saver instanceof Actor) ) return null;
    if ( reactionSpent(saver) ) return null;
    const found = foldEntryFor(saver, "interpose");
    if ( !found || !equippedShield(saver) ) return null;
    return { kind: "interpose", itemName: found.item.name, itemImg: found.item.img,
      subjectUuid: entry.uuid };
  }
  if ( entry.outcome !== "failed" ) return null;
  const attacker = card.getAssociatedActor?.();
  if ( !attacker ) return null;
  const found = foldEntryFor(attacker, "bash");
  if ( !found ) return null;
  if ( found.item.name.toLowerCase() !== String(flag.item?.name ?? "").toLowerCase() ) return null;
  const activity = flag.activityUuid ? await fromUuid(flag.activityUuid).catch(() => null) : null;
  const applicable = new Set((activity?.applicableEffects ?? []).map(e => e.id));
  const presses = (activity?.effects ?? []).some(e => e.effect && applicable.has(e.effect.id) && !e.onSave);
  if ( !presses ) return null;   // nothing to choose between — the push against no press is no choice
  return { kind: "bash", itemName: found.item.name, itemImg: found.item.img,
    subjectUuid: attacker.uuid, attackerName: attacker.name };
}

/** True while a choice HOLDS this target's pass — stamps it on first sight. */
async function gateSaveChoice(card, flag, entry) {
  if ( entry.applied ) return false;
  if ( entry.choice ) return !entry.choice.answer;
  const spec = await saveChoiceSpec(card, flag, entry);
  if ( !spec ) return false;
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  await queueFlagWrite(card, "saves", current => {
    const t = current.targets?.find(x => x.uuid === entry.uuid);
    if ( !t || t.applied || t.choice ) return;
    t.choice = { ...spec, answer: null,
      ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}) };
  });
  armSaveChoiceTimer(card);
  const live = card.getFlag(MODULE_ID, "saves")?.targets?.find(x => x.uuid === entry.uuid)?.choice;
  return !!live && !live.answer;
}

/** One answer, first writer wins; a non-owner's answer relays as their own message (§4.1). */
async function answerSaveChoice(card, uuid, answer) {
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  const c = entry?.choice;
  if ( !c || c.answer ) return;
  if ( !card.isOwner ) {
    const subject = await fromUuid(c.subjectUuid ?? uuid).catch(() => null);
    // Law 3 (declaration never claims an outcome) still governs the BASH labels — the press
    // follows the choice. Interpose is POST-VERDICT since walk-5 (y): the save already held,
    // so its accept states the known result; the settle card remains the durable record.
    const labels = {
      use: `${c.itemName} — ${entry.name} spends the Reaction: no damage`,
      pass: `${c.itemName} — passed, the Reaction is kept`,
      prone: `${c.itemName} — ${c.attackerName ?? "the attacker"} chooses Prone`,
      push: `${c.itemName} — ${c.attackerName ?? "the attacker"} chooses the push`
    };
    await ChatMessage.create({
      speaker: (subject instanceof Actor) ? ChatMessage.getSpeaker({ actor: subject }) : undefined,
      content: bfCard({
        img: c.itemImg, eyebrow: `Maneuver — ${c.itemName}`,
        tone: (answer === "pass") ? "neutral" : "good",
        title: labels[answer] ?? `${c.itemName} — ${answer}`,
        subtitle: flag.item?.name ?? ""
      }),
      flags: { [MODULE_ID]: { saveChoiceAnswer: { cardId: card.id, uuid, answer } } }
    });
    return;
  }
  await queueFlagWrite(card, "saves", current => {
    const t = current.targets?.find(x => x.uuid === uuid);
    const cc = t?.choice;
    if ( !cc || cc.answer ) return;
    cc.answer = answer;
    cc.answeredAt = Date.now();
  });
}

/** A relayed choice answer landing: the ELECT folds it in (idempotent, first answer wins).
 * ⚠ Through the spine's relay registry since the §4.1 consolidation. */
registerRelay("saveChoiceAnswer", {
  flagKey: "saves",
  targetOf: a => a.cardId,
  owns: flag => drivesMomentFor(flag?.sourceUuid ?? null),
  fold: (current, a) => {
    const t = current.targets?.find(x => x.uuid === a.uuid);
    const c = t?.choice;
    if ( !c || c.answer ) return;
    c.answer = a.answer;
    c.answeredAt = Date.now();
  }
});

const disarmSaveChoiceTimer = cardId => disarmDeadline(saveChoiceTimers, cardId);

function armSaveChoiceTimer(card) {
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !drivesMomentFor(flag?.sourceUuid ?? null) ) return;
  const pending = (flag?.targets ?? []).filter(t => t.choice && !t.choice.answer && t.choice.deadline);
  if ( !pending.length ) { disarmSaveChoiceTimer(card.id); return; }
  armDeadline(saveChoiceTimers, card.id, Math.min(...pending.map(t => t.choice.deadline)),
    fireSaveChoiceTimer);
}

/** Expiry defaults: bash → Prone; interpose → pass. The update the write raises drives the
 * consequence pass and any later deadline re-arms below. */
async function fireSaveChoiceTimer(cardId) {
  try {
    const card = game.messages.get(cardId);
    if ( !card ) return;
    const now = Date.now();
    await queueFlagWrite(card, "saves", current => {
      for ( const t of current.targets ?? [] ) {
        const c = t.choice;
        if ( !c || c.answer || !c.deadline || (c.deadline > now) ) continue;
        c.answer = (c.kind === "bash") ? "prone" : "pass";
        c.timedOut = true;
        c.answeredAt = now;
      }
    });
    armSaveChoiceTimer(card);
  } catch(err) {
    console.error(`${TITLE} | Save-choice buzzer failed.`, err);
  }
}

/** The choice popup — two controls, the moment bar, the fold family's routing. */
async function showSaveChoicePopup(card, uuid) {
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  const c = entry?.choice;
  if ( !c || c.answer ) return;
  const subject = resolveUuid(c.subjectUuid);
  const interpose = c.kind === "interpose";
  const { RULE_TEXT } = await import("./maneuvers.js");
  await openMomentPopup(card, `choice:${uuid}`, subject, {
    title: `${c.itemName} — ${subject?.name ?? ""}`,
    icon: interpose ? "fa-solid fa-shield" : "fa-solid fa-hand-fist",
    content: bfCard({
      img: c.itemImg, eyebrow: `Maneuver — ${c.itemName}`, tone: "pending",
      // Interpose is POST-VERDICT since walk-5 (y): the save already succeeded, and the ask
      // is only whether the Reaction turns the half into none. (z): the rule line is the
      // feature's own sentence, verbatim; the module's read of it rides as the hint.
      title: interpose ? `${c.itemName} — take no damage?`
                       : `${c.itemName} — ${entry.name} failed: choose`,
      subtitle: interpose
        ? `You succeeded on the Dexterity save against ${flag.item?.name ?? "the effect"}.`
        : `${flag.item?.name ?? "The effect"} — the save failed.`,
      lines: interpose
        ? [ruleLine(RULE_TEXT.interpose),
           "Use it: the Reaction is spent and the half damage becomes none."]
        : [ruleLine(RULE_TEXT.bashChoice),
           "The push is by hand — nothing moves the token for you."]
      // The choice sub-object through momentBarHTML, NEVER holdBarHTML (finding (n)): it
      // carries no `status`, and the status-gated wrapper silently ate the bar at both of
      // this machine's call sites — the suite asserts the bar's DOM now.
    }) + momentBarHTML(c, "to answer"),
    buttons: interpose
      ? [
        { action: "use", label: `Use ${c.itemName}`, default: true,
          callback: () => answerSaveChoice(card, uuid, "use") },
        // "Take half" states a KNOWN outcome now — the verdict is already in (walk-5 (y));
        // law 3 barred it only while the save was unrolled.
        { action: "pass", label: "Take half",
          callback: () => answerSaveChoice(card, uuid, "pass") }
      ]
      : [
        { action: "prone", label: "Knock Prone", default: true,
          callback: () => answerSaveChoice(card, uuid, "prone") },
        { action: "push", label: "Push 5 feet",
          callback: () => answerSaveChoice(card, uuid, "push") }
      ]
  });
}

/** The bash outcome, announced once — the push follows the Push mastery's idiom (a card, a
 * hand-moved token); the Prone press is the STANDARD Prone chip via forceStatus (walk-5 (x):
 * one universal prone — Topple's idiom, canonical id, origin names the presser — never the
 * item's own custom effect). */
async function announceBashOutcome(card, flag, entry) {
  const c = entry.choice;
  if ( !c?.answer || c.announced ) return;
  let claimed = false;
  await queueFlagWrite(card, "saves", current => {
    const t = current.targets?.find(x => x.uuid === entry.uuid);
    if ( t?.choice && !t.choice.announced ) { t.choice.announced = true; claimed = true; }
  });
  if ( !claimed ) return;
  const attacker = card.getAssociatedActor?.();
  const push = c.answer === "push";
  if ( !push ) {
    const subject = await fromUuid(entry.uuid).catch(() => null);
    const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
    if ( saver instanceof Actor ) await forceStatus(saver, "prone", { origin: attacker?.uuid ?? null });
  }
  await ChatMessage.create({
    speaker: attacker ? ChatMessage.getSpeaker({ actor: attacker }) : card.speaker,
    content: bfCard({
      img: c.itemImg, eyebrow: `Maneuver — ${c.itemName}`, tone: "good",
      title: push
        ? `${c.itemName} — ${attacker?.name ?? "the attacker"} pushes ${entry.name} 5 feet`
        : `${c.itemName} — ${attacker?.name ?? "the attacker"} knocks ${entry.name} Prone`,
      subtitle: c.timedOut ? "defaulted by the timer" : "the attacker's choice",
      lines: push ? ["Straight away from the attacker. Move the token; nothing is automated."] : []
    })
  });
}

/** Interpose settles on the ACCEPT (walk-5 (y): the choice only ever opens after a
 * SUCCESSFUL save, so the settle card states the known outcome — no damage — and the
 * Reaction is spent here and only here; a pass or a buzzer spends nothing). The card is the
 * durable record: a zeroed number must never read as a dropped machine. */
async function settleInterpose(card, flag, entry) {
  const c = entry.choice;
  if ( (c?.answer !== "use") || c.validated ) return;
  if ( entry.outcome !== "saved" ) return; // the (y) invariant — an accept exists only past a held save
  let claimed = false;
  await queueFlagWrite(card, "saves", current => {
    const t = current.targets?.find(x => x.uuid === entry.uuid);
    if ( t?.choice && !t.choice.validated ) { t.choice.validated = true; claimed = true; }
  });
  if ( !claimed ) return;
  const subject = await fromUuid(entry.uuid).catch(() => null);
  const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
  if ( saver instanceof Actor ) void spendReaction(saver, { origin: null, what: `Interpose (${c.itemName})` });
  await ChatMessage.create({
    speaker: (saver instanceof Actor) ? ChatMessage.getSpeaker({ actor: saver }) : card.speaker,
    content: bfCard({
      img: c.itemImg, eyebrow: `Maneuver — ${c.itemName}`, tone: "good",
      title: `${c.itemName} — ${entry.name} takes no damage`,
      subtitle: `${flag.item?.name ?? "The effect"}: the Reaction turns the half into none.`,
      lines: ["The saving throw held; the shield does the rest."]
    })
  });
}

/* --- the consequences: Phase 3's save slice, per target, receipts throughout ---------------- */

/** Same-client latch across the verdict pause — fold, update watcher and render can overlap. */
const saveApplications = new Set();

/**
 * One target's consequences, once: wait out the dice (the verdict pause — mechanics are
 * already written, only the table-facing part holds), then effects per outcome, then any
 * already-rolled damage per outcome. The flag is RE-READ after the pause on purpose: a
 * legendary-resistance flip landing mid-pause overturns the outcome before anything applied.
 */
async function applySaveConsequences(card, uuid, rollMessage = null) {
  const key = `${card.id}|${uuid}`;
  if ( saveApplications.has(key) ) return;
  saveApplications.add(key);
  try {
    let flag = card.getFlag(MODULE_ID, "saves");
    let entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry?.done || entry.applied ) return;
    if ( !rollMessage && entry.rollMessageId ) rollMessage = game.messages.get(entry.rollMessageId);
    if ( rollMessage ) await dramaticVerdictPause(rollMessage);

    flag = card.getFlag(MODULE_ID, "saves"); // the pause is wide — re-read before acting
    entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry?.done || entry.applied ) return;

    // ⚠ THE CONSEQUENCE IS A WRITE TO THE SAVER (v1.27.2). With no GM connected this splits by
    // WHO SAVED: a party-wide demand — fireball, a dragon's breath — lands on PCs their own
    // players own, so the damage and the chips apply exactly as always. A demand aimed at
    // monsters cannot land, and the announcement below is the point at which to say so: the
    // verdict is already public and true, only the press is missing.
    const saver = resolveUuid(uuid);
    if ( (saver instanceof Actor) && !canApplyTo(saver) ) {
      await announceSaveVerdict(card, flag, entry);
      await whisperNoGM(`${entry.name ?? saver.name}'s save consequences`,
        "The verdict stands on the card — apply the damage and any condition by hand.");
      return;
    }

    // The verdict ANNOUNCES before its consequences land (v1.19.0, FLOW item 7 — the line
    // sits above the receipt rows, per "cards say one thing, once"), and AFTER the pause +
    // re-read, so a legendary-resistance flip mid-pause announces the FINAL verdict.
    await announceSaveVerdict(card, flag, entry);

    // A fold CHOICE can hold this target's pass here (v1.19.x, findings ⑤/⑥): Interpose on
    // a successful DEX save, the bash's Prone-or-push on a failed listed save. `applied`
    // stays false, so the update/render floors resume the pass the moment the answer (or
    // the buzzer's default) lands in the flag.
    if ( await gateSaveChoice(card, flag, entry) ) return;
    flag = card.getFlag(MODULE_ID, "saves");   // the choice write moved the flag — re-read
    entry = flag?.targets?.find(t => t.uuid === uuid);
    if ( !entry?.done || entry.applied ) return;

    await applySaveEffects(card, flag, entry);
    if ( (entry.choice?.kind === "bash") && entry.choice.answer ) await announceBashOutcome(card, flag, entry);
    if ( entry.choice?.kind === "interpose" ) await settleInterpose(card, flag, entry);
    await reconcileSaveDamage(card, uuid);

    // ⚠ THROUGH THE SERIALIZER, not a bare read-modify-write (core.js). Per-target
    // independence means two targets' consequence passes run at once against this one card,
    // and a clone-merge-set here can land without the other pass's entry. Losing THIS field
    // is the measured double-application itself: `reconcileSaveDamage` reads the receipt as
    // its idempotence guard, so a dropped `applied` reads as "not applied yet" and the
    // damage lands on that target a second time.
    await queueFlagWrite(card, "saves", current => {
      const done = current.targets?.find(t => t.uuid === uuid);
      if ( done && !done.applied ) done.applied = true;
    });
    await cleanupSpentTemplates(card);
  } catch(err) {
    console.error(`${TITLE} | Save consequences failed.`, err);
  } finally {
    saveApplications.delete(key);
  }
}

/**
 * The activity's effects, filtered by the verdict: a failure applies them all, a success
 * applies only the entries whose own `onSave` says so — the flag the system stores and
 * nothing native reads. Through the shared applier: same origin rule (the caster's
 * concentration effect when the card carries one — the native dependentOn cascade rides
 * along), same receipts, same revert.
 */
async function applySaveEffects(card, flag, entry) {
  // A bash ANSWER replaces the generic pass entirely (v1.19.x ⑤ + walk-5 (x)): the push is
  // the Push idiom (a card, a hand-moved token), and the Prone press is the STANDARD chip
  // via forceStatus — never the item's own custom effect. announceBashOutcome owns both.
  if ( (entry.choice?.kind === "bash") && entry.choice.answer ) return;
  // An emanation's TRIGGERED demand (emanations.js, 2026-09-03): the activity's effect (Spirit
  // Guardians' Half Speed) is the area's STANDING effect, kept by the region while the creature
  // stands inside — applying it again here would double it. The demand says so; damage still lands.
  if ( flag.effectsHandled ) return;
  const activity = flag.activityUuid ? await fromUuid(flag.activityUuid) : null;
  if ( !activity ) return; // the item is gone (a consumed scroll) — accepted corner above
  const applicable = new Set((activity.applicableEffects ?? []).map(e => e.id));
  const toApply = (activity.effects ?? [])
    .filter(e => e.effect && applicable.has(e.effect.id))
    .filter(e => (entry.outcome === "failed") || e.onSave)
    .map(e => e.effect);
  // A pack that brought NO effect for a failure the text names (Web's Restrained — SAVE_PRESSES,
  // 2026-09-02): press the standard status, the caster as its origin, and receipt it on the card
  // so the revert is there — the Topple idiom, as data.
  if ( !toApply.length && (entry.outcome === "failed") ) {
    const press = SAVE_PRESSES[activity.item?.name] ?? null;
    if ( press?.onFail ) await pressSaveStatus(card, flag, entry, press);
    return;
  }
  if ( !toApply.length ) return;
  const concentration = card.getAssociatedActor?.()?.effects.get(card.system?.concentration) ?? null;
  await applyEffectsWithReceipt(card, toApply, [{ uuid: entry.uuid, name: entry.name }], {
    concentration,
    scaling: card.system?.scaling ?? 0,
    spellLevel: card.system?.spellLevel ?? undefined,
    source: statSourceOf(card) // the data-plane stamp — the caster whose demand this is
  });
}

/**
 * EVASION applies to this demand for this saver (decide/registry.js EVASION): the feature on
 * the sheet by name, a Dexterity save, an effect that deals half on a success, the saver not
 * Incapacitated. Read at the fold and stamped on the entry; the multiplier and the row read it.
 */
function evasionApplies(actor, flag) {
  if ( !(actor instanceof Actor) || !flag?.hasDamage || (flag.damageOnSave !== "half") ) return false;
  if ( !flag.abilities?.includes?.(EVASION.ability) ) return false;
  if ( actor.statuses?.has?.("incapacitated") ) return false;
  return actor.items.some(i => (i.type === "feat") && (i.name.toLowerCase() === EVASION.feature.toLowerCase()));
}

/** A standing effect that turns this saver's SUCCESS against half-on-save damage into none
 * (the effect table's `halfToNone` — Circle of Power against a spell): the row's key, or null. */
function noneOnSuccessFor(actor, flag) {
  if ( !(actor instanceof Actor) || !flag?.hasDamage || (flag.damageOnSave !== "half") ) return null;
  if ( !reminderEntries().some(e => e.kind === "effect") ) return null;
  return saveNoneOnSuccess({ effects: actor.effects.filter(e => !e.disabled).map(e => ({ name: e.name })),
    enabled: effectEntries().map(e => e.kind), table: EFFECT_BENDS, demand: flag.demand ?? null });
}

/** The SAVE_PRESSES press: the canonical status on the failer, receipted as an applied effect
 * (the effect the status became — so the card's revert removes exactly it). */
async function pressSaveStatus(card, flag, entry, press) {
  const subject = await fromUuid(entry.uuid).catch(() => null);
  const saver = (subject instanceof Actor) ? subject : (subject?.actor ?? null);
  if ( !(saver instanceof Actor) || !canApplyTo(saver) ) return;
  if ( saver.statuses?.has?.(press.status) ) return;   // already wearing it — nothing to press, nothing to receipt
  const landed = await forceStatus(saver, press.status, { origin: flag.sourceUuid ?? null });
  if ( !landed ) return;
  const effect = saver.effects.find(e => e.statuses?.has?.(press.status));
  if ( !effect ) return;
  await queueFlagWrite(card, "effectReceipt", current => {
    joinEffectReceipt(current, { uuid: entry.uuid, name: entry.name, img: saver.img ?? null,
      effects: [effectRecord({ id: effect.id, name: effect.name, img: effect.img, description: press.rule }, statContext(flag.sourceUuid ?? null))] });
  });
}

/** Every damage roll chained to the demand card — the card's own Damage button chains its
 * click natively, and the module's suite rolls pass the origin explicitly. Whole log. */
function saveDamageMessages(card) {
  return game.messages.contents.filter(m =>
    (m.getFlag("dnd5e", "roll.type") === "damage")
    && (m.getFlag("dnd5e", "originatingMessage") === card.id));
}

/** Land one chained damage roll on one target at its verdict's multiplier — the receipt says
 * why. Shared by the reconcile pass (behind its guards) and the legendary-resistance unwind
 * (which reverts first and re-applies DIRECTLY, because the guard below deliberately treats
 * any existing receipt entry — reverted included — as "handled": a human's manual ↩ revert
 * must stick, never be re-fought by the machine). */
async function applyOneSaveDamage(damageMessage, flag, entry) {
  const damageOnSave = damageMessage.getFlag("dnd5e", "roll.damageOnSave")
    ?? flag.damageOnSave ?? "half";
  const multiplier = saveMultiplier(entry, damageOnSave);
  if ( multiplier == null ) return;
  const damages = damagePartsOf(damageMessage.rolls);
  if ( !damages.length ) return;
  await applyDamagesWithReceipt(damageMessage, [{ uuid: entry.uuid, name: entry.name }], damages, {
    multiplier,
    note: entry.evasion
      ? ((entry.outcome === "saved") ? "saved — Evasion, no damage" : "failed — Evasion, half damage")
      : (entry.noneOnSuccess && (entry.outcome === "saved")) ? `saved — ${entry.noneOnSuccess}, no damage`
      : (entry.outcome === "saved")
        ? ((multiplier === 0.5) ? "saved — half damage" : "saved — full damage anyway")
        : undefined
  });
}

/** Per (damage message, target) latch — the fold path and the damage-arrival path share it. */
const saveDamageApplications = new Set();

/**
 * Land every chained damage roll on every DONE target that has no receipt entry yet, at the
 * verdict's multiplier — the applier records a non-1 multiplier on the entry, so the card
 * says why the number halved. Order-independent: damage before verdicts, verdicts before
 * damage, or interleaved per target, the receipt gate makes every path idempotent. Gated on
 * Auto-Apply Damage — a table that keeps its trays keeps them here too; the verdict rows
 * still say who saved.
 */
async function reconcileSaveDamage(card, onlyUuid = null) {
  if ( !setting(S.autoApply) ) return;
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;
  // A demand with no damage dimension (no parts, or rider damage the save doesn't
  // modulate — the onSave "full" stamp rule) never applies chained damage by verdict:
  // a Web-burn enricher click chains to the card, and per-verdict application would
  // re-create finding ③ through the side door. The native tray owns those rolls.
  if ( !flag.hasDamage ) return;
  for ( const damageMessage of saveDamageMessages(card) ) {
    for ( const entry of flag.targets ) {
      if ( !entry.done ) continue;
      // The general passes (damage arrival, render resume, update watcher) apply only
      // targets whose consequence pass has FINISHED — the verdict pause gates every
      // table-facing consequence, damage included, and the fold's flag write must not let
      // a reconcile racing ahead of the pause undercut it (caught by smoke-saves 3d: the
      // damage landed while the effects were still waiting out the dice). The explicit
      // per-target path (the post-pause consequence pass, the LR unwind) applies regardless.
      if ( onlyUuid ? (entry.uuid !== onlyUuid) : !entry.applied ) continue;
      const key = `${damageMessage.id}|${entry.uuid}`;
      if ( saveDamageApplications.has(key) ) continue;
      // ANY receipt entry — reverted included — means this pairing is handled: applied by an
      // earlier pass, or applied and then manually reverted by a human whose ↩ the machine
      // must never re-fight. (The legendary-resistance unwind re-applies through
      // applyOneSaveDamage directly, not through this guard.)
      if ( damageMessage.getFlag(MODULE_ID, "receipt")?.targets
        ?.some(t => t.uuid === entry.uuid) ) continue;
      saveDamageApplications.add(key);
      try {
        await applyOneSaveDamage(damageMessage, flag, entry);
      } finally {
        saveDamageApplications.delete(key);
      }
    }
  }
}

/* --- legendary resistance: the one late answer ----------------------------------------------
 * resistSave (npc.mjs) spends the resource and stamps `flags.dnd5e.roll.forceSuccess` onto
 * the SAVE message as an update — strictly after the failure landed, possibly after its
 * consequences did. The elect overturns the verdict: flip the entry, and if consequences
 * already ran, un-apply what the failure applied (receipt-exact) and re-apply what a success
 * grants. This is the corner Phase 2.5 recorded as accepted; Phase 2 owns it.
 * --------------------------------------------------------------------------------------------- */

async function flipForcedSave(rollMessage) {
  try {
    for ( const card of game.messages.contents ) {
      const found = card.getFlag(MODULE_ID, "saves")?.targets?.find(
        t => t.rollMessageId === rollMessage.id);
      if ( !found ) continue;
      if ( found.outcome !== "failed" ) return; // already saved, or already flipped
      // ⚠ THROUGH THE SERIALIZER (core.js): the flip lands while this target's own
      // consequence pass may be mid-flight against the same card, and a clone-mutate-set
      // would overwrite whatever that pass had just recorded. The failed-check repeats
      // INSIDE the lock, so two flips racing the same roll cannot both claim it.
      let flipped = null;
      await queueFlagWrite(card, "saves", current => {
        const entry = current.targets?.find(t => t.rollMessageId === rollMessage.id);
        if ( entry?.outcome !== "failed" ) return false;
        entry.outcome = "saved";
        entry.forced = true;
        // The fail line already posted (v1.19.0) — clear the claim so the CORRECTED verdict
        // announces too. Two lines is honest history: the failure happened, then the
        // resistance overturned it; the forced marker keeps the twin-supersede from eating
        // the correction as a duplicate.
        entry.announced = false;
        flipped = foundry.utils.deepClone(entry);
      });
      if ( !flipped ) return;   // another writer claimed the flip first
      const flag = card.getFlag(MODULE_ID, "saves");   // post-flip, for the verdict line
      const entry = flipped;
      // ALWAYS unwind, whatever `applied` says: the effects pass and the damage pass are
      // independently timed (damage can land through the arrival path before the effects
      // pass marks `applied`), and the receipts are the truth of what actually happened —
      // an unwind over empty receipts is a no-op, and a still-pending consequence pass
      // re-reads the flipped flag after its pause and applies the success path itself.
      await unwindFailedConsequences(card, entry);
      await announceSaveVerdict(card, flag, entry);   // the corrected verdict, forced-marked
      return; // one roll answers one entry
    }
  } catch(err) {
    console.error(`${TITLE} | Legendary-resistance flip failed.`, err);
  }
}

async function unwindFailedConsequences(card, entry) {
  // Effects: remove what only a failure grants; keep what a success would also get. Matched
  // by NAME against the stamped onSave list — fuzzier than ids, but the applied document's
  // id is per-target and the source's isn't, and the realistic case (one effect, no onSave
  // twin) is exact.
  const flag = card.getFlag(MODULE_ID, "saves");
  const keep = new Set(flag?.effectNames?.always ?? []);
  const receipt = card.getFlag(MODULE_ID, "effectReceipt");
  for ( const e of (receipt?.targets?.find(t => t.uuid === entry.uuid)?.effects ?? []) ) {
    if ( e.reverted || keep.has(e.name) ) continue;
    await revertEffect(card, entry.uuid, e.id);
  }
  // Damage: revert the failure's application, then re-apply at the success multiplier
  // DIRECTLY (the reconcile guard treats any receipt entry as handled, so a manual revert
  // sticks — this path is the one deliberate exception, and the merge replaces the reverted
  // entry so the card ends up telling the final truth).
  // ⚠ Lazily bound on purpose: a static import of receipts.js would evaluate it BEFORE this
  // file and register its render row ahead of ours — the ESM order trap. The entry imports
  // saves.js before receipts.js so the verdict row renders above the receipt rows; keep it so.
  const { revertTarget } = await import("./receipts.js");
  for ( const dmg of saveDamageMessages(card) ) {
    const had = dmg.getFlag(MODULE_ID, "receipt")?.targets
      ?.find(t => (t.uuid === entry.uuid) && !t.reverted);
    if ( !had ) continue;
    await revertTarget(dmg, entry.uuid);
    if ( setting(S.autoApply) ) await applyOneSaveDamage(dmg, flag, entry);
  }
}

/* --- the buzzer: expiry rolls, on the elect -------------------------------------------------- */

const saveTimers = new Map();
const armSaveTimer = message => armAskTimer(saveTimers, message, "saves", fireSaveTimer);

async function fireSaveTimer(card) {
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag || (flag.status !== "pending") ) return;
  const goneNames = [];
  for ( const entry of flag.targets ) {
    if ( entry.done ) continue;
    // An unfolded answer beats the clock, not races it.
    const landed = game.messages.find(m => (m.getFlag(MODULE_ID, "respondsTo") === card.id)
      && (m.getFlag(MODULE_ID, "saveFor") === entry.uuid));
    if ( landed ) { void foldSaveAnswer(card, entry.uuid, landed); continue; }
    // A target that no longer exists has nobody to roll — void it, or the demand sits
    // pending forever with a buzzer that already fired (the concentration timer's rule).
    const actor = await fromUuid(entry.uuid).catch(() => null);
    if ( !(actor instanceof Actor) ) {
      // ⚠ THROUGH THE SERIALIZER (core.js): this runs inside a loop over every unanswered
      // target, so the buzzer writes the same card once per vanished target — the writes
      // overlap each other, never mind the consequence passes running alongside.
      let goneName = null;
      await queueFlagWrite(card, "saves", current => {
        const gone = current.targets?.find(t => !t.done && (t.uuid === entry.uuid));
        if ( !gone ) return false;
        gone.done = true;
        gone.outcome = "gone";
        gone.applied = true; // nothing to apply to
        gone.announced = true; // the merged card below is its line — never one per target
        if ( current.targets.every(t => t.done) ) current.status = "done";
        goneName = gone.name;
      });
      if ( goneName ) goneNames.push(goneName);
      continue;
    }
    // A dialog still standing on THIS client is the human's unanswered press: close it first
    // (it resolves to no roll) so the straight roll below is the only answer. Another
    // client's dialog closes off the fold's update, as the house popup always did.
    const open = livePopups.get(popupKey(card.id, `save:${entry.uuid}`));
    if ( open ) { try { await open.close(); } catch { /* already gone */ } }
    // A save the rules fail before the dice is recorded as that failure, not rolled.
    const gate = judgeSave(actor, flag.abilities[0]);
    if ( gate?.autoFail ) { await foldSaveAutoFail(card, entry.uuid, { sources: gate.sources, timedOut: true }); continue; }
    await rollSaveAnswer(card, entry.uuid, { timedOut: true });
  }
  // A "gone" verdict never reaches applySaveConsequences (stamped applied above), so its
  // public line emits here — ONE merged card however many vanished (v1.19.0, FLOW item 7).
  if ( goneNames.length ) {
    await ChatMessage.create({
      speaker: card.speaker,
      content: bfCard({
        img: flag.item?.img ?? null,
        eyebrow: `Saving Throw — ${flag.item?.name ?? "the effect"}`,
        tone: "neutral",
        title: goneNames.length === 1 ? `${goneNames[0]} is gone` : `${goneNames.join(", ")} are gone`,
        subtitle: "nothing to roll — the demand is closed for them"
      }),
      flags: { [MODULE_ID]: { verdictLine: { sourceMessageId: card.id, uuid: "gone" } } }
    }).catch(err => console.error(`${TITLE} | Gone line failed.`, err));
  }
}

/* --- who volunteers: the opt-out's silent roller --------------------------------------------- */

/* --- the answer channels and the resume discipline ------------------------------------------- */

Hooks.on("createChatMessage", message => {
  // A save roll landing: fold it into whatever demand it answers. The demand names its own
  // driver, so the gate moves inside — this hook cannot know the card before it looks (v1.27.2).
  if ( message.getFlag("dnd5e", "roll.type") === "save" ) {
    const found = saveAnsweredBy(message);
    if ( found && drivesMomentFor(found.card.getFlag(MODULE_ID, "saves")?.sourceUuid ?? null) )
      void foldSaveAnswer(found.card, found.uuid, message);
  }
  // The card's damage roll landing: verdicts that already exist apply now; the rest apply
  // as they fold, per target.
  if ( message.getFlag("dnd5e", "roll.type") === "damage" ) {
    const origin = message.getOriginatingMessage?.();
    if ( origin && (origin !== message) && origin.getFlag(MODULE_ID, "saves") ) {
      void reconcileSaveDamage(origin);
    }
  }
});

Hooks.on("updateChatMessage", message => {
  // Legendary resistance: a save flipped to success after the fact.
  if ( (message.getFlag("dnd5e", "roll.type") === "save")
    && (message.getFlag("dnd5e", "roll.forceSuccess") === true) ) {
    void flipForcedSave(message);
  }

  const flag = message.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;
  // Every client closes popups whose decision is made; the timer disarms when nothing is left.
  for ( const t of flag.targets ?? [] ) {
    const dialog = livePopups.get(popupKey(message.id, `save:${t.uuid}`));
    if ( dialog && (t.done || (flag.status !== "pending")) ) void dialog.close();
    // The fold choices' popups close the same way (v1.19.x ⑤/⑥), and their buzzer re-arms.
    const choiceDialog = livePopups.get(popupKey(message.id, `choice:${t.uuid}`));
    if ( choiceDialog && (!t.choice || t.choice.answer) ) void choiceDialog.close();
  }
  armSaveChoiceTimer(message);
  // A DROPPED entry's popup is asking a withdrawn question (the live Shatter strand,
  // 2026-08-17: containment moved the demand off a snapshot target, and the popup sat open
  // with a dead bar and no buzzer ever coming — the buzzer only knows entries that still
  // exist). Sweep every popup for this card whose entry is GONE, and clear its shown-latch
  // so a re-arrival gets a fresh ask. Runs on every client — the popup lives wherever
  // canAnswerFor put it, not where the refresh ran.
  const savePrefix = `${message.id}|save:`;
  for ( const [key, dialog] of [...livePopups] ) {
    if ( !key.startsWith(savePrefix) ) continue;
    const uuid = key.slice(savePrefix.length);
    if ( !(flag.targets ?? []).some(t => t.uuid === uuid) ) void dialog.close();
  }
  // The latch key IS the popup key (the spine), so the dropped-entry sweep un-latches
  // through the same prefix — a re-arrival gets a fresh ask.
  for ( const key of [...shownMoments] ) {
    if ( !key.startsWith(savePrefix) ) continue;
    const uuid = key.slice(savePrefix.length);
    if ( !(flag.targets ?? []).some(t => t.uuid === uuid) ) shownMoments.delete(key);
  }
  if ( flag.status !== "pending" ) disarmAskTimer(saveTimers, message.id);
  else {
    // The demand lands as an UPDATE (the system creates the card, the caster stamps it a
    // beat later), so arrival work rides here as well as on render.
    armSaveTimer(message);
  }
  if ( drivesMomentFor(flag.sourceUuid ?? null) ) {
    for ( const t of flag.targets ?? [] ) {
      if ( t.done && !t.applied ) void applySaveConsequences(message, t.uuid);
    }
    // The sweep's convergent floor (finding ②): a done demand re-offers its spent-area
    // cleanup here, so a one-shot lost to an elect flip lands on the next update.
    if ( flag.status !== "pending" ) void cleanupSpentTemplates(message);
  }
});

// The shown-latches ride ui.js's one delete-sweep; only this machine's clocks disarm here.
Hooks.on("deleteChatMessage", message => {
  disarmAskTimer(saveTimers, message.id);
  disarmSaveChoiceTimer(message.id);
});

/* --- the views: the card row and the dialog -------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const flag = message.getFlag(MODULE_ID, "saves");
  if ( !flag ) return;

  // A WAITING demand (the v1.12.0 targetless template stamp): zero targets, clock unarmed.
  // Say so — a silent card here is indistinguishable from finding ③'s bug — and run the
  // adoption floor on the elect: the CRUD hooks are only fast-paths (the headless ground
  // truth), so a render is what reliably notices the placed area.
  if ( !flag.targets?.length ) {
    if ( flag.status !== "pending" ) return;
    void refreshDemandFromTemplates(message);   // gated on the demand's own driver inside
    const abilityLabel = CONFIG.DND5E.abilities[flag.abilities?.[0]]?.label ?? flag.abilities?.[0] ?? "";
    const row = document.createElement("div");
    row.className = "battleflow-saves";
    row.style.marginTop = "0.35rem";
    const line = document.createElement("div");
    Object.assign(line.style, {
      fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6", fontWeight: "bold", opacity: "0.75"
    });
    line.textContent = `${abilityLabel} save DC ${flag.dc} — waiting for the template's area`;
    row.appendChild(line);
    html.querySelector(".message-content")?.appendChild(row);
    return;
  }

  const row = document.createElement("div");
  row.className = "battleflow-saves";
  row.style.marginTop = "0.35rem";

  const pending = flag.status === "pending";
  const abilityLabel = CONFIG.DND5E.abilities[flag.abilities?.[0]]?.label ?? flag.abilities?.[0] ?? "";

  for ( const t of flag.targets ) {
    const line = document.createElement("div");
    Object.assign(line.style, {
      fontSize: "var(--font-size-11, 11px)", lineHeight: "1.6", fontWeight: "bold"
    });
    if ( t.done ) {
      line.style.opacity = "0.85";
      line.innerHTML = `${t.name} — <span style="color:${t.outcome === "saved"
        ? "var(--dnd5e-color-blue, #3a7ca5)" : "var(--dnd5e-color-maroon, #740b0b)"};">`
        + `${verdictText(flag, t)}</span>`;
    } else {
      const actor = resolveUuid(t.uuid);
      const roller = (actor instanceof Actor) ? rollerUserFor(actor) : null;
      line.style.opacity = "0.75";
      // Since finding (h) the GM's popup really does pop for an offline owner's actor, so
      // naming the roller is true again — the old "the timer (owner offline)" special case
      // described the quiet this fix removed.
      line.textContent = `${t.name} — ${abilityLabel} save DC ${flag.dc}, waiting on ${roller?.name ?? "the GM"}`;
    }
    row.appendChild(line);
    // EVERY pending row runs the demand's bar (v1.11.0, finding ④ — "two timers tick
    // side by side" was the user's expectation on a two-target demand; the single bar
    // under the last row read as that row's alone, with the others' "missing"). Each bar
    // anchors to the same absolute deadline, so the popup pairing and the drift-0 rule
    // are untouched — a resolved row's bar leaves with its pending text.
    if ( pending && !t.done ) {
      const bar = document.createElement("div");
      bar.innerHTML = holdBarHTML(flag, "to roll");
      row.appendChild(bar);
    }
  }

  if ( pending ) {
    scheduleBarSync(row);
    armSaveTimer(message);

    // Resume, stateless (the split discipline): an answer landed while nobody could fold;
    // a verdict landed while nobody could apply; damage landed while nobody could reconcile.
    if ( drivesMomentFor(flag.sourceUuid ?? null) ) {
      // The containment floor: a pending demand follows its area on every render — the
      // template CRUD hooks are only fast-paths (measured unreliable on the headless elect).
      void refreshDemandFromTemplates(message);
      for ( const t of flag.targets ) {
        if ( t.done ) continue;
        const landed = game.messages.find(m => (m.getFlag(MODULE_ID, "respondsTo") === message.id)
          && (m.getFlag(MODULE_ID, "saveFor") === t.uuid));
        if ( landed ) void foldSaveAnswer(message, t.uuid, landed);
      }
    }

    for ( const t of flag.targets ) {
      if ( t.done ) continue;
      const actor = resolveUuid(t.uuid);
      if ( !canAnswerFor(actor) ) continue;
      // v1.19.x finding (h): canAnswerFor ALONE routes the popup. The old extra
      // `isGM && hasPlayerOwner` quiet was mutually exclusive with canAnswerFor's own
      // active-owner check, so a player-owned target with its owner OFFLINE popped for
      // nobody and the buzzer ate the save — the walk's log shows Thomas failing two
      // Fireballs "(timer)" while the solo GM watched the bar. The v1.12.0 ruling ("as a
      // GM i dont care to see other player saves") is UNTOUCHED where it was made: an
      // online owner still excludes the GM inside canAnswerFor.
      // (No pre-roll choice can pend here since walk-5 (y): choices open off the VERDICT,
      // on entries this !t.done loop already skips — the save ask never defers.)
      // CASCADING, NO QUEUE (user, 2026-09-02): every pending demand opens its dialog once,
      // stepped down the staircase; the button recalls this card's dialog regardless.
      const shownKey = popupKey(message.id, `save:${t.uuid}`);
      if ( !shownMoments.has(shownKey) ) {
        shownMoments.add(shownKey);
        void openSaveDialog(message, t.uuid);
      }
      row.appendChild(momentButton(`Roll — ${t.name}`, () => {
        shownMoments.delete(shownKey);
        void openSaveDialog(message, t.uuid);
      }));
    }
  }

  // Fold choices (v1.19.x ⑤/⑥): a pending choice pops for whoever owns its SUBJECT —
  // player-first, GM fallback (finding ①'s routing) — carries its own bar, keeps an Answer
  // recall, and re-arms its buzzer on render. Deliberately OUTSIDE `pending`: choices open
  // after a verdict, so the demand itself may already read resolved.
  let choiceBars = false;
  for ( const t of flag.targets ?? [] ) {
    const c = t.choice;
    if ( !c || c.answer || t.applied ) continue;
    if ( c.deadline ) {
      // momentBarHTML, never holdBarHTML (finding (n)): the sub-object has no status, and
      // the status-gated wrapper rendered "" here for a whole round — the card showed a
      // pending choice with no drain anywhere on screen.
      const bar = document.createElement("div");
      bar.innerHTML = momentBarHTML(c, "to answer");
      row.appendChild(bar);
      choiceBars = true;
    }
    const subject = resolveUuid(c.subjectUuid);
    if ( !canAnswerFor(subject) ) continue;
    const shownKey = popupKey(message.id, `choice:${t.uuid}`);
    if ( !shownMoments.has(shownKey) ) {
      shownMoments.add(shownKey);
      void showSaveChoicePopup(message, t.uuid);
    }
    row.appendChild(momentButton(`Answer — ${c.itemName}`, () => void showSaveChoicePopup(message, t.uuid)));
  }
  if ( choiceBars && !pending ) scheduleBarSync(row);
  armSaveChoiceTimer(message);

  if ( drivesMomentFor(flag.sourceUuid ?? null) ) {
    for ( const t of flag.targets ) {
      if ( t.done && !t.applied ) void applySaveConsequences(message, t.uuid);
    }
    if ( flag.targets.some(t => t.done) ) void reconcileSaveDamage(message);
    // The sweep's convergent floor (finding ②) — render side, the reload-resume twin of
    // the update floor above.
    if ( flag.status !== "pending" ) void cleanupSpentTemplates(message);
  }
  html.querySelector(".message-content")?.appendChild(row);
});

