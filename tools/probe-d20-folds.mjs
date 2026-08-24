// Live forensic for the D20 FOLD content assumptions (v1.23.0). Prints, asserts nothing.
//
// ⚠ This exists because three of the scoping facts can ONLY be read from a prepared, live
// actor, and every one of them is a silent-death risk if it is wrong:
//
//   1. Tactical Mind's consumption target is a COMPENDIUM UUID on disk. dnd5e re-links it to
//      the actor's own Second Wind in prepareData (Activity#_remapConsumptionTarget, via
//      actor.sourcedItems). If that remap does not happen, `actor.items.get(target)` finds
//      nothing and the fold offers NOTHING FOREVER with no error raised.
//   2. Heroic Inspiration is `system.attributes.inspiration`, a bare boolean — confirm the
//      path exists on a character and is writable.
//   3. A Bardic die's size lives on the GRANTING BARD as @scale.bard.inspiration, reachable
//      only by walking the Inspired effect's `origin` back to the bard.
//
// Run:  node tools/probe-d20-folds.mjs
// ⚠ Read HANDOFF.md's operational rules first: disconnect the bridge, one suite at a time.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const TAG = "probe-d20-folds";

const f = await connectSuite({ tag: TAG, watchdogMs: 180_000, requireElect: false, env: loadEnv() });

const out = await f.evaluate(async () => {
  const report = {};
  const byName = name => game.actors.getName(name);

  /* --- 1: the consumption remap --------------------------------------------------------- */
  const fighter = byName("BF Test Fighter");
  if (!fighter) report.fighter = { error: "no actor named 'BF Test Fighter'" };
  else {
    const tm = fighter.items.find(i => i.name === "Tactical Mind");
    const sw = fighter.items.find(i => i.name === "Second Wind");
    const activity = tm?.system.activities?.contents?.[0];
    const target = activity?.consumption?.targets?.[0];
    const stored = tm?.toObject()?.system?.activities?.[activity?.id]?.consumption?.targets?.[0]?.target;
    report.fighter = {
      hasTacticalMind: !!tm,
      hasSecondWind: !!sw,
      secondWindId: sw?.id ?? null,
      secondWindUses: sw ? { value: sw.system.uses?.value, max: sw.system.uses?.max } : null,
      activityType: activity?.type ?? null,
      rollFormula: activity?.roll?.formula ?? null,
      storedTarget: stored ?? null,
      preparedTarget: target?.target ?? null,
      // THE ANSWER: did the remap fire, and does the module's own lookup succeed?
      remapped: !!target?.target && (target.target === sw?.id),
      lookupSucceeds: !!(target?.target && fighter.items.get(target.target)),
      sourcedItemsHasUuid: !!fighter.sourcedItems?.get(stored)?.first?.()
    };
  }

  /* --- 2: the heroic boolean ------------------------------------------------------------ */
  const anyPC = byName("BF Test Fighter") ?? game.actors.find(a => a.type === "character");
  report.heroic = {
    actor: anyPC?.name ?? null,
    path: "system.attributes.inspiration",
    present: anyPC ? ("inspiration" in (anyPC.system.attributes ?? {})) : false,
    value: anyPC?.system?.attributes?.inspiration ?? null,
    type: typeof anyPC?.system?.attributes?.inspiration
  };

  /* --- 3: the bard's scale value -------------------------------------------------------- */
  const bard = byName("BF Test Bard");
  report.bardic = bard
    ? {
        actor: bard.name,
        scale: foundry.utils.getProperty(bard.getRollData(), "scale.bard.inspiration") ?? null,
        hasFeat: !!bard.items.find(i => i.name === "Bardic Inspiration")
      }
    : { error: "no actor named 'BF Test Bard' yet" };

  /* --- 4: what the module itself thinks it can spend ------------------------------------- */
  const api = game.modules.get("fvtt-mod-battleflow")?.api;
  report.module = {
    active: !!game.modules.get("fvtt-mod-battleflow")?.active,
    version: game.modules.get("fvtt-mod-battleflow")?.version ?? null,
    d20FoldEntries: api?.registries?.d20Folds?.() ?? null,
    d20FoldAsk: game.settings.get("fvtt-mod-battleflow", "d20FoldAsk")
  };

  return report;
});

console.log(JSON.stringify(out, null, 2));
await disposeSafely(f, TAG);
process.exit(0);
