// PASS C (volleys) + resource notices — the bedrock probe. Read-only against the live party;
// every DRIVEN use runs on a BF Test / Practice Dummy fixture with temp items, deleted after.
//
// Questions, each load-bearing for a design decision:
//   V1 — what do Magic Missile and Scorching Ray actually carry at 5.3.3 (2024 content):
//        activity types, damage parts + scaling, target.affects.count (FormulaField — does the
//        projectile count live there, and does it scale?), consumption.
//   V2 — what does a bare `use()` natively trigger for each (subsequent actions: MM one damage
//        roll, SR one attack), and does `usageConfig.subsequentActions = false` set inside
//        dnd5e.preUseActivity SUPPRESS it (the volley's claim seam)?
//   V3 — with subsequentActions suppressed, is `flags.dnd5e.consumed` skipped on the item
//        (the Refund Resource dependency), and is `activity.createConsumedFlag` public to
//        replicate it?
//   V4 — where does upcast scaling land (usage message flags/system), and what formula does a
//        driven rollDamage produce at base vs scaled?
//   R1 — the EXACT shape of `message.system.deltas` on a usage message after consumption
//        (self-uses and cross-item pool uses) — the resource notice's whole data source.
//   R2 — the party's real limited-use inventory: every item with uses.max or a consuming
//        activity, with its consumption.targets raw — what the notice must recognize.
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
setTimeout(() => { console.error('[volley] WATCHDOG 300s'); process.exit(3); }, 300_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[volley] connected');

const out = await f.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rep = { who: {}, v1: {}, v2: {}, v3: {}, v4: {}, r1: {}, r2: [] };

  rep.who = {
    self: game.user.name, elect: game.users.activeGM?.name ?? null,
    actives: game.users.filter(u => u.active).map(u => `${u.name}${u.isGM ? ' (GM)' : ''}`)
  };

  const trimActivity = a => {
    const o = a.toObject();
    return {
      id: o._id, type: o.type, name: o.name || null,
      activation: o.activation?.type ?? null,
      target: o.target ?? null,
      damage: o.damage ?? null,
      attack: o.attack ? { type: o.attack.type, bonus: o.attack.bonus } : undefined,
      healing: o.healing ?? undefined,
      consumption: o.consumption ?? null,
      uses: o.uses ?? null
    };
  };

  // ---- V1: the real items, party first, PHB compendium fallback -------------------------
  const findSpell = async name => {
    for (const actor of game.actors) {
      if (!actor.hasPlayerOwner) continue;
      const it = actor.items.find(i => (i.type === 'spell') && (i.name.toLowerCase() === name));
      if (it) return { where: `party: ${actor.name}`, item: it };
    }
    for (const pack of game.packs.filter(p => p.documentName === 'Item')) {
      const idx = await pack.getIndex();
      const e = idx.find(x => x.name.toLowerCase() === name);
      if (e) return { where: `pack: ${pack.collection}`, item: await pack.getDocument(e._id) };
    }
    return null;
  };
  for (const name of ['magic missile', 'scorching ray']) {
    const hit = await findSpell(name);
    rep.v1[name] = hit ? {
      where: hit.where, level: hit.item.system.level,
      scalingMode: hit.item.system.scaling ?? null,
      activities: hit.item.system.activities.contents.map(trimActivity)
    } : { missing: true };
  }

  // ---- fixture ---------------------------------------------------------------------------
  const SAFE = /^(Practice Dummy|BF Test)/;
  const fixTok = canvas.tokens.placeables.find(t => t.actor && SAFE.test(t.actor.name));
  const fix = fixTok?.actor ?? null;
  rep.fixture = { scene: canvas.scene?.name, actor: fix?.name ?? null };
  const temps = []; const before = game.messages.size;
  const closeStrays = () => {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof foundry.applications.api.DialogV2) void app.close();
      if (app.constructor?.name?.includes('RollConfigurationDialog')) void app.close();
    }
  };

  const makeTempSpell = async (srcItem, tag) => {
    const data = srcItem.toObject();
    delete data._id;
    data.name = `BF Probe ${tag}`;
    data.system.preparation = { mode: 'always', prepared: true };
    // Strip consumption + uses: the fixture has no slots, and consumption is probed in R1.
    for (const [id, act] of Object.entries(data.system.activities ?? {})) {
      act.consumption = { targets: [], scaling: { allowed: act.consumption?.scaling?.allowed ?? false, max: '' }, spellSlot: false };
    }
    const [doc] = await fix.createEmbeddedDocuments('Item', [data]);
    temps.push(doc);
    return doc;
  };

  if (fix) {
    // ---- V2/V4 — MAGIC MISSILE ----------------------------------------------------------
    const mmSrc = rep.v1['magic missile'].missing ? null : await findSpell('magic missile');
    if (mmSrc) {
      const mm = await makeTempSpell(mmSrc.item, 'MM');
      const act = mm.system.activities.contents[0];
      const m0 = game.messages.size;
      await Promise.race([act.use({}, { configure: false }, {}), sleep(4000)]);
      await sleep(1800); closeStrays();
      const fresh = () => game.messages.contents.slice(m0);
      const usage = fresh().find(x => (x.type === 'usage') || (x.getFlag('dnd5e', 'messageType') === 'usage')) ?? null;
      const dmg = fresh().find(x => x.rolls?.length && (x.getFlag('dnd5e', 'roll.type') === 'damage')) ?? null;
      rep.v2.mm = {
        newMessages: fresh().map(x => ({ type: x.type, rollType: x.getFlag('dnd5e', 'roll.type') ?? null, formula: x.rolls?.[0]?.formula ?? null })),
        usageFlags: usage ? Object.keys(usage.flags?.dnd5e ?? {}) : null,
        usageSystem: usage ? JSON.parse(JSON.stringify(usage.system ?? {})) : null,
        usageScaling: usage?.getFlag('dnd5e', 'scaling') ?? null,
        nativeDamageFormula: dmg?.rolls?.[0]?.formula ?? null
      };
      // V4: driven damage, base and scaled, no messages created.
      const dr0 = await act.rollDamage({}, { configure: false }, { create: false }).catch(e => String(e));
      const dr2 = await act.rollDamage({ scaling: 2 }, { configure: false }, { create: false }).catch(e => String(e));
      rep.v4.mm = {
        base: Array.isArray(dr0) ? dr0.map(r => r.formula) : dr0,
        scaled2: Array.isArray(dr2) ? dr2.map(r => r.formula) : dr2
      };
      // V4b: does a USE at scaling 2 change what the subsequent/native roll produces, and
      // where does the message record the scaling?
      const m1 = game.messages.size;
      await Promise.race([act.use({ scaling: 2 }, { configure: false }, {}), sleep(4000)]);
      await sleep(1800); closeStrays();
      const fresh1 = game.messages.contents.slice(m1);
      const usage1 = fresh1.find(x => (x.type === 'usage') || (x.getFlag('dnd5e', 'messageType') === 'usage')) ?? null;
      const dmg1 = fresh1.find(x => x.rolls?.length && (x.getFlag('dnd5e', 'roll.type') === 'damage')) ?? null;
      rep.v4.mmUseScaled = {
        usageScalingFlag: usage1?.getFlag('dnd5e', 'scaling') ?? null,
        usageSpellLevel: usage1?.system?.spellLevel ?? usage1?.getFlag('dnd5e', 'use')?.spellLevel ?? null,
        nativeDamageFormula: dmg1?.rolls?.[0]?.formula ?? null,
        // What the count formula evaluates to under the scaled use, via the activity's roll data.
        affectsCount: act.target?.affects?.count || null,
        rollDataScaling: act.getRollData()?.scaling ?? null
      };
    }

    // ---- V2/V3 — SCORCHING RAY ----------------------------------------------------------
    const srSrc = rep.v1['scorching ray'].missing ? null : await findSpell('scorching ray');
    if (srSrc) {
      const sr = await makeTempSpell(srSrc.item, 'SR');
      const act = sr.system.activities.contents[0];
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
      const m0 = game.messages.size;
      await Promise.race([act.use({}, { configure: false }, {}), sleep(4000)]);
      await sleep(2200); closeStrays();
      const fresh = game.messages.contents.slice(m0);
      rep.v2.sr = {
        newMessages: fresh.map(x => ({ type: x.type, rollType: x.getFlag('dnd5e', 'roll.type') ?? null, formula: x.rolls?.[0]?.formula ?? null })),
        attackRolls: fresh.filter(x => x.getFlag('dnd5e', 'roll.type') === 'attack').length
      };
      // The suppression fact: preUseActivity sets subsequentActions = false.
      let sawHook = false;
      const hid = Hooks.on('dnd5e.preUseActivity', (activity, usageConfig) => {
        if (activity.item?.name !== 'BF Probe SR') return;
        sawHook = true; usageConfig.subsequentActions = false;
      });
      const m1 = game.messages.size;
      await Promise.race([act.use({}, { configure: false }, {}), sleep(4000)]);
      await sleep(2200); closeStrays();
      Hooks.off('dnd5e.preUseActivity', hid);
      const fresh1 = game.messages.contents.slice(m1);
      rep.v3 = {
        hookSaw: sawHook,
        suppressedAttackRolls: fresh1.filter(x => x.getFlag('dnd5e', 'roll.type') === 'attack').length,
        suppressedNewMessages: fresh1.map(x => ({ type: x.type, rollType: x.getFlag('dnd5e', 'roll.type') ?? null })),
        consumedFlagAfter: sr.getFlag('dnd5e', 'consumed') ?? null,
        createConsumedFlag: typeof act.createConsumedFlag
      };
    }

    // ---- R1 — consumption deltas, self-uses and pool-uses -------------------------------
    const [pool] = await fix.createEmbeddedDocuments('Item', [{
      name: 'BF Probe Pool', type: 'feat',
      system: { uses: { spent: 0, max: '4', recovery: [{ period: 'lr', type: 'recoverAll' }] } }
    }]);
    temps.push(pool);
    const [feat] = await fix.createEmbeddedDocuments('Item', [{
      name: 'BF Probe Feat', type: 'feat',
      system: {
        uses: { spent: 0, max: '3', recovery: [{ period: 'sr', type: 'recoverAll' }] },
        activities: {
          bfprobeselfuse00: {
            _id: 'bfprobeselfuse00', type: 'utility', name: 'Self Use',
            activation: { type: 'action' },
            consumption: { targets: [{ type: 'itemUses', target: '', value: '1' }] }
          },
          bfprobepooluse00: {
            _id: 'bfprobepooluse00', type: 'utility', name: 'Pool Use',
            activation: { type: 'action' },
            consumption: { targets: [{ type: 'itemUses', target: pool.id, value: '1' }] }
          }
        }
      }
    }]);
    temps.push(feat);
    const selfAct = feat.system.activities.get('bfprobeselfuse00');
    const poolAct = feat.system.activities.get('bfprobepooluse00');
    const grab = async act => {
      const m0 = game.messages.size;
      await Promise.race([act.use({}, { configure: false }, {}), sleep(4000)]);
      await sleep(1200); closeStrays();
      const usage = game.messages.contents.slice(m0)
        .find(x => (x.type === 'usage') || (x.getFlag('dnd5e', 'messageType') === 'usage')) ?? null;
      return usage ? {
        type: usage.type,
        deltas: JSON.parse(JSON.stringify(usage.system?.deltas ?? null)),
        systemKeys: Object.keys(usage.system ?? {}),
        flagsDnd5e: Object.keys(usage.flags?.dnd5e ?? {}),
        author: usage.author?.name ?? null
      } : { noUsageMessage: true };
    };
    rep.r1.selfUse = await grab(selfAct);
    rep.r1.selfState = { spent: feat.system.uses?.spent, max: feat.system.uses?.max, value: feat.system.uses?.value };
    rep.r1.poolUse = await grab(poolAct);
    rep.r1.poolState = { spent: pool.system.uses?.spent, max: pool.system.uses?.max, value: pool.system.uses?.value };
  }

  // ---- R2 — the party's limited-use inventory (pure read) --------------------------------
  for (const actor of game.actors) {
    if (!actor.hasPlayerOwner || (actor.type !== 'character')) continue;
    const entry = { actor: actor.name, items: [], spellSlots: {}, attributes: {} };
    for (const [k, v] of Object.entries(actor.system.spells ?? {})) {
      if (v?.max > 0) entry.spellSlots[k] = `${v.value}/${v.max}`;
    }
    for (const item of actor.items) {
      const uses = item.system.uses;
      const acts = (item.system.activities?.contents ?? []);
      const consuming = acts.filter(a => a.consumption?.targets?.length);
      if (!(uses?.max) && !consuming.length) continue;
      entry.items.push({
        item: item.name, type: item.type, subtype: item.system.type?.value ?? null,
        uses: uses?.max ? { spent: uses.spent, max: uses.max, value: uses.value,
          recovery: (uses.recovery ?? []).map(r => r.period) } : null,
        activities: consuming.map(a => ({
          name: a.name || a.type, type: a.type,
          consumption: a.consumption.targets.map(t => ({ type: t.type, target: t.target || '(self)', value: t.value }))
        }))
      });
    }
    if (entry.items.length) rep.r2.push(entry);
  }

  // ---- cleanup ---------------------------------------------------------------------------
  const freshAll = game.messages.contents.slice(before);
  await ChatMessage.deleteDocuments(freshAll.map(m => m.id)).catch(() => {});
  for (const t of temps) await t.delete().catch(() => {});
  game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
  return rep;
});

console.log('\n[volley] clients:', JSON.stringify(out.who.actives), '| elect:', out.who.elect);
console.log('\n=== V1 — the spells as data ===');
console.log(JSON.stringify(out.v1, null, 1));
console.log('\n=== fixture ===', JSON.stringify(out.fixture));
console.log('\n=== V2 — native subsequent actions ===');
console.log(JSON.stringify(out.v2, null, 1));
console.log('\n=== V3 — suppression + consumed flag ===');
console.log(JSON.stringify(out.v3, null, 1));
console.log('\n=== V4 — scaling channels ===');
console.log(JSON.stringify(out.v4, null, 1));
console.log('\n=== R1 — consumption deltas ===');
console.log(JSON.stringify(out.r1, null, 1));
console.log('\n=== R2 — the party limited-use inventory ===');
console.log(JSON.stringify(out.r2, null, 1));
process.exit(0);
