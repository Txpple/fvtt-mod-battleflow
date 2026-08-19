// One-shot probe for the smoke-effects failures: vex payout, push announcement content,
// Guiding Bolt double-cast stacking, and the usage card's system.effects at preCreate.
// Read-only-ish: it attacks the test fixtures like the suite does, restores settings, and
// deletes its own messages.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig } from './target.mjs';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[probe] WATCHDOG 240s'); process.exit(3); }, 240_000);

const f = new Foundry(foundryConfig(env));
console.log('[probe] connecting…');
await f.connect();

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const report = {};
  const suiteStart = Date.now();

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'riders', 'effectRiders', 'masteryRiders',
    'masteryAsk', 'holdTimer'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const pc = game.actors.getName('BF Test PC Attacker');
  const shielder = game.actors.getName('BF Test Shielder');
  const created = { tokens: [], items: [] };
  const priorActor = {
    [victim.id]: {
      'system.attributes.ac.calc': victim.system._source.attributes.ac.calc,
      'system.attributes.ac.flat': victim.system._source.attributes.ac.flat,
    },
    [pc.id]: {
      'system.traits.weaponProf.mastery.value':
        Array.from(pc.system._source.traits?.weaponProf?.mastery?.value ?? []),
    },
  };

  try {
    for (const [k, v] of Object.entries({ autoDamage: 'all', autoApply: true, dramaticBeat: 0,
      requireTarget: false, reactionHold: false, riders: false,
      effectRiders: true, masteryRiders: true, masteryAsk: 'auto', holdTimer: 0 })) {
      await game.settings.set(MOD, k, v);
    }

    if (canvas.scene?.id !== scene.id) await scene.view();
    const [tokenDoc] = await scene.createEmbeddedDocuments('Token', [
      foundry.utils.mergeObject(victim.prototypeToken.toObject(),
        { x: 1400, y: 1100, actorId: victim.id, actorLink: true }, { inplace: false })]);
    created.tokens.push(tokenDoc.id);
    for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(tokenDoc.id)); i++) await sleep(250);
    const victimToken = canvas.tokens.get(tokenDoc.id);

    await victim.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1,
      'system.attributes.hp.value': victim.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });

    // The suite's weapon search, self-contained: owned first, else granted from a pack.
    let blade = pc.items.find(i => (i.type === 'weapon') && i.system.mastery
      && i.system.type?.baseItem && i.system.activities?.some?.(a => a.type === 'attack'));
    if (!blade) {
      packs: for (const pack of game.packs) {
        if (pack.documentName !== 'Item') continue;
        if (pack.metadata.id.startsWith('JB2A')) continue;
        let index;
        try { index = await pack.getIndex({ fields: ['type', 'system.mastery', 'system.type.baseItem'] }); } catch { continue; }
        for (const entry of index) {
          if ((entry.type !== 'weapon') || !entry.system?.mastery || !entry.system?.type?.baseItem) continue;
          const doc = await pack.getDocument(entry._id);
          if (doc.system.activities?.some?.(a => a.type === 'attack')) {
            [blade] = await pc.createEmbeddedDocuments('Item', [doc.toObject()]);
            created.items.push({ actorId: pc.id, id: blade.id });
            break packs;
          }
        }
      }
    }
    if (!blade) return { fatal: 'no mastery weapon found on the PC or in any pack' };
    await pc.update({ 'system.traits.weaponProf.mastery.value': [blade.system.type.baseItem] });
    await pc.items.get(blade.id).update({ 'system.mastery': 'vex' });
    report.blade = { name: blade.name, mastery: 'vex', base: blade.system.type.baseItem,
      damageParts: (blade.system.activities.find(a => a.type === 'attack')?.damage?.parts ?? [])
        .map(p => ({ n: p.number, d: p.denomination, types: [...(p.types ?? [])] })),
      baseDamage: { d: blade.system.damage?.base?.denomination, types: [...(blade.system.damage?.base?.types ?? [])] } };

    const attack = async activity => {
      victimToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
        usageId ? { data: { 'flags.dnd5e.originatingMessage': usageId } } : {});
      return { usageId, attackMsg: rolls?.[0]?.parent ?? null, roll: rolls?.[0] ?? null };
    };
    const waitDamage = async (originId, timeout = 10_000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) {
        const m = game.messages.contents.find(x =>
          (x.getFlag('dnd5e', 'roll.type') === 'damage')
          && (x.getFlag('dnd5e', 'originatingMessage') === originId));
        if (m) return m;
        await sleep(250);
      }
      return null;
    };

    // ---------------- A. VEX, fully instrumented
    {
      const pcAttack = pc.items.get(blade.id).system.activities.find(a => a.type === 'attack');
      const { usageId, attackMsg, roll } = await attack(pcAttack);
      const dmg = await waitDamage(usageId ?? attackMsg?.id);
      await sleep(2500); // give the payout chain time
      const receipt = dmg?.getFlag(MOD, 'receipt');
      const entry = receipt?.targets?.find(t => t.uuid === victim.uuid);
      report.vex = {
        masteryFlag: attackMsg?.getFlag('dnd5e', 'roll.mastery') ?? null,
        attackTotal: roll?.total, fumble: roll?.isFumble,
        damageMsg: !!dmg, damageTotal: dmg?.rolls?.reduce((n, r) => n + r.total, 0),
        receiptEntry: entry ? { uuid: entry.uuid, taken: entry.taken, delta: entry.delta,
          traits: entry.traits } : null,
        victimUuid: victim.uuid,
        snapshotUuids: (attackMsg?.getFlag('dnd5e', 'targets') ?? []).map(t => t.uuid),
        hp: victim.system.attributes.hp.value,
        effectReceipt: dmg?.getFlag(MOD, 'effectReceipt') ?? null,
        victimEffects: victim.effects.map(e => ({ name: e.name, disabled: e.disabled,
          origin: e.origin, mastery: e.getFlag(MOD, 'mastery') ?? null })),
      };
    }

    // ---------------- B. PUSH: what messages appear, verbatim
    {
      await pc.items.get(blade.id).update({ 'system.mastery': 'push' });
      const pcAttack = pc.items.get(blade.id).system.activities.find(a => a.type === 'attack');
      const before = game.messages.size;
      const { usageId, attackMsg } = await attack(pcAttack);
      await waitDamage(usageId ?? attackMsg?.id);
      await sleep(2500);
      report.push = game.messages.contents.slice(before).map(m => ({
        alias: m.speaker?.alias ?? null, type: m.type,
        rollType: m.getFlag('dnd5e', 'roll.type') ?? null,
        flags: Object.keys(m.flags?.[MOD] ?? {}),
        pushy: /push/i.test(m.content ?? ''),
        content: /push/i.test(m.content ?? '') ? (m.content ?? '').slice(0, 600) : undefined,
      }));
    }

    // ---------------- C. Guiding Bolt double cast: effect list between casts
    {
      const gb = [...(shielder?.items ?? []), ...pc.items].find(i => (i.type === 'spell')
        && i.system.activities?.some?.(a => a.type === 'attack') && i.effects?.size
        && !(i.system.properties?.has?.('concentration')));
      if (!gb) { report.gb = { missing: true }; }
      else {
        try { await gb.actor.longRest({ dialog: false, chat: false }); } catch { /* fine */ }
        const act = () => gb.actor.items.get(gb.id).system.activities.find(a => a.type === 'attack');
        // preCreate spy: capture the usage doc's system.effects as the veto hook would see it.
        const spy = { calls: [] };
        const hookId = Hooks.on('preCreateChatMessage', doc => {
          if ((doc.type === 'usage') && (doc.getFlag('dnd5e', 'item')?.uuid === gb.uuid)) {
            spy.calls.push({ systemEffects: doc.system?.effects ?? null,
              concentration: doc.system?.concentration ?? null,
              itemType: doc.getFlag('dnd5e', 'item')?.type });
          }
        });
        const effectList = () => victim.effects
          .filter(e => gb.effects.some(x => x.name === e.name))
          .map(e => ({ id: e.id, name: e.name, disabled: e.disabled, origin: e.origin,
            flags: e.flags?.[MOD] ?? null, dependentOn: e.getFlag('dnd5e', 'dependentOn') ?? null }));

        const one = await attack(act());
        const dmg1 = await waitDamage(one.usageId ?? one.attackMsg?.id);
        await sleep(2500);
        const afterCast1 = effectList();
        const two = await attack(act());
        const dmg2 = await waitDamage(two.usageId ?? two.attackMsg?.id);
        await sleep(2500);
        const afterCast2 = effectList();
        Hooks.off('preCreateChatMessage', hookId);
        report.gb = {
          spell: gb.name, actor: gb.actor.name, level: gb.system.level,
          itemEffectUuids: gb.effects.map(e => ({ id: e.id, uuid: e.uuid, name: e.name })),
          preCreate: spy.calls,
          afterCast1, afterCast2,
          effectReceipt1: dmg1?.getFlag(MOD, 'effectReceipt') ?? null,
          effectReceipt2: dmg2?.getFlag(MOD, 'effectReceipt') ?? null,
        };
      }
    }

    return report;
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, partial: report };
  } finally {
    try {
      for (const a of [victim, pc, shielder].filter(Boolean)) {
        const strays = a.effects.filter(e => e.getFlag(MOD, 'mastery')
          || ['Vexed', 'Sapped', 'Slowed'].includes(e.name)
          || (report.gb?.itemEffectUuids ?? []).some(x => x.name === e.name));
        if (strays.length) await a.deleteEmbeddedDocuments('ActiveEffect', strays.map(e => e.id));
      }
      for (const [actorId, ids] of Object.entries(created.items.reduce((m, i) => {
        (m[i.actorId] ??= []).push(i.id); return m;
      }, {}))) {
        const a = game.actors.get(actorId);
        const live = ids.filter(id => a?.items.get(id));
        if (live.length) await a.deleteEmbeddedDocuments('Item', live);
      }
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
      for (const [k, v] of Object.entries(prior)) await game.settings.set(MOD, k, v);
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
          || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
      for (const a of [victim, pc, shielder].filter(Boolean)) {
        try { await a.longRest({ dialog: false, chat: false }); } catch { /* fine */ }
      }
    } catch (err) { report.teardownError = err?.message; }
  }
}, null);

console.log(JSON.stringify(out, null, 2));
process.exit(out?.fatal ? 1 : 0);
