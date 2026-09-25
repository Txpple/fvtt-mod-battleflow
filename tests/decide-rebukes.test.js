import { describe, expect, it } from "vitest";
import * as rb from "../scripts/decide/rebukes.js";
import * as reg from "../scripts/decide/registry.js";

describe("rebukes — a Reaction to damage, aimed at its dealer (the Goliath walk, 2026-09-25)", () => {
  const open = {
    self: false,
    hp: 20,
    reactionSpent: false,
    distance: 40,
    reach: 60,
    usesLeft: 2,
    slot: null,
    whileStands: null,
    equipped: null
  };

  it("the reach: the activity's own range, the row's when the data carries none", () => {
    expect(rb.rebukeReach({}, 60)).toBe(60);
    expect(rb.rebukeReach({ range: 5 }, null)).toBe(5);
    expect(rb.rebukeReach({ range: 5 }, 60)).toBe(5);
    expect(rb.rebukeReach({}, null)).toBeNull();
  });

  it("offered within reach with the Reaction, a use and HP standing", () => {
    expect(rb.rebukeBlocked(open)).toBeNull();
    expect(rb.rebukeBlocked({ ...open, distance: 60 })).toBeNull();
  });

  it("the 60-foot range: a damager at 65 feet is out of reach; an unmeasured distance offers nothing", () => {
    expect(rb.rebukeBlocked({ ...open, distance: 65 })).toBe("out of reach");
    expect(rb.rebukeBlocked({ ...open, distance: null })).toBe("distance unknown");
    expect(rb.rebukeBlocked({ ...open, reach: null })).toBe("no reach");
  });

  it("every other fact that stops it, each by its own reason", () => {
    expect(rb.rebukeBlocked({ ...open, self: true })).toBe("self");
    expect(rb.rebukeBlocked({ ...open, hp: 0 })).toBe("down");
    expect(rb.rebukeBlocked({ ...open, reactionSpent: true })).toBe("reaction spent");
    expect(rb.rebukeBlocked({ ...open, usesLeft: 0 })).toBe("no uses left");
    expect(rb.rebukeBlocked({ ...open, usesLeft: null })).toBeNull();
    expect(rb.rebukeBlocked({ ...open, slot: false })).toBe("no spell slot");
    expect(rb.rebukeBlocked({ ...open, whileStands: false })).toBe("not active");
    expect(rb.rebukeBlocked({ ...open, equipped: false })).toBe("not held");
  });

  it("the cost says the count, or the slot", () => {
    expect(rb.rebukeCost({ usesLeft: 2, usesMax: 3 })).toBe("a Reaction · 2 of 3 uses left");
    expect(rb.rebukeCost({ spell: true })).toBe("a Reaction, a spell slot");
    expect(rb.rebukeCost({})).toBe("a Reaction");
  });

  it("the card line: source, then result", () => {
    const f = { actorName: "Storm", sourceName: "the snake", distance: 40 };
    expect(rb.rebukeLine(f)).toBe("Storm may answer the snake (40 ft)");
    expect(rb.rebukeLine({ ...f, answer: "use", choice: "Storm's Thunder" })).toBe(
      "Storm's Thunder — Storm answers the snake"
    );
    expect(rb.rebukeLine({ ...f, answer: "pass", timedOut: true })).toBe(
      "Storm lets the snake's damage go (timer)"
    );
  });

  it("the table: every row has its rule and source; the list default is the table", () => {
    for (const [name, row] of Object.entries(reg.REBUKES)) {
      expect(row.rule.length, name).toBeGreaterThan(40);
      expect(row.from, name).toBeTruthy();
    }
    expect(reg.LIST_SPECS.rebukes.default).toBe(Object.keys(reg.REBUKES).join(", "));
  });
});
