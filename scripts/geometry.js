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
import { honestDims, tokenSamplePoints } from "./decide/geometry.js";

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
      entries.push({ uuid, name: tok.name });
    }
  }
  return entries;
}

/** The template's shape — honest dnd5e dimensions when stamped (the shim note in
 * decide/geometry.js), else the drawn object's, else core's own shape builders (deprecated
 * since v14, until 16 — migrate to ShapeData when 16 lands; current-scene only), else
 * Euclidean math. The fallback ladder below the rescue is v1.13.0's, kept for toolbar-drawn
 * and foreign templates that carry no dimensions flag. */
export function templateShape(doc) {
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
