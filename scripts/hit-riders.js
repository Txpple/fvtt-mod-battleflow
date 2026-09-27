/**
 * Battle Flow — curated hit riders: a mark on the target pays out with the attack that earned it.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { TITLE, S, setting } from "./core.js";
import { resolveUuid } from "./lookup.js";
import { riderEntries, riderUpgradeEntries } from "./settings.js";
import { riderKey } from "./decide/eligible.js";
import { effectSourceOf, hitTargets } from "./shared.js";
import { bfCard } from "./decide/present.js";
import { CARD, isCard, originIdInData } from "./decide/card.js";

/* ---------------------------------------------------------------------------------------------
 * Hit riders (on the attacker's client, folded into the attack's own damage roll). dnd5e models
 * Hunter's Mark's and Hex's extra die as a SEPARATE damage activity pressed by hand after every
 * hit; this folds it into the weapon's roll. One question, asked of the mark itself:
 *     the mark on the TARGET --origin--> the ITEM it came from --parent--> the ACTOR
 * If that actor is the attacker, its damage rides. Nothing else is consulted (not the mark's name
 * or status): two rangers can mark the same creature and only the origin chain tells them apart.
 * A mark still on the target still counts — the system deletes it when concentration breaks.
 * ⚠ Crit doubling is FREE: `preRollDamageV2` fires BEFORE the key bindings stamp
 * `options.isCritical` onto every roll in config.rolls, ours included (a rider IS part of the
 * attack under 2024 RAW). Do NOT consult the source activity's `damage.critical.allow` — it
 * governs the standalone button and reads inconsistently across official content.
 * dnd5e cannot express "only against the marked creature"; delete this section the day
 * Conditional ActiveEffects ships (DESIGN.md §3).
 * ------------------------------------------------------------------------------------------- */

/**
 * The attacker's own item that REPLACES a mark's damage, or null (Foe Slayer ships its d10 as its
 * own activity), so the replacement is read from the feature exactly as the original is read from
 * the spell. Nothing here knows about dice sizes.
 */
function riderUpgrade(identifier, attacker) {
  for ( const { feature, rider } of riderUpgradeEntries() ) {
    if ( rider !== identifier ) continue;
    const owned = attacker.items.find(i => i.system?.identifier === feature);
    if ( owned ) return owned;
  }
  return null;
}

/**
 * What a mark's own source says it deals: the parts of its no-activation damage activity (the
 * system's "press this when it applies" shape). Read, never transcribed — the damage can only be
 * the one the content ships, and a homebrewed mark works with no entry to edit.
 */
function riderParts(item) {
  const activities = item.system?.activities ?? [];
  const bonus = [...activities].find(a =>
    (a.type === "damage") && a.activation?.override && !a.activation?.type);
  return (bonus?.damage?.parts ?? []).map(p => ({
    formula: p.custom?.enabled ? p.custom.formula : `${p.number ?? 1}d${p.denomination}`,
    type: Array.from(p.types ?? [])[0] ?? null
  })).filter(p => /\d/.test(p.formula));
}

/**
 * Every rider this attacker has earned against this one target: each mark the target carries that
 * THIS attacker placed, whose source the table lists, paying what that source says.
 * ⚠ The owner test is by **uuid**, not id: an unlinked token's synthetic actor keeps the base
 * actor's `id`, so two identical marking tokens would each collect the other's die.
 * Returns a Map keyed for intersection across targets — the parts are rebuilt every call, so
 * comparing them by reference would silently drop a rider every target had earned.
 */
function ridersAgainst(attacker, targetActor) {
  const listed = riderEntries();
  const found = new Map();
  for ( const marker of targetActor.effects ) {
    const src = effectSourceOf(marker);
    if ( src?.actor?.uuid !== attacker.uuid ) continue;
    const identifier = src.item.system?.identifier;
    if ( !identifier || !listed.some(e => e.name === identifier) ) continue;
    // An owned upgrade REPLACES the mark's damage, never stacks.
    const source = riderUpgrade(identifier, attacker) ?? src.item;
    for ( const part of riderParts(source) ) found.set(riderKey(identifier, part), part);
  }
  return found;
}

/**
 * Who this damage roll is landing on, in order of trust:
 *  1. the originating attack message's snapshot, filtered to the targets it hit — the module's
 *     own damage rolls always stamp `system.origin`, so this covers auto-damage and a hold's
 *     continuation.
 *  2. the rolling client's live targets, for a human pressing the native Damage button — ⚠ the
 *     platform reads that click at buildPost, AFTER this hook, so there is no chain to walk.
 * The snapshot carries ACTOR uuids and this hook is synchronous, so resolution is Sync.
 */
function riderTargets(message) {
  const originId = originIdInData(message?.data);
  const origin = originId ? game.messages.get(originId) : null;
  const attack = isCard(origin, CARD.attack)
    ? origin
    : (origin?.getAssociatedRolls("attack").pop() ?? null);
  if ( attack ) {
    const hits = hitTargets(attack)
      .map(t => resolveUuid(t.uuid))
      .filter(Boolean);
    if ( hits.length ) return hits;
  }
  return Array.from(game.user.targets).map(t => t.actor).filter(Boolean);
}

Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  if ( !setting(S.riders) ) return;
  const activity = config.subject;
  const attacker = activity?.actor;
  if ( !attacker ) return;
  // A rider rides an ATTACK: save and area damage is not part of the attack, and this guard stops
  // the rider's own standalone damage press adding a die to itself.
  if ( activity.type !== "attack" ) return;

  const targets = riderTargets(message);
  if ( !targets.length ) return;

  // One damage roll serves every target it hit, so a rider folds in only when it is true of ALL of
  // them — over-applying damage is the worst failure this module has. The dropped case is
  // announced: the caster earned that die.
  const per = targets.map(t => ridersAgainst(attacker, t));
  const common = [...per[0]].filter(([key]) => per.every(m => m.has(key)));
  const dropped = new Set(per.flatMap(m => [...m.keys()]).filter(k => !per.every(m => m.has(k))));
  if ( dropped.size ) {
    // Whispered to the roller and the GM — the non-payment must reach the TABLE, not the console.
    const names = [...new Set([...dropped].map(k => k.split(":")[0]))].join(", ");
    void ChatMessage.create({
      content: bfCard({
        eyebrow: "Rider — not folded in", title: "One roll, mixed targets", tone: "neutral",
        lines: [`This damage roll serves targets that are not all marked, so `
          + `<strong>${names}</strong> was left out rather than over-applied. `
          + `Roll the bonus damage by hand for the marked target.`]
      }),
      whisper: [...new Set([game.userId, ...game.users.filter(u => u.isGM).map(u => u.id)])],
      speaker: { alias: TITLE }
    });
    console.warn(`${TITLE} | Rider(s) ${[...dropped].join(", ")} not folded in: one damage roll `
      + "covers targets that are not all marked. Roll the bonus damage by hand for the marked one.");
  }

  for ( const [, part] of common ) {
    config.rolls.push({
      // No `properties`: the rider must NOT inherit the weapon's magical/silvered flags (they
      // decide physical-resistance bypass). ⚠ The roll data is CLONED, not shared: dnd5e writes
      // `roll.damageType` and `@ruleBonus` into each roll's data, and a shared object carries the
      // last rider's type onto roll 0.
      data: foundry.utils.deepClone(config.rolls[0]?.data ?? {}),
      parts: [part.formula],
      options: { type: part.type, types: part.type ? [part.type] : [] }
    });
  }
});

