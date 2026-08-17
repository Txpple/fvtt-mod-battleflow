// One-shot probe: where does the reaction's effect receipt actually land after a real cast
// answers a hold? Reproduces smoke-hold 4b minimally with a ledger: pending holds before the
// cast, every message carrying effectReceipt afterwards, and any Battle Flow console errors.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[probe] WATCHDOG 180s'); process.exit(3); }, 180_000);
const f = new Foundry({
  serverUrl: env.MOLTEN_SERVER_URL, magicUrl: env.MOLTEN_MAGIC_URL,
  user: env.FOUNDRY_USER || 'Claude', password: env.FOUNDRY_PASSWORD,
  adminKey: env.MOLTEN_ADMIN_KEY, worldId: env.MOLTEN_WORLD_ID,
});
await f.connect();

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [];
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(x => String(x?.message ?? x)).join(' ')); origError(...a); };

  const KEYS = ['reactionHold', 'holdApplyEffect', 'holdSettle', 'holdTimer', 'holdSkipFutile',
    'holdReveal', 'holdView', 'autoDamage', 'autoApply', 'dramaticBeat', 'suppressAttackCards',
    'requireTarget', 'masteryRiders', 'effectRiders', 'riders', 'concMode', 'castApply', 'saves'];
  const prior = Object.fromEntries(KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const suiteStart = Date.now();

  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test Attacker');
  const shielder = game.actors.getName('BF Test Shielder');
  if (!scene || !attacker || !shielder) return { fatal: 'fixtures missing' };
  try {
    await set('reactionHold', true);
    await set('holdApplyEffect', true);
    await set('holdSettle', 2);
    await set('holdTimer', 0);
    await set('holdSkipFutile', false);   // strays allowed — the hypothesis under test
    await set('holdReveal', true);
    await set('holdView', false);         // card-only: the Cast button lives on the row
    await set('autoDamage', 'all');
    await set('autoApply', false);
    await set('dramaticBeat', 0);
    await set('suppressAttackCards', false);
    await set('requireTarget', false);
    await set('masteryRiders', false);
    await set('effectRiders', false);
    await set('riders', false);
    await set('concMode', 'off');
    await set('castApply', false);
    await set('saves', false);

    if (canvas.scene?.id !== scene.id) await scene.view();
    // clean slate on the shielder
    for (const m of game.messages.filter(x => x.getFlag(MOD, 'hold')?.status === 'pending')) {
      await m.unsetFlag(MOD, 'hold');
    }
    for (const e of shielder.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
    await shielder.unsetFlag(MOD, 'reactionSpent');
    try { await shielder.longRest({ dialog: false, chat: false }); } catch {}

    // tokens
    const mk = async (actor, x) => {
      const existing = scene.tokens.find(t => t.actorId === actor.id);
      if (existing) return canvas.tokens.get(existing.id);
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(),
          { x, y: 1800, actorId: actor.id, actorLink: true }, { inplace: false })]);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      return canvas.tokens.get(doc.id);
    };
    const shTok = await mk(shielder, 1000);
    const weapon = attacker.items.find(i => i.system?.activities?.contents?.some(a => a.type === 'attack'));
    const activity = () => attacker.items.get(weapon.id).system.activities.find(a => a.type === 'attack');
    const vAC = shielder.system.attributes.ac.value;

    // attack until one lands in [vAC, vAC+5)
    let atk = null;
    let attempts = 0;
    for (let i = 0; i < 40 && !atk; i++) {
      attempts++;
      shTok.setTarget(true, { releaseOthers: true });
      const usage = await activity().use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await activity().rollAttack({ advantage: true }, { configure: false },
        { data: { 'flags.dnd5e.originatingMessage': usage?.message?.id } });
      const t = rolls?.[0];
      if (t && !t.isCritical && !t.isFumble && (t.total >= vAC) && (t.total < vAC + 5)) {
        atk = { msgId: t.parent?.id, total: t.total };
      } else await sleep(100);
    }
    if (!atk) return { fatal: 'no in-window attack after 40 tries' };
    await sleep(1000);

    const pendingBefore = game.messages.filter(m => m.getFlag(MOD, 'hold')?.status === 'pending')
      .map(m => ({ id: m.id, isTheAttack: m.id === atk.msgId, ts: m.timestamp }));

    // click the card's Cast button, like the suite
    const btn = Array.from(document.querySelectorAll(
      `[data-message-id="${atk.msgId}"] .battleflow-hold button`))
      .find(b => b.textContent.trim() === 'Cast');
    if (!btn) return { fatal: 'no Cast button rendered' };
    btn.click();

    const resolved = await (async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < 25000) {
        const h = game.messages.get(atk.msgId)?.getFlag(MOD, 'hold');
        if (h?.status === 'resolved') return h;
        await sleep(300);
      }
      return null;
    })();
    await sleep(1500);

    const receipts = game.messages.contents
      .filter(m => (m.timestamp >= suiteStart - 60000) && m.getFlag(MOD, 'effectReceipt'))
      .map(m => ({
        id: m.id, isTheAttack: m.id === atk.msgId,
        hasHold: !!m.getFlag(MOD, 'hold'),
        respondsTo: m.getFlag(MOD, 'respondsTo') ?? null,
        targets: (m.getFlag(MOD, 'effectReceipt')?.targets ?? [])
          .map(t => ({ name: t.name, effects: t.effects?.map(e => e.name) }))
      }));

    return {
      attempts, vAC, total: atk.total, resolved: !!resolved,
      verdict: resolved?.targets?.[0]?.verdict ?? null,
      effectOnActor: !!shielder.effects.find(e => e.name === 'Imperceptible Barrier'),
      pendingBefore, receipts, errors, log
    };
  } finally {
    console.error = origError;
    // teardown: unstick holds, effects, messages, settings
    try {
      for (const m of game.messages.filter(x => x.getFlag(MOD, 'hold')?.status === 'pending')) {
        await m.unsetFlag(MOD, 'hold');
      }
      for (const e of shielder.effects.filter(e => e.name === 'Imperceptible Barrier')) await e.delete();
      await shielder.unsetFlag(MOD, 'reactionSpent');
      try { await shielder.longRest({ dialog: false, chat: false }); } catch {}
      try { await attacker.longRest({ dialog: false, chat: false }); } catch {}
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
          || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
      for (const [k, v] of Object.entries(prior)) await game.settings.set(MOD, k, v);
    } catch (e) { /* best effort */ }
  }
}, null);

console.log(JSON.stringify(out, null, 2));
process.exit(out?.fatal ? 1 : 0);
