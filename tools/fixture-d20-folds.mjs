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
import { connectSuite, loadEnv } from "./harness.mjs";

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
      secondWindUses: fighter.items.find(i => i.name === "Second Wind")?.system.uses?.value ?? null
    }
  };
});

console.log(JSON.stringify(out, null, 2));
await f.close?.();
process.exit(0);
