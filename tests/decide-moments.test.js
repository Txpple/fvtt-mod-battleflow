import { describe, expect, it } from "vitest";
import {
  MOMENT_KINDS,
  MOMENT_RECORDS,
  MOMENT_WORDS,
  STATE_KEYS,
  isMomentWord,
  momentId,
  newMoments,
  resolvedMoments
} from "../scripts/decide/moments.js";

/** The ctx the spine reads off a message — a usage card here, so item defaults resolve. */
const ctx = {
  messageId: "msg1",
  itemUuid: "Actor.a.Item.card",
  activityUuid: "Actor.a.Item.card.Activity.act",
  actorUuid: "Actor.a"
};

/** Every row's resolves for a record, with the marker→events map a test can read at a glance. */
const resolves = (key, record) => resolvedMoments(key, record, ctx);
const markers = (key, record) => resolves(key, record).map(m => [m.marker, m.events]);

describe("the moment registry — shape", () => {
  it("every row publishes under words in the vocabulary, says what it means, and reads a record", () => {
    for (const [key, row] of Object.entries(MOMENT_RECORDS)) {
      expect(row.events.length, key).toBeGreaterThan(0);
      for (const w of row.events) expect(isMomentWord(w), `${key} → ${w}`).toBe(true);
      expect(row.means.length, key).toBeGreaterThan(20);
      expect(typeof row.resolved, key).toBe("function");
    }
    expect(MOMENT_KINDS).toEqual(Object.keys(MOMENT_RECORDS));
  });

  it("a key is a resolve or state, never both; every state reason is a sentence", () => {
    for (const key of Object.keys(STATE_KEYS)) {
      expect(MOMENT_RECORDS[key], `${key} is in both lists`).toBeUndefined();
      expect(STATE_KEYS[key].length, key).toBeGreaterThanOrEqual(20);
    }
  });

  it("an unregistered key, a null record and an empty record resolve nothing", () => {
    expect(resolves("nobody", { status: "done" })).toEqual([]);
    expect(resolves("hold", null)).toEqual([]);
    expect(resolves("hold", {})).toEqual([]);
    expect(resolves("saves", { targets: [] })).toEqual([]);
  });

  it("every resolve a row returns carries a string marker, a non-empty word list and plain facts", () => {
    // A generous record per row: the fields each reader looks at, all present.
    const fixtures = {
      hitManeuver: {
        sourceUuid: "Actor.f",
        itemUuid: "Actor.f.Item.t",
        feature: "Trip Attack",
        attackId: "atk",
        key: "trip-attack",
        poolSpend: { pool: "Combat Superiority", spent: 1, left: 3, max: 4 }
      },
      commandRide: {
        sourceUuid: "Actor.r",
        formula: "1d8",
        type: "slashing",
        directedBy: "Morgash",
        weapon: "Longsword",
        cardId: "c"
      },
      superiorityRide: {
        sourceUuid: "Actor.f",
        attackId: "atk",
        rode: [{ key: "lunging-attack", formula: "1d8", type: "slashing" }]
      },
      superiorityUse: {
        sourceUuid: "Actor.f",
        key: "evasive-footwork",
        die: "1d8",
        total: 5,
        line: "AC +5"
      },
      baitSwitch: {
        sourceUuid: "Actor.f",
        itemUuid: "Actor.f.Item.b",
        key: "bait-and-switch",
        total: 6,
        chosen: "Actor.r",
        options: [
          { uuid: "Actor.f", name: "F" },
          { uuid: "Actor.r", name: "R" }
        ]
      },
      sweepCard: {
        sourceUuid: "Actor.f",
        feature: "Sweeping Attack",
        attackId: "atk",
        chosen: "Actor.g2",
        resolved: { rolled: 4, verdict: "hit", name: "Goblin 2" }
      },
      precision: {
        status: "resolved",
        outcome: "used",
        attackerUuid: "Actor.f",
        itemId: "p",
        activityId: "a",
        itemName: "Precision Attack",
        die: 5,
        targets: [{ uuid: "Actor.g", name: "G", verdict: "hit" }]
      },
      riposte: {
        attackerUuid: "Actor.g",
        attackerName: "G",
        reactors: [
          {
            uuid: "Actor.f",
            name: "F",
            itemId: "r",
            activityId: "a",
            itemName: "Riposte",
            answer: "riposte",
            weaponName: "Longsword"
          }
        ]
      },
      sneakDamage: {
        sourceUuid: "Actor.rogue",
        attackId: "atk",
        dice: 7,
        formula: "7d6",
        cost: 1,
        dc: 15,
        cunning: [{ key: "trip" }]
      },
      d20fold: {
        actorUuid: "Actor.b",
        status: "resolved",
        outcome: "used",
        testKind: "attack",
        baseTotal: 12,
        foldedTotal: 17,
        spends: [{ kind: "bardic", name: "Bardic Inspiration", die: 5 }]
      },
      tacticalRefund: {
        status: "refunded",
        actorUuid: "Actor.f",
        name: "Tactical Mind",
        poolName: "Second Wind",
        poolUuid: "Actor.f.Item.sw"
      },
      clockRiders: {
        sourceUuid: "Actor.rg",
        attackId: "atk",
        riders: [
          {
            key: "dread-ambusher",
            label: "Dreadful Strike",
            formula: "2d6",
            type: "psychic",
            usesLeft: 2
          }
        ]
      },
      hold: {
        sourceUuid: "Actor.g",
        targets: [
          {
            uuid: "Actor.w",
            name: "W",
            reaction: "Shield",
            kind: "ac",
            itemId: "s",
            activityId: "c",
            answer: "cast",
            answeredBy: "userW"
          }
        ]
      },
      mastery: {
        status: "done",
        attackerUuid: "Actor.f",
        key: "topple",
        outcome: "used",
        answer: "use",
        weapon: { name: "Maul" },
        targets: [{ uuid: "Actor.g", name: "G" }]
      },
      damageShield: {
        sourceUuid: "Actor.c",
        key: "Fire Shield",
        attackId: "atk",
        damageId: "dmg",
        attackerUuid: "Actor.g",
        attackerName: "G",
        rolled: true,
        formula: "2d8",
        total: 9,
        type: "fire",
        why: "melee hit"
      },
      shieldMark: { sourceUuid: "Actor.c", key: "Fire Shield", effectId: "e", spellLevel: 4 },
      poolSpend: [
        {
          pool: "Sorcery Points",
          spent: 2,
          left: 3,
          max: 5,
          ability: "Quickened Spell",
          actorUuid: "Actor.s",
          at: 1
        }
      ],
      chipSpend: {
        sourceUuid: "Actor.f",
        spent: [
          {
            id: "e1",
            name: "Vexed",
            key: "vex",
            bearerUuid: "Actor.g",
            bearerName: "G",
            mode: "advantage"
          }
        ]
      },
      useChip: { sourceUuid: "Actor.rogue", effectId: "e", name: "Steady Aim", bend: "advantage" },
      spend: { sourceUuid: "Actor.f", rows: [{ name: "Second Wind", spent: 1 }] },
      receipt: {
        targets: [
          { uuid: "Actor.g", name: "G", taken: 9, sourceUuid: "Actor.f", parts: [], traits: [] }
        ]
      },
      effectReceipt: {
        targets: [
          {
            uuid: "Actor.g",
            name: "G",
            effects: [{ id: "e1", name: "Prone", sourceUuid: "Actor.f" }]
          }
        ]
      },
      saves: {
        sourceUuid: "Actor.c",
        dc: 15,
        abilities: ["dex"],
        item: { name: "Fireball" },
        activityUuid: "Actor.c.Item.fb.Activity.x",
        targets: [{ uuid: "Actor.g", name: "G", done: true, outcome: "failed", total: 9 }]
      },
      topple: {
        attackerUuid: "Actor.f",
        dc: 14,
        ability: "con",
        targets: [
          { uuid: "Actor.g", name: "G", done: true, outcome: "prone", total: 8, applied: true }
        ]
      },
      concentration: {
        status: "done",
        actorUuid: "Actor.c",
        dc: 10,
        names: ["Bless"],
        outcome: { success: false, total: 7 }
      },
      bashOffer: {
        status: "resolved",
        answer: "bash",
        attackerUuid: "Actor.f",
        itemId: "sm",
        activityId: "a",
        itemName: "Shield Master",
        targetUuid: "Actor.g",
        targets: [{ uuid: "Actor.g", name: "G" }]
      },
      damageCast: {
        sourceUuid: "Actor.c",
        key: "Heat Metal",
        activity: "Damage",
        scaling: 0,
        save: "Save"
      },
      volley: {
        status: "resolved",
        sourceUuid: "Actor.s",
        kind: "damage",
        n: 3,
        assignment: [{ uuid: "Actor.g", name: "G", count: 3 }]
      },
      emanationCard: {
        sourceUuid: "Actor.c",
        key: "Spirit Guardians",
        chosen: true,
        damageType: "radiant",
        damageWhy: "chosen"
      },
      castApply: {
        activityUuid: "Actor.c.Item.fs.Activity.x",
        targets: [{ uuid: "Actor.c", name: "C" }],
        choice: { options: ["Warm Shield", "Chill Shield"], chosen: "Warm Shield" }
      },
      metamagic: { key: "quickened", feature: "Quickened Spell", cost: 2, spent: true },
      empowered: { status: "used", picks: [0, 2], newTotal: 21, delta: 6 }
    };
    for (const key of Object.keys(MOMENT_RECORDS)) {
      expect(fixtures[key], `no fixture for ${key}`).toBeDefined();
      const out = resolves(key, fixtures[key]);
      expect(out.length, `${key} resolved nothing`).toBeGreaterThan(0);
      for (const m of out) {
        expect(typeof m.marker, key).toBe("string");
        expect(m.events.length, key).toBeGreaterThan(0);
        for (const w of m.events) expect(isMomentWord(w), `${key} → ${w}`).toBe(true);
        expect(typeof m.facts, key).toBe("object");
        // plain: no functions, no documents — it survives JSON
        expect(JSON.parse(JSON.stringify(m.facts))).toEqual(m.facts);
      }
    }
  });
});

describe("the moment registry — the edges", () => {
  it("a pending hold resolves nothing; each answered target is one resolve, Parry's die under two words, on the answerer's client", () => {
    const pending = {
      sourceUuid: "Actor.g",
      targets: [{ uuid: "Actor.w", reaction: "Shield", answer: null }]
    };
    expect(markers("hold", pending)).toEqual([]);
    const answered = {
      sourceUuid: "Actor.g",
      targets: [
        {
          uuid: "Actor.w",
          name: "W",
          reaction: "Shield",
          kind: "ac",
          itemId: "s",
          activityId: "c",
          answer: "cast",
          answeredBy: "userW"
        },
        {
          uuid: "Actor.f",
          name: "F",
          reaction: "Parry",
          kind: "damage",
          itemId: "p",
          answer: "cast",
          reduceBy: 7,
          reduce: { formula: "1d8 + 3" },
          poolSpend: { pool: "Combat Superiority", spent: 1, left: 2, max: 4 },
          answeredBy: "userF"
        },
        { uuid: "Actor.p", name: "P", reaction: "Shield", answer: "pass", timedOut: true }
      ]
    };
    const out = resolves("hold", answered);
    expect(out.map(m => [m.marker, m.events, m.publisher])).toEqual([
      ["Actor.w", ["hold-answered"], "userW"],
      ["Actor.f", ["hold-answered", "maneuver"], "userF"],
      ["Actor.p", ["hold-answered"], null]
    ]);
    expect(out[0].facts).toMatchObject({
      actor: "Actor.w",
      item: "Actor.w.Item.s",
      activity: "Actor.w.Item.s.Activity.c",
      ability: "Shield",
      attackId: "msg1",
      targets: [{ uuid: "Actor.g", name: null }]
    });
    expect(out[1].facts.details).toMatchObject({
      answer: "cast",
      reduceBy: 7,
      formula: "1d8 + 3",
      mode: "reduce"
    });
    expect(out[2].facts.details).toMatchObject({ answer: "pass", timedOut: true });
  });

  it("the saves flag resolves one save per target done — and the attacker's choice beside it", () => {
    const flag = {
      sourceUuid: "Actor.c",
      dc: 15,
      abilities: ["dex"],
      item: { name: "Fireball" },
      targets: [
        { uuid: "Actor.g1", name: "G1", done: true, outcome: "saved", total: 17 },
        { uuid: "Actor.g2", name: "G2", done: false },
        {
          uuid: "Actor.g3",
          name: "G3",
          done: true,
          outcome: "failed",
          total: null,
          autoFailed: true,
          autoFailedBy: "Paralyzed",
          choice: {
            kind: "bash",
            itemName: "Shield Master",
            subjectUuid: "Actor.f",
            answer: "push"
          }
        }
      ]
    };
    expect(markers("saves", flag)).toEqual([
      ["Actor.g1", ["save"]],
      ["Actor.g3", ["save"]],
      ["Actor.g3|choice", ["choice"]]
    ]);
    const [g1, g3, choice] = resolves("saves", flag);
    expect(g1.facts).toMatchObject({
      actor: "Actor.g1",
      ability: "Fireball",
      details: { outcome: "saved", total: 17, dc: 15, casterUuid: "Actor.c" }
    });
    expect(g3.facts.details).toMatchObject({
      outcome: "failed",
      autoFailed: true,
      autoFailedBy: "Paralyzed"
    });
    expect(choice.facts).toMatchObject({
      actor: "Actor.f",
      ability: "Shield Master",
      targets: [{ uuid: "Actor.g3", name: "G3" }],
      details: { answer: "push", kind: "bash" }
    });
  });

  it("a d20 fold publishes each settled spend once, never one still pending its verdict, and a human's pass", () => {
    const inFlight = {
      actorUuid: "Actor.b",
      status: "pending",
      testKind: "save",
      spends: [{ kind: "bardic", name: "Bardic Inspiration", die: 4, pendingVerdict: true }]
    };
    expect(markers("d20fold", inFlight)).toEqual([]);
    const settled = {
      ...inFlight,
      spends: [
        { kind: "bardic", name: "Bardic Inspiration", die: 4 },
        { kind: "heroic", name: "Heroic Inspiration", reroll: { total: 15 }, pendingVerdict: true }
      ]
    };
    expect(markers("d20fold", settled)).toEqual([["spend:0", ["fold"]]]);
    const passed = {
      actorUuid: "Actor.b",
      status: "resolved",
      outcome: "passed",
      testKind: "attack",
      spends: []
    };
    expect(markers("d20fold", passed)).toEqual([["passed", ["fold"]]]);
    const mooted = { ...passed, outcome: "no longer needed" };
    expect(markers("d20fold", mooted)).toEqual([]);
  });

  it("receipts resolve per target and again on a revert; effect receipts per effect", () => {
    const dmg = {
      targets: [
        { uuid: "Actor.g", name: "G", taken: 9 },
        { uuid: "Actor.h", name: "H", taken: 3, reverted: true }
      ]
    };
    expect(markers("receipt", dmg)).toEqual([
      ["Actor.g", ["damage"]],
      ["Actor.h", ["damage"]],
      ["Actor.h|reverted", ["damage"]]
    ]);
    expect(resolves("receipt", dmg)[2].facts.details).toMatchObject({ reverted: true, taken: 3 });
    const fx = {
      targets: [
        {
          uuid: "Actor.g",
          name: "G",
          effects: [
            { id: "e1", name: "Prone" },
            { id: "e2", name: "Vexed", reverted: true }
          ]
        }
      ]
    };
    expect(markers("effectReceipt", fx)).toEqual([
      ["Actor.g|e1", ["effect"]],
      ["Actor.g|e2", ["effect"]],
      ["Actor.g|e2|reverted", ["effect"]]
    ]);
  });

  it("concentration publishes save on a success, save and break on a failure, save alone when voided", () => {
    expect(
      markers("concentration", {
        status: "done",
        actorUuid: "Actor.c",
        outcome: { success: true, total: 14 }
      })
    ).toEqual([["verdict", ["save"]]]);
    expect(
      markers("concentration", {
        status: "done",
        actorUuid: "Actor.c",
        outcome: { success: false, total: 4 }
      })
    ).toEqual([["verdict", ["save", "break"]]]);
    expect(
      markers("concentration", { status: "done", actorUuid: "Actor.c", outcome: { voided: true } })
    ).toEqual([["verdict", ["save"]]]);
    expect(markers("concentration", { status: "pending", actorUuid: "Actor.c" })).toEqual([]);
  });

  it("riders and rides publish one resolve per die that rode; the hit menu one per record with the attack's targets deferred to the spine", () => {
    const riders = {
      sourceUuid: "Actor.rg",
      attackId: "atk",
      riders: [
        { key: "dread-ambusher", label: "Dreadful Strike", formula: "2d6", type: "psychic" },
        { key: "divine-fury", label: "Divine Fury", formula: "1d6 + 2" }
      ]
    };
    expect(markers("clockRiders", riders)).toEqual([
      ["dread-ambusher", ["rider"]],
      ["divine-fury", ["rider"]]
    ]);
    expect(resolves("clockRiders", riders)[0].facts).toMatchObject({
      actor: "Actor.rg",
      itemName: "Dreadful Strike",
      attackId: "atk",
      targetsFrom: "attack"
    });
    const hm = {
      sourceUuid: "Actor.f",
      itemUuid: "Actor.f.Item.t",
      feature: "Trip Attack",
      attackId: "atk",
      key: "trip-attack",
      mode: "ride",
      poolSpend: { pool: "Combat Superiority", spent: 1, left: 3, max: 4 }
    };
    expect(markers("hitManeuver", hm)).toEqual([["message", ["maneuver"]]]);
    expect(resolves("hitManeuver", hm)[0].facts).toMatchObject({
      actor: "Actor.f",
      item: "Actor.f.Item.t",
      ability: "Trip Attack",
      targetsFrom: "attack",
      spend: hm.poolSpend
    });
  });

  it("status-gated rows resolve only past their edge", () => {
    expect(markers("mastery", { status: "pending", key: "vex" })).toEqual([]);
    expect(
      markers("mastery", { status: "done", key: "vex", outcome: "passed", attackerUuid: "Actor.f" })
    ).toEqual([["message", ["mastery"]]]);
    expect(markers("precision", { status: "pending" })).toEqual([]);
    expect(
      markers("precision", { status: "resolved", outcome: "passed", attackerUuid: "Actor.f" })
    ).toEqual([["message", ["maneuver", "fold"]]]);
    expect(markers("bashOffer", { status: "pending" })).toEqual([]);
    expect(markers("volley", { status: "pending" })).toEqual([]);
    expect(markers("tacticalRefund", { status: "pending" })).toEqual([]);
    expect(
      markers("tacticalRefund", { status: "kept", actorUuid: "Actor.f", name: "Tactical Mind" })
    ).toEqual([["message", ["fold"]]]);
    expect(markers("baitSwitch", { chosen: null })).toEqual([]);
    expect(markers("sweepCard", { chosen: "Actor.g", resolved: null })).toEqual([]);
    expect(markers("emanationCard", { chosen: false })).toEqual([]);
    expect(markers("castApply", { choice: { options: ["a", "b"], chosen: null } })).toEqual([]);
    expect(markers("metamagic", { key: "quickened", spent: false })).toEqual([]);
    expect(markers("empowered", { status: "answering" })).toEqual([]);
    expect(markers("riposte", { reactors: [{ uuid: "Actor.f", answer: null }] })).toEqual([]);
    expect(markers("topple", { targets: [{ uuid: "Actor.g", done: false }] })).toEqual([]);
  });

  it("pool spends take one record or many, each its own resolve; chip spends one per chip", () => {
    const one = {
      pool: "Sorcery Points",
      spent: 1,
      left: 4,
      max: 5,
      ability: "Seeking Spell",
      at: 7
    };
    expect(markers("poolSpend", one)).toEqual([["Sorcery Points|7", ["spend"]]]);
    const many = [
      { pool: "Dreadful Strike", spent: 1, left: 1, max: 2, at: 1 },
      { pool: "Divine Fury", spent: 1, left: 0, max: 1, at: 2 }
    ];
    expect(markers("poolSpend", many)).toEqual([
      ["Dreadful Strike|1", ["spend"]],
      ["Divine Fury|2", ["spend"]]
    ]);
    const chips = {
      sourceUuid: "Actor.f",
      spent: [
        { id: "e1", name: "Vexed", key: "vex" },
        { id: "e2", name: "Sapped", key: "sap" }
      ]
    };
    expect(markers("chipSpend", chips)).toEqual([
      ["e1", ["spend"]],
      ["e2", ["spend"]]
    ]);
  });
});

describe("the latch arithmetic", () => {
  it("momentId is message|kind|marker and newMoments is the set difference in record order", () => {
    expect(momentId("m1", "hold", "Actor.w")).toBe("m1|hold|Actor.w");
    expect(momentId(null, "hold", "x")).toBe("?|hold|x");
    const moments = [
      { marker: "a", events: ["save"], facts: {} },
      { marker: "b", events: ["save"], facts: {} },
      { marker: "c", events: ["save"], facts: {} }
    ];
    const latch = new Set([momentId("m1", "saves", "b")]);
    expect(newMoments("m1", "saves", moments, latch).map(m => m.marker)).toEqual(["a", "c"]);
    expect(newMoments("m2", "saves", moments, latch).map(m => m.marker)).toEqual(["a", "b", "c"]);
  });

  it("the vocabulary is closed and frozen", () => {
    expect(Object.isFrozen(MOMENT_WORDS)).toBe(true);
    expect(isMomentWord("maneuver")).toBe(true);
    expect(isMomentWord("smite")).toBe(false);
  });
});
