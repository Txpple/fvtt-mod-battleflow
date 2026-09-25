/**
 * Battle Flow — MACHINE layer (ARCHITECTURE.md §2): THE ADVANTAGE BUYS — Advantage on your own D20
 * Test, bought with one of an item's uses BEFORE the roll (decide/registry.js ADVANTAGE_BUYS; Lucky
 * the first row). The Halfling walk, 2026-09-25 (user: "we need to unpark the advantage on our own
 * d20"), ruled off the prototype lucky-advantage.html ("looks good"):
 *
 *   - ONE BOX per row the roller holds, the Sneak Attack box's shape (a tick where the gate's other
 *     boxes carry a tag), in the gate's "Before you roll" section of the system's OWN dialog — an
 *     attack, a save (a demanded one too), a check, and initiative's dialog. No gate section on the
 *     dialog: the box brings the section with it.
 *   - The tick COUNTS as an Advantage source: the header's net and the highlighted button move with
 *     it. Beside a Disadvantage it nets Normal and the use still goes (the rule allows it — ruled).
 *   - The use is spent when the roll goes out with the box ticked and the NET pressed; a press
 *     against the net bought nothing. The record is the gate's own (the Lucky source among the
 *     others) and the uniform spend (`poolSpend` — the flash and the card line).
 *   - A roll with no dialog (a shift-click) meets no box and spends nothing (ruled: the dialog is
 *     never forced open for a choice nobody is being warned about).
 *   - Initiative with NO dialog (the carousel, Roll All — `Combat#rollInitiative` has no pause before
 *     its dice): the `advantage` D20 fold offers the same buy after the roll (d20-folds.js). A roll
 *     whose dialog showed the box carries `bfBuyShown` on its options, so the fold stands aside.
 *
 * WHERE IT RUNS: the roller's client — the pre-roll hooks, the dialog and the record all fire where
 * the dice are rolled. It sets no mode (R-A): the human presses one of the dialog's own buttons.
 *
 * ⚠ HOOK ORDER: imported AFTER reminders.js, so on every render the gate has drawn (or redrawn) its
 * section before this adds the box and re-nets the header, and on `postRollConfiguration` the gate's
 * record is written before this one overwrites it with the Lucky source included.
 */
import { MODULE_ID, TITLE, statContext } from "./core.js";
import { lower } from "./lookup.js";
import { reminderEntries } from "./settings.js";
import { DialogCarried, markDefaultButton } from "./ui.js";
import { bfCard, buyBoxHTML, modeTagHTML, reminderFieldsetHTML } from "./decide/present.js";
import { ADVANTAGE_BUYS } from "./decide/registry.js";
import { rollModeOf } from "./decide/chips.js";
import { REMINDER_FLAG, netMode, reminderRecord, reminderSource } from "./decide/reminders.js";
import { SURFACES } from "./surfaces.js";

/** The rows this actor can buy on this kind of test — every held row, spent ones greyed (the box says why). */
function buysFor(actor, testKind) {
  if ( !(actor instanceof Actor) ) return [];
  if ( !reminderEntries().some(e => e.kind === "buy") ) return [];      // the list is the switch
  const out = [];
  for ( const [name, row] of Object.entries(ADVANTAGE_BUYS) ) {
    if ( !row.tests.includes(testKind) ) continue;
    // ⚠ Uses demanded: the 2014 Halfling's "Lucky" trait shares the name and has none.
    const item = actor.items.find(i => (i.type === "feat") && (lower(i.name) === lower(name))
      && (!row.uses || (Number(i.system?.uses?.max) > 0)));
    if ( !item ) continue;
    out.push({ name, point: row.point, rule: row.rule, itemId: item.id,
      left: row.uses ? Math.max(0, Number(item.system.uses.value ?? 0)) : null, max: Number(item.system?.uses?.max ?? 0) });
  }
  return out;
}

/** Ride the dialog: one DialogCarried shared by the config, the rendered app and the record (ui.js). */
function carry(config, dialog, actor, testKind) {
  if ( dialog?.configure === false ) return;                           // no dialog, no box
  const rows = buysFor(actor, testKind);
  if ( !rows.length ) return;
  const buy = new DialogCarried({ rows, armed: null, shown: false, net: null, testKind, actorUuid: actor.uuid });
  dialog.options ??= {};
  dialog.options.bfBuy = buy;
  config.bfBuy = buy;
}

Hooks.on("dnd5e.preRollAttackV2", (config, dialog) => {
  try {
    const activity = config?.subject;
    if ( activity?.type !== "attack" ) return;
    carry(config, dialog, activity.item?.actor, "attack");
  } catch(err) { console.error(`${TITLE} | Advantage buy (attack) failed — rolling natively.`, err); }
});

// Death saves and concentration saves ride this hook too: every one is a D20 Test.
Hooks.on("dnd5e.preRollSavingThrowV2", (config, dialog) => {
  try { carry(config, dialog, config?.subject, "save"); }
  catch(err) { console.error(`${TITLE} | Advantage buy (save) failed — rolling natively.`, err); }
});

// Raw checks, skills, tools and INITIATIVE's dialog (its hookNames carry `initiativeDialog`).
Hooks.on("dnd5e.preRollAbilityCheckV2", (config, dialog) => {
  try {
    const initiative = !!config?.hookNames?.includes?.("initiativeDialog");
    carry(config, dialog, config?.subject, initiative ? "initiative" : "check");
  } catch(err) { console.error(`${TITLE} | Advantage buy (check) failed — rolling natively.`, err); }
});

/** The gate this dialog carries, whichever table it is (the attack's, the save's, the check's), or null. */
const gateOf = holder => holder?.bfReminder ?? holder?.bfSaveGate ?? holder?.bfCheckGate ?? null;

/** The source the ticked box adds to the net, in the gate's own vocabulary. */
function buySource(actorName, row) {
  return reminderSource("buy", "advantage", `${actorName} — ${row.name} (1 ${row.point})`, row.rule);
}

/** The dialogs standing with a box in them — redrawn after the gate's own re-target redraw. */
const openBuys = new Set();

/**
 * Draw — or redraw — the boxes and re-net the header. Idempotent: the gate may have replaced its
 * whole section on this render (a dagger switched to Thrown), so the boxes are re-added each time.
 */
function drawBuy(app) {
  const buy = app.options?.bfBuy;
  const element = app.element;
  if ( !buy || !element ) return;
  buy.shown = true;
  if ( buy.armed === null ) buy.armed = false;
  let fieldset = element.querySelector("[data-bf-reminder]");
  if ( !fieldset ) {
    const host = document.createElement("div");
    host.innerHTML = reminderFieldsetHTML({ head: { title: "", net: "normal" }, boxes: [] }, { open: false });
    fieldset = host.firstElementChild;
    const configuration = element.querySelector(SURFACES.dialogConfiguration);
    const buttons = element.querySelector(SURFACES.dialogButtons);
    if ( configuration ) configuration.insertAdjacentElement("afterend", fieldset);
    else if ( buttons ) buttons.insertAdjacentElement("beforebegin", fieldset);
    else element.querySelector("form")?.appendChild(fieldset);
  }
  fieldset.querySelectorAll("[data-bf-buy]").forEach(n => n.remove());
  for ( const row of buy.rows ) {
    const box = document.createElement("div");
    box.innerHTML = buyBoxHTML({ name: row.name, point: row.point, left: row.left, rule: row.rule, checked: buy.armed === row.name });
    fieldset.appendChild(box.firstElementChild);
  }
  // One tick at a time — Advantage does not stack, so a second buy would only spend twice.
  fieldset.querySelectorAll('input[name="bf-buy"]').forEach(input => input.addEventListener("change", ev => {
    buy.armed = ev.target.checked ? ev.target.dataset.bfBuyName : false;
    drawBuy(app);
  }));
  renet(app, element);
}

/** The header and the highlighted button, with the tick counted. A save that cannot succeed keeps its Fails. */
function renet(app, element) {
  const buy = app.options.bfBuy;
  const gate = gateOf(app.options);
  const actor = fromUuidSync(buy.actorUuid);
  const row = buy.armed ? buy.rows.find(r => r.name === buy.armed) : null;
  const sources = [...(gate?.sources ?? []), ...(row ? [buySource(actor?.name ?? "You", row)] : [])];
  buy.net = netMode(sources);
  if ( gate?.autoFail ) return;
  const head = element.querySelector("[data-bf-reminder-head]");
  const n = sources.length;
  if ( head ) head.innerHTML = `<span>${n} ${(n === 1) ? "Modifier" : "Modifiers"} — Net</span> ${modeTagHTML(buy.net)}`;
  markDefaultButton(element, buy.net);
}

Hooks.on("renderRollConfigurationDialog", app => {
  try {
    if ( !app.options?.bfBuy ) return;
    openBuys.add(app);
    drawBuy(app);
  } catch(err) {
    console.error(`${TITLE} | Advantage buy box failed to draw.`, err);
  }
});

// The attack gate redraws its whole section on a re-target (reminders.js, registered first); the box follows.
Hooks.on("targetToken", () => {
  for ( const app of openBuys ) {
    if ( app.rendered && app.element ) { try { drawBuy(app); } catch(err) { console.error(`${TITLE} | Advantage buy box failed to redraw.`, err); } }
    else openBuys.delete(app);
  }
});

/**
 * THE SPEND AND THE RECORD — once, after the dialog closes with rolls in hand. The use goes only
 * when the box was ticked and the NET was pressed; the gate's record is rewritten with the buy
 * among its sources, and the spend rides the uniform `poolSpend` record. An initiative roll carries
 * the facts on its own options instead: its message is made later, by the combat, from a clone.
 */
Hooks.on("dnd5e.postRollConfiguration", (rolls, config, dialog, message) => {
  try {
    const buy = config?.bfBuy;
    if ( !buy || !rolls?.length ) return;
    if ( buy.shown ) rolls[0].options.bfBuyShown = true;           // the initiative fold stands aside
    if ( !buy.armed ) return;
    const mode = rollModeOf(rolls[0]?.options?.advantageMode);
    if ( mode !== buy.net ) return;                                  // pressed against the net: nothing bought
    const row = buy.rows.find(r => r.name === buy.armed);
    const actor = fromUuidSync(buy.actorUuid);
    const item = row ? actor?.items?.get(row.itemId) : null;
    const left = Number(item?.system?.uses?.value ?? 0);
    if ( !item || !(left > 0) ) return;
    void item.update({ "system.uses.spent": Number(item.system.uses.spent ?? 0) + 1 })
      .catch(err => console.error(`${TITLE} | Advantage buy spend failed.`, err));
    const record = { pool: `${row.point}s`, spent: 1, left: left - 1, max: Number(item.system.uses.max ?? 0),
      ability: row.name, actorUuid: actor.uuid, at: Date.now() };
    rolls[0].options.bfBought = row.name;
    if ( !message ) return;
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.poolSpend`, record);
    const gate = gateOf(config);
    const sources = [...(gate?.sources ?? []), buySource(actor.name, row)];
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${REMINDER_FLAG}`, {
      ...reminderRecord({ sources, net: buy.net, mode, answeredAt: Date.now() }),
      ...statContext(actor.uuid)
    });
  } catch(err) {
    console.error(`${TITLE} | Advantage buy record failed.`, err);
  }
});

// An initiative bought through its dialog: the combat makes the message from the roll's clone, so
// the line reads the roll's own options — the one card that carries no gate record of its own.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const bought = message?.rolls?.[0]?.options?.bfBought;
    if ( !bought || !message.getFlag("core", "initiativeRoll") ) return;
    const row = ADVANTAGE_BUYS[bought];
    const line = document.createElement("div");
    line.innerHTML = bfCard({ eyebrow: "Before the roll", tone: "good",
      title: `${bought} — Advantage bought`, subtitle: row ? `1 ${row.point} spent` : "" });
    (html instanceof HTMLElement ? html : html?.[0])?.querySelector(SURFACES.messageContent)?.appendChild(line);
  } catch(err) {
    console.error(`${TITLE} | Advantage buy card line failed.`, err);
  }
});
