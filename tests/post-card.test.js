import { beforeEach, describe, expect, it, vi } from "vitest";

globalThis.Hooks = { on: () => 1, once: () => 1, call: () => true, callAll: () => {} };
const users = [
  { id: "gm1", isGM: true },
  { id: "p1", isGM: false },
  { id: "p2", isGM: false }
];
Object.assign(globalThis, {
  game: {
    modules: { get: () => null },
    messages: { get: () => null, contents: [] },
    user: { id: "p1" },
    userId: "p1",
    users: Object.assign([...users], { activeGM: null })
  },
  ui: { notifications: { warn: vi.fn() } },
  ChatMessage: {
    create: vi.fn(async data => ({ data })),
    getSpeaker: vi.fn(({ actor, token } = {}) => ({
      alias: `spoke:${actor?.name ?? token?.name ?? "fallback"}`
    }))
  }
});

const { MODULE_ID, gmIds, selfIds, selfAndGmIds, ownersAndGmIds } = await import(
  "../scripts/core.js"
);
const { postCard, postAnswer } = await import("../scripts/ui.js");

beforeEach(() => {
  ChatMessage.create.mockClear();
  ChatMessage.getSpeaker.mockClear();
  ui.notifications.warn.mockClear();
  game.users.activeGM = null;
});

const posted = () => ChatMessage.create.mock.calls.at(-1)[0];

/** THE RECIPIENTS (core.js, ARCHITECTURE §5 *The card*): each set named once. */
describe("the recipient sets", () => {
  it("gmIds, selfIds, selfAndGmIds", () => {
    expect(gmIds()).toEqual(["gm1"]);
    expect(selfIds()).toEqual(["p1"]);
    expect(selfAndGmIds()).toEqual(["p1", "gm1"]);
  });
  it("ownersAndGmIds is the actor's owners and the GMs, each once; a null actor is the GMs", () => {
    const actor = { testUserPermission: u => u.id === "p2" || u.isGM };
    expect(ownersAndGmIds(actor)).toEqual(["gm1", "p2"]);
    expect(ownersAndGmIds(null)).toEqual(["gm1"]);
  });
});

/** THE CARD (ui.js `postCard`): the envelope built in one place. */
describe("postCard", () => {
  it("speaks for the actor through the platform, a null actor included", async () => {
    await postCard({ actor: { name: "Ari" }, card: "<p>hi</p>" });
    expect(posted()).toEqual({ content: "<p>hi</p>", speaker: { alias: "spoke:Ari" } });
    await postCard({ actor: null, card: "" });
    expect(ChatMessage.getSpeaker).toHaveBeenLastCalledWith({ actor: null, token: undefined });
    expect(posted().speaker).toEqual({ alias: "spoke:fallback" });
  });
  it("an alias, a stored speaker, or none", async () => {
    await postCard({ alias: "By the Books", card: "x" });
    expect(posted()).toEqual({ content: "x", speaker: { alias: "By the Books" } });
    await postCard({ speaker: { actor: "a1", alias: "Stored" }, card: "x" });
    expect(posted().speaker).toEqual({ actor: "a1", alias: "Stored" });
    await postCard({ card: "x" });
    expect(posted()).toEqual({ content: "x" });
    expect(ChatMessage.getSpeaker).not.toHaveBeenCalled();
  });
  it("an actor that is undefined falls back to the stored speaker", async () => {
    await postCard({ actor: undefined, speaker: { alias: "Card" }, card: "x" });
    expect(posted().speaker).toEqual({ alias: "Card" });
  });
  it("whispers only to a set it is handed; flags and rolls as written", async () => {
    const flags = { [MODULE_ID]: { k: 1 } };
    await postCard({ card: "x", flags, rolls: ["r"], to: gmIds() });
    expect(posted()).toEqual({ content: "x", flags, rolls: ["r"], whisper: ["gm1"] });
    await postCard({ card: "x", to: null });
    expect(posted()).not.toHaveProperty("whisper");
  });
});

/** THE RELAY'S SENDING SIDE (ui.js `postAnswer`). */
describe("postAnswer", () => {
  const flags = { [MODULE_ID]: { kitTendAnswer: { messageId: "m1", answer: "use" } } };
  it("toElect whispers the envelope to the GMs", async () => {
    game.users.activeGM = { id: "gm1" };
    await postAnswer("kitTendAnswer", { actor: { name: "Ari" }, card: "", toElect: true, flags });
    expect(posted()).toEqual({
      content: "",
      speaker: { alias: "spoke:Ari" },
      flags,
      whisper: ["gm1"]
    });
  });
  it("noGM: with no GM connected nothing is sent and the sentence is said", async () => {
    await expect(
      postAnswer("kitTendAnswer", { card: "", toElect: true, noGM: "Ask a GM.", flags })
    ).resolves.toBeNull();
    expect(ChatMessage.create).not.toHaveBeenCalled();
    expect(ui.notifications.warn).toHaveBeenCalledWith("Ask a GM.");
  });
  it("a public answer card is postCard's", async () => {
    await postAnswer("kitTendAnswer", { card: "<p>a</p>", flags });
    expect(posted()).toEqual({ content: "<p>a</p>", flags });
  });
});
