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
