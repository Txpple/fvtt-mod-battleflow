// Read-only forensics: every message carrying a battleflow saves/hold/concentration flag,
// with status and per-target state. Written for the 2026-08-17 walk's finding ④ (zero
// popups on the GM client for a two-target Shatter demand) — the popup auto-show queues
// behind the actor's OLDEST pending demand, so one stuck-pending card silences every
// later popup for that actor. This names any stuck card. No writes, no settings.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[probe] WATCHDOG 120s'); process.exit(3); }, 120_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
console.log('[probe] connecting…');
await f.connect();
console.log('[probe] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const found = [];
  for (const m of game.messages.contents) {
    const record = { id: m.id, ts: new Date(m.timestamp).toISOString().slice(11, 19) };
    const saves = m.getFlag(MOD, 'saves');
    if (saves) {
      record.saves = {
        status: saves.status, dc: saves.dc, templated: saves.templated,
        damageOnSave: saves.damageOnSave, hasDamage: saves.hasDamage,
        deadline: saves.deadline ? new Date(saves.deadline).toISOString().slice(11, 19) : null,
        targets: (saves.targets ?? []).map(t => ({
          name: t.name, done: t.done, outcome: t.outcome, total: t.total,
          timedOut: t.timedOut ?? false, applied: t.applied ?? false
        }))
      };
    }
    const hold = m.getFlag(MOD, 'hold');
    if (hold?.status === 'pending') record.holdPending = true;
    const conc = m.getFlag(MOD, 'concentration');
    if (conc?.status === 'pending') record.concPending = true;
    if (record.saves || record.holdPending || record.concPending) found.push(record);
  }
  return { count: game.messages.size, found };
}, null);

console.log(`[probe] ${out.count} messages, ${out.found.length} flagged:`);
for (const r of out.found) console.log(JSON.stringify(r));
process.exit(0);
