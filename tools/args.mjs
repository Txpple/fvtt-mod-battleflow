/**
 * STRICT FLAGS for every live tool (#11): `node tools/battery.mjs --help` once ran the full battery
 * against the sandbox, because an unknown flag was silently ignored and the default is "run
 * everything". Here an argument a tool does not know prints its usage and exits 2 before anything
 * connects; `--help` / `-h` prints the usage and exits 0. No Foundry import, so `--list` and
 * `--help` cost nothing.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";

/**
 * The leading block comment of a script file, as its usage text: every tool's header is its manual,
 * so `--help` and a refused flag print it instead of a second copy that would drift.
 */
export function usageOf(file) {
  let src = "";
  try { src = readFileSync(file, "utf8"); } catch { return `usage: see the header of ${file}`; }
  const block = src.match(/^\/\*\*?([\s\S]*?)\*\//);
  if (block) return block[1].split("\n").map(l => l.replace(/^\s*\* ?/, "")).join("\n").trim();
  // The other header shape: a leading run of `//` lines.
  const lines = [];
  for (const l of src.split("\n")) {
    if (!l.startsWith("//")) break;
    lines.push(l.replace(/^\/\/ ?/, ""));
  }
  return lines.length ? lines.join("\n").trim() : `usage: see the header of ${file}`;
}

/**
 * Parse argv STRICTLY against `options` (plus `--help`/`-h`): an unknown flag or, unless
 * `allowPositionals`, a stray positional prints `usage` and exits 2; `--help` prints it and exits 0.
 * Returns parseArgs' `{ values, positionals }`.
 */
export function strictArgs({ options = {}, usage, argv = process.argv.slice(2), allowPositionals = false, script = basename(process.argv[1] ?? "tool") }) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: { ...options, help: { type: "boolean", short: "h" } },
      allowPositionals,
      strict: true
    });
  } catch (err) {
    console.error(`${script}: ${err.message}\n\n${usage}`);
    process.exit(2);
  }
  if (parsed.values.help) {
    console.log(usage);
    process.exit(0);
  }
  return parsed;
}
