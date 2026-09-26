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
import { heldOf, faceState, rollFits, raisedOf, styleLine, diceOf, chipsOf, blockDamages } from "./decide/fighting-styles.js";
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
      mode: config.attackMode ?? null, mod: Number(roll?.data?.mod ?? 0), ownTurn: ownTurnOf(attacker)
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
        // Great Weapon Master's quiet line: a Heavy weapon swung off the owner's turn (an
        // Opportunity Attack) — "as part of the Attack action on your turn".
        if ( (row.gate === "heavy") && facts.properties.includes("hvy") && !facts.ownTurn ) {
          styles.push({ key: row.key, feature: name, gain: 0, off: "not your turn" });
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
