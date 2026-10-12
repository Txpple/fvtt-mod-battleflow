import { describe, expect, it } from "vitest";
import {
  behaviorMove,
  behaviorType,
  clientCopies,
  MIGRATED_FROM,
  parseStored,
  scopeMove,
  scopeMoves,
  settingMoves,
  summaryLine
} from "../scripts/decide/migrate.js";

/**
 * THE RENAME'S MIGRATION (3.0.0, issue #6): Battle Flow became By the Books. Foundry cannot rename a
 * package, so the new one moves the old one's state: the legacy flag scope on standing documents, the
 * emanation behaviours' subtype, the world and client settings. Pure: plain data in, payloads out.
 */
const IDS = { from: "fvtt-mod-battleflow", to: "fvtt-mod-bythebooks" };

describe("scopeMove — one document's legacy flag scope", () => {
  it("says nothing for a document with no legacy scope", () => {
    expect(scopeMove(undefined, IDS)).toBeNull();
    expect(scopeMove({}, IDS)).toBeNull();
    expect(scopeMove({ dnd5e: { a: 1 }, "fvtt-mod-bythebooks": { b: 2 } }, IDS)).toBeNull();
  });

  it("sets the new scope from the old and removes the old in the same write", () => {
    const flags = { dnd5e: { x: 1 }, "fvtt-mod-battleflow": { mastery: "vex", chip: { n: 1 } } };
    expect(scopeMove(flags, IDS)).toEqual({
      update: {
        "flags.fvtt-mod-bythebooks": { mastery: "vex", chip: { n: 1 } },
        "flags.-=fvtt-mod-battleflow": null
      },
      carried: true,
      filled: []
    });
  });

  it("treats an empty new scope as absent", () => {
    const flags = { "fvtt-mod-battleflow": { a: 1 }, "fvtt-mod-bythebooks": {} };
    expect(scopeMove(flags, IDS)?.update).toEqual({
      "flags.fvtt-mod-bythebooks": { a: 1 },
      "flags.-=fvtt-mod-battleflow": null
    });
  });

  it("removes an empty or non-object legacy scope, and does not count it (the 2.x noCover clears)", () => {
    for (const old of [{}, null, 3]) {
      expect(scopeMove({ "fvtt-mod-battleflow": old }, IDS)).toEqual({
        update: { "flags.-=fvtt-mod-battleflow": null },
        carried: false,
        filled: []
      });
    }
  });

  it("keeps a new scope that already holds every key, and removes the old one", () => {
    const flags = { "fvtt-mod-battleflow": { a: 1 }, "fvtt-mod-bythebooks": { a: 9, b: 2 } };
    expect(scopeMove(flags, IDS)).toEqual({
      update: { "flags.-=fvtt-mod-battleflow": null },
      carried: true,
      filled: []
    });
  });

  it("on a conflict copies only the keys the new scope lacks, the new one winning, and removes the old", () => {
    const flags = { "fvtt-mod-battleflow": { a: 1, c: 3 }, "fvtt-mod-bythebooks": { a: 9 } };
    expect(scopeMove(flags, IDS)).toEqual({
      update: { "flags.fvtt-mod-bythebooks.c": 3, "flags.-=fvtt-mod-battleflow": null },
      carried: true,
      filled: ["c"]
    });
  });

  it("never leaves both scopes standing: an unset on the new scope cannot resurrect the old value", () => {
    // Apply the write as Foundry would, then unset the new key the way the machines do.
    const flags = {
      "fvtt-mod-battleflow": { cleaveArm: "old", fed: 1 },
      "fvtt-mod-bythebooks": { cleaveArm: "new" }
    };
    const { update } = scopeMove(flags, IDS) ?? { update: {} };
    const after = { "fvtt-mod-bythebooks": { ...flags["fvtt-mod-bythebooks"] } };
    for (const [path, value] of Object.entries(update)) {
      if (path === "flags.-=fvtt-mod-battleflow") continue;
      after["fvtt-mod-bythebooks"][path.split(".").at(-1)] = value;
    }
    expect(after).toEqual({ "fvtt-mod-bythebooks": { cleaveArm: "new", fed: 1 } });
    expect("fvtt-mod-battleflow" in after).toBe(false);
    delete after["fvtt-mod-bythebooks"].cleaveArm;
    const readFlag = key =>
      after["fvtt-mod-bythebooks"]?.[key] ?? after["fvtt-mod-battleflow"]?.[key];
    expect(readFlag("cleaveArm")).toBeUndefined();
  });
});

describe("scopeMoves — a collection, one batch", () => {
  it("carries each update's _id, counts only the documents that carried a key, names the filled keys", () => {
    const out = scopeMoves(
      [
        { _id: "a", flags: { "fvtt-mod-battleflow": { k: 1 } } },
        { _id: "b", flags: {} },
        { _id: "c", flags: { "fvtt-mod-battleflow": { k: 1 }, "fvtt-mod-bythebooks": { j: 2 } } },
        { _id: "d", flags: { "fvtt-mod-battleflow": {} } }
      ],
      IDS
    );
    expect(out.updates).toEqual([
      { _id: "a", "flags.fvtt-mod-bythebooks": { k: 1 }, "flags.-=fvtt-mod-battleflow": null },
      { _id: "c", "flags.fvtt-mod-bythebooks.k": 1, "flags.-=fvtt-mod-battleflow": null },
      { _id: "d", "flags.-=fvtt-mod-battleflow": null }
    ]);
    expect(out.carried).toBe(2);
    expect(out.filled).toEqual([{ id: "c", keys: ["k"] }]);
  });

  it("is idempotent: the moved documents find nothing the second time", () => {
    const moved = [{ _id: "a", flags: { "fvtt-mod-bythebooks": { k: 1 } } }];
    expect(scopeMoves(moved, IDS)).toEqual({ updates: [], carried: 0, filled: [] });
  });
});

describe("behaviorMove — the emanation behaviour's subtype", () => {
  const source = {
    _id: "beh1",
    type: "fvtt-mod-battleflow.emanation",
    name: "Aura of Protection",
    disabled: false,
    system: {
      key: "Aura of Protection",
      source: "Scene.s.Token.t",
      item: "Actor.a.Item.i",
      reach: "helpful",
      scaling: 0,
      effect: null
    },
    flags: { "fvtt-mod-battleflow": { note: 1 } }
  };

  it("names the subtype under a package id", () => {
    expect(behaviorType("fvtt-mod-bythebooks")).toBe("fvtt-mod-bythebooks.emanation");
  });

  it("leaves any other behaviour alone", () => {
    expect(behaviorMove({ ...source, type: "fvtt-mod-bythebooks.emanation" }, IDS)).toBeNull();
    expect(behaviorMove({ ...source, type: "dnd5e.rotateArea" }, IDS)).toBeNull();
  });

  it("retypes in place with the same system data, the flag moved too", () => {
    const move = behaviorMove(source, IDS);
    expect(move?.id).toBe("beh1");
    expect(move?.update).toEqual({
      _id: "beh1",
      type: "fvtt-mod-bythebooks.emanation",
      system: source.system,
      "flags.fvtt-mod-bythebooks": { note: 1 },
      "flags.-=fvtt-mod-battleflow": null
    });
  });

  it("recreates, when the type will not update, as emanations.js adopts a region — stamped with the id it replaces", () => {
    const move = behaviorMove({ ...source, disabled: true }, IDS);
    expect(move?.create).toEqual({
      type: "fvtt-mod-bythebooks.emanation",
      name: "Aura of Protection",
      disabled: true,
      system: source.system,
      flags: { "fvtt-mod-bythebooks": { note: 1, [MIGRATED_FROM]: "beh1" } }
    });
    // a copy, never the source's own objects
    expect(move?.create.system).not.toBe(source.system);
  });

  it("stamps two same-key behaviours apart, so neither copy stands in for the other", () => {
    const a = behaviorMove({ ...source, _id: "behA" }, IDS);
    const b = behaviorMove({ ...source, _id: "behB" }, IDS);
    expect(a?.create.system.key).toBe(b?.create.system.key);
    expect(a?.create.flags["fvtt-mod-bythebooks"][MIGRATED_FROM]).toBe("behA");
    expect(b?.create.flags["fvtt-mod-bythebooks"][MIGRATED_FROM]).toBe("behB");
  });
});

describe("settingMoves — the world settings, every legacy Setting read", () => {
  const registered = key => ["decisionTimer", "saveRolls", "holdReveal"].includes(key);

  it("moves a registered key the legacy id holds and the new id does not, its JSON parsed", () => {
    const settings = [
      { key: "fvtt-mod-battleflow.decisionTimer", value: "30" },
      { key: "fvtt-mod-battleflow.saveRolls", value: JSON.stringify("auto") },
      { key: "dnd5e.rulesVersion", value: JSON.stringify("modern") }
    ];
    expect(settingMoves(settings, registered, IDS)).toEqual({
      moves: [
        { key: "decisionTimer", value: 30 },
        { key: "saveRolls", value: "auto" }
      ],
      unregistered: []
    });
  });

  it("never overwrites a setting the new id already holds", () => {
    const settings = [
      { key: "fvtt-mod-battleflow.decisionTimer", value: "30" },
      { key: "fvtt-mod-bythebooks.decisionTimer", value: "12" }
    ];
    expect(settingMoves(settings, registered, IDS).moves).toEqual([]);
  });

  it("leaves a legacy key the module does not register in place, and names it", () => {
    const settings = [{ key: "fvtt-mod-battleflow.retiredKey", value: "true" }];
    expect(settingMoves(settings, registered, IDS)).toEqual({
      moves: [],
      unregistered: ["retiredKey"]
    });
  });

  it("reads a stored value that is not JSON text as it is", () => {
    expect(parseStored("not json")).toBe("not json");
    expect(parseStored(false)).toBe(false);
    expect(parseStored("null")).toBeNull();
  });
});

describe("clientCopies — each client's own settings", () => {
  it("copies a key held under the legacy id and absent under the new one", () => {
    const store = {
      "fvtt-mod-battleflow.effectBar": "false",
      "fvtt-mod-battleflow.effectHover": "true",
      "fvtt-mod-bythebooks.effectHover": "false"
    };
    const read = key => store[key] ?? null;
    expect(clientCopies(["effectBar", "effectHover", "playerRollDamage"], read, IDS)).toEqual([
      ["fvtt-mod-battleflow.effectBar", "fvtt-mod-bythebooks.effectBar", "false"]
    ]);
  });
});

describe("summaryLine — one line when anything moved, silence when nothing did", () => {
  const names = { title: "By the Books", legacyTitle: "Battle Flow" };

  it("names only the non-zero parts, singular and plural", () => {
    expect(summaryLine({ settings: 3, effects: 1, actors: 0, behaviors: 2 }, names)).toBe(
      "By the Books: moved 3 settings, 1 effect, 2 region behaviours from Battle Flow."
    );
  });

  it("says nothing for a load that found nothing", () => {
    expect(summaryLine({}, names)).toBeNull();
    expect(summaryLine({ settings: 0, users: 0 }, names)).toBeNull();
  });
});
