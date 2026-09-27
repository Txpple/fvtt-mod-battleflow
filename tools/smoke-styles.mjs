// Fighting-style smoke suite: one table, gated on what the PC holds, the styles shown as effects
// on the player. BF Test Fighter (tools/fixture-suite.mjs) is lent the PHB's styles, feats and
// weapons for the run (its own gear unequipped and put back). Damage is rolled straight off the
// weapon's attack activity in its attack mode, dice forced; BF Test Victim stands targeted.
// Settings, lent items, the token, messages and equipped boxes are all restored.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'fighting-styles.js',   // §1–§2 the faces off the equipped boxes; §3–§6 the numbers, the lines, the record, the float; §8 the switch; §11 Great Weapon Master; §12 Heavy Armor Master's block; §13 Elemental Adept and Poisoner; §14 Crossbow Expert's Dual Wielding; §15 Elemental Adept's type pick
  'unarmed-dice.js',      // §7 Unarmed Fighting's die by what the hands hold (the `hands` row)
  'reminders.js'          // §9 Blind Fighting — who sees the unseen: Invisible listed, not counted, within Blindsight
];

const SECTIONS = {
  1: 'the faces: Chain Mail, a Longsword and a Shield — Defense live (its AC on the face, the pack effect switched off), Dueling live, Great Weapon Fighting live (the Longsword is Versatile), Thrown always on (the thrown mode is its gate), Two-Weapon off with why',
  2: 'a Dagger joins and the armor comes off: Dueling off ("a second weapon held (Dagger)"), Defense off and the AC one lower',
  3: 'Dueling: the Longsword one-handed rolls +2 with "Dueling — +2" and the record; two-handed it adds nothing and says why',
  4: 'Great Weapon Fighting: the Greatsword rolls 1 and 5 — the 1 counts as 3, "1 → 3: +2", the record, the chips, the dice off the fighter; 4 and 6 leave no trace',
  5: 'Thrown Weapon Fighting: the Javelin thrown rolls +2; swung in melee it does not',
  6: 'Two-Weapon Fighting: the Dagger off-hand adds the modifier back',
  7: 'Unarmed Fighting: the sheet\'s Unarmed Strike rolls the d8 with the hands empty, the d6 with a Shield held, and says so',
  8: 'off the list: the faces go and the pack\'s own Defense and Dueling effects come back on',
  9: 'Blind Fighting: an Invisible victim 5 ft away is seen (listed, net Normal); 15 ft away it is not (Disadvantage); the Invisible victim attacking the fighter loses its Advantage',
  11: `Great Weapon Master (the PHB feats, 2026-09-26): its face live off the Greatsword; the Greatsword's damage rolls +PB with "Great Weapon Master — +N"; the Longsword adds nothing; on someone else's turn, "Great Weapon Master off — not your turn"`,
  12: `Heavy Armor Master: its face live in Chain Mail and the pack's own reduction switched off; an attack's 9 slashing lands 9 − PB (the calculation says "blocked", the actor's update carries the pop); a bare 9 (no attack card) lands whole; out of the armor the attack's 9 lands whole`,
  13: `Elemental Adept and Poisoner (the PHB feats, group 1, 2026-09-26): "Elemental Adept (Fire)" — its face live "Fire"; Fire Bolt's 1s count as 2 ("1 → 2"), the record; its fire damage ignores the victim's Fire Resistance (the calculation says so), a weapon's fire damage does not; renamed with no type the face is off and says how; Poisoner — a weapon card's poison ignores Resistance to Poison`,
  14: `Crossbow Expert's Dual Wielding (group 2): a Hand Crossbow and a Dagger held — its face live; the Hand Crossbow's off-hand damage adds the modifier back ("Crossbow Expert — +N on the off-hand"); beside Two-Weapon Fighting the modifier is added ONCE`,
  15: `Elemental Adept's type pick (the walk, 2026-09-26): a typeless copy landing posts the pick card and opens the popup (five types); Cold renames it "Elemental Adept (Cold)" and the card says chosen; a second copy is offered four (no Cold); renamed by hand "(Acid)" the card settles and the popup closes; a third copy's own card (a click on the sheet) asks too`,
  10: 'Unarmed Fighting at the start of the turn: the fighter grapples the victim — a card and a popup "Deal 1d4 …?"; Deal it lands the damage; next turn Skip deals nothing; with a clock, the clock deals it'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'styles', watchdogMs: 420_000 });
announcePlan('styles', plan, pulled);

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

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  if (!game.settings.settings.has(`${MOD}.decisionTimer`)) return { fatal: 'decisionTimer not registered — OLD code (reload the box)' };

  const SETTING_KEYS = ['fightingStyleList', 'unarmedDiceList', 'autoDamage', 'autoApply', 'riders', 'effectRiders', 'masteryRiders',
    'clockRiderList', 'damageEitherList', 'reminderList', 'holdTimer'];
  const prior = Object.fromEntries(SETTING_KEYS.map(k => [k, game.settings.get(MOD, k)]));
  const set = (k, v) => game.settings.set(MOD, k, v);
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const scene = game.scenes.getName('Battle Flow Test Range');
  const actor = game.actors.getName('BF Test Fighter');
  const victim = game.actors.getName('BF Test Victim');
  if (!scene || !actor || !victim) return { fatal: 'missing fixture: the range, BF Test Fighter or BF Test Victim — run tools/fixture-suite.mjs' };

  const realPRNG = CONFIG.Dice.randomUniform;
  const faces = spec => {
    const queue = spec.map(([n, of]) => 1 - ((n - 0.5) / of));
    let i = 0;
    CONFIG.Dice.randomUniform = () => queue[Math.min(i++, queue.length - 1)];
  };
  const realFloat = canvas.interface?.createScrollingText?.bind(canvas.interface);
  const floats = [];
  if (canvas.interface) canvas.interface.createScrollingText = (origin, text, opts) => { floats.push(String(text)); return realFloat?.(origin, text, opts); };
  const dicePlays = [];
  const diceHook = Hooks.on('battleflow.styleDice', p => dicePlays.push(p));

  const equippedBefore = actor.items.filter(i => i.system?.equipped === true).map(i => i.id);
  const lent = [];
  const placed = [];
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    CONFIG.Dice.randomUniform = realPRNG;
    if (canvas.interface && realFloat) canvas.interface.createScrollingText = realFloat;
    Hooks.off('battleflow.styleDice', diceHook);
    try { for (const [k, v] of Object.entries(prior)) await set(k, v); }
    catch (err) { log.push(`TEARDOWN settings ERROR: ${err?.message}`); }
    try {
      const live = placed.filter(id => scene.tokens.get(id));
      if (live.length) await scene.deleteEmbeddedDocuments('Token', live);
      const gone = lent.filter(id => actor.items.get(id));
      if (gone.length) await actor.deleteEmbeddedDocuments('Item', gone);
      const back = actor.items.filter(i => ('equipped' in (i.system ?? {}))).map(i => ({ _id: i.id, 'system.equipped': equippedBefore.includes(i.id) }));
      if (back.length) await actor.updateEmbeddedDocuments('Item', back);
      await sleep(600);   // the faces' own sync after the list comes back
      game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart) && ((m.speaker?.actor === actor.id) || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('fightingStyleList', def('fightingStyleList'));
    await set('unarmedDiceList', def('unarmedDiceList'));
    await set('autoDamage', 'off');
    await set('autoApply', false);
    await set('riders', false);
    await set('effectRiders', false);
    await set('masteryRiders', false);
    await set('clockRiderList', '');
    await set('damageEitherList', '');   // Savage Attacker's popup is not this suite's
    await set('reminderList', '');

    // ---- fixtures
    // By name AND type: the PHB has a Shield SPELL beside the Shield.
    const findPHB = async (name, type = null) => {
      for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
        const hit = (await pack.getIndex({ fields: ['type'] })).find(e => (e.name === name) && (!type || (e.type === type)));
        if (hit) return pack.getDocument(hit._id);
      }
      return null;
    };
    const lend = async (name, type = null) => {
      const own = actor.items.find(i => i.name === name && !lent.includes(i.id));
      if (own && ['Great Weapon Fighting', 'Great Weapon Master', 'Heavy Armor Master', 'Elemental Adept', 'Poisoner', 'Crossbow Expert'].includes(name)) return own;   // the fixture's own
      const source = await findPHB(name, type);
      if (!source) throw new Error(`the PHB ships no "${name}" this box can find`);
      const data = source.toObject();
      if ('equipped' in (data.system ?? {})) data.system.equipped = false;
      const [item] = await actor.createEmbeddedDocuments('Item', [data]);
      lent.push(item.id);
      return item;
    };
    // everything the fighter wears or holds comes off for the run
    const off = actor.items.filter(i => i.system?.equipped === true).map(i => ({ _id: i.id, 'system.equipped': false }));
    if (off.length) await actor.updateEmbeddedDocuments('Item', off);
    for (const style of ['Great Weapon Fighting', 'Thrown Weapon Fighting', 'Two-Weapon Fighting', 'Dueling', 'Defense', 'Unarmed Fighting', 'Blind Fighting']) await lend(style, 'feat');
    const gear = {};
    for (const name of ['Greatsword', 'Longsword', 'Dagger', 'Javelin', 'Unarmed Strike']) gear[name] = await lend(name, 'weapon');
    for (const name of ['Shield', 'Chain Mail']) gear[name] = await lend(name, 'equipment');
    const equip = async (names) => {
      const writes = Object.values(gear).filter(i => 'equipped' in (i.system ?? {})).map(i => ({ _id: i.id, 'system.equipped': names.includes(i.name) }));
      await actor.updateEmbeddedDocuments('Item', writes);
      await sleep(900);   // the faces follow on the elect's debounce
    };

    if (canvas.scene?.id !== scene.id) await scene.view();
    for (let i = 0; i < 40 && !canvas.ready; i++) await sleep(250);
    const [vdoc] = await scene.createEmbeddedDocuments('Token', [
      foundry.utils.mergeObject(victim.prototypeToken.toObject(), { x: 1400, y: 1900, actorId: victim.id, actorLink: true }, { inplace: false })]);
    placed.push(vdoc.id);
    for (let i = 0; i < 40 && !canvas.tokens.get(vdoc.id); i++) await sleep(250);
    canvas.tokens.get(vdoc.id)?.setTarget(true, { releaseOthers: true });

    // ---- helpers
    const face = name => actor.effects.find(e => (e.getFlag(MOD, 'fightingStyle')?.key) && (e.name === name)) ?? null;
    const faceLine = name => face(name)?.getFlag(MOD, 'fightingStyle')?.detail ?? '';
    const packEffect = name => actor.items.find(i => (i.type === 'feat') && (i.name === name))?.effects?.find(e => (e.changes ?? []).length) ?? null;
    const textOf = id => (document.querySelector(`.message[data-message-id="${id}"]`)?.textContent ?? '').replace(/\s+/g, ' ');
    // The style lines draw the dice as chips; each keeps its words on data-bf-style-line.
    const linesOf = id => [...(document.querySelector(`.message[data-message-id="${id}"]`)?.querySelectorAll('.bf-fighting-style-line') ?? [])]
      .map(e => e.dataset.bfStyleLine ?? '').join(' | ');
    const chipsOf = id => [...(document.querySelector(`.message[data-message-id="${id}"]`)?.querySelectorAll('.bf-fighting-style-line .bf-chip') ?? [])]
      .map(e => `${e.classList.contains('up') ? '*' : ''}${(e.querySelector('.now') ?? e.querySelector('b'))?.textContent ?? ''}`).join(' ');
    const attackOf = item => item.system.activities.find(a => a.type === 'attack');
    /** Roll a weapon's damage in one mode, the dice forced; returns the damage message. */
    const damage = async (item, mode, spec) => {
      const t0 = Date.now();
      faces(spec);
      await attackOf(item).rollDamage({ attackMode: mode, isCritical: false }, { configure: false }, {});
      CONFIG.Dice.randomUniform = realPRNG;
      for (let i = 0; i < 30; i++) {
        const m = game.messages.contents.filter(x => (x.timestamp >= t0) && (x.type === 'damage')).pop();
        if (m) { await sleep(300); return m; }
        await sleep(150);
      }
      return null;
    };
    const style = (msg, key) => (msg?.getFlag(MOD, 'fightingStyle')?.styles ?? []).find(s => s.key === key) ?? null;

    // ---- 1. the faces
    if (want(1)) {
      const acBare = actor.system.attributes.ac.value;
      await equip(['Chain Mail', 'Longsword', 'Shield']);
      const d = face('Defense'), du = face('Dueling'), g = face('Great Weapon Fighting'), t = face('Thrown Weapon Fighting'), w = face('Two-Weapon Fighting');
      ok('1a. Defense live: its face on, "Chain Mail", the pack\'s own effect switched off (flagged)',
        !!d && !d.disabled && /Chain Mail/.test(faceLine('Defense')) && packEffect('Defense')?.disabled === true
          && packEffect('Defense')?.getFlag(MOD, 'fightingStyleTakenOver') === true,
        `face=${!!d} disabled=${d?.disabled} line="${faceLine('Defense')}" pack=${packEffect('Defense')?.disabled}`);
      ok('1b. the face carries the pack\'s AC change (+1)', (d?.changes ?? []).some(c => /ac\./.test(c.key) && String(c.value) === '1'),
        JSON.stringify(d?.changes ?? []));
      ok('1c. Dueling live: "Longsword in one hand", the pack\'s own effect off', !!du && !du.disabled && /Longsword in one hand/.test(faceLine('Dueling'))
        && packEffect('Dueling')?.disabled === true, `line="${faceLine('Dueling')}"`);
      ok('1d. Great Weapon Fighting live off the Versatile Longsword', !!g && !g.disabled && /Longsword, two hands/.test(faceLine('Great Weapon Fighting')),
        `line="${faceLine('Great Weapon Fighting')}"`);
      ok('1e. Thrown always on (its gate is the thrown mode); Two-Weapon off, with why', !!t && !t.disabled
        && !!w && w.disabled && /not holding two weapons/.test(faceLine('Two-Weapon Fighting')),
        `thrown="${faceLine('Thrown Weapon Fighting')}" twf="${faceLine('Two-Weapon Fighting')}"`);
      log.push(`§1 AC bare=${acBare} armored=${actor.system.attributes.ac.value}`);
    }

    // ---- 2. the gates close
    if (want(2)) {
      await equip(['Chain Mail', 'Longsword', 'Shield']);
      const acOn = actor.system.attributes.ac.value;
      await equip(['Longsword', 'Dagger', 'Shield']);
      const acShieldOnly = actor.system.attributes.ac.value;
      await equip(['Chain Mail', 'Longsword', 'Dagger', 'Shield']);
      ok('2a. a Dagger joins: Dueling off, "a second weapon held (Dagger)"', face('Dueling')?.disabled === true
        && /a second weapon held \(Dagger\)/.test(faceLine('Dueling')), `line="${faceLine('Dueling')}"`);
      await equip(['Longsword', 'Shield']);
      ok('2b. the armor off: Defense off, "no armor worn"', face('Defense')?.disabled === true && /no armor worn/.test(faceLine('Defense')),
        `line="${faceLine('Defense')}"`);
      await equip(['Chain Mail', 'Longsword', 'Shield']);
      const acBack = actor.system.attributes.ac.value;
      await equip(['Longsword', 'Shield']);
      const acNoArmor = actor.system.attributes.ac.value;
      ok('2c. the AC follows: the face\'s +1 is in the armored AC and gone without it', (acBack === acOn) && Number.isFinite(acNoArmor) && (acNoArmor !== acBack),
        `armored=${acOn}/${acBack} shield only=${acShieldOnly} no armor=${acNoArmor}`);
    }

    // ---- 3. Dueling's number
    if (want(3)) {
      await equip(['Longsword', 'Shield']);
      const one = await damage(gear.Longsword, 'oneHanded', [[5, 8]]);
      const s = style(one, 'dueling');
      ok('3a. one-handed: +2 on the roll, the record (gain 2), "Dueling — +2" on the card',
        (s?.gain === 2) && /(^|\D)2(\D|$)/.test(one?.rolls?.[0]?.formula ?? '') && /Dueling — \+2/.test(linesOf(one?.id)),
        `formula="${one?.rolls?.[0]?.formula}" style=${JSON.stringify(s)} lines="${linesOf(one?.id)}"`);
      ok('3b. the record carries the stats context', ('combat' in (one?.getFlag(MOD, 'fightingStyle') ?? {})) && (one?.getFlag(MOD, 'fightingStyle')?.sourceUuid === actor.uuid),
        JSON.stringify(one?.getFlag(MOD, 'fightingStyle')));
      const two = await damage(gear.Longsword, 'twoHanded', [[5, 10]]);
      const s2 = style(two, 'dueling');
      ok('3c. two-handed: nothing added, "Dueling off — two hands"', !s2?.gain && /Dueling off — two hands/.test(linesOf(two?.id)),
        `style=${JSON.stringify(s2)} formula="${two?.rolls?.[0]?.formula}"`);
    }

    // ---- 4. Great Weapon Fighting's floor
    if (want(4)) {
      await equip(['Greatsword']);
      dicePlays.length = 0;
      const low = await damage(gear.Greatsword, 'twoHanded', [[1, 6], [5, 6]]);
      const s = style(low, 'great-weapon-fighting');
      const dice = low?.rolls?.[0]?.dice?.[0]?.results ?? [];
      ok('4a. the 1 counts as 3: the die kept its face and counts 3, the record raised 1 → 3, gain 2',
        (s?.gain === 2) && (s?.raised?.[0]?.from === 1) && (s?.raised?.[0]?.to === 3) && dice.some(r => (r.result === 1) && (r.count === 3)),
        `style=${JSON.stringify(s)} dice=${JSON.stringify(dice)} formula="${low?.rolls?.[0]?.formula}"`);
      ok('4b. the card: "Great Weapon Fighting — 1 → 3: +2", the dice as chips, the 1 turned to a gold-edged 3',
        /Great Weapon Fighting — 1 → 3: \+2/.test(linesOf(low?.id)) && /\*3/.test(chipsOf(low?.id)) && /(^| )5( |$)/.test(chipsOf(low?.id)),
        `lines="${linesOf(low?.id)}" chips="${chipsOf(low?.id)}"`);
      await sleep(600);
      ok('4c. the dice rise off the fighter: 5 and the 1 turning to 3', dicePlays.some(p => (p.key === 'great-weapon-fighting')
        && p.chips.some(c => c.was === '1' && c.label === '3') && p.chips.some(c => c.label === '5' && !c.up)), JSON.stringify(dicePlays));
      dicePlays.length = 0;
      const high = await damage(gear.Greatsword, 'twoHanded', [[4, 6], [6, 6]]);
      await sleep(600);
      // The fighter's own Great Weapon Master may ride this roll; only the style is asserted.
      ok('4d. 4 and 6: no Great Weapon Fighting record, line or float (Dueling, off at the equipment, says nothing on a Greatsword)',
        !style(high, 'great-weapon-fighting') && !/Great Weapon Fighting|Dueling/.test(textOf(high?.id)) && !dicePlays.some(p => p.key !== 'great-weapon-master'),
        `flag=${JSON.stringify(high?.getFlag(MOD, 'fightingStyle'))} dice=${JSON.stringify(dicePlays)}`);
    }

    // ---- 5. Thrown Weapon Fighting
    if (want(5)) {
      await equip(['Javelin']);
      const thrown = await damage(gear.Javelin, 'thrown', [[3, 6]]);
      ok('5a. the Javelin thrown: +2, "Thrown Weapon Fighting — +2"', (style(thrown, 'thrown-weapon-fighting')?.gain === 2)
        && /Thrown Weapon Fighting — \+2/.test(linesOf(thrown?.id)), `style=${JSON.stringify(style(thrown, 'thrown-weapon-fighting'))}`);
      const melee = await damage(gear.Javelin, 'oneHanded', [[3, 6]]);
      ok('5b. the Javelin in melee: nothing', !style(melee, 'thrown-weapon-fighting'), JSON.stringify(melee?.getFlag(MOD, 'fightingStyle') ?? null));
    }

    // ---- 6. Two-Weapon Fighting
    if (want(6)) {
      await equip(['Dagger', 'Longsword']);
      const offhand = await damage(gear.Dagger, 'offhand', [[2, 4]]);
      const s = style(offhand, 'two-weapon-fighting');
      const mod = Math.max(actor.system.abilities.str.mod, actor.system.abilities.dex.mod);
      ok('6a. the Dagger off-hand: the modifier back (+mod), "Two-Weapon Fighting — +N on the off-hand"',
        (s?.gain > 0) && (s?.gain === mod || s?.gain === actor.system.abilities.str.mod || s?.gain === actor.system.abilities.dex.mod)
          && /Two-Weapon Fighting — \+\d+ on the off-hand/.test(linesOf(offhand?.id)),
        `style=${JSON.stringify(s)} formula="${offhand?.rolls?.[0]?.formula}" mod=${mod}`);
      const main = await damage(gear.Dagger, 'oneHanded', [[2, 4]]);
      ok('6b. the Dagger in the main hand: nothing added', !style(main, 'two-weapon-fighting'), JSON.stringify(main?.getFlag(MOD, 'fightingStyle') ?? null));
    }

    // ---- 7. Unarmed Fighting's die
    if (want(7)) {
      const us = gear['Unarmed Strike'];
      await equip([]);
      const empty = await damage(us, null, [[3, 8]]);
      const flagE = empty?.getFlag(MOD, 'unarmedDice');
      ok('7a. hands empty: the d8, "Unarmed Fighting — 1d8 + N in place of … (hands empty)"',
        (flagE?.feature === 'Unarmed Fighting') && /1d8/.test(flagE?.formula ?? '') && /hands empty/.test(textOf(empty?.id)),
        `flag=${JSON.stringify(flagE)} text="${textOf(empty?.id).slice(-90)}"`);
      await equip(['Shield']);
      const shield = await damage(us, null, [[3, 6]]);
      const flagS = shield?.getFlag(MOD, 'unarmedDice');
      ok('7b. a Shield held: the d6, "(a weapon or Shield held)"', (flagS?.feature === 'Unarmed Fighting') && /1d6/.test(flagS?.formula ?? '')
        && /a weapon or Shield held/.test(textOf(shield?.id)), `flag=${JSON.stringify(flagS)}`);
      ok('7c. the face says which die', /d6 — a weapon or Shield held/.test(faceLine('Unarmed Fighting')), `line="${faceLine('Unarmed Fighting')}"`);
    }

    // ---- 8. off the list
    if (want(8)) {
      await equip(['Chain Mail', 'Longsword', 'Shield']);
      await set('fightingStyleList', 'Great Weapon Fighting');
      // The takeovers come back one feat at a time: poll, don't guess.
      for (let i = 0; i < 25 && !((packEffect('Defense')?.disabled === false) && (packEffect('Dueling')?.disabled === false)); i++) await sleep(200);
      await sleep(400);
      ok('8a. unlisted styles lose their face; the listed one keeps it', !face('Defense') && !face('Dueling') && !!face('Great Weapon Fighting'),
        `faces=${actor.effects.filter(e => e.getFlag(MOD, 'fightingStyle')).map(e => e.name).join(', ')}`);
      ok('8b. the pack\'s own Defense and Dueling effects come back on, unflagged',
        packEffect('Defense')?.disabled === false && packEffect('Dueling')?.disabled === false
          && !packEffect('Defense')?.getFlag(MOD, 'fightingStyleTakenOver'),
        `defense=${packEffect('Defense')?.disabled} dueling=${packEffect('Dueling')?.disabled}`);
      await set('fightingStyleList', def('fightingStyleList'));
      await sleep(1200);
    }

    // ---- 9. Blind Fighting
    if (want(9)) {
      await set('reminderList', def('reminderList'));
      const { judgeRoll } = await import('/modules/fvtt-mod-battleflow/scripts/reminders.js');
      const [fdoc] = await scene.createEmbeddedDocuments('Token', [
        foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x: 1500, y: 1900, actorId: actor.id, actorLink: true, disposition: 1 }, { inplace: false })]);
      placed.push(fdoc.id);
      for (let i = 0; i < 40 && !canvas.tokens.get(fdoc.id); i++) await sleep(250);
      await victim.toggleStatusEffect('invisible', { active: true });
      await sleep(400);
      log.push(`§9 senses=${JSON.stringify(actor.system.attributes.senses?.ranges ?? actor.system.attributes.senses)}`);
      const judge = (who, at) => judgeRoll(who, { activity: attackOf(gear.Longsword), attackMode: 'oneHanded', targets: [at] });
      const labels = j => JSON.stringify((j?.sources ?? []).map(x => [x.label, x.bend]));
      const near = judge(actor, canvas.tokens.get(vdoc.id));
      const seen = (near?.sources ?? []).find(x => /Invisible — .* sees it \(Blindsight 10 ft\)/.test(x.label));
      ok('9a. 5 ft: the Invisible victim is seen — listed with why, not counted; the net is Normal',
        !!seen && (seen.bend === null) && (near?.net === 'normal'), `net=${near?.net} sources=${labels(near)}`);
      await vdoc.update({ x: 1200 }, { animate: false });   // three squares from the fighter: 15 ft
      await sleep(400);
      const far = judge(actor, canvas.tokens.get(vdoc.id));
      ok('9b. 15 ft: beyond the Blindsight — Invisible counts, Disadvantage',
        (far?.sources ?? []).some(x => /is Invisible/.test(x.label) && (x.bend === 'disadvantage')) && (far?.net === 'disadvantage'),
        `net=${far?.net} sources=${labels(far)}`);
      await vdoc.update({ x: 1400 }, { animate: false });
      await sleep(400);
      const back = judgeRoll(victim, { targets: [canvas.tokens.get(fdoc.id)] });
      const seenYou = (back?.sources ?? []).find(x => /Invisible: .* sees you/.test(x.label));
      ok('9c. the Invisible victim attacking the fighter: its Advantage listed, not counted',
        !!seenYou && (seenYou.bend === null) && (back?.net !== 'advantage'), `net=${back?.net} sources=${labels(back)}`);
      await victim.toggleStatusEffect('invisible', { active: false });
    }

    // ---- 10. Unarmed Fighting's grapple damage
    if (want(10)) {
      await set('autoDamage', 'all');
      await set('autoApply', true);
      await set('holdTimer', 0);
      await equip([]);
      const fdoc = scene.tokens.find(t => (t.actorId === actor.id) && placed.includes(t.id))
        ?? (await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(actor.prototypeToken.toObject(),
          { x: 1500, y: 1900, actorId: actor.id, actorLink: true, disposition: 1 }, { inplace: false })]))[0];
      if (!placed.includes(fdoc.id)) placed.push(fdoc.id);
      for (let i = 0; i < 40 && !canvas.tokens.get(fdoc.id); i++) await sleep(250);
      // A creature of its own, so no other token inherits the Grappled (the fixture's unlinked BF Test
      // Victim wears its base actor's effects).
      const held = (await Actor.create({ ...victim.toObject(), _id: undefined, name: 'BF Temp Grappled', folder: null }));
      const [hdoc] = await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(held.prototypeToken.toObject(),
        { x: 1600, y: 1900, actorId: held.id, actorLink: true, disposition: -1 }, { inplace: false })]);
      placed.push(hdoc.id);
      for (let i = 0; i < 40 && !canvas.tokens.get(hdoc.id); i++) await sleep(250);
      await held.update({ 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });
      await held.toggleStatusEffect('grappled', { active: true });
      const grappled = held.effects.find(e => e.statuses?.has?.('grappled'));
      await grappled?.setFlag(MOD, 'sourceUuid', actor.uuid);
      const hp = () => Number(held.system.attributes.hp.value);
      const grapplePopup = () => [...foundry.applications.instances.values()].find(a => a.rendered && /Unarmed Fighting/.test(a.element?.textContent ?? '')
        && a.element?.querySelector?.('button[data-action="deal"]')) ?? null;
      const cardOf = t0 => game.messages.contents.filter(m => (m.timestamp >= t0) && m.getFlag(MOD, 'grappleDamage')).pop() ?? null;
      const waitFor = async (test, timeout = 8000) => { const until = Date.now() + timeout; while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); } return test(); };
      if (game.combat) await game.combat.delete();
      const combat = await Combat.create({ scene: scene.id });
      await combat.createEmbeddedDocuments('Combatant', [
        { actorId: actor.id, tokenId: fdoc.id, sceneId: scene.id, initiative: 20 },
        { actorId: held.id, tokenId: hdoc.id, sceneId: scene.id, initiative: 5 }]);
      try {
        let t0 = Date.now();
        await combat.startCombat();
        const pop = await waitFor(grapplePopup, 8000);
        const card = cardOf(t0);
        ok('10a. the fighter\'s turn starts grappling the victim: a card and a popup "Deal 1d4 to the … you\'re grappling?"',
          !!pop && !!card && /Deal 1d4 to/.test(pop?.element?.textContent ?? '') && (card?.getFlag(MOD, 'grappleDamage')?.pick === held.uuid),
          `popup=${!!pop} flag=${JSON.stringify(card?.getFlag(MOD, 'grappleDamage') ?? null).slice(0, 300)}`);
        faces([[3, 4]]);
        pop?.element?.querySelector('button[data-action="deal"]')?.click();
        const dealt = await waitFor(() => (hp() < 400) ? hp() : null, 10000);
        CONFIG.Dice.randomUniform = realPRNG;
        await sleep(600);
        ok('10b. Deal it: the damage lands (1d4), the card resolves "deal"', (dealt !== null) && ((400 - hp()) <= 4)
          && (game.messages.get(card?.id)?.getFlag(MOD, 'grappleDamage')?.answer === 'deal'),
          `hp=${hp()} flag=${JSON.stringify(game.messages.get(card?.id)?.getFlag(MOD, 'grappleDamage')?.answer ?? null)}`);
        await held.update({ 'system.attributes.hp.value': 400 });
        await combat.nextTurn(); await sleep(500);
        t0 = Date.now();
        await combat.nextTurn();
        const pop2 = await waitFor(grapplePopup, 8000);
        pop2?.element?.querySelector('button[data-action="skip"]')?.click();
        await sleep(1500);
        ok('10c. next turn, Skip: nothing dealt, the card resolves "skip"', (hp() === 400) && (cardOf(t0)?.getFlag(MOD, 'grappleDamage')?.answer === 'skip'),
          `hp=${hp()} answer=${cardOf(t0)?.getFlag(MOD, 'grappleDamage')?.answer}`);
        await set('holdTimer', 2);
        await combat.nextTurn(); await sleep(500);
        t0 = Date.now();
        faces([[2, 4]]);
        await combat.nextTurn();
        const timed = await waitFor(() => { const f = cardOf(t0)?.getFlag(MOD, 'grappleDamage'); return (f?.status === 'resolved') ? f : null; }, 10000);
        await waitFor(() => (hp() < 400) ? hp() : null, 6000);
        CONFIG.Dice.randomUniform = realPRNG;
        ok('10d. with a clock and nobody answering: the clock deals it to the one creature held', (timed?.answer === 'deal') && !!timed?.timedOut && (hp() < 400),
          `flag=${JSON.stringify(timed ?? null).slice(0, 200)} hp=${hp()}`);
      } finally {
        CONFIG.Dice.randomUniform = realPRNG;
        await set('holdTimer', 0);
        await combat.delete().catch(() => {});
        const liveTok = placed.filter(id => scene.tokens.get(id)?.actorId === held.id);
        if (liveTok.length) await scene.deleteEmbeddedDocuments('Token', liveTok);
        await held.delete().catch(() => {});
        for (const app of [...foundry.applications.instances.values()]) if (/Unarmed Fighting/.test(app.element?.textContent ?? '')) { try { await app.close(); } catch { /* gone */ } }
      }
    }

    // ---- 11. Great Weapon Master's Heavy Weapon Mastery
    if (want(11)) {
      // the lines off the card's own render: after §10's combat the log on screen is not the chat
      const cardLines = async id => {
        const el = await game.messages.get(id)?.renderHTML?.().catch(() => null);
        return [...(el?.querySelectorAll?.(".bf-fighting-style-line") ?? [])].map(e => e.dataset.bfStyleLine ?? "").join(" | ");
      };
      const gwm = await lend('Great Weapon Master', 'feat');
      const pb = Number(actor.system.attributes.prof);
      try {
        await equip(['Greatsword']);
        const g = face('Great Weapon Master');
        ok('11a. the face: live off the Greatsword, titled by the feat alone (no "Fighting Style:")', !!g && !g.disabled && /Greatsword, Heavy/.test(faceLine('Great Weapon Master'))
          && (g?.getFlag(MOD, 'fightingStyle')?.feat === true), `face=${!!g} disabled=${g?.disabled} line="${faceLine('Great Weapon Master')}"`);
        const hit = await damage(gear.Greatsword, 'twoHanded', [[4, 6], [5, 6]]);
        const s = style(hit, 'great-weapon-master');
        ok(`11b. the Greatsword rolls +${pb}: the record, "Great Weapon Master — +${pb}" on the card`,
          (s?.gain === pb) && new RegExp(`Great Weapon Master — \\+${pb}`).test(await cardLines(hit?.id)),
          `style=${JSON.stringify(s)} formula="${hit?.rolls?.[0]?.formula}" lines="${await cardLines(hit?.id)}"`);
        await equip(['Longsword']);
        const plain = await damage(gear.Longsword, 'twoHanded', [[5, 10]]);
        ok('11c. a weapon without Heavy adds nothing and says nothing', !style(plain, 'great-weapon-master') && !/Great Weapon Master/.test(await cardLines(plain?.id)),
          `lines="${await cardLines(plain?.id)}"`);
        // someone else's turn: the victim's
        await equip(['Greatsword']);
        if (game.combat) await game.combat.delete();
        const combat = await Combat.create({ scene: scene.id });
        const [odoc] = await scene.createEmbeddedDocuments('Token', [
          foundry.utils.mergeObject(actor.prototypeToken.toObject(), { x: 1500, y: 1900, actorId: actor.id, actorLink: true }, { inplace: false })]);
        placed.push(odoc.id);
        await combat.createEmbeddedDocuments('Combatant', [
          { actorId: victim.id, tokenId: vdoc.id, sceneId: scene.id, initiative: 20 },
          { actorId: actor.id, tokenId: odoc.id, sceneId: scene.id, initiative: 5 }]);
        try {
          await combat.startCombat();
          const oa = await damage(gear.Greatsword, 'twoHanded', [[4, 6], [5, 6]]);
          ok(`11d. on someone else's turn (an Opportunity Attack): nothing added, "Great Weapon Master off — not your turn"`,
            !style(oa, 'great-weapon-master')?.gain && /Great Weapon Master off — not your turn/.test(await cardLines(oa?.id)), `lines="${await cardLines(oa?.id)}"`);
        } finally { await combat.delete().catch(() => {}); }
      } finally {
        if (lent.includes(gwm.id)) { await actor.deleteEmbeddedDocuments('Item', [gwm.id]).catch(() => {}); lent.splice(lent.indexOf(gwm.id), 1); }
        await sleep(600);
      }
    }

    // ---- 12. Heavy Armor Master's block
    if (want(12)) {
      const ham = await lend('Heavy Armor Master', 'feat');
      const pb = Number(actor.system.attributes.prof);
      const hp0 = Number(actor.system.attributes.hp.value);
      const hpMax = Number(actor.system.attributes.hp.max);
      try {
        await actor.update({ 'system.attributes.hp.value': hpMax });
        await equip(['Chain Mail', 'Greatsword']);
        const h = face('Heavy Armor Master');
        ok(`12a. the face: live in Chain Mail; the pack's own reduction switched off (flagged)`, !!h && !h.disabled && /Chain Mail/.test(faceLine('Heavy Armor Master'))
          && packEffect('Heavy Armor Master')?.disabled === true, `face=${!!h} line="${faceLine('Heavy Armor Master')}" pack=${packEffect('Heavy Armor Master')?.disabled}`);
        const card = await damage(gear.Greatsword, 'twoHanded', [[4, 6], [5, 6]]);
        const nine = [{ value: 9, type: 'slashing' }];
        const calc = actor.calculateDamage(nine, { originatingMessage: card });
        ok(`12b. an attack's 9 slashing calculates to ${9 - pb}, the calculation saying "blocked ${pb}"`,
          (calc?.amount === 9 - pb) && (calc?.bfArmorBlock?.amount === pb), `amount=${calc?.amount} block=${JSON.stringify(calc?.bfArmorBlock ?? null)}`);
        const hpA = Number(actor.system.attributes.hp.value);
        const pops = [];
        const popHook = Hooks.on('battleflow.armorBlock', p => pops.push(p));
        await actor.applyDamage(nine, { originatingMessage: card });
        await sleep(300);
        const flag = actor.getFlag(MOD, 'armorBlock');
        ok(`12c. applied: ${9 - pb} lands, and the actor's own update carries the pop`, (hpA - Number(actor.system.attributes.hp.value) === 9 - pb) && (flag?.amount === pb) && (pops.length === 1),
          `took=${hpA - Number(actor.system.attributes.hp.value)} flag=${JSON.stringify(flag ?? null)} pops=${pops.length}`);
        // A SECOND block of the same amount must pop too (only its time differs).
        await sleep(20);
        await actor.applyDamage(nine, { originatingMessage: card });
        await sleep(300);
        Hooks.off('battleflow.armorBlock', popHook);
        ok('12c2. a second block of the same amount pops again', pops.length === 2, `pops=${JSON.stringify(pops)}`);
        const hpB = Number(actor.system.attributes.hp.value);
        await actor.applyDamage(nine, {});
        ok('12d. a bare 9 (no attack card behind it) lands whole', hpB - Number(actor.system.attributes.hp.value) === 9,
          `took=${hpB - Number(actor.system.attributes.hp.value)}`);
        await actor.update({ 'system.attributes.hp.value': hpMax });
        await equip(['Greatsword']);
        ok('12e. out of the armor: the face off, "no armor worn"', face('Heavy Armor Master')?.disabled === true && /no armor worn/.test(faceLine('Heavy Armor Master')),
          `line="${faceLine('Heavy Armor Master')}"`);
        const hpC = Number(actor.system.attributes.hp.value);
        await actor.applyDamage(nine, { originatingMessage: card });
        ok(`12f. out of the armor, the attack's 9 lands whole`, hpC - Number(actor.system.attributes.hp.value) === 9,
          `took=${hpC - Number(actor.system.attributes.hp.value)}`);
      } finally {
        await actor.update({ 'system.attributes.hp.value': hp0, [`flags.${MOD}.-=armorBlock`]: null }).catch(() => {});
        if (lent.includes(ham.id)) { await actor.deleteEmbeddedDocuments('Item', [ham.id]).catch(() => {}); lent.splice(lent.indexOf(ham.id), 1); }
        await sleep(600);
      }
    }

    // ---- 13. Elemental Adept and Poisoner
    if (want(13)) {
      const adept = await lend('Elemental Adept', 'feat');
      const poisoner = await lend('Poisoner', 'feat');
      const bolt = await lend('Fire Bolt', 'spell');
      const drBefore = [...(victim.system.traits?.dr?.value ?? [])];
      const cardLines = async id => {
        const el = await game.messages.get(id)?.renderHTML?.().catch(() => null);
        return [...(el?.querySelectorAll?.('.bf-fighting-style-line') ?? [])].map(e => e.dataset.bfStyleLine ?? '').join(' | ');
      };
      try {
        await adept.update({ name: 'Elemental Adept (Fire)' });
        await victim.update({ 'system.traits.dr.value': ['fire', 'poison'] });
        await sleep(900);
        const a = face('Elemental Adept');
        ok('13a. "Elemental Adept (Fire)": its face live, "Fire", titled by the feat', !!a && !a.disabled && (faceLine('Elemental Adept') === 'Fire')
          && (a?.getFlag(MOD, 'fightingStyle')?.feat === true), `face=${!!a} disabled=${a?.disabled} line="${faceLine('Elemental Adept')}"`);
        const dice = bolt.system.activities.find(x => x.type === 'attack');
        const t0 = Date.now();
        faces([[1, 10], [1, 10], [1, 10], [1, 10]]);
        await dice.rollDamage({ isCritical: false }, { configure: false }, {});
        CONFIG.Dice.randomUniform = realPRNG;
        let card = null;
        for (let i = 0; (i < 30) && !card; i++) { card = game.messages.contents.filter(x => (x.timestamp >= t0) && (x.type === 'damage')).pop() ?? null; if (!card) await sleep(150); }
        await sleep(300);
        const s = style(card, 'elemental-adept');
        const n = (card?.rolls?.[0]?.dice ?? []).reduce((k, t) => k + t.results.length, 0);
        ok('13b. Fire Bolt\'s 1s count as 2: the record, "Elemental Adept — 1 → 2" on the card', (s?.gain === n) && (n > 0) && /Elemental Adept — 1 → 2/.test(await cardLines(card?.id)),
          `style=${JSON.stringify(s)} dice=${n} formula="${card?.rolls?.[0]?.formula}" total=${card?.rolls?.[0]?.total} lines="${await cardLines(card?.id)}"`);
        const ten = [{ value: 10, type: 'fire' }];
        const calc = victim.calculateDamage(ten, { originatingMessage: card });
        ok('13c. its fire damage ignores the victim\'s Fire Resistance: 10 lands 10, the calculation names the feat',
          (calc?.amount === 10) && (calc?.bfIgnored?.[0]?.feature === 'Elemental Adept') && calc.bfIgnored[0].types.includes('fire'),
          `amount=${calc?.amount} ignored=${JSON.stringify(calc?.bfIgnored ?? null)}`);
        await equip(['Dagger']);
        const stab = await damage(gear.Dagger, 'oneHanded', [[3, 4]]);
        const weaponFire = victim.calculateDamage(ten, { originatingMessage: stab });
        ok('13d. a WEAPON card\'s fire damage is not a spell\'s: the Resistance stands (10 → 5)', weaponFire?.amount === 5, `amount=${weaponFire?.amount}`);
        const poison = victim.calculateDamage([{ value: 10, type: 'poison' }], { originatingMessage: stab });
        ok('13e. Poisoner: the weapon card\'s poison ignores Resistance to Poison (10 → 10), named', (poison?.amount === 10)
          && (poison?.bfIgnored ?? []).some(i => i.feature === 'Poisoner'), `amount=${poison?.amount} ignored=${JSON.stringify(poison?.bfIgnored ?? null)}`);
        await adept.update({ name: 'Elemental Adept' });
        await sleep(900);
        const off = face('Elemental Adept');
        ok('13f. renamed with no type: the face off, and it says how to fix it', (off?.disabled === true) && /rename it/.test(faceLine('Elemental Adept')),
          `disabled=${off?.disabled} line="${faceLine('Elemental Adept')}"`);
        const bare = victim.calculateDamage(ten, { originatingMessage: card });
        ok('13g. with no type named, the Resistance stands (10 → 5)', bare?.amount === 5, `amount=${bare?.amount}`);
      } finally {
        CONFIG.Dice.randomUniform = realPRNG;
        await victim.update({ 'system.traits.dr.value': drBefore }).catch(() => {});
        for (const it of [adept, poisoner, bolt]) {
          if (lent.includes(it.id)) { await actor.deleteEmbeddedDocuments('Item', [it.id]).catch(() => {}); lent.splice(lent.indexOf(it.id), 1); }
        }
        await sleep(600);
      }
    }

    // ---- 15. Elemental Adept's type pick
    if (want(15)) {
      const waitFor = async (test, timeout = 8000) => { const until = Date.now() + timeout; while (Date.now() < until) { const v = test(); if (v) return v; await sleep(200); } return test(); };
      const source = await findPHB('Elemental Adept', 'feat');
      const pickCard = item => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'typePick')?.itemUuid === item?.uuid)).at(-1) ?? null;
      const pickPopup = () => [...foundry.applications.instances.values()]
        .find(app => app.rendered && /Elemental Adept/.test(app.title ?? '') && app.element?.querySelector?.('button[data-action="later"]')) ?? null;
      const closePicks = async () => { for (const app of [...foundry.applications.instances.values()]) if (app.element?.querySelector?.('button[data-action="later"]') && /Elemental Adept/.test(app.title ?? '')) { try { await app.close(); } catch { /* gone */ } } };
      const copies = [];
      const land = async () => {
        const data = source.toObject();
        const [item] = await actor.createEmbeddedDocuments('Item', [data]);
        lent.push(item.id); copies.push(item);
        return item;
      };
      try {
        if (!source) throw new Error('the PHB ships no Elemental Adept this box can find');
        await closePicks();
        const first = await land();
        const card1 = await waitFor(() => pickCard(first), 6000);
        const pop1 = await waitFor(pickPopup, 6000);
        const buttons = [...(pop1?.element?.querySelectorAll('button[data-action]') ?? [])].map(b => b.dataset.action);
        ok('15a. a typeless copy lands: the pick card (five types left) and the popup (a button each, and Later)',
          !!card1 && (card1.getFlag(MOD, 'typePick')?.left?.length === 5) && ['acid', 'cold', 'fire', 'lightning', 'thunder', 'later'].every(a => buttons.includes(a)),
          `card=${!!card1} left=${JSON.stringify(card1?.getFlag(MOD, 'typePick')?.left)} buttons=${buttons.join(',')}`);
        pop1?.element?.querySelector('button[data-action="cold"]')?.click();
        const chosen = await waitFor(() => (pickCard(first)?.getFlag(MOD, 'typePick')?.chosen === 'cold') && (actor.items.get(first.id)?.name === 'Elemental Adept (Cold)'), 6000);
        await sleep(400);
        ok('15b. Cold: the copy renamed "Elemental Adept (Cold)", the card says chosen, the popup closed',
          !!chosen && !pickPopup(), `name="${actor.items.get(first.id)?.name}" chosen=${pickCard(first)?.getFlag(MOD, 'typePick')?.chosen} popup=${!!pickPopup()}`);
        const second = await land();
        const card2 = await waitFor(() => pickCard(second), 6000);
        const left2 = card2?.getFlag(MOD, 'typePick')?.left ?? [];
        ok('15c. a second copy is offered four — Cold is already held', (left2.length === 4) && !left2.includes('cold'), `left=${JSON.stringify(left2)}`);
        await waitFor(pickPopup, 4000);
        await second.update({ name: 'Elemental Adept (Acid)' });
        const settled = await waitFor(() => pickCard(second)?.getFlag(MOD, 'typePick')?.chosen === 'acid', 6000);
        await sleep(400);
        ok('15d. renamed by hand "(Acid)": the card settles (chosen acid) and the popup closes', !!settled && !pickPopup(),
          `chosen=${pickCard(second)?.getFlag(MOD, 'typePick')?.chosen} popup=${!!pickPopup()}`);
        const third = await land();
        await waitFor(() => pickCard(third), 6000);
        await closePicks();
        const before = pickCard(third)?.id;
        await actor.items.get(third.id)?.displayCard?.();
        const own = await waitFor(() => { const c = pickCard(third); return (c && (c.id !== before)) ? c : null; }, 6000);
        const pop3 = await waitFor(pickPopup, 6000);
        ok('15e. the third copy\'s own card (a click on the sheet) carries the pick and asks: two left, the popup open',
          !!own && (own.getFlag(MOD, 'typePick')?.left?.length === 3) && !!pop3,
          `card=${!!own} left=${JSON.stringify(own?.getFlag(MOD, 'typePick')?.left)} popup=${!!pop3}`);
      } catch (err) {
        ok('15. the type pick ran', false, String(err?.message ?? err));
      } finally {
        await closePicks();
        const gone = copies.map(c => c.id).filter(id => actor.items.get(id));
        if (gone.length) await actor.deleteEmbeddedDocuments('Item', gone).catch(() => {});
        for (const c of copies) if (lent.includes(c.id)) lent.splice(lent.indexOf(c.id), 1);
        await sleep(600);
      }
    }

    // ---- 14. Crossbow Expert's Dual Wielding
    if (want(14)) {
      const ce = await lend('Crossbow Expert', 'feat');
      const hand = await lend('Hand Crossbow', 'weapon');
      const cardLines = async id => {
        const el = await game.messages.get(id)?.renderHTML?.().catch(() => null);
        return [...(el?.querySelectorAll?.('.bf-fighting-style-line') ?? [])].map(e => e.dataset.bfStyleLine ?? '').join(' | ');
      };
      const listBefore = game.settings.get(MOD, 'fightingStyleList');
      const dexBefore = actor.system._source.abilities.dex.value;
      try {
        await actor.update({ 'system.abilities.dex.value': 16 });   // a modifier to give back
        await equip(['Dagger']);
        await actor.updateEmbeddedDocuments('Item', [{ _id: hand.id, 'system.equipped': true }]);
        await sleep(900);
        const c = face('Crossbow Expert');
        ok('14a. a Hand Crossbow and a Dagger held: Crossbow Expert\'s face live, "the Light crossbow\'s extra attack"', !!c && !c.disabled
          && /Light crossbow/.test(faceLine('Crossbow Expert')), `face=${!!c} disabled=${c?.disabled} line="${faceLine('Crossbow Expert')}"`);
        const modes = (hand.system.attackModes ?? []).map(m => m.value);
        log.push(`§14 Hand Crossbow modes: ${modes.join(',')}`);
        if (!modes.includes('offhand')) {
          skips.push(`§14b–c the Hand Crossbow offers no off-hand mode on this box (modes: ${modes.join(',')})`);
        } else {
          const mod = Number(actor.system.abilities.dex.mod);
          // only the feat: Two-Weapon Fighting off the list for this roll
          await set('fightingStyleList', 'Crossbow Expert');
          await sleep(600);
          const one = await damage(hand, 'offhand', [[3, 6]]);
          const s1 = style(one, 'crossbow-expert');
          ok(`14b. the Hand Crossbow off-hand: +${mod}, "Crossbow Expert — +${mod} on the off-hand"`, (mod > 0) && (s1?.gain === mod)
            && new RegExp(`Crossbow Expert — \\+${mod} on the off-hand`).test(await cardLines(one?.id)),
            `mod=${mod} style=${JSON.stringify(s1)} lines="${await cardLines(one?.id)}"`);
          await set('fightingStyleList', 'Two-Weapon Fighting, Crossbow Expert');
          await sleep(600);
          const two = await damage(hand, 'offhand', [[3, 6]]);
          const all = two?.getFlag(MOD, 'fightingStyle')?.styles ?? [];
          ok('14c. beside Two-Weapon Fighting the modifier is added ONCE', (all.filter(e => e.gain > 0).length === 1)
            && (all.reduce((n, e) => n + e.gain, 0) === mod), `styles=${JSON.stringify(all)}`);
        }
      } finally {
        await set('fightingStyleList', listBefore);
        await actor.update({ 'system.abilities.dex.value': dexBefore }).catch(() => {});
        for (const it of [ce, hand]) {
          if (lent.includes(it.id)) { await actor.deleteEmbeddedDocuments('Item', [it.id]).catch(() => {}); lent.splice(lent.indexOf(it.id), 1); }
        }
        await sleep(600);
      }
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'styles', out, plan, f });
