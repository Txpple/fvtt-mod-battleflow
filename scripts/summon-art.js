/**
 * By the Books — MACHINE (ARCHITECTURE.md §7): THE ART WINDOWS — a table's own token and portrait for every
 * creature a spell summons (Summon Art, RULINGS *Summons*, call 15) and for every Wild Shape form (Wild Shape
 * Art, RULINGS *Wild Shape and the polymorph spells*). One window made from a spec: a searchable list on the
 * left (the spells alphabetical; the forms by CR), one row per creature in the picker's own row (gallery.js)
 * with a Token and a Portrait path, Find art over every Actor compendium, a folder's files filling the blanks
 * by name (`owl.webp`, `owl-portrait.webp`). Save writes the table once. Each opens from its own button in the
 * module's settings (GM only). The art is read where it is shown (gallery.js `summonArt`, `formArt`).
 */
import { MODULE_ID, S, TITLE, setting } from "./core.js";
import { artTag, esc } from "./decide/present.js";
import { ART_SPELLS, artKey, cleanTable, fillBlanks, matchFiles } from "./decide/summon-art.js";
import { SUMMON_GUISES, SUMMON_ONE_FORM } from "./decide/registry.js";
import { guisesOf, poolPicks } from "./decide/summons.js";
import { FORM_ART_KEY, describeCreature, listRowHTML, poolFromPacks, poolRuleOf } from "./gallery.js";
import { crLabel } from "./decide/gallery.js";
import { listenOnce } from "./dispatch.js";

/** Each group's creatures, read once a session (`<window>|<group>`): `{ key, name, img, summary }` rows, or null when unreadable. */
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
    // a one-form spell (Major Image) lands one creature under the spell's own name: one row, named so
    const one = Object.entries(SUMMON_ONE_FORM).find(([k]) => artKey(k) === artKey(spell.name))?.[1] ?? null;
    if ( one ) rows = [{ ...(rows.find(r => r.key === artKey(one.from)) ?? rows[0] ?? {}), key: artKey(one.name), name: one.name }];
    // a guised spell (Spiritual Weapon) lands its one creature as each guise: one row per guise, named so
    const guised = guisesOf(Object.entries(SUMMON_GUISES).find(([k]) => artKey(k) === artKey(spell.name))?.[1]);
    if ( guised.length && rows[0] ) rows = guised.map(g => ({ ...rows[0], key: artKey(g.name), name: g.name }));
  }
  return rows;
}

const FIELDS = Object.freeze([
  Object.freeze({ field: "token", label: "Token", hint: "the token on the map, the picker's row and the placement" }),
  Object.freeze({ field: "portrait", label: "Portrait", hint: "the creature's sheet" })
]);

const THUMB = 28;
const thumb = src => src
  ? artTag(src, `width:${THUMB}px;height:${THUMB}px;object-fit:cover;border-radius:3px;border:1px solid var(--color-border-dark,#0006);flex:none;`, "data-bf-art-thumb")
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
    <div style="display:flex;flex-direction:column;gap:0.2rem;margin-bottom:0.25rem;">${fields}
      <button type="button" data-bf-art-find title="Search every Actor compendium for art: the pick fills the token and the portrait" style="width:auto;align-self:flex-end;padding:0 0.6rem;"><i class="fa-solid fa-magnifying-glass"></i> Find art</button>
    </div>
    <div data-bf-art-finder hidden style="grid-column:1 / -1;border:1px solid var(--color-border-dark,#0006);border-radius:3px;padding:0.4rem;margin-bottom:0.4rem;">
      <input type="search" data-bf-art-find-query placeholder="Search the Actor compendiums: words in any order (spiritual mace yellow)" style="width:100%;">
      <div data-bf-art-find-results style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:0.35rem;max-height:260px;overflow-y:auto;margin-top:0.35rem;"></div>
    </div>
  </div>`;
}

/* --- the art finder: every Actor compendium's token art, by name ---------------------------------- */

/** Every Actor pack's entries, `{ name, pack, token, img }`, read once a session. */
let ACTOR_ART = null;
async function actorArt() {
  if ( ACTOR_ART ) return ACTOR_ART;
  const out = [];
  for ( const pack of game.packs.filter(p => p.documentName === "Actor" && p.visible) ) {
    try {
      const index = await pack.getIndex({ fields: ["img", "prototypeToken.texture.src"] });
      for ( const e of index ) {
        const token = e.prototypeToken?.texture?.src ?? null;
        if ( token || e.img ) out.push({ name: e.name, pack: pack.title, token: token ?? e.img, img: e.img ?? token });
      }
    } catch { /* an unreadable pack is skipped */ }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  ACTOR_ART = out;
  return out;
}

/** The finder's results for a query: every word in the name or the pack's title, the first 60. */
const findArt = (all, query) => {
  const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if ( !words.length ) return [];
  return all.filter(e => { const hay = `${e.name} ${e.pack}`.toLowerCase(); return words.every(w => hay.includes(w)); }).slice(0, 60);
};

/** One result: the token art (a video plays), the name, the pack. */
const findHTML = (e, i) => `<button type="button" data-bf-art-find-pick="${i}" title="${esc(`${e.name} (${e.pack})`)}" style="display:flex;flex-direction:column;align-items:center;gap:0.2rem;height:auto;padding:0.25rem;line-height:1.15;">
  ${artTag(e.token, "width:72px;height:72px;object-fit:contain;")}
  <span style="font-size:var(--font-size-11,11px);white-space:normal;">${esc(e.name)}</span>
  <span style="font-size:var(--font-size-10,10px);opacity:0.65;white-space:normal;">${esc(e.pack)}</span>
</button>`;

/** The spells, alphabetical (the list's order, whatever ART_SPELLS's). */
const spellsInOrder = () => [...ART_SPELLS].sort((a, b) => a.name.localeCompare(b.name));

/** Every beast the packs carry (the Wild Shape pool, uncapped), read once a session. */
let BEASTS = null;
const beasts = async () => (BEASTS ??= await poolFromPacks({ types: ["beast"] }));

/** The CR bands a Wild Shape form can be (a Moon Druid reaches CR 6). */
const FORM_CRS = Object.freeze([0, 0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6]);

/**
 * What each window lists: its groups (the left column, in order), a group's creature rows, the table key a
 * group's art is kept under, and its words.
 */
const SPECS = Object.freeze({
  summons: Object.freeze({ id: "bythebooks-summon-art", title: "Summon Art", setting: S.summonArt, noun: "spell",
    groups: spellsInOrder, rowsOf: creaturesOf, tableKey: g => artKey(g.name),
    search: "Search spells or creatures", saved: "the summon art is saved. It shows from the next summon.",
    note: "A creature summoned already keeps its art until it is summoned again." }),
  forms: Object.freeze({ id: "bythebooks-form-art", title: "Wild Shape Art", setting: S.formArt, noun: "CR",
    groups: () => FORM_CRS.map(cr => ({ name: `CR ${crLabel(cr)}`, cr })),
    rowsOf: async g => (await beasts()).filter(r => Number(r.summary?.cr) === g.cr)
      .map(r => ({ key: artKey(r.name), name: r.name, img: r.img ?? null, summary: r.summary }))
      .filter((r, i, all) => all.findIndex(o => o.key === r.key) === i).sort((a, b) => a.name.localeCompare(b.name)),
    tableKey: () => FORM_ART_KEY,
    search: "Search beasts by name", saved: "the Wild Shape art is saved. It shows from the next Wild Shape.",
    note: "A form already standing keeps its art until it is taken again." })
});

const FilePickerClass = () => foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;

const windowClasses = new Map();

/**
 * A window class per spec, made once at `init`: it extends Foundry's ApplicationV2, which is not there when
 * the module's files are read outside Foundry (the hook gates import every file). The group, the folder
 * match, the creatures, Save.
 * @param {"summons"|"forms"} kind
 */
function artWindow(kind) {
  if ( windowClasses.has(kind) ) return windowClasses.get(kind);
  const spec = SPECS[kind];
  const groupNamed = name => spec.groups().find(g => g.name === name) ?? spec.groups()[0] ?? null;
  /** A group's rows, read once a session (the creatures cache, per window). */
  const rowsOf = async g => {
    const k = `${kind}|${g.name}`;
    if ( !CREATURES.has(k) ) CREATURES.set(k, await spec.rowsOf(g));
    return CREATURES.get(k);
  };
  const cached = name => CREATURES.get(`${kind}|${name}`) ?? null;
  const cls = class ArtWindow extends foundry.applications.api.ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: spec.id,
      tag: "div",
      window: { title: spec.title, icon: "fa-solid fa-images", resizable: true },
      position: { width: 1000, height: 720 }
    };

    /** The whole table being edited, saved at once. */
    table = foundry.utils.deepClone(setting(spec.setting) ?? {});
    spell = spec.groups()[0]?.name ?? "";
    spellSearch = "";
    folder = "";
    source = "data";
    search = "";

    /** This spell's entries in the working table, made on first use. */
    entries() {
      const k = spec.tableKey(groupNamed(this.spell));
      this.table[k] ??= {};
      return this.table[k];
    }

    async _prepareContext() {
      const spell = groupNamed(this.spell);
      return { spell, rows: spell ? await rowsOf(spell) : null };
    }

    async _renderHTML({ spell, rows }) {
      const entries = this.entries();
      const set = Object.values(entries).filter(v => v?.token || v?.portrait).length;
      // the spell list: alphabetical, each with its count of art set, searchable by spell or creature name
      const spells = spec.groups().map(s => {
        const set = this.table[spec.tableKey(s)] ?? {};
        const names = (cached(s.name) ?? []).map(r => r.name);
        const n = (kind === "forms") ? (cached(s.name) ?? []).filter(r => set[r.key]?.token || set[r.key]?.portrait).length
          : Object.values(set).filter(v => v?.token || v?.portrait).length;
        return `<button type="button" data-bf-art-pick-spell="${esc(s.name)}" data-bf-art-spell-hay="${esc(`${s.name.toLowerCase()} | ${names.join(" | ").toLowerCase()}`)}"
          style="display:flex;justify-content:space-between;gap:0.4rem;width:100%;text-align:left;margin:0 0 0.15rem;${s.name === this.spell ? "background:rgba(222,120,40,0.25);" : ""}">
          <span>${esc(s.name)}</span>${n ? `<span style="opacity:0.7;">${n}</span>` : ""}</button>`;
      }).join("");
      const list = (rows === null)
        ? `<p style="opacity:0.8;">${esc(spell?.name ?? "This spell")} could not be read from the compendium, so its creatures cannot be listed.</p>`
        : rows.length ? rows.map(r => creatureHTML(r, entries[r.key])).join("")
          : `<p style="opacity:0.8;">${(kind === "forms") ? "No beast the packs carry is of this CR." : "This spell summons no creature the packs carry."}</p>`;
      return `<div style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:0.6rem;height:100%;">
      <div style="display:flex;flex-direction:column;gap:0.35rem;min-height:0;">
        <input type="search" data-bf-art-spell-search value="${esc(this.spellSearch)}" placeholder="${esc(spec.search)}">
        <div data-bf-art-spells style="flex:1;overflow-y:auto;">${spells}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.5rem;min-height:0;">
        <div style="display:grid;grid-template-columns:auto 1fr;gap:0.35rem 0.6rem;align-items:center;">
          <b>${esc(spell?.name ?? "")}</b><span></span>
          <label for="bf-art-folder"><b>Folder</b></label>
          <div style="display:flex;gap:0.3rem;">
            <input id="bf-art-folder" type="text" data-bf-art-folder value="${esc(this.folder)}" placeholder="a folder of art, files named after the creatures" style="flex:1;min-width:0;">
            <button type="button" data-bf-art-folder-browse title="Browse" style="flex:none;width:28px;"><i class="fa-solid fa-folder-open"></i></button>
            <button type="button" data-bf-art-match style="flex:none;width:auto;padding:0 0.6rem;"><i class="fa-solid fa-wand-magic-sparkles"></i> Match files</button>
          </div>
        </div>
        <p style="margin:0;font-size:var(--font-size-11,11px);opacity:0.75;">Match files fills the blanks only: <code>owl.webp</code> is the Owl's token, <code>owl-portrait.webp</code> its portrait. ${esc(spec.note)}</p>
        <input type="search" data-bf-art-search value="${esc(this.search)}" placeholder="${esc((kind === "forms") ? "Search this CR's beasts" : "Search this spell's creatures")}">
        <div data-bf-art-list style="flex:1;overflow-y:auto;padding-right:0.25rem;">${list}</div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <span data-bf-art-count style="flex:1;opacity:0.8;">${esc(`${set} ${set === 1 ? "creature has" : "creatures have"} art of the table's own`)}</span>
          <button type="button" data-bf-art-save style="flex:none;width:auto;padding:0 1rem;"><i class="fa-solid fa-floppy-disk"></i> Save</button>
          <button type="button" data-bf-art-close style="flex:none;width:auto;padding:0 1rem;">Close</button>
        </div>
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
        const row = cached(this.spell)?.find(r => r.key === key);
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

    /** The spell list narrowed to the search: a spell's name, or a creature's of the spells read so far. */
    filterSpells() {
      const words = this.spellSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
      for ( const el of this.element?.querySelectorAll("[data-bf-art-pick-spell]") ?? [] ) {
        const hay = el.dataset.bfArtSpellHay ?? "";
        el.style.display = words.every(w => hay.includes(w)) ? "" : "none";
      }
    }

    /** Each spell's creatures, read once, written onto the spell list's search text as they come in. */
    async warmCreatures() {
      for ( const s of spec.groups() ) {
        if ( cached(s.name) ) continue;
        const rows = await rowsOf(s).catch(() => null);
        const el = [...(this.element?.querySelectorAll("[data-bf-art-pick-spell]") ?? [])].find(b => b.dataset.bfArtPickSpell === s.name);
        if ( el ) el.dataset.bfArtSpellHay = `${s.name.toLowerCase()} | ${(rows ?? []).map(r => r.name).join(" | ").toLowerCase()}`;
      }
      this.filterSpells();
    }

    /** The art finder under a row: open it, search while typing, a pick fills the row's token and portrait. */
    wireFinder(rowEl) {
      const box = rowEl.querySelector("[data-bf-art-finder]");
      const query = box?.querySelector("[data-bf-art-find-query]");
      const results = box?.querySelector("[data-bf-art-find-results]");
      if ( !box || !query || !results ) return;
      let shown = [];
      const run = async () => {
        shown = findArt(await actorArt(), query.value);
        results.innerHTML = shown.length ? shown.map(findHTML).join("")
          : `<em style="opacity:0.7;">${query.value.trim() ? "nothing matches" : "type a name"}</em>`;
      };
      rowEl.querySelector("[data-bf-art-find]")?.addEventListener("click", () => {
        box.hidden = !box.hidden;
        if ( box.hidden ) return;
        if ( !query.value ) query.value = rowEl.dataset.bfArtName ?? "";
        query.focus();
        void run();
      });
      let timer = null;
      query.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { void run(); }, 200); });
      results.addEventListener("click", ev => {
        const pick = shown[Number(ev.target.closest("[data-bf-art-find-pick]")?.dataset.bfArtFindPick)];
        if ( !pick ) return;
        this.setField(rowEl, "token", pick.token);
        this.setField(rowEl, "portrait", pick.img);
        box.hidden = true;
      });
    }

    async matchFolder() {
      const folder = this.folder.trim();
      if ( !folder ) { ui.notifications?.warn(`${TITLE}: pick a folder first.`); return; }
      const rows = cached(this.spell) ?? [];
      let files = [];
      try {
        files = (await FilePickerClass().browse(this.source, folder))?.files ?? [];
      } catch(err) {
        ui.notifications?.error(`${TITLE}: the folder could not be read (${err?.message ?? err}).`);
        return;
      }
      const { art, filled } = fillBlanks(this.entries(), matchFiles(rows.map(r => r.name), files));
      this.table[spec.tableKey(groupNamed(this.spell))] = art;
      ui.notifications?.info(`${TITLE}: ${filled ? `${filled} ${filled === 1 ? "field" : "fields"} filled` : "nothing to fill"} from ${files.length} ${files.length === 1 ? "file" : "files"}.`);
      await this.render();
    }

    async save() {
      try {
        await game.settings.set(MODULE_ID, spec.setting, cleanTable(this.table));
        ui.notifications?.info(`${TITLE}: ${spec.saved}`);
        await this.close();
      } catch(err) {
        console.error(`${TITLE} | The ${spec.title} could not be saved.`, err);
        ui.notifications?.error(`${TITLE}: the ${spec.title} could not be saved (${err?.message ?? err}).`);
      }
    }

    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element;
      if ( !root ) return;
      for ( const btn of root.querySelectorAll("[data-bf-art-pick-spell]") ) {
        btn.addEventListener("click", () => { this.spell = btn.dataset.bfArtPickSpell; this.search = ""; void this.render(); });
      }
      root.querySelector("[data-bf-art-spell-search]")?.addEventListener("input", ev => { this.spellSearch = ev.currentTarget.value; this.filterSpells(); });
      this.filterSpells();
      // every spell's creatures read in the background, so the spell search finds a creature's name ("owl")
      void this.warmCreatures();
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
            new FP({ type: "imagevideo", current, callback: path => this.setField(rowEl, field, path) }).render(true);
          });
        }
        for ( const btn of rowEl.querySelectorAll("[data-bf-art-clear]") ) {
          btn.addEventListener("click", () => this.setField(rowEl, btn.dataset.bfArtClear, ""));
        }
        this.wireFinder(rowEl);
      }
      root.querySelector("[data-bf-art-save]")?.addEventListener("click", () => { void this.save(); });
      root.querySelector("[data-bf-art-close]")?.addEventListener("click", () => { void this.close(); });
      this.filter();
    }
  };
  windowClasses.set(kind, cls);
  return cls;
}

listenOnce("init", "summon-art", () => {
  game.settings.registerMenu(MODULE_ID, "summonArtMenu", {
    name: "Summon Art",
    label: "Summon Art…",
    hint: "Your own token and portrait for the creatures a spell summons, by spell then creature. Opens its own window: the spells in order with a search, Find art searches every Actor compendium (JB2A's included) by name, and a folder of files named after the creatures fills it in one click.",
    icon: "fa-solid fa-images",
    type: artWindow("summons"),
    restricted: true
  });
  game.settings.registerMenu(MODULE_ID, "formArtMenu", {
    name: "Wild Shape Art",
    label: "Wild Shape Art…",
    hint: "Your own token and portrait for each Wild Shape form, by beast. The same window as Summon Art: the forms by CR with a search, Find art over every Actor compendium, and a folder of files named after the beasts fills it in one click.",
    icon: "fa-solid fa-paw",
    type: artWindow("forms"),
    restricted: true
  });
});
