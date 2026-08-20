// Shield Master (FLOW item 5, v1.19.0) — verify the CONTENT, graft only if it is missing,
// and sweep for siblings.
//
// The 2026-08-20 probes found the save machine already accepts a feat's save activity
// end-to-end (saves.js gates only on activity.type === "save"), and Thomas A. Invictus's
// Shield Master already carries the correct content: a "Shield Bashed" effect with
// statuses:["prone"], transfer:false, BOUND to the Shield Bash save activity (1/1
// applicable). The session-4 "nothing pressed Prone" sighting therefore reads as the
// contaminated-elect night, not a content gap — but this tool exists so the claim is
// VERIFIED per world rather than assumed, and repaired in place if a world diverges:
//
//   node tools/fix-shield-master.mjs                 → report the sandbox (read-only)
//   node tools/fix-shield-master.mjs --graft         → graft the Prone effect if missing
//   BF_TARGET=prod node tools/fix-shield-master.mjs  → report prod (read-only)
//
// The SWEEP: every actor-held feature carrying a save activity whose bound-effect list is
// EMPTY — the exact silent shape Shield Master was assumed to have. Report-only, for the
// user to rule on; most such feats are correct as data (the save's consequence is damage or
// narration, not an effect).
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig } from './target.mjs';

const GRAFT = process.argv.includes('--graft');
const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
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
            // The graft: author the effect on the ITEM, then bind it into the activity's
            // effects list — update IN PLACE (the macro applier's rule: never delete+create).
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
