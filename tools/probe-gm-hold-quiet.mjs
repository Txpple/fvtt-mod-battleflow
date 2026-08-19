// One-shot probe: does the GM still get spammed with a PLAYER-OWNED target's hold popup?
// User, 2026-08-19: "As a DM, I shouldn't see Gren's shield popup. DM doesn't want to be
// spammed with player popups. DM can just see the card timer tick."
//
// The rule is the save machine's, restated for the hold: the GM's UNSOLICITED popups are
// non-player-owned targets only (v1.12.0 finding ④). saves.js and mastery.js have carried
// `gmQuiet` since; the hold never got it. canAnswerFor falls back to the GM when a
// player-owned actor's owner is OFFLINE — which is exactly the case that spams a DM testing
// alone, and why this looked fine for as long as the players were logged in.
//
// Asserts, in order: the hold still STAMPS (quiet must not mean broken), no popup opens for
// the player-owned target, the card still renders its row so the DM can watch the timer, and
// the card's Answer button still recalls the popup deliberately.
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
setTimeout(() => { console.error('[gm-quiet] WATCHDOG 180s'); process.exit(3); }, 180_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[gm-quiet] connected');

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rep = { made: [] };

  // ⚠ Resolve Gren THROUGH HIS TOKEN. game.actors.getName('Gren') is null — the token is
  // named "Gren" while the actor carries a longer name, and looking him up by actor name
  // fails silently in a way that reads like a missing fixture.
  const grenToken = canvas.tokens.placeables.find(t => t.document.name === 'Gren' && t.actor);
  const gren = grenToken?.actor;
  const attacker = game.actors.getName('BF Test PC Attacker');
  const activity = attacker?.items.find(i => i.name === 'Longsword')
    ?.system.activities.contents.find(a => a.type === 'attack');
  if (!gren || !activity || !grenToken) return { fatal: 'missing Gren / attacker / token',
    saw: { gren: !!gren, activity: !!activity, token: !!grenToken } };
  rep.grenActor = gren.name;

  // The preconditions the whole rule turns on.
  rep.pre = {
    isGM: game.user.isGM,
    grenHasPlayerOwner: !!gren.hasPlayerOwner,
    activeNonGMOwner: game.users.some(u => !u.isGM && u.active && gren.testUserPermission(u, 'OWNER')),
    reactionHold: game.settings.get(MOD, 'reactionHold')
  };

  const openHoldDialogs = () => [...foundry.applications.instances.values()]
    .filter(a => a.rendered && /DialogV2/i.test(a.constructor.name)
      && /shield/i.test(a.options?.window?.title ?? a.title ?? ''));

  const baseAC = gren.system.attributes.ac.value;
  let atk = null;
  for (let i = 0; i < 40 && !atk; i++) {
    grenToken.setTarget(true, { releaseOthers: true });
    const usage = await activity.use({ subsequentActions: false }, { configure: false }, {});
    const rolls = await activity.rollAttack({}, { configure: false },
      { data: { 'flags.dnd5e.originatingMessage': usage?.message?.id } });
    const r = rolls?.[0];
    if (usage?.message?.id) rep.made.push(usage.message.id);
    if (r?.parent?.id) rep.made.push(r.parent.id);
    // The band where Shield's +5 would actually flip the outcome — that is when a hold stamps.
    if (r && !r.isCritical && !r.isFumble && (r.total >= baseAC) && (r.total < baseAC + 5)) {
      atk = { msg: r.parent, total: r.total };
    } else await sleep(120);
  }
  if (!atk) return { ...rep, fatal: `no attack landed in [${baseAC}, ${baseAC + 4}]` };
  rep.attackTotal = atk.total;
  rep.baseAC = baseAC;

  await sleep(2500);
  const hold = game.messages.get(atk.msg.id)?.getFlag(MOD, 'hold');
  rep.holdStamped = !!hold;
  rep.holdStatus = hold?.status ?? null;
  rep.holdTargets = (hold?.targets ?? []).map(t => t.name ?? t.uuid);

  // THE ASSERT: no unsolicited popup for the player-owned target.
  rep.popupsAfterHold = openHoldDialogs().map(a => a.options?.window?.title ?? a.title);

  // The DM must still be able to WATCH it — the card's own row and its draining bar.
  const cardEl = document.querySelector(`[data-message-id="${atk.msg.id}"]`);
  rep.cardText = (cardEl?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  // The drain bar carries no class — holdBarHTML writes inline styles and marks the moving
  // element with data-bf-deadline. That attribute IS the bar (ui.js holdBarHTML).
  const bar = cardEl?.querySelector('[data-bf-deadline]');
  rep.cardHasBar = !!bar;
  rep.barWindow = bar?.getAttribute('data-bf-window') ?? null;

  // ...and still summon it DELIBERATELY.
  const answerBtn = [...(cardEl?.querySelectorAll('button') ?? [])]
    .find(b => /answer/i.test(b.textContent ?? ''));
  rep.answerButtonPresent = !!answerBtn;
  if (answerBtn) {
    answerBtn.click();
    await sleep(1500);
    rep.popupsAfterAnswerClick = openHoldDialogs().map(a => a.options?.window?.title ?? a.title);
    for (const a of openHoldDialogs()) { try { await a.close(); } catch {} }
  }

  for (const id of rep.made) { try { await game.messages.get(id)?.delete(); } catch {} }
  game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
  delete rep.made;
  return rep;
});

console.log(JSON.stringify(out, null, 2));
if (out.fatal) { console.error('[gm-quiet] FATAL:', out.fatal); process.exit(2); }
const ok = out.holdStamped
  && (out.popupsAfterHold.length === 0)
  && out.cardHasBar                       // the DM must still be able to WATCH the clock
  && out.answerButtonPresent
  && (out.popupsAfterAnswerClick?.length > 0);
console.log(ok
  ? '\n[gm-quiet] PASS — hold stamped, DM got NO popup, card still watchable, Answer still recalls'
  : '\n[gm-quiet] FAIL — see the fields above');
process.exit(ok ? 0 : 1);
