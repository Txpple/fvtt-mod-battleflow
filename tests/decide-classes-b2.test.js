import { describe, expect, it } from "vitest";
import * as reg from "../scripts/decide/registry.js";
import * as r from "../scripts/decide/reminders.js";
import { CHIP_WINDOWS } from "../scripts/decide/chips.js";
import { interruptMultiplier } from "../scripts/decide/verdict.js";

/* The PHB classes — B2: the save bends by name (RULINGS *The PHB classes — B2*, 2026-09-30). */

const expectPointer = (rule, name = "") => {
  expect(rule, name).toBeTruthy();
  expect(typeof rule.item, name).toBe("string");
  expect(rule.uuid, name).toMatch(/^Compendium\./);
};

describe("B2 — the rows", () => {
  it("Psychic Defenses and Beguiling Twist are Brave's shape: a feature row, Advantage against Charmed and Frightened", () => {
    for (const key of ["Psychic Defenses", "Beguiling Twist"]) {
      const row = reg.EFFECT_BENDS[key];
      expect(row, key).toMatchObject({ match: "feature", attacker: null, target: null });
      expect(row.saves.bend, key).toBe("advantage");
      expect([...row.saves.statuses], key).toEqual(["charmed", "frightened"]);
      expectPointer(row.rule, key);
    }
  });
  it("Magical Ambush and Mantle of Majesty are CASTER-side rows; Mantle is the pack's Unearthly Appearance and FAILS a Command at a creature the bard Charmed", () => {
    expect(reg.EFFECT_BENDS["Magical Ambush"]).toMatchObject({ match: "feature", side: "caster" });
    expect(reg.EFFECT_BENDS["Magical Ambush"].saves).toMatchObject({
      bend: "disadvantage",
      spells: true,
      sourceStatus: "invisible"
    });
    const mantle = reg.EFFECT_BENDS["Mantle of Majesty"];
    expect(mantle).toMatchObject({ side: "caster", named: "Unearthly Appearance" });
    expect(mantle.match).toBeUndefined();
    expect(mantle.saves).toMatchObject({ fails: true, item: "Command", charmedBy: "source" });
    expect(mantle.saves.bend).toBeUndefined();
  });
  it("Struck (Eldritch Strike): Disadvantage against a spell of its SOURCE, spent by that save; the clock rider lands it on any weapon hit for the vex window", () => {
    expect(reg.EFFECT_BENDS.Struck).toMatchObject({ spend: "save" });
    expect(reg.EFFECT_BENDS.Struck.saves).toMatchObject({ bend: "disadvantage", spells: "source" });
    const rider = reg.CLOCK_RIDERS["eldritch-strike"];
    expect(rider).toMatchObject({
      feature: "Eldritch Strike",
      activity: null,
      when: "any",
      weapon: true,
      clock: "vex"
    });
    expect(rider.lands).toMatchObject({ name: "Struck", from: "Struck" });
    expect(Object.keys(CHIP_WINDOWS)).toContain(rider.clock);
    expect(CHIP_WINDOWS[rider.clock]).toMatchObject({
      value: 1,
      units: "rounds",
      expiry: "turnEnd"
    });
  });
  it("the six Hexed rows (Eldritch Hex): one ability each, Disadvantage only where the effect's source holds the feature", () => {
    const rows = Object.entries(reg.EFFECT_BENDS).filter(([k]) => k.startsWith("Hexed "));
    expect(rows.map(([k]) => k)).toEqual([
      "Hexed Strength",
      "Hexed Dexterity",
      "Hexed Constitution",
      "Hexed Intelligence",
      "Hexed Wisdom",
      "Hexed Charisma"
    ]);
    expect(rows.map(([, row]) => row.saves.abilities[0])).toEqual([
      "str",
      "dex",
      "con",
      "int",
      "wis",
      "cha"
    ]);
    for (const [k, row] of rows) {
      expect(row.saves, k).toMatchObject({ bend: "disadvantage", sourceFeature: "Eldritch Hex" });
      expect(row.rule.item, k).toBe("Eldritch Hex");
    }
  });
  it("Beguiling Twist's Reaction is a bystander row (the twist: on a SUCCESS, any side, 120 ft, the Save activity) and its press lands the ranger's word for a minute", () => {
    const row = reg.INTERRUPT_ROLLS["Beguiling Twist"];
    expect(row).toMatchObject({
      reaction: true,
      uses: false,
      activity: "Save",
      bystander: 120,
      bend: "twist"
    });
    expect([...row.tests]).toEqual(["save"]);
    expect([...row.against]).toEqual(["charmed", "frightened"]);
    expect(reg.INTERRUPTS.find(x => x.name === "Beguiling Twist")?.kind).toBe("roll");
    const press = reg.SAVE_PRESSES["Beguiling Twist"];
    expect(press).toMatchObject({ status: "frightened", onFail: true });
    expect(press.lasts).toEqual({ rounds: 10, seconds: 60 });
    expect([...press.word.options]).toEqual(["Charmed", "Frightened"]);
    expect(press.word.statuses).toEqual({ Charmed: "charmed", Frightened: "frightened" });
    expect(press.word.options).toContain(press.word.default);
  });
  it("Beguiling Defenses: a damage interrupt that halves, spends the item's use, aims the cast at the attacker and carries the failure's psychic damage", () => {
    const row = reg.INTERRUPT_MULTIPLIERS["Beguiling Defenses"];
    expect(row).toMatchObject({ multiplier: 0.5, uses: true, at: "attacker" });
    expect(row.failDamage).toEqual({ type: "psychic", equalTo: "taken" });
    expect(reg.INTERRUPTS.find(x => x.name === "Beguiling Defenses")?.kind).toBe("damage");
    expect(
      interruptMultiplier(
        { answer: "cast", kind: "damage", reaction: "Beguiling Defenses" },
        reg.INTERRUPT_MULTIPLIERS
      )
    ).toMatchObject({ multiplier: 0.5, reaction: "Beguiling Defenses" });
    expectPointer(row.rule);
  });
});

describe("B2 — the save gate's new facets (effectSaveSources)", () => {
  const facts = () => ({
    enabled: Object.keys(reg.EFFECT_BENDS),
    table: reg.EFFECT_BENDS,
    name: "Gren"
  });
  const bard = {
    uuid: "Actor.bard",
    name: "Salyth",
    effects: [{ id: "ua", name: "Unearthly Appearance" }],
    features: [],
    statuses: []
  };

  it("Psychic Defenses on the sheet: Advantage against a demand that would charm; nothing against a poisoning one", () => {
    const out = r.effectSaveSources({
      ...facts(),
      features: ["Psychic Defenses"],
      demand: { spell: true, statuses: ["charmed"] }
    });
    expect(out.map(s => [s.bend, s.label])).toEqual([
      ["advantage", "Gren — Psychic Defenses — against Charmed"]
    ]);
    expect(
      r.effectSaveSources({
        ...facts(),
        features: ["Psychic Defenses"],
        demand: { spell: true, statuses: ["poisoned"] }
      })
    ).toEqual([]);
  });

  it("Mantle of Majesty: the bard's Unearthly Appearance (the demand's caster), a Command, the roller Charmed BY the bard — the save cannot succeed", () => {
    const charmedByBard = {
      id: "c1",
      name: "Charmed",
      statuses: ["charmed"],
      sourceUuid: "Actor.bard"
    };
    const out = r.effectSaveSources({
      ...facts(),
      effects: [charmedByBard],
      demand: { spell: true, statuses: [], item: "Command", source: bard }
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ autoFail: true, statusName: "Mantle of Majesty", bend: null });
    expect(out[0].label).toBe(
      "Salyth — Mantle of Majesty: this save cannot succeed — Command, Gren Charmed by Salyth"
    );
  });
  it("…and nothing when the spell is not Command, the Charmed is another's, the bard wears no mantle, or there is no demand", () => {
    const charmedByBard = {
      id: "c1",
      name: "Charmed",
      statuses: ["charmed"],
      sourceUuid: "Actor.bard"
    };
    const charmedByHag = {
      id: "c2",
      name: "Charmed",
      statuses: ["charmed"],
      sourceUuid: "Actor.hag"
    };
    const only = out => out.filter(s => /Mantle/.test(s.label));
    expect(
      only(
        r.effectSaveSources({
          ...facts(),
          effects: [charmedByBard],
          demand: { spell: true, statuses: [], item: "Hold Person", source: bard }
        })
      )
    ).toEqual([]);
    expect(
      only(
        r.effectSaveSources({
          ...facts(),
          effects: [charmedByHag],
          demand: { spell: true, statuses: [], item: "Command", source: bard }
        })
      )
    ).toEqual([]);
    expect(
      only(
        r.effectSaveSources({
          ...facts(),
          effects: [charmedByBard],
          demand: { spell: true, statuses: [], item: "Command", source: { ...bard, effects: [] } }
        })
      )
    ).toEqual([]);
    expect(
      only(r.effectSaveSources({ ...facts(), effects: [charmedByBard], demand: null }))
    ).toEqual([]);
  });

  it("Magical Ambush: the caster holds the feature and was Invisible as it cast — Disadvantage against its spell; visible, nothing; a non-spell, nothing", () => {
    const rogue = {
      uuid: "Actor.rogue",
      name: "Vex",
      effects: [],
      features: ["Magical Ambush"],
      statuses: ["invisible"]
    };
    const out = r.effectSaveSources({
      ...facts(),
      demand: { spell: true, statuses: [], source: rogue }
    });
    expect(out.map(s => [s.bend, s.label])).toEqual([
      ["disadvantage", "Vex — Magical Ambush — against a spell, Vex Invisible as it cast"]
    ]);
    expect(
      r.effectSaveSources({
        ...facts(),
        demand: { spell: true, statuses: [], source: { ...rogue, statuses: [] } }
      })
    ).toEqual([]);
    expect(
      r.effectSaveSources({ ...facts(), demand: { spell: false, statuses: [], source: rogue } })
    ).toEqual([]);
  });

  it("Struck: Disadvantage against a spell of the fighter who struck (the effect's source), spent by the save; another caster's spell, nothing", () => {
    const struck = { id: "s1", name: "Struck", statuses: [], sourceUuid: "Actor.fighter" };
    const fighter = {
      uuid: "Actor.fighter",
      name: "Morgash",
      effects: [],
      features: [],
      statuses: []
    };
    const out = r.effectSaveSources({
      ...facts(),
      effects: [struck],
      demand: { spell: true, statuses: [], source: fighter }
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      bend: "disadvantage",
      effectId: "s1",
      spend: "save",
      label: "Gren — Struck — against Morgash's spell"
    });
    expect(
      r.effectSaveSources({
        ...facts(),
        effects: [struck],
        demand: { spell: true, statuses: [], source: { ...fighter, uuid: "Actor.other" } }
      })
    ).toEqual([]);
    expect(
      r.effectSaveSources({
        ...facts(),
        effects: [struck],
        demand: { spell: false, statuses: [], source: fighter }
      })
    ).toEqual([]);
  });
  it("…and with no demand Struck is listed, uncounted", () => {
    const out = r.effectSaveSources({
      ...facts(),
      effects: [{ id: "s1", name: "Struck", statuses: [], sourceUuid: "Actor.fighter" }],
      demand: null
    });
    expect(out.map(s => s.bend)).toEqual([null]);
    expect(out[0].label).toMatch(
      /^Gren — Struck \(listed — a save against a spell or other magical effect/
    );
  });

  it("Hexed Dexterity by a warlock holding Eldritch Hex: Disadvantage on a Dexterity save, nothing on a Wisdom one; another warlock's Hex, nothing", () => {
    const hexed = {
      id: "h1",
      name: "Hexed Dexterity",
      statuses: ["cursed"],
      sourceUuid: "Actor.warlock",
      sourceHas: ["Eldritch Hex"]
    };
    const dex = r.effectSaveSources({
      ...facts(),
      effects: [hexed],
      demand: { spell: false, statuses: [], abilities: ["dex"] }
    });
    expect(dex.map(s => [s.bend, s.label, s.effectId])).toEqual([
      ["disadvantage", "Gren — Hexed Dexterity — a Dexterity save", "h1"]
    ]);
    expect(
      r.effectSaveSources({
        ...facts(),
        effects: [hexed],
        demand: { spell: false, statuses: [], abilities: ["wis"] }
      })
    ).toEqual([]);
    expect(
      r.effectSaveSources({
        ...facts(),
        effects: [{ ...hexed, sourceHas: [] }],
        demand: { spell: false, statuses: [], abilities: ["dex"] }
      })
    ).toEqual([]);
  });

  it("a `fails` source wins the gate: net fails, the Fails button the default", () => {
    const charmedByBard = {
      id: "c1",
      name: "Charmed",
      statuses: ["charmed"],
      sourceUuid: "Actor.bard"
    };
    const sources = r.effectSaveSources({
      ...facts(),
      effects: [charmedByBard],
      features: ["Psychic Defenses"],
      demand: { spell: true, statuses: ["charmed"], item: "Command", source: bard }
    });
    const gate = r.saveGate(sources);
    expect(gate.autoFail).toBe(true);
    expect(gate.net).toBe("fails");
  });
});
