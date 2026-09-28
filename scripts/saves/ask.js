/**
 * Battle Flow — MACHINE, part of scripts/saves/ (ARCHITECTURE.md §7): the ASK — dnd5e's save
 * dialog wearing the demand's fieldset, the straight roll, and the buzzer. index.js is the
 * directory's only public face.
 */
import { MODULE_ID, TITLE, queueFlagWrite } from "../core.js";
import { namesAnswering, resolveUuid } from "../lookup.js";
import { rollConfigFor } from "../shared.js";
import { popupKey, bfCard, holdBarHTML } from "../decide/present.js";
import { livePopups, adoptManagedPopup, DialogCarried, scheduleBarSync, armAskTimer, disarmAskTimer } from "../ui.js";
import { SAVE_BENDS, EFFECT_BENDS } from "../decide/registry.js";
import { saveGate, saveSources, effectSaveSources } from "../decide/reminders.js";
import { conditionEntries, effectEntries, reminderEntries } from "../decide/registry.js";
import { foldSaveAnswer, foldSaveAutoFail, foldSaveAutoSucceed } from "./verdict.js";
import { SURFACES } from "../surfaces.js";
import { originData } from "../decide/card.js";
import { listen } from "../dispatch.js";

/** Same-client re-entry latch (render resume + the buzzer can volunteer in one tick). */
const saveRollsInFlight = new Set();

/** The message data every answer carries: chained to the card, and the exact channel. */
function saveAnswerData(card, uuid, timedOut) {
  return { data: {
    // A programmatic roll has no DOM click to inherit the chain from.
    ...originData(card.id),
    flags: {
    // WHICH card, WHICH target: the fold never resolves the actor (getSpeaker picks the oldest token).
    [MODULE_ID]: { respondsTo: card.id, saveFor: uuid, ...(timedOut ? { timedOut: true } : {}) }
  } } };
}

function saveStillOwed(card, uuid) {
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === uuid);
  if ( !entry || entry.done || (flag.status !== "pending") ) return null;
  // ⚠ A landed answer wins though the entry reads pending; whole-log by flag, never a tail.
  if ( game.messages.some(m => (m.getFlag(MODULE_ID, "respondsTo") === card.id)
    && (m.getFlag(MODULE_ID, "saveFor") === uuid)) ) return null;
  return { flag, entry };
}

/** Roll one target's save STRAIGHT (the buzzer's press); the DC rides as `target`. */
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

/* THE DEMAND OPENS DND5E'S OWN SAVE DIALOG (RULINGS *The gate before the roll*): a save the rules
 * decide grows a Fails / Succeeds default, the human still presses. Dismissing is not an answer. */

/** Dialogs between the call and the render that enrols them in `livePopups`. */
const saveDialogsOpening = new Set();

/** Open the save dialog for one target, the demand riding as the DialogCarried the Fails button writes. */
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
    // Fails or Succeeds pressed: no roll; the demand carries the sources.
    if ( !rolls?.length && demand.failed ) await foldSaveAutoFail(card, uuid, { sources: demand.failed });
    else if ( !rolls?.length && demand.succeeded ) await foldSaveAutoSucceed(card, uuid, { sources: demand.succeeded });
  } catch(err) {
    console.error(`${TITLE} | Save dialog failed — roll it from the sheet.`, err);
  } finally {
    saveDialogsOpening.delete(key);
  }
}

/** The demand's fieldset above the dialog's CONFIGURATION. */
function drawSaveDemand(app, element, demand) {
  const card = game.messages.get(demand.cardId);
  if ( !card ) return;
  const flag = card.getFlag(MODULE_ID, "saves");
  const entry = flag?.targets?.find(t => t.uuid === demand.uuid);
  // ⚠ Withdrawn before this first render: close here, the answered-popup sweep already ran.
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

// On every render (the dropdowns re-render); the entry order keeps polish.js and reminders.js first.
listen("renderRollConfigurationDialog", "saves/ask", (app, element) => {
  try {
    const demand = app.options?.bfSaveDemand ?? null;
    // ⚠ A demand carrying `present` is another machine's (ui.js drawDemandFieldset).
    if ( demand && !demand.present ) drawSaveDemand(app, element, demand);
  } catch(err) {
    console.error(`${TITLE} | Save dialog section failed to draw.`, err);
  }
});

// The buzzer: expiry rolls, on the elect.
const saveTimers = new Map();
/** Armed on every render and update off the absolute deadline, so a reload resumes it. */
export function armSaveTimer(message) { return armAskTimer(saveTimers, message, "saves", fireSaveTimer); }
export function disarmSaveTimer(cardId) { return disarmAskTimer(saveTimers, cardId); }

/** A save the rules fail before the dice, read off decide/ (this directory never imports the gate). */
function autoFailSources(actor, ability) {
  if ( !reminderEntries().some(e => e.kind === "condition") ) return [];
  const sources = saveSources({ statuses: actor.statuses ?? [], ability,
    enabled: conditionEntries().map(e => e.kind), table: SAVE_BENDS, name: actor.name });
  return saveGate(sources).autoFail ? sources : [];
}

/** A save that cannot FAIL (Trance): the roller's `succeeds` rows, read against THIS demand. */
function autoSucceedSources(actor, flag) {
  if ( !reminderEntries().some(e => e.kind === "effect") ) return [];
  return effectSaveSources({ effects: actor.effects.filter(e => !e.disabled).map(e => ({ id: e.id, name: e.name })),
    features: namesAnswering(actor.items.filter(i => i.type === "feat"), Object.keys(EFFECT_BENDS)),
    enabled: effectEntries().map(e => e.kind), table: EFFECT_BENDS, demand: flag.demand ?? null, name: actor.name })
    .filter(s => s.autoSucceed);
}

/** One owed save rolled with no dialog: a save the rules decide before the dice is recorded, not rolled;
 * Heightened Spell's mark rolls at Disadvantage. */
async function rollWithoutAsking(card, flag, actor, uuid, { timedOut = false } = {}) {
  const failing = autoFailSources(actor, flag.abilities[0]);
  if ( failing.length ) return foldSaveAutoFail(card, uuid, { sources: failing, timedOut });
  const passing = autoSucceedSources(actor, flag);
  if ( passing.length ) return foldSaveAutoSucceed(card, uuid, { sources: passing, timedOut });
  const heightened = flag.demand?.heightened?.uuid === uuid;
  return rollSaveAnswer(card, uuid, { timedOut, mode: heightened ? "disadvantage" : null });
}

/** Players Roll Their Own Saves, off: the owed save rolls at once on the roller's client, no popup. */
export async function rollSaveItself(card, uuid) {
  const flag = card.getFlag(MODULE_ID, "saves");
  if ( !flag || (flag.status !== "pending") ) return;
  const actor = await fromUuid(uuid).catch(() => null);
  if ( !(actor instanceof Actor) ) return;
  await rollWithoutAsking(card, flag, actor, uuid);
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
    // Close a dialog open on THIS client first, so the straight roll is the only answer.
    const open = livePopups.get(popupKey(card.id, `save:${entry.uuid}`));
    if ( open ) { try { await open.close(); } catch { /* already gone */ } }
    await rollWithoutAsking(card, flag, actor, entry.uuid, { timedOut: true });
  }
  // biome-ignore lint/suspicious/noConsole: a debug trace of the creatures gone before the save was asked
  if ( goneNames.length ) console.debug(`${TITLE} | Gone at the buzzer: ${goneNames.join(", ")}.`);
}
