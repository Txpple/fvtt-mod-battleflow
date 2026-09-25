/**
 * Battle Flow — Damage riders on the combat clock: a feature's extra damage rides the hit when the round or the turn says it applies.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, activeCombatFor, canAnswerFor, drivesMomentFor, queueFlagWrite, statContext } from "./core.js";
import { lower, featureNamed, activityNamed, cardActivity, resolveUuid } from "./lookup.js";
import { clockRiderEntries, listedNames } from "./settings.js";
import { hitTargets, poolOf, statSourceOf, turnChitStands, writeTurnChit } from "./shared.js";
import { applyActivityEffectsOnHit } from "./effect-riders.js";
import { momentButton, registerResumable } from "./ui.js";
import { bfCard, riderMenuHTML, ruleLine } from "./decide/present.js";
import { CLOCK_RIDERS } from "./decide/registry.js";
import { riderDue, riderPartFormula, riderUsesFrom, standingForm } from "./decide/clock.js";
import { attackMessageForDamage, registerOfferPart } from "./auto-damage.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
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

/** The flag a form chip wears — the transformation a `transformed` row reads (Necrotic Shroud). */
const FORM_FLAG = "formChip";

/** Which of a `transformed` row's forms stands on this bearer (decide/clock.js standingForm), or null. */
function formOn(actor, row) {
  if ( !row.forms ) return null;
  return standingForm(row, (actor?.effects ?? []).map(e => ({ name: e.name, active: !!e.active,
    chip: e.getFlag(MODULE_ID, FORM_FLAG)?.form ?? null })));
}

/** A row's extra damage as a formula: the row's own `amount` (the text's token), else its activity's first part. */
function riderFormulaOf(row, act) {
  if ( row.amount ) return row.amount;
  const part = act?.damage?.parts?.[0];
  return part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
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
    const act = row.activity ? activityNamed(feature, row.activity) : null;
    const part = act?.damage?.parts?.[0];
    const raw = riderFormulaOf(row, act);
    let formula = null;
    try {
      const resolved = raw ? Roll.replaceFormulaData(raw, attacker.getRollData()) : null;
      formula = (resolved && Roll.validate(resolved)) ? resolved : null;
    } catch { formula = null; }
    // A `transformed` row's type is the FORM's (Necrotic for Necrotic Shroud, Radiant otherwise).
    const form = formOn(attacker, row);
    const type = (row.type === "weapon") ? weaponType : form ? form.type : ([...(part?.types ?? [])][0] ?? null);
    const uses = usesOf(attacker, act, row);
    const usesLeft = uses ? uses.left : null;
    const judged = riderDue(row, { ...facts, usesLeft, form: form?.form ?? null, chitStands: turnChitStands(attacker, "rider", key) });
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

/* --- the form chip: a transformation that marks nothing on its bearer (Necrotic Shroud) --------- */

/**
 * Celestial Revelation's rider reads the FORM that stands (decide/clock.js standingForm). Two
 * forms land an effect on their bearer — Heavenly Wings by the cast slice (a self utility),
 * Searing Radiance by token-lights.js — and those ARE the mark. Necrotic Shroud lands its effect
 * on the frightened, never on the Aasimar, so its use writes the module's own form chip on the
 * bearer: the activity's own duration (the transformation's minute), the rule in its
 * description, deleted by hand to end the transformation early ("or until you end it"). On the
 * client that used it — the owner's.
 */
Hooks.on("dnd5e.postUseActivity", activity => {
  try {
    const actor = activity?.actor;
    const item = activity?.item;
    if ( !actor?.isOwner || !item ) return;
    const listed = listedNames(clockRiderEntries());
    for ( const [key, row] of Object.entries(CLOCK_RIDERS) ) {
      if ( !row.forms || !listed.has(lower(row.feature)) || (lower(item.name) !== lower(row.feature)) ) continue;
      const form = row.forms.find(f => f.chip && (lower(f.form) === lower(activity.name)));
      if ( form ) void writeFormChip(actor, activity, key, row, form);
    }
  } catch(err) {
    console.error(`${TITLE} | Could not mark the transformation — its extra damage is yours to add.`, err);
  }
});

async function writeFormChip(actor, activity, key, row, form) {
  const stale = actor.effects.filter(e => e.getFlag(MODULE_ID, FORM_FLAG)?.riderKey === key);
  if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id)).catch(() => {});
  await ActiveEffect.implementation.create({
    name: `${row.feature}: ${form.form}`, img: activity.item.img ?? "icons/svg/aura.svg",
    description: `<p><em>“${row.rule}”</em></p><p>Written by Battle Flow when ${form.form} was used: the transformation stands while this does. Delete it to end the transformation early.</p>`,
    origin: activity.item.uuid, disabled: false, transfer: false,
    duration: activity.duration?.getEffectData?.() ?? {},
    flags: { [MODULE_ID]: { [FORM_FLAG]: { riderKey: key, form: lower(form.form) } } }
  }, { parent: actor }).catch(err => console.warn(`${TITLE} | Could not write the ${form.form} chip.`, err));
}

/* --- a spell's damage with no attack roll: the ONE target is the caster's pick ------------------ */

/**
 * A `spells` row (Celestial Revelation: "when you deal damage to it with an attack or a spell")
 * rides an ATTACK spell's roll like a weapon's — one attack, one target. A spell that deals damage
 * with NO attack roll (a save, a bare damage roll — Sacred Flame, Fireball, Magic Missile) may hit
 * many, and the extra goes to ONE of them; which one is the caster's choice (R1). So the offer is
 * on the spell's damage card, once its damage has landed: a button per creature that took damage,
 * on the caster's own client; a pick lands the extra on its own card through the receipt
 * chokepoint (the spell's receipt is keyed by creature, and an entry there would overwrite the
 * spell's own), spends the turn, and the offer goes. Out of combat there is no turn: once per card.
 */
const SPELL_FLAG = "spellRider";

/** The listed `spells` rows due for this caster now, each with its form, value and type. */
function spellRidersFor(caster) {
  if ( !caster ) return [];
  const listed = listedNames(clockRiderEntries());
  const combat = activeCombatFor(caster);
  const out = [];
  for ( const [key, row] of Object.entries(CLOCK_RIDERS) ) {
    if ( !row.spells || !listed.has(lower(row.feature)) ) continue;
    const feature = featureNamed(caster, row.feature);
    if ( !feature ) continue;
    const form = formOn(caster, row);
    const raw = riderFormulaOf(row, row.activity ? activityNamed(feature, row.activity) : null);
    let value = null;
    try {
      const resolved = raw ? Roll.replaceFormulaData(raw, caster.getRollData()) : null;
      value = (resolved && Roll.validate(resolved)) ? Roll.safeEval(resolved) : null;
    } catch { value = null; }
    const judged = riderDue(row, { inCombat: !!combat, round: combat?.round ?? null, form: form?.form ?? null,
      chitStands: turnChitStands(caster, "rider", key) });
    if ( !judged.due || !(Number(value) > 0) ) continue;
    out.push({ key, row, feature, form, value: Number(value), type: form?.type ?? null, why: judged.why, label: row.label ?? row.feature });
  }
  return out;
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const picked = message.getFlag(MODULE_ID, SPELL_FLAG) ?? {};
    // What was picked, on every client (R5): the card names where the extra went.
    for ( const p of Object.values(picked) ) {
      if ( !p?.targetName ) continue;
      const line = document.createElement("div");
      line.innerHTML = bfCard({ eyebrow: "Clock rider", tone: "good",
        title: `${p.label} — +${p.value}${p.type ? ` ${p.type}` : ""} to ${p.targetName}`,
        subtitle: p.applied ? `${p.why} · landed on its own card` : `${p.why} · landing…`,
        lines: [ruleLine(p.rule)] });
      html.querySelector(SURFACES.messageContent)?.appendChild(line);
    }
    const receipt = message.getFlag(MODULE_ID, "receipt");
    const damaged = [...new Map((receipt?.targets ?? []).filter(t => !t.reverted && (Number(t.taken) > 0)).map(t => [t.uuid, t])).values()];
    if ( !damaged.length ) return;
    const activity = cardActivity(message);
    if ( (activity?.item?.type !== "spell") || (activity.type === "attack") ) return;
    const caster = activity.actor ?? null;
    if ( !canAnswerFor(caster) ) return;
    for ( const r of spellRidersFor(caster) ) {
      if ( picked[r.key] ) continue;
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:0.35rem;align-items:center;margin-top:0.35rem;flex-wrap:wrap;";
      const label = document.createElement("span");
      label.style.cssText = "font-size:var(--font-size-11,11px);opacity:0.8;";
      label.textContent = `${r.label} — +${r.value}${r.type ? ` ${r.type}` : ""} to one target (${r.why}):`;
      row.appendChild(label);
      for ( const t of damaged ) row.appendChild(momentButton(t.name, () => void pickSpellRider(message, r, t, caster)));
      html.querySelector(SURFACES.messageContent)?.appendChild(row);
    }
  } catch(err) {
    console.warn(`${TITLE} | Could not offer the spell's extra damage — add it by hand.`, err);
  }
});

/** The caster's pick, on the spell's damage card (the caster rolled it — the caster may write it). */
async function pickSpellRider(message, r, target, caster) {
  const entry = { ...statContext(caster.uuid), key: r.key, label: r.label, value: r.value, type: r.type, why: r.why, rule: r.row.rule,
    featureUuid: r.feature?.uuid ?? null, targetUuid: target.uuid, targetName: target.name, applied: false };
  await queueFlagWrite(message, SPELL_FLAG, current => {
    if ( current[r.key] ) return false;   // one pick per card
    current[r.key] = entry;
  });
}

/** On the elect: land each pick on its own card, spend the turn, mark it applied. */
async function driveSpellRider(message) {
  const picks = Object.values(message.getFlag(MODULE_ID, SPELL_FLAG) ?? {}).filter(p => p?.targetUuid && !p.applied && !p.claimed);
  for ( const p of picks ) {
    let claimed = false;
    await queueFlagWrite(message, SPELL_FLAG, current => {
      if ( !current[p.key] || current[p.key].claimed ) return false;
      current[p.key].claimed = true;
      claimed = true;
    });
    if ( !claimed ) continue;
    const caster = resolveUuid(p.sourceUuid);
    const feature = resolveUuid(p.featureUuid);
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster ?? undefined }),
      content: bfCard({ img: feature?.img ?? null, eyebrow: "Clock rider", tone: "good",
        title: `${p.label} — +${p.value}${p.type ? ` ${p.type}` : ""} to ${p.targetName}`,
        subtitle: `${p.why} · with the spell's damage`, lines: [ruleLine(p.rule)] }),
      flags: { [MODULE_ID]: { spellRiderCard: { ...statContext(p.sourceUuid ?? null), key: p.key, label: p.label,
        value: p.value, type: p.type, targetUuid: p.targetUuid, spellMessageId: message.id } } }
    });
    if ( card ) await applyDamagesWithReceipt(card, [{ uuid: p.targetUuid, name: p.targetName }],
      [{ value: p.value, type: p.type ?? "radiant", properties: new Set(["mgc"]) }], { note: p.label });
    if ( caster && (CLOCK_RIDERS[p.key]?.when === "oncePerTurn") ) {
      await writeTurnChit(caster, "rider", { name: `${p.label} — used this turn`, img: feature?.img ?? null,
        description: `${p.label} has ridden a spell's damage this turn. Once per turn; this chit ends with the turn.`,
        origin: feature?.uuid ?? null, riderKey: p.key }).catch(err => console.warn(`${TITLE} | Could not write the ${p.label} chit.`, err));
    }
    await queueFlagWrite(message, SPELL_FLAG, current => { if ( current[p.key] ) current[p.key].applied = true; });
  }
}

registerResumable(SPELL_FLAG, {
  pending: flag => Object.values(flag ?? {}).some(p => p?.targetUuid && !p.applied && !p.claimed),
  drives: flag => Object.values(flag ?? {}).some(p => drivesMomentFor(p?.sourceUuid ?? null)),
  drive: driveSpellRider
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
