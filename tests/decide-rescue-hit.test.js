import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer: the `roll` interrupt (Slice A, ruled 2026-09-24 off prototypes/slice-a.html) —
 * Disadvantage imposed on an attack roll already made. No Foundry stub on purpose: this layer
 * decides whether an attack lands (ARCHITECTURE §11 *Adding a FOLD* rule 5), so every case the
 * ruling names is pinned here — the plain roll, the Advantage that cancels, the Disadvantage that
 * cannot stack, and the natural 20 a lower die undoes.
 */
/** @type {typeof import("../scripts/decide/rescue-hit.js")} */
let r;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  r = await import("../scripts/decide/rescue-hit.js");
  reg = await import("../scripts/decide/registry.js");
});

describe("d20ModeOf — the mode the attack was rolled in, off its own die", () => {
  it("reads kh as Advantage and kl as Disadvantage, a lone die as a plain roll", () => {
    expect(r.d20ModeOf({ number: 2, modifiers: ["kh"] })).toBe("advantage");
    expect(r.d20ModeOf({ number: 3, modifiers: ["kh1"] })).toBe("advantage"); // Elven Accuracy
    expect(r.d20ModeOf({ number: 2, modifiers: ["kl"] })).toBe("disadvantage");
    expect(r.d20ModeOf({ number: 1, modifiers: [] })).toBe("normal");
    expect(r.d20ModeOf({ number: 1, modifiers: ["r1=1"] })).toBe("normal"); // a Halfling's reroll is no mode
    expect(r.d20ModeOf({})).toBe("normal");
  });
});

describe("d20Faces — the face that stood and the plain first face", () => {
  it("skips a face a reroll modifier replaced", () => {
    expect(
      r.d20Faces([
        { result: 1, active: false, rerolled: true },
        { result: 12, active: true }
      ])
    ).toEqual({ kept: 12, plain: 12 });
  });
  it("under Advantage the kept face is the active one and the plain one is the FIRST rolled", () => {
    expect(
      r.d20Faces([
        { result: 6, active: false, discarded: true },
        { result: 17, active: true }
      ])
    ).toEqual({ kept: 17, plain: 6 });
  });
  it("nothing rolled is nothing", () => {
    expect(r.d20Faces([])).toEqual({ kept: null, plain: null });
  });
});

describe("disadvantageOutcome — the arithmetic the ruling names", () => {
  it("a plain roll: the second d20 lower — the lower stands, and 17 becomes 13", () => {
    const o = r.disadvantageOutcome({ mode: "normal", kept: 12, second: 8, total: 17 });
    expect(o).toMatchObject({
      how: "lower",
      first: 12,
      second: 8,
      stood: 8,
      firstTotal: 17,
      total: 13,
      changed: true,
      isCritical: false,
      isFumble: false
    });
    expect(r.needsSecondD20("normal")).toBe(true);
  });

  it("a plain roll: the second d20 higher — the first is still the lower and it stands (scene 2b2)", () => {
    const o = r.disadvantageOutcome({ mode: "normal", kept: 12, second: 14, total: 17 });
    expect(o).toMatchObject({ stood: 12, total: 17, changed: false });
  });

  it("ADVANTAGE AND DISADVANTAGE CANCEL: the roll is a plain roll — the first die — and no second die is rolled", () => {
    expect(r.needsSecondD20("advantage")).toBe(false);
    const o = r.disadvantageOutcome({ mode: "advantage", kept: 18, plain: 6, total: 23 });
    expect(o).toMatchObject({
      how: "cancelled",
      first: 18,
      second: null,
      stood: 6,
      total: 11,
      changed: true
    });
    // The kept face WAS the first die: cancelling changes nothing.
    expect(
      r.disadvantageOutcome({ mode: "advantage", kept: 18, plain: 18, total: 23 })
    ).toMatchObject({ stood: 18, changed: false });
  });

  it("a roll ALREADY at Disadvantage: Disadvantage does not stack — nothing moves", () => {
    expect(r.needsSecondD20("disadvantage")).toBe(false);
    expect(r.disadvantageOutcome({ mode: "disadvantage", kept: 9, total: 14 })).toMatchObject({
      how: "none",
      stood: 9,
      total: 14,
      changed: false
    });
  });

  it("A NATURAL 20 CAN BE UNDONE: the lower die replaces it and the crit goes with it", () => {
    const o = r.disadvantageOutcome({ mode: "normal", kept: 20, second: 11, total: 25 });
    expect(o).toMatchObject({
      wasCritical: true,
      isCritical: false,
      stood: 11,
      total: 16,
      changed: true
    });
  });

  it("a natural 20 twice is still a crit; a natural 1 on the second die is a fumble", () => {
    expect(
      r.disadvantageOutcome({ mode: "normal", kept: 20, second: 20, total: 25 })
    ).toMatchObject({ isCritical: true, changed: false });
    expect(r.disadvantageOutcome({ mode: "normal", kept: 15, second: 1, total: 20 })).toMatchObject(
      { isFumble: true, total: 6 }
    );
  });

  it("the attack's own crit range rides the stood die (a Champion's 19)", () => {
    expect(
      r.disadvantageOutcome({ mode: "normal", kept: 20, second: 19, total: 27, critAt: 19 })
    ).toMatchObject({ isCritical: true, stood: 19 });
  });

  it("the second die lost (null) leaves the first standing", () => {
    expect(
      r.disadvantageOutcome({ mode: "normal", kept: 12, second: null, total: 17 })
    ).toMatchObject({ stood: 12, changed: false });
  });
});

describe("critStands — one damage roll serves every hit target", () => {
  it("no rolled crit, no crit", () => {
    expect(r.critStands({ rolledCrit: false, hitUuids: ["a"], bents: {} })).toBe(false);
  });
  it("a rolled crit no hold bent stands", () => {
    expect(r.critStands({ rolledCrit: true, hitUuids: ["a", "b"], bents: {} })).toBe(true);
  });
  it("a bent roll that is no longer a crit takes it from the whole roll", () => {
    expect(
      r.critStands({ rolledCrit: true, hitUuids: ["a", "b"], bents: { a: { isCritical: false } } })
    ).toBe(false);
  });
  it("a bent roll that stayed a crit (20 twice) keeps it; a bent target no longer hit is not asked", () => {
    expect(
      r.critStands({ rolledCrit: true, hitUuids: ["a"], bents: { a: { isCritical: true } } })
    ).toBe(true);
    expect(
      r.critStands({ rolledCrit: true, hitUuids: ["b"], bents: { a: { isCritical: false } } })
    ).toBe(true);
  });
});

describe("rescueRows — the popup's rows (scenes 2a, 2a2, 2a3, 2c)", () => {
  const lucky = { name: "Lucky", reaction: false, uses: true, point: "Luck Point", left: 3 };
  const flare = { name: "Warding Flare", reaction: true, uses: true, point: null, left: 2 };
  const dodge = { name: "Shadowy Dodge", reaction: true, uses: false, point: null, left: null };
  const shield = { name: "Shield", kind: "ac", bonus: 5, spell: true };
  const facts = { reactionSpent: false, isCritical: false, mode: "normal" };

  it("Shield and Lucky, each with its cost as the tag", () => {
    expect(r.rescueRows({ primary: shield, rolls: [lucky], facts })).toEqual([
      {
        key: "Shield",
        name: "Shield",
        kind: "ac",
        dice: "+5 AC",
        tag: "a Reaction, a spell slot",
        off: null
      },
      {
        key: "Lucky",
        name: "Lucky",
        kind: "roll",
        dice: "Disadvantage",
        tag: "1 Luck Point · 3 left",
        off: null
      }
    ]);
  });

  it("three cost shapes, one row shape", () => {
    const rows = r.rescueRows({ primary: null, rolls: [flare, dodge, lucky], facts });
    expect(rows.map(x => x.tag)).toEqual([
      "a Reaction · 2 uses left",
      "a Reaction",
      "1 Luck Point · 3 left"
    ]);
    expect(r.liveRows(rows).length).toBe(3);
  });

  it("a spent Reaction greys the Reaction rows and never Lucky", () => {
    const rows = r.rescueRows({
      primary: null,
      rolls: [flare, dodge, { ...lucky, left: 1 }],
      facts: { ...facts, reactionSpent: true }
    });
    expect(rows.map(x => x.off)).toEqual([
      "Reaction spent this round",
      "Reaction spent this round",
      null
    ]);
    expect(rows[2].tag).toBe("1 Luck Point · 1 left");
  });

  it("every row out: nothing live — the popup is skipped", () => {
    const rows = r.rescueRows({
      primary: null,
      rolls: [{ ...flare, left: 0 }, dodge, { ...lucky, left: 0 }],
      facts: { ...facts, reactionSpent: true }
    });
    expect(rows.map(x => x.off)).toEqual([
      "Reaction spent this round",
      "Reaction spent this round",
      "no Luck Points left"
    ]);
    expect(r.liveRows(rows)).toEqual([]);
    const flareOnly = r.rescueRows({ primary: null, rolls: [{ ...flare, left: 0 }], facts });
    expect(flareOnly[0].off).toBe("no uses left");
  });

  it("a crit greys Shield — a crit ignores AC — and Lucky stays live", () => {
    const rows = r.rescueRows({
      primary: shield,
      rolls: [lucky],
      facts: { ...facts, isCritical: true }
    });
    expect(rows.map(x => [x.name, x.off])).toEqual([
      ["Shield", "a crit ignores AC"],
      ["Lucky", null]
    ]);
  });

  it("a roll already at Disadvantage greys every Disadvantage row", () => {
    const rows = r.rescueRows({
      primary: shield,
      rolls: [lucky],
      facts: { ...facts, mode: "disadvantage" }
    });
    expect(rows.map(x => x.off)).toEqual([null, "already at Disadvantage"]);
  });

  it("a damage reaction's row says what it does to the damage", () => {
    expect(
      r.rescueRows({
        primary: { name: "Uncanny Dodge", kind: "damage", multiplier: 0.5 },
        rolls: [],
        facts
      })[0]
    ).toMatchObject({ dice: "halves the damage", tag: "a Reaction" });
    expect(
      r.rescueRows({ primary: { name: "Parry", kind: "damage", pool: true }, rolls: [], facts })[0]
    ).toMatchObject({ dice: "reduces the damage", tag: "a Reaction, a Superiority Die" });
  });

  it('the title: several rows are "Rescue the hit", one row names itself', () => {
    const two = r.rescueRows({ primary: shield, rolls: [lucky], facts });
    expect(r.rescueTitle(two, "BF Test Halfling")).toBe("Rescue the hit — BF Test Halfling");
    expect(r.rescueTitle(two.slice(1), "BF Test Halfling")).toBe("Lucky — BF Test Halfling");
  });
});

describe("the cards — the attacker's line and the defender's spend", () => {
  it("scene 2d: Lucky bent the roll — Disadvantage, 17 → 13, MISS", () => {
    const bent = r.disadvantageOutcome({ mode: "normal", kept: 12, second: 8, total: 17 });
    const { headline, detail } = r.bentLines({ rescue: "Lucky", bent, verdict: "miss", ac: 15 });
    expect(headline).toBe("Lucky bent the roll — Disadvantage, 17 → 13, MISS");
    expect(detail).toBe("d20 12 (17), second d20 8 — the lower stands: 8 (13) vs AC 15");
  });
  it("the higher second die: the 17 stands, still a HIT", () => {
    const bent = r.disadvantageOutcome({ mode: "normal", kept: 12, second: 14, total: 17 });
    expect(r.bentLines({ rescue: "Lucky", bent, verdict: "hit", ac: 15 }).headline).toBe(
      "Lucky bent the roll — Disadvantage, the 17 stands, still a HIT"
    );
  });
  it("a crit undone: a hit, no longer a crit", () => {
    const bent = r.disadvantageOutcome({ mode: "normal", kept: 20, second: 11, total: 25 });
    expect(r.bentLines({ rescue: "Lucky", bent, verdict: "hit", ac: 15 }).headline).toBe(
      "Lucky bent the roll — Disadvantage, natural 20 → 16, a hit, no longer a crit"
    );
  });
  it("Advantage cancelled says so", () => {
    const bent = r.disadvantageOutcome({ mode: "advantage", kept: 18, plain: 6, total: 23 });
    expect(r.bentLines({ rescue: "Warding Flare", bent, verdict: "miss", ac: 15 }).headline).toBe(
      "Warding Flare bent the roll — Disadvantage cancels the Advantage, 23 → 11, MISS"
    );
  });
  it("the defender's spend line, three cost shapes (scene 2a's words)", () => {
    const rows = reg.INTERRUPT_ROLLS;
    expect(
      r.rescueSpendText({ row: rows.Lucky, poolSpend: { pool: "Luck Points", left: 2, max: 3 } })
    ).toBe("1 Luck Point spent · Luck Points: 2 of 3 remaining");
    expect(
      r.rescueSpendText({
        row: rows["Warding Flare"],
        poolSpend: { pool: "Warding Flare", left: 1, max: 2 }
      })
    ).toBe("Reaction spent · Warding Flare: 1 of 2 remaining");
    expect(r.rescueSpendText({ row: rows["Shadowy Dodge"] })).toBe(
      "Reaction spent · teleport up to 30 feet if you wish (the table moves the token)"
    );
  });
});

describe("plainRule — a reaction's own text as its folded rule", () => {
  it("flattens the HTML, keeps an enricher's label, drops a lookup and the Foundry Note", () => {
    const html =
      "<p>You gain a +5 bonus to AC. &Reference[prone apply=false] matters.</p><p>Uses [[lookup @prof]] now.</p><p>Foundry Note The effect is applied.</p>";
    expect(r.plainRule(html)).toBe("You gain a +5 bonus to AC. Prone matters. Uses now.");
  });
});

describe("INTERRUPT_ROLLS — the three rows and the interrupt default", () => {
  it("each row carries a cost shape and its rule verbatim", () => {
    for (const [name, row] of Object.entries(reg.INTERRUPT_ROLLS)) {
      expect(typeof row.reaction, name).toBe("boolean");
      expect(typeof row.uses, name).toBe("boolean");
      expect(row.rule.length, name).toBeGreaterThan(40);
      expect(row.activity, name).toBeTruthy();
    }
    expect(reg.INTERRUPT_ROLLS.Lucky).toMatchObject({
      reaction: false,
      uses: true,
      point: "Luck Point",
      activity: "Disadvantage"
    });
    expect(reg.INTERRUPT_ROLLS["Warding Flare"]).toMatchObject({ reaction: true, uses: true });
    expect(reg.INTERRUPT_ROLLS["Shadowy Dodge"]).toMatchObject({ reaction: true, uses: false });
  });
  it("the shipped Interrupt list lists every row as the `roll` kind, and parses clean", () => {
    const { entries, rejects } = reg.parseList(
      reg.LIST_SPECS.interrupt,
      reg.LIST_SPECS.interrupt.default
    );
    expect(rejects).toEqual([]);
    for (const name of Object.keys(reg.INTERRUPT_ROLLS)) {
      expect(entries.find(e => e.name === name)?.kind, name).toBe("roll");
    }
  });
});
