// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): MEASURED COVER, the 2024 rule on a grid.
 *
 * The user, 2026-09-27: "a person selects an actor token. when they hover over other tokens ...
 * on top of the list, in its own section called Cover, ... say if it has no cover, half, 3/4 or
 * full ... if they want, they can target/attack, and then the penalty applies accordingly"; "we
 * need to follow the 2024 dmg".
 *
 * THE RULE, read from the books on the box (2026-09-27):
 *   - DMG 2024, Running Combat → Miniatures → Cover: choose a corner of the attacker's space (or
 *     an area's point of origin) and trace lines to every corner of ANY ONE square the target
 *     occupies. One or two lines blocked by an obstacle (a creature included): Half Cover. Three
 *     or four blocked but the attack can still reach the target: Three-Quarters Cover.
 *   - PHB 2024, the Cover table: Half is "another creature or an object"; Three-Quarters and Total
 *     are an OBJECT's only. So lines a creature blocks never lift the degree past Half.
 *   - Only the most protective degree applies; the attacker picks the corner and the square, so
 *     the answer is the LEAST cover over every corner × square.
 *   - Total: no line from any corner reaches any corner of any square — every line meets a wall.
 *   - A line that only GRAZES an obstacle (a wall's end, a token's edge) does not count: the
 *     books are silent, and two tokens side by side would otherwise cover each other along the
 *     shared edge. The corners are pulled a hair inside their squares and the creatures' boxes a
 *     hair inside their edges (RULINGS *Measured cover*).
 *
 * Pure: plain points, rectangles and one injected wall test (the platform's own collision test
 * lives one layer up, in geometry.js). No `game`, no `canvas`, no hooks, no writes.
 *
 * ⚠ Depend downward only: nothing here may import anything.
 */

/**
 * The degrees, in the order "more protective" runs. The bonus is dnd5e's own (`coverHalf` and
 * `coverThreeQuarters` carry `coverBonus` 2 and 5); Total carries no number — the attack cannot
 * target the creature, and the recorded AC is null (a miss), exactly as dnd5e records it. The
 * picture is Foundry's own painted library (the user, 2026-09-27: "nice icons ... color and not the
 * plain effect icons", "pulled from foundry library"): an open road, a low fence, a portcullis (the
 * PHB's own Three-Quarters example), a castle wall.
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
 * The corners of a rectangle, each pulled `inset` toward the rectangle's middle — a corner on a
 * wall's line or a neighbour's edge then sits a hair inside its own square, so a line never
 * starts or ends ON an obstacle.
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
 * The squares a creature occupies, as rectangles: its space cut on the grid. A space smaller than
 * one square (a Tiny creature) is its own one "square"; a gridless scene passes `grid` 0 and the
 * whole space is one.
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
  // every creature a blocked line crosses is named, a walled line's too (the walk, 2026-09-27: a line
  // through a column AND Gren read "a wall" alone)
  for ( const l of best.lines ) if ( (l.creature !== null) && !by.includes(l.creature) ) by.push(l.creature);
  return { degree: degreeAt(index), lines: best.lines, by: index === 0 ? [] : by };
}

/** @param {Rect} r @param {number} d */
function shrink(r, d) {
  return { x: r.x + d, y: r.y + d, w: r.w - (2 * d), h: r.h - (2 * d) };
}

/**
 * What the attack records against one target, the measured degree beside what the target's AC
 * already carries (its cover statuses — a GM's hand-set cover, dnd5e's `ac.cover`): the most
 * protective applies and the degrees never add (PHB). Returns how much the recorded AC must RISE
 * (0 when the carried cover is already as good), or `total` when the measure found Total Cover.
 * @param {number} carried   the cover bonus the recorded AC already holds (0, 2 or 5)
 * @param {CoverDegree} measured
 * @returns {{raise: number, total: boolean}}
 */
export function coverAtTheAttack(carried, measured) {
  if ( measured?.key === "total" ) return { raise: 0, total: true };
  const bonus = Number(measured?.bonus) || 0;
  return { raise: Math.max(0, bonus - Math.max(0, Number(carried) || 0)), total: false };
}
