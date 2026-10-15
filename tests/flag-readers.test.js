import { describe, expect, it } from "vitest";

globalThis.Hooks = { on: () => 1, once: () => 1, call: () => true, callAll: () => {} };
Object.assign(globalThis, {
  game: {
    modules: { get: () => null },
    messages: { get: () => null, contents: [] },
    users: { activeGM: null },
    settings: { get: () => null }
  }
});

const { MODULE_ID, LEGACY_ID, stampedSourceOf } = await import("../scripts/core.js");
const shared = await import("../scripts/shared.js");
const { hasReceipt, receiptEntries, notAppliedOf } = await import("../scripts/auto-apply.js");
const { effectReceiptOf } = await import("../scripts/effect-riders.js");
const { areaAskOf } = await import("../scripts/area-ask.js");
const { weaponRollsOf } = await import("../scripts/auto-damage.js");

/** A document as readFlag sees it: the module's scope through getFlag, the legacy scope on `flags`. */
function doc(flags = {}, legacy = {}) {
  return {
    getFlag: (scope, key) => (scope === MODULE_ID ? flags[key] : undefined),
    flags: { [MODULE_ID]: flags, [LEGACY_ID]: legacy }
  };
}

/**
 * THE RECORDS ANOTHER UNIT READS (ARCHITECTURE §4): each reader answers one question
 * of a key it does not leave to its callers, and answers the empty shape for a document without the key.
 */
describe("the receipt's readers (auto-apply.js)", () => {
  it("hasReceipt is the receipt's presence, a reverted one included", () => {
    expect(hasReceipt(doc({ receipt: { targets: [{ uuid: "A", reverted: true }] } }))).toBe(true);
    expect(hasReceipt(doc())).toBe(false);
    expect(hasReceipt(null)).toBe(false);
  });

  it("receiptEntries answers the entries, [] when none, and reads the legacy scope", () => {
    const entries = [{ uuid: "A", taken: 4 }];
    expect(receiptEntries(doc({ receipt: { targets: entries } }))).toBe(entries);
    expect(receiptEntries(doc({ receipt: {} }))).toEqual([]);
    expect(receiptEntries(undefined)).toEqual([]);
    expect(receiptEntries(doc({}, { receipt: { targets: entries } }))).toBe(entries);
  });

  it("notAppliedOf answers the line or null", () => {
    expect(notAppliedOf(doc({ notApplied: { why: "missed" } }))).toEqual({ why: "missed" });
    expect(notAppliedOf(doc())).toBeNull();
  });
});

describe("the hold's and the attack chain's readers (shared.js)", () => {
  it("holdOf / holdTargets", () => {
    const hold = { status: "pending", targets: [{ uuid: "T" }] };
    expect(shared.holdOf(doc({ hold }))).toBe(hold);
    expect(shared.holdOf(doc())).toBeNull();
    expect(shared.holdTargets(doc({ hold }))).toBe(hold.targets);
    expect(shared.holdTargets(doc({ hold: { status: "resolved" } }))).toEqual([]);
  });

  it("the claim is three-state: held, released, never held", () => {
    expect([
      shared.attackHoldClaims(doc({ attackHoldPending: true })),
      shared.attackHoldReleased(doc({ attackHoldPending: true }))
    ]).toEqual([true, false]);
    expect([
      shared.attackHoldClaims(doc({ attackHoldPending: false })),
      shared.attackHoldReleased(doc({ attackHoldPending: false }))
    ]).toEqual([false, true]);
    expect([shared.attackHoldClaims(doc()), shared.attackHoldReleased(doc())]).toEqual([
      false,
      false
    ]);
  });

  it("attackIdOf answers the stamped attack, else null", () => {
    expect(shared.attackIdOf(doc({ attackFor: "atk1" }))).toBe("atk1");
    expect(shared.attackIdOf(doc())).toBeNull();
  });
});

describe("the save demand's readers (shared.js)", () => {
  const saves = {
    sourceUuid: "Actor.caster",
    demand: { spell: true, statuses: ["charmed"] },
    targets: [{ uuid: "A", outcome: "failed" }]
  };
  it("savesOf, saveSourceOf, saveDemandOf, saveEntryFor", () => {
    const card = doc({ saves });
    expect(shared.savesOf(card)).toBe(saves);
    expect(shared.saveSourceOf(card)).toBe("Actor.caster");
    expect(shared.saveDemandOf(card)).toBe(saves.demand);
    expect(shared.saveEntryFor(card, "A")).toBe(saves.targets[0]);
    expect(shared.saveEntryFor(card, "B")).toBeNull();
  });
  it("each answers null for a card with no demand", () => {
    const card = doc();
    expect([
      shared.savesOf(card),
      shared.saveSourceOf(card),
      shared.saveDemandOf(card),
      shared.saveEntryFor(card, "A")
    ]).toEqual([null, null, null, null]);
  });
});

describe("the chips', the folds' and the faces' readers", () => {
  it("chipKindOf names the chip's kind; a plain effect is none", () => {
    expect(shared.chipKindOf(doc({ mastery: "vex" }))).toBe("vex");
    expect(shared.chipKindOf(doc())).toBeNull();
  });
  it("masteryMomentOf, metamagicOf, effectReceiptOf, areaAskOf answer the record or null", () => {
    expect(shared.masteryMomentOf(doc({ mastery: { status: "done" } }))?.status).toBe("done");
    expect(shared.metamagicOf(doc({ metamagic: { key: "extended" } }))?.key).toBe("extended");
    expect(effectReceiptOf(doc({ effectReceipt: { castDone: true } }))?.castDone).toBe(true);
    expect(areaAskOf(doc({ metamagicAsk: { status: "pending" } }))?.status).toBe("pending");
    expect([
      shared.masteryMomentOf(doc()),
      shared.metamagicOf(doc()),
      effectReceiptOf(doc()),
      areaAskOf(doc())
    ]).toEqual([null, null, null, null]);
  });
  it("d20FoldSpends, chipSpendsOn and storedFacesOf answer [] when empty", () => {
    expect(shared.d20FoldSpends(doc({ d20fold: { spends: [{ kind: "succeed" }] } }))).toEqual([
      { kind: "succeed" }
    ]);
    expect(shared.d20FoldSpends(doc())).toEqual([]);
    expect(shared.chipSpendsOn(doc({ chipSpend: { spent: [{ id: "e1" }] } }))).toEqual([
      { id: "e1" }
    ]);
    expect(shared.chipSpendsOn(doc())).toEqual([]);
    expect(shared.storedFacesOf(doc({ storedDice: { key: "portent", faces: [3, 17] } }))).toEqual([
      3, 17
    ]);
    expect(shared.storedFacesOf(null)).toEqual([]);
  });
  it("styleFaceOf, styleTookOver, bystanderMuteOf", () => {
    expect(shared.styleFaceOf(doc({ fightingStyle: { key: "dueling" } }))?.key).toBe("dueling");
    expect(shared.styleTookOver(doc({ fightingStyleTakenOver: true }))).toBe(true);
    expect(shared.styleTookOver(doc())).toBe(false);
    expect(
      shared.bystanderMuteOf(doc({ bystanderMute: { key: "lucky", until: "turn" } }))?.until
    ).toBe("turn");
    expect(shared.bystanderMuteOf(doc())).toBeNull();
  });
});

describe("the stamps' readers", () => {
  it("stampedSourceOf reads the document's own source stamp (core.js)", () => {
    expect(stampedSourceOf(doc({ sourceUuid: "Actor.a" }))).toBe("Actor.a");
    expect(stampedSourceOf(doc())).toBeNull();
  });
  it("effectSourceUuid falls back to the origin's actor, else null (shared.js)", () => {
    expect(shared.effectSourceUuid(doc({ sourceUuid: "Actor.a" }))).toBe("Actor.a");
    expect(shared.effectSourceUuid(doc())).toBeNull();
  });
  it("weaponRollsOf counts the activity's own rolls, one when unstamped (auto-damage.js)", () => {
    expect(weaponRollsOf(doc({ weaponRolls: 2 }))).toBe(2);
    expect(weaponRollsOf(doc())).toBe(1);
    expect(weaponRollsOf(doc({ weaponRolls: 0 }))).toBe(1);
  });
});
