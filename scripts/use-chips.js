/**
 * Battle Flow — Use chips: a feature the pack ships as TEXT ONLY becomes a chip on use, so the gate can read it and the roll can spend it.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, statContext } from "./core.js";
import { lower } from "./lookup.js";
import { effectEntries, listedNames } from "./settings.js";
import { chipData, placeOf } from "./shared.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { USE_CHIPS, tableIndex } from "./decide/registry.js";
import { CHIP_FLAG, chipClock } from "./decide/chips.js";

/* ---------------------------------------------------------------------------------------------
 * USE CHIPS (user report 2026-09-02: "i added steady aim, which isnt appling, and should then
 * also trigger advantage for the rogue"). The 2024 PHB's Steady Aim is a utility activity —
 * instantaneous, self, NO effect — so there is nothing for any apply path to land: the feature's
 * whole consequence lives in its text. This machine turns the USE into a chip (USE_CHIPS, one
 * row per such feature): an ActiveEffect on the actor, named as the feature is, carrying the
 * rule in its description and the window the rules give it (Steady Aim: the current turn — the
 * Vex clock's shape against the attacker's own place), plus what the text changes on the sheet
 * (Speed 0 until the end of the turn). From there nothing is new: the effect table (EFFECT_BENDS)
 * has a row by that name, so the GATE reads it as Advantage and the ROLL spends it with a receipt
 * (mastery.js `spendChips`, the `spend: "attack"` shape). Membership is the Effect Sources list,
 * as for every effect row.
 *
 * WHERE IT RUNS: on the client that used the feature — `postUseActivity` fires there, and that
 * client owns the actor. Idempotent per usage card: a chip that stands is refreshed, never doubled.
 * ------------------------------------------------------------------------------------------- */

const USE_CHIP_INDEX = tableIndex(USE_CHIPS);

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    if ( !setting(S.riders) && !setting(S.masteryRiders) && !setting(S.effectRiders) ) { /* no feature switch of its own: the Effect Sources list is the switch */ }
    const item = activity?.item;
    const actor = activity?.actor;
    if ( !item || !actor?.isOwner ) return;
    const key = USE_CHIP_INDEX.keyNamed(item.name);
    if ( !key ) return;
    const listed = listedNames(effectEntries());
    if ( !listed.has(lower(key)) ) return;   // the list is the switch — as for every effect row
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    void writeUseChip(actor, item, USE_CHIPS[key], message);
  } catch(err) {
    console.error(`${TITLE} | Use chip failed — apply the feature by hand.`, err);
  }
});

async function writeUseChip(actor, item, row, message) {
  const stale = actor.effects.filter(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "use") && (lower(e.name) === lower(item.name)));
  if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
  const clock = chipClock(row.window, placeOf(actor));
  const effect = await ActiveEffect.implementation.create({
    name: item.name, img: item.img ?? "icons/svg/aura.svg",
    description: `<p><em>“${row.rule}”</em></p><p>Written by Battle Flow when ${item.name} was used; the next attack roll spends it.</p>`,
    origin: item.uuid, disabled: false, transfer: false,
    // A COPY: the registry row is frozen, and the document migration writes into its changes
    // (measured: "Cannot add property type, object is not extensible" refused the whole create).
    changes: (row.changes ?? []).map(c => ({ ...c })),
    ...(clock ? chipData(clock) : {}),
    flags: { [MODULE_ID]: { [CHIP_FLAG]: "use", useKey: row.key } }
  }, { parent: actor });
  // The card says it (R5): the chip stands, what it does, and what spends it.
  if ( message ) {
    await message.setFlag(MODULE_ID, "useChip", { ...statContext(actor.uuid), effectId: effect?.id ?? null, name: item.name, rule: row.rule, bend: row.bend, note: row.note ?? null })
      .catch(() => { /* the chip stands; only the card line is lost */ });
  }
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const u = message.getFlag(MODULE_ID, "useChip");
  if ( !u ) return;
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    eyebrow: "Use chip", tone: "good",
    title: `${u.name} — ${u.bend === "advantage" ? "Advantage" : "Disadvantage"} on the next attack roll`,
    subtitle: u.note ?? "spent by the roll",
    lines: [ruleLine(u.rule)]
  });
  html.querySelector(".message-content")?.appendChild(line);
});
