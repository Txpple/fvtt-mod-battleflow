import { describe, it, expect } from "vitest";
import { askOutcome, askTicks, askWords } from "../scripts/decide/area-ask.js";

// The ask at the area's own arithmetic (2026-09-24, the cut out of metamagic.js). The defaults,
// the readers of a spell's text and the merged mark are covered in decide-metamagic.test.js,
// where they were born; this file pins what the machine reads off an answer.

const G = { uuid: "Actor.gren", name: "Gren", disposition: 1, party: true };
const inv = { uuid: "Actor.inv", name: "Invictus", disposition: 1, party: true };
const bram = { uuid: "Actor.bram", name: "Bramblemaw", disposition: -1 };
const croc = { uuid: "Actor.croc", name: "Giant Crocodile", disposition: -1 };
const caster = { casterUuid: G.uuid, casterDisposition: 1, casterName: "Gren" };

describe("the outcome of an answer", () => {
  it("Careful: the ticked are protected, up to the cap, and leave the demand", () => {
    const ask = {
      kind: "careful",
      feature: "Careful Spell",
      cap: 1,
      candidates: [G, inv, bram],
      ...caster
    };
    const out = askOutcome(ask, [inv.uuid, G.uuid]);
    expect(out.protectedList.map(c => c.name)).toEqual(["Invictus"]);
    expect(out.mark).toBeNull();
    expect(out.areaChoice).toBeNull();
    expect(out.stays(inv.uuid)).toBe(false);
    expect(out.stays(bram.uuid)).toBe(true);
  });
  it("Careful on the clock: the defaults — the caster and the party first", () => {
    const ask = {
      kind: "careful",
      feature: "Careful Spell",
      cap: 2,
      candidates: [bram, inv, G],
      ...caster
    };
    const out = askOutcome(ask, null, { timedOut: true });
    expect(out.protectedList.map(c => c.name)).toEqual(["Gren", "Invictus"]);
    expect(out.timedOut).toBe(true);
  });
  it("Heightened: one mark, the first tick", () => {
    const ask = {
      kind: "heightened",
      feature: "Heightened Spell",
      candidates: [inv, bram, croc],
      ...caster
    };
    expect(askOutcome(ask, [croc.uuid]).mark?.name).toBe("Giant Crocodile");
    expect(askOutcome(ask, null).mark?.name).toBe("Bramblemaw");
    expect(askOutcome(ask, [croc.uuid]).stays(inv.uuid)).toBe(true);
  });
  it("a chosen area: the ticked up to the spell's number are the choice, the rest are left, and only the chosen keep their save", () => {
    const ask = {
      kind: "choose",
      feature: "Slow",
      spell: "Slow",
      cap: 1,
      candidates: [inv, bram, croc],
      ...caster
    };
    const out = askOutcome(ask, [bram.uuid, croc.uuid]);
    expect(out.areaChoice.chosen.map(c => c.name)).toEqual(["Bramblemaw"]);
    expect(out.areaChoice.left.map(c => c.name)).toEqual(["Invictus", "Giant Crocodile"]);
    expect(out.areaChoice.asked).toBe(true);
    expect(out.stays(bram.uuid)).toBe(true);
    expect(out.stays(croc.uuid)).toBe(false);
  });
  it("a chosen area cast with Heightened carries the mark among the chosen", () => {
    const ask = {
      kind: "choose",
      feature: "Slow",
      spell: "Slow",
      cap: 6,
      candidates: [inv, bram, croc],
      ...caster,
      heightened: { feature: "Heightened Spell", rule: "…" }
    };
    expect(askOutcome(ask, [bram.uuid, croc.uuid], { mark: croc.uuid }).mark?.name).toBe(
      "Giant Crocodile"
    );
    expect(askOutcome(ask, [bram.uuid], { mark: croc.uuid }).mark?.name).toBe("Bramblemaw");
  });
});

describe("the words and the shape", () => {
  it("ticks for Careful and a chosen area, a radio for Heightened", () => {
    expect(askTicks({ kind: "careful" })).toBe(true);
    expect(askTicks({ kind: "choose" })).toBe(true);
    expect(askTicks({ kind: "heightened" })).toBe(false);
  });
  it("each kind wears its own words", () => {
    const careful = askWords({
      kind: "careful",
      feature: "Careful Spell",
      cap: 2,
      candidates: [inv, bram]
    });
    expect(careful.title).toBe("Who does the spell spare? Up to 2.");
    expect(careful.eyebrow).toBe("Metamagic — Careful Spell");
    const choose = askWords({
      kind: "choose",
      feature: "Slow",
      spell: "Slow",
      cap: 6,
      candidates: [inv, bram, croc],
      heightened: { feature: "Heightened Spell" }
    });
    expect(choose.title).toBe("Who does Slow affect? Up to 6.");
    expect(choose.subtitle).toBe(
      "3 in the area · Heightened Spell: one of them saves at Disadvantage"
    );
    expect(choose.carrierSubtitle).toBe("Heightened Spell rides it — the card follows the answer");
    const heightened = askWords({
      kind: "heightened",
      feature: "Heightened Spell",
      spell: "Fireball",
      candidates: [bram]
    });
    expect(heightened.question).toBe("who saves at Disadvantage?");
    expect(heightened.carrierSubtitle).toBe("Fireball — the card follows the answer");
  });
});
