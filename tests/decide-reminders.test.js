import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer reminder arithmetic (ARCHITECTURE.md §2). No Foundry stub on purpose.
 *
 * ⚠ The net rule is a USER RULING (2026-09-01), quoted in the module's own words below; the
 * three examples in the first block are the user's own. A change here changes what the popup
 * tells the table the roll nets to.
 */
/** @type {typeof import("../scripts/decide/reminders.js")} */
let r;
beforeAll(async () => {
  r = await import("../scripts/decide/reminders.js");
});

const adv = label => r.reminderSource("vex", "advantage", label ?? "adv");
const dis = label => r.reminderSource("sap", "disadvantage", label ?? "dis");
const unk = () => r.reminderSource("prone", null, "prone, distance unknown");

describe("netMode — the user's three examples, and the rest of the table", () => {
  it("adv/adv == adv", () => {
    expect(r.netMode([adv(), adv()])).toBe("advantage");
  });
  it("adv/disadv == regular", () => {
    expect(r.netMode([adv(), dis()])).toBe("normal");
  });
  it("adv/disadv/disadv == regular — never a majority vote", () => {
    expect(r.netMode([adv(), dis(), dis()])).toBe("normal");
    expect(r.netMode([adv(), adv(), adv(), dis()])).toBe("normal");
  });
  it("one side alone is that side; nothing is normal", () => {
    expect(r.netMode([adv()])).toBe("advantage");
    expect(r.netMode([dis(), dis()])).toBe("disadvantage");
    expect(r.netMode([])).toBe("normal");
  });
  it("an unjudged source is listed, not counted", () => {
    expect(r.netMode([unk()])).toBe("normal");
    expect(r.netMode([adv(), unk()])).toBe("advantage");
    expect(r.netMode([dis(), unk()])).toBe("disadvantage");
  });
});

describe("resolutionLine — says why", () => {
  it("cancelling names both counts and the rule", () => {
    expect(r.resolutionLine([adv(), dis(), dis()], "normal")).toBe(
      "Advantage (1) and Disadvantage (2) cancel — a normal roll, however many of each."
    );
  });
  it("several of one side is still one", () => {
    expect(r.resolutionLine([adv(), adv()], "advantage")).toBe(
      "2 sources of Advantage — still one Advantage."
    );
    expect(r.resolutionLine([dis()], "disadvantage")).toBe("One source of Disadvantage.");
  });
  it("an unjudged source is flagged for the table", () => {
    expect(r.resolutionLine([adv(), unk()], "advantage")).toBe(
      "One source of Advantage. One source could not be judged from here — see below."
    );
    expect(r.resolutionLine([unk()], "normal")).toBe(
      "Nothing counted. One source could not be judged from here — see below."
    );
  });
  it("modeLabel speaks the table's words", () => {
    expect(r.modeLabel("advantage")).toBe("Advantage");
    expect(r.modeLabel("disadvantage")).toBe("Disadvantage");
    expect(r.modeLabel("normal")).toBe("a normal roll");
  });
});

describe("proneSources — both roles, from plain facts", () => {
  it("a prone attacker is Disadvantage", () => {
    const [s] = r.proneSources({ attackerProne: true, attackerName: "Gruk" });
    expect(s).toMatchObject({ kind: "prone", bend: "disadvantage", label: "Gruk — Prone" });
  });
  it("a prone target within 5 feet is Advantage; beyond is Disadvantage", () => {
    expect(
      r.proneSources({ targetProne: true, distanceFeet: 5, targetName: "Hobgoblin" })[0]
    ).toMatchObject({ bend: "advantage", label: "Hobgoblin is Prone — within 5 feet" });
    expect(
      r.proneSources({ targetProne: true, distanceFeet: 30, targetName: "Hobgoblin" })[0]
    ).toMatchObject({ bend: "disadvantage", label: "Hobgoblin is Prone — 30 feet away" });
  });
  it("a prone target at an unknown distance is listed, not counted", () => {
    const [s] = r.proneSources({ targetProne: true, distanceFeet: null, targetName: "Hobgoblin" });
    expect(s.bend).toBeNull();
    expect(s.label).toBe("Hobgoblin is Prone — distance unknown");
    expect(r.proneSources({ targetProne: true, distanceFeet: Number.NaN })[0].bend).toBeNull();
  });
  it("both roles at once are two sources — and they cancel", () => {
    const sources = r.proneSources({ attackerProne: true, targetProne: true, distanceFeet: 5 });
    expect(sources).toHaveLength(2);
    expect(r.netMode(sources)).toBe("normal");
  });
  it("nothing prone is nothing", () => {
    expect(r.proneSources({})).toEqual([]);
    expect(r.proneSources()).toEqual([]);
  });
});

describe("CONDITION_BENDS / conditionSources — the thirteen, as data", () => {
  it("names exactly the statuses the registry's Condition Sources list admits", async () => {
    const { CONDITION_STATUSES, REMINDER_KINDS } = await import("../scripts/decide/registry.js");
    expect(new Set(r.CONDITION_KEYS)).toEqual(CONDITION_STATUSES);
    expect(REMINDER_KINDS.has("condition")).toBe(true);
    expect(REMINDER_KINDS.has("prone")).toBe(true);
  });
  it("is the thirteen, frozen, each with its glossary clause", () => {
    expect(r.CONDITION_KEYS).toEqual([
      "blinded",
      "invisible",
      "paralyzed",
      "petrified",
      "poisoned",
      "restrained",
      "stunned",
      "unconscious",
      "frightened",
      "grappled",
      "incapacitated",
      "dodging",
      "charmed"
    ]);
    expect(Object.isFrozen(r.CONDITION_BENDS)).toBe(true);
    for (const key of r.CONDITION_KEYS)
      expect(r.CONDITION_BENDS[key].rule.length).toBeGreaterThan(20);
  });
  it("a poisoned attacker is Disadvantage; a blinded target is Advantage", () => {
    expect(
      r.conditionSources({ attackerStatuses: ["poisoned"], attackerName: "Gruk" })[0]
    ).toMatchObject({ kind: "condition", bend: "disadvantage", label: "Gruk — Poisoned" });
    expect(
      r.conditionSources({ targetStatuses: ["blinded"], targetName: "Hobgoblin" })[0]
    ).toMatchObject({ kind: "condition", bend: "advantage", label: "Hobgoblin is Blinded" });
  });
  it("both roles of one condition are two sources — restrained attacker vs restrained target cancel", () => {
    const sources = r.conditionSources({
      attackerStatuses: ["restrained"],
      targetStatuses: ["restrained"]
    });
    expect(sources.map(s => s.bend)).toEqual(["disadvantage", "advantage"]);
    expect(r.netMode(sources)).toBe("normal");
  });
  it("a side with no bend yields nothing; a note is listed, not counted", () => {
    expect(r.conditionSources({ targetStatuses: ["poisoned"] })).toEqual([]);
    const [s] = r.conditionSources({ attackerStatuses: ["incapacitated"], attackerName: "Gruk" });
    expect(s.bend).toBeNull();
    expect(s.label).toMatch(/^Gruk — Incapacitated: /);
    expect(r.conditionSources({ targetStatuses: ["incapacitated"] })).toEqual([]);
  });
  it("conditional rows say so in their label", () => {
    const [s] = r.conditionSources({ attackerStatuses: ["frightened"], attackerName: "Gruk" });
    expect(s.bend).toBe("disadvantage");
    expect(s.label).toContain("press Normal if the source of the fear is out of sight");
  });
  it("the enabled list is the switch, and unknown statuses are ignored", () => {
    expect(r.conditionSources({ attackerStatuses: ["poisoned"], enabled: ["blinded"] })).toEqual(
      []
    );
    expect(r.conditionSources({ attackerStatuses: ["bleeding", "surprised"] })).toEqual([]);
    expect(r.conditionSources({ attackerStatuses: ["poisoned"], enabled: [] })).toEqual([]);
  });
  it("accepts a Set of statuses, as the system hands them over", () => {
    expect(r.conditionSources({ targetStatuses: new Set(["stunned"]) })[0].bend).toBe("advantage");
  });
});

describe("reminderRecord — what the card remembers", () => {
  it("keeps the sources' facts, the net, the press, and whether they agreed", () => {
    const rec = r.reminderRecord({
      sources: [adv("You Vexed Hobgoblin"), dis("Gruk is Sapped")],
      net: "normal",
      mode: "normal",
      answeredAt: 1234
    });
    expect(rec).toEqual({
      sources: [
        { kind: "vex", bend: "advantage", label: "You Vexed Hobgoblin" },
        { kind: "sap", bend: "disadvantage", label: "Gruk is Sapped" }
      ],
      net: "normal",
      mode: "normal",
      honoured: true,
      answeredAt: 1234
    });
  });
  it("a press against the net is not honoured, and an unjudged bend is null", () => {
    const rec = r.reminderRecord({
      sources: [adv(), unk()],
      net: "advantage",
      mode: "normal",
      answeredAt: 1
    });
    expect(rec.honoured).toBe(false);
    expect(rec.sources[1].bend).toBeNull();
  });
});
