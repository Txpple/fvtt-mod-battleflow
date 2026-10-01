/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE HEAL ON HIT (HEAL_ON_HIT) — a spell whose landed damage
 * heals its caster a share of it (Vampiric Touch; Lifedrinker's shape, SWEEP §3 item 4). The seam is
 * `dnd5e.applyDamage`: the dealing card's activity answers the row, the amount TAKEN of the row's type
 * pays the caster with a receipt on the same card, once per creature per card, no choice (R1).
 * Rulings: RULINGS *The spells slice — the held spells*.
 */
import { MODULE_ID, TITLE, canApplyTo, whisperNoGM, queueFlagWrite } from "./core.js";
import { activityOfType, cardActivity, featureNamed, lower } from "./lookup.js";
import { damagePartsOf } from "./shared.js";
import { nearestFeet, tokenOfActor } from "./geometry.js";
import { HEAL_BLOCKS, HEAL_ON_HIT, tableIndex, healOnHitEntries, listedNames } from "./decide/registry.js";
import { healOnHitAmount, healOnHitTitle, killPays } from "./decide/heal-on-hit.js";
import { riderPartFormula } from "./decide/clock.js";
import { bfCard, esc, ruleLine } from "./decide/present.js";
import { applyDamagesWithReceipt } from "./auto-apply.js";
import { askHandOut } from "./rest-grants.js";
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
    const caster = activity?.item?.actor ?? activity?.actor ?? null;
    // C1 — an `on: "damage"` row keyed by a FEATURE on the caster (Improved Blessed Strikes): the card's spell must fit.
    if ( (caster instanceof Actor) && caster.isOwner ) void offerOnDamage({ activity, caster, origin });
    const row = activity?.item ? rowFor(activity.item) : null;
    if ( !row || row.on || !listedNames(healOnHitEntries()).has(row.key.toLowerCase()) ) return;
    if ( !(caster instanceof Actor) || (caster.uuid === actor.uuid) ) return;
    void heal({ row, activity, caster, target: actor, taken: Number(amount), origin });
  } catch(err) {
    console.error(`${TITLE} | The heal on hit failed — heal the caster by hand.`, err);
  }
});

/* --- C1 — the temp HP offered when the bearer's spell lands damage (Improved Blessed Strikes) -------------------- */

const offered = new Set();
/** Once per dealing card: the feature's heal activity's Temporary Hit Points, the rest song's pick popup for one creature. */
async function offerOnDamage({ activity, caster, origin }) {
  try {
    const item = activity?.item;
    if ( (item?.type !== "spell") || offered.has(origin.id) ) return;
    const listed = listedNames(healOnHitEntries());
    for ( const [key, row] of Object.entries(HEAL_ON_HIT) ) {
      if ( (row.on !== "damage") || !listed.has(lower(key)) ) continue;
      if ( (row.spell === "cantrip") && (Number(item.system?.level) !== 0) ) continue;
      if ( row.spellClass ) {
        const cls = item.system?.classIdentifier ?? (String(item.system?.sourceItem ?? "").startsWith("class:") ? String(item.system.sourceItem).slice(6) : null)
          ?? ((Object.keys(caster.classes ?? {}).length === 1) ? Object.keys(caster.classes)[0] : null);
        if ( lower(cls ?? "") !== lower(row.spellClass) ) continue;
      }
      const feature = featureNamed(caster, key);
      if ( !feature ) continue;
      const heal = row.activity ? [...(feature.system?.activities ?? [])].find(a => a.name === row.activity) : activityOfType(feature, "heal");
      const h = heal?.healing;
      const raw = h ? riderPartFormula({ number: h.number, denomination: h.denomination, custom: h.custom, bonus: h.bonus }) : null;
      if ( !raw ) { console.warn(`${TITLE} | ${key}: no healing part on its activity — give it by hand.`); continue; }
      const roll = await new Roll(raw, heal.getRollData?.() ?? caster.getRollData()).evaluate();
      if ( !(roll.total > 0) ) continue;
      offered.add(origin.id);
      await askHandOut(caster, { name: key, row: { ...row, reach: row.within ?? null, self: !!row.self }, item: feature, amount: roll.total, roll,
        table: "cast", distribute: false });
      return;
    }
  } catch(err) {
    console.error(`${TITLE} | The temp HP offer failed — give them by hand.`, err);
  }
}

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

/* --- `on: "kill"`: an enemy dropped to 0 pays a feature's bearer (Dark One's Blessing) -------------- */

const HP = "system.attributes.hp.value";
/** Stamped before the write (the Hit Points were above 0, the update takes them to 0); read after it lands. */
const falling = new Map();

/** THE DMG — the heal-blocking effect this creature wears (HEAL_BLOCKS), or null. */
function healBlockOn(actor) {
  for ( const [key, row] of Object.entries(HEAL_BLOCKS) ) {
    const effect = actor?.effects?.find?.(e => e.active && (lower(e.name) === lower(row.effect)));
    if ( effect ) return { key, row, effect };
  }
  return null;
}

listen("dnd5e.preApplyDamage", "heal-on-hit", (actor, amount, updates, options) => {
  try {
    // THE DMG — a creature that can't regain Hit Points: the heal is held at the Hit Points it has (Temporary Hit Points
    // are not regained ones and pass).
    if ( (actor instanceof Actor) && (HP in (updates ?? {})) ) {
      const now = Number(actor.system?.attributes?.hp?.value ?? 0);
      const block = (Number(updates[HP]) > now) ? healBlockOn(actor) : null;
      if ( block ) {
        updates[HP] = now;
        ui.notifications?.info?.(`${actor.name} can't regain Hit Points (${block.effect.name}).`);
      }
    }
    if ( !(actor instanceof Actor) || !(Number(amount) > 0) || !(HP in (updates ?? {})) ) return;
    if ( !(Number(actor.system?.attributes?.hp?.value ?? 0) > 0) || (Number(updates[HP]) > 0) ) return;
    const origin = options?.originatingMessage;
    if ( !(origin instanceof ChatMessage) ) return;                  // no card, no dealer (the bend)
    falling.set(actor.uuid, origin);
  } catch(err) {
    console.error(`${TITLE} | The kill's heal could not be stamped — heal by hand.`, err);
  }
});

listen("dnd5e.applyDamage", "heal-on-hit", (actor, _amount, _options) => {
  try {
    const origin = falling.get(actor?.uuid);
    if ( !origin ) return;
    falling.delete(actor.uuid);
    if ( Number(actor.system?.attributes?.hp?.value ?? 1) > 0 ) return;   // something held it above 0
    void payKill(actor, origin);
  } catch(err) {
    console.error(`${TITLE} | The kill's heal failed — heal by hand.`, err);
  }
});

/** The `kill` rows' bearers on the scene this drop pays, each with its row, feature and why. */
function killBearers(fallen, dealer) {
  const listed = listedNames(healOnHitEntries());
  const fallenToken = tokenOfActor(fallen);
  const out = [];
  for ( const [key, row] of Object.entries(HEAL_ON_HIT) ) {
    if ( (row.on !== "kill") || !listed.has(lower(key)) ) continue;
    const seen = new Set();
    for ( const token of (canvas.tokens?.placeables ?? []) ) {
      const bearer = token.actor;
      if ( !bearer || seen.has(bearer.uuid) || (bearer.uuid === fallen.uuid) ) continue;
      seen.add(bearer.uuid);
      const feature = featureNamed(bearer, key);
      if ( !feature ) continue;
      const verdict = killPays({ dealt: bearer.uuid === dealer?.uuid,
        feet: fallenToken ? nearestFeet(token, fallenToken) : null, within: row.within ?? null,
        sides: [token.document?.disposition ?? 0, fallenToken?.document?.disposition ?? 0] });
      if ( verdict.pays ) out.push({ key, row, bearer, feature, why: verdict.why });
    }
  }
  return out;
}

const paid = new Set();
async function payKill(fallen, origin) {
  const dealer = origin.getAssociatedActor?.() ?? null;
  for ( const b of killBearers(fallen, dealer) ) {
    const latch = `${origin.id}|${fallen.uuid}|${b.bearer.uuid}|${b.key}`;
    if ( paid.has(latch) ) continue;
    paid.add(latch);
    try {
      const activity = activityOfType(b.feature, "heal");
      const h = activity?.healing;
      const raw = h ? riderPartFormula({ number: h.number, denomination: h.denomination, custom: h.custom, bonus: h.bonus }) : null;
      let amount = 0;
      try {
        const resolved = raw ? Roll.replaceFormulaData(raw, b.bearer.getRollData()) : null;
        amount = (resolved && Roll.validate(resolved)) ? Math.floor(Number((await new Roll(resolved).evaluate()).total) || 0) : 0;
      } catch { amount = 0; }
      if ( !(amount > 0) ) { console.warn(`${TITLE} | ${b.key}: no amount could be read off ${b.bearer.name}'s sheet — heal by hand.`); continue; }
      const what = b.row.temphp ? "Temporary Hit Points" : "Hit Points";
      if ( !canApplyTo(b.bearer) ) { await whisperNoGM(`${b.key} (${amount} ${what} to ${b.bearer.name})`, "Apply it from the sheet."); continue; }
      const card = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: b.bearer }),
        content: bfCard({ img: b.feature.img ?? null, eyebrow: `${b.key} — ${fallen.name} falls`, tone: "good",
          title: `${b.key} — ${b.bearer.name} gains ${amount} ${what}`,
          subtitle: b.why, lines: [ruleLine(b.row.rule)] }),
        flags: { [MODULE_ID]: { [HEAL_ON_HIT_FLAG]: { key: b.key, casterUuid: b.bearer.uuid, targetUuid: fallen.uuid, targetName: fallen.name,
          taken: 0, amount, why: b.why, originId: origin.id, sourceUuid: b.bearer.uuid, kill: true } } }
      });
      if ( card ) await applyDamagesWithReceipt(card, [{ uuid: b.bearer.uuid, name: b.bearer.name }],
        [{ value: amount, type: b.row.temphp ? "temphp" : "healing", properties: new Set() }], { note: b.key });
    } catch(err) {
      console.error(`${TITLE} | ${b.key} could not land — apply it by hand.`, err);
    }
  }
}
