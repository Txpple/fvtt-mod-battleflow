// VERIFY the player-rolled damage popup on the SAVE path — the v1.18.0 walk's one finding:
// the offer answered attacks and nothing else, so Vicious Mockery, Fireball and every area
// still rolled their dice behind the caster's back.
//
// The claim under test is narrow and load-bearing: offering the roll here costs no new
// machinery, because (a) `dnd5e.postUseActivity` already runs on the CASTING client, the same
// locality that let the attack popup skip the elect, and (b) the save slice was built
// order-independent, so a roll that lands fifteen seconds late still folds by verdict.
// Assertion 11 is the one that proves (b) with real HP, and it is the reason this probe exists
// rather than a unit test.
//
// ⚠ Self-contained: it builds its own caster, targets and spell, and deletes all three. It does
// NOT ride smoke-battleflow's fixtures (that suite's attacker has no save activity).
//
// Thirteen assertions:
//   1  setting OFF        -> the stamp auto-rolls as before, NO popup        (no regression)
//   2  setting ON         -> popup opens and the damage does NOT roll yet
//   3  onSave "half"      -> the stakes line says a save HALVES it
//   4  onSave "none"      -> the stakes line says a save AVOIDS it entirely  (Vicious Mockery)
//   5  no crit anywhere   -> no badge, plain "Roll Damage"    (a spell has no attack to crit)
//   6  button pressed     -> rolls, chained to the card, carrying roll.damageOnSave
//   7  dismissed (X/Esc)  -> rolls IMMEDIATELY, not at the buzzer
//   8  left alone         -> the buzzer rolls it (the 15s window, waited out for real)
//   9  rider damage       -> onSave "full" offers NOTHING and rolls nothing   (finding ③ fence)
//  10  two targets        -> exactly ONE popup (per CAST, never per target)
//  11  verdicts FIRST     -> a roll pressed after the saves still applies 10 / 5 by multiplier
//  12  bare-cast area     -> a WAITING demand still offers, targetless, and says why
//  13  CONTROL            -> the same ordering with the popup OFF (is the popup implicated?)
//
// ⚠ WHY 9 IS NOT PARANOIA. Rider damage (Web's burn clause, finding ③ 2026-08-17) must never
// auto-roll, and the popup rides the caller's existing `saveModulated` gate rather than
// re-testing. That is a correctness property of the WIRING, not of the popup — so it can only
// be caught here, where a mis-wired offer would visibly resurrect a closed bug.
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
setTimeout(() => { console.error('[savedmg] WATCHDOG 420s'); process.exit(3); }, 420_000);

const f = new Foundry(foundryConfig(env));
await f.connect();
// One GM-capable client, and it must be us — a second one steals the elect and this probe
// would assert on popups opening somewhere it cannot see (target.mjs, preflightSoleGM).
const who = await preflightSoleGM(f);
console.log(`[savedmg] connected as "${who.self}"; elect = ${who.elect}`);

const out = await f.evaluate(async () => {
  const MOD = 'fvtt-mod-battleflow';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [];
  const results = [];
  const ok = (n, name, pass, detail) => results.push({ n, name, pass: !!pass, detail });

  const scene = game.scenes.getName('Battle Flow Test Range') ?? canvas.scene;
  if (scene && (canvas.scene?.id !== scene.id)) { await scene.view(); await sleep(1200); }
  if (!canvas.scene) return { fatal: 'no active scene' };

  /* --- prior state, restored in full at the end ------------------------------------------ */
  const KEYS = ['saves', 'saveTimer', 'autoApply', 'autoDamage', 'reactionHold', 'riders',
    'masteryRiders', 'concMode', 'playerRollDamage', 'hideCardButtons'];
  const prior = Object.fromEntries(KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  await set('saves', true);
  await set('saveTimer', 4);          // verdicts land fast so 11 is constructible
  await set('autoApply', false);      // the ROLL is under test until 11 turns this on
  await set('reactionHold', false);
  await set('riders', false);
  await set('masteryRiders', false);
  await set('concMode', 'off');

  /* --- the fixture: one caster, two targets, four save activities ------------------------ */
  const mkNpc = (name, hp) => ({
    name, type: 'npc',
    system: { attributes: { hp: { value: hp, max: hp }, ac: { flat: 10, calc: 'flat' } } }
  });
  // ⚠ C AND D EXIST ONLY FOR ASSERTION 11. Every earlier section leaves a chained damage roll on
  // its card with `autoApply` OFF — rolled, never landed. Assertion 11 turns autoApply ON, and a
  // subsequent chat re-render lets reconcileSaveDamage sweep those older cards onto whichever
  // target they named. Targets nothing has ever cast at make the pool reading mean what it says.
  //
  // ⚠⚠ BOUND BY NAME, NEVER BY POSITION, and this cost two runs: `Actor.createDocuments` does
  // NOT return documents in the order they were passed (measured on 5.3.3 / Foundry 14.365 —
  // a five-document create came back shuffled, so `tgtC` was silently the actor named "Target
  // B" and every identity in the section was off by one). Positional destructuring of a bulk
  // create is a latent bug anywhere it appears; the lookup below makes the binding say what it
  // means.
  const made = await Actor.createDocuments([
    mkNpc('BF Probe Caster', 40), mkNpc('BF Probe Target A', 60), mkNpc('BF Probe Target B', 60),
    mkNpc('BF Probe Target C', 60), mkNpc('BF Probe Target D', 60),
    mkNpc('BF Probe Target E', 60), mkNpc('BF Probe Target F', 60)
  ]);
  const byName = n => made.find(a => a.name === n);
  const caster = byName('BF Probe Caster');
  const tgtA = byName('BF Probe Target A');
  const tgtB = byName('BF Probe Target B');
  const tgtC = byName('BF Probe Target C');
  const tgtD = byName('BF Probe Target D');
  const tgtE = byName('BF Probe Target E');
  const tgtF = byName('BF Probe Target F');
  if ([caster, tgtA, tgtB, tgtC, tgtD, tgtE, tgtF].some(a => !a)) {
    return { fatal: `fixture actors did not all create: ${made.map(a => a.name).join(' | ')}` };
  }

  const mkToken = async (actor, x) => {
    const [doc] = await canvas.scene.createEmbeddedDocuments('Token', [{
      name: actor.name, actorId: actor.id, actorLink: true,
      x: canvas.grid.size * x, y: canvas.grid.size * 4, hidden: true, disposition: -1
    }]);
    await sleep(500);
    return doc;
  };
  const tokA = await mkToken(tgtA, 3);
  const tokB = await mkToken(tgtB, 5);
  const tokC = await mkToken(tgtC, 7);
  const tokD = await mkToken(tgtD, 9);
  const tokE = await mkToken(tgtE, 11);
  const tokF = await mkToken(tgtF, 13);
  if ([tokA, tokB, tokC, tokD, tokE, tokF].some(t => !t?.object)) {
    return { fatal: 'probe target tokens never reached the canvas' };
  }

  // Flat damage so halves are exact; DC from a custom formula so it cannot drift with the
  // caster's sheet. The four activities are the four shapes the wiring has to tell apart.
  const saveBlock = { ability: ['con'], dc: { calculation: '', formula: '15' } };
  const base = { activation: { type: 'action', override: false },
    consumption: { targets: [], spellSlot: false }, effects: [] };
  const [spell] = await caster.createEmbeddedDocuments('Item', [{
    name: 'BF Probe Save Spell', type: 'spell',
    system: {
      level: 1, school: 'evo', properties: ['vocal'], duration: { units: 'inst' },
      target: { affects: { type: 'creature', count: '2', choice: false } },
      range: { value: '60', units: 'ft' },
      method: 'spell', prepared: 1, identifier: 'bf-probe-save-spell',
      activities: {
        // Fireball's shape — a save halves it.
        bfprobehalf00000: { ...base, _id: 'bfprobehalf00000', type: 'save', save: saveBlock,
          damage: { onSave: 'half', parts: [{ custom: { enabled: true, formula: '10' }, types: ['poison'] }] },
          target: { override: false, prompt: true } },
        // Vicious Mockery's shape — a save avoids it entirely.
        bfprobenone00000: { ...base, _id: 'bfprobenone00000', type: 'save', save: saveBlock,
          damage: { onSave: 'none', parts: [{ custom: { enabled: true, formula: '4' }, types: ['psychic'] }] },
          target: { override: false, prompt: true } },
        // Web's burn clause — rider damage the save does not modulate. Must never be offered.
        bfprobefull00000: { ...base, _id: 'bfprobefull00000', type: 'save', save: saveBlock,
          damage: { onSave: 'full', parts: [{ custom: { enabled: true, formula: '10' }, types: ['fire'] }] },
          target: { override: false, prompt: true } },
        // The area — cast bare, placed after. The `awaitingTemplate` corner.
        bfprobetmpl00000: { ...base, _id: 'bfprobetmpl00000', type: 'save', save: saveBlock,
          damage: { onSave: 'half', parts: [{ custom: { enabled: true, formula: '10' }, types: ['poison'] }] },
          target: { override: true, prompt: true,
            template: { type: 'cube', size: '10', units: 'ft', count: '' },
            affects: { type: 'creature', count: '', choice: false } } }
      }
    }
  }]);

  const act = id => caster.items.get(spell.id).system.activities.get(id);
  const created = [];
  const snap = () => new Set(game.messages.contents.map(m => m.id));
  const fresh = before => game.messages.contents.filter(m => !before.has(m.id));
  const usageCards = msgs => msgs.filter(m =>
    (m.type === 'usage') || (m.getFlag('dnd5e', 'messageType') === 'usage'));
  const until = async (fn, ms = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await sleep(200); }
    return fn();
  };

  /** OUR popup, found by the eyebrow no other dialog in this module carries. */
  const popupEls = () => [...document.querySelectorAll('.application')]
    .filter(el => (el.innerHTML ?? '').includes('Damage &mdash; your roll')
               || (el.innerHTML ?? '').includes('Damage — your roll'));
  /** The targets' SAVE asks — closed between sections so they never pile up on screen. */
  const savePopupEls = () => [...document.querySelectorAll('.application.dialog')]
    .filter(el => /Saving throw|Save$/i.test(el.textContent ?? ''));
  const closeEls = async (els) => {
    for (const el of els) {
      const btn = el.querySelector('[data-action="close"]') ?? el.querySelector('.header-control');
      try { btn?.click(); } catch {}
    }
    await sleep(400);
  };
  const closeDamagePopups = () => closeEls(popupEls());
  const closeEverything = async () => { await closeEls([...popupEls(), ...savePopupEls()]); };

  const target = (...tokens) => {
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
    tokens.forEach((t, i) => t.setTarget(true, { releaseOthers: i === 0 }));
  };

  /** Cast one save activity at `tokens`; return its usage card. */
  const cast = async (id, tokens, useConfig = {}) => {
    target(...tokens);
    await sleep(200);
    const use = await act(id).use(useConfig, { configure: false }, {});
    const card = (use?.message instanceof ChatMessage) ? use.message : null;
    if (card) created.push(card.id);
    return card;
  };

  /** The damage roll chained to a card, if it has landed. */
  const damageFor = card => game.messages.contents.slice(-30).find(m =>
    (m.getFlag('dnd5e', 'roll.type') === 'damage')
    && (m.getFlag('dnd5e', 'originatingMessage') === card?.id));
  const waitDamage = async (card, ms) => {
    const d = await until(() => damageFor(card), ms);
    if (d) created.push(d.id);
    return d;
  };

  const saveBonus = (a, v) => a.update({ 'system.abilities.con.bonuses.save': v });
  const healFull = a => a.update({ 'system.attributes.hp.value': a.system.attributes.hp.max });

  /* 1 — setting OFF: the stamp still auto-rolls, and nothing pops. ----------------------- */
  await set('playerRollDamage', false);
  {
    const card = await cast('bfprobehalf00000', [tokA.object]);
    if (!card) return { fatal: 'the half fixture cast produced no usage card' };
    await until(() => card.getFlag(MOD, 'saves'));
    const dmg = await waitDamage(card, 8000);
    ok(1, 'OFF — the stamp auto-rolls, no popup',
      !!dmg && (popupEls().length === 0),
      `damage=${!!dmg} popups=${popupEls().length}`);
    await closeEverything();
  }

  /* 2, 3, 5, 6 — ON: the offer, its stakes, its silence about crits, and the press. ------ */
  await set('playerRollDamage', true);
  {
    const before = snap();
    const card = await cast('bfprobehalf00000', [tokA.object]);
    await until(() => card.getFlag(MOD, 'saves'));
    await sleep(1400);
    const popups = popupEls();
    const early = damageFor(card);
    ok(2, 'ON — the popup opens and the damage waits',
      (popups.length === 1) && !early,
      `popups=${popups.length} damageAlready=${!!early}`);

    const html = popups[0]?.innerHTML ?? '';
    const label = popups[0]?.querySelector('button[data-action="roll"]')?.textContent?.trim() ?? '';
    const title = popups[0]?.querySelector('.window-title')?.textContent ?? '';
    ok(3, 'onSave "half" — the stakes line says a save HALVES it',
      /halves/i.test(html), `stakes present=${/halves/i.test(html)}`);
    // A save spell has no attack roll, so there is no crit to report and nothing to guess at.
    ok(5, 'no crit anywhere — no badge, plain label, plain title',
      !html.includes('Critical Hit') && !/Critical/i.test(label) && !/Critical/i.test(title),
      `badge=${html.includes('Critical Hit')} label="${label}" title="${title}"`);

    popups[0]?.querySelector('button[data-action="roll"]')?.click();
    const dmg = await waitDamage(card, 8000);
    ok(6, 'button pressed — rolls, chained, carrying damageOnSave',
      !!dmg && (dmg.getFlag('dnd5e', 'originatingMessage') === card.id)
        && (dmg.getFlag('dnd5e', 'roll.damageOnSave') === 'half'),
      `damage=${!!dmg} origin=${dmg?.getFlag('dnd5e', 'originatingMessage') === card.id}`
        + ` onSave=${dmg?.getFlag('dnd5e', 'roll.damageOnSave')}`);
    created.push(...fresh(before).map(m => m.id));
    await closeEverything();
  }

  /* 4 — Vicious Mockery's shape: a save avoids it entirely. ------------------------------ */
  {
    const card = await cast('bfprobenone00000', [tokA.object]);
    await until(() => card.getFlag(MOD, 'saves'));
    await sleep(1400);
    const html = popupEls()[0]?.innerHTML ?? '';
    ok(4, 'onSave "none" — the stakes line says a save AVOIDS it entirely',
      (popupEls().length === 1) && /avoids it/i.test(html) && /entirely/i.test(html),
      `popups=${popupEls().length} avoids=${/avoids it/i.test(html)}`);
    await closeDamagePopups();
    await waitDamage(card, 6000);      // the dismissal rolls it; let it land before moving on
    await closeEverything();
  }

  /* 9 — rider damage offers NOTHING and rolls nothing (finding ③'s fence). --------------- */
  {
    const card = await cast('bfprobefull00000', [tokA.object]);
    await until(() => card.getFlag(MOD, 'saves'));
    await sleep(2500);
    const flag = card.getFlag(MOD, 'saves');
    const dmg = damageFor(card);
    ok(9, 'rider damage (onSave "full") — no popup, no roll, the fence holds',
      (popupEls().length === 0) && !dmg && (flag?.hasDamage === false),
      `popups=${popupEls().length} rolled=${!!dmg} hasDamage=${flag?.hasDamage}`);
    await closeEverything();
  }

  /* 10 — two targets, ONE popup. --------------------------------------------------------- */
  {
    const card = await cast('bfprobehalf00000', [tokA.object, tokB.object]);
    await until(() => card.getFlag(MOD, 'saves'));
    await sleep(1400);
    const stamped = card.getFlag(MOD, 'saves')?.targets?.length ?? 0;
    ok(10, 'two targets — exactly ONE popup (per CAST, never per target)',
      (popupEls().length === 1) && (stamped === 2),
      `stampedTargets=${stamped} popups=${popupEls().length}`);

    /* 7 — dismissing rolls IMMEDIATELY, well inside the 15s window. ---------------------- */
    await closeDamagePopups();
    const dmg = await waitDamage(card, 6000);
    ok(7, 'dismissed — rolls immediately, not at the buzzer',
      !!dmg, `damage within 6s of dismissal = ${!!dmg}`);
    await closeEverything();
  }

  /* 8 — the buzzer. Waited out for real. ------------------------------------------------- */
  {
    const card = await cast('bfprobehalf00000', [tokA.object]);
    await until(() => card.getFlag(MOD, 'saves'));
    await sleep(1400);
    const opened = popupEls().length;
    const early = !!damageFor(card);
    const dmg = await waitDamage(card, 22000);   // the window is 15s
    ok(8, 'left alone — the buzzer rolls it',
      (opened === 1) && !early && !!dmg,
      `popup=${opened} rolledEarly=${early} rolledByBuzzer=${!!dmg}`);
    await closeEverything();
  }

  /* 11 — THE ORDER CLAIM, with real HP: verdicts land first, the button is pressed after,
   * and the damage still folds per target at its own multiplier. This is the assertion the
   * whole design rests on — `reconcileSaveDamage` applies chained damage ON ARRIVAL, so a
   * fifteen-second-late roll is the case it was already built for, not a new one. --------- */
  {
    await set('autoApply', true);
    await saveBonus(tgtC, '-30');        // forced FAILURE vs DC 15 → full 10
    await saveBonus(tgtD, '+30');        // forced SUCCESS vs DC 15 → half, 5
    await healFull(tgtC); await healFull(tgtD);
    await sleep(300);
    const aMax = tgtC.system.attributes.hp.max;
    const bMax = tgtD.system.attributes.hp.max;

    const card = await cast('bfprobehalf00000', [tokC.object, tokD.object]);
    await until(() => card.getFlag(MOD, 'saves'));
    await sleep(1200);
    const popups = popupEls();

    // Let the saveTimer buzzer resolve BOTH verdicts while the damage popup still sits open —
    // the ordering that could not happen before the popup existed.
    const bothDone = await until(() =>
      (card.getFlag(MOD, 'saves')?.targets ?? []).every(t => t.done) ? true : null, 20000);
    const stillOpen = popupEls().length === 1;
    const nothingYet = !damageFor(card);
    log.push(`11: verdicts done=${bothDone} popupStillOpen=${stillOpen} damageBeforePress=${!nothingYet}`);

    log.push(`11 diag: identities — C="${tgtC.name}" (${tgtC.uuid}) hp=${tgtC.system.attributes.hp.value}`
      + ` / D="${tgtD.name}" (${tgtD.uuid}) hp=${tgtD.system.attributes.hp.value}`);

    popups[0]?.querySelector('button[data-action="roll"]')?.click();
    const dmg = await until(() => {
      const d = damageFor(card);
      return (d?.getFlag(MOD, 'receipt')?.targets?.length === 2) ? d : null;
    }, 20000);
    if (dmg) created.push(dmg.id);
    // Sample the pool over time: one application looks flat, two look like a staircase.
    const trace = [];
    for (let i = 0; i < 6; i++) {
      trace.push(`${((i * 500) / 1000).toFixed(1)}s C=${tgtC.system.attributes.hp.value} D=${tgtD.system.attributes.hp.value}`);
      await sleep(500);
    }
    log.push(`11 diag: pool trace — ${trace.join(' | ')}`);
    // ⚠ DIAGNOSTIC, kept: "the receipt says 10, the pool moved 20" has to be answerable without
    // a second run. Every damage roll chained to this card, with what each one claims to have
    // applied — if two rolls exist, the popup forked; if one roll shows two receipt entries for
    // one target, the applier did.
    const chained = game.messages.contents
      .filter(m => (m.getFlag('dnd5e', 'roll.type') === 'damage')
                && (m.getFlag('dnd5e', 'originatingMessage') === card.id))
      .map(m => ({
        id: m.id, total: m.rolls?.[0]?.total ?? null,
        onSave: m.getFlag('dnd5e', 'roll.damageOnSave') ?? null,
        receipt: (m.getFlag(MOD, 'receipt')?.targets ?? [])
          .map(t => `${t.name ?? t.uuid?.slice(-6)}:${t.taken}${t.multiplier ? `x${t.multiplier}` : ''}${t.reverted ? '(rev)' : ''}`)
      }));
    log.push(`11 diag: ${chained.length} chained damage roll(s) — ${JSON.stringify(chained)}`);
    log.push(`11 diag: demand targets — ${JSON.stringify((card.getFlag(MOD, 'saves')?.targets ?? [])
      .map(t => ({ n: t.name, done: t.done, out: t.outcome, applied: t.applied, total: t.total })))}`);

    const ra = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === tgtC.uuid);
    const rb = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === tgtD.uuid);

    ok(11, 'verdicts FIRST, then the button — the late roll still folds 10 / 5 by multiplier',
      !!bothDone && stillOpen && nothingYet
        && (ra?.taken === 10) && !ra?.multiplier
        && (rb?.taken === 5) && (rb?.multiplier === 0.5)
        && (tgtC.system.attributes.hp.value === aMax - 10)
        && (tgtD.system.attributes.hp.value === bMax - 5),
      `verdictsFirst=${bothDone} popupSurvived=${stillOpen} noEarlyRoll=${nothingYet} `
        + `C.taken=${ra?.taken} D.taken=${rb?.taken} D.mult=${rb?.multiplier} `
        + `hp ${aMax}→${tgtC.system.attributes.hp.value} / ${bMax}→${tgtD.system.attributes.hp.value}`);
    await closeEverything();
  }

  /* 13 — THE CONTROL, and the only assertion here that is not about the popup at all.
   *
   * 11 constructs "verdicts first, damage after" and reads the pool. If that ordering
   * double-applies, the question that decides everything is whether the POPUP caused it — so
   * this runs the identical ordering with the popup OFF, reaching it the way the save slice
   * always could: let the stamp auto-roll, DELETE that roll (smoke-saves §1's trick, which is
   * what makes the ordering constructible at all), wait out both verdicts, then chain a roll by
   * hand. Same shape, same multipliers, no popup anywhere near it.
   *
   * PASS here means the popup is innocent and 11 has found something older. FAIL here means the
   * ordering itself is broken independently of this build — which is a finding either way, but
   * not this feature's finding. -------------------------------------------------------------- */
  {
    await set('playerRollDamage', false);
    await set('autoApply', true);
    await saveBonus(tgtE, '-30');        // forced FAILURE → full 10
    await saveBonus(tgtF, '+30');        // forced SUCCESS → half, 5
    await healFull(tgtE); await healFull(tgtF);
    await sleep(300);
    const eMax = tgtE.system.attributes.hp.max;
    const fMax = tgtF.system.attributes.hp.max;

    const card = await cast('bfprobehalf00000', [tokE.object, tokF.object]);
    await until(() => card.getFlag(MOD, 'saves'));

    // The stamp's own auto-roll is the EARLY damage. Delete it so the late-arrival ordering can
    // be built, exactly as the save suite does.
    const auto = await until(() => damageFor(card), 8000);
    if (auto) await auto.delete().catch(() => {});
    await sleep(400);

    const bothDone = await until(() =>
      (card.getFlag(MOD, 'saves')?.targets ?? []).every(t => t.done) ? true : null, 20000);
    const noneYet = !damageFor(card);

    await act('bfprobehalf00000').rollDamage({}, { configure: false },
      { data: { 'flags.dnd5e.originatingMessage': card.id } });
    const dmg = await until(() => {
      const d = damageFor(card);
      return (d?.getFlag(MOD, 'receipt')?.targets?.length === 2) ? d : null;
    }, 20000);
    if (dmg) created.push(dmg.id);
    await sleep(2000);
    const re = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === tgtE.uuid);
    const rf = dmg?.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === tgtF.uuid);

    ok(13, 'CONTROL — same ordering with the popup OFF folds 10 / 5 (is the popup implicated?)',
      !!bothDone && noneYet
        && (re?.taken === 10) && (rf?.taken === 5) && (rf?.multiplier === 0.5)
        && (tgtE.system.attributes.hp.value === eMax - 10)
        && (tgtF.system.attributes.hp.value === fMax - 5),
      `verdictsFirst=${bothDone} autoRollDeleted=${!!auto} noEarlyRoll=${noneYet} `
        + `E.taken=${re?.taken} F.taken=${rf?.taken} F.mult=${rf?.multiplier} `
        + `hp ${eMax}→${tgtE.system.attributes.hp.value} / ${fMax}→${tgtF.system.attributes.hp.value}`);
    await closeEverything();
  }

  /* 12 — THE AREA, cast bare: the `awaitingTemplate` corner. The offer still comes, targetless,
   * and says why there is nobody named on it. Deferring until the template lands would mean a
   * spell nobody ever places never rolls at all. ------------------------------------------- */
  {
    // ⚠ States its own preconditions rather than inheriting them: the CONTROL above turns the
    // popup OFF, and this section is entirely about the popup appearing.
    await set('playerRollDamage', true);
    await set('autoApply', false);
    game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
    await sleep(200);
    const before = snap();
    // ⚠ A TEMPLATE-BEARING `use()` NEVER RESOLVES headless — it parks waiting for a human to
    // place the preview (HANDOFF, 2026-08-19; it cost a probe its watchdog). Two defences, both
    // documented there: pass `create.measuredTemplate false` (the canceled-preview path the save
    // suite uses) AND race the call anyway, so a future 5.3.x that ignores the flag stalls this
    // assertion rather than the whole probe.
    const used = await Promise.race([
      act('bfprobetmpl00000').use({ create: { measuredTemplate: false } }, { configure: false }, {})
        .catch(() => null),
      sleep(6000).then(() => 'timeout')
    ]);
    const card = await until(() => usageCards(fresh(before)).find(m => m.getFlag(MOD, 'saves')), 8000);
    created.push(...fresh(before).map(m => m.id));
    const flag = card?.getFlag(MOD, 'saves');
    await sleep(1200);
    const html = popupEls()[0]?.innerHTML ?? '';
    ok(12, 'bare-cast area — a WAITING demand still offers the roll, and says why it names nobody',
      (flag?.awaitingTemplate === true) && (popupEls().length === 1)
        && /not placed yet/i.test(html) && !/Against/i.test(html),
      `use=${used === 'timeout' ? 'raced-out' : 'resolved'} awaiting=${flag?.awaitingTemplate} `
        + `popups=${popupEls().length} saysWhy=${/not placed yet/i.test(html)} `
        + `namesNobody=${!/Against/i.test(html)}`);
    await closeEverything();
    await waitDamage(card, 6000);   // the dismissal rolls it; let it land before teardown
  }

  /* teardown ----------------------------------------------------------------------------- */
  await closeEverything();
  game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
  // Any template the bare cast managed to leave behind goes with it.
  const strayTemplates = canvas.scene.templates
    .filter(t => t.user?.id === game.user.id).map(t => t.id);
  if (strayTemplates.length) {
    await canvas.scene.deleteEmbeddedDocuments('MeasuredTemplate', strayTemplates).catch(() => {});
  }
  await ChatMessage.deleteDocuments([...new Set(created)].filter(id => game.messages.has(id)))
    .catch(() => {});
  for (const doc of [tokA, tokB, tokC, tokD, tokE, tokF]) {
    await canvas.scene.deleteEmbeddedDocuments('Token', [doc.id]).catch(() => {});
  }
  for (const a of [caster, tgtA, tgtB, tgtC, tgtD, tgtE, tgtF]) await a.delete().catch(() => {});
  for (const [k, v] of Object.entries(prior)) await game.settings.set(MOD, k, v);
  const restored = Object.fromEntries(KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const drifted = KEYS.filter(k => JSON.stringify(restored[k]) !== JSON.stringify(prior[k]));

  return { scene: canvas.scene?.name, log, results, restored, drifted };
});

if (out.fatal) { console.error('[savedmg] FATAL:', out.fatal); process.exit(2); }
console.log(`\n[savedmg] scene "${out.scene}"`);
for (const l of out.log) console.log(`  · ${l}`);

let bad = 0;
for (const r of out.results.sort((a, b) => a.n - b.n)) {
  if (!r.pass) bad++;
  console.log(`\n  ${r.pass ? 'PASS' : 'FAIL'}  ${r.n}. ${r.name}`);
  console.log(`        ${r.detail}`);
}
console.log(`\n[savedmg] settings restored: ${JSON.stringify(out.restored)}`);
if (out.drifted?.length) {
  console.error(`[savedmg] ⚠ SETTINGS DRIFTED: ${out.drifted.join(', ')} — restore by hand`);
}
console.log(bad ? `\n[savedmg] ${bad} of ${out.results.length} WRONG`
                : `\n[savedmg] ${out.results.length}/${out.results.length} — the caster is offered their own dice too`);
process.exit((bad || out.drifted?.length) ? 1 : 0);
