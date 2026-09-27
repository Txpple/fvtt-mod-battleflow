/**
 * Battle Flow — MACHINE, a part of scripts/saves/ (ARCHITECTURE.md §7): the ASK — the system's
 * own saving-throw dialog wearing the demand's fieldset, the straight data-driven roll, and the
 * buzzer that rolls whoever the clock catches. index.js is the directory's only public face.
 */
import { MODULE_ID, TITLE, queueFlagWrite } from "../core.js";
import { resolveUuid } from "../lookup.js";
import { rollConfigFor } from "../shared.js";
import { popupKey, bfCard, holdBarHTML } from "../decide/present.js";
import { livePopups, adoptManagedPopup, DialogCarried, scheduleBarSync, armAskTimer, disarmAskTimer } from "../ui.js";
import { SAVE_BENDS, EFFECT_BENDS } from "../decide/registry.js";
import { saveGate, saveSources, effectSaveSources } from "../decide/reminders.js";
import { conditionEntries, effectEntries, reminderEntries } from "../settings.js";
import { foldSaveAnswer, foldSaveAutoFail, foldSaveAutoSucceed } from "./verdict.js";
import { SURFACES } from "../surfaces.js";
import { originData } from "../decide/card.js";

/* --- the roll: whoever owns the decision presses it ----------------------------------------- */

/** Same-client re-entry latch (render resume + the buzzer can volunteer in one tick). */
const saveRollsInFlight = new Set();

/** The message data every answer to a demand carries — chained to the card, and the exact channel. */
function saveAnswerData(card, uuid, timedOut) {
  return { data: {
    // Chained to the demand card; a programmatic roll has no DOM click to inherit the chain from.
    ...originData(card.id),
    flags: {
    // The exact answer channel: WHICH card, WHICH target — the fold never resolves the actor
    // (getSpeaker picks the oldest token).
    [MODULE_ID]: { respondsTo: card.id, saveFor: uuid, ...(timedOut ? { timedOut: true } : {}) }
  } } };
}

/** Is this target still owed an answer — pending, unanswered, and no roll already on the log? */
function saveStillOwed(card, uuid) {
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  if ( !entry || entry.done || (flag.status !== "pending") ) return null;
  // ⚠ An answer that already landed wins though the entry reads pending (the fold may lag).
  // Whole-log by flag, never a tail.
  if ( game.messages.some(m => (m.getFlag(MODULE_ID, "respondsTo") === card.id)
    && (m.getFlag(MODULE_ID, "saveFor") === uuid)) ) return null;
  return { flag, entry };
}

/**
 * Roll one target's save STRAIGHT (the buzzer's press): no dialog, sheet modifiers still apply.
 * The DC rides as `target`, so the system marks the card. The human presses `openSaveDialog`.
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

/* THE DEMAND OPENS THE SYSTEM'S OWN SAVING THROW DIALOG (RULINGS *The gate before the roll*): the
 * demand's fieldset above CONFIGURATION, the gate's section below it. A save the rules decide
 * before the dice grows a Fails / Succeeds button as the default; the human still presses (R1).
 * Every pending demand opens its dialog, down the staircase. The dialog is enrolled in
 * `livePopups` under the card row's popup key. Dismissing is not an answer: the buzzer rolls. */

/** Dialogs on their way up — between the call and the render that enrols them in `livePopups`. */
const saveDialogsOpening = new Set();

/**
 * Open the system's Saving Throw dialog for one demanded target; recall fronts a live one. The
 * demand rides `dialog.options` as a DialogCarried — the object the Fails button writes to.
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
    const demand = new DialogCarried({ cardId: card.id, uuid, failed: null, succeeded: null });
    const rolls = await actor.rollSavingThrow(
      { ability: owed.flag.abilities[0], target: owed.flag.dc },
      { configure: true, options: { bfSaveDemand: demand } },
      saveAnswerData(card, uuid, false)
    );
    // Fails pressed: no roll; the demand carries the sources that failed it.
    if ( !rolls?.length && demand.failed ) await foldSaveAutoFail(card, uuid, { sources: demand.failed });
    // Succeeds pressed: the mirror.
    else if ( !rolls?.length && demand.succeeded ) await foldSaveAutoSucceed(card, uuid, { sources: demand.succeeded });
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
  // ⚠ A question withdrawn before this first render closes here: the sweep that closes answered
  // popups ran on the write, before this dialog was enrolled.
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
    // WHO is rolling leads, portrait included; the spell is the subtitle.
    img: actor?.img ?? flag.item?.img ?? null,
    eyebrow: "Saving throw",
    title: `${entry.name}: ${abilityLabel} save, DC ${flag.dc}`,
    subtitle: `${flag.item?.name ?? "An effect"}${flag.casterName ? `, from ${flag.casterName}` : ""}`,
    lines: stakes, tone: "pending"
  })}${holdBarHTML(flag, "to roll")}</fieldset>`;
  const fieldset = host.firstElementChild;
  const configuration = element.querySelector(SURFACES.dialogConfiguration);
  const formulas = element.querySelector('[data-application-part="formulas"]');
  if ( configuration ) configuration.insertAdjacentElement("beforebegin", fieldset);
  else if ( formulas ) formulas.insertAdjacentElement("afterend", fieldset);
  else element.querySelector("form")?.prepend(fieldset);
  scheduleBarSync(element);
}

// The demand's fieldset on every render of a save dialog carrying one (its dropdowns re-render).
// polish.js and reminders.js ride the same hook; the entry order keeps their paint first.
Hooks.on("renderRollConfigurationDialog", (app, element) => {
  try {
    const demand = app.options?.bfSaveDemand ?? null;
    // ⚠ A demand carrying `present` is another machine's (ui.js drawDemandFieldset); this one
    // would close a dialog whose card has no saves entry.
    if ( demand && !demand.present ) drawSaveDemand(app, element, demand);
  } catch(err) {
    console.error(`${TITLE} | Save dialog section failed to draw.`, err);
  }
});

/* --- the buzzer: expiry rolls, on the elect -------------------------------------------------- */

const saveTimers = new Map();
/** The demand's clock, off the flag's absolute deadline (a no-op without one); armed on every
 * render and update, so a reload resumes it. */
export function armSaveTimer(message) { return armAskTimer(saveTimers, message, "saves", fireSaveTimer); }
/** …and disarms it when nothing is pending or the card goes — the fold and the watchers call it. */
export function disarmSaveTimer(cardId) { return disarmAskTimer(saveTimers, cardId); }

/**
 * A save the rules fail before the dice — the gate's judgement read off decide/ directly (this
 * directory never imports the gate machine), gated on the same switch. Empty when it can be rolled.
 */
function autoFailSources(actor, ability) {
  if ( !reminderEntries().some(e => e.kind === "condition") ) return [];
  const sources = saveSources({ statuses: actor.statuses ?? [], ability,
    enabled: conditionEntries().map(e => e.kind), table: SAVE_BENDS, name: actor.name });
  return saveGate(sources).autoFail ? sources : [];
}

/**
 * A save that cannot FAIL (Trance): the effect table's `succeeds` rows the roller carries, read
 * against THIS demand. Empty when the save must be rolled.
 */
function autoSucceedSources(actor, flag) {
  if ( !reminderEntries().some(e => e.kind === "effect") ) return [];
  return effectSaveSources({ effects: actor.effects.filter(e => !e.disabled).map(e => ({ id: e.id, name: e.name })),
    features: actor.items.filter(i => i.type === "feat").map(i => i.name),
    enabled: effectEntries().map(e => e.kind), table: EFFECT_BENDS, demand: flag.demand ?? null, name: actor.name })
    .filter(s => s.autoSucceed);
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
    // A target that no longer exists is voided, or the demand sits pending forever.
    const actor = await fromUuid(entry.uuid).catch(() => null);
    if ( !(actor instanceof Actor) ) {
      // ⚠ Through the serializer: the loop writes the same card once per vanished target.
      let goneName = null;
      await queueFlagWrite(card, "saves", current => {
        const gone = current.targets?.find(t => !t.done && (t.uuid === entry.uuid));
        if ( !gone ) return false;
        gone.done = true;
        gone.outcome = "gone";
        gone.applied = true; // nothing to apply to

        if ( current.targets.every(t => t.done) ) current.status = "done";
        goneName = gone.name;
      });
      if ( goneName ) goneNames.push(goneName);
      continue;
    }
    // Close a dialog still open on THIS client first, so the straight roll is the only answer;
    // another client's closes off the fold's update.
    const open = livePopups.get(popupKey(card.id, `save:${entry.uuid}`));
    if ( open ) { try { await open.close(); } catch { /* already gone */ } }
    // A save the rules fail before the dice is recorded as that failure, not rolled.
    const failing = autoFailSources(actor, flag.abilities[0]);
    if ( failing.length ) { await foldSaveAutoFail(card, entry.uuid, { sources: failing, timedOut: true }); continue; }
    // …and a save the rules pass before the dice is recorded as that success (Trance).
    const passing = autoSucceedSources(actor, flag);
    if ( passing.length ) { await foldSaveAutoSucceed(card, entry.uuid, { sources: passing, timedOut: true }); continue; }
    // Heightened Spell's mark: the buzzer rolls the marked target at Disadvantage.
    const heightened = flag.demand?.heightened?.uuid === entry.uuid;
    await rollSaveAnswer(card, entry.uuid, { timedOut: true, mode: heightened ? "disadvantage" : null });
  }
  // A "gone" verdict is stamped applied above; the card's own line says so (verdictText).
  // biome-ignore lint/suspicious/noConsole: a debug trace of the creatures gone before the save was asked
  if ( goneNames.length ) console.debug(`${TITLE} | Gone at the buzzer: ${goneNames.join(", ")}.`);
}
