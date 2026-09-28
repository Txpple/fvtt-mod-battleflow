/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE TURN-START GRANT (TURN_GRANTS) — a landed effect whose
 * text pays the bearer at the start of each of its turns what the pack rolls once, at the cast
 * (Heroism's Temporary Hit Points): the origin item's activity is rolled again on the caster's numbers
 * and landed on the bearer with a receipt, no choice (R1). The precedent is the emanation's turn-start heal.
 */
import { MODULE_ID, TITLE, drivesMomentFor, statContext } from "./core.js";
import { activityNamed } from "./lookup.js";
import { effectSourceOf } from "./shared.js";
import { TURN_GRANTS, answers, turnGrantEntries, listedNames } from "./decide/registry.js";
import { grantRowFor, grantDue, grantTitle } from "./decide/turn-grants.js";
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
    for ( const effect of actor.effects ) {
      if ( effect.disabled ) continue;
      const item = originItemOf(effect);
      const row = grantRowFor({ table: TURN_GRANTS, item, effectName: effect.name, listed, answers });
      if ( !row ) continue;
      const place = `${combat.id}|${combat.round}|${combat.turn}|${effect.uuid}`;
      const settled = game.messages.contents.some(m => m.getFlag(MODULE_ID, GRANT_FLAG)?.place === place);
      const due = grantDue({ paid, place: settled ? null : place });
      if ( !due.due ) continue;
      paid.add(place);
      void pay({ effect, row, item, actor, place, why: due.why });
    }
  } catch(err) {
    console.error(`${TITLE} | Turn-start grant failed — apply it by hand.`, err);
  }
});

/** The grant: the activity's healing part as the pack wrote it, rolled on the CASTER's numbers, landed. */
async function pay({ effect, row, item, actor, place, why }) {
  try {
    const activity = activityNamed(item, row.activity);
    const part = activity?.healing ?? null;
    const raw = part ? riderPartFormula({ number: part.number, denomination: part.denomination, custom: part.custom, bonus: part.bonus }) : null;
    if ( !raw ) { console.warn(`${TITLE} | ${row.key}: no healing part on "${row.activity}" — grant it by hand.`); return; }
    const caster = item.actor ?? null;
    const roll = await new Roll(raw, activity.getRollData?.() ?? item.getRollData?.() ?? {}).evaluate();
    const type = [...(part.types ?? [])][0] ?? "healing";
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster ?? actor }),
      content: bfCard({ img: item.img ?? null, eyebrow: "Turn start", tone: "good",
        title: grantTitle({ spell: row.key, bearer: actor.name, total: roll.total, type }),
        subtitle: `${effect.name} stands on ${actor.name} — ${why}`,
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { [GRANT_FLAG]: { ...statContext(caster?.uuid ?? null), key: row.key, place, effectUuid: effect.uuid,
        actorUuid: actor.uuid, formula: raw, total: roll.total, type, why } } }
    });
    if ( card ) await applyDamagesWithReceipt(card, [{ uuid: actor.uuid, name: actor.name }], [{ value: roll.total, type, properties: new Set() }], { note: row.key });
  } catch(err) {
    console.error(`${TITLE} | Turn-start grant failed — apply it by hand.`, err);
  }
}
