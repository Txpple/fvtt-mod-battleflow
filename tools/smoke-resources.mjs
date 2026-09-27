// Battle Flow smoke test: resource use notices. A player-owned actor spending a recovery-rhythm
// pool flashes the banner and grows the durable card line; pools without recovery, NPC spends and
// the OFF switch stay silent. The three pool shapes: self item-uses, cross-item pool,
// activity-level uses. An ability with its own dice flashes AFTER them (released by card link,
// 12s fallback); the card line never waits.
// Harness discipline: settings restored first in their own guard; ownership restored exactly;
// messages deleted by id-set difference. Sections: `--section 3`, `--section 5,6`, `--list`.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs parses this; `npm run coverage` checks it both ways).
// ⚠ NEVER import a suite: it connects on evaluation.
export const COVERS = [
  'resources.js',           // the notices — the flash, the card line, the silences
  'stats.js'                // §7 — the data-plane spend stamp
];

const SECTIONS = {
  1: 'self-uses spend',
  2: 'cross-item pool',
  3: 'activity-level uses',
  4: 'the silences',
  5: '(cc) the flash waits for the dice',
  6: '(cc) the fallback timer',
  7: 'the data-plane spend stamp (the party-stats commission)'
};
// §6 asserts "1 of 3 remaining" on the heal feat §5 creates and spends once.
const DEPENDS = { 6: ['5'] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'resources', watchdogMs: 300_000 });
announcePlan('resources', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Wait for the thing, not the clock (ARCHITECTURE §11 *Adding a TEST* rule 3).
  const until = async (fn, ms = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(150); }
    return fn();
  };
  // The section gate (tools/harness.mjs): the plan arrives as DATA in this serialized closure.
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const suiteStart = Date.now();

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.resourceNotices`)) {
    return { fatal: 'setting resourceNotices not registered — this client is running OLD code (F5)' };
  }

  const SETTING_KEYS = ['resourceNotices', 'volleys', 'castApply', 'autoDamage', 'autoApply',
    'requireTarget', 'reactionHold', 'saves', 'concMode', 'hideCardButtons'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const victim = game.actors.getName('BF Test Victim');
  if (!victim) return { fatal: 'missing fixture: BF Test Victim' };
  // A card's associated actor is its TOKEN's actor first: an unlinked victim speaks as its synthetic actor.
  const speaker = () => game.scenes.active?.tokens.find(t => t.actorId === victim.id)?.actor ?? victim;
  // A qualifying spender is PLAYER-OWNED: grant a non-GM user ownership, restore the exact map after.
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
      document.querySelectorAll('.bf-resource-banner').forEach(b => { b.remove(); });
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
  // ⚠ Wait for every surface the next assertion reads: the usage card, the transient banner
  // (immediate) and the durable card line (a later render decoration). A caller asserting
  // SILENCE cannot wait, so it keeps a short settle.
  const useAndCard = async (act, { banner = true, line = banner } = {}) => {
    const before = new Set(game.messages.contents.map(m => m.id));
    const isUsage = m => (m.type === 'usage');
    const fresh = () => game.messages.contents.find(m => !before.has(m.id) && isUsage(m)) ?? null;
    await act.use({}, { configure: false }, {});
    const card = await until(fresh, 6000);
    if (banner || line) {
      await until(() => (!banner || bannerNow()) && (!line || !card || lineFor(card.id)), 6000);
    } else {
      await sleep(600);
    }
    return card;
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
    // Shared by §5 and §6 (§6 spends it a second time), so declared out here.
    let healFeat;

    // ============================================================ §1 self-uses spend
    if (want(1)) {
      log.push('§1 self-uses');
      const card1 = await useAndCard(acts('bfnoticeself0000'));
      const b1 = bannerNow();
      ok('1a the banner flashed: who, what, and x of y remaining',
        !!b1 && b1.textContent.includes(`${speaker().name} used BF Notice Feat`)
          && b1.textContent.includes('BF Notice Feat: 2 of 3 remaining'),
        b1 ? b1.textContent.trim().slice(0, 120) : 'NO banner');
      ok('1b the card keeps the durable line',
        !!card1 && !!lineFor(card1.id) && lineFor(card1.id).textContent.includes('2 of 3'),
        card1 ? (lineFor(card1.id)?.textContent ?? 'NO line') : 'NO card');
      ok('1c the deltas rode the usage message itself (no module state anywhere)',
        !!card1?.system?.deltas?.item, JSON.stringify(card1?.system?.deltas ?? null));
      await until(() => !bannerNow(), 6000);
      ok('1d the banner faded and removed itself', !bannerNow());
    }

    // ============================================================ §2 cross-item pool
    if (want(2)) {
      log.push('§2 cross-item pool');
      const card2 = await useAndCard(acts('bfnoticepool0000'));
      const b2 = bannerNow();
      ok('2a the banner names the POOL that paid, not the ability\'s own uses',
        !!b2 && b2.textContent.includes('used BF Notice Feat')
          && b2.textContent.includes('BF Notice Pool: 3 of 4 remaining'),
        b2 ? b2.textContent.trim().slice(0, 120) : 'NO banner');
      ok('2b the card line names the pool too',
        !!card2 && !!lineFor(card2.id) && lineFor(card2.id).textContent.includes('BF Notice Pool'));
      await until(() => !bannerNow(), 6000);   // let it fade before the next section
    }

    // ============================================================ §3 activity-level uses
    if (want(3)) {
      log.push('§3 activity uses');
      const card3 = await useAndCard(acts('bfnoticeact00000'));
      const b3 = bannerNow();
      ok('3a an activityUses spend announces off the ACTIVITY\'s own pool',
        !!b3 && b3.textContent.includes('Free Cast: 1 of 2 remaining'),
        b3 ? b3.textContent.trim().slice(0, 120) : 'NO banner');
      ok('3b and the card line agrees',
        !!card3 && !!lineFor(card3.id)?.textContent.includes('Free Cast: 1 of 2'));   // spendLine's one wording
      await until(() => !bannerNow(), 6000);   // let it fade before the next section
    }

    // ============================================================ §4 the silences
    if (want(4)) {
      log.push('§4 silences');
      const card4 = await useAndCard(mundane.system.activities.contents[0], { banner: false });
      ok('4a a no-recovery expendable spends in silence (no banner, no line)',
        !bannerNow() && !(card4 && lineFor(card4.id)),
        card4 ? 'card exists, correctly undecorated' : 'no card');
      // NPC silence: take the player ownership away and spend again.
      await victim.update({ ownership: priorOwnership }, { diff: false, recursive: false });
      const card4b = await useAndCard(acts('bfnoticeself0000'), { banner: false });
      ok('4b the same spend from a non-player-owned actor says nothing',
        !bannerNow() && !(card4b && lineFor(card4b.id)));
      await victim.update({ ownership: { ...priorOwnership, [player.id]: 3 } });
      // The switch.
      await set('resourceNotices', false);
      const card4c = await useAndCard(acts('bfnoticeself0000'), { banner: false });
      ok('4c the switch off silences both surfaces',
        !bannerNow() && !(card4c && lineFor(card4c.id)));
      await set('resourceNotices', true);
    }

    // ============================================================ §5 (cc) the flash waits for the dice
    if (want(5)) {
      log.push('§5 deferred flash');
      // The hide filters the card's data at birth (polish.js), so the button this section presses
      // exists only with the hide OFF (restored in teardown).
      await set('hideCardButtons', false);
      [healFeat] = await victim.createEmbeddedDocuments('Item', [{
        name: 'BF Notice Heal', type: 'feat',
        system: {
          uses: { spent: 0, max: '3', recovery: [{ period: 'sr', type: 'recoverAll' }] },
          activities: { bfnoticeheal0000: { _id: 'bfnoticeheal0000', type: 'heal', name: 'Heal',
            activation: { type: 'bonus' },
            healing: { number: 1, denomination: 10, bonus: '1', types: ['healing'] },
            consumption: { targets: [{ type: 'itemUses', target: '', value: '1' }] } } }
        }
      }]);
      created.items.push(healFeat.id);
      const card5 = await useAndCard(healFeat.system.activities.contents[0], { banner: false, line: true });
      ok('5a the use alone flashes NOTHING — the ability has dice of its own to roll',
        !!card5 && !bannerNow(), bannerNow()?.textContent?.slice(0, 60) ?? 'quiet');
      ok('5b the durable card line does NOT wait (the ledger is immediate)',
        !!card5 && !!lineFor(card5.id) && lineFor(card5.id).textContent.includes('2 of 3'));
      // The card button is the player's real path: click it, submit the native dialog, the flash releases.
      const healBtn = document.querySelector(`[data-message-id="${card5?.id}"] button[data-action="rollHealing"]`);
      ok('5c the heal button exists on the card', !!healBtn);
      const beforeRoll = new Set(game.messages.contents.map(m => m.id));
      healBtn?.click();
      const cfgDlg = await until(() => [...foundry.applications.instances.values()]
        .find(a => a.constructor?.name?.includes('RollConfiguration') && a.rendered), 5000);
      cfgDlg?.element.querySelector('button[type="submit"]')?.click();
      // Both halves: 5d reads the roll, 5e the banner it releases.
      const rollNow = () => game.messages.contents.find(m => !beforeRoll.has(m.id) && m.rolls?.length);
      await until(() => rollNow() && bannerNow(), 8000);
      const healRoll = rollNow();
      ok('5d the roll links to the card (the (cc) linkage pin, card-button path)',
        !!healRoll && (healRoll._source.system?.origin === card5?.id),
        JSON.stringify({ link: healRoll?._source.system?.origin ?? null, card: card5?.id }));
      const b5 = bannerNow();
      ok('5e the flash released WITH the dice — after the roll, not the use',
        !!b5 && b5.textContent.includes('used BF Notice Heal')
          && b5.textContent.includes('2 of 3 remaining'),
        b5 ? b5.textContent.trim().slice(0, 120) : 'NO banner');
      await until(() => !bannerNow(), 6000);   // let it fade before §6 measures silence
    }

    // ============================================================ §6 (cc) the fallback timer
    if (want(6)) {
      log.push('§6 fallback');
      const card6 = await useAndCard(healFeat.system.activities.contents[0], { banner: false, line: true });
      ok('6a still quiet right after the use', !!card6 && !bannerNow());
      // FLASH_FALLBACK_MS is 12s: a player who never rolls still flashes. Waited for, a real deadline.
      await until(() => bannerNow(), 15_000);
      const b6 = bannerNow();
      ok('6b the fallback flashed it: never rolled, still announced',
        !!b6 && b6.textContent.includes('1 of 3 remaining'),
        b6 ? b6.textContent.trim().slice(0, 120) : 'NO banner');
    }

    // ============================================================ §7 the data-plane spend stamp
    // The elect stamps `spend` = {combat, sourceUuid, rows/slots} beside dnd5e's deltas at creation,
    // UNGATED by the notices setting; the rhythm gate and the player-owned rule hold as for the flash.
    if (want(7)) {
      log.push('§7 spend stamp');
      // ⚠ §7 owns its pools: §§1/4b/4c exhaust the shared feat, and in a full battery dnd5e would
      // refuse the consumption and post no card.
      const [feat7] = await victim.createEmbeddedDocuments('Item', [{
        name: 'BF Stamp Feat', type: 'feat',
        system: {
          uses: { spent: 0, max: '9', recovery: [{ period: 'sr', type: 'recoverAll' }] },
          activities: { bfstampself00000: { _id: 'bfstampself00000', type: 'utility',
            name: 'Stamp Spend', activation: { type: 'action' },
            consumption: { targets: [{ type: 'itemUses', target: '', value: '1' }] } } }
        }
      }]);
      created.items.push(feat7.id);
      const [mundane7] = await victim.createEmbeddedDocuments('Item', [{
        name: 'BF Stamp Torchlike', type: 'consumable',
        system: {
          type: { value: 'trinket' },
          uses: { spent: 0, max: '2', recovery: [] },   // uses but NO recovery
          activities: { bfstampmund00000: { _id: 'bfstampmund00000', type: 'utility', name: 'Use',
            activation: { type: 'action' },
            consumption: { targets: [{ type: 'itemUses', target: '', value: '1' }] } } }
        }
      }]);
      created.items.push(mundane7.id);
      const spendAct = () => feat7.system.activities.get('bfstampself00000');

      const card7 = await useAndCard(spendAct());
      const stamp7 = await until(() => card7?.getFlag(MOD, 'spend'), 6000);
      ok('7a a qualifying spend stamps rows + EXPLICIT null combat + the spender as source',
        !!stamp7 && stamp7.combat === null && stamp7.sourceUuid === speaker().uuid
          && stamp7.rows?.length === 1 && stamp7.rows[0].pool === 'BF Stamp Feat'
          && (typeof stamp7.rows[0].left === 'number') && (typeof stamp7.rows[0].max === 'number')
          && !stamp7.slots,
        JSON.stringify(stamp7 ?? null));
      await until(() => !bannerNow(), 6000);

      const card7b = await useAndCard(mundane7.system.activities.contents[0], { banner: false });
      ok('7b a no-recovery expendable stays out of the ledger — the rhythm gate holds here too',
        !!card7b && !card7b.getFlag(MOD, 'spend'),
        card7b ? 'card exists, unstamped' : 'no card');

      // NPC spends stay off the ledger (monster pools are the GM's secret).
      await victim.update({ ownership: priorOwnership }, { diff: false, recursive: false });
      const card7c = await useAndCard(spendAct(), { banner: false });
      ok('7c the same spend from a non-player-owned actor is not stamped',
        !!card7c && !card7c.getFlag(MOD, 'spend'));
      await victim.update({ ownership: { ...priorOwnership, [player.id]: 3 } });

      await set('resourceNotices', false);
      const card7d = await useAndCard(spendAct(), { banner: false });
      const stamp7d = await until(() => card7d?.getFlag(MOD, 'spend'), 6000);
      ok('7d the stamp is UNGATED — notices off, the ledger still gets fed',
        !!stamp7d && stamp7d.rows?.length === 1, JSON.stringify(stamp7d ?? null));
      await set('resourceNotices', true);

      // Slot spends stamp a slots row with the post-spend pool (no recovery-pool row).
      const [slotcaster] = await victim.createEmbeddedDocuments('Item', [{
        name: 'BF Notice Slotcast', type: 'feat',
        system: { activities: { bfnoticeslot0000: { _id: 'bfnoticeslot0000', type: 'utility',
          name: 'Slot Cast', activation: { type: 'action' },
          consumption: { targets: [{ type: 'spellSlots', target: '1', value: '1' }] } } } }
      }]);
      created.items.push(slotcaster.id);
      // `max` is derived on an NPC: `override` is the writable knob (writing max leaves it 0).
      await victim.update({ 'system.spells.spell1.override': 2, 'system.spells.spell1.value': 2 });
      const card7e = await useAndCard(slotcaster.system.activities.contents[0], { banner: false });
      const stamp7e = await until(() => card7e?.getFlag(MOD, 'spend'), 6000);
      ok('7e a slot spend stamps a slots row with the post-spend pool truth',
        !!stamp7e && !stamp7e.rows && stamp7e.slots?.length === 1
          && stamp7e.slots[0].slot === 'spell1' && stamp7e.slots[0].spent === 1
          && stamp7e.slots[0].left === 1 && stamp7e.slots[0].max === 2,
        JSON.stringify(stamp7e ?? null));
      await victim.update({ 'system.spells.spell1.override': null, 'system.spells.spell1.value': 0 });
    }

    await teardown();
  } catch (err) {
    log.push(`SUITE ERROR: ${err?.stack ?? err}`);
    await teardown();
  }
  return { results, log, skips };
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'resources', out, plan, f });
