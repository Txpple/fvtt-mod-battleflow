// Read-only: is a doubled demand ONE use stamped twice, or two uses?
// Dumps the dnd5e use/activity identity of the doubled cards, the surviving
// MeasuredTemplates/Regions on every scene, and duplicate ActiveEffects by name on
// the PCs and the night's NPCs. Findings ①②③ of the 2026-08-18 session. No writes.
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
  // 1. the doubled cards: Bane pair, the Topple pair, and every card carrying a saves flag
  const ident = [];
  for (const m of game.messages.contents) {
    const bf = m.flags?.[MOD]; if (!bf?.saves && !bf?.topple) continue;
    const d5 = m.flags?.dnd5e ?? {};
    ident.push({
      ts: new Date(m.timestamp).toISOString().slice(11, 19), id: m.id,
      by: users[m.author?.id ?? m.author],
      kind: bf.saves ? 'saves' : 'topple',
      name: (m.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28),
      use: d5.use ?? null, activity: d5.activity ?? null, item: d5.item ?? null,
      msgType: d5.messageType ?? null, originating: bf.originatingMessage ?? null,
      askFor: bf.topple?.damageMessageId ?? bf.saves?.damageMessageId ?? null,
    });
  }
  // 2. surviving areas
  const areas = [];
  for (const s of game.scenes.contents) {
    for (const t of s.templates.contents) areas.push({ scene: s.name, kind: 'template', id: t.id,
      by: users[t.author?.id ?? t.author], t: t.t, distance: t.distance,
      origin: t.flags?.dnd5e?.origin ?? null, dims: t.flags?.dnd5e?.dimensions ?? null });
    for (const r of s.regions?.contents ?? []) areas.push({ scene: s.name, kind: 'region', id: r.id, name: r.name });
  }
  // 3. duplicate effects by name on every actor that has any
  const dupes = [];
  for (const a of game.actors.contents) {
    const byName = {};
    for (const e of a.effects.contents) (byName[e.name] ??= []).push({ id: e.id, origin: e.origin, disabled: e.disabled });
    for (const [name, list] of Object.entries(byName)) if (list.length > 1) dupes.push({ actor: a.name, name, n: list.length, list });
  }
  // 4. same, on unlinked tokens of every scene
  for (const s of game.scenes.contents) for (const tk of s.tokens.contents) {
    if (tk.actorLink) continue; const a = tk.actor; if (!a) continue;
    const byName = {};
    for (const e of a.effects.contents) (byName[e.name] ??= []).push({ id: e.id, origin: e.origin });
    for (const [name, list] of Object.entries(byName)) if (list.length > 1) dupes.push({ actor: `${s.name}/${tk.name}`, name, n: list.length, list });
  }
  return { ident, areas, dupes };
}, null);
console.log(JSON.stringify(out, null, 1));
process.exit(0);
