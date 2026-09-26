// Battle Flow Savage Attacker smoke test — THE DAMAGE DICE, ROLLED TWICE (Slice A, ruled 2026-09-24
// off prototypes/slice-a.html; RULINGS.md owes the section). On a weapon hit the attacker is asked ONE
// question — use it on THIS hit? — a tick row, "Roll again" / "Keep the roll", a clock that keeps the
// roll. On "Roll again" the weapon's dice (never the modifier, never a rider) are rolled again as a
// set and the higher set stands; the damage waits for the answer (auto-apply.js's claim) and lands
// once; once per turn by the `rider` chit; the defender's hold resolves FIRST.
//
// Fixtures: BF Test Halfling (Rogue 3 with Lucky and Savage Attacker and a Shortsword — added to
// tools/fixture-suite.mjs by the Slice A tier 1+2 build) and BF Test Victim (the goblin).
//
// Written blind 2026-09-24 (the sandbox was in use by the parallel build) and first run the same night:
// 26/26 after two CODE fixes it caught (7eca747 nested flag stamps, 32894d7 dnd5e's adv/dis markers).
//
// Harness discipline: every setting touched is restored; every message this run creates is
// deleted; the chits it writes are cleared; the tokens it places are removed; its combat is deleted.
//
// Sections: `--section 3`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs): the machines this suite drives — a change to one
// re-runs it under `battery.mjs --changed`. Spine files are never claimed: their change is the
// full battery. `npm run coverage` checks the claims both ways. Exported only so the linter reads
// it as the declaration it is: ⚠ NEVER import a suite (it connects on evaluation) — the map is parsed.
export const COVERS = [
  'damage-either.js',       // the whole fold — the birth flag, the popup, the set, the card, the chit
  'hold/continue.js'        // §6 — the hold's release is what lets the offer open
];

const SECTIONS = {
  1: 'out of combat, the hit: the popup asks (the tick row, "Roll again" dark until ticked, "Keep the roll"), the damage waits — no receipt while it asks — and the card says it is offered',
  2: 'Roll again, higher: the weapon\'s die rolled again as a set on its own card, the higher stands, the first struck on the damage roll, the modifier added once; the damage lands ONCE with the new total; the record is used and published as `fold`',
  3: 'Roll again, lower: the first set stands, the second struck; the damage lands with the first total',
  4: 'Keep the roll: the record says kept, still ready this turn; the damage lands as rolled',
  5: 'in combat, once per turn: the second hit the same turn is born spent — no popup, the tag "used this turn", the damage lands at once; the next turn offers again',
  6: 'the defender\'s hold first: a hit on a Shield-class holder leaves the offer DUE (no popup) until the hold is answered; a pass lets it ask',
  7: 'a crit: the doubled set (2d6) is rolled again whole, the totals compared',
  8: 'the clock keeps the roll: an unanswered offer times out kept, and the damage lands',
  9: 'the list is the switch: an empty Damage Rolled Twice list offers nothing',
  10: 'the registrations FIRED (§11): dnd5e.preRollDamageV2 and dnd5e.rollDamageV2 moved with the offer on them'
};
const DEPENDS = { 2: ['1'] };   // §2 answers the popup §1 opened

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'savage', watchdogMs: 600_000 });
announcePlan('savage', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  const results = [];
  const log = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const moments = [];
  const momentHookId = Hooks.on('battleflow.moment', p => moments.push(p));
  const momentsOf = (event, since = 0) => moments.filter(p => (p.event === event) && (p.at >= since));
  const suiteStart = Date.now();
  const ledger = globalThis.__bfHookLedger ?? null;
  const count = name => ledger?.[name] ?? 0;

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.damageEitherList`)) return { fatal: 'damageEitherList not registered — OLD code (F5)' };

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'interruptList', 'holdTimer', 'holdReveal', 'holdSkipFutile', 'riders', 'effectRiders', 'masteryRiders',
    'masteryAsk', 'saves', 'saveTimer', 'castApply', 'concMode', 'reminderList', 'clockRiderList', 'damageEitherList', 'metamagicList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const halfling = game.actors.getName('BF Test Halfling');
  if (!scene || !victim || !halfling) return { fatal: 'missing fixture: scene, BF Test Victim or BF Test Halfling — run tools/fixture-suite.mjs' };
  if (!halfling.items.find(i => i.name === 'Savage Attacker')) return { fatal: 'BF Test Halfling lacks Savage Attacker — re-run fixture-suite' };

  const created = { tokens: [], items: [] };
  const priorActor = {};
  let combat = null;
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  /** The PRNG as a queue of faces: `[20, 19]` then `[6, 6]` → each die takes the next face; past the end, the last. */
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const clearChips = async () => {
    for (const a of [victim, halfling]) {
      const chips = a.effects.filter(e => e.getFlag(MOD, 'mastery') || /Savage Attacker|Reaction — used/.test(e.name));
      const live = chips.map(e => e.id).filter(id => a.effects.get(id));
      if (live.length) await a.deleteEmbeddedDocuments('ActiveEffect', live).catch(() => {});
    }
  };
  const eitherPopup = () => [...foundry.applications.instances.values()]
    .find(app => app.rendered && app.element?.querySelector?.('[data-bf-ticks="bf-either"]')) ?? null;
  const closeDialogs = async () => {
    for (const app of foundry.applications.instances.values()) {
      const ours = app.element?.querySelector?.('[data-bf-ticks]') || (app.element?.innerHTML ?? '').includes('Damage — your roll');
      if (ours) { try { await app.close(); } catch { /* gone */ } }
    }
  };
  const teardown = async () => {
    if (restored) return;
    restored = true;
    CONFIG.Dice.randomUniform = realPRNG;
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      await closeDialogs();
      await clearChips();
      try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
      for (const [actorId, ids] of Object.entries(created.items.reduce((m, [a, id]) => ((m[a] ??= []).push(id), m), {}))) {
        const actor = game.actors.get(actorId);
        const live = ids.filter(id => actor?.items.get(id));
        if (live.length) await actor.deleteEmbeddedDocuments('Item', live);
      }
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow'
          || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('autoDamage', 'all');
    await set('autoApply', true);
    await set('playerRollDamage', false);
    await set('damageTimer', 0);
    await set('dramaticBeat', 0);
    await set('requireTarget', false);
    await set('reactionHold', false);
    await set('holdTimer', 0);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('masteryAsk', false);
    await set('castApply', false);
    await set('concMode', 'off');
    await set('reminderList', '');     // no gate dialog in the way of a programmatic swing
    await set('clockRiderList', '');
    await set('damageEitherList', game.settings.settings.get(`${MOD}.damageEitherList`)?.default ?? 'Savage Attacker');

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => [victim.id, halfling.id].includes(t.actorId)).map(t => t.id);
    if (strays.length) await scene.deleteEmbeddedDocuments('Token', strays);
    const placeToken = async (actor, x, y) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const { doc: victimDoc, token: victimToken } = await placeToken(victim, 1400, 1700);
    const { doc: halflingDoc, token: halflingToken } = await placeToken(halfling, 1500, 1700);

    priorActor[victim.id] = {
      'system.attributes.ac.override': victim.system._source.attributes.ac.override ?? null,
      'system.attributes.hp.value': victim.system._source.attributes.hp.value,
      'system.attributes.hp.max': victim.system._source.attributes.hp.max
    };
    await victim.update({ 'system.attributes.ac.override': 10, 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });
    const healFull = async () => victim.update({ 'system.attributes.hp.value': victim.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const textOf = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const cardText = id => textOf(document.querySelector(`.message[data-message-id="${id}"]`));
    const shortsword = halfling.items.find(i => (i.type === 'weapon') && (i.name === 'Shortsword'));
    if (!shortsword) return { fatal: 'BF Test Halfling has no Shortsword' };
    const act = shortsword.system.activities.find(a => a.type === 'attack');
    const dexMod = Number(halfling.system.abilities.dex.mod);
    const damageFor = originId => game.messages.contents.find(m => (m.type === 'damage') && (m._source.system?.origin === originId));
    /** A programmatic hit: the d20 face and the damage die face forced; returns the attack and its damage message. */
    const swing = async ({ d20 = 15, die = 3, crit = false } = {}) => {
      await healFull();
      halflingToken.control({ releaseOthers: true });
      victimToken.setTarget(true, { releaseOthers: true });
      await sleep(80);
      faces([[crit ? 20 : d20, 20], ...(Array.isArray(die) ? die : [die]).map(n => [n, 6])]);
      const results = await act.use({ subsequentActions: false }, { configure: false }, {});
      const rolls = await act.rollAttack({}, { configure: false }, results?.message?.id ? { data: { 'system.origin': results.message.id } } : {});
      const attackMsg = rolls?.[0]?.parent ?? null;
      const originId = attackMsg?._source.system?.origin ?? attackMsg?.id;
      const dmg = await waitFor(() => damageFor(originId), 8000);
      return { attackMsg, dmg, originId };
    };
    const either = dmg => dmg?.getFlag(MOD, 'either') ?? null;
    const tick = popup => { const box = popup?.element?.querySelector('input[name="bf-either"]'); if (box && !box.checked) box.click(); return box; };
    const press = (popup, action) => popup?.element?.querySelector(`button[data-action="${action}"]`)?.click();
    const receiptOf = dmg => dmg?.getFlag(MOD, 'receipt') ?? null;
    const startCombat = async () => {
      if (game.combat) await game.combat.delete();
      combat = await Combat.create({ scene: scene.id });
      await combat.createEmbeddedDocuments('Combatant', [
        { actorId: halfling.id, tokenId: halflingDoc.id, sceneId: scene.id, initiative: 20 },
        { actorId: victim.id, tokenId: victimDoc.id, sceneId: scene.id, initiative: 5 }]);
      await combat.startCombat();
      await sleep(500);
    };

    // ================================================== 1. the popup asks, the damage waits
    let s1 = null;
    if (want(1) || want(2)) {
      await clearChips();
      s1 = await swing({ d20: 15, die: 2 });
      const popup = await waitFor(eitherPopup, 6000);
      const rollBtn = popup?.element?.querySelector('button[data-action="again"]');
      const box = popup?.element?.querySelector('input[name="bf-either"]');
      ok('1a. the popup asks: the tick row names Savage Attacker with "1d6 again" and "once per turn", the rule folded under; a 2 is under the average, so the die meter reads low, the row starts TICKED and "Roll again" is live (the hint, option D)',
        !!popup && /Savage Attacker/.test(textOf(popup.element)) && /1d6 again/.test(textOf(popup.element)) && /once per turn/i.test(textOf(popup.element))
          && /the rule/.test(textOf(popup.element)) && !!popup.element.querySelector('[data-bf-die-meter="low"]')
          && /67% a second roll beats it/.test(textOf(popup.element)) && box?.checked === true && rollBtn?.disabled === false,
        `popup=${!!popup} text="${textOf(popup?.element).slice(0, 260)}" checked=${box?.checked} disabled=${rollBtn?.disabled}`);
      if (box?.checked) box.click();
      ok('1e. unticking the row darkens "Roll again"; ticking it lights it again', rollBtn?.disabled === true, `disabled=${rollBtn?.disabled}`);
      ok('1b. the damage WAITS for the answer: the record is pending and no receipt stands (auto-apply.js\'s claim)',
        (either(s1.dmg)?.status === 'pending') && !receiptOf(s1.dmg), `either=${JSON.stringify(either(s1.dmg))} receipt=${!!receiptOf(s1.dmg)}`);
      ok('1c. the weapon\'s roll count is stamped before any rider (auto-damage.js): one roll, the shortsword\'s',
        s1.dmg?.getFlag(MOD, 'weaponRolls') === 1, `weaponRolls=${s1.dmg?.getFlag(MOD, 'weaponRolls')}`);
      const text = await waitFor(() => { const t = cardText(s1.dmg?.id); return /Savage Attacker/.test(t) ? t : null; }, 4000);
      ok('1d. the damage card says it is offered', /Savage Attacker — offered/.test(text ?? ''), (text ?? '').slice(0, 200));
      tick(popup);
      ok('1f. ticked again, "Roll again" is live', rollBtn?.disabled === false, `disabled=${rollBtn?.disabled}`);
    }

    // ================================================== 2. roll again, higher
    if (want(2) && s1) {
      const popup = eitherPopup();
      const since = Date.now();
      faces([[5, 6]]);
      tick(popup);
      press(popup, 'again');
      const used = await waitFor(() => (either(game.messages.get(s1.dmg.id))?.status === 'used') ? game.messages.get(s1.dmg.id) : null, 12000);
      const flag = either(used);
      const total = used?.rolls?.reduce((n, r) => n + r.total, 0);
      ok('2a. the second set (5) beats the first (2): the higher stands, the total is 5 + the modifier once',
        (flag?.first === 2) && (flag?.second === 5) && (flag?.stands === 'second') && (total === 5 + dexMod),
        `flag=${JSON.stringify(flag)} total=${total} dexMod=${dexMod}`);
      const faceRow = used?.rolls?.[0]?.dice?.[0]?.results ?? [];
      ok('2b. both sets on the roll: the 2 struck (inactive), the 5 active', faceRow.some(r => (r.result === 2) && (r.active === false)) && faceRow.some(r => (r.result === 5) && (r.active !== false)),
        JSON.stringify(faceRow));
      const receipt = await waitFor(() => receiptOf(game.messages.get(s1.dmg.id)), 8000);
      ok('2c. the damage landed ONCE with the new total — one receipt entry, no "moved" note', (receipt?.targets?.length === 1) && !(receipt.targets[0].note ?? '').includes('reroll'),
        JSON.stringify(receipt?.targets?.map(t => ({ taken: t.taken, note: t.note }))));
      const announce = game.messages.contents.find(m => (m.timestamp >= since) && (m.getFlag(MOD, 'respondsTo') === s1.dmg.id));
      ok('2d. the second set rolled on its own card, in the open', !!announce && (announce.rolls?.[0]?.total === 5), `announce=${!!announce} total=${announce?.rolls?.[0]?.total}`);
      const ev = momentsOf('fold', since).filter(p => (p.kind === 'either') && (p.messageId === s1.dmg.id));
      ok('2e. the resolve was PUBLISHED as `fold` (kind either), once', ev.length === 1, JSON.stringify(ev.map(p => p.marker)));
      ok('2f. out of combat no chit is written — the next hit asks again', !halfling.effects.some(e => e.getFlag(MOD, 'mastery') === 'rider'), '');
    }

    // ================================================== 3. roll again, lower
    if (want(3)) {
      await clearChips();
      const s = await swing({ d20: 15, die: 5 });
      const popup = await waitFor(eitherPopup, 6000);
      const box = popup?.element?.querySelector('input[name="bf-either"]');
      const keepBtn = popup?.element?.querySelector('button[data-action="keep"]');
      ok('3c. a 5 is above the average: the meter reads high, the row starts UNTICKED and "Keep the roll" is the default (the hint, option D)',
        !!popup?.element?.querySelector('[data-bf-die-meter="high"]') && box?.checked === false
          && !!keepBtn && (keepBtn.classList.contains('default') || keepBtn.hasAttribute('autofocus')),
        `checked=${box?.checked} keep=${keepBtn?.outerHTML?.slice(0, 160)}`);
      faces([[2, 6]]);
      tick(popup);
      press(popup, 'again');
      const used = await waitFor(() => (either(game.messages.get(s.dmg.id))?.status === 'used') ? game.messages.get(s.dmg.id) : null, 12000);
      const flag = either(used);
      const total = used?.rolls?.reduce((n, r) => n + r.total, 0);
      ok('3a. the second set (2) loses to the first (5): the first stands, the 2 joins struck, the total unmoved',
        (flag?.stands === 'first') && (total === 5 + dexMod) && (used?.rolls?.[0]?.dice?.[0]?.results ?? []).some(r => (r.result === 2) && (r.active === false)),
        `flag=${JSON.stringify(flag)} total=${total}`);
      const receipt = await waitFor(() => receiptOf(game.messages.get(s.dmg.id)), 8000);
      ok('3b. the damage landed with the first total', !!receipt, JSON.stringify(receipt?.targets?.map(t => t.taken)));
    }

    // ================================================== 4. keep the roll
    if (want(4)) {
      await clearChips();
      const s = await swing({ d20: 15, die: 4 });
      const popup = await waitFor(eitherPopup, 6000);
      press(popup, 'keep');
      const kept = await waitFor(() => (either(game.messages.get(s.dmg.id))?.status === 'kept') ? game.messages.get(s.dmg.id) : null, 8000);
      const receipt = await waitFor(() => receiptOf(game.messages.get(s.dmg.id)), 8000);
      ok('4a. Keep the roll: the record is kept, the damage lands as rolled', !!kept && !!receipt, `status=${either(game.messages.get(s.dmg.id))?.status} receipt=${!!receipt}`);
      const text = await waitFor(() => { const t = cardText(s.dmg?.id); return /still ready/.test(t) ? t : null; }, 4000);
      ok('4b. the card says it was not used and is still ready this turn', /not used, still ready this turn/.test(text ?? ''), (text ?? '').slice(0, 200));
    }

    // ================================================== 5. once per turn
    if (want(5)) {
      await clearChips();
      await startCombat();
      const first = await swing({ d20: 15, die: 2 });
      const popup = await waitFor(eitherPopup, 6000);
      faces([[6, 6]]);
      tick(popup);
      press(popup, 'again');
      await waitFor(() => either(game.messages.get(first.dmg.id))?.status === 'used', 12000);
      const chit = await waitFor(() => halfling.effects.find(e => (e.getFlag(MOD, 'mastery') === 'rider') && (e.getFlag(MOD, 'riderKey') === 'savage-attacker')), 5000);
      ok('5a. used in combat: the rider chit is written for the turn (riderKey savage-attacker)', !!chit, `chit=${chit?.name}`);
      const second = await swing({ d20: 15, die: 3 });
      await sleep(1200);
      const receipt2 = await waitFor(() => receiptOf(game.messages.get(second.dmg.id)), 8000);
      ok('5b. the second hit the same turn is born spent — no popup, the damage lands at once',
        (either(second.dmg)?.status === 'spent') && !eitherPopup() && !!receipt2,
        `either=${JSON.stringify(either(second.dmg))} popup=${!!eitherPopup()} receipt=${!!receipt2}`);
      const text = await waitFor(() => { const t = cardText(second.dmg?.id); return /used this turn/.test(t) ? t : null; }, 4000);
      ok('5c. the card carries the one tag: "Savage Attacker — used this turn"', /Savage Attacker — used this turn/.test(text ?? ''), (text ?? '').slice(0, 200));
      await combat.nextTurn(); await sleep(600);   // the victim
      await combat.nextTurn(); await sleep(600);   // round 2, the halfling again
      const third = await swing({ d20: 15, die: 3 });
      const again = await waitFor(eitherPopup, 6000);
      ok('5d. the next turn offers again', !!again && (either(game.messages.get(third.dmg.id))?.status === 'pending'), `popup=${!!again}`);
      press(again, 'keep');
      await combat.delete(); combat = null;
      await clearChips();
    }

    // ================================================== 6. the hold first
    if (want(6)) {
      await clearChips();
      await set('reactionHold', true);
      await set('holdTimer', 0);
      await set('holdSkipFutile', false);
      await set('interruptList', 'Uncanny Dodge:damage');
      // A text-only feature on the victim, the 2024 Uncanny Dodge's shape (smoke-hold §8's stand-in).
      const [ud] = await victim.createEmbeddedDocuments('Item', [{ name: 'Uncanny Dodge', type: 'feat', system: { description: { value: '<p>Halve it.</p>' } } }]);
      created.items.push([victim.id, ud.id]);
      const s = await swing({ d20: 15, die: 2 });
      const hold = await waitFor(() => (s.attackMsg?.getFlag(MOD, 'hold')?.status === 'pending') ? s.attackMsg.getFlag(MOD, 'hold') : null, 6000);
      await sleep(1000);
      ok('6a. while the defender\'s hold is open the offer stays DUE — no popup, no receipt',
        !!hold && (either(game.messages.get(s.dmg.id))?.status === 'due') && !eitherPopup() && !receiptOf(game.messages.get(s.dmg.id)),
        `hold=${hold?.status} either=${either(game.messages.get(s.dmg.id))?.status} popup=${!!eitherPopup()}`);
      const { answerHold } = await import('/modules/fvtt-mod-battleflow/scripts/hold/answer.js');
      await answerHold(s.attackMsg, victim.uuid, 'pass');
      const popup = await waitFor(eitherPopup, 10000);
      ok('6b. the hold answered (a pass), the damage stands and the offer asks', !!popup && (either(game.messages.get(s.dmg.id))?.status === 'pending'),
        `either=${either(game.messages.get(s.dmg.id))?.status}`);
      press(popup, 'keep');
      await waitFor(() => receiptOf(game.messages.get(s.dmg.id)), 8000);
      await set('reactionHold', false);
      await set('interruptList', prior.interruptList);
    }

    // ================================================== 7. a crit's doubled set
    if (want(7)) {
      await clearChips();
      const s = await swing({ crit: true, die: [1, 2] });
      const popup = await waitFor(eitherPopup, 6000);
      ok('7a. a crit offers the doubled set: "2d6 again"', /2d6 again/.test(textOf(popup?.element)), textOf(popup?.element).slice(0, 200));
      faces([[6, 6], [5, 6]]);
      tick(popup);
      press(popup, 'again');
      const used = await waitFor(() => (either(game.messages.get(s.dmg.id))?.status === 'used') ? game.messages.get(s.dmg.id) : null, 12000);
      ok('7b. both dice rolled again as one set: 3 against 11, the 11 stands', (either(used)?.first === 3) && (either(used)?.second === 11) && (either(used)?.stands === 'second'),
        JSON.stringify(either(used)));
    }

    // ================================================== 8. the clock keeps the roll
    if (want(8)) {
      await clearChips();
      await set('holdTimer', 2);
      const s = await swing({ d20: 15, die: 3 });
      await waitFor(eitherPopup, 6000);
      const kept = await waitFor(() => either(game.messages.get(s.dmg.id))?.status === 'kept', 8000);
      const receipt = await waitFor(() => receiptOf(game.messages.get(s.dmg.id)), 8000);
      ok('8a. unanswered, the clock keeps the roll (timedOut) and the damage lands', kept && !!receipt && either(game.messages.get(s.dmg.id))?.timedOut === true,
        JSON.stringify(either(game.messages.get(s.dmg.id))));
      await set('holdTimer', 0);
    }

    // ================================================== 9. the list is the switch
    if (want(9)) {
      await clearChips();
      await set('damageEitherList', '');
      const s = await swing({ d20: 15, die: 3 });
      const receipt = await waitFor(() => receiptOf(game.messages.get(s.dmg.id)), 8000);
      ok('9a. an empty Damage Rolled Twice list offers nothing — no record, no popup, the damage lands', !either(s.dmg) && !eitherPopup() && !!receipt,
        `either=${JSON.stringify(either(s.dmg))}`);
      await set('damageEitherList', prior.damageEitherList);
    }

    // ================================================== 10. FIRED
    if (want(10)) {
      ok('10a. dnd5e.preRollDamageV2 and dnd5e.rollDamageV2 fired', (count('dnd5e.preRollDamageV2') > 0) && (count('dnd5e.rollDamageV2') > 0),
        `pre=${count('dnd5e.preRollDamageV2')} roll=${count('dnd5e.rollDamageV2')}`);
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    Hooks.off('battleflow.moment', momentHookId);
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'savage', out, plan, f });
