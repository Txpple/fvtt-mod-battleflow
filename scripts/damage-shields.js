/**
 * Battle Flow — Damage shields: a standing ward on the DEFENDER pays out against the ATTACKER when a melee attack roll hits — the hit rider mirrored.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, activeCombatFor, canApplyTo, drivesMomentFor, queueFlagWrite, statContext, whisperNoGM } from "./core.js";
import { damageShieldEntries } from "./settings.js";
import { damagePartsOf, effectSourceOf, hitTargets, resolveAttackMessage, turnChitStands, writeTurnChit } from "./shared.js";
import { nearestFeet, tokenForUuid, tokenOfActor } from "./geometry.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { DAMAGE_SHIELDS } from "./decide/registry.js";
import { durationSeconds, shieldDue, shieldEffectNames, shieldReach, shieldType } from "./decide/shields.js";
import { messageActivity } from "./effect-riders.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";

/* ---------------------------------------------------------------------------------------------
 * DAMAGE SHIELDS (user, 2026-09-04 — "death armor needs its damage shield effect automated";
 * "not sure if that fits in a family"). It does not fit one of SWEEP §1's eight: it is a NINTH
 * shape, the hit rider MIRRORED. A standing effect on the DEFENDER — Death Armor's ward, Fire
 * Shield's warm or chill shield, Armor of Agathys' frost — pays out against the ATTACKER when a
 * melee attack roll hits, and there is no choice in it (DESIGN §2 R1: the machine may play an
 * outcome; judgment is what it never plays). The table is decide/registry.js DAMAGE_SHIELDS;
 * membership is the Damage Shields list.
 *
 *   THE WARD — found on the hit creature's sheet by the pack's effect NAME, and walked to its
 *   source the way a mark is (shared.js `effectSourceOf`: effect → origin item → caster). The
 *   warded creature need not be the caster (Death Armor is a touch spell on an ally), so the walk
 *   is the only way to the dice: the pack's damage activity on the CASTER's copy of the spell.
 *   Armor of Agathys ships no effect at all, so the module MARKS the cast itself (below).
 *
 *   THE HIT — judged on the attack's DAMAGE roll landing, on the elect (auto-apply's three
 *   triggers: arrival, the hold's release, render for resume). By then the hold has settled and
 *   `hitTargets` is final — a Shield that turned the hit into a miss pays nothing. A melee attack
 *   roll (the activity's own attack type), within the ward's own reach (the activity's range,
 *   over the distance the gate measures), once per turn where the text says so (a turn chit on
 *   the DEFENDER — the Cleave shape), while the temp HP stand for Agathys.
 *
 *   THE PAYOUT — the ward's activity is rolled by the elect with dnd5e's own roller (no message:
 *   the roll is posted here, as the defender's, so it can never be mistaken for a spell the
 *   caster pressed), the type set by the standing effect where the part offers several (Fire
 *   Shield's [cold, fire]), and applied to the attacker through the receipt chokepoint with a
 *   note naming the ward. One payout per ward per hit, claimed on the damage message BEFORE the
 *   dice (`damageShields.paid`), so a reload or a second client can never pay twice. With no GM
 *   the flow-elect law holds: the roll posts, the monster is not written, the driver is told.
 * ------------------------------------------------------------------------------------------- */

const lower = s => String(s ?? "").toLowerCase();
const listed = () => new Set(damageShieldEntries().map(e => lower(e.kind)));
const rowNamed = name => { const k = Object.keys(DAMAGE_SHIELDS).find(x => lower(x) === lower(name)); return k ? { key: k, ...DAMAGE_SHIELDS[k] } : null; };
const activityNamed = (item, name) => [...(item?.system?.activities ?? [])].find(a => lower(a.name) === lower(name)) ?? null;

/**
 * Every listed ward standing on this creature: the row, the standing effect, its source (actor
 * and item), the pack's damage activity, the type the effect decides, and the cast's upcast.
 * A ward whose source cannot be walked (a hand-dragged compendium effect) falls back to the
 * creature's OWN copy of the spell — right for a self-cast, and said in the console otherwise.
 * One entry per ward: a Fire Shield with both Warm and Chill standing pays once, as the first.
 */
function shieldsOn(defender) {
  const names = listed();
  const out = [];
  for ( const [key, row] of Object.entries(DAMAGE_SHIELDS) ) {
    if ( !names.has(lower(key)) ) continue;
    const wanted = new Set(shieldEffectNames(row));
    for ( const effect of defender.effects ) {
      if ( effect.disabled ) continue;
      let source = null;
      let scaling = 0;
      if ( row.mark ) {
        const mark = effect.getFlag(MODULE_ID, "shield");
        if ( mark?.key !== key ) continue;
        let item = null;
        try { item = mark.itemUuid ? fromUuidSync(mark.itemUuid) : null; } catch { item = null; }
        source = item ? { actor: item.actor ?? defender, item } : null;
        scaling = Number(mark.scaling ?? 0);
      } else {
        if ( !wanted.has(lower(effect.name)) ) continue;
        source = effectSourceOf(effect);
        if ( source && (lower(source.item?.name) !== lower(key)) ) source = null;
        if ( !source ) {
          const own = defender.items.find(i => lower(i.name) === lower(key)) ?? null;
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
  if ( message.getFlag("dnd5e", "roll.type") !== "damage" ) return null;
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

const runs = new Set();

function consider(message) {
  try {
    if ( !listed().size ) return;
    const attackMessage = settledMeleeAttack(message);
    if ( !attackMessage ) return;
    if ( runs.has(message.id) ) return;
    void settle(message, attackMessage);
  } catch(err) {
    console.error(`${TITLE} | Damage shield check failed.`, err);
  }
}

Hooks.on("createChatMessage", consider);
Hooks.on("updateChatMessage", consider);          // the hold's release
Hooks.on("dnd5e.renderChatMessage", consider);    // the reload resume

async function settle(damageMessage, attackMessage) {
  runs.add(damageMessage.id);
  try {
    const attacker = attackMessage.getAssociatedActor();
    if ( !attacker ) return;
    const hits = hitTargets(attackMessage);
    const attackerToken = tokenOfActor(attacker);
    for ( const t of hits ) {
      let defender = null;
      try { defender = fromUuidSync(t.uuid); } catch { defender = null; }
      if ( !(defender instanceof Actor) || (defender.uuid === attacker.uuid) ) continue;
      if ( !drivesMomentFor(defender.uuid) ) continue;   // the elect for this ward's bearer
      const wards = shieldsOn(defender);
      if ( !wards.length ) continue;
      const defenderToken = tokenForUuid(t.uuid);
      const distanceFeet = (attackerToken && defenderToken) ? nearestFeet(attackerToken, defenderToken) : null;
      // ⚠ Read BEFORE any await: Armor of Agathys strikes "while you have these Hit Points", and
      // the attack's own damage — applied by auto-apply on the same tick — may take the last of
      // them. The hit happened while the pool stood; the pool is read as it stood.
      const tempHP = Number(defender.system?.attributes?.hp?.temp ?? 0);
      const combat = activeCombatFor(defender);
      for ( const s of wards ) {
        const judged = shieldDue(s.row, {
          melee: true, distanceFeet, within: shieldReach(s.activity.range), inCombat: !!combat, tempHP,
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
  } finally {
    runs.delete(damageMessage.id);
  }
}

/* --- the payout: the ward's own dice, in the open, at the attacker ------------------------- */

async function pay({ damageMessage, attackMessage, attacker, defender, ward, judged, distanceFeet, combat }) {
  const { key, row, activity, source, type, scaling } = ward;
  // The once-per-turn chit on the DEFENDER — written first, so a second hit in the same tick
  // finds it standing. Out of combat there is no turn: nothing is written, every hit strikes.
  if ( (row.when === "oncePerTurn") && combat ) {
    await writeTurnChit(defender, "rider", { name: `${key} — struck this turn`, img: source.item.img ?? null,
      description: `${key} has struck an attacker this turn; once per turn. This chit ends with the turn.`,
      origin: source.item.uuid, riderKey: `shield:${key}` }).catch(() => {});
  }
  // The pack's own roller, no message: the dice are the activity's (its parts, its upcast
  // scaling), and the message is posted below as the DEFENDER's so nothing downstream reads
  // it as a spell the caster pressed — no chain, no attack, no target snapshot.
  let rolls = [];
  try {
    rolls = await activity.rollDamage(scaling > 0 ? { scaling } : {}, { configure: false }, { create: false });
  } catch(err) {
    console.error(`${TITLE} | Could not roll ${key}'s damage.`, err);
  }
  const record = { ...statContext(defender.uuid), key, attackId: attackMessage.id, damageId: damageMessage.id,
    defenderName: defender.name, attackerName: attacker.name, attackerUuid: attacker.uuid,
    why: judged.why, distanceFeet: distanceFeet ?? null, rule: row.rule, effectName: ward.effect.name,
    ...(ward.also ? { also: ward.also } : {}) };
  if ( !rolls?.length ) {
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: defender }),
      content: bfCard({ img: source.item.img, eyebrow: "Damage shield", tone: "neutral",
        title: `${key} — its dice could not be read`, subtitle: `${defender.name}'s ward, at ${attacker.name}`,
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { damageShield: { ...record, rolled: false } } } });
    return;
  }
  // The type follows the standing effect where the part offers several (Fire Shield).
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
  // Through the receipt chokepoint at the ATTACKER — the system's resistance math, a receipt
  // with a revert on the ward's own roll card. A monster the driver cannot write is spoken for.
  if ( canApplyTo(attacker) ) {
    await applyDamagesWithReceipt(rollMessage, [{ uuid: attacker.uuid, name: attacker.name }], damagePartsOf(rolls),
      { note: `${key} on ${defender.name}` });
  } else {
    await whisperNoGM(`${key}'s damage to ${attacker.name}`, "The roll stands — apply it from the card's damage tray.");
  }
}

/* --- the mark: a ward the pack ships no effect for (Armor of Agathys) ------------------------ */

// The casting client owns the caster: the cast's activity used (postUseActivity fires where
// `use()` ran) writes a chip named as the spell is, with the item's duration on the world clock
// and the cast's level for the upcast — the use-chip idiom (use-chips.js). A standing chip is
// refreshed, never doubled: a recast refreshes the temp HP too.
Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    const item = activity?.item;
    const actor = activity?.actor;
    if ( !item || !actor?.isOwner ) return;
    const row = rowNamed(item.name);
    if ( !row?.mark || !listed().has(lower(row.key)) ) return;
    if ( row.cast && (lower(activity.name) !== lower(row.cast)) ) return;
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    const spellLevel = Number(message?.system?.spellLevel ?? item.system?.level ?? 0);
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
    description: `<p><em>“${row.rule}”</em></p><p>Written by Battle Flow when ${item.name} was cast${spellLevel ? ` at level ${spellLevel}` : ""}; it strikes back at every melee hit while the Temporary Hit Points last, and ends with them.</p>`,
    origin: item.uuid, disabled: false, transfer: false,
    ...(seconds ? { duration: { seconds } } : {}),
    flags: { [MODULE_ID]: { shield: { key: row.key, itemUuid: item.uuid, spellLevel, scaling } } }
  }, { parent: actor });
  if ( message ) {
    await message.setFlag(MODULE_ID, "shieldMark", { ...statContext(actor.uuid), key: row.key, effectId: effect?.id ?? null, spellLevel, rule: row.rule })
      .catch(() => { /* the chip stands; only the card line is lost */ });
  }
}

// "The spell ends early if you have no Temporary Hit Points": the pool going to zero ends the
// mark — on the elect for the bearer, wherever the write may land. The strike that emptied the
// pool has already paid (the pool is read before the application lands).
Hooks.on("updateActor", (actor, changes) => {
  try {
    if ( !(actor instanceof Actor) ) return;
    if ( foundry.utils.getProperty(changes, "system.attributes.hp.temp") === undefined ) return;
    if ( Number(actor.system?.attributes?.hp?.temp ?? 0) > 0 ) return;
    const marks = actor.effects.filter(e => { const m = e.getFlag(MODULE_ID, "shield"); return m && DAMAGE_SHIELDS[m.key]?.while === "tempHP"; });
    if ( !marks.length || !drivesMomentFor(actor.uuid) || !canApplyTo(actor) ) return;
    // One ending per bearer at a time: the attack's damage and a tidy can both move the pool in
    // one tick, and two deletes of the same chip make the second throw (measured, first run).
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

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
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
    html.querySelector(".message-content")?.appendChild(line);
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
    html.querySelector(".message-content")?.appendChild(line);
  }
});
