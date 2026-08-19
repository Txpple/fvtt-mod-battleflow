// Read-only: full battleflow topple flag for every Topple ask + verdict of the
// 2026-08-18 session, plus every roll message in the 60s after each ask (who rolled,
// what formula, what flags it carried). Finding ⑤'s bedrock. No writes.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line); if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[probe] WATCHDOG 180s'); process.exit(3); }, 180_000);
const f = new Foundry(foundryConfig(env));
await f.connect();
const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const users = Object.fromEntries(game.users.contents.map(u => [u.id, u.name]));
  const all = game.messages.contents;
  const asks = all.filter(m => m.flags?.[MOD]?.topple);
  const res = [];
  for (const ask of asks) {
    const window = all.filter(m => m.timestamp >= ask.timestamp - 20000 && m.timestamp <= ask.timestamp + 70000);
    res.push({
      askId: ask.id, ts: new Date(ask.timestamp).toISOString().slice(11, 19),
      by: users[ask.author?.id ?? ask.author],
      topple: ask.flags[MOD].topple,
      near: window.map(m => ({
        ts: new Date(m.timestamp).toISOString().slice(11, 19),
        by: users[m.author?.id ?? m.author], alias: m.speaker?.alias,
        text: (m.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70),
        rolls: (m.rolls || []).map(r => { const j = typeof r === 'string' ? JSON.parse(r) : r; return `${j.formula}=${j.total}`; }),
        d5: m.flags?.dnd5e?.roll ? { type: m.flags.dnd5e.roll.type, ability: m.flags.dnd5e.roll.ability } : undefined,
        bfKeys: m.flags?.[MOD] ? Object.keys(m.flags[MOD]) : undefined,
        respondsTo: m.flags?.[MOD]?.respondsTo,
      })),
    });
  }
  return res;
}, null);
console.log(JSON.stringify(out, null, 1));
process.exit(0);
