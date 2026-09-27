// Standing contract check: popup routing across two clients (ARCHITECTURE.md §5: the popup goes to
// whoever owns the decision; canAnswerFor decides). A save demand cast from a PLAYER client must
// pop on the client that owns the decision, which no single-client suite can see.
// A ledger covers every link (hooks, flag visibility, canAnswerFor, queue head, DialogV2 renders
// and rejections, DOM dialogs) and prints in full; the assertions make an unread run count.
// Fixture: a temporary no-damage, no-effect save spell on BF Test PC Attacker, cast at BF Test
// Victim; the card is deleted before the buzzer, so nothing rolls. Read-only enough to run beside
// a live session (the mutating cross-client scenarios live in `smoke-twoclient.mjs`).
import { connectSuite, disposeSafely, loadEnv } from './harness.mjs';
import { playerConfig } from './target.mjs';
import { Foundry } from 'fvtt-mcp-dnd5e/client';

// The coverage map (tools/coverage-map.mjs parses this; `npm run coverage` checks it both ways).
// ⚠ NEVER import a suite: it connects on evaluation.
export const COVERS = [
  'saves/index.js',         // a player-cast demand's popup routes to whoever decides
  'saves/demand.js',
  'saves/ask.js',
  'saves/views.js'
];

const env = loadEnv();
const gm = await connectSuite({ tag: 'topo', watchdogMs: 240_000 });

let failures = 0;
const report = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

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

  // Ledger every DialogV2 render and rejection and every console.error, without touching module code.
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

// Fixture floor: the victim token must stand on the range (other suites' sweeps remove it).
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

// The player builds a zero-consequence save spell and casts it at the victim: the stamp runs on the player client.
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

// ⚠ The player's DOM is read too: "the GM got the popup" means something only beside "and the player did not".
const playerSide = await player.evaluate(async ({ messageId }) => {
  const dialogs = Array.from(document.querySelectorAll('.application.dialog, dialog.application'))
    .map(d => d.querySelector('.window-title')?.textContent?.trim() ?? d.id);
  const msg = game.messages.get(messageId);
  return {
    user: game.user.name,
    domDialogs: dialogs,
    sawFlag: !!msg?.getFlag('fvtt-mod-battleflow', 'saves'),
    rowInDOM: !!document.querySelector(`[data-message-id="${messageId}"] .battleflow-saves`)
  };
}, { messageId: cast.messageId });

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
  game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
  const spell = game.actors.getName('BF Test PC Attacker')?.items.get(spellId);
  if (spell) await spell.delete();
  return true;
}, { spellId: cast.spellId });

/* --- the assertions: properties no single-client suite can reach, read off the ledger and both DOMs. */
const ledger = result.ledger ?? [];
const seenOnGM = ledger.filter(e => (e.id === cast.messageId) && e.flag);
const decisionRow = seenOnGM.flatMap(e => e.targets ?? []).filter(t => t.name);
const gmCanAnswer = decisionRow.some(t => t.canAnswer === true);
// The ask is the system's own dialog ('Constitution Saving Throw'), so the match is the stem.
const saveDialogOn = list => list.some(t => /sav|BF Topology/i.test(t ?? ''));

console.log('\n[topo] assertions');
report('the PLAYER client stamped the demand — the stamp runs where the cast happened',
  cast.stamped === true, `stamped=${cast.stamped} status=${cast.status} by "${cast.user}"`);
report('the flag REPLICATED to the GM client (a create or update carrying it)',
  seenOnGM.length > 0, `${seenOnGM.length} ledger entries carry the flag`);
report('canAnswerFor on the GM client claims the decision — the target has no active player owner',
  gmCanAnswer, JSON.stringify(decisionRow.slice(0, 3)));
report('the popup opened on the GM client — the one that owns the decision',
  saveDialogOn(result.domDialogs) || ledger.some(e => e.kind === 'dialogRender'),
  `dom=${JSON.stringify(result.domDialogs)} renders=${ledger.filter(e => e.kind === 'dialogRender').length}`);
report('the popup did NOT open on the player client — it owns neither the target nor the call',
  !saveDialogOn(playerSide.domDialogs),
  `player "${playerSide.user}" dialogs=${JSON.stringify(playerSide.domDialogs)}`);
report('the public row rendered on the GM client, with a draining bar',
  result.rowInDOM && (result.barsInDOM > 0),
  `row=${result.rowInDOM} bars=${result.barsInDOM}`);
report('nothing in the popup machinery rejected or logged an error',
  !ledger.some(e => (e.kind === 'dialogRenderREJECTED') || (e.kind === 'consoleError')),
  JSON.stringify(ledger.filter(e => /REJECTED|consoleError/.test(e.kind)).slice(0, 3)));

console.log(`\n[topo] GM DOM dialogs open: ${JSON.stringify(result.domDialogs)}`);
console.log(`[topo] demand row in GM DOM: ${result.rowInDOM}, bars: ${result.barsInDOM}`);
console.log(`[topo] flag at read: ${JSON.stringify(result.flagNow?.status)} targets=${
  JSON.stringify(result.flagNow?.targets?.map(t => ({ done: t.done, timedOut: t.timedOut ?? false })))}`);
console.log('[topo] ledger:');
for (const e of result.ledger) {
  const { t, kind, ...rest } = e;
  console.log(`  ${new Date(t).toISOString().slice(11, 23)} ${kind.padEnd(20)} ${JSON.stringify(rest)}`);
}
await disposeSafely(player, 'topo');
await gm.disconnect?.();
console.log(failures ? `\n[topo] ${failures} FAILURE(S)` : '\n[topo] ALL PASS');
process.exit(failures ? 1 : 0);
