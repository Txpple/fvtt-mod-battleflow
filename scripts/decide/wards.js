// @ts-check
/**
 * Battle Flow — DECISION layer (ARCHITECTURE.md §2): the wards (registry.js WARDS, the spells slice's Tier 3)
 * — which use a standing ward gates, what the bearer does that ends it, and the card's words.
 * The row an effect answers is `repeatRowFor` (decide/repeat-saves.js): the same name-and-origin matcher.
 * No `game`, no settings: the machine (wards.js) reads the world.
 */

/**
 * WHICH GATE a use meets, or null. An attack roll at the ward is gated at the roll (every attack, any item);
 * a spell with damage aimed at it is gated at the cast — never an area ("doesn't protect the warded
 * creature from areas of effect"), never an attack-type spell there (its roll is the attack gate's).
 * @param {{gates: readonly string[]}} row
 * @param {{seam: "attack"|"use", activityType: string|null, itemType: string|null, hasDamage: boolean, hasTemplate: boolean}} use
 * @returns {"attack"|"damagingSpell"|null}
 */
export function wardGateFor(row, { seam, activityType, itemType, hasDamage, hasTemplate }) {
  const gates = row?.gates ?? [];
  if ( seam === "attack" ) return gates.includes("attack") ? "attack" : null;
  if ( !gates.includes("damagingSpell") ) return null;
  if ( (itemType !== "spell") || (activityType === "attack") || !hasDamage || hasTemplate ) return null;
  return "damagingSpell";
}

/**
 * Does what the BEARER just did end its ward? The row's `endsOn` names the acts; the ward's own cast
 * (the item that made it) never ends it.
 * @param {{endsOn?: readonly string[]}} row
 * @param {"attack"|"spell"|"damage"} act
 * @param {{ownItem?: boolean}} [facts]   `ownItem`: the act came from the ward's origin item
 */
export function wardEnds(row, act, { ownItem = false } = {}) {
  if ( ownItem ) return { ends: false, why: "its own cast" };
  if ( !(row?.endsOn ?? []).includes(act) ) return { ends: false, why: `${act} is not one of its ends` };
  return { ends: true, why: ACT_WHY[act] ?? act };
}

const ACT_WHY = Object.freeze({ attack: "made an attack roll", spell: "cast a spell", damage: "dealt damage" });

/**
 * The card's words for a gated use.
 * @param {{spell: string, attacker: string, ward: string, gate: "attack"|"damagingSpell", what?: string|null}} facts
 */
export function wardWords({ spell, attacker, ward, gate, what = null }) {
  const thing = (gate === "attack") ? "attack" : "spell";
  const named = what ? ` · ${what}` : "";
  return {
    title: `${spell} — a save before the ${thing}`,
    subtitle: `${attacker} → ${ward}${named} · the ${thing} waits for the save`,
    failed: `No ${gate === "attack" ? "attack roll" : "cast"}. Choose a new target, or the ${thing} is lost.`,
    passed: `The ${thing} goes on.`
  };
}

/**
 * What the ward's verdict does: a failure turns the use aside, a success lets it through.
 * @param {"saved"|"failed"|string|null} outcome
 * @param {"attack"|"damagingSpell"} gate
 * @returns {{through: boolean, says: string}}
 */
export function wardVerdict(outcome, gate) {
  const thing = (gate === "attack") ? "attack" : "spell";
  if ( outcome === "saved" ) return { through: true, says: `the save passed — the ${thing} goes on` };
  return { through: false, says: `the save failed — the ${thing} is turned aside` };
}
