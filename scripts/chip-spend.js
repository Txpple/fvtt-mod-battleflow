/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the chip spend — the attack roll that uses up a Vex or Sap
 * chip (or a listed effect's marker), receipted on the attack card — and the tidies of expired chips.
 */
import { MODULE_ID, TITLE, isActiveGM, drivesMomentFor, canApplyTo, whisperNoGM, queueFlagWrite,
  statContext } from "./core.js";
import { EFFECT_BENDS } from "./decide/registry.js";
import { TURN_CHIPS, CHIP_FLAG, chipOwnedBy, chipSpentBy, netShownFor, rollModeOf, spendRecord } from "./decide/chips.js";
import { REMINDER_FLAG, rolledWith } from "./decide/reminders.js";
import { chipSpentOnRecord, masteryLabel } from "./shared.js";
import { effectEntries, listedNames } from "./decide/registry.js";
import { bfCard } from "./decide/present.js";
import { messageActivity } from "./effect-riders.js";
import { SURFACES } from "./surfaces.js";
import { CARD, isCard, targetsOf } from "./decide/card.js";

// The spend: the rules spend Vex and Sap on the NEXT attack roll, honoured or not. The record lands on the
// attack message FIRST (a later rescue reads it), the chips go second. Elect-driven: Vex is a write to the monster.
Hooks.on("createChatMessage", message => {
  if ( !isCard(message, CARD.attack) ) return;
  const attacker = messageActivity(message)?.item?.actor ?? null;
  if ( !attacker || !drivesMomentFor(attacker.uuid) ) return;
  void spendChips(message, { attacker });
});

/** Chips whose spend is in flight on this client — recorded, not yet deleted: a volley's next ray must
 * not meet a chip already spent (`chipSpentOnRecord` covers the log). */
const spendingNow = new Set();

async function spendChips(message, ctx) {
  const claimed = [];
  try {
    const attacker = ctx.attacker;
    const chipKey = e => e.getFlag(MODULE_ID, CHIP_FLAG);
    // A chip's origin is the WEAPON that applied it; the attacker owns it when that weapon is theirs.
    const owned = e => chipOwnedBy(e.origin, attacker.uuid);
    // Already spent — on the log, or by the roll a moment before this one — is not spent again.
    const unspent = e => !spendingNow.has(e.id) && !chipSpentOnRecord(e);
    const spent = [];
    // The bearer attacking: its own Sap, from anyone.
    for ( const e of attacker.effects ) {
      const key = chipKey(e);
      if ( key && unspent(e) && chipSpentBy(key, { bearer: "attacker", attackerOwnsChip: owned(e) }) ) {
        spent.push({ actor: attacker, effect: e, key });
      }
    }
    // The bearer attacked: this attacker's own Vex on it.
    for ( const t of targetsOf(message) ) {
      const actor = await fromUuid(t.uuid);
      if ( !(actor instanceof Actor) || (actor.uuid === attacker.uuid) ) continue;
      for ( const e of actor.effects ) {
        const key = chipKey(e);
        if ( key && unspent(e) && chipSpentBy(key, { bearer: "target", attackerOwnsChip: owned(e) }) ) {
          spent.push({ actor, effect: e, key });
        }
      }
    }
    // EFFECT_BENDS rows with `spend: "attack"`, on either side.
    const spendRows = new Map(Object.entries(EFFECT_BENDS).filter(([, r]) => r.spend === "attack")
      .map(([k, r]) => [k.toLowerCase(), r]));
    if ( spendRows.size ) {
      const listed = listedNames(effectEntries());
      const rowFor = (e, side) => {
        const r = spendRows.get(String(e.name ?? "").toLowerCase());
        if ( !(r?.[side] && listed.has(String(e.name).toLowerCase())) ) return null;
        // `only: "source"` (Feinting Attack): a target's marker is spent by ITS source's roll alone.
        if ( (r.only === "source") && (side === "target") && (e.getFlag(MODULE_ID, "sourceUuid") !== attacker.uuid) ) return null;
        return r;
      };
      for ( const e of attacker.effects ) {
        if ( rowFor(e, "attacker") && unspent(e) ) spent.push({ actor: attacker, effect: e, key: "effect" });
      }
      for ( const t of targetsOf(message) ) {
        const actor = await fromUuid(t.uuid);
        if ( !(actor instanceof Actor) || (actor.uuid === attacker.uuid) ) continue;
        for ( const e of actor.effects ) {
          if ( rowFor(e, "target") && unspent(e) ) spent.push({ actor, effect: e, key: "effect" });
        }
      }
    }
    if ( !spent.length ) return;
    for ( const s of spent ) { spendingNow.add(s.effect.id); claimed.push(s.effect.id); }

    const mode = rollModeOf(message.rolls?.[0]?.options?.advantageMode);
    // Where the gate stood in for the dialog, honour is the press matching the NET it showed (Vex and Sap
    // net Normal, honouring both), for the kinds it listed.
    const reminder = message.getFlag(MODULE_ID, REMINDER_FLAG) ?? null;
    const records = spent.map(s => spendRecord({ id: s.effect.id, name: s.effect.name, img: s.effect.img,
      key: s.key, bearerUuid: s.actor.uuid, bearerName: s.actor.name, mode, net: netShownFor(reminder, s.key) }));
    // The record first, deduped by chip id so a twin elect converges rather than doubling.
    await queueFlagWrite(message, "chipSpend", flag => {
      flag.spent ??= [];
      for ( const r of records ) if ( !flag.spent.some(x => x.id === r.id) ) flag.spent.push(r);
      Object.assign(flag, statContext(attacker.uuid)); // the data-plane stamp, once per flag
    });
    // ⚠ ONE batched delete per actor: a synthetic actor rebuilds its collections on every write,
    // so one-at-a-time throws on the second (NOTES §1).
    const byActor = new Map();
    for ( const s of spent ) {
      if ( !byActor.has(s.actor) ) byActor.set(s.actor, []);
      byActor.get(s.actor).push(s.effect.id);
    }
    for ( const [actor, ids] of byActor ) {
      if ( !canApplyTo(actor) ) {
        await whisperNoGM(`the spent ${ids.length === 1 ? "chip" : "chips"} on ${actor.name}`,
          "The attack card records the spend; the chip stays until a GM is connected or its window closes.");
        continue;
      }
      const live = ids.filter(id => actor.effects.get(id));
      if ( live.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", live);
    }
  } catch(err) {
    console.error(`${TITLE} | Chip spend failed.`, err);
  } finally {
    for ( const id of claimed ) spendingNow.delete(id);
  }
}

// The tidy: Foundry stamps `duration.expired` on the GM client but the document lingers; a deleted combat
// ends every window, so its chips go too (the hold's `reactionSpent` among them — nothing else clears it).
/** Expired chips awaiting the tidy, per parent — flushed on a microtask (see below). */
const expiryTidy = new Map();

/** The tidy owns the module's chips and the hold's reaction effect (an expired Shield left on the sheet
 * reads as still up); a hand-dragged pack effect is not ours. */
const tidyOwns = effect => !!effect.getFlag(MODULE_ID, CHIP_FLAG) || !!effect.getFlag(MODULE_ID, "reactionEffect");

Hooks.on("updateActiveEffect", (effect, changes) => {
  if ( changes?.duration?.expired !== true ) return;
  if ( !tidyOwns(effect) || !(effect.parent instanceof Actor) ) return;
  if ( !isActiveGM() ) return;
  // ⚠ COLLECTED, THEN ONE DELETE PER PARENT: this hook fires per effect of one batched update, and two
  // deletes on a synthetic actor throw (NOTES §1); the microtask runs after the dispatch loop.
  const parent = effect.parent;
  if ( !expiryTidy.has(parent) ) {
    expiryTidy.set(parent, new Set());
    queueMicrotask(() => void tidyExpiredChips(parent));
  }
  expiryTidy.get(parent).add(effect.id);
});

async function tidyExpiredChips(parent) {
  const ids = [...(expiryTidy.get(parent) ?? [])].filter(id => parent.effects.get(id));
  expiryTidy.delete(parent);
  if ( !ids.length ) return;
  try {
    await parent.deleteEmbeddedDocuments("ActiveEffect", ids);
  } catch(err) {
    // Already gone — a twin elect, a hand, or the spend that beat the clock.
    if ( ids.some(id => parent.effects.get(id)) ) console.warn(`${TITLE} | Expired chip tidy failed on ${parent.name}.`, err);
  }
}

Hooks.on("deleteCombat", combat => {
  if ( !isActiveGM() ) return;
  void sweepCombatChips(combat);
});

async function sweepCombatChips(combat) {
  try {
    // One pass per ACTOR, parallel across actors, never within one (NOTES §1).
    const actors = new Set(combat.combatants.map(c => c.actor).filter(a => a instanceof Actor));
    await Promise.all([...actors].map(async actor => {
      // …and the reaction's self-cast effect clocked to this combat.
      const ids = actor.effects.filter(e => TURN_CHIPS.includes(e.getFlag(MODULE_ID, CHIP_FLAG))
        || (e.getFlag(MODULE_ID, "reactionEffect") && (e._source.start?.combat === combat.id))).map(e => e.id);
      if ( !ids.length ) return;
      try {
        await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
      } catch(err) {
        // Already gone is fine; only a chip that REMAINS is worth a word.
        if ( ids.some(id => actor.effects.get(id)) ) console.warn(`${TITLE} | Combat chip sweep failed on ${actor.name}.`, err);
      }
    }));
  } catch(err) {
    console.error(`${TITLE} | Combat chip sweep failed.`, err);
  }
}

// The receipt: the attack card says which chip this roll used up and whether it was honoured (R5).
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const spend = message.getFlag(MODULE_ID, "chipSpend");
  for ( const r of (spend?.spent ?? []) ) {
    const line = document.createElement("div");
    line.innerHTML = bfCard({
      img: r.img, eyebrow: `Weapon Mastery — ${masteryLabel(r.key)}`,
      tone: r.honoured ? "good" : "neutral",
      title: `${r.name} — spent`,
      // One vocabulary with the reminder line above (decide/reminders.js `rolledWith`).
      subtitle: `${r.bearer}: ${r.key === "sap" ? "its" : "the attacker's"} next attack roll was this one, `
        + `rolled ${rolledWith(r.mode)}${r.honoured === false ? " — the chip went unclaimed" : ""}.`
    });
    html.querySelector(SURFACES.messageContent)?.appendChild(line);
  }
});
