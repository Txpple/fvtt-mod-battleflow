import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer: the dice changers' one popup (decide/dice-changers.js, 2026-09-27) — the order
 * the rows run in (pick, then set, then one — Piercer's die chosen after Savage's set), the answer's
 * plan, the buttons, the words. No Foundry: the rows are the flag's own, the dice are roll JSON.
 */
/** @type {typeof import("../scripts/decide/dice-changers.js")} */
let dc;
beforeAll(async () => {
  dc = await import("../scripts/decide/dice-changers.js");
});

const savage = {
  key: "savage-attacker",
  feature: "Savage Attacker",
  kind: "set",
  status: "pending",
  formula: "1d8",
  first: 2
};
const piercer = {
  key: "piercer",
  feature: "Piercer",
  kind: "one",
  status: "pending",
  faces: 8,
  first: 2
};
const empowered = {
  key: "empowered",
  feature: "Empowered Spell",
  kind: "pick",
  status: "pending",
  cap: 2,
  cost: 1
};
const dice = [
  { key: "0:0:0", roll: 0, term: 0, index: 0, faces: 6, result: 1 },
  { key: "0:0:1", roll: 0, term: 0, index: 1, faces: 6, result: 4 },
  { key: "0:0:2", roll: 0, term: 0, index: 2, faces: 6, result: 2 }
];

describe("orderRows — pick, then set, then one (ruled 2026-09-27)", () => {
  it("puts Savage's set before Piercer's one die whatever the table's order", () => {
    expect(dc.orderRows([piercer, savage]).map(r => r.key)).toEqual(["savage-attacker", "piercer"]);
  });
  it("puts Empowered's pick first", () => {
    expect(dc.orderRows([piercer, empowered]).map(r => r.key)).toEqual(["empowered", "piercer"]);
  });
});

describe("birthStatus — due if any row asks, spent if every row is spent this turn", () => {
  it("reads the rows", () => {
    expect(dc.birthStatus([])).toBeNull();
    expect(
      dc.birthStatus([
        { ...savage, status: "spent" },
        { ...piercer, status: "due" }
      ])
    ).toBe("due");
    expect(
      dc.birthStatus([
        { ...savage, status: "spent" },
        { ...piercer, status: "spent" }
      ])
    ).toBe("spent");
  });
});

describe("answerPlan — the ticked rows, in order, each with what it needs", () => {
  it("runs both roll-again rows when both are ticked — Savage then Piercer (BACKLOG's one question per hit, closed)", () => {
    const plan = dc.answerPlan({ rows: [piercer, savage], ticked: ["piercer", "savage-attacker"] });
    expect(plan.map(s => s.row.key)).toEqual(["savage-attacker", "piercer"]);
  });
  it("drops an unticked row and a row no longer asking", () => {
    expect(
      dc.answerPlan({ rows: [savage, piercer], ticked: ["piercer"] }).map(s => s.row.key)
    ).toEqual(["piercer"]);
    expect(
      dc.answerPlan({ rows: [{ ...savage, status: "kept" }], ticked: ["savage-attacker"] })
    ).toEqual([]);
  });
  it("gives the pick row its chips, the cap held, and drops it with none picked", () => {
    const plan = dc.answerPlan({
      rows: [empowered],
      ticked: ["empowered"],
      picks: ["0:0:0", "0:0:2", "0:0:1"],
      dice
    });
    expect(plan[0]?.picks?.map(d => d.key)).toEqual(["0:0:0", "0:0:2"]);
    expect(dc.answerPlan({ rows: [empowered], ticked: ["empowered"], picks: [], dice })).toEqual(
      []
    );
  });
});

describe("buttonState — both buttons, the ticks pick which is live", () => {
  it("Apply while the plan does something, Keep while nothing is ticked", () => {
    expect(dc.buttonState({ rows: [savage, piercer], ticked: [] })).toEqual({
      apply: false,
      keep: true
    });
    expect(dc.buttonState({ rows: [savage, piercer], ticked: ["piercer"] })).toEqual({
      apply: true,
      keep: false
    });
    expect(dc.buttonState({ rows: [empowered], ticked: ["empowered"], picks: [], dice })).toEqual({
      apply: false,
      keep: false
    });
  });
});

describe("the words", () => {
  it("one row keeps its own popup's words; two ask about the dice", () => {
    expect(dc.applyLabel([savage])).toBe("Roll again");
    expect(dc.applyLabel([empowered])).toBe("Reroll the picked dice");
    expect(dc.applyLabel([savage, piercer])).toBe("Apply");
    expect(dc.popupTitle([piercer], 7)).toBe("7 damage — roll the 2 on the d8 again?");
    expect(dc.popupTitle([savage], 7)).toBe("7 damage — roll it again?");
    expect(dc.popupTitle([savage, piercer], 7)).toBe("7 damage — change the dice?");
  });
  it("each row's offer says its dice and its limit", () => {
    expect(dc.rowOffer(empowered)).toEqual({ dice: "reroll up to 2 dice", tag: "1 SP" });
    expect(dc.rowOffer(savage)).toEqual({ dice: "1d8 again", tag: "once per turn" });
    expect(dc.rowOffer(piercer)).toEqual({
      dice: "the 2 again — the new roll stands",
      tag: "once per turn"
    });
  });
  it("the card says each row, source then result", () => {
    const lines = dc.diceChangeLines({
      status: "used",
      rows: [
        { ...savage, status: "used", second: 6, stands: "second", delta: 4, after: 10 },
        { ...piercer, status: "used", first: 1, second: 5, stands: "second", delta: 4, after: 14 }
      ]
    });
    expect(lines).toEqual([
      "Savage Attacker — 1d8 → 2, again → 6 — the higher stands: 10 · used this turn",
      "Piercer — the 1 on the d8 again → 5 — the new roll stands: 14 · used this turn"
    ]);
    expect(
      dc.diceChangeLines({
        status: "kept",
        timedOut: true,
        rows: [{ ...empowered, status: "kept" }]
      })
    ).toEqual(["Empowered Spell — kept (the clock ran out)"]);
    expect(dc.diceChangeLines({ status: "answering", rows: [savage] })).toEqual([
      "Savage Attacker — rolling the weapon's dice again"
    ]);
  });
  it("the announce card's step lines", () => {
    expect(
      dc.stepLine({
        ...empowered,
        picks: [
          { key: "a", old: 1, new: 5 },
          { key: "b", old: 2, new: 3 }
        ],
        before: 9,
        after: 14
      })
    ).toBe("Empowered Spell — 1, 2 → 5, 3 · 9 → 14");
  });
});

describe("diceChipsOf — every live die, what it counts", () => {
  it("keys each face by its place and keeps a floored face's roll", () => {
    const out = dc.diceChipsOf([
      {
        terms: [
          {
            faces: 6,
            results: [
              { result: 1, count: 2, active: true },
              { result: 3, active: false },
              { result: 5, active: true }
            ]
          }
        ]
      }
    ]);
    expect(out).toEqual([
      { key: "0:0:0", roll: 0, term: 0, index: 0, faces: 6, result: 2, rolled: 1 },
      { key: "0:0:2", roll: 0, term: 0, index: 2, faces: 6, result: 5 }
    ]);
  });
});

describe("mergeRises — every step's chips over one actor", () => {
  it("joins the chips in order and skips the empty", () => {
    expect(
      dc.mergeRises([
        null,
        { on: "Actor.f", chips: [{ label: "7" }] },
        { on: "Actor.f", chips: [{ label: "5" }] }
      ])
    ).toEqual({ on: "Actor.f", chips: [{ label: "7" }, { label: "5" }] });
    expect(dc.mergeRises([null])).toBeNull();
  });
});
