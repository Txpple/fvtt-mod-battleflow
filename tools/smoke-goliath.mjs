// Goliath smoke suite: Large Form's token size, the rebuke family within its range (Storm's
// Thunder), Stone's Endurance held before ANY damage lands, and Sentinel's Guardian and Halt.
// Fixtures (tools/fixture-suite.mjs): BTB Test Goliath (friendly), lent the PHB's items for the run;
// BTB Test Victim (hostile) the damager; BTB Test Cleric for §5. Everything written is restored.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'rebukes.js',             // §2, §3 — the offer within reach, the drive at the damager; none out of reach; §6 the miss row, §7 the types judge, §8 Reactive
  'damage-holds.js',        // §4 — the applier's claim, the answer, the reduced landing
  'token-lights.js',        // §1 — Large Form's size on the pack's own effect
  'clock-riders.js'         // §5 — Sentinel's Halt on the driven Opportunity Attack's hit
];

const SECTIONS = {
  1: 'Large Form: the pack\'s effect on the Goliath makes it Large — a 2 × 2 token and "lg" on the sheet — and removing it puts both back',
  2: 'Storm\'s Thunder: damage from a creature 30 ft away offers the rebuke card; Use fires Storm\'s Thunder at the damager — a use spent, its thunder landed with a receipt',
  3: 'the 60-foot reach: the same damage from 70 ft away offers nothing',
  4: 'Stone\'s Endurance on a non-attack damage: the same share reaching the applier twice (a save\'s damage) is held ONCE — one card, one popup; the click rolls 1d12 + CON, spends a use and lands the damage short by the roll with the receipt saying why',
  5: 'Sentinel (the PHB feats, group 6): the hostile Victim\'s attack hits the Cleric beside it — the Goliath (lent Sentinel) 5 ft away is asked, not the Cleric, not the Victim; Use drives an Opportunity Attack (its card marked), whose hit offers Halt ticked and lands the pack\'s "Halted" on the Victim; a hit on the Sentinel itself asks no ward'
};
const DEPENDS = {};
SECTIONS[6] = 'THE GM\'S SIDE — Sticky Shield (2026-09-28): the Goliath\'s melee weapon attack MISSES the Monster (lent the trait, 5 ft away) — the elect stamps a rebuke on the miss; Use puts the Strength save to the Goliath';
SECTIONS[7] = 'Elemental Absorption: fire damage from a card offers it; slashing does not; damage from a card with no dice the module can read offers it (never a guessed exemption)';
SECTIONS[8] = 'Reactive: in combat the Goliath (lent Storm\'s Thunder and Reactive) spends its Reaction on the Victim\'s turn — a second damage the same turn offers nothing; on the Monster\'s turn the Reaction is back and the offer stands';

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'goliath', watchdogMs: 600_000 });
announcePlan('goliath', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-bythebooks';
  const { until, watch, canvasReady, tokenOn, snapshotSettings, faces, unrig } = window.__btb;
  const { results, log, skips, ok, want, section } = window.__btb.begin({ sections, titles });
  const suiteStart = Date.now();

  const mod = game.modules.get(MOD);
  if (!mod?.active) return { fatal: `module active=${mod?.active}` };
  if (!game.settings.settings.has(`${MOD}.decisionTimer`)) return { fatal: 'decisionTimer not registered — OLD code (reload the box)' };
  const { applyDamagesWithReceipt } = await import(`/modules/${MOD}/scripts/auto-apply.js`);
  const { livePopups } = await import(`/modules/${MOD}/scripts/ui.js`);

  const SETTING_KEYS = ['autoDamage', 'autoApply', 'playerRollDamage', 'damageTimer', 'dramaticBeat', 'requireTarget',
    'reactionHold', 'holdTimer', 'saves', 'castApply', 'concMode', 'reminderList', 'damageEitherList',
    'rebukeList', 'interruptList', 'tokenSizeList', 'clockRiderList'];
  const settings = snapshotSettings(SETTING_KEYS);
  const { set } = settings;
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const scene = game.scenes.getName('By the Books Test Range');
  const victim = game.actors.getName('BTB Test Victim');
  const gol = game.actors.getName('BTB Test Goliath');
  if (!scene || !victim || !gol) return { fatal: 'missing fixture: scene, BTB Test Victim or BTB Test Goliath — run tools/fixture-suite.mjs' };

  const created = { tokens: [], items: [] };
  const priorActor = {};
  let restored = false;
  const realDice = () => { unrig(); };
  const stoneItem = () => gol.items.find(i => i.name === "Stone's Endurance");
  const priorStoneSpent = stoneItem()?.system._source.uses?.spent ?? 0;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    realDice();
    for (const failed of await settings.restore()) log.push(`TEARDOWN settings ERROR: ${failed}`);
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
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart)
        && (m.speaker?.alias?.startsWith?.('BTB Test') || m.speaker?.alias === 'By the Books' || Object.keys(m.flags?.[MOD] ?? {}).length));
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

    // ---- fixtures
    if (canvas.scene?.id !== scene.id) await scene.view();
    await canvasReady();
    const strays = scene.tokens.filter(t => [victim.id, gol.id].includes(t.actorId)).map(t => t.id);
    if (strays.length) await scene.deleteEmbeddedDocuments('Token', strays);
    const placeToken = async (actor, x, y) => {
      const [doc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x, y, actorId: actor.id, actorLink: true, width: 1, height: 1 }, { inplace: false })]);
      created.tokens.push(doc.id);
      await tokenOn(doc.id);
      const token = canvas.tokens.get(doc.id);
      if (!token) throw new Error(`${actor.name}'s token never reached the canvas`);
      return { doc, token };
    };
    const g = scene.grid.size;
    const { doc: golDoc } = await placeToken(gol, 1 * g, 12 * g);
    const { doc: victimDoc } = await placeToken(victim, 7 * g, 12 * g);   // 6 squares: 30 ft
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

    // ---- helpers
    // ⚠ `setTarget` is synchronous, and a token's distance is read off its document: an awaited move has landed.
    const since = t => game.messages.filter(m => m.timestamp >= t);
    const flagged = (t, key) => since(t).find(m => m.getFlag(MOD, key)) ?? null;
    const popup = (message, sub) => livePopups.get(`${message.id}|${sub}`) ?? null;
    const press = async (message, sub, action) => {
      // soft: no popup is a press that did not happen (`false`)
      const dialog = await until(() => popup(message, sub), { timeout: 6000 }).catch(() => null);
      const button = dialog?.element?.querySelector(`button[data-action="${action}"]`);
      button?.click();
      return !!button;
    };
    const damagerCard = async () => ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: victim }), content: 'BTB Test — the damager\'s card' });

    // ---- 1. Large Form
    if (want(1)) await section(1, async () => {
      const lf = await lend('Large Form');
      const data = lf.effects.contents[0].toObject();
      delete data._id;
      const [eff] = await gol.createEmbeddedDocuments('ActiveEffect', [{ ...data, transfer: false, origin: lf.uuid }]);
      const big = await until(() => (golDoc.width === 2) && (golDoc.height === 2), { timeout: 6000 });
      ok('1a. Large Form: the token is 2 × 2 and the sheet reads Large', big && (gol.system.traits.size === 'lg'),
        `w=${golDoc.width} h=${golDoc.height} size=${gol.system.traits.size} changes=${eff?.system?.changes?.map(c => c.key).join(',')}`);
      await eff.delete();
      const back = await until(() => (golDoc.width === 1) && (golDoc.height === 1), { timeout: 6000 });
      ok('1b. the effect removed: 1 × 1 and Medium again', back && (gol.system.traits.size === 'med'), `w=${golDoc.width} size=${gol.system.traits.size}`);
    });

    // ---- 2-3. Storm's Thunder
    if (want(2) || want(3)) await section('2-3', async () => {
      await set('interruptList', '');     // Stone's Endurance is §4's; one reaction at a time here
      const storm = await lend("Storm's Thunder");
      if (want(2)) await section(2, async () => {
        await heal();
        const t0 = Date.now();
        const card = await damagerCard();
        await gol.applyDamage([{ value: 5, type: 'slashing', properties: new Set() }], { originatingMessage: card, isDelta: true });
        // soft: no offer fails 2a and skips 2b
        const offer = await until(() => flagged(t0, 'rebuke'), { timeout: 6000 }).catch(() => null);
        const flag = offer?.getFlag(MOD, 'rebuke');
        ok('2a. damage from 30 ft away offers the rebuke — Storm\'s Thunder, the damager named, the distance read',
          !!flag && (flag.options?.[0]?.name === "Storm's Thunder") && (flag.sourceUuid === victim.uuid) && (flag.distance === 30) && (flag.options[0].reach === 60),
          JSON.stringify(flag && { opts: flag.options?.map(o => o.name), d: flag.distance, reach: flag.options?.[0]?.reach, src: flag.sourceName }));
        if (offer) {
          const before = victim.system.attributes.hp.value;
          const golBefore = gol.system.attributes.hp.value;
          let pressed = false;
          let hurt = false;
          faces([[6, 8]]);
          try {
            pressed = await press(offer, 'rebuke', 'use-0');
            hurt = await until(() => victim.system.attributes.hp.value < before, { timeout: 10000 });
          } finally { realDice(); }
          const answered = offer.getFlag(MOD, 'rebuke');
          // a window: no thunder lands on the Goliath (the use's spend lands inside it too)
          const stray = await watch(() => gol.system.attributes.hp.value !== golBefore, { ms: 800 });
          ok('2b. Use fires Storm\'s Thunder at the damager: the answer recorded, a use spent, the thunder landed on the DAMAGER and never on the Goliath',
            !stray && pressed && (answered?.answer === 'use') && (storm.system.uses.spent === 1) && hurt && (gol.system.attributes.hp.value === golBefore),
            `pressed=${pressed} answer=${answered?.answer} spent=${storm.system.uses.spent} victim ${before}→${victim.system.attributes.hp.value} goliath ${golBefore}→${gol.system.attributes.hp.value}`);
        }
      });
      if (want(3)) await section(3, async () => {
        await heal();
        await victimDoc.update({ x: 15 * g }, { teleport: true, animate: false });   // 14 squares: 70 ft (the range is 2000 px wide)
        try {
          await until(() => victimDoc.x === 15 * g, { label: 'the Victim 70 ft away' });
          const t0 = Date.now();
          const card = await damagerCard();
          await gol.applyDamage([{ value: 5, type: 'slashing', properties: new Set() }], { originatingMessage: card, isDelta: true });
          // load-bearing: the time a WRONG offer would take to appear
          const stray = await watch(() => flagged(t0, 'rebuke'), { ms: 2000 });
          ok('3a. the same damage from 70 ft: no rebuke offered', !stray && !flagged(t0, 'rebuke'), JSON.stringify(flagged(t0, 'rebuke')?.getFlag(MOD, 'rebuke') ?? null));
        } finally {
          await victimDoc.update({ x: 7 * g }, { teleport: true, animate: false });
        }
      });
      await set('interruptList', def('interruptList'));
    });

    // ---- 4. Stone's Endurance on any damage
    if (want(4)) await section(4, async () => {
      await set('rebukeList', '');
      await heal();
      const stone = stoneItem();
      await stone.update({ 'system.uses.spent': 0 });
      const t0 = Date.now();
      const card = await damagerCard();
      const share = () => [{ value: 12, type: 'fire', properties: new Set() }];
      // The same share twice, as a save's damage reaches the applier: one card, one landing.
      await Promise.all([
        applyDamagesWithReceipt(card, [{ uuid: gol.uuid, name: gol.name }], share(), { note: 'BTB Test' }),
        applyDamagesWithReceipt(card, [{ uuid: gol.uuid, name: gol.name }], share(), { note: 'BTB Test' })
      ]);
      // soft: no hold fails 4a and skips 4b
      const hold = await until(() => flagged(t0, 'damageHold'), { timeout: 6000 }).catch(() => null);
      const holdPopups = () => [...livePopups.keys()].filter(k => k.endsWith('|damageHold')).length;
      // load-bearing: time for a WRONG second card (or popup, or an early landing) to appear
      const stray4a = await watch(() => (since(t0).filter(m => m.getFlag(MOD, 'damageHold')).length > 1) || (holdPopups() > 1)
        || (gol.system.attributes.hp.value !== 400), { ms: 1000 });
      const cards = since(t0).filter(m => m.getFlag(MOD, 'damageHold'));
      ok('4a. the share is held ONCE: one card, one popup, no damage yet',
        !stray4a && !!hold && (cards.length === 1) && (gol.system.attributes.hp.value === 400)
          && (holdPopups() === 1),
        `cards=${cards.length} hp=${gol.system.attributes.hp.value} popups=${[...livePopups.keys()].join(',')}`);
      if (hold) {
        const con = Number(gol.system.abilities.con.mod);
        const expected = 400 - Math.max(0, 12 - (5 + con));
        const dieCards = () => since(t0).filter(m => /Stone's Endurance — the die/.test(m.flavor ?? ''));
        let pressed = false;
        let landed = false;
        let stray4b = null;
        faces([[5, 12]]);
        try {
          pressed = await press(hold, 'damageHold', 'cast');
          landed = await until(() => gol.system.attributes.hp.value === expected, { timeout: 10000 });
          // load-bearing: time for a WRONG second landing (or a second die)
          stray4b = await watch(() => (gol.system.attributes.hp.value !== expected) || (dieCards().length > 1), { ms: 1000 });
        } finally { realDice(); }
        const entry = card.getFlag(MOD, 'receipt')?.targets?.find(t => t.uuid === gol.uuid);
        const dice = dieCards();
        ok('4b. the click: 1d12 + CON rolled once, a use spent, the damage lands short by it with the receipt saying why',
          !stray4b && pressed && landed && (dice.length === 1) && (stone.system.uses.spent === 1) && /Stone's Endurance — reduced by/.test(entry?.note ?? '')
            && (gol.system.attributes.hp.value === expected),
          `pressed=${pressed} hp=${gol.system.attributes.hp.value} expected=${expected} dice=${dice.length} spent=${stone.system.uses.spent} note=${entry?.note}`);
      }
    });


    // ---- 5. Sentinel's Guardian and Halt: the Victim hits the Cleric beside it, the Goliath (the
    // Victim's other neighbour) is asked; Use drives an Opportunity Attack whose hit offers Halt
    // (ticked) and lands the pack's "Halted" (Speed 0).
    if (want(5)) await section(5, async () => {
      await set('rebukeList', def('rebukeList'));
      await set('clockRiderList', def('clockRiderList'));
      await set('interruptList', '');          // Stone's Endurance stays out of it
      const pack = game.packs.get('dnd-players-handbook.feats');
      const entry = pack ? (await pack.getIndex()).find(e => e.name === 'Sentinel') : null;
      const doc = entry ? await pack.getDocument(entry._id) : null;
      if (!doc) throw new Error('section 5: no Sentinel in dnd-players-handbook.feats');
      const [sentinel] = await gol.createEmbeddedDocuments('Item', [doc.toObject()]);
      created.items.push(sentinel.id);
      const cleric = game.actors.getName('BTB Test Cleric');
      if (!cleric) throw new Error('section 5: missing fixture BTB Test Cleric — run tools/fixture-suite.mjs');
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
      await until(() => (golDoc.x === 6 * g) && (victimDoc.x === 7 * g) && (clericDoc.disposition === 1), { label: 'the line set: Goliath, Victim, Cleric (friendly)' });
      const act = victim.items.contents.flatMap(i => [...(i.system?.activities ?? [])]).find(a => a.type === 'attack') ?? null;
      if (!act) {
        skips.push('§5: BTB Test Victim carries no attack activity — Sentinel unexercised');
      } else {
        // The Victim's attack DAMAGE, on its own card (an attack's damage: the ward's `hit` fact), landed on the Cleric.
        game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: false }); });
        await set('autoApply', false);
        const t0 = Date.now();
        const rolls = await act.rollDamage({}, { configure: false }, {});
        const dmg = rolls?.[0]?.parent ?? since(t0).find(m => m.type === 'damage') ?? null;
        await set('autoApply', true);
        await cleric.applyDamage([{ value: 3, type: 'slashing', properties: new Set() }], { originatingMessage: dmg, isDelta: true });
        // soft: no ward fails 5a and skips 5c–5e
        const offer = await until(() => since(t0).find(m => m.getFlag(MOD, 'rebuke')?.ward), { timeout: 6000 }).catch(() => null);
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
          let attack = null;
          faces([[18, 20]]);
          try {
            await press(offer, 'rebuke', 'use-0');
            // soft: no attack fails 5c and asks for no damage offer
            attack = await until(() => since(t1).find(m => (m.getFlag(MOD, 'rebukeFor') === offer.id) && m.rolls?.length && m.getFlag(MOD, 'opportunity')), { timeout: 10000 }).catch(() => null);
          } finally { realDice(); }
          // (Out of combat no Reaction chip is written — spendReaction keeps it for a running combat.)
          ok('5c. Use drives one melee attack at the Victim, its card marked an Opportunity Attack',
            !!attack && (offer.getFlag(MOD, 'rebuke')?.answer === 'use'),
            `attack=${!!attack} answer=${offer.getFlag(MOD, 'rebuke')?.answer}`);
          // The hit: Halt is due on the damage offer (a clock rider — ticked); Roll damages the Victim and lands Halted.
          const dialog = attack ? await until(() => livePopups.get(`${attack.id}|damage`) ?? null, { timeout: 8000 }) : null;
          const haltBox = dialog?.element?.querySelector('input[name="bf-rider"][value="sentinel-halt"]');
          ok('5d. the hit\'s damage offer carries Halt, ticked — "Speed 0 for the rest of the current turn"',
            !!haltBox?.checked && /Halt/.test(dialog?.element?.textContent ?? ''),
            `offer=${!!dialog} halt=${haltBox?.checked}`);
          dialog?.element?.querySelector('button[data-action="roll"]')?.click();
          // soft: no Halted fails 5e, and there is nothing to delete
          const halted = await until(() => victim.effects.find(e => e.name === 'Halted'), { timeout: 10000 }).catch(() => null);
          const change = (halted?.changes ?? halted?.system?.changes ?? []).find(c => /movement\.walk|speeds?\.walk/.test(c.key ?? ''));
          ok('5e. the Victim is Halted — the pack\'s own effect (Speed 0), landed with the hit\'s damage',
            !!halted && !!change && (String(change.value) === '0'),
            `halted=${!!halted} change=${JSON.stringify(change ?? null)}`);
          if (halted) await halted.delete().catch(() => {});
          await until(() => !victim.effects.find(e => e.name === 'Halted'), { label: 'the Victim clear of Halted' });
        }
      }
      // A hit on the Goliath itself asks it nothing as a ward (its own rebukes are Retaliation's business).
      const t2 = Date.now();
      const own = act ? await act.rollDamage({}, { configure: false }, {}) : null;
      const ownDmg = own?.[0]?.parent ?? null;
      if (ownDmg) await gol.applyDamage([{ value: 3, type: 'slashing', properties: new Set() }], { originatingMessage: ownDmg, isDelta: true });
      // load-bearing: time for a WRONG ward card
      const stray5f = await watch(() => since(t2).some(m => m.getFlag(MOD, 'rebuke')?.ward), { ms: 1500 });
      ok('5f. a hit on the Sentinel itself is no ward\'s — "a target other than you"',
        !stray5f && !since(t2).some(m => m.getFlag(MOD, 'rebuke')?.ward), 'a ward card appeared for a hit on the bearer');
      await set('interruptList', def('interruptList'));
    });

    // ---- 6–8. the GM's side
    const monster = game.actors.getName('BTB Test Monster');
    const lendMM = async (actor, name) => {
      const pack = game.packs.get('dnd-monster-manual.features');
      const hit = (await pack?.getIndex())?.find(e => e.name === name);
      if (!hit) throw new Error(`the Monster Manual ships no "${name}" this box can find`);
      const [item] = await actor.createEmbeddedDocuments('Item', [(await pack.getDocument(hit._id)).toObject()]);
      if (actor === gol) created.items.push(item.id);
      return item;
    };
    if ((want(6) || want(8)) && !monster) skips.push('§6/§8: BTB Test Monster missing — run tools/fixture-suite.mjs');

    if (want(6) && monster) await section(6, async () => {
      let sticky = null;
      const priorMonAc = monster.system._source.attributes?.ac?.flat ?? null, priorMonCalc = monster.system._source.attributes?.ac?.calc ?? 'default';
      try {
        await set('interruptList', '');
        await heal();
        // The Monster's FIXTURE token (a second token would be found first by uuid and measured instead): the Goliath moves beside it.
        const monDoc = scene.tokens.find(t => t.actorId === monster.id) ?? (await placeToken(monster, 2 * g, 12 * g)).doc;
        await golDoc.update({ x: monDoc.x - g, y: monDoc.y }, { teleport: true, animate: false });
        await until(() => (golDoc.x === monDoc.x - g) && (golDoc.y === monDoc.y), { label: 'the Goliath beside the Monster' });
        sticky = await lendMM(monster, 'Sticky Shield');
        await monster.update({ 'system.attributes.ac.calc': 'flat', 'system.attributes.ac.flat': 99 });   // every swing misses
        const weapon = gol.items.find(i => (i.type === 'weapon') && [...(i.system.activities ?? [])].some(a => (a.type === 'attack') && (a.attack?.type?.value === 'melee')));
        const act = weapon ? [...weapon.system.activities].find(a => a.type === 'attack') : null;
        if (!act) skips.push('§6: the Goliath holds no melee weapon — the miss unexercised');
        else {
          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
          canvas.tokens.get(monDoc.id)?.setTarget(true, { releaseOthers: true });
          const t0 = Date.now();
          faces([[5, 20]]);
          try {
            const use = await act.use({ subsequentActions: false }, { configure: false }, {});
            await act.rollAttack({}, { configure: false }, { data: use?.message?.id ? { 'system.origin': use.message.id } : {} });
          } finally { realDice(); }
          // soft: no stamp fails 6a and skips 6b
          const offer = await until(() => since(t0).find(m => m.getFlag(MOD, 'rebuke')?.miss), { timeout: 8000 }).catch(() => null);
          const flag = offer?.getFlag(MOD, 'rebuke');
          ok('6a. the miss stamps a rebuke for the Monster: Sticky Shield, the Goliath the source, 5 ft, "missed" on the card',
            !!flag && (flag.actorUuid === monster.uuid) && (flag.sourceUuid === gol.uuid) && (flag.options?.[0]?.name === 'Sticky Shield') && (flag.distance === 5) && /missed/.test(offer?.content ?? ''),
            JSON.stringify(flag && { actor: flag.actorName, src: flag.sourceName, d: flag.distance, opts: flag.options?.map(o => o.name), miss: flag.miss }));
          if (offer) {
            const t1 = Date.now();
            await press(offer, 'rebuke', 'use-0');
            const demand = await until(() => since(t1).find(m => m.getFlag(MOD, 'rebukeFor') === offer.id && m.getFlag(MOD, 'saves')), { timeout: 10000 });
            const sv = demand?.getFlag(MOD, 'saves');
            ok('6b. Use puts the Strength save to the Goliath — the trait\'s own activity, the demand aimed at the attacker',
              !!sv && (sv.abilities?.[0] === 'str') && (sv.targets?.length === 1) && (sv.targets[0].uuid === gol.uuid) && (offer.getFlag(MOD, 'rebuke')?.answer === 'use'),
              `demand=${!!demand} saves=${JSON.stringify(sv && { abilities: sv.abilities, dc: sv.dc, targets: sv.targets.map(t => t.name) })}`);
          }
        }
      } finally {
        game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
        await monster.update({ 'system.attributes.ac.calc': priorMonCalc, 'system.attributes.ac.flat': priorMonAc });
        await sticky?.delete().catch(() => {});
        for (const app of livePopups.values()) { try { await app.close(); } catch { /* gone */ } }
        await set('interruptList', def('interruptList'));
      }
    });

    if (want(7)) await section(7, async () => {
      let absorb = null;
      try {
        await set('interruptList', '');
        await heal();
        absorb = await lendMM(gol, 'Elemental Absorption');
        const typedCard = async type => {
          const roll = await new CONFIG.Dice.DamageRoll('5', {}, { type, isCritical: false }).evaluate();
          return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: victim }), rolls: [roll], flavor: `BTB test — ${type}` });
        };
        const t0 = Date.now();
        await gol.applyDamage([{ value: 5, type: 'fire', properties: new Set() }], { originatingMessage: await typedCard('fire'), isDelta: true });
        // soft: no offer reads as no options in 7a
        const offer = await until(() => since(t0).find(m => m.getFlag(MOD, 'rebuke')?.actorUuid === gol.uuid), { timeout: 6000 }).catch(() => null);
        ok('7a. fire damage from a card offers Elemental Absorption — a self row, no reach measured',
          (offer?.getFlag(MOD, 'rebuke')?.options ?? []).some(o => o.name === 'Elemental Absorption'),
          JSON.stringify(offer?.getFlag(MOD, 'rebuke')?.options?.map(o => o.name)));
        for (const app of livePopups.values()) { try { await app.close(); } catch { /* gone */ } }
        const t1 = Date.now();
        await gol.applyDamage([{ value: 5, type: 'slashing', properties: new Set() }], { originatingMessage: await typedCard('slashing'), isDelta: true });
        const absorbs = m => (m.getFlag(MOD, 'rebuke')?.options ?? []).some(o => o.name === 'Elemental Absorption');
        const stray7b = await watch(() => since(t1).some(absorbs), { ms: 1500 });   // a window: no Elemental Absorption offer
        ok('7b. slashing damage never offers Elemental Absorption — the card names a type the row does not (Storm’s Thunder, lent in §2, may still be offered)',
          !stray7b && !since(t1).some(m => (m.getFlag(MOD, 'rebuke')?.options ?? []).some(o => o.name === 'Elemental Absorption')), '');
        const t2 = Date.now();
        await gol.applyDamage([{ value: 5, type: 'slashing', properties: new Set() }], { originatingMessage: await damagerCard(), isDelta: true });
        // soft: no offer reads as no options in 7c
        const blind = await until(() => since(t2).find(m => m.getFlag(MOD, 'rebuke')?.actorUuid === gol.uuid), { timeout: 6000 }).catch(() => null);
        ok('7c. damage from a card with no dice the module can read COUNTS the row (never a guessed exemption)',
          (blind?.getFlag(MOD, 'rebuke')?.options ?? []).some(o => o.name === 'Elemental Absorption'), JSON.stringify(blind?.getFlag(MOD, 'rebuke')?.options?.map(o => o.name)));
      } finally {
        for (const app of livePopups.values()) { try { await app.close(); } catch { /* gone */ } }
        await absorb?.delete().catch(() => {});
        await set('interruptList', def('interruptList'));
      }
    });

    if (want(8) && monster) await section(8, async () => {
      let combat = null;
      let reactive = null;
      const priorActive = [];
      try {
        await set('interruptList', '');
        await heal();
        const storm = gol.items.find(i => i.name === "Storm's Thunder") ?? await lend("Storm's Thunder");
        reactive = await lendMM(gol, 'Reactive');
        const monDoc = scene.tokens.find(t => t.actorId === monster.id) ?? (await placeToken(monster, 3 * g, 12 * g)).doc;
        await golDoc.update({ x: 1 * g, y: 12 * g }, { teleport: true, animate: false });
        await victimDoc.update({ x: 7 * g, y: 12 * g }, { teleport: true, animate: false });
        for (const c of game.combats.filter(c => c.active)) { priorActive.push(c.id); await c.update({ active: false }); }
        combat = await Combat.create({ scene: scene.id, active: true });
        await combat.createEmbeddedDocuments('Combatant', [
          { tokenId: victimDoc.id, actorId: victim.id, initiative: 20 }, { tokenId: monDoc.id, actorId: monster.id, initiative: 15 }, { tokenId: golDoc.id, actorId: gol.id, initiative: 10 }]);
        await combat.startCombat();   // the Victim's turn
        if (game.combat?.id !== combat.id) { try { ui.combat.viewed = combat; } catch { /* the tracker */ } }
        await until(() => combat.started && (combat.combatant?.tokenId === victimDoc.id), { label: 'the combat started on the Victim\'s turn' });
        const refill = () => storm.update({ 'system.uses.spent': 0 });
        await refill();
        const t0 = Date.now();
        await gol.applyDamage([{ value: 3, type: 'slashing', properties: new Set() }], { originatingMessage: await damagerCard(), isDelta: true });
        // soft: no offer is 8-pre's failure
        const offer = await until(() => since(t0).find(m => m.getFlag(MOD, 'rebuke')?.actorUuid === gol.uuid), { timeout: 6000 }).catch(() => null);
        if (!offer) ok('8-pre. the first damage offers Storm\'s Thunder', false, 'no offer');
        else {
          faces([[6, 8]]);
          try {
            await press(offer, 'rebuke', 'use-0');
            await until(() => offer.getFlag(MOD, 'rebuke')?.answer === 'use', { timeout: 8000 });
          } finally { realDice(); }
          const spent = await until(() => gol.effects.find(e => e.getFlag(MOD, 'mastery') === 'reaction') ?? null, { timeout: 7200 });
          ok('8a. Use spends the Reaction: the chip stands on the Goliath (in combat)', !!spent, `chips=${gol.effects.filter(e => e.getFlag(MOD, 'mastery')).map(e => e.name).join(',')}`);
          await refill();
          const t1 = Date.now();
          await gol.applyDamage([{ value: 3, type: 'slashing', properties: new Set() }], { originatingMessage: await damagerCard(), isDelta: true });
          const stray8b = await watch(() => since(t1).some(m => m.getFlag(MOD, 'rebuke')?.actorUuid === gol.uuid), { ms: 1500 });   // a window: no second offer this turn
          ok('8b. a second damage on the SAME turn offers nothing — the Reaction is spent', !stray8b && !since(t1).some(m => m.getFlag(MOD, 'rebuke')?.actorUuid === gol.uuid), '');
          await combat.nextTurn();   // the Monster's turn — not the Goliath's
          // the spent Reaction is judged by stamp against the combat's turn: the moved turn is all it reads
          await until(() => combat.combatant?.tokenId === monDoc.id, { label: 'the Monster\'s turn' });
          const t2 = Date.now();
          await gol.applyDamage([{ value: 3, type: 'slashing', properties: new Set() }], { originatingMessage: await damagerCard(), isDelta: true });
          const again = await until(() => since(t2).find(m => m.getFlag(MOD, 'rebuke')?.actorUuid === gol.uuid), { timeout: 6000 });
          ok('8c. on the NEXT turn (the Monster\'s, not the Goliath\'s) the offer stands again — Reactive gives the Reaction back every turn', !!again, `offer=${!!again}`);
        }
      } finally {
        for (const app of livePopups.values()) { try { await app.close(); } catch { /* gone */ } }
        try { if (combat && game.combats.get(combat.id)) await combat.delete(); } catch { /* gone */ }
        for (const id of priorActive) { try { await game.combats.get(id)?.update({ active: true }); } catch { /* gone */ } }
        await reactive?.delete().catch(() => {});
        const chips = gol.effects.filter(e => e.getFlag(MOD, 'mastery')).map(e => e.id);
        if (chips.length) await gol.deleteEmbeddedDocuments('ActiveEffect', chips).catch(() => {});
        await set('interruptList', def('interruptList'));
      }
    });
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'goliath', out, plan, f });
