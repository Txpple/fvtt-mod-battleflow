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

describe("rangeSources — a ranged attack's own geometry, both glossary rules", () => {
  const rules = () => reg.RANGE_RULES;
  const at = (d, extra = {}) =>
    r.rangeSources({
      ranged: true,
      distanceFeet: d,
      normalFeet: 20,
      longFeet: 60,
      targetName: "Hobgoblin",
      rules: rules(),
      ...extra
    });
  it("within normal range is nothing; beyond normal is Disadvantage with the glossary sentence", () => {
    expect(at(20)).toEqual([]);
    expect(at(25)).toMatchObject([
      {
        kind: "range",
        bend: "disadvantage",
        label: "Hobgoblin is beyond normal range — 25 feet (20/60)",
        detail: reg.RANGE_RULES.long
      }
    ]);
    expect(at(60)[0].bend).toBe("disadvantage");
  });
  it("beyond long range cannot be made — listed, not counted", () => {
    const [s] = at(65);
    expect(s.bend).toBeNull();
    expect(s.label).toBe(
      "Hobgoblin is beyond long range — 65 feet, long range 60: this attack cannot be made"
    );
    expect(r.netMode([s])).toBe("normal");
  });
  it("a single range (a spell) has no Disadvantage band — beyond it cannot be made", () => {
    expect(at(25, { normalFeet: 30, longFeet: null })).toEqual([]);
    const [s] = at(35, { normalFeet: 30, longFeet: null });
    expect(s.bend).toBeNull();
    expect(s.label).toBe(
      "Hobgoblin is beyond range — 35 feet, range 30: this attack cannot be made"
    );
    expect(s.detail).toBe(reg.RANGE_RULES.single);
  });
  it("an enemy within 5 feet is Disadvantage, carrying the caveat the module cannot judge", () => {
    const [s] = r.rangeSources({
      ranged: true,
      closeEnemies: ["Goblin", "Wolf"],
      attackerName: "Gruk",
      rules: rules()
    });
    expect(s).toMatchObject({ kind: "range", bend: "disadvantage", detail: reg.RANGE_RULES.close });
    expect(s.label).toBe(
      "Gruk — a ranged attack within 5 feet of Goblin, Wolf (counted — press Normal if none of them can see you)"
    );
  });
  it("a melee attack yields nothing, whatever the distance; an unmeasured ranged attack yields nothing on the range side", () => {
    expect(
      r.rangeSources({
        ranged: false,
        distanceFeet: 100,
        normalFeet: 20,
        longFeet: 60,
        closeEnemies: ["Goblin"],
        rules: rules()
      })
    ).toEqual([]);
    expect(at(null)).toEqual([]);
    expect(at(Number.NaN)).toEqual([]);
    expect(r.rangeSources({ ranged: true, distanceFeet: 30, rules: rules() })).toEqual([]);
  });
  it("close combat and long range together are two sources of Disadvantage — still one", () => {
    const sources = at(30, { closeEnemies: ["Goblin"], attackerName: "Gruk" });
    expect(sources.map(s => s.bend)).toEqual(["disadvantage", "disadvantage"]);
    expect(r.netMode(sources)).toBe("disadvantage");
  });
  it("the glossary sentences are the registry's, verbatim, and no rules means no boxes", () => {
    expect(reg.RANGE_RULES.long).toMatch(
      /^Your attack roll has Disadvantage when your target is beyond normal range/
    );
    expect(reg.RANGE_RULES.close).toMatch(/within 5 feet of an enemy who can see you/);
    expect(
      r.rangeSources({ ranged: true, distanceFeet: 99, normalFeet: 20, longFeet: 60 })
    ).toEqual([]);
  });
});

describe("reminderView — the boxes the native dialog's section draws", () => {
  const GLOSS = "A roll can’t be affected by more than one Advantage.";
  it("one box per source: the fact, the bend as a badge, the rule; the net line; the glossary only when sources contend", () => {
    const sources = [
      r.reminderSource("sap", "disadvantage", "Gruk — Sapped by Thomas", "sap rule"),
      r.reminderSource("vex", "advantage", "Gruk Vexed Thomas", "vex rule")
    ];
    expect(r.reminderView(sources, "normal", GLOSS)).toEqual({
      boxes: [
        {
          label: "Gruk — Sapped by Thomas",
          bend: "disadvantage",
          badge: "Disadvantage",
          rule: "sap rule"
        },
        { label: "Gruk Vexed Thomas", bend: "advantage", badge: "Advantage", rule: "vex rule" }
      ],
      net: {
        title: "Net: Normal roll",
        why: "Advantage (1) and Disadvantage (1) cancel — a normal roll, however many of each.",
        glossary: GLOSS
      }
    });
  });
  it("a single source carries no glossary sentence, and a row the module cannot judge is badged Listed", () => {
    const view = r.reminderView([unk()], "normal", GLOSS);
    expect(view.boxes).toEqual([
      { label: "prone, distance unknown", bend: null, badge: "Listed", rule: "" }
    ]);
    expect(view.net).toEqual({
      title: "Net: Normal roll",
      why: "Nothing counted. One source could not be judged from here — see below.",
      glossary: null
    });
    expect(r.reminderView([dis()], "disadvantage", GLOSS).net.title).toBe("Net: Disadvantage");
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
