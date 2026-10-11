/**
 * Battle Flow — SERVICE (ARCHITECTURE.md §7): THE SHARED GALLERY — one creature picker two machines
 * route through: a summon's `cr`-mode pool (Find Familiar, Wild Companion) and Wild Shape's and the
 * polymorph spells' forms (issues #1, #2). The rows are ruled C (RULINGS *Summons*): the radio, the
 * token art, the name with its stat line and traits, and a right column the caller names. The pool is
 * every visible Actor pack's index (no document load, no permission); the filter is decide/gallery.js.
 * The placement preview lives here too: dnd5e's `TokenPlacement.place` is a canvas preview, no
 * permission needed, so a player places what the elect will create.
 */
import { TITLE } from "./core.js";
import { esc } from "./decide/present.js";
import { galleryRows, crLabel } from "./decide/gallery.js";

const ART = 44;

/**
 * Every visible Actor pack's npc index as pool rows, through the shared filter.
 * @param {{ crMax?: number|null, types?: string[]|null, fly?: boolean|null, sizes?: string[]|null, search?: string }} rule
 */
export async function poolFromPacks(rule = {}) {
  const fields = ["system.details.cr", "system.details.type.value", "system.traits.size", "system.attributes.movement.fly", "img", "type"];
  const rows = [];
  for ( const pack of game.packs.filter(p => (p.documentName === "Actor") && p.visible) ) {
    let index;
    try { index = await pack.getIndex({ fields }); } catch { continue; }
    for ( const e of index ) {
      if ( e.type !== "npc" ) continue;
      rows.push({ name: e.name, cr: Number(e.system?.details?.cr ?? Number.NaN), type: e.system?.details?.type?.value ?? "",
        size: e.system?.traits?.size ?? "", fly: Number(e.system?.attributes?.movement?.fly) > 0, pack: pack.collection, uuid: e.uuid, img: e.img ?? null });
    }
  }
  return galleryRows(rows, rule);
}

/** A creature's lines for a row: AC, HP, speeds, its attacks with their dice, its traits; blank when unknown. */
export function summaryOf(actor) {
  if ( !actor?.system ) return { ac: null, hp: null, speed: "", attacks: [], traits: [] };
  const sys = actor.system;
  const move = sys.attributes?.movement ?? {};
  const units = move.units ?? "ft";
  const speed = ["walk", "fly", "swim", "climb", "burrow"].filter(k => Number(move[k]) > 0)
    .map(k => (k === "walk") ? `${move[k]} ${units}` : `${k} ${move[k]}`).join(", ");
  const attacks = [];
  const traits = [];
  for ( const item of actor.items ?? [] ) {
    const acts = [...(item.system?.activities ?? [])];
    const attack = acts.find(a => a.type === "attack");
    if ( attack ) {
      const parts = (attack.damage?.parts ?? []).map(p => p.custom?.enabled ? p.custom.formula
        : `${p.number ?? 1}d${p.denomination ?? 6}${p.bonus ? ` + ${p.bonus}` : ""} ${(p.types ?? []).join("/")}`.trim());
      attacks.push(`${item.name}${parts.length ? ` · ${parts.join(", ")}` : ""}`);
    } else if ( (item.type === "feat") && !acts.length ) traits.push(item.name);
  }
  return { ac: sys.attributes?.ac?.value ?? null, hp: sys.attributes?.hp?.max ?? null, speed, attacks: attacks.slice(0, 3), traits: traits.slice(0, 3) };
}

/** The right column for a profile pick: AC and HP. */
export const statsRight = summary => [
  (summary?.ac !== null && summary?.ac !== undefined) ? `AC ${esc(summary.ac)}` : null,
  summary?.hp ? `${esc(summary.hp)} HP` : null
].filter(Boolean).join("<br>");

/** The right column for a pool pick: CR, size, book. */
export const poolRight = row => [
  `CR ${esc(crLabel(row.cr))}`,
  esc(CONFIG.DND5E?.actorSizes?.[row.size]?.label ?? row.size ?? ""),
  esc(game.packs.get(row.pack)?.metadata?.label ?? row.pack ?? "")
].filter(Boolean).join("<br>");

/**
 * One form row (ruled C): the radio, the art, the name over its stat line and traits, the right
 * column. `row` = { label, img, summary: { speed, attacks, traits } }; `right` is HTML lines.
 */
export function formRowHTML(row, { field, value, checked = false, right = "" }) {
  const s = row.summary ?? {};
  const line = [s.speed, ...(s.attacks ?? [])].filter(Boolean).join(" · ");
  const art = row.img ? `<img src="${esc(row.img)}" alt="" style="width:${ART}px;height:${ART}px;object-fit:cover;border-radius:3px;border:1px solid var(--color-border-dark,#0006);">`
    : `<span style="display:inline-block;width:${ART}px;height:${ART}px;border-radius:3px;background:rgba(0,0,0,0.15);"></span>`;
  return `<label data-bf-form style="display:grid;grid-template-columns:auto ${ART}px minmax(0,1fr) auto;gap:0.5rem;align-items:center;padding:0.3rem 0.45rem;border:1px solid var(--color-border-dark,#0006);border-radius:3px;margin-bottom:0.25rem;cursor:pointer;${checked ? "background:rgba(222,120,40,0.15);" : ""}">
    <input type="radio" name="${esc(field)}" value="${esc(value)}" ${checked ? "checked" : ""} style="margin:0;">
    ${art}
    <span style="min-width:0;line-height:1.25;"><b>${esc(row.label)}</b>${line ? `<br><span style="opacity:0.8;font-size:var(--font-size-11,11px);">${esc(line)}</span>` : ""}${(s.traits ?? []).length ? `<br><span style="opacity:0.65;font-size:var(--font-size-11,11px);">${esc(s.traits.join(" · "))}</span>` : ""}</span>
    <span style="text-align:right;font-size:var(--font-size-11,11px);white-space:nowrap;">${right}</span>
  </label>`;
}

/** A pool as a searchable list of rows; `wireGallerySearch` makes the search live once the dialog stands. */
export function poolListHTML(rows, { field, head = "The form" }) {
  return `<div style="margin-top:0.5rem;"><b>${esc(head)}</b> · ${rows.length} the rule allows, every book, one per name</div>
    <input type="search" name="bf-gallery-search" placeholder="Search by name" style="width:100%;margin:0.3rem 0;">
    <div data-bf-pool style="max-height:320px;overflow:auto;">${rows.map(r =>
      formRowHTML({ label: r.name, img: r.img, summary: { speed: r.fly ? "flies" : "", attacks: [], traits: [] } }, { field, value: r.uuid, right: poolRight(r) })).join("")}</div>`;
}

/** The search box filters the rows by name as the player types. */
export function wireGallerySearch(root) {
  const search = root?.querySelector?.('input[name="bf-gallery-search"]');
  if ( !search ) return;
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for ( const row of root.querySelectorAll("[data-bf-pool] [data-bf-form]") ) {
      row.style.display = !q || row.textContent.toLowerCase().includes(q) ? "" : "none";
    }
  });
}

/**
 * The placement preview on this client: `count` copies of the creature's prototype token placed from
 * the origin token's elevation, the squares confirmed; empty when cancelled on the map.
 * @param {{ originToken: TokenDocument|null, actorUuid: string, count: number }} facts
 * @returns {Promise<Array<{ x: number, y: number, elevation: number, rotation: number, level: string|null }>>}
 */
export async function previewPlacement({ originToken, actorUuid, count }) {
  const Placement = globalThis.dnd5e?.canvas?.TokenPlacement;
  if ( !Placement?.place ) throw new Error(`${TITLE}: dnd5e's TokenPlacement is not where the module expects it`);
  const actor = await fromUuid(actorUuid);
  if ( !actor?.prototypeToken ) throw new Error(`no creature at ${actorUuid}`);
  const placements = await Placement.place({ origin: originToken ?? undefined, tokens: Array(Math.max(1, Number(count) || 1)).fill(actor.prototypeToken) });
  return (placements ?? []).map(p => ({ x: p.x, y: p.y, elevation: p.elevation ?? 0, rotation: p.rotation ?? 0, level: p.level ?? null }));
}
