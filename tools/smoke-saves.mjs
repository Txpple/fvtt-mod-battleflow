// Battle Flow Phase 2 smoke test — saving throws, driven end to end in the live world: the
// demand stamp on the save card, per-target verdicts (forced through ±30 save bonuses — a
// suite that can lose a coin flip lies once a week), failed-save effects and the onSave
// "applies even on save" flag, half-on-save damage through the applier's multiplier in both
// arrival orders (damage after verdicts AND damage waiting on a pending target), the popup's
// native-dialog controls reaching the real dice, a bare sheet roll answering, the buzzer
// rolling, and legendary resistance overturning a folded failure receipts-and-all.
// v1.12.0 adds §10 (the WAITING demand: a bare template cast stamps zero targets and no
// deadline, the placed area delivers targets and arms the clock — findings ②+③) and §11
// (the GM's unsolicited popups are non-player-owned targets only; the quiet PC rides the
// buzzer — finding ④). v1.14.0 adds §12 (spell-truth geometry on a suite-built 140px
// scene — the v14 region shim scales stored distance by gridSize/100, invisible on this
// 100px range, and containment must follow the honest dnd5e dimensions flag instead) and
// §13 (the spent sweep as a convergent floor + its newest-cast fossil wall).
//
// Harness discipline (HANDOFF): every setting touched is restored to whatever was found;
// every message this run creates is deleted on the way out; BF Test fixtures are long-rested;
// new-message searches go by ID-SET DIFFERENCE, never timestamps or tail windows; HP is a
// fixture resource reset before every damage assertion (a number that cannot move proves
// nothing).
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig, preflightSoleGM } from './target.mjs';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}

setTimeout(() => { console.error('[saves] WATCHDOG 560s'); process.exit(3); }, 560_000);

const f = new Foundry(foundryConfig(env));
console.log('[saves] connecting…');
await f.connect();
await preflightSoleGM(f);
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

  const SETTING_KEYS = ['saves', 'saveTimer', 'autoDamage', 'autoApply',
    'dramaticBeat', 'requireTarget', 'reactionHold',
    'riders', 'effectRiders', 'masteryRiders', 'concMode', 'castApply'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const shielder = game.actors.getName('BF Test Shielder');
  const npc = game.actors.getName('BF Test Attacker');
  if (!scene || !victim || !npc || !shielder) return { fatal: 'missing fixture: scene or BF Test actors' };

  const CHIP_NAMES = ['BF Poisoned', 'BF Splashed'];
  const created = { items: [], tokens: [], templates: [] };
  const priorActor = {};
  let shimScene = null; // §12's own 140px scene — deleted whole in teardown
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
    // ⚠ SETTINGS FIRST, in their own guard — a cleanup error later in this sequence must
    // never leave the table wearing suite settings (bit live 2026-08-17: a failed run's
    // teardown skipped the restore and autoDamage/dramaticBeat residue got mistaken for
    // the user's own tuning). The user's config is sacred; the rest is best-effort.
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
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
      const liveTemplates = created.templates.filter(id => scene.templates.get(id));
      if (liveTemplates.length) await scene.deleteEmbeddedDocuments('MeasuredTemplate', liveTemplates);
      if (shimScene && game.scenes.get(shimScene.id)) await shimScene.delete();
      for (const [actorId, data] of Object.entries(priorActor)) {
        await game.actors.get(actorId)?.update(data);
      }
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
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
    // (The suppression machinery is gone at v1.10.0 — cards always post; each section's
    // card-exists assertion now rides on nothing but the module leaving cards alone.)

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    // ⚠ Sweep pre-existing victim/shielder tokens first (the smoke-effects §14 lesson):
    // getSpeaker resolves through the actor's OLDEST token on the viewed scene, and a stale
    // unlinked one would make section 4's bare sheet roll arrive with a synthetic uuid the
    // fold can never match. smoke-battleflow re-places its own victim token next run.
    const pcActor = game.actors.getName('BF Test PC Attacker'); // §11's player-owned fixture
    const stale = scene.tokens.filter(t =>
      [victim.id, shielder.id, ...(pcActor ? [pcActor.id] : [])].includes(t.actorId)).map(t => t.id);
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
        duration: { units: 'inst' },   // §8's spent-template rule reads this off the stamp
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
          },
          // §9's shape — Web's burn clause: damage stored ON the save activity with
          // onSave "full", i.e. damage the save does not modulate. Rider damage, not the
          // save's consequence (finding ③, 2026-08-17).
          bfsavefull000000: {
            _id: 'bfsavefull000000', type: 'save',
            activation: { type: 'action', override: false },
            consumption: { targets: [], spellSlot: false },
            damage: { onSave: 'full', parts: [{ custom: { enabled: true, formula: '10' }, types: ['fire'] }] },
            effects: [],
            save: { ability: ['con'], dc: { calculation: '', formula: '15' } },
            target: { override: false, prompt: true }
          },
          // §10's shape — Web's TEMPLATE flow (v1.12.0 finding ③; re-cut at v1.13.0 for
          // the walk's finding ①): a CUBE save activity cast bare, area placed after as an
          // origin-LESS rect — the toolbar draw. Cube ⇒ rect is the type the old
          // circle-only geometry fallback could not shape, which is exactly how the suite
          // stayed green while the live cube adopted nothing. prompt: true matches the
          // live spell's data; the harness passes create.measuredTemplate false at use
          // (the canceled-preview path — a real drawPreview never resolves headless).
          bfsavetmpl000000: {
            _id: 'bfsavetmpl000000', type: 'save',
            activation: { type: 'action', override: false },
            consumption: { targets: [], spellSlot: false },
            damage: { onSave: 'half', parts: [{ custom: { enabled: true, formula: '10' }, types: ['poison'] }] },
            effects: [],
            save: { ability: ['con'], dc: { calculation: '', formula: '15' } },
            target: { override: true, prompt: true,
              template: { type: 'cube', size: '10', units: 'ft', count: '' },
              affects: { type: 'creature', count: '', choice: false } }
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
    const fullActivity = () => npc.items.get(poisonItem.id).system.activities.get('bfsavefull000000');
    const tmplActivity = () => npc.items.get(poisonItem.id).system.activities.get('bfsavetmpl000000');
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
      await until(() => card1.getFlag(MOD, 'saves'));

      // ⑯'s companion, asserted at the source: the machine rolled the card's damage AT THE
      // STAMP — nobody pressed anything (the table hides every card button). §2 owns the
      // late-arrival ordering, so the auto roll is asserted and then deleted to keep that
      // ordering constructible.
      const autoDmg = await until(() => fresh(before).find(m =>
        (m.getFlag('dnd5e', 'roll.type') === 'damage')
        && (m.getFlag('dnd5e', 'originatingMessage') === card1.id)));
      ok('1a2. the demand rolls its own damage at the stamp (the hidden-buttons companion)',
        !!autoDmg && (autoDmg.getFlag('dnd5e', 'roll.damageOnSave') === 'half'),
        `auto=${!!autoDmg} onSave=${autoDmg?.getFlag('dnd5e', 'roll.damageOnSave')}`);

      // ⑯ at the DOM: the save card carries real Save/Damage buttons, and every one of them
      // is hidden — a zero-button card would make this pass vacuously, so the count guards.
      const cardEl = document.querySelector(`[data-message-id="${card1.id}"]`);
      const btns = [...(cardEl?.querySelectorAll('.card-buttons button[data-action]') ?? [])];
      const visibleBtns = btns.filter(b =>
        (b.dataset.action !== 'refundResource') && (b.style.display !== 'none'));
      ok('1a3. the card\'s action buttons are hidden — the machine owns the workflow',
        (btns.length > 0) && (visibleBtns.length === 0),
        `buttons=${btns.length} visible=[${visibleBtns.map(b => b.dataset.action).join()}]`);
      if (autoDmg) await ChatMessage.deleteDocuments([autoDmg.id]);

      // Both targets answer through the popup — the ONE input surface now that the silent
      // opt-out is gone (the settings collapse, user call 2026-08-16). Different actors, so
      // both popups offer at once; each Normal click is the machine's own roll channel.
      for (let i = 0; i < 2; i++) {
        const popup = await until(() => savePopups()[0], 8000);
        if (!popup) break;
        [...popup.querySelectorAll('footer button, .form-footer button')]
          .find(b => b.textContent.trim() === 'Normal')?.click();
        await until(() => !document.contains(popup), 8000);
      }
      await until(() => {
        const f2 = card1.getFlag(MOD, 'saves');
        return f2 && f2.targets.every(t => t.done && t.applied);
      });
      const flag = card1.getFlag(MOD, 'saves');
      ok('1a. the save card posts and carries the demand stamp',
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
      // The stamp's own auto-roll IS the early damage now — nothing to press.
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
      // The demand stores the TOKEN's name (the snapshot's field) — compare against that,
      // not the actor name (the fixture's prototype token is "Hobgoblin").
      const rollerName = card.getFlag(MOD, 'saves')?.targets?.[0]?.name ?? 'BF Test Victim';
      ok('3b2. the popup leads with WHO is rolling — the creature owns the title',
        ((popup?.querySelector('.window-title')?.textContent ?? '').includes(rollerName)),
        `title="${popup?.querySelector('.window-title')?.textContent?.trim()}" expected="${rollerName}"`);

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
      // Quiesce before leaving: the stamp auto-rolls damage now, and this verdict's late
      // application would otherwise land INSIDE §6's freshly healed pool (bit 2026-08-16:
      // hp read 0/11 where 1/11 was earned).
      await until(() => entryOf(card, victim)?.applied);
      await set('saveTimer', 0);
    }

    // ============================================== 6. legendary resistance overturns the verdict
    {
      await clearChips();
      await saveBonus(victim, '-30');
      const vMax = await healFull(victim);
      await victim.update({ 'system.resources.legres.max': 1, 'system.resources.legres.spent': 0 });
      target(victimToken);
      await sleep(120);
      const before = snap();
      const use = await saveActivity().use({}, { configure: false }, {});
      const card = use?.message instanceof ChatMessage ? use.message : null;
      if (!card) return { fatal: 'section 6 cast produced no card' };
      await until(() => card.getFlag(MOD, 'saves'));
      await sleep(600); // the popup offers itself; the bare roll answers first (§4's channel)
      await victim.rollSavingThrow({ ability: 'con' }, { configure: false }, {});
      await until(() => entryOf(card, victim)?.applied);
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
      ok('7b. a targetless cast with NO template shape stays native (a waiting demand needs an area to wait for)',
        !!card && !card.getFlag(MOD, 'saves'), `flag=${!!card?.getFlag(MOD, 'saves')}`);

      target(victimToken);
      await sleep(120);
      use = await selfActivity().use({}, { configure: false }, {});
      card = use?.message instanceof ChatMessage ? use.message : null;
      await sleep(1200);
      ok('7c. a self-aimed save activity never stamps (incidental UI targeting)',
        !!card && !card.getFlag(MOD, 'saves'), `flag=${!!card?.getFlag(MOD, 'saves')}`);
    }

    // ============================================== 8. templates: containment IS the target set
    {
      await clearChips();
      await saveBonus(victim, '-30');
      await saveBonus(shielder, '+30');
      await healFull(victim);
      await healFull(shielder);
      target(shielderToken);              // the manual snapshot aims WRONG on purpose
      await sleep(120);
      const before = snap();
      const use = await saveActivity().use({}, { configure: false }, {});
      const card = use?.message instanceof ChatMessage ? use.message : null;
      if (!card) return { fatal: 'section 8 cast produced no card' };
      await until(() => card.getFlag(MOD, 'saves'));

      // The template lands over the VICTIM only. Adoption must swing the demand both ways:
      // the untargeted victim standing inside joins; the targeted shielder outside drops
      // (the live Shatter and Moonbeam reports, one mechanism).
      let hookFired = 0;
      const hid = Hooks.on('createMeasuredTemplate', () => { hookFired++; });
      // Radius 2.5 ft ON PURPOSE (retuned v1.13.0 for CORE's grid-aware shapes): the
      // fixture tokens stand 200px apart — one grid square over — and a GRIDDED 5 ft
      // circle covers the whole adjacent square, so "outside" stopped being testable
      // exactly the way the old 10 ft Euclidean rim did (bit 2026-08-16). 2.5 ft covers
      // only the origin square gridded AND only a 70px disc Euclidean: the neighbor is
      // out under either branch, whatever core's gridTemplates setting says.
      const [tpl] = await scene.createEmbeddedDocuments('MeasuredTemplate', [{
        t: 'circle', x: victimToken.center.x, y: victimToken.center.y, distance: 2.5,
        flags: { dnd5e: { origin: card.getFlag(MOD, 'saves').activityUuid } }
      }]);
      created.templates.push(tpl.id);
      // The adoption floor rides the card's RENDER (the CRUD hooks measurably never fire on
      // this page) — nudge one, exactly as any table chatter would.
      await sleep(300);
      try { ui.chat?.updateMessage?.(card); } catch { /* re-renders next message anyway */ }
      const adopted = await until(() => {
        const f2 = card.getFlag(MOD, 'saves');
        return (f2?.templated && f2.targets.some(t => t.uuid === victim.uuid)
          && !f2.targets.some(t => t.uuid === shielder.uuid)) ? f2 : null;
      });
      Hooks.off('createMeasuredTemplate', hid);
      if (!adopted) {
        const f2 = card.getFlag(MOD, 'saves');
        log.push(`8a dbg: ${JSON.stringify({
          hookFired,
          hookCount: Hooks.events.createMeasuredTemplate?.length ?? 0,
          tplExists: !!scene.templates.get(tpl.id),
          tplOrigin: tpl.getFlag('dnd5e', 'origin'),
          cardActivity: f2?.activityUuid,
          equal: tpl.getFlag('dnd5e', 'origin') === f2?.activityUuid,
          status: f2?.status, undone: (f2?.targets ?? []).filter(t => !t.done).length,
          activeGM: game.users.activeGM?.isSelf ?? null,
          victimCenter: victimToken?.center, tplXY: { x: tpl.x, y: tpl.y }
        })}`);
      }
      ok('8a. a template adopts the demand: containment in, stale manual targets out',
        !!adopted && (adopted.targets.length === 1),
        `templated=${!!adopted?.templated} targets=[${(card.getFlag(MOD, 'saves')?.targets ?? []).map(t => t.name).join()}]`);

      // 8a2 (v1.10.0 — the strand fix): the dropped snapshot target's popup CLOSES. The
      // shielder's popup auto-showed on this client at the stamp; the drop's flag write
      // must sweep it wherever it lives — a popup asking a withdrawn question with a dead
      // bar was the live Shatter/Gren report (2026-08-17).
      const strandGone = await until(() => !savePopups().some(p =>
        p.textContent?.includes(shielder.name)), 6000);
      ok('8a2. the dropped entry\'s popup closes — no stranded question on screen',
        !!strandGone,
        `open save popups: ${savePopups().length}`);

      // Moonbeam walks: the circle lands on the shielder — the pending set follows the
      // area. `templated` must already be true here or this assertion could pass on the
      // original manual snapshot (the vacuous-pass trap, caught 2026-08-16). Expressed as
      // delete + re-place because tpl.update() measurably no-ops on this headless page
      // (same half-dead template plumbing as the create hook); live moves and re-places
      // funnel into the identical recompute.
      await scene.deleteEmbeddedDocuments('MeasuredTemplate', [tpl.id]);
      const [tpl2] = await scene.createEmbeddedDocuments('MeasuredTemplate', [{
        t: 'circle', x: shielderToken.center.x, y: shielderToken.center.y, distance: 2.5,
        flags: { dnd5e: { origin: card.getFlag(MOD, 'saves').activityUuid } }
      }]);
      created.templates.push(tpl2.id);
      await sleep(300);
      try { ui.chat?.updateMessage?.(card); } catch { /* re-renders next message anyway */ }
      const walked = await until(() => {
        const f2 = card.getFlag(MOD, 'saves');
        return (f2?.templated && f2.targets.some(t => t.uuid === shielder.uuid)
          && !f2.targets.some(t => t.uuid === victim.uuid)) ? f2 : null;
      });
      if (!walked) {
        const f2 = card.getFlag(MOD, 'saves');
        const tplNow = scene.templates.get(tpl.id);
        log.push(`8b dbg: ${JSON.stringify({
          tplXY: { x: tplNow?.x, y: tplNow?.y }, shielderCenter: shielderToken.center,
          origin: tplNow?.getFlag('dnd5e', 'origin'),
          targets: f2?.targets?.map(t => ({ n: t.name, done: t.done, applied: t.applied })),
          templated: f2?.templated
        })}`);
      }
      ok('8b. the area moved and the pending set moved with it',
        !!walked, `templated=${!!card.getFlag(MOD, 'saves')?.templated} `
          + `targets=[${(card.getFlag(MOD, 'saves')?.targets ?? []).map(t => t.name).join()}]`);

      // Resolve the walked demand; the fixture is INSTANTANEOUS, so the spent template
      // leaves the canvas with the last consequence.
      const autoDmg8 = fresh(before).find(m =>
        (m.getFlag('dnd5e', 'roll.type') === 'damage')
        && (m.getFlag('dnd5e', 'originatingMessage') === card.id));
      await sleep(600);
      await shielder.rollSavingThrow({ ability: 'con' }, { configure: false }, {});
      await until(() => (card.getFlag(MOD, 'saves')?.targets ?? []).every(t => t.done && t.applied));
      await until(() => !scene.templates.get(tpl2.id), 8000);
      ok('8c. the instantaneous template is spent once every consequence landed',
        !scene.templates.get(tpl2.id),
        `template=${!!scene.templates.get(tpl2.id)} autoDmg=${!!autoDmg8}`);

      // 8d (v1.10.0 — the stamp's 5.3.3 nesting): results.templates entries are ARRAYS
      // (#placeTemplate pushes drawPreview()'s resolution — the raw createEmbeddedDocuments
      // result), and unflattened they made every live placement-during-usage fall back to
      // the manual snapshot (how Gren got Shatter's popup, 2026-08-17). The harness cannot
      // drive drawPreview, so the hook is fired by hand with the exact nested shape the
      // live flow produces: the stamp must contain, not snapshot.
      await clearChips();
      const [tpl8d] = await scene.createEmbeddedDocuments('MeasuredTemplate', [{
        t: 'circle', x: victimToken.center.x, y: victimToken.center.y, distance: 2.5
      }]);
      created.templates.push(tpl8d.id);
      const msg8d = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: npc }),
        content: '<p>BF 8d stamp-path fixture</p>',
        flags: { dnd5e: {
          targets: [{ uuid: shielder.uuid, name: shielder.name, img: null, ac: null }],
          activity: { id: saveActivity().id, uuid: saveActivity().uuid, type: 'save' }
        } }
      });
      Hooks.callAll('dnd5e.postUseActivity', saveActivity(), {},
        { message: msg8d, templates: [[tpl8d]] });
      const stamped8d = await until(() => {
        const f = msg8d.getFlag(MOD, 'saves');
        return (f?.targets?.length ? f : null);
      }, 6000);
      ok('8d. the stamp flattens results.templates: contained targets in, the snapshot out',
        !!stamped8d && (stamped8d.templated === true)
          && stamped8d.targets.some(t => t.uuid === victim.uuid)
          && !stamped8d.targets.some(t => t.uuid === shielder.uuid),
        `templated=${stamped8d?.templated} targets=[${(stamped8d?.targets ?? []).map(t => t.name).join()}]`);
      // Sweep the fixture message and anything chained to it before teardown counts cards.
      const chained8d = game.messages.contents.filter(m =>
        m.getFlag('dnd5e', 'originatingMessage') === msg8d.id);
      await ChatMessage.deleteDocuments([msg8d.id, ...chained8d.map(m => m.id)]);
    }

    // ============================================== 9. rider damage (onSave "full") + per-row bars
    // Web's shape (finding ③, 2026-08-17): the burn 2d4 lives ON the save activity with
    // onSave "full" — damage the save does not modulate is not the save's consequence.
    // The demand stamps with no damage dimension: no auto-roll, no per-verdict
    // application, even on a failure. And ④'s card half: every pending row drains its
    // own bar ("two timers tick side by side" — the walk's stated expectation).
    {
      await clearChips();
      await saveBonus(victim, '-30');            // forced failure — ③'s dangerous case
      await saveBonus(shielder, '+30');
      const vMax9 = await healFull(victim);
      await healFull(shielder);
      await set('saveTimer', 4);                 // bars need a window; the buzzer backstops
      target(victimToken, shielderToken);
      await sleep(120);
      const before = snap();
      const use = await fullActivity().use({}, { configure: false }, {});
      const card = use?.message instanceof ChatMessage ? use.message : null;
      if (!card) return { fatal: 'section 9 cast produced no card' };
      const flag9 = await until(() => card.getFlag(MOD, 'saves'));

      ok('9a. onSave "full" is rider damage — the demand stamps with NO damage dimension',
        (flag9?.damageOnSave === 'full') && (flag9?.hasDamage === false),
        `onSave=${flag9?.damageOnSave} hasDamage=${flag9?.hasDamage}`);

      // ④ at the DOM — re-query per poll: a re-render REPLACES the card element.
      const barCount = () => document.querySelector(`[data-message-id="${card.id}"]`)
        ?.querySelectorAll('[data-bf-deadline]')?.length ?? 0;
      await until(() => barCount() === 2, 2500);
      const pending9 = card.getFlag(MOD, 'saves').targets.filter(t => !t.done).length;
      ok('9c. every pending row drains its own bar', (pending9 === 2) && (barCount() === 2),
        `pending=${pending9} bars=${barCount()}`);

      await sleep(900); // an auto-roll would land inside this window if the gate regressed
      const autoDmg9 = fresh(before).find(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
        && (m.getFlag('dnd5e', 'originatingMessage') === card.id));
      ok('9b. rider damage never auto-rolls at the stamp', !autoDmg9, `autoRolled=${!!autoDmg9}`);

      // Resolve through the popups (the §1 idiom); if the 4s buzzer wins a race instead,
      // the assertions below hold under either path (timer rolls are straight, -30 fails).
      for (let i = 0; i < 2; i++) {
        const popup = await until(() => savePopups()[0], 6000);
        if (!popup) break;
        [...popup.querySelectorAll('footer button, .form-footer button')]
          .find(b => b.textContent.trim() === 'Normal')?.click();
        await until(() => !document.contains(popup), 6000);
      }
      await until(() => card.getFlag(MOD, 'saves')?.targets?.every(t => t.done && t.applied), 12000);
      const e9 = entryOf(card, victim);
      ok('9d. a FAILED save against rider damage applies no damage at all',
        (e9?.outcome === 'failed') && (victim.system.attributes.hp.value === vMax9),
        `outcome=${e9?.outcome} hp=${victim.system.attributes.hp.value}/${vMax9}`);
      await set('saveTimer', 0);
    }

    // ============================================== 10. the waiting demand (v1.12.0, findings ②+③)
    // Web's natural flow: a template-shaped save activity cast BARE — no targets, no
    // placement (create.measuredTemplate false = the canceled-preview path, the only
    // headless-safe one). The old code stamped nothing and adoption had no customer, so
    // the area produced no saves at all (the live Web report). The demand must stamp
    // WAITING (zero targets, no deadline), the card must say so, Place Measured Template
    // must hide with every other button (finding ② — the keep-list is exactly
    // refundResource again), and the placed area must deliver targets, arm the clock from
    // that moment, ask, and run the whole machine to a receipt.
    {
      await clearChips();
      // ⚠ SWEEP ORIGIN-LESS TEMPLATES FIRST. A waiting demand legitimately CLAIMS any
      // unowned template of its shape on the current scene — so a leftover rect from an
      // earlier section (or from a crashed run, which is how this was found on
      // 2026-08-19) is claimed by the OLDER cast the instant it stamps, before the newer
      // cast even exists. 10d2 then fails reporting a fossil-wall breach that never
      // happened: the module was right and the range was dirty. Three strays were
      // standing when this was diagnosed.
      const strayAreas10 = scene.templates.filter(t => !t.getFlag('dnd5e', 'origin'));
      if (strayAreas10.length) {
        log.push(`section 10 swept ${strayAreas10.length} origin-less leftover template(s)`);
        await scene.deleteEmbeddedDocuments('MeasuredTemplate', strayAreas10.map(t => t.id));
      }
      await saveBonus(victim, '-30');
      const vMax10 = await healFull(victim);
      await set('saveTimer', 15);
      target();                            // BARE on purpose — the whole finding
      await sleep(120);
      // TWO bare casts: the older is the newest-customer gate's pin (finding ①'s probe
      // found FOUR same-activity waiting cards — one placement must fill exactly one).
      const useOld10 = await tmplActivity().use(
        { create: { measuredTemplate: false } }, { configure: false }, {});
      const cardOld10 = useOld10?.message instanceof ChatMessage ? useOld10.message : null;
      if (!cardOld10) return { fatal: 'section 10 older cast produced no card' };
      await until(() => cardOld10.getFlag(MOD, 'saves'), 6000);
      await sleep(150); // distinct timestamps — the gate sorts by them
      const snap10 = snap();
      const use10 = await tmplActivity().use(
        { create: { measuredTemplate: false } }, { configure: false }, {});
      const card10 = use10?.message instanceof ChatMessage ? use10.message : null;
      if (!card10) return { fatal: 'section 10 cast produced no card' };
      const flag10 = await until(() => card10.getFlag(MOD, 'saves'), 6000);

      ok('10a. a targetless template cast stamps a WAITING demand — zero targets, no deadline',
        !!flag10 && (flag10.status === 'pending') && ((flag10.targets ?? []).length === 0)
          && (flag10.awaitingTemplate === true) && !flag10.deadline && (flag10.window === 15)
          && (flag10.templateType === 'cube'),
        `flag=${!!flag10} targets=${flag10?.targets?.length} awaiting=${flag10?.awaitingTemplate} `
          + `deadline=${flag10?.deadline} window=${flag10?.window} tmplType=${flag10?.templateType}`);

      // ②'s pin at the DOM: this card carries a REAL Place Measured Template button and it
      // is hidden with the rest — the count guards the vacuous pass.
      const cardEl10 = await until(() => document.querySelector(`[data-message-id="${card10.id}"]`), 4000);
      const btns10 = [...(cardEl10?.querySelectorAll('.card-buttons button[data-action]') ?? [])];
      const hasPlace10 = btns10.some(b => b.dataset.action === 'placeTemplate');
      const visible10 = btns10.filter(b =>
        (b.dataset.action !== 'refundResource') && (b.style.display !== 'none'));
      ok('10b. Place Measured Template exists and hides — the keep-list is refundResource only',
        hasPlace10 && (visible10.length === 0),
        `placeBtn=${hasPlace10} visible=[${visible10.map(b => b.dataset.action).join()}]`);
      const waitLine10 = await until(() => {
        const t = document.querySelector(`[data-message-id="${card10.id}"]`)
          ?.querySelector('.battleflow-saves')?.textContent ?? '';
        return t.includes("waiting for the template's area") ? t : null;
      }, 4000);
      ok('10c. the waiting card says so', !!waitLine10, `line="${(waitLine10 ?? '').trim()}"`);

      // The area lands as the TOOLBAR draws it: an origin-LESS rect (finding ①'s exact
      // shape — a cube spell, no dnd5e origin flag, no drawn canvas shape on this headless
      // page, so only the rect geometry fallback can contain anything). The waiting demand
      // must CLAIM it — stamp the origin on — fill, and arm the clock from that moment.
      // ⚠ Snapshot the OLDER demand BEFORE the rect exists: if it is already templated
      // here, it claimed some EARLIER section's leftover area and 10d2's failure has
      // nothing to do with this rect (the 2026-08-19 hunt).
      const oldBefore10 = {
        targets: (cardOld10.getFlag(MOD, 'saves')?.targets ?? []).length,
        templated: cardOld10.getFlag(MOD, 'saves')?.templated ?? false,
        scenePool: scene.templates.map(t => ({ id: t.id, t: t.t,
          origin: t.getFlag('dnd5e', 'origin') ?? null })),
      };
      const gpx10 = scene.grid.size / scene.grid.distance;
      const side10 = 200 / gpx10; // a 200px square around the victim, in scene units
      const [tpl10] = await scene.createEmbeddedDocuments('MeasuredTemplate', [{
        t: 'rect', x: victimToken.center.x - 100, y: victimToken.center.y - 100,
        direction: 45, distance: side10 * Math.SQRT2
      }]);
      created.templates.push(tpl10.id);
      await sleep(300);
      try { ui.chat?.updateMessage?.(card10); } catch { /* re-renders next message anyway */ }
      const adopted10 = await until(() => {
        const f = card10.getFlag(MOD, 'saves');
        return (f?.templated && !f.awaitingTemplate && f.deadline
          && f.targets.some(t => t.uuid === victim.uuid)) ? f : null;
      });
      // ⚠ The claim's origin WRITE cannot be asserted on this page: template updates
      // silently no-op here (§8's tpl.update() ground truth — setFlag resolves, nothing
      // persists, the collection reads null). The fill itself IS the claim's pin: a
      // WAITING demand can only be fed by templatesForOrigin (empty — the rect is
      // origin-less) or claimBareTemplate, so rows appearing at all proves the claim
      // selected and used the toolbar rect. Origin persistence is LIVE-proven: the
      // 2026-08-17 re-test's claimed template read back origin-tied on the probe.
      ok('10d. the toolbar rect is claimed and fills the waiting demand, clock armed from that moment',
        !!adopted10 && (adopted10.targets.length === 1) && (adopted10.deadline > Date.now())
          && (adopted10.deadline <= Date.now() + 15_500),
        `targets=[${(card10.getFlag(MOD, 'saves')?.targets ?? []).map(t => t.name).join()}] `
          + `deadline=${adopted10?.deadline} now=${Date.now()} `
          + `originOnPage=${JSON.stringify(scene.templates.get(tpl10.id)?.getFlag('dnd5e', 'origin') ?? null)}`);
      const oldFlag10 = cardOld10.getFlag(MOD, 'saves');
      ok('10d2. the OLDER waiting cast is not the customer — one area fills exactly one demand',
        (oldFlag10?.status === 'pending') && ((oldFlag10?.targets ?? []).length === 0)
          && (oldFlag10?.awaitingTemplate === true) && !oldFlag10?.deadline,
        `older: targets=${oldFlag10?.targets?.length} awaiting=${oldFlag10?.awaitingTemplate} `
          + `deadline=${oldFlag10?.deadline}`
          // the fossil wall's own inputs — when this fails, say WHY it failed
          + ` | oldTs=${cardOld10.timestamp} newTs=${card10.timestamp}`
          + ` sameActivity=${oldFlag10?.activityUuid === card10.getFlag(MOD, 'saves')?.activityUuid}`
          + ` oldStatus=${oldFlag10?.status} oldTemplated=${oldFlag10?.templated}`
          + ` tplOrigin=${JSON.stringify(scene.templates.get(tpl10.id)?.getFlag('dnd5e', 'origin') ?? null)}`
          + ` oldBefore=${JSON.stringify(oldBefore10)}`
          + ` newerSeenFromOld=${game.messages.contents.some(m => (m.id !== cardOld10.id)
              && (m.timestamp > cardOld10.timestamp)
              && (m.getFlag(MOD, 'saves')?.activityUuid === oldFlag10?.activityUuid))}`);

      // The arrival is ASKED (an NPC — the GM's popup rightly shows), and the machine runs
      // to the receipt: -30 fails, the half-rule damage applies at ×1.
      // ⚠ Match the popup by the ENTRY's stored name, never the actor's — adoption names
      // entries after their TOKEN, and this victim's token is literally "Hobgoblin" (the
      // prototype it was cloned from; smoke-battleflow's receipts print the same). The
      // first run of this section looked for "BF Test Victim" and missed a popup that was
      // correctly open.
      const entryName10 = adopted10.targets[0]?.name ?? victim.name;
      const popup10 = await until(() => savePopups().find(p => p.textContent.includes(entryName10)), 6000);
      ok('10e. the arrival gets its ask', !!popup10,
        `popups=${savePopups().length} lookingFor="${entryName10}"`);
      [...(popup10?.querySelectorAll('footer button, .form-footer button') ?? [])]
        .find(b => b.textContent.trim() === 'Normal')?.click();
      await until(() => card10.getFlag(MOD, 'saves')?.targets?.every(t => t.done && t.applied), 20000);
      const e10 = entryOf(card10, victim);
      const dmg10 = fresh(snap10).find(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
        && (m.getFlag('dnd5e', 'originatingMessage') === card10.id));
      ok('10f. the adopted demand runs the whole machine — verdict, damage, receipt',
        (e10?.outcome === 'failed') && (victim.system.attributes.hp.value === vMax10 - 10),
        `outcome=${e10?.outcome} applied=${e10?.applied} dmgRolled=${!!dmg10} `
          + `hp=${victim.system.attributes.hp.value}/${vMax10}`);
      await set('saveTimer', 0);
    }

    // ============================================== 11. the GM popup routing (v1.12.0 finding ④ + v1.19.x finding (h))
    // canAnswerFor ALONE routes the saves popups since (h): an ONLINE owner still keeps
    // the GM quiet (the v1.12.0 taste, untouched where it was made), but a player-owned
    // target whose owner is OFFLINE now pops for the GM instead of silently riding the
    // buzzer — the walk's log showed "failed (timer)" eating every player save in a
    // solo-GM room. The buzzer stays the resolver of last resort (11c). The section sets
    // the ownership itself (object form — the dotted key raises validation noise), so the
    // old ownership-precondition SKIP is gone.
    {
      await clearChips();
      const playerUser11 = game.users.find(u => !u.isGM && !u.active);
      let owned11 = false;
      if (pcActor && playerUser11) {
        await pcActor.update({ ownership: { [playerUser11.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
        owned11 = !!pcActor.hasPlayerOwner
          && !game.users.some(u => !u.isGM && u.active && pcActor.testUserPermission(u, 'OWNER'));
      }
      if (!owned11) {
        skips.push(`11: could not produce an offline player owner `
          + `(actor=${!!pcActor} playerUser=${!!playerUser11} hasPlayerOwner=${pcActor?.hasPlayerOwner})`);
      } else {
        priorActor[pcActor.id] = {
          'system.abilities.con.bonuses.save': pcActor.system._source.abilities?.con?.bonuses?.save ?? '',
          'system.attributes.hp.value': pcActor.system._source.attributes.hp.value,
          ...(priorActor[pcActor.id] ?? {})
        };
        await pcActor.update({ 'system.abilities.con.bonuses.save': '-30' });
        await saveBonus(victim, '-30');
        await healFull(victim);
        await healFull(pcActor);
        const pcToken = await mkToken(pcActor, 1400);
        if (!pcToken) return { fatal: 'section 11 PC token never reached the canvas' };
        // 8s window: the pending-state assertions below need a few seconds to LOOK before
        // the buzzer resolves everything out from under them (the first run set 4s and its
        // own 6s popup poll outlived the entire demand — open=0 proved only that the
        // machine had already finished). The buzzer is still the quiet PC's resolver.
        await set('saveTimer', 8);
        target(victimToken, pcToken);
        await sleep(120);
        const use11 = await saveActivity().use({}, { configure: false }, {});
        const card11 = use11?.message instanceof ChatMessage ? use11.message : null;
        if (!card11) return { fatal: 'section 11 cast produced no card' };
        const flag11 = await until(() => card11.getFlag(MOD, 'saves'));
        // Entry names are TOKEN names (this victim's token is "Hobgoblin") — match popups
        // by what the demand actually stored, never by actor name.
        const nameOf11 = a => flag11?.targets?.find(t => t.uuid === a.uuid)?.name ?? a.name;
        const npcName11 = nameOf11(victim);
        const pcName11 = nameOf11(pcActor);

        const npcPopup = await until(() => savePopups().find(p => p.textContent.includes(npcName11)), 4000);
        const pcPopup = await until(() => savePopups().find(p => p.textContent.includes(pcName11)), 4000);
        ok('11a. an empty room pops for EVERYONE — the offline-owner PC included ((h))',
          !!npcPopup && !!pcPopup,
          `npcPopup=${!!npcPopup} pcPopup=${!!pcPopup} open=${savePopups().length} `
            + `names=["${npcName11}","${pcName11}"]`);

        const rowText11 = await until(() => {
          const t = document.querySelector(`[data-message-id="${card11.id}"]`)
            ?.querySelector('.battleflow-saves')?.textContent ?? '';
          return t.includes('waiting on') ? t : null;
        }, 3000);
        ok('11b. the card row names the ROLLER again — "owner offline" described the removed quiet',
          !!rowText11 && !rowText11.includes('owner offline'),
          `row="${(rowText11 ?? '').trim()}"`);

        // Resolve the NPC through its popup; the PC's popup stays open on purpose — the
        // buzzer must STILL be the resolver of last resort past an unanswered popup.
        [...(npcPopup?.querySelectorAll('footer button, .form-footer button') ?? [])]
          .find(b => b.textContent.trim() === 'Normal')?.click();
        await until(() => card11.getFlag(MOD, 'saves')?.targets?.every(t => t.done), 20000);
        const ePc = entryOf(card11, pcActor);
        ok('11c. the buzzer resolves the unanswered PC — timed out, judged, done',
          (ePc?.done === true) && (ePc?.timedOut === true) && (ePc?.outcome === 'failed'),
          `done=${ePc?.done} timedOut=${ePc?.timedOut} outcome=${ePc?.outcome}`);
        await until(() => card11.getFlag(MOD, 'saves')?.targets?.every(t => t.applied), 12000);
        await set('saveTimer', 0);
      }
      if (pcActor && playerUser11) {
        await pcActor.update({ ownership: { [playerUser11.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE } });
      }
    }

    // ============================================== 12. spell-truth geometry (v1.13.0 walk finding ①)
    // Foundry 14's region shim scales a template's stored `distance` by gridSize/100 in
    // the CREATE round-trip (probes 7–9, 2026-08-17: ×1.4 on 140px, ×0.7 on 70px, and
    // `width` comes back as raw pixels) — invisible on this 100px range, which is exactly
    // how every battery stayed green while the live 140px table demanded Salyth from
    // outside every drawn cube. This section builds its own 140px scene and pins the
    // rescue: containment reads the honest dnd5e `dimensions` flag, so the demand matches
    // the SPELL whatever the server did to the stored field. The assertions are
    // FACTOR-PROOF — they hold whether the shim lies or is one day fixed upstream
    // (shimFactor is logged so the fix announces itself in the transcript).
    let card12 = null;               // §13 rides this demand's completed lifecycle
    let tpl12Id = null;
    const actUuid12 = tmplActivity().uuid;
    {
      await clearChips();
      await saveBonus(victim, '-30');
      await healFull(victim);
      shimScene = await Scene.create({
        name: 'BF Shim Range', width: 2800, height: 2100, tokenVision: false,
        grid: { type: 1, size: 140, distance: 5, units: 'ft' }
      });
      const proto = a => foundry.utils.mergeObject(a.prototypeToken.toObject(),
        { actorId: a.id, actorLink: true }, { inplace: false });
      // A 10 ft cube at (1400,1400): honest side 280px. IN stands in the cube's first
      // square (center 1470,1470); OUT stands with its center 350px from the origin —
      // outside the honest 280, inside a ×1.4 phantom's 392 (the Salyth position).
      // DISTINCT actors on purpose: entries dedupe by actor uuid, so one actor's two
      // tokens could never discriminate the phantom from the truth.
      await shimScene.createEmbeddedDocuments('Token',
        [foundry.utils.mergeObject(proto(victim), { x: 1400, y: 1400 }, { inplace: false })]);
      await shimScene.createEmbeddedDocuments('Token',
        [foundry.utils.mergeObject(proto(shielder), { x: 1680, y: 1400 }, { inplace: false })]);
      target();                       // bare — the WAITING stamp is adoption's customer
      await sleep(120);
      const use12 = await tmplActivity().use(
        { create: { measuredTemplate: false } }, { configure: false }, {});
      card12 = use12?.message instanceof ChatMessage ? use12.message : null;
      if (!card12) return { fatal: 'section 12 cast produced no card' };
      await until(() => card12.getFlag(MOD, 'saves'), 6000);

      // The dialog placement's exact shape on the shim scene: origin-tied, honest
      // dimensions stamped, honest diagonal SENT — whatever the server stores is its
      // truth, and the rescue must not care.
      const sent12 = Math.hypot(10, 10);
      const [tpl12] = await shimScene.createEmbeddedDocuments('MeasuredTemplate', [{
        t: 'rect', x: 1400, y: 1400, direction: 45, distance: sent12,
        flags: { dnd5e: { origin: actUuid12, dimensions: { size: 10, adjustedSize: false } } }
      }]);
      tpl12Id = tpl12.id;
      const stored12 = shimScene.templates.get(tpl12.id)?.distance ?? NaN;
      log.push(`section 12 shimFactor=${(stored12 / sent12).toFixed(3)} `
        + `(sent ${sent12.toFixed(3)}, stored ${stored12.toFixed(3)}) — 1.000 means upstream healed`);

      try { ui.chat?.updateMessage?.(card12); } catch { /* the next render carries it */ }
      const adopted12 = await until(() => {
        const f = card12.getFlag(MOD, 'saves');
        return (f?.templated && (f.targets ?? []).length) ? f : null;
      });
      const uuids12 = (adopted12?.targets ?? []).map(t => t.uuid);
      ok('12a. containment is spell-true on a 140px grid — the honest dimensions flag wins',
        !!adopted12 && uuids12.includes(victim.uuid) && !uuids12.includes(shielder.uuid)
          && (uuids12.length === 1),
        `targets=[${(adopted12?.targets ?? []).map(t => t.name).join()}] `
          + `shim=${(stored12 / sent12).toFixed(3)}`);

      // Run it to done for §13: the popup asks for the NPC arrival, -30 fails, applied lands.
      const name12 = adopted12?.targets?.[0]?.name ?? victim.name;
      const popup12 = await until(() => savePopups().find(p => p.textContent.includes(name12)), 6000);
      [...(popup12?.querySelectorAll('footer button, .form-footer button') ?? [])]
        .find(b => b.textContent.trim() === 'Normal')?.click();
      const done12 = await until(() => {
        const f = card12.getFlag(MOD, 'saves');
        return f?.targets?.every(t => t.done && t.applied) ? f : null;
      }, 20000);
      ok('12b. the shim-scene demand runs to applied', !!done12,
        `state=${JSON.stringify((card12.getFlag(MOD, 'saves')?.targets ?? [])
          .map(t => ({ done: t.done, applied: t.applied })))}`);
    }

    // ============================================== 13. the spent sweep converges (finding ②)
    // The completion one-shot demonstrably got lost live (stale Fireball circles with
    // every target applied — the prime suspect is an elect flip mid-chain: probe GM
    // sessions were connecting and disconnecting through the walk). The sweep is a
    // convergent floor now: done + instantaneous + origin-still-standing ⇒ swept on the
    // next render, whoever the elect is by then — and a NEWER same-activity card disarms
    // an old card's sweep forever (the fossil wall: a recast reuses the activity uuid,
    // and an old card must never delete the current cast's area).
    {
      // 13a: the completion one-shot swept §12's template (durationUnits "inst" rides
      // the fixture item).
      const gone13 = await until(() => !shimScene.templates.get(tpl12Id), 8000);
      ok('13a. an instantaneous demand sweeps its area at completion', !!gone13,
        `still=${!!shimScene.templates.get(tpl12Id)}`);

      // 13b: a stale leftover — the lost-one-shot shape — converges on the next render.
      const [stale13] = await shimScene.createEmbeddedDocuments('MeasuredTemplate', [{
        t: 'rect', x: 1400, y: 1400, direction: 45, distance: Math.hypot(10, 10),
        flags: { dnd5e: { origin: actUuid12, dimensions: { size: 10, adjustedSize: false } } }
      }]);
      try { ui.chat?.updateMessage?.(card12); } catch { /* render floor */ }
      const swept13 = await until(() => !shimScene.templates.get(stale13.id), 8000);
      ok('13b. a done demand re-sweeps a stale area on render — the convergent floor', !!swept13,
        `still=${!!shimScene.templates.get(stale13.id)}`);

      // 13c: the fossil wall. The stub is status DONE and carries no `templated`, so no
      // floor in the machine can act on it — it exists only to be newer.
      const stub13 = await ChatMessage.create({
        content: 'BF test — newer same-activity stub (section 13c)',
        flags: { [MOD]: { saves: { status: 'done', activityUuid: actUuid12, targets: [] } } }
      });
      const [stale13c] = await shimScene.createEmbeddedDocuments('MeasuredTemplate', [{
        t: 'rect', x: 1400, y: 1400, direction: 45, distance: Math.hypot(10, 10),
        flags: { dnd5e: { origin: actUuid12, dimensions: { size: 10, adjustedSize: false } } }
      }]);
      try { ui.chat?.updateMessage?.(card12); } catch { /* render floor */ }
      await sleep(1500);
      const held13 = !!shimScene.templates.get(stale13c.id);
      ok('13c. a newer same-activity cast disarms an old card\'s sweep — the fossil wall',
        held13, `survived=${held13}`);
      if (shimScene.templates.get(stale13c.id)) {
        await shimScene.deleteEmbeddedDocuments('MeasuredTemplate', [stale13c.id]);
      }
      await ChatMessage.deleteDocuments([stub13.id]);
    }

    // ============================================== 14. the duration sweep (2026-08-18 finding ①)
    // Faerie Fire's region outlived the spell: the native end-of-concentration cascade owns
    // that deletion but demonstrably lost it (the same lost-one-shot class as §13's), so the
    // sweep floor extends to DURATION areas — spent when the caster no longer wears the
    // concentration effect the usage card names (system.concentration). While concentration
    // holds, the area is alive and must never sweep.
    {
      const [concItem] = await npc.createEmbeddedDocuments('Item', [{
        name: 'BF Test Clinging Web', type: 'spell',
        system: {
          level: 1, school: 'con', properties: ['vocal', 'concentration'],
          duration: { units: 'minute', value: '1' },
          range: { value: '60', units: 'ft' },
          method: 'spell', prepared: 1, identifier: 'bf-test-clinging-web',
          target: { affects: { type: 'creature', count: '', choice: false } },
          activities: {
            bfsaveconc000000: {
              _id: 'bfsaveconc000000', type: 'save',
              activation: { type: 'action', override: false },
              consumption: { targets: [], spellSlot: false },
              damage: { onSave: 'half', parts: [{ custom: { enabled: true, formula: '10' }, types: ['poison'] }] },
              effects: [],
              save: { ability: ['con'], dc: { calculation: '', formula: '15' } },
              target: { override: true, prompt: true,
                template: { type: 'cube', size: '10', units: 'ft', count: '' },
                affects: { type: 'creature', count: '', choice: false } }
            }
          }
        }
      }]);
      created.items.push({ actorId: npc.id, id: concItem.id });
      const concActivity = () => npc.items.get(concItem.id).system.activities.get('bfsaveconc000000');

      await clearChips();
      await saveBonus(victim, '-30');
      await healFull(victim);
      target(); // bare — the WAITING stamp, exactly the live Web/Faerie Fire flow
      await sleep(120);
      const use14 = await concActivity().use(
        { create: { measuredTemplate: false } }, { configure: false }, {});
      const card14 = use14?.message instanceof ChatMessage ? use14.message : null;
      if (!card14) return { fatal: 'section 14 cast produced no card' };
      await until(() => card14.getFlag(MOD, 'saves'), 6000);
      const concEff14 = card14.system?.concentration
        ? npc.effects.get(card14.system.concentration) : null;
      ok('14a. the concentration cast stamps its demand and the card names the effect',
        !!card14.getFlag(MOD, 'saves') && !!concEff14,
        `flag=${!!card14.getFlag(MOD, 'saves')} concId=${card14.system?.concentration ?? 'MISSING'} `
          + `effect=${!!concEff14}`);

      const actUuid14 = concActivity().uuid;
      const [tpl14] = await shimScene.createEmbeddedDocuments('MeasuredTemplate', [{
        t: 'rect', x: 1400, y: 1400, direction: 45, distance: Math.hypot(10, 10),
        flags: { dnd5e: { origin: actUuid14, dimensions: { size: 10, adjustedSize: false } } }
      }]);
      try { ui.chat?.updateMessage?.(card14); } catch { /* the next render carries it */ }
      const adopted14 = await until(() => {
        const f = card14.getFlag(MOD, 'saves');
        return (f?.templated && (f.targets ?? []).length) ? f : null;
      });
      const name14 = adopted14?.targets?.[0]?.name ?? victim.name;
      const popup14 = await until(() => savePopups().find(p => p.textContent.includes(name14)), 6000);
      [...(popup14?.querySelectorAll('footer button, .form-footer button') ?? [])]
        .find(b => b.textContent.trim() === 'Normal')?.click();
      const done14 = await until(() => {
        const f = card14.getFlag(MOD, 'saves');
        return f?.targets?.every(t => t.done && t.applied) ? f : null;
      }, 20000);

      // 14b: done and applied — and the area STANDS, because the spell is still up.
      try { ui.chat?.updateMessage?.(card14); } catch { /* render floor */ }
      await sleep(2000);
      ok('14b. a DURATION area stands after its demand completes — concentration is alive',
        !!done14 && !!shimScene.templates.get(tpl14.id),
        `done=${!!done14} still=${!!shimScene.templates.get(tpl14.id)}`);

      // 14c: concentration ends — the deleteActiveEffect trigger sweeps the orphaned area.
      if (concEff14) await concEff14.delete();
      const gone14 = await until(() => !shimScene.templates.get(tpl14.id), 8000);
      ok('14c. concentration ends and the orphaned area sweeps — finding ① converges',
        !!concEff14 && !!gone14,
        `concEffect=${!!concEff14} still=${!!shimScene.templates.get(tpl14.id)}`);
    }

    // ============================================== 15. the verdict LINES (v1.19.0, FLOW item 7)
    // A table moment opened in public closes in public: each verdict posts ONE bfCard —
    // "holds" good / "fails" bad, wording promoted from verdictText — idempotent under the
    // announced guard, and a legendary-resistance flip posts the CORRECTED line (forced-
    // marked so the twin-supersede never eats it) while the honest fail line stands.
    {
      const linesFor = (cardId, uuid, forced = null) => game.messages.contents.filter(m => {
        const v = m.getFlag(MOD, 'verdictLine');
        return v && (v.sourceMessageId === cardId) && (v.uuid === uuid)
          && ((forced === null) || (!!v.forced === forced));
      });
      await clearChips();
      await saveBonus(victim, '-30');
      await saveBonus(shielder, '+30');
      await healFull(victim);
      await healFull(shielder);
      await victim.update({ 'system.resources.legres.max': 1, 'system.resources.legres.spent': 0 });
      await set('saveTimer', 2);                 // the buzzer rolls both; verdicts land fast
      target(victimToken, shielderToken);
      await sleep(120);
      const use15 = await saveActivity().use({}, { configure: false }, {});
      const card15 = use15?.message instanceof ChatMessage ? use15.message : null;
      if (!card15) return { fatal: 'section 15 cast produced no card' };
      const done15 = await until(() => {
        const f = card15.getFlag(MOD, 'saves');
        return f?.targets?.every(t => t.done && t.applied) ? f : null;
      }, 25000);
      await sleep(1200); // the announce rides after the (zero) pause — let the creates land

      const failLines = await until(() => {
        const l = linesFor(card15.id, victim.uuid, false);
        return l.length ? l : null;
      }, 8000) ?? [];
      const holdLines = linesFor(card15.id, shielder.uuid, false);
      ok('15a. one public line per verdict — "fails" bad for the failure, "holds" good for the save',
        !!done15 && (failLines.length === 1) && /fails/.test(failLines[0]?.content ?? '')
          && (holdLines.length === 1) && /holds/.test(holdLines[0]?.content ?? ''),
        `fail=${failLines.length} hold=${holdLines.length}`);
      ok('15b. the line carries verdictText verbatim — total, DC and the stakes-word',
        /vs DC 15/.test(failLines[0]?.content ?? '') && /vs DC 15/.test(holdLines[0]?.content ?? '')
          && /half damage/.test(holdLines[0]?.content ?? ''),
        `failContent has DC=${/vs DC 15/.test(failLines[0]?.content ?? '')}`);

      // 15c — a render storm re-announces nothing (the announced guard through queueFlagWrite).
      for (let i = 0; i < 3; i++) { try { ui.chat?.updateMessage?.(card15); } catch {} }
      await sleep(1500);
      ok('15c. re-renders add no second line — announced is claimed before posting',
        (linesFor(card15.id, victim.uuid, false).length === 1)
          && (linesFor(card15.id, shielder.uuid, false).length === 1),
        `victim=${linesFor(card15.id, victim.uuid, false).length} shielder=${linesFor(card15.id, shielder.uuid, false).length}`);

      // 15d — legendary resistance flips the failure AFTER its line posted: the corrected
      // "holds (legendary resistance)" line posts forced-marked; the fail line STANDS.
      const entry15 = card15.getFlag(MOD, 'saves')?.targets?.find(t => t.uuid === victim.uuid);
      const rollMsg15 = entry15?.rollMessageId ? game.messages.get(entry15.rollMessageId) : null;
      if (rollMsg15) await rollMsg15.setFlag('dnd5e', 'roll.forceSuccess', true);
      const corrected = await until(() => {
        const l = linesFor(card15.id, victim.uuid, true);
        return l.length ? l : null;
      }, 10000) ?? [];
      const flipped15 = card15.getFlag(MOD, 'saves')?.targets?.find(t => t.uuid === victim.uuid);
      ok('15d. the LR flip announces the CORRECTED verdict; the honest fail line stands',
        !!rollMsg15 && (flipped15?.outcome === 'saved') && (flipped15?.forced === true)
          && (corrected.length === 1) && /legendary resistance/.test(corrected[0]?.content ?? '')
          && (linesFor(card15.id, victim.uuid, false).length === 1),
        `flipped=${flipped15?.outcome}/${flipped15?.forced} corrected=${corrected.length}`);

      await set('saveTimer', 0);
      await victim.update({ 'system.resources.legres.max':
        priorActor[victim.id]['system.resources.legres.max'],
        'system.resources.legres.spent': priorActor[victim.id]['system.resources.legres.spent'] });
    }

    // ============================================== 16. the DEAD-TARGET gate (v1.19.0, user call)
    // The user's reversal of the old "dead targets still roll" corner: DEAD (dead status, or
    // an NPC at 0 HP) is skipped at the stamp and at adoption; an all-dead cast stamps
    // NOTHING — no demand, no auto-roll; a DYING PC (character at 0 HP) still rolls.
    {
      // 16a — mixed: the dead NPC is dropped from the rows, the living one is demanded.
      await saveBonus(victim, '');
      await saveBonus(shielder, '');
      await victim.update({ 'system.attributes.hp.value': 0 });   // npc at 0 ⇒ dead
      await healFull(shielder);
      target(victimToken, shielderToken);
      await sleep(120);
      const before16a = snap();
      const use16a = await saveActivity().use({}, { configure: false }, {});
      const card16a = use16a?.message instanceof ChatMessage ? use16a.message : null;
      const flag16a = await until(() => card16a?.getFlag(MOD, 'saves'), 6000);
      ok('16a. mixed dead+living — only the living target is stamped',
        !!flag16a && (flag16a.targets.length === 1)
          && (flag16a.targets[0].uuid === shielder.uuid),
        `targets=${JSON.stringify(flag16a?.targets?.map(t => t.name))}`);
      await ChatMessage.deleteDocuments(fresh(before16a).map(m => m.id)).catch(() => {});

      // 16b — all dead: NO saves flag, NO auto damage roll, fully native.
      await shielder.update({ 'system.attributes.hp.value': 0 });
      target(victimToken, shielderToken);
      await sleep(120);
      const before16b = snap();
      const use16b = await saveActivity().use({}, { configure: false }, {});
      const card16b = use16b?.message instanceof ChatMessage ? use16b.message : null;
      await sleep(2500);
      const autoDmg16b = fresh(before16b).find(m =>
        (m.getFlag('dnd5e', 'roll.type') === 'damage')
        && (m.getFlag('dnd5e', 'originatingMessage') === card16b?.id));
      ok('16b. every target dead — no demand stamps and no damage auto-rolls (fully native)',
        !!card16b && !card16b.getFlag(MOD, 'saves') && !autoDmg16b,
        `flag=${!!card16b?.getFlag(MOD, 'saves')} autoDmg=${!!autoDmg16b}`);
      await ChatMessage.deleteDocuments(fresh(before16b).map(m => m.id)).catch(() => {});

      // 16c — the boundary the predicate is NARROWER for: a dying PC (character, 0 HP) is
      // still demanded — the area's damage and the death-save failures are real.
      if (pcActor) {
        priorActor[pcActor.id] = {
          ...(priorActor[pcActor.id] ?? {}),
          'system.attributes.hp.value': pcActor.system._source.attributes.hp.value
        };
        const pcToken16 = await mkToken(pcActor, 1600);
        await pcActor.update({ 'system.attributes.hp.value': 0 });
        target(pcToken16);
        await sleep(120);
        const before16c = snap();
        const use16c = await saveActivity().use({}, { configure: false }, {});
        const card16c = use16c?.message instanceof ChatMessage ? use16c.message : null;
        const flag16c = await until(() => card16c?.getFlag(MOD, 'saves'), 6000);
        ok('16c. a DYING PC (0 HP character) is still demanded — the gate is dead-only',
          !!flag16c && (flag16c.targets.length === 1)
            && (flag16c.targets[0].uuid === pcActor.uuid),
          `targets=${JSON.stringify(flag16c?.targets?.map(t => t.name))}`);
        await ChatMessage.deleteDocuments(fresh(before16c).map(m => m.id)).catch(() => {});
        await pcActor.update({ 'system.attributes.hp.value':
          priorActor[pcActor.id]['system.attributes.hp.value'] });
      } else {
        skips.push('16c — no BF Test PC Attacker fixture; run smoke-battleflow first');
      }
      await healFull(victim);
      await healFull(shielder);
    }

    // ============================================== 17. the BASH shape (v1.19.0, FLOW item 5)
    // Shield Master's fix is CONTENT (user ruling): a feat's save activity with a BOUND
    // status effect is already a full customer of this machine — receipts, revert, verdict
    // lines and the press all come free. This section pins the shape end to end so the
    // world's real feat (Thomas's, verified by tools/fix-shield-master.mjs) can never
    // silently regress in the machine.
    {
      const EFF_BASH = 'bfbashprone00000';
      const [bashItem] = await npc.createEmbeddedDocuments('Item', [{
        name: 'BF Test Bash', type: 'feat',
        system: {
          type: { value: 'feat' },
          activities: {
            bfbashact0000000: {
              _id: 'bfbashact0000000', type: 'save',
              activation: { type: 'bonus', override: false },
              consumption: { targets: [] },
              damage: { onSave: 'none', parts: [] },
              effects: [{ _id: EFF_BASH, onSave: false }],
              save: { ability: ['con'], dc: { calculation: '', formula: '15' } },
              target: { override: false, prompt: true,
                affects: { type: 'creature', count: '1', choice: false } }
            }
          }
        },
        effects: [
          { _id: EFF_BASH, name: 'BF Bashed Prone', transfer: false, disabled: false,
            img: 'icons/svg/falling.svg', statuses: ['prone'],
            description: '<p>Knocked Prone (BF bash fixture).</p>' }
        ]
      }]);
      created.items.push({ actorId: npc.id, id: bashItem.id });
      const bashActivity = () => npc.items.get(bashItem.id).system.activities.get('bfbashact0000000');

      await set('saveTimer', 2);
      // 17a — the failure presses Prone through the ordinary machine, receipted.
      await saveBonus(victim, '-30');
      await healFull(victim);
      if (victim.statuses?.has?.('prone')) await victim.toggleStatusEffect('prone', { active: false });
      target(victimToken);
      await sleep(120);
      const use17a = await bashActivity().use({}, { configure: false }, {});
      const card17a = use17a?.message instanceof ChatMessage ? use17a.message : null;
      const done17a = await until(() => {
        const f = card17a?.getFlag(MOD, 'saves');
        return f?.targets?.every(t => t.done && t.applied) ? f : null;
      }, 25000);
      await sleep(800);
      const receipt17a = card17a?.getFlag(MOD, 'effectReceipt');
      ok('17a. a FEAT save activity with a bound status effect presses Prone on the failure, receipted',
        !!done17a && victim.statuses?.has?.('prone')
          && !!receipt17a?.targets?.some(t => (t.uuid === victim.uuid)
            && t.effects.some(e => e.name === 'BF Bashed Prone')),
        `prone=${victim.statuses?.has?.('prone')} receipt=${!!receipt17a}`);

      // 17b — the pass leaves the target standing, and item 7's line says "holds".
      await saveBonus(shielder, '+30');
      await healFull(shielder);
      if (shielder.statuses?.has?.('prone')) await shielder.toggleStatusEffect('prone', { active: false });
      target(shielderToken);
      await sleep(120);
      const use17b = await bashActivity().use({}, { configure: false }, {});
      const card17b = use17b?.message instanceof ChatMessage ? use17b.message : null;
      const done17b = await until(() => {
        const f = card17b?.getFlag(MOD, 'saves');
        return f?.targets?.every(t => t.done && t.applied) ? f : null;
      }, 25000);
      await sleep(1200);
      const holdLine17 = game.messages.contents.find(m => {
        const v = m.getFlag(MOD, 'verdictLine');
        return v && (v.sourceMessageId === card17b?.id) && (v.uuid === shielder.uuid);
      });
      ok('17b. the pass stays standing and the verdict line says holds',
        !!done17b && !shielder.statuses?.has?.('prone')
          && !!holdLine17 && /holds/.test(holdLine17?.content ?? ''),
        `prone=${shielder.statuses?.has?.('prone')} line=${!!holdLine17}`);

      await set('saveTimer', 0);
      if (victim.statuses?.has?.('prone')) await victim.toggleStatusEffect('prone', { active: false });
      await saveBonus(victim, '');
      await saveBonus(shielder, '');
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
    for (const a of [victim, shielder, npc, game.actors.getName('BF Test PC Attacker')]
      .filter(Boolean)) {
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
