import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { installFoundryStub } from "./foundry-stub.js";

installFoundryStub();

/** @type {typeof import("../scripts/events.js")} */
let events;
beforeAll(async () => {
  events = await import("../scripts/events.js");
});

/** Collect what the publisher fires, so a test can assert the two names and the one payload. */
function watchHooks() {
  const seen = [];
  const previous = globalThis.Hooks.callAll;
  globalThis.Hooks.callAll = (name, data) => {
    seen.push({ name, data });
  };
  return {
    seen,
    restore: () => {
      globalThis.Hooks.callAll = previous;
    }
  };
}

const actor = {
  documentName: "Actor",
  uuid: "Actor.rogue",
  name: "BF Test Rogue",
  items: new Map()
};
const item = { uuid: "Actor.rogue.Item.sneak", name: "Sneak Attack" };
const message = { id: "msgDamage" };
const attackMessage = { id: "msgAttack" };

describe("publishMoment — the contract", () => {
  it("is version 2: the vocabulary and the kinds come from the registry, two hook shapes", () => {
    expect(events.MOMENT_CONTRACT.version).toBe(2);
    expect([...events.MOMENT_CONTRACT.events]).toEqual([
      "maneuver",
      "sneak",
      "fold",
      "rider",
      "hold-answered",
      "mastery",
      "shield",
      "spend",
      "damage",
      "effect",
      "save",
      "break",
      "use",
      "cast",
      "volley",
      "choice",
      "metamagic"
    ]);
    expect(events.MOMENT_CONTRACT.kinds).toContain("hitManeuver");
    expect(events.MOMENT_CONTRACT.kinds).toContain("receipt");
    expect([...events.MOMENT_CONTRACT.hooks]).toEqual(["battleflow.moment", "battleflow.<event>"]);
    expect(Object.isFrozen(events.MOMENT_CONTRACT)).toBe(true);
  });

  it("fires battleflow.moment and then battleflow.<event>, with ONE payload", () => {
    const w = watchHooks();
    try {
      const payload = events.publishMoment("sneak", {
        actor,
        item,
        message,
        attackMessage,
        targets: [{ uuid: "Actor.goblin", name: "Goblin", hit: true }],
        details: { formula: "6d6", picks: ["trip"] }
      });
      expect(w.seen.map(s => s.name)).toEqual(["battleflow.moment", "battleflow.sneak"]);
      expect(w.seen[0].data).toBe(payload);
      expect(w.seen[1].data).toBe(payload);
    } finally {
      w.restore();
    }
  });

  it("carries uuids and ids, never documents — and the payload is frozen and serialisable", () => {
    const w = watchHooks();
    try {
      const payload = events.publishMoment("sneak", {
        actor,
        item,
        message,
        attackMessage,
        targets: [{ uuid: "Actor.goblin", name: "Goblin", hit: true }],
        details: { formula: "6d6", picks: ["trip"] },
        kind: "sneakDamage",
        marker: "message"
      });
      expect(payload.event).toBe("sneak");
      expect(payload.module).toBe("fvtt-mod-battleflow");
      expect(payload.version).toBe(2);
      expect(payload.kind).toBe("sneakDamage");
      expect(payload.marker).toBe("message");
      expect(payload.momentId).toBe("msgDamage|sneakDamage|message");
      expect(payload.actorUuid).toBe("Actor.rogue");
      expect(payload.actorName).toBe("BF Test Rogue");
      expect(payload.itemUuid).toBe("Actor.rogue.Item.sneak");
      expect(payload.itemName).toBe("Sneak Attack");
      expect(payload.ability).toBe("Sneak Attack"); // defaults to the item's name
      expect(payload.messageId).toBe("msgDamage");
      expect(payload.attackId).toBe("msgAttack");
      expect(payload.targets).toEqual([
        { actorUuid: "Actor.goblin", tokenUuid: null, name: "Goblin", hit: true }
      ]);
      expect(payload.spend).toBe(null);
      expect(payload.details).toEqual({ formula: "6d6", picks: ["trip"] });
      expect(typeof payload.at).toBe("number");
      expect(Object.isFrozen(payload)).toBe(true);
      expect(Object.isFrozen(payload.targets)).toBe(true);
      expect(Object.isFrozen(payload.targets[0])).toBe(true);
      expect(JSON.parse(JSON.stringify(payload))).toEqual({
        ...payload,
        targets: [...payload.targets]
      });
      // the stub has no canvas and no fromUuidSync: the token slots answer null rather than throwing
      expect(payload.tokenUuid).toBe(null);
    } finally {
      w.restore();
    }
  });

  it("accepts uuid strings where it accepts documents; with no kind the momentId is null", () => {
    const w = watchHooks();
    try {
      const payload = events.publishMoment("maneuver", {
        actor: "Actor.fighter",
        item: "Actor.fighter.Item.trip",
        ability: "Trip Attack",
        message: "m1",
        attackMessage: "m0",
        targets: ["Actor.goblin"]
      });
      expect(payload.actorUuid).toBe("Actor.fighter");
      expect(payload.actorName).toBe(null);
      expect(payload.itemUuid).toBe("Actor.fighter.Item.trip");
      expect(payload.ability).toBe("Trip Attack");
      expect(payload.messageId).toBe("m1");
      expect(payload.attackId).toBe("m0");
      expect(payload.kind).toBe(null);
      expect(payload.momentId).toBe(null);
      expect(payload.targets[0]).toEqual({
        actorUuid: "Actor.goblin",
        tokenUuid: null,
        name: null
      });
      expect("hit" in payload.targets[0]).toBe(false); // no verdict, no field
    } finally {
      w.restore();
    }
  });

  it("copies a spend row in the uniform shape, and takes the first of an array", () => {
    const w = watchHooks();
    try {
      const spend = {
        pool: "Combat Superiority",
        spent: 1,
        left: 3,
        max: 4,
        ability: "Trip Attack",
        actorUuid: "Actor.fighter",
        at: 1
      };
      const one = events.publishMoment("maneuver", { actor: "Actor.fighter", spend });
      expect(one.spend).toEqual({
        pool: "Combat Superiority",
        spent: 1,
        left: 3,
        max: 4,
        ability: "Trip Attack"
      });
      expect(Object.isFrozen(one.spend)).toBe(true);
      const many = events.publishMoment("rider", {
        actor: "Actor.ranger",
        spend: [{ pool: "Dread Ambusher", spent: 1, left: 2, max: 3 }]
      });
      expect(many.spend).toEqual({
        pool: "Dread Ambusher",
        spent: 1,
        left: 2,
        max: 3,
        ability: null
      });
    } finally {
      w.restore();
    }
  });
});

describe("publishMoment — failing silently, elegantly", () => {
  it("refuses a word outside the vocabulary: warns, fires nothing, returns null", () => {
    const w = watchHooks();
    const warned = [];
    const previous = console.warn;
    console.warn = (...args) => warned.push(args.join(" "));
    try {
      expect(events.publishMoment("smite", { actor })).toBe(null);
      expect(w.seen).toEqual([]);
      expect(warned.some(m => /not in the moment vocabulary/.test(m))).toBe(true);
    } finally {
      w.restore();
      console.warn = previous;
    }
  });

  it("a subscriber that throws does not reach the publisher: warned, and the payload still returns", () => {
    const previous = globalThis.Hooks.callAll;
    const warned = [];
    const previousWarn = console.warn;
    console.warn = (...args) => warned.push(args.join(" "));
    globalThis.Hooks.callAll = () => {
      throw new Error("a bad listener");
    };
    try {
      const payload = events.publishMoment("sneak", { actor, item, message });
      expect(payload?.event).toBe("sneak");
      expect(warned.some(m => /a subscriber to "sneak" failed/.test(m))).toBe(true);
    } finally {
      globalThis.Hooks.callAll = previous;
      console.warn = previousWarn;
    }
  });

  it("with nobody listening it is a no-op: the platform's own Hooks.callAll with no listeners", () => {
    const payload = events.publishMoment("hold-answered", {
      actor,
      ability: "Shield",
      message: attackMessage,
      details: { answer: "cast" }
    });
    expect(payload.event).toBe("hold-answered");
    expect(payload.details).toEqual({ answer: "cast" });
  });

  it("publishes with no facts at all rather than throwing", () => {
    const payload = events.publishMoment("fold");
    expect(payload).toMatchObject({
      event: "fold",
      actorUuid: null,
      itemUuid: null,
      messageId: null,
      targets: [],
      spend: null,
      details: {}
    });
  });
});

/* ---------------------------------------------------------------------------------------------
 * THE GATE — observeMessage over fake messages: the latch, the publisher, the edge.
 * ------------------------------------------------------------------------------------------- */

/** A ChatMessage as the gate reads it: id, module flags, dnd5e flags, a speaker actor. */
function fakeMessage(id, flags, { dnd5e = {}, actorUuid = null, authorId = "gm" } = {}) {
  return {
    id,
    author: { id: authorId },
    flags: { "fvtt-mod-battleflow": flags },
    getFlag: (scope, key) => (scope === "dnd5e" ? dnd5e[key] : flags[key]) ?? null,
    getAssociatedActor: () => (actorUuid ? { uuid: actorUuid, name: null, items: [] } : null)
  };
}

describe("the gate — observeMessage", () => {
  beforeEach(() => {
    globalThis.game = { modules: { get: () => null }, user: { id: "gm" }, messages: new Map() };
  });

  it("publishes a record born resolved once, on the writer's client, with kind, marker and momentId", () => {
    const w = watchHooks();
    try {
      const msg = fakeMessage("d1", {
        hitManeuver: {
          sourceUuid: "Actor.f",
          itemUuid: "Actor.f.Item.t",
          feature: "Trip Attack",
          attackId: "a1",
          key: "trip-attack"
        }
      });
      const out = events.observeMessage(msg, "gm");
      expect(out.map(p => p.event)).toEqual(["maneuver"]);
      expect(out[0]).toMatchObject({
        kind: "hitManeuver",
        marker: "message",
        momentId: "d1|hitManeuver|message",
        actorUuid: "Actor.f",
        ability: "Trip Attack",
        attackId: "a1"
      });
      expect(w.seen.map(s => s.name)).toEqual(["battleflow.moment", "battleflow.maneuver"]);
      // the same message observed again (an update marking `done`) publishes nothing more
      expect(events.observeMessage(msg, "gm")).toEqual([]);
      expect(w.seen.length).toBe(2);
    } finally {
      w.restore();
    }
  });

  it("another client REMEMBERS a resolve it does not publish, so a later write cannot re-fire it there", () => {
    const w = watchHooks();
    try {
      const msg = fakeMessage(
        "d2",
        { sneakDamage: { sourceUuid: "Actor.r", attackId: "a2", dice: 7, formula: "7d6" } },
        { authorId: "player" }
      );
      expect(events.observeMessage(msg, "player")).toEqual([]); // this client is "gm", the writer was "player"
      expect(w.seen).toEqual([]);
      // the writer's client later writes `effectsDone`; here it is old news
      expect(events.observeMessage(msg, "gm")).toEqual([]);
      expect(w.seen).toEqual([]);
    } finally {
      w.restore();
    }
  });

  it("the ready sweep remembers without publishing", () => {
    const w = watchHooks();
    try {
      const msg = fakeMessage("d3", {
        clockRiders: {
          sourceUuid: "Actor.rg",
          attackId: "a3",
          riders: [{ key: "dread-ambusher", label: "Dreadful Strike", formula: "2d6" }]
        }
      });
      expect(events.observeMessage(msg, null, false)).toEqual([]);
      expect(w.seen).toEqual([]);
      expect(events.observeMessage(msg, "gm")).toEqual([]); // already history
    } finally {
      w.restore();
    }
  });

  it("a record that grows publishes each new marker once — the saves flag, target by target", () => {
    const w = watchHooks();
    try {
      const flags = {
        saves: {
          sourceUuid: "Actor.c",
          dc: 15,
          abilities: ["dex"],
          item: { name: "Fireball" },
          targets: [
            { uuid: "Actor.g1", name: "G1", done: false },
            { uuid: "Actor.g2", name: "G2", done: false }
          ]
        }
      };
      const msg = fakeMessage("s1", flags);
      expect(events.observeMessage(msg, "gm")).toEqual([]);
      flags.saves.targets[0] = {
        uuid: "Actor.g1",
        name: "G1",
        done: true,
        outcome: "saved",
        total: 17
      };
      let out = events.observeMessage(msg, "gm");
      expect(out.map(p => [p.event, p.marker, p.actorUuid])).toEqual([
        ["save", "Actor.g1", "Actor.g1"]
      ]);
      flags.saves.targets[1] = {
        uuid: "Actor.g2",
        name: "G2",
        done: true,
        outcome: "failed",
        total: 3
      };
      out = events.observeMessage(msg, "gm");
      expect(out.map(p => [p.event, p.marker])).toEqual([["save", "Actor.g2"]]);
      expect(events.observeMessage(msg, "gm")).toEqual([]);
      expect(w.seen.length).toBe(4);
    } finally {
      w.restore();
    }
  });

  it("a row's publisher wins over the writer — the hold's answer fires on the answering client, under both words for Parry", () => {
    const w = watchHooks();
    try {
      globalThis.game.user.id = "playerF";
      const msg = fakeMessage("h1", {
        hold: {
          sourceUuid: "Actor.g",
          status: "pending",
          targets: [
            {
              uuid: "Actor.f",
              name: "F",
              reaction: "Parry",
              kind: "damage",
              itemId: "p",
              answer: "cast",
              reduceBy: 6,
              reduce: { formula: "1d8 + 3" },
              poolSpend: { pool: "Combat Superiority", spent: 1, left: 2, max: 4 },
              answeredBy: "playerF"
            }
          ]
        }
      });
      // the ELECT wrote the fold (a relayed answer) — this client is the answerer
      const out = events.observeMessage(msg, "gm");
      expect(out.map(p => p.event)).toEqual(["hold-answered", "maneuver"]);
      expect(out[0]).toMatchObject({
        kind: "hold",
        marker: "Actor.f",
        actorUuid: "Actor.f",
        ability: "Parry",
        attackId: "h1",
        spend: { pool: "Combat Superiority", spent: 1, left: 2, max: 4 }
      });
      expect(out[0].details).toMatchObject({
        answer: "cast",
        reduceBy: 6,
        formula: "1d8 + 3",
        mode: "reduce"
      });
      expect(out[0].targets).toEqual([{ actorUuid: "Actor.g", tokenUuid: null, name: null }]);
      // and on the elect's own client the same fold publishes nothing
      globalThis.game.user.id = "gm";
      const msg2 = fakeMessage("h2", {
        hold: {
          sourceUuid: "Actor.g",
          status: "pending",
          targets: [
            {
              uuid: "Actor.w",
              reaction: "Shield",
              kind: "ac",
              itemId: "s",
              answer: "cast",
              answeredBy: "playerW"
            }
          ]
        }
      });
      expect(events.observeMessage(msg2, "gm")).toEqual([]);
    } finally {
      w.restore();
    }
  });

  it("a usage card's item and activity default in; the attack's hit targets are read when a row asks", () => {
    const w = watchHooks();
    try {
      const attack = {
        id: "a9",
        getFlag: (scope, key) =>
          scope === "dnd5e" && key === "targets"
            ? [{ uuid: "Actor.g", name: "Goblin", ac: 12 }]
            : null,
        rolls: [{ total: 20, isCritical: false, isFumble: false }],
        flags: {}
      };
      globalThis.game.messages = new Map([["a9", attack]]);
      const use = fakeMessage(
        "u1",
        {
          useChip: { sourceUuid: "Actor.r", effectId: "e", name: "Steady Aim", bend: "advantage" }
        },
        {
          dnd5e: {
            item: { uuid: "Actor.r.Item.sa" },
            activity: { uuid: "Actor.r.Item.sa.Activity.x" }
          },
          actorUuid: "Actor.r"
        }
      );
      const [spend] = events.observeMessage(use, "gm");
      expect(spend).toMatchObject({
        event: "spend",
        kind: "useChip",
        itemUuid: "Actor.r.Item.sa",
        activityUuid: "Actor.r.Item.sa.Activity.x",
        ability: "Steady Aim",
        actorUuid: "Actor.r"
      });
      const dmg = fakeMessage("d9", {
        clockRiders: {
          sourceUuid: "Actor.rg",
          attackId: "a9",
          riders: [
            { key: "dread-ambusher", label: "Dreadful Strike", formula: "2d6", type: "psychic" }
          ]
        }
      });
      const [rider] = events.observeMessage(dmg, "gm");
      expect(rider).toMatchObject({
        event: "rider",
        kind: "clockRiders",
        marker: "dread-ambusher",
        attackId: "a9",
        ability: "Dreadful Strike"
      });
      // hitTargets reads the attack's snapshot and verdicts; with a bare snapshot and no folds the hit rows come back plain
      expect(Array.isArray(rider.targets)).toBe(true);
    } finally {
      w.restore();
    }
  });

  it("a message with no module flags, or with only state keys, publishes nothing", () => {
    const w = watchHooks();
    try {
      expect(events.observeMessage({ id: "n1", flags: {} }, "gm")).toEqual([]);
      expect(
        events.observeMessage(
          fakeMessage("n2", { respondsTo: "x", hitPick: { key: "trip" } }),
          "gm"
        )
      ).toEqual([]);
      expect(w.seen).toEqual([]);
    } finally {
      w.restore();
    }
  });
});
