/**
 * Battle Flow — SPINE (ARCHITECTURE.md §7): the rule text, read from the book (RULINGS *The rule fold
 * reads the book*). A row points at its content — `{ item, uuid?, benefit? }`, or `{ page, key,
 * benefit? }` for dnd5e's rules pages (`page` "condition" | "mastery" | "rule") — and this reads that content,
 * enriched: the paragraph whose bold lead is the row's `benefit`, else the whole text. Nothing here
 * is copied from a book; a text the packs do not carry is no text.
 * The markup (decide/present.js `ruleLine`, `foldedRuleHTML`) carries the pointer; one observer fills
 * every pointer that reaches the page, on cards, popups and sheets alike.
 */
import { MODULE_ID, TITLE } from "./core.js";
import { identifierOf } from "./decide/registry.js";

const lower = s => String(s ?? "").toLowerCase();

/** The attribute the markup carries a pointer in, and the one a filled node gets. */
const REF = "data-bf-rule";
const DONE = "data-bf-rule-done";

/** The system's packs, the 2024 ones first: where an item pointer without a live `uuid` is looked for. */
const SYSTEM_PACKS = ["dnd5e.classes24", "dnd5e.origins24", "dnd5e.feats24", "dnd5e.spells24", "dnd5e.equipment24",
  "dnd5e.monsterfeatures24"];

/** A pointer's cache key. */
const keyOf = ref => JSON.stringify([ref?.item ?? null, ref?.uuid ?? null, ref?.page ?? null, ref?.key ?? null, ref?.benefit ?? null]);

/** @type {Map<string, Promise<string|null>>} */
const texts = new Map();

/** The document a pointer names: a rules page, the item at its `uuid`, else the system's copy by identifier. */
async function sourceOf(ref) {
  if ( ref.page ) {
    const uuid = (ref.page === "condition") ? CONFIG.DND5E.conditionTypes?.[ref.key]?.reference
      : (ref.page === "mastery") ? CONFIG.DND5E.weaponMasteries?.[ref.key]?.reference
      : (ref.page === "rule") ? CONFIG.DND5E.rules?.[ref.key] : null;
    return uuid ? fromUuid(uuid).catch(() => null) : null;
  }
  if ( ref.uuid ) {
    const doc = await fromUuid(ref.uuid).catch(() => null);
    if ( doc ) return doc;
  }
  const identifier = identifierOf(ref.item);
  for ( const id of SYSTEM_PACKS ) {
    const pack = game.packs.get(id);
    if ( !pack ) continue;
    const index = await pack.getIndex({ fields: ["system.identifier"] }).catch(() => null);
    const entry = index?.find(e => e.system?.identifier === identifier);
    if ( entry ) return pack.getDocument(entry._id).catch(() => null);
  }
  return null;
}

/** A paragraph's bold lead, "Guarded Mind" for "<strong>Guarded Mind.</strong> If you…", else null. */
function leadOf(node) {
  const strong = node.querySelector("strong");
  if ( !strong ) return null;
  const head = node.textContent.trim();
  const lead = strong.textContent.trim();
  return head.startsWith(lead) ? lower(lead.replace(/[.:]\s*$/, "")) : null;
}

/** The enriched text a pointer names, or null: private notes out, a roll link read as its words. */
async function readText(ref) {
  const doc = await sourceOf(ref);
  const html = doc?.text?.content ?? doc?.system?.description?.value ?? "";
  if ( !html ) return null;
  const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(html,
    { relativeTo: doc, secrets: false, rollData: { name: "creature" } });
  const box = document.createElement("div");
  box.innerHTML = enriched;
  for ( const secret of box.querySelectorAll("section.secret") ) secret.remove();
  // A roll link would roll outside the machine.
  for ( const link of box.querySelectorAll(".roll-link-group, .roll-link, .inline-roll, [data-action='roll']") ) {
    if ( link.isConnected ) link.replaceWith(document.createTextNode(link.textContent.replace(/\s+/g, " ").trim()));
  }
  if ( ref.benefit ) {
    const want = lower(ref.benefit);
    // "Poison" is the lead "Poison (Cost: 1d6)".
    const paragraph = [...box.querySelectorAll("p, li")].find(p => {
      const lead = leadOf(p);
      return !!lead && ((lead === want) || lead.startsWith(`${want} (`));
    });
    if ( paragraph ) return paragraph.outerHTML;
    console.warn(`${TITLE} | "${ref.benefit}" is no paragraph of ${doc.name}; the fold shows the whole text.`);
  }
  return box.innerHTML.trim() || null;
}

/**
 * The HTML a pointer names, or null; a plain string (a record written before pointers) is itself.
 * @param {object|string|null|undefined} ref
 * @returns {Promise<string|null>}
 */
export async function ruleTextFor(ref) {
  if ( !ref ) return null;
  if ( typeof ref === "string" ) return ref;
  const key = keyOf(ref);
  if ( !texts.has(key) ) {
    texts.set(key, readText(ref).catch(err => {
      console.warn(`${TITLE} | The rule text for ${ref.item ?? ref.key} could not be read.`, err);
      return null;
    }));
  }
  return texts.get(key);
}

/**
 * The rule as description HTML, for text written into a document (an effect's description, a
 * receipt's tooltip): the book's paragraph, a string quoted, or "".
 * @param {object|string|null|undefined} ref
 */
export async function ruleHTML(ref) {
  if ( !ref ) return "";
  if ( typeof ref === "string" ) return `<p><em>“${ref}”</em></p>`;
  return (await ruleTextFor(ref)) ?? "";
}

/** Fill one pointer node; with no text, the node and a fold around it go. */
async function fill(node) {
  node.setAttribute(DONE, "");
  let ref = null;
  try { ref = JSON.parse(node.getAttribute(REF)); } catch { ref = null; }
  const html = await ruleTextFor(ref);
  if ( html ) {
    node.innerHTML = html;
    return;
  }
  const fold = node.closest(`details[${REF}-fold]`);
  (fold ?? node).remove();
}

/** Every unfilled pointer under `root`. */
function fillUnder(root) {
  if ( !(root instanceof Element) ) return;
  if ( root.matches?.(`[${REF}]:not([${DONE}])`) ) void fill(root);
  for ( const node of root.querySelectorAll(`[${REF}]:not([${DONE}])`) ) void fill(node);
}

Hooks.once("ready", () => {
  fillUnder(document.body);
  new MutationObserver(records => {
    for ( const record of records ) for ( const node of record.addedNodes ) fillUnder(/** @type {Element} */ (node));
  }).observe(document.body, { childList: true, subtree: true });
});

// Read-only for the suites: what a pointer reads as on this client.
Hooks.once("init", () => {
  const mod = game.modules.get(MODULE_ID);
  if ( mod ) mod.api = Object.assign(mod.api ?? {}, { ruleTextFor });
});
