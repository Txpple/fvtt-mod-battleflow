/**
 * WHICH INSTANCE A SUITE TALKS TO — one decision, in one place (2026-08-19).
 *
 * The local sandbox is THE test environment now (user call). It is a byte copy of prod's
 * world imaged by `fvtt-mcp-molten5e/scripts/pull-prod-to-local.mjs`, so the same world id,
 * the same users and the same fixtures exist on both — which is exactly why a suite pointed
 * at the wrong one is so easy to miss and so expensive: these suites MUTATE settings, actors
 * and chat. Every harness in tools/ resolves its connection here so the choice can never
 * drift file by file, and every run prints the target it chose.
 *
 *   node tools/smoke-saves.mjs               → the local sandbox (default)
 *   BF_TARGET=prod node tools/smoke-saves.mjs → Molten prod, deliberately
 *
 * Local needs no magicUrl (nothing to wake) and uses LOCAL_ADMIN_KEY to launch a cold world;
 * the world id and join identity are inherited from the prod values because the sandbox is a
 * copy of prod — the same inheritance the MCP's `local` profile does (docs/local-sandbox.md).
 */

/** Resolve the Foundry connection config for the chosen target. */
export function foundryConfig(env) {
  const target = (process.env.BF_TARGET ?? 'local').toLowerCase();
  if ((target !== 'local') && (target !== 'prod')) {
    throw new Error(`BF_TARGET must be "local" or "prod" — got "${target}"`);
  }
  if (target === 'prod') {
    console.log('[target] PROD (Molten) — this run mutates the live world');
    return {
      serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
      user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
      adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
    };
  }
  const serverUrl = env.LOCAL_SERVER_URL || 'http://localhost:30000';
  // ⚠ The suites join as their OWN identity, NOT the MCP bridge's (user-created
  // "Tester Assistant", role 3, 2026-08-19). Not for parallelism — only one GM-capable
  // client may be connected either way, because the elect picks exactly one. It is for
  // DETECTABILITY: sharing DM Assistant made a bridge/suite collision invisible (both
  // `game.users` and `/api/status` count USERS, not sockets — measured), so it read as
  // nine mysterious failures instead of one loud abort. Distinct accounts make the
  // overlap visible to preflightSoleGM. Deliberately NOT `LOCAL_FOUNDRY_USER`: that key
  // belongs to the MCP's own local profile and would move the bridge too.
  const user = env.BF_SUITE_USER || 'Tester Assistant';
  console.log(`[target] local sandbox (${serverUrl}) as "${user}"`);
  return {
    serverUrl,                       // no magicUrl: a local box never sleeps
    user,
    password: env.BF_SUITE_PASSWORD ?? '',
    adminKey: env.LOCAL_ADMIN_KEY,
    worldId: env.LOCAL_WORLD_ID || env.MOLTEN_WORLD_ID,
  };
}

/**
 * The SECOND client's config for the two-client probes (probe-player-seam,
 * probe-popup-topology): same instance as foundryConfig picked, joined as the player test
 * identity instead of the bridge. No adminKey — the world is already up by the time a
 * second client joins, and a player has no business launching it.
 */
export function playerConfig(env) {
  const base = foundryConfig(env);
  return {
    serverUrl: base.serverUrl,
    ...(base.magicUrl ? { magicUrl: base.magicUrl } : {}),
    user: env.MOLTEN_TEST_USER, password: env.MOLTEN_TEST_PASSWORD ?? '',
    worldId: base.worldId,
  };
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
 * Pass `{ requireElect: false }` for a read-only probe that does not care who applies.
 */
export async function preflightSoleGM(f, { requireElect = true } = {}) {
  const who = await f.evaluate(async () => ({
    self: game.user.name,
    elect: game.users.activeGM?.name ?? null,
    isSelf: game.users.activeGM?.isSelf ?? false,
    gms: game.users.filter(u => u.active && u.isGM).map(u => u.name),
  }), null);
  if (who.gms.length > 1) {
    throw new Error(
      `PREFLIGHT: ${who.gms.length} GM-capable clients connected (${who.gms.join(', ')}) — `
      + 'exactly one must be. Disconnect the MCP bridge (disconnect-bridge) and close any GM '
      + 'window, then re-run. (Same account twice still counts twice: the elect is per-USER, '
      + 'so both pass isActiveGM and they fight over every application.)');
  }
  if (requireElect && !who.isSelf) {
    throw new Error(`PREFLIGHT: the elect is "${who.elect}", not this client ("${who.self}") — `
      + 'this run would assert on work happening elsewhere.');
  }
  return who;
}

/** True when this run is pointed at the live world — for guards that must not fire locally. */
export const isProdTarget = () => (process.env.BF_TARGET ?? 'local').toLowerCase() === 'prod';
