// Live suite: SUMMONS (issue #1) — the system's placement switched off at the use, the record stamped
// on the cast card, the popup off the card, the placement folded in, the elect landing the creature with
// dnd5e's own profile changes, the caster's players owning it, the seat after the caster, the dragon's
// breath narrowed and the shared resistance on the caster, and Dismiss.
//
// Fixtures: BTB Test Sorcerer (tools/fixture-suite.mjs) is lent the PHB's Summon Beast, Summon Dragon and
// Find Familiar for the sections that need them; the summon art table is set for §7 and put back; the cards it posts, the tokens the elect creates, the imported
// spirits and the resistance effect are torn down. The placement preview is a canvas interaction, so
// the suite answers the record directly through the module's api and the pure fold, never the popup.
//
// Sections: `--section 2`, `--list`. Fixtures and teardown ALWAYS run.
import { announcePlan, connectSuite, finish, sectionArg, sectionPlan } from './harness.mjs';

// THE COVERAGE MAP (tools/coverage-map.mjs) — ⚠ NEVER import a suite; the map is parsed.
export const COVERS = [
  'summons.js',   // §1 the intercept and the record, §2 the landing, §3 the dragon, §4 Dismiss, §5 the seat, §6 the pool it picks from (gallery.js is a service: the battery's)
  'summon-art.js' // §7 the Summon Art window lists the familiar's pool, and the table's art lands on the familiar
];

const SECTIONS = {
  1: 'THE RECORD: a Summon Beast cast by the Sorcerer posts its card with NO token created by the system and a `summon` flag `asked` carrying three profile rows with art and stat lines',
  2: 'THE LANDING: the record answered (Bestial Land Spirit, one square beside the caster) is landed by the elect — one token on the scene, the Land spirit, flags.dnd5e.summon.level = 2, the card "summoned"',
  3: 'THE DRAGON: Summon Dragon answered with fire lands a Draconic Spirit whose Breath Weapon carries fire alone, and a "Shared Resistance (Fire)" effect on the caster dependent on the concentration effect',
  4: 'DISMISS: the Dismiss ask deletes the landed token and the resistance effect; the card says dismissed',
  5: 'THE SEAT: with the caster in a started combat at Initiative 15, the landed creature joins at 14.99 right after it',
  6: 'THE POOL: the pack index pool at CR 0, beasts only, holds Owl once (the MM copy), sorted by CR then name',
  7: 'SUMMON ART: the Summon Art window lists the Owl for Find Familiar; with the Owl given a token and a portrait in the table, a Find Familiar landed as an Owl wears the token, the portrait and the token on its companion effect'
};
const DEPENDS = { 3: [1], 4: [2], 5: [2] };

const { plan, pulled } = sectionPlan(SECTIONS, DEPENDS);
const f = await connectSuite({ tag: 'summons', watchdogMs: 240_000 });
announcePlan('summons', plan, pulled);

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
  const waitFor = async (test, timeout = 8000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) { const v = await test(); if (v) return v; await sleep(200); }
    return test();
  };

  const modDoc = game.modules.get(MOD);
  if (!modDoc?.active) return { fatal: `module active=${modDoc?.active}` };
  const api = modDoc.api?.summons;
  if (!api?.askDismiss) return { fatal: 'no summons api — OLD code (reload the box)' };

  const caster = game.actors.getName('BTB Test Sorcerer');
  if (!caster) return { fatal: 'missing fixture: BTB Test Sorcerer — run tools/fixture-suite.mjs' };
  // ⚠ The range is VIEWED first (every other suite does): a fresh client's canvas is the world's
  // active scene, and in the battery that is not the range — this suite went FATAL at
  // "the Sorcerer has no token on the scene" in the overnight battery of 2026-10-11 while green alone.
  const range = game.scenes.getName('By the Books Test Range');
  if (!range) return { fatal: 'missing fixture: scene By the Books Test Range — run tools/fixture-suite.mjs' };
  if (canvas.scene?.id !== range.id) await range.view();
  for (let i = 0; i < 40 && !(canvas.ready && canvas.scene?.id === range.id); i++) await sleep(250);
  if (canvas.scene?.id !== range.id) return { fatal: 'the canvas never readied on the test range' };
  const casterToken = canvas.scene.tokens.find(t => t.actor?.id === caster.id) ?? null;
  if (!casterToken) return { fatal: 'the Sorcerer has no token on the scene — run tools/fixture-suite.mjs' };
  const lent = [];
  let artBefore;
  const madeTokens = [];
  const madeActors = [];
  const madeMessages = [];
  const teardown = async () => {
    try {
      for (const app of foundry.applications.instances.values()) {
        if (/Summon/.test(app.element?.textContent ?? '') && (app instanceof foundry.applications.api.DialogV2)) { try { await app.close(); } catch { /* gone */ } }
      }
      const tokens = madeTokens.filter(id => canvas.scene.tokens.get(id));
      if (tokens.length) await canvas.scene.deleteEmbeddedDocuments('Token', tokens);
      for (const e of caster.effects.filter(e => /Shared Resistance|Summon/.test(e.name))) { try { await e.delete(); } catch { /* gone */ } }
      if (artBefore !== undefined) await game.settings.set(MOD, 'summonArt', artBefore);
      const live = lent.filter(id => caster.items.get(id));
      if (live.length) await caster.deleteEmbeddedDocuments('Item', live);
      for (const a of madeActors) { if (game.actors.get(a.id)) await a.delete(); }
      for (const m of madeMessages) { if (game.messages.get(m.id)) await m.delete(); }
      if (game.combat?.getFlag(MOD, 'suiteSummons')) await game.combat.delete();
    } catch (err) { log.push(`TEARDOWN ERROR: ${err?.message}`); }
  };

  const lend = async name => {
    const pack = game.packs.get('dnd-players-handbook.spells');
    if (!pack) throw new Error("the Player's Handbook spells pack is not on this box");
    const hit = (await pack.getIndex()).find(e => e.name === name);
    if (!hit) throw new Error(`the PHB ships no "${name}" this box can find`);
    const src = (await pack.getDocument(hit._id)).toObject();
    src.system.prepared = 1;
    const [item] = await caster.createEmbeddedDocuments('Item', [src]);
    lent.push(item.id);
    return item;
  };
  const tokensBefore = () => new Set(canvas.scene.tokens.map(t => t.id));
  const newTokens = before => canvas.scene.tokens.filter(t => !before.has(t.id));
  const importedSpirits = () => game.actors.filter(a => a.getFlag('dnd5e', 'isAutoImported') && /Spirit/.test(a.name));
  const castSummon = async (item, { consume = false } = {}) => {
    const activity = item.system.activities.getByType('summon')[0];
    const before = tokensBefore();
    const result = await activity.use({ consume: { spellSlot: consume }, create: { measuredTemplate: false } }, { configure: false }, { create: true });
    const message = result?.message instanceof ChatMessage ? result.message : null;
    if (message) madeMessages.push(message);
    const flag = await waitFor(() => message?.getFlag(MOD, 'summon')?.status === 'asked' ? message.getFlag(MOD, 'summon') : null, 6000);
    return { activity, message, flag, before };
  };
  // The suite answers the record as the popup would, through the pure fold the module exports: one square to the right of the caster.
  const answer = async (message, { profileName = null, choice = null } = {}) => {
    const { placedAnswer } = await import('/modules/fvtt-mod-bythebooks/scripts/decide/summons.js');
    const { SUMMON_CHOICES } = await import('/modules/fvtt-mod-bythebooks/scripts/decide/registry.js');
    const flag = message.getFlag(MOD, 'summon');
    const profile = profileName ? flag.profiles.find(p => p.label === profileName || p.name === profileName) : flag.profiles[0];
    const grid = canvas.scene.grid.size;
    const patch = placedAnswer(flag, { profileId: profile?.id ?? null, choice, count: 1, sceneId: canvas.scene.id,
      placements: [{ x: casterToken.x + grid * 2, y: casterToken.y, elevation: casterToken.elevation ?? 0, rotation: 0 }] }, SUMMON_CHOICES);
    if (!patch) throw new Error('the suite\'s answer was refused by placedAnswer');
    await message.setFlag(MOD, 'summon', { ...flag, ...patch });
    return waitFor(() => message.getFlag(MOD, 'summon')?.applied ? message.getFlag(MOD, 'summon') : null, 20000);
  };
  const landedToken = flag => canvas.scene.tokens.get(flag?.landed?.[0]?.tokenId) ?? null;

  try {
    const beastItem = want(1) || want(2) || want(4) || want(5) ? await lend('Summon Beast') : null;
    if (sections === null || sections.some(s => ['1', '2', '4', '5'].includes(s))) {
      const { message, flag, before } = await castSummon(beastItem);
      ok('§1 the system placed nothing', newTokens(before).length === 0, `${newTokens(before).length} new tokens`);
      ok('§1 the record is asked with three profiles', flag?.status === 'asked' && flag.profiles?.length === 3, JSON.stringify(flag?.profiles?.map(p => p.label)));
      ok('§1 a row carries art and a stat line', !!flag?.profiles?.[0]?.img && !!flag.profiles[0].summary?.attacks?.length, JSON.stringify(flag?.profiles?.[0]?.summary));
      if (want(2) && flag) {
        const landed = await answer(message, { profileName: 'Bestial Land Spirit' });
        const tok = landedToken(landed);
        if (tok) madeTokens.push(tok.id);
        for (const a of importedSpirits()) if (!madeActors.includes(a)) madeActors.push(a);
        ok('§2 the elect landed one token', landed?.outcome === 'landed' && !!tok, JSON.stringify({ outcome: landed?.outcome, failure: landed?.failure }));
        // ⚠ The PHB names all three forms' prototype tokens "Bestial Spirit": the form is the actor's name.
        const base = game.actors.get(tok?.actorId ?? '');
        const source = base?._stats?.compendiumSource ?? '';
        ok('§2 it is the Land spirit at the spell\'s level', /BestialLan/.test(source) && (tok?.actor?.getFlag('dnd5e', 'summon')?.level === 2), `${base?.name} from ${source} level=${tok?.actor?.getFlag('dnd5e', 'summon')?.level}`);
        const row = await waitFor(() => document.querySelector(`[data-message-id="${message.id}"] .bythebooks-summon`), 6000);
        ok('§2 the card says summoned', /— summoned/.test(row?.textContent ?? ''), (row?.textContent ?? '').trim().slice(0, 120));
        if (want(5)) {
          // The seat: a combat with the caster at 15; a second cast lands beside it.
          const combat = await Combat.create({ scene: canvas.scene.id, active: true, [`flags.${MOD}.suiteSummons`]: true });
          await combat.createEmbeddedDocuments('Combatant', [{ tokenId: casterToken.id, sceneId: canvas.scene.id, actorId: caster.id, initiative: 15 }]);
          await combat.startCombat();
          const second = await castSummon(beastItem);
          const landed2 = second.flag ? await answer(second.message, { profileName: 'Bestial Air Spirit' }) : null;
          const tok2 = landedToken(landed2);
          if (tok2) madeTokens.push(tok2.id);
          const seat = combat.combatants.find(c => c.tokenId === tok2?.id);
          ok('§5 the creature sits right after the caster', seat?.initiative === 14.99, `initiative=${seat?.initiative}`);
          await combat.delete();
        }
        if (want(4)) {
          await api.askDismiss(message);
          const gone = await waitFor(() => message.getFlag(MOD, 'summon')?.dismissed ? true : null, 15000);
          ok('§4 Dismiss deleted the token', gone && !canvas.scene.tokens.get(tok?.id), `dismissed=${gone} tokenStands=${!!canvas.scene.tokens.get(tok?.id)}`);
        }
      }
    }
    if (want(3)) {
      const dragonItem = await lend('Summon Dragon');
      const { message, flag } = await castSummon(dragonItem);
      ok('§3 the dragon\'s record asks the choice', flag?.choice === 'Summon Dragon' && flag.profiles?.length === 1, JSON.stringify({ choice: flag?.choice, n: flag?.profiles?.length }));
      const landed = flag ? await answer(message, { choice: 'fire' }) : null;
      const tok = landedToken(landed);
      if (tok) madeTokens.push(tok.id);
      for (const a of importedSpirits()) if (!madeActors.includes(a)) madeActors.push(a);
      const breath = tok?.actor?.items.find(i => i.name === 'Breath Weapon');
      const types = [...(breath?.system.activities ?? [])].flatMap(a => (a.damage?.parts ?? []).flatMap(p => [...(p.types ?? [])]));
      ok('§3 the breath carries fire alone', types.length > 0 && types.every(t => t === 'fire'), JSON.stringify(types));
      const effect = caster.effects.find(e => /Shared Resistance/.test(e.name));
      const conc = caster.effects.get(message.system?.concentration);
      ok('§3 the resistance stands on the caster, dependent on concentration', !!effect && (effect.getFlag('dnd5e', 'dependentOn') === conc?.uuid) && effect.changes.some(c => c.key === 'system.traits.dr.value' && c.value === 'fire'), JSON.stringify({ effect: effect?.name, dep: effect?.getFlag('dnd5e', 'dependentOn'), conc: conc?.uuid }));
      if (conc) {
        await conc.delete();
        const gone = await waitFor(() => (!canvas.scene.tokens.get(tok?.id) && !caster.effects.get(effect?.id)) ? true : null, 15000);
        ok('§3 ending concentration takes the token and the resistance with it', !!gone, `token=${!!canvas.scene.tokens.get(tok?.id)} resistance=${!!caster.effects.get(effect?.id)} dismissed=${!!message.getFlag(MOD, 'summon')?.dismissed}`);
      }
    }
    if (want(6)) {
      const { poolFromPacks } = await import('/modules/fvtt-mod-bythebooks/scripts/gallery.js');
      const rows = await poolFromPacks({ crMax: 0, types: ['beast'] });
      const owls = rows.filter(r => r.name === 'Owl');
      ok('§6 the pool holds Owl once, the MM copy', owls.length === 1 && /dnd-monster-manual/.test(owls[0]?.pack ?? ''), JSON.stringify(owls.map(o => o.pack)));
      ok('§6 sorted by CR then name', rows.every((r, i) => !i || (rows[i - 1].cr < r.cr) || ((rows[i - 1].cr === r.cr) && (rows[i - 1].name.localeCompare(r.name) <= 0))), `${rows.length} rows`);
    }
    if (want(7)) {
      // The window: opened from its settings button, its Owl row drawn.
      const menu = game.settings.menus.get(`${MOD}.summonArtMenu`);
      const win = menu ? new menu.type() : null;
      if (win) await win.render(true);
      const owlRow = await waitFor(() => win?.element?.querySelector('[data-bf-art-row="owl"]'), 20000);
      ok('§7 the window lists the Owl for Find Familiar', !!owlRow, `menu=${!!menu} rows=${win?.element?.querySelectorAll('[data-bf-art-row]').length ?? 0}`);
      if (win) await win.close();
      // The landing: the table's art for the Owl, then a familiar cast and answered as an Owl (Fey).
      const TOKEN = 'icons/svg/mystery-man.svg';
      const PORTRAIT = 'icons/svg/cowled.svg';
      artBefore = foundry.utils.deepClone(game.settings.get(MOD, 'summonArt') ?? {});
      await game.settings.set(MOD, 'summonArt', { ...artBefore, 'find familiar': { owl: { token: TOKEN, portrait: PORTRAIT } } });
      const familiar = await lend('Find Familiar');
      const { message, flag } = await castSummon(familiar);
      const { placedAnswer } = await import('/modules/fvtt-mod-bythebooks/scripts/decide/summons.js');
      const { SUMMON_CHOICES } = await import('/modules/fvtt-mod-bythebooks/scripts/decide/registry.js');
      const { poolFromPacks } = await import('/modules/fvtt-mod-bythebooks/scripts/gallery.js');
      const owl = (await poolFromPacks({ crMax: 0, types: ['beast'] })).find(r => r.name === 'Owl');
      const grid = canvas.scene.grid.size;
      const patch = (flag && owl) ? placedAnswer(flag, { profileId: flag.profiles[0]?.id ?? null, pick: { uuid: owl.uuid, name: owl.name }, count: 1, sceneId: canvas.scene.id,
        creatureType: (flag.creatureTypes ?? []).includes('fey') ? 'fey' : (flag.creatureTypes?.[0] ?? null),
        placements: [{ x: casterToken.x, y: casterToken.y + grid * 2, elevation: casterToken.elevation ?? 0, rotation: 0 }] }, SUMMON_CHOICES) : null;
      if (patch) await message.setFlag(MOD, 'summon', { ...flag, ...patch });
      const landed = patch ? await waitFor(() => message.getFlag(MOD, 'summon')?.applied ? message.getFlag(MOD, 'summon') : null, 20000) : null;
      const tok = landedToken(landed);
      if (tok) madeTokens.push(tok.id);
      for (const a of game.actors.filter(a => a.getFlag('dnd5e', 'isAutoImported') && a.name === 'Owl')) if (!madeActors.includes(a)) madeActors.push(a);
      ok('§7 the familiar landed as an Owl', landed?.outcome === 'landed' && !!tok, JSON.stringify({ patch: !!patch, owl: !!owl, outcome: landed?.outcome, failure: landed?.failure }));
      ok('§7 it wears the table token', tok?.texture?.src === TOKEN, `texture=${tok?.texture?.src}`);
      ok('§7 its sheet wears the table portrait', tok?.actor?.img === PORTRAIT, `img=${tok?.actor?.img}`);
      const effect = caster.effects.find(e => e.getFlag(MOD, 'companion') === message.id);
      ok('§7 the companion effect wears the token', effect?.img === TOKEN, `effect=${effect?.name} img=${effect?.img}`);
      if (landed) {
        await api.askDismiss(message);
        await waitFor(() => message.getFlag(MOD, 'summon')?.dismissed ? true : null, 15000);
      }
    }
  } catch (err) {
    results.push({ name: 'suite threw', pass: false, detail: `${err?.message}\n${err?.stack}` });
  } finally {
    await teardown();
  }
  return { results, log, skips };
}, sectionArg(plan, SECTIONS));

await finish({ tag: 'summons', out, plan, f });
