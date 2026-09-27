// Shield Master: verify the CONTENT, graft only if it is missing, and sweep for siblings.
// The module never applies the item's own "Shield Bashed" effect (the bash presses the canonical
// Prone chip via forceStatus), so this is content hygiene, not load-bearing. The expected content:
// a "Shield Bashed" effect with statuses:["prone"], transfer:false, bound to the Shield Bash save activity.
//
//   node tools/content/fix-shield-master.mjs                 → report the sandbox (read-only)
//   node tools/content/fix-shield-master.mjs --graft         → graft the Prone effect if missing
//   BF_TARGET=prod node tools/content/fix-shield-master.mjs  → report prod (read-only)
//
// The sweep: every actor-held feature with a save activity whose bound-effect list is EMPTY.
// Report-only; most are correct as data (the consequence is damage or narration).
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig } from './target.mjs';

const GRAFT = process.argv.includes('--graft');
const env = loadEnv();
setTimeout(() => { console.error('[shieldmaster] WATCHDOG 240s'); process.exit(3); }, 240_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log(`[shieldmaster] connected${GRAFT ? ' — GRAFT mode' : ' — report only'}`);

const out = await f.evaluate(async ({ graft }) => {
  const report = { shieldMaster: [], grafted: [], sweep: [] };
  for (const actor of game.actors) {
    for (const item of actor.items.filter(i => i.type === 'feat')) {
      const saveActs = (item.system.activities?.contents ?? []).filter(a => a.type === 'save');
      if (!saveActs.length) continue;
      for (const act of saveActs) {
        const applicable = new Set((act.applicableEffects ?? []).map(e => e.id));
        const bound = (act.effects ?? []).filter(e => e.effect && applicable.has(e.effect.id));
        const row = {
          actor: actor.name, item: item.name, itemId: item.id, activity: act.name,
          dc: act.save?.dc?.value ?? null, ability: [...(act.save?.ability ?? [])].join('/'),
          boundEffects: bound.map(e => ({ name: e.effect.name, statuses: [...(e.effect.statuses ?? [])], onSave: !!e.onSave }))
        };
        if (item.name.toLowerCase().includes('shield master')) {
          const hasProne = bound.some(e => e.effect.statuses?.has?.('prone'));
          report.shieldMaster.push({ ...row, hasProne });
          if (!hasProne && graft) {
            // The graft: author the effect on the ITEM, then bind it into the activity's effects,
            // updated IN PLACE (never delete+create).
            const [eff] = await item.createEmbeddedDocuments('ActiveEffect', [{
              name: 'Shield Bashed', img: 'icons/svg/falling.svg',
              transfer: false, disabled: false, statuses: ['prone'],
              description: 'Knocked Prone by a shield bash (Shield Master).'
            }]);
            const effects = (act.toObject?.().effects ?? []).concat([{ _id: eff.id, onSave: false }]);
            await item.update({ [`system.activities.${act.id}.effects`]: effects });
            report.grafted.push({ actor: actor.name, item: item.name, effectId: eff.id });
          }
        } else if (!bound.length) {
          report.sweep.push(row);
        }
      }
    }
  }
  return report;
}, { graft: GRAFT });

console.log('\n[shieldmaster] Shield Master copies:');
if (!out.shieldMaster.length) console.log('  — none in this world');
for (const r of out.shieldMaster) {
  console.log(`  ${r.actor} · "${r.item}" · ${r.activity} (${r.ability} DC ${r.dc})`
    + ` · bound=[${r.boundEffects.map(e => `${e.name}{${e.statuses.join(',')}}`).join(', ')}]`
    + ` · ${r.hasProne ? '✅ Prone bound — nothing to do' : '⚠ NO PRONE EFFECT'}`);
}
if (out.grafted.length) {
  console.log('\n[shieldmaster] GRAFTED:');
  for (const g of out.grafted) console.log(`  ${g.actor} · ${g.item} · effect ${g.effectId}`);
}
console.log('\n[shieldmaster] sweep — feat save activities with NO bound effects (report only, user rules):');
if (!out.sweep.length) console.log('  — none');
for (const r of out.sweep) {
  console.log(`  ${r.actor} · "${r.item}" · ${r.activity} (${r.ability} DC ${r.dc ?? '?'})`);
}
process.exit(0);
