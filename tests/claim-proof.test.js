import { describe, expect, it } from "vitest";
import { MOMENT_KINDS } from "../scripts/decide/moments.js";
import {
  NO_LEDGER,
  classifyClaims,
  deriveFileKinds,
  kindsWrittenBy,
  loadFileKinds,
  loadOrder,
  loadSuiteTags,
  soleWriters,
  tagTable
} from "../tools/claim-proof.mjs";
import { WORLD_WRITERS } from "../tools/moment-writers.mjs";

/*
 * THE CLAIM PROOF (tools/claim-proof.mjs) — the runtime half of the coverage map's "checked both
 * ways". Two halves here: the derivation against the REAL tree (moments.js, the gate's scan and its
 * WORLD_WRITERS pins), and the classification on small fakes, where every status can be forced.
 */

describe("file → moment kinds — derived from the real gate", () => {
  const real = loadFileKinds();

  it("every record kind has at least one file that writes it — a kind nobody writes could never prove anything", () => {
    const written = new Set([...real.values()].flatMap(r => [...r.writes]));
    for (const k of MOMENT_KINDS) expect(written.has(k), k).toBe(true);
  });

  it("a machine's own records are its kinds: the hit menu writes hitManeuver and sweepCard, and is pinned to receipt", () => {
    const hm = real.get("hit-menu.js");
    expect([...hm.writes].sort()).toEqual(["hitManeuver", "sweepCard"]);
    expect(hm.pinned.has("receipt")).toBe(true);
    expect(kindsWrittenBy(real, "hit-menu.js").has("receipt")).toBe(true);
  });

  it("a kind only one file writes attributes a publication to it; a shared kind does not", () => {
    const sole = soleWriters(real);
    expect(sole.get("sneakDamage")).toBe("sneak.js");
    expect(sole.get("damageShield")).toBe("damage-shields.js");
    expect(sole.get("spend")).toBe("resources.js");
    // `receipt` is written by auto-apply.js AND receipts.js (the revert), `hold` by five hold/ files.
    expect(sole.has("receipt")).toBe(false);
    expect(sole.has("hold")).toBe(false);
  });

  it("a pin never makes a sole writer — hold/lookup.js is pinned to effectReceipt and writes no record itself", () => {
    const lookup = real.get("hold/lookup.js");
    expect(lookup.writes.size).toBe(0);
    expect([...lookup.pinned]).toEqual(["effectReceipt"]);
    expect(lookup.reason).toBe(null);
  });

  it("UNPROVABLE-BY-MOMENTS is derived: WORLD_WRITERS' sentence when there is one, else the kind of file it is", () => {
    expect(real.get("events.js").reason).toBe(WORLD_WRITERS["events.js"]);
    expect(real.get("reminders.js").reason).toBe(WORLD_WRITERS["reminders.js"]);
    expect(real.get("decide/moments.js").reason).toMatch(/acts only through its callers/);
    expect(real.get("saves/views.js").reason).toMatch(/acts only through its callers/);
    expect(kindsWrittenBy(real, "decide/moments.js").size).toBe(0);
  });

  it("every file WORLD_WRITERS pins to records is provable; every file it gives a reason is not", () => {
    for (const [file, pin] of Object.entries(WORLD_WRITERS)) {
      if (Array.isArray(pin)) expect(kindsWrittenBy(real, file).size, file).toBeGreaterThan(0);
      else if (!real.get(file).writes.size) expect(real.get(file).reason, file).toBe(pin);
    }
  });
});

describe("file → moment kinds — the derivation's rules on a fake tree", () => {
  const fk = deriveFileKinds({
    keysByFile: new Map([
      ["a.js", new Set(["recA", "stateX"])],
      ["b.js", new Set(["recA", "recB"])],
      ["s.js", new Set(["stateX", "stateY"])]
    ]),
    worldWriters: { "p.js": ["recA"], "r.js": "a reason somebody wrote down once" },
    momentKinds: ["recA", "recB"],
    stateKeys: ["stateX", "stateY"],
    allFiles: ["a.js", "b.js", "s.js", "p.js", "r.js", "v.js"]
  });

  it("splits a file's keys into its records and its state", () => {
    expect([...fk.get("a.js").writes]).toEqual(["recA"]);
    expect([...fk.get("a.js").state]).toEqual(["stateX"]);
  });

  it("names why a file is unprovable, in three voices", () => {
    expect(fk.get("r.js").reason).toBe("a reason somebody wrote down once");
    expect(fk.get("s.js").reason).toMatch(/only state keys \(stateX, stateY\)/);
    expect(fk.get("v.js").reason).toMatch(/acts only through its callers/);
    expect(fk.get("p.js").reason).toBe(null);
  });

  it("sole writers come from direct writes only", () => {
    expect([...soleWriters(fk)]).toEqual([["recB", "b.js"]]);
  });
});

describe("the claim classification", () => {
  const fileKinds = deriveFileKinds({
    keysByFile: new Map([
      ["mine.js", new Set(["own"])],
      ["both1.js", new Set(["shared"])],
      ["both2.js", new Set(["shared"])],
      ["other.js", new Set(["theirs"])]
    ]),
    worldWriters: {
      "pinned.js": ["shared"],
      "view.js": "presentation, and nothing more than that"
    },
    momentKinds: ["own", "shared", "theirs"],
    stateKeys: [],
    allFiles: ["mine.js", "both1.js", "both2.js", "other.js", "pinned.js", "view.js"]
  });
  const sole = soleWriters(fileKinds);
  const suiteToTag = new Map([
    ["smoke-a", "a"],
    ["smoke-b", "b"],
    ["smoke-nogm", null]
  ]);
  const statusOf = (out, suite, file) =>
    out.rows.find(r => r.suite === suite && r.file === file)?.status;

  it("PROVEN by an own kind, PROVEN (shared kind) by a shared one or a pin, UNPROVEN by silence", () => {
    const out = classifyClaims({
      coverage: new Map([["smoke-a", ["mine.js", "both1.js", "pinned.js", "other.js"]]]),
      suiteToTag,
      fileKinds,
      sole,
      moments: new Map([["a", { own: 2, shared: 1 }]])
    });
    expect(statusOf(out, "smoke-a", "mine.js")).toBe("PROVEN");
    expect(statusOf(out, "smoke-a", "both1.js")).toBe("PROVEN (shared kind)");
    expect(statusOf(out, "smoke-a", "pinned.js")).toBe("PROVEN (shared kind)");
    expect(statusOf(out, "smoke-a", "other.js")).toBe("UNPROVEN");
    expect(out.rows.find(r => r.file === "other.js").expected).toEqual(["theirs"]);
  });

  it("a zero count is not a publication", () => {
    const out = classifyClaims({
      coverage: new Map([["smoke-a", ["mine.js"]]]),
      suiteToTag,
      fileKinds,
      sole,
      moments: new Map([["a", { own: 0 }]])
    });
    expect(statusOf(out, "smoke-a", "mine.js")).toBe("UNPROVEN");
  });

  it("a ledger with no moment half is NOT MEASURED — never UNPROVEN — while measured-and-silent is UNPROVEN", () => {
    const out = classifyClaims({
      coverage: new Map([
        ["smoke-a", ["mine.js"]],
        ["smoke-b", ["mine.js"]],
        ["smoke-nogm", ["mine.js"]]
      ]),
      suiteToTag,
      fileKinds,
      sole,
      moments: new Map([["b", {}]])
    });
    expect(statusOf(out, "smoke-a", "mine.js")).toBe("NOT MEASURED");
    expect(statusOf(out, "smoke-nogm", "mine.js")).toBe("NOT MEASURED");
    expect(statusOf(out, "smoke-b", "mine.js")).toBe("UNPROVEN");
    expect(out.notMeasured).toEqual(["smoke-a", "smoke-nogm"]);
  });

  it("UNPROVABLE-BY-MOMENTS and NO SUCH FILE hold whether or not the suite was measured", () => {
    const out = classifyClaims({
      coverage: new Map([["smoke-a", ["view.js", "gone.js"]]]),
      suiteToTag,
      fileKinds,
      sole,
      moments: new Map()
    });
    expect(statusOf(out, "smoke-a", "view.js")).toBe("UNPROVABLE-BY-MOMENTS");
    expect(out.rows.find(r => r.file === "view.js").reason).toBe(
      "presentation, and nothing more than that"
    );
    expect(statusOf(out, "smoke-a", "gone.js")).toBe("NO SUCH FILE");
  });

  it("the other direction: an own kind published in a suite that never claimed its file", () => {
    const out = classifyClaims({
      coverage: new Map([["smoke-a", ["mine.js"]]]),
      suiteToTag,
      fileKinds,
      sole,
      moments: new Map([
        ["a", { own: 1, theirs: 3, shared: 9 }],
        ["b", { own: 1 }]
      ])
    });
    // other.js acted in smoke-a unclaimed; a shared kind attributes nobody; smoke-b claims nothing
    // at all and still has its measured publications read.
    expect(out.unclaimed).toEqual([
      { suite: "smoke-a", file: "other.js", kinds: ["theirs×3"] },
      { suite: "smoke-b", file: "mine.js", kinds: ["own×1"] }
    ]);
  });

  it("a claim for a suite the battery does not know is named, and reads NOT MEASURED", () => {
    const out = classifyClaims({
      coverage: new Map([["smoke-ghost", ["mine.js"]]]),
      suiteToTag,
      fileKinds,
      sole,
      moments: new Map([["a", { own: 1 }]])
    });
    expect(out.unknownSuites).toEqual(["smoke-ghost"]);
    expect(statusOf(out, "smoke-ghost", "mine.js")).toBe("NOT MEASURED");
  });
});

describe("the tag → suite table", () => {
  const order = [
    { name: "smoke-a" },
    { name: "seed", reset: true },
    { name: "smoke-b" },
    { name: "smoke-nogm" }
  ];

  it("joins the order to the connect tags, both ways", () => {
    const t = tagTable({
      order,
      tags: new Map([
        ["smoke-a", "a"],
        ["smoke-b", "bee"],
        ["seed", "seed"]
      ]),
      ledgerTags: ["a", "bee", "seed", "stray"]
    });
    expect([...t.suiteToTag]).toEqual([
      ["smoke-a", "a"],
      ["smoke-b", "bee"],
      ["smoke-nogm", null]
    ]);
    expect(t.notSuites).toEqual(["seed (seed)"]);
    expect(t.problems).toEqual([expect.stringMatching(/ledger "stray" matches no script/)]);
  });

  it("names a suite with no tag, a shared tag, and a NO_LEDGER pin gone stale", () => {
    const t = tagTable({
      order,
      tags: new Map([
        ["smoke-a", "x"],
        ["seed", "x"],
        ["smoke-nogm", "nogm"]
      ]),
      ledgerTags: []
    });
    expect(t.problems.some(p => /tag "x" is used by both/.test(p))).toBe(true);
    expect(
      t.problems.some(p => /smoke-b is in the battery and connects under no tag/.test(p))
    ).toBe(true);
    expect(t.problems.some(p => /STALE PIN: NO_LEDGER lists smoke-nogm/.test(p))).toBe(true);
  });

  it("on the real tree: every battery suite has a tag or a pinned reason, and no two scripts share one", async () => {
    const tags = loadSuiteTags();
    expect(tags.get("smoke-battleflow")).toBe("smoke");
    expect(tags.get("smoke-twoclient")).toBe("2client");
    expect(tags.get("check-popup-routing")).toBe("topo");
    expect(tags.get("smoke-d20-folds")).toBe("smoke-d20-folds"); // through `const TAG`
    expect(tags.has("smoke-nogm")).toBe(false);
    const t = tagTable({ order: await loadOrder(), tags, ledgerTags: [] });
    expect(t.problems).toEqual([]);
    for (const name of NO_LEDGER.keys()) expect(t.suiteToTag.get(name)).toBe(null);
  });
});
