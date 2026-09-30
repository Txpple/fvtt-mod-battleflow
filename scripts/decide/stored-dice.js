// @ts-check
/**
 * Battle Flow — DECISION (ARCHITECTURE.md §2): THE STORED DICE (registry.js STORED_DICE — Portent): d20s rolled at
 * a rest and kept as faces, each spent once to REPLACE a D20 Test's d20. Which faces can turn a roll, the
 * outcome of the swap, and the chip's name. Pure.
 */

/**
 * A roll whose d20 is REPLACED by a stored face: the modifiers stand, the face's own crit and fumble with it.
 * The `bent` shape the hold and the save's fold already read (`how: "set"`).
 * @param {{kept: number, total: number, face: number, critAt?: number, fumbleAt?: number}} args
 */
export function setOutcome({ kept, total, face, critAt = 20, fumbleAt = 1 }) {
  const f = Number(face);
  const modifier = Number(total) - Number(kept);
  return { how: "set", first: Number(kept), second: null, stood: f, face: f,
    firstTotal: Number(total), total: f + modifier,
    isCritical: f >= critAt, isFumble: f <= fumbleAt,
    wasCritical: Number(kept) >= critAt, changed: f !== Number(kept) };
}

/**
 * The faces that turn the verdict the way `want` asks — "miss" / "fail" (a foe's roll) or "hit" / "pass" (a
 * friend's). `target` the AC or DC; an attack's natural 20 and 1 count (critAt / fumbleAt), a save's never.
 * @param {{faces: number[], kept: number, total: number, target: number, want: string, critAt?: number, fumbleAt?: number}} args
 * @returns {number[]}
 */
export function facesThatTurn({ faces, kept, total, target, want, critAt = 99, fumbleAt = 0 }) {
  if ( !Number.isFinite(Number(target)) ) return [];
  const up = (want === "hit") || (want === "pass");
  const before = successOf(setOutcome({ kept, total, face: kept, critAt, fumbleAt }), target);
  return [...new Set((faces ?? []).map(Number).filter(Number.isFinite))].filter(face => {
    const now = successOf(setOutcome({ kept, total, face, critAt, fumbleAt }), target);
    return (now !== before) && (now === up);
  });
}

/** A bent roll's success against a target: a crit always, a fumble never, else the total. */
const successOf = (o, target) => o.isCritical || (!o.isFumble && (o.total >= Number(target)));

/**
 * The chip's name: what is still in hand ("Portent — 17 · 3"); null when nothing is.
 * @param {string} key
 * @param {number[]} faces
 */
export function storedChipName(key, faces) {
  const list = (faces ?? []).map(Number).filter(Number.isFinite);
  return list.length ? `${key} — ${list.join(" · ")}` : null;
}

/**
 * One face spent: the first equal face removed.
 * @param {number[]} faces
 * @param {number} face
 */
export function withoutFace(faces, face) {
  const out = [...(faces ?? [])];
  const i = out.findIndex(f => Number(f) === Number(face));
  if ( i >= 0 ) out.splice(i, 1);
  return out;
}
