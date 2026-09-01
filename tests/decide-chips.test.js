import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer chip clocks and spends (ARCHITECTURE.md §2). No Foundry stub on purpose.
 *
 * ⚠ This is the arithmetic that decides how long a chip stands and which swing spends it —
 * the window values pin what tools/probe-expiry.mjs MEASURED on Foundry 14.365, so a change
 * here is a change to what the table sees on the token, not a refactor.
 */
/** @type {typeof import("../scripts/decide/chips.js")} */
let c;
beforeAll(async () => {
  c = await import("../scripts/decide/chips.js");
});

const place = {
  combat: "cmb1",
  combatant: "cbt-attacker",
  initiative: 17,
  round: 3,
  turn: 2,
  time: 600
};

describe("CHIP_WINDOWS — the rules text as v14 duration data", () => {
  it("Vex closes at the END of the attacker's next turn, one round out", () => {
    expect(c.CHIP_WINDOWS.vex).toEqual({ value: 1, units: "rounds", expiry: "turnEnd" });
  });
  it("Sap and Slow close at the START of the attacker's next turn", () => {
    expect(c.CHIP_WINDOWS.sap).toEqual({ value: 1, units: "rounds", expiry: "turnStart" });
    expect(c.CHIP_WINDOWS.slow).toEqual(c.CHIP_WINDOWS.sap);
  });
  it("the Cleave chit dies with the turn it was written in — zero turns, judged at turnEnd", () => {
    expect(c.CHIP_WINDOWS.cleave).toEqual({ value: 0, units: "turns", expiry: "turnEnd" });
  });
  it("is frozen — a window is a rule, not a variable", () => {
    expect(Object.isFrozen(c.CHIP_WINDOWS)).toBe(true);
    expect(Object.isFrozen(c.CHIP_WINDOWS.vex)).toBe(true);
    expect(c.TURN_CHIPS).toEqual(["vex", "sap", "slow", "cleave"]);
  });
});

describe("chipClock — the duration plus the attacker's place in the order", () => {
  it("in combat: the window and a start pinned to the ATTACKER's combatant", () => {
    expect(c.chipClock("sap", place)).toEqual({
      duration: { value: 1, units: "rounds", expiry: "turnStart" },
      start: {
        combat: "cmb1",
        combatant: "cbt-attacker",
        initiative: 17,
        round: 3,
        turn: 2,
        time: 600
      }
    });
  });
  it("returns fresh objects — the frozen window is never handed out to be mutated", () => {
    const a = c.chipClock("vex", place);
    a.duration.value = 99;
    expect(c.CHIP_WINDOWS.vex.value).toBe(1);
    expect(c.chipClock("vex", place).duration.value).toBe(1);
  });
  it("out of combat: the window alone, no start — the platform reframes it in time", () => {
    expect(c.chipClock("vex", null)).toEqual({
      duration: { value: 1, units: "rounds", expiry: "turnEnd" }
    });
  });
  it("out of combat there is no turn to be once-per: the cleave chit is not written", () => {
    expect(c.chipClock("cleave", null)).toBeNull();
    expect(c.chipClock("cleave", place)).toEqual({
      duration: { value: 0, units: "turns", expiry: "turnEnd" },
      start: place
    });
  });
  it("a chip this module does not clock gets no clock", () => {
    expect(c.chipClock("topple", place)).toBeNull();
    expect(c.chipClock("", null)).toBeNull();
  });
});

describe("chipIsDead — the platform's reading, and the one case it leaves alone", () => {
  it("expired is dead", () => {
    expect(c.chipIsDead({ expired: true, remaining: 1, value: 1 })).toBe(true);
  });
  it("a clock that ran out is dead; one that never resolved is dead too (the v1.27.1 shape)", () => {
    expect(c.chipIsDead({ expired: false, remaining: 0, value: 1 })).toBe(true);
    expect(c.chipIsDead({ expired: false, remaining: -2, value: 1 })).toBe(true);
    expect(c.chipIsDead({ expired: false, remaining: null, value: 1 })).toBe(true);
    expect(c.chipIsDead({ expired: false, remaining: Number.NaN, value: 1 })).toBe(true);
  });
  it("time on the clock is alive", () => {
    expect(c.chipIsDead({ expired: false, remaining: 1, value: 1 })).toBe(false);
    expect(c.chipIsDead({ expired: false, remaining: 6, value: 6 })).toBe(false);
  });
  it("NO clock is somebody else's contract — never dead, whatever the rest says", () => {
    expect(c.chipIsDead({ expired: false, remaining: null, value: null })).toBe(false);
    expect(c.chipIsDead({ expired: true, remaining: null })).toBe(false);
    expect(c.chipIsDead()).toBe(false);
  });
  it("a ZERO-length window (the once-per-turn chit) lives until the platform says expired", () => {
    expect(c.chipIsDead({ expired: false, remaining: 0, value: 0 })).toBe(false);
    expect(c.chipIsDead({ expired: true, remaining: 0, value: 0 })).toBe(true);
  });
});

describe("chipSpentBy — which swing spends which chip", () => {
  it("Vex: the chip's own attacker's next attack roll against the bearer", () => {
    expect(
      c.chipSpentBy("vex", {
        bearerIsTarget: true,
        bearerIsAttacker: false,
        attackerOwnsChip: true
      })
    ).toBe(true);
  });
  it("Vex is NOT spent by somebody else attacking the bearer, nor by the bearer attacking", () => {
    expect(
      c.chipSpentBy("vex", {
        bearerIsTarget: true,
        bearerIsAttacker: false,
        attackerOwnsChip: false
      })
    ).toBe(false);
    expect(
      c.chipSpentBy("vex", {
        bearerIsTarget: false,
        bearerIsAttacker: true,
        attackerOwnsChip: true
      })
    ).toBe(false);
  });
  it("Sap: the bearer's next attack roll, at anyone", () => {
    expect(
      c.chipSpentBy("sap", {
        bearerIsTarget: false,
        bearerIsAttacker: true,
        attackerOwnsChip: false
      })
    ).toBe(true);
    expect(
      c.chipSpentBy("sap", {
        bearerIsTarget: true,
        bearerIsAttacker: false,
        attackerOwnsChip: true
      })
    ).toBe(false);
  });
  it("Slow and the cleave chit are spent by nothing — their windows close them", () => {
    const every = { bearerIsTarget: true, bearerIsAttacker: true, attackerOwnsChip: true };
    expect(c.chipSpentBy("slow", every)).toBe(false);
    expect(c.chipSpentBy("cleave", every)).toBe(false);
    expect(c.chipSpentBy("topple", every)).toBe(false);
  });
});

describe("CHIP_FLAG / chipOwnedBy — the fingerprint, and whose chip it is", () => {
  it("names the flag every chip carries", () => {
    expect(c.CHIP_FLAG).toBe("mastery");
  });
  it("owns a chip whose origin is one of the attacker's items, and nothing else", () => {
    expect(c.chipOwnedBy("Actor.abc.Item.def", "Actor.abc")).toBe(true);
    expect(c.chipOwnedBy("Actor.xyz.Item.def", "Actor.abc")).toBe(false);
    expect(c.chipOwnedBy("Actor.abcd.Item.def", "Actor.abc")).toBe(false);
    expect(c.chipOwnedBy(null, "Actor.abc")).toBe(false);
    expect(c.chipOwnedBy("Actor.abc.Item.def", "")).toBe(false);
  });
});

describe("rollModeOf / chipHonoured / spendRecord — the receipt's vocabulary", () => {
  it("reads the sign of the system's advantage mode", () => {
    expect(c.rollModeOf(1)).toBe("advantage");
    expect(c.rollModeOf(-1)).toBe("disadvantage");
    expect(c.rollModeOf(0)).toBe("normal");
    expect(c.rollModeOf(undefined)).toBe("normal");
    expect(c.rollModeOf(null)).toBe("normal");
  });
  it("Vex is honoured by advantage, Sap by disadvantage, nothing else has a claim", () => {
    expect(c.chipHonoured("vex", "advantage")).toBe(true);
    expect(c.chipHonoured("vex", "normal")).toBe(false);
    expect(c.chipHonoured("sap", "disadvantage")).toBe(true);
    expect(c.chipHonoured("sap", "advantage")).toBe(false);
    expect(c.chipHonoured("slow", "normal")).toBeNull();
  });
  it("when the gate showed a NET, honour is the press matching the net — a cancelled Vex is honoured by Normal", () => {
    expect(c.chipHonoured("vex", "normal", "normal")).toBe(true);
    expect(c.chipHonoured("vex", "advantage", "normal")).toBe(false);
    expect(c.chipHonoured("sap", "normal", "normal")).toBe(true);
    expect(c.chipHonoured("sap", "disadvantage", "disadvantage")).toBe(true);
    expect(c.chipHonoured("slow", "normal", "normal")).toBeNull();
    expect(
      c.spendRecord({
        id: "e",
        name: "Vexed",
        key: "vex",
        bearerUuid: "A",
        bearerName: "G",
        mode: "normal",
        net: "normal"
      }).honoured
    ).toBe(true);
  });
  it("spendRecord carries the chip, the bearer, the mode and the honour verdict", () => {
    expect(
      c.spendRecord({
        id: "e1",
        name: "Vexed",
        img: "i.svg",
        key: "vex",
        bearerUuid: "Actor.g",
        bearerName: "Goblin",
        mode: "normal"
      })
    ).toEqual({
      id: "e1",
      name: "Vexed",
      img: "i.svg",
      key: "vex",
      uuid: "Actor.g",
      bearer: "Goblin",
      mode: "normal",
      honoured: false
    });
    expect(
      c.spendRecord({
        id: "e2",
        name: "Sapped",
        key: "sap",
        bearerUuid: "Actor.g",
        bearerName: "Goblin",
        mode: "disadvantage"
      }).img
    ).toBeNull();
  });
});
