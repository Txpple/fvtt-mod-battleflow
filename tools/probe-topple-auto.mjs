// One-shot probe: smoke-effects §7's exact flow — a PC attack with a Topple-mastery weapon
// in masteryAsk AUTO mode — with a 30s ledger of every new message and the victim's prone
// status, to see WHEN (or whether) the topple card stamps and who presses prone.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[probe-topple-auto] WATCHDOG 150s'); process.exit(3); }, 150_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
await f.connect();
console.log('[probe-topple-auto] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const report = { errors: [], ledger: [] };
  const origError = console.error;
  console.error = (...a) => { report.errors.push(a.map(x => String(x?.message ?? x)).join(' ')); origError(...a); };

  const KEYS = ['masteryRiders', 'masteryAsk', 'autoDamage', 'autoApply', 'dramaticBeat',
    'requireTarget', 'reactionHold', 'riders', 'effectRiders', 'concMode', 'castApply',
    'saves', 'suppressAttackCards'];
  const prior = Object.fromEntries(KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const pc = game.actors.getName('BF Test PC Attacker');
  if (!scene || !victim || !pc) return { fatal: 'fixtures missing' };
  try {
    await set('masteryRiders', true);
    await set('masteryAsk', 'auto');
    await set('autoDamage', 'all');
    await set('autoApply', true);
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('riders', false);
    await set('effectRiders', false);
    await set('concMode', 'off');
    await set('castApply', false);
    await set('saves', false);
    await set('suppressAttackCards', false);

    if (canvas.scene?.id !== scene.id) await scene.view();
    report.victimEffects0 = victim.effects.map(e => ({ name: e.name, statuses: [...e.statuses], disabled: e.disabled }));
    if (victim.statuses.has('prone')) await victim.toggleStatusEffect('prone', { active: false });
    const priorVictim = {
      'system.attributes.hp.value': victim.system._source.attributes.hp.value,
      'system.attributes.ac.calc': victim.system._source.attributes.ac.calc,
      'system.attributes.ac.flat': victim.system._source.attributes.ac.flat,
    };
    await victim.update({
      'system.attributes.hp.value': victim.system.attributes.hp.max,
      'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1,
    });

    // the topple weapon + the trait, the suite's own fixture recipe (eligibility = trait + weapon)
    const priorPc = {
      'system.traits.weaponProf.mastery.value':
        Array.from(pc.system._source.traits?.weaponProf?.mastery?.value ?? []),
      'system.abilities.str.value': pc.system._source.abilities?.str?.value ?? 10,
    };
    await pc.update({
      'system.traits.weaponProf.mastery.value': ['dagger'],
      'system.abilities.str.value': 16,
    });
    const [weapon] = await pc.createEmbeddedDocuments('Item', [{
      name: 'BF Probe Dagger', type: 'weapon',
      system: {
        type: { value: 'simpleM', baseItem: 'dagger' }, mastery: 'topple',
        damage: { base: { number: 1, denomination: 4, types: ['piercing'] } },
        equipped: true, proficient: 1,
        activities: { bfprobeatk000000: {
          _id: 'bfprobeatk000000', type: 'attack',
          activation: { type: 'action', override: false },
          attack: { ability: '', bonus: '', critical: {}, flat: false,
            type: { value: 'melee', classification: 'weapon' } },
          damage: { critical: {}, includeBase: true, parts: [] },
          consumption: { targets: [] }, target: { override: false, prompt: true }
        } }
      }
    }]);
    report.weapon = weapon.name;

    let vtokDoc = scene.tokens.find(t => t.actorId === victim.id);
    let createdToken = null;
    if (!vtokDoc) {
      [vtokDoc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(victim.prototypeToken.toObject(),
          { x: 1400, y: 1400, actorId: victim.id, actorLink: true }, { inplace: false })]);
      createdToken = vtokDoc.id;
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(vtokDoc.id)); i++) await sleep(250);
    }
    const vtok = canvas.tokens.get(vtokDoc.id);
    if (!vtok) return { fatal: 'victim token never reached the canvas' };
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
    vtok.setTarget(true, { releaseOthers: true });
    await sleep(150);

    const before = new Set(game.messages.contents.map(m => m.id));
    const t0 = Date.now();
    const activity = weapon.system.activities.find(a => a.type === 'attack');
    await activity.use({}, { configure: false }, {});

    // 30-second ledger: every new message + prone state, sampled tightly.
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      const entry = { t: Date.now() - t0, prone: victim.statuses.has('prone'), msgs: [] };
      for (const m of game.messages.contents) {
        if (before.has(m.id)) continue;
        before.add(m.id);
        entry.msgs.push({
          id: m.id, type: m.type,
          dnd5eRoll: m.getFlag('dnd5e', 'roll')?.type ?? null,
          mastery: m.getFlag('dnd5e', 'roll.mastery') ?? null,
          bf: Object.keys(m.flags?.[MOD] ?? {}),
          topple: m.getFlag(MOD, 'topple') ? foundry.utils.deepClone(m.getFlag(MOD, 'topple')) : null,
          content: (m.content ?? '').slice(0, 120)
        });
      }
      if (entry.msgs.length || (i % 10 === 9)
        || (entry.prone !== (report.ledger.at(-1)?.prone ?? false))) report.ledger.push(entry);
    }

    // cleanup
    await pc.deleteEmbeddedDocuments('Item', [weapon.id]);
    await pc.update(priorPc);
    await victim.update(priorVictim);
    if (victim.statuses.has('prone')) await victim.toggleStatusEffect('prone', { active: false });
    if (createdToken && scene.tokens.get(createdToken)) {
      await scene.deleteEmbeddedDocuments('Token', [createdToken]);
    }
    const mine = game.messages.contents.filter(m => !before.has(m.id) === false && !new Set().has(m.id));
    const fresh = game.messages.contents.filter(m => (m.timestamp >= t0 - 5000)
      && (Object.keys(m.flags?.[MOD] ?? {}).length || (m.speaker?.alias ?? '').startsWith('BF ')
        || m.content?.includes?.('falls Prone') || m.getFlag('dnd5e', 'originatingMessage')));
    if (fresh.length) await ChatMessage.deleteDocuments([...new Set(fresh.map(m => m.id))]).catch(() => {});
    return report;
  } catch (err) {
    return { fatal: `${err?.message}\n${err?.stack}`, report };
  } finally {
    for (const [k, v] of Object.entries(prior)) await set(k, v);
    console.error = origError;
  }
}, null);

console.log(JSON.stringify(out, null, 2));
process.exit(out.fatal ? 2 : 0);
