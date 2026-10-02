import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: Ravenloft: The Horrors Within's rows (RULINGS *Ravenloft: The Horrors Within*; the register
 * audits/ravenloft-register.md) — every row on a table that exists, the one new TABLE (MISHAPS — not a kind), the facets the
 * book added read where the tables are read. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/clock.js")} */
let clock;
/** @type {typeof import("../scripts/decide/reminders.js")} */
let rem;
/** @type {typeof import("../scripts/decide/initiative-grants.js")} */
let init;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
  clock = await import("../scripts/decide/clock.js");
  rem = await import("../scripts/decide/reminders.js");
  init = await import("../scripts/decide/initiative-grants.js");
});

const RHW = /^Compendium\.dnd-ravenloft-horrors-within\./;

describe("the mishaps — a 1 on the d20 demands the dark gift's save (MISHAPS, a table, not a kind)", () => {
  it("six dark gifts, each naming its save activity as the pack spells it, each pointing at the book", () => {
    expect(Object.keys(reg.MISHAPS).sort()).toEqual([
      "Aberrant Anatomy",
      "Echoing Soul",
      "Gathered Whispers",
      "Living Shadow",
      "Symbiotic Being",
      "Watchers"
    ]);
    expect(reg.MISHAPS["Aberrant Anatomy"].activity).toBe("Warping Flesh");
    expect(reg.MISHAPS["Echoing Soul"].activity).toBe("Intrusive Echos");
    expect(reg.MISHAPS.Watchers.activity).toBe("Incessant Watchers");
    for (const row of Object.values(reg.MISHAPS)) {
      expect(typeof row.activity).toBe("string");
      expectPointer(row.rule);
      expect(row.rule.uuid).toMatch(RHW);
    }
    expect(reg.mishapEntries().map(e => e.kind)).toHaveLength(6);
  });
  it("the landed effects repeat (REPEAT_SAVES): Paranoia at the turn end, Symbiotic Agenda's Charmed on damage", () => {
    expect(reg.REPEAT_SAVES.Watchers).toMatchObject({
      effect: "Paranoia",
      activity: "Incessant Watchers",
      on: ["turnEnd"]
    });
    expect(reg.REPEAT_SAVES["Symbiotic Being"]).toMatchObject({
      effect: "Symbiotic Agenda (Charmed)",
      activity: "Symbiotic Agenda",
      on: ["damaged"]
    });
  });
  it("Paranoia is a bend on attacks and saves (EFFECT_BENDS)", () => {
    expect(reg.EFFECT_BENDS.Paranoia).toMatchObject({
      attacker: "disadvantage",
      saves: { bend: "disadvantage" }
    });
  });
});

describe("the roller's own failed save or check lifted — Steel Yourself, Sustained Symbiosis, Knowledge from a Past Life", () => {
  it("Steel Yourself: a self die row, the Proficiency Bonus flat, against Charmed or Frightened, the activity's own use", () => {
    const row = reg.INTERRUPT_ROLLS["Survivor (Ravenloft)"];
    expect(row).toMatchObject({
      only: "self",
      bend: "die",
      die: "@prof",
      on: "miss",
      reaction: true,
      uses: false,
      activity: "Steel Yourself",
      tests: ["save"],
      against: ["charmed", "frightened"]
    });
    expect(reg.INTERRUPTS).toContainEqual({ name: "Survivor (Ravenloft)", kind: "roll" });
    expectPointer(row.rule);
  });
  it("the Survivor feat's key is told apart from the Fighter's Survivor: an alias to the identifier, the feat subtype pinned", () => {
    expect(reg.ALIASES["Survivor (Ravenloft)"]).toBe("survivor");
    expect(reg.identifierOf("Survivor (Ravenloft)")).toBe("survivor");
    expect(reg.FEATURE_TYPES["Survivor (Ravenloft)"]).toBe("feat");
    expect(reg.FEATURE_TYPES.Survivor).toBe("class");
    const feat = {
      type: "feat",
      name: "Survivor",
      system: { identifier: "survivor", type: { value: "feat", subtype: "origin" } }
    };
    const classFeature = {
      type: "feat",
      name: "Survivor",
      system: { identifier: "survivor", type: { value: "class" } }
    };
    expect(reg.matchOf("Survivor (Ravenloft)", feat)).toBe("identifier");
    expect(reg.matchOf("Survivor (Ravenloft)", classFeature)).toBe(null);
    expect(reg.matchOf("Survivor", classFeature)).toBe("identifier");
    expect(reg.matchOf("Survivor", feat)).toBe(null);
  });
  it('Sustained Symbiosis adds a Hit Die (`die: "hitDie"`); Knowledge from a Past Life 1d6 on a CHECK, no Reaction', () => {
    expect(reg.INTERRUPT_ROLLS["Symbiotic Being"]).toMatchObject({
      only: "self",
      bend: "die",
      die: "hitDie",
      on: "miss",
      reaction: true,
      uses: true,
      tests: ["save"]
    });
    expect(reg.INTERRUPT_ROLLS["Knowledge from a Past Life"]).toMatchObject({
      only: "self",
      bend: "die",
      die: "1d6",
      on: "miss",
      reaction: false,
      uses: true,
      tests: ["check"]
    });
    expect(reg.INTERRUPTS).toContainEqual({ name: "Symbiotic Being", kind: "roll" });
    expect(reg.INTERRUPTS).toContainEqual({ name: "Knowledge from a Past Life", kind: "roll" });
  });
  it("Touch of Death's feat is told apart from Ankhtepot's action by the subtype; Death Touch ignores Necrotic Resistance on Chill Touch alone", () => {
    expect(reg.FEATURE_TYPES["Touch of Death"]).toBe("feat");
    expect(reg.DAMAGE_RULES["Touch of Death"]).toMatchObject({
      ignores: "resistance",
      types: ["necrotic"],
      spells: true,
      spell: "Chill Touch",
      feat: true
    });
    expect(reg.DAMAGE_RULES["Grave Touched"]).toMatchObject({
      ignores: "resistance",
      types: ["necrotic"],
      feat: true
    });
    expect(reg.DAMAGE_RULES["Grave Touched"].spell).toBeUndefined();
    expect(reg.DAMAGE_RULES["Empowered Channeling"]).toMatchObject({
      spells: true,
      classes: ["bard"],
      bonus: "1d6",
      once: "turn"
    });
  });
});

describe("the hold and the reductions — Sentinel at Death's Door, Deflect Blow", () => {
  it("Sentinel at Death's Door is Uncanny Dodge's half on the hit on you; the activity pays, no row `uses`", () => {
    expect(reg.INTERRUPT_MULTIPLIERS["Sentinel at Death's Door"]).toMatchObject({
      multiplier: 0.5
    });
    expect(reg.INTERRUPT_MULTIPLIERS["Sentinel at Death's Door"].uses).toBeUndefined();
    expect(reg.INTERRUPTS).toContainEqual({ name: "Sentinel at Death's Door", kind: "damage" });
  });
  it("Deflect Blow reduces by the row's own 1d10 (`amount`) for Laurie or a creature within 5 ft", () => {
    expect(reg.INTERRUPT_REDUCTIONS["Deflect Blow"]).toMatchObject({
      activity: "Damage Reduction",
      amount: "1d10",
      ally: 5
    });
    expect(reg.INTERRUPTS).toContainEqual({ name: "Deflect Blow", kind: "damage" });
  });
});

describe("the clock riders — Pull of Death, Ominous Strikes, Path to the Grave, Wails from the Grave", () => {
  it("Pull of Death is Dreadful Strikes' die on a damaged target once per turn", () => {
    expect(reg.CLOCK_RIDERS["circle-of-mortality-pull-of-death"]).toMatchObject({
      feature: "Circle of Mortality",
      activity: "Pull of Death",
      when: "oncePerTurn",
      judge: "targetDamaged"
    });
  });
  it("Ominous Strikes: the Wisdom modifier against a Frightened target (`targetStatus`) — riderDue reads it three-valued", () => {
    const row = reg.CLOCK_RIDERS["ancient-might-ominous-strikes"];
    expect(row).toMatchObject({
      feature: "Ancient Might",
      amount: "@abilities.wis.mod",
      targetStatus: "frightened",
      when: "any"
    });
    expect(clock.riderDue(row, { targetStatus: true }).due).toBe(true);
    expect(clock.riderDue(row, { targetStatus: false })).toMatchObject({
      due: false,
      why: "the target is not frightened"
    });
    expect(clock.riderDue(row, { targetStatus: null }).due).toBe(false);
    expect(clock.riderDue(reg.CLOCK_RIDERS["dreadful-strikes"], { weapon: true }).due).toBe(true); // a row without the facet is untouched
  });
  it("Path to the Grave: anyone's hit on the cleric's Cursed target (`owner: \"marker\"`), the curse ending with it, a pick", () => {
    expect(reg.CLOCK_RIDERS["path-to-the-grave"]).toMatchObject({
      feature: "Path to the Grave",
      activity: "End Curse Early",
      marked: "Cursed (Path to the Grave)",
      owner: "marker",
      endsMark: true,
      unticked: true,
      type: "necrotic"
    });
    expect(reg.EFFECT_BENDS["Cursed (Path to the Grave)"]).toMatchObject({
      attacker: "disadvantage",
      saves: { bend: "disadvantage" }
    });
    expect(reg.EFFECT_BENDS["Cursed (Path to the Grave)"].rule.uuid).toMatch(RHW);
  });
  it("Wails from the Grave spreads from the Sneak Attack's target within 30 ft, a use of the feature", () => {
    expect(reg.CLOCK_RIDERS["wails-from-the-grave"]).toMatchObject({
      feature: "Wails from the Grave",
      requires: "sneak",
      spread: 30,
      uses: true,
      when: "oncePerTurn"
    });
    expect(reg.CLOCK_RIDERS["wails-from-the-grave"].marked).toBeUndefined();
    expect(
      clock.riderDue(reg.CLOCK_RIDERS["wails-from-the-grave"], {
        sneakArmed: false,
        usesLeft: 1,
        marked: true
      })
    ).toMatchObject({ due: false, why: "no Sneak Attack armed on this hit" });
    expect(
      clock.riderDue(reg.CLOCK_RIDERS["wails-from-the-grave"], {
        sneakArmed: true,
        usesLeft: 0,
        marked: true
      })
    ).toMatchObject({ due: false, why: "no uses left" });
  });
});

describe("the heals and the drops — Keeper of Souls, Hungering Might, Strength of the Grave, Persistent Wrath", () => {
  it("Keeper of Souls: a kill within 60 ft, the heal offered (`pick`), the feature's use spent", () => {
    expect(reg.HEAL_ON_HIT["Divine Reaper"]).toMatchObject({
      on: "kill",
      within: 60,
      pick: true,
      self: true,
      uses: true,
      activity: "Keeper of Souls"
    });
  });
  it('Hungering Might: the heal on the bearer\'s own hit while Ghastly Form stands, Bloodied, once per turn (`on: "hit"`)', () => {
    expect(reg.HEAL_ON_HIT["Wrath of the Wild"]).toMatchObject({
      on: "hit",
      activity: "Hungering Might",
      while: "Ghastly Form",
      bloodied: true,
      once: "turn"
    });
  });
  it("Strength of the Grave: the dice decide (Charisma, DC 5 + damage), the success SETS the Hit Points and spends the use", () => {
    expect(reg.DROP_TO_ONE["Power of Shadow"]).toMatchObject({
      ask: false,
      uses: true,
      spendOn: "success",
      heal: "Heal on Success",
      sets: true,
      save: { ability: "cha", dc: "5 + damage" }
    });
    expect(reg.DROP_TO_ONE["Relentless Rage"].spendOn).toBeUndefined();
  });
  it("Persistent Wrath: the ask while Ghastly Form stands, the Hit Points SET to the roll", () => {
    expect(reg.DROP_TO_ONE["Ancient Might"]).toMatchObject({
      ask: true,
      uses: true,
      while: "Ghastly Form",
      heal: "Persistent Wrath",
      sets: true
    });
  });
  it("Return to Life: Supreme Healing's maximum for a creature at 0 alone (`atZero`)", () => {
    expect(reg.HEAL_REROLLS["Circle of Mortality"]).toMatchObject({
      max: true,
      caster: true,
      atZero: true
    });
    expect(reg.HEAL_REROLLS["Supreme Healing"].atZero).toBeUndefined();
  });
});

describe("the auras, the rebukes, the bends and the Initiative — the Hollow Warden and the bestiary", () => {
  it("Unnerving Aura is Frozen Haunt's ring: while Ghastly Form, a SAVE pulse at the ranger's turn start, off while Incapacitated", () => {
    expect(reg.EMANATIONS["Wrath of the Wild"]).toMatchObject({
      kind: "feature",
      while: "Ghastly Form",
      reach: "harmful",
      incapacitated: true,
      pulse: { on: "sourceTurnStart", activity: "Unnerving Aura" }
    });
  });
  it("the bestiary's auras: Terrifying Aura (enemies, turn start, off while Incapacitated), Viral Aura / Deathly Stench (any, turn start), Possessive Aura (turn end)", () => {
    expect(reg.EMANATIONS["Terrifying Aura"]).toMatchObject({
      reach: "harmful",
      incapacitated: true,
      trigger: { on: ["turnStart"], oncePerTurn: true }
    });
    expect(reg.EMANATIONS["Viral Aura"]).toMatchObject({
      reach: "all",
      trigger: { on: ["turnStart"] }
    });
    expect(reg.EMANATIONS["Deathly Stench"]).toMatchObject({
      reach: "all",
      trigger: { on: ["turnStart"] }
    });
    expect(reg.EMANATIONS["Possessive Aura"]).toMatchObject({
      reach: "all",
      trigger: { on: ["turnEnd"] }
    });
  });
  it("Prowling Retribution: an Opportunity Attack when a creature within 5 ft damages the ranger OR an ally (`ward` + `wardAlso`), while the form stands", () => {
    expect(reg.REBUKES["Wrath of the Wild"]).toMatchObject({
      attack: "melee",
      range: 5,
      ward: true,
      wardAlso: true,
      opportunity: true,
      while: "Ghastly Form"
    });
    expect(reg.REBUKES.Sentinel.wardAlso).toBeUndefined();
  });
  it("Mist Walk is Misty Escape's row; Mark of Obsession Hellish Rebuke's; Cold Sprint Elemental Absorption's on Cold", () => {
    expect(reg.REBUKES["Mist Walker"]).toMatchObject({ activity: "Mist Walk", self: true });
    expect(reg.REBUKES["Mark of Obsession"]).toMatchObject({ activity: null });
    expect(reg.REBUKES["Cold Sprint"]).toMatchObject({
      activity: null,
      self: true,
      types: ["cold"]
    });
  });
  it('Terrorizer: Advantage against a Frightened target (`judge: "targetStatus"`) — the edge reads the target\'s statuses', () => {
    expect(reg.EFFECT_BENDS.Terrorizer).toMatchObject({
      match: "feature",
      attacker: "advantage",
      judge: "targetStatus",
      status: "frightened"
    });
    const facts = {
      attacker: { uuid: "A", features: ["Terrorizer"], effects: [] },
      enabled: ["terrorizer"],
      table: reg.EFFECT_BENDS,
      pass: "target"
    };
    const on = rem.effectSources({
      ...facts,
      target: { uuid: "T", effects: [], features: [], statuses: ["frightened"] }
    });
    const off = rem.effectSources({
      ...facts,
      target: { uuid: "T", effects: [], features: [], statuses: [] }
    });
    expect(on.some(s => /Terrorizer/.test(s.label ?? s.name ?? JSON.stringify(s)))).toBe(true);
    expect(off.some(s => /Terrorizer/.test(s.label ?? s.name ?? JSON.stringify(s)))).toBe(false);
  });
  it("Incomprehensible Form is Displacement's row; Susceptible to Charm a save bend against Charmed", () => {
    expect(reg.EFFECT_BENDS["Incomprehensible Form"]).toMatchObject({
      match: "feature",
      target: "disadvantage",
      judge: "notIncapacitated"
    });
    expect(reg.EFFECT_BENDS["Susceptible to Charm"]).toMatchObject({
      match: "feature",
      saves: { bend: "disadvantage", statuses: ["charmed"] }
    });
  });
  it("Hypervigilance: the Initiative d20 of 9 or lower offered a reroll, nothing regained; the card's line", () => {
    expect(reg.INITIATIVE_GRANTS["Survivor (Ravenloft)"]).toMatchObject({
      reroll: 9,
      ask: true,
      regain: null
    });
    expect(
      init.initiativeGrantLine({
        row: "Survivor (Ravenloft)",
        status: "resolved",
        answer: "yes",
        reroll: { face: 4, under: 9, from: 6 }
      })
    ).toMatch(/rerolling/);
    expect(
      init.initiativeGrantLine({
        row: "Survivor (Ravenloft)",
        status: "pending",
        answer: null,
        reroll: { face: 4, under: 9, from: 6 }
      })
    ).toMatch(/shows 4 .*reroll/);
    expect(
      init.initiativeGrantLine({
        row: "Survivor (Ravenloft)",
        status: "resolved",
        answer: "yes",
        applied: true,
        reroll: { face: 4, under: 9, from: 6 },
        rerolled: { from: 6, to: 17 }
      })
    ).toMatch(/6 → 17/);
    expect(
      init.initiativeGrantLine({
        row: "Survivor (Ravenloft)",
        status: "resolved",
        answer: "no",
        reroll: { face: 4, under: 9, from: 6 }
      })
    ).toMatch(/kept for later/);
  });
  it("Ravenous Bites deals the trait's die at the Poisoned creature's turn start (Spores' row)", () => {
    expect(reg.TURN_GRANTS["Ravenous Bites"]).toMatchObject({
      effect: "Poisoned",
      activity: null,
      on: "turnStart",
      deals: true
    });
  });
  it("every Ravenloft row points at the book", () => {
    const rows = [
      reg.INTERRUPT_MULTIPLIERS["Sentinel at Death's Door"],
      reg.INTERRUPT_REDUCTIONS["Deflect Blow"],
      reg.HEAL_ON_HIT["Divine Reaper"],
      reg.DROP_TO_ONE["Power of Shadow"],
      reg.DROP_TO_ONE["Ancient Might"],
      reg.EMANATIONS["Wrath of the Wild"],
      reg.REBUKES["Mist Walker"],
      reg.REBUKES["Mark of Obsession"],
      reg.REBUKES["Cold Sprint"],
      reg.EFFECT_BENDS.Terrorizer,
      reg.DAMAGE_RULES["Touch of Death"],
      reg.HEAL_REROLLS["Circle of Mortality"],
      reg.INITIATIVE_GRANTS["Survivor (Ravenloft)"],
      reg.TURN_GRANTS["Ravenous Bites"]
    ];
    for (const row of rows) {
      expectPointer(row.rule);
      expect(row.rule.uuid).toMatch(RHW);
    }
  });
});
