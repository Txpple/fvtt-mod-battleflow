// THE RELEASE ZIP — the gate first, then the archive, then the archive read back (NOTES §5 *Release*).
//
//   node tools/build-release.mjs                 build dist/fvtt-mod-battleflow.zip from the tree
//   node tools/build-release.mjs --tag v2.6.0    and refuse unless module.json's version is 2.6.0
//
// CI runs it on a pushed tag (.github/workflows/release.yml) and publishes what it builds; run by
// hand it is the dry run. There is no skip flag for the gate: a zip from a tree that fails
// `npm run verify` is not a release.
//
// The zip is written here, not by a shell tool: `Compress-Archive` writes backslash separators
// (the module installs as an empty shell) and the execution policy can refuse a PowerShell script.
// Entries are stored with forward slashes and a fixed timestamp, so the same tree gives the same bytes.
//
// The read-back proves what ships loads: no backslash entry, nothing missing, every relative
// import inside a packed script resolving to another entry, and every entry inflating to the
// tree's own bytes.
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(REPO, "dist", "fvtt-mod-battleflow.zip");
const ENTRY = "scripts/battleflow.js";

const fail = msg => {
  console.error(`build-release: ${msg}`);
  process.exit(1);
};

const tagAt = process.argv.indexOf("--tag");
const tag = tagAt > 0 ? process.argv[tagAt + 1] : null;
if (tagAt > 0 && !tag) fail("--tag needs a value, e.g. --tag v2.6.0");

console.log("build-release: running the gate (npm run verify)...");
try {
  execSync("npm run verify", { cwd: REPO, stdio: "inherit" });
} catch {
  fail("npm run verify failed - refusing to build a release from this tree");
}

const manifest = JSON.parse(readFileSync(join(REPO, "module.json"), "utf8"));
const version = manifest.version;
if (tag && tag !== `v${version}`) fail(`the tag is ${tag} but module.json says ${version} - run tools/bump-version.mjs`);
if (!manifest.download.includes(`/v${version}/`)) fail(`module.json's download URL does not name v${version}`);

/** Every .js file under scripts/, recursively, as a forward-slash path from the repo root. */
function scriptFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...scriptFiles(full));
    else if (name.endsWith(".js")) out.push(relative(REPO, full).split("\\").join("/"));
  }
  return out;
}

const names = [...scriptFiles(join(REPO, "scripts")), "module.json", "LICENSE", "README.md"];
if (!names.includes(ENTRY)) fail(`${ENTRY} (the esmodules entry) is missing`);

// 1980-01-01 00:00, the earliest DOS time.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/** A zip archive of `files` (name -> bytes), every entry deflated. */
function writeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBytes = Buffer.from(name, "utf8");
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

/** Read a zip back through its central directory: name -> inflated bytes, CRC checked. */
function readZip(buf) {
  const endAt = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endAt < 0) fail("the archive has no end-of-central-directory record");
  const count = buf.readUInt16LE(endAt + 10);
  let at = buf.readUInt32LE(endAt + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) fail(`central directory entry ${i} is malformed`);
    const method = buf.readUInt16LE(at + 10);
    const crc = buf.readUInt32LE(at + 16);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const localAt = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLen);
    const dataAt = localAt + 30 + buf.readUInt16LE(localAt + 26) + buf.readUInt16LE(localAt + 28);
    const raw = buf.subarray(dataAt, dataAt + size);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    if (crc32(data) !== crc) fail(`${name}: CRC mismatch`);
    out.set(name, data);
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const files = new Map(names.map(n => [n, readFileSync(join(REPO, n))]));
const zip = writeZip(files);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, zip);

const back = readZip(readFileSync(OUT));
const problems = [];
for (const name of back.keys()) if (name.includes("\\")) problems.push(`backslash separator: ${name}`);
for (const name of names) {
  if (!back.has(name)) problems.push(`missing from the archive: ${name}`);
  else if (!back.get(name).equals(files.get(name))) problems.push(`differs from the tree: ${name}`);
}
if (back.size !== names.length) problems.push(`${back.size} entries, expected ${names.length}`);
let imports = 0;
for (const [name, data] of back) {
  if (!name.endsWith(".js")) continue;
  for (const m of data.toString("utf8").matchAll(/(?:from\s+|import\s*\(?\s*)["'](\.[^"']+)["']/g)) {
    imports++;
    const target = posix.normalize(posix.join(posix.dirname(name), m[1]));
    if (!back.has(target)) problems.push(`import resolves to nothing in the archive: ${name} -> ${target}`);
  }
}
if (problems.length) fail(`do not ship this archive:\n  ${problems.join("\n  ")}`);

console.log(`fvtt-mod-battleflow v${version} -> ${relative(REPO, OUT).split("\\").join("/")}`);
console.log(`${zip.length.toLocaleString("en-US")} bytes, ${back.size} entries, ${imports} relative imports resolved, every entry equal to the tree`);
