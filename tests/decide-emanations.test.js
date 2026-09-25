import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer emanations (ARCHITECTURE.md §2): reach by disposition, range from the content,
 * the source's numbers read into the pack's effect. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/emanations.js")} */
let em;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  em = await import("../scripts/decide/emanations.js");
  reg = await import("../scripts/decide/registry.js");
});

const { FRIENDLY, NEUTRAL, HOSTILE, SECRET } = { FRIENDLY: 1, NEUTRAL: 0, HOSTILE: -1, SECRET: -2 };

describe("reach `all` and the area's own `affects` (the Aasimar walk, 2026-09-25)", () => {
  it("`all` reaches every side — allies included, as Inner Radiance's text says — but never a SECRET token", () => {
    for (const d of [FRIENDLY, NEUTRAL, HOSTILE])
      expect(em.reachAdmits("all", FRIENDLY, d)).toBe(true);
    expect(em.reachAdmits("all", FRIENDLY, SECRET)).toBe(false);
  });
  it('affects `enemy` takes everyone not on the caster\'s side (Necrotic Shroud: "creatures other than your allies")', () => {
    expect(em.affectsAdmits("enemy", FRIENDLY, HOSTILE)).toBe(true);
    expect(em.affectsAdmits("enemy", FRIENDLY, NEUTRAL)).toBe(true);
    expect(em.affectsAdmits("enemy", FRIENDLY, FRIENDLY)).toBe(false);
    expect(em.affectsAdmits("enemy", HOSTILE, HOSTILE)).toBe(false);
  });
  it("affects `ally` takes the caster's side only; any other affects takes everyone", () => {
    expect(em.affectsAdmits("ally", FRIENDLY, FRIENDLY)).toBe(true);
    expect(em.affectsAdmits("ally", FRIENDLY, NEUTRAL)).toBe(false);
    for (const a of ["creature", "", null, "any"])
      expect(em.affectsAdmits(a, FRIENDLY, HOSTILE)).toBe(true);
  });
  it("Inner Radiance is a feature row that stands while its effect does and pulses at the bearer's turn end", () => {
    const row = reg.EMANATIONS["Inner Radiance"];
    expect(row).toMatchObject({
      kind: "feature",
      item: "Celestial Revelation",
      activity: "Inner Radiance",
      while: "Searing Radiance",
      reach: "all",
      effect: null
    });
    expect(row.pulse).toEqual({ on: "sourceTurnEnd", activity: "Inner Radiance" });
  });
});

describe("reachAdmits — the user's defaults (2026-09-03): helpful reaches allies and neutrals, harmful reaches enemies", () => {
  it("a friendly Paladin's aura reaches friendlies and neutrals, never hostiles", () => {
    expect(em.reachAdmits("helpful", FRIENDLY, FRIENDLY)).toBe(true);
    expect(em.reachAdmits("helpful", FRIENDLY, NEUTRAL)).toBe(true);
    expect(em.reachAdmits("helpful", FRIENDLY, HOSTILE)).toBe(false);
  });
  it("a hostile paladin's aura reaches hostiles and neutrals", () => {
    expect(em.reachAdmits("helpful", HOSTILE, HOSTILE)).toBe(true);
    expect(em.reachAdmits("helpful", HOSTILE, NEUTRAL)).toBe(true);
    expect(em.reachAdmits("helpful", HOSTILE, FRIENDLY)).toBe(false);
  });
  it("a friendly cleric's Spirit Guardians reach hostiles only — allies and neutrals are the designated unaffected", () => {
    expect(em.reachAdmits("harmful", FRIENDLY, HOSTILE)).toBe(true);
    expect(em.reachAdmits("harmful", FRIENDLY, FRIENDLY)).toBe(false);
    expect(em.reachAdmits("harmful", FRIENDLY, NEUTRAL)).toBe(false);
  });
  it("a neutral source's harm reaches every side but its own", () => {
    expect(em.reachAdmits("harmful", NEUTRAL, HOSTILE)).toBe(true);
    expect(em.reachAdmits("harmful", NEUTRAL, FRIENDLY)).toBe(true);
    expect(em.reachAdmits("harmful", NEUTRAL, NEUTRAL)).toBe(false);
  });
  it("a secret token is nobody's business, either way", () => {
    expect(em.reachAdmits("helpful", FRIENDLY, SECRET)).toBe(false);
    expect(em.reachAdmits("harmful", SECRET, HOSTILE)).toBe(false);
  });
  it("an unknown reach admits nobody", () => {
    expect(em.reachAdmits("sideways", FRIENDLY, FRIENDLY)).toBe(false);
  });
});

describe("resolveFormula / resolveChanges — the SOURCE's numbers travel with the effect", () => {
  const paladin = { abilities: { cha: { mod: 3 } }, scale: { paladin: { aura: { value: 10 } } } };
  it("reads @abilities.cha.mod off the Paladin, not the receiver (the pack's own note)", () => {
    const { changes, unresolved } = em.resolveChanges(
      [{ key: "system.bonuses.abilities.save", mode: 2, value: "@abilities.cha.mod" }],
      paladin
    );
    expect(unresolved).toEqual([]);
    expect(changes[0].value).toBe("3");
    expect(changes[0].key).toBe("system.bonuses.abilities.save");
  });
  it("leaves a change with no formula alone (Warding's resistances, Half Speed's multiplier)", () => {
    const { changes } = em.resolveChanges(
      [
        { key: "system.traits.dr.value", mode: 2, value: "necrotic" },
        { key: "system.attributes.movement.speed", mode: 1, value: "0.5" }
      ],
      paladin
    );
    expect(changes.map(c => c.value)).toEqual(["necrotic", "0.5"]);
  });
  it("reports an unresolved token instead of shipping a silent zero", () => {
    const { changes, unresolved } = em.resolveChanges(
      [{ key: "x", mode: 2, value: "@abilities.wis.mod" }],
      paladin
    );
    expect(unresolved).toEqual(["abilities.wis.mod"]);
    expect(changes[0].value).toBe("@abilities.wis.mod");
  });
  it("folds plain arithmetic and nothing else", () => {
    expect(em.foldArithmetic("2 + 1")).toBe("3");
    expect(em.foldArithmetic("-1")).toBe("-1");
    expect(em.foldArithmetic("3 * (2 - 1)")).toBe("3");
    expect(em.foldArithmetic("1d8 + 2")).toBe("1d8 + 2");
    expect(em.foldArithmetic("necrotic")).toBe("necrotic");
  });
  it("a scale value arrives as an object and reads as its number", () => {
    expect(em.lookupRollData(paladin, "scale.paladin.aura")).toBe(10);
    expect(em.lookupRollData(paladin, "scale.paladin.nothing")).toBe(null);
    expect(em.lookupRollData({}, "a.b.c")).toBe(null);
  });
});

describe("emanationRange — the content's data first, the class's scale value second, nothing invented", () => {
  it("takes the activity's own size when the pack gives one (Spirit Guardians: 15)", () => {
    expect(em.emanationRange({ range: "@scale.paladin.aura" }, {}, 15)).toBe(15);
    expect(em.emanationRange({ range: 10 }, {}, "15")).toBe(15);
  });
  it("reads the Paladin's aura scale value — 10 at 6th, 30 at 18th — and NOTHING below 6th", () => {
    const row = { range: "@scale.paladin.aura" };
    expect(em.emanationRange(row, { scale: { paladin: { aura: { value: 10 } } } })).toBe(10);
    expect(em.emanationRange(row, { scale: { paladin: { aura: { value: 30 } } } })).toBe(30);
    expect(em.emanationRange(row, { scale: { paladin: { aura: null } } })).toBe(null);
    expect(em.emanationRange(row, {})).toBe(null);
  });
  it("a zero-size activity (Aura of Courage's formula on a bare item) falls through to the row", () => {
    expect(
      em.emanationRange(
        { range: "@scale.paladin.aura" },
        { scale: { paladin: { aura: { value: 10 } } } },
        0
      )
    ).toBe(10);
  });
  it("a row with no range at all reaches nowhere", () => {
    expect(em.emanationRange({}, {})).toBe(null);
    expect(em.emanationRange({ range: 0 }, {})).toBe(null);
  });
});

describe("triggerDue — once per turn in combat, every time out of it (DESIGN §8)", () => {
  it("in combat, a standing chit means the save was already made this turn", () => {
    expect(em.triggerDue({ inCombat: true, chitStands: true }).due).toBe(false);
    expect(em.triggerDue({ inCombat: true, chitStands: false })).toEqual({
      due: true,
      why: "once this turn"
    });
  });
  it("out of combat there is no turn to be once-per", () => {
    expect(em.triggerDue({ inCombat: false, chitStands: true }).due).toBe(true);
  });
});

describe("memberEffectData — the pack's effect, named for its source, fingerprinted for the floor", () => {
  it("carries the resolved changes, the source's item as origin, and the region in its flag", () => {
    const data = em.memberEffectData(
      { key: "Aura of Protection", rule: "You radiate…" },
      {
        name: "Protected",
        img: null,
        changes: [{ key: "system.bonuses.abilities.save", mode: 2, value: "3" }]
      },
      {
        sourceName: "Ysolde",
        itemUuid: "Actor.a.Item.b",
        regionId: "R1",
        moduleId: "bf",
        flagKey: "emanation"
      }
    );
    expect(data.name).toBe("Protected — Ysolde");
    expect(data.origin).toBe("Actor.a.Item.b");
    expect(data.transfer).toBe(false);
    expect(data.changes[0].value).toBe("3");
    expect(data.flags.bf.emanation).toEqual({ regionId: "R1", key: "Aura of Protection" });
    expect(data.img).toBe("icons/svg/aura.svg");
    expect(data.description).toContain("Aura of Protection: Ysolde's emanation");
  });
  it("reads the row the way the edge hands it — `rowNamed`'s shape, whose name is `key` (2026-09-23: `row.name` was undefined on every live copy)", async () => {
    const row = reg.tableIndex(reg.EMANATIONS).rowNamed("aura of protection");
    const data = em.memberEffectData(
      row,
      { name: "Protected", changes: [] },
      { sourceName: "Ysolde", itemUuid: null, regionId: "R1", moduleId: "bf", flagKey: "emanation" }
    );
    expect(data.flags.bf.emanation.key).toBe("Aura of Protection");
    expect(data.description).not.toContain("undefined");
  });
  it("carries the aura's group when given — the key the floor keeps one copy per", () => {
    const data = em.memberEffectData(
      { key: "Aura of Protection" },
      { name: "Protected", changes: [] },
      {
        sourceName: "Ysolde",
        itemUuid: "Actor.a.Item.b",
        regionId: "R1",
        group: "Actor.a.Item.b|Aura of Protection",
        moduleId: "bf",
        flagKey: "emanation"
      }
    );
    expect(data.flags.bf.emanation).toEqual({
      regionId: "R1",
      key: "Aura of Protection",
      group: "Actor.a.Item.b|Aura of Protection"
    });
  });
});

describe("the EMANATIONS table (decide/registry.js)", () => {
  it("names the four rows of the first slice, each with a kind, a reach, a rule and an effect", () => {
    const names = Object.keys(reg.EMANATIONS);
    expect(names).toEqual(
      expect.arrayContaining([
        "Aura of Protection",
        "Aura of Courage",
        "Aura of Warding",
        "Spirit Guardians"
      ])
    );
    for (const [name, row] of Object.entries(reg.EMANATIONS)) {
      expect(reg.EMANATION_KINDS.has(row.kind), name).toBe(true);
      // `all` (the Aasimar walk, 2026-09-25): Inner Radiance's "each creature within 10 feet".
      expect(["helpful", "harmful", "all"], name).toContain(row.reach);
      if (row.pulse) expect(row.effect, name).toBeNull();
      expect(typeof row.rule, name).toBe("string");
      // The second slice (2026-09-05) admits rows that apply NOTHING — a barrier, a notice.
      expect(["string", "object"], name).toContain(typeof row.effect);
    }
  });
  it("the second slice: five PHB auras with the pack's own effect, a notice, a ring — and no dice anywhere", () => {
    const names = Object.keys(reg.EMANATIONS);
    for (const n of [
      "Aura of Life",
      "Aura of Purity",
      "Circle of Power",
      "Crusader's Mantle",
      "Holy Aura"
    ]) {
      expect(names).toContain(n);
      expect(typeof reg.EMANATIONS[n].effect, n).toBe("string");
      expect(reg.EMANATIONS[n].kind, n).toBe("spell");
      expect(reg.EMANATIONS[n].reach, n).toBe("helpful");
      expect(reg.EMANATIONS[n].range, n).toBe(null);
    }
    expect(reg.EMANATIONS["Aura of Life"].heal).toEqual({
      on: "turnStart",
      when: "zeroHP",
      activity: "Create Aura"
    });
    expect(reg.EMANATIONS["Aura of Vitality"]).toMatchObject({
      effect: null,
      remind: { on: "sourceTurnStart", activity: "Start of Turn Heal" }
    });
    expect(reg.EMANATIONS["Antilife Shell"]).toMatchObject({ effect: null, reach: "harmful" });
    for (const [name, row] of Object.entries(reg.EMANATIONS)) {
      const { rule, ...rest } = row;
      expect(JSON.stringify(rest), name).not.toMatch(/\d+d\d+/);
    }
  });
  it("healTriggerDue: Aura of Life pays an ally at 0 HP at its turn start, and nobody else", () => {
    const row = reg.EMANATIONS["Aura of Life"];
    expect(em.healTriggerDue(row, { cause: "turnStart", hp: 0 })).toEqual({
      due: true,
      why: "at 0 Hit Points at the start of its turn"
    });
    expect(em.healTriggerDue(row, { cause: "turnStart", hp: 12 }).due).toBe(false);
    expect(em.healTriggerDue(row, { cause: "turnEnd", hp: 0 }).due).toBe(false);
    // dnd5e marks a 0-HP creature dead on its own — the Hit Points alone decide (measured 2026-09-05).
    expect(
      em.healTriggerDue(reg.EMANATIONS["Aura of Purity"], { cause: "turnStart", hp: 0 }).due
    ).toBe(false);
  });
  it("the Paladin's three auras read their range off the class's own scale value, never a number here", () => {
    for (const n of ["Aura of Protection", "Aura of Courage", "Aura of Warding"]) {
      expect(reg.EMANATIONS[n].range).toBe("@scale.paladin.aura");
      expect(reg.EMANATIONS[n].kind).toBe("feature");
      expect(reg.EMANATIONS[n].incapacitated).toBe(true);
    }
  });
  it("Spirit Guardians is a cast emanation with a save on entering and on ending a turn inside, once per turn", () => {
    const sg = reg.EMANATIONS["Spirit Guardians"];
    expect(sg.kind).toBe("spell");
    expect(sg.reach).toBe("harmful");
    expect(sg.range).toBe(null);
    expect(sg.trigger).toEqual({ on: ["enter", "turnEnd"], oncePerTurn: true });
  });
  it("the Emanations list is membership over the table's names, whole-chunk, and ships every row ON", () => {
    const spec = reg.LIST_SPECS.emanations;
    expect(spec.membership).toBe(true);
    expect(spec.whole).toBe(true);
    const entries = reg.parseList(spec, spec.default).entries.map(e => e.kind);
    expect(entries.sort()).toEqual(
      Object.keys(reg.EMANATIONS)
        .map(s => s.toLowerCase())
        .sort()
    );
    expect(reg.parseList(spec, "Aura of Protection, Fireball").rejects).toHaveLength(1);
  });
  it("the emanation kind set is counted by the R4 tripwire", () => {
    const set = reg.KIND_SETS.find(s => s.name === "emanation");
    expect(set?.owner).toBe("emanations.js");
    expect([...set.kinds].sort()).toEqual(["feature", "spell"]);
  });
});

describe("damageTypeFor — Spirit Guardians' type is the alignment's by default, and the caster's when chosen", () => {
  const both = ["necrotic", "radiant"];
  it("a good or neutral (or unaligned) caster deals radiant", () => {
    expect(em.damageTypeFor(both, "Neutral Good").type).toBe("radiant");
    expect(em.damageTypeFor(both, "").type).toBe("radiant");
    expect(em.damageTypeFor(both, null).type).toBe("radiant");
  });
  it("an evil caster deals necrotic", () => {
    expect(em.damageTypeFor(both, "Chaotic Evil").type).toBe("necrotic");
    expect(em.damageTypeFor(both, "lawful evil").type).toBe("necrotic");
  });
  it("a pick that the part offers wins over the alignment", () => {
    expect(em.damageTypeFor(both, "Neutral Good", "necrotic")).toEqual({
      type: "necrotic",
      why: "chosen"
    });
    expect(em.damageTypeFor(both, "Chaotic Evil", "fire").type).toBe("necrotic");
  });
  it("a single-type part is that type; no part is no type", () => {
    expect(em.damageTypeFor(["fire"], "Chaotic Evil").type).toBe("fire");
    expect(em.damageTypeFor([], "Good").type).toBe(null);
  });
});

describe("liveScenes — the active scene and every scene a connected user views (user, 2026-09-23: Session 8 played on pulled scenes nobody activated)", () => {
  it("the active scene is live, and says so", () => {
    expect([...em.liveScenes("camp", [])]).toEqual([["camp", "the active scene"]]);
  });
  it("a scene a user is viewing is live too, named for the viewer; the active scene keeps its own why", () => {
    const live = em.liveScenes("camp", [
      { sceneId: "upper-floor", name: "Jetten's player" },
      { sceneId: "camp", name: "GM" }
    ]);
    expect(live.get("camp")).toBe("the active scene");
    expect(live.get("upper-floor")).toBe("Jetten's player is viewing it");
    expect(live.size).toBe(2);
  });
  it("no active scene is fine — the viewed scenes still count; a viewer on no scene adds nothing", () => {
    const live = em.liveScenes(null, [
      { sceneId: "apothecary", name: "Gren" },
      { sceneId: null, name: "Idle" }
    ]);
    expect([...live.keys()]).toEqual(["apothecary"]);
  });
  it("nobody anywhere: nothing is live", () => {
    expect(em.liveScenes(null, []).size).toBe(0);
  });
  it("a GM's view does NOT count while a player is connected — a preview of an old scene never raises its rings (user, 2026-09-23: 'if it keeps accuracy')", () => {
    const live = em.liveScenes("camp", [
      { sceneId: "apothecary", name: "Gren", isGM: false },
      { sceneId: "old-camp", name: "Matt the DM", isGM: true },
      { sceneId: "vault", name: "Claude (bridge)", isGM: true }
    ]);
    expect([...live.keys()].sort()).toEqual(["apothecary", "camp"]);
  });
  it("a connected player on no scene still makes it a session — the GM's view does not count", () => {
    const live = em.liveScenes(null, [
      { sceneId: null, name: "Gren", isGM: false },
      { sceneId: "old-camp", name: "Matt the DM", isGM: true }
    ]);
    expect(live.size).toBe(0);
  });
  it("the GM alone — prepping, testing — counts: the view is the only one there is", () => {
    const live = em.liveScenes("camp", [
      { sceneId: "test-range", name: "Matt the DM", isGM: true }
    ]);
    expect(live.get("test-range")).toBe("Matt the DM is viewing it");
  });
});

describe("appliesOnScene — only a LIVE scene's emanations apply (user, 2026-09-04: an aura bled from the camp scene onto the battle map; 2026-09-23: a viewed scene is live)", () => {
  it("a ring on the active scene applies", () => {
    expect(em.appliesOnScene("camp", em.liveScenes("camp", []))).toEqual({
      applies: true,
      why: "the active scene"
    });
  });
  it("a ring on a scene a connected user views applies, though nobody activated it", () => {
    expect(
      em.appliesOnScene(
        "apothecary",
        em.liveScenes("camp", [{ sceneId: "apothecary", name: "Gren" }])
      )
    ).toEqual({ applies: true, why: "Gren is viewing it" });
  });
  it("a ring on a scene nobody is on applies nothing — a linked actor's effect would show on every scene it stands on", () => {
    expect(
      em.appliesOnScene("old-camp", em.liveScenes("battle", [{ sceneId: "battle", name: "Gren" }]))
        .applies
    ).toBe(false);
  });
  it("no live scene, or no scene at all: nothing applies", () => {
    expect(em.appliesOnScene("camp", null).applies).toBe(false);
    expect(em.appliesOnScene("camp", new Map()).applies).toBe(false);
    expect(em.appliesOnScene(null, em.liveScenes("camp", [])).applies).toBe(false);
  });
});

describe("emanationGroup — one aura however many scenes it stands on", () => {
  it("a linked bearer's item names the same aura on every scene", () => {
    expect(em.emanationGroup("Actor.inv.Item.aop", "Aura of Protection", "R1")).toBe(
      em.emanationGroup("Actor.inv.Item.aop", "Aura of Protection", "R2")
    );
  });
  it("two auras of one bearer are two groups; an unlinked bearer's token-borne item is its own", () => {
    expect(em.emanationGroup("Actor.inv.Item.aop", "Aura of Protection", "R1")).not.toBe(
      em.emanationGroup("Actor.inv.Item.aoc", "Aura of Courage", "R1")
    );
    expect(
      em.emanationGroup("Scene.a.Token.t1.Actor.x.Item.i", "Aura of Protection", "R1")
    ).not.toBe(em.emanationGroup("Scene.b.Token.t2.Actor.x.Item.i", "Aura of Protection", "R2"));
  });
  it("a region that names no item is a group of one", () => {
    expect(em.emanationGroup(null, "Aura of Protection", "R1")).toBe("region:R1");
    expect(em.emanationGroup(null, "Aura of Protection", "R1")).not.toBe(
      em.emanationGroup(null, "Aura of Protection", "R2")
    );
  });
});

describe("groupMembers — ONE copy per aura per creature across every live scene (user, 2026-09-23: two scenes can never stack)", () => {
  const area = (regionId, inside, extra = {}) => ({
    regionId,
    applies: true,
    kind: "feature",
    reach: "helpful",
    sourceTokenId: `pal-${regionId}`,
    sourceDisposition: FRIENDLY,
    inside,
    ...extra
  });
  const gren = (tokenId, disposition = FRIENDLY) => ({
    tokenId,
    actorKey: "Actor.gren",
    disposition
  });
  it("a linked ally inside the ring on two live scenes wears ONE copy — the first region's", () => {
    const m = em.groupMembers([area("camp", [gren("g1")]), area("battle", [gren("g2")])]);
    expect([...m]).toEqual([["Actor.gren", "camp"]]);
  });
  it("inside on one scene and outside on the other: still a member", () => {
    const m = em.groupMembers([area("camp", []), area("battle", [gren("g2")])]);
    expect(m.get("Actor.gren")).toBe("battle");
  });
  it("a region on a scene nobody plays on admits nobody", () => {
    const m = em.groupMembers([area("old-camp", [gren("g1")], { applies: false })]);
    expect(m.size).toBe(0);
  });
  it("the reach still decides, per region; a feature's bearer never wears its own ring, a spell's caster does", () => {
    const hostile = { tokenId: "gob", actorKey: "Scene.s.Token.gob.Actor.x", disposition: HOSTILE };
    const bearer = { tokenId: "pal-camp", actorKey: "Actor.pal", disposition: FRIENDLY };
    expect([...em.groupMembers([area("camp", [hostile, bearer])]).keys()]).toEqual([]);
    expect([...em.groupMembers([area("camp", [bearer], { kind: "spell" })]).keys()]).toEqual([
      "Actor.pal"
    ]);
  });
});
