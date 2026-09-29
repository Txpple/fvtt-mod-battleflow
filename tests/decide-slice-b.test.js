import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer: the GM's side, the five shapes (RULINGS *The GM's side — the five shapes*; the drawing
 * audits/drawings/monsters.md) — the drop-to-1 table's `save` facet and `died` row with decide/drop-to-one.js,
 * the save gate's `succeeds` against magic, the Evasion table, and the turn-start grant's feature rows with
 * the damage-since judge of decide/turn-grants.js. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/drop-to-one.js")} */
let dr;
/** @type {typeof import("../scripts/decide/reminders.js")} */
let r;
/** @type {typeof import("../scripts/decide/turn-grants.js")} */
let tg;
/** @type {typeof import("../scripts/decide/verdict.js")} */
let v;
/** @type {typeof import("../scripts/decide/rebukes.js")} */
let rb;
/** @type {typeof import("../scripts/decide/chips.js")} */
let ch;
beforeAll(async () => {
  rb = await import("../scripts/decide/rebukes.js");
  ch = await import("../scripts/decide/chips.js");
  reg = await import("../scripts/decide/registry.js");
  dr = await import("../scripts/decide/drop-to-one.js");
  r = await import("../scripts/decide/reminders.js");
  tg = await import("../scripts/decide/turn-grants.js");
  v = await import("../scripts/decide/verdict.js");
});

describe("DROP_TO_ONE — the kill moment's two sides", () => {
  it("Undead Fortitude is a `save` row: Constitution, DC 5 + the damage, never against Radiant or a Critical Hit", () => {
    const row = reg.DROP_TO_ONE["Undead Fortitude"];
    expect(Object.isFrozen(row)).toBe(true);
    expect(row).toMatchObject({
      ask: false,
      outright: false,
      save: { ability: "con", dc: "5 + damage", unless: ["radiant", "crit"] }
    });
    expect(row.uses).toBeUndefined();
    expect(row.effect).toBeUndefined();
    expectPointer(row.rule);
  });
  it("Death Throes is a `died` row — the death's side: the first save activity, used at the corpse", () => {
    const row = reg.DROP_TO_ONE["Death Throes"];
    expect(row).toMatchObject({ on: "died", activity: null });
    expect(row.save).toBeUndefined();
    expectPointer(row.rule);
    expect(reg.dropToOneEntries().map(e => e.kind)).toEqual([
      "death ward",
      "relentless endurance",
      "undead fortitude",
      "death throes",
      "spiteful escape",
      "misty escape",
      "shadow escape"
    ]);
  });
});

describe("decide/drop-to-one.js — the DC, the exemptions, the words", () => {
  it("the DC is 5 plus the damage taken; a number is itself", () => {
    expect(dr.dropSaveDc("5 + damage", 12)).toBe(17);
    expect(dr.dropSaveDc("5 + damage", 0)).toBe(5);
    expect(dr.dropSaveDc(13, 40)).toBe(13);
    expect(dr.dropSaveDc(null, 7)).toBe(12);
  });
  it("Radiant damage or a Critical Hit sets the row aside, and says which", () => {
    const unless = reg.DROP_TO_ONE["Undead Fortitude"].save.unless;
    expect(dr.dropSaveExempt(unless, { types: ["radiant"], crit: false })).toEqual({
      exempt: true,
      why: "Radiant damage"
    });
    expect(dr.dropSaveExempt(unless, { types: ["slashing", "radiant"] })).toEqual({
      exempt: true,
      why: "Radiant damage"
    });
    expect(dr.dropSaveExempt(unless, { types: ["slashing"], crit: true })).toEqual({
      exempt: true,
      why: "a Critical Hit"
    });
    expect(dr.dropSaveExempt(unless, { types: ["slashing"], crit: false })).toEqual({
      exempt: false,
      why: null
    });
  });
  it("a damage card the module cannot read COUNTS the row — the gate never guesses an exemption", () => {
    const unless = reg.DROP_TO_ONE["Undead Fortitude"].save.unless;
    expect(dr.dropSaveExempt(unless, { types: ["radiant"], crit: true, readable: false })).toEqual({
      exempt: false,
      why: null
    });
    expect(dr.dropSaveExempt(unless, { types: [], crit: false, readable: true })).toEqual({
      exempt: false,
      why: null
    });
    expect(dr.dropSaveExempt(null, { types: ["radiant"] })).toEqual({ exempt: false, why: null });
  });
  it("the words: the save's total against the DC, the 1 or the 0; the corpse's count", () => {
    expect(dr.dropSaveTitle({ name: "Zombie", saved: true, total: 18, dc: 17 })).toBe(
      "Zombie saves (18 vs DC 17) — it drops to 1 Hit Point instead"
    );
    expect(dr.dropSaveTitle({ name: "Zombie", saved: false, total: 9, dc: 17 })).toBe(
      "Zombie fails the save (9 vs DC 17) — it drops to 0"
    );
    expect(dr.dropSaveTitle({ name: "Zombie", saved: false, total: null, dc: 17 })).toBe(
      "Zombie fails the save — it drops to 0"
    );
    expect(dr.diedTitle({ row: "Death Throes", name: "Balor", count: 3 })).toBe(
      "Death Throes — Balor dies: 3 creatures save"
    );
    expect(dr.diedTitle({ row: "Death Throes", name: "Balor", count: 1 })).toBe(
      "Death Throes — Balor dies: 1 creature saves".replace("creature saves", "creature save")
    );
    expect(dr.diedTitle({ row: "Death Throes", name: "Balor", count: 0 })).toBe(
      "Death Throes — Balor dies: no creature in reach"
    );
  });
});

describe("EFFECT_BENDS — Magic Resistance and Greater Magic Resistance on the save gate", () => {
  const facts = () => ({
    enabled: ["Magic Resistance", "Greater Magic Resistance"],
    table: reg.EFFECT_BENDS,
    name: "Drow"
  });
  it("Magic Resistance: a text-only feature row, Advantage against a demand marked as a spell, nothing against a breath", () => {
    const row = reg.EFFECT_BENDS["Magic Resistance"];
    expect(row).toMatchObject({ match: "feature", saves: { bend: "advantage", spells: true } });
    expectPointer(row.rule);
    const spell = r.effectSaveSources({
      ...facts(),
      effects: [],
      features: ["Magic Resistance"],
      demand: { spell: true, statuses: [] }
    });
    expect(spell.map(s => [s.bend, s.label, !!s.autoSucceed])).toEqual([
      ["advantage", "Drow — Magic Resistance — against a spell", false]
    ]);
    expect(
      r.effectSaveSources({
        ...facts(),
        effects: [],
        features: ["Magic Resistance"],
        demand: { spell: false, statuses: ["poisoned"] }
      })
    ).toEqual([]);
  });
  it("Greater Magic Resistance: the save against magic CANNOT FAIL — the fourth button (Trance's shape), no bend", () => {
    const row = reg.EFFECT_BENDS["Greater Magic Resistance"];
    expect(row).toMatchObject({ match: "feature", saves: { succeeds: true, spells: true } });
    expect(row.caveat).toMatch(/^counted — .*table's$/);
    const out = r.effectSaveSources({
      ...facts(),
      effects: [],
      features: ["Greater Magic Resistance"],
      demand: { spell: true, statuses: [] }
    });
    expect(out).toHaveLength(1);
    expect(out[0].bend).toBeNull();
    expect(out[0].autoSucceed).toBe(true);
    expect(out[0].feature).toBe("Greater Magic Resistance");
    expect(out[0].label).toBe(
      "Drow — Greater Magic Resistance: this save cannot fail — against a spell or other magical effect"
    );
    expect(
      r.effectSaveSources({
        ...facts(),
        effects: [],
        features: ["Greater Magic Resistance"],
        demand: { spell: false, statuses: [] }
      })
    ).toEqual([]);
  });
  it("with no demand (a sheet save) both are LISTED, never counted", () => {
    const out = r.effectSaveSources({
      ...facts(),
      effects: [],
      features: ["Magic Resistance", "Greater Magic Resistance"],
      demand: null
    });
    expect(out.map(s => s.bend)).toEqual([null, null]);
    expect(out[0].label).toMatch(
      /listed — a save against a spell or other magical effect; press Advantage/
    );
    expect(out[1].label).toMatch(
      /listed — a save against a spell or other magical effect; it cannot fail/
    );
  });
});

describe("EVASIONS — Evasion's shape as a table: Evasion on Dexterity, Avoidance on every save", () => {
  it("two rows, keyed by the feature; the verdict names the row", () => {
    expect(Object.keys(reg.EVASIONS)).toEqual(["Evasion", "Avoidance"]);
    expect(reg.EVASIONS.Evasion.ability).toBe("dex");
    expect(reg.EVASIONS.Avoidance.ability).toBeNull();
    for (const row of Object.values(reg.EVASIONS)) {
      expect(Object.isFrozen(row)).toBe(true);
      expectPointer(row.rule);
    }
    expect(reg.EVASION).toBeUndefined();
  });
  it("the multiplier is the shape's, whichever row; the words carry the row's name", () => {
    expect(
      v.saveMultiplier({ outcome: "saved", evasion: true, evasionBy: "Avoidance" }, "half")
    ).toBe(0);
    expect(
      v.saveMultiplier({ outcome: "failed", evasion: true, evasionBy: "Avoidance" }, "half")
    ).toBe(0.5);
    const flag = { dc: 15, hasDamage: true, damageOnSave: "half" };
    expect(
      v.verdictText(flag, {
        done: true,
        outcome: "saved",
        total: 20,
        evasion: true,
        evasionBy: "Avoidance"
      })
    ).toBe("20 vs DC 15 — saved — no damage (Avoidance)");
    expect(
      v.verdictText(flag, {
        done: true,
        outcome: "failed",
        total: 3,
        evasion: true,
        evasionBy: "Avoidance"
      })
    ).toBe("3 vs DC 15 — failed — half damage (Avoidance)");
    expect(v.verdictText(flag, { done: true, outcome: "saved", total: 20, evasion: true })).toBe(
      "20 vs DC 15 — saved — no damage (Evasion)"
    );
  });
});

describe("TURN_GRANTS — Regeneration, the bearer's own trait at its turn start", () => {
  const regen = { name: "Regeneration", type: "feat", system: { identifier: "regeneration" } };
  it("the row: a feature match, no effect, the first heal activity, above zero, the block read off the text", () => {
    const row = reg.TURN_GRANTS.Regeneration;
    expect(row).toMatchObject({
      match: "feature",
      effect: null,
      activity: null,
      on: "turnStart",
      while: "aboveZero",
      unless: { damagedBy: "text" }
    });
    expectPointer(row.rule);
  });
  it("featureGrantRows finds the row on the sheet's feats, honours the list, and never returns an effect row", () => {
    const rows = tg.featureGrantRows({
      table: reg.TURN_GRANTS,
      answers: reg.answers,
      features: [{ name: "Multiattack", type: "feat" }, regen]
    });
    expect(rows.map(x => x.key)).toEqual(["Regeneration"]);
    expect(rows[0].item).toBe(regen);
    expect(
      tg.featureGrantRows({
        table: reg.TURN_GRANTS,
        answers: reg.answers,
        features: [regen],
        listed: new Set(["heroism"])
      })
    ).toEqual([]);
    expect(
      tg.featureGrantRows({
        table: reg.TURN_GRANTS,
        answers: reg.answers,
        features: [{ name: "Heroism", type: "spell" }]
      })
    ).toEqual([]);
  });
  const labels = {
    acid: "Acid",
    cold: "Cold",
    fire: "Fire",
    lightning: "Lightning",
    radiant: "Radiant",
    slashing: "Slashing"
  };
  it("blockingTypes reads the monster's own words: the troll's Acid or Fire, the hydra's Fire, the vampire's nothing", () => {
    expect(
      tg.blockingTypes(
        "<p>The troll regains 10 Hit Points at the start of each of its turns. If the troll takes Acid or Fire damage, this trait doesn't function on the troll's next turn.</p>",
        labels
      )
    ).toEqual(["acid", "fire"]);
    expect(
      tg.blockingTypes(
        "The hydra regains 20 Hit Points at the start of each of its turns. If the hydra takes Fire damage, this trait doesn't function at the start of its next turn.",
        labels
      )
    ).toEqual(["fire"]);
    expect(
      tg.blockingTypes(
        "The vampire regains 20 Hit Points at the start of each of its turns if it has at least 1 Hit Point and isn't in sunlight or running water.",
        labels
      )
    ).toEqual([]);
    expect(
      tg.blockingTypes(
        "The [[lookup @name lowercase]] regains [[lookup @healing.formula]] Hit Points at the start of each of its turns if it has at least 1 Hit Point.",
        labels
      )
    ).toEqual([]);
    expect(tg.blockingTypes(null, labels)).toEqual([]);
  });
  const entry = (uuid, combat, parts, reverted = false) => ({ uuid, combat, parts, reverted });
  it("damagedSince reads the receipts from the bearer's last turn start: its own turn counts, an earlier round does not", () => {
    const entries = [
      entry("Actor.troll", "c1:1:2", [{ type: "fire", amount: 8 }]), // round 1, turn 2 — the troll's own turn last round
      entry("Actor.troll", "c1:1:0", [{ type: "fire", amount: 8 }]), // before its last turn
      entry("Actor.other", "c1:1:3", [{ type: "fire", amount: 8 }]) // someone else
    ];
    expect(
      tg.damagedSince({
        entries,
        uuid: "Actor.troll",
        combatId: "c1",
        round: 2,
        turn: 2,
        types: ["acid", "fire"]
      })
    ).toEqual({ blocked: true, type: "fire" });
    expect(
      tg.damagedSince({
        entries: entries.slice(1),
        uuid: "Actor.troll",
        combatId: "c1",
        round: 2,
        turn: 2,
        types: ["acid", "fire"]
      })
    ).toEqual({ blocked: false, type: null });
    // round 1: everything since the combat began
    expect(
      tg.damagedSince({
        entries: entries.slice(1, 2),
        uuid: "Actor.troll",
        combatId: "c1",
        round: 1,
        turn: 2,
        types: ["fire"]
      })
    ).toEqual({ blocked: true, type: "fire" });
  });
  it("…a reverted receipt, another combat, a healing part, a type the copy does not name, or no combat block nothing", () => {
    const base = {
      uuid: "Actor.troll",
      combatId: "c1",
      round: 2,
      turn: 2,
      types: ["acid", "fire"]
    };
    expect(
      tg.damagedSince({
        ...base,
        entries: [entry("Actor.troll", "c1:1:3", [{ type: "fire", amount: 8 }], true)]
      }).blocked
    ).toBe(false);
    expect(
      tg.damagedSince({
        ...base,
        entries: [entry("Actor.troll", "c9:1:3", [{ type: "fire", amount: 8 }])]
      }).blocked
    ).toBe(false);
    expect(
      tg.damagedSince({
        ...base,
        entries: [
          entry("Actor.troll", "c1:1:3", [
            { type: "healing", amount: -8 },
            { type: "fire", amount: 0 }
          ])
        ]
      }).blocked
    ).toBe(false);
    expect(
      tg.damagedSince({
        ...base,
        entries: [entry("Actor.troll", "c1:1:3", [{ type: "cold", amount: 8 }])]
      }).blocked
    ).toBe(false);
    expect(
      tg.damagedSince({
        ...base,
        combatId: null,
        entries: [entry("Actor.troll", "c1:1:3", [{ type: "fire", amount: 8 }])]
      }).blocked
    ).toBe(false);
    expect(
      tg.damagedSince({
        ...base,
        types: [],
        entries: [entry("Actor.troll", "c1:1:3", [{ type: "fire", amount: 8 }])]
      }).blocked
    ).toBe(false);
  });
  it("the words: a heal names the trait and the bearer", () => {
    expect(
      tg.grantTitle({ spell: "Regeneration", bearer: "Troll", total: 10, type: "healing" })
    ).toBe("Regeneration — Troll regains 10 Hit Points");
  });
});

describe("EMANATIONS — the aura rows on the `turnStart` trigger, and Aura of Authority", () => {
  it("five turnStart rows: feature rings, nothing standing, the failure the verdict's; Vile Appearance narrowed to Beasts and Humanoids", () => {
    for (const n of ["Fear Aura", "Fetid Aura", "Stench", "Vile Appearance", "Lordly Presence"]) {
      const row = reg.EMANATIONS[n];
      expect(row, n).toMatchObject({
        kind: "feature",
        effect: null,
        trigger: { on: ["turnStart"], oncePerTurn: true }
      });
      expect(typeof row.caveat, n).toBe("string");
      expectPointer(row.rule, n);
    }
    expect(reg.EMANATIONS["Fear Aura"]).toMatchObject({ reach: "harmful", incapacitated: true });
    expect(reg.EMANATIONS["Vile Appearance"]).toMatchObject({
      reach: "all",
      range: 30,
      trigger: { types: ["beast", "humanoid"] }
    });
    expect(reg.EMANATIONS["Lordly Presence"].activity).toBe("Initial Save");
  });
  it("Aura of Authority is a helpful ring and a card — no trigger, no effect, off while Incapacitated", () => {
    const row = reg.EMANATIONS["Aura of Authority"];
    expect(row).toMatchObject({
      kind: "feature",
      reach: "helpful",
      activity: "Expend Use",
      effect: null,
      incapacitated: true
    });
    expect(row.trigger).toBeUndefined();
    expectPointer(row.rule);
  });
});

describe("EFFECT_BENDS — Displacement and Blurred Form: Disadvantage against the bearer, off while Incapacitated", () => {
  const facts = () => ({
    enabled: ["Displacement", "Blurred Form"],
    table: reg.EFFECT_BENDS,
    attackerName: "Gren",
    targetName: "the beast"
  });
  it("the rows: target-side feature rows on the `notIncapacitated` judge", () => {
    for (const n of ["Displacement", "Blurred Form"]) {
      expect(reg.EFFECT_BENDS[n], n).toMatchObject({
        match: "feature",
        attacker: null,
        target: "disadvantage",
        scope: "any",
        judge: "notIncapacitated"
      });
      expectPointer(reg.EFFECT_BENDS[n].rule, n);
    }
  });
  it("the bearer's Displacement counts Disadvantage on the attacker; Incapacitated, nothing", () => {
    const up = r.effectSources({
      ...facts(),
      attacker: {},
      target: { features: ["Displacement"], incapacitated: false }
    });
    expect(up.map(s => [s.bend, s.label])).toEqual([
      ["disadvantage", "the beast is — Displacement"]
    ]);
    expect(
      r.effectSources({
        ...facts(),
        attacker: {},
        target: { features: ["Displacement"], incapacitated: true }
      })
    ).toEqual([]);
    // The judge hinges on the target: the attacker pass never lists it.
    expect(
      r.effectSources({
        ...facts(),
        attacker: {},
        target: { features: ["Blurred Form"] },
        pass: "attacker"
      })
    ).toEqual([]);
    expect(
      r
        .effectSources({
          ...facts(),
          attacker: {},
          target: { features: ["Blurred Form"] },
          pass: "target"
        })
        .map(s => s.bend)
    ).toEqual(["disadvantage"]);
  });
});

describe("the reaction rows — the interrupts, the rebukes, Reactive", () => {
  it("Toxic Escape halves like Uncanny Dodge; Deflect Missile reduces on RANGED hits only; Limited Foresight bends the roll", () => {
    expect(reg.INTERRUPTS.map(r => `${r.name}:${r.kind}`)).toEqual(
      expect.arrayContaining([
        "Toxic Escape:damage",
        "Deflect Missile:damage",
        "Limited Foresight:roll"
      ])
    );
    expect(reg.INTERRUPT_MULTIPLIERS["Toxic Escape"].multiplier).toBe(0.5);
    expect(reg.INTERRUPT_REDUCTIONS["Deflect Missile"]).toMatchObject({
      activity: "Reduce Damage",
      pool: true,
      ranged: true,
      hit: "ranged attack"
    });
    expect(reg.INTERRUPT_ROLLS["Limited Foresight"]).toMatchObject({
      reaction: true,
      uses: true,
      activity: "Expend Use"
    });
    for (const row of [
      reg.INTERRUPT_MULTIPLIERS["Toxic Escape"],
      reg.INTERRUPT_REDUCTIONS["Deflect Missile"],
      reg.INTERRUPT_ROLLS["Limited Foresight"]
    ])
      expectPointer(row.rule);
  });
  it("the rebukes: a hit's save at the attacker (Warding Charm, Jinx), a MISS row (Sticky Shield), a typed self row (Elemental Absorption), a self row (Ink Cloud)", () => {
    expect(reg.REBUKES["Warding Charm"]).toMatchObject({ activity: "Save", hit: true });
    expect(reg.REBUKES["Jinx"]).toMatchObject({ activity: "Save", hit: true });
    expect(reg.REBUKES["Sticky Shield"]).toMatchObject({ activity: "Save", on: "miss" });
    expect(reg.REBUKES["Elemental Absorption"]).toMatchObject({
      activity: null,
      self: true,
      types: ["acid", "cold", "fire", "lightning", "thunder"]
    });
    expect(reg.REBUKES["Ink Cloud"]).toMatchObject({ activity: "Expend Use", self: true });
    for (const n of [
      "Warding Charm",
      "Jinx",
      "Sticky Shield",
      "Elemental Absorption",
      "Ink Cloud"
    ]) {
      expectPointer(reg.REBUKES[n].rule, n);
      expect(typeof reg.REBUKES[n].caveat, n).toBe("string");
    }
  });
  it("a `self` row has no reach to measure and is never blocked by distance; the types judge counts an unreadable card", () => {
    expect(rb.rebukeReach({ self: true }, null)).toBe(Infinity);
    expect(
      rb.rebukeBlocked({
        self: false,
        hp: 10,
        reactionSpent: false,
        distance: null,
        reach: Infinity,
        usesLeft: 1,
        slot: null,
        whileStands: null,
        equipped: null
      })
    ).toBeNull();
    expect(
      rb.rebukeBlocked({
        self: false,
        hp: 10,
        reactionSpent: true,
        distance: null,
        reach: Infinity,
        usesLeft: 1,
        slot: null,
        whileStands: null,
        equipped: null
      })
    ).toBe("reaction spent");
    expect(rb.rebukeTypesAdmit(["fire", "cold"], ["fire"])).toBe(true);
    expect(rb.rebukeTypesAdmit(["fire", "cold"], ["slashing"])).toBe(false);
    expect(rb.rebukeTypesAdmit(["fire", "cold"], [])).toBe(true);
    expect(rb.rebukeTypesAdmit(null, ["slashing"])).toBe(true);
    expect(rb.rebukeLine({ actorName: "Kuo-toa", sourceName: "Gren", miss: true })).toBe(
      "Kuo-toa may answer Gren — it missed"
    );
    expect(
      rb.rebukeLine({
        actorName: "Kuo-toa",
        sourceName: "Gren",
        miss: true,
        answer: "use",
        choice: "Sticky Shield"
      })
    ).toBe("Sticky Shield — Kuo-toa answers Gren's miss");
  });
  it("Reactive: the spent Reaction stands only for the turn it was spent on", () => {
    expect(Object.keys(reg.REACTION_RESETS)).toEqual(["Reactive"]);
    expectPointer(reg.REACTION_RESETS.Reactive.rule);
    const start = { round: 1, turn: 1 };
    expect(ch.reactionStandsEveryTurn({ start, now: { round: 1, turn: 1 } })).toBe(true);
    expect(ch.reactionStandsEveryTurn({ start, now: { round: 1, turn: 2 } })).toBe(false);
    expect(ch.reactionStandsEveryTurn({ start, now: { round: 2, turn: 1 } })).toBe(false);
    expect(ch.reactionStandsEveryTurn({ start: null, now: { round: 1, turn: 1 } })).toBe(true);
    expect(ch.reactionStandsEveryTurn({ start, now: null })).toBe(false);
  });
});

describe("SAVE_SUCCEEDS — Legendary Resistance is NOT a row: the platform ships it", () => {
  it("the table still holds Mage Slayer alone; the saves machine honours the native flip (`forced`)", () => {
    expect(Object.keys(reg.SAVE_SUCCEEDS)).toEqual(["Mage Slayer"]);
    const flag = { dc: 15, hasDamage: true, damageOnSave: "half" };
    expect(v.verdictText(flag, { done: true, outcome: "saved", total: 3, forced: true })).toBe(
      "3 vs DC 15 — saved — half damage (legendary resistance)"
    );
  });
});
