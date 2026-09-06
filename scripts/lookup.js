/**
 * Battle Flow — SPINE (ARCHITECTURE.md §7): the shared sheet and document readers.
 *
 * The machine-tier pass, Stage 1 (2026-09-05). Nine machines carried their own lower-case
 * helper, four their own feature-by-name, three their own activity-by-name, thirty sites the
 * same inline `try { fromUuidSync } catch` and five the same replace-and-validate die idiom —
 * the copy-the-last-machine growth of 2026-09-04/05, measured by grep before this file was
 * written. One home, the same bodies. **Nothing here decides anything**: every function reads a
 * document the caller already holds and answers a lookup question about it.
 *
 * ⚠ SPINE, NOT DECISION. `fromUuidSync` and `Roll` are Foundry globals, and `actor.items` is a
 * document collection — EDGE by §2's test, so this cannot live in decide/. It imports nothing
 * and owns no hook, no flag, no write; keep it that way. `core.js` and `shared.js` keep their own
 * copies of the uuid guard on purpose: core is the leaf and shared is this file's own layer.
 *
 * ⚠ Names match CASE-INSENSITIVELY everywhere here, because that is what every copy did: the
 * packs' names are the tables' keys and the tables are typed by hand.
 */

/** A name folded for comparison — the one lower-case helper. */
export const lower = s => String(s ?? "").toLowerCase();

/** Do two names mean the same feature, spell or activity? */
export const sameName = (a, b) => lower(a) === lower(b);

/** The item on the sheet by name, any type, or null. */
export const itemNamed = (actor, name) => actor?.items?.find(i => sameName(i.name, name)) ?? null;

/** The feat on the sheet by name, or null. */
export const featureNamed = (actor, name) =>
  actor?.items?.find(i => (i.type === "feat") && sameName(i.name, name)) ?? null;

/** The activity on an item by name, or null. */
export const activityNamed = (item, name) =>
  [...(item?.system?.activities ?? [])].find(a => sameName(a.name, name)) ?? null;

/** The first activity of a type on an item (`save`, `damage`, …), or null. */
export const activityOfType = (item, type) =>
  [...(item?.system?.activities ?? [])].find(a => a.type === type) ?? null;

/**
 * The document behind a uuid, or null — never a throw. `fromUuidSync` THROWS on a uuid whose
 * pack is not loaded and on a malformed one (polish.js measured it), and a flag written weeks
 * ago may name a document that has since gone; every caller wants "not here" for both.
 */
export function resolveUuid(uuid) {
  if ( !uuid ) return null;
  try { return fromUuidSync(uuid) ?? null; }
  catch { return null; }
}

/**
 * A die formula resolved on THIS actor's roll data, or null when it does not resolve: a scale
 * value (`@scale.battle-master.superiority.die`) read on the wrong sheet collapses to "0" in
 * silence (NOTES §2; d20-folds.js measured it), so an `@` left standing is a refusal, and a bare
 * "d8" reads as "1d8" so the Roll parser and the card agree.
 */
export function resolveDie(actor, raw) {
  if ( !raw || !actor ) return null;
  try {
    const r = String(Roll.replaceFormulaData(String(raw), actor.getRollData())).trim().replace(/^d(\d+)/i, "1d$1");
    return (Roll.validate(r) && !/@/.test(r)) ? r : null;
  } catch { return null; }
}

/* ---------------------------------------------------------------------------------------------
 * THE MANEUVER READERS (the machine-tier pass, Stage 4a, 2026-09-05) — moved here from
 * maneuvers.js when it split by moment. Two customers already: the five fold machines and
 * saves.js (the OPEN pin `saves -> maneuvers` came out with the move). Sheet reads and one log
 * read, nothing decided.
 * ------------------------------------------------------------------------------------------- */

/**
 * The folds entry of `kind` this actor actually carries — the listed item, by name, over the
 * ENTRIES the caller read (`maneuverFoldEntries()` — this file reads no world setting). The
 * pool-drawing kinds (precision/riposte) still go through usableManeuver for consumption;
 * interpose/bash/hew have no pool of their own, so the item's PRESENCE is the capability
 * and everything past that (shield in hand, verdict, melee) belongs to the caller.
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
 * The actor's usable copy of a listed maneuver: the item by name (case-insensitive), its
 * first activity, and the consumption check — every itemUses consumption target must have a
 * use left (Precision/Riposte both draw on the Combat Superiority pool, measured by probe
 * P2). An activity with no consumption is simply usable.
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

/** The die formula behind a maneuver — read from the item's own data, never typed anywhere:
 * a utility activity's roll formula (Precision) or a damage activity's first part (Riposte). */
export function maneuverDieFormula(activity) {
  return activity.roll?.formula
    || activity.damage?.parts?.[0]?.formula
    || null;
}

/** The reactor's melee options — every melee weapon CARRIED, not just equipped (v1.19.x
 * finding (i)): 2024's weapon-swap rides any attack, so equipped-state bookkeeping must
 * not hide the greatsword or eat the offer. Equipped first, stowed ones say so, and the
 * sheet is never mutated — the resolved card names what swung; the bookkeeping stays
 * human. (P3: the discriminator is activity.attack.type.value.) */
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

/** The weapon this reactor last ATTACKED with, off the log (v1.19.x finding ④ — the walk's
 * "how is the weapon picked?"): newest attack message by this actor whose activity names an
 * item still among the options. Inventory order was the old default and told nobody anything. */
export function preferredMeleeOption(actor, options) {
  if ( options.length <= 1 ) return options[0] ?? null;
  const mine = game.messages.contents.slice(-100).reverse().filter(m =>
    (m.getFlag("dnd5e", "roll.type") === "attack") && (m.getAssociatedActor?.()?.uuid === actor.uuid));
  for ( const m of mine ) {
    const itemId = m.getFlag("dnd5e", "activity")?.uuid?.match(/\.Item\.([^.]+)\./)?.[1] ?? null;
    const match = itemId ? options.find(o => o.itemId === itemId) : null;
    if ( match ) return match;
  }
  return options[0];
}
