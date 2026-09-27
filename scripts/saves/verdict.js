/**
 * Battle Flow — MACHINE, part of scripts/saves/ (ARCHITECTURE.md §7): the VERDICT — the fold against
 * the stored DC, the die-less folds, the demand's registration, and the legendary-resistance flip.
 * index.js is the directory's only public face and fixes the registration order.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite } from "../core.js";
import { resistedOf } from "../decide/card.js";
import { SAVE_FOLDS, foldedSave, foldsFrom } from "../decide/verdict.js";
import { registerDemand, demandAnsweredBy, registerWithheld, withholds } from "../ui.js";
import { revertEffect } from "../effect-riders.js";
import { disarmSaveTimer } from "./ask.js";
import { applySaveConsequences, evasionApplies, noneOnSuccessFor, saveDamageMessages, applyOneSaveDamage } from "./consequences.js";

/**
 * THE FOLD WITHOUT A DIE: a save the rules fail before the roll, recorded as a failure. The buzzer
 * takes this path too: rolling dice the rules already failed would contradict the table.
 */
export async function foldSaveAutoFail(card, uuid, { sources = [], timedOut = false } = {}) {
  const key = `${card.id}|${uuid}`;
  if ( saveFolds.has(key) ) return;
  saveFolds.add(key);
  try {
    const failing = sources.filter(s => s.autoFail);
    let folded = false;
    let allDone = false;
    await queueFlagWrite(card, "saves", current => {
      if ( current.status !== "pending" ) return false;
      const entry = current.targets?.find(t => !t.done && (t.uuid === uuid));
      if ( !entry ) return false;
      entry.done = true;
      entry.outcome = "failed";
      entry.total = null;
      entry.rollMessageId = null;
      entry.autoFailed = true;
      entry.autoFailedBy = failing.map(s => s.statusName).join(", ");
      if ( timedOut ) entry.timedOut = true;
      if ( current.targets.every(t => t.done) ) {
        current.status = "done";
        allDone = true;
      }
      folded = true;
    });
    if ( !folded ) return;
    if ( allDone ) disarmSaveTimer(card.id);
    await applySaveConsequences(card, uuid, null);
  } finally {
    saveFolds.delete(key);
  }
}

/** The mirror: a save the rules PASS before the roll, recorded as a success. */
export async function foldSaveAutoSucceed(card, uuid, { sources = [], timedOut = false } = {}) {
  const key = `${card.id}|${uuid}`;
  if ( saveFolds.has(key) ) return;
  saveFolds.add(key);
  try {
    const passing = sources.filter(s => s.autoSucceed);
    let folded = false;
    let allDone = false;
    await queueFlagWrite(card, "saves", current => {
      if ( current.status !== "pending" ) return false;
      const entry = current.targets?.find(t => !t.done && (t.uuid === uuid));
      if ( !entry ) return false;
      entry.done = true;
      entry.outcome = "saved";
      entry.total = null;
      entry.rollMessageId = null;
      entry.autoSucceeded = true;
      entry.autoSucceededBy = [...new Set(passing.map(s => s.feature ?? s.label))].join(", ");
      if ( timedOut ) entry.timedOut = true;
      if ( current.targets.every(t => t.done) ) {
        current.status = "done";
        allDone = true;
      }
      folded = true;
    });
    if ( !folded ) return;
    if ( allDone ) disarmSaveTimer(card.id);
    await applySaveConsequences(card, uuid, null);
  } finally {
    saveFolds.delete(key);
  }
}

/* The demand's three answer channels: the module's own roll (`saveFor`), a roll chained to the card
 * (never one chained elsewhere), and a bare sheet roll for the oldest pending demand — which DEFERS
 * to a pending concentration ask (priority 0 to this 1; the two cannot be told apart). */
registerDemand("saves", {
  priority: 1, chained: true,
  answering: (flag, f) => (flag && f.saveFor) ? { uuid: f.saveFor } : null,
  pendingEntry: (flag, f) => ((flag.status === "pending") && flag.abilities?.includes(f.ability))
    ? (flag.targets ?? []).find(t => !t.done && (t.uuid === f.actorUuid)) ?? null : null,
  pendingFor: (flag, uuid) => (flag.status === "pending") ? (flag.targets ?? []).find(t => !t.done && (t.uuid === uuid)) ?? null : null
});
/** Which pending demand target a save roll answers, or null. */
export function saveAnsweredBy(rollMessage) {
  const found = demandAnsweredBy(rollMessage);
  if ( found?.flagKey !== "saves" ) return null;
  const first = found.matches[0];
  return first ? { card: first.card, uuid: first.entry.uuid } : null;
}

/** Same-client fold latch: the create watcher, the buzzer and the render resume can race. */
const saveFolds = new Set();

// The withheld side: a verdict paused for an offer is finished by the same fold, via the spine.
registerWithheld("saves", {
  resume: ({ cardId, uuid }, rollMessage) => {
    const card = game.messages.get(cardId);
    return card ? foldSaveAnswer(card, uuid, rollMessage) : undefined;
  }
});

export async function foldSaveAnswer(card, uuid, rollMessage) {
  const key = `${card.id}|${uuid}`;
  if ( saveFolds.has(key) ) return;
  saveFolds.add(key);
  try {
    const total = rollMessage.rolls?.[0]?.total;
    if ( typeof total !== "number" ) return;
    // `resisted` too: legendary resistance may beat the fold to the message (a resume after a reload).
    const forced = resistedOf(rollMessage);
    const timedOut = rollMessage.getFlag(MODULE_ID, "timedOut") === true;

    /* ⚠ THE D20 FOLD OFFER: WITHHOLD, DO NOT UNDO. The verdict applies the instant it folds, so an
     * offer pauses it here, gated on the FAILURE. The registry FAILS OPEN; `saveFolds` releases on
     * the early return so the resume can re-enter. */
    if ( !forced && !timedOut ) {
      const dc = card.getFlag(MODULE_ID, "saves")?.dc;
      if ( await withholds(rollMessage, { by: "saves", card, uuid, total, dc }) ) return;
    }
    // ⚠ THROUGH THE SERIALIZER: two targets can fold at once; a clone-mutate-set drops one.
    let folded = false;
    let allDone = false;
    await queueFlagWrite(card, "saves", current => {
      if ( current.status !== "pending" ) return false;
      const entry = current.targets?.find(t => !t.done && (t.uuid === uuid));
      if ( !entry ) return false;
      entry.done = true;
      // Through the fold seam (`SAVE_FOLDS`). ⚠ Folds are read off the ROLL message, not the card.
      const judged = foldedSave({
        total, dc: current.dc, forced,
        folds: foldsFrom(key => rollMessage.getFlag(MODULE_ID, key), SAVE_FOLDS)
      });
      entry.outcome = judged.outcome;
      entry.total = judged.total;
      if ( judged.made && !forced ) {
        entry.madeBy = (rollMessage.getFlag(MODULE_ID, "d20fold")?.spends ?? []).find(s => s.kind === "succeed")?.label ?? "succeeded instead";
      }
      entry.rollMessageId = rollMessage.id;
      if ( evasionApplies(rollMessage.getAssociatedActor?.(), current) ) entry.evasion = true;
      // Circle of Power: a success against half-on-save spell damage takes none.
      const noneBy = noneOnSuccessFor(rollMessage.getAssociatedActor?.(), current);
      if ( noneBy ) entry.noneOnSuccess = noneBy;
      if ( timedOut ) entry.timedOut = true;
      if ( forced ) entry.forced = true;
      if ( current.targets.every(t => t.done) ) {
        current.status = "done";
        allDone = true;
      }
      folded = true;
    });
    if ( !folded ) return;
    if ( allDone ) disarmSaveTimer(card.id);
    await applySaveConsequences(card, uuid, rollMessage);
  } finally {
    saveFolds.delete(key);
  }
}

/* Legendary resistance, the one late answer: resistSave stamps `system.resisted` on the SAVE message
 * AFTER the failure landed. The elect flips the entry, un-applies the failure (receipt-exact) and
 * re-applies the success. */

export async function flipForcedSave(rollMessage) {
  try {
    for ( const card of game.messages.contents ) {
      const found = card.getFlag(MODULE_ID, "saves")?.targets?.find(
        t => t.rollMessageId === rollMessage.id);
      if ( !found ) continue;
      if ( found.outcome !== "failed" ) return;
      // ⚠ The failed-check repeats INSIDE the serializer so two racing flips cannot both claim it.
      let flipped = null;
      await queueFlagWrite(card, "saves", current => {
        const entry = current.targets?.find(t => t.rollMessageId === rollMessage.id);
        if ( entry?.outcome !== "failed" ) return false;
        entry.outcome = "saved";
        entry.forced = true;
        // Cleared so the corrected verdict is not taken for a duplicate.
        entry.announced = false;
        flipped = foundry.utils.deepClone(entry);
      });
      if ( !flipped ) return;
      const entry = flipped;
      // ALWAYS unwind, whatever `applied` says: the receipts are the truth (empty ones are a no-op).
      await unwindFailedConsequences(card, entry);
      return; // one roll answers one entry
    }
  } catch(err) {
    console.error(`${TITLE} | Legendary-resistance flip failed.`, err);
  }
}

async function unwindFailedConsequences(card, entry) {
  // Remove what only a failure grants, by NAME (the applied document's id is per-target).
  const flag = card.getFlag(MODULE_ID, "saves");
  const keep = new Set(flag?.effectNames?.always ?? []);
  const receipt = card.getFlag(MODULE_ID, "effectReceipt");
  for ( const e of (receipt?.targets?.find(t => t.uuid === entry.uuid)?.effects ?? []) ) {
    if ( e.reverted || keep.has(e.name) ) continue;
    await revertEffect(card, entry.uuid, e.id);
  }
  // Revert the damage, then re-apply at the success multiplier DIRECTLY (the deliberate exception to
  // the reconcile guard). ⚠ LAZY: a static import would register receipts.js's row ahead of ours.
  const { revertTarget } = await import("../receipts.js");
  for ( const dmg of saveDamageMessages(card) ) {
    const had = dmg.getFlag(MODULE_ID, "receipt")?.targets
      ?.find(t => (t.uuid === entry.uuid) && !t.reverted);
    if ( !had ) continue;
    await revertTarget(dmg, entry.uuid);
    if ( setting(S.autoApply) ) await applyOneSaveDamage(dmg, flag, entry);
  }
}
