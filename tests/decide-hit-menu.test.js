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
  it("names eight on-hit maneuvers paying from Combat Superiority and three Giant Ancestry boons, with a rule each", () => {
    const rows = Object.values(reg.HIT_OPTIONS);
    const by = g => rows.filter(r => r.group === g).map(r => r.feature);
    expect(by("combat-superiority")).toHaveLength(8);
    expect(by("giant-ancestry")).toEqual(["Fire's Burn", "Frost's Chill", "Hill's Tumble"]);
    expect(rows).toHaveLength(11);
    for (const row of rows) {
      expect(reg.HIT_GROUPS[row.group]).toBeTruthy();
      expect(row.rule.length).toBeGreaterThan(40);
    }
    for (const [key, g] of Object.entries(reg.HIT_GROUPS)) {
      expect(["feature", "option"], key).toContain(g.pool);
      expect(g.eyebrow && g.heading && g.per && g.dieLabel, key).toBeTruthy();
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
      caveat: null
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

describe("Giant Ancestry — a group with no feature, paying per option (Slice A, 2026-09-24)", () => {
  const giant = (features, pools, extra = {}) =>
    h.hitMenu({
      groups: reg.HIT_GROUPS,
      options: reg.HIT_OPTIONS,
      listed: ALL(),
      features,
      pools,
      ...extra
    });

  it("the table: Frost's Chill clocks its effect to `slow`, Hill's Tumble presses Prone up to Large, the group requires nothing", () => {
    expect(reg.HIT_GROUPS["giant-ancestry"]).toMatchObject({
      feature: null,
      pool: "option",
      dieLabel: "use"
    });
    expect(reg.HIT_OPTIONS["frosts-chill"]).toMatchObject({ effects: true, clock: "slow" });
    expect(reg.HIT_OPTIONS["hills-tumble"]).toMatchObject({ press: "prone", maxSize: "lg" });
  });

  it("a Goliath with Fire's Burn: its own group, its own uses, the boon's die and damage type as the cost", () => {
    const m = giant(["Fire's Burn"], { "fires-burn": { left: 3, die: "1d10", type: "fire" } });
    expect(m.groups).toHaveLength(1);
    expect(m.groups[0]).toMatchObject({
      key: "giant-ancestry",
      perOption: true,
      left: 3,
      die: null,
      heading: "Giant Ancestry",
      per: "one boon per hit",
      eyebrow: "Giant Ancestry"
    });
    expect(m.groups[0].rows[0]).toMatchObject({
      key: "fires-burn",
      cost: "1d10 fire · 1 use",
      affordable: true
    });
  });

  it("an option without a readable pool is absent; no uses left greys it", () => {
    expect(giant(["Fire's Burn"], {}).groups).toEqual([]);
    const m = giant(["Fire's Burn"], { "fires-burn": { left: 0, die: "1d10", type: "fire" } });
    expect(m.groups[0].left).toBe(0);
    expect(m.groups[0].rows[0].affordable).toBe(false);
  });

  it("a dieless PRESS row costs one use and is affordable on its uses alone", () => {
    const m = giant(
      ["Hill's Tumble"],
      { "hills-tumble": { left: 2, die: null } },
      { fits: { "hills-tumble": true } }
    );
    expect(m.groups[0].rows[0]).toMatchObject({
      key: "hills-tumble",
      cost: "1 use",
      affordable: true,
      caveat: null
    });
  });

  it("the size judge: a target larger than Large greys Hill's Tumble with the fact as its tag; an unread size leaves it open", () => {
    const pools = { "hills-tumble": { left: 2, die: null } };
    const big = giant(["Hill's Tumble"], pools, { fits: { "hills-tumble": false } }).groups[0]
      .rows[0];
    expect(big).toMatchObject({
      cost: "too large",
      affordable: false,
      caveat: "the target is larger than Large"
    });
    const unread = giant(["Hill's Tumble"], pools, { fits: {} }).groups[0].rows[0];
    expect(unread.affordable).toBe(true);
    expect(unread.caveat).toMatch(/could not be read/);
  });

  it("a Goliath Battle Master sees both groups, and ONE pick on the whole hit: two across groups pick nothing", () => {
    const m = giant(["Combat Superiority", "Trip Attack", "Fire's Burn"], {
      "combat-superiority": { left: 4, die: "1d8" },
      "fires-burn": { left: 3, die: "1d10", type: "fire" }
    });
    expect(m.groups.map(g => g.key)).toEqual(["combat-superiority", "giant-ancestry"]);
    expect(h.hitPick({ menu: m, chosen: ["fires-burn"] }).picks.map(p => p.row.key)).toEqual([
      "fires-burn"
    ]);
    const both = h.hitPick({ menu: m, chosen: ["trip-attack", "fires-burn"] });
    expect(both.picks).toEqual([]);
    expect(both.dropped.sort()).toEqual(["fires-burn", "trip-attack"]);
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
