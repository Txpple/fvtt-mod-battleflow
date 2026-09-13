import { describe, expect, it } from "vitest";
import { hitOfferStep } from "../scripts/decide/sequence.js";

/**
 * THE HIT'S SEQUENCE (user ruling 2026-09-13): "damage, nothing until damage. then mastery
 * rider. then other stuff." The offer is queued at the hit and moves only on these facts.
 */
describe("hitOfferStep — a queued offer waits for the damage and the mastery's decision", () => {
  it("does nothing for an offer that is not queued — pending, answered, moot", () => {
    for (const status of ["pending", "resolved", "moot", undefined]) {
      expect(hitOfferStep({ status, masteryStatus: null, damageLanded: true, living: 1 })).toBe(
        "none"
      );
    }
  });

  it("waits while the damage has not landed — nothing until damage, whatever else is true", () => {
    expect(
      hitOfferStep({ status: "queued", masteryStatus: null, damageLanded: false, living: 1 })
    ).toBe("wait");
    expect(
      hitOfferStep({ status: "queued", masteryStatus: "done", damageLanded: false, living: 1 })
    ).toBe("wait");
  });

  it("waits while the mastery's ASK is pending — the decision comes first", () => {
    expect(
      hitOfferStep({ status: "queued", masteryStatus: "pending", damageLanded: true, living: 1 })
    ).toBe("wait");
  });

  it("promotes once the damage landed and the mastery decided, or never asked (a notice, or no mastery)", () => {
    expect(
      hitOfferStep({ status: "queued", masteryStatus: "done", damageLanded: true, living: 1 })
    ).toBe("promote");
    expect(
      hitOfferStep({ status: "queued", masteryStatus: null, damageLanded: true, living: 2 })
    ).toBe("promote");
  });

  it("goes moot when the damage left nobody to bash — the dead gate, after the damage", () => {
    expect(
      hitOfferStep({ status: "queued", masteryStatus: null, damageLanded: true, living: 0 })
    ).toBe("moot");
    expect(
      hitOfferStep({ status: "queued", masteryStatus: "done", damageLanded: true, living: 0 })
    ).toBe("moot");
  });
});
