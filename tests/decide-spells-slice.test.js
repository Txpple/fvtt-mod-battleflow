import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: the spells slice (HANDOFF.md, 2026-09-28; the drawing audits/drawings/spells.md) —
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
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  r = await import("../scripts/decide/reminders.js");
  d = await import("../scripts/decide/damage-dice.js");
  rs = await import("../scripts/decide/repeat-saves.js");
  tg = await import("../scripts/decide/turn-grants.js");
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
    expect(Object.keys(reg.EFFECT_BENDS).filter(k => reg.EFFECT_BENDS[k].saves?.abilities)).toEqual(
      ["Irresistible Dance"]
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
    ).toEqual(["beacon of hope", "healer"]);
    expectPointer(row.rule);
  });
  it("Heroism: the one turn-start grant — Bravery on the bearer, the spell's Heal activity rolled again on the caster", () => {
    expect(Object.keys(reg.TURN_GRANTS)).toEqual(["Heroism"]);
    const row = reg.TURN_GRANTS.Heroism;
    expect(Object.isFrozen(row)).toBe(true);
    expect(row).toMatchObject({ effect: "Bravery", activity: "Heal", on: "turnStart" });
    expect(reg.turnGrantEntries()).toEqual([{ kind: "heroism" }]);
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
      expect(row.rule.item, key).toBe(key);
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
    ).toEqual(["Contagion", "Flesh to Stone"]);
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
