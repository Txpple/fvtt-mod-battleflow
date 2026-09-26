// Battle Flow fighting-style smoke test — THE FIGHTING STYLES (user, 2026-09-26, ruled off
// prototypes/fighting-styles.html: "one table"; "gate it on what pc is holding"; "effects on the
// player ... so itd show in the detailed buff bar"; option B for the notice).
//
// Fixtures: BF Test Fighter (tools/fixture-suite.mjs) is lent the PHB's six styles — Great Weapon
// Fighting (it may carry its own), Thrown Weapon Fighting, Two-Weapon Fighting, Dueling, Defense,
// Unarmed Fighting — and the PHB's Greatsword, Longsword, Dagger, Javelin, Shield, Chain Mail and
// Unarmed Strike for the run. Every item it already had is unequipped for the run and put back.
// The damage is rolled straight off the weapon's attack activity with its attack mode (no attack
// roll), the dice forced; BF Test Victim's token stands targeted for the floating number.
//
// Harness discipline: every setting touched is restored; the lent items, the placed token and every
// message this run creates are deleted; the fighter's equipped boxes are put back.
//
// Sections: `--section 4`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'fighting-styles.js',   // §1–§2 the faces off the equipped boxes; §3–§6 the numbers, the lines, the record, the float; §8 the switch
  'unarmed-dice.js',      // §7 Unarmed Fighting's die by what the hands hold (the `hands` row)
  'reminders.js'          // §9 Blind Fighting — who sees the unseen: Invisible listed, not counted, within Blindsight
];

const SECTIONS = {
  1: 'the faces: Chain Mail, a Longsword and a Shield — Defense live (its AC on the face, the pack effect switched off), Dueling live, Great Weapon Fighting live (the Longsword is Versatile), Thrown and Two-Weapon off with why',
  2: 'a Dagger joins and the armor comes off: Dueling off ("a second weapon held (Dagger)"), Defense off and the AC one lower',
  3: 'Dueling: the Longsword one-handed rolls +2 with "Dueling — +2" and the record; two-handed it adds nothing and says why',
  4: 'Great Weapon Fighting: the Greatsword rolls 1 and 5 — the 1 counts as 3, "1 → 3: +2", the record, the float; 4 and 6 leave no trace',
  5: 'Thrown Weapon Fighting: the Javelin thrown rolls +2; swung in melee it does not',
  6: 'Two-Weapon Fighting: the Dagger off-hand adds the modifier back',
  7: 'Unarmed Fighting: the sheet\'s Unarmed Strike rolls the d8 with the hands empty, the d6 with a Shield held, and says so',
  8: 'off the list: the faces go and the pack\'s own Defense and Dueling effects come back on',
  9: 'Blind Fighting: an Invisible victim 5 ft away is seen (listed, net Normal); 15 ft away it is not (Disadvantage); the Invisible victim attacking the fighter loses its Advantage'
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
  if (!game.settings.settings.has(`${MOD}.fightingStyleList`)) return { fatal: 'fightingStyleList not registered — OLD code (reload the box)' };

  const SETTING_KEYS = ['fightingStyleList', 'unarmedDiceList', 'autoDamage', 'autoApply', 'riders', 'effectRiders', 'masteryRiders',
    'clockRiderList', 'damageEitherList', 'reminderList'];
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

  const equippedBefore = actor.items.filter(i => i.system?.equipped === true).map(i => i.id);
  const lent = [];
  const placed = [];
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    CONFIG.Dice.randomUniform = realPRNG;
    if (canvas.interface && realFloat) canvas.interface.createScrollingText = realFloat;
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
      game.user.targets.forEach(t => t.setTarget(false, { releaseOthers: true }));
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

    // -------------------------------------------------- fixtures
    // by name AND type: the PHB has a Shield SPELL beside the Shield (the first run lent the spell)
    const findPHB = async (name, type = null) => {
      for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
        const hit = (await pack.getIndex({ fields: ['type'] })).find(e => (e.name === name) && (!type || (e.type === type)));
        if (hit) return pack.getDocument(hit._id);
      }
      return null;
    };
    const lend = async (name, type = null) => {
      const own = actor.items.find(i => i.name === name && !lent.includes(i.id));
      if (own && (name === 'Great Weapon Fighting')) return own;   // the fixture's own
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

    // -------------------------------------------------- helpers
    const face = name => actor.effects.find(e => (e.getFlag(MOD, 'fightingStyle')?.key) && (e.name === name)) ?? null;
    const faceLine = name => face(name)?.getFlag(MOD, 'fightingStyle')?.detail ?? '';
    const packEffect = name => actor.items.find(i => (i.type === 'feat') && (i.name === name))?.effects?.find(e => (e.changes ?? []).length) ?? null;
    const textOf = id => (document.querySelector(`.message[data-message-id="${id}"]`)?.textContent ?? '').replace(/\s+/g, ' ');
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

    // ================================================== 1. the faces
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
      ok('1e. Thrown and Two-Weapon off, with why', !!t && t.disabled && /no Thrown weapon/.test(faceLine('Thrown Weapon Fighting'))
        && !!w && w.disabled && /not holding two weapons/.test(faceLine('Two-Weapon Fighting')),
        `thrown="${faceLine('Thrown Weapon Fighting')}" twf="${faceLine('Two-Weapon Fighting')}"`);
      log.push(`§1 AC bare=${acBare} armored=${actor.system.attributes.ac.value}`);
    }

    // ================================================== 2. the gates close
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

    // ================================================== 3. Dueling's number
    if (want(3)) {
      await equip(['Longsword', 'Shield']);
      const one = await damage(gear.Longsword, 'oneHanded', [[5, 8]]);
      const s = style(one, 'dueling');
      ok('3a. one-handed: +2 on the roll, the record (gain 2), "Dueling — +2" on the card',
        (s?.gain === 2) && /(^|\D)2(\D|$)/.test(one?.rolls?.[0]?.formula ?? '') && /Dueling — \+2/.test(textOf(one?.id)),
        `formula="${one?.rolls?.[0]?.formula}" style=${JSON.stringify(s)} text="${textOf(one?.id).slice(-80)}"`);
      ok('3b. the record carries the stats context', ('combat' in (one?.getFlag(MOD, 'fightingStyle') ?? {})) && (one?.getFlag(MOD, 'fightingStyle')?.sourceUuid === actor.uuid),
        JSON.stringify(one?.getFlag(MOD, 'fightingStyle')));
      const two = await damage(gear.Longsword, 'twoHanded', [[5, 10]]);
      const s2 = style(two, 'dueling');
      ok('3c. two-handed: nothing added, "Dueling off — two hands"', !s2?.gain && /Dueling off — two hands/.test(textOf(two?.id)),
        `style=${JSON.stringify(s2)} formula="${two?.rolls?.[0]?.formula}"`);
    }

    // ================================================== 4. Great Weapon Fighting's floor
    if (want(4)) {
      await equip(['Greatsword']);
      floats.length = 0;
      const low = await damage(gear.Greatsword, 'twoHanded', [[1, 6], [5, 6]]);
      const s = style(low, 'great-weapon-fighting');
      const dice = low?.rolls?.[0]?.dice?.[0]?.results ?? [];
      ok('4a. the 1 counts as 3: the die kept its face and counts 3, the record raised 1 → 3, gain 2',
        (s?.gain === 2) && (s?.raised?.[0]?.from === 1) && (s?.raised?.[0]?.to === 3) && dice.some(r => (r.result === 1) && (r.count === 3)),
        `style=${JSON.stringify(s)} dice=${JSON.stringify(dice)} formula="${low?.rolls?.[0]?.formula}"`);
      ok('4b. the card says "Great Weapon Fighting — 1 → 3: +2"', /Great Weapon Fighting — 1 → 3: \+2/.test(textOf(low?.id)), textOf(low?.id).slice(-90));
      await sleep(600);
      ok('4c. the float: "+2 Great Weapon Fighting" over the target', floats.some(t => t === '+2 Great Weapon Fighting'), JSON.stringify(floats));
      floats.length = 0;
      const high = await damage(gear.Greatsword, 'twoHanded', [[4, 6], [6, 6]]);
      await sleep(600);
      ok('4d. 4 and 6: no record, no line, no float (Dueling, off at the equipment, says nothing on a Greatsword)', !high?.getFlag(MOD, 'fightingStyle') && !/Great Weapon Fighting/.test(textOf(high?.id)) && !floats.length,
        `flag=${JSON.stringify(high?.getFlag(MOD, 'fightingStyle'))} floats=${JSON.stringify(floats)}`);
    }

    // ================================================== 5. Thrown Weapon Fighting
    if (want(5)) {
      await equip(['Javelin']);
      const thrown = await damage(gear.Javelin, 'thrown', [[3, 6]]);
      ok('5a. the Javelin thrown: +2, "Thrown Weapon Fighting — +2"', (style(thrown, 'thrown-weapon-fighting')?.gain === 2)
        && /Thrown Weapon Fighting — \+2/.test(textOf(thrown?.id)), `style=${JSON.stringify(style(thrown, 'thrown-weapon-fighting'))}`);
      const melee = await damage(gear.Javelin, 'oneHanded', [[3, 6]]);
      ok('5b. the Javelin in melee: nothing', !style(melee, 'thrown-weapon-fighting'), JSON.stringify(melee?.getFlag(MOD, 'fightingStyle') ?? null));
    }

    // ================================================== 6. Two-Weapon Fighting
    if (want(6)) {
      await equip(['Dagger', 'Longsword']);
      const offhand = await damage(gear.Dagger, 'offhand', [[2, 4]]);
      const s = style(offhand, 'two-weapon-fighting');
      const mod = Math.max(actor.system.abilities.str.mod, actor.system.abilities.dex.mod);
      ok('6a. the Dagger off-hand: the modifier back (+mod), "Two-Weapon Fighting — +N on the off-hand"',
        (s?.gain > 0) && (s?.gain === mod || s?.gain === actor.system.abilities.str.mod || s?.gain === actor.system.abilities.dex.mod)
          && /Two-Weapon Fighting — \+\d+ on the off-hand/.test(textOf(offhand?.id)),
        `style=${JSON.stringify(s)} formula="${offhand?.rolls?.[0]?.formula}" mod=${mod}`);
      const main = await damage(gear.Dagger, 'oneHanded', [[2, 4]]);
      ok('6b. the Dagger in the main hand: nothing added', !style(main, 'two-weapon-fighting'), JSON.stringify(main?.getFlag(MOD, 'fightingStyle') ?? null));
    }

    // ================================================== 7. Unarmed Fighting's die
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

    // ================================================== 8. off the list
    if (want(8)) {
      await equip(['Chain Mail', 'Longsword', 'Shield']);
      await set('fightingStyleList', 'Great Weapon Fighting');
      await sleep(1200);
      ok('8a. unlisted styles lose their face; the listed one keeps it', !face('Defense') && !face('Dueling') && !!face('Great Weapon Fighting'),
        `faces=${actor.effects.filter(e => e.getFlag(MOD, 'fightingStyle')).map(e => e.name).join(', ')}`);
      ok('8b. the pack\'s own Defense and Dueling effects come back on, unflagged',
        packEffect('Defense')?.disabled === false && packEffect('Dueling')?.disabled === false
          && !packEffect('Defense')?.getFlag(MOD, 'fightingStyleTakenOver'),
        `defense=${packEffect('Defense')?.disabled} dueling=${packEffect('Dueling')?.disabled}`);
      await set('fightingStyleList', def('fightingStyleList'));
      await sleep(1200);
    }

    // ================================================== 9. Blind Fighting
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

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'styles', out, plan, f });
