/**
 * Battle Flow — Phase 1b: auto-apply damage on the active-GM elect, the shared receipt applier, and the payout pipeline (application, then effect riders, then mastery).
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, drivesMomentFor, canApplyTo, whisperNoGM,
  queueFlagWrite, statContext } from "./core.js";
import { receiptEntry, joinDamageReceipt } from "./decide/receipt.js";
import { interruptMultiplier, reduceDamages } from "./decide/verdict.js";
import { INTERRUPT_MULTIPLIERS } from "./decide/registry.js";
import { hitTargets, resolveAttackMessage, damagePartsOf, statSourceOf } from "./shared.js";
import { registerResumable } from "./ui.js";
import { applyEffectRiders } from "./effect-riders.js";
import { resolveHitMastery } from "./mastery.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1b — auto-apply damage to hit targets (the active-GM elect; single writer)
 * ------------------------------------------------------------------------------------------- */

/**
 * The payout chain's SUBJECT for a damage roll — the ATTACKER, never the room: the chain's writes
 * land on the attack message, which only its author may update. Who drives it is core's one
 * question, `drivesMomentFor` (ARCHITECTURE §3, the driver table; this file's own copy of the
 * elect body, v1.27.0, folded away in Stage 5 of the machine-tier pass, 2026-09-05). An
 * unresolvable attacker resolves to null, which is the old GM-only answer.
 */
function payoutSubject(message) {
  try { return resolveAttackMessage(message)?.getAssociatedActor?.()?.uuid ?? null; }
  catch { return null; }
}

// The payouts' three triggers, declared to the spine's resumable registry (Stage 3, 2026-09-05),
// FLAGLESS: the attack's damage roll is the system's own message, judged at creation before
// anything of this module is on it. (gg) roll-now-apply-later: an attack held by a Shield-class
// reaction rolls its damage anyway (auto-damage.js stamps the roll `attackHoldPending`), and the
// application waits for the hold's resolution to release the claim — the darts' spellHoldPending
// pattern, on the attack chain. The release write (pending → false, hold/continue.js) is the bus event;
// render is the reload resume — only an ex-claimed, unreceipted roll resumes. The re-entry guard
// (the release write and a render can land in one tick, and over-applying damage is the worst
// failure this module has) is the spine's `attackDamage|<id>` latch now.
registerResumable("attackDamage", {
  flagless: true,
  pending: (_flag, message, cause) => (cause === "create")
    || ((message.getFlag(MODULE_ID, "attackHoldPending") === false) && !message.getFlag(MODULE_ID, "receipt")),
  drives: (_flag, message) => drivesMomentFor(payoutSubject(message))
    && (setting(S.autoApply) || setting(S.effectRiders) || setting(S.masteryRiders)),
  drive: resolveAttackDamage
});

async function resolveAttackDamage(message) {
  if ( message.getFlag("dnd5e", "roll.type") !== "damage" ) return; // healing is typed "healing"
  const attackMessage = resolveAttackMessage(message);
  if ( !attackMessage ) return;
  if ( message.getFlag(MODULE_ID, "attackHoldPending") === true ) {
    // Claimed for a hold. Belt and braces (the spell applier's own idiom): if the hold
    // has already RESOLVED — the release sweep ran before this roll landed — fall
    // through and apply per its verdicts; a live claim keeps waiting for the release.
    const hold = attackMessage.getFlag(MODULE_ID, "hold");
    if ( !hold || (hold.status === "pending") ) return;
  }
  if ( message.getFlag(MODULE_ID, "receipt") ) return;               // applied already (resume)
  const hits = hitTargets(attackMessage);
  if ( !hits.length ) return; // every target Shield-flipped: the dice do nothing, by ruling
  await resolveDamagePayouts(message, attackMessage, hits);
}

/**
 * Everything a damage roll pays out, in a deterministic order: damage application first,
 * then the card's effect riders, then the weapon mastery riding the attack — sequential
 * because the mastery gates (Vex and Slow trigger only when damage was DEALT) read the
 * receipt's per-target taken amounts, and a receipt only exists once application has run.
 * Each stage is independently gated by its own setting.
 */
async function resolveDamagePayouts(damageMessage, attackMessage, hits) {
  // ⚠ WITH NO GM, THE CONSEQUENCE STAGES ARE SKIPPED AND SAID OUT LOUD (v1.27.0). Damage
  // application and the effect riders both write to the TARGET, which a player client has no
  // permission to touch — so they are gated on the write instead of attempted and thrown.
  // The mastery chain below is NOT gated here: its cards, asks and popups are all
  // player-reachable, and it guards its own writes one payout at a time.
  const writable = hits.filter(t => {
    try { return canApplyTo(fromUuidSync(t.uuid)); } catch { return false; }
  });
  const blocked = hits.length - writable.length;

  if ( setting(S.autoApply) ) {
    if ( writable.length ) await applyToHitTargets(damageMessage, attackMessage, writable);
    if ( blocked ) await whisperNoGM(`damage to ${blocked} target${blocked === 1 ? "" : "s"}`,
      "The roll stands — apply it from the card's damage tray.");
  }
  // Per-target application: the damage riders' split-target intersection refusal
  // deliberately does NOT apply to effects.
  if ( setting(S.effectRiders) && writable.length ) {
    await applyEffectRiders(damageMessage, attackMessage, writable);
  }
  if ( setting(S.masteryRiders) ) await resolveHitMastery(damageMessage, attackMessage, hits);
}

/**
 * Apply a damage message's rolls to the given targets exactly as the native tray would, and
 * stamp the receipt. Damages are built with the system's own aggregation; application runs
 * through Actor5e#applyDamage so di/dr/dv, modification, threshold and temp-HP math stay
 * authoritative. The receipt records the pre-application SOURCE hp so a revert restores the
 * exact stored values.
 */
async function applyToHitTargets(damageMessage, attackMessage, hits) {
  const damages = damagePartsOf(damageMessage.rolls);
  // A HELD attack lands per reactor (user, 2026-09-02): a target whose damage-kind reaction
  // was cast and is in the multiplier table (Uncanny Dodge) takes its share at that
  // multiplier, with the receipt row saying why; everyone else takes it whole. The split is
  // by multiplier, so a two-rogue volley still makes one application per group.
  const hold = attackMessage?.getFlag(MODULE_ID, "hold");
  const groups = new Map();
  for ( const target of hits ) {
    const entry = (hold?.status === "resolved") ? hold.targets?.find(t => t.uuid === target.uuid) : null;
    const found = entry ? interruptMultiplier(entry, INTERRUPT_MULTIPLIERS) : null;
    // A reaction that REDUCES by a roll (Parry, 2026-09-05): the number the answer carried.
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
 * The shared applier: land `damages` on every target and stamp the receipt onto
 * `receiptMessage` (the damage card normally; the ATTACK card for Graze, where no damage
 * message exists because the attack missed). `note` rides each receipt entry and renders
 * beside the taken amount — it is how a Graze line says what it is.
 *
 * `multiplier` is threaded now so Phase 2 (half damage on a successful save) extends this
 * applier instead of forking it — today every caller passes the default 1, and a non-1
 * multiplier is recorded on the receipt entry so the row can say why the number halved.
 */
export async function applyDamagesWithReceipt(receiptMessage, hits, damages, { note, multiplier = 1 } = {}) {
  try {
    // The data-plane stamp, resolved ONCE per application while both facts are live: the
    // receipt message's own actor is the source (attacker, caster, healer — statSourceOf's
    // finding), and a held target landing on a LATER call gets that call's own context.
    const context = statContext(statSourceOf(receiptMessage));
    const receipts = [];
    for ( const target of hits ) {
      const actor = await fromUuid(target.uuid); // the targets snapshot carries ACTOR uuids
      if ( !(actor instanceof Actor) || !actor.system.attributes?.hp ) continue;
      const src = actor.system._source.attributes.hp;
      const prior = { value: src.value, temp: src.temp, tempmax: src.tempmax };

      // Ask the system's math WHY before letting it apply: calculateDamage is public and
      // side-effect-free (it deep-clones the array), and it annotates each entry's `active`
      // with the multiplier/threshold story applyDamage then acts on (actor.mjs:833-891).
      // The receipt keeps that story so the card can explain a rolled 9 that lands as a 0 —
      // reported live 2026-08-15: a cold-immune Ice Mephit "taking" Ray of Frost's 9 with
      // nothing on the card saying why. Recomputing di/dr/dv by hand here would drift from
      // bypasses/modification/threshold; asking the same method twice cannot. (The extra
      // pass fires the calculate-damage hooks one more read-only time; nothing in this
      // module or combatplus listens to them.)
      const calc = actor.calculateDamage(damages, { multiplier, originatingMessage: receiptMessage });

      await actor.applyDamage(damages, {
        multiplier, isDelta: true, originatingMessage: receiptMessage, origin: receiptMessage
      });
      const after = actor.system._source.attributes.hp;
      // The entry is arithmetic over the two snapshots and the system's own annotations —
      // prior → delta → taken → reason, all of it in decide/receipt.js.
      receipts.push(receiptEntry({
        uuid: target.uuid, name: target.name, img: actor.img,
        note, multiplier, prior, after, calc, context
      }));
    }
    if ( receipts.length ) {
      // Through `queueFlagWrite` (core.js) because the merge is only correct when the writes
      // are sequential: two CONCURRENT writers would each merge into the same pre-read copy
      // and drop one another's entries. The merge discipline itself — and what one lost entry
      // costs — is decide/receipt.js.
      await queueFlagWrite(receiptMessage, "receipt", existing => {
        joinDamageReceipt(existing, receipts);
      });
    }
  } catch(err) {
    console.error(`${TITLE} | Auto-apply failed.`, err);
  }
}

