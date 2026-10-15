// @ts-check
// THE CONTRACTS' SHAPES — a JSON Schema derived from recorded values by shape, the one algorithm the
// page recorder (tools/contract-recorder.mjs) and the contract tool (tools/contracts.mjs) share
// (ARCHITECTURE §11 *Adding a RECORD*; tools/README.md *The contracts*).
//
//   schemaOf(value, key)      one value's schema: its type, an object's properties and the keys it
//                             carries (`required`), an array's items, a document named not walked
//   mergeSchemas(a, b)        the union of two schemas: types joined, properties joined, a key
//                             required only where every object carried it
//   sampleOf(value, key)      a value reduced for a contract file: ids and clocks to placeholders,
//                             documents to their name
//   fieldsOf(schema)          every field path a schema names (`targets[].hit`, `parts.<id>`)
//   diffSchemas(doc, seen)    what a run saw that a contract does not name, and what it never saw
//
// ⚠ Every function here is SELF-CONTAINED: it names no module-scope binding but the other functions
// in `PAGE_FUNCTIONS`, because the recorder ships them to the page as source text (`PAGE_SOURCE`)
// and `evaluate` carries no closure. A constant a function needs is declared inside it.
// Offline, no Foundry; tests/contract-shapes.test.js.

/**
 * @typedef {object} Schema
 * @property {string|string[]} [type]
 * @property {string|string[]} [x-document]   a Foundry document stands here, named, never walked
 * @property {string|string[]} [x-class]      an instance of a class that is not a plain object
 * @property {Record<string, Schema>} [properties]
 * @property {Record<string, Schema>} [patternProperties]
 * @property {string[]} [required]
 * @property {Schema} [items]
 * @property {string[]} [examples]            the observed values of a field that names a choice
 * @property {boolean} [x-truncated]          deeper than the reader walks
 */

/**
 * The schema of one value. `key` is the property it sits under (a choice-naming key such as
 * `answer` or `outcome` keeps its short values as `examples`). A document is named
 * (`x-document`), never walked; a key that is a document id folds into one `patternProperties`
 * entry, so a map keyed by ids is one shape however many ids a run saw.
 * @param {any} value
 * @param {string|null} [key]
 * @param {number} [depth]
 * @param {WeakSet<object>|null} [seen]
 * @returns {Schema}
 */
export function schemaOf(value, key = null, depth = 0, seen = null) {
  const ID_KEY = /^[A-Za-z0-9]{16}$/;
  const CHOICE_KEYS = ["answer", "outcome", "status", "mode", "verdict", "trigger", "event", "how", "testKind", "companion", "kind"];
  const MAX_DEPTH = 12;
  if ( value === null ) return { type: "null" };
  const t = typeof value;
  if ( t === "string" ) {
    const s = /** @type {Schema} */ ({ type: "string" });
    if ( key && CHOICE_KEYS.includes(key) && (value.length <= 32) ) s.examples = [value];
    return s;
  }
  if ( (t === "number") || (t === "bigint") ) return { type: "number" };
  if ( t === "boolean" ) return { type: "boolean" };
  if ( (t === "undefined") || (t === "function") || (t === "symbol") ) return {};
  if ( depth >= MAX_DEPTH ) return { "x-truncated": true };
  const walked = seen ?? new WeakSet();
  if ( walked.has(value) ) return { "x-truncated": true };
  if ( typeof value.documentName === "string" ) return { type: "object", "x-document": value.documentName };
  walked.add(value);
  try {
    if ( Array.isArray(value) ) {
      /** @type {Schema} */
      const s = { type: "array" };
      for ( const v of value ) s.items = mergeSchemas(s.items ?? null, schemaOf(v, key, depth + 1, walked));
      return s;
    }
    const proto = Object.getPrototypeOf(value);
    if ( proto && (proto !== Object.prototype) && (Object.getPrototypeOf(proto) !== null) ) {
      const name = value?.constructor?.name;
      if ( name && (name !== "Object") ) return { type: "object", "x-class": name };
    }
    /** @type {Schema} */
    const s = { type: "object" };
    const required = [];
    for ( const [k, v] of Object.entries(value) ) {
      if ( v === undefined ) continue;
      const child = schemaOf(v, k, depth + 1, walked);
      if ( ID_KEY.test(k) && /[0-9]/.test(k) ) {
        s.patternProperties = s.patternProperties ?? {};
        s.patternProperties["^[A-Za-z0-9]{16}$"] = mergeSchemas(s.patternProperties["^[A-Za-z0-9]{16}$"] ?? null, child);
        continue;
      }
      s.properties = s.properties ?? {};
      s.properties[k] = child;
      required.push(k);
    }
    if ( required.length ) s.required = required.sort();
    return s;
  } finally {
    walked.delete(value);
  }
}

/**
 * The union of two schemas (either may be null). Types join; properties join, each merged where
 * both name it; a key stays `required` only when every object either side saw carried it (a side
 * that saw no object leaves the other's list alone); `examples` join, capped.
 * @param {Schema|null} a
 * @param {Schema|null} b
 * @returns {Schema}
 */
export function mergeSchemas(a, b) {
  const MAX_EXAMPLES = 12;
  if ( !a ) return b ? { ...b } : {};
  if ( !b ) return { ...a };
  /** @param {any} v @returns {string[]} */
  const list = v => (v === undefined) ? [] : (Array.isArray(v) ? v : [v]);
  /** @param {string[]} v @returns {string|string[]|undefined} */
  const one = v => (v.length === 0) ? undefined : (v.length === 1) ? v[0] : v;
  const types = [...new Set([...list(a.type), ...list(b.type)])].sort();
  const aObj = list(a.type).includes("object");
  const bObj = list(b.type).includes("object");
  /** @type {Schema} */
  const out = {};
  const type = one(types);
  if ( type !== undefined ) out.type = type;
  for ( const tag of /** @type {const} */ (["x-document", "x-class"]) ) {
    const v = one([...new Set([...list(a[tag]), ...list(b[tag])])].sort());
    if ( v !== undefined ) out[tag] = v;
  }
  for ( const group of /** @type {const} */ (["properties", "patternProperties"]) ) {
    const pa = a[group] ?? {};
    const pb = b[group] ?? {};
    const keys = [...new Set([...Object.keys(pa), ...Object.keys(pb)])].sort();
    if ( !keys.length ) continue;
    /** @type {Record<string, Schema>} */
    const merged = {};
    for ( const k of keys ) merged[k] = mergeSchemas(pa[k] ?? null, pb[k] ?? null);
    out[group] = merged;
  }
  const ra = a.required ?? [];
  const rb = b.required ?? [];
  const required = (aObj && bObj) ? ra.filter(k => rb.includes(k)) : (aObj ? ra : rb);
  if ( required.length ) out.required = [...required].sort();
  if ( a.items || b.items ) out.items = mergeSchemas(a.items ?? null, b.items ?? null);
  const examples = [...new Set([...(a.examples ?? []), ...(b.examples ?? [])])].sort();
  if ( examples.length ) out.examples = examples.slice(0, MAX_EXAMPLES);
  if ( a["x-truncated"] || b["x-truncated"] ) out["x-truncated"] = true;
  return out;
}

/**
 * A value reduced for a contract file's sample: a document id inside an id-naming field becomes
 * `<id>`, a clock reading (`at`, `…At`, `deadline`) becomes 0, a document becomes its name and a
 * class instance its class, and deep or long values are cut. The shape is the value's; only what changes run to run is masked.
 * @param {any} value
 * @param {string|null} [key]
 * @param {number} [depth]
 * @returns {any}
 */
export function sampleOf(value, key = null, depth = 0) {
  const ID = /(?<![A-Za-z0-9])[A-Za-z0-9]{16}(?![A-Za-z0-9])/g;
  const ID_FIELD = /(uuid|Uuid|Id|Ids)$|^(id|_id|marker|subject|messageId|momentId|attackId|regionId|tokenId|cardId)$/;
  const CLOCK_FIELD = /^(at|deadline|timestamp)$|At$/;
  const MAX_DEPTH = 8;
  const MAX_ITEMS = 6;
  if ( value === null || value === undefined ) return value ?? null;
  if ( typeof value === "string" ) return (key && ID_FIELD.test(key)) ? value.replace(ID, "<id>") : value;
  if ( typeof value === "number" ) return (key && CLOCK_FIELD.test(key)) ? 0 : value;
  if ( typeof value !== "object" ) return (typeof value === "boolean") ? value : null;
  if ( typeof value.documentName === "string" ) return { $document: value.documentName };
  if ( depth >= MAX_DEPTH ) return "…";
  const proto = Object.getPrototypeOf(value);
  if ( !Array.isArray(value) && proto && (proto !== Object.prototype) && (Object.getPrototypeOf(proto) !== null) ) {
    const name = value?.constructor?.name;
    if ( name && (name !== "Object") ) return { $class: name };
  }
  if ( Array.isArray(value) ) {
    const out = value.slice(0, MAX_ITEMS).map(v => sampleOf(v, key, depth + 1));
    if ( value.length > MAX_ITEMS ) out.push(`… ${value.length - MAX_ITEMS} more`);
    return out;
  }
  /** @type {Record<string, any>} */
  const out = {};
  for ( const [k, v] of Object.entries(value) ) {
    if ( v === undefined ) continue;
    out[/^[A-Za-z0-9]{16}$/.test(k) && /[0-9]/.test(k) ? "<id>" : k] = sampleOf(v, k, depth + 1);
  }
  return out;
}

/**
 * Every field path a schema names, sorted: `a.b` for a property, `a[]` for an array's items,
 * `a.<id>` for a map keyed by document ids. The root itself is not a path.
 * @param {Schema|null|undefined} schema
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function fieldsOf(schema, prefix = "") {
  /** @type {Set<string>} */
  const out = new Set();
  /** @param {Schema|null|undefined} s @param {string} at */
  const walk = (s, at) => {
    if ( !s ) return;
    for ( const [k, v] of Object.entries(s.properties ?? {}) ) {
      const p = at ? `${at}.${k}` : k;
      out.add(p);
      walk(v, p);
    }
    for ( const v of Object.values(s.patternProperties ?? {}) ) {
      const p = at ? `${at}.<id>` : "<id>";
      out.add(p);
      walk(v, p);
    }
    if ( s.items ) {
      const p = `${at}[]`;
      if ( at ) out.add(p);
      walk(s.items, p);
    }
  };
  walk(schema, prefix);
  return [...out].sort();
}

/**
 * What `seen` (a run's schema) holds that `documented` (a contract's) does not, and the reverse.
 * `added` are field paths the contract does not name (a new field: a contract change); `missing`
 * are documented paths the run never saw (reported, never a failure: a run need not reach every
 * branch); `widened` are paths the run saw with a type the contract does not list.
 * @param {Schema|null|undefined} documented
 * @param {Schema|null|undefined} seen
 * @returns {{ added: string[], missing: string[], widened: string[] }}
 */
export function diffSchemas(documented, seen) {
  const doc = new Set(fieldsOf(documented));
  const run = new Set(fieldsOf(seen));
  /** @param {any} v @returns {string[]} */
  const list = v => (v === undefined) ? [] : (Array.isArray(v) ? v : [v]);
  /** @param {Schema|null|undefined} s @param {string} path @returns {Schema|null} */
  const at = (s, path) => {
    let node = s ?? null;
    for ( const part of path.match(/[^.[\]]+|\[\]/g) ?? [] ) {
      if ( !node ) return null;
      if ( part === "[]" ) node = node.items ?? null;
      else if ( part === "<id>" ) node = Object.values(node.patternProperties ?? {})[0] ?? null;
      else node = node.properties?.[part] ?? null;
    }
    return node;
  };
  const widened = [];
  for ( const p of ["", ...run] ) {
    if ( p && !doc.has(p) ) continue;
    const want = list(at(documented, p)?.type);
    const got = list(at(seen, p)?.type);
    const extra = got.filter(t => !want.includes(t));
    if ( want.length && extra.length ) widened.push(`${p || "(root)"}: ${extra.join(", ")}`);
  }
  return {
    added: [...run].filter(p => !doc.has(p)).sort(),
    missing: [...doc].filter(p => !run.has(p)).sort(),
    widened
  };
}

/** The functions the page recorder needs, shipped as source. */
export const PAGE_FUNCTIONS = [schemaOf, mergeSchemas, sampleOf];

/** The page bundle: evaluate it inside a function and it returns `{ schemaOf, mergeSchemas, sampleOf }`. */
export const PAGE_SOURCE = `${PAGE_FUNCTIONS.map(fn => fn.toString()).join("\n")}\nreturn { schemaOf, mergeSchemas, sampleOf };`;
