import { describe, expect, it } from "vitest";
import {
  orderProblems,
  parseCovers,
  planFor,
  rowsFor,
  rowsFrom,
  suitesFor
} from "../tools/coverage-map.mjs";

// The change selector over a SMALL FAKE TREE — the real order, claims and import graph are the
// verify gate's to check (tools/check-coverage-map.mjs); what is pinned here is the selector's
// rules, so a fixture that cannot drift under them is the point.

const ORDER = [
  { name: "smoke-a" },
  { name: "smoke-b", needs: ["smoke-a"] },
  { name: "seed", reset: true },
  { name: "smoke-c", needs: ["seed"] },
  { name: "smoke-d" },
  { name: "seed", reset: true },
  { name: "smoke-e", needs: ["seed"] }
];

const TIERS = {
  "alpha.js": "machines",
  "beta.js": "machines",
  "gamma/index.js": "machines",
  "gamma/part.js": "machines",
  "lonely.js": "machines",
  "decide/pure.js": "decision",
  "decide/deep.js": "decision",
  "decide/shared.js": "decision",
  "decide/orphan.js": "decision",
  "registry.js": "registry",
  "ui.js": "spine",
  "core.js": "core",
  "entry.js": "entry"
};

// who imports whom, turned around: importer lists per file
const IMPORTERS = {
  "decide/pure.js": ["alpha.js"],
  "decide/deep.js": ["registry.js"],
  "registry.js": ["gamma/part.js"],
  "decide/shared.js": ["beta.js", "ui.js"],
  "alpha.js": ["entry.js"],
  "gamma/part.js": ["gamma/index.js"],
  "gamma/index.js": ["entry.js"],
  "beta.js": ["entry.js"]
};

const COVERS = new Map([
  ["smoke-a", ["alpha.js"]],
  ["smoke-b", ["beta.js"]],
  ["smoke-c", ["gamma/part.js"]],
  ["smoke-d", ["alpha.js", "gamma/index.js"]],
  ["smoke-e", ["beta.js"]]
]);

const ctx = {
  order: ORDER,
  covers: COVERS,
  tierOf: rel => TIERS[rel],
  importersOf: rel => IMPORTERS[rel] ?? []
};
const names = rows => rows.map(r => r.name);
const at = rows => rows.map(r => r.at);

describe("suitesFor — the rules", () => {
  it("(a) a machine selects every suite claiming it, in canonical order", () => {
    expect(names(suitesFor(["scripts/alpha.js"], ctx))).toEqual(["smoke-a", "smoke-d"]);
  });

  it("(b) a decide/ file selects the claimants of the machines that import it", () => {
    const plan = planFor(["scripts/decide/pure.js"], ctx);
    expect(names(plan.rows)).toEqual(["smoke-a", "smoke-d"]);
    expect(plan.full).toEqual([]);
    expect(plan.rows[0].why[0]).toMatch(/alpha\.js ← decide\/pure\.js/);
  });

  it("(b) the walk climbs through the registry tier, transitively, and stops at the machine", () => {
    // decide/deep.js ← registry.js ← gamma/part.js (machine) — gamma/index.js is NOT reached:
    // a machine's change is its claimants, so its dependency's change is no wider.
    const plan = planFor(["scripts/decide/deep.js"], ctx);
    expect(names(plan.rows)).toEqual(["seed", "smoke-c"]);
    expect(plan.rows[1].why[0]).toBe(
      "claims gamma/part.js ← registry.js ← decide/deep.js (changed)"
    );
  });

  it("(b) a walk that meets a spine importer is the full battery, and says which", () => {
    const plan = planFor(["scripts/decide/shared.js"], ctx);
    expect(plan.rows).toHaveLength(ORDER.length);
    expect(plan.full[0]).toMatch(/ui\.js, spine/);
  });

  it("(b) a decide/ file no machine imports runs nothing live", () => {
    const plan = planFor(["scripts/decide/orphan.js"], ctx);
    expect(plan.rows).toEqual([]);
    expect(plan.inert[0].why).toMatch(/unit tests/);
  });

  it("(c) a spine, core or entry file is the full battery, with the reason", () => {
    for (const f of ["scripts/ui.js", "scripts/core.js", "scripts/entry.js"]) {
      const plan = planFor([f], ctx);
      expect(at(plan.rows)).toEqual(ORDER.map((_r, i) => i));
      expect(plan.full).toHaveLength(1);
      expect(plan.full[0]).toContain(f);
    }
  });

  it("(c) a file the tier map does not know is the full battery", () => {
    expect(planFor(["scripts/new-thing.js"], ctx).full[0]).toMatch(/no tier/);
  });

  it("a machine no suite claims is the full battery, not silence", () => {
    expect(planFor(["scripts/lonely.js"], ctx).full[0]).toMatch(/no suite claims/);
  });

  it("(d) a changed suite selects itself; the harness is the full battery", () => {
    expect(names(suitesFor(["tools/smoke-d.mjs"], ctx))).toEqual(["smoke-d"]);
    expect(planFor(["tools/harness.mjs"], ctx).rows).toHaveLength(ORDER.length);
    expect(planFor(["tools/coverage-map.mjs"], ctx).full).toHaveLength(1);
  });

  it("(d) a changed seed selects every suite that needs it, each with its own seed", () => {
    expect(at(suitesFor(["tools/seed.mjs"], ctx))).toEqual([2, 3, 5, 6]);
  });

  it("(d) a probe or tool not in the order runs nothing", () => {
    const plan = planFor(["tools/probe-x.mjs", "tools/check-layers.mjs"], ctx);
    expect(plan.rows).toEqual([]);
    expect(plan.inert.map(i => i.why)).toEqual([
      "a tool, not a battery suite",
      "not in the battery's ORDER — run it by hand"
    ]);
  });

  it("(e) docs, tests and package.json select nothing live, and say so", () => {
    const plan = planFor(["README.md", "tests/x.test.js", "package.json"], ctx);
    expect(plan.rows).toEqual([]);
    expect(plan.full).toEqual([]);
    expect(plan.inert).toHaveLength(3);
    expect(plan.inert.every(i => /nothing live/.test(i.why))).toBe(true);
  });

  it("module.json, the manifest the platform loads, is the full battery", () => {
    expect(planFor(["module.json"], ctx).full).toHaveLength(1);
  });

  it("(f) needs are pulled — the nearest row of that name above — and the order is canonical", () => {
    // smoke-e needs `seed`: the SECOND seed (index 5), not the first
    const rows = suitesFor(["scripts/beta.js"], ctx);
    expect(at(rows)).toEqual([0, 1, 5, 6]);
    expect(rows[0].why).toEqual(["pulled — smoke-b needs it"]);
    expect(rows[2].why).toEqual(["pulled — smoke-e needs it"]);
  });

  it("several files merge into one plan, each suite once, reasons joined", () => {
    const rows = suitesFor(
      ["scripts/gamma/part.js", "scripts/alpha.js", "scripts/decide/pure.js"],
      ctx
    );
    expect(names(rows)).toEqual(["smoke-a", "seed", "smoke-c", "smoke-d"]);
    expect(rows.find(r => r.name === "smoke-a").why).toHaveLength(2);
  });

  it("paths arrive as git prints them, or with backslashes", () => {
    expect(names(suitesFor(["scripts\\alpha.js"], ctx))).toEqual(["smoke-a", "smoke-d"]);
  });
});

describe("the positionals' and --from's roads", () => {
  it("a named suite pulls its needs and says why", () => {
    const rows = rowsFor(["smoke-b"], ORDER);
    expect(names(rows)).toEqual(["smoke-a", "smoke-b"]);
    expect(rows[0].why).toEqual(["pulled — smoke-b needs it"]);
  });

  it("--from picks by index, and pulls from above the cut", () => {
    expect(at(rowsFrom(6, ORDER))).toEqual([5, 6]);
    expect(at(rowsFrom(1, ORDER))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("an unknown name throws", () => {
    expect(() => rowsFor(["smoke-zz"], ORDER)).toThrow(/no such suite/);
  });

  it("a need with nothing above it is an ORDER problem", () => {
    expect(orderProblems([{ name: "x", needs: ["y"] }, { name: "y" }])[0]).toMatch(/no y row/);
    expect(orderProblems(ORDER)).toEqual([]);
  });
});

describe("parseCovers — the claim read off the suite's text", () => {
  it("reads string literals, either quote, around comments", () => {
    const src = [
      "import x from './harness.mjs';",
      "const COVERS = [",
      "  'saves/ask.js',        // §19 — the gate's",
      '  "hold/answer.js",  /* the relay */',
      "  // a whole-line note, with an apostrophe's worth of prose",
      "  'emanations.js'",
      "];",
      "const SECTIONS = { 1: 'x' };"
    ].join("\n");
    expect(parseCovers(src)).toEqual(["saves/ask.js", "hold/answer.js", "emanations.js"]);
  });

  it("CRLF files parse the same", () => {
    expect(parseCovers('const COVERS = [\r\n  "a.js",\r\n  "b.js"\r\n];\r\n')).toEqual([
      "a.js",
      "b.js"
    ]);
  });

  it("returns null when the suite declares none", () => {
    expect(parseCovers("const SECTIONS = {};")).toBeNull();
  });

  it("an empty list is a declaration (the gate judges it), not a missing one", () => {
    expect(parseCovers("const COVERS = [];")).toEqual([]);
  });

  it("throws on anything that is not a string literal — a claim the gate cannot see", () => {
    expect(() => parseCovers("const COVERS = [...OTHER, 'a.js'];")).toThrow(/not a string literal/);
    expect(() => parseCovers("const COVERS = [PATH];")).toThrow(/not a string literal/);
  });

  it("throws on two declarations", () => {
    expect(() => parseCovers("const COVERS = ['a.js'];\nconst COVERS = ['b.js'];")).toThrow(
      /more than once/
    );
  });
});
