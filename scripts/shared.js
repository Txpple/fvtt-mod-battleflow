/**
 * Battle Flow — Shared helpers: the hit test and the chain walk.
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, S, setting } from "./core.js";

/* ---------------------------------------------------------------------------------------------
 * Shared: the hit test and the chain walk
 * ------------------------------------------------------------------------------------------- */

/**
 * Targets from an attack message's snapshot that the attack roll actually hit, recomputing
 * the system's own render-time test: crit hits, fumble misses, otherwise total >= ac.
 * A null AC (total cover, or a target with no AC data) is deliberately NOT auto-resolvable:
 * the system's targets tray classes those rows as hits (total < null is false), but the
 * outcome isn't determined by data we trust, so those targets are left to humans
 * (design.md §2.1) and the native tray.
 */
export function hitTargets(attackMessage) {
  const roll = attackMessage.rolls[0];
  if ( !(roll instanceof dnd5e.dice.D20Roll) ) return [];
  const targets = attackMessage.getFlag("dnd5e", "targets") ?? [];
  // A resolved reaction hold's verdict OVERRIDES the snapshot: after a Shield the stored
  // descriptor's AC is stale, and auto-apply would otherwise damage a target the module
  // already announced as missed (design.md §5 Phase 1.5, the stale-AC trap).
  const held = attackMessage.getFlag(MODULE_ID, "hold")?.targets ?? [];
  return targets.filter(t => {
    const verdict = held.find(h => h.uuid === t.uuid)?.verdict;
    if ( verdict ) return verdict === "hit";
    return (t.ac !== null) && (t.ac !== undefined)
      && (roll.isCritical || (!roll.isFumble && (roll.total >= t.ac)));
  });
}

/**
 * Does the attacker-side mode admit this actor's side of the table? One home for the
 * npc/pc/all gate — Phase 1a and Graze both read it, and a mode added here reaches both.
 */
export function modeAllows(actor) {
  const mode = setting(S.autoDamage);
  if ( mode === "off" ) return false;
  const isPC = actor?.type === "character";
  if ( (mode === "npc") && isPC ) return false;
  if ( (mode === "pc") && !isPC ) return false;
  return true;
}

/**
 * The attack roll a damage message descends from, walked through the system's registry:
 * damage → originating usage card → associated attack rolls (chronological) → the last one
 * rolled before this damage. When the origin itself IS an attack message (an attack rolled
 * without a usage card; our own programmatic stamp falls back to the attack's id), use it
 * directly. Null when the damage isn't part of an attack chain (save/AoE damage — Phase 2).
 */
export function resolveAttackMessage(damageMessage) {
  const origin = damageMessage.getOriginatingMessage(); // falls back to the message itself
  if ( origin === damageMessage ) return null;
  if ( origin.getFlag("dnd5e", "roll.type") === "attack" ) return origin;
  return origin.getAssociatedRolls("attack")
    .filter(m => m.timestamp <= damageMessage.timestamp)
    .pop() ?? null;
}

