import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer: Trance (the Elf, 2026-09-27) — "magic can't put you to sleep". The demand says
 * whether a failure would sleep (decide/demand.js `putsToSleep`), the effect table's `succeeds`
 * facet makes the save one that cannot fail (decide/reminders.js), the gate nets `succeeds`, and
 * the verdict says so without a total (decide/verdict.js).
 */
/** @type {typeof import("../scripts/decide/demand.js")} */
let demand;
/** @type {typeof import("../scripts/decide/reminders.js")} */
let rem;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/verdict.js")} */
let verdict;
beforeAll(async () => {
  demand = await import("../scripts/decide/demand.js");
  rem = await import("../scripts/decide/reminders.js");
  reg = await import("../scripts/decide/registry.js");
  verdict = await import("../scripts/decide/verdict.js");
});

describe("putsToSleep — read off the spell and its failed-save effects", () => {
  it("the Sleep spell, an Asleep effect, a Sleep effect", () => {
    expect(demand.putsToSleep({ itemName: "Sleep" })).toBe(true);
    expect(demand.putsToSleep({ itemName: "Eyebite", effectNames: ["Asleep"] })).toBe(true);
    expect(demand.putsToSleep({ itemName: "Symbol", effectNames: ["Sleep"] })).toBe(true);
  });
  it("not Sleet Storm, not Hold Person", () => {
    expect(demand.putsToSleep({ itemName: "Sleet Storm", effectNames: ["Prone"] })).toBe(false);
    expect(demand.putsToSleep({ itemName: "Hold Person", effectNames: ["Paralyzed"] })).toBe(false);
  });
});

describe("the Trance row — a save that cannot fail", () => {
  const sources = d => rem.effectSaveSources({ features: ["Trance"], enabled: ["Trance"], table: reg.EFFECT_BENDS, demand: d, name: "Elf" });
  it("against a spell that sleeps: one source, autoSucceed, the gate nets succeeds", () => {
    const s = sources({ spell: true, sleep: true, statuses: ["unconscious"] });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ autoSucceed: true, feature: "Trance", bend: null });
    expect(s[0].label).toMatch(/Trance: this save cannot fail/);
    const gate = rem.saveGate(s);
    expect(gate).toMatchObject({ net: "succeeds", autoSucceed: true, autoFail: false });
  });
  it("not against a spell that does not sleep, nor against a sleep that is not magic", () => {
    expect(sources({ spell: true, sleep: false })).toEqual([]);
    expect(sources({ spell: false, sleep: true })).toEqual([]);
  });
  it("a sheet roll with no demand lists it, never passes it", () => {
    const s = sources(null);
    expect(s).toHaveLength(1);
    expect(s[0].autoSucceed).toBeUndefined();
    expect(rem.saveGate(s).net).toBe("normal");
  });
  it("a condition's automatic failure stands over it", () => {
    const s = [...sources({ spell: true, sleep: true }), { kind: "condition", bend: null, label: "x", autoFail: true }];
    expect(rem.saveGate(s)).toMatchObject({ net: "fails", autoSucceed: false });
  });
});

describe("the verdict — cannot fail, no total", () => {
  it("says the feature where the total would be", () => {
    const flag = { dc: 15, hasDamage: false };
    const t = { done: true, outcome: "saved", total: null, autoSucceeded: true, autoSucceededBy: "Trance" };
    expect(verdict.verdictText(flag, t)).toMatch(/^cannot fail \(Trance\) /);
    expect(verdict.verdictTail(flag, t)).toBeNull();
  });
});
