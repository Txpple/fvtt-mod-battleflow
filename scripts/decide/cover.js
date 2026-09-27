// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): MEASURED COVER, the 2024 DMG's corner-line
 * rule on a grid (RULINGS *Measured cover*): from one corner of the attacker's space to every
 * corner of one target square, 1–2 blocked lines Half, 3–4 Three-Quarters; a creature lifts it to
 * Half at most (PHB table); the attacker picks the corner and square, so the LEAST cover wins; every
 * line walled is Total. A line that only grazes an obstacle does not count.
 * Pure: points, rectangles and one injected wall test (geometry.js holds the platform's). Imports
 * nothing.
 */

/**
 * The degrees, in the order "more protective" runs. The bonus is dnd5e's own `coverBonus`; Total
 * carries none — the recorded AC is null (a miss), as dnd5e records it. Icons from Foundry's own
 * library.
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
 * The corners of a rectangle, each pulled `inset` toward its middle, so a line never starts or
 * ends ON an obstacle.
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
 * The squares a creature occupies, as rectangles. A space under one square, or a gridless scene
 * (`grid` 0), is one square.
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
 * Does the segment a→b pass through the OPEN inside of the rectangle (Liang–Barsky, clipped)? A
 * segment that only runs along an edge or touches a corner does not.
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
 * Measure the cover a target has against an attacker, by the DMG's corner lines.
 * @param {object} args
 * @param {Rect} args.attacker   the attacker's space
 * @param {Rect} args.target     the target's space
 * @param {number} args.grid     the grid's square size (0: gridless — each space is one square)
 * @param {Blocker[]} [args.creatures]   every OTHER creature's space (attacker and target left out)
 * @param {(a: Point, b: Point) => boolean} [args.wallBlocks]   does a wall stop the line a→b?
 * @param {number} [args.inset]   how far a corner is pulled inside its square, and a creature's box inside its edges
 * @returns {{degree: CoverDegree, lines: {a: Point, b: Point, wall: boolean, creature: string|null}[], by: string[]}}
 *   the degree; the lines of the attacker's best corner and square (what a picture would draw); who and what blocked them
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
      // an object's lines count to Three-Quarters; a creature's lift the square to Half at most (PHB table)
      const degree = Math.max(degreeOfLines(walled), Math.min(1, degreeOfLines(blocked)));
      if ( !best || (degree < best.degree) || ((degree === best.degree) && (blocked < best.blocked)) ) best = { degree, blocked, lines };
    }
  }
  const degreeAt = i => /** @type {CoverDegree} */ (COVER_DEGREES[i]);
  if ( !best ) return { degree: degreeAt(0), lines: [], by: [] };
  const index = everyLineWalled ? 3 : best.degree;
  const by = [];
  if ( best.lines.some(l => l.wall) ) by.push("wall");
  // every creature a blocked line crosses is named, a walled line's too
  for ( const l of best.lines ) if ( (l.creature !== null) && !by.includes(l.creature) ) by.push(l.creature);
  return { degree: degreeAt(index), lines: best.lines, by: index === 0 ? [] : by };
}

/** @param {Rect} r @param {number} d */
function shrink(r, d) {
  return { x: r.x + d, y: r.y + d, w: r.w - (2 * d), h: r.h - (2 * d) };
}

/**
 * What the attack records against one target: the measured degree beside the cover its AC already
 * carries (dnd5e's `ac.cover`) — the most protective applies, never added. How much the recorded
 * AC must RISE, or `total`.
 * @param {number} carried   the cover bonus the recorded AC already holds (0, 2 or 5)
 * @param {CoverDegree} measured
 * @returns {{raise: number, total: boolean}}
 */
export function coverAtTheAttack(carried, measured) {
  if ( measured?.key === "total" ) return { raise: 0, total: true };
  const bonus = Number(measured?.bonus) || 0;
  return { raise: Math.max(0, bonus - Math.max(0, Number(carried) || 0)), total: false };
}
