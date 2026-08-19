// Read-only forensics for the 2026-08-18 live session (session 4, the Hollow).
// Dumps every message in the session window with its battleflow flags, its rolls,
// and the AUTHORING USER — the last one matters because finding ⓪ says the elect
// was contaminated all night, and the author names the client that acted.
// No writes, no settings touched.
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
setTimeout(() => { console.error('[probe] WATCHDOG 180s'); process.exit(3); }, 180_000);

const f = new Foundry(foundryConfig(env));
console.log('[probe] connecting…');
await f.connect();
console.log('[probe] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const users = Object.fromEntries(game.users.contents.map(u => [u.id, u.name]));
  const rows = [];
  for (const m of game.messages.contents) {
    const bf = m.flags?.[MOD];
    const row = {
      id: m.id,
      ts: new Date(m.timestamp).toISOString().slice(11, 19),
      by: users[m.author?.id ?? m.author] ?? String(m.author),
      alias: m.speaker?.alias ?? null,
      text: (m.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90),
    };
    if (m.rolls?.length) {
      row.rolls = m.rolls.map(r => {
        try { const j = typeof r === 'string' ? JSON.parse(r) : r;
          return { f: j.formula, t: j.total, opts: j.options?.target ?? null }; }
        catch { return { f: '?', t: null }; }
      });
      const d5 = m.flags?.dnd5e;
      if (d5?.roll) row.d5roll = { type: d5.roll.type, ability: d5.roll.ability, dc: d5.roll.dc };
      if (d5?.messageType) row.d5type = d5.messageType;
    }
    if (bf) {
      row.bf = {};
      if (bf.topple) row.bf.topple = {
        status: bf.topple.status, dc: bf.topple.dc, outcome: bf.topple.outcome,
        total: bf.topple.total, applied: bf.topple.applied, pressed: bf.topple.pressed,
        timedOut: bf.topple.timedOut, target: bf.topple.targetName ?? bf.topple.target,
        deadline: bf.topple.deadline ? new Date(bf.topple.deadline).toISOString().slice(11, 19) : null,
        keys: Object.keys(bf.topple),
      };
      if (bf.mastery) row.bf.mastery = { keys: Object.keys(bf.mastery), kind: bf.mastery.kind ?? bf.mastery.mastery, status: bf.mastery.status };
      if (bf.saves) row.bf.saves = {
        status: bf.saves.status, dc: bf.saves.dc, templated: bf.saves.templated,
        targets: (bf.saves.targets ?? []).map(t => `${t.name}:${t.done ? t.outcome : 'PENDING'}${t.applied ? '+applied' : ''}${t.timedOut ? '+timer' : ''}`),
      };
      if (bf.concentration) row.bf.conc = { status: bf.concentration.status, dc: bf.concentration.dc, outcome: bf.concentration.outcome, spell: bf.concentration.spellName ?? bf.concentration.spell };
      if (bf.hold) row.bf.hold = { status: bf.hold.status, trigger: bf.hold.trigger, targets: (bf.hold.targets ?? []).map(t => `${t.name}:${t.answer ?? 'PENDING'}`) };
      if (bf.respondsTo) row.bf.respondsTo = bf.respondsTo;
      if (bf.receipt) row.bf.receipt = true;
      if (bf.effectReceipt) row.bf.effectReceipt = (bf.effectReceipt.effects ?? bf.effectReceipt.applied ?? []).length ?? true;
      if (bf.castApply) row.bf.castApply = true;
      if (bf.spellDamage) row.bf.spellDamage = true;
      if (bf.originatingMessage) row.bf.origin = bf.originatingMessage;
      if (!Object.keys(row.bf).length) row.bf = Object.keys(bf);
    }
    rows.push(row);
  }
  return { total: game.messages.size, rows };
}, null);

console.log(`[probe] ${out.total} messages`);
for (const r of out.rows) console.log(JSON.stringify(r));
process.exit(0);
