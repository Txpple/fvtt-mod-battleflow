import { afterEach, describe, expect, it } from "vitest";

const { resolveUuid, resolveUuidAsync, writableTargets } = await import("../scripts/core.js");

const docs = new Map([
  ["Actor.mine", { uuid: "Actor.mine", isOwner: true }],
  ["Actor.theirs", { uuid: "Actor.theirs", isOwner: false }]
]);

/** The platform's two lookups as the tests need them: a document, null when gone, a throw on a bad uuid. */
function installLookups() {
  globalThis.fromUuidSync = uuid => {
    if (uuid === "Compendium.pack.Actor.x.Item.y")
      throw new Error("cannot be retrieved synchronously");
    return docs.get(uuid) ?? null;
  };
  globalThis.fromUuid = async uuid => {
    if (uuid === "bad") throw new Error("malformed");
    return docs.get(uuid) ?? null;
  };
}

afterEach(() => {
  delete globalThis.fromUuidSync;
  delete globalThis.fromUuid;
});

/** THE UUID (core.js, ARCHITECTURE §7 *The shared readers*): the document behind a uuid, never a throw. */
describe("resolveUuid — the document behind a uuid, or null", () => {
  it("answers the document, and null for a uuid that is gone or empty", () => {
    installLookups();
    expect(resolveUuid("Actor.mine")).toBe(docs.get("Actor.mine"));
    expect(resolveUuid("Actor.gone")).toBe(null);
    expect(resolveUuid("")).toBe(null);
    expect(resolveUuid(null)).toBe(null);
  });

  it("answers null where the platform throws (an embedded pack document), and with no platform at all", () => {
    installLookups();
    expect(resolveUuid("Compendium.pack.Actor.x.Item.y")).toBe(null);
    delete globalThis.fromUuidSync;
    expect(resolveUuid("Actor.mine")).toBe(null);
  });
});

describe("resolveUuidAsync — the same reader, loaded", () => {
  it("resolves the document, and null for a uuid that is gone, empty or throws", async () => {
    installLookups();
    await expect(resolveUuidAsync("Actor.theirs")).resolves.toBe(docs.get("Actor.theirs"));
    await expect(resolveUuidAsync("Actor.gone")).resolves.toBe(null);
    await expect(resolveUuidAsync(undefined)).resolves.toBe(null);
    await expect(resolveUuidAsync("bad")).resolves.toBe(null);
  });
});

describe("writableTargets — the rows this client may write", () => {
  it("keeps a row whose actor is owned here, by its own actor or its uuid", () => {
    installLookups();
    const mine = { uuid: "Actor.mine" };
    const theirs = { uuid: "Actor.theirs" };
    const gone = { uuid: "Actor.gone" };
    const carried = { uuid: "Actor.theirs", actor: { isOwner: true } };
    expect(writableTargets([mine, theirs, gone, carried])).toEqual([mine, carried]);
    expect(writableTargets(null)).toEqual([]);
  });
});
