/**
 * Battle Flow — Phase 1b: auto-apply damage on the active-GM elect, the shared receipt applier, and the payout pipeline (application, then effect riders, then mastery).
 * Split from battleflow.js (design.md §9); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, queueFlagWrite } from "./core.js";
import { hitTargets, resolveAttackMessage } from "./shared.js";
import { applyEffectRiders } from "./effect-riders.js";
import { resolveHitMastery } from "./mastery.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1b — auto-apply damage to hit targets (the active-GM elect; single writer)
 * ------------------------------------------------------------------------------------------- */

Hooks.on("createChatMessage", message => {
  if ( !isActiveGM() ) return;
  if ( !setting(S.autoApply) && !setting(S.effectRiders) && !setting(S.masteryRiders) ) return;
  void resolveAttackDamage(message);
});

// (gg) roll-now-apply-later: an attack held by a Shield-class reaction rolls its damage
// anyway (auto-damage.js stamps the roll `attackHoldPending`), and the application waits
// here for the hold's resolution to release the claim — the darts' spellHoldPending
// pattern, on the attack chain. The release write (pending → false, hold.js) is the bus
// event; render is the reload resume, exactly the spell applier's three triggers.
Hooks.on("updateChatMessage", message => {
  if ( !isActiveGM() ) return;
  if ( !setting(S.autoApply) && !setting(S.effectRiders) && !setting(S.masteryRiders) ) return;
  if ( message.getFlag(MODULE_ID, "attackHoldPending") !== false ) return;
  if ( message.getFlag(MODULE_ID, "receipt") ) return;
  void resolveAttackDamage(message);
});

Hooks.on("dnd5e.renderChatMessage", message => {
  if ( !isActiveGM() ) return;
  if ( !setting(S.autoApply) && !setting(S.effectRiders) && !setting(S.masteryRiders) ) return;
  if ( message.getFlag(MODULE_ID, "attackHoldPending") !== false ) return; // only ex-claimed rolls resume here
  if ( message.getFlag(MODULE_ID, "receipt") ) return;
  void resolveAttackDamage(message);
});

/** Re-entry guard for the three triggers above — the release write and a render can land in
 * the same tick, and over-applying damage is the worst failure this module has. */
const attackDamageRuns = new Set();

async function resolveAttackDamage(message) {
  if ( attackDamageRuns.has(message.id) ) return;
  attackDamageRuns.add(message.id);
  try {
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
  } finally {
    attackDamageRuns.delete(message.id);
  }
}

/**
 * Everything a damage roll pays out, in a deterministic order: damage application first,
 * then the card's effect riders, then the weapon mastery riding the attack — sequential
 * because the mastery gates (Vex and Slow trigger only when damage was DEALT) read the
 * receipt's per-target taken amounts, and a receipt only exists once application has run.
 * Each stage is independently gated by its own setting.
 */
async function resolveDamagePayouts(damageMessage, attackMessage, hits) {
  if ( setting(S.autoApply) ) await applyToHitTargets(damageMessage, hits);
  // Per-target application: the damage riders' split-target intersection refusal
  // deliberately does NOT apply to effects.
  if ( setting(S.effectRiders) ) await applyEffectRiders(damageMessage, attackMessage, hits);
  if ( setting(S.masteryRiders) ) await resolveHitMastery(damageMessage, attackMessage, hits);
}

/**
 * Apply a damage message's rolls to the given targets exactly as the native tray would, and
 * stamp the receipt. Damages are built with the system's own aggregation; application runs
 * through Actor5e#applyDamage so di/dr/dv, modification, threshold and temp-HP math stay
 * authoritative. The receipt records the pre-application SOURCE hp so a revert restores the
 * exact stored values.
 */
async function applyToHitTargets(damageMessage, hits) {
  const damages = dnd5e.dice.aggregateDamageRolls(damageMessage.rolls, { respectProperties: true })
    .map(roll => ({
      value: Math.max(0, roll.total),
      type: roll.options.type,
      properties: new Set(roll.options.properties ?? [])
    }));
  await applyDamagesWithReceipt(damageMessage, hits, damages);
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
      const traits = [];
      for ( const d of (calc || []) ) {
        const a = d.active ?? {};
        const outcome = a.threshold ? "threshold"
          : (a.multiplier === 0) ? "immune"
          : (a.multiplier === 0.5) ? "resistant"
          : (a.multiplier === 2) ? "vulnerable"
          : (a.all?.modification || a.type?.modification) ? "modified"
          : null; // resist+vuln cancel to ×1 and stay silent — the number didn't move
        if ( outcome && !traits.some(t => (t.type === d.type) && (t.outcome === outcome)) ) {
          traits.push({ type: d.type, outcome });
        }
      }

      await actor.applyDamage(damages, {
        multiplier, isDelta: true, originatingMessage: receiptMessage, origin: receiptMessage
      });
      const after = actor.system._source.attributes.hp;
      receipts.push({
        uuid: target.uuid,
        name: target.name,
        img: actor.img ?? null, // the portrait the row leads with (user call, 2026-08-15)
        ...(note ? { note } : {}),
        ...(multiplier !== 1 ? { multiplier } : {}),
        prior,
        delta: {
          value: (after.value ?? 0) - (prior.value ?? 0),
          temp: (after.temp ?? 0) - (prior.temp ?? 0)
        },
        // What the traits made of it: `taken` is the post-trait, pre-clamp total (a number
        // an assertion can trust at 0 HP, where the delta clamps to nothing), `traits` is
        // the reason list the row renders.
        taken: calc ? calc.amount : null,
        traits,
        reverted: false
      });
    }
    if ( receipts.length ) {
      // MERGE, never overwrite (v1.6.0): a spell hold can split one roll's application in
      // time — unheld targets land at once, a held target lands after its verdict — and
      // the second write must not eat the first's entries. Through `queueFlagWrite` so two
      // CONCURRENT writers cannot each merge into the same pre-read copy and drop one another's
      // entries — a lost entry also defeats reconcileSaveDamage's idempotence guard and the
      // damage lands twice. The measurement that found it is recorded in core.js.
      await queueFlagWrite(receiptMessage, "receipt", existing => {
        for ( const r of receipts ) {
          const i = existing.targets.findIndex(t => t.uuid === r.uuid);
          if ( i >= 0 ) existing.targets[i] = r; else existing.targets.push(r);
        }
      });
    }
  } catch(err) {
    console.error(`${TITLE} | Auto-apply failed.`, err);
  }
}

