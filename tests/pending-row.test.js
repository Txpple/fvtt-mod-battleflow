import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.Hooks = { on: () => 1, once: () => 1, call: () => true, callAll: () => {} };
Object.assign(globalThis, {
  game: { modules: { get: () => null }, messages: { get: () => null }, users: { activeGM: null } }
});

/** An element just big enough for a card row: it keeps its children and the markup inserted into it. */
function element() {
  const el = {
    children: [],
    html: "",
    style: {},
    listeners: {},
    appendChild: child => {
      el.children.push(child);
      return child;
    },
    insertAdjacentHTML: (_where, markup) => {
      el.html += markup;
    },
    querySelectorAll: () => [],
    addEventListener: (type, fn) => {
      el.listeners[type] = fn;
    }
  };
  return el;
}
globalThis.document = { createElement: () => element() };
globalThis.requestAnimationFrame = () => 0;

const { pendingRow, forgetShown } = await import("../scripts/ui.js");

let next = 0;
const card = () => ({ id: `card${++next}` });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/**
 * THE PENDING ROW (ui.js `pendingRow`, ARCHITECTURE §5 *The pending row*): one shape for every
 * machine's pending card row — the bar, the popup shown once per client, the call-back button, the clock.
 */
describe("pendingRow — the bar, the latch, the call-back button and the clock", () => {
  it("draws the bar, shows the popup once, adds the button that shows it again, and arms the clock", () => {
    const message = card();
    const row = element();
    const show = vi.fn();
    const arm = vi.fn();
    pendingRow(message, row, {
      bar: "<div data-bf-deadline></div>",
      latch: { sub: "ask", show },
      answer: "Answer",
      arm
    });
    expect(row.html).toBe(" <div data-bf-deadline></div>");
    expect(show).toHaveBeenCalledTimes(1);
    expect(row.children).toHaveLength(1);
    expect(row.children[0].textContent).toBe("Answer");
    expect(arm).toHaveBeenCalledWith(message);
    row.children[0].listeners.click();
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("shows a popup once per message and sub: a re-render never reopens one the player closed", () => {
    const message = card();
    const show = vi.fn();
    pendingRow(message, element(), { latch: { sub: "ask", show } });
    pendingRow(message, element(), { latch: { sub: "ask", show } });
    expect(show).toHaveBeenCalledTimes(1);
    const other = vi.fn();
    pendingRow(message, element(), {
      latch: [
        { sub: "ask", show },
        { sub: "ask|guard", show: other }
      ]
    });
    expect(show).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
    pendingRow(card(), element(), { latch: { sub: "ask", show } });
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("draws nothing for a part left out or falsy", () => {
    const row = element();
    expect(() =>
      pendingRow(card(), row, { bar: "", latch: false, answer: false, arm: null })
    ).not.toThrow();
    expect(row.html).toBe("");
    expect(row.children).toHaveLength(0);
    // A label with no latch to re-run draws no button: there is nothing for it to show.
    pendingRow(card(), row, { answer: "Answer" });
    expect(row.children).toHaveLength(0);
  });

  it("takes the button's own label, show and style over the latch's", () => {
    const row = element();
    const latch = vi.fn();
    const recall = vi.fn();
    pendingRow(card(), row, {
      latch: { sub: "pick", show: latch },
      answer: { label: "Pick the form", show: recall, style: { margin: "0.25rem 0 0" } }
    });
    const [button] = row.children;
    expect(button.textContent).toBe("Pick the form");
    expect(button.style.margin).toBe("0.25rem 0 0");
    button.listeners.click();
    expect(recall).toHaveBeenCalledTimes(1);
    expect(latch).toHaveBeenCalledTimes(1);
  });
});

describe("forgetShown — the latch released", () => {
  it("lets the next render show the popup again, by sub", () => {
    const message = card();
    const show = vi.fn();
    pendingRow(message, element(), { latch: { sub: "concentration", show } });
    forgetShown(message, "concentration");
    pendingRow(message, element(), { latch: { sub: "concentration", show } });
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("releases only the subs a test picks, on that message alone", () => {
    const message = card();
    const elsewhere = card();
    const kept = vi.fn();
    const dropped = vi.fn();
    const other = vi.fn();
    pendingRow(message, element(), { latch: { sub: "save:a", show: kept } });
    pendingRow(message, element(), { latch: { sub: "save:b", show: dropped } });
    pendingRow(elsewhere, element(), { latch: { sub: "save:b", show: other } });
    forgetShown(message, sub => sub === "save:b");
    for (const [m, sub, show] of [
      [message, "save:a", kept],
      [message, "save:b", dropped],
      [elsewhere, "save:b", other]
    ]) {
      pendingRow(m, element(), { latch: { sub, show } });
    }
    expect(kept).toHaveBeenCalledTimes(1);
    expect(dropped).toHaveBeenCalledTimes(2);
    expect(other).toHaveBeenCalledTimes(1);
  });
});
