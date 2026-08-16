// Broadcast a client refresh to every OTHER connected Foundry client, from the bridge.
//
// Why this exists: WebDAV hot-deploys go live "on the next reload" — but the auto-apply
// elect is whichever active GM outranks the bridge, and a human GM window that predates the
// deploy keeps running the OLD script until someone presses F5. That skew burned a smoke run
// on 2026-08-15 (receipts written by stale code failed brand-new assertions). The user's
// standing instruction (2026-08-15): tests and deploy tooling should prefer the bridge —
// nobody should have to hand-refresh windows for the harness's sake.
//
// Mechanism: Foundry core's own "reload" socket event — the one
// SettingsConfig.reloadConfirm({world: true}) emits when a changed setting needs a world
// reload. Emitting it is GM-gated and reaches every OTHER client; the bridge doesn't need to
// reload itself (it connects fresh every run). The script verifies the protocol is still
// present in core's source before emitting, and then WATCHES the user list for the
// disconnect/reconnect dip that proves the refresh actually happened.
//
// Courtesy: this yanks every connected window, players included. During a live session, ask
// the table first.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}

setTimeout(() => { console.error('[reload] WATCHDOG: 90s — hard abort'); process.exit(3); }, 90_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL,
  magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude',
  password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY,
  worldId: env.MOLTEN_WORLD_ID,
});

console.log('[reload] connecting…');
await f.connect();

const r = await f.evaluate(async () => {
  // The class moved into foundry.applications.settings at v13; keep the legacy global as a
  // fallback so a namespace shuffle reads as "not found" rather than a crash.
  const SC = foundry.applications?.settings?.SettingsConfig ?? globalThis.SettingsConfig;
  const source = SC?.reloadConfirm?.toString() ?? '';
  // reloadConfirm's world branch is `game.socket.emit("reload")` — if that line is gone,
  // the protocol changed under us and emitting would be a silent no-op. Refuse instead.
  if (!/socket\.emit\(\s*["']reload["']/.test(source)) {
    return { ok: false, why: `core reloadConfirm no longer emits "reload" — protocol changed?\n${source}` };
  }
  const others = game.users.filter(u => u.active && !u.isSelf).map(u => u.name);
  if (!others.length) return { ok: true, others, refreshed: [] };

  game.socket.emit('reload');

  // Proof, not hope: a refreshing client drops off the active list and comes back. Watch
  // for the dip so "emitted" and "worked" stay distinguishable.
  const dipped = new Set();
  for (let i = 0; i < 40; i++) {
    await new Promise(res => setTimeout(res, 250));
    for (const name of others) {
      const u = game.users.getName(name);
      if (u && !u.active) dipped.add(name);
    }
    if (dipped.size === others.length) break;
  }
  return { ok: true, others, refreshed: [...dipped] };
}, null);

if (!r.ok) {
  console.error(`[reload] REFUSED — ${r.why}`);
} else if (!r.others.length) {
  console.log('[reload] no other clients connected — nothing to refresh');
} else {
  const missed = r.others.filter(n => !r.refreshed.includes(n));
  console.log(`[reload] emitted to: ${r.others.join(', ')}`);
  console.log(`[reload] observed refreshing: ${r.refreshed.join(', ') || '(none)'}${missed.length ? ` — no dip seen from: ${missed.join(', ')} (may have reconnected between polls; verify by eye)` : ''}`);
}

await f.disconnect?.();
process.exit(r.ok ? 0 : 1);
