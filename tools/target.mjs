/**
 * Which instance a suite talks to, decided in one place; every run prints its target.
 * The local sandbox by default: the MCP client's `local` host preset (LOCAL_WORLD_ID, LOCAL_FOUNDRY_DATA in
 * its .env), whatever world that names. Suites MUTATE settings, actors and chat, and are tied to no world:
 * their fixtures are built from the compendia by `fixture-suite.mjs`, never cloned from a campaign's
 * characters, so any world the sandbox runs serves (2026-10-07).
 *   BTB_HOST=<an MCP host preset> node tools/verify-settings.mjs   → another instance, deliberately (the
 *   settings check after a deploy). No instance is named here: the presets live in the MCP repo's .env.
 * The repo's own variables are BTB_*; each BF_* name from before 3.0.0 (formerly Battle Flow) is still read
 * as its fallback, so an existing .env keeps working unedited.
 */
import { describeHolder, foundryConfig as clientConfig, listHolders } from 'fvtt-mcp-dnd5e/client';

const host = () => process.env.BTB_HOST || process.env.BF_HOST || 'local';

/**
 * The suite identity's BTB_* names, handed to the MCP client under the BF_* names it reads (its own
 * FOUNDRY_SUITE_* still win there). A BTB_* value beats a BF_* one; an env with neither is unchanged.
 */
function withAliases(env) {
  if ( !env ) return env;
  const out = { ...env };
  for ( const k of ['SUITE_USER', 'SUITE_PASSWORD'] ) if ( env[`BTB_${k}`] ) out[`BF_${k}`] = env[`BTB_${k}`];
  return out;
}

/** Who holds the bridge seat: this machine's seat records first, then the marker on its User document. */
function holderLines(bridgeUser, marker, env) {
  const lines = [];
  try {
    const cfg = clientConfig(env, host(), 'bridge');
    const here = listHolders(cfg.serverUrl, cfg.user).filter(h => !h.self);
    if (here.length) lines.push(`Held on this machine by ${here.map(describeHolder).join('; ')}.`);
  } catch { /* no env, or no records */ }
  if (marker) {
    lines.push(`"${bridgeUser}"'s User document says: pid ${marker.pid} on ${marker.host} — ${marker.label} — since ${marker.since}.`);
  }
  if (!lines.length) {
    lines.push('No seat record on this machine and no marker on its User document: a bridge older than MCP 4.4.0, or one on another machine.');
  }
  return lines.join(' ');
}

/** Resolve the Foundry connection config: the sandbox unless BTB_HOST names another preset. */
export function foundryConfig(env) {
  env = withAliases(env);
  const h = host();
  if (h !== 'local') {
    console.log(`[target] ⚠ host preset "${h}" — NOT the sandbox; this run mutates that world`);
    return clientConfig(env, h, 'bridge');
  }
  // ⚠ Suites join as their OWN identity (FOUNDRY_SUITE_USER, alias BTB_SUITE_USER, formerly BF_SUITE_USER), not the bridge's,
  // so a bridge/suite overlap is detectable: `game.users` and `/api/status` count USERS, not sockets.
  const cfg = clientConfig(env, 'local', 'suite');
  console.log(`[target] local sandbox (${cfg.serverUrl}) as "${cfg.user}"`);
  return cfg;
}

/**
 * The second client's config for two-client probes: the same instance, joined as the player test
 * identity (FOUNDRY_PLAYER_USER). No adminKey: a player never launches the world.
 */
export function playerConfig(env) {
  return clientConfig(withAliases(env), host(), 'player');
}

/**
 * Preflight: exactly one GM-capable client, and it is us. `game.users.activeGM` elects one of all
 * connected GM sessions, so a second one can BE the elect and the suite's assertions happen
 * somewhere this client cannot see.
 * `{ requireElect: false }` for a read-only probe; with `{ allowBridge: true }` for one that asserts nothing.
 * A run that asserts (`requireElect`, the default) also needs By the Books active and the old package
 * (formerly Battle Flow, `fvtt-mod-battleflow`) NOT active: with both on, By the Books is passive and every
 * "nothing happened" assertion would pass falsely. A read-only look (job.mjs --read-only) works either way.
 * ⚠ The bridge identity is held by EVERY open Claude session's MCP server, and `disconnect-bridge`
 * logs out only the calling one: when the other GM is the bridge, the message NAMES THE HOLDER —
 * the seat record the bridge leaves on this machine (MCP 4.4.0 and later, `listHolders`) and the marker it
 * writes on its User document (`flags.world.fvttMcpBridge`: pid, session, since) — and the cure:
 * `disconnect-bridge { all: true }` from any session, which ends every other holder's browser.
 */
export async function preflightSoleGM(f, { requireElect = true, allowBridge = false, env = null } = {}) {
  const bridgeUser = env?.FOUNDRY_USER ?? env?.LOCAL_FOUNDRY_USER ?? null;
  const who = await f.evaluate(async () => ({
    self: game.user.name,
    elect: game.users.activeGM?.name ?? null,
    isSelf: game.users.activeGM?.isSelf ?? false,
    gms: game.users.filter(u => u.active && u.isGM).map(u => u.name),
    markers: Object.fromEntries(game.users.filter(u => u.active && u.isGM && u.flags?.world?.fvttMcpBridge)
      .map(u => [u.name, u.flags.world.fvttMcpBridge])),
    module: !!game.modules.get('fvtt-mod-bythebooks')?.active,
    legacy: !!game.modules.get('fvtt-mod-battleflow')?.active,
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
        + `joins as. ${holderLines(bridgeUser, who.markers[bridgeUser], env)} `
        + 'disconnect-bridge { all: true } from any session ends every other holder\'s browser on this '
        + 'machine (their servers reconnect on their next call); then re-run. A read-only probe may pass '
        + '{ requireElect: false, allowBridge: true }.'
      : 'Disconnect the MCP bridge (disconnect-bridge) and close any GM window, then re-run. (Same '
        + 'account twice still counts twice: the elect is per-USER, so both pass isActiveGM and they '
        + 'fight over every application.)';
    throw new Error(
      `PREFLIGHT: ${who.gms.length} GM-capable clients connected (${who.gms.join(', ')}) — `
      + `exactly one must be. ${why}`);
  }
  if (requireElect && (!who.module || who.legacy)) {
    throw new Error('PREFLIGHT: '
      + (!who.module ? 'By the Books (fvtt-mod-bythebooks) is not active in this world'
        : 'Battle Flow (fvtt-mod-battleflow) is still active beside By the Books, which is therefore passive')
      + ' — every suite would assert against a module that does nothing. In Manage Modules: By the Books on, '
      + 'Battle Flow off, then reload the world and re-run.');
  }
  if (requireElect && !who.isSelf) {
    throw new Error(`PREFLIGHT: the elect is "${who.elect}", not this client ("${who.self}") — `
      + 'this run would assert on work happening elsewhere.');
  }
  return who;
}
