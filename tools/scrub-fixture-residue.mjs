// SCRUB THE FIXTURES' 6.0 RESIDUE — the AC override and the per-ability save bonus.
//
//   node tools/scrub-fixture-residue.mjs            report and clear
//   node tools/scrub-fixture-residue.mjs --check    report only
//
// WHY (the dnd5e 6.0 pass, phase 2, 2026-09-16): the suites force outcomes by writing the
// fixtures' AC and save bonuses, and restore them after. At 5.3.3 the restore was
// `ac.calc: "default"` and `abilities.<x>.bonuses.save: ""`; at 6.0 the forced value lives at
// `ac.override` and `abilities.<x>.save.roll.bonus`, and the OLD restore clears neither — so a
// battery run under the 5.x suites left the Ranger at AC 1 (smoke-superiority §5b) and the
// victim with a -30 that made a DC 30 save pass (smoke-maneuvers §I3). The suites write the
// 6.0 keys now; this clears what the old ones left behind, on every BF Test actor, and it is
// idempotent — run it whenever a suite reports an AC or a save that cannot be.
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

const check = process.argv.includes("--check");
const f = await connectSuite({ tag: "scrub-fixture-residue", watchdogMs: 120_000, env: loadEnv(), requireElect: false });
try {
  const out = await f.evaluate(async check => {
    const rows = [];
    for ( const actor of game.actors.filter(a => /^BF Test/i.test(a.name)) ) {
      const src = actor.system._source;
      const update = {};
      const found = [];
      if ( src.attributes?.ac?.override != null ) { found.push(`ac.override=${src.attributes.ac.override}`); update["system.attributes.ac.override"] = null; }
      for ( const [key, ab] of Object.entries(src.abilities ?? {}) ) {
        const legacy = ab?.bonuses?.save;
        const current = ab?.save?.roll?.bonus;
        if ( legacy ) { found.push(`${key}.bonuses.save=${legacy}`); update[`system.abilities.${key}.bonuses.-=save`] = null; }
        if ( current ) { found.push(`${key}.save.roll.bonus=${current}`); update[`system.abilities.${key}.save.roll.bonus`] = ""; }
      }
      if ( found.length ) {
        if ( !check ) await actor.update(update);
        rows.push(`${actor.name}: ${found.join(", ")}${check ? "" : " — cleared"}`);
      }
    }
    // An UNLINKED fixture token's synthetic actor at 0 HP (the emanation triggers' real damage,
    // smoke-emanations §7): a corpse every save demand rightly skips — 6f read empty for a day.
    for ( const scene of game.scenes ) {
      for ( const tok of scene.tokens.filter(t => t.actor && !t.actorLink && /^BF Test/i.test(game.actors.get(t.actorId)?.name ?? "")) ) {
        const hp = tok.actor.system.attributes?.hp;
        if ( !(hp?.max > 0) || (hp.value > 0) ) continue;
        if ( !check ) await tok.actor.update({ "system.attributes.hp.value": hp.max });
        rows.push(`${game.actors.get(tok.actorId)?.name} (token "${tok.name}" on ${scene.name}): hp ${hp.value}/${hp.max}${check ? "" : " — healed"}`);
      }
    }
    return rows;
  }, check);
  console.log(out.length ? out.join("\n") : "clean — no residue on any BF Test actor");
} finally {
  await disposeSafely(f, "scrub-fixture-residue");
}
