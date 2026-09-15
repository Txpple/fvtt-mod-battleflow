/**
 * Battle Flow — MACHINE (ARCHITECTURE.md §7): THE EFFECT VIEW — a creature's buffs and debuffs,
 * visible on demand (DESIGN §6, user ruling 2026-09-15: "we just need to show debuffs and
 * buffs. not avail actions").
 *
 * Three surfaces, one renderer, no new state — every row is read off the sheet at draw time:
 *   THE HOVER CARD   point at a token, its list appears beside it (`hoverToken`); nothing at rest
 *   THE HELD KEY     Foundry's own highlight gesture (Alt held → `highlightObjects`) shows every
 *                    creature's list at once and clears on release
 *   THE BAR          a strip above the hotbar for the controlled token (else the user's own
 *                    character), always on; redrawn when effects change, control changes, or a
 *                    turn passes. THE ONE INTERACTIVE SURFACE (user ruling 2026-09-15): the NAME
 *                    opens the full list upward; a CHIP opens a fold with its one action (Remove
 *                    an effect on the creature, Disable an item's, Clear a sheet row) — for an
 *                    owner, which the GM is for every creature ("editing conditions on the fly").
 *                    A Details entry was tried the same day and dropped ("didnt like it").
 * The bar and the hover card each have a CLIENT switch. The draft is on the branch
 * `effect-view` (2026-09-15) with decide/effect-view.js's two heuristics unruled.
 *
 * ⚠ What this machine WRITES: nothing of its own — no flag, no message. The bar's fold deletes or
 * disables an ActiveEffect, or zeroes temp HP / inspiration, on the user's click and through the
 * platform's own permission (an owner's write). Every other surface is a pure view.
 */
import { MODULE_ID, S, setting } from "./core.js";
import { CHIP_FLAG } from "./decide/chips.js";
import { allRows, everyRow, marksHeldBy, panelGroups, rowAction } from "./decide/effect-view.js";

const ROOT_ID = "bf-effect-view";

/* --- reading the sheet ---------------------------------------------------------------------- */

/** The platform's own duration label, minus its "None" — a clockless row says nothing. */
function clockLabel(effect) {
  const label = effect.duration?.label ?? "";
  return (!label || /^none$/i.test(label)) ? "" : label;
}

/** A creature's side, as its token on the scene says it (else its prototype): 1 friendly, 0 neutral, −1 hostile. */
function sideOf(actor) {
  if ( !actor ) return null;
  const onScene = canvas.tokens?.placeables?.find(t => t.actor === actor)?.document;
  const d = onScene?.disposition ?? actor.prototypeToken?.disposition;
  return Number.isFinite(d) ? d : null;
}

/** Does the effect's origin stand on the OTHER side from its bearer? Null when either side is unknown. */
function hostileOriginOf(effect) {
  try {
    const bearer = (effect.parent instanceof Actor) ? effect.parent : effect.parent?.actor ?? null;
    if ( !bearer || !effect.origin ) return null;
    const origin = fromUuidSync(effect.origin, { strict: false });
    const source = (origin instanceof Actor) ? origin : (origin?.actor instanceof Actor ? origin.actor : null);
    if ( !source || (source === bearer) ) return source ? false : null;
    const a = sideOf(bearer), b = sideOf(source);
    if ( (a === null) || (b === null) ) return null;
    return (a * b) < 0;   // friendly against hostile, either way round; neutral is nobody's enemy
  } catch { return null; }
}

/** One effect as the decision layer wants it. */
function factOf(effect) {
  return {
    id: effect.id, name: effect.name, img: effect.img ?? null,
    active: effect.active === true, temporary: effect.isTemporary === true,
    disabled: effect.disabled === true,
    worn: (effect.parent instanceof Item) && (effect.transfer === true),
    onItem: effect.parent instanceof Item,
    statuses: [...(effect.statuses ?? [])],
    chipKey: effect.getFlag?.(MODULE_ID, CHIP_FLAG) ?? null,
    clock: clockLabel(effect),
    origin: typeof effect.origin === "string" ? effect.origin : null,
    changes: (effect.changes ?? []).map(c => ({ key: c.key, mode: c.mode, value: c.value })),
    hostileOrigin: hostileOriginOf(effect)
  };
}

/** Every applicable effect on an actor — the sheet's own walk (items' transfer effects included). */
function factsOf(actor) {
  const effects = typeof actor?.allApplicableEffects === "function" ? [...actor.allApplicableEffects()] : [...(actor?.effects ?? [])];
  return effects.map(factOf);
}

/** The sheet's own buffs that are numbers, not effects: temp HP and Heroic Inspiration. */
function sheetOf(actor) {
  const attrs = actor?.system?.attributes ?? {};
  return { tempHp: Number(attrs.hp?.temp) || 0, inspiration: attrs.inspiration === true };
}

/** Every row for an actor — the effects and the sheet rows. */
const rowsOf = actor => allRows(factsOf(actor), sheetOf(actor));

/** The marks this actor holds on the other creatures on the scene (question 2, drafted in). */
function marksOf(actor) {
  const others = [];
  for ( const t of (canvas.tokens?.placeables ?? []) ) {
    const a = t.actor;
    if ( !a || (a === actor) || !t.visible ) continue;
    for ( const fact of factsOf(a) ) others.push({ bearer: t.name ?? a.name, fact });
  }
  return marksHeldBy(actor.uuid, others);
}

/* --- drawing -------------------------------------------------------------------------------- */

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function chipHTML(row, { button = false } = {}) {
  const icon = row.img ? `<img src="${esc(row.img)}" alt="">` : "";
  const tag = row.noIcon ? `<em title="This effect paints no icon on the token">no icon</em>` : "";
  const clock = row.clock ? `<span class="clk">${esc(row.clock)}</span>` : (row.detail ? `<span class="dtl">${esc(row.detail)}</span>` : "");
  const inner = `${icon}<span class="txt"><span class="nm">${esc(row.name)}</span>${clock}</span>${tag}`;
  return button
    ? `<button type="button" class="bf-ev-chip ${row.tone}${row.unavailable ? " unavailable" : ""}" data-row="${esc(row.id)}" title="${esc(row.name)}${row.unavailable ? " — unavailable: suppressed by the platform (unequipped, unattuned or expired)" : ""}">${inner}</button>`
    : `<span class="bf-ev-chip ${row.tone}" title="${esc(row.name)}">${inner}</span>`;
}

/** The list for one actor: debuffs, buffs, and (for the hover card) the marks it holds. */
function listHTML(actor, { withMarks = false } = {}) {
  const rows = rowsOf(actor);
  const marks = withMarks ? marksOf(actor) : [];
  const body = rows.length ? rows.map(chipHTML).join("") : `<span class="bf-ev-none">nothing on them</span>`;
  const held = marks.length
    ? `<div class="bf-ev-lbl">On others</div>${marks.map(m => chipHTML({ ...m, name: `${m.name} → ${m.bearer}` })).join("")}`
    : "";
  return `<div class="bf-ev-list">${body}</div>${held}`;
}

function ensureStyle() {
  if ( document.getElementById(`${ROOT_ID}-style`) ) return;
  const style = document.createElement("style");
  style.id = `${ROOT_ID}-style`;
  style.textContent = `
    .bf-ev-card{position:fixed;z-index:70;max-width:280px;background:rgba(17,19,23,.94);border:1px solid #3a3f48;border-radius:5px;padding:7px 9px;box-shadow:0 8px 24px rgba(0,0,0,.6);font-size:12px;color:#b5b0a4;pointer-events:none}
    .bf-ev-card h4{margin:0 0 5px;font-size:12.5px;font-weight:600;color:#e8e3d6;display:flex;justify-content:space-between;gap:10px}
    .bf-ev-card h4 span{color:#7d7a72;font-weight:400;font-size:11px}
    .bf-ev-list{display:flex;flex-direction:column;gap:3px}
    .bf-ev-lbl{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#7d7a72;margin:6px 0 3px}
    .bf-ev-none{font-size:11.5px;color:#7d7a72;font-style:italic}
    .bf-ev-chip{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;padding:2px 7px 2px 4px;border-radius:4px;border:1px solid var(--bf-tone);background:color-mix(in srgb,var(--bf-tone) 20%,transparent);color:#e8e3d6;line-height:1.25;white-space:nowrap}
    .bf-ev-chip.buff{--bf-tone:rgb(70,150,95)} .bf-ev-chip.debuff{--bf-tone:rgb(180,70,60)}
    .bf-ev-chip.concentration{--bf-tone:rgb(232,190,50)}
    .bf-ev-chip img{width:18px;height:18px;border-radius:3px;border:0;flex:none;filter:drop-shadow(0 0 1px #000)}
    .bf-ev-chip .txt{display:flex;flex-direction:column} .bf-ev-chip .nm{font-weight:600;font-size:11.5px} .bf-ev-chip .clk{font-size:10px;color:#b5b0a4}
    .bf-ev-chip .clk::before{content:"◔ ";opacity:.7}
    .bf-ev-chip .dtl{font-size:11px;color:#e8e3d6;font-weight:700;font-variant-numeric:tabular-nums}
    .bf-ev-chip em{font-style:normal;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:#7d7a72;margin-left:2px}
    #${ROOT_ID}-bar{position:fixed;left:50%;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:6px;padding:5px 7px;background:rgba(20,22,26,.92);border:1px solid #3a3f48;border-radius:6px;box-shadow:0 4px 18px rgba(0,0,0,.45);max-width:min(900px,calc(100vw - 340px));font-size:12px;color:#b5b0a4}
    #${ROOT_ID}-bar .who{display:flex;flex-direction:column;padding:0 8px 0 4px;border-right:1px solid #3a3f48;margin-right:2px;line-height:1.15}
    #${ROOT_ID}-bar .who b{font-weight:600;font-size:13px;color:#e8e3d6;white-space:nowrap}
    #${ROOT_ID}-bar .who span{font-size:10.5px;color:#7d7a72;white-space:nowrap}
    #${ROOT_ID}-bar .bf-ev-list{flex-direction:row;flex-wrap:wrap;gap:5px}
    #${ROOT_ID}-bar .bf-ev-chip{padding:4px 9px 4px 5px} #${ROOT_ID}-bar .bf-ev-chip img{width:24px;height:24px}
    #${ROOT_ID}-bar.empty{display:none}
    #${ROOT_ID}-bar button{font:inherit;cursor:pointer}
    #${ROOT_ID}-bar button.who{background:none;border:0;border-right:1px solid #3a3f48;border-radius:0;text-align:left;color:inherit}
    #${ROOT_ID}-bar button.who:hover b,#${ROOT_ID}-bar button.who[aria-expanded="true"] b{color:#ffd7ad}
    #${ROOT_ID}-bar button.bf-ev-chip:hover,#${ROOT_ID}-bar button.bf-ev-chip[aria-expanded="true"]{box-shadow:0 0 0 2px rgba(255,255,255,.14)}
    #${ROOT_ID}-bar button:focus-visible{outline:2px solid rgb(222,120,40);outline-offset:1px}
    .bf-ev-fold{position:absolute;bottom:calc(100% + 6px);z-index:71;display:flex;flex-direction:column;gap:3px;padding:5px;background:rgba(17,19,23,.97);border:1px solid #3a3f48;border-radius:5px;box-shadow:0 8px 24px rgba(0,0,0,.6)}
    .bf-ev-fold::after{content:"";position:absolute;left:14px;bottom:-6px;width:10px;height:10px;background:rgba(17,19,23,.97);border-right:1px solid #3a3f48;border-bottom:1px solid #3a3f48;transform:rotate(45deg)}
    .bf-ev-fold .bf-ev-act{font:inherit;font-size:12px;padding:5px 12px;border-radius:4px;border:1px solid rgb(180,70,60);background:rgba(180,70,60,.2);color:#e8e3d6;cursor:pointer;white-space:nowrap}
    .bf-ev-fold .bf-ev-act:hover{background:rgba(180,70,60,.4)}
    .bf-ev-fold .bf-ev-act.clear{border-color:#7d7a72;background:rgba(120,120,120,.16)} .bf-ev-fold .bf-ev-act.clear:hover{background:rgba(120,120,120,.3)}
    .bf-ev-panel{position:absolute;left:0;bottom:calc(100% + 6px);z-index:71;min-width:260px;max-height:60vh;overflow:auto;padding:8px 10px;background:rgba(17,19,23,.97);border:1px solid #3a3f48;border-radius:5px;box-shadow:0 8px 24px rgba(0,0,0,.6)}
    .bf-ev-panel h4{margin:0 0 6px;font-size:12.5px;font-weight:600;color:#e8e3d6}
    #${ROOT_ID}-bar .bf-ev-panel .bf-ev-list{flex-direction:column;flex-wrap:nowrap;gap:3px}   /* vertical, one row per line (user, 2026-09-15) — outranks the bar's row rule */
    #${ROOT_ID}-bar .bf-ev-panel .bf-ev-chip{align-self:stretch}
    .bf-ev-panel .bf-ev-chip{position:relative}
    .bf-ev-panel .bf-ev-lbl{margin-top:8px} .bf-ev-panel .bf-ev-lbl:first-of-type{margin-top:0}
    .bf-ev-chip.unavailable{opacity:.55;border-style:dashed}

  `;
  document.head.appendChild(style);
}

/* --- the hover card ------------------------------------------------------------------------- */

let hoverCard = null;

function hideHover() { hoverCard?.remove(); hoverCard = null; }

function showHover(token) {
  const actor = token?.actor;
  if ( !actor ) return;
  ensureStyle();
  hideHover();
  const card = document.createElement("div");
  card.className = "bf-ev-card";
  card.dataset.token = token.id;
  const rows = rowsOf(actor);
  card.innerHTML = `<h4>${esc(token.name)} <span>${rows.length} effect${rows.length === 1 ? "" : "s"}</span></h4>${listHTML(actor, { withMarks: true })}`;
  placeBeside(card, token);
  document.body.appendChild(card);
  hoverCard = card;
}

/** Seat a card at the token's top-right corner, in screen space, kept on screen. */
function placeBeside(card, token) {
  const p = canvas.clientCoordinatesFromCanvas?.({ x: token.x + token.w, y: token.y }) ?? { x: 0, y: 0 };
  card.style.left = `${Math.max(8, Math.min(p.x + 8, window.innerWidth - 300))}px`;
  card.style.top = `${Math.max(8, Math.min(p.y - 6, window.innerHeight - 200))}px`;
}

Hooks.on("hoverToken", (token, hovered) => {
  try {
    if ( !setting(S.effectHover) ) return;
    if ( hovered ) showHover(token); else if ( hoverCard?.dataset.token === token.id ) hideHover();
  } catch(err) { console.error(`${MODULE_ID} | effect view (hover) failed.`, err); }
});

/* --- the held key --------------------------------------------------------------------------- */

const overlay = new Map();

function clearOverlay() { for ( const el of overlay.values() ) el.remove(); overlay.clear(); }

function showOverlay() {
  ensureStyle();
  clearOverlay();
  for ( const token of (canvas.tokens?.placeables ?? []) ) {
    if ( !token.actor || !token.visible ) continue;
    const rows = rowsOf(token.actor);
    if ( !rows.length ) continue;
    const card = document.createElement("div");
    card.className = "bf-ev-card";
    card.innerHTML = `<h4>${esc(token.name)}</h4>${listHTML(token.actor)}`;
    placeBeside(card, token);
    document.body.appendChild(card);
    overlay.set(token.id, card);
  }
}

Hooks.on("highlightObjects", active => {
  try {
    if ( !setting(S.effectHover) ) return;
    if ( active ) showOverlay(); else clearOverlay();
  } catch(err) { console.error(`${MODULE_ID} | effect view (held key) failed.`, err); }
});

/* --- the bar -------------------------------------------------------------------------------- */

/** Whose bar: the controlled token, else the user's own character. */
function barActor() {
  return canvas.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;
}

function drawBar() {
  let bar = document.getElementById(`${ROOT_ID}-bar`);
  if ( !setting(S.effectBar) ) { bar?.remove(); return; }
  ensureStyle();
  if ( !bar ) {
    bar = document.createElement("div");
    bar.id = `${ROOT_ID}-bar`;
    document.body.appendChild(bar);
  }
  const actor = barActor();
  const rows = actor ? rowsOf(actor) : [];
  bar.classList.toggle("empty", !actor || !rows.length);
  if ( !actor ) return;
  const combat = game.combat?.started ? game.combat : null;
  const sub = combat ? `Round ${combat.round}${combat.combatant?.actor === actor ? " · your turn" : ""}` : "";
  const owner = actor.isOwner === true;
  const body = rows.length ? rows.map(r => chipHTML(r, { button: owner })).join("") : `<span class="bf-ev-none">nothing on them</span>`;
  bar.innerHTML = `<button type="button" class="who" aria-expanded="false" title="${owner ? "Every effect on " : ""}${esc(actor.name)}"><b>${esc(actor.name)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</button><div class="bf-ev-list">${body}</div>`;
  bar.dataset.actor = actor.uuid;
  if ( !bar.dataset.wired ) { wireBar(bar); bar.dataset.wired = "1"; }
  const hotbar = document.getElementById("hotbar");
  const above = hotbar ? (window.innerHeight - hotbar.getBoundingClientRect().top + 8) : 76;
  bar.style.bottom = `${above}px`;
}

/* --- the bar's actions (user ruling 2026-09-15) --------------------------------------------- */

/** Close whatever fold or panel is open on the bar. */
function closeFolds(bar) {
  for ( const el of bar.querySelectorAll(".bf-ev-fold, .bf-ev-panel") ) el.remove();
  for ( const b of bar.querySelectorAll("[aria-expanded='true']") ) b.setAttribute("aria-expanded", "false");
}

/** The actor the bar is drawn for — re-read at click time, never cached across draws. */
function barActorNow(bar) {
  const a = bar.dataset.actor ? fromUuidSync(bar.dataset.actor) : null;
  return (a instanceof Actor) ? a : barActor();
}

/** Open the one-action fold above a chip. */
function openFold(bar, chip, actor) {
  const row = everyRow(factsOf(actor), sheetOf(actor)).find(r => r.id === chip.dataset.row);
  if ( !row ) return;
  // The one write, for an owner (the GM owns every creature). Details was tried and dropped
  // (user, 2026-09-15: "didnt like it").
  const act = rowAction(row, { owner: actor.isOwner === true });
  if ( !act ) return;
  closeFolds(bar);
  const fold = document.createElement("div");
  fold.className = "bf-ev-fold";
  fold.innerHTML = `<button type="button" class="bf-ev-act ${act.action}" data-action="${act.action}" data-row="${esc(row.id)}">${esc(act.label)}</button>`;
  const host = chip.closest(".bf-ev-panel") ?? bar;
  host.appendChild(fold);
  const hr = host.getBoundingClientRect(), cr = chip.getBoundingClientRect();
  fold.style.left = `${Math.max(0, cr.left - hr.left)}px`;
  if ( host !== bar ) fold.style.bottom = `${hr.bottom - cr.top + 6}px`;
  chip.setAttribute("aria-expanded", "true");
  fold.querySelector("button")?.focus();
}

/** Open the full list above the name — every row, each a chip with its own fold. */
function openPanel(bar, who, actor) {
  closeFolds(bar);
  // ALL of them, grouped as the sheet groups them (user ruling 2026-09-15) — the bar's rule is
  // for the bar; the panel is the sheet's effects tab, in reach.
  const groups = panelGroups(factsOf(actor), sheetOf(actor));
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const panel = document.createElement("div");
  panel.className = "bf-ev-panel";
  panel.innerHTML = `<h4>${esc(actor.name)} — ${total} effect${total === 1 ? "" : "s"}</h4>`
    + (groups.length ? groups.map(g => `<div class="bf-ev-lbl">${esc(g.label)}</div><div class="bf-ev-list">${g.rows.map(r => chipHTML(r, { button: actor.isOwner === true })).join("")}</div>`).join("")
      : '<span class="bf-ev-none">nothing on them</span>');
  bar.appendChild(panel);
  who.setAttribute("aria-expanded", "true");
}

/** Do the fold's action: delete an actor's effect, disable an item's, clear a sheet row. */
async function doAction(actor, action, rowId) {
  if ( action === "clear" ) {
    if ( rowId === "sheet:tempHp" ) return actor.update({ "system.attributes.hp.temp": 0 });
    if ( rowId === "sheet:inspiration" ) return actor.update({ "system.attributes.inspiration": false });
    return;
  }
  const effect = [...(actor.allApplicableEffects?.() ?? actor.effects)].find(e => e.id === rowId);
  if ( !effect ) return;
  if ( action === "remove" ) return effect.delete();
  if ( action === "disable" ) return effect.update({ disabled: true });
}

function wireBar(bar) {
  bar.addEventListener("click", ev => {
    try {
      const actor = barActorNow(bar);
      if ( !actor ) return;
      const act = ev.target.closest("button.bf-ev-act");
      if ( act ) {
        ev.preventDefault();
        closeFolds(bar);
        void doAction(actor, act.dataset.action, act.dataset.row).catch(err => console.error(`${MODULE_ID} | effect view (action) failed.`, err));
        return;
      }
      const chip = ev.target.closest("button.bf-ev-chip");
      if ( chip ) {
        ev.preventDefault();
        if ( chip.getAttribute("aria-expanded") === "true" ) { chip.closest(".bf-ev-panel") ? (bar.querySelector(".bf-ev-fold")?.remove(), chip.setAttribute("aria-expanded", "false")) : closeFolds(bar); }
        else openFold(bar, chip, actor);
        return;
      }
      const who = ev.target.closest("button.who");
      if ( who ) {
        ev.preventDefault();
        if ( who.getAttribute("aria-expanded") === "true" ) closeFolds(bar); else openPanel(bar, who, actor);
      }
    } catch(err) { console.error(`${MODULE_ID} | effect view (bar click) failed.`, err); }
  });
  // Anywhere else, or Escape: the folds close.
  document.addEventListener("pointerdown", ev => { if ( !bar.contains(ev.target) ) closeFolds(bar); });
  document.addEventListener("keydown", ev => { if ( ev.key === "Escape" ) closeFolds(bar); });
}

let barTimer = null;
/** Coalesce a burst of effect writes into one draw. */
function redrawBar() {
  if ( barTimer ) clearTimeout(barTimer);
  barTimer = setTimeout(() => { barTimer = null; try { drawBar(); } catch(err) { console.error(`${MODULE_ID} | effect view (bar) failed.`, err); } }, 50);
}

Hooks.on("canvasReady", redrawBar);
Hooks.on("controlToken", redrawBar);
Hooks.on("updateActor", redrawBar);          // temp HP and inspiration live on the actor
Hooks.on("createActiveEffect", redrawBar);
Hooks.on("updateActiveEffect", redrawBar);
Hooks.on("deleteActiveEffect", redrawBar);
Hooks.on("updateCombat", redrawBar);
Hooks.on("deleteCombat", redrawBar);
Hooks.on(`${MODULE_ID}.effectViewChanged`, redrawBar);   // the client switch, flipped
Hooks.once("ready", redrawBar);
