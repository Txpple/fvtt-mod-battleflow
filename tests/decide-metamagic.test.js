import { describe, it, expect } from "vitest";
import { METAMAGIC, TRANSMUTED_TYPES, LIST_SPECS, parseList } from "../scripts/decide/registry.js";
import {
  metamagicFits,
  metamagicMenu,
  metamagicPick,
  metamagicRuleText,
  metamagicCardLine,
  distantRange,
  carefulProtects,
  heightenedMark,
  scalesTargetsFrom,
  extendedDuration,
  empoweredPlan,
  empoweredOutcome
} from "../scripts/decide/metamagic.js";

// The three fixture spells as the probe measured them (tools/probe-metamagic.mjs, 2026-09-09).
const FIREBALL = {
  save: true,
  rangeFeet: 150,
  touch: false,
  minutes: 0,
  action: true,
  damageTypes: ["fire"],
  damageRoll: true,
  spellAttack: false,
  scalesTargets: false
};
const HOLD_PERSON = {
  save: true,
  rangeFeet: 60,
  touch: false,
  minutes: 1,
  action: true,
  damageTypes: [],
  damageRoll: false,
  spellAttack: false,
  scalesTargets: true
};
const CHROMATIC_ORB = {
  save: false,
  rangeFeet: 90,
  touch: false,
  minutes: 0,
  action: true,
  damageTypes: TRANSMUTED_TYPES.slice(),
  damageRoll: true,
  spellAttack: true,
  scalesTargets: false
};
const SHIELD = {
  save: false,
  rangeFeet: null,
  touch: false,
  minutes: 0.1,
  action: false,
  damageTypes: [],
  damageRoll: false,
  spellAttack: false,
  scalesTargets: false
};
const CURE = {
  save: false,
  rangeFeet: null,
  touch: true,
  minutes: 0,
  action: true,
  damageTypes: [],
  damageRoll: false,
  spellAttack: false,
  scalesTargets: false
};

const ALL = Object.keys(METAMAGIC);
const COSTS = {
  "Careful Spell": 1,
  "Distant Spell": 1,
  "Empowered Spell": 1,
  "Extended Spell": 1,
  "Heightened Spell": 2,
  "Quickened Spell": 2,
  "Seeking Spell": 1,
  "Subtle Spell": 1,
  "Transmuted Spell": 1,
  "Twinned Spell": 1
};
const menu = (facts, points = 5, known = ALL, listed = ALL) =>
  metamagicMenu({
    table: METAMAGIC,
    listed,
    known,
    facts,
    points,
    costs: COSTS,
    transmutedTypes: TRANSMUTED_TYPES
  });
const keys = rows => rows.map(r => r.key);

describe("the table", () => {
  it("names the ten 2024 options, each with a moment, a predicate and no cost", () => {
    expect(ALL.length).toBe(10);
    for (const row of Object.values(METAMAGIC)) {
      expect(["cast", "damage", "miss"]).toContain(row.moment);
      expect(row.when).toBeTruthy();
      expect(row).not.toHaveProperty("cost");
    }
  });
  it("ships its list as membership over the table, every row on", () => {
    const spec = LIST_SPECS.metamagic;
    expect(spec.membership).toBe(true);
    const { entries, rejects } = parseList(spec, spec.default);
    expect(rejects).toEqual([]);
    expect(entries.length).toBe(10);
  });
});

describe("the fit", () => {
  it("Fireball: Careful, Heightened, Distant, Quickened, Subtle, Transmuted fit; Extended and Twinned do not", () => {
    const rows = menu(FIREBALL);
    const fit = rows.filter(r => r.eligible).map(r => r.key);
    expect(fit.sort()).toEqual(
      ["careful", "distant", "heightened", "quickened", "subtle", "transmuted"].sort()
    );
    expect(rows.find(r => r.key === "extended").tag).toBe("instantaneous");
    expect(rows.find(r => r.key === "twinned").tag).toMatch(/higher level/);
  });
  it("Hold Person: Extended and Twinned fit, Transmuted does not (no damage)", () => {
    const rows = menu(HOLD_PERSON);
    expect(rows.find(r => r.key === "extended").eligible).toBe(true);
    expect(rows.find(r => r.key === "twinned").eligible).toBe(true);
    expect(rows.find(r => r.key === "transmuted").tag).toBe("no listed damage type");
  });
  it("a reaction with range Self fits Subtle only among the cast rows", () => {
    const rows = menu(SHIELD);
    expect(rows.filter(r => r.eligible).map(r => r.key)).toEqual(["subtle"]);
    expect(rows.find(r => r.key === "distant").tag).toBe("range Self");
    expect(rows.find(r => r.key === "quickened").tag).toBe("not an action");
  });
  it("a Touch spell fits Distant (to 30 feet)", () => {
    expect(metamagicFits(METAMAGIC["Distant Spell"], CURE)).toBe(true);
    expect(distantRange(CURE)).toBe(30);
    expect(distantRange(FIREBALL)).toBe(300);
    expect(distantRange(SHIELD)).toBe(null);
  });
  it("the later moments are not cast rows", () => {
    expect(keys(menu(CHROMATIC_ORB))).not.toContain("empowered");
    expect(keys(menu(CHROMATIC_ORB))).not.toContain("seeking");
    const later = metamagicMenu({
      table: METAMAGIC,
      listed: ALL,
      known: ALL,
      facts: CHROMATIC_ORB,
      points: 5,
      costs: COSTS,
      moment: "miss"
    });
    expect(keys(later)).toEqual(["seeking"]);
  });
  it("an unknown predicate fits nothing", () => {
    expect(metamagicFits({ when: "moonphase" }, FIREBALL)).toBe(false);
  });
});

describe("the sheet and the list", () => {
  it("offers only what the sheet knows and the list admits", () => {
    expect(keys(menu(FIREBALL, 5, ["Careful Spell", "Subtle Spell"]))).toEqual([
      "careful",
      "subtle"
    ]);
    expect(keys(menu(FIREBALL, 5, ALL, ["Subtle Spell"]))).toEqual(["subtle"]);
    expect(keys(menu(FIREBALL, 5, ["careful spell"]))).toEqual(["careful"]);
  });
});

describe("the points", () => {
  it("greys a row the points cannot afford, with the reason as the tag", () => {
    const rows = menu(FIREBALL, 1);
    expect(rows.find(r => r.key === "careful").tag).toBe("1 SP");
    expect(rows.find(r => r.key === "heightened").affordable).toBe(false);
    expect(rows.find(r => r.key === "heightened").tag).toBe("2 SP — 1 left");
  });
  it("an unreadable cost is never free", () => {
    const rows = metamagicMenu({
      table: METAMAGIC,
      listed: ALL,
      known: ALL,
      facts: FIREBALL,
      points: 5,
      costs: {}
    });
    expect(rows.every(r => !r.affordable)).toBe(true);
    expect(rows.find(r => r.key === "subtle").tag).toBe("cost unreadable");
  });
  it("picks one eligible, affordable row or nothing", () => {
    const rows = menu(FIREBALL, 1);
    expect(metamagicPick({ menu: rows, chosen: "careful" })?.feature).toBe("Careful Spell");
    expect(metamagicPick({ menu: rows, chosen: "heightened" })).toBe(null);
    expect(metamagicPick({ menu: rows, chosen: "extended" })).toBe(null);
    expect(metamagicPick({ menu: rows, chosen: null })).toBe(null);
  });
});

describe("the words", () => {
  it("reads the rule off the pack's description without the cost line, the tags or the lookup", () => {
    const html =
      "<blockquote><p>Cost: 1 Sorcery Point</p></blockquote><p>When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell’s full force.</p><p><strong>Creatures You Can Protect:</strong> [[lookup @abilities.cha.mod]]</p>";
    const text = metamagicRuleText(html);
    expect(text.startsWith("When you cast a spell")).toBe(true);
    expect(text).not.toMatch(/Cost:/);
    expect(text).not.toMatch(/lookup/);
    expect(metamagicRuleText("<p>Cost: 2 Sorcery Points</p><p>When you cast.</p>")).toBe(
      "When you cast."
    );
  });
  it("the card line leads with the option, then what happened", () => {
    expect(metamagicCardLine({ key: "subtle", feature: "Subtle Spell" })).toBe(
      "Subtle Spell — cast without components"
    );
    expect(metamagicCardLine({ key: "quickened", feature: "Quickened Spell" })).toMatch(
      /Bonus Action/
    );
    expect(metamagicCardLine({ key: "distant", feature: "Distant Spell", rangeFeet: 300 })).toBe(
      "Distant Spell — range 300 ft this casting"
    );
    expect(
      metamagicCardLine({
        key: "careful",
        feature: "Careful Spell",
        protected: [{ name: "Aldric" }, { name: "Brenna" }]
      })
    ).toBe("Careful Spell — Aldric, Brenna protected: no save, no damage");
    expect(
      metamagicCardLine({
        key: "heightened",
        feature: "Heightened Spell",
        target: { name: "Bandit" }
      })
    ).toMatch(/Bandit saves with Disadvantage/);
  });
});

describe("Careful and Heightened (Stage 2)", () => {
  const CASTER = "Actor.sorc";
  const contained = [
    { uuid: "Actor.orc", name: "Orc", disposition: -1 },
    { uuid: CASTER, name: "Gren", disposition: 1 },
    { uuid: "Actor.aldric", name: "Aldric", disposition: 1 },
    { uuid: "Actor.brenna", name: "Brenna", disposition: 1 },
    { uuid: "Actor.cass", name: "Cass", disposition: 1 },
    { uuid: "Actor.goblin", name: "Goblin", disposition: -1 }
  ];
  it("protects the caster's allies by default, the caster first, up to the cap", () => {
    const list = carefulProtects({ contained, casterUuid: CASTER, casterDisposition: 1, cap: 3 });
    expect(list.map(p => p.name)).toEqual(["Gren", "Aldric", "Brenna"]);
  });
  it("a cap below one still protects one", () => {
    expect(
      carefulProtects({ contained, casterUuid: CASTER, casterDisposition: 1, cap: 0 }).length
    ).toBe(1);
  });
  it("honours the player's chosen list, capped, among what the save reaches", () => {
    const list = carefulProtects({
      contained,
      casterUuid: CASTER,
      casterDisposition: 1,
      cap: 3,
      chosen: ["Actor.cass", "Actor.orc", "Actor.nobody"]
    });
    expect(list.map(p => p.name)).toEqual(["Cass", "Orc"]);
  });
  it("marks the first enemy for Heightened, or the chosen creature", () => {
    expect(heightenedMark({ contained, casterUuid: CASTER, casterDisposition: 1 })?.name).toBe(
      "Orc"
    );
    expect(
      heightenedMark({
        contained,
        casterUuid: CASTER,
        casterDisposition: 1,
        chosen: "Actor.goblin"
      })?.name
    ).toBe("Goblin");
    expect(
      heightenedMark({ contained: [contained[1]], casterUuid: CASTER, casterDisposition: 1 })
    ).toBe(null);
  });
  it("with no enemy in reach, a neutral is marked before nothing", () => {
    const only = [
      { uuid: CASTER, name: "Gren", disposition: 1 },
      { uuid: "Actor.n", name: "Villager", disposition: 0 }
    ];
    expect(
      heightenedMark({ contained: only, casterUuid: CASTER, casterDisposition: 1 })?.name
    ).toBe("Villager");
  });
});

describe("Extended, Transmuted, Twinned (Stage 3)", () => {
  it("reads Twinned's fit off the SOURCE target count: a formula over the cast's level", () => {
    expect(scalesTargetsFrom("@item.level - 1")).toBe(true);
    expect(scalesTargetsFrom("1 + @scaling")).toBe(true);
    expect(scalesTargetsFrom(3)).toBe(false);
    expect(scalesTargetsFrom("")).toBe(false);
    expect(scalesTargetsFrom(null)).toBe(false);
    // The user's exceptions (2026-09-09): a dart or a ray is not a target; Jump's data says nothing.
    const exceptions = { except: ["Magic Missile", "Scorching Ray"], also: ["Jump"] };
    expect(scalesTargetsFrom("1 + @scaling", { name: "Magic Missile", exceptions })).toBe(false);
    expect(scalesTargetsFrom("1", { name: "Jump", exceptions })).toBe(true);
    expect(scalesTargetsFrom("@item.level - 1", { name: "Hold Person", exceptions })).toBe(true);
  });
  it("doubles a duration to 24 hours at most, rounds and turns as they are", () => {
    expect(extendedDuration({ seconds: 60 })).toEqual({ seconds: 120 });
    expect(extendedDuration({ seconds: 80000 })).toEqual({ seconds: 86400 });
    expect(extendedDuration({ rounds: 10, turns: 1 })).toEqual({ rounds: 20, turns: 2 });
    expect(extendedDuration({})).toEqual({});
    expect(extendedDuration({ seconds: 0 })).toEqual({});
  });
  it("the card lines for the three", () => {
    expect(
      metamagicCardLine({ key: "transmuted", feature: "Transmuted Spell", type: "cold" })
    ).toBe("Transmuted Spell — the damage is cold");
    expect(metamagicCardLine({ key: "extended", feature: "Extended Spell" })).toMatch(
      /duration doubled/
    );
    expect(metamagicCardLine({ key: "twinned", feature: "Twinned Spell" })).toMatch(
      /one more target/
    );
  });
});

describe("Empowered (Stage 4)", () => {
  const dice = [
    { key: "0:0:0", faces: 6, result: 1 },
    { key: "0:0:1", faces: 6, result: 1 },
    { key: "0:0:2", faces: 6, result: 2 },
    { key: "0:0:3", faces: 6, result: 5 }
  ];
  it("keeps the ticked dice up to the cap, once each, ignoring keys the roll never showed", () => {
    expect(
      empoweredPlan({ dice, picks: ["0:0:1", "0:0:1", "0:0:0", "9:9:9", "0:0:2"], cap: 2 }).map(
        d => d.key
      )
    ).toEqual(["0:0:1", "0:0:0"]);
    expect(empoweredPlan({ dice, picks: ["0:0:3"], cap: 0 }).length).toBe(1);
    expect(empoweredPlan({ dice, picks: [], cap: 3 })).toEqual([]);
  });
  it("moves the total by the dice's change and says so", () => {
    const o = empoweredOutcome({
      oldTotal: 22,
      picks: [
        { old: 1, new: 4 },
        { old: 1, new: 6 },
        { old: 2, new: 3 }
      ]
    });
    expect(o.delta).toBe(9);
    expect(o.newTotal).toBe(31);
    expect(o.line).toBe("1, 1, 2 → 4, 6, 3 · 22 → 31");
    expect(empoweredOutcome({ oldTotal: 10, picks: [{ old: 6, new: 1 }] }).newTotal).toBe(5);
  });
});

describe("Careful's default is every non-hostile (the second look, 2026-09-09)", () => {
  const CASTER = "Actor.sorc";
  const scene = [
    { uuid: "Actor.orc", name: "Orc", disposition: -1 },
    { uuid: "Actor.villager", name: "Villager", disposition: 0 },
    { uuid: CASTER, name: "Gren", disposition: 1 },
    { uuid: "Actor.aldric", name: "Aldric", disposition: 1 },
    { uuid: "Actor.spy", name: "Spy", disposition: -2 }
  ];
  it("protects the caster, then allies, then neutrals — never a hostile or a secret token", () => {
    expect(
      carefulProtects({ contained: scene, casterUuid: CASTER, casterDisposition: 1, cap: 5 }).map(
        p => p.name
      )
    ).toEqual(["Gren", "Aldric", "Villager"]);
    expect(
      carefulProtects({ contained: scene, casterUuid: CASTER, casterDisposition: 1, cap: 2 }).map(
        p => p.name
      )
    ).toEqual(["Gren", "Aldric"]);
  });
  it("a hostile caster's non-hostiles are its own side and the neutrals", () => {
    const list = carefulProtects({
      contained: scene,
      casterUuid: "Actor.orc",
      casterDisposition: -1,
      cap: 5
    });
    expect(list.map(p => p.name)).toEqual(["Orc", "Villager"]);
  });
});
