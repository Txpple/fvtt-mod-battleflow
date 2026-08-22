import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer verdicts (ARCHITECTURE.md §2). No Foundry stub on purpose.
 *
 * ⚠ This is the module's most consequential arithmetic: `hitsAmong` decides whether an attack
 * landed, and `saveMultiplier` decides how much damage a save lets through. Both moved here
 * verbatim from code that had no unit coverage at all and could only be exercised by the slow
 * live suites.
 */
/** @type {typeof import("../scripts/decide/verdict.js")} */
let v;
beforeAll(async () => {
  v = await import("../scripts/decide/verdict.js");
});

const roll = (total, { isCritical = false, isFumble = false } = {}) => ({
  total,
  isCritical,
  isFumble
});
const uuids = list => list.map(t => t.uuid);

describe("hitsAmong — the hit test", () => {
  const targets = [
    { uuid: "a", ac: 15 },
    { uuid: "b", ac: 20 }
  ];

  it("hits what the total reaches and misses what it does not", () => {
    expect(uuids(v.hitsAmong({ targets, roll: roll(17) }))).toEqual(["a"]);
  });

  it("counts an exact tie as a hit — total >= ac", () => {
    expect(uuids(v.hitsAmong({ targets, roll: roll(15) }))).toEqual(["a"]);
  });

  it("a critical hits EVERYTHING, whatever the AC", () => {
    expect(uuids(v.hitsAmong({ targets, roll: roll(3, { isCritical: true }) }))).toEqual([
      "a",
      "b"
    ]);
  });

  it("a fumble hits nothing, even against a low AC", () => {
    expect(v.hitsAmong({ targets, roll: roll(99, { isFumble: true }) })).toEqual([]);
  });

  it("LEAVES a null-AC target to the humans rather than counting it a hit", () => {
    // The system's own tray classes these as hits because `total < null` is false. We do not:
    // the outcome is not determined by data we trust (DESIGN.md R1).
    const cover = [{ uuid: "c", ac: null }, { uuid: "d" }];
    expect(v.hitsAmong({ targets: cover, roll: roll(99) })).toEqual([]);
    expect(v.hitsAmong({ targets: cover, roll: roll(99, { isCritical: true }) })).toEqual([]);
  });

  it("a hold verdict turns a HIT into a miss — the stale-AC trap", () => {
    // After a Shield the snapshot AC is stale; auto-apply must not damage a target the
    // module already announced as missed.
    const held = [{ uuid: "a", verdict: "miss" }];
    expect(v.hitsAmong({ targets, held, roll: roll(17) })).toEqual([]);
  });

  it("a precision verdict turns a MISS into a hit — the same channel, reversed", () => {
    const precision = [{ uuid: "b", verdict: "hit" }];
    expect(uuids(v.hitsAmong({ targets, precision, roll: roll(17) }))).toEqual(["a", "b"]);
  });

  it("a verdict beats a fumble and a null AC alike — it is the authority, not a modifier", () => {
    const precision = [{ uuid: "e", verdict: "hit" }];
    expect(
      uuids(
        v.hitsAmong({
          targets: [{ uuid: "e", ac: null }],
          precision,
          roll: roll(1, { isFumble: true })
        })
      )
    ).toEqual(["e"]);
  });

  it("HOLD wins when both channels name the same target", () => {
    const held = [{ uuid: "a", verdict: "miss" }];
    const precision = [{ uuid: "a", verdict: "hit" }];
    expect(v.hitsAmong({ targets, held, precision, roll: roll(17) })).toEqual([]);
  });

  it("survives an empty or missing target list", () => {
    expect(v.hitsAmong({ targets: [], roll: roll(10) })).toEqual([]);
    expect(v.hitsAmong({ targets: undefined, roll: roll(10) })).toEqual([]);
  });
});

describe("modeAdmits — the npc/pc/all gate", () => {
  it("off admits nobody", () => {
    expect(v.modeAdmits("off", true)).toBe(false);
    expect(v.modeAdmits("off", false)).toBe(false);
  });

  it("all admits both sides", () => {
    expect(v.modeAdmits("all", true)).toBe(true);
    expect(v.modeAdmits("all", false)).toBe(true);
  });

  it("npc admits only NPCs, pc only PCs", () => {
    expect(v.modeAdmits("npc", false)).toBe(true);
    expect(v.modeAdmits("npc", true)).toBe(false);
    expect(v.modeAdmits("pc", true)).toBe(true);
    expect(v.modeAdmits("pc", false)).toBe(false);
  });
});

describe("saveOutcome", () => {
  it("saves on a tie — total >= dc", () => {
    expect(v.saveOutcome(15, 15)).toBe("saved");
    expect(v.saveOutcome(14, 15)).toBe("failed");
  });

  it("legendary resistance saves whatever the number", () => {
    expect(v.saveOutcome(1, 30, true)).toBe("saved");
  });
});

describe("saveMultiplier — null means no application AND no receipt", () => {
  const entry = (outcome, choice) => ({ outcome, choice });

  it("a failure takes it all", () => {
    expect(v.saveMultiplier(entry("failed"), "half")).toBe(1);
  });

  it("a save takes half, all, or nothing as the effect dictates", () => {
    expect(v.saveMultiplier(entry("saved"), "half")).toBe(0.5);
    expect(v.saveMultiplier(entry("saved"), "full")).toBe(1);
    expect(v.saveMultiplier(entry("saved"), "none")).toBe(null);
  });

  it("an ACCEPTED interpose turns the saved half into nothing at all", () => {
    // finding ⑥, recut by walk-5 (y): the settle card is the record, not a zero receipt.
    const e = entry("saved", { kind: "interpose", answer: "use" });
    expect(v.saveMultiplier(e, "half")).toBe(null);
  });

  it("a DECLINED interpose still takes the half", () => {
    const e = entry("saved", { kind: "interpose", answer: "pass" });
    expect(v.saveMultiplier(e, "half")).toBe(0.5);
  });

  it("an interpose on a FAILED save cannot exist, and is not honoured if it does", () => {
    // Only a saved entry ever carries the choice — there is no failed-with-spend case.
    const e = entry("failed", { kind: "interpose", answer: "use" });
    expect(v.saveMultiplier(e, "half")).toBe(1);
  });

  it("an unresolved or gone entry applies nothing", () => {
    expect(v.saveMultiplier(entry(null), "half")).toBe(null);
    expect(v.saveMultiplier(entry("gone"), "half")).toBe(null);
  });
});

describe("verdictText — the one line the row and the card both read", () => {
  const flag = { dc: 15, hasDamage: true, damageOnSave: "half" };

  it("says nothing for an unresolved target", () => {
    expect(v.verdictText(flag, { done: false })).toBe(null);
  });

  it("states the total, the DC and the stakes", () => {
    expect(v.verdictText(flag, { done: true, outcome: "saved", total: 18 })).toBe(
      "18 vs DC 15 — saved — half damage"
    );
    expect(v.verdictText(flag, { done: true, outcome: "failed", total: 9 })).toBe(
      "9 vs DC 15 — failed"
    );
  });

  it("reads the stakes off the effect — none and full-anyway both say so", () => {
    expect(
      v.verdictText({ ...flag, damageOnSave: "none" }, { done: true, outcome: "saved", total: 18 })
    ).toBe("18 vs DC 15 — saved — no damage");
    expect(
      v.verdictText({ ...flag, damageOnSave: "full" }, { done: true, outcome: "saved", total: 18 })
    ).toBe("18 vs DC 15 — saved — full damage anyway");
  });

  it("says nothing about damage when the effect deals none", () => {
    expect(
      v.verdictText({ dc: 15, hasDamage: false }, { done: true, outcome: "saved", total: 18 })
    ).toBe("18 vs DC 15 — saved");
  });

  it("marks a forced save and a timed-out one", () => {
    expect(v.verdictText(flag, { done: true, outcome: "saved", total: 1, forced: true })).toContain(
      "(legendary resistance)"
    );
    expect(
      v.verdictText(flag, { done: true, outcome: "failed", total: 4, timedOut: true })
    ).toContain("(timer)");
  });

  it("gives a vanished target its own line rather than a verdict", () => {
    expect(v.verdictText(flag, { done: true, outcome: "gone" })).toBe(
      "the target is gone — nothing to roll"
    );
  });
});
