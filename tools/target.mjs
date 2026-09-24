/**
 * WHICH INSTANCE A SUITE TALKS TO — one decision, in one place (2026-08-19).
 *
 * The local sandbox is THE test environment now (user call). It is a byte copy of prod's
 * world imaged by `fvtt-mcp-dnd5e/scripts/pull-prod-to-local.mjs`, so the same world id,
 * the same users and the same fixtures exist on both — which is exactly why a suite pointed
 * at the wrong one is so easy to miss and so expensive: these suites MUTATE settings, actors
 * and chat. Every harness in tools/ resolves its connection here so the choice can never
 * drift file by file, and every run prints the target it chose.
 *
 *   node tools/smoke-saves.mjs               → the local sandbox (default)
 *   BF_TARGET=prod node tools/smoke-saves.mjs → Molten prod, deliberately
 *
 * Both targets are the MCP's own host presets (`fvtt-mcp-dnd5e/client`, src/hosts/env.ts):
 * `local` never wakes and launches a cold world with FOUNDRY_ADMIN_KEY (the 2.x LOCAL_* names
 * still read as aliases); `prod` is the `molten` preset, whose wake URL rides on the Host — the
 * `magicUrl` this file used to pass had been silently dropped by the MCP's hosts refactor, so a
 * sleeping box was never woken. The world id is the preset's (FOUNDRY_WORLD_ID, or the one world
 * the bridge discovers on /setup).
 */
import { foundryConfig as clientConfig } from 'fvtt-mcp-dnd5e/client';

const HOST_OF = { local: 'local', prod: 'molten' };

function target() {
  const t = (process.env.BF_TARGET ?? 'local').toLowerCase();
  if ((t !== 'local') && (t !== 'prod')) {
    throw new Error(`BF_TARGET must be "local" or "prod" — got "${t}"`);
  }
  return t;
}

/** Resolve the Foundry connection config for the chosen target. */
export function foundryConfig(env) {
  const t = target();
  if (t === 'prod') {
    console.log('[target] PROD (Molten) — this run mutates the live world');
    return clientConfig(env, HOST_OF[t], 'bridge');
  }
  // ⚠ The suites join as their OWN identity, NOT the MCP bridge's (user-created
  // "Tester Assistant", role 3, 2026-08-19; FOUNDRY_SUITE_USER, alias BF_SUITE_USER). Not for
  // parallelism — only one GM-capable client may be connected either way, because the elect
  // picks exactly one. It is for DETECTABILITY: sharing DM Assistant made a bridge/suite
  // collision invisible (both `game.users` and `/api/status` count USERS, not sockets —
  // measured), so it read as nine mysterious failures instead of one loud abort. Distinct
  // accounts make the overlap visible to preflightSoleGM.
  const cfg = clientConfig(env, HOST_OF[t], 'suite');
  console.log(`[target] local sandbox (${cfg.serverUrl}) as "${cfg.user}"`);
  return cfg;
}

/**
 * The SECOND client's config for the two-client probes (probe-player-seam,
 * probe-popup-topology): same instance as foundryConfig picked, joined as the player test
 * identity (FOUNDRY_PLAYER_USER, alias MOLTEN_TEST_USER) instead of the bridge. No adminKey —
 * the world is already up by the time a second client joins, and a player has no business
 * launching it.
 */
export function playerConfig(env) {
  return clientConfig(env, HOST_OF[target()], 'player');
}

/**
 * PREFLIGHT: exactly one GM-capable client, and it must be us.
 *
 * `game.users.activeGM` elects ONE client out of every connected GM-capable session — so a
 * second one (the MCP bridge left connected, a human GM window, a zombie script) does not
 * merely add noise: it can BE the elect, and then every popup, one-shot and application the
 * suite is asserting on happens somewhere this client cannot see. That is the module's own
 * finding ⓪ turned on the test harness, and it cost a confusing 9-failure concentration run
 * on 2026-08-19 before the penny dropped. Fail loudly here instead.
 *
 * Pass `{ requireElect: false }` for a read-only probe that does not care who applies, and
 * `{ allowBridge: true }` with it for a probe that reads pack indexes or `game.users` and asserts
 * on nothing at all — the bridge being connected cannot corrupt such a read.
 *
 * ⚠ THE BRIDGE IS USUALLY OURS, AND USUALLY NOT THIS SESSION'S (measured 2026-09-24). The bridge
 * identity (`FOUNDRY_USER` in the MCP's .env) is joined by EVERY open Claude session's MCP server;
 * `disconnect-bridge` logs out only the calling session's browser, and the identity stays active
 * as long as any other session holds it — polled for 150 s after a disconnect with six sessions
 * open, it never dropped. So when the only other GM is the bridge, the message names the cause:
 * another session, not a lag. Nothing here can log that session out; the human closes it or runs
 * disconnect-bridge there.
 */
export async function preflightSoleGM(f, { requireElect = true, allowBridge = false, env = null } = {}) {
  const bridgeUser = env?.FOUNDRY_USER ?? env?.LOCAL_FOUNDRY_USER ?? 'MCP-Claude';
  const who = await f.evaluate(async () => ({
    self: game.user.name,
    elect: game.users.activeGM?.name ?? null,
    isSelf: game.users.activeGM?.isSelf ?? false,
    gms: game.users.filter(u => u.active && u.isGM).map(u => u.name),
  }), null);
  const others = who.gms.filter(n => n !== who.self);
  const onlyTheBridge = others.length === 1 && others[0] === bridgeUser;
  if (onlyTheBridge && allowBridge && !requireElect) {
    console.warn(`[preflight] the MCP bridge "${bridgeUser}" is connected — allowed for this read-only probe`);
    return who;
  }
  if (who.gms.length > 1) {
    const why = onlyTheBridge
      ? `The other GM is the MCP bridge "${bridgeUser}", which every open Claude session's MCP server `
        + 'joins as: disconnect-bridge here logs out only THIS session\'s browser, so if it is still '
        + 'connected another Claude session holds it — run disconnect-bridge in that session (or close '
        + 'it), then re-run. A read-only probe may pass { requireElect: false, allowBridge: true }.'
      : 'Disconnect the MCP bridge (disconnect-bridge) and close any GM window, then re-run. (Same '
        + 'account twice still counts twice: the elect is per-USER, so both pass isActiveGM and they '
        + 'fight over every application.)';
    throw new Error(
      `PREFLIGHT: ${who.gms.length} GM-capable clients connected (${who.gms.join(', ')}) — `
      + `exactly one must be. ${why}`);
  }
  if (requireElect && !who.isSelf) {
    throw new Error(`PREFLIGHT: the elect is "${who.elect}", not this client ("${who.self}") — `
      + 'this run would assert on work happening elsewhere.');
  }
  return who;
}

/** True when this run is pointed at the live world — for guards that must not fire locally. */
export const isProdTarget = () => (process.env.BF_TARGET ?? 'local').toLowerCase() === 'prod';
