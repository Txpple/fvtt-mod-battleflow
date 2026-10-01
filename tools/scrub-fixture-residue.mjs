// Scrub the fixtures' residue: the AC override and the per-ability save bonus, on every BF Test
// actor. Suites force outcomes at `ac.override` and `abilities.<x>.save.roll.bonus`; an older
// restore that cleared the pre-6.0 keys left these standing. Idempotent: run it whenever a suite
// reports an AC or a save that cannot be.
//
//   node tools/scrub-fixture-residue.mjs            report and clear
//   node tools/scrub-fixture-residue.mjs --check    report only
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
      // A killed run's ward pools (Bastion of Law's "Warded by Law (N)") absorb every later hit: gone.
      const pools = actor.effects.filter(e => e.getFlag("fvtt-mod-battleflow", "wardPool"));
      if ( pools.length ) {
        if ( !check ) await actor.deleteEmbeddedDocuments("ActiveEffect", pools.map(e => e.id));
        rows.push(`${actor.name}: ${pools.length} ward pool effect(s) (${pools.map(e => e.name).join(", ")})${check ? "" : " — removed"}`);
      }
    }
    // An unlinked fixture token's synthetic actor at 0 HP is a corpse every save demand skips: heal it.
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
