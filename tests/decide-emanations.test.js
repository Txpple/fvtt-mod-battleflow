import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer emanations (ARCHITECTURE.md §2): reach by disposition, range from the content,
 * the source's numbers read into the pack's effect. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/emanations.js")} */
let em;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  em = await import("../scripts/decide/emanations.js");
  reg = await import("../scripts/decide/registry.js");
});

const { FRIENDLY, NEUTRAL, HOSTILE, SECRET } = { FRIENDLY: 1, NEUTRAL: 0, HOSTILE: -1, SECRET: -2 };

describe("reachAdmits — the user's defaults (2026-09-03): helpful reaches allies and neutrals, harmful reaches enemies", () => {
  it("a friendly Paladin's aura reaches friendlies and neutrals, never hostiles", () => {
    expect(em.reachAdmits("helpful", FRIENDLY, FRIENDLY)).toBe(true);
    expect(em.reachAdmits("helpful", FRIENDLY, NEUTRAL)).toBe(true);
    expect(em.reachAdmits("helpful", FRIENDLY, HOSTILE)).toBe(false);
  });
  it("a hostile paladin's aura reaches hostiles and neutrals", () => {
    expect(em.reachAdmits("helpful", HOSTILE, HOSTILE)).toBe(true);
    expect(em.reachAdmits("helpful", HOSTILE, NEUTRAL)).toBe(true);
    expect(em.reachAdmits("helpful", HOSTILE, FRIENDLY)).toBe(false);
  });
  it("a friendly cleric's Spirit Guardians reach hostiles only — allies and neutrals are the designated unaffected", () => {
    expect(em.reachAdmits("harmful", FRIENDLY, HOSTILE)).toBe(true);
    expect(em.reachAdmits("harmful", FRIENDLY, FRIENDLY)).toBe(false);
    expect(em.reachAdmits("harmful", FRIENDLY, NEUTRAL)).toBe(false);
  });
  it("a neutral source's harm reaches every side but its own", () => {
    expect(em.reachAdmits("harmful", NEUTRAL, HOSTILE)).toBe(true);
    expect(em.reachAdmits("harmful", NEUTRAL, FRIENDLY)).toBe(true);
    expect(em.reachAdmits("harmful", NEUTRAL, NEUTRAL)).toBe(false);
  });
  it("a secret token is nobody's business, either way", () => {
    expect(em.reachAdmits("helpful", FRIENDLY, SECRET)).toBe(false);
    expect(em.reachAdmits("harmful", SECRET, HOSTILE)).toBe(false);
  });
  it("an unknown reach admits nobody", () => {
    expect(em.reachAdmits("sideways", FRIENDLY, FRIENDLY)).toBe(false);
  });
});

describe("resolveFormula / resolveChanges — the SOURCE's numbers travel with the effect", () => {
  const paladin = { abilities: { cha: { mod: 3 } }, scale: { paladin: { aura: { value: 10 } } } };
  it("reads @abilities.cha.mod off the Paladin, not the receiver (the pack's own note)", () => {
    const { changes, unresolved } = em.resolveChanges(
      [{ key: "system.bonuses.abilities.save", mode: 2, value: "@abilities.cha.mod" }],
      paladin
    );
    expect(unresolved).toEqual([]);
    expect(changes[0].value).toBe("3");
    expect(changes[0].key).toBe("system.bonuses.abilities.save");
  });
  it("leaves a change with no formula alone (Warding's resistances, Half Speed's multiplier)", () => {
    const { changes } = em.resolveChanges(
      [
        { key: "system.traits.dr.value", mode: 2, value: "necrotic" },
        { key: "system.attributes.movement.speed", mode: 1, value: "0.5" }
      ],
      paladin
    );
    expect(changes.map(c => c.value)).toEqual(["necrotic", "0.5"]);
  });
  it("reports an unresolved token instead of shipping a silent zero", () => {
    const { changes, unresolved } = em.resolveChanges(
      [{ key: "x", mode: 2, value: "@abilities.wis.mod" }],
      paladin
    );
    expect(unresolved).toEqual(["abilities.wis.mod"]);
    expect(changes[0].value).toBe("@abilities.wis.mod");
  });
  it("folds plain arithmetic and nothing else", () => {
    expect(em.foldArithmetic("2 + 1")).toBe("3");
    expect(em.foldArithmetic("-1")).toBe("-1");
    expect(em.foldArithmetic("3 * (2 - 1)")).toBe("3");
    expect(em.foldArithmetic("1d8 + 2")).toBe("1d8 + 2");
    expect(em.foldArithmetic("necrotic")).toBe("necrotic");
  });
  it("a scale value arrives as an object and reads as its number", () => {
    expect(em.lookupRollData(paladin, "scale.paladin.aura")).toBe(10);
    expect(em.lookupRollData(paladin, "scale.paladin.nothing")).toBe(null);
    expect(em.lookupRollData({}, "a.b.c")).toBe(null);
  });
});

describe("emanationRange — the content's data first, the class's scale value second, nothing invented", () => {
  it("takes the activity's own size when the pack gives one (Spirit Guardians: 15)", () => {
    expect(em.emanationRange({ range: "@scale.paladin.aura" }, {}, 15)).toBe(15);
    expect(em.emanationRange({ range: 10 }, {}, "15")).toBe(15);
  });
  it("reads the Paladin's aura scale value — 10 at 6th, 30 at 18th — and NOTHING below 6th", () => {
    const row = { range: "@scale.paladin.aura" };
    expect(em.emanationRange(row, { scale: { paladin: { aura: { value: 10 } } } })).toBe(10);
    expect(em.emanationRange(row, { scale: { paladin: { aura: { value: 30 } } } })).toBe(30);
    expect(em.emanationRange(row, { scale: { paladin: { aura: null } } })).toBe(null);
    expect(em.emanationRange(row, {})).toBe(null);
  });
  it("a zero-size activity (Aura of Courage's formula on a bare item) falls through to the row", () => {
    expect(
      em.emanationRange(
        { range: "@scale.paladin.aura" },
        { scale: { paladin: { aura: { value: 10 } } } },
        0
      )
    ).toBe(10);
  });
  it("a row with no range at all reaches nowhere", () => {
    expect(em.emanationRange({}, {})).toBe(null);
    expect(em.emanationRange({ range: 0 }, {})).toBe(null);
  });
});

describe("triggerDue — once per turn in combat, every time out of it (DESIGN §8)", () => {
  it("in combat, a standing chit means the save was already made this turn", () => {
    expect(em.triggerDue({ inCombat: true, chitStands: true }).due).toBe(false);
    expect(em.triggerDue({ inCombat: true, chitStands: false })).toEqual({
      due: true,
      why: "once this turn"
    });
  });
  it("out of combat there is no turn to be once-per", () => {
    expect(em.triggerDue({ inCombat: false, chitStands: true }).due).toBe(true);
  });
});

describe("memberEffectData — the pack's effect, named for its source, fingerprinted for the floor", () => {
  it("carries the resolved changes, the source's item as origin, and the region in its flag", () => {
    const data = em.memberEffectData(
      { name: "Aura of Protection", rule: "You radiate…" },
      {
        name: "Protected",
        img: null,
        changes: [{ key: "system.bonuses.abilities.save", mode: 2, value: "3" }]
      },
      {
        sourceName: "Ysolde",
        itemUuid: "Actor.a.Item.b",
        regionId: "R1",
        moduleId: "bf",
        flagKey: "emanation"
      }
    );
    expect(data.name).toBe("Protected — Ysolde");
    expect(data.origin).toBe("Actor.a.Item.b");
    expect(data.transfer).toBe(false);
    expect(data.changes[0].value).toBe("3");
    expect(data.flags.bf.emanation).toEqual({ regionId: "R1", key: "Aura of Protection" });
    expect(data.img).toBe("icons/svg/aura.svg");
  });
});

describe("the EMANATIONS table (decide/registry.js)", () => {
  it("names the four rows of the first slice, each with a kind, a reach, a rule and an effect", () => {
    const names = Object.keys(reg.EMANATIONS);
    expect(names).toEqual(
      expect.arrayContaining([
        "Aura of Protection",
        "Aura of Courage",
        "Aura of Warding",
        "Spirit Guardians"
      ])
    );
    for (const [name, row] of Object.entries(reg.EMANATIONS)) {
      expect(reg.EMANATION_KINDS.has(row.kind), name).toBe(true);
      expect(["helpful", "harmful"], name).toContain(row.reach);
      expect(typeof row.rule, name).toBe("string");
      expect(typeof row.effect, name).toBe("string");
    }
  });
  it("the Paladin's three auras read their range off the class's own scale value, never a number here", () => {
    for (const n of ["Aura of Protection", "Aura of Courage", "Aura of Warding"]) {
      expect(reg.EMANATIONS[n].range).toBe("@scale.paladin.aura");
      expect(reg.EMANATIONS[n].kind).toBe("feature");
      expect(reg.EMANATIONS[n].incapacitated).toBe(true);
    }
  });
  it("Spirit Guardians is a cast emanation with a save on entering and on ending a turn inside, once per turn", () => {
    const sg = reg.EMANATIONS["Spirit Guardians"];
    expect(sg.kind).toBe("spell");
    expect(sg.reach).toBe("harmful");
    expect(sg.range).toBe(null);
    expect(sg.trigger).toEqual({ on: ["enter", "turnEnd"], oncePerTurn: true });
  });
  it("the Emanations list is membership over the table's names, whole-chunk, and ships every row ON", () => {
    const spec = reg.LIST_SPECS.emanations;
    expect(spec.membership).toBe(true);
    expect(spec.whole).toBe(true);
    const entries = reg.parseList(spec, spec.default).entries.map(e => e.kind);
    expect(entries.sort()).toEqual(
      Object.keys(reg.EMANATIONS)
        .map(s => s.toLowerCase())
        .sort()
    );
    expect(reg.parseList(spec, "Aura of Protection, Fireball").rejects).toHaveLength(1);
  });
  it("the emanation kind set is counted by the R4 tripwire", () => {
    const set = reg.KIND_SETS.find(s => s.name === "emanation");
    expect(set?.owner).toBe("emanations.js");
    expect([...set.kinds].sort()).toEqual(["feature", "spell"]);
  });
});

describe("damageTypeFor — Spirit Guardians' type is the alignment's by default, and the caster's when chosen", () => {
  const both = ["necrotic", "radiant"];
  it("a good or neutral (or unaligned) caster deals radiant", () => {
    expect(em.damageTypeFor(both, "Neutral Good").type).toBe("radiant");
    expect(em.damageTypeFor(both, "").type).toBe("radiant");
    expect(em.damageTypeFor(both, null).type).toBe("radiant");
  });
  it("an evil caster deals necrotic", () => {
    expect(em.damageTypeFor(both, "Chaotic Evil").type).toBe("necrotic");
    expect(em.damageTypeFor(both, "lawful evil").type).toBe("necrotic");
  });
  it("a pick that the part offers wins over the alignment", () => {
    expect(em.damageTypeFor(both, "Neutral Good", "necrotic")).toEqual({
      type: "necrotic",
      why: "chosen"
    });
    expect(em.damageTypeFor(both, "Chaotic Evil", "fire").type).toBe("necrotic");
  });
  it("a single-type part is that type; no part is no type", () => {
    expect(em.damageTypeFor(["fire"], "Chaotic Evil").type).toBe("fire");
    expect(em.damageTypeFor([], "Good").type).toBe(null);
  });
});
