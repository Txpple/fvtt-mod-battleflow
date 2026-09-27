/**
 * Which instance a suite talks to, decided in one place; every run prints its target.
 * The local sandbox is a byte copy of prod's world (same world id, users, fixtures), and suites
 * MUTATE settings, actors and chat, so pointing at the wrong one is easy to miss.
 *
 *   node tools/smoke-saves.mjs               → the local sandbox (default)
 *   BF_TARGET=prod node tools/smoke-saves.mjs → Molten prod, deliberately
 *
 * Both are the MCP's own host presets (`fvtt-mcp-dnd5e/client`): `local` launches a cold world
 * with FOUNDRY_ADMIN_KEY; `prod` is the `molten` preset, whose wake URL rides on the Host.
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
  // ⚠ Suites join as their OWN identity (FOUNDRY_SUITE_USER, alias BF_SUITE_USER), not the bridge's,
  // so a bridge/suite overlap is detectable: `game.users` and `/api/status` count USERS, not sockets.
  const cfg = clientConfig(env, HOST_OF[t], 'suite');
  console.log(`[target] local sandbox (${cfg.serverUrl}) as "${cfg.user}"`);
  return cfg;
}

/**
 * The second client's config for two-client probes: the same instance, joined as the player test
 * identity (FOUNDRY_PLAYER_USER, alias MOLTEN_TEST_USER). No adminKey: a player never launches the world.
 */
export function playerConfig(env) {
  return clientConfig(env, HOST_OF[target()], 'player');
}

/**
 * Preflight: exactly one GM-capable client, and it is us. `game.users.activeGM` elects one of all
 * connected GM sessions, so a second one can BE the elect and the suite's assertions happen
 * somewhere this client cannot see.
 * `{ requireElect: false }` for a read-only probe; with `{ allowBridge: true }` for one that asserts nothing.
 * ⚠ The bridge identity is held by EVERY open Claude session's MCP server, and `disconnect-bridge`
 * logs out only the calling one: when the other GM is the bridge, the message names another session.
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
