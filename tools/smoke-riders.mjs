// Battle Flow Phase 1.75 smoke test — hit riders, driven in the live world through the bridge.
//
// What this has to prove is narrow and load-bearing: a mark pays out ONLY for the creature that
// placed it, only when the table lists it, and for exactly what its own content says. Every
// assertion below is a way of getting that wrong.
//
// Damage rolls use create:false throughout, so nothing reaches the chat log and no HP moves.
// Fixtures are LINKED tokens created here and deleted on the way out — an unlinked token's
// synthetic actor has a different uuid from its base actor, which is precisely the distinction
// the ownership test turns on, so leaving that ambiguous would make a passing suite meaningless.
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

setTimeout(() => { console.error('[riders] WATCHDOG: 300s — hard abort'); process.exit(3); }, 300_000);

const f = new Foundry(foundryConfig(env));
console.log('[riders] connecting…');
await f.connect();
await preflightSoleGM(f);
console.log('[riders] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  for (const key of ['riders', 'riderList', 'riderUpgrades']) {
    if (!game.settings.settings.has(`${MOD}.${key}`)) {
      return { fatal: `setting ${key} not registered — this client is running OLD code (F5)` };
    }
  }

  const prior = {
    riders: game.settings.get(MOD, 'riders'),
    riderList: game.settings.get(MOD, 'riderList'),
    riderUpgrades: game.settings.get(MOD, 'riderUpgrades'),
  };

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const victim = game.actors.getName('BF Test Victim');
  const bystander = game.actors.getName('BF Test Shielder'); // stands in as a SECOND marker
  if (!scene || !attacker || !victim || !bystander) {
    return { fatal: 'missing fixture: scene "Battle Flow Test Range" or a BF Test actor' };
  }

  const created = { items: [], effects: [], tokens: [] };
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    // ⚠ A synthetic actor rebuilds its embedded collections from the delta on every write, so
    // deletions go out as ONE call per collection, never one document at a time.
    for (const [actorId, ids] of Object.entries(created.effects.reduce((m, e) => {
      (m[e.actorId] ??= []).push(e.id); return m;
    }, {}))) {
      const a = game.actors.get(actorId);
      const live = ids.filter(id => a?.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live);
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
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
    for (const [k, v] of Object.entries(prior)) await game.settings.set(MOD, k, v);
  };

  try {
    await game.settings.set(MOD, 'riders', true);
    await game.settings.set(MOD, 'riderList', 'hunters-mark, hex, great-old-one-hex');
    await game.settings.set(MOD, 'riderUpgrades', 'foe-slayer:hunters-mark');

    // ---- fixtures: Hunter's Mark on the attacker, and on the bystander for the ownership test
    // ⚠ An identifier is NOT unique across rule versions. `dnd5e.spells` (2014) ships a
    // Hunter's Mark with identifier "hunters-mark" and NO bonus-damage activity — the separate
    // "Bonus Mark Damage" press is a 2024 modelling. Picking the first identifier match found
    // the 2014 item, riderParts correctly read nothing off it, and every positive assertion
    // failed while every negative passed vacuously. Select on the rider SHAPE, so the fixture
    // can only ever be an item that is actually capable of riding.
    const hasRiderActivity = doc => [...(doc.system?.activities ?? [])].some(a =>
      (a.type === 'damage') && a.activation?.override && !a.activation?.type
      && (a.damage?.parts?.length));
    const findInPacks = async identifier => {
      for (const pack of game.packs) {
        if (pack.documentName !== 'Item') continue;
        if (pack.metadata.id.startsWith('JB2A')) continue;
        let index;
        try { index = await pack.getIndex({ fields: ['system.identifier'] }); } catch { continue; }
        for (const entry of index.filter(e => e.system?.identifier === identifier)) {
          const doc = await pack.getDocument(entry._id);
          if (hasRiderActivity(doc)) return doc;
        }
      }
      return null;
    };
    const grant = async (actor, identifier) => {
      const existing = actor.items.find(i => i.system?.identifier === identifier);
      if (existing) return existing;
      const doc = await findInPacks(identifier);
      if (!doc) return null;
      const [made] = await actor.createEmbeddedDocuments('Item', [doc.toObject()]);
      created.items.push({ actorId: actor.id, id: made.id });
      return made;
    };

    const hmAttacker = await grant(attacker, 'hunters-mark');
    const hmBystander = await grant(bystander, 'hunters-mark');
    if (!hmAttacker || !hmBystander) return { fatal: 'hunters-mark not found in any compendium' };
    log.push(`attacker mark item: ${hmAttacker.name}`);

    const markerTemplate = hmAttacker.effects.find(e => e.name === "Hunter's Mark")
      ?? hmAttacker.effects.contents[0];
    if (!markerTemplate) return { fatal: "Hunter's Mark ships no marker effect" };

    const weapon = attacker.items.find(i => i.system?.activities?.some?.(a => a.type === 'attack'));
    const activity = () => attacker.items.get(weapon.id).system.activities.find(a => a.type === 'attack');
    if (!weapon) return { fatal: 'BF Test Attacker has no attack activity' };
    log.push(`weapon: ${weapon.name}`);

    // ---- LINKED tokens, so token.actor IS the base actor and the uuid test is unambiguous
    if (canvas.scene?.id !== scene.id) await scene.view();
    const tokenFor = async actor => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(
        actor.prototypeToken.toObject(),
        { x: 1200 + (created.tokens.length * 200), y: 1600, actorId: actor.id, actorLink: true },
        { inplace: false })]);
      created.tokens.push(doc.id);
      return doc;
    };
    const victimTokenDoc = await tokenFor(victim);
    await sleep(400);
    const victimToken = canvas.tokens.get(victimTokenDoc.id);
    if (!victimToken) return { fatal: 'victim token never reached the canvas' };

    // ---- helpers
    const putMark = async originUuid => {
      const [made] = await victim.createEmbeddedDocuments('ActiveEffect', [{
        ...markerTemplate.toObject(), disabled: false, transfer: false, origin: originUuid
      }]);
      created.effects.push({ actorId: victim.id, id: made.id });
      return made;
    };
    const clearMarks = async () => {
      const mine = created.effects.filter(e => e.actorId === victim.id && victim.effects.get(e.id));
      if (mine.length) await victim.deleteEmbeddedDocuments('ActiveEffect', mine.map(e => e.id));
      created.effects = created.effects.filter(e => !mine.includes(e));
    };
    const rollAt = async (isCritical = false) => {
      victimToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      const rolls = await activity().rollDamage({ isCritical }, { configure: false }, { create: false });
      return (rolls ?? []).map(r => ({ formula: r.formula, type: r.options?.type ?? null }));
    };
    const forceParts = rolls => rolls.filter(r => r.type === 'force');

    // The origin shape observed on a REAL mark in this world: the source item's own effect.
    const itemOrigin = `${hmAttacker.uuid}.ActiveEffect.${markerTemplate.id}`;

    // ---------------------------------------------------------------- 1. the rider rides
    await putMark(itemOrigin);
    let rolls = await rollAt();
    ok('1. marked target gets the rider', forceParts(rolls).length === 1
      && forceParts(rolls)[0].formula === '1d6', JSON.stringify(rolls));

    // ---------------------------------------------------------------- 2. crit doubles it
    rolls = await rollAt(true);
    ok('2. crit doubles the rider (no code does this)', forceParts(rolls)[0]?.formula === '2d6',
      JSON.stringify(rolls));

    // ---------------------------------------------------------------- 3. the list gates it
    await game.settings.set(MOD, 'riderList', 'hex');
    rolls = await rollAt();
    ok('3. a mark the table does not list pays nothing', forceParts(rolls).length === 0,
      JSON.stringify(rolls));
    await game.settings.set(MOD, 'riderList', 'hunters-mark, hex, great-old-one-hex');

    // ---------------------------------------------------------------- 4. the toggle gates it
    await game.settings.set(MOD, 'riders', false);
    rolls = await rollAt();
    ok('4. feature off pays nothing', forceParts(rolls).length === 0, JSON.stringify(rolls));
    await game.settings.set(MOD, 'riders', true);

    // ---------------------------------------------------------------- 5. SOMEONE ELSE'S mark
    // The property the whole feature turns on. Two rangers can mark one creature; each may add
    // only their own die. A test that only ever checks "is there a mark" passes this by luck.
    await clearMarks();
    await putMark(`${hmBystander.uuid}.ActiveEffect.${markerTemplate.id}`);
    rolls = await rollAt();
    ok("5. another creature's mark pays this attacker nothing", forceParts(rolls).length === 0,
      JSON.stringify(rolls));

    // ---------------------------------------------------------------- 6. no mark at all
    await clearMarks();
    rolls = await rollAt();
    ok('6. an unmarked target pays nothing', forceParts(rolls).length === 0, JSON.stringify(rolls));

    // ---------------------------------------------------------------- 7. concentration origin
    // The tray writes `origin = concentration ?? effect`, so the OTHER shape must work too —
    // this is the branch a live mark did NOT take, which is exactly why it needs a test.
    const [conc] = await attacker.createEmbeddedDocuments('ActiveEffect', [
      dnd5e.documents.ActiveEffect5e.createConcentrationEffectData(
        hmAttacker.system.activities.contents.find(a => a.type === 'utility') ?? activity())
    ]);
    created.effects.push({ actorId: attacker.id, id: conc.id });
    await putMark(conc.uuid);
    rolls = await rollAt();
    ok('7. a concentration-shaped origin works too', forceParts(rolls)[0]?.formula === '1d6',
      JSON.stringify(rolls));

    // ---------------------------------------------------------------- 8. Foe Slayer REPLACES
    await clearMarks();
    await putMark(itemOrigin);
    const foe = await grant(attacker, 'foe-slayer');
    if (!foe) {
      ok('8. foe-slayer upgrade', false, 'foe-slayer not found in any compendium');
    } else {
      rolls = await rollAt();
      const force = forceParts(rolls);
      // Replaces, never stacks: exactly ONE force part, and it is the d10.
      ok('8. Foe Slayer replaces the die (d10, and only one)',
        (force.length === 1) && (force[0].formula === '1d10'), JSON.stringify(rolls));
    }

    return { log, results };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}` };
  } finally {
    await teardown();
    // Fixtures spend real resources; the suites put them back (HANDOFF).
    for (const a of [attacker, victim, bystander]) { try { await a.longRest?.({ dialog: false, chat: false }); } catch { /* fine */ } }
  }
}, null);

if (out.fatal) { console.error(`\n[riders] FATAL: ${out.fatal}`); process.exit(2); }
for (const l of out.log) console.log(`  ${l}`);
console.log('');
let failures = 0;
for (const r of out.results) {
  if (!r.pass) failures++;
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.pass ? '' : ` — ${r.detail}`}`);
}
console.log(`\n[riders] ${out.results.length - failures}/${out.results.length} passed`);
process.exit(failures ? 1 : 0);
