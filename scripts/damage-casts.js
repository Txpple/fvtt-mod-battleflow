/**
 * Battle Flow — Damage casts: a bare damage activity rolls its dice at the use, and a listed row demands the save its text names after the damage lands.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, statContext } from "./core.js";
import { lower, activityNamed } from "./lookup.js";
import { damageSaveEntries, listedNames } from "./settings.js";
import { modeAllows, withTargets } from "./shared.js";
import { tokenForUuid } from "./geometry.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { DAMAGE_SAVES, MANEUVER_FEATURE_NAMES, tableIndex } from "./decide/registry.js";
import { volleyEntryFor } from "./volley-registry.js";
import { offerSaveDamageRoll, rollDamageForSave } from "./auto-damage.js";

/* ---------------------------------------------------------------------------------------------
 * DAMAGE CASTS (user, 2026-09-04 — "make heat metal spell work"). MEASURED on the sandbox: the
 * 2024 PHB's Heat Metal is a BARE damage activity ("Cast and Heat", 2d8 Fire at one object's
 * holder; "Reheat" the same as a Bonus Action) plus a save activity ("On Damage Save" — Con, no
 * damage, the Heated Metal effect on a failure) that nothing chains. Two things stood between it
 * and the table:
 *
 *   1. THE DICE WERE A DIALOG'S. dnd5e's DamageActivity follows its card by opening the damage
 *      ROLL DIALOG (its `_triggerSubsequentActions` calls rollDamage with a dialog) — a click the
 *      attack resolver and the save demand never ask of anyone — and with the card's buttons
 *      hidden (polish.js) that dialog was the only path. So the general half: a bare damage
 *      activity aimed at targets is the module's to roll the moment it is used, on the casting
 *      client — offered when the caster wants their dice back, rolled straight otherwise, the
 *      native follow-up switched off at the use so it never rolls twice — chained to the usage
 *      card, where polish.js's `spellDamage` stamp and hold/spell-damage.js's no-attack applier already land it
 *      on the targets with a receipt. Volley spells stay the volley machine's; a listed hold
 *      (Magic Missile) keeps its pending claim untouched.
 *   2. THE SAVE NEVER FOLLOWED. The text ties it to the damage — "if a creature is holding or
 *      wearing the object and takes the damage from it, the creature must succeed on a
 *      Constitution saving throw or drop the object … If it doesn't drop the object, it has
 *      Disadvantage" — so a listed row (DAMAGE_SAVES) names the damage activities and the save
 *      activity, and the save is USED at the same targets right after the dice go, so the
 *      demand, the timer, the roll and the failed-save press are the saves machine's. The pack's
 *      effect lands on the failure; the drop is a judgment (can it? will it?) said on the card.
 *
 * The gate already read Heated Metal on the holder's attacks (EFFECT_BENDS); the check gate reads
 * it now too (the row's `checks` facet — decide/reminders.js effectCheckSources).
 * ------------------------------------------------------------------------------------------- */

const listed = () => listedNames(damageSaveEntries());

/** Is this a bare damage activity the module will drive — aimed, on a side the mode admits, not a volley's? */
function drives(activity, targetCount) {
  if ( activity?.type !== "damage" ) return false;
  const actor = activity.actor;
  if ( !actor?.isOwner || !modeAllows(actor) ) return false;
  if ( volleyEntryFor(activity.item) ) return false;                  // the volley machine rolls its darts
  if ( MANEUVER_FEATURE_NAMES.has(lower(activity.item?.name)) ) return false;   // a maneuver's damage activity is its DIE — other machines' (2026-09-05)
  if ( !activity.damage?.parts?.length ) return false;
  return targetCount > 0;
}

// ⚠ ONE ROLL, NEVER TWO. dnd5e's DamageActivity DOES follow its card with a damage roll — through
// the roll DIALOG, which is the click the table was making — so a machine that also rolls would
// roll twice. The volley machine's claim, applied here: the native follow-up is switched off at
// the use, and the dice are the module's (straight, or offered). Measured 2026-09-05: the empty
// `_triggerSubsequentActions` this file first assumed is the ATTACK activity's; the damage
// activity's calls rollDamage with a dialog.
Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, dialogConfig, messageConfig) => {
  try {
    const snapshot = foundry.utils.getProperty(messageConfig ?? {}, "data.flags.dnd5e.targets");
    const n = Array.isArray(snapshot) ? snapshot.length : game.user.targets.size;
    if ( !drives(activity, n) ) return;
    usageConfig.subsequentActions = false;
  } catch(err) {
    console.warn(`${TITLE} | Could not claim the damage cast's roll.`, err);
  }
});
const { rowNamed } = tableIndex(DAMAGE_SAVES);

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    if ( !message ) return;                                          // used with create: false — no card, no bus
    const targets = (message.getFlag("dnd5e", "targets") ?? []).map(t => ({ uuid: t.uuid, name: t.name, img: t.img ?? null }));
    if ( !drives(activity, targets.length) ) return;                 // nothing aimed — the humans have it
    if ( message.getFlag(MODULE_ID, "damageCast") ) return;          // never re-drive
    // The consumed-flag write the suppressed follow-up skips — the volley machine's two lines.
    try {
      const consumed = activity.createConsumedFlag?.(activity.actor, message.system?.deltas);
      if ( consumed ) activity.item.updateSource({ "flags.dnd5e.consumed": consumed });
    } catch { /* refund keeps working through the deltas either way */ }
    void driveDamageCast(activity, message, targets);
  } catch(err) {
    console.error(`${TITLE} | Damage cast failed — roll the dice from the card.`, err);
  }
});

async function driveDamageCast(activity, message, targets) {
  const actor = activity.actor;
  const row = rowNamed(activity.item?.name);
  const follows = !!row && listed().has(lower(row.key)) && (row.damage ?? []).some(n => lower(n) === lower(activity.name));
  await message.setFlag(MODULE_ID, "damageCast", { ...statContext(actor.uuid), activity: activity.name,
    scaling: Number(message.system?.scaling ?? 0), ...(follows ? { save: row.save, key: row.key } : {}) });
  // The dice: the caster's when they asked for them (the save path's own offer), the module's
  // otherwise. Not awaited past the offer — the demand below must not wait fifteen seconds.
  if ( setting(S.playerRollDamage) ) void offerSaveDamageRoll(activity, message, { damageOnSave: null, targets });
  else await rollDamageForSave(activity, message);
  if ( !follows ) return;
  // The save the text ties to the damage, used at the same targets — the saves machine takes it
  // from here (the demand card is the save's own usage card). No slot: the spell was cast already.
  const save = activityNamed(activity.item, row.save);
  if ( !save ) { console.warn(`${TITLE} | ${row.key}: no activity named "${row.save}" on the sheet — ask for the save by hand.`); return; }
  const tokens = targets.map(t => tokenForUuid(t.uuid)).filter(Boolean);
  if ( !tokens.length ) return;
  try {
    await withTargets(tokens, () => save.use({ consume: { spellSlot: false, resources: false, action: false }, subsequentActions: false }, { configure: false },
      { data: { flags: { [MODULE_ID]: { damageSaveCard: { ...statContext(actor.uuid), key: row.key, damageCardId: message.id, line: row.line ?? null, rule: row.rule } } } } }));
  } catch(err) {
    console.error(`${TITLE} | ${row.key}: the save could not be put to the targets — ask for it by hand.`, err);
  }
}

/* --- the cards say it (R5) -------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const dc = message.getFlag(MODULE_ID, "damageSaveCard");
  if ( !dc ) return;
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    eyebrow: `${dc.key} — the save after the damage`, tone: "neutral",
    title: "Drop it, or keep it and take the Disadvantage",
    lines: [dc.line, ruleLine(dc.rule)]
  });
  html.querySelector(".message-content")?.appendChild(line);
});
