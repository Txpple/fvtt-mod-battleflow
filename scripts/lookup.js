/**
 * Battle Flow — SPINE (ARCHITECTURE.md §7): the shared sheet and document readers; nothing here
 * decides. ⚠ It owns no hook, flag or write, and imports only core.js and pure modules; keep it that way.
 * A table's row finds its item by dnd5e's identifier, then by its name (decide/registry.js `matchOf`).
 */

import { CARD, activityUuidOf, isCard } from "./decide/card.js";
import { INTERRUPT_REDUCTIONS, identifierOf, matchOf } from "./decide/registry.js";
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
