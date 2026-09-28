/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE UNARMED STRIKE DICE (registry UNARMED_DICE). At
 * `preRollDamageV2` the plain strike's flat parts become the feature's own unarmed formula, so a
 * crit doubles the die. Nothing is asked: the die is never worse than the flat.
 */
import { MODULE_ID, TITLE } from "./core.js";
import { featureNamed, lower } from "./lookup.js";
import { listedNames, unarmedDiceEntries } from "./decide/registry.js";
import { UNARMED_DICE } from "./decide/registry.js";
import { esc } from "./decide/present.js";
import { SURFACES } from "./surfaces.js";

const UNARMED_FLAG = "unarmedDice";

const isUnarmed = activity => activity?.attack?.type?.classification === "unarmed";

function activityFormula(activity) {
  const part = activity?.damage?.parts?.[0];
  if ( !part ) return null;
  if ( part.custom?.enabled && part.custom.formula ) return part.custom.formula;
  if ( !part.denomination ) return null;
  return `${part.number ?? 1}d${part.denomination}${part.bonus ? ` + ${part.bonus}` : ""}`;
}

const unarmedAttacksOf = feature => [...(feature?.system?.activities ?? [])]
  .filter(a => (a.type === "attack") && isUnarmed(a))
  .map(a => ({ activity: a, formula: activityFormula(a) }))
  .filter(x => x.formula);

/** A formula's largest roll. */
const DIE_OF = /(\d*)d(\d+)/i;
function dieMax(formula) {
  const m = DIE_OF.exec(String(formula ?? ""));
  return m ? (Number(m[1] || 1) * Number(m[2])) : 0;
}

/** No weapon (natural ones are not held) and no Shield equipped. */
function handsEmpty(actor) {
  return !(actor?.items ?? []).some(i => (i.system?.equipped === true) && (
    ((i.type === "weapon") && (i.system?.type?.value !== "natural"))
    || ((i.type === "equipment") && (i.system?.type?.value === "shield"))));
}

/** The formula a row swaps in; a `hands` row takes the larger with hands empty, else the smaller. */
function formulaFor(row, feature, actor) {
  const own = unarmedAttacksOf(feature);
  if ( !own.length ) return null;
  if ( row.pick !== "hands" ) return { formula: own[0].formula, why: null };
  const sorted = [...own].sort((a, b) => dieMax(a.formula) - dieMax(b.formula));
  const empty = handsEmpty(actor);
  return { formula: (empty ? sorted.at(-1) : sorted[0]).formula, why: empty ? "hands empty" : "a weapon or Shield held" };
}

/** The listed row this actor holds, or null; with two, the LARGER die wins. */
function rowFor(actor) {
  const on = listedNames(unarmedDiceEntries());
  let best = null;
  for ( const [name, row] of Object.entries(UNARMED_DICE) ) {
    if ( !on.has(lower(name)) ) continue;
    const feature = featureNamed(actor, name);
    const found = feature ? formulaFor(row, feature, actor) : null;
    if ( found && (!best || (dieMax(found.formula) > dieMax(best.formula))) ) best = { name, feature, ...found };
  }
  return best;
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
      { feature: found.name, formula: resolve(found.formula), was, why: found.why ?? null });
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
    div.innerHTML = `<i class="fa-solid fa-hand-fist"></i> ${esc(flag.feature)} — ${esc(flag.formula)} in place of ${esc(flag.was)}`
      + (flag.why ? ` (${esc(flag.why)})` : "");
    content.appendChild(div);
  } catch(err) {
    console.error(`${TITLE} | The Unarmed Strike's line failed to draw.`, err);
  }
});
