// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): MEASURED COVER, the 2024 DMG's corner-line
 * rule on a grid (RULINGS *Measured cover*). Pure: points, rectangles and one injected wall test
 * (geometry.js holds the platform's).
 */

/**
 * The degrees, least protective first. Total carries no bonus: its recorded AC is null (a miss).
 * @typedef {{key: string, label: string, bonus: number|null, status: string|null, img: string}} CoverDegree
 * @typedef {{x:number, y:number}} Point
 * @typedef {{x:number, y:number, w:number, h:number}} Rect
 * @typedef {{rect: Rect, name?: string}} Blocker
 * @type {readonly CoverDegree[]}
 */
export const COVER_DEGREES = Object.freeze([
  Object.freeze({ key: "none", label: "No Cover", bonus: 0, status: null, img: "icons/environment/wilderness/terrain-river-road-gray.webp" }),
  Object.freeze({ key: "half", label: "Half Cover", bonus: 2, status: "coverHalf", img: "icons/environment/settlement/fence-wooden-picket.webp" }),
  Object.freeze({ key: "threeQuarters", label: "Three-Quarters Cover", bonus: 5, status: "coverThreeQuarters", img: "icons/environment/settlement/city-gate.webp" }),
  Object.freeze({ key: "total", label: "Total Cover", bonus: null, status: "coverTotal", img: "icons/environment/settlement/city-wall.webp" })
]);

/** The DMG's count, for a square: 0 lines none, 1–2 Half, 3–4 Three-Quarters. */
export function degreeOfLines(n) {
  if ( n <= 0 ) return 0;
  return (n <= 2) ? 1 : 2;
}

/**
 * A rectangle's corners pulled `inset` inward, so a line never starts or ends ON an obstacle.
 * @param {Rect} r
 * @param {number} inset
 * @returns {Point[]}
 */
export function insetCorners(r, inset) {
  const dx = Math.min(inset, r.w / 2), dy = Math.min(inset, r.h / 2);
  return [
    { x: r.x + dx, y: r.y + dy }, { x: r.x + r.w - dx, y: r.y + dy },
    { x: r.x + r.w - dx, y: r.y + r.h - dy }, { x: r.x + dx, y: r.y + r.h - dy }
  ];
}

/**
 * The squares a creature occupies; gridless (`grid` 0) is one square.
 * @param {Rect} space
 * @param {number} grid
 * @returns {Rect[]}
 */
export function squaresOf(space, grid) {
  const cols = grid > 0 ? Math.round(space.w / grid) : 0, rows = grid > 0 ? Math.round(space.h / grid) : 0;
  if ( (cols < 1) || (rows < 1) || ((cols === 1) && (rows === 1)) ) return [space];
  const out = [];
  for ( let i = 0; i < cols; i++ ) {
    for ( let j = 0; j < rows; j++ ) out.push({ x: space.x + (i * grid), y: space.y + (j * grid), w: grid, h: grid });
  }
  return out;
}

/**
 * Does a→b pass through the OPEN inside of the rectangle (Liang–Barsky)? Grazing does not count.
 * @param {Point} a
 * @param {Point} b
 * @param {Rect} r
 */
export function segmentCrossesRect(a, b, r) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  const ps = [-dx, dx, -dy, dy];
  const qs = [a.x - r.x, (r.x + r.w) - a.x, a.y - r.y, (r.y + r.h) - a.y];
  for ( let i = 0; i < 4; i++ ) {
    const p = /** @type {number} */ (ps[i]), q = /** @type {number} */ (qs[i]);
    if ( p === 0 ) {
      if ( q <= 0 ) return false;   // parallel, on or outside this edge
      continue;
    }
    const t = q / p;
    if ( p < 0 ) { if ( t > t1 ) return false; if ( t > t0 ) t0 = t; }
    else { if ( t < t0 ) return false; if ( t < t1 ) t1 = t; }
  }
  return (t1 - t0) > 1e-9;
}

/**
 * Measure the cover a target has against an attacker; `lines` are the best corner and square's.
 * @param {object} args
 * @param {Rect} args.attacker
 * @param {Rect} args.target
 * @param {number} args.grid     0: gridless
 * @param {Blocker[]} [args.creatures]   every OTHER creature's space
 * @param {(a: Point, b: Point) => boolean} [args.wallBlocks]
 * @param {number} [args.inset]
 * @returns {{degree: CoverDegree, lines: {a: Point, b: Point, wall: boolean, creature: string|null}[], by: string[]}}
 */
export function measureCover({ attacker, target, grid, creatures = [], wallBlocks = () => false, inset = 1 }) {
  const origins = insetCorners(attacker, inset);
  const squares = squaresOf(target, grid);
  const boxes = creatures.map(c => ({ name: c.name ?? "", rect: shrink(c.rect, inset * 2) })).filter(c => c.rect.w > 0 && c.rect.h > 0);
  let best = null;
  let everyLineWalled = true;
  for ( const o of origins ) {
    for ( const sq of squares ) {
      const lines = insetCorners(sq, inset).map(b => {
        const wall = !!wallBlocks(o, b);
        const creature = boxes.find(c => segmentCrossesRect(o, b, c.rect))?.name ?? null;
        return { a: o, b, wall, creature: (creature === null) ? null : creature };
      });
      const walled = lines.filter(l => l.wall).length;
      const blocked = lines.filter(l => l.wall || (l.creature !== null)).length;
      if ( walled < lines.length ) everyLineWalled = false;
      // a creature lifts the square to Half at most (PHB table)
      const degree = Math.max(degreeOfLines(walled), Math.min(1, degreeOfLines(blocked)));
      if ( !best || (degree < best.degree) || ((degree === best.degree) && (blocked < best.blocked)) ) best = { degree, blocked, lines };
    }
  }
  const degreeAt = i => /** @type {CoverDegree} */ (COVER_DEGREES[i]);
  if ( !best ) return { degree: degreeAt(0), lines: [], by: [] };
  const index = everyLineWalled ? 3 : best.degree;
  const by = [];
  if ( best.lines.some(l => l.wall) ) by.push("wall");
  for ( const l of best.lines ) if ( (l.creature !== null) && !by.includes(l.creature) ) by.push(l.creature);
  return { degree: degreeAt(index), lines: best.lines, by: index === 0 ? [] : by };
}

/** @param {Rect} r @param {number} d */
function shrink(r, d) {
  return { x: r.x + d, y: r.y + d, w: r.w - (2 * d), h: r.h - (2 * d) };
}

/**
 * How much the recorded AC must RISE (or `total`): the most protective of measured and carried
 * cover applies, never added.
 * @param {number} carried   dnd5e's `ac.cover` (0, 2 or 5)
 * @param {CoverDegree} measured
 * @returns {{raise: number, total: boolean}}
 */
export function coverAtTheAttack(carried, measured) {
  if ( measured?.key === "total" ) return { raise: 0, total: true };
  const bonus = Number(measured?.bonus) || 0;
  return { raise: Math.max(0, bonus - Math.max(0, Number(carried) || 0)), total: false };
}
