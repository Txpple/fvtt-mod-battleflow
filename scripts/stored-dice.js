/**
 * By the Books — MACHINE (ARCHITECTURE.md §7): THE STORED DICE (STORED_DICE — Portent). At the rest the row's d20s
 * are rolled BY THE BEARER (the rest card asks — a popup with one button, Roll, for whoever owns the creature, the GM
 * where no player does; the timer rolls when it runs out; RULINGS *Portent widened*) and kept as a chip on the bearer
 * ("Portent — 17 · 3", the effect view lists it); a face is spent to REPLACE a D20 Test's d20, once per turn. The
 * bearer's OWN roll: a tick per face in the roll's dialog, BEFORE the roll (the rule's order) — the d20 rolled pinned to
 * the face. Another creature's roll: the bystander's bend (INTERRUPT_ROLLS `bend: "set"`, hold/ and bystanders.js),
 * after the roll — the register's bend.
 */
import { MODULE_ID, readFlag, TITLE, canAnswerFor, decisionWindow, resolveUuid } from "./core.js";
import { featureNamed, lower } from "./lookup.js";
import { STORED_DICE, listedNames, storedDiceEntries } from "./decide/registry.js";
import { storedChipName } from "./decide/stored-dice.js";
import { bfCard, esc, holdBarHTML, ruleLine, pickInputHTML } from "./decide/present.js";
import { STORED_FLAG, spendStoredFace, storedChipOf, storedFacesUsable } from "./shared.js";
import { DialogCarried, armDeadline, disarmDeadline, momentButton, openMomentPopup, registerResumable, closePopup, pickInputs } from "./ui.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const REST_LINE = "storedRolled";   // on the roll message the rest's dice made — its line (the chip is the state)
const USED_LINE = "storedUsed";     // on the roll's own message — its line
const ASK_FLAG = "storedAsk";       // on the rest card — the bearer owes the roll
const FOR_FLAG = "storedFor";       // on the roll message — the rest card it answers
const timers = new Map();
const rolling = new Set();

/** The listed rows this actor holds: `[{ key, row, item }]`. */
function rowsOf(actor) {
  const listed = listedNames(storedDiceEntries());
  const out = [];
  for ( const [key, row] of Object.entries(STORED_DICE) ) {
    if ( !listed.has(lower(key)) ) continue;
    const item = featureNamed(actor, key);
    if ( !item ) continue;
    // C1 — `more` (Greater Portent): the named feature on the sheet raises the count.
    const more = row.more && featureNamed(actor, row.more.feature) ? { ...row, dice: row.more.dice } : row;
    out.push({ key, row: more, item });
  }
  return out;
}

const formulaOf = row => `${Number(row.dice) || 2}d${Number(row.die) || 20}`;
const restWord = restType => (restType === "long") ? "Long" : "Short";

/* --- THE REST: the bearer rolls the dice; the chip keeps them ----------------------------------------- */

/** The chip on the bearer: the faces in hand, named by what is left; an omen row's by its sign. */
async function writeChip(actor, key, row, item, faces, restType) {
  // B4 — an omen row's chip says which omen the face is (Cosmic Omen: even Weal, odd Woe); its face is never spent.
  const name = row.omen ? `${key} — ${(faces[0] % 2 === 0) ? "Weal" : "Woe"} (${faces[0]})` : storedChipName(key, faces);
  const stale = actor.effects.filter(e => readFlag(e, STORED_FLAG)?.key === key).map(e => e.id);
  if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale);
  await ActiveEffect.implementation.create({
    name, img: item?.img ?? "icons/svg/d20.svg", origin: item?.uuid, transfer: false, disabled: false,
    description: row.omen
      ? `<p>Written by By the Books at the rest: ${esc(key)}'s roll — ${(faces[0] % 2 === 0) ? "even, Weal: your Reaction adds 1d6 to a creature's D20 Test" : "odd, Woe: your Reaction subtracts 1d6 from a creature's D20 Test"} within 30 feet. Rolled again at the next Long Rest.</p>`
      : `<p>Written by By the Books at the rest: ${esc(key)}'s dice, each spent once to replace a d20. Lost at the next ${restWord(restType)} Rest.</p>`,
    flags: { [MODULE_ID]: { [STORED_FLAG]: { key, faces, turn: null } } }
  }, { parent: actor });
}

/** Roll the rows' dice in the open (the dice land on the table), under the bearer's name, and keep them on the chip. */
async function rollRows(actor, rows, { card = null, restType = "long", timedOut = false } = {}) {
  for ( const { key, row, item, formula } of rows ) {
    const roll = await new Roll(formula ?? formulaOf(row)).evaluate();
    const faces = roll.dice[0].results.map(r => r.result);
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${key} — the ${restWord(restType)} Rest's dice${timedOut ? " (timer)" : ""}`,
      flags: { [MODULE_ID]: { [REST_LINE]: [{ key, faces }], ...(card ? { [FOR_FLAG]: card.id } : {}) } } });
    await writeChip(actor, key, row, item, faces, restType);
  }
}

/** The rows a rest card still owes a roll for: none has landed on a roll message pointing back at it (the log, never a tail). */
function owedRows(card, flag, actor) {
  const rolled = new Set(game.messages.contents
    .filter(m => (m.timestamp >= (card.timestamp ?? 0)) && (readFlag(m, FOR_FLAG) === card.id))
    .flatMap(m => (readFlag(m, REST_LINE) ?? []).map(r => r.key)));
  const live = (actor instanceof Actor) ? rowsOf(actor) : [];
  return (flag?.rows ?? []).filter(r => !rolled.has(r.key)).map(r => {
    const held = live.find(x => x.key === r.key);
    return { key: r.key, formula: r.formula, row: held?.row ?? STORED_DICE[r.key] ?? {}, item: held?.item ?? featureNamed(actor, r.key) ?? null };
  });
}

listen("dnd5e.restCompleted", "stored-dice", (actor, result, config) => {
  try {
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    const restType = result?.type ?? config?.type ?? "long";
    const rows = rowsOf(actor).filter(r => (r.row.rests ?? ["long"]).includes(restType));
    if ( !rows.length ) return;
    void (async () => {
      // The old faces go at the rest, before anyone rolls the new ones.
      const stale = actor.effects.filter(e => rows.some(r => readFlag(e, STORED_FLAG)?.key === r.key)).map(e => e.id);
      if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale);
      const card = result?.message;
      // A rest with no card (chat off) has nothing to ask on: rolled here, in the open.
      if ( !(card instanceof ChatMessage) || !card.isOwner ) { await rollRows(actor, rows, { restType }); return; }
      const window = decisionWindow();
      await card.setFlag(MODULE_ID, ASK_FLAG, { status: "pending", actorUuid: actor.uuid, actorName: actor.name, restType,
        rows: rows.map(({ key, row }) => ({ key, formula: formulaOf(row) })),
        ...(window ? { window, deadline: Date.now() + (window * 1000) } : {}) });
    })().catch(err => console.error(`${TITLE} | The stored dice could not be asked for — roll them by hand.`, err));
  } catch(err) {
    console.error(`${TITLE} | The stored dice failed at the rest.`, err);
  }
});

/** Roll what the card still owes — the bearer's press, or the timer's. */
async function rollAsked(card, { timedOut = false } = {}) {
  if ( rolling.has(card.id) ) return;
  rolling.add(card.id);
  try {
    disarmDeadline(timers, card.id);
    const flag = readFlag(card, ASK_FLAG);
    const actor = resolveUuid(flag?.actorUuid);
    if ( (flag?.status !== "pending") || !(actor instanceof Actor) || !actor.isOwner ) return;
    const owed = owedRows(card, flag, actor);
    if ( owed.length ) await rollRows(actor, owed, { card, restType: flag.restType, timedOut });
    void closePopup(card, ASK_FLAG);
    if ( card.isOwner ) await card.setFlag(MODULE_ID, ASK_FLAG, { ...flag, status: "resolved", ...(timedOut ? { timedOut: true } : {}) });
  } catch(err) {
    console.error(`${TITLE} | The stored dice could not be rolled — roll them by hand.`, err);
  } finally {
    rolling.delete(card.id);
  }
}

/** The ask: one popup for whoever answers for the bearer, one button. The timer rolls when it runs out. */
async function showAskPopup(card) {
  const flag = readFlag(card, ASK_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  const owed = owedRows(card, flag, actor);
  if ( !owed.length ) return;
  if ( flag.deadline ) armDeadline(timers, card.id, flag.deadline, () => void rollAsked(card, { timedOut: true }));
  const names = owed.map(r => r.key).join(" and ");
  const dice = owed.map(r => r.formula).join(" and ");
  const first = owed[0];
  const rest = restWord(flag.restType);
  await openMomentPopup(card, ASK_FLAG, actor, {
    title: `${names} — the ${rest} Rest`, icon: "fa-solid fa-dice-d20", width: 440,
    content: bfCard({ img: first.item?.img ?? actor?.img ?? null, eyebrow: `${rest} Rest — ${esc(names)}`, tone: "pending",
      title: `${esc(actor?.name ?? "You")} — roll your ${esc(names)} dice`,
      subtitle: first.row?.omen ? `${esc(dice)}: even is Weal, odd is Woe — kept until the next Long Rest`
        : `${esc(dice)} — kept until the next Long Rest, each face spent once to replace a d20`,
      lines: [ruleLine(first.row?.rule ?? "")] }) + holdBarHTML(flag, "to roll"),
    buttons: [{ action: "roll", label: "Roll", default: true, callback: () => { void rollAsked(card); } }]
  });
}

registerResumable(ASK_FLAG, {
  pending: (flag, card) => (flag?.status === "pending") && (owedRows(card, flag, resolveUuid(flag.actorUuid)).length > 0),
  drives: flag => canAnswerFor(resolveUuid(flag?.actorUuid)),
  drive: showAskPopup
});

// The roll landed (on any client): the ask's popup closes wherever it stands.
listen("createChatMessage", "stored-dice", message => {
  try {
    const forId = readFlag(message, FOR_FLAG);
    if ( forId ) void closePopup(forId, ASK_FLAG);
  } catch { /* nothing to close */ }
});

/* --- THE OWN ROLL: a tick per face in the dialog, before the roll ---------------------------------- */

/** Ride the dialog: the faces this roller may spend now, per row. */
function carry(config, dialog, actor, testKind) {
  if ( dialog?.configure === false || !(actor instanceof Actor) ) return;
  const faces = [];
  for ( const { key, row } of rowsOf(actor) ) {
    if ( !(row.tests ?? []).includes(testKind) ) continue;
    const chip = storedChipOf(actor, key);
    if ( !chip || !storedFacesUsable(chip, row) ) continue;
    for ( const face of readFlag(chip, STORED_FLAG)?.faces ?? [] ) faces.push({ key, face, rule: row.rule });
  }
  if ( !faces.length ) return;
  const stored = new DialogCarried({ faces, armed: null, actorUuid: actor.uuid });
  dialog.options ??= {};
  dialog.options.bfStored = stored;
  config.bfStored = stored;
}

listen("dnd5e.preRollAttack", "stored-dice", (config, dialog) => {
  try { if ( config?.subject?.type === "attack" ) carry(config, dialog, config.subject.item?.actor, "attack"); }
  catch(err) { console.error(`${TITLE} | Stored dice (attack) failed — rolling natively.`, err); }
});
listen("dnd5e.preRollSavingThrow", "stored-dice", (config, dialog) => {
  try { carry(config, dialog, config?.subject, "save"); }
  catch(err) { console.error(`${TITLE} | Stored dice (save) failed — rolling natively.`, err); }
});
// dnd5e fires this for skills and tools too (their hookNames carry "abilityCheck").
listen("dnd5e.preRollAbilityCheck", "stored-dice", (config, dialog) => {
  try { carry(config, dialog, config?.subject, "check"); }
  catch(err) { console.error(`${TITLE} | Stored dice (check) failed — rolling natively.`, err); }
});

/** The ticks, below the gate's section (or where it would stand); one face at a time. */
function drawStored(app) {
  const stored = app.options?.bfStored;
  const element = app.element;
  if ( !stored || !element ) return;
  element.querySelector("[data-bf-stored]")?.remove();
  const box = document.createElement("fieldset");
  box.dataset.bfStored = "";
  box.style.cssText = "margin:0.4rem 0;padding:0.3rem 0.5rem;";
  box.innerHTML = `<legend>By the Books — before the roll</legend>` + stored.faces.map((f, i) => `
    <label style="display:flex;align-items:center;gap:0.4rem;margin:0.15rem 0;cursor:pointer;">
      ${pickInputHTML({ name: "bf-stored", value: i, checked: stored.armed === i, style: "margin:0;" })}
      <span><strong>${esc(f.key)}</strong> — use the ${f.face}</span>
      <span style="margin-left:auto;opacity:0.7;font-size:var(--font-size-11,11px);">no die rolled · a stored die</span></label>`).join("");
  const anchor = element.querySelector("[data-bf-reminder]") ?? element.querySelector(SURFACES.dialogConfiguration);
  const buttons = element.querySelector(SURFACES.dialogButtons);
  if ( anchor ) anchor.insertAdjacentElement("afterend", box);
  else if ( buttons ) buttons.insertAdjacentElement("beforebegin", box);
  else element.querySelector("form")?.appendChild(box);
  for ( const input of pickInputs(box, "bf-stored") ) input.addEventListener("change", ev => {
    stored.armed = ev.target.checked ? Number(ev.target.value) : null;
    drawStored(app);
  });
}

listen("renderRollConfigurationDialog", "stored-dice", app => {
  try { if ( app.options?.bfStored ) drawStored(app); }
  catch(err) { console.error(`${TITLE} | The stored dice could not draw.`, err); }
});

// The roll goes out with the ticked face: every d20 of the term IS that face (Advantage cannot move it), the face spent.
listen("dnd5e.postRollConfiguration", "stored-dice", (rolls, config, _dialog, message) => {
  try {
    const stored = config?.bfStored;
    if ( !stored || !Number.isInteger(stored.armed) || !rolls?.length ) return;
    const pick = stored.faces[stored.armed];
    const actor = resolveUuid(stored.actorUuid);
    if ( !pick || !(actor instanceof Actor) ) return;
    const d20 = rolls[0].d20 ?? rolls[0].dice?.[0];
    if ( !d20 || (Number(d20.faces) !== 20) ) return;
    // The term rolls the face itself: its result IS the face, so the crit, the fumble and every reader of the d20 agree.
    d20.randomFace = () => pick.face;
    void spendStoredFace(actor, pick.key, pick.face)
      .catch(err => console.error(`${TITLE} | ${pick.key}'s face could not be spent — strike it off by hand.`, err));
    if ( message ) foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${USED_LINE}`, { key: pick.key, face: pick.face });
  } catch(err) {
    console.error(`${TITLE} | The stored die could not replace the d20 — the roll went out as rolled.`, err);
  }
});

/* --- THE LINES ----------------------------------------------------------------------------------- */

listen("dnd5e.renderChatMessage", "stored-dice", (message, html) => {
  try {
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content ) return;
    const rested = readFlag(message, REST_LINE);
    const used = readFlag(message, USED_LINE);
    const ask = readFlag(message, ASK_FLAG);
    let said = rested?.length ? rested.map(r => STORED_DICE[r.key]?.omen ? `${r.key} — ${(r.faces[0] % 2 === 0) ? "Weal" : "Woe"} (${r.faces[0]})` : `${r.key} — ${r.faces.join(" and ")} kept`).join(" · ")
      : used ? `${used.key} — the d20 is the ${used.face}` : null;
    let button = null;
    // The rest card: who owes the roll, and the button for whoever answers (the popup's twin, for a popup closed unpressed).
    if ( !said && ask ) {
      const actor = resolveUuid(ask.actorUuid);
      const names = (ask.rows ?? []).map(r => r.key).join(" and ");
      const owed = (ask.status === "pending") ? owedRows(message, ask, actor) : [];
      if ( owed.length ) {
        said = `${names} — ${ask.actorName ?? actor?.name ?? "the bearer"} rolls the dice`;
        if ( canAnswerFor(actor) ) button = momentButton("Roll", () => void rollAsked(message), { marginLeft: "0.4rem", padding: "0 0.4rem", fontSize: "inherit", lineHeight: "1.4" });
      } else said = `${names} — the dice rolled${ask.timedOut ? " (timer)" : ""}`;
    }
    if ( !said || content.querySelector(".bf-stored-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-stored-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-dice-d20" data-tooltip="${esc(rested?.[0]?.key ?? used?.key ?? ask?.rows?.[0]?.key ?? "")}"></i> ${esc(said)}`;
    if ( button ) div.append(button);
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The stored dice line could not render.`, err); }
});
