// STATIC COVERAGE-MAP CHECK — no Foundry, no world, milliseconds.
//
// The live suites' `COVERS` claims (tools/coverage-map.mjs), checked BOTH WAYS:
//
//   - every MACHINE-tier file under scripts/ is claimed by at least one battery suite — a machine
//     no suite claims is a machine `battery.mjs --changed` would never re-test;
//   - every claim names a machine that EXISTS — a rename fails here, so the map cannot rot in
//     place (the layer pins' self-expiry, tools/check-layers.mjs, applied to the claims);
//   - every ORDER suite declares COVERS, and every file that declares COVERS is in ORDER — an
//     unrun suite rots (battery.mjs's smoke-nogm lesson: the 15-second reminder survived six
//     weeks behind an assertion nobody re-ran);
//   - no claim names a SPINE file — core, spine, services and entry are covered by the full
//     battery, which is what a change to one of them selects;
//   - ORDER's own `needs` each resolve to a row above the suite that needs it.
//
// WHY (user ruling 2026-09-23, change-scoped live testing): a declared map is only worth the
// minutes it saves if nobody can let it drift. Both directions fail the build, the same shape as
// the layer pins and the moment gate: a claim is cheap to write and impossible to leave stale.
//
// ⚠ There is NO allowlist, on purpose. A machine that no suite genuinely drives is claimed by the
// suite that comes closest, with a comment on the claim saying so — the gap is then written where
// the next person adding a section will read it, instead of in an exemption nobody revisits.
//
//   node tools/check-coverage-map.mjs        exit 0 clean, 1 findings, 2 instrument failure
import { existsSync, readFileSync } from "node:fs";
import {
  declaringTools,
  importerIndex,
  isMachine,
  machineFiles,
  ORDER,
  orderProblems,
  parseCovers,
  scriptExists,
  suiteFile,
  suiteRows,
  tierOf
} from "./coverage-map.mjs";

const failures = [];
const fail = (rule, msg) => failures.push(`${rule}: ${msg}`);

let machines;
let importers;
let declaring;
try {
  machines = machineFiles();
  importers = importerIndex();
  declaring = declaringTools();
} catch (err) {
  console.error(`INSTRUMENT FAILURE: could not read scripts/ or tools/ — ${err.message}`);
  process.exit(2);
}

// (1) ORDER's own shape: every need resolves above its suite, no suite listed twice.
for (const p of orderProblems()) fail("order", p);

// (2) every ORDER suite declares COVERS, parseably.
const covers = new Map();
for (const { name } of suiteRows()) {
  const file = suiteFile(name);
  if (!existsSync(file)) {
    fail("no such suite", `ORDER lists ${name}, and tools/${name}.mjs does not exist`);
    continue;
  }
  let list;
  try {
    list = parseCovers(readFileSync(file, "utf8"));
  } catch (err) {
    fail("unreadable claim", `tools/${name}.mjs — ${err.message}`);
    continue;
  }
  if (!list) {
    fail("no COVERS", `tools/${name}.mjs is in the battery and declares no COVERS — add \`export `
      + "const COVERS = [...]` beside its SECTIONS: the machines (scripts-relative) its sections drive");
    continue;
  }
  covers.set(name, list);
}

// (3) a file that declares COVERS is a suite, and a suite not in ORDER never runs.
const inOrder = new Set(suiteRows().map(r => r.name));
for (const name of declaring) {
  if (!inOrder.has(name)) {
    fail("not in the battery", `tools/${name}.mjs declares COVERS but ORDER (tools/coverage-map.mjs) `
      + "does not list it — an unrun suite rots; add its row, or drop the claim with the suite");
  }
}

// (4) every claim names a machine that exists.
for (const [name, list] of covers) {
  const seen = new Set();
  for (const rel of list) {
    if (seen.has(rel)) fail("claimed twice", `tools/${name}.mjs claims ${rel} twice`);
    seen.add(rel);
    if (!scriptExists(rel)) {
      fail("stale claim", `tools/${name}.mjs claims ${rel}, and scripts/${rel} does not exist — `
        + "a rename or a removal; update the claim");
    } else if (!isMachine(rel)) {
      fail("spine claim", `tools/${name}.mjs claims ${rel} (${tierOf(rel) ?? "no tier"}) — spine files `
        + "are covered by the full battery, drop the claim");
    }
  }
}

// (5) every machine is claimed. The hint names the suites claiming its import neighbours — the
// machines it imports and the ones that import it — which is usually where it belongs.
const claimed = new Set([...covers.values()].flat());
const neighbours = rel => {
  const out = new Set(importers.get(rel) ?? []);
  for (const [to, froms] of importers) if (froms.has(rel)) out.add(to);
  return [...out].filter(isMachine);
};
for (const rel of machines) {
  if (claimed.has(rel)) continue;
  const near = [...new Set(neighbours(rel).flatMap(n =>
    [...covers].filter(([, list]) => list.includes(n)).map(([s]) => s)))].sort();
  fail("unclaimed machine", `scripts/${rel} is claimed by no battery suite`
    + (near.length ? ` — its import neighbours are claimed by ${near.join(", ")}` : ""));
}

/* --- the report --------------------------------------------------------------------------- */

if (failures.length) {
  console.error("");
  for (const f of failures) console.error(`FAIL ${f}`);
  console.error(`\n${failures.length} coverage-map finding(s). A claim is a suite's word that it `
    + "drives a machine; `battery.mjs --changed` re-runs exactly what the claims say.");
  process.exit(1);
}

console.log("THE COVERAGE MAP (tools/coverage-map.mjs — what battery.mjs --changed re-runs)");
const w = Math.max(...[...covers.keys()].map(n => n.length));
for (const row of ORDER) {
  if (row.reset) continue;
  console.log(`  ${row.name.padEnd(w)}  ${covers.get(row.name).join(" · ")}`);
}
console.log(`\nPASS every machine is claimed and every claim is a machine (${machines.length} machines, `
  + `${covers.size} suites, ${[...covers.values()].flat().length} claims).`);
