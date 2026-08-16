// Battle Flow Phase 3 (cast slice) smoke test — auto-apply on cast, driven end to end in
// the live world: a no-save utility cast's effects land on every target (with concentration
// linkage, on BOTH buses — the native card and the suppression replacement), a heal
// activity's self-rolled healing lands through the shared applier, and the exclusions
// (damage activities, targetless casts) stay untouched.
//
// Harness discipline (HANDOFF): every setting touched is restored to whatever was found;
// every message this run creates is deleted on the way out; BF Test fixtures are long-rested;
// new-message searches go by ID-SET DIFFERENCE, never timestamps or tail windows.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}

setTimeout(() => { console.error('[cast] WATCHDOG 300s'); process.exit(3); }, 300_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
console.log('[cast] connecting…');
await f.connect();
console.log('[cast] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const suiteStart = Date.now();

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.castApply`)) {
    return { fatal: 'setting castApply not registered — this client is running OLD code (F5)' };
  }

  const SETTING_KEYS = ['castApply', 'autoDamage', 'autoApply', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'suppressAttackCards', 'suppressWeaponCards', 'suppressSpellCards',
    'suppressFeatureCards', 'suppressOtherCards', 'riders', 'effectRiders', 'masteryRiders',
    'concMode'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const shielder = game.actors.getName('BF Test Shielder');
  const npc = game.actors.getName('BF Test Attacker');
  if (!scene || !victim || !npc || !shielder) return { fatal: 'missing fixture: scene or BF Test actors' };

  const created = { items: [], tokens: [] };
  const priorActor = {};
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try {
      // End anything the caster is still concentrating on — the native dependentOn cascade
      // (active-GM — this client) strips the applied chips with it.
      for (const e of [...(npc.concentration?.effects ?? [])]) { try { await e.delete(); } catch { /* gone */ } }
      // Sweep stragglers on the targets by name (batched — the synthetic-actor lesson).
      for (const a of [victim, shielder]) {
        const strays = a.effects.filter(e => e.name.startsWith('BF Blessed'));
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
      for (const [actorId, data] of Object.entries(priorActor)) {
        await game.actors.get(actorId)?.update(data);
      }
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      for (const [k, v] of Object.entries(prior)) await set(k, v);
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
          || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('castApply', true);
    await set('autoDamage', 'off');     // no attacks in this suite
    await set('autoApply', false);      // the heal applier must be castApply's own, not 1b's
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);   // the Missile exclusion must not stamp a spell hold
    await set('riders', false);
    await set('effectRiders', false);   // the cast slice stands alone
    await set('masteryRiders', false);
    await set('concMode', 'off');
    await set('suppressAttackCards', false);
    await set('suppressWeaponCards', true);
    await set('suppressSpellCards', true);
    await set('suppressFeatureCards', true);
    await set('suppressOtherCards', true);

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    const mkToken = async (actor, x) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(),
          { x, y: 1000, actorId: actor.id, actorLink: true }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      return canvas.tokens.get(doc.id);
    };
    const victimToken = await mkToken(victim, 1000);
    const shielderToken = await mkToken(shielder, 1200);
    if (!victimToken || !shielderToken) return { fatal: 'target tokens never reached the canvas' };

    priorActor[victim.id] = {
      'system.attributes.hp.value': victim.system._source.attributes.hp.value,
    };

    // Fixture spells, the innate shape (consumption.spellSlot: false — how §6 gave an NPC a
    // working Magic Missile). Fixed 16-char ids so activities can name their effects.
    const EFF = 'bfblesseffect000';
    const [blessItem] = await npc.createEmbeddedDocuments('Item', [{
      name: 'BF Test Bless', type: 'spell',
      system: {
        level: 1, school: 'enc', properties: ['vocal', 'concentration'],
        duration: { value: '1', units: 'minute' },
        target: { affects: { type: 'creature', count: '2', choice: false } },
        range: { value: '30', units: 'ft' },
        method: 'spell', prepared: 1, identifier: 'bf-test-bless',
        activities: {
          bfcastutil000000: {
            _id: 'bfcastutil000000', type: 'utility',
            activation: { type: 'action', override: false },
            consumption: { targets: [], spellSlot: false },
            effects: [{ _id: EFF }],
            target: { override: false, prompt: true }
          }
        }
      },
      effects: [{
        _id: EFF, name: 'BF Blessed', transfer: false, disabled: false,
        img: 'icons/svg/angel.svg',
        description: '<p>Adds 1d4 to attack rolls and saving throws (BF test fixture).</p>',
        duration: { seconds: 60 },
        changes: [{ key: 'system.bonuses.abilities.save', mode: 2, value: '1d4' }]
      }]
    }]);
    created.items.push({ actorId: npc.id, id: blessItem.id });

    const [cureItem] = await npc.createEmbeddedDocuments('Item', [{
      name: 'BF Test Cure', type: 'spell',
      system: {
        level: 1, school: 'evo', properties: ['vocal'],
        target: { affects: { type: 'creature', count: '1', choice: false } },
        range: { value: '60', units: 'ft' },
        method: 'spell', prepared: 1, identifier: 'bf-test-cure',
        activities: {
          bfcastheal000000: {
            _id: 'bfcastheal000000', type: 'heal',
            activation: { type: 'action', override: false },
            consumption: { targets: [], spellSlot: false },
            healing: { number: 2, denomination: 4, bonus: '', types: ['healing'] },
            target: { override: false, prompt: true }
          }
        }
      }
    }]);
    created.items.push({ actorId: npc.id, id: cureItem.id });

    const [missileItem] = await npc.createEmbeddedDocuments('Item', [{
      name: 'BF Test Missile', type: 'spell',
      system: {
        level: 1, school: 'evo', properties: ['vocal'],
        target: { affects: { type: 'creature', count: '1', choice: false } },
        range: { value: '120', units: 'ft' },
        method: 'spell', prepared: 1, identifier: 'bf-test-missile',
        activities: {
          bfcastdmg0000000: {
            _id: 'bfcastdmg0000000', type: 'damage',
            activation: { type: 'action', override: false },
            consumption: { targets: [], spellSlot: false },
            damage: { parts: [{ number: 1, denomination: 4, types: ['force'] }] },
            target: { override: false, prompt: true }
          }
        }
      }
    }]);
    created.items.push({ actorId: npc.id, id: missileItem.id });

    const activityOf = (item, type) => npc.items.get(item.id).system.activities.find(a => a.type === type);
    const target = (...tokens) => {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      tokens.forEach((t, i) => t.setTarget(true, { releaseOthers: i === 0 }));
    };
    const snap = () => new Set(game.messages.contents.map(m => m.id));
    const fresh = before => game.messages.contents.filter(m => !before.has(m.id));
    const until = async (fn, ms = 6000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(200); }
      return fn();
    };
    const usageCards = msgs => msgs.filter(m =>
      (m.type === 'usage') || (m.getFlag('dnd5e', 'messageType') === 'usage'));

    // ---------------------------------------------------- 1. native-card bus (suppression off)
    target(victimToken, shielderToken);
    await sleep(120);
    let before = snap();
    let use = await activityOf(blessItem, 'utility').use({}, { configure: false }, {});
    if (use === undefined) return { fatal: 'the Bless fixture cast was refused' };
    await until(() => fresh(before).some(m => m.getFlag(MOD, 'effectReceipt')?.castDone));
    let msgs = fresh(before);
    const nativeCard = usageCards(msgs).find(m => m.getFlag(MOD, 'castApply'));
    ok('1a. with suppression off, the native card survives and carries the payload stamp',
      !!nativeCard && (nativeCard.getFlag(MOD, 'castApply').targets?.length === 2),
      `card=${!!nativeCard} targets=${nativeCard?.getFlag(MOD, 'castApply')?.targets?.length}`);

    const chipOn = a => a.effects.find(e => e.name === 'BF Blessed');
    const receipt1 = nativeCard?.getFlag(MOD, 'effectReceipt');
    ok('1b. the effects landed on BOTH targets with the receipt on the card',
      !!chipOn(victim) && !!chipOn(shielder) && !!receipt1?.castDone
        && (receipt1?.targets?.length === 2)
        && receipt1?.targets?.every(t => t.effects?.length === 1),
      `victim=${!!chipOn(victim)} shielder=${!!chipOn(shielder)} receiptTargets=${receipt1?.targets?.length}`);

    const concEffect = npc.concentration?.effects?.first?.() ?? [...(npc.concentration?.effects ?? [])][0];
    ok('1c. concentration linkage: origin is the caster\'s concentration effect, dependentOn set',
      !!concEffect && (chipOn(victim)?.origin === concEffect.uuid)
        && (chipOn(victim)?.getFlag('dnd5e', 'dependentOn') === concEffect.uuid),
      `conc=${concEffect?.uuid ?? 'NONE'} origin=${chipOn(victim)?.origin}`);

    ok('1d. the receipt entry carries the effect description (the tooltip)',
      !!receipt1?.targets?.[0]?.effects?.[0]?.description?.includes?.('1d4'),
      `description=${JSON.stringify(receipt1?.targets?.[0]?.effects?.[0]?.description ?? null)}`);

    // ---------------------------------------------------- 2. the replacement bus (suppression on)
    await set('suppressAttackCards', true); // spell bucket already pinned true
    target(victimToken, shielderToken);
    await sleep(120);
    before = snap();
    use = await activityOf(blessItem, 'utility').use({}, { configure: false }, {});
    if (use === undefined) return { fatal: 'the second Bless cast was refused' };
    await until(() => fresh(before).some(m => m.getFlag(MOD, 'effectReceipt')?.castDone));
    msgs = fresh(before);
    const replacement = msgs.find(m => m.getFlag(MOD, 'castApply') && !usageCards([m]).length);
    const suppressed = usageCards(msgs).length === 0;
    ok('2a. with suppression on, the native card dies and the replacement card is the bus',
      suppressed && !!replacement && replacement.content.includes('casts'),
      `usageCards=${usageCards(msgs).length} replacement=${!!replacement}`);

    const receipt2 = replacement?.getFlag(MOD, 'effectReceipt');
    const concEffect2 = [...(npc.concentration?.effects ?? [])][0];
    ok('2b. the payload path still lands both targets, receipts on the replacement',
      !!chipOn(victim) && !!chipOn(shielder) && !!receipt2?.castDone
        && (receipt2?.targets?.length === 2),
      `victim=${!!chipOn(victim)} shielder=${!!chipOn(shielder)} receiptTargets=${receipt2?.targets?.length}`);

    ok('2c. concentration linkage survives suppression (the payload carries it)',
      !!concEffect2 && (chipOn(victim)?.origin === concEffect2.uuid),
      `conc=${concEffect2?.uuid ?? 'NONE'} origin=${chipOn(victim)?.origin}`);

    // ---------------------------------------------------- 3. healing: dice roll, heal up
    const hpMax = victim.system.attributes.hp.max;
    await victim.update({ 'system.attributes.hp.value': Math.max(1, hpMax - 15) });
    const hpBefore = victim.system.attributes.hp.value;
    ok('3-pre. the patient is actually hurt (a number that cannot move proves nothing)',
      hpBefore < hpMax, `hp=${hpBefore}/${hpMax}`);
    target(victimToken);
    await sleep(120);
    before = snap();
    // subsequentActions:false + an explicit configure:false roll — the harness's timing
    // idiom (the §6 Magic Missile pattern): live, the subsequent roll opens the native
    // dialog on the caster's client, which is the player's own dice moment and stays.
    use = await activityOf(cureItem, 'heal').use({ subsequentActions: false }, { configure: false }, {});
    if (use === undefined) return { fatal: 'the Cure fixture cast was refused' };
    await activityOf(cureItem, 'heal').rollDamage({}, { configure: false },
      use?.message?.id ? { data: { 'flags.dnd5e.originatingMessage': use.message.id } } : {});
    await until(() => fresh(before).some(m => m.getFlag(MOD, 'receipt')));
    msgs = fresh(before);
    const healRoll = msgs.find(m => m.getFlag('dnd5e', 'roll.type') === 'healing');
    const healReceipt = healRoll?.getFlag(MOD, 'receipt');
    const rolled = healRoll?.rolls?.reduce((n, r) => n + r.total, 0) ?? 0;
    const hpAfter = victim.system.attributes.hp.value;
    ok('3a. the heal usage card is suppressed bare; the roll message carries the stamp',
      (usageCards(msgs).length === 0) && !!healRoll && !!healRoll.getFlag(MOD, 'healPending')
        && !msgs.some(m => m.getFlag(MOD, 'castApply')),
      `usageCards=${usageCards(msgs).length} roll=${!!healRoll}`);
    ok('3b. the healing landed for exactly the rolled total, receipt on the roll (autoApply OFF)',
      (rolled > 0) && (hpAfter === Math.min(hpMax, hpBefore + rolled))
        && (healReceipt?.targets?.[0]?.note === 'Healing')
        && (healReceipt?.targets?.[0]?.delta?.value === hpAfter - hpBefore),
      `rolled=${rolled} hp ${hpBefore}→${hpAfter} note=${healReceipt?.targets?.[0]?.note}`);

    // ---------------------------------------------------- 4. exclusion: a damage activity is not ours
    const mhpBefore = victim.system.attributes.hp.value;
    target(victimToken);
    await sleep(120);
    before = snap();
    use = await activityOf(missileItem, 'damage').use({ subsequentActions: false }, { configure: false }, {});
    if (use === undefined) return { fatal: 'the Missile fixture cast was refused' };
    await sleep(2000);
    msgs = fresh(before);
    ok('4a. a bare damage activity keeps its card, gets no stamp, and nothing applies',
      (usageCards(msgs).length === 1) && !msgs.some(m => m.getFlag(MOD, 'castApply'))
        && !msgs.some(m => m.getFlag(MOD, 'healPending'))
        && !msgs.some(m => m.getFlag(MOD, 'receipt'))
        && (victim.system.attributes.hp.value === mhpBefore),
      `usageCards=${usageCards(msgs).length} hp ${mhpBefore}→${victim.system.attributes.hp.value}`);

    // ---------------------------------------------------- 5. no targets, no feature
    target();
    await sleep(120);
    before = snap();
    use = await activityOf(blessItem, 'utility').use({}, { configure: false }, {});
    await sleep(1500);
    msgs = fresh(before);
    ok('5a. a targetless cast keeps its native card and is left to the humans',
      (use !== undefined) && (usageCards(msgs).length === 1)
        && !msgs.some(m => m.getFlag(MOD, 'castApply')),
      `usageCards=${usageCards(msgs).length}`);

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
    for (const a of [victim, shielder, npc].filter(Boolean)) {
      try { await a.longRest?.({ dialog: false, chat: false }); } catch { /* fine */ }
    }
  }
}, null);

if (out.fatal) {
  console.error(`\n[cast] FATAL: ${out.fatal}`);
  for (const r of out.results ?? []) console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.name}`);
  process.exit(2);
}
for (const l of out.log) console.log(`  ${l}`);
console.log('');
let failures = 0;
for (const r of out.results) {
  if (!r.pass) failures++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.pass ? '' : ` — ${r.detail}`}`);
}
for (const s of out.skips ?? []) console.log(`  SKIP ${s}`);
console.log(`\n[cast] ${out.results.length - failures}/${out.results.length} passed`);
process.exit(failures ? 1 : 0);
