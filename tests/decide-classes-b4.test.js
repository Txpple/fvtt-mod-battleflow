import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: the PHB classes, stage B4 (RULINGS *The PHB classes — B4*) — band B rows on tables that exist: the
 * bystander's side-following sign (Bend Luck) and omen sign (Cosmic Omen), the tactical folds with their own tests
 * (Dark One's Own Luck, Homing Strikes). The spell-damage bonuses are in decide-damage-rules.test.js. No Foundry stub.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/rescue-hit.js")} */
let r;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  r = await import("../scripts/decide/rescue-hit.js");
});

describe("the bystander's sign — Bend Luck and Cosmic Omen (B4)", () => {
  it("Bend Luck: a die row on every D20 Test within 60 ft, the sign following the side, a plain 1d4", () => {
    const row = reg.INTERRUPT_ROLLS["Bend Luck"];
    expect(row).toMatchObject({
      reaction: true,
      uses: true,
      bystander: 60,
      bend: "die",
      sign: "either",
      die: "1d4",
      on: "both"
    });
    expect(row.tests).toEqual(["attack", "save", "check"]);
    expect(reg.INTERRUPTS).toContainEqual({ name: "Bend Luck", kind: "roll" });
    expectPointer(row.rule);
  });
  it("Cosmic Omen: the stored d6's parity is the sign, the pack's Weal / Woe activity picked by it", () => {
    const row = reg.INTERRUPT_ROLLS["Cosmic Omen"];
    expect(row).toMatchObject({
      reaction: true,
      uses: true,
      bystander: 30,
      bend: "die",
      sign: "omen",
      die: "1d6",
      on: "both",
      stored: "Cosmic Omen"
    });
    expect(row.omen).toEqual({ even: "Weal (Even)", odd: "Woe (Odd)" });
    expect(reg.STORED_DICE["Cosmic Omen"]).toMatchObject({
      dice: 1,
      die: 6,
      rests: ["long"],
      tests: [],
      omen: true
    });
    expect(reg.INTERRUPTS).toContainEqual({ name: "Cosmic Omen", kind: "roll" });
    expectPointer(row.rule);
  });
  it("signFor: a number stands; 'either' follows the side; 'omen' follows the face's parity, null with no face", () => {
    expect(r.signFor({ sign: -1 }, { friendly: true })).toBe(-1);
    expect(r.signFor({}, { friendly: false })).toBe(1);
    expect(r.signFor({ sign: "either" }, { friendly: true })).toBe(1);
    expect(r.signFor({ sign: "either" }, { friendly: false })).toBe(-1);
    expect(r.signFor({ sign: "omen" }, { friendly: true, face: 4 })).toBe(1);
    expect(r.signFor({ sign: "omen" }, { friendly: false, face: 3 })).toBe(-1);
    expect(r.signFor({ sign: "omen" }, { friendly: true, face: null })).toBeNull();
  });
  it("guardSign: the stamped guard's sign wins, else the row's plain number, else +1", () => {
    expect(r.guardSign({ sign: -1 }, { sign: "either" })).toBe(-1);
    expect(r.guardSign({}, { sign: -1 })).toBe(-1);
    expect(r.guardSign({}, { sign: "either" })).toBe(1);
    expect(r.guardSign(null, null)).toBe(1);
  });
  it("the margin gate takes the resolved sign: a −1d4 turns a hit by 3, a +1d4 a miss by 3, and never the other way", () => {
    const base = {
      bend: "die",
      dieMax: 4,
      kept: 12,
      total: 15,
      target: 13,
      mode: "normal",
      critAt: 20,
      fumbleAt: 1
    };
    expect(r.bystanderMatters({ ...base, sign: -1, want: "miss" })).toBe(true);
    expect(r.bystanderMatters({ ...base, sign: 1, want: "miss" })).toBe(false);
    expect(r.bystanderMatters({ ...base, sign: 1, want: "hit", total: 10 })).toBe(true);
    expect(r.bystanderMatters({ ...base, sign: -1, want: "hit", total: 10 })).toBe(false);
  });
});

describe("the tactical folds with their own tests — Dark One's Own Luck and Homing Strikes (B4)", () => {
  it("both are `tactical` d20 folds (no new kind) with a TACTICAL_FOLDS row naming the tests and the activity", () => {
    expect(reg.D20_FOLDS).toContainEqual({ name: "Dark One's Own Luck", kind: "tactical" });
    expect(reg.D20_FOLDS).toContainEqual({ name: "Soul Blades", kind: "tactical" });
    expect(reg.D20_FOLD_KINDS.size).toBe(7);
    expect(reg.TACTICAL_FOLDS["Dark One's Own Luck"]).toMatchObject({
      tests: ["check", "save"],
      activity: "Luck"
    });
    expect(reg.TACTICAL_FOLDS["Soul Blades"]).toMatchObject({
      tests: ["attack"],
      activity: "Homing Strikes",
      weapon: "Psychic Blade"
    });
    for (const row of Object.values(reg.TACTICAL_FOLDS)) expectPointer(row.rule);
  });
  it("a tactical fold row is never also a maneuver scope", () => {
    for (const name of Object.keys(reg.TACTICAL_FOLDS))
      expect(reg.SUPERIORITY_FOLDS[name]).toBeUndefined();
  });
});

describe("the grants that are not a roll — Tandem Footwork, Heroic Warrior, Guarded Mind, Self-Restoration, Physician's Touch (B4)", () => {
  /** @type {typeof import("../scripts/decide/turn-grants.js")} */
  let tg;
  /** @type {typeof import("../scripts/decide/initiative-grants.js")} */
  let ig;
  beforeAll(async () => {
    tg = await import("../scripts/decide/turn-grants.js");
    ig = await import("../scripts/decide/initiative-grants.js");
  });
  it("Tandem Footwork is an Initiative grant to allies within 30 ft, offered, the pack's activity rolled", () => {
    const row = reg.INITIATIVE_GRANTS["Tandem Footwork"];
    expect(row).toMatchObject({ to: "allies", reach: 30, activity: "Initiative Bonus", ask: true });
    expectPointer(row.rule);
    expect(
      ig.initiativeGrantLine({
        row: "Tandem Footwork",
        status: "pending",
        give: true,
        formula: "1d8",
        reach: 30,
        unit: "Bardic Inspiration"
      })
    ).toBe("Tandem Footwork — give 1d8 to allies within 30 ft? · a use of Bardic Inspiration");
    expect(
      ig.initiativeGrantLine({
        row: "Tandem Footwork",
        status: "resolved",
        answer: "yes",
        applied: true,
        give: true,
        rolled: 5,
        given: [
          { name: "Bard", from: 12, to: 17 },
          { name: "Cleric", from: 8, to: 13 }
        ],
        due: ["c3"]
      })
    ).toBe("Tandem Footwork — +5 Initiative: Bard 12 → 17, Cleric 8 → 13 (1 still to roll)");
    expect(ig.initiativeGrantLine({ row: "Tandem Footwork", answer: "no", give: true })).toBe(
      "Tandem Footwork — kept for later"
    );
  });
  it("the four turn-grant feature rows: Heroic Warrior writes, the three others end a condition (Guarded Mind paid by its activity)", () => {
    expect(reg.TURN_GRANTS["Heroic Warrior"]).toMatchObject({
      match: "feature",
      on: "turnStart",
      grant: "inspiration"
    });
    expect(reg.TURN_GRANTS["Guarded Mind"]).toMatchObject({
      match: "feature",
      on: "turnStart",
      grant: "end",
      activity: "End Effects",
      statuses: ["charmed", "frightened"]
    });
    expect(reg.TURN_GRANTS["Self-Restoration"]).toMatchObject({
      match: "feature",
      on: "turnEnd",
      grant: "end",
      statuses: ["charmed", "frightened", "poisoned"]
    });
    expect(reg.TURN_GRANTS["Self-Restoration"].activity).toBeUndefined();
    expect(reg.TURN_GRANTS["Physician's Touch"]).toMatchObject({
      match: "feature",
      on: "use",
      of: ["Hand of Healing", "Physician's Touch"],
      activityType: "heal",
      to: "target",
      grant: "end"
    });
    for (const key of ["Heroic Warrior", "Guarded Mind", "Self-Restoration", "Physician's Touch"])
      expectPointer(reg.TURN_GRANTS[key].rule);
    const answers = (key, item) => item?.name === key;
    const feats = [{ name: "Self-Restoration" }, { name: "Guarded Mind" }];
    expect(
      tg
        .featureGrantRows({ table: reg.TURN_GRANTS, features: feats, answers, on: "turnEnd" })
        .map(r => r.key)
    ).toEqual(["Self-Restoration"]);
    expect(
      tg
        .featureGrantRows({ table: reg.TURN_GRANTS, features: feats, answers, on: "turnStart" })
        .map(r => r.key)
    ).toEqual(["Guarded Mind"]);
  });
  it("endOptionsOf: only the conditions the bearer wears, each with the effects carrying it", () => {
    const effects = [
      { id: "e1", name: "Frightened", statuses: ["frightened"] },
      { id: "e2", name: "Hold Person", statuses: ["paralyzed"] },
      { id: "e3", name: "Fear", statuses: ["frightened"] }
    ];
    expect(
      tg.endOptionsOf(["charmed", "frightened"], effects, { frightened: "Frightened" })
    ).toEqual([
      {
        status: "frightened",
        label: "Frightened",
        effectIds: ["e1", "e3"],
        names: ["Frightened", "Fear"]
      }
    ]);
    expect(tg.endOptionsOf(["charmed"], effects)).toEqual([]);
    expect(tg.endOptionsOf(["paralyzed"], effects)[0].label).toBe("Paralyzed");
  });
});
