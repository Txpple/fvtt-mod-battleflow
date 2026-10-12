/**
 * By the Books — MACHINE (ARCHITECTURE.md §7): THE SUMMON ART WINDOW — a table's own token and portrait for
 * every creature a spell summons (RULINGS *Summons*, call 15). One button in the module's settings opens
 * it (GM only); the setting it writes is kept out of the list. A spell select, then one row per creature
 * the spell can summon, in the picker's own row (gallery.js), with a Token and a Portrait path each; a
 * folder's files fill the blanks by name (`owl.webp`, `owl-portrait.webp`). Save writes the table once.
 * The art is read where it is shown: the picker's rows, the placement ghost and the landing (summons.js,
 * through gallery.js `summonArt`); a creature already standing keeps its art until it is summoned again.
 */
import { MODULE_ID, S, TITLE, setting } from "./core.js";
import { esc } from "./decide/present.js";
import { ART_SPELLS, artKey, cleanTable, fillBlanks, matchFiles } from "./decide/summon-art.js";
import { poolPicks } from "./decide/summons.js";
import { describeCreature, listRowHTML, poolFromPacks, poolRuleOf } from "./gallery.js";
import { listenOnce } from "./dispatch.js";

/** Each spell's creatures, read once a session: `{ key, name, img, summary }` rows, or null when unreadable. */
const CREATURES = new Map();

/** The spell's own item: its compendium entry, else the first visible spell of that name. */
async function spellItem(spell) {
  try {
    const item = await fromUuid(spell.uuid);
    if ( item ) return item;
  } catch { /* the book is not installed: look it up by name */ }
  for ( const pack of game.packs.filter(p => (p.documentName === "Item") && p.visible) ) {
    try {
      const hit = (await pack.getIndex()).find(e => (e.type === "spell") && (artKey(e.name) === artKey(spell.name)));
      if ( hit ) return await pack.getDocument(hit._id);
    } catch { /* an unreadable pack is skipped */ }
  }
  return null;
}

/**
 * Every creature a spell can summon, one row per name: a `cr`-mode profile's pool (the picker's own,
 * every book), else each profile's creature.
 * @param {{ name: string, uuid: string }} spell
 */
async function creaturesOf(spell) {
  if ( CREATURES.has(spell.name) ) return CREATURES.get(spell.name);
  const item = await spellItem(spell);
  const activity = [...(item?.system?.activities ?? [])].find(a => a.type === "summon") ?? null;
  let rows = null;
  if ( activity ) {
    const mode = activity.summon?.mode ?? null;
    const byKey = new Map();
    const add = (name, img, summary) => { const key = artKey(name); if ( key && !byKey.has(key) ) byKey.set(key, { key, name, img: img ?? null, summary }); };
    for ( const raw of activity.profiles ?? [] ) {
      const p = raw.toObject?.() ?? raw;
      const profile = { ...p, cr: (p.cr === "") ? null : (p.cr ?? null), types: [...(p.types ?? [])] };
      if ( poolPicks(profile, mode) ) for ( const r of await poolFromPacks(poolRuleOf(profile)) ) add(r.name, r.img, r.summary);
      else if ( profile.uuid ) {
        const d = await describeCreature(profile.uuid, { label: profile.name || "" });
        add(d.label, d.img, d.summary);
      }
    }
    rows = [...byKey.values()];
  }
  CREATURES.set(spell.name, rows);
  return rows;
}

const FIELDS = Object.freeze([
  Object.freeze({ field: "token", label: "Token", hint: "the token on the map, the picker's row and the placement" }),
  Object.freeze({ field: "portrait", label: "Portrait", hint: "the creature's sheet" })
]);

const THUMB = 28;
const thumb = src => src
  ? `<img src="${esc(src)}" alt="" data-bf-art-thumb style="width:${THUMB}px;height:${THUMB}px;object-fit:cover;border-radius:3px;border:1px solid var(--color-border-dark,#0006);flex:none;">`
  : `<span data-bf-art-thumb style="display:inline-block;width:${THUMB}px;height:${THUMB}px;border-radius:3px;background:rgba(0,0,0,0.15);flex:none;"></span>`;

/** One creature: the picker's row on the left (wearing the table's token when set), its two paths on the right. */
function creatureHTML(row, set) {
  const fields = FIELDS.map(({ field, label, hint }) => `
    <div style="display:flex;gap:0.3rem;align-items:center;" title="${esc(hint)}">
      ${thumb(set?.[field] ?? null)}
      <span style="width:4.2em;font-size:var(--font-size-11,11px);opacity:0.8;">${esc(label)}</span>
      <input type="text" data-bf-art-field="${esc(field)}" value="${esc(set?.[field] ?? "")}" placeholder="the book's own" style="flex:1;min-width:0;">
      <button type="button" data-bf-art-browse="${esc(field)}" title="Browse" style="flex:none;width:28px;"><i class="fa-solid fa-file-import"></i></button>
      <button type="button" data-bf-art-clear="${esc(field)}" title="Back to the book's own" style="flex:none;width:28px;"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join("");
  return `<div data-bf-art-row="${esc(row.key)}" data-bf-art-name="${esc(row.name.toLowerCase())}" style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:0.5rem;align-items:center;">
    <div data-bf-art-look>${listRowHTML({ label: row.name, img: set?.token || row.img, summary: row.summary })}</div>
    <div style="display:flex;flex-direction:column;gap:0.2rem;margin-bottom:0.25rem;">${fields}</div>
  </div>`;
}

const FilePickerClass = () => foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;

let windowClass = null;

/**
 * The window class, made once at `init`: it extends Foundry's ApplicationV2, which is not there when the
 * module's files are read outside Foundry (the hook gates import every file). The spell, the folder
 * match, the creatures, Save.
 */
function summonArtWindow() {
  if ( windowClass ) return windowClass;
  windowClass = class SummonArtWindow extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "bythebooks-summon-art",
      tag: "div",
      window: { title: "Summon Art", icon: "fa-solid fa-images", resizable: true },
      position: { width: 820, height: 700 }
    };

    /** The whole table being edited, saved at once. */
    table = foundry.utils.deepClone(setting(S.summonArt) ?? {});
    spell = ART_SPELLS[0]?.name ?? "";
    folder = "";
    source = "data";
    search = "";

    /** This spell's entries in the working table, made on first use. */
    entries() {
      const k = artKey(this.spell);
      this.table[k] ??= {};
      return this.table[k];
    }

    async _prepareContext() {
      const spell = ART_SPELLS.find(s => s.name === this.spell) ?? ART_SPELLS[0];
      return { spell, rows: spell ? await creaturesOf(spell) : null };
    }

    async _renderHTML({ spell, rows }) {
      const entries = this.entries();
      const set = Object.values(entries).filter(v => v?.token || v?.portrait).length;
      const options = ART_SPELLS.map(s => `<option value="${esc(s.name)}" ${s.name === this.spell ? "selected" : ""}>${esc(s.name)}</option>`).join("");
      const list = (rows === null)
        ? `<p style="opacity:0.8;">${esc(spell?.name ?? "This spell")} could not be read from the compendium, so its creatures cannot be listed.</p>`
        : rows.length ? rows.map(r => creatureHTML(r, entries[r.key])).join("") : "<p style=\"opacity:0.8;\">This spell summons no creature the packs carry.</p>";
      return `<div style="display:flex;flex-direction:column;gap:0.5rem;height:100%;">
        <div style="display:grid;grid-template-columns:auto 1fr;gap:0.35rem 0.6rem;align-items:center;">
          <label for="bf-art-spell"><b>Spell</b></label>
          <select id="bf-art-spell" data-bf-art-spell>${options}</select>
          <label for="bf-art-folder"><b>Folder</b></label>
          <div style="display:flex;gap:0.3rem;">
            <input id="bf-art-folder" type="text" data-bf-art-folder value="${esc(this.folder)}" placeholder="a folder of art, files named after the creatures" style="flex:1;min-width:0;">
            <button type="button" data-bf-art-folder-browse title="Browse" style="flex:none;width:28px;"><i class="fa-solid fa-folder-open"></i></button>
            <button type="button" data-bf-art-match style="flex:none;width:auto;padding:0 0.6rem;"><i class="fa-solid fa-wand-magic-sparkles"></i> Match files</button>
          </div>
        </div>
        <p style="margin:0;font-size:var(--font-size-11,11px);opacity:0.75;">Match files fills the blanks only: <code>owl.webp</code> is the Owl's token, <code>owl-portrait.webp</code> its portrait. A creature summoned already keeps its art until it is summoned again.</p>
        <input type="search" data-bf-art-search value="${esc(this.search)}" placeholder="Search by name">
        <div data-bf-art-list style="flex:1;overflow-y:auto;padding-right:0.25rem;">${list}</div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <span data-bf-art-count style="flex:1;opacity:0.8;">${esc(`${set} ${set === 1 ? "creature has" : "creatures have"} art of the table's own`)}</span>
          <button type="button" data-bf-art-save style="flex:none;width:auto;padding:0 1rem;"><i class="fa-solid fa-floppy-disk"></i> Save</button>
          <button type="button" data-bf-art-close style="flex:none;width:auto;padding:0 1rem;">Close</button>
        </div>
      </div>`;
    }

    _replaceHTML(result, content) {
      content.innerHTML = result;
    }

    /** One field set, in the table and on the row (its thumbnail, and the row's art for a token). */
    setField(rowEl, field, value) {
      const key = rowEl.dataset.bfArtRow;
      const entries = this.entries();
      const path = String(value ?? "").trim();
      entries[key] = { ...(entries[key] ?? {}), [field]: path || null };
      const input = rowEl.querySelector(`[data-bf-art-field="${field}"]`);
      if ( input && (input.value !== path) ) input.value = path;
      const box = input?.parentElement?.querySelector("[data-bf-art-thumb]");
      if ( box ) box.outerHTML = thumb(path || null);
      if ( field === "token" ) {
        const row = CREATURES.get(this.spell)?.find(r => r.key === key);
        const look = rowEl.querySelector("[data-bf-art-look]");
        if ( row && look ) look.innerHTML = listRowHTML({ label: row.name, img: path || row.img, summary: row.summary });
      }
      this.recount();
    }

    recount() {
      const n = Object.values(this.entries()).filter(v => v?.token || v?.portrait).length;
      const el = this.element?.querySelector("[data-bf-art-count]");
      if ( el ) el.textContent = `${n} ${n === 1 ? "creature has" : "creatures have"} art of the table's own`;
    }

    filter() {
      const q = this.search.trim().toLowerCase();
      for ( const el of this.element?.querySelectorAll("[data-bf-art-row]") ?? [] ) {
        el.style.display = (!q || (el.dataset.bfArtName ?? "").includes(q)) ? "" : "none";
      }
    }

    async matchFolder() {
      const folder = this.folder.trim();
      if ( !folder ) { ui.notifications?.warn(`${TITLE}: pick a folder first.`); return; }
      const rows = CREATURES.get(this.spell) ?? [];
      let files = [];
      try {
        files = (await FilePickerClass().browse(this.source, folder))?.files ?? [];
      } catch(err) {
        ui.notifications?.error(`${TITLE}: the folder could not be read (${err?.message ?? err}).`);
        return;
      }
      const { art, filled } = fillBlanks(this.entries(), matchFiles(rows.map(r => r.name), files));
      this.table[artKey(this.spell)] = art;
      ui.notifications?.info(`${TITLE}: ${filled ? `${filled} ${filled === 1 ? "field" : "fields"} filled` : "nothing to fill"} from ${files.length} ${files.length === 1 ? "file" : "files"}.`);
      await this.render();
    }

    async save() {
      try {
        await game.settings.set(MODULE_ID, S.summonArt, cleanTable(this.table));
        ui.notifications?.info(`${TITLE}: the summon art is saved. It shows from the next summon.`);
        await this.close();
      } catch(err) {
        console.error(`${TITLE} | The summon art could not be saved.`, err);
        ui.notifications?.error(`${TITLE}: the summon art could not be saved (${err?.message ?? err}).`);
      }
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element;
      if ( !root ) return;
      root.querySelector("[data-bf-art-spell]")?.addEventListener("change", ev => { this.spell = ev.currentTarget.value; void this.render(); });
      root.querySelector("[data-bf-art-folder]")?.addEventListener("change", ev => { this.folder = ev.currentTarget.value; });
      root.querySelector("[data-bf-art-folder-browse]")?.addEventListener("click", () => {
        const FP = FilePickerClass();
        new FP({ type: "folder", current: this.folder, callback: (path, picker) => {
          this.folder = path;
          this.source = picker?.activeSource ?? this.source;
          const input = root.querySelector("[data-bf-art-folder]");
          if ( input ) input.value = path;
        } }).render(true);
      });
      root.querySelector("[data-bf-art-match]")?.addEventListener("click", () => {
        void this.matchFolder().catch(err => console.error(`${TITLE} | The folder match failed.`, err));
      });
      root.querySelector("[data-bf-art-search]")?.addEventListener("input", ev => { this.search = ev.currentTarget.value; this.filter(); });
      for ( const rowEl of root.querySelectorAll("[data-bf-art-row]") ) {
        for ( const input of rowEl.querySelectorAll("[data-bf-art-field]") ) {
          input.addEventListener("change", () => this.setField(rowEl, input.dataset.bfArtField, input.value));
        }
        for ( const btn of rowEl.querySelectorAll("[data-bf-art-browse]") ) {
          btn.addEventListener("click", () => {
            const field = btn.dataset.bfArtBrowse;
            const FP = FilePickerClass();
            const current = rowEl.querySelector(`[data-bf-art-field="${field}"]`)?.value || this.folder;
            new FP({ type: "image", current, callback: path => this.setField(rowEl, field, path) }).render(true);
          });
        }
        for ( const btn of rowEl.querySelectorAll("[data-bf-art-clear]") ) {
          btn.addEventListener("click", () => this.setField(rowEl, btn.dataset.bfArtClear, ""));
        }
      }
      root.querySelector("[data-bf-art-save]")?.addEventListener("click", () => { void this.save(); });
      root.querySelector("[data-bf-art-close]")?.addEventListener("click", () => { void this.close(); });
      this.filter();
    }
  };
  return windowClass;
}

listenOnce("init", "summon-art", () => {
  game.settings.registerMenu(MODULE_ID, "summonArtMenu", {
    name: "Summon Art",
    label: "Summon Art…",
    hint: "Your own token and portrait for the creatures a spell summons, by spell then creature (Find Familiar first). Opens its own window; a folder of files named after the creatures fills it in one click.",
    icon: "fa-solid fa-images",
    type: summonArtWindow(),
    restricted: true
  });
});
