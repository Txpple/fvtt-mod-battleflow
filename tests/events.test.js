import { beforeAll, describe, expect, it } from "vitest";
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
  it("names five events and two hook shapes, version 1", () => {
    expect(events.MOMENT_CONTRACT.version).toBe(1);
    expect([...events.MOMENT_CONTRACT.events]).toEqual([
      "maneuver",
      "sneak",
      "fold",
      "rider",
      "hold-answered"
    ]);
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
        details: { formula: "6d6", picks: ["trip"] }
      });
      expect(payload.event).toBe("sneak");
      expect(payload.module).toBe("fvtt-mod-battleflow");
      expect(payload.version).toBe(1);
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

  it("accepts uuid strings where it accepts documents", () => {
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
    // The stub's callAll is a no-op, exactly like the platform's for a name nobody registered.
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
