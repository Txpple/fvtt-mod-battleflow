import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer list parsing (ARCHITECTURE.md §2, §6). No Foundry stub on purpose: if any
 * of these ever reaches for `setting()` the import fails, which is the signal we want.
 *
 * ⚠ These parsers are the only thing between a stray character in a world setting and a
 * feature that silently does nothing forever. A dropped entry raises no error at runtime —
 * that is precisely why the drops are asserted here rather than trusted.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
});

describe("parseInterruptList — unknown kinds fall back to ac, never drop", () => {
  it("reads name and kind, and lowercases the kind", () => {
    expect(reg.parseInterruptList("Shield:ac, Absorb Elements:DAMAGE")).toEqual([
      { name: "Shield", kind: "ac" },
      { name: "Absorb Elements", kind: "damage" }
    ]);
  });

  it("defaults a MISTYPED kind to ac rather than dropping the reaction", () => {
    // Deliberately unlike the folds below: a mistyped interrupt is still worth pausing for.
    expect(reg.parseInterruptList("Shield:acc")).toEqual([{ name: "Shield", kind: "ac" }]);
  });

  it("defaults a kindless entry to ac", () => {
    expect(reg.parseInterruptList("Shield")).toEqual([{ name: "Shield", kind: "ac" }]);
  });

  it("survives the punctuation a human actually types", () => {
    expect(reg.parseInterruptList("  Shield : ac ,, ,Silvery Barbs:ac,")).toEqual([
      { name: "Shield", kind: "ac" },
      { name: "Silvery Barbs", kind: "ac" }
    ]);
  });

  it("returns an empty list for empty, null and undefined — never throws", () => {
    for (const raw of ["", "   ", null, undefined]) expect(reg.parseInterruptList(raw)).toEqual([]);
  });
});

describe("parseBlockList — both halves required", () => {
  it("reads Spell:Reaction", () => {
    expect(reg.parseBlockList("Magic Missile:Shield")).toEqual([
      { spell: "Magic Missile", reaction: "Shield" }
    ]);
  });

  it("DROPS a half-written entry — a block with no reaction blocks nothing", () => {
    expect(reg.parseBlockList("Magic Missile")).toEqual([]);
    expect(reg.parseBlockList("Magic Missile:")).toEqual([]);
    expect(reg.parseBlockList(":Shield")).toEqual([]);
  });

  it("keeps the good entries either side of a bad one", () => {
    expect(reg.parseBlockList("Magic Missile:Shield, Oops, Fireball:Absorb Elements")).toEqual([
      { spell: "Magic Missile", reaction: "Shield" },
      { spell: "Fireball", reaction: "Absorb Elements" }
    ]);
  });
});

describe("parseManeuverFolds — the closed kind set, and what it refuses", () => {
  it("accepts every kind in the set, case-insensitively", () => {
    const raw = [...reg.MANEUVER_KINDS].map((k, i) => `Feat ${i}:${k.toUpperCase()}`).join(", ");
    const { entries, unknown } = reg.parseManeuverFolds(raw);
    expect(unknown).toEqual([]);
    expect(entries.map(e => e.kind)).toEqual([...reg.MANEUVER_KINDS]);
  });

  it("reports an unrecognised kind instead of guessing at it", () => {
    const { entries, unknown } = reg.parseManeuverFolds(
      "Precision Attack:precision, Riposte:rispote"
    );
    expect(entries).toEqual([{ name: "Precision Attack", kind: "precision" }]);
    expect(unknown).toEqual(["Riposte:rispote"]); // the typo is REPORTED, not silently ac'd
  });

  it("reports a kindless entry too", () => {
    expect(reg.parseManeuverFolds("Riposte").unknown).toEqual(["Riposte"]);
  });

  it("allows one feat to appear twice under different kinds", () => {
    // Shield Master is listed twice on purpose: two folds off one feat, orthogonal kinds.
    const { entries, unknown } = reg.parseManeuverFolds(
      "Shield Master:interpose, Shield Master:bash"
    );
    expect(unknown).toEqual([]);
    expect(entries).toEqual([
      { name: "Shield Master", kind: "interpose" },
      { name: "Shield Master", kind: "bash" }
    ]);
  });

  it("returns empty and reports nothing for an empty setting", () => {
    expect(reg.parseManeuverFolds("")).toEqual({ entries: [], unknown: [] });
  });
});

describe("parseIdentifierList / parseUpgradeList", () => {
  it("reads a bare comma list of identifiers", () => {
    expect(reg.parseIdentifierList("hunters-mark, hex,  divine-favor ")).toEqual([
      "hunters-mark",
      "hex",
      "divine-favor"
    ]);
  });

  it("drops empty slots rather than emitting blanks", () => {
    expect(reg.parseIdentifierList("hex,,, ,hunters-mark")).toEqual(["hex", "hunters-mark"]);
  });

  it("reads feature:rider upgrade pairs and drops half-written ones", () => {
    expect(reg.parseUpgradeList("foe-slayer:hunters-mark, broken")).toEqual([
      { feature: "foe-slayer", rider: "hunters-mark" }
    ]);
  });
});
