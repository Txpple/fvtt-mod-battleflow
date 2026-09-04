import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer hit menu (ARCHITECTURE.md §2). No Foundry stub on purpose. The flow is the
 * user's ruling (2026-09-04, the prototype *Battle Flow Hit Menu*, built as drawn): one popup per
 * hit, the rows grouped by the feature that pays, the row the name and its cost, one pick per
 * group, the pool the switch the rules give.
 */
/** @type {typeof import("../scripts/decide/hit-menu.js")} */
let h;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  h = await import("../scripts/decide/hit-menu.js");
  reg = await import("../scripts/decide/registry.js");
});

const ALL = () => Object.values(reg.HIT_OPTIONS).map(r => r.feature);
const menu = (features, extra = {}) =>
  h.hitMenu({
    groups: reg.HIT_GROUPS,
    options: reg.HIT_OPTIONS,
    listed: ALL(),
    features,
    pools: { "combat-superiority": { left: 4, die: "1d8" } },
    ...extra
  });

describe("the table", () => {
  it("names eight on-hit maneuvers, every one paying from Combat Superiority, with a rule each", () => {
    const rows = Object.values(reg.HIT_OPTIONS);
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row.group).toBe("combat-superiority");
      expect(reg.HIT_GROUPS[row.group]).toBeTruthy();
      expect(row.rule.length).toBeGreaterThan(40);
    }
    expect(reg.HIT_OPTIONS["sweeping-attack"]).toMatchObject({ mode: "sweep", melee: true });
    expect(reg.HIT_OPTIONS["trip-attack"]).toMatchObject({ save: true, onFail: "prone" });
    expect(reg.HIT_OPTIONS["distracting-strike"]).toMatchObject({ effects: true });
  });

  it("keeps Precision Attack and Riposte out — they are folds", () => {
    expect(ALL()).not.toContain("Precision Attack");
    expect(ALL()).not.toContain("Riposte");
  });

  it("ships the Hit Menu list as the whole table, and its parser takes it whole", () => {
    const { entries, rejects } = reg.parseList(
      reg.LIST_SPECS.hitMenu,
      reg.LIST_SPECS.hitMenu.default
    );
    expect(rejects).toEqual([]);
    // Whole-chunk lists read lower-cased — the machine matches names case-insensitively.
    expect(entries.map(e => e.kind)).toEqual(ALL().map(n => n.toLowerCase()));
  });
});

describe("hitMenu — the rows, read off the sheet", () => {
  it("a Battle Master with three maneuvers: one group, three rows, the die as the cost", () => {
    const m = menu(["Combat Superiority", "Trip Attack", "Goading Attack", "Menacing Attack"]);
    expect(m.groups).toHaveLength(1);
    const g = m.groups[0];
    expect(g).toMatchObject({
      key: "combat-superiority",
      label: "Combat Superiority",
      max: 1,
      die: "1d8",
      left: 4
    });
    expect(g.rows.map(r => r.key)).toEqual(["trip-attack", "goading-attack", "menacing-attack"]);
    expect(g.rows[0]).toMatchObject({
      label: "Trip Attack",
      cost: "1d8 Superiority Die",
      affordable: true,
      caveat: "the target must be Large or smaller"
    });
  });

  it("no Combat Superiority on the sheet, no group — a maneuver alone pays for nothing", () => {
    expect(menu(["Trip Attack"]).groups).toEqual([]);
  });

  it("the list is the switch: an unlisted maneuver is absent, an empty list offers nothing", () => {
    const m = menu(["Combat Superiority", "Trip Attack", "Goading Attack"], {
      listed: ["Goading Attack"]
    });
    expect(m.groups[0].rows.map(r => r.key)).toEqual(["goading-attack"]);
    expect(menu(["Combat Superiority", "Trip Attack"], { listed: [] }).groups).toEqual([]);
  });

  it("no dice left: the rows stay, greyed", () => {
    const m = menu(["Combat Superiority", "Trip Attack"], {
      pools: { "combat-superiority": { left: 0, die: "1d8" } }
    });
    expect(m.groups[0].left).toBe(0);
    expect(m.groups[0].rows[0].affordable).toBe(false);
  });

  it("a pool that could not be read is no group at all; a die that could not be read is unaffordable", () => {
    expect(menu(["Combat Superiority", "Trip Attack"], { pools: {} }).groups).toEqual([]);
    const m = menu(["Combat Superiority", "Trip Attack"], {
      pools: { "combat-superiority": { left: 4, die: null } }
    });
    expect(m.groups[0].rows[0].affordable).toBe(false);
  });

  it("Sweeping Attack is a melee maneuver: absent on a ranged attack", () => {
    const feats = ["Combat Superiority", "Sweeping Attack", "Trip Attack"];
    expect(menu(feats, { melee: true }).groups[0].rows.map(r => r.key)).toEqual([
      "trip-attack",
      "sweeping-attack"
    ]);
    expect(menu(feats, { melee: false }).groups[0].rows.map(r => r.key)).toEqual(["trip-attack"]);
  });
});

describe("hitPick — one per group, affordable", () => {
  const m = () => menu(["Combat Superiority", "Trip Attack", "Goading Attack"]);
  it("one pick is one pick", () => {
    const p = h.hitPick({ menu: m(), chosen: ["trip-attack"] });
    expect(p.picks.map(x => x.row.key)).toEqual(["trip-attack"]);
    expect(p.dropped).toEqual([]);
  });
  it("two in one group is illegal — both dropped, nothing rides", () => {
    const p = h.hitPick({ menu: m(), chosen: ["trip-attack", "goading-attack"] });
    expect(p.picks).toEqual([]);
    expect(p.dropped.sort()).toEqual(["goading-attack", "trip-attack"]);
  });
  it("an unaffordable row is dropped", () => {
    const empty = menu(["Combat Superiority", "Trip Attack"], {
      pools: { "combat-superiority": { left: 0, die: "1d8" } }
    });
    expect(h.hitPick({ menu: empty, chosen: ["trip-attack"] })).toEqual({
      picks: [],
      dropped: ["trip-attack"]
    });
  });
  it("nothing chosen is nothing", () => {
    expect(h.hitPick({ menu: m() })).toEqual({ picks: [], dropped: [] });
  });
});

describe("sweepVerdict — would the original roll hit the second creature?", () => {
  it("the total against the AC; a critical always, a fumble never; no AC is unknown", () => {
    expect(h.sweepVerdict({ total: 18, ac: 15 })).toBe("hit");
    expect(h.sweepVerdict({ total: 14, ac: 15 })).toBe("miss");
    expect(h.sweepVerdict({ total: 15, ac: 15 })).toBe("hit");
    expect(h.sweepVerdict({ total: 3, isCritical: true, ac: 25 })).toBe("hit");
    expect(h.sweepVerdict({ total: 30, isFumble: true, ac: 10 })).toBe("miss");
    expect(h.sweepVerdict({ total: 18, ac: null })).toBe("unknown");
  });
});
