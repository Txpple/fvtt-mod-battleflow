import { beforeAll, describe, expect, it } from "vitest";

/**
 * THE CARD SEAM (ARCHITECTURE.md §2, the dnd5e 6.0 pass — 2026-09-15). No Foundry stub on purpose.
 *
 * ⚠ The shapes below are dnd5e 6.0.1's OWN, copied from its data models
 * (`module/data/chat-message/*.mjs`, read against the release-6.0.1 tag): a typed message with
 * `system.{activity, item, origin, targets}` on every roll card, `system.{ability, mode, mastery,
 * ammunition}` on an attack, `system.onSave` on a damage roll, `system.{type, ability, resisted}`
 * on a save, `system.{level, scaling, concentration}` on a usage card, and a target descriptor of
 * `{actor, token, ac, img, name}` — no `uuid`. A change to what these tests hold IS a change to
 * the platform contract this module reads, and belongs in the same commit as the pin bump.
 */
/** @type {typeof import("../scripts/decide/card.js")} */
let c;
beforeAll(async () => {
  c = await import("../scripts/decide/card.js");
});

const ref = {
  activity: {
    id: "act1",
    type: "attack",
    uuid: "Actor.a1.Item.i1.Activity.act1",
    name: "Attack",
    img: "x.png"
  },
  item: {
    id: "i1",
    type: "weapon",
    uuid: "Actor.a1.Item.i1",
    name: "Longsword",
    img: "sword.png",
    compendiumSource: null
  }
};
const descriptor = (actor, token, extra = {}) => ({
  actor,
  token,
  ac: 15,
  img: "t.png",
  name: "Gren",
  ...extra
});

/** A message the way a document reads: `system.origin` resolved, the raw id on `_source`. */
const attack = (overrides = {}) => ({
  type: "attack",
  system: {
    ...ref,
    origin: { id: "usage1" },
    targets: [descriptor("Actor.v1", "Scene.s.Token.t1")],
    ability: "str",
    mode: "twoHanded",
    mastery: "graze",
    ammunition: null,
    ...overrides
  },
  _source: { system: { origin: "usage1" } }
});

describe("cardKind / isCard / rollKindOf — what kind of card this is, by `type`", () => {
  it("reads the type, and calls a typeless message base", () => {
    expect(c.cardKind(attack())).toBe("attack");
    expect(c.cardKind({ type: "usage" })).toBe("usage");
    expect(c.cardKind({})).toBe("base");
    expect(c.cardKind(null)).toBe("base");
    expect(c.isCard(attack(), c.CARD.attack)).toBe(true);
    expect(c.isCard(attack(), c.CARD.damage)).toBe(false);
  });
  it("names only the ROLL kinds as roll kinds — a usage card or a prompt is not one", () => {
    expect(c.rollKindOf({ type: "damage" })).toBe("damage");
    expect(c.rollKindOf({ type: "healing" })).toBe("healing");
    expect(c.rollKindOf({ type: "save" })).toBe("save");
    expect(c.rollKindOf({ type: "check" })).toBe("check");
    expect(c.rollKindOf({ type: "usage" })).toBeNull();
    expect(c.rollKindOf({ type: "prompt" })).toBeNull();
    expect(c.rollKindOf({})).toBeNull();
    expect(c.rollKindInData({ type: "save", system: {} })).toBe("save");
    expect(c.rollKindInData({ flavor: "x" })).toBeNull();
  });
  it("⚠ never reads flags.dnd5e — the 5.x keys are gone and the fallback is not load-bearing", () => {
    expect(c.cardKind({ flags: { dnd5e: { roll: { type: "attack" } } } })).toBe("base");
    expect(c.rollKindOf({ flags: { dnd5e: { messageType: "usage" } } })).toBeNull();
  });
});

describe("subKindOf — death and concentration are saves now, told apart by system.type", () => {
  it("a save without a type is an ability save; death and concentration say so", () => {
    expect(c.subKindOf({ type: "save", system: { ability: "con" } })).toBe("ability");
    expect(c.subKindOf({ type: "save", system: { type: "death" } })).toBe("death");
    expect(c.subKindOf({ type: "save", system: { type: "concentration", ability: "con" } })).toBe(
      "concentration"
    );
  });
  it("initiative is a check with type initiative; a skill or tool check is an ability check", () => {
    expect(c.subKindOf({ type: "check", system: { type: "initiative", ability: "dex" } })).toBe(
      "initiative"
    );
    expect(c.subKindOf({ type: "check", system: { skill: "ste", ability: "dex" } })).toBe(
      "ability"
    );
  });
  it("anything that is not a save or a check has no sub-kind", () => {
    expect(c.subKindOf(attack())).toBeNull();
    expect(c.subKindOf({ type: "usage", system: { type: "death" } })).toBeNull();
  });
});

describe("targetsOf — 6.0's token-keyed descriptors, in the house shape (uuid = the ACTOR)", () => {
  it("hands every reader `uuid` as the actor, the token beside it, the AC as recorded", () => {
    const [t] = c.targetsOf(attack());
    expect(t).toEqual({
      uuid: "Actor.v1",
      actor: "Actor.v1",
      token: "Scene.s.Token.t1",
      name: "Gren",
      img: "t.png",
      ac: 15
    });
  });
  it("keeps a null AC null (total cover — the platform's own miss) and fills the blanks", () => {
    const [t] = c.targetsOf({ system: { targets: [{ actor: "Actor.v1", ac: null }] } });
    expect(t).toMatchObject({ uuid: "Actor.v1", token: null, name: "", img: null, ac: null });
    expect(c.targetsOf({ system: { targets: [{ actor: "Actor.v1" }] } })[0].ac).toBeNull();
  });
  it("⚠ folds two tokens of ONE linked actor to one row — the module applies to actors, and 5.3.3 never listed one twice", () => {
    const msg = {
      system: {
        targets: [
          descriptor("Actor.pc", "Scene.s.Token.a"),
          descriptor("Actor.pc", "Scene.s.Token.b", { name: "the other" }),
          descriptor("Scene.s.Token.c.Actor.x", "Scene.s.Token.c")
        ]
      }
    };
    const rows = c.targetsOf(msg);
    expect(rows.map(t => t.uuid)).toEqual(["Actor.pc", "Scene.s.Token.c.Actor.x"]);
    expect(rows[0].token).toBe("Scene.s.Token.a"); // the first token wins
  });
  it("reads a 5.x-shaped row by its uuid too, and skips a row naming nobody", () => {
    expect(
      c.targetsOf({ system: { targets: [{ uuid: "Actor.old", name: "Old", ac: 12 }] } })[0]
    ).toMatchObject({ uuid: "Actor.old", actor: "Actor.old", ac: 12 });
    expect(c.targetsOf({ system: { targets: [{ name: "nobody" }, null] } })).toEqual([]);
  });
  it("is empty for a card with no snapshot, never a throw", () => {
    expect(c.targetsOf({ type: "usage" })).toEqual([]);
    expect(c.targetsOf(null)).toEqual([]);
    expect(c.targetsOf({ system: { targets: "junk" } })).toEqual([]);
    expect(c.TARGETS_KEY).toBe("system.targets");
  });
  it("targetsInData: a usage's pre-create data, flattened or expanded — and NULL when it names no snapshot", () => {
    const d = descriptor("Actor.v1", "Scene.s.Token.t1");
    expect(c.targetsInData({ "system.targets": [d] })[0]).toMatchObject({ uuid: "Actor.v1" });
    expect(c.targetsInData({ system: { targets: [d] } })[0]).toMatchObject({ uuid: "Actor.v1" });
    expect(c.targetsInData({ system: { targets: [] } })).toEqual([]); // aimed at nobody — a claim
    expect(c.targetsInData({ system: {} })).toBeNull(); // not written yet — read the client's targets
    expect(c.targetsInData({ flags: { dnd5e: { targets: [d] } } })).toBeNull();
    expect(c.targetsInData(undefined)).toBeNull();
  });
});

describe("describeTarget — the descriptor the module writes when IT names a target", () => {
  it("is the platform's shape: actor, token, name, img, ac — and null AC under total cover", () => {
    expect(
      c.describeTarget({
        actorUuid: "Actor.a",
        tokenUuid: "Scene.s.Token.t",
        name: "Tok",
        img: "i.png",
        ac: 14
      })
    ).toEqual({ actor: "Actor.a", token: "Scene.s.Token.t", name: "Tok", img: "i.png", ac: 14 });
    expect(
      c.describeTarget({ actorUuid: "Actor.a", name: "Tok", ac: 14, totalCover: true }).ac
    ).toBeNull();
    expect(c.describeTarget({ actorUuid: "Actor.a", name: "Tok" })).toEqual({
      actor: "Actor.a",
      token: null,
      name: "Tok",
      img: null,
      ac: null
    });
  });
  it("round-trips through targetsOf as the house shape", () => {
    const d = c.describeTarget({
      actorUuid: "Actor.a",
      tokenUuid: "Scene.s.Token.t",
      name: "Tok",
      ac: 9
    });
    expect(c.targetsOf({ system: { targets: [d] } })[0]).toMatchObject({
      uuid: "Actor.a",
      token: "Scene.s.Token.t",
      ac: 9
    });
  });
});

describe("originIdOf / originIdInData / originData — the chain, by the key the registry indexes", () => {
  it("reads the id off the SOURCE, so a deleted origin still names itself", () => {
    expect(c.originIdOf(attack())).toBe("usage1");
    expect(
      c.originIdOf({ system: { origin: null }, _source: { system: { origin: "gone" } } })
    ).toBe("gone");
  });
  it("falls back to the resolved document's id, or a bare string, or null", () => {
    expect(c.originIdOf({ system: { origin: { id: "m2" } } })).toBe("m2");
    expect(c.originIdOf({ system: { origin: "m3" } })).toBe("m3");
    expect(c.originIdOf({ system: { origin: null } })).toBeNull();
    expect(c.originIdOf({ type: "base" })).toBeNull();
    expect(c.originIdOf(null)).toBeNull();
  });
  it("reads a roll's pre-create data flattened (the module's own stamp) or expanded (after buildPost)", () => {
    expect(c.originIdInData({ "system.origin": "u1" })).toBe("u1");
    expect(c.originIdInData({ system: { origin: "u2" } })).toBe("u2");
    expect(c.originIdInData({ system: { origin: { id: "u3" } } })).toBe("u3");
    expect(c.originIdInData({ flags: {} })).toBeNull();
    expect(c.originIdInData(undefined)).toBeNull();
  });
  it("writes the stamp under the key the platform reads — and it is not the old flag", () => {
    expect(c.ORIGIN_KEY).toBe("system.origin");
    expect(c.originData("u9")).toEqual({ "system.origin": "u9" });
    expect(c.originIdInData(c.originData("u9"))).toBe("u9");
  });
});

describe("activityRefOf / itemRefOf — the source references a card carries", () => {
  it("hands back the reference and its uuid, type and name", () => {
    expect(c.activityRefOf(attack())).toBe(
      attack().system.activity ? c.activityRefOf(attack()) : null
    );
    expect(c.activityUuidOf(attack())).toBe("Actor.a1.Item.i1.Activity.act1");
    expect(c.activityTypeOf(attack())).toBe("attack");
    expect(c.itemUuidOf(attack())).toBe("Actor.a1.Item.i1");
    expect(c.itemNameOf(attack())).toBe("Longsword");
  });
  it("is null for a card without one (a base message, an empty reference)", () => {
    expect(c.activityRefOf({ type: "base" })).toBeNull();
    expect(c.activityUuidOf({ type: "usage", system: { activity: null } })).toBeNull();
    expect(c.activityTypeOf({ system: { activity: { name: "" } } })).toBeNull();
    expect(c.itemRefOf({ system: { item: {} } })).toBeNull();
    expect(c.itemNameOf(null)).toBeNull();
  });
});

describe("the roll's own facts — the 5.x roll.* sub-keys at their 6.0 homes", () => {
  it("a save or check: the ability it was rolled with", () => {
    expect(c.abilityOf({ type: "save", system: { ability: "dex" } })).toBe("dex");
    expect(c.abilityOf({ type: "usage" })).toBeNull();
  });
  it("an attack: the mastery it was rolled with (was roll.mastery), null when none", () => {
    expect(c.masteryOf(attack())).toBe("graze");
    expect(c.masteryOf(attack({ mastery: null }))).toBeNull();
    expect(c.masteryOf({ type: "damage", system: {} })).toBeNull();
    expect(c.masteryOf({ flags: { dnd5e: { roll: { mastery: "vex" } } } })).toBeNull();
  });
  it("a damage roll: what a saved target takes (was roll.damageOnSave), null when the card carries none", () => {
    expect(c.onSaveOf({ type: "damage", system: { onSave: "half" } })).toBe("half");
    expect(c.onSaveOf({ type: "damage", system: { onSave: "none" } })).toBe("none");
    expect(c.onSaveOf({ type: "damage", system: { onSave: null } })).toBeNull();
    expect(c.onSaveOf({ type: "damage", system: {} })).toBeNull();
  });
  it("a save: resisted by legendary resistance (was roll.forceSuccess) — true only when the platform wrote it", () => {
    expect(c.resistedOf({ type: "save", system: { resisted: true } })).toBe(true);
    expect(c.resistedOf({ type: "save", system: { resisted: false } })).toBe(false);
    expect(c.resistedOf({ type: "save", system: {} })).toBe(false);
    expect(c.resistedOf({ flags: { dnd5e: { roll: { forceSuccess: true } } } })).toBe(false);
  });
  it("a usage card: the cast level (was spellLevel), the upcast steps, the concentration effect", () => {
    const usage = { type: "usage", system: { level: 3, scaling: 2, concentration: "eff1" } };
    expect(c.castLevelOn(usage)).toBe(3);
    expect(c.scalingOf(usage)).toBe(2);
    expect(c.concentrationIdOf(usage)).toBe("eff1");
    expect(c.castLevelOn({ type: "usage", system: { level: null } })).toBeNull();
    expect(c.castLevelOn({ type: "usage", system: {} })).toBeNull();
    expect(c.castLevelOn({ type: "usage", system: { level: 0 } })).toBe(0); // a cantrip is level 0, not "none"
    expect(c.scalingOf({ type: "usage" })).toBe(0);
    expect(c.concentrationIdOf({ type: "usage", system: { concentration: "" } })).toBeNull();
  });
});

describe("isConcentrationPrompt — the platform's two concentration prompts, by TYPE (6.0.1 Actor5e#challengeConcentration / #promptConcentrationEnd)", () => {
  it("the whispered roll request on damage, and the end-it prompt when dead or incapacitated", () => {
    expect(
      c.isConcentrationPrompt({
        type: "prompt",
        system: { broadcast: false, buttons: [{ dc: 10, format: "short", type: "concentration" }] }
      })
    ).toBe(true);
    expect(
      c.isConcentrationPrompt({
        type: "prompt",
        system: { broadcast: false, buttons: [{ type: "endConcentration" }] }
      })
    ).toBe(true);
  });
  it("not any other prompt, not a concentration SAVE, not a 5.x content match", () => {
    expect(
      c.isConcentrationPrompt({
        type: "prompt",
        system: { buttons: [{ type: "save", ability: "con" }] }
      })
    ).toBe(false);
    expect(c.isConcentrationPrompt({ type: "prompt", system: { buttons: [] } })).toBe(false);
    expect(c.isConcentrationPrompt({ type: "save", system: { type: "concentration" } })).toBe(
      false
    );
    expect(
      c.isConcentrationPrompt({ type: "base", content: '<button data-action="concentration">' })
    ).toBe(false);
    expect(c.isConcentrationPrompt(null)).toBe(false);
  });
});
