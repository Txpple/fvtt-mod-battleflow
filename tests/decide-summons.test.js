import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer summons (ARCHITECTURE.md §2; issue #1): the form rows off the profiles, the spell's
 * own choice, the record and the answer folded into it, the narrowed breath, the shared resistance,
 * the ownership grant. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/summons.js")} */
let s;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  s = await import("../scripts/decide/summons.js");
  reg = await import("../scripts/decide/registry.js");
});

const listed = () => new Set(Object.keys(reg.SUMMON_CHOICES).map(k => k.toLowerCase()));

// The PHB's Summon Fey, as the pack ships it: three profiles, one per form, no level band.
const fey = [
  {
    _id: "fum",
    name: "Fuming Fey Spirit",
    uuid: "Compendium.phb.actors.Actor.fum",
    count: "",
    level: { min: null, max: null },
    types: []
  },
  {
    _id: "mir",
    name: "Mirthful Fey Spirit",
    uuid: "Compendium.phb.actors.Actor.mir",
    count: "1",
    level: {},
    types: []
  },
  {
    _id: "tri",
    name: "Tricksy Fey Spirit",
    uuid: "Compendium.phb.actors.Actor.tri",
    level: {},
    types: []
  }
];
// Find Familiar: a CR 0 pool, no creature.
const familiar = [
  { _id: "fam", name: "", uuid: null, count: "1", cr: "0", level: {}, types: ["beast"] }
];
// Animate Objects' size rows, banded by nothing; a banded profile for the level test.
const banded = [
  { _id: "lo", name: "Low", uuid: "Actor.lo", level: { min: 1, max: 3 } },
  { _id: "hi", name: "High", uuid: "Actor.hi", level: { min: 4, max: null } }
];

describe("profileRows — the profiles a cast may summon", () => {
  it("every profile in the band, as rows; a blank count is 1; a cr-mode profile keeps its cap", () => {
    const rows = s.profileRows(fey, 3);
    expect(rows.map(r => r.id)).toEqual(["fum", "mir", "tri"]);
    expect(rows[0].count).toBe("1");
    expect(rows[0].cr).toBeNull();
    expect(s.profileRows(familiar, 1)[0]).toMatchObject({
      id: "fam",
      uuid: null,
      cr: "0",
      types: ["beast"]
    });
  });
  it("a level band is inclusive and open-ended on a null bound", () => {
    expect(s.profileRows(banded, 3).map(r => r.id)).toEqual(["lo"]);
    expect(s.profileRows(banded, 4).map(r => r.id)).toEqual(["hi"]);
    expect(s.profileRows(banded, 9).map(r => r.id)).toEqual(["hi"]);
    expect(s.profileRows([{ name: "no id" }], 1)).toEqual([]);
  });
});

describe("choiceRowKey and formNeeds — what the popup asks", () => {
  it("Summon Dragon answers to its row; Summon Fey to none; an unlisted row answers nothing", () => {
    expect(s.choiceRowKey(reg.SUMMON_CHOICES, "Summon Dragon", listed())).toBe("Summon Dragon");
    expect(s.choiceRowKey(reg.SUMMON_CHOICES, "summon dragon", listed())).toBe("Summon Dragon");
    expect(s.choiceRowKey(reg.SUMMON_CHOICES, "Summon Fey", listed())).toBeNull();
    expect(s.choiceRowKey(reg.SUMMON_CHOICES, "Summon Dragon", new Set())).toBeNull();
    expect(s.choiceRowKey(reg.SUMMON_CHOICES, null, listed())).toBeNull();
  });
  it("three forms ask the form; one form with a choice asks the choice; a pool asks the pool; one form and nothing else asks nothing", () => {
    expect(s.formNeeds({ profiles: s.profileRows(fey, 3), choice: null })).toMatchObject({
      profile: true,
      pool: false,
      choice: false,
      any: true
    });
    expect(
      s.formNeeds({ profiles: [{ uuid: "Actor.d", cr: null }], choice: "Summon Dragon" })
    ).toMatchObject({ profile: false, choice: true, any: true });
    expect(s.formNeeds({ profiles: s.profileRows(familiar, 1), choice: null })).toMatchObject({
      profile: false,
      pool: true,
      any: true
    });
    expect(s.formNeeds({ profiles: [{ uuid: "Actor.x", cr: null }], choice: null }).any).toBe(
      false
    );
  });
});

describe("summonRecord and placedAnswer — the record and the answer folded in", () => {
  const record = () =>
    s.summonRecord({
      sourceUuid: "Actor.c",
      sourceName: "Corin",
      itemUuid: "Actor.c.Item.sd",
      itemName: "Summon Dragon",
      activityUuid: "Actor.c.Item.sd.Activity.a",
      level: 5,
      profiles: [
        {
          id: "drg",
          name: "Draconic Spirit",
          uuid: "Compendium.phb.actors.Actor.drg",
          count: "1",
          cr: null,
          types: []
        }
      ],
      choice: "Summon Dragon",
      concentrationId: "conc1",
      sceneId: "scene1"
    });
  const place = [{ x: 100, y: 200, elevation: 0, rotation: 0, level: null }];

  it("the record starts asked, carrying the caster, the cast, the level, the profiles, the choice and the scene", () => {
    const r = record();
    expect(r).toMatchObject({
      status: "asked",
      sourceUuid: "Actor.c",
      level: 5,
      choice: "Summon Dragon",
      concentrationId: "conc1",
      sceneId: "scene1"
    });
    expect(r.profiles).toHaveLength(1);
    expect(typeof r.askedAt).toBe("number");
  });
  it("one profile needs no profileId; the dragon's type must be one of the row's; the placements must be squares", () => {
    const r = record();
    const ok = s.placedAnswer(
      r,
      { profileId: null, choice: "fire", placements: place, count: 1, sceneId: "scene1" },
      reg.SUMMON_CHOICES
    );
    expect(ok).toMatchObject({
      status: "placed",
      profileId: "drg",
      summonUuid: "Compendium.phb.actors.Actor.drg",
      choice: "fire",
      count: 1,
      sceneId: "scene1"
    });
    expect(ok.placements).toEqual([{ x: 100, y: 200, elevation: 0, rotation: 0, level: null }]);
    expect(
      s.placedAnswer(
        r,
        { profileId: null, choice: "radiant", placements: place, count: 1 },
        reg.SUMMON_CHOICES
      )
    ).toBeNull();
    expect(
      s.placedAnswer(
        r,
        { profileId: null, choice: "fire", placements: [], count: 1 },
        reg.SUMMON_CHOICES
      )
    ).toBeNull();
    expect(
      s.placedAnswer(
        r,
        { profileId: null, choice: "fire", placements: [{ x: "a", y: 1 }], count: 1 },
        reg.SUMMON_CHOICES
      )
    ).toBeNull();
  });
  it("several profiles need the one picked, and it must be one of the record's; a pool profile needs the pick", () => {
    const r = { ...record(), choice: null, profiles: s.profileRows(fey, 3) };
    expect(
      s.placedAnswer(r, { profileId: "mir", placements: place, count: 1 }, reg.SUMMON_CHOICES)
    ).toMatchObject({
      profileId: "mir",
      profileName: "Mirthful Fey Spirit",
      summonUuid: "Compendium.phb.actors.Actor.mir"
    });
    expect(
      s.placedAnswer(r, { profileId: "nope", placements: place, count: 1 }, reg.SUMMON_CHOICES)
    ).toBeNull();
    expect(
      s.placedAnswer(r, { profileId: null, placements: place, count: 1 }, reg.SUMMON_CHOICES)
    ).toBeNull();
    const pool = { ...record(), choice: null, profiles: s.profileRows(familiar, 1) };
    expect(
      s.placedAnswer(pool, { profileId: null, placements: place, count: 1 }, reg.SUMMON_CHOICES)
    ).toBeNull();
    expect(
      s.placedAnswer(
        pool,
        {
          profileId: null,
          pick: { uuid: "Compendium.mm.actors.Actor.owl", name: "Owl" },
          placements: place,
          count: 1
        },
        reg.SUMMON_CHOICES
      )
    ).toMatchObject({ summonUuid: "Compendium.mm.actors.Actor.owl", summonName: "Owl" });
  });
  it("a record not asked folds nothing", () => {
    expect(
      s.placedAnswer(
        { ...record(), status: "placed" },
        { profileId: null, choice: "fire", placements: place, count: 1 },
        reg.SUMMON_CHOICES
      )
    ).toBeNull();
  });
});

describe("narrowedActivities — the breath narrowed to one type", () => {
  // The Draconic Spirit's Breath Weapon as the pack ships it: one 2d6 part carrying all five types.
  const breath = {
    act1: {
      damage: {
        parts: [
          { number: 2, denomination: 6, types: ["acid", "cold", "fire", "lightning", "poison"] }
        ]
      }
    }
  };
  it("the part keeps only the chosen type, on the activity's path", () => {
    const out = s.narrowedActivities(breath, "fire");
    expect(Object.keys(out)).toEqual(["system.activities.act1.damage.parts"]);
    expect(out["system.activities.act1.damage.parts"][0]).toMatchObject({
      number: 2,
      denomination: 6,
      types: ["fire"]
    });
  });
  it("a part that never listed the type is left alone; nothing matching is null", () => {
    const two = {
      a: { damage: { parts: [{ types: ["fire", "cold"] }, { types: ["piercing"] }] } },
      b: { damage: { parts: [{ types: ["slashing"] }] } }
    };
    const out = s.narrowedActivities(two, "cold");
    expect(out["system.activities.a.damage.parts"]).toEqual([
      { types: ["cold"] },
      { types: ["piercing"] }
    ]);
    expect(out["system.activities.b.damage.parts"]).toBeUndefined();
    expect(s.narrowedActivities(two, "radiant")).toBeNull();
    expect(s.narrowedActivities(two, "")).toBeNull();
  });
});

describe("resistanceEffectData and ownershipGrant — what lands on the caster and who owns the creature", () => {
  it("the resistance is one ADD on the damage-resistance trait, never transferred", () => {
    const e = s.resistanceEffectData({
      type: "Fire",
      name: "Shared Resistance (Fire)",
      origin: "Actor.c.Item.sd"
    });
    expect(e).toMatchObject({
      name: "Shared Resistance (Fire)",
      transfer: false,
      disabled: false,
      origin: "Actor.c.Item.sd"
    });
    expect(e.changes).toEqual([
      { key: "system.traits.dr.value", mode: 2, value: "fire", priority: null }
    ]);
  });
  it("every owner of the caster who does not yet own the creature is granted; the default is never copied", () => {
    expect(s.ownershipGrant({ default: 0, p1: 3, p2: 1, gm: 3 }, { default: 0, gm: 3 })).toEqual({
      p1: 3
    });
    expect(s.ownershipGrant({ default: 3, p1: 3 }, { p1: 3 })).toBeNull();
    expect(s.ownershipGrant({}, {})).toBeNull();
  });
});

describe("seatInitiative — the creature right after the caster", () => {
  it("a hair below the caster's Initiative; none without one", () => {
    expect(s.seatInitiative(17)).toBe(16.99);
    expect(s.seatInitiative(17.5)).toBe(17.49);
    expect(s.seatInitiative(null)).toBeNull();
    expect(s.seatInitiative(undefined)).toBeNull();
  });
});
