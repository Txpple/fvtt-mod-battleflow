// Battle Flow Phase 1 smoke test — drives a real attack chain in the live world through the
// bridge (same Foundry class the house scripts use) and asserts every link:
//   hit → auto damage roll → auto apply → receipt → revert (real DOM click) →
//   immunity receipt (rolled N, took 0, and the row says WHY) → miss → silence.
// Fixtures live on a dedicated "Battle Flow Test Range" scene (viewed LOCALLY, never
// activated — players' scene is untouched). Settings are switched on for the test and back
// OFF at the end: defaults-off is the design's dogfood contract.
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

setTimeout(() => { console.error('[smoke] WATCHDOG: 300s — hard abort'); process.exit(3); }, 300_000);

const f = new Foundry(foundryConfig(env));

console.log('[smoke] connecting…');
await f.connect();
await preflightSoleGM(f);
console.log('[smoke] connected');

let failures = 0;
const report = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// ---------------------------------------------------------------- 1. preflight + settings on
let priorSettings = null;
{
  const r = await f.evaluate(async () => {
    const MOD = 'fvtt-mod-battleflow';
    const mod = game.modules.get(MOD);
    if (!mod?.active) return { ok: false, why: `module active=${mod?.active}` };
    // Remember the table's current settings — the test restores THEM at the end, not
    // hardcoded defaults, so running this mid-session never yanks settings out from under
    // a GM who has already walked the dogfood ladder.
    const prior = {
      autoDamage: game.settings.get(MOD, 'autoDamage'),
      autoApply: game.settings.get(MOD, 'autoApply'),
      dramaticBeat: game.settings.get(MOD, 'dramaticBeat'),
      requireTarget: game.settings.get(MOD, 'requireTarget'),
      reactionHold: game.settings.get(MOD, 'reactionHold'),
      effectRiders: game.settings.get(MOD, 'effectRiders'),
      masteryRiders: game.settings.get(MOD, 'masteryRiders'),
    };
    await game.settings.set(MOD, 'autoDamage', 'all');
    await game.settings.set(MOD, 'autoApply', true);
    await game.settings.set(MOD, 'dramaticBeat', 0);
    // The test exercises the primary (usage-card) chain and always targets first, so the
    // no-target gate stays out of the way; restored with the rest at the end.
    await game.settings.set(MOD, 'requireTarget', false);
    // This suite is about the Phase 1 chain; a reaction hold would legitimately stop it dead.
    await game.settings.set(MOD, 'reactionHold', false);
    // The 1.9 features get their own suite (smoke-effects).
    await game.settings.set(MOD, 'effectRiders', false);
    await game.settings.set(MOD, 'masteryRiders', false);
    // Scrub any reaction the hold suite may have left on the test NPC — a stray Shield there
    // holds every attack and makes this suite fail for the wrong reason.
    for (const name of ['BF Test Victim', 'BF Test Attacker']) {
      const a = game.actors.getName(name);
      for (const it of a?.items.filter(i => i.type === 'spell' && i.name === 'Shield') ?? []) await it.delete();
      const tok = game.scenes.getName('Battle Flow Test Range')?.tokens.find(t => t.actorId === a?.id);
      const ta = tok?.actor;
      if (ta && ta !== a) {
        for (const it of ta.items.filter(i => i.type === 'spell' && i.name === 'Shield')) await it.delete();
      }
    }
    return {
      ok: true, prior,
      user: game.user.name,
      isActiveGM: game.users.activeGM?.isSelf ?? false,
      elect: game.users.activeGM?.name ?? null,
      autoDamage: game.settings.get(MOD, 'autoDamage'),
      autoApply: game.settings.get(MOD, 'autoApply'),
      trays: game.settings.get('dnd5e', 'autoCollapseChatTrays'),
    };
  }, null);
  report('module active + settings on', r.ok && r.autoDamage === 'all' && r.autoApply === true,
    JSON.stringify(r));
  if (!r.ok) {
    console.error('[smoke] preflight failed (module inactive) — aborting');
    await f.disconnect?.();
    process.exit(1);
  }
  // The auto-apply elect is whichever active GM outranks the rest — the bridge when alone,
  // a logged-in human GM otherwise. Either topology is a valid test; the receipt poll and
  // DOM asserts run on the bridge's own view regardless of which client applied.
  // The applying client runs whatever code it LOADED — after a deploy, an open window is
  // stale until refreshed. `node tools/reload-clients.mjs` refreshes every other client.
  if (!r.isActiveGM) console.log(`  note: "${r.elect}" is the activeGM elect — ITS loaded code applies damage (stale until refreshed after a deploy)`);
  priorSettings = r.prior;
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

    // Full HP before every run: a previous run that died mid-flight can leave the victim at
    // 0, and "applied 0 damage" then looks like a resolver failure instead of an empty pool.
    for (const id of [victimToken, attackerToken]) {
      const ta = scene.tokens.get(id)?.actor;
      if (ta?.system.attributes?.hp?.max) {
        await ta.update({
          'system.attributes.hp.value': ta.system.attributes.hp.max,
          'system.attributes.hp.temp': 0,
        });
      }
    }

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
      // ⚠ THE ONE FORCING HOLE LEFT UNGUARDED UNTIL 2026-08-23. Flat AC 1 + advantage makes a
      // miss a 1-in-400 double fumble, not an impossibility, and this section is the only one
      // of the four that did not say so: sections 2 and 4 return `fumble`, section 3 tolerates
      // a nat-20 crit through AC 40 explicitly. Here a fumble produced "no receipted damage
      // message" and a hard exit - a correct module reported as a broken gate, with nothing in
      // the output naming the dice. It rides in the failure detail now.
      const fumble = rolls[0].isFumble ?? false;

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
        return { ok: false, fumble, why: fumble
          ? `THE FORCED HIT MISSED: natural 1 on both advantage dice vs flat AC 1 (a 1-in-400 `
            + `run, not a defect - re-run before diagnosing). attackTotal=${attackTotal}; `
            + `tail=${JSON.stringify(tail)}`
          : `no receipted damage message; attackTotal=${attackTotal} fumble=false; `
            + `tail=${JSON.stringify(tail)}` };
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
      // The applied card's damage tray must sit collapsed, as if Apply had been pressed
      // (world setting is not "manual" here, so the guard doesn't apply). Report EVERY
      // rendered instance of the card — chat log, notifications pane, popouts — because a
      // message can render into several DOM trees and each has its own tray.
      const trays = Array.from(document.querySelectorAll(
        `[data-message-id="${damageMsgId}"] damage-application`)).map(t => ({
          open: t.open,
          container: t.closest('#chat-notifications') ? 'notifications'
            : t.closest('#chat') ? 'chat-log' : (t.closest('[id]')?.id ?? 'unknown'),
        }));
      // Native Apply collapses only the tray that was clicked; other DOM instances keep
      // their state. Parity target: the persistent chat-log instance must be collapsed.
      const trayOpen = trays.some(t => t.container === 'chat-log' && t.open);
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
        buttonGone: !buttonAfter, trayOpen, trays,
      };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    }
  }, fx);
  report('applied card tray auto-collapsed (as if Apply pressed)', r.ok && r.trayOpen === false,
    r.ok ? `instances=${JSON.stringify(r.trays)}` : r.why);
  report('revert restores the HP snapshot (real click)',
    r.ok && r.hp.value === r.expectedHp.value && (r.hp.temp ?? null) === (r.expectedHp.temp ?? null),
    r.ok ? `hp back to ${r.hp.value}; button removed on re-render: ${r.buttonGone}` : r.why);
}

// ------------------------------------------- 4b. the immunity receipt (rolled N, took 0, WHY)
// A cold-immune Ice Mephit "took" a rolled 9 with nothing on the card saying why (reported
// live 2026-08-15) — the receipt now carries the system's own trait verdicts. Immunity to the
// weapon's OWN damage type (read from the item, never hardcoded) makes the victim take
// nothing while the roll still lands.
{
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    const base = game.actors.get(victimId);
    const priorDi = foundry.utils.deepClone(base.system._source.traits.di);
    try {
      const victim = canvas.tokens.get(victimToken).actor;
      const attacker = game.actors.get(attackerId);
      const weapon = attacker.items.getName(itemName);
      const activity = weapon.system.activities.find(a => a.type === 'attack');
      const types = new Set([
        ...(weapon.system.damage?.base?.types ?? []),
        ...((activity?.damage?.parts ?? []).flatMap(p => [...(p.types ?? [])])),
      ]);
      if (!types.size) return { ok: false, why: `${itemName} deals no typed damage — nothing to be immune to` };

      await base.update({
        'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1,
        'system.traits.di.value': [...types],
      });
      // Full pool first: an assertion that a number did not move is only worth anything if
      // the number could have moved (smoke-hold's §6 lesson, generalised in the handoff).
      await victim.update({
        'system.attributes.hp.value': victim.system.attributes.hp.max,
        'system.attributes.hp.temp': 0,
      });
      const hp0 = victim.system._source.attributes.hp.value;
      const max = victim.system.attributes.hp.max;

      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
      const usageId = results?.message?.id ?? null;
      if (!usageId) return { ok: false, why: 'no usage message id' };
      const rolls = await activity.rollAttack(
        { advantage: true },
        { configure: false },
        { data: { 'flags.dnd5e.originatingMessage': usageId } });
      const fumble = rolls?.[0]?.isFumble ?? false;

      // Whole-log search by originating id — a tail window flakes (handoff ground truth).
      let damageMsg = null;
      for (let i = 0; i < 40 && !damageMsg; i++) {
        await new Promise(r => setTimeout(r, 250));
        damageMsg = game.messages.contents.find(m =>
          m.getFlag('dnd5e', 'roll.type') === 'damage'
          && m.getFlag('dnd5e', 'originatingMessage') === usageId
          && m.getFlag('fvtt-mod-battleflow', 'receipt'));
      }
      if (!damageMsg) return { ok: true, fumble, noDamage: true };

      const entry = damageMsg.getFlag('fvtt-mod-battleflow', 'receipt')
        .targets.find(t => t.uuid === victim.uuid);
      const rolled = damageMsg.rolls.reduce((n, r) => n + r.total, 0);
      const hp1 = victim.system._source.attributes.hp.value;

      // What the table is TOLD: the receipt row in this client's own chat DOM.
      let rowText = '';
      for (let i = 0; i < 20 && !rowText.includes('immune'); i++) {
        await new Promise(r => setTimeout(r, 250));
        rowText = document.querySelector(
          `[data-message-id="${damageMsg.id}"] .battleflow-receipt`)?.textContent ?? '';
      }
      return { ok: true, fumble, rolled, entry, max, hp0, hp1, rowText: rowText.trim(), types: [...types] };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    } finally {
      await base.update({ 'system.traits.di': priorDi });
    }
  }, fx);

  if (!r.ok) {
    report('immunity receipt (rolled N, took 0, why)', false, r.why);
  } else if (r.noDamage) {
    if (r.fumble) console.log('  SKIP immunity receipt — nat-1 fumble missed outright (flake, 1/400)');
    else report('immunity receipt (rolled N, took 0, why)', false, 'no receipted damage message appeared');
  } else {
    report('immune target starts with a pool that could move', r.hp0 === r.max, `hp ${r.hp0}/${r.max}`);
    report('immune target takes nothing while the roll lands',
      r.rolled > 0 && r.hp1 === r.hp0 && r.entry?.delta?.value === 0,
      `rolled ${r.rolled}, hp ${r.hp0} → ${r.hp1}`);
    report('receipt records taken 0 + the immunity verdict',
      r.entry?.taken === 0 && (r.entry?.traits ?? []).some(t => t.outcome === 'immune' && r.types.includes(t.type)),
      JSON.stringify({ taken: r.entry?.taken, traits: r.entry?.traits }));
    // textContent concatenates the flex spans without whitespace (the spacing is CSS gap),
    // so match the phrase itself, pinned to the actual damage type.
    report('the row SAYS it — "immune to <type>"',
      r.types.some(t => r.rowText.includes(`immune to ${t}`)),
      `row: "${r.rowText}"`);
  }
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

// ------------------------------------------- 5b. polish gates: the card always posts + no-target
// v1.10.0 ripped the suppression machinery out (user call: cards always post, buttons hide).
// What this section now owns: every use posts exactly one card, the suppress* settings stay
// unregistered, and the no-target gate still refuses an untargeted attack.
{
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    const MOD = 'fvtt-mod-battleflow';
    try {
      const out = {};
      const base = game.actors.get(victimId);
      const attacker = game.actors.get(attackerId);
      await base.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 40 });
      const activity = () => attacker.items.getName(itemName).system.activities
        .find(a => a.type === 'attack');
      const usageCards = () => game.messages.contents.filter(m =>
        ((m.type === 'usage') || (m.getFlag('dnd5e', 'messageType') === 'usage'))
        && m.speaker?.alias?.startsWith('BF Test'));

      // (a) The rip stayed ripped: no suppress* setting is registered.
      out.suppressGone = ['suppressAttackCards', 'suppressWeaponCards', 'suppressSpellCards',
        'suppressFeatureCards', 'suppressOtherCards']
        .every(k => !game.settings.settings.has(`${MOD}.${k}`));

      // (b) Every use shows its first card: one attack, exactly one usage card.
      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const before = usageCards().length;
      await activity().use({ subsequentActions: false }, { configure: false }, {});
      await new Promise(r => setTimeout(r, 1500));
      out.cardDelta = usageCards().length - before;

      // (c) No-target gate: with nothing targeted the use is refused outright.
      await game.settings.set(MOD, 'requireTarget', true);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      const before3 = game.messages.size;
      const result = await activity().use({ subsequentActions: false }, { configure: false }, {});
      await new Promise(r => setTimeout(r, 1000));
      out.gateRefused = !result;
      out.gateMessagesCreated = game.messages.size - before3;
      await game.settings.set(MOD, 'requireTarget', false);
      return { ok: true, ...out };
    } catch (err) {
      await game.settings.set(MOD, 'requireTarget', false);
      return { ok: false, why: `${err.message}\n${err.stack}` };
    }
  }, fx);
  report('the suppression machinery stays ripped (no suppress* settings registered)',
    r.ok && r.suppressGone === true, r.ok ? '' : r.why);
  report('every use shows its first card (one attack → one usage card)', r.ok && r.cardDelta === 1,
    r.ok ? `cards created: ${r.cardDelta}` : r.why);
  report('no-target gate refuses the attack', r.ok && r.gateRefused && r.gateMessagesCreated === 0,
    r.ok ? `refused=${r.gateRefused}, messages created: ${r.gateMessagesCreated}` : r.why);
}

// -------------------------------------------- 5c. the attacker-side mode gate (NPC / PC / all)
// Section 3 covers "all". This one proves the two one-sided modes actually exclude the other
// side — the gate is what lets the table dogfood the monster side and the player side
// separately. NOTE: the bridge is a GM, so both attacks here are rolled by a GM client; what
// is under test is the ACTOR-TYPE gate, not the player-client path (which needs a real player
// login and is dogfooded at the table).
{
  const r = await f.evaluate(async ({ victimId, victimToken, attackerId, itemName }) => {
    const MOD = 'fvtt-mod-battleflow';
    const priorMode = game.settings.get(MOD, 'autoDamage');
    const priorApply = game.settings.get(MOD, 'autoApply');
    try {
      // Damage must be free to ROLL but never applied — four forced hits would otherwise kill
      // the victim mid-matrix and the later attacks would resolve against a corpse.
      await game.settings.set(MOD, 'autoApply', false);
      const base = game.actors.get(victimId);
      await base.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });

      // A character-type attacker, cloned from the NPC's own attack item so the two sides
      // differ ONLY in actor.type. Idempotent by name; cleaned up with the rest by alias.
      const npcAttacker = game.actors.get(attackerId);
      let pcAttacker = game.actors.getName('BF Test PC Attacker');
      if (!pcAttacker) {
        const weapon = npcAttacker.items.getName(itemName);
        pcAttacker = await Actor.create({
          name: 'BF Test PC Attacker', type: 'character',
          items: [weapon.toObject()],
        });
      }
      if (pcAttacker.type !== 'character') return { ok: false, why: `PC fixture is type ${pcAttacker.type}` };

      const attackOnce = async actor => {
        canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
        const activity = actor.items.getName(itemName).system.activities
          .find(a => a.type === 'attack');
        if (!activity) return { rolled: null, why: `${actor.name} has no attack activity` };
        const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
        const usageId = results?.message?.id ?? null;
        if (!usageId) return { rolled: null, why: `${actor.name}: no usage message` };
        const rolls = await activity.rollAttack(
          { advantage: true },
          { configure: false },
          { data: { 'flags.dnd5e.originatingMessage': usageId } });
        let dmg = null;
        for (let i = 0; i < 16 && !dmg; i++) {
          await new Promise(r => setTimeout(r, 250));
          dmg = game.messages.contents.slice(-8).find(m =>
            m.getFlag('dnd5e', 'roll.type') === 'damage'
            && m.getFlag('dnd5e', 'originatingMessage') === usageId);
        }
        // vs AC 1 with advantage only a fumble misses (1/400) — reported so a flake reads
        // as a flake rather than a broken gate.
        return { rolled: !!dmg, total: rolls?.[0]?.total, fumble: rolls?.[0]?.isFumble ?? false };
      };

      const out = {};
      await game.settings.set(MOD, 'autoDamage', 'npc');
      out.npcMode = { npc: await attackOnce(npcAttacker), pc: await attackOnce(pcAttacker) };
      await game.settings.set(MOD, 'autoDamage', 'pc');
      out.pcMode = { npc: await attackOnce(npcAttacker), pc: await attackOnce(pcAttacker) };
      return { ok: true, ...out };
    } catch (err) {
      return { ok: false, why: `${err.message}\n${err.stack}` };
    } finally {
      await game.settings.set(MOD, 'autoDamage', priorMode);
      await game.settings.set(MOD, 'autoApply', priorApply);
    }
  }, fx);

  if (!r.ok) {
    report('attacker-side mode gate', false, r.why);
  } else {
    const cell = c => `${c.rolled}${c.fumble ? ' (FUMBLE — flake)' : ''}${c.why ? ` [${c.why}]` : ''}`;
    // A fumble legitimately produces no damage, so it can only mask a should-roll case.
    const rolledOrFlake = c => (c.rolled === true) || (c.fumble === true);
    report('mode "npc": an NPC attack still resolves', rolledOrFlake(r.npcMode.npc), cell(r.npcMode.npc));
    report('mode "npc": a PC attack rolls nothing', r.npcMode.pc.rolled === false, cell(r.npcMode.pc));
    report('mode "pc": a PC attack resolves', rolledOrFlake(r.pcMode.pc), cell(r.pcMode.pc));
    report('mode "pc": an NPC attack rolls nothing', r.pcMode.npc.rolled === false, cell(r.pcMode.npc));
  }
}

// ---------------------- 6. restore the table's prior settings + test chat-log cleanup
{
  const r = await f.evaluate(async prior => {
    const MOD = 'fvtt-mod-battleflow';
    await game.settings.set(MOD, 'autoDamage', prior?.autoDamage ?? 'off');
    await game.settings.set(MOD, 'autoApply', prior?.autoApply ?? false);
    await game.settings.set(MOD, 'dramaticBeat', prior?.dramaticBeat ?? 0);
    await game.settings.set(MOD, 'requireTarget', prior?.requireTarget ?? false);
    await game.settings.set(MOD, 'reactionHold', prior?.reactionHold ?? false);
    await game.settings.set(MOD, 'effectRiders', prior?.effectRiders ?? false);
    await game.settings.set(MOD, 'masteryRiders', prior?.masteryRiders ?? false);
    const testMessages = game.messages.filter(m => m.speaker?.alias?.startsWith('BF Test'));
    await ChatMessage.deleteDocuments(testMessages.map(m => m.id));
    return {
      autoDamage: game.settings.get(MOD, 'autoDamage'),
      autoApply: game.settings.get(MOD, 'autoApply'),
      deletedMessages: testMessages.length,
    };
  }, priorSettings);
  report('settings restored to pre-test values + chat cleaned',
    r.autoDamage === (priorSettings?.autoDamage ?? 'off') && r.autoApply === (priorSettings?.autoApply ?? false),
    JSON.stringify(r));
}

console.log(failures ? `\n[smoke] ${failures} FAILURE(S)` : '\n[smoke] ALL PASS');
await f.disconnect?.();
process.exit(failures ? 1 : 0);
