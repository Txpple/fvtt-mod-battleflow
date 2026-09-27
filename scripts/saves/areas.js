/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the AREAS — a placed
 * area is the demand's authority: adoption (the render floor and the Region CRUD fast paths),
 * the toolbar area's claim, the spent-area sweep and the concentration-ended trigger.
 *
 * The area is a REGION: dnd5e's placement stamps `flags.dnd5e.activity` (the ACTIVITY uuid —
 * the tie every path here keys on), and even a toolbar-drawn template is a Region
 * (`flags.core.MeasuredTemplate`). Containment is the platform's own test (geometry.js
 * `tokensInRegions`); the card's render is the reliability floor.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite,
  drivesMomentFor } from "../core.js";
import { cardActivity } from "../lookup.js";
import { saveTargetEntry } from "../decide/demand.js";
import { regionShapeTypeFor } from "../decide/geometry.js";
import { tokensInRegions } from "../geometry.js";
import { saveDemandable, emanationReach, metamagicForDemand, areaChoiceForDemand } from "./demand.js";
import { spentAreaListed } from "../settings.js";

/** The activity a region was placed for — the tie every path here keys on. */
const activityOfRegion = region => region?.getFlag?.("dnd5e", "activity") ?? null;

/** Every region on any scene that this activity placed — the activity flag is the tie. */
function regionsForActivity(activityUuid) {
  const found = [];
  for ( const scene of game.scenes ) {
    for ( const r of scene.regions ) {
      if ( activityOfRegion(r) === activityUuid ) found.push(r);
    }
  }
  return found;
}

/** The Region shape type a demand's area will wear (cube → rectangle &c.), through the system's
 * own map. Null when the demand has no templateType or the type is unmapped: no toolbar adoption. */
function expectedShapeType(flag) {
  if ( !flag.templateType ) return null;
  return regionShapeTypeFor(CONFIG.DND5E?.areaTargetTypes?.[flag.templateType]?.template ?? null);
}

/** A region the TOOLBAR drew: Foundry 14's own template shim marks it, and no activity owns it. */
const isBareTemplate = region => !!region.getFlag("core", "MeasuredTemplate") && !activityOfRegion(region);

/**
 * A waiting demand may CLAIM a toolbar-drawn area (it carries no activity flag): the newest
 * unowned template of the expected shape, on the elect's CURRENT scene only — `createdTime` is
 * not always readable, so the scene is the second wall against fossils. The claim stamps the
 * activity flag, after which the region behaves exactly like a dialog placement.
 */
async function claimBareRegion(card, flag) {
  const expected = expectedShapeType(flag);
  if ( !expected ) return null;
  const here = canvas?.scene;
  if ( !here ) return null;
  const candidates = [];
  for ( const r of here.regions ) {
    if ( !isBareTemplate(r) ) continue;
    if ( r.shapes?.[0]?.type !== expected ) continue;
    const born = r._stats?.createdTime ?? r._source?._stats?.createdTime ?? null;
    if ( born && (born < card.timestamp) ) continue; // predates the cast — decoration
    candidates.push({ r, born: born ?? 0 });
  }
  if ( !candidates.length ) return null;
  candidates.sort((a, b) => a.born - b.born);
  const region = candidates.at(-1).r;
  await region.setFlag("dnd5e", "activity", flag.activityUuid);
  return region;
}

/** Same-client latch: one containment refresh in flight per card, and ONE re-run queued behind
 * it. ⚠ The render floor and the createRegion fast path land in the same beat at the cast; a
 * refresh in flight read "no region yet", so a dropped request would leave the demand empty. */
const templateRefreshes = new Map();   // card id → { again: boolean }

/**
 * Re-derive a live demand's target set from its regions — the area is the authority both ways:
 * done entries keep their verdicts, pending entries outside drop, new arrivals join. Elect
 * write; idempotent (no region ⇒ no-op, an unchanged set writes nothing).
 * ⚠ The render hook is the floor: the placement's create event fires BEFORE the stamp exists.
 * Never await canvas readiness here — containment reads the region document's own geometry.
 */
export async function refreshDemandFromTemplates(card) {
  if ( !setting(S.saves) ) return;
  if ( !drivesMomentFor(card.getFlag(MODULE_ID, "saves")?.sourceUuid ?? null) ) return;
  const inFlight = templateRefreshes.get(card.id);
  if ( inFlight ) { inFlight.again = true; return; }
  const latch = { again: false };
  templateRefreshes.set(card.id, latch);
  try {
    const flag = card.getFlag(MODULE_ID, "saves");
    if ( flag?.status !== "pending" ) return;
    // An emanation's triggered demand names ONE creature and shares the cast's activity — the
    // area is not its authority.
    if ( flag.pinnedTargets ) return;
    // A WAITING demand (zero targets) exists precisely so the area can deliver its targets.
    const wasWaiting = !(flag.targets ?? []).length;
    if ( !wasWaiting && !(flag.targets ?? []).some(t => !t.done) ) return;
    if ( wasWaiting ) {
      // ⚠ The NEWEST same-activity cast owns the area — ANY newer cast disarms this one, not
      // only a newer one still waiting: once the newer adopts, the claimed region carries the
      // shared activity uuid and this older card would match it too, and both would apply.
      const newer = game.messages.contents.some(m => {
        if ( (m.id === card.id) || (m.timestamp <= card.timestamp) ) return false;
        const f = m.getFlag(MODULE_ID, "saves");
        return (f?.activityUuid === flag.activityUuid) && !f.pinnedTargets;   // a triggered demand is not a cast
      });
      if ( newer ) return;
    }
    let regions = regionsForActivity(flag.activityUuid);
    // Nothing activity-tied: a waiting demand may claim a toolbar-drawn area (once per region).
    if ( !regions.length && wasWaiting ) {
      const claimed = await claimBareRegion(card, flag);
      if ( claimed ) regions = [claimed];
    }
    if ( !regions.length ) return;
    const activity = cardActivity(card, flag.activityUuid);
    // A spell that chooses its targets (CHOSEN_AREAS): only the chosen join — asked when the area
    // lands, filtered to the answer on every re-read after.
    const choice = await areaChoiceForDemand(card, activity, emanationReach(activity, tokensInRegions(regions)) ?? []);
    if ( choice.hold ) return;   // the caster is being asked who the area affects — waiting keeps waiting
    const contained = choice.contained ?? [];
    // Careful's protected creatures never join; Heightened's mark joins the demand.
    const metamagic = await metamagicForDemand(card, activity, contained);
    if ( metamagic.hold ) return;   // the caster is being asked who the area spares — waiting keeps waiting
    // ⚠ THROUGH THE SERIALIZER, with the derivation INSIDE it: the `flag` read above is stale
    // after the awaits, and rebuilding from it would drop a save answer that folded in meanwhile
    // and re-demand a target that already rolled.
    await queueFlagWrite(card, "saves", current => {
      // ⚠ Re-read the status too: the buzzer can close the demand during the awaits, and a
      // creature appended to a DONE demand would owe a save forever and block the area sweep.
      if ( current.status !== "pending" ) return false;
      const prev = current.targets ?? [];
      const done = prev.filter(t => t.done);
      const keep = prev.filter(t => !t.done && contained.some(c => c.uuid === t.uuid) && !metamagic.protectedUuids.has(t.uuid));
      const fresh = contained.filter(c => !prev.some(t => t.uuid === c.uuid)).filter(c => !metamagic.protectedUuids.has(c.uuid))
        // A corpse standing in the area never joins the demand.
        .filter(saveDemandable)
        .map(c => saveTargetEntry(c.uuid, c.name));
      // No choice stamps at adoption: Interpose opens off the verdict, as for a snapshot target.
      const next = [...done, ...keep, ...fresh];
      if ( metamagic.heightened && (current.demand?.heightened?.uuid !== metamagic.heightened.uuid) ) current.demand = { ...(current.demand ?? {}), heightened: metamagic.heightened };
      if ( !next.length ) return false; // waiting keeps waiting; a populated one never strands
      // ⚠ `return false` is LOOP PROTECTION: this runs from the render hook, so an unconditional
      // write would be write → render → write without end.
      const same = current.templated && (next.length === prev.length)
        && prev.every((t, i) => next[i]?.uuid === t.uuid);
      if ( same ) return false;
      // Re-read from `current`, not `wasWaiting`: targets that arrived during the awaits mean the
      // clock has already started.
      const stillWaiting = !prev.length;
      current.templated = true;
      current.targets = next;
      // The first arrivals start the clock a waiting stamp withheld: the full window from now.
      if ( stillWaiting ) {
        current.awaitingTemplate = false;
        if ( current.window && !current.deadline ) current.deadline = Date.now() + (current.window * 1000);
      }
    });
  } catch(err) {
    console.error(`${TITLE} | Area containment refresh failed.`, err);
  } finally {
    templateRefreshes.delete(card.id);
    if ( latch.again ) void refreshDemandFromTemplates(card);
  }
}

/** The CRUD fast-path: when a region appears or its shapes move, refresh the newest live demand.
 * An unowned toolbar template is offered to the newest WAITING demand expecting its shape. */
function refreshTemplatedDemands(region) {
  if ( !setting(S.saves) ) return;
  const origin = activityOfRegion(region);
  const bare = isBareTemplate(region);
  if ( !origin && !bare ) return;   // somebody's region, nobody's area — a feature aura, a hazard, a door
  const live = game.messages.contents.filter(m => {
    const f = m.getFlag(MODULE_ID, "saves");
    if ( (f?.status !== "pending") || f.pinnedTargets ) return false;
    if ( origin ) return (f.activityUuid === origin)
      // Undone targets, or a WAITING demand (zero targets) whose area just arrived.
      && (!(f.targets ?? []).length || (f.targets ?? []).some(t => !t.done));
    return !(f.targets ?? []).length && (expectedShapeType(f) === region.shapes?.[0]?.type);
  }).sort((a, b) => a.timestamp - b.timestamp);
  const card = live.at(-1);
  if ( card ) void refreshDemandFromTemplates(card);
}
Hooks.on("createRegion", region => { refreshTemplatedDemands(region); });
Hooks.on("updateRegion", (region, changes) => {
  // The area moved (Moonbeam walks; an attached ring follows its token), or was just claimed.
  if ( ("shapes" in changes) || ("attachment" in changes) || (changes.flags?.dnd5e && ("activity" in changes.flags.dnd5e)) ) refreshTemplatedDemands(region);
});

/** The sweep's same-client re-entry latch (see cleanupSpentTemplates). */
const templateSweepsInFlight = new Set();

/**
 * Remove a spent area once every verdict's consequences landed. Instantaneous: spent at the last
 * consequence. Concentration: spent when the caster no longer wears the usage card's
 * concentration effect (a dnd5e region is not a concentration dependent, so nothing else takes
 * it down). A Spent Areas-listed name: spent at the last verdict whatever its data says. Any
 * other duration area stays the GM's to clear.
 *
 * A CONVERGENT floor: the consequence pass, the update and the render all offer it, so a lost
 * one-shot (an elect flip mid-chain) converges on the next render.
 * ⚠ The newest-cast wall: a re-cast reuses the activity uuid, so any newer same-activity card
 * disarms this card's sweep, or it would delete the current cast's area.
 */
export async function cleanupSpentTemplates(card, { endedConcentrationId = null } = {}) {
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag?.templated ) return;
  // On a CLOSED demand an entry with no verdict is an orphan no clock will ask — it does not
  // hold the area up.
  const closed = flag.status === "done";
  if ( !(flag.targets ?? []).every(t => (t.done && (t.applied || (t.outcome === "gone"))) || (closed && !t.done)) ) return;
  if ( (flag.durationUnits !== "inst") && !spentAreaListed(flag.item?.name) ) {
    const concId = card.system?.concentration;
    if ( !concId ) return;
    // ⚠ Trust the hook's hint for the just-ended case: `deleteActiveEffect` can fire while the
    // effect is still in the parent's collection. The live read is for the floor's later
    // re-offers, where the collection is settled.
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
  // ⚠ ONE SWEEP IN FLIGHT PER CARD: a concurrent second delete raises "Region does not exist"
  // as a UI notification the catch below never sees.
  if ( templateSweepsInFlight.has(card.id) ) return;
  templateSweepsInFlight.add(card.id);
  try {
    for ( const scene of game.scenes ) {
      const spent = scene.regions.filter(r => activityOfRegion(r) === flag.activityUuid);
      // Tolerate another cleanup deleting the same documents first.
      try {
        if ( spent.length ) await scene.deleteEmbeddedDocuments("Region", spent.map(r => r.id));
      } catch { /* already gone — the other elect twin got there */ }
    }
  } finally {
    templateSweepsInFlight.delete(card.id);
  }
}

/* The duration half's trigger: when a concentration effect is deleted, re-offer the sweep to
 * every templated demand whose usage card carries that concentration id. The render/update
 * floors remain the backstop; this makes the common case immediate. */
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
