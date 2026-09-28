// @ts-check
/**
 * Battle Flow — auto-apply damage, the shared receipt applier, and the payout pipeline. Split shape (ARCHITECTURE.md §7).
 */
import { MODULE_ID, TITLE, drivesMomentFor, canApplyTo, whisperNoGM, queueFlagWrite, statContext, isActiveGM } from "./core.js";
import { receiptEntry, joinDamageReceipt } from "./decide/receipt.js";
import { interruptMultiplier, reduceDamages } from "./decide/verdict.js";
import { INTERRUPT_MULTIPLIERS } from "./decide/registry.js";
import { hitTargets, resolveAttackMessage, damagePartsOf, statSourceOf } from "./shared.js";
import { CARD, isCard } from "./decide/card.js";
import { DICE_CHANGE_FLAG, DICE_CHANGE_WAITS } from "./decide/dice-changers.js";
import { registerResumable } from "./ui.js";
import { applyEffectRiders } from "./effect-riders.js";
import { resolveHitMastery } from "./mastery.js";
import { sequenceBashOffer } from "./bash-offer.js";

/* --- Auto-apply damage to hit targets ---------------------------------------------------------- */

/** The payout's subject is the ATTACKER (the chain writes on the attack message); null means GM-only. */
function payoutSubject(message) {
  try { return resolveAttackMessage(message)?.getAssociatedActor?.()?.uuid ?? null; }
  catch { return null; }
}

// FLAGLESS resumable, judged at creation; a hold or a pending dice changer holds it, and each
// settling write is the bus event. ⚠ The `attackDamage|<id>` latch guards re-entry: over-applying is the worst failure.
const eitherWaits = message => DICE_CHANGE_WAITS.includes(message.getFlag(MODULE_ID, DICE_CHANGE_FLAG)?.status);
registerResumable("attackDamage", {
  flagless: true,
  pending: (_flag, message, cause) => (cause === "create")
    || ((message.getFlag(MODULE_ID, "attackHoldPending") === false) && !message.getFlag(MODULE_ID, "receipt"))
    || (!!message.getFlag(MODULE_ID, DICE_CHANGE_FLAG) && !eitherWaits(message) && !message.getFlag(MODULE_ID, "receipt")),
  drives: (_flag, message) => drivesMomentFor(payoutSubject(message)),
  drive: resolveAttackDamage
});

async function resolveAttackDamage(message) {
  if ( !isCard(message, CARD.damage) ) return; // healing is typed "healing"
  const attackMessage = resolveAttackMessage(message);
  if ( !attackMessage ) return;
  if ( message.getFlag(MODULE_ID, "attackHoldPending") === true ) {
    // Claimed for a hold: a hold already RESOLVED (released before this roll landed) applies now.
    const hold = attackMessage.getFlag(MODULE_ID, "hold");
    if ( !hold || (hold.status === "pending") ) return;
  }
  if ( eitherWaits(message) ) return;
  if ( message.getFlag(MODULE_ID, "receipt") ) return;
  const hits = hitTargets(attackMessage);
  if ( !hits.length ) return; // every target Shield-flipped: the dice do nothing
  await resolveDamagePayouts(message, attackMessage, hits);
}

/** ⚠ Sequential: the mastery gates (Vex, Slow: damage DEALT) read the receipt the application writes. */
async function resolveDamagePayouts(damageMessage, attackMessage, hits) {
  // Application and effect riders write to the TARGET: gated, and said aloud when this client cannot.
  const writable = hits.filter(t => {
    try { return canApplyTo(fromUuidSync(t.uuid)); } catch { return false; }
  });
  const blocked = hits.length - writable.length;

  if ( writable.length ) await applyToHitTargets(damageMessage, attackMessage, writable);
  if ( blocked ) await whisperNoGM(`damage to ${blocked} target${blocked === 1 ? "" : "s"}`,
    "The roll stands — apply it from the card's damage tray.");
  // Per target: the damage riders' all-targets intersection rule does NOT apply to effects.
  if ( writable.length ) {
    await applyEffectRiders(damageMessage, attackMessage, writable);
  }
  await resolveHitMastery(damageMessage, attackMessage, hits);
  // The hit's offer opens after the damage and any pending mastery decision (decide/sequence.js).
  await sequenceBashOffer(attackMessage, { damageLanded: true });
}

async function applyToHitTargets(damageMessage, attackMessage, hits) {
  const damages = damagePartsOf(damageMessage.rolls);
  // A held attack lands per reactor (Uncanny Dodge's multiplier): one application per group.
  const hold = attackMessage?.getFlag(MODULE_ID, "hold");
  const groups = new Map();
  for ( const target of hits ) {
    const entry = (hold?.status === "resolved") ? hold.targets?.find(t => t.uuid === target.uuid) : null;
    const found = entry ? interruptMultiplier(entry, INTERRUPT_MULTIPLIERS) : null;
    // A reaction that REDUCES by a roll (Parry): the number the answer carried.
    const reduce = (entry?.answer === "cast") && (Number(entry.reduceBy) > 0) ? Number(entry.reduceBy) : 0;
    const note = found?.note ?? (reduce ? `${entry.reaction} — reduced by ${reduce}` : undefined);
    const key = `${found?.multiplier ?? 1}|${note ?? ""}|${reduce}`;
    if ( !groups.has(key) ) groups.set(key, { multiplier: found?.multiplier ?? 1, note, reduce, hits: [] });
    groups.get(key).hits.push(target);
  }
  for ( const { multiplier, note, reduce, hits: group } of groups.values() ) {
    await applyDamagesWithReceipt(damageMessage, group, reduce ? reduceDamages(damages, reduce) : damages, { multiplier, ...(note ? { note } : {}) });
  }
}

/**
 * THE DAMAGE CLAIMS: a machine may claim a target's share before it lands (a "when you take damage"
 * reaction) and apply it later with `held: true`, never claimed again. A throwing claim is ignored.
 * @type {Array<(receiptMessage: ChatMessage, target: {uuid: string, name: string}, actor: Actor,
 *   damages: object[], opts: {multiplier: number, note?: string}) => boolean>}
 */
const damageClaims = [];

export function registerDamageClaim(claim) {
  damageClaims.push(claim);
}

function claimed(receiptMessage, target, actor, damages, opts) {
  for ( const claim of damageClaims ) {
    try { if ( claim(receiptMessage, target, actor, damages, opts) ) return true; }
    catch(err) { console.error(`${TITLE} | A damage claim failed — the damage lands whole.`, err); }
  }
  return false;
}

/**
 * The shared applier: Actor5e#applyDamage per target, the receipt stamped on `receiptMessage` (the
 * ATTACK card for Graze, which has no damage message).
 * @param {any} receiptMessage
 * @param {{uuid: string, name: string}[]} hits
 * @param {object[]} damages
 * @param {{note?: string, multiplier?: number, held?: boolean}} [opts]
 */
export async function applyDamagesWithReceipt(receiptMessage, hits, damages, { note, multiplier = 1, held = false } = {}) {
  try {
    const context = statContext(statSourceOf(receiptMessage));
    const receipts = [];
    for ( const target of hits ) {
      const actor = await fromUuid(target.uuid); // the targets snapshot carries ACTOR uuids
      if ( !(actor instanceof Actor) || !actor.system.attributes?.hp ) continue;
      if ( !held && claimed(receiptMessage, target, actor, damages, { multiplier, ...(note ? { note } : {}) }) ) continue;
      const src = actor.system._source.attributes.hp;
      const prior = { value: src.value, temp: src.temp, tempmax: src.tempmax };

      // calculateDamage annotates WHY (a 9 that lands as 0); never recompute di/dr/dv by hand.
      // ⚠ It fires the calculate-damage hooks a second time.
      const calc = actor.calculateDamage(damages, { multiplier, originatingMessage: receiptMessage });

      await actor.applyDamage(damages, {
        multiplier, isDelta: true, originatingMessage: receiptMessage, origin: receiptMessage
      });
      const after = actor.system._source.attributes.hp;
      // fighting-styles.js's block and ignored Resistance.
      const block = calc?.bfArmorBlock;
      const ignored = (calc?.bfIgnored ?? []).map(i => `${i.feature} — ignores ${i.types.join(", ")} resistance`);
      const said = [note, block?.amount ? `${block.feature} — blocked ${block.amount}` : null, ...ignored].filter(Boolean).join(" · ") || note;
      receipts.push(receiptEntry({
        uuid: target.uuid, name: target.name, img: actor.img,
        note: said, multiplier, prior, after, calc, context
      }));
    }
    if ( receipts.length ) {
      // ⚠ Through `queueFlagWrite`: concurrent merges would drop each other's entries.
      await queueFlagWrite(receiptMessage, "receipt", existing => {
        joinDamageReceipt(existing, receipts);
      });
    }
  } catch(err) {
    console.error(`${TITLE} | Auto-apply failed.`, err);
  }
}

/**
 * Move ALREADY-applied damage by a reroll's difference as its own revertable receipt; lower heals
 * back. GM only. ARCHITECTURE §11 *Adding a FOLD* rule 4.
 * @param {ChatMessage} message
 * @param {{delta: number, feature: string}} outcome
 */
export async function moveAppliedDamage(message, { delta, feature }) {
  const receipt = message.getFlag(MODULE_ID, "receipt");
  const targets = (receipt?.targets ?? []).filter(t => !t.reverted);
  if ( !targets.length || !delta ) return;
  const type = message.rolls?.[0]?.options?.type ?? null;
  if ( !isActiveGM() ) {
    await whisperNoGM(`${feature} moved the damage by ${delta > 0 ? "+" : ""}${delta} on ${targets.map(t => t.name).join(", ")} — already applied; adjust by hand`);
    return;
  }
  for ( const t of targets ) {
    const multiplier = Number(t.multiplier ?? 1) || 1;
    const amount = Math.abs(delta);
    const damages = delta > 0 ? [{ value: amount, type }] : [{ value: amount, type: "healing" }];
    await applyDamagesWithReceipt(message, [{ uuid: t.uuid, name: t.name }], damages,
      { note: delta > 0 ? `${feature} — the reroll` : `${feature} — rerolled lower`, multiplier });
  }
}

