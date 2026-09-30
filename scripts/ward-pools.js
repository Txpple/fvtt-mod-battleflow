/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE WARD POOLS (WARD_POOLS — Arcane Ward). The ward takes the
 * damage before its bearer at `dnd5e.preApplyDamage` (the amount after Resistances, the rule's order), so every
 * applier carries it — the module's and the card's own buttons; the pop rides the actor's update to every
 * client, the take rides the apply options to the receipt. An Abjuration cast from a slot creates or refills it.
 */
import { MODULE_ID, TITLE } from "./core.js";
import { activityNamed, featureNamed, lower } from "./lookup.js";
import { WARD_POOLS, listedNames, wardPoolEntries } from "./decide/registry.js";
import { afterWard, wardAbsorb, wardRefill } from "./decide/ward-pools.js";
import { castLevelOf } from "./decide/eligible.js";
import { esc } from "./decide/present.js";
import { driftChip } from "./dice-rise.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const WARD = "bfWard";            // on the apply options, client-local — the receipt reads it
const POOL_FLAG = "wardPool";     // B4 — on the warded creature's effect (Bastion of Law): { feature, left, max }
const WARD_TAKE_FLAG = "wardAbsorb";   // on the actor's own damage update — the pop, every client
const REFILL_FLAG = "wardRefill"; // on the cast's usage card — its line
const HP = "system.attributes.hp.value";
const TEMP = "system.attributes.hp.temp";

/** The listed ward this creature holds: `{ name, row, item }` (the feature's own uses the pool), or null. */
function wardOf(actor) {
  if ( !(actor instanceof Actor) ) return null;
  const listed = listedNames(wardPoolEntries());
  for ( const [name, row] of Object.entries(WARD_POOLS) ) {
    if ( !listed.has(lower(name)) || (row.pool !== "uses") ) continue;
    const item = featureNamed(actor, name);
    if ( item && (Number(item.system?.uses?.max) > 0) ) return { name, row, item };
  }
  return null;
}

/** B4 — an EFFECT pool this creature wears (Bastion of Law's "Warded by Law"): `{ name, row, effect, pool }` or null. */
function effectWardOf(actor) {
  if ( !(actor instanceof Actor) ) return null;
  const listed = listedNames(wardPoolEntries());
  for ( const [name, row] of Object.entries(WARD_POOLS) ) {
    if ( !listed.has(lower(name)) || (row.pool !== "effect") ) continue;
    const effect = actor.effects.find(e => !e.disabled && (lower(e.name) === lower(row.effect)) && e.getFlag(MODULE_ID, POOL_FLAG));
    if ( effect ) return { name, row, effect, pool: effect.getFlag(MODULE_ID, POOL_FLAG) };
  }
  return null;
}

const usesOf = item => ({ value: Number(item.system?.uses?.value ?? 0), max: Number(item.system?.uses?.max ?? 0),
  spent: Number(item.system?.uses?.spent ?? 0) });

/* --- THE TAKE ------------------------------------------------------------------------------------ */

listen("dnd5e.preApplyDamage", "ward-pools", (actor, amount, updates, options) => {
  try {
    if ( !(actor instanceof Actor) || !(Number(amount) > 0) || !updates || !(HP in updates) ) return;
    const found = wardOf(actor);
    const worn = found ? null : effectWardOf(actor);
    if ( !found && !worn ) return;
    const uses = found ? usesOf(found.item) : { value: Number(worn.pool.left ?? 0), max: Number(worn.pool.max ?? 0), spent: 0 };
    if ( !(uses.value > 0) ) return;   // at 0 it absorbs nothing, its magic remains
    const { took, left } = wardAbsorb({ amount, ward: uses.value });
    if ( !took ) return;
    if ( worn ) {
      // B4 — the effect pool: the take written on the effect; at 0 the effect ends (the ward is spent).
      const next = afterWard({ left, value: actor.system.attributes.hp.value, temp: actor.system.attributes.hp.temp ?? 0, damage: actor.system.attributes.hp.damage ?? 0, tempMax: 0, granted: 0 });
      updates[HP] = next.value;
      updates[TEMP] = next.temp;
      const take = { feature: worn.name, took, left, value: uses.value - took, max: uses.max };
      updates[`flags.${MODULE_ID}.${WARD_TAKE_FLAG}`] = { ...take, at: Date.now() };
      if ( options ) options[WARD] = { ...take, effectUuid: worn.effect.uuid };
      const write = (uses.value - took > 0)
        ? worn.effect.update({ [`flags.${MODULE_ID}.${POOL_FLAG}`]: { ...worn.pool, left: uses.value - took }, name: `${worn.row.effect} (${uses.value - took})` })
        : worn.effect.delete();
      void write.catch(err => console.error(`${TITLE} | ${worn.name} took ${took} but its ward could not be lowered — adjust by hand.`, err));
      return;
    }
    const hp = actor.system.attributes.hp;
    const tempMax = Number(actor.system._source.attributes.hp.tempmax ?? 0) - Number(updates["system.attributes.hp.tempmax"] ?? actor.system._source.attributes.hp.tempmax ?? 0);
    // Temporary Hit Points this damage GRANTS stand: dnd5e raised the update's temp past what the damage left.
    const spentTemp = Math.min(Number(hp.temp ?? 0), Number(amount));
    const granted = (Number(updates[TEMP] ?? 0) > (Number(hp.temp ?? 0) - spentTemp)) ? Number(updates[TEMP]) : 0;
    const next = afterWard({ left, value: hp.value, temp: hp.temp ?? 0, damage: hp.damage ?? 0, tempMax, granted });
    updates[HP] = next.value;
    updates[TEMP] = next.temp;
    const take = { feature: found.name, took, left, value: uses.value - took, max: uses.max };
    updates[`flags.${MODULE_ID}.${WARD_TAKE_FLAG}`] = { ...take, at: Date.now() };
    if ( options ) options[WARD] = { ...take, itemUuid: found.item.uuid };
    void found.item.update({ "system.uses.spent": uses.spent + took })
      .catch(err => console.error(`${TITLE} | ${found.name} took ${took} but its hit points could not be spent — lower them by hand.`, err));
  } catch(err) {
    console.error(`${TITLE} | The ward could not take the damage — it landed whole; adjust by hand.`, err);
  }
});

const popped = new Set();
listen("updateActor", "ward-pools", (actor, changes) => {
  try {
    // ⚠ The update carries only what CHANGED: read the actor's flag.
    if ( !changes?.flags?.[MODULE_ID]?.[WARD_TAKE_FLAG] ) return;
    const take = actor.getFlag?.(MODULE_ID, WARD_TAKE_FLAG);
    if ( !take?.took || !take.at || ((Date.now() - take.at) > 10_000) ) return;
    const key = `${actor.uuid}|${take.at}`;
    if ( popped.has(key) ) return;
    popped.add(key);
    for ( const token of actor.getActiveTokens?.(true) ?? [] ) driftChip(token, token, `−${take.took} ${take.feature}`);
  } catch(err) { console.warn(`${TITLE} | The ward's take could not draw.`, err); }
});

/* --- THE CAST: created on the first slot-cast of the school after a Long Rest, else refilled ------------ */

// B4 — the effect pool's CREATE (Bastion of Law's Create Shield): the sorcerer's use, one die per Sorcery Point spent (the
// use's scaling), the pack's effect landed on the targeted creature (else the sorcerer) carrying the pool.
listen("dnd5e.postUseActivity", "ward-pools", (activity, usageConfig, results) => {
  try {
    const item = activity?.item;
    const actor = activity?.actor;
    if ( (item?.type !== "feat") || !(actor instanceof Actor) || !actor.isOwner ) return;
    const listed = listedNames(wardPoolEntries());
    const found = Object.entries(WARD_POOLS).find(([name, row]) => (row.pool === "effect") && listed.has(lower(name))
      && featureNamed(actor, name)?.id === item.id && row.create && (lower(activity.name ?? "") === lower(row.create)));
    if ( !found ) return;
    void createEffectWard(found[0], found[1], activity, usageConfig, results?.message ?? null, actor);
  } catch(err) {
    console.error(`${TITLE} | The ward could not be created — place it by hand.`, err);
  }
});

async function createEffectWard(name, row, activity, usageConfig, message, actor) {
  const points = 1 + Math.max(0, Number(usageConfig?.scaling) || 0);
  const roll = await new Roll(`${points}d${Number(row.die) || 8}`).evaluate();
  const total = Math.max(0, Number(roll.total) || 0);
  const picked = [...game.user.targets].map(t => t.actor).filter(a => a instanceof Actor);
  const bearer = picked[0] ?? actor;
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${name} — ${points}d${Number(row.die) || 8} ward on ${bearer.name}` });
  const source = [...(activity.effects ?? [])].map(e => e.effect).find(e => e && (lower(e.name) === lower(row.effect)))
    ?? activity.item.effects.find(e => lower(e.name) === lower(row.effect)) ?? null;
  const stale = bearer.effects.filter(e => (lower(e.name).startsWith(lower(row.effect))) && e.getFlag(MODULE_ID, POOL_FLAG)).map(e => e.id);
  if ( stale.length ) await bearer.deleteEmbeddedDocuments("ActiveEffect", stale).catch(() => {});
  const data = source ? source.toObject() : { name: row.effect, img: activity.item.img, changes: [] };
  delete data._id;
  await ActiveEffect.implementation.create({ ...data, name: `${row.effect} (${total})`, origin: activity.uuid, transfer: false, disabled: false,
    flags: { ...(data.flags ?? {}), [MODULE_ID]: { ...(data.flags?.[MODULE_ID] ?? {}), [POOL_FLAG]: { feature: name, left: total, max: total, sourceUuid: actor.uuid } } } },
    { parent: bearer });
  if ( message?.isOwner ) await message.setFlag(MODULE_ID, REFILL_FLAG, { feature: name, created: true, gained: total, value: total, max: total, bearer: bearer.name });
}

listen("dnd5e.postUseActivity", "ward-pools", (activity, usageConfig, results) => {
  try {
    const item = activity?.item;
    if ( (item?.type !== "spell") || !(Number(item.system?.level) > 0) ) return;
    if ( ["innate", "atwill"].includes(String(item.system?.method ?? "")) ) return;
    if ( (activity.consumption?.spellSlot === false) || (usageConfig?.consume?.spellSlot === false) ) return;
    const actor = activity.actor;
    const found = wardOf(actor);
    if ( !found?.row.refill || (lower(item.system?.school) !== found.row.refill.school) || !actor.isOwner ) return;
    void castOnWard(found, activity, usageConfig, results?.message ?? null);
  } catch(err) {
    console.error(`${TITLE} | The ward's refill could not be read — restore it from the sheet.`, err);
  }
});

async function castOnWard(found, activity, usageConfig, message) {
  const creator = found.row.create ? activityNamed(found.item, found.row.create) : null;
  const create = !!creator && (Number(creator.uses?.value ?? 0) > 0);
  const uses = usesOf(found.item);
  const slot = Number(message?.system?.spellLevel ?? message?.system?.level) || castLevelOf(activity, usageConfig);
  const { value, gained } = wardRefill({ value: uses.value, max: uses.max, slot, per: found.row.refill.per, create });
  if ( create ) await creator.update({ "uses.spent": Number(creator.uses?.spent ?? 0) + 1 });
  if ( gained ) await found.item.update({ "system.uses.spent": Math.max(0, uses.max - value) });
  if ( message?.isOwner ) await message.setFlag(MODULE_ID, REFILL_FLAG, { feature: found.name, created: create, gained, value, max: uses.max });
}

listen("dnd5e.renderChatMessage", "ward-pools", (message, html) => {
  try {
    const r = message.getFlag(MODULE_ID, REFILL_FLAG);
    if ( !r ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-ward-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-ward-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    const said = r.created ? `${r.feature} — created, ${r.value} hit points (of ${r.max})${r.bearer ? ` on ${r.bearer}` : ""}`
      : r.gained ? `${r.feature} — +${r.gained} (${r.value} of ${r.max})` : `${r.feature} — full (${r.value} of ${r.max})`;
    div.innerHTML = `<i class="fa-solid fa-shield-halved" data-tooltip="${esc(r.feature)}"></i> ${esc(said)}`;
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The ward's line could not render.`, err); }
});
