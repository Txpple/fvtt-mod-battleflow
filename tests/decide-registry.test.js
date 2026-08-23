import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer list parsing (ARCHITECTURE.md §2, §6). No Foundry stub on purpose: if any of
 * this ever reaches for `setting()` the import fails, which is the signal we want.
 *
 * ⚠ This parser is the only thing between a stray character in a world setting and a feature
 * that silently does nothing forever. A dropped entry raises no error at runtime — that is
 * precisely why the drops are asserted here rather than trusted.
 *
 * ⚠ Phase 3 replaced five parsers with one spec-driven parser. Every behavioural assertion the
 * five had is preserved below, list by list, because "move, do not rewrite" is only a claim
 * until the old behaviours are re-asserted against the new code.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
});

const entriesOf = (spec, raw) => reg.parseList(spec, raw).entries;

describe("the specs themselves", () => {
  it("gives every list a label, an S key, at least one column and a default", () => {
    for (const [key, spec] of Object.entries(reg.LIST_SPECS)) {
      expect(spec.label, key).toBeTruthy();
      expect(spec.setting, key).toBeTruthy();
      expect(spec.columns.length, key).toBeGreaterThan(0);
      expect(typeof spec.default, key).toBe("string");
    }
  });

  it("declares a kind set exactly when it declares a kind column", () => {
    for (const [key, spec] of Object.entries(reg.LIST_SPECS)) {
      expect(Boolean(spec.kinds), key).toBe(Boolean(spec.kindColumn));
      if (spec.kindColumn) expect(spec.columns, key).toContain(spec.kindColumn);
    }
  });

  it("declares a fallback ONLY where the kind column can carry one", () => {
    // §6 rule 6 admits a DECLARED fallback; a fallback on a kindless list is meaningless, and
    // one whose value is not itself a legal kind would put an illegal entry into the machine.
    for (const [key, spec] of Object.entries(reg.LIST_SPECS)) {
      if (!spec.fallback) continue;
      expect(spec.kindColumn, key).toBeTruthy();
      expect(spec.kinds.has(spec.fallback), key).toBe(true);
    }
  });

  it("ships a default that its own parser accepts whole — no drops, no fallbacks", () => {
    // The same assertion the static gate makes, kept here too: a shipped default that its own
    // parser rejects disables the feature for every fresh world, and nobody would see it.
    for (const [key, spec] of Object.entries(reg.LIST_SPECS)) {
      const { entries, rejects } = reg.parseList(spec, spec.default);
      expect(rejects, key).toEqual([]);
      expect(entries.length, key).toBeGreaterThan(0);
    }
  });

  it("keeps Riposte out of the interrupt default — it triggers on a MISS", () => {
    // Struck from the live worlds at v1.16.0; the strike missed the registered default until
    // v1.19.0, so a fresh world kept re-seeding the every-hit nonsense hold. Pinned here.
    expect(reg.LIST_SPECS.interrupt.default).not.toMatch(/riposte/i);
    expect(reg.LIST_SPECS.maneuverFolds.default).toMatch(/Riposte:riposte/);
  });
});

describe("interrupt list — the one DECLARED fallback", () => {
  const spec = () => reg.LIST_SPECS.interrupt;

  it("reads name and kind, and lowercases the kind", () => {
    expect(entriesOf(spec(), "Shield:ac, Absorb Elements:DAMAGE")).toEqual([
      { name: "Shield", kind: "ac" },
      { name: "Absorb Elements", kind: "damage" }
    ]);
  });

  it("defaults a MISTYPED kind to ac rather than dropping the reaction — and SAYS SO", () => {
    // Deliberately unlike the folds: a mistyped interrupt is still worth pausing for. What
    // changed in Phase 3 is the reject — the correction is no longer silent.
    const { entries, rejects } = reg.parseList(spec(), "Shield:acc");
    expect(entries).toEqual([{ name: "Shield", kind: "ac" }]);
    expect(rejects).toEqual([
      { chunk: "Shield:acc", action: "defaulted", detail: '"acc" is not a kind' }
    ]);
  });

  it("defaults a kindless entry to ac, and says that too", () => {
    const { entries, rejects } = reg.parseList(spec(), "Shield");
    expect(entries).toEqual([{ name: "Shield", kind: "ac" }]);
    expect(rejects[0]).toMatchObject({ action: "defaulted", detail: "no kind given" });
  });

  it("survives the punctuation a human actually types", () => {
    expect(entriesOf(spec(), "  Shield : ac ,, ,Silvery Barbs:ac,")).toEqual([
      { name: "Shield", kind: "ac" },
      { name: "Silvery Barbs", kind: "ac" }
    ]);
  });

  it("returns an empty list for empty, null and undefined — never throws", () => {
    for (const raw of ["", "   ", null, undefined]) {
      expect(reg.parseList(spec(), raw)).toEqual({ entries: [], rejects: [] });
    }
  });
});

describe("block list — both halves required", () => {
  const spec = () => reg.LIST_SPECS.block;

  it("reads Spell:Reaction", () => {
    expect(entriesOf(spec(), "Magic Missile:Shield")).toEqual([
      { spell: "Magic Missile", reaction: "Shield" }
    ]);
  });

  it("DROPS a half-written entry — a block with no reaction blocks nothing", () => {
    for (const raw of ["Magic Missile", "Magic Missile:", ":Shield"]) {
      expect(entriesOf(spec(), raw), raw).toEqual([]);
    }
  });

  it("names which half was missing, so the warning is actionable", () => {
    expect(reg.parseList(spec(), "Magic Missile").rejects[0]).toMatchObject({
      action: "dropped",
      detail: "no reaction"
    });
    expect(reg.parseList(spec(), ":Shield").rejects[0]).toMatchObject({ detail: "no spell" });
  });

  it("keeps the good entries either side of a bad one", () => {
    expect(entriesOf(spec(), "Magic Missile:Shield, Oops, Fireball:Absorb Elements")).toEqual([
      { spell: "Magic Missile", reaction: "Shield" },
      { spell: "Fireball", reaction: "Absorb Elements" }
    ]);
  });
});

describe("maneuver folds — the closed kind set, and what it refuses", () => {
  const spec = () => reg.LIST_SPECS.maneuverFolds;

  it("accepts every kind in the set, case-insensitively", () => {
    const raw = [...reg.MANEUVER_KINDS].map((k, i) => `Feat ${i}:${k.toUpperCase()}`).join(", ");
    const { entries, rejects } = reg.parseList(spec(), raw);
    expect(rejects).toEqual([]);
    expect(entries.map(e => e.kind)).toEqual([...reg.MANEUVER_KINDS]);
  });

  it("REPORTS an unrecognised kind instead of guessing at it", () => {
    const { entries, rejects } = reg.parseList(
      spec(),
      "Precision Attack:precision, Riposte:rispote"
    );
    expect(entries).toEqual([{ name: "Precision Attack", kind: "precision" }]);
    // The typo is DROPPED and reported — never quietly read as something else.
    expect(rejects).toEqual([
      { chunk: "Riposte:rispote", action: "dropped", detail: '"rispote" is not a kind' }
    ]);
  });

  it("reports a kindless entry too", () => {
    const { entries, rejects } = reg.parseList(spec(), "Riposte");
    expect(entries).toEqual([]);
    expect(rejects[0]).toMatchObject({ chunk: "Riposte", action: "dropped" });
  });

  it("allows one feat to appear twice under different kinds", () => {
    // Shield Master is listed twice on purpose: two folds off one feat, orthogonal kinds.
    const { entries, rejects } = reg.parseList(
      spec(),
      "Shield Master:interpose, Shield Master:bash"
    );
    expect(rejects).toEqual([]);
    expect(entries).toEqual([
      { name: "Shield Master", kind: "interpose" },
      { name: "Shield Master", kind: "bash" }
    ]);
  });

  it("returns empty and reports nothing for an empty setting", () => {
    expect(reg.parseList(spec(), "")).toEqual({ entries: [], rejects: [] });
  });
});

describe("d20 folds — three spends, one mechanism", () => {
  const spec = () => reg.LIST_SPECS.d20Folds;

  it("ships all three surveyed features on by default", () => {
    const { entries } = reg.parseList(spec(), spec().default);
    expect(entries.map(e => e.kind).sort()).toEqual(["bardic", "heroic", "tactical"]);
  });

  // ⚠ The default names the EFFECT ("Inspired") the bard applies, not the bard's own feat
  // ("Bardic Inspiration"). The recipient carries the effect; the feat never leaves the bard,
  // so a list entry naming the feat would look right and find nothing on the creature that
  // actually holds the die. Measured against phbbrdBardicInsp, 2026-08-23.
  // ⚠ The default LOOKS wrong and is right: the key must be "Inspired", because that is the
  // ActiveEffect the bard's Inspire activity applies to the recipient — the bard's own feat
  // never leaves the bard, so an entry naming the feat would find nothing on the creature that
  // actually holds the die. What the table READS is "Bardic Inspiration"; d20-folds.js's
  // KIND_LABEL supplies that, and the two are deliberately allowed to differ.
  it("keys bardic off the effect a bard APPLIES, never the feat the bard keeps", () => {
    expect(spec().default).toMatch(/Inspired:bardic/);
    expect(spec().default).not.toMatch(/Bardic Inspiration:bardic/);
  });

  it("drops an unknown kind rather than guessing — no fallback on this list", () => {
    expect(spec().fallback).toBe(null);
    const { entries, rejects } = reg.parseList(spec(), "Heroic Inspiration:reroll");
    expect(entries).toEqual([]);
    expect(rejects[0]).toMatchObject({ action: "dropped" });
    expect(reg.rejectMessage(spec(), rejects[0])).toMatch(/heroic\/tactical\/bardic/);
  });

  it("requires the name column even for heroic, whose name is only a label", () => {
    // `heroic` does no lookup at all — its marker is a boolean with no document. The name is
    // still required because the popup has to print something, and "every column required" is
    // one rule with no per-list exceptions.
    const { entries, rejects } = reg.parseList(spec(), ":heroic");
    expect(entries).toEqual([]);
    expect(rejects[0]).toMatchObject({ action: "dropped", detail: "no name" });
  });

  it("lets the table rename any of them — the name is data, the kind is the switch", () => {
    const { entries } = reg.parseList(spec(), "Lucky Break:heroic, Bard's Gift:bardic");
    expect(entries).toEqual([
      { name: "Lucky Break", kind: "heroic" },
      { name: "Bard's Gift", kind: "bardic" }
    ]);
  });

  it("an empty list turns every d20 fold off", () => {
    expect(reg.parseList(spec(), "").entries).toEqual([]);
  });
});

describe("rider list and rider upgrades", () => {
  it("reads a bare comma list of identifiers as one-column entries", () => {
    // ⚠ `{ name }` since Phase 3, not bare strings — one shape for every list setting.
    expect(entriesOf(reg.LIST_SPECS.rider, "hunters-mark, hex,  divine-favor ")).toEqual([
      { name: "hunters-mark" },
      { name: "hex" },
      { name: "divine-favor" }
    ]);
  });

  it("drops empty slots rather than emitting blanks", () => {
    expect(entriesOf(reg.LIST_SPECS.rider, "hex,,, ,hunters-mark")).toEqual([
      { name: "hex" },
      { name: "hunters-mark" }
    ]);
  });

  it("reads feature:rider upgrade pairs and drops half-written ones", () => {
    expect(entriesOf(reg.LIST_SPECS.riderUpgrade, "foe-slayer:hunters-mark, broken")).toEqual([
      { feature: "foe-slayer", rider: "hunters-mark" }
    ]);
  });
});

describe("one parser, one set of rules", () => {
  it("ignores a third colon-separated field on every two-column list", () => {
    // Pre-Phase-3 behaviour, preserved: every parser destructured the first two halves and
    // ignored the rest. Asserted so a future column cannot appear by accident.
    expect(entriesOf(reg.LIST_SPECS.interrupt, "Shield:ac:extra")).toEqual([
      { name: "Shield", kind: "ac" }
    ]);
    expect(entriesOf(reg.LIST_SPECS.block, "Magic Missile:Shield:extra")).toEqual([
      { spell: "Magic Missile", reaction: "Shield" }
    ]);
  });

  it("writes a message that names the list, the chunk and what would have worked", () => {
    const spec = reg.LIST_SPECS.maneuverFolds;
    const { rejects } = reg.parseList(spec, "Riposte:rispote");
    const msg = reg.rejectMessage(spec, rejects[0]);
    expect(msg).toContain("Maneuver Folds");
    expect(msg).toContain("Riposte:rispote");
    expect(msg).toContain("precision/riposte/interpose/bash/hew");
    expect(msg).toContain("ignored, never guessed");
  });

  it("says 'read as' rather than 'ignored' when a fallback stood in", () => {
    const spec = reg.LIST_SPECS.interrupt;
    const { rejects } = reg.parseList(spec, "Shield:acc");
    const msg = reg.rejectMessage(spec, rejects[0]);
    expect(msg).toContain('read as "ac"');
    expect(msg).not.toContain("ignored");
  });
});

describe("the R4 tripwire — the kinds the code knows", () => {
  it("gives every kind set a name, an owner and at least one kind", () => {
    for (const set of reg.KIND_SETS) {
      expect(set.name).toBeTruthy();
      expect(set.owner, set.name).toMatch(/\.js$/);
      expect(set.kinds.size, set.name).toBeGreaterThan(0);
      expect(set.note, set.name).toBeTruthy();
    }
  });

  it("declares a system-enum size only where one actually exists", () => {
    // Masteries mirror a real dnd5e enum; the other three are the module's own inventions and
    // there is nothing to check them against. A `system` count on one of those would be a
    // fiction, and the docs lean on this distinction.
    const withEnum = reg.KIND_SETS.filter(s => s.system !== null);
    expect(withEnum.map(s => s.name)).toEqual(["mastery"]);
    expect(withEnum[0].system).toBe(8);
  });

  it("keeps the module's mastery set inside the system's, one short, by declaration", () => {
    expect(reg.MASTERY_KINDS.size + reg.MASTERY_NATIVE.size).toBe(8);
    // A mastery is resolved or deliberately native — never both, never neither.
    for (const k of reg.MASTERY_NATIVE) expect(reg.MASTERY_KINDS.has(k), k).toBe(false);
  });

  it("counts the kinds the gate pins", () => {
    // The pin itself lives in tools/check-registry.mjs, where the failure has to happen. This
    // asserts the number that pin is about, so a kind added here is visible in two places.
    const total = reg.KIND_SETS.reduce((n, s) => n + s.kinds.size, 0);
    expect(total).toBe(19);
  });

  it("puts every kind-bearing list spec's set in the table", () => {
    // A spec with a closed set that the tripwire does not count is a kind the code knows and
    // nobody is counting — exactly the blind spot the tripwire exists to remove.
    const counted = new Set(reg.KIND_SETS.map(s => s.kinds));
    for (const [key, spec] of Object.entries(reg.LIST_SPECS)) {
      if (spec.kinds) expect(counted.has(spec.kinds), key).toBe(true);
    }
  });
});
