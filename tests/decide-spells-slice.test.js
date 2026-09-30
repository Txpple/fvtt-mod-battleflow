import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: the spells slice (the commission of 2026-09-28; the drawing audits/drawings/spells.md) —
 * Tier 1's rows on the tables that exist, the `abilities` scope of the saves facet, the roll at its
 * maximum, and Tier 2's REPEAT_SAVES table with the arithmetic of decide/repeat-saves.js and the
 * turn-start grant's of decide/turn-grants.js. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/reminders.js")} */
let r;
/** @type {typeof import("../scripts/decide/damage-dice.js")} */
let d;
/** @type {typeof import("../scripts/decide/repeat-saves.js")} */
let rs;
/** @type {typeof import("../scripts/decide/turn-grants.js")} */
let tg;
/** @type {typeof import("../scripts/decide/wards.js")} */
let w;
/** @type {typeof import("../scripts/decide/duplicates.js")} */
let dup;
/** @type {typeof import("../scripts/decide/verdict.js")} */
let v;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  r = await import("../scripts/decide/reminders.js");
  d = await import("../scripts/decide/damage-dice.js");
  rs = await import("../scripts/decide/repeat-saves.js");
  tg = await import("../scripts/decide/turn-grants.js");
  w = await import("../scripts/decide/wards.js");
  dup = await import("../scripts/decide/duplicates.js");
  v = await import("../scripts/decide/verdict.js");
});

describe("Tier 1 — the rows", () => {
  it("Protection from Poison: the pack's Poison Protection carries the resistance; the Advantage against Poisoned is the row's — Dwarven Resilience's exact facet, on an effect", () => {
    const row = reg.EFFECT_BENDS["Poison Protection"];
    expect(row).toMatchObject({ attacker: null, target: null, scope: "any" });
    expect(row.saves).toEqual(reg.EFFECT_BENDS["Dwarven Resilience"].saves);
    expect(row.match).toBeUndefined();
    expectPointer(row.rule);
    expect(row.rule.item).toBe("Protection from Poison");
  });
  it("Otto's Irresistible Dance: attacks at Disadvantage, attacks against it at Advantage, Dexterity saves at Disadvantage — the `abilities` scope, new to the facet", () => {
    const row = reg.EFFECT_BENDS["Irresistible Dance"];
    expect(row).toMatchObject({ attacker: "disadvantage", target: "advantage", scope: "any" });
    expect(row.saves).toMatchObject({ bend: "disadvantage" });
    expect([...row.saves.abilities]).toEqual(["dex"]);
    // …and B2's six Hexed rows (Eldritch Hex) share the scope, one ability each.
    expect(Object.keys(reg.EFFECT_BENDS).filter(k => reg.EFFECT_BENDS[k].saves?.abilities)).toEqual(
      [
        "Irresistible Dance",
        "Hexed Strength",
        "Hexed Dexterity",
        "Hexed Constitution",
        "Hexed Intelligence",
        "Hexed Wisdom",
        "Hexed Charisma"
      ]
    );
    expectPointer(row.rule);
  });
  it("Beacon of Hope: a `max` row of the healing table on the HEALED creature's effect, with no reroll face — Healer keeps its own", () => {
    const row = reg.HEAL_REROLLS["Beacon of Hope"];
    expect(row).toMatchObject({ effect: "Hopeful", max: true });
    expect(row.reroll).toBeUndefined();
    expect(reg.HEAL_REROLLS.Healer.max).toBeUndefined();
    expect(
      reg
        .healRerollEntries()
        .map(e => e.kind)
        .sort()
    ).toEqual(["beacon of hope", "blessed healer", "disciple of life", "healer", "starry form"]);
    expectPointer(row.rule);
  });
  it("Heroism: the one turn-start grant — Bravery on the bearer, the spell's Heal activity rolled again on the caster", () => {
    expect(Object.keys(reg.TURN_GRANTS).slice(0, 2)).toEqual(["Heroism", "Regeneration"]);
    const row = reg.TURN_GRANTS.Heroism;
    expect(Object.isFrozen(row)).toBe(true);
    expect(row).toMatchObject({ effect: "Bravery", activity: "Heal", on: "turnStart" });
    expect(reg.turnGrantEntries().slice(0, 2)).toEqual([
      { kind: "heroism" },
      { kind: "regeneration" }
    ]);
    expectPointer(row.rule);
  });
});

describe("the saves facet's `abilities` scope, and the demand's own bend", () => {
  const facts = () => ({ enabled: ["Irresistible Dance"], table: reg.EFFECT_BENDS, name: "Gren" });
  const dance = { id: "d1", name: "Irresistible Dance" };

  it("Irresistible Dance counts Disadvantage against a Dexterity save demanded of the dancer, and says which save", () => {
    const out = r.effectSaveSources({
      ...facts(),
      effects: [dance],
      demand: { spell: true, abilities: ["dex"], statuses: [] }
    });
    expect(out).toHaveLength(1);
    expect(out[0].bend).toBe("disadvantage");
    expect(out[0].label).toBe("Gren — Irresistible Dance — a Dexterity save");
    expect(out[0].effectId).toBe("d1");
  });
  it("…and says nothing against a Wisdom save (its own repeat), or a demand that names no ability", () => {
    expect(
      r.effectSaveSources({
        ...facts(),
        effects: [dance],
        demand: { spell: true, abilities: ["wis"], statuses: [] }
      })
    ).toEqual([]);
    expect(
      r.effectSaveSources({ ...facts(), effects: [dance], demand: { spell: true, statuses: [] } })
    ).toEqual([]);
  });
  it("with no demand (a bare sheet roll) the row is LISTED with the save it means, never counted", () => {
    const out = r.effectSaveSources({ ...facts(), effects: [dance], demand: null });
    expect(out).toHaveLength(1);
    expect(out[0].bend).toBeNull();
    expect(out[0].label).toMatch(/listed — a Dexterity save; press Disadvantage if this is one/);
  });
  it("Poison Protection: Advantage against a demand that would poison, nothing against a Fireball", () => {
    const f = {
      enabled: ["Poison Protection"],
      table: reg.EFFECT_BENDS,
      name: "Gren",
      effects: [{ id: "pp", name: "Poison Protection" }]
    };
    const out = r.effectSaveSources({ ...f, demand: { spell: true, statuses: ["poisoned"] } });
    expect(out.map(s => [s.bend, s.label])).toEqual([
      ["advantage", "Gren — Poison Protection — against Poisoned"]
    ]);
    expect(r.effectSaveSources({ ...f, demand: { spell: true, statuses: [] } })).toEqual([]);
  });
  it("the demand's own bend (a repeat raised by damage, Tasha's Hideous Laughter) is one counted source with the spell's words; a demand with none adds nothing", () => {
    const out = r.demandBendSources(
      {
        bend: {
          mode: "advantage",
          label: "Tasha's Hideous Laughter — the save was raised by damage",
          rule: reg.REPEAT_SAVES["Tasha's Hideous Laughter"].rule
        }
      },
      "Gren"
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: "effect",
      bend: "advantage",
      label: "Gren — Tasha's Hideous Laughter — the save was raised by damage"
    });
    expect(r.demandBendSources({ spell: true, statuses: [] })).toEqual([]);
    expect(r.demandBendSources(null)).toEqual([]);
  });
});

describe("rollMaximum — the roll at its maximum (Beacon of Hope)", () => {
  const roll = (terms, total) => ({ class: "DamageRoll", formula: "", terms, total });
  it("every die at its faces times its count, the flat bonus as written: 2d8 + 3 rolled 7 is 19", () => {
    const data = roll(
      [
        {
          class: "Die",
          number: 2,
          faces: 8,
          results: [
            { result: 1, active: true },
            { result: 3, active: true }
          ]
        },
        { class: "OperatorTerm", operator: "+" },
        { class: "NumericTerm", number: 3 }
      ],
      7
    );
    expect(d.rollMaximum(data)).toBe(19);
  });
  it("a subtraction is honoured (1d10 − 2 → 8), and a term the walk cannot read counts what it rolled", () => {
    expect(
      d.rollMaximum(
        roll(
          [
            { class: "Die", number: 1, faces: 10, results: [{ result: 5, active: true }] },
            { class: "OperatorTerm", operator: "-" },
            { class: "NumericTerm", number: 2 }
          ],
          3
        )
      )
    ).toBe(8);
    expect(
      d.rollMaximum(
        roll(
          [
            { class: "PoolTerm", total: 6 },
            { class: "OperatorTerm", operator: "+" },
            { class: "Die", number: 1, faces: 4, results: [{ result: 2, active: true }] }
          ],
          8
        )
      )
    ).toBe(10);
  });
  it("never below the rolled total, and nothing from nothing", () => {
    expect(d.rollMaximum(roll([{ class: "Die", number: 1, faces: 4, results: [] }], 9))).toBe(9);
    expect(d.rollMaximum(null)).toBe(0);
    expect(d.rollMaximum({ terms: [], total: 0 })).toBe(0);
  });
});

describe("REPEAT_SAVES — the table (Tier 2)", () => {
  it("is a closed set of three triggers, counted by the tripwire under its own machine", () => {
    expect([...reg.REPEAT_TRIGGERS].sort()).toEqual(["action", "damaged", "turnEnd"]);
    const set = reg.KIND_SETS.find(s => s.name === "repeatSave");
    expect(set?.owner).toBe("repeat-saves.js");
    expect(set?.kinds).toBe(reg.REPEAT_TRIGGERS);
  });
  it("every row is frozen, keyed by the SPELL, names its pack effect(s), triggers only from the set, and points at its own text", () => {
    for (const [key, row] of Object.entries(reg.REPEAT_SAVES)) {
      expect(Object.isFrozen(row), key).toBe(true);
      const effects = Array.isArray(row.effect) ? row.effect : [row.effect];
      expect(effects.length, key).toBeGreaterThan(0);
      for (const e of effects) expect(e, key).toBeTypeOf("string");
      expect(row.on.length, key).toBeGreaterThan(0);
      for (const t of row.on) expect(reg.REPEAT_TRIGGERS.has(t), `${key}:${t}`).toBe(true);
      expectPointer(row.rule, key);
      // A second row on one spell names the spell in `item` (Prismatic Spray's indigo ray); the pointer is the spell's.
      expect(row.rule.item, key).toBe(row.item ?? key);
      expect(row.from, key).toBeTypeOf("string");
    }
    expect(reg.repeatSaveEntries().map(e => e.kind)).toContain("hold person");
  });
  it("Hold Person is the customer: Paralyzed, at the bearer's turn end — Hold Monster the same shape", () => {
    expect(reg.REPEAT_SAVES["Hold Person"]).toMatchObject({ effect: "Paralyzed" });
    expect([...reg.REPEAT_SAVES["Hold Person"].on]).toEqual(["turnEnd"]);
    expect(reg.REPEAT_SAVES["Hold Monster"].effect).toBe("Paralyzed");
  });
  it("Tasha's Hideous Laughter repeats at the turn end AND when damaged, with Advantage on the damaged one; the Dominates on damage only", () => {
    const thl = reg.REPEAT_SAVES["Tasha's Hideous Laughter"];
    expect([...thl.on]).toEqual(["turnEnd", "damaged"]);
    expect(thl.advantage).toBe("damaged");
    for (const k of ["Dominate Beast", "Dominate Person", "Dominate Monster"]) {
      expect([...reg.REPEAT_SAVES[k].on], k).toEqual(["damaged"]);
      expect(reg.REPEAT_SAVES[k].effect, k).toBe("Dominated");
      expect(reg.REPEAT_SAVES[k].advantage, k).toBeUndefined();
    }
  });
  it("Otto's dance is the bearer's ACTION, offered — the only `action` row; Phantasmal Killer's repeat takes none on a success", () => {
    expect(
      Object.keys(reg.REPEAT_SAVES).filter(k => reg.REPEAT_SAVES[k].on.includes("action"))
    ).toEqual(["Otto's Irresistible Dance"]);
    expect(reg.REPEAT_SAVES["Phantasmal Killer"].onSave).toBe("none");
    expect(Object.keys(reg.REPEAT_SAVES).filter(k => reg.REPEAT_SAVES[k].onSave)).toEqual([
      "Phantasmal Killer"
    ]);
  });
  it("the counters: Contagion's three saves end it and three failures lock it; Flesh to Stone's three failures press Petrified", () => {
    expect(reg.REPEAT_SAVES.Contagion.count).toEqual({ saves: 3, fails: 3 });
    expect(reg.REPEAT_SAVES.Contagion.effect).toHaveLength(6);
    expect(reg.REPEAT_SAVES["Flesh to Stone"].count).toEqual({
      saves: 3,
      fails: 3,
      press: "petrified"
    });
    expect(
      Object.keys(reg.REPEAT_SAVES)
        .filter(k => reg.REPEAT_SAVES[k].count)
        .sort()
    ).toEqual([
      "Contagion",
      "Flesh to Stone",
      "Petrifying Bite",
      "Petrifying Breath",
      "Petrifying Gaze",
      "Prismatic Spray (Indigo)"
    ]);
  });
  it("the three chosen-area spells (Slow, Fear, Confusion) are rows here too — the repeat is a second row on the same spell", () => {
    for (const k of ["Slow", "Fear", "Confusion"]) {
      expect(reg.REPEAT_SAVES[k], k).toBeDefined();
      expect(reg.chosenAreaListed(k) || reg.spentAreaListed(k), k).toBe(true);
    }
    expect(reg.REPEAT_SAVES.Fear.caveat).toMatch(/line of sight/);
  });
});

describe("decide/repeat-saves.js — the arithmetic", () => {
  const hold = { name: "Hold Person", type: "spell", system: { identifier: "hold-person" } };
  const ghoul = { name: "Claw", type: "feat", system: { identifier: "claw" } };

  it("a row is found by the effect's ORIGIN item and the effect's name together — a ghoul's Paralyzed is not Hold Person's", () => {
    const found = rs.repeatRowFor({
      table: reg.REPEAT_SAVES,
      answers: reg.answers,
      item: hold,
      effectName: "Paralyzed"
    });
    expect(found?.key).toBe("Hold Person");
    expect(
      rs.repeatRowFor({
        table: reg.REPEAT_SAVES,
        answers: reg.answers,
        item: ghoul,
        effectName: "Paralyzed"
      })
    ).toBeNull();
    expect(
      rs.repeatRowFor({
        table: reg.REPEAT_SAVES,
        answers: reg.answers,
        item: hold,
        effectName: "Slowed"
      })
    ).toBeNull();
    expect(
      rs.repeatRowFor({
        table: reg.REPEAT_SAVES,
        answers: reg.answers,
        item: null,
        effectName: "Paralyzed"
      })
    ).toBeNull();
  });
  it("a list-effect row answers any of its names (Blindness/Deafness), case-insensitively", () => {
    const bd = {
      name: "Blindness/Deafness",
      type: "spell",
      system: { identifier: "blindness-deafness" }
    };
    expect(
      rs.repeatRowFor({
        table: reg.REPEAT_SAVES,
        answers: reg.answers,
        item: bd,
        effectName: "deafness"
      })?.key
    ).toBe("Blindness/Deafness");
    expect(
      rs.repeatRowFor({
        table: reg.REPEAT_SAVES,
        answers: reg.answers,
        item: bd,
        effectName: "Blindness"
      })?.key
    ).toBe("Blindness/Deafness");
  });
  it("an unlisted row is not found — the membership reader is the switch", () => {
    expect(
      rs.repeatRowFor({
        table: reg.REPEAT_SAVES,
        answers: reg.answers,
        item: hold,
        effectName: "Paralyzed",
        listed: new Set()
      })
    ).toBeNull();
    expect(
      rs.repeatRowFor({
        table: reg.REPEAT_SAVES,
        answers: reg.answers,
        item: hold,
        effectName: "Paralyzed",
        listed: new Set(["hold person"])
      })?.key
    ).toBe("Hold Person");
  });
  it("a trigger is due only when the row names it and no demand for this effect is still pending", () => {
    const row = reg.REPEAT_SAVES["Tasha's Hideous Laughter"];
    expect(rs.repeatDue(row, "turnEnd", { pending: false })).toEqual({
      due: true,
      why: "at the end of its turn"
    });
    expect(rs.repeatDue(row, "damaged", { pending: false })).toEqual({
      due: true,
      why: "it took damage"
    });
    expect(rs.repeatDue(row, "damaged", { pending: true }).due).toBe(false);
    expect(rs.repeatDue(reg.REPEAT_SAVES["Hold Person"], "damaged", { pending: false }).due).toBe(
      false
    );
    expect(rs.repeatDue(reg.REPEAT_SAVES["Hold Person"], "action", { pending: false }).due).toBe(
      false
    );
  });
  it("the demand's bend rides only the trigger the row names (Tasha's damaged save has Advantage; its turn-end one none)", () => {
    const thl = reg.REPEAT_SAVES["Tasha's Hideous Laughter"];
    expect(rs.repeatBend(thl, "damaged", "Tasha's Hideous Laughter")).toEqual({
      mode: "advantage",
      label: "Tasha's Hideous Laughter — the save was raised by damage",
      rule: thl.rule
    });
    expect(rs.repeatBend(thl, "turnEnd", "Tasha's Hideous Laughter")).toBeNull();
    expect(
      rs.repeatBend(reg.REPEAT_SAVES["Dominate Person"], "damaged", "Dominate Person")
    ).toBeNull();
  });
  it("the verdict: a success ENDS a plain row; a failure keeps it", () => {
    const row = reg.REPEAT_SAVES["Hold Person"];
    expect(rs.repeatVerdict(row, "saved", null)).toEqual({
      ends: true,
      locks: false,
      press: null,
      tally: null,
      says: "Paralyzed ended — the save succeeded"
    });
    expect(rs.repeatVerdict(row, "failed", null)).toEqual({
      ends: false,
      locks: false,
      press: null,
      tally: null,
      says: "Paralyzed holds — the save failed"
    });
  });
  it("the counters: three successes end it, three failures lock (Contagion) or press (Flesh to Stone), the tally carried on the effect", () => {
    const contagion = reg.REPEAT_SAVES.Contagion;
    let v = rs.repeatVerdict(contagion, "saved", null);
    expect(v).toMatchObject({ ends: false, locks: false, tally: { saves: 1, fails: 0 } });
    expect(v.says).toBe("Infected (Strength) holds — 1 of 3 successes");
    v = rs.repeatVerdict(contagion, "saved", { saves: 2, fails: 1 });
    expect(v).toMatchObject({ ends: true, tally: { saves: 3, fails: 1 } });
    expect(v.says).toBe("Infected (Strength) ended — the third success");
    v = rs.repeatVerdict(contagion, "failed", { saves: 0, fails: 2 });
    expect(v).toMatchObject({
      ends: false,
      locks: true,
      press: null,
      tally: { saves: 0, fails: 3 }
    });
    expect(v.says).toBe("Infected (Strength) holds — the third failure: no more saves");
    const stone = reg.REPEAT_SAVES["Flesh to Stone"];
    v = rs.repeatVerdict(stone, "failed", { saves: 1, fails: 2 });
    expect(v).toMatchObject({
      ends: false,
      locks: true,
      press: "petrified",
      tally: { saves: 1, fails: 3 }
    });
    expect(v.says).toBe("Turning to Stone holds — the third failure: Petrified");
  });
  it("the float is the module's only where the platform draws none: an effect with no status and no change (Confused)", () => {
    expect(rs.needsFloat({ statuses: [], changes: [] })).toBe(true);
    expect(rs.needsFloat({ statuses: ["paralyzed"], changes: [] })).toBe(false);
    expect(rs.needsFloat({ statuses: [], changes: [{ key: "system.attributes.ac.bonus" }] })).toBe(
      false
    );
  });
  it("the words: the card's title names the effect, the bearer and the cause; an action offer says it costs the action", () => {
    expect(
      rs.repeatTitle({
        effectName: "Paralyzed",
        bearer: "Ogre",
        cause: "turnEnd",
        spell: "Hold Person"
      })
    ).toBe("Hold Person — Ogre repeats the save at the end of its turn");
    expect(
      rs.repeatTitle({
        effectName: "Dominated",
        bearer: "Ogre",
        cause: "damaged",
        spell: "Dominate Person"
      })
    ).toBe("Dominate Person — Ogre repeats the save: it took damage");
    expect(
      rs.repeatTitle({
        effectName: "Irresistible Dance",
        bearer: "Ogre",
        cause: "action",
        spell: "Otto's Irresistible Dance"
      })
    ).toBe("Otto's Irresistible Dance — Ogre may use its action to repeat the save");
  });
});

describe("decide/turn-grants.js — the turn-start grant", () => {
  const heroism = { name: "Heroism", type: "spell", system: { identifier: "heroism" } };
  it("a row is found by the effect's origin item and its name together", () => {
    expect(
      tg.grantRowFor({
        table: reg.TURN_GRANTS,
        answers: reg.answers,
        item: heroism,
        effectName: "Bravery"
      })?.key
    ).toBe("Heroism");
    expect(
      tg.grantRowFor({
        table: reg.TURN_GRANTS,
        answers: reg.answers,
        item: heroism,
        effectName: "Hopeful"
      })
    ).toBeNull();
    expect(
      tg.grantRowFor({
        table: reg.TURN_GRANTS,
        answers: reg.answers,
        item: { name: "Bless", type: "spell" },
        effectName: "Bravery"
      })
    ).toBeNull();
    expect(
      tg.grantRowFor({
        table: reg.TURN_GRANTS,
        answers: reg.answers,
        item: heroism,
        effectName: "Bravery",
        listed: new Set()
      })
    ).toBeNull();
  });
  it("the grant is due once per turn: the same place asked twice is paid once", () => {
    expect(tg.grantDue({ paid: new Set(), place: "c1|2|0" })).toEqual({
      due: true,
      why: "the start of its turn"
    });
    expect(tg.grantDue({ paid: new Set(["c1|2|0"]), place: "c1|2|0" }).due).toBe(false);
    expect(tg.grantDue({ paid: new Set(), place: null }).due).toBe(false);
  });
  it("the words: temporary Hit Points name the spell and the bearer", () => {
    expect(tg.grantTitle({ spell: "Heroism", bearer: "Gren", total: 4, type: "temphp" })).toBe(
      "Heroism — Gren gains 4 Temporary Hit Points"
    );
    expect(tg.grantTitle({ spell: "Heroism", bearer: "Gren", total: 1, type: "temphp" })).toBe(
      "Heroism — Gren gains 1 Temporary Hit Point"
    );
    expect(tg.grantTitle({ spell: "Aura", bearer: "Gren", total: 3, type: "healing" })).toBe(
      "Aura — Gren regains 3 Hit Points"
    );
  });
});

/* ================================================================================================
 * TIER 3 (2026-09-28, ruled off prototypes/spells-slice.html): the area kind, the wards, the duplicates.
 * ================================================================================================ */

describe("EMANATIONS — the `area` kind (Tier 3)", () => {
  it("`area` is a fourth emanation kind, counted by the tripwire; the placed areas are rows of it with Spirit Guardians' trigger to the word", () => {
    expect(reg.EMANATION_KINDS.has("area")).toBe(true);
    const sg = reg.EMANATIONS["Spirit Guardians"].trigger;
    for (const k of ["Moonbeam", "Insect Plague", "Cloudkill", "Cloud of Daggers"]) {
      const row = reg.EMANATIONS[k];
      expect(row, k).toBeDefined();
      expect(Object.isFrozen(row), k).toBe(true);
      expect(row.kind, k).toBe("area");
      // every creature — the caster too ("each creature in the Sphere")
      expect(row.reach, k).toBe("all");
      expect(row.effect, k).toBeNull();
      expect([...row.trigger.on], k).toEqual([...sg.on]);
      expect(row.trigger.oncePerTurn, k).toBe(true);
      expectPointer(row.rule, k);
      expect(row.rule.item, k).toBe(k);
      expect(
        reg.emanationEntries().map(e => e.kind),
        k
      ).toContain(k.toLowerCase());
    }
  });
  it("Flaming Sphere is a SUMMON: a feature ring of 5 feet around the sphere's own token, its `Flames` the save", () => {
    const row = reg.EMANATIONS["Flaming Sphere"];
    expect(row).toMatchObject({
      kind: "feature",
      item: "Flames",
      reach: "all",
      range: 5,
      effect: null
    });
    expect([...row.trigger.on]).toEqual(["enter", "turnEnd"]);
    expect(row.rule.item).toBe("Flaming Sphere");
  });
  it("Wall of Fire and Spike Growth are IN since the held spells (Tier 4): the wall as a banded area, the spikes on the `move` trigger", () => {
    expect(reg.EMANATIONS["Wall of Fire"].kind).toBe("area");
    expect(reg.EMANATIONS["Wall of Fire"].band).toEqual({
      feet: 10,
      ask: "Which side of the wall burns?"
    });
    expect(reg.EMANATIONS["Spike Growth"].kind).toBe("area");
    expect([...reg.EMANATIONS["Spike Growth"].trigger.on]).toEqual(["move"]);
  });
});

describe("Tier 4 — the held spells (RULINGS *The spells slice — the held spells*)", () => {
  /** @type {typeof import("../scripts/decide/damage-shares.js")} */
  let ds;
  /** @type {typeof import("../scripts/decide/heal-on-hit.js")} */
  let hh;
  /** @type {typeof import("../scripts/decide/prismatic.js")} */
  let pr;
  /** @type {typeof import("../scripts/decide/emanations.js")} */
  let em;
  beforeAll(async () => {
    ds = await import("../scripts/decide/damage-shares.js");
    hh = await import("../scripts/decide/heal-on-hit.js");
    pr = await import("../scripts/decide/prismatic.js");
    em = await import("../scripts/decide/emanations.js");
  });

  it("Warding Bond: the one DAMAGE_SHARES row — Bonded, the same amount, within 60 feet, ended at the caster's 0 HP; found by the effect and its origin", () => {
    expect(Object.keys(reg.DAMAGE_SHARES)).toEqual(["Warding Bond"]);
    const row = reg.DAMAGE_SHARES["Warding Bond"];
    expect(Object.isFrozen(row)).toBe(true);
    expect(row).toMatchObject({ effect: "Bonded", share: 1, within: 60, endsAt: "zeroHP" });
    expectPointer(row.rule);
    expect(reg.damageShareEntries()).toEqual([{ kind: "warding bond" }]);
    const bond = { name: "Warding Bond", type: "spell", system: { identifier: "warding-bond" } };
    expect(
      rs.repeatRowFor({
        table: reg.DAMAGE_SHARES,
        answers: reg.answers,
        item: bond,
        effectName: "Bonded"
      })?.key
    ).toBe("Warding Bond");
    expect(
      rs.repeatRowFor({
        table: reg.DAMAGE_SHARES,
        answers: reg.answers,
        item: bond,
        effectName: "Protected"
      })
    ).toBeNull();
  });
  it("the share's verdict: the same number within reach, nothing beyond 60 feet, nothing when the caster is down, an unmeasured distance counts as in reach", () => {
    const row = reg.DAMAGE_SHARES["Warding Bond"];
    expect(ds.shareVerdict(row, { amount: 9, distanceFeet: 30 })).toMatchObject({
      shares: true,
      amount: 9
    });
    expect(ds.shareVerdict(row, { amount: 9, distanceFeet: 65 })).toMatchObject({
      shares: false,
      amount: 0
    });
    expect(ds.shareVerdict(row, { amount: 9, distanceFeet: 65 }).why).toMatch(
      /beyond the bond's 60 feet/
    );
    expect(ds.shareVerdict(row, { amount: 9, distanceFeet: null })).toMatchObject({
      shares: true,
      amount: 9
    });
    expect(ds.shareVerdict(row, { amount: 9, casterHp: 0 })).toMatchObject({ shares: false });
    expect(ds.shareVerdict(row, { amount: 0 })).toMatchObject({ shares: false });
    expect(ds.shareVerdict({ share: 0.5 }, { amount: 7 })).toMatchObject({
      shares: true,
      amount: 3
    });
    expect(ds.shareEnds(row, { casterHp: 0 })).toMatchObject({ ends: true });
    expect(ds.shareEnds(row, { casterHp: 3 })).toMatchObject({ ends: false });
    expect(
      ds.shareTitle({ spell: "Warding Bond", bearer: "Gren", caster: "Ysolde", amount: 9 })
    ).toBe("Warding Bond — Ysolde takes 9 with Gren");
  });

  it("Vampiric Touch: the one HEAL_ON_HIT row — half the necrotic damage; the amount by the parts' proportion, floored", () => {
    expect(Object.keys(reg.HEAL_ON_HIT)).toEqual(["Vampiric Touch", "Dark One's Blessing"]);
    const row = reg.HEAL_ON_HIT["Vampiric Touch"];
    expect(row).toMatchObject({ share: 0.5, type: "necrotic" });
    expectPointer(row.rule);
    expect(reg.healOnHitEntries()).toEqual([
      { kind: "vampiric touch" },
      { kind: "dark one's blessing" }
    ]);
    expect(
      hh.healOnHitAmount(row, { taken: 11, parts: [{ value: 11, type: "necrotic" }] })
    ).toMatchObject({ heals: true, amount: 5 });
    // a rider of another type beside it: only the necrotic share heals
    expect(
      hh.healOnHitAmount(row, {
        taken: 20,
        parts: [
          { value: 10, type: "necrotic" },
          { value: 10, type: "fire" }
        ]
      })
    ).toMatchObject({ heals: true, amount: 5 });
    expect(
      hh.healOnHitAmount(row, { taken: 8, parts: [{ value: 8, type: "fire" }] })
    ).toMatchObject({ heals: false, amount: 0 });
    expect(hh.healOnHitAmount(row, { taken: 0, parts: [] })).toMatchObject({ heals: false });
    expect(
      hh.healOnHitAmount(row, { taken: 1, parts: [{ value: 1, type: "necrotic" }] })
    ).toMatchObject({ heals: false, amount: 0 });
    expect(
      hh.healOnHitTitle({
        spell: "Vampiric Touch",
        caster: "Ysolde",
        amount: 1,
        target: "a goblin"
      })
    ).toBe("Vampiric Touch — Ysolde regains 1 Hit Point from a goblin");
  });

  it("Prismatic Spray: the one RAY_TABLES row — a d8, the Cast, an 8 rolls twice; five damage rays, two condition rays with their own saves", () => {
    expect(Object.keys(reg.RAY_TABLES)).toEqual(["Prismatic Spray"]);
    const row = reg.RAY_TABLES["Prismatic Spray"];
    expect(row).toMatchObject({ die: 8, cast: "Cast", twice: 8 });
    expectPointer(row.rule);
    expect(reg.rayTableEntries()).toEqual([{ kind: "prismatic spray" }]);
    expect([1, 2, 3, 4, 5].map(f => row.rays[f].type)).toEqual([
      "fire",
      "acid",
      "lightning",
      "poison",
      "cold"
    ]);
    expect(row.rays[6]).toMatchObject({
      colour: "indigo",
      save: "Indigo Save (Con)",
      effect: "Petrifying (Indigo)"
    });
    expect(row.rays[7]).toMatchObject({
      colour: "violet",
      save: "Violet Save (Wis)",
      effect: "Teleporting (Violet)"
    });
    expect(row.rays[8].twice).toBe(true);
  });
  it("the draw: one face is one ray; an 8 is two more draws, never a ray itself; a die stuck on 8 is cut", () => {
    const row = reg.RAY_TABLES["Prismatic Spray"];
    const feed = faces => {
      let i = 0;
      return () => faces[i++] ?? 8;
    };
    expect(pr.raysFor(row, feed([3])).rays.map(r => r.colour)).toEqual(["yellow"]);
    const two = pr.raysFor(row, feed([8, 1, 6]));
    expect(two.rays.map(r => r.colour)).toEqual(["red", "indigo"]);
    expect(two.faces).toEqual([8, 1, 6]);
    const three = pr.raysFor(row, feed([8, 8, 2, 5, 7]));
    expect(three.rays.map(r => r.colour)).toEqual(["orange", "blue", "violet"]);
    const stuck = pr.raysFor(row, () => 8, { cap: 5 });
    expect(stuck.rays).toEqual([]);
    expect(stuck.faces).toHaveLength(5);
  });
  it("the words and the verdict: a damage ray's demand names its type; a condition ray lands its effect on a failure only", () => {
    const red = { face: 1, colour: "red", type: "fire" };
    const indigo = {
      face: 6,
      colour: "indigo",
      type: null,
      save: "Indigo Save (Con)",
      effect: "Petrifying (Indigo)",
      words: "Restrained"
    };
    expect(
      pr.rayWords({ spell: "Prismatic Spray", ray: red, target: "a goblin", caster: "Ysolde" })
    ).toMatchObject({
      title: "Prismatic Spray — the red ray strikes a goblin",
      eyebrow: "Ysolde's Prismatic Spray"
    });
    expect(
      pr.rayWords({ spell: "Prismatic Spray", ray: red, target: "a goblin" }).subtitle
    ).toMatch(/Fire damage · Dexterity save/);
    expect(
      pr.rayWords({ spell: "Prismatic Spray", ray: indigo, target: "a goblin" }).subtitle
    ).toBe("Restrained");
    expect(pr.rayVerdict(red, "saved")).toEqual({ lands: null, says: "half the fire damage" });
    expect(pr.rayVerdict(indigo, "failed")).toEqual({
      lands: "Petrifying (Indigo)",
      says: "Petrifying (Indigo) lands — the save failed"
    });
    expect(pr.rayVerdict(indigo, "saved").lands).toBeNull();
    expect(
      pr.raySummaryLines([{ name: "a goblin", faces: [8, 1, 6], rays: [red, indigo] }])
    ).toEqual(["a goblin: d8 → 8, 1, 6 — red (fire) and indigo"]);
  });
  it("the indigo ray's repeat is a second REPEAT_SAVES row on the spell: found by the Petrifying effect with the spell as its origin, its own named save, Flesh to Stone's count", () => {
    const row = reg.REPEAT_SAVES["Prismatic Spray (Indigo)"];
    expect(row).toMatchObject({
      item: "Prismatic Spray",
      effect: "Petrifying (Indigo)",
      activity: "Indigo Save (Con)"
    });
    expect(row.count).toEqual({ saves: 3, fails: 3, press: "petrified" });
    const spray = {
      name: "Prismatic Spray",
      type: "spell",
      system: { identifier: "prismatic-spray" }
    };
    expect(
      rs.repeatRowFor({
        table: reg.REPEAT_SAVES,
        answers: reg.answers,
        item: spray,
        effectName: "Petrifying (Indigo)"
      })?.key
    ).toBe("Prismatic Spray (Indigo)");
    // the violet ray is NOT a row: its save is at the caster's next turn start, when the pack's own clock ends the Blinded
    expect(Object.keys(reg.REPEAT_SAVES).filter(k => /Violet/.test(k))).toEqual([]);
  });

  it("the placed areas of Tier 4: Wall of Fire (a save area with a band), Spike Growth (the move trigger, per 5 feet), Magic Circle (no cast save, the types ask, the gate, the entry notice), Forcecage (the exit notice)", () => {
    for (const k of ["Wall of Fire", "Spike Growth", "Magic Circle", "Forcecage"]) {
      const row = reg.EMANATIONS[k];
      expect(row, k).toBeDefined();
      expect(Object.isFrozen(row), k).toBe(true);
      expect(row.kind, k).toBe("area");
      expect(row.reach, k).toBe("all");
      expect(row.effect, k).toBeNull();
      expectPointer(row.rule, k);
      expect(row.rule.item, k).toBe(k);
      expect(
        reg.emanationEntries().map(e => e.kind),
        k
      ).toContain(k.toLowerCase());
    }
    expect([...reg.EMANATIONS["Wall of Fire"].trigger.on]).toEqual(["enter", "turnEnd"]);
    expect(reg.EMANATIONS["Spike Growth"].trigger.per).toBe(5);
    const circle = reg.EMANATIONS["Magic Circle"];
    expect(circle.noCastSave).toBe(true);
    expect(circle.ask).toMatchObject({ what: "types" });
    expect([...circle.ask.options]).toEqual(["celestial", "elemental", "fey", "fiend", "undead"]);
    expect(circle.gate).toEqual({ attacker: "disadvantage", types: "chosen" });
    expect(circle.alert).toMatchObject({ on: "moveIn", kind: "notice", types: "chosen" });
    expect(reg.EMANATIONS.Forcecage.alert).toMatchObject({ on: "moveOut", kind: "notice" });
    expect(reg.EMANATIONS.Forcecage.trigger).toBeUndefined();
    // the R4 tripwire did not move: every facet is vocabulary on the `area` kind
    expect(reg.EMANATION_KINDS.size).toBe(3);
  });
  it("the band (decide/emanations.js): a line's width grows by the band and its centreline shifts half of it to the side; the far side from the caster is the default; the ring burns outside as a ring, inside as the disc", () => {
    const line = { type: "line", x: 100, y: 100, length: 300, width: 10, rotation: 0 }; // east-west wall
    const plus = em.bandShape(line, 1, 40);
    expect(plus).toMatchObject({ type: "line", x: 100, width: 50, length: 300 });
    expect(plus.y).toBeCloseTo(120); // rotation 0 → the plus side is +y (south)
    const minus = em.bandShape(line, -1, 40);
    expect(minus.y).toBeCloseTo(80);
    expect(em.wallSides(line)).toEqual({ plus: "south", minus: "north" });
    expect(em.compassName(0)).toBe("east");
    expect(em.compassName(-90)).toBe("north");
    expect(em.compassName(225)).toBe("north-west");
    // a caster north of the wall: the far side is south (+1); south of it: north (−1)
    expect(em.awaySide(line, { x: 250, y: 0 })).toBe(1);
    expect(em.awaySide(line, { x: 250, y: 300 })).toBe(-1);
    expect(em.awaySide(line, null)).toBe(1);
    const circle = { type: "circle", x: 0, y: 0, radius: 100 };
    expect(em.bandShape(circle, 1, 40)).toMatchObject({
      type: "ring",
      radius: 100,
      innerWidth: 0,
      outerWidth: 40
    });
    expect(em.bandShape(circle, -1, 40)).toMatchObject({ type: "circle", radius: 100 });
    expect(
      em.bandShape({ type: "ring", x: 0, y: 0, radius: 100, innerWidth: 0, outerWidth: 40 }, -1, 40)
    ).toMatchObject({ type: "circle", radius: 100 });
    expect(em.bandOptions(line).map(o => o.label)).toEqual(["the south side", "the north side"]);
    expect(em.bandOptions(circle).map(o => o.side)).toEqual([1, -1]);
    expect(em.bandShape(line, 1, 0)).toEqual(line);
  });
  it("the ask and the gate: every type on by default; a creature's type read off the sheet; the circle bends only a chosen type attacking a target inside", () => {
    const circle = { key: "Magic Circle", ...reg.EMANATIONS["Magic Circle"] };
    expect(em.askDefaults(circle.ask)).toEqual([
      "celestial",
      "elemental",
      "fey",
      "fiend",
      "undead"
    ]);
    expect(em.creatureTypeOf({ value: "fiend" })).toBe("fiend");
    expect(em.creatureTypeOf({ value: "custom", custom: "Fey Lord" })).toBe("fey lord");
    expect(em.creatureTypeOf(null)).toBeNull();
    expect(em.typeAdmits(circle.alert, ["fiend"], "fiend")).toBe(true);
    expect(em.typeAdmits(circle.alert, ["fiend"], "humanoid")).toBe(false);
    expect(em.typeAdmits({ on: "moveOut" }, [], "humanoid")).toBe(true);
    const bend = em.circleBend(circle, {
      attackerType: "undead",
      picked: ["undead"],
      targetInside: true
    });
    expect(bend).toEqual({
      bend: "disadvantage",
      label: "Magic Circle — an undead attacking into the circle"
    });
    expect(
      em.circleBend(circle, { attackerType: "undead", picked: ["fiend"], targetInside: true })
    ).toBeNull();
    expect(
      em.circleBend(circle, { attackerType: "undead", picked: ["undead"], targetInside: false })
    ).toBeNull();
    expect(
      em.circleBend(
        { key: "Moonbeam", ...reg.EMANATIONS.Moonbeam },
        { attackerType: "undead", picked: [], targetInside: true }
      )
    ).toBeNull();
  });
  it("the move's payout (Spike Growth): floor(feet / 5) times the dice, one roll; under 5 feet nothing", () => {
    const parts = [{ number: 2, denomination: 4, bonus: "", type: "piercing" }];
    expect(em.movePayout({ per: 5 }, { feet: 15, parts })).toMatchObject({
      steps: 3,
      formula: "6d4",
      type: "piercing"
    });
    expect(em.movePayout({ per: 5 }, { feet: 4, parts })).toMatchObject({
      steps: 0,
      formula: null
    });
    expect(
      em.movePayout({ per: 5 }, { feet: 10, parts: [{ number: 1, denomination: 6, bonus: "2" }] })
        .formula
    ).toBe("2d6 + 2 * (2)");
    expect(em.movePayout({}, { feet: 5, parts: [] })).toMatchObject({ steps: 1, formula: null });
  });
});

describe("WARDS — the table and decide/wards.js (Tier 3)", () => {
  it("Sanctuary: the Warded effect, its own Save on Target, both gates, the three ends; frozen, pointed", () => {
    const row = reg.WARDS.Sanctuary;
    expect(Object.isFrozen(row)).toBe(true);
    expect(row).toMatchObject({ effect: "Warded", activity: "Save on Target" });
    expect([...row.gates]).toEqual(["attack", "damagingSpell"]);
    expect([...row.endsOn]).toEqual(["attack", "spell", "damage"]);
    expectPointer(row.rule);
    expect(row.rule.item).toBe("Sanctuary");
    expect(reg.wardEntries().map(e => e.kind)).toEqual(["sanctuary"]);
  });
  it("the row an effect answers is the repeat's matcher: Warded from Sanctuary, never a Warded from elsewhere", () => {
    const answers = (key, item) => item?.name === key;
    expect(
      rs.repeatRowFor({
        table: reg.WARDS,
        item: { name: "Sanctuary" },
        effectName: "Warded",
        answers
      })?.key
    ).toBe("Sanctuary");
    expect(
      rs.repeatRowFor({
        table: reg.WARDS,
        item: { name: "Shield of Faith" },
        effectName: "Warded",
        answers
      })
    ).toBeNull();
    expect(
      rs.repeatRowFor({
        table: reg.WARDS,
        item: { name: "Sanctuary" },
        effectName: "Blessed",
        answers
      })
    ).toBeNull();
  });
  it("the gate: every attack roll at the ward; a damaging spell only at its cast, never an area, never an attack-type spell there", () => {
    const row = reg.WARDS.Sanctuary;
    expect(
      w.wardGateFor(row, {
        seam: "attack",
        activityType: "attack",
        itemType: "weapon",
        hasDamage: true,
        hasTemplate: false
      })
    ).toBe("attack");
    expect(
      w.wardGateFor(row, {
        seam: "attack",
        activityType: "attack",
        itemType: "spell",
        hasDamage: true,
        hasTemplate: false
      })
    ).toBe("attack");
    expect(
      w.wardGateFor(row, {
        seam: "use",
        activityType: "save",
        itemType: "spell",
        hasDamage: true,
        hasTemplate: false
      })
    ).toBe("damagingSpell");
    // Fire Bolt's use is not gated (its roll is); Hold Person deals no damage; Fireball is an area
    expect(
      w.wardGateFor(row, {
        seam: "use",
        activityType: "attack",
        itemType: "spell",
        hasDamage: true,
        hasTemplate: false
      })
    ).toBeNull();
    expect(
      w.wardGateFor(row, {
        seam: "use",
        activityType: "save",
        itemType: "spell",
        hasDamage: false,
        hasTemplate: false
      })
    ).toBeNull();
    expect(
      w.wardGateFor(row, {
        seam: "use",
        activityType: "save",
        itemType: "spell",
        hasDamage: true,
        hasTemplate: true
      })
    ).toBeNull();
    // a weapon's use is not gated at the cast either
    expect(
      w.wardGateFor(row, {
        seam: "use",
        activityType: "attack",
        itemType: "weapon",
        hasDamage: true,
        hasTemplate: false
      })
    ).toBeNull();
  });
  it("the end: the bearer's attack roll, any cast (a heal, a cantrip), a damage roll — never its own cast", () => {
    const row = reg.WARDS.Sanctuary;
    expect(w.wardEnds(row, "attack").ends).toBe(true);
    expect(w.wardEnds(row, "spell").ends).toBe(true);
    expect(w.wardEnds(row, "damage")).toEqual({ ends: true, why: "dealt damage" });
    expect(w.wardEnds(row, "spell", { ownItem: true })).toEqual({
      ends: false,
      why: "its own cast"
    });
    expect(w.wardEnds({ endsOn: ["attack"] }, "spell").ends).toBe(false);
  });
  it("the verdict: a success lets the use through, a failure turns it aside; the words name the thing", () => {
    expect(w.wardVerdict("saved", "attack")).toEqual({
      through: true,
      says: "the save passed — the attack goes on"
    });
    expect(w.wardVerdict("failed", "damagingSpell")).toEqual({
      through: false,
      says: "the save failed — the spell is turned aside"
    });
    const words = w.wardWords({
      spell: "Sanctuary",
      attacker: "Bugbear",
      ward: "Ally",
      gate: "attack",
      what: "Morningstar"
    });
    expect(words.title).toBe("Sanctuary — a save before the attack");
    expect(words.subtitle).toContain("Bugbear → Ally · Morningstar");
    expect(words.failed).toMatch(/^No attack roll\. Choose a new target, or the attack is lost\.$/);
  });
});

describe("DUPLICATES — the table and decide/duplicates.js (Tier 3)", () => {
  it("Mirror Image is the 2024 shape: a d6 per duplicate, a 3 or higher redirects; Blinded, Blindsight and Truesight see through", () => {
    const row = reg.DUPLICATES["Mirror Image"];
    expect(Object.isFrozen(row)).toBe(true);
    expect([...row.effect]).toEqual(["Duplicate A", "Duplicate B", "Duplicate C"]);
    expect(row).toMatchObject({ die: 6, at: 3 });
    expect([...row.seesThrough.statuses]).toEqual(["blinded"]);
    expect([...row.seesThrough.senses]).toEqual(["blindsight", "truesight"]);
    expectPointer(row.rule);
    expect(reg.duplicateEntries().map(e => e.kind)).toEqual([
      "mirror image",
      "reflective carapace"
    ]);
  });
  it("the standing duplicates are the row's effects on the sheet, in the row's order — the last is the one destroyed", () => {
    const row = reg.DUPLICATES["Mirror Image"];
    const standing = dup.standingDuplicates(row, [
      { id: "c", name: "Duplicate C" },
      { id: "x", name: "Blessed" },
      { id: "a", name: "Duplicate A" },
      { id: "b", name: "Duplicate B", active: false }
    ]);
    expect(standing.map(e => e.id)).toEqual(["a", "c"]);
  });
  it("who sees through: a status on the attacker, or a sense with range; a plain attacker does not", () => {
    const row = reg.DUPLICATES["Mirror Image"];
    expect(dup.seesThrough(row, { statuses: ["blinded"], senses: {} })).toEqual({
      through: true,
      why: "the Blinded condition"
    });
    expect(dup.seesThrough(row, { statuses: [], senses: { blindsight: 60 } })).toEqual({
      through: true,
      why: "Blindsight"
    });
    expect(
      dup.seesThrough(row, { statuses: [], senses: { truesight: 10, blindsight: 0 } }).why
    ).toBe("Truesight");
    expect(
      dup.seesThrough(row, { statuses: ["prone"], senses: { darkvision: 60, blindsight: 0 } })
    ).toEqual({ through: false, why: null });
  });
  it("the roll: any face at 3 or higher redirects the hit — the FIRST such face is the gold one; every face under 3 lets it through", () => {
    expect(dup.duplicateOutcome({ at: 3 }, [1, 4, 2])).toEqual({
      absorbed: true,
      winner: 1,
      faces: [1, 4, 2]
    });
    expect(dup.duplicateOutcome({ at: 3 }, [1, 2, 1])).toEqual({
      absorbed: false,
      winner: null,
      faces: [1, 2, 1]
    });
    expect(dup.duplicateOutcome({ at: 3 }, [5])).toEqual({ absorbed: true, winner: 0, faces: [5] });
    expect(dup.duplicateOutcome({ at: 3 }, []).absorbed).toBe(false);
  });
  it("the chips: every face, the winner gold", () => {
    expect(dup.duplicateChips(dup.duplicateOutcome({ at: 3 }, [1, 4, 2]))).toEqual([
      { label: "1" },
      { label: "4", up: true },
      { label: "2" }
    ]);
    expect(dup.duplicateChips(dup.duplicateOutcome({ at: 3 }, [1, 2]))).toEqual([
      { label: "1" },
      { label: "2" }
    ]);
  });
  it("the words: a duplicate takes the hit and the count stands; the last one ends the spell; a hit gets through", () => {
    const row = { key: "Mirror Image", die: 6, at: 3 };
    const took = dup.duplicateWords(row, dup.duplicateOutcome(row, [1, 4, 2]), {
      took: "Duplicate C",
      left: 2,
      of: 3
    });
    expect(took.title).toBe("A duplicate takes the hit");
    expect(took.dice).toContain("3d6 → 1, <strong>4</strong>, 2");
    expect(took.count).toBe("duplicates: 2 of 3 left");
    const last = dup.duplicateWords(row, dup.duplicateOutcome(row, [5]), {
      took: "Duplicate A",
      left: 0,
      of: 3
    });
    expect(last.title).toBe("The last duplicate takes the hit");
    expect(last.count).toContain("Mirror Image ended");
    const through = dup.duplicateWords(row, dup.duplicateOutcome(row, [1, 2, 1]), {
      took: null,
      left: 3,
      of: 3
    });
    expect(through.title).toBe("The hit gets through");
    expect(through.dice).toContain("you are hit");
  });
  it("an absorbed hit is a FORCED verdict on the attack (decide/verdict.js): the applier drops the target whatever the AC it was judged against", () => {
    const flag = {
      targets: [
        { uuid: "t1", verdict: "absorbed", acAtVerdict: 13 },
        { uuid: "t2", verdict: "hit", acAtVerdict: 13 }
      ]
    };
    const folds = v.foldsFrom(key => (key === "hold" ? flag : null));
    const roll = { total: 19, isCritical: false, isFumble: false };
    expect(v.foldedVerdict({ uuid: "t1", ac: 13 }, roll, folds)).toBe("absorbed");
    expect(v.foldedVerdict({ uuid: "t2", ac: 13 }, roll, folds)).toBe("hit");
    expect(
      v
        .hitsAmong({
          targets: [
            { uuid: "t1", ac: 13 },
            { uuid: "t2", ac: 13 }
          ],
          roll,
          folds
        })
        .map(t => t.uuid)
    ).toEqual(["t2"]);
  });
});
