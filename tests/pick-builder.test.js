import { describe, expect, it, vi } from "vitest";

globalThis.Hooks = { on: () => 1, once: () => 1, call: () => true, callAll: () => {} };
Object.assign(globalThis, {
  game: {
    modules: { get: () => null },
    messages: { get: () => null, contents: [] },
    users: { activeGM: null }
  }
});

const { choiceRows, pickInputHTML, tickRowsHTML } = await import("../scripts/decide/present.js");
const { pickInputs, picked, pickedAll, pickInputAt } = await import("../scripts/ui.js");

/** A root as the readers see it: `querySelectorAll` over a list of inputs, matched by name and value. */
function rootOf(inputs) {
  return {
    querySelectorAll: sel => {
      const name = /name="([^"]+)"/.exec(sel)?.[1];
      const value = /\[value="([^"]+)"\]/.exec(sel)?.[1] ?? null;
      return inputs.filter(i => i.name === name && (value === null || i.value === value));
    }
  };
}

/** THE PICK INPUT (decide/present.js `pickInputHTML`, ARCHITECTURE §5 *The pick*). */
describe("pickInputHTML", () => {
  it("draws one input: kind, name, value, the marks, checked, disabled, its style", () => {
    expect(
      pickInputHTML({ kind: "radio", name: "bf-x", value: "a", checked: true, style: "margin:0;" })
    ).toBe('<input type="radio" name="bf-x" value="a" checked style="margin:0;">');
    expect(
      pickInputHTML({ name: "bf-y", value: 2, disabled: true, data: { token: "t1", has: "1" } })
    ).toBe('<input type="checkbox" name="bf-y" value="2" data-token="t1" data-has="1" disabled>');
  });
  it("no value leaves the platform's own; a null value is an empty one; names and values are escaped", () => {
    expect(pickInputHTML({ name: "bf-sneak" })).toBe('<input type="checkbox" name="bf-sneak">');
    expect(pickInputHTML({ name: "bf-z", value: null })).toBe(
      '<input type="checkbox" name="bf-z" value="">'
    );
    expect(pickInputHTML({ name: "bf-z", value: 'a"<b>', data: { name: 'O"Neil' } })).toBe(
      '<input type="checkbox" name="bf-z" value="a&quot;&lt;b&gt;" data-name="O&quot;Neil">'
    );
  });
  it("tickRowsHTML's rows are drawn on it", () => {
    const html = tickRowsHTML({
      name: "bf-t",
      kind: "radio",
      rows: [
        { key: "a", name: "A", off: "spent" },
        { key: "b", name: "B", checked: true }
      ]
    });
    expect(html).toContain('<input type="radio" name="bf-t" value="a" disabled style="margin:0;">');
    expect(html).toContain('<input type="radio" name="bf-t" value="b" checked style="margin:0;">');
  });
});

/** THE CHOICE'S ROWS (RULINGS *The asks widened*): the bend first, Pass checked, then the mutes. */
describe("choiceRows", () => {
  it("appends Pass just this time, checked, and one row per mute scope", () => {
    const rows = choiceRows(
      [{ key: "Lucky", name: "Lucky" }],
      [
        { until: "turn", label: "Not until my turn" },
        { until: "combat", label: "Not this combat" }
      ]
    );
    expect(rows.map(r => r.key)).toEqual(["Lucky", "pass", "mute-turn", "mute-combat"]);
    expect(rows[1]).toMatchObject({ name: "Pass just this time", checked: true });
    expect(rows.filter(r => r.checked).length).toBe(1);
    expect(rows[2].name).toBe("Not until my turn");
  });
  it("no mutes: the bend and Pass alone", () => {
    expect(choiceRows([{ key: "cast", name: "Cut the damage" }]).map(r => r.key)).toEqual([
      "cast",
      "pass"
    ]);
  });
});

/** THE PICK'S READERS (ui.js). */
describe("picked, pickedAll, pickInputs, pickInputAt", () => {
  const inputs = [
    { name: "bf-r", value: "a", checked: false },
    { name: "bf-r", value: "b", checked: true },
    { name: "bf-c", value: "x", checked: true },
    { name: "bf-c", value: "y", checked: false },
    { name: "bf-c", value: "z", checked: true }
  ];
  const root = rootOf(inputs);
  it("picked answers the checked radio's value, or null", () => {
    expect(picked(root, "bf-r")).toBe("b");
    expect(picked(root, "bf-none")).toBeNull();
    expect(picked(null, "bf-r")).toBeNull();
  });
  it("pickedAll answers every checked value in order; pickInputs every input, or one value's", () => {
    expect(pickedAll(root, "bf-c")).toEqual(["x", "z"]);
    expect(pickInputs(root, "bf-c").length).toBe(3);
    expect(pickInputs(root, "bf-c", "y")).toEqual([inputs[3]]);
    expect(pickInputs(undefined, "bf-c")).toEqual([]);
  });
  it("pickInputAt finds the pick's input an event landed on", () => {
    const input = { name: "bf-r" };
    const target = { closest: vi.fn(sel => (sel === 'input[name="bf-r"]' ? input : null)) };
    expect(pickInputAt(target, "bf-r")).toBe(input);
    expect(pickInputAt(target, "bf-other")).toBeNull();
    expect(pickInputAt(null, "bf-r")).toBeNull();
  });
});
