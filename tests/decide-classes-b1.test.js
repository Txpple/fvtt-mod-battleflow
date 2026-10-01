import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: the PHB classes, stage B1 (RULINGS *The PHB classes — B1*) — the `reroll` d20 fold (REROLLS:
 * Indomitable, Fanatical Focus) and Countercharm's bystander bend (`bend: "reroll"`). No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/verdict.js")} */
let v;
/** @type {typeof import("../scripts/decide/rescue-hit.js")} */
let r;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  v = await import("../scripts/decide/verdict.js");
  r = await import("../scripts/decide/rescue-hit.js");
});

describe("REROLLS — the table of the `reroll` kind", () => {
  it("two frozen rows, each a pointer: Indomitable pays a use, Fanatical Focus the Rage's once", () => {
    const ind = reg.REROLLS.Indomitable;
    const fan = reg.REROLLS["Fanatical Focus"];
    expect(Object.isFrozen(ind) && Object.isFrozen(fan)).toBe(true);
    expect(ind).toMatchObject({ tests: ["save"], bonus: "@classes.fighter.levels", uses: true });
    expect(fan).toMatchObject({
      tests: ["save"],
      bonus: "@scale.barbarian.rage-damage",
      while: "raging",
      once: "rage"
    });
    expect(ind.while).toBeUndefined();
    expect(fan.uses).toBeUndefined();
    expectPointer(ind.rule);
    expectPointer(fan.rule);
    // The bonus is a FORMULA on the roller, never a transcribed number (R4 / N1).
    // A row with no bonus (C1, Disciplined Survivor) rerolls flat and pays from the pool its activity consumes.
    for (const row of Object.values(reg.REROLLS)) {
      // D1 — Living Legend: no bonus, no pool — the Reaction is the cost, while its effect stands.
      if (row.bonus === null)
        expect(row.activity || (row.reaction && row.whileEffect)).toBeTruthy();
      else expect(row.bonus).toMatch(/^@/);
    }
  });
  it("is the `reroll` kind's table: the d20 folds ship each row by its feature's name", () => {
    expect(reg.D20_FOLD_KINDS.has("reroll")).toBe(true);
    for (const name of Object.keys(reg.REROLLS)) {
      expect(reg.D20_FOLDS).toContainEqual({ name, kind: "reroll" });
    }
  });
});

describe("the reroll's contribution — replace AND add, one entry", () => {
  const folds = spends => v.foldsFrom(key => (key === "d20fold" ? { spends } : null), v.SAVE_FOLDS);
  it("the new d20 REPLACES and the bonus ADDS: Indomitable's 7 → 11 + 9 = 20", () => {
    const f = folds([
      {
        kind: "reroll",
        name: "Indomitable",
        reroll: { total: 11, isCritical: false, isFumble: false },
        bonus: 9
      }
    ]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ replace: { total: 11 }, add: 9 });
    const saved = v.foldedSave({ total: 7, dc: 18, folds: f });
    expect(saved).toMatchObject({ total: 20, added: 9, replaced: true, outcome: "saved" });
  });
  it("a bonus of 0 or none adds nothing; no reroll recorded contributes nothing", () => {
    expect(folds([{ kind: "reroll", reroll: { total: 9 }, bonus: 0 }])[0].add).toBeUndefined();
    expect(folds([{ kind: "reroll", reroll: { total: 9 } }])[0].add).toBeUndefined();
    expect(folds([{ kind: "reroll", bonus: 9 }])).toHaveLength(0);
  });
  it("a rerolled natural 1 fumbles whatever the bonus; the attack side carries the target", () => {
    const attack = v.foldsFrom(
      key =>
        key === "d20fold"
          ? {
              targets: [{ uuid: "T" }],
              spends: [{ kind: "reroll", reroll: { total: 4, isFumble: true }, bonus: 9 }]
            }
          : null,
      v.ATTACK_FOLDS
    );
    expect(attack[0]).toMatchObject({ uuid: "T", replace: { total: 4, isFumble: true }, add: 9 });
    expect(v.foldedVerdict({ uuid: "T", ac: 10 }, { total: 2 }, attack)).toBe("miss");
  });
  it("stacks under a later die: reroll, still short, then a Bardic die on top", () => {
    const f = folds([
      { kind: "reroll", reroll: { total: 10 }, bonus: 2 },
      { kind: "bardic", die: 5 }
    ]);
    expect(v.foldedRoll({ total: 3 }, f)).toMatchObject({ total: 17, added: 7, replaced: true });
  });
});

describe("Countercharm — the bystander's reroll", () => {
  it("the row: a Reaction, no pool, an unnamed pack activity, 30 ft, saves only, against Charmed or Frightened, at Advantage", () => {
    const row = reg.INTERRUPT_ROLLS.Countercharm;
    expect(row).toMatchObject({
      reaction: true,
      uses: false,
      activity: null,
      bystander: 30,
      tests: ["save"],
      bend: "reroll",
      advantage: true,
      against: ["charmed", "frightened"]
    });
    expectPointer(row.rule);
    expect(reg.INTERRUPTS).toContainEqual({ name: "Countercharm", kind: "roll" });
    // Not a fold row: another creature's save is the bystander's, never the roller's rescue window.
    expect(reg.D20_FOLDS.some(e => e.name === "Countercharm")).toBe(false);
  });
  it("the margin gate: a reroll is offered only to turn a FAILURE, and only where a 20 could reach", () => {
    const gate = (total, kept, target, want = "hit") =>
      r.bystanderMatters({ bend: "reroll", want, kept, total, target });
    expect(gate(9, 4, 15)).toBe(true); // +5 modifier: a 20 makes 25
    expect(gate(9, 4, 26)).toBe(false); // even a 20 falls short
    expect(gate(16, 11, 15)).toBe(false); // already a success — nothing to turn
    expect(gate(9, 4, 15, "miss")).toBe(false); // a foe's failure is never rerolled
  });
  it("the outcome: the new d20 stands with the modifiers, the first face kept for the card", () => {
    const o = r.rerollOutcome({ kept: 4, total: 9, newKept: 17, newTotal: 22, faces: [17, 3] });
    expect(o).toMatchObject({
      how: "reroll",
      first: 4,
      stood: 17,
      firstTotal: 9,
      total: 22,
      changed: true,
      isCritical: false,
      faces: [17, 3]
    });
    // The save side of the fold reads the bent total as a REPLACE.
    const f = v.foldsFrom(key => (key === "bystanderRoll" ? { bent: o } : null), v.SAVE_FOLDS);
    expect(v.foldedSave({ total: 9, dc: 15, folds: f })).toMatchObject({
      total: 22,
      replaced: true,
      outcome: "saved"
    });
  });
});
