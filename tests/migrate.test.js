import { beforeAll, describe, expect, it } from "vitest";
import { installFoundryStub } from "./foundry-stub.js";

installFoundryStub();

/**
 * The rename's machine (scripts/migrate.js) at the one seam a unit test can hold: every write it makes
 * through a token's synthetic actor carries the migration mark, so the hooks the delta write raises
 * (the synthetic `updateActor`, the token's `updateToken`) are dropped by the dispatcher on every client.
 * And core.js `clearFlag`: an old card's key is cleared under both scopes.
 */

/** @type {typeof import("../scripts/migrate.js")} */
let migrate;
/** @type {typeof import("../scripts/core.js")} */
let core;
beforeAll(async () => {
  migrate = await import("../scripts/migrate.js");
  core = await import("../scripts/core.js");
});

/** A synthetic actor recording every write and its options. */
function syntheticActor(items = {}) {
  const writes = [];
  const record =
    kind =>
    async (...args) => {
      writes.push({ kind, data: args[args.length - 2], options: args[args.length - 1] });
    };
  const itemDocs = new Map(
    Object.entries(items).map(([id]) => [
      id,
      {
        uuid: `Actor.x.Item.${id}`,
        updateEmbeddedDocuments: async (_name, data, options) =>
          writes.push({ kind: `item:${id}`, data, options })
      }
    ])
  );
  return {
    writes,
    actor: {
      update: record("actor"),
      updateEmbeddedDocuments: async (name, data, options) =>
        writes.push({ kind: name, data, options }),
      items: itemDocs
    }
  };
}

describe("moveDelta — an unlinked token's delta, written through the synthetic actor", () => {
  it("marks every write, one per collection, and counts what carried a key", async () => {
    const { writes, actor } = syntheticActor({ i1: true });
    const token = {
      uuid: "Scene.s.Token.t",
      actorLink: false,
      actor,
      _source: {
        delta: {
          flags: { "fvtt-mod-battleflow": { cleaveArm: { at: 1 } } },
          items: [
            {
              _id: "i1",
              flags: { "fvtt-mod-battleflow": { useKey: "x" } },
              effects: [{ _id: "e2", flags: { "fvtt-mod-battleflow": { mastery: "vex" } } }]
            }
          ],
          effects: [
            { _id: "e1", flags: { "fvtt-mod-battleflow": { emanation: { regionId: "r" } } } },
            { _id: "e3", flags: { "fvtt-mod-battleflow": {} } }
          ]
        }
      }
    };
    const counts = {};
    await migrate.moveDelta(token, counts, []);
    expect(writes.map(w => w.kind)).toEqual(["actor", "Item", "ActiveEffect", "item:i1"]);
    for (const w of writes) expect(w.options).toEqual({ bythebooksMigration: true });
    expect(counts).toEqual({ actors: 1, items: 1, effects: 2 }); // e3's empty scope removed, not counted
    expect(writes[2].data).toEqual([
      {
        _id: "e1",
        "flags.fvtt-mod-bythebooks": { emanation: { regionId: "r" } },
        "flags.-=fvtt-mod-battleflow": null
      },
      { _id: "e3", "flags.-=fvtt-mod-battleflow": null }
    ]);
  });

  it("leaves a linked token alone: its actor moved with the world actors", async () => {
    const { writes, actor } = syntheticActor();
    await migrate.moveDelta(
      {
        actorLink: true,
        actor,
        _source: { delta: { flags: { "fvtt-mod-battleflow": { a: 1 } } } }
      },
      {},
      []
    );
    expect(writes).toEqual([]);
  });
});

describe("clearFlag — an old card's key, cleared under both scopes", () => {
  const card = flags => {
    const doc = {
      flags,
      sent: null,
      update: async (data, options) => {
        doc.sent = { data, options };
      }
    };
    return doc;
  };

  it("clears the legacy scope's key too when the old scope holds it", async () => {
    const doc = card({ "fvtt-mod-battleflow": { savesDeferredRoll: true } });
    await core.clearFlag(doc, "savesDeferredRoll");
    expect(doc.sent.data).toEqual({
      "flags.fvtt-mod-bythebooks.-=savesDeferredRoll": null,
      "flags.fvtt-mod-battleflow.-=savesDeferredRoll": null
    });
  });

  it("touches only the new scope on a card posted under the new id", async () => {
    const doc = card({ "fvtt-mod-bythebooks": { savesDeferredRoll: true } });
    await core.clearFlag(doc, "savesDeferredRoll");
    expect(doc.sent.data).toEqual({ "flags.fvtt-mod-bythebooks.-=savesDeferredRoll": null });
  });
});
