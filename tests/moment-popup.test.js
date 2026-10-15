import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The platform's DialogV2 as openMomentPopup drives it: a render that may fail, a close that records its options. */
class DialogStub {
  static made = [];
  static failRender = false;
  constructor(options) {
    this.options = options;
    this.rendered = false;
    this.element = null;
    this.position = {};
    this.closes = [];
    DialogStub.made.push(this);
  }
  async render() {
    if (DialogStub.failRender) throw new Error("render failed");
    this.rendered = true;
    this.element = { contains: () => false, querySelectorAll: () => [] };
  }
  async close(options) {
    this.closes.push(options);
    this.rendered = false;
  }
  setPosition() {}
  bringToFront() {}
}

globalThis.Hooks = { on: () => 1, once: () => 1, call: () => true, callAll: () => {} };
Object.assign(globalThis, {
  game: { modules: { get: () => null }, messages: { get: () => null }, users: { activeGM: null } },
  ui: { chat: { updateMessage: () => {} } },
  foundry: { applications: { api: { DialogV2: DialogStub } } },
  document: { activeElement: null, querySelectorAll: () => [] },
  requestAnimationFrame: () => 0
});

const { openMomentPopup, confirmPopup, livePopups } = await import("../scripts/ui.js");

const message = { id: "m1" };
const open = (opts = {}) =>
  openMomentPopup(message, "ask", null, {
    gate: false,
    title: "Ask",
    content: "",
    buttons: [],
    ...opts
  });

beforeEach(() => {
  livePopups.clear();
  DialogStub.made = [];
  DialogStub.failRender = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** THE POPUP (ui.js openMomentPopup, ARCHITECTURE §5 *The pending row*): the one door to a DialogV2. */
describe("openMomentPopup — onDismiss", () => {
  it("runs once when the dialog closes unanswered, before the dialog's own close", async () => {
    const order = [];
    const onDismiss = vi.fn(d => order.push(`dismiss:${d.closes.length}`));
    const dialog = await open({ onDismiss });
    expect(livePopups.get("m1|ask")).toBe(dialog);
    await dialog.close();
    await dialog.close({ force: true });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["dismiss:0"]);
    expect(livePopups.has("m1|ask")).toBe(false);
  });

  it("does not run for a button's submission (DialogV2 closes it with `submitted`)", async () => {
    const onDismiss = vi.fn();
    const dialog = await open({ onDismiss });
    await dialog.close({ submitted: true });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("runs when the render fails: the popup never opened", async () => {
    DialogStub.failRender = true;
    const onDismiss = vi.fn();
    const dialog = await open({ onDismiss });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith(dialog);
    expect(dialog.rendered).toBe(false);
  });
});

describe("openMomentPopup — the buzzer", () => {
  it("at its deadline closes the dialog as a dismissal, then fires", async () => {
    vi.useFakeTimers();
    const order = [];
    const fire = vi.fn(() => order.push("fire"));
    const dialog = await open({
      onDismiss: () => order.push("dismiss"),
      buzzer: { at: Date.now() + 5000, fire }
    });
    await vi.advanceTimersByTimeAsync(4999);
    expect(fire).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(order).toEqual(["dismiss", "fire"]);
    expect(dialog.closes).toEqual([undefined]);
  });

  it("is disarmed by any close before it", async () => {
    vi.useFakeTimers();
    const fire = vi.fn();
    const dialog = await open({ buzzer: { at: Date.now() + 5000, fire } });
    await dialog.close({ submitted: true });
    await vi.advanceTimersByTimeAsync(6000);
    expect(fire).not.toHaveBeenCalled();
  });
});

describe("confirmPopup — a yes or no", () => {
  it("answers the button pressed, No the default", async () => {
    const asked = confirmPopup("Item.x", "confirm", { title: "End it?", content: "<p>?</p>" });
    await vi.waitFor(() => expect(DialogStub.made.length).toBe(1));
    const [yes, no] = DialogStub.made[0].options.buttons;
    expect(no.default).toBe(true);
    yes.callback();
    await expect(asked).resolves.toBe(true);
  });

  it("answers null when it closes unanswered", async () => {
    const asked = confirmPopup("Item.y", "confirm", { title: "End it?", content: "<p>?</p>" });
    await vi.waitFor(() => expect(livePopups.has("Item.y|confirm")).toBe(true));
    await livePopups.get("Item.y|confirm").close();
    await expect(asked).resolves.toBe(null);
  });
});
