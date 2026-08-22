import { beforeAll, describe, expect, it } from "vitest";
import { installFoundryStub } from "./foundry-stub.js";

installFoundryStub();

/** @type {typeof import("../scripts/volley-registry.js")} */
let reg;
beforeAll(async () => {
  reg = await import("../scripts/volley-registry.js");
});

/**
 * A stand-in for the activity a real use hands the resolver.
 *
 * ⚠ `item` in the ROLL DATA matters: `resolveVolleyCount` only overrides `@item.level` with
 * the cast level `if ( rollData.item )`. A real dnd5e `getRollData()` always carries one — a
 * stub that omits it silently produces a smaller volley, which is exactly the degradation
 * pinned below.
 */
const activity = (level = 1, extra = {}) => ({
  item: { system: { level } },
  getRollData: () => structuredClone({ item: { level }, ...extra })
});

describe("volleyEntryFor — membership is the registry, never the content", () => {
  it("matches a listed spell by name", () => {
    expect(reg.volleyEntryFor({ type: "spell", name: "Magic Missile" })).toMatchObject({
      kind: "damage"
    });
  });

  it("refuses an unlisted spell however its data looks", () => {
    // The census false positive: Dimension Door ships count "2" WITH a damage activity.
    // Structural detection would have volley-popped its teleport-mishap damage.
    expect(reg.volleyEntryFor({ type: "spell", name: "Dimension Door" })).toBeNull();
  });

  it("refuses a non-spell item that happens to share a listed name", () => {
    expect(reg.volleyEntryFor({ type: "weapon", name: "Magic Missile" })).toBeNull();
  });

  it("survives a null item", () => {
    expect(reg.volleyEntryFor(null)).toBeNull();
    expect(reg.volleyEntryFor(undefined)).toBeNull();
  });
});

describe("resolveVolleyCount — the count comes from the entry, scaled by the cast", () => {
  const missile = () => reg.VOLLEY_REGISTRY.get("Magic Missile");
  const ray = () => reg.VOLLEY_REGISTRY.get("Scorching Ray");

  it("scales Magic Missile with the cast level, not the item level", () => {
    expect(reg.resolveVolleyCount(missile(), activity(1), 1)).toBe(3);
    expect(reg.resolveVolleyCount(missile(), activity(1), 3)).toBe(5);
  });

  it("scales Scorching Ray with the cast level", () => {
    expect(reg.resolveVolleyCount(ray(), activity(2), 2)).toBe(3);
    expect(reg.resolveVolleyCount(ray(), activity(2), 5)).toBe(6);
  });

  it("bands Eldritch Blast by CHARACTER level, from a PC's rollData", () => {
    const beams = reg.VOLLEY_REGISTRY.get("Eldritch Blast");
    const at = lvl => reg.resolveVolleyCount(beams, activity(0, { details: { level: lvl } }), 0);
    expect(at(1)).toBe(1);
    expect(at(4)).toBe(1); // below 2 means the native path — never a volley
    expect(at(5)).toBe(2);
    expect(at(11)).toBe(3);
    expect(at(17)).toBe(4);
  });

  it("falls back to CR for an NPC, whose rollData carries details.level 0", () => {
    const beams = reg.VOLLEY_REGISTRY.get("Eldritch Blast");
    const npc = reg.resolveVolleyCount(beams, activity(0, { details: { level: 0, cr: 5 } }), 0);
    expect(npc).toBe(2);
  });

  it("returns 0 — never a volley — for an actor whose level cannot be read", () => {
    const beams = reg.VOLLEY_REGISTRY.get("Eldritch Blast");
    expect(reg.resolveVolleyCount(beams, activity(0, {}), 0)).toBe(0);
  });

  // ⚠ PINS A DEGRADATION, NOT A GUARANTEE. When roll data is unavailable the resolver falls
  // back to an EMPTY object, so `@item.level` reads 0 and the volley comes out SHORT rather
  // than either correct or zero — Magic Missile at cast level 3 would fire 2 darts, not 5,
  // with no warning. Unreachable in practice (a real getRollData always returns an `item`),
  // which is why this is recorded rather than fixed. If the fallback ever becomes reachable,
  // the right answer is 0 (the native path), never a quiet undercount.
  it("degrades to a SHORT count, not a throw, when roll data is unavailable", () => {
    const exploding = {
      item: { system: { level: 1 } },
      getRollData: () => {
        throw new Error("boom");
      }
    };
    expect(reg.resolveVolleyCount(missile(), exploding, 1)).toBe(2); // correct answer is 3
  });

  it("degrades the same way when roll data arrives without an item", () => {
    const bare = { item: { system: { level: 1 } }, getRollData: () => ({}) };
    expect(reg.resolveVolleyCount(missile(), bare, 3)).toBe(2); // correct answer is 5
  });
});

describe("registry shape — the R4 contract", () => {
  it("every entry declares a kind from the closed set", () => {
    for (const [name, entry] of reg.VOLLEY_REGISTRY) {
      expect(["damage", "attack"], `${name} declares an unknown kind`).toContain(entry.kind);
    }
  });

  it("no entry transcribes an amount — amounts live in content (DESIGN N1)", () => {
    for (const [name, entry] of reg.VOLLEY_REGISTRY) {
      expect(Object.keys(entry), `${name} carries an amount`).toEqual(
        expect.not.arrayContaining(["damage", "dice", "dc"])
      );
    }
  });
});
