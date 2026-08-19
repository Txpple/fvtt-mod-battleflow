// Two-client repro for finding ④ (2026-08-17 walk): a save demand cast from a PLAYER
// client never shows its popup on the GM client that owns the decision. The walk's flag
// forensics (probe-save-flags.mjs) showed EVERY demand target all session resolved
// timedOut — no save popup ever opened on the non-casting client — while the morning's
// strand evidence shows a popup on the CASTER's own window. This reproduces the topology
// headlessly with a ledger on every link of the chain: update/render hook fires, flag
// visibility, canAnswerFor, queue head, DialogV2.render calls/rejections, DOM dialogs.
//
// Fixture: a temporary innate save spell (no damage, no effects — zero side effects) on
// BF Test PC Attacker (PC Assistant's actor), cast at BF Test Victim (GM-decided). The
// demand card is deleted before the buzzer, so nothing ever rolls.
import { readFileSync } from 'node:fs';
import { Foundry } from 'file:///D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e/dist/foundry.js';
import { foundryConfig, playerConfig } from './target.mjs';

const MCP = 'D:/Workbench/FVTT/Repos/fvtt-mcp-molten5e';
const env = {};
for (const line of readFileSync(`${MCP}/.env`, 'utf8').split(/\r?\n/)) {
  if (line.trimStart().startsWith('#')) continue;
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
setTimeout(() => { console.error('[topo] WATCHDOG 240s'); process.exit(3); }, 240_000);

const gm = new Foundry(foundryConfig(env));
console.log('[topo] GM observer connecting…');
await gm.connect();

// Instrument the GM client BEFORE anything happens.
await gm.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const ledger = [];
  const note = (kind, data) => ledger.push({ t: Date.now(), kind, ...data });
  globalThis.__bfTopo = { ledger, note, hookIds: [] };

  const canAnswerForLocal = actor => {
    if (!actor) return false;
    if (actor.isOwner && !game.user.isGM) return true;
    if (game.user.isGM) return !game.users.some(u => !u.isGM && u.active
      && actor.testUserPermission(u, 'OWNER'));
    return false;
  };

  const describe = m => {
    const f = m.getFlag(MOD, 'saves');
    if (!f) return { flag: false };
    const pendingCards = uuid => game.messages.contents
      .filter(x => {
        const g = x.getFlag(MOD, 'saves');
        return g && (g.status === 'pending') && g.targets.some(t => !t.done && (t.uuid === uuid));
      })
      .sort((a, b) => a.timestamp - b.timestamp);
    return {
      flag: true, status: f.status,
      targets: (f.targets ?? []).map(t => {
        let actor = null;
        try { actor = fromUuidSync(t.uuid); } catch { /* noted below */ }
        return {
          name: t.name, done: t.done,
          canAnswer: canAnswerForLocal(actor),
          queueHead: pendingCards(t.uuid)[0]?.id ?? null
        };
      })
    };
  };

  const on = (name, fn) => globalThis.__bfTopo.hookIds.push([name, Hooks.on(name, fn)]);
  on('createChatMessage', m => note('create', { id: m.id, ...describe(m) }));
  on('updateChatMessage', (m, delta) => note('update', {
    id: m.id, deltaFlags: Object.keys(delta?.flags?.[MOD] ?? {}), ...describe(m) }));
  on('dnd5e.renderChatMessage', (m, html) => note('dnd5eRender', {
    id: m.id, htmlConnected: html?.isConnected ?? null, ...describe(m) }));
  on('renderChatMessageHTML', m => note('coreRender', { id: m.id }));

  // Reach inside the popup machinery without touching module code: every DialogV2 render
  // and rejection, and every console.error, lands in the ledger.
  const D2 = foundry.applications.api.DialogV2;
  if (!D2.prototype.__bfWrapped) {
    const orig = D2.prototype.render;
    D2.prototype.render = function(...args) {
      note('dialogRender', { title: this.options?.window?.title ?? null });
      const out = orig.apply(this, args);
      Promise.resolve(out).catch(err =>
        note('dialogRenderREJECTED', { title: this.options?.window?.title ?? null,
          err: String(err?.message ?? err) }));
      return out;
    };
    D2.prototype.__bfWrapped = true;
  }
  const origErr = console.error.bind(console);
  console.error = (...args) => {
    note('consoleError', { text: args.map(a => String(a?.message ?? a)).join(' ').slice(0, 200) });
    origErr(...args);
  };
  globalThis.__bfTopo.restoreErr = () => { console.error = origErr; };
  note('instrumented', { user: game.user.name, active: game.users.filter(u => u.active).map(u => u.name) });
  return true;
}, null);
console.log('[topo] GM instrumented');

// Fixture floor: the victim token must stand on the range (the suites' sweeps legitimately
// remove it — smoke-battleflow normally re-places it; the probe does the same minimal move).
const fixture = await gm.evaluate(async () => {
  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !victim) return { fatal: 'scene or victim actor missing' };
  let tok = scene.tokens.find(t => t.actorId === victim.id);
  if (!tok) {
    const base = (await victim.getTokenDocument()).toObject();
    base.x = Math.round(scene.dimensions.sceneX + scene.dimensions.sceneWidth / 2);
    base.y = Math.round(scene.dimensions.sceneY + scene.dimensions.sceneHeight / 2);
    [tok] = await scene.createEmbeddedDocuments('Token', [base]);
  }
  return { tokenId: tok.id };
}, null);
if (fixture.fatal) { console.error(`[topo] FATAL: ${fixture.fatal}`); process.exit(2); }
console.log(`[topo] victim token ready (${fixture.tokenId})`);

console.log('[topo] player connecting…');
const player = new Foundry(playerConfig(env));
await player.connect();

// The player builds a zero-consequence save spell on its own actor and casts it at the
// victim. The stamp runs HERE — the walk's exact topology.
const cast = await player.evaluate(async () => {
  const scene = game.scenes.getName('Battle Flow Test Range');
  const attacker = game.actors.getName('BF Test PC Attacker');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !attacker || !victim) return { fatal: 'fixtures missing' };
  if (canvas.scene?.id !== scene.id) await scene.view();
  const tok = scene.tokens.find(t => t.actorId === victim.id);
  if (!tok) return { fatal: 'no victim token (run smoke-battleflow first)' };
  await new Promise(r => { const i = setInterval(() => {
    if (canvas.ready && canvas.tokens.get(tok.id)) { clearInterval(i); r(); } }, 200); });

  const [spell] = await attacker.createEmbeddedDocuments('Item', [{
    name: 'BF Topology Probe Save', type: 'spell',
    system: {
      level: 1, school: 'evo', method: 'innate', prepared: 1,
      activation: { type: 'action' }, duration: { units: 'inst' },
      range: { units: 'ft', value: '60' },
      target: { affects: { type: 'creature', count: '1' } },
      activities: {
        dnd5eactivity000: {
          _id: 'dnd5eactivity000', type: 'save',
          activation: { type: 'action', override: false },
          save: { ability: ['con'], dc: { calculation: '', formula: '14' } },
          damage: { onSave: 'half', parts: [] },
          effects: [], consumption: { targets: [], spellSlot: false }
        }
      }
    }
  }]);
  const activity = spell.system.activities?.contents?.[0];
  if (!activity) return { fatal: 'no activity on probe spell' };
  canvas.tokens.get(tok.id).setTarget(true, { releaseOthers: true });
  await new Promise(r => setTimeout(r, 150));
  const usage = await activity.use({}, { configure: false }, {});
  const msg = usage?.message ?? null;
  await new Promise(r => setTimeout(r, 500));
  const flag = msg ? game.messages.get(msg.id)?.getFlag('fvtt-mod-battleflow', 'saves') : null;
  return { spellId: spell.id, messageId: msg?.id ?? null,
    stamped: !!flag, status: flag?.status ?? null, user: game.user.name };
}, null);
if (cast.fatal) { console.error(`[topo] FATAL: ${cast.fatal}`); process.exit(2); }
console.log(`[topo] player "${cast.user}" cast: message ${cast.messageId}, stamped=${cast.stamped} (${cast.status})`);

// Let the GM client digest for 8 seconds (well inside the 15s window), then read the ledger.
await new Promise(r => setTimeout(r, 8000));

const result = await gm.evaluate(async ({ messageId }) => {
  const dialogs = Array.from(document.querySelectorAll('.application.dialog, dialog.application'))
    .map(d => d.querySelector('.window-title')?.textContent?.trim() ?? d.id);
  const msg = game.messages.get(messageId);
  const row = document.querySelector(`[data-message-id="${messageId}"] .battleflow-saves`);
  const bars = document.querySelectorAll(`[data-message-id="${messageId}"] [data-bf-deadline]`).length;
  return {
    ledger: globalThis.__bfTopo.ledger,
    domDialogs: dialogs,
    rowInDOM: !!row, barsInDOM: bars,
    flagNow: msg?.getFlag('fvtt-mod-battleflow', 'saves') ?? null
  };
}, { messageId: cast.messageId });

// Cleanup: card first (disarms the timer), then the spell; restore instrumentation.
await gm.evaluate(async ({ messageId }) => {
  for (const [name, id] of globalThis.__bfTopo.hookIds) Hooks.off(name, id);
  globalThis.__bfTopo.restoreErr?.();
  const m = game.messages.get(messageId);
  if (m) await m.delete();
  return true;
}, { messageId: cast.messageId });
await player.evaluate(async ({ spellId }) => {
  game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
  const spell = game.actors.getName('BF Test PC Attacker')?.items.get(spellId);
  if (spell) await spell.delete();
  return true;
}, { spellId: cast.spellId });

console.log(`[topo] GM DOM dialogs open: ${JSON.stringify(result.domDialogs)}`);
console.log(`[topo] demand row in GM DOM: ${result.rowInDOM}, bars: ${result.barsInDOM}`);
console.log(`[topo] flag at read: ${JSON.stringify(result.flagNow?.status)} targets=${
  JSON.stringify(result.flagNow?.targets?.map(t => ({ done: t.done, timedOut: t.timedOut ?? false })))}`);
console.log('[topo] ledger:');
for (const e of result.ledger) {
  const { t, kind, ...rest } = e;
  console.log(`  ${new Date(t).toISOString().slice(11, 23)} ${kind.padEnd(20)} ${JSON.stringify(rest)}`);
}
await player.disconnect?.();
await gm.disconnect?.();
process.exit(0);
