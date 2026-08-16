// One-shot probe: why didn't the Topple fold fire? Stamps a minimal topple card, rolls a
// chained save, and dumps every gate the fold checks — plus any console.error the module
// swallowed. Cheap to re-run; extend this rather than printf-ing a suite.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[probe-topple] WATCHDOG 90s'); process.exit(3); }, 90_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
await f.connect();
console.log('[probe-topple] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const report = { errors: [] };
  const origError = console.error;
  console.error = (...args) => { report.errors.push(args.map(a => String(a?.message ?? a)).join(' ')); origError(...args); };

  try {
    const victim = game.actors.getName('BF Test Victim');
    if (!victim) return { fatal: 'no victim' };
    report.electIsSelf = game.users.activeGM?.isSelf ?? null;
    report.electName = game.users.activeGM?.name ?? null;

    const priorBonus = victim.system._source.bonuses?.abilities?.save ?? '';
    await victim.update({ 'system.bonuses.abilities.save': '-30' });

    const card = await ChatMessage.create({
      content: 'probe topple card',
      flags: { [MOD]: { topple: {
        dc: 10, ability: 'con', weapon: { name: 'Probe', img: null },
        targets: [{ uuid: victim.uuid, name: victim.name, done: false }]
      } } }
    });
    report.cardId = card.id;
    report.victimUuid = victim.uuid;

    const rolls = await victim.rollSavingThrow({ ability: 'con' }, { configure: false },
      { data: { 'flags.dnd5e.originatingMessage': card.id } });
    await sleep(2500);

    const saveMsg = rolls?.[0]?.parent ?? null;
    report.saveMsgFound = !!saveMsg;
    if (saveMsg) {
      report.saveFlags = foundry.utils.deepClone(saveMsg.flags?.dnd5e ?? {});
      report.saveType = saveMsg.getFlag('dnd5e', 'roll.type');
      report.saveAbility = saveMsg.getFlag('dnd5e', 'roll.ability');
      report.saveOrigin = saveMsg.getFlag('dnd5e', 'originatingMessage');
      report.saveTotal = saveMsg.rolls?.[0]?.total;
      const assoc = saveMsg.getAssociatedActor?.();
      report.assocUuid = assoc?.uuid ?? null;
      report.assocMatches = assoc?.uuid === victim.uuid;
    }
    const after = game.messages.get(card.id)?.getFlag(MOD, 'topple');
    report.after = foundry.utils.deepClone(after);
    report.prone = victim.statuses?.has?.('prone') ?? null;

    // cleanup
    await victim.update({ 'system.bonuses.abilities.save': priorBonus });
    if (victim.statuses?.has?.('prone')) await victim.toggleStatusEffect('prone', { active: false });
    const mine = game.messages.filter(m => (m.id === card.id) || (m === saveMsg)
      || (m.getFlag('dnd5e', 'originatingMessage') === card.id)
      || m.content?.includes?.('falls Prone'));
    if (mine.length) await ChatMessage.deleteDocuments([...new Set(mine.map(m => m.id))]);
    return report;
  } catch (err) {
    return { fatal: `${err?.message}\n${err?.stack}`, report };
  } finally {
    console.error = origError;
  }
}, null);

console.log(JSON.stringify(out, null, 2));
process.exit(out.fatal ? 2 : 0);
