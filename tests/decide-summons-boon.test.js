// @ts-check
import { describe, expect, it } from "vitest";
import { boonHpPlan, systemHpBonusOf } from "../scripts/decide/summons.js";

describe("a boon the system already carries (Fortified Familiar through the feat's grant)", () => {
  it("reads the unlinked branch's raised maximum against the creature's own", () => {
    const changes = {
      actorUpdates: { "system.attributes.hp.max": 13, "system.attributes.hp.value": 13 }
    };
    expect(systemHpBonusOf(changes, 3)).toBe(10);
  });
  it("reads the effect branches (classes without a hard maximum; a linked creature)", () => {
    expect(
      systemHpBonusOf(
        {
          actorUpdates: {
            effects: [{ changes: [{ key: "system.attributes.hp.bonuses.overall", value: 10 }] }]
          }
        },
        20
      )
    ).toBe(10);
    expect(
      systemHpBonusOf(
        {
          actorUpdates: {
            effects: [{ changes: [{ key: "system.attributes.hp.max", value: "4" }] }]
          }
        },
        20
      )
    ).toBe(4);
  });
  it("is 0 when the system lands none — the module's own landing then applies", () => {
    expect(systemHpBonusOf({ actorUpdates: { effects: [] } }, 3)).toBe(0);
    expect(systemHpBonusOf(null, 3)).toBe(0);
    expect(systemHpBonusOf({ actorUpdates: { "system.attributes.hp.max": 3 } }, 3)).toBe(0);
    expect(
      boonHpPlan({
        total: 10,
        hasClasses: false,
        hardMax: true,
        linked: false,
        hp: { max: 3, value: 3 }
      }).updates
    ).toEqual({
      "system.attributes.hp.max": 13,
      "system.attributes.hp.value": 13
    });
  });
  it("a duplicated enchantment shows as the system's doubled number, never the module's on top", () => {
    // two Fortified Familiar enchantments on the spell (Tychon's sheet, 2026-10-14): dnd5e lands 20; the record says 20, the module adds 0
    expect(systemHpBonusOf({ actorUpdates: { "system.attributes.hp.max": 23 } }, 3)).toBe(20);
  });
});
