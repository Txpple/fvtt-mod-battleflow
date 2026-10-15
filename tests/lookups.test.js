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

/* THE TOKEN (geometry.js, ARCHITECTURE §7 *The shared readers*): which token a subject stands as, by one rule. */

const { tokenDocOf, tokenOf, tokenOnScene, tokensOf } = await import("../scripts/geometry.js");

/** A token document on a scene, and the token drawn for it unless `drawn` is false. */
function token(id, actor, scene, { drawn = true } = {}) {
  const doc = {
    documentName: "Token",
    id,
    uuid: `Scene.${scene.id}.Token.${id}`,
    actor,
    parent: scene,
    object: null
  };
  if (drawn) doc.object = { document: doc, actor, id };
  return doc;
}

const viewed = { id: "viewed", tokens: [] };
const other = { id: "other", tokens: [] };
const goblin = {
  documentName: "Actor",
  uuid: "Scene.viewed.Token.g1.Actor.goblin",
  getActiveTokens: () => []
};
const gob = token("g1", goblin, viewed);
goblin.token = gob;
const pc = { documentName: "Actor", uuid: "Actor.pc", token: null };
const pcFirst = token("p1", pc, viewed);
const pcSecond = token("p2", pc, viewed);
const pcElsewhere = token("p3", pc, other);
viewed.tokens = [gob, pcFirst, pcSecond];
other.tokens = [pcElsewhere];
// An unlinked token of the world actor is another creature: the platform lists it ahead when linked is false.
const pcUnlinked = token(
  "pu",
  { documentName: "Actor", uuid: "Scene.viewed.Token.pu.Actor.pc" },
  viewed
);
pc.getActiveTokens = (linked = false, document = false) => {
  const on = linked ? [pcFirst, pcSecond] : [pcUnlinked, pcFirst, pcSecond];
  return document ? on : on.filter(d => d.object).map(d => d.object);
};

function installCanvas({ controlled = [] } = {}) {
  const drawn = new Map(viewed.tokens.filter(d => d.object).map(d => [d.id, d.object]));
  globalThis.canvas = { scene: viewed, tokens: { controlled, get: id => drawn.get(id) } };
  globalThis.fromUuidSync = uuid =>
    ({ "Actor.pc": pc, [goblin.uuid]: goblin, [pcSecond.uuid]: pcSecond })[uuid] ?? null;
}

afterEach(() => {
  delete globalThis.canvas;
});

describe("tokenDocOf — the token document a subject stands as", () => {
  it("a token's synthetic actor: its own token", () => {
    installCanvas({ controlled: [pcSecond.object] });
    expect(tokenDocOf(goblin)).toBe(gob);
  });

  it("an actor of the world: the token this client controls, else its first linked token drawn, else the first linked", () => {
    installCanvas({ controlled: [pcSecond.object] });
    expect(tokenDocOf(pc)).toBe(pcSecond);
    installCanvas();
    expect(tokenDocOf(pc)).toBe(pcFirst);
    expect(tokenOf(pc)).toBe(pcFirst.object);
    const undrawn = { documentName: "Actor", uuid: "Actor.undrawn", token: null };
    const linked = token("u1", undrawn, viewed, { drawn: false });
    undrawn.getActiveTokens = (_linked, document) => (document ? [linked] : []);
    expect(tokenDocOf(undrawn)).toBe(linked);
  });

  it("a use: dnd5e's own usage token leads, after a synthetic actor's own", () => {
    installCanvas({ controlled: [pcSecond.object] });
    const activity = { getUsageToken: () => pcUnlinked };
    expect(tokenDocOf(pc, { activity })).toBe(pcUnlinked);
    expect(tokenDocOf(goblin, { activity })).toBe(gob);
    expect(tokenDocOf(pc, { activity: { getUsageToken: () => undefined } })).toBe(pcSecond);
  });

  it("a uuid, a token's id, a token on the canvas, a token document; anything else is null", () => {
    installCanvas();
    expect(tokenDocOf("Actor.pc")).toBe(pcFirst);
    expect(tokenDocOf(pcSecond.uuid)).toBe(pcSecond);
    expect(tokenDocOf("p2")).toBe(pcSecond);
    expect(tokenDocOf(pcSecond.object)).toBe(pcSecond);
    expect(tokenDocOf(pcFirst)).toBe(pcFirst);
    expect(tokenDocOf("Actor.gone")).toBe(null);
    expect(tokenDocOf({ documentName: "Item" })).toBe(null);
    expect(tokenDocOf(null)).toBe(null);
  });
});

describe("tokenOf — the token on the canvas", () => {
  it("the one rule's token, drawn; a token's id and a token on the canvas as themselves", () => {
    installCanvas();
    expect(tokenOf(goblin)).toBe(gob.object);
    expect(tokenOf("Actor.pc")).toBe(pcFirst.object);
    expect(tokenOf("p2")).toBe(pcSecond.object);
    expect(tokenOf(pcSecond.object)).toBe(pcSecond.object);
    expect(tokenOf(pcElsewhere)).toBe(pcElsewhere.object);
    expect(tokenOf("nope")).toBe(null);
  });
});

describe("tokenOnScene — the subject's token on a named scene, the same on every client", () => {
  it("finds the scene's token by the actor's uuid, never the controlled one", () => {
    installCanvas({ controlled: [pcSecond.object] });
    expect(tokenOnScene(pc, viewed)).toBe(pcFirst);
    expect(tokenOnScene("Actor.pc", other)).toBe(pcElsewhere);
    expect(tokenOnScene(goblin, other)).toBe(null);
    expect(tokenOnScene(pc, null)).toBe(null);
  });
});

describe("tokensOf — every token the actor stands as on the viewed scene", () => {
  it("asks the platform for its linked tokens drawn, or every one, or their documents; [] when it cannot", () => {
    const calls = [];
    const actor = {
      getActiveTokens: (...args) => {
        calls.push(args);
        return ["t"];
      }
    };
    expect(tokensOf(actor)).toEqual(["t"]);
    tokensOf(actor, { all: true, documents: true });
    expect(calls).toEqual([
      [true, false],
      [false, true]
    ]);
    expect(
      tokensOf({
        getActiveTokens: () => {
          throw new Error("no canvas");
        }
      })
    ).toEqual([]);
    expect(tokensOf(null)).toEqual([]);
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

  it("resolves a card's target row, whose `actor` is the actor's uuid as a string (decide/card.js targetsOf)", () => {
    installLookups();
    const row = { uuid: "Actor.mine", actor: "Actor.mine", name: "Mine" };
    const other = { uuid: "Actor.theirs", actor: "Actor.theirs", name: "Theirs" };
    expect(writableTargets([row, other])).toEqual([row]);
  });
});
