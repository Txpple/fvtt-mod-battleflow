/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE TURN-START GRANT (TURN_GRANTS) — a landed effect whose
 * text pays the bearer at the start of each of its turns what the pack rolls once, at the cast
 * (Heroism's Temporary Hit Points): the origin item's activity is rolled again on the caster's numbers
 * and landed on the bearer with a receipt, no choice (R1). The precedent is the emanation's turn-start heal.
 * A `match: "feature"` row (Regeneration, the GM's side) is the bearer's OWN trait: its heal rolled on the bearer's
 * numbers, while it has at least 1 Hit Point, unless a damage type its own copy names was dealt to it since
 * its last turn started (the receipts) — then a card says why nothing is paid.
 */
import { MODULE_ID, TITLE, drivesMomentFor, statContext } from "./core.js";
import { activityNamed, activityOfType } from "./lookup.js";
import { effectSourceOf } from "./shared.js";
import { TURN_GRANTS, answers, turnGrantEntries, listedNames } from "./decide/registry.js";
import { grantRowFor, grantDue, grantTitle, featureGrantRows, blockingTypes, damagedSince } from "./decide/turn-grants.js";
import { riderPartFormula } from "./decide/clock.js";
import { bfCard, ruleLine } from "./decide/present.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { listen } from "./dispatch.js";

const GRANT_FLAG = "turnGrant";

/** The turns this client has paid: `combat|round|turn|effect`. The log is the durable copy. */
const paid = new Set();

/** The item a landed effect came from: shared.js's walk (the activity first — a tray-applied copy's `item`
 * names the pack, NOTES §2). */
const originItemOf = effect => effectSourceOf(effect)?.item ?? null;

// The turn moved: the current combatant's listed effects pay, on the bearer's driver, once per turn.
listen("updateCombat", "turn-grants", (combat, changes, options) => {
  try {
    if ( !("turn" in changes) && !("round" in changes) ) return;
    if ( !combat.started || (options?.direction === -1) ) return;
    const actor = combat.combatant?.actor ?? null;
    if ( !(actor instanceof Actor) || !drivesMomentFor(actor.uuid) ) return;
    const listed = listedNames(turnGrantEntries());
    const settledAt = place => game.messages.contents.some(m => m.getFlag(MODULE_ID, GRANT_FLAG)?.place === place);
    for ( const effect of actor.effects ) {
      if ( effect.disabled ) continue;
      const item = originItemOf(effect);
      const row = grantRowFor({ table: TURN_GRANTS, item, effectName: effect.name, listed, answers });
      if ( !row ) continue;
      const place = `${combat.id}|${combat.round}|${combat.turn}|${effect.uuid}`;
      const due = grantDue({ paid, place: settledAt(place) ? null : place });
      if ( !due.due ) continue;
      paid.add(place);
      void pay({ effect, row, item, actor, place, why: due.why });
    }
    // The bearer's OWN traits (Regeneration): no effect to find, the sheet is the row.
    for ( const { key, row, item } of featureGrantRows({ table: TURN_GRANTS, features: actor.items.filter(i => i.type === "feat"), listed, answers }) ) {
      if ( (row.while === "aboveZero") && !(Number(actor.system?.attributes?.hp?.value ?? 0) > 0) ) continue;
      const place = `${combat.id}|${combat.round}|${combat.turn}|${item.uuid}`;
      const due = grantDue({ paid, place: settledAt(place) ? null : place });
      if ( !due.due ) continue;
      paid.add(place);
      const block = row.unless?.damagedBy ? blockedBy(actor, item, combat) : null;
      if ( block ) { void blockedCard({ row: { key, ...row }, item, actor, place, block }); continue; }
      void pay({ effect: null, row: { key, ...row }, item, actor, place, why: due.why });
    }
  } catch(err) {
    console.error(`${TITLE} | Turn-start grant failed — apply it by hand.`, err);
  }
});

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
 * row's caster is the bearer itself), landed. */
async function pay({ effect, row, item, actor, place, why }) {
  try {
    const activity = row.activity ? activityNamed(item, row.activity) : activityOfType(item, "heal");
    const part = activity?.healing ?? null;
    const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
    if ( !raw ) { console.warn(`${TITLE} | ${row.key}: no healing part on "${row.activity ?? "its heal activity"}" — grant it by hand.`); return; }
    const caster = item.actor ?? null;
    const roll = await new Roll(raw, activity.getRollData?.() ?? item.getRollData?.() ?? {}).evaluate();
    const type = [...(part.types ?? [])][0] ?? "healing";
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster ?? actor }),
      content: bfCard({ img: item.img ?? null, eyebrow: "Turn start", tone: "good",
        title: grantTitle({ spell: row.key, bearer: actor.name, total: roll.total, type }),
        subtitle: effect ? `${effect.name} stands on ${actor.name} — ${why}` : `${actor.name}'s own ${row.key} — ${why}`,
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(caster?.uuid ?? null), key: row.key, place, effectUuid: effect?.uuid ?? null,
        actorUuid: actor.uuid, formula: raw, total: roll.total, type, why } } }
    });
    if ( card ) await applyDamagesWithReceipt(card, [{ uuid: actor.uuid, name: actor.name }], [{ value: roll.total, type, properties: new Set() }], { note: row.key });
  } catch(err) {
    console.error(`${TITLE} | Turn-start grant failed — apply it by hand.`, err);
  }
}
