/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE CAST RIDERS (CAST_RIDERS — Wild Magic Surge, Inspiring Smite):
 * what a feature does right after its bearer casts. Read at `dnd5e.postUseActivity` on the casting client.
 * Wild Magic Surge rolls its d20 itself (R1 — "you can roll" has one sensible answer; a bend by choice) once per
 * turn after a Sorcerer spell cast with a slot, and rolls the pack's table on a 20 — or at once when Tides of
 * Chaos was spent, which comes back; the cast card says what happened, the table's card what surged. Inspiring
 * Smite, after Divine Smite, rolls its Temporary Hit Points and asks the paladin how to divide them among the
 * creatures within reach — the rest song's popup (rest-grants.js `askHandOut`), its clock giving all to the
 * paladin (a bend by choice); the Channel Divinity is spent only when something is given.
 */
import { MODULE_ID, TITLE, decisionWindow } from "./core.js";
import { activityNamed, activityOfType, featureNamed, lower } from "./lookup.js";
import { CAST_RIDERS, castRiderEntries, listedNames, answers } from "./decide/registry.js";
import { castWithSlot, spellClassOf, surgeLine, surgeOutcome } from "./decide/cast-riders.js";
import { riderPartFormula } from "./decide/clock.js";
import { esc } from "./decide/present.js";
import { poolOf } from "./shared.js";
import { askHandOut } from "./rest-grants.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const SURGE_FLAG = "castRider";   // on the cast's usage card — its line

/** The listed rows this caster holds: `[{ name, row, item }]`. */
function ridersOf(actor) {
  const listed = listedNames(castRiderEntries());
  const out = [];
  for ( const [name, row] of Object.entries(CAST_RIDERS) ) {
    if ( !listed.has(lower(name)) ) continue;
    const item = featureNamed(actor, name);
    if ( item ) out.push({ name, row, item });
  }
  return out;
}

/** This combat turn's key, or null out of combat (no once-per-turn limit there). */
function turnKey() {
  const c = game.combat;
  return c?.started ? `${c.id}:${c.round}:${c.turn}` : null;
}

/** Did this caster already roll this row this turn? The cards are the record. */
const rolledThisTurn = (actor, name, key) => !!key && game.messages.contents.some(m => {
  const f = m.getFlag(MODULE_ID, SURGE_FLAG);
  return (f?.feature === name) && (f.actorUuid === actor.uuid) && (f.turn === key) && (f.d20 || f.tides);
});

listen("dnd5e.postUseActivity", "cast-riders", (activity, usageConfig, results) => {
  try {
    const actor = activity?.actor;
    const item = activity?.item;
    if ( !(actor instanceof Actor) || (item?.type !== "spell") || !actor.isOwner ) return;
    for ( const { name, row, item: feature } of ridersOf(actor) ) {
      if ( row.after && !answers(row.after, item) ) continue;
      if ( row.spellClass ) {
        const slot = castWithSlot({ level: Number(item.system?.level) || 0, method: item.system?.method ?? null,
          spendsSlot: (activity.consumption?.spellSlot !== false) && (usageConfig?.consume?.spellSlot !== false) });
        const cls = spellClassOf({ classIdentifier: item.system?.classIdentifier ?? null, sourceItem: item.system?.sourceItem ?? null,
          casterClasses: Object.keys(actor.classes ?? {}) });
        if ( !slot || (cls !== row.spellClass) ) continue;
        void surge({ name, row, actor, message: results?.message ?? null });
        continue;
      }
      if ( row.handOut ) void inspire({ name, row, feature, actor });
    }
  } catch(err) {
    console.error(`${TITLE} | A cast rider could not be read — play it from the sheet.`, err);
  }
});

/* --- WILD MAGIC SURGE ------------------------------------------------------------------------------ */

async function surge({ name, row, actor, message }) {
  try {
    const tides = row.tides ? featureNamed(actor, row.tides) : null;
    const tidesSpent = !!tides && (Number(tides.system?.uses?.max) > 0) && !(Number(tides.system?.uses?.value) > 0);
    const key = turnKey();
    let o = surgeOutcome({ tidesSpent, used: rolledThisTurn(actor, name, key) });
    let d20 = null;
    if ( o.roll ) {
      d20 = (await new Roll("1d20").evaluate()).total;
      o = surgeOutcome({ tidesSpent, used: false, d20, surgeOn: row.surgeOn });
    } else if ( !o.surged ) return;   // this turn's roll is made: nothing, no line
    let result = null;
    if ( o.surged ) result = await rollTable(row.table, actor);
    if ( o.tides ) await tides.update({ "system.uses.spent": 0 });
    const record = { feature: name, actorUuid: actor.uuid, turn: key, d20, surged: o.surged, tides: o.tides, result };
    if ( message?.isOwner ) await message.setFlag(MODULE_ID, SURGE_FLAG, record);
    else await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${esc(surgeLine(record))}</p>`,
      flags: { [MODULE_ID]: { [SURGE_FLAG]: record } } });
  } catch(err) {
    console.error(`${TITLE} | ${name} failed — roll the d20 and the table by hand.`, err);
  }
}

/** The pack's table rolled (never marked drawn — a compendium table is not written) and posted; its text back. */
async function rollTable(uuid, actor) {
  const table = uuid ? await fromUuid(uuid) : null;
  if ( !table ) { console.warn(`${TITLE} | The Wild Magic Surge table (${uuid}) is not on this box — roll it by hand.`); return null; }
  const { roll, results } = await table.roll();
  await table.toMessage(results, { roll, messageData: { speaker: ChatMessage.getSpeaker({ actor }) } });
  const r = results?.[0];
  const text = String(r?.description || r?.name || r?.text || "").replace(/<[^>]*>/g, " ")
    .replace(/\[\[\/r\s*([^\]]+)\]\]/g, "$1").replace(/\s+/g, " ").trim();
  return text ? (text.length > 140 ? `${text.slice(0, 137)}…` : text) : null;
}

listen("dnd5e.renderChatMessage", "cast-riders", (message, html) => {
  try {
    const r = message.getFlag(MODULE_ID, SURGE_FLAG);
    if ( !r ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-surge-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-surge-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-wand-sparkles" data-tooltip="${esc(r.feature)}"></i> ${esc(surgeLine(r))}`;
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The surge line could not render.`, err); }
});

/* --- INSPIRING SMITE ------------------------------------------------------------------------------- */

async function inspire({ name, row, feature, actor }) {
  try {
    const activity = row.activity ? activityNamed(feature, row.activity) : activityOfType(feature, "heal");
    const pool = activity ? poolOf(actor, activity) : null;
    if ( !activity || !pool || !(Number(pool.system?.uses?.value ?? 0) > 0) ) return;   // no Channel Divinity: nothing to offer
    const h = activity.healing;
    const raw = h ? riderPartFormula({ number: h.number, denomination: h.denomination, custom: h.custom, bonus: h.bonus }) : null;
    if ( !raw ) { console.warn(`${TITLE} | ${name}: no healing part on its activity — give it by hand.`); return; }
    const roll = await new Roll(raw, activity.getRollData?.() ?? actor.getRollData()).evaluate();
    if ( !(roll.total > 0) ) return;
    const window = decisionWindow();
    await askHandOut(actor, { name, row, item: feature, amount: roll.total, roll, table: "cast", distribute: true,
      cost: { itemId: pool.id, name: pool.name }, window });
  } catch(err) {
    console.error(`${TITLE} | ${name} could not be asked — give it by hand.`, err);
  }
}
