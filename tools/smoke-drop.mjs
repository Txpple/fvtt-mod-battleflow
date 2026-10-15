// Live suite: DROP TO 1 HP — Relentless Endurance asked with the Hit Points held at 1; Death Ward
// automatic (RULINGS, the drop-to-1 row); the GM's side (RULINGS *The GM's side — the five shapes*):
// Undead Fortitude's save held at 1 while the dice roll, and Death Throes at the corpse.
//
// Fixtures: BTB Test Halfling (tools/fixture-suite.mjs) is lent the PHB's Relentless Endurance and
// wears a "Protection from Death" effect for §1; BTB Test Monster is lent the Monster Manual's Undead
// Fortitude (§6–§8) and Death Throes (§9). Damage goes through the system's Actor#applyDamage —
// the road the card's buttons and the module's applier both take. Everything is put back.
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'drop-to-one.js'          // §1–§5 — the hold at 1, the ask, the answer, Death Ward, the outright kill; §6–§9 the save facet and the death's side
];

const SECTIONS = {
  1: 'Death Ward: damage past 0 leaves the Halfling at 1, the "Protection from Death" effect is gone, a card says so',
  2: 'Relentless Endurance, Drop to 1 HP: the Hit Points held at 1, the popup asks; the answer spends the use and the 1 stands',
  3: 'Relentless Endurance, Drop to 0: the 0 lands after the answer; the use stays',
  4: 'killed outright (the remainder meets the Hit Point maximum): no ask, the 0 lands at once',
  5: 'no use left: no ask, the 0 lands at once',
  6: 'UNDEAD FORTITUDE, saved (the GM\'s side): the Monster held at 1 while its Constitution save rolls on the keeper — DC 5 + the damage; a success leaves the 1 and the card says so',
  7: 'Undead Fortitude, failed: the 0 lands after the roll, the card says the total against the DC',
  8: 'Undead Fortitude\'s exemptions read off the damage card: Radiant damage and a Critical Hit land the 0 at once with a card saying why; damage with no card the module can read COUNTS the row (the save rolls)',
  9: 'DEATH THROES: the Monster killed with the trait on its sheet raises ONE demand card at the corpse — the Victim (10 ft away) among the targets, the corpse not, the fire and force rolled'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'drop', watchdogMs: 240_000 });
announcePlan('drop', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-bythebooks';
  const { until, watch, canvasReady, snapshotSettings } = window.__btb;
  const { results, log, skips, ok, want, section } = window.__btb.begin({ sections, titles });
  const suiteStart = Date.now();

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  if (!game.settings.settings.has(`${MOD}.decisionTimer`)) return { fatal: 'decisionTimer not registered — OLD code (reload the box)' };

  const SETTING_KEYS = ['dropToOneList', 'holdTimer', 'concMode', 'interruptList', 'saveRolls', 'decisionTimer'];
  const settings = snapshotSettings(SETTING_KEYS);
  const { set } = settings;
  const def = k => game.settings.settings.get(`${MOD}.${k}`)?.default;

  const actor = game.actors.getName('BTB Test Halfling');
  if (!actor || (actor.type !== 'character')) return { fatal: 'missing fixture: BTB Test Halfling (a character) — run tools/fixture-suite.mjs' };
  const priorHp = foundry.utils.deepClone(actor.system._source.attributes.hp);
  const monster = game.actors.getName('BTB Test Monster');
  const priorMonster = monster ? { hp: foundry.utils.deepClone(monster.system._source.attributes.hp), con: monster.system._source.abilities?.con?.save?.roll?.bonus ?? '' } : null;
  const lent = [];
  const lentMonster = [];
  const placedTokens = [];
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    for (const failed of await settings.restore()) log.push(`TEARDOWN settings ERROR: ${failed}`);
    try {
      for (const app of foundry.applications.instances.values()) {
        if (/drop to 1( Hit Point)? instead/.test(app.element?.textContent ?? '')) { try { await app.close(); } catch { /* gone */ } }
      }
      const live = lent.filter(id => actor.items.get(id));
      if (live.length) await actor.deleteEmbeddedDocuments('Item', live);
      const fx = actor.effects.filter(e => e.name === 'Protection from Death').map(e => e.id);
      if (fx.length) await actor.deleteEmbeddedDocuments('ActiveEffect', fx);
      await actor.update({ 'system.attributes.hp': priorHp });
      if (placedTokens.length) {
        const range = game.scenes.getName('By the Books Test Range');
        const live = placedTokens.filter(id => range?.tokens.get(id));
        if (live.length) await range.deleteEmbeddedDocuments('Token', live);
      }
      if (monster) {
        const liveM = lentMonster.filter(id => monster.items.get(id));
        if (liveM.length) await monster.deleteEmbeddedDocuments('Item', liveM);
        await monster.update({ 'system.attributes.hp': priorMonster.hp, 'system.abilities.con.save.roll.bonus': priorMonster.con });
      }
      const mine = game.messages.filter(m => (m.timestamp >= suiteStart) && ((m.speaker?.actor === actor.id) || (m.speaker?.actor === monster?.id) || Object.keys(m.flags?.[MOD] ?? {}).length));
      if (mine.length) await ChatMessage.deleteDocuments(mine.map(m => m.id));
    } catch (err) {
      log.push(`TEARDOWN ERROR: ${err?.message}`);
    }
  };

  try {
    await set('dropToOneList', def('dropToOneList'));
    await set('holdTimer', 0);                 // the ask waits for the suite's click
    await set('concMode', 'off');
    await set('interruptList', '');            // no Stone's Endurance or the like on the way
    let source = null;
    for (const pack of game.packs.filter(p => (p.metadata.packageName === 'dnd-players-handbook') && (p.documentName === 'Item'))) {
      const hit = (await pack.getIndex()).find(e => e.name === 'Relentless Endurance');
      if (hit) { source = await pack.getDocument(hit._id); break; }
    }
    if (!source) return { fatal: 'the PHB ships no "Relentless Endurance" item this box can find' };
    const [item] = await actor.createEmbeddedDocuments('Item', [source.toObject()]);
    lent.push(item.id);
    const relentless = () => actor.items.get(item.id);
    if (!(Number(relentless()?.system?.uses?.max) > 0)) return { fatal: `the lent Relentless Endurance carries no uses (${JSON.stringify(relentless()?.system?.uses)})` };

    const hpNow = () => Number(actor.system.attributes.hp.value);
    const setHp = (value, max = 40) => actor.update({ 'system.attributes.hp.max': max, 'system.attributes.hp.value': value, 'system.attributes.hp.temp': 0 });
    const refill = () => relentless()?.update({ 'system.uses.spent': 0 });
    const hit = n => actor.applyDamage([{ value: n, type: 'slashing' }]);
    const cardAfter = t0 => game.messages.contents.filter(m => (m.timestamp >= t0) && m.getFlag(MOD, 'dropToOne')).pop() ?? null;
    const popup = () => [...foundry.applications.instances.values()]
      .find(app => app.rendered && /drop to 1( Hit Point)? instead/.test(app.element?.textContent ?? '')) ?? null;
    const press = (app, action) => { const b = app?.element?.querySelector(`button[data-action="${action}"]`); b?.click(); return !!b; };

    // ================================================== 1. Death Ward
    if (want(1)) await section(1, async () => {
      await setHp(20);
      await actor.createEmbeddedDocuments('ActiveEffect', [{ name: 'Protection from Death', img: 'icons/magic/death/skull-horned-worn-fire-blue.webp' }]);
      const t0 = Date.now();
      await hit(30);
      const card = await until(() => cardAfter(t0), { timeout: 6000 });
      await until(() => (hpNow() === 1) && !actor.effects.some(e => e.name === 'Protection from Death'), { timeout: 4000, label: 'the Halfling at 1 with Protection from Death gone' });
      ok('1a. Death Ward: 20 HP takes 30 and stops at 1; the effect is gone; the card says so (automatic)',
        (hpNow() === 1) && !actor.effects.some(e => e.name === 'Protection from Death') && (card?.getFlag(MOD, 'dropToOne')?.answer === 'auto'),
        `hp=${hpNow()} effect=${actor.effects.some(e => e.name === 'Protection from Death')} card=${JSON.stringify(card?.getFlag(MOD, 'dropToOne'))}`);
    });

    // ================================================== 2. Relentless, Drop to 1
    if (want(2)) await section(2, async () => {
      await setHp(20); await refill();
      const t0 = Date.now();
      await hit(30);
      ok('2a. the Hit Points are held at 1 while the ask stands', hpNow() === 1, `hp=${hpNow()}`);
      const card = await until(() => cardAfter(t0), { timeout: 6000 });
      const app = await until(popup, { timeout: 6000 });
      ok('2b. the popup asks: "drops to 0 Hit Points — drop to 1 instead?", "1 of 1 use left"',
        !!app && /1 of 1 use left/.test(app.element?.textContent ?? '') && (card?.getFlag(MOD, 'dropToOne')?.status === 'pending'),
        `popup=${!!app} text="${(app?.element?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 140)}"`);
      press(app, 'use');
      await until(() => card?.getFlag(MOD, 'dropToOne')?.applied, { timeout: 8000 });
      await until(() => Number(relentless()?.system?.uses?.value) === 0, { timeout: 4000, label: 'the Relentless Endurance use spent' });
      const fell = await watch(() => hpNow() !== 1, { ms: 300 });
      ok('2c. Drop to 1 HP: the 1 stands, the use is spent', !fell && (hpNow() === 1) && (Number(relentless()?.system?.uses?.value) === 0),
        `hp=${hpNow()} fell=${!!fell} uses=${relentless()?.system?.uses?.value} flag=${JSON.stringify(card?.getFlag(MOD, 'dropToOne'))}`);
    });

    // ================================================== 3. Relentless, Drop to 0
    if (want(3)) await section(3, async () => {
      await setHp(20); await refill();
      const t0 = Date.now();
      await hit(30);
      const card = await until(() => cardAfter(t0), { timeout: 6000 });
      const app = await until(popup, { timeout: 6000 });
      press(app, 'pass');
      await until(() => card?.getFlag(MOD, 'dropToOne')?.applied, { timeout: 8000 });
      await until(() => hpNow() === 0, { timeout: 4000, label: 'the Halfling at 0' });
      const spent = await watch(() => Number(relentless()?.system?.uses?.value) !== 1, { ms: 300 });
      ok('3a. Drop to 0: the 0 lands after the answer, the use stays', !spent && (hpNow() === 0) && (Number(relentless()?.system?.uses?.value) === 1),
        `hp=${hpNow()} uses=${relentless()?.system?.uses?.value} spent=${!!spent}`);
    });

    // ================================================== 4. killed outright
    if (want(4)) await section(4, async () => {
      await setHp(20); await refill();
      const t0 = Date.now();
      await hit(60);                            // 20 to 0, 40 left over = the maximum
      const stray = await watch(() => cardAfter(t0) || popup(), { ms: 1200 });
      ok('4a. killed outright: no ask, the 0 lands at once', (hpNow() === 0) && !stray && !cardAfter(t0) && !popup(), `hp=${hpNow()} card=${!!cardAfter(t0)} stray=${!!stray}`);
    });

    // ================================================== 5. no use left
    if (want(5)) await section(5, async () => {
      await setHp(20);
      await relentless()?.update({ 'system.uses.spent': 1 });
      const t0 = Date.now();
      await hit(30);
      const stray = await watch(() => cardAfter(t0), { ms: 1200 });
      ok('5a. no use left: no ask, the 0 lands at once', (hpNow() === 0) && !stray && !cardAfter(t0), `hp=${hpNow()} card=${!!cardAfter(t0)} stray=${!!stray}`);
    });

    // ================================================== THE GM'S SIDE — BTB Test Monster
    const wantsMonster = [6, 7, 8, 9].some(n => !sections || sections.includes(String(n)));
    if (wantsMonster && !monster) return { fatal: 'missing fixture: BTB Test Monster — run tools/fixture-suite.mjs', results, log, skips };
    const lendTrait = async name => {
      const pack = game.packs.get('dnd-monster-manual.features');
      if (!pack) throw new Error('the Monster Manual features pack is not on this box');
      const hit = (await pack.getIndex()).find(e => e.name === name);
      if (!hit) throw new Error(`the Monster Manual ships no "${name}" this box can find`);
      const src = await pack.getDocument(hit._id);
      const [item] = await monster.createEmbeddedDocuments('Item', [src.toObject()]);
      lentMonster.push(item.id);
      return item;
    };
    const mHp = () => Number(monster.system.attributes.hp.value);
    const mSetHp = (value, max = 50) => monster.update({ 'system.attributes.hp.max': max, 'system.attributes.hp.value': value, 'system.attributes.hp.temp': 0 });
    const mConBonus = v => monster.update({ 'system.abilities.con.save.roll.bonus': v });
    /** A damage card the seam can read: one DamageRoll of `type`, a Critical Hit when asked. */
    const damageCard = async (type, { crit = false } = {}) => {
      const roll = await new CONFIG.Dice.DamageRoll('30', {}, { type, isCritical: crit }).evaluate();
      return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: monster }), rolls: [roll], flavor: `BTB test damage — ${type}${crit ? ' (critical)' : ''}` });
    };
    const mHit = async (n, type = 'slashing', { card = true, crit = false } = {}) => {
      const msg = card ? await damageCard(type, { crit }) : null;
      return monster.applyDamage([{ value: n, type }], msg ? { originatingMessage: msg } : {});
    };
    const mCardAfter = t0 => game.messages.contents.filter(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'dropToOne')?.actorUuid === monster.uuid)).pop() ?? null;
    const settled = t0 => until(() => { const c = mCardAfter(t0); return c?.getFlag(MOD, 'dropToOne')?.applied ? c : null; }, { timeout: 8000 });

    // ================================================== 6. Undead Fortitude, saved
    if (want(6)) await section(6, async () => {
      await lendTrait('Undead Fortitude');
      await mSetHp(20); await mConBonus('+100');
      const t0 = Date.now();
      await mHit(30);
      ok('6a. the Monster is held at 1 while its save rolls', mHp() === 1, `hp=${mHp()}`);
      const card = await settled(t0);
      const f = card?.getFlag(MOD, 'dropToOne');
      const fell = await watch(() => mHp() !== 1, { ms: 300 });
      ok('6b. the save rolled on the keeper: Constitution, DC 5 + 30 = 35, saved — the 1 stands, the card says so',
        (f?.row === 'Undead Fortitude') && (f?.answer === 'saved') && (f?.save?.ability === 'con') && (f?.save?.dc === 35) && (Number(f?.save?.total) >= 35) && !fell && (mHp() === 1)
          && /saves .*drops to 1 Hit Point instead/.test(card?.content ?? ''),
        `hp=${mHp()} fell=${!!fell} flag=${JSON.stringify(f)}`);
      const rollMsg = game.messages.contents.find(m => (m.timestamp >= t0) && m.getFlag(MOD, 'dropToOneSave'));
      ok('6c. the roll message carries the save\'s provenance (dropToOneSave: the row, the DC)',
        (rollMsg?.getFlag(MOD, 'dropToOneSave')?.row === 'Undead Fortitude') && (rollMsg?.getFlag(MOD, 'dropToOneSave')?.dc === 35),
        JSON.stringify(rollMsg?.getFlag(MOD, 'dropToOneSave')));
    });

    // ================================================== 7. Undead Fortitude, failed
    if (want(7)) await section(7, async () => {
      if (!monster.items.some(i => i.name === 'Undead Fortitude')) await lendTrait('Undead Fortitude');
      await mSetHp(20); await mConBonus('-100');
      const t0 = Date.now();
      await mHit(30);
      const card = await settled(t0);
      const f = card?.getFlag(MOD, 'dropToOne');
      await until(() => mHp() === 0, { timeout: 4000, label: 'the Monster at 0' });
      ok('7a. a failed save lands the 0 after the roll; the card says the total against DC 35',
        (f?.answer === 'failed') && (f?.save?.dc === 35) && (Number(f?.save?.total) < 35) && (mHp() === 0) && /fails the save .*drops to 0/.test(card?.content ?? ''),
        `hp=${mHp()} flag=${JSON.stringify(f)}`);
    });

    // ================================================== 8. the exemptions
    if (want(8)) await section(8, async () => {
      if (!monster.items.some(i => i.name === 'Undead Fortitude')) await lendTrait('Undead Fortitude');
      await mConBonus('+100');
      // 8a: Radiant — no save, the 0 at once, the card says why.
      await mSetHp(20);
      let t0 = Date.now();
      await mHit(30, 'radiant');
      let card = await settled(t0);
      let f = card?.getFlag(MOD, 'dropToOne');
      const saveRoll = await watch(() => game.messages.contents.find(m => (m.timestamp >= t0) && m.getFlag(MOD, 'dropToOneSave')), { ms: 300 });
      ok('8a. Radiant damage: no save, the 0 lands at once, the card says "Radiant damage: no save"',
        (mHp() === 0) && (f?.answer === 'exempt') && (f?.why === 'Radiant damage') && !saveRoll && !game.messages.contents.some(m => (m.timestamp >= t0) && m.getFlag(MOD, 'dropToOneSave')),
        `hp=${mHp()} saveRoll=${!!saveRoll} flag=${JSON.stringify(f)}`);
      // 8b: a Critical Hit — the same.
      await mSetHp(20);
      t0 = Date.now();
      await mHit(30, 'slashing', { crit: true });
      card = await settled(t0);
      f = card?.getFlag(MOD, 'dropToOne');
      await until(() => mHp() === 0, { timeout: 4000, label: 'the Monster at 0' });
      ok('8b. a Critical Hit: no save, the 0 lands at once, the card says "a Critical Hit: no save"',
        (mHp() === 0) && (f?.answer === 'exempt') && (f?.why === 'a Critical Hit'),
        `hp=${mHp()} flag=${JSON.stringify(f)}`);
      // 8c: damage with no card — the gate never guesses an exemption: the save rolls.
      await mSetHp(20);
      t0 = Date.now();
      await mHit(30, 'radiant', { card: false });
      card = await settled(t0);
      f = card?.getFlag(MOD, 'dropToOne');
      const fell = await watch(() => mHp() !== 1, { ms: 300 });
      ok('8c. damage the module cannot read (no card) COUNTS the row: the save rolls and, made, the 1 stands',
        (f?.answer === 'saved') && !fell && (mHp() === 1), `hp=${mHp()} fell=${!!fell} flag=${JSON.stringify(f)}`);
      await mConBonus('');
    });

    // ================================================== 9. Death Throes
    if (want(9)) await section(9, async () => {
      const uf = monster.items.filter(i => i.name === 'Undead Fortitude').map(i => i.id);
      if (uf.length) await monster.deleteEmbeddedDocuments('Item', uf);
      const throes = await lendTrait('Death Throes');
      const act = throes.system.activities.find(a => a.type === 'save');
      log.push(`Death Throes on the sheet: DC ${act?.save?.dc?.value} ${[...(act?.save?.ability ?? [])].join('/')} · template ${act?.target?.template?.type} ${act?.target?.template?.size} ${act?.target?.template?.units} · parts ${act?.damage?.parts?.length}`);
      const scene = game.scenes.getName('By the Books Test Range');
      if (canvas.scene?.id !== scene?.id) await scene?.view();
      await canvasReady();
      const corpseToken = canvas.tokens.placeables.find(t => t.actor?.uuid === monster.uuid);
      const victim = game.actors.getName('BTB Test Victim');
      // The Victim's own token, placed 10 ft from the corpse for the section (the fixture line moves under walks).
      const g = scene.grid.size;
      const [victimDoc] = corpseToken ? await scene.createEmbeddedDocuments('Token', [foundry.utils.mergeObject(victim.prototypeToken.toObject(),
        { x: corpseToken.document.x + 2 * g, y: corpseToken.document.y, actorId: victim.id, actorLink: true }, { inplace: false })]) : [null];
      if (victimDoc) placedTokens.push(victimDoc.id);
      const victimToken = await until(() => victimDoc ? canvas.tokens.get(victimDoc.id) : null, { timeout: 8000 }).catch(() => null);   // 9-pre reports a missing one
      ok('9-pre. the corpse stands on the range and the Victim is placed 10 feet from it', !!corpseToken && !!victimToken, `corpse=${!!corpseToken} victim=${!!victimToken}`);
      await set('saveRolls', 'auto');
      await set('decisionTimer', 0);
      await mSetHp(20);
      const t0 = Date.now();
      await mHit(60, 'slashing', { card: false });
      const card = await until(() => game.messages.contents.find(m => (m.timestamp >= t0) && m.getFlag(MOD, 'deathThroes')) ?? null, { timeout: 10000 });
      const dt = card?.getFlag(MOD, 'deathThroes');
      const saves = card?.getFlag(MOD, 'saves');
      const uuids = (saves?.targets ?? []).map(t => t.uuid);
      ok('9a. the 0 landed and ONE card rose at the corpse: Death Throes, the Monster dead, the count on the flag',
        (mHp() === 0) && (dt?.key === 'Death Throes') && (dt?.actorUuid === monster.uuid) && (Number(dt?.count) >= 1) && (dt?.feet > 0),
        `hp=${mHp()} flag=${JSON.stringify(dt)}`);
      ok('9b. the demand: a Dexterity save at the trait\'s DC, the Victim among the targets, the corpse not, the count the flag\'s',
        !!saves && (saves.abilities?.[0] === 'dex') && (saves.dc === act?.save?.dc?.value) && uuids.includes(victimToken?.actor?.uuid) && !uuids.includes(monster.uuid) && (uuids.length === dt?.count) && (saves.pinnedTargets === true),
        `abilities=${saves?.abilities} dc=${saves?.dc} targets=${(saves?.targets ?? []).map(t => t.name).join(',')}`);
      const dmg = await until(() => game.messages.contents.find(m => (m.timestamp >= t0) && (m.type === 'damage') && (m._source.system?.origin === card?.id)) ?? null, { timeout: 8000 });
      ok('9c. the fire and force rolled, chained to the card (the activity’s own onSave — the balor’s is none on a success)',
        !!dmg && (saves?.hasDamage === true) && (saves?.damageOnSave === (act?.damage?.onSave ?? 'half')) && dmg.rolls.some(r => /fire/.test(r.options?.type ?? '')),
        `dmg=${!!dmg} types=${dmg?.rolls?.map(r => r.options?.type).join(',')}`);
      await until(() => game.messages.get(card?.id)?.getFlag(MOD, 'saves')?.status === 'done', { timeout: 20000 });
      const done = game.messages.get(card?.id)?.getFlag(MOD, 'saves');
      ok('9d. the saves machine resolves it from there (every verdict done under the auto roll)',
        done?.status === 'done', `status=${done?.status} done=${(done?.targets ?? []).map(t => `${t.name}:${t.outcome}`).join(',')}`);
      // Each target's consequences (the fire and force) land before its entry reads `applied`: the Hit Points reset after.
      await until(() => (game.messages.get(card?.id)?.getFlag(MOD, 'saves')?.targets ?? []).every(t => t.applied), { timeout: 10000, label: 'every Death Throes target applied' });
      for (const t of (done?.targets ?? [])) {
        const a = await fromUuid(t.uuid);
        if (a instanceof Actor) await a.update({ 'system.attributes.hp.value': a.system.attributes.hp.max });
      }
    });

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'drop', out, plan, f });
