/**
 * Battle Flow — Damage riders on the combat clock: a feature's extra damage rides the hit when the round or the turn says it applies.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, activeCombatFor, drivesMomentFor, queueFlagWrite, statContext } from "./core.js";
import { lower, featureNamed, activityNamed, resolveUuid } from "./lookup.js";
import { clockRiderEntries, listedNames } from "./settings.js";
import { hitTargets, poolOf, statSourceOf, turnChitStands, writeTurnChit } from "./shared.js";
import { applyActivityEffectsOnHit } from "./effect-riders.js";
import { registerResumable } from "./ui.js";
import { bfCard, riderMenuHTML, ruleLine } from "./decide/present.js";
import { CLOCK_RIDERS } from "./decide/registry.js";
import { riderDue, riderPartFormula, riderUsesFrom } from "./decide/clock.js";
import { attackMessageForDamage, registerOfferPart } from "./auto-damage.js";
import { SURFACES } from "./surfaces.js";

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

/**
 * Where a rider's limited uses live, or null when it carries none: the ACTIVITY's own (Dreadful
 * Strike), else — for a `uses` row — the ITEM its consumption names, the item itself for an empty
 * target (Slice A, 2026-09-24: the species packs put every use on the item — Fire's Burn, Frost's
 * Chill, `@prof` per Long Rest). The spend writes back where the uses were read.
 */
function usesOf(attacker, activity, row) {
  const pool = (row.uses && activity) ? poolOf(attacker, activity) : null;
  const read = riderUsesFrom({ activity: activity?.uses ?? null, item: pool?.system?.uses ?? null, uses: !!row.uses });
  return read ? { ...read, item: (read.on === "item") ? pool : null } : null;
}

/**
 * Every listed clock rider on this attacker's sheet, judged for THIS hit: the row, the feature
 * and its activity, the resolved formula and type, and whether the clock says it is due.
 * @param {ChatMessage} attackMessage
 * @param {object} activity   the ATTACK activity that hit
 */
function clockRidersFor(attackMessage, activity) {
  const attacker = activity?.actor ?? attackMessage?.getAssociatedActor();
  const item = activity?.item;
  if ( !attacker || !item ) return [];
  const listed = listedNames(clockRiderEntries());
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
    const uses = usesOf(attacker, act, row);
    const usesLeft = uses ? uses.left : null;
    const judged = riderDue(row, { ...facts, usesLeft, chitStands: turnChitStands(attacker, "rider", key) });
    out.push({ key, row, feature, activity: act, formula, type, usesLeft, uses, ...judged,
      label: row.label ?? (row.activity === "Damage" ? row.feature : row.activity) });
  }
  return out;
}

/** Is any listed clock rider due on this hit? The offer opens for it whatever the auto-damage setting. */
function clockRidersDue(attackMessage, activity) {
  return clockRidersFor(attackMessage, activity).some(r => r.due);
}

/**
 * What the damage offer shows for the riders the clock says are due (auto-damage.js, lazy),
 * and what it does at fire time — the Sneak Attack menu's shape (user ruling, the same evening:
 * "make like sneak attack"). Each due rider is a checkbox, ticked; the pick lives in memory
 * from the change events and is written on the attack message BEFORE the roll, where the
 * rider hook reads it. A rider whose dice could not be read is a line, not a row.
 * @param {ChatMessage} attackMessage
 * @param {object} activity
 */
function clockRiderOfferParts(attackMessage, activity) {
  const due = clockRidersFor(attackMessage, activity).filter(r => r.due);
  if ( !due.length ) return null;
  const chosen = new Set(due.filter(r => r.formula).map(r => r.key));
  return {
    riders: due,
    lines: due.filter(r => !r.formula).map(r => `<strong>${r.label}</strong> is due, but its dice could not be read off the sheet — add them by hand.`),
    html: riderMenuHTML(due.map(r => ({ key: r.key, label: r.label, formula: r.formula, type: r.type, why: r.why, rule: r.row.rule, usesLeft: r.usesLeft, caveat: r.row.caveat }))),
    wire(element) {
      for ( const box of (element?.querySelectorAll('input[name="bf-rider"]') ?? []) ) {
        box.addEventListener("change", () => { if ( box.checked ) chosen.add(box.value); else chosen.delete(box.value); });
      }
    },
    /** The pick, on the attack message: WHICH due riders ride. An absent pick (no offer opened) rides all. */
    async commit() {
      try {
        await attackMessage.setFlag(MODULE_ID, "clockPick", [...chosen]);
      } catch(err) {
        console.error(`${TITLE} | Could not record the rider pick — every due rider rides.`, err);
      }
    }
  };
}

// Declared into the damage offer (auto-damage.js `registerOfferPart`, 2026-09-04): a due rider
// opens the offer whatever the auto-damage setting (a checkbox, optional — the offer is where
// the choice lives) and paints its rows on it.
registerOfferPart({
  key: "clock",
  due: clockRidersDue,
  parts: (attackMessage, activity) => {
    const clock = clockRiderOfferParts(attackMessage, activity);
    return clock ? { html: clock.html, lines: clock.lines, wire: clock.wire, commit: clock.commit } : null;
  }
});

/* --- the rider: the clock's extra damage rides the weapon's roll ---------------------------- */

Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  try {
    const activity = config.subject;
    if ( activity?.type !== "attack" ) return;
    const attackMessage = attackMessageForDamage(config, message);
    if ( !attackMessage ) return;
    // The offer's pick, when one was made: only the ticked riders ride, and a declined one spends
    // nothing — no chit, no use (user ruling 2026-09-02). No pick recorded means no offer opened
    // (a driven roll), and every due rider rides.
    const pick = attackMessage.getFlag(MODULE_ID, "clockPick");
    const picked = Array.isArray(pick) ? new Set(pick) : null;
    const riders = clockRidersFor(attackMessage, activity).filter(r => r.due && (!picked || picked.has(r.key)));
    if ( !riders.length ) return;
    const attacker = activity.actor;
    const record = [];
    const spends = [];
    for ( const r of riders ) {
      if ( r.formula ) {
        config.rolls.push({
          // No `properties`: a feature's extra damage is its own, never the weapon's magic
          // (hit-riders' rule on physical-resistance bypass).
          data: foundry.utils.deepClone(config.rolls[0]?.data ?? {}),
          parts: [r.formula],
          options: { type: r.type ?? null, types: r.type ? [r.type] : [] }
        });
      }
      record.push({ key: r.key, label: r.label, formula: r.formula, type: r.type, why: r.why, rule: r.row.rule,
        ...(r.row.caveat ? { caveat: r.row.caveat } : {}),
        ...(r.usesLeft !== null ? { usesLeft: r.usesLeft - 1 } : {}),
        // `effects` (Frost's Chill, 2026-09-24): the activity's own effects land after the damage
        // message exists — the resumable below reads these off the record.
        ...(r.row.effects && r.activity ? { effects: true, clock: r.row.clock ?? null, featureUuid: r.feature.uuid, activityId: r.activity.id } : {}) });
      // The clock's bookkeeping, both on the attacker: the once-per-turn chit (out of combat
      // there is no turn — none is written), and the limited use spent on the activity.
      if ( r.row.when === "oncePerTurn" ) {
        void writeTurnChit(attacker, "rider", { name: `${r.label} — used this turn`, img: r.feature.img ?? null,
          description: `${r.label} has ridden a hit this turn (${r.feature.name}). Once per turn; this chit ends with the turn.`,
          origin: r.feature.uuid, riderKey: r.key })
          .catch(err => console.warn(`${TITLE} | Could not write the ${r.label} chit.`, err));
      }
      if ( r.row.uses && r.activity && r.uses ) {
        const spent = r.uses.spent + 1;
        // Written where the uses were read: the activity's own, or the item's (2026-09-24).
        const write = r.uses.item
          ? r.uses.item.update({ "system.uses.spent": spent })
          : r.feature.update({ [`system.activities.${r.activity.id}.uses.spent`]: spent });
        void write.catch(err => console.warn(`${TITLE} | Could not spend a use of ${r.label}.`, err));
        // THE UNIFORM SPEND (user report 2026-09-09: "when Jetten consumes Dreadful Strike there
        // is no floating text that it was used/remaining"): the record every other pool spend
        // writes, born on the damage message, so the flash, the card line and the ledger read it
        // the same way they read a superiority die or a Sorcery Point (shared.js poolSpendsOn).
        const max = r.uses.max;
        if ( max > 0 ) spends.push({ pool: r.uses.item ? r.uses.item.name : (r.activity.name || r.feature.name), spent: 1, left: Math.max(0, max - spent), max,
          ability: r.label, actorUuid: attacker?.uuid ?? null, at: Date.now() });
      }
    }
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.clockRiders`,
      { ...statContext(attacker?.uuid ?? null), attackId: attackMessage.id, riders: record });
    if ( spends.length ) foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.poolSpend`, spends);
  } catch(err) {
    console.error(`${TITLE} | Clock rider failed to ride — add its damage by hand.`, err);
  }
});

/* --- the rider's own effects on the hit (Frost's Chill, 2026-09-24) -------------------------- */

/**
 * A rider row with `effects` lands its activity's applied effects on the hit targets once the
 * damage message exists, on the elect, receipted there — through the hit menu's own path
 * (effect-riders.js `applyActivityEffectsOnHit`), the row's `clock` pinned to the attacker.
 */
async function settleRiderEffects(message) {
  const cr = message.getFlag(MODULE_ID, "clockRiders");
  const rows = (cr?.riders ?? []).filter(r => r.effects);
  if ( !rows.length || cr.effectsApplied ) return;
  if ( !drivesMomentFor(cr.sourceUuid ?? null) ) return;
  try {
    let claimed = false;
    await queueFlagWrite(message, "clockRiders", current => {
      if ( current.effectsApplied ) return false;
      current.effectsApplied = true;
      claimed = true;
    });
    if ( !claimed ) return;
    const attackMessage = game.messages.get(cr.attackId);
    const hits = attackMessage ? hitTargets(attackMessage) : [];
    const attacker = resolveUuid(cr.sourceUuid ?? null) ?? attackMessage?.getAssociatedActor?.() ?? null;
    for ( const r of rows ) {
      // live only: the rider FEATURE — never used up, so the sheet is the truth
      const feature = resolveUuid(r.featureUuid);
      const activity = feature?.system?.activities?.get?.(r.activityId) ?? null;
      await applyActivityEffectsOnHit(message, activity, hits, { clock: r.clock ?? null, attacker, source: statSourceOf(message) });
    }
  } catch(err) {
    console.error(`${TITLE} | A clock rider's effect failed to apply — apply it by hand.`, err);
  }
}

// The resume floor (the hit menu's shape): on arrival and on reload, never on an update.
registerResumable("clockRiders", {
  pending: (flag, _message, cause) => (cause !== "update") && !!flag.riders?.some?.(r => r.effects) && !flag.effectsApplied,
  drives: flag => drivesMomentFor(flag.sourceUuid ?? null),
  drive: settleRiderEffects
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
    html.querySelector(SURFACES.messageContent)?.appendChild(line);
  }
});
