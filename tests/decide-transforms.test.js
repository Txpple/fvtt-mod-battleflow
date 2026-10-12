import { beforeAll, describe, expect, it } from "vitest";
import { expectPointer } from "./rule-pointer.js";

/**
 * DECISION-layer transforms (ARCHITECTURE.md §2; issue #2): the pool rule off a profile, the cap a
 * blank profile takes from its target, the Known Forms arithmetic, the record and the answer folded in,
 * the form effect, what ends a form. No Foundry stub on purpose.
 */
/** @type {typeof import("../scripts/decide/transforms.js")} */
let s;
/** @type {typeof import("../scripts/decide/registry.js")} */
let reg;
beforeAll(async () => {
  s = await import("../scripts/decide/transforms.js");
  reg = await import("../scripts/decide/registry.js");
});

// The PHB's Wild Shape bands as the pack ships them (the cap evaluated): CR ¼ with `fly` on the NEGATIVE
// movement filter before 8, CR 1 and fliers from 8; Circle Forms' floor of the level over 3.
const band2 = { id: "b1", cr: 0.25, types: ["beast"], sizes: [], movement: ["fly"] };
const band8 = { id: "b3", cr: 1, types: ["beast"], sizes: [], movement: [] };
const polymorph = { id: "p", cr: null, types: ["beast"], sizes: [], movement: [] };
const animalShapes = {
  id: "a",
  cr: 4,
  types: ["beast"],
  sizes: ["tiny", "sm", "med", "lg"],
  movement: []
};

describe("TRANSFORMS — the table's rows", () => {
  it("every row says whose body it is, what ends the form, where its clock comes from, and points at the book", () => {
    for (const [key, row] of Object.entries(reg.TRANSFORMS)) {
      expect(typeof row.self, key).toBe("boolean");
      expect(Array.isArray(row.ends), key).toBe(true);
      for (const e of row.ends) expect(["incapacitated", "zero", "noTemp"], key).toContain(e);
      expect([null, "activity", "concentration"], key).toContain(row.clock);
      expectPointer(row.rule, key);
      expect(row.rule.item, key).toBe(key);
      expect(row.from, key).toBeTruthy();
    }
  });
  it("Wild Shape keeps four Known Forms and Circle Forms spends them; the spells keep none", () => {
    expect(s.knownSlotsOf(reg.TRANSFORMS, "Wild Shape")).toBe(4);
    expect(s.knownSlotsOf(reg.TRANSFORMS, "Circle Forms")).toBe(4);
    expect(s.knownHolderOf(reg.TRANSFORMS, "Circle Forms")).toBe("Wild Shape");
    expect(s.knownSlotsOf(reg.TRANSFORMS, "Polymorph")).toBe(0);
    expect(s.knownHolderOf(reg.TRANSFORMS, "Polymorph")).toBeNull();
    expect(s.knownSlotsOf(reg.TRANSFORMS, "nobody")).toBe(0);
  });
});

describe("poolRuleOf and capOfTarget — the gallery rule off a profile", () => {
  it("the band's cap, beasts only, and dnd5e's negative fly filter read as no fliers", () => {
    expect(s.poolRuleOf(band2)).toEqual({ crMax: 0.25, types: ["beast"], fly: false, sizes: null });
    expect(s.poolRuleOf(band8)).toEqual({ crMax: 1, types: ["beast"], fly: null, sizes: null });
    expect(s.poolRuleOf(animalShapes).sizes).toEqual(["tiny", "sm", "med", "lg"]);
  });
  it("a blank cap takes the target's; no target leaves the pool open", () => {
    expect(s.poolRuleOf(polymorph, { targetCap: 2 }).crMax).toBe(2);
    expect(s.poolRuleOf(polymorph).crMax).toBeNull();
    expect(s.poolRuleOf(band2, { targetCap: 9 }).crMax).toBe(0.25);
  });
  it("the target's CR first, else its level; a CR 0 creature with a level is capped by the level", () => {
    expect(s.capOfTarget({ cr: 2, level: null })).toBe(2);
    expect(s.capOfTarget({ cr: null, level: 7 })).toBe(7);
    expect(s.capOfTarget({ cr: 0, level: 5 })).toBe(5);
    expect(s.capOfTarget({ cr: 0, level: null })).toBe(0);
    expect(s.capOfTarget({})).toBeNull();
    expect(s.capOfTarget({ cr: "", level: "" })).toBeNull();
  });
});

const wolf = { uuid: "mm.wolf", name: "Wolf", img: null };
const rat = { uuid: "mm.rat", name: "Rat", img: null };
const horse = { uuid: "mm.horse", name: "Riding Horse", img: null };
const spider = { uuid: "mm.spider", name: "Spider", img: null };
const bear = { uuid: "mm.bear", name: "Brown Bear", img: null };

describe("the Known Forms — state, learning, the Long Rest", () => {
  it("none, open, full, over", () => {
    expect(s.knownState({ known: [], slots: 0 })).toEqual({ state: "none", open: 0 });
    expect(s.knownState({ known: [wolf], slots: 4 })).toEqual({ state: "open", open: 3 });
    expect(s.knownState({ known: [wolf, rat, horse, spider], slots: 4 })).toEqual({
      state: "full",
      open: 0
    });
    expect(s.knownState({ known: [wolf, rat, horse, spider, bear], slots: 4 })).toEqual({
      state: "over",
      open: 0
    });
  });
  it("a form is learned into an open slot, never into a full list or twice", () => {
    expect(s.learnedList({ known: [wolf], slots: 4, learn: rat }).map(k => k.name)).toEqual([
      "Wolf",
      "Rat"
    ]);
    expect(s.learnedList({ known: [wolf, rat, horse, spider], slots: 4, learn: bear })).toBeNull();
    expect(s.learnedList({ known: [wolf], slots: 4, learn: wolf })).toBeNull();
    expect(s.learnedList({ known: [wolf], slots: 4, learn: null })).toBeNull();
  });
  it("the Long Rest: open slots filled, then the one swap; a swap of a form not known, into one known, or two swaps, is refused", () => {
    expect(
      s
        .restKnownList({ known: [wolf, rat, horse, spider], slots: 4, out: "mm.wolf", into: bear })
        .map(k => k.name)
    ).toEqual(["Brown Bear", "Rat", "Riding Horse", "Spider"]);
    expect(
      s.restKnownList({ known: [wolf, rat], slots: 4, adds: [horse, spider] }).map(k => k.name)
    ).toEqual(["Wolf", "Rat", "Riding Horse", "Spider"]);
    expect(
      s
        .restKnownList({ known: [wolf, rat], slots: 4, adds: [horse], out: "mm.wolf", into: bear })
        .map(k => k.name)
    ).toEqual(["Brown Bear", "Rat", "Riding Horse"]);
    expect(
      s.restKnownList({ known: [wolf, rat, horse, spider], slots: 4, adds: [bear] })
    ).toBeNull();
    expect(s.restKnownList({ known: [wolf], slots: 4, out: "mm.bear", into: rat })).toBeNull();
    expect(s.restKnownList({ known: [wolf, rat], slots: 4, out: "mm.wolf", into: rat })).toBeNull();
    expect(
      s.restKnownList({ known: [wolf, rat], slots: 4, out: "mm.wolf", into: null })
    ).toBeNull();
    expect(s.restKnownList({ known: [wolf, rat], slots: 4 }).map(k => k.name)).toEqual([
      "Wolf",
      "Rat"
    ]);
    expect(s.restKnownList({ known: [wolf], slots: 4, adds: [rat, rat] }).map(k => k.name)).toEqual(
      ["Wolf", "Rat"]
    );
  });
});

describe("transformRecord and pickedAnswer — the record and the answer folded in", () => {
  const record = (over = {}) =>
    s.transformRecord({
      key: "Wild Shape",
      sourceUuid: "Actor.d",
      sourceName: "Tamsin",
      itemUuid: "Actor.d.Item.ws",
      itemName: "Wild Shape",
      itemType: "feat",
      activityUuid: "Actor.d.Item.ws.Activity.a",
      profile: band2,
      self: true,
      targets: [{ uuid: "Actor.d", name: "Tamsin" }],
      targetCap: null,
      known: [wolf, rat, horse, spider],
      slots: 4,
      lastForm: "mm.wolf",
      concentrationId: null,
      sceneId: "s1",
      ...over
    });
  it("the record starts asked with the band, the four known forms and the last one; a fixed-form profile starts picked", () => {
    const r = record();
    expect(r).toMatchObject({
      status: "asked",
      key: "Wild Shape",
      self: true,
      slots: 4,
      lastForm: "mm.wolf",
      itemType: "feat"
    });
    expect(r.profile).toMatchObject({ id: "b1", cr: 0.25, movement: ["fly"] });
    expect(r.known.map(k => k.name)).toEqual(["Wolf", "Rat", "Riding Horse", "Spider"]);
    const fixed = s.transformRecord({
      key: "Harkon's Bite",
      sourceUuid: "Actor.h",
      sourceName: "H",
      itemUuid: "i",
      itemName: "Harkon's Bite",
      itemType: "equipment",
      activityUuid: "a",
      profile: {
        id: "x",
        cr: null,
        types: [],
        sizes: [],
        movement: [],
        uuid: "Compendium.dnd5e.actors24.Actor.ww",
        name: ""
      },
      self: true,
      targets: [{ uuid: "Actor.h", name: "H" }],
      targetCap: null,
      known: [],
      slots: 0,
      lastForm: null,
      concentrationId: null,
      sceneId: null
    });
    expect(fixed.status).toBe("picked");
    expect(fixed.pick.uuid).toBe("Compendium.dnd5e.actors24.Actor.ww");
  });
  it("with the list full only a known form may be picked; with a slot open a pool form is learned at the use; with no slots anything goes", () => {
    const full = record();
    expect(s.pickedAnswer(full, { pick: wolf })).toMatchObject({
      status: "picked",
      pick: { uuid: "mm.wolf", name: "Wolf" }
    });
    expect(s.pickedAnswer(full, { pick: bear })).toBeNull();
    expect(s.pickedAnswer(full, { pick: bear, learn: true })).toBeNull();
    const open = record({ known: [wolf] });
    expect(s.pickedAnswer(open, { pick: bear, learn: true })).toMatchObject({
      status: "picked",
      learn: { uuid: "mm.bear", name: "Brown Bear" }
    });
    expect(s.pickedAnswer(open, { pick: bear })).toBeNull();
    expect(s.pickedAnswer(open, { pick: wolf }).learn).toBeUndefined();
    const spell = record({ key: "Polymorph", known: [], slots: 0, self: false });
    expect(s.pickedAnswer(spell, { pick: bear })).toMatchObject({ status: "picked" });
    expect(s.pickedAnswer(spell, { pick: null })).toBeNull();
    expect(s.pickedAnswer({ ...spell, status: "picked" }, { pick: bear })).toBeNull();
  });
});

describe("formEffectData and endOfForm — the clocked effect and what ends the form", () => {
  it("the effect names the form, carries its duration and the tie to the record, and depends on Concentration when told", () => {
    const e = s.formEffectData({
      itemName: "Wild Shape",
      formName: "Wolf",
      duration: { seconds: 3600 },
      messageId: "m1",
      originalId: "d1",
      key: "Wild Shape",
      origin: "Actor.d.Item.ws"
    });
    expect(e).toMatchObject({
      name: "Wild Shape — Wolf",
      transfer: false,
      duration: { seconds: 3600 },
      origin: "Actor.d.Item.ws"
    });
    expect(e.flags["fvtt-mod-bythebooks"].form).toEqual({
      messageId: "m1",
      originalId: "d1",
      key: "Wild Shape"
    });
    expect(e.flags.dnd5e).toBeUndefined();
    const p = s.formEffectData({
      itemName: "Polymorph",
      formName: "Giant Toad",
      messageId: "m2",
      originalId: "o1",
      key: "Polymorph",
      dependentOn: "Actor.c.ActiveEffect.conc"
    });
    expect(p.flags.dnd5e.dependentOn).toBe("Actor.c.ActiveEffect.conc");
  });
  it("Wild Shape ends on Incapacitated and 0 HP, not on the temp HP; Polymorph on the temp HP alone", () => {
    const ws = ["incapacitated", "zero"];
    expect(s.endOfForm(ws, { hpValue: 0 })).toMatchObject({ word: "zero" });
    expect(s.endOfForm(ws, { hpValue: 3 })).toBeNull();
    expect(s.endOfForm(ws, { tempValue: 0, tempBefore: 5 })).toBeNull();
    expect(s.endOfForm(ws, { statuses: ["paralyzed", "incapacitated"] })).toMatchObject({
      word: "incapacitated"
    });
    expect(s.endOfForm(ws, { statuses: ["prone"] })).toBeNull();
    const poly = ["noTemp"];
    expect(s.endOfForm(poly, { tempValue: 0, tempBefore: 12 })).toMatchObject({ word: "noTemp" });
    expect(s.endOfForm(poly, { tempValue: 0 })).toMatchObject({ word: "noTemp" });
    expect(s.endOfForm(poly, { tempValue: 0, tempBefore: 0 })).toBeNull();
    expect(s.endOfForm(poly, { hpValue: 0 })).toBeNull();
    expect(s.endOfForm([], { hpValue: 0, tempValue: 0, statuses: ["incapacitated"] })).toBeNull();
  });
});

describe("the words", () => {
  it("the locked line, the titles, the article", () => {
    expect(s.lockedLine({ more: 29, capLabel: "CR ¼ or lower" })).toBe(
      "29 more forms in the pool at CR ¼ or lower · locked until a Long Rest"
    );
    expect(s.lockedLine({ more: 1, capLabel: "" })).toBe(
      "1 more form in the pool · locked until a Long Rest"
    );
    expect(s.formTitle({ who: "Tamsin", form: "Wolf" })).toBe("Tamsin is now a Wolf");
    expect(s.formTitle({ who: "Tamsin", form: "Owl", ended: { why: "the time ran out" } })).toBe(
      "Tamsin is no longer an Owl — the time ran out"
    );
    expect(s.formTitle({ who: "Tamsin", form: "Wolf", failed: true })).toBe(
      "Tamsin — the form could not be taken"
    );
    expect(s.articleOf("Elk")).toBe("an");
  });
});
