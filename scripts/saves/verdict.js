/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the VERDICT — the fold (the elect judges the roll against the stored
 * DC, through the fold seam and the withhold), the die-less fold, the demand's registration, the
 * public verdict line and its twin supersede, the legendary-resistance flip and its unwind.
 * The machine-tier pass, Stage 4c (2026-09-05, ruling 3): saves.js became this directory —
 * one flag, one machine, one part per spine step; index.js is the only public face and fixes
 * the registration order. Every body here is the one saves.js carried; nothing was rewritten.
 */
import { MODULE_ID, TITLE, S, setting, queueFlagWrite, 
  drivesMomentFor } from "../core.js";
import { resolveUuid } from "../lookup.js";
import { SAVE_FOLDS, foldedSave, foldsFrom, verdictText } from "../decide/verdict.js";
import { bfCard } from "../decide/present.js";
import { registerDemand, demandAnsweredBy, registerWithheld, withholds } from "../ui.js";
import { revertEffect } from "../effect-riders.js";
import { disarmSaveTimer } from "./ask.js";
import { applySaveConsequences, evasionApplies, noneOnSuccessFor, saveDamageMessages, applyOneSaveDamage } from "./consequences.js";

/**
 * THE FOLD WITHOUT A DIE: a save the rules fail before it is rolled, recorded as the failure
 * it is. The same write `foldSaveAnswer` makes — `done`, the outcome, the card closing when
 * every target is in — with no roll message and the condition standing where the total would.
 * The consequences follow exactly as for a rolled failure. The buzzer takes this path too for
 * a target that cannot succeed (`timedOut`): rolling dice the rules have already failed would
 * be the module contradicting the table.
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

/* --- the fold: the elect judges the roll against the stored DC ------------------------------ */

/** Which pending demand target a save roll answers, or null. */
// Declared to the spine's demand registry (Stage 2, 2026-09-05), the three channels as before:
//   1) The module's own roll — `respondsTo` + `saveFor`: exact by construction; a stamp without
//      the target is another machine's channel.
//   2) Chained to a demand card — the native card's own save button arrives this way (buildPost
//      stamps originatingMessage from the click's enclosing card). A save chained to any OTHER
//      message belongs to that chain and is never read as an answer here.
//   3) A bare sheet roll answers the oldest pending demand naming this actor with a matching
//      ability — DEFERRING to a pending concentration ask (priority 0 to this 1; the two cannot
//      be told apart; simultaneous pendings are a corner the topple fold already accepts).
registerDemand("saves", {
  priority: 1, chained: true,
  answering: (flag, f) => (flag && f.saveFor) ? { uuid: f.saveFor } : null,
  pendingEntry: (flag, f) => ((flag.status === "pending") && flag.abilities?.includes(f.ability))
    ? (flag.targets ?? []).find(t => !t.done && (t.uuid === f.actorUuid)) ?? null : null,
  pendingFor: (flag, uuid) => (flag.status === "pending") ? (flag.targets ?? []).find(t => !t.done && (t.uuid === uuid)) ?? null : null
});
export function saveAnsweredBy(rollMessage) {
  const found = demandAnsweredBy(rollMessage);
  if ( found?.flagKey !== "saves" ) return null;
  const first = found.matches[0];
  return first ? { card: first.card, uuid: first.entry.uuid } : null;
}

/** Same-client fold latch — the create watcher, the buzzer and the render resume can race. */
const saveFolds = new Set();

// The withheld side of the protocol (Stage 3b): a verdict this machine paused for an offer is
// finished by the same fold, handed back through the spine — d20-folds.js used to import it.
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
    // The stored DC is the authority (the ask's-DC rule) — plus forceSuccess, in case
    // legendary resistance beat the fold to the message (a resume after an elect reload).
    const forced = rollMessage.getFlag("dnd5e", "roll.forceSuccess") === true;
    const timedOut = rollMessage.getFlag(MODULE_ID, "timedOut") === true;

    /* --- THE D20 FOLD OFFER: WITHHOLD, DO NOT UNDO (v1.23.0) ---------------------------------
     *
     * ⚠ THIS IS THE ONE PLACE A FAILED SAVE CAN STILL BE PATCHED, and v1 shipped without it.
     * Three table reports in one session — Fireball, Shatter, Hold Person — all the same cause:
     * this function folds AND APPLIES the verdict the instant the roll lands, so an offer made
     * afterwards arrives after the damage is already on the sheet.
     *
     * ⚠ It is a WITHHOLD, exactly like a reaction hold pausing an attack chain, and never an
     * undo. Nothing has been applied at this point, so §11 rule 4's auto-revert debt is not
     * reached — which is the whole reason to pause HERE rather than let the verdict land and
     * take it back.
     *
     * ⚠ The offer is gated on the FAILURE, and it can be, because this side owns the DC (the
     * ask's-DC rule). That is the one thing a raw ability check can never do.
     *
     * ⚠ Legendary resistance and a timed-out roll are excluded: `forced` is a ruling rather than
     * arithmetic, and a save the clock already answered has nobody left at the keyboard.
     * ⚠ Asked of the spine's withhold registry (Stage 3b, 2026-09-05 — it used to be a lazy
     * import of d20-folds.js, the cycle's out-edge) and it FAILS OPEN there — a broken offer
     * must never swallow a verdict. `saveFolds` releases on the early return, so the resume can
     * re-enter here.
     */
    if ( !forced && !timedOut ) {
      const dc = card.getFlag(MODULE_ID, "saves")?.dc;
      if ( await withholds(rollMessage, { by: "saves", card, uuid, total, dc }) ) return;
    }
    // ⚠ THROUGH THE SERIALIZER (core.js): per-target independence means two targets can fold
    // their answers against this one card at the same instant, and a clone-mutate-set drops
    // whichever landed first. A lost fold re-demands a target that has already rolled.
    let folded = false;
    let allDone = false;
    await queueFlagWrite(card, "saves", current => {
      if ( current.status !== "pending" ) return false;
      const entry = current.targets?.find(t => !t.done && (t.uuid === uuid));
      if ( !entry ) return false;   // nothing to fold — never write
      entry.done = true;
      // ⚠ THROUGH THE FOLD (D8, 2026-08-23). `SAVE_FOLDS` ships empty, so this is today's
      // arithmetic exactly — `saveOutcome(total, dc, forced)` with nothing added and nothing
      // replaced. What it buys is that the SEAM exists: a rerolled or boosted save lands by
      // declaring a spec, not by editing this resolver. The attack side had that channel since
      // v1.19.0 and the save side had none at all, which is the half of D8 that was real work.
      // ⚠ The folds are read off the ROLL MESSAGE, not off this card. A save-side fold changes
      // the number a particular roll produced, so it belongs on the roll — the same locality the
      // attack side uses, where the folds ride the attack message rather than the usage card.
      const judged = foldedSave({
        total, dc: current.dc, forced,
        folds: foldsFrom(key => rollMessage.getFlag(MODULE_ID, key), SAVE_FOLDS)
      });
      entry.outcome = judged.outcome;
      entry.total = judged.total;
      entry.rollMessageId = rollMessage.id;
      if ( evasionApplies(rollMessage.getAssociatedActor?.(), current) ) entry.evasion = true;
      // Circle of Power (2026-09-05): a success against half-on-save spell damage takes none.
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
    if ( !folded ) return;          // the guards above declined — no consequences either
    if ( allDone ) disarmSaveTimer(card.id);
    await applySaveConsequences(card, uuid, rollMessage);
  } finally {
    saveFolds.delete(key);
  }
}

/* --- the verdict line: a table moment opened in public is closed in public ------------------ *
 * v1.19.0 (FLOW item 7) — a deliberate, user-sanctioned REVERSAL of standing item 15's "NO
 * verdict announcement cards": the demand card's rows fold verdicts silently, so on scrollback
 * an open demand was indistinguishable from a stalled one — the same silence finding ⑤ priced
 * for Topple. One public card per verdict, tone by stakes (good holds / bad fails), wording
 * from verdictText so the card can never disagree with the row. It says the VERDICT and the
 * stakes-word only — never "damage landed" (autoApply may be off; verdictText already keeps
 * that honesty). Idempotence: `announced` is claimed through queueFlagWrite BEFORE posting —
 * two targets' consequence passes run concurrently against one card, which is exactly the
 * measured shape queueFlagWrite exists for. Twin-supersede below covers the two-elects race. */

export async function announceSaveVerdict(card, flag, entry) {
  try {
    if ( entry.announced ) return;
    let claimed = false;
    await queueFlagWrite(card, "saves", current => {
      const t = current.targets?.find(x => x.uuid === entry.uuid);
      if ( t && t.done && !t.announced ) { t.announced = true; claimed = true; }
    });
    if ( !claimed ) return;
    const saved = entry.outcome === "saved";
    // The line speaks AS THE SAVER, not the caster (v1.19.x finding ⑧ — "Thomas holds"
    // rendered under Salyth's card), and the title leads with the SOURCE (finding ⑦ —
    // the walk's global rule: the ability, then the result).
    const saver = resolveUuid(entry.uuid);
    await ChatMessage.create({
      speaker: (saver instanceof Actor) ? ChatMessage.getSpeaker({ actor: saver }) : card.speaker,
      content: bfCard({
        img: flag.item?.img ?? null,
        eyebrow: `Saving Throw — ${flag.item?.name ?? "the effect"}`,
        tone: saved ? "good" : "bad",
        title: saved ? `${flag.item?.name ?? "The effect"} — ${entry.name} holds`
                     : `${flag.item?.name ?? "The effect"} — ${entry.name} fails`,
        subtitle: verdictText(flag, entry) ?? ""
      }),
      flags: { [MODULE_ID]: { verdictLine: {
        sourceMessageId: card.id, uuid: entry.uuid,
        // Part of the supersede KEY: a legendary-resistance correction re-announces the same
        // (card, target) with forced=true, and must never be eaten as the fail line's twin.
        forced: !!entry.forced
      } } }
    });
  } catch(err) {
    console.error(`${TITLE} | Verdict line failed.`, err);
  }
}

/* The twin-line supersede — the topple card's sourceMessageId idiom, applied to the new
 * elect-posted card: isActiveGM() is per-USER, so two sessions on one account can both
 * announce. Keyed (sourceMessageId, uuid); the elder stays, the newcomer deletes itself. */
Hooks.on("createChatMessage", message => {
  const v = message.getFlag(MODULE_ID, "verdictLine");
  if ( !v?.sourceMessageId ) return;
  if ( !drivesMomentFor(game.messages.get(v.sourceMessageId)
    ?.getFlag(MODULE_ID, "saves")?.sourceUuid ?? null) ) return;
  const elder = game.messages.contents.some(m => {
    if ( m.id === message.id ) return false;
    const o = m.getFlag(MODULE_ID, "verdictLine");
    if ( !o || (o.sourceMessageId !== v.sourceMessageId) || (o.uuid !== v.uuid)
      || (!!o.forced !== !!v.forced) ) return false;
    return (m.timestamp < message.timestamp)
      || ((m.timestamp === message.timestamp) && (m.id < message.id));
  });
  if ( elder ) message.delete().catch(() => { /* the other twin got there first */ });
});

/* --- legendary resistance: the one late answer ----------------------------------------------
 * resistSave (npc.mjs) spends the resource and stamps `flags.dnd5e.roll.forceSuccess` onto
 * the SAVE message as an update — strictly after the failure landed, possibly after its
 * consequences did. The elect overturns the verdict: flip the entry, and if consequences
 * already ran, un-apply what the failure applied (receipt-exact) and re-apply what a success
 * grants. This is the corner Phase 2.5 recorded as accepted; Phase 2 owns it.
 * --------------------------------------------------------------------------------------------- */

export async function flipForcedSave(rollMessage) {
  try {
    for ( const card of game.messages.contents ) {
      const found = card.getFlag(MODULE_ID, "saves")?.targets?.find(
        t => t.rollMessageId === rollMessage.id);
      if ( !found ) continue;
      if ( found.outcome !== "failed" ) return; // already saved, or already flipped
      // ⚠ THROUGH THE SERIALIZER (core.js): the flip lands while this target's own
      // consequence pass may be mid-flight against the same card, and a clone-mutate-set
      // would overwrite whatever that pass had just recorded. The failed-check repeats
      // INSIDE the lock, so two flips racing the same roll cannot both claim it.
      let flipped = null;
      await queueFlagWrite(card, "saves", current => {
        const entry = current.targets?.find(t => t.rollMessageId === rollMessage.id);
        if ( entry?.outcome !== "failed" ) return false;
        entry.outcome = "saved";
        entry.forced = true;
        // The fail line already posted (v1.19.0) — clear the claim so the CORRECTED verdict
        // announces too. Two lines is honest history: the failure happened, then the
        // resistance overturned it; the forced marker keeps the twin-supersede from eating
        // the correction as a duplicate.
        entry.announced = false;
        flipped = foundry.utils.deepClone(entry);
      });
      if ( !flipped ) return;   // another writer claimed the flip first
      const flag = card.getFlag(MODULE_ID, "saves");   // post-flip, for the verdict line
      const entry = flipped;
      // ALWAYS unwind, whatever `applied` says: the effects pass and the damage pass are
      // independently timed (damage can land through the arrival path before the effects
      // pass marks `applied`), and the receipts are the truth of what actually happened —
      // an unwind over empty receipts is a no-op, and a still-pending consequence pass
      // re-reads the flipped flag after its pause and applies the success path itself.
      await unwindFailedConsequences(card, entry);
      await announceSaveVerdict(card, flag, entry);   // the corrected verdict, forced-marked
      return; // one roll answers one entry
    }
  } catch(err) {
    console.error(`${TITLE} | Legendary-resistance flip failed.`, err);
  }
}

async function unwindFailedConsequences(card, entry) {
  // Effects: remove what only a failure grants; keep what a success would also get. Matched
  // by NAME against the stamped onSave list — fuzzier than ids, but the applied document's
  // id is per-target and the source's isn't, and the realistic case (one effect, no onSave
  // twin) is exact.
  const flag = card.getFlag(MODULE_ID, "saves");
  const keep = new Set(flag?.effectNames?.always ?? []);
  const receipt = card.getFlag(MODULE_ID, "effectReceipt");
  for ( const e of (receipt?.targets?.find(t => t.uuid === entry.uuid)?.effects ?? []) ) {
    if ( e.reverted || keep.has(e.name) ) continue;
    await revertEffect(card, entry.uuid, e.id);
  }
  // Damage: revert the failure's application, then re-apply at the success multiplier
  // DIRECTLY (the reconcile guard treats any receipt entry as handled, so a manual revert
  // sticks — this path is the one deliberate exception, and the merge replaces the reverted
  // entry so the card ends up telling the final truth).
  // ⚠ Lazily bound on purpose: a static import of receipts.js would evaluate it BEFORE this
  // file and register its render row ahead of ours — the ESM order trap. The entry imports
  // saves/ before receipts.js so the verdict row renders above the receipt rows; keep it so.
  const { revertTarget } = await import("../receipts.js");
  for ( const dmg of saveDamageMessages(card) ) {
    const had = dmg.getFlag(MODULE_ID, "receipt")?.targets
      ?.find(t => (t.uuid === entry.uuid) && !t.reverted);
    if ( !had ) continue;
    await revertTarget(dmg, entry.uuid);
    if ( setting(S.autoApply) ) await applyOneSaveDamage(dmg, flag, entry);
  }
}
