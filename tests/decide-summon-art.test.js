import { describe, expect, it } from "vitest";
import {
  ART_SPELLS,
  artChanges,
  artFor,
  artKey,
  cleanTable,
  fileStem,
  fillBlanks,
  matchFiles
} from "../scripts/decide/summon-art.js";

/**
 * DECISION-layer summon art (RULINGS *Summons*, call 15): the name keys, the lookup by spell then
 * creature, the changes folded into dnd5e's, a folder's files matched by name, the blanks filled and
 * the table as stored. No Foundry stub on purpose.
 */

describe("artKey", () => {
  it("folds case, spaces and dots", () => {
    expect(artKey("  Giant   Owl ")).toBe("giant owl");
    expect(artKey("Find Familiar")).toBe("find familiar");
    expect(artKey("St. Owl")).toBe("st owl");
    expect(artKey(null)).toBe("");
  });
});

describe("artFor", () => {
  const table = { "find familiar": { owl: { token: " owl.webp ", portrait: "" } } };
  it("finds the art by spell and creature name, any case", () => {
    expect(artFor(table, "Find Familiar", "Owl")).toEqual({ token: "owl.webp", portrait: null });
  });
  it("is blank for a creature, a spell or a table it does not know", () => {
    expect(artFor(table, "Find Familiar", "Bat")).toEqual({ token: null, portrait: null });
    expect(artFor(table, "Summon Beast", "Owl")).toEqual({ token: null, portrait: null });
    expect(artFor(null, "Find Familiar", "Owl")).toEqual({ token: null, portrait: null });
  });
});

describe("artChanges", () => {
  it("puts the token on the texture and the portrait on the actor's image", () => {
    expect(artChanges({ token: "t.webp", portrait: "p.webp" })).toEqual({
      tokenUpdates: { texture: { src: "t.webp" }, ring: { enabled: false } },
      actorUpdates: { img: "p.webp" }
    });
  });
  it("changes nothing when the table sets nothing", () => {
    expect(artChanges({ token: null, portrait: null })).toEqual({
      tokenUpdates: {},
      actorUpdates: {}
    });
  });
});

describe("fileStem", () => {
  it("writes a name as a file stem", () => {
    expect(fileStem("Giant Owl")).toBe("giant-owl");
    expect(fileStem("Spider (Tiny)")).toBe("spider-tiny");
    expect(fileStem("Flumph_Portrait")).toBe("flumph-portrait");
    expect(fileStem("Élan")).toBe("elan");
  });
});

describe("matchFiles", () => {
  const names = ["Owl", "Giant Owl", "Bat", "Cat"];
  const files = [
    "art/familiars/owl.webp",
    "art/familiars/owl-portrait.webp",
    "art/familiars/Giant%20Owl.png",
    "art/familiars/giant_owl-portrait.jpg",
    "art/familiars/bat-portrait.webp",
    "art/familiars/notes.txt",
    "art/familiars/cat.txt"
  ];
  const out = matchFiles(names, files);
  it("takes <stem> as the token and <stem>-portrait as the portrait", () => {
    expect(out.owl).toEqual({
      token: "art/familiars/owl.webp",
      portrait: "art/familiars/owl-portrait.webp"
    });
  });
  it("reads escapes, spaces and underscores in a file name", () => {
    expect(out["giant owl"]).toEqual({
      token: "art/familiars/Giant%20Owl.png",
      portrait: "art/familiars/giant_owl-portrait.jpg"
    });
  });
  it("keeps a half match and skips what is not an image", () => {
    expect(out.bat).toEqual({ token: null, portrait: "art/familiars/bat-portrait.webp" });
    expect(out.cat).toBeUndefined();
  });
  it("lets the first file a stem meets win", () => {
    expect(matchFiles(["Owl"], ["a/owl.webp", "b/owl.png"]).owl.token).toBe("a/owl.webp");
  });
});

describe("fillBlanks", () => {
  it("fills only the blank fields and counts them", () => {
    const have = { owl: { token: "mine.webp", portrait: null } };
    const matches = {
      owl: { token: "theirs.webp", portrait: "p.webp" },
      bat: { token: "bat.webp", portrait: null }
    };
    const { art, filled } = fillBlanks(have, matches);
    expect(art.owl).toEqual({ token: "mine.webp", portrait: "p.webp" });
    expect(art.bat).toEqual({ token: "bat.webp", portrait: null });
    expect(filled).toBe(2);
  });
});

describe("cleanTable", () => {
  it("trims, keys by name, and drops what is empty", () => {
    expect(
      cleanTable({
        "Find Familiar": {
          Owl: { token: " o.webp ", portrait: "" },
          Bat: { token: "", portrait: null }
        },
        "Summon Beast": { Wolf: { token: "  " } }
      })
    ).toEqual({ "find familiar": { owl: { token: "o.webp" } } });
  });
});

describe("ART_SPELLS", () => {
  it("starts with Find Familiar and names its spell", () => {
    expect(ART_SPELLS[0]?.name).toBe("Find Familiar");
    expect(ART_SPELLS[0]?.uuid).toMatch(/^Compendium\./);
  });
});
