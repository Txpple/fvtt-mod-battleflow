/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): the AUTOMATIC REDUCTION — a reduction "when you take
 * damage" taken by itself, before ANY damage the module applies lands (the Goliath walk,
 * 2026-09-25: "what is the level of effort to trigger stones endurance on any damage applied from
 * not only attack but also applied damage from a spell" — ruled "Hold before it lands"; then, off
 * the walk of that build: "the rule should be stones endurance reduces automatically"). The row is
 * decide/registry.js INTERRUPT_REDUCTIONS with `auto: true` (Stone's Endurance); Parry stays an
 * attack hold's question.
 *
 * THE SEAM is the applier's claim (auto-apply.js `registerDamageClaim`): every damage the module
 * applies — an attack hit's, a save's, an area's, an emanation's pulse, a rider's, a shield's —
 * passes through `applyDamagesWithReceipt`, and before a target's share lands this machine claims
 * it when the bearer can take the reduction (HP up, the Reaction unspent, a use left). The claim
 * rolls the reduction IN THE OPEN (its own card, the record the moment gate reads), spends the use
 * and the Reaction, and lands the share through the same applier (`held`, never claimed twice),
 * short by the roll, the receipt row saying why. No question is asked: that is the ruling.
 *
 * ⚠ ONE CLAIM PER SHARE: a save's damage reaches the applier twice (the damage hook fires twice
 * per roll — metamagic.js measured it), and a claimed share has no receipt yet to stop the second
 * pass — the walk's two popups for one Constrict. The claim latches `receipt|target` for a window.
 *
 * ⚠ THE BEND (RULINGS' register): damage applied with the card's OWN buttons, or typed on a sheet,
 * never passes the module's applier — Stone's Endurance there is the table's.
 *
 * THE ORDER, by the rule: a save's multiplier (half on a success) first, then the reduction, then
 * the system's own resistances and immunities as it applies the number (PHB: resistance "after all
 * other modifiers to damage").
 * ------------------------------------------------------------------------------------------- */
import { MODULE_ID, TITLE, statContext } from "./core.js";
import { lower, itemNamed, reductionFor } from "./lookup.js";
import { interruptEntries } from "./settings.js";
import { INTERRUPT_REDUCTIONS } from "./decide/registry.js";
import { reduceDamages } from "./decide/verdict.js";
import { poolOf, reactionSpent, spendReaction, spendSuperiorityDie } from "./shared.js";
import { applyDamagesWithReceipt, registerDamageClaim } from "./auto-apply.js";

const NOT_DAMAGE = new Set(["healing", "temphp"]);
/** `receiptId|targetUuid` → when it was claimed; a second pass inside the window is the same share. */
const claimed = new Map();
const CLAIM_WINDOW_MS = 30_000;

/** The listed automatic reduction this actor can take now — `{ name, item, activity, formula, pool }` or null. */
function autoReductionOf(actor) {
  for ( const entry of interruptEntries() ) {
    const key = Object.keys(INTERRUPT_REDUCTIONS).find(k => lower(k) === lower(entry.name));
    const row = key ? INTERRUPT_REDUCTIONS[key] : null;
    if ( !row?.auto ) continue;
    const item = itemNamed(actor, key);
    const found = item ? reductionFor(item, key) : null;
    if ( !found ) continue;
    const pool = row.pool ? poolOf(actor, found.activity) : null;
    if ( row.pool && !(Number(pool?.system?.uses?.value ?? 0) > 0) ) continue;
    return { name: key, item, activity: found.activity, formula: found.formula, pool };
  }
  return null;
}

registerDamageClaim((receiptMessage, target, actor, damages, { multiplier = 1, note } = {}) => {
  if ( !damages?.length || damages.every(d => NOT_DAMAGE.has(d.type)) ) return false;
  const key = `${receiptMessage.id}|${target.uuid}`;
  const at = claimed.get(key);
  if ( at && ((Date.now() - at) < CLAIM_WINDOW_MS) ) return true;     // the same share, again
  if ( !(Number(actor.system?.attributes?.hp?.value ?? 0) > 0) ) return false;
  if ( reactionSpent(actor) ) return false;
  const found = autoReductionOf(actor);
  if ( !found ) return false;
  claimed.set(key, Date.now());
  void reduceAndLand(receiptMessage, target, actor, damages, { multiplier, note }, found);
  return true;
});

async function reduceAndLand(receiptMessage, target, actor, damages, { multiplier, note }, found) {
  let by = 0;
  try {
    const roll = await new Roll(Roll.replaceFormulaData(String(found.formula), actor.getRollData())).evaluate();
    by = Math.max(0, Number(roll.total) || 0);
    const poolSpend = found.pool ? await spendSuperiorityDie(actor, found.pool, found.name).catch(() => null) : null;
    await spendReaction(actor, { origin: found.item.uuid, what: found.name });
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${found.name} — reduces the damage by ${by}`,
      flags: { [MODULE_ID]: { damageHold: { ...statContext(receiptMessage.getAssociatedActor?.()?.uuid ?? null),
        actorUuid: actor.uuid, reaction: found.name, target: { uuid: target.uuid, name: target.name ?? actor.name },
        receiptId: receiptMessage.id, answer: "auto", reduceBy: by, poolSpend } } }
    });
  } catch(err) {
    console.error(`${TITLE} | ${found.name}'s reduction could not be rolled — the damage lands whole; reduce by hand.`, err);
    by = 0;
  }
  let shares = damages;
  let applyMultiplier = multiplier;
  let why = note;
  if ( by > 0 ) {
    // The save's multiplier first, then the reduction (the rule's order).
    if ( multiplier !== 1 ) shares = damages.map(d => ({ ...d, value: Math.floor((Number(d.value) || 0) * multiplier) }));
    shares = reduceDamages(shares, by);
    applyMultiplier = 1;
    why = `${note ? `${note} · ` : ""}${found.name} — reduced by ${by}`;
  }
  await applyDamagesWithReceipt(receiptMessage, [target], shares, { multiplier: applyMultiplier, ...(why ? { note: why } : {}), held: true });
}
