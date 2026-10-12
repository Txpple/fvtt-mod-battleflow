// Live suite: TRANSFORMS (issue #2) — Wild Shape and the polymorph spells: the system's chooser switched
// off at the use, the record stamped on the use's card with the Known Forms, the pick folded through the
// pure fold, the elect transforming with dnd5e's own preset and clocking the form, the ends (Revert from
// the card, 0 Hit Points, the Temporary Hit Points gone), and the Long Rest's known-form swap.
//
// Fixtures: BTB Test Druid (tools/fixture-suite.mjs; Druid 2 with the PHB's Wild Shape) is the shape-shifter;
// BTB Test Sorcerer is lent Polymorph and BTB Test Dummy is its target. The transformed copies, the cards,
// the lent spell and the known-form flags are torn down. The popup is a canvas-free DialogV2, so the suite
// answers the record through the module's api and the pure fold, never the popup.
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'transforms.js'    // §1 the intercept and the record, §2 the landing and the clock, §3 Revert, §4 0 HP ends it, §5 Polymorph on a target and the temp HP, §6 the Long Rest swap, §7 an open slot learned at the use, §8 Concentration's end
];

const SECTIONS = {
  1: 'THE RECORD: a Wild Shape use by the Druid posts its card with NO compendium browser opened and a `transform` flag `asked` carrying the band (CR ¼, no fliers), four slots and the known forms',
  2: 'THE LANDING: the record answered with a known Wolf is landed by the elect — the Druid\'s token now a "BTB Test Druid (Wolf)" actor flagged isPolymorphed, the wildshape preset\'s temp HP, a clocked "Wild Shape — Wolf" effect with the form flag, the card "is now a Wolf"',
  3: 'REVERT: the Revert ask reverts the Druid through dnd5e\'s own revertOriginalForm; the copy is gone, the record `ended` by choice, a form-end card posted',
  4: 'ZERO: the Wolf form at 0 Hit Points reverts on its own (the row\'s `zero`), the record ended "dropped to 0 Hit Points"',
  5: 'POLYMORPH: the Sorcerer\'s Polymorph transform activity used at the targeted Dummy records the Dummy (cap from its CR) and lands it as a Giant Frog with the beast\'s HP as temp HP; the temp HP taken to 0 ends the form',
  6: 'THE REST: a Long Rest posts the formSwap ask; the swap lands Wolf → Brown Bear on the item\'s known forms with the confirmation; the open slots are filled from the answer',
  7: 'THE OPEN SLOT: with three known forms, a pick from the pool is learned into the fourth slot at the use and the card says so',
  8: 'CONCENTRATION: with the Sorcerer concentrating on Polymorph, the Dummy\'s form effect depends on that effect; ending Concentration takes the form effect with it (dnd5e\'s dependents registry) and the Dummy reverts, the record ended "Concentration ended"'
};
const DEPENDS = { 3: [2], 4: [2], 7: [1], 8: [5] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'transforms', watchdogMs: 300_000 });
announcePlan('transforms', plan, pulled);

const out = await f.evaluate(async ({ sections, titles }) => {
  const MOD = 'fvtt-mod-bythebooks';
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
  // ⚠ Foundry 14 has no `User#updateTokenTargets`: target through the canvas tokens, the others released.
  const targetOnly = ids => {
    for (const t of [...game.user.targets]) t.setTarget(false, { releaseOthers: false, groupSelection: true });
    for (const id of ids) canvas.tokens.get(id)?.setTarget(true, { releaseOthers: false, groupSelection: true });
  };
  const waitFor = async (test, timeout = 8000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) { const v = await test(); if (v) return v; await sleep(200); }
    return test();
  };

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  const api = modDoc.api?.transforms;
  if (!api?.askRevert) return { fatal: 'no transforms api — OLD code (reload the box)' };

  const druid = game.actors.getName('BTB Test Druid');
  if (!druid) return { fatal: 'missing fixture: BTB Test Druid — run tools/fixture-suite.mjs' };
  const wildShape = druid.items.find(i => (i.type === 'feat') && (i.name === 'Wild Shape'));
  if (!wildShape) return { fatal: 'BTB Test Druid has no Wild Shape — run tools/fixture-suite.mjs' };
  // ⚠ The range is VIEWED first (every other suite does): a fresh client's canvas is the world's
  // active scene, and in the battery that is not the range — this suite went FATAL at
  // "the Druid has no token on the scene" in the overnight battery of 2026-10-11 while green alone.
  const range = game.scenes.getName('By the Books Test Range');
  if (!range) return { fatal: 'missing fixture: scene By the Books Test Range — run tools/fixture-suite.mjs' };
  if (canvas.scene?.id !== range.id) await range.view();
  for (let i = 0; i < 40 && !(canvas.ready && canvas.scene?.id === range.id); i++) await sleep(250);
  if (canvas.scene?.id !== range.id) return { fatal: 'the canvas never readied on the test range' };
  const druidToken = canvas.scene.tokens.find(t => t.actor?.id === druid.id) ?? null;
  if (!druidToken) return { fatal: 'the Druid has no token on the scene — run tools/fixture-suite.mjs' };
  const sorcerer = game.actors.getName('BTB Test Sorcerer');
  const dummy = game.actors.getName('BTB Test Dummy');
  const dummyToken = canvas.scene.tokens.find(t => t.actor?.id === dummy?.id || t.name === 'BTB Test Dummy') ?? null;
  // ⚠ dnd5e reverts an UNLINKED token by creating a new token and deleting the old one: after a revert
  // the Dummy is re-found, never read off the deleted document (its actor stays polymorphed forever).
  const dummyNow = () => canvas.scene.tokens.find(t => (t.actorId === dummy?.id) || (t.name === 'BTB Test Dummy')) ?? null;
  const lent = [];
  const madeMessages = [];
  const priorKnown = foundry.utils.deepClone(wildShape.getFlag(MOD, 'knownForms') ?? null);
  const priorUses = foundry.utils.deepClone(wildShape._source.system.uses ?? {});
  const dialogs = () => [...foundry.applications.instances.values()].filter(a => a instanceof foundry.applications.api.DialogV2);

  /** Every transformed copy of a fixture the suite made, reverted so the tokens come home. */
  const revertAll = async () => {
    for (const a of game.actors.filter(a => a.isPolymorphed && /^BTB Test/.test(a.name))) { try { await a.revertOriginalForm({ renderSheet: false }); } catch { /* gone */ } }
    for (const t of canvas.scene.tokens) { if (t.actor?.isToken && t.actor.isPolymorphed) { try { await t.actor.revertOriginalForm({ renderSheet: false }); } catch { /* gone */ } } }
  };
  const teardown = async () => {
    try {
      for (const app of dialogs()) { if (/Wild Shape|Polymorph/.test(app.element?.textContent ?? '')) { try { await app.close(); } catch { /* gone */ } } }
      await revertAll();
      if (priorKnown) await wildShape.setFlag(MOD, 'knownForms', priorKnown); else await wildShape.unsetFlag(MOD, 'knownForms');
      await wildShape.unsetFlag(MOD, 'lastForm');
      await wildShape.update({ 'system.uses.spent': priorUses.spent ?? 0 });
      const live = lent.filter(id => sorcerer?.items.get(id));
      if (live.length) await sorcerer.deleteEmbeddedDocuments('Item', live);
      for (const e of sorcerer?.effects.filter(e => /Polymorph/.test(e.name)) ?? []) { try { await e.delete(); } catch { /* gone */ } }
      for (const m of madeMessages) { if (game.messages.get(m.id)) await m.delete(); }
    } catch (err) { log.push(`TEARDOWN ERROR: ${err?.message}`); }
  };

  const poolRow = async (name) => {
    const { poolFromPacks } = await import('/modules/fvtt-mod-bythebooks/scripts/gallery.js');
    const rows = await poolFromPacks({ types: ['beast'] });
    return rows.find(r => r.name === name) ?? null;
  };
  const asKnown = r => ({ uuid: r.uuid, name: r.name, img: r.img ?? null });
  const useTransform = async item => {
    const activity = item.system.activities.getByType('transform')[0];
    // ⚠ A fresh use every time: Wild Shape has two uses, §1 and §7 spend them, and §2 then used
    // with none left — no card, a null message, the suite throwing at its own answer (the
    // 2026-10-11 overnight battery and the re-run after it: 7/8). A spell spends a slot, not a use.
    if ((item.type === 'feat') && item.system.uses?.max) await item.update({ 'system.uses.spent': 0 });
    const before = [...foundry.applications.instances.values()].length;
    const result = await activity.use({}, { configure: false }, { create: true });
    const message = result?.message instanceof ChatMessage ? result.message : null;
    if (!message) throw new Error(`the use of ${item.name} posted no card (uses ${item.system.uses?.spent ?? '-'}/${item.system.uses?.max ?? '-'}, slots ${JSON.stringify(item.actor?.system.spells?.spell4 ?? null)})`);
    madeMessages.push(message);
    const flag = await waitFor(() => (message?.getFlag(MOD, 'transform')?.status === 'asked' || message?.getFlag(MOD, 'transform')?.status === 'picked') ? message.getFlag(MOD, 'transform') : null, 6000);
    const browser = [...foundry.applications.instances.values()].slice(before).find(a => /CompendiumBrowser/.test(a.constructor?.name ?? ''));
    if (browser) { try { await browser.close(); } catch { /* gone */ } }
    return { activity, message, flag, browserOpened: !!browser };
  };
  // The suite answers the record as the popup would, through the pure fold the module exports.
  const answer = async (message, pick, { learn = false } = {}) => {
    const { pickedAnswer } = await import('/modules/fvtt-mod-bythebooks/scripts/decide/transforms.js');
    const flag = message.getFlag(MOD, 'transform');
    const patch = pickedAnswer(flag, { pick, learn });
    if (!patch) throw new Error('the suite\'s answer was refused by pickedAnswer');
    await message.setFlag(MOD, 'transform', { ...flag, ...patch });
    return waitFor(() => message.getFlag(MOD, 'transform')?.applied ? message.getFlag(MOD, 'transform') : null, 20000);
  };
  const copyOf = original => game.actors.find(a => a.isPolymorphed && (a.getFlag('dnd5e', 'originalActor') === original.id)) ?? null;
  const formEffectOn = actor => actor?.effects.find(e => !!e.getFlag(MOD, 'form')) ?? null;
  const rowUnder = id => document.querySelector(`[data-message-id="${id}"] .bythebooks-transform`);

  try {
    const wolf = await poolRow('Wolf');
    const rat = await poolRow('Rat');
    const horse = await poolRow('Riding Horse');
    const spider = await poolRow('Spider');
    const bear = await poolRow('Brown Bear');
    if (!wolf || !rat || !horse || !spider) throw new Error('the beast pool lacks the PHB appendix (Wolf, Rat, Riding Horse, Spider) — is the Monster Manual or the PHB on this box?');
    await wildShape.setFlag(MOD, 'knownForms', [wolf, rat, horse, spider].map(asKnown));
    await wildShape.update({ 'system.uses.spent': 0 });

    // ================================================== 1. the record
    if (want(1)) {
      const { flag, browserOpened } = await useTransform(wildShape);
      ok('§1 the system opened no compendium browser', !browserOpened, `browser=${browserOpened}`);
      ok('§1 the record is asked with the CR ¼ band, no fliers, four slots and the four known forms',
        flag?.status === 'asked' && flag.key === 'Wild Shape' && flag.profile?.cr === 0.25 && flag.profile.movement?.includes('fly') && flag.slots === 4 && flag.known?.length === 4,
        JSON.stringify({ status: flag?.status, profile: flag?.profile, slots: flag?.slots, known: flag?.known?.map(k => k.name) }));
      ok('§1 the record aims at the druid alone', flag?.self === true && flag.targets?.length === 1 && flag.targets[0].uuid === druid.uuid, JSON.stringify(flag?.targets));
      const popup = await waitFor(() => dialogs().find(a => /Your known forms/.test(a.element?.textContent ?? '')) ?? null, 6000);
      // ⚠ The one picker draws a locked pool's rows too, folded under its line with their picks disabled:
      // the known forms are the ENABLED picks, and nothing under the line can be ticked.
      const picks = popup ? [...popup.element.querySelectorAll('input[name="bf-form-pick"]')] : [];
      const enabled = picks.filter(i => !i.disabled).length;
      const lockedRows = popup ? [...popup.element.querySelectorAll('details input[name="bf-form-pick"]')] : [];
      ok('§1 the popup: the known forms as rows, the pool locked behind its line', !!popup && (enabled === 4) && lockedRows.length > 0 && lockedRows.every(i => i.disabled) && /more forms in the pool/.test(popup.element.textContent),
        `popup=${!!popup} enabled=${enabled} locked=${lockedRows.length} lockedAllDisabled=${lockedRows.every(i => i.disabled)} text=${popup?.element?.textContent?.replace(/\s+/g, ' ').slice(0, 200)}`);
      if (popup) { try { await popup.close(); } catch { /* gone */ } }
      if (want(7)) {
        // three known: the fourth is learned at the use
        await wildShape.setFlag(MOD, 'knownForms', [wolf, rat, horse].map(asKnown));
        const second = await useTransform(wildShape);
        const p2 = await waitFor(() => dialogs().find(a => /Fill the open slot/.test(a.element?.textContent ?? '')) ?? null, 6000);
        ok('§7 with a slot open the popup offers the pool to learn from', !!p2 && (p2.element.querySelectorAll('input[name="bf-form-pick"]').length > 4), `popup=${!!p2} picks=${p2?.element?.querySelectorAll('input[name="bf-form-pick"]').length}`);
        if (p2) { try { await p2.close(); } catch { /* gone */ } }
        const landed = await answer(second.message, asKnown(spider), { learn: true });
        ok('§7 the pick is learned into the slot and the form landed', landed?.outcome === 'landed' && landed.learned?.name === 'Spider' && (wildShape.getFlag(MOD, 'knownForms') ?? []).some(k => k.name === 'Spider'), JSON.stringify({ outcome: landed?.outcome, learned: landed?.learned, known: wildShape.getFlag(MOD, 'knownForms')?.map(k => k.name) }));
        const row = await waitFor(() => rowUnder(second.message.id), 6000);
        ok('§7 the card says the form was learned', /Spider learned as a known form/.test(row?.textContent ?? ''), (row?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160));
        await api.askRevert(second.message);
        await waitFor(() => second.message.getFlag(MOD, 'transform')?.ended ? true : null, 15000);
        await revertAll();
        await wildShape.setFlag(MOD, 'knownForms', [wolf, rat, horse, spider].map(asKnown));
      }
    }

    // ================================================== 2–4. the landing, Revert, 0 HP
    if (want(2)) {
      const { message } = await useTransform(wildShape);
      const landed = await answer(message, asKnown(wolf));
      const copy = copyOf(druid);
      const effect = formEffectOn(copy);
      ok('§2 the elect landed the Wolf: a polymorphed copy stands, the token points at it', landed?.outcome === 'landed' && !!copy && (druidToken.actorId === copy.id), JSON.stringify({ outcome: landed?.outcome, failure: landed?.failure, copy: copy?.name, token: druidToken.actorId }));
      ok('§2 the wildshape preset: the copy keeps the druid\'s HP and carries temp HP equal to the level', !!copy && (copy.system.attributes.hp.max === druid.system.attributes.hp.max) && (copy.system.attributes.hp.temp === 2), `hp=${copy?.system.attributes.hp.value}/${copy?.system.attributes.hp.max} temp=${copy?.system.attributes.hp.temp}`);
      ok('§2 the form effect: "Wild Shape — Wolf", clocked in hours, tied to the record', !!effect && (effect.name === 'Wild Shape — Wolf') && (Number(effect.duration?.seconds) === 3600) && (effect.getFlag(MOD, 'form')?.messageId === message.id), JSON.stringify({ name: effect?.name, seconds: effect?.duration?.seconds, form: effect?.getFlag(MOD, 'form') }));
      ok('§2 the last form is marked on the item', wildShape.getFlag(MOD, 'lastForm') === wolf.uuid, `last=${wildShape.getFlag(MOD, 'lastForm')}`);
      const row = await waitFor(() => rowUnder(message.id), 6000);
      ok('§2 the card says "is now a Wolf"', /is now a Wolf/.test(row?.textContent ?? ''), (row?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160));
      if (want(3)) {
        await api.askRevert(message);
        const ended = await waitFor(() => message.getFlag(MOD, 'transform')?.ended ? message.getFlag(MOD, 'transform') : null, 15000);
        ok('§3 Revert: the copy is gone, the token home, the record ended by choice', !!ended?.ended && !game.actors.get(copy?.id) && (druidToken.actorId === druid.id) && (ended.ended.word === 'revert'), JSON.stringify({ ended: ended?.ended, copyStands: !!game.actors.get(copy?.id), token: druidToken.actorId }));
        const card = await waitFor(() => game.messages.contents.find(m => m.getFlag(MOD, 'formEnd')?.messageId === message.id) ?? null, 6000);
        if (card) madeMessages.push(card);
        ok('§3 a form-end card posted', !!card && /no longer a Wolf/.test(card.content), (card?.content ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 160));
      }
      if (want(4)) {
        await wildShape.update({ 'system.uses.spent': 0 });
        const again = await useTransform(wildShape);
        await answer(again.message, asKnown(wolf));
        const copy2 = copyOf(druid);
        ok('§4 the second use lands a fresh Wolf', !!copy2, `copy=${copy2?.name}`);
        if (copy2) {
          await copy2.update({ 'system.attributes.hp.temp': 0, 'system.attributes.hp.value': 0 });
          const ended = await waitFor(() => again.message.getFlag(MOD, 'transform')?.ended ? again.message.getFlag(MOD, 'transform') : null, 15000);
          ok('§4 at 0 Hit Points the form ends on its own: the record ended "dropped to 0 Hit Points", the copy gone', ended?.ended?.word === 'zero' && !game.actors.get(copy2.id), JSON.stringify({ ended: ended?.ended, copyStands: !!game.actors.get(copy2.id) }));
          const end = await waitFor(() => game.messages.contents.find(m => m.getFlag(MOD, 'formEnd')?.messageId === again.message.id) ?? null, 6000);
          if (end) madeMessages.push(end);
          await druid.update({ 'system.attributes.hp.value': druid.system.attributes.hp.max });
        }
      }
      await revertAll();
    }

    // ================================================== 5. Polymorph on a target
    if (want(5)) {
      if (!sorcerer || !dummyToken) skips.push('§5 — no BTB Test Sorcerer or BTB Test Dummy token on this box');
      else {
        const pack = game.packs.get('dnd-players-handbook.spells');
        const hit = pack ? (await pack.getIndex()).find(e => e.name === 'Polymorph') : null;
        if (!hit) skips.push('§5 — the PHB ships no Polymorph this box can find');
        else {
          const src = (await pack.getDocument(hit._id)).toObject();
          src.system.prepared = 1;
          const [spell] = await sorcerer.createEmbeddedDocuments('Item', [src]);
          lent.push(spell.id);
          const frog = await poolRow('Giant Frog');
          if (!frog) throw new Error('the beast pool lacks Giant Frog');
          targetOnly([dummyNow()?.id].filter(Boolean));
          const { message, flag } = await useTransform(spell);
          targetOnly([]);
          ok('§5 the record aims at the targeted Dummy with the cap read off its CR, the pool open (no slots)', flag?.self === false && flag.targets?.[0]?.uuid === dummyToken.actor?.uuid && flag.targetCap === 0 && flag.slots === 0, JSON.stringify({ self: flag?.self, targets: flag?.targets, cap: flag?.targetCap, slots: flag?.slots }));
          const landed = await answer(message, asKnown(frog));
          const target = dummyToken.actor;
          ok('§5 the elect transformed the Dummy into a Giant Frog with the frog\'s HP as temp HP', landed?.outcome === 'landed' && target?.isPolymorphed && /Giant Frog/.test(target.name) && (target.system.attributes.hp.temp > 0), JSON.stringify({ outcome: landed?.outcome, failure: landed?.failure, name: target?.name, temp: target?.system.attributes.hp.temp }));
          if (target?.isPolymorphed) {
            await target.update({ 'system.attributes.hp.temp': 0 });
            const ended = await waitFor(() => message.getFlag(MOD, 'transform')?.ended ? message.getFlag(MOD, 'transform') : null, 15000);
            ok('§5 with no Temporary Hit Points left the spell ends on the target: reverted, the record ended', ended?.ended?.word === 'noTemp' && !dummyNow()?.actor?.isPolymorphed, JSON.stringify({ ended: ended?.ended, still: dummyNow()?.actor?.isPolymorphed }));
            const end = await waitFor(() => game.messages.contents.find(m => m.getFlag(MOD, 'formEnd')?.messageId === message.id) ?? null, 6000);
            if (end) madeMessages.push(end);
          }
          await revertAll();
          if (want(8)) {
            // The spell's Concentration is its save activity's; the transform activity is a second use on the same item.
            const concActivity = [...spell.system.activities].find(a => a.duration?.concentration) ?? null;
            const conc = concActivity ? await sorcerer.beginConcentrating(concActivity) : null;
            if (!conc) skips.push('§8 — the PHB Polymorph carries no Concentration activity this box can begin');
            else {
              targetOnly([dummyNow()?.id].filter(Boolean));
              const again = await useTransform(spell);
              targetOnly([]);
              await answer(again.message, asKnown(frog));
              const formEffect = formEffectOn(dummyNow()?.actor);
              ok('§8 the form effect depends on the caster\'s Concentration', !!formEffect && (formEffect.getFlag('dnd5e', 'dependentOn') === conc.uuid), JSON.stringify({ effect: formEffect?.name, dep: formEffect?.getFlag('dnd5e', 'dependentOn'), conc: conc.uuid }));
              await conc.delete();
              const ended = await waitFor(() => again.message.getFlag(MOD, 'transform')?.ended ? again.message.getFlag(MOD, 'transform') : null, 15000);
              ok('§8 ending Concentration ends the form: the Dummy reverted, the record ended by Concentration', ended?.ended?.word === 'concentration' && !dummyNow()?.actor?.isPolymorphed, JSON.stringify({ ended: ended?.ended, still: dummyNow()?.actor?.isPolymorphed }));
              const end = await waitFor(() => game.messages.contents.find(m => m.getFlag(MOD, 'formEnd')?.messageId === again.message.id) ?? null, 6000);
              if (end) madeMessages.push(end);
              await revertAll();
            }
          }
        }
      }
    }

    // ================================================== 6. the Long Rest
    if (want(6)) {
      const playerUser = game.users.find(u => !u.isGM) ?? null;
      const priorOwnership = foundry.utils.deepClone(druid._source.ownership ?? { default: 0 });
      if (!playerUser) skips.push('§6 — no player test user on this box: the swap is gated to party members');
      else {
        await druid.update({ ownership: { default: 0, [playerUser.id]: 3 } }, { diff: false, recursive: false });
        await wildShape.setFlag(MOD, 'knownForms', [wolf, rat, horse, spider].map(asKnown));
        const t0 = Date.now();
        await druid.longRest({ dialog: false, chat: true, newDay: false });
        const card = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t0) && (m.getFlag(MOD, 'formSwap')?.status === 'pending')) ?? null, 10000);
        if (card) madeMessages.push(card);
        const sf = card?.getFlag(MOD, 'formSwap');
        ok('§6 the Long Rest posts the ask: four known, none open', !!sf && (sf.slots === 4) && (sf.open === 0) && (sf.known?.length === 4), JSON.stringify({ slots: sf?.slots, open: sf?.open, known: sf?.known?.map(k => k.name) }));
        const popup = await waitFor(() => dialogs().find(a => /You know these forms/.test(a.element?.textContent ?? '')) ?? null, 6000);
        ok('§6 the popup: "You know these forms", a box per known form, the pool below, Keep them', !!popup && (popup.element.querySelectorAll('input[name="bf-form-out"]').length === 4) && !!popup.element.querySelector('button[data-action="keep"]'), `popup=${!!popup}`);
        if (popup) { try { await popup.close(); } catch { /* gone */ } }
        if (!card) throw new Error('§6: no formSwap card rose after the Long Rest');
        await api.answerFormSwap(card, { out: wolf.uuid, into: asKnown(bear) });
        const done = await waitFor(() => game.messages.get(card.id)?.getFlag(MOD, 'formSwap')?.applied ? game.messages.get(card.id) : null, 10000);
        const after = done?.getFlag(MOD, 'formSwap');
        const known = (wildShape.getFlag(MOD, 'knownForms') ?? []).map(k => k.name);
        ok('§6 the elect lands it: Wolf → Brown Bear on the item', after?.outcome === 'changed' && JSON.stringify(known) === JSON.stringify(['Brown Bear', 'Rat', 'Riding Horse', 'Spider']), `outcome=${after?.outcome} known=${known.join(',')}`);
        const confirm = await waitFor(() => dialogs().find(a => /Swapped Wolf → Brown Bear/.test(a.element?.textContent ?? '')) ?? null, 6000);
        ok('§6 the confirmation: "You now know these forms", OK', !!confirm && /You now know these forms/.test(confirm.element.textContent), `popup=${!!confirm}`);
        if (confirm) { confirm.element.querySelector('button[data-action="ok"]')?.click(); await waitFor(() => game.messages.get(card.id)?.getFlag(MOD, 'formSwap')?.acknowledged === true, 6000); }
        // the open slots: two known, two adds
        await wildShape.setFlag(MOD, 'knownForms', [wolf, rat].map(asKnown));
        const t1 = Date.now();
        await druid.longRest({ dialog: false, chat: true, newDay: false });
        const card2 = await waitFor(() => game.messages.contents.find(m => (m.timestamp >= t1) && (m.getFlag(MOD, 'formSwap')?.status === 'pending')) ?? null, 10000);
        if (card2) madeMessages.push(card2);
        const p2 = await waitFor(() => dialogs().find(a => /Choose your known forms/.test(a.element?.textContent ?? '')) ?? null, 6000);
        ok('§6 with open slots the ask is "Choose your known forms"', !!card2 && (card2.getFlag(MOD, 'formSwap')?.open === 2) && !!p2, `open=${card2?.getFlag(MOD, 'formSwap')?.open} popup=${!!p2}`);
        if (p2) { try { await p2.close(); } catch { /* gone */ } }
        if (!card2) throw new Error('§6: no formSwap card rose after the second Long Rest');
        await api.answerFormSwap(card2, { adds: [asKnown(horse), asKnown(bear)] });
        const landed2 = await waitFor(() => game.messages.get(card2.id)?.getFlag(MOD, 'formSwap')?.applied ? game.messages.get(card2.id) : null, 10000);
        const known2 = (wildShape.getFlag(MOD, 'knownForms') ?? []).map(k => k.name);
        ok('§6 the two slots are filled', landed2?.getFlag(MOD, 'formSwap')?.outcome === 'changed' && JSON.stringify(known2) === JSON.stringify(['Wolf', 'Rat', 'Riding Horse', 'Brown Bear']), `known=${known2.join(',')}`);
        const c2 = await waitFor(() => dialogs().find(a => /Learned Riding Horse, Brown Bear/.test(a.element?.textContent ?? '')) ?? null, 6000);
        if (c2) { c2.element.querySelector('button[data-action="ok"]')?.click(); await waitFor(() => game.messages.get(card2.id)?.getFlag(MOD, 'formSwap')?.acknowledged === true, 6000); }
        await druid.update({ ownership: priorOwnership }, { diff: false, recursive: false });
      }
    }
  } catch (err) {
    results.push({ name: 'suite threw', pass: false, detail: `${err?.message}\n${err?.stack}` });
  } finally {
    await teardown();
  }
  return { results, log, skips };
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'transforms', out, plan, f });
