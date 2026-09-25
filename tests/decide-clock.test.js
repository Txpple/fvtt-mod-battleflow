import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer clock arithmetic (ARCHITECTURE.md §2). No Foundry stub on purpose. The ruling
 * (user, 2026-09-02): a clock rider is notified and added, never asked; what is decided here is
 * whether the rules say it applies on THIS hit, and why not otherwise.
 */
/** @type {typeof import("../scripts/decide/clock.js")} */
let c;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
/** @type {typeof import("../scripts/decide/chips.js")} */
let chips;
beforeAll(async () => {
  c = await import("../scripts/decide/clock.js");
  reg = await import("../scripts/decide/registry.js");
  chips = await import("../scripts/decide/chips.js");
});

describe("Celestial Revelation — a transformed rider (the Aasimar walk, 2026-09-25)", () => {
  const rev = () => reg.CLOCK_RIDERS["celestial-revelation"];
  const eff = (name, chip = null) => ({ name, active: true, chip });
  it("is due once per turn only while a form stands, and the why names the form", () => {
    expect(c.riderDue(rev(), { inCombat: true, form: null })).toEqual({
      due: false,
      why: "not transformed"
    });
    expect(c.riderDue(rev(), { inCombat: true, form: "Heavenly Wings" })).toEqual({
      due: true,
      why: "Heavenly Wings — once this turn"
    });
    expect(
      c.riderDue(rev(), { inCombat: true, form: "Inner Radiance", chitStands: true }).due
    ).toBe(false);
    expect(c.riderDue(rev(), { inCombat: false, form: "Necrotic Shroud" }).why).toMatch(
      /out of combat/
    );
  });
  it("standingForm reads the form's own effect by name, and Necrotic Shroud only by the module's chip", () => {
    expect(c.standingForm(rev(), [eff("Heavenly Wings")])?.type).toBe("radiant");
    expect(c.standingForm(rev(), [eff("Searing Radiance")])?.form).toBe("Inner Radiance");
    expect(
      c.standingForm(rev(), [eff("Celestial Revelation: Necrotic Shroud", "necrotic shroud")])?.type
    ).toBe("necrotic");
    // Frightened BY a Shroud — an effect of the same name, no chip — is not wearing one.
    expect(c.standingForm(rev(), [eff("Necrotic Shroud")])).toBeNull();
    expect(
      c.standingForm(rev(), [{ name: "Heavenly Wings", active: false, chip: null }])
    ).toBeNull();
    expect(c.standingForm(rev(), [])).toBeNull();
  });
});

describe("riderDue — the clock, read plain", () => {
  const dread = () => reg.CLOCK_RIDERS["dread-ambusher"];
  const assassinate = () => reg.CLOCK_RIDERS["assassinate"];
  it("Dreadful Strike: once per turn, a use in hand, a weapon — due; the chit standing or the uses gone — not", () => {
    expect(c.riderDue(dread(), { inCombat: true, round: 3, usesLeft: 2, weapon: true })).toEqual({
      due: true,
      why: "once this turn"
    });
    expect(
      c.riderDue(dread(), { inCombat: true, chitStands: true, usesLeft: 2, weapon: true }).why
    ).toMatch(/used this turn/);
    expect(c.riderDue(dread(), { inCombat: true, usesLeft: 0, weapon: true }).why).toMatch(
      /no uses/
    );
    expect(c.riderDue(dread(), { inCombat: true, usesLeft: 2, weapon: false }).why).toMatch(
      /not a weapon/
    );
  });
  it("out of combat there is no turn to be once-per: every hit rides (the Cleave shape)", () => {
    expect(c.riderDue(dread(), { inCombat: false, usesLeft: 1, weapon: true })).toEqual({
      due: true,
      why: "out of combat — every hit"
    });
  });
  it("Assassinate: the first round, on an armed Sneak Attack, and never out of combat", () => {
    expect(
      c.riderDue(assassinate(), { inCombat: true, round: 1, sneakArmed: true, weapon: true }).due
    ).toBe(true);
    expect(
      c.riderDue(assassinate(), { inCombat: true, round: 2, sneakArmed: true, weapon: true }).why
    ).toMatch(/round 2/);
    expect(
      c.riderDue(assassinate(), { inCombat: true, round: 1, sneakArmed: false, weapon: true }).why
    ).toMatch(/Sneak Attack/);
    expect(
      c.riderDue(assassinate(), { inCombat: false, sneakArmed: true, weapon: true }).why
    ).toMatch(/no first round/);
  });
  it("Divine Fury needs the rage; an unknown clock is never due", () => {
    expect(
      c.riderDue(reg.CLOCK_RIDERS["divine-fury"], { inCombat: true, weapon: true, raging: false })
        .why
    ).toMatch(/not raging/);
    expect(
      c.riderDue(reg.CLOCK_RIDERS["divine-fury"], { inCombat: true, weapon: true, raging: true })
        .due
    ).toBe(true);
    expect(c.riderDue({ when: "someday" }, {}).due).toBe(false);
  });
});

describe("riderPartFormula — the pack's part as a formula", () => {
  it("plain dice, a custom formula, a bonus, and Assassinate's bonus-only part", () => {
    expect(c.riderPartFormula({ number: 2, denomination: 6 })).toBe("2d6");
    expect(
      c.riderPartFormula({ custom: { enabled: true, formula: "@scale.gloom.dreadful-strike" } })
    ).toBe("@scale.gloom.dreadful-strike");
    expect(
      c.riderPartFormula({
        number: 1,
        denomination: 6,
        bonus: "(floor(@classes.barbarian.levels / 2))"
      })
    ).toBe("1d6 + (floor(@classes.barbarian.levels / 2))");
    expect(
      c.riderPartFormula({ number: null, denomination: null, bonus: "@classes.rogue.levels" })
    ).toBe("@classes.rogue.levels");
    expect(c.riderPartFormula({})).toBeNull();
  });
});

describe('Slice A (2026-09-24): `when: "any"`, uses on the item, effects on the rider', () => {
  it("`any` is due on every hit — in combat or out, a chit standing or not — while a use is left", () => {
    const row = { when: "any", uses: true };
    expect(c.riderDue(row, { usesLeft: 2 })).toMatchObject({ due: true });
    expect(
      c.riderDue(row, { usesLeft: 2, inCombat: true, round: 4, chitStands: true })
    ).toMatchObject({ due: true });
    expect(c.riderDue(row, { usesLeft: 0 })).toMatchObject({ due: false, why: "no uses left" });
    expect(c.riderDue(row, { usesLeft: null })).toMatchObject({ due: false });
  });
  it("Fire's Burn is not weapon-only: a spell attack's hit is due too", () => {
    expect(c.riderDue(reg.CLOCK_RIDERS["fires-burn"], { usesLeft: 3, weapon: false }).due).toBe(
      true
    );
  });
  it("the uses are the activity's when it carries them, else the item's — only for a `uses` row", () => {
    expect(
      c.riderUsesFrom({
        activity: { max: 3, value: 2, spent: 1 },
        item: { max: 5, value: 5, spent: 0 },
        uses: true
      })
    ).toEqual({ left: 2, max: 3, spent: 1, on: "activity" });
    expect(
      c.riderUsesFrom({
        activity: { max: "", value: null, spent: 0 },
        item: { max: 3, value: 3, spent: 0 },
        uses: true
      })
    ).toEqual({ left: 3, max: 3, spent: 0, on: "item" });
    expect(
      c.riderUsesFrom({ activity: { max: "" }, item: { max: 3, value: 3 }, uses: false })
    ).toBeNull();
    expect(c.riderUsesFrom({ activity: { max: "" }, item: { max: "" }, uses: true })).toBeNull();
    expect(c.riderUsesFrom({ activity: null, item: null, uses: true })).toBeNull();
  });
  it("the two rows: Fire's Burn and Frost's Chill ride on any hit from their item's uses; Frost's Chill lands its effect on the Slow clock", () => {
    expect(reg.CLOCK_RIDERS["fires-burn"]).toMatchObject({
      feature: "Fire's Burn",
      activity: "Burn",
      when: "any",
      uses: true
    });
    expect(reg.CLOCK_RIDERS["fires-burn"].weapon).toBeUndefined();
    expect(reg.CLOCK_RIDERS["frosts-chill"]).toMatchObject({
      feature: "Frost's Chill",
      activity: "Chill",
      when: "any",
      uses: true,
      effects: true,
      clock: "slow"
    });
    expect(reg.HIT_OPTION_NAMES.has("fire's burn")).toBe(false);
    expect(reg.HIT_OPTION_NAMES.has("frost's chill")).toBe(false);
    expect(reg.HIT_OPTION_NAMES.has("hill's tumble")).toBe(true);
  });
});

describe("the registry's clock-rider data", () => {
  it("every row names its feature, its activity, a known clock and its rule; the list default is the table", () => {
    for (const [key, row] of Object.entries(reg.CLOCK_RIDERS)) {
      expect(row.feature, key).toBeTruthy();
      // A row with no activity names its own `amount` (Celestial Revelation, 2026-09-25: no
      // activity carries the extra damage — the text's `@prof` does).
      if (row.activity === null) expect(row.amount, key).toMatch(/^@/);
      else expect(row.activity, key).toBeTruthy();
      if (row.judge === "transformed") expect(row.forms?.length, key).toBeGreaterThan(0);
      // `any` (Slice A, 2026-09-24): every hit, uses permitting — the Goliath's boons.
      expect(["oncePerTurn", "firstRound", "any"], key).toContain(row.when);
      if (row.when === "any") expect(row.uses, key).toBe(true);
      if (row.effects) expect(Object.keys(chips.CHIP_WINDOWS), key).toContain(row.clock);
      expect(row.rule.length, key).toBeGreaterThan(20);
    }
    expect(reg.LIST_SPECS.clockRiders.default).toBe(
      Object.values(reg.CLOCK_RIDERS)
        .map(r => r.feature)
        .join(", ")
    );
    expect(reg.CLOCK_RIDER_NAMES.has("dread ambusher")).toBe(true);
    const { entries, rejects } = reg.parseList(
      reg.LIST_SPECS.clockRiders,
      reg.LIST_SPECS.clockRiders.default
    );
    expect(rejects).toEqual([]);
    expect(entries.map(e => e.kind)).toEqual([...reg.CLOCK_RIDER_NAMES]);
  });
  it("Assassinate's Advantage is an effect-table row with the clock as its judge", () => {
    expect(reg.EFFECT_BENDS["Assassinate"]).toMatchObject({
      match: "feature",
      attacker: "advantage",
      judge: "targetNotActed"
    });
  });
});
