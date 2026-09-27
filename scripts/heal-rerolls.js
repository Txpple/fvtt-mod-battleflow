/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE HEALING REROLLS — a healing die showing a 1,
 * rerolled at its owner's word (decide/registry.js HEAL_REROLLS; Healer the one row). The origin
 * feats, 2026-09-25 — the user: "use the empower spell form as a baseline listing all roll numbers,
 * the ones, and select the ones to replace"; "make sure the healer feat itself gets the 1 popup too
 * not just spells"; "1s ticked".
 *
 * ⚠ AUTOMATIC SINCE 2026-09-26 (the PHB feats walk — the user: "make adept automatic, fix healer that
 * way too ... then its consistent with that great weapon one"): a reroll of a 1 can never make the
 * healing smaller, so it is not a choice (DESIGN R1) and asks nothing. Every 1 is rerolled as the
 * dice land; the rest of the road below — the held healing, the durable completion, the dice on the
 * canvas, the card — is unchanged. Where the text below says popup, read: the 1s are all taken.
 *
 * THE MOMENT is the healing roll — a healing spell the owner casts, or the feat's own Battle Medic.
 * The roll message is born with `healReroll` DUE (preRollDamageV2, a birth flag like Savage
 * Attacker's), and the heal applier (cast.js) holds the healing while it waits — so it lands ONCE,
 * with the faces that stood. When the dice land (rollDamageV2, the roller's client) the record goes
 * pending if a 1 shows and settles "none" if not. The popup is Empowered Spell's (metamagic.js):
 * every die as a chip, eight to a row — the 1s pickable and TICKED, every other face shown and
 * greyed; "Reroll the picked dice" / "Keep the roll"; the clock keeps the roll. The feat has no
 * cost and no cap: every 1 may go.
 *
 * BATTLE MEDIC: the pack's own activities roll `1dXr1 + @prof` — the platform rerolling the 1
 * silently. The feat's rerolls are the popup's now, so the `r1` is taken off at the roll
 * (decide/damage-dice.js `stripRerollOnes`) and the 1 is asked like a spell's.
 *
 * THE PATCH is Empowered's (decide/damage-dice.js `rerollFaces`): the 1 struck in the message's own
 * roll data, the new face joining it, the rolls rebuilt with their totals taken again (shared.js
 * `rebuildRolls`), the new dice on their own card (Dice So Nice keys on it). "You must use the new
 * roll": a second 1 stands. Healing already applied off the message — the claim makes that the belt,
 * not the road — is moved by the difference (auto-apply.js `moveAppliedDamage`).
 */
import { MODULE_ID, TITLE, statContext, queueFlagWrite, drivesMomentFor } from "./core.js";
import { lower, featureNamed, resolveUuid } from "./lookup.js";
import { healRerollEntries, listedNames } from "./settings.js";
import { rebuildRolls } from "./shared.js";
import { HEAL_REROLLS } from "./decide/registry.js";
import { healDiceOf, stripRerollOnes, rerollFaces } from "./decide/damage-dice.js";
import { rerollRise } from "./decide/dice-chips.js";
import { bfCard, esc } from "./decide/present.js";
import { dramaticVerdictPause, registerResumable } from "./ui.js";
import { moveAppliedDamage } from "./auto-apply.js";
import { SURFACES } from "./surfaces.js";

const HEAL_FLAG = "healReroll";
const offering = new Set();
const resolving = new Set();

/** The listed healing-reroll row this actor holds — `{ name, row, feature }` or null. */
function rowFor(actor) {
  const listed = listedNames(healRerollEntries());
  for ( const [name, row] of Object.entries(HEAL_REROLLS) ) {
    if ( !listed.has(lower(name)) ) continue;
    const feature = featureNamed(actor, name);
    if ( feature ) return { name, row, feature };
  }
  return null;
}

/* --- the birth flag: due, and Battle Medic's own r1 taken off ---------------------------------- */

Hooks.on("dnd5e.preRollDamageV2", (config, _dialog, message) => {
  try {
    const rolls = config?.rolls ?? [];
    if ( !rolls.some(r => (r?.options?.type ?? null) === "healing") ) return;
    const activity = config?.subject;
    const actor = activity?.actor;
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

Hooks.on("dnd5e.rollDamageV2", rolls => {
  const message = rolls?.[0]?.parent;
  if ( message instanceof ChatMessage ) void promote(message);
});

Hooks.on("updateChatMessage", message => {
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
    // The table sees the dice land before the 1s turn over (the verdict pause's rule).
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
    // ANSWERED IS NOT PENDING (the d20 folds' rule): the status leaves "pending" before the dice.
    await queueFlagWrite(message, HEAL_FLAG, current => {
      if ( current.status !== "pending" ) return false;
      current.status = "answering";
      current.answeredAt = Date.now();
    });
    if ( message.getFlag(MODULE_ID, HEAL_FLAG)?.status !== "answering" ) return;
    const data = (message.rolls ?? []).map(r => r.toJSON());
    const live = picks.filter(d => data[d.roll]?.terms?.[d.term]?.results?.[d.index]);
    // THE DICE ARE ONE ROLL, ON THEIR OWN CARD (Empowered's reason: the card every roll-reader and
    // Dice So Nice key on).
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
    // THE DURABLE INTENT, BEFORE THE PAUSE (Empowered's 2026-09-10 review): the elect's resume
    // finishes it if this client dies inside the dice.
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
 * THE COMPLETION — the one step between "answering" and "used": the patched rolls onto the
 * message, the outcome onto the flag (the settling write the heal applier waits on), and any
 * healing already applied moved by the difference. Idempotent by status.
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
  // A completion the rolling client never took, a DUE it never promoted, and a PENDING it never
  // rerolled (it died inside the pause): the driver finishes the one and takes the others.
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
    case "kept": return `${name} — kept the roll${flag.timedOut ? " (the clock ran out)" : ""}`;   // a card from before 2026-09-26
    case "due": return `${name} — reading the dice`;
    case "none": return "";
    default: return `${name} — rerolling the 1s`;
  }
}

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
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
