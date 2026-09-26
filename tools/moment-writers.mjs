// WHO WRITES WHICH RECORD — the flag-write scan and the world-writer pins, shared.
//
// Moved out of `check-moments.mjs` on 2026-09-23 because a second reader needed the same answer:
// the claim-proof half of `hook-coverage.mjs` (tools/claim-proof.mjs) asks "which moment kinds can
// this file's work publish?", and that is exactly the table the moments gate already keeps. Two
// readers, one scan — the `hook-registrations.mjs` precedent: SHARED BECAUSE THE TRICK IS SUBTLE.
// The comment-blanking, the `[CONST]` resolution and the literal walker below are the kind of
// machinery that gets copied, then fixed in one copy, and a claim report whose idea of "file X
// writes record K" drifted from the gate's would prove things the gate does not believe.
//
// ⚠ IMPORTING THIS RUNS THE SCAN — every file under scripts/, read and walked once, milliseconds.
// It is pure reading: no Foundry, no world, nothing written. What it exports:
//   - `files`          every scripts/ file, `{ rel, src }`, comments blanked (indices still line up)
//   - `writes`         flag key → Set of "file:line" — every site that WRITES that key
//   - `WORLD_WRITERS`  file → the record key(s) its world writes resolve into, or the reason none does
//   - `writers`        the files the WRITE_CALL scan says write the world
//   - `keysByFile()`   the `writes` map turned inside out: file → Set of keys it writes
//
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");

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

/* --- the world writers ---------------------------------------------------------------------- */

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
  "hit-menu.js": ["hitManeuver", "sweepCard", "receipt", "effectReceipt"],   // effectReceipt: Hill's Tumble's no-save press, receipted on the damage card (2026-09-24)
  "hit-riders.js": "the weapon's own damage parts, folded into the roll config before it rolls — the damage message is the platform's and its receipt the resolve",
  "sneak.js": ["sneakDamage", "effectReceipt"],
  "initiative-swap.js": ["initiativeSwap"],   // Alert's swap, landed by the elect (2026-09-25)
  "heal-rerolls.js": ["healReroll"],   // Healer's 1s rerolled on a healing roll (2026-09-25)
  "kit-tend.js": ["kitTend"],   // Healer's Battle Medic on the kit's use, landed by the elect (2026-09-25)
  "unarmed-dice.js": "the plain Unarmed Strike's damage formula swapped before it rolls — the damage message is the platform's and its receipt the resolve (unarmedDice: presentation)",
  "drop-to-one.js": ["dropToOne"],   // Relentless Endurance asked, Death Ward automatic (2026-09-25)
  "rest-grants.js": ["restSong"],   // Resourceful's own grant rides dnd5e's rest update (restGrant: presentation); Musician's song to allies is landed by the elect (2026-09-25)
  "advantage-buys.js": ["poolSpend"],   // Lucky's Advantage bought at the gate (2026-09-25): the use spent by hand, recorded on the roll's message
  "clock-riders.js": ["clockRiders", "poolSpend", "spellRiderCard", "receipt"],
  "token-lights.js": ["effectReceipt"],
  "command.js": ["commandRide"],
  "superiority-uses.js": ["superiorityUse", "superiorityRide", "baitSwitch", "effectReceipt"],
  "precision.js": ["precision"],
  "riposte.js": ["riposte"],
  "rebukes.js": ["rebuke"],
  "damage-holds.js": ["damageHold", "receipt"],
  "bash-offer.js": ["bashOffer"],
  "hew.js": "a reminder's card and its notice latch — presentation; the extra attack is a real roll with its own card",
  "d20-folds.js": ["d20fold", "tacticalRefund", "poolSpend"],
  "metamagic.js": ["metamagic", "empowered", "poolSpend"],
  "damage-either.js": ["either"],   // Savage Attacker (Slice A, 2026-09-24): the patched rolls land with the record; a damage already applied moves through auto-apply.js's receipt
  "area-ask.js": ["metamagic", "areaChoice", "saves"],   // the ask at the area (2026-09-24, out of metamagic.js): its answer writes the metamagic record, a chosen area's choice and the demand it fills
  "concentration.js": ["concentration", "effectReceipt"],
  "saves/areas.js": ["saves"],
  "saves/choices.js": ["saves"],
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
  "emanations.js": ["emanationCard", "effectReceipt", "saves", "receipt"],
  "volleys.js": ["volley", "receipt"],
  "cast.js": ["castApply", "effectReceipt", "receipt"],
  "reminders.js": "the gate before the roll — a dialog's default and a Fails press; the roll's verdict is the saves record's resolve",
  "stats.js": "the data plane's stamps and roster — stats, never a moment",
  "effect-view.js": "the bar's fold on the user's own click: an effect deleted or disabled, temp HP or inspiration zeroed — the platform's own edits under the owner's permission, no module record and no moment (DESIGN §6, 2026-09-15)",
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

/**
 * The scan turned inside out — file (scripts/-relative) → the flag keys it writes. The claim report
 * reads it; the gate reads `writes` the other way round.
 * @returns {Map<string, Set<string>>}
 */
export function keysByFile() {
  const out = new Map();
  for (const [key, sites] of writes) {
    for (const site of sites) {
      const file = site.slice(0, site.lastIndexOf(":"));
      if (!out.has(file)) out.set(file, new Set());
      out.get(file).add(key);
    }
  }
  return out;
}

export { files, WORLD_WRITERS, writers, writes };
