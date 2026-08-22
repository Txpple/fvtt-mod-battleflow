import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * DECISION-layer presentation (ARCHITECTURE.md §2). No Foundry stub on purpose — §2's layer
 * table names formatting as DECISION work, and none of this needs a document or the DOM.
 *
 * ⚠ The bar reads the wall clock, so the clock is faked here rather than the API. That is the
 * only impurity in the module and it is an input, not a dependency.
 */
/** @type {typeof import("../scripts/decide/present.js")} */
let p;
beforeAll(async () => {
  p = await import("../scripts/decide/present.js");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("popupKey — one decision, one key", () => {
  it("joins the message and the target", () => {
    expect(p.popupKey("msg1", "Actor.a")).toBe("msg1|Actor.a");
  });

  it("keeps two targets on one message apart, and one target across two messages", () => {
    expect(p.popupKey("m", "a")).not.toBe(p.popupKey("m", "b"));
    expect(p.popupKey("m1", "a")).not.toBe(p.popupKey("m2", "a"));
  });
});

describe("bfCard — the house card", () => {
  it("wears the tone's accent, and falls back to neutral for one it does not know", () => {
    expect(p.bfCard({ title: "T", tone: "good" })).toContain(p.TONE.good);
    expect(p.bfCard({ title: "T", tone: "nonsense" })).toContain(p.TONE.neutral);
    expect(p.bfCard({ title: "T" })).toContain(p.TONE.neutral);
  });

  it("renders no portrait at all when there is no image", () => {
    expect(p.bfCard({ title: "T" })).not.toContain("<img");
    expect(p.bfCard({ title: "T", img: "icons/a.webp" })).toContain('src="icons/a.webp"');
  });

  it("names the icon by the eyebrow, then the title — walk-5 (aa)", () => {
    expect(p.bfCard({ title: "T", eyebrow: "REACTION", img: "i.webp" })).toContain(
      'data-tooltip="REACTION"'
    );
    expect(p.bfCard({ title: "Shield", img: "i.webp" })).toContain('data-tooltip="Shield"');
  });

  it("strips tags and escapes quotes out of the TOOLTIP — that string lands in an attribute", () => {
    const html = p.bfCard({ title: '<b>Say "hi"</b>', img: "i.webp" });
    expect(html).toContain('data-tooltip="Say &quot;hi&quot;"');
    expect(html).toContain('alt="Say &quot;hi&quot;"');
  });

  it("but renders the TITLE as markup — the card body trusts its caller, the attribute does not", () => {
    // Deliberate asymmetry, and the reason the tooltip has its own scrub: titles and lines are
    // already-safe HTML fragments the machines compose, while an attribute cannot carry them.
    expect(p.bfCard({ title: "<b>Bold</b>", img: "i.webp" })).toContain("<b>Bold</b>");
  });

  it("drops empty body lines instead of rendering blank rows", () => {
    const html = p.bfCard({ title: "T", lines: ["one", "", null, "two"] });
    expect(html.match(/margin-top:0\.2rem;/g)).toHaveLength(2);
  });

  it("omits the eyebrow and subtitle blocks entirely when unset", () => {
    const bare = p.bfCard({ title: "T" });
    expect(bare).not.toContain("text-transform:uppercase");
    expect(p.bfCard({ title: "T", eyebrow: "E" })).toContain("text-transform:uppercase");
  });
});

describe("ruleLine — the verbatim quote's dress", () => {
  it("wraps the caller's words in curly quotes and italics, and adds nothing else", () => {
    expect(p.ruleLine("You can use your reaction")).toBe("<em>“You can use your reaction”</em>");
  });
});

describe("momentBarHTML — the countdown", () => {
  const at = ms => vi.setSystemTime(new Date(ms));

  it("draws nothing without both a deadline and a window — no hidden contract", () => {
    vi.useFakeTimers();
    at(1000);
    expect(p.momentBarHTML({ window: 20 })).toBe("");
    expect(p.momentBarHTML({ deadline: 21_000 })).toBe("");
    expect(p.momentBarHTML(undefined)).toBe("");
    expect(p.momentBarHTML({})).toBe("");
  });

  it("draws nothing once the deadline has passed, including exactly ON it", () => {
    vi.useFakeTimers();
    at(21_000);
    expect(p.momentBarHTML({ deadline: 21_000, window: 20 })).toBe("");
    at(21_001);
    expect(p.momentBarHTML({ deadline: 21_000, window: 20 })).toBe("");
  });

  it("writes the deadline and window onto the element, for the DOM half to snap to", () => {
    vi.useFakeTimers();
    at(1000);
    const html = p.momentBarHTML({ deadline: 21_000, window: 20 });
    expect(html).toContain('data-bf-deadline="21000"');
    expect(html).toContain('data-bf-window="20"');
  });

  it("names the action the buzzer will take, defaulting to answering", () => {
    vi.useFakeTimers();
    at(1000);
    expect(p.momentBarHTML({ deadline: 21_000, window: 20 })).toContain("20s to answer");
    expect(p.momentBarHTML({ deadline: 21_000, window: 20 }, "to roll")).toContain("20s to roll");
  });
});

describe("holdBarHTML — the status gate for WHOLE flags", () => {
  it("draws for a pending flag whose deadline is still ahead", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
    expect(p.holdBarHTML({ status: "pending", deadline: 21_000, window: 20 })).not.toBe("");
  });

  it("draws NOTHING for a resolved flag, even with time left on its clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));
    expect(p.holdBarHTML({ status: "done", deadline: 21_000, window: 20 })).toBe("");
    expect(p.holdBarHTML({ deadline: 21_000, window: 20 })).toBe("");
    expect(p.holdBarHTML(undefined)).toBe("");
  });
});

describe("the staircase — finding (s)", () => {
  it("starts at the top-left slot for an empty pile", () => {
    expect(p.nextCascadeSlot([])).toBe(0);
  });

  it("takes the SMALLEST FREE slot, not the depth count — a closed popup's slot is free", () => {
    // The depth-count hole: with slots 0 and 2 live, counting popups gives 2 and lands the
    // newcomer exactly on top of a survivor.
    expect(p.nextCascadeSlot([0, 2])).toBe(1);
    expect(p.nextCascadeSlot([1, 2])).toBe(0);
    expect(p.nextCascadeSlot([0, 1, 2])).toBe(3);
  });

  it("steps one header down-right per slot, from the pile's anchor", () => {
    const anchor = { left: 100, top: 50 };
    expect(p.cascadePosition(anchor, 0)).toEqual({ left: 100, top: 50 });
    expect(p.cascadePosition(anchor, 1)).toEqual({
      left: 100 + p.CASCADE_STEP,
      top: 50 + p.CASCADE_STEP
    });
  });

  it("wraps a pathological pile back to the anchor rather than marching it off-screen", () => {
    const anchor = { left: 100, top: 50 };
    expect(p.cascadePosition(anchor, 8)).toEqual({ left: 100, top: 50 });
    expect(p.cascadePosition(anchor, 9)).toEqual(p.cascadePosition(anchor, 1));
  });

  it("fronts the elders DEEPEST FIRST, so slot 0 ends on top — z-order is causal order", () => {
    const slots = new Map([
      ["first", 0],
      ["second", 1],
      ["third", 2]
    ]);
    expect(p.eldersDeepestFirst(slots, "third")).toEqual(["second", "first"]);
  });

  it("never fronts the newcomer itself — it belongs at the BACK of the pile", () => {
    const slots = new Map([
      ["a", 0],
      ["b", 1]
    ]);
    expect(p.eldersDeepestFirst(slots, "b")).toEqual(["a"]);
    expect(p.eldersDeepestFirst(slots, "a")).toEqual(["b"]);
  });
});
