// STATIC SURFACES CHECK — no Foundry, no world, milliseconds.
//
// Every HTML anchor this module reads off the PLATFORM's markup lives in ONE map
// (`scripts/surfaces.js`), and every dnd5e-authored anchor in that map still appears in the
// dnd5e version `module.json` verifies.
//
// WHY (the dnd5e 6.0 pass, NOTES §2 *the 6.0 pass* §3b — user-ruled 2026-09-15): at 6.0 the card's DATA
// became the stable part and its HTML the unstable part. dnd5e says outright not to rely on the
// card's markup; it renders from templates that will move through 6.x. Two anchors broke on the
// day (`.card-buttons button[data-action]` — the usage card's buttons moved into an icon row; the
// concentration prompt matched by its CONTENT, which is gone) and nothing in the gate could see
// either: a selector that matches nothing throws nothing and draws nothing, forever. This is the
// hook-dispatch gate's discipline (`check-hook-dispatch.mjs`, ARCHITECTURE §10 D10) applied to
// selectors, and it holds two rules:
//
//   (1) THE LITERAL RULE. No file under scripts/ but surfaces.js may contain a platform anchor's
//       text. One map, so the next template move is one edit — and so the count is honest.
//   (2) THE PIN. `tools/dnd5e-surfaces.json` records, for the verified dnd5e version, that each
//       dnd5e-authored anchor's PROOF text appears in the file the map names. It is GENERATED
//       (`--regen`) from the installed system and committed, like the hook artifact: bump the pin
//       without regenerating and this check fails until somebody reads the diff.
//
// ⚠ Core's anchors (`.message-content`, `[data-message-id]`, `.form-group`) are listed and
// literal-checked but NOT pinned: core's templates are not in the dnd5e install, and the hook
// gate found core's bundle unreadable for this purpose (its header says why). Reported, in writing.
//
//   node tools/check-surfaces.mjs               # the check (gate: npm run surfaces)
//   node tools/check-surfaces.mjs --regen       # re-read the installed dnd5e
//   node tools/check-surfaces.mjs --regen <dir> # ...from a specific systems/dnd5e directory
//
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";
import { SURFACES, SURFACE_SOURCES } from "../scripts/surfaces.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");
const ARTIFACT = join(ROOT, "tools", "dnd5e-surfaces.json");
const DEFAULT_SYSTEM_DIR = "C:/Users/sippelmc/AppData/Local/FoundryVTT/Data/systems/dnd5e";

/**
 * THE FRAGMENTS THE LITERAL RULE POLICES — the recognisable piece of each anchor, so a composed
 * selector (`${dialogButtons} button[data-action]`) written out by hand is caught too. Comments
 * are stripped before the search: prose may name an anchor, code may not.
 */
const FRAGMENTS = {
  messageContent: [".message-content"],
  messageId: ["[data-message-id]"],
  formGroup: [".form-group"],
  damageTray: ["damage-application"],
  cardSummary: [".card-summary"],
  summaryRow: [".save-summary"],
  dialogConfiguration: ['data-application-part="configuration"'],
  dialogButtons: ['data-application-part="buttons"'],
  dialogDefault: ["button[autofocus]"],
  dialogRoll: ['data-action="roll"'],
  dialogFooter: [".form-footer"]
};

const collapse = s => s.replace(/\s+/g, " ");
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1");
const toPosix = p => p.split(sep).join("/");

function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...jsFiles(full));
    else if (name.endsWith(".js")) out.push(full);
  }
  return out;
}

/* --- regen ---------------------------------------------------------------------------------- */

function regen(dir) {
  const version = JSON.parse(readFileSync(join(dir, "system.json"), "utf8")).version;
  const anchors = {};
  const cache = new Map();
  const read = file => {
    if (!cache.has(file)) {
      const full = join(dir, file);
      cache.set(file, existsSync(full) ? collapse(readFileSync(full, "utf8")) : null);
    }
    return cache.get(file);
  };
  for (const [key, source] of Object.entries(SURFACE_SOURCES)) {
    if (source.where !== "dnd5e") { anchors[key] = { where: source.where }; continue; }
    const text = read(source.file);
    anchors[key] = {
      where: "dnd5e", file: source.file, proof: source.proof,
      found: text !== null && text.includes(collapse(source.proof))
    };
  }
  let prev = { version: "(none)", anchors: {} };
  if (existsSync(ARTIFACT)) prev = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  const next = {
    $comment: "GENERATED — do not hand-edit. node tools/check-surfaces.mjs --regen",
    system: "dnd5e", version,
    source: "each dnd5e-authored anchor's proof text, searched (whitespace-collapsed) in the file scripts/surfaces.js names",
    anchors
  };
  writeFileSync(ARTIFACT, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`REGENERATED tools/dnd5e-surfaces.json from ${dir}`);
  console.log(`  dnd5e ${prev.version} -> ${version}`);
  for (const [key, a] of Object.entries(anchors)) {
    const before = prev.anchors?.[key];
    const mark = a.where !== "dnd5e" ? "core " : (a.found ? "ok   " : "GONE ");
    const change = before && (before.found !== a.found) ? `  (was ${before.found ? "ok" : "GONE"})` : "";
    console.log(`  ${mark} ${key.padEnd(20)} ${SURFACES[key]}${a.file ? `  ← ${a.file}` : ""}${change}`);
  }
  const gone = Object.values(anchors).filter(a => a.where === "dnd5e" && !a.found).length;
  console.log(gone ? `\n⚠ ${gone} anchor(s) no longer appear — fix the map (or the code) before the check can pass.`
    : "\nEvery dnd5e-authored anchor still appears. Now re-run the check.");
}

/* --- the check ------------------------------------------------------------------------------ */

const args = process.argv.slice(2);
if (args[0] === "--regen") {
  regen(args[1] ?? DEFAULT_SYSTEM_DIR);
  process.exit(0);
}

const failures = [];
const fail = (rule, msg) => failures.push(`${rule}: ${msg}`);

// (0) the map and its sources agree — every anchor has a source row, every source row an anchor.
for (const key of Object.keys(SURFACES)) if (!SURFACE_SOURCES[key]) fail("map", `SURFACES.${key} has no SURFACE_SOURCES row`);
for (const key of Object.keys(SURFACE_SOURCES)) if (!SURFACES[key]) fail("map", `SURFACE_SOURCES.${key} names no anchor in SURFACES`);
for (const key of Object.keys(SURFACES)) if (!FRAGMENTS[key]) fail("map", `SURFACES.${key} has no FRAGMENTS row in this file — say what text the literal rule polices`);

// (1) THE LITERAL RULE.
const files = jsFiles(SCRIPTS).filter(f => toPosix(relative(SCRIPTS, f)) !== "surfaces.js");
let literalSites = 0;
for (const file of files) {
  const rel = toPosix(relative(SCRIPTS, file));
  const code = stripComments(readFileSync(file, "utf8"));
  for (const [key, fragments] of Object.entries(FRAGMENTS)) {
    for (const fragment of fragments) {
      let at = code.indexOf(fragment);
      while (at !== -1) {
        literalSites++;
        const line = code.slice(0, at).split("\n").length;
        fail("one map", `scripts/${rel}:~${line} spells out the platform anchor "${fragment}" — read it as `
          + `SURFACES.${key} from scripts/surfaces.js instead (the 6.0 pass's posture, NOTES §2 *the 6.0 pass* §3b)`);
        at = code.indexOf(fragment, at + fragment.length);
      }
    }
  }
}

// (2) THE PIN.
if (!existsSync(ARTIFACT)) {
  fail("artifact", "tools/dnd5e-surfaces.json is missing — run --regen against the installed dnd5e");
} else {
  const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  const pinned = JSON.parse(readFileSync(join(ROOT, "module.json"), "utf8")).relationships?.systems
    ?.find(s => s.id === "dnd5e")?.compatibility?.verified;
  if (pinned !== artifact.version) {
    fail("version pin", `module.json verifies dnd5e ${pinned}, the surfaces artifact was read from `
      + `${artifact.version}. Re-run --regen against the version you are shipping against and READ THE DIFF`);
  }
  for (const [key, source] of Object.entries(SURFACE_SOURCES)) {
    const row = artifact.anchors?.[key];
    if (!row) { fail("artifact", `no row for SURFACES.${key} — run --regen`); continue; }
    if (source.where !== "dnd5e") continue;
    if ((row.file !== source.file) || (row.proof !== source.proof)) {
      fail("artifact", `SURFACES.${key}'s source changed since the artifact was generated — run --regen`);
    } else if (!row.found) {
      fail("anchor gone", `SURFACES.${key} (${SURFACES[key]}) — its proof "${source.proof}" no longer appears in `
        + `dnd5e ${artifact.version}'s ${source.file}. The selector may draw nothing: read the template, move the anchor`);
    }
  }
  for (const key of Object.keys(artifact.anchors ?? {})) {
    if (!SURFACES[key]) fail("stale row", `the artifact names ${key}, which SURFACES no longer holds — run --regen`);
  }
}

/* --- the report ----------------------------------------------------------------------------- */

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} surfaces failure(s).`);
  process.exit(1);
}

const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
const core = Object.values(SURFACE_SOURCES).filter(s => s.where === "core").length;
const dnd = Object.keys(SURFACES).length - core;
console.log(`THE PLATFORM ANCHORS THIS MODULE READS, AGAINST dnd5e ${artifact.version}'s SHIPPED MARKUP`);
for (const [key, selector] of Object.entries(SURFACES)) {
  const s = SURFACE_SOURCES[key];
  console.log(`  ${(s.where === "core" ? "core " : "ok   ")} ${key.padEnd(20)} ${selector}${s.file ? `  ← ${s.file}` : ""}`);
}
console.log(`\nPASS ${dnd} dnd5e anchors present at ${artifact.version}, ${core} core anchors listed and unchecked, `
  + `${literalSites} literal(s) outside the map (${files.length} files read).`);
