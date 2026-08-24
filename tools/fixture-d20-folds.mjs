// Build (or rebuild) the D20 FOLD fixtures in the sandbox — idempotent, safe to re-run.
//
// ⚠ The Inspired effect is created HERE rather than through manage-effect because the real one
// carries NO `changes` at all — it is a pure marker — and it must carry an `origin` pointing at
// the GRANTING BARD's own item. That origin is the whole mechanism on the bardic side: the die
// size is `@scale.bard.inspiration` on the bard, so the recipient's copy is worthless without a
// way back. A fixture that fakes the origin would test nothing.
//
// Run:  node tools/fixture-d20-folds.mjs
// ⚠ Disconnect the MCP bridge first (HANDOFF.md operational rules).
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

  // Idempotent: drop any previous fixture copy before making a fresh one.
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

  // Heroic Inspiration on, so all three are spendable at once and the LIST ORDER decides.
  await fighter.update({ "system.attributes.inspiration": true });
  log.push("set system.attributes.inspiration = true");

  // ⚠ REFILL SECOND WIND. smoke-d20-folds §2 spends a use to prove the consumption is real, and
  // uses do NOT come back on their own — two runs take it to zero and the third asserts
  // `after === before - 1` against a pool that cannot go lower, so the suite starts failing for
  // a reason that has nothing to do with the code. A fixture script that is not idempotent is a
  // slow-acting false failure.
  const secondWind = fighter.items.find(i => i.name === "Second Wind");
  if (secondWind && (secondWind.system.uses?.spent ?? 0) > 0) {
    await secondWind.update({ "system.uses.spent": 0 });
    log.push(`refilled Second Wind to ${secondWind.system.uses.max} uses`);
  }

  // ⚠ §3 NEEDS A REAL ATTACK ACTIVITY, and the fighter shipped without a weapon — which is why
  // that section had no assertion for a day: the attack path was table-verified by a human
  // holding a longsword and unreachable from the suite. A PHB Longsword, equipped, imported from
  // the premium pack rather than hand-built (DESIGN N1 — the module never learns an item's
  // shape, so neither does its fixture). Idempotent like everything else here.
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

  // ⚠ AND A TOOL, for the same reason the Longsword is here: `smoke-d20-folds` §4 asserts that
  // `dnd5e.rollToolCheck` FIRES, and it skipped for want of anything to roll — which showed up
  // as a never-fired line in the D11 coverage report. The tool hook is the one whose NAME the
  // module got wrong in v1.23.0 (`rollToolV2` does not exist), so leaving it unexercised is
  // leaving exactly the wrong hook untested.
  const TOOLS = "Compendium.dnd-players-handbook.equipment.Item.phbtulSmithsTool";
  let tool = fighter.items.find(i => i.type === "tool");
  if (!tool) {
    const src = await fromUuid(TOOLS);
    if (!src) return { error: `the PHB Smith's Tools are not installed (${TOOLS})` };
    [tool] = await fighter.createEmbeddedDocuments("Item", [src.toObject()]);
    log.push(`granted ${tool.name} from ${TOOLS}`);
  }

  // ⚠ AND THE BATTLE MASTER — the RESCUE VIEW's receipt needs ONE message carrying BOTH rescue
  // flags: a `precision` stamp from maneuvers.js and a `d20fold` stamp from d20-folds.js on the
  // same missed attack. That is a Battle Master holding a Bardic die, and nothing in this world
  // was one: the fighter was a plain level-2 Fighter with no maneuvers at all.
  //
  // ⚠ THIS IS THREE ITEMS AND A LEVEL, IN THIS ORDER, AND THE ORDER IS THE WHOLE MECHANISM.
  // Precision Attack rolls `@scale.battle-master.superiority.die` and draws on a pool sized
  // `@scale.battle-master.superiority.number` — BOTH numbers are ScaleValue advancement on the
  // SUBCLASS, derived from the class's level. Miss any link and the chain fails SILENTLY, in
  // the exact shape of the bardic cross-actor trap: the die formula collapses to "0", the pool
  // resolves to no uses, `usableManeuver` returns null, nothing stamps, and a suite that never
  // received its offer passes every assertion it never reached. Green by absence. So all four
  // derived numbers are REPORTED below — a broken chain fails HERE, at the seed.
  //
  // ⚠ THE REGISTRY'S `level-up-pc` WAS TRIED FIRST AND DOES NOT PERSIST (measured 2026-08-24,
  // twice): it reports success and the subclass, its granted features and the HP bump live only
  // in the CALLING client's memory — the class `system.levels` write is the one part that
  // reaches the database. Read the actor from a second session and the Battle Master is gone.
  // So the grants are made here, from the premium pack, the same way the Longsword is. The
  // CONTENT is authentic in every case; only the class level is a plain number, and a plain
  // number is not content.
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
  // ⚠ AND THE GRANT MUST CARRY `_stats.compendiumSource`, WHICH `toObject()` DOES NOT. This is
  // the fifth silent link and it cost a run to find: Precision Attack's consumption target is
  // stored as the COMPENDIUM UUID of Combat Superiority, and dnd5e's prepareData rewrites it to
  // the actor's own copy by matching that UUID against each owned item's compendium source. An
  // item created from a bare `toObject()` has none, so the match fails, the target stays a UUID
  // `actor.items.get()` can never find, and `usableManeuver` reads a pool of zero. Measured
  // side by side: Tactical Mind (granted by advancement) prepares its target to the actor's own
  // Second Wind id; this one prepared to the raw UUID until the stamp was added.
  for (const [name, uuid] of GRANTS) {
    const have = fighter.items.find(i => i.name === name);
    if (have) {
      // Heal a copy granted before the stamp was understood — idempotent, like everything here.
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

  // ⚠ REFILL THE SUPERIORITY POOL, for the Second Wind reason one degree worse. A precision
  // spend really takes a die and nothing hands it back, so four runs empty the pool — and the
  // fifth stamps NOTHING, because `usableManeuver` gates on exactly this number.
  const pool = fighter.items.find(i => i.name === "Combat Superiority");
  if (pool && ((pool.system.uses?.spent ?? 0) > 0)) {
    await pool.update({ "system.uses.spent": 0 });
    log.push(`refilled ${pool.name} to ${pool.system.uses.value} dice`);
  }
  const precisionActivity = precision?.system.activities?.contents?.[0];
  const precisionDie = precisionActivity?.roll?.formula
    ? (await new Roll(precisionActivity.roll.formula, fighter.getRollData()).evaluate()).formula
    : null;

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
      // ⚠ Reported, never assumed — the four links of the superiority chain, each of which
      // fails silently on its own: `superiorityDie` reads "0" instead of "1d8" without the
      // subclass, `superiorityDice` reads 0 instead of 4 without the level, and
      // `precisionPoolIsOwn` is the Tactical Mind remap again — the stored consumption target
      // is a COMPENDIUM UUID and only dnd5e's prepareData turns it into the actor's own
      // Combat Superiority id. `usableManeuver` gates on the last two.
      fighterLevel: klass.system.levels,
      maneuver: precision?.name ?? null,
      superiorityDie: precisionDie,
      superiorityDice: pool ? (pool.system.uses?.value ?? null) : null,
      precisionPoolIsOwn: !!fighter.items.get(
        precisionActivity?.consumption?.targets?.[0]?.target ?? ""),
      tool: tool?.name ?? null,
      // ⚠ Reported, not assumed: `rollToolCheck` wants an identifier and which field carries it
      // is exactly the kind of thing this repo has been wrong about. Read it here, then use it.
      toolBaseItem: tool?.system?.type?.baseItem ?? null,
      toolTypeValue: tool?.system?.type?.value ?? null,
      toolIdentifier: tool?.identifier ?? null
    }
  };
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(0);
