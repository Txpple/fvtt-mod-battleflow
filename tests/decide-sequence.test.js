import { describe, expect, it } from "vitest";
import { hitOfferStep, withinBashReach } from "../scripts/decide/sequence.js";

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

/**
 * Shield Master's reach (Session 8, 2026-09-22): the bash was offered on hits well beyond 5 feet.
 * The feat's own clause — "a creature within 5 feet of you" — is settled by the map.
 */
describe("withinBashReach — the feat's 5 feet, judged off the map", () => {
  it("admits a creature within 5 feet, adjacent or diagonal", () => {
    expect(withinBashReach(5)).toBe(true);
    expect(withinBashReach(0)).toBe(true);
  });

  it("refuses a reach weapon's 10 feet and a thrown weapon's range", () => {
    expect(withinBashReach(10)).toBe(false);
    expect(withinBashReach(30)).toBe(false);
  });

  it("keeps the offer when the distance could not be measured — a question, not an outcome", () => {
    expect(withinBashReach(null)).toBe(true);
    expect(withinBashReach(undefined)).toBe(true);
    expect(withinBashReach(Number.NaN)).toBe(true);
  });
});
