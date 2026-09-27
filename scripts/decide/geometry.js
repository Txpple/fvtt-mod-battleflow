// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): area and token geometry that needs
 * no Foundry at all. An activity's area is a REGION, and its shapes are the truth. Reads fields
 * off document-SHAPED objects and returns plain values; the Foundry-facing callers live in
 * [geometry.js](../geometry.js), the EDGE.
 *
 * ⚠ Depend downward only: nothing here may import a machine, the spine, or core.js.
 */

/**
 * The Region shape type a dnd5e template type is placed as (`TemplatePlacement#createShapeData`):
 * `rect` → `rectangle`, `ray` → `line`, `radius` → `emanation`; the others keep their names.
 * Null for a type the placement does not know.
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
 * The shape data of an emanation around a token, exactly as dnd5e's `TemplatePlacement` writes it:
 * a `token` base (position, size, shape) and the radius in PIXELS from the base's edge. The
 * module's own placements must match the platform's byte for byte.
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
 * The system's length-unit KEY for a scene's grid units, or null (blank included: unlabelled is
 * not feet). `scene.grid.units` is a free string dnd5e never maps, so typed spellings are folded
 * here; the conversion (`dnd5e.utils.convertLength`) belongs to the EDGE.
 * ⚠ Never compare a scene-unit distance with a feet literal: a metric 3 m is not "within 5 feet".
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

/** Every occupied grid square's center for a token, one sample per square: a large token counts
 * when ANY square is in the area. Sub-square tokens keep the single center sample. */
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
