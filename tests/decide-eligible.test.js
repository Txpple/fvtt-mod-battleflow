import { beforeAll, describe, expect, it } from "vitest";

/** DECISION-layer eligibility (ARCHITECTURE.md §2). No Foundry stub on purpose. */
/** @type {typeof import("../scripts/decide/eligible.js")} */
let e;
beforeAll(async () => {
  e = await import("../scripts/decide/eligible.js");
});

const actor = ({ type = "npc", hp = 10, statuses = [] } = {}) => ({
  type,
  statuses: new Set(statuses),
  system: { attributes: { hp: { value: hp } } }
});

describe("isDeadForSaves — the asymmetry is deliberate", () => {
  it("skips an NPC at 0 HP", () => {
    expect(e.isDeadForSaves(actor({ type: "npc", hp: 0 }))).toBe(true);
  });

  it("still DEMANDS a downed PC — 0 HP is dying, not dead, and a failed save can kill them", () => {
    expect(e.isDeadForSaves(actor({ type: "character", hp: 0 }))).toBe(false);
  });

  it("skips anyone carrying the dead status, PC included", () => {
    expect(e.isDeadForSaves(actor({ type: "character", hp: 0, statuses: ["dead"] }))).toBe(true);
    expect(e.isDeadForSaves(actor({ type: "npc", hp: 40, statuses: ["dead"] }))).toBe(true);
  });

  it("demands the living", () => {
    expect(e.isDeadForSaves(actor({ type: "npc", hp: 1 }))).toBe(false);
  });

  it("survives an actor with no statuses collection at all", () => {
    expect(e.isDeadForSaves({ type: "npc", system: { attributes: { hp: { value: 5 } } } })).toBe(
      false
    );
  });
});

describe("limitedUses — none / available / spent", () => {
  const item = (uses, activityUses = []) => ({
    system: { uses, activities: { contents: activityUses.map(u => ({ uses: u })) } }
  });

  it('an item with no pool at all is "none"', () => {
    expect(e.limitedUses(item(undefined))).toBe("none");
  });

  it("reads an unlimited item's empty max as no pool, not as zero", () => {
    // Number("") is 0, not NaN — the trap this guard exists for.
    expect(e.limitedUses(item({ max: "", value: 0 }))).toBe("none");
  });

  it('a pool with charges is "available", an exhausted one is "spent"', () => {
    expect(e.limitedUses(item({ max: 3, value: 1 }))).toBe("available");
    expect(e.limitedUses(item({ max: 3, value: 0 }))).toBe("spent");
  });

  it("counts an ACTIVITY pool when the item itself has none — the statblock caster's shape", () => {
    expect(e.limitedUses(item(undefined, [{ max: 1, value: 1 }]))).toBe("available");
    expect(e.limitedUses(item(undefined, [{ max: 1, value: 0 }]))).toBe("spent");
  });

  it("one available pool anywhere beats an exhausted one elsewhere", () => {
    expect(e.limitedUses(item({ max: 2, value: 0 }, [{ max: 1, value: 1 }]))).toBe("available");
  });
});

describe("isReactionItem", () => {
  it("takes a reaction at the item level", () => {
    expect(e.isReactionItem({ system: { activation: { type: "reaction" } } })).toBe(true);
  });

  it("takes an activity that OVERRIDES to a reaction", () => {
    expect(
      e.isReactionItem({
        system: { activities: { contents: [{ activation: { override: true, type: "reaction" } }] } }
      })
    ).toBe(true);
  });

  it("a SPELL's activity must override to count — it inherits the casting time, it does not declare", () => {
    expect(
      e.isReactionItem({
        type: "spell",
        system: { activities: { contents: [{ activation: { type: "reaction" } }] } }
      })
    ).toBe(false);
  });

  it("a FEATURE's activity declares its own activation — no override flag on the 2024 packs (user walk 2026-09-02)", () => {
    expect(
      e.isReactionItem({
        type: "feat",
        system: { activities: { contents: [{ activation: { type: "reaction" } }] } }
      })
    ).toBe(true);
  });

  it("refuses an ordinary action, and survives an empty item", () => {
    expect(e.isReactionItem({ system: { activation: { type: "action" } } })).toBe(false);
    expect(e.isReactionItem(undefined)).toBe(false);
  });
});

describe("isTextOnlyFeature — the pack's paragraph-only feature, found by name", () => {
  it("a feat with no activation and no activities is text-only; one with either is not", () => {
    expect(e.isTextOnlyFeature({ type: "feat", system: {} })).toBe(true);
    expect(
      e.isTextOnlyFeature({ type: "feat", system: { activities: { size: 0, contents: [] } } })
    ).toBe(true);
    expect(
      e.isTextOnlyFeature({ type: "feat", system: { activities: { size: 1, contents: [{}] } } })
    ).toBe(false);
    expect(
      e.isTextOnlyFeature({ type: "feat", system: { activation: { type: "reaction" } } })
    ).toBe(false);
  });
  it("never equipment or a spell — the worn-Shield guard stands", () => {
    expect(e.isTextOnlyFeature({ type: "equipment", system: {} })).toBe(false);
    expect(e.isTextOnlyFeature({ type: "spell", system: {} })).toBe(false);
    expect(e.isTextOnlyFeature(undefined)).toBe(false);
  });
});

describe("castLevelOf — two channels, take the higher", () => {
  const activity = level => ({ item: { system: { level } } });

  it("reads the chosen slot", () => {
    expect(e.castLevelOf(activity(1), { spell: { slot: "spell3" } })).toBe(3);
  });

  it("reads base + scaling when no slot was chosen", () => {
    expect(e.castLevelOf(activity(1), { scaling: 2 })).toBe(3);
  });

  it("takes the HIGHER when the slot defaulted to base but scaling was passed bare", () => {
    // _prepareUsageConfig defaults spell.slot to the BASE key even with bare scaling, so
    // neither channel alone answers both shapes.
    expect(e.castLevelOf(activity(1), { spell: { slot: "spell1" }, scaling: 2 })).toBe(3);
  });

  it("falls back to the item's own level with no config at all", () => {
    expect(e.castLevelOf(activity(4), undefined)).toBe(4);
  });

  it("ignores a non-slot string rather than parsing nonsense out of it", () => {
    expect(e.castLevelOf(activity(2), { spell: { slot: "pact" } })).toBe(2);
  });
});

describe("clampVolleyCount", () => {
  it("passes an ordinary count through untouched", () => {
    expect(e.clampVolleyCount(3, 2)).toBe(3);
  });

  it("clamps a distinct-target volley to the number of creatures", () => {
    // Steel Wind Strike is 5 attacks but RAW is one per creature.
    expect(e.clampVolleyCount(5, 2, true)).toBe(2);
  });

  it("does NOT clamp a non-distinct volley — three darts can share two targets", () => {
    expect(e.clampVolleyCount(3, 2, false)).toBe(3);
  });

  it("returns null below two — one projectile is just a damage roll", () => {
    expect(e.clampVolleyCount(1, 5)).toBe(null);
    expect(e.clampVolleyCount(5, 1, true)).toBe(null);
  });
});

describe("riderKey", () => {
  it("keys on mark, formula and type together — one entry per damage part", () => {
    expect(e.riderKey("hunters-mark", { formula: "1d6", type: "force" })).toBe(
      "hunters-mark:1d6:force"
    );
  });

  it("keeps two parts of one mark distinct", () => {
    const a = e.riderKey("hex", { formula: "1d6", type: "necrotic" });
    const b = e.riderKey("hex", { formula: "1d6", type: "force" });
    expect(a).not.toBe(b);
  });
});
