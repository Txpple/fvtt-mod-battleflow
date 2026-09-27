/**
 * Battle Flow — EDGE layer (ARCHITECTURE.md §2): area containment and token distance, the half
 * that needs Foundry.
 *
 * Moved verbatim out of saves.js (ARCHITECTURE §10 D5, 2026-08-22; "move, do not rewrite"), then recut for
 * dnd5e 6.0 (phase 3 of the pass): an activity's area is a REGION, and containment is the
 * platform's own `TokenDocument#testInsideRegion` — no template shape is built here any more.
 * EDGE by §2 rule 1 and not by preference: `tokensInRegions` walks a scene's token documents,
 * `nearestFeet` reaches `canvas.grid`. The pure arithmetic they stand on lives one layer down
 * in [decide/geometry.js](decide/geometry.js), where it is unit-tested without Foundry.
 *
 * It lives in its own file rather than saves.js because saves.js exported none of it, and any
 * future area feature needs exactly this and nothing else around it.
 *
 * ⚠ No hooks, no flags, no writes. Nothing here may be given any.
 */
import { TITLE } from "./core.js";
import { measureCover } from "./decide/cover.js";
import { lengthUnitKey, tokenSamplePoints } from "./decide/geometry.js";

/* ---------------------------------------------------------------------------------------------
 * Token distance, in FEET — the readers the reminder gate grew (2026-09-01/02) and the damage
 * service now shares (the 5-foot automatic crit, 2026-09-02). Moved here verbatim from
 * reminders.js the day a second, LOWER layer needed them: a service may not import a machine.
 * ------------------------------------------------------------------------------------------- */

/** The roller's own token for this actor: a controlled one first, else the first on the canvas. */
export function tokenOfActor(actor) {
  if ( !actor ) return null;
  const controlled = canvas.tokens?.controlled?.find(t => t.actor?.uuid === actor.uuid);
  if ( controlled ) return controlled;
  try { return actor.getActiveTokens?.(true, false)?.[0] ?? null; } catch { return null; }
}

/**
 * The creatures that could stand GUARD over a token (the fighting styles, 2026-09-26 — Interception
 * and Protection: "another creature within 5 feet of you"): the tokens on the guarded one's own side
 * of the table (friendly with friendly, hostile with hostile), alive and not Incapacitated, within
 * `feet` of it, bar the `exclude` actors (the guarded creature and the attacker). A neutral or secret
 * guarded token has no side to read, and nobody is asked.
 * @param {Token} guarded
 * @param {number} feet
 * @param {string[]} [exclude]  actor uuids never asked
 * @returns {Token[]}
 */
export function alliesWithin(guarded, feet, exclude = []) {
  const side = guarded?.document?.disposition;
  if ( !guarded || ((side !== 1) && (side !== -1)) ) return [];
  const skip = new Set([guarded.actor?.uuid, ...exclude].filter(Boolean));
  const out = [];
  for ( const other of (canvas.tokens?.placeables ?? []) ) {
    if ( (other === guarded) || (other.document?.disposition !== side) ) continue;
    const actor = other.actor;
    if ( !actor || skip.has(actor.uuid) ) continue;
    if ( ((actor.system?.attributes?.hp?.value ?? 0) <= 0) || actor.statuses?.has?.("incapacitated") ) continue;
    const d = nearestFeet(other, guarded);
    if ( (d !== null) && (d <= feet) ) out.push(other);
  }
  return out;
}

/** The canvas token whose actor carries this uuid — a linked actor's or a token's own synthetic one. */
export function tokenForUuid(uuid) {
  return canvas.tokens?.placeables?.find(t => t.actor?.uuid === uuid) ?? null;
}

/**
 * Every occupied square's center for a token, from its document's SOURCE — the committed
 * position, where the walk ends.
 *
 * ⚠ MEASURED on Foundry 14.367 (the 6.0 pass, 2026-09-15 — tools/probe-auto-crit.mjs): while a
 * token animates a move its document's `x`/`y` are INTERIM, following the drawn token along
 * the path (100 → 370 at 300 ms), and `_source.x`/`y` hold the destination from the moment the
 * update resolves. So neither the drawn object nor the prepared document is `where the token
 * is`; the source is where it is GOING TO STAND, which is what the player who dragged it there
 * and pressed Attack meant. The automatic crit within 5 feet of a Paralyzed victim read a
 * mid-walk position and fired one swing late before this (smoke-battleflow §5e, inverted).
 */
function documentSquares(doc) {
  const grid = doc.parent?.grid?.size;
  if ( !grid ) return [];
  const x = doc._source?.x ?? doc.x, y = doc._source?.y ?? doc.y;
  const w = Math.max(1, Math.round(doc.width ?? 1)), h = Math.max(1, Math.round(doc.height ?? 1));
  if ( (w === 1) && (h === 1) ) return [{ x: x + grid / 2, y: y + grid / 2 }];
  // The larger body's squares, walked from the SAME committed corner (a settled view of the
  // document — no `object`, so the pure reader never falls back to the drawn center).
  return tokenSamplePoints({ parent: doc.parent, width: doc.width, height: doc.height, x, y });
}

/** A length in the scene's or an item's units, as FEET through the system's own table — or null. */
export function feetOf(n, units) {
  const unit = lengthUnitKey(units);
  const value = Number(n);
  if ( !unit || !Number.isFinite(value) ) return null;
  const feet = (unit === "ft") ? value : dnd5e.utils.convertLength(value, unit, "ft", { strict: false });
  return Number.isFinite(feet) ? feet : null;
}

/**
 * The shortest grid distance between two tokens, IN FEET — sample every occupied square of
 * each so a Large body counts from its nearest edge, let the scene's own grid do the measuring,
 * then convert the scene's units to feet through the system's own table. ⚠ `measurePath` answers
 * in the SCENE's units (review finding 5): on a 1.5 m grid two squares read "3", and the rule
 * is 5 FEET. Null when either side cannot be measured, or the scene's units cannot be read —
 * which the decision lists as "distance unknown" rather than guessing.
 */
export function nearestFeet(a, b) {
  try {
    const pa = documentSquares(a.document), pb = documentSquares(b.document);
    if ( !pa.length || !pb.length ) return null;
    let best = Infinity;
    for ( const p of pa ) {
      for ( const q of pb ) {
        const d = canvas.grid.measurePath([p, q]).distance;
        if ( Number.isFinite(d) && (d < best) ) best = d;
      }
    }
    if ( !Number.isFinite(best) ) return null;
    const feet = feetOf(best, canvas.scene?.grid?.units ?? canvas.grid?.units);
    return (feet === null) ? null : Math.round(feet * 10) / 10;
  } catch {
    return null;
  }
}


/**
 * The actors standing in the given REGIONS, as demand-target entries — or null when no region
 * exists (the manual snapshot's case, which must stay distinguishable from "an area with nobody
 * in it", where the demand correctly stamps nothing).
 *
 * dnd5e 6.0 places an activity's area as a Region (`TemplatePlacement.fromActivity`), and
 * Foundry 14 backs every drawn template with one — so containment is the PLATFORM'S OWN test,
 * `TokenDocument#testInsideRegion`: the token's grid-aware containment points against the
 * region's polygon tree, on the region's own scene, from the document's committed SOURCE
 * position (the mid-walk finding in `nearestFeet` above holds here too). No `region.tokens`
 * read: a region just created has not computed its membership yet (empty for the first beat,
 * measured 2026-09-03), and the test needs no canvas at all. Secret tokens stay out of it.
 */
export function tokensInRegions(regions) {
  const docs = (regions ?? []).filter(r => r?.parent && (typeof r.parent.tokens?.filter === "function"));
  if ( !docs.length ) return null;
  const seen = new Set();
  const entries = [];
  for ( const region of docs ) {
    for ( const tok of region.parent.tokens ) {
      if ( tok.isSecret || !tok.actor ) continue;
      let inside = false;
      try { inside = tok.testInsideRegion(region); } catch(err) {
        console.warn(`${TITLE} | Could not test ${tok.name} against an area — counted outside.`, err);
      }
      if ( !inside ) continue;
      const uuid = tok.actor.uuid;
      if ( seen.has(uuid) ) continue;
      seen.add(uuid);
      // The token's id and disposition ride along for the readers that filter by them (an
      // emanation's reach, 2026-09-03); the demand's own entries keep only uuid and name.
      entries.push({ uuid, name: tok.name, tokenId: tok.id, disposition: tok.disposition });
    }
  }
  return entries;
}

/* ---------------------------------------------------------------------------------------------
 * MEASURED COVER (the user, 2026-09-27 — RULINGS *Measured cover*): the 2024 DMG's corner lines
 * between two tokens, counted in decide/cover.js; the map's half read here. Walls are the
 * platform's own MOVE collision test (`CONFIG.Canvas.polygonBackends.move.testCollision`, the call
 * dnd5e's blindsight makes for sight) — a closed door blocks, an open one does not, a one-way wall
 * blocks from its side only, and a window (sight passes, bodies and arrows do not) is cover. The
 * creatures are every other token with an actor on the scene, bar a hidden one (a GM's secret
 * never shows on a player's card) and a dead one.
 * ------------------------------------------------------------------------------------------- */

/** A token's space from its document's committed SOURCE (the mid-walk finding above), in pixels. */
function spaceOf(doc, grid) {
  const x = doc._source?.x ?? doc.x, y = doc._source?.y ?? doc.y;
  return { x, y, w: (doc.width ?? 1) * grid, h: (doc.height ?? 1) * grid };
}

/**
 * The cover `target` has against `attacker`, by the DMG's corner lines — `{degree, by, lines}` from
 * decide/cover.js — or null when it cannot be measured: either token missing, the two on different
 * scenes, or a hex grid (the DMG counts hexes on six corners; not built — RULINGS).
 * @param {Token} attacker
 * @param {Token} target
 */
export function measuredCoverBetween(attacker, target) {
  try {
    const a = attacker?.document, t = target?.document;
    if ( !a || !t || (a === t) || (a.parent !== t.parent) || !canvas?.grid ) return null;
    if ( canvas.grid.isHexagonal ) return null;
    const size = canvas.grid.size;
    const grid = canvas.grid.isGridless ? 0 : size;
    const creatures = [];
    for ( const other of (canvas.tokens?.placeables ?? []) ) {
      const d = other.document;
      if ( !other.actor || (d === a) || (d === t) || d.hidden ) continue;
      if ( other.actor.statuses?.has?.("dead") ) continue;
      creatures.push({ name: other.name, rect: spaceOf(d, size) });
    }
    const backend = CONFIG.Canvas.polygonBackends.move;
    const wallBlocks = (p, q) => !!backend.testCollision(p, q, { type: "move", mode: "any" });
    return measureCover({
      attacker: spaceOf(a, size), target: spaceOf(t, size), grid, creatures, wallBlocks,
      // the platform's test ROUNDS its points to whole pixels — a pull under 2 px can land back on the edge
      inset: Math.max(2, size * 0.03)
    });
  } catch(err) {
    console.warn(`${TITLE} | Cover could not be measured between ${attacker?.name} and ${target?.name}.`, err);
    return null;
  }
}
