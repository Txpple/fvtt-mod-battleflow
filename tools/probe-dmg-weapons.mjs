// Measure the DMG's crit-rider and enchanted weapons AS A PLAYER HOLDS THEM: each template's enchantment is dropped
// onto a base weapon on BF Test PC Attacker (the item sheet's own drop path, riders and all), the result read back,
// then removed. Writes to the sandbox; run with no other client connected.
//   node tools/probe-dmg-weapons.mjs <out.json>
import { writeFileSync } from "node:fs";
import { Foundry, loadEnv } from "fvtt-mcp-dnd5e/client";
import { disposeSafely } from "./harness.mjs";
import { foundryConfig, preflightSoleGM } from "./target.mjs";

const [outFile] = process.argv.slice(2);
if (!outFile) { console.error("usage: node tools/probe-dmg-weapons.mjs <out.json>"); process.exit(2); }
setTimeout(() => { console.error("[probe-dmg-weapons] WATCHDOG 240s"); process.exit(3); }, 240_000);
const env = loadEnv();
const f = new Foundry(foundryConfig(env));
await f.connect();
await preflightSoleGM(f, { env });

// [template id, base weapon id in the PHB equipment pack]
const PAIRS = [
  ["dmgVorpalSword00", "phbwepLongsword0"], ["dmgSwordOfSharpn", "phbwepLongsword0"], ["dmgSwordOfLifeSt", "phbwepLongsword0"],
  ["dmgNineLivesStea", "phbwepLongsword0"], ["dmgHammerOfThund", "phbwepWarhammer0"], ["dmgSilveredWeapo", "phbwepLongsword0"],
  ["dmgAdamantineWea", "phbwepLongsword0"], ["dmgSwordOfWoundi", "phbwepLongsword0"], ["dmgLuckBlade0000", "phbwepLongsword0"],
  ["dmgMoonblade0000", "phbwepLongsword0"]
];

const out = await f.evaluate(async ({ pairs }) => {
  const actor = game.actors.getName("BF Test PC Attacker");
  if ( !actor ) return { error: "no BF Test PC Attacker" };
  const rows = [];
  for ( const [tid, bid] of pairs ) {
    const template = await fromUuid(`Compendium.dnd-dungeon-masters-guide.equipment.Item.${tid}`);
    const base = await fromUuid(`Compendium.dnd-players-handbook.equipment.Item.${bid}`);
    const [weapon] = await actor.createEmbeddedDocuments("Item", [base.toObject()]);
    const row = { template: template.name };
    try {
      const enchant = template.system.activities.getByType("enchant")[0];
      const profiles = (enchant?.effects ?? []).map(p => ({ id: p._id, riders: { activity: [...(p.riders?.activity ?? [])], effect: [...(p.riders?.effect ?? [])], item: [...(p.riders?.item ?? [])] } }));
      row.profiles = profiles.map(p => ({ ...p, name: template.effects.get(p.id)?.name,
        riderActivities: p.riders.activity.map(id => template.system.activities.get(id)?.name),
        riderEffects: p.riders.effect.map(id => template.effects.get(id)?.name) }));
      // The sheet's drop, for the FIRST profile (Moonblade's runes: every profile, as a DM would add them).
      const drops = (template.name === "Moonblade") ? profiles : profiles.slice(0, 1);
      for ( const p of drops ) {
        const effect = template.effects.get(p.id);
        const effectData = effect.toObject();
        effectData.system.origin.item ??= template.uuid;
        if ( effect.system.isOnActivity ) effectData.transfer = true;
        await ActiveEffect.create(effectData, { parent: weapon, keepOrigin: true,
          dnd5e: { enchantmentProfile: effect.id, activityId: enchant.id } });
      }
      await new Promise(r => setTimeout(r, 400));
      const w = actor.items.get(weapon.id);
      row.weapon = {
        name: w.name, magicalBonus: w.system.magicalBonus, properties: [...(w.system.properties ?? [])],
        identifier: w.system.identifier, attuned: w.system.attuned, attunement: w.system.attunement,
        criticalThresholds: [...w.system.activities].filter(a => a.type === "attack").map(a => [a.name, a.attack?.critical?.threshold ?? null, a.damage?.critical?.bonus ?? null]),
        activities: [...w.system.activities].map(a => `${a.type}:${a.name}${a.flags?.dnd5e?.dependentOn ? " (rider)" : ""}`),
        effects: w.effects.map(e => ({ name: e.name, type: e.type, applied: !!e.isAppliedEnchantment, origin: e.origin ?? null,
          sysOrigin: e.system?.origin ?? null, disabled: e.disabled, transfer: e.transfer, dependentOn: e.flags?.dnd5e?.dependentOn ?? null })),
        uses: { max: w.system.uses?.max, spent: w.system.uses?.spent }
      };
    } catch(err) {
      row.error = String(err?.message ?? err);
    } finally {
      await actor.deleteEmbeddedDocuments("Item", [weapon.id]).catch(() => {});
    }
    rows.push(row);
  }
  return rows;
}, { pairs: PAIRS });

writeFileSync(outFile, JSON.stringify(out, null, 2));
for ( const r of (Array.isArray(out) ? out : [out]) ) {
  if ( r.error ) { console.log(`${r.template ?? "?"}: ERROR ${r.error}`); continue; }
  console.log(`== ${r.template} -> "${r.weapon.name}" bonus=${r.weapon.magicalBonus} props=${r.weapon.properties.join(",")} id=${r.weapon.identifier} attune=${r.weapon.attunement}/${r.weapon.attuned}`);
  console.log(`   profiles: ${JSON.stringify(r.profiles.map(p => [p.name, p.riderActivities, p.riderEffects]))}`);
  console.log(`   crit: ${JSON.stringify(r.weapon.criticalThresholds)}  uses: ${JSON.stringify(r.weapon.uses)}`);
  console.log(`   activities: ${r.weapon.activities.join(" | ")}`);
  console.log(`   effects: ${r.weapon.effects.map(e => `${e.type}:${e.name}${e.applied ? "[applied]" : ""}${e.dependentOn ? "[rider]" : ""}${e.disabled ? "[off]" : ""}`).join(" | ")}`);
}
await disposeSafely(f, "probe-dmg-weapons");
process.exit(0);
