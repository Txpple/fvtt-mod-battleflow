// Live suite: THE MASTERY RECORD (issue #3) — the fill from equipped weapons and the GM's whisper,
// the "not mastered" line on an attack card and its Master it, the long-rest swap landed on the
// sheet's own list, and the party view's door in the group sheet's header controls.
//
// Fixtures: BF Test Fighter (tools/fixture-suite.mjs; Fighter 5, so the PHB's rows allow 4) is lent
// the PHB's Longsword, Longbow, Dagger and Greatsword, the Weapon Master feat, Tactical Master and the
// Fighter's own Weapon Mastery feature as the sections need them and, for the
// party-membership gates, the player test user's ownership. Its stored mastery list is put back.
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'mastery-record.js'       // §1 the fill, §2 the line and Master it, §3 the swap and its confirmation, §4 the party view's door, §5 the trim, §6 the feat, §7 Tactical Master, §8 the feature's card
];

const SECTIONS = {
  1: 'THE FILL: an empty list on a Fighter 5 with a Longsword and a Longbow equipped is written to [longsword, longbow] (2 of 4 open), and ONE GM whisper names the picks',
  2: 'THE LINE: a Dagger attack by a wielder whose list lacks daggers draws "not mastered … pick at your next Long Rest" under the attack card, no button (RAW); a full list says so',
  3: 'THE REST: a Long Rest posts the ask (the pool: the sheet\'s proficient kinds not chosen); the swap lands Longbow → Greatsword on the sheet with the confirmation; open slots are filled from the popup',
  4: 'THE DOOR: the group sheet\'s header controls carry "Weapon masteries" for the GM (the getHeaderControls hook FIRED), and the view lists the Fighter against its allowance',
  5: 'THE TRIM: a list one over the allowance at a Long Rest asks to drop one (OK held until exactly one is ticked); the drop lands, outcome trimmed, the confirmation names the list',
  6: 'THE FEAT: the Weapon Master feat on the sheet raises the allowance by one (5 for a Fighter 5)',
  7: 'TACTICAL MASTER: its Push / Sap / Slow ride mastery.bonus, never the list or the allowance; an attack with a chosen kind stamps the mastery and draws no line',
  8: 'THE RECORD: the Weapon Mastery feature\'s own card carries "has these masteries" and opens the popup for the owner'
};
const DEPENDS = {};

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'mastery-record', watchdogMs: 240_000 });
announcePlan('mastery-record', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-battleflow';
  const LIST = 'system.traits.weaponProf.mastery.value';
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
  const waitFor = async (test, timeout = 8000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) { const v = await test(); if (v) return v; await sleep(200); }
    return test();
  };

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  const api = modDoc.api?.masteryRecord;
  if (!api?.fillActors) return { fatal: 'no masteryRecord api — OLD code (reload the box)' };

  const fighter = game.actors.getName('BF Test Fighter');
  if (!fighter || (fighter.type !== 'character')) return { fatal: 'missing fixture: BF Test Fighter (a character) — run tools/fixture-suite.mjs' };
  const priorList = [...(fighter.system._source.traits?.weaponProf?.mastery?.value ?? [])];
  const priorOwnership = foundry.utils.deepClone(fighter._source.ownership ?? { default: 0 });
  // ⚠ The fixture is built from the pack without the class's proficiency advancement, so its weapons read
  // "not proficient" (prof.multiplier 0) and the fill would take none: a real Fighter holds sim + mar.
  const PROF = 'system.traits.weaponProf.value';
  const priorProf = [...(fighter.system._source.traits?.weaponProf?.value ?? [])];
  await fighter.update({ [PROF]: ['sim', 'mar'] });
  const playerUser = game.users.find(u => !u.isGM) ?? null;
  const lent = [];
  const made = [];
  let restored = false;
  const teardown = async () => {
    if (restored) return;
    restored = true;
    try {
      for (const app of foundry.applications.instances.values()) {
        if (/Weapon Mastery/.test(app.element?.textContent ?? '')) { try { await app.close(); } catch { /* gone */ } }
      }
      const live = lent.filter(id => fighter.items.get(id));
      if (live.length) await fighter.deleteEmbeddedDocuments('Item', live);
      await fighter.update({ [LIST]: priorList, [PROF]: priorProf });
      await fighter.update({ ownership: priorOwnership }, { diff: false, recursive: false });
      for (const a of made) { if (game.actors.get(a.id)) await a.delete(); }
    } catch (err) { log.push(`TEARDOWN ERROR: ${err?.message}`); }
  };

  const listNow = () => [...(fighter.system._source.traits?.weaponProf?.mastery?.value ?? [])];
  const setList = list => fighter.update({ [LIST]: list });
  const lend = async (name, { equipped = true } = {}) => {
    const pack = game.packs.get('dnd-players-handbook.equipment');
    if (!pack) throw new Error("the Player's Handbook equipment pack is not on this box");
    const hit = (await pack.getIndex()).find(e => e.name === name);
    if (!hit) throw new Error(`the PHB ships no "${name}" this box can find`);
    const src = (await pack.getDocument(hit._id)).toObject();
    src.system.equipped = equipped;
    const [item] = await fighter.createEmbeddedDocuments('Item', [src]);
    lent.push(item.id);
    return item;
  };
  const asPartyMember = async () => {
    if (!playerUser) return false;
    await fighter.update({ ownership: { default: 0, [playerUser.id]: 3 } }, { diff: false, recursive: false });
    return true;
  };
  const rowUnder = id => document.querySelector(`[data-message-id="${id}"] .battleflow-mastery-record`);
  // ⚠ Only the dialogs: the chat sidebar is an application too, and its cards carry the same words.
  const dialogs = () => [...foundry.applications.instances.values()].filter(a => a instanceof foundry.applications.api.DialogV2);

  try {
    // ⚠ An applied swap card never acknowledged re-opens its confirmation on every connect (by design): clear the last run's.
    for (const m of game.messages.contents.filter(m => m.getFlag(MOD, 'masterySwap')?.applied && !m.getFlag(MOD, 'masterySwap')?.acknowledged)) {
      await modDoc.api.acknowledgeMoment(m, 'masterySwap');
    }
    for (const app of dialogs()) { if (/Weapon Mastery/.test(app.element?.textContent ?? '')) { try { await app.close(); } catch { /* gone */ } } }
    const r0 = api.recordOf(fighter);
    ok('0. the fixture: a Fighter 5 whose class rows allow 4 kinds (the PHB\'s Weapon Mastery advancements, 3 at 1 and +1 at 4)', r0.allowance === 4, `allowance=${r0.allowance}`);

    // ================================================== 1. the fill
    if (want(1)) {
      await setList([]);
      await lend('Longsword'); await lend('Longbow');
      const t0 = Date.now();
      await api.fillActors([fighter], 'suite');
      const card = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && m.getFlag(MOD, 'masteryFill')) ?? null, 8000);
      const fill = card?.getFlag(MOD, 'masteryFill');
      const row = fill?.filled?.find(x => x.actorUuid === fighter.uuid);
      ok('1a. the list written from what is equipped, in sheet order: longsword, longbow', JSON.stringify(listNow()) === JSON.stringify(['longsword', 'longbow']), `list=${listNow().join(',')}`);
      ok('1b. ONE whisper to the GM names the picks and the open count (2 of 4)', !!card && (card.whisper ?? []).length > 0 && row?.picks?.length === 2 && row?.open === 2 && /Masteries filled/.test(card.content), `card=${!!card} row=${JSON.stringify(row)}`);
      const t1 = Date.now();
      const again = await api.fillActors([fighter], 'suite');
      ok('1c. a second fill with nothing open to equipped kinds posts nothing and touches nothing', (again === null) && !game.messages.contents.some(m => (m.timestamp >= t1) && m.getFlag(MOD, 'masteryFill')) && (listNow().length === 2), `again=${again === null}`);
      await setList(['a', 'b', 'c', 'd', 'e']);
      const over = await api.fillActors([fighter], 'suite');
      ok('1d. an over-long list is never trimmed, and alone it posts no card (the party view flags it)', (over === null) && (listNow().length === 5), `list=${listNow().length}`);
      await setList([]);
      const live = lent.filter(id => fighter.items.get(id));
      if (live.length) await fighter.deleteEmbeddedDocuments('Item', live);
      lent.length = 0;
    }

    // ================================================== 2. the line and Master it
    if (want(2)) {
      if (!(await asPartyMember())) {
        skips.push('§2 — no player test user on this box: the line is gated to party members');
      } else {
        await setList(['longsword', 'longbow']);
        const dagger = await lend('Dagger');
        const activity = dagger.system.activities.find(a => a.type === 'attack');
        const rolls = await activity.rollAttack({}, { configure: false }, {});
        const msg = rolls?.[0]?.parent ?? null;
        const row = await waitFor(() => msg ? rowUnder(msg.id) : null, 8000);
        ok('2a. the attack card carries the line: "Dagger: Nick — not mastered by BF Test Fighter", 2 of 4 open — pick at your next Long Rest', !!row && /not mastered by BF Test Fighter/.test(row.textContent) && /2 of 4 open — pick at your next Long Rest/.test(row.textContent), `row=${row?.textContent?.trim().slice(0, 160)}`);
        ok('2b. no button: a pick is the Long Rest\'s (RAW), and the list is untouched', ![...(row?.querySelectorAll('button') ?? [])].length && (JSON.stringify(listNow()) === JSON.stringify(['longsword', 'longbow'])), `buttons=${[...(row?.querySelectorAll('button') ?? [])].map(b => b.textContent).join('|')} list=${listNow().join(',')}`);
        await setList(['rapier', 'shortbow', 'longsword', 'longbow']);
        const rolls2 = await activity.rollAttack({}, { configure: false }, {});
        const msg2 = rolls2?.[0]?.parent ?? null;
        const row2 = await waitFor(() => msg2 ? rowUnder(msg2.id) : null, 8000);
        ok('2e. a full list: the line says 4 of 4 chosen and offers nothing', !!row2 && /4 of 4 chosen/.test(row2.textContent) && ![...(row2.querySelectorAll('button'))].some(b => b.textContent === 'Master it'), `row=${row2?.textContent?.trim().slice(0, 160)}`);
        await setList([]);
        const live = lent.filter(id => fighter.items.get(id));
        if (live.length) await fighter.deleteEmbeddedDocuments('Item', live);
        lent.length = 0;
      }
    }

    // ================================================== 3. the long-rest swap
    if (want(3)) {
      if (!(await asPartyMember())) {
        skips.push('§3 — no player test user on this box: the swap is gated to party members');
      } else {
        await setList(['longsword', 'longbow']);
        await lend('Longsword'); await lend('Longbow'); await lend('Greatsword', { equipped: false });
        const t0 = Date.now();
        await fighter.longRest({ dialog: false, chat: true, newDay: false });
        const card = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'masterySwap')?.status === 'pending')) ?? null, 10000);
        const flag = card?.getFlag(MOD, 'masterySwap');
        ok('3a. the Long Rest posts the ask: pending, the chosen two, the pool holds greatsword and nothing chosen', !!flag && (flag.chosen?.length === 2) && flag.pool?.some(p => p.base === 'greatsword') && !flag.pool?.some(p => ['longsword', 'longbow'].includes(p.base)), `flag=${JSON.stringify(flag)}`);
        const popup = await waitFor(() => dialogs().find(a => /Choose your masteries|Swap a mastery/.test(a.element?.textContent ?? '')) ?? null, 6000);
        ok('3b. the popup opened for the answerer: the grid — two chosen rows with a remove box, two open rows, one available row (Greatsword) with a pick box', !!popup && /You have these masteries/.test(popup.element.textContent) && (popup.element.querySelectorAll('input[name="bf-mastery-remove"]').length === 2) && (popup.element.querySelectorAll('input[name="bf-mastery-pick"]').length === 1) && ![...popup.element.querySelectorAll('input[name="bf-mastery-remove"]')].some(i => i.checked), `popup=${!!popup} removes=${popup?.element?.querySelectorAll('input[name="bf-mastery-remove"]').length} picks=${popup?.element?.querySelectorAll('input[name="bf-mastery-pick"]').length} text=${popup?.element?.textContent?.replace(/\s+/g, ' ').slice(0, 200)}`);
        if (popup) {
          const pick = popup.element.querySelector('input[name="bf-mastery-pick"]');
          const before = pick?.disabled;
          const rem = popup.element.querySelector('input[name="bf-mastery-remove"][value="longbow"]');
          if (rem) { rem.checked = true; rem.dispatchEvent(new Event('change', { bubbles: true })); }
          ok('3b2. the available row is live (two slots are open), and a remove tick keeps it live', (before === false) && (pick?.disabled === false), `before=${before} after=${pick?.disabled}`);
          try { await popup.close(); } catch { /* gone */ }
        }
        if (!card) throw new Error('§3: no masterySwap card rose after the Long Rest');
        await api.answerSwap(card, { out: 'longbow', into: 'greatsword' });
        const done = await waitFor(() => game.messages.get(card.id)?.getFlag(MOD, 'masterySwap')?.applied ? game.messages.get(card.id) : null, 10000);
        const after = done?.getFlag(MOD, 'masterySwap');
        ok('3c. the elect lands it: longbow → greatsword on the sheet, the record applied with outcome changed', (after?.outcome === 'changed') && (JSON.stringify(listNow()) === JSON.stringify(['longsword', 'greatsword'])), `outcome=${after?.outcome} list=${listNow().join(',')}`);
        const row = await waitFor(() => rowUnder(card.id), 8000);
        ok('3d. the card says so, with the list as it stands now', !!row && /Swapped Longbow → Greatsword/.test(row.textContent) && /Now:.*Longsword.*Greatsword/.test(row.textContent.replace(/\s+/g, ' ')), `row=${row?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 160)}`);
        const confirm = await waitFor(() => dialogs().find(a => /Swapped Longbow → Greatsword/.test(a.element?.textContent ?? '')) ?? null, 6000);
        ok('3d2. the confirmation popup: "You now have these masteries", the swap named, OK', !!confirm && /Swapped Longbow → Greatsword/.test(confirm.element.textContent) && !!confirm.element.querySelector('button[data-action="ok"]'), `popup=${!!confirm} buttons=${[...(confirm?.element?.querySelectorAll('button') ?? [])].map(b => `${b.dataset.action}:${b.textContent.trim()}`).join('|')} text=${confirm?.element?.textContent?.replace(/\s+/g, ' ').slice(0, 200)}`);
        if (confirm) { confirm.element.querySelector('button[data-action="ok"]')?.click(); await waitFor(() => game.messages.get(card.id)?.getFlag(MOD, 'masterySwap')?.acknowledged === true, 6000); }
        ok('3d3. OK acknowledges on the card', game.messages.get(card.id)?.getFlag(MOD, 'masterySwap')?.acknowledged === true, `ack=${game.messages.get(card.id)?.getFlag(MOD, 'masterySwap')?.acknowledged}`);
        // a second answer on the same card changes nothing
        await api.answerSwap(card, { out: 'longsword', into: 'longbow' });
        await sleep(600);
        ok('3e. the card answers once', JSON.stringify(listNow()) === JSON.stringify(['longsword', 'greatsword']), `list=${listNow().join(',')}`);
        // the open slots: a second rest, two kinds chosen into the two open slots, no swap
        await setList(['longsword']);
        const t1 = Date.now();
        await fighter.longRest({ dialog: false, chat: true, newDay: false });
        const card2 = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t1) && (m.getFlag(MOD, 'masterySwap')?.status === 'pending')) ?? null, 10000);
        const p2 = await waitFor(() => dialogs().find(a => /Choose your masteries/.test(a.element?.textContent ?? '')) ?? null, 6000);
        ok('3f. with open slots the ask is "Choose your masteries": two available rows (Longbow, Greatsword) with pick boxes', !!card2 && (card2.getFlag(MOD, 'masterySwap')?.open === 3) && !!p2 && (p2.element.querySelectorAll('input[name="bf-mastery-pick"]').length === 2), `open=${card2?.getFlag(MOD, 'masterySwap')?.open} popup=${!!p2}`);
        if (p2) { try { await p2.close(); } catch { /* gone */ } }
        if (!card2) throw new Error('§3f: no masterySwap card rose after the second Long Rest');
        await api.answerSwap(card2, { adds: ['longbow', 'greatsword'] });
        const landed2 = await waitFor(() => game.messages.get(card2.id)?.getFlag(MOD, 'masterySwap')?.applied ? game.messages.get(card2.id) : null, 10000);
        ok('3g. the elect fills the two slots, one stays open; the confirmation says "Chose Longbow, Greatsword"', (landed2?.getFlag(MOD, 'masterySwap')?.outcome === 'changed') && (JSON.stringify(listNow()) === JSON.stringify(['longsword', 'longbow', 'greatsword'])), `outcome=${landed2?.getFlag(MOD, 'masterySwap')?.outcome} list=${listNow().join(',')}`);
        const c2 = await waitFor(() => dialogs().find(a => /Chose Longbow, Greatsword/.test(a.element?.textContent ?? '')) ?? null, 6000);
        ok('3h. …with OK', !!c2, `popup=${!!c2}`);
        if (c2) { c2.element.querySelector('button[data-action="ok"]')?.click(); await waitFor(() => game.messages.get(card2.id)?.getFlag(MOD, 'masterySwap')?.acknowledged === true, 6000); }
        await setList([]);
        const live = lent.filter(id => fighter.items.get(id));
        if (live.length) await fighter.deleteEmbeddedDocuments('Item', live);
        lent.length = 0;
      }
    }

    // ================================================== 4. the party view's door
    if (want(4)) {
      await asPartyMember();
      await setList(['longsword']);
      const group = await Actor.create({ name: 'BF Test Party (mastery)', type: 'group' });
      made.push(group);
      const sheet = await group.sheet.render({ force: true });
      await waitFor(() => sheet.rendered, 6000);
      const controls = [...sheet._headerControlButtons()];
      const door = controls.find(c => c.action === 'bfMasteryRecord');
      ok('4a. the group sheet\'s header controls carry "Weapon masteries" — the getHeaderControlsGroupActorSheet hook FIRED', !!door && (door.label === 'Weapon masteries'), `controls=${controls.map(c => c.action).join(',')}`);
      try { await sheet.close(); } catch { /* gone */ }
      const view = await api.openPartyView();
      await waitFor(() => view.rendered, 6000);
      const text = view.element?.textContent ?? '';
      ok('4b. the view lists the Fighter against its allowance: 4, longsword chosen, 3 open', /BF Test Fighter/.test(text) && /3 open/.test(text), `text=${text.replace(/\s+/g, ' ').slice(0, 240)}`);
      try { await view.close(); } catch { /* gone */ }
      await setList([]);
    }


    // ================================================== 5. the trim at the Long Rest
    if (want(5)) {
      if (!(await asPartyMember())) {
        skips.push('§5 — no player test user on this box: the swap is gated to party members');
      } else {
        await setList(['longsword', 'longbow', 'dagger', 'greatsword', 'mace']);   // 5 on an allowance of 4
        const t0 = Date.now();
        await fighter.longRest({ dialog: false, chat: true, newDay: false });
        const card = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'masterySwap')?.status === 'pending')) ?? null, 10000);
        const flag = card?.getFlag(MOD, 'masterySwap');
        ok('5a. the Long Rest posts the ask as a trim: over 1, the five chosen', !!flag && (flag.over === 1) && (flag.chosen?.length === 5), `flag=${JSON.stringify(flag)}`);
        const popup = await waitFor(() => dialogs().find(a => /too many/.test(a.element?.textContent ?? '')) ?? null, 6000);
        const okBtn = popup?.element?.querySelector('button[data-action="ok"]');
        ok('5b. the popup: "You have these masteries", "Drop 1 to continue", OK held until one is ticked', !!popup && /You have these masteries/.test(popup.element.textContent) && !!okBtn && (okBtn.disabled === true), `popup=${!!popup} disabled=${okBtn?.disabled}`);
        if (popup) {
          const box = popup.element.querySelector('input[name="bf-mastery-drop"][value="mace"]');
          if (box) { box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })); }
          ok('5c. one tick frees OK', okBtn?.disabled === false, `disabled=${okBtn?.disabled}`);
          try { await popup.close(); } catch { /* gone */ }
        }
        if (!card) throw new Error('§5: no masterySwap card rose after the Long Rest');
        await api.answerSwap(card, { drop: ['mace'] });
        const landed = await waitFor(() => game.messages.get(card.id)?.getFlag(MOD, 'masterySwap')?.applied ? game.messages.get(card.id) : null, 10000);
        const after = landed?.getFlag(MOD, 'masterySwap');
        ok('5d. the elect trims the list to the allowance, outcome trimmed, the list after on the record', (after?.outcome === 'trimmed') && (listNow().length === 4) && !listNow().includes('mace') && (after?.after?.length === 4), `outcome=${after?.outcome} list=${listNow().join(',')}`);
        const confirm = await waitFor(() => dialogs().find(a => /Dropped Mace/.test(a.element?.textContent ?? '')) ?? null, 6000);
        ok('5e. the confirmation names the drop, and OK acknowledges it', !!confirm && /You now have these masteries/.test(confirm.element.textContent), `popup=${!!confirm}`);
        if (confirm) { confirm.element.querySelector('button[data-action="ok"]')?.click(); await waitFor(() => game.messages.get(card.id)?.getFlag(MOD, 'masterySwap')?.acknowledged === true, 6000); }
        await setList([]);
      }
    }

    // ================================================== 6. the Weapon Master feat
    if (want(6)) {
      const pack = game.packs.get('dnd-players-handbook.feats');
      const hit = pack ? (await pack.getIndex()).find(e => e.name === 'Weapon Master') : null;
      if (!hit) { skips.push('§6 — the PHB feats pack or its Weapon Master is not on this box'); }
      else {
        const [feat] = await fighter.createEmbeddedDocuments('Item', [(await pack.getDocument(hit._id)).toObject()]);
        lent.push(feat.id);
        const r = api.recordOf(fighter);
        ok('6a. Weapon Master on the sheet: the allowance is 5 (the feat\'s level-0 row counts once)', r.allowance === 5, `allowance=${r.allowance}`);
        await fighter.deleteEmbeddedDocuments('Item', [feat.id]);
        lent.splice(lent.indexOf(feat.id), 1);
        ok('6b. …and 4 again without it', api.recordOf(fighter).allowance === 4, `allowance=${api.recordOf(fighter).allowance}`);
      }
    }

    // ================================================== 7. Tactical Master
    if (want(7)) {
      if (!(await asPartyMember())) {
        skips.push('§7 — no player test user on this box: the line is gated to party members');
      } else {
        const pack = game.packs.get('dnd-players-handbook.classes');
        const hit = pack ? (await pack.getIndex()).find(e => e.name === 'Tactical Master') : null;
        if (!hit) { skips.push('§7 — the PHB classes pack or its Tactical Master is not on this box'); }
        else {
          await setList(['longsword']);
          const sword = await lend('Longsword');
          const [tm] = await fighter.createEmbeddedDocuments('Item', [(await pack.getDocument(hit._id)).toObject()]);
          lent.push(tm.id);
          const bonus = [...(fighter.system.traits.weaponProf.mastery.bonus ?? [])];
          const r = api.recordOf(fighter);
          ok('7a. Tactical Master\'s effect lands push, sap, slow on mastery.bonus; the list and the allowance are untouched', (bonus.length === 3) && (r.allowance === 4) && (JSON.stringify(r.chosen) === JSON.stringify(['longsword'])), `bonus=${bonus.join(',')} allowance=${r.allowance} chosen=${r.chosen.join(',')}`);
          const activity = fighter.items.get(sword.id).system.activities.find(a => a.type === 'attack');
          const rolls = await activity.rollAttack({}, { configure: false }, {});
          const msg = rolls?.[0]?.parent ?? null;
          await waitFor(() => msg && document.querySelector(`[data-message-id="${msg.id}"]`), 6000);
          await sleep(400);   // ⚠ load-bearing: a wrong line would be appended after the first paint
          ok('7b. a Longsword attack (a chosen kind): the system stamps a mastery and the module draws no line', (msg?.system?.mastery === 'sap') && !rowUnder(msg.id), `stamped=${msg?.system?.mastery} row=${!!rowUnder(msg?.id)}`);
          await setList([]);
          const live = lent.filter(id => fighter.items.get(id));
          if (live.length) await fighter.deleteEmbeddedDocuments('Item', live);
          lent.length = 0;
        }
      }
    }

    // ================================================== 8. the feature's card
    if (want(8)) {
      const pack = game.packs.get('dnd-players-handbook.classes');
      const hit = pack ? (await pack.getIndex()).find(e => (e.name === 'Weapon Mastery') && /^phbftr/.test(e._id)) : null;
      if (!hit) { skips.push('§8 — the PHB classes pack or the Fighter\'s Weapon Mastery is not on this box'); }
      else {
        await setList(['longsword', 'longbow']);
        await lend('Longsword'); await lend('Longbow');   // the kinds' masteries are read off the sheet's weapons
        const [feature] = await fighter.createEmbeddedDocuments('Item', [(await pack.getDocument(hit._id)).toObject()]);
        lent.push(feature.id);
        const cardMsg = await feature.displayCard();
        const row = await waitFor(() => cardMsg ? rowUnder(cardMsg.id) : null, 8000);
        ok('8a. the feature\'s card carries the record: "has these masteries", Longsword (Sap), Longbow (Slow), 2 of 4 · 2 open', !!row && /has these masteries/.test(row.textContent) && /Longsword\s*— Sap/.test(row.textContent) && /2 open/.test(row.textContent), `row=${row?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160)}`);
        const popup = await waitFor(() => dialogs().find(a => /You have these masteries/.test(a.element?.textContent ?? '')) ?? null, 6000);
        ok('8b. the popup opened for the owner, with OK', !!popup && !!popup.element.querySelector('button[data-action="ok"]'), `popup=${!!popup}`);
        if (popup) { try { await popup.close(); } catch { /* gone */ } }
        await setList([]);
        const live = lent.filter(id => fighter.items.get(id));
        if (live.length) await fighter.deleteEmbeddedDocuments('Item', live);
        lent.length = 0;
      }
    }

    return { log, results, skips };
  } catch (err) {
    return { fatal: `${err?.message || err}\n${err?.stack ?? ''}`, results, log, skips };
  } finally {
    await teardown();
  }
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'mastery-record', out, plan, f });
