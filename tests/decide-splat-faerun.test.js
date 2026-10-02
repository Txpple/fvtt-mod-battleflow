import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: Heroes of Faerûn's rows (RULINGS *Heroes of Faerûn*; the register audits/faerun-register.md) — every row
 * on a table that exists, the facets the book added read where the tables are read. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
});

const FAERUN = /^Compendium\.dnd-heroes-faerun\./;

describe("the Bloodied moment, watched — Bloodthirst; the hit's saves — Chilling Retribution, Elemental Rebuke", () => {
  it('Bloodthirst is a rebuke judged on an ENEMY becoming Bloodied (`judge: "enemyBloodied"`), its reach the activity\'s', () => {
    expect(reg.REBUKES.Bloodthirst).toMatchObject({ activity: null, judge: "enemyBloodied" });
    expect(reg.REBUKES.Bloodthirst.self).toBeUndefined();
    expect(reg.REBUKES.Bloodthirst.hit).toBeUndefined();
    expectPointer(reg.REBUKES.Bloodthirst.rule);
  });
  it("Chilling Retribution is Warding Charm's row; Zhentarim Tactics' Retaliate an Opportunity Attack on a MELEE hit alone", () => {
    expect(reg.REBUKES["Chilling Retribution"]).toMatchObject({ activity: null, hit: true });
    expect(reg.REBUKES["Zhentarim Tactics"]).toMatchObject({
      attack: "melee",
      range: 5,
      hit: true,
      hitMelee: true,
      opportunity: true
    });
    expect(reg.REBUKES.Sentinel.hitMelee).toBeUndefined();
  });
  it("Elminster's Effulgent Spheres' Absorb Energy is Elemental Absorption's row on a spell (five types, self)", () => {
    expect(reg.REBUKES["Elminster's Effulgent Spheres"]).toMatchObject({
      activity: "Absorb Energy",
      self: true,
      types: ["acid", "cold", "fire", "lightning", "thunder"]
    });
    expect(reg.ALIASES["Elminster's Effulgent Spheres"]).toBe("effulgent-spheres");
  });
  it("Elemental Rebuke is Beguiling Defenses' row — the half and the paladin's save at the attacker; the activity pays", () => {
    expect(reg.INTERRUPT_MULTIPLIERS["Elemental Rebuke"]).toMatchObject({
      multiplier: 0.5,
      at: "attacker"
    });
    // The Rebuke activity consumes the feature's use itself: a row `uses` would spend it twice and leave the cast unpaid.
    expect(reg.INTERRUPT_MULTIPLIERS["Elemental Rebuke"].uses).toBeUndefined();
    expect(reg.INTERRUPT_MULTIPLIERS["Elemental Rebuke"].failDamage).toBeUndefined();
    expect(reg.INTERRUPTS).toContainEqual({ name: "Elemental Rebuke", kind: "damage" });
    expectPointer(reg.INTERRUPT_MULTIPLIERS["Elemental Rebuke"].rule);
  });
});

describe("Shared Resilience — a friend's reroll with the fighter's level", () => {
  it("a reroll bystander within 60 ft on a save, a `bonus` read off the answerer, Indomitable's uses the pool", () => {
    expect(reg.INTERRUPT_ROLLS["Shared Resilience"]).toMatchObject({
      bystander: 60,
      tests: ["save"],
      bend: "reroll",
      bonus: "@classes.fighter.levels",
      reaction: true,
      uses: true,
      activity: null
    });
    expect(reg.INTERRUPT_ROLLS["Shared Resilience"].advantage).toBeUndefined();
    expect(reg.INTERRUPTS).toContainEqual({ name: "Shared Resilience", kind: "roll" });
    expectPointer(reg.INTERRUPT_ROLLS["Shared Resilience"].rule);
  });
});

describe("the Winter Walker — Frigid Explorer, Hunter's Rime, Frozen Haunt", () => {
  it("Biting Cold ignores Cold Resistance (a DAMAGE_RULES feat row, no face); Polar Strikes ride a weapon hit once per turn", () => {
    expect(reg.DAMAGE_RULES["Frigid Explorer"]).toMatchObject({
      gate: "always",
      feat: true,
      ignores: "resistance",
      types: ["cold"]
    });
    expect(reg.CLOCK_RIDERS["frigid-explorer-polar-strikes"]).toMatchObject({
      feature: "Frigid Explorer",
      activity: "Polar Strike",
      when: "oncePerTurn",
      weapon: true
    });
    expect(reg.DAMAGE_RULES["Spellfire Adept"]).toMatchObject({
      gate: "always",
      feat: true,
      ignores: "resistance",
      types: ["radiant"]
    });
  });
  it("Hunter's Rime: a cast rider that USES the feature's heal on the ranger after Hunter's Mark", () => {
    expect(reg.CAST_RIDERS["Hunter's Rime"]).toMatchObject({
      after: "Hunter's Mark",
      use: "Heal and Apply Rime"
    });
    expect(reg.CAST_RIDERS["Hunter's Rime"].handOut).toBeUndefined();
  });
  it("Frozen Haunt: a feature ring while Frozen Soul stands, its pulse at the ranger's turn START", () => {
    expect(reg.EMANATIONS["Frozen Haunt"]).toMatchObject({
      kind: "feature",
      item: "Frozen Haunt",
      while: "Frozen Soul",
      reach: "harmful",
      pulse: { on: "sourceTurnStart", activity: "Frozen Soul" }
    });
    expect(reg.EMANATIONS["Inner Radiance"].pulse.on).toBe("sourceTurnEnd");
  });
  it("Fortifying Soul and Crown of Spellfire: the save bend and the Evasion against spells while the effect stands", () => {
    expect(reg.EFFECT_BENDS["Fortifying Soul"]).toMatchObject({
      saves: { bend: "advantage", statuses: ["frightened"] }
    });
    expect(reg.EVASIONS["Crown of Spellfire"]).toMatchObject({
      ability: null,
      spells: true,
      effect: "Crown of Spellfire",
      item: "Crown of Spellfire"
    });
  });
});

describe("the feats and the Scion — Fairy Trickster, Strike Fear, the bends", () => {
  it("Flustering Strike: a save per ability the feat may raise (`activities`), unticked, the feat's uses", () => {
    const row = reg.CLOCK_RIDERS["fairy-trickster-flustering-strike"];
    expect(row).toMatchObject({
      feature: "Fairy Trickster",
      activity: null,
      activities: { cha: "Save Using Charisma", dex: "Save Using Dexterity" },
      save: true,
      uses: true,
      unticked: true,
      when: "any"
    });
    expect(reg.EFFECT_BENDS.Flustered).toMatchObject({ saves: { bend: "disadvantage" } });
    expectPointer(row.rule);
  });
  it("Strike Fear's Terrify is a Cunning Strike option (1d6) whose Frightened repeats at the turn end", () => {
    expect(reg.CUNNING_OPTIONS.terrify).toMatchObject({
      feature: "Strike Fear",
      activity: "Terrify",
      cost: 1
    });
    expect(reg.REPEAT_SAVES["Strike Fear"]).toMatchObject({
      effect: "Strike Fear: Terrify",
      activity: "Terrify",
      on: ["turnEnd"]
    });
    expect(reg.EFFECT_BENDS["Strike Fear: Terrify"]).toMatchObject({
      target: "advantage",
      only: "source"
    });
  });
  it("the bends: Team Tactics (every D20 Test), Bolstered, Stronger Together, Elminster's Elusion (Circle of Power's), Shielded (ranged)", () => {
    expect(reg.EFFECT_BENDS["Team Tactics"]).toMatchObject({
      attacker: "advantage",
      checks: "advantage",
      saves: { bend: "advantage" }
    });
    expect(reg.EFFECT_BENDS.Bolstered).toMatchObject({
      saves: { bend: "advantage", statuses: ["charmed", "frightened"] }
    });
    expect(reg.EFFECT_BENDS["Stronger Together"]).toMatchObject({
      saves: { bend: "advantage", abilities: ["str"] }
    });
    expect(reg.EFFECT_BENDS["Elminster's Elusion"]).toMatchObject({
      saves: { bend: "advantage", spells: true, halfToNone: true }
    });
    expect(reg.EFFECT_BENDS.Shielded).toMatchObject({ target: "disadvantage", scope: "ranged" });
    for (const key of [
      "Team Tactics",
      "Bolstered",
      "Stronger Together",
      "Elminster's Elusion",
      "Shielded",
      "Flustered",
      "Fortifying Soul"
    ]) {
      expectPointer(reg.EFFECT_BENDS[key].rule, key);
      expect(reg.EFFECT_BENDS[key].rule.uuid, key).toMatch(FAERUN);
    }
  });
});

describe("the spells and the bestiary", () => {
  it("the pulsing Emanations: Cacophonic Shield and Dirge on the caster, Doomtide and Spellfire Storm placed", () => {
    expect(reg.EMANATIONS["Cacophonic Shield"]).toMatchObject({
      kind: "spell",
      activity: "Save",
      reach: "harmful",
      trigger: { on: ["enter", "turnEnd"], oncePerTurn: true }
    });
    expect(reg.EMANATIONS.Dirge).toMatchObject({
      kind: "spell",
      activity: "Cast and Save",
      reach: "harmful"
    });
    expect(reg.EMANATIONS.Doomtide).toMatchObject({
      kind: "area",
      activity: "Cast and Save",
      reach: "all"
    });
    expect(reg.EMANATIONS["Spellfire Storm"]).toMatchObject({
      kind: "area",
      activity: "Cast and Save",
      reach: "all"
    });
  });
  it("Laeral's Silver Lance chooses its targets (an alias to the pack's identifier); Mechanical Determination is Undead Fortitude with Lightning", () => {
    expect(reg.CHOSEN_AREAS["Laeral's Silver Lance"].data).toMatch(/of your choice/);
    expect(reg.ALIASES["Laeral's Silver Lance"]).toBe("silver-lance");
    expect(reg.identifierOf("Laeral's Silver Lance")).toBe("silver-lance");
    expect(reg.DROP_TO_ONE["Mechanical Determination"]).toMatchObject({
      ask: false,
      outright: false,
      save: { ability: "con", dc: "5 + damage", unless: ["lightning", "crit"] }
    });
  });
  it("the Command SPELL's press answers spells alone — the construct's \"Command\" action is not the spell", () => {
    expect(reg.SAVE_PRESSES.Command.types).toEqual(["spell"]);
    expect(reg.SAVE_PRESSES.Web.types).toBeUndefined();
  });
  it("every Faerûn row's pointer names the book; no new kind — the tripwire stands", () => {
    let pointers = 0;
    for (const table of Object.values(reg)) {
      if (!table || typeof table !== "object" || Array.isArray(table) || table instanceof Set)
        continue;
      for (const row of Object.values(table)) {
        if (row?.rule?.uuid && FAERUN.test(row.rule.uuid)) {
          pointers++;
          expectPointer(row.rule);
        }
      }
    }
    expect(pointers).toBeGreaterThanOrEqual(28);
    expect(reg.KIND_SETS.reduce((n, s) => n + s.kinds.size, 0)).toBe(40);
  });
});
