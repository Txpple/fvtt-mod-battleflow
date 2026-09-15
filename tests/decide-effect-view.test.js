import { describe, expect, it } from "vitest";
import {
  allRows,
  changeSign,
  effectRows,
  everyRow,
  listed,
  marksHeldBy,
  panelGroups,
  rowAction,
  sheetRows,
  toneOf
} from "../scripts/decide/effect-view.js";

const fact = (over = {}) => ({
  id: "e1",
  name: "Bless",
  img: "icons/bless.svg",
  active: true,
  temporary: true,
  statuses: [],
  chipKey: null,
  clock: "9 Rounds",
  origin: null,
  worn: false,
  ...over
});

describe("the effect view's rows (DESIGN §6, 2026-09-15: buffs and debuffs, never actions)", () => {
  it("lists the active effects that are clocked, a condition, or applied — never worn gear", () => {
    expect(listed(fact())).toBe(true);
    expect(listed(fact({ active: false }))).toBe(false);
    expect(listed(null)).toBe(false);
    // Death Armor: no clock, no status, applied by a cast — listed
    expect(listed(fact({ name: "Death Armor", temporary: false, clock: "None" }))).toBe(true);
    // Prone on Foundry 14: a bare status is not "temporary" — listed by its status
    expect(listed(fact({ name: "Prone", temporary: false, statuses: ["prone"] }))).toBe(true);
    // the Cloak of Protection: a worn item's transfer effect — a passive, not listed
    expect(listed(fact({ name: "Bonus AC/Saves: +1", temporary: false, worn: true }))).toBe(false);
    // worn gear WITH a clock or a status still lists (a cursed item's condition)
    expect(listed(fact({ temporary: false, worn: true, statuses: ["poisoned"] }))).toBe(true);
  });

  it("tones a condition and a module mark as a debuff", () => {
    expect(toneOf(fact({ statuses: ["prone"] }))).toBe("debuff");
    expect(toneOf(fact({ name: "Sapped", chipKey: "sap" }))).toBe("debuff");
    expect(toneOf(fact({ name: "Cleave", chipKey: "cleave" }))).toBe("buff");
    expect(toneOf(fact())).toBe("buff");
  });

  it("reads a change's sign: a subtraction, a halving, a downgrade or disadvantage is a penalty; the mirror is a bonus", () => {
    expect(changeSign({ key: "system.attributes.ac.bonus", mode: 2, value: "-2" })).toBe("penalty");
    expect(changeSign({ key: "system.attributes.ac.bonus", mode: 2, value: "+2" })).toBe("bonus");
    expect(changeSign({ key: "system.attributes.movement.walk", mode: 1, value: "0.5" })).toBe(
      "penalty"
    );
    expect(changeSign({ key: "system.attributes.movement.walk", mode: 1, value: "2" })).toBe(
      "bonus"
    );
    expect(changeSign({ key: "system.attributes.ac.value", mode: 3, value: "10" })).toBe("penalty");
    expect(changeSign({ key: "system.attributes.ac.value", mode: 4, value: "16" })).toBe("bonus");
    expect(changeSign({ key: "flags.dnd5e.disadvantage.attack.all", mode: 5, value: "1" })).toBe(
      "penalty"
    );
    expect(changeSign({ key: "flags.dnd5e.advantage.save.all", mode: 5, value: "1" })).toBe(
      "bonus"
    );
    expect(
      changeSign({ key: "system.attributes.senses.darkvision", mode: 5, value: "60" })
    ).toBeNull();
    expect(
      changeSign({ key: "system.attributes.ac.bonus", mode: 2, value: "@abilities.str.mod" })
    ).toBeNull();
    expect(changeSign(null)).toBeNull();
  });

  it("THE PATTERN (user, 2026-09-15, the Miasma's Damaged: -2 AC): a penalty in the changes is a debuff, a penalty outranks a bonus", () => {
    expect(
      toneOf(
        fact({
          name: "Damaged: -2 AC",
          changes: [{ key: "system.attributes.ac.bonus", mode: 2, value: "-2" }]
        })
      )
    ).toBe("debuff");
    expect(
      toneOf(
        fact({
          name: "Blessed",
          changes: [{ key: "system.bonuses.All-Attacks", mode: 2, value: "1d4" }]
        })
      )
    ).toBe("buff");
    expect(
      toneOf(
        fact({
          name: "Haste",
          changes: [
            { key: "system.attributes.ac.bonus", mode: 2, value: "2" },
            { key: "system.attributes.movement.walk", mode: 1, value: "2" }
          ]
        })
      )
    ).toBe("buff");
    expect(
      toneOf(
        fact({
          name: "Slow",
          changes: [
            { key: "system.attributes.movement.walk", mode: 1, value: "0.5" },
            { key: "system.attributes.ac.bonus", mode: 2, value: "-2" }
          ]
        })
      )
    ).toBe("debuff");
    expect(
      toneOf(
        fact({
          name: "Mixed",
          changes: [
            { key: "system.attributes.ac.bonus", mode: 2, value: "2" },
            { key: "system.attributes.hp.tempmax", mode: 2, value: "-5" }
          ]
        })
      )
    ).toBe("debuff");
  });

  it("with no readable change, who put it there decides: an enemy's marker is a debuff, an ally's or your own a buff", () => {
    expect(toneOf(fact({ name: "Hunter's Mark", changes: [], hostileOrigin: true }))).toBe(
      "debuff"
    );
    expect(toneOf(fact({ name: "Hunter's Mark", changes: [], hostileOrigin: false }))).toBe("buff");
    expect(toneOf(fact({ name: "Death Armor", changes: [], hostileOrigin: null }))).toBe("buff");
    // a readable change outranks the side: an enemy's accidental buff stays a buff
    expect(
      toneOf(
        fact({
          changes: [{ key: "system.attributes.ac.bonus", mode: 2, value: "1" }],
          hostileOrigin: true
        })
      )
    ).toBe("buff");
  });

  it("tags the rows the token cannot paint: clockless and status-less (measured 2026-09-15)", () => {
    const rows = effectRows([
      fact(),
      fact({ id: "e2", name: "Prone", temporary: false, statuses: ["prone"] }),
      fact({ id: "e3", name: "Death Armor", temporary: false, clock: "" })
    ]);
    expect(rows.find(r => r.name === "Bless").noIcon).toBe(false);
    expect(rows.find(r => r.name === "Prone").noIcon).toBe(false);
    expect(rows.find(r => r.name === "Death Armor").noIcon).toBe(true);
  });

  it("orders debuffs first, then buffs, each in sheet order", () => {
    const rows = effectRows([
      fact({ id: "a", name: "Bless" }),
      fact({ id: "b", name: "Prone", statuses: ["prone"] }),
      fact({ id: "c", name: "Death Armor" }),
      fact({ id: "d", name: "Sapped", chipKey: "sap" })
    ]);
    expect(rows.map(r => r.name)).toEqual(["Prone", "Sapped", "Bless", "Death Armor"]);
  });

  it("finds the marks a creature holds on others by origin, and names the bearer", () => {
    const held = marksHeldBy("Actor.inv", [
      {
        bearer: "Goblin Boss",
        fact: fact({ id: "s", name: "Sapped", chipKey: "sap", origin: "Actor.inv.Item.sword" })
      },
      {
        bearer: "Ogre",
        fact: fact({ id: "v", name: "Vexed", chipKey: "vex", origin: "Actor.gren.Item.axe" })
      },
      {
        bearer: "Ogre",
        fact: fact({
          id: "x",
          name: "Dead chip",
          chipKey: "sap",
          origin: "Actor.inv",
          active: false
        })
      }
    ]);
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ name: "Sapped", bearer: "Goblin Boss", tone: "debuff" });
    expect(marksHeldBy(null, [])).toEqual([]);
  });

  it("the sheet rows: temp HP and Heroic Inspiration are buffs read off the sheet, not effects (user, 2026-09-15)", () => {
    expect(sheetRows({ tempHp: 3, inspiration: false })).toMatchObject([
      {
        id: "sheet:tempHp",
        name: "Temporary HP",
        detail: "3",
        tone: "buff",
        clock: "",
        noIcon: false
      }
    ]);
    expect(sheetRows({ tempHp: 0, inspiration: true }).map(r => r.name)).toEqual([
      "Heroic Inspiration"
    ]);
    expect(sheetRows({ tempHp: 0, inspiration: false })).toEqual([]);
    expect(sheetRows({})).toEqual([]);
    expect(sheetRows({ tempHp: null, inspiration: "yes" })).toEqual([]);
  });

  it("allRows: the effects first (debuffs, then buffs), then the sheet's own buffs", () => {
    const rows = allRows([fact(), fact({ id: "p", name: "Prone", statuses: ["prone"] })], {
      tempHp: 5,
      inspiration: true
    });
    expect(rows.map(r => r.name)).toEqual(["Prone", "Bless", "Temporary HP", "Heroic Inspiration"]);
  });

  it("the bar's action per row: remove an actor's effect, disable an item's, clear a sheet row; nothing for a non-owner", () => {
    expect(rowAction({ id: "e1" }, { owner: true })).toEqual({ action: "remove", label: "Remove" });
    expect(rowAction({ id: "e2", onItem: true }, { owner: true })).toEqual({
      action: "disable",
      label: "Disable"
    });
    expect(rowAction({ id: "sheet:tempHp" }, { owner: true })).toEqual({
      action: "clear",
      label: "Clear"
    });
    expect(rowAction({ id: "e1" }, { owner: false })).toBeNull();
    expect(rowAction(null, { owner: true })).toBeNull();
  });

  it("a row remembers whether its effect lives on an item", () => {
    const rows = effectRows([
      fact({ id: "w", statuses: ["poisoned"], worn: true }),
      fact({ id: "a" })
    ]);
    expect(rows.find(r => r.id === "w").onItem).toBe(true);
    expect(rows.find(r => r.id === "a").onItem).toBe(false);
  });

  it("the panel's groups mirror the sheet: Temporary, Passive, Unavailable (user, 2026-09-15: show ALL, including passives)", () => {
    const groups = panelGroups(
      [
        fact({ id: "b", name: "Blessed" }),
        fact({ id: "p", name: "Prone", temporary: false, statuses: ["prone"] }),
        fact({ id: "t", name: "Tough", temporary: false, worn: true }),
        fact({ id: "d", name: "Death Armor", temporary: false }),
        fact({
          id: "l",
          name: "Lucky",
          temporary: false,
          worn: true,
          active: false,
          disabled: false
        }),
        fact({ id: "m", name: "Damaged: -2 AC", temporary: false, active: false, disabled: false }),
        fact({
          id: "w",
          name: "Wand of the War Mage +1",
          temporary: false,
          worn: true,
          active: false,
          disabled: true
        })
      ],
      { tempHp: 3 }
    );
    expect(groups.map(g => g.label)).toEqual(["Temporary", "Passive", "Unavailable"]);
    expect(groups[0].rows.map(r => r.name)).toEqual(["Blessed", "Prone", "Temporary HP"]);
    expect(groups[1].rows.map(r => r.name)).toEqual(["Tough", "Death Armor"]);
    expect(groups[2].rows.map(r => r.name)).toEqual(["Lucky", "Damaged: -2 AC"]);
    expect(groups[2].rows.every(r => r.unavailable === true)).toBe(true);
    expect(
      everyRow([fact({ id: "d", temporary: false, active: false, disabled: false })]).map(r => r.id)
    ).toEqual(["d"]);
    expect(panelGroups([])).toEqual([]);
  });
});
