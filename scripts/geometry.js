/**
 * Battle Flow — EDGE layer (ARCHITECTURE.md §2): template containment, the half that needs
 * Foundry.
 *
 * Moved verbatim out of saves.js (PLAN.md Phase 2, "move, do not rewrite"). These two are
 * EDGE by §2 rule 1 and not by preference — `templateShape` reaches `canvas`, `CONFIG` and
 * `PIXI`, and `tokensInTemplates` walks a scene's token documents. The pure arithmetic they
 * stand on lives one layer down in [decide/geometry.js](decide/geometry.js), where it is
 * unit-tested without Foundry.
 *
 * It lives in its own file rather than saves.js because saves.js exported none of it while
 * holding the trickiest platform knowledge in the tree (the v14 region shim), and any future
 * area feature needs exactly this and nothing else around it.
 *
 * ⚠ No hooks, no flags, no writes. Nothing here may be given any.
 */
import { TITLE } from "./core.js";
import { honestDims, lengthUnitKey, tokenSamplePoints } from "./decide/geometry.js";

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

/** The canvas token whose actor carries this uuid — a linked actor's or a token's own synthetic one. */
export function tokenForUuid(uuid) {
  return canvas.tokens?.placeables?.find(t => t.actor?.uuid === uuid) ?? null;
}

/**
 * Every occupied square's center for a token, from its DOCUMENT — the authoritative position.
 * `tokenSamplePoints` reads the drawn object's center for a 1×1 body, and a drawn token lags
 * its document while it animates a move; a rule is judged where the token IS, not where it is
 * still walking from.
 */
function documentSquares(doc) {
  const grid = doc.parent?.grid?.size;
  if ( !grid ) return [];
  const w = Math.max(1, Math.round(doc.width ?? 1)), h = Math.max(1, Math.round(doc.height ?? 1));
  if ( (w === 1) && (h === 1) ) return [{ x: doc.x + grid / 2, y: doc.y + grid / 2 }];
  return tokenSamplePoints(doc);
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
 * The actors standing in the given templates, as demand-target entries — or null when no
 * template exists (the manual snapshot's case, which must stay distinguishable from "a
 * template with nobody in it", where the demand correctly stamps nothing). Center-point
 * containment on the template's own scene; secret tokens stay out of it.
 */
export function tokensInTemplates(templates) {
  const docs = (templates ?? []).filter(t => t?.parent && templateShape(t));
  if ( !docs.length ) return null;
  const seen = new Set();
  const entries = [];
  for ( const doc of docs ) {
    const shape = templateShape(doc);
    for ( const tok of doc.parent.tokens ) {
      if ( tok.isSecret || !tok.actor ) continue;
      const pts = tokenSamplePoints(tok);
      if ( !pts.some(p => shape.contains(p.x - doc.x, p.y - doc.y)) ) continue;
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

/** The template's shape — honest dnd5e dimensions when stamped (the shim note in
 * decide/geometry.js), else the drawn object's, else core's own shape builders (deprecated
 * since v14, until 16 — migrate to ShapeData when 16 lands; current-scene only), else
 * Euclidean math. The fallback ladder below the rescue is v1.13.0's, kept for toolbar-drawn
 * and foreign templates that carry no dimensions flag. */
function templateShape(doc) {
  const honest = honestDims(doc);
  const distance = honest?.distance ?? doc.distance ?? 0;
  const width = honest?.width ?? doc.width ?? 0;
  if ( !honest && doc.object?.shape ) return doc.object.shape;
  if ( (doc.parent === canvas?.scene) && canvas?.dimensions?.distancePixels ) {
    try {
      const cls = CONFIG.MeasuredTemplate?.objectClass;
      switch ( doc.t ) {
        case "circle": return cls.getCircleShape(distance);
        case "rect": return cls.getRectShape(distance, doc.direction ?? 0);
        case "cone": return cls.getConeShape(distance, doc.direction ?? 0,
          doc.angle || CONFIG.MeasuredTemplate?.defaults?.angle || 53.13);
        case "ray": return cls.getRayShape(distance, doc.direction ?? 0, width);
      }
    } catch(err) {
      console.warn(`${TITLE} | Core template shape builder failed; using Euclidean fallback.`, err);
    }
  }
  const grid = doc.parent?.grid;
  if ( !grid?.size || !grid?.distance ) return null;
  const d = distance * (grid.size / grid.distance);
  const dir = Math.toRadians(doc.direction ?? 0);
  switch ( doc.t ) {
    case "circle": return new PIXI.Circle(0, 0, d);
    case "rect": {
      const dx = Math.cos(dir) * d, dy = Math.sin(dir) * d;
      return new PIXI.Rectangle(Math.min(0, dx), Math.min(0, dy), Math.abs(dx), Math.abs(dy));
    }
    case "ray": {
      const w = width * (grid.size / grid.distance);
      const dx = Math.cos(dir), dy = Math.sin(dir);
      const ox = -dy * (w / 2), oy = dx * (w / 2);
      return new PIXI.Polygon([ox, oy, dx * d + ox, dy * d + oy, dx * d - ox, dy * d - oy, -ox, -oy]);
    }
    case "cone": {
      const angle = Math.toRadians(doc.angle || 53.13);
      const points = [0, 0];
      const steps = 12;
      for ( let i = 0; i <= steps; i++ ) {
        const a = dir - (angle / 2) + (angle * i / steps);
        points.push(Math.cos(a) * d, Math.sin(a) * d);
      }
      return new PIXI.Polygon(points);
    }
  }
  return null;
}
