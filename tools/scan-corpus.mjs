// Survey the WHOLE ability corpus in the world's compendia — race traits, class features,
// subclass features, feats and spells — so the abilities sweep is planned from what the packs
// actually ship rather than from memory. Read-only; writes raw JSON to a file for offline
// classification (tools/classify-corpus.mjs). Nothing here touches the world.
//
// Two passes, like scan-riders.mjs: the index carries activities/activation/uses/text, and a
// getDocument() pass on the (larger) feature+spell set pulls the embedded effects, because the
// effect is the mechanism — a feature that ships an effect is one the gate can already READ,
// while a text-only feature is one that needs a row (the Steady Aim lesson, 2026-09-02).
// Class/subclass/race documents are read fully for their ItemGrant advancements, which is the
// only way a class feature knows which class or subclass it belongs to.
//
// Usage: node tools/scan-corpus.mjs [outfile.json]
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
setTimeout(() => { console.error('[scan] WATCHDOG 900s'); process.exit(3); }, 900_000);

const f = new Foundry(foundryConfig(env));
console.log('[scan] connecting…');
await f.connect();
console.log('[scan] connected');

const result = await f.evaluate(async () => {
  const strip = html => (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const rows = [];
  const owners = [];   // class / subclass / race documents with their grants
  const errors = [];
  const packStats = [];
  const KEEP_FEAT = new Set(['race', 'class', 'feat', 'origin', 'supernaturalGift']);

  const activityOf = a => ({
    type: a?.type,
    name: a?.name || '',
    // ⚠ In dnd5e 5.x the activation LIVES on the activity for features; `override` only
    // matters for spells, which keep casting time on the item. Read it always, and say
    // whether it was overridden.
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
        if (t !== 'feat' && t !== 'spell') continue;
        if (t === 'feat' && !KEEP_FEAT.has(sys.type?.value ?? '')) continue;
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
}, null);

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
