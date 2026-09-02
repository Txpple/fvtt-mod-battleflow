/**
 * Battle Flow — Shared helpers: the hit test and the chain walk.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting } from "./core.js";
import { foldsFrom, hitsAmong, modeAdmits } from "./decide/verdict.js";

/* ---------------------------------------------------------------------------------------------
 * Shared: the hit test and the chain walk
 * ------------------------------------------------------------------------------------------- */

/**
 * Targets from an attack message's snapshot that the attack roll actually hit, recomputing
 * the system's own render-time test: crit hits, fumble misses, otherwise total >= ac.
 * A null AC (total cover, or a target with no AC data) is deliberately NOT auto-resolvable:
 * the system's targets tray classes those rows as hits (total < null is false), but the
 * outcome isn't determined by data we trust, so those targets are left to humans
 * (DESIGN.md R1) and the native tray.
 */
export function hitTargets(attackMessage) {
  const roll = attackMessage.rolls[0];
  if ( !(roll instanceof dnd5e.dice.D20Roll) ) return [];
  // EDGE: read the message, hand plain data to the judgment (decide/verdict.js), which is where
  // the stale-AC trap and the fold composition are documented.
  //
  // ⚠ THE FOLD CHANNELS ARE NO LONGER NAMED HERE (D8, 2026-08-23). This used to pass `held:`
  // and `precision:` as two hand-written parameters, so a third fold meant editing this call,
  // the signature and the body. `foldsFrom` walks the REGISTRY instead and the only thing this
  // shell still supplies is the reader — which is also what keeps the judgment pure.
  return hitsAmong({
    targets: attackMessage.getFlag("dnd5e", "targets") ?? [],
    folds: foldsFrom(key => attackMessage.getFlag(MODULE_ID, key)),
    roll: { isCritical: roll.isCritical, isFumble: roll.isFumble, total: roll.total }
  });
}

/** EDGE: the system's own label for a weapon mastery key — shared by the mastery machine and the
 * reminder gate (moved out of mastery.js 2026-09-01). */
export const masteryLabel = key => CONFIG.DND5E.weaponMasteries[key]?.label ?? key;

/**
 * Does the attacker-side mode admit this actor's side of the table? One home for the
 * npc/pc/all gate — Phase 1a and Graze both read it, and a mode added here reaches both.
 */
export function modeAllows(actor) {
  return modeAdmits(setting(S.autoDamage), actor?.type === "character");
}

/**
 * The attack roll a damage message descends from.
 *
 * ⚠ THE DAMAGE'S OWN STAMP LEADS ((ii), the v1.20.0 walk, 2026-08-21): every roll
 * rollDamageForAttack makes carries `attackFor` — the id of the exact attack it answers —
 * because the registry walk below CANNOT be trusted under a volley: all three ray attacks
 * share one originating usage card, and "the last attack rolled before this damage" is
 * whichever ray landed last, not the ray this damage belongs to. At the table that
 * misattributed every offered ray damage to ray 3 — ray 1's dice re-tested against ray 3's
 * MISS never applied at all (the user's "the damage didnt auto apply"), and a hold's
 * belt-and-braces read the wrong attack's absent hold. The walk stays as the fallback for
 * rolls this module never drove (the native Damage button).
 *
 * Walk (fallback): damage → originating usage card → associated attack rolls
 * (chronological) → the last one rolled before this damage. When the origin itself IS an
 * attack message (an attack rolled without a usage card; our own programmatic stamp falls
 * back to the attack's id), use it directly. Null when the damage isn't part of an attack
 * chain (save/AoE damage — Phase 2).
 */
export function resolveAttackMessage(damageMessage) {
  const forId = damageMessage.getFlag(MODULE_ID, "attackFor");
  if ( forId ) {
    const stamped = game.messages.get(forId);
    if ( stamped ) return stamped;
  }
  const origin = damageMessage.getOriginatingMessage(); // falls back to the message itself
  if ( origin === damageMessage ) return null;
  if ( origin.getFlag("dnd5e", "roll.type") === "attack" ) return origin;
  return origin.getAssociatedRolls("attack")
    .filter(m => m.timestamp <= damageMessage.timestamp)
    .pop() ?? null;
}

/**
 * The acting actor behind a message, as a uuid — the data plane's source resolution
 * (core.js `statContext`), one implementation beside the chain walk it belongs with.
 *
 * The message's OWN actor leads, and that is a finding, not a shortcut: the handoff drafted
 * a respondsTo-first order, but the respondsTo hop points at the message being ANSWERED — for
 * a reaction response (the defender's own Shield, receipt embedded at creation) that hop
 * names the ATTACKER as the source of the defender's self-cast. Every receipt-bearing message
 * is spoken by the actor whose action caused it (the attacker's damage roll, the caster's
 * usage card, the healer's healing roll, the reactor's response), so the speaker IS the
 * source. The originating-message hop stays as the fallback for a roll whose own speaker
 * resolution comes up empty.
 */
export function statSourceOf(message) {
  const actor = message?.getAssociatedActor?.();
  if ( actor ) return actor.uuid;
  const origin = message?.getOriginatingMessage?.();
  if ( origin && (origin !== message) ) return origin.getAssociatedActor?.()?.uuid ?? null;
  return null;
}

/**
 * The actor behind an effect's `origin` — the ITEM that applied it, and that item's parent: the
 * bard behind an Inspired die, the attacker behind a Sapped chip. Lived in d20-folds.js until
 * the reminder gate needed the same line (review finding 11a, 2026-09-01). Null when the origin
 * is missing, unresolvable, or not an actor's item.
 */
export function grantingActor(effect) {
  try {
    const origin = effect?.origin ? fromUuidSync(effect.origin) : null;
    return (origin?.actor instanceof Actor) ? origin.actor : null;
  } catch { return null; }
}

/**
 * Has this chip already been SPENT on record? The spend writes its receipt on the attack card
 * FIRST and deletes the chip SECOND, and with no GM connected the delete cannot happen (a
 * player cannot write the monster) — so the document lingers and the gate, reading documents
 * alone, listed the same Vex as live on every swing and spent it again each time (review
 * finding 13, 2026-09-01). A recorded spend counts as spent whatever the sheet says: the log
 * is walked newest-first, bounded, for a `chipSpend` entry naming this chip on this bearer,
 * written AFTER the chip's own last write — a chip refreshed by a later hit keeps its id, and
 * an older receipt is about its earlier life.
 */
export function chipSpentOnRecord(effect, { limit = 100 } = {}) {
  const bearerUuid = effect?.parent?.uuid;
  if ( !effect?.id || !bearerUuid ) return false;
  const since = effect._stats?.modifiedTime ?? 0;
  const log = game.messages.contents;
  for ( let i = log.length - 1, n = 0; (i >= 0) && (n < limit); i--, n++ ) {
    const m = log[i];
    if ( m.timestamp < since ) continue;
    const spent = m.getFlag(MODULE_ID, "chipSpend")?.spent;
    if ( spent?.some(s => (s.id === effect.id) && (s.uuid === bearerUuid)) ) return true;
  }
  return false;
}

/**
 * Put a status condition on an actor and make sure it actually LANDED.
 *
 * ⚠ `toggleStatusEffect(id, { active: true })` resolves without doing anything when ANY
 * effect carrying that status already exists — a DISABLED leftover included — and it can
 * come back empty-handed when another module's create-hook interferes. Both no-ops are
 * silent, and one of them is the live "topple failed but nothing fell prone" report
 * (2026-08-16): the verdict announced and the press did nothing. So: enable a disabled
 * carrier if that is what exists; otherwise BUILD the effect directly — since v1.11.0
 * the direct build leads because it can carry an `origin` naming who pressed it
 * (finding ⑤: the Prone chip's source should say Morgash), which toggleStatusEffect
 * cannot. fromStatusEffect keeps the CANONICAL id and keepId preserves it — the id every
 * suite cleanup keys on (the immortal-prone lesson). The toggle stays as the fallback,
 * the verify stays loud: a status that cannot land is a table-facing failure.
 */
export async function forceStatus(actor, statusId, { origin = null } = {}) {
  if ( !(actor instanceof Actor) ) return false;
  const existing = actor.effects.find(e => e.statuses.has(statusId));
  if ( existing ) {
    // Enabling our press on a disabled leftover stamps the source; an already-ACTIVE
    // effect keeps its own history — origin is only written by whoever lands it.
    if ( existing.disabled ) await existing.update({ disabled: false, ...(origin ? { origin } : {}) });
  } else {
    try {
      const effect = await ActiveEffect.implementation.fromStatusEffect(statusId);
      if ( origin ) effect.updateSource({ origin });
      await ActiveEffect.implementation.create(effect, { parent: actor, keepId: true });
    } catch(err) {
      console.error(`${TITLE} | Could not build status "${statusId}" directly.`, err);
    }
    if ( !actor.statuses.has(statusId) ) await actor.toggleStatusEffect(statusId, { active: true });
  }
  const landed = actor.statuses.has(statusId);
  if ( !landed ) console.error(`${TITLE} | Status "${statusId}" refused to land on ${actor.name} — check for a module vetoing effect creation.`);
  return landed;
}


/**
 * Take a status condition OFF an actor and make sure it is actually GONE. The removal twin of
 * `forceStatus` above, and it exists for the same reason: **`toggleStatusEffect` is unreliable
 * in BOTH directions, and its failure modes are opposite.**
 *
 * ⚠ Adding, it no-ops silently when a carrier already exists. **Removing, it THROWS when the
 * carrier has just gone** — `ActiveEffect "dnd5edead0000000" does not exist!` straight out of the
 * server backend — because `{ active: false }` resolves the id from the CONFIG status and issues
 * a delete without re-checking. Anything that removes the same status concurrently wins the race
 * and leaves this call rejecting.
 *
 * ⚠ THAT RACE IS NOT HYPOTHETICAL AND IT COST THREE SIGHTINGS TO NAME. `clearDefeated` restores
 * the pool above zero and then clears the dead mark — and dnd5e's own "HP is positive again"
 * handler is removing that very effect at the same moment. Whoever loses throws. The caller was
 * an un-caught `await` in a click listener, so the rejection was invisible AND it skipped the
 * two writes after it: **the human's revert applied to the actor and was never recorded on the
 * card.** See NOTES.md §1 and `smoke-battleflow` §4b.
 *
 * ⚠ It also fixes the second half of the `toggleStatusEffect` problem NOTES.md records: removing
 * by status id only ever deletes the CANONICAL-id effect, so a custom-id carrier of the same
 * status is immortal. This deletes **every** carrier, by its own id.
 *
 * Best-effort by contract: it never throws, because every one of its callers is doing cleanup
 * AFTER the thing that mattered has already been written.
 */
export async function clearStatus(actor, statusId) {
  if ( !(actor instanceof Actor) ) return false;
  for ( const effect of actor.effects.filter(e => e.statuses?.has?.(statusId)) ) {
    // ⚠ Re-read before deleting. The collection above is a snapshot, and this loop awaits.
    if ( !actor.effects.get(effect.id) ) continue;
    try {
      await effect.delete();
    } catch(err) {
      // A concurrent delete is the EXPECTED loss here, not a defect — the status is gone,
      // which is all this function promised. Anything else is worth a line.
      if ( !actor.effects.get(effect.id) ) continue;
      console.warn(`${TITLE} | Could not clear status "${statusId}" from ${actor.name}.`, err);
    }
  }
  return !actor.statuses.has(statusId);
}


/* ---------------------------------------------------------------------------------------------
 * Shared EDGE helpers — the blocks that were copied rather than shared (the duplicate census,
 * 2026-08-22). Both are EDGE by §2 rule 1: one calls dnd5e's aggregator, the other validates a
 * formula and warns a human. Their pure cores are a three-branch table and a map, too small to
 * be worth an import into decide/ — what was worth fixing is that there were SEVEN copies.
 * ------------------------------------------------------------------------------------------- */

/**
 * A damage message's rolls as the damage descriptors the appliers take — the system's own
 * aggregation, with properties respected so bypasses survive.
 *
 * Was byte-identical in FOUR files (auto-apply, cast, hold, saves), which made it the
 * most-duplicated block in the tree.
 */
export function damagePartsOf(rolls) {
  return dnd5e.dice.aggregateDamageRolls(rolls, { respectProperties: true })
    .map(roll => ({
      value: Math.max(0, roll.total),
      type: roll.options.type,
      properties: new Set(roll.options.properties ?? [])
    }));
}

/**
 * A human's answer turned into the roll configuration it implies — spread straight into a
 * `rollSavingThrow`/`rollConcentration` config, and EMPTY when the answer asked for nothing.
 *
 * Was byte-identical in THREE machines (concentration, mastery's topple, saves), each with its
 * own copy of the same nine lines and the same `Object.keys(...).length` spread — the
 * pre-drift state, not yet drifted.
 *
 * ⚠ An unrollable bonus is dropped with a warning rather than thrown: a typo in the box must
 * not stall the roll the table is waiting on.
 */
export function rollConfigFor(mode, bonus) {
  const override = {};
  if ( mode === "advantage" ) override.options = { advantage: true, disadvantage: false };
  else if ( mode === "disadvantage" ) override.options = { advantage: false, disadvantage: true };
  else if ( mode === "normal" ) override.options = { advantage: false, disadvantage: false };
  const part = (bonus ?? "").trim().replace(/^\+\s*/, "");
  if ( part ) {
    if ( Roll.validate(part) ) override.parts = [part];
    else ui.notifications.warn(`${TITLE}: "${part}" is not a rollable bonus — rolling without it.`);
  }
  return Object.keys(override).length ? { rolls: [override] } : {};
}
