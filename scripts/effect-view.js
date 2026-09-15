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
 *                    turn passes
 * The bar and the hover card each have a CLIENT switch. The draft is on the branch
 * `effect-view` (2026-09-15) with decide/effect-view.js's two heuristics unruled.
 *
 * ⚠ This machine WRITES NOTHING — no flag, no message, no effect. It is a view.
 */
import { MODULE_ID, S, setting } from "./core.js";
import { CHIP_FLAG } from "./decide/chips.js";
import { allRows, marksHeldBy } from "./decide/effect-view.js";

const ROOT_ID = "bf-effect-view";

/* --- reading the sheet ---------------------------------------------------------------------- */

/** The platform's own duration label, minus its "None" — a clockless row says nothing. */
function clockLabel(effect) {
  const label = effect.duration?.label ?? "";
  return (!label || /^none$/i.test(label)) ? "" : label;
}

/** One effect as the decision layer wants it. */
function factOf(effect) {
  return {
    id: effect.id, name: effect.name, img: effect.img ?? null,
    active: effect.active === true, temporary: effect.isTemporary === true,
    worn: (effect.parent instanceof Item) && (effect.transfer === true),
    statuses: [...(effect.statuses ?? [])],
    chipKey: effect.getFlag?.(MODULE_ID, CHIP_FLAG) ?? null,
    clock: clockLabel(effect),
    origin: typeof effect.origin === "string" ? effect.origin : null
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

function chipHTML(row) {
  const icon = row.img ? `<img src="${esc(row.img)}" alt="">` : "";
  const tag = row.noIcon ? `<em title="This effect paints no icon on the token">no icon</em>` : "";
  const clock = row.clock ? `<span class="clk">${esc(row.clock)}</span>` : (row.detail ? `<span class="dtl">${esc(row.detail)}</span>` : "");
  return `<span class="bf-ev-chip ${row.tone}" title="${esc(row.name)}">${icon}<span class="txt"><span class="nm">${esc(row.name)}</span>${clock}</span>${tag}</span>`;
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
  bar.innerHTML = `<div class="who"><b>${esc(actor.name)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</div>${listHTML(actor)}`;
  const hotbar = document.getElementById("hotbar");
  const above = hotbar ? (window.innerHeight - hotbar.getBoundingClientRect().top + 8) : 76;
  bar.style.bottom = `${above}px`;
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
