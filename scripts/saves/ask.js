/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the ASK — the system's own saving-throw dialog wearing the demand's
 * fieldset (the gate's section is reminders.js's, on the same dialog), the straight data-driven
 * roll, and the buzzer that rolls whoever the clock catches.
 * The machine-tier pass, Stage 4c (2026-09-05, ruling 3): saves.js became this directory —
 * one flag, one machine, one part per spine step; index.js is the only public face and fixes
 * the registration order. Every body here is the one saves.js carried; nothing was rewritten.
 */
import { MODULE_ID, TITLE, queueFlagWrite } from "../core.js";
import { resolveUuid } from "../lookup.js";
import { rollConfigFor } from "../shared.js";
import { popupKey, bfCard, holdBarHTML } from "../decide/present.js";
import { livePopups, adoptManagedPopup, DialogCarried, scheduleBarSync, armAskTimer, disarmAskTimer } from "../ui.js";
import { SAVE_BENDS } from "../decide/registry.js";
import { saveGate, saveSources } from "../decide/reminders.js";
import { conditionEntries, reminderEntries } from "../settings.js";
import { foldSaveAnswer, foldSaveAutoFail } from "./verdict.js";

/* --- the roll: whoever owns the decision presses it ----------------------------------------- */

/** Same-client re-entry latch (render resume + the buzzer can volunteer in one tick). */
const saveRollsInFlight = new Set();

/** The message data every answer to a demand carries — chained to the card, and the exact channel. */
function saveAnswerData(card, uuid, timedOut) {
  return { data: { flags: {
    // Chained to the demand card so the system's registry ties the whole moment together — a
    // programmatic roll must pass this explicitly (no DOM click to inherit it from).
    dnd5e: { originatingMessage: card.id },
    // The exact answer channel: WHICH card, WHICH target. Immune to the getSpeaker
    // oldest-token trap by construction — the fold never has to resolve this roll's actor.
    [MODULE_ID]: { respondsTo: card.id, saveFor: uuid, ...(timedOut ? { timedOut: true } : {}) }
  } } };
}

/** Is this target still owed an answer — pending, unanswered, and no roll already on the log? */
function saveStillOwed(card, uuid) {
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  if ( !entry || entry.done || (flag.status !== "pending") ) return null;
  // An answer that already landed wins even though the entry still reads pending — the fold
  // is the elect's job and may not have caught up. Whole-log by flag, never a tail.
  if ( game.messages.some(m => (m.getFlag(MODULE_ID, "respondsTo") === card.id)
    && (m.getFlag(MODULE_ID, "saveFor") === uuid)) ) return null;
  return { flag, entry };
}

/**
 * Roll one target's save STRAIGHT, answering the demand: the buzzer's press, data-driven, no
 * dialog, sheet-borne modifiers still applying themselves. The stored DC rides as `target` so
 * the system's own success test marks the card and can never disagree with the fold. (The
 * human's press goes through `openSaveDialog` below — the system's own dialog, since option E.)
 */
async function rollSaveAnswer(card, uuid, { mode = null, bonus = null, timedOut = false } = {}) {
  const key = `${card.id}|${uuid}`;
  if ( saveRollsInFlight.has(key) ) return;
  saveRollsInFlight.add(key);
  try {
    const owed = saveStillOwed(card, uuid);
    if ( !owed ) return;
    const actor = await fromUuid(uuid);
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    await actor.rollSavingThrow(
      { ability: owed.flag.abilities[0], target: owed.flag.dc, ...rollConfigFor(mode, bonus) },
      { configure: false },
      saveAnswerData(card, uuid, timedOut)
    );
  } catch(err) {
    console.error(`${TITLE} | Save roll failed — roll it from the sheet.`, err);
  } finally {
    saveRollsInFlight.delete(key);
  }
}

/* ---------------------------------------------------------------------------------------------
 * THE DEMAND OPENS THE SYSTEM'S OWN SAVING THROW DIALOG (user ruling 2026-09-02 — option E of
 * *The Save Gate*: "the attack pattern"; the house save popup retires). One surface for every
 * save, forced or from the sheet: dnd5e's dialog, its own situational bonus and roll mode, its
 * own three buttons — and Battle Flow adds two fieldsets. THE DEMAND (who is rolling, the DC,
 * what a success buys, the timer bar) sits above the dialog's CONFIGURATION; the gate's section
 * — BEFORE YOU ROLL, the save table's bends under one header line, folded to the header like the
 * attack gate's — sits below it, and the highlighted default is the net. A save the rules FAIL
 * before any die (Paralyzed, Stunned, Unconscious, Petrified on Strength or Dexterity) grows a
 * fourth button, **Fails**, as the default: no dice, the failure recorded on the card with the
 * condition as the number's replacement. The human still presses (R1) — option C, the module
 * resolving with no press, was ruled out.
 *
 * Cascading, no queue (user, 2026-09-02): every pending demand for an actor opens its dialog,
 * stepped down the staircase; the GM's old "queue of saves" habit is gone with the popup.
 *
 * The dialog is enrolled in `livePopups` under the popup key the card row already uses, so the
 * update hook that closes an answered popup closes this one exactly as it did the house popup,
 * and the card's Roll button fronts it. The roll it produces is the same answer the popup
 * produced — the demand's chain and channel ride the message data — so the fold, the verdict,
 * the consequences and the receipts cannot tell the two apart. Dismissing (the X) is not an
 * answer: the dialog resolves to no roll, the row's button recalls it, the buzzer rolls.
 * ------------------------------------------------------------------------------------------- */

/** Dialogs on their way up — between the call and the render that enrols them in `livePopups`. */
const saveDialogsOpening = new Set();

/**
 * Open the system's Saving Throw dialog for one demanded target — the human's press (the
 * buzzer's straight roll is `rollSaveAnswer`). Recall fronts a live one. The demand rides
 * `dialog.options` as a DialogCarried so the render hook below meets the same object the
 * Fails button writes to; the roll's own flags ride the message data as every answer does.
 */
export async function openSaveDialog(card, uuid) {
  const key = popupKey(card.id, `save:${uuid}`);
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }
  if ( saveDialogsOpening.has(key) ) return;
  saveDialogsOpening.add(key);
  try {
    const owed = saveStillOwed(card, uuid);
    if ( !owed ) return;
    const actor = await fromUuid(uuid);
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    const demand = new DialogCarried({ cardId: card.id, uuid, failed: null });
    const rolls = await actor.rollSavingThrow(
      { ability: owed.flag.abilities[0], target: owed.flag.dc },
      { configure: true, options: { bfSaveDemand: demand } },
      saveAnswerData(card, uuid, false)
    );
    // Fails pressed: the dialog closed with no roll and the demand carries the sources that
    // failed it. The fold is the same fold — the number is the condition.
    if ( !rolls?.length && demand.failed ) await foldSaveAutoFail(card, uuid, { sources: demand.failed });
  } catch(err) {
    console.error(`${TITLE} | Save dialog failed — roll it from the sheet.`, err);
  } finally {
    saveDialogsOpening.delete(key);
  }
}

/** The demand's fieldset — who, the DC, the stakes, the bar — above the dialog's CONFIGURATION. */
function drawSaveDemand(app, element, demand) {
  const card = game.messages.get(demand.cardId);
  if ( !card ) return;
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === demand.uuid);
  // A question withdrawn between the ask and this render — the entry dropped by a template's
  // adoption (the Shatter strand), or answered elsewhere — closes here rather than standing:
  // the update sweep that closes answered popups runs on the WRITE, and this dialog was not
  // yet enrolled when that write landed (smoke-saves §8a2, 2026-09-02).
  if ( !entry || entry.done || (flag.status !== "pending") ) { void app.close(); return; }
  adoptManagedPopup(popupKey(card.id, `save:${demand.uuid}`), card, app);
  if ( element.querySelector("[data-bf-save-demand]") ) return;
  const actor = resolveUuid(demand.uuid);
  const ability = flag.abilities[0];
  const abilityLabel = CONFIG.DND5E.abilities[ability]?.label ?? ability;
  const stakes = [];
  if ( flag.hasDamage ) stakes.push(
    (flag.damageOnSave === "half") ? "A successful save <strong>halves</strong> the damage."
      : (flag.damageOnSave === "none") ? "A successful save avoids the damage <strong>entirely</strong>."
      : "The damage lands either way.");
  if ( flag.effectNames?.fail?.length ) stakes.push(
    `A failure also applies: <strong>${flag.effectNames.fail.join(", ")}</strong>.`);
  if ( flag.effectNames?.always?.length ) stakes.push(
    `Applies either way: <strong>${flag.effectNames.always.join(", ")}</strong>.`);
  const host = document.createElement("div");
  host.innerHTML = `<fieldset data-bf-save-demand><legend>The demand</legend>${bfCard({
    // WHO is rolling leads, portrait included — the creature is the load-bearing fact (user
    // call 2026-08-16); the spell is subtitle work.
    img: actor?.img ?? flag.item?.img ?? null,
    eyebrow: "Saving throw",
    title: `${entry.name}: ${abilityLabel} save, DC ${flag.dc}`,
    subtitle: `${flag.item?.name ?? "An effect"}${flag.casterName ? `, from ${flag.casterName}` : ""}`,
    lines: stakes, tone: "pending"
  })}${holdBarHTML(flag, "to roll")}</fieldset>`;
  const fieldset = host.firstElementChild;
  const configuration = element.querySelector('[data-application-part="configuration"]');
  const formulas = element.querySelector('[data-application-part="formulas"]');
  if ( configuration ) configuration.insertAdjacentElement("beforebegin", fieldset);
  else if ( formulas ) formulas.insertAdjacentElement("afterend", fieldset);
  else element.querySelector("form")?.prepend(fieldset);
  scheduleBarSync(element);
}

// The demand's fieldset on every render of a save dialog carrying one (the first, and each
// re-render the dialog's own dropdowns cause). polish.js rides the same hook for the target block
// and reminders.js for the gate's section; the entry order keeps their paint ahead of this insert.
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  try {
    const demand = app.options?.bfSaveDemand ?? null;
    // A demand carrying `present` is another machine's (Topple, concentration — ui.js
    // drawDemandFieldset paints those); this one builds from the saves flag and would close a
    // dialog whose card has no saves entry (bit 2026-09-03: the first concentration dialog
    // closed on render, adopted by nobody).
    if ( demand && !demand.present ) drawSaveDemand(app, element, demand);
  } catch(err) {
    console.error(`${TITLE} | Save dialog section failed to draw.`, err);
  }
});

/* --- the buzzer: expiry rolls, on the elect -------------------------------------------------- */

const saveTimers = new Map();
/** The demand's clock, off the flag's absolute deadline (a no-op without one) — views.js arms it
 * on every render and update, the reload-resume discipline. */
export function armSaveTimer(message) { return armAskTimer(saveTimers, message, "saves", fireSaveTimer); }
/** …and disarms it when nothing is pending or the card goes — the fold and the watchers call it. */
export function disarmSaveTimer(cardId) { return disarmAskTimer(saveTimers, cardId); }

/**
 * A save the rules fail before the dice — the save GATE's judgement (reminders.js judgeSave),
 * read here off decide/ directly: the save table's automatic failures are the only sources that
 * can fail a save, gated on the Condition Sources switch exactly as the gate is, so this
 * directory never imports the gate machine. Empty when the save can be rolled.
 */
function autoFailSources(actor, ability) {
  if ( !reminderEntries().some(e => e.kind === "condition") ) return [];
  const sources = saveSources({ statuses: actor.statuses ?? [], ability,
    enabled: conditionEntries().map(e => e.kind), table: SAVE_BENDS, name: actor.name });
  return saveGate(sources).autoFail ? sources : [];
}

async function fireSaveTimer(card) {
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag || (flag.status !== "pending") ) return;
  const goneNames = [];
  for ( const entry of flag.targets ) {
    if ( entry.done ) continue;
    // An unfolded answer beats the clock, not races it.
    const landed = game.messages.find(m => (m.getFlag(MODULE_ID, "respondsTo") === card.id)
      && (m.getFlag(MODULE_ID, "saveFor") === entry.uuid));
    if ( landed ) { void foldSaveAnswer(card, entry.uuid, landed); continue; }
    // A target that no longer exists has nobody to roll — void it, or the demand sits
    // pending forever with a buzzer that already fired (the concentration timer's rule).
    const actor = await fromUuid(entry.uuid).catch(() => null);
    if ( !(actor instanceof Actor) ) {
      // ⚠ THROUGH THE SERIALIZER (core.js): this runs inside a loop over every unanswered
      // target, so the buzzer writes the same card once per vanished target — the writes
      // overlap each other, never mind the consequence passes running alongside.
      let goneName = null;
      await queueFlagWrite(card, "saves", current => {
        const gone = current.targets?.find(t => !t.done && (t.uuid === entry.uuid));
        if ( !gone ) return false;
        gone.done = true;
        gone.outcome = "gone";
        gone.applied = true; // nothing to apply to
        gone.announced = true; // the merged card below is its line — never one per target
        if ( current.targets.every(t => t.done) ) current.status = "done";
        goneName = gone.name;
      });
      if ( goneName ) goneNames.push(goneName);
      continue;
    }
    // A dialog still standing on THIS client is the human's unanswered press: close it first
    // (it resolves to no roll) so the straight roll below is the only answer. Another
    // client's dialog closes off the fold's update, as the house popup always did.
    const open = livePopups.get(popupKey(card.id, `save:${entry.uuid}`));
    if ( open ) { try { await open.close(); } catch { /* already gone */ } }
    // A save the rules fail before the dice is recorded as that failure, not rolled.
    const failing = autoFailSources(actor, flag.abilities[0]);
    if ( failing.length ) { await foldSaveAutoFail(card, entry.uuid, { sources: failing, timedOut: true }); continue; }
    await rollSaveAnswer(card, entry.uuid, { timedOut: true });
  }
  // A "gone" verdict never reaches applySaveConsequences (stamped applied above), so its
  // public line emits here — ONE merged card however many vanished (v1.19.0, FLOW item 7).
  if ( goneNames.length ) {
    await ChatMessage.create({
      speaker: card.speaker,
      content: bfCard({
        img: flag.item?.img ?? null,
        eyebrow: `Saving Throw — ${flag.item?.name ?? "the effect"}`,
        tone: "neutral",
        title: goneNames.length === 1 ? `${goneNames[0]} is gone` : `${goneNames.join(", ")} are gone`,
        subtitle: "nothing to roll — the demand is closed for them"
      }),
      flags: { [MODULE_ID]: { verdictLine: { sourceMessageId: card.id, uuid: "gone" } } }
    }).catch(err => console.error(`${TITLE} | Gone line failed.`, err));
  }
}
