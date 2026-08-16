// Battle Flow Phase 2 smoke test — saving throws, driven end to end in the live world: the
// demand stamp on the save card, per-target verdicts (forced through ±30 save bonuses — a
// suite that can lose a coin flip lies once a week), failed-save effects and the onSave
// "applies even on save" flag, half-on-save damage through the applier's multiplier in both
// arrival orders (damage after verdicts AND damage waiting on a pending target), the popup's
// native-dialog controls reaching the real dice, a bare sheet roll answering, the buzzer
// rolling, and legendary resistance overturning a folded failure receipts-and-all.
//
// Harness discipline (HANDOFF): every setting touched is restored to whatever was found;
// every message this run creates is deleted on the way out; BF Test fixtures are long-rested;
// new-message searches go by ID-SET DIFFERENCE, never timestamps or tail windows; HP is a
// fixture resource reset before every damage assertion (a number that cannot move proves
// nothing).
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}

setTimeout(() => { console.error('[saves] WATCHDOG 420s'); process.exit(3); }, 420_000);

const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
console.log('[saves] connecting…');
await f.connect();
console.log('[saves] connected');

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
  if (!game.settings.settings.has(`${MOD}.saves`)) {
    return { fatal: 'setting saves not registered — this client is running OLD code (F5)' };
  }

  const SETTING_KEYS = ['saves', 'saveTimer', 'saveAutoRoll', 'autoDamage', 'autoApply',
    'dramaticBeat', 'requireTarget', 'reactionHold', 'suppressAttackCards',
    'suppressWeaponCards', 'suppressSpellCards', 'suppressFeatureCards', 'suppressOtherCards',
    'riders', 'effectRiders', 'masteryRiders', 'concMode', 'castApply'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const shielder = game.actors.getName('BF Test Shielder');
  const npc = game.actors.getName('BF Test Attacker');
  if (!scene || !victim || !npc || !shielder) return { fatal: 'missing fixture: scene or BF Test actors' };

  const CHIP_NAMES = ['BF Poisoned', 'BF Splashed'];
  const created = { items: [], tokens: [] };
  const priorActor = {};
  let restored = false;
  const clearChips = async () => {
    for (const a of [victim, shielder]) {
      const strays = a.effects.filter(e => CHIP_NAMES.includes(e.name));
      if (strays.length) await a.deleteEmbeddedDocuments('ActiveEffect', strays.map(e => e.id));
    }
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try {
      await clearChips();
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
    await set('saves', true);
    await set('saveTimer', 0);
    await set('saveAutoRoll', false);
    await set('autoApply', true);        // the damage half of the machine is under test
    await set('autoDamage', 'off');      // no attacks in this suite
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('concMode', 'off');        // its bare-save recognizer must never be in play
    await set('castApply', false);       // the save machine stands alone
    // Suppression master ON for the whole run: a save card is load-bearing and must survive
    // every bucket — each section's card-exists assertion rides on this.
    await set('suppressAttackCards', true);
    await set('suppressWeaponCards', true);
    await set('suppressSpellCards', true);
    await set('suppressFeatureCards', true);
    await set('suppressOtherCards', true);

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    // ⚠ Sweep pre-existing victim/shielder tokens first (the smoke-effects §14 lesson):
    // getSpeaker resolves through the actor's OLDEST token on the viewed scene, and a stale
    // unlinked one would make section 4's bare sheet roll arrive with a synthetic uuid the
    // fold can never match. smoke-battleflow re-places its own victim token next run.
    const stale = scene.tokens.filter(t => [victim.id, shielder.id].includes(t.actorId)).map(t => t.id);
    if (stale.length) await scene.deleteEmbeddedDocuments('Token', stale);
    const mkToken = async (actor, x) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(),
          { x, y: 1400, actorId: actor.id, actorLink: true }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      return canvas.tokens.get(doc.id);
    };
    const victimToken = await mkToken(victim, 1000);
    const shielderToken = await mkToken(shielder, 1200);
    if (!victimToken || !shielderToken) return { fatal: 'target tokens never reached the canvas' };

    for (const a of [victim, shielder]) {
      priorActor[a.id] = {
        'system.attributes.hp.value': a.system._source.attributes.hp.value,
        'system.abilities.con.bonuses.save': a.system._source.abilities?.con?.bonuses?.save ?? '',
      };
    }
    priorActor[victim.id]['system.resources.legres.max'] =
      victim.system._source.resources?.legres?.max ?? 0;
    priorActor[victim.id]['system.resources.legres.spent'] =
      victim.system._source.resources?.legres?.spent ?? 0;

    const saveBonus = (a, v) => a.update({ 'system.abilities.con.bonuses.save': v });
    const healFull = async a => {
      await a.update({ 'system.attributes.hp.value': a.system.attributes.hp.max });
      return a.system.attributes.hp.max;
    };

    // The fixture: an innate save spell (consumption.spellSlot: false — the §6 shape), flat
    // 10 damage so half is exactly 5, DC from a custom formula so it can never drift with
    // the caster's sheet, and TWO effects — one fail-only, one marked onSave (the flag the
    // system stores and nothing native reads; honoring it is the feature).
    const EFF_FAIL = 'bfsavefail000000';
    const EFF_ALWAYS = 'bfsavealways0000';
    const [poisonItem] = await npc.createEmbeddedDocuments('Item', [{
      name: 'BF Test Poison Burst', type: 'spell',
      system: {
        level: 1, school: 'evo', properties: ['vocal'],
        target: { affects: { type: 'creature', count: '2', choice: false } },
        range: { value: '60', units: 'ft' },
        method: 'spell', prepared: 1, identifier: 'bf-test-poison-burst',
        activities: {
          bfsaveact0000000: {
            _id: 'bfsaveact0000000', type: 'save',
            activation: { type: 'action', override: false },
            consumption: { targets: [], spellSlot: false },
            damage: { onSave: 'half', parts: [{ custom: { enabled: true, formula: '10' }, types: ['poison'] }] },
            effects: [{ _id: EFF_FAIL, onSave: false }, { _id: EFF_ALWAYS, onSave: true }],
            save: { ability: ['con'], dc: { calculation: '', formula: '15' } },
            target: { override: false, prompt: true }
          },
          bfsaveself000000: {
            _id: 'bfsaveself000000', type: 'save',
            activation: { type: 'action', override: false },
            consumption: { targets: [], spellSlot: false },
            damage: { onSave: 'half', parts: [{ custom: { enabled: true, formula: '10' }, types: ['poison'] }] },
            effects: [],
            save: { ability: ['con'], dc: { calculation: '', formula: '15' } },
            target: { override: true, affects: { type: 'self' }, prompt: false }
          }
        }
      },
      effects: [
        { _id: EFF_FAIL, name: 'BF Poisoned', transfer: false, disabled: false,
          img: 'icons/svg/poison.svg', duration: { seconds: 60 },
          description: '<p>Poisoned (BF test fixture — fail only).</p>' },
        { _id: EFF_ALWAYS, name: 'BF Splashed', transfer: false, disabled: false,
          img: 'icons/svg/acid.svg', duration: { seconds: 60 },
          description: '<p>Splashed (BF test fixture — applies even on save).</p>' }
      ]
    }]);
    created.items.push({ actorId: npc.id, id: poisonItem.id });

    const saveActivity = () => npc.items.get(poisonItem.id).system.activities.get('bfsaveact0000000');
    const selfActivity = () => npc.items.get(poisonItem.id).system.activities.get('bfsaveself000000');
    const target = (...tokens) => {
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      tokens.forEach((t, i) => t.setTarget(true, { releaseOthers: i === 0 }));
    };
    const snap = () => new Set(game.messages.contents.map(m => m.id));
    const fresh = before => game.messages.contents.filter(m => !before.has(m.id));
    const until = async (fn, ms = 15000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
      return fn();
    };
    const usageCards = msgs => msgs.filter(m =>
      (m.type === 'usage') || (m.getFlag('dnd5e', 'messageType') === 'usage'));
    const chipOn = (a, name) => a.effects.find(e => e.name === name);
    const savePopups = () => [...document.querySelectorAll('.application.dialog')]
      .filter(el => el.textContent.includes('Saving throw'));
    const entryOf = (card, a) => card.getFlag(MOD, 'saves')?.targets?.find(t => t.uuid === a.uuid);
    const rollDamageChained = card => saveActivity().rollDamage({}, { configure: false },
      { data: { 'flags.dnd5e.originatingMessage': card.id } });

    // ============================================== 1. the stamp + two forced verdicts + effects
    let card1;
    {
      await set('saveAutoRoll', true);           // the silent path first — deterministic
      await saveBonus(victim, '-30');            // forced failure vs DC 15
      await saveBonus(shielder, '+30');          // forced success vs DC 15
      await healFull(victim);
      await healFull(shielder);
      target(victimToken, shielderToken);
      await sleep(120);
      const before = snap();
      const use = await saveActivity().use({}, { configure: false }, {});
      if (use === undefined) return { fatal: 'the save fixture cast was refused' };
      card1 = use?.message instanceof ChatMessage ? use.message : null;
      if (!card1) return { fatal: 'the save cast produced no usage card' };
      await until(() => {
        const f2 = card1.getFlag(MOD, 'saves');
        return f2 && f2.targets.every(t => t.done && t.applied);
      });
      const flag = card1.getFlag(MOD, 'saves');
      ok('1a. the save card survives full suppression and carries the demand stamp',
        (usageCards(fresh(before)).length === 1) && !!flag
          && (flag.dc === 15) && (flag.abilities?.join() === 'con')
          && (flag.damageOnSave === 'half') && (flag.hasDamage === true)
          && (flag.targets?.length === 2)
          && (flag.effectNames?.fail?.join() === 'BF Poisoned')
          && (flag.effectNames?.always?.join() === 'BF Splashed'),
        `card=${usageCards(fresh(before)).length} dc=${flag?.dc} abilities=${flag?.abilities?.join()} `
          + `onSave=${flag?.damageOnSave} targets=${flag?.targets?.length}`);

      const ev = entryOf(card1, victim);
      const es = entryOf(card1, shielder);
      ok('1b. forced verdicts fold per target: the -30 fails, the +30 saves',
        (ev?.outcome === 'failed') && (es?.outcome === 'saved') && ev?.done && es?.done,
        `victim=${ev?.outcome} shielder=${es?.outcome}`);

      const rollV = ev?.rollMessageId ? game.messages.get(ev.rollMessageId) : null;
      ok('1c. the roll chains to the card, answers by the exact channel, and carries the DC',
        (rollV?.getFlag('dnd5e', 'originatingMessage') === card1.id)
          && (rollV?.getFlag(MOD, 'respondsTo') === card1.id)
          && (rollV?.getFlag(MOD, 'saveFor') === victim.uuid)
          && (rollV?.rolls?.[0]?.options?.target === 15),
        `origin=${rollV?.getFlag('dnd5e', 'originatingMessage')} target=${rollV?.rolls?.[0]?.options?.target}`);

      const receipt = card1.getFlag(MOD, 'effectReceipt');
      const evR = receipt?.targets?.find(t => t.uuid === victim.uuid);
      const esR = receipt?.targets?.find(t => t.uuid === shielder.uuid);
      ok('1d. a failure takes BOTH effects, a success only the onSave one',
        !!chipOn(victim, 'BF Poisoned') && !!chipOn(victim, 'BF Splashed')
          && !chipOn(shielder, 'BF Poisoned') && !!chipOn(shielder, 'BF Splashed')
          && (evR?.effects?.length === 2) && (esR?.effects?.length === 1),
        `victim chips=[${CHIP_NAMES.map(n => !!chipOn(victim, n)).join()}] `
          + `shielder chips=[${CHIP_NAMES.map(n => !!chipOn(shielder, n)).join()}] `
          + `receipts v=${evR?.effects?.length} s=${esR?.effects?.length}`);
    }

    // ============================================== 2. damage AFTER verdicts: full vs half
    {
      const vMax = victim.system.attributes.hp.max;
      const sMax = shielder.system.attributes.hp.max;
      const before = snap();
      await rollDamageChained(card1);
      const dmg = await until(() => fresh(before).find(m =>
        (m.getFlag('dnd5e', 'roll.type') === 'damage')
        && (m.getFlag(MOD, 'receipt')?.targets?.length === 2)));
      const rv = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid);
      const rs = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === shielder.uuid);
      ok('2a. the failed target takes the flat 10 in full; the saved target takes exactly half',
        (dmg?.getFlag('dnd5e', 'roll.damageOnSave') === 'half')
          && (rv?.taken === 10) && !rv?.multiplier
          && (rs?.taken === 5) && (rs?.multiplier === 0.5)
          && (rs?.note === 'saved — half damage'),
        `onSave=${dmg?.getFlag('dnd5e', 'roll.damageOnSave')} v.taken=${rv?.taken} `
          + `s.taken=${rs?.taken} s.mult=${rs?.multiplier} s.note=${rs?.note}`);
      ok('2b. the pools moved by exactly those numbers',
        (victim.system.attributes.hp.value === vMax - 10)
          && (shielder.system.attributes.hp.value === sMax - 5),
        `victim ${vMax}→${victim.system.attributes.hp.value} shielder ${sMax}→${shielder.system.attributes.hp.value}`);
    }

    // ============================================== 3. damage BEFORE the verdict + the popup path
    {
      await set('saveAutoRoll', false);
      await clearChips();
      await saveBonus(victim, '');               // neutral: the popup's own +30 must be the reason
      const vMax = await healFull(victim);
      target(victimToken);
      await sleep(120);
      const before = snap();
      const use = await saveActivity().use({}, { configure: false }, {});
      const card = use?.message instanceof ChatMessage ? use.message : null;
      if (!card) return { fatal: 'section 3 cast produced no card' };
      await until(() => card.getFlag(MOD, 'saves'));
      await rollDamageChained(card);
      const dmg = await until(() => fresh(before).find(m => m.getFlag('dnd5e', 'roll.type') === 'damage'));
      await sleep(1800);
      ok('3a. a pending target\'s damage WAITS — per-target independence, nothing applied',
        !!dmg && !dmg.getFlag(MOD, 'receipt')
          && (victim.system.attributes.hp.value === vMax),
        `receipt=${!!dmg?.getFlag(MOD, 'receipt')} hp=${victim.system.attributes.hp.value}/${vMax}`);

      const popup = await until(() => savePopups()[0], 6000);
      const buttons = popup ? [...popup.querySelectorAll('footer button, .form-footer button')] : [];
      const labels = buttons.map(b => b.textContent.trim());
      ok('3b. the popup carries the native dialog\'s controls: Adv/Normal/Dis + situational bonus',
        (labels.join('/') === 'Advantage/Normal/Disadvantage')
          && !!popup?.querySelector('input[name="bf-save-bonus"]'),
        `buttons=[${labels.join('|')}] input=${!!popup?.querySelector('input[name="bf-save-bonus"]')}`);

      const input = popup?.querySelector('input[name="bf-save-bonus"]');
      if (input) input.value = '+30';
      buttons.find(b => b.textContent.trim() === 'Advantage')?.click();
      await until(() => entryOf(card, victim)?.done);
      const entry = entryOf(card, victim);
      const roll = entry?.rollMessageId ? game.messages.get(entry.rollMessageId) : null;
      ok('3c. the bonus reaches the formula, Advantage reaches the d20, the verdict is saved',
        (entry?.outcome === 'saved') && /30/.test(roll?.rolls?.[0]?.formula ?? '')
          && (roll?.rolls?.[0]?.options?.advantageMode === 1),
        `outcome=${entry?.outcome} advMode=${roll?.rolls?.[0]?.options?.advantageMode} formula=${roll?.rolls?.[0]?.formula}`);

      const applied = await until(() => dmg.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid));
      ok('3d. the waiting damage applies once the verdict pass completes — at half, chips first',
        (applied?.taken === 5) && (applied?.multiplier === 0.5)
          && (victim.system.attributes.hp.value === vMax - 5)
          && !chipOn(victim, 'BF Poisoned') && !!chipOn(victim, 'BF Splashed'),
        `taken=${applied?.taken} mult=${applied?.multiplier} hp=${victim.system.attributes.hp.value}/${vMax} `
          + `chips=[${CHIP_NAMES.map(n => !!chipOn(victim, n)).join()}]`);

      await until(() => savePopups().length === 0, 5000);
      ok('3e. the answered popup closed itself', savePopups().length === 0,
        `popups=${savePopups().length}`);
    }

    // ============================================== 4. a bare sheet roll is the answer
    {
      await clearChips();
      await saveBonus(victim, '-30');
      await healFull(victim);
      target(victimToken);
      await sleep(120);
      const use = await saveActivity().use({}, { configure: false }, {});
      const card = use?.message instanceof ChatMessage ? use.message : null;
      if (!card) return { fatal: 'section 4 cast produced no card' };
      await until(() => card.getFlag(MOD, 'saves'));
      await sleep(600); // let the popup offer itself — the roll below must beat it, not race it
      await victim.rollSavingThrow({ ability: 'con' }, { configure: false }, {});
      await until(() => entryOf(card, victim)?.done);
      const entry = entryOf(card, victim);
      const roll = entry?.rollMessageId ? game.messages.get(entry.rollMessageId) : null;
      ok('4a. a bare sheet roll answers the pending demand, judged against the STORED DC',
        (entry?.outcome === 'failed') && !roll?.getFlag(MOD, 'respondsTo')
          && !roll?.getFlag('dnd5e', 'originatingMessage')
          && (roll?.rolls?.[0]?.options?.target == null),
        `outcome=${entry?.outcome} target=${roll?.rolls?.[0]?.options?.target}`);
      // Wait for the whole consequence pass, not the first chip — the two creates are
      // sequential and an assert can land in the gap between them (bit this suite's first run).
      await until(() => entryOf(card, victim)?.applied);
      ok('4b. the failure\'s consequences ran off the sheet roll (both chips landed)',
        !!chipOn(victim, 'BF Poisoned') && !!chipOn(victim, 'BF Splashed'),
        `chips=[${CHIP_NAMES.map(n => !!chipOn(victim, n)).join()}]`);
      await until(() => savePopups().length === 0, 5000);
      ok('4c. the popup closed when the sheet answered', savePopups().length === 0,
        `popups=${savePopups().length}`);
    }

    // ============================================== 5. the buzzer ROLLS — straight and marked
    {
      await clearChips();
      await saveBonus(victim, '-30');
      await healFull(victim);
      await set('saveTimer', 2);
      target(victimToken);
      await sleep(120);
      const use = await saveActivity().use({}, { configure: false }, {});
      const card = use?.message instanceof ChatMessage ? use.message : null;
      if (!card) return { fatal: 'section 5 cast produced no card' };
      const entry = await until(() => {
        const e = entryOf(card, victim);
        return e?.done ? e : null;
      }, 12000);
      const roll = entry?.rollMessageId ? game.messages.get(entry.rollMessageId) : null;
      ok('5a. the deadline rolls the save itself — marked, straight, data-driven',
        (entry?.timedOut === true) && (entry?.outcome === 'failed')
          && (roll?.getFlag(MOD, 'timedOut') === true)
          && (roll?.rolls?.[0]?.options?.advantageMode === 0),
        `timedOut=${entry?.timedOut} outcome=${entry?.outcome} advMode=${roll?.rolls?.[0]?.options?.advantageMode}`);
      await set('saveTimer', 0);
    }

    // ============================================== 6. legendary resistance overturns the verdict
    {
      await clearChips();
      await set('saveAutoRoll', true);
      await saveBonus(victim, '-30');
      const vMax = await healFull(victim);
      await victim.update({ 'system.resources.legres.max': 1, 'system.resources.legres.spent': 0 });
      target(victimToken);
      await sleep(120);
      const before = snap();
      const use = await saveActivity().use({}, { configure: false }, {});
      const card = use?.message instanceof ChatMessage ? use.message : null;
      if (!card) return { fatal: 'section 6 cast produced no card' };
      await until(() => entryOf(card, victim)?.applied);
      await rollDamageChained(card);
      const dmg = await until(() => fresh(before).find(m =>
        (m.getFlag('dnd5e', 'roll.type') === 'damage')
        && m.getFlag(MOD, 'receipt')?.targets?.some(t => t.uuid === victim.uuid)));
      ok('6-pre. the failure landed in full first (10 damage, both chips)',
        (victim.system.attributes.hp.value === vMax - 10) && !!chipOn(victim, 'BF Poisoned'),
        `hp=${victim.system.attributes.hp.value}/${vMax} poisoned=${!!chipOn(victim, 'BF Poisoned')}`);

      if (typeof victim.system.resistSave !== 'function') {
        skips.push('6a-c: BF Test Victim is not NPC-typed — resistSave unavailable');
      } else {
        const rollMsg = game.messages.get(entryOf(card, victim).rollMessageId);
        await victim.system.resistSave(rollMsg);
        await until(() => entryOf(card, victim)?.outcome === 'saved');
        const entry = entryOf(card, victim);
        ok('6a. the flip is recorded: saved, by legendary resistance, resource spent',
          (entry?.outcome === 'saved') && (entry?.forced === true)
            && (victim.system.resources.legres.value === 0),
          `outcome=${entry?.outcome} forced=${entry?.forced} legres=${victim.system.resources.legres.value}`);

        const effReceipt = await until(() => {
          const r = card.getFlag(MOD, 'effectReceipt')?.targets?.find(t => t.uuid === victim.uuid);
          return r?.effects?.find(e => (e.name === 'BF Poisoned') && e.reverted) ? r : null;
        });
        ok('6b. the fail-only effect unwinds; the onSave effect survives',
          !chipOn(victim, 'BF Poisoned') && !!chipOn(victim, 'BF Splashed')
            && !!effReceipt?.effects?.find(e => (e.name === 'BF Poisoned') && e.reverted)
            && !!effReceipt?.effects?.find(e => (e.name === 'BF Splashed') && !e.reverted),
          `chips=[${CHIP_NAMES.map(n => !!chipOn(victim, n)).join()}]`);

        const rV = await until(() => {
          const r = dmg.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === victim.uuid);
          return (r?.multiplier === 0.5) ? r : null;
        });
        ok('6c. the damage re-applies at the success multiplier: 10 reverted, 5 landed',
          (rV?.taken === 5) && (rV?.multiplier === 0.5) && !rV?.reverted
            && (victim.system.attributes.hp.value === vMax - 5),
          `taken=${rV?.taken} mult=${rV?.multiplier} hp=${victim.system.attributes.hp.value}/${vMax}`);
      }
      await victim.update({
        'system.resources.legres.max': priorActor[victim.id]['system.resources.legres.max'],
        'system.resources.legres.spent': priorActor[victim.id]['system.resources.legres.spent']
      });
    }

    // ============================================== 7. the exclusions
    {
      await clearChips();
      await set('saveAutoRoll', false);

      await set('saves', false);
      target(victimToken);
      await sleep(120);
      let use = await saveActivity().use({}, { configure: false }, {});
      let card = use?.message instanceof ChatMessage ? use.message : null;
      await sleep(1200);
      ok('7a. with the setting off, a save cast is left entirely native (no stamp)',
        !!card && !card.getFlag(MOD, 'saves'), `flag=${!!card?.getFlag(MOD, 'saves')}`);
      await set('saves', true);

      target();
      await sleep(120);
      use = await saveActivity().use({}, { configure: false }, {});
      card = use?.message instanceof ChatMessage ? use.message : null;
      await sleep(1200);
      ok('7b. a targetless cast keeps its native card and is left to the humans',
        !!card && !card.getFlag(MOD, 'saves'), `flag=${!!card?.getFlag(MOD, 'saves')}`);

      target(victimToken);
      await sleep(120);
      use = await selfActivity().use({}, { configure: false }, {});
      card = use?.message instanceof ChatMessage ? use.message : null;
      await sleep(1200);
      ok('7c. a self-aimed save activity never stamps (incidental UI targeting)',
        !!card && !card.getFlag(MOD, 'saves'), `flag=${!!card?.getFlag(MOD, 'saves')}`);
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
}, null);

if (out.fatal) {
  console.error(`\n[saves] FATAL: ${out.fatal}`);
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
console.log(`\n[saves] ${out.results.length - failures}/${out.results.length} passed`);
process.exit(failures ? 1 : 0);
