import { describe, expect, it } from "vitest";
import * as reg from "../scripts/decide/registry.js";
import * as r from "../scripts/decide/reminders.js";
import * as h from "../scripts/decide/hit-menu.js";

/* The PHB classes — B3: Brutal Strike, Studied Attacks, Relentless (RULINGS *The PHB classes — B3*, 2026-09-30). */

const expectPointer = (rule, name = "") => {
  expect(rule, name).toBeTruthy();
  expect(typeof rule.item, name).toBe("string");
  expect(rule.uuid, name).toMatch(/^Compendium\./);
};

describe("B3 — the rows", () => {
  it("Brutal Strike is a FORGO row of the advantage buys: the tick gives the Advantage up on a Strength attack, spends nothing", () => {
    const row = reg.ADVANTAGE_BUYS["Brutal Strike"];
    expect(row).toMatchObject({ forgo: true, ability: "str", uses: false, point: null });
    expect([...row.tests]).toEqual(["attack"]);
    expectPointer(row.rule);
  });
  it("the Brutal Strike hit group: free, its own die, one pick, opened only by a forgone attack; four blows, Improved's two riding the same die", () => {
    const g = reg.HIT_GROUPS["brutal-strike"];
    expect(g).toMatchObject({ feature: "Brutal Strike", pool: "free", ownDice: true, max: 1 });
    expect(g.requires).toEqual({ forgo: "Brutal Strike" });
    expect(reg.HIT_OPTIONS["forceful-blow"]).toMatchObject({
      feature: "Brutal Strike",
      group: "brutal-strike",
      weapon: true
    });
    expect(reg.HIT_OPTIONS["forceful-blow"].line).toMatch(/pushed 15 feet/);
    expect(reg.HIT_OPTIONS["hamstring-blow"]).toMatchObject({
      feature: "Brutal Strike",
      effects: true,
      clock: "slow"
    });
    expect(reg.HIT_OPTIONS["staggering-blow"]).toMatchObject({
      feature: "Improved Brutal Strike",
      activity: "Staggering Blow",
      effects: true,
      dieFrom: "Brutal Strike"
    });
    expect(reg.HIT_OPTIONS["sundering-blow"]).toMatchObject({
      feature: "Improved Brutal Strike",
      activity: "Sundering Blow",
      effects: true,
      dieFrom: "Brutal Strike"
    });
  });
  it("Staggered bends the next save and is spent by it; Sundered is +5 to another creature's attack at the target, spent by it, never the placer's", () => {
    expect(reg.EFFECT_BENDS.Staggered).toMatchObject({ spend: "save" });
    expect(reg.EFFECT_BENDS.Staggered.saves).toEqual({ bend: "disadvantage" });
    expect(reg.EFFECT_BENDS.Sundered).toMatchObject({
      plus: 5,
      except: "source",
      spend: "attack",
      attacker: null,
      target: null
    });
  });
  it("Studied Attacks: a use chip a MISS writes, against that creature, the vex window; the effect row reads it at that target and spends it", () => {
    const chip = reg.USE_CHIPS["Studied Attacks"];
    expect(chip).toMatchObject({
      key: "studiedAttacks",
      bend: "advantage",
      window: "vex",
      on: "miss",
      against: true
    });
    expect(reg.EFFECT_BENDS["Studied Attacks"]).toMatchObject({
      attacker: "advantage",
      target: null,
      spend: "attack",
      against: true
    });
    expectPointer(chip.rule);
  });
  it("Relentless: a d8 stands in for a Superiority Die at an EMPTY Combat Superiority pool", () => {
    expect(reg.SUPERIORITY_STAND_INS.Relentless).toMatchObject({
      die: "1d8",
      pool: "Combat Superiority"
    });
    expectPointer(reg.SUPERIORITY_STAND_INS.Relentless.rule);
  });
});

describe("B3 — the forgo (pure)", () => {
  const sources = [
    { kind: "effect", bend: "advantage", label: "Brann — Reckless" },
    { kind: "condition", bend: null, label: "Brann — Prone: note" }
  ];
  it("forgoneSources strikes every Advantage source (listed, no vote) and the net reads Normal", () => {
    const out = r.forgoneSources(sources, "Brutal Strike");
    expect(out[0]).toMatchObject({
      bend: null,
      forgone: true,
      label: "Brann — Reckless — forgone (Brutal Strike)"
    });
    expect(out[1]).toEqual(sources[1]);
    expect(r.netMode(out)).toBe("normal");
  });
  it("forgoOff: off with no Advantage, off with Disadvantage, off on a Dexterity attack; on otherwise", () => {
    const row = { ability: "str" };
    expect(r.forgoOff(row, { sources }, "str")).toBeNull();
    expect(r.forgoOff(row, { sources: [] }, "str")).toBe("no Advantage to forgo");
    expect(
      r.forgoOff(
        row,
        { sources: [...sources, { kind: "effect", bend: "disadvantage", label: "x" }] },
        "str"
      )
    ).toBe("the attack has Disadvantage");
    expect(r.forgoOff(row, { sources }, "dex")).toBe("a Strength-based attack only");
  });
  it("the record keeps `forgone` and `plus` on the sources it writes", () => {
    const rec = r.reminderRecord({
      sources: [
        { kind: "effect", bend: null, label: "a", forgone: true },
        { kind: "effect", bend: null, label: "b", plus: 5 }
      ],
      net: "normal",
      mode: "normal",
      answeredAt: 1
    });
    expect(rec.sources).toEqual([
      { kind: "effect", bend: null, label: "a", forgone: true },
      { kind: "effect", bend: null, label: "b", plus: 5 }
    ]);
  });
});

describe("B3 — the gate's `against` and `plus` (effectSources)", () => {
  const T = () => reg.EFFECT_BENDS;
  const all = () => Object.keys(reg.EFFECT_BENDS);
  it("Studied Attacks — vs Goblin: Advantage at the Goblin, nothing at the Hobgoblin, nothing in the attacker pass", () => {
    const me = {
      uuid: "Actor.fighter",
      effects: [{ id: "c1", name: "Studied Attacks — vs Goblin", against: "Actor.goblin" }]
    };
    const atGoblin = r.effectSources({
      attacker: me,
      target: { uuid: "Actor.goblin", effects: [] },
      enabled: all(),
      table: T(),
      scope: { classification: "weapon", type: "melee" },
      attackerName: "Morgash",
      targetName: "Goblin",
      pass: "target"
    });
    expect(atGoblin.map(s => [s.bend, s.label, s.spend, s.effectId])).toEqual([
      ["advantage", "Morgash — Studied Attacks — vs Goblin", "attack", "c1"]
    ]);
    const atOther = r.effectSources({
      attacker: me,
      target: { uuid: "Actor.hob", effects: [] },
      enabled: all(),
      table: T(),
      scope: { classification: "weapon", type: "melee" },
      pass: "target"
    });
    expect(atOther).toEqual([]);
    const alone = r.effectSources({
      attacker: me,
      enabled: all(),
      table: T(),
      scope: { classification: "weapon", type: "melee" },
      pass: "attacker"
    });
    expect(alone).toEqual([]);
  });
  it("Sundered on the target: +5 to another creature's roll (a listed source, no bend), spent by it; the barbarian's own roll gains nothing", () => {
    const target = {
      uuid: "Actor.ogre",
      effects: [{ id: "s1", name: "Sundered", sourceUuid: "Actor.barb" }]
    };
    const other = r.effectSources({
      attacker: { uuid: "Actor.rogue", effects: [] },
      target,
      enabled: all(),
      table: T(),
      scope: { classification: "weapon", type: "melee" },
      attackerName: "Vex",
      targetName: "Ogre",
      pass: "target"
    });
    expect(other.map(s => [s.bend, s.plus, s.label, s.spend])).toEqual([
      [null, 5, "Ogre is Sundered — +5 to this attack roll", "attack"]
    ]);
    expect(r.netMode(other)).toBe("normal");
    const own = r.effectSources({
      attacker: { uuid: "Actor.barb", effects: [] },
      target,
      enabled: all(),
      table: T(),
      scope: { classification: "weapon", type: "melee" },
      pass: "target"
    });
    expect(own).toEqual([]);
  });
  it("Staggered on the roller: Disadvantage on any demanded save, spent by it", () => {
    const out = r.effectSaveSources({
      enabled: all(),
      table: T(),
      name: "Ogre",
      effects: [{ id: "g1", name: "Staggered" }],
      demand: { spell: false, statuses: [], abilities: ["dex"] }
    });
    expect(out.map(s => [s.bend, s.label, s.spend])).toEqual([
      ["disadvantage", "Ogre — Staggered", "save"]
    ]);
  });
});

describe("B3 — the hit menu's Brutal Strike group (pure)", () => {
  const menu = extra =>
    h.hitMenu({
      groups: reg.HIT_GROUPS,
      options: reg.HIT_OPTIONS,
      listed: Object.values(reg.HIT_OPTIONS).map(x => x.feature),
      features: ["Brutal Strike", "Improved Brutal Strike"],
      pools: {},
      dice: {
        "forceful-blow": { die: "1d10" },
        "hamstring-blow": { die: "1d10" },
        "staggering-blow": { die: "1d10" },
        "sundering-blow": { die: "1d10" }
      },
      ...extra
    });
  it("a free group whose every option rides its own die: four rows, each affordable, the cost the die, one pick", () => {
    const g = menu().groups.find(x => x.key === "brutal-strike");
    expect(g).toBeTruthy();
    expect(g.free).toBe(true);
    expect(g.max).toBe(1);
    expect(g.rows.map(x => [x.key, x.cost, x.affordable])).toEqual([
      ["forceful-blow", "1d10 · free", true],
      ["hamstring-blow", "1d10 · free", true],
      ["staggering-blow", "1d10 · free", true],
      ["sundering-blow", "1d10 · free", true]
    ]);
    const { picks, dropped } = h.hitPick({
      menu: menu(),
      chosen: ["hamstring-blow", "sundering-blow"]
    });
    expect(picks).toEqual([]);
    expect(dropped).toEqual(["hamstring-blow", "sundering-blow"]);
    expect(
      h.hitPick({ menu: menu(), chosen: ["hamstring-blow"] }).picks.map(p => p.row.key)
    ).toEqual(["hamstring-blow"]);
  });
  it("without Improved Brutal Strike on the sheet, two rows; with no die read, none affordable", () => {
    const two = h.hitMenu({
      groups: reg.HIT_GROUPS,
      options: reg.HIT_OPTIONS,
      listed: Object.values(reg.HIT_OPTIONS).map(x => x.feature),
      features: ["Brutal Strike"],
      pools: {},
      dice: { "forceful-blow": { die: "1d10" }, "hamstring-blow": { die: "1d10" } }
    });
    expect(two.groups.find(x => x.key === "brutal-strike").rows.map(x => x.key)).toEqual([
      "forceful-blow",
      "hamstring-blow"
    ]);
    const none = menu({ dice: {} });
    expect(none.groups.find(x => x.key === "brutal-strike").rows.every(x => !x.affordable)).toBe(
      true
    );
  });
});
