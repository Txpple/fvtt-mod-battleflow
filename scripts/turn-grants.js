/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE TURN-START GRANT (TURN_GRANTS) — a landed effect whose
 * text pays the bearer at the start of each of its turns what the pack rolls once, at the cast
 * (Heroism's Temporary Hit Points): the origin item's activity is rolled again on the caster's numbers
 * and landed on the bearer with a receipt, no choice (R1). The precedent is the emanation's turn-start heal.
 * A `match: "feature"` row (Regeneration, the GM's side) is the bearer's OWN trait: its heal rolled on the bearer's
 * numbers, while it has at least 1 Hit Point, unless a damage type its own copy names was dealt to it since
 * its last turn started (the receipts) — then a card says why nothing is paid.
 * A `deals` row (the GM's side) is a DAMAGE: the grappled creature's own turn start or end pays the grappler's
 * "Damage: Grappled" rolled on the grappler's numbers (Constricting Vine, the swarm); a feature row's
 * `deals: "grappled"` pays the bearer's damage to what it grapples at its own turn start (Barbed Hide).
 * The PHB classes (A6): a feature row `on: "use"` pays as its bearer uses the named item (Vitality Surge at the
 * Rage); `while: "raging"` pays only while the Rage stands; `to: "ally"` rolls the amount and GIVES it to one
 * creature within reach — the owner's pick, the rest song's popup (Life-Giving Force).
 */
import { MODULE_ID, TITLE, drivesMomentFor, statContext } from "./core.js";
import { activityNamed, activityOfType, cardActivity, featureNamed, lower } from "./lookup.js";
import { chitStampOf, effectSourceOf } from "./shared.js";
import { CARD, isCard, targetsOf } from "./decide/card.js";
import { extendedThisTurn } from "./decide/turn-grants.js";
import { grappledBy, tokenForUuid } from "./geometry.js";
import { TURN_GRANTS, answers, turnGrantEntries, listedNames } from "./decide/registry.js";
import { grantRowFor, grantDue, grantTitle, featureGrantRows, blockingTypes, damagedSince } from "./decide/turn-grants.js";
import { riderPartFormula } from "./decide/clock.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { askHandOut } from "./rest-grants.js";
import { listen } from "./dispatch.js";

const GRANT_FLAG = "turnGrant";

/** The turns this client has paid: `combat|round|turn|effect`. The log is the durable copy. */
const paid = new Set();

/** The item a landed effect came from: shared.js's walk (the activity first — a tray-applied copy's `item`
 * names the pack, NOTES §2). */
const originItemOf = effect => effectSourceOf(effect)?.item ?? null;

const settledAt = place => game.messages.contents.some(m => m.getFlag(MODULE_ID, GRANT_FLAG)?.place === place);

/** The bearer's listed effects at one of its moments (`on`): each row's grant or damage, once per turn. */
function payEffects(actor, combat, { on, round, turn, why }) {
  const listed = listedNames(turnGrantEntries());
  for ( const effect of actor.effects ) {
    if ( effect.disabled ) continue;
    const item = originItemOf(effect);
    const row = grantRowFor({ table: TURN_GRANTS, item, effectName: effect.name, listed, answers, on });
    if ( !row ) continue;
    const place = `${combat.id}|${round}|${turn}|${on === "turnEnd" ? "end|" : ""}${effect.uuid}`;
    const due = grantDue({ paid, place: settledAt(place) ? null : place });
    if ( !due.due ) continue;
    if ( row.unlessFeature && featureNamed(actor, row.unlessFeature) ) continue;   // Persistent Rage: nothing to extend
    paid.add(place);
    if ( row.remind ) { void remindExtend({ effect, row, item, actor, place, combat, round, turn }); continue; }
    void pay({ effect, row, item, actor, place, why: why ?? due.why, on });
  }
}

/** When each combatant's turn began on THIS client (`combat|round|turn` → ms): the turn's own cards are those after. */
const turnBegan = new Map();
listen("updateCombat", "turn-grants", (combat, changes) => {
  if ( (!("turn" in changes) && !("round" in changes)) || !combat.started ) return;
  turnBegan.set(`${combat.id}|${combat.round}|${combat.turn}`, Date.now());
});

/**
 * A `remind: "extend"` row (Rage) at the bearer's turn END: nothing paid, nothing ended — a card when the turn
 * shows no attack roll at an enemy and no save forced on one. The turn the effect began is its own extension;
 * a turn this client never saw begin is left alone (never a reminder on a guess).
 */
async function remindExtend({ effect, row, item, actor, place, combat, round, turn }) {
  try {
    if ( chitStampOf(effect) === `${combat.id}:${round}:${turn}` ) return;
    const began = turnBegan.get(`${combat.id}|${round}|${turn}`);
    if ( !began ) return;
    const mine = game.messages.contents.filter(m => ((m.timestamp ?? 0) >= began) && (m.getAssociatedActor?.()?.uuid === actor.uuid));
    const side = actor.getActiveTokens?.()?.[0]?.document?.disposition ?? 0;
    const cards = mine.map(m => {
      const activity = cardActivity(m);
      const kind = isCard(m, CARD.attack) ? "attack" : ((activity?.type === "save") && !isCard(m, CARD.damage)) ? "save" : null;
      return kind ? { kind, sides: targetsOf(m).map(t => fromUuidSync(t.uuid)?.getActiveTokens?.()?.[0]?.document?.disposition ?? 0) } : null;
    }).filter(Boolean);
    const verdict = extendedThisTurn({ cards, side });
    if ( verdict.extended ) return;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({ img: item.img ?? null, eyebrow: "Turn end", tone: "neutral",
        title: `${row.key} — it ends now unless you extended it`,
        subtitle: `${actor.name} made ${verdict.why} this turn — ${row.says}; nothing is removed`,
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(actor.uuid), key: row.key, place, effectUuid: effect.uuid,
        actorUuid: actor.uuid, remind: row.remind, why: verdict.why } } }
    });
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "The"} reminder could not post.`, err);
  }
}

// The turn moved: the current combatant's listed effects and own traits pay at its turn START, and the
// combatant whose turn just ENDED pays its `on: "turnEnd"` rows — each on the bearer's driver, once per turn.
listen("updateCombat", "turn-grants", (combat, changes, options) => {
  try {
    if ( !("turn" in changes) && !("round" in changes) ) return;
    if ( !combat.started || (options?.direction === -1) ) return;
    const prev = combat.previous ?? null;
    const ended = prev?.combatantId ? (combat.combatants.get(prev.combatantId)?.actor ?? null) : null;
    if ( (ended instanceof Actor) && drivesMomentFor(ended.uuid) ) payEffects(ended, combat, { on: "turnEnd", round: prev.round, turn: prev.turn, why: "the end of its turn" });
    const actor = combat.combatant?.actor ?? null;
    if ( !(actor instanceof Actor) || !drivesMomentFor(actor.uuid) ) return;
    payEffects(actor, combat, { on: "turnStart", round: combat.round, turn: combat.turn, why: null });
    // The bearer's OWN traits (Regeneration, Barbed Hide): no effect to find, the sheet is the row.
    const listed = listedNames(turnGrantEntries());
    for ( const { key, row, item } of featureGrantRows({ table: TURN_GRANTS, features: actor.items.filter(i => i.type === "feat"), listed, answers, on: "turnStart" }) ) {
      if ( (row.while === "aboveZero") && !(Number(actor.system?.attributes?.hp?.value ?? 0) > 0) ) continue;
      if ( (row.while === "raging") && !raging(actor) ) continue;
      const place = `${combat.id}|${combat.round}|${combat.turn}|${item.uuid}${row.feature ? `|${key}` : ""}`;
      const due = grantDue({ paid, place: settledAt(place) ? null : place });
      if ( !due.due ) continue;
      if ( row.deals === "grappled" ) {
        const token = combat.combatant?.token?.object ?? tokenForUuid(actor.uuid);
        const held = grappledBy(actor, token).filter(c => c.certain);
        if ( !held.length ) continue;   // nothing held: nothing dealt, no card, the turn stays open
        paid.add(place);
        void dealToGrappled({ row: { key, ...row }, item, actor, place, held, why: due.why });
        continue;
      }
      paid.add(place);
      if ( row.to === "ally" ) { void giveToAlly({ row: { key, ...row }, item, actor }); continue; }
      const block = row.unless?.damagedBy ? blockedBy(actor, item, combat) : null;
      if ( block ) { void blockedCard({ row: { key, ...row }, item, actor, place, block }); continue; }
      void pay({ effect: null, row: { key, ...row }, item, actor, place, why: due.why, on: "turnStart" });
    }
  } catch(err) {
    console.error(`${TITLE} | Turn-start grant failed — apply it by hand.`, err);
  }
});

/** The bearer wears its Rage — an enabled effect of that name, the actor's own or its item's transferred copy. */
const raging = actor => (actor.appliedEffects ?? actor.effects?.contents ?? []).some(e => !e.disabled && (lower(e.name) === "rage"));

// A feature row `on: "use"` (Vitality Surge): the bearer's OWN use of the named item pays it, on the using client.
listen("dnd5e.postUseActivity", "turn-grants", (activity, _usageConfig, results) => {
  try {
    const actor = activity?.actor;
    const used = activity?.item;
    if ( !(actor instanceof Actor) || !used || !actor.isOwner ) return;
    const listed = listedNames(turnGrantEntries());
    for ( const { key, row, item } of featureGrantRows({ table: TURN_GRANTS, features: actor.items.filter(i => i.type === "feat"), listed, answers, on: "use" }) ) {
      if ( !row.of || !answers(row.of, used) ) continue;
      const place = `use|${results?.message?.id ?? activity.uuid}|${key}`;
      if ( paid.has(place) ) continue;
      paid.add(place);
      void pay({ effect: null, row: { key, ...row }, item, actor, place, why: `${used.name} used`, on: "use" });
    }
  } catch(err) {
    console.error(`${TITLE} | A grant on the use could not be read — apply it by hand.`, err);
  }
});

/** A `to: "ally"` row (Life-Giving Force): the amount rolled on the bearer's numbers, then GIVEN — the rest song's pick. */
async function giveToAlly({ row, item, actor }) {
  try {
    const activity = row.activity ? activityNamed(item, row.activity) : activityOfType(item, "heal");
    const h = activity?.healing ?? null;
    const raw = h ? riderPartFormula({ number: h.number, denomination: h.denomination, custom: h.custom, bonus: h.bonus }) : null;
    if ( !raw ) { console.warn(`${TITLE} | ${row.key}: no healing part on "${row.activity}" — give it by hand.`); return; }
    const roll = await new Roll(raw, activity.getRollData?.() ?? item.getRollData?.() ?? {}).evaluate();
    if ( !(roll.total > 0) ) return;
    await askHandOut(actor, { name: row.key, row, item, amount: roll.total, roll });
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "The gift"} could not be asked — give it by hand.`, err);
  }
}

/** A `deals` row's damage part: the row's activity, else the item's first damage activity. */
function damagePartOf(item, row) {
  const activity = row.activity ? activityNamed(item, row.activity) : activityOfType(item, "damage");
  const part = activity?.damage?.parts?.[0] ?? null;
  const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
  return { activity, raw, type: [...(part?.types ?? [])][0] ?? "bludgeoning" };
}

/** The grappler's row (Barbed Hide): its damage rolled once on its own numbers, landed on every creature it holds. */
async function dealToGrappled({ row, item, actor, place, held, why }) {
  try {
    const { activity, raw, type } = damagePartOf(item, row);
    if ( !raw ) { console.warn(`${TITLE} | ${row.key}: no damage part on "${row.activity ?? "its damage activity"}" — deal it by hand.`); return; }
    const roll = await new Roll(raw, activity.getRollData?.() ?? item.getRollData?.() ?? {}).evaluate();
    const targets = held.map(c => ({ uuid: c.uuid, name: c.name }));
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [roll],
      content: bfCard({ img: item.img ?? null, eyebrow: "Turn start", tone: "bad",
        title: `${row.key} — ${actor.name} deals ${roll.total} ${type} damage to ${targets.map(t => t.name).join(", ")}`,
        subtitle: `the creature${targets.length === 1 ? "" : "s"} it grapples — ${why}`,
        lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${row.caveat}</span>` : null] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(actor.uuid), key: row.key, place, effectUuid: null, actorUuid: actor.uuid,
        deals: "grappled", targets, formula: raw, total: roll.total, type, why } } }
    });
    if ( card ) await applyDamagesWithReceipt(card, targets, [{ value: roll.total, type, properties: new Set() }], { note: row.key });
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "The grappler's damage"} failed — deal it by hand.`, err);
  }
}

/** The `unless.damagedBy` judge: the types the bearer's copy names, against the receipts since its last turn. */
function blockedBy(actor, item, combat) {
  const labels = Object.fromEntries(Object.entries(CONFIG.DND5E.damageTypes ?? {}).map(([k, v]) => [k, v?.label ?? k]));
  const types = blockingTypes(item.system?.description?.value ?? "", labels);
  if ( !types.length ) return null;
  const entries = game.messages.contents.flatMap(m => m.getFlag(MODULE_ID, "receipt")?.targets ?? []);
  const verdict = damagedSince({ entries, uuid: actor.uuid, combatId: combat.id, round: combat.round, turn: combat.turn, types });
  return verdict.blocked ? { type: verdict.type, label: labels[verdict.type] ?? verdict.type, types } : null;
}

/** Nothing paid: the card says which damage stopped it (R5). No receipt — nothing landed. */
async function blockedCard({ row, item, actor, place, block }) {
  try {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: bfCard({ img: item.img ?? null, eyebrow: "Turn start", tone: "neutral",
        title: `${row.key} — ${actor.name} regains nothing this turn`,
        subtitle: `it took ${block.label} damage since its last turn`,
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(actor.uuid), key: row.key, place, effectUuid: null,
        actorUuid: actor.uuid, blocked: block.type, why: `took ${block.label} damage since its last turn` } } }
    });
  } catch(err) {
    console.error(`${TITLE} | ${row.key}'s card could not post.`, err);
  }
}

/** The grant: the activity's healing part as the pack wrote it, rolled on the CASTER's numbers (a feature
 * row's caster is the bearer itself), landed. A `deals` row: the damage part, rolled on the ORIGIN's numbers,
 * landed as damage on the bearer. */
async function pay({ effect, row, item, actor, place, why, on = "turnStart" }) {
  try {
    const deals = row.deals === true;
    const activity = deals ? damagePartOf(item, row).activity : (row.activity ? activityNamed(item, row.activity) : activityOfType(item, "heal"));
    const part = deals ? (activity?.damage?.parts?.[0] ?? null) : (activity?.healing ?? null);
    const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
    if ( !raw ) { console.warn(`${TITLE} | ${row.key}: no ${deals ? "damage" : "healing"} part on "${row.activity ?? (deals ? "its damage activity" : "its heal activity")}" — ${deals ? "deal" : "grant"} it by hand.`); return; }
    const caster = item.actor ?? null;
    const roll = await new Roll(raw, activity.getRollData?.() ?? item.getRollData?.() ?? {}).evaluate();
    const type = [...(part.types ?? [])][0] ?? (deals ? "bludgeoning" : "healing");
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster ?? actor }),
      rolls: deals ? [roll] : [],
      content: bfCard({ img: item.img ?? null, eyebrow: (on === "use") ? (row.of ?? "Use") : (on === "turnEnd") ? "Turn end" : "Turn start", tone: deals ? "bad" : "good",
        title: grantTitle({ spell: row.key, bearer: actor.name, total: roll.total, type, deals }),
        subtitle: effect ? `${effect.name} stands on ${actor.name} — ${why}` : `${actor.name}'s own ${row.key} — ${why}`,
        lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${row.caveat}</span>` : null] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(caster?.uuid ?? null), key: row.key, place, effectUuid: effect?.uuid ?? null,
        actorUuid: actor.uuid, formula: raw, total: roll.total, type, why, ...(deals ? { deals: true, on } : {}) } } }
    });
    if ( card ) await applyDamagesWithReceipt(card, [{ uuid: actor.uuid, name: actor.name }], [{ value: roll.total, type, properties: new Set() }], { note: row.key });
  } catch(err) {
    console.error(`${TITLE} | Turn-start grant failed — apply it by hand.`, err);
  }
}
