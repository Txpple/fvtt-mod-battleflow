/**
 * Battle Flow — SPINE (ARCHITECTURE.md §7): the shared sheet and document readers. Nothing here
 * decides anything; every function answers a lookup about a document the caller holds.
 * ⚠ Spine, not decision: it touches Foundry globals. It owns no hook, flag or write, and imports
 * only pure modules (decide/card.js, decide/registry.js); keep it that way.
 * ⚠ Names match CASE-INSENSITIVELY: the tables' keys are pack names typed by hand.
 */

import { CARD, activityUuidOf, isCard } from "./decide/card.js";
import { INTERRUPT_REDUCTIONS } from "./decide/registry.js";

/** A name folded for comparison — the one lower-case helper. */
export const lower = s => String(s ?? "").toLowerCase();

/** Do two names mean the same feature, spell or activity? */
const sameName = (a, b) => lower(a) === lower(b);

/** The item on the sheet by name, any type, or null. */
export const itemNamed = (actor, name) => actor?.items?.find(i => sameName(i.name, name)) ?? null;

/**
 * The damage types an attack deals, before its dice: the activity's parts and, where it takes
 * them, the weapon's base damage (a two-type weapon names every type it may deal).
 */
export function dealtTypesOf(activity) {
  const out = new Set();
  for ( const part of (activity?.damage?.parts ?? []) ) for ( const t of (part?.types ?? []) ) out.add(t);
  if ( (activity?.damage?.includeBase !== false) && (activity?.item?.type === "weapon") ) {
    for ( const t of (activity.item.system?.damage?.base?.types ?? []) ) out.add(t);
  }
  return [...out];
}

/** The feat on the sheet by name, or null. */
export const featureNamed = (actor, name) =>
  actor?.items?.find(i => (i.type === "feat") && sameName(i.name, name)) ?? null;

/**
 * Does this creature hold what a guard's row demands? Holding is EQUIPPED: "shield" a Shield;
 * "shieldOrWeapon" a Shield or a Simple or Martial weapon. No demand, always.
 */
export function holdsFor(actor, holding) {
  if ( !holding ) return true;
  const on = (actor?.items ?? []).filter(i => i.system?.equipped === true);
  const shield = on.some(i => (i.type === "equipment") && (i.system?.type?.value === "shield"));
  if ( holding === "shield" ) return shield;
  const weapon = on.some(i => (i.type === "weapon") && ["simpleM", "martialM", "simpleR", "martialR"].includes(i.system?.type?.value));
  return shield || weapon;
}

/** The activity on an item by name, or null. */
export const activityNamed = (item, name) =>
  [...(item?.system?.activities ?? [])].find(a => sameName(a.name, name)) ?? null;

/**
 * The abilities a feat's own Ability Score Improvement assigned ("the ability you increased with
 * this feat"), or null when the feat came without its advancement (dropped on by hand).
 */
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

/** The first activity of a type on an item (`save`, `damage`, …), or null. */
export const activityOfType = (item, type) =>
  [...(item?.system?.activities ?? [])].find(a => a.type === type) ?? null;

/**
 * The document behind a uuid, or null — never a throw. ⚠ `fromUuidSync` THROWS on an unloaded
 * pack's uuid and on a malformed one.
 */
export function resolveUuid(uuid) {
  if ( !uuid ) return null;
  try { return fromUuidSync(uuid) ?? null; }
  catch { return null; }
}

/* THE CARD'S ITEM AND ACTIVITY. ⚠ A use SPENDS before it posts: a potion's last use deletes the
 * item before its card exists (NOTES §2). The card keeps a snapshot the platform's own read
 * rebuilds (`getAssociatedItem` / `getAssociatedActivity`); these read the live document first,
 * else that copy. `tools/check-card-reads.mjs` fails the build on a bare uuid read elsewhere. */

/**
 * The ITEM behind a card: the live document by `uuid` when it stands, else the card's own item
 * (live, or rebuilt from its snapshot once the use deleted it) — only when it is the item the
 * uuid names. No `uuid`: the card's own item. Null when neither answers.
 */
export function cardItem(message, uuid = null) {
  const live = resolveUuid(uuid);
  if ( live ) return live;
  let item = null;
  try { item = message?.getAssociatedItem?.() ?? null; } catch { item = null; }
  if ( !uuid || !item ) return item;
  const id = /(?:^|\.)Item\.([^.]+)$/.exec(String(uuid))?.[1] ?? null;
  return (id && (item.id === id)) ? item : null;
}

/**
 * The ACTIVITY behind a card: the live one by `uuid` when it stands, else read off the card's
 * item — so a save or rider activity on the same item as the card's own (a weapon's rider save
 * on its attack card) resolves too. No `uuid`: the card's own activity. Null when neither answers.
 */
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
 * A die formula resolved on THIS actor's roll data, or null. ⚠ A scale value read on the wrong
 * sheet collapses to "0" in silence (NOTES §2), so an `@` left standing is a refusal; a bare "d8"
 * reads as "1d8".
 */
export function resolveDie(actor, raw) {
  if ( !raw || !actor ) return null;
  try {
    const r = String(Roll.replaceFormulaData(String(raw), actor.getRollData())).trim().replace(/^d(\d+)/i, "1d$1");
    return (Roll.validate(r) && !/@/.test(r)) ? r : null;
  } catch { return null; }
}

/* THE MANEUVER READERS — sheet reads and one log read, for the fold machines and saves.js. */

/**
 * The folds entry of `kind` this actor carries, over the ENTRIES the caller read (this file
 * reads no world setting). For a kind with no pool the item's presence is the capability.
 */
export function foldEntryFor(actor, kind, entries) {
  for ( const entry of entries ) {
    if ( entry.kind !== kind ) continue;
    const item = itemNamed(actor, entry.name);
    if ( item ) return { entry, item };
  }
  return null;
}


/** An equipped shield — Interpose's "holding a Shield" clause, read off the sheet. */
export const equippedShield = actor =>
  !!actor?.itemTypes?.equipment?.some(i => (i.system.type?.value === "shield") && i.system.equipped);

/**
 * The actor's usable copy of a listed maneuver: the item by name, its first activity, and every
 * itemUses consumption target with a use left. No consumption: simply usable.
 */
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

/** The die formula behind a maneuver, from the item's own data: a utility activity's roll
 * formula (Precision) or a damage activity's first part (Riposte). */
export function maneuverDieFormula(activity) {
  return activity.roll?.formula
    || activity.damage?.parts?.[0]?.formula
    || null;
}

/** The reactor's melee options — every melee weapon CARRIED, not just equipped (2024's
 * weapon-swap rides any attack). Equipped first, stowed ones say so; the sheet is never mutated. */
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

/* THE EFFECT PROFILES (NOTES §2 *the 6.0 pass*): an activity's `effects` list holds PROFILES whose
 * `getEffect()` resolves the document asynchronously. ⚠ The deprecated `profile.effect` returns a
 * PROMISE. These return the profile BESIDE its effect, keeping `onSave` and `_id`. */

/**
 * Every profile in `list` beside the effect it resolves to (null when gone).
 * @typedef {object} ResolvedProfile
 * @property {object} profile              the activity's own row — `_id`, `uuid`, `onSave`, `level`
 * @property {ActiveEffect|null} effect    the document it names, null when the item has lost it
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

/** The activity's APPLICABLE profiles (its `applicableEffects`, level-filtered) that still resolve to an effect. */
export async function applicableProfiles(activity) {
  return (await profileEffects(activity?.applicableEffects ?? [])).filter(p => p.effect);
}

/**
 * One profile's effect, SYNCHRONOUSLY — for a reader that runs at preCreate and cannot await:
 * the item's own embedded effect by the profile's id; an external one (a uuid) only when the
 * index can hand it over without a round trip. Null otherwise.
 */
export function profileEffectSync(profile, item) {
  if ( !profile ) return null;
  if ( profile.uuid ) return resolveUuid(profile.uuid);
  return item?.effects?.get?.(profile._id) ?? null;
}

/** The weapon this reactor last ATTACKED with, off the log: the newest attack message by this
 * actor whose item is still among the options, else the first option. */
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
 * A listed reaction whose effect is a REDUCTION the module can roll (INTERRUPT_REDUCTIONS — the
 * Battle Master's Parry): the row's activity, whose healing formula is the number. Null otherwise
 * — the Monster Manual's Parry is an AC reaction of the same name, with no such activity.
 */
export function reductionFor(item, reactionName) {
  const key = Object.keys(INTERRUPT_REDUCTIONS).find(k => k.toLowerCase() === String(reactionName ?? "").toLowerCase());
  const row = key ? INTERRUPT_REDUCTIONS[key] : null;
  if ( !row ) return null;
  // By name, or (locale-proof) the first heal activity whose STORED name is empty — dnd5e shows
  // an empty name as the type's localized title.
  const activities = [...(item?.system?.activities ?? [])];
  const activity = activities.find(a => a.name?.toLowerCase() === row.activity.toLowerCase())
    ?? activities.find(a => (a.type === "heal") && !a._source?.name)
    ?? null;
  const h = activity?.healing;
  const formula = h ? (h.custom?.enabled ? h.custom.formula : ((Number(h.number) > 0 && Number(h.denomination) > 0) ? `${h.number}d${h.denomination}${h.bonus ? ` + ${h.bonus}` : ""}` : (h.bonus || null))) : null;
  if ( !activity || !formula ) return null;
  return { row, activity, formula };
}
