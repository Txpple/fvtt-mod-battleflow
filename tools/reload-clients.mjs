// Broadcast a client refresh to every OTHER connected Foundry client, from the bridge.
// A deploy goes live on the next reload, and a GM window older than the deploy (possibly the
// auto-apply elect) keeps running the old code until refreshed.
// Mechanism: core's own "reload" socket event (SettingsConfig.reloadConfirm({world: true})),
// GM-gated, reaching every other client. The script checks the protocol is still in core's
// source, then watches the user list for the disconnect/reconnect dip that proves it worked.
// ⚠ This yanks every connected window, players included: ask the table first mid-session.
import { Foundry, loadEnv } from 'fvtt-mcp-dnd5e/client';
import { foundryConfig } from './target.mjs';
import { disposeSafely } from './harness.mjs';

const env = loadEnv();

setTimeout(() => { console.error('[reload] WATCHDOG: 90s — hard abort'); process.exit(3); }, 90_000);

const f = new Foundry(foundryConfig(env));

console.log('[reload] connecting…');
await f.connect();

const r = await f.evaluate(async () => {
  // The legacy global is a fallback, so a namespace shuffle reads as "not found", not a crash.
  const SC = foundry.applications?.settings?.SettingsConfig ?? globalThis.SettingsConfig;
  const source = SC?.reloadConfirm?.toString() ?? '';
  // ⚠ If reloadConfirm stops emitting "reload", emitting would be a silent no-op: refuse.
  if (!/socket\.emit\(\s*["']reload["']/.test(source)) {
    return { ok: false, why: `core reloadConfirm no longer emits "reload" — protocol changed?\n${source}` };
  }
  const others = game.users.filter(u => u.active && !u.isSelf).map(u => u.name);
  if (!others.length) return { ok: true, others, refreshed: [] };

  game.socket.emit('reload');

  // A refreshing client drops off the active list and comes back: watch for the dip.
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

await disposeSafely(f, 'reload');
process.exit(r.ok ? 0 : 1);
