import { beforeAll, describe, expect, it } from "vitest";

/**
 * DECISION-layer demand resolution (ARCHITECTURE.md §2, §4). No Foundry stub on purpose. The
 * three specs below are the SHAPES the machines register (concentration.js, saves.js,
 * mastery.js) — written out here so the precedence and the channel rules are asserted against
 * exactly what the machines declare, not a friendlier stand-in.
 */
/** @type {typeof import("../scripts/decide/demand.js")} */
let d;
beforeAll(async () => {
  d = await import("../scripts/decide/demand.js");
});

const CONC = {
  flagKey: "concentration",
  priority: 0,
  chained: false,
  answering: flag => (flag ? {} : null),
  pendingEntry: (flag, f) =>
    f.rollType === "save" &&
    flag.status === "pending" &&
    flag.actorUuid === f.actorUuid &&
    flag.ability === f.ability
      ? {}
      : null,
  pendingFor: (flag, uuid) => (flag.status === "pending" && flag.actorUuid === uuid ? {} : null)
};
const SAVES = {
  flagKey: "saves",
  priority: 1,
  chained: true,
  answering: (flag, f) => (flag && f.saveFor ? { uuid: f.saveFor } : null),
  pendingEntry: (flag, f) =>
    flag.status === "pending" && flag.abilities?.includes(f.ability)
      ? ((flag.targets ?? []).find(t => !t.done && t.uuid === f.actorUuid) ?? null)
      : null,
  pendingFor: (flag, uuid) =>
    flag.status === "pending"
      ? ((flag.targets ?? []).find(t => !t.done && t.uuid === uuid) ?? null)
      : null
};
const TOPPLE = {
  flagKey: "topple",
  priority: 2,
  chained: true,
  answering: null,
  pendingEntry: (flag, f) =>
    !(flag?.dc > 0) || (flag.ability && f.ability !== flag.ability)
      ? null
      : ((flag.targets ?? []).find(t => !t.done && t.uuid === f.actorUuid) ?? null),
  pendingFor: (flag, uuid) =>
    flag?.dc > 0 ? ((flag.targets ?? []).find(t => !t.done && t.uuid === uuid) ?? null) : null
};
const SPECS = [TOPPLE, SAVES, CONC]; // registration order is NOT priority order, on purpose

const bare = (actorUuid, ability = "con", rollType = "save") => ({
  respondsTo: null,
  saveFor: null,
  originatingMessage: null,
  actorUuid,
  ability,
  rollType
});
const conc = (id, actorUuid, status = "pending") => ({
  id,
  flags: { concentration: { status, actorUuid, ability: "con" } }
});
const saves = (id, uuids, abilities = ["con"], status = "pending") => ({
  id,
  flags: { saves: { status, abilities, targets: uuids.map(u => ({ uuid: u, done: false })) } }
});
const topple = (id, uuids, dc = 14) => ({
  id,
  flags: { topple: { dc, ability: "con", targets: uuids.map(u => ({ uuid: u, done: false })) } }
});

describe("the stamped channel (respondsTo)", () => {
  it("answers the card it names, on the flag that accepts it", () => {
    const r = d.resolveDemand({ ...bare("A"), respondsTo: "c1" }, [conc("c1", "A")], SPECS);
    expect(r).toEqual({ flagKey: "concentration", matches: [{ cardId: "c1", entry: {} }] });
  });
  it("names the saves target through saveFor, and refuses the channel without it", () => {
    const cards = [saves("s1", ["A"])];
    expect(d.resolveDemand({ ...bare("A"), respondsTo: "s1", saveFor: "A" }, cards, SPECS)).toEqual(
      { flagKey: "saves", matches: [{ cardId: "s1", entry: { uuid: "A" } }] }
    );
    expect(d.resolveDemand({ ...bare("A"), respondsTo: "s1" }, cards, SPECS)).toBeNull();
  });
  it("is another machine's channel when the card carries none of these flags, and never Topple's", () => {
    expect(
      d.resolveDemand({ ...bare("A"), respondsTo: "h1" }, [{ id: "h1", flags: {} }], SPECS)
    ).toBeNull();
    expect(
      d.resolveDemand({ ...bare("A"), respondsTo: "t1" }, [topple("t1", ["A"])], SPECS)
    ).toBeNull();
  });
  it("answers a done ask too — the stamp is exact by construction, the fold judges the status", () => {
    expect(
      d.resolveDemand({ ...bare("A"), respondsTo: "c1" }, [conc("c1", "A", "done")], SPECS)?.flagKey
    ).toBe("concentration");
  });
});

describe("the chained channel (originatingMessage)", () => {
  it("answers the saves card it chains to, and the Topple card", () => {
    expect(
      d.resolveDemand({ ...bare("A"), originatingMessage: "s1" }, [saves("s1", ["A"])], SPECS)
    ).toEqual({ flagKey: "saves", matches: [{ cardId: "s1", entry: { uuid: "A", done: false } }] });
    expect(
      d.resolveDemand({ ...bare("A"), originatingMessage: "t1" }, [topple("t1", ["A"])], SPECS)
        ?.flagKey
    ).toBe("topple");
  });
  it("never falls through to a bare match — a save chained elsewhere belongs to that chain", () => {
    const cards = [{ id: "x", flags: {} }, saves("s1", ["A"])];
    expect(d.resolveDemand({ ...bare("A"), originatingMessage: "x" }, cards, SPECS)).toBeNull();
    expect(d.resolveDemand({ ...bare("A"), originatingMessage: "gone" }, cards, SPECS)).toBeNull();
  });
  it("never answers a concentration ask by chain", () => {
    expect(
      d.resolveDemand({ ...bare("A"), originatingMessage: "c1" }, [conc("c1", "A")], SPECS)
    ).toBeNull();
  });
  it("skips a chained card whose entry is not pending", () => {
    expect(
      d.resolveDemand({ ...bare("B"), originatingMessage: "s1" }, [saves("s1", ["A"])], SPECS)
    ).toBeNull();
    expect(
      d.resolveDemand(
        { ...bare("A", "dex"), originatingMessage: "s1" },
        [saves("s1", ["A"])],
        SPECS
      )
    ).toBeNull();
  });
});

describe("the bare roll — ruling 1, the ship order as priority", () => {
  const all = [topple("t1", ["A"]), saves("s1", ["A"]), conc("c1", "A")];
  it("concentration first, then saves, then Topple — regardless of card age or registration order", () => {
    expect(d.resolveDemand(bare("A"), all, SPECS)?.flagKey).toBe("concentration");
    expect(
      d.resolveDemand(
        bare("A"),
        all.filter(c => !c.flags.concentration),
        SPECS
      )?.flagKey
    ).toBe("saves");
    expect(d.resolveDemand(bare("A"), [topple("t1", ["A"])], SPECS)?.flagKey).toBe("topple");
  });
  it("defers only where the older machine has a PENDING entry for this actor and ability", () => {
    expect(
      d.resolveDemand(bare("A"), [conc("c1", "A", "done"), saves("s1", ["A"])], SPECS)?.flagKey
    ).toBe("saves");
    expect(
      d.resolveDemand(bare("A", "dex"), [conc("c1", "A"), saves("s1", ["A"], ["dex"])], SPECS)
        ?.flagKey
    ).toBe("saves");
    expect(d.resolveDemand(bare("A"), [conc("c1", "B"), topple("t1", ["A"])], SPECS)?.flagKey).toBe(
      "topple"
    );
  });
  it("returns EVERY pending card of the winning machine, oldest first — the Topple loop's contract", () => {
    const r = d.resolveDemand(
      bare("A"),
      [topple("t1", ["A"]), topple("t2", ["A"]), topple("t3", ["B"])],
      SPECS
    );
    expect(r?.matches.map(m => m.cardId)).toEqual(["t1", "t2"]);
  });
  it("a concentration ask answers a SAVE roll only — a card with a speaker and no roll is not an answer; a pre-v1.5.0 Topple card with no dc is skipped", () => {
    expect(d.resolveDemand(bare("A", "con", "check"), [conc("c1", "A")], SPECS)).toBeNull();
    expect(
      d.resolveDemand(bare("A", null, null), [conc("c1", "A"), saves("s1", ["A"])], SPECS)
    ).toBeNull();
    expect(d.resolveDemand(bare("A"), [topple("t1", ["A"], 0)], SPECS)).toBeNull();
  });
  it("nothing without an actor", () => {
    expect(d.resolveDemand(bare(null), all, SPECS)).toBeNull();
  });
});

describe("pendingDemands — mid-answer, without a roll", () => {
  const cards = [
    saves("s1", ["A"]),
    conc("c1", "A"),
    saves("s2", ["A", "B"]),
    saves("s3", ["A"], ["con"], "done")
  ];
  it("lists every pending card naming the actor, oldest first, any ability", () => {
    expect(d.pendingDemands("A", cards, SPECS).map(m => `${m.flagKey}:${m.cardId}`)).toEqual([
      "saves:s1",
      "concentration:c1",
      "saves:s2"
    ]);
  });
  it("filters to one machine — the d20 folds ask about the save machine alone", () => {
    expect(d.pendingDemands("A", cards, SPECS, { flagKey: "saves" }).map(m => m.cardId)).toEqual([
      "s1",
      "s2"
    ]);
    expect(d.pendingDemands("B", cards, SPECS, { flagKey: "saves" }).map(m => m.cardId)).toEqual([
      "s2"
    ]);
    expect(d.pendingDemands("C", cards, SPECS)).toEqual([]);
  });
});

describe("the saves flag's constructors and reader", () => {
  it("a target entry is the array shape with a uuid FIELD, undone", () => {
    expect(d.saveTargetEntry("Actor.x", "Gren")).toEqual({
      uuid: "Actor.x",
      name: "Gren",
      done: false,
      outcome: null,
      total: null,
      rollMessageId: null
    });
  });
  it("the demand's field order and optional facets are the stamp's — nothing appears that was not given", () => {
    const base = {
      stat: { sourceUuid: "Actor.c" },
      abilities: ["dex"],
      dc: 15,
      damageOnSave: "half",
      hasDamage: true,
      effectNames: { fail: [], always: [] },
      activityUuid: "A.1",
      item: { name: "Fireball", img: null },
      targets: []
    };
    expect(Object.keys(d.saveDemandData(base))).toEqual([
      "status",
      "sourceUuid",
      "abilities",
      "dc",
      "damageOnSave",
      "hasDamage",
      "effectNames",
      "activityUuid",
      "templateType",
      "templated",
      "durationUnits",
      "item",
      "casterName",
      "targets"
    ]);
    const full = d.saveDemandData({
      ...base,
      demand: { spell: true, statuses: [] },
      effectsHandled: "emanation",
      pinnedTargets: true,
      awaitingTemplate: true,
      scaling: 2,
      window: 30,
      deadline: 99,
      casterName: "Edda"
    });
    expect(Object.keys(full)).toEqual([
      "status",
      "sourceUuid",
      "abilities",
      "dc",
      "damageOnSave",
      "hasDamage",
      "effectNames",
      "demand",
      "effectsHandled",
      "pinnedTargets",
      "activityUuid",
      "templateType",
      "templated",
      "awaitingTemplate",
      "durationUnits",
      "item",
      "casterName",
      "scaling",
      "window",
      "deadline",
      "targets"
    ]);
    expect(full.pinnedTargets).toBe(true);
    expect(d.saveDemandData({ ...base, window: 30 })).not.toHaveProperty("deadline"); // a waiting demand: its window, no clock
    expect(d.saveDemandData({ ...base, status: "done" }).status).toBe("done");
  });
  it("verdictsOn reads the answered targets only, in their own shape", () => {
    const flag = {
      targets: [
        { uuid: "A", name: "a", done: true, outcome: "failed", total: 9 },
        { uuid: "B", name: "b", done: false }
      ]
    };
    expect(d.verdictsOn(flag)).toEqual([{ uuid: "A", name: "a", outcome: "failed", total: 9 }]);
    expect(d.verdictsOn(null)).toEqual([]);
  });
});
