/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7), a part of the reaction hold: its DICE. When a `roll`
 * answer bends an attack, the d20s rise over the creature that was hit (decide/rescue-hit.js
 * `bentChips` says which, dice-rise.js draws them); a cast AC reaction floats its bonus.
 * Every client, once, off the `bent` record landing; a reload replays nothing.
 */
import { MODULE_ID, TITLE } from "../core.js";
import { bentChips } from "../decide/rescue-hit.js";
import { acChips } from "../decide/dice-chips.js";
import { reactionACBonus } from "./lookup.js";
import { riseDice } from "../dice-rise.js";
import { tokenForUuid } from "../geometry.js";

const played = new Set();
const keyOf = (message, target) => `${message.id}|${target.uuid}`;
const isShield = t => (t?.answer === "cast") && (t?.kind === "ac");
const bentTargets = message => (message?.getFlag?.(MODULE_ID, "hold")?.targets ?? []).filter(t => t?.bent || isShield(t));

Hooks.once("ready", () => {
  for ( const message of (game.messages ?? []) ) for ( const t of bentTargets(message) ) played.add(keyOf(message, t));
});

Hooks.on("updateChatMessage", message => {
  for ( const target of bentTargets(message) ) {
    const key = keyOf(message, target);
    if ( played.has(key) ) continue;
    played.add(key);
    try {
      const token = tokenForUuid(target.uuid);
      riseDice(token, target.bent ? bentChips(target.bent)
        : acChips(reactionACBonus(target.reaction, token?.actor ?? null, { itemId: target.itemId, activityId: target.activityId })));
    } catch(err) {
      console.warn(`${TITLE} | the bent roll's dice could not draw.`, err);
    }
  }
});
