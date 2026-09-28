// @ts-check
/**
 * Battle Flow — the reaction hold's DICE: a bent attack's d20s, or a cast AC reaction's bonus, rise
 * over the creature hit. Every client, once, off the record landing; a reload replays nothing.
 */
import { MODULE_ID, TITLE } from "../core.js";
import { bentChips } from "../decide/rescue-hit.js";
import { acChips } from "../decide/dice-chips.js";
import { duplicateChips } from "../decide/duplicates.js";
import { reactionACBonus } from "./lookup.js";
import { riseDice } from "../dice-rise.js";
import { tokenForUuid } from "../geometry.js";
import { listen, listenOnce } from "../dispatch.js";

const played = new Set();
const keyOf = (message, target, which = "bent") => `${message.id}|${target.uuid}|${which}`;
const isShield = t => (t?.answer === "cast") && (t?.kind === "ac");
const hasDuplicateDice = t => !!t?.duplicates?.faces?.length;
const bentTargets = message => (message?.getFlag?.(MODULE_ID, "hold")?.targets ?? []).filter(t => t?.bent || isShield(t) || hasDuplicateDice(t));

listenOnce("ready", "hold/dice", () => {
  for ( const message of (game.messages ?? []) ) for ( const t of bentTargets(message) ) { played.add(keyOf(message, t)); played.add(keyOf(message, t, "dup")); }
});

listen("updateChatMessage", "hold/dice", message => {
  for ( const target of bentTargets(message) ) {
    try {
      const token = tokenForUuid(target.uuid);
      // A bent roll's d20s (or a cast AC reaction's bonus), once.
      const key = keyOf(message, target);
      if ( (target.bent || isShield(target)) && !played.has(key) ) {
        played.add(key);
        riseDice(token, target.bent ? bentChips(target.bent)
          : acChips(reactionACBonus(target.reaction, token?.actor ?? null, { itemId: target.itemId, activityId: target.activityId })));
      }
      // The duplicates' dice (Mirror Image), once — they land after any bent roll's.
      const dup = keyOf(message, target, "dup");
      if ( hasDuplicateDice(target) && !played.has(dup) ) {
        played.add(dup);
        riseDice(token, duplicateChips({ faces: target.duplicates.faces, winner: target.duplicates.winner ?? null, absorbed: !!target.duplicates.absorbed }));
      }
    } catch(err) {
      console.warn(`${TITLE} | the bent roll's dice could not draw.`, err);
    }
  }
});
