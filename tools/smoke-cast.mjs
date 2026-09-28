// Live suite: auto-apply on cast. A no-save utility cast's effects land on every target (with
// concentration linkage) on the native card; a heal activity's self-rolled healing lands through
// the shared applier; damage activities and targetless casts stay untouched.
//
// Every setting touched is restored; every message this run creates is deleted; BF Test fixtures
// are long-rested; new messages are found by ID-SET DIFFERENCE, never timestamps.
//
// Sections: `--section 3`, `--section 1,2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// The machines this suite drives (tools/coverage-map.mjs parses this). ⚠ NEVER import a suite:
// it connects on evaluation.
export const COVERS = [
  'cast.js',                // utility effects, the heal, the used-up item
  'polish.js'               // the birth stamps casting reads
];

const SECTIONS = {
  1: 'the native-card bus',
  2: 'the rip stayed ripped (v1.10.0)',
  3: 'healing: dice roll, heal up',
  4: 'damage activities: the card posts, the cast slice keeps its hands off',
  5: 'no targets, no feature',
  6: 'SELF-tagged activities self-aim (v1.11.0)',
  7: 'a used-up item still applies (2026-09-22): the last potion, and both drinks of a stack of two',
  8: 'Beacon of Hope (the spells slice, 2026-09-28): a target wearing Hopeful is healed the roll\'s MAXIMUM — the dice pinned low, the receipt says the maximum and names the spell; a bare target beside it gets the rolled total'
};
// §2 is the RE-cast: it asserts a second Bless refreshes the chips §1 landed, so it needs §1.
const DEPENDS = { 2: ['1'] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'cast', watchdogMs: 300_000 });
announcePlan('cast', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  // The section gate (tools/harness.mjs): the closure is serialized, so plan and titles arrive as DATA.
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const suiteStart = Date.now();

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.castApply`)) {
    return { fatal: 'setting castApply not registered — this client is running OLD code (F5)' };
  }

  const SETTING_KEYS = ['castApply', 'autoDamage', 'autoApply', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'blockList', 'riders', 'effectRiders', 'masteryRiders',
    'concMode', 'interruptList', 'holdApplyEffect'];
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
    // ⚠ SETTINGS FIRST, in their own guard: a later cleanup error must never leave suite settings on.
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      // End the caster's concentration: the native dependentOn cascade strips the applied chips.
      for (const e of [...(npc.concentration?.effects ?? [])]) { try { await e.delete(); } catch { /* gone */ } }
      // Sweep stragglers on the targets by name (batched: a synthetic actor rebuilds on every write).
      for (const a of [victim, shielder, npc]) {
        const strays = a.effects.filter(e =>
          e.name.startsWith('BF Blessed') || e.name.startsWith('BF Favored') || e.name.startsWith('BF Potioned'));
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
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
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
    await set('effectRiders', false);   // casting stands alone
    await set('masteryRiders', false);
    await set('concMode', 'off');

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

    // Fixture spells, innate (consumption.spellSlot: false). Fixed 16-char ids so activities can name their effects.
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
        changes: [{ key: 'system.rolls.ability.save.bonus', mode: 2, value: '1d4' }]
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
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
      tokens.forEach((t, i) => { t.setTarget(true, { releaseOthers: i === 0 }); });
    };
    const snap = () => new Set(game.messages.contents.map(m => m.id));
    const fresh = before => game.messages.contents.filter(m => !before.has(m.id));
    const until = async (fn, ms = 6000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(200); }
      return fn();
    };
    const usageCards = msgs => msgs.filter(m =>
      (m.type === 'usage'));

    // Shared across sections, so declared outside the section gates.
    let before;
    let use;
    let msgs;
    const chipOn = a => a.effects.find(e => e.name === 'BF Blessed');

    // ---------------------------------------------------- 1. the native-card bus
    if (want(1)) {
      target(victimToken, shielderToken);
      await sleep(120);
      before = snap();
      use = await activityOf(blessItem, 'utility').use({}, { configure: false }, {});
      if (use === undefined) return { fatal: 'the Bless fixture cast was refused' };
      await until(() => fresh(before).some(m => m.getFlag(MOD, 'effectReceipt')?.castDone));
      msgs = fresh(before);
      const nativeCard = usageCards(msgs).find(m => m.getFlag(MOD, 'castApply'));
      ok('1a. the native card posts and carries the payload stamp',
        !!nativeCard && (nativeCard.getFlag(MOD, 'castApply').targets?.length === 2),
        `card=${!!nativeCard} targets=${nativeCard?.getFlag(MOD, 'castApply')?.targets?.length}`);

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

    }
    // ---------------------------------------------------- 2. no suppression machinery
    if (want(2)) {
      // A re-registered suppression setting is the regression; one cast is exactly one usage card.
      ok('2a. the suppression settings are unregistered (the machinery stayed dead)',
        ['suppressAttackCards', 'suppressWeaponCards', 'suppressSpellCards',
          'suppressFeatureCards', 'suppressOtherCards']
          .every(k => !game.settings.settings.has(`${MOD}.${k}`)),
        'a suppress* key is registered again');

      target(victimToken, shielderToken);
      await sleep(120);
      before = snap();
      use = await activityOf(blessItem, 'utility').use({}, { configure: false }, {});
      if (use === undefined) return { fatal: 'the second Bless cast was refused' };
      await until(() => fresh(before).some(m => m.getFlag(MOD, 'effectReceipt')?.castDone));
      msgs = fresh(before);
      const secondCard = usageCards(msgs).find(m => m.getFlag(MOD, 'castApply'));
      ok('2b. every use shows its first card: exactly one usage card, the stamp on it',
        (usageCards(msgs).length === 1) && !!secondCard
          && !msgs.some(m => m.getFlag(MOD, 'castApply') && !usageCards([m]).length),
        `usageCards=${usageCards(msgs).length}`);

      const receipt2 = secondCard?.getFlag(MOD, 'effectReceipt');
      const concEffect2 = [...(npc.concentration?.effects ?? [])][0];
      ok('2c. the re-cast lands both targets again, receipts + concentration linkage on the card',
        !!chipOn(victim) && !!chipOn(shielder) && !!receipt2?.castDone
          && (receipt2?.targets?.length === 2)
          && !!concEffect2 && (chipOn(victim)?.origin === concEffect2.uuid),
        `victim=${!!chipOn(victim)} shielder=${!!chipOn(shielder)} receiptTargets=${receipt2?.targets?.length} origin=${chipOn(victim)?.origin}`);

    }
    // ---------------------------------------------------- 3. healing: dice roll, heal up
    if (want(3)) {
      const hpMax = victim.system.attributes.hp.max;
      await victim.update({ 'system.attributes.hp.value': Math.max(1, hpMax - 15) });
      const hpBefore = victim.system.attributes.hp.value;
      ok('3-pre. the patient is actually hurt (a number that cannot move proves nothing)',
        hpBefore < hpMax, `hp=${hpBefore}/${hpMax}`);
      target(victimToken);
      await sleep(120);
      before = snap();
      // subsequentActions:false + an explicit configure:false roll: live, the subsequent roll opens the
      // native dialog on the caster's client.
      use = await activityOf(cureItem, 'heal').use({ subsequentActions: false }, { configure: false }, {});
      if (use === undefined) return { fatal: 'the Cure fixture cast was refused' };
      await activityOf(cureItem, 'heal').rollDamage({}, { configure: false },
        use?.message?.id ? { data: { 'system.origin': use.message.id } } : {});
      await until(() => fresh(before).some(m => m.getFlag(MOD, 'receipt')));
      msgs = fresh(before);
      const healRoll = msgs.find(m => m.type === 'healing');
      const healReceipt = healRoll?.getFlag(MOD, 'receipt');
      const rolled = healRoll?.rolls?.reduce((n, r) => n + r.total, 0) ?? 0;
      const hpAfter = victim.system.attributes.hp.value;
      ok('3a. the heal keeps its card (v1.10.0 — every use posts); the roll carries the stamp',
        (usageCards(msgs).length === 1) && !!healRoll && !!healRoll.getFlag(MOD, 'healPending')
          && !msgs.some(m => m.getFlag(MOD, 'castApply')),
        `usageCards=${usageCards(msgs).length} roll=${!!healRoll}`);
      ok('3b. the healing landed for exactly the rolled total, receipt on the roll (autoApply OFF)',
        (rolled > 0) && (hpAfter === Math.min(hpMax, hpBefore + rolled))
          && (healReceipt?.targets?.[0]?.note === 'Healing')
          && (healReceipt?.targets?.[0]?.delta?.value === hpAfter - hpBefore),
        `rolled=${rolled} hp ${hpBefore}→${hpAfter} note=${healReceipt?.targets?.[0]?.note}`);

    }
    // ---------------------------------------------------- 4. damage activities: the card posts,
    if (want(4)) {
      // casting keeps its hands off — Magic Missile is the negate hold's seam. The DICE are the
      // damage-cast machine's (always on since the settings cut): it rolls at the use, chained to the
      // card, and the spellDamage applier lands it — never a castApply stamp.
      // Whole HP first, so the hit is measurable (a victim at 3 HP clamps at 0).
      await victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max });
      const mhpBefore = victim.system.attributes.hp.value;
      target(victimToken);
      await sleep(120);
      before = snap();
      use = await activityOf(missileItem, 'damage').use({ subsequentActions: false }, { configure: false }, {});
      if (use === undefined) return { fatal: 'the Missile fixture cast was refused' };
      await until(() => fresh(before).some(m => (m.type === 'damage') && m.getFlag(MOD, 'receipt')), 6000);
      msgs = fresh(before);
      const mDmg = msgs.find(m => m.type === 'damage');
      const mRolled = mDmg ? mDmg.rolls.reduce((a, r) => a + r.total, 0) : null;
      ok('4a. a damage spell keeps its card and castApply stays out; the damage cast rolls and lands it once',
        (usageCards(msgs).length === 1) && !msgs.some(m => m.getFlag(MOD, 'castApply'))
          && !msgs.some(m => m.getFlag(MOD, 'healPending'))
          && (msgs.filter(m => m.type === 'damage').length === 1)
          && (mDmg?.getFlag(MOD, 'spellDamage') === true) && !!mDmg?.getFlag(MOD, 'receipt')
          && (victim.system.attributes.hp.value === Math.max(0, mhpBefore - mRolled)),
        `usageCards=${usageCards(msgs).length} damageRolls=${msgs.filter(m => m.type === 'damage').length}`
          + ` rolled=${mRolled} hp ${mhpBefore}→${victim.system.attributes.hp.value}`);
      // 4b (a LISTED damage spell with no reactor holds nothing) retired here: the block list is the
      // code table (Magic Missile only), and smoke-hold §6e / smoke-volleys §6a own that claim.

    }
    // ---------------------------------------------------- 5. no targets, no feature
    if (want(5)) {
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

    }
    // ---------------------------------------------------- 6. SELF-tagged activities self-aim
    if (want(6)) {
      // A self activity ignores the UI targets, aims at its own actor, and needs no target at all.
      const [windItem] = await npc.createEmbeddedDocuments('Item', [{
        name: 'BF Test Second Wind', type: 'feat',
        system: {
          type: { value: 'class' },
          activities: {
            bfselfheal000000: {
              _id: 'bfselfheal000000', type: 'heal',
              activation: { type: 'bonus', override: false },
              consumption: { targets: [], spellSlot: false },
              range: { override: false, units: 'self' },
              target: { override: false, prompt: false,
                affects: { type: 'self', count: '', choice: false } },
              healing: { number: 1, denomination: 4, bonus: '', types: ['healing'],
                custom: { enabled: true, formula: '7' } }
            }
          }
        }
      }]);
      created.items.push({ actorId: npc.id, id: windItem.id });

      priorActor[npc.id] = {
        'system.attributes.hp.value': npc.system._source.attributes.hp.value,
      };
      const npcMax = npc.system.attributes.hp.max;
      await npc.update({ 'system.attributes.hp.value': Math.max(1, npcMax - 10) });
      const npcBefore = npc.system.attributes.hp.value;
      const vBefore6 = victim.system.attributes.hp.value;
      target(victimToken); // the WRONG target, on purpose
      await sleep(120);
      before = snap();
      use = await activityOf(windItem, 'heal').use({ subsequentActions: false }, { configure: false }, {});
      if (use === undefined) return { fatal: 'the Second Wind fixture use was refused' };
      await activityOf(windItem, 'heal').rollDamage({}, { configure: false },
        use?.message?.id ? { data: { 'system.origin': use.message.id } } : {});
      await until(() => fresh(before).some(m => m.getFlag(MOD, 'receipt')));
      msgs = fresh(before);
      const windRoll = msgs.find(m => m.type === 'healing');
      const windStamp = windRoll?.getFlag(MOD, 'healPending');
      const windReceipt = windRoll?.getFlag(MOD, 'receipt');
      ok('6a. a SELF heal aims at its caster — the wrong target is ignored, the stamp says self',
        (windStamp?.selfAim === true) && (windStamp?.uuid === npc.uuid)
          && (npc.system.attributes.hp.value === Math.min(npcMax, npcBefore + 7))
          && (victim.system.attributes.hp.value === vBefore6)
          && (windReceipt?.targets?.length === 1) && (windReceipt?.targets?.[0]?.uuid === npc.uuid),
        `stamp=${JSON.stringify(windStamp ?? null)} npc ${npcBefore}→${npc.system.attributes.hp.value}`
          + ` victim ${vBefore6}→${victim.system.attributes.hp.value}`);

      await npc.update({ 'system.attributes.hp.value': Math.max(1, npcMax - 10) });
      const npcBefore2 = npc.system.attributes.hp.value;
      target(); // nobody targeted at all — the stamp must not need a snapshot
      await sleep(120);
      before = snap();
      use = await activityOf(windItem, 'heal').use({ subsequentActions: false }, { configure: false }, {});
      if (use === undefined) return { fatal: 'the bare Second Wind use was refused' };
      await activityOf(windItem, 'heal').rollDamage({}, { configure: false },
        use?.message?.id ? { data: { 'system.origin': use.message.id } } : {});
      await until(() => fresh(before).some(m => m.getFlag(MOD, 'receipt')));
      ok('6b. a SELF heal needs no target at all — a bare cast lands on the caster',
        npc.system.attributes.hp.value === Math.min(npcMax, npcBefore2 + 7),
        `npc ${npcBefore2}→${npc.system.attributes.hp.value}`);

      const FAV = 'bffavoreffect000';
      const [favorItem] = await npc.createEmbeddedDocuments('Item', [{
        name: 'BF Test Favor', type: 'spell',
        system: {
          level: 1, school: 'evo', properties: ['vocal'],
          target: { affects: { type: 'self', count: '', choice: false } },
          range: { units: 'self' },
          method: 'spell', prepared: 1, identifier: 'bf-test-favor',
          activities: {
            bfselfutil000000: {
              _id: 'bfselfutil000000', type: 'utility',
              activation: { type: 'bonus', override: false },
              consumption: { targets: [], spellSlot: false },
              effects: [{ _id: FAV }],
              target: { override: false, prompt: false }
            }
          }
        },
        effects: [{
          _id: FAV, name: 'BF Favored', transfer: false, disabled: false,
          img: 'icons/svg/sun.svg', duration: { seconds: 60 },
          description: '<p>+1d4 melee damage (BF test fixture).</p>',
          changes: [{ key: 'system.rolls.damage.mwak.bonus', mode: 2, value: '1d4' }]
        }]
      }]);
      created.items.push({ actorId: npc.id, id: favorItem.id });

      target(victimToken); // wrong target up again — the chip must not land there
      await sleep(120);
      before = snap();
      use = await activityOf(favorItem, 'utility').use({}, { configure: false }, {});
      if (use === undefined) return { fatal: 'the Favor fixture cast was refused' };
      await until(() => fresh(before).some(m => m.getFlag(MOD, 'effectReceipt')?.castDone));
      msgs = fresh(before);
      const favorCard = usageCards(msgs).find(m => m.getFlag(MOD, 'castApply'));
      ok('6c. a SELF utility applies its effect to the caster, never the snapshot',
        !!favorCard && (favorCard.getFlag(MOD, 'castApply').targets?.length === 1)
          && (favorCard.getFlag(MOD, 'castApply').targets?.[0]?.uuid === npc.uuid)
          && !!npc.effects.find(e => e.name === 'BF Favored')
          && !victim.effects.find(e => e.name === 'BF Favored'),
        `card=${!!favorCard} payloadTargets=${JSON.stringify(favorCard?.getFlag(MOD, 'castApply')?.targets ?? null)}`
          + ` npcChip=${!!npc.effects.find(e => e.name === 'BF Favored')}`
          + ` victimChip=${!!victim.effects.find(e => e.name === 'BF Favored')}`);

      // 6d. A LISTED reaction cast FREESTANDING self-aims like any SELF ability (RULINGS *A listed
      // reaction cast freestanding*): the carve-out keys on a PENDING HOLD naming the caster (6e).
      // The Interrupt list is the code table: the fixture wears Shield's identifier here so the
      // table lists it (identifier first, then name); restored after 6e.
      await favorItem.update({ 'system.identifier': 'shield' });
      const favored = () => npc.effects.filter(e => e.name === 'BF Favored');
      await npc.deleteEmbeddedDocuments('ActiveEffect', favored().map(e => e.id));
      target(victimToken); // an incidental enemy target — the snapshot must not steer a SELF cast
      await sleep(120);
      before = snap();
      use = await activityOf(favorItem, 'utility').use({}, { configure: false }, {});
      await until(() => fresh(before).some(m => m.getFlag(MOD, 'effectReceipt')?.castDone));
      msgs = fresh(before);
      const listedCard = usageCards(msgs).find(m => m.getFlag(MOD, 'castApply'));
      ok('6d. a LISTED reaction cast with no hold pending self-aims — the caster, never the snapshot',
        (use !== undefined) && !!listedCard
          && (listedCard.getFlag(MOD, 'castApply').targets?.length === 1)
          && (listedCard.getFlag(MOD, 'castApply').targets?.[0]?.uuid === npc.uuid)
          && (favored().length === 1) && !victim.effects.some(e => e.name === 'BF Favored'),
        `card=${!!listedCard} payloadTargets=${JSON.stringify(listedCard?.getFlag(MOD, 'castApply')?.targets ?? null)}`
          + ` npcChips=${favored().length} victimChip=${!!victim.effects.find(e => e.name === 'BF Favored')}`);

      // 6e. With a hold PENDING on the caster the cast is an ANSWER and the hold machinery owns its
      // application: casting must not stamp, so the effect lands at most ONCE. A pending hold is
      // fabricated here (the hold flag's shape); the real hold path is smoke-hold's.
      await npc.deleteEmbeddedDocuments('ActiveEffect', favored().map(e => e.id));
      const fakeHold = await ChatMessage.create({
        content: '<p>BF Test: a fabricated pending hold (smoke-cast 6e)</p>',
        flags: { [MOD]: { hold: { status: 'pending', trigger: 'attack',
          targets: [{ uuid: npc.uuid, name: npc.name, reaction: 'BF Test Favor', ac: 10 }] } } }
      });
      try {
        target();
        await sleep(120);
        before = snap();
        use = await activityOf(favorItem, 'utility').use({}, { configure: false }, {});
        await sleep(1800);
        msgs = fresh(before).filter(m => m.id !== fakeHold.id);
        ok('6e. a LISTED reaction cast while a hold is pending on the caster is the hold\'s — no cast stamp, at most one chip',
          (use !== undefined) && !msgs.some(m => m.getFlag(MOD, 'castApply'))
            && (favored().length <= 1),
          `castApplyStamps=${msgs.filter(m => m.getFlag(MOD, 'castApply')).length}`
            + ` npcChips=${favored().length}`);
      } finally {
        await fakeHold.delete().catch(() => {});
        await npc.deleteEmbeddedDocuments('ActiveEffect', favored().map(e => e.id)).catch(() => {});
      }
      await favorItem.update({ 'system.identifier': 'bf-test-favor' });
    }

    // ---------------------------------------------------- 7. a used-up item still applies
    // dnd5e SPENDS before it posts (NOTES *A use SPENDS before it posts*): the last potion is deleted
    // before its card exists, so casting reads the activity off the card's snapshot. A stack keeps its
    // item until the last drink: both shapes are walked.
    if (want(7)) {
      // ⚠ THE DRINKER IS THE TOKEN'S OWN ACTOR when the token is unlinked (the monster norm): the card
      // names that token, so the effect lands there, not on the world actor.
      const drinker = scene.tokens.find(t => t.actorId === npc.id)?.actor ?? npc;
      const POT = 'bfpotioneffect00';
      const potion = qty => ({
        name: 'BF Test Potion', type: 'consumable',
        system: {
          type: { value: 'potion' }, quantity: qty,
          uses: { max: '1', spent: 0, autoDestroy: true, recovery: [] },
          activities: {
            bfpotionutil0000: {
              _id: 'bfpotionutil0000', type: 'utility',
              activation: { type: 'bonus', override: false },
              consumption: { targets: [{ type: 'itemUses', value: '1', target: '' }], spellSlot: false },
              effects: [{ _id: POT }],
              range: { override: false, units: 'self' },
              target: { override: false, prompt: false, affects: { type: 'self', count: '', choice: false } }
            }
          }
        },
        effects: [{
          _id: POT, name: 'BF Potioned', transfer: false, disabled: false,
          img: 'icons/svg/aura.svg', duration: { seconds: 3600 },
          description: '<p>Resistance to Poison damage (BF test fixture).</p>',
          changes: [{ key: 'system.traits.dr.value', mode: 2, value: 'poison' }]
        }]
      });
      const potioned = () => drinker.effects.filter(e => e.name === 'BF Potioned');
      const clearPotioned = async () => { if (potioned().length) await drinker.deleteEmbeddedDocuments('ActiveEffect', potioned().map(e => e.id)); };
      /** Drink once: the use, the card, the item's fate, and the effect on the drinker. */
      const drink = async item => {
        await clearPotioned();
        target();   // SELF — no target needed, none given
        await sleep(120);
        const act = drinker.items.get(item.id)?.system.activities.get('bfpotionutil0000');
        if (!act) return { refused: true };
        const used = await act.use({}, { configure: false }, {});
        const card = (used?.message instanceof ChatMessage) ? used.message : null;
        const stamp = card?.getFlag(MOD, 'castApply') ?? null;
        const done = card ? await until(() => card.getFlag(MOD, 'effectReceipt')?.castDone, 8000) : false;
        const chip = potioned()[0] ?? null;
        return { card: !!card, stamp: !!stamp, done: !!done, chip: !!chip, left: drinker.items.get(item.id)?.system.quantity ?? 0,
          resists: drinker.system.traits.dr.value.has('poison'), receipt: (card?.getFlag(MOD, 'effectReceipt')?.targets ?? []).map(t => t.uuid) };
      };
      try {
        const [single] = await drinker.createEmbeddedDocuments('Item', [potion(1)]);
        const a = await drink(single);
        ok('7a. the LAST potion: the drink deletes it before the card, and its effect still lands on the drinker, receipted',
          a.card && a.stamp && a.done && a.chip && (a.left === 0) && a.resists && (a.receipt.join() === drinker.uuid), JSON.stringify(a));

        const [stack] = await drinker.createEmbeddedDocuments('Item', [potion(2)]);
        const b1 = await drink(stack);
        ok('7b. a stack of TWO, the first drink: the item stays (quantity 1) and the effect lands',
          b1.stamp && b1.done && b1.chip && (b1.left === 1), JSON.stringify(b1));
        const b2 = await drink(stack);
        ok('7c. …and the second drink uses the stack up — the item is gone and the effect lands all the same',
          b2.stamp && b2.done && b2.chip && (b2.left === 0), JSON.stringify(b2));
      } finally {
        await clearPotioned();
        // The teardown's item sweep reads world actors; a potion left on the token's own actor goes here.
        const left = drinker.items.filter(i => i.name === 'BF Test Potion').map(i => i.id);
        if (left.length) await drinker.deleteEmbeddedDocuments('Item', left).catch(() => {});
      }
    }

    // ================================================== 8. Beacon of Hope: healing at its maximum
    if (want(8)) {
      const realPRNG = CONFIG.Dice.randomUniform;
      let hopeful = null;
      try {
        const hpMax = victim.system.attributes.hp.max;
        await victim.update({ 'system.attributes.hp.max': 200, 'system.attributes.hp.value': 1 });
        [hopeful] = await victim.createEmbeddedDocuments('ActiveEffect', [{ name: 'Hopeful', img: 'icons/svg/aura.svg', transfer: false, disabled: false }]);
        target(victimToken);
        await sleep(120);
        CONFIG.Dice.randomUniform = () => 1 - (0.5 / 8);   // every die a 1
        before = snap();
        use = await activityOf(cureItem, 'heal').use({ subsequentActions: false }, { configure: false }, {});
        await activityOf(cureItem, 'heal').rollDamage({}, { configure: false },
          use?.message?.id ? { data: { 'system.origin': use.message.id } } : {});
        CONFIG.Dice.randomUniform = realPRNG;
        await until(() => fresh(before).some(m => m.getFlag(MOD, 'receipt')), 12000);
        msgs = fresh(before);
        const healRoll = msgs.find(m => m.type === 'healing');
        const rolled = healRoll?.rolls?.reduce((n, r) => n + r.total, 0) ?? 0;
        const maxOf = roll => { let t = 0; let sign = 1; for (const term of roll.terms) { if (term.operator) { sign = term.operator === '-' ? -1 : 1; continue; } t += sign * (Number.isFinite(term.faces) ? term.number * term.faces : (term.number ?? term.total ?? 0)); sign = 1; } return t; };
        const maximum = healRoll?.rolls?.reduce((n, r) => n + maxOf(r), 0) ?? 0;
        const entry = healRoll?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid);
        const hpAfter = victim.system.attributes.hp.value;
        ok('8a. the dice pinned low: the rolled total is below the maximum (a number that cannot move proves nothing)', rolled < maximum, `rolled=${rolled} max=${maximum}`);
        ok('8b. the Hopeful target is healed the MAXIMUM, the receipt saying so and naming Beacon of Hope',
          (hpAfter === 1 + maximum) && /Beacon of Hope/.test(entry?.note ?? '') && /maximum/.test(entry?.note ?? ''),
          `hp 1→${hpAfter} max=${maximum} note="${entry?.note}"`);
        await victim.update({ 'system.attributes.hp.max': hpMax, 'system.attributes.hp.value': hpMax });
      } finally {
        CONFIG.Dice.randomUniform = realPRNG;
        if (hopeful) await hopeful.delete().catch(() => {});
      }
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
    for (const a of [victim, shielder, npc].filter(Boolean)) {
      try { await a.longRest?.({ dialog: false, chat: false }); } catch { /* fine */ }
    }
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'cast', out, plan, f });
