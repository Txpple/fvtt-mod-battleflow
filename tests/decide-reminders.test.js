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
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  r = await import("../scripts/decide/reminders.js");
  reg = await import("../scripts/decide/registry.js");
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
    expect(r.resolutionLine([adv(), dis(), dis()])).toBe(
      "Advantage (1) and Disadvantage (2) cancel — a normal roll, however many of each."
    );
  });
  it("several of one side is still one", () => {
    expect(r.resolutionLine([adv(), adv()])).toBe("2 sources of Advantage — still one Advantage.");
    expect(r.resolutionLine([dis()])).toBe("One source of Disadvantage.");
  });
  it("an unjudged source is flagged for the table", () => {
    expect(r.resolutionLine([adv(), unk()])).toBe(
      "One source of Advantage. One source could not be judged from here — see below."
    );
    expect(r.resolutionLine([unk()])).toBe(
      "Nothing counted. One source could not be judged from here — see below."
    );
  });
  it("nothing at all is said plainly", () => {
    expect(r.resolutionLine([])).toBe("Nothing bends this roll.");
  });
});

describe("modeTitle / rolledWith — two readings of one mode, one vocabulary each", () => {
  it("titles", () => {
    expect(r.modeTitle("advantage")).toBe("Advantage");
    expect(r.modeTitle("disadvantage")).toBe("Disadvantage");
    expect(r.modeTitle("normal")).toBe("Normal roll");
  });
  it("how a roll went out — the reminder line and the spend line share it", () => {
    expect(r.rolledWith("advantage")).toBe("with Advantage");
    expect(r.rolledWith("disadvantage")).toBe("with Disadvantage");
    expect(r.rolledWith("normal")).toBe("flat");
    expect(r.rolledWith(null)).toBe("flat");
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

describe("conditionSources — the registry's table, read one row at a time", () => {
  const all = () => ({ table: reg.CONDITION_BENDS, enabled: reg.CONDITION_KEYS });
  it("a poisoned attacker is Disadvantage; a blinded target is Advantage", () => {
    expect(
      r.conditionSources({ ...all(), attackerStatuses: ["poisoned"], attackerName: "Gruk" })[0]
    ).toMatchObject({ kind: "condition", bend: "disadvantage", label: "Gruk — Poisoned" });
    expect(
      r.conditionSources({ ...all(), targetStatuses: ["blinded"], targetName: "Hobgoblin" })[0]
    ).toMatchObject({ kind: "condition", bend: "advantage", label: "Hobgoblin is Blinded" });
  });
  it("both roles of one condition are two sources — restrained attacker vs restrained target cancel", () => {
    const sources = r.conditionSources({
      ...all(),
      attackerStatuses: ["restrained"],
      targetStatuses: ["restrained"]
    });
    expect(sources.map(s => s.bend)).toEqual(["disadvantage", "advantage"]);
    expect(r.netMode(sources)).toBe("normal");
  });
  it("a side with no bend yields nothing; a note is listed, not counted", () => {
    expect(r.conditionSources({ ...all(), targetStatuses: ["poisoned"] })).toEqual([]);
    const [s] = r.conditionSources({
      ...all(),
      attackerStatuses: ["incapacitated"],
      attackerName: "Gruk"
    });
    expect(s.bend).toBeNull();
    expect(s.label).toMatch(/^Gruk — Incapacitated: /);
    expect(r.conditionSources({ ...all(), targetStatuses: ["incapacitated"] })).toEqual([]);
  });
  it("conditional rows say so in their label", () => {
    const [s] = r.conditionSources({
      ...all(),
      attackerStatuses: ["frightened"],
      attackerName: "Gruk"
    });
    expect(s.bend).toBe("disadvantage");
    expect(s.label).toContain("press Normal if the source of the fear is out of sight");
  });
  it("the enabled list is the switch, and unknown statuses are ignored", () => {
    expect(
      r.conditionSources({
        table: reg.CONDITION_BENDS,
        enabled: ["blinded"],
        attackerStatuses: ["poisoned"]
      })
    ).toEqual([]);
    expect(r.conditionSources({ ...all(), attackerStatuses: ["bleeding", "surprised"] })).toEqual(
      []
    );
    expect(
      r.conditionSources({
        table: reg.CONDITION_BENDS,
        enabled: [],
        attackerStatuses: ["poisoned"]
      })
    ).toEqual([]);
  });
  it("⚠ nothing is required to be passed for nothing to be read — there is no default list and no default table", () => {
    expect(r.conditionSources({ attackerStatuses: ["poisoned"] })).toEqual([]);
    expect(
      r.conditionSources({ table: reg.CONDITION_BENDS, attackerStatuses: ["poisoned"] })
    ).toEqual([]);
    expect(r.conditionSources({ enabled: ["poisoned"], attackerStatuses: ["poisoned"] })).toEqual(
      []
    );
  });
  it("accepts a Set of statuses, as the system hands them over", () => {
    expect(r.conditionSources({ ...all(), targetStatuses: new Set(["stunned"]) })[0].bend).toBe(
      "advantage"
    );
  });
  it("reads rows in the table's order, whatever the list's", () => {
    const sources = r.conditionSources({
      table: reg.CONDITION_BENDS,
      enabled: ["poisoned", "blinded"],
      attackerStatuses: ["poisoned", "blinded"],
      attackerName: "Gruk"
    });
    expect(sources.map(s => s.label)).toEqual(["Gruk — Blinded", "Gruk — Poisoned"]);
  });
});

describe("rollChoices — the native dialog's own selects, carried by the gate", () => {
  const dialogOptions = {
    attackModeOptions: [
      { value: "oneHanded", label: "One-Handed" },
      { rule: true },
      { value: "twoHanded", label: "Two-Handed" },
      { value: "thrown", label: "Thrown" }
    ],
    ammunitionOptions: [
      { value: "", label: "" },
      { value: "arrow1", label: "Arrows (20)" }
    ],
    masteryOptions: [{ value: "vex", label: "Vex" }]
  };
  it("one choice per list with more than one real entry; separators dropped; the blank ammo named", () => {
    const choices = r.rollChoices(dialogOptions, { attackMode: "twoHanded", ammunition: "arrow1" });
    expect(choices.map(c => c.key)).toEqual(["attackMode", "ammunition"]);
    expect(choices[0]).toEqual({
      key: "attackMode",
      label: "Attack mode",
      value: "twoHanded",
      options: [
        { value: "oneHanded", label: "One-Handed" },
        { value: "twoHanded", label: "Two-Handed" },
        { value: "thrown", label: "Thrown" }
      ]
    });
    expect(choices[1]).toEqual({
      key: "ammunition",
      label: "Ammunition",
      value: "arrow1",
      options: [
        { value: "", label: "None" },
        { value: "arrow1", label: "Arrows (20)" }
      ]
    });
  });
  it("a config value the list does not carry falls to the first entry, as dnd5e does", () => {
    const [mode] = r.rollChoices(dialogOptions, { attackMode: "offhand" });
    expect(mode.value).toBe("oneHanded");
    const [, ammo] = r.rollChoices(dialogOptions, {});
    expect(ammo.value).toBe("");
  });
  it("a mastery list with more than one entry is a choice too", () => {
    const choices = r.rollChoices(
      {
        masteryOptions: [
          { value: "vex", label: "Vex" },
          { value: "sap", label: "Sap" }
        ]
      },
      { mastery: "sap" }
    );
    expect(choices).toEqual([
      {
        key: "mastery",
        label: "Mastery",
        value: "sap",
        options: [
          { value: "vex", label: "Vex" },
          { value: "sap", label: "Sap" }
        ]
      }
    ]);
  });
  it("nothing to choose is nothing", () => {
    expect(r.rollChoices({}, {})).toEqual([]);
    expect(r.rollChoices()).toEqual([]);
    expect(
      r.rollChoices({ attackModeOptions: [{ value: "oneHanded", label: "One-Handed" }] })
    ).toEqual([]);
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
