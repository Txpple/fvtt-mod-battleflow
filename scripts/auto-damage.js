/**
 * Battle Flow — Phase 1a: auto-roll damage on hit, on the attacker's own client.
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { TITLE, S, setting } from "./core.js";
import { hitTargets, modeAllows } from "./shared.js";
import { stampHoldIfInterrupted } from "./hold.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1a — auto-roll damage on hit (the attacker's client; its attack, its dice)
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.rollAttackV2", async (rolls, { subject }) => {
  // The mode gates on the ATTACKER's side of the table, and this hook runs on whichever client
  // rolled — so "npc" is in practice the GM's client and "pc" a player's own. Everything
  // downstream is side-agnostic: auto-apply is the GM elect regardless of who attacked, and a
  // hold's continuation follows the roller (see isContinuingClient).
  if ( !subject || !modeAllows(subject.actor) ) return;

  const attackMessage = rolls[0]?.parent;
  if ( !(attackMessage instanceof ChatMessage) ) return; // rolled with create:false — no chain to ride

  // Mirror the native card: no Damage button (no damage parts, no ammo), nothing to roll.
  if ( !subject.damage?.parts?.length && !subject.item?.system.properties?.has("amm") ) return;

  const hits = hitTargets(attackMessage);
  if ( !hits.length ) return; // a miss means the damage dice never exist

  // The one legitimate interrupt: someone hit is holding a Shield-class reaction. Pause here
  // rather than rolling damage, and let a human answer (design.md §5 Phase 1.5).
  if ( await stampHoldIfInterrupted(attackMessage, rolls[0], hits) ) return;

  const beat = (Math.max(0, Number(setting(S.dramaticBeat)) || 0)) * 1000;
  setTimeout(() => rollDamageForAttack(subject, attackMessage), beat);
});

/**
 * Press the Damage button the way AttackActivity.#rollDamage does at 5.3.3: recover attack
 * mode and ammunition from the attack message's flags — including the stored copy of
 * ammunition destroyed by consumption — pre-set critical, skip the dialog. The
 * originatingMessage is stamped explicitly because a programmatic roll has no DOM click to
 * inherit it from; without it the damage message never registers and auto-apply can't chain.
 */
export async function rollDamageForAttack(activity, attackMessage) {
  try {
    const attackMode = attackMessage.getFlag("dnd5e", "roll.attackMode");
    let ammunition;
    const actor = attackMessage.getAssociatedActor();
    if ( actor ) {
      const storedData = attackMessage.getFlag("dnd5e", "roll.ammunitionData");
      ammunition = storedData
        ? new Item.implementation(storedData, { parent: actor })
        : actor.items.get(attackMessage.getFlag("dnd5e", "roll.ammunition"));
    }
    const isCritical = attackMessage.rolls[0]?.isCritical ?? false;
    const originId = attackMessage.getFlag("dnd5e", "originatingMessage") ?? attackMessage.id;
    await activity.rollDamage(
      { ammunition, attackMode, isCritical },
      { configure: false },
      { data: { "flags.dnd5e.originatingMessage": originId } }
    );
  } catch(err) {
    console.error(`${TITLE} | Auto-roll damage failed.`, err);
  }
}

