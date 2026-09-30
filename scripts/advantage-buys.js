/**
 * Battle Flow — MACHINE layer (ARCHITECTURE.md §2): THE ADVANTAGE BUYS — Advantage on your own D20
 * Test bought with an item's use BEFORE the roll (ADVANTAGE_BUYS; RULINGS *Where the table bends
 * the rule*): a box per held row in the gate's section of dnd5e's dialog. The use is spent only
 * when the roll goes out ticked AND the net was pressed. Initiative with no dialog is
 * d20-folds.js's (`bfBuyShown`). Runs on the roller's client; sets no mode (R-A).
 * ⚠ HOOK ORDER: imported AFTER reminders.js, so this re-nets the gate's record with the buy included.
 */
import { MODULE_ID, TITLE, statContext } from "./core.js";
import { itemsNamed } from "./lookup.js";
import { reminderEntries } from "./decide/registry.js";
import { DialogCarried, markDefaultButton } from "./ui.js";
import { bfCard, buyBoxHTML, forgoBoxHTML, modeTagHTML, reminderFieldsetHTML } from "./decide/present.js";
import { ADVANTAGE_BUYS } from "./decide/registry.js";
import { rollModeOf } from "./decide/chips.js";
import { REMINDER_FLAG, forgoOff, forgoneSources, netMode, reminderRecord, reminderSource } from "./decide/reminders.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

/** The rows this actor can buy on this kind of test — every held row, spent ones greyed (the box says why). */
function buysFor(actor, testKind) {
  if ( !(actor instanceof Actor) ) return [];
  if ( !reminderEntries().some(e => e.kind === "buy") ) return [];
  const out = [];
  for ( const [name, row] of Object.entries(ADVANTAGE_BUYS) ) {
    if ( !row.tests.includes(testKind) ) continue;
    // ⚠ Uses demanded: the 2014 Halfling's "Lucky" trait shares the name and has none.
    const item = itemsNamed(actor, name, { types: ["feat"] })
      .find(i => !row.uses || (Number(i.system?.uses?.max) > 0));
    if ( !item ) continue;
    // A FORGO row (Brutal Strike, B3): nothing spent; the box is off unless the roll carries Advantage and no Disadvantage.
    if ( row.forgo ) { out.push({ name, forgo: true, ability: row.ability ?? null, point: null, rule: row.rule, itemId: item.id, left: null, max: 0 }); continue; }
    out.push({ name, point: row.point, rule: row.rule, itemId: item.id,
      left: row.uses ? Math.max(0, Number(item.system.uses.value ?? 0)) : null, max: Number(item.system?.uses?.max ?? 0) });
  }
  return out;
}

/** Ride the dialog: one DialogCarried shared by the config, the rendered app and the record (ui.js). */
function carry(config, dialog, actor, testKind, ability = null) {
  if ( dialog?.configure === false ) return;                           // no dialog, no box
  const rows = buysFor(actor, testKind);
  if ( !rows.length ) return;
  const buy = new DialogCarried({ rows, armed: null, shown: false, net: null, testKind, actorUuid: actor.uuid, ability });
  dialog.options ??= {};
  dialog.options.bfBuy = buy;
  config.bfBuy = buy;
}

listen("dnd5e.preRollAttack", "advantage-buys", (config, dialog) => {
  try {
    const activity = config?.subject;
    if ( activity?.type !== "attack" ) return;
    carry(config, dialog, activity.item?.actor, "attack", activity.ability || "str");
  } catch(err) { console.error(`${TITLE} | Advantage buy (attack) failed — rolling natively.`, err); }
});

// Death saves and concentration saves ride this hook too: every one is a D20 Test.
listen("dnd5e.preRollSavingThrow", "advantage-buys", (config, dialog) => {
  try { carry(config, dialog, config?.subject, "save"); }
  catch(err) { console.error(`${TITLE} | Advantage buy (save) failed — rolling natively.`, err); }
});

// Raw checks, skills, tools and INITIATIVE's dialog (its hookNames carry `initiativeDialog`).
listen("dnd5e.preRollAbilityCheck", "advantage-buys", (config, dialog) => {
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

/** Draw or redraw the boxes and re-net the header; idempotent (the gate may replace its section). */
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
  fieldset.querySelectorAll("[data-bf-buy]").forEach(n => { n.remove(); });
  const gate = gateOf(app.options);
  for ( const row of buy.rows ) {
    const box = document.createElement("div");
    box.innerHTML = row.forgo
      ? forgoBoxHTML({ name: row.name, rule: row.rule, checked: buy.armed === row.name, off: forgoOff(row, gate, buy.ability ?? null), says: "the hit offers its effects",
        struck: (buy.armed === row.name) ? forgoneSources(gate?.sources ?? [], row.name).filter(s => s.forgone).map(s => s.label) : [] })
      : buyBoxHTML({ name: row.name, point: row.point, left: row.left, rule: row.rule, checked: buy.armed === row.name });
    fieldset.appendChild(box.firstElementChild);
  }
  // One tick at a time — Advantage does not stack, so a second buy would only spend twice.
  fieldset.querySelectorAll('input[name="bf-buy"]').forEach(input => { input.addEventListener("change", ev => {
    buy.armed = ev.target.checked ? ev.target.dataset.bfBuyName : false;
    drawBuy(app);
  }); });
  renet(app, element);
}

/** The header and the highlighted button, with the tick counted. A save that cannot succeed keeps its Fails. */
function renet(app, element) {
  const buy = app.options.bfBuy;
  const gate = gateOf(app.options);
  const actor = fromUuidSync(buy.actorUuid);
  const row = buy.armed ? buy.rows.find(r => r.name === buy.armed) : null;
  // A forgo row STRIKES the Advantage sources (listed, no vote); a buy row ADDS its own.
  const sources = row?.forgo
    ? forgoneSources(gate?.sources ?? [], row.name)
    : [...(gate?.sources ?? []), ...(row ? [buySource(actor?.name ?? "You", row)] : [])];
  buy.net = netMode(sources);
  if ( gate?.autoFail ) return;
  const head = element.querySelector("[data-bf-reminder-head]");
  const n = sources.length;
  if ( head ) head.innerHTML = `<span>${n} ${(n === 1) ? "Modifier" : "Modifiers"} — Net</span> ${modeTagHTML(buy.net)}`;
  markDefaultButton(element, buy.net);
}

listen("renderRollConfigurationDialog", "advantage-buys", app => {
  try {
    if ( !app.options?.bfBuy ) return;
    openBuys.add(app);
    drawBuy(app);
  } catch(err) {
    console.error(`${TITLE} | Advantage buy box failed to draw.`, err);
  }
});

// The attack gate redraws its whole section on a re-target (reminders.js, registered first); the box follows.
listen("targetToken", "advantage-buys", () => {
  for ( const app of openBuys ) {
    if ( app.rendered && app.element ) { try { drawBuy(app); } catch(err) { console.error(`${TITLE} | Advantage buy box failed to redraw.`, err); } }
    else openBuys.delete(app);
  }
});

/**
 * THE SPEND AND THE RECORD — once, after the dialog closes with rolls in hand: the gate's record
 * rewritten with the buy among its sources, the spend as `poolSpend`. ⚠ An initiative roll carries
 * the facts on its own options: the combat makes its message later, from a clone.
 */
listen("dnd5e.postRollConfiguration", "advantage-buys", (rolls, config, _dialog, message) => {
  try {
    const buy = config?.bfBuy;
    if ( !buy || !rolls?.length ) return;
    if ( buy.shown ) rolls[0].options.bfBuyShown = true;           // the initiative fold stands aside
    if ( !buy.armed ) return;
    const mode = rollModeOf(rolls[0]?.options?.advantageMode);
    if ( mode !== buy.net ) return;                                  // pressed against the net: nothing bought
    const row = buy.rows.find(r => r.name === buy.armed);
    const actor = fromUuidSync(buy.actorUuid);
    // THE FORGO'S RECORD (Brutal Strike): nothing spent; the reminder record carries the struck sources and `forgo`, which
    // the hit menu's group reads (`requires.forgo`). Rolled against the net (with Advantage after all): nothing forgone.
    if ( row?.forgo ) {
      rolls[0].options.bfForgo = row.name;
      if ( !message ) return;
      const gate = gateOf(config);
      foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${REMINDER_FLAG}`, {
        ...reminderRecord({ sources: forgoneSources(gate?.sources ?? [], row.name), net: buy.net, mode, answeredAt: Date.now() }),
        forgo: row.name, ...statContext(actor?.uuid ?? buy.actorUuid)
      });
      return;
    }
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

// An initiative bought through its dialog: the line reads the roll's own options (no gate record).
listen("dnd5e.renderChatMessage", "advantage-buys", (message, html) => {
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
