import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer tables (ARCHITECTURE.md §2, §6). No Foundry stub on purpose: if any of this ever
 * reaches for `setting()` the import fails, which is the signal we want.
 */
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  reg = await import("../scripts/decide/registry.js");
});

describe("the kind lists", () => {
  it("name only kinds from their own closed sets", () => {
    for (const [key, { rows, kinds }] of Object.entries(reg.KIND_LISTS)) {
      expect(rows.length, key).toBeGreaterThan(0);
      for (const r of rows) expect(kinds.has(r.kind), `${key} ${r.name}:${r.kind}`).toBe(true);
    }
  });

  it("keeps Riposte out of the interrupts — it triggers on a MISS", () => {
    expect(reg.INTERRUPTS.map(r => r.name)).not.toContain("Riposte");
    expect(reg.MANEUVER_FOLDS).toContainEqual({ name: "Riposte", kind: "riposte" });
  });

  it("lets one feat appear twice under different kinds", () => {
    const kinds = reg.MANEUVER_FOLDS.filter(r => r.name === "Shield Master").map(r => r.kind);
    expect(kinds).toEqual(["interpose", "bash"]);
  });

  it("hands every caller a fresh copy, so no reader can edit a table", () => {
    const first = reg.interruptEntries();
    first[0].kind = "damage";
    first.push({ name: "Stray", kind: "ac" });
    expect(reg.interruptEntries()[0].kind).toBe("ac");
    expect(reg.interruptEntries()).toHaveLength(reg.INTERRUPTS.length);
  });

  it("reads a membership list as every row of its table, lower-cased", () => {
    expect(reg.effectEntries().map(e => e.kind)).toEqual(reg.EFFECT_KEYS.map(k => k.toLowerCase()));
    expect(reg.conditionEntries().map(e => e.kind)).toEqual([...reg.CONDITION_KEYS]);
    expect(reg.reminderEntries().map(e => e.kind)).toEqual([...reg.REMINDER_KINDS]);
  });

  it("the blocks and the riders", () => {
    expect(reg.blockEntries()).toEqual([{ spell: "Magic Missile", reaction: "Shield" }]);
    expect(reg.riderEntries().map(e => e.name)).toEqual([
      "hunters-mark",
      "hex",
      "great-old-one-hex"
    ]);
    expect(reg.riderUpgradeEntries()).toEqual([{ feature: "foe-slayer", rider: "hunters-mark" }]);
  });
});

describe("INTERRUPT_REDUCTIONS — a reaction that reduces by a roll (Parry; Stone's Endurance, Slice A 2026-09-24)", () => {
  it("every row names its activity, pays from a pool, and carries its own voice — eyebrow, spend, trigger, the ask", () => {
    for (const [key, row] of Object.entries(reg.INTERRUPT_REDUCTIONS)) {
      expect(row.activity, key).toBeTruthy();
      // a reduction for another creature (Interception, 2026-09-26) pays with the Reaction alone
      // …and so does the defender's own Reaction when the row's `spend` says so (A1, Deflect Attacks)
      expect(row.pool === true || Number.isFinite(row.ally) || row.spend === "Reaction", key).toBe(
        true
      );
      expect(["Maneuver", "Reaction"], key).toContain(row.eyebrow);
      expect(row.spend, key).toBeTruthy();
      expect(row.hit, key).toMatch(/attack$/);
      expect(row.by, key).toBeTruthy();
      expectPointer(row.rule, key);
      expect(row.rule.item, key).toBe(key);
      expect(row.from, key).toBeTruthy();
    }
  });
  it("Stone's Endurance is a Reaction spending its own use on any attack; Parry stays the maneuver on a melee attack", () => {
    expect(reg.INTERRUPT_REDUCTIONS["Stone's Endurance"]).toMatchObject({
      eyebrow: "Reaction",
      spend: "use",
      hit: "attack"
    });
    expect(reg.INTERRUPT_REDUCTIONS.Parry).toMatchObject({
      eyebrow: "Maneuver",
      spend: "Superiority Die",
      hit: "melee attack"
    });
  });
  it("every reduction row is a damage interrupt", () => {
    const entries = reg.INTERRUPTS;
    for (const key of Object.keys(reg.INTERRUPT_REDUCTIONS)) {
      expect(
        entries.map(e => e.name),
        key
      ).toContain(key);
    }
    expect(entries.find(e => e.name === "Stone's Endurance")?.kind).toBe("damage");
  });
});

describe("d20 folds — the spends, one mechanism", () => {
  it("ships every surveyed feature", () => {
    expect(reg.D20_FOLDS.map(e => e.kind).sort()).toEqual([
      "advantage",
      "advantage",
      "bardic",
      "heroic",
      "reroll",
      "reroll",
      "seeking",
      "succeed",
      "tactical",
      "tactical",
      "tactical",
      "tactical",
      "tactical",
      "tactical"
    ]);
    expect(reg.D20_FOLDS.map(e => e.name)).toContain("Ambush");
    expect(reg.D20_FOLDS).toContainEqual({ name: "Commanding Presence", kind: "tactical" });
    expect(reg.D20_FOLDS).toContainEqual({ name: "Tides of Chaos", kind: "advantage" });
    expect(reg.D20_FOLDS).toContainEqual({ name: "Indomitable", kind: "reroll" });
    expect(reg.D20_FOLDS).toContainEqual({ name: "Fanatical Focus", kind: "reroll" });
  });

  // ⚠ The row names the EFFECT ("Inspired") the bard applies, not the bard's own feat: the feat
  // never leaves the bard, so a row naming it would find nothing on the creature that holds the
  // die. What the table READS is "Bardic Inspiration"; d20-folds.js's KIND_LABEL supplies that.
  it("keys bardic off the effect a bard APPLIES, never the feat the bard keeps", () => {
    expect(reg.D20_FOLDS).toContainEqual({ name: "Inspired", kind: "bardic" });
    expect(reg.D20_FOLDS.map(e => e.name)).not.toContain("Bardic Inspiration");
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
    // 2026-09-01: 19 → 23 — the `reminder` set (vex, sap, prone, condition), the gate's four ways
    // of reading a source of Advantage/Disadvantage before an attack roll.
    // 2026-09-02: 23 → 24 — `range` joins the set (a ranged attack's own geometry, user ask).
    // 2026-09-02 (later): 24 → 25 — `effect` joins: an ability on either sheet, by name, over the
    // effect table (membership, like the condition table).
    // 2026-09-02 (later still): 25 → 26 — `sneak` joins: the Sneak Attack CHOICE beside the roll,
    // the first kind that asks rather than tells (the prototype, built as drawn).
    // 2026-09-03: 26 → 28 — `emanation` joins with two kinds, feature and spell: how an aura
    // lives (always on with its token, or cast and adopted from the system's template).
    // 2026-09-05: 28 → 29 — `command` joins the maneuver folds (Commander's Strike, Riposte's driven
    // attack with the attacker changed to an ally).
    // 2026-09-09: 29 → 30 — `seeking` joins the d20 folds (Seeking Spell, the metamagic pass).
    // 2026-09-24: 30 → 31 — `roll` joins the interrupts (Slice A: Disadvantage imposed after the
    // hit — Lucky, Warding Flare, Shadowy Dodge). Savage Attacker's table is rows, not a kind.
    // 2026-09-25: 31 → 33 — `buy` joins the reminders and `advantage` the d20 folds (Lucky's
    // Advantage half, the Halfling walk: the box bought before the roll, the no-dialog initiative fold).
    // 2026-09-25: 33 → 34 — `shove` joins the maneuver folds (Tavern Brawler's push: the bash offer
    // on an Unarmed Strike with no save behind it; the origin feats).
    // 2026-09-27: 34 → 35 — `succeed` joins the d20 folds (Mage Slayer's Guarded Mind: a failed save
    // made a success — the verdict itself, no die; the PHB feats, group 4).
    // 2026-09-28: 35 → 38 — `repeatSave` joins with three kinds (the spells slice): what raises a landed
    // effect's repeated save — the bearer's turn end, damage landing, its own action offered.
    // 2026-09-28 (later): 38 → 39 — `area` joins the emanations (the spells slice, Tier 3): the system's
    // template adopted where it was placed, attached to nothing — Moonbeam, Cloudkill, Cloud of Daggers.
    // 2026-09-30: 39 → 40 — `reroll` joins the d20 folds (the PHB classes, B1): a FAILED save rerolled with a
    // bonus added, paid by a use or a Rage's once — a spend `heroic` cannot say, a replace + add no row can.
    expect(total).toBe(40);
  });

  it("counts every kind list's set in the tripwire", () => {
    const counted = new Set(reg.KIND_SETS.map(set => set.kinds));
    for (const [key, { kinds }] of Object.entries(reg.KIND_LISTS))
      expect(counted.has(kinds), key).toBe(true);
  });

  it("the condition rows are the `condition` kind's, and prone is not among them", () => {
    expect(reg.REMINDER_KINDS.has("condition")).toBe(true);
    expect(reg.CONDITION_KEYS).not.toContain("prone");
    expect(reg.CONDITION_KEYS).toHaveLength(14);
  });
});

describe("CONDITION_BENDS — the table, and the set and the default DERIVED from it", () => {
  it("is the thirteen conditions and Hiding, frozen, in the order the table reads them, each pointing at its glossary entry", () => {
    expect(reg.CONDITION_KEYS).toEqual([
      "blinded",
      "invisible",
      "hiding",
      "paralyzed",
      "petrified",
      "poisoned",
      "restrained",
      "stunned",
      "unconscious",
      "frightened",
      "grappled",
      "incapacitated",
      "dodging",
      "charmed"
    ]);
    expect(Object.isFrozen(reg.CONDITION_BENDS)).toBe(true);
    expect(Object.isFrozen(reg.CONDITION_KEYS)).toBe(true);
    for (const key of reg.CONDITION_KEYS) {
      expect(Object.isFrozen(reg.CONDITION_BENDS[key])).toBe(true);
      const { rule } = reg.CONDITION_BENDS[key];
      expectPointer(rule, key);
      if (rule.page === "condition") expect(rule.key, key).toBe(key);
    }
    expect(reg.CONDITION_BENDS.hiding.rule).toEqual({ page: "rule", key: "unseenattackers" });
    expect(reg.CONDITION_BENDS.dodging.rule).toEqual({ page: "rule", key: "dodge" });
  });
  it("every row bends at least one side or carries a note — a row that does neither is dead data", () => {
    for (const key of reg.CONDITION_KEYS) {
      const row = reg.CONDITION_BENDS[key];
      expect(!!(row.attacker || row.target || row.note), key).toBe(true);
    }
  });
});

describe("SAVE_BENDS — the save table (option E, 2026-09-02)", () => {
  it("six rows: two bends, four automatic failures, all on Strength or Dexterity, each pointing at its clause", () => {
    expect(Object.keys(reg.SAVE_BENDS)).toEqual([
      "restrained",
      "dodging",
      "paralyzed",
      "stunned",
      "unconscious",
      "petrified"
    ]);
    expect(Object.isFrozen(reg.SAVE_BENDS)).toBe(true);
    for (const key of Object.keys(reg.SAVE_BENDS)) {
      const row = reg.SAVE_BENDS[key];
      expect(Object.isFrozen(row)).toBe(true);
      expectPointer(row.rule, key);
      expect(row.rule, key).toEqual(
        key === "dodging"
          ? { page: "rule", key: "dodge" }
          : { page: "condition", key, benefit: "Saving Throws Affected" }
      );
      expect(
        row.abilities.every(a => ["str", "dex"].includes(a)),
        key
      ).toBe(true);
      expect(
        !!row.bend !== !!row.autoFail,
        `${key} is a bend or an automatic failure, never both or neither`
      ).toBe(true);
    }
    expect(Object.keys(reg.SAVE_BENDS).filter(k => reg.SAVE_BENDS[k].autoFail)).toEqual([
      "paralyzed",
      "stunned",
      "unconscious",
      "petrified"
    ]);
  });
  it("every save row is also a row of the condition table — one membership list switches both gates", () => {
    for (const key of Object.keys(reg.SAVE_BENDS)) expect(reg.CONDITION_KEYS, key).toContain(key);
  });
});

describe("SAVE_SUCCEEDS — a failed save made a success (the PHB feats, group 4, 2026-09-27)", () => {
  it("Mage Slayer's Guarded Mind: its activity, its label, the three mental saves, the rule the feat's", () => {
    expect(Object.keys(reg.SAVE_SUCCEEDS)).toEqual(["Mage Slayer"]);
    const row = reg.SAVE_SUCCEEDS["Mage Slayer"];
    expect(Object.isFrozen(row)).toBe(true);
    expect(row).toMatchObject({ activity: "Guard Mind", label: "Guarded Mind" });
    expect([...row.abilities]).toEqual(["int", "wis", "cha"]);
    expectPointer(row.rule);
    expect(row.rule).toMatchObject({ item: "Mage Slayer", benefit: "Guarded Mind" });
  });
  it("is the `succeed` kind's table, and the d20 folds ship its row", () => {
    expect(reg.D20_FOLD_KINDS.has("succeed")).toBe(true);
    expect(reg.D20_FOLDS).toContainEqual({ name: "Mage Slayer", kind: "succeed" });
  });
  it("Mage Slayer's Concentration Breaker is a feat row of the fighting-style table that `breaks` concentration", () => {
    expect(reg.DAMAGE_RULES["Mage Slayer"]).toMatchObject({
      gate: "always",
      feat: true,
      breaks: "concentration"
    });
    expect(
      Object.values(reg.DAMAGE_RULES)
        .filter(r => r.breaks)
        .map(r => r.key)
    ).toEqual(["mage-slayer"]);
  });
});

describe("SAVE_PRESSES — the bare save presses (the audit's output, 2026-09-03)", () => {
  it("is the three rows the audit found bare and single-save — Web, Grease, Sleet Storm — the Poisoner's coating, and Command behind its word", () => {
    expect(Object.keys(reg.SAVE_PRESSES).sort()).toEqual([
      "Beguiling Twist",
      "Command",
      "Grease",
      "Poisoner",
      "Sleet Storm",
      "Stunning Strike",
      "Web"
    ]);
  });
  it("Command (the spells slice, 2026-09-28): Prone behind the caster's word — four options, Grovel the one that presses, Halt what the clock chooses", () => {
    const row = reg.SAVE_PRESSES.Command;
    expect(row).toMatchObject({ status: "prone", onFail: true });
    expect(Object.isFrozen(row.word)).toBe(true);
    expect([...row.word.options]).toEqual(["Approach", "Flee", "Grovel", "Halt"]);
    expect(row.word.presses).toBe("Grovel");
    expect(row.word.options).toContain(row.word.default);
    expect(row.word.default).not.toBe(row.word.presses);
    expectPointer(row.rule);
  });
  it("the Poisoner's Poisoned lasts until the end of the Poisoner's next turn — the platform's sourceEnd; the spells' presses carry no clock", () => {
    expect(reg.SAVE_PRESSES.Poisoner.status).toBe("poisoned");
    expect(reg.SAVE_PRESSES.Poisoner.expiry).toBe("sourceEnd");
    for (const k of ["Web", "Grease", "Sleet Storm"])
      expect(reg.SAVE_PRESSES[k].expiry, k).toBeUndefined();
  });
  it("every row presses a standard 2024 status on the failure and points at its own text", () => {
    const STANDARD = new Set([
      "blinded",
      "charmed",
      "deafened",
      "frightened",
      "grappled",
      "incapacitated",
      "invisible",
      "paralyzed",
      "petrified",
      "poisoned",
      "prone",
      "restrained",
      "stunned",
      "unconscious"
    ]);
    for (const [name, row] of Object.entries(reg.SAVE_PRESSES)) {
      expectPointer(row.rule, name);
      // A2: a `success` row moves the activity's own effects to the success; it presses nothing.
      if (row.success) {
        expect(row.status, name).toBeUndefined();
        expect(row.success.length, name).toBeGreaterThan(0);
        continue;
      }
      expect(STANDARD.has(row.status), name).toBe(true);
      expect(row.onFail, name).toBe(true);
      expectPointer(row.rule, name);
      expect(row.rule.item, name).toBe(name);
      expect(Object.isFrozen(row), name).toBe(true);
    }
  });
  it("Web presses Restrained; Grease and Sleet Storm press Prone", () => {
    expect(reg.SAVE_PRESSES.Web.status).toBe("restrained");
    expect(reg.SAVE_PRESSES.Grease.status).toBe("prone");
    expect(reg.SAVE_PRESSES["Sleet Storm"].status).toBe("prone");
  });
});

describe("CHECK_BENDS — the check table (user go 2026-09-03)", () => {
  it("is Poisoned and Frightened, both Disadvantage, each pointing at its glossary entry", () => {
    expect(Object.keys(reg.CHECK_BENDS)).toEqual(["poisoned", "frightened"]);
    for (const [key, row] of Object.entries(reg.CHECK_BENDS)) {
      expect(row.bend, key).toBe("disadvantage");
      expectPointer(row.rule, key);
      expect(row.rule, key).toEqual({
        page: "condition",
        key,
        benefit: "Ability Checks and Attacks Affected"
      });
      expect(Object.isFrozen(row), key).toBe(true);
    }
  });
  it("every check row is also a row of the condition table — one membership list switches all three gates", () => {
    for (const key of Object.keys(reg.CHECK_BENDS)) expect(reg.CONDITION_KEYS, key).toContain(key);
  });
  it("marks Poisoned as the platform's own bend — the gate reminds, it never applies twice", () => {
    expect(reg.CHECK_BENDS.poisoned.platform).toBe(true);
    expect(reg.CHECK_BENDS.frightened.platform).toBeUndefined();
  });
});

describe("tableIndex — one access to a name-keyed table (the machine-tier pass, Stage 1)", () => {
  it("derives the closed name set from the keys, or from a named column", () => {
    expect(reg.tableIndex(reg.USE_CHIPS).names).toEqual(new Set(["steady aim", "studied attacks"]));
    expect(reg.tableIndex(reg.CLOCK_RIDERS, r => r.feature).names.has("dread ambusher")).toBe(true);
    expect(reg.tableIndex(reg.DAMAGE_SHIELDS).names).toEqual(
      new Set(Object.keys(reg.DAMAGE_SHIELDS).map(k => k.toLowerCase()))
    );
  });
  it("keyNamed is the TABLE key, case-insensitive; rowNamed is the row over it — and a row's own key field wins on the row, as the copies had it", () => {
    const idx = reg.tableIndex(reg.USE_CHIPS);
    expect(idx.keyNamed("steady aim")).toBe("Steady Aim");
    expect(idx.keyNamed("Steady Aim")).toBe("Steady Aim");
    expect(idx.keyNamed("nothing")).toBeNull();
    expect(idx.rowNamed("STEADY AIM")?.key).toBe("steadyAim"); // the row's own field — the Steady Aim chip's lesson
    expect(idx.rowNamed("nothing")).toBeNull();
    expect(reg.tableIndex(reg.DAMAGE_SHIELDS).rowNamed("fire shield")?.key).toBe("Fire Shield");
  });
});

describe("Polearm Master (2026-09-27, the user's P1 and the reach ring)", () => {
  it("Pole Strike is a BONUS_SWINGS row on the attack trigger, Hew's stays the crit-or-kill shape, and the Maneuver Folds list ships it", () => {
    expect(reg.BONUS_SWINGS["Great Weapon Master"].when).toBe("critOrKill");
    const pole = reg.BONUS_SWINGS["Polearm Master"];
    expect(pole).toMatchObject({ when: "attack", label: "Pole Strike" });
    expect([...pole.weapons.base]).toEqual(["quarterstaff", "spear"]);
    expect([...pole.weapons.properties]).toEqual(["hvy", "rch"]);
    expectPointer(pole.rule);
    expect(pole.rule).toMatchObject({ item: "Polearm Master", benefit: "Pole Strike" });
    expect(reg.MANEUVER_FOLDS).toContainEqual({ name: "Polearm Master", kind: "hew" });
  });
  it("Reactive Strike is an invisible, quiet feature ring of the held weapon's reach that alerts on a hostile moving in", () => {
    const row = reg.EMANATIONS["Polearm Master"];
    expect(row).toMatchObject({
      kind: "feature",
      reach: "harmful",
      range: "weaponReach",
      effect: null,
      quiet: true
    });
    expect(row.alert).toMatchObject({ on: "moveIn", label: "Reactive Strike" });
    expect([...row.holding.properties]).toEqual(["hvy", "rch"]);
    expectPointer(row.rule);
    expect(row.rule).toMatchObject({ item: "Polearm Master", benefit: "Reactive Strike" });
  });
});

describe("how a row names its content — the identifier, then the name", () => {
  it("slugs a row's name the way the packs do", () => {
    expect(reg.identifierOf("Hunter's Mark")).toBe("hunters-mark");
    expect(reg.identifierOf("Crusader’s Mantle")).toBe("crusaders-mantle");
    expect(reg.identifierOf("Enlarge/Reduce")).toBe("enlarge-reduce");
    expect(reg.identifierOf("Blessed Strikes: Divine Strike")).toBe(
      "blessed-strikes-divine-strike"
    );
  });

  it("finds a renamed item by its identifier, and a bare one by its name", () => {
    const statblock = {
      name: "Heat Metal - Spellcasting",
      type: "spell",
      system: { identifier: "heat-metal" }
    };
    expect(reg.matchOf("Heat Metal", statblock)).toBe("identifier");
    expect(reg.matchOf("heat metal", { name: "Heat Metal", type: "spell" })).toBe("name");
    expect(
      reg.matchOf("Heat Metal", {
        name: "Fireball",
        type: "spell",
        system: { identifier: "fireball" }
      })
    ).toBe(null);
  });

  it("scopes by type: a +1 Shield is not the Shield spell", () => {
    const armor = { name: "+1 Shield", type: "equipment", system: { identifier: "shield" } };
    expect(reg.answers("Shield", armor)).toBe(true);
    expect(reg.answers("Shield", armor, ["spell", "feat"])).toBe(false);
  });

  it("a table finds an item's row by identifier first, then by name, the first row per identifier", () => {
    const t = reg.tableIndex(reg.EMANATIONS);
    expect(
      t.keyFor({ name: "Spirit Guardians (Upcast)", system: { identifier: "spirit-guardians" } })
    ).toBe("Spirit Guardians");
    expect(t.keyFor({ name: "AURA OF COURAGE" })).toBe("Aura of Courage");
    expect(t.rowFor({ name: "Fireball", system: { identifier: "fireball" } })).toBe(null);
    const clock = reg.tableIndex(reg.CLOCK_RIDERS, r => r.feature);
    const slasher = Object.keys(reg.CLOCK_RIDERS).find(
      k => reg.CLOCK_RIDERS[k].feature === "Slasher"
    );
    expect(clock.keyFor({ name: "Slasher", system: { identifier: "slasher" } })).toBe(slasher);
  });
});
