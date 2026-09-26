/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE UNARMED STRIKE DICE — a feature whose owner's
 * Unarmed Strike deals a die "instead of the normal damage" (decide/registry.js UNARMED_DICE;
 * Tavern Brawler the one row). The origin-feat walk, 2026-09-25 — the user, on the plain Unarmed
 * Strike always dealing 4 beside Tavern Brawler: "Module swaps it" — "but give some kind of notice
 * somwhere".
 *
 * THE SEAM: `dnd5e.preRollDamageV2`, before the roll is built — the plain strike's parts (the flat
 * `1 + @mod`, no die) become the feature's own unarmed attack's formula, read off that activity
 * (the pack's "Enhanced Unarmed Strike", `1d4r1 + @abilities.str.mod`), so crits double the die
 * and every reader of the total sees the new number. A strike that already rolls a die (a Monk's
 * Martial Arts) is left alone. The feature's own attack is never touched: it already rolls it.
 *
 * THE NOTICE: one line on the damage card — "Tavern Brawler — 1d4r1 + 3 in place of 1 + 3".
 * Nothing is asked: the die's lowest is the flat number, so the swap is never worse.
 */
import { MODULE_ID, TITLE } from "./core.js";
import { lower } from "./lookup.js";
import { listedNames, unarmedDiceEntries } from "./settings.js";
import { UNARMED_DICE } from "./decide/registry.js";
import { esc } from "./decide/present.js";
import { SURFACES } from "./surfaces.js";

const UNARMED_FLAG = "unarmedDice";

/** An Unarmed Strike — the attack's own classification. */
const isUnarmed = activity => activity?.attack?.type?.classification === "unarmed";

/** The feature's own unarmed attack's damage formula, as the content ships it — or null. */
function featureFormula(feature) {
  const own = [...(feature?.system?.activities ?? [])].find(a => (a.type === "attack") && isUnarmed(a));
  const part = own?.damage?.parts?.[0];
  if ( !part ) return null;
  if ( part.custom?.enabled && part.custom.formula ) return part.custom.formula;
  if ( !part.denomination ) return null;
  return `${part.number ?? 1}d${part.denomination}${part.bonus ? ` + ${part.bonus}` : ""}`;
}

/** The listed row this actor holds, with the formula its feature carries — or null. */
function rowFor(actor) {
  const on = listedNames(unarmedDiceEntries());
  for ( const name of Object.keys(UNARMED_DICE) ) {
    if ( !on.has(lower(name)) ) continue;
    const feature = actor?.items?.find(i => (i.type === "feat") && (lower(i.name) === lower(name)));
    const formula = featureFormula(feature);
    if ( formula ) return { name, feature, formula };
  }
  return null;
}

const DIE = /\d*d\d+/i;

Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  try {
    const activity = config?.subject;
    if ( (activity?.type !== "attack") || !isUnarmed(activity) ) return;
    const found = rowFor(activity.actor);
    if ( !found || (activity.item?.id === found.feature.id) ) return;
    const roll = config.rolls?.[0];
    const parts = Array.isArray(roll?.parts) ? roll.parts : null;
    if ( !parts?.length || parts.some(p => DIE.test(String(p))) ) return;
    const resolve = f => { try { return Roll.replaceFormulaData(f, roll.data ?? {}); } catch { return f; } };
    const was = resolve(parts.join(" + "));
    roll.parts = [found.formula];
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${UNARMED_FLAG}`,
      { feature: found.name, formula: resolve(found.formula), was });
  } catch(err) {
    console.error(`${TITLE} | The Unarmed Strike's die could not be swapped in — roll the feature's own strike.`, err);
  }
});

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, UNARMED_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-unarmed-dice-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-unarmed-dice-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-hand-fist"></i> ${esc(flag.feature)} — ${esc(flag.formula)} in place of ${esc(flag.was)}`;
    content.appendChild(div);
  } catch(err) {
    console.error(`${TITLE} | The Unarmed Strike's line failed to draw.`, err);
  }
});
