/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE STORED DICE (STORED_DICE — Portent). At the rest the row's d20s
 * are rolled and kept as a chip on the bearer ("Portent — 17 · 3", the effect view lists it); a face is spent to
 * REPLACE a D20 Test's d20, once per turn. The bearer's OWN roll: a tick per face in the roll's dialog, BEFORE the
 * roll (the rule's order) — the d20 rolled pinned to the face. Another creature's roll: the bystander's bend
 * (INTERRUPT_ROLLS `bend: "set"`, hold/ and bystanders.js), after the roll — the register's bend.
 */
import { MODULE_ID, TITLE } from "./core.js";
import { featureNamed, lower } from "./lookup.js";
import { STORED_DICE, listedNames, storedDiceEntries } from "./decide/registry.js";
import { storedChipName } from "./decide/stored-dice.js";
import { esc } from "./decide/present.js";
import { STORED_FLAG, spendStoredFace, storedChipOf, storedFacesUsable } from "./shared.js";
import { DialogCarried } from "./ui.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const REST_LINE = "storedRolled";   // on the rest card — its line
const USED_LINE = "storedUsed";     // on the roll's own message — its line

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

/* --- THE REST: the dice rolled and kept ---------------------------------------------------------- */

listen("dnd5e.restCompleted", "stored-dice", (actor, result, config) => {
  try {
    if ( !(actor instanceof Actor) || !actor.isOwner ) return;
    const restType = result?.type ?? config?.type ?? "long";
    const rows = rowsOf(actor).filter(r => (r.row.rests ?? ["long"]).includes(restType));
    if ( !rows.length ) return;
    void (async () => {
      const rolled = [];
      for ( const { key, row, item } of rows ) {
        const roll = await new Roll(`${Number(row.dice) || 2}d${Number(row.die) || 20}`).evaluate();
        const faces = roll.dice[0].results.map(r => r.result);
        // B4 — an omen row's chip says which omen the face is (Cosmic Omen: even Weal, odd Woe); its face is never spent.
        const name = row.omen ? `${key} — ${(faces[0] % 2 === 0) ? "Weal" : "Woe"} (${faces[0]})` : storedChipName(key, faces);
        const stale = actor.effects.filter(e => e.getFlag(MODULE_ID, STORED_FLAG)?.key === key).map(e => e.id);
        if ( stale.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", stale);
        await ActiveEffect.implementation.create({
          name, img: item.img ?? "icons/svg/d20.svg", origin: item.uuid, transfer: false, disabled: false,
          description: row.omen
            ? `<p>Written by Battle Flow at the rest: ${esc(key)}'s roll — ${(faces[0] % 2 === 0) ? "even, Weal: your Reaction adds 1d6 to a creature's D20 Test" : "odd, Woe: your Reaction subtracts 1d6 from a creature's D20 Test"} within 30 feet. Rolled again at the next Long Rest.</p>`
            : `<p>Written by Battle Flow at the rest: ${esc(key)}'s dice, each spent once to replace a d20. Lost at the next ${restType === "long" ? "Long" : "Short"} Rest.</p>`,
          flags: { [MODULE_ID]: { [STORED_FLAG]: { key, faces, turn: null } } }
        }, { parent: actor });
        rolled.push({ key, faces });
      }
      if ( result?.message?.isOwner ) await result.message.setFlag(MODULE_ID, REST_LINE, rolled);
    })().catch(err => console.error(`${TITLE} | The stored dice could not be rolled — roll them by hand.`, err));
  } catch(err) {
    console.error(`${TITLE} | The stored dice failed at the rest.`, err);
  }
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
    for ( const face of chip.getFlag(MODULE_ID, STORED_FLAG)?.faces ?? [] ) faces.push({ key, face, rule: row.rule });
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
  box.innerHTML = `<legend>Battle Flow — before the roll</legend>` + stored.faces.map((f, i) => `
    <label style="display:flex;align-items:center;gap:0.4rem;margin:0.15rem 0;cursor:pointer;">
      <input type="checkbox" name="bf-stored" value="${i}" ${stored.armed === i ? "checked" : ""} style="margin:0;">
      <span><strong>${esc(f.key)}</strong> — use the ${f.face}</span>
      <span style="margin-left:auto;opacity:0.7;font-size:var(--font-size-11,11px);">no die rolled · a stored die</span></label>`).join("");
  const anchor = element.querySelector("[data-bf-reminder]") ?? element.querySelector(SURFACES.dialogConfiguration);
  const buttons = element.querySelector(SURFACES.dialogButtons);
  if ( anchor ) anchor.insertAdjacentElement("afterend", box);
  else if ( buttons ) buttons.insertAdjacentElement("beforebegin", box);
  else element.querySelector("form")?.appendChild(box);
  for ( const input of box.querySelectorAll('input[name="bf-stored"]') ) input.addEventListener("change", ev => {
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
    const actor = fromUuidSync(stored.actorUuid);
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
    const rested = message.getFlag(MODULE_ID, REST_LINE);
    const used = message.getFlag(MODULE_ID, USED_LINE);
    const said = rested?.length ? rested.map(r => STORED_DICE[r.key]?.omen ? `${r.key} — ${(r.faces[0] % 2 === 0) ? "Weal" : "Woe"} (${r.faces[0]})` : `${r.key} — ${r.faces.join(" and ")} kept`).join(" · ")
      : used ? `${used.key} — the d20 is the ${used.face}` : null;
    if ( !said || content.querySelector(".bf-stored-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-stored-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-dice-d20" data-tooltip="${esc(rested?.[0]?.key ?? used?.key ?? "")}"></i> ${esc(said)}`;
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The stored dice line could not render.`, err); }
});
