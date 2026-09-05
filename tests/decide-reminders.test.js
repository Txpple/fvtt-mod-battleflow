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
    expect(
      r.proneSources({
        targetProne: true,
        distanceFeet: 30,
        targetName: "Morgash",
        targetProneBy: "Cunning Strike: Tripped"
      })[0].label
    ).toBe("Morgash is Prone (Cunning Strike: Tripped) — 30 feet away");
    expect(
      r.proneSources({
        targetProne: true,
        distanceFeet: 5,
        targetName: "Morgash",
        targetProneBy: "Prone"
      })[0].label
    ).toBe("Morgash is Prone — within 5 feet");
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
    expect(s.label).toBe("Gruk — Frightened"); // the counted caveat stays off the label (user, 2026-09-02)
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
    expect(s.label).toBe("Ranged attack within 5 feet of Goblin, Wolf");
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

describe("reminderView — the header line and the boxes the section draws", () => {
  const GLOSS = "A roll can’t be affected by more than one Advantage.";
  it("one box per source: the fact, the bend as a badge, the rule; the net line; the glossary only when sources contend", () => {
    const sources = [
      r.reminderSource("sap", "disadvantage", "Gruk — Sapped by Thomas", "sap rule"),
      r.reminderSource("vex", "advantage", "Gruk Vexed Thomas", "vex rule")
    ];
    expect(r.reminderView(sources, "normal")).toEqual({
      head: {
        title: "2 Modifiers — Net",
        net: "normal",
        why: "Advantage (1) and Disadvantage (1) cancel — a normal roll, however many of each."
      },
      boxes: [
        { label: "Gruk — Sapped by Thomas", bend: "disadvantage", rule: "sap rule" },
        { label: "Gruk Vexed Thomas", bend: "advantage", rule: "vex rule" }
      ]
    });
  });
  it("one source is one Modifier, a row the module cannot judge keeps a null bend, and there is NO net block (user, 2026-09-02)", () => {
    const view = r.reminderView([unk()], "normal");
    expect(view.head).toEqual({
      title: "1 Modifier — Net",
      net: "normal",
      why: "Nothing counted. One source could not be judged from here — see below."
    });
    expect(view.boxes).toEqual([{ label: "prone, distance unknown", bend: null, rule: "" }]);
    expect(view).not.toHaveProperty("net");
    expect(r.reminderView([dis()], "disadvantage").head.net).toBe("disadvantage");
    expect(r.reminderView([adv(), adv()], "advantage").head.title).toBe("2 Modifiers — Net");
  });
});

describe("effectSources — the sixth kind: an ability on either sheet, by name (user, 2026-09-02)", () => {
  const T = () => reg.EFFECT_BENDS;
  const all = () => reg.EFFECT_KEYS;
  it("Innate Sorcery is spell attacks only — fires on a spell, not on a dagger; case-insensitive on both sides", () => {
    const me = { effects: [{ id: "e1", name: "innate sorcery" }] };
    const spell = r.effectSources({
      attacker: me,
      enabled: ["INNATE SORCERY"],
      table: T(),
      scope: { classification: "spell", type: "ranged" },
      attackerName: "Ilyra"
    });
    expect(spell).toHaveLength(1);
    expect(spell[0]).toMatchObject({
      kind: "effect",
      bend: "advantage",
      label: "Ilyra — Innate Sorcery",
      effectId: "e1"
    });
    expect(spell[0].detail).toContain("Sorcerer spells");
    expect(
      r.effectSources({
        attacker: me,
        enabled: all(),
        table: T(),
        scope: { classification: "weapon", type: "melee" }
      })
    ).toEqual([]);
    expect(
      r.effectSources({ attacker: me, enabled: [], table: T(), scope: { classification: "spell" } })
    ).toEqual([]);
  });
  it("Reckless bends both sides: the bearer's own weapon attacks, and attacks against the bearer", () => {
    const reckless = { effects: [{ id: "e2", name: "Reckless" }] };
    const mine = r.effectSources({
      attacker: reckless,
      enabled: all(),
      table: T(),
      scope: { classification: "weapon", type: "melee" },
      attackerName: "Brann"
    });
    expect(mine.map(s => [s.bend, s.label])).toEqual([["advantage", "Brann — Reckless"]]);
    const theirs = r.effectSources({
      target: reckless,
      enabled: all(),
      table: T(),
      scope: { classification: "weapon", type: "melee" },
      targetName: "Brann"
    });
    expect(theirs.map(s => [s.bend, s.label])).toEqual([["advantage", "Brann is — Reckless"]]);
  });
  it("a row with counted:false is LISTED — bend null, the caveat on the label", () => {
    const out = r.effectSources({
      attacker: { effects: [{ id: "e3", name: "Demon Armor" }] },
      enabled: all(),
      table: T(),
      scope: {},
      attackerName: "Gren"
    });
    expect(out).toHaveLength(1);
    expect(out[0].bend).toBeNull();
    expect(out[0].label).toBe("Gren — Demon Armor (listed — Disadvantage only against demons)");
  });
  it("a feature row matches an Item's name, never an effect; a counted caveat stays OFF the label", () => {
    const out = r.effectSources({
      attacker: { features: ["Pack Tactics"] },
      enabled: all(),
      table: T(),
      scope: {},
      attackerName: "Wolf"
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      bend: "advantage",
      label: "Wolf — Pack Tactics"
    });
    expect(out[0]).not.toHaveProperty("effectId");
    expect(
      r.effectSources({
        attacker: { effects: [{ id: "x", name: "Pack Tactics" }] },
        enabled: all(),
        table: T(),
        scope: {}
      })
    ).toEqual([]);
  });
  it("a judged row fires only when the fact is true — Bloodied Fury on the bearer's HP, Blood Frenzy on the target's", () => {
    const fury = { features: ["Bloodied Fury"] };
    expect(
      r.effectSources({
        attacker: { ...fury, bloodied: false },
        enabled: all(),
        table: T(),
        scope: {}
      })
    ).toEqual([]);
    expect(
      r.effectSources({
        attacker: { ...fury, bloodied: true },
        enabled: all(),
        table: T(),
        scope: {}
      })
    ).toHaveLength(1);
    const frenzy = { features: ["Blood Frenzy"] };
    expect(
      r.effectSources({
        attacker: frenzy,
        target: { damaged: false },
        enabled: all(),
        table: T(),
        scope: {}
      })
    ).toEqual([]);
    expect(
      r.effectSources({
        attacker: frenzy,
        target: { damaged: true },
        enabled: all(),
        table: T(),
        scope: {}
      })
    ).toHaveLength(1);
  });
  it("the passes: attacker-side rows judged on the TARGET belong to the target pass, the rest to the attacker's; target rows never in the attacker pass", () => {
    const me = { effects: [{ id: "a", name: "Innate Sorcery" }], features: ["Blood Frenzy"] };
    const them = { effects: [{ id: "b", name: "Blurred" }], damaged: true };
    const scope = { classification: "spell", type: "ranged" };
    expect(
      r
        .effectSources({
          attacker: me,
          target: them,
          enabled: all(),
          table: T(),
          scope,
          pass: "attacker"
        })
        .map(s => s.label)
    ).toEqual(["You — Innate Sorcery"]);
    expect(
      r
        .effectSources({
          attacker: me,
          target: them,
          enabled: all(),
          table: T(),
          scope,
          pass: "target"
        })
        .map(s => s.label)
        .sort()
    ).toEqual(["You — Blood Frenzy", "the target is — Blurred"]);
  });
  it("a spend row carries the effect's id and the spend, so the roll can use it up", () => {
    const out = r.effectSources({
      target: { effects: [{ id: "gb", name: "Guiding Bolt" }] },
      enabled: all(),
      table: T(),
      scope: {},
      targetName: "Hobgoblin"
    });
    expect(out[0]).toMatchObject({ bend: "advantage", spend: "attack", effectId: "gb" });
  });
  it("the table is data with one shape: every row names a side, a scope, a rule and where it is from; feature rows never share a name with an effect", () => {
    for (const [key, row] of Object.entries(T())) {
      // A row bends an attack side, or a check, or a save (the `saves` facet, 2026-09-05).
      expect(row.attacker || row.target || row.checks || row.saves, key).toBeTruthy();
      expect(["any", "spell", "weapon", "melee", "ranged"], key).toContain(row.scope);
      expect(row.rule.length, key).toBeGreaterThan(20);
      expect(row.from, key).toBeTruthy();
      if (row.counted === false) expect(row.caveat, key).toMatch(/^listed — /);
      if (row.caveat && row.counted !== false) expect(row.caveat, key).toMatch(/^counted — /);
    }
    expect(reg.EFFECT_NAMES.size).toBe(reg.EFFECT_KEYS.length);
    expect(reg.EFFECT_NAMES.has("innate sorcery")).toBe(true);
  });
});

describe("autoCritSources — the 5-foot Critical Hit on Paralyzed and Unconscious (user, 2026-09-02)", () => {
  it("a hit within 5 feet of a Paralyzed target is a Critical Hit, with the glossary clause", () => {
    const out = r.autoCritSources({
      targetStatuses: ["paralyzed"],
      distanceFeet: 5,
      targetName: "Hobgoblin",
      table: reg.CONDITION_BENDS
    });
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("paralyzed");
    expect(out[0].label).toBe("Hobgoblin is Paralyzed — within 5 feet, a hit is a Critical Hit");
    expect(out[0].rule).toContain("Critical Hit if the attacker is within 5 feet");
  });
  it("Unconscious too, both when both; nothing from 10 feet, nothing at an unknown distance, nothing for Stunned", () => {
    expect(
      r.autoCritSources({
        targetStatuses: ["unconscious"],
        distanceFeet: 4.9,
        table: reg.CONDITION_BENDS
      })
    ).toHaveLength(1);
    expect(
      r.autoCritSources({
        targetStatuses: ["paralyzed", "unconscious"],
        distanceFeet: 0,
        table: reg.CONDITION_BENDS
      })
    ).toHaveLength(2);
    expect(
      r.autoCritSources({
        targetStatuses: ["paralyzed"],
        distanceFeet: 10,
        table: reg.CONDITION_BENDS
      })
    ).toEqual([]);
    expect(
      r.autoCritSources({
        targetStatuses: ["paralyzed"],
        distanceFeet: null,
        table: reg.CONDITION_BENDS
      })
    ).toEqual([]);
    expect(
      r.autoCritSources({
        targetStatuses: ["stunned", "prone"],
        distanceFeet: 5,
        table: reg.CONDITION_BENDS
      })
    ).toEqual([]);
  });
  it("is data on the table: exactly Paralyzed and Unconscious carry critWithinFeet, and it is 5", () => {
    const rows = Object.entries(reg.CONDITION_BENDS)
      .filter(([, row]) => row.critWithinFeet)
      .map(([k, row]) => [k, row.critWithinFeet]);
    expect(rows).toEqual([
      ["paralyzed", 5],
      ["unconscious", 5]
    ]);
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

describe("saveSources + saveGate — the save gate's table (option E, 2026-09-02)", () => {
  const all = () => Object.keys(reg.SAVE_BENDS);
  it("Restrained is Disadvantage on Dexterity saves, and nothing on the others", () => {
    const dex = r.saveSources({
      statuses: ["restrained"],
      ability: "dex",
      enabled: all(),
      table: reg.SAVE_BENDS,
      name: "Gob"
    });
    expect(dex).toHaveLength(1);
    expect(dex[0].bend).toBe("disadvantage");
    expect(dex[0].status).toBe("restrained");
    expect(dex[0].label).toBe("Gob — Restrained");
    expect(
      r.saveSources({
        statuses: ["restrained"],
        ability: "con",
        enabled: all(),
        table: reg.SAVE_BENDS
      })
    ).toHaveLength(0);
  });
  it("Dodging is Advantage on Dexterity saves, counted, the caveat left to the rule", () => {
    const [s] = r.saveSources({
      statuses: ["dodging"],
      ability: "dex",
      enabled: all(),
      table: reg.SAVE_BENDS
    });
    expect(s.bend).toBe("advantage");
    expect(s.label).not.toMatch(/press Normal/);
  });
  it("Paralyzed, Stunned, Unconscious and Petrified cannot succeed on Strength or Dexterity — listed, not counted, marked", () => {
    for (const status of ["paralyzed", "stunned", "unconscious", "petrified"]) {
      for (const ability of ["str", "dex"]) {
        const [s] = r.saveSources({
          statuses: [status],
          ability,
          enabled: all(),
          table: reg.SAVE_BENDS
        });
        expect(s.bend, `${status}/${ability}`).toBeNull();
        expect(s.autoFail).toBe(true);
        expect(s.label).toMatch(/cannot succeed/);
      }
      expect(
        r.saveSources({ statuses: [status], ability: "con", enabled: all(), table: reg.SAVE_BENDS })
      ).toHaveLength(0);
    }
  });
  it("the Condition Sources list is the switch — a row off the list is not read", () => {
    expect(
      r.saveSources({
        statuses: ["paralyzed"],
        ability: "dex",
        enabled: ["restrained"],
        table: reg.SAVE_BENDS
      })
    ).toHaveLength(0);
  });
  it("the gate nets as the attack gate nets, and 'fails' outranks every bend", () => {
    const dodge = r.saveSources({
      statuses: ["dodging", "restrained"],
      ability: "dex",
      enabled: all(),
      table: reg.SAVE_BENDS
    });
    expect(r.saveGate(dodge).net).toBe("normal");
    const para = r.saveSources({
      statuses: ["paralyzed", "dodging"],
      ability: "dex",
      enabled: all(),
      table: reg.SAVE_BENDS
    });
    const gate = r.saveGate(para);
    expect(gate.autoFail).toBe(true);
    expect(gate.net).toBe("fails");
    expect(gate.view.head.net).toBe("fails");
    expect(gate.view.head.why).toMatch(/cannot succeed/);
    expect(r.saveGate([]).net).toBe("normal");
  });
  it("modeTitle names the fourth answer", () => {
    expect(r.modeTitle("fails")).toBe("Fails");
  });
});

describe('effectSources — `only: "source"` (Feinting Attack, 2026-09-05): the bend is the source\'s alone', () => {
  const facts = () => ({
    enabled: ["Feinting Attack"],
    table: reg.EFFECT_BENDS,
    attackerName: "Morgash",
    targetName: "the goblin"
  });
  it("the feinting fighter attacking the marked target gets Advantage; anyone else attacking it gets nothing", () => {
    const marked = {
      uuid: "Actor.gob",
      effects: [{ id: "f1", name: "Feinting Attack", sourceUuid: "Actor.morgash" }]
    };
    const mine = r.effectSources({
      ...facts(),
      attacker: { uuid: "Actor.morgash" },
      target: marked,
      pass: "target"
    });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ bend: "advantage", effectId: "f1", spend: "attack" });
    expect(mine[0].label).toMatch(/the goblin is — Feinting Attack/);
    const theirs = r.effectSources({
      ...facts(),
      attacker: { uuid: "Actor.ranger" },
      target: marked,
      pass: "target"
    });
    expect(theirs).toHaveLength(0);
    // A marker with no recorded source is nobody's — never a guessed Advantage.
    const unsourced = { uuid: "Actor.gob", effects: [{ id: "f2", name: "Feinting Attack" }] };
    expect(
      r.effectSources({
        ...facts(),
        attacker: { uuid: "Actor.morgash" },
        target: unsourced,
        pass: "target"
      })
    ).toHaveLength(0);
  });
  it("a row that admits only its source hinges on the target: the attacker pass leaves it alone", () => {
    const marked = {
      uuid: "Actor.gob",
      effects: [{ id: "f1", name: "Feinting Attack", sourceUuid: "Actor.morgash" }]
    };
    expect(
      r.effectSources({
        ...facts(),
        attacker: { uuid: "Actor.morgash" },
        target: marked,
        pass: "attacker"
      })
    ).toHaveLength(0);
  });
});

describe("effectCheckSources — an effect that bends ability checks by its text (Heat Metal, 2026-09-04)", () => {
  it("Heated Metal on the roller's sheet is Disadvantage on a check; off the list, or absent, nothing", () => {
    const facts = { table: reg.EFFECT_BENDS, name: "Jetten" };
    const on = r.effectCheckSources({
      ...facts,
      effects: [{ id: "h1", name: "heated metal" }],
      enabled: ["Heated Metal"]
    });
    expect(on).toHaveLength(1);
    expect(on[0]).toMatchObject({
      kind: "effect",
      bend: "disadvantage",
      label: "Jetten — Heated Metal",
      effectId: "h1"
    });
    expect(on[0].detail).toMatch(/ability checks/);
    expect(
      r.effectCheckSources({ ...facts, effects: [{ id: "h1", name: "Heated Metal" }], enabled: [] })
    ).toHaveLength(0);
    expect(
      r.effectCheckSources({
        ...facts,
        effects: [{ id: "g1", name: "Goaded" }],
        enabled: reg.EFFECT_KEYS
      })
    ).toHaveLength(0);
  });
  it("only rows with a `checks` facet bend a check — an attack-only row (Innate Sorcery) does not", () => {
    const out = r.effectCheckSources({
      table: reg.EFFECT_BENDS,
      effects: [{ id: "e", name: "Innate Sorcery" }],
      enabled: reg.EFFECT_KEYS
    });
    expect(out).toHaveLength(0);
    const facets = Object.entries(reg.EFFECT_BENDS)
      .filter(([, row]) => row.checks)
      .map(([k]) => k);
    expect(facets).toEqual(["Heated Metal", "Averse"]);
  });
});

describe("effectSources — the combat clock as a judge (Assassinate, 2026-09-02)", () => {
  it("fires on the target pass when the target has not acted in round one, and never otherwise", () => {
    const facts = {
      enabled: ["Assassinate"],
      table: reg.EFFECT_BENDS,
      attacker: { features: ["Assassinate"] },
      attackerName: "Vessa",
      targetName: "the captain"
    };
    const fired = r.effectSources({ ...facts, target: { notActed: true }, pass: "target" });
    expect(fired).toHaveLength(1);
    expect(fired[0].bend).toBe("advantage");
    expect(fired[0].label).toMatch(/Assassinate/);
    expect(r.effectSources({ ...facts, target: { notActed: false }, pass: "target" })).toHaveLength(
      0
    );
    // The row hinges on the TARGET, so the attacker pass leaves it alone — no double count.
    expect(
      r.effectSources({ ...facts, target: { notActed: true }, pass: "attacker" })
    ).toHaveLength(0);
  });
});

describe("checkSources + checkGate — the check gate's table (user go 2026-09-03)", () => {
  const all = () => Object.keys(reg.CHECK_BENDS);
  it("Poisoned is Disadvantage on a check, the label the fact alone, the rule quoted", () => {
    const out = r.checkSources({
      statuses: ["poisoned"],
      enabled: all(),
      table: reg.CHECK_BENDS,
      name: "Gob"
    });
    expect(out).toHaveLength(1);
    expect(out[0].bend).toBe("disadvantage");
    expect(out[0].status).toBe("poisoned");
    expect(out[0].label).toBe("Gob — Poisoned");
    expect(out[0].detail).toMatch(/ability checks/);
    expect(out[0].label).not.toMatch(/press Normal/);
  });
  it("Frightened is Disadvantage too; the line-of-sight caveat lives in the quoted rule, not the label", () => {
    const [s] = r.checkSources({
      statuses: ["frightened"],
      enabled: all(),
      table: reg.CHECK_BENDS
    });
    expect(s.bend).toBe("disadvantage");
    expect(s.label).toBe("You — Frightened");
    expect(s.detail).toMatch(/line of sight/);
  });
  it("a status with no check clause is not a source — Restrained and Prone bend no check", () => {
    expect(
      r.checkSources({
        statuses: ["restrained", "prone", "blinded"],
        enabled: all(),
        table: reg.CHECK_BENDS
      })
    ).toHaveLength(0);
  });
  it("the Condition Sources list is the switch — a row off the list is not read", () => {
    expect(
      r.checkSources({ statuses: ["poisoned"], enabled: ["frightened"], table: reg.CHECK_BENDS })
    ).toHaveLength(0);
  });
  it("the gate nets as the attack gate nets, and never 'fails'", () => {
    const both = r.checkSources({
      statuses: ["poisoned", "frightened"],
      enabled: all(),
      table: reg.CHECK_BENDS
    });
    const gate = r.checkGate(both);
    expect(gate.net).toBe("disadvantage");
    expect(gate.autoFail).toBeUndefined();
    expect(gate.view.head.title).toBe("2 Modifiers — Net");
    expect(r.checkGate([]).net).toBe("normal");
  });
});

describe('effectSources — `except: "source"`: the bend stands against everyone but the one who caused it (2026-09-04)', () => {
  const T = () => reg.EFFECT_BENDS;
  it("Goaded: Disadvantage against anyone but the goader — judged on the target pass, per target", () => {
    const me = {
      uuid: "Actor.jetten",
      effects: [{ id: "g1", name: "Goaded", sourceUuid: "Actor.morgash" }]
    };
    const facts = {
      attacker: me,
      enabled: ["Goaded"],
      table: T(),
      scope: {},
      attackerName: "Jetten"
    };
    // The attacker pass leaves it alone: the row hinges on WHICH target.
    expect(r.effectSources({ ...facts, pass: "attacker" })).toEqual([]);
    const dummy = r.effectSources({
      ...facts,
      target: { uuid: "Actor.dummy" },
      targetName: "the dummy",
      pass: "target"
    });
    expect(dummy).toHaveLength(1);
    expect(dummy[0]).toMatchObject({ bend: "disadvantage", effectId: "g1" });
    expect(
      r.effectSources({
        ...facts,
        target: { uuid: "Actor.morgash" },
        targetName: "Morgash",
        pass: "target"
      })
    ).toEqual([]);
  });
  it("Distracted: Advantage for any attacker but the distracter", () => {
    const target = {
      uuid: "Actor.jetten",
      effects: [{ id: "d1", name: "Distracted", sourceUuid: "Actor.morgash" }]
    };
    const facts = {
      target,
      enabled: ["Distracted"],
      table: T(),
      scope: {},
      targetName: "Jetten",
      pass: "target"
    };
    expect(
      r.effectSources({ ...facts, attacker: { uuid: "Actor.thomas" }, attackerName: "Thomas" })
    ).toHaveLength(1);
    expect(
      r.effectSources({ ...facts, attacker: { uuid: "Actor.morgash" }, attackerName: "Morgash" })
    ).toEqual([]);
  });
  it("an effect with no known source is counted — the gate never guesses an exemption", () => {
    const me = { uuid: "Actor.jetten", effects: [{ id: "g1", name: "Goaded" }] };
    expect(
      r.effectSources({
        attacker: me,
        enabled: ["Goaded"],
        table: T(),
        scope: {},
        target: { uuid: "Actor.morgash" },
        pass: "target"
      })
    ).toHaveLength(1);
  });
});

describe('modeSources — the platform\'s own roll mode, read off the effect CHANGES (user, 2026-09-04: "see the calculus for why there is advantage")', () => {
  const duskheart = {
    id: "e1",
    name: "The Duskheart",
    item: "The Duskheart",
    changes: [{ key: "system.abilities.wis.save.roll.mode", value: "1" }]
  };
  const robe = {
    id: "e2",
    name: "Bonus AC/Saves: +1",
    item: "Robe of Protection",
    changes: [
      { key: "system.attributes.ac.bonus", value: "1" },
      { key: "system.bonuses.abilities.save", value: "1" }
    ]
  };
  it("Harrow Vane's Wisdom save: The Duskheart is one Advantage box, the Robe (a bonus, not a mode) none", () => {
    const out = r.modeSources({
      effects: [duskheart, robe],
      roll: { kind: "save", ability: "wis" },
      rollLabel: "Wisdom saving throws",
      name: "Harrow Vane"
    });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("effect");
    expect(out[0].bend).toBe("advantage");
    expect(out[0].label).toBe("Harrow Vane — The Duskheart");
    expect(out[0].detail).toBe(
      "An effect on the sheet sets Wisdom saving throws to roll with Advantage."
    );
    expect(out[0].effectId).toBe("e1");
  });
  it("the same effect says nothing on a Dexterity save — the key names the ability", () => {
    expect(
      r.modeSources({ effects: [duskheart], roll: { kind: "save", ability: "dex" } })
    ).toHaveLength(0);
  });
  it("−1 is Disadvantage; an effect whose name differs from its item names both", () => {
    const [s] = r.modeSources({
      effects: [
        {
          name: "Cursed",
          item: "Ring of Woe",
          changes: [{ key: "system.abilities.con.save.roll.mode", value: -1 }]
        }
      ],
      roll: { kind: "save", ability: "con" },
      rollLabel: "Constitution saving throws"
    });
    expect(s.bend).toBe("disadvantage");
    expect(s.label).toBe("You — Ring of Woe (Cursed)");
    expect(s.detail).toMatch(/Disadvantage\.$/);
  });
  it("an effect with no item (a bare actor effect) is named by itself; a zero or non-numeric value is nothing", () => {
    const out = r.modeSources({
      effects: [
        {
          name: "Blessed Focus",
          changes: [{ key: "system.abilities.wis.save.roll.mode", value: "1" }]
        },
        { name: "Nothing", changes: [{ key: "system.abilities.wis.save.roll.mode", value: "0" }] },
        { name: "Garbage", changes: [{ key: "system.abilities.wis.save.roll.mode", value: "adv" }] }
      ],
      roll: { kind: "save", ability: "wis" }
    });
    expect(out.map(s => s.label)).toEqual(["You — Blessed Focus"]);
  });
  it("nets with the status sources as the attack gate nets: The Duskheart against a Disadvantage row is Normal", () => {
    const status = r.reminderSource("condition", "disadvantage", "Harrow Vane — Restrained");
    const [mode] = r.modeSources({ effects: [duskheart], roll: { kind: "save", ability: "wis" } });
    expect(r.saveGate([status, mode]).net).toBe("normal");
    expect(r.saveGate([mode]).net).toBe("advantage");
    expect(r.saveGate([mode]).view.head.title).toBe("1 Modifier — Net");
  });
  it("the check keys: the ability's check, the skill, the tool — and a save key is not a check key", () => {
    expect(r.modeKeys({ kind: "check", ability: "dex", skill: "ste" })).toEqual([
      "system.abilities.dex.check.roll.mode",
      "system.skills.ste.roll.mode"
    ]);
    expect(r.modeKeys({ kind: "check", tool: "thief" })).toEqual(["system.tools.thief.roll.mode"]);
    expect(r.modeKeys({ kind: "save" })).toEqual([]);
    expect(r.modeKeys({ kind: "initiative", ability: "dex" })).toEqual([]);
    const [s] = r.modeSources({
      effects: [
        {
          name: "Heavy Armor",
          item: "Plate Armor",
          changes: [{ key: "system.skills.ste.roll.mode", value: "-1" }]
        }
      ],
      roll: { kind: "check", ability: "dex", skill: "ste" },
      rollLabel: "Stealth checks"
    });
    expect(s.bend).toBe("disadvantage");
    expect(s.label).toBe("You — Plate Armor (Heavy Armor)");
  });
});

describe("effectSaveSources — the `saves` facet (user, 2026-09-05: Aura of Purity, Circle of Power)", () => {
  const facts = () => ({
    enabled: ["Aura of Purity", "Circle's Power"],
    table: reg.EFFECT_BENDS,
    name: "Gren"
  });
  const purity = { id: "p1", name: "Aura of Purity" };
  const circle = { id: "c1", name: "Circle's Power" };

  it("Aura of Purity counts Advantage against a demand whose failed effect imposes one of its seven conditions, and names it", () => {
    const out = r.effectSaveSources({
      ...facts(),
      effects: [purity],
      demand: { spell: true, statuses: ["paralyzed"] }
    });
    expect(out).toHaveLength(1);
    expect(out[0].bend).toBe("advantage");
    expect(out[0].label).toBe("Gren — Aura of Purity — against Paralyzed");
    expect(out[0].effectId).toBe("p1");
  });

  it("…and says nothing against a demand that imposes none of them (a Fireball)", () => {
    expect(
      r.effectSaveSources({ ...facts(), effects: [purity], demand: { spell: true, statuses: [] } })
    ).toEqual([]);
  });

  it("Circle's Power counts Advantage against any spell's demand and nothing against a monster's breath", () => {
    const spell = r.effectSaveSources({
      ...facts(),
      effects: [circle],
      demand: { spell: true, statuses: [] }
    });
    expect(spell.map(s => [s.bend, s.label])).toEqual([
      ["advantage", "Gren — Circle's Power — against a spell"]
    ]);
    expect(
      r.effectSaveSources({
        ...facts(),
        effects: [circle],
        demand: { spell: false, statuses: ["poisoned"] }
      })
    ).toEqual([]);
  });

  it("an UNKNOWN demand (a bare sheet roll) lists the effect uncounted, with its scope and the button to press", () => {
    const out = r.effectSaveSources({ ...facts(), effects: [purity, circle], demand: null });
    expect(out.map(s => s.bend)).toEqual([null, null]);
    expect(out[0].label).toMatch(
      /^Gren — Aura of Purity \(listed — a save against Blinded, Charmed/
    );
    expect(out[0].label).toMatch(/press Advantage if this is one\)$/);
    expect(out[1].label).toMatch(/a save against a spell or other magical effect/);
  });

  it("the list is the switch, and an effect not on the sheet is nothing", () => {
    expect(
      r.effectSaveSources({
        ...facts(),
        enabled: [],
        effects: [purity],
        demand: { spell: true, statuses: ["charmed"] }
      })
    ).toEqual([]);
    expect(
      r.effectSaveSources({
        ...facts(),
        effects: [],
        demand: { spell: true, statuses: ["charmed"] }
      })
    ).toEqual([]);
  });

  it("saveNoneOnSuccess names Circle's Power against a spell, and nothing otherwise", () => {
    expect(r.saveNoneOnSuccess({ ...facts(), effects: [circle], demand: { spell: true } })).toBe(
      "Circle's Power"
    );
    expect(
      r.saveNoneOnSuccess({ ...facts(), effects: [circle], demand: { spell: false } })
    ).toBeNull();
    expect(
      r.saveNoneOnSuccess({ ...facts(), effects: [purity], demand: { spell: true } })
    ).toBeNull();
  });
});

describe('effectNamedAs — the emanation\'s suffix (2026-09-05: "Aura of Purity — Thomas" stood on Morgash and no reader saw it)', () => {
  it("matches the bare name, the region's suffixed name, and nothing that merely starts alike", () => {
    expect(r.effectNamedAs("Aura of Purity", "Aura of Purity")).toBe(true);
    expect(r.effectNamedAs("Aura of Purity — Thomas", "aura of purity")).toBe(true);
    expect(r.effectNamedAs("Aura of Purity Lite", "Aura of Purity")).toBe(false);
    expect(r.effectNamedAs("", "Aura of Purity")).toBe(false);
  });
  it("every effect reader honours it: the attack gate (Holy Protection — Thomas), the check gate, the save facet", () => {
    const enabled = ["Holy Protection", "Heated Metal", "Aura of Purity"];
    const attack = r.effectSources({
      enabled,
      table: reg.EFFECT_BENDS,
      attacker: {},
      target: { uuid: "t", effects: [{ id: "h", name: "Holy Protection — Thomas" }] },
      pass: "target"
    });
    expect(attack.map(s => s.bend)).toEqual(["disadvantage"]);
    const check = r.effectCheckSources({
      enabled,
      table: reg.EFFECT_BENDS,
      effects: [{ id: "m", name: "Heated Metal — Jetten" }]
    });
    expect(check.map(s => s.bend)).toEqual(["disadvantage"]);
    const save = r.effectSaveSources({
      enabled,
      table: reg.EFFECT_BENDS,
      effects: [{ id: "p", name: "Aura of Purity — Thomas" }],
      demand: { spell: true, statuses: ["paralyzed"] }
    });
    expect(save.map(s => s.bend)).toEqual(["advantage"]);
  });
});
