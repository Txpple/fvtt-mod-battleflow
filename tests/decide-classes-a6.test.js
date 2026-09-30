import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: the PHB classes, stage A6 (RULINGS *The PHB classes — A6*) — the Initiative grants
 * (INITIATIVE_GRANTS: Persistent Rage, Uncanny Metabolism) and Vitality of the Tree's two TURN_GRANTS rows. No
 * Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/initiative-grants.js")} */
let ig;
/** @type {typeof import("../scripts/decide/turn-grants.js")} */
let tg;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  ig = await import("../scripts/decide/initiative-grants.js");
  tg = await import("../scripts/decide/turn-grants.js");
});

describe("INITIATIVE_GRANTS", () => {
  it("two frozen rows: Persistent Rage automatic, Uncanny Metabolism offered with its heal", () => {
    const pr = reg.INITIATIVE_GRANTS["Persistent Rage"];
    const um = reg.INITIATIVE_GRANTS["Uncanny Metabolism"];
    expect(Object.isFrozen(pr) && Object.isFrozen(um)).toBe(true);
    expect(pr).toMatchObject({ regain: "Rage", unit: "Rage uses" });
    expect(pr.ask).toBeUndefined();
    expect(um).toMatchObject({
      regain: "Monk's Focus",
      unit: "Focus Points",
      heal: "Uncanny Metabolism",
      ask: true
    });
    expectPointer(pr.rule);
    expectPointer(um.rule);
    expect(reg.initiativeGrantEntries().map(e => e.kind)).toEqual([
      "persistent rage",
      "uncanny metabolism",
      "tandem footwork", // B4
      "perfect focus" // C1
    ]);
  });
});

describe("the grant is due", () => {
  const own = { value: 1, max: 1 };
  it("an expended use of the regained item makes it due", () => {
    expect(ig.initiativeGrantDue({ own, regain: { spent: 2, max: 3 } })).toEqual({
      due: true,
      why: "2 expended"
    });
  });
  it("nothing expended and no heal: never burnt on nothing", () => {
    expect(ig.initiativeGrantDue({ own, regain: { spent: 0, max: 3 } }).due).toBe(false);
  });
  it("a healing row is due for missing Hit Points alone", () => {
    expect(
      ig.initiativeGrantDue({
        own,
        regain: { spent: 0, max: 3 },
        heals: true,
        hp: { value: 20, max: 30 }
      })
    ).toEqual({ due: true, why: "Hit Points missing" });
    expect(
      ig.initiativeGrantDue({
        own,
        regain: { spent: 0, max: 3 },
        heals: true,
        hp: { value: 30, max: 30 }
      }).due
    ).toBe(false);
  });
  it("the feature's own use spent: not due", () => {
    expect(
      ig.initiativeGrantDue({ own: { value: 0, max: 1 }, regain: { spent: 3, max: 3 } })
    ).toEqual({ due: false, why: "used since the last Long Rest" });
  });
});

describe("the card's line", () => {
  const base = {
    row: "Uncanny Metabolism",
    unit: "Focus Points",
    back: 3,
    max: 3,
    formula: "1d8 + 5"
  };
  it("the offer", () => {
    expect(ig.initiativeGrantLine({ ...base, status: "pending" })).toBe(
      "Uncanny Metabolism — regain 3 Focus Points and 1d8 + 5 Hit Points? (once per Long Rest)"
    );
  });
  it("landed, with the heal", () => {
    expect(
      ig.initiativeGrantLine({
        ...base,
        status: "resolved",
        answer: "yes",
        applied: true,
        healed: 9
      })
    ).toBe("Uncanny Metabolism — Focus Points regained (3 of 3), 9 Hit Points regained");
  });
  it("landed, no heal (Persistent Rage)", () => {
    expect(
      ig.initiativeGrantLine({
        row: "Persistent Rage",
        unit: "Rage uses",
        max: 3,
        status: "resolved",
        answer: "auto",
        applied: true
      })
    ).toBe("Persistent Rage — Rage uses regained (3 of 3)");
  });
  it("No, and the timer's No", () => {
    expect(ig.initiativeGrantLine({ ...base, status: "resolved", answer: "no" })).toBe(
      "Uncanny Metabolism — kept for later"
    );
    expect(
      ig.initiativeGrantLine({ ...base, status: "resolved", answer: "no", timedOut: true })
    ).toBe("Uncanny Metabolism — kept for later (timer)");
  });
});

describe("TURN_GRANTS — Vitality of the Tree's two benefits", () => {
  const answers = (key, item) => item?.name === key;
  const features = [{ name: "Vitality of the Tree" }, { name: "Regeneration" }];
  it("the rows: Vitality Surge on the Rage's use, Life-Giving Force at a raging turn start, given to one creature", () => {
    expect(reg.TURN_GRANTS["Vitality Surge"]).toMatchObject({
      match: "feature",
      feature: "Vitality of the Tree",
      on: "use",
      of: "Rage"
    });
    expect(reg.TURN_GRANTS["Life-Giving Force"]).toMatchObject({
      match: "feature",
      feature: "Vitality of the Tree",
      on: "turnStart",
      while: "raging",
      to: "ally",
      reach: 10,
      self: false
    });
    expectPointer(reg.TURN_GRANTS["Vitality Surge"].rule);
    expectPointer(reg.TURN_GRANTS["Life-Giving Force"].rule);
  });
  it("featureGrantRows answers a benefit by its feature and narrows by the moment", () => {
    const use = tg
      .featureGrantRows({ table: reg.TURN_GRANTS, features, answers, on: "use" })
      .map(r => r.key);
    const start = tg
      .featureGrantRows({ table: reg.TURN_GRANTS, features, answers, on: "turnStart" })
      .map(r => r.key);
    expect(use).toEqual(["Vitality Surge"]);
    expect(start).toEqual(["Regeneration", "Life-Giving Force"]);
  });
  it("Persistent Rage silences the Rage's reminder", () => {
    expect(reg.TURN_GRANTS.Rage.unlessFeature).toBe("Persistent Rage");
  });
});
