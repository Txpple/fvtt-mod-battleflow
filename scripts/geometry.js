/**
 * Battle Flow — EDGE layer (ARCHITECTURE.md §2): area containment, token distance and measured
 * cover — the half that needs Foundry (token documents, `canvas.grid`, wall collision). The pure
 * arithmetic lives in decide/geometry.js and decide/cover.js.
 *
 * ⚠ No hooks, no flags, no writes. Nothing here may be given any.
 */
import { TITLE } from "./core.js";
import { measureCover } from "./decide/cover.js";
import { lengthUnitKey, tokenSamplePoints } from "./decide/geometry.js";

/* ---------------------------------------------------------------------------------------------
 * Token distance, in FEET — shared by the reminder gate and the damage service (the 5-foot
 * automatic crit); here because a service may not import a machine.
 * ------------------------------------------------------------------------------------------- */

/** The roller's own token for this actor: a controlled one first, else the first on the canvas. */
export function tokenOfActor(actor) {
  if ( !actor ) return null;
  const controlled = canvas.tokens?.controlled?.find(t => t.actor?.uuid === actor.uuid);
  if ( controlled ) return controlled;
  try { return actor.getActiveTokens?.(true, false)?.[0] ?? null; } catch { return null; }
}

/**
 * The creatures that could stand GUARD over a token (Interception, Protection): tokens on the
 * guarded one's side (friendly with friendly, hostile with hostile), alive and not Incapacitated,
 * within `feet`, bar the `exclude` actors. A neutral or secret guarded token has no side: nobody.
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
 * ⚠ While a token animates a move, its document's `x`/`y` are INTERIM (they follow the drawn
 * token); `_source.x`/`y` hold the destination as soon as the update resolves. Read the source.
 */
function documentSquares(doc) {
  const grid = doc.parent?.grid?.size;
  if ( !grid ) return [];
  const x = doc._source?.x ?? doc.x, y = doc._source?.y ?? doc.y;
  const w = Math.max(1, Math.round(doc.width ?? 1)), h = Math.max(1, Math.round(doc.height ?? 1));
  if ( (w === 1) && (h === 1) ) return [{ x: x + grid / 2, y: y + grid / 2 }];
  // The larger body's squares from the same committed corner — no `object`, so the pure reader
  // never falls back to the drawn center.
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
 * The shortest grid distance between two tokens, IN FEET — every occupied square of each, so a
 * Large body counts from its nearest edge, measured by the scene's grid.
 * ⚠ `measurePath` answers in the SCENE's units (a 1.5 m grid reads "3"); convert to feet. Null
 * when either side or the units cannot be read — the decision lists "distance unknown".
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
 * exists (distinct from "an area with nobody in it"). Containment is the platform's own
 * `TokenDocument#testInsideRegion`, which needs no canvas.
 * ⚠ Never `region.tokens`: a region just created has not computed its membership yet. Secret
 * tokens stay out.
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
      // emanation's reach); the demand's own entries keep only uuid and name.
      entries.push({ uuid, name: tok.name, tokenId: tok.id, disposition: tok.disposition });
    }
  }
  return entries;
}

/* ---------------------------------------------------------------------------------------------
 * MEASURED COVER (RULINGS *Measured cover*): the DMG's corner lines between two tokens, counted
 * in decide/cover.js; the map's half read here. Walls are the platform's MOVE collision test — a
 * closed door blocks, an open one does not, a one-way wall from its side only, a window is cover.
 * The creatures are every other token with an actor, bar a hidden one and a dead one.
 * ------------------------------------------------------------------------------------------- */

/** A token's space from its document's committed SOURCE (see documentSquares), in pixels. */
function spaceOf(doc, grid) {
  const x = doc._source?.x ?? doc.x, y = doc._source?.y ?? doc.y;
  return { x, y, w: (doc.width ?? 1) * grid, h: (doc.height ?? 1) * grid };
}

/**
 * The cover `target` has against `attacker`, by the DMG's corner lines — `{degree, by, lines}` from
 * decide/cover.js — or null when it cannot be measured: either token missing, the two on different
 * scenes, or a hex grid (not built — RULINGS *Measured cover*).
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
