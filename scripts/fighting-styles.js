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
import { MODULE_ID, TITLE, S, setting, drivesMomentFor, canApplyTo, canAnswerFor, isActiveGM, statContext, queueFlagWrite } from "./core.js";
import { lower, featureNamed, resolveUuid } from "./lookup.js";
import { fightingStyleEntries, listedNames } from "./settings.js";
import { FIGHTING_STYLES } from "./decide/registry.js";
import { heldOf, faceState, rollFits, raisedOf, styleLine, diceOf, chipsOf, blockDamages,
  typesInNames, typedFace, ignoredResistances, typeChoicesLeft } from "./decide/fighting-styles.js";
import { isCard, CARD } from "./decide/card.js";
import { bfCard, esc, holdBarHTML, popupKey, ruleLine } from "./decide/present.js";
import { SURFACES } from "./surfaces.js";
import { riseDice, driftChip } from "./dice-rise.js";
import { withTargets, resolveAttackMessage } from "./shared.js";
import { nearestFeet, tokenForUuid } from "./geometry.js";
import { openMomentPopup, momentButton, armDeadline, disarmDeadline, livePopups, shownMoments, scheduleBarSync,
  registerRelay } from "./ui.js";

const STYLE_FLAG = "fightingStyle";            // a damage message's record — and a face's own key
const TAKEN_FLAG = "fightingStyleTakenOver";   // the pack's own effect, switched off for the face
const FLOOR = "bfFightingStyleFloor";   // string keys: a config may be cloned between the hooks
const DONE = "bfFightingStyleDone";

/* --- reading the sheet ------------------------------------------------------------------------ */

/** Every item as the decision layer wants it. */
const itemFacts = actor => [...(actor?.items ?? [])].map(i => ({
  name: i.name, type: i.type, kind: i.system?.type?.value ?? null, base: i.system?.type?.baseItem ?? null,
  equipped: i.system?.equipped === true, properties: [...(i.system?.properties ?? [])]
}));

/** The damage types dnd5e knows — what a `typed` row may read off a feat's name. */
const damageTypeKeys = () => Object.keys(CONFIG.DND5E?.damageTypes ?? {});

/** The feat copies a `typed` row reads: every feat whose name starts with the row's ("Elemental Adept (Fire)"). */
const typedCopies = (actor, name) => [...(actor?.items ?? [])].filter(i => (i.type === "feat") && lower(i.name).startsWith(lower(name)));

/**
 * The listed rows this actor holds — `[{ name, row, feature, types }]`. `types` is the row's own, or
 * for a `typed` row what the copies' names say (group 1 of the PHB feats, 2026-09-26).
 */
function heldRows(actor) {
  const listed = listedNames(fightingStyleEntries());
  const out = [];
  for ( const [name, row] of Object.entries(FIGHTING_STYLES) ) {
    if ( !listed.has(lower(name)) ) continue;
    if ( row.typed ) {
      const copies = typedCopies(actor, name);
      if ( copies.length ) out.push({ name, row, feature: copies[0], types: typesInNames(copies.map(c => c.name), name, damageTypeKeys()) });
      continue;
    }
    const feature = featureNamed(actor, name);
    if ( feature ) out.push({ name, row, feature, types: [...(row.types ?? [])] });
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
function desiredFace({ name, row, feature, types }, held) {
  const state = row.typed ? typedFace(name, types) : faceState(row.gate, held, row.gate === "unarmed" ? unarmedDiceOf(feature) : {});
  const change = row.ac === "effect" ? acChangeOf(feature) : null;
  return {
    name, img: feature.img, origin: feature.uuid, transfer: false, disabled: !state.live,
    changes: change ? [{ key: change.key, mode: change.mode, value: String(change.value), priority: change.priority ?? null }] : [],
    flags: { [MODULE_ID]: { [STYLE_FLAG]: { key: row.key, live: state.live, word: state.word, detail: state.detail,
      ...(row.feat ? { feat: true } : {}) } } }
  };
}

const faceOf = effect => effect.getFlag?.(MODULE_ID, STYLE_FLAG) ?? null;
const sameChanges = (a, b) => JSON.stringify((a ?? []).map(c => [c.key, Number(c.mode), String(c.value)]))
  === JSON.stringify((b ?? []).map(c => [c.key, Number(c.mode), String(c.value)]));

const syncing = new Map();

/** Core floats "+Defense" / "-Defense" on any effect with changes that turns on or off; the face
 * floats its own words (the user, 2026-09-26: "which should be removed / suppressed"). A FRESH
 * object per write: Foundry writes into the operation, and a shared frozen one threw on every
 * sync (the walk, 2026-09-26: faces stopped following the Equipped box). */
const quiet = () => ({ animate: false });

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
      if ( (have.disabled !== want.disabled) || (f.detail !== want.flags[MODULE_ID][STYLE_FLAG].detail) || (f.word !== want.flags[MODULE_ID][STYLE_FLAG].word)
        || (have.name !== want.name) || !sameChanges(have.changes, want.changes) ) {
        updates.push({ _id: have.id, name: want.name, disabled: want.disabled, changes: want.changes,
          [`flags.${MODULE_ID}.${STYLE_FLAG}`]: want.flags[MODULE_ID][STYLE_FLAG] });
      }
    }
    const keys = new Set(rows.map(r => r.row.key));
    for ( const e of faces ) if ( !keys.has(faceOf(e).key) ) deletes.push(e.id);
    if ( deletes.length ) await actor.deleteEmbeddedDocuments("ActiveEffect", deletes, quiet());
    if ( updates.length ) await actor.updateEmbeddedDocuments("ActiveEffect", updates, quiet());
    if ( creates.length ) await actor.createEmbeddedDocuments("ActiveEffect", creates, quiet());
    await syncTakeovers(actor, rows);
  } catch(err) {
    console.error(`${TITLE} | The fighting styles on ${actor?.name} could not be kept in step — toggle their effects by hand.`, err);
  }
}

/** The pack's ungated effects: off while the face carries the rule, back on when it stops. */
async function syncTakeovers(actor, rows) {
  // by NAME, every copy: a sheet carrying the feat twice (a lent copy beside its own) would keep
  // the second copy's pack effect running and cut twice (the feats slice's first run, 2026-09-26)
  const running = new Set(rows.filter(r => r.row.takesOver).map(r => lower(r.name)));
  for ( const feature of (actor.items ?? []) ) {
    if ( feature.type !== "feat" ) continue;
    const ours = running.has(lower(feature.name));
    const writes = [];
    for ( const effect of packEffectsOf(feature) ) {
      const taken = effect.getFlag(MODULE_ID, TAKEN_FLAG) === true;
      if ( ours && (!taken || !effect.disabled) ) {
        writes.push({ _id: effect.id, disabled: true, [`flags.${MODULE_ID}.${TAKEN_FLAG}`]: true });
      } else if ( !ours && taken ) {
        writes.push({ _id: effect.id, disabled: false, [`flags.${MODULE_ID}.-=${TAKEN_FLAG}`]: null });
      }
    }
    if ( writes.length ) await feature.updateEmbeddedDocuments("ActiveEffect", writes, quiet());
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

/** Is it this attacker's own turn? True unless a running combat holds it and the turn is another's. */
function ownTurnOf(actor) {
  const same = other => !!other && !!actor && ((other === actor) || (other.uuid === actor.uuid));
  const running = [...(game.combats ?? [])].filter(c => c.started && c.combatants.some(cb => same(cb.actor)));
  return !running.length || running.some(c => same(c.combatant?.actor));
}

Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  try {
    if ( !config || config[DONE] ) return;
    const activity = config.subject;
    if ( activity?.item?.type === "spell" ) { spellFloor(config, activity, message); return; }
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
      kind: weapon.system?.type?.value ?? null, base: weapon.system?.type?.baseItem ?? null, properties: [...(weapon.system?.properties ?? [])],
      mode: config.attackMode ?? null, mod: Number(roll?.data?.mod ?? 0), ownTurn: ownTurnOf(attacker)
    };
    const resolve = f => { try { return Roll.replaceFormulaData(String(f), roll?.data ?? {}); } catch { return String(f); } };
    const styles = [];
    let offhandAdded = false;   // Two-Weapon Fighting and Crossbow Expert give back ONE modifier between them
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
        // Great Weapon Master's quiet line: a Heavy weapon swung off the owner's turn (an
        // Opportunity Attack) — "as part of the Attack action on your turn".
        if ( (row.gate === "heavy") && facts.properties.includes("hvy") && !facts.ownTurn ) {
          styles.push({ key: row.key, feature: name, gain: 0, off: "not your turn" });
        }
        continue;
      }
      const offhand = (row.gate === "offhand") || (row.gate === "offhandCrossbow");
      if ( offhand && offhandAdded ) continue;
      const amount = row.bonus === "effect" ? damageBonusOf(feature) : row.bonus;
      const gain = Number(resolve(amount));
      if ( !parts || !amount || !Number.isFinite(gain) || (gain <= 0) ) continue;
      parts.push(String(amount));
      if ( offhand ) offhandAdded = true;
      styles.push({ key: row.key, feature: name, gain, note: offhand ? "on the off-hand" : null });
    }
    if ( !styles.length ) return;
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${STYLE_FLAG}`,
      { styles, gain: styles.reduce((s, e) => s + e.gain, 0), ...statContext(attacker.uuid) });
  } catch(err) {
    console.error(`${TITLE} | A fighting style could not be applied to this damage roll — add it by hand.`, err);
  }
});

/**
 * A SPELL's floor (Elemental Adept: "when you roll damage for a spell you cast that deals damage of
 * that type, you can treat any 1 on a damage die as a 2"): the `spells` rows with a `minimum`, when
 * the spell's damage carries one of the row's types. Only that type's dice are floored (the roll
 * per part keeps its own type), a crit's doubled dice included.
 */
function spellFloor(config, activity, message) {
  const caster = activity.actor;
  const rows = heldRows(caster).filter(r => r.row.spells && r.row.minimum && r.types.length);
  if ( !rows.length ) return;
  const typesOf = r => r?.options?.types ?? (r?.options?.type ? [r.options.type] : []);
  const dealt = new Set((config.rolls ?? []).flatMap(typesOf));
  for ( const { name, row, types } of rows ) {
    const hit = types.filter(t => dealt.has(t));
    if ( !hit.length ) continue;
    config[DONE] = true;
    config[FLOOR] = { minimum: row.minimum, types: hit };
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${STYLE_FLAG}`,
      { styles: [{ key: row.key, feature: name, gain: 0, pending: true }], gain: 0, ...statContext(caster.uuid) });
    return;
  }
}

// The floor rides the built rolls: every die of the attack's damage, a crit's doubled ones too; a
// typed floor (a spell's) only the dice of its types.
Hooks.on("dnd5e.postDamageRollConfiguration", (rolls, config) => {
  try {
    const set = config?.[FLOOR];
    if ( !set ) return;
    const floor = (typeof set === "object") ? set.minimum : set;
    const only = (typeof set === "object") ? new Set(set.types ?? []) : null;
    const Die = foundry.dice.terms.Die;
    for ( const roll of (rolls ?? []) ) {
      if ( only && !(roll.options?.types ?? [roll.options?.type]).some(t => only.has(t)) ) continue;
      let touched = false;
      for ( const term of (roll.terms ?? []) ) {
        if ( !(term instanceof Die) || term.modifiers.some(m => /^min\d+$/i.test(m)) ) continue;
        term.modifiers.push(`min${floor}`);
        touched = true;
      }
      if ( touched ) roll.resetFormula?.();
    }
  } catch(err) {
    console.error(`${TITLE} | A damage floor (Great Weapon Fighting, Elemental Adept) could not be set — count the low dice by hand.`, err);
  }
});

// The floor's count and the dice the card and the canvas show, off the evaluated dice, before the
// card is born.
Hooks.on("preCreateChatMessage", doc => {
  try {
    const flag = doc.getFlag?.(MODULE_ID, STYLE_FLAG);
    if ( !flag?.styles?.length ) return;
    const rolls = (doc.rolls ?? []).map(r => (typeof r?.toJSON === "function") ? r.toJSON() : r);
    const styles = [];
    let floor = null;
    for ( const entry of flag.styles ) {
      if ( !entry.pending ) { styles.push(entry); continue; }
      floor = Object.values(FIGHTING_STYLES).find(r => r.key === entry.key)?.minimum ?? 3;
      const { raised, gain } = raisedOf(rolls, floor);
      if ( gain > 0 ) styles.push({ key: entry.key, feature: entry.feature, gain, raised });
    }
    const changed = styles.some(e => e.gain > 0);
    const next = styles.length
      ? { ...flag, styles, gain: styles.reduce((sum, e) => sum + e.gain, 0), ...(changed ? { dice: diceOf(rolls, floor) } : {}) }
      : null;
    doc.updateSource({ [`flags.${MODULE_ID}.${next ? STYLE_FLAG : `-=${STYLE_FLAG}`}`]: next });
  } catch(err) {
    console.error(`${TITLE} | Great Weapon Fighting's count failed — the dice stand as rolled.`, err);
  }
});

/**
 * The face's float: core's "+(…)" / "−(…)" with the panel's title in it — "+(Fighting Style:
 * Defense)" ("again, match the buff name") — drawn the way core draws every other effect's toggle (user, 2026-09-26: "the toggle should be the standard +/- every other effect
 * uses") — here because core floats only an effect with changes (Defense's AC), never Great Weapon
 * Fighting or Dueling; core's own is quieted on the face writes so Defense floats once. Every
 * client, on an update that turned the face on or off; a create floats nothing.
 */
Hooks.on("updateActiveEffect", (effect, changes) => {
  try {
    const actor = effect.parent;
    if ( !faceOf(effect) || !(actor instanceof Actor) || !("disabled" in changes) || !canvas?.interface?.createScrollingText ) return;
    const enabled = !effect.disabled;
    for ( const token of actor.getActiveTokens(true) ) {
      if ( !token.visible || token.document.isSecret ) continue;
      const title = faceOf(effect).feat ? effect.name : `Fighting Style: ${effect.name}`;
      canvas.interface.createScrollingText(token.center, `${enabled ? "+" : "−"}(${title})`, {
        anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
        direction: enabled ? CONST.TEXT_ANCHOR_POINTS.TOP : CONST.TEXT_ANCHOR_POINTS.BOTTOM,
        distance: 2 * token.h, fontSize: 28, stroke: 0x000000, strokeThickness: 4, jitter: 0.25
      });
    }
  } catch(err) { console.warn(`${TITLE} | The fighting style's face float could not draw.`, err); }
});

/* --- THE BLOCK (Heavy Armor Master) ------------------------------------------------------------ *
 * The PHB feats slice (user, 2026-09-26: "heavy armor master should have that blocking damage like
 * stones endurance / protectin does"). The pack ships the reduction as an UNGATED `traits.dm` effect
 * ("Disable it when you are not wearing Heavy Armor") that also cut a falling rock and a save's
 * damage; the row takes it over, and the face's gate (Heavy armor equipped) is the rule's "while
 * you're wearing Heavy armor".
 *
 * THE SEAM is `dnd5e.preCalculateDamage` — every application runs it, the module's applier and the
 * card's own buttons alike, before the system's resistances (the rule's order: resistance "after all
 * other modifiers"). The damage must come off an ATTACK's damage card ("when you're hit by an
 * attack"): a save's, an area's, a rider's or a bare number (the token bar) is never cut. What was
 * cut rides the options object into `dnd5e.preApplyDamage`, and from there the actor's own update,
 * so every client sees one "−3" pop over the armored creature — Stone's Endurance's pop, no roll
 * (RULINGS, the dice that rise). The module's receipt row says it too (auto-apply.js reads the
 * calculation's `bfBlock`).
 * ------------------------------------------------------------------------------------------- */

const BLOCK = "bfArmorBlock";          // on the damage options and the calculation, client-local
const BLOCK_FLAG = "armorBlock";       // on the actor's own damage update — the pop, every client

/** An attack's damage card: a damage roll whose activity is an attack, or that answers one. */
function isAttackDamage(message) {
  if ( !message || !isCard(message, CARD.damage) ) return false;
  if ( message.getAssociatedActivity?.()?.type === "attack" ) return true;
  try { return !!resolveAttackMessage(message); } catch { return false; }
}

Hooks.on("dnd5e.preCalculateDamage", (actor, damages, options) => {
  try {
    if ( !(actor instanceof Actor) || !Array.isArray(damages) || (options?.ignore === true) ) return;
    const rows = heldRows(actor).filter(r => r.row.block);
    if ( !rows.length || !isAttackDamage(options?.originatingMessage) ) return;
    const held = heldOf(itemFacts(actor));
    for ( const { name, row } of rows ) {
      if ( !faceState(row.gate, held).live ) continue;
      const amount = Number(Roll.replaceFormulaData(String(row.block), actor.getRollData(), { missing: "0" }));
      const { values, cut } = blockDamages(damages, row.types, amount);
      if ( !cut ) continue;
      values.forEach((v, i) => { damages[i].value = v; });
      const block = { feature: name, amount: cut };
      damages[BLOCK] = block;
      if ( options ) options[BLOCK] = block;
      return;
    }
  } catch(err) {
    console.error(`${TITLE} | Heavy Armor Master's reduction could not be taken — reduce by hand.`, err);
  }
});

/* --- THE IGNORED RESISTANCE (Elemental Adept, Poisoner) ----------------------------------------- *
 * Group 1 of the PHB feats (2026-09-26, RULINGS *The PHB feats — groups 1–3*): "Spells you cast ignore Resistance to damage of
 * the chosen type"; "When you make a damage roll that deals Poison damage, it ignores Resistance to
 * Poison damage". The rows are the ATTACKER's, so the seam reads the damage card's own actor
 * (`options.originatingMessage`) and hands dnd5e its own switch — `options.ignore.resistance`, a Set
 * of types, which calculateDamage reads after this hook. A copy, never the caller's Set: the damage
 * tray keeps its options between renders. What was ignored against a target that resists rides the
 * calculation (`bfIgnored`) to the receipt row, as the block does.
 * ------------------------------------------------------------------------------------------- */

const IGNORED = "bfIgnored";

Hooks.on("dnd5e.preCalculateDamage", (actor, damages, options) => {
  try {
    if ( !(actor instanceof Actor) || !Array.isArray(damages) || !options || (options.ignore === true) ) return;
    const message = options.originatingMessage;
    if ( !message || !isCard(message, CARD.damage) ) return;
    const source = message.getAssociatedActor?.();
    if ( !(source instanceof Actor) || (source.uuid === actor.uuid) ) return;
    const rows = heldRows(source).filter(r => (r.row.ignores === "resistance") && r.types.length);
    if ( !rows.length ) return;
    const spell = message.getAssociatedItem?.()?.type === "spell";
    const dealt = new Set(damages.map(d => d?.type).filter(Boolean));
    const said = [];
    for ( const { name, row, types } of rows ) {
      if ( row.spells && !spell ) continue;
      const hit = types.filter(t => dealt.has(t));
      if ( !hit.length ) continue;
      const ignore = (options.ignore && (typeof options.ignore === "object")) ? { ...options.ignore } : {};
      ignore.resistance = new Set([...(ignore.resistance ?? []), ...hit]);
      options.ignore = ignore;
      const resisted = ignoredResistances(damages, hit, actor.system?.traits?.dr?.value ?? []);
      if ( resisted.length ) said.push({ feature: name, types: resisted });
    }
    if ( said.length ) damages[IGNORED] = said;
  } catch(err) {
    console.error(`${TITLE} | A feat's ignored Resistance (Elemental Adept, Poisoner) could not be set — apply it by hand.`, err);
  }
});

// the block rides the damage's own update: one write, and every client pops it
Hooks.on("dnd5e.preApplyDamage", (_actor, _amount, updates, options) => {
  const block = options?.[BLOCK];
  if ( !block?.amount || !updates ) return;
  updates[`flags.${MODULE_ID}.${BLOCK_FLAG}`] = { ...block, at: Date.now() };
});

const popped = new Set();
Hooks.on("updateActor", (actor, changes) => {
  try {
    // the update carries only what CHANGED — a second block of the same amount sends `at` alone
    // (the walk, 2026-09-26: "it did it once or so thats it"); the whole record is the actor's
    if ( !changes?.flags?.[MODULE_ID]?.[BLOCK_FLAG] ) return;
    const block = actor.getFlag?.(MODULE_ID, BLOCK_FLAG);
    if ( !block?.amount || !block.at || ((Date.now() - block.at) > 10_000) ) return;
    const key = `${actor.uuid}|${block.at}`;
    if ( popped.has(key) ) return;
    popped.add(key);
    Hooks.callAll("battleflow.armorBlock", { actorUuid: actor.uuid, ...block });
    for ( const token of actor.getActiveTokens?.(true) ?? [] ) driftChip(token, token, `−${block.amount}`);
  } catch(err) { console.warn(`${TITLE} | Heavy Armor Master's block could not draw.`, err); }
});

/* --- THE NOTICE (L4 + F7) ------------------------------------------------------------------------ *
 * Ruled 2026-09-26 off the Artifact "GWF Notice Options" (the user: "the player needs something fun
 * or cool when they see it doing extra damage on the canvas, like they appreciate takig the feat,
 * but it should be unobtrusive"; "it cant require clicks"). decide/fighting-styles.js chipsOf. */

const CHIP_CSS_ID = "bf-style-chips-css";
/** The chips' look, once per client: the card's own ink, the turned die's edge gold on the dark
 * theme and bronze on the parchment (Foundry sets color-scheme per theme; light-dark() reads it). */
function ensureChipCss() {
  if ( document.getElementById(CHIP_CSS_ID) ) return;
  const style = document.createElement("style");
  style.id = CHIP_CSS_ID;
  style.textContent = `
    .bf-fighting-style-line{display:flex;flex-wrap:wrap;align-items:center;gap:0.35rem;margin:0.3rem 0;font-size:var(--font-size-11,11px);opacity:0.9}
    .bf-fighting-style-line .bf-chips{display:inline-flex;flex-wrap:wrap;gap:0.25rem;align-items:center}
    .bf-fighting-style-line .bf-chip{position:relative;display:inline-grid;place-items:center;min-width:1.55rem;height:1.55rem;padding:0 0.2rem;border-radius:4px;border:1px solid currentColor;font-weight:bold;font-size:var(--font-size-12,12px)}
    .bf-fighting-style-line .bf-chip.up{border:2px solid light-dark(#9f7a1e,#e3ce9e);box-shadow:0 0 5px light-dark(rgba(159,122,30,.35),rgba(227,206,158,.45))}
    .bf-fighting-style-line .bf-chip b{grid-area:1/1}
    .bf-fighting-style-line .bf-chip em{position:absolute;top:-0.45rem;right:-0.35rem;font-size:9px;font-style:normal;opacity:0.55;text-decoration:line-through}
    .bf-fighting-style-line .bf-gain{font-weight:bold;opacity:0.85}
    .bf-fighting-style-line .bf-chip .was{opacity:0}
    @media (prefers-reduced-motion:no-preference){
      .bf-fighting-style-line.fresh .bf-chip .was{animation:bf-was 0.9s ease-in forwards}
      .bf-fighting-style-line.fresh .bf-chip .now{animation:bf-now 0.9s ease-out forwards}
      .bf-fighting-style-line.fresh .bf-chip.flat{animation:bf-pop 0.9s ease-out}
    }
    @keyframes bf-was{0%,35%{opacity:1;transform:rotateX(0)}55%,100%{opacity:0;transform:rotateX(90deg)}}
    @keyframes bf-now{0%,50%{opacity:0;transform:rotateX(-90deg)}75%,100%{opacity:1;transform:rotateX(0)}}
    @keyframes bf-pop{0%,40%{transform:scale(0.6);opacity:0}70%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}`;
  document.head.appendChild(style);
}

/** A chip, as the card draws it: a turned die carries the face it showed, ghosted in its corner. */
function chipHTML(c) {
  const cls = `bf-chip${c.up ? " up" : ""}${c.flat ? " flat" : ""}`;
  const tip = c.faces ? ` data-tooltip="d${c.faces}${c.was ? ` — rolled ${esc(c.was)}, counts ${esc(c.label)}` : ""}"` : "";
  return c.was
    ? `<span class="${cls}"${tip}><em>${esc(c.was)}</em><b class="was">${esc(c.was)}</b><b class="now">${esc(c.label)}</b></span>`
    : `<span class="${cls}"${tip}><b>${esc(c.label)}</b></span>`;
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, STYLE_FLAG);
    if ( !flag?.styles?.length ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-fighting-style-line") ) return;
    ensureChipCss();
    // the turn-over plays once, on a card just born; a reload or a scroll back shows it at rest
    const fresh = (Date.now() - (message.timestamp ?? 0)) < 5000;
    for ( const entry of flag.styles ) {
      const div = document.createElement("div");
      div.className = `bf-fighting-style-line${fresh ? " fresh" : ""}`;
      if ( !entry.gain ) {
        div.dataset.bfStyleLine = `${entry.feature} off — ${entry.off ?? ""}`;
        div.style.opacity = "0.6";
        div.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${esc(entry.feature)} off — ${esc(entry.off ?? "")}`;
      } else {
        const { chips, after } = chipsOf(entry, flag.dice ?? []);
        div.dataset.bfStyleLine = styleLine(entry);
        div.setAttribute("aria-label", styleLine(entry));
        div.innerHTML = `<i class="fa-solid fa-shield-halved"></i> <span>${esc(entry.feature)}</span>`
          + `<span class="bf-chips">${chips.map(chipHTML).join("")}</span>`
          + (after ? `<span class="bf-gain">${esc(after)}</span>` : "");
      }
      content.appendChild(div);
    }
  } catch(err) {
    console.error(`${TITLE} | The fighting style's line failed to draw.`, err);
  }
});

/**
 * F7 — THE DICE RISE OFF THE FIGHTER: every client, once, over the ATTACKER's own token (never the
 * target's — its damage number stands alone): the chips pop up, a turned die flips from its face to
 * what it counts with a gold flash, a flat bonus flashes in, and they rise and fade, about a second
 * and a half. Drawn on the canvas interface like core's scrolling text, and off with core's
 * scrollingStatusText setting like it. Live cards only: a reload replays nothing.
 */
// the drawing is the shared renderer's (dice-rise.js), the fighting styles its first customer

const floated = new Set();
Hooks.on("createChatMessage", message => {
  try {
    const flag = message.getFlag(MODULE_ID, STYLE_FLAG);
    // every style that changed the roll - the floor AND the flat +2: the player's check that the
    // style fired (the user, 2026-09-26: "it was kinda handy for FS so someone can see if they used
    // thrown weapon, duelist, etc properly"; "let everyone see") - RULINGS, the dice that rise
    const changed = (flag?.styles ?? []).filter(e => e.gain > 0);
    if ( !changed.length || floated.has(message.id) ) return;
    floated.add(message.id);
    const token = (message.speaker?.token && canvas?.tokens?.get(message.speaker.token))
      || resolveUuid(flag.sourceUuid)?.getActiveTokens?.()?.[0] || null;
    changed.forEach((entry, i) => {
      const { chips } = chipsOf(entry, flag.dice ?? []);
      Hooks.callAll("battleflow.styleDice", { messageId: message.id, key: entry.key, chips });
      setTimeout(() => riseDice(token, chips), i * 700);
    });
  } catch(err) { console.warn(`${TITLE} | The fighting style's dice could not draw.`, err); }
});

/* --- THE GRAPPLE'S TURN-START DAMAGE (Unarmed Fighting, U1) ------------------------------------ *
 * "At the start of each of your turns, you can deal 1d4 Bludgeoning damage to one creature Grappled
 * by you." Ruled U1 off the prototype (2026-09-26): the rule says "can", so it asks — a card and a
 * popup to the owner, Deal it / Skip, the grappled creature picked when there are two — and the
 * clock deals it, since there is rarely a reason to hold back (to the one creature KNOWN to be held
 * by this one; with none certain the clock skips). "Grappled by you" is read off the Grappled
 * effect's own provenance (the module's source stamp, else its origin's actor); a Grappled whose
 * grappler cannot be read is offered when it stands within 5 feet, never dealt by the clock. The
 * damage is the feat's own "Grappled Damage" activity, used at the pick — the bare damage machine
 * (damage-casts.js) rolls and lands it like any other.
 * ------------------------------------------------------------------------------------------- */

const GRAPPLE_FLAG = "grappleDamage";
const grappleTimers = new Map();
const grappleAsked = new Set();

/** Who put this Grappled on its bearer — an actor uuid, or null when the effect does not say. */
function grapplerOf(effect) {
  const stamped = effect.getFlag?.(MODULE_ID, "sourceUuid");
  if ( stamped ) return stamped;
  const origin = effect.origin ? resolveUuid(effect.origin) : null;
  return (origin instanceof Actor) ? origin.uuid : (origin?.actor?.uuid ?? null);
}

/** The creatures this one grapples on the scene — `[{ uuid, tokenUuid, name, certain }]`. */
function grappledBy(actor, token) {
  const out = [];
  for ( const other of (canvas.tokens?.placeables ?? []) ) {
    const a = other.actor;
    if ( !a || (a.uuid === actor.uuid) || !a.statuses?.has?.("grappled") ) continue;
    const effects = [...(a.effects ?? [])].filter(e => e.active && e.statuses?.has?.("grappled"));
    const by = effects.map(grapplerOf);
    const certain = by.includes(actor.uuid);
    const unknown = !certain && by.some(x => !x) && token && ((nearestFeet(token, other) ?? Infinity) <= 5);
    if ( certain || unknown ) out.push({ uuid: a.uuid, tokenUuid: other.document.uuid, name: other.document.name ?? a.name, certain });
  }
  return out;
}

/** The feat's own grapple-damage activity: its bare damage activity. */
const grappleActivityOf = feature => [...(feature?.system?.activities ?? [])].find(a => a.type === "damage") ?? null;

Hooks.on("updateCombat", (combat, changed) => {
  try {
    if ( !combat?.started || (!("turn" in changed) && !("round" in changed)) ) return;
    const combatant = combat.combatant;
    const actor = combatant?.actor;
    if ( !actor || !drivesMomentFor(actor.uuid) ) return;
    if ( !listedNames(fightingStyleEntries()).has("unarmed fighting") ) return;
    const feature = featureNamed(actor, "Unarmed Fighting");
    const activity = grappleActivityOf(feature);
    if ( !activity ) return;
    const turnKey = `${combat.id}:${combat.round}:${combat.turn}`;
    if ( grappleAsked.has(turnKey) ) return;
    grappleAsked.add(turnKey);
    const token = combatant.token?.object ?? tokenForUuid(actor.uuid);
    const candidates = grappledBy(actor, token);
    if ( !candidates.length ) return;
    void stampGrapple(actor, feature, activity, candidates);
  } catch(err) {
    console.error(`${TITLE} | Unarmed Fighting's grapple damage could not be offered — use "Grappled Damage" from the sheet.`, err);
  }
});

async function stampGrapple(actor, feature, activity, candidates) {
  const window = Math.max(0, Number(setting(S.holdTimer)) || 0);
  const certain = candidates.filter(c => c.certain);
  const flag = {
    status: "pending", row: "Unarmed Fighting", actorUuid: actor.uuid, actorName: actor.name,
    itemId: feature.id, activityId: activity.id, candidates,
    pick: (certain.length === 1) ? certain[0].uuid : (candidates.length === 1 ? candidates[0].uuid : null),
    clockDeals: certain.length === 1, answer: null, ...statContext(actor.uuid),
    ...(window ? { window, deadline: Date.now() + (window * 1000) } : {})
  };
  const message = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: bfCard({ img: feature.img, eyebrow: "Your turn — Unarmed Fighting", tone: "pending",
      title: `${actor.name} may deal 1d4 to ${candidates.map(c => c.name).join(" or ")}`,
      subtitle: "a creature you are grappling" }),
    flags: { [MODULE_ID]: { [GRAPPLE_FLAG]: flag } }
  });
  if ( message ) armGrappleTimer(message);
}

/** The keeper: the card's author, or the GM when the author has gone. */
const keepsGrapple = message => message.isAuthor || (!message.author?.active && isActiveGM());

function armGrappleTimer(message) {
  const flag = message?.getFlag(MODULE_ID, GRAPPLE_FLAG);
  if ( (flag?.status !== "pending") || !flag.deadline || !keepsGrapple(message) ) return;
  armDeadline(grappleTimers, message.id, flag.deadline, async () => {
    const live = game.messages.get(message.id);
    const now = live?.getFlag(MODULE_ID, GRAPPLE_FLAG);
    if ( now?.status !== "pending" ) return;
    // U1: the clock deals it — to the one creature known to be held; otherwise it skips.
    if ( now.clockDeals && now.pick ) await dealGrapple(live, now.pick, { timedOut: true });
    else await recordGrapple(live, { answer: "skip", pick: null, timedOut: true });
  });
}

/** Deal it: the feat's own damage activity used at the pick, on this client; then the answer recorded. */
async function dealGrapple(message, pickUuid, { timedOut = false } = {}) {
  const flag = message.getFlag(MODULE_ID, GRAPPLE_FLAG);
  const actor = resolveUuid(flag?.actorUuid);
  const activity = actor?.items?.get(flag.itemId)?.system?.activities?.get(flag.activityId) ?? null;
  const pick = (flag?.candidates ?? []).find(c => c.uuid === pickUuid);
  const token = pick ? resolveUuid(pick.tokenUuid)?.object : null;
  if ( !activity || !token ) {
    ui.notifications.warn(`${TITLE}: could not find the grappled creature or "Grappled Damage" — use it from the sheet.`);
    return;
  }
  await withTargets([token], () => activity.use({ subsequentActions: false }, { configure: false }, {}));
  await recordGrapple(message, { answer: "deal", pick: pickUuid, timedOut });
}

/** Record an answer: the keeper writes it, anyone else sends it (the relay folds it). */
async function recordGrapple(message, { answer, pick, timedOut = false }) {
  if ( keepsGrapple(message) || message.isOwner ) {
    await queueFlagWrite(message, GRAPPLE_FLAG, current => foldGrapple(current, { answer, pick, timedOut }));
    return;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: resolveUuid(message.getFlag(MODULE_ID, GRAPPLE_FLAG)?.actorUuid) }),
    content: `<p>Unarmed Fighting — ${answer === "deal" ? "dealt" : "skipped"}</p>`, whisper: game.users.filter(u => u.isGM).map(u => u.id),
    flags: { [MODULE_ID]: { grappleDamageAnswer: { messageId: message.id, answer, pick } } }
  });
}

function foldGrapple(current, { answer, pick, timedOut = false }) {
  if ( current.status !== "pending" ) return false;
  Object.assign(current, { status: "resolved", answer, pick: pick ?? null, timedOut: !!timedOut, answeredAt: Date.now() });
}

registerRelay("grappleDamageAnswer", {
  flagKey: GRAPPLE_FLAG,
  targetOf: a => a.messageId,
  owns: (_flag, target) => keepsGrapple(target),
  fold: (current, a) => foldGrapple(current, { answer: a.answer, pick: a.pick ?? null }),
  cleanup: true
});

async function showGrapplePopup(message) {
  const flag = message.getFlag(MODULE_ID, GRAPPLE_FLAG);
  if ( flag?.status !== "pending" ) return;
  const actor = resolveUuid(flag.actorUuid);
  const feature = actor?.items?.get(flag.itemId);
  const radios = (flag.candidates.length > 1)
    ? flag.candidates.map(c => `<label style="display:block;margin:0.2rem 0;"><input type="radio" name="bf-grapple" value="${esc(c.uuid)}" ${c.uuid === flag.pick ? "checked" : ""}> ${esc(c.name)}</label>`).join("")
    : "";
  await openMomentPopup(message, GRAPPLE_FLAG, actor, {
    title: `Unarmed Fighting — ${actor?.name ?? ""}`, icon: "fa-solid fa-hand-fist",
    content: bfCard({ img: feature?.img ?? null, eyebrow: "Your turn — Unarmed Fighting", tone: "pending",
      title: `Deal 1d4 to ${flag.candidates.length === 1 ? `the ${flag.candidates[0].name}` : "a creature"} you're grappling?`,
      subtitle: "1d4 bludgeoning · the start of your turn",
      lines: [ruleLine(esc(FIGHTING_STYLES["Unarmed Fighting"].rule))] }) + radios + holdBarHTML(flag, "to answer"),
    buttons: [
      { action: "deal", label: "Deal it", default: true, callback: (_event, button) => {
        const picked = button?.form?.querySelector?.('input[name="bf-grapple"]:checked')?.value ?? flag.pick ?? flag.candidates[0]?.uuid;
        void dealGrapple(message, picked);
      } },
      { action: "skip", label: "Skip", callback: () => { void recordGrapple(message, { answer: "skip", pick: null }); } }
    ]
  });
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, GRAPPLE_FLAG);
    if ( !flag ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-grapple-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-grapple-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    const pickName = (flag.candidates ?? []).find(c => c.uuid === flag.pick)?.name ?? "";
    div.innerHTML = `<i class="fa-solid fa-hand-fist"></i> ` + esc((flag.status !== "pending")
      ? ((flag.answer === "deal") ? `Unarmed Fighting — 1d4 to ${pickName}${flag.timedOut ? " (timer)" : ""}` : `Unarmed Fighting — skipped${flag.timedOut ? " (timer)" : ""}`)
      : "Unarmed Fighting — waiting for the answer");
    if ( flag.status === "pending" ) {
      div.insertAdjacentHTML("beforeend", ` ${holdBarHTML(flag, "to answer")}`);
      if ( canAnswerFor(resolveUuid(flag.actorUuid)) ) {
        const shown = popupKey(message.id, GRAPPLE_FLAG);
        if ( !shownMoments.has(shown) ) { shownMoments.add(shown); void showGrapplePopup(message); }
        div.appendChild(momentButton("Answer", () => { void showGrapplePopup(message); }));
      }
      scheduleBarSync(div);
      armGrappleTimer(message);
    }
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | Unarmed Fighting's line could not render.`, err); }
});

// An answer anywhere closes the popup everywhere (law 4); the clock stands down with it.
Hooks.on("updateChatMessage", message => {
  const flag = message.getFlag(MODULE_ID, GRAPPLE_FLAG);
  if ( !flag ) return;
  if ( flag.status === "pending" ) { armGrappleTimer(message); return; }
  disarmDeadline(grappleTimers, message.id);
  const open = livePopups.get(popupKey(message.id, GRAPPLE_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});

Hooks.on("deleteChatMessage", message => { disarmDeadline(grappleTimers, message.id); });

/* --- THE TYPE PICK (Elemental Adept) ------------------------------------------------------------ *
 * The user, 2026-09-26, the PHB feats walk: "we have to think how to assist players with elemental
 * adept feat ... when they level up their player they will have the unautomated version of the
 * feat" — then "A is good". The pack's Elemental Adept carries no type (an Ability Score
 * Improvement and text), and the row reads the type off the NAME. So when a typeless copy LANDS on
 * a character (a level-up's advancement, a drag, a compendium drop — on the client that made it), a
 * card is posted to the owners and a popup asks: one button per type the row offers, less the types
 * the other copies already name. The answer renames the copy "Elemental Adept (Fire)"; the face and
 * every rule follow the name as before. "Later" leaves the card's Choose type… button; a copy
 * renamed by hand needs neither.
 * ------------------------------------------------------------------------------------------- */

const PICK_FLAG = "typePick";
const titleCase = t => String(t).charAt(0).toUpperCase() + String(t).slice(1);

/** The listed typed row a copy is, when its name is the row's own with no type — `{ name, row }` or null. */
function typelessRowOf(item) {
  if ( item?.type !== "feat" ) return null;
  const listed = listedNames(fightingStyleEntries());
  for ( const [name, row] of Object.entries(FIGHTING_STYLES) ) {
    if ( row.typed && row.choices?.length && listed.has(lower(name)) && (lower(item.name).trim() === lower(name)) ) return { name, row };
  }
  return null;
}

Hooks.on("createItem", (item, _options, userId) => {
  try {
    if ( userId !== game.user.id ) return;
    const actor = item.parent;
    const found = (actor instanceof Actor) ? typelessRowOf(item) : null;
    if ( !found ) return;
    void postTypePick(actor, item, found.name, found.row)
      .catch(err => console.error(`${TITLE} | ${found.name}'s type could not be asked — rename it "${found.name} (Fire)".`, err));
  } catch(err) { console.error(`${TITLE} | A typed feat's pick failed.`, err); }
});

async function postTypePick(actor, item, name, row) {
  const others = typedCopies(actor, name).filter(i => i.id !== item.id).map(i => i.name);
  const left = typeChoicesLeft(row.choices, typesInNames(others, name, damageTypeKeys()));
  if ( !left.length ) {
    ui.notifications.warn(`${actor.name} already has every ${name} type — this copy has none left to choose.`);
    return;
  }
  const owners = game.users.filter(u => actor.testUserPermission(u, "OWNER")).map(u => u.id);
  const message = await ChatMessage.implementation.create({
    speaker: ChatMessage.implementation.getSpeaker({ actor }), content: "", whisper: owners,
    flags: { [MODULE_ID]: { [PICK_FLAG]: { ...statContext(actor.uuid), row: name, itemUuid: item.uuid, left, chosen: null } } }
  });
  if ( message ) await askTypePick(message);
}

/** The popup: a button per type still open, and Later. */
async function askTypePick(message) {
  const flag = message.getFlag(MODULE_ID, PICK_FLAG);
  const row = FIGHTING_STYLES[flag?.row];
  if ( !row || flag.chosen ) return;
  // live only: the owner whose sheet the feat is on answers
  const actor = fromUuidSync(flag.sourceUuid ?? "");
  if ( !(actor instanceof Actor) || !actor.isOwner ) return;
  await openMomentPopup(message, PICK_FLAG, actor, {
    title: `${flag.row} — ${actor.name}`, icon: "fa-solid fa-fire", width: 460, gate: false,
    content: bfCard({
      // live only: the new feat on the sheet — its own icon, and the copy the answer renames
      img: fromUuidSync(flag.itemUuid ?? "")?.img ?? null,
      eyebrow: `${flag.row} — a new feat`, tone: "pending",
      title: "Choose your damage type",
      subtitle: "your spells ignore Resistance to it, and its 1s count as 2",
      lines: [ruleLine(row.rule)]
    }),
    buttons: [
      ...flag.left.map(t => ({ action: t, label: titleCase(t), callback: () => { void chooseType(message, t); } })),
      { action: "later", label: "Later" }
    ]
  });
}

async function chooseType(message, type) {
  try {
    const flag = message.getFlag(MODULE_ID, PICK_FLAG);
    if ( !flag || flag.chosen || !flag.left.includes(type) ) return;
    // live only: the copy on the sheet is what the answer renames — a gone copy has nothing to name
    const item = await fromUuid(flag.itemUuid ?? "");
    if ( !(item instanceof Item) ) { ui.notifications.warn(`${flag.row} is no longer on the sheet.`); return; }
    await item.update({ name: `${flag.row} (${titleCase(type)})` });
    if ( message.canUserModify?.(game.user, "update") ) await message.setFlag(MODULE_ID, PICK_FLAG, { ...flag, chosen: type });
  } catch(err) {
    console.error(`${TITLE} | ${type} could not be chosen — rename the feat by hand.`, err);
  }
}

// The card says it (R5): the choice while it waits — its button recalls the popup — and what was chosen.
Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  const f = message.getFlag(MODULE_ID, PICK_FLAG);
  const row = f ? FIGHTING_STYLES[f.row] : null;
  if ( !row ) return;
  const line = document.createElement("div");
  line.innerHTML = bfCard({
    eyebrow: `${f.row} — a new feat`, tone: f.chosen ? "good" : "pending",
    title: f.chosen ? `${titleCase(f.chosen)} chosen — “${f.row} (${titleCase(f.chosen)})”` : "Choose your damage type",
    subtitle: f.chosen ? "your spells ignore Resistance to it, and its 1s count as 2" : f.left.map(titleCase).join(" · ")
  });
  const content = html.querySelector(SURFACES.messageContent);
  content?.appendChild(line);
  if ( !f.chosen ) {
    // live only: the choice is the feat's owner's — another client sees the line, not the button
    const actor = fromUuidSync(f.sourceUuid ?? "");
    if ( actor?.isOwner ) content?.appendChild(momentButton("Choose type…", () => void askTypePick(message)));
  }
});

// A copy renamed by hand with its type settles the card too — the popup closes, the card says it.
Hooks.on("updateItem", (item, changes) => {
  try {
    if ( !("name" in changes) || !(item.parent instanceof Actor) ) return;
    for ( const message of game.messages.contents.slice(-50) ) {
      const f = message.getFlag(MODULE_ID, PICK_FLAG);
      if ( !f || f.chosen || (f.itemUuid !== item.uuid) ) continue;
      const [type] = typesInNames([item.name], f.row, damageTypeKeys());
      if ( !type ) continue;
      if ( message.canUserModify?.(game.user, "update") ) void message.setFlag(MODULE_ID, PICK_FLAG, { ...f, chosen: type }).catch(() => {});
      const open = livePopups.get(popupKey(message.id, PICK_FLAG));
      if ( open ) { try { void open.close(); } catch { /* gone */ } }
    }
  } catch(err) { console.warn(`${TITLE} | The type pick could not follow the rename.`, err); }
});

// A made choice closes the popup everywhere (law 4).
Hooks.on("updateChatMessage", message => {
  if ( !message.getFlag(MODULE_ID, PICK_FLAG)?.chosen ) return;
  const open = livePopups.get(popupKey(message.id, PICK_FLAG));
  if ( open ) { try { void open.close(); } catch { /* gone */ } }
});
