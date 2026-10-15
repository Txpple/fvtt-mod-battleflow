// Classes smoke suite — Sorcerer: the PHB classes plan's rows (audits/plans/session-0-classes.md) for
// the Sorcerer, each section keeping its number and title. The fixtures, the lends, the
// helpers and the teardown are the classes kit's (tools/class-kit.mjs); everything written is restored.
import { announcePlan, connectSuite, finish, sectionPlan } from './harness.mjs';
import { runClassSuite } from './class-kit.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'hold/trigger.js',        // Restore Balance on a hit and a miss (§4, §9), Bend Luck (§51)
  'hold/lookup.js',         // the Sorcerer as a bystander (§4, §9)
  'hold/answer.js',         // the first d20 stood (§4, §9)
  'hold/views.js',          // the Sorcerer's popup (§4)
  'hold/continue.js',       // the verdict retaken (§4, §9)
  'hold/dice.js',           // the bent roll's chips (§51)
  'bystanders.js',          // Restore Balance on a demanded save (§10)
  'advantage-buys.js',      // Tides of Chaos (§26)
  'reminders.js',           // Trance of Order in the gate (§75)
  'ward-pools.js',          // Bastion of Law (§61)
  'cast-riders.js'          // Wild Magic Surge, Controlled Chaos, Tamed Surge (§39, §76, §100)
];

const SECTIONS = {
  4: 'Restore Balance: an Advantage hit (18 and 9) whose first die misses opens the Sorcerer\'s popup; Answer stands the 9 — a MISS; Cutting Words (margin 8) stays quiet',
  9: 'Restore Balance on a Disadvantage miss (18 then 3): the Sorcerer\'s popup beside the Cleric\'s; Answer stands the 18 — a HIT, the Cleric\'s popup closes',
  10: 'Restore Balance on a DEMANDED save: the Attacker\'s Sacred Flame, the Halfling\'s Dexterity save rolled with Disadvantage failing on its lower die — the verdict waits; the Sorcerer\'s popup; Answer stands the first die: SAVED, the roll\'s card says so',
  26: 'Tides of Chaos: an attack, a save and a check dialog carry the buy box "Tides of Chaos — 1 use · 1 left"; ticked and pressed, the save rolls at Advantage, the use spent and recorded; with none left the box is greyed "no uses left", no tick',
  39: 'Wild Magic Surge (lent to the Sorcerer with Tides of Chaos; Mage Armor marked a Sorcerer spell): a slot cast rolls the d20 — "d20: 14, nothing"; a 20 rolls the table and its card posts; Tides of Chaos spent: the table at once and Tides regained; a Wizard spell rolls nothing; in a combat, once per turn',
  51: 'Bend Luck (B4, lent to the Sorcerer with Font of Magic): a foe\'s hit on the Halfling by 2 asks "−1d4" (Answer: a MISS, a point spent); a friend\'s miss by 3 asks "+1d4" (Answer: a HIT, another point)',
  61: 'Bastion of Law (B4, the Sorcerer): Create Shield with 3 points wards the Halfling for 12 on "Warded by Law (12)"; hits are absorbed until the effect goes; Projected Ward: the sorcerer\'s Arcane Ward absorbs the Halfling\'s next hit (Absorb)',
  75: 'Trance of Order (C1, the Sorcerer): the Reckless Attacker\'s gate at the sorcerer reads "cannot have Advantage", net Normal; the sorcerer\'s own save with a 3 counts as 10',
  76: 'Controlled Chaos (C1, the Sorcerer): the surge rolls the table twice, the line offers the pick; the pick recorded',
  100: "Tamed Surge (D1, the Sorcerer): a slot cast offers the table's rows but the last; the pick recorded, the use spent"
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'class-sorcerer', watchdogMs: 900_000 });
announcePlan('class-sorcerer', plan, pulled);

const out = await runClassSuite(f, { plan, sections: SECTIONS, body: async ({ sections, titles }) => {
  const { until, watch, faces, unrig } = window.__btb;
  const { results, skips, ok, want, section } = window.__btb.begin({ sections, titles });
  const KIT = window.__btbClasses;
  const { MOD, a1Damage, a1Victim, act, attackOf, attacker, attackerToken, balance, bard, bystanderPopup, cardEl, cardText, castSpell, clearTargets, closeA1, closeDialogs, closeOffers, created, dropFx, dropReactionChips, findPHB, fxNamed, gateDrawn, gateFor, halfling, halflingToken, healFull, hgKeep, hgLend, holdOf, hp, lend, lentBy, log, markOn, missSide, missTarget, modOf, pcAttacker, pcToken, pcWeapon, pickApply, popupTitled, popups, refillDivinity, refillInspiration, resolvedTarget, rollDialog, rollFlag, rollPopup, scene, sorcTokC, sorcerer, sorcererDoc, spendLuck, suiteStart, surgeLineOf, swing, swingAt, textOf, unlend, useFeature, victim } = KIT;
  try {

    // ---- 4. Restore Balance on an Advantage hit
    if (want(4)) await section(4, async () => {
      await closeDialogs(); await spendLuck(); await refillInspiration();
      await balance.update({ 'system.uses.spent': 0 });
      const msg = await swing({ d20: [9, 18], advantage: true });
      const pop = await until(bystanderPopup, { timeout: 6000, label: 'the Sorcerer\'s Restore Balance popup' });
      const guards = holdOf(msg)?.targets?.[0]?.guards ?? [];
      ok('4a. the Sorcerer\'s popup: "Restore Balance … the first d20 (9) stands"; Cutting Words (margin 8) not listed — the quiet road is gone',
        !!pop && /Restore Balance/.test(textOf(pop?.element)) && /first d20 \(9\)/.test(textOf(pop?.element))
          && !guards.some(g => g.uuid === bard.uuid) && guards.some(g => (g.uuid === sorcerer.uuid) && !g.passed),
        `pop=${textOf(pop?.element).slice(0, 160)} guards=${JSON.stringify(guards.map(g => [g.name, g.row, g.passed]))}`);
      pickApply(pop);
      const t = await resolvedTarget(msg);
      ok('4b. the first d20 stands: a MISS, rescue Restore Balance, a use spent',
        (t?.verdict === 'miss') && (t?.rescue === 'Restore Balance') && (t?.bent?.how === 'neutralised') && (t?.bent?.stood === 9)
          && (Number(sorcerer.items.get(balance.id)?.system?.uses?.spent) === 1),
        JSON.stringify({ verdict: t?.verdict, rescue: t?.rescue, bent: t?.bent, spent: sorcerer.items.get(balance.id)?.system?.uses?.spent }));
    });

    // ---- 9. Restore Balance on a Disadvantage miss
    if (want(9) && missSide) await section(9, async () => {
      await closeDialogs(); await refillDivinity();
      await balance.update({ 'system.uses.spent': 0 });
      const pcMod = await modOf(pcAttacker, pcWeapon);
      await victim.update({ 'system.attributes.ac.override': pcMod + 10 });
      const msg = await swingAt(pcAttacker, pcToken, pcWeapon, { d20: [18, 3], disadvantage: true });
      const rb = await until(() => popupTitled(/Restore Balance/), { timeout: 6000, label: 'the Sorcerer\'s Restore Balance popup' });
      const gs = popupTitled(/Guided Strike/);
      ok('9a. the Sorcerer\'s popup ("the first d20 (18) stands") beside the Cleric\'s', !!rb && /first d20 \(18\)/.test(textOf(rb?.element)) && !!gs,
        `rb=${textOf(rb?.element).slice(0, 200)} gs=${!!gs}`);
      pickApply(rb);
      const t = await missTarget(msg);
      // The answered hold closes the other bystander's popup.
      await until(() => !popupTitled(/Guided Strike/), { timeout: 6000, label: 'the Cleric\'s Guided Strike popup closed' });
      ok('9b. the 18 stands: a HIT, rescue Restore Balance; the Cleric\'s popup closed', (t?.verdict === 'hit') && (t?.rescue === 'Restore Balance')
        && (t?.bent?.stood === 18) && !popupTitled(/Guided Strike/),
        JSON.stringify({ verdict: t?.verdict, rescue: t?.rescue, bent: t?.bent, gs: !!popupTitled(/Guided Strike/) }));
    });

    // ---- 10. Restore Balance on a demanded save
    if (want(10)) await section(10, async () => {
      await closeDialogs(); await balance.update({ 'system.uses.spent': 0 });
      let flameId = attacker.items.find(i => (i.name === 'Sacred Flame') && (i.type === 'spell'))?.id;
      if (!flameId) {
        const src = await findPHB('Sacred Flame', 'spell');
        const data = src?.toObject();
        if (data) { data.system.prepared = 1; data.system.method = 'atwill'; const [it] = await attacker.createEmbeddedDocuments('Item', [data]); flameId = it.id; lentBy.set(attacker, [...(lentBy.get(attacker) ?? []), it.id]); }
      }
      const flameAct = attacker.items.get(flameId)?.system?.activities?.find(a => a.type === 'save');
      if (!flameAct) log.push('§10 skipped: no Sacred Flame save activity');
      else {
        await healFull();
        attackerToken.control({ releaseOthers: true });
        halflingToken.setTarget(true, { releaseOthers: true });
        const use = await flameAct.use({ consume: { spellSlot: false } }, { configure: false }, {});
        const card = use?.message ?? null;
        await until(() => card?.getFlag(MOD, 'saves'), { timeout: 6000, label: 'the Sacred Flame demand stamped' });
        const dc = Number(card?.getFlag(MOD, 'saves')?.dc);
        faces([[10, 20]]);
        const probeSave = await halfling.rollSavingThrow({ ability: 'dex' }, { configure: false }, { create: false });
        const smod = Number(probeSave?.[0]?.total) - 10;
        const hi = Math.min(20, Math.max(1, dc - smod + 2)), lo = Math.max(1, dc - smod - 6);
        // The demand rolls its damage after it stamps, from the same dice: it lands before they are rigged for the save.
        // Soft: the assertions read the save alone, and a demand that rolls nothing leaves nothing to wait for.
        await until(() => game.messages.contents.find(m => (m.type === 'damage') && ((m.system?.origin === card?.id) || (m._source?.system?.origin === card?.id))), { timeout: 6000 }).catch(() => null);
        faces([[hi, 20], [lo, 20]]);
        const rolls = await halfling.rollSavingThrow({ ability: 'dex', disadvantage: true }, { configure: false }, {});
        const rollMsg = rolls?.[0]?.parent ?? null;
        const pop = await until(() => rollPopup(/Restore Balance/), { timeout: 8000, label: 'the Sorcerer\'s Restore Balance popup on the save' });
        const entry0 = card?.getFlag(MOD, 'saves')?.targets?.find(x => x.uuid === halfling.uuid);
        ok('10a. the failed save is WITHHELD while the Sorcerer is asked: "Restore Balance — BTB Test Halfling\'s saving throw", the first d20 named',
          !!pop && new RegExp(`first d20 \\(${hi}\\)`).test(textOf(pop?.element)) && (rollFlag(rollMsg)?.status === 'pending') && !entry0?.done,
          `dc=${dc} mod=${smod} faces=${hi},${lo} pop=${textOf(pop?.element).slice(0, 200)} flag=${rollFlag(rollMsg)?.status} done=${entry0?.done}`);
        pickApply(pop);
        const entry = await until(() => { const e = card?.getFlag(MOD, 'saves')?.targets?.find(x => x.uuid === halfling.uuid); return e?.done ? e : null; }, { timeout: 10000, label: 'the Halfling\'s save folded after the answer' });
        await until(() => /Restore Balance \(BTB Test Sorcerer\)/.test(cardText(rollMsg?.id)), { timeout: 5000, label: 'the bent line on the save\'s card' });
        ok('10b. the first die stands: SAVED at the bent total; the roll\'s card names Restore Balance',
          (entry?.outcome === 'saved') && (entry?.total === hi + smod) && /Restore Balance \(BTB Test Sorcerer\)/.test(cardText(rollMsg?.id)),
          `entry=${JSON.stringify({ outcome: entry?.outcome, total: entry?.total })} card=${cardText(rollMsg?.id).slice(0, 200)}`);
      }
    });
    await KIT.leaveA3();

    // ---- 26. Tides of Chaos: the buy box (ADVANTAGE_BUYS)
    if (want(26)) await section(26, async () => {
      await closeA1();
      const native = pcAttacker.items.find(i => (i.type === 'feat') && (i.name === 'Tides of Chaos')) ?? null;
      const tides = native ?? await lend(pcAttacker, 'Tides of Chaos');
      const priorUses = { 'system.uses.spent': tides.system._source.uses?.spent ?? 0, 'system.uses.max': tides.system._source.uses?.max ?? '' };
      try {
        // UNSURE: the pack's Tides of Chaos carries uses max 1; a max that reads 0 on a non-sorcerer sheet hides the
        // box (buysFor demands max > 0) — set to 1 here when it does not read positive.
        if (!(Number(tides.system.uses?.max) > 0)) await tides.update({ 'system.uses.max': '1' });
        await tides.update({ 'system.uses.spent': 0 });
        const boxOf = dlg => [...(dlg?.element?.querySelectorAll('[data-bf-buy]') ?? [])].find(b => /Tides of Chaos/.test(textOf(b))) ?? null;
        const tickOf = dlg => dlg?.element?.querySelector('input[name="bf-buy"][data-bf-buy-name="Tides of Chaos"]') ?? null;
        const netOf = dlg => dlg?.element?.querySelector('[data-bf-reminder-head] [data-bf-mode]')?.dataset?.bfMode ?? null;
        // The box and the gate's head are drawn in the dialog's render, the gate first.
        const openDlg = async () => { const d = await until(rollDialog, { timeout: 6000, label: 'the roll dialog' }); await until(() => boxOf(d), { timeout: 3000, label: 'the Tides of Chaos buy box in the dialog' }); await gateDrawn(d); return d; };
        const left = () => Number(pcAttacker.items.get(tides.id)?.system?.uses?.value ?? -1);
        const maxN = Number(pcAttacker.items.get(tides.id)?.system?.uses?.max ?? 0);
        const FULL = new RegExp(`Tides of Chaos — 1 use · ${maxN} left`);
        // The attack: the box, closed unrolled (nothing targeted, nothing lands).
        if (!pcWeapon) log.push('§26a skipped: BTB Test PC Attacker has no weapon');
        else {
          pcToken.control({ releaseOthers: true }); clearTargets();
          const p = attackOf(pcAttacker, pcWeapon).rollAttack({}, {}, {});
          const d = await openDlg();
          ok('26a. an attack dialog: the box "Tides of Chaos — 1 use · 1 left" with an Advantage tick', FULL.test(textOf(boxOf(d))) && !!tickOf(d),
            `box="${textOf(boxOf(d)).slice(0, 90)}" tick=${!!tickOf(d)}`);
          try { await d?.close(); } catch { /* gone */ }
          await Promise.resolve(p).catch(() => {});
        }
        // The save: ticked, pressed Advantage — the use spent, the record names the buy.
        {
          const t1 = Date.now();
          void pcAttacker.rollSavingThrow({ ability: 'dex' });
          const d = await openDlg();
          const box = textOf(boxOf(d));
          const tick = tickOf(d);
          // The tick's change handler redraws the box and re-nets the head inside the dispatch.
          if (tick) { tick.checked = true; tick.dispatchEvent(new Event('change', { bubbles: true })); }
          const net = netOf(d);
          d?.element?.querySelector('button[data-action="advantage"]')?.click();
          const msg = await until(() => game.messages.contents.find(m => (m.timestamp >= t1) && (m.getFlag(MOD, 'poolSpend')?.ability === 'Tides of Chaos')) ?? null, { timeout: 8000, label: 'the save\'s card recording the Tides of Chaos spend' });
          // The record rides the card's creation; the use is spent on the item beside it.
          await until(() => left() < maxN, { timeout: 5000, label: 'the Tides of Chaos use spent' });
          const rec = msg?.getFlag(MOD, 'reminder');
          ok('26b. a save dialog: the box; ticked, the net Advantage; pressed, the save rolls at Advantage, the use spent, the record names Tides of Chaos',
            FULL.test(box) && (net === 'advantage') && (Number(msg?.rolls?.[0]?.options?.advantageMode) === 1) && (left() === maxN - 1)
              && (rec?.sources ?? []).some(s => (s.kind === 'buy') && /Tides of Chaos/.test(s.label)),
            `box="${box.slice(0, 80)}" net=${net} mode=${msg?.rolls?.[0]?.options?.advantageMode} left=${left()} rec=${JSON.stringify(rec?.sources ?? null)} spend=${JSON.stringify(msg?.getFlag(MOD, 'poolSpend') ?? null)}`);
        }
        // The check with none left: greyed, no tick.
        {
          await tides.update({ 'system.uses.spent': maxN });
          void pcAttacker.rollSkill({ skill: 'ath' });
          const d = await openDlg();
          ok('26c. a check dialog with no use left: the box greyed "no uses left", no tick', !!boxOf(d) && /no uses left/.test(textOf(boxOf(d))) && !tickOf(d),
            `box="${textOf(boxOf(d)).slice(0, 100)}" tick=${!!tickOf(d)}`);
          try { await d?.close(); } catch { /* gone */ }
        }
      } finally {
        await closeA1();
        clearTargets();
        if (native) await native.update(priorUses).catch(() => {});
        else await unlend(pcAttacker, tides);
      }
    });
    KIT.markA2();

    // ---- 39. Wild Magic Surge: the d20 after a Sorcerer slot cast; a 20 rolls the table; Tides of Chaos spent surges and comes back
    if (want(39)) await section(39, async () => {
      await closeA1();
      const sorcTok = canvas.tokens.placeables.find(t => t.actor?.id === sorcerer.id) ?? null;
      hgKeep(sorcerer, { 'system.spells': foundry.utils.deepClone(sorcerer.system._source.spells) });
      const wms = await hgLend(sorcerer, 'Wild Magic Surge', 'feat');
      const tides = await hgLend(sorcerer, 'Tides of Chaos', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 0 });
      const armor = await hgLend(sorcerer, 'Mage Armor', 'spell', { 'system.prepared': 1, 'system.method': 'spell', 'system.sourceItem': 'class:sorcerer' });
      const tables = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag('core', 'RollTable'));
      let combat = null;
      try {
        if (!wms || !tides || !armor || !sorcTok) log.push(`§39 skipped: wms=${!!wms} tides=${!!tides} armor=${!!armor} token=${!!sorcTok}`);
        else {
          await sorcerer.update({ 'system.spells.spell1.value': 4, 'system.spells.spell2.value': 3 });
          // a. a 14: nothing
          faces([[14, 20]]);
          const c1 = await castSpell(sorcerer, sorcTok, armor, 1);
          ok('39a. a Sorcerer slot cast rolls the d20: "Wild Magic Surge — d20: 14, nothing"', /Wild Magic Surge — d20: 14, nothing/.test(await surgeLineOf(c1)), `line="${await surgeLineOf(c1)}"`);
          // b. a 20: the table rolls and posts
          const t0 = tables().length;
          faces([[20, 20], [1, 100]]);
          const c2 = await castSpell(sorcerer, sorcTok, armor, 1);
          const l2 = await surgeLineOf(c2);
          unrig();
          ok('39b. a 20: "d20: 20, a SURGE — …" and the table\'s card posts', /d20: 20, a SURGE/.test(l2) && (tables().length === t0 + 1), `line="${l2}" tables=${tables().length - t0}`);
          // c. Tides of Chaos spent: no d20, the table rolls, Tides comes back
          await tides.update({ 'system.uses.spent': 1 });
          const c3 = await castSpell(sorcerer, sorcTok, armor, 1);
          const l3 = await surgeLineOf(c3);
          ok('39c. Tides of Chaos spent: "Tides of Chaos spent: the surge rolls … Tides of Chaos regained", Tides 1 of 1',
            /Tides of Chaos spent: the surge rolls/.test(l3) && /Tides of Chaos regained/.test(l3) && (Number(sorcerer.items.get(tides.id)?.system?.uses?.spent) === 0),
            `line="${l3}" spent=${sorcerer.items.get(tides.id)?.system?.uses?.spent}`);
          // d. not a Sorcerer spell: nothing
          await armor.update({ 'system.sourceItem': 'class:wizard' });
          faces([[14, 20]]);
          const c4 = await castSpell(sorcerer, sorcTok, armor, 1);
          // The window: a Wizard spell rolls no surge.
          const surged4 = await watch(() => cardEl(c4?.id)?.querySelector('.bf-surge-line') || c4?.getFlag(MOD, 'castRider'), { ms: 1500 });
          ok('39d. a Wizard spell rolls nothing', !surged4 && !cardEl(c4?.id)?.querySelector('.bf-surge-line') && !c4?.getFlag(MOD, 'castRider'), `line="${await surgeLineOf(c4)}"`);
          await armor.update({ 'system.sourceItem': 'class:sorcerer' });
          // e. once per turn in a combat
          await sorcerer.update({ 'system.spells.spell1.value': 4 });   // a–d spent the level-1 slots
          [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          created.combats.push(combat.id);
          await combat.createEmbeddedDocuments('Combatant', [{ tokenId: sorcTok.document.id, sceneId: scene.id, actorId: sorcerer.id, initiative: 20 }]);
          await combat.startCombat();
          faces([[5, 20], [6, 20]]);
          const c5 = await castSpell(sorcerer, sorcTok, armor, 1);
          const c6 = await castSpell(sorcerer, sorcTok, armor, 1);
          // The window: the second cast in the same turn rolls no surge.
          const surged6 = await watch(() => c6?.getFlag(MOD, 'castRider'), { ms: 1500 });
          ok('39e. in a combat, once per turn: the first cast rolls, the second in the same turn rolls nothing',
            /d20: 5/.test(await surgeLineOf(c5)) && !surged6 && !c6?.getFlag(MOD, 'castRider'), `first="${await surgeLineOf(c5)}" second=${JSON.stringify(c6?.getFlag(MOD, 'castRider') ?? null)}`);
        }
      } finally {
        await closeA1();
        if (combat && game.combats.get(combat.id)) await combat.delete();
        for (const it of [wms, tides, armor]) if (it) await unlend(sorcerer, it);
        unrig();
        clearTargets();
      }
    });

    // ---- 51. Bend Luck: −1d4 on a foe's hit, +1d4 on a friend's miss, a Sorcery Point each
    if (want(51)) await section(51, async () => {
      await closeA1(); await spendLuck();
      const ownFont = sorcerer.items.find(i => (i.name === 'Font of Magic') && (Number(i.system?.uses?.max) > 0)) ?? null;
      const font = ownFont ?? await hgLend(sorcerer, 'Font of Magic', 'feat', { 'system.uses.max': '5', 'system.uses.spent': 0 });
      const fontSpentBefore = Number(font?.system?.uses?.spent ?? 0);
      if (font) await font.update({ 'system.uses.spent': 0 });
      const bend = await hgLend(sorcerer, 'Bend Luck', 'feat');
      const points = () => Number(sorcerer.items.get(font?.id)?.system?.uses?.value ?? NaN);
      const fontMax = () => Number(sorcerer.items.get(font?.id)?.system?.uses?.max ?? NaN);
      try {
        if (!font || !bend) log.push(`§51 skipped: font=${!!font} bend=${!!bend}`);
        else {
          await dropReactionChips(sorcerer);
          // a. a foe's hit on the Halfling by 2: the sorcerer's popup "−1d4"
          const msg = await swing({ d20: [12] });
          const pop = await until(() => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-bystander"]') && /Bend Luck/.test(textOf(app.element))) ?? null, { timeout: 8000, label: 'the Sorcerer\'s Bend Luck popup on the hit' });
          const guard = holdOf(msg)?.targets?.[0]?.guards?.find(g => g.row === 'Bend Luck') ?? null;
          ok('51a. the Attacker hits the Halfling by 2: the sorcerer\'s popup "Bend Luck — −1d4", the guard\'s sign −1',
            !!pop && /−1d4/.test(textOf(pop?.element)) && (guard?.sign === -1) && !guard?.quiet, `pop=${!!pop} text="${textOf(pop?.element).slice(0, 160)}" guard=${JSON.stringify(guard && { sign: guard.sign, die: guard.die, quiet: guard.quiet })}`);
          faces([[3, 4]]);
          pickApply(pop);
          const t = await resolvedTarget(msg);
          unrig();
          await until(() => points() < fontMax(), { timeout: 5000, label: 'the Sorcery Point spent with the answer' });
          ok('51b. Answer: the d4 (3) off the attack — a MISS, a Sorcery Point spent (Font of Magic one down)',
            (t?.verdict === 'miss') && (t?.bent?.add === -3) && (t?.rescue === 'Bend Luck') && (points() === fontMax() - 1),
            `verdict=${t?.verdict} bent=${JSON.stringify(t?.bent)} points=${points()}`);
          await dropReactionChips(sorcerer);
          // b. a friend's miss (the PC Attacker at the Victim by 3): "+1d4"
          await a1Victim();
          await victim.update({ 'system.attributes.ac.override': (await modOf(pcAttacker, pcWeapon)) + 13 });
          const miss = await swingAt(pcAttacker, pcToken, pcWeapon, { d20: [10] });
          const pop2 = await until(() => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-bystander"]') && /Bend Luck/.test(textOf(app.element))) ?? null, { timeout: 8000, label: 'the Sorcerer\'s Bend Luck popup on the miss' });
          const guard2 = holdOf(miss)?.targets?.[0]?.guards?.find(g => g.row === 'Bend Luck') ?? null;
          ok('51c. the PC Attacker misses the Victim by 3: the sorcerer\'s popup "Bend Luck — +1d4", the guard\'s sign +1',
            !!pop2 && /\+1d4/.test(textOf(pop2?.element)) && (guard2?.sign === 1), `pop=${!!pop2} text="${textOf(pop2?.element).slice(0, 160)}" guard=${JSON.stringify(guard2 && { sign: guard2.sign })} hold=${!!holdOf(miss)}`);
          faces([[4, 4]]);
          pickApply(pop2);
          const h2 = await until(() => (holdOf(miss)?.status === 'resolved') ? holdOf(miss) : null, { timeout: 12000, label: 'the miss\'s hold resolved' });
          const t2 = h2?.targets?.find(x => x.uuid === victim.uuid) ?? null;
          unrig();
          await until(() => points() < fontMax() - 1, { timeout: 5000, label: 'the second Sorcery Point spent with the answer' });
          ok('51d. Answer: +4 — a HIT, another point (two down)', (t2?.verdict === 'hit') && (t2?.bent?.add === 4) && (points() === fontMax() - 2),
            `verdict=${t2?.verdict} bent=${JSON.stringify(t2?.bent)} points=${points()}`);
        }
      } finally {
        await closeA1(); await closeOffers();
        if (bend) await unlend(sorcerer, bend);
        if (font && !ownFont) await unlend(sorcerer, font);
        else if (font) await font.update({ 'system.uses.spent': fontSpentBefore }).catch(() => {});
        await dropReactionChips(sorcerer);
        unrig(); clearTargets(); await healFull();
      }
    });

    // ---- 61. Bastion of Law (the ward pool on the warded creature's effect) and Projected Ward (the wizard's ward absorbs an ally's damage)
    if (want(61)) await section(61, async () => {
      await closeDialogs(); await spendLuck(); await dropReactionChips(sorcerer);
      const ownFont61 = sorcerer.items.find(i => (i.name === 'Font of Magic') && (Number(i.system?.uses?.max) > 0)) ?? null;
      const font = ownFont61 ?? await hgLend(sorcerer, 'Font of Magic', 'feat', { 'system.uses.max': '5', 'system.uses.spent': 0 });
      const fontSpent61 = Number(font?.system?.uses?.spent ?? 0);
      if (font) await font.update({ 'system.uses.spent': 0 });
      const bastion = await hgLend(sorcerer, 'Bastion of Law', 'feat');
      const arcane = await hgLend(sorcerer, 'Arcane Ward', 'feat', { 'system.uses.max': '12', 'system.uses.spent': 4 });
      let projected = null;   // lent for step d alone: its `any` guard would claim the Bastion hits
      const lawFx = () => halfling.effects.find(e => e.getFlag(MOD, 'wardPool')) ?? null;
      const arcaneLeft = () => Number(sorcerer.items.get(arcane?.id)?.system?.uses?.value ?? NaN);
      try {
        if (!font || !bastion || !arcane) log.push(`§61 skipped: font=${!!font} bastion=${!!bastion} arcane=${!!arcane}`);
        else {
          // a. Create Shield at the Halfling, 3 Sorcery Points (scaling 2): 3d8 pinned 4, 4, 4 → a 12-point ward on the Halfling
          const create = sorcerer.items.get(bastion.id).system.activities.find(a => a.name === 'Create Shield');
          const sorcTok = canvas.tokens.get(sorcererDoc.id);
          sorcTok?.control({ releaseOthers: true }); clearTargets(); halflingToken.setTarget(true, { releaseOthers: true });
          faces([[4, 8], [4, 8], [4, 8]]);
          await create.use({ scaling: 2, subsequentActions: false }, { configure: false }, {});
          const fx = await until(lawFx, { timeout: 8000, label: 'Warded by Law on the Halfling' });
          unrig(); clearTargets();
          ok('61a. Create Shield (3 points) at the Halfling: "Warded by Law (12)" on it, the pool 12 of 12',
            !!fx && (fx.name === 'Warded by Law (12)') && (fx.getFlag(MOD, 'wardPool')?.left === 12) && (fx.getFlag(MOD, 'wardPool')?.feature === 'Bastion of Law'),
            `fx=${fx?.name ?? null} pool=${JSON.stringify(fx?.getFlag(MOD, 'wardPool') ?? null)} font=${sorcerer.items.get(font.id)?.system?.uses?.value}`);
          // b. the Attacker hits the Halfling for 8: the ward takes it, HP untouched, the effect renamed (4)
          await halfling.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          const msg = await swing({ d20: [19], dmg: 4 });
          const dmg = await a1Damage(msg);
          // The take is written on the effect beside the damage's own update; a ward that took nothing leaves the HP lower.
          await until(() => (Number(lawFx()?.getFlag(MOD, 'wardPool')?.left ?? 0) < 12) || (hp() < 400), { timeout: 5000, label: 'the ward\'s take written on Warded by Law' });
          const took1 = Number(dmg?.getFlag(MOD, 'receipt')?.targets?.find(x => x.uuid === halfling.uuid)?.ward?.took ?? NaN);
          ok('61b. a hit: the ward takes it all — the Halfling\'s HP untouched, "Warded by Law (12 − took)" left, the receipt says what it took',
            (hp() === 400) && (took1 > 0) && (lawFx()?.name === `Warded by Law (${12 - took1})`) && (lawFx()?.getFlag(MOD, 'wardPool')?.left === 12 - took1),
            `hp=${hp()} took=${took1} fx=${lawFx()?.name ?? null} receipt=${JSON.stringify(dmg?.getFlag(MOD, 'receipt')?.targets?.map(x => [x.name, x.taken, x.ward ?? null]) ?? null)}`);
          // c. a bigger hit: the rest of the ward goes, the remainder lands, the effect gone
          const msg2 = await swing({ d20: [19], dmg: 6 });
          // The receipt is written after the Hit Points: the HP read below are the landed ones.
          const dmg2 = await a1Damage(msg2);
          await until(() => !lawFx(), { timeout: 6000, label: 'Warded by Law gone with its last hit points' });
          const took2 = Number(dmg2?.getFlag(MOD, 'receipt')?.targets?.find(x => x.uuid === halfling.uuid)?.ward?.took ?? NaN);
          const total2 = (dmg2?.rolls ?? []).reduce((n, r) => n + (Number(r.total) || 0), 0);
          ok('61c. a second hit: the last of the ward absorbed, the rest lands, the effect gone',
            !lawFx() && (took2 === 12 - took1) && (hp() === 400 - Math.max(0, total2 - took2)), `hp=${hp()} took=${took2} total=${total2} fx=${lawFx()?.name ?? null}`);
          // d. Projected Ward: the sorcerer (Arcane Ward 8 of 12) absorbs the Halfling's next hit
          projected = await hgLend(sorcerer, 'Projected Ward', 'feat');
          await dropReactionChips(sorcerer); await healFull();
          const t3 = Date.now();
          const msg3 = await swing({ d20: [19], dmg: 4 });
          const pop = await until(() => popups().find(app => /Projected Ward/.test(textOf(app.element)) && app.element?.querySelector?.('button[data-action="cast"]')) ?? null, { timeout: 8000, label: 'the Projected Ward popup' });
          ok('61d. the Halfling hit with the sorcerer within 30 ft: the guard popup "Projected Ward … within 30 ft of you · a Reaction", the button Absorb',
            !!pop && /within 30 ft of you/.test(textOf(pop?.element)) && (textOf(pop?.element?.querySelector('button[data-action="cast"]')) === 'Absorb'),
            `pop=${!!pop} text="${textOf(pop?.element).slice(0, 220)}"`);
          pop?.element?.querySelector('button[data-action="cast"]')?.click();
          const held = await until(() => { const m = game.messages.contents.find(x => (x.timestamp >= t3) && (x.getFlag(MOD, 'damageHold')?.status === 'resolved')); return m?.getFlag(MOD, 'damageHold') ?? null; }, { timeout: 12000, label: 'the damage hold resolved by Absorb' });
          // The ward is spent before the hold resolves; the reduced damage lands after it, then the hold is marked applied.
          await until(() => game.messages.contents.some(x => (x.timestamp >= t3) && x.getFlag(MOD, 'damageHold')?.applied), { timeout: 10000, label: 'the held damage landed' });
          const took = Number(held?.reduceBy);
          ok('61e. Absorb: the whole share taken by the Arcane Ward (8 down by it), nothing lands on the Halfling',
            (held?.answer === 'cast') && (took >= 1) && (arcaneLeft() === 8 - took) && (hp() === 400) && !!msg3,
            `hold=${JSON.stringify(held && { answer: held.answer, reduceBy: held.reduceBy })} arcane=${arcaneLeft()} hp=${hp()}`);
        }
      } finally {
        await closeA1(); await closeOffers();
        { const ids = halfling.effects.filter(e => e.name.startsWith('Warded by Law')).map(e => e.id); if (ids.length) await halfling.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {}); }   // every pool, not the first
        for (const it of [bastion, arcane, projected]) if (it) await unlend(sorcerer, it);
        if (font && !ownFont61) await unlend(sorcerer, font);
        else if (font) await font.update({ 'system.uses.spent': fontSpent61 }).catch(() => {});
        await dropReactionChips(sorcerer);
        unrig(); clearTargets(); await healFull();
      }
    });

    // ---- 75. Trance of Order: no Advantage against the sorcerer; its own d20 floor
    if (want(75)) await section(75, async () => {
      await closeA1();
      const trance = await hgLend(sorcerer, 'Trance of Order', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 0 });
      const reckless = await markOn(attacker, 'Reckless', null);
      const sTok = sorcTokC();
      try {
        if (!trance || !sTok) log.push(`§75 skipped: trance=${!!trance} token=${!!sTok}`);
        else {
          await useFeature(sTok, trance, 'Enter Trance (Free)');
          const fx = await until(() => fxNamed(sorcerer, ['Trance of Order'])[0] ?? null, { timeout: 6000, label: 'Trance of Order on the Sorcerer' });
          const gate = await gateFor(attackerToken, act(), sTok);
          ok('75a. the Reckless Attacker\'s gate at the sorcerer in its Trance: "attack rolls against it cannot have Advantage", Reckless cancelled, net Normal',
            !!fx && gate.open && /cannot have Advantage/.test(gate.text) && /cancelled \(Trance of Order\)/.test(gate.text) && (gate.net === 'normal'),
            `fx=${!!fx} net=${gate.net} text="${gate.text.slice(0, 260)}"`);
          await closeA1();
          faces([[10, 20]]);
          const probe = await sorcerer.rollSavingThrow({ ability: 'wis' }, { configure: false }, { create: false });
          const mod = Number(probe?.[0]?.total) - 10;
          faces([[3, 20]]);
          const rolls = await sorcerer.rollSavingThrow({ ability: 'wis' }, { configure: false }, {});
          unrig();
          const r0 = rolls?.[0];
          const line = (await until(() => [...(cardEl(r0?.parent?.id)?.querySelectorAll?.('div') ?? [])].find(el => /counts as 10/.test(el.textContent ?? '')), { timeout: 5000, label: 'the Trance of Order floor line on the save\'s card' }))?.textContent?.trim() ?? '';
          ok('75b. the sorcerer\'s own save with a 3 on the d20: the total counts it as 10 (the floor), the card "Trance of Order — the d20\'s 3 counts as 10"',
            (Number(r0?.total) === 10 + mod) && /the d20's 3 counts as 10/.test(line), `total=${r0?.total} mod=${mod} minimum=${r0?.options?.minimum} line="${line}"`);
        }
      } finally {
        await closeA1();
        await dropFx(sorcerer, ['Trance of Order']);
        if (reckless) await reckless.delete().catch(() => {});
        if (trance) await unlend(sorcerer, trance);
        unrig(); clearTargets();
      }
    });

    // ---- 76. Controlled Chaos: the table twice, the pick
    if (want(76)) await section(76, async () => {
      await closeA1();
      const sTok = sorcTokC();
      hgKeep(sorcerer, { 'system.spells': foundry.utils.deepClone(sorcerer.system._source.spells) });
      const wms = await hgLend(sorcerer, 'Wild Magic Surge', 'feat');
      const tides = await hgLend(sorcerer, 'Tides of Chaos', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 1 });
      const chaos = await hgLend(sorcerer, 'Controlled Chaos', 'feat');
      const armor = await hgLend(sorcerer, 'Mage Armor', 'spell', { 'system.prepared': 1, 'system.method': 'spell', 'system.sourceItem': 'class:sorcerer' });
      try {
        if (!wms || !tides || !chaos || !armor || !sTok) log.push(`§76 skipped: wms=${!!wms} tides=${!!tides} chaos=${!!chaos} armor=${!!armor} token=${!!sTok}`);
        else {
          await sorcerer.update({ 'system.spells.spell1.value': 4 });
          const tables0 = game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag('core', 'RollTable')).length;
          const c1 = await castSpell(sorcerer, sTok, armor, 1);
          const line = await surgeLineOf(c1);
          const rec = await until(() => (c1?.getFlag(MOD, 'castRider')?.results?.length === 2) ? c1.getFlag(MOD, 'castRider') : null, { timeout: 8000, label: 'the surge\'s two table results on the cast card' });
          const buttons = [...(cardEl(c1?.id)?.querorAll?.('.bf-surge-line button') ?? cardEl(c1?.id)?.querySelectorAll?.('.bf-surge-line button') ?? [])].map(b => textOf(b));
          const tables = game.messages.contents.filter(m => (m.timestamp >= suiteStart) && m.getFlag('core', 'RollTable')).length;
          ok('76a. Tides spent, the surge rolls the table TWICE (two table cards), the line "Controlled Chaos — pick one:" with a button each',
            !!rec && (tables - tables0 === 2) && /Controlled Chaos — pick one/.test(cardText(c1?.id)) && (buttons.length === 2),
            `line="${line}" results=${JSON.stringify(rec?.results ?? null)} tables=${tables - tables0} buttons=${JSON.stringify(buttons)}`);
          cardEl(c1?.id)?.querySelector('.bf-surge-line button')?.click();
          const chosen = await until(() => c1?.getFlag(MOD, 'castRider')?.chosen ?? null, { timeout: 6000, label: 'the Controlled Chaos pick recorded' });
          // The card redraws after the record: the line says the pick, the buttons gone with the redraw.
          await until(() => /Controlled Chaos — chosen:/.test(cardText(c1?.id)), { timeout: 5000, label: 'the chosen line on the cast card' });
          ok('76b. the pick recorded: "Controlled Chaos — chosen: …", the buttons gone', !!chosen && (chosen === rec?.results?.[0]) && /Controlled Chaos — chosen:/.test(cardText(c1?.id)) && !cardEl(c1?.id)?.querySelector('.bf-surge-line button'),
            `chosen="${chosen}" card="${cardText(c1?.id).slice(-200)}"`);
        }
      } finally {
        await closeA1();
        for (const it of [wms, tides, chaos, armor]) if (it) await unlend(sorcerer, it);
        unrig(); clearTargets();
      }
    });

    // ---- 100. Tamed Surge: a pick from the surge table instead of a roll, once per Long Rest
    if (want(100)) await section(100, async () => {
      await closeA1();
      const sTok = sorcTokC();
      hgKeep(sorcerer, { 'system.spells': foundry.utils.deepClone(sorcerer.system._source.spells) });
      const wms = await hgLend(sorcerer, 'Wild Magic Surge', 'feat');
      const tamed = await hgLend(sorcerer, 'Tamed Surge', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 0 });
      const armor = await hgLend(sorcerer, 'Mage Armor', 'spell', { 'system.prepared': 1, 'system.method': 'spell', 'system.sourceItem': 'class:sorcerer' });
      try {
        if (!wms || !tamed || !armor || !sTok) log.push(`§100 skipped: wms=${!!wms} tamed=${!!tamed} armor=${!!armor} token=${!!sTok}`);
        else {
          await sorcerer.update({ 'system.spells.spell1.value': 4 });
          faces([[5, 20]]);
          const c1 = await castSpell(sorcerer, sTok, armor, 1);
          unrig();
          const rec = await until(() => c1?.getFlag(MOD, 'castRider')?.tamed ?? null, { timeout: 8000, label: 'the Tamed Surge offer on the cast card' });
          const select = await until(() => cardEl(c1?.id)?.querySelector('select[data-bf-tamed-surge]'), { timeout: 6000, label: 'the Tamed Surge select drawn on the card' });
          const table = await fromUuid('Compendium.dnd-players-handbook.tables.RollTable.phbWildMagicSurg');
          ok('100a. a Sorcerer slot cast: the surge line offers "Tamed Surge — choose an effect instead (1 use)" with every table row but the last',
            !!rec && !!select && (rec.options.length === (table?.results?.size ?? 0) - 1) && /Tamed Surge — choose an effect instead/.test(cardText(c1?.id)),
            `options=${rec?.options?.length} table=${table?.results?.size} select=${!!select}`);
          const want3 = rec?.options?.[3];
          if (select) { select.value = want3; select.dispatchEvent(new Event('change', { bubbles: true })); }
          [...(cardEl(c1?.id)?.querySelectorAll('.bf-surge-line button') ?? [])].find(b => /Choose/.test(textOf(b)))?.click();
          const chosen = await until(() => c1?.getFlag(MOD, 'castRider')?.tamed?.chosen ?? null, { timeout: 6000, label: 'the Tamed Surge pick recorded' });
          // The pick is recorded first, then the feature's use spent; the card's line redraws after the record.
          await until(() => /Tamed Surge — chosen:/.test(cardText(c1?.id)) && (Number(sorcerer.items.get(tamed.id)?.system?.uses?.spent) > 0),
            { timeout: 5000, label: 'the chosen line drawn and the Tamed Surge use spent' });
          ok('100b. chosen: the record holds the pick, the line says it, the feature\'s use spent',
            (chosen === want3) && /Tamed Surge — chosen:/.test(cardText(c1?.id)) && (Number(sorcerer.items.get(tamed.id)?.system?.uses?.spent) === 1),
            `chosen="${chosen}" want="${want3}" spent=${sorcerer.items.get(tamed.id)?.system?.uses?.spent}`);
        }
      } finally {
        await closeA1();
        for (const it of [wms, tamed, armor]) if (it) await unlend(sorcerer, it);
        unrig(); clearTargets();
      }
    });
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  }
} });

await finish({ tag: 'class-sorcerer', out, plan, f });
