/**
 * Battle Flow — Phase 1.75: curated hit riders - a mark on the target pays out with the attack that earned it.
 * Split from battleflow.js (ARCHITECTURE.md §7); battleflow.js is the only esmodules entry.
 */
import { TITLE, S, setting } from "./core.js";
import { riderEntries, riderUpgradeEntries } from "./settings.js";
import { riderKey } from "./decide/eligible.js";
import { hitTargets } from "./shared.js";
import { bfCard } from "./decide/present.js";

/* ---------------------------------------------------------------------------------------------
 * Phase 1.75 — hit riders (the attacker's client, folded into the attack's own damage roll)
 *
 * Hunter's Mark and Hex read "you deal an extra 1d6 to the target whenever you hit it with an
 * attack roll", and dnd5e models that as a SEPARATE damage activity — "Bonus Mark Damage" —
 * that the caster presses by hand after every single hit. This folds it into the weapon's roll.
 *
 * The whole feature is one question, asked of the mark itself:
 *
 *     the mark on the TARGET  --origin-->  the ITEM it came from  --parent-->  the ACTOR
 *                                                |                               |
 *                                         what it deals                  who put it there
 *
 * If that actor is the one attacking, its damage rides along. Nothing else is consulted — not
 * the mark's name, not its `marked` / `cursed` status. Two rangers can mark the same creature,
 * and the origin walk is the only thing that tells them apart.
 *
 * **A mark that is still on the target is a mark that still counts**, so concentration never
 * comes into it: the system's dependent-effect cascade deletes the mark the moment the caster's
 * concentration breaks. Presence is the whole state.
 *
 * Crit doubling is FREE and must not be hand-rolled. `preRollDamageV2` fires at
 * basic-roll.mjs:101, BEFORE applyKeybindings at :106 stamps `options.isCritical` onto every
 * entry in config.rolls — ours included — so configureDamage doubles the rider die exactly as
 * it doubles the weapon's. That is 2024 RAW: a rider IS part of the attack, so the attack's
 * crit rule already covers it. ⚠ Do NOT consult `damage.critical.allow` on the source activity.
 * It reads inconsistently across official content (compendium hunters-mark true; the Favored
 * Enemy copy and foe-slayer false) because it governs the standalone BUTTON — whether pressing
 * Bonus Mark Damage on its own offers a crit toggle, where there is no attack to ask about —
 * not whether the rule doubles the die.
 *
 * dnd5e 5.3.3 cannot express "only against the marked creature"; Conditional ActiveEffects is
 * on the system roadmap. DELETE THIS WHOLE SECTION the day it ships (DESIGN.md §3).
 * ------------------------------------------------------------------------------------------- */


/**
 * The attacker's own item that REPLACES a mark's damage, or null. Ranger level 20: "the damage
 * die of your Hunter's Mark is a d10 rather than a d6" — and `foe-slayer` ships that as its own
 * "Improved Hunter's Mark Damage" activity at 1d10 force, so the replacement is read from the
 * feature exactly as the original is read from the spell. Nothing here knows about dice sizes.
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
 * What a mark's own source says it deals: the parts of its no-activation damage activity — the
 * system's shape for "press this when it applies" ("Bonus Mark Damage", "Bonus Hex Damage").
 * Reading the number here instead of transcribing it into the setting means the damage can only
 * ever be the one the content ships, and a homebrewed mark works with no entry to edit.
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
 * Who put a mark on, and what the mark is: walk its origin uuid up to the nearest Actor,
 * keeping the Item passed on the way. Both answers fall out of one walk.
 *
 * ⚠ Verified against a live mark, and it does NOT match a straight reading of the effect tray.
 * The tray sets `origin = concentration ?? effect` (effect-application.mjs:184), but that first
 * branch only fires when `chatMessage.system.concentration` is set; a real Hunter's Mark on
 * this table arrived pointing at the SOURCE ITEM'S OWN EFFECT,
 * `Actor.<caster>.Item.<hunters-mark>.ActiveEffect.<marker>`. Do not code to either shape — the
 * walk ends at the same Actor and Item whichever branch ran, and also survives a mark dragged
 * on by hand.
 *
 * ⚠ Origins go stale. Prone effects on this table point at a token that no longer exists and
 * resolve to null, so every hop must tolerate a miss.
 */
function markSource(marker) {
  const uuid = marker.origin || marker.getFlag("dnd5e", "dependentOn");
  let doc = null;
  try { doc = uuid ? fromUuidSync(uuid) : null; } catch { return null; }
  const root = doc;
  let item = null;
  while ( doc && !(doc instanceof Actor) ) {
    if ( doc instanceof Item ) item = doc;
    doc = doc.parent;
  }
  if ( !(doc instanceof Actor) ) return null;

  // The other shape: an effect sitting directly ON the caster, which NAMES its item rather than
  // living underneath one — what the tray writes when the spell began concentration. The walk
  // above finds the actor but never passes an Item, so the name has to be read off the flag.
  // ⚠ This is uuid resolution, not a concentration test: nothing here asks whether anyone is
  // still concentrating, and nothing should.
  if ( !item ) {
    const carried = root?.getFlag?.("dnd5e", "item");
    try { item = carried?.uuid ? fromUuidSync(carried.uuid) : null; } catch { item = null; }
    // ⚠ `flags.dnd5e.item.data` is populated ONLY when the item is not on the actor
    // (active-effect.mjs:714) — the cached-spell shape innate and statblock casting use. Without
    // this fallback a monster's mark resolves to no item and silently stops paying.
    if ( !item && carried?.data ) item = new Item.implementation(carried.data, { parent: doc });
  }
  return item ? { actor: doc, item } : null;
}

/**
 * Every rider this attacker has earned against this one target: each mark the target carries
 * that THIS attacker placed, whose source the table lists, paying what that source says.
 *
 * ⚠ The owner test is by **uuid**, not id. An unlinked token's synthetic actor keeps the base
 * actor's `id`, so two identical marking tokens would read as one creature and each would
 * collect the other's die.
 *
 * Returns a Map so the caller can intersect across targets by key — the parts are rebuilt on
 * every call, so comparing them by reference would find nothing in common and silently drop a
 * rider that every target had earned.
 */
function ridersAgainst(attacker, targetActor) {
  // ⚠ `{ name }` entries since Phase 3, not bare strings — one shape for every list setting.
  const listed = riderEntries();
  const found = new Map();
  for ( const marker of targetActor.effects ) {
    const src = markSource(marker);
    if ( src?.actor?.uuid !== attacker.uuid ) continue;
    const identifier = src.item.system?.identifier;
    if ( !identifier || !listed.some(e => e.name === identifier) ) continue;
    // A feature the ATTACKER owns can replace the mark's damage outright — Foe Slayer's d10 for
    // Hunter's Mark's d6. It replaces, never stacks: the source is swapped, not appended.
    const source = riderUpgrade(identifier, attacker) ?? src.item;
    for ( const part of riderParts(source) ) found.set(riderKey(identifier, part), part);
  }
  return found;
}

/**
 * Who this damage roll is landing on, in order of trust:
 *  1. the originating attack message's snapshot, filtered to the targets it actually hit — the
 *     same authority Phase 1a and 1b use. Battle Flow's own damage rolls always stamp
 *     `originatingMessage`, so this covers auto-damage and a hold's continuation exactly.
 *  2. the rolling client's live targets, for a human pressing the native Damage button —
 *     ⚠ `AttackActivity.#rollDamage` passes no message data at all (attack.mjs:305), so there
 *     is no chain to walk on that path and the selection is all there is.
 * The snapshot carries ACTOR uuids, and this hook is synchronous, so resolution is Sync.
 */
function riderTargets(message) {
  const originId = message?.data?.["flags.dnd5e.originatingMessage"];
  const origin = originId ? game.messages.get(originId) : null;
  const attack = (origin?.getFlag("dnd5e", "roll.type") === "attack")
    ? origin
    : (origin?.getAssociatedRolls("attack").pop() ?? null);
  if ( attack ) {
    const hits = hitTargets(attack)
      .map(t => { try { return fromUuidSync(t.uuid); } catch { return null; } })
      .filter(Boolean);
    if ( hits.length ) return hits;
  }
  return Array.from(game.user.targets).map(t => t.actor).filter(Boolean);
}

Hooks.on("dnd5e.preRollDamageV2", (config, dialog, message) => {
  if ( !setting(S.riders) ) return;
  const activity = config.subject;
  const attacker = activity?.actor;
  if ( !attacker ) return;
  // A rider rides an ATTACK. Save and AoE damage is not "part of the attack" under the 2024
  // crit rule, and the rider's own standalone Bonus Mark Damage press is an attack activity's
  // opposite — guarding here is what stops this feature adding a die to itself.
  if ( activity.type !== "attack" ) return;

  const targets = riderTargets(message);
  if ( !targets.length ) return;

  // One damage roll serves every target it hit, so a rider may only be folded in when it is
  // true of ALL of them. A ranger who hits their quarry and an unmarked goblin with one attack
  // gets the extra die applied to the goblin too if we are careless — over-applying damage is
  // the worst failure this module has, so the intersection is the only safe answer. The
  // dropped case is announced rather than swallowed (§2.5): the caster earned that die.
  const per = targets.map(t => ridersAgainst(attacker, t));
  const common = [...per[0]].filter(([key]) => per.every(m => m.has(key)));
  const dropped = new Set(per.flatMap(m => [...m.keys()]).filter(k => !per.every(m => m.has(k))));
  if ( dropped.size ) {
    // §2.5: the caster earned that die, so the non-payment must reach the TABLE, not the
    // console — whispered to the roller and the GM, since it is their by-hand roll to make.
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
      // No `properties`: the rider is its own damage and must NOT inherit the weapon's
      // magical/silvered flags — those decide physical-resistance bypass, which force and
      // necrotic have no business claiming.
      data: config.rolls[0]?.data ?? {},
      parts: [part.formula],
      options: { type: part.type, types: part.type ? [part.type] : [] }
    });
  }
});

