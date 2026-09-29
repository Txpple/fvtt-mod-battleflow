import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: the Monster Manual's waiting rows built (RULINGS *The Monster Manual — the waiting rows
 * built*; the drawing audits/drawings/monsters.md *The rows the scan gave no family*) — the repeating save on a
 * monster's own activity and its escalation, the turn-start damage the grappled take and the grappler deals.
 * No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/repeat-saves.js")} */
let rs;
/** @type {typeof import("../scripts/decide/turn-grants.js")} */
let tg;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  rs = await import("../scripts/decide/repeat-saves.js");
  tg = await import("../scripts/decide/turn-grants.js");
});

describe("REPEAT_SAVES — a monster's own activity", () => {
  it("the four plain rows: the pack's effect, the turn end, no count — keyed by the trait", () => {
    for (const [key, effect] of [
      ["Pacifying Spores", "Stunned"],
      ["Paralysis Gas", "Paralyzed"],
      ["Scare", "Frightened"],
      ["Spores", "Poisoned"]
    ]) {
      const row = reg.REPEAT_SAVES[key];
      expect(Object.isFrozen(row), key).toBe(true);
      expect(row, key).toMatchObject({ effect, on: ["turnEnd"] });
      expect(row.count, key).toBeUndefined();
      expect(row.item, key).toBeUndefined();
      expectPointer(row.rule);
    }
  });
  it("the escalation: Restrained repeats on the second save; the first failure presses Petrified INSTEAD (swap)", () => {
    for (const key of ["Petrifying Bite", "Petrifying Gaze"]) {
      expect(reg.REPEAT_SAVES[key], key).toMatchObject({
        effect: "Restrained",
        activity: "Second Save",
        on: ["turnEnd"],
        count: { saves: 1, fails: 1, press: "petrified", swap: true }
      });
    }
    const breath = reg.REPEAT_SAVES["Petrifying Breath"];
    expect(breath).toMatchObject({
      effect: "Restrained",
      on: ["turnEnd"],
      count: { saves: 1, fails: 1, press: "petrified", swap: true }
    });
    expect(breath.activity).toBeUndefined();
  });
  it("repeatVerdict with swap: the failure ENDS the effect and presses the status; a success ends it plainly", () => {
    const bite = reg.REPEAT_SAVES["Petrifying Bite"];
    let v = rs.repeatVerdict(bite, "failed", null);
    expect(v).toMatchObject({
      ends: true,
      locks: false,
      press: "petrified",
      tally: { saves: 0, fails: 1 }
    });
    expect(v.says).toBe("Restrained ended — the first failure: Petrified instead");
    v = rs.repeatVerdict(bite, "saved", null);
    expect(v).toMatchObject({
      ends: true,
      locks: false,
      press: null,
      tally: { saves: 1, fails: 0 }
    });
    expect(v.says).toBe("Restrained ended — the first success");
    // Without swap the press keeps the effect (Flesh to Stone) — unchanged.
    const stone = reg.REPEAT_SAVES["Flesh to Stone"];
    expect(rs.repeatVerdict(stone, "failed", { saves: 0, fails: 2 })).toMatchObject({
      ends: false,
      locks: true,
      press: "petrified"
    });
  });
  it("the row is found through the trait as the effect's origin — no spell gate", () => {
    const answers = (key, item) => item?.name === key;
    const row = rs.repeatRowFor({
      table: reg.REPEAT_SAVES,
      item: { name: "Pacifying Spores", type: "feat" },
      effectName: "stunned",
      answers
    });
    expect(row?.key).toBe("Pacifying Spores");
    expect(row?.effectName).toBe("Stunned");
    expect(
      rs.repeatRowFor({
        table: reg.REPEAT_SAVES,
        item: { name: "Claw", type: "feat" },
        effectName: "Stunned",
        answers
      })
    ).toBeNull();
  });
});

describe("EMANATIONS — the fire auras' pulse, the turn-start ring, the alerts", () => {
  it("the pulse rows: feature rings with no effect, the first damage activity at the bearer's turn end", () => {
    for (const [key, reach] of [
      ["Fire Aura", "harmful"],
      ["Flame Aura", "all"],
      ["Heat Aura", "all"]
    ]) {
      const row = reg.EMANATIONS[key];
      expect(row, key).toMatchObject({
        kind: "feature",
        reach,
        range: null,
        effect: null,
        pulse: { on: "sourceTurnEnd", activity: null }
      });
      expect(row.trigger, key).toBeUndefined();
      expectPointer(row.rule);
    }
  });
  it("Gibbering is Stench's row — a turnStart trigger, off while Incapacitated", () => {
    expect(reg.EMANATIONS.Gibbering).toMatchObject({
      kind: "feature",
      reach: "all",
      effect: null,
      incapacitated: true,
      trigger: { on: ["turnStart"], oncePerTurn: true }
    });
    expectPointer(reg.EMANATIONS.Gibbering.rule);
  });
  it("the alerts are Polearm Master's rows at the trigger's range — three on a move-in, Unnerving Gaze on a turn start", () => {
    for (const [key, range, reach] of [
      ["Pursuit", 120, "harmful"],
      ["Shriek", 30, "all"],
      ["Watery Rebuke", 5, "harmful"]
    ]) {
      expect(reg.EMANATIONS[key], key).toMatchObject({
        kind: "feature",
        reach,
        range,
        effect: null,
        incapacitated: true,
        quiet: true,
        alert: { on: "moveIn", label: key }
      });
      expect(reg.EMANATIONS[key].alert.swing, key).toMatch(/Reaction/);
      expectPointer(reg.EMANATIONS[key].rule);
    }
    expect(reg.EMANATIONS["Unnerving Gaze"]).toMatchObject({
      range: 30,
      reach: "harmful",
      alert: { on: "turnStart", label: "Unnerving Gaze" }
    });
  });
});

describe("CLOCK_RIDERS — the random condition on a hit", () => {
  it("the three Chaos weapons are self rows: the attack's own item, on any hit, a d4 picking one of its effects, no dice", () => {
    for (const key of ["chaos-blade", "chaos-claw", "chaos-staff"]) {
      const row = reg.CLOCK_RIDERS[key];
      expect(row, key).toMatchObject({
        self: true,
        when: "any",
        activity: null,
        random: { die: 4 }
      });
      expect(row.amount, key).toBeUndefined();
      expect(row.effects, key).toBeUndefined();
      expect(row.says, key).toMatch(/d4/);
      expectPointer(row.rule);
    }
    expect(reg.CLOCK_RIDERS["chaos-blade"].feature).toBe("Chaos Blade");
  });
});

describe("TURN_GRANTS — the turn-start damage", () => {
  it("the grappled target's rows: the origin's damage activity at the bearer's turn start (the vine, Smother, Spores) or turn end (the swarm)", () => {
    expect(reg.TURN_GRANTS["Constricting Vine"]).toMatchObject({
      effect: "Grappled",
      activity: "Damage: Grappled",
      on: "turnStart",
      deals: true
    });
    expect(reg.TURN_GRANTS.Smother).toMatchObject({
      effect: "Grappled + Other Conditions",
      activity: "Grappled: Damage",
      on: "turnStart",
      deals: true
    });
    expect(reg.TURN_GRANTS["Swarm of Proboscises"]).toMatchObject({
      effect: "Grappled",
      activity: "Damage: Grappled",
      on: "turnEnd",
      deals: true
    });
    expect(reg.TURN_GRANTS.Spores).toMatchObject({
      effect: "Poisoned",
      activity: "Damage While Poisoned",
      on: "turnStart",
      deals: true
    });
    for (const key of ["Constricting Vine", "Smother", "Swarm of Proboscises", "Spores"])
      expectPointer(reg.TURN_GRANTS[key].rule);
  });
  it("the grappler's row: Barbed Hide is a feature row that DEALS to the creatures it grapples", () => {
    const row = reg.TURN_GRANTS["Barbed Hide"];
    expect(row).toMatchObject({
      match: "feature",
      effect: null,
      activity: null,
      on: "turnStart",
      deals: "grappled"
    });
    expect(row.while).toBeUndefined();
    expectPointer(row.rule);
    expect(reg.turnGrantEntries().map(e => e.kind)).toEqual([
      "heroism",
      "regeneration",
      "constricting vine",
      "smother",
      "swarm of proboscises",
      "spores",
      "barbed hide"
    ]);
  });
  it("grantRowFor honours `on`: a turnEnd row is not due at the turn start and the reverse", () => {
    const answers = (key, item) => item?.name === key;
    const vine = tg.grantRowFor({
      table: reg.TURN_GRANTS,
      item: { name: "Constricting Vine" },
      effectName: "Grappled",
      answers,
      on: "turnStart"
    });
    expect(vine?.key).toBe("Constricting Vine");
    expect(
      tg.grantRowFor({
        table: reg.TURN_GRANTS,
        item: { name: "Constricting Vine" },
        effectName: "Grappled",
        answers,
        on: "turnEnd"
      })
    ).toBeNull();
    const swarm = tg.grantRowFor({
      table: reg.TURN_GRANTS,
      item: { name: "Swarm of Proboscises" },
      effectName: "Grappled",
      answers,
      on: "turnEnd"
    });
    expect(swarm?.key).toBe("Swarm of Proboscises");
    // The default `on` is the turn start (Heroism's rows carry it).
    expect(
      tg.grantRowFor({
        table: reg.TURN_GRANTS,
        item: { name: "Heroism" },
        effectName: "Bravery",
        answers
      })?.key
    ).toBe("Heroism");
  });
  it("the card's title for a damage: takes, not regains", () => {
    expect(
      tg.grantTitle({
        spell: "Constricting Vine",
        bearer: "Gren",
        total: 5,
        type: "bludgeoning",
        deals: true
      })
    ).toBe("Constricting Vine — Gren takes 5 bludgeoning damage");
    expect(tg.grantTitle({ spell: "Heroism", bearer: "Gren", total: 5, type: "temphp" })).toBe(
      "Heroism — Gren gains 5 Temporary Hit Points"
    );
  });
});
