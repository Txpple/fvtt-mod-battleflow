// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the ray table (registry.js RAY_TABLES) — which rays a
 * creature's faces pick, and the cards' words. No `game`: the machine (prismatic.js) rolls the faces.
 */

/**
 * THE RAYS one creature is struck by, drawn face by face from `next()`: a `twice` face draws two more and
 * is never itself a ray; a draw that keeps landing on it is cut at `cap` draws (a broken die never loops).
 * @typedef {{ face: number, colour: string, type?: string|null, save?: string|null, effect?: string|null, words?: string|null }} Ray
 * @param {{die: number, twice?: number|null, rays: Readonly<Record<string, any>>}} row
 * @param {() => number} next   the next face rolled
 * @param {{cap?: number}} [opts]
 * @returns {{ rays: Ray[], faces: number[] }}   the rays in draw order, and every face drawn
 */
export function raysFor(row, next, { cap = 12 } = {}) {
  const rays = [];
  const faces = [];
  let wanted = 1;
  let draws = 0;
  while ( (wanted > 0) && (draws < cap) ) {
    const face = Number(next());
    draws++;
    faces.push(face);
    const ray = row?.rays?.[String(face)] ?? null;
    if ( !ray ) continue;   // an unmapped face draws again
    if ( ray.twice || (row.twice === face) ) { wanted += 1; continue; }   // one draw spent, two owed
    rays.push({ face, colour: ray.colour, type: ray.type ?? null, save: ray.save ?? null, effect: ray.effect ?? null, words: ray.words ?? null });
    wanted -= 1;
  }
  return { rays, faces };
}

const cap = (/** @type {string} */ s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * One ray's demand words.
 * @param {{spell: string, ray: Ray, target: string, caster?: string|null}} facts
 */
export function rayWords({ spell, ray, target, caster = null }) {
  const who = caster ? `${caster}'s ` : "";
  if ( ray.type ) {
    return { title: `${spell} — the ${ray.colour} ray strikes ${target}`,
      subtitle: `${cap(ray.type)} damage · Dexterity save, half on a success`, eyebrow: `${who}${spell}` };
  }
  return { title: `${spell} — the ${ray.colour} ray strikes ${target}`,
    subtitle: `${ray.words ?? `a save against ${ray.effect ?? "its effect"}`}`, eyebrow: `${who}${spell}` };
}

/**
 * The summary card's lines: one per creature, its faces and rays.
 * @param {Array<{name: string, faces: number[], rays: Ray[]}>} entries
 */
export function raySummaryLines(entries) {
  return (entries ?? []).map(e => {
    const named = e.rays.map(r => `${r.colour}${r.type ? ` (${r.type})` : ""}`).join(" and ");
    return `${e.name}: d8 → ${e.faces.join(", ")} — ${named || "no ray"}`;
  });
}

/**
 * What a ray's verdict lands: a damage ray is the demand's own (half on a success); a condition ray lands
 * its effect on a FAILURE only, and the card says so.
 * @param {Ray} ray
 * @param {"saved"|"failed"|string|null} outcome
 * @returns {{lands: string|null, says: string}}
 */
export function rayVerdict(ray, outcome) {
  if ( ray.type ) return { lands: null, says: outcome === "saved" ? `half the ${ray.type} damage` : `the ${ray.type} damage in full` };
  if ( outcome === "saved" ) return { lands: null, says: `the ${ray.colour} ray missed — the save succeeded` };
  return { lands: ray.effect ?? null, says: `${ray.effect ?? "the effect"} lands — the save failed` };
}
