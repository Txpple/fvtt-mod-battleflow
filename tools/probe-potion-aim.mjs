// FLOW item 4 (re-shaped): does a potion need a module rule to self-aim, and where would it hook?
//
// Two questions, one connection:
//   Q1 (pure read) — what does a consumable's activity actually carry for `target.affects.type`?
//       Blank/creature => the cast slice deliberately stays out (polish.js: "BLANK affects stays
//       out ... the cast slice must not guess"), so a consumable rule cannot key on affects.
//       "self" => v1.11.0's existing self-aim already fires and the chest sighting is a real bug.
//   Q2 (drives one use on a TEST FIXTURE) — does a target set inside `dnd5e.preUseActivity`
//       reach the usage card's `flags.dnd5e.targets` snapshot? That is the load-bearing
//       assumption behind "fill the empty case in preUseActivity and change nothing else".
//
// ⚠ Q2 uses BF Test fixtures only — nothing in the live party moves. Read-only otherwise.
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
setTimeout(() => { console.error('[potion] WATCHDOG 240s'); process.exit(3); }, 240_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[potion] connected');

const out = await f.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rep = { who: {}, consumables: [], q2: null };

  rep.who = {
    self: game.user.name,
    elect: game.users.activeGM?.name ?? null,
    gms: game.users.filter(u => u.active && u.isGM).map(u => u.name),
    actives: game.users.filter(u => u.active).map(u => `${u.name}${u.isGM ? ' (GM)' : ''}`)
  };

  // ---- Q1: every consumable in the world, and what its activities aim at
  for (const actor of game.actors) {
    for (const item of actor.items) {
      if (item.type !== 'consumable') continue;
      for (const a of (item.system.activities?.contents ?? [])) {
        rep.consumables.push({
          actor: actor.name, item: item.name,
          subtype: item.system.type?.value ?? null,
          activity: a.name ?? a.type, type: a.type,
          affects: a.target?.affects?.type ?? '',        // '' means BLANK
          count: a.target?.affects?.count ?? null,
          template: a.target?.template?.type ?? '',
          hasEffects: !!(a.effects?.length),
          healing: a.type === 'heal' ? (a.healing?.formula ?? null) : null
        });
      }
    }
  }

  // ---- Q2: can preUseActivity fill the snapshot?
  // Pick a drinker that ALREADY has a token on whatever scene is active — the probe must never
  // move the view or place a token in the user's window. Practice Dummy / BF Test fixtures only:
  // this drives a real use, so it must not land on a live PC.
  const SAFE = /^(Practice Dummy|BF Test)/;
  const drinkerToken = canvas.tokens.placeables.find(t => t.actor && SAFE.test(t.actor.name));
  const drinker = drinkerToken?.actor ?? null;
  // A TEMPORARY fixture potion, shaped like the real thing Q1 found: consumable/potion,
  // one `heal` activity, affects.type "creature", no template. Deleted in the finally.
  let temp = null;
  rep.q2scene = { scene: canvas.scene?.name, drinker: drinker?.name ?? null };
  if (drinker) {
    [temp] = await drinker.createEmbeddedDocuments('Item', [{
      name: 'BF Probe Potion', type: 'consumable', img: 'icons/consumables/potions/bottle-round-corked-red.webp',
      system: {
        type: { value: 'potion' }, quantity: 5,
        uses: { spent: 0, max: '', autoDestroy: false },
        activities: { bfprobepotion000: {
          _id: 'bfprobepotion000', type: 'heal', name: 'Drink',
          target: { affects: { type: 'creature', count: '1' }, template: { type: '' } },
          healing: { custom: { enabled: false }, number: 2, denomination: 4, bonus: '2', types: ['healing'] }
        } }
      }
    }]);
  }
  const potion = temp;
  if (!drinker) rep.q2 = { skipped: `no safe drinker with a token on "${canvas.scene?.name}"` };
  else if (!potion) rep.q2 = { skipped: 'could not create the probe potion' };
  else {
    const act = potion.system.activities.contents[0];
    const token = drinkerToken;
    if (!token) rep.q2 = { skipped: `${drinker.name} has no token on the active scene` };
    else {
      // Clear targets, then install the CANDIDATE RULE as a temporary hook and use the item.
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      await sleep(200);
      let hookFired = false, sizeAtHook = null;
      const id = Hooks.on('dnd5e.preUseActivity', activity => {
        if (activity?.item?.type !== 'consumable') return;
        sizeAtHook = game.user.targets.size;
        if (game.user.targets.size) return;      // rule 2: a real target wins
        const own = canvas.tokens.placeables.find(t => t.actor?.id === activity.actor?.id);
        if (own) { own.setTarget(true, { releaseOthers: true }); hookFired = true; }
      });
      const before = game.messages.size;
      let usedErr = null;
      try { await act.use({}, { configure: false }, {}); }
      catch (e) { usedErr = String(e?.message ?? e); }
      await sleep(1200);
      Hooks.off('dnd5e.preUseActivity', id);

      const fresh = game.messages.contents.slice(before);
      const card = fresh.find(m => m.getFlag('dnd5e', 'item')?.id === potion.id
        || m.getFlag('dnd5e', 'activity')?.uuid === act.uuid) ?? fresh[0] ?? null;
      rep.q2 = {
        drinker: drinker.name, potion: potion.name, activityType: act.type,
        affects: act.target?.affects?.type ?? '',
        hookFired, targetsSeenByHook: sizeAtHook, usedErr,
        newMessages: fresh.length,
        cardFound: !!card,
        snapshot: (card?.getFlag('dnd5e', 'targets') ?? []).map(t => t.name ?? t.uuid),
        targetsAfter: [...game.user.targets].map(t => t.document.name)
      };
      // clean up: delete what this probe posted, drop targets
      await ChatMessage.deleteDocuments(fresh.map(m => m.id)).catch(() => {});
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
    }
  }
  if (temp) await temp.delete().catch(() => {});
  return rep;
});

console.log('\n[potion] connected clients:', JSON.stringify(out.who.actives));
console.log('[potion] elect:', out.who.elect, '| this client:', out.who.self);
if (out.who.gms.length > 1) console.log(`[potion] ⚠ ${out.who.gms.length} GM-capable clients (${out.who.gms.join(', ')}) — Q1 is unaffected; Q2 ran on a test fixture.`);

console.log(`\n=== Q1 — consumables in the world (${out.consumables.length} activities) ===`);
const byAffects = {};
for (const c of out.consumables) {
  const k = c.affects === '' ? '(BLANK)' : c.affects;
  (byAffects[k] ??= []).push(c);
}
for (const [k, list] of Object.entries(byAffects)) {
  console.log(`\n  affects.type = ${k}   (${list.length})`);
  for (const c of list.slice(0, 14))
    console.log(`    ${c.actor} / ${c.item} [${c.subtype}] — activity ${c.type}`
      + `${c.healing ? ` heal ${c.healing}` : ''}${c.hasEffects ? ' +effects' : ''}`
      + `${c.template ? ` template ${c.template}` : ''}`);
  if (list.length > 14) console.log(`    … ${list.length - 14} more`);
}

console.log('\n=== Q2 — does a preUseActivity target reach the card snapshot? ===');
console.log(JSON.stringify(out.q2, null, 2));
process.exit(0);
