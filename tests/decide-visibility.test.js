import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer visibility mapping (issue #4). No Foundry stub on purpose: the two settings own
 * dnd5e's Visibility menu, and what is decided here is which dnd5e keys a choice writes.
 */
/** @type {typeof import("../scripts/decide/visibility.js")} */
let v;
beforeAll(async () => {
  v = await import("../scripts/decide/visibility.js");
});

const stock = { attackRollVisibility: "none", challengeVisibility: "player", bloodied: "player" };
const want = (choice, on) => ({ ...v.ROLL_RESULTS[choice], ...v.bloodiedFor(on) });

describe("Roll Results Players See and Bloodied Shows on Every Token", () => {
  it("a fresh world on the defaults opens everything", () => {
    expect(v.visibilityWrites(want("open", true), stock)).toEqual([
      ["attackRollVisibility", "all"],
      ["challengeVisibility", "all"],
      ["bloodied", "all"]
    ]);
  });

  it("each choice writes exactly its row", () => {
    expect(v.visibilityWrites(want("results", false), stock)).toEqual([
      ["attackRollVisibility", "hideAC"]
    ]);
    expect(v.visibilityWrites(want("hidden", false), stock)).toEqual([
      ["challengeVisibility", "none"]
    ]);
  });

  it("makes no write when the world already matches", () => {
    const have = { attackRollVisibility: "hideAC", challengeVisibility: "player", bloodied: "all" };
    expect(v.visibilityWrites(want("results", true), have)).toEqual([]);
  });

  it("Leave it to dnd5e never touches the attack or challenge keys", () => {
    expect(v.visibilityWrites(want("dnd5e", true), stock)).toEqual([["bloodied", "all"]]);
  });

  it("Bloodied off is dnd5e's own default, never `none`", () => {
    expect(v.bloodiedFor(false)).toEqual({ bloodied: "player" });
  });

  it("only the three keys, never concealItemDescriptions", () => {
    for (const choice of Object.keys(v.ROLL_RESULTS))
      for (const on of [true, false]) {
        expect(Object.keys(want(choice, on)).every(k => k in stock)).toBe(true);
      }
  });

  it("a key the system does not register is skipped", () => {
    expect(v.visibilityWrites(want("open", true), { bloodied: "player" })).toEqual([
      ["bloodied", "all"]
    ]);
  });
});
