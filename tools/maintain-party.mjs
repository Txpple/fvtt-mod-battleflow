// Party maintenance, on demand: strip temporary actor-level effects (the "Clear Temp
// Effects" macro's job, actor-scoped rather than scene-scoped) and long-rest the party.
// The post-testing reset — run it whenever dogfooding leaves chips and spent slots behind.
// Item-embedded effects are untouched (they live on items, not in actor.effects).
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig } from './target.mjs';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[maintain-party] WATCHDOG 120s'); process.exit(3); }, 120_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[maintain-party] connected');

const out = await f.evaluate(async () => {
  const NAMES = ['Gren Greenmantle', 'Jetten Elisedil', 'Morgash the Gravemaker', 'Salyth', 'Thomas A. Invictus'];
  const report = [];
  for (const name of NAMES) {
    const actor = game.actors.getName(name);
    if (!actor) { report.push({ name, missing: true }); continue; }
    // Temporary = duration-bearing or status-carrying, the macro's own definition.
    const temp = actor.effects.filter(e => e.isTemporary || e.statuses.size);
    const cleared = temp.map(e => e.name);
    if (temp.length) await actor.deleteEmbeddedDocuments('ActiveEffect', temp.map(e => e.id));
    let rested = false;
    try { rested = !!(await actor.longRest({ dialog: false, chat: false, newDay: true })); }
    catch (err) { report.push({ name, cleared, restError: String(err?.message ?? err) }); continue; }
    report.push({
      name, cleared, rested,
      hp: `${actor.system.attributes.hp.value}/${actor.system.attributes.hp.max}`
    });
  }
  return report;
}, null);

console.log(JSON.stringify(out, null, 2));
process.exit(0);
