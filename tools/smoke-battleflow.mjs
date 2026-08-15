// Battle Flow Phase 1 smoke test — drives a real attack chain in the live world through the
// bridge (same Foundry class the house scripts use) and asserts every link:
//   hit → auto damage roll → auto apply → receipt → revert (real DOM click) → miss → silence.
// Fixtures live on a dedicated "Battle Flow Test Range" scene (viewed LOCALLY, never
// activated — players' scene is untouched). Settings are switched on for the test and back
// OFF at the end: defaults-off is the design's dogfood contract.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}

setTimeout(() => { console.error('[smoke] WATCHDOG: 300s — hard abort'); process.exit(3); }, 300_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL,
  magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude',
  password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY,
  worldId: env.MOLTEN_WORLD_ID,
});

console.log('[smoke] connecting…');
await f.connect();
console.log('[smoke] connected');

let failures = 0;
const report = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// ---------------------------------------------------------------- 1. preflight + settings on
{
  const r = await f.evaluate(async () => {
    const MOD = 'fvtt-mod-battleflow';
    const mod = game.modules.get(MOD);
    if (!mod?.active) return { ok: false, why: `module active=${mod?.active}` };
    await game.settings.set(MOD, 'autoDamage', 'all');
    await game.settings.set(MOD, 'autoApply', true);
    await game.settings.set(MOD, 'dramaticBeat', 0);
    return {
      ok: true,
      user: game.user.name,
      isActiveGM: game.users.activeGM?.isSelf ?? false,
      autoDamage: game.settings.get(MOD, 'autoDamage'),
      autoApply: game.settings.get(MOD, 'autoApply'),
    };
  }, null);
  report('module active + settings on', r.ok && r.autoDamage === 'all' && r.autoApply === true,
    JSON.stringify(r));
  if (!r.ok || !r.isActiveGM) {
    console.error('[smoke] preflight failed (module inactive or bridge is not activeGM) — aborting');
    await f.disconnect?.();
    process.exit(1);
  }
}

// ------------------------------------------------------- 2. fixtures: scene, actors, tokens
const fx = await f.evaluate(async () => {
  const out = { log: [] };
  try {
    // Scene (idempotent by name; local view only — activation would move the players).
    let scene = game.scenes.getName('Battle Flow Test Range');
    if (!scene) {
      scene = await Scene.create({
        name: 'Battle Flow Test Range', width: 2000, height: 2000,
        grid: { size: 100 }, padding: 0, backgroundColor: '#333333',
        tokenVision: false, fog: { exploration: false },
      });
      out.log.push('created scene');
    }

    // Actors (idempotent by name; imported from the first monster pack carrying a goblin).
    const wanted = { attacker: 'BF Test Attacker', victim: 'BF Test Victim' };
    const actors = {};
    for (const [role, name] of Object.entries(wanted)) {
      actors[role] = game.actors.getName(name) ?? null;
    }
    if (!actors.attacker || !actors.victim) {
      let source = null;
      for (const pack of game.packs.filter(p => p.documentName === 'Actor')) {
        const index = await pack.getIndex();
        const hit = index.find(e => /goblin/i.test(e.name));
        if (hit) { source = await pack.getDocument(hit._id); break; }
      }
      if (!source) return { ok: false, why: 'no goblin found in any Actor compendium' };
      for (const [role, name] of Object.entries(wanted)) {
        if (actors[role]) continue;
        actors[role] = await Actor.create(
          foundry.utils.mergeObject(source.toObject(), { name }, { inplace: false }));
        out.log.push(`created ${name} from ${source.name}`);
      }
    }

    // The attacker needs an attack activity to press.
    const item = actors.attacker.items.find(i =>
      i.system.activities?.some?.(a => a.type === 'attack'));
    if (!item) return { ok: false, why: 'attacker has no item with an attack activity' };

    // Tokens (idempotent: reuse if already placed).
    const ensureToken = async actor => {
      let doc = scene.tokens.find(t => t.actorId === actor.id);
      if (!doc) {
        const proto = actor.prototypeToken.toObject();
        [doc] = await scene.createEmbeddedDocuments('Token', [
          foundry.utils.mergeObject(proto, {
            x: actor.name.endsWith('Victim') ? 1100 : 900, y: 1000,
            actorId: actor.id, actorLink: false,
          }, { inplace: false }),
        ]);
      }
      return doc.id;
    };
    const attackerToken = await ensureToken(actors.attacker);
    const victimToken = await ensureToken(actors.victim);

    // View the scene locally and wait for token objects to exist on canvas.
    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(victimToken)); i++) {
      await new Promise(r => setTimeout(r, 250));
    }
    if (!canvas.tokens.get(victimToken)) return { ok: false, why: 'canvas never readied' };

    return {
      ok: true, sceneId: scene.id,
      attackerId: actors.attacker.id, victimId: actors.victim.id,
      attackerToken, victimToken, itemName: item.name, log: out.log,
    };
  } catch (err) {
    return { ok: false, why: `${err.message}\n${err.stack}` };
  }
}, null);
report('fixtures (scene, actors, tokens, canvas)', fx.ok, fx.ok ? `${fx.itemName}; ${fx.log.join('; ') || 'reused'}` : fx.why);
if (!fx.ok) { process.exit(1); }

// ------------------------------------------------------------------------- 3. the hit chain
{
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    try {
      // The token is UNLINKED (the monster norm): the thing attacked — and damaged — is the
      // token's synthetic actor (base + delta), not the world actor. Assert against IT.
      const base = game.actors.get(victimId);
      const victim = canvas.tokens.get(victimToken).actor;
      const attacker = game.actors.get(attackerId);
      // Force a hit: flat AC 1 on the BASE (unlinked tokens derive live from base + delta,
      // so this propagates). Nat-1 fumble still misses — advantage makes that 1/400.
      await base.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });
      const hp0 = foundry.utils.deepClone(victim.system._source.attributes.hp);

      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const activity = attacker.items.getName(itemName).system.activities
        .find(a => a.type === 'attack');

      const msgCount = game.messages.size;
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      if (!usageId) return { ok: false, why: 'no usage message id' };

      const rolls = await activity.rollAttack(
        { advantage: true },
        { configure: false },
        { data: { 'flags.dnd5e.originatingMessage': usageId } });
      if (!rolls?.length) return { ok: false, why: 'attack roll produced no rolls' };
      const attackTotal = rolls[0].total;

      // Wait for the chain: damage message with a Battle Flow receipt flag.
      let damageMsg = null;
      for (let i = 0; i < 40 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.slice(-10).find(m =>
          m.getFlag('dnd5e', 'roll.type') === 'damage'
          && m.getFlag('dnd5e', 'originatingMessage') === usageId
          && m.getFlag('fvtt-mod-battleflow', 'receipt'));
      }
      if (!damageMsg) {
        const tail = game.messages.contents.slice(msgCount).map(m => ({
          id: m.id, type: m.getFlag('dnd5e', 'roll.type') ?? m.getFlag('dnd5e', 'messageType'),
          origin: m.getFlag('dnd5e', 'originatingMessage'),
          bf: !!m.getFlag('fvtt-mod-battleflow', 'receipt'),
        }));
        return { ok: false, why: `no receipted damage message; tail=${JSON.stringify(tail)}` };
      }

      const receipt = damageMsg.getFlag('fvtt-mod-battleflow', 'receipt');
      const entry = receipt.targets.find(t => t.uuid === victim.uuid);
      const hp1 = victim.system._source.attributes.hp;
      const damageTotal = damageMsg.rolls.reduce((n, r) => n + r.total, 0);
      return {
        ok: true, usageId, damageMsgId: damageMsg.id, attackTotal, damageTotal,
        entry, hp0: { value: hp0.value, temp: hp0.temp }, hp1: { value: hp1.value, temp: hp1.temp },
      };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    }
  }, fx);

  if (!r.ok) {
    report('hit → auto damage → auto apply → receipt', false, r.why);
    process.exit(1);
  }
  const applied = (r.hp0.value ?? 0) - (r.hp1.value ?? 0) + ((r.hp0.temp ?? 0) - (r.hp1.temp ?? 0));
  report('hit → auto damage roll (chained to usage card)', true,
    `attack ${r.attackTotal} vs AC 1; damage ${r.damageTotal}`);
  report('auto apply took HP', applied > 0 && applied <= r.damageTotal,
    `hp ${r.hp0.value}→${r.hp1.value} (applied ${applied} of ${r.damageTotal} rolled)`);
  report('receipt recorded prior + delta', !!r.entry
    && r.entry.prior.value === r.hp0.value
    && r.entry.delta.value === (r.hp1.value ?? 0) - (r.hp0.value ?? 0),
    JSON.stringify(r.entry));
  fx.damageMsgId = r.damageMsgId;
  fx.expectedHp = r.hp0;
}

// ------------------------------------------------------------- 4. revert via a real DOM click
{
  const r = await f.evaluate(async ({ damageMsgId, victimToken, expectedHp }) => {
    try {
      const button = document.querySelector(
        `[data-message-id="${damageMsgId}"] .battleflow-receipt button`);
      if (!button) return { ok: false, why: 'receipt revert button not found in chat DOM' };
      button.click();

      const victim = canvas.tokens.get(victimToken).actor; // the damaged (synthetic) actor
      let reverted = null;
      for (let i = 0; i < 40 && !reverted; i++) {
        await new Promise(r => setTimeout(r, 250));
        const flag = game.messages.get(damageMsgId)?.getFlag('fvtt-mod-battleflow', 'receipt');
        if (flag?.targets?.every(t => t.reverted)) reverted = flag;
      }
      if (!reverted) return { ok: false, why: 'reverted marker never set' };
      const hp = victim.system._source.attributes.hp;
      const buttonAfter = document.querySelector(
        `[data-message-id="${damageMsgId}"] .battleflow-receipt button`);
      return {
        ok: true, hp: { value: hp.value, temp: hp.temp }, expectedHp,
        buttonGone: !buttonAfter,
      };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    }
  }, fx);
  report('revert restores the HP snapshot (real click)',
    r.ok && r.hp.value === r.expectedHp.value && (r.hp.temp ?? null) === (r.expectedHp.temp ?? null),
    r.ok ? `hp back to ${r.hp.value}; button removed on re-render: ${r.buttonGone}` : r.why);
}

// -------------------------------------------------------------------------- 5. the miss test
{
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    try {
      const victim = game.actors.get(victimId);
      const attacker = game.actors.get(attackerId);
      await victim.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 40 });

      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const activity = attacker.items.getName(itemName).system.activities
        .find(a => a.type === 'attack');
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const rolls = await activity.rollAttack(
        { disadvantage: true },
        { configure: false },
        { data: { 'flags.dnd5e.originatingMessage': usageId } });
      const isCritical = rolls?.[0]?.isCritical ?? false;

      // Damage must NOT appear: a miss means the dice never exist. (A 1/400 nat-20 crit
      // hits regardless of AC — reported so a flake reads as a flake, not a bug.)
      let damageMsg = null;
      for (let i = 0; i < 16 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.slice(-6).find(m =>
          m.getFlag('dnd5e', 'roll.type') === 'damage'
          && m.getFlag('dnd5e', 'originatingMessage') === usageId);
      }
      return { ok: true, attackTotal: rolls?.[0]?.total, isCritical, damageAppeared: !!damageMsg };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    }
  }, fx);
  const expectSilence = r.ok && !r.isCritical;
  report('miss → damage dice never exist', r.ok && (expectSilence ? !r.damageAppeared : true),
    r.ok ? `attack ${r.attackTotal} vs AC 40${r.isCritical ? ' (CRIT — flake, hit is correct)' : ''}; damage appeared: ${r.damageAppeared}` : r.why);
}

// ------------------- 6. settings back off (the dogfood contract) + test chat-log cleanup
{
  const r = await f.evaluate(async () => {
    const MOD = 'fvtt-mod-battleflow';
    await game.settings.set(MOD, 'autoDamage', 'off');
    await game.settings.set(MOD, 'autoApply', false);
    const testMessages = game.messages.filter(m => m.speaker?.alias?.startsWith('BF Test'));
    await ChatMessage.deleteDocuments(testMessages.map(m => m.id));
    return {
      autoDamage: game.settings.get(MOD, 'autoDamage'),
      autoApply: game.settings.get(MOD, 'autoApply'),
      deletedMessages: testMessages.length,
    };
  }, null);
  report('settings restored to defaults (off) + chat cleaned', r.autoDamage === 'off' && r.autoApply === false,
    JSON.stringify(r));
}

console.log(failures ? `\n[smoke] ${failures} FAILURE(S)` : '\n[smoke] ALL PASS');
await f.disconnect?.();
process.exit(failures ? 1 : 0);
