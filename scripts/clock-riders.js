/**
 * Battle Flow — Damage riders on the combat clock: a feature's extra damage rides the hit when the round or the turn says it applies.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, activeCombatFor, statContext } from "./core.js";
import { clockRiderEntries } from "./settings.js";
import { turnChitStands, writeTurnChit } from "./shared.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { CLOCK_RIDERS } from "./decide/registry.js";
import { riderDue, riderPartFormula } from "./decide/clock.js";
import { attackMessageForDamage } from "./auto-damage.js";

/* ---------------------------------------------------------------------------------------------
 * CLOCK RIDERS (user, 2026-09-02 — "the damage riders on clock (assassin, gloomstalker) should
 * just notify the player that they are available and will be added to the damage. i believe crit
 * should double those"). The second class of rider beside the marks: a feature on the
 * ATTACKER's sheet whose extra damage is conditioned on the combat clock — once per turn, the
 * first round — rather than on a chip the target carries. The table (decide/registry.js
 * CLOCK_RIDERS) names the feature, the pack's damage activity and the clock; membership is the
 * Clock Riders list.
 *
 * The seam is hit-riders': `preRollDamageV2` on the roller's client, the rider pushed as its own
 * part with the type the row says, crit-doubled by the same stamp that doubles the weapon's dice
 * (free — nothing here hand-rolls a crit). What is added here is the CLOCK: the once-per-turn
 * chit (the Cleave shape, on the attacker, dead with the turn), the round read off the running
 * combat, a limited use spent when the activity carries one. The NOTICE is the damage offer's
 * line where an offer opens, and always the damage card (R5): what rode, and why it was due.
 *
 * ⚠ The dice are READ off the feature's own activity and resolved on the sheet — never a table
 * of dice by level; an unresolved token (NOTES §2: it rolls ZERO in silence) is refused, and the
 * card says so rather than adding nothing quietly.
 * ------------------------------------------------------------------------------------------- */

const lower = s => String(s ?? "").toLowerCase();
const featureNamed = (actor, name) => actor?.items?.find(i => (i.type === "feat") && (lower(i.name) === lower(name))) ?? null;
const activityNamed = (item, name) => [...(item?.system?.activities ?? [])].find(a => lower(a.name) === lower(name)) ?? null;

/** Uses left on an activity that carries them, or null when it carries none. */
function usesLeftOf(activity) {
  const max = activity?.uses?.max;
  if ( (max === "") || (max === null) || (max === undefined) ) return null;
  return Number(activity.uses?.value ?? 0);
}

/**
 * Every listed clock rider on this attacker's sheet, judged for THIS hit: the row, the feature
 * and its activity, the resolved formula and type, and whether the clock says it is due.
 * @param {ChatMessage} attackMessage
 * @param {object} activity   the ATTACK activity that hit
 */
export function clockRidersFor(attackMessage, activity) {
  const attacker = activity?.actor ?? attackMessage?.getAssociatedActor();
  const item = activity?.item;
  if ( !attacker || !item ) return [];
  const listed = new Set(clockRiderEntries().map(e => lower(e.kind)));
  if ( !listed.size ) return [];
  const combat = activeCombatFor(attacker);
  const weaponType = [...(item.system?.damage?.base?.types ?? [])][0] ?? null;
  const facts = {
    inCombat: !!combat, round: combat?.round ?? null,
    sneakArmed: !!attackMessage?.getFlag(MODULE_ID, "sneak")?.armed,
    raging: attacker.effects.some(e => (lower(e.name) === "rage") || e.statuses?.has?.("raging")),
    weapon: item.type === "weapon"
  };
  const out = [];
  for ( const [key, row] of Object.entries(CLOCK_RIDERS) ) {
    if ( !listed.has(lower(row.feature)) ) continue;
    const feature = featureNamed(attacker, row.feature);
    if ( !feature ) continue;
    const act = activityNamed(feature, row.activity);
    const part = act?.damage?.parts?.[0];
    const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
    let formula = null;
    try {
      const resolved = raw ? Roll.replaceFormulaData(raw, attacker.getRollData()) : null;
      formula = (resolved && Roll.validate(resolved)) ? resolved : null;
    } catch { formula = null; }
    const type = (row.type === "weapon") ? weaponType : ([...(part?.types ?? [])][0] ?? null);
    const usesLeft = usesLeftOf(act);
    const judged = riderDue(row, { ...facts, usesLeft, chitStands: turnChitStands(attacker, "rider", key) });
    out.push({ key, row, feature, activity: act, formula, type, usesLeft, ...judged,
      label: row.activity === "Damage" ? row.feature : row.activity });
  }
  return out;
}

/** The offer's lines (auto-damage.js, lazy): what is due and will ride, in one sentence each. */
export function clockRiderLines(attackMessage, activity) {
  return clockRidersFor(attackMessage, activity).filter(r => r.due).map(r => r.formula
    ? `<strong>${r.label}</strong> — ${r.formula}${r.type ? ` ${r.type}` : ""}, ${r.why}: added to this roll${r.usesLeft !== null ? ` (${r.usesLeft - 1} use${(r.usesLeft - 1) === 1 ? "" : "s"} left after)` : ""}.`
    : `<strong>${r.label}</strong> is due, but its dice could not be read off the sheet — add them by hand.`);
}

/* --- the rider: the clock's extra damage rides the weapon's roll ---------------------------- */

Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    const attackMessage = attackMessageForDamage(config, message);
    if ( !attackMessage ) return;
    const riders = clockRidersFor(attackMessage, activity).filter(r => r.due);
    if ( !riders.length ) return;
    const attacker = activity.actor;
    const record = [];
    for ( const r of riders ) {
      if ( r.formula ) {
        config.rolls.push({
          // No `properties`: a feature's extra damage is its own, never the weapon's magic
          // (hit-riders' rule on physical-resistance bypass).
          data: config.rolls[0]?.data ?? {},
          parts: [r.formula],
          options: { type: r.type ?? null, types: r.type ? [r.type] : [] }
        });
      }
      record.push({ key: r.key, label: r.label, formula: r.formula, type: r.type, why: r.why, rule: r.row.rule,
        ...(r.row.caveat ? { caveat: r.row.caveat } : {}),
        ...(r.usesLeft !== null ? { usesLeft: r.usesLeft - 1 } : {}) });
      // The clock's bookkeeping, both on the attacker: the once-per-turn chit (out of combat
      // there is no turn — none is written), and the limited use spent on the activity.
      if ( r.row.when === "oncePerTurn" ) {
        void writeTurnChit(attacker, "rider", { name: `${r.label} — used this turn`, img: r.feature.img ?? null,
          description: `${r.label} has ridden a hit this turn (${r.feature.name}). Once per turn; this chit ends with the turn.`,
          origin: r.feature.uuid, riderKey: r.key })
          .catch(err => console.warn(`${TITLE} | Could not write the ${r.label} chit.`, err));
      }
      if ( r.row.uses && r.activity ) {
        const spent = Number(r.activity.uses?.spent ?? 0) + 1;
        void r.feature.update({ [`system.activities.${r.activity.id}.uses.spent`]: spent })
          .catch(err => console.warn(`${TITLE} | Could not spend a use of ${r.label}.`, err));
      }
    }
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.clockRiders`,
      { ...statContext(attacker?.uuid ?? null), attackId: attackMessage.id, riders: record });
  } catch(err) {
    console.error(`${TITLE} | Clock rider failed to ride — add its damage by hand.`, err);
  }
});

/* --- the card says it (R5) -------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const cr = message.getFlag(MODULE_ID, "clockRiders");
  if ( !cr?.riders?.length ) return;
  for ( const r of cr.riders ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: "Clock rider", tone: r.formula ? "good" : "neutral",
      title: r.formula ? `${r.label} — ${r.formula}${r.type ? ` ${r.type}` : ""} rode this roll` : `${r.label} was due — its dice could not be read`,
      subtitle: `${r.why}${(r.usesLeft !== undefined) ? ` · ${r.usesLeft} use${r.usesLeft === 1 ? "" : "s"} left` : ""}${r.caveat ? ` · ${r.caveat}` : ""}`,
      lines: [ruleLine(r.rule)]
    });
    html.querySelector(".message-content")?.appendChild(line);
  }
});
