import { describe, expect, it } from "vitest";
import { effectRows, listed, marksHeldBy, toneOf } from "../scripts/decide/effect-view.js";

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

  it("tones a condition and a module mark as a debuff, everything else as a buff (draft heuristic)", () => {
    expect(toneOf(fact({ statuses: ["prone"] }))).toBe("debuff");
    expect(toneOf(fact({ name: "Sapped", chipKey: "sap" }))).toBe("debuff");
    expect(toneOf(fact({ name: "Cleave", chipKey: "cleave" }))).toBe("buff");
    expect(toneOf(fact())).toBe("buff");
  });

  it("tags every status-less row as one the token cannot paint", () => {
    const rows = effectRows([fact(), fact({ id: "e2", name: "Prone", statuses: ["prone"] })]);
    expect(rows.find(r => r.name === "Bless").noIcon).toBe(true);
    expect(rows.find(r => r.name === "Prone").noIcon).toBe(false);
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
});
