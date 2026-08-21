// Follow-up to probe-volley-resources: the SR use error, the count-formula scaling channel,
// activity-level uses recovery, and the actors the first sweep missed. Fixture-only drives.
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
setTimeout(() => { console.error('[volley2] WATCHDOG 240s'); process.exit(3); }, 240_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[volley2] connected');

const out = await f.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rep = {};

  const gren = game.actors.find(a => a.name.startsWith('Gren'));
  const mm = gren?.items.find(i => i.name === 'Magic Missile');
  const sr = gren?.items.find(i => i.name === 'Scorching Ray');

  // ---- T: the target/count channel ------------------------------------------------------
  const simp = dnd5e.utils.simplifyBonus;
  const countOf = (item, scaling) => {
    const raw = item.system.target?.affects?.count
      ?? item.system.activities?.contents?.[0]?.target?.affects?.count ?? null;
    let evaluated = null;
    try { evaluated = simp(String(raw ?? ''), { scaling }); } catch (e) { evaluated = `ERR ${e.message}`; }
    return { raw: raw ?? null, [`atScaling${scaling}`]: evaluated };
  };
  rep.targets = {};
  for (const [label, item] of [['mm', mm], ['sr', sr]]) {
    if (!item) { rep.targets[label] = { missing: true }; continue; }
    const act = item.system.activities.contents[0];
    rep.targets[label] = {
      itemTargetSource: item.system.toObject().target ?? null,
      activityOverride: act.target?.override ?? null,
      preparedCount: act.target?.affects?.count ?? null,
      preparedType: act.target?.affects?.type ?? null,
      count0: countOf(item, 0), count2: countOf(item, 2)
    };
  }
  // Eldritch Blast anywhere in the party?
  rep.eldritch = [];
  for (const a of game.actors.filter(a => a.hasPlayerOwner)) {
    const eb = a.items.find(i => i.name === 'Eldritch Blast');
    if (eb) rep.eldritch.push({ actor: a.name,
      count: eb.system.activities?.contents?.[0]?.target?.affects?.count ?? null });
  }

  // ---- S: why did the SR fixture use abort? ---------------------------------------------
  const SAFE = /^(Practice Dummy|BF Test)/;
  const fixTok = canvas.tokens.placeables.find(t => t.actor && SAFE.test(t.actor.name));
  const fix = fixTok?.actor ?? null;
  const temps = []; const before = game.messages.size;
  const closeStrays = () => {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof foundry.applications.api.DialogV2) void app.close();
      if (app.constructor?.name?.includes('RollConfigurationDialog')) void app.close();
    }
  };
  if (fix && sr) {
    const data = sr.toObject(); delete data._id;
    data.name = 'BF Probe SR2';
    data.system.preparation = { mode: 'always', prepared: true };
    for (const act of Object.values(data.system.activities ?? {})) {
      act.consumption = { targets: [], scaling: { allowed: false, max: '' }, spellSlot: false };
    }
    const [doc] = await fix.createEmbeddedDocuments('Item', [data]);
    temps.push(doc);
    const act = doc.system.activities.contents[0];
    let err = null, result = null;
    try {
      result = await Promise.race([
        act.use({}, { configure: false }, {}).then(r => (r === false) ? 'returned false' : 'resolved'),
        sleep(5000).then(() => 'TIMEOUT')
      ]);
    } catch (e) { err = `${e.name}: ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 4).join('\n')}`; }
    await sleep(2000); closeStrays();
    const fresh = game.messages.contents.slice(before);
    rep.srUse = {
      result, err,
      newMessages: fresh.map(x => ({ type: x.type, rollType: x.getFlag('dnd5e', 'roll.type') ?? null,
        formula: x.rolls?.[0]?.formula ?? null }))
    };
    // Suppression re-test, only meaningful if the use itself works.
    let sawHook = false, cfgAfter = null;
    const hid = Hooks.on('dnd5e.preUseActivity', (activity, usageConfig) => {
      if (activity.item?.name !== 'BF Probe SR2') return;
      sawHook = true; usageConfig.subsequentActions = false; cfgAfter = usageConfig.subsequentActions;
    });
    const m1 = game.messages.size;
    let err1 = null, result1 = null;
    try {
      result1 = await Promise.race([
        act.use({}, { configure: false }, {}).then(r => (r === false) ? 'returned false' : 'resolved'),
        sleep(5000).then(() => 'TIMEOUT')
      ]);
    } catch (e) { err1 = `${e.name}: ${e.message}`; }
    await sleep(2000); closeStrays();
    Hooks.off('dnd5e.preUseActivity', hid);
    const fresh1 = game.messages.contents.slice(m1);
    rep.srSuppressed = {
      sawHook, result: result1, err: err1,
      newMessages: fresh1.map(x => ({ type: x.type, rollType: x.getFlag('dnd5e', 'roll.type') ?? null })),
      consumedFlag: doc.getFlag('dnd5e', 'consumed') ?? null
    };
  } else rep.srUse = { skipped: `fix=${fix?.name}, sr=${!!sr}` };

  // ---- A: activity-level uses (the activityUses pool shape) -----------------------------
  const jetten = game.actors.find(a => a.name.startsWith('Jetten'));
  const fav = jetten?.items.find(i => i.name === 'Favored Enemy');
  const favAct = fav?.system.activities?.contents?.find(a => a.consumption?.targets?.some(t => t.type === 'activityUses'));
  rep.activityUses = favAct ? {
    activity: favAct.name, uses: {
      spent: favAct.uses?.spent, max: favAct.uses?.max, value: favAct.uses?.value,
      recovery: (favAct.uses?.recovery ?? []).map(r => r.period)
    }
  } : { missing: true };

  // ---- G: who was missed (Goldthorn etc.) -----------------------------------------------
  rep.actors = game.actors.filter(a => a.hasPlayerOwner).map(a => ({
    name: a.name, type: a.type,
    faerie: a.items.find(i => /faerie/i.test(i.name))?.name ?? null
  }));
  const gold = game.actors.find(a => /goldthorn/i.test(a.name));
  if (gold) {
    rep.goldthorn = { type: gold.type, hasPlayerOwner: gold.hasPlayerOwner,
      items: gold.items.filter(i => {
        const uses = i.system.uses;
        const acts = i.system.activities?.contents ?? [];
        return uses?.max || acts.some(x => x.consumption?.targets?.length);
      }).map(i => ({ item: i.name, type: i.type,
        uses: i.system.uses?.max ? { value: i.system.uses.value, max: i.system.uses.max,
          recovery: (i.system.uses.recovery ?? []).map(r => r.period) } : null,
        consumption: (i.system.activities?.contents ?? []).flatMap(x => x.consumption?.targets ?? [])
          .map(t => ({ type: t.type, target: t.target || '(self)', value: t.value })) })) };
  }

  const freshAll = game.messages.contents.slice(before);
  await ChatMessage.deleteDocuments(freshAll.map(m => m.id)).catch(() => {});
  for (const t of temps) await t.delete().catch(() => {});
  return rep;
});

console.log(JSON.stringify(out, null, 1));
process.exit(0);
