/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7), a part of the reaction hold: its DICE (the user, 2026-09-26: "rebuild the shape, start with 1"):
 * when a `roll` answer bends an attack (Lucky, Warding Flare, Shadowy Dodge, a guard's Protection),
 * the d20s in play rise over the creature that was hit — the one that stands gold, the one that no
 * longer counts struck (red when a critical went with it). decide/rescue-hit.js `bentChips` says
 * which; dice-rise.js draws them.
 *
 * EVERY CLIENT, off the record landing: the answer writes `bent` onto the hold's target (directly,
 * or folded from a player's response by the continuing client), and each client sees that update
 * once. What was already bent when this client loaded is remembered, so a reload replays nothing.
 */
import { MODULE_ID, TITLE } from "../core.js";
import { bentChips } from "../decide/rescue-hit.js";
import { riseDice } from "../dice-rise.js";
import { tokenForUuid } from "../geometry.js";

const played = new Set();
const keyOf = (message, target) => `${message.id}|${target.uuid}`;
const bentTargets = message => (message?.getFlag?.(MODULE_ID, "hold")?.targets ?? []).filter(t => t?.bent);

Hooks.once("ready", () => {
  for ( const message of (game.messages ?? []) ) for ( const t of bentTargets(message) ) played.add(keyOf(message, t));
});

Hooks.on("updateChatMessage", message => {
  for ( const target of bentTargets(message) ) {
    const key = keyOf(message, target);
    if ( played.has(key) ) continue;
    played.add(key);
    try {
      riseDice(tokenForUuid(target.uuid), bentChips(target.bent));
    } catch(err) {
      console.warn(`${TITLE} | the bent roll's dice could not draw.`, err);
    }
  }
});
