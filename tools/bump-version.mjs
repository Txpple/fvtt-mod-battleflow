/**
 * THE VERSION BUMP — one command, both fields (NOTES §5 *Release*).
 *
 *   node tools/bump-version.mjs 1.22.0     set it exactly
 *   node tools/bump-version.mjs patch      1.21.0 -> 1.21.1
 *   node tools/bump-version.mjs minor      1.21.0 -> 1.22.0
 *   node tools/bump-version.mjs major      1.21.0 -> 2.0.0
 *   node tools/bump-version.mjs --check    read-only: are the two fields in step?
 *
 * ⚠ `module.json` CARRIES THE VERSION TWICE: `version` (what Foundry shows) and the `download`
 * URL's tag (where Foundry fetches the zip). `--check` lets the gate assert they are in step.
 * ⚠ IT DOES NOT COMMIT, TAG OR PUSH.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const MANIFEST = join(REPO, "module.json");

/** The tag the download URL must name, derived from the version — the two are never typed twice. */
const downloadFor = (repoUrl, version) =>
  `${repoUrl}/releases/download/v${version}/fvtt-mod-battleflow.zip`;

const raw = readFileSync(MANIFEST, "utf8");
const manifest = JSON.parse(raw);
const current = manifest.version;
const arg = process.argv[2];

if (!arg) {
  console.error("usage: node tools/bump-version.mjs <x.y.z|major|minor|patch|--check>");
  process.exit(2);
}

if (arg === "--check") {
  const want = downloadFor(manifest.url, current);
  if (manifest.download === want) {
    console.log(`module.json is in step: version ${current}, download names v${current}.`);
    process.exit(0);
  }
  console.error(`module.json is OUT OF STEP.\n  version:  ${current}\n`
    + `  download: ${manifest.download}\n  expected: ${want}`);
  process.exit(1);
}

const parts = current.split(".").map(Number);
if ((parts.length !== 3) || parts.some(Number.isNaN)) {
  console.error(`module.json version "${current}" is not x.y.z — refusing to guess.`);
  process.exit(2);
}
const [major, minor, patch] = parts;
const next = arg === "major" ? `${major + 1}.0.0`
  : arg === "minor" ? `${major}.${minor + 1}.0`
    : arg === "patch" ? `${major}.${minor}.${patch + 1}`
      : arg;

if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`"${arg}" is neither a bump keyword nor an x.y.z version.`);
  process.exit(2);
}
if (next === current) {
  console.error(`already at ${current} — nothing to do.`);
  process.exit(2);
}

// ⚠ TARGETED REPLACEMENT, not re-serializing: `module.json` is hand-maintained, and
// `JSON.stringify` would reflow the whole file around a two-line change.
let out = raw;
const swap = (label, from, to) => {
  if (!out.includes(from)) {
    console.error(`could not find the ${label} line to replace: ${from}`);
    process.exit(3);
  }
  out = out.replace(from, to);
};
swap("version", `"version": "${current}"`, `"version": "${next}"`);
swap("download", `"download": "${manifest.download}"`,
  `"download": "${downloadFor(manifest.url, next)}"`);

// Parse what we are about to write — a bump that produces invalid JSON must never reach disk.
try {
  const check = JSON.parse(out);
  if (check.version !== next) throw new Error(`version came back as ${check.version}`);
  if (check.download !== downloadFor(check.url, next)) throw new Error("download did not follow");
} catch (err) {
  console.error(`the rewritten manifest is not valid: ${err.message}`);
  process.exit(3);
}

writeFileSync(MANIFEST, out);
console.log(`module.json ${current} -> ${next}`);
console.log(`  version:  ${next}`);
console.log(`  download: ${downloadFor(manifest.url, next)}`);
console.log("Not committed, not tagged, not pushed — that is still yours.");
