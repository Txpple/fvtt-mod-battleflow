// Survey every DAMAGE RIDER in the world's compendia (a damage roll pressed separately from the
// thing that granted it: Hunter's Mark's "Bonus Mark Damage", Hex's), so the rider table is built
// from what 5e 2024 ships.
// ⚠ The signature is on the ACTIVITY, never the item: a "damage" activity whose activation is
// overridden to nothing (`override === true`, empty `type`). Casting time stays on the item.
// Two passes: the index finds candidates; getDocument() pulls their effects (the target's marker),
// which the index cannot carry. Writes raw JSON for classification. Usage:
//   node tools/scan-riders.mjs [outfile.json]
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig } from './target.mjs';
import { disposeSafely } from './harness.mjs';

const env = loadEnv();
setTimeout(() => { console.error('[scan] WATCHDOG 600s'); process.exit(3); }, 600_000);

const f = new Foundry(foundryConfig(env));
console.log('[scan] connecting…');
await f.connect();
console.log('[scan] connected');

const result = await f.evaluate(async () => {
  const strip = html => (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const rows = [];
  const errors = [];
  const packStats = [];

  // Quote a damage part verbatim: a custom formula carries shapes like min3.
  const partOf = p => ({
    formula: p?.custom?.enabled ? (p.custom.formula || '') : `${p?.number ?? ''}d${p?.denomination ?? ''}`,
    custom: !!p?.custom?.enabled,
    bonus: p?.bonus || '',
    types: Array.from(p?.types ?? []),
    scaling: p?.scaling?.mode || '',
  });

  for (const pack of game.packs) {
    if (pack.documentName !== 'Item') continue;
    if (pack.metadata.id.startsWith('JB2A') || pack.metadata.id.startsWith('dnd5e-animations')) continue;
    try {
      const index = await pack.getIndex({
        fields: ['type', 'system.activities', 'system.identifier', 'system.level',
          'system.method', 'system.properties', 'system.description.value'],
      });
      const candidates = [];
      for (const entry of index) {
        const activities = entry.system?.activities ?? {};
        const list = Array.isArray(activities) ? activities : Object.values(activities);
        // ⚠ An activity carries its own activation only when override is true; else it inherits the item's.
        const riders = list.filter(a => a?.type === 'damage'
          && a?.activation?.override === true && !a?.activation?.type);
        if (!riders.length) continue;
        candidates.push({ entry, riders });
      }

      let full = 0;
      for (const { entry, riders } of candidates) {
        // Second pass: effects are not in the index, and the target's effect says the rider applies.
        let doc = null;
        try { doc = await pack.getDocument(entry._id); full++; } catch { /* index-only row */ }
        const effects = (doc?.effects ?? []).map(e => ({
          name: e.name,
          transfer: e.transfer,
          statuses: Array.from(e.statuses ?? []),
          changeKeys: (e.changes ?? []).map(c => c.key),
          seconds: e.duration?.seconds ?? null,
        }));
        rows.push({
          pack: pack.metadata.id,
          name: entry.name,
          itemType: entry.type,
          identifier: entry.system?.identifier ?? null,
          level: entry.system?.level ?? null,
          method: entry.system?.method ?? null,
          concentration: (entry.system?.properties ?? []).includes?.('concentration')
            ?? Array.from(entry.system?.properties ?? []).includes('concentration'),
          riders: riders.map(a => ({
            activityName: a.name || '',
            spellSlot: a?.consumption?.spellSlot ?? null,
            critAllow: a?.damage?.critical?.allow ?? null,
            critBonus: a?.damage?.critical?.bonus || '',
            parts: (a?.damage?.parts ?? []).map(partOf),
          })),
          effects,
          text: strip(entry.system?.description?.value).slice(0, 500),
        });
      }
      packStats.push({
        pack: pack.metadata.id,
        indexed: index.size ?? index.length ?? 0,
        riders: candidates.length,
        fullyRead: full,
      });
    } catch (err) {
      errors.push({ pack: pack.metadata.id, error: String(err?.message || err) });
    }
  }
  return { rows, errors, packStats };
}, null);

const out = process.argv[2] || join(tmpdir(), 'battleflow-riders-raw.json');
writeFileSync(out, JSON.stringify(result, null, 2));

console.log('\n# pack coverage (packs with at least one rider)');
for (const p of result.packStats) {
  if (p.riders) console.log(`  ${p.pack}: ${p.indexed} indexed, ${p.riders} riders, ${p.fullyRead} fully read`);
}
if (result.errors.length) {
  console.log('\n# errors');
  for (const e of result.errors) console.log(`  ${e.pack}: ${e.error}`);
}
console.log(`\n# riders found: ${result.rows.length}`);
for (const r of result.rows) {
  const dmg = r.riders.map(a => `${a.parts.map(p => `${p.formula}${p.types.length ? ' ' + p.types.join('/') : ''}`).join(' + ')}` +
    ` [crit:${a.critAllow}]`).join(' ; ');
  const marks = r.effects.filter(e => !e.transfer).map(e => `${e.name}${e.statuses.length ? `(${e.statuses.join(',')})` : ''}`);
  console.log(`  ${r.pack} :: ${r.name} [${r.identifier ?? '-'}] — ${dmg}`);
  console.log(`      effects: ${marks.length ? marks.join(', ') : '(none non-transfer)'}`);
}
console.log(`\nwritten: ${out}`);
await disposeSafely(f, 'scan-riders');
process.exit(0);
