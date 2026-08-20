// P3 — READ-ONLY probe: driving a REAL attack programmatically (Pass A step 0).
//
// The Riposte fold must make the reactor genuinely ATTACK — a module-driven attack roll whose
// message carries a real targets snapshot, flows the normal rollAttackV2 chain, and can carry
// module provenance. Questions:
//
//   1  Is `game.user.updateTokenTargets([...])` the channel that fills `flags.dnd5e.targets`
//      on the attack message (config carries no target field)?
//   2  Does the driven attack fire `dnd5e.rollAttackV2` on the driving client?
//   3  Do module flags passed in message data survive onto the created attack message —
//      and does the FLAT dotted key style work here like it does for damage?
//   4  Where does melee-vs-ranged live — activity.attack.type.{value,classification},
//      item.system.type.value, range? (zero in-tree precedent; the fold's gate reads this)
//
// ⚠ Run `smoke-battleflow` FIRST — rides the BF Test fixtures.
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
setTimeout(() => { console.error('[drive] WATCHDOG 300s'); process.exit(3); }, 300_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
const who = await preflightSoleGM(f);
console.log(`[drive] connected as "${who.self}"; elect = ${who.elect}`);

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [];
  const attacker = game.actors.getName('BF Test Attacker');
  const victim = game.actors.getName('BF Test Victim');
  if (!attacker || !victim) return { fatal: 'BF Test fixtures missing — run smoke-battleflow first' };

  const scene = game.scenes.getName('Battle Flow Test Range') ?? canvas.scene;
  if (scene && (canvas.scene?.id !== scene.id)) { await scene.view(); await sleep(1200); }
  const vTok = canvas.tokens.placeables.find(t => t.actor?.id === victim.id);
  if (!vTok) return { fatal: 'BF Test Victim has no token — re-run smoke-battleflow' };

  const prior = {
    autoDamage: game.settings.get(MOD, 'autoDamage'),
    autoApply: game.settings.get(MOD, 'autoApply'),
    reactionHold: game.settings.get(MOD, 'reactionHold')
  };
  await game.settings.set(MOD, 'autoDamage', 'off');   // the ATTACK is under test, not the chain
  await game.settings.set(MOD, 'autoApply', false);
  await game.settings.set(MOD, 'reactionHold', false);

  const meleeAct = attacker.items.contents
    .flatMap(i => i.system.activities?.contents ?? [])
    .find(a => (a.type === 'attack') && (a.item?.type === 'weapon'));
  if (!meleeAct) return { fatal: 'no weapon attack activity on the fixture' };

  const created = [];
  const results = [];

  /* 4 — where melee/ranged lives, for the fixture weapon + an imported bow. -------------- */
  const dumpAttackShape = a => ({
    item: a.item?.name,
    attackType: a.attack?.type ? { value: a.attack.type.value ?? null, classification: a.attack.type.classification ?? null } : null,
    itemSubtype: a.item?.system.type?.value ?? null,
    range: a.item?.system.range ? { value: a.item.system.range.value ?? null, long: a.item.system.range.long ?? null, reach: a.item.system.range.reach ?? null } : null,
    properties: [...(a.item?.system.properties ?? [])]
  });
  const shapes = [dumpAttackShape(meleeAct)];
  let bow = null;
  {
    const importByName = async name => {
      for (const p of game.packs.filter(p => p.documentName === 'Item')) {
        const e = p.index.find(i => i.name === name);
        if (e) { const d = await p.getDocument(e._id); return d.toObject(); }
      }
      return null;
    };
    const bowSrc = await importByName('Shortbow');
    if (bowSrc) {
      [bow] = await attacker.createEmbeddedDocuments('Item', [
        { ...bowSrc, name: 'BF Probe Bow', system: { ...bowSrc.system, equipped: true } }
      ]);
      const bowAct = bow.system.activities?.contents?.find(a => a.type === 'attack');
      if (bowAct) shapes.push(dumpAttackShape(bowAct));
    }
  }
  log.push(...shapes.map(s => `attack shape: ${JSON.stringify(s)}`));
  results.push({ n: 4, name: 'melee vs ranged distinguishable on the activity (recorded)',
    pass: shapes.length >= 2 && JSON.stringify(shapes[0].attackType) !== JSON.stringify(shapes[1].attackType),
    detail: `melee=${JSON.stringify(shapes[0].attackType)} ranged=${JSON.stringify(shapes[1]?.attackType)}` });

  /* 1+2+3 — drive an attack with targeting + provenance + a hook counter. ---------------- */
  let hookFired = 0;
  const hid = Hooks.on('dnd5e.rollAttackV2', () => { hookFired++; });

  // Clear targets, then target via setTarget — the in-repo targeting idiom (v14 dropped
  // game.user.updateTokenTargets; every suite targets through the placeable).
  game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
  await sleep(150);
  vTok.setTarget(true, { releaseOthers: true });
  await sleep(250);

  const before = game.messages.size;
  const use = await meleeAct.use({ subsequentActions: false }, { configure: false }, {});
  const usageId = use?.message?.id ?? null;
  const rolls = await meleeAct.rollAttack({}, { configure: false }, {
    data: {
      'flags.dnd5e.originatingMessage': usageId ?? 'bf-probe-drive',
      [`flags.${MOD}.riposteFor`]: 'bf-probe-source',
      [`flags.${MOD}.riposteBy`]: attacker.uuid
    }
  });
  await sleep(300);
  const fresh = game.messages.contents.slice(before);
  created.push(...fresh.map(m => m.id));
  const attackMsg = fresh.find(m => m.getFlag('dnd5e', 'roll.type') === 'attack')
    ?? rolls?.[0]?.parent ?? null;

  // ⚠ The Test Range tokens are UNLINKED, so the descriptor uuid is the TOKEN ACTOR's
  // (Scene…Token…Actor.…), never the sidebar actor's — the documented synthetic-actor trap.
  // Assert against the token actor, which is what anything scene-scoped operates on.
  const snapshot = attackMsg?.getFlag('dnd5e', 'targets') ?? [];
  results.push({ n: 1, name: 'setTarget-before-roll fills the attack message snapshot',
    pass: (snapshot.length === 1) && (snapshot[0].uuid === vTok.actor.uuid),
    detail: `snapshot=${JSON.stringify(snapshot.map(t => ({ name: t.name, uuid: t.uuid, ac: t.ac })))}` });
  results.push({ n: 2, name: 'the driven attack fires dnd5e.rollAttackV2 locally',
    pass: hookFired >= 1, detail: `hookFired=${hookFired}` });
  results.push({ n: 3, name: 'module flags in FLAT message data survive onto the attack message',
    pass: (attackMsg?.getFlag(MOD, 'riposteFor') === 'bf-probe-source')
       && (attackMsg?.getFlag(MOD, 'riposteBy') === attacker.uuid),
    detail: `riposteFor=${JSON.stringify(attackMsg?.getFlag(MOD, 'riposteFor'))}`
          + ` riposteBy=${JSON.stringify(attackMsg?.getFlag(MOD, 'riposteBy'))}` });

  /* teardown ----------------------------------------------------------------------------- */
  Hooks.off('dnd5e.rollAttackV2', hid);
  game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
  if (bow) await attacker.deleteEmbeddedDocuments('Item', [bow.id]).catch(() => {});
  await ChatMessage.deleteDocuments([...new Set(created)].filter(id => game.messages.has(id)))
    .catch(() => {});
  for (const [k, v] of Object.entries(prior)) await game.settings.set(MOD, k, v);
  return { log, results };
});

if (out.fatal) { console.error('[drive] FATAL:', out.fatal); process.exit(2); }
for (const l of out.log) console.log(`  · ${l}`);
let bad = 0;
for (const r of out.results.sort((a, b) => a.n - b.n)) {
  if (!r.pass) bad++;
  console.log(`\n  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}. ${r.name}\n        ${r.detail}`);
}
console.log(bad ? `\n[drive] ${bad} of ${out.results.length} WRONG` : `\n[drive] the drive channel is measured`);
process.exit(bad ? 1 : 0);
