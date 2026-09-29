/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE HEALING REROLLS (HEAL_REROLLS) — every healing 1
 * is rerolled automatically, never a choice (DESIGN R1). The roll is born `healReroll` DUE and the
 * heal applier waits, so healing lands ONCE; a pack's own `r1` is taken off. A second 1 stands.
 */
import { MODULE_ID, TITLE, statContext, queueFlagWrite, drivesMomentFor, canAnswerFor } from "./core.js";
import { lower, featureNamed, resolveUuid, activityNamed, cardActivity } from "./lookup.js";
import { healRerollEntries, listedNames } from "./decide/registry.js";
import { rebuildRolls, withTargets } from "./shared.js";
import { nearestFeet, tokenOfActor } from "./geometry.js";
import { CARD, isCard, originData } from "./decide/card.js";
import { HEAL_REROLLS } from "./decide/registry.js";
import { healDiceOf, slotBonus, stripRerollOnes, rerollFaces } from "./decide/damage-dice.js";
import { rerollRise } from "./decide/dice-chips.js";
import { bfCard, esc, popupKey, ruleLine } from "./decide/present.js";
import { dramaticVerdictPause, momentButton, openMomentPopup, registerResumable, shownMoments } from "./ui.js";
import { moveAppliedDamage } from "./auto-apply.js";
import { SURFACES } from "./surfaces.js";
import { listen } from "./dispatch.js";

const HEAL_FLAG = "healReroll";
const offering = new Set();
const resolving = new Set();

/** The listed healing-reroll row this actor holds — `{ name, row, feature }` or null. */
function rowFor(actor) {
  const listed = listedNames(healRerollEntries());
  for ( const [name, row] of Object.entries(HEAL_REROLLS) ) {
    if ( !row.reroll || !listed.has(lower(name)) ) continue;   // a `max` row (Beacon of Hope) is cast.js's
    const feature = featureNamed(actor, name);
    if ( feature ) return { name, row, feature };
  }
  return null;
}

/** Spells the owner casts from a slot (never innate or at will) — the `slotCast` rows' reach. */
const SLOTLESS_METHODS = new Set(["innate", "atwill"]);

/**
 * The listed `bonus` rows (Disciple of Life) as `{ name, amount }` for this healing roll: the caster's own
 * levelled spell, from the activity that spends the slot, at the item's level plus the roll's scaling.
 */
function bonusesFor(activity, config) {
  const item = activity?.item;
  const actor = activity?.actor;
  if ( !actor || (item?.type !== "spell") ) return [];
  const level = Number(item.system?.level) || 0;
  if ( level < 1 ) return [];
  // An activity that spends no slot (a lingering heal on a later turn — Aura of Vitality) is not the cast.
  if ( activity.consumption?.spellSlot === false ) return [];
  const listed = listedNames(healRerollEntries());
  const slot = level + Math.max(0, Number(config?.scaling ?? item.flags?.dnd5e?.scaling ?? 0) || 0);
  const out = [];
  for ( const [name, row] of Object.entries(HEAL_REROLLS) ) {
    if ( !row.bonus || !listed.has(lower(name)) || !featureNamed(actor, name) ) continue;
    if ( row.slotCast && SLOTLESS_METHODS.has(String(item.system?.method ?? "")) ) continue;
    const amount = slotBonus(row.bonus, slot);
    if ( amount > 0 ) out.push({ name, amount });
  }
  return out;
}

/* --- the birth flag: due, and Battle Medic's own r1 taken off ---------------------------------- */

listen("dnd5e.preRollDamage", "heal-rerolls", (config, _dialog, message) => {
  try {
    const rolls = config?.rolls ?? [];
    if ( !rolls.some(r => (r?.options?.type ?? null) === "healing") ) return;
    const activity = config?.subject;
    const actor = activity?.actor;
    // Disciple of Life: the bonus rides the first healing roll as a labelled number (a label that is no
    // damage type leaves the roll's type alone), so every applier — the card's buttons too — heals it.
    const healing = rolls.find(r => (r?.options?.type === "healing") && Array.isArray(r.parts));
    for ( const b of (healing ? bonusesFor(activity, config) : []) ) healing.parts.push(`${b.amount}[${b.name}]`);
    const found = actor ? rowFor(actor) : null;
    if ( !found ) return;
    const item = activity.item;
    const own = found.row.own && (item?.id === found.feature.id);
    const spell = found.row.spells && (item?.type === "spell");
    if ( !own && !spell ) return;
    if ( own ) for ( const r of rolls ) if ( Array.isArray(r?.parts) ) r.parts = r.parts.map(p => (typeof p === "string") ? stripRerollOnes(p) : p);
    foundry.utils.setProperty(message, `data.flags.${MODULE_ID}.${HEAL_FLAG}`, {
      status: "due", feature: found.name, reroll: found.row.reroll, actorUuid: actor.uuid,
      source: item?.name ?? null, ...statContext(actor.uuid)
    });
  } catch(err) {
    console.error(`${TITLE} | The healing reroll could not be offered — reroll the 1s by hand.`, err);
  }
});

/* --- the promotion: due → pending when a 1 shows, "none" when none does ------------------------ */

listen("dnd5e.rollDamage", "heal-rerolls", rolls => {
  const message = rolls?.[0]?.parent;
  if ( message instanceof ChatMessage ) void promote(message);
});

listen("updateChatMessage", "heal-rerolls", message => {
  const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
  if ( (flag?.status === "due") && message.isAuthor ) void promote(message);
});

/** The whole roll's total — the healing rolls only. */
const healTotal = rolls => (rolls ?? []).filter(r => (r?.options?.type ?? "healing") === "healing")
  .reduce((n, r) => n + (Number(r.total) || 0), 0);

async function promote(message) {
  const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
  if ( (flag?.status !== "due") || offering.has(message.id) ) return;
  offering.add(message.id);
  try {
    const dice = healDiceOf((message.rolls ?? []).map(r => r.toJSON()), flag.reroll);
    const any = dice.some(d => d.one);
    await queueFlagWrite(message, HEAL_FLAG, current => {
      if ( current.status !== "due" ) return false;
      if ( !any ) { current.status = "none"; return; }
      current.status = "pending";
      current.dice = dice;
      current.total = healTotal(message.rolls);
    });
    if ( message.getFlag(MODULE_ID, HEAL_FLAG)?.status !== "pending" ) return;
    // The table sees the dice land before the 1s turn over.
    await dramaticVerdictPause(message);
    await reroll(message, dice.filter(d => d.one).map(d => d.key));
  } finally {
    offering.delete(message.id);
  }
}

/* --- the reroll: every 1 rolled again, the new faces standing --------------------------------- */

async function reroll(message, keys) {
  if ( resolving.has(message.id) ) return;
  resolving.add(message.id);
  try {
    const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
    if ( flag?.status !== "pending" ) return;
    const wanted = new Set(keys ?? []);
    const picks = (flag.dice ?? []).filter(d => d.one && wanted.has(d.key));
    if ( !picks.length ) {
      await queueFlagWrite(message, HEAL_FLAG, current => { if ( current.status !== "pending" ) return false; current.status = "none"; });
      return;
    }
    const actor = resolveUuid(flag.actorUuid);
    // Answered is not pending: the status leaves "pending" before the dice.
    await queueFlagWrite(message, HEAL_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "answering";
      current.answeredAt = Date.now();
    });
    if ( message.getFlag(MODULE_ID, HEAL_FLAG)?.status !== "answering" ) return;
    const data = (message.rolls ?? []).map(r => r.toJSON());
    const live = picks.filter(d => data[d.roll]?.terms?.[d.term]?.results?.[d.index]);
    // The dice are one roll, on their own card (the one roll-readers and Dice So Nice key on).
    const fresh = await new Roll(live.map(d => `1d${d.faces}`).join(" + ")).evaluate();
    const faces = fresh.dice.map(die => die.results.find(r => r.active !== false)?.result ?? die.total);
    const { data: patched, done } = rerollFaces(data, live, faces);
    const rebuilt = rebuildRolls(patched);
    const total = healTotal(rebuilt);
    const delta = total - (Number(flag.total) || 0);
    const rise = rerollRise({ done, on: actor?.uuid });   // the 1s turn over on the canvas, over the healer
    const announce = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls: [fresh],
      content: bfCard({ img: featureNamed(actor, flag.feature)?.img ?? null,
        eyebrow: `${flag.feature} — Healing Rerolls`, tone: "good",
        title: `${flag.feature} — ${done.length === 1 ? "the 1" : `${done.length} ones`} rerolled → ${done.map(p => p.new).join(", ")}`,
        subtitle: `${flag.source ?? "the healing"} heals ${total} now`, lines: [] }),
      flags: { [MODULE_ID]: { respondsTo: message.id, ...(rise ? { diceRise: rise } : {}) } }
    });
    // The durable intent, BEFORE the pause: the elect's resume finishes it if this client dies.
    await queueFlagWrite(message, HEAL_FLAG, current => {
      if ( current.status !== "answering" ) return false;
      current.pending = { rolls: rebuilt.map(r => JSON.stringify(r.toJSON())), picks: done, newTotal: total, delta, at: Date.now() };
    });
    if ( announce ) await dramaticVerdictPause(announce);
    await complete(message);
  } catch(err) {
    console.error(`${TITLE} | The healing reroll failed — reroll the 1s by hand.`, err);
    if ( message.getFlag(MODULE_ID, HEAL_FLAG)?.pending ) await complete(message).catch(() => {});
    else await queueFlagWrite(message, HEAL_FLAG, current => {
      if ( current.status !== "answering" ) return false;
      current.status = "pending";
    }).catch(() => {});
  } finally {
    resolving.delete(message.id);
  }
}

/**
 * THE COMPLETION, "answering" → "used": patched rolls, the settling flag write the heal applier
 * waits on, and applied healing moved by the difference. Idempotent by status.
 */
async function complete(message) {
  const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
  if ( (flag?.status !== "answering") || !flag.pending ) return;
  const { rolls, picks, newTotal, delta } = flag.pending;
  const { pending: _done, ...rest } = flag;
  void _done;
  await message.update({
    rolls,
    flags: { [MODULE_ID]: { [HEAL_FLAG]: { ...rest, status: "used", picks, newTotal, delta, "-=pending": null } } }
  });
  await moveAppliedDamage(message, { delta, feature: flag.feature });
}

/** Past the longest the pause can be, with slack. */
const RESUME_MS = 20_000;
registerResumable(HEAL_FLAG, {
  // A completion never taken, a DUE never promoted, a PENDING never rerolled: the driver finishes them.
  pending: (flag, message) => ((flag?.status === "answering") && !!flag.pending && ((Date.now() - (flag.pending.at ?? 0)) > RESUME_MS))
    || (["due", "pending"].includes(flag?.status) && ((Date.now() - (message.timestamp ?? 0)) > RESUME_MS)),
  drives: flag => drivesMomentFor(flag?.actorUuid ?? null),
  drive: message => {
    const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
    if ( flag?.status === "due" ) return promote(message);
    if ( flag?.status === "pending" ) return reroll(message, (flag.dice ?? []).filter(d => d.one).map(d => d.key));
    return complete(message);
  }
});

/* --- the card: what happened, and the recall while it asks ------------------------------------- */

/** The card's line, from the record — source, then result (law 6). */
function cardLine(flag) {
  const name = flag.feature ?? "Healer";
  switch ( flag.status ) {
    case "used": {
      const n = (flag.picks ?? []).length;
      return `${name} — ${n === 1 ? "the 1" : `${n} ones`} rerolled (${(flag.picks ?? []).map(p => `${p.old}→${p.new}`).join(", ")}): heals ${flag.newTotal}`;
    }
    case "kept": return `${name} — kept the roll${flag.timedOut ? " (the clock ran out)" : ""}`;   // an older card, from when the reroll asked
    case "due": return `${name} — reading the dice`;
    case "none": return "";
    default: return `${name} — rerolling the 1s`;
  }
}

listen("dnd5e.renderChatMessage", "heal-rerolls", (message, html) => {
  try {
    const flag = message.getFlag(MODULE_ID, HEAL_FLAG);
    if ( !flag || (flag.status === "none") ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-heal-reroll-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-heal-reroll-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = `<i class="fa-solid fa-hand-holding-medical" data-tooltip="${esc(flag.feature ?? "")}"></i> ${esc(cardLine(flag))}`;
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The healing-reroll line could not render.`, err); }
});

/** The `bonus` rows' numbers on a healing roll, read off the labelled terms the roll was born with. */
const BONUS_NAMES = Object.entries(HEAL_REROLLS).filter(([, row]) => row.bonus).map(([name]) => name);
function bonusTermsOf(message) {
  const out = [];
  for ( const roll of (message.rolls ?? []) ) for ( const term of (roll.terms ?? []) ) {
    const name = BONUS_NAMES.find(n => lower(term?.flavor) === lower(n));
    if ( name && Number.isFinite(Number(term.number)) ) out.push({ name, amount: Number(term.number) });
  }
  return out;
}

listen("dnd5e.renderChatMessage", "heal-rerolls", (message, html) => {
  try {
    if ( !isCard(message, CARD.healing) ) return;
    const found = bonusTermsOf(message);
    if ( !found.length ) return;
    const content = html.querySelector?.(SURFACES.messageContent) ?? html;
    if ( !content || content.querySelector(".bf-heal-bonus-line") ) return;
    const div = document.createElement("div");
    div.className = "bf-heal-bonus-line";
    div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
    div.innerHTML = found.map(b => `<i class="fa-solid fa-hand-holding-medical" data-tooltip="${esc(b.name)}"></i> ${esc(b.name)} — +${b.amount} healing`).join("<br>");
    content.appendChild(div);
  } catch(err) { console.warn(`${TITLE} | The healing bonus line could not render.`, err); }
});

/* --- `also`: one more creature healed after the caster's own healing spell (Starry Form's Chalice) --- */

const ALSO_FLAG = "alsoHeal";

/** The listed `also` rows due for this healing card's caster: the spell cast with a slot, the form standing. */
function alsoRowsFor(message) {
  if ( !isCard(message, CARD.healing) ) return [];
  const activity = cardActivity(message);
  const item = activity?.item;
  // A levelled spell: the slot is the cast's (a cantrip heals nobody; a free cast is the table's to wave off).
  if ( (item?.type !== "spell") || !(Number(item.system?.level ?? 0) > 0) ) return [];
  const caster = message.getAssociatedActor?.() ?? activity.actor ?? null;
  if ( !(caster instanceof Actor) ) return [];
  const listed = listedNames(healRerollEntries());
  const out = [];
  for ( const [key, row] of Object.entries(HEAL_REROLLS) ) {
    if ( !row.also || !listed.has(lower(key)) ) continue;
    const feature = featureNamed(caster, key);
    const heal = feature ? activityNamed(feature, row.also) : null;
    if ( !heal ) continue;
    if ( row.while && !caster.effects.some(e => e.active && (lower(e.name) === lower(row.while))) ) continue;
    if ( row.form && !caster.effects.some(e => e.active && (e.getFlag(MODULE_ID, "formChip")?.form === row.form)) ) continue;
    out.push({ key, row, caster, feature, heal });
  }
  return out;
}

/** Who the pick may heal: the caster, and every creature on its side within the row's feet. */
function alsoCandidates(caster, feet) {
  const from = tokenOfActor(caster);
  if ( !from ) return [];
  const side = from.document?.disposition;
  const out = [{ uuid: caster.uuid, name: from.document?.name ?? caster.name, token: from }];
  for ( const t of (canvas.tokens?.placeables ?? []) ) {
    if ( (t === from) || !t.actor?.system?.attributes?.hp || (t.document?.disposition !== side) ) continue;
    if ( out.some(c => c.uuid === t.actor.uuid) ) continue;
    const d = nearestFeet(from, t);
    if ( (d !== null) && (d <= feet) ) out.push({ uuid: t.actor.uuid, name: t.document?.name ?? t.actor.name, token: t });
  }
  return out;
}

/** The pick: kept on the card first (once per cast), then the feature's heal used at that creature. */
async function pickAlso(message, found, candidate) {
  let won = false;
  await queueFlagWrite(message, ALSO_FLAG, current => {
    if ( current.picked ) return false;
    Object.assign(current, { ...statContext(found.caster.uuid), key: found.key, also: found.row.also, picked: candidate.uuid, name: candidate.name });
    won = true;
  });
  if ( !won ) return;
  try {
    await withTargets([candidate.token], async () => {
      const used = await found.heal.use({ subsequentActions: false }, { configure: false });
      const usageId = used?.message?.id ?? null;
      await found.heal.rollDamage({}, { configure: false }, { data: usageId ? originData(usageId) : {} });
    });
  } catch(err) {
    console.error(`${TITLE} | ${found.row.also} could not be used — use it from the sheet.`, err);
  }
}

async function showAlsoPopup(message, found, candidates) {
  const formula = found.heal.healing?.formula ?? "";
  await openMomentPopup(message, "alsoHeal", found.caster, {
    title: `${found.row.also} — ${found.caster.name}`, icon: "fa-solid fa-star",
    content: bfCard({ img: found.feature.img ?? null, eyebrow: `${found.key} — ${found.row.also}`, tone: "pending",
      title: `Heal a creature within ${found.row.within} ft for ${formula || "the Chalice's die"}?`,
      subtitle: "you or another creature — or pass", lines: [ruleLine(found.row.rule)] }),
    buttons: [...candidates.map((c, i) => ({ action: `heal-${i}`, label: c.name, default: i === 0, callback: () => void pickAlso(message, found, c) })),
      { action: "pass", label: "Pass", callback: () => {} }]
  });
}

listen("dnd5e.renderChatMessage", "heal-rerolls", (message, html) => {
  try {
    const done = message.getFlag(MODULE_ID, ALSO_FLAG);
    if ( done?.picked ) {
      const line = document.createElement("div");
      line.innerHTML = bfCard({ eyebrow: `${done.key} — ${done.also}`, tone: "good", title: `${done.also} — ${done.name} is healed too`, subtitle: "its own card" });
      html.querySelector(SURFACES.messageContent)?.appendChild(line);
      return;
    }
    for ( const found of alsoRowsFor(message) ) {
      if ( !canAnswerFor(found.caster) ) continue;
      const candidates = alsoCandidates(found.caster, found.row.within);
      if ( !candidates.length ) continue;
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:0.35rem;align-items:center;margin-top:0.35rem;flex-wrap:wrap;";
      const label = document.createElement("span");
      label.style.cssText = "font-size:var(--font-size-11,11px);opacity:0.8;";
      label.textContent = `${found.row.also} — heal one more within ${found.row.within} ft:`;
      row.appendChild(label);
      for ( const c of candidates ) row.appendChild(momentButton(c.name, () => void pickAlso(message, found, c)));
      html.querySelector(SURFACES.messageContent)?.appendChild(row);
      const shownKey = popupKey(message.id, "alsoHeal");
      if ( !shownMoments.has(shownKey) && ((Date.now() - (message.timestamp ?? 0)) < 60_000) ) {
        shownMoments.add(shownKey);
        void showAlsoPopup(message, found, candidates);
      }
    }
  } catch(err) {
    console.warn(`${TITLE} | The second heal could not be offered — use it from the sheet.`, err);
  }
});
