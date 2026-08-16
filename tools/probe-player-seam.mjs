// Two-client proving spike for the player seam (PC Assistant, created 2026-08-16).
// READ-ONLY: no settings touched, no messages posted, nothing rolled — safe during a live
// session. Proves the plumbing Phase 2's owner-election coverage will stand on:
//   1. the test player can join (no password) and reach game.ready
//   2. it owns BF Test PC Attacker (granted via the bridge)
//   3. the canAnswerFor seam flips: with the player CONNECTED, the GM side must see an
//      active non-GM owner (the module then refuses the GM the player's decisions)
//   4. who wins the activeGM elect between two role-4 users, measured, plus the getter
//      source so the tie-break rule is documented from the horse's mouth
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[seam] WATCHDOG 180s'); process.exit(3); }, 180_000);

let failures = 0;
const report = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const gm = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
console.log('[seam] GM connecting…');
await gm.connect();

// Baseline BEFORE the player joins: is any active non-GM an owner of the fixture?
const before = await gm.evaluate(async () => {
  const actor = game.actors.getName('BF Test PC Attacker');
  if (!actor) return { fatal: 'BF Test PC Attacker missing' };
  return {
    playerSeamOccupied: game.users.some(u => !u.isGM && u.active
      && actor.testUserPermission(u, 'OWNER')),
    activeGM: game.users.activeGM?.name ?? null,
    activeGMSource: (() => {
      try {
        const proto = Object.getPrototypeOf(game.users);
        const desc = Object.getOwnPropertyDescriptor(proto, 'activeGM')
          ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(proto), 'activeGM');
        return desc?.get?.toString() ?? 'getter not found';
      } catch (e) { return `unreadable: ${e.message}`; }
    })(),
  };
}, null);
if (before.fatal) { console.error(`[seam] FATAL: ${before.fatal}`); process.exit(2); }
console.log(`  activeGM getter:\n${before.activeGMSource.split('\n').map(l => `    ${l}`).join('\n')}`);
report('baseline: no active player owns the fixture yet', before.playerSeamOccupied === false,
  `occupied=${before.playerSeamOccupied}`);

console.log('[seam] player connecting…');
const player = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.MOLTEN_TEST_USER, password: env.MOLTEN_TEST_PASSWORD ?? '',
  worldId: env.MOLTEN_WORLD_ID,
});
await player.connect();

const playerSide = await player.evaluate(async () => {
  const actor = game.actors.getName('BF Test PC Attacker');
  return {
    user: game.user.name, role: game.user.role, isGM: game.user.isGM,
    actorVisible: !!actor,
    isOwner: actor?.isOwner ?? false,
    activeGM: game.users.activeGM?.name ?? null,
  };
}, null);
report('player joined with no password and reached ready',
  playerSide.user === env.MOLTEN_TEST_USER, `user=${playerSide.user} role=${playerSide.role}`);
report('player is role 1 and NOT a GM (the seam requires !isGM)',
  (playerSide.role === 1) && (playerSide.isGM === false),
  `role=${playerSide.role} isGM=${playerSide.isGM}`);
report('player OWNS BF Test PC Attacker',
  playerSide.actorVisible && playerSide.isOwner, `visible=${playerSide.actorVisible} owner=${playerSide.isOwner}`);

const after = await gm.evaluate(async () => {
  const actor = game.actors.getName('BF Test PC Attacker');
  const pcAssistant = game.users.getName('PC Assistant');
  return {
    pcActive: pcAssistant?.active ?? false,
    playerSeamOccupied: game.users.some(u => !u.isGM && u.active
      && actor.testUserPermission(u, 'OWNER')),
    activeGM: game.users.activeGM?.name ?? null,
    role4Active: game.users.filter(u => u.active && (u.role === 4)).map(u => u.name),
  };
}, null);
report('GM side sees the player active', after.pcActive === true, `active=${after.pcActive}`);
report('the canAnswerFor seam FLIPS: an active non-GM owner now exists (GM would be denied)',
  after.playerSeamOccupied === true, `occupied=${after.playerSeamOccupied}`);
report('both ends agree on one elect', playerSide.activeGM === after.activeGM,
  `player sees ${playerSide.activeGM}, GM sees ${after.activeGM}`);
console.log(`  ELECT with role-4 users [${after.role4Active.join(', ')}] connected: ${after.activeGM}`);

await player.disconnect?.();
await gm.disconnect?.();
console.log(failures ? `\n[seam] ${failures} FAILURE(S)` : '\n[seam] ALL PASS');
process.exit(failures ? 1 : 0);
