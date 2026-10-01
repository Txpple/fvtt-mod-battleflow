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
    // Features the suites LEND to a fixture and take back at the section's end — a killed run leaves them; no fixture owns one.
    const STRAY_LENDS = new Set(["Spell Resistance", "Superior Hunter's Defense", "Unbreakable Majesty", "Leading Evasion", "Peerless Skill",
      "Soul of Vengeance", "Vow of Enmity", "Smite of Protection", "Oceanic Gift", "Wrath of the Sea", "Improved Blessed Strikes",
      "Perfect Focus", "Uncanny Metabolism", "Monk's Focus", "Disciplined Survivor", "Greater Portent", "Relentless Hunter", "Hurl Through Hell",
      "Battle Magic", "Trance of Order", "Controlled Chaos", "Searing Vengeance", "Relentless Rage", "Undying Sentinel", "Rage of the Gods",
      "Power of the Wilds", "Lunar Form", "Bestial Fury", "Create Thrall", "Superior Hunter's Prey", "Stalker's Flurry", "Versatile Trickster",
      "Bastion of Law", "Projected Ward", "Arcane Ward", "Circle of the Sea"]);   // never a CLASS: the fixtures own theirs (the Paladin lost its class once, 2026-10-01)
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
      // An ORPHANED effect: not transferred, its origin a document that no longer exists (a lent spell's Mage Armor landed
      // on the caster and the spell unlent; a lent feature's effect). Thirty-one Mage Armors stood on the Sorcerer (2026-10-01).
      const orphans = actor.effects.filter(e => !e.transfer && !pools.includes(e) && e.origin && !(e.statuses?.size)
        && (() => { try { return !fromUuidSync(e.origin); } catch { return true; } })());
      const gone = [...pools, ...orphans];
      if ( gone.length ) {
        if ( !check ) await actor.deleteEmbeddedDocuments("ActiveEffect", gone.map(e => e.id));
        rows.push(`${actor.name}: ${pools.length} ward pool(s), ${orphans.length} orphaned effect(s) (${[...new Set(gone.map(e => e.name))].join(", ")})${check ? "" : " — removed"}`);
      }
      // A lent PHB feature a killed run never took back: a same-name DUPLICATE beyond the first, or a feature on the
      // STRAY list (lent by a suite, owned by no fixture). The first copy of a duplicate stays: it may be the fixture's own.
      const lentPHB = actor.items.filter(i => String(i._stats?.compendiumSource ?? "").startsWith("Compendium.dnd-players-handbook.") && ["feat", "class", "subclass", "spell"].includes(i.type));
      const seen = new Set();
      const strays = [];
      for ( const item of lentPHB ) {
        if ( seen.has(item.name) || STRAY_LENDS.has(item.name) ) strays.push(item);
        seen.add(item.name);
      }
      if ( strays.length ) {
        if ( !check ) await actor.deleteEmbeddedDocuments("Item", strays.map(i => i.id));
        rows.push(`${actor.name}: ${strays.length} stray lent item(s) (${strays.map(i => i.name).join(", ")})${check ? "" : " — removed"}`);
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
