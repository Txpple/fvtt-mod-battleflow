/**
 * Battle Flow — resource use notices (v1.20.0, the user's ask verbatim: "if an ability has
 * x of y per day or short rest, give a notification like it does on combat plus on turn
 * notice (a screen flash and fade of text). say something like used [ability], x of y
 * remaining").
 *
 * ZERO NEW STATE, ZERO WIRE: dnd5e stamps every consumption onto the usage message itself —
 * `message.system.deltas` = { actor: [{keyPath, delta}], item: { itemId: [{keyPath, delta}] } }
 * (measured 2026-08-21, 5.3.3: Activity#consume sets messageConfig.data.system.deltas before
 * the message is created). The message replicates to every client, so every client can read
 * the spend and flash locally — the chat log is the bus, as everywhere in this module.
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
import { S, setting } from "./core.js";

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
function spendRows(message) {
  if ( !isUsage(message) ) return [];
  const deltas = message.system?.deltas;
  if ( !deltas ) return [];
  const actor = message.getAssociatedActor?.();
  if ( !actor?.hasPlayerOwner ) return [];
  const rows = [];
  for ( const [itemId, changes] of Object.entries(deltas.item ?? {}) ) {
    const item = actor.items.get(itemId);
    if ( !item ) continue;
    for ( const { keyPath, delta } of (changes ?? []) ) {
      if ( !(delta > 0) ) continue;
      if ( keyPath === "system.uses.spent" ) {
        const uses = item.system.uses;
        if ( !(uses?.max > 0) || !(uses.recovery?.length) ) continue;
        rows.push({ pool: item.name, spent: delta, left: uses.value ?? 0, max: uses.max });
      } else {
        const m = /^system\.activities\.([a-zA-Z0-9]+)\.uses\.spent$/.exec(keyPath);
        if ( !m ) continue;
        const act = item.system.activities?.get?.(m[1]);
        const uses = act?.uses;
        if ( !(uses?.max > 0) || !(uses.recovery?.length) ) continue;
        rows.push({ pool: act.name || item.name, spent: delta, left: uses.value ?? 0, max: uses.max });
      }
    }
  }
  return rows;
}

/** The ability that was used, as the card names it. */
function usedName(message) {
  try { return fromUuidSync(message.getFlag("dnd5e", "item")?.uuid ?? "")?.name ?? null; }
  catch { return null; }
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
  const detail = rows.map(r => `${esc(r.pool)}: ${r.left} of ${r.max} remaining`).join(" &nbsp;·&nbsp; ");
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
    + `${esc(r.pool)} — <strong>${r.left} of ${r.max}</strong> remaining`).join("<br>");
  content.appendChild(div);
});
