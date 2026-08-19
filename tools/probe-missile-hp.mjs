// Instrumented one-shot: reproduce smoke-hold 6a's exact steps with a full ledger of every
// message, damage event and HP movement between ensureShielder's heal and the manual apply.
// The suite failed twice with the shielder arriving at 6a's read 2 then 8 HP short of the
// full pool its own heal just wrote; this names the thing that takes it.
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
setTimeout(() => { console.error('[probe] WATCHDOG 240s'); process.exit(3); }, 240_000);

const f = new Foundry(foundryConfig(env));
console.log('[probe] connecting…');
await f.connect();
console.log('[probe] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ledger = [];
  const note = (kind, data) => ledger.push({ t: Date.now(), kind, ...data });

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const shielder = game.actors.getName('BF Test Shielder');
  if (!scene || !attacker || !shielder) return { fatal: 'fixtures missing' };
  if (canvas.scene?.id !== scene.id) await scene.view();

  const KEYS = ['autoDamage', 'autoApply', 'dramaticBeat', 'reactionHold', 'holdTimer',
    'holdSkipFutile', 'requireTarget', 'concMode'];
  const prior = Object.fromEntries(KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  await set('autoDamage', 'all');
  await set('autoApply', true);
  await set('dramaticBeat', 0);
  await set('reactionHold', true);
  await set('holdTimer', 0);
  await set('holdSkipFutile', false);
  await set('requireTarget', false);
  await set('concMode', 'off');

  // The ledger's ears.
  const hooks = [];
  const on = (name, fn) => hooks.push([name, Hooks.on(name, fn)]);
  on('createChatMessage', m => note('message', {
    id: m.id, speaker: m.speaker?.alias ?? null,
    rollType: m.getFlag('dnd5e', 'roll')?.type ?? null,
    modFlags: Object.keys(m.flags?.[MOD] ?? {}),
    content: (m.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90),
  }));
  on('dnd5e.damageActor', (a, changes) => note('damageActor', {
    actor: a.name, changes: { ...changes } }));
  on('dnd5e.preApplyDamage', (a, amount, updates, options) => note('preApplyDamage', {
    actor: a.name, amount, origin: options?.originatingMessage?.id ?? null }));
  on('updateActor', (a, delta) => {
    if (delta.system?.attributes?.hp) note('hpWrite', {
      actor: a.name, hp: JSON.parse(JSON.stringify(delta.system.attributes.hp)) });
  });

  const hp = () => `${shielder.system.attributes.hp.value}+${shielder.system.attributes.hp.temp}t/${shielder.system.attributes.hp.max}`;

  try {
    const mine = [];
    // ensureShielder equivalent: full pool, clean slate.
    const doc = scene.tokens.find(t => t.actorId === shielder.id);
    if (!doc) return { fatal: 'no shielder token' };
    await new Promise(r => { const i = setInterval(() => {
      if (canvas.ready && canvas.tokens.get(doc.id)) { clearInterval(i); r(); } }, 200); });
    await shielder.update({
      'system.spells.spell1.value': shielder.system.spells.spell1.max || 4,
      'system.attributes.hp.value': shielder.system.attributes.hp.max,
      'system.attributes.hp.temp': 0 });
    await shielder.unsetFlag(MOD, 'reactionSpent');
    for (const e of shielder.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
    note('healed', { hp: hp() });

    // ensureMissile + castMissileAt equivalents (smoke-hold sweeps its MM fixture on exit,
    // so the probe builds its own the same way: no slot cost, prepared).
    let mmItem = attacker.items.find(i => i.name === 'Magic Missile' && i.type === 'spell');
    if (!mmItem) {
      const src = (await fromUuid('Compendium.dnd-players-handbook.spells.Item.phbsplMagicMissi')).toObject();
      delete src._id;
      for (const a of Object.values(src.system.activities ?? {})) {
        if (a.consumption) a.consumption.spellSlot = false;
      }
      src.system.prepared = 1;
      [mmItem] = await attacker.createEmbeddedDocuments('Item', [src]);
      note('built-mm', {});
    }
    const missile = mmItem.system.activities?.contents?.[0];
    if (!missile) return { fatal: 'Magic Missile fixture has no activity' };
    canvas.tokens.get(doc.id).setTarget(true, { releaseOthers: true });
    await sleep(100);
    note('pre-cast', { hp: hp() });
    const usage = await missile.use({ subsequentActions: false }, { configure: false }, {});
    const usageMsg = usage?.message ?? null;
    if (usageMsg) mine.push(usageMsg.id);
    note('cast', { usageId: usageMsg?.id ?? null, hp: hp() });

    const pending = await new Promise(r => { const until = Date.now() + 8000;
      const i = setInterval(() => {
        const h = usageMsg ? game.messages.get(usageMsg.id)?.getFlag(MOD, 'hold') : null;
        if (h?.status === 'pending' || Date.now() > until) { clearInterval(i); r(h); } }, 250); });
    note('held', { pending: pending?.status ?? null, hp: hp() });

    const castButton = Array.from(document.querySelectorAll(
      `[data-message-id="${usageMsg?.id}"] .battleflow-hold button`))
      .find(b => b.textContent.trim() === 'Cast');
    note('button', { found: !!castButton, hp: hp() });
    castButton?.click();

    const done = await new Promise(r => { const until = Date.now() + 25000;
      const i = setInterval(() => {
        const h = usageMsg ? game.messages.get(usageMsg.id)?.getFlag(MOD, 'hold') : null;
        if (h?.status === 'resolved' || Date.now() > until) { clearInterval(i); r(h); } }, 250); });
    note('resolved', { status: done?.status ?? null, hp: hp() });
    await sleep(1200);
    note('after-settle', { hp: hp() });

    return {
      hpFinal: hp(),
      shielderMax: shielder.system.attributes.hp.max,
      ledger,
    };
  } finally {
    for (const [name, id] of hooks) Hooks.off(name, id);
    const mm = game.actors.getName('BF Test Attacker')?.items
      .find(i => i.name === 'Magic Missile' && i.type === 'spell');
    if (mm) await mm.delete();
    for (const e of shielder.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
    await shielder.unsetFlag(MOD, 'reactionSpent');
    await shielder.update({
      'system.attributes.hp.value': shielder.system.attributes.hp.max,
      'system.attributes.hp.temp': 0 });
    for (const [k, v] of Object.entries(prior)) await set(k, v);
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
  }
}, null);

if (out.fatal) { console.error(`[probe] FATAL: ${out.fatal}`); process.exit(2); }
for (const e of out.ledger) {
  const { t, kind, ...rest } = e;
  console.log(`  ${new Date(t).toISOString().slice(11, 23)} ${kind.padEnd(14)} ${JSON.stringify(rest)}`);
}
console.log(`\n[probe] final HP ${out.hpFinal} (max ${out.shielderMax})`);
process.exit(0);
