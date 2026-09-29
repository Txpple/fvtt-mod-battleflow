/**
 * Battle Flow — Damage shields: a standing ward on the DEFENDER pays out against the ATTACKER when
 * a melee attack roll hits — the hit rider mirrored (RULINGS *Damage shields*). The table is
 * decide/registry.js DAMAGE_SHIELDS; membership is the Damage Shields list.
 */
import { MODULE_ID, TITLE, activeCombatFor, canApplyTo, drivesMomentFor, queueFlagWrite, statContext, whisperNoGM } from "./core.js";
import { ruleHTML } from "./rule-text.js";
import { lower, itemNamed, activityNamed, activityOfType, resolveUuid } from "./lookup.js";
import { registerResumable } from "./ui.js";
import { damageShieldEntries, listedNames } from "./decide/registry.js";
import { damagePartsOf, effectSourceOf, hitTargets, resolveAttackMessage, turnChitStands, writeTurnChit } from "./shared.js";
import { nearestFeet, tokenForUuid, tokenOfActor } from "./geometry.js";
import { bfCard, ruleLine, esc } from "./decide/present.js";
import { DAMAGE_SHIELDS, answers, tableIndex } from "./decide/registry.js";
import { durationSeconds, shieldDue, shieldEffectNames, shieldReach, shieldType } from "./decide/shields.js";
import { messageActivity } from "./effect-riders.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { SURFACES } from "./surfaces.js";
import { CARD, castLevelOn, isCard } from "./decide/card.js";
import { listen } from "./dispatch.js";

/* THE WARD: found by the pack's effect NAME and walked to its source (the warded creature need not
 * be the caster). THE HIT: judged ONCE on the elect, after any hold settled. THE PAYOUT: rolled by
 * the elect as the DEFENDER's, one per ward per hit, claimed BEFORE the dice (`damageShields.paid`). */

const listed = () => listedNames(damageShieldEntries());
const { rowFor } = tableIndex(DAMAGE_SHIELDS);

/**
 * Every listed ward standing on this creature, one entry per ward; an unwalkable source falls back
 * to the creature's OWN copy of the spell.
 */
function shieldsOn(defender) {
  const names = listed();
  const out = [];
  for ( const [key, row] of Object.entries(DAMAGE_SHIELDS) ) {
    if ( !names.has(lower(key)) ) continue;
    // The defender's OWN trait (Corrosive Form): the sheet is the row, its first damage activity strikes.
    if ( row.match === "feature" ) {
      const own = itemNamed(defender, key);
      const activity = own ? (row.activity ? activityNamed(own, row.activity) : activityOfType(own, "damage")) : null;
      if ( own && activity ) out.push({ key, row, effect: null, source: { actor: defender, item: own }, activity, type: null, scaling: 0 });
      continue;
    }
    const wanted = new Set(shieldEffectNames(row));
    for ( const effect of defender.effects ) {
      if ( effect.disabled ) continue;
      let source = null;
      let scaling = 0;
      if ( row.mark ) {
        const mark = effect.getFlag(MODULE_ID, "shield");
        if ( mark?.key !== key ) continue;
        // live only: a scroll ("Spell Scroll: X") is never listed by name, so it is never marked
        const item = resolveUuid(mark.itemUuid);
        source = item ? { actor: item.actor ?? defender, item } : null;
        scaling = Number(mark.scaling ?? 0);
      } else {
        if ( !wanted.has(lower(effect.name)) ) continue;
        source = effectSourceOf(effect);
        if ( source && !answers(key, source.item) ) source = null;
        if ( !source ) {
          const own = itemNamed(defender, key);
          if ( own ) source = { actor: defender, item: own };
        }
      }
      if ( !source?.item ) {
        console.warn(`${TITLE} | ${key} stands on ${defender.name} but its spell could not be found — the ward strikes by hand.`);
        continue;
      }
      const activity = activityNamed(source.item, row.activity);
      if ( !activity ) continue;
      const type = row.mark ? null : shieldType(row, effect.name);
      const seen = out.find(s => s.key === key);
      if ( seen ) { seen.also = effect.name; continue; }
      out.push({ key, row, effect, source, activity, type, scaling });
    }
  }
  return out;
}

/* --- the trigger: the attack's damage roll landing, on the elect --------------------------- */

/** Does this damage message answer a MELEE attack roll whose hold has settled? The attack, or null. */
function settledMeleeAttack(message) {
  if ( !isCard(message, CARD.damage) ) return null;
  const attackMessage = resolveAttackMessage(message);
  if ( !attackMessage ) return null;
  if ( message.getFlag(MODULE_ID, "attackHoldPending") === true ) {
    const hold = attackMessage.getFlag(MODULE_ID, "hold");
    if ( !hold || (hold.status === "pending") ) return null;   // the hold still decides
  }
  const activity = messageActivity(attackMessage);
  if ( activity?.attack?.type?.value !== "melee" ) return null;
  return attackMessage;
}

/** Damage messages this client has judged; a re-render or flag write never re-judges one. */
const judged = new Set();

/**
 * ⚠ JUDGED ONCE, AT THE HIT: the judge reads the world AS IT IS, so a re-read answers "now", not
 * "then". Creation judges an unheld roll; update/render only a released one, stamped `judged`.
 */
function consider(message, { resume = false } = {}) {
  if ( !listed().size ) return false;
  if ( judged.has(message.id) ) return false;
  if ( resume ) {
    if ( message.getFlag(MODULE_ID, "attackHoldPending") !== false ) return false;   // only an ex-held roll resumes here
    if ( message.getFlag(MODULE_ID, "damageShields")?.judged ) return false;         // …and only once across reloads
  }
  return !!settledMeleeAttack(message);
}

// Resumable, FLAGLESS: the hold's release (update) and a reload (render) are the resume.
registerResumable("damageShields", {
  flagless: true,
  pending: (_flag, message, cause) => consider(message, { resume: cause !== "create" }),
  drives: () => true,   // per defender, inside: the flow elect for the ward's bearer
  drive: message => {
    const attackMessage = settledMeleeAttack(message);
    return attackMessage ? settle(message, attackMessage, { wasHeld: message.getFlag(MODULE_ID, "attackHoldPending") === false }) : undefined;
  }
});

async function settle(damageMessage, attackMessage, { wasHeld = false } = {}) {
  judged.add(damageMessage.id);
  try {
    const attacker = attackMessage.getAssociatedActor();
    if ( !attacker ) return;
    // A released roll's judgement is stamped first, so a reload never judges it again — by the
    // attacker's elect, once; every client's own memory is `judged`.
    if ( wasHeld && drivesMomentFor(attacker.uuid) ) {
      try { await queueFlagWrite(damageMessage, "damageShields", current => { current.judged = true; }); }
      catch(err) { console.warn(`${TITLE} | Could not stamp the shield judgement on the damage card.`, err); }
    }
    const hits = hitTargets(attackMessage);
    const attackerToken = tokenOfActor(attacker);
    for ( const t of hits ) {
      const defender = resolveUuid(t.uuid);
      if ( !(defender instanceof Actor) || (defender.uuid === attacker.uuid) ) continue;
      if ( !drivesMomentFor(defender.uuid) ) continue;   // the elect for this ward's bearer
      const wards = shieldsOn(defender);
      if ( !wards.length ) continue;
      const defenderToken = tokenForUuid(t.uuid);
      const distanceFeet = (attackerToken && defenderToken) ? nearestFeet(attackerToken, defenderToken) : null;
      // ⚠ Read BEFORE any await: Agathys strikes "while you have these Hit Points", and the attack's
      // own damage, applied on the same tick, may take the last of them.
      const tempHP = Number(defender.system?.attributes?.hp?.temp ?? 0);
      const combat = activeCombatFor(defender);
      for ( const s of wards ) {
        const judged = shieldDue(s.row, {
          melee: true, distanceFeet, within: s.row.range ?? shieldReach(s.activity.range), inCombat: !!combat, tempHP,
          chitStands: turnChitStands(defender, "rider", `shield:${s.key}`)
        });
        if ( !judged.due ) continue;
        // The claim, on the damage message, before the dice: one payout per ward per hit.
        const claim = `${t.uuid}|${s.key}`;
        let claimed = false;
        try {
          await queueFlagWrite(damageMessage, "damageShields", current => {
            if ( !Array.isArray(current.paid) ) current.paid = [];
            if ( current.paid.includes(claim) ) return false;
            current.paid.push(claim);
            claimed = true;
          });
        } catch(err) {
          console.warn(`${TITLE} | Could not claim ${s.key}'s payout on the damage card — the ward strikes by hand.`, err);
          continue;
        }
        if ( !claimed ) continue;
        await pay({ damageMessage, attackMessage, attacker, defender, ward: s, judged, distanceFeet, combat });
      }
    }
  } catch(err) {
    console.error(`${TITLE} | Damage shield payout failed — roll the ward's damage by hand.`, err);
  }
}

/* --- the payout: the ward's own dice, in the open, at the attacker ------------------------- */

async function pay({ damageMessage, attackMessage, attacker, defender, ward, judged, distanceFeet, combat }) {
  const { key, row, activity, source, type, scaling } = ward;
  // The chit first, so a second hit in the same tick finds it; out of combat every hit strikes.
  if ( (row.when === "oncePerTurn") && combat ) {
    await writeTurnChit(defender, "rider", { name: `${key} — struck this turn`, img: source.item.img ?? null,
      description: `${key} has struck an attacker this turn; once per turn. This chit ends with the turn.`,
      origin: source.item.uuid, riderKey: `shield:${key}` }).catch(() => {});
  }
  // No message here: posted below as the DEFENDER's, so nothing reads it as a cast.
  let rolls = [];
  try {
    rolls = await activity.rollDamage(scaling > 0 ? { scaling } : {}, { configure: false }, { create: false });
  } catch(err) {
    console.error(`${TITLE} | Could not roll ${key}'s damage.`, err);
  }
  const record = { ...statContext(defender.uuid), key, attackId: attackMessage.id, damageId: damageMessage.id,
    defenderName: defender.name, attackerName: attacker.name, attackerUuid: attacker.uuid,
    why: judged.why, distanceFeet: distanceFeet ?? null, rule: row.rule, effectName: ward.effect?.name ?? key,
    ...(ward.also ? { also: ward.also } : {}) };
  if ( !rolls?.length ) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: defender }),
      content: bfCard({ img: source.item.img, eyebrow: "Damage shield", tone: "neutral",
        title: `${key} — its dice could not be read`, subtitle: `${defender.name}'s ward, at ${attacker.name}`,
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { damageShield: { ...record, rolled: false } } } });
    return;
  }
  if ( type ) for ( const r of rolls ) { r.options ??= {}; if ( !r.options.types?.length || r.options.types.includes(type) ) r.options.type = type; }
  const total = rolls.reduce((n, r) => n + (r.total ?? 0), 0);
  const formula = rolls.map(r => r.formula).join(" + ");
  const typeOut = rolls[0]?.options?.type ?? type ?? null;
  const rollMessage = await rolls[0].toMessage({
    speaker: ChatMessage.getSpeaker({ actor: defender }),
    flavor: `${key} — ${defender.name}'s ward strikes ${attacker.name}`,
    rolls,
    flags: { [MODULE_ID]: { damageShield: { ...record, rolled: true, formula, total, type: typeOut } } }
  });
  if ( !(rollMessage instanceof ChatMessage) ) return;
  // Through the receipt chokepoint at the ATTACKER; a monster the driver cannot write is spoken for.
  if ( canApplyTo(attacker) ) {
    await applyDamagesWithReceipt(rollMessage, [{ uuid: attacker.uuid, name: attacker.name }], damagePartsOf(rolls),
      { note: `${key} on ${defender.name}` });
  } else {
    await whisperNoGM(`${key}'s damage to ${attacker.name}`, "The roll stands — apply it from the card's damage tray.");
  }
}

/* --- the mark: a ward the pack ships no effect for (Armor of Agathys) ------------------------ */

// The casting client writes a chip named as the spell (the use-chip idiom); refreshed, never doubled.
listen("dnd5e.postUseActivity", "damage-shields", (activity, _usageConfig, results) => {
  try {
    const item = activity?.item;
    const actor = activity?.actor;
    if ( !item || !actor?.isOwner ) return;
    const row = rowFor(item);
    if ( !row?.mark || !listed().has(lower(row.key)) ) return;
    if ( row.cast && (lower(activity.name) !== lower(row.cast)) ) return;
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    const spellLevel = Number(castLevelOn(message) ?? item.system?.level ?? 0);
    const scaling = Math.max(0, spellLevel - Number(item.system?.level ?? 0));
    void writeMark(actor, item, row, { spellLevel, scaling, message });
  } catch(err) {
    console.error(`${TITLE} | Could not mark the ward's cast — the shield strikes by hand.`, err);
  }
});

async function writeMark(actor, item, row, { spellLevel, scaling, message }) {
  const stale = actor.effects.filter(e => e.getFlag(MODULE_ID, "shield")?.key === row.key);
  if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
  const seconds = durationSeconds(item.system?.duration);
  const effect = await ActiveEffect.implementation.create({
    name: item.name, img: item.img ?? "icons/svg/ice-aura.svg",
    description: `${await ruleHTML(row.rule)}<p>Written by Battle Flow when ${esc(item.name)} was cast${spellLevel ? ` at level ${spellLevel}` : ""}; it strikes back at every melee hit while the Temporary Hit Points last, and ends with them.</p>`,
    origin: item.uuid, disabled: false, transfer: false,
    ...(seconds ? { duration: { seconds } } : {}),
    flags: { [MODULE_ID]: { shield: { key: row.key, itemUuid: item.uuid, spellLevel, scaling } } }
  }, { parent: actor });
  if ( message ) {
    await message.setFlag(MODULE_ID, "shieldMark", { ...statContext(actor.uuid), key: row.key, effectId: effect?.id ?? null, spellLevel, rule: row.rule })
      .catch(() => { /* the chip stands; only the card line is lost */ });
  }
}

// The pool at zero ends the mark, on the bearer's elect; the strike that emptied it has already paid.
listen("updateActor", "damage-shields", (actor, changes) => {
  try {
    if ( !(actor instanceof Actor) ) return;
    if ( foundry.utils.getProperty(changes, "system.attributes.hp.temp") === undefined ) return;
    if ( Number(actor.system?.attributes?.hp?.temp ?? 0) > 0 ) return;
    const marks = actor.effects.filter(e => { const m = e.getFlag(MODULE_ID, "shield"); return m && DAMAGE_SHIELDS[m.key]?.while === "tempHP"; });
    if ( !marks.length || !drivesMomentFor(actor.uuid) || !canApplyTo(actor) ) return;
    // One ending per bearer at a time: two deletes of the same chip in one tick make the second throw.
    if ( endings.has(actor.uuid) ) return;
    endings.add(actor.uuid);
    void endMarks(actor, marks).finally(() => endings.delete(actor.uuid));
  } catch(err) {
    console.error(`${TITLE} | Could not end the ward with its pool.`, err);
  }
});

const endings = new Set();

async function endMarks(actor, marks) {
  const live = marks.map(e => e.id).filter(id => actor.effects.get(id));
  if ( !live.length ) return;
  await actor.deleteEmbeddedDocuments("ActiveEffect", live);
  for ( const e of marks ) {
    const key = e.getFlag(MODULE_ID, "shield")?.key ?? e.name;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({ img: e.img, eyebrow: "Damage shield", tone: "neutral",
        title: `${key} ends — ${actor.name} has no Temporary Hit Points left`,
        lines: [ruleLine(DAMAGE_SHIELDS[key]?.rule ?? "")] }),
      flags: { [MODULE_ID]: { shieldEnded: { ...statContext(actor.uuid), key } } } });
  }
}

/* --- the cards say it (R5) -------------------------------------------------------------------- */

listen("dnd5e.renderChatMessage", "damage-shields", (message, html) => {
  const ds = message.getFlag(MODULE_ID, "damageShield");
  if ( ds ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: "Damage shield", tone: ds.rolled ? "bad" : "neutral",
      title: ds.rolled
        ? `${ds.key} on ${ds.defenderName} — ${ds.formula}${ds.type ? ` ${ds.type}` : ""} to ${ds.attackerName}`
        : `${ds.key} on ${ds.defenderName} — its dice could not be read`,
      subtitle: `${ds.attackerName} hit ${ds.defenderName} with a melee attack${(ds.distanceFeet !== null) && (ds.distanceFeet !== undefined) ? ` from ${ds.distanceFeet} feet` : ""} · ${ds.why}${ds.also ? ` · both ${ds.effectName} and ${ds.also} stand — the first pays` : ""}`,
      lines: [ruleLine(ds.rule)]
    });
    html.querySelector(SURFACES.messageContent)?.appendChild(line);
  }
  const mark = message.getFlag(MODULE_ID, "shieldMark");
  if ( mark ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      eyebrow: "Damage shield", tone: "good",
      title: `${mark.key} — the ward stands${mark.spellLevel ? ` (level ${mark.spellLevel})` : ""}`,
      subtitle: "every melee hit strikes back while the Temporary Hit Points last",
      lines: [ruleLine(mark.rule)]
    });
    html.querySelector(SURFACES.messageContent)?.appendChild(line);
  }
});
