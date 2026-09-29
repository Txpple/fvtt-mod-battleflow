// A2 — the hit menu's next groups (audits/plans/session-0-classes.md §3 A2): the Monk's Focus group, the free
// groups (Open Hand Technique, Elemental Attunement), the Psi Warrior's Psionic Strike, the option's reach.
import { describe, expect, it } from "vitest";
import * as reg from "../scripts/decide/registry.js";
import { hitMenu, hitPick, optionReaches } from "../scripts/decide/hit-menu.js";

const menu = (over = {}) =>
  hitMenu({
    groups: reg.HIT_GROUPS,
    options: reg.HIT_OPTIONS,
    listed: Object.values(reg.HIT_OPTIONS).map(r => r.feature),
    features: ["Monk's Focus", "Stunning Strike", "Hand of Harm", "Open Hand Technique"],
    pools: { "monks-focus": { left: 4, max: 5, die: null } },
    dice: { "hand-of-harm": { die: "1d8 + 3", type: "necrotic" } },
    ...over
  });

describe("the Monk's Focus group", () => {
  it("lists Stunning Strike (no die, the pool pays) and Hand of Harm (its own die), two picks a hit", () => {
    const g = menu().groups.find(x => x.key === "monks-focus");
    expect(g.max).toBe(2);
    expect(g.ownDice).toBe(true);
    expect(g.left).toBe(4);
    const rows = Object.fromEntries(g.rows.map(r => [r.key, r]));
    expect(rows["stunning-strike"]).toMatchObject({
      cost: "1 Focus Point",
      affordable: true,
      save: true
    });
    expect(rows["hand-of-harm"]).toMatchObject({
      cost: "1d8 + 3 necrotic · 1 Focus Point",
      affordable: true
    });
  });
  it("both ride one hit; a once-per-turn chit greys its row", () => {
    const m = menu({ used: { "stunning-strike": true } });
    const rows = Object.fromEntries(m.groups[0].rows.map(r => [r.key, r]));
    expect(rows["stunning-strike"]).toMatchObject({ cost: "used this turn", affordable: false });
    const both = hitPick({ menu: menu(), chosen: ["stunning-strike", "hand-of-harm"] });
    expect(both.picks.map(p => p.row.key)).toEqual(["stunning-strike", "hand-of-harm"]);
  });
  it("no Focus Points left: nothing affordable", () => {
    const g = menu({ pools: { "monks-focus": { left: 0, max: 5, die: null } } }).groups[0];
    expect(g.rows.every(r => !r.affordable)).toBe(true);
  });
  it("an option the hit does not reach is no row at all", () => {
    const g = menu({ eligible: { "hand-of-harm": false } }).groups.find(
      x => x.key === "monks-focus"
    );
    expect(g.rows.map(r => r.key)).toEqual(["stunning-strike"]);
  });
});

describe("the free groups", () => {
  it("Open Hand Technique: three picks on one item, free, one per hit", () => {
    const g = menu().groups.find(x => x.key === "open-hand-technique");
    expect(g.free).toBe(true);
    expect(g.rows.map(r => r.label)).toEqual(["Addle", "Push", "Topple"]);
    expect(g.rows.every(r => r.cost === "free" && r.affordable)).toBe(true);
    const two = hitPick({ menu: menu(), chosen: ["open-hand-push", "open-hand-topple"] });
    expect(two.picks).toHaveLength(0);
    expect(two.dropped).toEqual(["open-hand-push", "open-hand-topple"]);
  });
});

describe("optionReaches — the hit's facts", () => {
  const row = k => reg.HIT_OPTIONS[k];
  const base = { unarmed: false, weapon: true, monkWeapon: false, own: false, flurry: null };
  it("Stunning Strike: a Monk weapon or an Unarmed Strike", () => {
    expect(optionReaches({ row: row("stunning-strike"), ...base })).toBe(false);
    expect(optionReaches({ row: row("stunning-strike"), ...base, monkWeapon: true })).toBe(true);
    expect(
      optionReaches({ row: row("stunning-strike"), ...base, weapon: false, unarmed: true })
    ).toBe(true);
  });
  it("Hand of Harm: an Unarmed Strike only", () => {
    expect(optionReaches({ row: row("hand-of-harm"), ...base, monkWeapon: true })).toBe(false);
    expect(optionReaches({ row: row("hand-of-harm"), ...base, weapon: false, unarmed: true })).toBe(
      true
    );
  });
  it("Open Hand Technique: an Unarmed Strike after Flurry of Blows; out of combat (null) it stands", () => {
    const u = { ...base, weapon: false, unarmed: true };
    expect(optionReaches({ row: row("open-hand-topple"), ...u, flurry: false })).toBe(false);
    expect(optionReaches({ row: row("open-hand-topple"), ...u, flurry: true })).toBe(true);
    expect(optionReaches({ row: row("open-hand-topple"), ...u, flurry: null })).toBe(true);
    expect(optionReaches({ row: row("open-hand-topple"), ...base, flurry: true })).toBe(false);
  });
  it("Elemental Attunement: the feature's own Elemental Strike only", () => {
    expect(optionReaches({ row: row("elemental-attunement"), ...base })).toBe(false);
    expect(optionReaches({ row: row("elemental-attunement"), ...base, own: true })).toBe(true);
  });
  it("Psionic Strike: a weapon, never an Unarmed Strike", () => {
    expect(optionReaches({ row: row("psionic-strike"), ...base })).toBe(true);
    expect(
      optionReaches({ row: row("psionic-strike"), ...base, weapon: false, unarmed: true })
    ).toBe(false);
  });
});

describe("the rows around the menu", () => {
  it("Protective Field is a paid reduction on Psionic Power: any damage to yourself, an attack's within 30 ft", () => {
    expect(reg.INTERRUPT_REDUCTIONS["Psionic Power"]).toMatchObject({
      activity: "Protective Field",
      pool: true,
      any: true,
      ally: 30
    });
  });
  it("Stunning Strike's Slowed lands on a success (the pack marks it failure-only)", () => {
    expect(reg.SAVE_PRESSES["Stunning Strike"].success).toEqual(["Slowed"]);
    expect(reg.SAVE_PRESSES["Stunning Strike"].status).toBeUndefined();
  });
});
