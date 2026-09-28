/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE DAMAGE SHARE (DAMAGE_SHARES) — a standing effect whose
 * caster takes what its bearer takes (Warding Bond). The seam is `dnd5e.applyDamage`, the rebukes': the
 * amount that LANDED on the bearer is applied to the caster with a receipt on the same card, no choice (R1);
 * beyond the bond's reach a card says so; the caster at 0 Hit Points ends it. Rulings: RULINGS *The spells
 * slice — the held spells*.
 */
import { MODULE_ID, TITLE, canApplyTo, whisperNoGM, statContext } from "./core.js";
import { effectSourceOf } from "./shared.js";
import { DAMAGE_SHARES, answers, damageShareEntries, listedNames } from "./decide/registry.js";
import { repeatRowFor, needsFloat } from "./decide/repeat-saves.js";
import { shareVerdict, shareTitle, shareEnds } from "./decide/damage-shares.js";
import { nearestFeet, tokenForUuid } from "./geometry.js";
import { bfCard, esc, ruleLine } from "./decide/present.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const SHARE_FLAG = "damageShare";

/** The listed bond rows standing on this creature, each with its effect, item and caster. */
function bondsOn(actor) {
  if ( !(actor instanceof Actor) ) return [];
  const listed = listedNames(damageShareEntries());
  const out = [];
  for ( const effect of actor.effects ) {
    if ( !effect.active ) continue;
    const source = effectSourceOf(effect);
    const row = repeatRowFor({ table: DAMAGE_SHARES, item: source?.item ?? null, effectName: effect.name, listed, answers });
    if ( row ) out.push({ row, effect, item: source.item, caster: source.actor });
  }
  return out;
}

/** The shortest distance between ANY token of the bearer and ANY of the caster on the canvas (a linked actor
 * may stand twice); null when either has none, or the map is unreadable. */
function nearestDistance(bearer, caster) {
  const of = actor => (canvas?.tokens?.placeables ?? []).filter(t => t.actor?.uuid === actor.uuid);
  const a = of(bearer), b = of(caster);
  if ( !a.length || !b.length ) return (tokenForUuid(bearer.uuid) && tokenForUuid(caster.uuid)) ? null : null;
  let best = null;
  for ( const x of a ) for ( const y of b ) {
    const d = nearestFeet(x, y);
    if ( (d !== null) && ((best === null) || (d < best)) ) best = d;
  }
  return best;
}

/* --- the seam: damage landed on a bonded creature ---------------------------------------------- */

const sharing = new Set();

listen("dnd5e.applyDamage", "damage-shares", (actor, amount, options) => {
  try {
    if ( !(Number(amount) > 0) || !(actor instanceof Actor) ) return;
    const origin = options?.originatingMessage;
    // The caster's own share arrives from a card of this machine's: never shared on.
    if ( (origin instanceof ChatMessage) && origin.getFlag(MODULE_ID, SHARE_FLAG) ) return;
    if ( !listedNames(damageShareEntries()).size ) return;
    for ( const bond of bondsOn(actor) ) void share(bond, actor, Number(amount), origin instanceof ChatMessage ? origin : null);
  } catch(err) {
    console.error(`${TITLE} | The damage share failed — apply the caster's share by hand.`, err);
  }
});

/** The share: the row's verdict, the caster's damage receipted on the landing card (or one of this file's). */
async function share({ row, effect, item, caster }, bearer, amount, origin) {
  const key = `${origin?.id ?? "bare"}|${effect.uuid}|${amount}|${Date.now() >> 10}`;
  if ( sharing.has(key) ) return;
  sharing.add(key);
  try {
    if ( !(caster instanceof Actor) || (caster.uuid === bearer.uuid) ) return;
    const distanceFeet = nearestDistance(bearer, caster);
    const casterHp = Number(caster.system?.attributes?.hp?.value ?? 0);
    const verdict = shareVerdict(row, { amount, distanceFeet, casterHp });
    const card = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: bfCard({
        img: item?.img ?? null, eyebrow: `${row.key} — the bond`, tone: verdict.shares ? "bad" : "neutral",
        title: verdict.shares ? shareTitle({ spell: row.key, bearer: bearer.name, caster: caster.name, amount: verdict.amount })
          : `${row.key} — ${caster.name} takes nothing: ${verdict.why}`,
        subtitle: verdict.shares ? `${amount} landed on ${bearer.name}${(distanceFeet !== null) ? ` · ${distanceFeet} ft apart` : ""} · ${verdict.why}` : `${amount} landed on ${bearer.name}`,
        lines: [ruleLine(row.rule), row.caveat ? `<span style="opacity:0.8;">${esc(row.caveat)}</span>` : null]
      }),
      flags: { [MODULE_ID]: { [SHARE_FLAG]: { ...statContext(caster.uuid), key: row.key, bearerUuid: bearer.uuid, bearerName: bearer.name,
        casterUuid: caster.uuid, effectId: effect.id, landed: amount, amount: verdict.amount, shares: verdict.shares, why: verdict.why,
        distanceFeet, originId: origin?.id ?? null } } }
    });
    if ( !card ) return;
    if ( !canApplyTo(caster) ) {
      if ( verdict.shares ) await whisperNoGM(`${row.key}'s share (${verdict.amount} to ${caster.name})`, "Apply it by hand from the card.");
      return;
    }
    if ( verdict.shares ) {
      // Untyped: the same NUMBER, never a second pass through the caster's resistances.
      await applyDamagesWithReceipt(card, [{ uuid: caster.uuid, name: caster.name }], [{ value: verdict.amount, type: "", properties: new Set() }], { note: row.key });
    }
    const ends = shareEnds(row, { casterHp: Number(caster.system?.attributes?.hp?.value ?? 0) });
    if ( ends.ends && canApplyTo(bearer) && bearer.effects.get(effect.id) ) await endBond(card, bearer, effect, ends.why);
  } catch(err) {
    console.error(`${TITLE} | ${row?.key ?? "The bond"}'s share could not land — apply it by hand.`, err);
  } finally {
    sharing.delete(key);
  }
}

/** The bond's end: the effect goes (the platform floats a changed effect; a bare one is floated here) and the card says why. */
async function endBond(card, bearer, effect, why) {
  const floats = needsFloat({ statuses: effect.statuses, changes: effect.changes ?? [] });
  await effect.delete();
  if ( floats ) {
    for ( const token of bearer.getActiveTokens(true) ) {
      if ( !token.visible || token.document.isSecret || !canvas?.interface?.createScrollingText ) continue;
      canvas.interface.createScrollingText(token.center, `−(${effect.name})`, {
        anchor: CONST.TEXT_ANCHOR_POINTS.CENTER, direction: CONST.TEXT_ANCHOR_POINTS.BOTTOM,
        distance: 2 * token.h, fontSize: 28, stroke: 0x000000, strokeThickness: 4, jitter: 0.25
      });
    }
  }
  await card.setFlag(MODULE_ID, SHARE_FLAG, { ...card.getFlag(MODULE_ID, SHARE_FLAG), ended: why });
}

/* --- the card: the verdict's line ----------------------------------------------------------------- */

listen("dnd5e.renderChatMessage", "damage-shares", (message, html) => {
  try {
    const s = message.getFlag(MODULE_ID, SHARE_FLAG);
    if ( !s?.ended ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-share-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-share-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);font-weight:bold;opacity:0.9;color:var(--dnd5e-color-blue, #3a7ca5);";
    div.innerHTML = `<i class="fa-solid fa-link-slash"></i> ${esc(`${s.key} ended — ${s.ended}`)}`;
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The share's line could not render.`, err); }
});
