import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: Arcana Unleashed's rows (RULINGS *Arcana Unleashed*; the register audits/arcana-register.md) —
 * every row on a table that exists, the facets the book added read where the tables are read. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/hit-menu.js")} */
let hm;
/** @type {typeof import("../scripts/decide/initiative-grants.js")} */
let ig;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  hm = await import("../scripts/decide/hit-menu.js");
  ig = await import("../scripts/decide/initiative-grants.js");
});

const ARCANA = /^Compendium\.dnd-arcana-unleashed\./;

describe("Arcane Shot — a hit-menu group with its own turn chit", () => {
  it("the group pays from the Arcane Shot item's uses, one option per hit, each option its own die", () => {
    const g = reg.HIT_GROUPS["arcane-shot"];
    expect(g).toMatchObject({
      feature: "Arcane Shot",
      pool: "feature",
      ownDice: true,
      max: 1,
      dieLabel: "use"
    });
    expectPointer(g.rule);
    expect(g.rule.uuid).toMatch(ARCANA);
  });
  it("six options: five saves whose dice ride the hit (saveDice + save), Bursting Shot's die riding it too; all once per turn for the group, on an Ammunition weapon", () => {
    const options = Object.entries(reg.HIT_OPTIONS).filter(([, r]) => r.group === "arcane-shot");
    expect(options.map(([k]) => k).sort()).toEqual([
      "banishing-shot",
      "beguiling-shot",
      "bursting-shot",
      "enfeebling-shot",
      "grasping-shot",
      "shadow-shot"
    ]);
    for (const [key, row] of options) {
      expect(row, key).toMatchObject({
        oncePerTurn: true,
        onceKey: "arcane-shot",
        weapons: "ammunition"
      });
      expectPointer(row.rule, key);
      expect(row.rule.uuid, key).toMatch(ARCANA);
      if (key === "bursting-shot") expect(row).toMatchObject({ ownType: true });
      else expect(row, key).toMatchObject({ save: true, saveDice: true, ownType: true });
      expect(row.noDie, key).toBeUndefined(); // the dice ride the hit; the save follows without them
    }
    // Piercing and Seeking Shot replace the attack roll: text, no row.
    expect(
      Object.values(reg.HIT_OPTIONS).some(r => /Piercing Shot|Seeking Shot/.test(r.feature))
    ).toBe(false);
  });
  it("optionReaches: an `ammunition` row needs a ranged Ammunition weapon — a Longsword hit offers none", () => {
    const row = reg.HIT_OPTIONS["beguiling-shot"];
    const base = { row, unarmed: false, weapon: true, monkWeapon: false, own: false, flurry: null };
    expect(hm.optionReaches({ ...base, ammunition: true })).toBe(true);
    expect(hm.optionReaches({ ...base, ammunition: false })).toBe(false);
    expect(hm.optionReaches({ ...base })).toBe(false);
    // An unlisted row never reads the fact.
    expect(hm.optionReaches({ ...base, row: reg.HIT_OPTIONS["trip-attack"] })).toBe(true);
  });
  it("hitMenu greys every option of the group once its shared chit stands (the caller keys `used` by onceKey)", () => {
    const groups = { "arcane-shot": reg.HIT_GROUPS["arcane-shot"] };
    const options = Object.fromEntries(
      Object.entries(reg.HIT_OPTIONS).filter(([, r]) => r.group === "arcane-shot")
    );
    const listed = Object.values(options).map(r => r.feature);
    const features = ["Arcane Shot", ...listed];
    const used = Object.fromEntries(Object.keys(options).map(k => [k, true]));
    const dice = {
      "bursting-shot": { die: "2d6", type: "force" },
      "beguiling-shot": { die: "2d6", type: "psychic" },
      "banishing-shot": { die: "1d6", type: "psychic" },
      "enfeebling-shot": { die: "2d6", type: "necrotic" },
      "grasping-shot": { die: "1d6", type: "slashing" },
      "shadow-shot": { die: "1d6", type: "psychic" }
    };
    const pools = { "arcane-shot": { left: 2, max: 3, die: null } };
    const menu = hm.hitMenu({ groups, options, listed, features, melee: false, pools, used, dice });
    expect(menu.groups).toHaveLength(1);
    for (const r of menu.groups[0].rows) expect(r.cost, r.key).toBe("used this turn");
    const fresh = hm.hitMenu({ groups, options, listed, features, melee: false, pools, dice });
    expect(fresh.groups[0].rows.find(r => r.key === "beguiling-shot")).toMatchObject({
      affordable: true,
      save: true,
      cost: "2d6 psychic · 1 use"
    });
    expect(fresh.groups[0].rows.find(r => r.key === "bursting-shot")).toMatchObject({
      affordable: true,
      cost: "2d6 force · 1 use"
    });
    // A save-dice row whose die could not be read is not payable (the die rides the hit — never a guessed number).
    const unread = hm.hitMenu({ groups, options, listed, features, melee: false, pools, dice: {} });
    expect(unread.groups[0].rows.find(r => r.key === "shadow-shot")).toMatchObject({
      affordable: false
    });
  });
});

describe("the Initiative grant with a count — Ever-Ready Shot", () => {
  it("the row regains ONE Arcane Shot use at Initiative, asked", () => {
    expect(reg.INITIATIVE_GRANTS["Ever-Ready Shot"]).toMatchObject({
      regain: "Arcane Shot",
      count: 1,
      ask: true
    });
    expectPointer(reg.INITIATIVE_GRANTS["Ever-Ready Shot"].rule);
  });
  it("initiativeGrantDue: `count` comes back one at a time, never more than are spent", () => {
    expect(
      ig.initiativeGrantDue({ own: { max: 0, value: 0 }, regain: { max: 3, spent: 2 }, count: 1 })
    ).toMatchObject({ due: true, why: "1 expended" });
    expect(
      ig.initiativeGrantDue({ own: { max: 0, value: 0 }, regain: { max: 3, spent: 0 }, count: 1 })
    ).toMatchObject({ due: false });
    expect(
      ig.initiativeGrantDue({ own: { max: 1, value: 0 }, regain: { max: 3, spent: 2 }, count: 1 })
    ).toMatchObject({ due: false, why: "used since the last Long Rest" });
  });
});

describe("the save bystanders on a failed save — Arcane Omens, Transmuted Anatomy, Spell Resistant", () => {
  it("Arcane Omens: 1d4 to a friend's or its own save within 30 ft, a Reaction and a use of Helpful Premonition", () => {
    expect(reg.INTERRUPT_ROLLS["Arcane Omens"]).toMatchObject({
      bystander: 30,
      tests: ["save"],
      bend: "die",
      sign: 1,
      die: "1d4",
      on: "miss",
      self: true,
      reaction: true,
      uses: true,
      activity: "Helpful Premonition"
    });
  });
  it('the two own-save rows: the roller alone (`only: "self"`), one on Constitution saves, one against a spell', () => {
    expect(reg.INTERRUPT_ROLLS["Transmuted Anatomy"]).toMatchObject({
      only: "self",
      self: true,
      tests: ["save"],
      die: "1d4",
      abilities: ["con"],
      reaction: true,
      activity: null
    });
    expect(reg.INTERRUPT_ROLLS["Spell Resistant"]).toMatchObject({
      only: "self",
      self: true,
      tests: ["save"],
      die: "1d6",
      spells: true,
      reaction: false,
      activity: "Magic Resistant"
    });
  });
  it("every one is a `roll` interrupt and points at the book", () => {
    for (const name of ["Arcane Omens", "Transmuted Anatomy", "Spell Resistant"]) {
      expect(reg.INTERRUPTS).toContainEqual({ name, kind: "roll" });
      expectPointer(reg.INTERRUPT_ROLLS[name].rule, name);
      expect(reg.INTERRUPT_ROLLS[name].rule.uuid, name).toMatch(ARCANA);
    }
  });
});

describe("the rebukes — the Bloodied moment, the hit's save, the miss on any attack", () => {
  it('Harvest Undead fires when the bearer BECOMES Bloodied (`judge: "becameBloodied"`), aimed at nobody', () => {
    expect(reg.REBUKES["Harvest Undead"]).toMatchObject({
      activity: null,
      self: true,
      judge: "becameBloodied"
    });
    expectPointer(reg.REBUKES["Harvest Undead"].rule);
  });
  it("Instinctive Charm is Warding Charm's row (the hit's save at the attacker), Masterful Shots a miss row on ANY attack roll", () => {
    expect(reg.REBUKES["Instinctive Charm"]).toMatchObject({ activity: null, hit: true });
    expect(reg.REBUKES["Masterful Shots"]).toMatchObject({ on: "miss", missOf: "any", self: true });
    expect(reg.REBUKES["Sticky Shield"].missOf).toBeUndefined();
    for (const n of ["Instinctive Charm", "Masterful Shots"]) expectPointer(reg.REBUKES[n].rule, n);
  });
  it("Go to Ground halves on the hold (Uncanny Dodge's row), a damage interrupt", () => {
    expect(reg.INTERRUPT_MULTIPLIERS["Go to Ground"]).toMatchObject({ multiplier: 0.5 });
    expect(reg.INTERRUPTS).toContainEqual({ name: "Go to Ground", kind: "damage" });
    expectPointer(reg.INTERRUPT_MULTIPLIERS["Go to Ground"].rule);
  });
});

describe("the magic items — the unticked riders and the dagger's reroll", () => {
  it("the four CLOCK_RIDERS rows: a worn amulet on any damage, three wielded weapons' saves, all offered unticked", () => {
    expect(reg.CLOCK_RIDERS["blood-amulet"]).toMatchObject({
      feature: "Blood Amulet",
      worn: true,
      save: true,
      uses: true,
      unticked: true,
      when: "any"
    });
    expect(reg.CLOCK_RIDERS["blood-amulet"].wields).toBeUndefined();
    for (const [key, activity] of [
      ["diamond-staff-stunning-hit", "Stunning Hit"],
      ["martialists-quarterstaff-trip", "Trip Save"]
    ]) {
      expect(reg.CLOCK_RIDERS[key], key).toMatchObject({
        wields: true,
        save: true,
        uses: true,
        unticked: true,
        melee: true,
        activity
      });
    }
    expect(reg.CLOCK_RIDERS["namers-needle-identify"]).toMatchObject({
      wields: true,
      save: true,
      unticked: true,
      activity: "Save: Identify Target"
    });
    expect(reg.CLOCK_RIDERS["namers-needle-identify"].uses).toBeUndefined();
    for (const key of [
      "blood-amulet",
      "diamond-staff-stunning-hit",
      "martialists-quarterstaff-trip",
      "namers-needle-identify"
    ]) {
      expectPointer(reg.CLOCK_RIDERS[key].rule, key);
      expect(reg.CLOCK_RIDERS[key].always, key).toBeUndefined(); // a "you can" is a pick, never an always
    }
  });
  it("Keyholes Dagger's Reroll Miss is Luck Blade's REROLLS row on an attack, and the d20 folds ship it", () => {
    expect(reg.REROLLS["Keyholes Dagger"]).toMatchObject({
      tests: ["attack"],
      bonus: null,
      wields: true,
      activity: "Reroll Miss"
    });
    expect(reg.D20_FOLDS).toContainEqual({ name: "Keyholes Dagger", kind: "reroll" });
  });
  it("Mage Breaker breaks concentration as a wielded weapon; Diamond Staff's Dazzling Light is a token light", () => {
    expect(reg.DAMAGE_RULES["Mage Breaker"]).toMatchObject({
      gate: "always",
      wields: true,
      breaks: "concentration"
    });
    expect(reg.DAMAGE_RULES["Mage Breaker"].feat).toBeUndefined();
    expect(reg.TOKEN_LIGHTS["Diamond Staff"]).toMatchObject({
      item: "Diamond Staff",
      activity: "Dazzling Light",
      on: "self",
      effect: "Dazzling Light",
      bright: 40,
      dim: 80
    });
  });
});

describe("the spells — the auras, the repeats, the drain", () => {
  it("Aura of Evasion: a spell emanation (the pack's \"Aura\"), the member copy's Dexterity Advantage and its Evasion", () => {
    expect(reg.EMANATIONS["Aura of Evasion"]).toMatchObject({
      kind: "spell",
      reach: "helpful",
      effect: "Aura"
    });
    expect(reg.EFFECT_BENDS["Aura (Aura of Evasion)"]).toMatchObject({
      named: "Aura",
      item: "Aura of Evasion",
      itemOnly: true,
      member: true,
      saves: { bend: "advantage", abilities: ["dex"] }
    });
    expect(reg.EVASIONS["Aura of Evasion"]).toMatchObject({
      ability: "dex",
      effect: "Aura",
      item: "Aura of Evasion"
    });
    expect(reg.EVASIONS["Aura of Evasion"].side).toBeUndefined();
  });
  it("Lightning Ring pulses on Spirit Guardians' trigger; Grave Ground is a placed area with the same trigger", () => {
    expect(reg.EMANATIONS["Lightning Ring"]).toMatchObject({
      kind: "spell",
      activity: "Emanation Save",
      reach: "harmful",
      trigger: { on: ["enter", "turnEnd"], oncePerTurn: true }
    });
    expect(reg.EMANATIONS["Grave Ground"]).toMatchObject({
      kind: "area",
      activity: "Grave Ground Save",
      reach: "harmful",
      trigger: { on: ["enter", "turnEnd"], oncePerTurn: true }
    });
  });
  it("the repeating saves, each on the spell's own save at the turn end", () => {
    const rows = {
      "Festering Blast": { effect: "Poisoned", activity: "Repeat Save" },
      "Entrancing Mirrors": { effect: "Stunned" },
      "Fractured Awareness": { effect: "Disadv. D20 Tests", onSave: "none" },
      "Inflict Doubt": { effect: "Disadv. D20 Tests" },
      "Uncertain Footing": { effect: "Hampered" },
      "Vision of Elapsing Eons": { effect: "Paralyzed", onSave: "none" },
      "Power Word Pain": { effect: "Power Word Pain", activity: "Repeat Save" },
      "Bellows of Strangulation": { effect: "Incapacitated", activity: "First Command Word" },
      "Frightening Appearance": { effect: "Frightened", activity: "Repeat Frightening Save" }
    };
    for (const [key, shape] of Object.entries(rows)) {
      expect(reg.REPEAT_SAVES[key], key).toMatchObject({ ...shape, on: ["turnEnd"] });
      expectPointer(reg.REPEAT_SAVES[key].rule, key);
      expect(reg.REPEAT_SAVES[key].rule.uuid, key).toMatch(ARCANA);
    }
  });
  it("Festering Blast's poison damage at the turn start is Spores' TURN_GRANTS row; Enervation heals half its Necrotic; Wither and Bloom chooses its targets", () => {
    expect(reg.TURN_GRANTS["Festering Blast"]).toMatchObject({
      effect: "Poisoned",
      activity: "Ongoing Poison Damage",
      on: "turnStart",
      deals: true
    });
    expect(reg.HEAL_ON_HIT["Enervation"]).toMatchObject({ share: 0.5, type: "necrotic" });
    expect(reg.CHOSEN_AREAS["Wither and Bloom"].data).toMatch(/of your choice/);
    expect(reg.CONCENTRATION_EXEMPTS["Focused Conjuration"]).toMatchObject({ school: "con" });
    expect(reg.CONCENTRATION_EXEMPTS["Focused Conjuration"].spell).toBeUndefined();
  });
});

describe("the bestiary and the bends", () => {
  it("Superior Magic Resistance is Spellguard Shield's row on a trait; Marshaled, Mounted Adept and the vestige's Cursed are read where they stand", () => {
    expect(reg.EFFECT_BENDS["Superior Magic Resistance"]).toMatchObject({
      match: "feature",
      target: "disadvantage",
      scope: "spell",
      saves: { bend: "advantage", spells: true }
    });
    expect(reg.EFFECT_BENDS["Marshaled"]).toMatchObject({
      attacker: "advantage",
      saves: { bend: "advantage" }
    });
    expect(reg.EFFECT_BENDS["Mounted Adept"]).toMatchObject({
      match: "feature",
      judge: "notIncapacitated",
      saves: { bend: "advantage", abilities: ["dex"] }
    });
    expect(reg.EFFECT_BENDS["Cursed (Divine Power)"]).toMatchObject({
      named: "Cursed",
      item: "Divine Power",
      itemOnly: true,
      attacker: "disadvantage"
    });
    expect(reg.EFFECT_BENDS["Wondrous Alteration"]).toMatchObject({
      saves: { bend: "advantage", abilities: ["con"] }
    });
    for (const key of [
      "Superior Magic Resistance",
      "Marshaled",
      "Mounted Adept",
      "Cursed (Divine Power)",
      "Wondrous Alteration"
    ]) {
      expectPointer(reg.EFFECT_BENDS[key].rule, key);
      expect(reg.EFFECT_BENDS[key].rule.uuid, key).toMatch(ARCANA);
      expect(reg.EFFECT_KEYS, key).toContain(key);
    }
  });
  it("every Arcana row's pointer names the book; no new kind — the tripwire stands", () => {
    let pointers = 0;
    for (const table of Object.values(reg)) {
      if (!table || typeof table !== "object" || Array.isArray(table) || table instanceof Set)
        continue;
      for (const row of Object.values(table)) {
        if (row?.rule?.uuid && ARCANA.test(row.rule.uuid)) {
          pointers++;
          expectPointer(row.rule);
        }
      }
    }
    expect(pointers).toBeGreaterThanOrEqual(40);
    expect(reg.KIND_SETS.reduce((n, s) => n + s.kinds.size, 0)).toBe(40);
  });
});
