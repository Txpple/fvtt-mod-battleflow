// One-off survey for the three 2026-09-02 commissions (read-only; connects as the suite user):
//   1. the 2024 glossary's SAVING THROW clauses on the conditions and the Dodge action, verbatim
//   2. the Sneak Attack / Cunning Strike family as the packs ship it — activities, parts, effects
//   3. every FEATURE whose text conditions extra damage on the combat CLOCK — "first round",
//      "hasn't taken a turn", "once per turn", "once on each of your turns" — with its damage
//      activities, so the clock-rider table is built from what ships rather than from memory.
// Usage: node tools/probe-clock-riders.mjs [outfile.json]
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
setTimeout(() => { console.error('[probe] WATCHDOG 600s'); process.exit(3); }, 600_000);

const f = new Foundry(foundryConfig(env));
console.log('[probe] connecting…');
await f.connect();
console.log('[probe] connected');

const result = await f.evaluate(async () => {
  const strip = html => (html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const out = { glossary: {}, family: [], clock: [], errors: [], packs: [] };

  // 1. The glossary clauses. CONFIG.DND5E.conditionTypes carries each condition's reference uuid.
  const wanted = ['restrained', 'paralyzed', 'stunned', 'unconscious', 'petrified', 'incapacitated', 'exhaustion', 'poisoned', 'frightened'];
  for (const key of wanted) {
    try {
      const ref = CONFIG.DND5E.conditionTypes[key]?.reference;
      const page = ref ? await fromUuid(ref) : null;
      out.glossary[key] = { reference: ref ?? null, text: page ? strip(page.text?.content) : null };
    } catch (err) { out.errors.push(`glossary ${key}: ${err?.message}`); }
  }
  // The Dodge action lives in the rules journal — find it by page name across journal packs.
  for (const name of ['Dodge', 'Saving Throws', 'D20 Tests', 'Unseen Attackers and Targets']) {
    try {
      let found = null;
      for (const pack of game.packs) {
        if (pack.documentName !== 'JournalEntry') continue;
        const index = await pack.getIndex();
        for (const entry of index) {
          const doc = await pack.getDocument(entry._id);
          const page = doc.pages.find(p => p.name === name);
          if (page) { found = { pack: pack.metadata.id, journal: doc.name, uuid: page.uuid, text: strip(page.text?.content) }; break; }
        }
        if (found) break;
      }
      out.glossary[name] = found;
    } catch (err) { out.errors.push(`journal ${name}: ${err?.message}`); }
  }

  // 2 + 3. Every Item pack: the family by name, and the clock riders by text.
  const FAMILY = /^(sneak attack|cunning strike|devious strikes|improved cunning strike|supreme sneak|envenom weapons|death strike|rend mind|assassinate|dread ambusher|dreadful strike|stalker's flurry|psychic blades|colossus slayer|divine strike|primal strike|divine fury|lifedrinker|dreadful strikes|slayer's prey|hunter's prey|blessed strikes|brutal strike|improved brutal strike|great weapon master|rakish audacity)/i;
  const CLOCK = /(first round|hasn.t taken a turn|has not taken a turn|hasn.t acted|once per turn|once on each of your turns|once during each of your turns|first turn of|start of (the|each) combat|acted yet)/i;
  const activityOf = a => ({
    id: a._id ?? a.id, type: a.type, name: a.name || '',
    activation: a.activation ? { type: a.activation.type ?? '', override: !!a.activation.override } : null,
    damage: a.damage ? { parts: (a.damage.parts ?? []).map(p => ({
      formula: p?.custom?.enabled ? (p.custom.formula || '') : `${p?.number ?? ''}d${p?.denomination ?? ''}`,
      bonus: p?.bonus || '', types: Array.from(p?.types ?? []), scaling: p?.scaling?.mode || '', scalingFormula: p?.scaling?.formula || '', scalingNumber: p?.scaling?.number ?? null
    })), onSave: a.damage.onSave ?? null, critical: a.damage.critical ?? null } : null,
    save: a.save ? { ability: Array.from(a.save.ability ?? []), dc: a.save.dc ? { calculation: a.save.dc.calculation, formula: a.save.dc.formula } : null } : null,
    effects: (a.effects ?? []).map(e => ({ id: e._id, onSave: e.onSave ?? null })),
    consumption: a.consumption ? { targets: (a.consumption.targets ?? []).map(t => ({ type: t.type, value: t.value, target: t.target })) } : null,
    uses: a.uses ? { max: a.uses.max, recovery: (a.uses.recovery ?? []).map(r => r.period) } : null,
    description: strip(a.description?.chatFlavor ?? '')
  });
  for (const pack of game.packs) {
    if (pack.documentName !== 'Item') continue;
    if (/^(JB2A|dnd5e-animations)/.test(pack.metadata.id)) continue;
    try {
      const index = await pack.getIndex({ fields: ['type', 'system.description.value', 'system.identifier', 'system.activities', 'system.uses', 'system.type', 'system.properties'] });
      let fam = 0, clk = 0;
      for (const entry of index) {
        const text = strip(entry.system?.description?.value);
        const isFamily = FAMILY.test(entry.name);
        const activities = entry.system?.activities ?? {};
        const list = Array.isArray(activities) ? activities : Object.values(activities);
        const hasDamage = list.some(a => a?.type === 'damage' || a?.damage?.parts?.length);
        const isClock = (entry.type === 'feat') && CLOCK.test(text) && /damage/i.test(text);
        if (!isFamily && !isClock) continue;
        let doc = null;
        try { doc = await pack.getDocument(entry._id); } catch { /* index only */ }
        const row = {
          pack: pack.metadata.id, name: entry.name, id: entry._id, type: entry.type,
          identifier: entry.system?.identifier ?? null,
          featType: entry.system?.type ? { value: entry.system.type.value, subtype: entry.system.type.subtype } : null,
          uses: entry.system?.uses ? { max: entry.system.uses.max, recovery: (entry.system.uses.recovery ?? []).map(r => r.period) } : null,
          hasDamage,
          activities: (doc ? [...(doc.system?.activities ?? [])] : list).map(activityOf),
          effects: (doc?.effects ?? []).map(e => ({ id: e.id, name: e.name, statuses: Array.from(e.statuses ?? []), transfer: e.transfer, duration: e.duration ? { rounds: e.duration.rounds, turns: e.duration.turns, seconds: e.duration.seconds } : null, changes: (e.changes ?? []).map(c => c.key), description: strip(e.description).slice(0, 200) })),
          text: text.slice(0, 1400)
        };
        if (isFamily) { out.family.push(row); fam++; }
        else { out.clock.push(row); clk++; }
      }
      out.packs.push({ pack: pack.metadata.id, indexed: index.size ?? index.length ?? 0, family: fam, clock: clk });
    } catch (err) { out.errors.push(`${pack.metadata.id}: ${err?.message}`); }
  }
  // Which of the family sits on the sandbox's own actors (a rogue on the sheet is the honest fixture).
  out.actors = game.actors.filter(a => a.items.some(i => /^sneak attack$/i.test(i.name)))
    .map(a => ({ name: a.name, type: a.type, items: a.items.filter(i => FAMILY.test(i.name)).map(i => `${i.name} [${i.type}]`) }));
  return out;
}, null);

const outFile = process.argv[2] || join(tmpdir(), 'battleflow-clock-riders.json');
writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(`\n[probe] written ${outFile}`);
console.log('\n# glossary');
for (const [k, v] of Object.entries(result.glossary)) console.log(`  ${k}: ${(v?.text ?? '').slice(0, 400)}`);
console.log('\n# family');
for (const r of result.family) console.log(`  ${r.pack} :: ${r.name} [${r.identifier ?? '-'}] uses=${JSON.stringify(r.uses)} acts=${r.activities.map(a => `${a.type}:${a.name}${a.damage ? ' ' + a.damage.parts.map(p => p.formula + (p.bonus ? '+' + p.bonus : '') + ' ' + p.types.join('/')).join('+') : ''}${a.save ? ' save:' + a.save.ability.join('/') : ''}`).join(' | ')} effects=${r.effects.map(e => e.name + '(' + e.statuses.join(',') + ')').join(',')}`);
console.log('\n# clock candidates');
for (const r of result.clock) console.log(`  ${r.pack} :: ${r.name} [${r.identifier ?? '-'}] dmg=${r.hasDamage} uses=${JSON.stringify(r.uses)} — ${r.text.slice(0, 220)}`);
console.log('\n# actors carrying Sneak Attack'); console.log(JSON.stringify(result.actors, null, 1));
if (result.errors.length) { console.log('\n# errors'); for (const e of result.errors) console.log('  ' + e); }
await disposeSafely(f, 'probe');
process.exit(0);
