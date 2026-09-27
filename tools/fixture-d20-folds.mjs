// Build (or rebuild) the D20 FOLD fixtures in the sandbox — idempotent, safe to re-run.
// ⚠ The Inspired effect is a pure marker (no `changes`) whose `origin` points at the GRANTING
// BARD's item: the die size is `@scale.bard.inspiration` on the bard, so the origin is the mechanism.
//
// Run:  node tools/fixture-d20-folds.mjs
// ⚠ Disconnect the MCP bridge first.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "fixture-d20-folds";
const f = await connectSuite({ tag: TAG, watchdogMs: 180_000, requireElect: false, env: loadEnv() });

const out = await f.evaluate(async () => {
  const log = [];
  const fighter = game.actors.getName("BF Test Fighter");
  const bard = game.actors.getName("BF Test Bard");
  if (!fighter || !bard) return { error: "fixtures missing — create the PCs first" };

  const feat = bard.items.find(i => i.name === "Bardic Inspiration");
  if (!feat) return { error: "the bard has no Bardic Inspiration item" };

  // Idempotent: drop any previous copy first.
  const stale = fighter.effects.filter(e => e.name === "Inspired");
  if (stale.length) {
    await fighter.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
    log.push(`removed ${stale.length} stale Inspired effect(s)`);
  }

  // The shape the bard's own Inspire activity produces (read off phbbrdBardicInsp).
  const [effect] = await fighter.createEmbeddedDocuments("ActiveEffect", [{
    name: "Inspired",
    img: "icons/magic/light/hand-sparks-smoke-green.webp",
    origin: feat.uuid,                       // ⚠ the way back to the bard — the whole mechanism
    duration: { seconds: 3600 },
    transfer: false,
    disabled: false,
    changes: [],                             // a pure marker, exactly as the system ships it
    description: "<p>You have received Bardic Inspiration. Once within the next hour when you "
      + "fail a D20 Test, you can roll the Bardic Inspiration die and add the number rolled to "
      + "the d20, potentially turning the failure into a success.</p>"
  }]);
  log.push(`created Inspired on ${fighter.name}, origin ${feat.uuid}`);

  // Heroic Inspiration on: all three are spendable at once, so the LIST ORDER decides.
  await fighter.update({ "system.attributes.inspiration": true });
  log.push("set system.attributes.inspiration = true");

  // ⚠ Refill Second Wind: smoke-d20-folds §2 spends a use, and an empty pool fails `before - 1`.
  const secondWind = fighter.items.find(i => i.name === "Second Wind");
  if (secondWind && (secondWind.system.uses?.spent ?? 0) > 0) {
    await secondWind.update({ "system.uses.spent": 0 });
    log.push(`refilled Second Wind to ${secondWind.system.uses.max} uses`);
  }

  // §3 needs a real attack activity: a PHB Longsword, equipped, imported from the pack (never hand-built).
  const SWORD = "Compendium.dnd-players-handbook.equipment.Item.phbwepLongsword0";
  let sword = fighter.items.find(i => i.name === "Longsword");
  if (!sword) {
    const src = await fromUuid(SWORD);
    if (!src) return { error: `the PHB Longsword is not installed (${SWORD})` };
    [sword] = await fighter.createEmbeddedDocuments("Item", [src.toObject()]);
    log.push(`granted ${sword.name} from ${SWORD}`);
  }
  if (!sword.system.equipped) {
    await sword.update({ "system.equipped": true });
    log.push("equipped the Longsword");
  }
  const attackActivity = sword.system.activities?.find(a => a.type === "attack");

  // And a tool: smoke-d20-folds §4 asserts `dnd5e.rollToolCheck` fires (`rollToolV2` does not exist).
  const TOOLS = "Compendium.dnd-players-handbook.equipment.Item.phbtulSmithsTool";
  let tool = fighter.items.find(i => i.type === "tool");
  if (!tool) {
    const src = await fromUuid(TOOLS);
    if (!src) return { error: `the PHB Smith's Tools are not installed (${TOOLS})` };
    [tool] = await fighter.createEmbeddedDocuments("Item", [src.toObject()]);
    log.push(`granted ${tool.name} from ${TOOLS}`);
  }

  // And the Battle Master: the rescue view's receipt needs ONE missed attack carrying both a
  // `precision` and a `d20fold` stamp (a Battle Master holding a Bardic die).
  // ⚠ Three items and a level, in order: the superiority die and pool are ScaleValues on the
  // SUBCLASS, derived from the class level; a missing link fails SILENTLY (die "0", no pool,
  // nothing stamps), so all four derived numbers are REPORTED below.
  // ⚠ The registry's `level-up-pc` does not persist the subclass grants (only `system.levels`
  // reaches the database), so the grants are made here from the premium pack.
  const LEVEL = 3;                                  // Battle Master's own prerequisite level
  const klass = fighter.itemTypes.class.find(c => c.system.identifier === "fighter");
  if (!klass) return { error: "BF Test Fighter has no Fighter class item" };
  if (klass.system.levels < LEVEL) {
    await klass.update({ "system.levels": LEVEL });
    log.push(`set Fighter to level ${LEVEL} — the level the superiority scale reads`);
  }
  const GRANTS = [
    ["Battle Master", "Compendium.dnd-players-handbook.classes.Item.phbftrBattleMast"],
    ["Combat Superiority", "Compendium.dnd-players-handbook.classes.Item.phbftrCombatSupe"],
    ["Precision Attack", "Compendium.dnd-players-handbook.classes.Item.phbmnvPrecisionA"]
  ];
  // ⚠ The grant must carry `_stats.compendiumSource` (a bare `toObject()` does not): dnd5e's
  // prepareData remaps a consumption target stored as a compendium UUID to the owned copy by
  // matching that source; without it the pool reads zero.
  for (const [name, uuid] of GRANTS) {
    const have = fighter.items.find(i => i.name === name);
    if (have) {
      // Heal a copy granted without the stamp.
      if (have._stats?.compendiumSource !== uuid) {
        await have.update({ "_stats.compendiumSource": uuid });
        log.push(`stamped ${name} with its compendium source`);
      }
      continue;
    }
    const src = await fromUuid(uuid);
    if (!src) return { error: `${name} is not installed (${uuid})` };
    const data = src.toObject();
    foundry.utils.setProperty(data, "_stats.compendiumSource", uuid);
    const [granted] = await fighter.createEmbeddedDocuments("Item", [data]);
    log.push(`granted ${granted.name} from ${uuid}`);
  }
  const precision = fighter.items.find(i => i.name === "Precision Attack");

  // ⚠ Refill the superiority pool: an empty pool stamps nothing (`usableManeuver` gates on it).
  const pool = fighter.items.find(i => i.name === "Combat Superiority");
  if (pool && ((pool.system.uses?.spent ?? 0) > 0)) {
    await pool.update({ "system.uses.spent": 0 });
    log.push(`refilled ${pool.name} to ${pool.system.uses.value} dice`);
  }
  const precisionActivity = precision?.system.activities?.contents?.[0];
  const precisionDie = precisionActivity?.roll?.formula
    ? (await new Roll(precisionActivity.roll.formula, fighter.getRollData()).evaluate()).formula
    : null;

  // ⚠ Restore the target: the suite's applied damage leaves the foe at 0 HP (and Graze then skips
  // a dead target). Heal it and clear any forced AC; sections pin their own.
  const foeToken = game.scenes.active?.tokens.find(t => t.actor && (t.actor.type === "npc"));
  if (foeToken) {
    const foe = foeToken.actor;
    const src = foe.system._source.attributes.ac;
    if ((src.calc === "flat") || (foe.system.attributes.hp.value < foe.system.attributes.hp.max)) {
      await foe.update({
        "system.attributes.ac.override": null,
        "system.attributes.hp.value": foe.system.attributes.hp.max
      });
      log.push(`restored ${foeToken.name}: full HP, default AC`);
    }
  }

  // Prove the cross-actor read the module will perform.
  const originItem = await fromUuid(effect.origin);
  const resolvedBard = originItem?.actor;
  const scale = resolvedBard
    ? foundry.utils.getProperty(resolvedBard.getRollData(), "scale.bard.inspiration")
    : null;

  return {
    log,
    check: {
      effectId: effect.id,
      origin: effect.origin,
      bardResolvesFromOrigin: resolvedBard?.name ?? null,
      inspirationScale: scale ?? null,
      dieFace: scale?.die ?? scale ?? null,
      inspiration: fighter.system.attributes.inspiration,
      secondWindUses: fighter.items.find(i => i.name === "Second Wind")?.system.uses?.value ?? null,
      weapon: sword?.name ?? null,
      attackActivity: attackActivity?.id ?? null,
      // ⚠ The superiority chain's four links, each silent on its own: die "0" without the subclass,
      // 0 dice without the level, and `precisionPoolIsOwn` the compendium-UUID remap.
      fighterLevel: klass.system.levels,
      maneuver: precision?.name ?? null,
      superiorityDie: precisionDie,
      superiorityDice: pool ? (pool.system.uses?.value ?? null) : null,
      precisionPoolIsOwn: !!fighter.items.get(
        precisionActivity?.consumption?.targets?.[0]?.target ?? ""),
      tool: tool?.name ?? null,
      // Reported: which field carries the identifier `rollToolCheck` wants.
      toolBaseItem: tool?.system?.type?.baseItem ?? null,
      toolTypeValue: tool?.system?.type?.value ?? null,
      toolIdentifier: tool?.identifier ?? null
    }
  };
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(0);
