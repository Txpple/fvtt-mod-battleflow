// Classes smoke suite — Ranger: the PHB classes plan's rows (audits/plans/session-0-classes.md) for
// the Ranger, each section keeping its number and title. The fixtures, the lends, the
// helpers and the teardown are the classes kit's (tools/class-kit.mjs); everything written is restored.
import { announcePlan, connectSuite, finish, sectionPlan } from './harness.mjs';
import { runClassSuite } from './class-kit.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'clock-riders.js',        // Colossus Slayer and the option ask (§18), Bestial Fury (§70), Superior Hunter's Prey (§71)
  'hew.js',                 // Horde Breaker's reminder (§18)
  'damage-holds.js',        // Superior Hunter's Defense on a cantrip (§73)
  'concentration.js'        // Relentless Hunter: the exempt row (§84)
];

const SECTIONS = {
  18: 'Hunter\'s Prey: the first hit asks "which option did you take?"; Colossus Slayer is kept on the feature, its 1d8 rides a damaged target and not an undamaged one; the card\'s Change forgets it; asked again, Horde Breaker with the Cleric 5 ft from the target posts Hew\'s reminder "Horde Breaker — …"',
  70: 'Bestial Fury (C1, the Attacker the PC Attacker\'s summon, the Halfling under its Hunter\'s Mark): the companion\'s hit offers the ranger\'s force die; Create Thrall: the thrall\'s hit on the Hex offers 1d6 psychic',
  71: 'Superior Hunter\'s Prey (C1, the PC Attacker a Ranger 11, the Victim marked): the damage card\'s pick — one other creature within 30 ft; the Attacker picked takes the die on its own card',
  72: 'Stalker\'s Flurry (C1, the PC Attacker a Gloom Stalker): Dreadful Strike rides, the card offers Sudden Strike / Mass Fear; Sudden Strike recorded; Mass Fear\'s save demanded of the enemies within 10 ft',
  73: 'Superior Hunter\'s Defense (C1, the Halfling): a hit\'s hold halves the damage and lands "Hunter\'s Defense: <type>"; a cantrip\'s damage asks through the damage hold and halves',
  84: 'Relentless Hunter (C1, the Sorcerer concentrating on Hunter\'s Mark): damage posts "no save for Hunter\'s Mark", no Concentration ask'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'class-ranger', watchdogMs: 900_000 });
announcePlan('class-ranger', plan, pulled);

const out = await runClassSuite(f, { plan, sections: SECTIONS, body: async ({ sections, titles }) => {
  const { until, watch, faces, unrig } = window.__btb;
  const { results, skips, ok, want, section } = window.__btb.begin({ sections, titles });
  const KIT = window.__btbClasses;
  const { MOD, a1Damage, a1Formula, a1Hit, a1Roll, a1Victim, ackHew, act, attackOf, attacker, attackerToken, c1Cards, cardEl, cardText, clearTargets, cleric, clericToken, closeA1, closeDialogs, closeOffers, damageFor, dropEffects, dropNamed, dropReactionChips, dropVictimFx, halfling, halflingToken, healFull, hewNotices, hgKeep, hgLend, hitAt, holdOf, hp, lend, log, markOn, pcAttacker, pcToken, pcWeapon, pickApply, popups, resolvedTarget, riderBox, riderChits, riderRow, ridersOf, set, sorcTokC, sorcerer, spendLuckC, swing, textOf, unlend, victim, victimToken } = KIT;
  try {
    await KIT.leaveA3();

    // ---- 18. Hunter's Prey: the option asked once and kept; Colossus Slayer; Change; Horde Breaker's reminder
    if (want(18)) await section(18, async () => {
      await closeDialogs(); await a1Victim();
      if (!pcWeapon) log.push('§18 skipped: BTB Test PC Attacker has no weapon');
      else {
        const prey = await lend(pcAttacker, "Hunter's Prey");
        const KEY = 'hunters-prey-colossus-slayer';
        const optOf = () => pcAttacker.items.get(prey.id)?.getFlag(MOD, 'option') ?? null;
        const askOf = offer => offer?.element?.querySelector(`[data-bf-option-ask="${prey.id}"]`) ?? null;
        try {
          const { formula: cs } = a1Formula(prey, 'Damage', pcAttacker);
          const wType = [...(pcWeapon.system?.damage?.base?.types ?? [])][0] ?? null;
          const act = attackOf(pcAttacker, pcWeapon);
          // a/b — the first hit, on a DAMAGED target (300 / 400), out of combat
          const { msg, offer } = await a1Hit(pcAttacker, pcToken, act, { hpTo: 300 });
          const ask = askOf(offer);
          const radios = [...(ask?.querySelectorAll(`input[name="bf-option-${prey.id}"]`) ?? [])];
          ok('18a. the first hit asks "Hunter\'s Prey — which option did you take?": Colossus Slayer ("… rides this hit") and Horde Breaker, none picked, no rider row yet',
            !!ask && /Hunter's Prey — which option did you take\?/.test(textOf(ask)) && radios.some(r => r.value === 'Colossus Slayer')
              && radios.some(r => r.value === 'Horde Breaker') && radios.every(r => !r.checked) && /rides this hit/.test(textOf(ask)) && !riderBox(offer, KEY),
            `offer=${!!offer} radios=${radios.map(r => r.value)} ask="${textOf(ask).slice(0, 260)}"`);
          ask?.querySelector('input[value="Colossus Slayer"]')?.click();   // the radio's change handler keeps the pick at once
          const d1 = await a1Roll(msg, offer);
          const r1 = ridersOf(d1).find(x => x.key === KEY);
          ok(`18b. picked Colossus Slayer: kept on the feature (option flag); on the damaged target its ${cs} of the weapon's type rides`,
            (optOf() === 'Colossus Slayer') && !!r1 && /d8/.test(r1.formula ?? '') && (r1.formula === cs) && (!wType || (r1.type === wType))
              && (r1.option === 'Colossus Slayer') && /the target is damaged/.test(r1.why ?? '') && (msg?.getFlag(MOD, 'clockPick') ?? []).includes(KEY),
            `option=${optOf()} cs=${cs} rider=${JSON.stringify(r1)} pick=${JSON.stringify(msg?.getFlag(MOD, 'clockPick'))}`);
          // c — an UNDAMAGED target: kept, so nothing asks; not due, so nothing rides
          const { msg: m2, offer: o2 } = await a1Hit(pcAttacker, pcToken, act, { hpTo: 400 });
          const d2 = o2 ? await a1Roll(m2, o2) : await a1Damage(m2);
          ok('18c. an undamaged target (400 / 400): no ask, no Colossus Slayer row, nothing rides',
            !!d2 && !askOf(o2) && !riderBox(o2, KEY) && !ridersOf(d2).some(x => x.key === KEY),
            `offer=${!!o2} riders=${JSON.stringify(ridersOf(d2).map(x => x.key))}`);
          // d — damaged again: the kept option's TICKED row, no ask
          const { msg: m3, offer: o3 } = await a1Hit(pcAttacker, pcToken, act, { hpTo: 300 });
          const box3 = riderBox(o3, KEY);
          ok('18d. kept: the next damaged hit asks nothing — the ticked row "Colossus Slayer — 1d8 …"',
            !!box3 && box3.checked && !askOf(o3) && /Colossus Slayer — .*d8/.test(riderRow(o3, KEY)),
            `offer=${!!o3} checked=${box3?.checked} ask=${!!askOf(o3)} row="${riderRow(o3, KEY)}"`);
          const d3 = await a1Roll(m3, o3);
          // e/f — the card's Change
          const change = await until(() => [...(cardEl(d3?.id)?.querySelectorAll('button') ?? [])].find(b => /Change Hunter's Prey option/.test(b.textContent ?? '')), { timeout: 6000, label: 'the damage card\'s "Change Hunter\'s Prey option" button' });
          ok('18e. the damage card: "Colossus Slayer — … rode this roll" with "Change Hunter\'s Prey option"',
            !!change && /Colossus Slayer — .*rode this roll/.test(cardText(d3?.id)), cardText(d3?.id).slice(0, 260));
          change?.click();
          const cleared = await until(() => optOf() === null, { timeout: 6000, label: 'the Hunter\'s Prey option forgotten' });
          ok('18f. Change forgets the option', cleared === true, `option=${JSON.stringify(optOf())}`);
          // g — asked again; Horde Breaker; BTB Test Cleric stands 5 ft from the Victim (1600 vs 1500, y 1900)
          const tH = Date.now();
          const { msg: m4, offer: o4 } = await a1Hit(pcAttacker, pcToken, act, { hpTo: 300 });
          const ask4 = askOf(o4);
          ask4?.querySelector('input[value="Horde Breaker"]')?.click();   // the radio's change handler keeps the pick at once
          const d4 = await a1Roll(m4, o4);
          const hb = await until(() => hewNotices(tH, 'Horde Breaker')[0] ?? null, { timeout: 8000, label: 'Hew\'s Horde Breaker reminder' });
          const n = hb?.getFlag(MOD, 'hewNotice');
          const clericName = clericToken.document?.name ?? cleric.name;
          ok(`18g. the next hit asks again; Horde Breaker is kept (nothing rides) and, ${clericName} within 5 ft of the target, Hew's reminder "Horde Breaker — BTB Test PC Attacker can attack again … within 5 ft of …"`,
            !!ask4 && (optOf() === 'Horde Breaker') && !!d4 && !ridersOf(d4).some(x => x.key === KEY) && !!hb
              && /Horde Breaker — BTB Test PC Attacker can attack again/.test(hb.content ?? '') && /within 5 ft of/.test(n?.why ?? '')
              && (n?.why ?? '').includes(clericName) && !n?.offer,
            `ask=${!!ask4} option=${optOf()} riders=${JSON.stringify(ridersOf(d4).map(x => x.key))} notice=${JSON.stringify(n ? { label: n.label, why: n.why, offer: !!n.offer } : null)}`);
          await ackHew('Horde Breaker');
        } finally {
          await closeOffers();
          await ackHew('Horde Breaker');
          await unlend(pcAttacker, prey);
        }
      }
    });
    KIT.markA2();

    // ---- 70. Bestial Fury and Create Thrall: the riders on a summon
    if (want(70)) await section(70, async () => {
      await closeDialogs(); await spendLuckC();
      const ranger = await hgLend(pcAttacker, 'Ranger', 'class', { 'system.levels': 11 });
      const companion = await hgLend(pcAttacker, 'Primal Companion', 'feat');
      const fury = await hgLend(pcAttacker, 'Bestial Fury', 'feat');
      const mark = await hgLend(pcAttacker, "Hunter's Mark", 'spell', { 'system.prepared': 1, 'system.method': 'spell' });
      const summonAct = companion ? [...(companion.system.activities ?? [])].find(a => a.type === 'summon') : null;
      let marked = null;
      try {
        if (!ranger || !companion || !fury || !mark || !summonAct) log.push(`§70 skipped: ranger=${!!ranger} companion=${!!companion} fury=${!!fury} mark=${!!mark} summon=${!!summonAct}`);
        else {
          await attacker.setFlag('dnd5e', 'summon', { origin: summonAct.uuid });
          marked = await markOn(halfling, "Hunter's Mark", mark.uuid, ['marked']);
          const r1 = await hitAt(attackerToken, act(), halflingToken, { hpTo: 400, actor: halfling });
          const scale = String(pcAttacker.getRollData()?.scale?.ranger?.mark ?? '');
          ok('70a. the companion (the Attacker, the ranger\'s summon) hits the marked Halfling: the rider "Bestial Fury" with the ranger\'s force die',
            !!riderBox(r1.offer, 'bestial-fury') && /force/.test(riderRow(r1.offer, 'bestial-fury')) && /d\d/.test(riderRow(r1.offer, 'bestial-fury')),
            `offer=${!!r1.offer} row="${riderRow(r1.offer, 'bestial-fury').slice(0, 140)}" scale="${scale}"`);
          if (r1.offer) await a1Roll(r1.msg, r1.offer); else await a1Damage(r1.msg);
          await marked.delete().catch(() => {}); marked = null;
          const r2 = await hitAt(attackerToken, act(), halflingToken, { hpTo: 400, actor: halfling });
          ok('70b. the Halfling no longer marked: no Bestial Fury row', !riderBox(r2.offer, 'bestial-fury'), `offer=${!!r2.offer}`);
          if (r2.offer) await a1Roll(r2.msg, r2.offer);
          // Create Thrall: the same shape on the warlock's Hex (the companion stays lent: the Attacker's summon origin is its activity)
          for (const it of [fury, mark, ranger]) await unlend(pcAttacker, it);
          const warlock = await hgLend(pcAttacker, 'Warlock', 'class', { 'system.levels': 14 });
          const thrall = await hgLend(pcAttacker, 'Create Thrall', 'feat');
          const hex = await hgLend(pcAttacker, 'Hex', 'spell', { 'system.prepared': 1, 'system.method': 'spell' });
          try {
            if (!warlock || !thrall || !hex) log.push(`§70c skipped: warlock=${!!warlock} thrall=${!!thrall} hex=${!!hex}`);
            else {
              marked = await markOn(halfling, 'Hex', hex.uuid);
              const r3 = await hitAt(attackerToken, act(), halflingToken, { hpTo: 400, actor: halfling });
              ok('70c. the thrall\'s hit on the Hexed Halfling: the rider "Create Thrall — 1d6 psychic"', !!riderBox(r3.offer, 'create-thrall') && /1d6/.test(riderRow(r3.offer, 'create-thrall')) && /psychic/.test(riderRow(r3.offer, 'create-thrall')),
                `offer=${!!r3.offer} row="${riderRow(r3.offer, 'create-thrall').slice(0, 140)}"`);
              if (r3.offer) await a1Roll(r3.msg, r3.offer); else await a1Damage(r3.msg);
            }
          } finally {
            for (const it of [thrall, hex, warlock]) if (it) await unlend(pcAttacker, it);
          }
        }
      } finally {
        await closeOffers(); await closeDialogs();
        await attacker.unsetFlag('dnd5e', 'summon').catch(() => {});
        if (marked) await marked.delete().catch(() => {});
        await dropNamed(halfling, ["Hunter's Mark", 'Hex']);
        await dropEffects(attacker, riderChits(attacker));
        for (const it of [fury, companion, mark, ranger]) if (it && pcAttacker.items.get(it.id)) await unlend(pcAttacker, it);
        await healFull();
        unrig(); clearTargets();
      }
    });

    // ---- 71. Superior Hunter's Prey: the pick on the damage card
    if (want(71)) await section(71, async () => {
      await closeDialogs(); await a1Victim(); await dropVictimFx();
      hgKeep(attacker, { 'system.attributes.hp.value': attacker.system._source.attributes.hp.value });
      const ranger = await hgLend(pcAttacker, 'Ranger', 'class', { 'system.levels': 11 });
      const prey = await hgLend(pcAttacker, "Superior Hunter's Prey", 'feat');
      const mark = await hgLend(pcAttacker, "Hunter's Mark", 'spell', { 'system.prepared': 1, 'system.method': 'spell' });
      let marked = null;
      try {
        if (!ranger || !prey || !mark || !pcWeapon) log.push(`§71 skipped: ranger=${!!ranger} prey=${!!prey} mark=${!!mark} weapon=${!!pcWeapon}`);
        else {
          await attacker.update({ 'system.attributes.hp.value': Number(attacker.system.attributes.hp.max) || 20 });
          const ahp0 = Number(attacker.system.attributes.hp.value);
          marked = await markOn(victim, "Hunter's Mark", mark.uuid, ['marked']);
          const r1 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('71a. the hit on the marked Victim: no rider on the roll (a pick, never a die)', !riderBox(r1.offer, 'superior-hunters-prey'), `offer=${!!r1.offer}`);
          const d1 = r1.offer ? await a1Roll(r1.msg, r1.offer) : await a1Damage(r1.msg);
          // The row is the label span's parent (the outer card div would match the text too).
          const row = await until(() => [...(cardEl(d1?.id)?.querySelectorAll?.('span') ?? [])].find(el => /^Superior Hunter's Prey — \+/.test(textOf(el)))?.parentElement ?? null, { timeout: 8000, label: 'the damage card\'s Superior Hunter\'s Prey row' });
          const buttons = [...(row?.querySelectorAll?.('button') ?? [])].map(b => textOf(b));
          const { creaturesWithin } = await import('/modules/fvtt-mod-bythebooks/scripts/geometry.js');
          const expected = creaturesWithin(victimToken, 30).filter(t => t.actor && (t.actor.uuid !== victim.uuid) && (t.actor.uuid !== pcAttacker.uuid)).length;
          ok('71b. the damage card offers "Superior Hunter\'s Prey — +<die> force to one other creature within 30 ft of the marked target" with a button per candidate (every other creature within 30 ft of the Victim, the Attacker among them)',
            !!row && /one other creature within 30 ft/.test(textOf(row)) && buttons.includes(attackerToken.document.name) && (buttons.length === expected),
            `row="${textOf(row).slice(0, 200)}" buttons=${JSON.stringify(buttons)} expected=${expected}`);
          const t0 = Date.now();
          faces([[4, 6]]);
          [...(row?.querySelectorAll?.('button') ?? [])].find(b => textOf(b) === attackerToken.document.name)?.click();
          const pickCard = await until(() => c1Cards(t0, 'spellRiderCard').find(m => m.getFlag(MOD, 'spellRiderCard')?.targetUuid === attacker.uuid) ?? null, { timeout: 10000, label: 'the pick\'s own card for the Attacker' });
          await until(() => Number(attacker.system.attributes.hp.value) < ahp0, { timeout: 6000, label: 'the pick\'s damage on the Attacker' });
          const twice = await watch(() => Number(attacker.system.attributes.hp.value) < ahp0 - 4, { ms: 300 });   // a window: the die lands once
          unrig();
          const rec = pickCard?.getFlag(MOD, 'spellRiderCard');
          ok('71c. the Attacker picked: its own card "+4 force to BTB Test Attacker", the die rolled there, the damage landed',
            !twice && !!pickCard && (rec?.value === 4) && (rec?.type === 'force') && (Number(attacker.system.attributes.hp.value) === ahp0 - 4),
            `record=${JSON.stringify(rec && { value: rec.value, type: rec.type, target: rec.targetUuid === attacker.uuid })} hp=${attacker.system.attributes.hp.value} from ${ahp0} twice=${!!twice}`);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        if (marked) await marked.delete().catch(() => {});
        await dropVictimFx(); await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [prey, mark, ranger]) if (it) await unlend(pcAttacker, it);
        unrig(); clearTargets();
      }
    });

    // ---- 72. Stalker's Flurry: the follow-up after Dreadful Strike
    if (want(72)) await section(72, async () => {
      await closeDialogs(); await a1Victim(); await dropVictimFx(); await set('saveRolls', 'auto');
      const ranger = await hgLend(pcAttacker, 'Ranger', 'class', { 'system.levels': 11 });
      const ambusher = await hgLend(pcAttacker, 'Dread Ambusher', 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 });
      const flurry = await hgLend(pcAttacker, "Stalker's Flurry", 'feat');
      try {
        if (!ranger || !ambusher || !flurry || !pcWeapon) log.push(`§72 skipped: ranger=${!!ranger} ambusher=${!!ambusher} flurry=${!!flurry} weapon=${!!pcWeapon}`);
        else {
          const followRow = d => cardEl(d?.id)?.querySelector('.bf-rider-follow') ?? null;
          const r1 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('72a. the hit offers Dreadful Strike', !!riderBox(r1.offer, 'dread-ambusher'), `offer=${!!r1.offer} rows=${JSON.stringify(r1.offer ? [...r1.offer.element.querySelectorAll('[data-bf-rider-row]')].map(e => e.dataset.bfRiderRow) : null)}`);
          const d1 = await a1Roll(r1.msg, r1.offer);
          const row1 = await until(() => followRow(d1), { timeout: 8000, label: 'the damage card\'s Stalker\'s Flurry row' });
          const labels = [...(row1?.querySelectorAll?.('button') ?? [])].map(b => textOf(b));
          ok('72b. it rode: the damage card offers "Stalker\'s Flurry — one of: Sudden Strike / Mass Fear"', !!row1 && /Stalker's Flurry — one of/.test(textOf(row1)) && labels.includes('Sudden Strike') && labels.includes('Mass Fear'),
            `row="${textOf(row1).slice(0, 160)}" labels=${JSON.stringify(labels)}`);
          [...(row1?.querySelectorAll?.('button') ?? [])].find(b => textOf(b) === 'Sudden Strike')?.click();
          const picked = await until(() => ridersOf(game.messages.get(d1?.id)).find(r => r.key === 'dread-ambusher')?.follow?.picked ?? null, { timeout: 6000, label: 'Sudden Strike recorded on the rider' });
          // The card re-renders with the pick a moment after the flag lands.
          await until(() => /one more attack/.test(textOf(followRow(d1))), { label: 'the card\'s "one more attack" line' });
          ok('72c. Sudden Strike picked: recorded on the rider, the card says "one more attack … from the sheet"', (picked?.label === 'Sudden Strike') && /one more attack/.test(textOf(followRow(d1))),
            `picked=${JSON.stringify(picked)} row="${textOf(followRow(d1)).slice(0, 160)}"`);
          await dropEffects(pcAttacker, riderChits(pcAttacker));
          // The first ride spent the lent copy's uses (its activity carries none of its own): reset for the second hit.
          const dsAct = pcAttacker.items.get(ambusher.id)?.system?.activities?.find(a => a.name === 'Dreadful Strike');
          await pcAttacker.items.get(ambusher.id)?.update({ 'system.uses.spent': 0, ...(dsAct ? { [`system.activities.${dsAct.id}.uses.spent`]: 0 } : {}) });
          const t2 = Date.now();
          const r2 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          const d2 = await a1Roll(r2.msg, r2.offer);
          const row2 = await until(() => followRow(d2), { timeout: 8000, label: 'the second damage card\'s Stalker\'s Flurry row' });
          faces([[1, 20], [1, 20]]);
          [...(row2?.querySelectorAll?.('button') ?? [])].find(b => textOf(b) === 'Mass Fear')?.click();
          const demand = await until(() => game.messages.contents.find(m => (m.timestamp >= t2) && m.getFlag(MOD, 'saves') && (m.id !== d2?.id) && (m.getFlag(MOD, 'saves')?.item?.name === "Stalker's Flurry")) ?? null, { timeout: 10000, label: 'Mass Fear\'s save demand' });
          // The saves roll themselves on the pinned 1s before the dice go back. The emanation asks everyone inside, an ally
          // prompted too, and 72d reads only who was asked: an ask left open is tolerated.
          await until(() => (demand.getFlag(MOD, 'saves')?.targets ?? []).every(t => t.applied), { timeout: 3000, label: 'Mass Fear\'s saves rolled and applied' }).catch(() => null);
          unrig();
          const targets = (demand?.getFlag(MOD, 'saves')?.targets ?? []).map(t => t.uuid);
          const since = game.messages.contents.filter(m => m.timestamp >= t2).map(m => [m.type, m.getFlag('dnd5e', 'item')?.type ?? null, Object.keys(m.flags?.[MOD] ?? {}).join('+'), (m.content ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 60)]);
          ok('72d. Mass Fear picked: the pack\'s Wisdom save demanded of the enemies within 10 ft of the ranger (the Victim, the Attacker), nobody else',
            !!demand && targets.includes(victim.uuid) && !targets.includes(attacker.uuid),   // the pack's 10-ft Emanation of the ranger: everyone inside is asked (allies too), the Attacker at 11 ft not
            `demand=${!!demand} targets=${JSON.stringify((demand?.getFlag(MOD, 'saves')?.targets ?? []).map(t => t.name))} picked=${JSON.stringify(ridersOf(game.messages.get(d2?.id)).find(r => r.key === 'dread-ambusher')?.follow?.picked ?? null)} since=${JSON.stringify(since.slice(-6))}`);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        await dropVictimFx(); await dropNamed(attacker, ['Frightened']); await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [flurry, ambusher, ranger]) if (it) await unlend(pcAttacker, it);
        unrig(); clearTargets();
      }
    });

    // ---- 73. Superior Hunter's Defense: the half on a hit (the hold) and on any damage (the damage hold), the typed effect
    if (want(73)) await section(73, async () => {
      await closeDialogs(); await spendLuckC(); await dropReactionChips(halfling); await set('saveRolls', 'auto');
      const shd = await hgLend(halfling, "Superior Hunter's Defense", 'feat');
      // The hit's hold opens the rescue window (Uncanny Dodge's shape): its row ticked, Answer casts.
      const holdPopup = () => popups().find(app => /Superior Hunter's Defense/.test(textOf(app.element)) && (app.element?.querySelector?.('[data-bf-ticks="bf-rescue"]') || app.element?.querySelector?.('button[data-action="cast"]'))) ?? null;
      const answerHold = async pop => {
        const box = [...(pop?.element?.querySelectorAll?.('input[name="bf-rescue"]') ?? [])].find(x => x.value === "Superior Hunter's Defense");
        if (box) { if (!box.checked) box.click(); pickApply(pop); }   // the tick's change handler runs inside the click
        else pop?.element?.querySelector('button[data-action="cast"]')?.click();
      };
      const typed = () => halfling.effects.find(e => e.name.startsWith("Hunter's Defense: ")) ?? null;
      try {
        if (!shd) log.push('§73 skipped: no Superior Hunter\'s Defense in the PHB');
        else {
          const msg = await swing({ d20: [12], dmg: 6 });
          const pop = await until(holdPopup, { timeout: 8000, label: 'the Halfling\'s Superior Hunter\'s Defense popup' });
          const t0 = holdOf(msg)?.targets?.find(x => x.uuid === halfling.uuid);
          ok('73a. a hit is held for Superior Hunter\'s Defense (a damage interrupt, the half); the Halfling\'s popup', !!pop && (t0?.reaction === "Superior Hunter's Defense") && (t0?.kind === 'damage'),
            `pop=${!!pop} target=${JSON.stringify(t0 && { reaction: t0.reaction, kind: t0.kind })}`);
          await until(() => damageFor(msg?.id), { timeout: 8000, label: 'the held hit\'s damage rolled' });
          await answerHold(pop);
          const rt = await resolvedTarget(msg);
          const dmg = await until(() => { const m = damageFor(msg?.id); return m?.getFlag(MOD, 'receipt') ? m : null; }, { timeout: 12000, label: 'the held hit\'s damage receipt' });
          const receipt = dmg?.getFlag(MOD, 'receipt')?.targets?.find(x => x.uuid === halfling.uuid);
          const fx = await until(typed, { timeout: 8000, label: 'the typed "Hunter\'s Defense: <type>" on the Halfling' });
          // ⚠ The goblin's weapon rolls ONE die (8 with the pinned 6); the effect lands AFTER the share, so the half is one half.
          const rolled = (dmg?.rolls ?? []).reduce((n, r) => n + (Number(r.total) || 0), 0);
          const half = Math.floor(rolled / 2);
          ok('73b. Cast: the damage halved once (the goblin\'s 8 → 4), the pack\'s typed Resistance ("Hunter\'s Defense: <type>") lands on the Halfling for the turn — after the share',
            (rt?.answer === 'cast') && (rolled > 0) && (Number(receipt?.taken) === half) && !!fx && (hp() === 400 - half), `answer=${rt?.answer} rolled=${rolled} taken=${receipt?.taken} hp=${hp()} fx=${fx?.name ?? null}`);
          await dropNamed(halfling, halfling.effects.filter(e => e.name.startsWith("Hunter's Defense: ")).map(e => e.name)); await dropReactionChips(halfling); await healFull();
          // any damage: the Attacker's Sacred Flame fails — the damage hold asks, halves
          let flameId = attacker.items.find(i => (i.name === 'Sacred Flame') && (i.type === 'spell'))?.id;
          if (!flameId) { const flame = await hgLend(attacker, 'Sacred Flame', 'spell', { 'system.prepared': 1, 'system.method': 'atwill' }); flameId = flame?.id; }
          const flameAct = attacker.items.get(flameId)?.system?.activities?.find(a => a.type === 'save');
          if (!flameAct) log.push('§73c skipped: no Sacred Flame save activity');
          else {
            const t1 = Date.now();
            attackerToken.control({ releaseOthers: true });
            halflingToken.setTarget(true, { releaseOthers: true });
            faces([[4, 8], [1, 20]]);   // ⚠ the damage die rolls BEFORE the save: the d8 first, then the natural 1
            await flameAct.use({ consume: { spellSlot: false } }, { configure: false }, {});
            const hold = await until(() => c1Cards(t1, 'damageHold').find(m => m.getFlag(MOD, 'damageHold')?.reaction === "Superior Hunter's Defense") ?? null, { timeout: 10000, label: 'the damage hold card for Superior Hunter\'s Defense' });
            const pop2 = await until(() => popups().find(app => /Superior Hunter's Defense/.test(textOf(app.element)) && /may reduce \d+ damage/.test(textOf(app.element))) ?? null, { timeout: 6000, label: 'the damage hold\'s "may reduce N damage" popup' });
            ok('73c. a failed save\'s damage is held by the damage hold: the card "is about to take N damage", the popup "may reduce N damage"', !!hold && !!pop2 && (hold.getFlag(MOD, 'damageHold')?.halve === 0.5),
              `hold=${JSON.stringify(hold?.getFlag(MOD, 'damageHold') && { amount: hold.getFlag(MOD, 'damageHold').amount, halve: hold.getFlag(MOD, 'damageHold').halve })} pop=${!!pop2}`);
            const amount = Number(hold?.getFlag(MOD, 'damageHold')?.amount ?? 0);
            pop2?.element?.querySelector('button[data-action="cast"]')?.click();
            // `applied` is written last: the halved share and the typed Resistance have landed by then.
            const done = await until(() => hold?.getFlag(MOD, 'damageHold')?.applied ? hold.getFlag(MOD, 'damageHold') : null, { timeout: 12000, label: 'the damage hold applied' });
            unrig();
            ok('73d. Cast: half the share lands, the typed Resistance (radiant) with it', (done?.answer === 'cast') && (Number(done?.reduceBy) === amount - Math.floor(amount / 2)) && (hp() === 400 - Math.floor(amount / 2)) && (typed()?.name === "Hunter's Defense: Radiant"),
              `done=${JSON.stringify(done && { answer: done.answer, reduceBy: done.reduceBy, amount: done.amount })} hp=${hp()} fx=${typed()?.name ?? null}`);
            clearTargets();
          }
        }
      } finally {
        await closeDialogs();
        await dropNamed(halfling, halfling.effects.filter(e => e.name.startsWith("Hunter's Defense: ")).map(e => e.name)); await dropReactionChips(halfling);
        if (shd) await unlend(halfling, shd);
        await healFull();
        unrig(); clearTargets();
      }
    });

    // ---- 84. Relentless Hunter: damage never demands the save for Hunter's Mark
    if (want(84)) await section(84, async () => {
      await closeA1();
      hgKeep(sorcerer, { 'system.spells': foundry.utils.deepClone(sorcerer.system._source.spells), 'system.attributes.hp.value': sorcerer.system._source.attributes.hp.value, 'system.attributes.hp.max': sorcerer.system._source.attributes.hp.max });
      const priorConc = game.settings.get(MOD, 'concMode');
      const hunter = await hgLend(sorcerer, 'Relentless Hunter', 'feat');
      const mark = await hgLend(sorcerer, "Hunter's Mark", 'spell', { 'system.prepared': 1, 'system.method': 'spell' });
      const sTok = sorcTokC();
      try {
        if (!hunter || !mark || !sTok) log.push(`§84 skipped: hunter=${!!hunter} mark=${!!mark} token=${!!sTok}`);
        else {
          await set('concMode', 'ask');
          await sorcerer.update({ 'system.spells.spell1.value': 4, 'system.attributes.hp.max': 100, 'system.attributes.hp.value': 100 });
          const markAct = mark.system.activities.find(a => a.name === 'Mark Creature') ?? mark.system.activities.contents[0];
          victimToken.setTarget(true, { releaseOthers: true });
          await markAct.use({ spell: { slot: 'spell1' }, subsequentActions: false }, { configure: false }, {});
          clearTargets();
          const conc = await until(() => sorcerer.effects.find(e => e.statuses?.has?.('concentrating')) ?? null, { timeout: 8000, label: 'the sorcerer concentrating on Hunter\'s Mark' });
          const t0 = Date.now();
          await sorcerer.applyDamage([{ value: 5, type: 'fire' }]);
          const exempt = await until(() => c1Cards(t0, 'concentrationExempt')[0] ?? null, { timeout: 8000, label: 'the Relentless Hunter exempt card' });
          const ask84 = await watch(() => c1Cards(t0, 'concentration')[0] ?? null, { ms: 1200 });   // a window: no Concentration ask
          const asked = c1Cards(t0, 'concentration').length;
          ok('84a. concentrating on Hunter\'s Mark, 5 damage: the card "Relentless Hunter — no save for Hunter\'s Mark", no Concentration ask, the effect standing',
            !!conc && !!exempt && !ask84 && (asked === 0) && /Relentless Hunter — no save for Hunter's Mark/.test(cardText(exempt?.id)) && !!sorcerer.effects.get(conc.id),
            `conc=${!!conc} exempt=${!!exempt} asks=${asked} card="${cardText(exempt?.id).slice(0, 160)}"`);
        }
      } finally {
        await closeA1();
        await set('concMode', priorConc);
        for (const e of sorcerer.effects.filter(e => e.statuses?.has?.('concentrating'))) await e.delete().catch(() => {});
        await dropNamed(victim, ["Hunter's Mark"]);
        for (const it of [mark, hunter]) if (it) await unlend(sorcerer, it);
        unrig(); clearTargets();
      }
    });
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  }
} });

await finish({ tag: 'class-ranger', out, plan, f });
