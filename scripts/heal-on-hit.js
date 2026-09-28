/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE HEAL ON HIT (HEAL_ON_HIT) — a spell whose landed damage
 * heals its caster a share of it (Vampiric Touch; Lifedrinker's shape, SWEEP §3 item 4). The seam is
 * `dnd5e.applyDamage`: the dealing card's activity answers the row, the amount TAKEN of the row's type
 * pays the caster with a receipt on the same card, once per creature per card, no choice (R1).
 * Rulings: RULINGS *The spells slice — the held spells*.
 */
import { MODULE_ID, TITLE, canApplyTo, whisperNoGM, queueFlagWrite } from "./core.js";
import { cardActivity } from "./lookup.js";
import { damagePartsOf } from "./shared.js";
import { HEAL_ON_HIT, tableIndex, healOnHitEntries, listedNames } from "./decide/registry.js";
import { healOnHitAmount, healOnHitTitle } from "./decide/heal-on-hit.js";
import { bfCard, esc, ruleLine } from "./decide/present.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const HEAL_ON_HIT_FLAG = "healOnHit";
const { rowFor } = tableIndex(HEAL_ON_HIT);
const healing = new Set();

listen("dnd5e.applyDamage", "heal-on-hit", (actor, amount, options) => {
  try {
    if ( !(Number(amount) > 0) || !(actor instanceof Actor) ) return;
    const origin = options?.originatingMessage;
    if ( !(origin instanceof ChatMessage) ) return;
    if ( !listedNames(healOnHitEntries()).size ) return;
    const activity = cardActivity(origin);
    const row = activity?.item ? rowFor(activity.item) : null;
    if ( !row || !listedNames(healOnHitEntries()).has(row.key.toLowerCase()) ) return;
    const caster = activity.item.actor ?? activity.actor ?? null;
    if ( !(caster instanceof Actor) || (caster.uuid === actor.uuid) ) return;
    void heal({ row, activity, caster, target: actor, taken: Number(amount), origin });
  } catch(err) {
    console.error(`${TITLE} | The heal on hit failed — heal the caster by hand.`, err);
  }
});

/** The heal: claimed on the dealing card per creature, rolled from what landed, receipted on that card. */
async function heal({ row, activity, caster, target, taken, origin }) {
  const key = `${origin.id}|${target.uuid}`;
  if ( healing.has(key) ) return;
  healing.add(key);
  try {
    let claimed = false;
    if ( origin.canUserModify?.(game.user, "update") ) {
      await queueFlagWrite(origin, HEAL_ON_HIT_FLAG, current => {
        current.key ??= row.key;
        current.done ??= [];
        if ( current.done.includes(target.uuid) ) return false;
        current.done.push(target.uuid);
        claimed = true;
      });
    } else claimed = !(origin.getFlag(MODULE_ID, HEAL_ON_HIT_FLAG)?.done ?? []).includes(target.uuid);
    if ( !claimed ) return;
    const verdict = healOnHitAmount(row, { taken, parts: damagePartsOf(origin.rolls ?? []) });
    if ( !verdict.heals ) return;
    if ( !canApplyTo(caster) ) { await whisperNoGM(`${row.key}'s heal (${verdict.amount} to ${caster.name})`, "Heal by hand from the card."); return; }
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: bfCard({ img: activity.item.img ?? null, eyebrow: `${row.key} — the heal`, tone: "good",
        title: healOnHitTitle({ spell: row.key, caster: caster.name, amount: verdict.amount, target: target.name }),
        subtitle: `${taken} ${row.type ?? ""} damage landed · ${verdict.why}`.replace(/\s+/g, " "),
        lines: [ruleLine(row.rule)] }),
      flags: { [MODULE_ID]: { [HEAL_ON_HIT_FLAG]: { key: row.key, casterUuid: caster.uuid, targetUuid: target.uuid, targetName: target.name,
        taken, amount: verdict.amount, why: verdict.why, originId: origin.id, sourceUuid: caster.uuid } } }
    });
    if ( card ) await applyDamagesWithReceipt(card, [{ uuid: caster.uuid, name: caster.name }], [{ value: verdict.amount, type: "healing", properties: new Set() }], { note: row.key });
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "The heal on hit"} could not land — heal by hand.`, err);
  } finally {
    healing.delete(key);
  }
}

// The dealing card's own line: who paid the caster.
listen("dnd5e.renderChatMessage", "heal-on-hit", (message, html) => {
  try {
    const h = message.getFlag(MODULE_ID, HEAL_ON_HIT_FLAG);
    if ( !h?.done?.length ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-heal-on-hit-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-heal-on-hit-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-heart-pulse"></i> ${esc(`${h.key} — the caster regains half the damage that landed (its own card)`)}`;
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The heal-on-hit line could not render.`, err); }
});
