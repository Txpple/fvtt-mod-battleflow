/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the AREAS — a placed template is the demand's authority: adoption
 * (the render floor and the CRUD fast paths), the bare toolbar template's claim, the spent-area
 * sweep and the concentration-ended trigger.
 * The machine-tier pass, Stage 4c (2026-09-05, ruling 3): saves.js became this directory —
 * one flag, one machine, one part per spine step; index.js is the only public face and fixes
 * the registration order. Every body here is the one saves.js carried; nothing was rewritten.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, 
  drivesMomentFor } from "../core.js";
import { resolveUuid } from "../lookup.js";
import { saveTargetEntry } from "../decide/demand.js";
import { tokensInTemplates } from "../geometry.js";
import { saveDemandable, emanationReach } from "./demand.js";

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
export async function refreshDemandFromTemplates(card) {
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
export async function cleanupSpentTemplates(card, { endedConcentrationId = null } = {}) {
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
