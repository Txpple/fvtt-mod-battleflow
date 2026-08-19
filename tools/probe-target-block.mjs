// One-shot probe: does the roll dialog grow a target block, and does it say the right things?
// (FLOW item 2.) The suites all roll with `configure: false`, so NO suite ever renders a roll
// dialog and nothing else would catch a broken hook.
//
// ⚠ HARNESS TIMING, measured 2026-08-19 — the dialog DOES auto-render here, but it takes
// roughly NINE SECONDS to appear (Chrome throttles timers in a backgrounded page). Fixed waits
// of 700ms and 3s both found nothing and read as "the hook is broken". POLL, never sleep a
// guess. `activity.rollAttack(..., {configure: true}, ...)` also never resolves — it is
// waiting for a human to press a button — so it is fired and left pending on purpose.
//
// ApplicationV2 fires render hooks for every class in the inheritance chain, so hooking
// `renderRollConfigurationDialog` covers AttackRollConfigurationDialog and friends.
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
setTimeout(() => { console.error('[probe-block] WATCHDOG 300s'); process.exit(3); }, 300_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
console.log('[probe-block] connected');

const out = await f.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const D = CONST.TOKEN_DISPOSITIONS;
  const rep = { steps: [], classes: [] };

  const attacker = game.actors.getName('BF Test PC Attacker');
  const activity = attacker?.items.find(i => i.name === 'Longsword')
    ?.system.activities.contents.find(a => a.type === 'attack');
  if (!activity) return { fatal: 'no Longsword attack activity on BF Test PC Attacker' };

  const tokens = canvas.tokens.placeables.filter(t => t.actor);
  const pick = d => tokens.find(t => t.document.disposition === d);
  const hostile = pick(D.HOSTILE), friendly = pick(D.FRIENDLY), neutral = pick(D.NEUTRAL);
  rep.available = { hostile: hostile?.document.name, friendly: friendly?.document.name,
    neutral: neutral?.document.name };

  const apps = () => [...foundry.applications.instances.values()]
    .filter(a => /RollConfig/i.test(a.constructor.name));
  const killAll = async () => { for (const a of apps()) { try { await a.close({ force: true }); } catch {} } await sleep(300); };

  /** Open the real dialog app, then render it ourselves (see the harness note above). */
  const openDialog = async () => {
    await killAll();
    activity.rollAttack({}, { configure: true }, {});   // fired, left pending — see the note above
    for (let i = 0; i < 20; i++) {                      // ~9s typical, 20s ceiling
      await sleep(1000);
      const app = apps()[0];
      if (app?.rendered) { rep.classes.push(app.constructor.name); await sleep(300); return app; }
    }
    return null;
  };
  const read = app => {
    const block = app?.element?.querySelector('.battleflow-target-block');
    return {
      count: app?.element?.querySelectorAll('.battleflow-target-block').length ?? 0,
      heading: block?.firstChild?.textContent?.trim() ?? null,
      rows: block ? [...block.children].slice(1).map(r => r.innerText.replace(/\s+/g, ' ').trim()) : [],
      glyphs: block ? [...block.querySelectorAll('i')].map(i => `${i.className} ${i.style.color}`) : [],
      portraits: block ? [...block.querySelectorAll('img')].map(i => ({
        src: (i.getAttribute('src') ?? '').split('/').pop(), cls: i.className,
        border: i.style.border, size: `${i.style.width}x${i.style.height}`, alt: i.alt })) : [],
      belowButtons: block ? !!block.previousElementSibling : null
    };
  };

  // 1. two targets, mixed disposition
  game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
  hostile?.setTarget(true, { releaseOthers: false });
  friendly?.setTarget(true, { releaseOthers: false });
  let app = await openDialog();
  rep.steps.push({ name: 'two targets (hostile + friendly)', ...read(app) });

  // 2. LIVE REPAINT — re-target on canvas while the dialog stands (fires no dialog re-render)
  friendly?.setTarget(false, { releaseOthers: false });
  await sleep(600);
  rep.steps.push({ name: 'ally untargeted on canvas, dialog still open', ...read(app) });

  // 3. IDEMPOTENCE — a re-render must never leave two blocks
  await app?.render();
  await sleep(500);
  rep.steps.push({ name: 'after a re-render (count must stay 1)', ...read(app) });

  // 4. the ZERO case
  game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
  app = await openDialog();
  rep.steps.push({ name: 'no targets at all', ...read(app) });

  // 5. neutral disposition wording
  if (neutral) {
    neutral.setTarget(true, { releaseOthers: true });
    app = await openDialog();
    rep.steps.push({ name: 'a neutral target', ...read(app) });
  }

  await killAll();
  game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
  return rep;
});

if (out.fatal) { console.error('[probe-block] FATAL:', out.fatal); process.exit(2); }
console.log('\n[probe-block] tokens:', JSON.stringify(out.available));
console.log('[probe-block] dialog classes exercised:', JSON.stringify([...new Set(out.classes)]));
let bad = 0;
for (const s of out.steps) {
  console.log(`\n--- ${s.name} ---`);
  console.log(`   blocks in dialog: ${s.count}${s.count === 1 ? '' : '   <-- MUST BE 1'}`);
  console.log(`   heading: ${JSON.stringify(s.heading)}`);
  for (const r of s.rows) console.log(`   row: ${JSON.stringify(r)}`);
  for (const g of s.glyphs) console.log(`   glyph: ${g}`);
  for (const pt of s.portraits) console.log(`   portrait: ${pt.src} [${pt.size}] class="${pt.cls}" border=${pt.border} alt=${pt.alt}`);
  console.log(`   sits after earlier dialog content: ${s.belowButtons}`);
  if (s.count !== 1) bad++;
}
console.log(bad ? `\n[probe-block] ${bad} STEP(S) WRONG` : '\n[probe-block] every step rendered exactly one block');
process.exit(0);
