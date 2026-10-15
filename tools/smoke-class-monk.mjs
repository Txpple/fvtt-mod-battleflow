// Classes smoke suite — Monk: the PHB classes plan's rows (audits/plans/session-0-classes.md) for
// the Monk, each section keeping its number and title. The fixtures, the lends, the
// helpers and the teardown are the classes kit's (tools/class-kit.mjs); everything written is restored.
import { announcePlan, connectSuite, finish, sectionPlan } from './harness.mjs';
import { runClassSuite } from './class-kit.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'hold/trigger.js',        // Deflect Attacks' hold (§16)
  'hold/lookup.js',         // the Halfling's own rescue (§16)
  'hold/answer.js',         // the deflection rolled (§16)
  'hold/views.js',          // the Deflect popup (§16)
  'hold/continue.js',       // the damage landed at 0 (§16)
  'hold/dice.js',           // the deflection's dice (§16)
  'hit-menu.js',            // the Focus group, Open Hand, Elemental Attunement (§28, §29, §31, §56, §97)
  'saves/consequences.js',  // Stunning Strike's success half (§28)
  'saves/demand.js',        // the save card's effect names by outcome (§28, §29)
  'd20-folds.js'            // Disciplined Survivor (§80)
];

const SECTIONS = {
  16: 'Deflect Attacks (lent to the Halfling, a Monk 3): a slashing/piercing/bludgeoning hit opens its popup; the answer rolls 1d10 + Dex + Monk level in the open, the damage lands at 0 and the damage card offers "Redirect" — used at the Attacker; a fire hit asks nothing; with Deflect Energy it asks',
  28: 'Stunning Strike and Hand of Harm (the Monk\'s Focus group): a Longsword hit offers neither; an Unarmed Strike both; Stunning Strike alone costs ONE point (its save\'s use), Stunned on a failure, Slowed on a success (and a Legendary Resistance flip of the failure swaps Stunned for Slowed); both ride one hit; in a combat the second hit greys Stunning Strike',
  29: 'Open Hand Technique: out of combat every Unarmed Strike offers Addle / Push / Topple; in a combat only after Flurry of Blows (its turn chit); one pick; Topple\'s failed save lands Prone; a Longsword hit none',
  31: 'Elemental Attunement: its own Elemental Strike only; "Push or pull — free"; the Strength save and the card\'s line',
  56: 'Physician\'s Touch (B4): Hand of Harm\'s ride also lands "Poisoned (Hand of Harm)" on the Victim; Hand of Healing at a Blinded Halfling asks to end Blinded — gone',
  80: 'Disciplined Survivor (C1, the Halfling with Monk\'s Focus): a failed save offers the reroll; accepted, a Focus Point spent',
  81: 'Perfect Focus (C1, the Halfling): under Uncanny Metabolism\'s No the Focus Points come back up to 4 on the same card; with Uncanny spent, its own card',
  97: "Elemental Epitome (D1, the PC Attacker a Monk 17): Empowered Strikes rides an Elemental Strike only while the attunement is active"
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'class-monk', watchdogMs: 900_000 });
announcePlan('class-monk', plan, pulled);

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
  const { MOD, a1Damage, a1Hit, a1Roll, a1Victim, a2Combat, act, answerDeflect, attackOf, attacker, b4Cards, cardEl, cardText, clearTargets, closeA1, closeDialogs, closeOffers, created, damageFor, deflectPopup, dropEffects, dropReactionChips, dropVictimFx, faces, grantCards, grantLine, groupText, halfling, halflingToken, hasStatus, healFull, hgClose, hgLend, hitBox, hitRow, hitRows, holdOf, hp, lend, lendUnarmed, lentBy, log, outcomeOn, pcAttacker, pcToken, pcWeapon, pickApply, pinHeal, pinPart, popups, realPRNG, riderBox, riderChits, riderRow, ridersOf, scene, set, settledSave, sleep, spendLuck, spendLuckC, statusOn, swing, textOf, tick, titled, typesOf, unlend, victim, victimFx, waitFor, weapon } = KIT;
  try {
    await KIT.leaveA3();

    // ---- 16. Deflect Attacks: rolled at the answer (Parry's path), the type judge, the Redirect at 0
    if (want(16)) {
      await closeDialogs(); await spendLuck(); await dropReactionChips(halfling);
      const BPS = ['bludgeoning', 'piercing', 'slashing'];
      const deflect = await lend(halfling, 'Deflect Attacks');
      const reduceAct = [...(deflect.system.activities ?? [])].find(a => a.name?.toLowerCase() === 'reduce')
        ?? [...(deflect.system.activities ?? [])].find(a => (a.type === 'heal') && !a._source?.name) ?? null;
      const redirectAct = [...(deflect.system.activities ?? [])].find(a => a.name === 'Redirect') ?? null;
      const h = reduceAct?.healing;
      const packFormula = h ? (h.custom?.enabled ? h.custom.formula : `${h.number}d${h.denomination}${h.bonus ? ` + ${h.bonus}` : ''}`) : '';
      // "Monk level": the Halfling is a Rogue 3 — a bare Monk class (3 levels) so @classes.monk.levels resolves.
      // UNSURE: a bare class item made by createEmbeddedDocuments (no advancement) is enough for the roll data.
      let monk = null;
      if (/monk/i.test(packFormula) && !halfling.getRollData()?.classes?.monk) {
        [monk] = await halfling.createEmbeddedDocuments('Item', [{ name: 'Monk', type: 'class',
          system: { identifier: 'monk', levels: 3, hd: { denomination: 'd8' } } }]);
        lentBy.set(halfling, [...(lentBy.get(halfling) ?? []), monk.id]);
      }
      // The Redirect's cost: Focus Points. UNSURE: the Redirect's consumption targets the Monk's Focus item.
      let focus = null;
      try { focus = await hgLend(halfling, "Monk's Focus", 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 }); }
      catch (err) { log.push(`§16: no Monk's Focus lent (${err?.message})`); }
      const w = attacker.items.get(weapon.id);
      const priorTypes = [...(w.system._source.damage?.base?.types ?? [])];
      try {
        // (a) a slashing / piercing / bludgeoning hit — the goblin's own weapon
        const dealt = [...new Set([...(act().damage?.parts ?? []).flatMap(p => [...(p.types ?? [])]),
          ...((act().damage?.includeBase !== false) ? [...(w.system.damage?.base?.types ?? [])] : [])])];
        const msg = await swing({ d20: [12], dmg: 1 });
        const pop = await waitFor(deflectPopup, 6000);
        const t0 = holdOf(msg)?.targets?.find(x => x.uuid === halfling.uuid);
        ok('16a. a B/P/S hit is held for Deflect Attacks as a DAMAGE reduction with the pack\'s formula; the Halfling\'s popup lists it ("reduces the damage")',
          dealt.some(x => BPS.includes(x)) && !!pop && (t0?.reaction === 'Deflect Attacks') && (t0?.kind === 'damage') && !!t0?.reduce?.formula
            && /Deflect Attacks/.test(textOf(pop?.element)),
          `dealt=${dealt} formula="${t0?.reduce?.formula}" pack="${packFormula}" pop="${textOf(pop?.element).slice(0, 200)}"`);
        // ⚠ The hit's damage is rolled while the hold waits: let it land on swing's pinned 1 before the d10 is pinned
        // (a cold server rolled it AFTER this pin — the d8 took the 10, the d10 the 1).
        await waitFor(() => damageFor(msg?.id), 8000);
        const since = Date.now();
        faces([[10, 10], [1, 6]]);   // the d10 at 10; the damage die after it at 1 — the damage lands at 0
        await answerDeflect(pop);
        const resolved = await waitFor(() => (holdOf(msg)?.status === 'resolved') ? holdOf(msg) : null, 12000);
        const rt = resolved?.targets?.find(x => x.uuid === halfling.uuid);
        const dieMsg = game.messages.contents.filter(m => (m.timestamp >= since) && /Deflect Attacks — the die/.test(m.flavor ?? '')).at(-1);
        const rd = halfling.getRollData();
        const monkLevel = Number(rd?.classes?.monk?.levels ?? 0);
        const dexMod = Number(rd?.abilities?.dex?.mod ?? 0);
        // UNSURE: the pack formula is 1d10 + @abilities.dex.mod + @classes.monk.levels (read off the row's `by`).
        const expected = 10 + dexMod + monkLevel;
        ok(`16b. the answer rolls the reduction IN THE OPEN: 1d10 (10) + Dex (${dexMod}) + Monk level (${monkLevel}) = ${expected}, riding the hold`,
          (rt?.answer === 'cast') && (Number(rt?.reduceBy) === expected) && !!dieMsg && (dieMsg.rolls?.[0]?.total === rt?.reduceBy),
          `reduceBy=${rt?.reduceBy} die=${dieMsg?.rolls?.[0]?.formula}=${dieMsg?.rolls?.[0]?.total} formula="${rt?.reduce?.formula}"`);
        const dmg = await waitFor(() => { const m = damageFor(msg?.id); return m?.getFlag(MOD, 'receipt') ? m : null; }, 12000);
        const receipt = dmg?.getFlag(MOD, 'receipt')?.targets?.find(x => x.uuid === halfling.uuid);
        const full = (dmg?.rolls ?? []).reduce((n, r) => n + Number(r.total ?? 0), 0);
        ok('16c. the damage lands at 0 through the receipt ("Deflect Attacks — reduced by"); the Halfling untouched',
          !!receipt && (Number(receipt.taken) === 0) && /Deflect Attacks — reduced by/.test(receipt.note ?? '') && (hp() === 400),
          `full=${full} taken=${receipt?.taken} note="${receipt?.note}" hp=${hp()}`);
        // The Redirect at 0 (views.js `atZero`): on the DAMAGE card, the defender's client.
        const redirectBtn = await waitFor(() => [...(cardEl(dmg?.id)?.querySelectorAll?.('button') ?? [])].find(b => b.textContent.trim() === 'Redirect'), 6000);
        ok('16d. the damage card offers "Redirect — at the attacker?" with a Redirect button',
          !!redirectBtn && /Redirect — at the attacker\?/.test(cardText(dmg?.id)) && /Deflect Attacks — the damage is 0/.test(cardText(dmg?.id)),
          `button=${!!redirectBtn} redirectActivity=${!!redirectAct} card="${cardText(dmg?.id).slice(-240)}"`);
        const focusBefore = Number(focus ? (halfling.items.get(focus.id)?.system?.uses?.spent ?? 0) : 0);
        const since2 = Date.now();
        redirectBtn?.click();
        const card = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= since2)
          && (m.getAssociatedActivity?.()?.id === redirectAct?.id)), 10000);
        const atZero = game.messages.get(dmg?.id)?.getFlag(MOD, 'atZero')?.[halfling.id] ?? null;
        const cardTargets = card?.system?.targets ?? [];
        const demanded = card?.getFlag(MOD, 'saves')?.targets ?? [];
        // UNSURE: `withTargets` around `use()` lands the attacker on the save card (dnd5e targets, or the module's save demand).
        ok('16e. Redirect used once, AT the Attacker: the damage card records it, the Redirect save card names the Attacker',
          (atZero?.activity === 'Redirect') && !!card
            && ((cardTargets.some?.(x => (x.actor ?? x.uuid) === attacker.uuid)) || demanded.some?.(x => x.uuid === attacker.uuid)),
          `atZero=${JSON.stringify(atZero)} card=${!!card} targets=${JSON.stringify(cardTargets)} demand=${JSON.stringify(demanded.map?.(x => x.name) ?? null)} consumption=${JSON.stringify(redirectAct?.consumption?.targets?.map?.(c => [c.type, c.target]) ?? null)}`);
        // UNSURE: the Redirect's cost is 1 Focus Point off Monk's Focus (the pack's own consumption).
        ok('16f. the Redirect\'s own cost is paid (a Focus Point); the button is gone (once per card)',
          (!focus || (Number(halfling.items.get(focus.id)?.system?.uses?.spent ?? 0) === focusBefore + 1))
            && ![...(cardEl(dmg?.id)?.querySelectorAll?.('button') ?? [])].some(b => b.textContent.trim() === 'Redirect'),
          `focus ${focusBefore}→${focus ? halfling.items.get(focus.id)?.system?.uses?.spent : 'none'}`);
        await sleep(800);
        await closeDialogs();
        for (const app of popups()) if (/Redirect/.test(textOf(app.element))) { try { await app.close(); } catch { /* gone */ } }

        // (b) a FIRE hit asks nothing — the type judge (the weapon's base types flipped for the section)
        const partTypes = (act().damage?.parts ?? []).flatMap(p => [...(p.types ?? [])]);
        if (partTypes.some(x => BPS.includes(x))) log.push(`§16g/h skipped: the attacker's activity carries its own B/P/S parts (${partTypes})`);
        else {
          await w.update({ 'system.damage.base.types': ['fire'] });
          await spendLuck();
          const msg2 = await swing({ d20: [12] });
          await sleep(1200);
          await waitFor(() => hp() < 400, 6000);
          ok('16g. a fire hit asks nothing: no hold, no popup, the damage lands', !holdOf(msg2) && !deflectPopup() && (hp() < 400),
            `hold=${JSON.stringify(holdOf(msg2)?.targets?.map?.(x => x.reaction) ?? null)} hp=${hp()} dealt=${JSON.stringify(attacker.items.get(weapon.id)?.system?.damage?.base?.types ?? null)}`);
          // (c) Deflect Energy lifts the judge
          const energy = await lend(halfling, 'Deflect Energy');
          try {
            const msg3 = await swing({ d20: [12] });
            const pop3 = await waitFor(deflectPopup, 6000);
            ok('16h. with Deflect Energy the fire hit is held for Deflect Attacks', !!pop3 && (holdOf(msg3)?.targets?.[0]?.reaction === 'Deflect Attacks'),
              `pop=${!!pop3} reaction=${holdOf(msg3)?.targets?.[0]?.reaction}`);
            pickApply(pop3, 'pass');
            await waitFor(() => (holdOf(msg3)?.status === 'resolved'), 10000);
          } finally { await closeDialogs(); await unlend(halfling, energy); }
        }
      } finally {
        await attacker.items.get(weapon.id)?.update({ 'system.damage.base.types': priorTypes }).catch(() => {});
        await closeDialogs();
        for (const app of popups()) if (/Redirect|Deflect Attacks/.test(textOf(app.element))) { try { await app.close(); } catch { /* gone */ } }
        await dropReactionChips(halfling);
        if (focus) await unlend(halfling, focus);
        if (monk) await unlend(halfling, monk);
        await unlend(halfling, deflect);
        await healFull();
      }
    }
    KIT.markA2();

    // ---- 28. Stunning Strike and Hand of Harm: the Monk's Focus group
    if (want(28)) {
      await closeDialogs(); await a1Victim(); await set('saveRolls', 'auto');
      const focus = await hgLend(pcAttacker, "Monk's Focus", 'feat', { 'system.uses.max': '5', 'system.uses.spent': 0 });
      const stun = await hgLend(pcAttacker, 'Stunning Strike', 'feat');
      const hoh = await hgLend(pcAttacker, 'Hand of Harm', 'feat');
      const us = await lendUnarmed();
      let combat28 = null;
      try {
        if (!focus || !stun || !hoh || !us || !pcWeapon) log.push(`§28 skipped: focus=${!!focus} stun=${!!stun} hoh=${!!hoh} unarmed=${!!us} weapon=${!!pcWeapon}`);
        else {
          await pinPart(hoh, hoh.system.activities.find(a => a.type === 'damage'), '1d8 + @abilities.wis.mod');
          const spent = () => Number(pcAttacker.items.get(focus.id)?.system?.uses?.spent ?? 0);
          const usAct = () => pcAttacker.items.get(us.id).system.activities.find(a => a.type === 'attack');
          const fx = () => victimFx().map(e => e.name);

          const r0 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('28a. a Longsword hit (a Martial weapon without Light): neither Stunning Strike nor Hand of Harm',
            !hitBox(r0.offer, 'stunning-strike') && !hitBox(r0.offer, 'hand-of-harm'), `offer=${!!r0.offer} rows=${hitRows(r0.offer)}`);
          if (r0.offer) await a1Roll(r0.msg, r0.offer); else await a1Damage(r0.msg);

          const t1 = Date.now();
          const r1 = await a1Hit(pcAttacker, pcToken, usAct());
          ok('28b. an Unarmed Strike hit: the group "Monk\'s Focus · 5 Focus Points left", "Stunning Strike — 1 Focus Point", "Hand of Harm — 1d8 + N necrotic · 1 Focus Point"',
            !!hitBox(r1.offer, 'stunning-strike') && !!hitBox(r1.offer, 'hand-of-harm') && /5 Focus Points left/.test(groupText(r1.offer, 'monks-focus'))
              && /1 Focus Point/.test(hitRow(r1.offer, 'stunning-strike')) && /1d8 \+ -?\d+ necrotic · 1 Focus Point/.test(hitRow(r1.offer, 'hand-of-harm')),
            `group="${groupText(r1.offer, 'monks-focus').slice(0, 200)}"`);
          await tick(r1.offer, 'stunning-strike');
          faces([[1, 20]]);   // every die a 1: the save fails
          await a1Roll(r1.msg, r1.offer);
          const c1 = await settledSave('stunning-strike', t1);
          await waitFor(() => fx().includes('Stunned'), 6000); await sleep(600);
          ok('28c. Stunning Strike, the save failed: Stunned lands, Slowed does not; ONE Focus Point spent (the save\'s own use is the cost)',
            (outcomeOn(c1) === 'failed') && fx().includes('Stunned') && !fx().includes('Slowed') && (spent() === 1),
            `outcome=${outcomeOn(c1)} fx=${JSON.stringify(fx())} spent=${spent()}`);
          // The legendary-resistance flip (2026-09-30): the failure unwinds AND the success half lands.
          if (typeof victim.system.resistSave !== 'function') log.push('28c-lr skipped: BTB Test Victim is not NPC-typed');
          else {
            const priorLR = { max: victim.system.resources?.legres?.max ?? 0, spent: victim.system.resources?.legres?.spent ?? 0 };
            await victim.update({ 'system.resources.legres.max': 1, 'system.resources.legres.spent': 0 });
            const e1 = c1.getFlag(MOD, 'saves')?.targets?.find(t => t.uuid === victim.uuid);
            const rollMsg = game.messages.get(e1?.rollMessageId);
            if (rollMsg) await victim.system.resistSave(rollMsg);
            await waitFor(() => (outcomeOn(c1) === 'saved') && fx().includes('Slowed') && !fx().includes('Stunned'), 8000); await sleep(400);
            ok('28c-lr. Legendary Resistance flips the failure: Stunned unwinds, Slowed (the success half) lands',
              (outcomeOn(c1) === 'saved') && fx().includes('Slowed') && !fx().includes('Stunned'),
              `outcome=${outcomeOn(c1)} fx=${JSON.stringify(fx())} roll=${!!rollMsg}`);
            await victim.update({ 'system.resources.legres.max': priorLR.max, 'system.resources.legres.spent': priorLR.spent });
          }
          await dropVictimFx();

          const t2 = Date.now();
          const r2 = await a1Hit(pcAttacker, pcToken, usAct());
          await tick(r2.offer, 'stunning-strike');
          faces([[20, 20]]);   // every die a 20: the save succeeds
          await a1Roll(r2.msg, r2.offer);
          const c2 = await settledSave('stunning-strike', t2);
          await waitFor(() => fx().includes('Slowed'), 6000); await sleep(600);
          ok('28d. the save succeeded: Slowed lands (the success half — the pack marks it failure-only), Stunned does not; a second point spent',
            (outcomeOn(c2) === 'saved') && fx().includes('Slowed') && !fx().includes('Stunned') && (spent() === 2),
            `outcome=${outcomeOn(c2)} fx=${JSON.stringify(fx())} spent=${spent()} names=${JSON.stringify(c2?.getFlag(MOD, 'saves')?.effectNames ?? null)}`);
          await dropVictimFx();

          const t3 = Date.now();
          const r3 = await a1Hit(pcAttacker, pcToken, usAct());
          await tick(r3.offer, 'stunning-strike', 'hand-of-harm');
          const both = !!hitBox(r3.offer, 'stunning-strike')?.checked && !!hitBox(r3.offer, 'hand-of-harm')?.checked;
          faces([[1, 20]]);
          const d3 = await a1Roll(r3.msg, r3.offer);
          await settledSave('stunning-strike', t3); await sleep(800);
          ok('28e. both ride one hit (the group\'s two picks): the necrotic die on the roll, two more Focus Points',
            both && typesOf(d3).includes('necrotic') && (spent() === 4),
            `both=${both} types=${JSON.stringify(typesOf(d3))} spent=${spent()} picks=${JSON.stringify((d3?.getFlag(MOD, 'hitManeuver')?.picks ?? []).map(p => p.key))}`);
          await dropVictimFx();

          await pcAttacker.items.get(focus.id).update({ 'system.uses.spent': 0 });
          combat28 = await a2Combat();
          const t4 = Date.now();
          const r4 = await a1Hit(pcAttacker, pcToken, usAct());
          await tick(r4.offer, 'stunning-strike');
          faces([[1, 20]]);
          await a1Roll(r4.msg, r4.offer);
          await settledSave('stunning-strike', t4); await sleep(800);
          const chit = pcAttacker.effects.find(e => e.getFlag(MOD, 'riderKey') === 'stunning-strike') ?? null;
          const r5 = await a1Hit(pcAttacker, pcToken, usAct());
          ok('28f. in a combat, the second hit this turn: Stunning Strike greyed "used this turn" (its chit), Hand of Harm still offered',
            !!chit && /used this turn/.test(hitRow(r5.offer, 'stunning-strike')) && (hitBox(r5.offer, 'stunning-strike')?.disabled === true) && (hitBox(r5.offer, 'hand-of-harm')?.disabled === false),
            `chit=${chit?.name ?? null} row="${hitRow(r5.offer, 'stunning-strike').slice(0, 80)}"`);
          if (r5.offer) await a1Roll(r5.msg, r5.offer);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        if (combat28 && game.combats.get(combat28.id)) await combat28.delete();
        await sleep(800);   // the last save's effect lands after its card
        await dropVictimFx();
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [us, hoh, stun, focus]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ---- 29. Open Hand Technique: after Flurry of Blows, one free pick
    if (want(29)) {
      await closeDialogs(); await a1Victim(); await set('saveRolls', 'auto'); await dropVictimFx();
      const focus = await hgLend(pcAttacker, "Monk's Focus", 'feat', { 'system.uses.max': '5', 'system.uses.spent': 0 });
      const oht = await hgLend(pcAttacker, 'Open Hand Technique', 'feat');
      const us = await lendUnarmed();
      let combat29 = null;
      try {
        if (!focus || !oht || !us || !pcWeapon) log.push(`§29 skipped: focus=${!!focus} oht=${!!oht} unarmed=${!!us}`);
        else {
          const usAct = () => pcAttacker.items.get(us.id).system.activities.find(a => a.type === 'attack');
          const OHT = ['open-hand-addle', 'open-hand-push', 'open-hand-topple'];
          const r0 = await a1Hit(pcAttacker, pcToken, usAct());
          ok('29a. out of combat (no turn to read the Flurry in): an Unarmed Strike offers Addle / Push / Topple, the group "free"',
            OHT.every(k => !!hitBox(r0.offer, k)) && /free/.test(groupText(r0.offer, 'open-hand-technique')),
            `rows=${hitRows(r0.offer)} group="${groupText(r0.offer, 'open-hand-technique').slice(0, 120)}"`);
          if (r0.offer) await a1Roll(r0.msg, r0.offer);

          combat29 = await a2Combat();
          const r1 = await a1Hit(pcAttacker, pcToken, usAct());
          ok('29b. in a combat, no Flurry of Blows this turn: none', !OHT.some(k => hitBox(r1.offer, k)), `rows=${hitRows(r1.offer)}`);
          if (r1.offer) await a1Roll(r1.msg, r1.offer); else await a1Damage(r1.msg);

          const flurry = pcAttacker.items.get(focus.id).system.activities.find(a => a.name === 'Flurry of Blows');
          await flurry?.use({ consume: { resources: false, action: false, spellSlot: false }, subsequentActions: false }, { configure: false }, {});
          const chit = await waitFor(() => pcAttacker.effects.find(e => e.getFlag(MOD, 'riderKey') === 'flurry-of-blows') ?? null, 6000);
          const t2 = Date.now();
          const r2 = await a1Hit(pcAttacker, pcToken, usAct());
          ok('29c. Flurry of Blows used: its turn chit; the next Unarmed Strike offers the three, one pick',
            !!chit && OHT.every(k => !!hitBox(r2.offer, k)), `chit=${chit?.name ?? null} rows=${hitRows(r2.offer)}`);
          await tick(r2.offer, 'open-hand-push', 'open-hand-topple');
          const one = !hitBox(r2.offer, 'open-hand-push')?.checked && !!hitBox(r2.offer, 'open-hand-topple')?.checked;
          faces([[1, 20]]);
          await a1Roll(r2.msg, r2.offer);
          const c2 = await settledSave('open-hand-topple', t2);
          await waitFor(() => victim.statuses?.has?.('prone'), 6000); await sleep(400);
          ok('29d. one pick (Topple gave Push way); the Dexterity save failed: Toppled — the target Prone',
            one && (outcomeOn(c2) === 'failed') && !!victim.statuses?.has?.('prone'),
            `one=${one} outcome=${outcomeOn(c2)} fx=${JSON.stringify(victimFx().map(e => e.name))}`);
          await dropVictimFx();

          const r3 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('29e. a Longsword hit after the Flurry: none (an Unarmed Strike only)', !OHT.some(k => hitBox(r3.offer, k)), `rows=${hitRows(r3.offer)}`);
          if (r3.offer) await a1Roll(r3.msg, r3.offer); else await a1Damage(r3.msg);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        if (combat29 && game.combats.get(combat29.id)) await combat29.delete();
        await dropVictimFx();
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [us, oht, focus]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ---- 31. Elemental Attunement: its own Elemental Strike, the push or pull
    if (want(31)) {
      await closeDialogs(); await a1Victim(); await set('saveRolls', 'auto');
      const focus = await hgLend(pcAttacker, "Monk's Focus", 'feat', { 'system.uses.max': '5', 'system.uses.spent': 0 });
      const ea = await hgLend(pcAttacker, 'Elemental Attunement', 'feat');
      try {
        // Elemental Strike and Elemental Save are the enchantment's RIDERS: hidden until "Active Attunement" is applied
        // to the item (a use with configure false applies nothing — §23's shape).
        const attune = ea?.system?.activities?.find(a => a.type === 'enchant');
        const attuned = attune ? await attune.use({ subsequentActions: false }, { configure: false }, {}) : null;
        try { await attune?.applyEnchantment(attune.effects?.[0]?._id ?? null, pcAttacker.items.get(ea.id), { chatMessage: attuned?.message ?? null, strict: false }); }
        catch (err) { log.push(`§31 applyEnchantment threw: ${err?.message}`); }
        const strike = await waitFor(() => pcAttacker.items.get(ea?.id)?.system?.activities?.find(a => (a.name === 'Elemental Strike') && a.canUse) ?? null, 6000);
        if (!ea || !strike || !pcWeapon) log.push(`§31 skipped: ea=${!!ea} strike=${!!strike} (usable after the attunement) enchantments=${JSON.stringify(pcAttacker.items.get(ea?.id)?.effects?.map(e => [e.name, e.type, e.isAppliedEnchantment ?? null]) ?? null)}`);
        else {
          await pinPart(ea, strike, '1d8 + @mod');
          const r0 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('31a. a Longsword hit: no Elemental Attunement row (its own Elemental Strike only)', !hitBox(r0.offer, 'elemental-attunement'), `rows=${hitRows(r0.offer)}`);
          if (r0.offer) await a1Roll(r0.msg, r0.offer); else await a1Damage(r0.msg);
          const t1 = Date.now();
          const r1 = await a1Hit(pcAttacker, pcToken, pcAttacker.items.get(ea.id).system.activities.find(a => a.name === 'Elemental Strike'));
          ok('31b. an Elemental Strike hit: "Push or pull — free"', !!hitBox(r1.offer, 'elemental-attunement') && /Push or pull/.test(hitRow(r1.offer, 'elemental-attunement')) && /free/.test(hitRow(r1.offer, 'elemental-attunement')),
            `row="${hitRow(r1.offer, 'elemental-attunement')}"`);
          await tick(r1.offer, 'elemental-attunement');
          faces([[1, 20]]);
          await a1Roll(r1.msg, r1.offer);
          const c1 = await settledSave('elemental-attunement', t1);
          await sleep(600);
          ok('31c. the Strength save, failed; the card says the table moves the token (pushed or pulled up to 10 feet)',
            (outcomeOn(c1) === 'failed') && /pushed or pulled up to 10 feet/.test(cardText(c1?.id)),
            `outcome=${outcomeOn(c1)} card="${cardText(c1?.id).slice(0, 220)}" acts=${JSON.stringify([...pcAttacker.items.get(ea.id).system.activities].map(a => [a.name, a.canUse, a.isRider, a.isHidden]))} riders=${JSON.stringify(pcAttacker.items.get(ea.id).flags?.dnd5e?.riders ?? null)}`);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        if (ea) await unlend(pcAttacker, ea);
        if (focus) await unlend(pcAttacker, focus);
        CONFIG.Dice.randomUniform = realPRNG;
      }
    }

    // ---- 56. Physician's Touch: Hand of Harm's ride lands Poisoned; Hand of Healing offers to end a condition on the healed
    if (want(56)) {
      await closeDialogs(); await a1Victim(); await set('saveRolls', 'auto');
      const focus = await hgLend(pcAttacker, "Monk's Focus", 'feat', { 'system.uses.max': '5', 'system.uses.spent': 0 });
      const hoh = await hgLend(pcAttacker, 'Hand of Harm', 'feat');
      const touch = await hgLend(pcAttacker, "Physician's Touch", 'feat');
      const healing = await hgLend(pcAttacker, 'Hand of Healing', 'feat');
      const us = await lendUnarmed();
      try {
        if (!focus || !hoh || !touch || !healing || !us) log.push(`§56 skipped: focus=${!!focus} hoh=${!!hoh} touch=${!!touch} healing=${!!healing} unarmed=${!!us}`);
        else {
          await pinPart(hoh, hoh.system.activities.find(a => a.type === 'damage'), '1d8 + @abilities.wis.mod');
          const usAct = () => pcAttacker.items.get(us.id).system.activities.find(a => a.type === 'attack');
          const r1 = await a1Hit(pcAttacker, pcToken, usAct());
          await tick(r1.offer, 'hand-of-harm');
          const d1 = await a1Roll(r1.msg, r1.offer);
          const poisoned = await waitFor(() => victimFx().find(e => /Poisoned/.test(e.name)) ?? null, 8000);
          ok('56a. Hand of Harm with Physician\'s Touch on the sheet: the necrotic die rides AND "Poisoned (Hand of Harm)" lands on the Victim',
            typesOf(d1).includes('necrotic') && !!poisoned && (d1?.getFlag(MOD, 'hitManeuver')?.picks?.[0]?.also?.feature === "Physician's Touch"),
            `types=${JSON.stringify(typesOf(d1))} fx=${JSON.stringify(victimFx().map(e => e.name))} pick=${JSON.stringify(d1?.getFlag(MOD, 'hitManeuver')?.picks?.[0]?.also ?? null)}`);
          await dropVictimFx();
          // b. Hand of Healing at the Halfling (Blinded): the offer to end it
          await statusOn(halfling, 'blinded', true);
          const healAct = pcAttacker.items.get(healing.id).system.activities.find(a => a.type === 'heal');
          await pinHeal(healing, healAct.name, '1d8 + 3');
          pcToken.control({ releaseOthers: true }); clearTargets(); halflingToken.setTarget(true, { releaseOthers: true });
          await sleep(100);
          const t0 = Date.now();
          faces([[4, 8]]);
          await healAct.use({ subsequentActions: false }, { configure: false }, {});
          CONFIG.Dice.randomUniform = realPRNG;
          const endCard = await waitFor(() => b4Cards(t0, 'conditionEnd').find(m => m.getFlag(MOD, 'conditionEnd')?.row === "Physician's Touch") ?? null, 8000);
          const pop = await waitFor(() => titled(/^Physician's Touch — /), 6000);
          ok('56b. Hand of Healing at the Halfling: the popup "End a condition on BTB Test Halfling?" listing Blinded',
            !!endCard && !!pop && /Blinded/.test(textOf(pop?.element)) && (endCard?.getFlag(MOD, 'conditionEnd')?.bearerUuid === halfling.uuid),
            `card=${!!endCard} pop=${!!pop} text="${textOf(pop?.element).slice(0, 200)}"`);
          pop?.element?.querySelector('button[data-action="blinded"]')?.click();
          const done = await waitFor(() => endCard?.getFlag(MOD, 'conditionEnd')?.applied ? endCard.getFlag(MOD, 'conditionEnd') : null, 12000);
          await sleep(600);
          ok('56c. End Blinded: gone from the Halfling', (done?.ended === 'blinded') && !hasStatus(halfling, 'blinded'), `flag=${JSON.stringify(done && { ended: done.ended, gone: done.gone })} blinded=${hasStatus(halfling, 'blinded')}`);
        }
      } finally {
        await closeOffers(); await closeDialogs(); await hgClose(/^Physician's Touch — /);
        if (hasStatus(halfling, 'blinded')) await statusOn(halfling, 'blinded', false);
        await dropVictimFx(); await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [focus, hoh, touch, healing, us]) if (it && pcAttacker.items.get(it.id)) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets(); await healFull();
      }
    }

    // ---- 80. Disciplined Survivor: the reroll paid from the Focus Points
    if (want(80)) {
      await closeA1(); await spendLuckC();
      const focus = await hgLend(halfling, "Monk's Focus", 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 });
      const ds = await hgLend(halfling, 'Disciplined Survivor', 'feat');
      try {
        if (!focus || !ds) log.push(`§80 skipped: focus=${!!focus} survivor=${!!ds}`);
        else {
          const priorDialogs = new Set([...document.querySelectorAll('.application')].map(el => el.id));
          faces([[3, 20]]);
          const rolls = await halfling.rollSavingThrow({ ability: 'wis' }, { configure: false }, {});
          const m = rolls?.[0]?.parent ?? null;
          const base = Number(rolls?.[0]?.total);
          const flag = await waitFor(() => m?.getFlag(MOD, 'd20fold') ?? null, 5000);
          const offer = (flag?.offers ?? []).find(o => o.kind === 'reroll') ?? null;
          ok('80a. a failed save from the sheet offers Disciplined Survivor: the `reroll` kind, no bonus, a Focus Point', !!offer && (offer.label === 'Disciplined Survivor') && (Number(offer.bonus) === 0),
            `offers=${JSON.stringify(flag?.offers ?? null)}`);
          const popup = await waitFor(() => [...document.querySelectorAll('.application')].find(el => (el.tagName === 'DIALOG') && !priorDialogs.has(el.id) && !!el.querySelector('[data-bf-rescue-action="reroll"]')) ?? null, 8000);
          faces([[14, 20]]);
          popup?.querySelector('[data-bf-rescue-action="reroll"]')?.click();
          const done = await waitFor(() => { const cur = m?.getFlag(MOD, 'd20fold'); return (cur?.spends?.length && !cur.spends.some(sp => sp.pendingVerdict)) ? cur : null; }, 20000);
          CONFIG.Dice.randomUniform = realPRNG;
          const spent = Number(halfling.items.get(focus.id)?.system?.uses?.spent ?? NaN);
          ok('80b. pressed: the d20 rerolled (14), the total 14 + mod, a Focus Point spent', (done?.spends?.[0]?.kind === 'reroll') && (Number(done?.spends?.[0]?.reroll?.total) === 14 + (base - 3)) && (spent === 1),
            `base=${base} spends=${JSON.stringify(done?.spends ?? null)} focusSpent=${spent}`);
        }
      } finally {
        await closeA1();
        [...document.querySelectorAll('.application')].filter(el => (el.tagName === 'DIALOG') && (!!el.querySelector('button[data-action="pass"]') || !!el.querySelector('input[value="pass"]'))).forEach(el => { const r = el.querySelector('input[value="pass"]'); if (r) { r.checked = true; el.querySelector('button[data-action="answer"]')?.click(); } else el.querySelector('button[data-action="pass"]')?.click(); });
        for (const it of [ds, focus]) if (it) await unlend(halfling, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 81. Perfect Focus: up to 4 at Initiative — under Uncanny Metabolism's No, and on its own
    if (want(81)) {
      await closeA1();
      const focus = await hgLend(halfling, "Monk's Focus", 'feat', { 'system.uses.max': '5', 'system.uses.spent': 3 });
      const perfect = await hgLend(halfling, 'Perfect Focus', 'feat');
      const uncanny = await hgLend(halfling, 'Uncanny Metabolism', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 0 });
      if (uncanny) await pinHeal(uncanny, 'Uncanny Metabolism', '1d8 + 5');
      const [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
      created.combats.push(combat.id);
      const focusValue = () => Number(halfling.items.get(focus?.id)?.system?.uses?.value ?? NaN);
      try {
        if (!focus || !perfect || !uncanny) log.push(`§81 skipped: focus=${!!focus} perfect=${!!perfect} uncanny=${!!uncanny}`);
        else {
          await combat.createEmbeddedDocuments('Combatant', [{ tokenId: halflingToken.document.id, sceneId: scene.id, actorId: halfling.id }]);
          const hC = combat.combatants.find(c => c.actorId === halfling.id);
          // This section's cards only: in a full run §37 posted the Halfling's Uncanny Metabolism cards first.
          const t81 = Date.now();
          await combat.setInitiative(hC.id, 12);
          const um = await waitFor(() => grantCards(halfling, 'Uncanny Metabolism').find(m => m.timestamp >= t81) ?? null, 8000);
          const pop = await waitFor(() => titled(/^Uncanny Metabolism — /), 6000);
          ok('81a. at Initiative Uncanny Metabolism asks; Perfect Focus rides its card as the fallback, no card of its own', !!um && !!pop && (um.getFlag(MOD, 'initiativeGrant')?.fallback?.row === 'Perfect Focus') && (grantCards(halfling, 'Perfect Focus').filter(m => m.timestamp >= t81).length === 0),
            `um=${!!um} fallback=${JSON.stringify(um?.getFlag(MOD, 'initiativeGrant')?.fallback ?? null)} own=${grantCards(halfling, 'Perfect Focus').filter(m => m.timestamp >= t81).length}`);
          pop?.element?.querySelector('button[data-action="no"]')?.click();
          const done = await waitFor(() => um?.getFlag(MOD, 'initiativeGrant')?.fallbackApplied ? um : null, 10000);
          await sleep(400);
          ok('81b. No: the Focus Points come back up to 4 (2 → 4), Uncanny kept, the line says both', (focusValue() === 4) && (Number(halfling.items.get(uncanny.id)?.system?.uses?.spent) === 0) && /Perfect Focus — Focus Points back up to 4/.test(await grantLine(done)),
            `focus=${focusValue()} uncanny=${halfling.items.get(uncanny.id)?.system?.uses?.spent} line="${await grantLine(done)}"`);
          // its own card: Uncanny spent
          await uncanny.update({ 'system.uses.spent': 1 });
          await focus.update({ 'system.uses.spent': 3 });
          await combat.resetAll(); await sleep(600);
          await combat.setInitiative(hC.id, 11);
          const pf = await waitFor(() => grantCards(halfling, 'Perfect Focus').find(m => (m.timestamp >= t81) && m.getFlag(MOD, 'initiativeGrant')?.applied) ?? null, 8000);
          ok('81c. Uncanny Metabolism spent: Perfect Focus on its own card, automatic — 4 of 5', !!pf && (focusValue() === 4) && /Perfect Focus — Focus Points back up to 4/.test(await grantLine(pf)),
            `card=${!!pf} focus=${focusValue()} line="${await grantLine(pf)}"`);
        }
      } finally {
        await closeA1(); await hgClose(/^Uncanny Metabolism — /);
        if (game.combats.get(combat.id)) await combat.delete();
        for (const it of [uncanny, perfect, focus]) if (it) await unlend(halfling, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }

    // ---- 97. Elemental Epitome: Empowered Strikes once per turn on an Unarmed Strike while Elemental Attunement is active
    if (want(97)) {
      await closeA1(); await a1Victim(); await dropVictimFx();
      const monk = await hgLend(pcAttacker, 'Monk', 'class', { 'system.levels': 17 });
      const att = await hgLend(pcAttacker, 'Elemental Attunement', 'feat');
      const epi = await hgLend(pcAttacker, 'Elemental Epitome', 'feat');
      let active = null;
      try {
        const strike = att?.system?.activities?.find(a => a.type === 'attack') ?? null;
        if (!monk || !att || !epi || !strike) log.push(`§97 skipped: monk=${!!monk} attunement=${!!att} epitome=${!!epi} strike=${!!strike}`);
        else {
          const r0 = await a1Hit(pcAttacker, pcToken, strike);
          ok('97a. Elemental Attunement not active: the Elemental Strike\'s offer has no Empowered Strikes row', !riderRow(r0.offer, 'elemental-epitome'),
            `row="${riderRow(r0.offer, 'elemental-epitome')}"`);
          if (r0.offer) await a1Roll(r0.msg, r0.offer); else await a1Damage(r0.msg);
          await closeOffers();
          [active] = await att.createEmbeddedDocuments('ActiveEffect', [{ name: 'Active Attunement', type: 'enchantment', img: 'icons/svg/aura.svg', transfer: true, disabled: false }]);   // the APPLIED enchantment (the templates are transfer false)
          await sleep(200);
          const r = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, att) ?? strike);
          const row = riderRow(r.offer, 'elemental-epitome');
          ok('97b. attuned: the offer\'s rider "Empowered Strikes" with the Martial Arts die, ticked', !!r.offer && /Empowered Strikes/.test(row) && !!riderBox(r.offer, 'elemental-epitome')?.checked,
            `row="${row}" checked=${riderBox(r.offer, 'elemental-epitome')?.checked}`);
          const d = await a1Roll(r.msg, r.offer);
          ok('97c. rolled: the rider rode the damage', ridersOf(d).some(x => (x.key ?? x) === 'elemental-epitome'), `riders=${JSON.stringify(ridersOf(d))}`);
        }
      } finally {
        await closeA1(); await closeOffers(); await dropVictimFx();
        if (active) await active.delete().catch(() => {});
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [epi, att, monk]) if (it) await unlend(pcAttacker, it);
        CONFIG.Dice.randomUniform = realPRNG; clearTargets();
      }
    }
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  }
} });

await finish({ tag: 'class-monk', out, plan, f });
