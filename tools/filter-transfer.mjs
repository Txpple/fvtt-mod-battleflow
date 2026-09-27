// The universal transfer-flag pass, offline over scan-corpus.mjs's JSON: which pack effects are
// the Goaded shape — `transfer: true` (a passive on the WIELDER) and ENABLED, on an item whose
// activity aims at someone else? Then the wielder carries the effect, and the first expiry or tidy
// deletes the item's only copy, leaving the save nothing to apply (NOTES §2).
// ⚠ transfer:true + DISABLED is dnd5e's convention for a self-buff the activity toggles on (Rage,
// Bladesong, Innate Sorcery): correct, printed only under --all.
//
// Usage: node tools/scan-corpus.mjs out.json && node tools/filter-transfer.mjs out.json [--all]
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const src = process.argv.find((a, i) => i >= 2 && !a.startsWith('--')) || join(tmpdir(), 'battleflow-corpus-raw.json');
const all = process.argv.includes('--all');
const { rows, dnd5e, foundry } = JSON.parse(readFileSync(src, 'utf8'));
const OUTWARD = new Set(['creature', 'ally', 'enemy', 'any', 'space', 'object']);
const pack = r => r.pack.replace(/^dnd5e\./, '');
const dur = e => `${e.duration.seconds ?? ''}s/${e.duration.rounds ?? ''}r/${e.duration.turns ?? ''}t`;
const act = a => `${a.type}${a.name ? `(${a.name})` : ''}@${a.targetType || '-'}`;

console.log(`foundry ${foundry} dnd5e ${dnd5e}; ${rows.length} corpus rows`);
console.log('\n## THE GOADED SHAPE — transfer:true, ENABLED, linked by an activity aimed at someone else');
let hits = 0;
for (const r of rows) {
  const live = r.effects.filter(e => e.transfer && !e.disabled);
  if (!live.length) continue;
  const outward = r.activities.filter(a => a.effects.length && OUTWARD.has(a.targetType));
  if (!outward.length) continue;
  hits++;
  console.log(`- [${pack(r)}] ${r.name}: ${outward.map(act).join(' ')}`);
  for (const e of live) console.log(`    transfer+enabled: ${e.name} dur=${dur(e)} changes=${e.changes.length}`);
}
console.log(`hits: ${hits}`);

if (all) {
  console.log('\n## FOR THE RECORD — every transfer:true effect any activity links (disabled = the self-toggle convention)');
  let n = 0;
  for (const r of rows) {
    const t = r.effects.filter(e => e.transfer);
    const linking = r.activities.filter(a => a.effects.length);
    if (!t.length || !linking.length) continue;
    n++;
    console.log(`- [${pack(r)}] ${r.name}: ${linking.map(act).join(' ')}`);
    for (const e of t) console.log(`    ${e.disabled ? 'disabled' : 'ENABLED '} ${e.name} dur=${dur(e)} changes=${e.changes.length}`);
  }
  console.log(`items: ${n}`);
}
