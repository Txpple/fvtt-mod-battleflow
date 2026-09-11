// STATIC MOMENT-COVERAGE CHECK — no Foundry, no world, milliseconds.
//
// THE GATE'S THIRD PART (decide/moments.js is the first, events.js the second — 2026-09-11, the
// user: "something architecturally solid so as this grows, it's not missed / no drift"). The
// events are only as complete as the registry, and a registry is only as complete as the thing
// that FAILS when a key is missing from it. This is that thing.
//
// What it asserts:
//   1. EVERY FLAG KEY THE MODULE WRITES is classified — in `MOMENT_RECORDS` (a resolve, published)
//      or in `STATE_KEYS` (state, with a written reason). A key in neither fails the build. A key
//      in both fails the build. The scan covers every write shape the tree uses: `setFlag(MODULE_ID,
//      "key")`, `queueFlagWrite(doc, "key")`, `flags.${MODULE_ID}.key` paths, and the keys of every
//      `[MODULE_ID]: { … }` literal (a message's birth flags, an ActiveEffect's fingerprint, a relay
//      envelope and its flat siblings) — with `[CONST]` keys resolved through the tree's own
//      `const NAME = "literal"` declarations. Reads are not writes and are not scanned.
//   2. NO STALE ROW. A key in either list that nothing writes any more fails — the layers check's
//      rule (a pin whose edge has gone is a lie about the tree), applied here.
//   3. EVERY FILE THAT WRITES THE WORLD IS PINNED in `WORLD_WRITERS` below with the record(s) its
//      writes resolve into, or a reason — amendment 1 of the design (the user, 2026-09-11): a
//      resolve that lands on an actor or an item alone, never on a message, is invisible to a gate
//      that watches messages, so every such site is looked at once and written down. A writer with
//      no pin fails; a pin whose file writes nothing any more fails.
//   4. THE REGISTRY'S OWN SHAPE — every row's words are in the vocabulary, every row says what it
//      means, every state reason is a sentence (≥ 20 characters).
//
// It PRINTS the classification as a table, so the docs have something to be wrong about.
//
//   node tools/check-moments.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { MOMENT_RECORDS, MOMENT_WORDS, STATE_KEYS } from "../scripts/decide/moments.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");

const failures = [];
const passes = [];
const fail = (what, detail) => failures.push(`${what} — ${detail}`);
const pass = what => passes.push(what);

/* --- the files --------------------------------------------------------------------------------- */

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".js")) out.push(p);
  }
  return out;
}
/**
 * Comments blanked — a `'` in "the caster's" would otherwise open a string the key scan never
 * closes. Blanked, not removed: every character becomes a space and every newline stays, so an
 * index into the stripped text is an index into the source and the lines this tool prints are the
 * source's. Rough on purpose: block comments and whole-line `//` comments go; a trailing `// …` on
 * a code line stays (it cannot carry a key).
 */
const blank = text => text.replace(/[^\n]/g, " ");
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/.*$/gm, blank);
const files = walk(SCRIPTS).map(p => ({ rel: relative(SCRIPTS, p).split("\\").join("/"), src: stripComments(readFileSync(p, "utf8")) }));

/* --- the constants a key may be written through ------------------------------------------------ */

const CONSTS = new Map();
for (const f of files) {
  for (const m of f.src.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*"([^"]+)"/g)) CONSTS.set(m[1], m[2]);
}
const resolveKey = raw => {
  const k = raw.replace(/^-=/, "");
  if (/^[A-Z][A-Z0-9_]*$/.test(k)) return CONSTS.get(k) ?? null;
  return k;
};

/* --- the scan: every write site, by key -------------------------------------------------------- */

/** key → Set of "file:line" */
const writes = new Map();
const note = (key, f, at) => {
  if (!key) return;
  if (!writes.has(key)) writes.set(key, new Set());
  writes.get(key).add(`${f.rel}:${at}`);
};
const lineAt = (src, idx) => src.slice(0, idx).split("\n").length;

/**
 * The keys of one `{ … }` literal at the flag level. A key whose VALUE is an object (`hold: { … }`)
 * opens a nested scope that is skipped; a spread's own literal (`...(cond ? { reduceBy } : {})`)
 * is transparent, because its keys land beside the others. Returns the keys and the index past
 * the closing brace.
 */
function literalKeys(src, open) {
  const keys = [];
  let depth = 0;
  let i = open;
  const skipStack = [];           // per depth: true when this brace opened a VALUE object (skip its keys)
  let inStr = null;
  while (i < src.length) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") { i += 2; continue; }
      if (ch === inStr) inStr = null;
      i++; continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") { inStr = ch; i++; continue; }
    if (ch === "{") {
      const before = src.slice(Math.max(0, i - 40), i).replace(/\s+$/, "");
      const isValue = /:$/.test(before) && depth > 0;
      skipStack.push(isValue);
      depth++; i++; continue;
    }
    if (ch === "}") {
      depth--; skipStack.pop(); i++;
      if (depth === 0) return { keys, end: i };
      continue;
    }
    if (ch === "(" || ch === "[") {
      // a bracketed key `[CONST]:` — read it; anything else bracketed is skipped as a unit
      if (ch === "[" && /^\[\s*[A-Z][A-Z0-9_]*\s*\]\s*:/.test(src.slice(i))) {
        const m = /^\[\s*([A-Z][A-Z0-9_]*)\s*\]\s*:/.exec(src.slice(i));
        if (!skipStack.some(Boolean)) keys.push({ raw: m[1], at: i });
        i += m[0].length; continue;
      }
      // a SPREAD's group (`...(cond ? { k } : {})`) is transparent — its literals' keys land at our
      // level; any other group (a call's arguments, an index) is a value and is skipped whole
      const spread = ch === "(" && /\.\.\.\s*$/.test(src.slice(Math.max(0, i - 6), i));
      // skip a balanced (…) / […] group, honouring strings
      const close = ch === "(" ? ")" : "]";
      let d = 0; let j = i; let s = null;
      while (j < src.length) {
        const c = src[j];
        if (s) { if (c === "\\") { j += 2; continue; } if (c === s) s = null; j++; continue; }
        if (c === "\"" || c === "'" || c === "`") { s = c; j++; continue; }
        if (c === ch) d++;
        else if (c === close) { d--; if (d === 0) { j++; break; } }
        else if (c === "{") {
          // an object literal INSIDE the group: a spread's keys land at our level; a call's are skipped
          const inner = literalKeys(src, j);
          if (spread && !skipStack.some(Boolean)) keys.push(...inner.keys);
          j = inner.end; continue;
        }
        j++;
      }
      i = j; continue;
    }
    // a plain key at this level: `name:` (not `?.name`, not `a.b:` (a label), not inside a value object)
    const m = /^([A-Za-z_$][\w$]*|"-=[A-Za-z_]\w*"|"[A-Za-z_]\w*")\s*:(?!:)/.exec(src.slice(i));
    const prev = src[i - 1] ?? "";
    if (m && !skipStack.some(Boolean)) {
      if (!/[\w$.?]/.test(prev)) keys.push({ raw: m[1].replace(/"/g, ""), at: i });
      i += m[0].length; continue;
    }
    // a SHORTHAND key at this level: `{ uuid, answer }` — an identifier in key position followed by `,` or `}`
    const sh = /^([A-Za-z_$][\w$]*)\s*(?=[,}])/.exec(src.slice(i));
    if (sh && !skipStack.some(Boolean) && !/[\w$.?]/.test(prev)) {
      const behind = src.slice(Math.max(0, i - 40), i).replace(/\s+$/, "");
      if (/[{,]$/.test(behind)) keys.push({ raw: sh[1], at: i });
      i += sh[0].length; continue;
    }
    i++;
  }
  return { keys, end: i };
}

for (const f of files) {
  const src = f.src;
  for (const m of src.matchAll(/\b(?:setFlag|unsetFlag)\(MODULE_ID,\s*("([^"]+)"|([A-Z][A-Z0-9_]*))/g)) note(resolveKey(m[2] ?? m[3]), f, lineAt(src, m.index));
  for (const m of src.matchAll(/\bqueueFlagWrite\(\s*[\w.]+\s*,\s*("([^"]+)"|([A-Z][A-Z0-9_]*))/g)) note(resolveKey(m[2] ?? m[3]), f, lineAt(src, m.index));
  for (const m of src.matchAll(/flags\.\$\{MODULE_ID\}\.(?:\$\{([A-Z][A-Z0-9_]*)\}|(-=)?([A-Za-z_]\w*))/g)) note(resolveKey(m[1] ?? m[3]), f, lineAt(src, m.index));
  for (const m of src.matchAll(/\[MODULE_ID\]\s*:\s*\{/g)) {
    const open = m.index + m[0].length - 1;
    const { keys } = literalKeys(src, open);
    for (const k of keys) note(resolveKey(k.raw), f, lineAt(src, k.at));
  }
}

/* --- 1 + 2: every written key classified once; no stale row --------------------------------- */

const resolveKeys = new Set(Object.keys(MOMENT_RECORDS));
const stateKeys = new Set(Object.keys(STATE_KEYS));
const written = [...writes.keys()].sort();

const unclassified = written.filter(k => !resolveKeys.has(k) && !stateKeys.has(k));
if (unclassified.length) {
  for (const k of unclassified) {
    fail("unclassified key", `"${k}" is written (${[...writes.get(k)].slice(0, 3).join(", ")}) and is in neither MOMENT_RECORDS nor STATE_KEYS `
      + "(scripts/decide/moments.js) — is it a RESOLVE (add a row: what it means, what it publishes, its markers) or STATE (add a reason)?");
  }
} else pass(`every one of the ${written.length} written keys is classified`);

const both = [...resolveKeys].filter(k => stateKeys.has(k));
if (both.length) fail("key in both lists", both.join(", "));
else pass("no key is both a resolve and state");

for (const k of resolveKeys) if (!writes.has(k)) fail("stale row", `MOMENT_RECORDS."${k}" — nothing writes that key any more; remove the row`);
for (const k of stateKeys) if (!writes.has(k)) fail("stale row", `STATE_KEYS."${k}" — nothing writes that key any more; remove the row`);
if (!failures.some(f => f.startsWith("stale row"))) pass("no stale row in either list");

/* --- 3: every world-writing file pinned ------------------------------------------------------ */

/**
 * Files that write the WORLD other than through a message flag — a document update, an embedded
 * create or delete, an activity's use — and what their writes resolve into. A record key names the
 * message record that carries the resolve; a sentence says why none does. ⚠ Read before you add a
 * row: "its consequence lands as a receipt" is the house answer (state law 4), and a write that has
 * no receipt and no record is the class this table exists to catch.
 */
const WORLD_WRITERS = {
  "auto-apply.js": ["receipt"],
  "effect-riders.js": ["effectReceipt"],
  "receipts.js": ["receipt"],
  "mastery.js": ["effectReceipt", "receipt", "mastery"],
  "topple.js": ["topple", "effectReceipt"],
  "chip-spend.js": ["chipSpend"],
  "use-chips.js": ["useChip"],
  "hit-menu.js": ["hitManeuver", "sweepCard", "receipt"],
  "hit-riders.js": "the weapon's own damage parts, folded into the roll config before it rolls — the damage message is the platform's and its receipt the resolve",
  "sneak.js": ["sneakDamage", "effectReceipt"],
  "clock-riders.js": ["clockRiders", "poolSpend"],
  "command.js": ["commandRide"],
  "superiority-uses.js": ["superiorityUse", "superiorityRide", "baitSwitch", "effectReceipt"],
  "precision.js": ["precision"],
  "riposte.js": ["riposte"],
  "bash-offer.js": ["bashOffer"],
  "hew.js": "a reminder's card and its notice latch — presentation; the extra attack is a real roll with its own card",
  "d20-folds.js": ["d20fold", "tacticalRefund", "poolSpend"],
  "metamagic.js": ["metamagic", "empowered", "poolSpend"],
  "concentration.js": ["concentration", "effectReceipt"],
  "saves/ask.js": ["saves"],
  "saves/areas.js": ["saves"],
  "saves/choices.js": ["saves"],
  "saves/verdict.js": ["saves"],
  "saves/consequences.js": ["saves", "effectReceipt"],
  "hold/answer.js": ["hold", "effectReceipt"],
  "hold/continue.js": ["hold", "effectReceipt", "receipt"],
  "hold/spell-hold.js": ["hold"],
  "hold/trigger.js": ["hold"],
  "hold/views.js": "the hold's popup and row — presentation; the answer it collects lands on the hold record through hold/answer.js",
  "auto-damage.js": "the offer rolls the platform's damage — the damage message's own records (hitManeuver, clockRiders, sneakDamage, superiorityRide, receipt) are the resolves",
  "hold/spell-damage.js": ["receipt"],
  "hold/lookup.js": ["effectReceipt"],
  "damage-shields.js": ["damageShield", "shieldMark", "receipt"],
  "damage-casts.js": ["damageCast", "saves"],
  "emanations.js": ["emanationCard", "effectReceipt", "saves"],
  "volleys.js": ["volley", "receipt"],
  "cast.js": ["castApply", "effectReceipt", "receipt"],
  "reminders.js": "the gate before the roll — a dialog's default and a Fails press; the roll's verdict is the saves record's resolve",
  "stats.js": "the data plane's stamps and roster — stats, never a moment",
  "shared.js": "spine plumbing: turn chits written for the machines (their resolve is the record the machine writes), the pool spend helper (its record is poolSpend)",
  "ui.js": "spine plumbing: an envelope's cleanup delete, a popup's lifecycle — presentation",
  "core.js": "spine plumbing: the flag-write serializer every record goes through — the record is the resolve",
  "holds.js": "the hold registry — client-local memory, no world write; listed because its release deletes nothing",
  "events.js": "the gate itself — publishes, never writes"
};

/**
 * A world write: a document's update/create/use, an embedded create or delete, a document's own
 * `.delete()` (a Map's `.delete(key)` takes an argument and is not one), a roll posted, and every
 * house service that performs one (the receipt appliers, the status forcer, the pool and reaction
 * spenders, the turn chit writer).
 */
const WRITE_CALL = /\.(?:update|create|use|createEmbeddedDocuments|deleteEmbeddedDocuments|applyDamage|toggleStatusEffect|rollDamage|rollAttack|toMessage)\(|\.delete\(\)|\bChatMessage\.create\(|ActiveEffect\.implementation\.create\(|\b(?:applyDamagesWithReceipt|applyEffectsWithReceipt|applyEffectsTo|forceStatus|spendPoolUses|writeTurnChit|spendReaction|spendSuperiorityDie)\(/;
const writers = files.filter(f => WRITE_CALL.test(f.src)).map(f => f.rel);
for (const rel of writers) {
  if (!(rel in WORLD_WRITERS)) {
    fail("unpinned world writer", `scripts/${rel} writes the world (a document update, create, delete or use) and is not in WORLD_WRITERS `
      + "(tools/check-moments.mjs) — which message record carries its resolve? Pin the key(s), or the reason none does");
    continue;
  }
  const pin = WORLD_WRITERS[rel];
  if (Array.isArray(pin)) {
    for (const k of pin) {
      if (!resolveKeys.has(k)) fail("bad pin", `WORLD_WRITERS["${rel}"] names "${k}", which is not a MOMENT_RECORDS row`);
    }
  } else if (typeof pin !== "string" || pin.length < 20) fail("bad pin", `WORLD_WRITERS["${rel}"] needs record keys or a reason of a sentence`);
}
for (const rel of Object.keys(WORLD_WRITERS)) {
  if (!files.some(f => f.rel === rel)) fail("stale pin", `WORLD_WRITERS["${rel}"] — no such file`);
  else if (!writers.includes(rel) && Array.isArray(WORLD_WRITERS[rel])) fail("stale pin", `WORLD_WRITERS["${rel}"] — the file writes the world no more; remove the row`);
}
if (!failures.some(f => /world writer|pin/.test(f))) pass(`every one of the ${writers.length} world-writing files is pinned to its record(s)`);

/* --- 4: the registry's own shape ------------------------------------------------------------- */

for (const [k, row] of Object.entries(MOMENT_RECORDS)) {
  if (!Array.isArray(row.events) || !row.events.length) fail("row shape", `MOMENT_RECORDS."${k}" publishes under no word`);
  for (const w of row.events ?? []) if (!MOMENT_WORDS.includes(w)) fail("row shape", `MOMENT_RECORDS."${k}" publishes under "${w}", not in the vocabulary`);
  if (typeof row.means !== "string" || row.means.length < 20) fail("row shape", `MOMENT_RECORDS."${k}" does not say what resolving means`);
  if (typeof row.resolved !== "function") fail("row shape", `MOMENT_RECORDS."${k}" has no resolved()`);
}
for (const [k, why] of Object.entries(STATE_KEYS)) {
  if (typeof why !== "string" || why.length < 20) fail("state reason", `STATE_KEYS."${k}" — a reason is a sentence somebody will read`);
}
if (!failures.some(f => /row shape|state reason/.test(f))) pass(`${resolveKeys.size} resolve rows and ${stateKeys.size} state reasons are well-formed`);

/* --- the report -------------------------------------------------------------------------------- */

console.log("MOMENT COVERAGE — every flag key the module writes, classified\n");
const w = Math.max(...written.map(k => k.length), 8);
console.log(`  ${"key".padEnd(w)}  ${"class".padEnd(8)}  words / reason`);
for (const k of written) {
  const cls = resolveKeys.has(k) ? "RESOLVE" : stateKeys.has(k) ? "state" : "??";
  const what = resolveKeys.has(k) ? MOMENT_RECORDS[k].events.join(", ") : (STATE_KEYS[k] ?? "UNCLASSIFIED").slice(0, 70);
  console.log(`  ${k.padEnd(w)}  ${cls.padEnd(8)}  ${what}`);
}
console.log(`\n  ${written.length} keys: ${written.filter(k => resolveKeys.has(k)).length} resolves, ${written.filter(k => stateKeys.has(k)).length} state, `
  + `${unclassified.length} unclassified · ${MOMENT_WORDS.length} words · ${writers.length} world-writing files\n`);

for (const p of passes) console.log(`  PASS  ${p}`);
if (failures.length) {
  console.log("");
  for (const f of failures) console.log(`  FAIL  ${f}`);
  console.log(`\n${failures.length} failure(s).`);
  process.exit(1);
}
console.log("\nALL PASS");
