// Classes smoke suite — Rogue: the PHB classes plan's rows (audits/plans/session-0-classes.md) for
// the Rogue, each section keeping its number and title. The fixtures, the lends, the
// helpers and the teardown are the classes kit's (tools/class-kit.mjs); everything written is restored.
import { announcePlan, connectSuite, finish, sectionPlan } from './harness.mjs';
import { runClassSuite } from './class-kit.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'advantage-buys.js',      // Versatile Trickster's free box (§74)
  'reminders.js',           // Elusive in the gate (§96)
  'd20-folds.js'            // Stroke of Luck (§98)
];

const SECTIONS = {
  74: 'Versatile Trickster (C1, the PC Attacker): after a Trip this turn the attack dialog offers the free box; taken back, none',
  96: "Elusive (D1, the Sorcerer): the Reckless Attacker's gate cancels the Advantage; Incapacitated, Elusive is off",
  98: "Stroke of Luck and Living Legend (D1): a failed save turned into a 20; the legend's save reroll (a Reaction); Unerring Strike makes a weapon miss hit; Stroke of Luck on a weapon miss is a Critical Hit (the rule of cool)"
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'class-rogue', watchdogMs: 900_000 });
announcePlan('class-rogue', plan, pulled);

const out = await runClassSuite(f, { plan, sections: SECTIONS, body: async ({ sections, titles }) => {
  const { until, watch, faces, unrig } = window.__btb;
  const { results, skips, ok, want, section } = window.__btb.begin({ sections, titles });
  const KIT = window.__btbClasses;
  const { MOD, OFFER, a1Victim, act, attackOf, attacker, attackerToken, clearTargets, closeA1, closeOffers, dropEffects, gateFor, halfling, hgLend, log, markOn, pcAttacker, pcToken, pcWeapon, popups, riderChits, rollDialog, sorcTokC, sorcerer, spendLuckC, swingAt, textOf, unlend, victim, victimPrior, victimToken } = KIT;
  // A forced hit's damage: rolled at once, or a damage offer standing for closeOffers to roll (d20-folds.js rollDamageForAttack).
  const damageOrOffer = (attackMsg, before = new Set()) => game.messages.contents.some(m => (m.type === 'damage') && !before.has(m.id) && (m.getFlag(MOD, 'attackFor') === attackMsg?.id))
    || popups().some(app => (app.element?.innerHTML ?? '').includes(OFFER));
  try {
    await KIT.leaveA3();
    KIT.markA2();

    // ---- 74. Versatile Trickster: the free box after a Trip this turn
    if (want(74)) await section(74, async () => {
      await closeA1(); await a1Victim();
      const vt = await hgLend(pcAttacker, 'Versatile Trickster', 'feat');
      try {
        if (!vt || !pcWeapon) log.push(`§74 skipped: trickster=${!!vt} weapon=${!!pcWeapon}`);
        else {
          const m = await swingAt(pcAttacker, pcToken, pcWeapon, { d20: [19] });
          // the Trip is read off this turn's attack cards as the dialog is configured (advantage-buys.js cunningStrikeThisTurn)
          await m?.setFlag(MOD, 'sneak', { armed: true, cunning: ['trip'], rolled: true });
          const p = attackOf(pcAttacker, pcWeapon).rollAttack({}, {}, {});
          pcToken.control({ releaseOthers: true }); victimToken.setTarget(true, { releaseOthers: true });
          const dlg = await until(rollDialog, { timeout: 6000, label: 'the attack dialog' });
          // the buy box is drawn into the dialog on its render (advantage-buys.js drawBuy)
          await until(() => dlg.element?.querySelector('[data-bf-buy]'), { label: 'the buy box drawn in the attack dialog' });
          const boxText = textOf(dlg?.element?.querySelector('[data-bf-buy]'));
          const box = dlg?.element?.querySelector('input[name="bf-buy"][data-bf-free]');
          ok('74a. after a Trip this turn: the attack dialog\'s box "Versatile Trickster — free · the Mage Hand within 5 feet of the target — the table\'s", tickable',
            !!dlg && /Versatile Trickster — free/.test(boxText) && /Mage Hand/.test(boxText) && !!box, `dlg=${!!dlg} box="${boxText.slice(0, 160)}" input=${!!box}`);
          // the box's change handler arms the buy and redraws the net inside the dispatch (advantage-buys.js drawBuy)
          if (box) { box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })); }
          dlg?.element?.querySelector('button[data-action="advantage"]')?.click();
          const rolls = await Promise.resolve(p).catch(() => null);
          const rec = rolls?.[0]?.parent?.getFlag(MOD, 'reminder');
          ok('74b. ticked and rolled with Advantage: the record lists "Versatile Trickster" as a buy source, nothing spent', !!rec && (rec.sources ?? []).some(s => (s.kind === 'buy') && /Versatile Trickster/.test(s.label)) && (rec.net === 'advantage'),
            `record=${JSON.stringify(rec && { net: rec.net, sources: rec.sources?.map(s => [s.kind, s.label]) })}`);
          await closeA1();
          await unlend(pcAttacker, vt);
          const p2 = attackOf(pcAttacker, pcWeapon).rollAttack({}, {}, {});
          // soft: the ok asserts no box, and reports the dialog's absence in its detail
          const dlg2 = await until(rollDialog, { timeout: 6000, label: 'the second attack dialog' }).catch(() => null);
          // A window: no free box drawn once the feature is taken back.
          const stray = await watch(() => dlg2?.element?.querySelector('input[name="bf-buy"][data-bf-free]'), { ms: 400 });
          ok('74c. taken back: no box', !stray && !dlg2?.element?.querySelector('input[name="bf-buy"][data-bf-free]'), `dlg=${!!dlg2} stray=${!!stray}`);
          try { await dlg2?.close(); } catch { /* gone */ }
          await Promise.resolve(p2).catch(() => {});
        }
      } finally {
        await closeA1();
        if (vt && pcAttacker.items.get(vt.id)) await unlend(pcAttacker, vt);
        unrig(); clearTargets();
      }
    });

    // ---- 96. Elusive: no attack roll against the rogue has Advantage, unless it is Incapacitated
    if (want(96)) await section(96, async () => {
      await closeA1();
      const elusive = await hgLend(sorcerer, 'Elusive', 'feat');
      const reckless = await markOn(attacker, 'Reckless', null);
      const sTok = sorcTokC();
      let incap = null;
      try {
        if (!elusive || !sTok) log.push(`§96 skipped: elusive=${!!elusive} token=${!!sTok}`);
        else {
          const gate = await gateFor(attackerToken, act(), sTok);
          ok('96a. the Reckless Attacker at the Elusive sorcerer: "has Elusive — attack rolls against it cannot have Advantage", Reckless cancelled, net Normal',
            gate.open && /has Elusive — attack rolls against it cannot have Advantage/.test(gate.text) && /cancelled \(Elusive\)/.test(gate.text) && (gate.net === 'normal'),
            `net=${gate.net} text="${gate.text.slice(0, 260)}"`);
          incap = await markOn(sorcerer, 'Incapacitated (test)', null, ['incapacitated']);
          // the gate reads the target's statuses (reminders.js)
          await until(() => sorcerer.statuses?.has?.('incapacitated'), { label: 'the sorcerer Incapacitated' });
          const gate2 = await gateFor(attackerToken, act(), sTok);
          ok('96b. the sorcerer Incapacitated: Elusive is off — no cancel line', gate2.open && !/Elusive/.test(gate2.text), `net=${gate2.net} text="${gate2.text.slice(0, 200)}"`);
        }
      } finally {
        await closeA1();
        if (incap) await incap.delete().catch(() => {});
        if (reckless) await reckless.delete().catch(() => {});
        if (elusive) await unlend(sorcerer, elusive);
        unrig(); clearTargets();
      }
    });

    // ---- 98. Stroke of Luck (a failed D20 Test becomes a 20) and Living Legend (the save reroll; Unerring Strike's miss made a hit)
    if (want(98)) await section(98, async () => {
      await closeA1(); await spendLuckC();
      const stroke = await hgLend(halfling, 'Stroke of Luck', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 0 });
      let legend = null, legendFx = null, pcLegend = null, pcLegendFx = null;
      const passAll = () => [...document.querySelectorAll('.application')].filter(el => (el.tagName === 'DIALOG') && (!!el.querySelector('button[data-action="pass"]') || !!el.querySelector('input[value="pass"]'))).forEach(el => { const r = el.querySelector('input[value="pass"]'); if (r) { r.checked = true; el.querySelector('button[data-action="answer"]')?.click(); } else el.querySelector('button[data-action="pass"]')?.click(); });
      try {
        if (!stroke) log.push('§98 skipped: no Stroke of Luck');
        else {
          // a. Stroke of Luck on a failed save from the sheet
          const prior = new Set([...document.querySelectorAll('.application')].map(el => el.id));
          faces([[3, 20]]);
          const rolls = await halfling.rollSavingThrow({ ability: 'wis' }, { configure: false }, {});
          unrig();
          const m = rolls?.[0]?.parent ?? null;
          const base = Number(rolls?.[0]?.total);
          const flag = await until(() => m?.getFlag(MOD, 'd20fold') ?? null, { timeout: 5000, label: 'the failed save\'s fold offer' });
          const offer = (flag?.offers ?? []).find(o => o.label === 'Stroke of Luck') ?? null;
          ok('98a. a failed save offers "Stroke of Luck — turn the d20 into a 20" (the `succeed` kind, 1 use)', !!offer && (offer.kind === 'succeed') && /into a 20/.test(String(offer.says ?? '')),
            `offers=${JSON.stringify((flag?.offers ?? []).map(o => [o.kind, o.label, o.says]))}`);
          const win = await until(() => [...document.querySelectorAll('.application')].find(el => (el.tagName === 'DIALOG') && !prior.has(el.id) && !!el.querySelector('[data-bf-rescue-action="succeed"]')) ?? null, { timeout: 8000, label: 'the Stroke of Luck rescue window' });
          win?.querySelector('[data-bf-rescue-action="succeed"]')?.click();
          // the use is spent before the spend is recorded on the fold (d20-folds.js)
          const done = await until(() => { const cur = m?.getFlag(MOD, 'd20fold'); return (cur?.spends?.length && !cur.spends.some(sp => sp.pendingVerdict)) ? cur : null; }, { timeout: 15000, label: 'the Stroke of Luck spend folded' });
          ok('98b. pressed: the d20 counts as a 20 — the folded total is the base − 3 + 20, the use spent',
            (Number(done?.spends?.[0]?.twenty?.total) === base - 3 + 20) && (Number(done?.foldedTotal) === base - 3 + 20) && (Number(halfling.items.get(stroke.id)?.system?.uses?.spent) === 1),
            `base=${base} spends=${JSON.stringify(done?.spends ?? null)} folded=${done?.foldedTotal} spent=${halfling.items.get(stroke.id)?.system?.uses?.spent}`);
          passAll(); await closeA1();
          await unlend(halfling, stroke);
          // c. Living Legend's save reroll — a Reaction, while the legend stands
          legend = await hgLend(halfling, 'Living Legend', 'feat');
          legendFx = await markOn(halfling, 'Living Legend: Charismatic', legend?.uuid ?? null);
          const prior2 = new Set([...document.querySelectorAll('.application')].map(el => el.id));
          faces([[3, 20]]);
          const rolls2 = await halfling.rollSavingThrow({ ability: 'wis' }, { configure: false }, {});
          const m2 = rolls2?.[0]?.parent ?? null;
          const base2 = Number(rolls2?.[0]?.total);
          const flag2 = await until(() => m2?.getFlag(MOD, 'd20fold') ?? null, { timeout: 5000, label: 'the second failed save\'s fold offer' });
          const re = (flag2?.offers ?? []).find(o => (o.kind === 'reroll') && (o.label === 'Living Legend')) ?? null;
          ok('98c. Living Legend standing: a failed save offers its reroll — "your Reaction, the new roll stands"', !!re && /Reaction/.test(String(re.cost ?? '')),
            `offers=${JSON.stringify((flag2?.offers ?? []).map(o => [o.kind, o.label, o.cost]))}`);
          const pop2 = await until(() => [...document.querySelectorAll('.application')].find(el => (el.tagName === 'DIALOG') && !prior2.has(el.id) && !!el.querySelector('[data-bf-rescue-action="reroll"]')) ?? null, { timeout: 8000, label: 'the Living Legend rescue window' });
          faces([[15, 20]]);
          pop2?.querySelector('[data-bf-rescue-action="reroll"]')?.click();
          const done2 = await until(() => { const cur = m2?.getFlag(MOD, 'd20fold'); return (cur?.spends?.length && !cur.spends.some(sp => sp.pendingVerdict)) ? cur : null; }, { timeout: 15000, label: 'the Living Legend reroll folded' });
          unrig();
          ok('98d. pressed: the save rerolled (15), the new roll standing', (done2?.spends?.[0]?.kind === 'reroll') && (Number(done2?.spends?.[0]?.reroll?.total) === 15 + (base2 - 3)),
            `base=${base2} spends=${JSON.stringify(done2?.spends ?? null)}`);
          passAll(); await closeA1();
          // e. Unerring Strike: the PC Attacker's weapon MISS hits instead, once per turn
          pcLegend = await hgLend(pcAttacker, 'Living Legend', 'feat');
          pcLegendFx = await markOn(pcAttacker, 'Living Legend: Charismatic', pcLegend?.uuid ?? null);
          const wAct = pcWeapon ? attackOf(pcAttacker, pcWeapon) : null;
          victimPrior();
          await victim.update({ 'system.attributes.ac.override': 30, 'system.attributes.hp.value': 400 });
          pcToken.control({ releaseOthers: true }); clearTargets(); victimToken.setTarget(true, { releaseOthers: true });
          const prior3 = new Set([...document.querySelectorAll('.application')].map(el => el.id));
          faces([[3, 20], [3, 20]]);
          const ar = await wAct.rollAttack({}, { configure: false }, {});
          unrig();
          const am = ar?.[0]?.parent ?? null;
          const aflag = await until(() => am?.getFlag(MOD, 'd20fold') ?? null, { timeout: 6000, label: 'the weapon miss\'s fold offer' });
          const us = (aflag?.offers ?? []).find(o => o.label === 'Unerring Strike') ?? null;
          ok('98e. a weapon MISS at AC 30 offers "Unerring Strike — hit instead" (once on each of your turns)', !!us && /hit instead/.test(String(us.says ?? '')),
            `offers=${JSON.stringify((aflag?.offers ?? []).map(o => [o.kind, o.label, o.says, o.cost]))}`);
          const pop3 = await until(() => [...document.querySelectorAll('.application')].find(el => !prior3.has(el.id) && !!el.querySelector('[data-bf-rescue-action="succeed"]')) ?? null, { timeout: 8000, label: 'the Unerring Strike rescue window' });
          pop3?.querySelector('[data-bf-rescue-action="succeed"]')?.click();
          const adone = await until(() => { const cur = am?.getFlag(MOD, 'd20fold'); return (cur?.spends?.length && !cur.spends.some(sp => sp.pendingVerdict)) ? cur : null; }, { timeout: 15000, label: 'the Unerring Strike spend folded' });
          ok('98f. pressed: the miss becomes a HIT (the verdict forced, no die)', adone?.targets?.[0]?.verdict === 'hit', `targets=${JSON.stringify(adone?.targets ?? null)} spends=${JSON.stringify(adone?.spends ?? null)}`);
          // soft: a settle before closeOffers; no ok reads this hit's damage
          await until(() => damageOrOffer(am), { timeout: 8000, label: 'the forced hit\'s damage rolled or offered' }).catch(() => null);
          await closeOffers();
          await unlend(pcAttacker, pcLegend); pcLegend = null;
          if (pcLegendFx) { await pcLegendFx.delete().catch(() => {}); pcLegendFx = null; }
          // g. Stroke of Luck on the PC Attacker's weapon MISS at AC 30: the 20 is a Critical Hit (the rule of cool)
          const pcStroke = await hgLend(pcAttacker, 'Stroke of Luck', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 0 });
          try {
            const dmgBefore = new Set(game.messages.contents.filter(m => m.type === 'damage').map(m => m.id));
            const prior4 = new Set([...document.querySelectorAll('.application')].map(el => el.id));
            faces([[3, 20], [3, 20]]);
            const ar2 = await wAct.rollAttack({}, { configure: false }, {});
            unrig();
            const am2 = ar2?.[0]?.parent ?? null;
            const aflag2 = await until(() => am2?.getFlag(MOD, 'd20fold') ?? null, { timeout: 6000, label: 'the second weapon miss\'s fold offer' });
            const so = (aflag2?.offers ?? []).find(o => o.label === 'Stroke of Luck') ?? null;
            ok('98g. a weapon MISS at AC 30 offers "Stroke of Luck — turn the d20 into a 20"', !!so && /into a 20/.test(String(so.says ?? '')),
              `offers=${JSON.stringify((aflag2?.offers ?? []).map(o => [o.kind, o.label, o.says]))}`);
            const pop4 = await until(() => [...document.querySelectorAll('.application')].find(el => !prior4.has(el.id) && !!el.querySelector('[data-bf-rescue-action="succeed"]')) ?? null, { timeout: 8000, label: 'the Stroke of Luck rescue window on the attack' });
            pop4?.querySelector('[data-bf-rescue-action="succeed"]')?.click();
            const adone2 = await until(() => { const cur = am2?.getFlag(MOD, 'd20fold'); return (cur?.spends?.length && !cur.spends.some(sp => sp.pendingVerdict)) ? cur : null; }, { timeout: 15000, label: 'the Stroke of Luck spend folded on the attack' });
            // the damage offer standing (or the damage already rolled) before closeOffers rolls it
            await until(() => damageOrOffer(am2, dmgBefore), { timeout: 8000, label: 'the critical hit\'s damage rolled or offered' });
            await closeOffers();   // the offer rolls the damage
            const dmg = await until(() => game.messages.contents.find(m => (m.type === 'damage') && !dmgBefore.has(m.id) && (m.getFlag(MOD, 'attackFor') === am2?.id)) ?? null, { timeout: 8000, label: 'the critical hit\'s damage' });
            ok('98h. pressed: the 20 HITS past AC 30 and the damage rolls as a CRITICAL HIT (the rule of cool), the use spent',
              (adone2?.targets?.[0]?.verdict === 'hit') && (dmg?.rolls?.[0]?.isCritical === true) && (Number(pcAttacker.items.get(pcStroke?.id ?? '')?.system?.uses?.spent) === 1),
              `targets=${JSON.stringify(adone2?.targets ?? null)} twenty=${JSON.stringify(adone2?.spends?.[0]?.twenty ?? null)} dmgCrit=${dmg?.rolls?.[0]?.isCritical} spent=${pcAttacker.items.get(pcStroke?.id ?? '')?.system?.uses?.spent}`);
          } finally {
            if (pcStroke) await unlend(pcAttacker, pcStroke);
          }
        }
      } finally {
        passAll(); await closeA1(); await closeOffers();
        for (const e of [legendFx, pcLegendFx]) if (e) await e.delete().catch(() => {});
        if (pcLegend) await unlend(pcAttacker, pcLegend);
        if (legend) await unlend(halfling, legend);
        if (halfling.items.get(stroke?.id ?? '')) await unlend(halfling, stroke);
        await victim.update({ 'system.attributes.ac.override': 1 }).catch(() => {});
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        unrig(); clearTargets();
      }
    });
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  }
} });

await finish({ tag: 'class-rogue', out, plan, f });
