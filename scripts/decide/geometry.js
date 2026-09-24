// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): area and token geometry that needs
 * no Foundry at all.
 *
 * Moved verbatim out of saves.js (ARCHITECTURE §10 D5, 2026-08-22; "move, do not rewrite"), then recut for
 * dnd5e 6.0 (the 6.0 pass, phase 3): an activity's area is a REGION now, and the region's own
 * shapes are the truth — the v14 MeasuredTemplate shim, whose corrupted `distance` this file
 * once worked around with the dnd5e `dimensions` flag (`honestDims`), is no longer on the
 * path. What is left reads fields off document-SHAPED objects and returns plain values — no
 * `game`, no `canvas`, no `CONFIG`, no `PIXI`, no hooks, no flags, no writes — so it is
 * unit-testable in milliseconds. Its callers do need Foundry, and live one layer up in
 * [geometry.js](../geometry.js), which is EDGE for exactly that reason (§2 rule 1).
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js.
 */

/**
 * The Region shape type a dnd5e template type is placed as — the system's `areaTargetTypes`
 * table names the OLD MeasuredTemplate type (`rect`, `ray`, …) and `TemplatePlacement`
 * (dnd5e 6.0.1, `#createShapeData`) maps it onto Foundry 14's shape data: a 5e cube is a
 * `rectangle`, a line a `line`, an emanation an `emanation`; circle, cone and ring keep their
 * names. Null when the type is not one the placement knows — no claim is ever made on it.
 * @param {string|null|undefined} templateType   The `template` of an areaTargetTypes row.
 * @returns {"circle"|"cone"|"rectangle"|"line"|"emanation"|"ring"|null}
 */
export function regionShapeTypeFor(templateType) {
  switch ( templateType ) {
    case "circle": return "circle";
    case "cone": return "cone";
    case "rect":
    case "rectangle": return "rectangle";
    case "ray":
    case "line": return "line";
    case "emanation":
    case "radius": return "emanation";
    case "ring": return "ring";
    default: return null;
  }
}

/**
 * The shape data of an emanation around a token, exactly as dnd5e 6.0.1's `TemplatePlacement`
 * writes it (`#createShapeData` "emanation" + `fromActivity`'s token assignment): a `token`
 * base carrying the token's own position, size and shape, and the radius in PIXELS measured
 * from the base's edge — the 2024 rule, and Foundry 14's `EmanationShapeData`. Built here so
 * the module's own placements (a feature's aura, a listed spell's ring) are byte-for-byte the
 * platform's, and unit-tested against that shape.
 * @param {{x:number, y:number, width:number, height:number, shape?:number|null}} tok   The token document's fields.
 * @param {number} radiusPx   The emanation's radius in pixels.
 * @param {{ shape?: number }} [defaults]   The base shape to use when the token names none (Foundry's RECTANGLE_1 is 0).
 */
export function emanationShapeData(tok, radiusPx, { shape = 0 } = {}) {
  return {
    type: "emanation",
    x: 0, y: 0, rotation: 0,
    base: {
      type: "token", x: tok.x, y: tok.y, rotation: 0,
      width: tok.width, height: tok.height,
      shape: (tok.shape === null || tok.shape === undefined) ? shape : tok.shape
    },
    radius: radiusPx
  };
}

/**
 * The system's length-unit KEY for a scene's grid units, or null when the string is not one
 * this module can read (blank included — a blank is a scene nobody labelled, not feet).
 * Foundry's `scene.grid.units` is a free string dnd5e never maps (its ruler only prints it), so
 * the spellings a table might type are folded here before any conversion; the conversion
 * itself is the system's own table (`dnd5e.utils.convertLength`, CONFIG.DND5E.movementUnits),
 * and belongs to the EDGE. Review finding 5 (2026-09-01): the gate compared a scene-unit
 * distance against a 5-foot literal, so a metric grid's 3 m read as "within 5 feet".
 * @param {string|null|undefined} units
 * @returns {"ft"|"m"|"mi"|"km"|null}
 */
export function lengthUnitKey(units) {
  const u = String(units ?? "").trim().toLowerCase().replace(/\.$/, "");
  if ( ["ft", "feet", "foot", "'"].includes(u) ) return "ft";
  if ( ["m", "meter", "meters", "metre", "metres"].includes(u) ) return "m";
  if ( ["mi", "mile", "miles"].includes(u) ) return "mi";
  if ( ["km", "kilometer", "kilometers", "kilometre", "kilometres"].includes(u) ) return "km";
  return null;
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
