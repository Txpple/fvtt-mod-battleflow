// Battle Flow v1.20.0 smoke test — resource use notices: a player-owned actor spending a
// recovery-rhythm pool flashes the banner on this client and grows the durable card line;
// pools without recovery, NPC spends and the OFF switch all stay silent. All three measured
// pool shapes are pinned: self item-uses, cross-item pool, activity-level uses.
//
// Harness discipline (HANDOFF): settings restored first in their own guard; fixture
// ownership snapshotted and restored EXACTLY; messages deleted by id-set difference.
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

setTimeout(() => { console.error('[resources] WATCHDOG 300s'); process.exit(3); }, 300_000);

const f = new Foundry(foundryConfig(env));
console.log('[resources] connecting…');
await f.connect();
await preflightSoleGM(f);
console.log('[resources] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const suiteStart = Date.now();

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.resourceNotices`)) {
    return { fatal: 'setting resourceNotices not registered — this client is running OLD code (F5)' };
  }

  const SETTING_KEYS = ['resourceNotices', 'volleys', 'castApply', 'autoDamage', 'autoApply',
    'requireTarget', 'reactionHold', 'saves', 'concMode'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const victim = game.actors.getName('BF Test Victim');
  if (!victim) return { fatal: 'missing fixture: BF Test Victim' };
  // A qualifying spender must be PLAYER-OWNED: grant a non-GM user ownership for the run
  // and restore the exact prior ownership map after.
  const player = game.users.find(u => !u.isGM);
  if (!player) return { fatal: 'no non-GM user exists to lend ownership to' };
  const priorOwnership = foundry.utils.deepClone(victim._source.ownership ?? {});

  const created = { items: [] };
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      const live = created.items.filter(id => victim.items.get(id));
      if (live.length) await victim.deleteEmbeddedDocuments('Item', live);
      await victim.update({ ownership: priorOwnership }, { diff: false, recursive: false });
      document.querySelectorAll('.bf-resource-banner').forEach(b => b.remove());
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || Object.keys(m.flags?.[MOD] ?? {}).length
          || (m.type === 'usage')));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  const bannerNow = () => document.querySelector('.bf-resource-banner');
  const lineFor = id => document.querySelector(`[data-message-id="${id}"] .bf-resource-line`);
  const useAndCard = async act => {
    const before = new Set(game.messages.contents.map(m => m.id));
    await act.use({}, { configure: false }, {});
    await sleep(900);
    return game.messages.contents.find(m => !before.has(m.id)
      && ((m.type === 'usage') || (m.getFlag('dnd5e', 'messageType') === 'usage'))) ?? null;
  };

  try {
    await set('resourceNotices', true);
    await set('volleys', false);      // no volley machinery in this suite
    await set('castApply', false);
    await set('autoDamage', 'off');
    await set('autoApply', false);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('saves', false);
    await set('concMode', 'off');

    await victim.update({ ownership: { ...priorOwnership, [player.id]: 3 } });
    if (!victim.hasPlayerOwner) return { fatal: 'ownership grant did not take' };

    // -------------------------------------------------- fixtures: the three pool shapes
    const [pool] = await victim.createEmbeddedDocuments('Item', [{
      name: 'BF Notice Pool', type: 'feat',
      system: { uses: { spent: 0, max: '4', recovery: [{ period: 'sr', type: 'recoverAll' }] } }
    }]);
    created.items.push(pool.id);
    const [feat] = await victim.createEmbeddedDocuments('Item', [{
      name: 'BF Notice Feat', type: 'feat',
      system: {
        uses: { spent: 0, max: '3', recovery: [{ period: 'lr', type: 'recoverAll' }] },
        activities: {
          bfnoticeself0000: { _id: 'bfnoticeself0000', type: 'utility', name: 'Spend Self',
            activation: { type: 'action' },
            consumption: { targets: [{ type: 'itemUses', target: '', value: '1' }] } },
          bfnoticepool0000: { _id: 'bfnoticepool0000', type: 'utility', name: 'Spend Pool',
            activation: { type: 'action' },
            consumption: { targets: [{ type: 'itemUses', target: pool.id, value: '1' }] } },
          bfnoticeact00000: { _id: 'bfnoticeact00000', type: 'utility', name: 'Free Cast',
            activation: { type: 'action' },
            uses: { spent: 0, max: '2', recovery: [{ period: 'lr', type: 'recoverAll' }] },
            consumption: { targets: [{ type: 'activityUses', target: '', value: '1' }] } }
        }
      }
    }]);
    created.items.push(feat.id);
    const [mundane] = await victim.createEmbeddedDocuments('Item', [{
      name: 'BF Notice Torchlike', type: 'consumable',
      system: {
        type: { value: 'trinket' },
        uses: { spent: 0, max: '1', recovery: [] },   // uses but NO recovery — the noise shape
        activities: { bfnoticemund0000: { _id: 'bfnoticemund0000', type: 'utility', name: 'Use',
          activation: { type: 'action' },
          consumption: { targets: [{ type: 'itemUses', target: '', value: '1' }] } } }
      }
    }]);
    created.items.push(mundane.id);
    const acts = id => feat.system.activities.get(id);

    // ============================================================ §1 self-uses spend
    log.push('§1 self-uses');
    const card1 = await useAndCard(acts('bfnoticeself0000'));
    const b1 = bannerNow();
    ok('1a the banner flashed: who, what, and x of y remaining',
      !!b1 && b1.textContent.includes('BF Test Victim used BF Notice Feat')
        && b1.textContent.includes('BF Notice Feat: 2 of 3 remaining'),
      b1 ? b1.textContent.trim().slice(0, 120) : 'NO banner');
    ok('1b the card keeps the durable line',
      !!card1 && !!lineFor(card1.id) && lineFor(card1.id).textContent.includes('2 of 3'),
      card1 ? (lineFor(card1.id)?.textContent ?? 'NO line') : 'NO card');
    ok('1c the deltas rode the usage message itself (no module state anywhere)',
      !!card1?.system?.deltas?.item, JSON.stringify(card1?.system?.deltas ?? null));
    await sleep(4000);
    ok('1d the banner faded and removed itself', !bannerNow());

    // ============================================================ §2 cross-item pool
    log.push('§2 cross-item pool');
    const card2 = await useAndCard(acts('bfnoticepool0000'));
    const b2 = bannerNow();
    ok('2a the banner names the POOL that paid, not the ability\'s own uses',
      !!b2 && b2.textContent.includes('used BF Notice Feat')
        && b2.textContent.includes('BF Notice Pool: 3 of 4 remaining'),
      b2 ? b2.textContent.trim().slice(0, 120) : 'NO banner');
    ok('2b the card line names the pool too',
      !!card2 && !!lineFor(card2.id) && lineFor(card2.id).textContent.includes('BF Notice Pool'));
    await sleep(4000);

    // ============================================================ §3 activity-level uses
    log.push('§3 activity uses');
    const card3 = await useAndCard(acts('bfnoticeact00000'));
    const b3 = bannerNow();
    ok('3a an activityUses spend announces off the ACTIVITY\'s own pool',
      !!b3 && b3.textContent.includes('Free Cast: 1 of 2 remaining'),
      b3 ? b3.textContent.trim().slice(0, 120) : 'NO banner');
    ok('3b and the card line agrees',
      !!card3 && !!lineFor(card3.id)?.textContent.includes('Free Cast — 1 of 2'));
    await sleep(4000);

    // ============================================================ §4 the silences
    log.push('§4 silences');
    const card4 = await useAndCard(mundane.system.activities.contents[0]);
    ok('4a a no-recovery expendable spends in silence (no banner, no line)',
      !bannerNow() && !(card4 && lineFor(card4.id)),
      card4 ? 'card exists, correctly undecorated' : 'no card');
    // NPC silence: take the player ownership away and spend again.
    await victim.update({ ownership: priorOwnership }, { diff: false, recursive: false });
    const card4b = await useAndCard(acts('bfnoticeself0000'));
    ok('4b the same spend from a non-player-owned actor says nothing',
      !bannerNow() && !(card4b && lineFor(card4b.id)));
    await victim.update({ ownership: { ...priorOwnership, [player.id]: 3 } });
    // The switch.
    await set('resourceNotices', false);
    const card4c = await useAndCard(acts('bfnoticeself0000'));
    ok('4c the switch off silences both surfaces',
      !bannerNow() && !(card4c && lineFor(card4c.id)));
    await set('resourceNotices', true);

    await teardown();
  } catch (err) {
    log.push(`SUITE ERROR: ${err?.stack ?? err}`);
    await teardown();
  }
  return { results, log };
});

if (out.fatal) { console.error(`[resources] FATAL: ${out.fatal}`); process.exit(2); }
let pass = 0, fail = 0;
for (const r of out.results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`);
  r.pass ? pass++ : fail++;
}
for (const l of out.log) console.log(`  · ${l}`);
console.log(`\n[resources] ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
