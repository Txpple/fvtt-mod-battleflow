// VERIFY the player-rolled damage popup (FLOW item 3, Pass B): the attacker is OFFERED their
// own damage roll instead of having it taken, the offer says when the hit was a CRITICAL, and
// every way out of the popup ends in the same roll.
//
// ⚠ Run `smoke-battleflow` FIRST — this rides its BF Test Attacker / BF Test Victim fixtures.
//
// Eleven assertions:
//   1  setting OFF          -> damage auto-rolls as before, NO popup            (no regression)
//   2  setting ON           -> popup opens and damage does NOT roll yet
//   3  two targets hit      -> exactly ONE popup (per ATTACK, never per target)
//   4  non-crit             -> no crit badge, button reads "Roll Damage"
//   5  crit                 -> badge + "Roll Critical Damage" + critical window title
//   6  button pressed       -> damage rolls, stamped originatingMessage, crit honoured
//   7  dismissed (X/Esc)    -> damage rolls IMMEDIATELY, not at the buzzer
//   8  left alone           -> the buzzer rolls it (the damageTimer window, waited out for real)
//  10  pending offer        -> walk-4 (w): damageOffer flag stamped AND the card runs the bar
//  11  after the roll       -> walk-4 (w): the offer flag folds to done (the card's bar drops)
//
// ⚠ THE CRIT LEVER IS A DECOY TRAP, measured 2026-08-19 and the reason assertion 5 exists in
// this shape. `D20Roll#isCritical` is `this.d20.isCriticalSuccess`, and D20Die reads
// `this.options.criticalSuccess` — the DIE TERM's options. The ROLL also carries an
// `options.criticalSuccess`, it is numeric, it looks exactly like the lever, and setting it
// changes NOTHING. The probe asserts both halves so the decoy can never be mistaken for the
// real one again, and prints the getter's own reading if 5.3.x ever moves it.
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
setTimeout(() => { console.error('[playerdmg] WATCHDOG 300s'); process.exit(3); }, 300_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
// One GM-capable client, and it must be us — a second one steals the elect and this probe
// would assert on popups opening somewhere it cannot see (target.mjs, preflightSoleGM).
const who = await preflightSoleGM(f);
console.log(`[playerdmg] connected as "${who.self}"; elect = ${who.elect}`);

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [];

  const attacker = game.actors.getName('BF Test Attacker');
  const victim = game.actors.getName('BF Test Victim');
  if (!attacker || !victim) return { fatal: 'BF Test fixtures missing — run smoke-battleflow first' };

  const scene = game.scenes.getName('Battle Flow Test Range') ?? canvas.scene;
  if (scene && (canvas.scene?.id !== scene.id)) { await scene.view(); await sleep(1200); }

  const vTokens = canvas.tokens.placeables.filter(t => t.actor?.id === victim.id);
  if (!vTokens.length) return { fatal: 'BF Test Victim has no token — re-run smoke-battleflow' };

  const activity = attacker.items.contents
    .flatMap(i => i.system.activities?.contents ?? [])
    .find(a => a.type === 'attack');
  if (!activity) return { fatal: 'BF Test Attacker has no attack activity' };

  // Prior state, restored in full at the end.
  const prior = {
    autoDamage: game.settings.get(MOD, 'autoDamage'),
    autoApply: game.settings.get(MOD, 'autoApply'),
    dramaticBeat: game.settings.get(MOD, 'dramaticBeat'),
    reactionHold: game.settings.get(MOD, 'reactionHold'),
    riders: game.settings.get(MOD, 'riders'),
    masteryRiders: game.settings.get(MOD, 'masteryRiders'),
    playerRollDamage: game.settings.get(MOD, 'playerRollDamage'),
    damageTimer: game.settings.get(MOD, 'damageTimer'),
    victimAC: foundry.utils.deepClone(victim.system._source.attributes.ac)
  };
  await game.settings.set(MOD, 'autoDamage', 'all');
  await game.settings.set(MOD, 'damageTimer', 15);   // section 8 waits this window out for real
  await game.settings.set(MOD, 'autoApply', false);   // the roll is what is under test, not the application
  await game.settings.set(MOD, 'dramaticBeat', 0);
  await game.settings.set(MOD, 'reactionHold', false);
  await game.settings.set(MOD, 'riders', false);
  await game.settings.set(MOD, 'masteryRiders', false);
  // Force the hit the way smoke-battleflow does: flat AC 1 on the base actor.
  await victim.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 1 });

  const created = [];   // every message this probe makes, deleted at the end

  /** Our popup, found by its eyebrow — the one string no other dialog in this module carries. */
  const popupEls = () => [...document.querySelectorAll('.application')]
    .filter(el => (el.innerHTML ?? '').includes('Damage &mdash; your roll')
               || (el.innerHTML ?? '').includes('Damage — your roll'));

  const closeAllPopups = async () => {
    for (const el of popupEls()) {
      const btn = el.querySelector('[data-action="close"]') ?? el.querySelector('.header-control');
      try { btn?.click(); } catch {}
    }
    await sleep(400);
  };

  /** Roll one attack at `targets` and return its usage + attack message. */
  const attack = async (targets) => {
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
    await sleep(150);
    targets.forEach((t, i) => t.setTarget(true, { releaseOthers: i === 0 }));
    await sleep(250);
    const before = game.messages.size;
    const results = await activity.use({ subsequentActions: false }, { configure: false }, {});
    const usageId = results?.message?.id ?? null;
    const rolls = await activity.rollAttack({ advantage: true }, { configure: false },
      { data: { 'flags.dnd5e.originatingMessage': usageId } });
    await sleep(150);
    const fresh = game.messages.contents.slice(before);
    created.push(...fresh.map(m => m.id));
    const attackMsg = fresh.find(m => m.getFlag('dnd5e', 'roll.type') === 'attack')
      ?? rolls?.[0]?.parent ?? null;
    return { usageId, attackMsg, total: rolls?.[0]?.total ?? null };
  };

  /** Did a damage message land for this usage? */
  const damageFor = usageId => game.messages.contents.slice(-25).find(m =>
    (m.getFlag('dnd5e', 'roll.type') === 'damage')
    && (m.getFlag('dnd5e', 'originatingMessage') === usageId));

  const waitDamage = async (usageId, ms) => {
    for (let i = 0; i < Math.ceil(ms / 250); i++) {
      const d = damageFor(usageId);
      if (d) { created.push(d.id); return d; }
      await sleep(250);
    }
    return null;
  };

  const results = [];
  const one = [vTokens[0]];

  // ⚠ A second target needs a DISTINCT ACTOR, not a second token of the same one: descriptors
  // key on the actor uuid, so two tokens of one linked actor collapse to a single snapshot row
  // and "one popup for two targets" becomes unanswerable (the Practice Dummy trap, HANDOFF
  // 2026-08-19). Created hidden, at AC 1 so it is always hit, and deleted in teardown.
  const [extra] = await Actor.createDocuments([{
    name: 'BF Probe Second Target', type: 'npc',
    system: { attributes: { hp: { value: 30, max: 30 }, ac: { flat: 1, calc: 'flat' } } }
  }]);
  const [extraTokDoc] = await canvas.scene.createEmbeddedDocuments('Token', [{
    name: 'BF Probe Second Target', actorId: extra.id, actorLink: true,
    x: canvas.grid.size * 3, y: canvas.grid.size * 3, hidden: true, disposition: -1
  }]);
  await sleep(400);
  const two = extraTokDoc?.object ? [vTokens[0], extraTokDoc.object] : one;

  /* 1 — setting OFF: nothing changes. -------------------------------------------------- */
  await game.settings.set(MOD, 'playerRollDamage', false);
  {
    const { usageId } = await attack(one);
    const dmg = await waitDamage(usageId, 6000);
    results.push({ n: 1, name: 'OFF — auto-rolls, no popup',
      pass: !!dmg && (popupEls().length === 0),
      detail: `damage=${!!dmg} popups=${popupEls().length}` });
    await closeAllPopups();
  }

  /* 2 — setting ON: the popup opens and the dice WAIT. --------------------------------- */
  await game.settings.set(MOD, 'playerRollDamage', true);
  let critLever = null;
  {
    const { usageId, attackMsg } = await attack(one);
    await sleep(1200);
    const popups = popupEls();
    const early = damageFor(usageId);
    results.push({ n: 2, name: 'ON — popup opens, damage waits',
      pass: (popups.length === 1) && !early,
      detail: `popups=${popups.length} damageAlready=${!!early}` });

    /* 10 — (w): the wait is a TABLE moment — flag stamped, bar on the card too. --------- */
    const offer = attackMsg?.getFlag(MOD, 'damageOffer');
    const cardBar = attackMsg ? document.querySelector(
      `[data-message-id="${attackMsg.id}"] .battleflow-damage-offer [data-bf-deadline]`) : null;
    results.push({ n: 10, name: '(w) pending offer — flag stamped, draining bar on the card',
      pass: (offer?.status === 'pending') && (offer?.window === 15)
            && ((offer?.deadline ?? 0) > Date.now()) && !!cardBar,
      detail: `flag=${JSON.stringify(offer ?? null)} cardBarDOM=${!!cardBar}` });

    /* 4 — a normal hit: NO crit badge, and the CELEBRATION title ((l), round 3). -------- */
    const html = popups[0]?.innerHTML ?? '';
    const label = popups[0]?.querySelector('button[data-action="roll"]')?.textContent?.trim() ?? '';
    const title4 = popups[0]?.querySelector('.window-title')?.textContent ?? '';
    const wasCrit = attackMsg?.rolls?.[0]?.isCritical ?? null;
    results.push({ n: 4, name: 'non-crit — no badge, plain label, "You hit!" celebrates',
      // Only meaningful when the roll genuinely was not a crit; advantage crits ~10% of the time.
      pass: wasCrit === false ? (!html.includes('Critical Hit') && /Roll Damage/i.test(label)
              && /You hit/i.test(title4)) : true,
      detail: `isCritical=${wasCrit} label="${label}" title="${title4}" badge=${html.includes('Critical Hit')}`
            + (wasCrit ? ' (rolled a crit — assertion skipped, rerun)' : '') });

    /* 4b — (hh), v1.20.0 walk 1: the "Against …" line names each target WITH its token
     * icon (law-8 tooltip = the name), so the roll popup stopped being the one volley-family
     * surface that named targets in text alone. The icon sits directly before its own
     * <strong>name</strong>, which is how it is told apart from the bfCard portrait. */
    const aimIcon = [...(popups[0]?.querySelectorAll('img[data-tooltip]') ?? [])].find(img =>
      (img.nextElementSibling?.tagName === 'STRONG')
      && (img.dataset.tooltip === img.nextElementSibling.textContent));
    results.push({ n: '4b', name: '(hh) the Against line carries the target token icon, tooltip = name',
      pass: !!aimIcon,
      detail: aimIcon ? `icon for "${aimIcon.dataset.tooltip}"` : 'no icon+name pair in the popup' });

    /* 6 — pressing the button rolls it, stamped and crit-honest. ----------------------- */
    popups[0]?.querySelector('button[data-action="roll"]')?.click();
    const dmg = await waitDamage(usageId, 8000);
    results.push({ n: 6, name: 'button pressed — rolls, stamped',
      pass: !!dmg && (dmg.getFlag('dnd5e', 'originatingMessage') === usageId)
            && ((dmg.rolls?.[0]?.isCritical ?? false) === (wasCrit ?? false)),
      detail: `damage=${!!dmg} origin=${dmg?.getFlag('dnd5e', 'originatingMessage') === usageId}`
            + ` attackCrit=${wasCrit} damageCrit=${dmg?.rolls?.[0]?.isCritical ?? null}` });

    /* 11 — (w): the roll folds the offer — the card's bar has nothing left to draw. ----- */
    await sleep(400);   // the done-write is fire-and-forget behind the roll
    const offerAfter = attackMsg?.getFlag(MOD, 'damageOffer');
    results.push({ n: 11, name: '(w) rolled — the offer flag folds to done',
      pass: offerAfter?.status === 'done',
      detail: `status=${offerAfter?.status ?? null}` });
    await closeAllPopups();
  }

  /* 5 — CRIT: the decoy proven dead, then the real lever, then the badge. ------------- */
  {
    // Bounded retry for a NON-crit start: the decoy pin is only meaningful when the roll
    // begins isCritical=false, and advantage crits ~10% of the time (flaked 2026-08-20).
    let attackMsg = null;
    for (let try9 = 0; try9 < 4; try9++) {
      ({ attackMsg } = await attack(one));
      await sleep(900);
      await closeAllPopups();   // the popup this attack raised is not the one under test
      if ((attackMsg?.rolls?.[0]?.isCritical ?? null) === false) break;
    }

    const roll = attackMsg?.rolls?.[0];
    const critBefore = roll?.isCritical ?? null;

    // (a) THE DECOY. The roll's own criticalSuccess is numeric and looks authoritative.
    const rollOpts = Object.keys(roll?.options ?? {}).join(',');
    if (roll?.options) roll.options.criticalSuccess = 1;
    const afterDecoy = roll?.isCritical ?? null;

    // (b) THE REAL LEVER: the D20 TERM's options, which is what the getter actually reads.
    const dieOpts = Object.keys(roll?.d20?.options ?? {}).join(',');
    if (roll?.d20?.options) roll.d20.options.criticalSuccess = 1;
    const afterReal = roll?.isCritical ?? null;

    critLever = { critBefore, afterDecoy, afterReal, rollOpts, dieOpts,
      decoyIsDead: afterDecoy === false, realWorks: afterReal === true };
    log.push(`crit lever: isCritical ${critBefore} -> decoy(roll.options) ${afterDecoy}`
           + ` -> real(roll.d20.options) ${afterReal}`);
    log.push(`  roll.options=[${rollOpts}]`);
    log.push(`  roll.d20.options=[${dieOpts}]`);

    results.push({ n: 9, name: 'the roll-level criticalSuccess is a DECOY (pins the trap)',
      // Only meaningful from a non-crit start; four natural crits in a row skips it (rerun).
      pass: (critBefore === false) ? critLever.decoyIsDead : true,
      detail: `roll.options.criticalSuccess=1 left isCritical=${afterDecoy} (must be false)`
            + ((critBefore !== false) ? ' (started critical — assertion skipped, rerun)' : '') });

    if (critLever.realWorks) {
      const mod = await import('/modules/fvtt-mod-battleflow/scripts/auto-damage.js');
      await mod.offerDamageRoll(activity, attackMsg);
      await sleep(900);
      const popups = popupEls();
      const html = popups[0]?.innerHTML ?? '';
      const label = popups[0]?.querySelector('button[data-action="roll"]')?.textContent?.trim() ?? '';
      const title = popups[0]?.querySelector('.window-title')?.textContent ?? '';
      results.push({ n: 5, name: 'crit — badge, label and title all say so',
        pass: (popups.length === 1) && html.includes('Critical Hit')
              && /Roll Critical Damage/i.test(label) && /Critical/i.test(title),
        detail: `popups=${popups.length} badge=${html.includes('Critical Hit')} label="${label}" title="${title}"` });
      await closeAllPopups();
    } else {
      results.push({ n: 5, name: 'crit — badge, label and title all say so',
        pass: false, detail: `the die-level lever did not flip isCritical: ${JSON.stringify(critLever)}` });
    }
    await sleep(1500);
  }

  /* 3 — two targets, ONE popup. --------------------------------------------------------- */
  {
    const { usageId, attackMsg } = await attack(two);
    await sleep(1200);
    const popups = popupEls();
    const hits = attackMsg ? (attackMsg.getFlag('dnd5e', 'targets') ?? []).length : 0;
    results.push({ n: 3, name: 'two targets hit — exactly ONE popup',
      pass: (popups.length === 1) && (hits >= 2),
      detail: `targeted=${two.length} snapshot=${hits} popups=${popups.length}` });

    /* 7 — dismissing rolls IMMEDIATELY, not at the buzzer. ----------------------------- */
    await closeAllPopups();
    const dmg = await waitDamage(usageId, 5000);   // well inside the 15s window
    results.push({ n: 7, name: 'dismissed — rolls immediately, not at the buzzer',
      pass: !!dmg, detail: `damage within 5s of dismissal = ${!!dmg}` });
  }

  /* 8 — the buzzer. Waited out for real. ------------------------------------------------ */
  {
    const { usageId } = await attack(one);
    await sleep(1200);
    const opened = popupEls().length;
    const at5 = !!damageFor(usageId);
    const dmg = await waitDamage(usageId, 20000);   // the window is 15s
    results.push({ n: 8, name: 'left alone — the buzzer rolls it',
      pass: (opened === 1) && !at5 && !!dmg,
      detail: `popup=${opened} rolledEarly=${at5} rolledByBuzzer=${!!dmg}` });
    await closeAllPopups();
  }

  /* teardown ---------------------------------------------------------------------------- */
  await closeAllPopups();
  game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
  await ChatMessage.deleteDocuments([...new Set(created)].filter(id => game.messages.has(id)))
    .catch(() => {});
  if (extraTokDoc) await canvas.scene.deleteEmbeddedDocuments('Token', [extraTokDoc.id]).catch(() => {});
  if (extra) await extra.delete().catch(() => {});
  await victim.update({
    'system.attributes.ac.calc': prior.victimAC?.calc ?? 'default',
    'system.attributes.ac.flat': prior.victimAC?.flat ?? null
  }).catch(() => {});
  for (const [k, v] of Object.entries(prior)) {
    if (k === 'victimAC') continue;
    await game.settings.set(MOD, k, v);
  }
  const restored = {
    autoDamage: game.settings.get(MOD, 'autoDamage'),
    autoApply: game.settings.get(MOD, 'autoApply'),
    playerRollDamage: game.settings.get(MOD, 'playerRollDamage')
  };
  return { scene: canvas.scene?.name, victimTokens: vTokens.length, critLever, log, results, restored, prior };
});

if (out.fatal) { console.error('[playerdmg] FATAL:', out.fatal); process.exit(2); }
console.log(`\n[playerdmg] scene "${out.scene}", ${out.victimTokens} victim token(s)`);
for (const l of out.log) console.log(`  · ${l}`);

let bad = 0;
for (const r of out.results.sort((a, b) => a.n - b.n)) {
  if (!r.pass) bad++;
  console.log(`\n  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}. ${r.name}`);
  console.log(`        ${r.detail}`);
}
console.log(`\n[playerdmg] settings restored: ${JSON.stringify(out.restored)}`);
console.log(bad ? `\n[playerdmg] ${bad} of ${out.results.length} WRONG`
                : `\n[playerdmg] ${out.results.length}/${out.results.length} — the offer holds, and the crit says so`);
process.exit(bad ? 1 : 0);
