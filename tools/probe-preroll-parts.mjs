// P1 — READ-ONLY probe of the `dnd5e.preRollDamageV2` config shape (Pass A step 0).
//
// The Cleave strip (FLOW item 8) removes the flat ability-modifier part from a weapon's damage
// roll at this hook. Nothing in the tree has ever READ `config.rolls[i].parts` (hit-riders only
// pushes new entries), so the shape is unverified — and this repo has been burned every time it
// guessed a system internal. Five questions, each with the cheapest observable:
//
//   1  What is a rolls entry, exactly — keys, where `.base` lives, where "@mod" lives, data.mod
//   2  With AMMUNITION — does the ammo entry displace index 0, and does `.base` still mark the weapon's own entry
//   3  NEGATIVE mod — does "@mod" stay in parts with data.mod < 0 on a normal (non-offhand) attack
//      (dnd5e.mjs:28343 includes it via the `|| (roll.data.mod < 0)` branch — the strip must SKIP here)
//   4  Does a PUSHED entry (the hit-riders idiom) get crit-doubled
//   5  Does mutating the `message` param at the hook persist onto the created damage message
//
// ⚠ Run `smoke-battleflow` FIRST — rides the BF Test Attacker fixture.
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
setTimeout(() => { console.error('[preroll] WATCHDOG 300s'); process.exit(3); }, 300_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
const who = await preflightSoleGM(f);
console.log(`[preroll] connected as "${who.self}"; elect = ${who.elect}`);

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const attacker = game.actors.getName('BF Test Attacker');
  if (!attacker) return { fatal: 'BF Test Attacker missing — run smoke-battleflow first' };

  const weaponAct = attacker.items.contents
    .flatMap(i => i.system.activities?.contents ?? [])
    .find(a => (a.type === 'attack') && (a.item?.type === 'weapon'));
  if (!weaponAct) return { fatal: 'BF Test Attacker has no weapon attack activity' };

  const prior = {
    str: attacker.system._source.abilities?.str?.value ?? 10,
    autoApply: game.settings.get(MOD, 'autoApply'),
    riders: game.settings.get(MOD, 'riders')
  };
  await game.settings.set(MOD, 'autoApply', false);
  await game.settings.set(MOD, 'riders', false);

  const created = [];
  const dumpEntry = r => ({
    ownKeys: Object.keys(r),
    hasOwnBase: Object.prototype.hasOwnProperty.call(r, 'base'),
    base: r.base ?? null,
    parts: Array.isArray(r.parts) ? [...r.parts] : r.parts,
    dataMod: r.data?.mod ?? null,
    optionType: r.options?.type ?? null
  });

  /** Roll damage once with a one-shot hook capture; returns {cap, msg}. */
  const rollOnce = async (config = {}, mutateAtHook = null) => {
    const cap = {};
    Hooks.once('dnd5e.preRollDamageV2', (cfg, dialog, message) => {
      cap.rolls = (cfg.rolls ?? []).map(dumpEntry);
      cap.configKeys = Object.keys(cfg);
      cap.isCritical = cfg.isCritical ?? null;
      cap.messageDataKeys = Object.keys(message?.data ?? {});
      if (mutateAtHook) mutateAtHook(cfg, message);
    });
    const before = game.messages.size;
    await weaponAct.rollDamage(
      { ...config },
      { configure: false },
      { data: { 'flags.dnd5e.originatingMessage': 'bf-probe-preroll' } }
    );
    await sleep(300);
    const fresh = game.messages.contents.slice(before);
    created.push(...fresh.map(m => m.id));
    const msg = fresh.find(m => m.getFlag('dnd5e', 'roll.type') === 'damage') ?? null;
    return { cap, msg };
  };

  const results = [];
  const log = [];

  /* 1 — the bare shape. ----------------------------------------------------------------- */
  const bare = await rollOnce();
  log.push(`bare rolls: ${JSON.stringify(bare.cap.rolls)}`);
  log.push(`config keys: ${bare.cap.configKeys.join(',')}`);
  const baseEntry = bare.cap.rolls.find(r => r.base === true) ?? null;
  results.push({ n: 1, name: 'a .base===true entry exists and carries "@mod" in parts',
    pass: !!baseEntry && baseEntry.parts.some(p => String(p).includes('@mod')),
    detail: `baseEntry=${JSON.stringify(baseEntry)}` });

  /* 2 — ammunition: import a bow + arrows, roll with ammo in config. --------------------- */
  let ammoDump = null;
  {
    const importByName = async name => {
      for (const p of game.packs.filter(p => p.documentName === 'Item')) {
        const e = p.index.find(i => i.name === name);
        if (e) { const d = await p.getDocument(e._id); return d.toObject(); }
      }
      return null;
    };
    const bowSrc = await importByName('Shortbow');
    const arrowSrc = await importByName('Arrows') ?? await importByName('Arrow');
    if (bowSrc && arrowSrc) {
      const [bow, arrows] = await attacker.createEmbeddedDocuments('Item', [
        { ...bowSrc, name: 'BF Probe Bow', system: { ...bowSrc.system, equipped: true } },
        { ...arrowSrc, name: 'BF Probe Arrows', system: { ...arrowSrc.system, quantity: 20 } }
      ]);
      const bowAct = bow.system.activities?.contents?.find(a => a.type === 'attack');
      const cap2 = {};
      Hooks.once('dnd5e.preRollDamageV2', cfg => { cap2.rolls = (cfg.rolls ?? []).map(dumpEntry); });
      const before = game.messages.size;
      await bowAct?.rollDamage({ ammunition: arrows }, { configure: false },
        { data: { 'flags.dnd5e.originatingMessage': 'bf-probe-preroll-ammo' } });
      await sleep(300);
      created.push(...game.messages.contents.slice(before).map(m => m.id));
      ammoDump = cap2.rolls ?? null;
      log.push(`ammo rolls: ${JSON.stringify(ammoDump)}`);
      const baseIdx = (ammoDump ?? []).findIndex(r => r.base === true);
      results.push({ n: 2, name: 'with ammo, .base still marks the weapon entry (index recorded)',
        pass: baseIdx >= 0,
        detail: `baseIndex=${baseIdx} entries=${ammoDump?.length ?? 0}` });
      await attacker.deleteEmbeddedDocuments('Item', [bow.id, arrows.id]).catch(() => {});
    } else {
      results.push({ n: 2, name: 'with ammo, .base still marks the weapon entry',
        pass: false, detail: `compendium import failed: bow=${!!bowSrc} arrows=${!!arrowSrc}` });
    }
  }

  /* 3 — negative mod on a normal attack: "@mod" must STAY, data.mod < 0. ----------------- */
  await attacker.update({ 'system.abilities.str.value': 6 });
  const neg = await rollOnce();
  await attacker.update({ 'system.abilities.str.value': prior.str });
  const negBase = neg.cap.rolls.find(r => r.base === true) ?? null;
  log.push(`negative-mod rolls: ${JSON.stringify(neg.cap.rolls)}`);
  results.push({ n: 3, name: 'negative mod: "@mod" stays in parts with data.mod < 0',
    pass: !!negBase && (negBase.dataMod < 0) && negBase.parts.some(p => String(p).includes('@mod')),
    detail: `dataMod=${negBase?.dataMod} parts=${JSON.stringify(negBase?.parts)}` });

  /* 4 — a pushed entry crits. ------------------------------------------------------------ */
  const crit = await rollOnce({ isCritical: true }, cfg => {
    cfg.rolls.push({ data: cfg.rolls[0]?.data ?? {}, parts: ['1d6'],
      options: { type: 'fire', types: ['fire'] } });
  });
  const fireRoll = crit.msg?.rolls?.find(r => (r.options?.type === 'fire')
    || r.terms?.some(t => t.faces === 6)) ?? null;
  const d6count = fireRoll?.terms?.filter(t => t.faces === 6)
    .reduce((n, t) => n + (t.number ?? 0), 0) ?? 0;
  log.push(`crit push: formula="${fireRoll?.formula}" d6count=${d6count}`);
  results.push({ n: 4, name: 'a pushed entry is crit-doubled (1d6 -> 2 dice)',
    pass: d6count === 2, detail: `formula="${fireRoll?.formula}" d6count=${d6count}` });

  /* 5 — message-data mutation at the hook persists to the damage message. ---------------- */
  const stamped = await rollOnce({}, (cfg, message) => {
    foundry.utils.setProperty(message, `data.flags.${MOD}.probeStamp`, 'yes');
  });
  const stampBack = stamped.msg?.getFlag(MOD, 'probeStamp') ?? null;
  results.push({ n: 5, name: 'mutating message.data at the hook persists onto the damage message',
    pass: stampBack === 'yes', detail: `flag readback=${JSON.stringify(stampBack)}` });

  /* teardown ----------------------------------------------------------------------------- */
  await ChatMessage.deleteDocuments([...new Set(created)].filter(id => game.messages.has(id)))
    .catch(() => {});
  await game.settings.set(MOD, 'autoApply', prior.autoApply);
  await game.settings.set(MOD, 'riders', prior.riders);
  return { log, results };
});

if (out.fatal) { console.error('[preroll] FATAL:', out.fatal); process.exit(2); }
for (const l of out.log) console.log(`  · ${l}`);
let bad = 0;
for (const r of out.results.sort((a, b) => a.n - b.n)) {
  if (!r.pass) bad++;
  console.log(`\n  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}. ${r.name}\n        ${r.detail}`);
}
console.log(bad ? `\n[preroll] ${bad} of ${out.results.length} WRONG`
                : `\n[preroll] ${out.results.length}/${out.results.length} — the shape is measured`);
process.exit(bad ? 1 : 0);
