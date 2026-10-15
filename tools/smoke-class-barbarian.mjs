// Classes smoke suite — Barbarian: the PHB classes plan's rows (audits/plans/session-0-classes.md) for
// the Barbarian, each section keeping its number and title. The fixtures, the lends, the
// helpers and the teardown are the classes kit's (tools/class-kit.mjs); everything written is restored.
import { announcePlan, connectSuite, finish, sectionPlan } from './harness.mjs';
import { runClassSuite } from './class-kit.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'clock-riders.js',        // Frenzy (§17), the Ram's Prone rider (§68)
  'cast.js',                // the Rage landing; Rage of the Wilds' pick (§25)
  'polish.js',              // the pick stamped at the use card's birth (§25, §68)
  'turn-grants.js',         // the Rage's turn-end reminder (§24)
  'emanations.js',          // the Wolf's ring (§25), the Lion's ring (§68)
  'reminders.js',           // the gate's member bend (Rage of the Wolf, §25; the Lion, §68)
  'hit-menu.js',            // Brutal Strike's group (§46, §92)
  'initiative-grants.js',   // Persistent Rage and Uncanny Metabolism at Initiative (§37)
  'rest-grants.js',         // Life-Giving Force's pick (§38)
  'drop-to-one.js'          // Relentless Rage (§64), Rage of the Gods (§66)
];

const SECTIONS = {
  17: 'Frenzy: raging AND Reckless, the first hit of the turn — the offer\'s TICKED row "Frenzy — Nd6 <type>" (N the Rage Damage), it rides and writes the chit; the second hit that turn shows none; Rage without Reckless, none',
  24: 'the Rage reminder: in a combat BTB Test PC Attacker (lent Rage) enters Rage on its turn — that turn is never reminded; a later turn with no attack roll and no save forced ends with "Rage — it ends now unless you extended it", nothing removed; a turn with an attack roll at an enemy ends with no card',
  25: 'Rage of the Wilds: with Rage and Rage of the Wilds lent, the Rage\'s card asks "Rage of the Wilds — Bear, Eagle or Wolf?" and the Rage lands at once; Wolf uses the feature\'s own Wolf activity ("Rage of the Wolf" on the barbarian); the enemy within 5 ft wears the quiet ring\'s member copy; the Cleric attacking it sees Advantage from "Rage of the Wolf" in the gate, the barbarian\'s own attack does not',
  37: 'the Initiative grants: Persistent Rage (lent to the PC Attacker, Rage 1 of 3) regains every Rage use at Initiative, automatically — "Persistent Rage — Rage uses regained (3 of 3)"; Uncanny Metabolism (lent to the Halfling) asks, Yes lands Focus 3 of 3 and 1d8 + 5 (9) Hit Points, its use spent; rerolled with both spent, nothing; No keeps the use; with Persistent Rage a quiet raging turn is never reminded',
  38: 'Vitality of the Tree (lent to the PC Attacker): the Rage used grants Vitality Surge (7 temp HP); a raging turn start asks "Who gets 7 Temporary Hit Points?" (Life-Giving Force, 2d6) — creatures on its side within 10 ft; OK gives the one ticked; not raging, nothing asked',
  46: 'Brutal Strike (B3, lent to the PC Attacker with Improved, a Reckless effect on): the attack dialog lists Reckless and the box "Brutal Strike — forgo the Advantage"; ticked, "Reckless — forgone", Net Normal; the roll\'s record carries forgo; the damage offer\'s group Brutal Strike (four rows, 1d10 · free); Hamstring Blow rides the 1d10 and lands Hamstrung; a hit with no dialog offers no group',
  64: 'Relentless Rage (C1, the Halfling a raging Barbarian 11): a drop to 0 is held at 1, the Constitution save rolls at DC 10 and SAVES — 1 + 22 healed, a use spent; the next drop\'s DC 15 FAILS — 0',
  66: 'Rage of the Gods (C1, the Sorcerer a raging Zealot 14 within 30 ft): the Halfling\'s drop asks the ZEALOT "drop to @classes.barbarian.levels Hit Points instead?"; Yes: the Halfling at 14, a Rage use spent',
  68: 'Power of the Wilds (C1, the PC Attacker raging): the Rage asks "Falcon, Lion or Ram?"; Lion: the chip, the quiet ring, the Victim inside attacking the Halfling at Disadvantage, attacking the rager not; Ram: a melee hit\'s rider knocks the Victim Prone',
  92: "Improved Brutal Strike (D1, the PC Attacker a Barbarian 17): the Brutal Strike group keeps two ticks; both effects ride the hit"
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'class-barbarian', watchdogMs: 900_000 });
announcePlan('class-barbarian', plan, pulled);

const out = await runClassSuite(f, { plan, sections: SECTIONS, body: async ({ sections, titles }) => {
  const { sleep, until, viewScene, faces, unrig } = window.__btb;
  const { results, skips, ok, want, section } = window.__btb.begin({ sections, titles });
  const KIT = window.__btbClasses;
  const { MOD, RAGE_FX, a1Damage, a1Formula, a1Hit, a1Roll, a1Victim, actNamed, activateRange, attackOf, backToRange, cardEl, cardText, clearDown, clearTargets, cleric, clericToken, clericWeapon, closeA1, closeDialogs, closeOffers, created, dropCards, dropEffects, dropFx, dropHalfling, dropVictimFx, fxNamed, gateFor, grantCards, grantLine, halfling, halflingToken, healFull, hgClose, hgKeep, hgLend, hgPickButton, hitBox, hitRow, hitRows, hp, lend, log, markOn, offerApp, pcAttacker, pcToken, pcWeapon, pinHeal, pinPart, popups, reEsc, regionKeyed, riderBox, riderChits, riderRow, ridersOf, rollDialog, scene, set, sorcerer, spendLuck, spendLuckC, suiteStart, swingAt, textOf, tick, titled, unlend, useFeature, victim, victimFx, victimPrior, victimToken, weaponOf } = KIT;
  try {
    await KIT.leaveA3();

    // ---- 17. Frenzy: raging AND Reckless, once per turn
    if (want(17)) await section(17, async () => {
      await closeDialogs(); await a1Victim();
      if (!pcWeapon) log.push('§17 skipped: BTB Test PC Attacker has no weapon');
      else {
        const frenzy = await lend(pcAttacker, 'Frenzy');
        const made = [];
        let combat17 = null;
        try {
          let { act: fAct, raw, formula } = a1Formula(frenzy, 'Damage', pcAttacker);
          if (fAct && raw && (foundry.utils.getProperty(pcAttacker.getRollData(), 'scale.barbarian.rage-damage') == null)) {
            // The pack's part is (@scale.barbarian.rage-damage)d6; BTB Test PC Attacker is no Barbarian, so the lent
            // COPY's @-terms are pinned to 2 (a level-3 barbarian's) — the machine's read is unchanged.
            const parts = fAct.toObject().damage.parts;
            parts[0].custom = { enabled: true, formula: raw.replace(/@[\w.-]+/g, '2') };
            await frenzy.update({ [`system.activities.${fAct.id}.damage.parts`]: parts });
            ({ formula } = a1Formula(pcAttacker.items.get(frenzy.id), 'Damage', pcAttacker));
            log.push(`§17: Frenzy's part "${raw}" reads nothing on BTB Test PC Attacker — the lent copy reads "${formula}"`);
          }
          const wType = [...(pcWeapon.system?.damage?.base?.types ?? [])][0] ?? null;
          // The raging and reckless facts clock-riders.js reads: an active effect NAMED "Rage" and one named "Reckless".
          made.push(...(await pcAttacker.createEmbeddedDocuments('ActiveEffect', [
            { name: 'Rage', img: 'icons/svg/aura.svg', transfer: false, disabled: false, changes: [] },
            { name: 'Reckless', img: 'icons/svg/aura.svg', transfer: false, disabled: false, changes: [] }])).map(e => e.id));
          // A combat on the PC Attacker's turn (oncePerTurn is judged by the turn chit, written only in a combat).
          [combat17] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          created.combats.push(combat17.id);
          await combat17.createEmbeddedDocuments('Combatant', [
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 20 },
            { tokenId: victimToken.document.id, sceneId: scene.id, actorId: victim.id, initiative: 10 }]);
          await combat17.startCombat();
          await sleep(400);
          const act = attackOf(pcAttacker, pcWeapon);
          const { msg, offer } = await a1Hit(pcAttacker, pcToken, act);
          const box = riderBox(offer, 'frenzy');
          const row = riderRow(offer, 'frenzy');
          ok(`17a. raging and Reckless, the first hit of the turn: the offer's TICKED row "Frenzy — ${formula} ${wType ?? ''}" (N the Rage Damage)`,
            !!formula && /d6/.test(formula) && !!box && box.checked && new RegExp(`Frenzy — ${reEsc(formula)}`).test(row) && (!wType || row.includes(wType)),
            `raw=${raw} formula=${formula} type=${wType} offer=${!!offer} checked=${box?.checked} row="${row}" turn=${combat17.combatant?.actor?.name}`);
          const dmg = await a1Roll(msg, offer);
          const r = ridersOf(dmg).find(x => x.key === 'frenzy');
          const chit = await until(() => pcAttacker.effects.find(e => (e.getFlag(MOD, 'mastery') === 'rider') && (e.getFlag(MOD, 'riderKey') === 'frenzy')), { timeout: 6000 }).catch(() => null);
          ok('17b. it rides as its own part of the weapon\'s type ("raging and reckless — once this turn") and writes the once-per-turn chit',
            !!r && (r.formula === formula) && (!wType || (r.type === wType)) && /raging and reckless — once this turn/.test(r.why ?? '') && !!chit,
            `rider=${JSON.stringify(r)} chit=${chit?.name ?? null}`);
          const { msg: m2, offer: o2 } = await a1Hit(pcAttacker, pcToken, act);
          const d2 = o2 ? await a1Roll(m2, o2) : await a1Damage(m2);
          ok('17c. the second hit that turn shows none: no Frenzy row, nothing rides (the chit stands)',
            !!d2 && !riderBox(o2, 'frenzy') && !ridersOf(d2).some(x => x.key === 'frenzy'),
            `offer=${!!o2} riders=${JSON.stringify(ridersOf(d2).map(x => x.key))} formulas=[${(d2?.rolls ?? []).map(x => x.formula).join(' | ')}]`);
          await combat17.delete(); combat17 = null;
          await dropEffects(pcAttacker, pcAttacker.effects.filter(e => e.name === 'Reckless').map(e => e.id));
          const { msg: m3, offer: o3 } = await a1Hit(pcAttacker, pcToken, act);
          const d3 = o3 ? await a1Roll(m3, o3) : await a1Damage(m3);
          ok('17d. raging without Reckless (out of combat): no Frenzy', !!d3 && !riderBox(o3, 'frenzy') && !ridersOf(d3).some(x => x.key === 'frenzy'),
            `offer=${!!o3} riders=${JSON.stringify(ridersOf(d3).map(x => x.key))}`);
        } finally {
          await closeOffers();
          try { if (combat17 && game.combats.get(combat17.id)) await combat17.delete(); } catch { /* gone */ }
          await dropEffects(pcAttacker, [...made, ...riderChits(pcAttacker)]);
          await unlend(pcAttacker, frenzy);
        }
      }
    });

    // ---- 24. the Rage's turn-end reminder (TURN_GRANTS remind: "extend")
    if (want(24)) await section(24, async () => {
      await closeA1();
      await dropFx(pcAttacker, RAGE_FX);   // a killed run's leftovers: the fixture carries no Rage of its own
      const rage = await lend(pcAttacker, 'Rage');
      const [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
      created.combats.push(combat.id);
      try {
        await combat.createEmbeddedDocuments('Combatant', [
          { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 20 },
          { tokenId: victimToken.document.id, sceneId: scene.id, actorId: victim.id, initiative: 10 }]);
        await combat.startCombat();
        await sleep(400);
        const reminders = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart)
          && (m.getFlag(MOD, 'turnGrant')?.remind === 'extend') && (m.getFlag(MOD, 'turnGrant')?.actorUuid === pcAttacker.uuid)
          && String(m.getFlag(MOD, 'turnGrant')?.place ?? '').startsWith(`${combat.id}|`));
        const reminderFor = round => reminders().find(m => String(m.getFlag(MOD, 'turnGrant').place).startsWith(`${combat.id}|${round}|`)) ?? null;
        const toTurnOf = async actor => {   // advance until `actor`'s turn is the current one
          for (let i = 0; (i < 4) && (combat.combatant?.actorId !== actor.id); i++) { await combat.nextTurn(); await sleep(300); }
        };
        await toTurnOf(pcAttacker);
        const r1 = combat.round;
        // Round r1, the barbarian's turn: it enters Rage (the pack's own activity; cast.js lands the effect).
        const card = await useFeature(pcToken, rage);
        const rageFx = await until(() => fxNamed(pcAttacker, ['Rage'])[0] ?? null, { timeout: 6000 }).catch(() => null);
        // UNSURE: the Rage's activity is a self-aimed utility carrying the "Rage" effect (castApply stamps it) — if it
        // never lands, the whole section is diagnosed here, not guessed around.
        ok('24a. the Rage entered on the barbarian\'s turn lands "Rage" on it (the usage card stamped castApply)',
          !!rageFx && !!card?.getFlag(MOD, 'castApply'),
          `fx=${rageFx?.name ?? null} start=${JSON.stringify(rageFx?.start ?? null)} stamp=${!!card?.getFlag(MOD, 'castApply')} activity=${actNamed(rage)?.type}/${actNamed(rage)?.target?.affects?.type}`);
        await combat.nextTurn();                       // the entering turn ends
        await sleep(2000);
        // UNSURE: the handoff's guess — the "Rage" effect's `start` stamp names the turn it was entered
        // (chitStampOf → `combat:round:turn`); a red here with a card posted means the stamp is not that.
        ok('24b. the turn the Rage was entered is never reminded', !reminderFor(r1),
          `card=${cardText(reminderFor(r1)?.id).slice(0, 160)} start=${JSON.stringify(rageFx?.start ?? null)}`);
        await toTurnOf(pcAttacker);
        const r2 = combat.round;
        await sleep(300);
        await combat.nextTurn();                       // a turn with no attack roll and no save forced ends
        const quiet = await until(() => reminderFor(r2), { timeout: 6000 }).catch(() => null);
        await until(() => cardEl(quiet?.id), { timeout: 3000 }).catch(() => null);
        ok('24c. a turn with no attack roll and no save forced: the card "Rage — it ends now unless you extended it", nothing is removed',
          !!quiet && /Rage — it ends now unless you extended it/.test(cardText(quiet?.id)) && /nothing is removed/.test(cardText(quiet?.id))
            && (quiet?.getFlag(MOD, 'turnGrant')?.key === 'Rage') && !!fxNamed(pcAttacker, ['Rage'])[0],
          `card=${cardText(quiet?.id).slice(0, 220)} flag=${JSON.stringify(quiet?.getFlag(MOD, 'turnGrant') ?? null)} rage=${!!fxNamed(pcAttacker, ['Rage'])[0]}`);
        if (!pcWeapon) log.push('§24c skipped the attack turn: BTB Test PC Attacker has no weapon');
        else {
          await toTurnOf(pcAttacker);
          const r3 = combat.round;
          victimPrior();
          await victim.update({ 'system.attributes.hp.max': 400 });
          const atk = await swingAt(pcAttacker, pcToken, pcWeapon, { d20: [15] });   // an attack roll at the hostile Victim
          await sleep(800);
          await combat.nextTurn();
          await sleep(2500);
          ok('24d. a turn WITH an attack roll at an enemy ends with no card', !!atk && !reminderFor(r3),
            `attack=${atk?.id ?? null} card=${cardText(reminderFor(r3)?.id).slice(0, 160)}`);
        }
      } finally {
        await closeA1();
        if (game.combats.get(combat.id)) await combat.delete();
        await dropFx(pcAttacker, RAGE_FX);
        await unlend(pcAttacker, rage);
        clearTargets();
      }
    });

    // ---- 25. Rage of the Wilds: the pick at the Rage, the Wolf's ring, the gate
    if (want(25)) await section(25, async () => {
      await closeA1();
      await dropFx(pcAttacker, RAGE_FX);
      // UNSURE: a ring stands only on a LIVE scene (emanations.js liveNow) — the active scene, or one a connected
      // user views. The suite only views the range; activated here as smoke-emanations does, restored after.
      const priorActive = game.scenes.active ?? null;
      if (priorActive?.id !== scene.id) { KIT.priorActiveScene = KIT.priorActiveScene ?? priorActive; await scene.activate(); await sleep(1500); }
      const rage = await lend(pcAttacker, 'Rage');
      const wilds = await lend(pcAttacker, 'Rage of the Wilds');
      const t0 = Date.now();
      // an effect choice is radios and Apply (DESIGN *Cards*): the option ticked, then Apply
      const pickButton = (label => { const input = [...document.querySelectorAll('.application.dialog input[name="bf-effect-pick"]')].find(i => textOf(i.closest('label')) === label); if (!input) return null; return { click: () => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); input.closest('.application')?.querySelector('button[data-action="apply"]')?.click(); } }; });
      const wolfRegion = () => scene.regions.find(r => { const fl = r.getFlag(MOD, 'emanation'); return (fl?.kind === 'feature') && (fl.key === 'Rage of the Wolf') && (fl.tokenId === pcToken.document.id); }) ?? null;
      const memberOn = actor => actor.effects.find(e => e.getFlag(MOD, 'emanation') && e.name.startsWith('Rage of the Wolf')) ?? null;   // "Rage of the Wolf — <bearer>"
      try {
        const card = await useFeature(pcToken, rage);
        const choice = card?.getFlag(MOD, 'castApply')?.choice ?? null;
        const rageFx = await until(() => fxNamed(pcAttacker, ['Rage'])[0] ?? null, { timeout: 6000 }).catch(() => null);
        ok('25a. the Rage\'s card asks "Rage of the Wilds — Bear, Eagle or Wolf?" (a free pick), and the Rage lands at once, before any pick',
          (choice?.key === 'Rage of the Wilds') && (JSON.stringify(choice?.options) === JSON.stringify(['Bear', 'Eagle', 'Wolf'])) && (choice?.free === true)
            && !choice?.chosen && !!rageFx,
          `choice=${JSON.stringify(choice)} rage=${!!rageFx}`);
        const wolf = await until(() => pickButton('Wolf'), { timeout: 6000 }).catch(() => null);
        await until(() => cardEl(card?.id), { timeout: 3000 }).catch(() => null);
        ok('25b. the popup on the barbarian\'s client: a button each for Bear, Eagle and Wolf; the card says "pick one"',
          !!wolf && !!pickButton('Bear') && !!pickButton('Eagle') && /Rage of the Wilds — Bear, Eagle or Wolf\?/.test(cardText(card?.id)) && /pick one/.test(cardText(card?.id)),
          `wolf=${!!wolf} bear=${!!pickButton('Bear')} card=${cardText(card?.id).slice(0, 200)}`);
        wolf?.click();
        const wolfFx = await until(() => fxNamed(pcAttacker, ['Rage of the Wolf']).find(e => !e.getFlag(MOD, 'emanation')) ?? null, { timeout: 8000 }).catch(() => null);
        const wolfCard = game.messages.contents.find(m => (m.timestamp >= t0) && (m.id !== card?.id) && (m.getAssociatedItem?.()?.id === wilds.id)) ?? null;
        ok('25c. Wolf chosen: the feature\'s own Wolf activity used (its card), "Rage of the Wolf" on the barbarian',
          (card?.getFlag(MOD, 'castApply')?.choice?.chosen === 'Wolf') && !!wolfCard && !!wolfFx,
          `chosen=${card?.getFlag(MOD, 'castApply')?.choice?.chosen} wolfCard=${wolfCard?.id ?? null} activity=${wolfCard?.getFlag('dnd5e', 'activity')?.id ?? null} fx=${wolfFx?.name ?? null}`);
        await sleep(800);
        // UNSURE — a probable DEFECT, not a test guess: polish.js castChoice keys the Wolf's own card by its item
        // (Rage of the Wilds IS the row's key), so that card may be stamped with a second free pick and re-open the
        // popup. Red here = the code, not the suite.
        ok('25d. the Wolf\'s own card asks nothing more (no second pick, no popup)', !wolfCard?.getFlag(MOD, 'castApply')?.choice && !pickButton('Wolf'),
          `wolfChoice=${JSON.stringify(wolfCard?.getFlag(MOD, 'castApply')?.choice ?? null)} popup=${!!pickButton('Wolf')}`);
        await closeA1();
        const region = await until(wolfRegion, { timeout: 10000 }).catch(() => null);
        const member = await until(() => memberOn(victim), { timeout: 8000 }).catch(() => null);
        ok('25e. the quiet ring: a region attached to the barbarian\'s token, the Victim within 5 ft wears the member copy; no emanation card; the Cleric (an ally) wears none',
          !!region && (region.attachment?.token?.id === pcToken.document.id) && !!member && !memberOn(cleric)
            && !game.messages.contents.some(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'emanationCard')?.key === 'Rage of the Wolf')),
          `region=${region?.id ?? null} flag=${JSON.stringify(region?.getFlag(MOD, 'emanation') ?? null)} member=${member?.name ?? null} victimFx=${JSON.stringify(victim.effects.map(e => [e.name, !!e.getFlag(MOD, 'emanation')]))} cleric=${!!memberOn(cleric)} cards=${game.messages.contents.filter(m => (m.timestamp >= t0) && m.getFlag(MOD, 'emanationCard')).map(m => m.getFlag(MOD, 'emanationCard').key)}`);
        if (!clericWeapon || !pcWeapon) log.push(`§25 gate skipped: clericWeapon=${!!clericWeapon} pcWeapon=${!!pcWeapon}`);
        else {
          const ally = await gateFor(clericToken, attackOf(cleric, clericWeapon), victimToken);
          ok('25f. the Cleric attacking the Victim: the gate lists "Rage of the Wolf", net Advantage',
            ally.open && /Rage of the Wolf/.test(ally.text) && (ally.net === 'advantage'), `net=${ally.net} text=${ally.text.slice(0, 220)}`);
          const own = await gateFor(pcToken, attackOf(pcAttacker, pcWeapon), victimToken);
          ok('25g. the barbarian\'s OWN attack at the Victim: no "Rage of the Wolf" row', own.open && !/Rage of the Wolf/.test(own.text),
            `net=${own.net} text=${own.text.slice(0, 220)}`);
        }
      } finally {
        await closeA1();
        await dropFx(pcAttacker, RAGE_FX);
        await unlend(pcAttacker, wilds);
        await unlend(pcAttacker, rage);
        const gone = await until(() => !wolfRegion() && !memberOn(victim), { timeout: 8000 }).catch(() => null);
        if (!gone) {
          log.push('§25 cleanup: the Wolf ring outlived its lends — deleted by hand');
          const r = wolfRegion(); if (r) await r.delete().catch(() => {});
          const m = memberOn(victim); if (m) await m.delete().catch(() => {});
        }
        clearTargets();
        // The prior active scene comes back in the TEARDOWN (see priorActiveScene): a switch here kills the placeables.
        await viewScene(scene);
      }
    });
    KIT.markA2();

    // ---- 37. the Initiative grants: Persistent Rage (automatic), Uncanny Metabolism (offered); the Rage reminder silenced
    if (want(37)) await section(37, async () => {
      await closeA1();
      await dropFx(pcAttacker, RAGE_FX);
      const hMax = halfling.system._source.attributes.hp.max;   // restored at this section's end: §41's swing heals to 400
      hgKeep(halfling, { 'system.attributes.hp.value': halfling.system._source.attributes.hp.value,
        'system.attributes.hp.max': hMax });
      const rage = await hgLend(pcAttacker, 'Rage', 'feat', { 'system.uses.max': '3', 'system.uses.spent': 2 });
      const persistent = await hgLend(pcAttacker, 'Persistent Rage', 'feat');
      const focus = await hgLend(halfling, "Monk's Focus", 'feat', { 'system.uses.max': '3', 'system.uses.spent': 3 });
      const uncanny = await hgLend(halfling, 'Uncanny Metabolism', 'feat');
      if (uncanny) await pinHeal(uncanny, 'Uncanny Metabolism', '1d8 + 5');
      const [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
      created.combats.push(combat.id);
      const spentOf = (actor, item) => Number(actor.items.get(item?.id)?.system?.uses?.spent ?? NaN);
      const hhp = () => Number(halfling.system.attributes.hp.value);
      try {
        if (!rage || !persistent || !focus || !uncanny) log.push(`§37 skipped: rage=${!!rage} persistent=${!!persistent} focus=${!!focus} uncanny=${!!uncanny}`);
        else {
          await halfling.update({ 'system.attributes.hp.max': 60, 'system.attributes.hp.value': 30 });
          // ⚠ The created combatants do not come back in the order asked: find each by its actor.
          await combat.createEmbeddedDocuments('Combatant', [
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id },
            { tokenId: halflingToken.document.id, sceneId: scene.id, actorId: halfling.id }]);
          const pcC = combat.combatants.find(c => c.actorId === pcAttacker.id);
          const hC = combat.combatants.find(c => c.actorId === halfling.id);
          // a. Persistent Rage: automatic — the Rage uses back, its own use spent, the card
          await combat.setInitiative(pcC.id, 18);
          const pr = await until(() => { const m = grantCards(pcAttacker, 'Persistent Rage')[0]; return m?.getFlag(MOD, 'initiativeGrant')?.applied ? m : null; }, { timeout: 8000 }).catch(() => null);
          ok('37a. Persistent Rage at Initiative: Rage 3 of 3, its own use spent, the card "Persistent Rage — Rage uses regained (3 of 3)"',
            !!pr && (spentOf(pcAttacker, rage) === 0) && (spentOf(pcAttacker, persistent) === 1) && /Persistent Rage — Rage uses regained \(3 of 3\)/.test(await grantLine(pr)),
            `card=${!!pr} rageSpent=${spentOf(pcAttacker, rage)} own=${spentOf(pcAttacker, persistent)} line="${await grantLine(pr)}" all=${JSON.stringify(grantCards(pcAttacker, 'Persistent Rage').map(m => m.getFlag(MOD, 'initiativeGrant')))} read=${JSON.stringify(combat.getFlag(MOD, 'initiativeGrantRead') ?? null)} rages=${JSON.stringify(pcAttacker.items.filter(i => /rage/i.test(i.name)).map(i => [i.name, i.system.uses?.max, i.system.uses?.spent]))} init=${pcC.initiative}`);
          // b. Uncanny Metabolism: offered; Yes — the Focus Points back, the heal rolled and landed, its use spent
          faces([[4, 8]]);
          await combat.setInitiative(hC.id, 12);
          const um = await until(() => grantCards(halfling, 'Uncanny Metabolism')[0] ?? null, { timeout: 8000 }).catch(() => null);
          const pop = await until(() => titled(/^Uncanny Metabolism — /), { timeout: 6000 }).catch(() => null);
          ok('37b. Uncanny Metabolism at Initiative asks: "regain 3 Focus Points and 1d8 + 5 Hit Points? (once per Long Rest)"',
            !!pop && /regain 3 Focus Points and 1d8 \+ 5 Hit Points\? \(once per Long Rest\)/.test(textOf(pop?.element)),
            `card=${!!um} popup=${!!pop} text="${textOf(pop?.element).slice(0, 200)}"`);
          pop?.element?.querySelector('button[data-action="yes"]')?.click();
          const done = await until(() => um?.getFlag(MOD, 'initiativeGrant')?.applied ? um : null, { timeout: 8000 }).catch(() => null);
          unrig();
          const healed = Number(done?.getFlag(MOD, 'initiativeGrant')?.healed ?? NaN);
          ok('37c. Yes: Focus 3 of 3, the heal (4 + 5 = 9) lands, its use spent; the line says both',
            (spentOf(halfling, focus) === 0) && (spentOf(halfling, uncanny) === 1) && (healed === 9) && (hhp() === 39)
              && /Focus Points regained \(3 of 3\), 9 Hit Points regained/.test(await grantLine(done)),
            `focus=${spentOf(halfling, focus)} own=${spentOf(halfling, uncanny)} healed=${healed} hp=${hhp()} line="${await grantLine(done)}"`);
          // d. rerolled: both spent — nothing is posted again
          const before = grantCards(pcAttacker, 'Persistent Rage').length + grantCards(halfling, 'Uncanny Metabolism').length;
          await rage.update({ 'system.uses.spent': 1 });
          await combat.resetAll();
          await sleep(600);
          await combat.setInitiative(pcC.id, 17);
          await combat.setInitiative(hC.id, 11);
          await sleep(2000);
          ok('37d. rerolled with both uses spent: no second card', (grantCards(pcAttacker, 'Persistent Rage').length + grantCards(halfling, 'Uncanny Metabolism').length) === before,
            `cards=${grantCards(pcAttacker, 'Persistent Rage').length + grantCards(halfling, 'Uncanny Metabolism').length} before=${before}`);
          // e. No keeps the use: nothing written
          await uncanny.update({ 'system.uses.spent': 0 });
          await focus.update({ 'system.uses.spent': 2 });
          await combat.resetAll();
          await sleep(600);
          await combat.setInitiative(hC.id, 10);
          const pop2 = await until(() => titled(/^Uncanny Metabolism — /), { timeout: 6000 }).catch(() => null);
          pop2?.element?.querySelector('button[data-action="no"]')?.click();
          const um2 = await until(() => grantCards(halfling, 'Uncanny Metabolism').find(m => m.getFlag(MOD, 'initiativeGrant')?.answer === 'no') ?? null, { timeout: 6000 }).catch(() => null);
          await sleep(600);
          ok('37e. No: the use kept, Focus untouched, the line "Uncanny Metabolism — kept for later"',
            !!um2 && (spentOf(halfling, uncanny) === 0) && (spentOf(halfling, focus) === 2) && /Uncanny Metabolism — kept for later/.test(await grantLine(um2)),
            `card=${!!um2} own=${spentOf(halfling, uncanny)} focus=${spentOf(halfling, focus)} line="${await grantLine(um2)}" read=${JSON.stringify(combat.getFlag(MOD, 'initiativeGrantRead') ?? null)} inits=${JSON.stringify(combat.combatants.map(c => c.initiative))} cards=${grantCards(halfling, 'Uncanny Metabolism').length}`);
          // f. Persistent Rage silences the Rage's turn-end reminder
          await combat.setInitiative(pcC.id, 20);
          await combat.startCombat();
          await sleep(400);
          const toTurnOf = async actor => { for (let i = 0; (i < 4) && (combat.combatant?.actorId !== actor.id); i++) { await combat.nextTurn(); await sleep(300); } };
          await toTurnOf(pcAttacker);
          await useFeature(pcToken, rage);
          await until(() => fxNamed(pcAttacker, ['Rage'])[0] ?? null, { timeout: 6000 }).catch(() => null);
          await combat.nextTurn();
          await toTurnOf(pcAttacker);
          const r2 = combat.round;
          await combat.nextTurn();
          await sleep(2500);
          const reminded = game.messages.contents.some(m => (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'turnGrant')?.remind === 'extend')
            && String(m.getFlag(MOD, 'turnGrant')?.place ?? '').startsWith(`${combat.id}|${r2}|`));
          ok('37f. with Persistent Rage a quiet raging turn ends with no reminder', !!fxNamed(pcAttacker, ['Rage'])[0] && !reminded,
            `rage=${!!fxNamed(pcAttacker, ['Rage'])[0]} reminded=${reminded}`);
        }
      } finally {
        await closeA1();
        await hgClose(/^Uncanny Metabolism — /);
        if (game.combats.get(combat.id)) await combat.delete();
        await dropFx(pcAttacker, RAGE_FX);
        await halfling.update({ 'system.attributes.hp.max': hMax });
        for (const [actor, it] of [[pcAttacker, rage], [pcAttacker, persistent], [halfling, focus], [halfling, uncanny]]) if (it) await unlend(actor, it);
        unrig();
        clearTargets();
      }
    });

    // ---- 38. Vitality of the Tree: Vitality Surge at the Rage; Life-Giving Force at a raging turn start
    if (want(38)) await section(38, async () => {
      await closeA1();
      await dropFx(pcAttacker, RAGE_FX);
      hgKeep(pcAttacker, { 'system.attributes.hp.temp': pcAttacker.system._source.attributes.hp.temp ?? 0 });
      hgKeep(cleric, { 'system.attributes.hp.temp': cleric.system._source.attributes.hp.temp ?? 0 });
      hgKeep(halfling, { 'system.attributes.hp.temp': halfling.system._source.attributes.hp.temp ?? 0 });
      const rage = await hgLend(pcAttacker, 'Rage', 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 });
      const vitality = await hgLend(pcAttacker, 'Vitality of the Tree', 'feat');
      if (vitality) { await pinHeal(vitality, 'Vitality Surge', '7'); await pinHeal(vitality, 'Life-Giving Force', '2d6'); }
      const temp = actor => Number(actor.system.attributes.hp.temp ?? 0);
      const songs = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'restSong')?.table === 'turn')
        && (m.getFlag(MOD, 'restSong')?.actorUuid === pcAttacker.uuid));
      let combat = null;
      try {
        if (!rage || !vitality) log.push(`§38 skipped: rage=${!!rage} vitality=${!!vitality}`);
        else {
          for (const a of [pcAttacker, cleric, halfling]) await a.update({ 'system.attributes.hp.temp': 0 });
          // a. the Rage used: Vitality Surge's 7 temp HP, a card
          const since = Date.now();
          await useFeature(pcToken, rage);
          const surge = await until(() => game.messages.contents.find(m => (m.timestamp >= since) && (m.getFlag(MOD, 'turnGrant')?.key === 'Vitality Surge')) ?? null, { timeout: 6000 }).catch(() => null);
          await until(() => temp(pcAttacker) === 7, { timeout: 4000 }).catch(() => null);
          ok('38a. the Rage used: "Vitality Surge — BTB Test PC Attacker gains 7 Temporary Hit Points", temp 7',
            !!surge && (temp(pcAttacker) === 7) && /Vitality Surge — .+ gains 7 Temporary Hit Points/.test(cardText(surge?.id)),
            `card=${cardText(surge?.id).slice(0, 160)} temp=${temp(pcAttacker)}`);
          // b. a raging turn start: the gift is asked — one creature within 10 ft; OK gives it
          await until(() => fxNamed(pcAttacker, ['Rage'])[0] ?? null, { timeout: 6000 }).catch(() => null);
          [combat] = await Combat.createDocuments([{ scene: scene.id, active: true }]);
          created.combats.push(combat.id);
          faces([[3, 6], [4, 6]]);
          await combat.createEmbeddedDocuments('Combatant', [
            { tokenId: pcToken.document.id, sceneId: scene.id, actorId: pcAttacker.id, initiative: 20 },
            { tokenId: victimToken.document.id, sceneId: scene.id, actorId: victim.id, initiative: 10 }]);
          await combat.startCombat();
          const ask = await until(() => songs()[0] ?? null, { timeout: 8000 }).catch(() => null);
          unrig();
          const flag = ask?.getFlag(MOD, 'restSong');
          const pop = await until(() => titled(/^Life-Giving Force — /), { timeout: 6000 }).catch(() => null);
          const names = (flag?.candidates ?? []).map(c => c.name);
          ok('38b. the raging turn start asks "Who gets 7 Temporary Hit Points?" — creatures on its side within 10 ft, never itself or the enemy',
            !!pop && (flag?.amount === 7) && (flag?.cap === 1) && /Who gets 7 Temporary Hit Points\?/.test(textOf(pop?.element))
              && names.length > 0 && !names.includes(pcToken.document.name) && !names.includes(victimToken.document.name),
            `amount=${flag?.amount} cap=${flag?.cap} candidates=${JSON.stringify(names)} popup=${!!pop}`);
          const picked = pop?.element?.querySelector('input[name="bf-rest-song"]:checked')?.value ?? null;
          pop?.element?.querySelector('button[data-action="ok"]')?.click();
          const landed = await until(() => ask?.getFlag(MOD, 'restSong')?.applied ? ask : null, { timeout: 8000 }).catch(() => null);
          const target = picked ? fromUuidSync(picked) : null;
          ok('38c. OK: the one ticked creature gains the 7 temp HP; the card names it', !!landed && !!target && (temp(target) === 7)
            && (landed.getFlag(MOD, 'restSong')?.given ?? []).length === 1,
            `picked=${target?.name ?? null} temp=${target ? temp(target) : null} given=${JSON.stringify(landed?.getFlag(MOD, 'restSong')?.given ?? null)}`);
          // c. the Rage ended: the next turn start asks nothing
          const asked = songs().length;
          await dropFx(pcAttacker, RAGE_FX);
          await combat.nextTurn(); await sleep(300);
          await combat.nextTurn();
          await sleep(2000);
          ok('38d. not raging: the turn start asks nothing', songs().length === asked, `asks=${songs().length} before=${asked}`);
        }
      } finally {
        await closeA1();
        await hgClose(/^Life-Giving Force — /);
        if (combat && game.combats.get(combat.id)) await combat.delete();
        await dropFx(pcAttacker, RAGE_FX);
        for (const it of [rage, vitality]) if (it) await unlend(pcAttacker, it);
        unrig();
        clearTargets();
      }
    });

    // ================================================ §B3 — Brutal Strike and the Fighter's rows (RULINGS *The PHB classes — B3*)
    // ---- 46. Brutal Strike: the forgo box in the attack dialog; the forgone hit's group; Hamstring Blow lands; no forgo, no group
    if (want(46)) await section(46, async () => {
      await closeA1(); await a1Victim(); await dropVictimFx(); await spendLuck();
      const bs = await hgLend(pcAttacker, 'Brutal Strike', 'feat');
      const ibs = await hgLend(pcAttacker, 'Improved Brutal Strike', 'feat');
      let reckless = null;
      try {
        const bsAct = bs?.system?.activities?.find(a => a.type === 'damage') ?? null;
        const wAct = pcWeapon ? attackOf(pcAttacker, pcWeapon) : null;
        const ability = wAct?.ability || 'str';
        if (!bs || !ibs || !bsAct || !wAct) log.push(`§46 skipped: bs=${!!bs} ibs=${!!ibs} act=${!!bsAct} weapon=${!!pcWeapon}`);
        else if (ability !== 'str') log.push(`§46 skipped: BTB Test PC Attacker's ${pcWeapon.name} attacks with ${ability}, not Strength`);
        else {
          await pinPart(bs, bsAct, '1d10');   // the fixture has no Barbarian scale
          [reckless] = await pcAttacker.createEmbeddedDocuments('ActiveEffect', [{ name: 'Reckless', img: 'icons/svg/sword.svg', transfer: false, disabled: false }]);
          await set('saveRolls', 'auto');
          await victim.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          pcToken.control({ releaseOthers: true }); clearTargets(); victimToken.setTarget(true, { releaseOthers: true });
          await sleep(120);
          const before = new Set(popups());
          faces([[19, 20], [19, 20], [3, 6], [3, 6], [7, 10], [7, 10]]);
          const p = wAct.rollAttack({}, {}, {});
          const dlg = await until(rollDialog, { timeout: 6000 }).catch(() => null);
          await sleep(400);
          const box = () => dlg?.element?.querySelector('input[name="bf-buy"][data-bf-buy-name="Brutal Strike"]') ?? null;
          const head = () => textOf(dlg?.element?.querySelector('[data-bf-reminder-head]'));
          const section = () => textOf(dlg?.element?.querySelector('[data-bf-reminder]'));
          const textBefore = section();
          ok('46a. the attack dialog with Reckless: "Reckless" in the section, Net Advantage, and the box "Brutal Strike — forgo the Advantage"',
            !!dlg && /Reckless/.test(textBefore) && /Net Advantage/.test(head()) && !!box(), `dlg=${!!dlg} box=${!!box()} head="${head()}" text="${textBefore.slice(0, 200)}"`);
          box()?.click();
          await sleep(350);
          const textAfter = section();
          ok('46b. ticked: "Reckless — forgone (Brutal Strike)", Net Normal', /forgone \(Brutal Strike\)/.test(textAfter) && /Net Normal/.test(head()), `head="${head()}" text="${textAfter.slice(0, 220)}"`);
          dlg?.element?.querySelector('button[data-action="normal"]')?.click();
          const rolls = await p.catch(() => null);
          const msg = rolls?.[0]?.parent ?? null;
          const rec = msg?.getFlag(MOD, 'reminder') ?? null;
          ok('46c. the roll\'s record: forgo "Brutal Strike", the Reckless source struck, rolled Normal',
            (rec?.forgo === 'Brutal Strike') && (rec?.sources ?? []).some(x => x.forgone && /Reckless/.test(x.label)) && (rec?.mode === 'normal'),
            `rec=${JSON.stringify(rec && { forgo: rec.forgo, net: rec.net, mode: rec.mode, sources: rec.sources })}`);
          const offer = await until(() => offerApp(before), { timeout: 6000 }).catch(() => null);
          const rows = hitRows(offer);
          ok('46d. the damage offer\'s group "Brutal Strike": Forceful, Hamstring, Staggering and Sundering Blow, each "1d10 · free"',
            !!offer && ['forceful-blow', 'hamstring-blow', 'staggering-blow', 'sundering-blow'].every(k => rows.includes(k)) && /1d10 · free/i.test(hitRow(offer, 'hamstring-blow')),
            `offer=${!!offer} rows=${JSON.stringify(rows)} row="${hitRow(offer, 'hamstring-blow').slice(0, 120)}"`);
          await tick(offer, 'hamstring-blow');
          const d = await a1Roll(msg, offer);
          const pick = d?.getFlag(MOD, 'hitManeuver')?.picks?.[0] ?? null;
          const hamstrung = await until(() => victimFx().find(e => e.name === 'Hamstrung') ?? null, { timeout: 8000 }).catch(() => null);
          ok('46e. Hamstring Blow: the 1d10 rode the damage, Hamstrung landed on the Victim',
            (pick?.key === 'hamstring-blow') && (pick?.formula === '1d10') && (pick?.rides === true) && !!hamstrung,
            `pick=${JSON.stringify(pick && { key: pick.key, formula: pick.formula, type: pick.type, rides: pick.rides })} hamstrung=${!!hamstrung}`);
          await dropVictimFx();
          const r2 = await a1Hit(pcAttacker, pcToken, wAct);
          ok('46f. a hit that forwent nothing (no dialog): no Brutal Strike group on the offer', !r2.offer || !hitBox(r2.offer, 'hamstring-blow'), `offer=${!!r2.offer} rows=${JSON.stringify(hitRows(r2.offer))}`);
          if (r2.offer) await a1Roll(r2.msg, r2.offer); else await a1Damage(r2.msg);
        }
      } finally {
        await closeA1(); await closeOffers(); await dropVictimFx();
        if (reckless) await reckless.delete().catch(() => {});
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [bs, ibs]) if (it) await unlend(pcAttacker, it);
        unrig(); clearTargets();
      }
    });

    // ---- 64. Relentless Rage: the save at the climbing DC, the heal on a success, the 0 on a failure
    if (want(64)) await section(64, async () => {
      await closeA1(); await spendLuckC();
      const barb = await hgLend(halfling, 'Barbarian', 'class', { 'system.levels': 11 });
      const rr = await hgLend(halfling, 'Relentless Rage', 'feat', { 'system.uses.max': '20', 'system.uses.spent': 0 });
      const rage = await markOn(halfling, 'Rage', rr?.uuid ?? null);
      try {
        if (!barb || !rr) log.push(`§64 skipped: barbarian=${!!barb} relentless=${!!rr}`);
        else {
          await sleep(300);
          const spent = () => Number(halfling.items.get(rr.id)?.system?.uses?.spent ?? NaN);
          const t0 = Date.now();
          await dropHalfling(5, [[20, 20]]);   // the Constitution save's d20 a 20
          const card = await until(() => dropCards(t0, 'Relentless Rage').find(m => m.getFlag(MOD, 'dropToOne')?.answer) ?? null, { timeout: 10000 }).catch(() => null);
          await until(() => hp() > 1, { timeout: 8000 }).catch(() => null);
          await sleep(400);
          unrig();
          const f = card?.getFlag(MOD, 'dropToOne');
          ok('64a. raging, dropped to 0: held at 1, the Constitution save at DC 10 rolled and SAVED, a use spent, 22 healed on top (1 + 2 × 11 = 23)',
            (f?.answer === 'saved') && (f?.save?.dc === 10) && (spent() === 1) && (hp() === 23),
            `flag=${JSON.stringify(f && { answer: f.answer, save: f.save })} spent=${spent()} hp=${hp()} card="${cardText(card?.id).slice(0, 160)}"`);
          const t1 = Date.now();
          await dropHalfling(5, [[1, 20]]);   // the second save's d20 a 1: DC 15 fails
          const card2 = await until(() => dropCards(t1, 'Relentless Rage').find(m => m.getFlag(MOD, 'dropToOne')?.answer) ?? null, { timeout: 10000 }).catch(() => null);
          await sleep(600);
          unrig();
          const f2 = card2?.getFlag(MOD, 'dropToOne');
          ok('64b. the next drop: the DC climbed to 15 (a use spent), the save FAILS, 0 lands', (f2?.answer === 'failed') && (f2?.save?.dc === 15) && (hp() === 0) && (spent() === 2),
            `flag=${JSON.stringify(f2 && { answer: f2.answer, save: f2.save })} hp=${hp()} spent=${spent()}`);
        }
      } finally {
        await closeA1();
        await clearDown(halfling);
        if (rage) await rage.delete().catch(() => {});
        for (const it of [rr, barb]) if (it) await unlend(halfling, it);
        await healFull();
        unrig(); clearTargets();
      }
    });

    // ---- 66. Rage of the Gods: the Zealot within 30 ft keeps an ally's drop
    if (want(66)) await section(66, async () => {
      await closeA1(); await spendLuckC();
      const barb = await hgLend(sorcerer, 'Barbarian', 'class', { 'system.levels': 14 });
      const rage = await hgLend(sorcerer, 'Rage', 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 });
      const rog = await hgLend(sorcerer, 'Rage of the Gods', 'feat');
      const raging = await markOn(sorcerer, 'Rage of the Gods', rog?.uuid ?? null);
      try {
        if (!barb || !rage || !rog) log.push(`§66 skipped: barbarian=${!!barb} rage=${!!rage} gods=${!!rog}`);
        else {
          await sleep(300);
          const t0 = Date.now();
          await dropHalfling(5);
          const pop = await until(() => titled(/^Rage of the Gods — /), { timeout: 8000 }).catch(() => null);
          const popText = textOf(pop?.element);
          const card0 = dropCards(t0, 'Rage of the Gods')[0] ?? null;
          ok('66a. the Halfling\'s drop asks the ZEALOT (15 ft away): "drop to @classes.barbarian.levels Hit Points instead?", the Rage use named, the card "held at 1 until BTB Test Sorcerer answers"',
            !!pop && /drop to @classes\.barbarian\.levels Hit Points instead\?/.test(popText) && /Rage/.test(popText) && (card0?.getFlag(MOD, 'dropToOne')?.keeperUuid === sorcerer.uuid) && (hp() === 1),
            `pop="${popText.slice(0, 220)}" keeper=${card0?.getFlag(MOD, 'dropToOne')?.keeperName ?? null} hp=${hp()}`);
          pop?.element?.querySelector('button[data-action="use"]')?.click();
          const card = await until(() => dropCards(t0, 'Rage of the Gods').find(m => m.getFlag(MOD, 'dropToOne')?.applied) ?? null, { timeout: 10000 }).catch(() => null);
          await until(() => hp() > 1, { timeout: 8000 }).catch(() => null);
          await sleep(400);
          ok('66b. Yes: the Halfling at 14 Hit Points (the barbarian\'s level), a Rage use spent, the line names the keeper',
            (hp() === 14) && (Number(sorcerer.items.get(rage.id)?.system?.uses?.spent) === 1) && /Rage of the Gods \(BTB Test Sorcerer's\)/.test(cardText(card?.id)) && /drops to 14 Hit Points instead/.test(cardText(card?.id)),
            `hp=${hp()} rageSpent=${sorcerer.items.get(rage.id)?.system?.uses?.spent} card="${cardText(card?.id).slice(0, 220)}"`);
        }
      } finally {
        await closeA1(); await hgClose(/^Rage of the Gods — /);
        await clearDown(halfling);
        if (raging) await raging.delete().catch(() => {});
        for (const it of [rog, rage, barb]) if (it) await unlend(sorcerer, it);
        await healFull();
        unrig(); clearTargets();
      }
    });

    // ---- 68. Power of the Wilds: the pick at the Rage; Lion's ring; Ram's press
    if (want(68)) await section(68, async () => {
      await closeA1(); await a1Victim(); await dropVictimFx();
      await dropFx(pcAttacker, RAGE_FX);
      await activateRange();
      const rage = await hgLend(pcAttacker, 'Rage', 'feat', { 'system.uses.max': '3', 'system.uses.spent': 0 });
      const wilds = await hgLend(pcAttacker, 'Power of the Wilds', 'feat');
      const victimWeapon = weaponOf(victim);
      const chipOn = () => pcAttacker.effects.find(e => e.getFlag(MOD, 'formChip')?.choice === 'Power of the Wilds') ?? null;
      const memberOn = actor => actor.effects.find(e => e.getFlag(MOD, 'emanation') && e.name.startsWith('Power of the Wilds: Lion')) ?? null;
      try {
        if (!rage || !wilds || !pcWeapon || !victimWeapon) log.push(`§68 skipped: rage=${!!rage} wilds=${!!wilds} weapon=${!!pcWeapon} victimWeapon=${!!victimWeapon}`);
        else {
          const card = await useFeature(pcToken, rage);
          const lion = await until(() => hgPickButton('Lion'), { timeout: 6000 }).catch(() => null);
          ok('68a. the Rage asks "Power of the Wilds — Falcon, Lion or Ram?"', !!lion && !!hgPickButton('Falcon') && !!hgPickButton('Ram') && (card?.getFlag(MOD, 'castApply')?.choice?.key === 'Power of the Wilds'),
            `choice=${JSON.stringify(card?.getFlag(MOD, 'castApply')?.choice ?? null)}`);
          lion?.click();
          const chip = await until(chipOn, { timeout: 6000 }).catch(() => null);
          const region = await until(() => regionKeyed('Power of the Wilds', pcToken.document.id), { timeout: 10000 }).catch(() => null);
          const member = await until(() => memberOn(victim), { timeout: 8000 }).catch(() => null);
          ok('68b. Lion: the chip "Power of the Wilds: Lion" on the barbarian, the quiet ring, the Victim within 5 ft wears the made member copy',
            (chip?.name === 'Power of the Wilds: Lion') && !!region && !!member && (member.changes?.length === 0),
            `chip=${chip?.name ?? null} region=${!!region} member=${member?.name ?? null}`);
          const other = await gateFor(victimToken, attackOf(victim, victimWeapon), halflingToken);
          const atRager = await gateFor(victimToken, attackOf(victim, victimWeapon), pcToken);
          ok('68c. the Victim attacking the Halfling: the gate lists "Power of the Wilds: Lion", net Disadvantage; attacking the rager: no row',
            other.open && /Power of the Wilds: Lion/.test(other.text) && (other.net === 'disadvantage') && atRager.open && !/Power of the Wilds: Lion/.test(atRager.text),
            `other=${other.net} "${other.text.slice(0, 160)}" rager=${atRager.net} "${atRager.text.slice(0, 120)}"`);
          await closeA1();
          // Ram: the pick kept as the chip, a melee hit's rider knocks the Victim Prone
          await chip?.delete().catch(() => {});
          await dropFx(pcAttacker, RAGE_FX);
          const card2 = await useFeature(pcToken, rage);
          const ram = await until(() => hgPickButton('Ram'), { timeout: 6000 }).catch(() => null);
          ram?.click();
          await until(() => chipOn()?.name === 'Power of the Wilds: Ram', { timeout: 6000 }).catch(() => null);
          await until(() => fxNamed(pcAttacker, ['Rage'])[0] ?? null, { timeout: 6000 }).catch(() => null);
          await closeA1();
          const r1 = await a1Hit(pcAttacker, pcToken, attackOf(pcAttacker, pcWeapon));
          ok('68d. Ram, raging: a melee hit offers the rider "Power of the Wilds — Ram" (it is knocked Prone)', !!riderBox(r1.offer, 'power-of-the-wilds-ram') && /knocked Prone/.test(riderRow(r1.offer, 'power-of-the-wilds-ram')),
            `card2=${!!card2} chip=${chipOn()?.name ?? null} row="${riderRow(r1.offer, 'power-of-the-wilds-ram').slice(0, 140)}"`);
          await a1Roll(r1.msg, r1.offer);
          const landed = await until(() => victimFx().find(e => e.name === 'Power of the Wilds: Ram') ?? null, { timeout: 8000 }).catch(() => null);
          ok('68e. it rode: the pack\'s "Power of the Wilds: Ram" (Prone) lands on the Victim', !!landed && landed.statuses?.has?.('prone'), `fx=${JSON.stringify(victimFx().map(e => e.name))}`);
        }
      } finally {
        await closeA1(); await closeOffers();
        await dropFx(pcAttacker, RAGE_FX);
        const c = chipOn(); if (c) await c.delete().catch(() => {});
        await dropVictimFx(); await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [wilds, rage]) if (it) await unlend(pcAttacker, it);
        const gone = await until(() => !regionKeyed('Power of the Wilds', pcToken.document.id) && !memberOn(victim), { timeout: 8000 }).catch(() => null);
        if (!gone) { const r = regionKeyed('Power of the Wilds', pcToken.document.id); if (r) await r.delete().catch(() => {}); const m = memberOn(victim); if (m) await m.delete().catch(() => {}); }
        unrig(); clearTargets();
        await backToRange();
      }
    });

    // ---- 92. Improved Brutal Strike at Barbarian 17: two different effects on one hit
    if (want(92)) await section(92, async () => {
      await closeA1(); await a1Victim(); await dropVictimFx(); await spendLuck();
      const barb = await hgLend(pcAttacker, 'Barbarian', 'class', { 'system.levels': 17 });
      const bs = await hgLend(pcAttacker, 'Brutal Strike', 'feat');
      const ibs = await hgLend(pcAttacker, 'Improved Brutal Strike', 'feat');
      let reckless = null;
      try {
        const bsAct = bs?.system?.activities?.find(a => a.type === 'damage') ?? null;
        const wAct = pcWeapon ? attackOf(pcAttacker, pcWeapon) : null;
        if (!barb || !bs || !ibs || !bsAct || !wAct) log.push(`§92 skipped: barb=${!!barb} bs=${!!bs} ibs=${!!ibs} act=${!!bsAct} weapon=${!!pcWeapon}`);
        else {
          await pinPart(bs, bsAct, '2d10');
          [reckless] = await pcAttacker.createEmbeddedDocuments('ActiveEffect', [{ name: 'Reckless', img: 'icons/svg/sword.svg', transfer: false, disabled: false }]);
          await set('saveRolls', 'auto');
          await victim.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          pcToken.control({ releaseOthers: true }); clearTargets(); victimToken.setTarget(true, { releaseOthers: true });
          await sleep(120);
          const before = new Set(popups());
          faces([[19, 20], [19, 20], [3, 6], [3, 6], [7, 10], [7, 10], [7, 10], [7, 10]]);
          const p = wAct.rollAttack({}, {}, {});
          const dlg = await until(rollDialog, { timeout: 6000 }).catch(() => null);
          await sleep(400);
          dlg?.element?.querySelector('input[name="bf-buy"][data-bf-buy-name="Brutal Strike"]')?.click();
          await sleep(350);
          dlg?.element?.querySelector('button[data-action="normal"]')?.click();
          const rolls = await p.catch(() => null);
          const msg = rolls?.[0]?.parent ?? null;
          const offer = await until(() => offerApp(before), { timeout: 6000 }).catch(() => null);
          await tick(offer, 'hamstring-blow', 'staggering-blow');
          await sleep(200);
          const both = !!hitBox(offer, 'hamstring-blow')?.checked && !!hitBox(offer, 'staggering-blow')?.checked;
          ok('92a. at Barbarian 17 the Brutal Strike group keeps TWO ticks (Hamstring and Staggering Blow) — the group\'s max is 2',
            !!offer && both, `offer=${!!offer} hamstring=${hitBox(offer, 'hamstring-blow')?.checked} staggering=${hitBox(offer, 'staggering-blow')?.checked} rows=${JSON.stringify(hitRows(offer))}`);
          const d = await a1Roll(msg, offer);
          const picks = d?.getFlag(MOD, 'hitManeuver')?.picks ?? [];
          ok('92b. both effects ride the one hit: two picks recorded, Hamstring and Staggering Blow',
            (picks.length === 2) && picks.some(x => x.key === 'hamstring-blow') && picks.some(x => x.key === 'staggering-blow'),
            `picks=${JSON.stringify(picks.map(x => ({ key: x.key, formula: x.formula, rides: x.rides })))}`);
        }
      } finally {
        await closeA1(); await closeOffers(); await dropVictimFx();
        if (reckless) await reckless.delete().catch(() => {});
        await dropEffects(pcAttacker, riderChits(pcAttacker));
        for (const it of [ibs, bs, barb]) if (it) await unlend(pcAttacker, it);
        unrig(); clearTargets();
      }
    });
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  }
} });

await finish({ tag: 'class-barbarian', out, plan, f });
