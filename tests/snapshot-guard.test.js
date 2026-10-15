import { beforeEach, describe, expect, it, vi } from "vitest";

/** The platform's registry, as the dispatcher sees it: one listener per hook name. */
const platform = new Map();
globalThis.Hooks = {
  on: (hook, fn) => {
    platform.set(hook, fn);
    return 1;
  },
  once: () => 1,
  call: () => true,
  callAll: () => {}
};
/** The world's chat log as `game.messages` answers it. */
const log = new Map();
/** The world as the spine reads it; `ready` is what the guard asks. */
const world = {
  ready: false,
  modules: { get: () => null },
  messages: { get: id => log.get(id) ?? null, contents: [] },
  users: { activeGM: null }
};
Object.assign(globalThis, {
  game: world,
  window: { addEventListener: () => {} },
  document: { addEventListener: () => {} },
  HTMLElement: class {}
});

const { registerResumable } = await import("../scripts/ui.js");

/** A card carrying the probe's record; `record` is what the document holds now. */
function card(id, record) {
  const message = {
    id,
    record,
    getFlag: (_scope, key) => (key === "guardProbe" ? message.record : null)
  };
  log.set(id, message);
  return message;
}

const drive = vi.fn(async () => {});
const causes = [];
registerResumable("guardProbe", {
  pending: (flag, _message, cause) => {
    causes.push(cause);
    return flag.status === "placed" && !flag.applying;
  },
  drives: () => true,
  drive
});

/** Fire a hook as the platform would. */
const fire = (hook, ...args) => platform.get(hook)?.(...args);
/** Let the drive's microtask run. */
const settle = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  drive.mockClear();
  causes.length = 0;
  log.clear();
  world.ready = false;
});

/**
 * THE SNAPSHOT GUARD (ui.js `resume`, ARCHITECTURE §4 *The flow elect*): a client booting renders the chat log
 * from its world snapshot before Foundry applies the events it buffered; a render's resume before `ready` waits
 * for `ready` and then reads the document as it stands.
 */
describe("the snapshot guard — a render before ready resumes at ready", () => {
  it("does not judge or drive a render before ready", async () => {
    const message = card("m1", { status: "placed" });
    fire("dnd5e.renderChatMessage", message, null);
    await settle();
    expect(causes).toEqual([]);
    expect(drive).not.toHaveBeenCalled();
  });

  it("drives it at ready when the record still waits", async () => {
    const message = card("m2", { status: "placed" });
    fire("dnd5e.renderChatMessage", message, null);
    world.ready = true;
    fire("ready");
    await settle();
    expect(causes).toEqual(["render"]);
    expect(drive).toHaveBeenCalledTimes(1);
    expect(drive).toHaveBeenCalledWith(message);
  });

  it("reads the document at ready: a claim the snapshot missed stops the drive", async () => {
    const message = card("m3", { status: "placed" });
    fire("dnd5e.renderChatMessage", message, null);
    // the buffered update lands as Foundry applies it, just before `ready`
    message.record = { status: "placed", applying: { by: "w", window: "a", at: 1 } };
    world.ready = true;
    fire("ready");
    await settle();
    expect(causes).toEqual(["render"]);
    expect(drive).not.toHaveBeenCalled();
  });

  it("drives a card resumed once at ready however often it rendered before it", async () => {
    const message = card("m4", { status: "placed" });
    fire("dnd5e.renderChatMessage", message, null);
    fire("dnd5e.renderChatMessage", message, null);
    world.ready = true;
    fire("ready");
    await settle();
    expect(drive).toHaveBeenCalledTimes(1);
  });

  it("skips a card deleted before ready", async () => {
    const message = card("m5", { status: "placed" });
    fire("dnd5e.renderChatMessage", message, null);
    log.delete("m5");
    world.ready = true;
    fire("ready");
    await settle();
    expect(drive).not.toHaveBeenCalled();
  });

  it("drives a render after ready at once, and a create or an update as before", async () => {
    world.ready = true;
    fire("dnd5e.renderChatMessage", card("m6", { status: "placed" }), null);
    await settle();
    fire("updateChatMessage", card("m7", { status: "placed" }), {});
    await settle();
    expect(causes).toEqual(["render", "update"]);
    expect(drive).toHaveBeenCalledTimes(2);
  });
});
