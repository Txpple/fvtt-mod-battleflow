/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE DRAIN (DRAINS) — a monster's attack whose damage, once it
 * has LANDED, lowers the target: its Hit Point maximum by what landed (Life Drain, Proboscis), or an ability
 * score by the die its text names (Draining Swipe). Vampiric Touch's seam (heal-on-hit.js): `dnd5e.applyDamage`,
 * the dealing card's activity answers the row, the amount TAKEN of the row's type is written as an effect on
 * the target — the pack's own where it ships one ("Hit: STR Score −N"), else the module's (`hp.tempmax`,
 * one copy per row, refreshed with the total) — receipted on the drain's own card, once per creature per
 * card, no choice (R1). Rulings: RULINGS *The Monster Manual — the waiting rows built*.
 */
import { MODULE_ID, TITLE, canApplyTo, whisperNoGM, queueFlagWrite, statContext } from "./core.js";
import { cardActivity } from "./lookup.js";
import { damagePartsOf, statSourceOf } from "./shared.js";
import { DRAINS, tableIndex, drainEntries, listedNames } from "./decide/registry.js";
import { drainAmount, drainDieFrom, drainEffectData, drainTitle } from "./decide/drains.js";
import { bfCard, esc, ruleLine } from "./decide/present.js";
import { applyEffectsWithReceipt } from "./effect-riders.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const DRAIN_FLAG = "drain";
const { rowFor } = tableIndex(DRAINS);
const draining = new Set();

listen("dnd5e.applyDamage", "drains", (actor, amount, options) => {
  try {
    if ( !(Number(amount) > 0) || !(actor instanceof Actor) ) return;
    const origin = options?.originatingMessage;
    if ( !(origin instanceof ChatMessage) ) return;
    if ( !listedNames(drainEntries()).size ) return;
    const activity = cardActivity(origin);
    const row = activity?.item ? rowFor(activity.item) : null;
    if ( !row || !listedNames(drainEntries()).has(row.key.toLowerCase()) ) return;
    const attacker = activity.item.actor ?? activity.actor ?? null;
    if ( !(attacker instanceof Actor) || (attacker.uuid === actor.uuid) ) return;
    void drain({ row, activity, attacker, target: actor, taken: Number(amount), origin });
  } catch(err) {
    console.error(`${TITLE} | The drain failed — lower the target by hand.`, err);
  }
});

/** The drain: claimed on the dealing card per creature, the effect written from what landed, receipted on its own card. */
async function drain({ row, activity, attacker, target, taken, origin }) {
  const key = `${origin.id}|${target.uuid}`;
  if ( draining.has(key) ) return;
  draining.add(key);
  try {
    let claimed = false;
    if ( origin.canUserModify?.(game.user, "update") ) {
      await queueFlagWrite(origin, DRAIN_FLAG, current => {
        current.key ??= row.key;
        current.done ??= [];
        if ( current.done.includes(target.uuid) ) return false;
        current.done.push(target.uuid);
        claimed = true;
      });
    } else claimed = !(origin.getFlag(MODULE_ID, DRAIN_FLAG)?.done ?? []).includes(target.uuid);
    if ( !claimed ) return;
    if ( !canApplyTo(target) ) { await whisperNoGM(`${row.key}'s drain on ${target.name}`, "Lower it by hand from the card."); return; }
    const item = activity.item;
    if ( row.what === "ability" ) return drainScore({ row, item, attacker, target, origin });
    const verdict = drainAmount(row, { taken, parts: damagePartsOf(origin.rolls ?? []) });
    if ( !verdict.drains ) return;
    // One copy per row on the bearer: the prior total joins, the old copy goes, the new one lands receipted.
    // The tray's copy takes its own id: the one copy is found by the module's flag on it.
    const prior = [...target.effects].find(e => e.getFlag(MODULE_ID, DRAIN_FLAG)?.key === row.key) ?? null;
    const before = Number(prior?.getFlag(MODULE_ID, DRAIN_FLAG)?.amount ?? 0) || 0;
    const total = before + verdict.amount;
    if ( prior ) await prior.delete();
    const template = new ActiveEffect.implementation(drainEffectData({ key: row.key, amount: total, img: item.img ?? null, moduleId: MODULE_ID }), { parent: item });
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: bfCard({ img: item.img ?? null, eyebrow: `${row.key} — the drain`, tone: "bad",
        title: drainTitle({ key: row.key, target: target.name, what: "max", amount: verdict.amount, total }),
        subtitle: `${taken} damage landed · ${verdict.why}`,
        lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${esc(row.caveat)}</span>` : null] }),
      flags: { [MODULE_ID]: { [DRAIN_FLAG]: { ...statContext(attacker.uuid), key: row.key, what: "max", attackerUuid: attacker.uuid, targetUuid: target.uuid, targetName: target.name,
        taken, amount: verdict.amount, total, why: verdict.why, originId: origin.id } } }
    });
    if ( card ) await applyEffectsWithReceipt(card, [template], [{ uuid: target.uuid, name: target.name }], { source: statSourceOf(origin) ?? attacker.uuid });
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "The drain"} could not land — lower the target by hand.`, err);
  } finally {
    draining.delete(key);
  }
}

/** A score row (Draining Swipe): the die off the item's text rolled on the attacker, the pack's own "−N" effect landed, the total kept. */
async function drainScore({ row, item, attacker, target, origin }) {
  const die = (row.amount === "text") ? drainDieFrom(item.system?.description?.value ?? "") : (row.amount ?? null);
  if ( !die ) { console.warn(`${TITLE} | ${row.key}: no die in its text — lower the score by hand.`); return; }
  const roll = await new Roll(die, attacker.getRollData()).evaluate();
  const ability = String(row.ability ?? "str").toUpperCase();
  const prior = [...target.effects].find(e => e.getFlag(MODULE_ID, DRAIN_FLAG)?.key === row.key) ?? null;
  const before = Number(prior?.getFlag(MODULE_ID, DRAIN_FLAG)?.amount ?? 0) || 0;
  const total = before + roll.total;
  // The pack ships one effect per step ("Hit: STR Score −1" … "−4"); past the last, the deepest stands and the card says so.
  const steps = [...(item.effects ?? [])].filter(e => new RegExp(`^Hit:\\s*${ability}\\s*Score\\s*-\\d+`, "i").test(e.name))
    .map(e => ({ e, n: Number(/-(\d+)/.exec(e.name)?.[1] ?? 0) })).sort((a, b) => a.n - b.n);
  const pick = steps.filter(s => s.n <= total).pop() ?? steps[0] ?? null;
  if ( !pick ) { console.warn(`${TITLE} | ${row.key}: the pack ships no "Hit: ${ability} Score −N" effect — lower the score by hand.`); return; }
  if ( prior ) await prior.delete();
  const data = pick.e.toObject();
  Object.assign(data, { transfer: false, disabled: false, flags: { ...(data.flags ?? {}), [MODULE_ID]: { ...(data.flags?.[MODULE_ID] ?? {}), [DRAIN_FLAG]: { key: row.key, amount: total } } } });
  const template = new ActiveEffect.implementation(data, { parent: item });
  const capped = pick.n < total;
  const card = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    rolls: [roll],
    content: bfCard({ img: item.img ?? null, eyebrow: `${row.key} — the drain`, tone: "bad",
      title: drainTitle({ key: row.key, target: target.name, what: "ability", amount: roll.total, total, ability: CONFIG.DND5E.abilities[row.ability]?.label ?? ability }),
      subtitle: capped ? `the pack's deepest step is −${pick.n} — the rest by hand` : `${die} rolled on ${attacker.name}`,
      lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${esc(row.caveat)}</span>` : null] }),
    flags: { [MODULE_ID]: { [DRAIN_FLAG]: { ...statContext(attacker.uuid), key: row.key, what: "ability", ability: row.ability, attackerUuid: attacker.uuid, targetUuid: target.uuid, targetName: target.name,
      die, amount: roll.total, total, capped, originId: origin.id } } }
  });
  if ( card ) await applyEffectsWithReceipt(card, [template], [{ uuid: target.uuid, name: target.name }], { source: statSourceOf(origin) ?? attacker.uuid });
}

// The dealing card's own line: who was drained.
listen("dnd5e.renderChatMessage", "drains", (message, html) => {
  try {
    const d = message.getFlag(MODULE_ID, DRAIN_FLAG);
    if ( !d?.done?.length ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-drain-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-drain-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-arrow-down-wide-short"></i> ${esc(`${d.key} — the drain landed (its own card)`)}`;
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The drain line could not render.`, err); }
});
