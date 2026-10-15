// Classes smoke suite — Fighter: the PHB classes plan's rows (audits/plans/session-0-classes.md) for
// the Fighter, each section keeping its number and title. The fixtures, the lends, the
// helpers and the teardown are the classes kit's (tools/class-kit.mjs); everything written is restored.
import { announcePlan, connectSuite, finish, sectionPlan } from './harness.mjs';
import { runClassSuite } from './class-kit.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'chip-spend.js',          // Studied Attacks' chip spent (§47)
  'use-chips.js',           // Studied Attacks' miss chip (§47)
  'clock-riders.js',        // Eldritch Strike's rider (§43)
  'hew.js',                 // War Magic and Improved War Magic (§63, §95)
  'reminders.js',           // Studied Attacks' gate (§47), Shadow Step's chip (§63)
  'd20-folds.js',           // Commanding Presence (§27)
  'hit-menu.js',            // Psionic Strike (§30), Relentless (§48)
  'damage-holds.js',        // Protective Field's guard (§30)
  'saves/demand.js',        // Telekinetic Adept's save (§58)
  'metamagic.js',           // Sculpt Spells' free row (§63)
  'turn-grants.js',         // Heroic Warrior, Guarded Mind, Self-Restoration (§55), Heroic Rally (§94)
  'rebukes.js'              // Misty Escape's rebuke (§63)
];

const SECTIONS = {
  27: 'Commanding Presence: BTB Test Fighter\'s Persuasion, Intimidation and Performance checks offer the superiority die (the scoped tactical fold); Athletics does not; accepted on Persuasion, a die spent and the total patched',
  30: 'Psionic Power: Psionic Strike\'s force die on the menu (a die spent); Protective Field asks the Psi Warrior when an ally within 30 ft is hit ("Reduce"), the die + Int off; none left, never asked',
  43: 'Eldritch Strike (B2, lent to the Attacker): a weapon hit offers the rider row ticked and lands "Struck" on the Victim for the vex window; the Victim\'s save against the striker\'s Hold Person reads "Struck — against BTB Test Attacker\'s spell", Net Disadvantage, and the save SPENDS it',
  47: 'Studied Attacks (B3, lent to the Attacker): a MISS at the Halfling writes the chip "Studied Attacks — vs BTB Test Halfling" against it; the next attack\'s gate at the Halfling reads it (Net Advantage), at the Victim nothing; the attack at the Halfling spends it (the chipSpend record)',
  48: 'Relentless (B3, lent to BTB Test Fighter with no Superiority Dice left): a hit-menu maneuver still offered at "1d8 Superiority Die"; picked, the 1d8 rides, the record says Relentless stood in, nothing spent, the pool still 0; the card line',
  49: 'Tactical Master (B3, NATIVE — lent to the PC Attacker): the weapon\'s masteryOptions read Push, Sap and Slow beside its own (dnd5e 6 fills the attack dialog\'s Mastery select); rolled with mastery "push", the attack message carries push and the module\'s Push ask follows',
  55: 'the turn grants (B4, lent to the PC Attacker): Heroic Warrior writes Heroic Inspiration at the turn start; Guarded Mind asks to end Frightened (a Psionic die spent, the condition gone); Self-Restoration asks at the turn end to end Poisoned (free)',
  58: 'Telekinetic Thrust (B4): Psionic Strike\'s ride is followed by Telekinetic Adept\'s Strength save at the Victim; the failure lands Prone',
  63: 'the reminders and the bends (B4): War Magic\'s reminder on an attack; Shadow Step\'s chip (a melee gate reads Advantage); Defensive Tactics — Escape the Horde off the attacker\'s turn (Disadvantage) and Multiattack Defense\'s −4 chip against the hitter; Misty Escape\'s rebuke casts Misty Step and offers its Steps; Sculpt Spells\' free row on Fireball\'s cast window',
  94: "Survivor (D1, the Halfling): Heroic Rally heals 5 + Con at a Bloodied turn start, nothing when not Bloodied; Defy Death — an 18 on the death save is a critical success",
  95: "Improved War Magic (D1, the PC Attacker with War Magic too): its reminder alone, two attacks for a level 1 or 2 spell"
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'class-fighter', watchdogMs: 900_000 });
announcePlan('class-fighter', plan, pulled);

const out = await runClassSuite(f, { plan, sections: SECTIONS, body: async ({ sections, titles }) => {
  const results = [];
  const skips = [];
  const ok = (name, pass, detail = '') => results.push({ name, pass, detail });
  const want = id => {
    if (!sections || sections.includes(String(id))) return true;
    skips.push(`§${id} ${titles?.[id] ?? ''}`);
    return false;
  };
  const KIT = window.__btbClasses;
  const { MOD, a1Damage, a1Hit, a1Roll, a1Victim, ackHew, act, attackOf, attacker, attackerToken, b4Cards, cardEl, cardText, clearDown, clearTargets, closeA1, closeDialogs, closeOffers, created, d1Cards, d1Combat, dropEffects, dropReactionChips, dropVictimFx, faces, findPHB, gateFor, groupText, halfling, halflingToken, hasStatus, healFull, hewNotices, hgClose, hgKeep, hgLend, hitBox, hitRow, holdOf, hp, lend, lendClassSpell, lentBy, log, offerApp, outcomeOn, pcAttacker, pcToken, pcWeapon, pinPart, placeToken, popups, realPRNG, riderBox, riderChits, riderRow, rollDialog, scene, set, settledSave, sleep, sorcerer, sorcererDoc, spendLuck, spendLuckC, statusOn, suiteStart, swing, textOf, tick, titled, typesOf, unlend, useFeature, victim, victimFx, victimToken, waitFor, weaponOf } = KIT;
  try {
    await KIT.leaveA3();

    // ---- 27. Commanding Presence: the scoped superiority fold (SUPERIORITY_FOLDS)
    if (want(27)) {
      await closeA1();
      const fighter = game.actors.getName('BTB Test Fighter');
      const pool = fighter?.items.find(i => i.name === 'Combat Superiority') ?? null;
      if (!fighter || !pool) log.push(`§27 skipped: BTB Test Fighter=${!!fighter} Combat Superiority=${!!pool} — run tools/fixture-suite.mjs`);
      else {
        const priorSpent = pool.system._source.uses?.spent ?? 0;
        // UNSURE: the fixture (a copy of a real Battle Master) may carry Commanding Presence itself — then it is
        // used as it stands and never deleted. Lent from the PHB pack, its consumption re-links to the fixture's
        // Combat Superiority by the pack uuid (actor.sourcedItems), as smoke-superiority's lent maneuvers do.
        const native = fighter.items.find(i => (i.type === 'feat') && (i.name === 'Commanding Presence')) ?? null;
        const cp = native ?? await lend(fighter, 'Commanding Presence');
        const poolLeft = () => Number(fighter.items.get(pool.id)?.system?.uses?.value ?? -1);
        const rescueWindow = text => [...document.querySelectorAll('.application')]
          .find(el => el.querySelector('[data-bf-rescue-row]') && (el.textContent ?? '').includes(text)) ?? null;
        const labels = fl => (fl?.offers ?? []).map(o => o.label);
        const foldOf = async skill => {
          faces([[8, 20]]);
          const rolls = await fighter.rollSkill({ skill }, { configure: false }, {});
          const m = rolls?.[0]?.parent ?? null;
          const flag = await waitFor(() => m?.getFlag(MOD, 'd20fold') ?? null, 3000);
          await sleep(300);
          return { m, flag };
        };
        try {
          await pool.update({ 'system.uses.spent': 0 });
          const full = poolLeft();
          const seen = {};
          for (const skill of ['itm', 'prf', 'ath', 'per']) {   // Persuasion LAST: its window stays open to accept
            seen[skill] = await foldOf(skill);
            if (skill !== 'per') await closeA1();
          }
          ok('27a. a Persuasion check offers "Commanding Presence" — the superiority die (the fold\'s tactical spend, the feature\'s scope)',
            labels(seen.per.flag).includes('Commanding Presence') && (seen.per.flag?.skill === 'per'),
            `offers=${JSON.stringify(labels(seen.per.flag))} die=${(seen.per.flag?.offers ?? []).find(o => o.label === 'Commanding Presence')?.dieFormula}`);
          ok('27b. Intimidation and Performance offer it too', labels(seen.itm.flag).includes('Commanding Presence') && labels(seen.prf.flag).includes('Commanding Presence'),
            `itm=${JSON.stringify(labels(seen.itm.flag))} prf=${JSON.stringify(labels(seen.prf.flag))}`);
          ok('27c. Athletics does not', !labels(seen.ath.flag).includes('Commanding Presence'), `ath=${JSON.stringify(labels(seen.ath.flag))}`);
          // Accept on the Persuasion check (still open): the rescue window's row, keyed by NAME.
          const win = await waitFor(() => rescueWindow('Commanding Presence'), 6000);
          win?.querySelector('[data-bf-rescue-action="tactical:Commanding Presence"]')?.click();
          const done = await waitFor(() => { const fl = seen.per.m?.getFlag(MOD, 'd20fold'); return (fl?.spends?.some(s => (s.name === 'Commanding Presence') && !s.pendingVerdict) && Number.isFinite(fl.foldedTotal)) ? fl : null; }, 10000);
          ok('27d. accepted on Persuasion: a Superiority Die spent, the die rolled and the total patched, the spend named Commanding Presence',
            !!win && (done?.spends?.[0]?.name === 'Commanding Presence') && (done?.foldedTotal === done?.baseTotal + done?.spends?.[0]?.die) && (poolLeft() === full - 1),
            `win=${!!win} flag=${JSON.stringify(done && { status: done.status, outcome: done.outcome, spends: done.spends, base: done.baseTotal, folded: done.foldedTotal })} pool=${poolLeft()}/${full}`);
        } finally {
          CONFIG.Dice.randomUniform = realPRNG;
          await closeA1();
          await pool.update({ 'system.uses.spent': priorSpent }).catch(() => {});
          if (!native) await unlend(fighter, cp);
        }
      }
    }
    KIT.markA2();

    // ---- 30. Psionic Power: Psionic Strike on the menu, Protective Field for an ally and for yourself
    if (want(30)) {
      await closeDialogs(); await a1Victim(); await spendLuck(); await dropReactionChips(pcAttacker);
      hgKeep(pcAttacker, { 'system.attributes.hp.value': pcAttacker.system._source.attributes.hp.value, 'system.attributes.hp.max': pcAttacker.system._source.attributes.hp.max });
      // The Psi Warrior's own item: the Soulknife's shares the name and the identifier.
      const src = await fromUuid('Compendium.dnd-players-handbook.classes.Item.phbftrPsionicPow');
      let pp = null;
      if (src) {
        const data = src.toObject();
        foundry.utils.setProperty(data, '_stats.compendiumSource', src.uuid);
        [pp] = await pcAttacker.createEmbeddedDocuments('Item', [data]);
        lentBy.set(pcAttacker, [...(lentBy.get(pcAttacker) ?? []), pp.id]);
        await pp.update({ 'system.uses.max': '4', 'system.uses.spent': 0 });
      }
      try {
        if (!pp || !pcWeapon) log.push(`§30 skipped: psionicPower=${!!pp} weapon=${!!pcWeapon}`);
        else {
          const strikeAct = pp.system.activities.find(a => a.name === 'Psionic Strike');
          const fieldAct = pp.system.activities.find(a => a.name === 'Protective Field');
          await pinPart(pp, strikeAct, '1d8 + @abilities.int.mod');
          await pp.update({ [`system.activities.${fieldAct.id}.healing.custom.formula`]: 'max(1, 1d8 + @abilities.int.mod)' });
          const left = () => Number(pcAttacker.items.get(pp.id)?.system?.uses?.value ?? -1);
          await pcAttacker.update({ 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400 });

          const r1 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('30a. a Longsword hit: "Psionic Strike — 1d8 + N force · 1 Psionic Energy Die" in the Psionic Power group',
            !!hitBox(r1.offer, 'psionic-strike') && /1d8 \+ -?\d+ force · 1 Psionic Energy Die/.test(hitRow(r1.offer, 'psionic-strike')),
            `row="${hitRow(r1.offer, 'psionic-strike').slice(0, 120)}" group="${groupText(r1.offer, 'psionic-power').slice(0, 80)}"`);
          await tick(r1.offer, 'psionic-strike');
          const d1 = await a1Roll(r1.msg, r1.offer);
          await sleep(600);
          ok('30b. ticked: the force die rides the roll, one Psionic Energy Die spent', typesOf(d1).includes('force') && (left() === 3),
            `types=${JSON.stringify(typesOf(d1))} left=${left()}`);

          // Protective Field for an ally: the hostile Attacker hits the Halfling, BTB Test PC Attacker within 30 ft
          const fieldPopup = () => popups().find(app => /Protective Field/.test(textOf(app.element)) && app.element?.querySelector?.('button[data-action="cast"]')) ?? null;
          const holdOn = since => game.messages.contents.find(m => (m.timestamp >= since) && m.getFlag(MOD, 'damageHold')) ?? null;
          const t2 = Date.now();
          const m2 = await swing({ d20: [19], dmg: 6 });
          const pop = await waitFor(fieldPopup, 8000);
          ok('30c. the Halfling hit: Protective Field asks BTB Test PC Attacker ("within 30 ft of you · a Reaction · a Psionic Energy Die", Reduce)',
            !!pop && /within 30 ft of you/.test(textOf(pop?.element)) && /Psionic Energy Die/.test(textOf(pop?.element))
              && (textOf(pop?.element?.querySelector('button[data-action="cast"]')) === 'Reduce'),
            `attack=${!!m2} pop="${textOf(pop?.element).slice(0, 220)}"`);
          faces([[8, 8]]);
          pop?.element?.querySelector('button[data-action="cast"]')?.click();
          const h2 = await waitFor(() => { const m = holdOn(t2); const f = m?.getFlag(MOD, 'damageHold'); return (f?.status === 'resolved') ? f : null; }, 12000);
          await sleep(800);
          // Out of combat no Reaction chip is written (a turn to give it back is needed): the die is the spend.
          ok('30d. Reduce: the die + Int off the Halfling\'s damage, a Psionic Energy Die spent',
            (h2?.answer === 'cast') && (Number(h2?.reduceBy) >= 1) && (left() === 2),
            `hold=${JSON.stringify(h2 && { answer: h2.answer, reduceBy: h2.reduceBy, amount: h2.amount, label: h2.label })} left=${left()} hp=${hp()}`);
          await closeDialogs(); await dropReactionChips(pcAttacker);

          // none left: never asked
          await pcAttacker.items.get(pp.id).update({ 'system.uses.spent': 4 });
          const t3 = Date.now();
          await swing({ d20: [19], dmg: 6 });
          await sleep(2500);
          ok('30e. no Psionic Energy Dice left: the Halfling\'s damage lands with nobody asked', !fieldPopup() && !holdOn(t3) && (hp() < 400),
            `pop=${!!fieldPopup()} hold=${!!holdOn(t3)} hp=${hp()}`);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        await dropReactionChips(pcAttacker);
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        if (pp) await unlend(pcAttacker, pp);
        await healFull();
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ================================================ §B2 — the save bends by name (RULINGS *The PHB classes — B2*)
    // ---- 43. Eldritch Strike: the hit lands Struck; the target's save against the striker's spell at Disadvantage, spent
    if (want(43)) {
      await closeA1(); await a1Victim(); await dropVictimFx();
      const es = await hgLend(attacker, 'Eldritch Strike', 'feat');
      const lentSpells = [];
      const spellAt = async (name, targetToken) => {
        let id = attacker.items.find(i => (i.name === name) && (i.type === 'spell'))?.id;
        if (!id) {
          const src = await findPHB(name, 'spell');
          const data = src?.toObject();
          if (!data) return null;
          data.system.prepared = 1; data.system.method = 'atwill';
          const [it] = await attacker.createEmbeddedDocuments('Item', [data]); id = it.id; lentSpells.push(id);
        }
        const a = attacker.items.get(id)?.system?.activities?.find(x => x.type === 'save');
        if (!a) return null;
        attackerToken.control({ releaseOthers: true });
        targetToken.setTarget(true, { releaseOthers: true });
        await sleep(100);
        const use = await a.use({ consume: { spellSlot: false } }, { configure: false }, {});
        const card = use?.message ?? null;
        await waitFor(() => card?.getFlag(MOD, 'saves'), 6000);
        return card;
      };
      try {
        if (!es) log.push('§43 skipped: no Eldritch Strike in the PHB');
        else {
          await set('saveRolls', 'prompt');
          const r = await a1Hit(attacker, attackerToken, act());
          const row = riderRow(r.offer, 'eldritch-strike');
          ok('43a. a weapon hit by the fighter: the offer\'s rider row "Eldritch Strike", ticked',
            !!r.offer && /Eldritch Strike/.test(row) && (riderBox(r.offer, 'eldritch-strike')?.checked === true), `offer=${!!r.offer} row="${row.slice(0, 140)}"`);
          await a1Roll(r.msg, r.offer);
          const struck = await waitFor(() => victimFx().find(e => e.name === 'Struck') ?? null, 8000);
          // The vex window: 1 round in a combat, the platform's 6 seconds out of one — the turnEnd expiry either way.
          const sd = struck?.duration ?? {};
          ok('43b. Struck lands on the Victim off the hit, clocked to the vex window (1 round / 6 s, turnEnd)',
            !!struck && (sd.expiry === 'turnEnd') && ((Number(sd.rounds) === 1) || (Number(sd.seconds) === 6)),
            `struck=${!!struck} duration=${JSON.stringify(struck?.duration?.toObject?.() ?? struck?.duration ?? null)}`);
          const card = await spellAt('Hold Person', victimToken);
          if (!card || !struck) log.push(`§43c skipped: card=${!!card} struck=${!!struck}`);
          else {
            let dlg = await waitFor(rollDialog, 3000);
            let p = null;
            if (!dlg) { p = victim.rollSavingThrow({ ability: 'wis' }, {}, {}); dlg = await waitFor(rollDialog, 6000); }
            const text = textOf(dlg?.element?.querySelector('[data-bf-reminder]'));
            ok('43c. the Victim\'s save against the fighter\'s Hold Person: "Struck — against BTB Test Attacker\'s spell", Net Disadvantage',
              !!dlg && /Struck — against BTB Test Attacker's spell/.test(text) && /Net Disadvantage/.test(text), `dlg=${!!dlg} text="${text.slice(0, 220)}"`);
            (dlg?.element?.querySelector('button[data-action="disadvantage"]') ?? dlg?.element?.querySelector('button[autofocus]'))?.click();
            if (p) await p.catch(() => {});
            const gone = await waitFor(() => !victim.effects.get(struck.id), 8000);
            ok('43d. the save SPENT Struck: gone from the Victim', gone === true, `gone=${!victim.effects.get(struck.id)}`);
            await waitFor(() => card.getFlag(MOD, 'saves')?.status === 'done', 8000);
          }
        }
      } finally {
        await closeA1(); await closeOffers();
        await dropVictimFx();
        for (const e of victim.effects.filter(e => e.name === 'Paralyzed')) await e.delete().catch(() => {});
        if (es) await unlend(attacker, es);
        if (lentSpells.length) await attacker.deleteEmbeddedDocuments('Item', lentSpells).catch(() => {});
        CONFIG.Dice.randomUniform = realPRNG;
        clearTargets();
      }
    }

    // ---- 47. Studied Attacks: a miss arms the chip against that creature; the gate reads it there alone; the roll spends it
    if (want(47)) {
      await closeA1(); await spendLuck();
      const sa = await hgLend(attacker, 'Studied Attacks', 'feat');
      try {
        if (!sa) log.push('§47 skipped: no Studied Attacks in the PHB');
        else {
          await healFull();
          const msg = await swing({ d20: [2] });   // 2 + the modifier < the Halfling's AC: a miss
          const chip = await waitFor(() => attacker.effects.find(e => (e.getFlag(MOD, 'mastery') === 'use') && (e.getFlag(MOD, 'useKey') === 'studiedAttacks')) ?? null, 8000);
          ok('47a. a miss at the Halfling: the chip "Studied Attacks — vs BTB Test Halfling" on the attacker, against the Halfling',
            !!chip && /Studied Attacks — vs/.test(chip.name) && (chip.getFlag(MOD, 'against') === halfling.uuid), `chip=${chip?.name ?? null} against=${chip?.getFlag(MOD, 'against')} hold=${!!holdOf(msg)}`);
          const gH = await gateFor(attackerToken, act(), halflingToken);
          ok('47b. the next attack\'s gate at the Halfling: "Studied Attacks — vs BTB Test Halfling", Net Advantage', /Studied Attacks — vs/.test(gH.text) && (gH.net === 'advantage'), `text="${gH.text.slice(0, 200)}" net=${gH.net}`);
          const gV = await gateFor(attackerToken, act(), victimToken);
          ok('47c. …at another creature: no Studied Attacks row', gV.open ? !/Studied Attacks/.test(gV.text) : true, `open=${gV.open} text="${gV.text.slice(0, 200)}"`);
          const msg2 = await swing({ d20: [12] });
          const gone = await waitFor(() => (chip && !attacker.effects.get(chip.id)) ? true : null, 8000);
          const spent = msg2?.getFlag(MOD, 'chipSpend')?.spent ?? [];
          ok('47d. the attack at the Halfling spends the chip: gone from the attacker, the attack card\'s spend record naming it',
            (gone === true) && spent.some(x => /Studied Attacks/.test(x.name)), `gone=${!!chip && !attacker.effects.get(chip.id)} spent=${JSON.stringify(spent.map(x => x.name))}`);
        }
      } finally {
        await closeA1();
        if (sa) await unlend(attacker, sa);
        for (const e of attacker.effects.filter(e => e.getFlag(MOD, 'useKey') === 'studiedAttacks')) await e.delete().catch(() => {});
        await dropReactionChips(halfling);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets(); await healFull();
      }
    }

    // ---- 48. Relentless: with no Superiority Dice left, a d8 stands in on a hit-menu maneuver
    if (want(48)) {
      await closeA1(); await a1Victim(); await dropVictimFx();
      const { HIT_OPTIONS } = await import('/modules/fvtt-mod-bythebooks/scripts/decide/registry.js');
      const fighter = game.actors.getName('BTB Test Fighter');
      const pool = fighter?.items.find(i => (i.name === 'Combat Superiority') && (Number(i.system?.uses?.max) > 0)) ?? null;
      const fWeapon = fighter ? weaponOf(fighter) : null;
      const rel = fighter ? await hgLend(fighter, 'Relentless', 'feat') : null;
      const priorSpent = Number(pool?.system?.uses?.spent ?? 0);
      let key = fighter ? (Object.entries(HIT_OPTIONS).find(([, r]) => (r.group === 'combat-superiority') && !r.save && (r.mode !== 'sweep') && fighter.items.some(i => i.name === r.feature))
        ?? Object.entries(HIT_OPTIONS).find(([, r]) => (r.group === 'combat-superiority') && fighter.items.some(i => i.name === r.feature)))?.[0] ?? null : null;
      // The fixture's sheet names none of the table's on-hit maneuvers: lend Distracting Strike (an effect, no save).
      const lentManeuver = (fighter && !key) ? await hgLend(fighter, 'Distracting Strike', 'feat') : null;
      if (lentManeuver) key = 'distracting-strike';
      let fTokenDoc = null;
      try {
        if (!fighter || !pool || !fWeapon || !rel || !key) log.push(`§48 skipped: fighter=${!!fighter} pool=${!!pool} weapon=${!!fWeapon} relentless=${!!rel} maneuver=${key}`);
        else {
          await set('saveRolls', 'auto');
          const { token: fToken, doc } = await placeToken(fighter, 1700, 2100, 1);
          fTokenDoc = doc;
          await pool.update({ 'system.uses.spent': Number(pool.system.uses.max) });   // none left
          const r = await a1Hit(fighter, fToken, attackOf(fighter, fWeapon));
          const row = hitRow(r.offer, key);
          ok(`48a. no Superiority Dice left, Relentless on the sheet: the offer's group still opens, ${key} costing "1d8 Superiority Die"`,
            !!r.offer && /1d8 Superiority Die/.test(row) && (hitBox(r.offer, key)?.disabled === false), `offer=${!!r.offer} row="${row.slice(0, 140)}" group="${groupText(r.offer, 'combat-superiority').slice(0, 140)}"`);
          await tick(r.offer, key);
          const d = await a1Roll(r.msg, r.offer);
          const pick = d?.getFlag(MOD, 'hitManeuver')?.picks?.[0] ?? null;
          const left = Number(fighter.items.get(pool.id)?.system?.uses?.value ?? -1);
          ok('48b. the d8 rode in the die\'s place: formula 1d8, the record "Relentless" standing in, nothing spent, the pool still 0',
            (pick?.key === key) && (pick?.formula === '1d8') && (pick?.poolSpend?.standIn === 'Relentless') && (pick?.poolSpend?.spent === 0) && (left === 0),
            `pick=${JSON.stringify(pick && { key: pick.key, formula: pick.formula, poolSpend: pick.poolSpend })} left=${left}`);
          const line = await waitFor(() => { const t = cardText(d?.id); return /stood in/.test(t) ? t : null; }, 6000);
          ok('48c. the damage card: "Relentless — a 1d8 stood in for the Superiority Die; none spent"',
            /Relentless — a 1d8 stood in for the Superiority Die; none spent/.test(line ?? ''), `card="${(line ?? cardText(d?.id)).slice(0, 240)}"`);
        }
      } finally {
        await closeA1(); await closeOffers(); await dropVictimFx();
        if (pool) await pool.update({ 'system.uses.spent': priorSpent }).catch(() => {});
        if (rel) await unlend(fighter, rel);
        if (lentManeuver) await unlend(fighter, lentManeuver);
        if (fighter) await dropEffects(fighter, riderChits(fighter));
        if (fTokenDoc && scene.tokens.get(fTokenDoc.id)) { await scene.deleteEmbeddedDocuments('Token', [fTokenDoc.id]).catch(() => {}); created.tokens = created.tokens.filter(id => id !== fTokenDoc.id); }
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 49. Tactical Master is NATIVE: dnd5e's mastery select off the pack's effect; the module resolves the pick
    if (want(49)) {
      await closeA1(); await a1Victim(); await dropVictimFx();
      const tm = await hgLend(pcAttacker, 'Tactical Master', 'feat');
      const w = pcWeapon ? pcAttacker.items.get(pcWeapon.id) : null;
      const priorMastery = { value: [...(pcAttacker.system._source.traits?.weaponProf?.mastery?.value ?? [])], weapon: w?._source?.system?.mastery ?? '' };
      try {
        if (!tm || !w) log.push(`§49 skipped: tm=${!!tm} weapon=${!!w}`);
        else {
          const base = w.system.type?.baseItem ?? null;
          if (base && !pcAttacker.system.traits?.weaponProf?.mastery?.value?.has?.(base)) await pcAttacker.update({ 'system.traits.weaponProf.mastery.value': [...priorMastery.value, base] });
          if (!w.system.mastery) await w.update({ 'system.mastery': 'sap' });
          await sleep(250);
          const live = pcAttacker.items.get(w.id);
          const options = live?.system?.masteryOptions ?? null;
          const values = (options ?? []).map(o => o.value);
          ok('49a. NATIVE: with Tactical Master\'s effect on the sheet, the weapon\'s masteryOptions read Push, Sap and Slow beside its own (dnd5e 6 fills the attack dialog\'s Mastery select from mastery.bonus)',
            !!options && ['push', 'sap', 'slow'].every(v => values.includes(v)),
            `options=${JSON.stringify(values)} own=${live?.system?.mastery} base=${base} bonus=${JSON.stringify([...(pcAttacker.system.traits?.weaponProf?.mastery?.bonus ?? [])])}`);
          await victim.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          pcToken.control({ releaseOthers: true }); clearTargets(); victimToken.setTarget(true, { releaseOthers: true });
          await sleep(100);
          const before = new Set(popups());
          faces([[19, 20], [19, 20], [3, 6], [3, 6]]);
          const wa = attackOf(pcAttacker, w);
          const usage = await wa.use({ subsequentActions: false }, { configure: false }, {});
          const rolls = await wa.rollAttack({}, { configure: false }, usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
          const msg = rolls?.[0]?.parent ?? null;
          ok('49b. rolled without a dialog: the attack message carries the weapon\'s own mastery (sap) — the pick waits for the hit', msg?.system?.mastery === 'sap', `mastery=${msg?.system?.mastery}`);
          const offer = await waitFor(() => offerApp(before), 4000);
          if (offer) await a1Roll(msg, offer); else await a1Damage(msg);
          const pick = await waitFor(() => (msg?.getFlag(MOD, 'masteryPick')?.status === 'pending') ? msg.getFlag(MOD, 'masteryPick') : null, 8000);
          ok('49c. THE BEND (the walk of 2026-10-10): the hit stamps masteryPick on the attack — the three options, the weapon\'s own as the stamped fallback, the victim among the hits; no mastery resolved yet',
            !!pick && ['push', 'sap', 'slow'].every(k => (pick.options ?? []).some(o => o.key === k)) && (pick.stamped === 'sap') && (pick.hits ?? []).some(h => h.uuid === victim.uuid) && !msg.getFlag(MOD, 'mastery'),
            `pick=${JSON.stringify(pick && { options: pick.options?.map(o => o.key), stamped: pick.stamped, hits: pick.hits?.length })}`);
          const pickPopup = await waitFor(() => popups().find(app => /Tactical Master/.test(app.element?.textContent ?? '')) ?? null, 4000);
          ok('49d. the pick popup opened for the answerer: Sap (the weapon\'s), Push, Slow and Pass', !!pickPopup && ['sap', 'push', 'slow', 'pass'].every(a => !!pickPopup.element.querySelector(`button[data-action="${a}"]`)), `popup=${!!pickPopup}`);
          await game.modules.get(MOD).api.mastery.answerMasteryPick(msg, 'push');
          const ask = await waitFor(() => (msg?.getFlag(MOD, 'mastery')?.key === 'push') ? msg.getFlag(MOD, 'mastery') : null, 8000);
          ok('49e. the answer runs the machine with Push: the Push ask stamped on the attack (not the weapon\'s own), the pick done',
            (ask?.key === 'push') && (msg.getFlag(MOD, 'masteryPick')?.status === 'done'), `mastery=${JSON.stringify(ask && { key: ask.key, status: ask.status })} pick=${msg.getFlag(MOD, 'masteryPick')?.status} setting=${game.settings.get(MOD, 'masteryAsk')}`);
        }
      } finally {
        await closeA1(); await closeOffers(); await hgClose(/Push|Mastery/); await dropVictimFx();
        if (tm) await unlend(pcAttacker, tm);
        await pcAttacker.update({ 'system.traits.weaponProf.mastery.value': priorMastery.value }).catch(() => {});
        if (w && pcAttacker.items.get(w.id)) await pcAttacker.items.get(w.id).update({ 'system.mastery': priorMastery.weapon }).catch(() => {});
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 55. the turn grants: Heroic Warrior (Heroic Inspiration written), Guarded Mind (End Frightened, a die), Self-Restoration (End Poisoned at the turn end)
    if (want(55)) {
      await closeA1();
      hgKeep(pcAttacker, { 'system.attributes.inspiration': pcAttacker.system._source.attributes.inspiration ?? false });
      const heroic = await hgLend(pcAttacker, 'Heroic Warrior', 'feat');
      const guarded = await hgLend(pcAttacker, 'Guarded Mind', 'feat');
      const restoration = await hgLend(pcAttacker, 'Self-Restoration', 'feat');
      const psi = await (async () => { const src = await fromUuid('Compendium.dnd-players-handbook.classes.Item.phbftrPsionicPow'); if (!src) return null; const data = src.toObject(); foundry.utils.setProperty(data, '_stats.compendiumSource', src.uuid); const [it] = await pcAttacker.createEmbeddedDocuments('Item', [data]); lentBy.set(pcAttacker, [...(lentBy.get(pcAttacker) ?? []), it.id]); await it.update({ 'system.uses.max': '4', 'system.uses.spent': 0 }); return it; })();
      const [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
      created.combats.push(combat.id);
      const ends = () => b4Cards(suiteStart, 'conditionEnd').filter(m => m.getFlag(MOD, 'conditionEnd')?.actorUuid === pcAttacker.uuid);
      try {
        if (!heroic || !guarded || !restoration || !psi) log.push(`§55 skipped: heroic=${!!heroic} guarded=${!!guarded} restoration=${!!restoration} psi=${!!psi}`);
        else {
          await pcAttacker.update({ 'system.attributes.inspiration': false });
          await statusOn(pcAttacker, 'frightened', true);
          await statusOn(pcAttacker, 'poisoned', true);
          await combat.createEmbeddedDocuments('Combatant', [
            { tokenId: victimToken.document.id, sceneId: scene.id, actorId: victim.id, initiative: 20 },
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 10 }]);
          await combat.startCombat();
          await sleep(400);
          const t0 = Date.now();
          await combat.nextTurn();   // the PC Attacker's turn starts
          const hw = await waitFor(() => b4Cards(t0, 'turnGrant').find(m => m.getFlag(MOD, 'turnGrant')?.grant === 'inspiration') ?? null, 8000);
          ok('55a. the turn start: Heroic Warrior writes Heroic Inspiration (none was held) and posts its card',
            !!hw && (pcAttacker.system.attributes.inspiration === true), `card=${!!hw} inspiration=${pcAttacker.system.attributes.inspiration}`);
          const endCard = await waitFor(() => ends().find(m => m.getFlag(MOD, 'conditionEnd')?.row === 'Guarded Mind') ?? null, 8000);
          const pop = await waitFor(() => titled(/^Guarded Mind — /), 6000);
          ok('55b. Guarded Mind: the popup "End a condition on BTB Test PC Attacker?" with Frightened (1 Psionic Power die), the poisoned not listed',
            !!endCard && !!pop && /Frightened/.test(textOf(pop?.element)) && !/Poisoned/.test(textOf(pop?.element)) && /Psionic Power/.test(textOf(pop?.element)),
            `card=${!!endCard} pop=${!!pop} text="${textOf(pop?.element).slice(0, 220)}"`);
          pop?.element?.querySelector('button[data-action="frightened"]')?.click();
          const done = await waitFor(() => endCard?.getFlag(MOD, 'conditionEnd')?.applied ? endCard.getFlag(MOD, 'conditionEnd') : null, 12000);
          await sleep(600);
          ok('55c. End Frightened: the condition gone, a Psionic Energy Die spent (3 of 4), the card says so',
            (done?.ended === 'frightened') && !hasStatus(pcAttacker, 'frightened') && (Number(pcAttacker.items.get(psi.id)?.system?.uses?.value) === 3) && /Frightened ended on/.test(cardText(endCard?.id)),
            `flag=${JSON.stringify(done && { ended: done.ended, gone: done.gone, failed: done.failed })} frightened=${hasStatus(pcAttacker, 'frightened')} dice=${pcAttacker.items.get(psi.id)?.system?.uses?.value} card="${cardText(endCard?.id).slice(0, 160)}"`);
          // d. the turn END: Self-Restoration offers Poisoned
          const t1 = Date.now();
          await combat.nextTurn();
          const endCard2 = await waitFor(() => b4Cards(t1, 'conditionEnd').find(m => m.getFlag(MOD, 'conditionEnd')?.row === 'Self-Restoration') ?? null, 8000);
          const pop2 = await waitFor(() => titled(/^Self-Restoration — /), 6000);
          ok('55d. the turn end: Self-Restoration\'s popup with Poisoned, free', !!endCard2 && !!pop2 && /Poisoned/.test(textOf(pop2?.element)) && /free/.test(textOf(pop2?.element)),
            `card=${!!endCard2} pop=${!!pop2} text="${textOf(pop2?.element).slice(0, 200)}"`);
          pop2?.element?.querySelector('button[data-action="poisoned"]')?.click();
          const done2 = await waitFor(() => endCard2?.getFlag(MOD, 'conditionEnd')?.applied ? endCard2.getFlag(MOD, 'conditionEnd') : null, 12000);
          await sleep(600);
          ok('55e. End Poisoned: gone, nothing spent', (done2?.ended === 'poisoned') && !hasStatus(pcAttacker, 'poisoned') && (Number(pcAttacker.items.get(psi.id)?.system?.uses?.value) === 3),
            `flag=${JSON.stringify(done2 && { ended: done2.ended })} poisoned=${hasStatus(pcAttacker, 'poisoned')}`);
        }
      } finally {
        await closeA1(); await hgClose(/^Guarded Mind — |^Self-Restoration — /);
        if (game.combats.get(combat.id)) await combat.delete();
        for (const s of ['frightened', 'poisoned']) if (hasStatus(pcAttacker, s)) await statusOn(pcAttacker, s, false);
        for (const it of [heroic, guarded, restoration, psi]) if (it) await unlend(pcAttacker, it);
      }
    }

    // ---- 58. Telekinetic Thrust: Psionic Strike's ride is followed by Telekinetic Adept's Strength save; a failure lands Prone
    if (want(58)) {
      await closeDialogs(); await a1Victim(); await dropVictimFx(); await set('saveRolls', 'auto');
      const src = await fromUuid('Compendium.dnd-players-handbook.classes.Item.phbftrPsionicPow');
      let pp = null;
      if (src) { const data = src.toObject(); foundry.utils.setProperty(data, '_stats.compendiumSource', src.uuid); [pp] = await pcAttacker.createEmbeddedDocuments('Item', [data]); lentBy.set(pcAttacker, [...(lentBy.get(pcAttacker) ?? []), pp.id]); await pp.update({ 'system.uses.max': '4', 'system.uses.spent': 0 }); }
      const adept = await hgLend(pcAttacker, 'Telekinetic Adept', 'feat');
      try {
        if (!pp || !adept || !pcWeapon) log.push(`§58 skipped: psionicPower=${!!pp} adept=${!!adept} weapon=${!!pcWeapon}`);
        else {
          await pinPart(pp, pp.system.activities.find(a => a.name === 'Psionic Strike'), '1d8 + @abilities.int.mod');
          const t0 = Date.now();
          const r1 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          await tick(r1.offer, 'psionic-strike');
          faces([[1, 20]]);   // the Victim's Strength save fails
          const d1 = await a1Roll(r1.msg, r1.offer);
          const card = await settledSave('psionic-strike', t0);
          await waitFor(() => hasStatus(victim, 'prone'), 8000);
          await sleep(400);
          CONFIG.Dice.randomUniform = realPRNG;
          ok('58a. Psionic Strike ticked: the force die rides, then Telekinetic Thrust\'s Strength save card (the follow-up, keyed to the pick), the failure lands Prone',
            typesOf(d1).includes('force') && !!card && (card.getFlag(MOD, 'hitManeuverCard')?.feature === 'Telekinetic Adept') && (outcomeOn(card) === 'failed') && hasStatus(victim, 'prone'),
            `types=${JSON.stringify(typesOf(d1))} card=${JSON.stringify(card?.getFlag(MOD, 'hitManeuverCard') && { feature: card.getFlag(MOD, 'hitManeuverCard').feature, line: card.getFlag(MOD, 'hitManeuverCard').line?.slice(0, 60) })} outcome=${outcomeOn(card)} prone=${hasStatus(victim, 'prone')}`);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        if (hasStatus(victim, 'prone')) await statusOn(victim, 'prone', false);
        await dropVictimFx(); await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [pp, adept]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 63. the reminders and the bends: War Magic, Shadow Step, Defensive Tactics (Escape the Horde, Multiattack Defense), Misty Escape, Sculpt Spells
    if (want(63)) {
      await closeA1(); await a1Victim(); await spendLuck();
      // The Halfling stands: a drop earlier in the suite leaves the downed conditions' Prone rider past the heal (as
      // written), and c reads the gate's rows.
      { const stale = halfling.effects.filter(e => ['prone', 'unconscious', 'dead'].some(s => e.statuses?.has?.(s))); if (stale.length) await halfling.deleteEmbeddedDocuments('ActiveEffect', stale.map(e => e.id)); }
      const warMagic = await hgLend(pcAttacker, 'War Magic', 'feat');
      const shadow = await hgLend(pcAttacker, 'Shadow Step', 'feat');
      const tactics = await hgLend(halfling, 'Defensive Tactics', 'feat');
      const misty = await hgLend(sorcerer, 'Misty Escape', 'feat');
      const step = await lendClassSpell(sorcerer, 'Misty Step', 'warlock');
      const sculpt = await hgLend(sorcerer, 'Sculpt Spells', 'feat');
      const fireball = await lendClassSpell(sorcerer, 'Fireball', 'wizard');
      hgKeep(sorcerer, { 'system.attributes.hp.value': sorcerer.system._source.attributes.hp.value, 'system.attributes.hp.max': sorcerer.system._source.attributes.hp.max,
        'system.attributes.ac.override': sorcerer.system._source.attributes.ac.override ?? null, 'system.spells': foundry.utils.deepClone(sorcerer.system._source.spells) });
      let combat63 = null;
      try {
        // a. War Magic: a weapon attack posts the reminder (the GM's)
        if (!warMagic || !pcWeapon) log.push(`§63a skipped: warMagic=${!!warMagic} weapon=${!!pcWeapon}`);
        else {
          const t0 = Date.now();
          const r = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          if (r.offer) await a1Roll(r.msg, r.offer); else await a1Damage(r.msg);
          const notice = await waitFor(() => hewNotices(t0, 'War Magic')[0] ?? null, 8000);
          ok('63a. War Magic: the attack posts the reminder "War Magic — … one of this Attack action\'s attacks may be a cantrip"', !!notice && /cantrip/.test(cardText(notice?.id)),
            `notice=${!!notice} card="${cardText(notice?.id).slice(0, 200)}"`);
          await ackHew('War Magic');
          await unlend(pcAttacker, warMagic);
        }
        // b. Shadow Step: the use writes the chip; a melee gate reads Advantage, a ranged one nothing
        if (!shadow || !pcWeapon) log.push(`§63b skipped: shadow=${!!shadow}`);
        else {
          await useFeature(pcToken, shadow, 'Shadow Step');
          const chip = await waitFor(() => pcAttacker.effects.find(e => e.getFlag(MOD, 'useKey') === 'shadowStep') ?? null, 6000);
          const g = await gateFor(pcToken, attackOf(pcAttacker, pcWeapon), victimToken);
          ok('63b. Shadow Step used: the chip on the monk; the next melee attack\'s gate "Shadow Step", Net Advantage', !!chip && /Shadow Step/.test(g.text) && (g.net === 'advantage'),
            `chip=${chip?.name ?? null} text="${g.text.slice(0, 160)}" net=${g.net}`);
          if (chip) await chip.delete().catch(() => {});
        }
        // c. Defensive Tactics on the Halfling: in a combat off the Attacker's turn its melee attack is an Opportunity Attack (Disadvantage);
        //    a hit writes the Multiattack Defense chip against the Attacker: its next gate at the Halfling reads −4
        if (!tactics) log.push('§63c skipped: no Defensive Tactics');
        else {
          [combat63] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          created.combats.push(combat63.id);
          await combat63.createEmbeddedDocuments('Combatant', [
            { tokenId: halflingToken.document.id, sceneId: scene.id, actorId: halfling.id, initiative: 20 },
            { tokenId: attackerToken.document.id, sceneId: scene.id, actorId: attacker.id, initiative: 10 }]);
          await combat63.startCombat(); await sleep(400);   // the Halfling's turn: the Attacker's attack is off its turn
          const g1 = await gateFor(attackerToken, act(), halflingToken);
          ok('63c. off the Attacker\'s turn: the gate lists "Defensive Tactics" (Escape the Horde, Disadvantage) with the counted caveat', /Defensive Tactics/.test(g1.text) && (g1.net === 'disadvantage'),
            `text="${g1.text.slice(0, 200)}" net=${g1.net}`);
          const hit = await swing({ d20: [19, 19] });
          await a1Damage(hit);
          const chip = await waitFor(() => halfling.effects.find(e => e.getFlag(MOD, 'useKey') === 'multiattackDefense') ?? null, 8000);
          const g2 = await gateFor(attackerToken, act(), halflingToken);
          ok('63d. the hit writes "Multiattack Defense — vs BTB Test Attacker" on the Halfling against the Attacker; the Attacker\'s next gate at it: "−4 to this attack roll"',
            !!chip && (chip.getFlag(MOD, 'against') === attacker.uuid) && /Multiattack Defense/.test(g2.text) && /−4 to this attack roll/.test(g2.text),
            `chip=${chip?.name ?? null} against=${chip?.getFlag(MOD, 'against')} text="${g2.text.slice(0, 220)}"`);
          const g3 = await gateFor(pcToken, attackOf(pcAttacker, pcWeapon), halflingToken);
          ok('63e. another attacker\'s gate at the Halfling shows no −4', !/−4 to this attack roll/.test(g3.text), `text="${g3.text.slice(0, 160)}"`);
          if (chip) await chip.delete().catch(() => {});
          await combat63.delete(); combat63 = null;
        }
        // f. Misty Escape: the Attacker damages the sorcerer — the rebuke's popup; Use casts Misty Step (no slot), then the Steps offered
        if (!misty || !step) log.push(`§63f skipped: misty=${!!misty} step=${!!step}`);
        else {
          await dropReactionChips(sorcerer);
          await sorcerer.update({ 'system.attributes.ac.override': 1, 'system.attributes.hp.max': 400, 'system.attributes.hp.value': 400, 'system.spells.spell2.value': 0, 'system.spells.pact.value': 0 });
          const sorcTok = canvas.tokens.get(sorcererDoc.id);
          attackerToken.control({ releaseOthers: true }); clearTargets(); sorcTok?.setTarget(true, { releaseOthers: true });
          await sleep(80);
          const t0 = Date.now();
          faces([[15, 20], [3, 6], [3, 6]]);
          const usage = await act().use({ subsequentActions: false }, { configure: false }, {});
          await act().rollAttack({}, { configure: false }, usage?.message?.id ? { data: { 'system.origin': usage.message.id } } : {});
          const card = await waitFor(() => b4Cards(t0, 'rebuke').find(m => m.getFlag(MOD, 'rebuke')?.actorUuid === sorcerer.uuid) ?? null, 12000);
          const pop = await waitFor(() => popups().find(app => /Misty Escape/.test(textOf(app.element)) && app.element?.querySelector?.('button[data-action^="use"]')) ?? null, 8000);
          CONFIG.Dice.randomUniform = realPRNG;
          ok('63f. the sorcerer damaged: the rebuke card and popup with Misty Escape (a self answer, no reach measured)',
            !!card && !!pop && (card.getFlag(MOD, 'rebuke')?.options ?? []).some(o => (o.name === 'Misty Escape') && (o.follow?.length === 2)),
            `card=${!!card} pop=${!!pop} options=${JSON.stringify(card?.getFlag(MOD, 'rebuke')?.options?.map(o => [o.name, o.cost, o.follow]) ?? null)}`);
          const useBtn = [...(pop?.element?.querySelectorAll?.('button[data-action^="use"]') ?? [])].find(b => /Misty Escape|Use/.test(textOf(b))) ?? pop?.element?.querySelector?.('button[data-action^="use"]');
          useBtn?.click();
          const stepCard = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'rebukeFor') === card?.id)) ?? null, 10000);
          await waitFor(() => card?.getFlag(MOD, 'rebuke')?.answer === 'use', 6000);
          await sleep(800);
          const buttons = [...(cardEl(card?.id)?.querySelectorAll?.('.bf-rebuke-line button') ?? [])].map(b => textOf(b));
          ok('63g. Use: Misty Step cast without a slot (the usage card names the rebuke), the rebuke card then offers "Disappearing Step" and "Dreadful Step"',
            !!stepCard && buttons.includes('Disappearing Step') && buttons.includes('Dreadful Step') && (Number(sorcerer.system.spells?.spell2?.value ?? 0) === 0),
            `stepCard=${!!stepCard} buttons=${JSON.stringify(buttons)} slots=${sorcerer.system.spells?.spell2?.value}`);
          clearTargets();
        }
        // h. Sculpt Spells: Fireball's cast window lists the free row; a Necromancy or non-wizard spell does not
        if (!sculpt || !fireball) log.push(`§63h skipped: sculpt=${!!sculpt} fireball=${!!fireball}`);
        else {
          await sorcerer.update({ 'system.spells.spell3.value': 2 });
          const fbAct = sorcerer.items.get(fireball.id)?.system?.activities?.contents?.[0] ?? null;
          const p = fbAct?.use({}, {}, {});
          const dlg = await waitFor(() => [...foundry.applications.instances.values()].find(app => app.rendered && app.element?.querySelector?.('[data-bf-metamagic-field]')) ?? null, 6000);
          await sleep(300);
          const rowText = textOf(dlg?.element?.querySelector('[data-bf-metamagic-row="sculpt"]'));
          const box = dlg?.element?.querySelector('[data-bf-metamagic-row="sculpt"] input[name="bf-metamagic-free"]');
          ok('63h. Fireball (a Wizard Evocation with a save): the cast window\'s free row "Sculpt Spells", tickable', !!dlg && /Sculpt Spells/.test(rowText) && !!box && !box.disabled,
            `dlg=${!!dlg} row="${rowText.slice(0, 120)}" box=${!!box} disabled=${box?.disabled}`);
          try { await dlg?.close(); } catch { /* gone */ }
          await Promise.resolve(p).catch(() => {});
        }
      } finally {
        await closeA1(); await closeOffers(); await hgClose(/Misty Escape/);
        if (combat63 && game.combats.get(combat63.id)) await combat63.delete();
        for (const it of [shadow, misty, step, sculpt, fireball, tactics]) {
          const owner = [pcAttacker, sorcerer, halfling].find(a => it && a.items.get(it.id));
          if (owner && it) await unlend(owner, it);
        }
        for (const a of [pcAttacker, halfling]) await dropEffects(a, a.effects.filter(e => e.getFlag(MOD, 'useKey')).map(e => e.id));
        await dropReactionChips(sorcerer); await dropEffects(pcAttacker, riderChits(pcAttacker));
        CONFIG.Dice.randomUniform = realPRNG; clearTargets(); await healFull();
      }
    }

    // ---- 94. Survivor: Heroic Rally at the turn start while Bloodied; Defy Death's 18 counts as a 20
    if (want(94)) {
      await closeA1(); await spendLuckC();
      const surv = await hgLend(halfling, 'Survivor', 'feat');
      let combat = null;
      try {
        if (!surv) log.push('§94 skipped: no Survivor');
        else {
          const con = Number(halfling.getRollData()?.abilities?.con?.mod ?? 0);
          await halfling.update({ 'system.attributes.hp.value': 150, 'system.attributes.hp.temp': 0 });   // of 400: Bloodied
          combat = await d1Combat([[halflingToken, halfling, 20]]);
          await combat.startCombat();
          await waitFor(() => hp() > 150, 8000);
          await sleep(300);
          ok('94a. Heroic Rally: the Bloodied Halfling\'s turn start heals 5 + Con (150 → 155 + Con), no ask', hp() === 155 + con, `hp=${hp()} con=${con}`);
          if (combat && game.combats.get(combat.id)) await combat.delete();
          combat = null;
          await halfling.update({ 'system.attributes.hp.value': 300 });
          await sleep(200);
          const t1 = Date.now();
          combat = await d1Combat([[halflingToken, halfling, 20]]);
          await combat.startCombat();
          await sleep(1500);
          ok('94b. not Bloodied (300 of 400): the turn start heals nothing', (hp() === 300) && !d1Cards(t1, 'turnGrant').some(m => m.getFlag(MOD, 'turnGrant')?.row === 'Heroic Rally'), `hp=${hp()}`);
          if (combat && game.combats.get(combat.id)) await combat.delete();
          combat = null;
          // b. Defy Death: an 18 on the Death Saving Throw counts as a 20 (the Advantage is the pack's: both dice 18).
          await halfling.update({ 'system.attributes.hp.value': 0, 'system.attributes.hp.temp': 0, 'system.attributes.death.success': 0, 'system.attributes.death.failure': 0 });
          faces([[18, 20], [18, 20]]);
          const rolls = await halfling.rollDeathSave({}, { configure: false }, {});
          CONFIG.Dice.randomUniform = realPRNG;
          const r0 = rolls?.[0];
          await waitFor(() => hp() >= 1, 6000);
          const line = (await waitFor(() => [...(cardEl(r0?.parent?.id)?.querySelectorAll?.('div') ?? [])].find(el => /counts as a 20/.test(el.textContent ?? '')), 5000))?.textContent?.trim() ?? '';
          ok('94c. Defy Death: an 18 on the Death Saving Throw is a critical success — 1 Hit Point back, the card "Survivor — the d20\'s 18 counts as a 20"',
            (r0?.isCritical === true) && (hp() === 1) && /Survivor — the d20's 18 counts as a 20/.test(line), `critical=${r0?.isCritical} threshold=${r0?.options?.criticalSuccess} hp=${hp()} line="${line}"`);
        }
      } finally {
        await closeA1();
        if (combat && game.combats.get(combat.id)) await combat.delete();
        await clearDown(halfling);
        await halfling.update({ 'system.attributes.death.success': 0, 'system.attributes.death.failure': 0 }).catch(() => {});
        if (surv) await unlend(halfling, surv);
        await healFull();
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 95. Improved War Magic: its reminder replaces War Magic's
    if (want(95)) {
      await closeA1(); await a1Victim(); await dropVictimFx();
      const wm = await hgLend(pcAttacker, 'War Magic', 'feat');
      const iwm = await hgLend(pcAttacker, 'Improved War Magic', 'feat');
      try {
        const wAct = pcWeapon ? attackOf(pcAttacker, pcWeapon) : null;
        if (!wm || !iwm || !wAct) log.push(`§95 skipped: wm=${!!wm} iwm=${!!iwm} weapon=${!!wAct}`);
        else {
          const t0 = Date.now();
          const r = await a1Hit(pcAttacker, pcToken, wAct);
          const notice = await waitFor(() => hewNotices(t0, 'Improved War Magic')[0] ?? null, 8000);
          await sleep(500);
          ok('95a. an attack by a fighter with both: the reminder "Improved War Magic — … can attack again" (two attacks for a level 1 or 2 spell), War Magic\'s not posted',
            !!notice && (hewNotices(t0, 'War Magic').length === 0) && /level 1 or 2/.test(cardText(notice?.id)), `notice=${!!notice} wm=${hewNotices(t0, 'War Magic').length} text="${cardText(notice?.id).slice(0, 200)}"`);
          await ackHew('Improved War Magic');
          if (r.offer) await a1Roll(r.msg, r.offer); else await a1Damage(r.msg);
        }
      } finally {
        await closeA1(); await closeOffers(); await dropVictimFx();
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [iwm, wm]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  }
} });

await finish({ tag: 'class-fighter', out, plan, f });
