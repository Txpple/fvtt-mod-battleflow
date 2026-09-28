/**
 * Battle Flow — the reaction hold's DICE: a bent attack's d20s, or a cast AC reaction's bonus, rise
 * over the creature hit. Every client, once, off the record landing; a reload replays nothing.
 */
import { MODULE_ID, TITLE } from "../core.js";
import { bentChips } from "../decide/rescue-hit.js";
import { acChips } from "../decide/dice-chips.js";
import { reactionACBonus } from "./lookup.js";
import { riseDice } from "../dice-rise.js";
import { tokenForUuid } from "../geometry.js";
import { listen, listenOnce } from "../dispatch.js";

const played = new Set();
const keyOf = (message, target) => `${message.id}|${target.uuid}`;
const isShield = t => (t?.answer === "cast") && (t?.kind === "ac");
const bentTargets = message => (message?.getFlag?.(MODULE_ID, "hold")?.targets ?? []).filter(t => t?.bent || isShield(t));

listenOnce("ready", "hold/dice", () => {
  for ( const message of (game.messages ?? []) ) for ( const t of bentTargets(message) ) played.add(keyOf(message, t));
});

listen("updateChatMessage", "hold/dice", message => {
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
