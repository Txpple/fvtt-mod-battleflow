import { beforeAll, describe, expect, it } from "vitest";

describe("the mastery record (issue #3, 2026-10-10)", () => {
  /** @type {typeof import("../scripts/decide/mastery-record.js")} */
  let m;
  beforeAll(async () => {
    m = await import("../scripts/decide/mastery-record.js");
  });

  // The PHB's rows, as the offline dump of 2026-10-10 read them off the class packs.
  const fighter = lv =>
    [1, 4, 10, 16].map((level, i) => ({ level, at: lv, grants: 0, choices: i === 0 ? 3 : 1 }));
  const barbarian = lv =>
    [1, 4, 10].map((level, i) => ({ level, at: lv, grants: 0, choices: i === 0 ? 2 : 1 }));
  const weaponMaster = charLevel => [{ level: 0, at: charLevel, grants: 0, choices: 1 }];

  it("the allowance sums the grants at or below the class level: Fighter 3 → 4 → 5 → 6", () => {
    expect(m.allowanceOf(fighter(1))).toBe(3);
    expect(m.allowanceOf(fighter(3))).toBe(3);
    expect(m.allowanceOf(fighter(4))).toBe(4);
    expect(m.allowanceOf(fighter(10))).toBe(5);
    expect(m.allowanceOf(fighter(16))).toBe(6);
    expect(m.allowanceOf(barbarian(3))).toBe(2);
    expect(m.allowanceOf(barbarian(10))).toBe(4);
  });
  it("…multiclass and the Weapon Master feat add; a class with no row allows none", () => {
    expect(m.allowanceOf([...fighter(5), ...barbarian(1), ...weaponMaster(6)])).toBe(4 + 2 + 1);
    expect(m.allowanceOf([])).toBe(0);
    expect(m.allowanceOf([{ level: 1, at: 1, grants: 2, choices: 0 }])).toBe(2); // a granted (no choice) row counts too
  });

  const W = (
    base,
    mastery,
    { equipped = true, proficient = true, sort = 0, name = base } = {}
  ) => ({ id: base, name, base, mastery, equipped, proficient, sort });

  it("the fill takes equipped, proficient, mastered kinds in sheet order, one per kind, up to the open slots", () => {
    const picks = m.fillPicks({
      allowance: 3,
      chosen: [],
      weapons: [
        W("longbow", "slow", { sort: 20 }),
        W("longsword", "sap", { sort: 10 }),
        W("longsword", "sap", { sort: 5, name: "Longsword (spare)" }), // a second of the same kind: one pick
        W("dagger", "nick", { equipped: false }), // carried, not equipped
        W("greatsword", "graze", { proficient: false }), // not proficient
        W("club", null, { sort: 1 }) // no mastery on the kind
      ]
    });
    expect(picks.map(p => p.base)).toEqual(["longsword", "longbow"]);
    expect(picks[0]).toEqual({ base: "longsword", mastery: "sap", name: "Longsword (spare)" });
  });
  it("…capped at the open slots, never past the allowance", () => {
    const picks = m.fillPicks({
      allowance: 2,
      chosen: ["rapier"],
      weapons: [W("shortbow", "vex"), W("dagger", "nick"), W("rapier", "vex")]
    });
    expect(picks.map(p => p.base)).toEqual(["shortbow"]);
  });
  it("…a full or over-long list is never touched; a class with no allowance gets nothing", () => {
    expect(
      m.fillPicks({ allowance: 2, chosen: ["rapier", "shortbow"], weapons: [W("dagger", "nick")] })
    ).toEqual([]);
    expect(
      m.fillPicks({ allowance: 2, chosen: ["a", "b", "c"], weapons: [W("dagger", "nick")] })
    ).toEqual([]);
    expect(
      m.fillPicks({ allowance: 0, chosen: [], weapons: [W("quarterstaff", "topple")] })
    ).toEqual([]);
  });

  it("the state: none / open / full / over, with the unproficient kinds carried through", () => {
    expect(m.recordState({ allowance: 0, chosen: [] })).toEqual({
      state: "none",
      open: 0,
      unproficient: []
    });
    expect(m.recordState({ allowance: 4, chosen: ["longsword"] })).toEqual({
      state: "open",
      open: 3,
      unproficient: []
    });
    expect(m.recordState({ allowance: 2, chosen: ["rapier", "shortbow"] })).toEqual({
      state: "full",
      open: 0,
      unproficient: []
    });
    expect(m.recordState({ allowance: 2, chosen: ["a", "b", "c"], unproficient: ["c"] })).toEqual({
      state: "over",
      open: 0,
      unproficient: ["c"]
    });
  });

  it("the attack card's line: a mastered kind the wielder has not chosen, with the open count", () => {
    expect(
      m.missingPick({
        stamped: null,
        weapon: { base: "dagger", mastery: "nick" },
        allowance: 2,
        chosen: ["rapier", "shortbow"]
      })
    ).toEqual({ base: "dagger", mastery: "nick", open: 0 });
    expect(
      m.missingPick({
        stamped: null,
        weapon: { base: "dagger", mastery: "nick" },
        allowance: 4,
        chosen: ["longsword"]
      })
    ).toEqual({ base: "dagger", mastery: "nick", open: 3 });
  });
  it("…no line when the system stamped one, the weapon has no mastery, the class allows none, or the kind IS chosen", () => {
    expect(
      m.missingPick({
        stamped: "nick",
        weapon: { base: "dagger", mastery: "nick" },
        allowance: 2,
        chosen: []
      })
    ).toBeNull();
    expect(
      m.missingPick({
        stamped: null,
        weapon: { base: "club", mastery: null },
        allowance: 2,
        chosen: []
      })
    ).toBeNull();
    expect(
      m.missingPick({
        stamped: null,
        weapon: { base: "quarterstaff", mastery: "topple" },
        allowance: 0,
        chosen: []
      })
    ).toBeNull();
    expect(
      m.missingPick({
        stamped: null,
        weapon: { base: "dagger", mastery: "nick" },
        allowance: 2,
        chosen: ["dagger"]
      })
    ).toBeNull();
    expect(
      m.missingPick({
        stamped: null,
        weapon: { base: null, mastery: "nick" },
        allowance: 2,
        chosen: []
      })
    ).toBeNull(); // a custom weapon with no base kind
  });

  it("the long-rest swap: one chosen kind out, one proficient kind in, in place", () => {
    expect(
      m.swapList({ chosen: ["longsword", "longbow"], out: "longbow", into: "greatsword" })
    ).toEqual(["longsword", "greatsword"]);
    expect(
      m.swapList({
        chosen: ["longsword", "longbow"],
        out: "longbow",
        into: "greatsword",
        proficientBases: ["greatsword"]
      })
    ).toEqual(["longsword", "greatsword"]);
  });
  it("…refused when the kind out is not chosen, the kind in already is, both are the same, or the kind in is not proficient", () => {
    expect(m.swapList({ chosen: ["longsword"], out: "dagger", into: "greatsword" })).toBeNull();
    expect(
      m.swapList({ chosen: ["longsword", "longbow"], out: "longsword", into: "longbow" })
    ).toBeNull();
    expect(m.swapList({ chosen: ["longsword"], out: "longsword", into: "longsword" })).toBeNull();
    expect(
      m.swapList({
        chosen: ["longsword"],
        out: "longsword",
        into: "greatsword",
        proficientBases: ["dagger"]
      })
    ).toBeNull();
    expect(m.swapList({ chosen: ["longsword"], out: null, into: "greatsword" })).toBeNull();
  });
});

describe("the long-rest trim of an over-long list (the walk's ruling, 2026-10-10)", () => {
  /** @type {typeof import("../scripts/decide/mastery-record.js")} */
  let m;
  beforeAll(async () => {
    m = await import("../scripts/decide/mastery-record.js");
  });
  it("drops exactly the surplus, every dropped kind chosen, the rest in order", () => {
    expect(
      m.trimList({ chosen: ["warhammer", "longsword", "mace"], drop: ["mace"], allowance: 2 })
    ).toEqual(["warhammer", "longsword"]);
    expect(m.trimList({ chosen: ["a", "b", "c", "d"], drop: ["a", "c"], allowance: 2 })).toEqual([
      "b",
      "d"
    ]);
  });
  it("…refused when the list is not over, the count is wrong, or a dropped kind is not chosen", () => {
    expect(m.trimList({ chosen: ["a", "b"], drop: ["a"], allowance: 2 })).toBeNull();
    expect(m.trimList({ chosen: ["a", "b", "c"], drop: [], allowance: 2 })).toBeNull();
    expect(m.trimList({ chosen: ["a", "b", "c"], drop: ["a", "b"], allowance: 2 })).toBeNull();
    expect(m.trimList({ chosen: ["a", "b", "c"], drop: ["z"], allowance: 2 })).toBeNull();
    expect(m.trimList({ chosen: ["a", "b", "c"], drop: ["a", "a"], allowance: 2 })).toEqual([
      "b",
      "c"
    ]); // a doubled tick is one kind
  });
});

describe("the Long Rest's change: open slots filled, then the one swap (RAW, the walk of 2026-10-10)", () => {
  /** @type {typeof import("../scripts/decide/mastery-record.js")} */
  let m;
  beforeAll(async () => {
    m = await import("../scripts/decide/mastery-record.js");
  });
  it("fills open slots from the adds, in order, and leaves the rest open", () => {
    expect(m.restList({ chosen: ["longsword"], adds: ["longbow"], allowance: 4 })).toEqual([
      "longsword",
      "longbow"
    ]);
    expect(m.restList({ chosen: [], adds: ["greataxe", "handaxe"], allowance: 2 })).toEqual([
      "greataxe",
      "handaxe"
    ]);
  });
  it("…then the one swap on the filled list", () => {
    expect(
      m.restList({
        chosen: ["longsword", "longbow"],
        adds: ["dagger"],
        out: "longbow",
        into: "greatsword",
        allowance: 4
      })
    ).toEqual(["longsword", "greatsword", "dagger"]);
    expect(
      m.restList({
        chosen: ["longsword", "longbow"],
        out: "longbow",
        into: "greatsword",
        allowance: 2
      })
    ).toEqual(["longsword", "greatsword"]);
  });
  it("…nothing asked is the list unchanged; too many adds, a chosen add or a bad swap is refused", () => {
    expect(m.restList({ chosen: ["longsword"], allowance: 4 })).toEqual(["longsword"]);
    expect(
      m.restList({ chosen: ["longsword"], adds: ["a", "b", "c", "d"], allowance: 4 })
    ).toBeNull();
    expect(m.restList({ chosen: ["longsword"], adds: ["longsword"], allowance: 4 })).toBeNull();
    expect(
      m.restList({
        chosen: ["longsword"],
        adds: ["longbow"],
        out: "dagger",
        into: "mace",
        allowance: 4
      })
    ).toBeNull();
    expect(m.restList({ chosen: ["a", "b"], adds: ["c"], allowance: 2 })).toBeNull(); // no slot open
  });
});
