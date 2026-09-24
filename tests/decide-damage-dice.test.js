import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer: the damage-dice folds' patch (decide/damage-dice.js) — Empowered Spell's per-die
 * reroll (lifted out of metamagic.js, 2026-09-24) and Savage Attacker's per-set second roll (Slice
 * A, ruled 2026-09-24 off prototypes/slice-a.html). No Foundry: the data is the platform's roll JSON.
 */
/** @type {typeof import("../scripts/decide/damage-dice.js")} */
let d;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  d = await import("../scripts/decide/damage-dice.js");
  reg = await import("../scripts/decide/registry.js");
});

/** A damage roll's JSON: one die term and a flat modifier. */
const weaponRoll = (faces, results, extra = {}) => ({
  class: "DamageRoll",
  formula: `${results.length}d${faces} + 4`,
  terms: [
    {
      class: "Die",
      number: results.length,
      faces,
      modifiers: [],
      results: results.map(n => ({ result: n, active: true })),
      ...extra
    },
    { class: "OperatorTerm", operator: "+" },
    { class: "NumericTerm", number: 4 }
  ]
});
/** A rider's roll: Sneak Attack's 2d6, pushed after the weapon's. */
const riderRoll = {
  class: "DamageRoll",
  formula: "2d6",
  terms: [
    {
      class: "Die",
      number: 2,
      faces: 6,
      modifiers: [],
      results: [
        { result: 1, active: true },
        { result: 2, active: true }
      ]
    }
  ]
};

describe("weaponDiceOf — only the activity's own dice, never a modifier, never a rider", () => {
  it("a Longsword's 1d8 + 4 is one die; the +4 is no die", () => {
    const dice = d.weaponDiceOf([weaponRoll(8, [5])], 1);
    expect(dice).toEqual([{ roll: 0, term: 0, number: 1, faces: 8, modifiers: [], values: [5] }]);
    expect(d.setFormula(dice)).toBe("1d8");
    expect(d.setTotal(dice)).toBe(5);
  });
  it("a Greatsword's 2d6 is one set of two", () => {
    const dice = d.weaponDiceOf([weaponRoll(6, [3, 2])], 1);
    expect(d.setFormula(dice)).toBe("2d6");
    expect(d.setTotal(dice)).toBe(5);
  });
  it("a crit's doubled dice are the set (the whole doubled set rolls again — the ruling)", () => {
    const dice = d.weaponDiceOf([weaponRoll(8, [5, 3])], 1);
    expect(d.setFormula(dice)).toBe("2d8");
  });
  it("the rolls past the count — Sneak Attack, a mark, a maneuver's die — are never the weapon's", () => {
    const dice = d.weaponDiceOf([weaponRoll(8, [5]), riderRoll], 1);
    expect(dice.length).toBe(1);
    expect(d.setTotal(dice)).toBe(5);
  });
  it("a die's own modifiers ride the second set (Great Weapon Fighting's floor, a reroll)", () => {
    const dice = d.weaponDiceOf([weaponRoll(6, [3, 4], { modifiers: ["min3"] })], 1);
    expect(d.setFormula(dice)).toBe("2d6min3");
  });
  it("a face already struck does not count", () => {
    const roll = weaponRoll(8, [5]);
    roll.terms[0].results = [
      { result: 1, active: false, rerolled: true },
      { result: 5, active: true }
    ];
    expect(d.setTotal(d.weaponDiceOf([roll], 1))).toBe(5);
  });
});

describe("eitherOutcome — the higher set stands, never asked", () => {
  it("the second higher: it stands, the delta is the difference", () => {
    expect(d.eitherOutcome({ first: 5, second: 10 })).toEqual({
      stands: "second",
      kept: 10,
      struck: 5,
      delta: 5
    });
  });
  it("the second lower: the first stands, nothing moves", () => {
    expect(d.eitherOutcome({ first: 5, second: 2 })).toEqual({
      stands: "first",
      kept: 5,
      struck: 2,
      delta: 0
    });
  });
  it("a tie keeps the first — the card does not move for nothing", () => {
    expect(d.eitherOutcome({ first: 6, second: 6 })).toMatchObject({ stands: "first", delta: 0 });
  });
});

describe("eitherPatch — both sets on the card, the loser struck", () => {
  it("the second set wins: the old faces struck, the new ones active, the modifier untouched", () => {
    const data = [weaponRoll(6, [3, 2])];
    const dice = d.weaponDiceOf(data, 1);
    const out = d.eitherPatch(
      data,
      dice,
      [
        [
          { result: 6, active: true },
          { result: 4, active: true }
        ]
      ],
      true
    );
    expect(out[0].terms[0].results).toEqual([
      { result: 3, active: false, discarded: true },
      { result: 2, active: false, discarded: true },
      { result: 6, active: true },
      { result: 4, active: true }
    ]);
    expect(out[0].terms[2]).toEqual({ class: "NumericTerm", number: 4 });
    expect(d.setTotal(d.weaponDiceOf(out, 1))).toBe(10);
    // A clone: the input is untouched.
    expect(data[0].terms[0].results.every(r => r.active)).toBe(true);
  });
  it("the second set loses: the new faces join struck, the first still counts", () => {
    const data = [weaponRoll(8, [5])];
    const out = d.eitherPatch(
      data,
      d.weaponDiceOf(data, 1),
      [[{ result: 2, active: true }]],
      false
    );
    expect(out[0].terms[0].results).toEqual([
      { result: 5, active: true },
      { result: 2, active: false, discarded: true }
    ]);
    expect(d.setTotal(d.weaponDiceOf(out, 1))).toBe(5);
  });
  it("a rider's roll is never touched", () => {
    const data = [weaponRoll(8, [5]), riderRoll];
    const out = d.eitherPatch(data, d.weaponDiceOf(data, 1), [[{ result: 8, active: true }]], true);
    expect(out[1]).toEqual(riderRoll);
  });
});

describe("eitherDue — once per turn, on a weapon, listed and owned", () => {
  it("due on a weapon hit when no chit stands (and out of combat none ever does)", () => {
    expect(d.eitherDue({ listed: true, owned: true, weapon: true, chitStands: false })).toBe("due");
  });
  it("spent once the turn's chit stands — the second hit gets only the tag", () => {
    expect(d.eitherDue({ listed: true, owned: true, weapon: true, chitStands: true })).toBe(
      "spent"
    );
  });
  it("nothing at all off a weapon, off the list or off the sheet", () => {
    expect(d.eitherDue({ listed: true, owned: true, weapon: false, chitStands: false })).toBeNull();
    expect(d.eitherDue({ listed: false, owned: true, weapon: true, chitStands: false })).toBeNull();
    expect(d.eitherDue({ listed: true, owned: false, weapon: true, chitStands: false })).toBeNull();
  });
});

describe("eitherCardLine — source, then result", () => {
  it("the used line shows both sets and the tag", () => {
    expect(
      d.eitherCardLine({
        status: "used",
        feature: "Savage Attacker",
        formula: "1d8",
        first: 5,
        second: 7,
        stands: "second",
        total: 11
      })
    ).toBe("Savage Attacker — 1d8 → 5, again → 7 — the higher stands: 11 · used this turn");
    expect(
      d.eitherCardLine({
        status: "used",
        feature: "Savage Attacker",
        formula: "1d8",
        first: 5,
        second: 2,
        stands: "first",
        total: 9
      })
    ).toBe("Savage Attacker — 1d8 → 5, again → 2 — the first stands: 9 · used this turn");
  });
  it("spent, kept and moot say so", () => {
    expect(d.eitherCardLine({ status: "spent", feature: "Savage Attacker" })).toBe(
      "Savage Attacker — used this turn"
    );
    expect(d.eitherCardLine({ status: "kept", feature: "Savage Attacker" })).toBe(
      "Savage Attacker — not used, still ready this turn"
    );
    expect(
      d.eitherCardLine({ status: "kept", feature: "Savage Attacker", timedOut: true })
    ).toContain("the clock ran out");
    expect(d.eitherCardLine({ status: "moot", feature: "Savage Attacker" })).toContain(
      "the attack missed"
    );
    // Due: waiting on the defender's hold — the ruled order, the hit stands first.
    expect(d.eitherCardLine({ status: "due", feature: "Savage Attacker" })).toBe(
      "Savage Attacker — asks once the hit stands"
    );
  });
});

describe("rerollFaces — Empowered Spell's per-die patch, lifted", () => {
  it("strikes each picked face and adds its new face, in pick order", () => {
    const data = [weaponRoll(6, [1, 2, 6])];
    const { data: out, done } = d.rerollFaces(
      data,
      [
        { key: "0:0:0", roll: 0, term: 0, index: 0 },
        { key: "0:0:1", roll: 0, term: 0, index: 1 }
      ],
      [5, 3]
    );
    expect(done).toEqual([
      { key: "0:0:0", old: 1, new: 5 },
      { key: "0:0:1", old: 2, new: 3 }
    ]);
    expect(out[0].terms[0].results).toEqual([
      { result: 1, active: false, rerolled: true },
      { result: 2, active: false, rerolled: true },
      { result: 6, active: true },
      { result: 5, active: true },
      { result: 3, active: true }
    ]);
    expect(data[0].terms[0].results[0].active).toBe(true); // a clone
  });
  it("a pick whose face is gone is skipped", () => {
    const { done } = d.rerollFaces(
      [weaponRoll(6, [1])],
      [{ key: "0:0:4", roll: 0, term: 0, index: 4 }],
      [5]
    );
    expect(done).toEqual([]);
  });
});

describe("DAMAGE_EITHER — the table and its list", () => {
  it("Savage Attacker: a weapon, a riderKey, its rule verbatim", () => {
    expect(reg.DAMAGE_EITHER["Savage Attacker"]).toMatchObject({
      key: "savage-attacker",
      weapon: true
    });
    expect(reg.DAMAGE_EITHER["Savage Attacker"].rule).toContain(
      "roll the weapon’s damage dice twice and use either roll"
    );
  });
  it("the Damage Rolled Twice list ships the table and parses clean", () => {
    const { entries, rejects } = reg.parseList(
      reg.LIST_SPECS.damageEither,
      reg.LIST_SPECS.damageEither.default
    );
    expect(rejects).toEqual([]);
    expect(entries.map(e => e.kind)).toEqual(["savage attacker"]);
  });
});
