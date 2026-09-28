// Survey the WHOLE ability corpus in the world's compendia — race traits, class and subclass
// features, feats and spells. Read-only; writes raw JSON for offline classification
// (tools/classify-corpus.mjs).
//
// Two passes, like scan-riders.mjs: the index carries activities/activation/uses/text, and a
// getDocument() pass pulls the embedded effects — a feature that ships an effect is one the gate
// can READ, a text-only one needs a row. Class/subclass/race documents are read for their ItemGrant
// advancements, the only way a feature knows its class or subclass.
//
// Usage: node tools/scan-corpus.mjs [outfile.json] [--only <packId,packId,…>]   (--only: read those packs alone; merge the JSONs after)
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig } from './target.mjs';
import { disposeSafely } from './harness.mjs';

const env = loadEnv();
setTimeout(() => { console.error('[scan] WATCHDOG 1800s'); process.exit(3); }, 1_800_000);
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;

const f = new Foundry(foundryConfig(env));
console.log('[scan] connecting…');
await f.connect();
console.log('[scan] connected');

const result = await f.evaluate(async (ONLY) => {
  const strip = html => (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const rows = [];
  const owners = [];   // class / subclass / race documents with their grants
  const errors = [];
  const packStats = [];
  const KEEP_FEAT = new Set(['race', 'class', 'feat', 'origin', 'supernaturalGift']);
  // Packs kept WHOLE, whatever the item type: the monster traits and the DMG's own (SWEEP §7, the audits of 2026-09-28).
  const KEEP_PACK_ALL = new Set(['dnd-monster-manual.features', 'dnd5e.monsterfeatures24', 'dnd-dungeon-masters-guide.features', 'dnd-dungeon-masters-guide.equipment']);

  const activityOf = a => ({
    type: a?.type,
    name: a?.name || '',
    // ⚠ A feature's activation LIVES on the activity; `override` matters only for spells, which keep
    // casting time on the item.
    activation: a?.activation?.type ?? null,
    activationOverride: !!a?.activation?.override,
    actCondition: a?.activation?.condition || '',
    range: a?.range?.value ?? null,
    targetType: a?.target?.affects?.type || a?.target?.template?.type || '',
    save: a?.save ? { ability: Array.from(a.save.ability ?? []), dc: a.save.dc?.calculation || '', onSave: a?.damage?.onSave || '' } : null,
    attack: a?.attack ? { type: a.attack.type?.value || '', classification: a.attack.type?.classification || '' } : null,
    damageParts: (a?.damage?.parts ?? []).map(p => p?.custom?.enabled ? (p.custom.formula || '') : `${p?.number ?? ''}d${p?.denomination ?? ''}${p?.types?.size || p?.types?.length ? ' ' + Array.from(p.types).join('/') : ''}`),
    healing: a?.healing ? `${a.healing.number ?? ''}d${a.healing.denomination ?? ''}` : null,
    effects: (a?.effects ?? []).map(e => e?._id ?? e?.id ?? '').filter(Boolean),
    uses: a?.uses?.max ? { max: a.uses.max, recovery: (a.uses.recovery ?? []).map(r => r.period) } : null,
    consumption: (a?.consumption?.targets ?? []).map(t => t.type),
  });

  for (const pack of game.packs) {
    if (pack.documentName !== 'Item') continue;
    if (ONLY && !ONLY.includes(pack.metadata.id)) continue;
    if (pack.metadata.id.startsWith('JB2A') || pack.metadata.id.startsWith('dnd5e-animations')) continue;
    try {
      const index = await pack.getIndex({
        fields: ['type', 'system.type', 'system.identifier', 'system.level', 'system.school',
          'system.method', 'system.activation', 'system.activities', 'system.properties',
          'system.prerequisites', 'system.requirements', 'system.uses', 'system.description.value',
          'system.classIdentifier', 'system.duration', 'system.target', 'system.range'],
      });
      let kept = 0;
      let full = 0;
      for (const entry of index) {
        const t = entry.type;
        const sys = entry.system ?? {};
        if (t === 'class' || t === 'subclass' || t === 'race') {
          let doc = null;
          try { doc = await pack.getDocument(entry._id); full++; } catch { /* index-only */ }
          const grants = [];
          for (const adv of (doc?.system?.advancement ?? [])) {
            if (adv.type !== 'ItemGrant' && adv.type !== 'ItemChoice') continue;
            for (const it of (adv.configuration?.items ?? [])) {
              grants.push({ uuid: it.uuid ?? it, level: adv.level ?? null, choice: adv.type === 'ItemChoice' });
            }
          }
          owners.push({
            pack: pack.metadata.id, uuid: `Compendium.${pack.metadata.id}.Item.${entry._id}`,
            name: entry.name, type: t, identifier: sys.identifier ?? null,
            classIdentifier: sys.classIdentifier ?? null, grants,
          });
          kept++;
          continue;
        }
        const keepAll = KEEP_PACK_ALL.has(pack.metadata.id);
        if (!keepAll && t !== 'feat' && t !== 'spell') continue;
        if (!keepAll && t === 'feat' && !KEEP_FEAT.has(sys.type?.value ?? '')) continue;
        const activities = sys.activities ?? {};
        const list = Array.isArray(activities) ? activities : Object.values(activities);
        let doc = null;
        try { doc = await pack.getDocument(entry._id); full++; } catch { /* index-only row */ }
        const effects = (doc?.effects ?? []).map(e => ({
          name: e.name,
          transfer: e.transfer,
          disabled: e.disabled,
          statuses: Array.from(e.statuses ?? []),
          changes: (e.changes ?? []).map(c => `${c.key}=${c.value}`),
          duration: { seconds: e.duration?.seconds ?? null, rounds: e.duration?.rounds ?? null, turns: e.duration?.turns ?? null },
          flags: Object.keys(e.flags ?? {}),
        }));
        rows.push({
          pack: pack.metadata.id,
          uuid: `Compendium.${pack.metadata.id}.Item.${entry._id}`,
          name: entry.name,
          itemType: t,
          featType: sys.type?.value ?? null,
          featSubtype: sys.type?.subtype ?? null,
          identifier: sys.identifier ?? null,
          level: sys.level ?? null,
          school: sys.school ?? null,
          method: sys.method ?? null,
          properties: Array.from(sys.properties ?? []),
          activation: sys.activation?.type ?? null,
          activationCondition: sys.activation?.condition ?? '',
          prereqLevel: sys.prerequisites?.level ?? null,
          requirements: sys.requirements ?? '',
          uses: sys.uses?.max ? { max: sys.uses.max, recovery: (sys.uses.recovery ?? []).map(r => r.period) } : null,
          duration: sys.duration ? `${sys.duration.value ?? ''} ${sys.duration.units ?? ''}`.trim() : '',
          activities: list.map(activityOf),
          effects,
          text: strip(sys.description?.value).slice(0, 1500),
        });
        kept++;
      }
      packStats.push({ pack: pack.metadata.id, indexed: index.size ?? index.length ?? 0, kept, fullyRead: full });
    } catch (err) {
      errors.push({ pack: pack.metadata.id, error: String(err?.message || err) });
    }
  }
  return { rows, owners, errors, packStats, foundry: game.version, dnd5e: game.system.version };
}, ONLY);

const out = process.argv[2] || join(tmpdir(), 'battleflow-corpus-raw.json');
writeFileSync(out, JSON.stringify(result, null, 2));

console.log(`\n# Foundry ${result.foundry} / dnd5e ${result.dnd5e}`);
console.log('\n# pack coverage (packs with at least one kept row)');
for (const p of result.packStats) {
  if (p.kept) console.log(`  ${p.pack}: ${p.indexed} indexed, ${p.kept} kept, ${p.fullyRead} fully read`);
}
if (result.errors.length) {
  console.log('\n# errors');
  for (const e of result.errors) console.log(`  ${e.pack}: ${e.error}`);
}
const by = {};
for (const r of result.rows) {
  const k = r.itemType === 'spell' ? 'spell' : `feat:${r.featType}`;
  by[k] = (by[k] ?? 0) + 1;
}
console.log(`\n# rows: ${result.rows.length}  owners: ${result.owners.length}`);
for (const [k, n] of Object.entries(by)) console.log(`  ${k}: ${n}`);
console.log(`\n# written ${out}`);

await disposeSafely(f);
