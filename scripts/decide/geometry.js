// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): template and token geometry that needs
 * no Foundry at all.
 *
 * Moved verbatim out of saves.js (PLAN.md Phase 2, "move, do not rewrite"). These three read
 * fields off document-SHAPED objects and return plain values — no `game`, no `canvas`, no
 * `CONFIG`, no `PIXI`, no hooks, no flags, no writes — so they are unit-testable in
 * milliseconds. Their two callers do need Foundry, and live one layer up in
 * [geometry.js](../geometry.js), which is EDGE for exactly that reason (§2 rule 1).
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js.
 */

/**
 * ⚠⚠ THE v14 REGION-SHIM GROUND TRUTH (the v1.13.0 walk's finding ①, probes 7–9,
 * 2026-08-17): Foundry 14 shims MeasuredTemplates onto Regions, and this build's CREATE
 * round-trip corrupts the stored units — `distance` comes back ×(gridSize/100) (×1.4 on a
 * 140px grid, ×0.7 on 70px, invisible on the 100px test range) and `width` comes back as
 * RAW PIXELS. The client pipeline is clean (probe 8: local clean/validate leaves values
 * untouched); the scaling happens server-side. The renderer draws from the same lying
 * field, so the PLACED area (shape, highlight, and any doc-math) is uniformly oversized —
 * only the dnd5e `dimensions` flag survives honest, because fromActivity stamps the
 * spell's own size and the shim never touches flags.
 *
 * So: SPELL-TRUTH FIRST. When the placement stamped honest dimensions, geometry is built
 * from them — the demand matches the 20 ft cube the caster cast and the honest preview
 * they aimed, not the corrupted stored field. This deliberately supersedes the
 * drawn-shape-first rule (standing item 17) while the shim lies: the drawn object IS the
 * corrupted doc. Self-healing — once upstream fixes the shim, doc.distance equals the
 * dimensions-derived value and every branch agrees again. adjustedSize placements
 * (emanations sized up by token) keep doc math: their final size lives only in distance.
 */
export function honestDims(doc) {
  const dim = doc.flags?.dnd5e?.dimensions;
  if ( !(dim?.size > 0) || dim.adjustedSize ) return null;
  if ( (doc.t === "ray") && !(dim.width > 0) ) return null;
  return {
    // A dnd5e cube rides a rect drawn corner-to-corner: distance is the diagonal.
    distance: (doc.t === "rect") ? Math.hypot(dim.size, dim.size) : dim.size,
    width: (doc.t === "ray") ? dim.width : (doc.width ?? 0)
  };
}

/** A token's center from its document alone — object.center when drawn, geometry otherwise. */
export function tokenCenter(tok) {
  if ( tok.object ) return tok.object.center;
  const grid = tok.parent?.grid?.size;
  if ( !grid ) return null;
  return { x: tok.x + (tok.width * grid) / 2, y: tok.y + (tok.height * grid) / 2 };
}

/** Every occupied grid square's center for a token — the 5e "does the area touch you on
 * the grid" question, one sample per square (midi-qol's long-standing model). A large
 * token counts when ANY of its squares stands in the area — center-only testing missed a
 * 2×2 body half inside. Sub-square tokens keep the single center sample. */
export function tokenSamplePoints(tok) {
  const grid = tok.parent?.grid?.size;
  if ( !grid ) return [];
  const w = Math.round(tok.width ?? 1), h = Math.round(tok.height ?? 1);
  if ( (w < 1) || (h < 1) || ((w === 1) && (h === 1)) ) {
    const c = tokenCenter(tok);
    return c ? [c] : [];
  }
  const points = [];
  for ( let i = 0; i < w; i++ ) {
    for ( let j = 0; j < h; j++ ) points.push({ x: tok.x + ((i + 0.5) * grid), y: tok.y + ((j + 0.5) * grid) });
  }
  return points;
}
