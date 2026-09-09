// Read-only probe (2026-09-09, the metamagic pass, Stage 3): which spells in the 2024 packs
// Twinned Spell fits, by the read the module uses — the SOURCE target count is a formula over
// the cast's level (`@item.level - 1` on Hold Person) and the spell has no area. Printed against
// the user's own list (2026-09-09) so the read is checked, not trusted. Nothing is written.
//
//   node tools/probe-twinnable.mjs
// ⚠ Disconnect the MCP bridge first (the sole-GM preflight).
import { connectSuite, disposeSafely, loadEnv } from "./harness.mjs";

// The user's list as ruled 2026-09-09: Chain Lightning in; Magic Missile and Scorching Ray out ("the extra is a dart/ray").
const USER_LIST = ["Chain Lightning", "Charm Person", "Jump", "Longstrider", "Blindness/Deafness", "Enhance Ability", "Hold Person", "Invisibility",
  "Spider Climb", "Tasha's Mind Whip", "Fly", "Gaseous Form", "Banishment", "Charm Monster", "Freedom of Movement", "Hold Monster",
  "Animal Friendship", "Bane", "Bless", "Command", "Heroism"];
const f = await connectSuite({ tag: "probe-twinnable", watchdogMs: 300_000, requireElect: false, env: loadEnv() });
const out = await f.evaluate(async () => {
  const decide = await import("/modules/fvtt-mod-battleflow/scripts/decide/metamagic.js");
  const reg = await import("/modules/fvtt-mod-battleflow/scripts/decide/registry.js");
  const rows = [];
  for (const pack of game.packs) {
    if (pack.documentName !== "Item") continue;
    const id = pack.metadata.id;
    if (!/players-handbook\.spells|dnd5e\.spells24/.test(id)) continue;
    const index = await pack.getIndex({ fields: ["type", "system.target", "system.level"] });
    for (const e of index) {
      if (e.type !== "spell") continue;
      const count = e.system?.target?.affects?.count ?? null;
      const template = e.system?.target?.template?.type ?? "";
      const fits = !template && decide.scalesTargetsFrom(count, { name: e.name, exceptions: reg.TWINNED_EXCEPTIONS });
      rows.push({ pack: id, name: e.name, level: e.system?.level ?? null, count: String(count ?? ""), template, fits });
    }
  }
  return rows;
});
const fits = out.filter(r => r.fits).map(r => r.name);
const uniq = [...new Set(fits)].sort();
console.log(`the read fits ${uniq.length} spells:\n  ${uniq.join(", ")}`);
const missing = USER_LIST.filter(n => !uniq.some(u => u.toLowerCase() === n.toLowerCase()));
const extra = uniq.filter(u => !USER_LIST.some(n => n.toLowerCase() === u.toLowerCase()));
console.log(`\nagainst the user's list of ${USER_LIST.length}:\n  in the list, NOT read as twinnable: ${missing.join(", ") || "none"}\n  read as twinnable, NOT in the list: ${extra.join(", ") || "none"}`);
for (const n of missing) { const r = out.find(x => x.name.toLowerCase() === n.toLowerCase()); if (r) console.log(`    ${n}: count="${r.count}" template="${r.template}"`); }
await disposeSafely(f, "probe-twinnable");
process.exit(0);
