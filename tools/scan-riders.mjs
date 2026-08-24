// Survey every DAMAGE RIDER in the world's compendia, so the curated rider table for
// Phase 1.75 is built from what 5e 2024 actually ships rather than from memory. A rider is a
// damage roll you press SEPARATELY from casting the thing that granted it — Hunter's Mark's
// "Bonus Mark Damage", Hex's "Bonus Hex Damage" — which is exactly the click Phase 1.75 folds
// into the weapon's own damage roll.
//
// The structural signature: an activity of type "damage" whose activation is OVERRIDDEN to
// nothing (`activation.override === true` with an empty `activation.type`). That is the
// system's way of saying "this costs no action; press it when it applies". Casting time stays
// on the item (the same item-vs-activity split that made scan-reactions.mjs miss Shield), so
// this signal has to be read off the ACTIVITY, never the item.
//
// Two passes: the index is cheap and finds candidates, then getDocument() on the (small) hit
// set pulls the embedded effects — which is where the marker that lands on the target lives,
// and the index cannot carry them.
//
// Writes raw JSON for classification afterwards. Usage:
//   node tools/scan-riders.mjs [outfile.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig } from './target.mjs';
import { disposeSafely } from './harness.mjs';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
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

  // A damage part is worth quoting verbatim: number/denomination is the common shape, but a
  // custom formula is how Great Weapon Fighting (and anything with min3) is expressed.
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
        // ⚠ Read the activation off the ACTIVITY. An activity only carries its own activation
        // when override is true; otherwise it inherits the item's, and spells keep casting
        // time at item level. A rider is precisely the override-to-nothing case.
        const riders = list.filter(a => a?.type === 'damage'
          && a?.activation?.override === true && !a?.activation?.type);
        if (!riders.length) continue;
        candidates.push({ entry, riders });
      }

      let full = 0;
      for (const { entry, riders } of candidates) {
        // Second pass: effects are not in the index, and the effect is the whole mechanism —
        // it is the state on the TARGET that says the rider applies.
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
