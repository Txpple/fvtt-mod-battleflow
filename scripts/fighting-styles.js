/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE FIGHTING STYLES — a Fighting Style feat whose
 * rule turns on what its owner holds or wears, or on how the attack is made (decide/registry.js
 * FIGHTING_STYLES; the arithmetic decide/fighting-styles.js). The user, 2026-09-26, ruling off
 * prototypes/fighting-styles.html: "one table"; "we need to gate it on what pc is holding - not
 * overall rule, we want flows to work, not editing items"; "the feats that do weapon mods should
 * be effects on the player ... so itd show in the detailed buff bar"; option B for the notice.
 *
 * THE FACE: one ActiveEffect per listed style on the character — the style's name, the feat's
 * icon, origin the feat — kept by the flow elect for that actor from the EQUIPPED boxes: live, or
 * disabled with the reason ("a second weapon held (Dagger)"). The effect view's panel lists it
 * with that line (Passive when live, Unavailable when off). Defense's face carries the AC change
 * the pack's own effect carries (N1: read, never stored), so the AC is right the moment the armor
 * comes off. Where the pack ships an UNGATED effect on the feat (Defense, Dueling — the notes say
 * "disable it when ..."), the machine switches that one off with a flag and the face carries the
 * rule; unlisting the style gives it back.
 *
 * THE ROLL: `dnd5e.preRollDamageV2` — the weapon attack's own mode (dnd5e's attackModes: one or
 * two hands, off-hand, thrown) decides whether the roll fits: Thrown's +2 and Dueling's +2 (read off
 * the pack's effect) join the parts, Two-Weapon Fighting adds back the modifier dnd5e drops on the
 * off-hand, and Great Weapon Fighting floors every damage die at 3 — the `min3` modifier, added on
 * `dnd5e.postDamageRollConfiguration` once the dialog has built the rolls (a crit's doubled dice
 * and every die of the attack's damage included — "a damage die"). The message is born with the
 * `fightingStyle` record; at `preCreateChatMessage` the floor's raised faces are counted off the
 * evaluated dice, and a floor that raised nothing leaves no trace.
 *
 * THE NOTICE (option B): one line on the damage card per style that changed the roll, and every
 * client floats "+3 Great Weapon Fighting" over the target once. The record is the stats reader's
 * (ARCHITECTURE §4): `gain` per style, per roll.
 */
import { MODULE_ID, TITLE, S, drivesMomentFor, canApplyTo, statContext } from "./core.js";
import { lower, featureNamed, resolveUuid } from "./lookup.js";
import { fightingStyleEntries, listedNames } from "./settings.js";
import { FIGHTING_STYLES } from "./decide/registry.js";
import { heldOf, faceState, rollFits, raisedOf, styleLine, floatText } from "./decide/fighting-styles.js";
import { targetsOf } from "./decide/card.js";
import { esc } from "./decide/present.js";
import { SURFACES } from "./surfaces.js";

const STYLE_FLAG = "fightingStyle";            // a damage message's record — and a face's own key
const TAKEN_FLAG = "fightingStyleTakenOver";   // the pack's own effect, switched off for the face
const FLOOR = "bfFightingStyleFloor";   // string keys: a config may be cloned between the hooks
const DONE = "bfFightingStyleDone";

/* --- reading the sheet ------------------------------------------------------------------------ */

/** Every item as the decision layer wants it. */
const itemFacts = actor => [...(actor?.items ?? [])].map(i => ({
  name: i.name, type: i.type, kind: i.system?.type?.value ?? null,
  equipped: i.system?.equipped === true, properties: [...(i.system?.properties ?? [])]
}));

/** The listed rows this actor holds — `[{ name, row, feature }]`. */
function heldRows(actor) {
  const listed = listedNames(fightingStyleEntries());
  const out = [];
  for ( const [name, row] of Object.entries(FIGHTING_STYLES) ) {
    if ( !listed.has(lower(name)) ) continue;
    const feature = featureNamed(actor, name);
    if ( feature ) out.push({ name, row, feature });
  }
  return out;
}

/** The pack's own effects on the feat that carry a change — the ones a `takesOver` row switches off. */
const packEffectsOf = feature => [...(feature?.effects ?? [])].filter(e => (e.changes ?? e.system?.changes ?? []).length);

/** A change the pack's own effect carries, by a key test — the number is the content's (N1). */
function packChange(feature, test) {
  for ( const effect of packEffectsOf(feature) ) {
    const change = (effect.changes ?? effect.system?.changes ?? []).find(c => test(String(c.key ?? "")));
    if ( change ) return change;
  }
  return null;
}
const damageBonusOf = feature => packChange(feature, k => /damage/i.test(k))?.value ?? null;
const acChangeOf = feature => packChange(feature, k => /attributes\.ac\./i.test(k));

/** Unarmed Fighting's two dice, as the feat's own attacks ship them — for the face's line. */
function unarmedDiceOf(feature) {
  const dice = [...(feature?.system?.activities ?? [])]
    .filter(a => (a.type === "attack") && (a.attack?.type?.classification === "unarmed"))
    .map(a => a.damage?.parts?.[0]?.denomination).filter(Boolean).map(Number).sort((a, b) => a - b);
  return dice.length ? { small: `d${dice[0]}`, large: `d${dice.at(-1)}` } : {};
}

/* --- THE FACE ----------------------------------------------------------------------------------- */

/** The face this row should wear on this actor — the effect's data, bar the ids. */
function desiredFace({ name, row, feature }, held) {
  const state = faceState(row.gate, held, row.gate === "unarmed" ? unarmedDiceOf(feature) : {});
  const change = row.ac === "effect" ? acChangeOf(feature) : null;
  return {
    name, img: feature.img, origin: feature.uuid, transfer: false, disabled: !state.live,
    changes: change ? [{ key: change.key, mode: change.mode, value: String(change.value), priority: change.priority ?? null }] : [],
    flags: { [MODULE_ID]: { [STYLE_FLAG]: { key: row.key, live: state.live, detail: state.detail } } }
  };
}

const faceOf = effect => effect.getFlag?.(MODULE_ID, STYLE_FLAG) ?? null;
const sameChanges = (a, b) => JSON.stringify((a ?? []).map(c => [c.key, Number(c.mode), String(c.value)]))
  === JSON.stringify((b ?? []).map(c => [c.key, Number(c.mode), String(c.value)]));

const syncing = new Map();

/** Keep this actor's faces — and the pack effects they take over — in step with its sheet. */
function scheduleSync(actor) {
  if ( !actor?.uuid || !drivesMomentFor(actor.uuid) || !canApplyTo(actor) ) return;
  clearTimeout(syncing.get(actor.uuid));
  syncing.set(actor.uuid, setTimeout(() => { syncing.delete(actor.uuid); void syncFaces(actor); }, 150));
}

async function syncFaces(actor) {
  try {
    const rows = heldRows(actor);
    const held = heldOf(itemFacts(actor));
    const faces = [...(actor.effects ?? [])].filter(e => faceOf(e));
    const creates = [], updates = [], deletes = [];
    for ( const found of rows ) {
      const want = desiredFace(found, held);
      const have = faces.find(e => faceOf(e).key === found.row.key);
      if ( !have ) { creates.push(want); continue; }
      const f = faceOf(have);
      if ( (have.disabled !== want.disabled) || (f.detail !== want.flags[MODULE_ID][STYLE_FLAG].detail)
        || (have.name !== want.name) || !sameChanges(have.changes, want.changes) ) {
        updates.push({ _id: have.id, name: want.name, disabled: want.disabled, changes: want.changes,
          [`flags.${MODULE_ID}.${STYLE_FLAG}`]: want.flags[MODULE_ID][STYLE_FLAG] });
      }
    }
    const keys = new Set(rows.map(r => r.row.key));
    for ( const e of faces ) if ( !keys.has(faceOf(e).key) ) deletes.push(e.id);
    if ( deletes.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes);
    if ( updates.length ) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
    if ( creates.length ) await actor.createEmbeddedDocuments("ActiveEffect", creates);
    await syncTakeovers(actor, rows);
  } catch(err) {
    console.error(`${TITLE} | The fighting styles on ${actor?.name} could not be kept in step — toggle their effects by hand.`, err);
  }
}

/** The pack's ungated effects: off while the face carries the rule, back on when it stops. */
async function syncTakeovers(actor, rows) {
  const running = new Map(rows.filter(r => r.row.takesOver).map(r => [r.feature.id, r]));
  for ( const feature of (actor.items ?? []) ) {
    if ( feature.type !== "feat" ) continue;
    const ours = running.has(feature.id);
    const writes = [];
    for ( const effect of packEffectsOf(feature) ) {
      const taken = effect.getFlag(MODULE_ID, TAKEN_FLAG) === true;
      if ( ours && (!taken || !effect.disabled) ) {
        writes.push({ _id: effect.id, disabled: true, [`flags.${MODULE_ID}.${TAKEN_FLAG}`]: true });
      } else if ( !ours && taken ) {
        writes.push({ _id: effect.id, disabled: false, [`flags.${MODULE_ID}.-=${TAKEN_FLAG}`]: null });
      }
    }
    if ( writes.length ) await feature.updateEmbeddedDocuments("ActiveEffect", writes);
  }
}

/** Every actor this client keeps: the world's, and the scene's unlinked tokens'. */
function syncAll() {
  for ( const actor of game.actors ?? [] ) scheduleSync(actor);
  for ( const token of canvas?.tokens?.placeables ?? [] ) if ( token.actor && !token.document.actorLink ) scheduleSync(token.actor);
}

Hooks.once("ready", () => { try { syncAll(); } catch(err) { console.warn(`${TITLE} | fighting styles: the first pass failed.`, err); } });
Hooks.on("canvasReady", () => {
  for ( const token of canvas?.tokens?.placeables ?? [] ) if ( token.actor && !token.document.actorLink ) scheduleSync(token.actor);
});
Hooks.on("createActor", actor => scheduleSync(actor));
for ( const hook of ["createItem", "updateItem", "deleteItem"] ) {
  Hooks.on(hook, item => { if ( item?.parent instanceof Actor ) scheduleSync(item.parent); });
}
// The list is the switch: a change re-reads every actor (an unlisted style's face goes, its pack effect comes back).
Hooks.on("updateSetting", setting => { if ( setting?.key === `${MODULE_ID}.${S.fightingStyleList}` ) syncAll(); });

/* --- THE ROLL ----------------------------------------------------------------------------------- */

Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  try {
    if ( !config || config[DONE] ) return;
    const activity = config.subject;
    const weapon = activity?.item;
    if ( (activity?.type !== "attack") || (weapon?.type !== "weapon") ) return;
    const attacker = activity.actor;
    const rows = heldRows(attacker);
    if ( !rows.length ) return;
    config[DONE] = true;
    const roll = config.rolls?.[0];
    const parts = Array.isArray(roll?.parts) ? roll.parts : null;
    const held = heldOf(itemFacts(attacker));
    const facts = {
      kind: weapon.system?.type?.value ?? null, properties: [...(weapon.system?.properties ?? [])],
      mode: config.attackMode ?? null, mod: Number(roll?.data?.mod ?? 0)
    };
    const resolve = f => { try { return Roll.replaceFormulaData(String(f), roll?.data ?? {}); } catch { return String(f); } };
    const styles = [];
    for ( const { name, row, feature } of rows ) {
      const face = faceState(row.gate, held);
      const fits = rollFits(row.gate, { ...facts, faceLive: face.live });
      if ( row.minimum && fits ) {
        config[FLOOR] = row.minimum;
        styles.push({ key: row.key, feature: name, gain: 0, pending: true });
        continue;
      }
      if ( !row.bonus ) continue;
      if ( !fits ) {
        // Dueling's quiet line — only where its owner might expect the +2: the face is live (one
        // weapon, one hand) but THIS swing took the Versatile weapon in two. Off at the equipment,
        // the panel already says why, and a line on every Greatsword swing would be noise (the
        // first smoke-styles run, 2026-09-26).
        if ( (row.gate === "oneHanded") && face.live && ["simpleM", "martialM"].includes(facts.kind) ) {
          styles.push({ key: row.key, feature: name, gain: 0, off: "two hands" });
        }
        continue;
      }
      const amount = row.bonus === "effect" ? damageBonusOf(feature) : row.bonus;
      const gain = Number(resolve(amount));
      if ( !parts || !amount || !Number.isFinite(gain) || (gain <= 0) ) continue;
      parts.push(String(amount));
      styles.push({ key: row.key, feature: name, gain, note: row.gate === "offhand" ? "on the off-hand" : null });
    }
    if ( !styles.length ) return;
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${STYLE_FLAG}`,
      { styles, gain: styles.reduce((s, e) => s + e.gain, 0), ...statContext(attacker.uuid) });
  } catch(err) {
    console.error(`${TITLE} | A fighting style could not be applied to this damage roll — add it by hand.`, err);
  }
});

// The floor rides the built rolls: every die of the attack's damage, a crit's doubled ones too.
Hooks.on("dnd5e.postDamageRollConfiguration", (rolls, config) => {
  try {
    const floor = config?.[FLOOR];
    if ( !floor ) return;
    const Die = foundry.dice.terms.Die;
    for ( const roll of (rolls ?? []) ) {
      let touched = false;
      for ( const term of (roll.terms ?? []) ) {
        if ( !(term instanceof Die) || term.modifiers.some(m => /^min\d+$/i.test(m)) ) continue;
        term.modifiers.push(`min${floor}`);
        touched = true;
      }
      if ( touched ) roll.resetFormula?.();
    }
  } catch(err) {
    console.error(`${TITLE} | Great Weapon Fighting's floor could not be set — count 1s and 2s as 3 by hand.`, err);
  }
});

// The floor's count, off the evaluated dice, before the card is born.
Hooks.on("preCreateChatMessage", doc => {
  try {
    const flag = doc.getFlag?.(MODULE_ID, STYLE_FLAG);
    if ( !flag?.styles?.some(s => s.pending) ) return;
    const rolls = (doc.rolls ?? []).map(r => (typeof r?.toJSON === "function") ? r.toJSON() : r);
    const styles = [];
    for ( const entry of flag.styles ) {
      if ( !entry.pending ) { styles.push(entry); continue; }
      const row = Object.values(FIGHTING_STYLES).find(r => r.key === entry.key);
      const { raised, gain } = raisedOf(rolls, row?.minimum ?? 3);
      if ( gain > 0 ) styles.push({ key: entry.key, feature: entry.feature, gain, raised });
    }
    const next = styles.length ? { ...flag, styles, gain: styles.reduce((s, e) => s + e.gain, 0) } : null;
    doc.updateSource({ [`flags.${MODULE_ID}.${next ? STYLE_FLAG : `-=${STYLE_FLAG}`}`]: next });
  } catch(err) {
    console.error(`${TITLE} | Great Weapon Fighting's count failed — the dice stand as rolled.`, err);
  }
});

/* --- THE NOTICE (option B) ---------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, STYLE_FLAG);
    if ( !flag?.styles?.length ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-fighting-style-line") ) return;
    for ( const entry of flag.styles ) {
      const div = document.createElement("div");
      div.className = "bf-fighting-style-line";
      const off = !entry.gain;
      div.style.cssText = `margin:0.25rem 0;font-size:var(--font-size-11,11px);${off ? "opacity:0.6;" : "opacity:0.9;color:rgb(232,190,50);"}`;
      div.innerHTML = off
        ? `<i class="fa-solid fa-shield-halved"></i> ${esc(entry.feature)} off — ${esc(entry.off ?? "")}`
        : `<i class="fa-solid fa-shield-halved"></i> ${esc(styleLine(entry))}`;
      content.appendChild(div);
    }
  } catch(err) {
    console.error(`${TITLE} | The fighting style's line failed to draw.`, err);
  }
});

/**
 * The floating number: every client, once, over the damage card's targets — the canvas's own
 * scrolling text, white, as Alert's swap floats (initiative-swap.js). Live cards only: a reload
 * replays nothing. Only a style that CHANGED the number floats.
 */
const floated = new Set();
Hooks.on("createChatMessage", message => {
  try {
    const flag = message.getFlag(MODULE_ID, STYLE_FLAG);
    const changed = (flag?.styles ?? []).filter(e => e.gain > 0);
    if ( !changed.length || floated.has(message.id) || !canvas?.interface?.createScrollingText ) return;
    floated.add(message.id);
    const tokens = targetsOf(message).map(t => resolveUuid(t.token)?.object).filter(t => t?.visible);
    changed.forEach((entry, i) => {
      for ( const token of tokens ) {
        setTimeout(() => canvas.interface.createScrollingText(token.center, floatText(entry), {
          anchor: CONST.TEXT_ANCHOR_POINTS.TOP, fill: "#ffffff", stroke: 0x000000, strokeThickness: 4,
          fontSize: 26, jitter: 0.25, duration: 3000
        }), i * 400);
      }
    });
  } catch(err) { console.warn(`${TITLE} | The fighting style's floating number could not draw.`, err); }
});
