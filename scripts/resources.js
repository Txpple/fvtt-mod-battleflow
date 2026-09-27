/**
 * Battle Flow — resource use notices: "used [ability], x of y remaining" as a screen flash plus a
 * line on the usage card, read by every client off `system.deltas`. THE RHYTHM GATE: only a pool
 * that recovers on a rest announces (no name list). Player-owned actors only; NPC pools stay secret.
 * The elect also stamps a `spend` flag for the ledger.
 */
import { MODULE_ID, TITLE, S, setting, isActiveGM, statContext } from "./core.js";
import { poolSpendsOn } from "./shared.js";
import { esc, spendLine } from "./decide/present.js";
import { SURFACES } from "./surfaces.js";
import { CARD, activityUuidOf, isCard, originIdOf } from "./decide/card.js";
import { cardItem } from "./lookup.js";

const flashed = new Set();
// Flashes held for an ability's own dice — usage message id → the armed flash.
const pendingFlash = new Map();
const FLASH_FALLBACK_MS = 12_000;

const isUsage = m => isCard(m, CARD.usage);

// The qualifying spends, hand spends included (`poolSpendsOn`), so every surface agrees.
const spendRows = message => poolSpendsOn(message);

/** The ability that was used, as the card names it — through the card, so a used-up item still names itself. */
function usedName(message) {
  return cardItem(message)?.name ?? null;
}

/** Spell-slot spends (NEGATIVE deltas on `.value`) for the ledger, never the flash. */
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

// The flash: seated at 26% so it never overlaps a turn banner, stacking downward.

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

/** Does this use's activity have dice still to roll? Its flash then waits (12s fallback). */
function awaitsOwnDice(message) {
  try {
    const act = message.getAssociatedActivity?.() ?? null;
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

/** A roll message releases the flash it was holding up — by the card link when the roll has one,
 * by the activity uuid when it came from the sheet (a sheet roll has no enclosing card). */
function releasePending(message) {
  if ( !pendingFlash.size || !message.rolls?.length ) return;
  const originId = originIdOf(message);
  const activityUuid = activityUuidOf(message);
  for ( const [cardId, p] of pendingFlash ) {
    if ( (originId === cardId)
      || (p.activityUuid && (activityUuid === p.activityUuid)) ) {
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
      activityUuid: activityUuidOf(message) });
    return;
  }
  flashBanner(actorName, ability, rows);
});

// A HAND spend arrives as an UPDATE (Parry's answer folds onto the attack message). Same idiom:
// young messages only, each record flashed once per client, named by the record itself.
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

// The ledger's spend record, stamped by the ELECT at CREATION only: a late stamp would put NOW's
// turn on an old spend. ⚠ No setting gates it; a toggle would punch holes in the ledger.

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

// The durable record: one line on the usage card, every render, idempotent.

Hooks.on("dnd5e.renderChatMessage", (message, html) => {
  if ( !setting(S.resourceNotices) ) return;
  const rows = spendRows(message);
  if ( !rows.length ) return;
  const content = html.querySelector?.(SURFACES.messageContent) ?? html;
  if ( !content || content.querySelector(".bf-resource-line") ) return;
  const div = document.createElement("div");
  div.className = "bf-resource-line";
  div.style.cssText = "margin:0.25rem 0;font-size:var(--font-size-11,11px);opacity:0.85;";
  div.innerHTML = rows.map(r =>
    `<i class="fa-solid fa-hourglass-half" data-tooltip="${esc(r.pool)}"></i> `
    + esc(spendLine(r)).replace(/(\d+ of \d+)/, "<strong>$1</strong>")).join("<br>");
  content.appendChild(div);
});
