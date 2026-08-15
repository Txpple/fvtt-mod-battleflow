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
      suppressAttackCards: game.settings.get(MOD, 'suppressAttackCards'),
      requireTarget: game.settings.get(MOD, 'requireTarget'),
      reactionHold: game.settings.get(MOD, 'reactionHold'),
    };
    await game.settings.set(MOD, 'autoDamage', 'all');
    await game.settings.set(MOD, 'autoApply', true);
    await game.settings.set(MOD, 'dramaticBeat', 0);
    // The test exercises the primary (usage-card) chain and always targets first, so the
    // polish gates stay out of the way; both are restored with the rest at the end.
    await game.settings.set(MOD, 'suppressAttackCards', false);
    await game.settings.set(MOD, 'requireTarget', false);
    // This suite is about the Phase 1 chain; a reaction hold would legitimately stop it dead.
    await game.settings.set(MOD, 'reactionHold', false);
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
  if (!r.isActiveGM) console.log('  note: another GM client is the activeGM elect — testing the multi-client path');
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

// ------------------------------------------- 5b. polish gates: suppression + no-target
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

      // (a) Suppression ON: using an attack must create no usage card.
      await game.settings.set(MOD, 'suppressAttackCards', true);
      canvas.tokens.get(victimToken).setTarget(true, { releaseOthers: true });
      const before = usageCards().length;
      await activity().use({ subsequentActions: false }, { configure: false }, {});
      await new Promise(r => setTimeout(r, 1500));
      out.suppressedDelta = usageCards().length - before;

      // (b) Suppression OFF: the native card comes back (the escape hatch really works).
      await game.settings.set(MOD, 'suppressAttackCards', false);
      const before2 = usageCards().length;
      await activity().use({ subsequentActions: false }, { configure: false }, {});
      await new Promise(r => setTimeout(r, 1500));
      out.restoredDelta = usageCards().length - before2;

      // (b2) An attack card that CARRIES EFFECTS is never suppressed — that tray is the only
      // way a spell's riders reach a target (Ray of Frost's slow vanished when it wasn't).
      await game.settings.set(MOD, 'suppressAttackCards', true);
      // Prefer the GM-owned stand-in over the live PC. Gren is played at the table and runs
      // himself out of spell slots; a cast refused for want of a slot creates no card at all
      // and reads here as "suppression ate it" — a fixture failure wearing a bug's clothes
      // (bit 2026-08-15, when he was at 0/4). The clone is ours and is topped back up.
      const spellCaster = game.actors.getName('BF Test Shielder')
        ?? game.actors.getName('Gren Greenmantle');
      const riderSpell = spellCaster?.items.find(i =>
        i.type === 'spell'
        && i.system.activities?.some?.(a => a.type === 'attack')
        && i.effects?.size);
      // A levelled spell with no slot left cannot be cast, so the path is unexercised rather
      // than broken — say which, instead of failing.
      const level = riderSpell?.system.level ?? 0;
      const slotted = !level || Object.entries(spellCaster?.system.spells ?? {}).some(([key, slot]) => {
        const numbered = /^spell(\d+)$/.exec(key);
        const slotLevel = numbered ? Number(numbered[1]) : slot?.level;
        return slot?.value && slot?.max && Number.isFinite(slotLevel) && (slotLevel >= level);
      });
      if (riderSpell && !slotted) out.effectCard = { spell: null, why: `${spellCaster.name} has no level-${level} slot left` };
      if (riderSpell && slotted) {
        const act = riderSpell.system.activities.contents.find(a => a.type === 'attack');
        const before = game.messages.size;
        await act.use({ subsequentActions: false }, { configure: false }, {});
        await new Promise(r => setTimeout(r, 1200));
        const created = game.messages.contents.slice(before);
        out.effectCard = {
          spell: riderSpell.name,
          cardSurvived: created.some(m => (m.type === 'usage') && m.system?.effects?.length),
        };
      } else if (!riderSpell) {
        out.effectCard = { spell: null, why: 'no attack-roll spell with effects found' };
      }
      await game.settings.set(MOD, 'suppressAttackCards', false);

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
      await game.settings.set(MOD, 'suppressAttackCards', false);
      await game.settings.set(MOD, 'requireTarget', false);
      return { ok: false, why: `${err.message}\n${err.stack}` };
    }
  }, fx);
  report('suppress attack usage cards (on → none created)', r.ok && r.suppressedDelta === 0,
    r.ok ? `cards created: ${r.suppressedDelta}` : r.why);
  report('suppression off → native card returns', r.ok && r.restoredDelta === 1,
    r.ok ? `cards created: ${r.restoredDelta}` : r.why);
  if (r.effectCard?.spell) {
    report('an attack card carrying effects survives suppression', r.effectCard.cardSurvived === true,
      `${r.effectCard.spell}: card survived = ${r.effectCard.cardSurvived}`);
  } else {
    console.log(`  SKIP rider-card path not exercised — ${r.effectCard?.why ?? 'unavailable'}`);
  }
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
    await game.settings.set(MOD, 'suppressAttackCards', prior?.suppressAttackCards ?? false);
    await game.settings.set(MOD, 'requireTarget', prior?.requireTarget ?? false);
    await game.settings.set(MOD, 'reactionHold', prior?.reactionHold ?? false);
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
