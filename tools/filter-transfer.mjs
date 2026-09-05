// The universal transfer-flag pass (BACKLOG, 2026-09-04 — user: "a universal pass on that").
// Offline, over scan-corpus.mjs's JSON. Which pack effects are the Goaded shape: flagged
// `transfer: true` (a passive on the WIELDER) and ENABLED, on an item whose activity aims at
// someone other than the wielder? That is the shape that lost the 2026-09-04 walk an afternoon
// (NOTES §2): the wielder's sheet carried the effect, the first expiry or hand tidy deleted the
// item's only copy, and the save had nothing to apply.
//
// ⚠ transfer:true + DISABLED is NOT that shape — it is dnd5e's own convention for a self-buff
// the activity toggles on (Rage, Bladesong, Innate Sorcery: 70 items at 5.3.3). Those are
// correct and are printed only under --all for the record.
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
