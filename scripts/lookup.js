/**
 * Battle Flow — SPINE (ARCHITECTURE.md §7): the shared sheet and document readers; nothing here
 * decides. ⚠ It owns no hook, flag or write, and imports only core.js and pure modules; keep it that way.
 * A table's row finds its item by dnd5e's identifier, then by its name (decide/registry.js `matchOf`).
 */

import { CARD, activityUuidOf, isCard } from "./decide/card.js";
import { EVASIONS, INTERRUPT_REDUCTIONS, INTERRUPT_ROLLS, SUPERIORITY_STAND_INS, answers, identifierOf, interruptEntries, matchOf } from "./decide/registry.js";
import { d20Faces, d20ModeOf } from "./decide/rescue-hit.js";
import { TITLE } from "./core.js";

export const lower = s => String(s ?? "").toLowerCase();

const sameName = (a, b) => lower(a) === lower(b);

/** `actor|row` said once per session: a row found by the name alone. */
const warnedNameOnly = new Set();

/**
 * Every item on this actor that answers the row: identifier matches first, a 2024 copy before a
 * 2014 one. A match by name alone is warned once, so the item's identifier gets fixed at the data.
 * @param {Actor|null|undefined} actor
 * @param {string} key  the row's name
 * @param {{ types?: string[]|null }} [options]  the item types the row means
 * @returns {Item[]}
 */
export function itemsNamed(actor, key, { types = null } = {}) {
  if ( !actor?.items || !key ) return [];
  const byIdentifier = [], byName = [];
  for ( const item of actor.items ) {
    const how = matchOf(key, item, types);
    if ( how === "identifier" ) byIdentifier.push(item);
    else if ( how === "name" ) byName.push(item);
  }
  if ( byName.length && !warnedNameOnly.has(`${actor.uuid}|${key}`) ) {
    warnedNameOnly.add(`${actor.uuid}|${key}`);
    console.warn(`${TITLE} | ${actor.name}: "${byName[0].name}" found by its name, not the identifier "${identifierOf(key)}".`);
  }
  const is2014 = item => (item.system?.source?.rules === "2014") ? 1 : 0;
  return [...byIdentifier, ...byName].sort((a, b) => is2014(a) - is2014(b));
}

/** The item on this actor that answers the row, or null. */
export const itemNamed = (actor, key, options) => itemsNamed(actor, key, options)[0] ?? null;

/**
 * The sheet in the table's words, for a decide/ function that compares names: each item as the row
 * name it answers (identifier first, then name), else its own name. "Heat Metal - Spellcasting"
 * reads as "Heat Metal" against a table keyed "Heat Metal".
 * @param {Iterable<Item>} items
 * @param {Iterable<string>} keys  the table's row names
 * @returns {string[]}
 */
export function namesAnswering(items, keys) {
  const byIdentifier = new Map(), byName = new Map();
  for ( const key of keys ) {
    const identifier = identifierOf(key);
    if ( !byIdentifier.has(identifier) ) byIdentifier.set(identifier, key);
    if ( !byName.has(lower(key)) ) byName.set(lower(key), key);
  }
  return [...(items ?? [])].map(item => byIdentifier.get(item?.system?.identifier)
    ?? byName.get(lower(item?.name)) ?? item?.name ?? "");
}

/** The damage types an attack deals, before its dice: its parts plus any weapon base damage taken. */
export function dealtTypesOf(activity) {
  const out = new Set();
  for ( const part of (activity?.damage?.parts ?? []) ) for ( const t of (part?.types ?? []) ) out.add(t);
  if ( (activity?.damage?.includeBase !== false) && (activity?.item?.type === "weapon") ) {
    for ( const t of (activity.item.system?.damage?.base?.types ?? []) ) out.add(t);
  }
  return [...out];
}

export const featureNamed = (actor, key) => itemNamed(actor, key, { types: ["feat"] });

/** The EVASIONS row whose MISS still pays (`onMiss` — Potent Cantrip) for this attack activity: the attacker's
 * feature, the activity's item a cantrip where the row says so. `{ by, share }` or null. */
export function missShareFor(activity) {
  const item = activity?.item ?? null;
  const actor = activity?.actor ?? null;
  if ( !actor ) return null;
  for ( const [key, row] of Object.entries(EVASIONS) ) {
    if ( (row.side !== "caster") || !row.onMiss ) continue;
    if ( row.cantrip && !((item?.type === "spell") && (Number(item.system?.level) === 0)) ) continue;
    if ( featureNamed(actor, key) ) return { by: key, share: row.onMiss };
  }
  return null;
}

/** Does this creature hold (EQUIPPED) what a guard's row demands? */
export function holdsFor(actor, holding) {
  if ( !holding ) return true;
  const on = (actor?.items ?? []).filter(i => i.system?.equipped === true);
  const shield = on.some(i => (i.type === "equipment") && (i.system?.type?.value === "shield"));
  if ( holding === "shield" ) return shield;
  const weapon = on.some(i => (i.type === "weapon") && ["simpleM", "martialM", "simpleR", "martialR"].includes(i.system?.type?.value));
  return shield || weapon;
}

export const activityNamed = (item, name) =>
  [...(item?.system?.activities ?? [])].find(a => sameName(a.name, name)) ?? null;

/** The abilities a feat's own ASI assigned, or null when it came without its advancement. */
export function asiAssigned(feature) {
  try {
    const advancements = feature?.advancement?.byId ? Object.values(feature.advancement.byId)
      : Object.values(feature?.system?.advancement ?? {});
    const asi = advancements.find(a => a?.type === "AbilityScoreImprovement");
    const assignments = asi?.value?.assignments ?? {};
    const keys = Object.entries(assignments).filter(([, v]) => Number(v) > 0).map(([k]) => k);
    return keys.length ? keys : null;
  } catch { return null; }
}

export const activityOfType = (item, type) =>
  [...(item?.system?.activities ?? [])].find(a => a.type === type) ?? null;

/** The document behind a uuid, or null. ⚠ `fromUuidSync` THROWS on an unloaded pack or a bad uuid. */
export function resolveUuid(uuid) {
  if ( !uuid ) return null;
  try { return fromUuidSync(uuid) ?? null; }
  catch { return null; }
}

/* THE CARD'S ITEM AND ACTIVITY. ⚠ A use SPENDS before it posts: a potion's last use deletes the
 * item before its card exists (NOTES §2). These read the live document first, else the card's
 * snapshot; `tools/check-card-reads.mjs` fails the build on a bare uuid read elsewhere. */

/** The ITEM behind a card: live by `uuid`, else the card's own item when it is the one named. */
export function cardItem(message, uuid = null) {
  const live = resolveUuid(uuid);
  if ( live ) return live;
  let item = null;
  try { item = message?.getAssociatedItem?.() ?? null; } catch { item = null; }
  if ( !uuid || !item ) return item;
  const id = /(?:^|\.)Item\.([^.]+)$/.exec(String(uuid))?.[1] ?? null;
  return (id && (item.id === id)) ? item : null;
}

/** The ACTIVITY behind a card: live by `uuid`, else off the card's item (a weapon's rider save too). */
export function cardActivity(message, uuid = null) {
  const live = resolveUuid(uuid);
  if ( live ) return live;
  if ( !uuid ) {
    try { return message?.getAssociatedActivity?.() ?? null; } catch { return null; }
  }
  const [, itemId, activityId] = /(?:^|\.)Item\.([^.]+)\.Activity\.([^.]+)$/.exec(String(uuid)) ?? [];
  if ( !itemId ) return null;
  const item = cardItem(message);
  return (item?.id === itemId) ? (item.system?.activities?.get?.(activityId) ?? null) : null;
}

/**
 * A die formula resolved on THIS actor's roll data, or null. ⚠ A scale value on the wrong sheet
 * collapses to "0" in silence (NOTES §2), so an `@` left standing is a refusal.
 */
export function resolveDie(actor, raw) {
  if ( !raw || !actor ) return null;
  try {
    const r = String(Roll.replaceFormulaData(String(raw), actor.getRollData())).trim().replace(/^d(\d+)/i, "1d$1");
    return (Roll.validate(r) && !/@/.test(r)) ? r : null;
  } catch { return null; }
}

/** The folds entry of `kind` this actor carries, over the ENTRIES the caller read (no settings here). */
export function foldEntryFor(actor, kind, entries) {
  for ( const entry of entries ) {
    if ( entry.kind !== kind ) continue;
    const item = itemNamed(actor, entry.name);
    if ( item ) return { entry, item };
  }
  return null;
}


/** An equipped shield (Interpose's "holding a Shield"). */
export const equippedShield = actor =>
  !!actor?.itemTypes?.equipment?.some(i => (i.system.type?.value === "shield") && i.system.equipped);

/** A listed maneuver the actor can use now: its first activity, every itemUses target with a use left. */
export function usableManeuver(actor, name) {
  const item = itemNamed(actor, name);
  const activity = item?.system.activities?.contents?.[0];
  if ( !activity ) return null;
  for ( const c of (activity.consumption?.targets ?? []) ) {
    if ( c.type !== "itemUses" ) continue;
    const pool = c.target ? actor.items.get(c.target) : item;
    if ( ((pool?.system.uses?.value ?? 0) <= 0) ) return null;
  }
  return { item, activity };
}

/** A maneuver's die: a utility roll formula (Precision) or a damage first part (Riposte). */
export function maneuverDieFormula(activity) {
  return activity.roll?.formula
    || activity.damage?.parts?.[0]?.formula
    || null;
}

/** Every melee weapon CARRIED (the weapon swap rides any attack), equipped first. */
export function meleeOptions(actor) {
  const out = [];
  for ( const item of actor.items.filter(i => i.type === "weapon") ) {
    for ( const a of (item.system.activities?.contents ?? []) ) {
      if ( (a.type === "attack") && (a.attack?.type?.value === "melee") )
        out.push({ itemId: item.id, activityId: a.id, name: item.name,
          equipped: !!item.system.equipped,
          label: item.name + (item.system.equipped ? "" : " (stowed)") });
    }
  }
  out.sort((a, b) => Number(b.equipped) - Number(a.equipped));
  return out;
}

/* THE EFFECT PROFILES (NOTES §2 *the 6.0 pass*): `getEffect()` resolves asynchronously.
 * ⚠ The deprecated `profile.effect` returns a PROMISE. */

/**
 * Every profile in `list` beside the effect it resolves to (null when gone).
 * @typedef {object} ResolvedProfile
 * @property {object} profile
 * @property {ActiveEffect|null} effect
 * @returns {Promise<ResolvedProfile[]>}
 */
export async function profileEffects(list) {
  const out = [];
  for ( const profile of (list ?? []) ) {
    let effect = null;
    try { effect = (await profile?.getEffect?.()) ?? null; } catch { effect = null; }
    out.push({ profile, effect });
  }
  return out;
}

/** The activity's level-filtered `applicableEffects` that still resolve. */
export async function applicableProfiles(activity) {
  return (await profileEffects(activity?.applicableEffects ?? [])).filter(p => p.effect);
}

/** One profile's effect SYNCHRONOUSLY, for a preCreate reader that cannot await. */
export function profileEffectSync(profile, item) {
  if ( !profile ) return null;
  if ( profile.uuid ) return resolveUuid(profile.uuid);
  return item?.effects?.get?.(profile._id) ?? null;
}

/** The weapon this reactor last ATTACKED with (off the log), else the first option. */
export function preferredMeleeOption(actor, options) {
  if ( options.length <= 1 ) return options[0] ?? null;
  const mine = game.messages.contents.slice(-100).reverse().filter(m =>
    isCard(m, CARD.attack) && (m.getAssociatedActor?.()?.uuid === actor.uuid));
  for ( const m of mine ) {
    const itemId = activityUuidOf(m)?.match(/\.Item\.([^.]+)\./)?.[1] ?? null;
    const match = itemId ? options.find(o => o.itemId === itemId) : null;
    if ( match ) return match;
  }
  return options[0];
}

/**
 * A listed REDUCTION reaction (INTERRUPT_REDUCTIONS): its activity, whose healing formula is the
 * number. Null for the Monster Manual's Parry, an AC reaction of the same name.
 */
export function reductionFor(item, reactionName) {
  const key = Object.keys(INTERRUPT_REDUCTIONS).find(k => k.toLowerCase() === String(reactionName ?? "").toLowerCase());
  const row = key ? INTERRUPT_REDUCTIONS[key] : null;
  if ( !row ) return null;
  // Locale-proof fallback: dnd5e shows an empty STORED name as the type's localized title.
  const activities = [...(item?.system?.activities ?? [])];
  const activity = activities.find(a => a.name?.toLowerCase() === row.activity.toLowerCase())
    ?? activities.find(a => (a.type === "heal") && !a._source?.name)
    ?? null;
  const h = activity?.healing;
  const formula = h ? (h.custom?.enabled ? h.custom.formula : ((Number(h.number) > 0 && Number(h.denomination) > 0) ? `${h.number}d${h.denomination}${h.bonus ? ` + ${h.bonus}` : ""}` : (h.bonus || null))) : null;
  if ( !activity || !formula ) return null;
  return { row, activity, formula };
}

/* --- THE BYSTANDER'S READERS (Q2 option A): the attack side (hold/) and the save and check side (bystanders.js) --- */

/** The listed bystander rows (INTERRUPT_ROLLS `bystander`) that reach this kind of D20 Test. */
export function bystanderRows(testKind) {
  return interruptEntries().filter(e => e.kind === "roll")
    .map(e => Object.keys(INTERRUPT_ROLLS).find(k => lower(k) === lower(e.name)))
    .filter(k => k && INTERRUPT_ROLLS[k].bystander && (INTERRUPT_ROLLS[k].tests ?? []).includes(testKind));
}

/**
 * B3 — a die that stands in for a Superiority Die (SUPERIORITY_STAND_INS, Relentless): the pool EMPTY, the feature on the
 * sheet, not yet this turn (`chitStands` the caller's read). `{ feature, die, item, rule }` or null.
 * @param {Actor} actor
 * @param {Item|null} pool
 * @param {(riderKey: string) => boolean} chitStands
 */
export function superiorityStandIn(actor, pool, chitStands) {
  if ( !actor || !pool ) return null;
  if ( Number(pool.system?.uses?.value ?? 0) > 0 ) return null;
  for ( const [key, row] of Object.entries(SUPERIORITY_STAND_INS) ) {
    if ( !answers(row.pool, pool) ) continue;
    const item = featureNamed(actor, key);
    if ( !item || chitStands(`stand-in:${key}`) ) continue;
    return { feature: key, die: row.die, item, rule: row.rule };
  }
  return null;
}

/** A bystander row's die, read off the BYSTANDER's own roll data (a scale's formula); a flat `bonus` as itself. */
export function bystanderDie(actor, row) {
  if ( row.bonus !== undefined ) return String(row.bonus);
  if ( !row.die ) return null;
  if ( /^\d*d\d+/i.test(String(row.die).trim()) ) return String(row.die).trim();   // a plain die (Bend Luck's 1d4, B4)
  const value = foundry.utils.getProperty(actor?.getRollData?.() ?? {}, row.die);
  // ⚠ `formula`/`die` are getters on ScaleValueTypeDice (BARDIC's lesson): a plain string only.
  const formula = (typeof value === "string") ? value : (value?.formula ?? value?.die ?? null);
  return ((typeof formula === "string") && formula.trim()) ? formula.trim() : null;
}

/**
 * THE REROLL of a d20 roll, rebuilt from the original's class, data and options — a plain `Roll` would lose a moved
 * crit threshold. `advantage` rolls the new one at Advantage (Countercharm). ⚠ `configured` is dropped: an evaluated
 * Advantage roll's formula reads `2d20kh`, and with `configured: true` the constructor skips the system's
 * normalisation and rolls four dice.
 * @param {any} original
 * @param {Actor|null} actor
 * @param {{advantage?: boolean}} [opts]
 */
export async function rerollD20(original, actor, { advantage = false } = {}) {
  if ( !original ) return null;
  const RollCls = original.constructor;
  const options = foundry.utils.deepClone(original.options ?? {});
  delete options.configured;
  if ( advantage ) options.advantageMode = CONFIG.Dice?.D20Roll?.ADV_MODE?.ADVANTAGE ?? 1;
  const roll = new RollCls(original.formula, original.data ?? actor?.getRollData?.() ?? {}, options);
  await roll.evaluate();
  return { roll, summary: { total: roll.total, isCritical: roll.isCritical === true, isFumble: roll.isFumble === true } };
}

/** A d20 roll's facts for the gate and the bend: the kept and first faces, the mode, the crit range. */
export function d20FactsOf(roll) {
  const d20 = roll?.dice?.[0] ?? null;
  const { kept, plain } = d20Faces(d20?.results ?? []);
  return { kept, plain, mode: d20ModeOf({ number: d20?.number, modifiers: d20?.modifiers }),
    faces: (d20?.results ?? []).filter(r => !r?.rerolled).map(r => r.result),
    critAt: Number(d20?.options?.criticalSuccess ?? roll?.options?.criticalSuccess ?? 20),
    fumbleAt: Number(d20?.options?.criticalFailure ?? roll?.options?.criticalFailure ?? 1) };
}
