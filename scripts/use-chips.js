/**
 * Battle Flow — Use chips: a feature the pack ships as TEXT ONLY becomes a chip on use, so the gate can read it and the roll can spend it.
 * Split shape (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { MODULE_ID, TITLE, S, setting, statContext } from "./core.js";
import { lower } from "./lookup.js";
import { effectEntries, cardChipEntries, listedNames } from "./settings.js";
import { chipData, placeOf } from "./shared.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { USE_CHIPS, CARD_CHIPS, tableIndex } from "./decide/registry.js";
import { CHIP_FLAG, chipClock, cardChipRowKey, chipsToRetire } from "./decide/chips.js";
import { momentButton } from "./ui.js";
import { SURFACES } from "./surfaces.js";

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
  html.querySelector(SURFACES.messageContent)?.appendChild(line);
});

/* ---------------------------------------------------------------------------------------------
 * CARD CHIPS (user, 2026-09-25, the Gnome walk: "for gnome tinker, just make it a buff on the char
 * that lasts for the duration"; ruled: a button on the Prestidigitation card; "just give a buff
 * called tiny clockwork device ... the rest is played at table"). The table is decide/registry.js
 * CARD_CHIPS; membership is the Card Chips list. Tinker has NO activity — its use is ten minutes
 * of Prestidigitation — so the cast's card is where it is offered: the caster owns the feature,
 * the card carries a pending offer, and a click writes the chip. Nothing is written without the
 * click (a plain Prestidigitation makes no device — R1, the caster's choice).
 *
 * WHERE IT RUNS: the offer is stamped by the casting client (it authored the card); the click is
 * answered by whoever clicks and owns the caster — the chip is the caster's own sheet, the card
 * the caster's own message. A card the clicker may not write keeps its button; the chip stands.
 * ------------------------------------------------------------------------------------------- */

const CARD_FLAG = "cardChip";

Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  try {
    const item = activity?.item;
    const actor = activity?.actor;
    const message = (results?.message instanceof ChatMessage) ? results.message : null;
    if ( !item || !actor?.isOwner || !message ) return;
    const key = cardChipRowKey(CARD_CHIPS, { itemName: item.name, featureNames: actor.items.map(i => i.name) },
      listedNames(cardChipEntries()));
    if ( !key ) return;
    void message.setFlag(MODULE_ID, CARD_FLAG, { ...statContext(actor.uuid), key, chip: CARD_CHIPS[key].chip, made: false })
      .catch(err => console.error(`${TITLE} | Could not offer ${key} on the card.`, err));
  } catch(err) {
    console.error(`${TITLE} | Card chip offer failed — keep the feature by hand.`, err);
  }
});

/** Build the chip a card offers: the oldest retired past the row's max, the new one written, the card stamped. */
async function buildCardChip(message) {
  const flag = message.getFlag(MODULE_ID, CARD_FLAG);
  const row = CARD_CHIPS[flag?.key];
  if ( !row || flag.made ) return;
  const actor = await fromUuid(flag.sourceUuid ?? "");
  if ( !(actor instanceof Actor) || !actor.isOwner ) {
    ui.notifications.warn(`${TITLE} | Only the caster's owner can build the ${row.chip}.`);
    return;
  }
  const feature = actor.items.find(i => lower(i.name) === lower(row.feature)) ?? null;
  const standing = actor.effects.filter(e => (e.getFlag(MODULE_ID, CHIP_FLAG) === "card") && (lower(e.name) === lower(row.chip)));
  const retired = chipsToRetire(standing.map(e => ({ id: e.id, start: e.start?.time ?? null })), row.max);
  if ( retired.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", retired);
  const [effect] = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: row.chip, img: feature?.img ?? "icons/svg/aura.svg",
    description: `<p><em>“${row.rule}”</em></p><p>Written by Battle Flow when ${flag.key} was chosen on the Prestidigitation card; what the device does is the table's.</p>`,
    origin: feature?.uuid ?? null, disabled: false, transfer: false,
    duration: { value: row.seconds, units: "seconds", expired: false }, start: { time: game.time.worldTime },
    flags: { [MODULE_ID]: { [CHIP_FLAG]: "card", cardKey: flag.key } }
  }]);
  const left = standing.length - retired.length + (effect ? 1 : 0);
  if ( message.canUserModify?.(game.user, "update") ) {
    await message.setFlag(MODULE_ID, CARD_FLAG, { ...flag, made: true, effectId: effect?.id ?? null, retired, standing: left })
      .catch(() => { /* the chip stands; only the card line is lost */ });
  }
}

// The card says it (R5): the offer while it waits, what was built once it is.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const f = message.getFlag(MODULE_ID, CARD_FLAG);
  const row = f ? CARD_CHIPS[f.key] : null;
  if ( !row ) return;
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    eyebrow: f.key, tone: f.made ? "good" : "neutral",
    title: f.made ? `${row.chip} built — ${f.standing ?? 1} of ${row.max} standing, each for 8 hours` : row.ask,
    subtitle: f.made ? ((f.retired ?? []).length ? "the oldest device fell apart to make room" : "what it does is played at the table")
      : `at most ${row.max} at a time; each falls apart after 8 hours`,
    lines: [ruleLine(row.rule)]
  });
  const content = html.querySelector(SURFACES.messageContent);
  content?.appendChild(line);
  if ( !f.made ) {
    // live only: the offer is its caster's to take — another client sees the line, not the button
    const actor = fromUuidSync(f.sourceUuid ?? "");
    if ( actor?.isOwner ) content?.appendChild(momentButton(`Build a ${row.chip}`, () => void buildCardChip(message)
      .catch(err => console.error(`${TITLE} | Could not build the ${row.chip}.`, err))));
  }
});
