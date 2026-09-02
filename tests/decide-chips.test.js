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
    expect(c.TURN_CHIPS).toEqual(["vex", "sap", "slow", "cleave", "sneak", "rider"]);
    expect(c.TURN_CHITS).toEqual(["cleave", "sneak", "rider"]);
    expect(c.CHIP_WINDOWS.sneak).toEqual(c.CHIP_WINDOWS.cleave);
    expect(c.CHIP_WINDOWS.rider).toEqual(c.CHIP_WINDOWS.cleave);
    expect(c.chipClock("sneak", null)).toBeNull();
    expect(c.chipClock("rider", null)).toBeNull();
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

describe("chipIsDead — the platform's mark decides; zero on the clock is ALIVE", () => {
  it("expired is dead", () => {
    expect(c.chipIsDead({ expired: true, remaining: 1, value: 1 })).toBe(true);
    expect(c.chipIsDead({ expired: true, remaining: 0, value: 0 })).toBe(true);
  });
  it("⚠ zero remaining is alive — a one-round chip reads 0 for the whole of its boundary round", () => {
    // Review finding 16 (2026-09-01): Vex applied r1t0 reads remaining 0 from r2t0 and is
    // marked expired only at r2t1; the gate must still list it on the attacker's turn.
    expect(c.chipIsDead({ expired: false, remaining: 0, value: 1 })).toBe(false);
    expect(c.chipIsDead({ expired: false, remaining: 0, value: 0 })).toBe(false);
  });
  it("a negative clock is dead — the no-GM fallback, and only after the boundary", () => {
    expect(c.chipIsDead({ expired: false, remaining: -1, value: 1 })).toBe(true);
    expect(c.chipIsDead({ expired: false, remaining: -2, value: 1 })).toBe(true);
  });
  it("a clock that never resolved is dead", () => {
    expect(c.chipIsDead({ expired: false, remaining: null, value: 1 })).toBe(true);
    expect(c.chipIsDead({ expired: false, remaining: Number.NaN, value: 1 })).toBe(true);
  });
  it("time on the clock is alive", () => {
    expect(c.chipIsDead({ expired: false, remaining: 1, value: 1 })).toBe(false);
    expect(c.chipIsDead({ expired: false, remaining: 6, value: 6 })).toBe(false);
    expect(c.chipIsDead({ expired: false, remaining: Infinity, value: 1 })).toBe(false);
  });
  it("NO clock is somebody else's contract — never dead, whatever the rest says", () => {
    expect(c.chipIsDead({ expired: false, remaining: null, value: null })).toBe(false);
    expect(c.chipIsDead({ expired: true, remaining: null })).toBe(false);
    expect(c.chipIsDead()).toBe(false);
  });
});

describe("chitStamp — the once-per-turn chit lives while its turn is the running one", () => {
  it("is the house stamp of the turn the chit was written in", () => {
    expect(c.chitStamp({ combat: "cmb1", round: 3, turn: 2 })).toBe("cmb1:3:2");
    expect(c.chitStamp({ combat: "cmb1", round: 0, turn: 0 })).toBe("cmb1:0:0");
  });
  it("a chit with no turn behind it has no stamp — never live", () => {
    expect(c.chitStamp({ combat: null, round: 3, turn: 2 })).toBeNull();
    expect(c.chitStamp({ combat: "cmb1", round: null, turn: 2 })).toBeNull();
    expect(c.chitStamp({ combat: "cmb1", round: 3 })).toBeNull();
    expect(c.chitStamp(null)).toBeNull();
    expect(c.chitStamp(undefined)).toBeNull();
  });
});

describe("chipSpentBy — which swing spends which chip", () => {
  it("Vex: the chip's own attacker's next attack roll against the bearer", () => {
    expect(c.chipSpentBy("vex", { bearer: "target", attackerOwnsChip: true })).toBe(true);
  });
  it("Vex is NOT spent by somebody else attacking the bearer, nor by the bearer attacking", () => {
    expect(c.chipSpentBy("vex", { bearer: "target", attackerOwnsChip: false })).toBe(false);
    expect(c.chipSpentBy("vex", { bearer: "attacker", attackerOwnsChip: true })).toBe(false);
  });
  it("Sap: the bearer's next attack roll, at anyone", () => {
    expect(c.chipSpentBy("sap", { bearer: "attacker" })).toBe(true);
    expect(c.chipSpentBy("sap", { bearer: "attacker", attackerOwnsChip: false })).toBe(true);
    expect(c.chipSpentBy("sap", { bearer: "target", attackerOwnsChip: true })).toBe(false);
  });
  it("Slow and the cleave chit are spent by nothing — their windows close them", () => {
    for (const bearer of ["attacker", "target"]) {
      expect(c.chipSpentBy("slow", { bearer, attackerOwnsChip: true })).toBe(false);
      expect(c.chipSpentBy("cleave", { bearer, attackerOwnsChip: true })).toBe(false);
      expect(c.chipSpentBy("topple", { bearer, attackerOwnsChip: true })).toBe(false);
    }
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

describe("rollModeOf / chipHonoured / netShownFor / spendRecord — the receipt's vocabulary", () => {
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
  it("netShownFor: the net counts only for a kind the gate actually listed", () => {
    // Review finding 1 (2026-09-01): a Sap-only gate (vex off the list) must not stamp the
    // spent Vex as honoured by the Disadvantage press.
    const sapOnly = { sources: [{ kind: "sap", bend: "disadvantage" }], net: "disadvantage" };
    expect(c.netShownFor(sapOnly, "sap")).toBe("disadvantage");
    expect(c.netShownFor(sapOnly, "vex")).toBeNull();
    expect(c.chipHonoured("vex", "disadvantage", c.netShownFor(sapOnly, "vex"))).toBe(false);
    const both = { sources: [{ kind: "sap" }, { kind: "vex" }], net: "normal" };
    expect(c.netShownFor(both, "vex")).toBe("normal");
    expect(c.netShownFor(both, "sap")).toBe("normal");
  });
  it("netShownFor: no gate, no net", () => {
    expect(c.netShownFor(null, "vex")).toBeNull();
    expect(c.netShownFor(undefined, "vex")).toBeNull();
    expect(c.netShownFor({ sources: [], net: "advantage" }, "vex")).toBeNull();
    expect(c.netShownFor({ sources: [{ kind: "vex" }] }, "vex")).toBeNull();
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
