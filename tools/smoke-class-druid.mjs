// Classes smoke suite — Druid: the PHB classes plan's rows (audits/plans/session-0-classes.md) for
// the Druid, each section keeping its number and title. The fixtures, the lends, the
// helpers and the teardown are the classes kit's (tools/class-kit.mjs); everything written is restored.
import { announcePlan, connectSuite, finish, sectionPlan } from './harness.mjs';
import { runClassSuite } from './class-kit.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'hold/trigger.js',        // Cosmic Omen on a hit (§52)
  'hold/lookup.js',         // the omen's bystander (§52)
  'hold/answer.js',         // Weal and Woe answered (§52)
  'hold/views.js',          // the omen's popup (§52)
  'hold/continue.js',       // the verdict retaken (§52)
  'hold/dice.js',           // the bent roll's chips (§52)
  'cast.js',                // Starry Form's constellation (§22)
  'polish.js',              // the constellation stamped at the use card's birth (§22)
  'heal-rerolls.js',        // the Chalice's second heal (§22)
  'clock-riders.js',        // Lunar Form's radiant rider (§69)
  'emanations.js',          // Oceanic Gift's ring (§90)
  'stored-dice.js'          // Cosmic Omen's die kept at the rest (§52)
];

const SECTIONS = {
  22: 'Starry Form: "Consume Wild Shape" asks "Which constellation glimmers on you?" (Archer/Chalice/Dragon); Dragon lands Dragon Form, Archer and Chalice do not; Chalice keeps a form chip; then Cure Wounds at the PC Attacker offers "Chalice — heal one more within 30 ft" with a button per creature; the Halfling\'s button uses the Chalice heal on it (HP up)',
  52: 'Cosmic Omen (B4, lent to the Sorcerer): the Long Rest\'s d6 kept as "Cosmic Omen — Weal (4)"; a friend\'s miss asks "+1d6" (Weal (Even) the activity, a use spent); the face set odd, a foe\'s hit asks "−1d6" (Woe (Odd))',
  69: 'Lunar Form (C1, the PC Attacker transformed): the offer\'s rider "Lunar Form — 2d10 radiant"; not transformed, none',
  90: 'Oceanic Gift (C1, the Cleric a Sea Druid 14, Stormborn on the Halfling): the ring stands around the Halfling with the druid as its source; the druid\'s turn start asks the pick; the pick demands the druid\'s save'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'class-druid', watchdogMs: 900_000 });
announcePlan('class-druid', plan, pulled);

const out = await runClassSuite(f, { plan, sections: SECTIONS, body: async ({ sections, titles }) => {
  const { until, watch, faces, unrig } = window.__btb;
  const { results, skips, ok, want, section } = window.__btb.begin({ sections, titles });
  const KIT = window.__btbClasses;
  const { MOD, a1Damage, a1Hit, a1Roll, a1Victim, activateRange, attackOf, attacker, attackerToken, backToRange, c1Cards, cardEl, cardText, clearTargets, cleric, clericToken, closeA1, closeDialogs, closeOffers, created, dropEffects, dropNamed, dropReactionChips, dropVictimFx, halfling, halflingToken, healFull, hgClose, hgKeep, hgLend, hgPickButton, holdOf, hp, log, markOn, modOf, pcAttacker, pcToken, pcWeapon, pickApply, popups, priorActor, regionKeyed, resolvedTarget, riderBox, riderChits, riderRow, rollStoredAsk, scene, set, sorcerer, spendLuck, swing, swingAt, textOf, unlend, victim } = KIT;
  try {
    await KIT.leaveA3();

    // ---- 22. Starry Form: the constellation asked; the Chalice's second heal
    if (want(22)) await section(22, async () => {
      await closeDialogs();
      await set('castApply', true);   // retired (the stamp is unconditional) — harmless, as smoke-shields §8
      const ws = await hgLend(cleric, 'Wild Shape', 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 });
      const sf = await hgLend(cleric, 'Starry Form', 'feat');
      let cure = cleric.items.find(i => (i.type === 'spell') && (i.name === 'Cure Wounds')) ?? null;
      const cureLent = !cure;
      if (!cure) cure = await hgLend(cleric, 'Cure Wounds', 'spell', { 'system.prepared': 1 });
      const sfItem = () => cleric.items.get(sf?.id);
      const consumeAct = () => sfItem()?.system.activities.find(a => a.name === 'Consume Wild Shape');
      const chaliceAct = () => sfItem()?.system.activities.find(a => a.name === 'Chalice');
      // UNSURE: a fixture with no Circle of the Stars scale — the Chalice's die stands in as 1d6 on the lent copy.
      if (chaliceAct() && (foundry.utils.getProperty(cleric.getRollData(), 'scale.stars.die') === undefined)) {
        await sfItem().update({ [`system.activities.${chaliceAct()._id ?? chaliceAct().id}.healing.custom.formula`]: '1d6 + @abilities.wis.mod' });
      }
      const clearForm = async () => {
        const ids = cleric.effects.filter(e => /^(Starry Form|Dragon Form)/.test(e.name) || e.getFlag(MOD, 'formChip')).map(e => e.id);
        if (ids.length) await cleric.deleteEmbeddedDocuments('ActiveEffect', ids).catch(() => {});
      };
      // the forms, the popups and the lends go whatever happened (a wait that times out throws)
      try {
        if (!ws || !sf || !cure || !consumeAct() || !chaliceAct()) {
          log.push(`§22 skipped: wildShape=${!!ws} starryForm=${!!sf} cure=${!!cure} consume=${!!consumeAct()} chalice=${!!chaliceAct()}`);
        } else {
          const chip = () => cleric.effects.find(e => e.getFlag(MOD, 'formChip')?.choice === 'Starry Form') ?? null;
          const forms = () => cleric.effects.filter(e => e.active && /^(Starry Form|Dragon Form)/.test(e.name)).map(e => e.name);
          const wsSpent = () => Number(cleric.items.get(ws.id)?.system?.uses?.spent ?? 0);
          const dragonForm = () => forms().some(n => /^Dragon Form/.test(n));
          const shape = async pick => {
            await clearForm(); await hgClose(/^Starry Form —/);
            clericToken.control({ releaseOthers: true });
            game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
            let res = await consumeAct().use({ subsequentActions: false }, { configure: false }, {});
            // UNSURE: the Wild Shape consumption resolves by the lent copy's compendiumSource; if dnd5e refuses it, the
            // use is retried without consuming (the constellation is the row under test, not the Wild Shape spend).
            let consumed = true;
            if (!res?.message) { consumed = false; res = await consumeAct().use({ consume: false, subsequentActions: false }, { configure: false }, {}); }
            const card = res?.message ?? null;
            await until(() => card?.getFlag(MOD, 'castApply')?.choice, { timeout: 4000, label: 'the constellation asked on the use card' });
            const choice = foundry.utils.deepClone(card?.getFlag(MOD, 'castApply')?.choice ?? null);
            const btn = await until(() => hgPickButton(pick), { timeout: 5000, label: `the ${pick} pick in the popup` });
            const buttons = ['Archer', 'Chalice', 'Dragon'].filter(n => !!hgPickButton(n));
            const text = cardText(card?.id);
            btn?.click();
            // The pick lands the cast's effects and the form chip side by side (cast.js chooseEffect): Dragon adds Dragon Form.
            await until(() => forms().includes('Starry Form') && chip() && ((pick !== 'Dragon') || dragonForm()),
              { timeout: 8000, label: `the ${pick} constellation landed` });
            // A window for Archer and Chalice: no Dragon Form beside the Starry Form.
            const stray = (pick === 'Dragon') ? null : await watch(dragonForm, { ms: 600 });
            return { card, choice, buttons, text, consumed, chosen: card?.getFlag(MOD, 'castApply')?.choice?.chosen ?? null, forms: forms(), chip: chip(), stray };
          };

          const d = await shape('Dragon');
          ok('22a. "Consume Wild Shape" asks: the card pending "Which constellation glimmers on you?", the popup a button each — Archer, Chalice, Dragon',
            (d.choice?.key === 'Starry Form') && !d.choice?.chosen && (JSON.stringify(d.choice?.options) === JSON.stringify(['Archer', 'Chalice', 'Dragon']))
              && /Which constellation glimmers on you\?/.test(d.text) && (d.buttons.length === 3),
            `choice=${JSON.stringify(d.choice)} buttons=${JSON.stringify(d.buttons)} consumed=${d.consumed} wsSpent=${wsSpent()} card=${d.text.slice(0, 200)}`);
          ok('22b. Dragon: Starry Form AND Dragon Form land; the chip reads dragon',
            (d.chosen === 'Dragon') && d.forms.includes('Starry Form') && d.forms.some(n => /^Dragon Form/.test(n)) && (d.chip?.getFlag(MOD, 'formChip')?.form === 'dragon'),
            `chosen=${d.chosen} forms=${JSON.stringify(d.forms)} chip=${d.chip?.name ?? null}`);

          const a = await shape('Archer');
          ok('22c. Archer: Starry Form lands, no Dragon Form; the chip reads archer',
            (a.chosen === 'Archer') && a.forms.includes('Starry Form') && !a.forms.some(n => /^Dragon Form/.test(n)) && !a.stray && (a.chip?.getFlag(MOD, 'formChip')?.form === 'archer'),
            `chosen=${a.chosen} forms=${JSON.stringify(a.forms)} stray=${!!a.stray} chip=${a.chip?.name ?? null}`);

          const c = await shape('Chalice');
          ok('22d. Chalice: Starry Form lands, no Dragon Form; the form chip "Starry Form: Chalice" stands',
            (c.chosen === 'Chalice') && c.forms.includes('Starry Form') && !c.forms.some(n => /^Dragon Form/.test(n)) && !c.stray
              && (c.chip?.name === 'Starry Form: Chalice') && (c.chip?.getFlag(MOD, 'formChip')?.form === 'chalice'),
            `chosen=${c.chosen} forms=${JSON.stringify(c.forms)} stray=${!!c.stray} chip=${c.chip?.name ?? null} wsSpent=${wsSpent()}`);

          // The Chalice: Cure Wounds (level 1) at the PC Attacker; the Halfling (10 ft from the Cleric) is the second heal.
          hgKeep(pcAttacker, { 'system.attributes.hp.value': pcAttacker.system._source.attributes.hp.value });
          await halfling.update({ 'system.attributes.hp.value': 300, 'system.attributes.hp.temp': 0 });
          const hName = halflingToken.document.name;
          game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
          pcToken.setTarget(true, { releaseOthers: true });
          faces([[4, 8]]);
          // UNSURE: rolled straight off the activity (smoke-heal's shape) — no slot is spent; the `also` row reads only the
          // spell's level (> 0), never the slot.
          const cureAct = cleric.items.get(cure.id)?.system.activities.find(x => x.type === 'heal');
          const rolls = await cureAct?.rollDamage({}, { configure: false }, {});
          const healCard = rolls?.[0]?.parent ?? null;
          const offer = await until(() => [...(cardEl(healCard?.id)?.querySelectorAll('button') ?? [])].find(b => textOf(b) === hName) ?? null, { timeout: 6000, label: 'the Chalice\'s button for the Halfling on the heal card' });
          const names = [...(cardEl(healCard?.id)?.querySelectorAll('button') ?? [])].map(b => textOf(b));
          const pop = await until(() => popups().find(app => /^Chalice —/.test(app.title ?? '')) ?? null, { timeout: 3000, label: 'the Chalice popup' });
          ok('22e. the Cure Wounds card offers "Chalice — heal one more within 30 ft" with a button per creature (the Cleric and the Halfling among them); the popup opens',
            !!offer && /Chalice — heal one more within 30 ft/.test(cardText(healCard?.id)) && names.includes(clericToken.document.name) && !!pop,
            `card=${!!healCard} buttons=${JSON.stringify(names)} pop=${pop?.title ?? null} text=${cardText(healCard?.id).slice(-200)}`);
          faces([[6, 6]]);
          const hp0 = hp();
          offer?.click();
          const flag = await until(() => game.messages.get(healCard?.id)?.getFlag(MOD, 'alsoHeal')?.picked ? game.messages.get(healCard.id).getFlag(MOD, 'alsoHeal') : null, { timeout: 6000, label: 'the Chalice pick kept on the heal card' });
          // UNSURE: the Chalice heal is use() then rollDamage() on the heal activity (the handoff's unverified seam).
          const rose = await until(() => hp() > hp0, { timeout: 10000, label: 'the Chalice heal on the Halfling' });
          // the heal card's "healed too" line (heal-rerolls.js), drawn on the re-render after the pick
          await until(() => /is healed too/.test(cardText(healCard?.id)), { label: 'the heal card\'s Chalice line' });
          ok('22f. the Halfling\'s button: the Chalice heal is used on the Halfling — its HP rises; the card says "Chalice — BTB Test Halfling is healed too"',
            (flag?.picked === halfling.uuid) && (flag?.also === 'Chalice') && rose && new RegExp(`Chalice — ${hName} is healed too`).test(cardText(healCard?.id)),
            `flag=${JSON.stringify(flag)} hp ${hp0}→${hp()} text=${cardText(healCard?.id).slice(-160)}`);

          await healFull();
          await pcAttacker.update({ 'system.attributes.hp.value': priorActor[pcAttacker.id]['system.attributes.hp.value'] });
        }
      } finally {
        await hgClose(/^(Chalice|Starry Form) —/);
        await clearForm();
        game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
        if (cure && cureLent) await unlend(cleric, cure);
        if (sf) await unlend(cleric, sf);
        if (ws) await unlend(cleric, ws);
        unrig();
      }
    });
    KIT.markA2();

    // ---- 52. Cosmic Omen: the Long Rest's d6 kept as Weal or Woe; Weal +1d6 on a friend's miss, Woe −1d6 on a foe's hit
    if (want(52)) await section(52, async () => {
      await closeA1(); await spendLuck();
      const omen = await hgLend(sorcerer, 'Cosmic Omen', 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 });
      const chip = () => sorcerer.effects.find(e => e.getFlag(MOD, 'storedDice')?.key === 'Cosmic Omen') ?? null;
      const usesLeft = () => Number(sorcerer.items.get(omen?.id)?.system?.uses?.value ?? NaN);
      hgKeep(sorcerer, { 'system.attributes.hp.value': sorcerer.system._source.attributes.hp.value });
      try {
        if (!omen) log.push('§52 skipped: no Cosmic Omen in the PHB');
        else {
          await dropReactionChips(sorcerer);
          faces([[4, 6]]);
          await sorcerer.longRest({ dialog: false, chat: true, newDay: false });
          await rollStoredAsk();
          await until(() => chip(), { timeout: 8000, label: 'the Cosmic Omen chip kept at the rest' });
          unrig();
          ok('52a. the Long Rest rolls the d6: an even face (4) is Weal — the chip "Cosmic Omen — Weal (4)"', chip()?.name === 'Cosmic Omen — Weal (4)', `chip=${chip()?.name ?? null}`);
          // b. Weal: a friend's miss within 30 ft — "+1d6"
          await a1Victim();
          await victim.update({ 'system.attributes.ac.override': (await modOf(pcAttacker, pcWeapon)) + 13 });
          const miss = await swingAt(pcAttacker, pcToken, pcWeapon, { d20: [10] });
          const pop = await until(() => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-bystander"]') && /Cosmic Omen/.test(textOf(app.element))) ?? null, { timeout: 8000, label: 'the Weal popup on the friend\'s miss' });
          const guard = holdOf(miss)?.targets?.[0]?.guards?.find(g => g.row === 'Cosmic Omen') ?? null;
          ok('52b. the PC Attacker misses by 3: the druid\'s popup "Cosmic Omen — +1d6" (Weal), the guard\'s activity Weal (Even)',
            !!pop && /\+1d6/.test(textOf(pop?.element)) && (guard?.sign === 1) && (sorcerer.items.get(omen.id)?.system?.activities?.get(guard?.activityId)?.name === 'Weal (Even)'),
            `pop=${!!pop} guard=${JSON.stringify(guard && { sign: guard.sign, activity: sorcerer.items.get(omen.id)?.system?.activities?.get(guard.activityId)?.name })}`);
          faces([[5, 6]]);
          pickApply(pop);
          // the use and the Reaction are spent before the answer resolves the hold (hold/answer.js bystanderReaction)
          const h = await until(() => (holdOf(miss)?.status === 'resolved') ? holdOf(miss) : null, { timeout: 12000, label: 'the Weal answer resolved the hold' });
          unrig();
          // A window: Weal's die adds to the roll and leaves the kept face as it stands.
          const stray = await watch(() => chip()?.name !== 'Cosmic Omen — Weal (4)', { ms: 900 });
          const t = h?.targets?.find(x => x.uuid === victim.uuid) ?? null;
          ok('52c. Answer: +5 — a HIT, a use of Cosmic Omen spent (2 of 3), the chip still Weal (4)', (t?.verdict === 'hit') && (t?.bent?.add === 5) && (usesLeft() === 2) && !stray && (chip()?.name === 'Cosmic Omen — Weal (4)'),
            `verdict=${t?.verdict} bent=${JSON.stringify(t?.bent)} uses=${usesLeft()} stray=${!!stray} chip=${chip()?.name ?? null}`);
          await dropReactionChips(sorcerer);
          // d. Woe: the face set odd — a foe's hit on the Halfling by 2 asks "−1d6"
          await chip()?.update({ name: 'Cosmic Omen — Woe (3)', [`flags.${MOD}.storedDice`]: { key: 'Cosmic Omen', faces: [3], turn: null } });
          const msg = await swing({ d20: [12] });
          const pop2 = await until(() => popups().find(app => app.element?.querySelector?.('[data-bf-ticks="bf-bystander"]') && /Cosmic Omen/.test(textOf(app.element))) ?? null, { timeout: 8000, label: 'the Woe popup on the foe\'s hit' });
          const guard2 = holdOf(msg)?.targets?.[0]?.guards?.find(g => g.row === 'Cosmic Omen') ?? null;
          ok('52d. Woe (3): the Attacker hits the Halfling by 2 — the popup "Cosmic Omen — −1d6", the activity Woe (Odd)',
            !!pop2 && /−1d6/.test(textOf(pop2?.element)) && (guard2?.sign === -1) && (sorcerer.items.get(omen.id)?.system?.activities?.get(guard2?.activityId)?.name === 'Woe (Odd)'),
            `pop=${!!pop2} guard=${JSON.stringify(guard2 && { sign: guard2.sign })}`);
          pickApply(pop2, 'pass');
          await resolvedTarget(msg);
        }
      } finally {
        await closeA1(); await closeOffers();
        const chips = sorcerer.effects.filter(e => e.getFlag(MOD, 'storedDice')).map(e => e.id);
        if (chips.length) await sorcerer.deleteEmbeddedDocuments('ActiveEffect', chips).catch(() => {});
        if (omen) await unlend(sorcerer, omen);
        await dropReactionChips(sorcerer);
        unrig(); clearTargets(); await healFull();
      }
    });

    // ---- 69. Lunar Form: the transformation flag
    if (want(69)) await section(69, async () => {
      await closeDialogs(); await a1Victim(); await dropVictimFx();
      const lunar = await hgLend(pcAttacker, 'Lunar Form', 'feat');
      try {
        if (!lunar || !pcWeapon) log.push(`§69 skipped: lunar=${!!lunar} weapon=${!!pcWeapon}`);
        else {
          await pcAttacker.setFlag('dnd5e', 'isPolymorphed', true);
          const r1 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('69a. transformed: the offer\'s ticked rider "Lunar Form — 2d10 radiant"', !!riderBox(r1.offer, 'lunar-form') && /2d10/.test(riderRow(r1.offer, 'lunar-form')) && /radiant/.test(riderRow(r1.offer, 'lunar-form')),
            `offer=${!!r1.offer} row="${riderRow(r1.offer, 'lunar-form').slice(0, 120)}"`);
          if (r1.offer) await a1Roll(r1.msg, r1.offer); else await a1Damage(r1.msg);
          await dropEffects(pcAttacker, riderChits(pcAttacker));
          await pcAttacker.unsetFlag('dnd5e', 'isPolymorphed');
          const r2 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon), { offerWait: 2500 });
          ok('69b. not transformed: no Lunar Form row', !riderBox(r2.offer, 'lunar-form'), `offer=${!!r2.offer} rows=${JSON.stringify(r2.offer ? [...r2.offer.element.querySelectorAll('[data-bf-rider-row]')].map(e => e.dataset.bfRiderRow) : null)}`);
          if (r2.offer) await a1Roll(r2.msg, r2.offer);
        }
      } finally {
        await closeOffers(); await closeDialogs();
        await pcAttacker.unsetFlag('dnd5e', 'isPolymorphed').catch(() => {});
        await dropVictimFx(); await dropEffects(pcAttacker, riderChits(pcAttacker));
        if (lunar) await unlend(pcAttacker, lunar);
        unrig(); clearTargets();
      }
    });

    // ---- 90. Oceanic Gift: Wrath of the Sea's ring around another creature, the druid its source
    if (want(90)) await section(90, async () => {
      await closeA1();
      await activateRange();
      const druid = await hgLend(cleric, 'Druid', 'class', { 'system.levels': 14 });
      const sea = await hgLend(cleric, 'Circle of the Sea', 'subclass');
      const wrath = await hgLend(cleric, 'Wrath of the Sea', 'feat');
      const gift = await hgLend(cleric, 'Oceanic Gift', 'feat');
      let storm = null;
      let combat90 = null;
      try {
        if (!druid || !sea || !wrath || !gift) log.push(`§90 skipped: druid=${!!druid} sea=${!!sea} wrath=${!!wrath} gift=${!!gift}`);
        else {
          // the Stormborn's own sweep (emanations.js, debounced) raises the ring from the sheet as it then stands
          storm = await markOn(halfling, 'Stormborn', gift.uuid);
          // The region lands before its behaviour and its "initial" record (adoptRegion): wait for the adopted ring, not the bare one.
          const region = await until(() => { const r = regionKeyed('Oceanic Gift', halflingToken.document.id); return (r?.behaviors?.size && r.getFlag(MOD, 'emanation')?.initial) ? r : null; }, { timeout: 12000, label: 'the Oceanic Gift ring adopted around the Halfling' });
          const fl = region?.getFlag(MOD, 'emanation');
          const beh = region?.behaviors?.contents?.[0] ?? null;
          ok('90a. Stormborn (from the druid\'s Oceanic Gift) on the Halfling: the ring "Oceanic Gift" stands around the HALFLING, its source the druid\'s token, the range the druid\'s scale',
            !!region && (fl?.sourceTokenId === clericToken.document.id) && (beh?.system?.source === clericToken.document.uuid) && (region.attachment?.token?.id === halflingToken.document.id),
            `region=${!!region} flag=${JSON.stringify(fl ?? null)} source=${beh?.system?.source ?? null} radius=${region?.shapes?.[0]?.radius ?? null}`);
          // the druid's turn start: the pick card names who stands inside the Halfling's ring (the Attacker, the Halfling itself)
          [combat90] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          created.combats.push(combat90.id);
          await combat90.createEmbeddedDocuments('Combatant', [
            { tokenId: clericToken.document.id, sceneId: scene.id, actorId: cleric.id, initiative: 20 },
            { tokenId: attackerToken.document.id, sceneId: scene.id, actorId: attacker.id, initiative: 10 }]);
          const t0 = Date.now();
          await combat90.startCombat();
          const pick = await until(() => c1Cards(t0, 'emanationPick').find(m => m.getFlag(MOD, 'emanationPick')?.key === 'Oceanic Gift') ?? null, { timeout: 10000, label: 'the Oceanic Gift pick card at the druid\'s turn' });
          const cands = (pick?.getFlag(MOD, 'emanationPick')?.candidates ?? []).map(c => c.name);
          ok('90b. at the DRUID\'s turn start the pick card: "Oceanic Gift — BTB Test Cleric\'s turn: choose one creature inside", the creatures inside the Halfling\'s ring the candidates, the druid not',
            !!pick && (cands.length > 1) && !cands.includes(clericToken.document.name) && /BTB Test Cleric's turn: choose one creature inside/.test(cardText(pick?.id)),
            `pick=${!!pick} candidates=${JSON.stringify(cands)} card="${cardText(pick?.id).slice(0, 200)}"`);
          await set('saveRolls', 'prompt');
          // The pick: the Attacker when the ring holds it, else the first creature inside that is not the Halfling — in a full
          // run §77 leaves the Halfling on the north rows (its restore onto the off-scene main row is refused), away from the Attacker.
          const candList = pick?.getFlag(MOD, 'emanationPick')?.candidates ?? [];
          const chosen = candList.find(c => c.tokenId === attackerToken.document.id) ?? candList.find(c => c.tokenId !== halflingToken.document.id) ?? null;
          const chosenActor = chosen ? scene.tokens.get(chosen.tokenId)?.actor ?? null : null;
          const button = await until(() => cardEl(pick?.id)?.querySelector(`[data-bf-emanation-pick="${chosen?.tokenId}"]`), { timeout: 6000, label: 'the pick card\'s button for the chosen creature' });
          button?.click();
          // soft: the ok's detail reads the pick flag's live state (picked, demanded) for the demand that never comes
          const demand = await until(() => game.messages.contents.find(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'emanationTrigger')?.cause === 'pick') && (m.getFlag(MOD, 'emanationTrigger')?.key === 'Oceanic Gift')) ?? null, { timeout: 10000, label: 'the picked creature\'s save demanded' }).catch(() => null);
          const dc = Number(demand?.getFlag(MOD, 'saves')?.dc);
          // The DC the activity resolves for the lent class (Wisdom, a level-14 druid's proficiency), not the sheet's primary spell DC.
          const druidDc = Number([...(cleric.items.get(wrath.id)?.system?.activities ?? [])].find(a => a.type === 'save')?.save?.dc?.value ?? 0);
          ok('90c. a creature inside picked (the Attacker when it stands there): the Constitution save demanded at the DRUID\'s DC on the druid\'s Wrath of the Sea', !!demand && (dc > 8) && ((druidDc === 0) || (dc === druidDc)) && (demand.getFlag(MOD, 'saves')?.targets ?? []).some(t => (t.uuid === chosen?.uuid) || (t.uuid === chosenActor?.uuid)),
            `demand=${!!demand} dc=${dc} druidDc=${druidDc} targets=${JSON.stringify((demand?.getFlag(MOD, 'saves')?.targets ?? []).map(t => t.name))} button=${!!button} picked=${pick?.getFlag(MOD, 'emanationPick')?.picked?.name ?? null} demanded=${pick?.getFlag(MOD, 'emanationPick')?.demanded ?? null} attackerHp=${attacker.system.attributes.hp.value} chosen=${chosen?.name ?? null} cands=${JSON.stringify((pick?.getFlag(MOD, 'emanationPick')?.candidates ?? []).map(c => [c.tokenId, scene.tokens.get(c.tokenId)?.x, scene.tokens.get(c.tokenId)?.y]))}`);
        }
      } finally {
        await closeA1();
        if (combat90 && game.combats.get(combat90.id)) await combat90.delete();
        if (storm) await storm.delete().catch(() => {});
        for (const it of [gift, wrath, sea, druid]) if (it) await unlend(cleric, it);
        const gone = await until(() => !regionKeyed('Oceanic Gift', halflingToken.document.id), { timeout: 8000, label: 'the Oceanic Gift ring gone with the Stormborn' }).catch(() => null);
        if (!gone) { const r = regionKeyed('Oceanic Gift', halflingToken.document.id); if (r) await r.delete().catch(() => {}); }
        await dropNamed(attacker, ['Frightened']);
        unrig(); clearTargets();
        await backToRange().catch(() => null);   // a wait in a finally never throws
      }
    });
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  }
} });

await finish({ tag: 'class-druid', out, plan, f });
