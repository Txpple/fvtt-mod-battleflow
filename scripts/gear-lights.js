/**
 * By the Books — gear lights (registry GEAR_LIGHTS): using a Candle, Torch, Lamp or Lantern opens a
 * light toggle on the client that used it, instead of the item's activity. The light rides an effect on the
 * item's owner (a `token.light.*` change, as TOKEN_LIGHTS' does): its presence is the light being on.
 * Nothing is consumed and nothing runs by the clock; a Long Rest puts it out (RULINGS *Gear lights*).
 */
import { MODULE_ID, readFlag, TITLE, canApplyTo, drivesMomentFor, statContext } from "./core.js";
import { ruleHTML } from "./rule-text.js";
import { GEAR_LIGHTS, gearLightEntries, listedNames, identifierOf } from "./decide/registry.js";
import { GEAR_LIT, gearLightRow, gearLightOf, gearButtons, gearToggle, gearLightWords, gearCardTitle,
  lightChanges } from "./decide/token-lights.js";
import { bfCard, ruleLine, popupKey } from "./decide/present.js";
import { effectRecord, joinEffectReceipt } from "./decide/receipt.js";
import { openManagedPopup, livePopups } from "./ui.js";
import { listen } from "./dispatch.js";

const GEAR_FLAG = "gearLight";

/** The row an owned item answers to, as `{ key, ...row }`, or null. */
function rowOf(item) {
  if ( !item?.actor || (item.documentName !== "Item") ) return null;
  const key = gearLightRow(GEAR_LIGHTS, { name: item.name, identifier: item.system?.identifier ?? null },
    listedNames(gearLightEntries()), identifierOf);
  return key ? { key, ...GEAR_LIGHTS[key] } : null;
}

/** The bearer's gear-light effects. */
const gearEffects = actor => [...(actor?.effects ?? [])].filter(e => readFlag(e, GEAR_FLAG));

/** This item's standing light on its bearer, or null. */
const litEffectOf = item => gearEffects(item?.actor).find(e => readFlag(e, GEAR_FLAG)?.itemId === item.id) ?? null;

/** The effect's name in a state: "Torch (lit)", "Lantern, Hooded (lit, hood down)". */
function effectName(item, row, state) {
  const word = (state === GEAR_LIT) ? row.label : row.states?.[state]?.label;
  return `${item.name} (lit${word ? `, ${word}` : ""})`;
}

/* --- the seam: the use opens the toggle, and no activity runs ------------------------------------ */

// One activity (every listed pack item has one), a shift-click past the picker, or a macro naming
// the activity: the use stops before its dialog, card or consumption.
listen("dnd5e.preUseActivity", "gear-lights", activity => {
  try {
    const row = rowOf(activity?.item);
    if ( !row ) return;
    void openToggle(activity.item, row);
    return false;
  } catch(err) {
    console.error(`${TITLE} | Gear light failed — set the token's light by hand.`, err);
  }
});

// ⚠ dnd5e calls no hook before its activity picker (`Item5e#use`): a listed item with several
// activities (a world copy given a Light use) opens the toggle instead, the picker dismissed unseen,
// so its promise resolves to no activity and nothing runs.
listen("renderActivityChoiceDialog", "gear-lights", (app, element) => {
  try {
    const row = rowOf(app?.item);
    if ( !row ) return;
    if ( element?.style ) element.style.display = "none";
    setTimeout(() => { void app.close({ animate: false }); }, 0);
    void openToggle(app.item, row);
  } catch(err) {
    console.error(`${TITLE} | Gear light failed — set the token's light by hand.`, err);
  }
});

// A listed item with NO activity posts the system's item card instead: the toggle opens there too.
listen("dnd5e.preDisplayCard", "gear-lights", item => {
  try {
    const row = rowOf(item);
    if ( !row ) return;
    void openToggle(item, row);
    return false;
  } catch(err) {
    console.error(`${TITLE} | Gear light failed — set the token's light by hand.`, err);
  }
});

/* --- the popup -------------------------------------------------------------------------------------- */

/** Open the toggle for one item on this client: its rule line, and the presses its state allows. */
async function openToggle(item, row) {
  const key = popupKey(item.uuid, GEAR_FLAG);
  const open = livePopups.get(key);
  if ( open ) { open.bringToFront?.(); return; }
  const lit = litEffectOf(item);
  const litState = lit ? (readFlag(lit, GEAR_FLAG)?.state ?? GEAR_LIT) : null;
  const shown = litState ? gearLightOf(row, litState) : null;
  const buttons = gearButtons(row, litState).map((b, i) => ({
    action: `${b.press}${b.state ? `-${b.state}` : ""}`,
    label: b.label,
    default: i === 0,
    callback: () => { void press(item, row, b); }
  }));
  const dialog = new foundry.applications.api.DialogV2({
    window: { title: item.name, icon: "fa-solid fa-fire" },
    position: { width: 400 },
    content: bfCard({
      img: item.img, eyebrow: "Gear light", tone: litState ? "good" : "neutral",
      title: litState ? `${item.name} — lit: ${gearLightWords(shown)}` : `${item.name} — unlit`,
      subtitle: `${item.actor.name} · nothing is used up`,
      lines: [ruleLine(row.rule)]
    }),
    buttons,
    rejectClose: false
  });
  await openManagedPopup(key, null, dialog);
}

/**
 * One press, on the client that used the item (an owner of its actor): the other gear light put out,
 * this one created, updated or deleted, and one public card.
 */
async function press(item, row, b) {
  const actor = item.actor;
  if ( !actor ) return;
  if ( !canApplyTo(actor) ) {
    ui.notifications?.warn(`${TITLE} | You cannot change ${actor.name}'s light — ask the GM.`);
    return;
  }
  try {
    const mine = gearEffects(actor);
    const lit = mine.find(e => readFlag(e, GEAR_FLAG)?.itemId === item.id) ?? null;
    const step = gearToggle({
      lit: lit ? { id: lit.id, state: readFlag(lit, GEAR_FLAG)?.state ?? GEAR_LIT } : null,
      others: mine.filter(e => e !== lit).map(e => e.id)
    }, b);
    if ( step.op === "none" ) return;
    const wentOut = step.putOut.map(id => readFlag(actor.effects.get(id), GEAR_FLAG)?.itemName).filter(Boolean);
    if ( step.putOut.length ) await deleteQuietly(actor, step.putOut);
    const description = await ruleHTML(row.rule);
    let created = null;
    if ( step.op === "create" ) {
      [created] = await actor.createEmbeddedDocuments("ActiveEffect", [effectData(item, row, step.state, description)]);
    } else if ( step.op === "update" ) {
      await lit.update({
        name: effectName(item, row, step.state),
        "system.changes": lightChanges(gearLightOf(row, step.state)),
        [`flags.${MODULE_ID}.${GEAR_FLAG}.state`]: step.state
      });
    } else if ( step.op === "delete" ) {
      await deleteQuietly(actor, [lit.id]);
    }
    await postCard(actor, item, row, {
      op: step.op, state: step.state ?? GEAR_LIT, wentOut,
      effect: created ? { id: created.id, name: created.name, img: created.img ?? null, description } : null
    });
  } catch(err) {
    console.error(`${TITLE} | Gear light failed — set the token's light by hand.`, err);
    ui.notifications?.error(`${TITLE} | ${item.name}: the light could not be changed — set the token's light by hand.`);
  }
}

/** The effect a lit item lands on its bearer: no clock, no change but the light. */
function effectData(item, row, state, description) {
  return {
    name: effectName(item, row, state),
    img: item.img ?? "icons/sundries/lights/torch-brown-lit.webp",
    type: "base",
    description,
    origin: item.uuid,
    disabled: false,
    transfer: false,
    system: { changes: lightChanges(gearLightOf(row, state)) },
    flags: { [MODULE_ID]: { [GEAR_FLAG]: { key: row.key, itemId: item.id, itemName: item.name, state } } }
  };
}

/** Delete effects that may already be gone (another client's put-out, a hand delete): a lost race is no error. */
async function deleteQuietly(actor, ids) {
  const live = ids.filter(id => actor.effects.has(id));
  if ( !live.length ) return;
  await actor.deleteEmbeddedDocuments("ActiveEffect", live).catch(err => {
    if ( live.some(id => actor.effects.has(id)) ) throw err;
  });
}

/** The public receipt; a newly lit item's card carries the effect receipt, whose revert puts it out. */
async function postCard(actor, item, row, { op, state, wentOut = [], effect = null, reason = null }) {
  const light = (op === "delete") ? null : gearLightOf(row, state);
  const flags = { [GEAR_FLAG]: { key: row.key, op, state, actorUuid: actor.uuid, itemId: item.id, itemName: item.name, reason } };
  if ( effect ) {
    const receipt = {};
    joinEffectReceipt(receipt, { uuid: actor.uuid, name: actor.name, img: actor.img ?? null,
      effects: [effectRecord(effect, statContext(actor.uuid))] });
    flags.effectReceipt = receipt;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({
      img: item.img, eyebrow: "Gear light", tone: (op === "delete") ? "neutral" : "good",
      title: gearCardTitle({ actor: actor.name, item: item.name, op, row, state, light, reason }),
      subtitle: [
        wentOut.length ? `${wentOut.join(", ")} put out first — one light at a time` : null,
        (op === "delete") ? null : "until put out or a Long Rest · nothing is used up"
      ].filter(Boolean).join(" · ")
    }),
    flags: { [MODULE_ID]: flags }
  });
}

/* --- out by itself: the Long Rest, the item gone ---------------------------------------------------- */

// The resting client alone fires this hook, and it may write the actor it rested.
listen("dnd5e.restCompleted", "gear-lights", (actor, result, config) => {
  try {
    if ( !(actor instanceof Actor) || !canApplyTo(actor) ) return;
    if ( (result?.type ?? config?.type) !== "long" ) return;
    void putOutAll(actor, "Long Rest");
  } catch(err) {
    console.error(`${TITLE} | Could not put the gear lights out at the Long Rest — delete them by hand.`, err);
  }
});

// An item that leaves the sheet (dropped, handed over, stashed) takes its light with it; one client writes.
listen("deleteItem", "gear-lights", item => {
  try {
    const actor = item?.actor;
    if ( !actor || !drivesMomentFor(actor.uuid) ) return;
    const lit = gearEffects(actor).filter(e => readFlag(e, GEAR_FLAG)?.itemId === item.id);
    if ( lit.length ) void deleteQuietly(actor, lit.map(e => e.id))
      .catch(err => console.warn(`${TITLE} | Could not put out the light of a removed item — delete it by hand.`, err));
  } catch(err) {
    console.warn(`${TITLE} | Could not put out the light of a removed item — delete it by hand.`, err);
  }
});

/** Every gear light on the actor out, one card per light. */
async function putOutAll(actor, reason) {
  const lit = gearEffects(actor);
  if ( !lit.length ) return;
  const said = lit.map(e => readFlag(e, GEAR_FLAG));
  await deleteQuietly(actor, lit.map(e => e.id));
  for ( const f of said ) {
    const row = GEAR_LIGHTS[f?.key] ? { key: f.key, ...GEAR_LIGHTS[f.key] } : null;
    if ( !row ) continue;
    const item = actor.items.get(f.itemId) ?? { id: f.itemId, name: f.itemName ?? f.key, img: null };
    await postCard(actor, item, row, { op: "delete", state: f.state ?? GEAR_LIT, reason });
  }
}
