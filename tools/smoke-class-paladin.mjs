// Classes smoke suite — Paladin: the PHB classes plan's rows (audits/plans/session-0-classes.md) for
// the Paladin, each section keeping its number and title. The fixtures, the lends, the
// helpers and the teardown are the classes kit's (tools/class-kit.mjs); everything written is restored.
import { announcePlan, connectSuite, finish, sectionPlan } from './harness.mjs';
import { runClassSuite } from './class-kit.mjs';

// The coverage map (tools/coverage-map.mjs) parses this; ⚠ never import a suite (it connects on evaluation).
export const COVERS = [
  'hold/trigger.js',        // Glorious Defense on a hit (§13)
  'hold/lookup.js',         // the paladin within 10 ft (§13)
  'hold/answer.js',         // the Cha off the attack (§13)
  'hold/views.js',          // the Glorious Defense popup and the strike (§13)
  'hold/continue.js',       // the hit turned into a miss (§13)
  'hold/dice.js',           // the bent roll's chips (§13)
  'token-lights.js',        // Sacred Weapon's light (§23), Holy Nimbus (§103)
  'emanations.js',          // Smite of Protection, the paladin 20 auras (§77, §103–§105)
  'turn-grants.js',         // Elder Champion's regeneration (§105)
  'rest-grants.js',         // Inspiring Smite's division (§40)
  'cast-riders.js',         // Inspiring Smite's ask (§40)
  'rebukes.js',             // Soul of Vengeance's strike (§78)
  'drop-to-one.js'          // Undying Sentinel (§65)
];

const SECTIONS = {
  13: 'Glorious Defense: the Attacker hits the Halfling 10 ft from the Cleric (lent Glorious Defense) by 0 — the Cleric\'s popup "−<Cha mod, min 1>"; Answer turns it to a MISS, a use spent; the Strike popup "Strike BTB Test Attacker with <weapon>?" drives one weapon attack at the Attacker',
  23: 'Sacred Weapon: the use lights the Cleric\'s token 20 ft Bright / 40 ft Dim ("while the weapon\'s enchantment stands"); the weapon\'s enchantment deleted puts the light out (the token back to its prior light)',
  40: 'Inspiring Smite (lent to the Cleric): after Divine Smite, "Divide 12 Temporary Hit Points" with a number per creature within 30 ft, the paladin among them; 7 and 5 land and one Channel Divinity is spent; No keeps it; the clock gives all 12 to the paladin',
  65: 'Undying Sentinel (C1, the Halfling a Paladin 15): the drop asks "drop to 1 Hit Point instead? · and the heal"; Yes: 1 + 45, the use spent',
  77: 'Smite of Protection (C1, the Cleric a Paladin 15 with the aura): Divine Smite cast — the paladin and the Halfling inside wear "Smite of Protection" (Half Cover), the cast card\'s line',
  78: 'Soul of Vengeance (C1, the Cleric 5 ft from the Attacker under its Vow): the Attacker\'s attack card raises the paladin\'s popup "attacked — strike?"',
  103: "Holy Nimbus (D1, the Cleric a Paladin 20): the sunlight on the paladin; an enemy starting its turn in the aura takes the radiant damage",
  104: "Avenging Angel (D1, the Cleric a Paladin 20): an enemy starting its turn in the aura saves or is Frightened; attacks against it read Advantage",
  105: "Elder Champion (D1, the Cleric a Paladin 20): the form's mark, the ring's Diminished Defiance on the Victim, Regeneration's 10 at the turn start"
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'class-paladin', watchdogMs: 900_000 });
announcePlan('class-paladin', plan, pulled);

const out = await runClassSuite(f, { plan, sections: SECTIONS, body: async ({ sections, titles }) => {
  const { sleep, until, faces, unrig } = window.__btb;
  const { results, skips, ok, want, section } = window.__btb.begin({ sections, titles });
  const KIT = window.__btbClasses;
  const { MOD, a1Victim, activateRange, atkMod, attackOf, attacker, attackerToken, backToRange, c1Cards, cardEl, cardText, castSpell, clearDown, clearTargets, cleric, clericToken, clericWeapon, closeA1, closeDialogs, d1Cards, d1Combat, d1Region, divinity, dropCards, dropEffects, dropHalfling, dropNamed, dropReactionChips, gateFor, halfling, halflingDoc, halflingToken, healFull, hgClose, hgKeep, hgLend, hgStrike, holdOf, hp, lend, log, markOn, pcAttacker, pcToken, pcWeapon, pickApply, pinHeal, popupTitled, popups, regionKeyed, resolvedTarget, scene, set, spendLuck, spendLuckC, strikePopup, suiteStart, swing, textOf, titleOf, titled, unlend, useFeature, victim, victimToken } = KIT;
  try {
    await KIT.leaveA3();
    // ---- 13. Glorious Defense: the paladin's Cha off an attack on a creature within 10 ft; the strike after
    if (want(13)) await section(13, async () => {
      await closeDialogs(); await spendLuck();
      const gd = await lend(cleric, 'Glorious Defense');
      const gdAct = gd.system.activities?.find?.(a => a.name === 'Glorious Defense') ?? null;
      // UNSURE: the pack's uses max (a Cha-mod formula, long rest?). Forced to a live pool when it reads 0.
      if (!(Number(gd.system.uses?.max) > 0)) { log.push(`§13: Glorious Defense ships uses.max="${gd.system.uses?.max}" — forced to 2`); await gd.update({ 'system.uses.max': '2' }); }
      await gd.update({ 'system.uses.spent': 0 });
      const spentBefore = Number(cleric.items.get(gd.id)?.system?.uses?.spent ?? 0);
      const N = Math.max(1, Number(cleric.getRollData()?.abilities?.cha?.mod ?? 0));
      // The hit by exactly 0: the attack total = the Halfling's AC, so −N (N ≥ 1) always turns it (the margin gate asks).
      const d = Math.max(2, Math.min(19, Number(halfling.system.attributes.ac.value) - atkMod));
      const msg = await swing({ d20: [d] });
      const pop = await until(() => popupTitled(/Glorious Defense/), { timeout: 6000 }).catch(() => null);
      const guards = holdOf(msg)?.targets?.[0]?.guards ?? [];
      const g = guards.find(x => (x.uuid === cleric.uuid) && (x.row === 'Glorious Defense'));
      ok(`13a. the hit on the Halfling (within 10 ft of the Cleric) is held for the Cleric: a bystander popup "Glorious Defense … −${N} · a Reaction", "within 10 ft of BTB Test Halfling"`,
        !!pop && new RegExp(`−${N}\\b`).test(textOf(pop?.element)) && /a Reaction/.test(textOf(pop?.element))
          && /within 10 ft of BTB Test Halfling/.test(textOf(pop?.element)) && !!g && !g.quiet && (String(g.die) === String(N)),
        `N=${N} d20=${d} activity=${!!gdAct} pop="${textOf(pop?.element).slice(0, 220)}" guards=${JSON.stringify(guards.map(x => [x.name, x.row, x.die, x.quiet ?? false]))}`);
      pickApply(pop);
      const t = await resolvedTarget(msg);
      const spentAfter = Number(cleric.items.get(gd.id)?.system?.uses?.spent ?? 0);
      ok(`13b. −${N} off the attack: a MISS, answered by the Cleric (rescue Glorious Defense), one use spent, no damage`,
        (t?.answer === 'roll') && (t?.verdict === 'miss') && (t?.rescue === 'Glorious Defense') && (t?.guardedBy?.uuid === cleric.uuid)
          && (t?.bent?.add === -N) && (spentAfter === spentBefore + 1) && (hp() === 400),
        JSON.stringify({ answer: t?.answer, verdict: t?.verdict, rescue: t?.rescue, by: t?.guardedBy?.name, bent: t?.bent, spent: [spentBefore, spentAfter],
          consumption: gdAct?.consumption?.targets?.map?.(c => [c.type, c.target]) ?? null, hp: hp() }));
      await sleep(600);
      ok(`13c. the attack card: "Glorious Defense (BTB Test Cleric) −${N} … MISS"`,
        new RegExp(`Glorious Defense \\(BTB Test Cleric\\) −${N}.*MISS`).test(cardText(msg?.id)), cardText(msg?.id).slice(0, 240));
      // The turned hit: the Strike popup (answer.js offerStrike) — one weapon attack at the attacker.
      const strike = await until(strikePopup, { timeout: 6000 }).catch(() => null);
      const attackerName = attackerToken.document?.name ?? attacker.name;
      ok(`13d. the Strike popup: "Glorious Defense — strike back", "Strike ${attackerName} with <weapon>?", Strike and Pass`,
        !!strike && new RegExp(`Strike ${attackerName} with .+\\?`).test(textOf(strike?.element))
          && !!strike?.element?.querySelector('button[data-action="strike"]') && !!strike?.element?.querySelector('button[data-action="pass"]'),
        `title="${titleOf(strike)}" text="${textOf(strike?.element).slice(0, 200)}"`);
      // A natural 1: the driven attack misses — nothing lands on the Attacker, no chain to follow.
      const since = Date.now();
      faces([[1, 20]]);
      strike?.element?.querySelector('button[data-action="strike"]')?.click();
      const driven = await until(() => game.messages.contents.find(m => (m.timestamp >= since) && (m.getFlag(MOD, 'riposteFor') === msg?.id)
        && m.rolls?.length && (m.getAssociatedActor?.()?.uuid === cleric.uuid)), { timeout: 10000 }).catch(() => null);
      const tgt = driven?.system?.targets ?? [];
      ok('13e. Strike drives ONE weapon attack by the Cleric, marked riposteFor the turned attack',
        !!driven && (game.messages.contents.filter(m => (m.timestamp >= since) && (m.getFlag(MOD, 'riposteFor') === msg?.id) && m.rolls?.length).length === 1),
        `driven=${!!driven} item=${driven?.getAssociatedActivity?.()?.item?.name ?? null} d20=${driven?.rolls?.[0]?.total}`);
      ok('13f. the driven attack is AT the Attacker (its targets name it)', tgt.some?.(x => (x.actor ?? x.uuid) === attacker.uuid),
        `targets=${JSON.stringify((tgt ?? []).map?.(x => [x.name, x.actor ?? x.uuid]) ?? tgt)}`);
      await sleep(800);
      try { await strikePopup()?.close(); } catch { /* gone */ }
      await closeDialogs();
      await unlend(cleric, gd);
    });

    // ---- 23. Sacred Weapon's light goes out with the weapon's enchantment
    if (want(23)) await section(23, async () => {
      await closeDialogs();
      const sw = await hgLend(cleric, 'Sacred Weapon', 'feat');
      const act = sw ? cleric.items.get(sw.id)?.system.activities.find(a => a.type === 'enchant') : null;
      const weapon = clericWeapon ? cleric.items.get(clericWeapon.id) : null;
      const cdoc = clericToken.document;
      const lightNow = () => ({ bright: scene.tokens.get(cdoc.id)?.light?.bright ?? null, dim: scene.tokens.get(cdoc.id)?.light?.dim ?? null });
      const lightFx = () => cleric.effects.find(e => e.getFlag(MOD, 'tokenLight')?.key === 'Sacred Weapon') ?? null;
      const enchantOn = () => cleric.items.get(weapon?.id)?.effects?.find(e => (e.type === 'enchantment') && (e.name === 'Sacred Weapon')) ?? null;
      if (!act || !weapon) log.push(`§23 skipped: activity=${!!act} weapon=${!!weapon}`);
      else {
        const before = lightNow();
        clericToken.control({ releaseOthers: true });
        game.user.targets.forEach(t => { t.setTarget(false, { releaseOthers: true }); });
        await sleep(100);
        // The Paladin's Channel Divinity is not on this sheet: the use spends nothing (the light is the row under test).
        const res = await act.use({ consume: { resources: false, spellSlot: false, action: false }, subsequentActions: false }, { configure: false }, {});
        const card = res?.message ?? null;
        const fx = await until(lightFx, { timeout: 8000 }).catch(() => null);
        const lit = await until(() => (lightNow().bright === 20) ? lightNow() : null, { timeout: 5000 }).catch(() => null);
        const keys = (fx?.system?.changes ?? []).map(ch => `${ch.key}=${ch.value}`);
        ok('23a. the use lights the Cleric\'s token: 20 ft Bright, 40 ft Dim (the light effect, the enchantment\'s 10-minute clock)',
          !!fx && keys.includes('token.light.bright=20') && keys.includes('token.light.dim=40') && !!lit && (lit.dim === 40),
          `effect=${fx?.name ?? null} changes=[${keys.join(', ')}] light=${JSON.stringify(lightNow())} before=${JSON.stringify(before)} duration=${JSON.stringify(fx?._source?.duration ?? null)}`);
        await sleep(500);
        ok('23b. the card says "Sacred Weapon — … sheds light: 20 ft Bright, 20 ft more Dim · while the weapon\'s enchantment stands"',
          /Sacred Weapon — .+ sheds light: 20 ft Bright, 20 ft more Dim/.test(cardText(card?.id)) && /while the weapon's enchantment stands/.test(cardText(card?.id)),
          `flag=${JSON.stringify(card?.getFlag(MOD, 'tokenLight')?.landed?.map(l => l.name) ?? null)} text=${cardText(card?.id).slice(-240)}`);
        // dnd5e enchants on a weapon DROPPED on the card: the suite applies the use's profile to the Cleric's weapon.
        // UNSURE: `act.effects[0]._id` is the profile id applyEnchantment wants (dnd5e.mjs:36541 finds p._id).
        const profileId = act.effects?.[0]?._id ?? null;
        try { await act.applyEnchantment(profileId, weapon, { chatMessage: card, strict: false }); }
        catch (err) { log.push(`§23 applyEnchantment threw: ${err?.message}`); }
        const ench = await until(enchantOn, { timeout: 5000 }).catch(() => null);
        ok('23c. the weapon carries the Sacred Weapon enchantment; the light still stands', !!ench && !!lightFx() && (lightNow().bright === 20),
          `enchant=${ench?.name ?? null} weapon=${cleric.items.get(weapon.id)?.name} light=${JSON.stringify(lightNow())}`);
        if (ench) await ench.delete();
        const out = await until(() => !lightFx() && (lightNow().bright === before.bright) && (lightNow().dim === before.dim), { timeout: 8000 }).catch(() => null);
        ok('23d. the enchantment deleted: the light effect goes and the token is back to its prior light',
          out, `effect=${lightFx()?.name ?? null} light=${JSON.stringify(lightNow())} before=${JSON.stringify(before)}`);
      }
      // restore: any enchantment or light left behind, the lend
      const leftEnch = enchantOn();
      if (leftEnch) await leftEnch.delete().catch(() => {});
      const leftLight = cleric.effects.filter(e => e.getFlag(MOD, 'tokenLight')?.key === 'Sacred Weapon').map(e => e.id);
      if (leftLight.length) await cleric.deleteEmbeddedDocuments('ActiveEffect', leftLight).catch(() => {});
      if (sw) await unlend(cleric, sw);
    });
    KIT.markA2();

    // ---- 40. Inspiring Smite: after Divine Smite, the temp HP divided; No keeps the Channel Divinity; the clock gives all to the paladin
    if (want(40)) await section(40, async () => {
      await closeA1();
      hgKeep(cleric, { 'system.attributes.hp.temp': cleric.system._source.attributes.hp.temp ?? 0, 'system.spells': foundry.utils.deepClone(cleric.system._source.spells) });
      hgKeep(pcAttacker, { 'system.attributes.hp.temp': pcAttacker.system._source.attributes.hp.temp ?? 0 });
      hgKeep(halfling, { 'system.attributes.hp.temp': halfling.system._source.attributes.hp.temp ?? 0 });
      const smite = await hgLend(cleric, 'Inspiring Smite', 'feat');
      if (smite) await pinHeal(smite, 'Heal', '2d8 + 3');
      const divineSmite = await hgLend(cleric, 'Divine Smite', 'spell', { 'system.prepared': 1, 'system.method': 'spell' });
      const cd = divinity();
      const cdSpent = () => Number(divinity()?.system?.uses?.spent ?? NaN);
      const temp = actor => Number(actor.system.attributes.hp.temp ?? 0);
      const asks = () => game.messages.contents.filter(m => (m.timestamp >= suiteStart) && (m.getFlag(MOD, 'restSong')?.row === 'Inspiring Smite'));
      const smiteOnce = async () => {
        const before = asks().length;
        faces([[4, 8], [5, 8]]);   // 2d8 = 9, + 3 = 12
        await castSpell(cleric, clericToken, divineSmite, 1, victimToken);
        const ask = await until(() => (asks().length > before) ? asks().at(-1) : null, { timeout: 8000 }).catch(() => null);
        unrig();
        return ask;
      };
      const priorTimer = game.settings.get(MOD, 'decisionTimer');
      try {
        if (!smite || !divineSmite || !cd) log.push(`§40 skipped: smite=${!!smite} divineSmite=${!!divineSmite} cd=${!!cd}`);
        else {
          await cleric.update({ 'system.spells.spell1.value': 4 });
          await cd.update({ 'system.uses.spent': 0 });
          for (const a of [cleric, pcAttacker, halfling]) await a.update({ 'system.attributes.hp.temp': 0 });
          // a. the popup: 12 to divide among the creatures within 30 ft, the paladin too
          const ask = await smiteOnce();
          const pop = await until(() => titled(/^Inspiring Smite — /), { timeout: 6000 }).catch(() => null);
          const inputs = [...(pop?.element?.querySelectorAll('input[name="bf-rest-song-n"]') ?? [])];
          const byName = n => inputs.find(i => i.dataset.name === n);
          ok('40a. after Divine Smite: "Divide 12 Temporary Hit Points" with a number per creature, the paladin among them',
            !!pop && (ask?.getFlag(MOD, 'restSong')?.amount === 12) && /Divide 12 Temporary Hit Points/.test(textOf(pop?.element)) && !!byName(clericToken.document.name) && !!byName(pcToken.document.name),
            `amount=${ask?.getFlag(MOD, 'restSong')?.amount} names=${JSON.stringify(inputs.map(i => i.dataset.name))}`);
          // b. 7 to the paladin, 5 to the PC: both land, the Channel Divinity spent once
          const set = (input, n) => { if (input) { input.value = String(n); input.dispatchEvent(new Event('input', { bubbles: true })); } };
          set(byName(clericToken.document.name), 7);
          set(byName(pcToken.document.name), 5);
          pop?.element?.querySelector('button[data-action="ok"]')?.click();
          await until(() => ask?.getFlag(MOD, 'restSong')?.applied, { timeout: 8000 }).catch(() => null);
          ok('40b. 7 and 5: the paladin 7 temp HP, the PC 5, one Channel Divinity spent',
            (temp(cleric) === 7) && (temp(pcAttacker) === 5) && (cdSpent() === 1), `cleric=${temp(cleric)} pc=${temp(pcAttacker)} cd=${cdSpent()}`);
          // c. No: nothing given, nothing spent
          for (const a of [cleric, pcAttacker]) await a.update({ 'system.attributes.hp.temp': 0 });
          const ask2 = await smiteOnce();
          const pop2 = await until(() => titled(/^Inspiring Smite — /), { timeout: 6000 }).catch(() => null);
          pop2?.element?.querySelector('button[data-action="no"]')?.click();
          await until(() => ask2?.getFlag(MOD, 'restSong')?.status === 'resolved', { timeout: 6000 }).catch(() => null);
          await sleep(800);
          ok('40c. No: nothing given, the Channel Divinity kept', (temp(cleric) === 0) && (cdSpent() === 1), `cleric=${temp(cleric)} cd=${cdSpent()}`);
          // d. the clock: all 12 to the paladin
          await game.settings.set(MOD, 'decisionTimer', 2);
          const ask3 = await smiteOnce();
          await until(() => ask3?.getFlag(MOD, 'restSong')?.applied, { timeout: 10000 }).catch(() => null);
          ok('40d. the clock gives all 12 to the paladin, the Channel Divinity spent', (temp(cleric) === 12) && (cdSpent() === 2),
            `cleric=${temp(cleric)} cd=${cdSpent()} flag=${JSON.stringify(ask3?.getFlag(MOD, 'restSong')?.picks ?? null)}`);
        }
      } finally {
        await game.settings.set(MOD, 'decisionTimer', priorTimer);
        await closeA1();
        await hgClose(/^Inspiring Smite — /);
        for (const it of [smite, divineSmite]) if (it) await unlend(cleric, it);
        if (cd) await cd.update({ 'system.uses.spent': 0 });
        unrig();
        clearTargets();
      }
    });

    // ---- 65. Undying Sentinel: the ask with a heal
    if (want(65)) await section(65, async () => {
      await closeA1(); await spendLuckC();
      const pal = await hgLend(halfling, 'Paladin', 'class', { 'system.levels': 15 });
      const us = await hgLend(halfling, 'Undying Sentinel', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 0 });
      try {
        if (!pal || !us) log.push(`§65 skipped: paladin=${!!pal} sentinel=${!!us}`);
        else {
          await sleep(300);
          const t0 = Date.now();
          await dropHalfling(5);
          const pop = await until(() => titled(/^Undying Sentinel — /), { timeout: 8000 }).catch(() => null);
          const popText = textOf(pop?.element);
          ok('65a. the drop asks: "drops to 0 Hit Points — drop to 1 Hit Point instead?" with the heal named, the Halfling held at 1',
            !!pop && /drop to 1 Hit Point instead\?/.test(popText) && /and the heal/.test(popText) && (hp() === 1), `pop="${popText.slice(0, 200)}" hp=${hp()}`);
          pop?.element?.querySelector('button[data-action="use"]')?.click();
          const card = await until(() => dropCards(t0, 'Undying Sentinel').find(m => m.getFlag(MOD, 'dropToOne')?.applied) ?? null, { timeout: 10000 }).catch(() => null);
          await until(() => hp() > 1, { timeout: 8000 }).catch(() => null);
          await sleep(400);
          ok('65b. Yes: 1 + 3 × 15 = 46 Hit Points, the use spent, the card line "drops to 1 Hit Point instead"',
            (hp() === 46) && (Number(halfling.items.get(us.id)?.system?.uses?.spent) === 1) && /drops to 1 Hit Point instead/.test(cardText(card?.id)),
            `hp=${hp()} spent=${halfling.items.get(us.id)?.system?.uses?.spent} card="${cardText(card?.id).slice(0, 200)}"`);
        }
      } finally {
        await closeA1(); await hgClose(/^Undying Sentinel — /);
        await clearDown(halfling);
        for (const it of [us, pal]) if (it) await unlend(halfling, it);
        await healFull();
        unrig(); clearTargets();
      }
    });

    // ---- 77. Smite of Protection: Half Cover on the aura's members after Divine Smite
    if (want(77)) await section(77, async () => {
      await closeA1(); await a1Victim();
      await activateRange();
      hgKeep(cleric, { 'system.spells': foundry.utils.deepClone(cleric.system._source.spells) });
      const pal = await hgLend(cleric, 'Paladin', 'class', { 'system.levels': 15 });
      const aura = await hgLend(cleric, 'Aura of Protection', 'feat');
      const sop = await hgLend(cleric, 'Smite of Protection', 'feat');
      const divineSmite = await hgLend(cleric, 'Divine Smite', 'spell', { 'system.prepared': 1, 'system.method': 'spell' });
      const hx = halflingDoc.x, hy = halflingDoc.y;
      const smiteFx = actor => actor.effects.find(e => (e.name === 'Smite of Protection') && !e.transfer) ?? null;
      try {
        if (!pal || !aura || !sop || !divineSmite) log.push(`§77 skipped: paladin=${!!pal} aura=${!!aura} smite=${!!sop} divineSmite=${!!divineSmite}`);
        else {
          await sleep(300);
          await cleric.update({ 'system.spells.spell1.value': 4 });
          // ⚠ The range is 2000 x 2000: the main row (y 2100) is OFF the scene, and Foundry refuses any move onto y >= 2000
          // (the update returns undefined, nothing moves). Moves go on the north rows.
          await halflingDoc.update({ x: 1700, y: 1900 });   // 5 ft from the cleric: inside the 10-ft aura
          await sleep(600);
          const region = await until(() => regionKeyed('Aura of Protection', clericToken.document.id), { timeout: 12000 }).catch(() => null);
          await until(() => halfling.effects.some(e => e.getFlag(MOD, 'emanation') && e.name.startsWith('Protected')), { timeout: 10000 }).catch(() => null);
          const c = await castSpell(cleric, clericToken, divineSmite, 1, victimToken);
          const onCleric = await until(() => smiteFx(cleric), { timeout: 10000 }).catch(() => null);
          const onHalfling = await until(() => smiteFx(halfling), { timeout: 8000 }).catch(() => null);
          const line = (await until(() => cardEl(c?.id)?.querySelector('.bf-cast-rider-line'), { timeout: 6000 }).catch(() => null))?.textContent?.trim() ?? '';
          ok('77a. Divine Smite cast inside the aura: the paladin and the Halfling wear "Smite of Protection" (the coverHalf status, a clock to the paladin\'s next turn); the Victim (an enemy) none; the cast card\'s line',
            !!region && !!onCleric && !!onHalfling && onCleric.statuses?.has?.('coverHalf') && !smiteFx(victim) && /Smite of Protection — Smite of Protection \(Half Cover\) on/.test(line) && new RegExp(halflingToken.document.name).test(line),
            `region=${!!region} cleric=${!!onCleric} halfling=${!!onHalfling} statuses=${JSON.stringify([...(onCleric?.statuses ?? [])])} victim=${!!smiteFx(victim)} line="${line}"`);
        }
      } finally {
        await closeA1();
        for (const a of [cleric, halfling, victim, pcAttacker]) await dropNamed(a, ['Smite of Protection']);
        await halflingDoc.update({ x: hx, y: hy });
        for (const it of [divineSmite, sop, aura, pal]) if (it) await unlend(cleric, it);
        const gone = await until(() => !regionKeyed('Aura of Protection', clericToken.document.id), { timeout: 8000 }).catch(() => null);
        if (!gone) { const r = regionKeyed('Aura of Protection', clericToken.document.id); if (r) await r.delete().catch(() => {}); }
        for (const a of [halfling, pcAttacker]) await dropEffects(a, a.effects.filter(e => e.getFlag(MOD, 'emanation')).map(e => e.id));
        unrig(); clearTargets();
        await backToRange();
      }
    });

    // ---- 78. Soul of Vengeance: the Vow's creature attacks — the paladin within 5 ft is offered the strike
    if (want(78)) await section(78, async () => {
      await closeA1(); await spendLuckC(); await dropReactionChips(cleric); await a1Victim();
      const vow = await hgLend(cleric, 'Vow of Enmity', 'feat');
      const soul = await hgLend(cleric, 'Soul of Vengeance', 'feat');
      const cx = clericToken.document.x, cy = clericToken.document.y;
      let marked = null;
      try {
        if (!vow || !soul || !pcWeapon) log.push(`§78 skipped: vow=${!!vow} soul=${!!soul} weapon=${!!pcWeapon}`);
        else {
          // ⚠ The Attacker's row (y 2100) is OFF the 2000 x 2000 range: nobody can be moved beside it. The PC Attacker
          // (1400, 1900) wears the Vow and strikes the Victim; the cleric moves 5 ft north of it (1400, 1800).
          await clericToken.document.update({ x: 1400, y: 1800 });
          await sleep(400);
          marked = await markOn(pcAttacker, 'Vow of Enmity', vow.uuid);
          const t0 = Date.now();
          const msg = await hgStrike(pcAttacker, pcToken, pcWeapon, victimToken);
          const card = await until(() => c1Cards(t0, 'rebuke').find(m => m.getFlag(MOD, 'rebuke')?.onAttack && (m.getFlag(MOD, 'rebuke')?.actorUuid === cleric.uuid)) ?? null, { timeout: 8000 }).catch(() => null);
          const pop = await until(() => popups().find(app => /Soul of Vengeance/.test(textOf(app.element)) && /attacked — strike\?/.test(textOf(app.element))) ?? null, { timeout: 6000 }).catch(() => null);
          const f = card?.getFlag(MOD, 'rebuke');
          ok('78a. the PC Attacker under the Vow makes an attack roll: the paladin\'s popup "BTB Test PC Attacker attacked — strike?" with Soul of Vengeance (a melee attack), the card "under BTB Test Cleric\'s Vow of Enmity"',
            !!msg && !!card && !!pop && (f?.options ?? []).some(o => o.name === 'Soul of Vengeance') && /Vow of Enmity/.test(cardText(card?.id)),
            `card=${!!card} pop=${!!pop} options=${JSON.stringify((f?.options ?? []).map(o => o.name))} distance=${f?.distance ?? null} text="${cardText(card?.id).slice(0, 200)}" msg=${msg?.id ?? null}`);
          pickApply(pop, 'pass');
          await sleep(500);
        }
      } finally {
        await closeA1(); await hgClose(/Soul of Vengeance|attacked/);
        if (marked) await marked.delete().catch(() => {});
        await clericToken.document.update({ x: cx, y: cy });
        await dropReactionChips(cleric);
        for (const it of [soul, vow]) if (it) await unlend(cleric, it);
        await healFull();
        unrig(); clearTargets();
      }
    });

    // ---- 103. Holy Nimbus: an enemy starting its turn in the aura takes the radiant damage
    if (want(103)) await section(103, async () => {
      await closeA1(); await activateRange(); await a1Victim();
      const pal = await hgLend(cleric, 'Paladin', 'class', { 'system.levels': 20 });
      const nimbus = await hgLend(cleric, 'Holy Nimbus', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 0 });
      let combat = null;
      try {
        if (!pal || !nimbus) log.push(`§103 skipped: paladin=${!!pal} nimbus=${!!nimbus}`);
        else {
          await sleep(300);
          await useFeature(clericToken, nimbus, 'Holy Nimbus');
          const lit = await until(() => cleric.effects.find(e => (e.name === 'Holy Nimbus') && e.getFlag(MOD, 'tokenLight')) ?? null, { timeout: 8000 }).catch(() => null);
          const region = await until(() => { const r = d1Region('Holy Nimbus', clericToken.document.id); return (r?.behaviors?.size) ? r : null; }, { timeout: 12000 }).catch(() => null);
          ok('103a. the use lands "Holy Nimbus" on the paladin (its sunlight), the ring stands at the Aura of Protection\'s reach', !!lit && !!region,
            `lit=${!!lit} region=${!!region} radius=${region?.shapes?.[0]?.radius ?? null}`);
          await victim.update({ 'system.attributes.hp.value': 400, 'system.attributes.hp.temp': 0 });
          const t0 = Date.now();
          combat = await d1Combat([[victimToken, victim, 20], [clericToken, cleric, 10]]);
          await combat.startCombat();
          const card = await until(() => d1Cards(t0, 'emanationTrigger').find(m => m.getFlag(MOD, 'emanationTrigger')?.key === 'Holy Nimbus') ?? null, { timeout: 10000 }).catch(() => null);
          await until(() => Number(victim.system.attributes.hp.value) < 400, { timeout: 8000 }).catch(() => null);
          ok('103b. the Victim starts its turn inside: the card "Holy Nimbus — … started its turn inside", radiant damage landed (no save)',
            !!card && (Number(victim.system.attributes.hp.value) < 400), `card=${!!card} hp=${victim.system.attributes.hp.value} text="${cardText(card?.id).slice(0, 160)}"`);
        }
      } finally {
        await closeA1();
        if (combat && game.combats.get(combat.id)) await combat.delete();
        await dropNamed(cleric, ['Holy Nimbus']);
        for (const it of [nimbus, pal]) if (it) await unlend(cleric, it);
        const gone = await until(() => !d1Region('Holy Nimbus', clericToken.document.id), { timeout: 8000 }).catch(() => null);
        if (!gone) { const r = d1Region('Holy Nimbus', clericToken.document.id); if (r) await r.delete().catch(() => {}); }
        await dropEffects(victim, victim.effects.filter(e => e.getFlag(MOD, 'chip')).map(e => e.id));
        unrig(); clearTargets();
        await backToRange();
      }
    });

    // ---- 104. Avenging Angel: an enemy starting its turn in the aura saves or is Frightened; attacks against it at Advantage
    if (want(104)) await section(104, async () => {
      await closeA1(); await activateRange(); await set('saveRolls', 'auto');
      const pal = await hgLend(cleric, 'Paladin', 'class', { 'system.levels': 20 });
      const angel = await hgLend(cleric, 'Avenging Angel', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 0 });
      let combat = null;
      try {
        if (!pal || !angel) log.push(`§104 skipped: paladin=${!!pal} angel=${!!angel}`);
        else {
          await sleep(300);
          await useFeature(clericToken, angel, 'Avenging Angel');
          const self = await until(() => cleric.effects.find(e => e.name === 'Avenging Angel') ?? null, { timeout: 8000 }).catch(() => null);
          const region = await until(() => { const r = d1Region('Avenging Angel', clericToken.document.id); return (r?.behaviors?.size) ? r : null; }, { timeout: 12000 }).catch(() => null);
          ok('104a. the use lands "Avenging Angel" on the paladin (the flight), the Frightful Aura ring stands', !!self && !!region, `self=${!!self} region=${!!region}`);
          const t0 = Date.now();
          faces([[1, 20]]);
          combat = await d1Combat([[victimToken, victim, 20], [clericToken, cleric, 10]]);
          await combat.startCombat();
          const card = await until(() => d1Cards(t0, 'emanationTrigger').find(m => m.getFlag(MOD, 'emanationTrigger')?.key === 'Avenging Angel') ?? null, { timeout: 10000 }).catch(() => null);
          const fr = await until(() => victim.effects.find(e => (e.name === 'Frightened') && e.statuses?.has?.('frightened')) ?? null, { timeout: 15000 }).catch(() => null);
          unrig();
          ok('104b. the Victim starts its turn inside: the Wisdom save demanded at the paladin\'s DC; a 1 FAILS — Frightened lands',
            !!card && (card.getFlag(MOD, 'saves')?.abilities ?? []).includes('wis') && !!fr, `card=${!!card} saves=${JSON.stringify(card?.getFlag(MOD, 'saves') && { dc: card.getFlag(MOD, 'saves').dc, abilities: card.getFlag(MOD, 'saves').abilities })} frightened=${!!fr}`);
          if (combat && game.combats.get(combat.id)) await combat.delete();
          combat = null;
          const wAct = pcWeapon ? attackOf(pcAttacker, pcWeapon) : null;
          const gate = wAct ? await gateFor(pcToken, wAct, victimToken) : { text: '', open: false };
          ok('104c. an attack at the Frightened Victim reads the Frightful Aura row — "Frightened", net Advantage', gate.open && /Frightened/.test(gate.text) && /Frightful Aura/.test(gate.text) && (gate.net === 'advantage'), `net=${gate.net} text="${gate.text.slice(0, 220)}"`);
        }
      } finally {
        await closeA1();
        if (combat && game.combats.get(combat.id)) await combat.delete();
        await dropNamed(cleric, ['Avenging Angel']); await dropNamed(victim, ['Frightened']);
        for (const it of [angel, pal]) if (it) await unlend(cleric, it);
        const gone = await until(() => !d1Region('Avenging Angel', clericToken.document.id), { timeout: 8000 }).catch(() => null);
        if (!gone) { const r = d1Region('Avenging Angel', clericToken.document.id); if (r) await r.delete().catch(() => {}); }
        await dropEffects(victim, victim.effects.filter(e => e.getFlag(MOD, 'chip')).map(e => e.id));
        unrig(); clearTargets();
        await backToRange();
      }
    });

    // ---- 105. Elder Champion: the form's mark on the paladin, Diminish Defiance on the enemies inside, Regeneration at the turn start
    if (want(105)) await section(105, async () => {
      await closeA1(); await activateRange();
      hgKeep(cleric, { 'system.attributes.hp.value': cleric.system._source.attributes.hp.value, 'system.attributes.hp.max': cleric.system._source.attributes.hp.max });
      const pal = await hgLend(cleric, 'Paladin', 'class', { 'system.levels': 20 });
      const elder = await hgLend(cleric, 'Elder Champion', 'feat', { 'system.uses.max': '1', 'system.uses.spent': 0 });
      let combat = null;
      try {
        if (!pal || !elder) log.push(`§105 skipped: paladin=${!!pal} elder=${!!elder}`);
        else {
          await sleep(300);
          await useFeature(clericToken, elder, 'Elder Champion');
          const mark = await until(() => cleric.effects.find(e => (e.name === 'Diminished Defiance') && e.getFlag(MOD, 'tokenLight')) ?? null, { timeout: 8000 }).catch(() => null);
          const member = await until(() => victim.effects.find(e => e.name.startsWith('Diminished Defiance') && e.getFlag(MOD, 'emanation')) ?? null, { timeout: 12000 }).catch(() => null);
          ok('105a. the use lands "Diminished Defiance" on the paladin (no light written), the ring\'s Victim wears the member copy',
            !!mark && !!member && !JSON.stringify(mark?.changes ?? mark?.system?.changes ?? []).includes('token.light'), `mark=${!!mark} member=${!!member} changes=${JSON.stringify(mark?.changes ?? mark?.system?.changes ?? null)}`);
          await cleric.update({ 'system.attributes.hp.max': 100, 'system.attributes.hp.value': 50 });
          combat = await d1Combat([[clericToken, cleric, 20]]);
          await combat.startCombat();
          await until(() => Number(cleric.system.attributes.hp.value) > 50, { timeout: 8000 }).catch(() => null);
          await sleep(300);
          ok('105b. the paladin\'s turn start: Regeneration heals 10 (50 → 60)', Number(cleric.system.attributes.hp.value) === 60, `hp=${cleric.system.attributes.hp.value}`);
        }
      } finally {
        await closeA1();
        if (combat && game.combats.get(combat.id)) await combat.delete();
        await dropNamed(cleric, ['Diminished Defiance']); await dropEffects(victim, victim.effects.filter(e => e.name.startsWith('Diminished Defiance')).map(e => e.id));
        for (const it of [elder, pal]) if (it) await unlend(cleric, it);
        const gone = await until(() => !d1Region('Elder Champion', clericToken.document.id), { timeout: 8000 }).catch(() => null);
        if (!gone) { const r = d1Region('Elder Champion', clericToken.document.id); if (r) await r.delete().catch(() => {}); }
        unrig(); clearTargets();
        await backToRange();
      }
    });
    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  }
} });

await finish({ tag: 'class-paladin', out, plan, f });
