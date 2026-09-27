// Battle Flow Goliath smoke test — THE GOLIATH WALK'S PASS 2 (2026-09-25): Large Form's token size
// ("large form did not increase token size"), the rebuke family ("Storms thunder is not triggering
// anything … make sure the 60ft range calc is in there … pick up hellish rebuke and anything else in
// that family"), and Stone's Endurance on ANY damage (ruled "Hold before it lands").
//
// Fixtures: BF Test Goliath (Fighter 5, Stone's Endurance, Fire's Burn; friendly) is lent the PHB's
// Storm's Thunder and Large Form for the run (and Sentinel for §5, with BF Test Cleric placed beside
// the Victim as the one it hits); BF Test Victim (hostile) is the damager. Both linked,
// tokens placed on the Battle Flow Test Range for the run. Built by tools/fixture-suite.mjs.
//
// Harness discipline: every setting touched is restored; the lent items, the effects, the tokens and
// the messages this run creates are deleted; the Goliath's uses and both HP pools are put back.
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'rebukes.js',             // §2, §3 — the offer within reach, the drive at the damager; none out of reach
  'damage-holds.js',        // §4 — the applier's claim, the answer, the reduced landing
  'token-lights.js',        // §1 — Large Form's size on the pack's own effect
  'clock-riders.js'         // §5 — Sentinel's Halt on the driven Opportunity Attack's hit (the PHB feats, group 6)
];

const SECTIONS = {
  1: 'Large Form: the pack\'s effect on the Goliath makes it Large — a 2 × 2 token and "lg" on the sheet — and removing it puts both back',
  2: 'Storm\'s Thunder: damage from a creature 30 ft away offers the rebuke card; Use fires Storm\'s Thunder at the damager — a use spent, its thunder landed with a receipt',
  3: 'the 60-foot reach: the same damage from 70 ft away offers nothing',
  4: 'Stone\'s Endurance on a non-attack damage: the same share reaching the applier twice (a save\'s damage) is held ONCE — one card, one popup; the click rolls 1d12 + CON, spends a use and lands the damage short by the roll with the receipt saying why',
  5: 'Sentinel (the PHB feats, group 6): the hostile Victim\'s attack hits the Cleric beside it — the Goliath (lent Sentinel) 5 ft away is asked, not the Cleric, not the Victim; Use drives an Opportunity Attack (its card marked), whose hit offers Halt ticked and lands the pack\'s "Halted" on the Victim; a hit on the Sentinel itself asks no ward'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'goliath', watchdogMs: 420_000 });
announcePlan('goliath', plan, pulled);

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
  const suiteStart = Date.now();

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.rebukeList`)) return { fatal: 'rebukeList not registered — OLD code (reload the box)' };
  const { applyDamagesWithReceipt } = await import(`/modules/${MOD}/scripts/auto-apply.js`);
  const { livePopups } = await import(`/modules/${MOD}/scripts/ui.js`);

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'holdTimer', 'saves', 'castApply', 'concMode', 'reminderList', 'damageEitherList',
    'rebukeList', 'interruptList', 'tokenSizeList', 'clockRiderList'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const scene = game.scenes.getName('Battle Flow Test Range');
  const victim = game.actors.getName('BF Test Victim');
  const gol = game.actors.getName('BF Test Goliath');
  if (!scene || !victim || !gol) return { fatal: 'missing fixture: scene, BF Test Victim or BF Test Goliath — run tools/fixture-suite.mjs' };

  const created = { tokens: [], items: [] };
  const priorActor = {};
  let restored = false;
  const realPRNG = CONFIG.Dice.randomUniform;
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const realDice = () => { CONFIG.Dice.randomUniform = realPRNG; };
  const stoneItem = () => gol.items.find(i => i.name === "Stone's Endurance");
  const priorStoneSpent = stoneItem()?.system._source.uses?.spent ?? 0;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    realDice();
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      for (const a of [gol, victim]) {
        const mine = a.effects.filter(e => /^(Large Form|Reaction — used|Halted)$/.test(e.name)).map(e => e.id);
        if (mine.length) await a.deleteEmbeddedDocuments('ActiveEffect', mine).catch(() => {});
      }
      const lent = created.items.filter(id => gol.items.get(id));
      if (lent.length) await gol.deleteEmbeddedDocuments('Item', lent);
      await stoneItem()?.update({ 'system.uses.spent': priorStoneSpent });
      const liveTokens = created.tokens.filter(id => scene.tokens.get(id));
      if (liveTokens.length) await scene.deleteEmbeddedDocuments('Token', liveTokens);
      for (const [actorId, data] of Object.entries(priorActor)) await game.actors.get(actorId)?.update(data);
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BF Test') || m.speaker?.alias === 'Battle Flow' || Object.keys(m.flags?.[MOD] ?? {}).length));
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
    await set('holdTimer', 30);           // the popups wait for the suite's click
    await set('saves', true);
    await set('castApply', true);
    await set('concMode', 'off');
    await set('reminderList', '');
    await set('damageEitherList', '');
    await set('clockRiderList', '');
    await set('rebukeList', def('rebukeList'));
    await set('interruptList', def('interruptList'));
    await set('tokenSizeList', def('tokenSizeList'));

    // -------------------------------------------------- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const strays = scene.tokens.filter(t => [victim.id, gol.id].includes(t.actorId)).map(t => t.id);
    if (strays.length) await scene.deleteEmbeddedDocuments('Token', strays);
    const placeToken = async (actor, x, y) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true, width: 1, height: 1 }, { inplace: false })]);
      created.tokens.push(doc.id);
      for (let i = 0; i < 40 && !(canvas.ready && canvas.tokens.get(doc.id)); i++) await sleep(250);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const g = scene.grid.size;
    const { doc: golDoc } = await placeToken(gol, 1 * g, 12 * g);
    const { doc: victimDoc, token: victimToken } = await placeToken(victim, 7 * g, 12 * g);   // 6 squares: 30 ft
    for (const a of [gol, victim]) {
      priorActor[a.id] = { 'system.attributes.hp.value': a.system._source.attributes.hp.value, 'system.attributes.hp.max': a.system._source.attributes.hp.max };
      await a.update({ 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });
    }
    const heal = async () => { for (const a of [gol, victim]) await a.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 }); };
    const lend = async name => {
      const pack = game.packs.get('dnd-players-handbook.origins');
      const entry = (await pack.getIndex()).find(e => e.name === name);
      if (!entry) throw new Error(`${name} not in the PHB origins pack`);
      const doc = await pack.getDocument(entry._id);
      const [item] = await gol.createEmbeddedDocuments('Item', [doc.toObject()]);
      created.items.push(item.id);
      return item;
    };

    // -------------------------------------------------- helpers
    const waitFor = async (test, timeout = 8000) => {
      const until = Date.now() + timeout;
      while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); }
      return test();
    };
    const since = t => game.messages.filter(m => m.timestamp >= t);
    const flagged = (t, key) => since(t).find(m => m.getFlag(MOD, key)) ?? null;
    const popup = (message, sub) => livePopups.get(`${message.id}|${sub}`) ?? null;
    const press = async (message, sub, action) => {
      const dialog = await waitFor(() => popup(message, sub), 6000);
      const button = dialog?.element?.querySelector(`button[data-action="${action}"]`);
      button?.click();
      return !!button;
    };
    const damagerCard = async () => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: victim }), content: 'BF Test — the damager\'s card' });

    // ================================================== 1. Large Form
    if (want(1)) {
      const lf = await lend('Large Form');
      const data = lf.effects.contents[0].toObject();
      delete data._id;
      const [eff] = await gol.createEmbeddedDocuments('ActiveEffect', [{ ...data, transfer: false, origin: lf.uuid }]);
      const big = await waitFor(() => (golDoc.width === 2) && (golDoc.height === 2), 6000);
      ok('1a. Large Form: the token is 2 × 2 and the sheet reads Large', big && (gol.system.traits.size === 'lg'),
        `w=${golDoc.width} h=${golDoc.height} size=${gol.system.traits.size} changes=${eff?.system?.changes?.map(c => c.key).join(',')}`);
      await eff.delete();
      const back = await waitFor(() => (golDoc.width === 1) && (golDoc.height === 1), 6000);
      ok('1b. the effect removed: 1 × 1 and Medium again', back && (gol.system.traits.size === 'med'), `w=${golDoc.width} size=${gol.system.traits.size}`);
    }

    // ================================================== 2-3. Storm's Thunder
    if (want(2) || want(3)) {
      await set('interruptList', '');     // Stone's Endurance is §4's; one reaction at a time here
      const storm = await lend("Storm's Thunder");
      if (want(2)) {
        await heal();
        const t0 = Date.now();
        const card = await damagerCard();
        await gol.applyDamage([{ value: 5, type: 'slashing', properties: new Set() }], { originatingMessage: card, isDelta: true });
        const offer = await waitFor(() => flagged(t0, 'rebuke'), 6000);
        const flag = offer?.getFlag(MOD, 'rebuke');
        ok('2a. damage from 30 ft away offers the rebuke — Storm\'s Thunder, the damager named, the distance read',
          !!flag && (flag.options?.[0]?.name === "Storm's Thunder") && (flag.sourceUuid === victim.uuid) && (flag.distance === 30) && (flag.options[0].reach === 60),
          JSON.stringify(flag && { opts: flag.options?.map(o => o.name), d: flag.distance, reach: flag.options?.[0]?.reach, src: flag.sourceName }));
        if (offer) {
          const before = victim.system.attributes.hp.value;
          const golBefore = gol.system.attributes.hp.value;
          faces([[6, 8]]);
          const pressed = await press(offer, 'rebuke', 'use-0');
          const hurt = await waitFor(() => victim.system.attributes.hp.value < before, 10000);
          realDice();
          const answered = offer.getFlag(MOD, 'rebuke');
          await sleep(800);
          ok('2b. Use fires Storm\'s Thunder at the damager: the answer recorded, a use spent, the thunder landed on the DAMAGER and never on the Goliath',
            pressed && (answered?.answer === 'use') && (storm.system.uses.spent === 1) && hurt && (gol.system.attributes.hp.value === golBefore),
            `pressed=${pressed} answer=${answered?.answer} spent=${storm.system.uses.spent} victim ${before}→${victim.system.attributes.hp.value} goliath ${golBefore}→${gol.system.attributes.hp.value}`);
        }
      }
      if (want(3)) {
        await heal();
        await victimDoc.update({ x: 15 * g }, { teleport: true, animate: false });   // 14 squares: 70 ft (the range is 2000 px wide)
        await sleep(600);
        const t0 = Date.now();
        const card = await damagerCard();
        await gol.applyDamage([{ value: 5, type: 'slashing', properties: new Set() }], { originatingMessage: card, isDelta: true });
        await sleep(2000);   // load-bearing: the time a WRONG offer would take to appear
        ok('3a. the same damage from 70 ft: no rebuke offered', !flagged(t0, 'rebuke'), JSON.stringify(flagged(t0, 'rebuke')?.getFlag(MOD, 'rebuke') ?? null));
        await victimDoc.update({ x: 7 * g }, { teleport: true, animate: false });
      }
      await set('interruptList', def('interruptList'));
    }

    // ================================================== 4. Stone's Endurance on any damage
    if (want(4)) {
      await set('rebukeList', '');
      await heal();
      const stone = stoneItem();
      await stone.update({ 'system.uses.spent': 0 });
      const t0 = Date.now();
      const card = await damagerCard();
      const share = () => [{ value: 12, type: 'fire', properties: new Set() }];
      // The same share twice, as a save's damage reaches the applier (the walk's two popups).
      await Promise.all([
        applyDamagesWithReceipt(card, [{ uuid: gol.uuid, name: gol.name }], share(), { note: 'BF Test' }),
        applyDamagesWithReceipt(card, [{ uuid: gol.uuid, name: gol.name }], share(), { note: 'BF Test' })
      ]);
      const hold = await waitFor(() => flagged(t0, 'damageHold'), 6000);
      await sleep(1000);   // load-bearing: time for a WRONG second card to appear
      const cards = since(t0).filter(m => m.getFlag(MOD, 'damageHold'));
      ok('4a. the share is held ONCE: one card, one popup, no damage yet',
        !!hold && (cards.length === 1) && (gol.system.attributes.hp.value === 400)
          && ([...livePopups.keys()].filter(k => k.endsWith('|damageHold')).length === 1),
        `cards=${cards.length} hp=${gol.system.attributes.hp.value} popups=${[...livePopups.keys()].join(',')}`);
      if (hold) {
        faces([[5, 12]]);
        const pressed = await press(hold, 'damageHold', 'cast');
        const con = Number(gol.system.abilities.con.mod);
        const expected = 400 - Math.max(0, 12 - (5 + con));
        const landed = await waitFor(() => gol.system.attributes.hp.value === expected, 10000);
        await sleep(1000);   // load-bearing: time for a WRONG second landing
        realDice();
        const entry = card.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === gol.uuid);
        const dice = since(t0).filter(m => /Stone's Endurance — the die/.test(m.flavor ?? ''));
        ok('4b. the click: 1d12 + CON rolled once, a use spent, the damage lands short by it with the receipt saying why',
          pressed && landed && (dice.length === 1) && (stone.system.uses.spent === 1) && /Stone's Endurance — reduced by/.test(entry?.note ?? '')
            && (gol.system.attributes.hp.value === expected),
          `pressed=${pressed} hp=${gol.system.attributes.hp.value} expected=${expected} dice=${dice.length} spent=${stone.system.uses.spent} note=${entry?.note}`);
      }
    }


    // ================================================== 5. Sentinel's Guardian and Halt
    // (the PHB feats, group 6, 2026-09-27): "Immediately after a creature within 5 feet of you ... hits a
    // target other than you with an attack, you can make an Opportunity Attack against that creature" —
    // a WARD: the hostile Victim's attack hits the Cleric beside it, and the Goliath (lent Sentinel, the
    // Victim's other neighbour) is asked; Use drives one melee attack at the Victim, marked an Opportunity
    // Attack, whose hit offers Halt (ticked) and lands the pack's own "Halted" (Speed 0) on the Victim.
    if (want(5)) {
      await set('rebukeList', def('rebukeList'));
      await set('clockRiderList', def('clockRiderList'));
      await set('interruptList', '');          // Stone's Endurance stays out of it
      const pack = game.packs.get('dnd-players-handbook.feats');
      const entry = pack ? (await pack.getIndex()).find(e => e.name === 'Sentinel') : null;
      const doc = entry ? await pack.getDocument(entry._id) : null;
      if (!doc) return { fatal: 'section 5: no Sentinel in dnd-players-handbook.feats', results, log, skips };
      const [sentinel] = await gol.createEmbeddedDocuments('Item', [doc.toObject()]);
      created.items.push(sentinel.id);
      const cleric = game.actors.getName('BF Test Cleric');
      if (!cleric) return { fatal: 'section 5: missing fixture BF Test Cleric — run tools/fixture-suite.mjs', results, log, skips };
      const strayCleric = scene.tokens.filter(t => t.actorId === cleric.id).map(t => t.id);
      if (strayCleric.length) await scene.deleteEmbeddedDocuments('Token', strayCleric);
      priorActor[cleric.id] = { 'system.attributes.hp.value': cleric.system._source.attributes.hp.value };
      priorActor[victim.id]['system.attributes.ac.override'] = victim.system._source.attributes.ac?.override ?? null;
      await heal();
      await victim.update({ 'system.attributes.ac.override': 1 });          // the Opportunity Attack hits
      // The line: Goliath (6) — Victim (7) — Cleric (8), each 5 ft from the Victim; the Cleric friendly.
      await golDoc.update({ x: 6 * g, y: 12 * g }, { teleport: true, animate: false });
      await victimDoc.update({ x: 7 * g, y: 12 * g }, { teleport: true, animate: false });
      const { doc: clericDoc } = await placeToken(cleric, 8 * g, 12 * g);
      await clericDoc.update({ disposition: 1 });
      await sleep(600);
      const act = victim.items.contents.flatMap(i => [...(i.system?.activities ?? [])]).find(a => a.type === 'attack') ?? null;
      if (!act) {
        skips.push('§5: BF Test Victim carries no attack activity — Sentinel unexercised');
      } else {
        // The Victim's attack DAMAGE, on its own card (an attack's damage: the ward's `hit` fact), landed on the Cleric.
        game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: false }));
        await set('autoApply', false);
        const t0 = Date.now();
        const rolls = await act.rollDamage({}, { configure: false }, {});
        const dmg = rolls?.[0]?.parent ?? since(t0).find(m => m.type === 'damage') ?? null;
        await set('autoApply', true);
        await cleric.applyDamage([{ value: 3, type: 'slashing', properties: new Set() }], { originatingMessage: dmg, isDelta: true });
        const offer = await waitFor(() => since(t0).find(m => m.getFlag(MOD, 'rebuke')?.ward), 6000);
        const flag = offer?.getFlag(MOD, 'rebuke');
        ok('5a. the Victim\'s attack hits the Cleric: the Goliath, 5 ft from the Victim, is asked — a ward, Sentinel, an Opportunity Attack',
          !!flag && (flag.actorUuid === gol.uuid) && (flag.sourceUuid === victim.uuid) && (flag.targetName === cleric.name)
            && (flag.distance === 5) && (flag.options?.[0]?.name === 'Sentinel') && (flag.options?.[0]?.opportunity === true),
          JSON.stringify(flag && { actor: flag.actorName, src: flag.sourceName, hurt: flag.targetName, d: flag.distance, opts: flag.options }));
        ok('5b. no one else is asked: not the Cleric it hit, not the Victim',
          !since(t0).some(m => { const r = m.getFlag(MOD, 'rebuke'); return r && ((r.actorUuid === cleric.uuid) || (r.actorUuid === victim.uuid)); }),
          'a ward card named the one hit or the one hitting');
        if (offer) {
          const t1 = Date.now();
          faces([[18, 20]]);
          await press(offer, 'rebuke', 'use-0');
          const attack = await waitFor(() => since(t1).find(m => (m.getFlag(MOD, 'rebukeFor') === offer.id) && m.rolls?.length && m.getFlag(MOD, 'opportunity')), 10000);
          realDice();
          // (Out of combat no Reaction chip is written — spendReaction keeps it for a running combat.)
          ok('5c. Use drives one melee attack at the Victim, its card marked an Opportunity Attack',
            !!attack && (offer.getFlag(MOD, 'rebuke')?.answer === 'use'),
            `attack=${!!attack} answer=${offer.getFlag(MOD, 'rebuke')?.answer}`);
          // The hit: Halt is due on the damage offer (a clock rider — ticked); Roll damages the Victim and lands Halted.
          const dialog = attack ? await waitFor(() => livePopups.get(`${attack.id}|damage`) ?? null, 8000) : null;
          const haltBox = dialog?.element?.querySelector('input[name="bf-rider"][value="sentinel-halt"]');
          ok('5d. the hit\'s damage offer carries Halt, ticked — "Speed 0 for the rest of the current turn"',
            !!haltBox?.checked && /Halt/.test(dialog?.element?.textContent ?? ''),
            `offer=${!!dialog} halt=${haltBox?.checked}`);
          dialog?.element?.querySelector('button[data-action="roll"]')?.click();
          const halted = await waitFor(() => victim.effects.find(e => e.name === 'Halted'), 10000);
          const change = (halted?.changes ?? halted?.system?.changes ?? []).find(c => /movement\.walk|speeds?\.walk/.test(c.key ?? ''));
          ok('5e. the Victim is Halted — the pack\'s own effect (Speed 0), landed with the hit\'s damage',
            !!halted && !!change && (String(change.value) === '0'),
            `halted=${!!halted} change=${JSON.stringify(change ?? null)}`);
          if (halted) await halted.delete().catch(() => {});
          await sleep(400);
        }
      }
      // A hit on the Goliath itself asks it nothing as a ward (its own rebukes are Retaliation's business).
      const t2 = Date.now();
      const own = act ? await act.rollDamage({}, { configure: false }, {}) : null;
      const ownDmg = own?.[0]?.parent ?? null;
      if (ownDmg) await gol.applyDamage([{ value: 3, type: 'slashing', properties: new Set() }], { originatingMessage: ownDmg, isDelta: true });
      await sleep(1500);   // load-bearing: time for a WRONG ward card
      ok('5f. a hit on the Sentinel itself is no ward\'s — "a target other than you"',
        !since(t2).some(m => m.getFlag(MOD, 'rebuke')?.ward), 'a ward card appeared for a hit on the bearer');
      await set('interruptList', def('interruptList'));
    }
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'goliath', out, plan, f });
