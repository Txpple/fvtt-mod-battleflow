/**
 * Battle Flow — resource use notices (v1.20.0, the user's ask verbatim: "if an ability has
 * x of y per day or short rest, give a notification like it does on combat plus on turn
 * notice (a screen flash and fade of text). say something like used [ability], x of y
 * remaining").
 *
 * THE NOTICES ARE STATELESS, THE STAMP IS NOT (amended 2026-08-27, the party-stats
 * commission — the original header claimed ZERO NEW STATE, and for the notices that stays
 * true): dnd5e stamps every consumption onto the usage message itself —
 * `message.system.deltas` = { actor: [{keyPath, delta}], item: { itemId: [{keyPath, delta}] } }
 * (measured 2026-08-21, 5.3.3: Activity#consume sets messageConfig.data.system.deltas before
 * the message is created). The message replicates to every client, so every client can read
 * the spend and flash locally — the chat log is the bus, as everywhere in this module. The
 * data plane adds ONE write on top: the elect stamps a `spend` flag beside the deltas (the
 * section at the bottom), because the ledger needs combat context and pool truths resolved AT
 * SPEND TIME, and the handoff's trap 3 forbids the reader re-deriving what this file already
 * derives — one derivation, used by the flash, the card line and the stamp alike.
 *
 * THE RHYTHM GATE (structural, no name list): a spend announces only when its pool's uses
 * carry a RECOVERY period — "x per short rest / long rest / day" is exactly the user's own
 * definition of the abilities worth announcing. That one shape covers every named candidate
 * (Innate Sorcery, sorcery points via Font of Magic, superiority dice, Channel Divinity and
 * Vow of Enmity, Second Wind, Action Surge, Hunter's Mark's free casts, First Light's and
 * the Maul's daily item casts — all measured in the world) and structurally excludes the
 * noise: torches, rations, potions and healer's kits have uses but NO recovery, and spell
 * slots decrement ACTOR keyPaths this reader never looks at. Negative deltas (refunds,
 * Font of Magic regains) stay quiet — this is a "you spent it" notice, not a ledger.
 *
 * THREE POOL SHAPES, all measured in the party:
 *   - item uses           keyPath "system.uses.spent"                    (Second Wind)
 *   - cross-item pool     same keyPath, on the CONSUMED item's id        (Vow of Enmity →
 *                         Channel Divinity; maneuvers → Combat Superiority)
 *   - activity uses       keyPath "system.activities.<id>.uses.spent"    (Favored Enemy's
 *                         free Hunter's Mark)
 *
 * WHO: player-owned actors only, announced to EVERY client — the combatplus turn banner's
 * own publicity. NPC spends never flash anywhere; monster resources are the GM's secret and
 * the GM already sees the card.
 *
 * Surfaces, per the pairing rule's spirit: the FLASH is the attention (combatplus's exact
 * banner idiom — fixed, huge, fades, pointer-events none), the CARD LINE is the durable
 * record (idempotent render decoration; scrollback keeps what was spent). History is inert:
 * only a message younger than 10s flashes, and each flashes once per client.
 *
 * (cc), 2026-08-21 — the flash waits for the ability's own dice: an activity that carries
 * dice still to roll (Second Wind's heal, a damage feat) holds its flash in a pending map
 * and releases when the linked roll message arrives — `flags.dnd5e.originatingMessage` for
 * card-button rolls, the activity uuid for sheet-driven rolls (BOTH measured 2026-08-21;
 * a sheet roll has no enclosing card and never stamps the first key). A 12s fallback means
 * a player who never rolls still flashes. Client-local like everything here: the roll
 * replicates, each client self-resolves, `flashed` still dedupes. The card LINE stays
 * immediate — it is the ledger, not the attention.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, statContext } from "./core.js";
import { poolSpendsOn } from "./shared.js";
import { spendLine } from "./decide/present.js";

const flashed = new Set();
// (cc): flashes held for an ability's own dice — usage message id → the armed flash.
const pendingFlash = new Map();
const FLASH_FALLBACK_MS = 12_000;

const esc = s => String(s ?? "").replace(/[&<>"]/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const isUsage = m => (m.type === "usage") || (m.getFlag("dnd5e", "messageType") === "usage");

/**
 * The qualifying spends on a usage message: [{pool, spent, left, max}]. `left`/`max` are
 * read LIVE off the post-consumption document — the item update commits before the message
 * is created, so by the time any client renders this, the remaining count is the truth.
 */
// ⚠ MOVED to shared.js `poolSpendsOn` (2026-09-05, user: "a single pass-through function all the
// maneuvers call so it's uniform"): the same reader now also returns the module's own hand spends
// (Parry at the hold, the hit menu at the damage — `poolSpend` records written by
// `spendSuperiorityDie`), so the flash, the card line and every maneuver's subtitle agree.
const spendRows = message => poolSpendsOn(message);

/** The ability that was used, as the card names it. */
function usedName(message) {
  try { return fromUuidSync(message.getFlag("dnd5e", "item")?.uuid ?? "")?.name ?? null; }
  catch { return null; }
}

/**
 * Spell-slot spends on a usage message: [{slot, level, spent, left, max}] — the ledger's rows,
 * not the flash's. The rhythm gate above deliberately excludes slots from the NOTICES (the
 * flash would fire on every leveled cast); the data plane wants them precisely because three
 * of the party's four burn slots, and "spend economy" without slots is not an economy.
 * `left`/`max` are read live off the post-consumption actor, same contract as spendRows.
 * A slot spend arrives as a NEGATIVE delta on the slot's `.value` (a positive one is a
 * regain — Font of Magic conversion — and stays out of a "you spent it" row).
 */
function slotRows(message) {
  if ( !isUsage(message) ) return [];
  const actor = message.getAssociatedActor?.();
  if ( !actor?.hasPlayerOwner ) return [];
  const rows = [];
  for ( const { keyPath, delta } of (message.system?.deltas?.actor ?? []) ) {
    const m = /^system\.spells\.(spell(\d+)|pact)\.value$/.exec(keyPath);
    if ( !m || !(delta < 0) ) continue;
    const pool = actor.system.spells?.[m[1]];
    rows.push({ slot: m[1], level: m[2] ? Number(m[2]) : (pool?.level ?? null),
      spent: -delta, left: pool?.value ?? 0, max: pool?.max ?? 0 });
  }
  return rows;
}

/* ---------------------------------------------------------------------------------------------
 * The flash — combatplus's turn-banner idiom exactly (fixed, centered, fades, un-clickable),
 * seated lower (26%) so a turn banner and a spend never overlap, stacking downward when two
 * spends land together.
 * ------------------------------------------------------------------------------------------- */

function flashBanner(actorName, ability, rows) {
  const stack = document.querySelectorAll(".bf-resource-banner").length;
  const banner = document.createElement("div");
  banner.className = "bf-resource-banner";
  const detail = rows.map(r => esc(spendLine(r))).join(" &nbsp;·&nbsp; ");
  banner.innerHTML = `<div style="font-size:40px;">${esc(actorName)} used ${esc(ability)}</div>`
    + `<div style="font-size:26px;opacity:0.9;">${detail}</div>`;
  Object.assign(banner.style, {
    position: "fixed", top: `calc(26% + ${stack * 92}px)`, left: "0", width: "100%",
    textAlign: "center", fontFamily: "var(--font-h1, inherit)", color: "#fff",
    textShadow: "0 0 8px #000, 2px 2px 4px #000",
    zIndex: 9998, pointerEvents: "none", transition: "opacity 1s ease-in"
  });
  document.body.appendChild(banner);
  setTimeout(() => (banner.style.opacity = "0"), 3000);
  setTimeout(() => banner.remove(), 4200);
}

/**
 * (cc): does this use's activity carry dice of its own still to roll? Heal formulas and
 * damage parts do (the card offers the roll, or a module fold drives it); utility, attack
 * and save activities do not — attacks and saves run whole machines of their own.
 */
function awaitsOwnDice(message) {
  try {
    const flags = message.flags?.dnd5e ?? {};
    const item = fromUuidSync(flags.item?.uuid ?? "");
    const act = item?.system?.activities?.get?.(flags.activity?.id ?? "");
    if ( !act ) return false;
    if ( act.type === "heal" ) {
      const h = act.healing ?? {};
      return !!(h.number || h.denomination || String(h.bonus ?? "").trim()
        || String(h.custom?.formula ?? "").trim());
    }
    if ( act.type === "damage" ) return !!act.damage?.parts?.length;
    return false;
  } catch { return false; }
}

/** (cc): a roll message releases the flash it was holding up — by the card link when the
 * roll has one, by the activity uuid when it came from the sheet. */
function releasePending(message) {
  if ( !pendingFlash.size || !message.rolls?.length ) return;
  const d = message.flags?.dnd5e ?? {};
  for ( const [cardId, p] of pendingFlash ) {
    if ( (d.originatingMessage === cardId)
      || (p.activityUuid && (d.activity?.uuid === p.activityUuid)) ) {
      clearTimeout(p.timer);
      pendingFlash.delete(cardId);
      flashBanner(p.actorName, p.ability, p.rows);
      return;
    }
  }
}

Hooks.on("createChatMessage", message => {
  if ( !setting(S.resourceNotices) ) return;
  releasePending(message);
  // History is inert: render-resume and scrollback must never flash last week's spends.
  if ( Math.abs(Date.now() - (message.timestamp ?? 0)) > 10_000 ) return;
  if ( flashed.has(message.id) ) return;
  const rows = spendRows(message);
  if ( !rows.length ) return;
  flashed.add(message.id);
  const actor = message.getAssociatedActor?.();
  const actorName = actor?.name ?? "Someone";
  const ability = usedName(message) ?? "an ability";
  if ( awaitsOwnDice(message) ) {
    const timer = setTimeout(() => {
      if ( !pendingFlash.delete(message.id) ) return;
      flashBanner(actorName, ability, rows);
    }, FLASH_FALLBACK_MS);
    pendingFlash.set(message.id, { timer, rows, actorName, ability,
      activityUuid: message.flags?.dnd5e?.activity?.uuid ?? null });
    return;
  }
  flashBanner(actorName, ability, rows);
});

// A HAND spend arrives as an UPDATE (Parry's answer folds onto the attack message; the hit
// menu's record rides the damage message's birth flag, which `createChatMessage` above already
// reads). Same idiom: young messages only, each record flashes once per client, the ability
// named by the record itself. (2026-09-05, the uniform spend.)
Hooks.on("updateChatMessage", message => {
  if ( !setting(S.resourceNotices) ) return;
  const rows = spendRows(message).filter(r => r.at);
  if ( !rows.length ) return;
  const fresh = rows.filter(r => (Math.abs(Date.now() - r.at) <= 10_000) && !flashed.has(`${message.id}|${r.at}`));
  if ( !fresh.length ) return;
  for ( const r of fresh ) flashed.add(`${message.id}|${r.at}`);
  let actorName = "Someone";
  try { actorName = (fresh[0].actorUuid ? fromUuidSync(fresh[0].actorUuid)?.name : null) ?? message.getAssociatedActor?.()?.name ?? "Someone"; } catch { /* the name is decoration */ }
  flashBanner(actorName, fresh[0].ability ?? "an ability", fresh);
});

/* ---------------------------------------------------------------------------------------------
 * The data-plane stamp — the ledger's spend record, written once at spend time (2026-08-27)
 *
 * The ELECT writes it (single-writer discipline — every world write in this module), at
 * CREATION only: the pool truths (`left`/`max`) and the combat context are only honest in the
 * moment of the spend, so there is deliberately no render-resume — a stamp recovered later
 * would carry NOW's turn on last week's spend, which is worse than the reader falling back to
 * the message's own `system.deltas` (always there, just contextless). Unconditional by ruling:
 * no setting gates it — a toggle that silently punches holes in the ledger is a footgun, and
 * the freight is invisible at the table. Player-owned actors only, the same line the notices
 * draw: the party's meters are the commission; NPC pools are the GM's secret either way.
 * ------------------------------------------------------------------------------------------- */

Hooks.on("createChatMessage", message => {
  if ( !isActiveGM() ) return;
  if ( message.getFlag(MODULE_ID, "spend") ) return;   // never re-stamp
  const rows = spendRows(message);
  const slots = slotRows(message);
  if ( !rows.length && !slots.length ) return;
  const actor = message.getAssociatedActor?.();
  void message.setFlag(MODULE_ID, "spend", {
    ...statContext(actor?.uuid ?? null),
    ...(rows.length ? { rows } : {}),
    ...(slots.length ? { slots } : {})
  }).catch(err => console.error(`${TITLE} | Spend stamp failed.`, err));
});

/* ---------------------------------------------------------------------------------------------
 * The durable record — one small line on the usage card, every render, idempotent
 * ------------------------------------------------------------------------------------------- */

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  if ( !setting(S.resourceNotices) ) return;
  const rows = spendRows(message);
  if ( !rows.length ) return;
  const content = html.querySelector?.(".message-content") ?? html;
  if ( !content || content.querySelector(".bf-resource-line") ) return;
  const div = document.createElement("div");
  div.className = "bf-resource-line";
  div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
  div.innerHTML = rows.map(r =>
    `<i class="fa-solid fa-hourglass-half" data-tooltip="${esc(r.pool)}"></i> `
    + esc(spendLine(r)).replace(/(\d+ of \d+)/, "<strong>$1</strong>")).join("<br>");
  content.appendChild(div);
});
