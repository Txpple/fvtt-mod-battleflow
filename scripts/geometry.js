/**
 * Battle Flow — EDGE layer (ARCHITECTURE.md §2): containment, token distance in FEET and measured
 * cover — the Foundry half; the arithmetic is decide/geometry.js and decide/cover.js.
 * ⚠ No hooks, no flags, no writes.
 */
import { MODULE_ID, TITLE } from "./core.js";
import { measureCover } from "./decide/cover.js";
import { lengthUnitKey, tokenSamplePoints } from "./decide/geometry.js";

/** The roller's own token for this actor: a controlled one first, else the first on the canvas. */
export function tokenOfActor(actor) {
  if ( !actor ) return null;
  const controlled = canvas.tokens?.controlled?.find(t => t.actor?.uuid === actor.uuid);
  if ( controlled ) return controlled;
  try { return actor.getActiveTokens?.(true, false)?.[0] ?? null; } catch { return null; }
}

/** Who could GUARD a token (Interception, Protection): its side, alive, not Incapacitated, within
 * `feet`. A neutral or secret token has no side: nobody.
 * @param {Token} guarded
 * @param {number} feet
 * @param {string[]} [exclude]  actor uuids
 * @returns {Token[]} */
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

/** The canvas token whose actor (linked or synthetic) carries this uuid. */
export function tokenForUuid(uuid) {
  return canvas.tokens?.placeables?.find(t => t.actor?.uuid === uuid) ?? null;
}

/** Every occupied square's center, from the committed SOURCE. ⚠ While a token animates, the
 * document's `x`/`y` are INTERIM; `_source` holds the destination. */
function documentSquares(doc) {
  const grid = doc.parent?.grid?.size;
  if ( !grid ) return [];
  const x = doc._source?.x ?? doc.x, y = doc._source?.y ?? doc.y;
  const w = Math.max(1, Math.round(doc.width ?? 1)), h = Math.max(1, Math.round(doc.height ?? 1));
  if ( (w === 1) && (h === 1) ) return [{ x: x + grid / 2, y: y + grid / 2 }];
  // No `object`, so the pure reader never falls back to the drawn center.
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

/** The shortest grid distance between two tokens' squares, IN FEET; null when unreadable.
 * ⚠ `measurePath` answers in the SCENE's units (a 1.5 m grid reads "3"). */
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


/** The actors in the REGIONS (null = no region, unlike an empty area), by `testInsideRegion` (no
 * canvas needed). ⚠ Never `region.tokens`: a new region has not computed its membership yet. */
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
      entries.push({ uuid, name: tok.name, tokenId: tok.id, disposition: tok.disposition });
    }
  }
  return entries;
}

/** A token's space from its committed SOURCE (see documentSquares), in pixels. */
function spaceOf(doc, grid) {
  const x = doc._source?.x ?? doc.x, y = doc._source?.y ?? doc.y;
  return { x, y, w: (doc.width ?? 1) * grid, h: (doc.height ?? 1) * grid };
}

/** MEASURED COVER (RULINGS *Measured cover*): walls by the MOVE collision test, creatures bar the
 * hidden and dead; null off one scene, on hex, or on a scene flagged `noCover` (the suites' lever:
 * their fixtures stand in a row).
 * @param {Token} attacker
 * @param {Token} target */
export function measuredCoverBetween(attacker, target) {
  try {
    const a = attacker?.document, t = target?.document;
    if ( !a || !t || (a === t) || (a.parent !== t.parent) || !canvas?.grid ) return null;
    if ( canvas.grid.isHexagonal || a.parent?.getFlag?.(MODULE_ID, "noCover") ) return null;
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
