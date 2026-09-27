/**
 * Battle Flow — auto-apply damage on the elect, the shared receipt applier, and the payout pipeline (application, then effect riders, then mastery).
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, drivesMomentFor, canApplyTo, whisperNoGM,
  queueFlagWrite, statContext, isActiveGM } from "./core.js";
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

/**
 * The payout chain's SUBJECT: the ATTACKER, since the chain writes on the attack message. Who
 * drives it is `drivesMomentFor` (ARCHITECTURE §3); null means GM-only.
 */
function payoutSubject(message) {
  try { return resolveAttackMessage(message)?.getAssociatedActor?.()?.uuid ?? null; }
  catch { return null; }
}

// FLAGLESS resumable: the damage roll is the system's message, judged at creation. Two claims hold
// the application: a hold (`attackHoldPending`, released by hold/continue.js) and a pending dice
// changer (`diceChange`); each settling write is the bus event, a render the reload resume.
// ⚠ The spine's `attackDamage|<id>` latch guards re-entry: over-applying is the worst failure.
const eitherWaits = message => DICE_CHANGE_WAITS.includes(message.getFlag(MODULE_ID, DICE_CHANGE_FLAG)?.status);
registerResumable("attackDamage", {
  flagless: true,
  pending: (_flag, message, cause) => (cause === "create")
    || ((message.getFlag(MODULE_ID, "attackHoldPending") === false) && !message.getFlag(MODULE_ID, "receipt"))
    || (!!message.getFlag(MODULE_ID, DICE_CHANGE_FLAG) && !eitherWaits(message) && !message.getFlag(MODULE_ID, "receipt")),
  drives: (_flag, message) => drivesMomentFor(payoutSubject(message))
    && (setting(S.autoApply) || setting(S.effectRiders) || setting(S.masteryRiders)),
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
  if ( eitherWaits(message) ) return;   // the dice changers' answer first
  if ( message.getFlag(MODULE_ID, "receipt") ) return;               // applied already (resume)
  const hits = hitTargets(attackMessage);
  if ( !hits.length ) return; // every target Shield-flipped: the dice do nothing, by ruling
  await resolveDamagePayouts(message, attackMessage, hits);
}

/**
 * Everything a damage roll pays out, in order: application, effect riders, then mastery.
 * ⚠ Sequential: the mastery gates (Vex, Slow: damage DEALT) read the receipt application writes.
 */
async function resolveDamagePayouts(damageMessage, attackMessage, hits) {
  // ⚠ Application and effect riders write to the TARGET: gated on the write and said aloud when a
  // player client cannot. The mastery chain guards its own writes.
  const writable = hits.filter(t => {
    try { return canApplyTo(fromUuidSync(t.uuid)); } catch { return false; }
  });
  const blocked = hits.length - writable.length;

  if ( setting(S.autoApply) ) {
    if ( writable.length ) await applyToHitTargets(damageMessage, attackMessage, writable);
    if ( blocked ) await whisperNoGM(`damage to ${blocked} target${blocked === 1 ? "" : "s"}`,
      "The roll stands — apply it from the card's damage tray.");
  }
  // Per target: the damage riders' all-targets intersection rule does NOT apply to effects.
  if ( setting(S.effectRiders) && writable.length ) {
    await applyEffectRiders(damageMessage, attackMessage, writable);
  }
  if ( setting(S.masteryRiders) ) await resolveHitMastery(damageMessage, attackMessage, hits);
  // The hit's offer opens only after the damage and any pending mastery decision (decide/sequence.js).
  await sequenceBashOffer(attackMessage, { damageLanded: true });
}

/** Apply a damage message's rolls to the given targets as the native tray would, and stamp the receipt. */
async function applyToHitTargets(damageMessage, attackMessage, hits) {
  const damages = damagePartsOf(damageMessage.rolls);
  // A held attack lands per reactor: a target whose reaction is in the multiplier table (Uncanny
  // Dodge) takes its share at that multiplier. One application per group.
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
 * THE DAMAGE CLAIMS: a machine may claim one target's share before it lands (a reaction to "when
 * you take damage" asked while the damage is a number) and apply it later with `held: true`,
 * which is never claimed again. Registered at module evaluation; a claim that throws is ignored.
 * @type {Array<(receiptMessage: ChatMessage, target: {uuid: string, name: string}, actor: Actor,
 *   damages: object[], opts: {multiplier: number, note?: string}) => boolean>}
 */
const damageClaims = [];

/** Declare a claimant on the applier. Called at module evaluation by a machine. */
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
 * The shared applier: land `damages` on every target through Actor5e#applyDamage (the system's
 * di/dr/dv and threshold math) and stamp the receipt onto `receiptMessage` (the ATTACK card for
 * Graze, which has no damage message). `note` and a non-1 `multiplier` show on the receipt row.
 */
export async function applyDamagesWithReceipt(receiptMessage, hits, damages, { note, multiplier = 1, held = false } = {}) {
  try {
    // The data-plane stamp, once per application: the receipt message's actor is the source.
    const context = statContext(statSourceOf(receiptMessage));
    const receipts = [];
    for ( const target of hits ) {
      const actor = await fromUuid(target.uuid); // the targets snapshot carries ACTOR uuids
      if ( !(actor instanceof Actor) || !actor.system.attributes?.hp ) continue;
      if ( !held && claimed(receiptMessage, target, actor, damages, { multiplier, ...(note ? { note } : {}) }) ) continue;
      const src = actor.system._source.attributes.hp;
      const prior = { value: src.value, temp: src.temp, tempmax: src.tempmax };

      // Ask the system WHY first: calculateDamage is side-effect-free and annotates each entry
      // with the multiplier story, so the receipt can explain a 9 that lands as 0. Never
      // recompute di/dr/dv by hand. ⚠ It fires the calculate-damage hooks a second time.
      const calc = actor.calculateDamage(damages, { multiplier, originatingMessage: receiptMessage });

      await actor.applyDamage(damages, {
        multiplier, isDelta: true, originatingMessage: receiptMessage, origin: receiptMessage
      });
      const after = actor.system._source.attributes.hp;
      // A block or an ignored Resistance (fighting-styles.js) says so on the row.
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
 * Move damage ALREADY applied by the difference after a reroll (ARCHITECTURE §11 *Adding a FOLD*
 * rule 4), as its own revertable receipt; a lower total heals back. Only the GM applies.
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

