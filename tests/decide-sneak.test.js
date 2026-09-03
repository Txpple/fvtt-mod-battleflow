import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer Sneak Attack arithmetic (ARCHITECTURE.md §2). No Foundry stub on purpose.
 * The flow is the user's ruling (2026-09-02, the prototype built as drawn): the tick at the
 * gate, the options read off the sheet, the costs off the dice before the roll.
 */
/** @type {typeof import("../scripts/decide/sneak.js")} */
let s;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  s = await import("../scripts/decide/sneak.js");
  reg = await import("../scripts/decide/registry.js");
});

describe("parseDice — the sheet's resolved formula, or nothing", () => {
  it("reads plain dice and refuses everything else — an unresolved @scale token rolls zero in silence", () => {
    expect(s.parseDice("7d6")).toEqual({ number: 7, faces: 6 });
    expect(s.parseDice(" 1d6 ")).toEqual({ number: 1, faces: 6 });
    expect(s.parseDice("@scale.rogue.sneak-attack")).toBeNull();
    expect(s.parseDice("0d6")).toBeNull();
    expect(s.parseDice("7d6 + 2")).toBeNull();
    expect(s.parseDice(null)).toBeNull();
  });
});

describe("the weapon and the read-for-you line", () => {
  it("a Finesse or a ranged weapon qualifies; nothing else does", () => {
    expect(s.sneakWeaponQualifies({ finesse: true })).toBe(true);
    expect(s.sneakWeaponQualifies({ ranged: true })).toBe(true);
    expect(s.sneakWeaponQualifies({})).toBe(false);
  });
  it("says what it judged and leaves the ally clause to the player", () => {
    const lines = s.sneakReadLines({ weaponName: "the rapier", finesse: true, net: "advantage" });
    expect(lines[0]).toBe("the rapier is Finesse ✓");
    expect(lines[1]).toMatch(/nets Advantage ✓/);
    expect(lines.at(-1)).toMatch(/after the hit/);
    expect(s.sneakReadLines({ weaponName: "the bow", ranged: true, net: "normal" })[1]).toMatch(
      /yours to judge/
    );
    expect(s.sneakReadLines({ weaponName: "the mace", net: "disadvantage" })[0]).toMatch(/✗/);
  });
  it("names what gave the Advantage — the boxes are folded, so the line must say it (user walk 2026-09-02)", () => {
    const lines = s.sneakReadLines({
      weaponName: "the bow",
      ranged: true,
      net: "advantage",
      sources: [
        { bend: "advantage", label: "You — Steady Aim" },
        { bend: null, label: "unjudged" }
      ]
    });
    expect(lines[1]).toBe("this roll nets Advantage ✓ — You — Steady Aim");
    expect(
      s.sneakReadLines({
        weaponName: "the bow",
        net: "disadvantage",
        sources: [{ bend: "disadvantage", label: "You — Sapped" }]
      })[1]
    ).toMatch(/Disadvantage ✗ — You — Sapped — no Sneak Attack/);
  });
});

describe("cunningMenu — the options, read off the sheet", () => {
  const menu = (features, extra = {}) =>
    s.cunningMenu({ options: reg.CUNNING_OPTIONS, features, dice: 7, ...extra });
  it("Cunning Strike alone: Poison, Trip, Withdraw; one effect at a time", () => {
    const m = menu(["Sneak Attack", "Cunning Strike"]);
    expect(m.rows.map(r => r.key)).toEqual(["poison", "trip", "withdraw"]);
    expect(m.max).toBe(1);
    expect(m.rows.find(r => r.key === "withdraw").line).toBe(true);
    expect(m.rows.find(r => r.key === "poison").activity).toBe("Poison");
  });
  it("Devious Strikes and Improved Cunning Strike widen it — six rows, two at a time", () => {
    const m = menu(["Cunning Strike", "Devious Strikes", "Improved Cunning Strike"]);
    expect(m.rows.map(r => r.key)).toEqual([
      "poison",
      "trip",
      "withdraw",
      "daze",
      "knockOut",
      "obscure"
    ]);
    expect(m.max).toBe(2);
  });
  it("the subclass options: Supreme Sneak's line, Envenom Weapons upgrading Poison, Rend Mind on a Psychic Blade only", () => {
    const thief = menu(["Cunning Strike", "Supreme Sneak"]);
    expect(thief.rows.find(r => r.key === "stealthAttack")).toMatchObject({ line: true, cost: 1 });
    const assassin = menu(["Cunning Strike", "Envenom Weapons"]);
    const poison = assassin.rows.find(r => r.key === "poison");
    expect(poison.upgrade.feature).toBe("Envenom Weapons");
    expect(poison.upgrade.onFail).toBe("poisoned");
    expect(poison.label).toBe("Poison (Envenom Weapons)");
    expect(
      menu(["Cunning Strike", "Rend Mind"], { weaponName: "Rapier" }).rows.some(
        r => r.key === "rendMind"
      )
    ).toBe(false);
    const soulknife = menu(["Cunning Strike", "Rend Mind"], { weaponName: "Psychic Blade" });
    expect(soulknife.rows.find(r => r.key === "rendMind")).toMatchObject({
      cost: 0,
      activity: ["Rend Mind (Free)", "Rend Mind"]
    });
  });
  it("affordability is the dice: Knock Out needs six, a 3d6 rogue cannot pay it", () => {
    const m = s.cunningMenu({
      options: reg.CUNNING_OPTIONS,
      features: ["Cunning Strike", "Devious Strikes"],
      dice: 3
    });
    expect(m.rows.find(r => r.key === "knockOut").affordable).toBe(false);
    expect(m.rows.find(r => r.key === "obscure").affordable).toBe(true);
  });
  it("case-insensitive on the sheet's names", () => {
    expect(menu(["cunning strike"]).rows).toHaveLength(3);
  });
});

describe("cunningPick and sneakFormula — the costs come off before the roll", () => {
  it("Knock Out on 7d6 leaves one die; a crit doubles that one elsewhere", () => {
    const { rows, max } = s.cunningMenu({
      options: reg.CUNNING_OPTIONS,
      features: ["Cunning Strike", "Devious Strikes"],
      dice: 7
    });
    const pick = s.cunningPick({ rows, chosen: ["knockOut"], dice: 7, max });
    expect(pick).toMatchObject({ cost: 6, remaining: 1, tooMany: false, tooDear: false });
    expect(s.sneakFormula({ number: 7, faces: 6, cost: pick.cost })).toBe("1d6");
  });
  it("two picks without Improved Cunning Strike are too many; costs past the dice are too dear; every die forgone is no part", () => {
    const { rows } = s.cunningMenu({
      options: reg.CUNNING_OPTIONS,
      features: ["Cunning Strike", "Devious Strikes"],
      dice: 3
    });
    expect(s.cunningPick({ rows, chosen: ["poison", "trip"], dice: 3, max: 1 }).tooMany).toBe(true);
    expect(s.cunningPick({ rows, chosen: ["knockOut"], dice: 3, max: 1 }).tooDear).toBe(true);
    expect(s.sneakFormula({ number: 1, faces: 6, cost: 1 })).toBeNull();
    expect(s.sneakFormula({ number: 7, faces: 6 })).toBe("7d6");
  });
});

describe("the registry's Sneak Attack data", () => {
  it("every option names its feature and a cost; the activities are the pack's names", () => {
    for (const [key, row] of Object.entries(reg.CUNNING_OPTIONS)) {
      expect(row.feature, key).toBeTruthy();
      expect(typeof row.cost, key).toBe("number");
      expect(row.rule.length, key).toBeGreaterThan(20);
    }
    expect(reg.SNEAK_ATTACK.feature).toBe("Sneak Attack");
    expect(reg.DEATH_STRIKE.when).toBe("firstRound");
    expect(reg.REMINDER_KINDS.has("sneak")).toBe(true);
  });
});
